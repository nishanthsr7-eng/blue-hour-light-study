import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mulberry, REDUCED, TAU, yieldToBrowser } from '../core/util.js';
import { waterNormal } from '../textures/procedural.js';
import { scene } from '../core/scene.js';
import { M } from '../world/materials.js';
import { extrude, flat, mullions, outlineTube, parts, put, rrect } from '../world/geometry.js';
import { ao, at, building, decal, haloSign, rbox, washMat } from '../world/kit.js';

/* ════════════════════════════════════════════════════════════════════════
   The base
   ════════════════════════════════════════════════════════════════════════ */

await yieldToBrowser(); // a fresh slice for this build step (util.js)

scene.add(building);
export const anchors = {};
export const glowPts = { bollard: [], canopy: [], pendant: [], level: [], penthouse: [] };
export const LOBBY_H = 7;
export const FLOOR = 1.0; // plinth top

// ── Plinth: travertine slab floating on a lit shadow gap ───────────────
{
  const base = extrude(rrect(41.2, 35.2, 7.6), 0.72, M.reveal, { bevel: 0 });
  building.add(base);
  const top = extrude(rrect(42, 36, 8), 0.24, M.travertine, { bevel: 0.03 });
  top.position.y = 0.73;
  building.add(top);
  // Hidden 2700 K strip under the lip: it washes the dark base and spills
  // onto the gravel, so the whole slab seems to hover.
  building.add(outlineTube(rrect(41.5, 35.5, 7.75), 0.665, 0.018, M.warmLed, 320));
  const ring = rrect(41.24, 35.24, 7.62);
  ring.holes.push(rrect(41.2, 35.2, 7.6, 0, 0, new THREE.Path()));
  const washGeo = new THREE.ExtrudeGeometry(ring, { depth: 0.7, bevelEnabled: false, curveSegments: 24 }).rotateX(
    -Math.PI / 2,
  );
  building.add(new THREE.Mesh(washGeo, washMat({ y0: 0, y1: 0.7, strength: 0.75, up: false })));
  decal({ kind: 'outside', w: 41.2, d: 35.2, r: 7.6, reach: 1.7, strength: 0.42 }, 0, 0.045, 0);

  // Expansion joints: stainless strips set flush in the stone.
  for (const [x, z, w, d] of [
    [0, -12.5, 30, 0.014],
    [-15.5, 0, 0.014, 18],
  ]) {
    const j = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), M.grate);
    j.position.set(x, FLOOR + 0.002, z);
    building.add(j);
  }

  // Steps: eased travertine treads with bronze anti-slip inlays; a hidden
  // strip under each nosing washes the riser and pools on the tread below.
  const stepTop = (i) => (i < 4 ? 1.0 - i * 0.25 : 0.04);
  for (let i = 0; i < 4; i++) {
    const h = stepTop(i),
      zc = 18.4 + i * 1.1,
      front = zc + 0.55;
    at(rbox(10, h, 1.1, M.travertine, 0.015), 0, h / 2, zc);
    for (const dz of [0.06, 0.11]) {
      const inlay = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 0.018).rotateX(-Math.PI / 2), M.metal);
      inlay.position.set(0, h + 0.002, front - dz);
      building.add(inlay);
    }
    at(new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.025, 0.02), M.warmLed), 0, h - 0.06, front + 0.01);
    const below = stepTop(i + 1),
      riserH = h - 0.07 - below;
    const riser = new THREE.Mesh(
      new THREE.PlaneGeometry(9.6, riserH),
      washMat({ y0: below, y1: h - 0.07, strength: 0.9, up: false }),
    );
    riser.position.set(0, below + riserH / 2, front + 0.004);
    building.add(riser);
    decal({ w: 9.4, reach: 0.75, strength: 0.55 }, 0, below + 0.004, front + 0.02);
  }
  // Cheeks with a bronze handrail on slim posts, returned at both ends.
  const railY = (z) => THREE.MathUtils.mapLinear(z, 18.0, 22.1, 1.92, 1.17);
  const up = new THREE.Vector3(0, 1, 0);
  const seg = (a, b, r, mat) => {
    const dir = b.clone().sub(a),
      len = dir.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), mat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(up, dir.normalize());
    m.castShadow = true;
    building.add(m);
    return m;
  };
  for (const x of [-5.15, 5.15]) {
    at(rbox(0.3, 1.02, 4.4, M.travertine, 0.012), x, 0.51, 20.05);
    const a = new THREE.Vector3(x, railY(18.0), 18.0),
      b = new THREE.Vector3(x, railY(22.1), 22.1);
    seg(a, b, 0.024, M.metal);
    seg(a, new THREE.Vector3(x, 1.02, 17.92), 0.024, M.metal);
    for (const z of [18.35, 20.15, 21.95])
      seg(new THREE.Vector3(x, 1.02, z), new THREE.Vector3(x, railY(z), z), 0.016, M.metal);
  }
  // Tactile warning strip at the head of the stair.
  at(rbox(9.6, 0.012, 0.5, M.tactile, 0.004), 0, FLOOR + 0.006, 17.45);
  // Halo-lit bronze lettering on the right cheek's outer face.
  haloSign('NO. 07', 2.4, 0.38, building, 5.3, 0.56, 20.1, Math.PI / 2);
  haloSign('07', 0.7, 0.36, building, -5.3, 0.56, 20.1, -Math.PI / 2);
  anchors.steps = new THREE.Vector3(5.3, 0.6, 20.1);

  // Black-mirror pool: travertine coping, a real planar reflection
  // rippled by the water normals, an underwater strip on the far edge and
  // a bronze ring rising from the water.
  const rim = rrect(16, 9, 2, -10.5, -10.5);
  rim.holes.push(rrect(15.4, 8.4, 1.7, -10.5, -10.5, new THREE.Path()));
  const r = extrude(rim, 0.12, M.travertine, { bevel: 0.015 });
  r.position.y = 0.97;
  building.add(r);
  const pr = Math.min(devicePixelRatio || 1, 1.75);
  const mirror = new Reflector(new THREE.ShapeGeometry(rrect(15.4, 8.4, 1.7, -10.5, -10.5), 24), {
    clipBias: 0.003,
    color: 0xdfe6ea,
    textureWidth: Math.round(innerWidth * pr * 0.5),
    textureHeight: Math.round(innerHeight * pr * 0.5),
    shader: {
      name: 'BlackMirror',
      uniforms: {
        color: { value: null },
        tDiffuse: { value: null },
        textureMatrix: { value: null },
        tNormal: { value: null },
        uTime: { value: 0 },
        uRipple: { value: REDUCED ? 0 : 1 },
      },
      vertexShader: /* glsl */ `
        uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
        void main() { vUv = textureMatrix * vec4(position, 1.0); vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 color; uniform sampler2D tDiffuse, tNormal; uniform float uTime, uRipple; varying vec4 vUv; varying vec3 vW;
        float rh(float x) { return fract(sin(x * 91.3) * 43758.5453); }
        void main() {
          vec2 n = texture2D(tNormal, vW.xz * 0.05 + vec2(uTime * 0.006, uTime * 0.004)).xy * 2.0 - 1.0;
          n += texture2D(tNormal, vW.xz * 0.17 - vec2(uTime * 0.004, -uTime * 0.007)).xy * 2.0 - 1.0;
          // Late drips off the canopy and trees: a few rings at a time, each
          // spreading and fading, bending the reflection instead of drawing a line.
          float ring = 0.0;
          for (int i = 0; i < 5; i++) {
            float fi = float(i), T = 2.6 + fi * 0.45, ph = (uTime + fi * 1.37) / T, cyc = floor(ph), age = fract(ph);
            vec2 c = vec2(-10.5, 10.5) + (vec2(rh(cyc + fi * 7.1), rh(cyc * 1.7 + fi * 3.3)) - 0.5) * vec2(13.0, 6.5);
            vec2 dv = vW.xz - c; float dd = length(dv), x = dd - age * 1.8;
            float w = sin(x * 26.0) * exp(-x * x * 40.0) * (1.0 - age) * (1.0 - age);
            n += dv / max(dd, 1e-3) * w * 1.4 * uRipple; ring += max(w, 0.0) * uRipple;
          }
          vec4 uv = vUv; uv.xy += n * 0.006 * uv.w;
          vec3 refl = texture2DProj(tDiffuse, uv).rgb;
          vec3 v = normalize(cameraPosition - vW);
          float fr = 0.35 + 0.65 * pow(1.0 - max(v.y, 0.0), 4.0);
          // The reflection target is already tone-mapped sRGB (see anchors.mirror below).
          gl_FragColor = vec4(color * refl * fr + vec3(0.003, 0.005, 0.007) + vec3(0.02, 0.024, 0.032) * ring, 1.0);
        }`,
    },
  });
  mirror.material.uniforms.tNormal.value = waterNormal;
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.y = 1.03;
  building.add(mirror);
  anchors.mirror = mirror;
  // Render the reflection with the same output settings as the screen (tone
  // mapped, sRGB), like the composer buffers. Otherwise every material flips
  // program variant twice a frame, which cost ~18% of a slow CPU's frame.
  mirror.getRenderTarget().isXRRenderTarget = true;
  mirror.getRenderTarget().texture.colorSpace = THREE.SRGBColorSpace;
  decal({ w: 13.4, reach: 0.9, strength: 0.4, color: 0xffd3a0 }, -10.5, 1.034, 6.55);
  const ringS = new THREE.Mesh(
    new THREE.TorusGeometry(1.25, 0.075, 16, 96),
    new THREE.MeshPhysicalMaterial({
      color: 0x8a6a4c,
      metalness: 1,
      roughness: 0.16,
      clearcoat: 0.6,
      envMapIntensity: 1.8,
    }),
  );
  ringS.position.set(-14.2, 1.03 + 1.05, 10.8);
  ringS.rotation.y = 0.5;
  ringS.castShadow = true;
  building.add(ringS);
  anchors.pool = new THREE.Vector3(-14.2, 2.4, 10.8);

  // Forecourt: linear planters, slatted oak benches with an under-glow.
  for (const [x, z, len] of [
    [14.8, 8.5, 8],
    [14.2, 11.5, 7],
    [14.8, 14.5, 8],
  ]) {
    put(parts.trough, null, x, 0.97 + 0.27, z, len, 0.54, 0.7);
    put(parts.hedge, null, x, 0.97 + 0.54 + 0.2, z, len - 0.1, 0.4, 0.6);
    ao({ w: len, d: 0.7, r: 0.04, reach: 0.7 }, x, FLOOR + 0.003, z);
  }
  for (const x of [-10.5, 10.5]) {
    at(rbox(4.2, 0.38, 0.5, M.travertine, 0.02), x, FLOOR + 0.19, 16.3);
    for (let k = 0; k < 7; k++) at(rbox(4.5, 0.07, 0.085, M.timber, 0.014), x, FLOOR + 0.415, 16.3 - 0.3 + k * 0.1);
    for (const ex of [-1.7, 1.7]) at(rbox(0.06, 0.04, 0.6, M.metal, 0.01), x + ex, FLOOR + 0.36, 16.3);
    for (const s of [-1, 1]) {
      at(new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.012, 0.012), M.warmLed), x, FLOOR + 0.37, 16.3 + s * 0.27);
      decal({ w: 3.9, reach: 0.65, strength: 0.32 }, x, FLOOR + 0.003, 16.3 + s * 0.36);
    }
    ao({ w: 4.2, d: 0.5, r: 0.03, reach: 0.5, strength: 0.45 }, x, FLOOR + 0.003, 16.3);
  }
}

// ── Lobby: double-height hall, interior-mapped behind real furniture ───
{
  const shape = rrect(20, 14, 4.5);
  const kerb = extrude(rrect(20.3, 14.3, 4.65), 0.16, M.reveal, { bevel: 0.01 });
  kerb.position.y = 0.97;
  building.add(kerb);
  const gl = extrude(shape, LOBBY_H, M.glass, { bevel: 0 });
  gl.castShadow = false;
  gl.position.y = 1;
  building.add(gl);

  /* The hall is traced per pixel: each fragment of an inner shell casts
     its view ray into the room box and shades whatever it hits — a
     polished stone floor that mirrors the ceiling, an oak-slat ceiling
     with downlights and cove, a fluted travertine wall with bronze lift
     doors and an art niche, and the far glazing. Depth is written at the
     hit point, so real furniture sits inside the room correctly. */
  const shell = extrude(
    rrect(19.9, 13.9, 4.45),
    LOBBY_H - 0.05,
    new THREE.ShaderMaterial({
      uniforms: {
        uMin: { value: new THREE.Vector3(-10, FLOOR + 0.02, -4.9) },
        uMax: { value: new THREE.Vector3(10, 7.75, 7) },
        uLamp: { value: new THREE.Vector3(0.6, 5.4, 3.0) },
      },
      vertexShader: /* glsl */ `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
      uniform vec3 uMin, uMax, uLamp; uniform mat4 projectionMatrix; varying vec3 vW;
      const vec3 WARM = vec3(1.0, 0.76, 0.5);
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n21(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
      float pend(vec3 p) { float d = distance(p, uLamp); return 5.0 / (1.0 + d * d * 0.45); }

      vec3 ceilingAt(vec2 q, float blur) {
        q = clamp(q, uMin.xz, uMax.xz);
        float s = fract(q.x / 0.12) * 0.12;
        float slat = smoothstep(0.0, 0.012, s) * smoothstep(0.12, 0.106, s);
        vec3 oak = vec3(0.22, 0.12, 0.055) * (0.35 + 0.65 * slat) * (0.8 + 0.4 * n21(q * vec2(0.8, 6.0)));
        vec2 c = (fract(q / 1.8 + 0.5) - 0.5) * 1.8;
        float lamp = exp(-dot(c, c) / (0.004 + blur)) * mix(14.0, 1.2, clamp(blur * 8.0, 0.0, 1.0));
        float dw = min(min(q.x - uMin.x, uMax.x - q.x), min(q.y - uMin.z, uMax.z - q.y));
        float cove = exp(-max(dw, 0.0) * 2.5);
        return oak * (0.5 + 1.8 * cove) + WARM * (lamp + cove * 0.3);
      }
      vec3 floorAt(vec3 p, vec3 rd) {
        vec2 q = p.xz, tq = fract(q / 1.2);
        float e = min(min(tq.x, 1.0 - tq.x), min(tq.y, 1.0 - tq.y)) * 1.2;
        float joint = 1.0 - smoothstep(0.0, 0.006, e);
        vec3 stone = vec3(0.30, 0.27, 0.235) * (0.85 + 0.3 * n21(q * 1.3)) * (0.9 + 0.2 * h21(floor(q / 1.2)));
        stone *= 1.0 - 0.6 * joint;
        vec2 c = (fract(q / 1.8 + 0.5) - 0.5) * 1.8;
        vec3 lit = stone * (0.3 + WARM * (exp(-dot(c, c) / 0.8) * 0.9 + pend(p)));
        vec3 r = vec3(rd.x, -rd.y, rd.z);
        float tt = (uMax.y - p.y) / max(r.y, 1e-3);
        vec3 refl = ceilingAt(q + r.xz * tt, 0.015 + tt * 0.003);
        float fr = 0.05 + 0.45 * pow(1.0 - clamp(-rd.y, 0.0, 1.0), 4.0);
        return lit + refl * fr * (1.0 - joint);
      }
      vec3 featureWall(vec2 uv, vec3 p) {
        float flute = 0.8 + 0.2 * cos(uv.x * 6.2832 / 0.16);
        vec3 stone = vec3(0.62, 0.55, 0.46) * flute * (0.9 + 0.2 * n21(uv * vec2(0.5, 3.0)));
        float wash = 0.22 + 1.5 * exp(-(uMax.y - uv.y) * 0.8);
        vec3 col = stone * (wash + WARM * pend(p) * 0.5);
        // Brushed-bronze lift doors in a bronze surround.
        if (uv.x > 0.8 && uv.x < 3.4 && uv.y < 3.8) {
          float frame = step(uv.x, 0.92) + step(3.28, uv.x) + step(3.68, uv.y);
          float split = 1.0 - smoothstep(0.0, 0.012, abs(uv.x - 2.1));
          vec3 br = vec3(0.30, 0.22, 0.15) * (0.8 + 0.3 * n21(vec2(uv.x * 90.0, uv.y * 0.5)));
          col = mix(br, br * 0.55, clamp(frame, 0.0, 1.0)) * (0.6 + wash * 0.8) * (1.0 - 0.85 * split);
        }
        // Art niche: a dark recess, grazed from above, with a bronze-and-bone canvas.
        if (uv.x > -7.6 && uv.x < -3.4 && uv.y > 2.3 && uv.y < 5.7) {
          float spot = 0.4 + 1.6 * exp(-(5.7 - uv.y) * 0.9);
          vec3 art = mix(vec3(0.06, 0.05, 0.045), vec3(0.62, 0.5, 0.34), smoothstep(0.45, 0.55, n21(uv * vec2(0.9, 2.2)) + (uv.y - 4.0) * 0.12));
          bool inner = uv.x > -7.3 && uv.x < -3.7 && uv.y > 2.6 && uv.y < 5.4;
          col = (inner ? art : vec3(0.03, 0.025, 0.02)) * spot;
        }
        return col;
      }
      vec3 farGlass(float u, float y) {
        vec3 dusk = mix(vec3(0.10, 0.045, 0.06), vec3(0.025, 0.02, 0.045), smoothstep(1.5, 7.5, y));
        float m = 1.0 - smoothstep(0.02, 0.05, abs((fract(u / 1.8 + 0.5) - 0.5) * 1.8));
        float tr = 1.0 - smoothstep(0.02, 0.05, abs(y - 4.2));
        return dusk * (1.0 - 0.85 * max(m, tr));
      }
      void main() {
        vec3 ro = vW, rd = normalize(vW - cameraPosition);
        vec3 tA = (uMin - ro) / rd, tB = (uMax - ro) / rd, tF = max(tA, tB);
        float t = max(min(min(tF.x, tF.y), tF.z), 0.0);
        vec3 p = ro + rd * t, col;
        vec3 ds = vec3(min(p.x - uMin.x, uMax.x - p.x), min(p.y - uMin.y, uMax.y - p.y), min(p.z - uMin.z, uMax.z - p.z));
        if (tF.y <= tF.x && tF.y <= tF.z) { col = rd.y < 0.0 ? floorAt(p, rd) : ceilingAt(p.xz, 0.0); ds.y = 99.0; }
        else if (tF.x <= tF.z) { col = farGlass(p.z, p.y); ds.x = 99.0; }
        else { col = rd.z < 0.0 ? featureWall(p.xy, p) : farGlass(p.x, p.y); ds.z = 99.0; }
        col *= 0.45 + 0.55 * smoothstep(0.0, 1.3, min(min(ds.x, ds.y), ds.z));
        vec4 clip = projectionMatrix * viewMatrix * vec4(p, 1.0);
        gl_FragDepth = clip.z / clip.w * 0.5 + 0.5;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    }),
    { bevel: 0 },
  );
  shell.castShadow = shell.receiveShadow = false;
  shell.position.y = FLOOR + 0.02;
  building.add(shell);

  // Bronze frame: mullions, sill, transom at the gallery line, head.
  building.add(mullions(shape, 1, LOBBY_H, 1.8, 0.16));
  for (const y of [1.14, 4.2, LOBBY_H + 0.92]) building.add(outlineTube(rrect(20.06, 14.06, 4.53), y, 0.05, M.metal));
  // Stainless slot drain round the kerb, and the hall's warm spill on the stone.
  const drain = rrect(21, 15, 5);
  drain.holes.push(rrect(20.42, 14.42, 4.71, 0, 0, new THREE.Path()));
  const dm = flat(drain, M.grate);
  dm.position.y = FLOOR + 0.003;
  building.add(dm);
  ao({ kind: 'outside', w: 20.3, d: 14.3, r: 4.65, reach: 0.8, strength: 0.45 }, 0, FLOOR + 0.004, 0);
  decal(
    { kind: 'outside', w: 20.3, d: 14.3, r: 4.65, reach: 3.6, strength: 0.3, color: 0xffbf86 },
    0,
    FLOOR + 0.005,
    0,
  );

  // Entrance: bronze portal, frameless glass leaves with long pulls, a
  // recessed mat well, and a bronze intercom pylon.
  const jamb = (x) => at(rbox(0.3, 3.4, 0.9, M.metal, 0.02), x, 2.7, 7.2);
  jamb(-2.2);
  jamb(2.2);
  at(rbox(4.7, 0.3, 0.9, M.metal, 0.02), 0, 4.45, 7.2);
  for (const s of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.96, 3.26, 0.03), M.glass);
    leaf.position.set(s * 1.0, 2.65, 7.1);
    building.add(leaf);
    at(rbox(0.05, 3.3, 0.06, M.metal, 0.01), s * 0.03, 2.65, 7.1);
    at(rbox(1.96, 0.1, 0.06, M.metal, 0.01), s * 1.0, 1.05, 7.1);
    for (const dz of [0.09, -0.09]) {
      at(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.7, 12), M.metal), s * 0.16, 2.6, 7.1 + dz);
      for (const dy of [-0.7, 0.7])
        at(
          new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.09, 8).rotateX(Math.PI / 2), M.metal),
          s * 0.16,
          2.6 + dy,
          7.1 + dz * 0.5,
        );
    }
  }
  at(rbox(4.0, 0.02, 1.6, M.mat, 0.004), 0, FLOOR + 0.008, 8.1);
  {
    const W = 192,
      H = 640,
      face = document.createElement('canvas'),
      glow = document.createElement('canvas');
    face.width = glow.width = W;
    face.height = glow.height = H;
    const f = face.getContext('2d'),
      gl2 = glow.getContext('2d');
    f.fillStyle = '#4a3c2f';
    f.fillRect(0, 0, W, H);
    const rr = mulberry(81);
    for (let i = 0; i < 900; i++) {
      const v = (rr() * 255) | 0;
      f.fillStyle = `rgba(${v},${v},${v},.05)`;
      f.fillRect(rr() * W, rr() * H, 1, 30 + rr() * 200);
    }
    f.font = "600 92px Inter, 'Segoe UI', sans-serif";
    f.textAlign = 'center';
    f.fillStyle = '#c8ab84';
    f.fillText('07', W / 2, 120);
    f.fillStyle = '#0a0b0d';
    f.fillRect(36, 190, 120, 92);
    f.fillStyle = '#050505';
    f.beginPath();
    f.arc(W / 2, 172, 6, 0, TAU);
    f.fill();
    f.strokeStyle = '#c8ab84';
    f.lineWidth = 4;
    f.beginPath();
    f.arc(W / 2, 350, 22, 0, TAU);
    f.stroke();
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 3; c++) {
        f.fillStyle = '#2a221b';
        f.beginPath();
        f.arc(56 + c * 40, 420 + r * 38, 10, 0, TAU);
        f.fill();
        f.fillStyle = 'rgba(255,230,190,.25)';
        f.beginPath();
        f.arc(54 + c * 40, 418 + r * 38, 4, 0, TAU);
        f.fill();
      }
    f.fillStyle = '#0b0907';
    f.fillRect(30, 590, 132, 10);
    gl2.fillStyle = '#000';
    gl2.fillRect(0, 0, W, H);
    gl2.strokeStyle = '#ffc890';
    gl2.lineWidth = 4;
    gl2.beginPath();
    gl2.arc(W / 2, 350, 22, 0, TAU);
    gl2.stroke();
    const sg = gl2.createLinearGradient(0, 190, 0, 282);
    sg.addColorStop(0, '#2a2620');
    sg.addColorStop(1, '#0d0b09');
    gl2.fillStyle = sg;
    gl2.fillRect(36, 190, 120, 92);
    const ft = new THREE.CanvasTexture(face);
    ft.colorSpace = THREE.SRGBColorSpace;
    const gt = new THREE.CanvasTexture(glow);
    gt.colorSpace = THREE.SRGBColorSpace;
    at(rbox(0.48, 1.6, 0.12, M.metal, 0.015), -3.15, FLOOR + 0.8, 7.95);
    const fp = new THREE.Mesh(
      new THREE.PlaneGeometry(0.46, 1.56),
      new THREE.MeshStandardMaterial({
        map: ft,
        emissiveMap: gt,
        emissive: 0xffffff,
        emissiveIntensity: 1.6,
        metalness: 0.7,
        roughness: 0.35,
        envMapIntensity: 1.2,
      }),
    );
    at(fp, -3.15, FLOOR + 0.8, 8.012);
    ao({ w: 0.48, d: 0.12, r: 0.02, reach: 0.35, strength: 0.5 }, -3.15, FLOOR + 0.004, 7.95);
  }

  // Floating oak canopy: eased edges, bronze fascia, a drip groove inset
  // under the edge, downlights that actually pool on the stone.
  at(rbox(8, 0.3, 5, M.timber, 0.02), 0, 5.4, 9.2);
  at(rbox(8.06, 0.12, 5.06, M.metal, 0.015), 0, 5.6, 9.2);
  for (const [w, d, x, z] of [
    [7.7, 0.018, 0, 6.85],
    [7.7, 0.018, 0, 11.55],
    [0.018, 4.7, -3.85, 9.2],
    [0.018, 4.7, 3.85, 9.2],
  ]) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(Math.PI / 2), M.reveal);
    g.position.set(x, 5.248, z);
    building.add(g);
  }
  for (let x = -3; x <= 3; x += 1.5)
    for (const z of [8.2, 10.4]) {
      put(parts.downlight, null, x, 5.245, z);
      glowPts.canopy.push(new THREE.Vector3(x, 5.2, z));
      decal({ reach: 1.6, strength: 0.6 }, x, FLOOR + 0.006, z);
    }
  for (const x of [-3.6, 3.6]) {
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 4.4, 20), M.metal), x, 3.2, 11.3);
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.025, 32), M.metal), x, FLOOR + 0.0125, 11.3);
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.14, 24), M.metal), x, 5.18, 11.3);
    // In-ground uplight grazing each column.
    at(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.094, 0.094, 4.36, 20, 1, true),
        washMat({ y0: FLOOR, y1: 5.3, strength: 0.7 }),
      ),
      x,
      3.2,
      11.3,
    );
    at(new THREE.Mesh(new THREE.CircleGeometry(0.07, 16).rotateX(-Math.PI / 2), M.lamp), x + 0.3, FLOOR + 0.004, 11.3);
    ao({ w: 0.44, d: 0.44, r: 0.22, reach: 0.4, strength: 0.4 }, x, FLOOR + 0.004, 11.3);
  }
  anchors.canopy = new THREE.Vector3(-3.6, 5.4, 11.6);
  anchors.lobby = new THREE.Vector3(9.4, 5.2, 4.6);

  // What sits in the hall, in front of the traced room: reception desk,
  // a sunk lounge on a wool rug, a pendant cluster and an olive tree.
  const IN = FLOOR + 0.02;
  at(rbox(4.4, 1.05, 0.95, M.travertine, 0.03), 4.6, IN + 0.525, -2.6);
  at(rbox(4.46, 0.045, 1.0, M.metal, 0.01), 4.6, IN + 1.07, -2.6);
  decal({ w: 4.3, reach: 0.7, strength: 0.4 }, 4.6, IN + 0.004, -2.1);
  at(rbox(5.4, 0.016, 3.8, M.rug, 0.006), -5, IN + 0.008, 2.0);
  for (const [z, s] of [
    [0.55, 1],
    [3.45, -1],
  ]) {
    at(rbox(2.7, 0.42, 0.95, M.cushion, 0.08), -5, IN + 0.23, z);
    at(rbox(2.7, 0.44, 0.24, M.cushion, 0.08), -5, IN + 0.6, z - s * 0.36);
  }
  at(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.36, 40), M.travertine), -5, IN + 0.18, 2.0).castShadow =
    true;
  const prnd = mulberry(91);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4,
      rad = 0.35 + prnd() * 1.1,
      x = 0.6 + Math.cos(a) * rad,
      z = 3.0 + Math.sin(a) * rad,
      y = 4.6 + prnd() * 1.8;
    at(new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), M.lamp), x, y, z);
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 7.75 - y, 4), M.reveal), x, (7.75 + y) / 2, z);
    glowPts.pendant.push(new THREE.Vector3(x, y, z));
  }
  const lobbyLight = new THREE.PointLight(0xffc48a, 38, 22, 1.6);
  lobbyLight.position.set(0.6, 5.4, 3.0);
  building.add(lobbyLight);
}
