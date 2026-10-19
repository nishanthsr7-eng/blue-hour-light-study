import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry, TAU, yieldToBrowser } from '../core/util.js';
import { hedgeGeometry } from '../textures/procedural.js';
import { scene, SNOW_COVER, STAGE_C } from '../core/scene.js';
import { M } from './materials.js';
import { extrude, flat, parts, rrect } from './geometry.js';
import { addGlint, decalMat, haloMats, halos, mistTex } from './kit.js';
import { glowPts } from '../tower/base.js';
import { tufts } from '../tower/trees.js';

/* ════════════════════════════════════════════════════════════════════════
   Ground: gravel and steel edging round the plinth, a meadow rolling into
   dark hills, and a wet stone approach lined with louvred bollards.
   ════════════════════════════════════════════════════════════════════════ */

await yieldToBrowser(); // a fresh slice for this build step (util.js)

function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, y) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    xf = x - xi,
    yf = y - yi;
  const u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi),
    b = hash(xi + 1, yi),
    c = hash(xi, yi + 1),
    d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function groundY(x, z) {
  const r = Math.hypot(x, z);
  let n = 0,
    amp = 1,
    f = 0.012;
  for (let o = 0; o < 4; o++) {
    n += vnoise(x * f + 40, z * f + 40) * amp;
    amp *= 0.5;
    f *= 2.05;
  }
  const rise = THREE.MathUtils.smoothstep(r, 170, 720);
  return rise * rise * (n * 70 - 22) + (vnoise(x * 0.05, z * 0.05) - 0.5) * 0.6 * THREE.MathUtils.smoothstep(r, 26, 60);
}
{
  const geo = new THREE.PlaneGeometry(1600, 1600, 240, 240);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position,
    uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    p.setY(i, groundY(p.getX(i), p.getZ(i)));
    uv.setXY(i, p.getX(i), -p.getZ(i));
  }
  geo.computeVertexNormals();
  // Stage: the meadow falls into darkness from ~45 m out, and the hills
  // stay a dim, hazy silhouette so nothing competes with a lit window.
  M.grass.onBeforeCompile = (sh) => {
    sh.uniforms.uSnowCover = SNOW_COVER;
    sh.uniforms.uStageC = STAGE_C;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vWP;\nuniform float uSnowCover;\nuniform vec3 uStageC;',
      )
      // Snow lies unevenly: thin where the meadow's tufts poke through, full on the hills.
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\nfloat snl = 0.72 + 0.28 * sin(vWP.x * 0.73) * sin(vWP.z * 0.61 + 1.7);\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.81, 0.87), uSnowCover * snl);',
      )
      .replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\nfloat stg = smoothstep(45.0, 110.0, length(vWP.xz));\ngl_FragColor.rgb = mix(gl_FragColor.rgb * (1.0 - 0.7 * stg), uStageC, 0.45 * stg);',
      );
  };
  const ground = new THREE.Mesh(geo, M.grass);
  ground.receiveShadow = true;
  scene.add(ground);

  const strip = rrect(46, 40, 10);
  strip.holes.push(rrect(41.25, 35.25, 7.62, 0, 0, new THREE.Path()));
  const gv = flat(strip, M.gravel);
  gv.position.y = 0.03;
  scene.add(gv);
  const edge = rrect(46.06, 40.06, 10.03);
  edge.holes.push(rrect(46, 40, 10, 0, 0, new THREE.Path()));
  const em = extrude(edge, 0.09, M.steel, { bevel: 0 });
  em.position.y = -0.03;
  scene.add(em);
  // Feather-reed grass in loose drifts along the gravel.
  const outline = rrect(43.6, 37.6, 8.8),
    rnd = mulberry(111);
  for (let s = 0; s < 1; s += 0.0145) {
    if (rnd() < 0.3) continue;
    const c = outline.getPointAt(s),
      x = c.x,
      z = -c.y;
    if (z > 15 && Math.abs(x) < 7) continue;
    for (let k = 0, n = 2 + ((rnd() * 4) | 0); k < n; k++) {
      const m4 = new THREE.Matrix4(),
        sc = 0.8 + rnd() * 0.6;
      m4.compose(
        new THREE.Vector3(x + (rnd() - 0.5) * 1.2, 0.03, z + (rnd() - 0.5) * 1.2),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * TAU),
        new THREE.Vector3(sc, sc * (0.9 + rnd() * 0.4), sc),
      );
      tufts.push(m4);
    }
  }

  const path = flat(rrect(7, 120, 0.5, 0, -82), M.travertine);
  path.position.y = 0.04;
  scene.add(path);
  // Louvred bollards: four bronze fins over a warm core, each pooling light.
  const spots = [];
  for (let z = 26; z < 140; z += 6) for (const x of [-4.4, 4.4]) spots.push([x, z]);
  const inst = (geo, mat, ys, shadow = true) => {
    const m = new THREE.InstancedMesh(geo, mat, spots.length * ys.length),
      m4 = new THREE.Matrix4();
    let i = 0;
    for (const [x, z] of spots) for (const y of ys) m.setMatrixAt(i++, m4.makeTranslation(x, y, z));
    m.castShadow = m.receiveShadow = shadow;
    scene.add(m);
  };
  inst(new THREE.CylinderGeometry(0.085, 0.085, 0.8, 16), M.metal, [0.4]);
  inst(new THREE.CylinderGeometry(0.11, 0.11, 0.014, 24), M.metal, [0.835, 0.875, 0.915, 0.955]);
  inst(new THREE.CylinderGeometry(0.118, 0.118, 0.03, 24), M.metal, [0.99]);
  inst(new THREE.CylinderGeometry(0.06, 0.06, 0.15, 12), M.lamp, [0.89], false);
  const pool = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(4.6, 4.6).rotateX(-Math.PI / 2),
    decalMat({ reach: 2.3, strength: 0.35 }),
    spots.length,
  );
  spots.forEach(([x, z], i) => {
    pool.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, Math.max(0.05, groundY(x, z) + 0.03), z));
    glowPts.bollard.push(new THREE.Vector3(x, 0.9, z));
  });
  pool.renderOrder = -2;
  scene.add(pool);
}

// Night life beyond the hills: clustered town lights and a few winding
// roads of sodium lamps, mostly warm with the odd cool LED.
{
  const rnd = mulberry(131),
    pos = [],
    col = [],
    size = [];
  const light = (x, z, warm, k, s) => {
    pos.push(x, groundY(x, z) + 0.8, z);
    k *= 0.4; // kept faint and far: a hint of life, never a rival to the house
    col.push(...(warm ? [1.0 * k, 0.7 * k, 0.4 * k] : [0.72 * k, 0.82 * k, 1.0 * k]));
    size.push(s);
  };
  for (let c = 0; c < 30; c++) {
    const a = rnd() * TAU,
      r = 230 + rnd() * 470,
      cx = Math.cos(a) * r,
      cz = Math.sin(a) * r;
    const spread = 6 + rnd() * 26,
      n = 40 + ((rnd() * 180) | 0);
    for (let i = 0; i < n; i++) {
      light(
        cx + (rnd() + rnd() - 1) * spread * 2,
        cz + (rnd() + rnd() - 1) * spread * 2,
        rnd() < 0.78,
        0.45 + rnd() * 0.9,
        0.5 + rnd() * 1.1,
      );
    }
  }
  for (let rd = 0; rd < 5; rd++) {
    let a = rnd() * TAU,
      r = 220 + rnd() * 120;
    const da = (rnd() - 0.5) * 0.004,
      dr = 1.6 + rnd() * 1.2;
    for (let i = 0; i < 220; i++) {
      a += da + Math.sin(i * 0.05 + rd) * 0.002;
      r += dr;
      if (i % 2 === 0) light(Math.cos(a) * r, Math.sin(a) * r, true, 0.9, 0.7);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 400 } },
    vertexShader: /* glsl */ `
      attribute float aSize; attribute vec3 color; uniform float uScale; varying vec3 vC; varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float px = aSize * uScale / -mv.z;
        gl_PointSize = clamp(px * 3.0, 1.5, 6.0);
        vA = clamp(px * 6.0, 0.35, 1.0);
        vC = color;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vC; varying float vA;
      void main() { float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; gl_FragColor = vec4(vC * vA * pow(1.0 - r, 1.6) * 1.4, 1.0); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  haloMats.push(mat);
  scene.add(new THREE.Points(g, mat));
}

// Instance the small repeated parts
{
  const mk = (geo, mat, list, shadow = true) => {
    if (!list.length) return;
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((x, i) => m.setMatrixAt(i, x));
    m.castShadow = m.receiveShadow = shadow;
    scene.add(m);
  };
  mk(new THREE.CircleGeometry(0.07, 12).rotateX(Math.PI / 2), M.downlight, parts.downlight, false);
  mk(new THREE.BoxGeometry(1, 1, 1), M.planter, parts.trough);
  mk(hedgeGeometry(), M.hedge, parts.hedge);
  const tuftGeo = (() => {
    const g = mergeGeometries(
      [0, 1, 2].map((k) => new THREE.PlaneGeometry(0.8, 0.9).translate(0, 0.45, 0).rotateY((k * Math.PI) / 3)),
    );
    const n = g.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
    return g;
  })();
  const t = new THREE.InstancedMesh(tuftGeo, M.tuft, tufts.length);
  tufts.forEach((m4, i) => t.setMatrixAt(i, m4));
  t.receiveShadow = true;
  scene.add(t);
}
halos(glowPts.bollard, 0.9, 0xffc896, 0.45);
halos(glowPts.canopy, 0.55, 0xffd8b0, 0.35);
halos(glowPts.pendant, 1.1, 0xffc890, 0.6);
halos(glowPts.level, 0.9, 0xffc890, 0.45);
halos(glowPts.penthouse, 1.0, 0xffc890, 0.5);
// What the wet ground mirrors: the lit lobby glass (broad and soft), the
// canopy downlights, the uplit tree crowns and the nearest bollards.
for (const x of [-7.5, -3.75, 0, 3.75, 7.5]) addGlint(x, 4.2, 7.1, 1.5, 0.16);
for (const p of glowPts.canopy) addGlint(p.x, p.y, p.z, 0.12, 0.35);
addGlint(16.5, 5.2, 15, 1.4, 0.08);
addGlint(16.5, 5, -2.5, 1.4, 0.06);
for (const p of glowPts.bollard.filter((p) => p.z < 50)) addGlint(p.x, p.y, p.z, 0.09, 0.9);

// Ground mist drifting low across the meadow.
export const mist = [];
{
  const rnd = mulberry(121);
  for (let i = 0; i < 16; i++) {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: mistTex,
        color: 0x56607e,
        transparent: true,
        opacity: 0.05 + rnd() * 0.04,
        depthWrite: false,
      }),
    );
    const a = rnd() * TAU,
      r = 48 + rnd() * 50;
    s.position.set(Math.cos(a) * r, 1.2 + rnd() * 1.5, Math.sin(a) * r);
    s.scale.set(34 + rnd() * 20, 5 + rnd() * 3, 1);
    s.userData = { x0: s.position.x, v: 0.3 + rnd() * 0.5, ph: rnd() * TAU };
    scene.add(s);
    mist.push(s);
  }
}

// Warm dust motes drifting up through the scene
export const motes = (() => {
  const n = 260,
    p = new Float32Array(n * 3),
    s = new Float32Array(n);
  const rnd = mulberry(55);
  for (let i = 0; i < n; i++) {
    const r = Math.pow(rnd(), 0.6) * 40,
      a = rnd() * TAU;
    p[i * 3] = Math.cos(a) * r;
    p[i * 3 + 1] = rnd() * 14;
    p[i * 3 + 2] = Math.sin(a) * r;
    s[i] = rnd();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(s, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime; varying float vA;
      void main() {
        vec3 q = position;
        q.y = mod(q.y + uTime * (0.1 + aSeed * 0.2), 14.0);
        q.x += sin(uTime * 0.2 + aSeed * 40.0) * 1.2;
        q.z += cos(uTime * 0.17 + aSeed * 30.0) * 1.2;
        vec4 mv = modelViewMatrix * vec4(q, 1.0);
        vA = (0.3 + 0.7 * aSeed) * smoothstep(0.0, 2.0, q.y) * smoothstep(14.0, 10.0, q.y);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((1.0 + aSeed * 2.0) * (40.0 / -mv.z), 0.8, 5.0);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        if (r > 1.0) discard;
        gl_FragColor = vec4(1.0, 0.78, 0.55, vA * 0.45 * (1.0 - r));
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  scene.add(new THREE.Points(g, mat));
  return mat;
})();
