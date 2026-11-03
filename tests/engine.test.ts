// One runnable check for the game math: node --experimental-strip-types tests/engine.test.ts
import assert from 'node:assert/strict';
import { spotAt, payout, OUTSIDE, ANNOUNCED } from '../src/games/roulette.ts';
import { MACHINES, strips, spinGrid, evaluate } from '../src/games/slots.ts';
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
