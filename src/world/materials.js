import * as THREE from 'three';
import {
  boardForm,
  bronzeTex,
  deckTex,
  fabricTex,
  gfrc,
  graniteTex,
  grass,
  leafMassTex,
  paverTex,
  poolTileTex,
  stillNormal,
  timber,
  travTex,
  troughTex,
} from '../textures/procedural.js';

/* ════════════════════════════════════════════════════════════════════════
   Materials
   ════════════════════════════════════════════════════════════════════════ */

/* Palette, chosen as one system:
   fascia   warm-white GFRC        #F4F0EA  satin; the building's line work
   deck     honed limestone        #D6CEC2  terraces; oak #A0744E soffits
   frame    dark bronze PVD        #5A4A3C  mullions, transoms, rails, columns
   glass    low-iron, steel-blue   Fresnel reflection over warm 2700 K rooms
   reveal   near-black             #161412  every shadow gap and kerb
   green    clipped boxwood        #5A7A46  in charcoal troughs #3A3936
   light    2700 K only; the single red is the aviation beacon. */
export const M = {
  fascia: new THREE.MeshPhysicalMaterial({
    color: 0xf6f2ec,
    ...gfrc,
    normalScale: new THREE.Vector2(0.5, 0.5),
    clearcoat: 0.18,
    clearcoatRoughness: 0.45,
    envMapIntensity: 0.6,
  }),
  reveal: new THREE.MeshStandardMaterial({
    color: 0xb0aaa4,
    ...graniteTex,
    normalScale: new THREE.Vector2(0.6, 0.6),
    envMapIntensity: 0.8,
  }),
  pavers: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    ...paverTex,
    normalScale: new THREE.Vector2(0.7, 0.7),
    envMapIntensity: 0.7,
  }),
  travertine: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    ...travTex,
    normalScale: new THREE.Vector2(0.8, 0.8),
    envMapIntensity: 0.6,
  }),
  deck: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    ...deckTex,
    normalScale: new THREE.Vector2(0.7, 0.7),
    envMapIntensity: 0.8,
  }),
  core: new THREE.MeshStandardMaterial({
    color: 0xc2bcb4,
    ...boardForm,
    normalScale: new THREE.Vector2(1, 1),
    envMapIntensity: 0.4,
  }),
  timber: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    ...timber,
    normalScale: new THREE.Vector2(0.25, 0.25),
    envMapIntensity: 0.7,
    side: THREE.DoubleSide,
  }),
  grass: new THREE.MeshStandardMaterial({
    color: 0x8a9878,
    ...grass,
    normalScale: new THREE.Vector2(0.8, 0.8),
    envMapIntensity: 0.3,
  }),
  // Low-iron curtain wall. Blended as `reflection + interior · (1 − α)` with
  // α rising by Fresnel: face-on you see into the rooms, edge-on the glass
  // turns to mirror, the way real glazing reads at dusk.
  glass: (() => {
    const m = new THREE.MeshPhysicalMaterial({
      color: 0x0c1a20,
      roughness: 0.02,
      metalness: 0,
      ior: 1.52,
      specularIntensity: 1,
      envMapIntensity: 2.4,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    m.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace(
          '#include <project_vertex>',
          '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
        );
      s.fragmentShader = s.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec3 vWPos;\nfloat paneHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
        )
        .replace(
          '#include <normal_fragment_maps>',
          /* glsl */ `#include <normal_fragment_maps>
        // Tempered glass is never flat. Each pane sits a hair off-plane, and the
        // oven's rollers leave a wave across it: a slope of a few milliradians,
        // repeating every 0.33 m (the roller pitch), with a stronger edge lift
        // where the hot pane sagged off the last roller. The tilt is in world
        // space, so straight lines in the reflection bend the same way from any
        // angle, the way they do on a real facade.
        vec2 cell = floor(vec2((vWPos.x + vWPos.z) / 1.5, (vWPos.y - 8.46) / 3.6));
        float pv = paneHash(cell), pv2 = paneHash(cell + 17.0);
        float rly = vWPos.y < 8.0 ? mod(vWPos.y - 1.0, 3.5) : mod(vWPos.y - 8.46, 3.6), lh = vWPos.y < 8.0 ? 3.5 : 3.13;
        float wave = cos(6.2832 * rly / 0.33 + pv * 6.2832) * (0.0045 + 0.003 * pv2);
        float lift = 0.016 * (exp(-rly / 0.08) - exp(-max(lh - rly, 0.0) / 0.08));
        vec3 tiltW = vec3((pv - 0.5) * 0.012, wave - lift, (pv2 - 0.5) * 0.012);
        normal = normalize(normal + (viewMatrix * vec4(tiltW, 0.0)).xyz);`,
        )
        .replace(
          '#include <opaque_fragment>',
          /* glsl */ `
        vec3 nP = normal;
        float fres = pow(1.0 - clamp(abs(dot(nP, normalize(vViewPosition))), 0.0, 1.0), 3.0);
        // Graded steel-blue sky in the reflection: bright at the top of each
        // pane's view, falling to a deep teal below the horizon line.
        vec3 rw = inverseTransformDirection(reflect(normalize(-vViewPosition), nP), viewMatrix);
        vec3 sheen = mix(vec3(0.006, 0.01, 0.016), vec3(0.06, 0.08, 0.13), smoothstep(-0.25, 0.55, rw.y));
        sheen += vec3(0.55, 0.36, 0.2) * pow(max(0.0, 1.0 - abs(rw.y - 0.04) * 8.0), 3.0) * 0.18;
        sheen *= 0.75 + 0.5 * pv;
        sheen = mix(sheen, sheen * vec3(0.9, 1.0, 1.08), pv2);
        // Under the slab above, the head of every typical-floor pane sits in
        // the overhang's shadow and mirrors the oak soffit, so each storey
        // reads as glass tucked under a deep lid instead of a flat band.
        float ly = mod(vWPos.y - 8.0, 3.6);
        float hd = smoothstep(2.0, 3.2, ly) * step(8.0, vWPos.y) * step(vWPos.y, 44.0);
        sheen += vec3(0.2, 0.11, 0.055) * hd * smoothstep(-0.1, 0.35, rw.y);
        outgoingLight += sheen * (0.16 + 0.84 * fres);
        diffuseColor.a = max(mix(0.42, 0.97, fres), hd * 0.6);
        #include <opaque_fragment>`,
        );
    };
    return m;
  })(),
  // Opaque dark glass over ceiling voids and doors.
  spandrel: new THREE.MeshPhysicalMaterial({
    color: 0x10171b,
    roughness: 0.06,
    metalness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 2.2,
  }),
  rail: new THREE.MeshPhysicalMaterial({
    color: 0xc4d6d2,
    roughness: 0.04,
    metalness: 0,
    transparent: true,
    opacity: 0.2,
    envMapIntensity: 2.2,
    depthWrite: false,
    side: THREE.DoubleSide,
  }),
  // Dark bronze PVD for every frame, rail and column.
  metal: new THREE.MeshPhysicalMaterial({
    color: 0x5e4d3e,
    metalness: 0.9,
    roughness: 1,
    ...bronzeTex,
    normalScale: new THREE.Vector2(0.3, 0.3),
    clearcoat: 0.3,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.4,
  }),
  led: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xde4758).multiplyScalar(2.2), toneMapped: false }),
  cove: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd7a8).multiplyScalar(0.95), toneMapped: false }),
  downlight: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe2bc).multiplyScalar(1.6), toneMapped: false }),
  warmLed: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc690).multiplyScalar(1.6), toneMapped: false }),
  water: new THREE.MeshPhysicalMaterial({
    color: 0x05080a,
    roughness: 0.0,
    metalness: 0.2,
    normalMap: stillNormal,
    normalScale: new THREE.Vector2(0.025, 0.025),
    envMapIntensity: 2.2,
    clearcoat: 1,
  }),
  pool: new THREE.MeshPhysicalMaterial({
    color: 0x2b97a3,
    map: poolTileTex,
    emissive: 0x128a9c,
    emissiveMap: poolTileTex,
    emissiveIntensity: 0.26,
    roughness: 0.03,
    normalMap: stillNormal,
    normalScale: new THREE.Vector2(0.06, 0.06),
    envMapIntensity: 1.0,
    clearcoat: 0.5,
  }),
  poolEdge: new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7fe6f0).multiplyScalar(1.2), toneMapped: false }),
  cushion: new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    ...fabricTex,
    sheen: 1,
    sheenRoughness: 0.6,
    sheenColor: 0xfff2e0,
  }),
  planter: new THREE.MeshStandardMaterial({ color: 0xffffff, ...troughTex, envMapIntensity: 0.6 }),
  hedge: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    ...leafMassTex,
    normalScale: new THREE.Vector2(1.2, 1.2),
    envMapIntensity: 0.5,
  }),
};
