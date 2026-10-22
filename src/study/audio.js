import { state } from '../core/state.js';
import ambienceUrl from '../assets/night-ambience.mp3';

/* Sound, on by default but silent until the visitor's first click or key
   (browsers allow audio only after a gesture; see unlock()), and built only
   once it can be heard: opening the audio device and the reverb costs about
   100 ms of main thread, which a muted visitor never pays. The bed is a
   looping field recording of a meadow at night (BigSoundBank #1880, CC0);
   rain hiss, the season's wind and a soft chime as each level switches on,
   pitched up the tower, are synthesised with Web Audio and sent through a
   long hall reverb; the beacon rings a high bell. */
export const sound = (() => {
  let ctx = null,
    master = null,
    rainGain = null,
    windGain = null,
    buf = null,
    verb = null,
    on = true, // the visitor's choice; nothing plays until unlock() or toggle() runs in a gesture
    muted = true, // muted by default for now; the Mute button unmutes
    wantRain = false;
  const level = () => (on && !muted ? 0.5 : 0);
  const HUM = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26]; // a pentatonic climb, lobby → penthouse
  const noiseBuf = (c) => {
    const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate),
      d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = w * 0.5 + last * 3;
    }
    return b;
  };
  function init() {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0;
    master.gain.setTargetAtTime(level(), ctx.currentTime, 0.4);
    master.connect(ctx.destination);
    buf = noiseBuf(ctx);
    // Reverb: a synthetic 4 s decaying-noise impulse, so chimes bloom into the night.
    const len = ctx.sampleRate * 4,
      ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    verb = ctx.createGain();
    verb.gain.value = 0.5;
    verb.connect(conv).connect(master);
    const loop = (type, f, q, g) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const bf = ctx.createBiquadFilter();
      bf.type = type;
      bf.frequency.value = f;
      bf.Q.value = q;
      const gn = ctx.createGain();
      gn.gain.value = g;
      src.connect(bf).connect(gn).connect(master);
      src.start();
      return gn;
    };
    // The night: a 75-second loop of a CC0 field recording, crickets and distant frogs, faded in once decoded.
    fetch(ambienceUrl)
      .then((r) => r.arrayBuffer())
      .then((a) => ctx.decodeAudioData(a))
      .then((b) => {
        const src = ctx.createBufferSource(),
          g = ctx.createGain();
        src.buffer = b;
        src.loop = true;
        // Low-pass well under the crickets' 4–5 kHz chirp, so they sit far off in the field.
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1600;
        lp.Q.value = 0.5;
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 4);
        src.connect(lp).connect(g).connect(master);
        src.start();
      })
      .catch(() => {}); // no recording: chimes, wind and rain only
    rainGain = loop('bandpass', 2600, 0.5, 0); // rain on stone and glass
    rainGain.gain.value = wantRain ? 0.16 : 0;
    // Season bed: wind (cold and rising in winter, a rustle in autumn).
    windGain = loop('lowpass', 460, 0.7, 0);
    const lfo = ctx.createOscillator(),
      lfoG = ctx.createGain();
    lfo.frequency.value = 0.09;
    lfoG.gain.value = 0.5;
    const swell = ctx.createGain();
    swell.gain.value = 0.6;
    lfo.connect(lfoG).connect(swell.gain);
    lfo.start();
    windGain.disconnect();
    windGain.connect(swell).connect(master);
    this.season(state.season);
  }
  // A bell-like tone: sine fundamental plus a faint octave, slow attack, long decay, half to the reverb.
  function chime(f, peak, dur) {
    const t = ctx.currentTime,
      g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(master);
    g.connect(verb);
    for (const [m, a] of [
      [1, 1],
      [2, 0.25],
    ]) {
      const o = ctx.createOscillator(),
        og = ctx.createGain();
      o.frequency.value = f * m;
      og.gain.value = a;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }
  const api = {
    season(S) {
      if (!ctx || !S.name) return;
      windGain.gain.setTargetAtTime(S.wind, ctx.currentTime, 1.2);
    },
    toggle() {
      on = !on;
      if (on)
        api.unlock(); // a click on Sound is itself a gesture
      else if (ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      return on;
    },
    // Start (or resume) the audio if Sound is on and not muted; call only from
    // a user gesture. Returns true once audio is running.
    unlock() {
      if (!on || muted) return false;
      if (!ctx) init.call(api);
      else master.gain.setTargetAtTime(level(), ctx.currentTime, 0.4);
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    },
    // Mute silences everything at once, whatever Sound is set to, and remembers both.
    mute(v) {
      muted = v;
      if (!muted)
        api.unlock(); // Mute and M are themselves gestures
      else if (ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
      return muted;
    },
    // Suspend the audio while the page is hidden below desktop size, and resume it after.
    hold(v) {
      if (ctx && v) ctx.suspend();
      else if (ctx) ctx.resume();
    },
    rain(v) {
      wantRain = v;
      if (rainGain && ctx) rainGain.gain.setTargetAtTime(v ? 0.16 : 0, ctx.currentTime, 0.8);
    },
    off() {
      // A level going dark: a low, quiet note that sinks into the reverb.
      if (!on || muted || !ctx) return;
      chime(110, 0.012, 1.6);
    },
    level(k) {
      // A soft chime a step higher each level; the beacon rings an octave bell.
      if (!on || muted || !ctx) return;
      if (k === 12) chime(880, 0.018, 4);
      else chime(220 * Math.pow(2, HUM[k] / 12), 0.022, 2.6);
    },
  };
  return api;
})();
