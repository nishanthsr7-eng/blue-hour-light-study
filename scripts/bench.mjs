/**
 * Benchmarks the production build in a real Chromium (Chrome or Edge) with
 * the GPU on, and prints the numbers quoted in docs/PERFORMANCE.md.
 *
 *   npm run build && npm run bench
 *
 * Each run opens a fresh browser profile (a cold shader cache), loads the
 * page at 1440 × 900 and records:
 *   - when the veil lifted (scene on screen) and the long tasks before it
 *     (total blocking time: the part of each task over 50 ms);
 *   - CPU time per frame (the scene update plus composer.render) and GPU
 *     time per frame (EXT_disjoint_timer_query_webgl2), at rest and while
 *     the drone flies up the tower.
 * The display's refresh rate caps the frame interval, so the frame interval
 * says little about cost; CPU and GPU time per frame do.
 *
 * Set RUNS (default 3) and CHROME_PATH as needed.
 */
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RUNS = Number(process.env.RUNS) || 3;
const BROWSERS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

const executablePath = BROWSERS.find((p) => existsSync(p));
if (!executablePath) throw new Error('No Chrome or Edge found. Set CHROME_PATH.');

// Runs in the page before any script: collects long tasks from navigation on.
const observeLongTasks = () => {
  globalThis.__long = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) globalThis.__long.push([e.startTime, e.duration]);
  }).observe({ type: 'longtask', buffered: true });
};

// Runs in the page: samples `frames` drawn frames, timing the CPU side of the
// whole rAF callback and the GPU side of composer.render().
const sampleFrames = (frames) =>
  new Promise((done) => {
    const { renderer, composer } = globalThis.blueHour;
    const gl = renderer.getContext();
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const cpu = [],
      gpu = [],
      pending = [],
      calls = [],
      tris = [];
    const render = composer.render.bind(composer);
    composer.render = (...a) => {
      const q = ext && gl.createQuery();
      if (q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      render(...a);
      if (q) {
        gl.endQuery(ext.TIME_ELAPSED_EXT);
        pending.push(q);
      }
      calls.push(renderer.info.render.calls);
      tris.push(renderer.info.render.triangles);
    };
    renderer.info.autoReset = false;
    const raf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (cb) =>
      raf((t) => {
        renderer.info.reset();
        const s = performance.now();
        cb(t);
        cpu.push(performance.now() - s);
      });
    const poll = () => {
      while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
        const q = pending.shift();
        if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
        gl.deleteQuery(q);
      }
      if (cpu.length < frames) return raf(poll);
      globalThis.requestAnimationFrame = raf;
      composer.render = render;
      renderer.info.autoReset = true;
      done({ cpu, gpu, calls, tris });
    };
    raf(poll);
  });

const summarise = ({ cpu, gpu, calls, tris }) => ({
  cpu: median(cpu),
  cpu95: [...cpu].sort((a, b) => a - b)[Math.floor(cpu.length * 0.95)],
  gpu: gpu.length ? median(gpu) : NaN,
  calls: [Math.min(...calls), Math.max(...calls)],
  tris: [Math.min(...tris), Math.max(...tris)],
});

const server = await preview({ root: ROOT, preview: { port: 4174, strictPort: false }, logLevel: 'warn' });
const url = `${server.resolvedUrls.local[0]}?debug`;
const results = [];
try {
  for (let run = 0; run < RUNS; run++) {
    const profile = mkdtempSync(path.join(tmpdir(), 'blue-hour-bench-'));
    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      userDataDir: profile,
      args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=default', '--disable-gpu-vsync'],
    });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
      await page.evaluateOnNewDocument(observeLongTasks);
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForSelector('#veil.is-off', { timeout: 60000 });
      const load = await page.evaluate(() => {
        const veil = performance.now();
        const long = globalThis.__long.filter(([s]) => s < veil);
        return {
          veil,
          tbt: long.reduce((n, [, d]) => n + Math.max(0, d - 50), 0),
          longest: Math.max(0, ...long.map(([, d]) => d)),
        };
      });
      await sleep(7000); // the intro lights the house and the camera settles
      await page.mouse.move(720, 450);
      const rest = summarise(await page.evaluate(sampleFrames, 300));
      // The drone flight: scroll to the crown and sample while it flies.
      await page.evaluate(() => globalThis.scrollTo({ top: globalThis.document.documentElement.scrollHeight }));
      const flight = summarise(await page.evaluate(sampleFrames, 300));
      results.push({ load, rest, flight });
      const f = (v) => v.toFixed(1);
      console.log(
        `run ${run + 1}: veil ${f(load.veil)} ms · TBT ${f(load.tbt)} ms · longest ${f(load.longest)} ms · ` +
          `rest cpu ${f(rest.cpu)} (p95 ${f(rest.cpu95)}) gpu ${f(rest.gpu)} ms · ` +
          `flight cpu ${f(flight.cpu)} (p95 ${f(flight.cpu95)}) gpu ${f(flight.gpu)} ms · ` +
          `calls ${Math.min(rest.calls[0], flight.calls[0])}–${Math.max(rest.calls[1], flight.calls[1])} · ` +
          `tris ${(Math.min(rest.tris[0], flight.tris[0]) / 1e6).toFixed(2)}–${(Math.max(rest.tris[1], flight.tris[1]) / 1e6).toFixed(2)} M`,
      );
    } finally {
      await browser.close();
      rmSync(profile, { recursive: true, force: true });
    }
  }
  const m = (pick) => median(results.map(pick)).toFixed(1);
  console.log(
    `\nmedian of ${RUNS}: veil ${m((r) => r.load.veil)} ms · TBT ${m((r) => r.load.tbt)} ms · ` +
      `longest ${m((r) => r.load.longest)} ms · rest cpu ${m((r) => r.rest.cpu)} gpu ${m((r) => r.rest.gpu)} ms · ` +
      `flight cpu ${m((r) => r.flight.cpu)} gpu ${m((r) => r.flight.gpu)} ms`,
  );
} finally {
  await server.close();
}
