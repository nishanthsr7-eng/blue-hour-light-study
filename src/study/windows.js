import * as THREE from 'three';
import { camera } from '../core/scene.js';
import { building } from '../world/kit.js';
import { ROOM_SHELLS, toggleZone } from './light-study.js';

/* ════════════════════════════════════════════════════════════════════════
   Click a window: switch that floor's lights
   ════════════════════════════════════════════════════════════════════════ */

/* A click (not a drag) on a floor's glass toggles its zone (toggleZone). The
   click test runs against everything opaque, so a slab or planter in front
   blocks it; hovering only tests the traced rooms, which is cheap enough to
   run on every pointer move. */
export const UI_SEL = 'a, button, .rail, .timebar, .toggles, .keys';
const pickRay = new THREE.Raycaster(),
  pickNdc = new THREE.Vector2();
const aimAt = (e) => {
  pickNdc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  pickRay.setFromCamera(pickNdc, camera);
};
let press = null,
  hoverQueued = null;
addEventListener('pointerdown', (e) => {
  press =
    e.button === 0 && !e.shiftKey && !e.target.closest(UI_SEL)
      ? { x: e.clientX, y: e.clientY, t: performance.now() }
      : null;
});
addEventListener('pointerup', (e) => {
  if (!press || Math.hypot(e.clientX - press.x, e.clientY - press.y) > 5 || performance.now() - press.t > 400) {
    press = null;
    return;
  }
  press = null;
  aimAt(e);
  // Forgiving by 3.5 m (the slab overhang): a click on a mullion, spandrel or slab edge in front of a room counts.
  const room = pickRay.intersectObjects(ROOM_SHELLS, false)[0];
  if (!room) return;
  // Only what lies in front of the room can block it: meshes wholly behind are skipped.
  pickRay.far = room.distance + 3.5;
  const block = pickRay
    .intersectObject(building, true)
    .find((h) => h.object.visible && !h.object.material.transparent && h.object.userData.zone == null);
  pickRay.far = Infinity;
  if (!block || room.distance < block.distance + 3.5) toggleZone(room.object.userData.zone);
});
addEventListener('pointermove', (e) => {
  if (e.buttons || hoverQueued) return;
  hoverQueued = e;
  requestAnimationFrame(() => {
    aimAt(hoverQueued);
    hoverQueued = null;
    document.body.classList.toggle('is-window', pickRay.intersectObjects(ROOM_SHELLS, false).length > 0);
  });
});
