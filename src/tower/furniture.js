import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry, TAU, yieldToBrowser } from '../core/util.js';
import {
  artTex,
  ashTex,
  booksTex,
  boucleTex,
  fabricTex,
  kilimTex,
  leatherTex,
  marbleTex,
  rattanTex,
  terracottaTex,
  terrazzoTex,
  velvetTex,
  walnutTex,
  woolTex,
} from '../textures/procedural.js';
import { M } from '../world/materials.js';
import { extrude } from '../world/geometry.js';
import { ao, at, decal, rbox } from '../world/kit.js';
import { glowPts } from './base.js';
import { FIG_GLSL } from './rooms.js';

// Furniture per room type, in the floor's local frame, in front of the traced room.
const M_TV = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x5a8cff).multiplyScalar(0.7), toneMapped: false });
export const ROOMS = {
  living(g, F, RY1, spec) {
    at(rbox(5.0, 0.012, 3.4, M.rug, 0.004), -0.8, F + 0.006, 0.9, g);
    at(rbox(3.4, 0.42, 1.0, M.cushion, 0.08), -0.8, F + 0.23, 2.1, g);
    at(rbox(3.4, 0.46, 0.24, M.cushion, 0.08), -0.8, F + 0.62, 2.5, g);
    at(rbox(1.0, 0.42, 1.9, M.cushion, 0.08), -3.0, F + 0.23, 1.15, g);
    at(rbox(0.24, 0.46, 1.9, M.cushion, 0.08), -3.38, F + 0.62, 1.15, g);
    for (const [x, z] of [
      [-1.3, 2.05],
      [-0.1, 2.05],
    ])
      at(rbox(0.5, 0.14, 0.45, M.cushion, 0.06), x, F + 0.5, z, g);
    at(rbox(1.4, 0.34, 0.8, M.travertine, 0.03), -0.8, F + 0.17, 0.5, g);
    const glow = spec.note ? glowPts[spec.note] : null;
    // Arc floor lamp over the sofa.
    {
      const arc = new THREE.CatmullRomCurve3(
        [
          [-3.45, 1.1],
          [-3.25, 1.85],
          [-2.5, 2.25],
          [-1.7, 2.2],
          [-1.35, 2.05],
        ].map(([x, y]) => new THREE.Vector3(x, F + y, 2.9)),
      );
      g.add(new THREE.Mesh(new THREE.TubeGeometry(arc, 40, 0.016, 8), M.metal));
      at(rbox(0.36, 0.05, 0.36, M.travertine, 0.01), -3.45, F + 0.025, 2.9, g);
      at(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8), M.metal), -3.45, F + 0.55, 2.9, g);
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.24, 0.2, 24, 1, true), M.metal);
      at(shade, -1.35, F + 1.95, 2.9, g);
      at(new THREE.Mesh(new THREE.CircleGeometry(0.2, 20).rotateX(Math.PI / 2), M.lamp), -1.35, F + 1.86, 2.9, g);
      glow?.push(g.localToWorld(new THREE.Vector3(-1.35, F + 1.8, 2.9)));
    }
    // Kitchen island and dining table with a linear pendant.
    at(rbox(2.8, 0.92, 0.95, M.travertine, 0.025), 3.6, F + 0.46, 2.6, g);
    at(rbox(2.84, 0.04, 0.99, M.stoneDark, 0.01), 3.6, F + 0.94, 2.6, g);
    for (const x of [2.8, 3.6, 4.4]) {
      at(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 20), M.cushion), x, F + 0.7, 3.25, g);
      at(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.68, 6), M.metal), x, F + 0.34, 3.25, g);
    }
    at(rbox(2.4, 0.05, 1.0, M.timber, 0.012), 3.4, F + 0.75, -1.6, g);
    for (const [x, z] of [
      [2.5, -1.6],
      [4.3, -1.6],
    ])
      at(rbox(0.06, 0.72, 0.8, M.metal, 0.01), x, F + 0.36, z, g);
    for (const x of [2.7, 3.4, 4.1])
      for (const s of [-1, 1]) {
        at(rbox(0.46, 0.06, 0.46, M.timber, 0.012), x, F + 0.46, -1.6 + s * 0.72, g);
        at(rbox(0.46, 0.42, 0.05, M.timber, 0.012), x, F + 0.7, -1.6 + s * 0.94, g);
        for (const dx of [-0.2, 0.2])
          at(
            new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.44, 5), M.metal),
            x + dx,
            F + 0.22,
            -1.6 + s * 0.72,
            g,
          );
      }
    at(rbox(1.8, 0.04, 0.08, M.lamp, 0.01), 3.4, F + 1.55, -1.6, g);
    at(rbox(1.84, 0.05, 0.1, M.metal, 0.01), 3.4, F + 1.585, -1.6, g);
    for (const x of [2.6, 4.2])
      at(
        new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, RY1 - F - 1.6, 4), M.reveal),
        x,
        (RY1 + F + 1.6) / 2,
        -1.6,
        g,
      );
    glow?.push(g.localToWorld(new THREE.Vector3(3.4, F + 1.5, -1.6)));
  },
  // Small sets for other floors near the camera path; they match the traced walls behind them.
  bedroom(g, F, RY1, spec, hw = 2.2) {
    at(rbox(hw * 2 + 0.2, 1.1, 0.1, M.cushion, 0.03), 0, F + 0.55, -4.38, g);
    at(rbox(hw - 0.2, 0.3, 2.2, M.timber, 0.02), 0, F + 0.15, -3.25, g);
    at(rbox(hw - 0.3, 0.25, 2.1, M.cushion, 0.06), 0, F + 0.42, -3.25, g);
    for (const s of [-1, 1]) {
      at(rbox(0.7, 0.14, 0.4, M.cushion, 0.06), s * 0.45, F + 0.62, -4.05, g);
      if (hw > 2 || s > 0) {
        at(rbox(0.5, 0.45, 0.4, M.timber, 0.015), s * (hw + 0.55), F + 0.225, -4.15, g);
        at(
          new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.22, 20), M.lamp),
          s * (hw + 0.55),
          F + 0.8,
          -4.15,
          g,
        );
      }
    }
  },
  guest(g, F, RY1, spec) {
    ROOMS.bedroom(g, F, RY1, spec, 1.5);
  },
  study(g, F) {
    at(rbox(1.8, 0.04, 0.8, M.timber, 0.01), 0, F + 0.75, -2.8, g);
    for (const s of [-1, 1]) at(rbox(0.05, 0.73, 0.7, M.metal, 0.008), s * 0.85, F + 0.365, -2.8, g);
    at(rbox(0.5, 0.45, 0.5, M.cushion, 0.06), 0, F + 0.225, -2.0, g);
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.4, 6), M.metal), 0.6, F + 0.97, -3.0, g);
  },
  family(g, F) {
    at(rbox(3.2, 0.42, 1.0, M.cushion, 0.08), 0, F + 0.23, -0.45, g);
    at(rbox(3.2, 0.46, 0.24, M.cushion, 0.08), 0, F + 0.62, 0.0, g);
    at(rbox(5.2, 0.4, 0.45, M.stoneDark, 0.02), 0, F + 0.2, -4.2, g);
    at(rbox(2.4, 1.35, 0.05, M_TV, 0.01), 0, F + 1.5, -4.38, g);
    at(rbox(3.0, 0.012, 2.4, M.rug, 0.004), 0, F + 0.006, -1.6, g);
  },
  gym(g, F) {
    at(rbox(0.4, 0.45, 1.4, M.cushion, 0.05), 0, F + 0.225, -0.2, g);
    at(rbox(1.6, 0.9, 0.4, M.metal, 0.02), 3.0, F + 0.45, -4.1, g);
    at(rbox(2.0, 0.012, 1.0, M.rug, 0.004), -2.5, F + 0.006, -1.0, g);
  },
};

// Sheer curtains, half drawn, glowing where the room light passes through.
export const SHEER = new THREE.MeshStandardMaterial({
  color: 0xefe6d8,
  emissive: 0xffc890,
  emissiveIntensity: 0.18,
  roughness: 1,
  transparent: true,
  opacity: 0.55,
  side: THREE.DoubleSide,
  depthWrite: false,
});
// Closed and glowing: the same sheer, lit harder from behind.
export const SHEER_GLOW = SHEER.clone();
SHEER_GLOW.emissiveIntensity = 0.5;
SHEER_GLOW.opacity = 0.86;
/* A sheer with someone behind it: where a person stands between the room's
   ceiling light and the fabric, the light coming through drops, so a soft
   shadow walks across the lit curtain. Sharp when they stand close to it,
   spreading as they step back (the penumbra grows with distance). */

await yieldToBrowser(); // a fresh slice for this build step (util.js)
export function sheerWithPeople(base, ff) {
  const m = base.clone();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFig = ff.figU;
    sh.uniforms.uFloorInv = ff.invU;
    sh.uniforms.uLightP = { value: new THREE.Vector3(0, ff.ry1 - 0.25, -1.6) };
    sh.uniforms.uFloorY = { value: ff.ry0 };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSW;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvSW = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vSW;\nuniform vec4 uFig[2]; uniform mat4 uFloorInv; uniform vec3 uLightP; uniform float uFloorY;\n' +
          FIG_GLSL +
          `
        float figShade(vec3 P, vec3 L, vec3 pa, vec3 pb, float r) {
          vec2 d = segSeg(P, L, pa, pb);
          float soft = 0.03 + 0.7 * d.y / max(1.0 - d.y, 0.05);
          return 1.0 - smoothstep(r - soft * 0.5, r + soft, d.x);
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 P = (uFloorInv * vec4(vSW, 1.0)).xyz; float sh = 0.0;
          for (int i = 0; i < 2; i++) {
            vec4 f = uFig[i]; if (f.w <= 0.0) continue;
            vec3 b = vec3(f.x, uFloorY, f.y); float h = f.w;
            sh = max(sh, figShade(P, uLightP, b + vec3(0.0, 0.1 * h, 0.0), b + vec3(0.0, 0.92 * h, 0.0), 0.15));
            sh = max(sh, figShade(P, uLightP, b + vec3(0.0, 1.0 * h, 0.0), b + vec3(0.0, 1.36 * h, 0.0), 0.2));
            sh = max(sh, figShade(P, uLightP, b + vec3(0.0, 1.6 * h, 0.0), b + vec3(0.0, 1.62 * h, 0.0), 0.11));
          }
          totalEmissiveRadiance *= 1.0 - 0.8 * sh;
        }`,
      );
  };
  m.customProgramCacheKey = () => 'sheer-people';
  return m;
}
export function curtain(len, h, mat = SHEER) {
  const geo = new THREE.PlaneGeometry(len, h, Math.ceil(len * 12), 1),
    p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 21) * 0.045);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

export const DARK_ROOM = new THREE.MeshBasicMaterial({ color: 0x0a0806 });
// Terrace leaves catch the soffit downlights and room spill: a faint warm self-light, no real lamp.
export const LEAF_LIT = M.leaf.clone();
LEAF_LIT.emissive = new THREE.Color(0xd09868);
LEAF_LIT.emissiveMap = M.leaf.map;
LEAF_LIT.emissiveIntensity = 0.08;
export const terraceTrees = [],
  trailing = [],
  trailingFloor = []; // filled per floor, built once the tree kit exists
/* Terrace sets, laid out along the side terrace (long axis in z), backs to
   the glass (side = ±1 is the terrace's x side). Every piece gets a contact shadow. */
const legs4 = (g, x, y, z, w, d, h) => {
  for (const dx of [-w, w])
    for (const dz of [-d, d]) at(rbox(0.04, h, 0.04, M.metal, 0.008), x + dx, y + h / 2, z + dz, g);
};
export const TERRACE_SETS = {
  lounge(g, tx, D, tz, side) {
    at(rbox(1.6, 0.01, 2.8, M.rug, 0.004), tx, D + 0.005, tz, g);
    for (const o of [-0.85, 0.85]) {
      at(rbox(0.78, 0.05, 0.78, M.metal, 0.012), tx, D + 0.2, tz + o, g);
      legs4(g, tx, D, tz + o, 0.34, 0.34, 0.2);
      at(rbox(0.74, 0.16, 0.72, M.cushion, 0.05), tx, D + 0.3, tz + o, g);
      at(rbox(0.16, 0.42, 0.72, M.cushion, 0.06), tx - 0.33 * side, D + 0.52, tz + o, g);
      ao({ w: 0.8, d: 0.8, r: 0.05, reach: 0.45, strength: 0.4 }, tx, D + 0.004, tz + o, 0, g);
    }
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.46, 32), M.travertine), tx, D + 0.23, tz, g).castShadow =
      true;
  },
  dining(g, tx, D, tz) {
    // Table for four: travertine top on a bronze frame, oak chairs either side.
    at(rbox(0.85, 0.04, 1.7, M.travertine, 0.01), tx, D + 0.74, tz, g);
    legs4(g, tx, D, tz, 0.36, 0.78, 0.72);
    ao({ w: 0.9, d: 1.75, r: 0.05, reach: 0.5, strength: 0.35 }, tx, D + 0.004, tz, 0, g);
    for (const s of [-1, 1])
      for (const o of [-0.42, 0.42]) {
        const cx = tx + s * 0.68,
          cz = tz + o;
        at(rbox(0.44, 0.05, 0.44, M.timber, 0.012), cx, D + 0.45, cz, g);
        at(rbox(0.05, 0.42, 0.44, M.timber, 0.012), cx + s * 0.2, D + 0.68, cz, g);
        legs4(g, cx, D, cz, 0.19, 0.19, 0.43);
        ao({ w: 0.44, d: 0.44, r: 0.04, reach: 0.3, strength: 0.35 }, cx, D + 0.004, cz, 0, g);
      }
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 16), M.lamp), tx, D + 0.82, tz, g);
  },
  daybed(g, tx, D, tz, side) {
    // Low oak daybed with a bolster against the glass, and a stool.
    at(rbox(1.15, 0.24, 2.1, M.timber, 0.02), tx, D + 0.12, tz, g);
    at(rbox(1.05, 0.16, 2.0, M.cushion, 0.06), tx, D + 0.32, tz, g);
    at(rbox(0.22, 0.24, 1.9, M.cushion, 0.1), tx - side * 0.42, D + 0.52, tz, g);
    for (const o of [-0.5, 0.5]) at(rbox(0.36, 0.12, 0.5, M.cushion, 0.06), tx - side * 0.22, D + 0.46, tz + o, g);
    ao({ w: 1.15, d: 2.1, r: 0.06, reach: 0.5, strength: 0.42 }, tx, D + 0.004, tz, 0, g);
    at(
      new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.4, 28), M.travertine),
      tx,
      D + 0.2,
      tz + 1.4,
      g,
    ).castShadow = true;
    ao({ w: 0.4, d: 0.4, r: 0.2, reach: 0.3, strength: 0.4 }, tx, D + 0.004, tz + 1.4, 0, g);
  },
  fire(g, tx, D, tz) {
    // Fire bowl between two low stone cubes: emissive embers and a warm floor glow, no real light.
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.32, 0.38, 36), M.stoneDark), tx, D + 0.19, tz, g);
    at(new THREE.Mesh(new THREE.CircleGeometry(0.43, 28).rotateX(-Math.PI / 2), M.warmLed), tx, D + 0.37, tz, g);
    decal({ w: 0.7, d: 0.7, r: 0.35, reach: 1.8, strength: 0.38, color: 0xff9a50 }, tx, D + 0.006, tz, 0, g);
    ao({ w: 0.9, d: 0.9, r: 0.45, reach: 0.3, strength: 0.35 }, tx, D + 0.004, tz, 0, g);
    for (const o of [-1.0, 1.0]) {
      at(rbox(0.5, 0.4, 0.5, M.travertine, 0.03), tx, D + 0.2, tz + o, g);
      at(rbox(0.46, 0.08, 0.46, M.cushion, 0.03), tx, D + 0.44, tz + o, g);
      ao({ w: 0.5, d: 0.5, r: 0.04, reach: 0.35, strength: 0.4 }, tx, D + 0.004, tz + o, 0, g);
    }
  },
};
// ── Floor themes: a furnished residence on every level ─────────────────
/* Each floor from Level 02 up has its own story and material palette, so the
   lift ride reads as nine different homes stacked in one tower:
     02 Primary suite      linen, bouclé, walnut
     03 Library            walnut, cognac leather, kilim
     04 Media den          green velvet, terrazzo (dark: lit only by the screen)
     05 Collector's salon  bouclé, Calacatta marble, black lacquer piano
     06 Guest suite        rattan, terracotta, an olive tree
     07 Wellness studio    ash sauna, rubber, steel
     08 Children's room    pale ash, wool (dark: a night light only)
     09 Architect's atelier drafting table, plan chest, a model of this tower
     10 Entertaining       leather sectional, terrazzo bar, marble dining
   Furniture has no real light: every material is cloned once with a faint
   emissive in the room's colour (`litMat`), and each floor is merged to one
   mesh per material (`bake`), so a floor costs ~12 draw calls. */
const sheenFab = (t, color, sheenColor, sr = 0.6) =>
  new THREE.MeshPhysicalMaterial({ color, ...t, sheen: 1, sheenRoughness: sr, sheenColor });
const MI = {
  walnut: new THREE.MeshStandardMaterial({ color: 0xffffff, ...walnutTex, envMapIntensity: 0.7 }),
  ash: new THREE.MeshStandardMaterial({ color: 0xffffff, ...ashTex, envMapIntensity: 0.6 }),
  leather: new THREE.MeshPhysicalMaterial({ color: 0xffffff, ...leatherTex, clearcoat: 0.25, clearcoatRoughness: 0.5 }),
  leatherBlack: new THREE.MeshPhysicalMaterial({
    color: 0x2a2a2a,
    ...leatherTex,
    clearcoat: 0.3,
    clearcoatRoughness: 0.4,
  }),
  marble: new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    ...marbleTex,
    clearcoat: 0.6,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1,
  }),
  terrazzo: new THREE.MeshStandardMaterial({ color: 0xffffff, ...terrazzoTex, envMapIntensity: 0.9 }),
  boucle: sheenFab(boucleTex, 0xffffff, 0xfff4e6, 0.8),
  velvet: sheenFab(velvetTex, 0x2a5a47, 0x8cc7a8, 0.35),
  linen: sheenFab(fabricTex, 0xf0ebe2, 0xfff2e0),
  sage: sheenFab(fabricTex, 0x8f9a86, 0xd8e0cc),
  oatmeal: sheenFab(fabricTex, 0xb8a588, 0xf0e2c8),
  wool: sheenFab(woolTex, 0xcfc6b8, 0xfff2e0, 0.9),
  woolDark: sheenFab(woolTex, 0x4a4540, 0x9a8a78, 0.9),
  kilim: sheenFab(kilimTex, 0xffffff, 0xd8c8b0, 0.9),
  rattan: new THREE.MeshStandardMaterial({ color: 0xffffff, ...rattanTex, side: THREE.DoubleSide }),
  terracotta: new THREE.MeshStandardMaterial({ color: 0xffffff, ...terracottaTex }),
  lacquer: new THREE.MeshPhysicalMaterial({
    color: 0x060606,
    roughness: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.8,
  }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x29292b, ...woolTex, roughness: 0.9 }),
  books: new THREE.MeshStandardMaterial({ map: booksTex, roughness: 0.8 }),
  art: new THREE.MeshStandardMaterial({ map: artTex, roughness: 0.9 }),
  paper: new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.85 }),
  bottle: new THREE.MeshPhysicalMaterial({ color: 0x3a2410, roughness: 0.08, clearcoat: 1, envMapIntensity: 1.6 }),
  ivory: new THREE.MeshStandardMaterial({ color: 0xeee8dc, roughness: 0.4 }),
};

// Faint self-light so furniture reads in a room with no real lamp; cached per (material, level, colour).
const LIT = new Map();
function litMat(m, k, color) {
  if (!m.isMeshStandardMaterial) return m; // lamps, screens and LEDs are already self-lit
  const key = `${m.uuid}|${k.toFixed(3)}|${color}`;
  if (!LIT.has(key)) {
    const c = m.clone();
    c.emissive = new THREE.Color(color);
    c.emissiveMap = m.map ?? null;
    c.emissiveIntensity = k;
    LIT.set(key, c);
  }
  return LIT.get(key);
}
// One mesh per material for a whole floor's furniture.
export function bake(fg, g, k, color) {
  fg.updateMatrixWorld(true);
  const byMat = new Map();
  fg.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const a of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(a)) geo.deleteAttribute(a);
    if (!geo.attributes.uv)
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    geo.clearGroups();
    geo.applyMatrix4(o.matrixWorld);
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(geo);
  });
  for (const [mat, geos] of byMat) {
    const m = new THREE.Mesh(mergeGeometries(geos), litMat(mat, k, color));
    m.receiveShadow = true;
    g.add(m);
    geos.forEach((x) => x.dispose());
  }
}

// Small kit: every helper places in the floor's local frame, `y` measured from the room floor F.
const cyl = (rt, rb, h, mat, s = 24) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), mat);
const grp = (g, x, y, z, ry = 0) => {
  const c = at(new THREE.Group(), x, y, z, g);
  c.rotation.y = ry;
  return c;
};
function rugPlane(g, w, d, mat, x, F, z, ry = 0) {
  const m = at(new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), mat), x, F + 0.008, z, g);
  m.rotation.y = ry;
  return m;
}
function legs(c, w, d, h, mat, r = 0.014) {
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) at(cyl(r, r * 0.8, h, mat, 8), dx * w, h / 2, dz * d, c);
}
// Dining / desk chair facing +z local.
function chair(g, x, F, z, ry, seat, frame = M.metal, w = 0.48) {
  const c = grp(g, x, F, z, ry);
  at(rbox(w, 0.07, w, seat, 0.025), 0, 0.46, 0, c);
  at(rbox(w, 0.4, 0.05, seat, 0.02), 0, 0.7, -w / 2 + 0.03, c);
  legs(c, w / 2 - 0.04, w / 2 - 0.04, 0.43, frame, 0.012);
}
// Upholstered armchair facing +z local.
function armchair(g, x, F, z, ry, mat, w = 0.86, feet = MI.walnut) {
  const c = grp(g, x, F, z, ry);
  at(rbox(w, 0.3, w, mat, 0.07), 0, 0.27, 0, c);
  at(rbox(w, 0.44, 0.2, mat, 0.08), 0, 0.62, -w / 2 + 0.1, c);
  for (const s of [-1, 1]) at(rbox(0.15, 0.28, w, mat, 0.06), s * (w / 2 - 0.075), 0.52, 0, c);
  legs(c, w / 2 - 0.08, w / 2 - 0.08, 0.12, feet, 0.02);
}
// Sofa facing +z local: seat, back, two arms, cushions, low feet.
function sofa(g, x, F, z, ry, mat, len = 2.6, dep = 0.95) {
  const c = grp(g, x, F, z, ry);
  at(rbox(len, 0.26, dep, mat, 0.06), 0, 0.25, 0, c);
  const n = Math.max(2, Math.round((len - 0.4) / 0.9));
  for (let k = 0; k < n; k++)
    at(
      rbox((len - 0.4) / n - 0.02, 0.14, dep - 0.28, mat, 0.06),
      -len / 2 + 0.2 + ((k + 0.5) * (len - 0.4)) / n,
      0.45,
      0.08,
      c,
    );
  at(rbox(len, 0.42, 0.24, mat, 0.08), 0, 0.6, -dep / 2 + 0.12, c);
  for (const s of [-1, 1]) at(rbox(0.2, 0.3, dep, mat, 0.08), s * (len / 2 - 0.1), 0.52, 0, c);
  legs(c, len / 2 - 0.1, dep / 2 - 0.1, 0.12, M.metal, 0.018);
  return c;
}
function tableLamp(g, x, y, z, glow, base = M.metal) {
  at(cyl(0.05, 0.08, 0.34, base, 20), x, y + 0.17, z, g);
  at(cyl(0.13, 0.17, 0.22, M.lamp, 24), x, y + 0.45, z, g);
  glow(x, y + 0.42, z);
}
function floorLamp(g, x, F, z, glow) {
  at(cyl(0.16, 0.16, 0.03, M.metal, 24), x, F + 0.015, z, g);
  at(cyl(0.012, 0.012, 1.45, M.metal, 8), x, F + 0.74, z, g);
  at(cyl(0.16, 0.2, 0.26, M.lamp, 24), x, F + 1.55, z, g);
  glow(x, F + 1.5, z);
}
function plant(g, x, F, z, s, pot, seed) {
  const rnd = mulberry(seed);
  at(cyl(0.24 * s, 0.18 * s, 0.46 * s, pot, 24), x, F + 0.23 * s, z, g);
  at(cyl(0.22 * s, 0.22 * s, 0.02, M.soil, 20), x, F + 0.44 * s, z, g);
  at(cyl(0.015 * s, 0.03 * s, 1.1 * s, M.bark, 6), x, F + 0.95 * s, z, g);
  for (let k = 0; k < 7; k++) {
    const a = rnd() * TAU,
      rr = 0.1 + rnd() * 0.3;
    const m = at(
      new THREE.Mesh(new THREE.IcosahedronGeometry(0.2 * s * (0.7 + rnd() * 0.6), 1), LEAF_LIT),
      x + Math.cos(a) * rr * s,
      F + (1.25 + rnd() * 0.55) * s,
      z + Math.sin(a) * rr * s,
      g,
    );
    m.scale.y = 0.8;
  }
}
// Bed against the back wall (headboard at z −4.38), facing +z.
function bed(g, F, wid, frame, cover, throwMat, head = cover, headW = wid + 0.6) {
  at(rbox(headW, 1.15, 0.12, head, 0.04), 0, F + 0.575, -4.36, g);
  at(rbox(wid, 0.3, 2.2, frame, 0.03), 0, F + 0.15, -3.18, g);
  at(rbox(wid - 0.1, 0.26, 2.1, cover, 0.08), 0, F + 0.43, -3.2, g);
  at(rbox(wid - 0.02, 0.035, 0.8, throwMat, 0.015), 0, F + 0.57, -2.55, g);
  for (const s of [-1, 1]) at(rbox(wid / 2 - 0.15, 0.16, 0.42, cover, 0.07), s * (wid / 4 + 0.02), F + 0.64, -4.0, g);
}

export const THEMES = {
  // Level 02: primary suite, sheers closed. Linen bed on a walnut base, bouclé headboard and chair.
  suite(g, F, RY1, glow) {
    rugPlane(g, 3.4, 2.6, MI.wool, 0, F, -2.6);
    bed(g, F, 2.2, MI.walnut, MI.linen, MI.sage, MI.boucle, 4.8);
    for (const s of [-1, 1]) {
      at(rbox(0.55, 0.46, 0.42, MI.walnut, 0.015), s * 2.75, F + 0.23, -4.12, g);
      tableLamp(g, s * 2.75, F + 0.46, -4.12, glow);
    }
    at(rbox(1.7, 0.4, 0.46, MI.leather, 0.06), 0, F + 0.24, -1.68, g); // bench at the foot
    // Walnut dresser on the side run, a lacquer-framed mirror leaning above it.
    at(rbox(0.5, 0.8, 1.6, MI.walnut, 0.015), -5.0, F + 0.4, 0, g);
    for (const z of [-0.4, 0.4]) at(rbox(0.02, 0.02, 0.3, M.metal, 0.005), -4.74, F + 0.6, z, g);
    at(rbox(0.04, 1.1, 0.8, MI.lacquer, 0.01), -5.15, F + 1.36, 0, g).rotation.z = -0.08;
    armchair(g, 3.9, F, 1.9, -2.4, MI.boucle);
    at(cyl(0.22, 0.22, 0.5, MI.marble, 28), 4.6, F + 0.25, 1.0, g);
    floorLamp(g, 4.7, F, 2.9, glow);
    plant(g, -4.6, F, 3.6, 1.05, MI.terracotta, 11);
  },
  // Level 03: library. Walnut partners' desk under the library wall, leather club chairs on a kilim.
  library(g, F, RY1, glow) {
    rugPlane(g, 3.6, 2.6, MI.kilim, -3.0, F, 1.0);
    at(rbox(2.0, 0.06, 0.9, MI.walnut, 0.015), 0, F + 0.75, -2.6, g);
    at(rbox(1.5, 0.006, 0.55, MI.leatherBlack, 0.002), 0, F + 0.783, -2.6, g);
    for (const s of [-1, 1]) at(rbox(0.46, 0.72, 0.8, MI.walnut, 0.012), s * 0.72, F + 0.36, -2.6, g);
    chair(g, 0, F, -1.9, Math.PI, MI.leather, MI.walnut, 0.56);
    // Banker's lamp and stacked books on the desk.
    at(cyl(0.07, 0.08, 0.03, M.metal, 16), 0.6, F + 0.795, -2.85, g);
    at(cyl(0.008, 0.008, 0.3, M.metal, 6), 0.6, F + 0.93, -2.85, g);
    const shade = at(cyl(0.05, 0.13, 0.08, M.lamp, 20), 0.6, F + 1.1, -2.8, g);
    shade.scale.z = 0.5;
    glow(0.6, F + 1.05, -2.8);
    for (let k = 0; k < 4; k++)
      at(rbox(0.3 - k * 0.02, 0.05, 0.22, MI.books, 0.005), -0.55, F + 0.81 + k * 0.05, -2.75, g).rotation.y = k * 0.2;
    // Rolling ladder leaning on the library wall, on a bronze rail.
    at(rbox(5.8, 0.03, 0.03, M.metal, 0.01), 0, F + 2.55, -4.36, g);
    const lad = grp(g, 2.1, F, -3.85);
    lad.rotation.x = -0.17;
    for (const s of [-1, 1]) at(rbox(0.04, 2.7, 0.05, MI.walnut, 0.01), s * 0.24, 1.35, 0, lad);
    for (let y = 0.3; y < 2.6; y += 0.3) at(cyl(0.014, 0.014, 0.48, M.metal, 6), 0, y, 0, lad).rotation.z = Math.PI / 2;
    armchair(g, -4.1, F, 0.4, 0.9, MI.leather, 0.9);
    armchair(g, -2.0, F, 1.9, -2.3, MI.leather, 0.9);
    at(cyl(0.28, 0.28, 0.5, MI.walnut, 28), -3.4, F + 0.25, 1.6, g);
    tableLamp(g, -3.4, F + 0.5, 1.6, glow);
    // Globe on a bronze stand.
    at(cyl(0.14, 0.18, 0.7, M.metal, 16), 4.6, F + 0.35, -3.6, g);
    at(new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 16), MI.oatmeal), 4.6, F + 1.0, -3.6, g);
    at(new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.01, 6, 40), M.metal), 4.6, F + 1.0, -3.6, g);
    plant(g, 4.9, F, 3.3, 1.0, MI.terracotta, 13);
  },
  // Level 04: media den, lights off. Velvet sectional and terrazzo, lit only by the screen (cool tint).
  den(g, F) {
    rugPlane(g, 3.8, 3.0, MI.woolDark, 0, F, -1.4);
    sofa(g, -0.3, F, -0.35, Math.PI, MI.velvet, 3.4, 1.0);
    sofa(g, 1.95, F, -1.55, -Math.PI / 2, MI.velvet, 1.6, 1.0); // chaise return
    at(cyl(0.55, 0.55, 0.34, MI.terrazzo, 40), -0.2, F + 0.17, -2.0, g);
    at(rbox(5.2, 0.4, 0.45, MI.terrazzo, 0.02), 0, F + 0.2, -4.2, g);
    at(rbox(2.4, 1.35, 0.05, M_TV, 0.01), 0, F + 1.5, -4.38, g);
    at(cyl(0.3, 0.3, 0.4, MI.velvet, 28), -2.6, F + 0.2, -1.7, g); // pouf
    // Bar cart in bronze with bottles.
    const cart = grp(g, -4.6, F, 1.6, 0.4);
    for (const y of [0.25, 0.75]) at(rbox(0.9, 0.02, 0.45, M.metal, 0.005), 0, y, 0, cart);
    legs(cart, 0.42, 0.2, 0.8, M.metal, 0.01);
    for (let k = 0; k < 4; k++)
      at(cyl(0.035, 0.04, 0.28, MI.bottle, 12), -0.3 + k * 0.18, 0.9, (k % 2) * 0.1 - 0.05, cart);
  },
  // Level 05: collector's salon. A curved bouclé sofa facing the fire, marble table, lacquer grand piano.
  salon(g, F, RY1, glow) {
    rugPlane(g, 4.2, 3.2, MI.wool, 0, F, -1.3);
    for (let k = -2; k <= 2; k++) {
      const a = k * 0.36,
        R = 2.5,
        c = grp(g, Math.sin(a) * R, F, -2.0 + Math.cos(a) * R, a + Math.PI);
      at(rbox(0.9, 0.4, 0.9, MI.boucle, 0.12), 0, 0.2, 0, c);
      at(rbox(0.92, 0.36, 0.26, MI.boucle, 0.12), 0, 0.55, -0.34, c);
    }
    at(cyl(0.7, 0.7, 0.06, MI.marble, 48), 0, F + 0.33, -1.6, g);
    at(cyl(0.45, 0.5, 0.3, MI.marble, 48), 0, F + 0.15, -1.6, g);
    for (let k = 0; k < 3; k++) at(rbox(0.32, 0.04, 0.24, MI.books, 0.004), 0.25, F + 0.38 + k * 0.04, -1.5, g);
    // Grand piano: a lacquer case on three legs, lid propped open toward the room.
    const pShape = new THREE.Shape();
    pShape.moveTo(0, 0);
    pShape.lineTo(1.5, 0);
    pShape.lineTo(1.5, 0.9);
    pShape.quadraticCurveTo(1.5, 1.45, 1.0, 1.65);
    pShape.quadraticCurveTo(0.6, 1.8, 0.55, 2.05);
    pShape.lineTo(0, 2.05);
    pShape.closePath();
    const piano = grp(g, 3.2, F, 2.6, 2.6);
    at(extrude(pShape, 0.3, MI.lacquer, { bevel: 0.01 }), 0, 0.62, 0, piano);
    for (const [px, pz] of [
      [0.15, -0.15],
      [1.35, -0.15],
      [0.35, -1.85],
    ])
      at(cyl(0.05, 0.035, 0.62, MI.lacquer, 12), px, 0.31, pz, piano);
    at(rbox(1.5, 0.08, 0.28, MI.lacquer, 0.01), 0.75, 0.74, 0.12, piano);
    at(rbox(1.36, 0.02, 0.15, MI.ivory, 0.003), 0.75, 0.79, 0.14, piano); // keys
    for (let k = 0; k < 18; k++)
      if (k % 7 !== 2 && k % 7 !== 6)
        at(rbox(0.035, 0.02, 0.09, MI.lacquer, 0.003), 0.11 + k * 0.075, 0.8, 0.11, piano);
    const lid = grp(piano, 0, 0.93, 0);
    lid.rotation.z = 0.55;
    at(extrude(pShape, 0.02, MI.lacquer, { bevel: 0 }), 0, 0, 0, lid);
    at(cyl(0.008, 0.008, 0.8, MI.lacquer, 6), 1.3, 1.25, -1.0, piano).rotation.z = -0.2;
    at(rbox(0.8, 0.48, 0.36, MI.leatherBlack, 0.04), 0.75, 0.24, 0.65, piano); // bench
    // A bronze knot on a plaster plinth, and a reading lamp.
    at(rbox(0.45, 1.0, 0.45, MI.paper, 0.01), -4.4, F + 0.5, 2.6, g);
    at(new THREE.Mesh(new THREE.TorusKnotGeometry(0.17, 0.05, 96, 10, 2, 3), M.metal), -4.4, F + 1.25, 2.6, g);
    floorLamp(g, -2.9, F, 0.6, glow);
    plant(g, -5.2, F, -2.9, 1.15, MI.terrazzo, 17);
  },
  // Level 06: guest suite, sheers closed. Rattan and linen, terracotta, an olive in a pot.
  guest(g, F, RY1, glow) {
    rugPlane(g, 2.8, 2.2, MI.oatmeal, 0, F, -2.4);
    bed(g, F, 1.6, MI.rattan, MI.linen, MI.oatmeal, MI.rattan, 3.4);
    at(cyl(0.25, 0.22, 0.46, MI.terracotta, 24), 2.05, F + 0.23, -4.1, g);
    tableLamp(g, 2.05, F + 0.46, -4.1, glow, MI.terracotta);
    at(cyl(0.25, 0.22, 0.46, MI.terracotta, 24), -2.05, F + 0.23, -4.1, g);
    // Rattan lounge chair: a woven bowl on bronze legs.
    const c = grp(g, 3.6, F, 1.4, -2.5);
    const bowl = at(
      new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 12, 0, TAU, 0, Math.PI / 2), MI.rattan),
      0,
      0.85,
      0,
      c,
    );
    bowl.rotation.x = Math.PI + 0.35;
    at(cyl(0.38, 0.38, 0.1, MI.linen, 28), 0, 0.5, 0.05, c);
    legs(c, 0.25, 0.25, 0.46, M.metal, 0.012);
    at(rbox(1.1, 0.42, 0.5, MI.rattan, 0.03), 0, F + 0.21, -1.6, g); // luggage bench
    at(rbox(0.7, 0.4, 0.45, MI.leather, 0.04), 0.1, F + 0.62, -1.6, g); // suitcase
    plant(g, -4.4, F, 2.6, 1.3, MI.terracotta, 19);
    plant(g, 5.0, F, -3.3, 0.9, MI.terracotta, 23);
  },
  // Level 07: wellness studio. Treadmills to the view, free weights at the mirror, a glowing ash sauna.
  gym(g, F, RY1, glow) {
    for (const x of [-4.6, -3.3]) {
      const t = grp(g, x, F, 2.0);
      at(rbox(0.8, 0.18, 1.9, MI.rubber, 0.04), 0, 0.09, 0, t);
      for (const s of [-1, 1]) at(rbox(0.05, 1.1, 0.06, M.steel, 0.01), s * 0.36, 0.7, 0.8, t);
      at(rbox(0.75, 0.3, 0.08, M.steel, 0.02), 0, 1.3, 0.85, t).rotation.x = -0.4;
      at(rbox(0.4, 0.2, 0.01, M_TV, 0.004), 0, 1.33, 0.81, t).rotation.x = -0.4;
    }
    at(rbox(1.8, 0.85, 0.45, M.steel, 0.02), 3.0, F + 0.425, -4.1, g);
    for (let k = 0; k < 6; k++)
      for (const row of [0, 1]) {
        const x = 2.3 + k * 0.28,
          y = F + 0.5 + row * 0.38,
          r = 0.045 + k * 0.007;
        at(cyl(0.014, 0.014, 0.32, M.steel, 6), x, y, -4.0, g).rotation.x = Math.PI / 2;
        for (const s of [-1, 1])
          at(cyl(r, r, 0.06, MI.leatherBlack, 16), x, y, -4.0 + s * 0.12, g).rotation.x = Math.PI / 2;
      }
    // Padded bench.
    at(rbox(0.36, 0.1, 1.3, MI.leatherBlack, 0.04), 0, F + 0.46, -0.6, g);
    at(rbox(0.06, 0.4, 0.06, M.steel, 0.01), 0, F + 0.2, -0.1, g);
    at(rbox(0.06, 0.4, 0.06, M.steel, 0.01), 0, F + 0.2, -1.1, g);
    // Yoga mats, a foam roller and kettlebells.
    for (const x of [0.6, 1.4]) at(rbox(0.62, 0.006, 1.85, MI.sage, 0.003), x, F + 0.004, 1.4, g);
    at(cyl(0.075, 0.075, 0.6, MI.oatmeal, 16), 1.0, F + 0.075, 2.7, g).rotation.z = Math.PI / 2;
    for (let k = 0; k < 3; k++) {
      const r = 0.1 + k * 0.02,
        x = -1.0 + k * 0.4;
      at(new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), MI.leatherBlack), x, F + r, -3.9, g);
      at(new THREE.Mesh(new THREE.TorusGeometry(r * 0.6, 0.016, 6, 20, Math.PI), M.steel), x, F + r * 1.75, -3.9, g);
    }
    // Ash sauna in the back corner: a warm glow behind its glass door, the room's brightest point.
    at(rbox(1.8, 2.4, 1.6, MI.ash, 0.02), -3.8, F + 1.2, -3.0, g);
    at(rbox(0.7, 1.9, 0.02, M.warmLed, 0.005), -3.6, F + 1.05, -2.19, g);
    at(rbox(0.76, 1.96, 0.012, M.metal, 0.004), -3.6, F + 1.05, -2.195, g);
    at(rbox(0.5, 0.04, 0.02, M.metal, 0.005), -4.35, F + 2.2, -2.19, g);
    glow(-3.6, F + 1.4, -2.0);
  },
  // Level 08: children's room, lights out. Two ash beds, a tent, toy shelves and one night light.
  kids(g, F, RY1, glow) {
    rugPlane(g, 2.6, 2.6, MI.wool, 0.5, F, -1.0);
    at(rbox(4.8, 1.15, 0.12, MI.ash, 0.03), 0, F + 0.575, -4.36, g);
    for (const s of [-1, 1]) {
      const c = grp(g, s * 1.35, F, 0);
      at(rbox(1.0, 0.28, 2.05, MI.ash, 0.03), 0, 0.14, -3.25, c);
      at(rbox(0.92, 0.2, 1.95, MI.linen, 0.07), 0, 0.38, -3.25, c);
      at(rbox(0.96, 0.03, 1.0, s < 0 ? MI.sage : MI.oatmeal, 0.012), 0, 0.5, -2.75, c);
      at(rbox(0.6, 0.14, 0.38, MI.linen, 0.06), 0, 0.55, -4.0, c);
    }
    at(rbox(0.45, 0.45, 0.4, MI.ash, 0.015), 0, F + 0.225, -4.1, g);
    at(new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 10), M.lamp), 0, F + 0.53, -4.1, g);
    glow(0, F + 0.53, -4.1);
    // Play tent: four poles and a linen cone.
    at(cyl(0.02, 0.75, 1.6, MI.linen, 6), -4.2, F + 0.8, 1.4, g);
    for (let k = 0; k < 4; k++)
      at(
        cyl(0.012, 0.012, 1.95, MI.ash, 5),
        -4.2 + Math.cos(k * 1.57 + 0.4) * 0.35,
        F + 0.95,
        1.4 + Math.sin(k * 1.57 + 0.4) * 0.35,
        g,
      ).rotation.set(Math.sin(k * 1.57 + 0.4) * -0.4, 0, Math.cos(k * 1.57 + 0.4) * 0.4);
    // Cubby shelf with fabric bins and a few books.
    const sh = grp(g, 3.6, F, 2.6, -Math.PI / 2);
    at(rbox(2.0, 0.9, 0.4, MI.ash, 0.015), 0, 0.45, 0, sh);
    for (let k = 0; k < 4; k++)
      at(rbox(0.4, 0.3, 0.32, [MI.sage, MI.oatmeal, MI.woolDark, MI.wool][k], 0.04), -0.72 + k * 0.48, 0.25, 0.05, sh);
    at(rbox(1.2, 0.26, 0.2, MI.books, 0.005), -0.3, 1.03, 0, sh);
    at(new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 12), MI.oatmeal), 0.6, F + 0.16, 0.6, g); // a ball on the rug
  },
  // Level 09: architect's atelier. Drafting table, plan chest, and a white model of this very tower.
  atelier(g, F, RY1, glow) {
    rugPlane(g, 3.0, 2.0, MI.kilim, 3.4, F, 1.2, Math.PI / 2);
    const dt = grp(g, 0, F, -2.7);
    for (const s of [-1, 1]) {
      at(rbox(0.05, 0.85, 0.7, M.steel, 0.01), s * 0.8, 0.425, 0, dt);
    }
    const board = grp(dt, 0, 0.92, 0);
    board.rotation.x = 0.32;
    at(rbox(1.8, 0.03, 1.0, MI.ash, 0.008), 0, 0, 0, board);
    at(rbox(0.84, 0.004, 0.6, MI.paper, 0.001), -0.2, 0.017, 0, board);
    at(rbox(1.6, 0.02, 0.03, M.steel, 0.005), 0, 0.03, 0.15, board); // parallel rule
    // Architect's lamp clamped to the board.
    at(cyl(0.01, 0.01, 0.7, M.steel, 6), 0.75, 1.2, -0.3, dt).rotation.z = 0.3;
    at(cyl(0.01, 0.01, 0.55, M.steel, 6), 0.5, 1.6, -0.15, dt).rotation.z = -0.9;
    at(cyl(0.04, 0.1, 0.12, M.lamp, 16), 0.28, 1.5, -0.05, dt).rotation.z = 0.5;
    glow(0.6, F + 1.1, -2.8);
    chair(g, 0, F, -1.75, Math.PI, MI.leatherBlack, M.steel, 0.42);
    // Plan chest: shallow walnut drawers with bronze pulls, rolled drawings in a bin.
    at(rbox(1.5, 0.9, 1.0, MI.walnut, 0.012), -3.8, F + 0.45, -3.5, g);
    for (let k = 0; k < 5; k++) at(rbox(0.3, 0.02, 0.02, M.metal, 0.005), -3.8, F + 0.13 + k * 0.17, -2.99, g);
    at(cyl(0.2, 0.2, 0.5, MI.ash, 20), -2.4, F + 0.25, -3.9, g);
    for (let k = 0; k < 6; k++)
      at(
        cyl(0.035, 0.035, 0.8, MI.paper, 8),
        -2.4 + Math.cos(k) * 0.1,
        F + 0.55,
        -3.9 + Math.sin(k) * 0.1,
        g,
      ).rotation.set(Math.sin(k) * 0.15, 0, Math.cos(k) * 0.15);
    // Model table: Residence 07 at 1:100, its ten slabs twisting up a core.
    at(rbox(1.6, 0.06, 1.0, MI.walnut, 0.012), -3.4, F + 0.75, 1.4, g);
    legs(grp(g, -3.4, F, 1.4), 0.72, 0.42, 0.72, M.steel, 0.015);
    at(rbox(0.42, 0.03, 0.36, MI.paper, 0.004), -3.4, F + 0.795, 1.4, g);
    at(rbox(0.055, 0.46, 0.044, MI.paper, 0.004), -3.4, F + 1.04, 1.33, g);
    for (let k = 0; k < 11; k++)
      at(
        rbox(0.18 + Math.sin(0.9 * k) * 0.016, 0.006, 0.14 + Math.cos(0.7 * k) * 0.013, MI.paper, 0.003),
        -3.4,
        F + 0.89 + k * 0.036,
        1.4,
        g,
      ).rotation.y = -0.34 + 0.075 * k;
    // Industrial pendant over the model.
    at(cyl(0.004, 0.004, RY1 - F - 1.7, M.steel, 4), -3.4, (RY1 + F + 1.7) / 2, 1.4, g);
    at(new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 8, 0, TAU, 0, Math.PI / 2), M.steel), -3.4, F + 1.55, 1.4, g);
    at(new THREE.Mesh(new THREE.CircleGeometry(0.2, 20).rotateX(Math.PI / 2), M.lamp), -3.4, F + 1.552, 1.4, g);
    glow(-3.4, F + 1.5, 1.4);
    // Easel with a painting in progress, facing the room.
    const e = grp(g, 3.6, F, 1.4, -2.3);
    for (const s of [-1, 1]) at(rbox(0.04, 1.9, 0.04, MI.ash, 0.008), s * 0.32, 0.95, 0, e).rotation.z = -s * 0.08;
    at(rbox(0.04, 1.8, 0.04, MI.ash, 0.008), 0, 0.85, -0.35, e).rotation.x = -0.25;
    at(rbox(0.7, 0.03, 0.06, MI.ash, 0.008), 0, 0.8, 0.03, e);
    at(new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.8), MI.art), 0, 1.22, 0.05, e);
    at(rbox(0.66, 0.82, 0.025, MI.ash, 0.004), 0, 1.22, 0.035, e);
    plant(g, 4.8, F, -3.2, 1.1, MI.terrazzo, 29);
  },
  // Level 10: entertaining floor. Leather sectional to the screen, terrazzo bar, marble dining for six.
  host(g, F, RY1, glow) {
    rugPlane(g, 3.6, 2.8, MI.woolDark, -0.6, F, -1.4);
    sofa(g, -0.6, F, -0.3, Math.PI, MI.leather, 3.0, 1.0);
    at(rbox(1.2, 0.32, 0.7, MI.terrazzo, 0.03), -0.6, F + 0.16, -1.8, g);
    at(rbox(5.2, 0.4, 0.45, MI.walnut, 0.015), 0, F + 0.2, -4.2, g);
    at(rbox(2.4, 1.35, 0.05, M_TV, 0.01), 0, F + 1.5, -4.38, g);
    // Bar along the +x glass: terrazzo front, walnut top, bronze foot rail, three stools.
    at(rbox(0.65, 1.02, 3.0, MI.terrazzo, 0.02), 4.9, F + 0.51, -1.6, g);
    at(rbox(0.75, 0.04, 3.1, MI.walnut, 0.01), 4.9, F + 1.04, -1.6, g);
    at(cyl(0.015, 0.015, 3.0, M.metal, 8), 4.48, F + 0.22, -1.6, g).rotation.x = Math.PI / 2;
    at(rbox(0.6, 0.02, 3.0, M.warmLed, 0.005), 5.2, F + 0.015, -1.6, g); // toe-kick glow
    for (const z of [-2.6, -1.6, -0.6]) {
      at(cyl(0.19, 0.19, 0.06, MI.leather, 20), 4.15, F + 0.76, z, g);
      at(cyl(0.02, 0.02, 0.74, M.metal, 8), 4.15, F + 0.37, z, g);
      at(cyl(0.18, 0.18, 0.02, M.metal, 20), 4.15, F + 0.01, z, g);
    }
    for (let k = 0; k < 5; k++) at(cyl(0.035, 0.04, 0.3, MI.bottle, 12), 5.0, F + 1.21, -2.6 + k * 0.22, g);
    // Dining for six under a linear bronze pendant.
    at(rbox(2.6, 0.05, 1.05, MI.marble, 0.012), -3.5, F + 0.75, 2.4, g);
    for (const s of [-1, 1]) at(rbox(0.08, 0.72, 0.8, MI.walnut, 0.01), -3.5 + s * 1.0, F + 0.36, 2.4, g);
    for (const x of [-4.3, -3.5, -2.7])
      for (const s of [-1, 1]) chair(g, x, F, 2.4 + s * 0.78, s < 0 ? 0 : Math.PI, MI.walnut, MI.walnut);
    at(rbox(1.9, 0.04, 0.08, M.lamp, 0.01), -3.5, F + 1.55, 2.4, g);
    at(rbox(1.94, 0.05, 0.1, M.metal, 0.01), -3.5, F + 1.585, 2.4, g);
    for (const x of [-4.3, -2.7]) at(cyl(0.004, 0.004, RY1 - F - 1.6, M.reveal, 4), x, (RY1 + F + 1.6) / 2, 2.4, g);
    glow(-3.5, F + 1.5, 2.4);
    glow(5.0, F + 0.3, -1.6);
    floorLamp(g, -2.6, F, -0.2, glow);
    plant(g, 2.2, F, 3.8, 1.2, MI.terracotta, 31);
  },
};
