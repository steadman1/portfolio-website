import { Vector3 } from 'three';
import { bakedModel, modelUrl, stops, tourSettings } from '../content';
import { damp, lerpRect, type Rect } from '../lib/math';
import { finePointer, motion } from '../lib/loop';
import { CameraPath } from './camera-path';
import { type CameraState, Stage } from './stage';
import type { FrameInfo, Tour, TourView } from './tour';

/**
 * Loads the 3D model and plugs it into the tour. Loaded lazily (after the
 * intro is on screen) because three.js and the model are big.
 */
export async function startView(tour: Tour, canvas: HTMLCanvasElement) {
  const stage = new Stage(canvas); // throws without WebGL
  const onProgress = (fraction: number | null) => tour.setProgress(fraction);
  // Add ?live-lighting to the address to compare with real-time lighting.
  const baked = bakedModel.enabled && !new URLSearchParams(location.search).has('live-lighting');
  if (baked) await stage.load(bakedModel.url, onProgress, bakedModel);
  else await stage.load(modelUrl, onProgress);
  tour.setProgress(1);

  for (const name of new Set(stops.flatMap((s) => s.highlight ?? []))) stage.addOutline(name);

  const view = new View(stage);
  // Draw once off-screen so shaders compile before anyone sees the model.
  view.warmUp();
  tour.setView(view);
  return view;
}

/** Something that temporarily takes over the camera (explore mode, debug camera). */
export type CameraOverride = {
  camera(): CameraState;
  /** 0 = use the tour's frame, 1 = fill the whole window. */
  fullScreen: number;
};

export class View implements TourView {
  readonly path = new CameraPath(stops, tourSettings.drift);
  /** The camera the scroll position asks for (before overrides). */
  readonly scrollState: CameraState = { position: new Vector3(), target: new Vector3(), fov: 75 };
  override: CameraOverride | null = null;
  /** Called after each frame; used by the debug panel. */
  afterFrame: ((info: FrameInfo, state: CameraState) => void) | null = null;

  private state: CameraState = { position: new Vector3(), target: new Vector3(), fov: 75 };
  private pointer = { x: 0, y: 0 };
  private sway = { x: 0, y: 0 };
  private outlineLevels = new Map<string, number>();
  private fullScreen = 0;
  private exploring = false;

  constructor(readonly stage: Stage) {
    if (finePointer) {
      addEventListener(
        'pointermove',
        (e) => {
          this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
          this.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
        },
        { passive: true },
      );
    }
  }

  warmUp() {
    this.path.stateAt(0, 0, this.state);
    this.stage.warmUp(this.state, { x: 0, y: 0, ...this.stage.size });
    this.stage.clear();
  }

  frame(info: FrameInfo) {
    const { dt } = info;
    this.path.sample(info.position, this.scrollState);
    this.state.position.copy(this.scrollState.position);
    this.state.target.copy(this.scrollState.target);
    this.state.fov = this.scrollState.fov;

    // A slight sway with the mouse.
    const swayOn = finePointer && !motion.reduced && !this.override;
    this.sway.x = damp(this.sway.x, swayOn ? this.pointer.x : 0, 3, dt);
    this.sway.y = damp(this.sway.y, swayOn ? this.pointer.y : 0, 3, dt);
    if (Math.abs(this.sway.x) + Math.abs(this.sway.y) > 1e-4) {
      const forward = tmp.forward.subVectors(this.state.target, this.state.position);
      const amount = forward.length() * tourSettings.parallax;
      const right = tmp.right.crossVectors(forward, UP).normalize();
      const up = tmp.up.crossVectors(right, forward).normalize();
      this.state.position.addScaledVector(right, this.sway.x * amount).addScaledVector(up, -this.sway.y * amount);
    }

    // Outline the objects the current stop talks about.
    const wanted = new Set(info.active >= 0 ? stops[info.active].highlight ?? [] : []);
    for (const name of this.stage.outlineNames) {
      const level = damp(this.outlineLevels.get(name) ?? 0, wanted.has(name) ? 1 : 0, 4, dt);
      this.outlineLevels.set(name, level < 0.001 ? 0 : level);
      this.stage.setOutline(name, level * 0.9);
    }

    // Explore mode / debug camera.
    if (this.override) {
      const o = this.override.camera();
      this.state.position.copy(o.position);
      this.state.target.copy(o.target);
      this.state.fov = o.fov;
    }
    this.fullScreen = damp(this.fullScreen, this.override?.fullScreen ?? 0, 5, dt);
    if (this.fullScreen < 0.001) this.fullScreen = 0;
    const rect: Rect = this.fullScreen
      ? lerpRect(info.rect, { x: 0, y: 0, ...this.stage.size }, this.fullScreen)
      : info.rect;

    if (this.stage.draw(this.state, rect)) this.stage.noteFrameTime(dt);
    this.afterFrame?.(info, this.state);
  }

  clear() {
    this.stage.clear();
  }

  async explore() {
    if (this.exploring) return;
    this.exploring = true;
    const { explore } = await import('./explore');
    await explore(this);
    this.exploring = false;
  }
}

const UP = new Vector3(0, 1, 0);
const tmp = { forward: new Vector3(), right: new Vector3(), up: new Vector3() };
