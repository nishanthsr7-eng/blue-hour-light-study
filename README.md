<h1 align="center">Blue Hour: A Light Study</h1>

<p align="center">
  An interactive WebGL study of one building at nightfall: a twisting residential tower<br />
  that switches on, floor by floor, as blue hour turns to night.
</p>

<p align="center">
  <a href="https://blue-hour-light-study.pages.dev"><b>Live demo</b></a> ·
  <a href="docs/CASE_STUDY.md"><b>Case study</b></a> ·
  <a href="docs/DESIGN.md">Design</a> ·
  <a href="docs/ARCHITECTURE.md">Architecture</a> ·
  <a href="docs/PERFORMANCE.md">Performance</a>
</p>

<p align="center">
  <img src="docs/media/arrival.jpg" alt="A white twisting tower at night, its floors lit warm against a deep blue sky, with a moon to the left." width="100%" />
</p>

## About

**Residence 07** is a concept tower: eleven twisting white slabs over a glazed
lobby, ten furnished floors and a penthouse with a pool. The page opens at
18:56 with the house dark. As the sky deepens, the lobby switches on, then a
line of light rises up the lift shaft, the floors light from the bottom up,
and the aviation beacon comes on last. The evening then runs to 00:40, and
floors go dark as the residents turn in.

Light is the only thing that moves the story. The page has no copy beyond a
title, a clock and a count of lit floors.

Built for desktop browsers with a mouse or trackpad. On phones and tablets
the page says so before loading anything heavy.

## Highlights

- **One uniform switches a floor.** Every emitter is dimmed by a zone value
  chosen from its height, so coves, downlights, lamps, rooms and real lights
  on a floor change together. Scrub the evening on the time bar.
- **Traced interiors.** The rooms behind the glass are ray-traced boxes in a
  fragment shader that write real depth, so modelled furniture sits inside
  them. Ten floors, ten different homes, some with residents walking about.
- **Four seasons** as whole-scene states: sky, light, fog, foliage and
  particles. Winter snow settles over the lawn.
- **Interaction:** drag to untwist the slabs on springs, scroll to fly a drone
  up the tower, click a window to switch that floor.
- **Synthesised sound** with Web Audio, off until asked for. No audio files.
- **Fast:** textures painted in Web Workers, a time-sliced build, 965 meshes
  merged into 373, shadows drawn once, adaptive quality and an idle loop.

<table>
  <tr>
    <td><img src="docs/media/flight.jpg" alt="Halfway up the drone flight: the tower's back face with its lit lift shaft." /></td>
    <td><img src="docs/media/crown.jpg" alt="The crown: the penthouse, its floating roof and the red beacon under the moon." /></td>
  </tr>
  <tr>
    <td><img src="docs/media/winter.jpg" alt="Winter: snow falling and settled on the plinth and lawn." /></td>
    <td><img src="public/og-image.jpg" alt="The arrival shot." /></td>
  </tr>
</table>

## Results

Production build in Chrome at 1440 × 900 on an RTX 5050 laptop, medians of
three runs. "Cold" is a first visit with no shader cache; "warm" is a repeat
visit. `npm run bench` reproduces these; methods are in
[PERFORMANCE.md](docs/PERFORMANCE.md).

| Metric                   | Result                                         |
| ------------------------ | ---------------------------------------------- |
| Scene on screen          | ~1.9 s warm, ~2.9 s cold                       |
| Total blocking time      | ~110 ms warm, ~275–350 ms cold                 |
| Longest main-thread task | ~100 ms warm, ~165 ms cold                     |
| CPU / GPU time per frame | 4.4 ms / 4.6 ms (16.7 ms is the 60 fps budget) |
| Draw calls per frame     | 350–785, from 965 meshes merged into 373       |

Lighthouse (desktop, cold): Performance 80–84, Accessibility 100, Best
practices 100, SEO 100. Layout shift 0; first paint 0.7 s.

## Controls

| Input          | Action                                |
| -------------- | ------------------------------------- |
| Drag           | Untwist the tower                     |
| Shift-drag     | Orbit (right-drag works too)          |
| Scroll, ↑ / ↓  | Fly up and down the tower             |
| Click a window | Switch that floor's lights            |
| Space / R      | Pause or play / replay from blue hour |
| Time bar       | Drag to any minute                    |
| S / P / M      | Next season / light pattern / mute    |
| ?              | Show every control                    |

Every animation respects `prefers-reduced-motion`.

## Run it locally

Requires Node.js 20 or newer.

```bash
npm install
```

```bash
npm run dev
```

| Script            | What it does                                               |
| ----------------- | ---------------------------------------------------------- |
| `npm run dev`     | Development server                                         |
| `npm run build`   | Production build into `dist/`                              |
| `npm run check`   | Lint, format check and build (what CI runs)                |
| `npm run bench`   | Load and frame-cost benchmark of `dist/` in Chrome or Edge |
| `npm run capture` | Regenerates the screenshots and social image from `dist/`  |

Add `?debug` to the URL for build timings in the console. Deployment notes are
in [DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Built with

[three.js](https://threejs.org) r170 and plain JavaScript modules, Web Workers
with OffscreenCanvas, the Web Audio API, [Vite](https://vite.dev), and
[Cloudflare Pages](https://pages.cloudflare.com).

## Credits

- Scanned textures: [Poly Haven](https://polyhaven.com), CC0
  ([details](src/assets/textures/README.md)).
- Typeface: [Inter](https://rsms.me/inter/), SIL Open Font License 1.1.

Everything else (geometry, procedural textures, shaders, light, sound and
interface) is original to this project.

## License

Code is [MIT](LICENSE). Third-party assets keep their own licences.
