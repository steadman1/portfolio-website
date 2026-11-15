import type { Stop } from '../content';
import { clamp, easeBetween } from '../lib/math';

/**
 * Turns the list of stops into a scroll timeline.
 *
 * Every stop has a "travel" (scrolling spent flying to it) and a "dwell"
 * (scrolling during which it holds). Laid end to end:
 *
 *   [dwell 0][travel 1][dwell 1][travel 2][dwell 2] ...
 *
 * `locate(distance)` says where any scroll distance falls, so scrolling
 * backwards, reloading mid-way or jumping straight to a stop all land in
 * the right place.
 */

export type Segment = { kind: 'travel' | 'dwell'; stop: number; start: number; end: number };

/**
 * Where we are in the tour:
 * - between stop `from` and stop `to`, `t` (0..1, eased) of the way, or
 * - holding at a stop (`from === to`), `hold` (0..1) of the way through it.
 */
export type Position = { from: number; to: number; t: number; hold: number };

export class Timeline {
  segments: Segment[] = [];
  total = 0;
  private screen = 1;

  constructor(private stops: Stop[]) {}

  /** Recompute lengths for a screen height in px. */
  layout(screenHeight: number) {
    this.screen = screenHeight;
    this.segments = [];
    let at = 0;
    this.stops.forEach((stop, i) => {
      if (i > 0) {
        const start = at;
        at += stop.travel * screenHeight;
        this.segments.push({ kind: 'travel', stop: i, start, end: at });
      }
      const start = at;
      at += stop.dwell * screenHeight;
      this.segments.push({ kind: 'dwell', stop: i, start, end: at });
    });
    this.total = at;
  }

  dwell(i: number): Segment {
    return this.segments.find((s) => s.kind === 'dwell' && s.stop === i)!;
  }

  /** Scroll length of the flight into stop `i` (0 for the first stop). */
  travelLength(i: number) {
    return i > 0 && i < this.stops.length ? this.stops[i].travel * this.screen : 0;
  }

  locate(distance: number): Position {
    const d = clamp(distance, 0, this.total);
    const segment =
      this.segments.find((s) => d <= s.end && s.end > s.start) ?? this.segments[this.segments.length - 1];
    const u = segment.end > segment.start ? (d - segment.start) / (segment.end - segment.start) : 1;
    if (segment.kind === 'dwell') return { from: segment.stop, to: segment.stop, t: 0, hold: u };
    // Ease in and out of stops that hold, but keep moving through stops that
    // don't (dwell 0), so the camera doesn't pause halfway up the building.
    const leaving = this.stops[segment.stop - 1];
    const arriving = this.stops[segment.stop];
    const startSpeed = segment.stop - 1 > 0 && leaving.dwell === 0 ? 1 : 0;
    const endSpeed = arriving.dwell === 0 && segment.stop < this.stops.length - 1 ? 1 : 0;
    return { from: segment.stop - 1, to: segment.stop, t: easeBetween(u, startSpeed, endSpeed), hold: 0 };
  }
}
