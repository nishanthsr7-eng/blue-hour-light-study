import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { MAX_ANISO, mulberry, TAU, yieldToBrowser } from './util.js';

/* ════════════════════════════════════════════════════════════════════════
   Scene, sky, light
   ════════════════════════════════════════════════════════════════════════ */

await yieldToBrowser(); // a fresh slice for this build step (util.js)

const canvas = document.getElementById('gl');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

export const scene = new THREE.Scene();
// Season state shared by several shaders: how much snow has settled, and the hills' far tone.
export const SNOW_COVER = { value: 0 },
  STAGE_C = { value: new THREE.Vector3(0.016, 0.021, 0.036) };
scene.fog = new THREE.Fog(0x0e1322, 160, 700);

export const camera = new THREE.PerspectiveCamera(32, 1, 0.3, 3000);

/* Post: one HDR render (4× MSAA, so alpha-to-coverage foliage stays smooth),
   a half-resolution bloom that only catches the hottest pixels (down-lights,
   lobby, moon, beacon), then a light film grade. Roughly
   1–2 ms on a laptop GPU; the idle loop still throttles it like before. */
export const composer = new EffectComposer(
  renderer,
  new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }),
);
composer.addPass(new RenderPass(scene, camera));
export const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.55, 0.92);
composer.addPass(bloom);
// Materials only tone-map and sRGB-encode when drawing to the screen (or an XR
// target). Flagging the composer's buffers as such keeps every material, custom
// shader and toneMapped:false emitter looking exactly as it did unpostprocessed,
// so bloom and the grade work on the display image and no OutputPass is needed.
composer.renderTarget1.isXRRenderTarget = composer.renderTarget2.isXRRenderTarget = true;
for (const rt of [composer.renderTarget1, composer.renderTarget2]) rt.texture.colorSpace = THREE.SRGBColorSpace;
export const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      // Lift the blacks to a deep blue-grey so the ground and sky keep their
      // detail, then split-tone: cool shadows, warm highlights.
      c = c + (vec3(0.045, 0.05, 0.065) * (1.0 - c));
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c += mix(vec3(-0.004, 0.0, 0.012), vec3(0.018, 0.008, -0.01), smoothstep(0.1, 0.7, l));
      // Lens vignette and fine grain (breaks up gradient banding in the night sky).
      vec2 d = vUv - 0.5; c *= 1.0 - 0.14 * smoothstep(0.35, 0.95, dot(d, d) * 2.2);
      float n = fract(sin(dot(vUv * 1000.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      gl_FragColor = vec4(c + n * 0.012, 1.0);
    }`,
});
composer.addPass(grade);
// The moon, the scene's key light. Set by the drone's framing rather than the
// other way round: MOON_AZ uses the same angle as the flight's orbit (camera at
// (sin a, cos a) · R), so a camera at angle a sees the moon (MOON_AZ − a) to the
// left of the tower. 8.6° up clears the ridges and stays in a level frame.
const MOON_AZ = 1.3,
  MOON_EL = 0.15;
const SUN_DIR = new THREE.Vector3(
  -Math.sin(MOON_AZ) * Math.cos(MOON_EL),
  Math.sin(MOON_EL),
  -Math.cos(MOON_AZ) * Math.cos(MOON_EL),
);

/* The full moon's near side, drawn from its real map rather than noise: the
   maria at their selenographic positions (lat, lon, radius in degrees, and
   how dark each one is), projected orthographically so the ones near the
   limb foreshorten the way Crisium does. Then the bright young craters and
   their ray systems: Tycho's long rays reaching across the southern
   highlands, Copernicus, Kepler, Aristarchus as the brightest point, and
   Proclus. The texture is an albedo factor (red channel), not a colour. */
const moonTex = (() => {
  const S = 512,
    cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d'),
    rnd = mulberry(77),
    D = Math.PI / 180,
    R = S / 2 - 2;
  const proj = (lat, lon) => {
    const x = Math.cos(lat * D) * Math.sin(lon * D),
      y = Math.sin(lat * D),
      z = Math.cos(lat * D) * Math.cos(lon * D);
    return z > 0 ? [S / 2 + x * R, S / 2 - y * R, z] : null; // east (Crisium) to the right, north up
  };
  // A point a given angle and bearing away on the sphere (bearing from north, clockwise toward east).
  const offset = (lat, lon, dist, brg) => {
    const p1 = lat * D,
      l1 = lon * D,
      d = dist * D;
    const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(brg));
    const l2 = l1 + Math.atan2(Math.sin(brg) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
    return [p2 / D, l2 / D];
  };
  // Highlands: bright and evenly cratered; brighter still in the south.
  g.fillStyle = '#000';
  g.fillRect(0, 0, S, S);
  g.save();
  g.beginPath();
  g.arc(S / 2, S / 2, R, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = 'rgb(200,200,200)';
  g.fillRect(0, 0, S, S);
  const grd = g.createLinearGradient(0, 0, 0, S);
  grd.addColorStop(0, 'rgba(0,0,0,.06)');
  grd.addColorStop(1, 'rgba(255,255,255,.08)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  for (let k = 0; k < 2600; k++) {
    const p = proj(Math.asin(rnd() * 2 - 1) / D, (rnd() * 2 - 1) * 90);
    if (!p) continue;
    const r = (0.6 + rnd() ** 4 * 4) * (0.4 + 0.6 * p[2]);
    g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)';
    g.beginPath();
    g.ellipse(p[0], p[1], r, r * (0.4 + 0.6 * p[2]), 0, 0, Math.PI * 2);
    g.fill();
  }
  // Maria: [lat, lon, radius°, darkness 0–1]. Procellarum and Frigoris are chains of lobes.
  const MARIA = [
    [33, -17, 18, 0.62],
    [41, -29, 8, 0.6],
    [44, -31, 5, 0.55],
    [26, -8, 8, 0.6], // Imbrium, Sinus Iridum's bay, the Archimedes side
    [28, 17, 12.5, 0.5],
    [8.5, 31, 13, 0.72],
    [15, 24, 7, 0.7],
    [2, 38, 8, 0.7], // Serenitatis (paler), Tranquillitatis
    [17, 59, 9, 0.8],
    [-7, 51, 11, 0.62],
    [-2, 56, 7, 0.6],
    [-15, 35, 6.5, 0.6], // Crisium, Fecunditatis, Nectaris
    [13, 4, 5, 0.55],
    [2, 1, 4, 0.5],
    [-20, -16, 12, 0.6],
    [-10, -22, 7.5, 0.58], // Vaporum, Sinus Medii, Nubium, Cognitum
    [-24, -39, 7.5, 0.66],
    [7, -30, 10, 0.6], // Humorum, Insularum
    [36, -55, 11, 0.7],
    [22, -58, 13, 0.74],
    [8, -56, 12, 0.72],
    [-4, -48, 11, 0.68],
    [28, -46, 9, 0.7],
    [14, -42, 9, 0.66],
    [46, -43, 7, 0.6], // Oceanus Procellarum
    [56, -38, 5, 0.5],
    [57, -20, 5.5, 0.52],
    [56, -2, 5, 0.5],
    [58, 14, 5, 0.5],
    [57, 30, 4.5, 0.48], // Mare Frigoris
    [13, 86, 5, 0.6],
    [-1, 86, 5, 0.6],
    [-5, -68.5, 3.5, 0.85],
    [51.6, -9.4, 1.6, 0.8], // Marginis, Smythii, Grimaldi, Plato's dark floor
  ];
  // Maria go on their own layer (white = no mare), each a filled shore with an
  // irregular edge; overlapping lobes keep the darker of the two. The layer is
  // then blurred and multiplied in, so the basalt floods have soft shores.
  const ml = document.createElement('canvas');
  ml.width = ml.height = S;
  const m2 = ml.getContext('2d');
  m2.fillStyle = '#fff';
  m2.fillRect(0, 0, S, S);
  m2.globalCompositeOperation = 'darken';
  for (const [lat, lon, rad, dk] of MARIA) {
    const w = rnd() * 6,
      v = Math.round(255 * (1 - 0.5 * dk));
    m2.fillStyle = `rgb(${v},${v},${v})`;
    m2.beginPath();
    for (let k = 0; k <= 48; k++) {
      const b = (k / 48) * TAU,
        e = rad * (1 + 0.12 * Math.sin(b * 3 + w) + 0.07 * Math.sin(b * 7 + w * 2) + 0.04 * Math.sin(b * 13 + w * 3));
      const p = proj(...offset(lat, lon, e, b)) ?? proj(...offset(lat, lon, Math.min(e, 89.9 - Math.abs(lon)), b));
      if (p) m2.lineTo(p[0], p[1]);
    }
    m2.fill();
  }
  // Tone inside the maria: the younger, darker flows and the paler patches.
  m2.globalCompositeOperation = 'multiply';
  for (let k = 0; k < 500; k++) {
    const x = rnd() * S,
      y = rnd() * S,
      r = 10 + rnd() * 24;
    m2.fillStyle = 'rgba(215,215,215,.12)';
    m2.beginPath();
    m2.arc(x, y, r, 0, TAU);
    m2.fill();
  }
  g.globalCompositeOperation = 'multiply';
  g.filter = 'blur(3.5px)';
  g.drawImage(ml, 0, 0);
  g.filter = 'none';
  g.globalCompositeOperation = 'source-over';
  // Rayed craters: [lat, lon, crater radius°, ray count, ray length°, strength].
  // Rays are broad, faint and slightly curved streaks of fresh ejecta, not lines:
  // drawn on their own layer, widening as they run, then softened.
  const RAYED = [
    [-43.3, -11.2, 1.2, 12, 50, 1],
    [9.6, -20.1, 1.1, 14, 15, 0.8],
    [8.1, -38, 0.7, 10, 9, 0.6],
    [23.7, -47.4, 0.5, 6, 5, 0.7],
    [16.1, 46.8, 0.5, 4, 9, 0.5],
  ];
  const rl = document.createElement('canvas');
  rl.width = rl.height = S;
  const r2 = rl.getContext('2d');
  r2.lineCap = 'round';
  for (const [lat, lon, cr, rays, len, k] of RAYED) {
    for (let r = 0; r < rays; r++) {
      const brg = (r / rays) * TAU + rnd() * 0.5,
        L = len * (0.3 + rnd() ** 1.5 * 0.7),
        bend = (rnd() - 0.5) * 0.008;
      let prev = null;
      for (let s = cr * 1.5; s < L; s += 0.6) {
        const p = proj(...offset(lat, lon, s, brg + bend * s));
        if (!p) break;
        if (prev) {
          r2.strokeStyle = `rgba(255,255,255,${(k * 0.09 * (1 - s / L) ** 1.3).toFixed(3)})`;
          r2.lineWidth = (3 + s * 0.3) * (0.4 + 0.6 * p[2]);
          r2.beginPath();
          r2.moveTo(prev[0], prev[1]);
          r2.lineTo(p[0], p[1]);
          r2.stroke();
        }
        prev = p;
      }
    }
    // The bright ejecta blanket round the rim, and the crater itself.
    const p = proj(lat, lon),
      rr = cr * D * R * 3.2;
    const halo = r2.createRadialGradient(p[0], p[1], 0, p[0], p[1], rr);
    halo.addColorStop(0, `rgba(255,255,255,${0.7 * k})`);
    halo.addColorStop(0.3, `rgba(255,255,255,${0.35 * k})`);
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    r2.fillStyle = halo;
    r2.beginPath();
    r2.arc(p[0], p[1], rr, 0, TAU);
    r2.fill();
  }
  g.globalCompositeOperation = 'lighter';
  g.filter = 'blur(2.5px)';
  g.globalAlpha = 0.7;
  g.drawImage(rl, 0, 0);
  g.globalAlpha = 1;
  g.filter = 'none';
  g.globalCompositeOperation = 'source-over';
  g.restore();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = MAX_ANISO;
  return t;
})();
// Sky position of the moon's north pole: a moon rising in the east at 46° N
// leans its north 43° to the left of straight up (the parallactic angle).
const MOON_TILT = 0.75;

// Clear night under a full moon: ink-blue overhead, only the brighter stars
// (the Milky Way is washed out by the moon), and a low amber glow where
// distant towns sit. The named stars are drawn separately (STARS, below).
export const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
  uniforms: {
    uSun: { value: SUN_DIR },
    uTime: { value: 0 },
    uDusk: { value: 0 },
    uMoon: { value: moonTex },
    uSkyMul: { value: new THREE.Vector3(1, 1, 1) },
    uHorAdd: { value: new THREE.Vector3() },
    uCloudK: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec3 vDir;
    void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uSun, uSkyMul, uHorAdd; uniform float uTime, uDusk, uCloudK; uniform sampler2D uMoon; varying vec3 vDir;
    float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
    float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
    float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * n2(p); p = p * 2.03 + 17.0; a *= 0.5; } return v; }
    void main() {
      vec3 d = normalize(vDir); float h = d.y;
      vec3 zen = vec3(0.004, 0.006, 0.016), mid = vec3(0.012, 0.019, 0.042);
      vec3 hor = vec3(0.070, 0.064, 0.086), town = vec3(0.34, 0.17, 0.07);
      vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, h));
      c = mix(c, zen, smoothstep(0.15, 0.7, h));
      // Blue hour (uDusk = 1): the same sky an hour earlier, cobalt overhead,
      // a cool bright horizon and the last warm afterglow opposite the moon.
      vec3 dc = mix(vec3(0.30, 0.34, 0.47), vec3(0.11, 0.17, 0.34), smoothstep(0.0, 0.2, h));
      dc = mix(dc, vec3(0.04, 0.075, 0.19), smoothstep(0.18, 0.8, h));
      float aft = pow(max(-dot(normalize(d.xz + 1e-4), normalize(uSun.xz)), 0.0), 2.0);
      dc += vec3(0.30, 0.15, 0.08) * aft * (1.0 - smoothstep(0.0, 0.16, h));
      c = mix(c, dc, uDusk);
      float night = (1.0 - uDusk) * (1.0 - uDusk);
      // Light pollution from the towns beyond the hills: warm, low, patchy.
      float az = atan(d.z, d.x);
      float towns = 0.5 + 0.5 * sin(az * 3.0 + 1.3) * sin(az * 7.0 - 0.4);
      c += town * (1.0 - smoothstep(0.0, 0.12, h)) * (0.3 + 0.7 * towns) * 0.3;
      // Background stars, magnitude 3.5 to 4.5: under a full moon that is about
      // as faint as the eye goes, so a few hundred, not thousands, thinning
      // further in the moon's glare and toward the hazy horizon. Each takes a
      // colour from the real spread (blue-white through to orange).
      float s = max(dot(d, uSun), 0.0);
      float th = sqrt(max(2.0 - 2.0 * s, 0.0)); // angle from the moon, radians
      float vis = smoothstep(0.06, 0.4, h) * smoothstep(0.15, 1.0, th);
      vec3 sc = floor(d * 300.0);
      float sh = hash(sc), sk = hash(sc + 5.3);
      vec3 tint = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.8, 0.6), sk * sk);
      c += tint * step(0.99965, sh) * (0.12 + 0.3 * fract(sh * 913.0)) * vis * night;
      // Broken cloud left by the rain: a high deck projected on a plane, drifting
      // slowly, silvered where it thins near the moon and warmed underneath by
      // the towns. It hides stars behind it, which is what makes it read as cloud.
      // Moonglow: the whole quarter of sky round the moon lifts, cool and soft.
      c += vec3(0.05, 0.065, 0.11) * exp(-th / 0.5) * 0.55 + vec3(0.03, 0.04, 0.07) * exp(-th / 1.1) * 0.35;
      vec2 cp = d.xz / max(h + 0.08, 0.08) * 0.9 + vec2(uTime * 0.006, uTime * 0.0025);
      float cn = fbm(cp);
      float cov = min(smoothstep(0.48, 0.78, cn) * smoothstep(0.0, 0.16, h) * (1.0 - 0.6 * smoothstep(0.55, 0.95, h)) * uCloudK, 1.0);
      vec3 cloud = vec3(0.02, 0.025, 0.04) + vec3(0.22, 0.24, 0.3) * exp(-th / 0.22) * (1.0 - smoothstep(0.62, 0.9, cn))
                 + town * 0.06 * (1.0 - smoothstep(0.0, 0.3, h));
      cloud = mix(cloud, vec3(0.13, 0.16, 0.26) + vec3(0.2, 0.21, 0.26) * exp(-th / 0.3), uDusk);
      c = mix(c, cloud, cov * 0.92);
      // Season grade: the whole sky tinted, and a low band of seasonal air (summer haze, winter snow-light).
      c = c * uSkyMul + uHorAdd * (1.0 - smoothstep(0.0, 0.3, h)) * (1.0 - 0.5 * uDusk);
      // Moon: a cinematic 1.8° full moon from its real map (moonTex), its north
      // leaning ${(MOON_TILT * 57.3).toFixed(0)}° left as it does rising in the east. A full moon has
      // almost no limb darkening, so the disc stays even to its edge.
      vec3 t1 = normalize(cross(uSun, vec3(0.0, 1.0, 0.0))), t2 = cross(t1, uSun);
      vec2 mp = vec2(dot(d, t1), dot(d, t2)) / 0.0314;
      float disc = 1.0 - smoothstep(0.96, 1.0, length(mp));
      const float CT = ${Math.cos(MOON_TILT).toFixed(4)}, ST = ${Math.sin(MOON_TILT).toFixed(4)};
      vec2 lm = vec2(CT * mp.x + ST * mp.y, -ST * mp.x + CT * mp.y); // screen → lunar east/north
      float alb = texture2D(uMoon, lm * 0.5 + 0.5).r; // flipY: canvas top (north) is v = 1
      vec3 moon = vec3(1.0, 0.97, 0.92) * (0.18 + 0.82 * alb) * (0.97 + 0.03 * length(mp)); // kept below white so the maria read
      disc *= step(0.9, s); // the projection repeats on the far side of the sky
      c = mix(c, moon, disc * (1.0 - cov * 0.55));
      // Halo: a tight bright corona and a wide cool bloom, both outside the disc.
      c += (vec3(0.55, 0.6, 0.75) * exp(-th / 0.045) * 0.5 + vec3(0.16, 0.2, 0.32) * exp(-th / 0.16) * 0.35) * (1.0 - disc);
      c = mix(c, vec3(0.012, 0.012, 0.02), smoothstep(0.0, -0.06, h));
      gl_FragColor = vec4(c, 1.0);
    }`,
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 24), skyMat));
const SKY_ENV = skyMat.clone(); // the reflection probe keeps a still, cloud-at-t0 copy

/* The named stars: the real sky over the Alps (46° N) on an early-autumn
   evening, so the constellations are the ones actually up. The Summer
   Triangle high in the west, Cassiopeia and Perseus in the north-east, the
   Square of Pegasus and Andromeda in the east, the Plough low in the north,
   Arcturus setting, the Pleiades and Capella just risen. Each is placed
   from its right ascension and declination at local sidereal time 18.8 h,
   which puts the full moon (RA 0 h, Dec 0°) 8.6° up, just south of east:
   where MOON_AZ has it. Brightness follows magnitude (each step is ×2.5),
   colour follows B−V, and stars low in the sky dim with the extra air and
   twinkle harder. One Points draw, 105 vertices; the cloud deck is
   evaluated per star (not per pixel) so cloud still hides them. */
export const STARS = (() => {
  // [RA h, Dec °, V mag, B−V]
  const CAT = [
    [18.615, 38.78, 0.03, 0.0],
    [14.261, 19.18, -0.05, 1.23],
    [5.278, 46.0, 0.08, 0.8],
    [19.846, 8.87, 0.77, 0.22],
    [20.69, 45.28, 1.25, 0.09],
    [22.961, -29.62, 1.16, 0.09],
    [16.49, -26.43, 1.06, 1.83],
    [4.599, 16.51, 0.86, 1.54],
    [5.992, 44.95, 1.9, 0.08],
    // Pegasus, Andromeda, Aries, Cetus
    [0.14, 29.09, 2.06, -0.11],
    [23.063, 28.08, 2.42, 1.67],
    [23.079, 15.21, 2.49, -0.04],
    [0.221, 15.18, 2.83, -0.23],
    [21.736, 9.88, 2.38, 1.52],
    [22.717, 30.22, 2.94, 0.86],
    [22.691, 10.83, 3.4, 0.93],
    [1.162, 35.62, 2.05, 1.58],
    [2.065, 42.33, 2.1, 1.37],
    [0.656, 30.86, 3.27, 1.27],
    [2.12, 23.46, 2.0, 1.15],
    [1.911, 20.81, 2.64, 0.13],
    [0.727, -17.99, 2.04, 1.02],
    [3.038, 4.09, 2.54, 1.64],
    // Perseus, Pleiades, Cassiopeia, Cepheus, Polaris and the Little Dipper
    [3.405, 49.86, 1.79, 0.48],
    [3.136, 40.96, 2.12, -0.05],
    [3.964, 40.01, 2.89, -0.2],
    [3.715, 47.79, 3.01, -0.12],
    [3.08, 53.51, 2.93, 0.7],
    [3.791, 24.11, 2.87, -0.09],
    [3.819, 24.05, 3.62, -0.08],
    [3.748, 24.11, 3.7, -0.11],
    [3.763, 24.37, 3.87, -0.07],
    [3.772, 23.95, 4.18, -0.06],
    [0.675, 56.54, 2.24, 1.17],
    [0.153, 59.15, 2.28, 0.34],
    [0.945, 60.72, 2.15, -0.15],
    [1.43, 60.24, 2.66, 0.13],
    [1.907, 63.67, 3.35, -0.15],
    [21.31, 62.59, 2.45, 0.22],
    [21.478, 70.56, 3.23, -0.22],
    [23.656, 77.63, 3.21, 1.03],
    [22.181, 58.2, 3.39, 1.56],
    [2.53, 89.26, 1.98, 0.6],
    [14.845, 74.16, 2.08, 1.47],
    [15.345, 71.83, 3.05, 0.05],
    [17.537, 86.59, 4.36, 0.02],
    [16.766, 82.04, 4.23, 0.04],
    // The Plough, low in the north
    [11.062, 61.75, 1.79, 1.07],
    [11.031, 56.38, 2.37, -0.02],
    [11.897, 53.69, 2.44, 0.04],
    [12.257, 57.03, 3.31, 0.08],
    [12.9, 55.96, 1.77, -0.02],
    [13.399, 54.93, 2.27, 0.02],
    [13.792, 49.31, 1.86, -0.1],
    // Cygnus, Lyra, Aquila, Delphinus
    [20.37, 40.26, 2.23, 0.67],
    [20.77, 33.97, 2.48, 1.03],
    [19.75, 45.13, 2.87, -0.03],
    [19.512, 27.96, 3.05, 1.13],
    [18.835, 33.36, 3.52, 0.0],
    [18.982, 32.69, 3.25, -0.05],
    [18.746, 37.6, 4.36, 0.19],
    [19.771, 10.61, 2.72, 1.52],
    [19.922, 6.41, 3.71, 0.86],
    [19.09, 13.86, 2.99, 0.01],
    [19.425, 3.11, 3.36, 0.32],
    [20.626, 14.6, 3.63, 0.44],
    [20.661, 15.91, 3.77, -0.06],
    [20.777, 16.12, 3.9, 1.0],
    [20.724, 15.07, 4.43, 0.3],
    [20.553, 11.3, 4.03, -0.1],
    // Hercules, Corona Borealis, Boötes, Draco, Ophiuchus, Serpens
    [16.504, 21.49, 2.77, 0.95],
    [16.688, 31.6, 2.81, 0.65],
    [16.715, 38.92, 3.48, 0.92],
    [17.251, 36.81, 3.16, 1.44],
    [17.005, 30.93, 3.92, -0.01],
    [17.244, 14.39, 3.48, 1.16],
    [15.578, 26.71, 2.23, -0.02],
    [15.464, 29.11, 3.66, 0.28],
    [15.712, 26.3, 3.81, 0.0],
    [14.75, 27.07, 2.37, 0.97],
    [13.911, 18.4, 2.68, 0.58],
    [14.535, 38.31, 3.03, 0.19],
    [15.032, 40.39, 3.49, 0.97],
    [17.943, 51.49, 2.23, 1.52],
    [17.507, 52.3, 2.79, 0.98],
    [14.073, 64.38, 3.65, -0.05],
    [17.146, 65.71, 3.17, -0.12],
    [19.209, 67.66, 3.07, 0.99],
    [16.4, 61.51, 2.74, 0.91],
    [12.558, 69.79, 3.87, -0.12],
    [17.582, 12.56, 2.08, 0.15],
    [17.173, -15.72, 2.43, 0.06],
    [17.725, 4.57, 2.76, 1.16],
    [16.239, -3.69, 2.73, 1.58],
    [16.619, -10.57, 2.56, 0.04],
    [15.738, 6.43, 2.63, 1.17],
    // Sagittarius's teapot and Capricornus, low in the south; Aquarius
    [18.403, -34.38, 1.79, -0.03],
    [18.921, -26.3, 2.05, -0.13],
    [18.35, -29.83, 2.7, 1.38],
    [18.466, -25.42, 2.81, 1.04],
    [19.044, -29.88, 2.6, 0.08],
    [18.294, -36.76, 3.11, 1.0],
    [21.784, -16.13, 2.87, 0.29],
    [20.35, -14.78, 3.08, 0.79],
    [21.526, -5.57, 2.91, 0.83],
    [22.096, -0.32, 2.95, 0.98],
  ];
  const LAT = (46 * Math.PI) / 180,
    LST = 18.8;
  // Local (east, north, up) of a star; north is up × east in three's frame.
  const local = (ra, dec) => {
    const H = ((LST - ra) * Math.PI) / 12,
      d = (dec * Math.PI) / 180;
    return [
      -Math.cos(d) * Math.sin(H),
      Math.cos(LAT) * Math.sin(d) - Math.sin(LAT) * Math.cos(d) * Math.cos(H),
      Math.sin(LAT) * Math.sin(d) + Math.cos(LAT) * Math.cos(d) * Math.cos(H),
    ];
  };
  // Turn the compass so the real moon lands on SUN_DIR's bearing.
  const [me, mn] = local(0, 0);
  const yaw = Math.atan2(SUN_DIR.x, SUN_DIR.z) - Math.atan2(me, -mn);
  const n = CAT.length,
    pos = new Float32Array(n * 3),
    col = new Float32Array(n * 3),
    mag = new Float32Array(n),
    v = new THREE.Vector3();
  // B−V to a colour, desaturated the way the eye sees starlight at night.
  const bv = [
    [-0.3, [0.66, 0.75, 1.0]],
    [0.0, [0.82, 0.87, 1.0]],
    [0.6, [1.0, 0.96, 0.89]],
    [1.2, [1.0, 0.85, 0.68]],
    [1.9, [1.0, 0.74, 0.52]],
  ];
  CAT.forEach(([ra, dec, m, ci], k) => {
    const [e, nn, u] = local(ra, dec);
    v.set(e, u, -nn)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
      .multiplyScalar(1700);
    pos.set([v.x, v.y, v.z], k * 3);
    let j = 0;
    while (j < bv.length - 2 && ci > bv[j + 1][0]) j++;
    const f = Math.min(Math.max((ci - bv[j][0]) / (bv[j + 1][0] - bv[j][0]), 0), 1);
    for (let c = 0; c < 3; c++) col[k * 3 + c] = bv[j][1][c] + (bv[j + 1][1][c] - bv[j][1][c]) * f;
    mag[k] = m;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: skyMat.uniforms.uTime,
      uDusk: skyMat.uniforms.uDusk,
      uSun: { value: SUN_DIR },
      uPx: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float aMag; attribute vec3 aCol;
      uniform float uTime, uDusk, uPx; uniform vec3 uSun;
      varying vec3 vCol; varying float vA;
      float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * n2(p); p = p * 2.03 + 17.0; a *= 0.5; } return v; }
      void main() {
        vec3 d = normalize(position); float h = d.y;
        // Extinction: the air between us and a low star costs it about 0.25 mag per airmass.
        float m = aMag + 0.25 * (1.0 / max(h, 0.06) - 1.0);
        float flux = pow(10.0, -0.4 * (m - 1.0));
        // Twinkle: scintillation is strongest near the horizon, barely there overhead.
        float seed = fract(sin(dot(position.xz, vec2(12.9, 78.2))) * 43758.5);
        float tw = (1.0 - smoothstep(0.08, 0.6, h)) * 0.45 + 0.06;
        flux *= 1.0 + tw * (0.6 * sin(uTime * 11.0 + seed * 40.0) + 0.4 * sin(uTime * 23.7 + seed * 17.0));
        // The same cloud deck and moon glare as the sky shader, sampled once per star.
        float s = max(dot(d, uSun), 0.0), th = sqrt(max(2.0 - 2.0 * s, 0.0));
        vec2 cp = d.xz / max(h + 0.08, 0.08) * 0.9 + vec2(uTime * 0.006, uTime * 0.0025);
        float cn = fbm(cp);
        float cov = smoothstep(0.48, 0.78, cn) * smoothstep(0.0, 0.16, h) * (1.0 - 0.6 * smoothstep(0.55, 0.95, h));
        float night = (1.0 - uDusk) * (1.0 - uDusk);
        // At blue hour only the brightest show (Vega, Arcturus, Capella first).
        float early = 1.0 - smoothstep(0.0, 1.4, aMag);
        vA = flux * (1.0 - cov * 0.97) * smoothstep(0.1, 0.7, th) * smoothstep(0.015, 0.08, h) * mix(night, 0.5, early * uDusk);
        vCol = aCol;
        gl_PointSize = (2.6 + 3.0 * sqrt(min(flux, 4.0))) * uPx;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol; varying float vA;
      void main() {
        vec2 q = gl_PointCoord * 2.0 - 1.0;
        float a = exp(-dot(q, q) * 3.2) * vA;
        gl_FragColor = vec4(vCol * a * 2.2, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  mat.userData.noZone = true;
  const pts = new THREE.Points(geo, mat);
  pts.userData.static = true;
  pts.renderOrder = -10;
  pts.frustumCulled = false;
  scene.add(pts);
  return pts;
})();

// Reflections come from the same sky.
{
  const pm = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), SKY_ENV));
  // Soft cloud-lit panels that only the reflections see, so the curtain
  // wall picks up long, graded highlights instead of mirroring a flat sky.
  const softbox = (color, k, w, h, pos) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }),
    );
    m.position.copy(pos);
    m.lookAt(0, 0, 0);
    envScene.add(m);
  };
  // At night the glass and wet stone mirror moonlit sky and the warm haze of
  // distant towns, so the softboxes turn cool overhead and amber low down.
  softbox(0x6f84b8, 0.22, 160, 22, new THREE.Vector3(60, 26, 70));
  softbox(0xffb070, 0.28, 140, 10, new THREE.Vector3(-70, 6, -50));
  softbox(0x8fa2d0, 0.14, 90, 60, new THREE.Vector3(0, 80, 20));
  // Compile the sky's programs in parallel first (KHR_parallel_shader_compile),
  // in the linear render-target variant the pre-filter draws with. On a first
  // visit, with no shader cache, compiling them inside fromScene() held the
  // page for ~0.3 s.
  const linear = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  renderer.setRenderTarget(linear);
  await renderer.compileAsync(envScene, new THREE.PerspectiveCamera()).catch(() => {});
  renderer.setRenderTarget(null);
  linear.dispose();
  scene.environment = pm.fromScene(envScene, 0.02).texture;
  scene.environmentIntensity = 1.0;
}

scene.add(new THREE.HemisphereLight(0x4a5c88, 0x15110e, 0.6));
export const hemi = scene.children[scene.children.length - 1];
export const sun = new THREE.DirectionalLight(0xb4c6ff, 0.95); // moonlight
sun.position.copy(SUN_DIR).multiplyScalar(160);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 70, bottom: -20, near: 10, far: 400 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
scene.add(sun);
export const fill = new THREE.DirectionalLight(0x7088c8, 0.4);
fill.position.set(80, 60, 110);
scene.add(fill);
