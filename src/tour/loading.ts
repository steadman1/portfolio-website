import { bakedModel, modelUrl } from '../content';

/**
 * The parts of loading the apartment that don't need three.js, so they can
 * start straight away: downloading its files, and picking moments when the
 * heavy steps (which each block the page for a moment) won't be noticed.
 */

/** Downloads a file, reporting bytes as they arrive. */
async function download(url: string, onBytes: (loaded: number, total: number | null) => void) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  // A compressed response reports its compressed size, so this is a guide.
  const total = Number(response.headers.get('content-length')) || null;
  if (!response.body) return response.blob();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onBytes(loaded, total);
  }
  return new Blob(chunks as BlobPart[]);
}

export type ApartmentFiles = {
  /** Lit by the baked lightmap (else real-time lights). */
  baked: boolean;
  model: Promise<ArrayBuffer>;
  lightmap: Promise<Blob> | null;
};

/**
 * Starts downloading the model and its lightmap. Downloading never blocks
 * the page. `onProgress` gets 0..1 for both files together (or null while
 * their sizes are unknown).
 *
 * Add ?live-lighting to the address for real-time lighting instead of the
 * baked lightmap, or ?sharp-lightmap for the 8192px lightmap.
 */
export function downloadApartment(onProgress: (fraction: number | null) => void): ApartmentFiles {
  const params = new URLSearchParams(location.search);
  const baked = bakedModel.enabled && !params.has('live-lighting');
  const urls = baked ? [bakedModel.url, params.has('sharp-lightmap') ? bakedModel.lightmapSharp : bakedModel.lightmap] : [modelUrl];
  const loaded = urls.map(() => 0);
  const totals: (number | null)[] = urls.map(() => null);
  const report = () => {
    if (totals.some((t) => t == null)) return onProgress(null);
    const sum = (list: (number | null)[]) => list.reduce<number>((a, b) => a + (b ?? 0), 0);
    onProgress(Math.min(0.99, sum(loaded) / sum(totals)));
  };
  const files = urls.map((url, i) =>
    download(url, (l, t) => {
      loaded[i] = l;
      totals[i] = t;
      report();
    }),
  );
  const result: ApartmentFiles = {
    baked,
    model: files[0].then((blob) => blob.arrayBuffer()),
    lightmap: baked ? files[1] : null,
  };
  // A failed download is reported when it's awaited; until then, stay quiet.
  result.model.catch(() => {});
  result.lightmap?.catch(() => {});
  return result;
}

let lastScroll = -Infinity;
for (const type of ['scroll', 'wheel', 'touchmove']) {
  addEventListener(type, () => (lastScroll = performance.now()), { passive: true, capture: true });
}

/** How long the page must have been still before heavy work, and the
 *  longest any one step waits for that (ms). */
const STILL_FOR = 400;
const MAX_WAIT = 4000;

/**
 * Makes a `quiet()` that resolves at a good moment for a burst of
 * main-thread work: after `settled` (the intro's animation is done), when
 * the page hasn't scrolled for a moment, just after a frame was drawn. It
 * doesn't wait when `urgent()` (the apartment is about to be on screen) or
 * the tab is hidden, and never longer than MAX_WAIT.
 */
export function makeQuiet(settled: Promise<void>, urgent: () => boolean) {
  let isSettled = false;
  settled.then(() => (isSettled = true));
  return () =>
    new Promise<void>((resolve) => {
      const start = performance.now();
      const check = () => {
        const now = performance.now();
        const still = isSettled && now - lastScroll > STILL_FOR;
        if (still || urgent() || document.hidden || now - start > MAX_WAIT) setTimeout(resolve, 0); // right after this frame
        else requestAnimationFrame(check);
      };
      // Hidden tabs don't draw frames, so check those straight away.
      if (document.hidden) check();
      else requestAnimationFrame(check);
    });
}
