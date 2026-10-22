# Changelog

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-10-22

First public release.

### Added

- **The light study.** Lantern House on an 18:56 → 00:40 timeline: ten
  furnished floors and a penthouse that light floor by floor at blue hour,
  then go dark as the night goes on.
- **Interaction.** Drag to untwist the tower, scroll to fly a drone up it,
  click a window to switch that floor, scrub the evening on the time bar,
  and keyboard shortcuts for every control.
- **Seasons and weather.** Autumn, winter, spring and summer as whole-scene
  states, with rain, settling snow, blossom and fireflies.
- **Sound.** A recorded night ambience with synthesised rain, wind and a
  chime for each floor; on by default from the first click or key.
- **Performance.** Textures painted in Web Workers, a time-sliced build,
  parallel shader compilation, adaptive quality over five levels and an
  idle frame rate.
- **Desktop only.** Below a 1024 × 540 window, or on a touch-only device, the
  page shows a one-line notice and downloads none of the scene.
- **Accessibility.** Keyboard access to every control, a text description
  for screen readers, and a designed reduced-motion version.
- **Tooling.** Benchmarks (`npm run bench`, `bench:lowend`, `bench:webkit`),
  screenshot and video capture, and CI for lint, format and build.
- **Hosting.** SEO and sharing tags and a strict Content Security Policy.
