/* Bake worker: paints the surfaces it is given (surfaces.js) on
   OffscreenCanvas and posts each one back as soon as it is done. Canvases
   travel as raw RGBA buffers, transferred rather than copied. */
import { TexSpec } from './canvas-kit.js';
import { SURFACES } from './surfaces.js';

function pack(v, transfer) {
  if (v instanceof TexSpec) {
    const { width, height } = v.image;
    const { buffer } = (v.pixels ?? v.image.getContext('2d').getImageData(0, 0, width, height)).data;
    if (!transfer.includes(buffer)) transfer.push(buffer);
    return {
      packed: true,
      buffer,
      width,
      height,
      repeat: { x: v.repeat.x, y: v.repeat.y },
      srgb: v.srgb,
      aniso: v.aniso,
    };
  }
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, pack(x, transfer)]));
  return v;
}

self.onmessage = ({ data: names }) => {
  for (const name of names) {
    const transfer = [];
    const result = pack(SURFACES[name](), transfer);
    self.postMessage({ name, result }, transfer);
  }
};
