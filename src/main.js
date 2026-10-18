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

// A cheap check first; a GPU that is present but blocklisted fails later,
// when three.js creates its context, and lands in the catch below.
if (typeof WebGL2RenderingContext === 'undefined') {
  fail(WEBGL_MESSAGE);
} else {
  import('./app.js').catch((err) => {
    console.error(err);
    fail(
      /webgl/i.test(String(err?.message))
        ? WEBGL_MESSAGE
        : 'The scene could not load. Check your connection and reload the page.',
    );
  });
}
