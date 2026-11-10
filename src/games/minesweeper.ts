// Minesweeper engine: classic rules plus the arcade extras (lives, shield, double mines, moving mines,
// time bombs, hex grid) and a logic solver used for no-guess boards, smart flagging and the replay analysis.
// The first click is always safe: mines are placed afterwards, away from it.

/** mine: 0 = none, 1 = mine, 2 = double mine (counts twice). kind: special mines in arcade mode. */
export type Cell = { mine: number; n: number; open: boolean; flag: number; d: number; kind?: 'moving' | 'timer'; boom?: boolean; by?: string };
export type Opts = { hex?: boolean; lives?: number; doubles?: number; moving?: number; timers?: number; noGuess?: boolean };
export type MS = {
  w: number; h: number; mines: number; cells: Cell[]; state: 'ready' | 'play' | 'won' | 'lost'; hit: number;
  hex: boolean; lives: number; shield: number; moves: number; opts: Opts;
  /** active time bomb: cell index and moves left until it explodes */
  timer: { i: number; left: number } | null;
  /** last event worth telling the player about */
  note: '' | 'moved' | 'timer' | 'defused' | 'blast' | 'hit' | 'shield';
};

export const LEVELS = { easy: [9, 9, 10], medium: [16, 16, 40], hard: [30, 16, 99] } as const;
export type MsLevel = keyof typeof LEVELS;

export const newGame = (w: number, h: number, mines: number, opts: Opts = {}): MS => ({
  w, h, mines, state: 'ready', hit: -1, hex: !!opts.hex, lives: opts.lives ?? 1, shield: 0, moves: 0, opts, timer: null, note: '',
  cells: Array.from({ length: w * h }, () => ({ mine: 0, n: 0, open: false, flag: 0, d: 0 })),
});

// hex grids use "odd-r" offset rows: odd rows are shifted half a cell to the right
const SQ = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const HEX_EVEN = [[-1, 0], [1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]];
const HEX_ODD = [[-1, 0], [1, 0], [0, -1], [1, -1], [0, 1], [1, 1]];
export function neighbours(ms: { w: number; h: number; hex?: boolean }, i: number) {
  const x = i % ms.w, y = Math.floor(i / ms.w), out: number[] = [];
  for (const [dx, dy] of ms.hex ? (y % 2 ? HEX_ODD : HEX_EVEN) : SQ) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < ms.w && ny < ms.h) out.push(ny * ms.w + nx);
  }
  return out;
}

function recount(ms: MS) {
  ms.cells.forEach((c, i) => (c.n = neighbours(ms, i).reduce((a, j) => a + ms.cells[j].mine, 0)));
}

function placeOnce(ms: MS, safe: number, rand: () => number) {
  for (const c of ms.cells) { c.mine = 0; c.kind = undefined; }
  const banned = new Set(safe < 0 ? [] : [safe, ...neighbours(ms, safe)]);
  const free = ms.cells.map((_, i) => i).filter((i) => !banned.has(i));
  const chosen: number[] = [];
  for (let k = 0; k < ms.mines && free.length; k++) chosen.push(free.splice(Math.floor(rand() * free.length), 1)[0]);
  const o = ms.opts;
  const shuffled = [...chosen].sort(() => rand() - 0.5);
  let k = 0;
  for (const i of chosen) ms.cells[i].mine = 1;
  for (let n = Math.round((o.doubles ?? 0) * chosen.length); n > 0 && k < shuffled.length; n--) ms.cells[shuffled[k++]].mine = 2;
  for (let n = o.moving ?? 0; n > 0 && k < shuffled.length; n--) ms.cells[shuffled[k++]].kind = 'moving';
  for (let n = o.timers ?? 0; n > 0 && k < shuffled.length; n--) ms.cells[shuffled[k++]].kind = 'timer';
  recount(ms);
}

/** Place mines after the first click. With noGuess the layout is regenerated until the solver can finish it. */
function place(ms: MS, safe: number, rand = Math.random) {
  const tries = ms.opts.noGuess ? 400 : 1;
  for (let t = 0; t < tries; t++) {
    placeOnce(ms, safe, rand);
    if (!ms.opts.noGuess || solvable(ms, safe)) return true;
  }
  return false;
}

/** Open a cell; empty areas flood-fill. `d` is the BFS depth, used to stagger the reveal animation. */
export function open(ms: MS, i: number, by?: string): 'none' | 'safe' | 'hit' | 'shield' | 'lost' {
  if (ms.state === 'won' || ms.state === 'lost') return 'none';
  if (ms.state === 'ready') { place(ms, i); ms.state = 'play'; }
  const c = ms.cells[i];
  if (c.open || c.flag) return 'none';
  if (c.mine) return explode(ms, i);
  const queue: [number, number][] = [[i, 0]];
  c.open = true;
  c.d = 0;
  c.by = by;
  while (queue.length) {
    const [j, d] = queue.shift()!;
    if (ms.cells[j].n) continue;
    for (const k of neighbours(ms, j)) {
      const nb = ms.cells[k];
      if (!nb.open && !nb.flag && !nb.mine) { nb.open = true; nb.d = d + 1; nb.by = by; queue.push([k, d + 1]); }
    }
  }
  checkWin(ms);
  return 'safe';
}

/** A mine went off: the shield absorbs it, a spare life marks it, the last life ends the game. */
function explode(ms: MS, i: number): 'hit' | 'shield' | 'lost' {
  const c = ms.cells[i];
  if (ms.shield > 0) { ms.shield--; c.flag = c.mine; ms.note = 'shield'; if (ms.timer?.i === i) ms.timer = null; return 'shield'; }
  if (ms.lives > 1) { ms.lives--; c.flag = c.mine; c.boom = true; ms.note = 'hit'; if (ms.timer?.i === i) ms.timer = null; checkWin(ms); return 'hit'; }
  c.open = true;
  ms.hit = i;
  ms.lives = 0;
  ms.state = 'lost';
  return 'lost';
}

function checkWin(ms: MS) {
  if (ms.state === 'play' && ms.cells.every((x) => x.mine || x.open)) {
    ms.state = 'won';
    ms.cells.forEach((x) => x.mine && (x.flag = x.mine));
  }
}

/** Sum of flag values around a cell (a double flag counts 2). */
const flagSum = (ms: MS, i: number) => neighbours(ms, i).reduce((a, j) => a + (ms.cells[j].open ? 0 : ms.cells[j].flag), 0);

/** Clicking an opened number whose flags are all placed opens the remaining neighbours. */
export function chord(ms: MS, i: number, by?: string) {
  const c = ms.cells[i];
  if (!c.open || !c.n || ms.state !== 'play') return false;
  const nb = neighbours(ms, i);
  if (flagSum(ms, i) !== c.n) return false;
  for (const j of nb) if (!ms.cells[j].flag && !ms.cells[j].open) open(ms, j, by);
  return true;
}

/** Toggle a flag. With double mines in play the flag cycles none → single → double. */
export function flag(ms: MS, i: number) {
  const c = ms.cells[i];
  if (c.open || ms.state === 'won' || ms.state === 'lost') return false;
  c.flag = ms.opts.doubles ? (c.flag + 1) % 3 : c.flag ? 0 : 1;
  return true;
}

// ---------- arcade: moves, moving mines, time bombs, power-ups ----------
const MOVE_EVERY = 7, TIMER_MOVES = 12;
/** Call once per player move (a dig or chord). Handles time bombs and relocating mines. */
export function tick(ms: MS, rand = Math.random) {
  if (ms.state !== 'play') return;
  ms.moves++;
  // time bomb: armed as soon as a number next to it is visible; defused by a flag on it
  if (ms.timer) {
    const c = ms.cells[ms.timer.i];
    if (c.flag) { c.kind = undefined; ms.timer = null; ms.note = 'defused'; }
    else if (--ms.timer.left <= 0) {
      const i = ms.timer.i;
      ms.timer = null;
      c.kind = undefined;
      ms.note = 'blast';
      explode(ms, i);
    }
  } else {
    const t = ms.cells.findIndex((c, i) => c.kind === 'timer' && !c.flag && neighbours(ms, i).some((j) => ms.cells[j].open));
    if (t >= 0) { ms.timer = { i: t, left: TIMER_MOVES }; ms.note = 'timer'; }
  }
  // moving mine: every few moves one unflagged moving mine jumps to a hidden cell far from the open area
  if (ms.moves % MOVE_EVERY === 0) {
    const movers = ms.cells.map((c, i) => [c, i] as const).filter(([c]) => c.kind === 'moving' && !c.flag && !c.open);
    if (movers.length) {
      const [from, fi] = movers[Math.floor(rand() * movers.length)];
      const targets = ms.cells.map((_, i) => i).filter((i) => !ms.cells[i].mine && !ms.cells[i].open && !ms.cells[i].flag && !neighbours(ms, i).some((j) => ms.cells[j].open));
      if (targets.length) {
        const ti = targets[Math.floor(rand() * targets.length)], to = ms.cells[ti];
        to.mine = from.mine; to.kind = 'moving'; from.mine = 0; from.kind = undefined;
        recount(ms);
        ms.note = 'moved';
        void fi;
      }
    }
  }
}

/** Scanner: safely reveals a 3x3 area (hex: the cell and its ring); mines inside get flagged. */
export function scan(ms: MS, i: number, by?: string) {
  if (ms.state === 'ready') { place(ms, i); ms.state = 'play'; }
  for (const j of [i, ...neighbours(ms, i)]) {
    const c = ms.cells[j];
    if (c.open) continue;
    if (c.mine) { c.flag = c.mine; if (ms.timer?.i === j) { ms.timer = null; c.kind = undefined; } }
    else { c.flag = 0; open(ms, j, by); }
  }
  checkWin(ms);
}

/** Detector: flags one mine the player has not found yet (prefers mines next to the open area). Returns its index. */
export function detect(ms: MS, rand = Math.random) {
  const hidden = ms.cells.map((c, i) => i).filter((i) => ms.cells[i].mine && ms.cells[i].flag !== ms.cells[i].mine && !ms.cells[i].open);
  if (!hidden.length) return -1;
  const near = hidden.filter((i) => neighbours(ms, i).some((j) => ms.cells[j].open));
  const pool = near.length ? near : hidden;
  const i = pool[Math.floor(rand() * pool.length)];
  ms.cells[i].flag = ms.cells[i].mine;
  if (ms.timer?.i === i) { ms.timer = null; ms.cells[i].kind = undefined; }
  return i;
}

// ---------- logic solver (counts only what the player can see) ----------
/**
 * One round of deductions on the visible board. `known` holds cells already deduced: 'm' mine, 's' safe.
 * Rules: a number whose remaining mines are 0 makes its hidden neighbours safe; if the remaining equals the
 * hidden count they are all mines; and the subset rule between two neighbouring numbers. Double mines are
 * ignored by the "all mines" rules (the solver is only used for boards without them).
 */
export function deduce(ms: MS, known: Map<number, 'm' | 's'> = new Map()) {
  let changed = true;
  const info = () => {
    const out: { i: number; hidden: number[]; left: number }[] = [];
    ms.cells.forEach((c, i) => {
      if (!c.open || !c.n) return;
      const nb = neighbours(ms, i);
      const hidden = nb.filter((j) => !ms.cells[j].open && !known.has(j));
      if (!hidden.length) return;
      const mines = nb.filter((j) => known.get(j) === 'm').length;
      out.push({ i, hidden, left: c.n - mines });
    });
    return out;
  };
  let guard = 0;
  while (changed && guard++ < 200) {
    changed = false;
    const cons = info();
    for (const k of cons) {
      if (k.left === 0) for (const j of k.hidden) { known.set(j, 's'); changed = true; }
      else if (k.left === k.hidden.length) for (const j of k.hidden) { known.set(j, 'm'); changed = true; }
    }
    if (changed) continue;
    // subset rule: if A's hidden cells are inside B's, the difference holds B.left - A.left mines
    for (const a of cons) for (const b of cons) {
      if (a === b || a.hidden.length >= b.hidden.length) continue;
      if (!a.hidden.every((j) => b.hidden.includes(j))) continue;
      const rest = b.hidden.filter((j) => !a.hidden.includes(j)), left = b.left - a.left;
      if (left === 0) for (const j of rest) { known.set(j, 's'); changed = true; }
      else if (left === rest.length) for (const j of rest) { known.set(j, 'm'); changed = true; }
    }
  }
  return known;
}

/** Can the board be cleared from `first` by logic alone? (Works on a copy.) */
export function solvable(ms: MS, first: number) {
  const sim: MS = { ...ms, cells: ms.cells.map((c) => ({ ...c, open: false, flag: 0 })), state: 'play', opts: { ...ms.opts, noGuess: false } };
  open(sim, first);
  const known = new Map<number, 'm' | 's'>();
  for (let round = 0; round < 500 && sim.state === 'play'; round++) {
    deduce(sim, known);
    const safe = [...known].filter(([j, v]) => v === 's' && !sim.cells[j].open);
    if (!safe.length) return false;
    for (const [j] of safe) { known.delete(j); open(sim, j); }
    if ((sim.state as MS['state']) === 'lost') return false;
  }
  return sim.state === 'won';
}

/** Smart flagging: flag forced mines and open forced safe cells next to visible numbers. Returns how many cells changed. */
export function smart(ms: MS, by?: string) {
  if (ms.state !== 'play') return 0;
  let n = 0;
  for (let pass = 0; pass < 20; pass++) {
    let changed = false;
    ms.cells.forEach((c, i) => {
      if (!c.open || !c.n || ms.state !== 'play') return;
      const nb = neighbours(ms, i), hidden = nb.filter((j) => !ms.cells[j].open && !ms.cells[j].flag);
      if (!hidden.length) return;
      const left = c.n - flagSum(ms, i);
      if (left === 0) { for (const j of hidden) open(ms, j, by); changed = true; n += hidden.length; }
      else if (!ms.opts.doubles && left === hidden.length) { for (const j of hidden) ms.cells[j].flag = 1; changed = true; n += hidden.length; }
    });
    if (!changed) break;
  }
  return n;
}

/** Replay analysis: given the board just before a fatal click, was there a cell that logic proved safe? */
export function safeMoveIn(ms: MS) {
  const known = deduce({ ...ms, cells: ms.cells.map((c) => ({ ...c })) });
  for (const [j, v] of known) if (v === 's' && !ms.cells[j].open) return j;
  return -1;
}

/** Deep copy of a board (for replays and network snapshots). */
export const cloneMS = (ms: MS): MS => ({ ...ms, timer: ms.timer && { ...ms.timer }, cells: ms.cells.map((c) => ({ ...c })) });

// ---------- versus (mine hunt): find mines, a find lets you go again ----------
/** Returns 'mine' (claimed, go again), 'safe' (turn passes) or 'none'. */
export function hunt(ms: MS, i: number, by: string) {
  if (ms.state === 'ready') { placeOnce(ms, -1, Math.random); ms.state = 'play'; }
  const c = ms.cells[i];
  if (c.open || c.flag) return 'none';
  if (c.mine) { c.flag = 1; c.by = by; c.open = true; return 'mine'; }
  open(ms, i, by);
  if (ms.state === 'won') ms.state = 'play'; // in versus the game ends on points, not on cleared cells
  return 'safe';
}
