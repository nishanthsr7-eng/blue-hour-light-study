import * as THREE from 'three';
import { DEBUG, debug, REDUCED, smoother } from './util.js';
import { camera, composer, grade, renderer, scene, skyMat } from './scene.js';
import { anchors, FLOOR } from '../tower/base.js';
import { FH, L1 } from '../tower/slab.js';
import { flowMats } from '../tower/penthouse.js';
import { mist, motes } from '../world/ground.js';
import { airMotes, WIND } from '../world/atmosphere.js';
import { cameraMoving, LIFT_ROUTE, qLevel, QUALITY, setQuality, updateCamera } from './camera.js';
import { lightUp, peopleStep, ZONE } from '../study/light-study.js';
import { twistStep } from '../study/untwist.js';
import { scrub, updateTimebar } from '../ui/timebar.js';
import { orbitStep, orbitYaw } from '../ui/orbit.js';
import { rainStep } from '../study/rain.js';
import { seasonStep } from '../study/seasons.js';
import { loadProgress } from '../ui/veil.js';
import { sound } from '../study/audio.js';
import { NOT_DESKTOP } from './desktop.js';

/* The frame loop, the warm-up behind the veil, and the quality governor.
   Imported last (app.js), once every part of the scene exists. */

let t0 = performance.now() / 1000,
  lastT = null; // t0 resets when the veil lifts (see warmUp)

// A window shrunk below desktop size hides the scene (main.css); stop drawing
// and hold the sound until it is large again.
const small = matchMedia(NOT_DESKTOP);

function frame(now) {
  if (small.matches) {
    lastT = null;
    sound.hold(true);
    small.addEventListener(
      'change',
      () => {
        sound.hold(false);
        requestAnimationFrame(frame);
      },
      { once: true },
    );
    return;
  }
  const t = now / 1000,
    el = REDUCED ? 99 : t - t0;

  const dt = lastT == null ? 1 / 60 : Math.min((now - lastT) / 1000, 0.1);
  lastT = now;
  const orbiting = orbitStep(dt);
  updateCamera(t, el, dt, orbitYaw);

  const tt = REDUCED ? 0 : t;
  const lighting = lightUp(dt);
  const twisting = twistStep(dt);
  const raining = rainStep(dt, tt);
  const seasoning = seasonStep(dt, tt);
  peopleStep(tt);
  updateTimebar();
  anchors.mirror.material.uniforms.uTime.value = tt;
  motes.uniforms.uTime.value = tt;
  skyMat.uniforms.uTime.value = tt;
  WIND.value = tt;
  airMotes.uniforms.uTime.value = tt;
  for (const m of flowMats) m.uniforms.uTime.value = tt;
  // The lift: 7 s between floors on a seeded itinerary, then a 6 s dwell; parked when motion is reduced.
  {
    const deck = (f) => (f < 0 ? FLOOR : L1 + FH * f + 0.45) + 0.02;
    const leg = Math.floor(tt / 13),
      ph = tt - leg * 13,
      from = LIFT_ROUTE[leg % LIFT_ROUTE.length],
      to = LIFT_ROUTE[(leg + 1) % LIFT_ROUTE.length];
    anchors.lift.position.y = deck(from) + (deck(to) - deck(from)) * smoother(ph, 6, 13);
  }
  // Aviation beacon: a slow pulse, held steady under reduced motion.
  anchors.beacon.material.opacity =
    (REDUCED ? 1 : 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(t * 2.6), 6)) * ZONE.value[12];
  for (const s of mist) s.position.x = s.userData.x0 + Math.sin(tt * 0.02 * s.userData.v + s.userData.ph) * 8;

  // Idle: once the camera has settled and nobody has touched the page for 6 s,
  // drop to ~30 fps; only slow ambient motion (water, mist, beacon) is left to draw.
  const moving = cameraMoving() || el < 6 || lighting || twisting || orbiting || raining || seasoning || !!scrub;
  if (moving) lastInput = now;
  const idle = now - lastInput > 6000;
  if (!idle || now - lastDraw > 32) {
    grade.uniforms.uTime.value = (now * 0.001) % 100;
    scene.updateMatrixWorld();
    composer.render();
    // Governor: a slow-frame streak (~1.5 s above 22 ms while active) drops one quality step,
    // two when frames average over 40 ms, so a weak laptop reaches its level sooner.
    if (!idle && lastDraw && el > 3) {
      gov.ema += (now - lastDraw - gov.ema) * 0.05;
      gov.slow = gov.ema > 22 ? gov.slow + (now - lastDraw) : 0;
      if (gov.slow > 1500 && qLevel < QUALITY.length - 1) {
        setQuality(qLevel + (gov.ema > 40 ? 2 : 1));
        gov.slow = 0;
        gov.ema = 16;
        debug(`[perf] quality step ${qLevel}`);
      }
    }
    lastDraw = now;
    if (perf.n < 300 && perf.prev) {
      perf.sum += now - perf.prev;
      perf.n++;
      if (perf.n === 300)
        debug(
          `[perf] first frame ${perf.first.toFixed(0)} ms after navigation; mean frame interval ${(perf.sum / 300).toFixed(2)} ms over 300 frames`,
        );
    }
    perf.first ??= now;
    perf.prev = now;
  }
  requestAnimationFrame(frame);
}
let lastInput = 0,
  lastDraw = 0;
const perf = { n: 0, sum: 0, prev: 0, first: null };
addEventListener('pointerdown', () => {
  lastInput = performance.now();
});
const gov = { ema: 16, slow: 0 };

/* Warm-up behind the veil: the first visible frame must not be the one that
   pays for every shader compile and texture upload (several seconds, unwarmed).
   1. Upload textures a few per frame, within an ~8 ms budget, so the page stays responsive.
   2. Compile every program in parallel (KHR_parallel_shader_compile where available).
   3. Draw two hidden frames to warm the shadow, depth and post-processing programs.
   Then lift the veil and start the intro clock. Capped at 10 s on very slow devices. */
async function warmUp() {
  const deadline = performance.now() + 10000;
  const nextFrame = () => new Promise((r) => requestAnimationFrame(r));
  const texs = new Set();
  const grab = (v) => {
    if (v?.isTexture && v.image && !v.isRenderTargetTexture) texs.add(v);
  };
  scene.traverse((o) => {
    for (const m of [o.material].flat()) {
      if (!m) continue;
      for (const k in m) grab(m[k]);
      if (m.uniforms) for (const u of Object.values(m.uniforms)) grab(u.value);
    }
  });
  const queue = [...texs],
    total = queue.length || 1;
  while (queue.length && performance.now() < deadline) {
    const start = performance.now();
    while (queue.length && performance.now() - start < 8) renderer.initTexture(queue.pop());
    loadProgress(0.3 + 0.35 * (1 - queue.length / total), 'Preparing materials');
    await nextFrame();
  }
  loadProgress(0.7, 'Compiling light');
  await nextFrame();
  if (performance.now() < deadline) await renderer.compileAsync(scene, camera).catch(() => {});
  loadProgress(0.92, 'Setting the scene');
  const compiled = renderer.info.programs.length;
  for (let i = 0; i < 2; i++) {
    scene.updateMatrixWorld();
    composer.render();
    await nextFrame();
  }
  debug(
    `[perf] shader programs: ${compiled} compiled in parallel, ${renderer.info.programs.length - compiled} more in the warm-up frames`,
  );
  loadProgress(1, 'Ready');
}
warmUp().then(() => {
  t0 = performance.now() / 1000;
  lastT = null;
  debug(`[perf] veil lifted ${performance.now().toFixed(0)} ms after navigation`);
  document.getElementById('veil').classList.add('is-off');
  // Interface follows once the camera has mostly landed (instant when motion is reduced).
  setTimeout(() => document.body.classList.remove('is-intro'), REDUCED ? 0 : 2200);
  requestAnimationFrame(frame);
});
if (DEBUG) window.blueHour = { THREE, scene, camera, renderer, composer };
