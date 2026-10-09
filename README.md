# Spencer Steadman — Portfolio

Interactive 3D portfolio site. Built with [Vite](https://vitejs.dev/) and [Three.js](https://threejs.org/).

## Quick start

```bash
npm install
npm run dev       # start dev server (http://localhost:5173)
npm run build     # production build to dist/
npm run preview   # serve the production build locally
```

## Project structure

```
├── index.html              # main portfolio page (interactive 3D scene)
├── pinit.html              # "Pin it!" privacy policy
├── privacy.html            # general privacy policy
├── support.html            # general support page
├── watchai-*.html          # watchAI legal pages (privacy / support / EULA)
├── liminal-browser-*.html  # Liminal Browser legal pages (privacy / support / EULA)
├── vite.config.js          # multi-page build config (all HTML entries above)
├── public/                 # static assets served as-is (favicon)
└── src/
    ├── main.js             # app entry: renderer, controls, scene boot
    ├── scenes.ts           # Three.js scenes (preloader + apartment)
    ├── info_cards.ts       # info card components
    ├── styles/
    │   └── main.css        # shared stylesheet (main page + legal pages)
    └── assets/
        ├── fonts/          # @font-face sources
        ├── models/         # glTF models (apartment, etc.)
        ├── textures/       # HDR environment maps
        ├── videos/         # project demo videos
        ├── logos/          # software logos (Blender, Premiere, …)
        ├── icons/          # social / UI icons
        ├── profile/        # profile pictures
        └── projects/       # 3D project stills, one folder per project
```

Notes:

- HTML entry points live at the repo root so built output keeps its current URLs.
- Unused/spare assets are kept under `src/assets/` (`models/elevator_exp.gltf`,
  `models/test.gltf`, `textures/brown_photostudio_02_4k.hdr`, `videos/garden.mp4`,
  `videos/milk.mp4`) — safe to delete if you don't need them again.
