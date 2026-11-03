// All audio is synthesised with WebAudio: no files to download, no licences to worry about.
import { settings } from './state.svelte';

let ctx: AudioContext | undefined;
let noiseBuf: AudioBuffer | undefined;

function ac() {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function noise(c: AudioContext) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function env(c: AudioContext, g: GainNode, at: number, d: number, vol: number, attack = 0.004) {
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + d);
}

function tone(c: AudioContext, out: AudioNode, f: number, at: number, d: number, type: OscillatorType = 'triangle', vol = 0.12, slide?: number) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, at + d);
  env(c, g, at, d, vol);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + d + 0.05);
}

function burst(c: AudioContext, out: AudioNode, at: number, d: number, freq: number, q = 1, vol = 0.2, type: BiquadFilterType = 'bandpass', sweep?: number) {
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noise(c);
  f.type = type;
  f.frequency.setValueAtTime(freq, at);
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, at + d);
  f.Q.value = q;
  env(c, g, at, d, vol, 0.002);
  s.connect(f).connect(g).connect(out);
  s.start(at, Math.random() * 0.5);
  s.stop(at + d + 0.05);
}

const arp = (c: AudioContext, o: AudioNode, t: number, notes: number[], gap: number, d: number) =>
  notes.forEach((f, i) => tone(c, o, f, t + i * gap, d, 'triangle', 0.1));

const recipes = {
  chip: (c: AudioContext, o: AudioNode, t: number) => { burst(c, o, t, 0.03, 3600, 5, 0.3); burst(c, o, t + 0.035, 0.04, 2900, 5, 0.2); },
  card: (c: AudioContext, o: AudioNode, t: number) => burst(c, o, t, 0.08, 2600, 0.7, 0.25, 'bandpass', 1200),
  shuffle: (c: AudioContext, o: AudioNode, t: number) => {
    for (let i = 0; i < 36; i++) burst(c, o, t + i * 0.022 + Math.random() * 0.006, 0.03, 1600 + Math.random() * 1800, 1.2, 0.13);
    burst(c, o, t + 0.85, 0.14, 900, 0.7, 0.3, 'bandpass', 400);
  },
  tick: (c: AudioContext, o: AudioNode, t: number) => burst(c, o, t, 0.014, 5200, 6, 0.18),
  stop: (c: AudioContext, o: AudioNode, t: number) => tone(c, o, 170, t, 0.14, 'sine', 0.16, 90),
  spin: (c: AudioContext, o: AudioNode, t: number) => burst(c, o, t, 0.4, 500, 0.8, 0.12, 'bandpass', 2400),
  click: (c: AudioContext, o: AudioNode, t: number) => tone(c, o, 1200, t, 0.03, 'square', 0.03),
  win: (c: AudioContext, o: AudioNode, t: number) => arp(c, o, t, [523, 659, 784, 1047], 0.09, 0.3),
  big: (c: AudioContext, o: AudioNode, t: number) => {
    arp(c, o, t, [523, 659, 784, 1047, 1319, 1568], 0.08, 0.45);
    for (let i = 0; i < 8; i++) tone(c, o, 2000 + Math.random() * 2000, t + 0.5 + i * 0.06, 0.12, 'sine', 0.04);
  },
  lose: (c: AudioContext, o: AudioNode, t: number) => { tone(c, o, 220, t, 0.2, 'sine', 0.12); tone(c, o, 165, t + 0.15, 0.32, 'sine', 0.12); },
  cash: (c: AudioContext, o: AudioNode, t: number) => { tone(c, o, 1319, t, 0.12, 'sine', 0.12); tone(c, o, 1760, t + 0.07, 0.35, 'sine', 0.12); },
  gem: (c: AudioContext, o: AudioNode, t: number) => { tone(c, o, 988, t, 0.4, 'sine', 0.1); tone(c, o, 1480, t + 0.04, 0.3, 'sine', 0.06); },
  boom: (c: AudioContext, o: AudioNode, t: number) => { burst(c, o, t, 1.3, 1800, 0.5, 0.6, 'lowpass', 60); tone(c, o, 90, t, 0.8, 'sine', 0.35, 30); },
  hop: (c: AudioContext, o: AudioNode, t: number) => tone(c, o, 420, t, 0.09, 'square', 0.04, 900),
  splat: (c: AudioContext, o: AudioNode, t: number) => { burst(c, o, t, 0.25, 900, 0.6, 0.4, 'lowpass', 120); tone(c, o, 300, t, 0.3, 'sawtooth', 0.06, 60); },
  flip: (c: AudioContext, o: AudioNode, t: number) => { burst(c, o, t, 0.25, 1200, 0.6, 0.12, 'bandpass', 4000); tone(c, o, 2637, t + 0.02, 0.5, 'sine', 0.05); },
  peg: (c: AudioContext, o: AudioNode, t: number) => tone(c, o, 1800 + Math.random() * 900, t, 0.04, 'sine', 0.03),
  scratch: (c: AudioContext, o: AudioNode, t: number) => burst(c, o, t, 0.06, 3200, 0.8, 0.07, 'highpass'),
  // case opening: the sharp mechanical click as each item passes the marker
  caseTick: (c: AudioContext, o: AudioNode, t: number) => { burst(c, o, t, 0.018, 5200, 4, 0.35, 'bandpass'); tone(c, o, 2400 + Math.random() * 200, t, 0.03, 'square', 0.025); },
  bounce: (c: AudioContext, o: AudioNode, t: number) => { burst(c, o, t, 0.03, 3800, 3, 0.3); tone(c, o, 2900, t, 0.04, 'sine', 0.05); },
  dice: (c: AudioContext, o: AudioNode, t: number) => {
    for (let i = 0; i < 9; i++) burst(c, o, t + i * 0.055 + Math.random() * 0.03, 0.025, 1500 + Math.random() * 2500, 3, 0.25 - i * 0.02);
  },
};
export type Sfx = keyof typeof recipes;

export function sfx(kind: Sfx) {
  if (!settings.sound) return;
  try {
    const c = ac();
    recipes[kind](c, c.destination, c.currentTime + 0.005);
  } catch {
    /* audio unavailable */
  }
}

/** Reveal fanfare scaled by rarity: 0 = common ... 4 = legendary. */
export function reveal(level: number) {
  if (!settings.sound) return;
  try {
    const c = ac(), t = c.currentTime + 0.01, o = c.destination;
    const scale = [523, 659, 784, 988, 1175, 1319, 1568, 2093];
    const n = 2 + level * 2;
    for (let i = 0; i < n; i++) tone(c, o, scale[i % scale.length] * (i >= scale.length ? 2 : 1), t + i * (0.07 - level * 0.006), 0.35 + level * 0.1, 'triangle', 0.08);
    if (level >= 3) {
      burst(c, o, t, 0.9, 6000, 0.7, 0.12, 'highpass');
      for (let i = 0; i < 10 * level; i++) tone(c, o, 2200 + Math.random() * 2600, t + 0.3 + i * 0.04, 0.12, 'sine', 0.03);
    }
    if (level >= 4) tone(c, o, 131, t, 1.4, 'sawtooth', 0.05);
  } catch { /* audio unavailable */ }
}

/** Roulette ball rolling on the rim: filtered noise whose pitch and level follow the ball speed (0..1). */
export function rolling() {
  if (!settings.sound) return { set() {}, stop() {} };
  const c = ac();
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
  s.buffer = noise(c);
  s.loop = true;
  f.type = 'bandpass';
  f.Q.value = 1.4;
  f.frequency.value = 1400;
  g.gain.value = 0.0001;
  // a fast wobble gives the rattle of the ball over the frets
  lfo.frequency.value = 18;
  lg.gain.value = 0.02;
  lfo.connect(lg).connect(g.gain);
  s.connect(f).connect(g).connect(c.destination);
  s.start();
  lfo.start();
  return {
    set(speed: number) {
      f.frequency.setTargetAtTime(500 + speed * 2200, c.currentTime, 0.05);
      g.gain.setTargetAtTime(0.012 + speed * 0.07, c.currentTime, 0.05);
      lfo.frequency.setTargetAtTime(6 + speed * 26, c.currentTime, 0.05);
    },
    stop() {
      g.gain.cancelScheduledValues(c.currentTime);
      g.gain.setTargetAtTime(0.0001, c.currentTime, 0.08);
      s.stop(c.currentTime + 0.5);
      lfo.stop(c.currentTime + 0.5);
    },
  };
}

/** Continuous rising engine tone (crash game). */
export function engine() {
  if (!settings.sound) return { set() {}, stop() {} };
  const c = ac();
  const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
  o.type = 'sawtooth';
  o.frequency.value = 70;
  f.type = 'lowpass';
  f.frequency.value = 500;
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.035, c.currentTime + 0.4);
  o.connect(f).connect(g).connect(c.destination);
  o.start();
  return {
    set(m: number) {
      o.frequency.setTargetAtTime(70 + Math.log(m) * 90, c.currentTime, 0.1);
      f.frequency.setTargetAtTime(500 + Math.log(m) * 600, c.currentTime, 0.1);
    },
    stop() {
      g.gain.setTargetAtTime(0.0001, c.currentTime, 0.05);
      o.stop(c.currentTime + 0.3);
    },
  };
}

// ---------- background music: a soft procedural lounge loop ----------
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const CHORDS = [
  { bass: 45, notes: [60, 64, 67, 71] }, // Am9
  { bass: 50, notes: [65, 69, 72, 76] }, // Dm9
  { bass: 43, notes: [65, 71, 76, 74] }, // G13
  { bass: 48, notes: [64, 67, 71, 74] }, // Cmaj9
];
const SCALE = [69, 72, 74, 76, 79, 81, 84]; // A minor pentatonic
const BEAT = 60 / 78;
let music: { stop(): void } | null = null;

function startMusic() {
  if (music) return;
  const c = ac();
  const master = c.createGain();
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1800;
  master.gain.setValueAtTime(0.0001, c.currentTime);
  master.gain.exponentialRampToValueAtTime(0.5, c.currentTime + 2.5);
  lp.connect(master).connect(c.destination);

  let next = c.currentTime + 0.1, step = 0; // step = eighth notes
  const pad = (f: number, at: number, d: number) => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.022, at + 0.8);
    g.gain.linearRampToValueAtTime(0.0001, at + d);
    o.connect(g).connect(lp);
    o.start(at);
    o.stop(at + d + 0.1);
  };
  const tick = () => {
    while (next < c.currentTime + 0.4) {
      const bar = Math.floor(step / 8) % CHORDS.length, e = step % 8, ch = CHORDS[bar];
      if (e === 0) for (const n of ch.notes) pad(hz(n), next, BEAT * 4 + 0.4);
      if (e === 0 || e === 4 || (e === 7 && Math.random() < 0.5)) tone(c, lp, hz(ch.bass), next, BEAT * 1.4, 'sine', 0.09);
      if (e % 2 === 1) burst(c, lp, next, 0.04, 8000, 1, 0.015, 'highpass');
      if (Math.random() < 0.22) tone(c, lp, hz(SCALE[Math.floor(Math.random() * SCALE.length)]), next, BEAT * 1.2, 'sine', 0.035);
      next += BEAT / 2;
      step++;
    }
  };
  const id = setInterval(tick, 100);
  tick();
  music = {
    stop() {
      clearInterval(id);
      master.gain.setTargetAtTime(0.0001, c.currentTime, 0.4);
      setTimeout(() => master.disconnect(), 2500);
      music = null;
    },
  };
}

/** Turn menu music on or off. Browsers only allow audio after a user gesture, so we wait for one if needed. */
let waiting: (() => void) | null = null;
export function menuMusic(on: boolean) {
  if (waiting) { removeEventListener('pointerdown', waiting); removeEventListener('keydown', waiting); waiting = null; }
  if (!on) return music?.stop();
  if (ctx?.state === 'running') return startMusic();
  waiting = () => { menuMusic(false); startMusic(); };
  addEventListener('pointerdown', waiting, { once: true });
  addEventListener('keydown', waiting, { once: true });
}
