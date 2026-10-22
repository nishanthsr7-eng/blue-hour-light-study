/* Entry point. Loads the stylesheet, checks for WebGL 2 and a desktop-sized
   window, then starts the scene (app.js imports it step by step).
   vite.config.js preloads every chunk from the HTML on a desktop, so nothing
   waits on this file to be discovered. */
import './styles/main.css';
import { NOT_DESKTOP } from './core/desktop.js';

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

// Below desktop size, or on a touch-only device, nothing loads: the page shows
// only its desktop notice (main.css). If a small desktop window is enlarged,
// the scene starts then.
const small = matchMedia(NOT_DESKTOP);
if (typeof WebGL2RenderingContext === 'undefined') {
  // A cheap check first; a GPU that is present but blocklisted fails later,
  // when three.js creates its context, and lands in the catch in start().
  fail(WEBGL_MESSAGE);
} else if (small.matches) {
  small.addEventListener('change', function grown() {
    if (small.matches) return;
    small.removeEventListener('change', grown);
    start();
  });
} else {
  start();
}
