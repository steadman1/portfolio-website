import type { Media } from '../content';
import { h, roll } from '../lib/dom';
import { pauseScroll, resumeScroll } from '../lib/smooth-scroll';

/**
 * A tour photo or video, enlarged: a white panel over a darkened page, with
 * "x / y", the caption, "Next" and "Close".
 *
 * Close with the button, Escape, or a click on the dark background. The
 * arrow keys step through the set too. `onChange` reports the photo being
 * shown, so the small one beside the tour can stay in step.
 */
export function openLightbox(media: Media[], start: number, onChange: (index: number) => void) {
  let index = start;
  const opener = document.activeElement as HTMLElement | null;
  const several = media.length > 1;

  const stage = h('div', { class: 'lightbox-stage' });
  const count = h('span', { class: 'lightbox-count label' });
  const caption = h('span', { class: 'lightbox-caption label' });
  const next = several ? h('button', { class: 'roll lightbox-next', type: 'button', onClick: () => step(1) }, roll('Next')) : null;
  const close = h('button', { class: 'roll lightbox-close', type: 'button', onClick: () => shut() }, roll('Close'));
  const panel = h('div', { class: 'lightbox-panel' }, stage, h('div', { class: 'lightbox-bar' }, several ? count : null, caption, next, close));
  const root = h(
    'div',
    {
      class: 'lightbox',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Photo viewer',
      // A click on the dark area (not the white panel) closes it.
      onClick: (e: MouseEvent) => e.target === root && shut(),
    },
    panel,
  );

  function show(i: number) {
    index = i;
    const m = media[i];
    let el: HTMLImageElement | HTMLVideoElement;
    if ('video' in m) {
      el = h('video', { class: 'lightbox-media', src: m.video, poster: m.poster, loop: true, playsinline: true, autoplay: true, 'aria-label': m.alt });
      el.muted = true;
    } else {
      el = h('img', { class: 'lightbox-media', src: m.image, alt: m.alt });
    }
    stage.replaceChildren(el);
    count.textContent = `${i + 1} / ${media.length}`;
    caption.textContent = m.caption ?? '';
    onChange(i);
  }

  function step(by: number) {
    show((index + by + media.length) % media.length);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') shut();
    else if (several && e.key === 'ArrowRight') step(1);
    else if (several && e.key === 'ArrowLeft') step(-1);
  }

  function shut() {
    removeEventListener('keydown', onKey);
    root.classList.remove('is-open');
    document.documentElement.classList.remove('has-lightbox');
    resumeScroll();
    stage.querySelector('video')?.pause();
    setTimeout(() => root.remove(), 300); // after the fade
    opener?.focus({ preventScroll: true });
  }

  show(start);
  document.body.append(root);
  document.documentElement.classList.add('has-lightbox');
  pauseScroll();
  addEventListener('keydown', onKey);
  requestAnimationFrame(() => {
    root.classList.add('is-open');
    (next ?? close).focus({ preventScroll: true });
  });
}
