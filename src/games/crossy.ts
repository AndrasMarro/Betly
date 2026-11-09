// Retro Crossy Run: endless lane world, pure logic. Rows count forward from 0, columns 0..COLS-1.
export const COLS = 11;
const SPAN = COLS + 8; // items wrap within [-4, COLS + 4)
export type Item = { x: number; len: number; c: number; croc?: boolean };
export type LaneType = 'grass' | 'road' | 'river' | 'rail';
export type Lane = { type: LaneType; dir: 1 | -1; speed: number; items: Item[]; trees: number[]; t: number; train: Item | null };
export type World = { lanes: Lane[]; rand: () => number; run: LaneType; left: number; lastRiverDir: 1 | -1 };

export function newWorld(rand: () => number): World {
  const w: World = { lanes: [], rand, run: 'grass', left: 4, lastRiverDir: 1 };
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
  const lane: Lane = { type: w.run, dir: rand() < 0.5 ? 1 : -1, speed: 0, items: [], trees: [], t: 0, train: null };
  if (lane.type === 'grass') {
    // trees and rocks block cells; the start area stays open
    for (let c = 0; c < COLS; c++) if (rand() < (r < 4 ? 0.08 : 0.2) && !(r < 4 && Math.abs(c - 5) < 2)) lane.trees.push(c);
    if (lane.trees.length > 5) lane.trees.length = 5;
  } else if (lane.type === 'road') {
    lane.speed = (1.1 + rand() * 1.7) * diff;
    fill(lane, rand, () => (rand() < 0.25 ? 2 : 1), () => (2.6 + rand() * 3.4) * sparse);
  } else if (lane.type === 'river') {
    lane.dir = (-w.lastRiverDir) as 1 | -1;
    w.lastRiverDir = lane.dir;
    lane.speed = (0.7 + rand() * 1.1) * Math.min(1.6, diff);
    fill(lane, rand, () => 2 + Math.floor(rand() * 3), () => 1.3 + rand() * 1.6);
    // later on some of the floating things are crocodiles: ride the back, never the head
    const crocChance = r < 30 ? 0 : Math.min(0.45, (r - 30) / 120);
    for (const it of lane.items) if (it.len >= 3 && rand() < crocChance) it.croc = true;
  } else {
    lane.t = 2 + rand() * 4;
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

/** Move traffic, logs and trains on rows [from, to]; `pace` speeds everything up as the run goes on. */
export function update(w: World, dt: number, from: number, to: number, pace = 1) {
  for (let r = Math.max(0, from); r <= to && r < w.lanes.length; r++) {
    const l = w.lanes[r];
    for (const it of l.items) {
      it.x += l.dir * l.speed * pace * dt;
      if (l.dir > 0 && it.x > COLS + 4) it.x -= SPAN;
      if (l.dir < 0 && it.x + it.len < -4) it.x += SPAN;
    }
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
// forgiving hitboxes: the duck is the middle half of its cell, vehicles lose a little at both ends
const overlaps = (it: Item, px: number) => it.x + 0.12 < px + 0.74 && it.x + it.len - 0.12 > px + 0.26;
/** Is something on this row hitting a player standing at column px? */
export const hit = (l: Lane, px: number) => (l.type === 'road' && l.items.some((it) => overlaps(it, px))) || (l.type === 'rail' && !!l.train && overlaps(l.train, px));
/** The log carrying a player at px (centre must be on the log), if any. */
export const logAt = (l: Lane, px: number) => l.items.find((it) => it.x - 0.15 <= px + 0.5 && it.x + it.len + 0.15 >= px + 0.5);
/** Standing on a crocodile's head (the front cell in its direction of travel)? */
export const onCrocHead = (l: Lane, it: Item, px: number) => !!it.croc && (l.dir > 0 ? px + 0.5 > it.x + it.len - 1 : px + 0.5 < it.x + 1);
export const blocked = (l: Lane | undefined, col: number) => !!l && l.type === 'grass' && l.trees.includes(col);
