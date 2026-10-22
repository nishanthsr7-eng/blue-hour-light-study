# Performance

A beautiful effect that stutters is a regression. This page records what the
study costs, how it stays fast, and what is still open.

## Targets

- Smooth on an ordinary laptop, including one with only integrated graphics,
  idling when nothing moves.
- No long main-thread freezes while the scene builds.
- A fast first paint and zero layout shift.
- Desktop only: below a 1024 × 540 window, or on a touch-only device, the
  page shows a one-line notice and loads none of the scene.

## Test setup

All figures come from one Windows laptop with two GPUs, measured on
2026-10-21 against the production build. Each figure is the median of three
runs unless a range is given. The rest of this page refers to the profiles
below by name.

| Profile                   | GPU                                     | CPU                                    | Window     | Command                         |
| ------------------------- | --------------------------------------- | -------------------------------------- | ---------- | ------------------------------- |
| Discrete GPU              | NVIDIA GeForce RTX 5050 Laptop          | AMD Ryzen 9 8940HX                     | 1440 × 900 | `npm run bench`                 |
| Integrated GPU            | AMD Radeon 610M (the laptop's own iGPU) | AMD Ryzen 9 8940HX                     | 1440 × 900 | `LOW_GPU=1 npm run bench`       |
| Integrated GPU, slow CPU  | AMD Radeon 610M                         | Throttled 4×                           | 1440 × 900 | `LOW_GPU=1 CPU=4 npm run bench` |
| Budget laptop (simulated) | AMD Radeon 610M                         | Throttled 3×; 4 threads, 4 GB reported | 1366 × 768 | `npm run bench:lowend`          |
| WebKit                    | Headless, no Metal                      | AMD Ryzen 9 8940HX                     | 1440 × 900 | `npm run bench:webkit`          |

- **Browser.** Chrome for every profile except WebKit, which is WebKit 26
  through Playwright 1.56.
- **Cold and warm.** Cold is a fresh browser profile: a first visit with no
  shader cache. Warm (`WARM=1`) reuses a profile primed by one visit.
- **Why the Radeon 610M.** It is a two-compute-unit GPU, slower than the
  integrated graphics in most mid-range laptops (Intel Iris Xe, Radeon
  660M/680M, Apple M-series), so it stands in for the low end of the range.
- **Why the budget laptop is simulated.** A threefold CPU slowdown puts this
  CPU roughly at an entry-level laptop's. It is also run at a sixfold
  slowdown, below an entry-level Intel N-series CPU, as the floor.
- **What WebKit shows.** Playwright's WebKit is Safari's engine, not Safari
  on macOS. It checks that the page loads and renders correctly and what the
  CPU side costs; it is not a frame-rate figure for Safari on a Mac.

## Summary

| Measure                    | Result                                                    | Profile                   |
| -------------------------- | --------------------------------------------------------- | ------------------------- |
| First paint, layout shift  | 0.5 s, 0                                                  | Discrete GPU              |
| Scene on screen            | 2.7 s warm, 3.7 s cold                                    | Discrete GPU              |
| Frame cost at full quality | 4.4 ms CPU, 4.7 ms GPU (60 fps budget: 16.7 ms)           | Discrete GPU              |
| Frame rate                 | 50 fps at rest, 74 fps in flight                          | Integrated GPU            |
| Frame rate while in use    | 38–71 fps; every input answered within 120 ms             | Budget laptop (simulated) |
| Lighthouse 12, desktop     | Performance 73–77; Accessibility, Best practices, SEO 100 | Discrete GPU              |

## Loading

| Profile                         | Scene on screen | Total blocking time | Longest task |
| ------------------------------- | --------------- | ------------------- | ------------ |
| Discrete GPU, warm              | 2.7 s           | 168 ms              | 127 ms       |
| Discrete GPU, cold              | 3.7 s           | 416 ms              | 185 ms       |
| Integrated GPU, cold            | 4.1 s           | 623 ms              | 267 ms       |
| Integrated GPU, slow CPU, cold  | 7.4 s           | 3.0 s               | 547 ms       |
| Budget laptop (simulated), cold | 6–7 s           | not measured        | not measured |
| WebKit, cold                    | 5.9 s           | not reported        | not reported |

The loading screen is real content (the title and a live progress line), so
the page paints in 0.5 s and the wait reads as part of the piece.
Playwright's WebKit on Windows has no OffscreenCanvas, so it paints the
textures on the main thread. Safari 16.4 and later supports OffscreenCanvas
and should paint them in workers as Chrome does; this is not yet measured.

Lighthouse 12, desktop preset, cold: Performance 73–77, Accessibility 100,
Best practices 100, SEO 100. First contentful paint 0.5 s, largest
contentful paint 0.7 s, layout shift 0. (PageSpeed Insights runs without a
GPU, so its scores for a WebGL page say little about real visitors.)

## Frame cost

On a fast GPU the display's refresh rate caps the frame rate, so this
section reports the cost of a frame instead. CPU is the whole frame
callback; GPU is measured with `EXT_disjoint_timer_query_webgl2`. Medians
over 300 frames, at rest on the arrival view and during the drone flight up
the tower.

### Discrete GPU

At full quality (1.75× pixel ratio cap, bloom, 4× MSAA):

| Per frame    | CPU    | GPU    |
| ------------ | ------ | ------ |
| At rest      | 4.4 ms | 4.7 ms |
| Drone flight | 3.1 ms | 3.1 ms |

CPU and GPU work in parallel, so each is compared with the 16.7 ms budget
for 60 fps on its own: both use under a third of it.

### Integrated GPU

The quality governor (below) steps the Radeon 610M down to its lowest level
within about 10 s of the scene appearing. From then on:

| Lowest quality level        | CPU     | GPU     | Frame rate |
| --------------------------- | ------- | ------- | ---------- |
| At rest                     | 4.1 ms  | 17.5 ms | 50 fps     |
| Drone flight                | 3.3 ms  | 14.7 ms | 74 fps     |
| At rest, slow CPU (4×)      | 24.4 ms | n/a     | 38 fps     |
| Drone flight, slow CPU (4×) | 17.8 ms | n/a     | 50 fps     |

GPU timer queries are distorted by CPU throttling, so the slow-CPU rows give
CPU time and frame rate only. On this GPU the costliest parts of a frame are
multisampling (about 30 % of GPU time at full quality), the tower, and the
season-shaded terrain.

### Budget laptop (simulated)

Ranges over three runs. The page starts at quality level 2 on the low-spec
hint, and the governor reaches level 4 about 7 s after the scene appears.

| Moment                      | Frame rate | Worst frame                    |
| --------------------------- | ---------- | ------------------------------ |
| Intro, first 6 s            | 26–37 fps  |                                |
| Intro, 6–12 s               | 45–56 fps  |                                |
| Drag to untwist             | 38–43 fps  | 37–43 ms                       |
| Season change, snow on      | 39–53 fps  | 33–53 ms                       |
| Drone flight up the tower   | 49–71 fps  | 37–70 ms                       |
| Click a window, Space       | 43–48 fps  | 33–97 ms                       |
| Slowest input to next frame |            | 48 ms (keys), 120 ms (pointer) |

With the CPU slowed sixfold the study stays usable but not smooth: about
20 fps once settled and 13–15 fps in the intro. The main thread, with
three.js issuing 330–750 draw calls, is the limit.

### WebKit

A frame costs 6 ms of CPU at rest and 5 ms in flight (WebKit's timer
resolution is 1 ms). The headless build paces frames at about 40 fps
whatever the load, so the governor also steps down there. The lit house,
seasons, snow and drone flight all render correctly.

## Scene and payload

| Scene                | Value                        |
| -------------------- | ---------------------------- |
| Draw calls per frame | 348–787                      |
| Triangles per frame  | 0.62–1.08 million            |
| Static meshes        | 965 merged into 373          |
| Real lights          | 6, one shadow map drawn once |

| Download (gzip)               | Size    | When                           |
| ----------------------------- | ------- | ------------------------------ |
| HTML, with the CSS inlined    | 6.5 KB  | Before the scene starts        |
| JavaScript (three.js ~176 KB) | ~282 KB | Before the scene starts        |
| Font                          | 48 KB   | Before the scene starts        |
| Scanned textures              | 3.0 MB  | Streamed after the scene shows |
| Night ambience                | 0.6 MB  | Streamed after the scene shows |

About 340 KB loads before the scene starts; the textures and sound never
block it. Below desktop size the page downloads only the HTML, the font and
two small scripts (under 2 KB).

## How it stays fast

**Loading**

- The font is preloaded from the HTML, and every JavaScript chunk is
  preloaded by a small inline script on a desktop-sized window, so nothing
  is discovered late (its hash is in the Content Security Policy).
- 86 texture maps are painted in Web Workers on OffscreenCanvas instead of on
  the main thread.
- The build yields to the browser every 30 ms, so the loading screen stays
  responsive.
- Shaders compile in parallel (`KHR_parallel_shader_compile`), and two hidden
  warm-up frames run before the scene is shown.

**Every frame**

- Static meshes sharing a material are merged; repeated parts are instanced.
- Shadows are drawn once; nothing that casts one moves.
- About six real lights; everything else is emissive and dimmed by one uniform.
- The mirror pool reflects only large forms and lights, and refreshes every
  other frame while the camera is still.
- World matrices are updated once per frame, not once per render pass.
- The canvas itself has no MSAA; the composer's HDR target carries it.
- Adaptive quality: five levels, each trading the least-visible cost first.

  | Level | Pixel ratio cap | Bloom | Mirror resolution, refresh | MSAA |
  | ----- | --------------- | ----- | -------------------------- | ---- |
  | 0     | 1.75            | on    | 0.5, every frame           | 4×   |
  | 1     | 1.35            | on    | 0.5, every frame           | 4×   |
  | 2     | 1.0             | off   | 0.35, every 2nd frame      | 4×   |
  | 3     | 0.8             | off   | 0.25, every 4th frame      | 2×   |
  | 4     | 0.7             | off   | 0.25, every 4th frame      | off  |

  Devices reporting four or fewer threads or 4 GB of memory start at
  level 2, so the intro is smooth from its first frame. The governor drops
  one level after 1.5 s of frames averaging over 22 ms (two levels over
  40 ms), and never steps back up, so nothing flickers between levels.

- After 6 s without input or motion, drawing drops to about 30 fps.
- Sound costs nothing until it can be heard. Opening the audio device and
  building the reverb take about 100 ms of main thread, so they wait for
  the first click or key, and a visitor who mutes first never pays them.
- A click on a window tests for blockers only up to that room's distance,
  so meshes behind it are skipped by their bounding spheres.
- A window shrunk below desktop size stops the frame loop and suspends the
  sound until it is large again.

## Reproducing

```bash
npm run build
```

```bash
npm run bench
```

Variants: `WARM=1` for repeat visits, `LOW_GPU=1` for the integrated GPU on a
machine with two, `CPU=4` for CPU throttling, `RUNS=n` for more runs. The
budget-laptop run (`CPU`, `W` and `H` set its slowdown and window):

```bash
npm run bench:lowend
```

For WebKit, install it once with `npx playwright install webkit`, then:

```bash
npm run bench:webkit
```

For a closer look, run `npm run preview` and open the page with `?debug` for
per-step build timings in the console and the DevTools Performance panel.

## Still open

- Measure Safari on a Mac with a mid-range GPU; the WebKit run above checks
  correctness and CPU cost only.
- 15 shader programs (shadow, mirror, post-processing) still compile in one
  ~185 ms task on a first visit.
- A fast CPU with weak integrated graphics gets no low-spec hint, so the
  governor takes about 10 s to reach its level; recognising the GPU from its
  renderer string would shorten that.
- On the slowest CPUs the draw-call count is the limit; a lowest level that
  drops the furnished interiors on distant floors would help there.
- Clicking a window still costs about 6 ms of ray tests against the merged
  tower; a bounding-volume hierarchy would make it near free.
- KTX2 textures would cut download size and GPU memory compared with WebP.
- A trimmed three.js build could save about 73 KB.
