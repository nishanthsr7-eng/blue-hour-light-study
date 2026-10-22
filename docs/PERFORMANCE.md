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

## Method

Production build at 1440 × 900, measured 2026-10-21. Medians of three runs.

- **Chrome** with `npm run bench`, on a laptop with an RTX 5050 GPU and a
  Ryzen 9 8940HX. **Cold** is a fresh browser profile (a first visit, no
  shader cache); **warm** (`WARM=1`) reuses a profile primed by one visit.
- **Low-end laptop** with the same script, forced onto the laptop's
  integrated AMD Radeon 610M (`LOW_GPU=1`), with and without fourfold CPU
  throttling (`CPU=4`). The 610M is a two-compute-unit GPU, slower than the
  integrated graphics in most mid-range laptops (Intel Iris Xe, Radeon
  660M/680M, Apple M-series), so it stands in for the low end of the range.
- **A budget laptop** with `npm run bench:lowend`: the Radeon 610M, the CPU
  slowed threefold (roughly an entry-level laptop CPU next to this one), a
  1366 × 768 window, and four threads and 4 GB of memory reported to the
  page. It times the intro, every interaction and the input delay. Also run
  at a sixfold slowdown, below a current Celeron, as the floor.
- **Safari's engine** with `npm run bench:webkit`: WebKit 26 through
  Playwright. It is WebKit, not Safari on macOS (no Metal, a headless
  compositor), so it checks that the page loads and runs correctly and what
  the CPU side costs; it is not a frame-rate figure for Safari on a Mac.

## Loading

| Setup                        | Scene on screen | Total blocking time | Longest task |
| ---------------------------- | --------------- | ------------------- | ------------ |
| Chrome, RTX 5050, cold       | 3.7 s           | 416 ms              | 185 ms       |
| Chrome, RTX 5050, warm       | 2.7 s           | 168 ms              | 127 ms       |
| Chrome, Radeon 610M, cold    | 4.1 s           | 623 ms              | 267 ms       |
| Chrome, Radeon 610M, CPU 4×  | 7.4 s           | 3.0 s               | 547 ms       |
| WebKit 26 (Playwright), cold | 5.9 s           | not reported        | not reported |

The loading screen is real content (the title and a live progress line), so
the page paints in 0.5 s and the wait reads as part of the piece. Playwright's
WebKit on Windows has no OffscreenCanvas, so it paints the textures on the
main thread; Safari 16.4 and later paints them in workers like Chrome.

Lighthouse 12, desktop preset, cold: Performance 73–77, Accessibility 100,
Best practices 100, SEO 100. First contentful paint 0.5 s, largest
contentful paint 0.7 s, layout shift 0. (PageSpeed Insights runs without a
GPU, so its scores for a WebGL page say little about real visitors.)

## Running

Cost per frame, since the display's refresh rate caps the frame rate on a
fast GPU. CPU is the whole frame callback; GPU is measured with
`EXT_disjoint_timer_query_webgl2`. Medians over 300 frames, at rest on the
arrival view and during the drone flight up the tower.

| Per frame, Chrome, RTX 5050 | CPU    | GPU    |
| --------------------------- | ------ | ------ |
| At rest                     | 4.4 ms | 4.7 ms |
| Drone flight                | 3.1 ms | 3.1 ms |

About 9 ms of combined work against a 16.7 ms budget at 60 Hz, at full
quality (1.75× pixel ratio cap, bloom, 4× MSAA).

**On integrated graphics.** The quality governor (below) steps the Radeon
610M down to its lowest level within about 10 s of the scene appearing. From
then on:

| Radeon 610M, lowest quality level | CPU     | GPU     | Frame rate |
| --------------------------------- | ------- | ------- | ---------- |
| At rest                           | 4.1 ms  | 17.5 ms | 50 fps     |
| Drone flight                      | 3.3 ms  | 14.7 ms | 74 fps     |
| At rest, CPU throttled 4×         | 24.4 ms | n/a     | 38 fps     |
| Drone flight, CPU throttled 4×    | 17.8 ms | n/a     | 50 fps     |

(GPU timer queries are distorted by CPU throttling, so the throttled rows
give CPU time and frame rate only.) On this GPU the costliest parts of a
frame are multisampling (about 30 % of GPU time at full quality), the tower,
and the season-shaded terrain.

**On a budget laptop** (`npm run bench:lowend`, CPU 3×, 1366 × 768; ranges
over three runs). The page starts at quality level 2 on the low-spec hint,
and the governor reaches level 4 about 7 s after the scene appears.

| Budget laptop               | Frame rate | Worst frame                    |
| --------------------------- | ---------- | ------------------------------ |
| Intro, first 6 s            | 26–37 fps  |                                |
| Intro, 6–12 s               | 45–56 fps  |                                |
| Drag to untwist             | 38–43 fps  | 37–43 ms                       |
| Season change, snow on      | 39–53 fps  | 33–53 ms                       |
| Drone flight up the tower   | 49–71 fps  | 37–70 ms                       |
| Click a window, Space       | 43–48 fps  | 33–97 ms                       |
| Slowest input to next frame |            | 48 ms (keys), 120 ms (pointer) |

The scene appears 6–7 s after navigation. With the CPU slowed sixfold the
study stays usable but not smooth: about 20 fps once settled, 13–15 fps in
the intro, and the main thread (three.js issuing 330–750 draw calls) is the
limit.

**In WebKit**, a frame costs 6 ms of CPU at rest and 5 ms in flight
(WebKit's timer resolution is 1 ms). The headless build paces frames at
about 40 fps whatever the load, so the governor also steps down there; the
lit house, seasons, snow and drone flight all render correctly.

| Scene                | Value                        |
| -------------------- | ---------------------------- |
| Draw calls per frame | 348–787                      |
| Triangles per frame  | 0.62–1.08 million            |
| Static meshes        | 965 merged into 373          |
| Real lights          | 6, one shadow map drawn once |

**Payload (gzip):** HTML 6.5 KB with the CSS inlined, JavaScript ~282 KB
(three.js ~176 KB), font 48 KB: about 340 KB before the scene starts.
Scanned textures (3.0 MB) and the night ambience (0.6 MB) stream in after the
scene appears and never block it. Below desktop size the page downloads only
the HTML, the font and two small scripts (under 2 KB).

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
  the first unmute (Mute or M) rather than the first click.
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

- Confirm frame rate on Safari on a Mac with a mid-range GPU; the WebKit run
  above checks correctness and CPU cost only.
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
