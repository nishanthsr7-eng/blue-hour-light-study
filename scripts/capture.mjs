/**
 * Captures the Open Graph image, the README screenshots and the phone
 * notice's backdrop from the production build, in a real Chromium (Chrome or
 * Edge) with the GPU on.
 *
 *   npm run build && npm run capture
 *
 * Set CHROME_PATH if your browser is not in a standard location. Writes
 * public/og-image.jpg (1200 × 630), docs/media/*.jpg (1600 × 900) and the
 * loading screen's backdrop, src/assets/veil-poster.webp: the scene's very
 * first frame at blue hour, shrunk to 96 × 54 and softened (about 1.5 KB,
 * inlined into the page by vite.config.js). The phone backdrop,
 * src/assets/phone-poster.webp, is the whole tower lit at night in portrait
 * (1080 × 2340), shown behind the desktop-only notice on touch devices.
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
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
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/microsoft-edge',
].filter(Boolean);

// [file, width, height, what to do before the shot]
const SHOTS = [
  ['public/og-image.jpg', 1200, 630, async () => {}],
  ['docs/media/arrival.jpg', 1600, 900, async () => {}],
  ['docs/media/flight.jpg', 1600, 900, async (page) => scrollTo(page, 0.45)],
  ['docs/media/crown.jpg', 1600, 900, async (page) => scrollTo(page, 1)],
  [
    'docs/media/winter.jpg',
    1600,
    900,
    async (page) => {
      await page.keyboard.press('s'); // autumn → winter
      await page.click('#rainBtn'); // snow, in winter
      await sleep(9000); // the snow settles over the lawn
    },
  ],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function scrollTo(page, u) {
  // Runs in the page, hence globalThis.
  await page.evaluate((f) => {
    const { document: d, innerHeight: h } = globalThis;
    globalThis.scrollTo({ top: f * (d.documentElement.scrollHeight - h) });
  }, u);
  await sleep(4000); // the drone eases after the scroll
}

const executablePath = BROWSERS.find((p) => existsSync(p));
if (!executablePath) throw new Error('No Chrome or Edge found. Set CHROME_PATH.');

const server = await preview({ root: ROOT, preview: { port: 4173, strictPort: false }, logLevel: 'warn' });
const url = server.resolvedUrls.local[0];
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=default', '--hide-scrollbars'],
});
try {
  {
    // The first frame the visitor sees once the veil lifts, drawn small and soft.
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
    await page.goto(`${url}?debug`, { waitUntil: 'load' });
    await page.waitForSelector('#veil.is-off', { timeout: 60000 });
    const dataUrl = await page.evaluate(() => {
      const { composer, renderer } = globalThis.blueHour;
      composer.render(); // read the drawing buffer in the same task, before it is cleared
      const c = globalThis.document.createElement('canvas');
      c.width = 96;
      c.height = 54;
      const g = c.getContext('2d');
      g.filter = 'blur(2px)';
      g.drawImage(renderer.domElement, -4, -4, 104, 62); // overscan hides the blur's soft edge
      return c.toDataURL('image/webp', 0.9);
    });
    await writeFile(path.join(ROOT, 'src/assets/veil-poster.webp'), Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log('  src/assets/veil-poster.webp');
    await page.close();
  }
  {
    // The desktop-only notice's backdrop: the whole tower, portrait, no interface.
    const page = await browser.newPage();
    await page.setViewport({ width: 540, height: 1170, deviceScaleFactor: 2 });
    await page.goto(`${url}?view=tower`, { waitUntil: 'load' });
    await page.waitForSelector('#veil.is-off', { timeout: 60000 });
    await sleep(8000); // the house lights up
    await page.addStyleTag({ content: 'body > *:not(#gl) { visibility: hidden !important; }' });
    await sleep(500);
    await page.screenshot({ path: path.join(ROOT, 'src/assets/phone-poster.webp'), type: 'webp', quality: 72 });
    console.log('  src/assets/phone-poster.webp');
    await page.close();
  }
  for (const [file, width, height, prepare] of SHOTS) {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForSelector('#veil.is-off', { timeout: 60000 });
    await sleep(6500); // blue hour turns to night and the interface arrives
    await prepare(page);
    await page.mouse.move(width / 2, height / 2);
    const out = path.join(ROOT, file);
    await mkdir(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out, type: 'jpeg', quality: 86 });
    console.log(`  ${file}`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
