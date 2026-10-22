import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MAX_ANISO, mulberry, yieldToBrowser } from '../core/util.js';
import {
  barkTex,
  bronzeTex,
  fabricTex,
  graniteTex,
  grateTex,
  gravelTex,
  leafMassTex,
  matTex,
  tactileTex,
  textureCanvas,
  timber,
} from '../textures/procedural.js';
import { renderer, scene, sun } from '../core/scene.js';
import { useScan } from '../textures/scanned.js';
import { M } from './materials.js';
import { SNOW_GLINT, SNOW_GLSL } from './snow.js';

/* ════════════════════════════════════════════════════════════════════════
   Ground-level kit: extra textures, rounded parts, light/AO decals,
   wet stone, an interior-mapped lobby and a mirror pool.
   ════════════════════════════════════════════════════════════════════════ */

await yieldToBrowser(); // a fresh slice for this build step (util.js)

// The house: every part of the tower hangs off this group (added to the scene in tower/base.js).
export const building = new THREE.Group();

// Nothing moves that casts a shadow, so the shadow map is drawn once.
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
renderer.toneMappingExposure = 1.65;
export const EXPOSURE = 1.65; // scaled per season in seasonStep()
Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 40, bottom: -30 });
sun.shadow.camera.updateProjectionMatrix();

// Ornamental grass blades with alpha: feather-reed straw over green.
const bladeTex = (() => {
  const rnd = mulberry(69),
    c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 55; i++) {
    const bx = 64 + (rnd() - 0.5) * 26,
      lean = (rnd() - 0.5) * 110,
      top = 20 + rnd() * 70,
      wdt = 1.5 + rnd() * 2.2;
    const tone = rnd();
    g.fillStyle =
      tone < 0.45
        ? `rgb(${(170 + rnd() * 40) | 0},${(150 + rnd() * 30) | 0},${(95 + rnd() * 30) | 0})`
        : `rgb(${(70 + rnd() * 40) | 0},${(95 + rnd() * 40) | 0},${(45 + rnd() * 20) | 0})`;
    g.beginPath();
    g.moveTo(bx - wdt, 256);
    g.quadraticCurveTo(bx + lean * 0.2, 140, bx + lean, top);
    g.quadraticCurveTo(bx + lean * 0.2 + wdt, 140, bx + wdt, 256);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

// Soft cloud for drifting ground mist.
export const mistTex = (() => {
  const rnd = mulberry(71),
    c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 40; i++) {
    const x = 40 + rnd() * 176,
      y = 40 + rnd() * 48,
      r = 20 + rnd() * 40;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,.22)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

Object.assign(M, {
  steel: new THREE.MeshStandardMaterial({
    color: 0x2c2926,
    metalness: 0.7,
    roughness: 1,
    ...bronzeTex,
    envMapIntensity: 0.9,
  }),
  gravel: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    ...gravelTex,
    normalScale: new THREE.Vector2(1, 1),
    envMapIntensity: 0.5,
  }),
  tactile: new THREE.MeshStandardMaterial({ color: 0xffffff, ...tactileTex, envMapIntensity: 0.8 }),
  grate: new THREE.MeshStandardMaterial({ color: 0xffffff, ...grateTex, metalness: 0.8, envMapIntensity: 1.2 }),
  mat: new THREE.MeshStandardMaterial({ color: 0xffffff, ...matTex }),
  bark: new THREE.MeshStandardMaterial({ color: 0xffffff, ...barkTex }),
  leaf: new THREE.MeshStandardMaterial({
    color: 0xc9d4a8,
    ...leafMassTex,
    normalScale: new THREE.Vector2(1.4, 1.4),
    envMapIntensity: 0.5,
  }),
  soil: new THREE.MeshStandardMaterial({ color: 0x1b1510, roughness: 1 }),
  rug: new THREE.MeshPhysicalMaterial({
    color: 0x5a5048,
    ...fabricTex,
    sheen: 1,
    sheenRoughness: 0.8,
    sheenColor: 0x9a8a78,
  }),
  tuft: new THREE.MeshStandardMaterial({
    map: bladeTex,
    alphaTest: 0.4,
    alphaToCoverage: true,
    side: THREE.DoubleSide,
    roughness: 0.85,
  }),
  stoneDark: new THREE.MeshStandardMaterial({ color: 0x6e6862, ...graniteTex, envMapIntensity: 0.9 }),
  lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd2a0).multiplyScalar(1.7), toneMapped: false }),
});
// Scanned surfaces replace the procedural ones as they arrive (see useScan).
useScan(M.pavers, 'concrete_pavement', 3);
useScan(M.fascia, 'brushed_concrete', 2.5, ['normalMap', 'roughnessMap']);
useScan(M.timber, 'oak_veneer_01', 1.2);
useScan(M.bark, 'sakura_bark', 1);

/* Weathering on the fascias: the scan gives only relief and roughness, so a
   clean white slab can read as CG up close. Rain washes dust down each edge
   and leaves it at the drip line: a soft grey band along the underside with
   uneven vertical streaks, and a faint line of grit on the top arris. */
{
  const prev = M.fascia.onBeforeCompile;
  M.fascia.onBeforeCompile = (sh, r) => {
    prev.call(M.fascia, sh, r);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGrP, vGrL, vGrN;')
      .replace(
        '#include <project_vertex>',
        /* glsl */ `#include <project_vertex>
        vGrL = transformed;
        vGrP = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vGrN = normalize(mat3(modelMatrix) * objectNormal);`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        varying vec3 vGrP, vGrL, vGrN;
        float grH(float x) { return fract(sin(x * 127.1) * 43758.5453); }
        float grN(float x) { float i = floor(x), f = fract(x); return mix(grH(i), grH(i + 1.0), f * f * (3.0 - 2.0 * f)); }`,
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `#include <map_fragment>
        {
          float side = 1.0 - smoothstep(0.35, 0.7, abs(vGrN.y));
          float u = vGrP.x * 0.83 + vGrP.z * 1.17; // runs along the edge
          float streak = grN(u * 9.0) * 0.6 + grN(u * 31.0) * 0.4;
          float reach = 0.08 + 0.2 * streak * streak; // some streaks run further up the face
          float drip = smoothstep(reach, 0.0, vGrL.y) * (0.55 + 0.45 * streak);
          float grit = smoothstep(0.03, 0.0, abs(vGrL.y - 0.33)) * 0.25;
          float patchy = 0.7 + 0.3 * grN(u * 2.3 + vGrP.y * 0.7);
          diffuseColor.rgb *= 1.0 - side * (drip * 0.22 + grit) * patchy * vec3(1.0, 1.02, 1.06);
        }`,
      );
  };
  M.fascia.customProgramCacheKey = () => 'fascia-grime';
}

/* Rain has just stopped: flat stone darkens, gloss rises, and hollows
   hold mirror-flat puddles. A world-space noise field drives all three,
   so the pattern never repeats with the paver tile. */
function wetify(mat) {
  mat.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWetPos;\nvarying vec3 vWetN;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvWetPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWetN = normalize(mat3(modelMatrix) * objectNormal);',
      );
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        varying vec3 vWetPos; varying vec3 vWetN;
        float wetH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float wetN(vec2 p) {
          vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(wetH(i), wetH(i + vec2(1.0, 0.0)), f.x), mix(wetH(i + vec2(0.0, 1.0)), wetH(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        ${SNOW_GLSL}`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
        float wetUp = smoothstep(0.85, 0.98, vWetN.y);
        float wn = wetN(vWetPos.xz * 0.16) * 0.6 + wetN(vWetPos.xz * 0.55) * 0.3 + wetN(vWetPos.xz * 2.1) * 0.1;
        float puddle = smoothstep(0.6 - 0.1 * uWetK, 0.67 - 0.08 * uWetK, wn) * wetUp;
        float damp = smoothstep(0.3 - 0.25 * uWetK, 0.6 - 0.2 * uWetK, wn) * wetUp;
        float covered = step(abs(vWetPos.x), 10.4) * step(-7.6, vWetPos.z) * step(vWetPos.z, 11.8);
        float snowK = uSnowCover * wetUp * (1.0 - covered) * step(vWetPos.y, 1.2) * smoothstep(0.15, 0.45, wn + uSnowCover * 0.35);
        puddle *= 1.0 - snowK; damp *= 1.0 - snowK;
        roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.4, damp);
        roughnessFactor = mix(roughnessFactor, 0.04, puddle);
        diffuseColor.rgb *= mix(1.0, 0.58, max(damp * 0.6, puddle));
        diffuseColor.rgb = mix(diffuseColor.rgb, SNOW_COL, snowK);
        roughnessFactor = mix(roughnessFactor, 0.9, snowK);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
        normal = normalize(mix(normal, normalize(vNormal) * faceDirection, puddle));
        normal = normalize(normal + snowK * (viewMatrix * vec4(snBump(vWetPos), 0.0)).xyz);`,
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `
        // Wet-stone streaks: each light is mirrored below the surface and its
        // glint smeared along the view's vertical, tight in puddles and long
        // and soft on damp stone, the way lamps read on a rainy street.
        // Ground level only, so indoor travertine tops stay dry.
        if (vWetPos.y < 1.2) {
          vec3 pv = (viewMatrix * vec4(vWetPos, 1.0)).xyz;
          vec2 sp = pv.xy / -pv.z;
          float wet = (damp * 0.4 + puddle) * wetUp;
          float stretch = mix(7.0, 3.0, puddle);
          vec3 glint = vec3(0.0);
          for (int k = 0; k < ${GLINT_N}; k++) {
            vec4 L = uGlint[k];
            if (L.w <= 0.0) continue;
            vec3 lv = (viewMatrix * vec4(L.x, 2.0 * vWetPos.y - L.y, L.z, 1.0)).xyz;
            if (lv.z > -0.5) continue;
            float sx = L.w / -lv.z;
            vec2 dd = (sp - lv.xy / -lv.z) / vec2(sx, sx * stretch);
            glint += uGlintC * uGlintK[k] * exp(-dot(dd, dd));
          }
          outgoingLight += glint * wet;
        }
        outgoingLight += ${SNOW_GLINT} * snowK * snSparkle(vWetPos);
        #include <opaque_fragment>`,
      );
    s.fragmentShader = s.fragmentShader.replace(
      '#include <common>',
      `#include <common>\nuniform vec4 uGlint[${GLINT_N}];\nuniform float uGlintK[${GLINT_N}];\nuniform vec3 uGlintC;\nuniform float uWetK, uSnowCover;`,
    );
    Object.assign(s.uniforms, GLINT_U);
  };
}
// Light sources the wet stone mirrors (xyz world, w apparent radius) and their
// strengths; filled once the lobby, canopy, trees and bollards exist.
const GLINT_N = 28;
export const GLINT_U = {
  uGlint: { value: Array.from({ length: GLINT_N }, () => new THREE.Vector4()) },
  uGlintK: { value: new Array(GLINT_N).fill(0) },
  uGlintC: { value: new THREE.Color(0xffc48e) },
};
export function addGlint(x, y, z, size, k) {
  const i = GLINT_U.uGlintK.value.indexOf(0);
  if (i < 0) return;
  GLINT_U.uGlint.value[i].set(x, y, z, size);
  GLINT_U.uGlintK.value[i] = k;
}
wetify(M.travertine);
// At night a balustrade should read as a glint on its edge, not a wall.
Object.assign(M.rail, { opacity: 0.1, envMapIntensity: 0.9 });
M.travertine.envMapIntensity = 0.9;
// Soffits get their own pale limed-ash finish: under the warm cove the oak
// went saturated orange, while a near-neutral board lit by the same 2700 K
// light reads as soft warm white. Furniture and the canopy keep the oak.
M.soffit = (() => {
  const src = textureCanvas(timber.map),
    c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d');
  g.filter = 'saturate(0.18) brightness(1.55) contrast(0.85)';
  g.drawImage(src, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.copy(timber.map.repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = MAX_ANISO;
  return new THREE.MeshStandardMaterial({
    color: 0xe9e4dc,
    map: t,
    normalMap: timber.normalMap,
    normalScale: new THREE.Vector2(0.2, 0.2),
    roughnessMap: timber.roughnessMap,
    roughness: 1,
    envMapIntensity: 0.5,
  });
})();

/** Box UVs in metres, so tiled textures keep their real scale on any box. */
function metreUV(geo) {
  const p = geo.attributes.position,
    n = geo.attributes.normal,
    uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)),
      ay = Math.abs(n.getY(i)),
      az = Math.abs(n.getZ(i));
    if (ay >= ax && ay >= az) uv.setXY(i, p.getX(i), p.getZ(i));
    else if (ax >= az) uv.setXY(i, p.getZ(i), p.getY(i));
    else uv.setXY(i, p.getX(i), p.getY(i));
  }
  uv.needsUpdate = true;
  return geo;
}
/** A box with eased edges: every arris catches a thin line of light. */
export function rbox(w, h, d, mat, r = 0.012, uv = true) {
  const geo = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w * 0.49, h * 0.49, d * 0.49));
  if (uv) metreUV(geo);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}
export function at(m, x, y, z, parent = building) {
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/* Light and contact-shadow decals. A rounded-rect signed distance field
   on a floor plane: `pool` glows on and around the shape, `outside` only
   beyond its edge. Light adds; AO multiplies. Painted once, no lights. */
const DECAL_V = /* glsl */ `
  varying vec2 vP;
  void main() {
    vP = position.xz;
    vec4 w = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      w = instanceMatrix * w;
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * w;
  }`;
const DECAL_F = /* glsl */ `
  uniform vec3 uColor; uniform vec2 uB; uniform float uR, uReach, uStrength, uKind, uAO;
  varying vec2 vP;
  float sdRR(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
  void main() {
    float d = sdRR(vP, uB, uR), f;
    if (uKind < 0.5) { f = 1.0 - clamp(max(d, 0.0) / uReach, 0.0, 1.0); f = f * f * f; }
    else f = d < 0.0 ? 0.0 : pow(1.0 - clamp(d / uReach, 0.0, 1.0), 2.4);
    gl_FragColor = uAO > 0.5 ? vec4(vec3(1.0 - f * uStrength), 1.0) : vec4(uColor * f * uStrength, 1.0);
  }`;
export function decalMat({
  w = 0,
  d = 0,
  r = 0,
  reach = 1,
  color = 0xffc48e,
  strength = 1,
  kind = 'pool',
  ao = false,
}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uB: { value: new THREE.Vector2(w / 2, d / 2) },
      uR: { value: r },
      uReach: { value: reach },
      uStrength: { value: strength },
      uKind: { value: kind === 'pool' ? 0 : 1 },
      uAO: { value: ao ? 1 : 0 },
    },
    vertexShader: DECAL_V,
    fragmentShader: DECAL_F,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
    blending: THREE.CustomBlending,
    blendSrc: ao ? THREE.ZeroFactor : THREE.OneFactor,
    blendDst: ao ? THREE.SrcColorFactor : THREE.OneFactor,
  });
}
export function decal(o, x, y, z, rotY = 0, parent = building) {
  const pad = (o.reach || 1) * 2;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry((o.w || 0) + pad, (o.d || 0) + pad).rotateX(-Math.PI / 2),
    decalMat(o),
  );
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  m.renderOrder = o.ao ? -3 : -2;
  parent.add(m);
  return m;
}
export const ao = (o, x, y, z, rotY = 0, parent = building) =>
  decal({ ao: true, kind: 'outside', strength: 0.5, ...o }, x, y, z, rotY, parent);

/* Vertical light wash in world height: uplight grazing a column, or a
   hidden strip washing down a riser or the plinth's shadow gap. */
export function washMat({ color = 0xffc48e, y0, y1, strength = 1, up = true }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uY: { value: new THREE.Vector2(y0, y1) },
      uS: { value: strength },
      uUp: { value: up ? 1 : 0 },
    },
    vertexShader: /* glsl */ `varying float vY; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform vec2 uY; uniform float uS, uUp; varying float vY;
      void main() {
        float t = clamp((vY - uY.x) / (uY.y - uY.x), 0.0, 1.0);
        float f = uUp > 0.5 ? pow(1.0 - t, 1.8) : pow(t, 2.6);
        gl_FragColor = vec4(uColor * f * uS, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });
}

/* Halos: soft additive glows round every small light source. */
export const haloMats = [];
export function halos(points, size, color = 0xffc896, strength = 0.5) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uSize: { value: size },
      uScale: { value: 400 },
      uColor: { value: new THREE.Color(color).multiplyScalar(strength) },
    },
    vertexShader: /* glsl */ `
      uniform float uSize, uScale;
      void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(uSize * uScale / -mv.z, 1.0, 220.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      void main() { float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; float a = pow(1.0 - r, 2.6); gl_FragColor = vec4(uColor * a, 1.0); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  haloMats.push(mat);
  const pts = new THREE.Points(new THREE.BufferGeometry().setFromPoints(points), mat);
  pts.renderOrder = 5;
  scene.add(pts);
  return pts;
}

/* Lettering drawn to canvas: a crisp mask for the bronze letters and a
   blurred copy for the light that spills on the wall behind them. */
try {
  await Promise.race([document.fonts.load('600 110px Inter'), new Promise((r) => setTimeout(r, 1500))]);
} catch {
  /* fall back */
}
function textCanvas(text, { w = 1024, h = 160, size = 104, spacing = 0.34, blur = 0, passes = 1 } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  g.font = `600 ${size}px Inter, 'Segoe UI', sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if ('letterSpacing' in g) g.letterSpacing = `${(size * spacing) | 0}px`;
  if (blur) g.filter = `blur(${blur}px)`;
  g.fillStyle = '#fff';
  for (let i = 0; i < passes; i++) g.fillText(text, w / 2, h / 2 + 4);
  return new THREE.CanvasTexture(c);
}
export function haloSign(text, width, height, parent, x, y, z, rotY) {
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  grp.rotation.y = rotY;
  parent.add(grp);
  const glowTexT = textCanvas(text, { blur: 16, passes: 3 });
  glowTexT.colorSpace = THREE.SRGBColorSpace;
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 1.15, height * 2.4),
    new THREE.MeshBasicMaterial({
      map: glowTexT,
      color: new THREE.Color(0xffc48e).multiplyScalar(1.3),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    }),
  );
  glow.position.z = 0.003;
  grp.add(glow);
  const letters = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshPhysicalMaterial({
      color: 0x8a7258,
      metalness: 0.9,
      roughness: 0.3,
      clearcoat: 0.4,
      alphaMap: textCanvas(text),
      alphaTest: 0.5,
      alphaToCoverage: true,
      envMapIntensity: 1.6,
    }),
  );
  letters.position.z = 0.035;
  letters.castShadow = true;
  grp.add(letters);
  // A dark copy just behind reads as the letters' 30 mm return depth.
  const edge = new THREE.Mesh(
    letters.geometry,
    new THREE.MeshBasicMaterial({ color: 0x0c0a08, alphaMap: letters.material.alphaMap, alphaTest: 0.5 }),
  );
  edge.position.set(0.004, -0.004, 0.02);
  grp.add(edge);
  return grp;
}
