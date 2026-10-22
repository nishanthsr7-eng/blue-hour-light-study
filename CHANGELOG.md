# Changelog

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-10-22

First public release.

- The light study of Lantern House: an 18:56 → 00:40 timeline, ten furnished
  floors, a penthouse, four seasons, rain and snow, untwist, a drone flight
  and sound built on a recorded night ambience.
- Seasons with their own character: white-to-pink spring blossom with fallen
  petals, denser summer crowns with a warm horizon haze, greyed bark and
  fascia grime outside spring, and a cratered moon whose halo is strongest
  in winter. The season button shows a cycle icon and its S key.
- A modular build in 39 ES modules, with textures painted in Web Workers,
  a time-sliced scene build and shaders compiled in parallel.
- Adaptive quality over five levels, the lowest without multisampling for
  integrated GPUs, with a governor that steps down after 1.5 s of slow
  frames. Low-spec devices start at level 2. An idle loop.
- Desktop only: below a 1024 × 540 window, or on a touch-only device, the
  page shows a one-line notice and downloads none of the scene.
- `npm run bench`, `npm run bench:lowend`, `npm run bench:webkit` and
  `npm run record` (the season loop video).
- SEO and sharing tags, a strict Content Security Policy, and CI for lint,
  format and build.
