import { intro, links, tools, type ToolId } from '../content';
import { h, isExternal, reveal, roll } from '../lib/dom';
import { finePointer, motion, onFrame } from '../lib/loop';
import { damp } from '../lib/math';
import { toolIcons } from '../ui/tool-icons';

/** The introduction at the top of the page. Only the name and the links
 *  slide in (reveal); the smaller text is simply there. The letters of the
 *  name shy away from the cursor, and each skill has its tools' icons. */
export function renderHero(root: HTMLElement) {
  let i = 0;
  // Each letter of the name is its own span, so it can be pushed around (repel()).
  const name = h(
    'h1',
    { class: 'hero-name', 'aria-label': intro.name },
    ...intro.name
      .split(' ')
      .map((word) => reveal(h('span', { 'aria-hidden': 'true' }, ...[...word].map((c) => h('span', { class: 'hero-char' }, c))), i++, 'span')),
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
        ...intro.bio.map((paragraph) => h('p', {}, paragraph)),
        h(
          'p',
          { class: 'hero-skills label' },
          ...intro.skills.flatMap((skill, n) => [
            n > 0 ? ', ' : null,
            skillElement(skill.label, skill.tools),
          ]),
        ),
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

/** Letters of the name lean away from the cursor, as if magnetically
 *  repelled: they're pushed back, tilt away, and grow slightly as it
 *  comes near. */
function repel(name: HTMLElement) {
  if (!finePointer || motion.reduced) return;
  const chars = [...name.querySelectorAll<HTMLElement>('.hero-char')].map((el) => ({ el, x: 0, y: 0, s: 1, r: 0 }));
  // Let letters move outside the reveal masks once the name has slid in.
  const inners = name.querySelectorAll('.reveal-inner');
  inners[inners.length - 1]?.addEventListener('transitionend', () => name.classList.add('is-settled'), { once: true });

  const pointer = { x: -1e4, y: -1e4 };
  addEventListener('pointermove', (e) => ((pointer.x = e.clientX), (pointer.y = e.clientY)), { passive: true });
  document.addEventListener('pointerleave', () => ((pointer.x = -1e4), (pointer.y = -1e4)));

  let resting = true;
  onFrame((dt) => {
    const box = name.getBoundingClientRect();
    const size = parseFloat(getComputedStyle(name).fontSize);
    const reach = size * REPEL_RADIUS;
    const near = pointer.x > box.left - reach && pointer.x < box.right + reach && pointer.y > box.top - reach && pointer.y < box.bottom + reach;
    if (!near && resting) return;
    resting = !near;
    for (const c of chars) {
      const r = c.el.getBoundingClientRect();
      // Where the letter would be without its push.
      const dx = r.left + r.width / 2 - c.x - pointer.x;
      const dy = r.top + r.height / 2 - c.y - pointer.y;
      const dist = Math.hypot(dx, dy) || 1;
      const t = Math.max(0, 1 - dist / reach);
      const force = t * t * (3 - 2 * t); // eases off smoothly towards the edge of its reach
      c.x = damp(c.x, (dx / dist) * force * size * REPEL_PUSH, REPEL_RATE, dt);
      c.y = damp(c.y, (dy / dist) * force * size * REPEL_PUSH, REPEL_RATE, dt);
      c.s = damp(c.s, 1 + force * REPEL_SCALE, REPEL_RATE, dt);
      c.r = damp(c.r, (dx / dist) * force * REPEL_TILT, REPEL_RATE, dt);
      if (Math.abs(c.x) > 0.05 || Math.abs(c.y) > 0.05 || c.s > 1.0005 || Math.abs(c.r) > 0.05) resting = false;
      c.el.style.transform = `translate(${c.x.toFixed(2)}px, ${c.y.toFixed(2)}px) rotate(${c.r.toFixed(2)}deg) scale(${c.s.toFixed(4)})`;
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
