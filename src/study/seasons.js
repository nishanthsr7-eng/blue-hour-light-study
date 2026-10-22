import * as THREE from 'three';
import { mulberry, REDUCED, TAU } from '../core/util.js';
import { state } from '../core/state.js';
import { camera, fill, hemi, renderer, scene, skyMat, SNOW_COVER, STAGE_C, sun } from '../core/scene.js';
import { M } from '../world/materials.js';
import { EXPOSURE } from '../world/kit.js';
import { LEAF_LIT } from '../tower/furniture.js';
import { CARD_MATS } from '../tower/trees.js';
import { sound } from './audio.js';
import { DUSK_HEMI, FOG_DUSK, FOG_NIGHT, lightDusk } from './light-study.js';
import { rainBtn, rainOn } from './rain.js';
import { TOP } from '../tower/slab.js';
import { FLOOR } from '../tower/base.js';
import { snowify } from '../world/snow.js';

/* Seasons: the same house on four different nights. Each season carries its
   own sky grade, horizon air, cloud, moonlight, ambient, fog, exposure, far
   hills, lawn and foliage, plus something in the air (falling leaves, snow,
   blossom petals, fireflies) and its own wind. Switching cross-fades
   every value over ~2 s; snow settles over ~30 s (on the ground, crowns,
   hedges and planters, and the pool freezes) and melts when winter ends.
   No new lights or passes: one Points draw for the air, and one instanced
   draw for autumn's leaf litter, hidden in other seasons. */
const SEASONS = [
  {
    name: 'Autumn',
    leafSat: 0.22,
    grassSat: 0.45,
    leafLo: [0.16, 0.035, 0.012],
    leafHi: [0.95, 0.42, 0.1],
    grassLo: [0.07, 0.05, 0.02],
    grassHi: [0.62, 0.46, 0.2],
    leafAltLo: [0.14, 0.015, 0.01],
    leafAltHi: [0.82, 0.13, 0.05],
    leafAltK: 0.6,
    leafKeepK: 0.4,
    leafFine: 0,
    leafVar: 0.25,
    bark: 0.25,
    furrow: 1,
    halo: 1,
    petals: 0,
    litter: 1,
    sky: [1.0, 0.94, 0.88],
    hor: [0.075, 0.032, 0.01],
    cloud: 0.75,
    hemi: [1.0, 0.94, 0.86],
    hemiK: 1.0,
    moon: 0xc4c4ec,
    moonK: 1.0,
    fillK: 1.0,
    fog: [1.15, 0.95, 0.82],
    fogFar: 600,
    envK: 1.0,
    exp: 1.0,
    stage: [0.028, 0.02, 0.02],
    grass: [1.0, 0.85, 0.6],
    leaf: [1.2, 0.85, 0.5],
    snow: 0, // copper and rust
    air: {
      color: [0.55, 0.24, 0.08],
      size: 0.16,
      fall: 1.1,
      drift: 1.6,
      spin: 1,
      blink: 0,
      y: [0, 34],
      density: 0.45,
      shape: 0,
    },
    wind: 0.07,
  },
  {
    name: 'Winter',
    leafSat: 0.12,
    grassSat: 0.3,
    leafLo: [0.06, 0.06, 0.07],
    leafHi: [0.62, 0.64, 0.68],
    grassLo: [0.07, 0.07, 0.08],
    grassHi: [0.6, 0.62, 0.66],
    leafAltLo: [0.06, 0.06, 0.07],
    leafAltHi: [0.62, 0.64, 0.68],
    leafAltK: 0,
    leafKeepK: 0,
    leafFine: 0,
    leafVar: 0.15,
    bark: 0.15,
    furrow: 1,
    halo: 1.8,
    petals: 0,
    litter: 0,
    sky: [0.86, 1.02, 1.4],
    hor: [0.035, 0.05, 0.09],
    cloud: 0.35,
    hemi: [0.92, 1.04, 1.3],
    hemiK: 1.15,
    moon: 0xdce6ff,
    moonK: 1.35,
    fillK: 1.05,
    fog: [1.5, 1.7, 2.2],
    fogFar: 420,
    envK: 1.25,
    exp: 1.06,
    stage: [0.075, 0.09, 0.125],
    grass: [1.0, 1.0, 1.0],
    leaf: [0.85, 0.82, 0.8],
    snow: 1, // bare, frost-touched crowns
    air: {
      color: [0.8, 0.84, 0.92],
      size: 0.07,
      fall: 0.9,
      drift: 0.9,
      spin: 0,
      blink: 0,
      y: [0, 48],
      density: 0.85,
      shape: 1,
    },
    wind: 0.16,
  },
  {
    name: 'Spring',
    leafSat: 0.12,
    grassSat: 1.0,
    leafLo: [0.64, 0.36, 0.36],
    leafHi: [1.0, 0.76, 0.8],
    grassLo: [0.05, 0.1, 0.015],
    grassHi: [0.5, 0.72, 0.16],
    leafAltLo: [0.66, 0.6, 0.6],
    leafAltHi: [1.0, 0.98, 0.96],
    leafAltK: 0.75,
    leafKeepK: 0.6,
    leafFine: 0.35,
    leafVar: 0.08,
    bark: 1,
    furrow: 0,
    halo: 1.1,
    petals: 1,
    litter: 0,
    sky: [0.96, 1.06, 1.12],
    hor: [0.04, 0.048, 0.055],
    cloud: 0.85,
    hemi: [0.94, 1.06, 1.02],
    hemiK: 1.0,
    moon: 0xc8d6f2,
    moonK: 1.05,
    fillK: 1.0,
    fog: [1.05, 1.3, 1.25],
    fogFar: 520,
    envK: 1.0,
    exp: 1.02,
    stage: [0.018, 0.032, 0.036],
    grass: [1.0, 1.08, 0.82],
    leaf: [1.25, 1.0, 0.94],
    snow: 0, // warmed against the blue moon: pale cherry blossom, soft blush pink
    air: {
      color: [1.05, 0.84, 0.9],
      size: 0.085,
      fall: 0.45,
      drift: 1.4,
      spin: 1,
      blink: 0,
      y: [0, 30],
      density: 0.4,
      shape: 0,
    },
    wind: 0.03,
  },
  {
    name: 'Summer',
    leafSat: 1.0,
    grassSat: 1.0,
    leafLo: [0.012, 0.045, 0.015],
    leafHi: [0.2, 0.44, 0.1],
    grassLo: [0.03, 0.08, 0.02],
    grassHi: [0.35, 0.6, 0.2],
    leafAltLo: [0.02, 0.06, 0.012],
    leafAltHi: [0.3, 0.52, 0.09],
    leafAltK: 0.45,
    leafKeepK: 0,
    leafFine: 0,
    leafVar: 0.6,
    bark: 0.2,
    furrow: 1,
    halo: 0.85,
    petals: 0,
    litter: 0,
    sky: [1.05, 0.88, 1.18],
    hor: [0.2, 0.095, 0.045],
    cloud: 0.5,
    hemi: [1.12, 0.98, 0.88],
    hemiK: 0.95,
    moon: 0xffe2bc,
    moonK: 0.9,
    fillK: 0.9,
    fog: [1.45, 1.05, 0.9],
    fogFar: 540,
    envK: 0.95,
    exp: 1.0,
    stage: [0.034, 0.024, 0.03],
    grass: [0.88, 1.04, 0.82],
    leaf: [0.85, 1.04, 0.8],
    snow: 0,
    air: {
      color: [1.6, 1.9, 0.55],
      size: 0.11,
      fall: 0,
      drift: 2.2,
      spin: 0,
      blink: 1,
      y: [0.3, 9],
      density: 0.35,
      shape: 2,
    },
    wind: 0.015,
  },
];
// Foliage and lawn are graded after their texture is applied: a multiply alone can't
// take the green out of a leaf map. The texture's luminance drives a two-colour ramp,
// so the season changes the colour while each leaf keeps its own light and dark.
// A second ramp, laid over the crown in patches by world-space noise, keeps one
// colour from covering a whole tree: autumn mixes rust with red and a few leaves
// still green, spring scatters white blossom among the pink and new leaves.
// Hedges are evergreen box: they keep their green and only frost over in winter.
const gradeU = () => ({
  uSeasonSat: { value: 1 },
  uSeasonTint: { value: new THREE.Vector3(1, 1, 1) },
  uSeasonLo: { value: new THREE.Vector3() },
  uSeasonHi: { value: new THREE.Vector3(1, 1, 1) },
  uSeasonAltLo: { value: new THREE.Vector3() },
  uSeasonAltHi: { value: new THREE.Vector3(1, 1, 1) },
  uSeasonAltK: { value: 0 },
  uSeasonKeepK: { value: 0 },
  uSeasonFine: { value: 0 },
  uSeasonVar: { value: 0 },
  uSeasonFurrow: { value: 0 },
});
const FOLIAGE_U = { leaf: gradeU(), grass: gradeU(), hedge: gradeU(), bark: gradeU() };
// Bark: the scan is cherry, banded with lenticels. Outside spring it is greyed
// toward plain brown-grey and broken by vertical furrows, so the trunks read as
// an ordinary deciduous tree rather than a cherry all year.
FOLIAGE_U.bark.uSeasonLo.value.set(0.035, 0.03, 0.026);
FOLIAGE_U.bark.uSeasonHi.value.set(0.42, 0.38, 0.33);
function seasonGrade(mat, key) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    Object.assign(sh.uniforms, FOLIAGE_U[key]);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSeasonP;').replace(
      '#include <project_vertex>',
      /* glsl */ `#include <project_vertex>
      vec4 seasonWP = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        seasonWP = instanceMatrix * seasonWP;
      #endif
      vSeasonP = (modelMatrix * seasonWP).xyz;`,
    );
    sh.fragmentShader =
      /* glsl */ `uniform float uSeasonSat, uSeasonAltK, uSeasonKeepK, uSeasonFine, uSeasonVar, uSeasonFurrow;
      uniform vec3 uSeasonTint, uSeasonLo, uSeasonHi, uSeasonAltLo, uSeasonAltHi;
      varying vec3 vSeasonP;
      float seasonH(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float seasonN(vec3 p) {
        vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(seasonH(i), seasonH(i + vec3(1, 0, 0)), f.x), mix(seasonH(i + vec3(0, 1, 0)), seasonH(i + vec3(1, 1, 0)), f.x), f.y),
                   mix(mix(seasonH(i + vec3(0, 0, 1)), seasonH(i + vec3(1, 0, 1)), f.x), mix(seasonH(i + vec3(0, 1, 1)), seasonH(i + vec3(1, 1, 1)), f.x), f.y), f.z);
      }\n` +
      sh.fragmentShader.replace(
        '#include <map_fragment>',
        /* glsl */ `#include <map_fragment>
        float seasonL = smoothstep(0.015, 0.42, dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)));
        vec3 seasonRamp = mix(uSeasonLo, uSeasonHi, seasonL);
        float seasonA = mix(seasonN(vSeasonP * 0.9) * 0.7 + seasonN(vSeasonP * 3.1) * 0.3, seasonN(vSeasonP * 7.3), uSeasonFine);
        seasonRamp = mix(seasonRamp, mix(uSeasonAltLo, uSeasonAltHi, seasonL), smoothstep(0.42 - 0.12 * uSeasonFine, 0.62 + 0.12 * uSeasonFine, seasonA) * uSeasonAltK);
        float seasonKeep = smoothstep(0.6 + 0.1 * uSeasonFine, 0.75 + 0.1 * uSeasonFine, seasonN(vSeasonP * mix(1.3, 6.0, uSeasonFine) + 17.0)) * uSeasonKeepK;
        diffuseColor.rgb = mix(seasonRamp, diffuseColor.rgb, clamp(uSeasonSat + seasonKeep, 0.0, 1.0)) * uSeasonTint;
        // Light and shade across the crown: dense summer foliage clumps, some lit, some deep.
        float seasonV = seasonN(vSeasonP * 1.6 + 5.0) * 0.65 + seasonN(vSeasonP * 4.2) * 0.35;
        diffuseColor.rgb *= mix(1.0, 0.45 + 1.0 * seasonV, uSeasonVar);
        diffuseColor.rgb *= mix(1.0, 0.7 + 0.5 * seasonN(vSeasonP * vec3(22.0, 1.2, 22.0)), uSeasonFurrow);`,
      );
  };
  mat.customProgramCacheKey = () => `season-${key}-${prev.toString().length}`;
  mat.needsUpdate = true;
}
for (const m of [M.leaf, LEAF_LIT, ...CARD_MATS.values()]) seasonGrade(m, 'leaf');
seasonGrade(M.hedge, 'hedge');
seasonGrade(M.bark, 'bark');
for (const m of [M.grass, M.tuft]) seasonGrade(m, 'grass');

// Snow settles wherever the sky is open: the forecourt at ground level (not
// under the lobby or canopy) and the penthouse's floating roof. Every terrace,
// the penthouse deck and the entrance canopy sit under a slab and stay dry.
// Tree crowns hold it on their upper half, hedges and planters on their tops.
const OPEN = 'step(vSnP.y, 2.5) * (1.0 - step(abs(vSnP.x), 10.4) * step(-7.6, vSnP.z) * step(vSnP.z, 11.8))';
for (const m of [M.leaf, CARD_MATS.get(M.leaf)]) if (m) snowify(m, { slope: 0.45, bump: 0.6 });
snowify(M.hedge, { where: OPEN, slope: 0.55 });
for (const m of [M.planter, M.soil]) snowify(m, { where: OPEN });
snowify(M.fascia, { where: `step(${(TOP + 5).toFixed(1)}, vSnP.y)` }); // only the roof's top is above this

// Leaf litter and fallen petals: autumn's leaves lie scattered under the trees
// and drift across the plinth; in spring a small patch of blossom lies under
// each tree and floats on the pool. One instanced draw each, faded in with the
// season and hidden otherwise.
function scatter({ seed, N, w, h, tones, draw, near, far, rest, pool = 0 }) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 32;
  draw(c.getContext('2d'));
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({
    map,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2), mat, N),
    rnd = mulberry(seed),
    m4 = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    e = new THREE.Euler(),
    col = new THREE.Color();
  const TREES = [
    [16.5, 15],
    [16.5, -2.5],
    [-16.5, -3],
  ];
  // On the plinth (a 42 × 36 m rounded slab), off the pool and out of the lobby.
  const onPlinth = (x, z) => {
    const dx = Math.max(Math.abs(x) - 12.6, 0),
      dz = Math.max(Math.abs(z) - 9.6, 0);
    return Math.hypot(dx, dz) < 7.6;
  };
  const inPool = (x, z) => x > -18.7 && x < -2.3 && z > 5.8 && z < 15.2;
  const onWater = (x, z) => x > -17.9 && x < -3.1 && z > 6.6 && z < 14.4 && Math.hypot(x + 14.2, z - 10.8) > 1.5;
  const clear = (x, z) => onPlinth(x, z) && !inPool(x, z) && !(Math.abs(x) < 10.4 && z > -7.6 && z < 6.8);
  let n = 0;
  for (let tries = 0; n < N && tries < N * 6; tries++) {
    let x,
      z,
      y = FLOOR + 0.008 + rnd() * 0.01;
    const k = rnd();
    if (k < pool) {
      // Petals blown onto the water, gathered toward the far coping.
      x = -17.9 + rnd() * 14.8;
      z = 14.4 - Math.pow(rnd(), 1.8) * 7.8;
      if (!onWater(x, z)) continue;
      y = 1.036 + rnd() * 0.002;
    } else {
      if (k < pool + (1 - pool) * (1 - rest)) {
        const [tx, tz] = TREES[(rnd() * 3) | 0],
          a = rnd() * TAU,
          r = near + Math.pow(rnd(), 1.6) * far;
        x = tx + Math.cos(a) * r;
        z = tz + Math.sin(a) * r;
      } else {
        x = (rnd() - 0.5) * 40;
        z = (rnd() - 0.5) * 34;
      }
      if (!clear(x, z)) continue;
    }
    e.set(0, rnd() * TAU, 0);
    const sc = 0.7 + rnd() * 0.7;
    m4.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e), new THREE.Vector3(sc, sc, sc));
    mesh.setMatrixAt(n, m4);
    mesh.setColorAt(n, col.setHex(tones[(rnd() * tones.length) | 0]).multiplyScalar(0.8 + rnd() * 0.4));
    n++;
  }
  mesh.count = n;
  mesh.receiveShadow = true;
  mesh.visible = false;
  mesh.renderOrder = 1;
  scene.add(mesh);
  return mesh;
}
const litter = scatter({
  seed: 777,
  N: 1600,
  w: 0.22,
  h: 0.11,
  tones: [0x8a3a12, 0xa8561a, 0x6b2a10, 0xb87a2a, 0x5a3a1c, 0x9a2a14],
  near: 1.45,
  far: 4.5,
  rest: 0.2,
  draw: (g) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(2, 16);
    g.quadraticCurveTo(30, -2, 62, 16);
    g.quadraticCurveTo(30, 34, 2, 16);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(4, 16);
    g.lineTo(58, 16);
    g.stroke();
  },
});
const petals = scatter({
  seed: 909,
  N: 2200,
  w: 0.11,
  h: 0.075,
  tones: [0xf6dde4, 0xf2c4d0, 0xfbeef0, 0xe9a9bb, 0xffffff],
  near: 1.4,
  far: 2.2,
  rest: 0.04,
  pool: 0.22,
  // A cherry petal: a rounded fan with the notch at its tip.
  draw: (g) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(4, 16);
    g.bezierCurveTo(14, -2, 52, 0, 60, 10);
    g.lineTo(52, 16);
    g.lineTo(60, 22);
    g.bezierCurveTo(52, 32, 14, 34, 4, 16);
    g.fill();
  },
});
const SUN_BASE = sun.color.clone(),
  FILL_BASE = fill.color.clone();

// The blend: every season value as a flat number array, eased toward the target season.
const flatSeason = (S) => [
  ...S.sky,
  ...S.hor,
  S.cloud,
  ...S.hemi,
  S.hemiK,
  ...new THREE.Color(S.moon).toArray(),
  S.moonK,
  S.fillK,
  ...S.fog,
  S.fogFar,
  S.envK,
  S.exp,
  ...S.stage,
  ...S.grass,
  ...S.leaf,
  S.leafSat,
  S.grassSat,
  ...S.leafLo,
  ...S.leafHi,
  ...S.grassLo,
  ...S.grassHi,
  ...S.leafAltLo,
  ...S.leafAltHi,
  S.leafAltK,
  S.leafKeepK,
  S.litter,
  S.leafFine,
  S.leafVar,
  S.bark,
  S.furrow,
  S.halo,
  S.petals,
];
let seasonCur = flatSeason(SEASONS[0]),
  seasonTgt = seasonCur.slice();

// Something in the air: one Points draw round the tower. A season change fades
// the old particles out, swaps the recipe, and fades the new ones in.
const AIR_N = 1800;
const air = (() => {
  const pos = new Float32Array(AIR_N * 3),
    seed = new Float32Array(AIR_N * 4),
    rnd = mulberry(4242);
  for (let i = 0; i < AIR_N; i++) {
    const a = rnd() * TAU,
      r = 3 + Math.sqrt(rnd()) * 52;
    pos.set([Math.sin(a) * r, rnd(), Math.cos(a) * r], i * 3);
    seed.set([rnd(), rnd(), rnd(), rnd()], i * 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFade: { value: 0 },
      uScale: { value: 800 },
      uColor: { value: new THREE.Vector3() },
      uSize: { value: 0.1 },
      uFall: { value: 1 },
      uDrift: { value: 1 },
      uSpin: { value: 0 },
      uBlink: { value: 0 },
      uY: { value: new THREE.Vector2(0, 30) },
      uDensity: { value: 0.5 },
      uShape: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime, uScale, uSize, uFall, uDrift, uSpin, uBlink, uDensity, uFade; uniform vec2 uY;
      varying float vA, vRot, vTurn;
      void main() {
        vec4 s = aSeed; float span = uY.y - uY.x, t = uTime;
        vec3 q = position;
        q.y = uY.x + mod(position.y * span - t * uFall * (0.7 + 0.6 * s.x), span);
        // Wander: leaves and petals swing as they fall, fireflies loiter.
        q.x += uDrift * (sin(t * (0.21 + s.y * 0.3) + s.z * 6.3) + 0.4 * sin(t * (0.9 + s.w) + s.x * 9.0));
        q.z += uDrift * (cos(t * (0.17 + s.w * 0.3) + s.x * 6.3) + 0.4 * cos(t * (0.7 + s.y) + s.z * 9.0));
        q.x += t * uFall * 0.12 * (1.0 - uBlink); q.x = mod(q.x + 60.0, 120.0) - 60.0; // a breeze that wraps
        vec4 mv = modelViewMatrix * vec4(q, 1.0);
        float blink = pow(max(sin(t * (0.8 + s.y * 1.3) + s.z * 40.0), 0.0), 4.0);
        vA = uFade * step(s.w, uDensity) * mix(1.0, blink, uBlink)
           * smoothstep(0.0, 1.5, q.y - uY.x) * smoothstep(0.0, 3.0, uY.y - q.y) * smoothstep(110.0, 30.0, -mv.z);
        vRot = t * uSpin * (s.y - 0.5) * 5.0 + s.z * 6.28; vTurn = cos(t * uSpin * (1.0 + s.x * 2.0) + s.w * 6.0);
        gl_PointSize = max(uSize * (0.6 + 0.8 * s.x) * uScale / -mv.z, 1.2);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uShape; varying float vA, vRot, vTurn;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float a = 0.0;
        if (uShape < 0.5) {
          // A leaf or petal: an ellipse tumbling in its own plane, darker on its underside.
          float c = cos(vRot), sn = sin(vRot);
          vec2 r = vec2(c * p.x - sn * p.y, sn * p.x + c * p.y) * vec2(1.0, 2.0 / max(abs(vTurn), 0.25));
          a = 1.0 - smoothstep(0.38, 0.5, length(r));
          gl_FragColor = vec4(uColor * (0.55 + 0.45 * abs(vTurn)), a * vA);
        } else {
          // A snowflake (soft dot) or a firefly (a bright core in a wide glow).
          float d = length(p);
          a = uShape < 1.5 ? 1.0 - smoothstep(0.15, 0.5, d) : exp(-d * d * 40.0) + 0.35 * exp(-d * d * 9.0);
          gl_FragColor = vec4(uColor, a * vA);
        }
        if (gl_FragColor.a < 0.01) discard;
      }`,
    transparent: true,
    depthWrite: false,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 7;
  scene.add(pts);
  return pts;
})();
const AU = air.material.uniforms;
let airRecipe = null; // the recipe currently in the air; swapped when the old one has faded out
function loadAir(a) {
  airRecipe = a;
  AU.uColor.value.set(...a.color);
  AU.uSize.value = a.size;
  AU.uFall.value = a.fall;
  AU.uDrift.value = a.drift;
  AU.uSpin.value = a.spin;
  AU.uBlink.value = a.blink;
  AU.uY.value.set(...a.y);
  AU.uDensity.value = a.density;
  AU.uShape.value = a.shape;
  air.material.blending = a.shape === 2 ? THREE.AdditiveBlending : THREE.NormalBlending;
}
loadAir(SEASONS[0].air);

const seasonBtn = document.getElementById('seasonBtn'),
  seasonName = document.getElementById('seasonName');
export function setSeason(i) {
  state.seasonIndex = (i + SEASONS.length) % SEASONS.length;
  state.season = SEASONS[state.seasonIndex];
  seasonTgt = flatSeason(state.season);
  if (!REDUCED) seasonDip = 1;
  seasonName.textContent = state.season.name;
  seasonBtn.setAttribute('aria-label', `Season: ${state.season.name.toLowerCase()}. Press S for the next season`);
  rainBtn.textContent = state.season.snow ? 'Snow' : 'Rain';
  sound.rain(rainOn && !state.season.snow);
  sound.season(state.season);
  state.lightDirty = true;
}
seasonBtn.addEventListener('click', () => setSeason(state.seasonIndex + 1));
state.season = SEASONS[0];

const _c = new THREE.Color(),
  _leafK = new THREE.Color(),
  _grassK = new THREE.Color(),
  FROST = new THREE.Color(1.3, 1.34, 1.42);
// A season change is staged, not a flat cross-fade: sky turns first, then
// the light, then fog and hills, and foliage last. Rates per flatSeason() slot.
const SEASON_RATE = flatSeason(SEASONS[0]).map((_, i) =>
  i <= 6 ? 2.6 : i <= 15 || i === 20 || i === 21 ? 1.7 : i <= 24 ? 1.25 : 0.85,
);
let seasonDip = 0; // 1 → 0 after a switch: a brief exposure dip, like a cut
export function seasonStep(dt, tt) {
  let moving = false;
  for (let i = 0; i < seasonCur.length; i++) {
    const d = seasonTgt[i] - seasonCur[i];
    const k = REDUCED ? 1 : 1 - Math.exp(-dt * SEASON_RATE[i]);
    if (Math.abs(d) > 1e-4) {
      seasonCur[i] += d * k;
      moving = true;
    } else seasonCur[i] = seasonTgt[i];
  }
  if (seasonDip > 0) {
    seasonDip = Math.max(0, seasonDip - dt / 1.1);
    moving = true;
  }
  const v = seasonCur;
  // Snow settles over ~30 s (faster when it is snowing hard) and melts over ~15 s.
  const sTgt = state.season.snow,
    sc = SNOW_COVER.value;
  if (REDUCED) SNOW_COVER.value = sTgt;
  else if (sc < sTgt) SNOW_COVER.value = Math.min(sTgt, sc + dt / (rainOn ? 12 : 30));
  else if (sc > sTgt) SNOW_COVER.value = Math.max(sTgt, sc - dt / 15);
  const snow = SNOW_COVER.value;
  if (snow !== sc) moving = true;

  const sky = skyMat.uniforms,
    dusk = lightDusk;
  sky.uSkyMul.value.set(v[0], v[1], v[2]);
  sky.uHorAdd.value.set(v[3], v[4], v[5]);
  sky.uCloudK.value = v[6];
  // Snow on the ground throws moonlight back up: the ambient lifts as it settles.
  hemi.color.lerpColors(DUSK_HEMI.night, DUSK_HEMI.dusk, dusk).multiply(_c.setRGB(v[7], v[8], v[9]));
  hemi.intensity = (1.0 + 1.3 * dusk) * v[10] * (1 + snow * 0.1);
  sun.color.copy(SUN_BASE).lerp(_c.setRGB(v[11], v[12], v[13]), 0.7);
  sun.intensity = (0.95 + 0.5 * dusk) * v[14];
  fill.color.copy(FILL_BASE);
  fill.intensity = (0.4 + 0.7 * dusk) * v[15];
  scene.fog.color.lerpColors(FOG_NIGHT, FOG_DUSK, dusk).multiply(_c.setRGB(v[16], v[17], v[18]));
  scene.fog.far = v[19];
  scene.environmentIntensity = (1.0 + 0.6 * dusk) * v[20];
  renderer.toneMappingExposure = EXPOSURE * v[21] * (1 - 0.22 * Math.sin(Math.PI * seasonDip));
  STAGE_C.value.set(v[22], v[23], v[24]);
  // Lawn and foliage: the season's colour, frosted pale as snow settles.
  _grassK.setRGB(v[25], v[26], v[27]).lerp(FROST, snow * 0.45);
  _leafK.setRGB(v[28], v[29], v[30]).lerp(FROST, snow * 0.5);
  const L = FOLIAGE_U.leaf,
    G = FOLIAGE_U.grass,
    Hd = FOLIAGE_U.hedge;
  L.uSeasonTint.value.set(_leafK.r, _leafK.g, _leafK.b);
  L.uSeasonSat.value = v[31];
  L.uSeasonLo.value.set(v[33], v[34], v[35]);
  L.uSeasonHi.value.set(v[36], v[37], v[38]);
  G.uSeasonTint.value.set(_grassK.r, _grassK.g, _grassK.b);
  G.uSeasonSat.value = v[32] * (1 - snow * 0.6);
  G.uSeasonLo.value.set(v[39], v[40], v[41]);
  G.uSeasonHi.value.set(v[42], v[43], v[44]);
  L.uSeasonAltLo.value.set(v[45], v[46], v[47]);
  L.uSeasonAltHi.value.set(v[48], v[49], v[50]);
  L.uSeasonAltK.value = v[51];
  L.uSeasonKeepK.value = v[52];
  // Litter fades with the season and is buried as snow settles.
  litter.material.opacity = v[53] * (1 - snow);
  litter.visible = litter.material.opacity > 0.01;
  petals.material.opacity = v[59] * 0.95 * (1 - snow);
  petals.visible = petals.material.opacity > 0.01;
  const B = FOLIAGE_U.bark;
  B.uSeasonSat.value = v[56];
  B.uSeasonFurrow.value = v[57];
  _c.setRGB(1, 1, 1).lerp(FROST, snow * 0.25);
  B.uSeasonTint.value.set(_c.r, _c.g, _c.b);
  L.uSeasonFine.value = v[54];
  L.uSeasonVar.value = v[55];
  sky.uHalo.value = v[58];
  _c.setRGB(1, 1, 1).lerp(FROST, snow * 0.3);
  Hd.uSeasonTint.value.set(_c.r, _c.g, _c.b);

  // The air: fade out, swap recipe, fade in.
  const want = state.season.air,
    fade = AU.uFade.value;
  const fk = REDUCED ? 1 : Math.min(1, dt / 0.9);
  if (airRecipe !== want) {
    AU.uFade.value = Math.max(0, fade - fk);
    if (AU.uFade.value === 0) loadAir(want);
  } else AU.uFade.value = Math.min(1, fade + fk);
  if (AU.uFade.value !== fade) moving = true;
  AU.uTime.value = tt;
  AU.uScale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  return moving;
}
