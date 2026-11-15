import LocomotiveScroll from 'locomotive-scroll';
import 'locomotive-scroll/locomotive-scroll.css';
import { scrollSettings } from '../content';
import { driveScroll, motion } from './loop';

/**
 * Smooth "momentum" scrolling for mouse wheels and trackpads, using
 * Locomotive Scroll (which is built on Lenis). Touch screens keep their
 * native scrolling, and it's off entirely when the visitor has asked for
 * reduced motion.
 *
 * The page still scrolls for real (window.scrollY changes), so sticky
 * positioning, anchors and the browser's scrollbar all keep working; the
 * scroller just eases toward where the wheel asked to go.
 */

let locomotive: LocomotiveScroll | null = null;

const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

/**
 * Optional stopping points for wheel/trackpad scrolling. Given where the page
 * is heading, return how far up (min) and down (max) one flick may go, or
 * null for no limit. Used by the tour so a fast flick stops at the next scene.
 */
export type ScrollLimits = (y: number) => { min: number; max: number } | null;
let limits: ScrollLimits | null = null;
export function limitWheelScrolling(fn: ScrollLimits) {
  limits = fn;
}

// A "flick" is one push of the wheel or trackpad, including the momentum
// events macOS keeps sending after the fingers lift. A new flick starts when:
// - the wheel has been quiet for a moment, or
// - the direction changes, or
// - the page has arrived at the scene and the wheel pushes harder than the
//   fading momentum (a fresh swipe or wheel turn).
const FLICK_GAP_MS = 180;
const FRESH_PUSH = 1.15; // this much stronger than the last event = a new push
const WHEEL_NOTCH = 80; // mouse wheels send steady, large steps instead of momentum
let lastWheel = 0;
let lastSize = 0;
let lastDirection = 0;
let held = false; // the current flick was stopped at a scene
let flickLimits: { min: number; max: number } | null = null;

/** Keeps a single flick from scrolling past the current limits. */
function limitFlick(deltaY: number, event: WheelEvent | TouchEvent) {
  const lenis = locomotive?.lenisInstance;
  if (!lenis || !limits || event.type !== 'wheel' || deltaY === 0) return true;
  const now = performance.now();
  const size = Math.abs(deltaY);
  const direction = Math.sign(deltaY);
  const arrived = Math.abs(lenis.animatedScroll - lenis.targetScroll) < 2;
  const freshPush = held && arrived && (size > lastSize * FRESH_PUSH + 1 || (size >= WHEEL_NOTCH && size >= lastSize));
  if (now - lastWheel > FLICK_GAP_MS || direction !== lastDirection || freshPush) {
    flickLimits = null;
    held = false;
  }
  lastWheel = now;
  lastSize = size;
  lastDirection = direction;

  flickLimits ??= limits(lenis.targetScroll);
  if (!flickLimits) return true;
  const goal = lenis.targetScroll + deltaY;
  const allowed = Math.min(Math.max(goal, flickLimits.min), flickLimits.max);
  if (allowed === goal) return true;
  held = true;
  if (event.cancelable) event.preventDefault();
  if (lenis.targetScroll !== allowed) lenis.scrollTo(allowed, { programmatic: false, lerp: scrollSettings.lerp });
  return false;
}

export function initSmoothScroll() {
  if (motion.reduced) return;
  let stopDriving: (() => void) | null = null;
  locomotive = new LocomotiveScroll({
    lenisOptions: {
      lerp: scrollSettings.lerp,
      wheelMultiplier: scrollSettings.wheelSpeed,
      smoothWheel: true,
      // In-page links (the header's Work / Apartment / Contact) jump straight
      // there instead of scrolling through the whole tour on the way.
      anchors: { immediate: true },
      virtualScroll: ({ deltaY, event }) => limitFlick(deltaY, event),
    },
    // Run inside the site's single frame loop (src/lib/loop.ts) instead of
    // Locomotive's own, so the 3D view never lags a frame behind the page.
    initCustomTicker: (render) => (stopDriving = driveScroll(render)),
    destroyCustomTicker: () => stopDriving?.(),
  });
}

/** True while the smooth scroller is easing the page (the scroll is already smoothed). */
export function isGliding() {
  return locomotive?.lenisInstance?.isScrolling === 'smooth';
}

/** Scroll to `top` (px), gliding unless `instant`. `seconds` sets how long the glide takes. */
export function scrollToY(top: number, instant = false, seconds?: number) {
  const lenis = locomotive?.lenisInstance;
  if (lenis && seconds && !instant) lenis.scrollTo(top, { duration: seconds, easing: easeInOutSine, force: true });
  else if (lenis) lenis.scrollTo(top, { immediate: instant, force: true });
  else window.scrollTo({ top, behavior: instant || motion.reduced ? 'instant' : 'smooth' });
}

/** Pause page scrolling (explore mode, debug camera). */
export function pauseScroll() {
  locomotive?.lenisInstance?.stop();
}

export function resumeScroll() {
  locomotive?.lenisInstance?.start();
}
