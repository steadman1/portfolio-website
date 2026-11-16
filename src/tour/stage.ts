import {
  ACESFilmicToneMapping,
  BackSide,
  Fog,
  HemisphereLight,
  type Light,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  type MeshPhysicalMaterial,
  type Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  sRGBEncoding,
  Texture,
  Vector3,
  WebGLRenderer,
} from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { bakedModel } from '../content';
import { clamp, type Rect } from '../lib/math';
import { mark, timed } from '../lib/perf';
import type { ApartmentFiles } from './loading';

/**
 * The three.js side of the site: renderer, model, lights.
 *
 * The canvas fills the tour's screen-sized sticky box (tour.ts), but the
 * scene is only drawn into one rectangle of it (the "frame") at a time, so
 * the 3D view can sit on one side of the screen with text beside it. Because
 * the canvas lives inside that box, the browser scrolls it with the page,
 * so nothing has to be redrawn just because the page moved.
 *
 * Lighting is either baked into one image (bakedModel in content.ts) or
 * real-time, with values that match the original site; three.js is kept at
 * version 0.143 because newer versions changed how lights are measured.
 */

/** Marker objects in the model that only existed as click targets. */
const HIDDEN_OBJECTS = ['shop_counter_camera_outline', 'bay_window_camera_outline'];

/** The baked lightmap stores light divided by this, so bright spots near
 *  lamps fit in an ordinary image. Must match LIGHT_SCALE in
 *  scripts/bake-lighting.py. */
const LIGHTMAP_SCALE = 2;

/** Most milliseconds of GPU warm-up per frame (see Stage.warmUp). */
const WARM_UP_SLICE_MS = 6;

/** How much bigger than the object its highlight outline is. */
const OUTLINE_SCALE = 1.07;

/** Loads .glb files, including Draco-compressed geometry (decoder in public/draco,
 *  copied from three/examples/js/libs/draco/gltf; only fetched if needed). */
function gltfLoader() {
  const draco = new DRACOLoader().setDecoderPath('/draco/');
  return new GLTFLoader().setDRACOLoader(draco);
}

/** Makes a texture from a downloaded image, decoded off the main thread
 *  where the browser can (an ImageBitmap), else as an <img> decoded in the
 *  background. Not flipped, which suits glTF's texture convention. */
async function textureFromBlob(blob: Blob) {
  const texture = new Texture();
  try {
    texture.image = await createImageBitmap(blob, { imageOrientation: 'none', colorSpaceConversion: 'none' });
  } catch {
    const image = new Image();
    image.src = URL.createObjectURL(blob);
    await image.decode();
    texture.image = image;
  }
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

export type CameraState = { position: Vector3; target: Vector3; fov: number };

export class Stage {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(75, 1, 0.1, 1000);
  readonly canvas: HTMLCanvasElement;

  private ambient = new HemisphereLight(0xffffff, 0xffffff, 0.3);
  private outlines = new Map<string, { shell: Object3D; material: MeshBasicMaterial }>();
  private width = 0;
  private height = 0;
  // Start at up to 1.5x on high-res screens (the lighting is heavy); noteFrameTime()
  // lowers it further if drawing is slow.
  private pixelRatio = Math.min(window.devicePixelRatio, 1.5);
  private lastDrawn = '';
  private slowFrames = 0;
  private coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  /** Lit by the baked lightmap (no real-time lights), see useBakedLight. */
  private baked = false;
  private lightmap: Texture | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    // Throws if WebGL isn't available; the caller falls back to photos.
    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    const r = this.renderer;
    r.outputEncoding = sRGBEncoding;
    r.toneMapping = ACESFilmicToneMapping;
    r.toneMappingExposure = 1.1;
    r.setClearColor(0x000000, 0);
    r.shadowMap.enabled = !this.coarsePointer; // phones skip shadows
    r.shadowMap.type = PCFSoftShadowMap;
    r.shadowMap.autoUpdate = false; // the scene never moves, so shadows are drawn once

    this.scene.fog = new Fog(0xffffff, 50, 70); // fades the tall foundation into the white page
    this.scene.add(this.ambient);

    this.resize();
    addEventListener('resize', () => this.resize());
  }

  /**
   * Builds the model from its downloaded files. With a lightmap, the
   * model's light and shadows come from that baked image instead of
   * real-time lights (much lighter to draw). Each heavy step waits for
   * `quiet()`, a moment when the page isn't busy (see loading.ts).
   */
  async load(files: ApartmentFiles, quiet: () => Promise<void>) {
    const buffer = await files.model;
    mark('model downloaded');
    await quiet();
    const gltf = await timed('build model', () => gltfLoader().parseAsync(buffer, '/models/'));
    let lightmap: Texture | null = null;
    if (files.lightmap) {
      const blob = await files.lightmap;
      mark('lightmap downloaded');
      await quiet();
      lightmap = await timed('decode lightmap', () => textureFromBlob(blob));
    }
    await quiet();
    await timed('set up scene', () => this.setUp(gltf.scene, lightmap));
  }

  private setUp(model: Object3D, lightmap: Texture | null) {
    if (lightmap) {
      this.useBakedLight(model, lightmap, bakedModel.brightness);
    } else {
      model.traverse((object) => {
        if ((object as Mesh).isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
        const light = object as Light & { isPointLight?: boolean; isSpotLight?: boolean };
        if (light.isPointLight || light.isSpotLight) {
          light.intensity /= 1400; // Blender exports watts; this matches the original look
          light.castShadow = true;
          if (light.shadow) {
            light.shadow.bias = -0.001;
            light.shadow.mapSize.set(512, 512);
          }
        }
      });
    }

    for (const name of HIDDEN_OBJECTS) {
      const object = model.getObjectByName(name);
      if (object) object.visible = false;
    }

    this.scene.add(model);
    this.renderer.shadowMap.needsUpdate = true;
  }

  /**
   * Swaps the model's real-time lighting for the baked lightmap: removes the
   * lamps and shadows, and gives every surface a simple material that just
   * multiplies its colour by the baked light. Glass keeps its own material.
   */
  private useBakedLight(model: Object3D, lightmap: Texture, brightness: number) {
    lightmap.flipY = false; // glTF texture convention
    lightmap.encoding = sRGBEncoding;
    lightmap.anisotropy = this.renderer.capabilities.getMaxAnisotropy(); // crisp on floors seen at an angle
    this.renderer.shadowMap.enabled = false;
    this.ambient.visible = false;
    this.baked = true;
    this.lightmap = lightmap;
    this.pixelRatio = Math.min(window.devicePixelRatio, 2); // cheap enough for sharper drawing

    const lamps: Object3D[] = [];
    const swapped = new Map<Material, Material>();
    const swap = (m: Material) => {
      const source = m as MeshPhysicalMaterial;
      if (source.transmission > 0) return m; // glass
      let lit = swapped.get(m);
      if (!lit) {
        lit = new MeshLambertMaterial({
          name: source.name,
          color: source.color,
          map: source.map,
          alphaMap: source.alphaMap,
          emissive: source.emissive,
          emissiveMap: source.emissiveMap,
          emissiveIntensity: source.emissiveIntensity,
          transparent: source.transparent,
          opacity: source.opacity,
          alphaTest: source.alphaTest,
          side: source.side,
          depthWrite: source.depthWrite,
          vertexColors: source.vertexColors,
          lightMap: lightmap,
          // Lambert divides the light by π; the image holds light / LIGHTMAP_SCALE.
          lightMapIntensity: LIGHTMAP_SCALE * Math.PI * brightness,
        });
        swapped.set(m, lit);
      }
      return lit;
    };

    model.traverse((object) => {
      if ((object as Light).isLight) lamps.push(object);
      const mesh = object as Mesh;
      if (!mesh.isMesh || !mesh.geometry.attributes.uv2) return;
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
    });
    for (const lamp of lamps) lamp.removeFromParent();
  }

  /** Adds a (hidden) white outline around a model object; fade it with setOutline. */
  addOutline(name: string) {
    if (this.outlines.has(name)) return;
    const source = this.scene.getObjectByName(name);
    if (!source?.parent) {
      console.warn(`[stage] No object named "${name}" to outline. Check the names in content.ts.`);
      return;
    }
    const material = new MeshBasicMaterial({
      color: 0xffffff,
      side: BackSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    const shell = source.clone(true);
    shell.traverse((object) => {
      if ((object as Mesh).isMesh) (object as Mesh).material = material;
      object.castShadow = false;
      object.receiveShadow = false;
    });
    shell.scale.multiplyScalar(OUTLINE_SCALE);
    shell.visible = false;
    source.parent.add(shell);
    this.outlines.set(name, { shell, material });
  }

  setOutline(name: string, opacity: number) {
    const outline = this.outlines.get(name);
    if (!outline) return;
    outline.material.opacity = opacity;
    outline.shell.visible = opacity > 0.005;
  }

  get outlineNames() {
    return [...this.outlines.keys()];
  }

  /**
   * Gets everything onto the GPU before the first real frame, so the model
   * appears without a stutter: decodes images in the background, then draws
   * the model's pieces one at a time into a hidden 1px corner (compiling
   * their shaders and uploading their textures and geometry), a few
   * milliseconds' worth per frame so the page stays smooth meanwhile. The
   * bigger steps wait for a quiet moment (`quiet()`, see loading.ts).
   */
  async warmUp(view: CameraState, rect: Rect, quiet: () => Promise<void>) {
    this.applyCamera(view, rect);
    if (!this.baked) {
      await quiet();
      // Real-time lights and shadows: shaders depend on the whole scene's
      // lights, so compile it in one go.
      this.renderer.compile(this.scene, this.camera);
      this.draw(view, rect, true);
      return;
    }

    // Every mesh that can be drawn: the visible model plus the (hidden) outlines.
    const meshes: Mesh[] = [];
    const addMeshes = (object: Object3D) => (object as Mesh).isMesh && meshes.push(object as Mesh);
    this.scene.traverseVisible(addMeshes);
    for (const { shell } of this.outlines.values()) shell.traverse(addMeshes);

    const textures = new Set<Texture>();
    for (const mesh of meshes) {
      for (const material of [mesh.material].flat()) {
        for (const value of Object.values(material)) if ((value as Texture)?.isTexture) textures.add(value as Texture);
      }
    }
    await quiet();
    // Safari's model textures are <img>s, which otherwise decode on the main
    // thread when uploaded. (Elsewhere they're already decoded ImageBitmaps.)
    await Promise.all(
      [...textures].map((t) => (t.image instanceof HTMLImageElement ? t.image.decode().catch(() => {}) : null)),
    );

    // Stand-ins share the real geometry and materials, so whatever they get
    // onto the GPU (shaders, textures, buffers) the real meshes reuse. No
    // lights, matching the baked scene, and the same fog.
    const r = this.renderer;
    const scratch = new Scene();
    scratch.fog = this.scene.fog;
    const standIn = new Mesh();
    standIn.frustumCulled = false;
    scratch.add(standIn);
    const endSlice = () => {
      r.setScissorTest(false);
      r.clear();
    };
    // The lightmap is the one big upload; give it a quiet moment of its own.
    if (this.lightmap) {
      await quiet();
      await timed('upload lightmap to GPU', () => r.initTexture(this.lightmap!));
    }
    // The rest goes in small slices, one per frame.
    await quiet();
    let sliceStart = performance.now();
    let slices = 1;
    let longest = 0;
    for (const mesh of meshes) {
      standIn.geometry = mesh.geometry;
      standIn.material = mesh.material;
      r.setViewport(0, 0, 1, 1);
      r.setScissor(0, 0, 1, 1);
      r.setScissorTest(true);
      r.render(scratch, this.camera);
      const elapsed = performance.now() - sliceStart;
      if (elapsed > WARM_UP_SLICE_MS) {
        endSlice();
        longest = Math.max(longest, elapsed);
        await new Promise(requestAnimationFrame);
        sliceStart = performance.now();
        slices++;
      }
    }
    endSlice();
    longest = Math.max(longest, performance.now() - sliceStart);
    mark(`GPU warm-up: ${slices} slices, longest ${Math.round(longest)} ms`);
    this.lastDrawn = '';
    this.draw(view, rect, true);
  }

  /**
   * Draws the scene from `view` into `rect` (CSS pixels from the top-left of
   * the window). Skips the work if nothing changed since the last frame.
   */
  draw(view: CameraState, rect: Rect, force = false) {
    const key = [
      view.position.x, view.position.y, view.position.z,
      view.target.x, view.target.y, view.target.z, view.fov,
      rect.x, rect.y, rect.width, rect.height,
      this.width, this.height, this.pixelRatio,
      ...[...this.outlines.values()].map((o) => o.material.opacity),
    ].map((n) => n.toFixed(4)).join(',');
    if (key === this.lastDrawn && !force) return false;
    this.lastDrawn = key;

    const r = this.renderer;
    r.setScissorTest(false);
    r.clear();

    // WebGL measures from the bottom-left corner. The visible area is rounded
    // inward to whole pixels so no sliver shows outside the frame.
    const bottom = this.height - rect.y - rect.height;
    const x0 = clamp(Math.ceil(rect.x), 0, this.width);
    const y0 = clamp(Math.ceil(bottom), 0, this.height);
    const x1 = clamp(Math.floor(rect.x + rect.width), 0, this.width);
    const y1 = clamp(Math.floor(bottom + rect.height), 0, this.height);
    if (x1 - x0 < 1 || y1 - y0 < 1 || rect.width < 1 || rect.height < 1) return true;

    this.applyCamera(view, rect);
    r.setViewport(rect.x, bottom, rect.width, rect.height);
    r.setScissor(x0, y0, x1 - x0, y1 - y0);
    r.setScissorTest(true);
    r.render(this.scene, this.camera);
    return true;
  }

  /** Clears the canvas (used when the tour is off screen). */
  clear() {
    if (this.lastDrawn === 'clear') return;
    this.lastDrawn = 'clear';
    this.renderer.setScissorTest(false);
    this.renderer.clear();
  }

  /**
   * Called every frame the scene was drawn. If drawing is consistently slow,
   * lower the resolution a step (never below 1x).
   */
  noteFrameTime(dt: number) {
    this.slowFrames = dt > 1 / 40 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 1);
    if (this.slowFrames > 45 && this.pixelRatio > 1) {
      this.pixelRatio = Math.max(1, this.pixelRatio - 0.25);
      this.slowFrames = 0;
      this.resize(true);
    }
  }

  private applyCamera(view: CameraState, rect: Rect) {
    const cam = this.camera;
    cam.position.copy(view.position);
    cam.fov = view.fov;
    cam.aspect = rect.width / Math.max(rect.height, 1);
    cam.updateProjectionMatrix();
    cam.lookAt(view.target);
  }

  /** The canvas size in CSS pixels. */
  get size() {
    return { width: this.width, height: this.height };
  }

  private resize(force = false) {
    const box = this.canvas.parentElement ?? document.documentElement;
    const width = box.clientWidth || window.innerWidth;
    const height = box.clientHeight || window.innerHeight;
    // On phones the address bar changes the height while scrolling; ignore
    // that so the canvas doesn't jump.
    if (!force && this.coarsePointer && width === this.width && height < this.height + 120 && height > this.height - 120) return;
    this.width = width;
    this.height = height;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(width, height);
    this.lastDrawn = '';
  }
}
