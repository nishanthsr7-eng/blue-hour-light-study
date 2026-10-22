import * as THREE from 'three';
import { TAU, yieldToBrowser } from '../core/util.js';
import { glowTex } from '../textures/procedural.js';
import { M } from '../world/materials.js';
import {
  balustrade,
  extrude,
  flat,
  inRRect,
  mullions,
  outlineTube,
  planters,
  rrect,
  soffitLights,
} from '../world/geometry.js';
import { ao, at, building, decal, decalMat, rbox } from '../world/kit.js';
import { anchors, glowPts } from './base.js';
import { coveMat, TOP } from './slab.js';
import { roomMat } from './rooms.js';

// ── Penthouse: pool deck, double-height lounge, floating roof ──────────
/* The hero shot, 44 m up. An oak pool deck on a deep GFRC slab, a lit
   vanishing-edge pool spilling into a catch channel, a double-height traced
   lounge with a mezzanine and a floating stair, and a roof that hovers on
   four bronze columns with an oculus over the lounge. One real light: the
   lounge. Everything else is decals, emissive parts and halos. */

await yieldToBrowser(); // a fresh slice for this build step (util.js)
export const flowMats = [];
{
  const PH = new THREE.Group();
  PH.position.y = TOP;
  PH.rotation.y = 0.42;
  PH.userData.twistFloor = 10;
  building.add(PH);
  const DK = 0.632,
    ROOF = 7.48,
    WARM = 0xffbf86;

  // Deck slab: same fascia / shadow gap / oak soffit language as the floors.
  const fascia = extrude(rrect(24, 18, 6), 0.48, M.fascia, { bevel: 0.03 });
  fascia.position.y = 0.12;
  PH.add(fascia);
  PH.add(extrude(rrect(23.7, 17.7, 5.85), 0.14, M.reveal, { bevel: 0 }));
  const sof = flat(rrect(23.7, 17.7, 5.85), M.soffit);
  sof.position.y = -0.005;
  sof.rotation.x = Math.PI;
  PH.add(sof);
  PH.add(outlineTube(rrect(23.84, 17.84, 5.92), 0.05, 0.026, coveMat(1.25)));
  soffitLights(PH, -0.012, [24, 18, 6], [12.6, 9.4, 3], 1.8);
  const deck = flat(rrect(23.9, 17.9, 5.95), M.deck);
  deck.position.y = DK;
  PH.add(deck);
  PH.add(balustrade(23.6, 17.6, 5.8, DK));
  const shoe = rrect(23.7, 17.7, 5.85);
  shoe.holes.push(rrect(23.5, 17.5, 5.75, 0, 0, new THREE.Path()));
  const sh = extrude(shoe, 0.1, M.metal, { bevel: 0 });
  sh.position.y = DK;
  PH.add(sh);
  planters(PH, rrect(22.4, 16.4, 5.2), DK, 3, 1.0);

  /* Pool: travertine coping on three sides; on +x the water runs over a
     knife edge into a dark catch channel. The shell glows from below, and
     the lounge's reflection is painted on rather than rendered. */
  const PX = 6.4,
    PZ = -1,
    PW = 8,
    PD = 8.8,
    EDGE = PX + PW / 2;
  const rim = rrect(8.4, 9.6, 1.1, 6.2, 1);
  rim.holes.push(rrect(PW, PD, 1.1, PX, 1, new THREE.Path()));
  const rimM = extrude(rim, 0.14, M.travertine, { bevel: 0.015 });
  rimM.position.y = DK;
  PH.add(rimM);
  const pool = flat(rrect(PW, PD, 1.1, PX, 1), M.pool);
  pool.position.y = 0.76;
  PH.add(pool);
  at(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, PD - 2.2), M.poolEdge), EDGE + 0.01, 0.775, PZ, PH);
  // Sheet of water over the edge: streaks sliding down, bright where it breaks.
  const flow = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv;
      float h(float x) { return fract(sin(x * 91.7) * 43758.5); }
      void main() {
        float col = floor(vUv.x * 160.0), s = fract(vUv.y * 2.0 + uTime * (1.2 + h(col)) + h(col + 7.0));
        float streak = smoothstep(0.7, 1.0, s) * (0.4 + 0.6 * h(col + 3.0));
        float lip = smoothstep(0.75, 1.0, vUv.y);
        gl_FragColor = vec4(vec3(0.25, 0.75, 0.82) * (0.18 + streak * 0.5 + lip * 0.8), 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  flowMats.push(flow);
  at(new THREE.Mesh(new THREE.PlaneGeometry(PD - 2.2, 0.15).rotateY(Math.PI / 2), flow), EDGE + 0.025, 0.7, PZ, PH);
  const channel = new THREE.Mesh(new THREE.PlaneGeometry(0.42, PD - 1.6).rotateX(-Math.PI / 2), M.water);
  at(channel, EDGE + 0.25, DK + 0.004, PZ, PH);
  at(rbox(0.04, 0.03, PD - 1.6, M.metal, 0.006), EDGE + 0.47, DK + 0.015, PZ, PH);
  // Painted reflection: the lounge's warm glazing and mullions on the water.
  const refl = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        float x = vUv.x * 8.0, z = vUv.y * 8.8;
        float band = exp(-x * 0.55) * (0.75 + 0.25 * smoothstep(0.03, 0.06, abs(fract(z / 1.5) - 0.5)));
        float edge = smoothstep(0.0, 0.8, min(z, 8.8 - z));
        gl_FragColor = vec4(vec3(1.0, 0.72, 0.45) * band * edge * 0.32, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  at(
    new THREE.Mesh(new THREE.PlaneGeometry(PW - 0.3, PD - 0.3).rotateX(-Math.PI / 2), refl),
    PX,
    0.763,
    PZ,
    PH,
  ).renderOrder = 1;
  decal(
    { kind: 'outside', w: PW, d: PD, r: 1.1, reach: 1.6, strength: 0.22, color: 0x6fd6e0 },
    PX,
    DK + 0.005,
    PZ,
    0,
    PH,
  );

  // Lounge: double-height glass in a bronze frame, traced room behind.
  const LG = new THREE.Group();
  LG.position.set(-4.6, 0, -1.8);
  PH.add(LG);
  const G0 = 0.65,
    GH = 6.0,
    glassShape = rrect(12.6, 9.4, 3);
  const gl = extrude(glassShape, GH, M.glass, { bevel: 0 });
  gl.castShadow = false;
  gl.position.y = G0;
  LG.add(gl);
  LG.add(mullions(glassShape, G0, GH, 1.5, 0.14));
  for (const y of [0.7, 3.6, 6.55]) LG.add(outlineTube(rrect(12.68, 9.48, 3.04), y, 0.045, M.metal));
  const RY0 = G0 + 0.01,
    RY1 = G0 + GH - 0.1;
  const shell = extrude(
    rrect(12.5, 9.3, 2.95),
    RY1 - RY0,
    roomMat({ room: 'lounge', seed: 3, light: 1.1, wall: [0.14, 0.08, 0.045] }, RY0, RY1),
    { bevel: 0 },
  );
  shell.geometry.translate(0, RY0, 0);
  shell.castShadow = shell.receiveShadow = false;
  LG.add(shell);
  // Mezzanine over the back half, glass-fronted, reached by a floating oak stair.
  const MZ = RY0 + 2.9;
  at(rbox(12.3, 0.24, 3.0, M.fascia, 0.02), 0, MZ - 0.12, -2.95, LG);
  at(rbox(12.3, 0.02, 3.0, M.timber, 0.004), 0, MZ + 0.01, -2.95, LG);
  at(rbox(12.3, 0.008, 2.96, M.downlight, 0.002), 0, MZ - 0.245, -2.95, LG).scale.set(0.98, 1, 0.04);
  at(rbox(9.0, 1.0, 0.02, M.glass, 0.004), 1.5, MZ + 0.5, -1.45, LG);
  at(rbox(9.0, 0.04, 0.06, M.metal, 0.01), 1.5, MZ + 1.02, -1.45, LG);
  const steps = 15,
    rise = (MZ - RY0) / (steps + 1);
  for (let k = 0; k < steps; k++)
    at(rbox(0.32, 0.06, 1.0, M.timber, 0.01), -4.9 + k * 0.3, RY0 + rise * (k + 1), -0.95, LG);
  at(rbox(4.6, 0.04, 0.03, M.metal, 0.006), -2.75, (RY0 + MZ) / 2 + 0.9, -0.42, LG).rotation.z = Math.atan2(
    MZ - RY0,
    4.5,
  );
  // Below: rug, a long sofa facing the pool, two chairs, a low table, a linear pendant.
  const F = RY0;
  at(rbox(5.6, 0.012, 3.6, M.rug, 0.004), -0.4, F + 0.006, 2.3, LG);
  at(rbox(3.8, 0.42, 1.0, M.cushion, 0.08), -0.6, F + 0.23, 1.0, LG);
  at(rbox(3.8, 0.46, 0.24, M.cushion, 0.08), -0.6, F + 0.62, 0.6, LG);
  for (const x of [-2.0, 0.8]) at(rbox(0.9, 0.42, 0.9, M.cushion, 0.08), x, F + 0.23, 3.7, LG);
  at(rbox(1.6, 0.3, 0.9, M.travertine, 0.03), -0.6, F + 0.15, 2.3, LG);
  at(rbox(3.0, 0.04, 0.08, M.lamp, 0.01), -0.6, MZ - 0.6, 2.3, LG);
  for (const x of [-1.9, 0.7])
    at(
      new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, RY1 - MZ + 0.6, 4), M.reveal),
      x,
      (RY1 + MZ - 0.6) / 2,
      2.3,
      LG,
    );
  PH.updateMatrixWorld(true);
  glowPts.penthouse.push(LG.localToWorld(new THREE.Vector3(-0.6, MZ - 0.65, 2.3)));
  const loungeLight = new THREE.PointLight(0xffc48a, 30, 18, 1.8);
  loungeLight.position.set(0, 4.8, 1.5);
  LG.add(loungeLight);
  ao({ kind: 'outside', w: 12.78, d: 9.58, r: 3.09, reach: 0.5, strength: 0.35 }, -4.6, DK + 0.004, -1.8, 0, PH);
  decal(
    { kind: 'outside', w: 12.78, d: 9.58, r: 3.09, reach: 3.2, strength: 0.3, color: WARM },
    -4.6,
    DK + 0.005,
    -1.8,
    0,
    PH,
  );

  // Terrace: four loungers facing the view, and an outdoor fire bowl.
  for (let k = 0; k < 4; k++) {
    const x = -9.6 + k * 2.2,
      z = 6.4;
    at(rbox(0.82, 0.05, 2.02, M.metal, 0.01), x, DK + 0.22, z, PH);
    at(rbox(0.7, 0.2, 1.8, M.reveal, 0.01), x, DK + 0.1, z, PH);
    at(rbox(0.76, 0.14, 1.4, M.cushion, 0.05), x, DK + 0.31, z + 0.28, PH);
    at(rbox(0.76, 0.1, 0.75, M.cushion, 0.04), x, DK + 0.5, z - 0.6, PH).rotation.x = -0.6;
    ao({ w: 0.8, d: 2.0, r: 0.08, reach: 0.4, strength: 0.4 }, x, DK + 0.004, z, 0, PH);
    if (k % 2 === 0)
      at(
        new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.44, 24), M.travertine),
        x + 1.1,
        DK + 0.22,
        z - 0.5,
        PH,
      );
  }
  {
    const fx = -9.8,
      fz = 1.2;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.45, 0.5, 40), M.stoneDark);
    at(bowl, fx, DK + 0.25, fz, PH);
    at(new THREE.Mesh(new THREE.CircleGeometry(0.6, 32).rotateX(-Math.PI / 2), M.warmLed), fx, DK + 0.49, fz, PH);
    at(new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.025, 6, 48).rotateX(Math.PI / 2), M.metal), fx, DK + 0.5, fz, PH);
    decal({ w: 0.9, d: 0.9, r: 0.45, reach: 2.4, strength: 0.4, color: 0xff9a50 }, fx, DK + 0.006, fz, 0, PH);
    PH.updateMatrixWorld(true);
    glowPts.penthouse.push(PH.localToWorld(new THREE.Vector3(fx, DK + 0.75, fz)));
  }

  // Floating roof on four bronze columns; an oculus open to the sky over the lounge.
  const oc = (r) => new THREE.Path().absarc(-4.6, 1.8, r, 0, TAU, true);
  const roof = rrect(26, 20, 7);
  roof.holes.push(oc(2.6));
  const roofM = extrude(roof, 0.42, M.fascia, { bevel: 0.03 });
  roofM.position.y = ROOF;
  PH.add(roofM);
  PH.add(outlineTube(rrect(26.08, 20.08, 7.04), ROOF + 0.42, 0.03, M.metal));
  const roofSof = flat(roof, M.soffit);
  roofSof.position.y = ROOF - 0.08;
  roofSof.rotation.x = Math.PI;
  PH.add(roofSof);
  const gap = rrect(25.7, 19.7, 6.85);
  gap.holes.push(oc(2.75));
  // Lifted 1 cm off the soffit plane: coplanar, the two faces z-fought in dark jagged patches.
  const gapM = extrude(gap, 0.09, M.reveal, { bevel: 0 });
  gapM.position.y = ROOF - 0.07;
  PH.add(gapM);
  PH.add(outlineTube(rrect(25.84, 19.84, 6.92), ROOF - 0.04, 0.026, coveMat(1.25)));
  const skipOc = (x, z) => Math.hypot(x + 4.6, z - 1.8) < 3.1;
  soffitLights(PH, ROOF - 0.092, [26, 20, 7], null, 2.0, skipOc);
  at(
    new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.04, 6, 64).rotateX(Math.PI / 2), M.warmLed),
    -4.6,
    ROOF - 0.1,
    -1.8,
    PH,
  );
  // Pools of light under the roof downlights, wherever they land on open deck.
  {
    const pools = [];
    for (let x = -13; x <= 13; x += 2.0)
      for (let z = -10; z <= 10; z += 2.0) {
        if (!inRRect(x, z, 26 - 0.9, 20 - 0.9, 6.55) || skipOc(x, z)) continue;
        if (
          !inRRect(x, z, 22.6, 16.6, 5.3) ||
          inRRect(x + 4.6, z - 1.8, 13.4, 10.2, 3.4) ||
          inRRect(x - PX, z - 1, 8.8, 9.6, 1.4)
        )
          continue;
        pools.push(new THREE.Matrix4().makeTranslation(x, DK + 0.006, -z));
      }
    const pm = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(2.8, 2.8).rotateX(-Math.PI / 2),
      decalMat({ reach: 1.4, strength: 0.32 }),
      pools.length,
    );
    pools.forEach((m4, k) => pm.setMatrixAt(k, m4));
    pm.renderOrder = -2;
    PH.add(pm);
  }
  /* The deck and roof corners are rounded about (±6, ±3), so a column at the
     bounding box's corner stands past both edges. Each one sits on the corner
     diagonal instead, 5.62 m out: between the planters (5.45) and the
     balustrade (5.8), under the roof and clear of the lounge glazing. */
  const COL_R = 5.62,
    diag = Math.hypot(5.6, 5);
  for (const [sx, sz] of [
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ]) {
    const x = sx * (6 + (COL_R * 5.6) / diag),
      z = sz * (3 + (COL_R * 5) / diag);
    const c = at(
      new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, ROOF - 0.08 - DK, 16), M.metal),
      x,
      (ROOF - 0.08 + DK) / 2,
      -z,
      PH,
    );
    c.castShadow = true;
    ao({ w: 0.24, d: 0.24, r: 0.12, reach: 0.35, strength: 0.4 }, x, DK + 0.004, -z, 0, PH);
  }
  // Roof plant behind bronze louvres, so the skyline stays clean.
  {
    const lx = 5.5,
      lz = -4.5,
      lw = 6,
      ld = 3,
      lh = 1.3,
      y0 = ROOF + 0.42;
    at(rbox(lw - 0.2, lh - 0.1, ld - 0.2, M.reveal, 0.02), lx, y0 + (lh - 0.1) / 2, lz, PH);
    for (let k = 0; k <= lw / 0.2; k++)
      for (const s of [-1, 1])
        at(rbox(0.03, lh, 0.12, M.metal, 0.005), lx - lw / 2 + k * 0.2, y0 + lh / 2, lz + (s * ld) / 2, PH);
    for (let k = 0; k <= ld / 0.2; k++)
      for (const s of [-1, 1])
        at(rbox(0.12, lh, 0.03, M.metal, 0.005), lx + (s * lw) / 2, y0 + lh / 2, lz - ld / 2 + k * 0.2, PH);
    at(rbox(lw + 0.1, 0.05, ld + 0.1, M.metal, 0.01), lx, y0 + lh, lz, PH);
  }
  // Lift overrun: the core, carried through the roof in its own (unrotated) frame.
  at(rbox(5.5, 1.7, 4.4, M.core, 0.05), 0, TOP + ROOF + 0.42 + 0.85, -7.2);

  // Mast and aviation beacon: the scene's one red.
  at(
    new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 14 - ROOF - 0.42, 8), M.metal),
    0,
    (14 + ROOF + 0.42) / 2,
    -6.6,
    PH,
  );
  at(new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), M.led), 0, 14, -6.6, PH);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex(),
      color: 0xde4758,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  at(halo, 0, 14, -6.6, PH).scale.setScalar(3.2);
  anchors.beacon = halo;
  PH.updateMatrixWorld(true);
  anchors.penthouse = PH.localToWorld(new THREE.Vector3(0, 3, 0));
}

// ── Trees: multi-stem specimens in bronze-lipped planters ──────────────
export const foliageGeo = (() => {
  const g = new THREE.IcosahedronGeometry(1, 3),
    p = g.attributes.position,
    v = new THREE.Vector3();
  const n = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k =
      1 +
      Math.sin(v.x * 7.3 + v.y * 3.1) * Math.sin(v.z * 6.7 - v.x * 2.3) * 0.16 +
      Math.sin(v.y * 13 + v.z * 9) * 0.06;
    n.set([v.x, v.y, v.z], i * 3);
    p.setXYZ(i, v.x * k, v.y * k * 0.8, v.z * k);
  }
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return g;
})();
