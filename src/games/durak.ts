// Durak (classic Russian rules, 36 cards, 2-6 players) with the popular "Schieben" (perevodnoy) option.
// The whole game is one plain object, changed only through act(); the host runs it, guests send actions.
// Seats go clockwise; the defender is the next active player after the attacker.
import { shuffle } from '../lib/cards.ts';
import type { JCard } from './jass.ts';

export type Card = JCard; // s 0 Herz, 1 Pik, 2 Kreuz, 3 Karo · r 6..14 (11 Bube, 12 Dame, 13 König, 14 Ass)
/** ab / db: who played the attack and the defence card (for the animations). */
export type Pair = { a: Card; d: Card | null; ab: number; db: number };
export type Opts = { transfer: boolean; allThrow: boolean };
export type Phase = 'play' | 'over';
export type Durak = {
  n: number; hands: Card[][]; deck: Card[]; trump: Card; table: Pair[]; discard: number;
  attacker: number; defender: number; taking: boolean; passed: boolean[]; first: boolean;
  out: number[];               // seats that got rid of all cards, in that order
  phase: Phase; loser: number; // -1 = draw (everybody out at once)
  opts: Opts; log: string;     // last event, for bubbles: 'beat' | 'take' | 'bito' | 'transfer' | ''
  taker: number;               // who picked up the last bout (-1: it went to the discard pile)
  lastTake: Card[];            // the cards of that pick-up
  turn: number;                // counts actions, so clients can tell a new state from an old one
  stall?: number;              // pick-ups in a row with an empty pack (bots can circle forever)
};
export type Action =
  | { t: 'attack'; c: Card }            // first card of a bout, or a throw-in of a rank already on the table
  | { t: 'beat'; c: Card; i: number }   // defender covers table pair i
  | { t: 'transfer'; c: Card }          // defender passes the attack on with a card of the same rank
  | { t: 'take' }                       // defender gives up and will pick everything up
  | { t: 'pass' };                      // an attacker is done adding cards

export const same = (a: Card, b: Card) => a.s === b.s && a.r === b.r;
export const beats = (d: Card, a: Card, trump: number) => (d.s === a.s ? d.r > a.r : d.s === trump);
export const fullDeck = (): Card[] => Array.from({ length: 36 }, (_, i) => ({ s: Math.floor(i / 9), r: 6 + (i % 9) }));
export const active = (g: Durak, p: number) => !g.out.includes(p) && (g.hands[p].length > 0 || g.deck.length > 0);
export const next = (g: Durak, p: number) => { for (let k = 1; k <= g.n; k++) { const q = (p + k) % g.n; if (active(g, q)) return q; } return -1; };
const ranksOnTable = (g: Durak) => new Set(g.table.flatMap((x) => (x.d ? [x.a.r, x.d.r] : [x.a.r])));
const open = (g: Durak) => g.table.filter((x) => !x.d).length;
/** Who may throw cards in right now: the attacker, and (classic) the defender's left neighbour or (option) everyone. */
export function throwers(g: Durak) {
  if (!g.table.length) return [g.attacker];
  const out = [g.attacker];
  const left = next(g, g.defender);
  for (let p = 0; p < g.n; p++) if (p !== g.defender && p !== g.attacker && active(g, p) && (g.opts.allThrow || p === left)) out.push(p);
  return out;
}

export function newGame(n: number, opts: Opts, lastLoser = -1): Durak {
  const deck = shuffle(fullDeck());
  const hands = Array.from({ length: n }, () => deck.splice(0, 6));
  // the trump card lies face up under the pack: it is the last card to be drawn
  const trump = deck.length ? deck[deck.length - 1] : hands[n - 1][5];
  const g: Durak = { n, hands, deck, trump, table: [], discard: 0, attacker: 0, defender: 0, taking: false, passed: Array(n).fill(false), first: true, out: [], phase: 'play', loser: -2, opts, log: '', turn: 0, taker: -1, lastTake: [] };
  if (lastLoser >= 0 && lastLoser < n) {
    // "den Dummkopf lehren": the player before the last durak attacks them
    g.attacker = (lastLoser - 1 + n) % n;
  } else {
    // first game: the lowest trump attacks (nobody holding a trump: seat 0)
    let best = 99;
    hands.forEach((h, p) => h.forEach((c) => { if (c.s === trump.s && c.r < best) { best = c.r; g.attacker = p; } }));
  }
  g.defender = next(g, g.attacker);
  return g;
}

/** Can seat p do this right now? */
export function legal(g: Durak, p: number, a: Action): boolean {
  if (g.phase !== 'play') return false;
  const has = (c: Card) => g.hands[p].some((x) => same(x, c));
  if (a.t === 'attack') {
    if (!has(a.c) || p === g.defender || !throwers(g).includes(p)) return false;
    if (!g.table.length) return p === g.attacker;
    if (!ranksOnTable(g).has(a.c.r)) return false;
    // at most 5 cards before the first discard, 6 after, and never more open cards than the defender holds
    return g.table.length < (g.first ? 5 : 6) && open(g) < g.hands[g.defender].length;
  }
  if (p !== g.defender) return a.t === 'pass' && throwers(g).includes(p) && g.table.length > 0 && !g.passed[p];
  if (a.t === 'take') return g.table.length > 0 && !g.taking && open(g) > 0;
  if (a.t === 'beat') {
    const x = g.table[a.i];
    return !g.taking && !!x && !x.d && has(a.c) && beats(a.c, x.a, g.trump.s);
  }
  if (a.t === 'transfer') {
    // only before anything is beaten, every card on the table has the same rank, and the next player can take it all
    if (!g.opts.transfer || g.taking || !has(a.c) || !g.table.length || g.table.some((x) => x.d)) return false;
    if (g.table.some((x) => x.a.r !== a.c.r)) return false;
    const to = next(g, g.defender);
    return to >= 0 && to !== g.defender && g.hands[to].length >= g.table.length + 1;
  }
  return false;
}

const take = (h: Card[], c: Card) => h.splice(h.findIndex((x) => same(x, c)), 1)[0];

/** Apply an action if it is legal. Returns false (and changes nothing) otherwise. */
export function act(g: Durak, p: number, a: Action): boolean {
  if (!legal(g, p, a)) return false;
  g.turn++;
  g.log = '';
  if (a.t === 'attack') {
    g.table.push({ a: take(g.hands[p], a.c), d: null, ab: p, db: -1 });
    g.passed = g.passed.map(() => false);
  } else if (a.t === 'beat') {
    g.table[a.i].d = take(g.hands[p], a.c);
    g.table[a.i].db = p;
    g.passed = g.passed.map(() => false); // the attackers may add more after a beat
    g.log = 'beat';
  } else if (a.t === 'transfer') {
    g.table.push({ a: take(g.hands[p], a.c), d: null, ab: p, db: -1 });
    g.attacker = g.defender;
    g.defender = next(g, g.defender);
    g.passed = g.passed.map(() => false);
    g.log = 'transfer';
  } else if (a.t === 'take') {
    g.taking = true;
    g.passed = g.passed.map(() => false);
    g.log = 'take';
  } else if (a.t === 'pass') {
    g.passed[p] = true;
  }
  settle(g);
  return true;
}

/** Ends the bout when nothing more can happen: all covered (or taking) and every thrower has passed or cannot add. */
function settle(g: Durak) {
  if (!g.table.length) return;
  const waiting = throwers(g).filter((p) => !g.passed[p] && canAdd(g, p));
  // a bout also ends when the defender has no cards left to be attacked with
  const full = g.table.length >= (g.first ? 5 : 6) || open(g) >= g.hands[g.defender].length;
  if (open(g) && !g.taking) return; // the defender still has to answer
  if (waiting.length && !full) return;
  endBout(g);
}
const canAdd = (g: Durak, p: number) => g.hands[p].some((c) => legal(g, p, { t: 'attack', c }));

function endBout(g: Durak) {
  const took = g.taking;
  if (took) { g.lastTake = g.table.flatMap((x) => (x.d ? [x.a, x.d] : [x.a])); g.hands[g.defender].push(...g.lastTake); g.log = 'take'; g.taker = g.defender; }
  else { g.discard += g.table.length * 2; g.log = 'bito'; g.first = false; g.taker = -1; g.lastTake = []; }
  g.table = [];
  g.taking = false;
  // draw up to six: attacker first, then the others clockwise, the defender last
  const order: number[] = [g.attacker];
  for (let k = 1; k < g.n; k++) { const q = (g.attacker + k) % g.n; if (q !== g.defender) order.push(q); }
  order.push(g.defender);
  for (const p of order) while (g.hands[p].length < 6 && g.deck.length) g.hands[p].push(g.deck.shift()!);
  // whoever is out of cards with an empty pack has finished
  for (const p of order) if (!g.hands[p].length && !g.deck.length && !g.out.includes(p)) g.out.push(p);
  const left = Array.from({ length: g.n }, (_, p) => p).filter((p) => !g.out.includes(p));
  if (left.length <= 1) { g.phase = 'over'; g.loser = left.length ? left[0] : -1; return; }
  // endgame where the same cards only go round and round: whoever holds the most is the durak
  g.stall = took && !g.deck.length ? (g.stall ?? 0) + 1 : 0;
  if (g.stall >= 40) { g.phase = 'over'; g.loser = left.reduce((a, p) => (g.hands[p].length > g.hands[a].length ? p : a)); return; }
  // next bout: the defender attacks if they held, otherwise the player after them
  g.attacker = !took && active(g, g.defender) ? g.defender : next(g, g.defender);
  g.defender = next(g, g.attacker);
  g.passed = Array(g.n).fill(false);
}

/** "Durak s pogonami": the durak's last pick-up held sixes, which can be slapped on the shoulders as epaulettes. */
export const pogony = (g: Durak) => g.phase === 'over' && g.loser >= 0 && g.taker === g.loser && g.lastTake.some((c) => c.r === 6);

/** Order for sorting a hand: by suit, trumps last, low to high. */
export const sortHand = (h: Card[], trump: number) => [...h].sort((a, b) => (a.s === trump ? 4 : a.s) - (b.s === trump ? 4 : b.s) || a.r - b.r);
const value = (c: Card, trump: number) => c.r + (c.s === trump ? 20 : 0);

// ---------- bots ----------
/** A sensible move for seat p, or null when it has nothing to do. */
export function bot(g: Durak, p: number): Action | null {
  if (g.phase !== 'play') return null;
  const T = g.trump.s, h = [...g.hands[p]].sort((a, b) => value(a, T) - value(b, T));
  const late = g.deck.length === 0;
  if (p === g.defender) {
    if (g.taking || !open(g)) return null;
    // transfer with a cheap card when that is cheaper than covering everything
    const tr = h.find((c) => c.s !== T && legal(g, p, { t: 'transfer', c }));
    if (tr && (g.table.length > 1 || late || Math.random() < 0.6)) return { t: 'transfer', c: tr };
    // cover every open card with the cheapest beater; if one cannot be covered, take
    const plan: [number, Card][] = [], used: Card[] = [];
    for (const [i, x] of g.table.entries()) {
      if (x.d) continue;
      const c = h.find((y) => !used.some((u) => same(u, y)) && beats(y, x.a, T));
      if (!c) return { t: 'take' };
      plan.push([i, c]); used.push(c);
    }
    // early in the game, giving up high trumps for small cards is not worth it
    const cost = plan.reduce((a, [, c]) => a + (c.s === T ? 10 + c.r : 0), 0);
    if (!late && g.deck.length > 6 && cost > 24 && g.table.length <= 2) return { t: 'take' };
    return { t: 'beat', c: plan[0][1], i: plan[0][0] };
  }
  if (!throwers(g).includes(p)) return null;
  if (!g.table.length) {
    if (p !== g.attacker) return null;
    // open with the lowest non-trump, a pair if there is one
    const pool = h.filter((c) => c.s !== T).length ? h.filter((c) => c.s !== T) : h;
    return { t: 'attack', c: pool[0] };
  }
  if (g.passed[p]) return null;
  // throw in cheap cards; trumps and aces only at the end of the game or when the defender is taking
  const add = h.find((c) => legal(g, p, { t: 'attack', c }) && (g.taking || late || (c.s !== T && c.r < 13)));
  if (add) return { t: 'attack', c: add };
  return { t: 'pass' };
}

/** Payout factor for not being the durak with n players: fair odds less 3 %. */
export const payout = (n: number) => Math.floor((n / (n - 1)) * 0.97 * 100) / 100;
