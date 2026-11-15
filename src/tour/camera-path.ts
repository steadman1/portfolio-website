import { CatmullRomCurve3, Quaternion, Vector3 } from 'three';
import type { Stop } from '../content';
import { easeBetween, lerp } from '../lib/math';
import type { CameraState } from './stage';
import type { Position } from './timeline';

/**
 * The camera for any point in the tour. Flights between stops follow a
 * smooth curve through the stop's `via` points (so the camera can be routed
 * around walls). The view turns at an even rate from one stop's look
 * direction to the next, and the field of view blends along with it.
 */
export class CameraPath {
  private curves = new Map<number, CatmullRomCurve3>();
  private a: CameraState = { position: new Vector3(), target: new Vector3(), fov: 75 };
  private b: CameraState = { position: new Vector3(), target: new Vector3(), fov: 75 };

  constructor(private stops: Stop[], private drift: number) {}

  sample(at: Position, out: CameraState): CameraState {
    if (at.from === at.to) return this.stateAt(at.from, at.hold, out);

    const curve = this.curve(at.to); // build first: it uses the temp states below
    const a = this.stateAt(at.from, this.departHold(at.from), this.a);
    const b = this.stateAt(at.to, 0, this.b);
    curve.getPointAt(at.t, out.position);

    // Turn evenly from where stop A looks to where stop B looks.
    const fromDir = tmp.a.subVectors(a.target, a.position);
    const toDir = tmp.b.subVectors(b.target, b.position);
    const length = lerp(fromDir.length(), toDir.length(), at.t);
    fromDir.normalize();
    toDir.normalize();
    tmp.turn.setFromUnitVectors(fromDir, toDir);
    tmp.partial.identity().slerp(tmp.turn, at.t);
    out.target.copy(fromDir).applyQuaternion(tmp.partial).multiplyScalar(length).add(out.position);

    out.fov = lerp(a.fov, b.fov, at.t);
    return out;
  }

  /** A stop's camera, pushed in slightly by `hold` (0..1) of its dwell. */
  stateAt(i: number, hold: number, out: CameraState): CameraState {
    const { position, target, fov } = this.stops[i].camera;
    out.target.set(...target);
    // Eased, so the push-in starts and ends as gently as the flights do.
    out.position.set(...position).lerp(out.target, this.drift * easeBetween(hold, 0, 0));
    out.fov = fov;
    return out;
  }

  /** How far the push-in got before leaving stop `i` (none if it doesn't hold). */
  private departHold(i: number) {
    return this.stops[i].dwell > 0 ? 1 : 0;
  }

  /** The flight path into stop `i`, through its `via` points. */
  private curve(i: number) {
    let curve = this.curves.get(i);
    if (!curve) {
      const start = this.stateAt(i - 1, this.departHold(i - 1), this.a).position.clone();
      const end = this.stateAt(i, 0, this.b).position.clone();
      const via = (this.stops[i].via ?? []).map((p) => new Vector3(...p));
      curve = new CatmullRomCurve3([start, ...via, end], false, 'centripetal');
      this.curves.set(i, curve);
    }
    return curve;
  }
}

const tmp = { a: new Vector3(), b: new Vector3(), turn: new Quaternion(), partial: new Quaternion() };
