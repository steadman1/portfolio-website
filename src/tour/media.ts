import type { Media } from '../content';
import { h, roll } from '../lib/dom';
import { openLightbox } from './lightbox';

/**
 * The photos/videos next to a tour stop: one at a time; "Next" steps
 * through them, and tapping the photo opens it large (./lightbox.ts).
 * Files only download once the stop is near.
 */
export class MediaStepper {
  readonly el: HTMLElement;
  private items: (HTMLImageElement | HTMLVideoElement)[];
  private index = 0;
  private active = false;
  private loaded = false;
  private count: HTMLElement;
  private caption: HTMLElement;
  private stage: HTMLElement;
  /** Width / height of each item, once it has loaded. */
  private ratios: (number | null)[];

  constructor(private media: Media[]) {
    this.items = media.map((m) => {
      if ('video' in m) {
        const video = h('video', { class: 'media-item', poster: m.poster, loop: true, playsinline: true, preload: 'none', 'aria-label': m.alt, 'data-src': m.video });
        video.muted = true;
        return video;
      }
      return h('img', { class: 'media-item', alt: m.alt, width: 800, height: 800, decoding: 'async', 'data-src': m.image });
    });
    this.ratios = this.items.map(() => null);
    this.items.forEach((item, i) => {
      const measure = () => {
        const [w, hgt] = item instanceof HTMLVideoElement ? [item.videoWidth, item.videoHeight] : [item.naturalWidth, item.naturalHeight];
        if (!w || !hgt) return;
        this.ratios[i] = w / hgt;
        if (i === this.index) this.fit();
      };
      item.addEventListener(item instanceof HTMLVideoElement ? 'loadedmetadata' : 'load', measure);
    });

    this.count = h('span', { class: 'media-count' });
    this.caption = h('span', { class: 'media-caption' });
    const several = media.length > 1;

    // Videos are portrait, so their stepper is taller than wide.
    const portrait = media.some((m) => 'video' in m);
    // Tapping the photo opens it large.
    this.stage = h(
      'button',
      { class: 'media-stage', type: 'button', 'aria-label': 'Enlarge photo', onClick: () => openLightbox(this.media, this.index, (i) => this.show(i)) },
      ...this.items,
    );
    this.el = h(
      'figure',
      { class: portrait ? 'media media--portrait' : 'media' },
      this.stage,
      h(
        'figcaption',
        { class: 'media-bar label' },
        several ? this.count : null,
        this.caption,
        several ? h('button', { class: 'media-next roll', type: 'button', onClick: () => this.step(1) }, roll('Next')) : null,
      ),
    );
    this.show(0);
  }

  /** Start downloading. Called when the stop is close to being shown. */
  load() {
    if (this.loaded) return;
    this.loaded = true;
    for (const item of this.items) {
      const src = item.dataset.src;
      if (src) item.src = src;
    }
  }

  /** Plays the current video while the stop is on screen. */
  setActive(active: boolean) {
    this.active = active;
    this.syncVideo();
  }

  private step(by: number) {
    this.show((this.index + by + this.items.length) % this.items.length);
  }

  private show(index: number) {
    this.index = index;
    this.items.forEach((item, i) => item.classList.toggle('is-current', i === index));
    this.count.textContent = `${index + 1} / ${this.items.length}`;
    this.caption.textContent = this.media[index].caption ?? '';
    this.fit();
    this.syncVideo();
  }

  /** Landscape items get a wider box in their own shape; portrait and
   *  square ones use the normal box. */
  private fit() {
    const ratio = this.ratios[this.index];
    const wide = !!ratio && ratio > 1.05;
    this.el.classList.toggle('media--wide', wide);
    this.stage.style.aspectRatio = wide ? String(ratio) : '';
  }

  private syncVideo() {
    this.items.forEach((item, i) => {
      if (!(item instanceof HTMLVideoElement)) return;
      if (this.active && i === this.index) {
        this.load();
        item.play().catch(() => {});
      } else {
        item.pause();
      }
    });
  }
}
