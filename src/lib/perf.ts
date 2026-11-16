/**
 * Add ?perf to the address to see how long each step of loading the
 * apartment takes, and every frame that took over 50 ms (a visible
 * stutter), in a box at the bottom of the screen (and the console). A slow
 * frame right after a step usually means that step caused it. Tap the box
 * to copy its text.
 */
export const perfOn = new URLSearchParams(location.search).has('perf');

const start = performance.now();
const lines: string[] = [];
let box: HTMLElement | null = null;

const at = () => `${((performance.now() - start) / 1000).toFixed(2)}s`;

function log(line: string) {
  lines.push(line);
  console.log(`[perf] ${line}`);
  if (!box) {
    box = document.createElement('pre');
    Object.assign(box.style, {
      position: 'fixed',
      left: '8px',
      bottom: '8px',
      zIndex: '9999',
      maxWidth: 'calc(100vw - 16px)',
      maxHeight: '40vh',
      overflow: 'auto',
      margin: '0',
      padding: '8px 10px',
      background: 'rgba(0, 0, 0, 0.82)',
      color: '#fff',
      font: '11px/1.4 ui-monospace, Menlo, monospace',
      whiteSpace: 'pre-wrap',
    });
    box.title = 'Tap to copy';
    box.addEventListener('click', () => navigator.clipboard?.writeText(lines.join('\n')).catch(() => {}));
    document.body.append(box);
  }
  box.textContent = lines.join('\n');
  box.scrollTop = box.scrollHeight;
}

/** Notes that something happened, and when. */
export function mark(label: string) {
  if (perfOn) log(`${at()}  ${label}`);
}

/** Runs a step and notes how long it took (all of it main-thread work if
 *  it's synchronous; for async steps, also any waiting in between). */
export async function timed<T>(label: string, step: () => T | Promise<T>): Promise<T> {
  if (!perfOn) return step();
  const t = performance.now();
  const result = await step();
  log(`${at()}  ${label}: ${Math.round(performance.now() - t)} ms`);
  return result;
}

if (perfOn) {
  let last = performance.now();
  const watch = (now: number) => {
    const gap = now - last;
    last = now;
    if (gap > 50 && !document.hidden) log(`${at()}  ⚠ slow frame: ${Math.round(gap)} ms`);
    requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);
}
