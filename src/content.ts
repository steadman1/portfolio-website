/**
 * SITE CONTENT
 * ============
 * Almost everything you'd want to change lives in this file: the intro,
 * links, the work rows, and every stop of the 3D apartment tour
 * (camera angles, text, photos).
 *
 * Tips
 * - A string that starts with "TODO" renders as an obvious placeholder
 *   (grey, dotted underline). Replace it with real text.
 * - Photos load from /public/media (small web copies). The originals stay in
 *   src/assets. To add a photo, put the original under src/assets/projects/,
 *   run `sh scripts/optimize-media.sh`, then reference "/media/projects/...".
 * - To find new camera angles for the tour, open the site with `?debug`
 *   added to the URL (e.g. http://localhost:5173/?debug) and press C.
 *   See the README for details.
 */

export type Vec3 = [number, number, number];

export type Link = { label: string; href: string };

export type WorkItem = {
  title: string;
  /** Short label shown next to the title, e.g. "Apple Watch app". */
  meta: string;
  /** Optional year or date range, shown after the meta. */
  year?: string;
  /** One sentence, shown under the rows while the item is hovered. */
  description: string;
  /** Optional link. Items without one aren't clickable. */
  href?: string;
  /** Square image shown to the left of the title (other shapes are cropped
   *  to a square from the middle), and as the hover preview by the cursor.
   *  Leave out for a grey placeholder square. */
  image?: string;
  /** Optional large image (any shape, e.g. a screenshot) shown by the
   *  cursor on hover instead of `image`. */
  preview?: string;
  /** Optional video for the hover preview; it plays silently while hovered
   *  (`preview` or `image` is shown while it loads). */
  video?: string;
};

export type Media =
  | { image: string; alt: string; caption?: string }
  | { video: string; poster: string; alt: string; caption?: string };

export type Stop = {
  /** Name in the tour's side navigation. Leave out to make the stop a
   *  pass-through point the camera flies through without stopping. */
  label?: string;
  camera: {
    /** Where the camera is, in model units (same axes as Blender, but Y is up). */
    position: Vec3;
    /** The point the camera looks at. */
    target: Vec3;
    /** Field of view in degrees. Smaller = more zoomed in. */
    fov: number;
  };
  /** Extra points the camera passes through on its way to this stop,
   *  used to keep it from flying through walls. */
  via?: Vec3[];
  /** Where the 3D view sits while this stop is on screen.
   *  "full" = whole screen; "left"/"right" = that side, text on the other. */
  frame: 'full' | 'left' | 'right';
  /** Scroll distance spent flying here from the previous stop,
   *  in screen heights (1 = one full screen of scrolling). */
  travel: number;
  /** Scroll distance the view holds still once it arrives, in screen heights. */
  dwell: number;
  /** Names of model objects to outline while this stop is showing. */
  highlight?: string[];
  panel?: {
    title?: string;
    text: string;
    media?: Media[];
    /** "explore" adds the button that unlocks free orbiting. */
    action?: 'explore';
  };
  /** Shown in place of the 3D view if WebGL isn't available. */
  fallbackImage?: string;
};

// ---------------------------------------------------------------------------
// Intro (top of the page)
// ---------------------------------------------------------------------------

/** Tools with an icon in the intro's skills line. Hovering an icon shows
 *  it in colour with how many years since `since` (the year I started). */
export const tools = {
  swift: { name: 'Swift', since: 2020 },
  python: { name: 'Python', since: 2019 },
  figma: { name: 'Figma', since: 2020 },
  photoshop: { name: 'Photoshop', since: 2016 },
  illustrator: { name: 'Illustrator', since: 2022 },
};
export type ToolId = keyof typeof tools;

export const intro = {
  name: 'Spencer Steadman',
  tagline: 'Software Engineer & Designer',
  school: "Virginia Tech, class of 2027",
  bio: [
    "I'm a self-taught Software Engineer with a passion for design. I started writing Python code in 2019 and haven't stopped since. Currently, I'm building iOS apps, Python libraries, and designing interfaces.",
    "I also love all kinds of design, so I built my dream apartment in Blender! Scroll down to take a look inside.",
  ],
  /** The line of skills under the bio. `tools` are the icons shown to the
   *  left of each skill (see `tools` below). `more` is a list (no icons)
   *  shown when the skill is hovered. */
  skills: [
    { label: 'Swift & SwiftUI', tools: ['swift'] },
    { label: 'Python', tools: ['python'] },
    { label: 'UI & UX Design', tools: ['figma'] },
    { label: 'Graphic & Motion Design', tools: ['photoshop', 'illustrator'] },
    { label: 'and more', more: ['C++', 'Java', 'After Effects', 'Premiere Pro'] },
  ] as { label: string; tools?: ToolId[]; more?: string[] }[],
  /** The small note at the bottom right of the intro, across from "Scroll",
   *  and the link after it. The original site is served from public/original
   *  (built by scripts/build-original.sh). */
  credit:
    'This website has been remastered by Claude Opus 5.5. All 3D models, videos, and images were hand made by me, Spencer Steadman.',
  creditLink: { label: 'View the original', href: '/original/' },
  /** Photos of you. The first shows when the page loads; clicking the photo
   *  steps through the rest. Add as many as you like. */
  portraits: [
    { src: '/media/profile/hokie_bird.jpg', alt: 'Me, Spencer Steadman, and Hokie Bird in front of War Memorial Hall.' },
    { src: '/media/profile/wetsuit.jpg', alt: 'Me, Spencer Steadman, in a wetsuit getting ready to swim in Lake Tahoe.' },
    { src: '/media/profile/work.jpg', alt: 'Me, Spencer Steadman, at work.' },
    { src: '/media/profile/profile_picture_900x900.jpg', alt: 'Me, Spencer Steadman, on my 7th birthday.' },
    { src: '/media/profile/snorkeling.jpg', alt: 'Portrait of Spencer Steadman' },
  ],
};

export const links: Link[] = [
  { label: 'GitHub', href: 'https://github.com/steadman1' },
  { label: 'Instagram', href: 'https://www.instagram.com/s__steadman/' },
  { label: 'Email', href: 'mailto:steadman@vt.edu' },
];

// ---------------------------------------------------------------------------
// Work: the lists under the intro (jobs, then projects)
// ---------------------------------------------------------------------------

export type WorkRow = { label: string; items: WorkItem[] };

/** One list per entry, top to bottom. Add, remove or reorder them freely. */
export const workRows: WorkRow[] = [
  {
    label: 'Experience',
    items: [
      {
        title: 'Software Engineer Intern, Apple Inc.',
        meta: 'Summer 2026',
        description: 'Worked with the App Store QA team, automated StoreKit & GameKit DXO sign-off.',
        image: '/media/logos/apple.jpg',
        preview: '/media/profile/apple_intern.JPG',
      },
      {
        title: 'Computer Science at Virginia Tech',
        meta: 'Fall 2023 - Spring 2027',
        description: 'B.S. in Computer Science, College of Engineering & Men\'s Vice President of Swim Club at Virginia Tech.',
        image: '/media/logos/vt.png',
        preview: '/media/profile/hokie_bird.jpg',
      },
      {
        title: 'Painter*s Tape Studios',
        meta: 'Spring 2023 - Now',
        description: 'A software and design studio founded by me and my brother, Wil.',
        image: '/media/logos/pt.jpg',
        href: 'https://mypainterstape.com/',
        preview: '/media/projects/painter_s_tape_sticker.jpg',
      },
      {
        title: 'Software Engineer Intern, Marriott International',
        meta: 'Summer 2025',
        description: 'Worked with the iOS Bonvoy team, shipped features & screens for the Bonvoy Wallet.',
        image: '/media/logos/marriott.png',
      },
      // {
      //   title: 'Software Engineer, NOVA of Virginia Aquatics',
      //   meta: 'Summer 2024',
      //   description: 'Automated swimming instructor scheduling, mentored high school interns.',
      //   image: '/media/logos/nova.png',
      // },
      {
        title: 'Academic Tutor, Third Church RVA ',
        meta: 'Winter 2015 - Spring 2023',
        description: '7-year tutor for ESL and Arabic-speaking students.',
        image: '/media/logos/third_church.jpg',
      },
    ],
  },
  {
    label: 'Software',
    items: [
      {
        title: 'Your Cashback',
        meta: 'iPhone app',
        year: '2025',
        description: 'A cashback maximizer for your credit cards.',
        href: 'https://apps.apple.com/us/app/your-cashback-maximize-rewards/id6740216340',
        image: '/media/icons/your_cashback.png',
        preview: '/media/projects/your_cashback.png',
      },
      {
        title: 'Golf',
        meta: 'UI/UX case study',
        year: '2026',
        description: 'An action packed 2-4 player card game.',
        href: 'https://www.figma.com/design/OtrBljPuG5YggsJYThYGpq/Golf?node-id=0-1&p=f&t=j0VFuVI2w8LQhLOa-0',
        image: '/media/icons/golf_icon.png',
        preview: '/media/projects/golf.png',
      },
      {
        title: 'SpenceKit.swift',
        meta: 'SwiftUI library',
        year: '2024',
        description: 'A SwiftUI rapid prototyping UI kit.',
        href: 'https://github.com/steadman1/SpenceKit.swift',
        image: '/media/icons/SpenceKit_pfp.png',
        preview: '/media/projects/spencekit.png',
      },
      // {
      //   title: 'Polylogue',
      //   meta: 'AI inference API',
      //   year: '2026',
      //   href: 'https://github.com/steadman1/polylogue',
      //   description: 'A REST API for serving self-hosted inference models of all types.'
      // },
      {
        title: 'Ponder',
        meta: 'iPhone app',
        year: '2023',
        description: 'A beautiful dream journal for the 21st century.',
        href: 'https://apps.apple.com/us/app/ponder-lucid-dream-journal/id6587549184',
        image: '/media/icons/ponder_bubbly_icon.png',
        video: '/media/videos/ponder.mp4',
      },
      // {
      //   title: 'Time-under-Tension Timer',
      //   meta: 'iPhone app',
      //   year: '2026',
      //   href: 'https://github.com/steadman1/muscle-contraction-timer',
      //   description: 'A feature prototype for the Bevel iOS app that uses AirPods accelerometer data to estimate time-under-tension during strength training.',
      //   preview: '/media/projects/tut_screen.png',
      // },
      {
        title: 'Champ',
        meta: 'UI/UX case study',
        year: '2026',
        href: 'https://www.figma.com/design/nqILjOSS04aS4LcDuiDdFr/Champ?node-id=0-1&t=CqfV5DNlXR4SmaxM-1',
        description: 'A neumorphic strength training mobile app design.',
        image: 'media/icons/champ.png',
        preview: 'media/projects/champ.png'
      },
      {
        title: 'Watch AI',
        meta: 'Apple Watch app',
        year: '2022 - 2025',
        description: 'Now deprecated AI chat app for the Apple Watch.',
        href: 'https://github.com/steadman1/readme-portfolio#-watch-ai-ai-on-your-wrist',
        preview: '/media/projects/wristgpt.png',
        image: '/media/icons/wristgpt.png',
      },
      // {
      //   title: 'Playlist Sort by Color',
      //   meta: 'ML Case study',
      //   year: '2023',
      //   href: 'https://github.com/steadman1/Sort-By-Color-For-Spotify',
      //   description: 'Exploring Dimensionality Reduction with Self Observing Maps by Sorting Colors.',
      //   preview: 'media/projects/sort_by_color.png'
      // },
      {
        title: 'Painter*s Tape Portfolio',
        meta: 'React.js, three.js website',
        year: '2025',
        href: 'https://mypainterstape.com',
        description: 'A portfolio website for my software & designs studio that I founded with my brother, Wil.',
        image: 'media/icons/asterisk.png',
        preview: 'media/projects/painters_tape_poster.jpg'
      },
      {
        title: 'Apartment Portfolio',
        meta: 'three.js, Blender',
        year: '2023',
        description: 'The site you\'re on! My dream apartment that I modeled in Blender, rendered live with three.js.',
        image: '/media/profile/wetsuit.jpg',
        preview: '/media/projects/apartment.jpg'
      },
      {
        title: 'README.md',
        meta: 'Article',
        year: '2024',
        description: 'Read a little bit more about each of my projects from 2024.',
        href: 'https://github.com/steadman1/readme-portfolio#who-am-i',
        image: '/media/profile/profile_picture_900x900.jpg',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// The apartment tour
// ---------------------------------------------------------------------------

/** The 3D model. Regenerate it from the Blender export with
 *  `python3 scripts/optimize-model.py`. */
export const modelUrl = '/models/apartment.glb';

/** The same model with its lighting and shadows baked into one image (made
 *  by scripts/bake-lighting.sh). Much lighter to draw: no real-time lights or
 *  shadows at all, and phones get the shadows too. Set `enabled: false` to go
 *  back to real-time lighting (modelUrl above). */
export const bakedModel = {
  enabled: true,
  url: '/models/apartment-baked.glb',
  /** The baked light, 4096px: a quick download, and quick to put on the GPU. */
  lightmap: '/models/apartment-lightmap-small.jpg',
  /** The full 8192px bake: slightly crisper shadows up close, but a 6.7 MB
   *  download and a stutter when it's uploaded to the GPU. Add
   *  ?sharp-lightmap to the address to compare. */
  lightmapSharp: '/models/apartment-lightmap.jpg',
  /** Overall brightness of the baked light (1 = as baked). */
  brightness: 1,
};

/** How scrolling feels with a mouse wheel or trackpad (Locomotive Scroll).
 *  Touch screens always scroll natively. */
export const scrollSettings = {
  /** 0 to 1: the share of the remaining distance covered each frame.
   *  Lower = smoother and floatier, higher = snappier. */
  lerp: 0.085,
  /** Multiplies how far each wheel or trackpad movement scrolls. */
  wheelSpeed: 1,
};

/** Overall feel of the tour. */
export const tourSettings = {
  /** How much the camera slowly pushes in while a stop holds (0.03 = 3% closer). */
  drift: 0.03,
  /** How much the camera sways with the mouse (fraction of its distance to the target). */
  parallax: 0.035,
  /** How quickly the camera catches up with scrolling (it follows on a
   *  spring). Lower = smoother and more floaty, higher = snappier. */
  smoothing: 9,
  /** How long (seconds) the camera takes to fly to a stop when a button or
   *  side tick is pressed. Trips across several stops take a bit longer. */
  buttonFlightSeconds: 2.2,
};

// Camera positions for the shop and bay window come from the marker
// objects in the model ("shop counter camera outline" and "bay window
// camera outline"); the old site flew to exactly these spots.
const SHOP_CAMERA: Vec3 = [0, 5.308, 7.657];
const BAY_WINDOW_CAMERA: Vec3 = [0.002, 17.394, 8.428];

export const stops: Stop[] = [
  {
    label: 'Outside',
    camera: { position: [35, 12, 35], target: [0, 12, 0], fov: 75 },
    frame: 'full',
    travel: 0,
    dwell: 0.4,
    panel: {
      text: 'Steadman Records on the ground floor, my apartment above it, a terrace on the roof. I modeled all of it in Blender. Keep scrolling to step inside.',
    },
  },
  {
    label: 'Music',
    camera: { position: SHOP_CAMERA, target: [0, 5.308, -0.343], fov: 75 },
    via: [[12, 7, 19]],
    frame: 'right',
    travel: 0.5,
    dwell: 0.4,
    highlight: ['record_box1_outline', 'record_box2_outline'],
    panel: {
      title: 'Music',
      text: "Music is where a lot of my creativity comes from. It carries emotions and ideas that words alone can't, so the ground floor is a record shop stocked with favorites. Honorable mentions: Norah Jones, Sade, and Outkast.",
      media: [
        { image: '/media/projects/record_box/tango_in_the_night.jpg', alt: 'Tango in the Night by Fleetwood Mac', caption: 'Tango in the Night\nFleetwood Mac' },
        { image: '/media/projects/record_box/american_beauty.jpg', alt: 'American Beauty by Grateful Dead', caption: 'American Beauty\nGrateful Dead' },
        { image: '/media/projects/record_box/dark_side_of_the_moon.jpg', alt: 'The Dark Side of the Moon by Pink Floyd', caption: 'The Dark Side of the Moon\nPink Floyd' },
        { image: '/media/projects/record_box/aja.jpg', alt: 'Aja by Steely Dan', caption: 'Aja\nSteely Dan' },
        { image: '/media/projects/record_box/beach_boys.jpg', alt: 'Becoming the Beach Boys by The Beach Boys', caption: 'Becoming the Beach Boys\nThe Beach Boys' },
        { image: '/media/projects/record_box/discovery.jpg', alt: 'Discovery by Daft Punk', caption: 'Discovery\nDaft Punk' },
        { image: '/media/projects/record_box/graduation.jpg', alt: 'Graduation by Kanye West', caption: 'Graduation\nKanye West' },
        { image: '/media/projects/record_box/currents.jpg', alt: 'Currents by Tame Impala', caption: 'Currents\nTame Impala' },
        { image: '/media/projects/record_box/camp.jpg', alt: 'Camp by Childish Gambino', caption: 'Camp\nChildish Gambino' },
        { image: '/media/projects/record_box/in_between_dreams.jpg', alt: 'In Between Dreams by Jack Johnson', caption: 'In Between Dreams\nJack Johnson' },
        { image: '/media/projects/record_box/render.jpg', alt: 'Blender render of the record crates', caption: 'Render' },
      ],
    },
    fallbackImage: '/media/projects/record_box/render.jpg',
  },
  {
    // Pass-through: the camera rises up the front of the building and
    // briefly shows the whole apartment through the bay window.
    camera: { position: BAY_WINDOW_CAMERA, target: [0.002, 17.394, 0.428], fov: 75 },
    via: [[0, 9, 13.5], [0, 17.4, 14]],
    frame: 'left',
    travel: 0.85,
    dwell: 0,
  },
  {
    label: 'PC',
    camera: { position: BAY_WINDOW_CAMERA, target: [-4.75, 15.7, 0.9], fov: 45 },
    frame: 'left',
    travel: 0.55,
    dwell: 0.4,
    highlight: ['Cube070'],
    panel: {
      title: 'My Computer',
      text: "I built this PC in 2018. Computers are a passion, but mostly it reminds me of my brother, Wil. I've looked up to him for as long as I can remember; he pushed me, challenged me and introduced me to nearly everything that made me who I am.",
      media: [
        { image: '/media/projects/pc/pc.jpg', alt: 'The PC I built in 2018' },
        { image: '/media/projects/pc/laptop.jpg', alt: 'Code open on my laptop' },
        { image: '/media/projects/pc/radio.jpg', alt: "Close-up render of a radio's dials", caption: 'Render' },
        { image: '/media/projects/pc/delorean.jpg', alt: 'Render of a DeLorean under a neon arc', caption: 'Render' },
        { image: '/media/projects/pc/render.jpg', alt: 'Blender render of the PC and desk', caption: 'Render' },
      ],
    },
    fallbackImage: '/media/projects/pc/render.jpg',
  },
  {
    label: 'Teddie',
    camera: { position: BAY_WINDOW_CAMERA, target: [-2.62, 14.3, 1.36], fov: 35 },
    frame: 'right',
    travel: 0.3,
    dwell: 0.4,
    highlight: ['Cube105'],
    panel: {
      title: 'Teddie',
      text: "My cat, Teddie, has been part of my life since we adopted her in 2015. She can lift my mood after any long day, so of course she's in here, sitting on my chair.",
      media: [
        { image: '/media/projects/teddie/window.jpg', alt: 'Teddie by a window' },
        { image: '/media/projects/teddie/box.jpg', alt: 'Teddie in a box' },
        { image: '/media/projects/teddie/halloween.jpg', alt: 'Teddie at Halloween' },
        { image: '/media/projects/teddie/chair.jpg', alt: 'Teddie on a chair' },
        { image: '/media/projects/teddie/render.jpg', alt: 'Blender render of Teddie on the desk chair', caption: 'Render' },
      ],
    },
    fallbackImage: '/media/projects/teddie/render.jpg',
  },
  {
    // The San Francisco (Sausalito) poster on the shelf above the desk.
    label: 'Travel',
    camera: { position: [-1.2, 18.4, 2.4], target: [-5.45, 18.75, 1.92], fov: 48 },
    // Swoops up and out to the right, then round to the shelf (and the same
    // arc in reverse when scrolling back up to Teddie).
    via: [[2.4, 19.8, 4.6]],
    frame: 'left',
    travel: 0.75,
    dwell: 0.4,
    highlight: ['sausalito_+_purple'],
    panel: {
      title: 'Travel',
      text: 'Some photos of my favorite places, including (but not limited to) Santa Clara, Carmel by the Sea, Lake Tahoe, Yosemite, and Cape Town.',
      media: [
        { image: '/media/projects/travel/IMG_0097.jpg', alt: 'Granite boulders in clear blue lake water' },
        { image: '/media/projects/travel/IMG_0241.jpg', alt: 'A windswept cypress on rocks above the ocean' },
        { image: '/media/projects/travel/IMG_0320.jpg', alt: 'Rocky outcrops below a green hill' },
        { image: '/media/projects/travel/IMG_0326.jpg', alt: 'Pink and orange sunset over the ocean from a cliff' },
        { image: '/media/projects/travel/IMG_0461.jpg', alt: 'The Golden Gate Bridge in fog behind wildflowers' },
        { image: '/media/projects/travel/IMG_0610.jpg', alt: 'A cypress and sandstone cliff beside a coastal road' },
        { image: '/media/projects/travel/IMG_0683.jpg', alt: 'An empty road through a pine forest' },
        { image: '/media/projects/travel/IMG_0689.jpg', alt: 'Half Dome above a pine forest at dusk' },
        { image: '/media/projects/travel/IMG_0977.jpg', alt: 'Turquoise water below a white limestone cliff' },
        { image: '/media/projects/travel/IMG_0861.jpg', alt: 'Colourful beach huts on stilts below a hill' },
        { image: '/media/projects/travel/IMG_1261.jpg', alt: 'A lion walking toward the camera' },
        { image: '/media/projects/travel/sausalito-poster.jpg', alt: 'Sausalito, California poster with the Golden Gate Bridge', caption: 'The poster' },
      ],
    },
    fallbackImage: '/media/projects/travel/sausalito-poster.jpg',
  },
  {
    label: 'Shoes',
    camera: { position: BAY_WINDOW_CAMERA, target: [1.52, 12.74, 0.02], fov: 35 },
    frame: 'right',
    travel: 0.45,
    dwell: 0.4,
    highlight: ['shoe_left', 'shoe_right'],
    panel: {
      title: 'Sports and Outdoors',
      text: 'A worn pair of sneakers is a reminder of what I\'ve accomplished. Sports and the outdoors have been a constant in my life and nothing has pushed me to my limits like they have.',
      media: [
        { image: '/media/projects/shoes/IMG_1228.jpg', alt: 'Holding up a pair of worn sneakers' },
        { image: '/media/projects/shoes/20261026_122540_E8356D.jpg', alt: 'Diving off the blocks at a swim meet' },
        { image: '/media/projects/shoes/dji_mimo_20260528_161516_20260528130457_1779999485153_photo.jpg', alt: 'Snorkeling over a sandy seabed' },
        { image: '/media/projects/shoes/IMG_0663.jpg', alt: 'A thumbs-up in a wetsuit and goggles under pine trees' },
        { image: '/media/projects/shoes/IMG_2136.jpg', alt: 'Two friends covered in colour powder after a colour run' },
        { image: '/media/projects/shoes/IMG_3382.jpg', alt: 'Hiking a forest trail with a big backpack' },
        { image: '/media/projects/shoes/render.jpg', alt: 'Blender render of the sneakers', caption: 'Render' },
      ],
    },
    fallbackImage: '/media/projects/shoes/render.jpg',
  },
  {
    // Seen from out past the building's front-right corner, looking down
    // a little at the whole roof terrace. TODO(spencer): reword the text if you like.
    label: 'Other Works',
    camera: { position: [18, 33, 18], target: [0, 25.5, 0], fov: 45 },
    via: [[0, 18, 13.5], [9, 27, 21]], // out from the window, then up and around
    frame: 'left',
    travel: 0.5,
    dwell: 0.45,
    panel: {
      title: 'Other Works',
      text: 'Up on the roof, a few other creative works I\'ve made over the years.',
      media: [
        { video: '/media/videos/katana.mp4', poster: '/media/videos/katana.jpg', alt: 'Animated render of a katana', caption: 'Katana & Medieval Helmet' },
        { video: '/media/videos/catapult.mp4', poster: '/media/videos/catapult.jpg', alt: 'Animation of a catapult', caption: 'Catapult & Company' },
        { video: '/media/videos/macintosh.mp4', poster: '/media/videos/macintosh.jpg', alt: 'Animation of a classic Macintosh computer', caption: 'Macintosh (1984)' },
        { video: '/media/videos/garden.mp4', poster: '/media/videos/garden.jpg', alt: 'Animation of a tree and a clothes line', caption: 'A Tree & a Clothes Line' },
        { video: '/media/videos/dreamtapes.mp4', poster: '/media/videos/dreamtapes.jpg', alt: 'Animation of tapes inside a head', caption: 'Dream Tapes' },
        { image: '/media/projects/saturn.jpg', alt: 'Classic cars driving on the rings of Saturn', caption: "Saturn's a Highway" },
        { image: '/media/projects/other_works/1984.jpg', alt: 'Bold red poster for George Orwell\'s 1984 with an eye in the title', caption: '1984' },
        { image: '/media/projects/other_works/boulder_fields_CO.jpg', alt: 'Magazine-style cover of red rock spires with a hand-drawn trail map of Colorado', caption: 'Boulder Field, Colorado' },
        { image: '/media/projects/other_works/burrus.jpg', alt: 'Magazine-style cover of Burrus Hall at Virginia Tech', caption: 'Burrus Hall' },
        { image: '/media/projects/other_works/go_outside_poster.jpg', alt: '"Touch some grass every once in a while" poster on a classic desktop wallpaper', caption: 'Touch Some Grass' },
        { image: '/media/projects/other_works/hokie_side_of_the_moon_front.jpg', alt: 'Album cover with a prism splitting light into maroon and orange', caption: 'The Hokie Side of the Moon' },
        { image: '/media/projects/other_works/kiwi_ssr_guideline.jpg', alt: 'Typographic poster about kiwifruit', caption: 'Kiwifruit' },
        { image: '/media/projects/other_works/layers.jpg', alt: 'Gradient poster charting the layers of the atmosphere', caption: 'Layers' },
        { image: '/media/projects/other_works/music_metro.jpg', alt: 'Transit-map style poster of a music playlist', caption: 'Music Metro' },
      ],
    },
  },
  {
    label: 'Outside',
    camera: { position: [28, 12, 28], target: [0, 12, 0], fov: 75 },
    frame: 'full',
    travel: 0.5,
    dwell: 0.4,
    panel: {
      text: "That's the whole building. Want a closer look?",
      action: 'explore',
    },
  },
];

// ---------------------------------------------------------------------------
// Contact (bottom of the page)
// ---------------------------------------------------------------------------

export const contact = {
  heading: 'Say hello, I\'d love to hear from you!',
  email: 'steadman@vt.edu',
};
