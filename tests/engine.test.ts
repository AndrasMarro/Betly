// One runnable check for the game math: node --experimental-strip-types tests/engine.test.ts
import assert from 'node:assert/strict';
import { spotAt, payout, OUTSIDE, ANNOUNCED } from '../src/games/roulette.ts';
import { MACHINES as BASE_MACHINES, ARMORY, CARDS, CROSSY, SNAKE, strips, spinGrid, evaluate } from '../src/games/slots.ts';
const MACHINES = [...BASE_MACHINES, CARDS, CROSSY, SNAKE, ...ARMORY];
import { newTable, start, dealOrder, afterDeal, act, settle, total, dealerNeedsCard, PRESETS } from '../src/games/blackjack.ts';

// Roulette: hotspots
const key = (x: number, y: number) => spotAt(x, y)!.key;
assert.equal(key(0.5, 2.5), '1'); // straight
assert.equal(key(1, 2.5), '1-4'); // split across columns
assert.equal(key(0.5, 2), '1-2'); // split across rows
assert.equal(key(1, 2), '1-2-4-5'); // corner
assert.equal(key(0.5, 2.99), '1-2-3'); // street
assert.equal(key(1, 2.99), '1-2-3-4-5-6'); // six line
assert.equal(key(-0.6, 1), '0'); // zero
assert.equal(key(0, 2.5), '0-1'); // split with zero
assert.equal(key(0, 2), '0-1-2'); // trio
assert.equal(key(0, 2.99), '0-1-2-3'); // first four
// Every bet type has house edge 1/37 (EV = 36/37 of stake).
for (const nums of [[7], [1, 4], [1, 2, 3], [1, 2, 4, 5], [1, 2, 3, 4, 5, 6], ...Object.values(OUTSIDE), ...Object.values(ANNOUNCED).flat()]) {
  let ret = 0;
  for (let r = 0; r <= 36; r++) ret += payout({ nums, amt: 1 }, r);
  assert.ok(Math.abs(ret / 37 - 36 / 37) < 1e-9, 'roulette EV ' + nums);
}
assert.equal(payout({ nums: OUTSIDE.red, amt: 10 }, 0, true), 5); // la partage

// Blackjack: totals + a forced round
assert.deepEqual(total([{ r: 1, s: 0 }, { r: 6, s: 0 }]), { t: 17, soft: true });
assert.equal(total([{ r: 1, s: 0 }, { r: 6, s: 0 }, { r: 10, s: 0 }]).t, 17);
const st = newTable(PRESETS.vegas);
st.seats[0] = { ...st.seats[0], owner: 'me', name: 'me', bet: 10 };
// stack the shoe (draw pops from the end): player 10, dealer 9, player 1(A), dealer 7 -> player blackjack
st.shoe.push({ r: 7, s: 0 }, { r: 1, s: 0 }, { r: 9, s: 0 }, { r: 10, s: 0 });
assert.ok(start(st));
for (const deal of dealOrder(st)) deal();
afterDeal(st);
assert.equal(st.phase, 'dealer');
st.hole = false;
while (dealerNeedsCard(st)) st.dealer.push(st.shoe.pop()!);
settle(st);
assert.equal(st.seats[0].net, 15, 'blackjack pays 3:2');
// split + double flow doesn't throw and settles
const s2 = newTable(PRESETS.downtown);
s2.seats[2] = { ...s2.seats[2], owner: 'me', name: 'me', bet: 10 };
s2.shoe.push({ r: 5, s: 1 }, { r: 6, s: 1 }, { r: 8, s: 0 }, { r: 10, s: 1 }, { r: 8, s: 1 });
start(s2);
for (const deal of dealOrder(s2)) deal();
afterDeal(s2);
assert.equal(s2.phase, 'play');
assert.ok(act(s2, 'split'));
assert.equal(s2.seats[2].hands.length, 2);
while (s2.phase === 'play') act(s2, 'stand');
settle(s2);
assert.equal(s2.phase, 'done');

// Slots: RTP within a sane band
for (const m of MACHINES) {
  const reels = strips(m);
  let bet = 0, won = 0, free = 0;
  const N = 400_000;
  for (let i = 0; i < N; i++) {
    const isFree = free > 0;
    if (isFree) free--; else bet += m.lines.length;
    const r = evaluate(m, spinGrid(m, reels), 1);
    won += r.total * (isFree ? m.scatter!.mult : 1);
    free += r.free;
  }
  const rtp = won / bet;
  console.log(`${m.name}: RTP ${(rtp * 100).toFixed(2)} %`);
  assert.ok(rtp > 0.9 && rtp < 0.99, m.name + ' RTP out of band');
}
console.log('all engine checks passed');

// Arcade: every strategy returns ~97 %
import { crashPoint, minesMult, diceMult, diceProb, mineMult, hopMult, LEVELS, TILES } from '../src/games/arcade.ts';
{
  const N = 400_000;
  let ret = 0;
  for (let i = 0; i < N; i++) ret += crashPoint() >= 2 ? 2 : 0;
  console.log('crash cash@2x RTP', (ret / N).toFixed(3));
  assert.ok(Math.abs(ret / N - 0.97) < 0.01);
  // mines: exact expectation = P(survive k picks) * mult
  for (const mines of [1, 3, 10, 24]) for (let k = 1; k <= TILES - mines; k++) {
    let p = 1;
    for (let i = 0; i < k; i++) p *= (TILES - mines - i) / (TILES - i);
    assert.ok(p * minesMult(mines, k) <= 0.97 + 1e-9 && p * minesMult(mines, k) > 0.95, `mines ${mines}/${k}`);
  }
  for (const n of [1, 2, 3]) for (const f of [6, 8, 10]) {
    for (const bet of ['under', 'mid', 'over', 'same', ...Array.from({ length: n * f - n + 1 }, (_, i) => 's' + (n + i))]) {
      const p = diceProb(bet, n, f);
      if (!p) continue; // not offered (no exact middle, one die has no doubles)
      const ev = p * diceMult(bet, n, f);
      assert.ok(ev <= 0.97 + 1e-9 && ev > 0.9, `dice ${n}W${f} ${bet} ${ev}`);
    }
    assert.ok(Math.abs(diceProb('under', n, f) - diceProb('over', n, f)) < 1e-9, 'dice symmetric');
  }
  for (let m = 1; m <= 5; m++) for (let n = 1; n <= 3; n++) {
    const ev = ((6 - m) / 6) ** n * mineMult(m, n);
    assert.ok(ev <= 0.97 + 1e-9 && ev > 0.95, `mine dice ${m}/${n}`);
  }
  for (const [lv, q] of Object.entries(LEVELS)) for (let k = 1; k <= 15; k++) {
    const ev = q ** k * hopMult(lv as any, k);
    assert.ok(ev <= 0.97 + 1e-9 && ev > 0.95, `hop ${lv} ${k}`);
  }
  console.log('arcade checks passed');
}

// New arcade games
import { towerMult, towerSafe, TOWER, CLIMB, planMult, coinMult, hiloMult, pHigher, pLower, plinkoTable, plinkoProb, PLINKO_ROWS, RISKS, WHEELS, wheelLayout, SCRATCH, scratchCard } from '../src/games/arcade.ts';
{
  const near = (ev: number, what: string, lo = 0.95) => assert.ok(ev <= 0.97 + 1e-9 && ev > lo, `${what}: ${ev}`);
  for (const lv of Object.keys(TOWER) as (keyof typeof TOWER)[]) for (let k = 1; k <= 8; k++) near(towerSafe(lv) ** k * towerMult(lv, k), `tower ${lv} ${k}`);
  for (let k = 1; k <= CLIMB.length; k++) near(CLIMB.slice(0, k).reduce((a, [t, b]) => (a * (t - b)) / t, 1) * planMult(CLIMB, k), `climb ${k}`, 0.9);
  for (let k = 1; k <= 10; k++) near(0.5 ** k * coinMult(k), `coin ${k}`);
  for (let r = 1; r <= 13; r++) { near(pHigher(r) * hiloMult([pHigher(r)]), `hilo hi ${r}`, 0.9); near(pLower(r) * hiloMult([pLower(r)]), `hilo lo ${r}`, 0.9); }
  for (const rows of PLINKO_ROWS) for (const risk of Object.keys(RISKS) as (keyof typeof RISKS)[]) {
    const t = plinkoTable(rows, risk);
    const ev = t.reduce((a, m, i) => a + m * plinkoProb(rows, i), 0);
    assert.ok(Math.abs(ev - 0.97) < 0.015, `plinko ${rows} ${risk}: ${ev}`);
    console.log(`plinko ${rows} ${risk}`, t.join(' '), '→', ev.toFixed(4));
  }
  for (const [risk, segs] of Object.entries(WHEELS)) {
    assert.ok(Math.abs(segs.reduce((a, b) => a + b, 0) / segs.length - 0.97) < 1e-9, 'wheel ' + risk);
    assert.equal(wheelLayout(risk as any).length, segs.length);
  }
  assert.ok(Math.abs(SCRATCH.reduce((a, x) => a + x.mult * x.p, 0) - 0.97) < 1e-9);
  for (let i = 0; i < 2000; i++) {
    const { cells, prize } = scratchCard();
    const triples = [...new Set(cells)].filter((s) => cells.filter((c) => c === s).length >= 3);
    assert.deepEqual(triples, prize ? [prize.sym] : [], 'scratch layout');
  }
  console.log('new arcade checks passed');
}

import { CASES, caseRtp, RARITIES } from '../src/games/arcade.ts';
{
  assert.ok(Math.abs(RARITIES.reduce((a, r) => a + r.p, 0) - 1) < 1e-9);
  for (const c of CASES) assert.ok(caseRtp(c) <= 0.97 + 1e-9 && caseRtp(c) > 0.96, `case ${c.id} ${caseRtp(c)}`);
  console.log('cases RTP', caseRtp(CASES[0]).toFixed(4));
}

import { newGame, open, flag, chord, neighbours, detect, scan, solvable, tick, hunt, smartAfterFlag } from '../src/games/minesweeper.ts';
{
  for (let n = 0; n < 200; n++) {
    const ms = newGame(9, 9, 10);
    const first = Math.floor(Math.random() * 81);
    open(ms, first);
    assert.equal(ms.cells.filter((c) => c.mine).length, 10);
    assert.ok(!ms.cells[first].mine && ms.cells[first].n === 0, 'first click is safe and empty');
    assert.notEqual(ms.state, 'lost');
  }
  // play a full game by cheating: open every safe cell -> won
  const ms = newGame(16, 16, 40);
  open(ms, 0);
  ms.cells.forEach((c, i) => !c.mine && open(ms, i));
  assert.equal(ms.state, 'won');
  // chording with correct flags opens neighbours, a wrong flag loses
  const g = newGame(9, 9, 10);
  open(g, 40);
  const num = g.cells.findIndex((c) => c.open && c.n > 0);
  const nb = [-10, -9, -8, -1, 1, 8, 9, 10].map((d) => num + d).filter((j) => j >= 0 && j < 81 && Math.abs((j % 9) - (num % 9)) <= 1);
  nb.forEach((j) => g.cells[j].mine && flag(g, j));
  assert.ok(chord(g, num));
  assert.notEqual(g.state, 'lost');
  // arcade: hex neighbours, lives, shield, double mines, scanner, detector, no-guess, versus
  assert.equal(neighbours({ w: 5, h: 5, hex: true }, 12).length, 6);
  assert.equal(neighbours({ w: 5, h: 5 }, 12).length, 8);
  const a = newGame(10, 10, 15, { lives: 3, doubles: 0.3 });
  open(a, 0);
  assert.ok(a.cells.some((c) => c.mine === 2), 'double mines placed');
  const nsum = a.cells.reduce((x, c) => x + c.mine, 0);
  assert.ok(nsum > 15, 'doubles weigh 2');
  const m1 = a.cells.findIndex((c) => c.mine);
  assert.equal(open(a, m1), 'hit'); assert.equal(a.lives, 2); assert.ok(a.cells[m1].flag);
  a.shield = 1;
  const m2 = a.cells.findIndex((c, i) => c.mine && !c.flag && i !== m1);
  assert.equal(open(a, m2), 'shield'); assert.equal(a.lives, 2);
  const d = detect(a); assert.ok(d >= 0 && a.cells[d].mine && a.cells[d].flag);
  assert.equal(flag(a, d), false, 'game-placed flags are locked'); assert.equal(flag(a, m1), false);
  // gentle smart flagging: flagging the only mine next to a "1" opens that number's other neighbours
  const sm = newGame(9, 9, 10); open(sm, 40);
  const one = sm.cells.findIndex((c, i) => c.open && c.n === 1 && neighbours(sm, i).some((j) => !sm.cells[j].open && !sm.cells[j].mine));
  if (one >= 0) { const mine = neighbours(sm, one).find((j) => sm.cells[j].mine)!; flag(sm, mine); smartAfterFlag(sm, mine); assert.ok(neighbours(sm, one).every((j) => sm.cells[j].open || sm.cells[j].flag)); }
  const sc = newGame(9, 9, 10); open(sc, 40); const hid = sc.cells.findIndex((c) => !c.open);
  scan(sc, hid); assert.notEqual(sc.state, 'lost'); assert.ok(sc.cells[hid].open || sc.cells[hid].flag);
  let ng = 0;
  for (let k = 0; k < 20; k++) { const b = newGame(9, 9, 10, { noGuess: true }); open(b, 40); if (solvable(b, 40)) ng++; }
  assert.ok(ng >= 18, 'no-guess boards are solvable: ' + ng);
  const t = newGame(9, 9, 10, { timers: 1, moving: 2, lives: 3 }); open(t, 40);
  for (let k = 0; k < 30 && t.state === 'play'; k++) tick(t);
  assert.ok(t.state === 'play' || t.state === 'lost');
  const v = newGame(9, 9, 11);
  const mines0 = () => v.cells.findIndex((c) => c.mine && !c.open);
  assert.equal(hunt(v, 0, 'p1') === 'none', false);
  const mi = mines0(); assert.equal(hunt(v, mi, 'p1'), 'mine'); assert.equal(v.cells[mi].by, 'p1');
  console.log('minesweeper checks passed');
}

import { coup, payout as bacPay, bankerDraws } from '../src/games/baccarat.ts';
import { newShoe } from '../src/lib/cards.ts';
{
  assert.equal(bankerDraws(3, { r: 8, s: 0 }), false);
  assert.equal(bankerDraws(6, { r: 7, s: 0 }), true);
  assert.equal(bankerDraws(6, null), false);
  let shoe = newShoe(8);
  const draw = () => (shoe.length < 20 ? (shoe = newShoe(8)) : shoe).pop()!;
  const N = 300_000, ret: Record<string, number> = { player: 0, banker: 0, tie: 0 };
  for (let i = 0; i < N; i++) { const c = coup(draw); for (const k of ['player', 'banker', 'tie'] as const) ret[k] += bacPay(k, 1, c); }
  const edge = (k: string) => 1 - ret[k] / N;
  console.log('baccarat edge', Object.keys(ret).map((k) => k + ' ' + (edge(k) * 100).toFixed(2) + '%').join(', '));
  assert.ok(Math.abs(edge('banker') - 0.0106) < 0.008 && Math.abs(edge('player') - 0.0124) < 0.008 && Math.abs(edge('tie') - 0.144) < 0.03);
}

import { score5, bestHand, newTable as pkTable, startHand, act as pkAct, legal as pkLegal, roundDone, nextStreet, botMove, buildPots, chen, equity } from '../src/games/poker.ts';
{
  const C = (s: string) => s.split(' ').map((x) => ({ r: 'A23456789TJQK'.indexOf(x[0]) + 1, s: 'shdc'.indexOf(x[1]) }));
  const order = ['Ah Kh Qh Jh Th', '9c 8c 7c 6c 5c', '5d 4d 3d 2d Ad', 'Qs Qh Qd Qc 2h', 'Ks Kh Kd 2c 2h', 'Ah 9h 7h 4h 2h', 'Ts 9h 8d 7c 6s', '5s 4h 3d 2c As', '7s 7h 7d Kc 2h', 'Js Jh 4d 4c As', 'Js Jh 4d 4c Ks', 'Ts Th Ad Kc 2h', 'As Kh Qd Jc 9h', 'As Kh Qd Jc 8h'];
  for (let i = 1; i < order.length; i++) assert.ok(score5(C(order[i - 1])) > score5(C(order[i])), `${order[i - 1]} beats ${order[i]}`);
  assert.equal(score5(C('As Kh Qd Jc 9h')), score5(C('Ad Kc Qh Js 9s')), 'suits do not matter');
  assert.equal(bestHand(C('Ah Kh 2c 3d Qh Jh Th')).cat, 'royal');
  assert.equal(bestHand(C('2h 2d 2c 9s 9d 9h Ks')).cat, 'fullHouse');
  assert.ok(chen(C('Ah As')) > chen(C('7h 2c')));
  const e = equity(C('Ah As'), [], 1, 600);
  assert.ok(e > 0.78 && e < 0.9, 'AA vs random ~85%: ' + e);

  // side pots: A(100) B(300) C(500) all-in, D folds after putting 50
  const T = pkTable(5, 10);
  [100, 300, 500, 50].forEach((total, i) => Object.assign(T.seats[i], { id: 'p' + i, name: 'p' + i, inHand: true, total, folded: i === 3 }));
  const pots = buildPots(T);
  assert.deepEqual(pots.map((p) => p.amount), [350, 400, 200]);
  assert.deepEqual(pots.map((p) => p.eligible), [[0, 1, 2], [1, 2], [2]]);

  // many random hands: chips are conserved, every hand terminates
  const G = pkTable(5, 10);
  for (let i = 0; i < 6; i++) Object.assign(G.seats[i], { id: 'b' + i, name: 'b' + i, bot: true, style: i, stack: 1000 });
  for (let h = 0; h < 400; h++) {
    for (const s of G.seats) if (s.stack === 0) s.stack = 1000;
    const before = G.seats.reduce((a, s) => a + s.stack, 0);
    assert.ok(startHand(G));
    let guard = 0;
    while (G.street !== 'showdown') {
      assert.ok(guard++ < 200, 'hand terminates');
      if (G.turn >= 0) {
        const m = Math.random() < 0.7 ? botMove(G, G.turn) : (['fold', 'call', 'raise'] as const)[Math.floor(Math.random() * 3)];
        const mv = typeof m === 'string' ? { type: m, to: pkLegal(G, G.turn).minTo + Math.floor(Math.random() * 200) } : m;
        assert.ok(pkAct(G, G.turn, mv as any) || pkAct(G, G.turn, { type: 'call' }), 'move accepted');
      } else {
        assert.ok(roundDone(G));
        nextStreet(G);
      }
    }
    const after = G.seats.reduce((a, s) => a + s.stack, 0);
    assert.equal(after, before, 'chips conserved in hand ' + h);
  }
  console.log('poker checks passed');
}

import { SCRATCH3, pick3Symbols } from '../src/games/arcade.ts';
{
  assert.ok(Math.abs(SCRATCH3.reduce((a, x) => a + x.mult * x.p, 0) - 0.97) < 1e-9, 'pick-3 scratch RTP');
  {
    const { DIAMOND, DIAMOND_BONUS, diamondCard, NUMBERS, numbersCard } = await import('../src/games/arcade.ts');
    const mean = DIAMOND_BONUS.reduce((a, b) => a + b.m * b.p, 0);
    assert.ok(Math.abs(DIAMOND.reduce((a, x) => a + x.mult * x.p, 0) * mean - 0.97) < 1e-9, 'diamond RTP');
    assert.ok(Math.abs(NUMBERS.reduce((a, x) => a + x.mult * x.p, 0) - 0.97) < 1e-9, 'numbers RTP');
    for (let i = 0; i < 3000; i++) {
      const d = diamondCard();
      const triples = [...new Set(d.cells)].filter((s) => d.cells.filter((c) => c === s).length >= 3);
      assert.deepEqual(triples, d.prize ? [d.prize.sym] : [], 'diamond layout');
      const n = numbersCard(), hits = n.yours.filter((y) => n.winning.includes(y.n));
      assert.equal(hits.reduce((a, y) => a + y.mult, 0), n.prize, 'numbers layout');
      assert.equal(new Set(n.yours.map((y) => y.n)).size, 8, 'numbers distinct');
    }
  }
  for (let i = 0; i < 500; i++) { const s = pick3Symbols(null); assert.ok(!(s[0] === s[1] && s[1] === s[2]), 'losing pick never shows a triple'); }
  console.log('pick-3 checks passed');
}

import { CLASSIC_CASES, atLeastOneGold, caseRtp as cr } from '../src/games/arcade.ts';
{
  assert.ok(Math.abs(atLeastOneGold(385) - 0.632) < 0.002, 'geometric: 63.2 % after 385 openings');
  for (const c of CLASSIC_CASES) {
    const ev = cr(c);
    assert.ok(ev > 0.3 && ev < 0.65, 'classic case keeps a strongly negative EV: ' + ev);
    assert.equal(c.items.length, 12);
    console.log('classic', c.id, 'EV', ev.toFixed(4));
  }
  console.log('P(gold in 385)', atLeastOneGold(385).toFixed(4));
}

// Snake: movement, eating, walls/border, portals, daily setup
import { newSnake, step, factor, dailyMods, DEFAULT_MODS, multiplier } from '../src/games/snake.ts';
import { rng, dailyGame } from '../src/lib/daily.ts';
{
  const r = rng(1);
  const s = newSnake({ ...DEFAULT_MODS, rare: false }, r);
  const len = s.body.length;
  s.apples = [{ x: s.body[0].x + 1, y: s.body[0].y, kind: 'red', ttl: Infinity }];
  assert.equal(step(s, 'right', r), 'eat');
  assert.equal(s.points, 1);
  step(s, 'right', r);
  assert.equal(s.body.length, len + 1, 'snake grows by one after a red apple');
  assert.equal(step(s, 'left', r), 'move', 'reversing is ignored');
  while (s.alive) step(s, 'right', r);
  assert.ok(s.body[0].x === s.n - 1, 'dies at the right border');
  // portals: stepping onto one exits next to the other
  const p = newSnake({ ...DEFAULT_MODS, portals: true, rare: false }, rng(5));
  const [a, b] = p.portals!;
  p.body = [{ x: a.x - 1, y: a.y }, { x: a.x - 2, y: a.y }];
  p.dir = 'right';
  p.apples = [];
  step(p, 'right', rng(9));
  assert.deepEqual(p.body[0], { x: b.x + 1, y: b.y }, 'portal teleport');
  // walls spawn every third apple
  const w = newSnake({ ...DEFAULT_MODS, walls: true, rare: false }, rng(3));
  for (let i = 0; i < 3; i++) { const h = w.body[0]; w.apples = [{ x: h.x + 1, y: h.y, kind: 'red', ttl: Infinity }]; step(w, 'right', rng(i)); if (w.body[0].x > w.n - 3) break; }
  assert.ok(w.walls.length >= 1, 'a wall appeared');
  assert.ok(factor(dailyMods(rng(7)), true) > factor(DEFAULT_MODS), 'daily pays more');
  assert.deepEqual(dailyMods(rng(20261109)), dailyMods(rng(20261109)), 'daily is deterministic');
  assert.equal(dailyGame(20261109), dailyGame(20261109));
  s.points = 10;
  assert.equal(multiplier({ ...s, mods: DEFAULT_MODS }), 1, '10 points = 1x on default settings');
  // wrap: leaving on the right comes back on the left
  const wr = newSnake({ ...DEFAULT_MODS, wrap: true, rare: false }, rng(2));
  wr.apples = []; wr.body = [{ x: wr.n - 1, y: 3 }, { x: wr.n - 2, y: 3 }]; wr.dir = 'right';
  assert.equal(step(wr, 'right', rng(1)), 'move');
  assert.deepEqual(wr.body[0], { x: 0, y: 3 }, 'wrap around');
  // poison: minus 2 points and two pieces shorter
  const po = newSnake({ ...DEFAULT_MODS, poison: true, rare: false }, rng(4));
  po.body = Array.from({ length: 6 }, (_, i) => ({ x: 8 - i, y: 5 })); po.dir = 'right'; po.points = 5;
  po.apples = [{ x: 9, y: 5, kind: 'poison', ttl: 50 }];
  assert.equal(step(po, 'right', rng(1)), 'poison');
  assert.equal(po.points, 3); assert.equal(po.body.length, 4, 'poison shrinks');
  // hunger: without food the snake withers away
  const hu = newSnake({ ...DEFAULT_MODS, hunger: true, wrap: true, rare: false }, rng(6));
  hu.apples = [];
  let res = '';
  for (let i = 0; i < 200 && res !== 'dead'; i++) { hu.apples = []; res = step(hu, 'right', rng(i)); }
  assert.equal(res, 'dead', 'starved');
  // runaway apples stay on free cells inside the board
  const ru = newSnake({ ...DEFAULT_MODS, runner: true, many: true, wrap: true, rare: false }, rng(8));
  for (let i = 0; i < 80; i++) step(ru, 'down', rng(100 + i));
  assert.ok(ru.apples.every((q) => q.x >= 0 && q.y >= 0 && q.x < ru.n && q.y < ru.n && !ru.body.some((bb) => bb.x === q.x && bb.y === q.y)), 'runner apples stay free');
  assert.ok(factor({ ...DEFAULT_MODS, mirror: true }) > factor(DEFAULT_MODS) && factor({ ...DEFAULT_MODS, wrap: true }) < factor(DEFAULT_MODS), 'harder pays more');
  console.log('snake checks passed');
}

// Crossy: calm start, crocodiles only later, forgiving hitboxes
import { newWorld, ensure as crEnsure, hit as crHit, update as crUpdate, logAt as crLogAt } from '../src/games/crossy.ts';
{
  const w = newWorld(rng(42));
  crEnsure(w, 200);
  const cars = (from: number, to: number) => { const ls = w.lanes.slice(from, to).filter((l) => l.type === 'road'); return ls.reduce((a, l) => a + l.items.length, 0) / Math.max(1, ls.length); };
  assert.ok(cars(0, 25) < cars(60, 200), 'fewer cars per road early on');
  assert.ok(w.lanes.slice(0, 15).every((l) => l.items.every((it) => !it.weak)), 'no cracked logs early');
  assert.ok(w.lanes.slice(60).some((l) => l.items.some((it) => it.weak)), 'cracked logs later');
  assert.ok(w.lanes.every((l) => l.type !== 'river' || l.pads || l.items.some((it) => !it.weak)), 'every river keeps a solid log');
  const road = { type: 'road' as const, dir: 1 as const, speed: 1, items: [{ x: 3, len: 1, c: 0 }], trees: [], t: 0, train: null };
  assert.ok(crHit(road, 3) && !crHit(road, 3.95) && !crHit(road, 2.1), 'hitbox');
  const river = { ...road, type: 'river' as const, speed: 0, items: [{ x: 2, len: 3, c: 0, weak: true, breakT: 0 }] };
  const rw = { lanes: [river], rand: Math.random } as any;
  assert.ok(crLogAt(river, 3));
  crUpdate(rw, 1, 0, 0);
  assert.ok(!crLogAt(river, 3), 'a cracked log breaks under you');
  console.log('crossy checks passed');
}
import { multAt as crMult, coinShare } from '../src/games/crossy.ts';
{
  assert.equal(crMult(20), 1, 'break-even at 20 steps');
  assert.ok(crMult(50) > crMult(49) * 1.25, 'x1.3 at 50');
  assert.ok(crMult(10000) <= 50 && coinShare(1000) <= 0.3);
  const w = newWorld(rng(9)); crEnsure(w, 400);
  const coins = w.lanes.map((l, i) => (l.coin !== null ? i : -1)).filter((i) => i >= 0);
  for (let i = 1; i < coins.length; i++) assert.ok(coins[i] - coins[i - 1] >= 20, 'coins are spaced');
  assert.ok(coins.length >= 5 && coins.length <= 20, 'coins: ' + coins.length);
  assert.ok(w.lanes.some((l) => l.pads) && w.lanes.some((l) => Object.values(l.deco).includes('shop')));
  console.log('crossy stake checks passed');
}

// Security: lazily decided outcomes keep the same odds as pre-placed ones
import { crashStep, bustAtStart, lazyMine, multAt as rkMult } from '../src/games/arcade.ts';
{
  const N = 60000;
  let over2 = 0, sum = 0;
  for (let k = 0; k < N; k++) {
    let crash = 1;
    if (!bustAtStart()) {
      let prev = 1;
      for (let s = 0.05; ; s += 0.05) { const m = rkMult(s); const c = crashStep(prev, m); prev = m; if (c !== null) { crash = c; break; } }
    }
    if (crash >= 2) over2++;
    sum += crash >= 2 ? 2 : 0; // cash-out at 2x
  }
  assert.ok(Math.abs(over2 / N - 0.485) < 0.012, 'P(crash >= 2) ~ 0.97/2: ' + over2 / N);
  console.log('rocket (progressive) cash@2x RTP', (sum / N).toFixed(3));
  let hits = 0;
  for (let k = 0; k < 100000; k++) if (lazyMine(3, 25)) hits++;
  assert.ok(Math.abs(hits / 100000 - 0.12) < 0.006, 'lazy mine odds');
  console.log('security checks passed');
}

// Three Card Poker: ranking, dealer qualification, house edges
import { rank3, qualifies, shouldPlay, settle3, PAIR_PLUS, deal as deal3 } from '../src/games/threecard.ts';
{
  const h = (...c: [number, number][]) => c.map(([r, s]) => ({ r, s }));
  assert.equal(rank3(h([1, 0], [2, 1], [3, 2])).cat, 'straight', 'A-2-3 straight');
  assert.ok(rank3(h([5, 0], [6, 1], [7, 2])).score > rank3(h([2, 3], [9, 3], [13, 3])).score, 'straight beats flush');
  assert.ok(rank3(h([1, 0], [2, 1], [3, 2])).score < rank3(h([2, 0], [3, 1], [4, 2])).score, 'A-2-3 is the lowest straight');
  assert.ok(qualifies(h([12, 0], [3, 1], [2, 2])) && !qualifies(h([11, 0], [10, 1], [8, 2])));
  assert.ok(shouldPlay(h([12, 0], [6, 1], [4, 2])) && !shouldPlay(h([12, 0], [6, 1], [3, 2])));
  // Pair Plus exactly, over all 22100 hands: house edge 2.32 %
  let ret = 0, n = 0;
  for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) for (let c = b + 1; c < 52; c++) {
    const cs = [a, b, c].map((i) => ({ r: (i % 13) + 1, s: Math.floor(i / 13) }));
    const m = PAIR_PLUS[rank3(cs).cat];
    ret += m ? m + 1 : 0; n++;
  }
  const ppEdge = 1 - ret / n;
  assert.ok(Math.abs(ppEdge - 0.0232) < 0.0005, 'pair plus edge ' + ppEdge);
  // Ante/Play with Q-6-4 strategy: house edge per ante about 3.37 %
  let net = 0;
  const N = 400000;
  for (let k = 0; k < N; k++) { const r = deal3(); const play = shouldPlay(r.player); net += settle3(r, 1, 0, play).back - (play ? 2 : 1); }
  const edge = -net / N;
  assert.ok(edge > 0.02 && edge < 0.047, 'ante edge ' + edge);
  console.log('three card: pair plus edge', (ppEdge * 100).toFixed(2) + '%', 'ante edge', (edge * 100).toFixed(2) + '%');
}

// Jass (Schieber): points, follow/undertrump rules, Weis, and full bot rounds that only make legal moves
import * as J from '../src/games/jass.ts';
{
  const all = Array.from({ length: 36 }, (_, i) => ({ s: Math.floor(i / 9), r: 6 + (i % 9) }));
  for (const m of J.MODES) assert.equal(all.reduce((a, c) => a + J.points(c, m), 0), 152, 'jass points ' + m);
  const c = (s: number, r: number) => ({ s, r });
  // trump Bauer beats Nell beats Ass; in Undenufe the six is highest
  assert.equal(J.trickWinner([{ p: 0, c: c(0, 14) }, { p: 1, c: c(1, 9) }, { p: 2, c: c(1, 11) }, { p: 3, c: c(0, 13) }], 1), 2);
  assert.equal(J.trickWinner([{ p: 0, c: c(0, 14) }, { p: 1, c: c(0, 6) }], 'unde'), 1);
  // must follow suit, but may trump instead
  const hand = [c(0, 7), c(1, 6), c(2, 14)];
  assert.deepEqual(J.legal(hand, [{ p: 3, c: c(0, 10) }], 1), [c(0, 7), c(1, 6)]);
  // no undertrumping when another card is possible
  assert.deepEqual(J.legal([c(1, 6), c(2, 14)], [{ p: 2, c: c(0, 10) }, { p: 3, c: c(1, 14) }], 1), [c(2, 14)]);
  // trump led and only the Bauer in hand: free choice
  assert.equal(J.legal([c(1, 11), c(2, 14)], [{ p: 3, c: c(1, 6) }], 1).length, 2);
  // Weis: Vierblatt beats Dreiblatt, four Bauern 200
  const w = J.weisOf([c(0, 6), c(0, 7), c(0, 8), c(0, 9), c(2, 11), c(1, 11), c(3, 11), c(0, 11), c(2, 12)], 0);
  assert.deepEqual(w.map((x) => x.pts), [200, 50], 'weis ' + JSON.stringify(w));
  const r = J.weisWinner([[{ pts: 20, n: 3, top: 9, s: 0, four: false }], [{ pts: 50, n: 4, top: 9, s: 0, four: false }], [], [{ pts: 20, n: 3, top: 14, s: 1, four: false }]], 2, 0);
  assert.deepEqual(r, { team: 1, pts: 70 });
  // bots play 300 rounds: always legal, 157 points per round (257 with a Match)
  for (let k = 0; k < 300; k++) {
    const hands = J.deal();
    const ch = J.chooseMode(hands[k % 4], true);
    const m = ch === 'push' ? (J.chooseMode(hands[(k + 2) % 4], false) as J.Mode) : ch;
    const played: J.JCard[] = [], tricks: { winner: number; cards: J.JCard[] }[] = [];
    let turn = k % 4;
    for (let n = 0; n < 9; n++) {
      const t: J.Play[] = [];
      for (let i = 0; i < 4; i++) {
        const cc = J.botPlay(hands[turn], t, m, turn, played);
        assert.ok(J.legal(hands[turn], t, m).some((x) => J.same(x, cc)), 'bot plays legal');
        hands[turn] = hands[turn].filter((x) => !J.same(x, cc));
        t.push({ p: turn, c: cc }); played.push(cc);
        turn = (turn + 1) % 4;
      }
      turn = J.trickWinner(t, m);
      tricks.push({ winner: turn, cards: t.map((x) => x.c) });
    }
    const pts = J.roundPoints(tricks, m);
    assert.ok(pts[0] + pts[1] === 157 || pts[0] + pts[1] === 257, 'round total ' + pts);
  }
  console.log('jass checks passed');
}

// Minesweeper: random-shape boards
import { newGame as msNew, open as msOpen, neighbours as msNb } from '../src/games/minesweeper.ts';
{
  for (let k = 0; k < 40; k++) {
    const g = msNew(20, 16, 60, { shape: true });
    const live = g.cells.filter((c) => !c.void).length;
    assert(live >= 0.5 * 320 && live <= 0.9 * 320, 'shape covers a sensible share: ' + live);
    // one connected piece (4-neighbourhood)
    const start = g.cells.findIndex((c) => !c.void), seen = new Set([start]), q = [start];
    while (q.length) { const j = q.pop()!, x = j % 20; for (const n of [x > 0 ? j - 1 : -1, x < 19 ? j + 1 : -1, j - 20, j + 20]) if (n >= 0 && n < 320 && !g.cells[n].void && !seen.has(n)) { seen.add(n); q.push(n); } }
    assert(seen.size === live, 'shape is one piece');
    assert(Math.abs(g.mines - Math.round(60 * live / 320)) <= 1, 'mines scale with the shape');
    msOpen(g, start);
    assert(g.cells.every((c) => !c.void || (!c.mine && !c.open)), 'no mines or openings in the void');
    assert(g.cells.filter((c) => c.mine).length === g.mines, 'all mines placed');
    assert(g.cells.every((_, i) => msNb(g, i).every((j) => !g.cells[j].void)), 'void cells are nobody\'s neighbour');
    // opening every safe cell wins
    g.cells.forEach((c, i) => { if (!c.mine && !c.void) msOpen(g, i); });
    assert(g.state === 'won', 'clearing the shape wins');
  }
  console.log('minesweeper shape checks passed');
}

// Balloon: every cash-out point returns the same ~97 %, the pop chance matches the risk level
import { RISK as BRISK, balloonMult, pops } from '../src/games/balloon.ts';
{
  for (const r of ['low', 'mid', 'high'] as const) {
    const { p, max } = BRISK[r];
    for (const k of [1, 5, max]) {
      const ev = (1 - p) ** k * balloonMult(r, k);
      assert(ev > 0.95 && ev <= 0.97 + 1e-9, `${r} ev at ${k}: ${ev}`);
    }
    let n = 0; for (let i = 0; i < 20000; i++) if (pops(r)) n++;
    assert(Math.abs(n / 20000 - p) < 0.012, `${r} pop rate ${n / 20000}`);
  }
  assert(balloonMult('mid', 0) === 0, 'nothing to cash before the first pump');
  console.log('balloon checks passed');
}

// Horse racing: the same seed gives the same race everywhere, payouts follow the bet rules, odds return ~95 %
import { field as hField, simulate as hSim, odds as hOdds, payout as hPay, timeline as hTl, DIST as H_DIST } from '../src/games/horses.ts';
{
  const h = hField(77);
  assert(h.length === 6 && new Set(h.map((x) => x.name)).size === 6, 'six different horses');
  const a = hSim(h, 1234), b = hSim(h, 1234);
  assert(JSON.stringify(a.order) === JSON.stringify(b.order) && a.finish.every((f, i) => f === b.finish[i]), 'deterministic race');
  assert(a.frames[a.frames.length - 1].some((p) => p >= H_DIST), 'the race reaches the post');
  const tl = hTl(a);
  assert(tl.wall >= a.finish[a.order[0]] && tl.race(tl.wall) >= a.finish[a.order[0]], 'playback covers the finish');
  const o = hOdds(h, 4000);
  const order = [2, 4, 0, 1, 3, 5];
  assert(hPay('win', [2], order, o) === o.win[2] && hPay('win', [4], order, o) === 0, 'win pays only the winner');
  assert(hPay('place', [4], order, o) === o.place[4] && hPay('place', [0], order, o) === 0, 'place pays first and second');
  assert(hPay('exacta', [2, 4], order, o) === o.exacta[2][4] && hPay('exacta', [4, 2], order, o) === 0, 'exacta needs the right order');
  // return to player over fresh races, all six horses backed to win: close to 95 %
  let back = 0; const M = 6000;
  for (let k = 0; k < M; k++) { const { order: ord } = hSim(h, 9e6 + k, false); back += o.win[ord[0]]; }
  assert(back / M / 6 > 0.85 && back / M / 6 < 1.02, 'win RTP near 95 %: ' + (back / M / 6).toFixed(3));
  console.log('horse racing checks passed');
}

// Durak: rules, a few hundred bot games, transfers
import { newGame as dkNew, act as dkAct, bot as dkBot, legal as dkLegal, beats as dkBeats, payout as dkPay } from '../src/games/durak.ts';
{
  assert(dkBeats({ s: 0, r: 9 }, { s: 0, r: 7 }, 3) && !dkBeats({ s: 0, r: 7 }, { s: 0, r: 9 }, 3), 'higher same suit beats');
  assert(dkBeats({ s: 3, r: 6 }, { s: 0, r: 14 }, 3) && !dkBeats({ s: 1, r: 14 }, { s: 0, r: 6 }, 3), 'trump beats, other suits do not');
  let losers = 0, draws = 0, transfers = 0;
  for (let k = 0; k < 400; k++) {
    const n = 2 + (k % 5);
    const g = dkNew(n, { transfer: k % 2 === 0, allThrow: k % 3 === 0 });
    let steps = 0;
    while (g.phase === 'play' && steps++ < 3000) {
      let moved = false;
      for (const p of [g.defender, ...Array.from({ length: n }, (_, i) => i)]) {
        const a = dkBot(g, p);
        if (a && dkAct(g, p, a)) { moved = true; if (a.t === 'transfer') transfers++; break; }
      }
      assert(moved, 'someone can always move');
      // invariants: 36 cards in total, nobody over the table limit
      const total = g.hands.reduce((a, h) => a + h.length, 0) + g.deck.length + g.discard + g.table.reduce((a, x) => a + (x.d ? 2 : 1), 0);
      assert(total === 36, 'cards are conserved: ' + total);
      assert(g.table.length <= 6, 'at most six attack cards');
    }
    assert(g.phase === 'over', 'game ends');
    if (g.loser >= 0) { losers++; assert(g.hands[g.loser].length > 0 && (g.out.length === n - 1 || (g.stall ?? 0) >= 40), 'the durak is the one left with cards'); } else draws++;
  }
  assert(transfers > 0, 'bots use transfers');
  // an attacker cannot open with two cards at once or throw a rank that is not on the table
  const g = dkNew(2, { transfer: false, allThrow: false });
  const att = g.attacker, h = g.hands[att];
  const odd = h.find((c) => c.r !== h[0].r);
  assert(dkAct(g, att, { t: 'attack', c: h[0] }), 'open');
  if (odd) assert(!dkLegal(g, att, { t: 'attack', c: odd }), 'throw-in needs a rank on the table');
  assert(dkPay(2) === 1.94 && dkPay(6) === 1.16, 'payout');
  console.log('durak checks passed', { losers, draws, transfers });
}

// ---------- Keno and Lotto ----------
{
  const { kenoTable, KENO_RISK, KENO_N, KENO_D, hyper, LOTTO_TABLE, RANKS, rankProb, lottoRank } = await import('../src/games/lotto.ts');
  for (const risk of Object.keys(KENO_RISK) as (keyof typeof KENO_RISK)[]) for (let k = 1; k <= 10; k++) {
    const tb = kenoTable(k, risk), ev = tb.reduce((a, m, h) => a + m * hyper(KENO_N, KENO_D, k, h), 0);
    assert.ok(ev <= 0.97 + 1e-9 && ev > 0.93, `keno ${risk} ${k}: ${ev}`);
  }
  let p = 0, ev = 0;
  RANKS.forEach((r, i) => { p += rankProb(r); ev += rankProb(r) * LOTTO_TABLE[i]; });
  assert.ok(ev <= 0.97 + 1e-9 && ev > 0.93, 'lotto ev ' + ev);
  assert.equal(lottoRank([1, 2, 3, 4, 5, 6], 3, [1, 2, 3, 4, 5, 6], 3), 0);
  assert.equal(lottoRank([1, 2, 3, 10, 11, 12], 1, [1, 2, 3, 4, 5, 6], 2), 7);
  assert.equal(lottoRank([1, 2, 30, 10, 11, 12], 2, [1, 2, 3, 4, 5, 6], 2), 8);
  assert.equal(lottoRank([1, 2, 30, 10, 11, 12], 1, [1, 2, 3, 4, 5, 6], 2), -1);
  console.log('keno classic 10:', kenoTable(10, 'classic').join(' '), '| lotto:', LOTTO_TABLE.join(' '), '| win chance', p.toFixed(3));
}
