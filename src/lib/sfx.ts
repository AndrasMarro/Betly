// Effects are synthesised with WebAudio; the only recorded sample is the case opening (src/assets/case-open.mp3).
// Everything synthesised runs through one bus: a gentle compressor for punch plus a short room reverb for glue.
import { settings } from './state.svelte';

let ctx: AudioContext | undefined;
let noiseBuf: AudioBuffer | undefined;
let busNode: AudioNode | undefined;
// separate volume stages: effects, music and recorded samples (set from the settings dialog)
let fxNode: GainNode | undefined, musicNode: GainNode | undefined, sampleNode: GainNode | undefined;
const vols = { fx: 0.7, music: 0.5 };
function outs(c: AudioContext) {
  if (!fxNode) {
    fxNode = c.createGain(); musicNode = c.createGain(); sampleNode = c.createGain();
    fxNode.connect(bus(c)); musicNode.connect(bus(c)); sampleNode.connect(c.destination);
    applyVolumes();
  }
  return { fx: fxNode!, music: musicNode!, sample: sampleNode! };
}
function applyVolumes() {
  if (!ctx || !fxNode) return;
  const now = ctx.currentTime, curve = (v: number) => v * v; // perceptual: the slider feels linear
  fxNode.gain.setTargetAtTime(curve(vols.fx), now, 0.03);
  sampleNode!.gain.setTargetAtTime(curve(vols.fx), now, 0.03);
  musicNode!.gain.setTargetAtTime(curve(vols.music) * 1.6, now, 0.03);
}
/** Effect and music volume, 0..1 each. */
export function setVolumes(fx: number, music: number) {
  vols.fx = Math.max(0, Math.min(1, fx));
  vols.music = Math.max(0, Math.min(1, music));
  applyVolumes();
}

function ac() {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Master input: dry + a little reverb, then a compressor. */
function bus(c: AudioContext) {
  if (busNode) return busNode;
  const input = c.createGain(), comp = c.createDynamicsCompressor(), verb = c.createConvolver(), wet = c.createGain();
  comp.threshold.value = -16;
  comp.knee.value = 12;
  comp.ratio.value = 3.5;
  comp.attack.value = 0.003;
  comp.release.value = 0.18;
  // synthetic small room: decaying stereo noise
  const len = Math.floor(c.sampleRate * 0.9), ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  verb.buffer = ir;
  wet.gain.value = 0.16;
  input.connect(comp);
  input.connect(verb).connect(wet).connect(comp);
  comp.connect(c.destination);
  return (busNode = input);
}

function noise(c: AudioContext) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

const vary = (x: number, amt = 0.04) => x * (1 + (Math.random() * 2 - 1) * amt);

function env(g: GainNode, at: number, d: number, vol: number, attack = 0.003) {
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + d);
}

function tone(c: AudioContext, out: AudioNode, f: number, at: number, d: number, type: OscillatorType = 'triangle', vol = 0.12, slide?: number) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, at + d * 0.8);
  env(g, at, d, vol);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + d + 0.05);
}

/** Marimba-like pluck: fundamental + quickly fading 4th harmonic. */
function pluck(c: AudioContext, out: AudioNode, f: number, at: number, d = 0.45, vol = 0.12) {
  tone(c, out, f, at, d, 'sine', vol);
  tone(c, out, f * 4, at, d * 0.18, 'sine', vol * 0.35);
  tone(c, out, f * 2, at, d * 0.4, 'triangle', vol * 0.25);
}

/** FM bell: bright, glassy, decays naturally. */
function bell(c: AudioContext, out: AudioNode, f: number, at: number, d = 0.9, vol = 0.08, ratio = 3.5) {
  const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
  car.frequency.value = f;
  mod.frequency.value = f * ratio;
  mg.gain.setValueAtTime(f * 2.2, at);
  mg.gain.exponentialRampToValueAtTime(f * 0.05, at + d);
  mod.connect(mg).connect(car.frequency);
  env(g, at, d, vol, 0.002);
  car.connect(g).connect(out);
  car.start(at); mod.start(at);
  car.stop(at + d + 0.05); mod.stop(at + d + 0.05);
}

function burst(c: AudioContext, out: AudioNode, at: number, d: number, freq: number, q = 1, vol = 0.2, type: BiquadFilterType = 'bandpass', sweep?: number) {
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noise(c);
  f.type = type;
  f.frequency.setValueAtTime(freq, at);
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, at + d);
  f.Q.value = q;
  env(g, at, d, vol, 0.0015);
  s.connect(f).connect(g).connect(out);
  s.start(at, Math.random() * 0.5);
  s.stop(at + d + 0.05);
}

const C5 = 523.25;
const note = (semis: number) => C5 * 2 ** (semis / 12);
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

const recipes = {
  // clay chip: two crisp clacks with a short ceramic ring
  chip: (c: AudioContext, o: AudioNode, t: number) => {
    burst(c, o, t, 0.025, vary(4200), 6, 0.22);
    tone(c, o, vary(3150, 0.03), t, 0.06, 'sine', 0.04);
    burst(c, o, t + 0.045, 0.022, vary(3600), 6, 0.14);
  },
  // card: a snappy flick off the shoe
  card: (c: AudioContext, o: AudioNode, t: number) => { burst(c, o, t, 0.07, vary(3800), 0.9, 0.22, 'highpass'); burst(c, o, t, 0.05, vary(1400), 1.2, 0.12, 'bandpass', 700); },
  shuffle: (c: AudioContext, o: AudioNode, t: number) => {
    for (let i = 0; i < 40; i++) burst(c, o, t + i * 0.019 + Math.random() * 0.005, 0.026, 1800 + Math.random() * 2200, 1.4, 0.12 - i * 0.0015);
    burst(c, o, t + 0.82, 0.12, 1100, 0.8, 0.28, 'bandpass', 380);
    tone(c, o, 140, t + 0.82, 0.12, 'sine', 0.12, 80);
  },
  // woodblock tick
  tick: (c: AudioContext, o: AudioNode, t: number) => { tone(c, o, vary(1900, 0.05), t, 0.035, 'sine', 0.07, 1300); burst(c, o, t, 0.01, 5000, 4, 0.12); },
  stop: (c: AudioContext, o: AudioNode, t: number) => { tone(c, o, 190, t, 0.16, 'sine', 0.2, 85); burst(c, o, t, 0.04, 900, 1, 0.12, 'lowpass'); },
  spin: (c: AudioContext, o: AudioNode, t: number) => burst(c, o, t, 0.5, 400, 1.2, 0.14, 'bandpass', 3200),
  click: (c: AudioContext, o: AudioNode, t: number) => { tone(c, o, vary(1500), t, 0.03, 'sine', 0.06, 1100); },
  win: (c: AudioContext, o: AudioNode, t: number) => [0, 4, 7, 12].forEach((s, i) => pluck(c, o, note(s), t + i * 0.075, 0.5, 0.11)),
  big: (c: AudioContext, o: AudioNode, t: number) => {
    [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => pluck(c, o, note(s), t + i * 0.065, 0.6, 0.1));
    [12, 16, 19].forEach((s) => tone(c, o, note(s), t + 0.5, 0.9, 'triangle', 0.035));
    for (let i = 0; i < 12; i++) bell(c, o, note(24 + PENTA[Math.floor(Math.random() * 6)]), t + 0.45 + i * 0.05, 0.4, 0.025);
  },
  // playful "bwomp"
  lose: (c: AudioContext, o: AudioNode, t: number) => { tone(c, o, 330, t, 0.22, 'triangle', 0.11, 250); tone(c, o, 247, t + 0.16, 0.38, 'triangle', 0.11, 150); },
  // ka-ching: two metallic pings and a shimmer
  cash: (c: AudioContext, o: AudioNode, t: number) => { bell(c, o, 1568, t, 0.35, 0.07, 2.76); bell(c, o, 2093, t + 0.07, 0.6, 0.07, 2.76); burst(c, o, t + 0.07, 0.3, 7000, 0.7, 0.05, 'highpass'); },
  gem: (c: AudioContext, o: AudioNode, t: number) => { const f = note(PENTA[4 + Math.floor(Math.random() * 5)]); bell(c, o, f, t, 0.7, 0.07); bell(c, o, f * 1.5, t + 0.05, 0.5, 0.04); },
  // punchy explosion: sub drop + noise body + crackle tail
  boom: (c: AudioContext, o: AudioNode, t: number) => {
    tone(c, o, 120, t, 0.7, 'sine', 0.3, 32);
    burst(c, o, t, 0.9, 2400, 0.6, 0.32, 'lowpass', 90);
    for (let i = 0; i < 14; i++) burst(c, o, t + 0.08 + Math.random() * 0.6, 0.02, 2000 + Math.random() * 3000, 3, 0.12);
  },
  // cartoony boing
  hop: (c: AudioContext, o: AudioNode, t: number) => { tone(c, o, vary(300), t, 0.16, 'sine', 0.12, 720); tone(c, o, vary(600), t, 0.08, 'triangle', 0.04, 1300); },
  splat: (c: AudioContext, o: AudioNode, t: number) => { burst(c, o, t, 0.3, 1200, 0.7, 0.28, 'lowpass', 120); tone(c, o, 260, t, 0.3, 'triangle', 0.1, 60); },
  flip: (c: AudioContext, o: AudioNode, t: number) => { bell(c, o, 2637, t, 0.5, 0.05, 2.4); burst(c, o, t, 0.12, 6000, 0.8, 0.06, 'highpass'); },
  // plinko: glassy pentatonic pings
  peg: (c: AudioContext, o: AudioNode, t: number) => bell(c, o, note(12 + PENTA[Math.floor(Math.random() * PENTA.length)]), t, 0.18, 0.025, 2),
  scratch: (c: AudioContext, o: AudioNode, t: number) => burst(c, o, t, 0.07, vary(3600, 0.2), 1.1, 0.08, 'bandpass'),
  // case reel: hard, short mechanical click
  bounce: (c: AudioContext, o: AudioNode, t: number) => { burst(c, o, t, 0.025, vary(4200), 3, 0.2); tone(c, o, vary(3200), t, 0.04, 'sine', 0.05); },
  dice: (c: AudioContext, o: AudioNode, t: number) => {
    for (let i = 0; i < 10; i++) { const at = t + i * 0.05 + Math.random() * 0.03; burst(c, o, at, 0.02, 1800 + Math.random() * 2600, 3, 0.26 - i * 0.02); tone(c, o, vary(900, 0.2), at, 0.03, 'sine', 0.04); }
  },
};
export type Sfx = keyof typeof recipes;

export function sfx(kind: Sfx) {
  if (!settings.sound) return;
  try {
    const c = ac();
    recipes[kind](c, outs(c).fx, c.currentTime + 0.005);
  } catch {
    /* audio unavailable */
  }
}

/** Reveal fanfare scaled by rarity: 0 = common ... 4 = legendary. */
export function reveal(level: number) {
  if (!settings.sound) return;
  try {
    const c = ac(), t = c.currentTime + 0.01, o = outs(c).fx;
    const steps = [[0, 7], [0, 4, 7], [0, 4, 7, 12], [0, 4, 7, 12, 16, 19], [0, 4, 7, 12, 16, 19, 24, 28]][level];
    steps.forEach((s, i) => pluck(c, o, note(s), t + i * (0.08 - level * 0.008), 0.5 + level * 0.12, 0.11));
    if (level >= 2) for (let i = 0; i < 6 * level; i++) bell(c, o, note(24 + PENTA[Math.floor(Math.random() * 8)]), t + 0.25 + i * 0.045, 0.45, 0.025);
    if (level >= 3) { burst(c, o, t, 1.1, 7000, 0.6, 0.09, 'highpass'); tone(c, o, note(-12), t, 1.2, 'triangle', 0.06); }
    if (level >= 4) [0, 4, 7].forEach((s) => tone(c, o, note(s - 12), t + 0.6, 1.6, 'sawtooth', 0.025));
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
  s.connect(f).connect(g).connect(outs(c).fx);
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
  o.connect(f).connect(g).connect(outs(c).fx);
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
  lp.connect(master).connect(outs(c).music);

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

/** A recorded sound file, decoded once; play(from, dur) plays a slice of it. Load early with preload(). */
export function sampler(url: string, vol = 1) {
  let buf: Promise<AudioBuffer | null> | undefined;
  const load = () => (buf ??= fetch(url).then((r) => r.arrayBuffer()).then((b) => ac().decodeAudioData(b)).catch(() => null));
  return {
    preload: () => void load(),
    async play(from = 0, dur?: number, gain = 1) {
      if (!settings.sound) return;
      const b = await load();
      if (!b || !settings.sound) return;
      const c = ac(), src = c.createBufferSource(), g = c.createGain();
      src.buffer = b;
      g.gain.value = vol * gain;
      src.connect(g).connect(outs(c).sample);
      src.start(c.currentTime, from, dur);
    },
  };
}
