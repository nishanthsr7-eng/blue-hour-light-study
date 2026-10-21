# Performance

A beautiful effect that stutters is a regression. This page records what the
study costs, how it stays fast, and what is still open.

## Targets

- Smooth at 60 fps or more on an ordinary laptop, idling when nothing moves.
- No long main-thread freezes while the scene builds.
- A fast first paint and zero layout shift.

## Method

Production build in Chrome on an RTX 5050 laptop, 1440 × 900. **Cold** is a
fresh browser profile (a first visit, no shader cache); **warm** is a repeat
visit. Medians of three runs, measured 2026-10-21 with `npm run bench`.
Phones and tablets are out of scope.

## Loading

| Visit | Scene on screen | Total blocking time | Longest task |
| ----- | --------------- | ------------------- | ------------ |
| Cold  | ~2.9 s          | ~275–350 ms         | ~165 ms      |
| Warm  | ~1.9 s          | ~110 ms             | ~100 ms      |

The loading screen is real content (the title over a blurred first frame of
the scene), so the page paints in 0.7 s and the wait reads as part of the
piece.

Lighthouse, desktop, cold: Performance 80–84, Accessibility 100, Best
practices 100, SEO 100. First and largest contentful paint 0.7 s, layout
shift 0. (PageSpeed Insights runs without a GPU, so its scores for a WebGL
page say little about real visitors.)

## Running

Cost per frame rather than frame rate, since the display's refresh rate caps
the rate. CPU is the whole frame callback; GPU is measured with
`EXT_disjoint_timer_query_webgl2`. Medians over 300 frames.

| Per frame    | CPU    | GPU    |
| ------------ | ------ | ------ |
| At rest      | 4.4 ms | 4.6 ms |
| Drone flight | 3.0 ms | 2.8 ms |

About 9 ms of combined work against a 16.7 ms budget at 60 Hz.

| Scene                | Value                        |
| -------------------- | ---------------------------- |
| Draw calls per frame | 350–785                      |
| Triangles per frame  | 0.62–1.07 million            |
| Static meshes        | 965 merged into 373          |
| Real lights          | 6, one shadow map drawn once |

**Payload (gzip):** HTML 7 KB with the CSS inlined, JavaScript ~266 KB (three.js
~177 KB), font 48 KB. Scanned textures (2.85 MB) stream in after the scene
appears and never block it.

## How it stays fast

**Loading**

- The font and every JavaScript chunk are preloaded from the HTML, so nothing
  is discovered late.
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
- The canvas itself has no MSAA, since post-processing already antialiases.
- Adaptive quality steps down pixel ratio, bloom and mirror resolution on
  sustained slow frames, and never back up.
- After 6 s without input or motion, drawing drops to about 30 fps.

## Reproducing

```bash
npm run build
```

```bash
npm run bench
```

For a closer look, run `npm run preview` and open the page with `?debug` for
per-step build timings in the console and the DevTools Performance panel.

## Still open

- 15 shader programs (shadow, mirror, post-processing) still compile in one
  ~165 ms task on a first visit.
- KTX2 textures would cut download size and GPU memory compared with WebP.
- A trimmed three.js build could save about 73 KB.
