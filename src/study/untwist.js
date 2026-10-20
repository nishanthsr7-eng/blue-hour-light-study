import * as THREE from 'three';
import { REDUCED } from '../core/util.js';
import { renderer, scene } from '../core/scene.js';
import { building } from '../world/kit.js';
import { FH, L1 } from '../tower/slab.js';
import { motes } from '../world/ground.js';
import { airMotes } from '../world/atmosphere.js';

/* ════════════════════════════════════════════════════════════════════════
   Drag to untwist: the slabs swing back to a plain stack, then twist again
   ════════════════════════════════════════════════════════════════════════ */

/* Each floor (0–9) and the penthouse (10) rides its own under-damped spring
   from its designed rotation (s = 0) to a plain stack (s = 1). Dragging right
   pulls the target toward 1; letting go springs every slab back past its
   design and settles, the top floors a beat behind the bottom ones. Parts
   that were baked into world space (downlights, troughs, hedges, leaf cards,
   trailing plants, lamp halos) rotate with their floor by instance. */
const TWIST = [];
building.traverse((o) => {
  if (o.userData.twistFloor != null) TWIST[o.userData.twistFloor] = { g: o, base: o.rotation.y, s: 0, v: 0, d: 0 };
});
const twistOfY = (x, y, z) => {
  if (y < 7) return -1;
  const f = Math.min(Math.floor((y - L1 + 1.0) / FH), 10); // a floor owns 1 m below its slab to 2.6 m above
  return Math.hypot(x, z) < (f === 10 ? 17 : 13.5) ? f : -1;
};
const twistSets = [];
{
  const v = new THREE.Vector3(),
    m4 = new THREE.Matrix4();
  scene.traverse((o) => {
    if (!(o.isInstancedMesh || o.isPoints) || o.userData.static || o.material === motes || o.material === airMotes)
      return;
    for (let p = o.parent; p; p = p.parent) if (p.userData.twistFloor != null) return; // already turns with its group
    const n = o.isInstancedMesh ? o.count : o.geometry.attributes.position.count,
      of = new Int8Array(n);
    let any = false;
    for (let k = 0; k < n; k++) {
      if (o.isInstancedMesh) {
        o.getMatrixAt(k, m4);
        v.setFromMatrixPosition(m4);
      } else v.fromBufferAttribute(o.geometry.attributes.position, k);
      of[k] = o.userData.twistOf?.[k] ?? twistOfY(v.x, v.y, v.z);
      any ||= of[k] >= 0;
    }
    if (!any) return;
    const attr = o.isInstancedMesh ? o.instanceMatrix : o.geometry.attributes.position;
    twistSets.push({ o, of, attr, base: attr.array.slice() });
  });
}
const _tm = new THREE.Matrix4(),
  _tr = new THREE.Matrix4();
function applyTwist() {
  for (const t of TWIST) t.g.rotation.y = t.base + t.d;
  for (const { o, of, attr, base } of twistSets) {
    const a = attr.array;
    for (let k = 0; k < of.length; k++) {
      const f = of[k];
      if (f < 0) continue;
      const d = TWIST[f].d;
      if (o.isInstancedMesh) {
        _tr.makeRotationY(d);
        _tm
          .fromArray(base, k * 16)
          .premultiply(_tr)
          .toArray(a, k * 16);
      } else {
        const c = Math.cos(d),
          s = Math.sin(d),
          x = base[k * 3],
          z = base[k * 3 + 2];
        a[k * 3] = c * x + s * z;
        a[k * 3 + 2] = -s * x + c * z;
      }
    }
    attr.needsUpdate = true;
  }
  renderer.shadowMap.needsUpdate = true; // the shadows are drawn once; redraw them while the stack moves
}
let drag = null,
  twistTarget = 0,
  twistAwake = false;
addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || e.shiftKey || e.target.closest('a, button, .rail, .timebar, .toggles, .keys')) return;
  drag = { x: e.clientX, id: e.pointerId };
  document.body.classList.add('is-dragging');
});
addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  twistTarget = THREE.MathUtils.clamp((e.clientX - drag.x) / (innerWidth * 0.32), -0.45, 1);
  twistAwake = true;
});
const endDrag = () => {
  if (!drag) return;
  drag = null;
  twistTarget = 0;
  twistAwake = true;
  document.body.classList.remove('is-dragging');
};
addEventListener('pointerup', endDrag);
addEventListener('pointercancel', endDrag);
addEventListener('blur', endDrag);
export function twistStep(dt) {
  if (!twistAwake) return false;
  let busy = !!drag;
  for (let i = 0; i < TWIST.length; i++) {
    const t = TWIST[i];
    if (REDUCED) {
      t.s = twistTarget;
      t.v = 0;
    } else {
      // Stiffer at the base, looser up the stack: the twist travels upward like a wave.
      const k = 95 - 5 * i,
        c = 2 * 0.26 * Math.sqrt(k);
      for (let h = dt, sub = Math.min(dt, 1 / 120); h > 1e-6; h -= sub) {
        const st = Math.min(sub, h);
        t.v += (k * (twistTarget - t.s) - c * t.v) * st;
        t.s += t.v * st;
      }
    }
    t.d = -t.base * t.s;
    busy ||= Math.abs(t.s - twistTarget) > 1e-4 || Math.abs(t.v) > 1e-4;
  }
  applyTwist();
  if (!busy) twistAwake = false;
  return true;
}
