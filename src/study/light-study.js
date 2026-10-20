import * as THREE from 'three';
import { clamp01, mulberry, REDUCED, smooth01, smoother } from '../core/util.js';
import { state } from '../core/state.js';
import { scene, skyMat } from '../core/scene.js';
import { building } from '../world/kit.js';
import { anchors } from '../tower/base.js';
import { FIG_FLOORS, FLOOR_SPECS, LIGHT_STATES } from '../tower/rooms.js';
import { motes } from '../world/ground.js';
import { airMotes } from '../world/atmosphere.js';
import { MARKS, railStops } from '../core/camera.js';
import { sound } from './audio.js';

/* ════════════════════════════════════════════════════════════════════════
   Light study: blue hour → night, the house switches on
   ════════════════════════════════════════════════════════════════════════ */

/* Every emitter (cove, downlight, lamp, emissive furniture, glow decal, wash,
   halo, traced room, real PointLight) is dimmed by the zone its world height
   falls in, so shared materials need no per-floor clones: one uniform array
   drives the whole switch-on. Zones: 0 ground + lobby, 1–10 the floors, 11 the
   penthouse, 12 the beacon. The lift shaft is its own zone, lit by a line
   rising up the core (ZONE[13] holds that line's height in metres). */
export const ZONE = { value: new Array(14).fill(1) };
const ZONE_GLSL = /* glsl */ `
  uniform float uZone[14];
  float zoneK(float y) {
  #ifdef ZONE_STAIR
    return clamp((uZone[13] - y) / 2.5, 0.0, 1.0);
  #else
    int k = y < 8.2 ? 0 : y >= 56.0 ? 12 : y >= 44.2 ? 11 : 1 + int(floor((y - 8.2) / 3.6));
    return uZone[k];
  #endif
  }`;
const ZONE_Y = /* glsl */ `
  vec4 zP = vec4(ZONE_POS, 1.0);
  #ifdef USE_INSTANCING
    zP = instanceMatrix * zP;
  #endif
  vZoneY = (modelMatrix * zP).y;`;
const zoned = new WeakSet();
function zoneMaterial(m) {
  if (zoned.has(m)) return;
  zoned.add(m);
  const stair = m.userData.zone === 'stair';
  const defs = stair ? '#define ZONE_STAIR\n' : '';
  if (m.isShaderMaterial) {
    if (m === skyMat || m === motes || m === airMotes || m.uniforms.tDiffuse || m.userData.noZone) return; // sky, stars, dust, the mirror
    const additive =
      m.blending === THREE.AdditiveBlending || (m.blending === THREE.CustomBlending && m.blendDst === THREE.OneFactor);
    const room = !!m.uniforms.uLamp; // traced interiors: opaque, fall to night glass
    if (!additive && !room) return;
    m.uniforms.uZone = ZONE;
    const close = (src, body) => {
      const k = src.lastIndexOf('}');
      return src.slice(0, k) + body + '\n}' + src.slice(k + 1);
    };
    m.vertexShader = defs + 'varying float vZoneY;\n' + close(m.vertexShader, ZONE_Y.replace('ZONE_POS', 'position'));
    m.fragmentShader =
      defs +
      'varying float vZoneY;\n' +
      ZONE_GLSL +
      '\n' +
      close(
        m.fragmentShader,
        room ? 'gl_FragColor.rgb *= mix(0.05, 1.0, zoneK(vZoneY));' : 'gl_FragColor.rgb *= zoneK(vZoneY);',
      );
    return;
  }
  const basic = m.isMeshBasicMaterial && m.toneMapped === false;
  const glow = m.isMeshStandardMaterial && m.emissiveIntensity > 0 && m.emissive.getHex() !== 0;
  if (!basic && !glow) return;
  const key = m.customProgramCacheKey() + '|zone' + (stair ? 's' : ''),
    prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    sh.uniforms.uZone = ZONE;
    sh.vertexShader =
      defs +
      sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vZoneY;')
        .replace(
          '#include <project_vertex>',
          '#include <project_vertex>\n' + ZONE_Y.replace('ZONE_POS', 'transformed'),
        );
    sh.fragmentShader =
      defs +
      sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vZoneY;\n' + ZONE_GLSL)
        .replace(
          basic ? '#include <opaque_fragment>' : '#include <emissivemap_fragment>',
          basic
            ? 'outgoingLight *= zoneK(vZoneY);\n#include <opaque_fragment>'
            : '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= zoneK(vZoneY);',
        );
  };
  m.customProgramCacheKey = () => key;
}
const zoneOfY = (y) => (y < 8.2 ? 0 : y >= 56 ? 12 : y >= 44.2 ? 11 : 1 + Math.floor((y - 8.2) / 3.6));
const zoneLights = [],
  zoneSprites = [];
{
  const v = new THREE.Vector3();
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (o.isPointLight)
      zoneLights.push({ o, base: o.intensity, k: o.parent === anchors.lift ? 13 : zoneOfY(o.getWorldPosition(v).y) });
    else if (o.isSprite && o !== anchors.beacon)
      zoneSprites.push({ o, base: o.material.opacity, k: zoneOfY(o.getWorldPosition(v).y) });
    else if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(zoneMaterial);
  });
}

/* The timeline, in seconds from load. Held at blue hour long enough to read
   the tower as a white sculpture, then the sky darkens while the house
   switches on in a set order: lobby, the lift shaft, floors bottom-up, the
   penthouse, and the beacon last. It holds at 19:42 with every floor lit (the
   hero frame). Play again and the night carries on to 00:40: the gym empties,
   the library closes, guests leave, the house goes to bed one floor at a
   time, the lobby drops to its night setting, and the architect's atelier is
   the last window lit. R replays; reduced motion lands on 19:42. */
export const SEQ = {
  dusk: [0.9, 6.8],
  lobby: 1.5,
  stair: [2.1, 3.5],
  floor0: 2.9,
  floorStep: 0.27,
  penthouse: 5.95,
  beacon: 6.7,
  end: 7.6,
  last: 33.6,
};
const CLOCK0 = 18 * 60 + 56,
  CLOCK_NIGHT = 19 * 60 + 42,
  CLOCK_LAST = 24 * 60 + 40;
const atClock = (hm) => {
  const [h, m] = hm.split(':').map(Number),
    mins = (h < 12 ? h + 24 : h) * 60 + m;
  return SEQ.end + ((mins - CLOCK_NIGHT) / (CLOCK_LAST - CLOCK_NIGHT)) * (SEQ.last - SEQ.end);
};
// [zone, time, level it falls to]: 0 is off; the lobby and penthouse keep a night glow.
const LIGHTS_OUT = [
  [7, '20:35', 0],
  [3, '21:20', 0],
  [6, '22:05', 0],
  [1, '22:40', 0],
  [0, '23:00', 0.45],
  [5, '23:05', 0],
  [2, '23:30', 0],
  [10, '23:55', 0],
  [11, '00:20', 0.3],
].map(([k, hm, level]) => ({ k, at: atClock(hm), level }));
export const DUSK_HEMI = { night: new THREE.Color(0x4a5c88), dusk: new THREE.Color(0x8aa0d8) };
export const FOG_NIGHT = new THREE.Color(0x0e1322),
  FOG_DUSK = new THREE.Color(0x3a4a70);
// Zones that read as lit once on: the 'dark' floors stay night glass.
const ZONE_LIT = [true, ...[...FLOOR_SPECS].sort((a, b) => a.i - b.i).map((f) => f.state !== 'dark'), true];
const hudClock = document.getElementById('hudClock'),
  hudRooms = document.getElementById('hudRooms'),
  countN = document.getElementById('countN');
// Values change with a small tick: the floor count rolls up digit by digit,
// stats nudge and flash red once. CSS-only, so it costs nothing per frame.
const hudText = (el, v) => {
  if (el.textContent === v) return;
  const up = el === countN && v > el.textContent;
  el.textContent = v;
  if (REDUCED || !el.isConnected) return;
  el.classList.remove('is-tick', 'is-roll');
  void el.offsetWidth;
  el.classList.add(up ? 'is-roll' : 'is-tick');
};
const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);
const switchOn = (t, at) => easeOut((t - at) / 0.5);
const switchOff = (t, at) => easeOut((t - at) / 0.3); // a switch flicked off is quicker than a room warming up
// The timeline's own clock: plays from load, holds at 19:42, pauses (Space), scrubs (time bar), replays (R).
export const seq = { t: REDUCED ? SEQ.end : 0, playing: !REDUCED, hold: !REDUCED };
/* Click a window: each zone can be switched by hand. An override eases to on
   or off and holds until the timeline next switches that zone itself, the way
   a resident's choice lasts until the house's own routine comes round. The two
   dark floors light to a lamp-lit 'dim' when switched on. */
export const ov = new Array(12).fill(null); // { on, w, base }
export const roomOn = new Array(12).fill(0),
  roomOnTarget = new Array(12).fill(0);
const darkRooms = []; // { k, mat, base }, filled from the traced room materials
export const ROOM_SHELLS = []; // the traced rooms, as click targets
{
  const box = new THREE.Box3(),
    c = new THREE.Vector3();
  building.traverse((o) => {
    if (!o.isMesh || !o.material.uniforms?.uLamp) return;
    const k = zoneOfY(box.setFromObject(o).getCenter(c).y);
    if (k > 11) return;
    o.userData.zone = k;
    ROOM_SHELLS.push(o);
    if (!ZONE_LIT[k]) darkRooms.push({ k, mat: o.material, base: o.material.uniforms.uLight.value });
  });
}
addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') {
    seq.t = 0;
    seq.playing = !REDUCED;
    seq.hold = !REDUCED;
    ov.fill(null);
    roomOnTarget.fill(0);
  }
});
const zonePrev = new Array(13).fill(0);
let lightShown = -1;
function timelineZone(st, k) {
  let z =
    k === 0
      ? switchOn(st, SEQ.lobby)
      : k <= 10
        ? switchOn(st, SEQ.floor0 + SEQ.floorStep * (k - 1))
        : k === 11
          ? switchOn(st, SEQ.penthouse)
          : switchOn(st, SEQ.beacon);
  for (const o of LIGHTS_OUT) if (o.k === k) z *= 1 - (1 - o.level) * switchOff(st, o.at);
  return z;
}
export let lightDusk = 0;
const isLit = (k, z) => (ZONE_LIT[k] || roomOn[k] > 0.5) && z[k] > 0.5;
export function lightUp(dt) {
  if (seq.playing) {
    const stop = seq.hold && seq.t < SEQ.end ? SEQ.end : SEQ.last;
    seq.t = Math.min(seq.t + dt, stop);
    if (seq.t >= stop) {
      seq.playing = false;
      seq.hold = false;
    }
  }
  const st = seq.t;
  // Hand switches ease over ~0.35 s; a dark room's lamps warm over ~0.6 s.
  let easing = false;
  for (let k = 0; k < 12; k++) {
    const o = ov[k];
    if (o && o.w < 1) {
      o.w = Math.min(1, o.w + dt / 0.35);
      easing = true;
    }
    const dr = roomOnTarget[k] - roomOn[k];
    if (dr) {
      roomOn[k] += Math.sign(dr) * Math.min(dt / 0.6, Math.abs(dr));
      easing = true;
    }
  }
  if (st === lightShown && !easing && !state.lightDirty) return false; // nothing moved on the timeline
  lightShown = st;
  state.lightDirty = false;
  const dusk = 1 - smoother(st, SEQ.dusk[0], SEQ.dusk[1]);
  const z = ZONE.value;
  for (let k = 0; k < 13; k++) {
    const base = timelineZone(st, k);
    // The house's routine takes a zone back the moment it switches that zone itself.
    if (k < 12 && ov[k] && base > 0.5 !== ov[k].base) {
      ov[k] = null;
      if (!ZONE_LIT[k]) roomOnTarget[k] = 0;
    }
    const o = k < 12 ? ov[k] : null;
    z[k] = o ? base + ((o.on ? 1 : 0) - base) * easeOut(o.w) : base;
  }
  if (state.pattern) {
    const pt = performance.now() / 1000;
    for (let k = 1; k <= 10; k++) z[k] = REDUCED ? k % 2 : smoother(Math.sin(pt * 1.6 - k * 0.7), -0.2, 0.6);
    state.lightDirty = true; // keeps drawing while the wave runs
  }
  z[13] = -3 + 66 * smooth01(st, SEQ.stair[0], SEQ.stair[1]);
  for (const d of darkRooms) d.mat.uniforms.uLight.value = d.base + (LIGHT_STATES.dim - d.base) * roomOn[d.k];
  const stairK = clamp01(z[13] / 60);
  for (const l of zoneLights) l.o.intensity = l.base * (l.k === 13 ? stairK : z[l.k]);
  for (const s of zoneSprites) s.o.material.opacity = s.base * z[s.k];
  // Blue hour lifts the cool ambient so the white slabs read before any lamp is on.
  skyMat.uniforms.uDusk.value = dusk;
  lightDusk = dusk; // hemi, moon, fill, env and fog are set in seasonStep()
  // The HUD reads the same clock: 18:56 at blue hour, 19:42 at full night, on to
  // 00:40; rooms lit out of twelve (lobby, ten floors, penthouse), and lit floors out of eleven.
  const mins =
    st <= SEQ.end
      ? CLOCK0 + Math.round((CLOCK_NIGHT - CLOCK0) * smoother(st, 0, SEQ.end))
      : CLOCK_NIGHT + Math.round(((st - SEQ.end) / (SEQ.last - SEQ.end)) * (CLOCK_LAST - CLOCK_NIGHT));
  let rooms = 0,
    floors = 0;
  for (let k = 0; k < 12; k++)
    if (isLit(k, z)) {
      rooms++;
      if (k > 0) floors++;
    }
  hudText(hudClock, `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`);
  hudText(hudRooms, String(Math.round((rooms / 12) * 100)));
  hudText(countN, String(floors).padStart(2, '0'));
  railStops.forEach((btn) => {
    const k = MARKS[+btn.dataset.k].zone;
    btn.classList.toggle('is-lit', k != null && isLit(k, z));
  });
  // A click and hum as each level comes on while playing forward (not while scrubbing); a click as one goes off.
  for (let k = 0; k < 13; k++) {
    if (seq.playing && zonePrev[k] < 0.02 && z[k] >= 0.02) sound.level(k);
    if (seq.playing && zonePrev[k] > 0.5 && z[k] <= 0.5) sound.off();
    zonePrev[k] = z[k];
  }
  sound.zones((k) => isLit(k, z));
  return true;
}
// Switch a zone by hand (a click on its glass).
export function toggleZone(k) {
  const lit = isLit(k, ZONE.value),
    base = timelineZone(seq.t, k) > 0.5;
  if (!ZONE_LIT[k]) {
    // A dark floor: its lamps come on (and its zone too, if the house hasn't reached it yet).
    roomOnTarget[k] = lit ? 0 : 1;
    ov[k] = base ? null : { on: !lit, w: 0, base };
  } else ov[k] = { on: !lit, w: 0, base };
  state.lightDirty = true;
  if (lit) sound.off();
  else sound.level(k);
}

/* People: walk a lane, pause, walk back; legs and arms swing with the stride.
   Each person's pace, height and pauses come from their seed. Reduced motion:
   everyone stands still at the start of their lane. */
for (const ff of FIG_FLOORS)
  ff.people = ff.people.map((pp) => {
    const r = mulberry(pp.seed * 31),
      v = 1.05 + r() * 0.2,
      h = 0.94 + r() * 0.12;
    const p0 = pp.pause[0] + r() * (pp.pause[1] - pp.pause[0]),
      p1 = pp.pause[0] + r() * (pp.pause[1] - pp.pause[0]);
    const L = Math.abs(pp.lane[1] - pp.lane[0]),
      walk = L / v,
      P = 2 * walk + p0 + p1;
    return { ...pp, v, h, p0, p1, L, walk, P, off: r() * P };
  });
export function peopleStep(tt) {
  for (const ff of FIG_FLOORS) {
    ff.invU.value.copy(ff.g.matrixWorld).invert();
    ff.people.forEach((pp, n) => {
      const [x0, x1, zl] = pp.lane,
        dir = Math.sign(x1 - x0),
        { v, walk, p0, P, L } = pp;
      const ph = REDUCED ? walk : (tt + pp.off) % P;
      let x,
        d = 0;
      if (ph < walk) {
        d = ph * v;
        x = x0 + dir * d;
      } else if (ph < walk + p0) x = x1;
      else if (ph < 2 * walk + p0) {
        d = (ph - walk - p0) * v;
        x = x1 - dir * d;
      } else x = x0;
      // A stride of ~1.4 m; the swing eases in and out at each end of the lane.
      const swing = d > 0 ? Math.sin((d / 0.7) * Math.PI) * 0.36 * clamp01(Math.min(d, L - d) / 0.5) : 0;
      ff.figU.value[n].set(x, zl, swing, pp.h);
    });
  }
}
