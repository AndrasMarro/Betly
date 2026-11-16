// Horse racing: six horses, a race simulated from a seed (so every player in a room sees the same race),
// and odds from many simulated races. Bets: Sieg (win), Platz (first two) and Zweierwette (exact first two).
import { rng } from '../lib/daily.ts';

export type Style = 'front' | 'even' | 'closer';
export type Horse = { n: number; name: string; coat: number; silks: number; pattern: number; strength: number; style: Style };
export type BetKind = 'win' | 'place' | 'exacta';
export type Odds = { win: number[]; place: number[]; exacta: number[][] };
export type Race = { frames: Float32Array[]; finish: number[]; order: number[]; dt: number };

export const DIST = 300;      // metres
export const RTP = 0.95;      // like a real tote: the house keeps 5 %
export const N = 6;
export const DT = 1 / 20;     // simulation step and playback sample (s)

const NAMES = ['Föhnsturm', 'Silberpfeil', 'Alpenglühen', 'Rotkäppli', 'Donnerhuf', 'Morgenrot', 'Sturmwind', 'Edelweiss', 'Bergkristall', 'Goldregen', 'Nebelgeist', 'Feuerfunke', 'Seeblick', 'Mitternacht', 'Wildfang', 'Sonnenstrahl', 'Lawine', 'Blitzlicht'];
const STYLES: Style[] = ['front', 'even', 'closer'];

/** A fresh field of six horses. */
export function field(seed: number): Horse[] {
  const r = rng(seed);
  const names = [...NAMES].sort(() => r() - 0.5).slice(0, N);
  const silks = [0, 1, 2, 3, 4, 5, 6, 7].sort(() => r() - 0.5);
  return names.map((name, i) => ({
    n: i + 1, name, coat: Math.floor(r() * 6), silks: silks[i], pattern: Math.floor(r() * 5),
    // a clear favourite now and then, otherwise a fairly even field
    strength: Math.round((r() - 0.5) * 2.2 * 100) / 100, style: STYLES[Math.floor(r() * 3)],
  }));
}

/**
 * Simulate one race. Every horse has a base speed from its strength, a pace profile from its running style
 * and a smooth random wobble; the closers find a late kick. Returns positions sampled every DT seconds.
 */
export function simulate(horses: Horse[], seed: number, keepFrames = true): Race {
  const r = rng(seed);
  const pos = horses.map(() => 0), vel = horses.map(() => 0), finish = horses.map(() => 0);
  const wob = horses.map(() => 0), aim = horses.map(() => 0);
  const kick = horses.map(() => 0.55 + r() * 0.3); // where the final effort starts
  const form = horses.map(() => (r() + r() - 1) * 0.6); // form of the day, m/s
  const frames: Float32Array[] = [];
  let t = 0;
  while (finish.some((f) => !f) && t < 60) {
    if (keepFrames) frames.push(Float32Array.from(pos));
    horses.forEach((h, i) => {
      if (finish[i]) { pos[i] += vel[i] * DT * 0.6; return; } // past the post: ease off
      const x = pos[i] / DIST;
      const pace = h.style === 'front' ? 1.04 - 0.08 * x : h.style === 'closer' ? 0.962 + (x > kick[i] ? 0.24 * (x - kick[i]) / (1 - kick[i]) : 0) : 1;
      if (r() < DT * 1.6) aim[i] = (r() - 0.5) * 0.08; // a new wobble target now and then
      wob[i] += (aim[i] - wob[i]) * DT * 2;
      const top = (16 + 0.32 * h.strength + form[i]) * pace * (1 + wob[i]);
      vel[i] += (top - vel[i]) * Math.min(1, DT * (t < 2 ? 1.6 : 2.5)); // a short burst out of the gate
      const before = pos[i];
      pos[i] += vel[i] * DT;
      if (pos[i] >= DIST) finish[i] = t + ((DIST - before) / (pos[i] - before)) * DT;
    });
    t += DT;
  }
  if (keepFrames) frames.push(Float32Array.from(pos));
  const order = horses.map((_, i) => i).sort((a, b) => finish[a] - finish[b]);
  return { frames, finish, order, dt: DT };
}

type Hits = { win: number[]; place: number[]; exacta: number[][] };
function raw(horses: Horse[], runs: number, rand = Math.random): Hits {
  const win = Array(N).fill(0), place = Array(N).fill(0), exacta = Array.from({ length: N }, () => Array(N).fill(0));
  for (let k = 0; k < runs; k++) {
    const { order } = simulate(horses, Math.floor(rand() * 2 ** 31), false);
    win[order[0]]++; place[order[0]]++; place[order[1]]++; exacta[order[0]][order[1]]++;
  }
  return { win, place, exacta };
}
function fromHits(parts: Hits[], runs: number): Odds {
  const sum = (f: (h: Hits) => number) => parts.reduce((a, h) => a + f(h), 0);
  // +2 hits of shrinkage: a rare result counted a little high keeps long prices from being too generous
  // (and gives a horse that never won in the sample a finite price)
  const price = (hits: number, cap: number) => Math.min(cap, Math.max(1.01, Math.floor((RTP * runs / (hits + 2)) * 100) / 100));
  const idx = [...Array(N).keys()];
  return {
    win: idx.map((i) => price(sum((h) => h.win[i]), 200)),
    place: idx.map((i) => price(sum((h) => h.place[i]), 100)),
    exacta: idx.map((i) => idx.map((j) => price(sum((h) => h.exacta[i][j]), 1000))),
  };
}

/** Odds from `runs` simulated races, decimal (stake back included), floored to two decimals. */
export const odds = (horses: Horse[], runs = 6000, rand = Math.random): Odds => fromHits([raw(horses, runs, rand)], runs);

/** Same as odds(), but yields to the browser between chunks so the page keeps animating. */
export async function oddsAsync(horses: Horse[], runs = 6000): Promise<Odds> {
  const parts: Hits[] = [];
  for (let k = 0; k < runs; k += 500) { parts.push(raw(horses, 500)); await new Promise((r) => setTimeout(r, 0)); }
  return fromHits(parts, runs);
}

/** The payout factor of a bet on this result (0 = lost). sel: horse indexes (exacta: [first, second]). */
export function payout(kind: BetKind, sel: number[], order: number[], o: Odds) {
  if (kind === 'win') return order[0] === sel[0] ? o.win[sel[0]] : 0;
  if (kind === 'place') return order[0] === sel[0] || order[1] === sel[0] ? o.place[sel[0]] : 0;
  return order[0] === sel[0] && order[1] === sel[1] ? o.exacta[sel[0]][sel[1]] : 0;
}

/** Playback with a slow-motion photo finish: maps wall-clock seconds to race seconds. */
export function timeline(race: Race) {
  const leaderAt = (rt: number) => {
    const f = race.frames[Math.min(race.frames.length - 1, Math.floor(rt / race.dt))];
    let a = 0, b = 0;
    for (const p of f) { if (p > a) { b = a; a = p; } else if (p > b) b = p; }
    return { a, gap: a - b };
  };
  const map: number[] = [0];
  let rt = 0;
  const end = race.frames.length * race.dt;
  while (rt < end + 1) {
    const { a, gap } = leaderAt(rt);
    // close finish: the last 12 metres in slow motion
    const slow = a > DIST - 12 && a < DIST + 2 && gap < 1.6;
    rt += DT * (slow ? 0.3 : 1);
    map.push(rt);
  }
  return { map, wall: map.length * DT, race: (wall: number) => map[Math.max(0, Math.min(map.length - 1, Math.floor(wall / DT)))] };
}

/** Interpolated positions at race time t. */
export function at(race: Race, t: number) {
  const k = Math.max(0, t / race.dt), i = Math.min(race.frames.length - 2, Math.floor(k)), f = Math.min(1, k - i);
  const a = race.frames[i], b = race.frames[i + 1] ?? a;
  return Array.from(a, (x, j) => x + (b[j] - x) * f);
}
