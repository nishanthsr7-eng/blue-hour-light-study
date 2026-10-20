import { state } from '../core/state.js';

/* Sound, off until asked for: everything is synthesised with Web Audio (no
   files). A low night bed, rain hiss when it rains, and a soft click and
   hum as each level switches on, pitched up the tower; the beacon pings. */
export const sound = (() => {
  let ctx = null,
    master = null,
    rainGain = null,
    windGain = null,
    cricketGain = null,
    buf = null,
    on = false,
    muted = false,
    wantRain = false;
  const layers = []; // one quiet sustained tone per zone, swelling as that zone lights
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
    master.connect(ctx.destination);
    buf = noiseBuf(ctx);
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
    loop('lowpass', 320, 0.4, 0.22); // the night: distant air and the valley's hum
    rainGain = loop('bandpass', 2600, 0.5, 0); // rain on stone and glass
    rainGain.gain.value = wantRain ? 0.16 : 0;
    // Floor ambience: each lit floor adds a soft detuned pair on the same pentatonic climb,
    // so a full tower is a chord and a dark one is just the night.
    for (let k = 0; k < 12; k++) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(master);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      lp.connect(g);
      for (const d of [-4, 4]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = 110 * Math.pow(2, HUM[k] / 12);
        o.detune.value = d;
        o.connect(lp);
        o.start();
      }
      layers.push(g);
    }
    // Season beds: wind (cold and rising in winter, a rustle in autumn) and summer/spring crickets.
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
    const cr = ctx.createOscillator();
    cr.frequency.value = 4300;
    const trill = ctx.createGain();
    trill.gain.value = 0.5;
    const tr = ctx.createOscillator();
    tr.type = 'square';
    tr.frequency.value = 27;
    const trG = ctx.createGain();
    trG.gain.value = 0.5;
    tr.connect(trG).connect(trill.gain);
    const chirp = ctx.createGain();
    chirp.gain.value = 0.5;
    const ch = ctx.createOscillator();
    ch.type = 'square';
    ch.frequency.value = 1.3;
    const chG = ctx.createGain();
    chG.gain.value = 0.5;
    ch.connect(chG).connect(chirp.gain);
    cricketGain = ctx.createGain();
    cricketGain.gain.value = 0;
    cr.connect(trill).connect(chirp).connect(cricketGain).connect(master);
    cr.start();
    tr.start();
    ch.start();
    this.season(state.season);
  }
  const api = {
    season(S) {
      if (!ctx || !S.name) return;
      windGain.gain.setTargetAtTime(S.wind, ctx.currentTime, 1.2);
      cricketGain.gain.setTargetAtTime(S.crickets, ctx.currentTime, 1.2);
    },
    toggle() {
      on = !on;
      if (on && !ctx) init.call(api);
      if (!ctx) return on;
      if (on) ctx.resume();
      master.gain.setTargetAtTime(level(), ctx.currentTime, 0.4);
      return on;
    },
    // Mute silences everything at once, whatever Sound is set to, and remembers both.
    mute(v) {
      muted = v;
      if (ctx) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.08);
      return muted;
    },
    zones(lit) {
      // lit(k): is zone k lit now (isLit in light-study.js)
      if (!ctx || !on) return;
      for (let k = 0; k < 12; k++) layers[k].gain.setTargetAtTime(lit(k) ? 0.012 : 0, ctx.currentTime, 0.6);
    },
    rain(v) {
      wantRain = v;
      if (rainGain && ctx) rainGain.gain.setTargetAtTime(v ? 0.16 : 0, ctx.currentTime, 0.8);
    },
    off() {
      if (!on || muted || !ctx) return;
      const t = ctx.currentTime,
        n = ctx.createBufferSource();
      n.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2200;
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.12, t);
      cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
      n.connect(hp).connect(cg).connect(master);
      n.start(t, Math.random());
      n.stop(t + 0.04);
    },
    level(k) {
      if (!on || muted || !ctx) return;
      const t = ctx.currentTime;
      // Click: a 25 ms burst of high noise, like a relay closing.
      const n = ctx.createBufferSource();
      n.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 3000;
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.18, t);
      cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
      n.connect(hp).connect(cg).connect(master);
      n.start(t, Math.random());
      n.stop(t + 0.05);
      // Hum: a soft sine that blooms and fades, a step higher each level; the beacon pings.
      const o = ctx.createOscillator(),
        og = ctx.createGain(),
        beacon = k === 12;
      o.type = 'sine';
      o.frequency.value = beacon ? 880 : 110 * Math.pow(2, HUM[k] / 12);
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(beacon ? 0.05 : 0.07, t + 0.04);
      og.gain.exponentialRampToValueAtTime(0.0001, t + (beacon ? 1.4 : 0.9));
      o.connect(og).connect(master);
      o.start(t);
      o.stop(t + 1.5);
    },
  };
  return api;
})();
