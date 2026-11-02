// Basic strategy (multi-deck, DAS-aware) used for hints and bots.
import type { Card } from '../lib/cards.ts';
import { total, type Action, type Rules } from './blackjack.ts';

export function advise(cards: Card[], up: Card, rules: Rules, can: { double: boolean; split: boolean; surrender: boolean }): Action {
  const d = up.r === 1 ? 11 : Math.min(up.r, 10);
  const { t, soft } = total(cards);
  const v = (c: Card) => (c.r === 1 ? 11 : Math.min(c.r, 10));
  const D = (x: Action = 'hit'): Action => (can.double ? 'double' : x);
  const R = (x: Action): Action => (can.surrender ? 'surrender' : x);

  if (can.split && cards.length === 2 && v(cards[0]) === v(cards[1])) {
    const p = v(cards[0]);
    const das = rules.das;
    if (p === 11 || p === 8) return 'split';
    if (p === 9 && ![7, 10, 11].includes(d)) return 'split';
    if (p === 7 && d <= 7) return 'split';
    if (p === 6 && d <= 6 && (das || d >= 3)) return 'split';
    if (p === 4 && das && (d === 5 || d === 6)) return 'split';
    if ((p === 2 || p === 3) && d <= 7 && (das || d >= 4)) return 'split';
  }
  if (soft) {
    if (t >= 20) return 'stand';
    if (t === 19) return d === 6 && rules.h17 ? D('stand') : 'stand';
    if (t === 18) return d <= 6 && (d >= 3 || rules.h17) ? D('stand') : d <= 8 ? 'stand' : 'hit';
    if (t === 17) return d >= 3 && d <= 6 ? D() : 'hit';
    if (t >= 15) return d >= 4 && d <= 6 ? D() : 'hit';
    return d >= 5 && d <= 6 ? D() : 'hit';
  }
  if (t >= 17) return t === 17 && d === 11 && rules.h17 ? R('stand') : 'stand';
  if (t === 16 && d >= 9) return R('hit');
  if (t === 15 && (d === 10 || (d === 11 && rules.h17))) return R('hit');
  if (t >= 13) return d <= 6 ? 'stand' : 'hit';
  if (t === 12) return d >= 4 && d <= 6 ? 'stand' : 'hit';
  if (t === 11) return d === 11 && !rules.h17 ? 'hit' : D();
  if (t === 10) return d <= 9 ? D() : 'hit';
  if (t === 9) return d >= 3 && d <= 6 ? D() : 'hit';
  return 'hit';
}
