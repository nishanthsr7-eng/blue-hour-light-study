import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { debug, yieldToBrowser } from './util.js';
import { scene } from './scene.js';
import { anchors } from '../tower/base.js';

/* Draw-call diet: ~1,200 separate meshes would cost ~2,700 calls a frame.
   1. Merge: within each parent group, static meshes that share a material
      become one mesh. Merging per parent keeps the twisting floors, the lift
      and every other animated group moving as before. Anything the code
      addresses on its own (userData, children, hooks, anchors, transparency,
      custom render order) is left alone.
   2. Reflection layer: the mirror pool only reflects what you can read in a
      small dark pool at night — sky, tower-scale forms, emitters and lights —
      not every chair and grass tuft. */
{
  const anchored = new Set(Object.values(anchors).filter((v) => v?.isObject3D));
  const plainHook = THREE.Object3D.prototype.onBeforeRender;
  const sig = (g) =>
    (g.index ? 'i' : 'n') +
    Object.keys(g.attributes)
      .sort()
      .map((k) => k + g.attributes[k].itemSize)
      .join();
  const groups = new Map();
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (o.type !== 'Mesh' || !o.parent || Array.isArray(o.material) || o.material.transparent) return;
    if (o.children.length || Object.keys(o.userData).length || o.onBeforeRender !== plainHook || anchored.has(o))
      return;
    if (!o.visible || o.renderOrder || !o.frustumCulled || o.geometry.morphAttributes.position) return;
    const key = `${o.parent.uuid}|${o.material.uuid}|${o.castShadow}|${o.receiveShadow}|${sig(o.geometry)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  });
  let before = 0,
    after = 0;
  for (const list of groups.values()) {
    await yieldToBrowser();
    before += list.length;
    if (list.length < 2) {
      after += list.length;
      continue;
    }
    const geos = list.map((o) => {
      o.updateMatrix();
      const g = o.geometry.clone().applyMatrix4(o.matrix);
      g.groups.length = 0;
      return g;
    });
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) {
      after += list.length;
      continue;
    }
    const first = list[0],
      m = new THREE.Mesh(merged, first.material);
    m.castShadow = first.castShadow;
    m.receiveShadow = first.receiveShadow;
    first.parent.add(m);
    for (const o of list) o.parent.remove(o);
    after++;
  }
  debug(`[perf] merged ${before} static meshes into ${after}`);

  const REFLECT = 1,
    sphere = new THREE.Sphere();
  anchors.mirror.camera.layers.set(REFLECT);
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (o === anchors.mirror) return;
    let show = o.isLight || o.isPoints || o.isSprite;
    if (!show && o.isMesh) {
      const g = o.geometry;
      if (!g.boundingSphere) g.computeBoundingSphere();
      sphere.copy(g.boundingSphere).applyMatrix4(o.matrixWorld);
      const emitter = o.material?.isMeshBasicMaterial && o.material.toneMapped === false;
      show = sphere.radius >= 2 || emitter || !!o.material?.isShaderMaterial;
    }
    if (show) o.layers.enable(REFLECT);
  });
}
