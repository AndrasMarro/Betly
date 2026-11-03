// Punto Banco with the standard drawing tableau.
import type { Card } from '../lib/cards.ts';

export const cardValue = (c: Card) => (c.r >= 10 ? 0 : c.r);
export const points = (cards: Card[]) => cards.reduce((s, c) => s + cardValue(c), 0) % 10;

export type Coup = { player: Card[]; banker: Card[]; p: number; b: number; winner: 'player' | 'banker' | 'tie'; natural: boolean; pPair: boolean; bPair: boolean };

/** Does the banker draw, given its total and the player's third card (null = player stood)? */
export function bankerDraws(b: number, third: Card | null) {
  if (third === null) return b <= 5;
  const t = cardValue(third);
  if (b <= 2) return true;
  if (b === 3) return t !== 8;
  if (b === 4) return t >= 2 && t <= 7;
  if (b === 5) return t >= 4 && t <= 7;
  if (b === 6) return t === 6 || t === 7;
  return false;
}

export function coup(draw: () => Card): Coup {
  const player = [draw()], banker = [draw()];
  player.push(draw());
  banker.push(draw());
  let p = points(player), b = points(banker);
  const natural = p >= 8 || b >= 8;
  if (!natural) {
    let third: Card | null = null;
    if (p <= 5) { third = draw(); player.push(third); p = points(player); }
    if (bankerDraws(b, third)) { banker.push(draw()); b = points(banker); }
  }
  return {
    player, banker, p, b, natural,
    winner: p > b ? 'player' : b > p ? 'banker' : 'tie',
    pPair: player[0].r === player[1].r,
    bPair: banker[0].r === banker[1].r,
  };
}

export type BetKey = 'player' | 'banker' | 'tie' | 'pPair' | 'bPair';
/** Total returned for a bet (stake included). Banker pays 0.95:1, tie 8:1 (main bets push on a tie), pairs 11:1. */
export function payout(key: BetKey, amt: number, c: Coup) {
  switch (key) {
    case 'player': return c.winner === 'player' ? amt * 2 : c.winner === 'tie' ? amt : 0;
    case 'banker': return c.winner === 'banker' ? amt * 1.95 : c.winner === 'tie' ? amt : 0;
    case 'tie': return c.winner === 'tie' ? amt * 9 : 0;
    case 'pPair': return c.pPair ? amt * 12 : 0;
    case 'bPair': return c.bPair ? amt * 12 : 0;
  }
}
