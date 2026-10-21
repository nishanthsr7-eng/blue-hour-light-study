/* Entry point. Loads the stylesheet, checks for WebGL 2, then starts the
   scene (app.js imports it step by step). vite.config.js preloads every
   chunk from the HTML, so nothing waits on this file to be discovered. */
import './styles/main.css';

const veil = document.getElementById('veil');
const step = document.getElementById('veilStep');

function fail(message) {
  veil.classList.add('is-error');
  step.textContent = message;
}

const WEBGL_MESSAGE =
  'This light study needs WebGL 2. Open it in a recent Chrome, Edge, Firefox or Safari on a laptop or desktop.';

function start() {
  import('./app.js').catch((err) => {
    console.error(err);
    fail(
      /webgl/i.test(String(err?.message))
        ? WEBGL_MESSAGE
        : 'The scene could not load. Check your connection and reload the page.',
    );
  });
}

// The study is built for desktop: a mouse or trackpad, a keyboard and a laptop
// GPU. On a phone or tablet (touch is the only pointer), say so before any
// texture or shader work starts, and leave the choice to load it anyway.
function desktopOnly() {
  veil.classList.add('is-error', 'is-desktop-only');
  step.textContent = 'Blue Hour is a desktop study. Open it on a laptop or desktop for the full scene.';
  const anyway = document.createElement('button');
  anyway.type = 'button';
  anyway.className = 'veil__anyway';
  anyway.textContent = 'Load anyway';
  anyway.addEventListener('click', () => {
    anyway.remove();
    veil.classList.remove('is-error', 'is-desktop-only');
    step.textContent = 'Painting surfaces';
    start();
  });
  step.after(anyway);
}

// A cheap check first; a GPU that is present but blocklisted fails later,
// when three.js creates its context, and lands in the catch in start().
if (typeof WebGL2RenderingContext === 'undefined') {
  fail(WEBGL_MESSAGE);
} else if (matchMedia('(hover: none) and (pointer: coarse)').matches) {
  desktopOnly();
} else {
  start();
}
