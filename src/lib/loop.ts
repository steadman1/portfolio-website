/**
 * One requestAnimationFrame loop for the whole site, so the cursor, the
 * scrolling rows and the 3D view all update in the same frame.
 */

type FrameCallback = (dt: number, now: number) => void;

const callbacks: FrameCallback[] = [];
let scrollDriver: (() => void) | null = null;

/** Run `fn` every frame. `dt` is seconds since the last frame. Returns an unsubscribe function. */
export function onFrame(fn: FrameCallback): () => void {
  callbacks.push(fn);
  return () => {
    const i = callbacks.indexOf(fn);
    if (i >= 0) callbacks.splice(i, 1);
  };
}

/**
 * Run `fn` at the very start of every frame, before anything reads the
 * scroll position. The smooth scroller uses this so the page, the 3D view
 * and everything else see the same scroll position in the same frame.
 */
export function driveScroll(fn: () => void): () => void {
  scrollDriver = fn;
  return () => {
    if (scrollDriver === fn) scrollDriver = null;
  };
}

/** Live value of the visitor's "reduce motion" setting. */
const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
export const motion = { reduced: reducedQuery.matches };
reducedQuery.addEventListener('change', () => (motion.reduced = reducedQuery.matches));

/** True on devices with a mouse or trackpad (not touch screens). */
export const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

let last = performance.now();

function tick(now: number) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  scrollDriver?.();

  for (const fn of callbacks.slice()) fn(dt, now);
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
