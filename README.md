# Spencer Steadman: portfolio

A one-page portfolio: an introduction, rows of software, creative work and
experience that slide sideways as you scroll, then a scroll-driven tour through a 3D apartment modeled in Blender.
Built with [Vite](https://vitejs.dev/), TypeScript, [three.js](https://threejs.org/) and
[Locomotive Scroll](https://github.com/locomotivemtl/locomotive-scroll) (smooth scrolling), with no UI framework.
The typeface is Inter; text priority comes from weight and color, not a second font.

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # type-check, then build to dist/
npm run preview    # serve the built site locally
npm run typecheck  # type-check only
```

## Editing the site

### Text, links, projects and experience

Almost everything is in **`src/content.ts`**:

| What | Where in content.ts |
|---|---|
| Name, tagline, school, bio, skills, portrait | `intro` |
| GitHub / Instagram / email links | `links` |
| Work rows (Software, Creative, Experience) | `workRows` |
| Tour stops: camera angles, text, photos | `stops` |
| Contact heading and email | `contact` |

Any string that starts with `TODO` shows up on the page as a grey, dotted
placeholder, so unfinished bits are easy to spot. Search the file for `TODO`.

### Photos and videos

The site loads small web copies from `public/media/`; full-size originals stay
in `src/assets/` and are never shipped.

1. Put the original image somewhere under `src/assets/projects/<folder>/`.
2. Run `sh scripts/optimize-media.sh` (macOS; uses the built-in `sips` and `ffmpeg`).
3. Use it in `content.ts` as `"/media/projects/<folder>/<name>.jpg"`.

### The 3D tour

Each entry in `stops` is one stop on the tour, in order. The comments on the
`Stop` type in `content.ts` explain every field. The most useful ones:

- `camera`: where the camera sits (`position`), what it looks at (`target`),
  and its zoom (`fov`, smaller = more zoomed in).
- `frame`: `"full"` for the whole screen, or `"left"`/`"right"` to put the 3D
  view on that side with the text on the other.
- `travel` / `dwell`: how much scrolling the flight there takes, and how long
  the view holds once it arrives, measured in screen heights.
- `via`: points the camera flies through on the way, to steer it around walls.
- `highlight`: model objects to outline while the stop is showing.

**Finding a camera angle:** open `http://localhost:5173/?debug`. A panel in the
corner shows the current stop and camera. Press **C** to take over the camera
(drag to orbit, right-drag to pan, scroll to zoom), frame the shot you want,
click **Copy camera**, and paste the copied `camera: {...}` line over the
stop's `camera` in `content.ts`. Press **C** again to give the camera back to
the scroll. `?debug&stop=3` opens the page straight at stop 3 (counting from 0).

Overall feel: `scrollSettings` controls how smooth wheel/trackpad scrolling
is (lower `lerp` = floatier), and `tourSettings` controls the push-in while
holding, mouse sway, and how the camera catches up on touch screens. To make
the whole tour shorter or longer, scale the `travel`/`dwell` numbers.

### The 3D model

`src/assets/models/apartment.gltf` is the Blender export (glTF Embedded) and
the source of truth. The site loads a compressed copy,
`public/models/apartment.glb`. After re-exporting from Blender, run:

```bash
python3 scripts/optimize-model.py
```

It packs the model into a `.glb` and shrinks oversized textures (no
dependencies beyond python3 and macOS's `sips`). Object names must stay the
same for outlines and hidden markers to work; the console warns if one is missing.
Explore mode finds the windows by material name (`glass`, `window sill`,
`window bar`, `window supports`, `window handle`, `bay window`; see
`WINDOW_MATERIAL` in `src/tour/explore.ts`), so keep those names too.

### Look and layout

`src/styles/main.css` starts with the design tokens (colors, fonts, spacing,
animation timing, and the size of the 3D frame). Sections are labelled
(Header, Hero, Work, Tour, …). The tour's layout is plain CSS grid, and the 3D
view automatically follows the `.stop-frame` boxes, so moving or resizing
frames needs no JavaScript changes.

The cursor artwork is `public/pointer.svg` (normal) and `public/hand.svg`
(over anything clickable); their drawn size and click point are at the top of
`src/ui/cursor.ts`. Links and buttons whose label "rolls" on hover have the
class `roll` with their text wrapped in `roll('...')` (or
`<span class="roll-text">` in index.html).

## How it fits together

```
index.html               page skeleton; sections are filled in from content.ts
src/content.ts           all text, links, photos and tour stops
src/main.ts              entry point; renders sections, then lazy-loads the 3D
src/sections/            hero.ts, work.ts (rows that slide with scrolling), contact.ts
src/ui/cursor.ts         custom cursor (pointer/hand SVGs) and magnetic hover
src/ui/reveal.ts         slide-in animations when sections scroll into view
src/lib/                 small helpers: frame loop, smooth scrolling, math, DOM builder
src/tour/tour.ts         tour layout, text panels, side navigation (no three.js)
src/tour/timeline.ts     scroll distance -> which stops we're between
src/tour/media.ts        photo/video stepper beside each stop
src/tour/view.ts         the 3D view: camera per frame, sway, outlines (lazy-loaded)
src/tour/stage.ts        three.js renderer, model loading, lights
src/tour/camera-path.ts  camera flight paths between stops
src/tour/explore.ts      "Explore the building" free-orbit mode, click a window to look in
src/tour/debug.ts        ?debug camera tool
src/styles/main.css      portfolio styles
src/styles/legal.css     styles for the app legal/support pages
scripts/                 optimize-model.py, optimize-media.sh
public/                  files served as-is: favicon, model, web media
```

The page (intro, work rows, text) renders immediately; three.js and the model
download in the background. If WebGL isn't available or the model fails to
load, the tour falls back to plain sections with a photo for each stop.

three.js is kept at **0.143** on purpose: the lighting was tuned against that
version, and newer releases changed how light intensity works.

## Other pages

These must keep their URLs (they're linked from the App Store):
`pinit.html`, `privacy.html`, `support.html`, `watchai-{privacy,support,eula}.html`,
`liminal-browser-{privacy,support,eula}.html`. They use `src/styles/legal.css`
and are listed in `vite.config.js` so the build includes them.

Unused source files kept for reference: `src/assets/models/test.gltf`,
`src/assets/models/elevator_exp.gltf`, `src/assets/textures/*.hdr`,
`src/assets/videos/{garden,milk}.mp4`, and the Akira, Monument, Moderna and Menlo fonts (the site now uses Inter, bundled from `@fontsource-variable/inter`).
