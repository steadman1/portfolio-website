import { BackSide, Box3, type Intersection, type Material, type Mesh, type Object3D, Raycaster, Spherical, Vector2, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { h, roll } from '../lib/dom';
import { pauseScroll, resumeScroll } from '../lib/smooth-scroll';
import { easeInOutCubic, lerp } from '../lib/math';
import type { CameraState } from './stage';
import type { View } from './view';

/**
 * Explore mode: after the last stop, the visitor can drag the building
 * around freely. Page scrolling pauses (the scroll wheel zooms instead).
 * Clicking a window flies up to it to look inside; clicking anything else
 * flies back out. "Back to the tour" or Escape flies the camera back and
 * resumes scrolling.
 *
 * Resolves once the visitor has left explore mode.
 */

const LIMITS = { minDistance: 11, maxDistance: 45, maxPolarAngle: 2.5 };
const RETURN_SECONDS = 1.1;

// Looking in through a window.
const WINDOW_SECONDS = 1;
const WINDOW_DISTANCE = 2; // closest the camera stops outside a window (bigger windows: further)
const WINDOW_LOOK_IN = 2.5; // how far inside the window it looks
const WINDOW_MIN_DISTANCE = 1; // zoom limit while at a window
/** Materials (by name, from Blender) that make up the windows. */
const WINDOW_MATERIAL = /^glass$|^window (sill|bar|supports|handle)$|^bay window$/i;
/** Other things that count as clicking the window they sit in (the AC unit). */
const NEAR_WINDOW_MATERIAL = /^ac (unit|grill|fan)$|^window ac holder$/i;
/** Openings with no glass or frame in the model, as [min, max] corners. */
const EXTRA_WINDOWS: [number, number, number][][] = [
  [[-4.5, 3.4, 6.0], [4.5, 7.9, 6.6]], // storefront window (front)
  [[6.0, 1.0, -1.6], [6.6, 6.9, 1.1]], // shop door (side, propped open)
];
/** How close (model units) a click has to land to a window to count. */
const WINDOW_REACH = 1.2;
/** The building's outer walls, in model units. A click that reaches
 *  something inside them without hitting a wall went through an open window. */
const BUILDING = new Box3(new Vector3(-6.7, 0.3, -6.7), new Vector3(6.7, 23.9, 6.7));

export function explore(view: View): Promise<void> {
  const { stage } = view;
  const html = document.documentElement;
  const opener = document.activeElement as HTMLElement | null;

  // Start from exactly where the tour's camera is.
  stage.camera.position.copy(view.scrollState.position);
  const controls = new OrbitControls(stage.camera, stage.canvas);
  controls.target.copy(view.scrollState.target);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  Object.assign(controls, LIMITS);
  controls.update();

  const fov = view.scrollState.fov;
  const live: CameraState = { position: stage.camera.position, target: controls.target, fov };
  const home = controls.target.clone();

  // Camera flights within explore mode (to a window and back out).
  let flight: { from: CameraState; to: CameraState; start: number; done: () => void } | null = null;
  let atWindow = false;
  const flyTo = (position: Vector3, target: Vector3, done = () => {}) => {
    flight = {
      from: { position: live.position.clone(), target: live.target.clone(), fov },
      to: { position, target, fov },
      start: performance.now(),
      done,
    };
  };

  view.override = {
    fullScreen: 1,
    camera: () => {
      controls.update();
      if (flight) {
        const k = Math.min((performance.now() - flight.start) / 1000 / WINDOW_SECONDS, 1);
        const t = easeInOutCubic(k);
        live.position.lerpVectors(flight.from.position, flight.to.position, t);
        live.target.lerpVectors(flight.from.target, flight.to.target, t);
        if (k >= 1) {
          const { done } = flight;
          flight = null;
          done();
        }
      }
      return live;
    },
  };

  // A click (not a drag) on a window: fly to look straight in through the
  // middle of it. Anywhere else (or "Exit window view"): back out.
  const windows = findWindows(stage.scene);
  const raycaster = new Raycaster();
  const down = new Vector2();
  const onPointerDown = (e: PointerEvent) => down.set(e.clientX, e.clientY);
  const onClick = (e: MouseEvent) => {
    if (flight || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    const box = windowAt(e.clientX, e.clientY);
    if (box) enterWindow(box);
    else if (atWindow) exitWindow();
  };
  const enterWindow = (box: Box3) => {
    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    // Which wall the window is in: the side of the building it's closest to.
    const normal = Math.abs(center.x) > Math.abs(center.z) ? new Vector3(Math.sign(center.x), 0, 0) : new Vector3(0, 0, Math.sign(center.z));
    const across = Math.max(size.y, normal.x ? size.z : size.x);
    const distance = Math.max(WINDOW_DISTANCE, across * 0.5);
    setAtWindow(true);
    controls.minDistance = WINDOW_MIN_DISTANCE;
    flyTo(center.clone().addScaledVector(normal, distance), center.clone().addScaledVector(normal, -WINDOW_LOOK_IN));
  };
  const exitWindow = () => {
    setAtWindow(false);
    // Same side of the building, back out and a little above.
    const out = live.position.clone().sub(home).setY(0).setLength(26).add(home).add(new Vector3(0, 9, 0));
    flyTo(out, home.clone(), () => (controls.minDistance = LIMITS.minDistance));
  };
  const windowAt = (x: number, y: number) => {
    const box = stage.canvas.getBoundingClientRect();
    raycaster.setFromCamera(new Vector2(((x - box.left) / box.width) * 2 - 1, -((y - box.top) / box.height) * 2 + 1), stage.camera);
    const hit = raycaster.intersectObject(stage.scene, true).find(isSolid);
    if (!hit) return null;
    const isWindowPart = materials(hit.object).some((m) => WINDOW_MATERIAL.test(m.name) || NEAR_WINDOW_MATERIAL.test(m.name));
    const inside = BUILDING.containsPoint(hit.point) && Math.max(Math.abs(hit.point.x), Math.abs(hit.point.z)) < 6.2;
    // Clicking through an open window (or the door) lands on something
    // inside; use the spot where the click entered the building instead.
    const point = inside ? raycaster.ray.intersectBox(BUILDING, new Vector3()) : isWindowPart ? hit.point : null;
    if (!point) return null;
    let best: Box3 | null = null;
    let bestDistance = WINDOW_REACH;
    for (const box of windows) {
      const d = box.distanceToPoint(point);
      if (d < bestDistance) [best, bestDistance] = [box, d];
    }
    return best;
  };
  stage.canvas.addEventListener('pointerdown', onPointerDown);
  stage.canvas.addEventListener('click', onClick);

  html.classList.add('is-exploring');
  pauseScroll();
  const exitLabel = h('span', { class: 'roll' }, roll('Back to the tour'));
  const exitButton = h('button', { class: 'button roll-host explore-exit', type: 'button' }, exitLabel);
  const hint = h('p', { class: 'explore-hint label' }, 'Drag to turn, scroll to zoom, click a window to look inside');
  // The button backs out of a window first, then leaves explore mode.
  function setAtWindow(value: boolean) {
    atWindow = value;
    exitLabel.replaceChildren(roll(value ? 'Exit window view' : 'Back to the tour'));
  }
  document.body.append(exitButton, hint);
  requestAnimationFrame(() => exitButton.focus({ preventScroll: true }));

  return new Promise((resolve) => {
    const leave = () => {
      removeEventListener('keydown', onKey);
      stage.canvas.removeEventListener('pointerdown', onPointerDown);
      stage.canvas.removeEventListener('click', onClick);
      flight = null;
      exitButton.removeEventListener('click', onExit);
      controls.enabled = false;
      html.classList.remove('is-exploring');
      resumeScroll();
      exitButton.remove();
      hint.remove();

      // Fly back to the tour's camera along an arc around the building
      // (a straight line could pass through it).
      const from = new Spherical().setFromVector3(stage.camera.position.clone().sub(controls.target));
      const fromTarget = controls.target.clone();
      const to = new Spherical();
      const out: CameraState = { position: new Vector3(), target: new Vector3(), fov };
      const offset = new Vector3();
      const started = performance.now();

      view.override = {
        fullScreen: 0,
        camera: () => {
          const k = Math.min((performance.now() - started) / 1000 / RETURN_SECONDS, 1);
          const t = easeInOutCubic(k);
          const goal = view.scrollState;
          to.setFromVector3(offset.copy(goal.position).sub(goal.target));
          let dTheta = to.theta - from.theta;
          dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta)); // shortest way round
          out.target.lerpVectors(fromTarget, goal.target, t);
          out.position.setFromSphericalCoords(
            lerp(from.radius, to.radius, t),
            lerp(from.phi, to.phi, t),
            from.theta + dTheta * t,
          ).add(out.target);
          out.fov = lerp(fov, goal.fov, t);
          if (k >= 1) {
            view.override = null;
            controls.dispose();
            opener?.focus({ preventScroll: true });
            resolve();
          }
          return out;
        },
      };
    };

    const onExit = () => {
      if (flight) return;
      if (atWindow) exitWindow();
      else leave();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    addEventListener('keydown', onKey);
    exitButton.addEventListener('click', onExit);
  });
}

const materials = (object: Object3D) => [(object as { material?: Material | Material[] }).material ?? []].flat();

/** Skip things the visitor can't see: hidden objects, invisible helpers and outline shells. */
function isSolid(hit: Intersection) {
  for (let o: Object3D | null = hit.object; o; o = o.parent) if (!o.visible) return false;
  return materials(hit.object).some((m) => m.visible && m.opacity > 0.05 && m.side !== BackSide);
}

/**
 * Every window in the model as a box: the window parts (glass, frames, bars,
 * sills) grouped by which ones touch. Worked out once and reused.
 */
let windowCache: Box3[] | null = null;
function findWindows(scene: Object3D): Box3[] {
  if (windowCache) return windowCache;
  let boxes: Box3[] = [];
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    // (The door's glass swings inward, so the doorway is in EXTRA_WINDOWS instead.)
    if ((o as Mesh).isMesh && o.visible && !/door/i.test(o.name) && materials(o).some((m) => WINDOW_MATERIAL.test(m.name))) {
      boxes.push(new Box3().setFromObject(o));
    }
  });
  // Merge boxes that touch until nothing changes.
  for (let merged = true; merged; ) {
    merged = false;
    const next: Box3[] = [];
    for (const box of boxes) {
      const touching = next.find((other) => other.clone().expandByScalar(0.15).intersectsBox(box));
      if (touching) {
        touching.union(box);
        merged = true;
      } else next.push(box.clone());
    }
    boxes = next;
  }
  boxes.push(...EXTRA_WINDOWS.map(([min, max]) => new Box3(new Vector3(...min), new Vector3(...max))));
  return (windowCache = boxes);
}
