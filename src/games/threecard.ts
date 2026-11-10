// Three Card Poker (casino version): Ante / Play against the dealer plus the optional Pair Plus side bet.
import { shuffle, type Card } from '../lib/cards.ts';

/** Hand categories, low to high. In three-card poker a straight beats a flush. */
export const CATS = ['high', 'pair', 'flush', 'straight', 'trips', 'sf'] as const;
export type Cat = (typeof CATS)[number];

const val = (c: Card) => (c.r === 1 ? 14 : c.r);

/** Score a 3-card hand: higher is better. Returns the category and a comparable number. */
export function rank3(cards: Card[]) {
  const v = cards.map(val).sort((a, b) => b - a);
  const flush = cards.every((c) => c.s === cards[0].s);
  let straightHigh = 0;
  if (v[0] - v[1] === 1 && v[1] - v[2] === 1) straightHigh = v[0];
  if (v[0] === 14 && v[1] === 3 && v[2] === 2) straightHigh = 3; // A-2-3 is the lowest straight
  const trips = v[0] === v[2];
  const pair = !trips && (v[0] === v[1] || v[1] === v[2]);
  let cat: Cat = 'high', kick = v;
  if (straightHigh && flush) { cat = 'sf'; kick = [straightHigh]; }
  else if (trips) { cat = 'trips'; kick = [v[0]]; }
  else if (straightHigh) { cat = 'straight'; kick = [straightHigh]; }
  else if (flush) cat = 'flush';
  else if (pair) { const p = v[1]; cat = 'pair'; kick = [p, v[0] === p ? v[2] : v[0]]; }
  let score = CATS.indexOf(cat);
  for (let i = 0; i < 3; i++) score = score * 15 + (kick[i] ?? 0);
  return { cat, score };
}

/** The dealer qualifies with queen high or better. */
export const qualifies = (dealer: Card[]) => rank3(dealer).score >= rank3([{ r: 12, s: 0 }, { r: 3, s: 1 }, { r: 2, s: 2 }]).score;

/** Optimal-ish strategy: play with Q-6-4 or better, fold below. */
export const shouldPlay = (hand: Card[]) => rank3(hand).score >= rank3([{ r: 12, s: 0 }, { r: 6, s: 1 }, { r: 4, s: 2 }]).score;

/** Pays (x the bet, stake on top) */
export const PAIR_PLUS: Record<Cat, number> = { high: 0, pair: 1, flush: 4, straight: 6, trips: 30, sf: 40 };
export const ANTE_BONUS: Record<Cat, number> = { high: 0, pair: 0, flush: 0, straight: 1, trips: 4, sf: 5 };

export type Round = { player: Card[]; dealer: Card[] };
export function deal(): Round {
  const deck = shuffle(Array.from({ length: 52 }, (_, i) => ({ r: (i % 13) + 1, s: Math.floor(i / 13) })));
  return { player: deck.slice(0, 3), dealer: deck.slice(3, 6) };
}

export type Outcome = { back: number; result: 'fold' | 'noqual' | 'win' | 'lose' | 'push'; ante: number; play: number; bonus: number; pp: number };
/**
 * Everything returned to the player (stakes included).
 * fold: ante (and play) lost; Pair Plus is paid regardless.
 */
export function settle3(r: Round, ante: number, pairPlus: number, played: boolean): Outcome {
  const p = rank3(r.player), d = rank3(r.dealer);
  const pp = pairPlus && PAIR_PLUS[p.cat] ? pairPlus * (PAIR_PLUS[p.cat] + 1) : 0;
  if (!played) return { back: pp, result: 'fold', ante: 0, play: 0, bonus: 0, pp };
  const bonus = ante * ANTE_BONUS[p.cat];
  let a = 0, pl = 0, result: Outcome['result'];
  if (!qualifies(r.dealer)) { a = ante * 2; pl = ante; result = 'noqual'; }
  else if (p.score > d.score) { a = ante * 2; pl = ante * 2; result = 'win'; }
  else if (p.score === d.score) { a = ante; pl = ante; result = 'push'; }
  else result = 'lose';
  return { back: a + pl + bonus + pp, result, ante: a, play: pl, bonus, pp };
}
