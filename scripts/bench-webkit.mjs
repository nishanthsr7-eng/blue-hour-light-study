/**
 * Runs the production build in WebKit, the engine behind Safari, through
 * Playwright, and prints load and frame numbers comparable to bench.mjs.
 *
 *   npx playwright install webkit   (once)
 *   npm run build && npm run bench:webkit
 *
 * WebKit has no long-task observer and no GPU timer queries, so this records
 * when the veil lifted, CPU time per frame (the scene update plus render),
 * the frame rate, and the quality steps the governor took. Playwright's
 * WebKit is not Safari itself (no macOS compositor or Metal), so treat the
 * numbers as a check that the page loads and runs, and confirm on a Mac.
 *
 * Set RUNS (default 3) and HEADED=1 to watch it.
 */
import { webkit } from 'playwright';
import { preview } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RUNS = Number(process.env.RUNS) || 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

// Runs in the page: `frames` frames of CPU time per rAF callback and the gaps between them.
const sampleFrames = (frames) =>
  new Promise((done) => {
    const cpu = [],
      gaps = [];
    const raf = globalThis.requestAnimationFrame;
    let last = 0;
    globalThis.requestAnimationFrame = (cb) =>
      raf((t) => {
        if (last) gaps.push(t - last);
        last = t;
        const s = performance.now();
        cb(t);
        cpu.push(performance.now() - s);
      });
    const poll = () => {
      if (cpu.length < frames) return raf(poll);
      globalThis.requestAnimationFrame = raf;
      done({ cpu, gaps });
    };
    raf(poll);
  });
const summarise = ({ cpu, gaps }) => ({ cpu: median(cpu), fps: 1000 / median(gaps) });

const server = await preview({ root: ROOT, preview: { port: 4177, strictPort: false }, logLevel: 'warn' });
const url = `${server.resolvedUrls.local[0]}?debug`;
const results = [];
try {
  for (let run = 0; run < RUNS; run++) {
    const browser = await webkit.launch({ headless: !process.env.HEADED });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const steps = [],
        errors = [];
      page.on('console', (m) => /quality step/.test(m.text()) && steps.push(m.text().replace('[perf] ', '')));
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForSelector('#veil.is-off', { state: 'attached', timeout: 90000 });
      const veil = await page.evaluate(() => performance.now());
      const gpuName = await page.evaluate(() => {
        const gl = globalThis.blueHour.renderer.getContext();
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      });
      if (run === 0) console.log(`WebKit ${browser.version()} · ${gpuName}`);
      await sleep(7000); // the intro lights the house and the camera settles
      await page.mouse.move(720, 450);
      const rest = summarise(await page.evaluate(sampleFrames, 300));
      await page.evaluate(() => globalThis.scrollTo({ top: globalThis.document.documentElement.scrollHeight }));
      const flight = summarise(await page.evaluate(sampleFrames, 300));
      results.push({ veil, rest, flight });
      const f = (v) => v.toFixed(1);
      console.log(
        `run ${run + 1}: veil ${f(veil)} ms · rest cpu ${f(rest.cpu)} ms ${f(rest.fps)} fps · ` +
          `flight cpu ${f(flight.cpu)} ms ${f(flight.fps)} fps` +
          (steps.length ? ` · ${steps.join(', ')}` : '') +
          (errors.length ? ` · errors: ${errors.join(' | ')}` : ''),
      );
    } finally {
      await browser.close();
    }
  }
  const m = (pick) => median(results.map(pick)).toFixed(1);
  console.log(
    `\nmedian of ${RUNS}: veil ${m((r) => r.veil)} ms · rest cpu ${m((r) => r.rest.cpu)} ms ${m((r) => r.rest.fps)} fps · ` +
      `flight cpu ${m((r) => r.flight.cpu)} ms ${m((r) => r.flight.fps)} fps`,
  );
} finally {
  await server.close();
}
