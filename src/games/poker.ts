// No-limit Texas Hold'em: hand evaluation, betting rounds, side pots, bot strategy.
import { newShoe, type Card } from '../lib/cards.ts';

// ---------- hand evaluation ----------
const val = (c: Card) => (c.r === 1 ? 14 : c.r);
export const CATEGORY = ['high', 'pair', 'twoPair', 'trips', 'straight', 'flush', 'fullHouse', 'quads', 'straightFlush', 'royal'] as const;
export type Category = (typeof CATEGORY)[number];

/** Score of exactly five cards; higher is better. Category in the top digits, kickers below (base 15). */
export function score5(cards: Card[]) {
  const vs = cards.map(val).sort((a, b) => b - a);
  const flush = cards.every((c) => c.s === cards[0].s);
  const uniq = [...new Set(vs)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (vs[0] - vs[4] === 4) straightHigh = vs[0];
    else if (vs[0] === 14 && vs[1] === 5) straightHigh = 5; // wheel A-2-3-4-5
  }
  const groups = uniq.map((v) => [v, vs.filter((x) => x === v).length]).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const counts = groups.map((g) => g[1]);
  let cat: number, kick: number[];
  if (straightHigh && flush) { cat = straightHigh === 14 ? 9 : 8; kick = [straightHigh]; }
  else if (counts[0] === 4) { cat = 7; kick = groups.map((g) => g[0]); }
  else if (counts[0] === 3 && counts[1] === 2) { cat = 6; kick = groups.map((g) => g[0]); }
  else if (flush) { cat = 5; kick = vs; }
  else if (straightHigh) { cat = 4; kick = [straightHigh]; }
  else if (counts[0] === 3) { cat = 3; kick = groups.map((g) => g[0]); }
  else if (counts[0] === 2 && counts[1] === 2) { cat = 2; kick = groups.map((g) => g[0]); }
  else if (counts[0] === 2) { cat = 1; kick = groups.map((g) => g[0]); }
  else { cat = 0; kick = vs; }
  let s = cat;
  for (let i = 0; i < 5; i++) s = s * 15 + (kick[i] ?? 0);
  return s;
}
export const categoryOf = (score: number) => CATEGORY[Math.floor(score / 15 ** 5)];

const COMBOS: Record<number, number[][]> = {};
function combos(n: number) {
  if (COMBOS[n]) return COMBOS[n];
  const out: number[][] = [];
  const rec = (start: number, acc: number[]) => {
    if (acc.length === 5) return void out.push([...acc]);
    for (let i = start; i < n; i++) rec(i + 1, [...acc, i]);
  };
  rec(0, []);
  return (COMBOS[n] = out);
}

/** Best five of 5-7 cards. */
export function bestHand(cards: Card[]) {
  let best = -1, pick: Card[] = [];
  for (const idx of combos(cards.length)) {
    const five = idx.map((i) => cards[i]);
    const s = score5(five);
    if (s > best) { best = s; pick = five; }
  }
  return { score: best, cards: pick, cat: categoryOf(best) };
}

/** Rank value of the main group, for naming ("pair of kings"). */
export const topRanks = (score: number) => {
  const k: number[] = [];
  let s = score;
  for (let i = 0; i < 5; i++) { k.unshift(s % 15); s = Math.floor(s / 15); }
  return k;
};

// ---------- table ----------
export type Seat = {
  id: string | null; name: string; bot: boolean; style: number;
  stack: number; bet: number; total: number; cards: Card[];
  folded: boolean; allIn: boolean; acted: boolean; locked: boolean; // locked = may not re-raise (incomplete raise)
  inHand: boolean; last: string; won: number; show: boolean; leaving?: boolean;
};
export type Pot = { amount: number; eligible: number[] };
export type Street = 'idle' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export type Table = {
  seats: Seat[]; button: number; sb: number; bb: number; street: Street; board: Card[]; deck: Card[];
  turn: number; currentBet: number; minRaise: number; pots: Pot[]; hand: number; log: string[];
  winners: { seat: number; amount: number; score: number; cards: Card[] }[];
};

export const SEATS = 6;
export const emptySeat = (): Seat => ({ id: null, name: '', bot: false, style: 0, stack: 0, bet: 0, total: 0, cards: [], folded: false, allIn: false, acted: false, locked: false, inHand: false, last: '', won: 0, show: false });
export const newTable = (sb = 5, bb = 10): Table => ({
  seats: Array.from({ length: SEATS }, emptySeat), button: -1, sb, bb, street: 'idle', board: [], deck: [], turn: -1,
  currentBet: 0, minRaise: bb, pots: [], hand: 0, log: [], winners: [],
});

const next = (T: Table, from: number, ok: (s: Seat, i: number) => boolean) => {
  for (let k = 1; k <= SEATS; k++) { const i = (from + k) % SEATS; if (ok(T.seats[i], i)) return i; }
  return -1;
};
const canAct = (s: Seat) => s.inHand && !s.folded && !s.allIn;
export const live = (T: Table) => T.seats.filter((s) => s.inHand && !s.folded);
export const potTotal = (T: Table) => T.seats.reduce((a, s) => a + s.total, 0);

function put(s: Seat, amount: number) {
  const a = Math.min(amount, s.stack);
  s.stack -= a;
  s.bet += a;
  s.total += a;
  if (s.stack === 0) s.allIn = true;
  return a;
}

/** Start a new hand. Returns false if fewer than two players have chips. */
export function startHand(T: Table) {
  const ready = T.seats.filter((s) => s.id && s.stack > 0);
  if (ready.length < 2) return false;
  T.deck = newShoe(1);
  T.board = [];
  T.pots = [];
  T.winners = [];
  T.log = [];
  T.hand++;
  for (const s of T.seats) Object.assign(s, { bet: 0, total: 0, cards: [], folded: false, allIn: false, acted: false, locked: false, inHand: !!s.id && s.stack > 0, last: '', won: 0, show: false });
  T.button = next(T, T.button < 0 ? Math.floor(Math.random() * SEATS) : T.button, (s) => s.inHand);
  const headsUp = ready.length === 2;
  const sbSeat = headsUp ? T.button : next(T, T.button, (s) => s.inHand);
  const bbSeat = next(T, sbSeat, (s) => s.inHand);
  put(T.seats[sbSeat], T.sb);
  T.seats[sbSeat].last = 'sb';
  put(T.seats[bbSeat], T.bb);
  T.seats[bbSeat].last = 'bb';
  T.currentBet = T.bb;
  T.minRaise = T.bb;
  for (let r = 0; r < 2; r++) for (let k = 1; k <= SEATS; k++) { const s = T.seats[(T.button + k) % SEATS]; if (s.inHand) s.cards.push(T.deck.pop()!); }
  T.street = 'preflop';
  T.turn = next(T, bbSeat, canAct);
  if (T.turn < 0 || roundDone(T)) T.turn = -1;
  return true;
}

export type Legal = { fold: boolean; check: boolean; call: number; minTo: number; maxTo: number; canRaise: boolean };
export function legal(T: Table, i: number): Legal {
  const s = T.seats[i];
  const toCall = Math.min(T.currentBet - s.bet, s.stack);
  const maxTo = s.bet + s.stack;
  const minTo = Math.min(maxTo, T.currentBet + T.minRaise);
  return { fold: toCall > 0, check: toCall === 0, call: toCall, minTo, maxTo, canRaise: !s.locked && maxTo > T.currentBet };
}

export type Move = { type: 'fold' | 'check' | 'call' | 'raise'; to?: number };

/** Apply a move for the seat whose turn it is. Returns false if it was not legal. */
export function act(T: Table, i: number, m: Move) {
  if (T.turn !== i || T.street === 'idle' || T.street === 'showdown') return false;
  const s = T.seats[i], L = legal(T, i);
  if (m.type === 'fold') { s.folded = true; s.last = 'fold'; }
  else if (m.type === 'check') { if (!L.check) return false; s.last = 'check'; }
  else if (m.type === 'call') { if (L.check) { s.last = 'check'; } else { put(s, L.call); s.last = s.allIn ? 'allin' : 'call'; } }
  else {
    if (!L.canRaise) return false;
    const prev = T.currentBet;
    const to = Math.max(L.minTo, Math.min(L.maxTo, Math.round(m.to ?? L.minTo)));
    put(s, to - s.bet);
    const raiseBy = s.bet - prev;
    const full = raiseBy >= T.minRaise;
    if (full) T.minRaise = raiseBy;
    T.currentBet = s.bet;
    for (const o of T.seats) {
      if (o === s || !canAct(o)) continue;
      // a full raise reopens the action; after a short all-in, players who already acted may only call or fold
      if (full) { o.acted = false; o.locked = false; }
      else if (o.acted) { o.acted = false; o.locked = true; }
    }
    s.last = s.allIn ? 'allin' : prev === 0 ? 'bet' : 'raise';
  }
  s.acted = true;
  T.log.push(`${s.name}: ${s.last}${s.last === 'raise' || s.last === 'bet' || s.last === 'allin' ? ' ' + s.bet : s.last === 'call' ? ' ' + s.bet : ''}`);
  T.turn = roundDone(T) ? -1 : next(T, i, (o) => canAct(o) && (!o.acted || o.bet < T.currentBet));
  return true;
}

/** Betting round over? (everyone still able to act has acted and matched, or nobody is left to bet against) */
export function roundDone(T: Table) {
  if (live(T).length <= 1) return true;
  const actors = T.seats.filter(canAct);
  if (!actors.length) return true;
  if (actors.every((s) => s.acted && s.bet === T.currentBet)) return true;
  return actors.length === 1 && actors[0].bet >= T.currentBet;
}

/** Close the betting round: deal the next street or go to showdown. Returns the new street. */
export function nextStreet(T: Table): Street {
  for (const s of T.seats) { s.bet = 0; s.acted = false; s.locked = false; if (!s.folded && !s.allIn) s.last = ''; }
  T.currentBet = 0;
  T.minRaise = T.bb;
  if (live(T).length <= 1) return showdown(T);
  if (T.street === 'preflop') { T.deck.pop(); T.board.push(T.deck.pop()!, T.deck.pop()!, T.deck.pop()!); T.street = 'flop'; }
  else if (T.street === 'flop') { T.deck.pop(); T.board.push(T.deck.pop()!); T.street = 'turn'; }
  else if (T.street === 'turn') { T.deck.pop(); T.board.push(T.deck.pop()!); T.street = 'river'; }
  else return showdown(T);
  const actors = T.seats.filter(canAct);
  T.turn = actors.length >= 2 ? next(T, T.button, canAct) : -1; // everyone all-in: run the board out
  return T.street;
}

/** Split contributions into main and side pots. Chips of folded players stay in the pots they reached. */
export function buildPots(T: Table): Pot[] {
  const players = T.seats.map((s, i) => ({ s, i })).filter(({ s }) => s.inHand);
  const levels = [...new Set(players.filter(({ s }) => !s.folded).map(({ s }) => s.total))].sort((a, b) => a - b);
  const pots: Pot[] = [];
  let prev = 0;
  for (const L of levels) {
    const amount = players.reduce((a, { s }) => a + Math.max(0, Math.min(s.total, L) - Math.min(s.total, prev)), 0);
    const eligible = players.filter(({ s }) => !s.folded && s.total >= L).map(({ i }) => i);
    if (amount) pots.push({ amount, eligible });
    prev = L;
  }
  const rest = players.reduce((a, { s }) => a + Math.max(0, s.total - prev), 0);
  if (rest && pots.length) pots[pots.length - 1].amount += rest;
  return pots;
}

export function showdown(T: Table): Street {
  T.street = 'showdown';
  T.turn = -1;
  while (T.board.length < 5 && live(T).length > 1) T.board.push(T.deck.pop()!);
  T.pots = buildPots(T);
  const scores = new Map<number, ReturnType<typeof bestHand>>();
  const contested = live(T).length > 1;
  T.seats.forEach((s, i) => { if (s.inHand && !s.folded) { if (contested) { scores.set(i, bestHand([...s.cards, ...T.board])); s.show = true; } } });
  // won without a showdown: everybody turns their cards over, so you can see what you were up against
  if (!contested) for (const s of T.seats) if (s.cards.length) s.show = true;
  const order = (i: number) => (i - T.button - 1 + SEATS) % SEATS; // odd chips go left of the button
  for (const pot of T.pots) {
    let winners = pot.eligible;
    if (contested) {
      const top = Math.max(...pot.eligible.map((i) => scores.get(i)!.score));
      winners = pot.eligible.filter((i) => scores.get(i)!.score === top);
    }
    winners.sort((a, b) => order(a) - order(b));
    const share = Math.floor(pot.amount / winners.length);
    let odd = pot.amount - share * winners.length;
    for (const w of winners) {
      const amount = share + (odd-- > 0 ? 1 : 0);
      T.seats[w].stack += amount;
      T.seats[w].won += amount;
    }
  }
  T.winners = T.seats.map((s, i) => ({ s, i })).filter(({ s }) => s.won > 0).map(({ s, i }) => ({ seat: i, amount: s.won, score: scores.get(i)?.score ?? -1, cards: scores.get(i)?.cards ?? [] }));
  for (const s of T.seats) { s.bet = 0; }
  return 'showdown';
}

// ---------- bots ----------
/** Monte Carlo equity of a hand against `opponents` random hands. */
export function equity(hole: Card[], board: Card[], opponents: number, iterations = 260) {
  const used = new Set([...hole, ...board].map((c) => c.r * 4 + c.s));
  const deck: Card[] = [];
  for (let r = 1; r <= 13; r++) for (let s = 0; s < 4; s++) if (!used.has(r * 4 + s)) deck.push({ r, s });
  let win = 0;
  for (let it = 0; it < iterations; it++) {
    for (let i = deck.length - 1; i > deck.length - 1 - (opponents * 2 + 5 - board.length); i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    let p = deck.length;
    const full = [...board];
    while (full.length < 5) full.push(deck[--p]);
    const mine = bestHand([...hole, ...full]).score;
    let best = 0, ties = 0, lost = false;
    for (let o = 0; o < opponents; o++) {
      const s = bestHand([deck[--p], deck[--p], ...full]).score;
      if (s > mine) { lost = true; break; }
      if (s === mine) ties++;
      best = Math.max(best, s);
    }
    if (!lost) win += ties ? 1 / (ties + 1) : 1;
  }
  return win / iterations;
}

/** Bill Chen's preflop formula, normalised to roughly 0..1. */
export function chen(hole: Card[]) {
  const [a, b] = hole.map(val).sort((x, y) => y - x);
  const base = (v: number) => (v === 14 ? 10 : v === 13 ? 8 : v === 12 ? 7 : v === 11 ? 6 : v / 2);
  let p = base(a);
  if (a === b) p = Math.max(5, p * 2);
  if (hole[0].s === hole[1].s) p += 2;
  const gap = a - b - 1;
  if (a !== b) p -= gap <= 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
  if (a !== b && gap <= 1 && a < 12) p += 1;
  return Math.max(0, Math.min(1, p / 20));
}

/** Styles: 0 tight-aggressive, 1 loose-passive, 2 maniac, 3 rock, 4 balanced. */
const STYLES = [
  { vpip: 0.42, aggr: 0.7, bluff: 0.08 },
  { vpip: 0.26, aggr: 0.25, bluff: 0.04 },
  { vpip: 0.2, aggr: 0.9, bluff: 0.2 },
  { vpip: 0.52, aggr: 0.45, bluff: 0.02 },
  { vpip: 0.34, aggr: 0.55, bluff: 0.1 },
];

export function botMove(T: Table, i: number): Move {
  const s = T.seats[i], L = legal(T, i), st = STYLES[s.style % STYLES.length];
  const opp = live(T).length - 1;
  const pot = potTotal(T);
  const strength = T.street === 'preflop' ? chen(s.cards) * 0.9 + 0.1 : equity(s.cards, T.board, Math.max(1, opp), 220);
  const potOdds = L.call / (pot + L.call || 1);
  const rnd = Math.random();
  const raiseTo = (frac: number) => Math.max(L.minTo, Math.min(L.maxTo, Math.round(T.currentBet + (pot + L.call) * frac)));
  if (T.street === 'preflop') {
    const bar = st.vpip; // hands with chen-strength above this play
    if (strength > bar + 0.3 && L.canRaise && rnd < st.aggr + 0.2) return { type: 'raise', to: raiseTo(0.8 + rnd) };
    if (strength > bar || (L.check && rnd < 0.9)) return L.check ? (L.canRaise && strength > bar + 0.15 && rnd < st.aggr ? { type: 'raise', to: raiseTo(0.6) } : { type: 'check' }) : L.call > s.stack * 0.5 && strength < bar + 0.25 ? { type: 'fold' } : { type: 'call' };
    if (L.canRaise && rnd < st.bluff * 0.5) return { type: 'raise', to: raiseTo(0.7) };
    return L.check ? { type: 'check' } : { type: 'fold' };
  }
  const share = 1 / (opp + 1);
  if (strength > Math.max(0.62, share * 1.8) && L.canRaise && rnd < st.aggr) return { type: 'raise', to: raiseTo(strength > 0.85 ? 1 : 0.6) };
  if (L.check) {
    if (L.canRaise && rnd < st.bluff) return { type: 'raise', to: raiseTo(0.5) };
    if (L.canRaise && strength > share * 1.4 && rnd < st.aggr * 0.6) return { type: 'raise', to: raiseTo(0.5) };
    return { type: 'check' };
  }
  if (strength > potOdds + 0.05 || (strength > potOdds - 0.05 && rnd < 0.3)) return { type: 'call' };
  if (L.canRaise && rnd < st.bluff * 0.4) return { type: 'raise', to: raiseTo(0.7) };
  return { type: 'fold' };
}
