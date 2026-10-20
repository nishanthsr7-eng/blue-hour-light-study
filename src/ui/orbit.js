import * as THREE from 'three';
import { REDUCED } from '../core/util.js';
import { UI_SEL } from '../study/windows.js';

// Orbit: Shift-drag or right-drag swings the camera round the tower, held
// within ±30° of the flight path and eased; double-click centres it again.
const ORBIT_LIMIT = 0.52;
export let orbitDrag = null,
  orbitTarget = 0,
  orbitYaw = 0;
addEventListener('contextmenu', (e) => {
  if (!e.target.closest(UI_SEL)) e.preventDefault();
});
addEventListener('pointerdown', (e) => {
  if (!(e.button === 2 || (e.button === 0 && e.shiftKey)) || e.target.closest(UI_SEL)) return;
  orbitDrag = { x: e.clientX, id: e.pointerId, from: orbitTarget };
  document.body.classList.add('is-dragging');
});
addEventListener('pointermove', (e) => {
  if (orbitDrag?.id !== e.pointerId) return;
  orbitTarget = THREE.MathUtils.clamp(
    orbitDrag.from - ((e.clientX - orbitDrag.x) / innerWidth) * 1.6,
    -ORBIT_LIMIT,
    ORBIT_LIMIT,
  );
});
const endOrbit = () => {
  if (orbitDrag) {
    orbitDrag = null;
    document.body.classList.remove('is-dragging');
  }
};
addEventListener('pointerup', endOrbit);
addEventListener('pointercancel', endOrbit);
addEventListener('dblclick', (e) => {
  if (!e.target.closest(UI_SEL)) orbitTarget = 0;
});
export function orbitStep(dt) {
  orbitYaw += (orbitTarget - orbitYaw) * (REDUCED ? 1 : 1 - Math.exp(-dt * 5));
  return Math.abs(orbitTarget - orbitYaw) > 1e-4;
}
