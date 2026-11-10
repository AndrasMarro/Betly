// One runnable check for the game math: node --experimental-strip-types tests/engine.test.ts
import assert from 'node:assert/strict';
import { spotAt, payout, OUTSIDE, ANNOUNCED } from '../src/games/roulette.ts';
import { MACHINES as BASE_MACHINES, ARMORY, strips, spinGrid, evaluate } from '../src/games/slots.ts';
const MACHINES = [...BASE_MACHINES, ...ARMORY];
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
import { crashPoint, minesMult, diceMult, DICE_BETS, hopMult, LEVELS, TILES } from '../src/games/arcade.ts';
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
  for (const bet of Object.keys(DICE_BETS)) {
    let ev = 0;
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (DICE_BETS[bet](a, b)) ev += diceMult(bet) / 36;
    assert.ok(ev <= 0.97 + 1e-9 && ev > 0.95, 'dice ' + bet);
  }
  for (const [lv, q] of Object.entries(LEVELS)) for (let k = 1; k <= 15; k++) {
    const ev = q ** k * hopMult(lv as any, k);
    assert.ok(ev <= 0.97 + 1e-9 && ev > 0.95, `hop ${lv} ${k}`);
  }
  console.log('arcade checks passed');
}

// New arcade games
import { towerMult, towerSafe, TOWER, coinMult, hiloMult, pHigher, pLower, plinkoTable, plinkoProb, PLINKO_ROWS, RISKS, WHEELS, wheelLayout, SCRATCH, scratchCard } from '../src/games/arcade.ts';
{
  const near = (ev: number, what: string, lo = 0.95) => assert.ok(ev <= 0.97 + 1e-9 && ev > lo, `${what}: ${ev}`);
  for (const lv of Object.keys(TOWER) as (keyof typeof TOWER)[]) for (let k = 1; k <= 8; k++) near(towerSafe(lv) ** k * towerMult(lv, k), `tower ${lv} ${k}`);
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
