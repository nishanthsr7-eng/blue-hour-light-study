/* The study is desktop only: a viewport of at least 1024 × 540 CSS pixels and
   a mouse or trackpad. Below that, or where touch is the only pointer, the
   scene is never loaded (main.js), stops drawing if the window shrinks into
   it (loop.js), and the page shows only the notice in index.html. The same
   query is repeated in main.css (CSS cannot import it) and read by
   vite.config.js, which preloads the scene's chunks only on a desktop. */
export const NOT_DESKTOP = '(max-width: 1023.98px), (max-height: 539.98px), (hover: none) and (pointer: coarse)';
