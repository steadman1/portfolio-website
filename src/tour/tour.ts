import { stops, tourSettings, type Stop } from '../content';
import { h, reveal, roll, text } from '../lib/dom';
import { lerpRect, spring, type Rect } from '../lib/math';
import { motion, onFrame } from '../lib/loop';
import { limitWheelScrolling, scrollToY } from '../lib/smooth-scroll';
import { MediaStepper } from './media';
import { Timeline, type Position } from './timeline';

/**
 * The scroll-driven apartment tour (everything except the 3D drawing).
 *
 * Layout: the section is very tall; inside it, a screen-sized box sticks to
 * the viewport while you scroll through it. That box holds one layer per
 * stop, each a CSS grid with an empty "frame" slot (where the 3D view goes)
 * and a text panel. CSS decides where frames sit (see "Tour" in main.css);
 * this file measures those slots and glides the 3D view between them.
 *
 * The 3D view itself (./view.ts) loads later and plugs in with setView().
 */

export type FrameInfo = {
  /** Where we are between stops. */
  position: Position;
  /** The rectangle the 3D view should be drawn into, in window pixels. */
  rect: Rect;
  /** Index of the stop whose text is showing, or -1. */
  active: number;
  dt: number;
};

export interface TourView {
  frame(info: FrameInfo): void;
  clear(): void;
  explore(): void;
}

export class Tour {
  readonly timeline = new Timeline(stops);
  view: TourView | null = null;

  private sticky: HTMLElement;
  private frames: HTMLElement[] = [];
  private layers: HTMLElement[] = [];
  private steppers: (MediaStepper | null)[] = [];
  private ticks: { index: number; el: HTMLButtonElement }[] = [];
  private loader: HTMLElement;
  private rects: Rect[] = [];
  private distance = 0;
  private velocity = 0;
  private started = false;
  private active = -2;
  private activeTick = -1;
  private isStatic = false;

  /** `canvas` is the 3D view's canvas; it's moved inside the sticky box so it scrolls with the tour. */
  constructor(private section: HTMLElement, canvas?: HTMLCanvasElement) {
    const total = stops.filter((s) => s.panel?.title).length;
    let number = 0;

    stops.forEach((stop, index) => {
      const frame = h(
        'div',
        { class: 'stop-frame' },
        stop.fallbackImage ? h('img', { class: 'stop-fallback', 'data-src': stop.fallbackImage, alt: '', width: 800, height: 800 }) : null,
      );
      const stepper = stop.panel?.media ? new MediaStepper(stop.panel.media) : null;
      const panel = stop.panel ? this.renderPanel(stop, stop.panel.title ? ++number : 0, total, stepper) : null;
      this.frames.push(frame);
      this.steppers.push(stepper);
      const steps = stop.panel ? this.renderSteps(index) : null;
      this.layers.push(h('div', { class: 'stop', 'data-frame': stop.frame }, frame, panel, steps));
    });

    const nav = h(
      'nav',
      { class: 'tour-nav', 'aria-label': 'Tour stops' },
      ...stops.flatMap((stop, index) => {
        if (!stop.label) return [];
        const el = h(
          'button',
          { class: 'tick', type: 'button', 'aria-label': `Go to ${stop.label}`, onClick: () => this.scrollToStop(index) },
          h('span', { class: 'tick-label label' }, stop.label),
        );
        this.ticks.push({ index, el });
        return [el];
      }),
    );

    this.loader = h('div', { class: 'tour-loader label', 'aria-hidden': 'true' }, 'Loading the apartment ', h('span', { class: 'load-percent' }, '0%'));
    this.sticky = h('div', { class: 'tour-sticky' }, ...this.layers, nav, this.loader);
    if (canvas) this.sticky.prepend(canvas);
    section.append(this.sticky);

    this.layout();
    addEventListener('resize', () => this.layout());
    document.fonts?.ready.then(() => this.layout());
    onFrame((dt) => this.update(dt));
    limitWheelScrolling((y) => this.flickLimits(y));
  }

  /**
   * One fast flick of the wheel/trackpad stops at the next scene (or the
   * previous one, scrolling up) instead of racing through several.
   */
  private flickLimits(y: number) {
    if (this.isStatic) return null;
    const top = this.section.getBoundingClientRect().top + window.scrollY;
    const screen = window.innerHeight;
    if (y < top - screen * 0.75 || y > top + this.timeline.total) return null; // not near the tour
    const points = stops.flatMap((stop, i) => (stop.panel ? [this.stopScrollY(i)] : []));
    const next = points.find((p) => p > y + 2);
    const back = points.filter((p) => p < y - 2).pop();
    return { min: back ?? -Infinity, max: next ?? Infinity };
  }

  /** The page scroll position where stop `index` is showing. */
  private stopScrollY(index: number) {
    const dwell = this.timeline.dwell(index);
    const sectionTop = this.section.getBoundingClientRect().top + window.scrollY;
    return sectionTop + dwell.start + (dwell.end - dwell.start) * 0.35;
  }

  /** Hook up the 3D view once it has loaded. */
  setView(view: TourView) {
    this.view = view;
    document.documentElement.classList.add('is-3d-ready');
    this.section.querySelectorAll<HTMLElement>('.explore-button').forEach((b) => (b.hidden = false));
  }

  /** Model download progress, 0..1 (null when the size is unknown). */
  setProgress(fraction: number | null) {
    if (fraction == null) return;
    const label = `${Math.round(fraction * 100)}%`;
    document.querySelectorAll('.load-percent').forEach((el) => (el.textContent = label));
  }

  /** No WebGL, or the model failed to load: show the tour as plain sections with photos. */
  useStaticFallback() {
    this.isStatic = true;
    this.view = null;
    document.documentElement.classList.add('is-3d-failed');
    this.section.classList.add('tour--static');
    this.section.style.height = '';
    this.layers.forEach((layer) => layer.classList.add('is-active'));
    this.section.querySelectorAll<HTMLImageElement>('img[data-src]').forEach((img) => (img.src = img.dataset.src!));
    this.steppers.forEach((s) => s?.load());
  }

  /** Scroll the page so stop `index` is showing. */
  scrollToStop(index: number, instant = false) {
    const top = this.stopScrollY(index);
    // Slow enough to watch the camera fly: longer trips take a little longer.
    const screens = Math.abs(top - window.scrollY) / window.innerHeight;
    const seconds = Math.min(tourSettings.buttonFlightSeconds + screens * 0.25, tourSettings.buttonFlightSeconds * 2);
    scrollToY(top, instant, seconds);
    if (instant) this.started = false; // snap instead of gliding there
  }

  /** Re-measure the frame slots and the tour's scroll length. */
  layout() {
    if (this.isStatic) return;
    const screen = this.sticky.clientHeight || window.innerHeight;
    this.timeline.layout(screen);
    this.section.style.height = `${Math.round(this.timeline.total + screen)}px`;
    const box = this.sticky.getBoundingClientRect();
    this.rects = this.frames.map((frame) => {
      const r = frame.getBoundingClientRect();
      return { x: r.left - box.left, y: r.top - box.top, width: r.width, height: r.height };
    });
  }

  private update(dt: number) {
    if (this.isStatic) return;

    // How far (px) the page has scrolled into the tour; negative before it.
    const raw = -this.section.getBoundingClientRect().top;
    if (!this.started) {
      this.distance = raw;
      this.velocity = 0;
      this.started = true;
    }
    // The camera follows the scroll on a spring, so it speeds up and slows
    // down gradually instead of jolting whenever the wheel moves.
    // A big jump (a header link, dragging the scrollbar) snaps the camera
    // there instead of flying it through every stop in between.
    const bigJump = Math.abs(raw - this.distance) > window.innerHeight * 2;
    if (motion.reduced || bigJump) {
      this.distance = raw;
      this.velocity = 0;
    } else {
      [this.distance, this.velocity] = spring(this.distance, this.velocity, raw, tourSettings.smoothing, dt);
      if (Math.abs(this.distance - raw) < 0.05 && Math.abs(this.velocity) < 1) {
        this.distance = raw;
        this.velocity = 0;
      }
    }

    const position = this.timeline.locate(this.distance);
    const box = this.sticky.getBoundingClientRect();
    const local = lerpRect(this.rects[position.from], this.rects[position.to], position.t);
    const rect = local; // the canvas sits in the sticky box, so box coordinates are canvas coordinates

    this.setActive(this.activeStopAt(this.distance));
    this.setActiveTick(this.tickAt(this.distance));

    if (!this.view) {
      this.loader.style.transform = `translate(${local.x + local.width / 2}px, ${local.y + local.height / 2}px) translate(-50%, -50%)`;
      return;
    }
    const onScreen = box.bottom > 0 && box.top < window.innerHeight;
    if (onScreen) this.view.frame({ position, rect, active: this.active, dt });
    else this.view.clear();
  }

  /** The stop whose text should show: from a little before the camera arrives until a little after it leaves. */
  private activeStopAt(distance: number) {
    const screen = this.sticky.clientHeight || window.innerHeight;
    for (let i = 0; i < stops.length; i++) {
      if (!stops[i].panel) continue;
      const dwell = this.timeline.dwell(i);
      const before = i === 0 ? 0.4 * screen : 0.25 * this.timeline.travelLength(i);
      const after = i === stops.length - 1 ? Infinity : 0.25 * this.timeline.travelLength(i + 1);
      if (distance >= dwell.start - before && distance <= dwell.end + after) return i;
    }
    return -1;
  }

  /** The last labelled stop the camera has (at least half) reached. */
  private tickAt(distance: number) {
    let current = 0;
    for (const { index } of this.ticks) {
      if (distance >= this.timeline.dwell(index).start - this.timeline.travelLength(index) / 2) current = index;
    }
    return current;
  }

  private setActive(index: number) {
    if (index === this.active) return;
    this.active = index;
    this.layers.forEach((layer, i) => {
      layer.classList.toggle('is-active', i === index);
      this.steppers[i]?.setActive(i === index);
    });
    // Download photos for this stop and its neighbours.
    for (const i of [index - 1, index, index + 1, index + 2]) this.steppers[i]?.load();
  }

  private setActiveTick(index: number) {
    if (index === this.activeTick) return;
    this.activeTick = index;
    for (const tick of this.ticks) {
      const on = tick.index === index;
      tick.el.classList.toggle('is-current', on);
      if (on) tick.el.setAttribute('aria-current', 'step');
      else tick.el.removeAttribute('aria-current');
    }
  }

  /** "Return to …" (bottom left) and "Continue to …" (bottom right), between stops that have text. */
  private renderSteps(index: number) {
    const withText = stops.map((s, j) => (s.panel ? j : -1)).filter((j) => j >= 0);
    const back = withText.filter((j) => j < index).pop();
    const next = withText.find((j) => j > index);
    const step = (label: string, to: number, className: string) =>
      h('button', { class: `roll stop-step ${className}`, type: 'button', onClick: () => this.scrollToStop(to) }, roll(label));
    const name = (j: number) => stops[j].panel?.title ?? stops[j].label ?? 'the last stop';
    return h(
      'nav',
      { class: 'stop-steps', 'aria-label': 'Tour' },
      back != null ? step(`Return to ${name(back)}`, back, 'stop-step--back') : null,
      next != null ? step(`Continue to ${name(next)}`, next, 'stop-step--next') : null,
    );
  }

  private renderPanel(stop: Stop, number: number, total: number, stepper: MediaStepper | null) {
    const panel = stop.panel!;
    const pad = (n: number) => String(n).padStart(2, '0');
    let i = 0;
    return h(
      'div',
      { class: 'stop-panel' },
      panel.title ? reveal(h('p', { class: 'label' }, `${pad(number)} / ${pad(total)}`), i++) : null,
      panel.title ? reveal(h('h2', { class: 'stop-title' }, panel.title), i++) : null,
      reveal(h('p', { class: 'stop-text' }, text(panel.text)), i++),
      stepper ? reveal(stepper.el, i++) : null,
      panel.action === 'explore'
        ? reveal(
            h('button', { class: 'button roll explore-button', type: 'button', hidden: true, onClick: () => this.view?.explore() }, roll('Explore the building')),
            i++,
          )
        : null,
    );
  }
}
