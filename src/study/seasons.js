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

/* Seasons: the same house on four different nights. Each season carries its
   own sky grade, horizon air, cloud, moonlight, ambient, fog, exposure, far
   hills, lawn and foliage, plus something in the air (falling leaves, snow,
   blossom petals, fireflies) and its own sound bed. Switching cross-fades
   every value over ~2 s; snow settles on the ground over ~30 s and melts
   when winter ends. No new lights, passes or textures: one extra Points draw. */
const SEASONS = [
  {
    name: 'Autumn',
    leafSat: 0.22,
    grassSat: 0.45,
    leafLo: [0.16, 0.035, 0.012],
    leafHi: [0.95, 0.42, 0.1],
    grassLo: [0.07, 0.05, 0.02],
    grassHi: [0.62, 0.46, 0.2],
    sky: [1.0, 0.94, 0.88],
    hor: [0.075, 0.032, 0.01],
    cloud: 1.15,
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
    crickets: 0,
  },
  {
    name: 'Winter',
    leafSat: 0.12,
    grassSat: 0.3,
    leafLo: [0.06, 0.06, 0.07],
    leafHi: [0.62, 0.64, 0.68],
    grassLo: [0.07, 0.07, 0.08],
    grassHi: [0.6, 0.62, 0.66],
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
    crickets: 0,
  },
  {
    name: 'Spring',
    leafSat: 0.12,
    grassSat: 1.0,
    leafLo: [0.52, 0.26, 0.3],
    leafHi: [1.0, 0.84, 0.87],
    grassLo: [0.03, 0.08, 0.02],
    grassHi: [0.35, 0.6, 0.2],
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
    grass: [0.92, 1.06, 0.9],
    leaf: [1.2, 0.98, 0.96],
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
    crickets: 0.006,
  },
  {
    name: 'Summer',
    leafSat: 1.0,
    grassSat: 1.0,
    leafLo: [0.02, 0.07, 0.02],
    leafHi: [0.3, 0.6, 0.15],
    grassLo: [0.03, 0.08, 0.02],
    grassHi: [0.35, 0.6, 0.2],
    sky: [1.05, 0.88, 1.18],
    hor: [0.11, 0.05, 0.035],
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
    crickets: 0.014,
  },
];
// Foliage and lawn are graded after their texture is applied: a multiply alone can't
// take the green out of a leaf map. The texture's luminance drives a two-colour ramp,
// so the season changes the colour while each leaf keeps its own light and dark.
// Hedges are evergreen box: they keep their green and only frost over in winter.
const gradeU = () => ({
  uSeasonSat: { value: 1 },
  uSeasonTint: { value: new THREE.Vector3(1, 1, 1) },
  uSeasonLo: { value: new THREE.Vector3() },
  uSeasonHi: { value: new THREE.Vector3(1, 1, 1) },
});
const FOLIAGE_U = { leaf: gradeU(), grass: gradeU(), hedge: gradeU() };
function seasonGrade(mat, key) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    Object.assign(sh.uniforms, FOLIAGE_U[key]);
    sh.fragmentShader =
      'uniform float uSeasonSat;\nuniform vec3 uSeasonTint, uSeasonLo, uSeasonHi;\n' +
      sh.fragmentShader.replace(
        '#include <map_fragment>',
        '#include <map_fragment>\nfloat seasonL = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));\n' +
          'vec3 seasonRamp = mix(uSeasonLo, uSeasonHi, smoothstep(0.015, 0.42, seasonL));\n' +
          'diffuseColor.rgb = mix(seasonRamp, diffuseColor.rgb, uSeasonSat) * uSeasonTint;',
      );
  };
  mat.customProgramCacheKey = () => `season-${key}-${prev.toString().length}`;
  mat.needsUpdate = true;
}
for (const m of [M.leaf, LEAF_LIT, ...CARD_MATS.values()]) seasonGrade(m, 'leaf');
seasonGrade(M.hedge, 'hedge');
for (const m of [M.grass, M.tuft]) seasonGrade(m, 'grass');
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

const seasonBtn = document.getElementById('seasonBtn');
export function setSeason(i) {
  state.seasonIndex = (i + SEASONS.length) % SEASONS.length;
  state.season = SEASONS[state.seasonIndex];
  seasonTgt = flatSeason(state.season);
  if (!REDUCED) seasonDip = 1;
  seasonBtn.textContent = state.season.name;
  seasonBtn.setAttribute('aria-label', `Season: ${state.season.name.toLowerCase()}`);
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
