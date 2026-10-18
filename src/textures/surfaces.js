import { TAU, mulberry } from '../core/math.js';
import { blotches, canvasTex, makeCanvas, pbr, speckle, streaks, TexSpec } from './canvas-kit.js';
import { FURNISHINGS } from './furnishings.js';

/* The big surfaces, painted once at load: concrete, timber, stone, grass,
   foliage, bronze, fabric, gravel and water. Each recipe is seeded, so it paints the same
   pixels every time, and returns TexSpecs (canvas-kit.js) or a material
   recipe of them ({ map, normalMap, roughnessMap, roughness }).

   They run in bake.worker.js, off the main thread, and procedural.js turns
   the results into three.js textures. Heaviest first, so the workers share
   the load evenly. */
export const SURFACES = {
  // Meadow grass.
  grass() {
    const rnd = mulberry(21);
    const t = canvasTex(
      1024,
      1024,
      (g, w, h) => {
        g.fillStyle = '#2c4627';
        g.fillRect(0, 0, w, h);
        blotches(
          g,
          w,
          h,
          220,
          30,
          180,
          ['rgba(80,105,50,.25)', 'rgba(15,32,15,.35)', 'rgba(120,115,65,.2)', 'rgba(60,70,40,.2)'],
          rnd,
        );
        for (let i = 0; i < 60000; i++) {
          const x = rnd() * w,
            y = rnd() * h,
            lit = rnd();
          g.strokeStyle =
            lit < 0.25
              ? `rgba(12,24,10,${0.3 + rnd() * 0.3})`
              : `rgba(${(70 + lit * 80) | 0},${(100 + lit * 80) | 0},${(40 + lit * 35) | 0},${0.15 + rnd() * 0.3})`;
          g.lineWidth = 0.8 + rnd() * 0.6;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + (rnd() - 0.5) * 4, y - 3 - rnd() * 7);
          g.stroke();
        }
      },
      { tile: 6 },
    );
    return pbr(t, { normal: 1.5, rough: [1, 0.85] });
  },

  // Clean GFRC for slab fascias: a fine, even grain with no formwork marks.
  gfrc() {
    const rnd = mulberry(4);
    const t = canvasTex(
      1024,
      1024,
      (g, w, h) => {
        g.fillStyle = '#e8e3db';
        g.fillRect(0, 0, w, h);
        // Cast-stone clouding: the slow tonal drift of a hand-finished panel.
        blotches(
          g,
          w,
          h,
          90,
          60,
          300,
          ['rgba(255,255,255,.07)', 'rgba(150,138,124,.05)', 'rgba(200,190,175,.06)'],
          rnd,
        );
        blotches(g, w, h, 300, 6, 30, ['rgba(255,255,255,.05)', 'rgba(140,130,118,.04)'], rnd);
        // Pinhole pores and exposed fine aggregate.
        speckle(g, w, h, 40000, ['rgba(120,112,104,.09)', 'rgba(255,255,255,.1)', 'rgba(170,160,148,.12)'], rnd, 1.1);
        speckle(g, w, h, 900, ['rgba(70,64,58,.35)'], rnd, 1.6);
        // Dirt washing down from every edge.
        streaks(g, w, h, 60, 'rgba(110,100,88,A)', rnd);
        // Panel joints every 2.4 m along the run.
        for (let x = 0; x < w; x += 512) {
          g.fillStyle = 'rgba(60,55,50,.45)';
          g.fillRect(x, 0, 2, h);
          g.fillStyle = 'rgba(255,255,255,.3)';
          g.fillRect(x + 2, 0, 1, h);
        }
      },
      { tile: 4.8 },
    );
    return pbr(t, { normal: 2.2, rough: [0.62, 0.38] });
  },

  // Board-formed concrete for the core.
  boardForm() {
    const rnd = mulberry(5);
    const t = canvasTex(
      1024,
      1024,
      (g, w, h) => {
        g.fillStyle = '#8c8781';
        g.fillRect(0, 0, w, h);
        blotches(g, w, h, 60, 60, 260, ['rgba(255,250,240,.06)', 'rgba(60,55,48,.07)', 'rgba(120,110,95,.06)'], rnd);
        // 200 mm vertical boards: each its own tone, with timber-grain imprint.
        for (let x = 0; x < w; x += 40) {
          g.fillStyle = `rgba(${rnd() < 0.5 ? '255,250,240' : '40,35,30'},${0.03 + rnd() * 0.07})`;
          g.fillRect(x, 0, 40, h);
          for (let k = 0; k < 9; k++) {
            g.strokeStyle = `rgba(35,30,25,${0.03 + rnd() * 0.06})`;
            g.lineWidth = 0.6 + rnd();
            const xx = x + 2 + rnd() * 36,
              f = 0.004 + rnd() * 0.01,
              p0 = rnd() * 9;
            g.beginPath();
            for (let y = 0; y <= h; y += 12) g.lineTo(xx + Math.sin(y * f + p0) * 2.2, y);
            g.stroke();
          }
          g.fillStyle = 'rgba(25,22,18,.35)';
          g.fillRect(x, 0, 1.6, h);
          g.fillStyle = 'rgba(255,255,255,.08)';
          g.fillRect(x + 1.6, 0, 1, h);
        }
        // Pour lifts: a faint horizontal cold joint every 2.4 m.
        for (let y = 0; y < h; y += 512) {
          g.fillStyle = 'rgba(30,26,22,.35)';
          g.fillRect(0, y, w, 2);
        }
        streaks(g, w, h, 70, 'rgba(40,36,30,A)', rnd);
        streaks(g, w, h, 25, 'rgba(235,230,220,A)', rnd);
        speckle(g, w, h, 26000, ['rgba(40,35,30,.18)', 'rgba(255,255,255,.08)', 'rgba(20,18,15,.3)'], rnd, 1.3);
        // Recessed form-tie cones with a soft rim.
        for (let y = 64; y < h; y += 256)
          for (let x = 20; x < w; x += 160) {
            g.fillStyle = 'rgba(200,195,188,.25)';
            g.beginPath();
            g.arc(x, y, 7, 0, TAU);
            g.fill();
            g.fillStyle = 'rgba(18,16,14,.65)';
            g.beginPath();
            g.arc(x, y, 4.5, 0, TAU);
            g.fill();
          }
      },
      { tile: 10 },
    );
    return pbr(t, { normal: 3, rough: [0.95, 0.78] });
  },

  // Warm timber: planks, grain, joints.
  timber() {
    const rnd = mulberry(9);
    const t = canvasTex(
      1024,
      1024,
      (g, w, h) => {
        const ph = 48;
        for (let y = 0; y < h; y += ph) {
          // Oiled oak slats: warm honey with board-to-board tone and grain.
          const tone = 0.8 + rnd() * 0.32,
            hue = rnd() * 14;
          g.fillStyle = `rgb(${(158 * tone + hue) | 0},${(104 * tone) | 0},${(62 * tone - hue * 0.4) | 0})`;
          g.fillRect(0, y, w, ph);
          const lg = g.createLinearGradient(0, y, 0, y + ph);
          lg.addColorStop(0, 'rgba(255,220,170,.10)');
          lg.addColorStop(0.5, 'rgba(0,0,0,0)');
          lg.addColorStop(1, 'rgba(40,20,8,.18)');
          g.fillStyle = lg;
          g.fillRect(0, y, w, ph);
          for (let i = 0; i < 26; i++) {
            g.strokeStyle = `rgba(${rnd() < 0.3 ? '230,180,120' : '60,30,15'},${0.05 + rnd() * 0.13})`;
            g.lineWidth = 0.5 + rnd() * 1.4;
            g.beginPath();
            const yy = y + rnd() * ph,
              amp = rnd() * 4,
              f = 0.004 + rnd() * 0.02,
              ph0 = rnd() * 9;
            for (let x = 0; x <= w; x += 6)
              g.lineTo(x, yy + Math.sin(x * f + ph0) * amp + Math.sin(x * f * 3.1) * amp * 0.3);
            g.stroke();
          }
          if (rnd() < 0.35) {
            // a knot with grain wrapping round it
            const kx = rnd() * w,
              ky = y + ph * (0.3 + rnd() * 0.4);
            for (let r = 9; r > 1; r -= 2) {
              g.strokeStyle = `rgba(60,30,12,${0.12 + (9 - r) * 0.04})`;
              g.lineWidth = 1;
              g.beginPath();
              g.ellipse(kx, ky, r * 2.2, r * 0.6, 0, 0, TAU);
              g.stroke();
            }
          }
          g.fillStyle = 'rgba(25,12,5,.75)';
          g.fillRect(0, y, w, 2.5);
          g.fillStyle = 'rgba(255,215,160,.12)';
          g.fillRect(0, y + 2.5, w, 1);
          g.fillStyle = 'rgba(25,12,5,.6)';
          g.fillRect(rnd() * w, y, 2, ph);
        }
        speckle(g, w, h, 5000, ['rgba(40,20,10,.15)', 'rgba(255,220,170,.06)'], rnd, 1.2);
      },
      { tile: 4 },
    );
    return pbr(t, { normal: 2.2, rough: [0.7, 0.45] });
  },

  // Large-format honed limestone pavers (1200 × 600) with tight joints.
  paverTex() {
    const rnd = mulberry(15);
    const t = canvasTex(
      1024,
      1024,
      (g, w, h) => {
        const pw = 256,
          ph = 128; // 1.2 m × 0.6 m at 4.8 m per tile
        for (let y = 0, row = 0; y < h; y += ph, row++)
          for (let x = (-(row % 2) * pw) / 2; x < w; x += pw) {
            const t = 0.94 + rnd() * 0.08;
            g.fillStyle = `rgb(${(214 * t) | 0},${(206 * t) | 0},${(194 * t) | 0})`;
            g.fillRect(x, y, pw, ph);
          }
        blotches(
          g,
          w,
          h,
          140,
          20,
          110,
          ['rgba(255,255,255,.06)', 'rgba(110,100,90,.05)', 'rgba(150,135,110,.05)'],
          rnd,
        );
        // Fossil flecks and shell fragments in the limestone.
        for (let i = 0; i < 260; i++) {
          g.strokeStyle = `rgba(150,138,120,${0.15 + rnd() * 0.2})`;
          g.lineWidth = 0.8;
          g.beginPath();
          const x = rnd() * w,
            y = rnd() * h;
          g.arc(x, y, 1 + rnd() * 3, rnd() * 3, rnd() * 3 + 2);
          g.stroke();
        }
        speckle(g, w, h, 24000, ['rgba(90,84,76,.09)', 'rgba(255,255,255,.09)'], rnd, 1.2);
        // Water and foot traffic darken the joints' edges.
        for (let y = 0, row = 0; y < h; y += ph, row++)
          for (let x = (-(row % 2) * pw) / 2; x < w; x += pw) {
            g.strokeStyle = 'rgba(90,80,68,.10)';
            g.lineWidth = 6;
            g.strokeRect(x + 3, y + 3, pw - 6, ph - 6);
          }
        g.fillStyle = 'rgba(55,48,40,.6)';
        for (let y = 0, row = 0; y < h; y += ph, row++) {
          g.fillRect(0, y, w, 2.2);
          for (let x = (-(row % 2) * pw) / 2; x < w; x += pw) g.fillRect(x, y, 2.2, ph);
        }
      },
      { tile: 4.8 },
    );
    return pbr(t, { normal: 3, rough: [0.85, 0.58] });
  },

  // Narrow oak deck boards for the penthouse terrace.
  deckTex() {
    const rnd = mulberry(19);
    const t = canvasTex(
      1024,
      1024,
      (g, w, h) => {
        const bw = 48;
        for (let x = 0; x < w; x += bw) {
          const t = 0.85 + rnd() * 0.25;
          g.fillStyle = `rgb(${(160 * t) | 0},${(116 * t) | 0},${(80 * t) | 0})`;
          g.fillRect(x, 0, bw, h);
          const sg = g.createLinearGradient(x, 0, x + bw, 0);
          sg.addColorStop(0, 'rgba(255,225,180,.1)');
          sg.addColorStop(1, 'rgba(30,15,5,.16)');
          g.fillStyle = sg;
          g.fillRect(x, 0, bw, h);
          for (let i = 0; i < 18; i++) {
            g.strokeStyle = `rgba(${rnd() < 0.3 ? '220,170,115' : '70,40,20'},${0.05 + rnd() * 0.12})`;
            g.lineWidth = 0.6 + rnd();
            const xx = x + rnd() * bw;
            g.beginPath();
            g.moveTo(xx, 0);
            for (let y = 0; y <= h; y += 16) g.lineTo(xx + Math.sin(y * 0.02 + i) * 1.2, y);
            g.stroke();
          }
          g.fillStyle = 'rgba(15,8,4,.85)';
          g.fillRect(x, 0, 3, h);
          g.fillStyle = 'rgba(30,18,10,.6)';
          g.fillRect(x, rnd() * h, bw, 1.6);
          // Stainless screw pairs at every joist.
          for (let y = 20; y < h; y += 128) {
            g.fillStyle = 'rgba(30,25,20,.7)';
            g.fillRect(x + 10, y, 3, 3);
            g.fillRect(x + bw - 13, y, 3, 3);
          }
        }
        streaks(g, w, h, 30, 'rgba(60,40,25,A)', rnd);
      },
      { tile: 4 },
    );
    return pbr(t, { normal: 2.4, rough: [0.75, 0.5] });
  },

  // Travertine: warm cream with horizontal vein bands and pitting.
  travTex() {
    const rnd = mulberry(17);
    const t = canvasTex(
      1024,
      1024,
      (g, w, h) => {
        const s = 256;
        for (let y = 0; y < h; y += s / 2)
          for (let x = 0; x < w; x += s) {
            const t = 0.93 + rnd() * 0.1;
            g.fillStyle = `rgb(${(222 * t) | 0},${(210 * t) | 0},${(190 * t) | 0})`;
            g.fillRect(x, y, s, s / 2);
            for (let k = 0; k < 5; k++) {
              g.fillStyle = `rgba(${rnd() < 0.5 ? '170,150,120' : '245,238,225'},${0.12 + rnd() * 0.15})`;
              g.fillRect(x, y + (rnd() * s) / 2, s, 0.8 + rnd() * 3);
            }
          }
        // Travertine's signature: elongated voids running with the bedding.
        for (let i = 0; i < 900; i++) {
          const x = rnd() * w,
            y = rnd() * h,
            l = 2 + rnd() * 10;
          g.fillStyle = `rgba(110,90,66,${0.25 + rnd() * 0.35})`;
          g.beginPath();
          g.ellipse(x, y, l, 0.8 + rnd() * 1.4, 0, 0, TAU);
          g.fill();
        }
        speckle(g, w, h, 9000, ['rgba(120,100,80,.2)', 'rgba(255,250,235,.12)'], rnd, 1.4);
        g.fillStyle = 'rgba(70,60,48,.55)';
        for (let y = 0; y < h; y += s / 2) g.fillRect(0, y, w, 2);
        for (let x = 0; x < w; x += s) g.fillRect(x, 0, 2, h);
      },
      { tile: 4 },
    );
    return pbr(t, { normal: 3.2, rough: [0.9, 0.55] });
  },

  // Washed river gravel for the strip round the plinth.
  gravelTex() {
    const rnd = mulberry(61);
    const t = canvasTex(
      512,
      512,
      (g, w, h) => {
        g.fillStyle = '#2e2b29';
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 4200; i++) {
          const x = rnd() * w,
            y = rnd() * h,
            r = 3 + rnd() * 5,
            v = 0.5 + rnd() * 0.5,
            warm = rnd();
          const c = [(150 + warm * 40) * v, (144 + warm * 24) * v, (136 + warm * 8) * v];
          const grd = g.createRadialGradient(x - r * 0.3, y - r * 0.35, 0, x, y, r);
          grd.addColorStop(0, `rgb(${c.map((k) => Math.min(255, k * 1.3) | 0)})`);
          grd.addColorStop(0.65, `rgb(${c.map((k) => k | 0)})`);
          grd.addColorStop(1, `rgb(${c.map((k) => (k * 0.4) | 0)})`);
          g.fillStyle = grd;
          g.beginPath();
          g.ellipse(x, y, r, r * (0.6 + rnd() * 0.35), rnd() * TAU, 0, TAU);
          g.fill();
        }
      },
      { tile: 1.6 },
    );
    return pbr(t, { normal: 3, rough: [0.95, 0.72] });
  },

  // Clipped boxwood: a dense mass of small leaves.
  leafMassTex() {
    const rnd = mulberry(37);
    const t = canvasTex(
      512,
      512,
      (g, w, h) => {
        // Layered boxwood: dark interior gaps, then leaves lit from above with
        // the yellow-green of new growth on the outermost ones.
        g.fillStyle = '#16220f';
        g.fillRect(0, 0, w, h);
        for (let pass = 0; pass < 3; pass++)
          for (let i = 0; i < 4200; i++) {
            const v = 0.45 + pass * 0.22 + rnd() * 0.25,
              young = rnd() < 0.18 * pass;
            g.fillStyle = young
              ? `rgb(${(150 * v) | 0},${(175 * v) | 0},${(70 * v) | 0})`
              : `rgb(${(70 * v) | 0},${(118 * v) | 0},${(52 * v) | 0})`;
            const x = rnd() * w,
              y = rnd() * h,
              a = rnd() * TAU,
              r = 2.5 + rnd() * 4;
            g.beginPath();
            g.ellipse(x, y, r, r * 0.55, a, 0, TAU);
            g.fill();
            g.fillStyle = 'rgba(255,255,220,.18)';
            g.beginPath();
            g.ellipse(x - Math.cos(a) * r * 0.2, y - 1, r * 0.5, r * 0.18, a, 0, TAU);
            g.fill();
          }
        speckle(g, w, h, 1600, ['rgba(5,8,4,.55)'], rnd, 2.6);
      },
      { tile: 0.5 },
    );
    return pbr(t, { normal: 2.5, rough: [0.95, 0.6] });
  },

  // Tileable water normals from integer-frequency waves.
  waterNormal() {
    const S = 256,
      c = makeCanvas(S, S);
    const g = c.getContext('2d'),
      img = g.createImageData(S, S);
    const waves = [
      [3, 1, 0.5],
      [1, 4, 0.4],
      [5, -2, 0.3],
      [-2, 7, 0.2],
      [9, 3, 0.12],
      [4, 11, 0.08],
      [-7, 5, 0.1],
    ];
    const H = (x, y) => waves.reduce((s, [a, b, m]) => s + Math.sin(((a * x + b * y) / S) * TAU + a) * m, 0);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const dx = (H(x + 1, y) - H(x - 1, y)) * 6,
          dy = (H(x, y + 1) - H(x, y - 1)) * 6;
        const l = Math.hypot(dx, dy, 1),
          i = (y * S + x) * 4;
        img.data[i] = ((-dx / l) * 0.5 + 0.5) * 255;
        img.data[i + 1] = ((-dy / l) * 0.5 + 0.5) * 255;
        img.data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
        img.data[i + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    return new TexSpec(c, { tile: 5, aniso: false });
  },

  // Absolute-black granite for reveals and kerbs: flamed, with mica glints.
  graniteTex() {
    const rnd = mulberry(43);
    const t = canvasTex(
      512,
      512,
      (g, w, h) => {
        g.fillStyle = '#1b1a19';
        g.fillRect(0, 0, w, h);
        speckle(g, w, h, 18000, ['rgba(60,58,56,.6)', 'rgba(5,5,5,.6)', 'rgba(90,88,84,.35)'], rnd, 1.6);
        speckle(g, w, h, 600, ['rgba(200,195,185,.55)'], rnd, 0.9);
      },
      { tile: 2 },
    );
    return pbr(t, { normal: 1.6, rough: [0.85, 0.5] });
  },

  // Brushed bronze PVD: fine directional scratches that stretch highlights.
  bronzeTex() {
    const rnd = mulberry(41);
    const t = canvasTex(
      512,
      512,
      (g, w, h) => {
        g.fillStyle = '#8a8a8a';
        g.fillRect(0, 0, w, h);
        blotches(g, w, h, 30, 40, 160, ['rgba(255,255,255,.08)', 'rgba(0,0,0,.08)'], rnd);
        for (let i = 0; i < 5000; i++) {
          const v = (rnd() * 255) | 0;
          g.fillStyle = `rgba(${v},${v},${v},${0.05 + rnd() * 0.1})`;
          g.fillRect(rnd() * w, rnd() * h, 1, 20 + rnd() * 200);
        }
      },
      { tile: 1, color: false },
    );
    t.repeat.set(1, 1);
    const p = pbr(t, { normal: 0.6, rough: [0.46, 0.24] });
    return { normalMap: p.normalMap, roughnessMap: p.roughnessMap };
  },

  // Tactile warning strip: dark granite tiles with a 50 mm grid of domes.
  tactileTex() {
    const rnd = mulberry(63);
    const t = canvasTex(
      256,
      256,
      (g, w, h) => {
        g.fillStyle = '#2a2826';
        g.fillRect(0, 0, w, h);
        speckle(g, w, h, 4000, ['rgba(90,86,80,.4)', 'rgba(0,0,0,.4)'], rnd, 1.2);
        for (let y = 16; y < h; y += 32)
          for (let x = 16; x < w; x += 32) {
            const grd = g.createRadialGradient(x - 3, y - 3, 0, x, y, 11);
            grd.addColorStop(0, '#8d877e');
            grd.addColorStop(0.7, '#4a4640');
            grd.addColorStop(1, '#1c1a18');
            g.fillStyle = grd;
            g.beginPath();
            g.arc(x, y, 11, 0, TAU);
            g.fill();
          }
      },
      { tile: 0.4 },
    );
    return pbr(t, { normal: 4, rough: [0.85, 0.45] });
  },

  // Pale, fissured bark for multi-stem trees.
  barkTex() {
    const rnd = mulberry(67);
    const t = canvasTex(
      256,
      256,
      (g, w, h) => {
        g.fillStyle = '#6d655b';
        g.fillRect(0, 0, w, h);
        blotches(g, w, h, 40, 10, 50, ['rgba(160,150,135,.25)', 'rgba(40,35,30,.25)'], rnd);
        for (let i = 0; i < 140; i++) {
          g.strokeStyle = `rgba(30,25,20,${0.2 + rnd() * 0.4})`;
          g.lineWidth = 0.8 + rnd() * 2;
          const x = rnd() * w;
          g.beginPath();
          g.moveTo(x, rnd() * h);
          for (let k = 0; k < 4; k++) g.lineTo(x + (rnd() - 0.5) * 8, rnd() * h);
          g.stroke();
        }
      },
      { tile: 1 },
    );
    t.repeat.set(2, 3);
    return pbr(t, { normal: 3, rough: [1, 0.8] });
  },

  // Bouclé-weave outdoor upholstery.
  fabricTex() {
    const rnd = mulberry(47);
    const t = canvasTex(
      256,
      256,
      (g, w, h) => {
        g.fillStyle = '#ddd5c9';
        g.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 4)
          for (let x = 0; x < w; x += 4) {
            const v = ((x + y) / 4) % 2 ? 0.08 : -0.06;
            g.fillStyle = v > 0 ? `rgba(255,255,255,${v + rnd() * 0.05})` : `rgba(60,50,40,${-v + rnd() * 0.05})`;
            g.fillRect(x, y, 4, 4);
          }
        speckle(g, w, h, 3000, ['rgba(80,70,60,.12)', 'rgba(255,255,255,.15)'], rnd, 1.6);
      },
      { tile: 1 },
    );
    t.repeat.set(3, 3);
    return pbr(t, { normal: 1.4, rough: [1, 0.9] });
  },

  matTex() {
    const rnd = mulberry(65);
    const t = canvasTex(
      256,
      256,
      (g, w, h) => {
        for (let y = 0; y < h; y += 16) {
          g.fillStyle = '#2b2622';
          g.fillRect(0, y, w, 11);
          speckle(g, w, 11, 600, ['rgba(120,100,80,.35)', 'rgba(0,0,0,.4)'], rnd, 1.5);
          g.fillStyle = '#6a645c';
          g.fillRect(0, y + 11, w, 5);
        }
      },
      { tile: 0.3 },
    );
    return pbr(t, { normal: 2.5, rough: [0.95, 0.5] });
  },

  // Stainless slot-drain grate and the ribbed entrance mat.
  grateTex() {
    const t = canvasTex(
      256,
      256,
      (g, w, h) => {
        g.fillStyle = '#070707';
        g.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += 16) {
          g.fillStyle = '#a9a49c';
          g.fillRect(x, 0, 6, h);
          g.fillStyle = '#ddd8cf';
          g.fillRect(x + 1, 0, 1.5, h);
        }
      },
      { tile: 0.25 },
    );
    return pbr(t, { normal: 2, rough: [0.7, 0.25] });
  },

  // Charcoal fibre-cement troughs: smooth, faintly mottled, salt-bloomed at the base.
  troughTex() {
    const rnd = mulberry(45);
    const t = canvasTex(
      256,
      256,
      (g, w, h) => {
        g.fillStyle = '#3c3b38';
        g.fillRect(0, 0, w, h);
        blotches(g, w, h, 40, 10, 60, ['rgba(255,255,255,.04)', 'rgba(0,0,0,.08)'], rnd);
        speckle(g, w, h, 5000, ['rgba(255,255,255,.05)', 'rgba(0,0,0,.12)'], rnd, 1);
        const b = g.createLinearGradient(0, h * 0.75, 0, h);
        b.addColorStop(0, 'rgba(200,195,180,0)');
        b.addColorStop(1, 'rgba(200,195,180,.14)');
        g.fillStyle = b;
        g.fillRect(0, h * 0.75, w, h * 0.25);
      },
      { tile: 1 },
    );
    t.repeat.set(1, 1);
    return pbr(t, { normal: 1, rough: [0.85, 0.65] });
  },
  // The furniture finishes, smaller and last.
  ...FURNISHINGS,
};
