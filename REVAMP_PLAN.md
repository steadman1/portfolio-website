# Portfolio revamp: build brief

This is the handoff brief for rebuilding Spencer Steadman's portfolio site. It was written after reading the whole repo and inspecting the glTF model, and after Spencer answered the open design questions. Everything under "Decisions" is settled. Everything marked "starting value" is yours to tune by eye.

## 1. What we are building and why

The site today is a full-screen Three.js scene of a three-level building (Steadman Records on the ground floor, an apartment above it, a roof terrace on top). Visitors click through a seven-slide intro, press "enter", then orbit the model, click floating camera spheres to jump inside, and hunt for outlined objects that open floating info cards.

Spencer no longer likes that design. The new site is one continuous page, white background and black text, that reads top to bottom:

1. A short introduction to Spencer.
2. A marquee of projects and professional experience.
3. A scroll-driven tour of the apartment: scrolling moves the camera between saved views, each view holds for a while, and its text and images appear beside the 3D view.
4. A closing section with contact links and an optional free-orbit mode.

The purpose of the site is to show software ability and creative work in one place. The UI should be nearly invisible so attention goes to the model, the projects and the experience. Quality lives in the motion: the camera moves, the reveals and the cursor interactions should feel deliberate and smooth. No gates, no "enter" button, no modal screens, no abrupt mode switches.

## 2. Decisions (settled with Spencer)

- **Single flow.** Remove the boot/intro slideshow, the enter button, the tutorial card, the floating info cards, the header popups and the graphics options popup.
- **Scroll controls the camera.** No orbiting or clicking objects during the tour.
- **Tour sequence.** Exterior, shop, three beats in the apartment (PC, Teddie, shoes), a new terrace stop, exterior again. Only two camera positions exist in the model; the terrace one has to be authored (section 6).
- **Marquee** is the auto-scrolling kind: two thin rows drifting in opposite directions.
- **Content** lives in one typed content file. Known content is filled in from the repo; anything unknown is a clearly marked placeholder. Do not invent facts about Spencer (employers, dates, roles, links).
- **Explore mode.** After the last stop, a button unlocks free orbit of the building, with a way back to the scroll flow.
- **Custom cursor**: a dot with a surrounding ring. Over interactive elements the ring is absorbed into the element's shape, and the element moves slightly toward the pointer.
- **White background, black text**, minimal UI.

## 3. The repo as it stands

Stack: Vite 3.0.4, vanilla JS/TS, three 0.143.0, `@tweenjs/tween.js`. No framework. Node on this machine is v26; Vite 3 is old enough that it may not run cleanly on it, so check the dev server first and move to a current Vite if it does not.

| Path | What it is |
|---|---|
| `index.html` | All markup for the old UI plus about 300 lines of inline script (jQuery from a CDN, a stray `require.js` script tag). Has no doctype, so it renders in quirks mode. |
| `src/main.js` | Renderer, camera, OrbitControls, render loop, loader progress. |
| `src/scenes.ts` | `ApartmentScene` (model load, lights, outlines, click handling, camera tweens) and `PreloaderScene` (a wireframe cube). |
| `src/info_cards.ts` | Empty class. Delete. |
| `src/styles/main.css` | Old styles. Also linked by every legal page. |
| `src/assets/models/apartment.gltf` | The model, 60 MB. |
| `src/assets/projects/**` | Photos and renders for the four content sets, all square, many 2 to 4 MB. |
| `src/assets/videos/katana.mp4`, `catapult.mp4` | 1080p clips of Blender work (12 s each). |
| `pinit.html`, `privacy.html`, `support.html`, `watchai-*.html`, `liminal-browser-*.html` | Nine legal and support pages for Spencer's iOS apps. See section 12. |
| `vite.config.js` | Multi-page build listing all ten HTML entries. |

Unused files that are not bundled and can be left alone: `models/test.gltf`, `models/elevator_exp.gltf`, `textures/*.hdr`, `videos/garden.mp4`, `videos/milk.mp4`, the Akira, Monument and Menlo fonts.

**Uncommitted work.** `index.html`, `src/main.js`, `src/scenes.ts` and `src/styles/main.css` have uncommitted edits: a half-finished restyle of the old intro and info cards, plus a small fix to the load-progress math. The restyle is superseded by this revamp. Start by creating a branch (`revamp/scroll-tour`) and committing those edits there as a baseline so they stay recoverable. Do not push or deploy; Spencer reviews first.

**Deployment** is not described anywhere in the repo (no CI, no CNAME; `dist/` is git-ignored). Asset paths are root-absolute, so the site is served from a domain root. Keep `base` as it is and keep `npm run build` producing `dist/`.

### 3.1 How the saved camera views work today

In `src/scenes.ts`, `cameraIntersect()` (line 265) tweens the camera to the world position of a marker node in the model and points it straight down the negative Z axis (the tween target is the marker position with `z - 8`). `environmentSetup()` (line 159) sets the opening exterior view, and `returnView()` (line 426) the exterior view it returns to. Those are the "scenes Spencer has set":

| View | Camera position | Looks at | Source |
|---|---|---|---|
| Exterior, opening | (35, 12, 35) | (0, 12, 0) | `scenes.ts:159` |
| Exterior, return | (28, 12, 28) | (0, 12, 0) | `scenes.ts:426` |
| Shop counter | (0, 5.308, 7.657) | (0, 5.308, -0.343) | node `shop counter camera outline` |
| Bay window | (0.002, 17.394, 8.428) | (0.002, 17.394, 0.428) | node `bay window camera outline` |

The camera is a `PerspectiveCamera` with a 75 degree vertical FOV, near 0.1, far 1000. Both marker cameras sit just outside the front facade (the +Z side) and look in through the glass.

### 3.2 Model facts (read from the glTF)

- Exported from Blender, glTF 2.0, Y up. 873 nodes, 473 meshes, about 417k triangles, 532 draw primitives, 197 materials.
- Uses `KHR_lights_punctual` (nine point and spot lights) and `KHR_materials_transmission` (glass, tip jar, record player lid, coffee table, whiskers). Transmission makes three render the opaque scene an extra time, so it is a real cost.
- Building footprint is roughly x and z in [-7.5, 7.5]. Levels: shop floor at y 0.9 with its ceiling near y 9; apartment floor at y 12.5 with its ceiling near y 21.5; terrace floor at y 24.1 under a pergola roof at y 30.7 to 31.9. A street slab spans plus or minus 14 at y 0 to 0.9, and a tall foundation block runs down to y -43, which the fog fades out.
- The file is 60 MB because 46 MB of binary is base64-embedded. 35.5 MB of that is textures: `wallpaper_mac` is a 17.9 MB PNG, `album covers` 5 MB, `cat fur` 3 MB.

three's GLTFLoader rewrites node names: spaces become underscores and dots are removed. A node with several primitives becomes a `Group` carrying the node name, with child meshes named after the mesh. Look nodes up by the names in the right-hand column, and log the loaded scene once to confirm.

| Subject | glTF node | Name after loading | World position |
|---|---|---|---|
| Shop camera marker | `shop counter camera outline` | `shop_counter_camera_outline` | (0, 5.31, 7.66) |
| Bay window camera marker | `bay window camera outline` | `bay_window_camera_outline` | (0, 17.39, 8.43) |
| Record boxes | `record box1 outline`, `record box2 outline` | `record_box1_outline`, `record_box2_outline` | (0.06, 3.60, -0.67), (-0.39, 3.52, 0.63) |
| PC tower | `Cube.070` | `Cube070` | (-4.75, 15.43, -0.16); the monitor is at (-4.79, 16.11, 1.90) |
| Teddie the cat, on the desk chair | `Cube.105` | `Cube105` | (-2.62, 14.16, 1.36) |
| Shoes | `shoe left`, `shoe right` | `shoe_left`, `shoe_right` | (1.21, 12.74, 0.08), (1.83, 12.74, -0.04) |

Read the two camera positions from the marker nodes at load time instead of hardcoding them, so a re-export of the model moves the scenes with it. Hide both marker nodes; they were click targets and have no role now.

Terrace layout, for authoring its camera: an L-shaped couch against the back wall (x -5.6 to 1.8, z -5.3 to 0, y 24 to 26.4), a coffee table in front of it (x -2.1 to 0.6, z -1.7 to 0.4), two chairs and a small table on the +x side (x 3 to 6), pergola posts at the corners (x -5.6 and 1.9, z plus or minus 5.6), open toward +Z.

### 3.3 Rendering setup to preserve

The look of the model depends on these, so carry them over unchanged:

- `renderer.outputEncoding = sRGBEncoding`, `ACESFilmicToneMapping`, exposure 1.1, `antialias: true`, `alpha: true` with no scene background (the page shows through).
- Every glTF light's intensity divided by 1400, shadow bias -0.001, 512 px shadow maps; one `HemisphereLight(0xffffff, 0xffffff, 0.3)`.
- Shadows rendered once (`shadowMap.autoUpdate = false`, `needsUpdate = true` after the model is added), PCF soft, on for desktop and off for phones.
- `Fog` from 50 to 70 units. Change its colour from the old lilac `rgb(233, 229, 237)` to pure white so the foundation dissolves into the page.

**Stay on three 0.143.** The lighting is calibrated against that version's light units and colour pipeline. Newer releases changed both, and upgrading would mean re-tuning every light by eye. That is out of scope.

### 3.4 Quirks not to carry over

- `updateOptions()` in `main.js` runs every frame, and `devicePixelRatio * window.resolution ? 1.2 : 0.8` always yields 1.2 because of operator precedence. The site has effectively always rendered at pixel ratio 1.2. Use `Math.min(devicePixelRatio, 2)` and step down if frames are slow.
- The composer mixes three's `EffectComposer` with the `postprocessing` package's `RenderPass`, and bloom and FXAA are commented out. Drop the composer and call `renderer.render()` directly, then confirm the image is unchanged.
- The cast-shadow condition at `scenes.ts:77` is always true, so everything casts shadows, including nodes named `no cast`. Leave the behaviour as is (it is the current look) but do not copy the dead condition.
- `window.isMobile` is a 2 KB user-agent regex, duplicated in two files. Replace it with `matchMedia('(pointer: coarse)')` and feature checks.
- jQuery is used only to forward clicks through the canvas to the header. The `require.js` script tag does nothing. Remove both.

## 4. Page structure

One HTML document. A single fixed, full-viewport `<canvas>` sits behind the content with `pointer-events: none` and `aria-hidden="true"`. All text is real DOM.

**Header.** Fixed and very quiet: the existing wordmark `</steadman>` at top left (scrolls to top), and three text links at top right (Work, Apartment, Contact) that scroll to their sections. During the tour, a column of small ticks on the right edge shows the stops, highlights the current one and jumps to a stop on click. The tour is long, so visitors need a way to see where they are and to skip.

**Hero.** Name, a one-line role, two or three sentences of bio, the portrait (`profile_picture_900x900.jpg`), and links to GitHub, Instagram and email. A small scroll hint at the bottom. The model is not visible here. This section must be readable and interactive before any 3D code has loaded.

**Marquee.** Directly under the hero. See section 8.

**Tour.** A tall section whose scroll length drives the camera. See sections 5 to 7.

**Closing.** Contact line, the same three links, and the "Explore the building" button. A minimal footer.

## 5. The tour: layout

Black text cannot sit on top of the interior views; they are dark and busy. So the 3D view is not full-bleed during the interior stops. Call the rectangle the model is rendered into **the frame**.

- At the exterior stops the frame is the whole viewport. The building floats on white with no visible edge, because the canvas is transparent and the fog is white.
- As the camera flies to an interior view, the frame shrinks to a rectangle on one side of the viewport, and the text and images for that stop appear in the white space on the other side. The frame slides to the opposite side for the next stop, so text alternates right, left, right, left.
- Below about 900 px wide there is no room beside the frame: it takes the full width of the top half of the viewport and the text sits beneath it, with no alternation.

Starting values on desktop: frame 56vw by 72vh, vertically centred, 5vw from its edge of the viewport; text column 32 to 40 characters wide, vertically centred in the remaining space.

Build the layout in CSS and let the 3D follow it. The tour section contains one sticky 100vh viewport holding a layout per stop, each a grid with an empty slot element where the frame goes and a panel for the content. JavaScript measures each slot's rectangle and uses it as that stop's frame; re-measure and rebuild on resize. Breakpoints then live only in CSS.

Render into the frame with `renderer.setViewport` and `setScissor` on the full-viewport canvas, setting `camera.aspect` to the frame's aspect. Three things to get right: those calls take CSS pixels with the origin at the bottom left, so flip Y from the DOM rectangle; clear the whole canvas with the scissor test off before each render, or stale pixels remain where the frame used to be; and update the projection matrix whenever the frame changes. A side benefit is that interior stops render fewer pixels.

## 6. The tour: stops and camera

A **stop** is a camera state plus a frame plus optional content. Each stop has a **travel** (scroll distance spent moving to it) and a **dwell** (scroll distance during which it holds). Spencer asked specifically that each scene pauses so the visitor has to scroll a good amount before the next one arrives; the dwell is that pause.

| # | Stop | Camera position | Look-at | FOV | Frame | Content |
|---|---|---|---|---|---|---|
| 0 | Exterior | (35, 12, 35) | (0, 12, 0) | 75 | full | One-line caption introducing the building |
| 1 | Shop | shop marker | marker with z - 8 | 75 | right half | Music |
| 2 | PC | bay window marker | about (-4.75, 15.7, 0.9) | about 45 | left half | PC and laptop |
| 3 | Teddie | bay window marker | about (-2.62, 14.3, 1.36) | about 35 | right half | Teddie |
| 4 | Shoes | bay window marker | about (1.52, 12.74, 0.02) | about 35 | left half | Shoes and athletics |
| 5 | Terrace | about (0, 27, 12.5) | about (-1.5, 25.5, -2) | about 60 | right half | 3D and motion work |
| 6 | Exterior | (28, 12, 28) | (0, 12, 0) | 75 | full | Leads into the closing section |

Notes on the table:

- Stops 0, 1 and 6 and the camera position of stops 2 to 4 are Spencer's saved views. Reproduce stops 0 and 1 exactly.
- For stops 2 to 4 the camera stays at the saved bay-window position and only turns and zooms (narrower FOV) toward each object. This keeps to the views Spencer set and cannot clip through furniture. On the way from the shop to stop 2, pass through the exact saved bay-window view (looking straight in, FOV 75) as a waypoint with no dwell, so the visitor sees the whole room before the camera settles on the desk. The look-at points and FOVs are computed from node positions and have not been checked on screen; tune them. In the old site these objects were found by looking around from this same camera, so they should be visible, but confirm nothing blocks them.
- Stop 5 is new. The position is an estimate from the terrace geometry, placed outside the front of the building like the other two. Tune it by eye and tell Spencer the final numbers so he can adjust.
- "Left half / right half" is where the frame goes; the text takes the other side.

**Scroll lengths (starting values).** Travel 100vh between different camera positions, 60vh for the re-aims between stops 2, 3 and 4; dwell 100vh at every stop. That is roughly 12 viewport heights for the tour. Keep these as named constants per stop so Spencer can tune the feel.

**Camera motion.**

- Drive camera position, look-at point, FOV and frame rectangle from one scrubbed timeline tied to the tour section's scroll progress. Scrolling backwards must play it in reverse, and landing anywhere (reload, a jump from the tick navigation, the End key) must produce the correct state immediately.
- Interpolate the look-at point and call `camera.lookAt()` each frame. Do not slerp between orientations.
- Ease each travel in and out. During a dwell the camera should not be frozen: let it drift very slightly with scroll (a 1 to 2 percent push-in) so the image stays alive without changing the framing.
- Add damping between the scroll-derived target state and the applied state so coarse wheel steps do not show as stepping.
- The camera must never pass through geometry. Shop and bay window are both on the front facade at x = 0, so a straight line between them hugs the wall and the protruding bay window; add an intermediate point pulled out from the facade (around (0, 11.5, 13)) so the move reads as a crane shot up the front of the building. Check every other travel the same way.
- On devices with a fine pointer, add a small damped parallax: the camera shifts a fraction of a unit with pointer position. Off for touch and reduced motion.

**Subject highlight.** The old site gave the clickable objects a white outline: a back-face-only, slightly enlarged clone of the mesh in white (`scenes.ts:90` to 126 and `perFrame`). Keep that idea in a restrained form for the four subjects only: the outline fades in while its stop is dwelling and out when leaving, tying the text to the object. If it reads as gimmicky on screen, remove it.

## 7. The tour: content panels

Each panel is plain type on white: no card, border, shadow or background. Starting structure: a small index such as `02 / 05` in a monospace system font, a title, one short paragraph, and the images.

- Panels are triggered, not scrubbed. When the dwell range of a stop is entered, its panel plays a short reveal on its own clock; when the range is left in either direction it plays out. Scrubbed text feels sticky; triggered text feels crisp.
- Reveal: lines rise from behind a mask one after another with a short stagger; images uncover with a clip and settle from a slight scale-up. Exit is quicker than entry.
- Images: all source images are square. Show one at a time at roughly 240 to 320 px with a small counter (`1 / 5`); clicking advances with a crossfade. Lead with photographs; each set's `render.png` is a Blender render of the same object the 3D view is already showing, so place it last.
- Stop 5 shows the two videos (`katana.mp4`, `catapult.mp4`: muted, looping, inline, played only while the stop is active) and `projects/saturn.png`.

Existing copy to carry into the content file before `index.html` is rewritten (line numbers refer to the current working tree):

| Content | Source |
|---|---|
| Music | `index.html:126-177` |
| Teddie | `index.html:179-225` |
| PC and laptop | `index.html:227-275` |
| Shoes and athletics | `index.html:277-324` |
| Bio, 3D works, programming background, language list, social links | `index.html:401-569` |
| Intro sentences | `index.html:19-50` |

Keep Spencer's voice and facts. Fix the typos ("challeneged", "influnce", "resiliant"), drop the emoji and the tutorial text, and shorten where a panel would otherwise need to scroll. The "Pictures" captions can become image alt text.

## 8. Marquee

Two thin rows of text separated by hairlines. The top row is projects and drifts left; the bottom row is experience and drifts right.

- Each item is a title with a small muted label (for example `Pin it!` with `iOS, 2023`), with a simple separator between items. Duplicate the track for a seamless loop and mark the copy `aria-hidden`.
- Drift speed is slow and constant, and briefly speeds up with scroll velocity before settling back. On hover or keyboard focus the row eases to a stop rather than snapping.
- Hovering or focusing an item draws its underline, the cursor absorbs into it (section 9), and a single detail line below the rows crossfades to that item's one-sentence description. Items with media show a small preview near the pointer. Items with a URL are links.
- On touch there is no hover: tapping an item selects it and shows its detail line.
- With reduced motion the rows become a static wrapped list.

## 9. Cursor and magnetic elements

Enable only when `(hover: hover) and (pointer: fine)` matches, and hide the native cursor only after the custom one has received its first pointer move, so a failed script never leaves the visitor without a cursor.

- Two elements: a 6 px dot that tracks the pointer almost exactly, and a ring about 36 px across with a 1 px stroke that trails with damping.
- Make both white with `mix-blend-mode: difference`. They then read as black on the white page and invert automatically over the dark 3D frame and over images.
- **Absorb.** When the pointer enters an element marked as interactive (links, buttons, marquee items, tour ticks, image steppers), the ring animates to the element's bounding box: centred on the element, sized to it plus a little padding, taking its corner radius. The dot fades out. On leaving, the ring springs back to a circle at the pointer.
- **Magnetic.** While absorbed, the element itself translates toward the pointer in proportion to the pointer's offset from its centre, capped at about 6 to 10 px, and springs back on leave. The ring follows the element.
- The absorbed ring has to track its element while the page scrolls underneath a stationary pointer, so re-read the rectangle each frame while locked on.
- Press feedback: ring scales down slightly on pointer down.
- In explore mode the ring shows a drag state over the canvas.
- Move only `transform` and `opacity`, from the same frame loop as everything else. Hide the cursor when the pointer leaves the window.

## 10. Explore mode

A button in the closing section, available once the tour has reached stop 6. Entering it:

- stops page scrolling (the wheel is needed for zoom) and gives the canvas pointer events;
- enables `OrbitControls` with the limits the old site used: target (0, 12, 0), pan disabled, min distance 24, max distance 45, max polar angle 2.5;
- fades the page content out and shows one small "Back" control. Escape also exits.

Exiting tweens the camera back to stop 6, disables the controls and restores scrolling at the same position. Load `OrbitControls` only when explore mode is first entered.

## 11. Visual and motion language

- **Colour.** Background `#fff`, text `#000`, one muted grey for secondary text that still passes contrast on white (around `#6b6b6b`), one hairline grey (around `#e6e6e6`). No accent colour; colour comes from the model and the photographs.
- **Type.** Keep Moderna Sans (`src/assets/fonts/moderna-sans-regular.otf`), the site's existing typeface, for everything. Use a system monospace stack for small labels and counters. Fluid sizes with `clamp()`. Add `font-display: swap`.
- **Layout.** Generous whitespace, a consistent side gutter, no boxes, no shadows, no rounded cards. Hairlines only where a separation is needed.
- **Motion.** One easing family for reveals (an expo-out curve such as `cubic-bezier(0.16, 1, 0.3, 1)`), durations 0.6 to 0.9 s, staggers around 60 ms. No bounce or overshoot except the magnetic spring. Link underlines draw from the left.
- **Copy.** No emoji in the new UI. Use real heading levels (one `h1`); the old markup used `h1` for body text.

## 12. Constraints

- **Legal pages.** The nine legal and support HTML files are almost certainly linked from App Store listings. Their file names, URLs and text must not change, and they must stay in the Vite `rollupOptions.input` list. They link `/src/styles/main.css`, whose current `overflow: hidden` on `html, body` stops the long EULA pages from scrolling. Give them a small stylesheet of their own (`src/styles/legal.css`: white background, readable column, normal scrolling) and point their `<link>` at it, so rewriting the main stylesheet cannot break them. They do not get the custom cursor.
- **No framework, no three upgrade** (section 3.3), no CMS, no dark mode, no analytics, no changes to the model's geometry or lighting.
- **Do not push, deploy, or delete source assets.**

## 13. Architecture

Suggested shape; adjust if something reads better:

```
index.html                 semantic markup, doctype, meta description, favicon link
src/main.ts                boot: content render, scroll, cursor; lazy-loads the 3D
src/content.ts             every string, link, image list and stop definition
src/scroll.ts              smooth scrolling and the shared frame loop
src/cursor.ts              cursor, absorb, magnetic
src/marquee.ts
src/tour/stage.ts          renderer, model load, lights, frame rendering
src/tour/rig.ts            stops to camera state, damping, parallax
src/tour/panels.ts         panel reveals, image stepper, tick navigation
src/tour/explore.ts        explore mode
src/styles/main.css        tokens and all page styles
src/styles/legal.css
```

Dependencies:

- Add `gsap` (ScrollTrigger is included and free) and `lenis` for smooth scrolling. Check their current docs for the recommended way to connect the two; the usual pattern is to drive Lenis from GSAP's ticker and call `ScrollTrigger.update` on Lenis scroll events.
- Remove `@tweenjs/tween.js`, `postprocessing`, `stats.js`, `three-shader-fxaa`, `three.meshline`, and the jQuery and require.js script tags.
- Add `typescript` and `@types/three@0.143` with a `tsc --noEmit` script. Vite strips types without checking them, which is why `scenes.ts` has type errors nobody has seen.

Run one frame loop for everything: smooth scroll, camera damping, cursor, marquee and rendering. Render the 3D only when the tour is on screen and something changed (scroll, damping still settling, parallax, explore mode). The model is heavy and should not burn battery while the visitor reads the hero.

## 14. Loading and performance

- The hero and marquee are static HTML and CSS and must not wait for three or the model. Import the 3D code dynamically after first paint and start the model download then.
- Show progress with the old site's three-digit counter (`000` to `100`) as a small label by the scroll hint. If the visitor reaches the tour before the model is ready, show the counter in the frame; never block scrolling. When the model is ready it fades in at whatever state the scroll position calls for.
- Before the canvas first becomes visible, call `renderer.compile()` and render one warm-up frame, so shader compilation and the one-time shadow pass for nine lights do not hitch the first reveal.
- **Model size.** Produce an optimised `apartment.glb` next to the original: binary container, textures resized to at most 2048 px and re-encoded (WebP), geometry compressed (meshopt; three 0.143 ships `MeshoptDecoder` under `examples/jsm/libs`). `gltf-transform` can do this in one command. Turn off any step that merges, flattens, instances or simplifies meshes, because the node names in section 3.2 must survive, and check that the lights and transmission materials are intact. This could not be tested while writing the brief, so verify the flags against the tool's help. Target under 10 MB with no visible difference. Keep the original `.gltf` as the source and add `.glb` to `assetsInclude` in the Vite config.
- **Images.** The project images total 34 MB. Generate web versions (around 640 and 1280 px, WebP or AVIF), lazy-load them, and set `width` and `height`. No shipped image should exceed about 200 KB. Keep the originals.
- **Videos.** Do not preload; load when stop 5 approaches.
- Pixel ratio capped at 2, stepping down if frame time is poor. Shadows off on coarse-pointer devices, as today.

## 15. Responsive, touch, accessibility

- Check at 1440 by 900, 1024 by 768 and 390 by 844. Below about 900 px wide the tour stacks (section 5).
- On touch devices leave native scrolling alone, and do not resize the renderer when only the viewport height changes (mobile address bars), or the canvas will jump.
- `prefers-reduced-motion`: no smooth-scroll easing, static marquee, no parallax or dwell drift, reveals become plain fades. The camera may still follow scroll.
- Keyboard: every link and control reachable, visible focus styles, tick navigation and image steppers operable with Enter and Space.
- Alt text on every image.
- If WebGL is unavailable or the model fails to load, the tour becomes ordinary stacked sections using each set's `render.png` in place of the frame, so all content is still reachable.

## 16. Content file

`src/content.ts` exports typed data for the hero, both marquee rows, the stops and the closing section. Known facts, all from the repo:

- Name: Spencer Steadman. Virginia Tech, class of 2027. Self-taught programmer and 3D artist; athlete (swimming, track).
- Started programming in early 2020 with Python for an International Baccalaureate personal project, inspired by his brother Wil. Most notable work so far: iOS apps. Stated aim: improving users' productivity and refining UI/UX.
- Languages listed (as of March 2024, so the year counts are stale; show the languages without durations): Python, JavaScript, Swift, SwiftUI, Dart, Java.
- Links: `https://github.com/steadman1`, `https://www.instagram.com/s__steadman/`, `mailto:steadman@vt.edu`.
- Projects: Pin it!, Watch AI and Liminal Browser (an Apple Watch browser), all published as "Liminal Code"; this portfolio (Blender, Three.js); Katana & Medieval Helmet and Catapult & Company (Blender, Premiere, Soundly); Saturn's a Highway (Blender, Photoshop, inspired by Roger Mattos).

Placeholders, each marked `TODO(spencer)` in the file and rendered so they are obviously unfinished rather than plausible:

- Every professional experience entry (role, organisation, dates, one sentence).
- Dates, one-line descriptions and App Store or GitHub links for each project.
- The caption for stop 0 and the wording of the terrace panel.

## 17. Order of work and how to check it

1. **Baseline.** Branch, commit the existing uncommitted edits, install, run the current site. Screenshot the exterior and both camera views; these are the look reference for lighting and framing.
2. **Skeleton.** New `index.html`, tokens, content file, static hero and marquee, legal stylesheet split. The build should emit all ten pages.
3. **Scroll and cursor.** Smooth scrolling, shared frame loop, cursor, absorb, magnetic, marquee motion.
4. **Stage.** Model loading without controls or composer, render on demand, frame rendering. Compare against the reference screenshots.
5. **Tour.** Stops, scrubbed camera timeline, panels, tick navigation, subject highlight.
6. **Closing and explore mode.**
7. **Assets and loading.** Optimised model, images, lazy loading, progress counter, warm-up.
8. **Responsive, touch, reduced motion, fallback.**

Done means all of the following have been checked in a real browser, not inferred:

- `npm run build` and the type check pass; `dist/` contains all ten HTML pages; the legal pages look right and scroll.
- No console errors. The hero is usable before the model has loaded.
- Scrolling forward and backward through the whole tour is smooth; every stop holds; panels alternate sides on desktop and stack on mobile; text is always black on white and never over the 3D image.
- Stops 0 and 1 match the reference screenshots. The camera never passes through geometry on any travel.
- Reloading mid-tour, jumping with the ticks or the End key, and resizing mid-tour all land in the correct state.
- The cursor absorbs into and moves every interactive element, stays attached while scrolling, and is absent on touch.
- Explore mode enters, orbits, and returns to the same scroll position.
- Reduced motion and the no-WebGL fallback both work.

Report back with screenshots of each stop, the final tuned camera values for stops 2 to 5, the size of the optimised model, and anything in this brief that turned out to be wrong.
