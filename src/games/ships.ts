// Schiffe versenken: 10 × 10, a fleet of 5, 4, 3, 3 and 2. Classic: ships may not touch, not even at the corners,
// and a sunk ship reveals the water around it. With `touch` ships may lie side by side and nothing is revealed.
// Shots on a board: 0 unknown, 1 water, 2 hit, 3 sunk, 4 armour dented (arcade: needs a second hit), 5 mine went off.
// Arcade: the 5 is an armoured battleship (every part takes two hits), one 3 is a submarine that can dive away
// into unexplored water, everyone has two mines in their sea (whoever hits one sits out a turn), and an arsenal
// of a bomb (a cross of five cells), sonar (counts ship parts in a 3 × 3 area) and a direction finder (counts in a row and column).
export const N = 10;
export const FLEET = [5, 4, 3, 3, 2];
export type Kind = 'armor' | 'sub';
export type Ship = { len: number; x: number; y: number; v: boolean; k?: Kind }; // v: vertical
export type Weapon = 'shot' | 'bomb' | 'sonar' | 'peil';
export const ARSENAL = { bomb: 1, sonar: 2, peil: 1, dive: 2 };
export type Ammo = typeof ARSENAL;
export type Intel = { c: number; n: number; w: 'sonar' | 'peil'; m?: number }; // peil: n in the row, m in the column
/** Arcade roles: the 5 is armoured, the first 3 is the submarine. */
export function withKinds(fleet: Ship[], arcade: boolean): Ship[] {
  let sub = false;
  return fleet.map((s) => {
    const { k: _k, ...t } = s;
    if (!arcade) return t;
    if (t.len === 5) return { ...t, k: 'armor' as Kind };
    if (t.len === 3 && !sub) { sub = true; return { ...t, k: 'sub' as Kind }; }
    return t;
  });
}
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
/** Can `s` go into the fleet (ignoring the ship at index `skip`, the one being moved)? `touch`: only no overlap. */
export function canPlace(fleet: Ship[], s: Ship, skip = -1, touch = false) {
  if (!inside(s)) return false;
  const mine = cellsOf(s);
  return fleet.every((o, i) => i === skip || !mine.some((c) => (touch ? cellsOf(o).includes(c) : halo(o).has(c))));
}
/** A complete legal fleet at random. */
export function randomFleet(rnd = Math.random, touch = false): Ship[] {
  for (;;) {
    const fleet: Ship[] = [];
    let ok = true;
    for (const len of FLEET) {
      let placed = false;
      for (let t = 0; t < 200 && !placed; t++) {
        const s = { len, x: Math.floor(rnd() * N), y: Math.floor(rnd() * N), v: rnd() < 0.5 };
        if (canPlace(fleet, s, -1, touch)) { fleet.push(s); placed = true; }
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) return fleet;
  }
}
/** Is this a legal complete fleet (used to check what guests send)? */
export function validFleet(f: unknown, touch = false): f is Ship[] {
  if (!Array.isArray(f) || f.length !== FLEET.length) return false;
  const lens = f.map((s) => s?.len).sort((a, b) => b - a);
  if (lens.join() !== [...FLEET].sort((a, b) => b - a).join()) return false;
  const ok: Ship[] = [];
  for (const s of f) {
    const t = { len: +s.len, x: +s.x, y: +s.y, v: !!s.v };
    if (!Number.isInteger(t.x) || !Number.isInteger(t.y) || !canPlace(ok, t, -1, touch)) return false;
    ok.push(t);
  }
  return true;
}

export type Result = 'water' | 'hit' | 'sunk' | 'dent' | 'mine';
/** Can this cell still be shot at? Unknown, or dented armour. */
export const open = (v: number) => v === 0 || v === 4;
/** Fire at cell c of a fleet; marks the shots board and returns what happened. */
export function fire(fleet: Ship[], shots: number[], c: number, touch = false, mines: number[] = []): { res: Result; ship?: Ship } {
  const ship = fleet.find((s) => cellsOf(s).includes(c));
  if (!ship) { const boom = mines.includes(c); shots[c] = boom ? 5 : 1; return { res: boom ? 'mine' : 'water' }; }
  if (ship.k === 'armor' && shots[c] !== 4) { shots[c] = 4; return { res: 'dent', ship }; }
  shots[c] = 2;
  const cells = cellsOf(ship);
  if (!cells.every((k) => shots[k] === 2 || shots[k] === 3)) return { res: 'hit', ship };
  if (!touch) for (const k of halo(ship)) if (!shots[k]) shots[k] = 1;
  for (const k of cells) shots[k] = 3;
  return { res: 'sunk', ship };
}
export const sunkAll = (fleet: Ship[], shots: number[]) => fleet.every((s) => cellsOf(s).every((c) => shots[c] === 3));
const RANK: Result[] = ['water', 'mine', 'dent', 'hit', 'sunk'];
/** A bomb: the cell and its four neighbours that can still be shot. Returns the best result and every sunk ship. */
export function bomb(fleet: Ship[], shots: number[], c: number, touch = false, mines: number[] = []) {
  const cells = [c, ...neighbours(c)].filter((k) => open(shots[k]));
  let res: Result = 'water', mine = false;
  const sunk: Ship[] = [];
  for (const k of cells) {
    const r = fire(fleet, shots, k, touch, mines);
    if (r.res === 'mine') mine = true;
    if (r.res === 'sunk' && r.ship) sunk.push(r.ship);
    if (RANK.indexOf(r.res) > RANK.indexOf(res)) res = r.res;
  }
  return { res, mine, sunk };
}
/** Ship parts not hit yet (dented armour still counts). */
const intact = (fleet: Ship[], shots: number[], k: number) => fleet.some((s) => cellsOf(s).includes(k)) && shots[k] !== 2 && shots[k] !== 3;
/** Sonar: intact ship parts in the 3 × 3 square around c. */
export function sonar(fleet: Ship[], shots: number[], c: number): Intel {
  const x = c % N, y = Math.floor(c / N);
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const a = x + dx, b = y + dy;
    if (a >= 0 && b >= 0 && a < N && b < N && intact(fleet, shots, b * N + a)) n++;
  }
  return { c, n, w: 'sonar' };
}
/** Direction finder: intact ship parts in the row and in the column of c. */
export function peil(fleet: Ship[], shots: number[], c: number): Intel {
  const x = c % N, y = Math.floor(c / N);
  let n = 0, m = 0;
  for (let i = 0; i < N; i++) { if (intact(fleet, shots, y * N + i)) n++; if (intact(fleet, shots, i * N + x)) m++; }
  return { c, n, m, w: 'peil' };
}
/** The submarine dives to `to`: same size and direction, at most 2 cells away, unhit, only into water the enemy has not explored, not onto own mines. */
export function canDive(fleet: Ship[], to: Ship, shotsAtMe: number[], mines: number[], touch = false) {
  const i = fleet.findIndex((s) => s.k === 'sub');
  if (i < 0) return false;
  const sub = fleet[i];
  if (cellsOf(sub).some((c) => shotsAtMe[c])) return false;
  if (to.len !== sub.len || to.v !== sub.v || (to.x === sub.x && to.y === sub.y) || Math.abs(to.x - sub.x) + Math.abs(to.y - sub.y) > 2) return false;
  if (!canPlace(fleet, to, i, touch)) return false;
  return cellsOf(to).every((c) => !shotsAtMe[c] && !mines.includes(c));
}
/** Two mines in a sea, on water only. */
export function layMines(fleet: Ship[], rnd = Math.random, n = 2) {
  const taken = new Set(fleet.flatMap(cellsOf));
  const out: number[] = [];
  while (out.length < n) { const c = Math.floor(rnd() * N * N); if (!taken.has(c) && !out.includes(c)) out.push(c); }
  return out;
}

// ---------- bots ----------
export type Skill = 'easy' | 'mid' | 'hard';
const neighbours = (c: number) => {
  const x = c % N, y = Math.floor(c / N);
  return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N).map(([a, b]) => b * N + a);
};
/** Ship lengths not sunk yet, from the list of sunk ones. */
export function alive(sunk: number[]): number[] {
  const left = [...FLEET];
  for (const l of sunk) { const i = left.indexOf(l); if (i >= 0) left.splice(i, 1); }
  return left;
}
/** Where a bot shoots on a board, by skill. `sunk`: lengths of the ships already sunk on it. Dented armour counts as a hit. */
export function aim(board: number[], skill: Skill, rnd = Math.random, sunk: number[] = []): number {
  const shots = board.map((v) => (v === 4 ? 2 : v === 5 ? 1 : v));
  const dents = board.map((v, c) => (v === 4 ? c : -1)).filter((c) => c >= 0);
  if (skill !== 'easy' && dents.length) return dents[Math.floor(rnd() * dents.length)]; // finish the armour
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
  for (const len of alive(sunk)) for (const v of [false, true]) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
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
