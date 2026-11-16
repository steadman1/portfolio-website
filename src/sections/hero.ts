import { intro, links, tools, type ToolId } from '../content';
import { h, isExternal, reveal, roll } from '../lib/dom';
import { finePointer, motion, onFrame } from '../lib/loop';
import { damp } from '../lib/math';
import { mark } from '../lib/perf';
import { toolIcons } from '../ui/tool-icons';

/** The introduction at the top of the page. The letters of the name swoop
 *  in and then shy away from the cursor; the links slide in (reveal); the
 *  smaller text is simply there. Each skill has its tools' icons.
 *  The skills line sits right under the name, above the bio. */
export function renderHero(root: HTMLElement) {
  let i = 0;
  // Each letter of the name is its own span, so it can swoop in and be
  // pushed around (repel()). Each word stays together on one line.
  const name = h(
    'h1',
    { class: 'hero-name', 'aria-label': intro.name },
    ...intro.name.split(' ').map((word) => {
      i++; // the links below still slide in after the name
      return h('span', { class: 'hero-word', 'aria-hidden': 'true' }, ...[...word].map((c) => h('span', { class: 'hero-char' }, c)));
    }),
  );
  root.append(
    h(
      'div',
      { class: 'hero-inner', 'data-reveal': true },
      h(
        'div',
        { class: 'hero-top' },
        portraitButton(),
        h('p', { class: 'label' }, `${intro.tagline}`, h('br'), intro.school),
      ),
      name,
      h(
        'div',
        { class: 'hero-body' },
        h(
          'p',
          { class: 'hero-skills label' },
          ...intro.skills.flatMap((skill, n) => [
            n > 0 ? ', ' : null,
            skill.more ? moreElement(skill.label, skill.more) : skillElement(skill.label, skill.tools ?? []),
          ]),
        ),
        ...intro.bio.map((paragraph) => h('p', {}, paragraph)),
        reveal(
          h(
            'ul',
            { class: 'link-row' },
            ...links.map((link) =>
              h(
                'li',
                {},
                h('a', { class: 'roll', href: link.href, target: isExternal(link.href) ? '_blank' : null, rel: isExternal(link.href) ? 'noopener' : null }, roll(link.label)),
              ),
            ),
          ),
          i++,
        ),
      ),
    ),
    h(
      'div',
      { class: 'hero-foot label' },
      h(
        'div',
        { class: 'hero-foot-start' },
        h('span', {}, 'Scroll'),
        h('span', { class: 'load-status', 'aria-live': 'polite' }, 'Apartment ', h('span', { class: 'load-percent' }, '0%')),
      ),
      h(
        'p',
        { class: 'hero-credit' },
        `${intro.credit} `,
        h('a', { class: 'roll', href: intro.creditLink.href }, roll(intro.creditLink.label)),
      ),
    ),
  );
  repel(name);
}

/** Whole years since the start of `year`. */
const yearsSince = (year: number) => Math.floor((Date.now() - new Date(year, 0, 1).getTime()) / (365.25 * 24 * 3600 * 1000));

const experience = (id: ToolId) => {
  const years = yearsSince(tools[id].since);
  return `${tools[id].name} · ${years} yr${years === 1 ? '' : 's'}`;
};

/** A skill with its tools' icons on the left. Hovering the skill (its text
 *  or any of its icons) colours its icons and shows the experience with
 *  each tool. */
function skillElement(label: string, ids: ToolId[]) {
  return h(
    'span',
    { class: 'skill' },
    ...ids.map(toolIcon),
    label,
    ids.length ? h('span', { class: 'skill-tip', 'aria-hidden': 'true' }, ids.map(experience).join('   ')) : null,
  );
}

/** A skill with no icons ("and more") whose hover tip lists more skills.
 *  Focusable, so touch and keyboard users can see the list too. */
function moreElement(label: string, more: string[]) {
  return h(
    'span',
    { class: 'skill skill-more', tabindex: 0 },
    label,
    h('span', { class: 'skill-tip' }, more.join(', ')),
  );
}

/** A tool's logo: black until its skill is hovered, then in colour. */
function toolIcon(id: ToolId) {
  const { color, paths } = toolIcons[id];
  const icon = h('span', {
    class: 'skill-icon',
    tabindex: 0,
    role: 'img',
    'aria-label': experience(id).replace(' · ', ', ').replace('yr', 'year'),
    style: { '--brand': color },
  });
  const shapes = paths.map((p) => `<path d="${p.d}"${p.color ? ` style="--c:${p.color}"` : ''}/>`).join('');
  icon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${shapes}</svg>`;
  return icon;
}

// Name letters: how close the cursor has to be to push a letter (in letter
// heights), how far it pushes at most and how much it grows (fractions of
// the font size), and how quickly letters follow (higher = snappier).
const REPEL_RADIUS = 1.2;
const REPEL_PUSH = 0.12;
const REPEL_SCALE = 0.08;
const REPEL_TILT = 6; // degrees at most, leaning away from the cursor
const REPEL_RATE = 12;
// Touch screens: an invisible cursor drifts over the name instead. How
// strongly it pushes (fraction of a real cursor's push) and how fast it
// wanders (higher = faster).
const GHOST_STRENGTH = 0.6;
const GHOST_SPEED = 1;
// The swoop in: how far away each letter starts (letter heights, random
// between the two), how tilted (degrees, either way) and how small, how
// quickly it's drawn in and fades in (higher = faster), and the delay
// between letters plus a random extra (seconds).
const ENTER_DISTANCE = [0.12, 0.3];
const ENTER_TILT = 8;
const ENTER_SCALE = 0.92;
const ENTER_RATE = 6;
const ENTER_FADE_RATE = 6;
const ENTER_STAGGER = 0.03;
const ENTER_JITTER = 0.05;

/** Letters of the name lean away from the cursor, as if magnetically
 *  repelled: they're pushed back, tilt away, and grow slightly as it
 *  comes near. Touch screens have no cursor to hover with, so there an
 *  invisible one wanders over the letters on its own.
 *
 *  When the intro first shows, each letter starts somewhere random nearby,
 *  tilted, small and invisible, and is drawn into place with the same
 *  easing as the push, one shortly after another. */
let settle: () => void;
/** Resolves once the name has finished swooping in (right away with
 *  reduced motion): the intro's animation is done, so heavier work can
 *  start without making it stutter (see tour/loading.ts). */
export const introSettled = new Promise<void>((resolve) => (settle = () => {
  mark('name settled');
  resolve();
}));

function repel(name: HTMLElement) {
  if (motion.reduced) return settle();
  const chars = [...name.querySelectorAll<HTMLElement>('.hero-char')].map((el, n) => {
    const angle = Math.random() * Math.PI * 2;
    const distance = ENTER_DISTANCE[0] + Math.random() * (ENTER_DISTANCE[1] - ENTER_DISTANCE[0]);
    el.style.opacity = '0'; // hidden until its swoop starts
    return {
      el,
      x: 0,
      y: 0,
      s: ENTER_SCALE,
      r: (Math.random() * 2 - 1) * ENTER_TILT,
      o: 0,
      // Where it starts, in letter heights from its place.
      from: { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance },
      delay: n * ENTER_STAGGER + Math.random() * ENTER_JITTER,
      settled: false,
    };
  });

  const pointer = { x: -1e4, y: -1e4 };
  const ghost = !finePointer;
  const strength = ghost ? GHOST_STRENGTH : 1;
  if (!ghost) {
    addEventListener('pointermove', (e) => ((pointer.x = e.clientX), (pointer.y = e.clientY)), { passive: true });
    document.addEventListener('pointerleave', () => ((pointer.x = -1e4), (pointer.y = -1e4)));
  }
  // The ghost's path: two slow waves per axis at unrelated speeds, from a
  // random starting point, so it meanders and never quite repeats.
  const phase = Array.from({ length: 4 }, () => Math.random() * Math.PI * 2);
  let time = 0;

  let started = false; // the swoop begins when the intro is shown (reveal.ts adds "is-in")
  let entered = false; // every letter has arrived
  let clock = 0;
  let resting = true;
  onFrame((dt) => {
    const size = parseFloat(getComputedStyle(name).fontSize);
    if (!started) {
      if (!name.parentElement?.classList.contains('is-in')) return;
      started = true;
      for (const c of chars) {
        c.x = c.from.x * size;
        c.y = c.from.y * size;
      }
    }
    clock += dt;
    const box = name.getBoundingClientRect();
    if (ghost) {
      // Only once the name has arrived, and only while it's on screen.
      if (entered && box.bottom > 0 && box.top < innerHeight) {
        time += dt * GHOST_SPEED;
        const u = 0.65 * Math.sin(0.42 * time + phase[0]) + 0.35 * Math.sin(1.07 * time + phase[1]);
        const v = 0.6 * Math.sin(0.53 * time + phase[2]) + 0.4 * Math.sin(1.31 * time + phase[3]);
        pointer.x = box.left + box.width * (0.5 + 0.55 * u);
        pointer.y = box.top + box.height * (0.5 + 0.6 * v);
      } else {
        pointer.x = pointer.y = -1e4;
      }
    }
    const reach = size * REPEL_RADIUS;
    const near = pointer.x > box.left - reach && pointer.x < box.right + reach && pointer.y > box.top - reach && pointer.y < box.bottom + reach;
    if (!near && resting && entered) return;
    resting = !near;
    let arrived = true;
    for (const c of chars) {
      if (clock < c.delay) {
        arrived = resting = false;
        continue;
      }
      // Slower while swooping in, then the push's own snappiness.
      const rate = c.settled ? REPEL_RATE : ENTER_RATE;
      const r = c.el.getBoundingClientRect();
      // Where the letter would be without its push.
      const dx = r.left + r.width / 2 - c.x - pointer.x;
      const dy = r.top + r.height / 2 - c.y - pointer.y;
      const dist = Math.hypot(dx, dy) || 1;
      const t = Math.max(0, 1 - dist / reach);
      const force = t * t * (3 - 2 * t) * strength; // eases off smoothly towards the edge of its reach
      c.x = damp(c.x, (dx / dist) * force * size * REPEL_PUSH, rate, dt);
      c.y = damp(c.y, (dy / dist) * force * size * REPEL_PUSH, rate, dt);
      c.s = damp(c.s, 1 + force * REPEL_SCALE, rate, dt);
      c.r = damp(c.r, (dx / dist) * force * REPEL_TILT, rate, dt);
      if (!c.settled) {
        c.o = damp(c.o, 1, ENTER_FADE_RATE, dt);
        if (c.o > 0.995 && Math.abs(c.x) < 0.5 && Math.abs(c.y) < 0.5 && Math.abs(c.r) < 0.1 && Math.abs(c.s - 1) < 0.002) {
          c.settled = true;
          c.o = 1;
        } else {
          arrived = false;
        }
        c.el.style.opacity = c.settled ? '' : c.o.toFixed(3);
      }
      if (Math.abs(c.x) > 0.05 || Math.abs(c.y) > 0.05 || c.s > 1.0005 || Math.abs(c.r) > 0.05) resting = false;
      c.el.style.transform = `translate(${c.x.toFixed(2)}px, ${c.y.toFixed(2)}px) rotate(${c.r.toFixed(2)}deg) scale(${c.s.toFixed(4)})`;
    }
    if (arrived && !entered) {
      entered = true;
      settle();
    }
  });
}

/** The square photo by the tagline; each click shows the next photo. */
function portraitButton() {
  const images = intro.portraits.map((p, i) =>
    h('img', { class: `hero-portrait-img${i === 0 ? ' is-current' : ''}`, src: p.src, alt: p.alt, width: 72, height: 72, decoding: 'async' }),
  );
  let current = 0;
  const several = images.length > 1;
  return h(
    several ? 'button' : 'div',
    {
      class: 'hero-portrait',
      type: several ? 'button' : null,
      'aria-label': several ? 'Show another photo of Spencer' : null,
      onClick: () => {
        if (!several) return;
        images[current].classList.remove('is-current');
        current = (current + 1) % images.length;
        images[current].classList.add('is-current');
      },
    },
    ...images,
  );
}
