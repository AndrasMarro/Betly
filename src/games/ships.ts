// Schiffe versenken: 10 × 10, a fleet of 5, 4, 3, 3 and 2; ships may not touch, not even at the corners.
// Shots on a board: 0 unknown, 1 water, 2 hit, 3 sunk. A sunk ship also reveals the water around it.
export const N = 10;
export const FLEET = [5, 4, 3, 3, 2];
export type Ship = { len: number; x: number; y: number; v: boolean }; // v: vertical
export const cellsOf = (s: Ship) => Array.from({ length: s.len }, (_, i) => (s.y + (s.v ? i : 0)) * N + s.x + (s.v ? 0 : i));
const inside = (s: Ship) => s.x >= 0 && s.y >= 0 && (s.v ? s.y + s.len <= N && s.x < N : s.x + s.len <= N && s.y < N);
/** Cells a ship blocks for the others: itself and its ring of neighbours. */
function halo(s: Ship) {
  const out = new Set<number>();
  for (const c of cellsOf(s)) {
    const x = c % N, y = Math.floor(c / N);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < N && ny < N) out.add(ny * N + nx);
    }
  }
  return out;
}
/** Can `s` go into the fleet (ignoring the ship at index `skip`, the one being moved)? */
export function canPlace(fleet: Ship[], s: Ship, skip = -1) {
  if (!inside(s)) return false;
  const mine = cellsOf(s);
  return fleet.every((o, i) => i === skip || !mine.some((c) => halo(o).has(c)));
}
/** A complete legal fleet at random. */
export function randomFleet(rnd = Math.random): Ship[] {
  for (;;) {
    const fleet: Ship[] = [];
    let ok = true;
    for (const len of FLEET) {
      let placed = false;
      for (let t = 0; t < 200 && !placed; t++) {
        const s = { len, x: Math.floor(rnd() * N), y: Math.floor(rnd() * N), v: rnd() < 0.5 };
        if (canPlace(fleet, s)) { fleet.push(s); placed = true; }
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) return fleet;
  }
}
/** Is this a legal complete fleet (used to check what guests send)? */
export function validFleet(f: unknown): f is Ship[] {
  if (!Array.isArray(f) || f.length !== FLEET.length) return false;
  const lens = f.map((s) => s?.len).sort((a, b) => b - a);
  if (lens.join() !== [...FLEET].sort((a, b) => b - a).join()) return false;
  const ok: Ship[] = [];
  for (const s of f) {
    const t = { len: +s.len, x: +s.x, y: +s.y, v: !!s.v };
    if (!Number.isInteger(t.x) || !Number.isInteger(t.y) || !canPlace(ok, t)) return false;
    ok.push(t);
  }
  return true;
}

export type Result = 'water' | 'hit' | 'sunk';
/** Fire at cell c of a fleet; marks the shots board and returns what happened. */
export function fire(fleet: Ship[], shots: number[], c: number): { res: Result; ship?: Ship } {
  const ship = fleet.find((s) => cellsOf(s).includes(c));
  if (!ship) { shots[c] = 1; return { res: 'water' }; }
  shots[c] = 2;
  const cells = cellsOf(ship);
  if (!cells.every((k) => shots[k] >= 2)) return { res: 'hit', ship };
  for (const k of halo(ship)) if (!shots[k]) shots[k] = 1;
  for (const k of cells) shots[k] = 3;
  return { res: 'sunk', ship };
}
export const sunkAll = (fleet: Ship[], shots: number[]) => fleet.every((s) => cellsOf(s).every((c) => shots[c] === 3));

// ---------- bots ----------
export type Skill = 'easy' | 'mid' | 'hard';
const neighbours = (c: number) => {
  const x = c % N, y = Math.floor(c / N);
  return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N).map(([a, b]) => b * N + a);
};
/** Ship lengths not sunk yet on a board (known from the sunk cells, since every sunk ship shows). */
export function alive(shots: number[]): number[] {
  const left = [...FLEET], seen = new Set<number>();
  for (let c = 0; c < N * N; c++) {
    if (shots[c] !== 3 || seen.has(c)) continue;
    // walk the sunk ship
    let len = 0;
    const stack = [c];
    while (stack.length) { const k = stack.pop()!; if (seen.has(k) || shots[k] !== 3) continue; seen.add(k); len++; stack.push(...neighbours(k)); }
    const i = left.indexOf(len);
    if (i >= 0) left.splice(i, 1);
  }
  return left;
}
/** Where a bot shoots on a board, by skill. */
export function aim(shots: number[], skill: Skill, rnd = Math.random): number {
  const open = shots.map((v, c) => (v ? -1 : c)).filter((c) => c >= 0);
  const pick = (cs: number[]) => cs[Math.floor(rnd() * cs.length)];
  if (skill === 'easy') {
    // shoots around a hit sometimes, otherwise at random
    const near = shots.map((v, c) => (v === 2 ? neighbours(c).filter((k) => !shots[k]) : [])).flat();
    return near.length && rnd() < 0.5 ? pick(near) : pick(open);
  }
  const hits = shots.map((v, c) => (v === 2 ? c : -1)).filter((c) => c >= 0);
  if (skill === 'mid') {
    if (hits.length) {
      // follow the line of two hits, else try around a hit
      for (const h of hits) for (const d of [1, N]) if (hits.includes(h + d)) {
        const line = [h - d, h + 2 * d].filter((k) => k >= 0 && k < N * N && !shots[k] && (d === N || Math.floor(k / N) === Math.floor(h / N)));
        if (line.length) return pick(line);
      }
      const near = hits.flatMap((h) => neighbours(h)).filter((k) => !shots[k]);
      if (near.length) return pick(near);
    }
    const checker = open.filter((c) => ((c % N) + Math.floor(c / N)) % 2 === 0);
    return pick(checker.length ? checker : open);
  }
  // hard: count every way the remaining ships fit; cells that cover hits count much more
  const heat = Array(N * N).fill(0);
  for (const len of alive(shots)) for (const v of [false, true]) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const s = { len, x, y, v };
    if (!inside(s)) continue;
    const cs = cellsOf(s);
    if (cs.some((c) => shots[c] === 1 || shots[c] === 3)) continue;
    const covered = cs.filter((c) => shots[c] === 2).length;
    const w = covered ? 40 * covered : 1;
    for (const c of cs) if (!shots[c]) heat[c] += w;
  }
  const max = Math.max(...heat);
  return max > 0 ? pick(heat.map((h, c) => (h === max ? c : -1)).filter((c) => c >= 0)) : pick(open);
}
