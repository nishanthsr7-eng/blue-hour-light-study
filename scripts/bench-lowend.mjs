/**
 * Plays the production build the way a budget laptop would, in Chrome or Edge,
 * and prints how smooth it is to watch and to use.
 *
 *   npm run build && npm run bench:lowend
 *
 * The page gets the integrated (low-power) GPU on a machine with two, a CPU
 * slowed CPU× (default 3, roughly an entry-level laptop next to a current
 * high-end one), a 1366 × 768 window, and reports four threads and 4 GB of
 * memory, so it takes the low-spec start. It records when the scene appeared,
 * the frame rate every 2 s through the intro, when the quality governor
 * stepped down, the frame rate and worst frame during each interaction, and
 * the slowest input-to-next-frame delay (Event Timing). Set W and H for
 * another window size, CPU for another slowdown, CHROME_PATH as needed.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BROWSERS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const executablePath = BROWSERS.find((p) => existsSync(p));
if (!executablePath) throw new Error('No Chrome or Edge found. Set CHROME_PATH.');

const CPU = Number(process.env.CPU) || 3;
const W = Number(process.env.W) || 1366,
  H = Number(process.env.H) || 768;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = await preview({ root: ROOT, preview: { port: 4191, strictPort: false }, logLevel: 'warn' });
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=default', '--force_low_power_gpu'],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H });
await page.evaluateOnNewDocument(() => {
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 4 });
  // Frame timestamps and input delays, from navigation on.
  globalThis.__frames = [];
  const raf = globalThis.requestAnimationFrame.bind(globalThis);
  const tick = (t) => {
    globalThis.__frames.push(t);
    raf(tick);
  };
  raf(tick);
  globalThis.__events = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries())
      globalThis.__events.push([e.name, Math.round(e.duration), Math.round(e.processingStart - e.startTime)]);
  }).observe({ type: 'event', durationThreshold: 16, buffered: true });
});
const cdp = await page.createCDPSession();
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
const steps = [];
page.on(
  'console',
  (m) => /quality step/.test(m.text()) && steps.push([Date.now(), m.text().replace('[perf] quality ', '')]),
);
await page.goto(`${server.resolvedUrls.local[0]}?debug`, { waitUntil: 'load' });
await page.waitForSelector('#veil.is-off', { timeout: 120000 });
const veil = await page.evaluate(() => performance.now());
const veilAt = Date.now();
console.log(`CPU ${CPU}× · ${W}×${H} · scene on screen ${(veil / 1000).toFixed(1)} s`);

// Frames per second, measured from page frame timestamps in a window [a, b) ms after navigation.
const fpsIn = (a, b) =>
  page.evaluate((a, b) => globalThis.__frames.filter((t) => t >= a && t < b).length / ((b - a) / 1000), a, b);
await sleep(20000);
const line = [];
for (let s = 0; s < 20; s += 2) line.push((await fpsIn(veil + s * 1000, veil + (s + 2) * 1000)).toFixed(0));
console.log('fps each 2 s after the scene appears:', line.join(' '));
console.log(
  'quality steps (s after the scene appeared):',
  steps.map(([t, s]) => `${s} at ${((t - veilAt) / 1000).toFixed(1)}`).join(', ') || 'none',
);

const measure = async (label, fn, ms = 4000) => {
  const a = await page.evaluate(() => performance.now());
  await fn();
  await sleep(ms);
  const b = await page.evaluate(() => performance.now());
  const fps = await fpsIn(a, b);
  const gaps = await page.evaluate(
    (a, b) => {
      const f = globalThis.__frames.filter((t) => t >= a && t < b);
      let worst = 0;
      for (let i = 1; i < f.length; i++) worst = Math.max(worst, f[i] - f[i - 1]);
      return worst;
    },
    a,
    b,
  );
  console.log(`${label}: ${fps.toFixed(0)} fps, worst frame ${gaps.toFixed(0)} ms`);
};
await page.mouse.move(W / 2, H / 2);
await measure('drag to untwist', async () => {
  await page.mouse.down();
  for (let i = 0; i < 30; i++) {
    await page.mouse.move(W / 2 + i * 12, H / 2, { steps: 2 });
  }
  await page.mouse.up();
});
await measure('season change (S)', () => page.keyboard.press('s'));
await measure('snow on', () => page.click('#rainBtn'), 6000);
await measure('drone flight (scroll)', () =>
  page.evaluate(() => globalThis.scrollTo({ top: globalThis.document.documentElement.scrollHeight })),
);
await measure('back down', () => page.evaluate(() => globalThis.scrollTo({ top: 0 })));
await measure('click a window', () => page.mouse.click(W * 0.5, H * 0.35));
await measure('pause/play (Space)', () => page.keyboard.press('Space'), 2000);
const ev = await page.evaluate(() => globalThis.__events);
const worst = {};
for (const [n, d, delay] of ev) if (!worst[n] || worst[n][0] < d) worst[n] = [d, delay];
console.log(
  'slowest input → next frame (ms, of which waiting to start):',
  Object.entries(worst)
    .filter(([n]) => /pointerdown|pointerup|click|keydown|keyup/.test(n))
    .map(([n, [d, w]]) => `${n} ${d} (${w})`)
    .join(' · ') || 'all under 16 ms',
);
console.log(`elapsed since scene appeared: ${((Date.now() - veilAt) / 1000).toFixed(0)} s`);
await browser.close();
await server.close();
