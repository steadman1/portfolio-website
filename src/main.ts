import { renderContact } from './sections/contact';
import { renderHero } from './sections/hero';
import { renderWork } from './sections/work';
import '@fontsource-variable/inter';
import { initSmoothScroll } from './lib/smooth-scroll';
import { Tour } from './tour/tour';
import { initCursor } from './ui/cursor';
import { initReveal } from './ui/reveal';

/**
 * Entry point. The page itself (text, links, scrolling rows) renders right
 * away; three.js and the 3D model load afterwards in the background.
 */

const $ = (id: string) => document.getElementById(id)!;

renderHero($('intro'));
renderWork($('work'));
const tour = new Tour($('apartment'), $('stage') as HTMLCanvasElement);
renderContact($('contact'));

initSmoothScroll();
initReveal();
initCursor();

const params = new URLSearchParams(location.search);
const debug = params.has('debug');

async function load3D() {
  try {
    const { startView } = await import('./tour/view');
    const view = await startView(tour, $('stage') as HTMLCanvasElement);
    if (debug) {
      const { startDebug } = await import('./tour/debug');
      startDebug(tour, view);
    }
  } catch (error) {
    console.warn('3D view unavailable, showing photos instead.', error);
    tour.useStaticFallback();
  }
}

// Let the intro paint first, then start the big download.
requestAnimationFrame(() => setTimeout(load3D, 0));

if (debug && params.has('stop')) {
  requestAnimationFrame(() => tour.scrollToStop(Number(params.get('stop')), true));
}
