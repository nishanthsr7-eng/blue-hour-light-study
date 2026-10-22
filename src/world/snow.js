import { SNOW_COVER } from '../core/scene.js';

/* Settled snow, shared by every surface that holds it (lawn, plinth stone,
   planters, hedge tops, tree crowns, the canopy roof). Drifts come from a
   world-space noise field, so snow lies thick in some places and thin in
   others; a soft bump keeps it from reading as paint, and a sparse field of
   crystals glints as the eye moves. */
export const SNOW_GLSL = /* glsl */ `
  const vec3 SNOW_COL = vec3(0.8, 0.83, 0.88);
  float snH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float snN(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(snH(i), snH(i + vec2(1.0, 0.0)), f.x), mix(snH(i + vec2(0.0, 1.0)), snH(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float snDrift(vec2 p) { return snN(p * 0.35) * 0.55 + snN(p * 1.3) * 0.3 + snN(p * 4.7) * 0.15; }
  // The drift surface's slope as a world-space nudge to the normal: wind-packed ripples.
  vec3 snBump(vec3 wp) {
    vec2 p = wp.xz * 2.2;
    float h = snN(p) + 0.5 * snN(p * 2.7);
    float hx = snN(p + vec2(0.06, 0.0)) + 0.5 * snN((p + vec2(0.06, 0.0)) * 2.7);
    float hz = snN(p + vec2(0.0, 0.06)) + 0.5 * snN((p + vec2(0.0, 0.06)) * 2.7);
    return vec3(h - hx, 0.0, h - hz) * 3.0;
  }
  // Ice crystals: one cell in ~120 holds a tiny round glint, and which ones
  // show flips as the view moves. Near the eye only: far off they shrink
  // below a pixel and shimmer.
  float snSparkle(vec3 wp) {
    vec3 d = cameraPosition - wp, v = normalize(d), g = wp * 18.0, c = floor(g);
    float h = snH(c.xz + c.y * 17.0), tw = snH(c.xz * 1.7 + floor(v.xz * 16.0 + v.y * 9.0));
    float pt = smoothstep(0.2, 0.04, length(fract(g.xz) - 0.5));
    return step(0.992, h) * step(0.5, tw) * pt * smoothstep(70.0, 25.0, length(d));
  }`;
export const SNOW_GLINT = 'vec3(0.9, 1.0, 1.25)';

/**
 * Snow on a lit material's upward faces. `where` is a GLSL mask in world
 * space (vSnP) for where snow can fall at all; `slope` is how flat a face
 * must be to hold it (lower lets it cling to rounded crowns).
 */
export function snowify(mat, { where = '1.0', slope = 0.8, bump = 1 } = {}) {
  // Read the key now: the default key is onBeforeCompile's source, which would
  // be this same wrapper for every snowy material once it is replaced.
  const prev = mat.onBeforeCompile,
    prevKey = mat.customProgramCacheKey();
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    sh.uniforms.uSnowCover = SNOW_COVER;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSnP, vSnN;')
      .replace(
        '#include <project_vertex>',
        /* glsl */ `#include <project_vertex>
        vec4 snWP = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          snWP = instanceMatrix * snWP;
        #endif
        vSnP = (modelMatrix * snWP).xyz;
        vSnN = normalize((vec4(transformedNormal, 0.0) * viewMatrix).xyz);`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying vec3 vSnP, vSnN;\nuniform float uSnowCover;\n${SNOW_GLSL}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `float snowK = 0.0;
        if (uSnowCover > 0.0) {
          float snd = snDrift(vSnP.xz);
          snowK = uSnowCover * (${where}) * smoothstep(${(slope - 0.15).toFixed(2)}, ${(slope + 0.1).toFixed(2)}, vSnN.y + (snd - 0.5) * 0.5 + uSnowCover * 0.1);
          diffuseColor.rgb = mix(diffuseColor.rgb, SNOW_COL, snowK);
          roughnessFactor = mix(roughnessFactor, 0.85, snowK);
          metalnessFactor = mix(metalnessFactor, 0.0, snowK);
          normal = normalize(normal + snowK * ${bump.toFixed(2)} * (viewMatrix * vec4(snBump(vSnP), 0.0)).xyz);
        }
        #include <emissivemap_fragment>`,
      )
      .replace(
        '#include <opaque_fragment>',
        `outgoingLight += ${SNOW_GLINT} * snowK * snSparkle(vSnP);\n#include <opaque_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => `${prevKey}|snow:${where}:${slope}`;
  mat.needsUpdate = true;
}
