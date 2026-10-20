import * as THREE from 'three';
import { clamp01, mulberry, REDUCED, TAU } from '../core/util.js';
import { state } from '../core/state.js';
import { scene, SNOW_COVER } from '../core/scene.js';
import { GLINT_U } from '../world/kit.js';
import { anchors } from '../tower/base.js';
import { sound } from './audio.js';

// Rain: one draw of falling streaks round the tower, faded in and out. The
// stone is already wet; rain adds the drops and turns the pool ripples up.
const RAIN_N = 2600,
  RAIN_H = 72;
const rainLines = (() => {
  const p = new Float32Array(RAIN_N * 6),
    e = new Float32Array(RAIN_N * 2),
    rnd = mulberry(909);
  for (let i = 0; i < RAIN_N; i++) {
    const a = rnd() * TAU,
      r = 4 + Math.sqrt(rnd()) * 48,
      y = rnd() * RAIN_H;
    for (let k = 0; k < 2; k++) {
      p.set([Math.sin(a) * r, y, Math.cos(a) * r], i * 6 + k * 3);
      e[i * 2 + k] = k;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('aEnd', new THREE.BufferAttribute(e, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uSnow: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aEnd; uniform float uTime, uSnow; varying float vA;
      void main() {
        vec3 q = position;
        float seed = fract(sin(dot(q.xz, vec2(12.9, 78.2))) * 43758.5);
        // Winter turns the rain to snow: slow, drifting, each flake a 6 cm dash.
        q.y = mod(q.y - uTime * mix(19.0 + seed * 6.0, 1.1 + seed * 0.8, uSnow), ${RAIN_H.toFixed(1)}) + aEnd * mix(0.85, 0.06, uSnow);
        q.xz += uSnow * vec2(sin(uTime * 0.7 + seed * 40.0), cos(uTime * 0.5 + seed * 23.0)) * 0.6;
        q.x += aEnd * 0.1 * (1.0 - uSnow); // a light wind slant
        vA = 1.0 - aEnd * 0.8;
        vec4 mv = modelViewMatrix * vec4(q, 1.0);
        vA *= smoothstep(90.0, 20.0, -mv.z); // far drops fade into the haze
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity, uSnow; varying float vA;
      void main() { gl_FragColor = vec4(mix(vec3(0.62, 0.68, 0.82) * 0.32, vec3(0.9, 0.93, 1.0) * 0.9, uSnow) * vA * uOpacity, 1.0); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const lines = new THREE.LineSegments(g, mat);
  lines.frustumCulled = false;
  lines.visible = false;
  lines.renderOrder = 6;
  scene.add(lines);
  return lines;
})();
export let rainOn = false,
  rainK = 0,
  wetK = 0;
GLINT_U.uWetK = { value: 0 };
GLINT_U.uSnowCover = SNOW_COVER;
export const rainBtn = document.getElementById('rainBtn');
rainBtn.addEventListener('click', () => {
  rainOn = !rainOn;
  rainBtn.setAttribute('aria-pressed', rainOn);
  sound.rain(rainOn && !state.season.snow);
});
export function rainStep(dt, tt) {
  rainK += ((rainOn ? 1 : 0) - rainK) * (1 - Math.exp(-dt * 2.2));
  if (!rainOn && rainK < 0.002) rainK = 0;
  const u = rainLines.material.uniforms;
  u.uOpacity.value = rainK;
  u.uTime.value = tt;
  rainLines.visible = rainK > 0;
  anchors.mirror.material.uniforms.uRipple.value = REDUCED ? 0 : 1 + rainK * 1.5 * (1 - state.season.snow);
  u.uSnow.value = state.season.snow;
  // Rain that keeps falling spreads the puddles over ~40 s; they dry slower than they fill.
  wetK = clamp01(wetK + dt * (rainOn && !state.season.snow ? 1 / 40 : -1 / 90));
  GLINT_U.uWetK.value = REDUCED ? (rainOn && !state.season.snow ? 1 : 0) : wetK;
  return rainK > 0 || (wetK > 0 && wetK < 1);
}
