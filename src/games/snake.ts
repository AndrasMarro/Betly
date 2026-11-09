// Snake with modifiers: pure game logic, no UI. The board is n x n, (0,0) top left; the border is deadly.
export type Pt = { x: number; y: number };
export type Dir = 'up' | 'down' | 'left' | 'right';
export type AppleKind = 'red' | 'gold' | 'cosmic';
export type Apple = Pt & { kind: AppleKind; ttl: number };
export type Mods = { size: 12 | 18 | 24; speed: 'normal' | 'fast' | 'turbo'; walls: boolean; portals: boolean; many: boolean; rare: boolean };
export type Snake = {
  n: number; mods: Mods; body: Pt[]; dir: Dir; grow: number; apples: Apple[]; walls: Pt[]; portals: [Pt, Pt] | null;
  points: number; eaten: number; alive: boolean; ticks: number;
};

export const DIRS: Record<Dir, Pt> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
export const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
/** Points and growth per apple; rare apples vanish after `ttl` ticks. */
export const APPLES: Record<AppleKind, { pts: number; grow: number; ttl: number; chance: number }> = {
  red: { pts: 1, grow: 1, ttl: Infinity, chance: 0 },
  gold: { pts: 3, grow: 2, ttl: 55, chance: 0.012 },
  cosmic: { pts: 10, grow: 3, ttl: 34, chance: 0.0028 },
};
export const TICK_MS = { normal: 125, fast: 90, turbo: 66 };
export const PER_POINT = 0.1; // multiplier per point before modifiers
export const DEFAULT_MODS: Mods = { size: 18, speed: 'normal', walls: false, portals: false, many: false, rare: true };

/** Harder settings pay more per point; the daily challenge doubles it. */
export function factor(m: Mods, daily = false) {
  let f = { 12: 1.2, 18: 1, 24: 0.85 }[m.size] * { normal: 1, fast: 1.25, turbo: 1.6 }[m.speed];
  if (m.walls) f *= 1.3;
  if (m.portals) f *= 1.1;
  if (m.many) f *= 0.75;
  if (daily) f *= 2;
  return Math.round(f * 1000) / 1000;
}
export const multiplier = (s: Snake, daily = false) => Math.round(s.points * PER_POINT * factor(s.mods, daily) * 100) / 100;

/** Daily challenge: always hard, always random, the same for everybody on that day. */
export function dailyMods(rand: () => number): Mods {
  return {
    size: ([12, 18, 24] as const)[Math.floor(rand() * 3)],
    speed: rand() < 0.5 ? 'fast' : 'turbo',
    walls: true,
    portals: rand() < 0.6,
    many: false,
    rare: true,
  };
}

const same = (a: Pt, b: Pt) => a.x === b.x && a.y === b.y;
const taken = (s: Snake, p: Pt) =>
  s.body.some((b) => same(b, p)) || s.walls.some((w) => same(w, p)) || s.apples.some((a) => same(a, p)) || !!s.portals?.some((q) => same(q, p));

function freeCell(s: Snake, rand: () => number, minDist = 0): Pt | null {
  const head = s.body[0];
  for (let tries = 0; tries < 400; tries++) {
    const p = { x: Math.floor(rand() * s.n), y: Math.floor(rand() * s.n) };
    if (!taken(s, p) && Math.abs(p.x - head.x) + Math.abs(p.y - head.y) >= minDist) return p;
  }
  return null;
}

export function newSnake(mods: Mods, rand: () => number): Snake {
  const n = mods.size, y = Math.floor(n / 2), x = Math.floor(n / 3);
  const s: Snake = { n, mods, body: [{ x, y }, { x: x - 1, y }, { x: x - 2, y }], dir: 'right', grow: 0, apples: [], walls: [], portals: null, points: 0, eaten: 0, alive: true, ticks: 0 };
  if (mods.portals) {
    // one portal in the left half, one in the right half, away from the start row
    const a = { x: 1 + Math.floor(rand() * (n / 2 - 2)), y: rand() < 0.5 ? 1 + Math.floor(rand() * (y - 2)) : y + 2 + Math.floor(rand() * (n - y - 3)) };
    const b = { x: n - 2 - Math.floor(rand() * (n / 2 - 2)), y: n - 1 - a.y };
    s.portals = [a, b];
  }
  refill(s, rand);
  return s;
}

function refill(s: Snake, rand: () => number) {
  const want = s.mods.many ? 3 : 1;
  while (s.apples.filter((a) => a.kind === 'red').length < want) {
    const p = freeCell(s, rand, 2);
    if (!p) break;
    s.apples.push({ ...p, kind: 'red', ttl: Infinity });
  }
}

/** Advance one tick in direction `dir` (a reversal is ignored). Returns what happened. */
export function step(s: Snake, dir: Dir, rand: () => number): 'move' | 'eat' | 'dead' {
  if (!s.alive) return 'dead';
  if (dir !== OPPOSITE[s.dir]) s.dir = dir;
  s.ticks++;
  const d = DIRS[s.dir];
  let head = { x: s.body[0].x + d.x, y: s.body[0].y + d.y };
  if (s.portals) {
    const i = s.portals.findIndex((p) => same(p, head));
    if (i >= 0) { const o = s.portals[1 - i]; head = { x: o.x + d.x, y: o.y + d.y }; }
  }
  const out = head.x < 0 || head.y < 0 || head.x >= s.n || head.y >= s.n;
  // the tail moves away this tick unless we are growing, so it is not an obstacle
  const body = s.grow > 0 ? s.body : s.body.slice(0, -1);
  if (out || s.walls.some((w) => same(w, head)) || body.some((b) => same(b, head))) {
    s.alive = false;
    return 'dead';
  }
  s.body.unshift(head);
  if (s.grow > 0) s.grow--;
  else s.body.pop();

  let result: 'move' | 'eat' = 'move';
  const ai = s.apples.findIndex((a) => same(a, head));
  if (ai >= 0) {
    const a = s.apples[ai], k = APPLES[a.kind];
    s.apples.splice(ai, 1);
    s.points += k.pts;
    s.grow += k.grow;
    s.eaten++;
    result = 'eat';
    // walls: every third apple a new block (sometimes two) appears away from the head
    if (s.mods.walls && s.eaten % 3 === 0) {
      for (let i = rand() < 0.35 ? 2 : 1; i > 0; i--) { const p = freeCell(s, rand, 4); if (p) s.walls.push(p); }
    }
  }
  for (const a of s.apples) a.ttl--;
  s.apples = s.apples.filter((a) => a.ttl > 0);
  if (s.mods.rare && !s.apples.some((a) => a.kind !== 'red')) {
    const r = rand();
    const kind: AppleKind | null = r < APPLES.cosmic.chance ? 'cosmic' : r < APPLES.cosmic.chance + APPLES.gold.chance ? 'gold' : null;
    const p = kind && freeCell(s, rand, 3);
    if (kind && p) s.apples.push({ ...p, kind, ttl: APPLES[kind].ttl });
  }
  refill(s, rand);
  return result;
}
