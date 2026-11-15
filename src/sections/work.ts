import { workRows, type WorkItem } from '../content';
import { h, isExternal, isTodo, text } from '../lib/dom';
import { finePointer, motion } from '../lib/loop';

/**
 * The lists under the intro (Experience, then Software; see workRows in
 * content.ts), one under the other. Each item is a thin row: its title
 * on the left, its platform and year on the right. On hover
 * the row fills with black from the top down and its text turns white.
 *
 * Hovering an item shows a floating card next to the cursor: its video
 * playing silently, its large preview image, or else its square image, in
 * a black frame with the item's description underneath. Items with no
 * media get a card with just the description.
 *
 * Touch screens have no cursor to follow, so tapping an item fills its row
 * and opens the same card directly below the row, or above it if there's
 * more room there (with a link to open, for items that have one). Tapping anywhere else, or scrolling, closes it.
 * On desktop, clicking an item hides its card too.
 */

// How much wider than normal a landscape preview can get.
const MAX_WIDEN = 1.8;

export function renderWork(root: HTMLElement) {
  const preview = new Preview();
  const lists = workRows.filter((row) => row.items.length > 0);
  const items: WorkItem[] = [];

  const groups = lists.map((row) =>
    h(
      'section',
      { class: 'work-group', 'aria-label': row.label, 'data-reveal': true },
      h('h3', { class: 'work-group-label label' }, row.label),
      h('ul', { class: 'work-list' }, ...row.items.map((item) => itemElement(item, items.push(item) - 1))),
    ),
  );
  const wrap = h(
    'div',
    { class: 'work-inner' },
    ...groups,
  );
  root.append(wrap, preview.el);

  const itemEl = (target: EventTarget | null) => (target instanceof Element ? target.closest<HTMLElement>('.work-item') : null);
  const itemAt = (target: EventTarget | null) => {
    const el = itemEl(target);
    return el ? items[Number(el.dataset.index)] : null;
  };

  let current: WorkItem | null = null;
  const select = (item: WorkItem | null) => {
    if (item === current) return;
    current = item;
    if (!finePointer) {
      wrap.querySelectorAll('.work-item.is-active').forEach((el) => el.classList.remove('is-active'));
      const row = item ? wrap.querySelector<HTMLElement>(`.work-item[data-index="${items.indexOf(item)}"]`) : null;
      row?.classList.add('is-active');
      preview.anchor = row ?? preview.anchor; // keep it while the card fades out
    }
    preview.show(item);
  };

  if (finePointer) {
    wrap.addEventListener('pointerover', (e) => select(itemAt(e.target)));
    wrap.addEventListener('pointerleave', () => select(null));
    // Scrolling moves the rows under a still cursor without any pointer events.
    addEventListener(
      'scroll',
      () => {
        if (!current) return;
        const { x, y } = preview.pointer;
        const under = document.elementFromPoint(x, y);
        select(under && wrap.contains(under) ? itemAt(under) : null);
      },
      { passive: true },
    );
    // Keyboard: the card sits beside the focused item's title.
    wrap.addEventListener('focusin', (e) => {
      const el = itemEl(e.target);
      if (!el || el.matches(':hover')) return;
      const title = el.querySelector('.work-title')!.getBoundingClientRect();
      preview.pointer = { x: title.right, y: title.top + title.height / 2 };
      select(itemAt(el));
    });
    wrap.addEventListener('focusout', (e) => !wrap.contains(e.relatedTarget as Node) && select(null));
    // Clicking an item hides its card; it comes back on the next item hovered.
    wrap.addEventListener('click', (e) => itemEl(e.target) && preview.show(null));
  } else {
    // Tap an item to open its card; tap it again, or anywhere else, to close.
    let openedAt = 0; // scroll position when the card opened
    document.addEventListener('click', (e) => {
      const el = itemEl(e.target);
      if (el && wrap.contains(el)) {
        e.preventDefault(); // links open from the card instead
        const item = itemAt(el);
        select(item === current ? null : item);
        openedAt = scrollY;
      } else if (current && !(e.target instanceof Element && e.target.closest('.work-preview-link'))) {
        select(null); // anywhere else, including the card itself
      }
    });
    addEventListener(
      'scroll',
      () => {
        if (!current) return;
        if (Math.abs(scrollY - openedAt) > 60) select(null);
        else preview.place(); // stay with the row
      },
      { passive: true },
    );
  }
}

/** The black card that follows the cursor over an item (or, on touch
 *  screens, sits in the middle of the screen). */
class Preview {
  readonly el = h('div', { class: `work-preview${finePointer ? '' : ' is-centered'}`, 'aria-hidden': finePointer ? 'true' : null });
  private frame = h('div', { class: 'work-preview-frame' });
  private caption = h('p', { class: 'work-preview-text' });
  private link = h('a', { class: 'work-preview-link' }, 'Open ↗');
  // Touch screens: Close on the left, Open (for items with a link) on the right.
  // Any tap outside the Open link closes the card (see renderWork).
  private actions = h('div', { class: 'work-preview-actions' }, h('button', { class: 'work-preview-close', type: 'button' }, 'Close'), this.link);
  private media = new Map<WorkItem, HTMLImageElement | HTMLVideoElement>();
  private current: HTMLImageElement | HTMLVideoElement | null = null;
  private item: WorkItem | null = null;
  pointer = { x: 0, y: 0 };
  /** Touch screens: the row the card opens next to. */
  anchor: HTMLElement | null = null;

  constructor() {
    this.el.append(this.frame, this.caption);
    if (!finePointer) {
      this.el.append(this.actions);
      addEventListener('resize', () => this.item && this.place());
      return; // no cursor to follow on touch screens
    }
    addEventListener(
      'pointermove',
      (e) => {
        this.pointer = { x: e.clientX, y: e.clientY };
        if (this.item) this.place();
      },
      { passive: true },
    );
  }

  /** Right of the cursor, or left of it near the right edge of the screen;
   *  moved up if it would hang off the bottom. On touch screens: centred
   *  across, directly below the row or above it, whichever has more room. */
  place() {
    if (!finePointer) {
      if (!this.anchor) return;
      const row = this.anchor.getBoundingClientRect();
      const height = this.el.offsetHeight;
      const below = window.innerHeight - row.bottom >= row.top;
      const x = (window.innerWidth - this.el.offsetWidth) / 2;
      let y = below ? row.bottom + 8 : row.top - 8 - height;
      y = Math.max(16, Math.min(y, window.innerHeight - height - 16)); // on screen, even if it has to overlap the row
      this.el.classList.toggle('is-above', !below);
      this.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      return;
    }
    const { x: px, y: py } = this.pointer;
    const width = this.el.offsetWidth;
    const x = px + 32 + width > window.innerWidth ? px - 24 - width : px + 32;
    const y = Math.max(16, Math.min(py - 40, window.innerHeight - this.el.offsetHeight - 16));
    this.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  /** Landscape media gets wider in proportion to its shape (up to
   *  MAX_WIDEN times), so it ends up about as tall as a square one. Square
   *  and portrait media keep the normal width. */
  private fit() {
    const media = this.current;
    const [w, h] = !media ? [0, 0] : media instanceof HTMLVideoElement ? [media.videoWidth, media.videoHeight] : [media.naturalWidth, media.naturalHeight];
    const widen = w && h && w > h ? Math.min(w / h, MAX_WIDEN) : 1;
    this.el.style.setProperty('--widen', String(widen));
    this.place();
  }

  show(item: WorkItem | null) {
    if (item === this.item) return;
    const wasVisible = !!this.item;
    this.item = item;
    this.el.classList.toggle('is-visible', !!item);
    if (!item) return; // fades out with its last contents
    const next = this.mediaFor(item);
    if (next !== this.current) {
      if (this.current) {
        this.current.classList.remove('is-current');
        if (this.current instanceof HTMLVideoElement) this.current.pause();
      }
      this.current = next;
      if (next) {
        next.classList.add('is-current');
        if (next instanceof HTMLVideoElement && !motion.reduced) {
          next.currentTime = 0;
          next.play().catch(() => {}); // muted, so browsers allow it
        }
      }
    }
    this.el.classList.toggle('is-large', !!next?.classList.contains('is-large'));
    this.el.classList.toggle('is-text', !next);
    this.caption.replaceChildren(h('span', { class: 'work-preview-text-inner' }, text(item.description)));
    const href = item.href && !isTodo(item.href) ? item.href : null;
    this.el.classList.toggle('has-link', !!href);
    if (href) {
      this.link.href = href;
      this.link.target = isExternal(href) ? '_blank' : '';
      this.link.rel = isExternal(href) ? 'noopener' : '';
    }
    if (wasVisible) {
      // The new text swipes up into place.
      this.caption.classList.remove('is-changing');
      void this.caption.offsetWidth;
      this.caption.classList.add('is-changing');
    }
    this.fit(); // its size may differ from the last one
  }

  /** Built the first time an item is hovered, so nothing downloads early. */
  private mediaFor(item: WorkItem) {
    const image = [item.preview, item.image].find((src) => src && !isTodo(src));
    const video = item.video && !isTodo(item.video) ? item.video : undefined;
    if (!video && !image) return null;
    let el = this.media.get(item);
    if (!el) {
      // A large preview image shows bigger than the square icons.
      const large = !video && image === item.preview;
      const className = `work-preview-media${large ? ' is-large' : ''}`;
      if (video) {
        el = h('video', { class: className, src: video, poster: image, loop: true, playsinline: true, preload: 'auto' });
        el.muted = true;
      } else {
        el = h('img', { class: className, src: image, alt: '' });
      }
      // Re-size and re-place once its shape is known.
      el.addEventListener(video ? 'loadedmetadata' : 'load', () => el === this.current && this.fit());
      this.media.set(item, el);
      this.frame.append(el);
    }
    return el;
  }
}

function itemElement(item: WorkItem, index: number) {
  const content = [
    text(item.title, 'work-title'),
    h('span', { class: 'work-meta' }, text(item.meta), item.year ? text(item.year, 'work-year') : null),
  ];
  const href = item.href && !isTodo(item.href) ? item.href : null;
  const el = href
    ? h('a', { class: 'work-item', 'data-index': index, href, target: isExternal(href) ? '_blank' : null, rel: isExternal(href) ? 'noopener' : null }, ...content)
    : h('button', { class: 'work-item', 'data-index': index, type: 'button' }, ...content);
  return h('li', {}, el);
}
