import { TAU, mulberry } from '../core/math.js';
import { blotches, canvasTex, pbr, speckle } from './canvas-kit.js';

/* Furniture finishes: woods, leather, stone, fabrics, rugs, books and a
   painting. Seeded recipes baked with the other surfaces (surfaces.js), off
   the main thread; tower/furniture.js builds the materials from them. */

function woodTex(seed, rgb, tile = 1.2) {
  const rnd = mulberry(seed);
  return pbr(
    canvasTex(
      512,
      512,
      (g, w, h) => {
        for (let y = 0; y < h; y += 32) {
          const tone = 0.8 + rnd() * 0.3;
          g.fillStyle = `rgb(${rgb.map((v) => (v * tone) | 0)})`;
          g.fillRect(0, y, w, 32);
          for (let i = 0; i < 18; i++) {
            g.strokeStyle = `rgba(${rnd() < 0.3 ? '255,220,170' : '25,12,5'},${0.05 + rnd() * 0.14})`;
            g.lineWidth = 0.5 + rnd() * 1.3;
            g.beginPath();
            const yy = y + rnd() * 32,
              amp = rnd() * 4,
              f = ((1 + ((rnd() * 5) | 0)) * TAU) / w,
              p0 = rnd() * 9;
            for (let x = 0; x <= w; x += 8) g.lineTo(x, yy + Math.sin(x * f + p0) * amp);
            g.stroke();
          }
          g.fillStyle = 'rgba(0,0,0,.3)';
          g.fillRect(0, y, w, 1);
        }
      },
      { tile },
    ),
    { normal: 1.2, rough: [0.55, 0.35] },
  );
}
// Each painter is (g, w, h, rnd); `tex` wraps the canvas + pbr boilerplate.
const tex = (seed, size, tile, draw, o) =>
  pbr(
    canvasTex(size, size, (g, w, h) => draw(g, w, h, mulberry(seed)), { tile }),
    o,
  );

export const FURNISHINGS = {
  // Walnut and pale ash, shared by most rooms.
  walnutTex: () => woodTex(141, [96, 60, 38]),
  ashTex: () => woodTex(149, [206, 178, 140], 1.0),
  leatherTex: () =>
    tex(
      61,
      256,
      0.6,
      (g, w, h, rnd) => {
        g.fillStyle = '#7a4122';
        g.fillRect(0, 0, w, h);
        blotches(g, w, h, 40, 20, 70, ['rgba(255,190,120,.12)', 'rgba(30,10,0,.2)'], rnd);
        speckle(g, w, h, 6000, ['rgba(30,12,4,.25)', 'rgba(255,200,150,.1)'], rnd, 1.2);
      },
      { normal: 2.2, rough: [0.35, 0.6] },
    ),
  marbleTex: () =>
    tex(
      71,
      512,
      1.6,
      (g, w, h, rnd) => {
        g.fillStyle = '#ece8e2';
        g.fillRect(0, 0, w, h);
        blotches(g, w, h, 30, 40, 160, ['rgba(200,195,185,.25)', 'rgba(255,255,255,.3)'], rnd);
        // Calacatta: a few bold gold-grey veins, many fine grey ones, wandering.
        for (let k = 0; k < 16; k++) {
          let x = rnd() * w,
            y = rnd() * h,
            a = rnd() * TAU;
          g.strokeStyle = k < 3 ? 'rgba(150,122,84,.6)' : `rgba(95,92,88,${0.15 + rnd() * 0.3})`;
          g.lineWidth = k < 3 ? 2.6 : 0.6 + rnd() * 1.4;
          g.beginPath();
          g.moveTo(x, y);
          for (let s = 0; s < 60; s++) {
            a += (rnd() - 0.5) * 0.6;
            x += Math.cos(a) * 9;
            y += Math.sin(a) * 9;
            g.lineTo(x, y);
          }
          g.stroke();
        }
      },
      { normal: 0.5, rough: [0.12, 0.06] },
    ),
  terrazzoTex: () =>
    tex(
      83,
      512,
      0.9,
      (g, w, h, rnd) => {
        g.fillStyle = '#d4cdc2';
        g.fillRect(0, 0, w, h);
        const chips = ['#7d4a2e', '#2b2a28', '#a89f92', '#f4efe8', '#5b6b52', '#c2864f', '#8d8a84'];
        for (let i = 0; i < 1600; i++) {
          const r = 1 + rnd() ** 3 * 10,
            x = rnd() * w,
            y = rnd() * h;
          g.fillStyle = chips[(rnd() * chips.length) | 0];
          g.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * TAU + rnd() * 0.5,
              rr = r * (0.6 + rnd() * 0.6);
            g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
          }
          g.fill();
        }
      },
      { normal: 0.6, rough: [0.25, 0.14] },
    ),
  boucleTex: () =>
    tex(
      91,
      256,
      0.25,
      (g, w, h, rnd) => {
        g.fillStyle = '#e4dccf';
        g.fillRect(0, 0, w, h);
        // Looped yarn: thousands of tiny rings catching light and shade.
        for (let i = 0; i < 2800; i++) {
          g.strokeStyle = rnd() < 0.5 ? 'rgba(120,105,90,.35)' : 'rgba(255,255,255,.55)';
          g.lineWidth = 1;
          g.beginPath();
          g.arc(rnd() * w, rnd() * h, 1.5 + rnd() * 2.2, 0, TAU);
          g.stroke();
        }
      },
      { normal: 3, rough: [1, 0.92] },
    ),
  velvetTex: () =>
    tex(
      97,
      256,
      0.8,
      (g, w, h, rnd) => {
        g.fillStyle = '#9a9a9a';
        g.fillRect(0, 0, w, h);
        blotches(g, w, h, 60, 10, 50, ['rgba(255,255,255,.14)', 'rgba(0,0,0,.16)'], rnd); // crushed pile
      },
      { normal: 0.6, rough: [0.85, 0.7] },
    ),
  rattanTex: () =>
    tex(
      101,
      256,
      0.12,
      (g, w, h, rnd) => {
        g.fillStyle = '#3a2414';
        g.fillRect(0, 0, w, h);
        // Basket weave: alternating cane strands with dark gaps between.
        for (let y = 0; y < h; y += 16)
          for (let x = 0; x < w; x += 16) {
            g.fillStyle = `rgb(${(196 + rnd() * 30) | 0},${(150 + rnd() * 25) | 0},${(92 + rnd() * 20) | 0})`;
            if (((x + y) / 16) % 2) g.fillRect(x + 3, y + 1, 10, 14);
            else g.fillRect(x + 1, y + 3, 14, 10);
          }
      },
      { normal: 2.4, rough: [0.9, 0.6] },
    ),
  terracottaTex: () =>
    tex(
      107,
      256,
      0.7,
      (g, w, h, rnd) => {
        g.fillStyle = '#a5562f';
        g.fillRect(0, 0, w, h);
        blotches(g, w, h, 40, 15, 60, ['rgba(220,140,90,.25)', 'rgba(70,25,10,.2)', 'rgba(240,220,200,.14)'], rnd);
        speckle(g, w, h, 2500, ['rgba(60,20,8,.3)', 'rgba(255,220,180,.2)'], rnd, 1.2);
      },
      { normal: 1.5, rough: [0.95, 0.8] },
    ),
  // Kilim: drawn once across the whole rug (plane UVs 0–1), indigo field, ochre and bone lozenges.
  kilimTex: () =>
    tex(
      113,
      512,
      1,
      (g, w, h, rnd) => {
        const ink = '#1f2433',
          bone = '#d9cbb2',
          ochre = '#b07a3a';
        g.fillStyle = '#2c3348';
        g.fillRect(0, 0, w, h);
        g.fillStyle = ink;
        g.fillRect(0, 0, w, 44);
        g.fillRect(0, h - 44, w, 44);
        g.fillRect(0, 0, 44, h);
        g.fillRect(w - 44, 0, 44, h);
        g.fillStyle = bone;
        for (let x = 0; x < w; x += 22)
          for (const [y0, s] of [
            [44, 1],
            [h - 44, -1],
          ]) {
            g.beginPath();
            g.moveTo(x, y0);
            g.lineTo(x + 11, y0 + s * 12);
            g.lineTo(x + 22, y0);
            g.fill();
          }
        for (const [s, c] of [
          [150, ochre],
          [100, ink],
          [52, bone],
          [20, ochre],
        ]) {
          g.fillStyle = c;
          g.beginPath();
          g.moveTo(w / 2, h / 2 - s);
          g.lineTo(w / 2 + s * 0.8, h / 2);
          g.lineTo(w / 2, h / 2 + s);
          g.lineTo(w / 2 - s * 0.8, h / 2);
          g.fill();
        }
        for (let y = 0; y < h; y += 2) {
          g.fillStyle = `rgba(0,0,0,${0.04 + rnd() * 0.06})`;
          g.fillRect(0, y, w, 1);
        } // weft
        blotches(g, w, h, 30, 30, 120, ['rgba(255,230,200,.08)', 'rgba(0,0,0,.12)'], rnd); // wear
      },
      { normal: 1.2, rough: [1, 0.9] },
    ),
  woolTex: () =>
    tex(
      117,
      256,
      0.5,
      (g, w, h, rnd) => {
        g.fillStyle = '#a8a8a8';
        g.fillRect(0, 0, w, h);
        speckle(g, w, h, 9000, ['rgba(255,255,255,.18)', 'rgba(0,0,0,.18)'], rnd, 2);
      },
      { normal: 2.5, rough: [1, 0.95] },
    ),
  booksTex: () =>
    canvasTex(
      512,
      128,
      (g, w, h) => {
        const rnd = mulberry(127),
          cols = ['#5a2a20', '#2c3a4a', '#8a7a5c', '#2f3b2a', '#c9b896', '#4a2a1a', '#1c1c1c', '#7d5a2a'];
        g.fillStyle = '#120c08';
        g.fillRect(0, 0, w, h);
        for (let x = 0; x < w;) {
          const bw = 7 + rnd() * 12,
            bh = h * (0.7 + rnd() * 0.28);
          g.fillStyle = cols[(rnd() * cols.length) | 0];
          g.fillRect(x, h - bh, bw - 1, bh);
          g.fillStyle = 'rgba(230,200,140,.45)';
          g.fillRect(x + 1, h - bh + 10, bw - 3, 2);
          g.fillRect(x + 1, h - 16, bw - 3, 1);
          x += bw;
        }
      },
      { tile: 1 },
    ),
  artTex: () =>
    canvasTex(
      256,
      320,
      (g, w, h) => {
        const rnd = mulberry(131);
        g.fillStyle = '#e9e2d6';
        g.fillRect(0, 0, w, h);
        for (const [c, a] of [
          ['#1f2433', 0.9],
          ['#b07a3a', 0.85],
          ['#5b6b52', 0.75],
          ['#8d8a84', 0.6],
        ]) {
          g.globalAlpha = a;
          g.fillStyle = c;
          g.beginPath();
          g.ellipse(rnd() * w, rnd() * h, 40 + rnd() * 70, 30 + rnd() * 90, rnd() * 3, 0, TAU);
          g.fill();
        }
        g.globalAlpha = 1;
        g.strokeStyle = '#111';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(20, h * 0.7);
        g.bezierCurveTo(w * 0.3, h * 0.2, w * 0.7, h * 0.9, w - 20, h * 0.3);
        g.stroke();
      },
      { tile: 1 },
    ),
};
