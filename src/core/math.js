/* DOM-free basics, shared by the page and the texture bake worker. */

export const TAU = Math.PI * 2;

/** Mulberry32: a tiny seeded PRNG, so every painted texture and layout is the same on every load. */
export function mulberry(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
