import * as THREE from 'three';
import { debug, MAX_ANISO, mulberry, yieldToBrowser } from '../core/util.js';
import { loadProgress } from '../ui/veil.js';
import * as kit from './canvas-kit.js';
import { SURFACES } from './surfaces.js';

/* ════════════════════════════════════════════════════════════════════════
   Procedural textures — every surface is painted to a canvas at load.
   UVs are in metres, so `tile` is how many metres one texture covers.
   ════════════════════════════════════════════════════════════════════════ */

export { blotches, speckle, streaks } from './canvas-kit.js';

/** A painted TexSpec, or a worker's packed copy of one, as a three.js texture. */
function toTexture(spec) {
  const t = spec.packed
    ? new THREE.Texture(new ImageData(new Uint8ClampedArray(spec.buffer), spec.width, spec.height))
    : new THREE.CanvasTexture(spec.image);
  t.needsUpdate = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(spec.repeat.x, spec.repeat.y);
  if (spec.srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (spec.aniso) t.anisotropy = MAX_ANISO;
  return t;
}
/** Every TexSpec in a recipe's result, swapped for its texture. */
function unpack(v) {
  if (v instanceof kit.TexSpec || v?.packed) return toTexture(v);
  if (v && typeof v === 'object' && !v.isTexture)
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, unpack(x)]));
  return v;
}

/** A texture's pixels as a canvas to draw from: baked textures hold ImageData, painted ones a canvas. */
export function textureCanvas(tex) {
  const img = tex.image;
  if (!(img instanceof ImageData)) return img;
  const c = kit.makeCanvas(img.width, img.height);
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

// The page-side painters return three.js textures straight away.
export const canvasTex = (...args) => toTexture(kit.canvasTex(...args));
export const pbr = (tex, options) => unpack(kit.pbr(tex, options));

/* The big surfaces (surfaces.js) take ~0.9 s of painting. They are
   baked in parallel module workers on OffscreenCanvas, so the page stays
   free and the work finishes sooner; results stream back as ImageData with
   their buffers transferred, not copied. Without worker or OffscreenCanvas
   support (or if a worker fails), the same recipes paint here instead, one
   per time slice. Either way the pixels are the same: every recipe is seeded. */
const SURFACE_NAMES = Object.keys(SURFACES);

function bakeInWorkers(onDone) {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined')
    return Promise.reject(new Error('no OffscreenCanvas'));
  const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
  const workers = Array.from(
    { length: n },
    () => new Worker(new URL('./bake.worker.js', import.meta.url), { type: 'module' }),
  );
  return new Promise((resolve, reject) => {
    const out = {};
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      workers.forEach((w) => w.terminate());
      if (err) reject(err);
      else resolve(out);
    };
    workers.forEach((w, i) => {
      w.onmessage = ({ data }) => {
        out[data.name] = unpack(data.result);
        onDone();
        if (Object.keys(out).length === SURFACE_NAMES.length) finish();
      };
      w.onerror = (e) => {
        e.preventDefault();
        finish(new Error(e.message || 'bake worker failed'));
      };
      w.postMessage(SURFACE_NAMES.filter((_, k) => k % n === i));
    });
  });
}

async function bakeSurfaces() {
  const t0 = performance.now();
  let done = 0;
  const tick = () => loadProgress(0.3 * (++done / SURFACE_NAMES.length), 'Painting surfaces');
  try {
    const out = await bakeInWorkers(tick);
    debug(`[perf] surfaces baked in workers in ${(performance.now() - t0).toFixed(0)} ms`);
    return out;
  } catch (err) {
    debug(`[perf] baking on the main thread (${err.message})`);
  }
  done = 0;
  const out = {};
  for (const name of SURFACE_NAMES) {
    out[name] = unpack(SURFACES[name]());
    tick();
    await yieldToBrowser();
  }
  return out;
}

export const {
  boardForm,
  timber,
  grass,
  leafMassTex,
  gfrc,
  paverTex,
  travTex,
  deckTex,
  bronzeTex,
  graniteTex,
  troughTex,
  fabricTex,
  gravelTex,
  tactileTex,
  grateTex,
  matTex,
  barkTex,
  waterNormal,
  walnutTex,
  ashTex,
  leatherTex,
  marbleTex,
  terrazzoTex,
  boucleTex,
  velvetTex,
  rattanTex,
  terracottaTex,
  kilimTex,
  woolTex,
  booksTex,
  artTex,
} = await bakeSurfaces();

// Clipped hedge: a unit box with softened top edges and a slightly uneven face.
export function hedgeGeometry() {
  const geo = new THREE.BoxGeometry(1, 1, 1, 8, 3, 3),
    p = geo.attributes.position,
    v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 23 + v.y * 7) * Math.sin(v.z * 19 - v.y * 11) * 0.025;
    const k = v.y > 0.4 && Math.abs(v.z) > 0.45 ? 0.88 : 1;
    p.setXYZ(i, v.x + n, v.y + n, v.z * k + n);
  }
  geo.computeVertexNormals();
  return geo;
}

// The reflecting pool is near-still: same waves, stretched much wider.
export const stillNormal = waterNormal.clone();
stillNormal.repeat.set(1 / 18, 1 / 18);

// Pool shell seen through the water: fine pale mosaic with a darker lane line.
export const poolTileTex = (() => {
  const rnd = mulberry(23);
  return canvasTex(
    256,
    256,
    (g, w, h) => {
      const t = 8;
      for (let y = 0; y < h; y += t)
        for (let x = 0; x < w; x += t) {
          const v = 0.9 + rnd() * 0.1;
          g.fillStyle = `rgb(${(236 * v) | 0},${(246 * v) | 0},${(246 * v) | 0})`;
          g.fillRect(x, y, t - 1, t - 1);
        }
      g.fillStyle = 'rgba(30,70,90,.55)';
      g.fillRect(w / 2 - 4, 0, 8, h);
    },
    { tile: 2 },
  );
})();
export function glowTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d'),
    grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.2, 'rgba(255,255,255,.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
