import * as THREE from 'three';
import { mulberry } from '../core/util.js';
import { M } from './materials.js';

/* ════════════════════════════════════════════════════════════════════════
   Geometry helpers. Shapes are drawn in plan: shape (x, y) → world (x, −z).
   ════════════════════════════════════════════════════════════════════════ */

export function rrect(w, d, r, cx = 0, cy = 0, path = new THREE.Shape()) {
  const x = cx - w / 2,
    y = cy - d / 2;
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
  path.lineTo(x + w, y + d - r);
  path.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2);
  path.lineTo(x + r, y + d);
  path.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI);
  path.lineTo(x, y + r);
  path.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  return path;
}
export function extrude(shape, h, mat, { bevel = 0.04, curve = 16 } = {}) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: h,
    curveSegments: curve,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  });
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}
export function flat(shape, mat) {
  const geo = new THREE.ShapeGeometry(shape, 16);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  return m;
}
/** Tube following a shape outline at height y. */
export function outlineTube(shape, y, radius, mat, n = 220) {
  const pts = shape.getSpacedPoints(n).map((p) => new THREE.Vector3(p.x, y, -p.y));
  pts.pop();
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), n, radius, 6, true), mat);
}
const RAIL_EDGE = new THREE.MeshBasicMaterial({ color: 0xdfe9e4, transparent: true, opacity: 0.35, depthWrite: false });
/** Glass balustrade standing on a slab edge, with a metal handrail. */
export function balustrade(w, d, r, y, cx = 0, cy = 0) {
  const g = new THREE.Group();
  const outer = rrect(w, d, r, cx, cy);
  outer.holes.push(rrect(w - 0.06, d - 0.06, r - 0.03, cx, cy, new THREE.Path()));
  const pane = extrude(outer, 1.05, M.rail, { bevel: 0 });
  pane.castShadow = false;
  pane.position.y = y;
  g.add(pane);
  g.add(outlineTube(rrect(w - 0.03, d - 0.03, r - 0.015, cx, cy), y + 1.08, 0.04, M.metal));
  // The glass top edge catches light: a faint bright line just under the rail.
  g.add(outlineTube(rrect(w - 0.03, d - 0.03, r - 0.015, cx, cy), y + 1.035, 0.008, RAIL_EDGE, 160));
  return g;
}
/** Slim bronze mullions standing just proud of a glazed outline. */
export function mullions(shape, y, h, spacing, depth = 0.12) {
  const n = Math.floor(shape.getLength() / spacing);
  const pts = shape.getSpacedPoints(n);
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, h, depth), M.metal, n);
  const q = new THREE.Quaternion(),
    up = new THREE.Vector3(0, 1, 0),
    m4 = new THREE.Matrix4(),
    one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < n; i++) {
    const a = pts[i],
      b = pts[i + 1];
    const tx = b.x - a.x,
      ty = b.y - a.y,
      l = Math.hypot(tx, ty) || 1;
    const nx = ty / l,
      ny = -tx / l; // outward normal in plan
    q.setFromAxisAngle(up, Math.atan2(ty, tx));
    m4.compose(new THREE.Vector3(a.x + nx * depth * 0.5, y + h / 2, -(a.y + ny * depth * 0.5)), q, one);
    mesh.setMatrixAt(i, m4);
  }
  mesh.castShadow = mesh.receiveShadow = true;
  // End caps top and bottom, so each mullion reads as a fixed section, not a line.
  const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.035, depth + 0.04), M.metal, n * 2),
    p = new THREE.Vector3(),
    s = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    mesh.getMatrixAt(i, m4);
    m4.decompose(p, q, s);
    for (const [k, dy] of [
      [0, -h / 2 + 0.02],
      [1, h / 2 - 0.02],
    ])
      caps.setMatrixAt(i * 2 + k, m4.compose(new THREE.Vector3(p.x, p.y + dy, p.z), q, one));
  }
  mesh.add(caps);
  return mesh;
}

/** Is plan point (x, y) inside a centred rounded rectangle? */
export function inRRect(x, y, w, d, r) {
  const ax = Math.abs(x),
    ay = Math.abs(y);
  if (ax > w / 2 || ay > d / 2) return false;
  return Math.hypot(Math.max(ax - (w / 2 - r), 0), Math.max(ay - (d / 2 - r), 0)) <= r;
}

/* Small repeated parts are collected as world matrices while the building
   is assembled and drawn as one instanced mesh each at the end. */
export const parts = { downlight: [], trough: [], hedge: [], seat: [], seatFrame: [], table: [] };
const partRnd = mulberry(77);
const _m = new THREE.Matrix4(),
  _q = new THREE.Quaternion(),
  _v = new THREE.Vector3(),
  _s = new THREE.Vector3();
export function put(list, parent, x, y, z, sx = 1, sy = 1, sz = 1, rotY = 0) {
  _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  _m.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
  if (parent) {
    parent.updateMatrix();
    _m.premultiply(parent.matrix);
  }
  list.push(_m.clone());
}
/** Recessed downlights on a grid across the soffit band between two outlines. */
export function soffitLights(parent, y, outer, inner, step = 1.5, skip = () => false) {
  for (let x = -outer[0] / 2; x <= outer[0] / 2; x += step)
    for (let z = -outer[1] / 2; z <= outer[1] / 2; z += step) {
      if (!inRRect(x, z, outer[0] - 0.9, outer[1] - 0.9, Math.max(outer[2] - 0.45, 0.1))) continue;
      if (inner && inRRect(x, z, inner[0] + 0.5, inner[1] + 0.5, inner[2] + 0.25)) continue;
      if (skip(x, z)) continue;
      put(parts.downlight, parent, x, y, -z);
    }
}
/** Charcoal planter troughs with clipped hedges, in runs along an outline. */
export function planters(parent, shape, y, seed, step = 0.9) {
  const n = Math.floor(shape.getLength() / step),
    pts = shape.getSpacedPoints(n);
  for (let k = 0; k < n; k++) {
    if (Math.sin(k * 0.19 + seed * 1.7) < -0.25) continue;
    const a = pts[k],
      b = pts[k + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y) + 0.03,
      rot = Math.atan2(b.y - a.y, b.x - a.x);
    const cx = (a.x + b.x) / 2,
      cz = -(a.y + b.y) / 2;
    put(parts.trough, parent, cx, y + 0.27, cz, len, 0.54, 0.5, rot);
    put(parts.hedge, parent, cx, y + 0.5 + 0.24, cz, len, 0.5 + partRnd() * 0.06, 0.46, rot);
  }
}
