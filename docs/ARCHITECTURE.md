# Architecture

How the page starts, how the scene is built, and how a frame is drawn.

## Principles

- **No framework.** Plain ES modules and three.js. The interface is static
  HTML that modules update directly.
- **Everything is seeded.** Each texture, tree and person has its own seeded
  random generator, so every load builds the same pixels and layout. That is
  also what lets textures be painted in workers.
- **Light is faked wherever possible.** About six real lights; everything else
  is emissive geometry, decals and traced rooms, dimmed by one zone uniform.

## Boot sequence

```text
index.html ─┬─ inlined CSS and loading screen
            ├─ preload: font; every JavaScript chunk on a desktop-sized window
            └─ src/main.js
                 ├─ no WebGL 2       → message on the loading screen
                 ├─ under 1024 × 540, or touch-only (core/desktop)
                 │                   → the notice only; starts if the window grows
                 └─ src/app.js: import each build step in order
                      textures/procedural → paint surfaces in workers
                      core/scene          → renderer, sky, lights, environment, post
                      world, tower, study, ui modules
                      core/optimize       → merge static meshes, set reflection layer
                      core/loop           → warm-up behind the loading screen, then frames
```

Several steps use top-level `await` to yield to the browser. `app.js` imports
the steps one at a time, so order-dependent work (such as merging meshes only
after every floor exists) always runs in sequence. Each step imports only
from earlier ones, so the module graph has no cycles.

## Source layout

```text
src/
├── main.js, app.js   Entry checks; the ordered build steps
├── core/             Renderer and scene, camera and quality levels, mesh merging, frame loop
├── textures/         Painting kit, surface recipes, bake worker, scanned PBR sets
├── world/            Materials, geometry helpers, ground, surroundings, atmosphere
├── tower/            Lobby, slabs, floor recipes and traced rooms, furniture, penthouse, trees
├── study/            Light timeline, untwist, window clicks, rain, seasons, sound
├── ui/               Loading progress, time bar, orbit, controls
├── styles/           Interface styles and design tokens
└── assets/           Font, scanned textures, night ambience
scripts/              bench.mjs, bench-lowend.mjs, bench-webkit.mjs (benchmarks), capture.mjs (screenshots),
                      record.mjs (season loop video)
public/               Icons, social image, 404 page, Cloudflare headers
```

## Textures

31 seeded recipes produce 86 maps (colour, normal, roughness). They are
painted on OffscreenCanvas in up to four module workers and sent back as
transferred buffers. If workers are unavailable, the same recipes run on the
page with identical output. Four CC0 photo-scanned sets replace their painted
stand-ins once downloaded, so no surface is ever blank.

## Rendering

- **Renderer:** WebGL 2, ACES tone mapping, soft shadows drawn once.
- **Post-processing:** a 4× MSAA HDR render, half-resolution bloom on the
  brightest pixels, then a film grade (grain, vignette, split tone).
- **Environment:** the sky is pre-filtered once into an environment map.
- **Mirror pool:** the one real reflection. It draws only large forms,
  emitters and lights, and refreshes less often at lower quality.
- **Light zones:** emitter shaders are patched to multiply by `uZone[k]`,
  where `k` comes from world height (lobby, floors 1–10, penthouse, beacon).
  Switching a floor is one number.

## Frame loop

`core/loop.js` runs every frame: camera, light timeline, springs, weather,
seasons and shader clocks, then one matrix update and one composer render.

- **Warm-up:** before the scene appears, textures upload in small slices,
  shaders compile in parallel, and two hidden frames are drawn. The first
  visible frame never pays for compilation.
- **Idle:** after 6 s with no input and nothing moving, drawing drops to
  about 30 fps.
- **Quality governor:** 1.5 s of slow frames steps down one of five levels
  (two when frames are far over budget): pixel ratio, then bloom, then mirror
  quality, then multisampling. Low-spec devices start at level 2. It never
  steps back up, so nothing flickers.
- **Desktop size:** a window shrunk below 1024 × 540 stops the loop and
  suspends the sound; both resume when the window is large again.

## Build

Vite, with three small plugins in `vite.config.js`: one fills the site URL
and writes `robots.txt` and `sitemap.xml`, one preloads the font and (on a
desktop-sized window, through an inline script whose hash it adds to the CSP
in `_headers`) every chunk, and one inlines the stylesheet. The desktop query
(`core/desktop.js`) has its own chunk, so no scene chunk depends on the entry
chunk or waits on its inlined stylesheet. Assets are content-hashed and cached
for a year.

## Debugging

- `?debug`: build-step timings and frame stats in the console, User Timing
  marks in DevTools, and the scene on `window.blueHour`.
- `?view=tower`, `core`, `penthouse`, `level` or `floor0`–`floor9`: a fixed
  close-up camera.
