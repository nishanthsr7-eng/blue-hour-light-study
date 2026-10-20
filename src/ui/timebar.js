import * as THREE from 'three';
import { clamp01 } from '../core/util.js';
import { ov, roomOnTarget, SEQ, seq } from '../study/light-study.js';

/* ════════════════════════════════════════════════════════════════════════
   Interaction: time bar, orbit, rain, sound
   ════════════════════════════════════════════════════════════════════════ */

// Time bar: the light timeline as a scrubbable track, 18:56 → 00:40, marked at 19:42 where it holds.
const tbEl = document.getElementById('timebar'),
  tbTrack = tbEl.querySelector('.tb__track'),
  tbFill = tbEl.querySelector('.tb__fill');
const playBtn = document.getElementById('playBtn');
export let scrub = null;
const scrubTo = (x) => {
  const r = tbTrack.getBoundingClientRect();
  seq.t = clamp01((x - r.left) / r.width) * SEQ.last;
  seq.hold = false;
};
tbEl.style.setProperty('--m', (SEQ.end / SEQ.last).toFixed(4));
tbTrack.addEventListener('pointerdown', (e) => {
  scrub = { id: e.pointerId, was: seq.playing };
  seq.playing = false;
  tbTrack.setPointerCapture(e.pointerId);
  scrubTo(e.clientX);
  e.stopPropagation();
});
tbTrack.addEventListener('pointermove', (e) => {
  if (scrub?.id === e.pointerId) scrubTo(e.clientX);
});
const endScrub = () => {
  if (!scrub) return;
  seq.playing = scrub.was && seq.t < SEQ.last;
  scrub = null;
};
tbTrack.addEventListener('pointerup', endScrub);
tbTrack.addEventListener('pointercancel', endScrub);
tbTrack.addEventListener('keydown', (e) => {
  const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
  if (!d) return;
  e.preventDefault();
  e.stopPropagation();
  seq.playing = false;
  seq.t = THREE.MathUtils.clamp(seq.t + d * (seq.t < SEQ.end ? 0.4 : 1.3), 0, SEQ.last);
});
playBtn.addEventListener('click', () => togglePlay());
function togglePlay() {
  if (!seq.playing && seq.t >= SEQ.last) {
    seq.t = 0;
    seq.hold = true;
    ov.fill(null);
    roomOnTarget.fill(0);
  }
  seq.playing = !seq.playing;
}
addEventListener('keydown', (e) => {
  if (e.key === ' ' && !e.target.closest?.('button')) {
    e.preventDefault();
    togglePlay();
  }
});
let tbShown = -1;
export function updateTimebar() {
  const f = seq.t / SEQ.last;
  if (Math.abs(f - tbShown) > 1e-4) {
    tbShown = f;
    tbFill.style.transform = `scaleX(${f.toFixed(4)})`;
    tbEl.style.setProperty('--f', f.toFixed(4));
    tbTrack.setAttribute('aria-valuenow', Math.round(f * 100));
  }
  const icon = seq.playing ? 'pause' : 'play';
  if (playBtn.dataset.icon !== icon) {
    playBtn.dataset.icon = icon;
    playBtn.setAttribute('aria-label', icon === 'pause' ? 'Pause' : 'Play');
  }
}
