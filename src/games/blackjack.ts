// Blackjack engine. State is a plain serialisable object so the host can broadcast it as-is.
import { newShoe, type Card } from '../lib/cards.ts';

export type Rules = {
  decks: number;
  h17: boolean; // dealer hits soft 17
  bjPays: number; // 1.5 = 3:2, 1.2 = 6:5, 1 = 1:1
  double: 'any' | '9-11' | '10-11';
  das: boolean; // double after split
  maxSplits: number; // 0..3
  rsa: boolean; // resplit aces
  surrender: boolean; // late surrender
  insurance: boolean;
  peek: boolean; // false = European no-hole-card
};

export const PRESETS: Record<string, Rules> = {
  vegas: { decks: 6, h17: false, bjPays: 1.5, double: 'any', das: true, maxSplits: 3, rsa: false, surrender: true, insurance: true, peek: true },
  atlantic: { decks: 8, h17: false, bjPays: 1.5, double: 'any', das: true, maxSplits: 3, rsa: false, surrender: true, insurance: true, peek: true },
  european: { decks: 6, h17: false, bjPays: 1.5, double: '9-11', das: false, maxSplits: 1, rsa: false, surrender: false, insurance: true, peek: false },
  single: { decks: 1, h17: true, bjPays: 1.2, double: '10-11', das: false, maxSplits: 1, rsa: false, surrender: false, insurance: true, peek: true },
  downtown: { decks: 2, h17: true, bjPays: 1.5, double: 'any', das: true, maxSplits: 3, rsa: true, surrender: false, insurance: true, peek: true },
};

export type Hand = { cards: Card[]; bet: number; done?: boolean; split?: boolean; doubled?: boolean; surrendered?: boolean; result?: 'win' | 'lose' | 'push' | 'bj' | 'bust' | 'surrender'; payout?: number };
export type Seat = { owner: string | null; name: string; bot: boolean; bet: number; hands: Hand[]; ins: number | null; net: number };
export type Phase = 'bet' | 'deal' | 'insurance' | 'play' | 'dealer' | 'done';
export type BJ = { rules: Rules; shoe: Card[]; seats: Seat[]; dealer: Card[]; hole: boolean; phase: Phase; turn: [number, number] | null; round: number };

export const SEATS = 5;
export const emptySeat = (): Seat => ({ owner: null, name: '', bot: false, bet: 0, hands: [], ins: null, net: 0 });
export const newTable = (rules: Rules = PRESETS.vegas): BJ => ({ rules: { ...rules }, shoe: newShoe(rules.decks), seats: Array.from({ length: SEATS }, emptySeat), dealer: [], hole: false, phase: 'bet', turn: null, round: 0 });

export function total(cards: Card[]) {
  let t = 0, aces = 0;
  for (const c of cards) {
    if (c.r === 0) continue;
    t += Math.min(c.r, 10);
    if (c.r === 1) aces++;
  }
  const soft = aces > 0 && t + 10 <= 21;
  return { t: soft ? t + 10 : t, soft };
}
const rankVal = (c: Card) => Math.min(c.r, 10);
export const isBJ = (h: Pick<Hand, 'cards' | 'split'>) => !h.split && h.cards.length === 2 && total(h.cards).t === 21;

export function draw(st: BJ): Card {
  if (!st.shoe.length) st.shoe = newShoe(st.rules.decks);
  return st.shoe.pop()!;
}

const active = (st: BJ) => st.seats.filter((s) => s.hands.length);
export const current = (st: BJ) => (st.turn ? st.seats[st.turn[0]].hands[st.turn[1]] : undefined);

export function canHit(h: Hand) {
  return !h.done && !(h.split && h.cards[0].r === 1);
}
export function canDouble(st: BJ, s: Seat, h: Hand) {
  if (h.done || h.cards.length !== 2 || (h.split && !st.rules.das) || (h.split && h.cards[0].r === 1)) return false;
  const t = total(h.cards);
  return st.rules.double === 'any' || (st.rules.double === '9-11' ? !t.soft && t.t >= 9 && t.t <= 11 : !t.soft && t.t >= 10 && t.t <= 11);
}
export function canSplit(st: BJ, s: Seat, h: Hand) {
  if (h.done && !(h.split && h.cards[0].r === 1 && st.rules.rsa)) return false;
  if (h.cards.length !== 2 || rankVal(h.cards[0]) !== rankVal(h.cards[1]) || s.hands.length > st.rules.maxSplits) return false;
  return !(h.split && h.cards[0].r === 1 && !st.rules.rsa);
}
export const canSurrender = (st: BJ, s: Seat, h: Hand) => st.rules.surrender && !h.done && !h.split && h.cards.length === 2 && s.hands.length === 1;

/** Start a round for every seat that has a bet. Returns false if nobody bet. */
export function start(st: BJ) {
  if (st.shoe.length < st.rules.decks * 52 * 0.25) st.shoe = newShoe(st.rules.decks); // cut card at 75 %
  st.dealer = [];
  st.hole = false;
  st.turn = null;
  for (const s of st.seats) Object.assign(s, { hands: s.bet > 0 && s.owner ? [{ cards: [], bet: s.bet }] : [], ins: null, net: 0 });
  if (!active(st).length) return false;
  st.phase = 'deal';
  return true;
}

/** The order cards are dealt in: each seat, then dealer, twice (dealer gets no hole card without peek). */
export function* dealOrder(st: BJ): Generator<() => void> {
  for (let pass = 0; pass < 2; pass++) {
    for (const s of active(st)) yield () => s.hands[0].cards.push(draw(st));
    if (pass === 0 || st.rules.peek) yield () => { st.dealer.push(draw(st)); st.hole = pass === 1; };
  }
}

/** After the deal: insurance? peek? then hand control to the first player. */
export function afterDeal(st: BJ) {
  for (const s of active(st)) if (isBJ(s.hands[0])) s.hands[0].done = true;
  if (st.rules.insurance && st.dealer[0].r === 1 && st.phase !== 'insurance') {
    st.phase = 'insurance';
    for (const s of active(st)) s.ins = s.bot || isBJ(s.hands[0]) ? 0 : null;
    if (active(st).some((s) => s.ins === null)) return;
  }
  if (st.rules.peek && (st.dealer[0].r === 1 || rankVal(st.dealer[0]) >= 10) && total(st.dealer).t === 21) return settle(st);
  st.phase = 'play';
  st.turn = null;
  advance(st);
}

export function insure(st: BJ, seat: number, take: boolean) {
  const s = st.seats[seat];
  if (st.phase !== 'insurance' || s.ins !== null) return;
  s.ins = take ? s.hands[0].bet / 2 : 0;
  if (active(st).every((x) => x.ins !== null)) afterDeal(st);
}

/** Move the turn pointer to the next unfinished hand, or to the dealer. */
export function advance(st: BJ) {
  for (let i = 0; i < st.seats.length; i++)
    for (let j = 0; j < st.seats[i].hands.length; j++) {
      const h = st.seats[i].hands[j];
      if (!h.done && total(h.cards).t >= 21) h.done = true;
      if (!h.done) return void (st.turn = [i, j]);
    }
  st.turn = null;
  st.phase = 'dealer';
}

export type Action = 'hit' | 'stand' | 'double' | 'split' | 'surrender';

export function act(st: BJ, a: Action) {
  if (st.phase !== 'play' || !st.turn) return false;
  const [si, hi] = st.turn;
  const s = st.seats[si], h = s.hands[hi];
  if (a === 'hit' && canHit(h)) h.cards.push(draw(st));
  else if (a === 'stand') h.done = true;
  else if (a === 'double' && canDouble(st, s, h)) {
    h.bet *= 2;
    h.doubled = true;
    h.cards.push(draw(st));
    h.done = true;
  } else if (a === 'split' && canSplit(st, s, h)) {
    const b: Hand = { cards: [h.cards.pop()!], bet: h.bet, split: true };
    h.split = true;
    h.done = false;
    s.hands.splice(hi + 1, 0, b);
    for (const x of [h, b]) {
      x.cards.push(draw(st));
      if (x.cards[0].r === 1) x.done = !(st.rules.rsa && x.cards[1].r === 1 && s.hands.length <= st.rules.maxSplits);
    }
  } else if (a === 'surrender' && canSurrender(st, s, h)) {
    h.surrendered = true;
    h.done = true;
  } else return false;
  if (total(h.cards).t > 21) h.done = true;
  if (h.done) advance(st);
  return true;
}

/** Does the dealer still need to draw a card? */
export function dealerNeedsCard(st: BJ) {
  const live = active(st).some((s) => s.hands.some((h) => !h.surrendered && total(h.cards).t <= 21 && !isBJ(h)));
  if (st.dealer.length < 2) return true; // no-hole-card game: always complete the dealer hand
  if (!live) return false;
  const { t, soft } = total(st.dealer);
  return t < 17 || (t === 17 && soft && st.rules.h17);
}

export function settle(st: BJ) {
  st.hole = false;
  const d = total(st.dealer).t;
  const dBJ = isBJ({ cards: st.dealer });
  for (const s of active(st)) {
    let stake = (s.ins ?? 0), back = dBJ ? (s.ins ?? 0) * 3 : 0;
    for (const h of s.hands) {
      const p = total(h.cards).t;
      stake += h.bet;
      const pBJ = isBJ(h);
      const [res, pay]: [Hand['result'], number] =
        h.surrendered ? ['surrender', h.bet / 2]
        : p > 21 ? ['bust', 0]
        : pBJ && !dBJ ? ['bj', h.bet * (1 + st.rules.bjPays)]
        : dBJ && !pBJ ? ['lose', 0]
        : pBJ && dBJ ? ['push', h.bet]
        : d > 21 || p > d ? ['win', h.bet * 2]
        : p === d ? ['push', h.bet] : ['lose', 0];
      h.result = res;
      h.payout = pay;
      back += pay;
    }
    s.net = back - stake;
  }
  st.turn = null;
  st.phase = 'done';
  st.round++;
}

/** Money a seat owner has committed (for affordability checks). Between rounds that is just the standing bets. */
export const exposure = (st: BJ, owner: string) =>
  st.seats
    .filter((s) => s.owner === owner)
    .reduce((sum, s) => sum + (st.phase === 'bet' || st.phase === 'done' ? s.bet : s.hands.reduce((a, h) => a + h.bet, 0) + (s.ins ?? 0)), 0);
