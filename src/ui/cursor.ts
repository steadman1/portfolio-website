import { h } from '../lib/dom';
import { clamp, damp } from '../lib/math';
import { finePointer, motion, onFrame } from '../lib/loop';

/**
 * Custom cursor: public/pointer.svg normally, public/hand.svg over anything
 * clickable (links, buttons, anything matching INTERACTIVE).
 *
 * - Small clickable things also lean toward the pointer ("magnetic").
 * - Add data-cursor="none" to an element to opt it out, or data-cursor to
 *   opt a non-link element in (it gets the hand).
 * - Only runs on devices with a mouse/trackpad; touch screens keep the
 *   normal behavior.
 *
 * To swap the artwork, replace the SVGs and update CURSORS below: `size` is
 * how big it's drawn (px), `hotspot` is the point that clicks, as a
 * fraction of the image (0,0 = top left, 1,1 = bottom right), and `angle`
 * turns the artwork around the hotspot (degrees, negative = anticlockwise).
 * The arrow in pointer.svg points straight up, so it's turned 30° to give
 * the macOS look, with the arrow's left edge vertical.
 */

const CURSORS = {
  pointer: { src: '/pointer.svg', size: 46, hotspot: [0.5, 0.11], angle: -30 },
  hand: { src: '/hand.svg', size: 68, hotspot: [0.39, 0.25], angle: 0 },
};

// The cursor tilts a little in the direction it's moving, then springs back.
const TILT_PER_SPEED = 0.012; // degrees per px/s of sideways movement...
const TILT_MAX = 14; // ...up to this many degrees

const INTERACTIVE = 'a, button, [data-cursor]';
const MAGNET_PULL = 0.3; // element follows this fraction of the pointer's offset...
const MAGNET_MAX = 8; // ...up to this many pixels
const MAGNET_MAX_WIDTH = 480; // bigger elements (photos, the 3D view) don't move
const MAGNET_MAX_HEIGHT = 120;

type Spring = { x: number; y: number; vx: number; vy: number; goalX: number; goalY: number };

export function initCursor() {
  if (!finePointer) return;

  const images = Object.entries(CURSORS).map(([name, c]) =>
    h('img', {
      class: `cursor-img cursor-${name}`,
      src: c.src,
      alt: '',
      width: c.size,
      height: c.size,
      draggable: 'false',
      style: {
        left: `${-c.size * c.hotspot[0]}px`,
        top: `${-c.size * c.hotspot[1]}px`,
        transformOrigin: `${c.hotspot[0] * 100}% ${c.hotspot[1] * 100}%`,
        '--angle': `${c.angle}deg`,
      },
    }),
  );
  const root = h('div', { class: 'cursor', 'aria-hidden': 'true' }, ...images);
  document.body.append(root);

  const pointer = { x: 0, y: 0 };
  const last = { x: 0, y: 0 };
  const tilt = { angle: 0, speed: 0, velocityX: 0 };
  const magnets = new Map<HTMLElement, Spring>();
  let target: HTMLElement | null = null;
  let magnetic = false;
  let started = false;

  function setTarget(el: EventTarget | null) {
    let next = el instanceof Element ? el.closest<HTMLElement>(INTERACTIVE) : null;
    if (next?.dataset.cursor === 'none') next = null;
    if (!next && el instanceof HTMLCanvasElement && document.documentElement.classList.contains('is-exploring')) {
      next = el; // dragging the 3D model in explore mode
    }
    if (next === target) return;
    target = next;
    magnetic = false;
    if (target && !(target instanceof HTMLCanvasElement)) {
      const r = target.getBoundingClientRect();
      magnetic = r.width <= MAGNET_MAX_WIDTH && r.height <= MAGNET_MAX_HEIGHT;
      if (magnetic && !magnets.has(target)) magnets.set(target, { x: 0, y: 0, vx: 0, vy: 0, goalX: 0, goalY: 0 });
    }
    root.classList.toggle('is-hand', !!target);
  }

  addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      if (!started) {
        // Only hide the system cursor once ours is actually running.
        started = true;
        last.x = pointer.x;
        last.y = pointer.y;
        document.documentElement.classList.add('has-cursor');
      }
      root.classList.add('is-visible');
      setTarget(e.target);
    },
    { passive: true },
  );

  // The page can scroll underneath a still pointer; re-check what's under it.
  addEventListener('scroll', () => started && setTarget(document.elementFromPoint(pointer.x, pointer.y)), { passive: true });
  document.documentElement.addEventListener('mouseleave', () => root.classList.remove('is-visible'));
  document.documentElement.addEventListener('mouseenter', () => started && root.classList.add('is-visible'));
  addEventListener('pointerdown', () => root.classList.add('is-pressed'));
  addEventListener('pointerup', () => root.classList.remove('is-pressed'));

  onFrame((dt) => {
    if (!started) return;

    // The cursor itself follows the pointer exactly (no lag).
    root.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`;

    // Tilt toward the direction of movement on a slightly bouncy spring.
    if (dt > 0) {
      tilt.velocityX = damp(tilt.velocityX, (pointer.x - last.x) / dt, 14, dt);
      last.x = pointer.x;
      last.y = pointer.y;
      const goal = motion.reduced ? 0 : clamp(tilt.velocityX * TILT_PER_SPEED, -TILT_MAX, TILT_MAX);
      // Small steps keep the spring steady even when frames are slow.
      for (let left = dt; left > 0; left -= 1 / 120) {
        const step = Math.min(left, 1 / 120);
        tilt.speed += (200 * (goal - tilt.angle) - 14 * tilt.speed) * step;
        tilt.angle += tilt.speed * step;
      }
      if (Math.abs(tilt.angle) + Math.abs(tilt.speed) < 0.01) tilt.angle = tilt.speed = 0;
      root.style.setProperty('--tilt', `${tilt.angle.toFixed(2)}deg`);
    }

    if (target && !target.isConnected) setTarget(null);

    if (target && magnetic) {
      const rect = target.getBoundingClientRect();
      const spring = magnets.get(target)!;
      // Centre of the element without its magnetic offset.
      const cx = rect.left + rect.width / 2 - spring.x;
      const cy = rect.top + rect.height / 2 - spring.y;
      const max = motion.reduced ? 0 : MAGNET_MAX;
      spring.goalX = clamp((pointer.x - cx) * MAGNET_PULL, -max, max);
      spring.goalY = clamp((pointer.y - cy) * MAGNET_PULL, -max, max);
    }

    // Magnetic elements: a slightly springy pull toward the pointer,
    // and a spring back to rest when the pointer leaves.
    for (const [el, s] of magnets) {
      if (el !== target) {
        s.goalX = 0;
        s.goalY = 0;
      }
      const stiffness = 180;
      const damping = 18;
      s.vx += (stiffness * (s.goalX - s.x) - damping * s.vx) * dt;
      s.vy += (stiffness * (s.goalY - s.y) - damping * s.vy) * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const atRest = el !== target && Math.abs(s.x) + Math.abs(s.y) + Math.abs(s.vx) + Math.abs(s.vy) < 0.05;
      if (atRest) {
        el.style.translate = '';
        magnets.delete(el);
      } else {
        el.style.translate = `${s.x.toFixed(2)}px ${s.y.toFixed(2)}px`;
      }
    }
  });
}
