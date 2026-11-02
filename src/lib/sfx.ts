import { settings } from './state.svelte';

let ctx: AudioContext | undefined;
const tones: Record<string, [number, number, OscillatorType, number][]> = {
  // [freq, start offset s, wave, duration s]
  chip: [[1400, 0, 'triangle', 0.05], [900, 0.03, 'triangle', 0.05]],
  card: [[300, 0, 'triangle', 0.04]],
  tick: [[2200, 0, 'square', 0.015]],
  stop: [[160, 0, 'sine', 0.12]],
  win: [[523, 0, 'triangle', 0.15], [659, 0.1, 'triangle', 0.15], [784, 0.2, 'triangle', 0.25], [1047, 0.32, 'triangle', 0.35]],
  lose: [[220, 0, 'sine', 0.2], [165, 0.15, 'sine', 0.3]],
};

export function sfx(kind: keyof typeof tones) {
  if (!settings.sound) return;
  try {
    ctx ??= new AudioContext();
    const now = ctx.currentTime;
    for (const [f, at, type, d] of tones[kind]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + at);
      g.gain.exponentialRampToValueAtTime(0.12, now + at + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now + at + d);
      o.connect(g).connect(ctx.destination);
      o.start(now + at);
      o.stop(now + at + d + 0.02);
    }
  } catch {
    /* audio unavailable */
  }
}
