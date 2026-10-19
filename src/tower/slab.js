import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTex } from '../textures/procedural.js';
import { M } from '../world/materials.js';
import { extrude, flat, outlineTube, rrect } from '../world/geometry.js';
import { ao, at, building, rbox, washMat } from '../world/kit.js';
import { anchors, FLOOR, LOBBY_H } from './base.js';

// ── Level 01: the first residence, under the second-floor slab ─────────
/* Same parts as the tower's typical floor — white GFRC slab over a shadow
   gap, paved terrace, oak soffit, a 12.6 × 9.4 m curtain wall in bronze,
   glass balustrade and a ring of clipped planters — detailed like the
   ground: a traced apartment behind real furniture, sheer curtains, light
   pools from the soffit above, and contact shadows on the deck. */
export const FH = 3.6,
  L1 = 1 + LOBBY_H,
  L2 = L1 + FH,
  TOP = L1 + 10 * FH;
// Facade details shared by every slab.
const DRIP = new THREE.MeshBasicMaterial({ color: 0x0b0907 });
const SPOUT_GEO = new THREE.BoxGeometry(0.07, 0.05, 0.22);
const STREAK_GEO = new THREE.PlaneGeometry(0.06, 0.32);
const STREAK = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false });
export const BOLT_GEO = new THREE.CylinderGeometry(0.014, 0.014, 0.02, 8).rotateX(Math.PI / 2);
export const FRIT = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
  color: 0xd8d0c4,
  map: canvasTex(
    64,
    64,
    (c, s) => {
      c.fillStyle = '#fff';
      for (let y = 0; y < s; y += 8)
        for (let x = ((y / 8) % 2) * 4; x < s; x += 8) {
          c.beginPath();
          c.arc(x + 2, y + 2, 1.4, 0, 7);
          c.fill();
        }
    },
    { tile: 0.25 },
  ),
});
// Cove strength by height: calm mid-tower, rising toward the crown so the tower reads upward.
const COVES = new Map();
export function coveMat(k) {
  k = Math.round(k * 20) / 20;
  if (!COVES.has(k))
    COVES.set(
      k,
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd7a8).multiplyScalar(k), toneMapped: false }),
    );
  return COVES.get(k);
}
export function slab(g, w, d, r, cove = M.cove) {
  const fascia = extrude(rrect(w, d, r), 0.34, M.fascia, { bevel: 0.025 });
  fascia.position.y = 0.08;
  g.add(fascia);
  g.add(extrude(rrect(w - 0.24, d - 0.24, r - 0.12), 0.09, M.reveal, { bevel: 0 }));
  const deck = flat(rrect(w - 0.08, d - 0.08, r - 0.04), M.pavers);
  deck.position.y = 0.448;
  g.add(deck);
  const soffit = flat(rrect(w - 0.26, d - 0.26, r - 0.13), M.soffit);
  soffit.position.y = -0.005;
  soffit.rotation.x = Math.PI;
  g.add(soffit);
  // The cove at the edge is the soffit's only light, so the oak should glow
  // at the rim and fall into shadow toward the glass, not read as one flat band.
  // reach × 2 equals the inset, so the decal stops exactly at the soffit edge
  // and never darkens the fascia, sky or terraces seen past it.
  ao(
    { kind: 'pool', w: w - 2.6, d: d - 2.6, r: Math.max(r - 1.3, 0.3), reach: 1.3, strength: 0.45 },
    0,
    -0.009,
    0,
    0,
    g,
  ).rotation.x = Math.PI;
  g.add(outlineTube(rrect(w - 0.16, d - 0.16, r - 0.08), 0.03, 0.022, cove));
  // Drip groove: a dark shadow line under the fascia so water can't run back to the soffit.
  g.add(outlineTube(rrect(w - 0.07, d - 0.07, r - 0.035), 0.075, 0.012, DRIP));
  // Bronze rain spouts every ~6 m, each with a faint streak down the fascia below it.
  const edge = rrect(w, d, r),
    n = Math.max(4, Math.round(edge.getLength() / 6)),
    pts = edge.getSpacedPoints(n);
  const spouts = new THREE.InstancedMesh(SPOUT_GEO, M.metal, n),
    streaks = new THREE.InstancedMesh(STREAK_GEO, STREAK, n);
  const m4 = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    up = new THREE.Vector3(0, 1, 0),
    one = new THREE.Vector3(1, 1, 1);
  for (let k = 0; k < n; k++) {
    const a = pts[k],
      b = pts[k + 1],
      tx = b.x - a.x,
      ty = b.y - a.y,
      l = Math.hypot(tx, ty) || 1;
    const nx = ty / l,
      nz = tx / l; // outward normal in local xz
    q.setFromAxisAngle(up, Math.atan2(ty, tx));
    spouts.setMatrixAt(k, m4.compose(new THREE.Vector3(a.x + nx * 0.1, 0.38, -a.y + nz * 0.1), q, one));
    streaks.setMatrixAt(k, m4.compose(new THREE.Vector3(a.x + nx * 0.006, 0.25, -a.y + nz * 0.006), q, one));
  }
  spouts.castShadow = false;
  streaks.renderOrder = 1;
  g.add(spouts, streaks);
}
{
  // Core rises through the residence to the second-floor slab.
  const core = extrude(rrect(5.5, 4.4, 1.2, 0, 7.2), TOP + 0.2 - FLOOR, M.core, { bevel: 0.05 });
  core.position.y = FLOOR;
  building.add(core);
  // Lit stair slot up the core's +x face: a warm vertical line tying the floors together.
  const slot = at(
    new THREE.Mesh(
      new THREE.PlaneGeometry(0.28, TOP - L1 - 0.6),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc48a).multiplyScalar(0.55), toneMapped: false }),
    ),
    2.762,
    (L1 + TOP) / 2,
    -7.2,
    building,
  );
  slot.rotation.y = Math.PI / 2;

  /* The core's back face, seen on every orbit: a glazed lift shaft on the
     3.1 m flat, a bronze fin screen wrapping the rounded corners, a bronze
     line at every floor, and a warm uplight at the foot. The only moving
     part is the cabin, which casts no shadow. */
  const BZ = -9.45,
    SH = TOP - FLOOR,
    SY = (FLOOR + TOP) / 2,
    SW = 1.9;
  // Shaft: a dark lining, two steel guide rails, then low-iron glass in a bronze frame.
  at(
    new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ color: 0x15171c })),
    0,
    SY,
    BZ - 0.01,
    building,
  ).rotation.y = Math.PI;
  for (const x of [-0.78, 0.78])
    at(rbox(0.05, SH, 0.04, M.steel, 0.008), x, SY, BZ - 0.04, building).castShadow = false;
  const shaftGlass = at(new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), M.glass), 0, SY, BZ - 0.16, building);
  shaftGlass.rotation.y = Math.PI;
  shaftGlass.castShadow = false;
  shaftGlass.renderOrder = 2;
  for (const x of [-SW / 2 - 0.04, SW / 2 + 0.04]) {
    at(rbox(0.09, SH, 0.2, M.metal, 0.01), x, SY, BZ - 0.08, building);
    // A slim warm LED on the outer edge of each stile draws the shaft from across the meadow.
    at(
      new THREE.Mesh(new THREE.PlaneGeometry(0.035, SH - 0.4), slot.material),
      x + Math.sign(x) * 0.06,
      SY,
      BZ - 0.181,
      building,
    ).rotation.y = Math.PI;
  }
  {
    // A bronze transom at every floor line, one instanced draw.
    const ys = [FLOOR + 0.2, ...Array.from({ length: 11 }, (_, i) => L1 + FH * i + 0.24)];
    const tr = new THREE.InstancedMesh(new THREE.BoxGeometry(SW + 0.1, 0.07, 0.1), M.metal, ys.length),
      m4 = new THREE.Matrix4();
    ys.forEach((y, i) => tr.setMatrixAt(i, m4.makeTranslation(0, y, BZ - 0.19)));
    building.add(tr);
    tr.userData.static = true;
    // Landing lights inside the shaft, one per floor: a warm rhythm up the glass even with the cabin away.
    const ll = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1.4, 0.05).rotateY(Math.PI),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc48a).multiplyScalar(0.8), toneMapped: false }),
      ys.length,
    );
    ys.forEach((y, i) => ll.setMatrixAt(i, m4.makeTranslation(0, y + 2.6, BZ - 0.02)));
    building.add(ll);
    ll.userData.static = true;
    ll.material.userData.zone = 'stair';
    // Each landing light washes down the shaft lining below it (merged planes, gradient by uv).
    const pool = new THREE.Mesh(
      mergeGeometries(
        ys.map((y) => new THREE.PlaneGeometry(SW, 3.2).rotateY(Math.PI).translate(0, y + 1.0, BZ - 0.015)),
      ),
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(0xffc48e).multiplyScalar(0.16) } },
        vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        // MSAA edge samples can extrapolate vUv just below 0, where pow() is NaN
        // and the bloom pass would smear it into a black block: clamp first.
        fragmentShader: /* glsl */ `uniform vec3 uColor; varying vec2 vUv; void main() { vec2 uv = clamp(vUv, 0.0, 1.0); gl_FragColor = vec4(uColor * pow(uv.y, 2.2) * (1.0 - pow(abs(uv.x - 0.5) * 2.0, 4.0)), 1.0); }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    building.add(pool);
    pool.material.userData.zone = 'stair';
  }
  // The cabin: a warm-lit box riding the rails, with its light spilling up and down the shaft.
  const cab = new THREE.Group();
  cab.position.set(0, L1 + 0.45, BZ - 0.06);
  building.add(cab);
  at(
    rbox(
      1.5,
      2.45,
      0.05,
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd2a0).multiplyScalar(0.95), toneMapped: false }),
      0.01,
    ),
    0,
    1.3,
    0,
    cab,
  );
  for (const y of [0.04, 2.58]) at(rbox(1.62, 0.1, 0.1, M.metal, 0.01), 0, y, -0.03, cab);
  at(rbox(1.3, 0.025, 0.03, M.steel, 0.005), 0, 0.95, -0.05, cab); // handrail across the glass back
  const spill = at(
    new THREE.Mesh(new THREE.PlaneGeometry(SW, 9), washMat({ color: 0xffc48e, y0: -4.5, y1: 4.5, strength: 0.4 })),
    0,
    1.3,
    0.035,
    cab,
  );
  spill.rotation.y = Math.PI;
  spill.material.vertexShader = /* glsl */ `varying float vY; void main() { vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  spill.material.fragmentShader = /* glsl */ `
    uniform vec3 uColor; uniform float uS; varying float vY;
    void main() { float f = exp(-abs(vY) * 0.55); gl_FragColor = vec4(uColor * f * uS, 1.0); }`;
  cab.traverse((o) => {
    o.castShadow = false;
    if (o.material) o.material.userData.zone = 'stair';
  });
  anchors.lift = cab;
  // Fin screen: vertical bronze fins round the back half of the core, clear of the shaft.
  {
    const ring = rrect(5.62, 4.52, 1.26, 0, 7.2),
      n = Math.floor(ring.getLength() / 0.42),
      pts = ring.getSpacedPoints(n);
    const fins = [],
      q = new THREE.Quaternion(),
      up = new THREE.Vector3(0, 1, 0),
      one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < n; i++) {
      const a = pts[i],
        b = pts[i + 1],
        tx = b.x - a.x,
        ty = b.y - a.y,
        l = Math.hypot(tx, ty) || 1;
      if (-a.y > -8.0 || Math.abs(a.x) < SW / 2 + 0.3) continue; // back half only, not over the shaft
      const nx = ty / l,
        nz = tx / l; // outward normal in world xz
      q.setFromAxisAngle(up, Math.atan2(ty, tx));
      fins.push(new THREE.Matrix4().compose(new THREE.Vector3(a.x + nx * 0.12, SY + 0.1, -a.y + nz * 0.12), q, one));
    }
    const fm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, SH - 0.2, 0.22), M.metal, fins.length);
    fins.forEach((m4, i) => fm.setMatrixAt(i, m4));
    fm.castShadow = false;
    fm.receiveShadow = true;
    fm.userData.static = true;
    building.add(fm);
  }
  // Floor lines: a slim bronze band round the core at every slab, like the slab edges' drip line.
  // Lit like the slab coves (coveMat), so the core carries the same horizontal rhythm as the floors.
  for (let i = 0; i <= 10; i++)
    building.add(outlineTube(rrect(5.6, 4.5, 1.25, 0, 7.2), L1 + FH * i + 0.24, 0.018, coveMat(0.55), 90));
  // Uplight at the foot of the back face, fading by the lobby roof.
  at(
    new THREE.Mesh(new THREE.PlaneGeometry(3.1, 9), washMat({ y0: FLOOR, y1: FLOOR + 9, strength: 0.32 })),
    0,
    FLOOR + 4.5,
    BZ - 0.005,
    building,
  ).rotation.y = Math.PI;
  const roof = extrude(rrect(20.1, 14.1, 4.55), 0.1, M.reveal, { bevel: 0 });
  roof.position.y = 7.98;
  building.add(roof);
}
