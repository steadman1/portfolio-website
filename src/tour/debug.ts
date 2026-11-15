import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { stops } from '../content';
import { h } from '../lib/dom';
import { pauseScroll, resumeScroll } from '../lib/smooth-scroll';
import type { CameraState } from './stage';
import type { Tour } from './tour';
import type { View } from './view';

/**
 * Camera helper for editing the tour. Open the site with ?debug in the URL.
 *
 * - The panel (bottom right) shows which stop you're at and the camera values.
 * - Press C to take over the camera: drag to orbit, right-drag to pan,
 *   scroll to zoom. Press C again to hand it back to the scroll.
 * - "Copy" puts the current camera on your clipboard in the same format as
 *   the `camera:` lines in src/content.ts. Paste it over the stop you want.
 * - ?debug&stop=3 opens the page at stop 3 (counting from 0).
 */
export function startDebug(tour: Tour, view: View) {
  const readout = h('pre', { class: 'debug-readout' });
  const copy = h('button', { class: 'debug-copy', type: 'button' }, 'Copy camera');
  const panel = h('aside', { class: 'debug' }, h('p', {}, 'Debug: press C for free camera'), readout, copy);
  document.body.append(panel);

  let controls: OrbitControls | null = null;
  let snippet = '';
  const fmt = (n: number) => Number(n.toFixed(3));

  const toggleFreeCamera = () => {
    if (controls) {
      controls.dispose();
      controls = null;
      view.override = null;
      document.documentElement.classList.remove('is-debug-camera');
      resumeScroll();
      return;
    }
    const { stage } = view;
    stage.camera.position.copy(view.scrollState.position);
    controls = new OrbitControls(stage.camera, stage.canvas);
    controls.target.copy(view.scrollState.target);
    controls.enableDamping = true;
    controls.update();
    const live: CameraState = { position: stage.camera.position, target: controls.target, fov: view.scrollState.fov };
    view.override = { fullScreen: 0, camera: () => (controls!.update(), live) };
    document.documentElement.classList.add('is-debug-camera');
    pauseScroll();
  };

  addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey) toggleFreeCamera();
  });
  copy.addEventListener('click', () => {
    navigator.clipboard?.writeText(snippet);
    copy.textContent = 'Copied';
    setTimeout(() => (copy.textContent = 'Copy camera'), 1200);
  });

  view.afterFrame = (info, state) => {
    const { from, to, t } = info.position;
    const where = from === to ? `stop ${from} (${stops[from].label ?? 'pass-through'})` : `stop ${from} -> ${to}, ${Math.round(t * 100)}%`;
    const p = state.position;
    const g = state.target;
    snippet = `camera: { position: [${fmt(p.x)}, ${fmt(p.y)}, ${fmt(p.z)}], target: [${fmt(g.x)}, ${fmt(g.y)}, ${fmt(g.z)}], fov: ${fmt(state.fov)} },`;
    readout.textContent = `${where}${controls ? '\nFREE CAMERA' : ''}\n${snippet}`;
  };

  Object.assign(window, { tour, view });
}
