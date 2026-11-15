export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Frame-rate independent smoothing: moves `current` toward `target`.
 * `rate` is roughly "how many times per second it closes the gap";
 * higher is snappier.
 */
export const damp = (current: number, target: number, rate: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-rate * dt));

export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * A critically damped spring: moves `value` (with speed `velocity`) toward
 * `target` without overshooting, speeding up and slowing down smoothly.
 * `rate` works like damp()'s: higher is snappier. Returns [value, velocity].
 */
export function spring(value: number, velocity: number, target: number, rate: number, dt: number): [number, number] {
  const offset = value - target;
  const k = velocity + rate * offset;
  const decay = Math.exp(-rate * dt);
  return [target + (offset + k * dt) * decay, (velocity - rate * k * dt) * decay];
}

/**
 * An S-curve from 0 to 1 with a chosen speed at each end (0 = starts or
 * stops gently, 1 = keeps moving at an even pace). With both ends at 0
 * it's the classic "smoothstep".
 */
export const easeBetween = (t: number, startSpeed: number, endSpeed: number) =>
  (startSpeed + endSpeed - 2) * t * t * t + (3 - 2 * startSpeed - endSpeed) * t * t + startSpeed * t;

export type Rect = { x: number; y: number; width: number; height: number };

export const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  width: lerp(a.width, b.width, t),
  height: lerp(a.height, b.height, t),
});
