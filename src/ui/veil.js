/* The loading screen: a hairline that tracks the real work and one status
   line. Painting surfaces fills the first 30%, the warm-up in app.js the rest. */
const veilBar = document.getElementById('veilBar'),
  veilStep = document.getElementById('veilStep');

export function loadProgress(f, step) {
  veilBar.style.transform = `scaleX(${f.toFixed(3)})`;
  if (step && veilStep.textContent !== step) veilStep.textContent = step;
}
