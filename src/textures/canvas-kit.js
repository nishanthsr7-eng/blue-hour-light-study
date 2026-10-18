/* The texture painter's kit. It touches neither the DOM nor three.js, so the
   same code paints on the page and in bake.worker.js. A painted texture is a
   TexSpec: the canvas plus how it tiles. procedural.js turns specs into
   three.js textures. */

/** A canvas: a DOM one on the page, an OffscreenCanvas in a worker. */
export function makeCanvas(w, h) {
  if (typeof document === 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** A painted image and how to sample it: `tile` metres per repeat, sRGB for colour maps, full anisotropic filtering unless `aniso` is false. */
export class TexSpec {
  constructor(image, { tile = 1, srgb = false, aniso = true } = {}) {
    this.image = image;
    this.pixels = null; // the canvas's ImageData, once something has read it
    this.srgb = srgb;
    this.aniso = aniso;
    this.repeat = {
      x: 1 / tile,
      y: 1 / tile,
      set(x, y) {
        this.x = x;
        this.y = y;
        return this;
      },
    };
  }
}

/** Paints a w × h texture with `draw(ctx, w, h)`. UVs are in metres: `tile` is how many one texture covers. */
export function canvasTex(w, h, draw, { tile = 4, color = true } = {}) {
  const c = makeCanvas(w, h);
  draw(c.getContext('2d'), w, h);
  return new TexSpec(c, { tile, srgb: color });
}
/**
 * Derive a tangent-space normal map and a roughness map from a painted
 * texture's luminance (wrapped Sobel, so they tile with it). Real renders
 * get their realism from these two channels: light catching joints, pores
 * and grain, and reflections that break up across a surface.
 * `rough` maps dark→light luminance onto [a, b]; set material roughness 1.
 */
export function pbr(tex, { normal = 2, rough = [0.6, 0.8], invert = false } = {}) {
  const src = tex.image,
    w = src.width,
    h = src.height;
  const pixels = src.getContext('2d').getImageData(0, 0, w, h),
    d = pixels.data;
  // Keep what was just read, so the bake worker can send it without reading
  // the canvas a second time.
  if (tex instanceof TexSpec) tex.pixels = pixels;
  const H = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const l = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) / 255;
    H[i] = invert ? 1 - l : l;
  }
  const nc = makeCanvas(w, h),
    rc = makeCanvas(w, h);
  const nI = nc.getContext('2d').createImageData(w, h),
    rI = rc.getContext('2d').createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const yu = ((y - 1 + h) % h) * w,
      yd = ((y + 1) % h) * w,
      yr = y * w;
    for (let x = 0; x < w; x++) {
      const xl = (x - 1 + w) % w,
        xr = (x + 1) % w;
      const dx = (H[yu + xr] + 2 * H[yr + xr] + H[yd + xr] - H[yu + xl] - 2 * H[yr + xl] - H[yd + xl]) * normal;
      const dy = (H[yu + xl] + 2 * H[yu + x] + H[yu + xr] - H[yd + xl] - 2 * H[yd + x] - H[yd + xr]) * normal;
      const l = Math.hypot(dx, dy, 1),
        i = (yr + x) * 4;
      nI.data[i] = ((-dx / l) * 0.5 + 0.5) * 255;
      nI.data[i + 1] = ((-dy / l) * 0.5 + 0.5) * 255;
      nI.data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      nI.data[i + 3] = 255;
      const r = (rough[0] + (rough[1] - rough[0]) * H[yr + x]) * 255;
      rI.data[i] = rI.data[i + 1] = rI.data[i + 2] = r;
      rI.data[i + 3] = 255;
    }
  }
  nc.getContext('2d').putImageData(nI, 0, 0);
  rc.getContext('2d').putImageData(rI, 0, 0);
  const wrap = (c, img) => {
    const t = new TexSpec(c);
    t.repeat.set(tex.repeat.x, tex.repeat.y);
    t.pixels = img; // opaque, so exactly what the canvas now holds
    return t;
  };
  return { map: tex, normalMap: wrap(nc, nI), roughnessMap: wrap(rc, rI), roughness: 1 };
}
/** Long vertical rain streaks: the weathering every real facade carries. */
export function streaks(g, w, h, n, color, rnd) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * w,
      y = rnd() * h,
      len = 40 + rnd() * h * 0.5,
      sw = 1 + rnd() * 5;
    const grd = g.createLinearGradient(0, y, 0, y + len);
    grd.addColorStop(0, color.replace('A', (0.03 + rnd() * 0.07).toFixed(3)));
    grd.addColorStop(1, color.replace('A', '0'));
    g.fillStyle = grd;
    g.fillRect(x, y, sw, len);
  }
}
export function blotches(g, w, h, n, r0, r1, colors, rnd) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * w,
      y = rnd() * h,
      r = r0 + rnd() * (r1 - r0);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, colors[(rnd() * colors.length) | 0]);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
export function speckle(g, w, h, n, colors, rnd, size = 1.6) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[(rnd() * colors.length) | 0];
    g.fillRect(rnd() * w, rnd() * h, size * (0.5 + rnd()), size * (0.5 + rnd()));
  }
}
