/* The scene is built in this order, one module at a time, then the frame
   loop starts (core/loop.js). Several steps pause part-way to let the
   loading screen paint (yieldToBrowser in core/util.js); importing them one
   after another keeps the build order exact even across those pauses. */
import { DEBUG, debug } from './core/util.js';

const STEPS = {
  'textures/procedural': () => import('./textures/procedural.js'),
  'core/scene': () => import('./core/scene.js'),
  'textures/scanned': () => import('./textures/scanned.js'),
  'world/materials': () => import('./world/materials.js'),
  'world/geometry': () => import('./world/geometry.js'),
  'world/kit': () => import('./world/kit.js'),
  'tower/base': () => import('./tower/base.js'),
  'tower/slab': () => import('./tower/slab.js'),
  'tower/rooms': () => import('./tower/rooms.js'),
  'tower/furniture': () => import('./tower/furniture.js'),
  'tower/floors': () => import('./tower/floors.js'),
  'tower/penthouse': () => import('./tower/penthouse.js'),
  'tower/trees': () => import('./tower/trees.js'),
  'world/ground': () => import('./world/ground.js'),
  'world/atmosphere': () => import('./world/atmosphere.js'),
  'core/camera': () => import('./core/camera.js'),
  'study/audio': () => import('./study/audio.js'),
  'study/light-study': () => import('./study/light-study.js'),
  'study/untwist': () => import('./study/untwist.js'),
  'study/windows': () => import('./study/windows.js'),
  'ui/timebar': () => import('./ui/timebar.js'),
  'ui/orbit': () => import('./ui/orbit.js'),
  'study/rain': () => import('./study/rain.js'),
  'study/seasons': () => import('./study/seasons.js'),
  'ui/controls': () => import('./ui/controls.js'),
  'core/optimize': () => import('./core/optimize.js'),
  'core/loop': () => import('./core/loop.js'),
};

const timings = [];
for (const [name, load] of Object.entries(STEPS)) {
  const t = performance.now();
  await load();
  timings.push([name, Math.round(performance.now() - t)]);
  if (DEBUG) performance.measure(`build ${name}`, { start: t }); // shows in DevTools' Timings track
}
debug(`[perf] build steps (ms): ${timings.map(([n, ms]) => `${n} ${ms}`).join(', ')}`);
