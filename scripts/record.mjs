/**
 * Records the season loop for the README: the arrival view at night, held for
 * a few seconds in each season, Autumn → Winter → Spring → Summer, as a
 * 1920 × 1080 H.264 MP4 under GitHub's 10 MB upload limit.
 *
 *   npm run build && npm run record
 *
 * Runs the production build in headless Chrome or Edge with the GPU on, so
 * nothing is captured from the screen. The page's clock is virtual
 * (performance.now and requestAnimationFrame are driven from here): every
 * output frame is exactly 1/30 s of scene time, however long the screenshot
 * takes, so the video plays at true speed with no dropped frames. Frames are
 * piped to ffmpeg (on PATH, or FFMPEG_PATH) as PNG into a lossless
 * intermediate, then encoded in two passes at 5 Mb/s.
 *
 * Writes recordings/season-loop.mp4 (git-ignored). Set CHROME_PATH as needed.
 */
import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'recordings/season-loop.mp4');
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const BROWSERS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const W = 1920,
  H = 1080,
  FPS = 30,
  STEPS = 2, // scene frames per output frame: the page runs at 60 Hz, as on a desktop display
  SEASON_S = 3.5, // seconds in each season; four seasons make a 14 s loop
  BITRATE = '5M'; // 14 s × 5 Mb/s ≈ 8.8 MB

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Runs in the page before any script. Until __vt.start(), time is real; after
// it, performance.now() and requestAnimationFrame timestamps come from a clock
// that only moves when __vt.step(ms) is called.
const virtualClock = () => {
  const realNow = performance.now.bind(performance),
    realRaf = globalThis.requestAnimationFrame.bind(globalThis);
  let on = false,
    now = 0,
    queue = [];
  performance.now = () => (on ? now : realNow());
  globalThis.requestAnimationFrame = (cb) => {
    if (on) return queue.push(cb);
    return realRaf((t) => cb(on ? now : t));
  };
  globalThis.__vt = {
    start() {
      now = realNow();
      on = true;
    },
    step(ms) {
      now += ms;
      const q = queue;
      queue = [];
      for (const cb of q) cb(now);
    },
  };
};

function run(args, stdin) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
      stdio: [stdin ? 'pipe' : 'ignore', 'inherit', 'inherit'],
    });
    p.on('error', reject);
    p.on('exit', (code) => (code ? reject(new Error(`ffmpeg exited with ${code}`)) : resolve()));
    if (stdin) stdin(p.stdin);
  });
}

const executablePath = BROWSERS.find((p) => existsSync(p));
if (!executablePath) throw new Error('No Chrome or Edge found. Set CHROME_PATH.');
await mkdir(path.dirname(OUT), { recursive: true });
const raw = path.join(path.dirname(OUT), 'season-loop.lossless.mkv');

const server = await preview({ root: ROOT, preview: { port: 4175, strictPort: false }, logLevel: 'warn' });
const url = server.resolvedUrls.local[0];
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=default', '--hide-scrollbars'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(virtualClock);
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('#veil.is-off', { timeout: 60000 });
  await page.mouse.move(W / 2, H / 2); // the camera leans toward the pointer: keep it centred
  await page.evaluate(() => globalThis.__vt.start());
  await sleep(3000); // the interface fades in (CSS, real time)
  // Fast-forward, unrecorded, through the intro: the house lights up and holds at 19:42.
  const step = (n) =>
    page.evaluate(
      (k, ms) => {
        for (let i = 0; i < k; i++) globalThis.__vt.step(ms);
      },
      n,
      1000 / 60,
    );
  for (let i = 0; i < 16; i++) await step(60);
  await page.evaluate(() => globalThis.document.getElementById('hints').classList.add('is-off'));
  await sleep(1000);

  const cdp = await page.createCDPSession();
  const total = Math.round(4 * SEASON_S * FPS);
  // [frame, what happens]: S moves to the next season; snow falls through winter.
  const cues = new Map([
    [Math.round(SEASON_S * FPS), ['season', 'snow']], // → winter, snowing
    [Math.round(2 * SEASON_S * FPS), ['snow', 'season']], // snow stops, → spring
    [Math.round(3 * SEASON_S * FPS), ['season']], // → summer
  ]);
  // Runs in the page, hence globalThis.
  const act = (acts) => {
    const { document: d, KeyboardEvent: Key } = globalThis;
    for (const a of acts) {
      if (a === 'season') globalThis.dispatchEvent(new Key('keydown', { key: 's' }));
      else d.getElementById('rainBtn').click();
    }
  };
  console.log(`  recording ${total} frames at ${W} × ${H}, ${FPS} fps`);
  await run(
    ['-f', 'image2pipe', '-c:v', 'png', '-framerate', String(FPS), '-i', '-', '-c:v', 'ffv1', '-pix_fmt', 'rgb24', raw],
    async (stdin) => {
      for (let f = 0; f < total; f++) {
        const cue = cues.get(f);
        if (cue) await page.evaluate(act, cue);
        await step(STEPS);
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
        if (!stdin.write(Buffer.from(data, 'base64'))) await new Promise((r) => stdin.once('drain', r));
        if (f % FPS === 0) process.stdout.write(`\r  ${(f / FPS).toFixed(0)} s`);
      }
      stdin.end();
      process.stdout.write('\n');
    },
  );
} finally {
  await browser.close();
  await server.close();
}

// Two-pass H.264, High profile, yuv420p for every browser, moov atom first so it starts at once.
const x264 = ['-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-b:v', BITRATE];
const passlog = path.join(path.dirname(OUT), 'x264-pass');
await run([
  '-i',
  raw,
  ...x264,
  '-pass',
  '1',
  '-passlogfile',
  passlog,
  '-an',
  '-f',
  'mp4',
  process.platform === 'win32' ? 'NUL' : '/dev/null',
]);
await run(['-i', raw, ...x264, '-pass', '2', '-passlogfile', passlog, '-an', '-movflags', '+faststart', OUT]);
for (const f of [raw, `${passlog}-0.log`, `${passlog}-0.log.mbtree`]) await rm(f, { force: true });
console.log(`  ${path.relative(ROOT, OUT)} · ${(statSync(OUT).size / 1e6).toFixed(2)} MB`);
