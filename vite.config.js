import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import { NOT_DESKTOP } from './src/core/desktop.js';

// The public address, used for the canonical link, Open Graph tags,
// robots.txt and sitemap.xml. Override with SITE_URL=https://… npm run build.
const SITE_URL = (process.env.SITE_URL || 'https://blue-hour-light-study.pages.dev').replace(/\/+$/, '');

/** Fills %SITE_URL% in index.html and writes robots.txt and sitemap.xml. */
function site() {
  return {
    name: 'blue-hour:site',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', SITE_URL),
    generateBundle() {
      const today = new Date().toISOString().slice(0, 10);
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${today}</lastmod>
  </url>
</urlset>
`,
      });
    },
  };
}

/**
 * Starts every late-discovered download with the HTML. app.js imports the
 * scene one module (one chunk) at a time, so without hints each chunk would
 * wait for the one before it; the font is otherwise found only once the
 * stylesheet is parsed. All file names carry Vite's content hash. The chunk
 * hints are written by a small inline script, only on a desktop-sized window
 * (src/core/desktop.js): a phone downloads none of the scene. The CSP
 * allows no inline script, so its hash is added to dist/_headers.
 */
function preloads() {
  let gate = '';
  return {
    name: 'blue-hour:preloads',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, { bundle }) {
        const files = Object.values(bundle ?? {});
        const chunks = files
          .filter((f) => f.type === 'chunk' && !f.isEntry && !html.includes(f.fileName))
          .sort((a, b) => b.code.length - a.code.length); // three.js first: the longest download
        const font = files.find((f) => f.type === 'asset' && /inter-latin-var.*\.woff2$/.test(f.fileName));
        const hrefs = JSON.stringify(chunks.map((c) => `/${c.fileName}`));
        gate =
          `if (!matchMedia(${JSON.stringify(NOT_DESKTOP)}).matches) for (const href of ${hrefs}) ` +
          `document.head.append(Object.assign(document.createElement('link'), { rel: 'modulepreload', crossOrigin: '', href }));`;
        const tags = [{ tag: 'script', children: gate }];
        if (font) {
          tags.unshift({
            tag: 'link',
            attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: '', href: `/${font.fileName}` },
          });
        }
        return { html, tags: tags.map((t) => ({ ...t, injectTo: 'head' })) };
      },
    },
    writeBundle({ dir }) {
      const file = path.join(dir, '_headers');
      const hash = createHash('sha256').update(gate).digest('base64');
      writeFileSync(
        file,
        readFileSync(file, 'utf8').replace("script-src 'self'", `script-src 'self' 'sha256-${hash}'`),
      );
    },
  };
}

/**
 * Inlines the stylesheet (~10 KB) into index.html: the first paint then
 * needs no second request, and the CSS is versioned with the page anyway.
 */
function inlineCss() {
  return {
    name: 'blue-hour:inline-css',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const html = bundle['index.html'];
      for (const [name, file] of Object.entries(bundle)) {
        if (file.type !== 'asset' || !name.endsWith('.css')) continue;
        const link = new RegExp(`<link rel="stylesheet"[^>]*href="/${name}"[^>]*>`);
        if (!link.test(html.source)) continue;
        html.source = html.source.replace(link, () => `<style>${String(file.source).trim()}</style>`);
        delete bundle[name];
      }
    },
  };
}

export default defineConfig({
  plugins: [site(), preloads(), inlineCss()],
  // The texture bake workers are ES modules (textures/bake.worker.js).
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    // three.js is one ~690 KB chunk (~180 KB gzipped); everything else is small.
    chunkSizeWarningLimit: 750,
    // Textures, the font and the sound stay separate, cacheable files.
    assetsInlineLimit: 0,
    // The desktop gate is shared by main.js and the frame loop. In its own chunk,
    // no scene chunk depends on the entry chunk, so none lists the entry's
    // stylesheet (inlined, so never a file) as a dependency to wait on: WebKit
    // and Firefox fail a dynamic import whose stylesheet will not load.
    rollupOptions: { output: { manualChunks: (id) => (id.endsWith('/core/desktop.js') ? 'desktop' : undefined) } },
    // Public repo, public maps: readable stack traces in production.
    sourcemap: true,
  },
});
