import * as THREE from 'three';
import { MAX_ANISO, mulberry, TAU, yieldToBrowser } from '../core/util.js';
import { scene } from '../core/scene.js';
import { M } from '../world/materials.js';
import { ao, at, building } from '../world/kit.js';
import { FLOOR } from './base.js';
import { LEAF_LIT, terraceTrees, trailing, trailingFloor } from './furniture.js';
import { foliageGeo } from './penthouse.js';

/* Leaf cards: a smooth blob alone reads as a green ball, because real crowns
   are defined by their ragged, see-through edge. A cluster of alpha-tested
   leaf sprays round each blob breaks the silhouette; the normals point out
   from the centre so the cards shade like one soft mass, never as flat planes. */

await yieldToBrowser(); // a fresh slice for this build step (util.js)
const leafCardTex = (() => {
  // One dense, rounded spray per card: leaves packed toward the centre so the
  // card's edge is a clean scalloped outline of whole leaves, never loose
  // confetti floating off the crown.
  const rnd = mulberry(61),
    c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 150; i++) {
    const rr = 92 * Math.sqrt(rnd()),
      th = rnd() * TAU,
      x = 128 + Math.cos(th) * rr,
      y = 128 + Math.sin(th) * rr;
    const a = th + (rnd() - 0.5) * 1.2,
      l = 10 + rnd() * 7,
      v = 0.55 + rnd() * 0.5 + (1 - rr / 92) * -0.15;
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.fillStyle =
      rnd() < 0.18
        ? `rgb(${(150 * v) | 0},${(172 * v) | 0},${(72 * v) | 0})`
        : `rgb(${(66 * v) | 0},${(112 * v) | 0},${(50 * v) | 0})`;
    g.beginPath();
    g.moveTo(-l, 0);
    g.quadraticCurveTo(0, -l * 0.55, l, 0);
    g.quadraticCurveTo(0, l * 0.55, -l, 0);
    g.fill();
    g.strokeStyle = 'rgba(20,30,12,.35)';
    g.lineWidth = 0.7;
    g.beginPath();
    g.moveTo(-l * 0.8, 0);
    g.lineTo(l * 0.8, 0);
    g.stroke();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = MAX_ANISO;
  return t;
})();
const leafCardGeo = (() => {
  // Cards sit just proud of the blob and lie roughly along its surface (tilted
  // up to ~45°), so the crown gains a leafy rim without slivers sticking out.
  const rnd = mulberry(63),
    pos = [],
    nrm = [],
    uv = [],
    idx = [];
  const q = new THREE.Quaternion(),
    spin = new THREE.Quaternion(),
    tilt = new THREE.Quaternion();
  const v = new THREE.Vector3(),
    c = new THREE.Vector3(),
    n = new THREE.Vector3(),
    z = new THREE.Vector3(0, 0, 1),
    ax = new THREE.Vector3();
  for (let k = 0; k < 32; k++) {
    n.set(rnd() - 0.5, (rnd() - 0.35) * 0.9, rnd() - 0.5).normalize();
    c.copy(n).multiplyScalar(0.8 + rnd() * 0.14);
    q.setFromUnitVectors(z, n);
    spin.setFromAxisAngle(z, rnd() * TAU);
    tilt.setFromAxisAngle(ax.set(rnd() - 0.5, rnd() - 0.5, 0).normalize(), (rnd() - 0.5) * 1.5);
    q.multiply(tilt).multiply(spin);
    const s = 0.42 + rnd() * 0.12,
      base = pos.length / 3;
    for (const [x, y] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      v.set(x * s, y * s, 0)
        .applyQuaternion(q)
        .add(c);
      pos.push(v.x, v.y, v.z);
      v.normalize();
      nrm.push(v.x, v.y, v.z);
      uv.push((x + 1) / 2, (y + 1) / 2);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
})();
export const CARD_MATS = new Map();
function cardMat(leafMat) {
  if (!CARD_MATS.has(leafMat)) {
    const m = new THREE.MeshStandardMaterial({
      map: leafCardTex,
      alphaTest: 0.4,
      alphaToCoverage: true,
      side: THREE.DoubleSide,
      roughness: 0.75,
      color: leafMat.color,
      envMapIntensity: 0.5,
    });
    // Thin leaves let light through: looking toward the moon, the crown's edge glows
    // in the leaf's own colour. One dot product, no extra light or pass.
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
      #if NUM_DIR_LIGHTS > 0
        float leafBack = pow(max(dot(-normalize(vViewPosition), directionalLights[0].direction), 0.0), 3.0);
        reflectedLight.directDiffuse += diffuseColor.rgb * directionalLights[0].color * leafBack * 0.45;
      #endif`,
      );
    };
    if (leafMat.emissive) {
      m.emissive = leafMat.emissive.clone();
      m.emissiveMap = leafCardTex;
      m.emissiveIntensity = leafMat.emissiveIntensity;
    }
    CARD_MATS.set(leafMat, m);
  }
  return CARD_MATS.get(leafMat);
}
const leafShells = []; // [blob mesh, leaf material]; drawn as one instanced mesh per material
export const tufts = [];
function tree(
  x,
  z,
  seed,
  {
    H = 6,
    stems = 3,
    planterMat = M.planter,
    light = false,
    parent = building,
    y = FLOOR,
    scale = 1,
    grass = true,
    leafMat = M.leaf,
    crown = 'cluster',
  } = {},
) {
  const rnd = mulberry(seed),
    g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  parent.add(g);
  const pl = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.62, 48), planterMat);
  pl.position.y = 0.31;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.022, 6, 64).rotateX(Math.PI / 2), M.metal);
  lip.position.y = 0.62;
  const soil = new THREE.Mesh(new THREE.CircleGeometry(1.32, 40).rotateX(-Math.PI / 2), M.soil);
  soil.position.y = 0.58;
  [pl, lip, soil].forEach((m) => {
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  });
  ao(
    { w: 2.7 * scale, d: 2.7 * scale, r: 1.35 * scale, reach: 0.7 * scale, strength: 0.45 },
    x,
    y + 0.003,
    z,
    0,
    parent,
  );
  for (let k = 0; k < (grass ? 9 : 0); k++) {
    const a = (k / 9) * TAU + rnd() * 0.4,
      rr = 0.8 + rnd() * 0.3,
      m4 = new THREE.Matrix4();
    m4.compose(
      new THREE.Vector3(x + Math.cos(a) * rr, FLOOR + 0.58, z + Math.sin(a) * rr),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * TAU),
      new THREE.Vector3(0.7, 0.55 + rnd() * 0.3, 0.7),
    );
    tufts.push(m4);
  }
  const up = new THREE.Vector3(0, 1, 0),
    base = 0.58;
  const blob = (p, s) => {
    const m = new THREE.Mesh(foliageGeo, leafMat);
    m.position.copy(p);
    const j = crown === 'natural' ? 0.1 : 0.3;
    m.scale.set(s * (1 + rnd() * j), s * (crown === 'natural' ? 0.82 : 0.8), s * (1 + rnd() * j));
    m.rotation.y = rnd() * TAU;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    leafShells.push([m, leafMat]);
  };
  const limb = (from, dir, len, r0, r1) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 8), M.bark);
    m.position.copy(from).addScaledVector(dir, len / 2);
    m.quaternion.setFromUnitVectors(up, dir);
    m.castShadow = true;
    g.add(m);
    return from.clone().addScaledVector(dir, len);
  };
  const dirAt = (a, tilt) =>
    new THREE.Vector3(Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a));
  if (crown === 'cluster') {
    for (let k = 0; k < stems; k++) {
      const a = (k / stems) * TAU + rnd() * 0.8,
        L = H * (0.5 + rnd() * 0.15);
      const o = new THREE.Vector3(0, base, 0),
        tip = limb(o, dirAt(a, 0.12 + rnd() * 0.22), L, 0.1, 0.045);
      for (let b = 0; b < 2; b++) {
        const from = o.clone().lerp(tip, 0.45 + rnd() * 0.3);
        blob(limb(from, dirAt(a + (rnd() - 0.5) * 2.4, 0.6 + rnd() * 0.3), H * 0.22, 0.045, 0.02), 0.7 + rnd() * 0.4);
      }
      blob(tip, 1.0 + rnd() * 0.5);
      blob(tip.clone().add(new THREE.Vector3((rnd() - 0.5) * 1.2, -0.5, (rnd() - 0.5) * 1.2)), 0.8 + rnd() * 0.3);
    }
  } else {
    // Stems and a few short limbs fan up into the crown; they end inside it.
    const tips = [];
    for (let k = 0; k < stems; k++) {
      const a = (k / stems) * TAU + rnd() * 0.5,
        L = H * (0.5 + rnd() * 0.08);
      const o = new THREE.Vector3(0, base, 0),
        tip = limb(o, dirAt(a, 0.16 + rnd() * 0.12), L, 0.1, 0.045);
      limb(o.clone().lerp(tip, 0.6), dirAt(a + (rnd() - 0.5) * 1.6, 0.7), H * 0.18, 0.04, 0.02);
      tips.push(tip);
    }
    // The crown is designed, not scattered: a dome on top, a waist ring of six
    // lobes and a tucked inner ring underneath. That reads as one clean,
    // rounded umbrella silhouette from any angle; the seed only nudges it.
    const R = H * 0.34,
      c = tips.reduce((s, t) => s.add(t), new THREE.Vector3()).divideScalar(tips.length);
    c.y += R * 0.15;
    c.x *= 0.4;
    c.z *= 0.4;
    const lobe = (a, r, dy, s) => blob(new THREE.Vector3(c.x + Math.cos(a) * r, c.y + dy, c.z + Math.sin(a) * r), s);
    lobe(0, 0, R * 0.32, R * 0.62);
    const a0 = rnd() * TAU;
    for (let k = 0; k < 6; k++)
      lobe(
        a0 + (k / 6) * TAU + (rnd() - 0.5) * 0.35,
        R * (0.52 + rnd() * 0.12),
        (rnd() - 0.5) * R * 0.2,
        R * (0.4 + rnd() * 0.1),
      );
    for (let k = 0; k < 4; k++) lobe(a0 + (k / 4 + 0.125) * TAU, R * 0.3, -R * 0.24, R * 0.4);
  }
  if (light) {
    const l = new THREE.PointLight(0xffc48a, 7, 8, 1.6);
    l.position.set(0.5, base + 0.15, 0.6);
    g.add(l);
    at(new THREE.Mesh(new THREE.CircleGeometry(0.06, 16).rotateX(-Math.PI / 2), M.lamp), 0.5, base + 0.005, 0.6, g);
  }
  return g;
}
tree(16.5, 15, 101, { H: 6.5, light: true });
tree(16.5, -2.5, 103, { H: 6, light: true, crown: 'natural' }); // background tree: a designed, rounded crown
tree(-16.5, -3, 105, { H: 6.2 });
// Terrace trees: a small multi-stem in a 1.5 m planter, kept under the soffit above.
for (const t of terraceTrees)
  tree(t.x, t.z, t.seed, { H: 4.2, stems: 3, parent: t.g, y: t.y, scale: 0.55, grass: false, leafMat: LEAF_LIT });
{
  // Every crown's leaf-card shell, one instanced draw per leaf material.
  scene.updateMatrixWorld(true);
  const byMat = new Map(),
    s = new THREE.Matrix4().makeScale(1.05, 0.86, 1.05);
  const ownerFloor = (o) => {
    for (let p = o; p; p = p.parent) if (p.userData.twistFloor != null) return p.userData.twistFloor;
    return -1;
  };
  for (const [m, mat] of leafShells) {
    if (!byMat.has(mat)) byMat.set(mat, []);
    byMat.get(mat).push(m.matrixWorld.clone().multiply(s));
    (byMat.get(mat).floors ??= []).push(ownerFloor(m));
  }
  for (const [mat, list] of byMat) {
    const im = new THREE.InstancedMesh(leafCardGeo, cardMat(mat), list.length);
    im.userData.twistOf = list.floors;
    list.forEach((m4, k) => im.setMatrixAt(k, m4));
    im.castShadow = im.receiveShadow = true;
    scene.add(im);
  }
  // Trailing plants: a small dark core for density inside a ragged card spray.
  const core = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.62, 1), LEAF_LIT, trailing.length);
  const spray = new THREE.InstancedMesh(leafCardGeo, cardMat(LEAF_LIT), trailing.length);
  trailing.forEach((m4, k) => {
    core.setMatrixAt(k, m4);
    spray.setMatrixAt(k, m4);
  });
  core.userData.twistOf = spray.userData.twistOf = trailingFloor;
  for (const m of [core, spray]) {
    m.castShadow = false;
    m.receiveShadow = true;
    scene.add(m);
  }
}
