// Retro Crossy Run: endless lane world, pure logic. Rows count forward from 0, columns 0..COLS-1.
export const COLS = 11;
const SPAN = COLS + 8; // items wrap within [-4, COLS + 4)
/** weak: a cracked log that breaks once you step on it (breakT counts up from that moment). */
export type Item = { x: number; len: number; c: number; weak?: boolean; breakT?: number; gone?: boolean };
export type Blocker = 'tree' | 'rock' | 'bush' | 'stump' | 'crate' | 'shop' | 'fence' | 'barrier';
export type Decor = 'flowers' | 'flower1' | 'flowers2' | 'mushroom' | 'tuft' | 'grass' | 'fern' | 'pebble1' | 'pebble2' | 'cone' | 'sign';
export type LaneType = 'grass' | 'road' | 'river' | 'rail';
/** trees: blocking cells (trees, rocks, shops via `deco`), flowers: decoration only, coin: column of a collectible coin, pads: a still river with lily pads. */
export type Lane = { type: LaneType; dir: 1 | -1; speed: number; items: Item[]; trees: number[]; deco: Record<number, Blocker>; decor: { c: number; k: Decor }[]; coin: number | null; pads?: boolean; t: number; train: Item | null };
export type World = { lanes: Lane[]; rand: () => number; run: LaneType; left: number; lastRiverDir: 1 | -1; nextCoin: number };

export function newWorld(rand: () => number): World {
  const w: World = { lanes: [], rand, run: 'grass', left: 4, lastRiverDir: 1, nextCoin: 18 + Math.floor(rand() * 20) };
  ensure(w, 30);
  return w;
}

/** Generate lanes up to row `upTo`. Difficulty (speeds, traffic) grows with the row number. */
export function ensure(w: World, upTo: number) {
  while (w.lanes.length <= upTo) {
    const r = w.lanes.length, rand = w.rand;
    if (w.left <= 0) {
      const pick = rand();
      const prev = w.run;
      let next: LaneType = pick < 0.32 ? 'grass' : pick < 0.66 ? 'road' : pick < 0.86 ? 'river' : 'rail';
      if (r < 6 && (next === 'river' || next === 'rail')) next = 'road';
      if (next === prev && next !== 'road') next = 'grass';
      w.run = next;
      w.left = next === 'grass' ? 1 + Math.floor(rand() * 2) : next === 'road' ? 1 + Math.floor(rand() * 4) : next === 'river' ? 1 + Math.floor(rand() * 3) : 1;
    }
    w.left--;
    w.lanes.push(makeLane(w, r));
  }
}

function makeLane(w: World, r: number): Lane {
  // early rows are calm: slow traffic and wide gaps; it tightens with distance
  const rand = w.rand, diff = 0.7 + Math.min(r, 300) / 160, sparse = Math.max(1, 2.8 - r / 18);
  const lane: Lane = { type: w.run, dir: rand() < 0.5 ? 1 : -1, speed: 0, items: [], trees: [], deco: {}, decor: [], coin: null, t: 0, train: null };
  if (lane.type === 'grass') {
    // trees and rocks block cells; the start area stays open
    for (let c = 0; c < COLS; c++) if (rand() < (r < 4 ? 0.08 : 0.2) && !(r < 4 && Math.abs(c - 5) < 2)) lane.trees.push(c);
    if (lane.trees.length > 5) lane.trees.length = 5;
    const pick = <T,>(list: [T, number][]) => { let x = rand() * list.reduce((a, [, n]) => a + n, 0); return list.find(([, n]) => (x -= n) < 0)![0]; };
    for (const c of lane.trees) lane.deco[c] = pick<Blocker>([['tree', 38], ['bush', 20], ['rock', 14], ['stump', 12], ['crate', r > 5 ? 6 : 0], ['fence', r > 5 ? 5 : 0], ['shop', r > 8 ? 5 : 0]]);
    // a few small things in the grass; never on blocked cells
    const prev = w.lanes[r - 1]?.type, edge = rand() < 0.5 ? 0 : COLS - 1;
    if (prev === 'road' && rand() < 0.3 && !lane.trees.includes(edge)) lane.decor.push({ c: edge, k: rand() < 0.6 ? 'cone' : 'sign' });
    if (prev === 'rail' && rand() < 0.35 && !lane.trees.includes(edge)) { lane.trees.push(edge); lane.deco[edge] = 'barrier'; }
    for (let c = 0; c < COLS; c++)
      if (!lane.trees.includes(c) && !lane.decor.some((d) => d.c === c) && rand() < 0.09)
        lane.decor.push({ c, k: pick<Decor>([['flowers', 3], ['flower1', 3], ['flowers2', 3], ['tuft', 3], ['grass', 3], ['fern', 2], ['mushroom', 2], ['pebble1', 1], ['pebble2', 1]]) });
  } else if (lane.type === 'road') {
    lane.speed = (1.1 + rand() * 1.7) * diff;
    fill(lane, rand, () => (rand() < 0.25 ? 2 : 1), () => (2.6 + rand() * 3.4) * sparse);
  } else if (lane.type === 'river' && r > 12 && rand() < 0.22) {
    // a still pond: lily pads that do not move, every other cell or so
    lane.pads = true;
    for (let c = 0; c < COLS; c++) if (rand() < 0.42) lane.items.push({ x: c, len: 1, c: 0 });
    if (lane.items.length < 3) for (const c of [1, 5, 9]) if (!lane.items.some((it) => it.x === c)) lane.items.push({ x: c, len: 1, c: 0 });
  } else if (lane.type === 'river') {
    lane.dir = (-w.lastRiverDir) as 1 | -1;
    w.lastRiverDir = lane.dir;
    lane.speed = (0.7 + rand() * 1.1) * Math.min(1.6, diff);
    fill(lane, rand, () => 2 + Math.floor(rand() * 3), () => 1.3 + rand() * 1.6);
    // later on some logs are cracked: they hold you for a moment and then break apart
    const weakChance = r < 15 ? 0 : Math.min(0.4, (r - 15) / 90);
    for (const it of lane.items) if (rand() < weakChance) it.weak = true;
    if (lane.items.every((it) => it.weak) && lane.items.length) lane.items[0].weak = false; // always one solid log
  } else {
    lane.t = 2 + rand() * 4;
  }
  // a coin every 20-60 rows, on a free grass or road cell
  if (r >= w.nextCoin && (lane.type === 'grass' || lane.type === 'road')) {
    const free = Array.from({ length: COLS }, (_, c) => c).filter((c) => !lane.trees.includes(c));
    if (free.length) { lane.coin = free[Math.floor(rand() * free.length)]; w.nextCoin = r + 20 + Math.floor(rand() * 41); }
  }
  return lane;
}

function fill(lane: Lane, rand: () => number, len: () => number, gap: () => number) {
  let x = -4 + rand() * 2;
  while (x < COLS + 4) {
    const l = len();
    if (x + l <= COLS + 4) lane.items.push({ x, len: l, c: Math.floor(rand() * 6) });
    x += l + gap();
  }
}

export const TRAIN_LEN = 12, TRAIN_SPEED = 28, WARN = 1.8;
export const BREAK = 0.85, SINK = 1.5; // seconds from stepping on a cracked log until it breaks / is gone

/** Move traffic, logs and trains on rows [from, to]; `pace` speeds everything up as the run goes on. */
export function update(w: World, dt: number, from: number, to: number, pace = 1) {
  for (let r = Math.max(0, from); r <= to && r < w.lanes.length; r++) {
    const l = w.lanes[r];
    for (const it of l.items) {
      if (it.breakT !== undefined) { it.breakT += dt; if (it.breakT >= BREAK) it.gone = true; }
      it.x += l.dir * l.speed * pace * dt;
      if (l.dir > 0 && it.x > COLS + 4) it.x -= SPAN;
      if (l.dir < 0 && it.x + it.len < -4) it.x += SPAN;
    }
    if (l.items.some((it) => (it.breakT ?? 0) >= SINK)) l.items = l.items.filter((it) => (it.breakT ?? 0) < SINK);
    if (l.type === 'rail') {
      if (l.train) {
        l.train.x += l.dir * TRAIN_SPEED * dt;
        if (l.train.x > COLS + 6 || l.train.x + l.train.len < -6) { l.train = null; l.t = 3 + w.rand() * 5; }
      } else if ((l.t -= dt) <= 0) {
        l.train = { x: l.dir > 0 ? -TRAIN_LEN - 1 : COLS + 1, len: TRAIN_LEN, c: 0 };
      }
    }
  }
}

export const warning = (l: Lane) => l.type === 'rail' && (!!l.train || l.t < WARN);
// forgiving hitboxes: the duck is the middle 40 % of its cell, vehicles lose a little at both ends
const overlaps = (it: Item, px: number) => it.x + 0.14 < px + 0.7 && it.x + it.len - 0.14 > px + 0.3;
/** Is something on this row hitting a player standing at column px? */
export const hit = (l: Lane, px: number) => (l.type === 'road' && l.items.some((it) => overlaps(it, px))) || (l.type === 'rail' && !!l.train && overlaps(l.train, px));
/** The log carrying a player at px (centre must be on the log), if any. */
export const logAt = (l: Lane, px: number) => l.items.find((it) => !it.gone && it.x - 0.15 <= px + 0.5 && it.x + it.len + 0.15 >= px + 0.5);
export const blocked = (l: Lane | undefined, col: number) => !!l && l.type === 'grass' && l.trees.includes(col);

// ---------- stakes ----------
export const MIN_STAKE = 10, MAX_STAKE = 500;
export const BONUS_EVERY = 50, BONUS = 1.3, MAX_MULT = 50;
/** Multiplier when cashing out after `steps` forward steps: break-even at 20, then x1.3 on top at every 50 steps. */
export function multAt(steps: number) {
  const base = 0.5 + steps * 0.025;
  return Math.min(MAX_MULT, Math.round(base * BONUS ** Math.floor(steps / BONUS_EVERY) * 100) / 100);
}
/** A coin pays back a share of the stake that grows with distance (5 % early, up to 30 %). */
export const coinShare = (row: number) => Math.min(0.3, 0.05 + row * 0.0012);
