import * as THREE from 'three';
import { MAX_ANISO, mulberry, TAU } from '../core/util.js';
import { scene } from '../core/scene.js';
import { M } from './materials.js';
import { mistTex } from './kit.js';
import { LEAF_LIT } from '../tower/furniture.js';
import { mist } from './ground.js';

/* ════════════════════════════════════════════════════════════════════════
   Atmosphere: forested ridgelines in
   layers of haze, slabs of mist at altitude, and wind in the planting. The
   techniques are re-written for this scene; nothing here adds a light or a
   render pass.
   ════════════════════════════════════════════════════════════════════════ */

/* Ridge silhouette painted to a wrapping canvas: integer-frequency ridged
   waves so the ring closes on itself, conifer spikes along the crest so it
   reads as forest, and a paler foot where mist settles in the valleys. */
function ridgeTex(seed, trees) {
  const rnd = mulberry(seed),
    W = 2048,
    H = 256;
  const waves = Array.from({ length: 14 }, (_, k) => [
    2 + k * (2 + ((rnd() * 3) | 0)),
    rnd() * TAU,
    Math.pow(1 + k, -0.85) * (0.6 + rnd() * 0.8),
  ]);
  const crest = (t) => waves.reduce((y, [f, p, a]) => y + a * (1 - Math.abs(Math.sin(Math.PI * f * t + p))), 0);
  let lo = Infinity,
    hi = -Infinity;
  for (let i = 0; i < 512; i++) {
    const v = crest(i / 512);
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  const yAt = (x) => H * (0.9 - (0.62 * (crest(x / W) - lo)) / (hi - lo));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#8a8a8a');
  grd.addColorStop(0.6, '#a8a8a8');
  grd.addColorStop(1, '#ffffff');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(0, H);
  for (let x = 0; x <= W; x += 4) g.lineTo(x, yAt(x));
  g.lineTo(W, H);
  g.closePath();
  g.fill();
  g.fillStyle = '#8a8a8a';
  for (let i = 0; i < 1100 * trees; i++) {
    const x = rnd() * W,
      y = yAt(x),
      h = 2 + rnd() * 8 * trees,
      w = 0.8 + rnd() * 2;
    g.beginPath();
    g.moveTo(x, y - h);
    g.lineTo(x + w, y + 2);
    g.lineTo(x - w, y + 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = MAX_ANISO;
  return t;
}
{
  // Near → far: each ring lighter and bluer (aerial perspective), fog off so it keeps that value.
  [
    [820, 170, -30, 0x090c16, 1.3, 201],
    [1120, 230, -36, 0x0e1220, 0.9, 203],
    [1480, 300, -44, 0x151a2c, 0.6, 207],
  ].forEach(([R, h, y0, col, trees, seed], i) => {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(R, R, h, 160, 1, true),
      new THREE.MeshBasicMaterial({
        map: ridgeTex(seed, trees),
        color: col,
        transparent: true,
        depthWrite: false,
        fog: false,
        side: THREE.BackSide,
        toneMapped: false,
      }),
    );
    m.position.y = y0 + h / 2;
    m.rotation.y = i * 2.1;
    m.renderOrder = -10 + i * -1;
    scene.add(m);
  });
}

// Mist at altitude: thin slabs in a ring outside the drone's orbit, one every
// few floors, so the climb passes layers of air with depth behind the tower.
{
  const rnd = mulberry(171);
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: mistTex,
        color: 0x8492b8,
        transparent: true,
        opacity: 0.04 + rnd() * 0.04,
        depthWrite: false,
        fog: false,
      }),
    );
    const a = (i / 9) * TAU + rnd() * 0.5,
      rr = 72 + rnd() * 50; // a ring outside the orbit
    s.position.set(Math.sin(a) * rr, 9 + i * 6 + rnd() * 3, Math.cos(a) * rr);
    s.scale.set(50 + rnd() * 34, 7 + rnd() * 5, 1);
    s.userData = { x0: s.position.x, v: 0.4 + rnd() * 0.6, ph: rnd() * TAU };
    scene.add(s);
    mist.push(s);
  }
}

// Moonlit motes in a ring round the flight path, up to the crown. They sit
// still in the air, so as the drone climbs they stream down past the lens:
// the clearest cue that the camera is rising.
export const airMotes = (() => {
  const n = 1100,
    p = new Float32Array(n * 3),
    sd = new Float32Array(n),
    rnd = mulberry(233);
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU,
      rr = 16 + rnd() * 52; // all round: the drone circles the whole tower
    p[i * 3] = Math.sin(a) * rr;
    p[i * 3 + 1] = rnd() * 64;
    p[i * 3 + 2] = Math.cos(a) * rr;
    sd[i] = rnd();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime; varying float vA;
      void main() {
        vec3 q = position;
        q.x += sin(uTime * 0.13 + aSeed * 50.0) * 0.6; q.z += cos(uTime * 0.11 + aSeed * 31.0) * 0.6;
        q.y += sin(uTime * 0.09 + aSeed * 17.0) * 0.4;
        vec4 mv = modelViewMatrix * vec4(q, 1.0);
        float dz = -mv.z;
        vA = (0.35 + 0.65 * aSeed) * smoothstep(1.5, 5.0, dz) * (1.0 - smoothstep(30.0, 60.0, dz));
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((1.2 + aSeed * 2.2) * (60.0 / dz), 1.0, 7.0);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        if (r > 1.0) discard;
        float a = exp(-r * r * 6.0);
        gl_FragColor = vec4(vec3(0.78, 0.85, 1.0) * vA * a * 0.55, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  return mat;
})();

// Wind: a vertex sway on grass tufts and terrace leaves, weighted to the tips and phased by position.
// Shadow casters move only centimetres, so the once-drawn shadow map still holds.
export const WIND = { value: 0 };
function sway(mat, amp, tipWeighted) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = WIND;
    sh.vertexShader =
      'uniform float uWind;\n' +
      sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
      vec3 wo = vec3(modelMatrix[3].xyz);
      #ifdef USE_INSTANCING
        wo += instanceMatrix[3].xyz;
      #endif
      float wph = wo.x * 0.31 + wo.z * 0.23, wk = ${tipWeighted ? 'uv.y * uv.y' : '1.0'};
      transformed.x += (sin(uWind * 1.1 + wph) + 0.4 * sin(uWind * 2.7 + wph * 2.0)) * ${amp.toFixed(3)} * wk;
      transformed.z += cos(uWind * 0.8 + wph * 1.3) * ${(amp * 0.6).toFixed(3)} * wk;`,
      );
  };
}
sway(M.tuft, 0.07, true);
sway(M.leaf, 0.025, false);
sway(LEAF_LIT, 0.03, false);
