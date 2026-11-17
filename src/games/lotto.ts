// Keno and Lotto: number draws. Payouts are scaled so a ticket returns 97 % on average, like the arcade games.
import { EDGE } from './arcade.ts';

const C = (n: number, k: number) => { if (k < 0 || k > n) return 0; let c = 1; for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i; return c; };
/** Chance of exactly h of my k numbers among d drawn from n. */
export const hyper = (n: number, d: number, k: number, h: number) => (C(k, h) * C(n - k, d - h)) / C(n, d);
/** Round down so the edge is never given away by rounding. */
const down = (x: number) => (x >= 100 ? Math.floor(x) : x >= 10 ? Math.floor(x * 10) / 10 : Math.floor(x * 100) / 100);
/** Draw `count` different numbers from 1..n. */
export function draw(n: number, count: number) {
  const pool = Array.from({ length: n }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, count);
}

// ---------- Keno: 40 numbers, 10 drawn, pick 1 to 10 ----------
export const KENO_N = 40, KENO_D = 10, KENO_MAX = 10;
export const KENO_RISK = { low: { from: 1 / 3, grow: 1.7 }, classic: { from: 1 / 2, grow: 2.8 }, high: { from: 0.7, grow: 5.5 } } as const;
export type KenoRisk = keyof typeof KENO_RISK;
/** Multiplier for 0..k hits: nothing below a threshold, then growing steeply per hit, scaled to 97 %. */
export function kenoTable(k: number, risk: KenoRisk) {
  const { from, grow } = KENO_RISK[risk], min = Math.max(1, Math.ceil(k * from));
  const shape = Array.from({ length: k + 1 }, (_, h) => (h < min ? 0 : grow ** (h - min)));
  const ev = shape.reduce((a, m, h) => a + m * hyper(KENO_N, KENO_D, k, h), 0);
  return shape.map((m) => down((m * EDGE) / ev));
}

// ---------- Lotto: 6 of 42 plus a lucky number 1 to 6 ----------
export const LOTTO_N = 42, LOTTO_K = 6, LUCKY = 6;
/** Prize ranks from the top: [hits, lucky number right]. Fewer than 3 hits wins nothing (except 2 + lucky). */
export const RANKS: [number, boolean][] = [[6, true], [6, false], [5, true], [5, false], [4, true], [4, false], [3, true], [3, false], [2, true]];
export const rankProb = ([h, l]: [number, boolean]) => hyper(LOTTO_N, LOTTO_K, LOTTO_K, h) * (l ? 1 / LUCKY : 1 - 1 / LUCKY);
/** Multipliers per rank: rarer ranks pay more (by chance^-0.8), all scaled to 97 %. */
export const LOTTO_TABLE: number[] = (() => {
  const shape = RANKS.map((r) => rankProb(r) ** -0.8);
  const ev = shape.reduce((a, m, i) => a + m * rankProb(RANKS[i]), 0);
  return shape.map((m) => down((m * EDGE) / ev));
})();
/** The rank a ticket reached (index into RANKS), or -1. */
export function lottoRank(nums: number[], lucky: number, drawn: number[], drawnLucky: number) {
  const h = nums.filter((x) => drawn.includes(x)).length, l = lucky === drawnLucky;
  return RANKS.findIndex(([rh, rl]) => rh === h && rl === l);
}
