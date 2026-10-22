import * as THREE from 'three';
import { clamp01, REDUCED, smooth01, smoother, TAU } from './util.js';
import { bloom, camera, composer, renderer, STARS } from './scene.js';
import { haloMats } from '../world/kit.js';
import { anchors, FLOOR } from '../tower/base.js';
import { FH, L1, TOP } from '../tower/slab.js';
import { FLOOR_SPECS } from '../tower/rooms.js';

/* ════════════════════════════════════════════════════════════════════════
   Camera: settles in, slow sway, pointer lean; scroll walks you up the
   approach to the canopy.
   ════════════════════════════════════════════════════════════════════════ */

/* Adaptive quality, so the study stays smooth beyond fast laptops. Each step
   trades the least-visible cost first: pixel density, then bloom, then the
   mirror pool's reflection resolution, then multisampling (the largest cost
   on an integrated GPU; foliage edges get harder). Low-spec hints (four or fewer
   threads, or 4 GB of memory) start two steps down, so the intro is smooth;
   the governor in frame() steps down further only on sustained slow frames,
   and never back up (no visible oscillation). */
export const QUALITY = [
  { pr: 1.75, bloom: true, mirror: 0.5, mirrorEvery: 1, msaa: 4 },
  { pr: 1.35, bloom: true, mirror: 0.5, mirrorEvery: 1, msaa: 4 },
  { pr: 1.0, bloom: false, mirror: 0.35, mirrorEvery: 2, msaa: 4 },
  { pr: 0.8, bloom: false, mirror: 0.25, mirrorEvery: 4, msaa: 2 },
  { pr: 0.7, bloom: false, mirror: 0.25, mirrorEvery: 4, msaa: 0 },
];
// The mirror pool redraws the whole scene for its reflection: the biggest CPU
// cost per frame. Lower levels refresh it every 2nd / 4th frame; a still pool
// reflecting a slow scene hides the difference. While the camera is still,
// the reflection has no parallax to keep up with, so it refreshes at half that rate.
{
  const reflect = anchors.mirror.onBeforeRender;
  let n = 0;
  anchors.mirror.onBeforeRender = function (...args) {
    const every = QUALITY[qLevel].mirrorEvery * (cameraMoving() ? 1 : 2);
    if (n++ % every === 0) reflect.apply(this, args);
  };
}
export let qLevel = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4 ? 2 : 0;
export function setQuality(level) {
  qLevel = Math.min(level, QUALITY.length - 1);
  bloom.enabled = QUALITY[qLevel].bloom;
  for (const rt of [composer.renderTarget1, composer.renderTarget2]) {
    if (rt.samples === QUALITY[qLevel].msaa) continue;
    rt.samples = QUALITY[qLevel].msaa;
    rt.dispose(); // reallocated at the new sample count on the next render
  }
  resize();
}
function resize() {
  const Q = QUALITY[qLevel];
  const pr = Math.min(devicePixelRatio || 1, Q.pr);
  renderer.setPixelRatio(pr);
  STARS.material.uniforms.uPx.value = pr;
  renderer.setSize(innerWidth, innerHeight, false);
  composer.setPixelRatio(pr);
  composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  anchors.mirror
    .getRenderTarget()
    .setSize(Math.round(innerWidth * pr * Q.mirror), Math.round(innerHeight * pr * Q.mirror));
  const k = (innerHeight * pr) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  haloMats.forEach((m) => {
    m.uniforms.uScale.value = k;
  });
}
addEventListener('resize', resize);
setQuality(qLevel);

const pointer = new THREE.Vector2(),
  eased = new THREE.Vector2(),
  easedV = new THREE.Vector2(); // easedV: lean spring velocity
addEventListener('pointermove', (e) =>
  pointer.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1)),
);

let zoom = 0,
  zoomTarget = 0;

const VIEW = new URLSearchParams(location.search).get('view') || location.hash.slice(1) || null; // ?view=level, floor0–9, core, penthouse or tower frame a close-up
const camLook = new THREE.Vector3();

// The ride, bottom to top: arrival, the canopy, each floor's terrace corner, the pool deck.
const STOPS = [
  { name: 'Lantern House · Arrival', h: 1 },
  { name: 'Entrance · Oak canopy', h: 1 },
  ...[...FLOOR_SPECS]
    .sort((a, b) => a.i - b.i)
    .map(({ i, name }) => ({
      name: `Level ${String(i + 1).padStart(2, '0')}${name ? ` · ${name}` : ''}`,
      h: L1 + FH * i,
      floor: i,
    })),
  { name: 'Penthouse · Pool deck', h: TOP },
];
const _pA = new THREE.Vector3(),
  _lA = new THREE.Vector3();
const hudName = document.getElementById('hudName'),
  hudH = document.getElementById('hudH');
let hudStop = null;

/* Drone orbit. One continuous spiral round the whole world with the tower
   always at its centre: it sets off low and wide over the meadow, closes in
   past the entrance, then circles a full turn while it climbs, and finishes
   above the crown facing the moon (MOON_AZ) for the last shot. Scroll is
   the only clock: u = 0 → 1, no stops or dwells, so every scroll tick moves
   the camera by the same small amount. */
const ORBIT = {
  a0: 0.85,
  turn: TAU + 0.17, // start angle (moon over the left shoulder) and sweep: one revolution, ending on the moon
  h0: 2.6,
  h1: TOP + 6.5, // camera height, meadow → just above the crown
  look0: 9,
  look1: TOP + 2.5, // aim point on the tower's axis
};
function orbitPose(u, pos, look) {
  // Angle: an easy start and finish on top of a steady turn.
  const ang = ORBIT.a0 + ORBIT.turn * (0.45 * u + 0.55 * smoother(u, 0, 1));
  // Radius: wide enough that the tower reads whole against the land and sky,
  // swinging furthest out mid-climb and drawing in again for the crown.
  const R = 60 + 16 * Math.sin(Math.PI * smoother(u, 0, 1)) - 6 * smooth01(u, 0.8, 1);
  const h = ORBIT.h0 + (ORBIT.h1 - ORBIT.h0) * smoother(u, 0.03, 0.97);
  // The aim leads the camera slightly: looking up the tower while low, level at the top.
  const ly = ORBIT.look0 + (ORBIT.look1 - ORBIT.look0) * smooth01(u, 0.0, 0.9);
  look.set(0, ly, 0);
  pos.set(Math.sin(ang) * R, h, Math.cos(ang) * R);
  return ang;
}
// Height at u, for the rail ticks and the HUD's level name (h only depends on u).
const orbitH = (u) => ORBIT.h0 + (ORBIT.h1 - ORBIT.h0) * smoother(u, 0.03, 0.97);
const uAtH = (h) => {
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    if (orbitH(m) < h) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
};
// Where each named level is passed: eye height just above its floor.
export const MARKS = STOPS.map((st, k) => ({
  ...st,
  zone: k <= 1 ? 0 : st.floor != null ? 1 + st.floor : 11,
  u: k === 0 ? 0 : k === 1 ? uAtH(4.2) : st.floor != null ? uAtH(st.h + 1.7) : 1,
}));
let roll = 0,
  prevAng = null;
export const LIFT_ROUTE = [4, -1, 6, 2, 9, 0, 7, 3, 8, 5, 1]; // floors the cabin visits in turn (−1 = lobby); tt = 0 parks it at Level 05

// The document's height is the flight; native scroll drives it.
history.scrollRestoration = 'manual';
const trackEl = document.getElementById('track');
trackEl.style.height = '1100vh';
const maxScroll = () => Math.max(1, document.documentElement.scrollHeight - innerHeight);
const onScroll = () => {
  zoomTarget = clamp01(scrollY / maxScroll());
};
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);
const goU = (u) => scrollTo({ top: u * maxScroll(), behavior: REDUCED ? 'auto' : 'smooth' });
addEventListener('keydown', (e) => {
  // Arrow / Page keys glide to the next named level: Up climbs the tower, Down descends.
  const d = ['ArrowUp', 'PageUp'].includes(e.key) ? 1 : ['ArrowDown', 'PageDown'].includes(e.key) ? -1 : 0;
  if (!d) return;
  e.preventDefault();
  const next =
    d > 0 ? MARKS.find((m) => m.u > zoomTarget + 0.004) : [...MARKS].reverse().find((m) => m.u < zoomTarget - 0.004);
  if (next) goU(next.u);
});
// Flight rail: a progress line with a tick where each level is passed; ticks jump there.
const railEl = document.getElementById('rail');
railEl.innerHTML =
  MARKS.map(
    (m, k) =>
      `<button class="rail__stop" data-k="${k}" style="bottom:${(m.u * 100).toFixed(2)}%" aria-label="${m.name}"><span>${k === 0 ? 'Ground' : k === 1 ? 'Entry' : m.floor != null ? `L${String(m.floor + 1).padStart(2, '0')}` : 'Crown'}</span></button>`,
  ).join('') + '<i class="rail__dot"></i>';
export const railStops = [...railEl.querySelectorAll('.rail__stop')],
  railDot = railEl.querySelector('.rail__dot');
railEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.rail__stop');
  if (btn) goU(MARKS[+btn.dataset.k].u);
});

/* One camera move per drawn frame: pointer lean, the scroll flight, the
   ?view close-ups and the drone's roll, plus the HUD and rail that read it.
   `el` is seconds since the veil lifted; `orbitYaw` comes from orbit.js. */
export function updateCamera(t, el, dt, orbitYaw) {
  // Pointer lean on a slightly under-damped spring: it glides, then settles
  // with a hint of overshoot, like a camera on a fluid head.
  if (REDUCED) eased.copy(pointer);
  else {
    easedV.x += ((pointer.x - eased.x) * 9 - easedV.x * 4.6) * dt;
    easedV.y += ((pointer.y - eased.y) * 9 - easedV.y * 4.6) * dt;
    eased.addScaledVector(easedV, dt);
  }
  // Frame-rate independent damping: scroll steers, the drone eases after it.
  zoom += (zoomTarget - zoom) * (REDUCED ? 1 : 1 - Math.exp(-dt * 4.5));
  const u = zoom;
  // Opening dolly: fast off the mark, long expo glide into the rest pose.
  const settle = Math.pow(1 - Math.min(el / 5.5, 1), 3);
  // Once settled, a barely-there breathing push-in so the frame never freezes.
  const breathe = REDUCED ? 0 : (1 - Math.cos(t * 0.09)) * 0.012 * (1 - settle);
  const sway = (REDUCED ? 0 : Math.sin(t * 0.05) * 0.06) + eased.x * 0.08 + orbitYaw;
  orbitPose(u, _pA, _lA);
  _pA.sub(_lA).applyAxisAngle(camera.up, sway); // drift round the subject
  // Opening dolly-in: push in across the ground, never down through it, and
  // settle from a little above the rest height.
  const k = 1 + settle * 0.5 - breathe;
  _pA.x *= k;
  _pA.z *= k;
  _pA.add(_lA);
  _pA.y += settle * 6;
  if (!REDUCED) _pA.y += Math.sin(t * 0.8) * 0.06 + Math.sin(t * 1.9 + 1.0) * 0.025; // rotor hover
  camera.position.copy(_pA);
  camera.position.y += eased.y * 1.5;
  camLook.copy(_lA);
  camLook.x += eased.x * 0.8;
  camLook.y += eased.y * 0.6;
  // HUD: the level the drone is passing, and its live altitude.
  let cur = MARKS[0];
  for (const m of MARKS) if (u >= m.u - 0.004) cur = m;
  if (cur !== hudStop) {
    hudStop = cur;
    hudName.textContent = cur.name;
    railStops.forEach((btn) => btn.classList.toggle('is-on', MARKS[+btn.dataset.k] === cur));
  }
  const alt = `+${Math.max(camera.position.y - FLOOR, 0).toFixed(1)}`;
  if (VIEW == null && hudH.textContent !== alt) hudH.textContent = alt;
  railDot.style.transform = `translateY(${-u * railEl.clientHeight}px)`;
  // ?view=level (= floor0) … ?view=floor9: eye height on that floor's terrace corner.
  const fv = VIEW === 'level' ? 0 : /^floor\d$/.test(VIEW ?? '') ? +VIEW.slice(5) : -1;
  if (fv >= 0) {
    // Close study of one floor: eye height on its terrace corner.
    const a = 0.75 + eased.x * 0.25 + (REDUCED ? 0 : Math.sin(t * 0.05) * 0.1);
    camLook.set(-1, 9.6 + fv * FH, 0);
    camera.position.set(Math.sin(a) * 21, 11.2 + fv * FH + eased.y * 1.5, Math.cos(a) * 21);
  }
  if (VIEW === 'tower') {
    // The whole stack, plinth to beacon.
    const a = 0.7 + eased.x * 0.25 + (REDUCED ? 0 : Math.sin(t * 0.05) * 0.1);
    camLook.set(0, 27, 0);
    camera.position.set(Math.sin(a) * 110, 30 + eased.y * 2, Math.cos(a) * 110);
  }
  if (VIEW === 'core') {
    // The core's back face: lift shaft, fin screen and floor bands.
    const a = Math.PI + 0.35 + eased.x * 0.25 + (REDUCED ? 0 : Math.sin(t * 0.05) * 0.06);
    camLook.set(0, 20, -9);
    camera.position.set(Math.sin(a) * 34, 16 + eased.y * 2, -9 + Math.cos(a) * 34);
  }
  if (VIEW === 'penthouse') {
    // The hero shot: just above the pool deck, looking across the vanishing edge.
    const a = 0.95 + eased.x * 0.25 + (REDUCED ? 0 : Math.sin(t * 0.05) * 0.1);
    camLook.set(0, TOP + 3.2, -1);
    camera.position.set(Math.sin(a) * 30, TOP + 9 + eased.y * 1.5, Math.cos(a) * 30);
  }
  camera.lookAt(camLook);
  if (!VIEW) {
    // Bank into the orbit like a drone: roll with the angular speed round the tower.
    const ang = Math.atan2(camera.position.x, camera.position.z);
    let dA = prevAng == null ? 0 : ang - prevAng;
    prevAng = ang;
    dA = Math.atan2(Math.sin(dA), Math.cos(dA)); // across the ±π seam of the full turn
    roll += ((REDUCED ? 0 : THREE.MathUtils.clamp(-dA * 4, -0.045, 0.045)) - roll) * (1 - Math.exp(-dt * 3));
    camera.rotateZ(roll);
  }
  camera.updateProjectionMatrix();

  const fade = VIEW ? 0 : 1 - smooth01(zoom, 0.004, 0.05);
  railEl.style.opacity = 1 - fade;
  railEl.style.visibility = fade > 0.99 ? 'hidden' : 'visible'; // arrives once the flight starts, clear of the notes
}
// Still easing toward the pointer or the scroll target?
export const cameraMoving = () =>
  Math.abs(zoomTarget - zoom) > 1e-4 || eased.distanceToSquared(pointer) > 1e-6 || easedV.lengthSq() > 1e-6;
