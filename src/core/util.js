import * as THREE from 'three';

// Sharpest texture filtering the GPU offers (capped at 16): ground, brick and
// paving stay crisp at grazing angles for almost no frame cost on desktop.
export const MAX_ANISO = (() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl && gl.getExtension('EXT_texture_filter_anisotropic');
    const n = ext ? gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 8;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return Math.min(16, n || 8);
  } catch {
    return 8;
  }
})();

export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Pure helpers live in math.js so the texture worker can share them.
export { mulberry, TAU } from './math.js';

// ?debug in the URL: [perf] lines in the console and the scene on window.blueHour.
export const DEBUG = new URLSearchParams(location.search).has('debug');
export const debug = DEBUG ? (...args) => console.info(...args) : () => {};

// Shaping helpers shared by the camera, the light timeline, rain and the time bar.
export const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
export const smooth01 = THREE.MathUtils.smoothstep,
  smoother = THREE.MathUtils.smootherstep;

/* Building the scene is over a second of main-thread work (painting
   textures, laying out eleven floors, merging meshes). The heavy modules
   `await yieldToBrowser()` between steps: once a ~30 ms slice is spent it
   hands the thread back, so the loading screen keeps painting and input is
   never blocked for long. Between slices it costs one microtask. */
let sliceStart = performance.now();
export function yieldToBrowser() {
  if (performance.now() - sliceStart < 30) return null;
  const next = globalThis.scheduler?.yield ? globalThis.scheduler.yield() : new Promise((r) => setTimeout(r, 0));
  return next.then(() => {
    sliceStart = performance.now();
  });
}
