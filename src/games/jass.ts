// Schieber Jass: 36 cards, two teams (seats 0+2 against 1+3), trump in a suit, Obenabe or Undenufe.
// Rules after the Swisslos basics: follow suit or trump, no undertrumping, the trump Bauer may be held back,
// Weis (melds) and Stöck. Includes the bot logic for choosing a mode and playing a card.
import { shuffle } from '../lib/cards.ts';

/** s: 0 Rosen/Herz, 1 Schilten/Schaufel, 2 Eicheln/Kreuz, 3 Schellen/Ecken. r: 6..9, 10 Banner, 11 Under/Bauer, 12 Ober/Dame, 13 König, 14 Ass. */
export type JCard = { s: number; r: number };
export type Mode = 0 | 1 | 2 | 3 | 'obe' | 'unde';
export type Play = { p: number; c: JCard };
/** Card pictures: Swiss German, Swiss French or the international French pattern. */
export type Deck = 'classic' | 'de' | 'fr' | 'intl' | 'ru'; // classic: the drawn standard cards

export const PAYOUT = 1.9; // a won match pays the stake x1.9
export const same = (a: JCard, b: JCard) => a.s === b.s && a.r === b.r;
export const isTrump = (c: JCard, m: Mode) => typeof m === 'number' && c.s === m;

export function deal(): JCard[][] {
  const d = shuffle(Array.from({ length: 36 }, (_, i) => ({ s: Math.floor(i / 9), r: 6 + (i % 9) })));
  return [0, 1, 2, 3].map((p) => d.slice(p * 9, p * 9 + 9));
}

// trump order from weakest to strongest: 6 7 8 10 Ober König Ass Nell(9) Bauer(J)
const TRUMP = [6, 7, 8, 10, 12, 13, 14, 9, 11];

/** Strength of a card in a trick (higher wins). Cards that neither follow the lead nor trump cannot win (-1). */
export function power(c: JCard, m: Mode, lead: number) {
  if (isTrump(c, m)) return 100 + TRUMP.indexOf(c.r);
  if (c.s !== lead) return -1;
  return m === 'unde' ? 20 - c.r : c.r;
}

/** Card points. Every mode adds up to 152, plus 5 for the last trick = 157. */
export function points(c: JCard, m: Mode) {
  if (isTrump(c, m)) return ({ 11: 20, 9: 14, 14: 11, 10: 10, 13: 4, 12: 3 } as Record<number, number>)[c.r] ?? 0;
  const base = ({ 14: 11, 10: 10, 13: 4, 12: 3, 11: 2 } as Record<number, number>)[c.r] ?? 0;
  if (m === 'obe') return c.r === 8 ? 8 : base;
  if (m === 'unde') return c.r === 8 ? 8 : c.r === 6 ? 11 : c.r === 14 ? 0 : base;
  return base;
}

export function trickWinner(t: Play[], m: Mode) {
  const lead = t[0].c.s;
  let best = t[0];
  for (const x of t) if (power(x.c, m, lead) > power(best.c, m, lead)) best = x;
  return best.p;
}

/** The cards a player may play on this trick. */
export function legal(hand: JCard[], t: Play[], m: Mode): JCard[] {
  if (!t.length) return hand;
  const lead = t[0].c.s;
  const follow = hand.filter((c) => c.s === lead);
  if (typeof m !== 'number') return follow.length ? follow : hand;
  if (lead === m) {
    // trump led: follow with trump, but the Bauer alone never has to be played
    return hand.some((c) => c.s === m && c.r !== 11) ? follow : hand;
  }
  // a side suit led: follow or trump; without the suit anything goes. Undertrumping is not allowed
  // (unless the hand holds nothing else).
  const can = follow.length ? [...follow, ...hand.filter((c) => c.s === m)] : hand;
  const top = Math.max(-1, ...t.filter((x) => isTrump(x.c, m)).map((x) => power(x.c, m, lead)));
  const ok = can.filter((c) => !isTrump(c, m) || power(c, m, lead) > top);
  return ok.length ? ok : can;
}

// ---------- Weis (melds) and Stöck ----------
/** n: cards in the meld, top: highest card (sequences) or the rank (four of a kind), s: suit or -1 for four of a kind. */
export type Weis = { pts: number; n: number; top: number; s: number; four: boolean };

export function weisOf(hand: JCard[], m: Mode): Weis[] {
  const out: Weis[] = [];
  for (let s = 0; s < 4; s++) {
    const rs = hand.filter((c) => c.s === s).map((c) => c.r).sort((a, b) => a - b);
    let run = 1;
    for (let i = 1; i <= rs.length; i++) {
      if (i < rs.length && rs[i] === rs[i - 1] + 1) { run++; continue; }
      if (run >= 3) out.push({ pts: run === 3 ? 20 : (run - 3) * 50, n: run, top: rs[i - 1], s, four: false });
      run = 1;
    }
  }
  for (const r of [11, 9, 14, 13, 12, 10]) {
    if (hand.filter((c) => c.r === r).length === 4) out.push({ pts: r === 11 ? 200 : r === 9 ? 150 : 100, n: 4, top: r, s: -1, four: true });
  }
  return out.sort((a, b) => cmpWeis(b, a, m));
}

/** > 0 when a beats b: more points, then more cards, then the higher card (Undenufe: lower), then trump. */
export function cmpWeis(a: Weis, b: Weis, m: Mode) {
  if (a.pts !== b.pts) return a.pts - b.pts;
  if (a.n !== b.n) return a.n - b.n;
  if (a.top !== b.top) return m === 'unde' ? b.top - a.top : a.top - b.top;
  return (a.s === m ? 1 : 0) - (b.s === m ? 1 : 0);
}

/** Only the team with the best single Weis scores, but then all of its Weis. Ties go to whoever plays first. */
export function weisWinner(weis: Weis[][], m: Mode, first: number) {
  let best = -1;
  for (let k = 0; k < 4; k++) {
    const p = (first + k) % 4;
    if (weis[p].length && (best < 0 || cmpWeis(weis[p][0], weis[best][0], m) > 0)) best = p;
  }
  if (best < 0) return { team: -1, pts: 0 };
  const team = best % 2;
  return { team, pts: [team, team + 2].reduce((a, p) => a + weis[p].reduce((x, w) => x + w.pts, 0), 0) };
}

/** Seat holding König and Ober of trump (20 points), or -1. */
export const stoeckSeat = (hands: JCard[][], m: Mode) =>
  typeof m !== 'number' ? -1 : hands.findIndex((h) => h.some((c) => c.s === m && c.r === 13) && h.some((c) => c.s === m && c.r === 12));

/** Card points per team for a finished round: last trick +5, all nine tricks (Match) = 257. */
export function roundPoints(tricks: { winner: number; cards: JCard[] }[], m: Mode): [number, number] {
  const pts: [number, number] = [0, 0];
  for (const t of tricks) pts[t.winner % 2] += t.cards.reduce((a, c) => a + points(c, m), 0);
  pts[tricks[tricks.length - 1].winner % 2] += 5;
  for (const team of [0, 1]) if (tricks.every((t) => t.winner % 2 === team)) pts[team] += 100;
  return pts;
}

// ---------- bots ----------
/** How good a hand is for a mode (rough, tuned by feel). */
export function modeScore(hand: JCard[], m: Mode) {
  let sc = 0;
  if (typeof m === 'number') {
    const tr = hand.filter((c) => c.s === m);
    for (const c of tr) sc += ({ 11: 7, 9: 5, 14: 3, 13: 2, 12: 1.5 } as Record<number, number>)[c.r] ?? 1;
    sc += Math.max(0, tr.length - 3) * 1.5;
    for (const c of hand) if (c.s !== m && c.r === 14) sc += 2;
    return sc;
  }
  // Obenabe / Undenufe: unbroken runs from the top card (Ass or Sechser) are sure tricks
  for (let s = 0; s < 4; s++) {
    const rs = hand.filter((c) => c.s === s).map((c) => (m === 'obe' ? c.r : 20 - c.r)).sort((a, b) => b - a);
    let want = 14, run = 0;
    for (const r of rs) { if (r === want) { run++; want--; } else break; }
    sc += [0, 4, 7.5, 10, 12, 14, 15, 16, 17, 18][run];
    if (run && rs.length >= 4) sc += 1;
  }
  return sc;
}

export const MODES: Mode[] = [0, 1, 2, 3, 'obe', 'unde'];
export function chooseMode(hand: JCard[], canPush: boolean): Mode | 'push' {
  let best: Mode = 0, bs = -1;
  for (const m of MODES) { const s = modeScore(hand, m); if (s > bs) { bs = s; best = m; } }
  return canPush && bs < 12 ? 'push' : best;
}

/** Bot move. played: every card already played this round (including the current trick). */
export function botPlay(hand: JCard[], t: Play[], m: Mode, me: number, played: JCard[]): JCard {
  const opts = legal(hand, t, m);
  if (opts.length === 1) return opts[0];
  const gone = (c: JCard) => played.some((x) => same(x, c)) || hand.some((x) => same(x, c));
  // a card nobody else can beat in its own suit (trumps aside)
  const boss = (c: JCard) => {
    for (let r = 6; r <= 14; r++) {
      const o = { s: c.s, r };
      if (!gone(o) && power(o, m, c.s) > power(c, m, c.s)) return false;
    }
    return true;
  };
  const pts = (c: JCard) => points(c, m);
  const low = (cs: JCard[]) => cs.reduce((a, c) => (pts(c) + (isTrump(c, m) ? 15 : 0) < pts(a) + (isTrump(a, m) ? 15 : 0) || (pts(c) === pts(a) && power(c, m, c.s) < power(a, m, a.s)) ? c : a));

  if (!t.length) {
    const trumpsOut = typeof m === 'number' && Array.from({ length: 9 }, (_, i) => ({ s: m, r: 6 + i })).some((c) => !gone(c));
    if (trumpsOut) {
      const myTop = opts.filter((c) => isTrump(c, m) && boss(c));
      if (myTop.length) return myTop[0];
    }
    const sure = opts.filter((c) => !isTrump(c, m) && boss(c));
    if (sure.length) return sure.reduce((a, c) => (pts(c) > pts(a) ? c : a));
    return low(opts.filter((c) => !isTrump(c, m)).length ? opts.filter((c) => !isTrump(c, m)) : opts);
  }

  const lead = t[0].c.s;
  const w = trickWinner(t, m);
  const winCard = t.find((x) => x.p === w)!.c;
  const last = t.length === 3;
  const onTable = t.reduce((a, x) => a + pts(x.c), 0);
  if (w % 2 === me % 2) {
    // partner is winning: if it holds, add points (schmieren), otherwise play low
    const holds = last || boss(winCard);
    if (holds) {
      const side = opts.filter((c) => !isTrump(c, m));
      if (side.length) return side.reduce((a, c) => (pts(c) > pts(a) ? c : a));
    }
    return low(opts);
  }
  const wins = opts.filter((c) => trickWinner([...t, { p: me, c }], m) === me);
  if (wins.length) {
    const side = wins.filter((c) => !isTrump(c, m));
    if (side.length) {
      // last to play: take it with the most points; earlier: only if the card stands
      if (last) return side.reduce((a, c) => (pts(c) > pts(a) ? c : a));
      const stands = side.filter(boss);
      if (stands.length) return stands[0];
    }
    const trumps = wins.filter((c) => isTrump(c, m));
    if (trumps.length && (onTable >= 10 || (last && onTable > 0))) return trumps.reduce((a, c) => (power(c, m, lead) < power(a, m, lead) ? c : a));
    if (side.length && last) return side[0];
  }
  return low(opts);
}
