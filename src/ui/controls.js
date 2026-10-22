import { state } from '../core/state.js';
import { sound } from '../study/audio.js';
import { setSeason } from '../study/seasons.js';

// The hint row leaves after 6 s, or as soon as the visitor does any of it.
const hintsEl = document.getElementById('hints');
const hideHints = () => hintsEl.classList.add('is-off');
setTimeout(hideHints, 6000);
// The full list stays one click (or '?') away once the hint row has gone.
const keysEl = document.getElementById('keys'),
  keysBtn = document.getElementById('keysBtn');
const showKeys = (v) => {
  keysEl.hidden = !v;
  keysBtn.setAttribute('aria-expanded', v);
};
keysBtn.addEventListener('click', () => showKeys(keysEl.hidden));
addEventListener('keydown', (e) => {
  if (e.key === '?') showKeys(keysEl.hidden);
  else if (e.key === 'Escape') showKeys(false);
});
addEventListener('pointerdown', (e) => {
  if (!keysEl.hidden && !e.target.closest('.keys, #keysBtn')) showKeys(false);
});
for (const ev of ['pointerdown', 'keydown', 'wheel']) addEventListener(ev, hideHints, { once: true, passive: true });

const soundBtn = document.getElementById('soundBtn');
soundBtn.addEventListener('click', () => {
  soundBtn.setAttribute('aria-pressed', sound.toggle());
  state.lightDirty = true;
});
// Sound is on by default, but browsers only allow audio after a click, tap or key
// (a scroll does not count), so it starts on the first one. A first press of Sound
// or Mute is left to that control, so it never plays a blip before going quiet.
const GESTURES = ['pointerdown', 'keydown', 'touchend'];
const soundOnFirstGesture = (e) => {
  if (e.target.closest?.('#soundBtn, #muteBtn') || e.key === 'm' || e.key === 'M') return;
  if (!sound.unlock()) return;
  for (const ev of GESTURES) removeEventListener(ev, soundOnFirstGesture);
  state.lightDirty = true;
};
for (const ev of GESTURES) addEventListener(ev, soundOnFirstGesture, { passive: true });
const muteBtn = document.getElementById('muteBtn');
const toggleMute = () =>
  muteBtn.setAttribute('aria-pressed', sound.mute(muteBtn.getAttribute('aria-pressed') !== 'true'));
muteBtn.addEventListener('click', toggleMute);

/* Light pattern (P): the house's routine hands the ten floors to a slow wave
   that climbs the facade. Reduced motion holds a still alternating pattern. */
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 's' || e.key === 'S') setSeason(state.seasonIndex + 1);
  else if (e.key === 'm' || e.key === 'M') toggleMute();
  else if (e.key === 'p' || e.key === 'P') {
    state.pattern = !state.pattern;
    state.lightDirty = true;
  }
});
