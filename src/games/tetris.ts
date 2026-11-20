// Falling-blocks game: 10 × 20 well, 7-bag pieces from a seeded generator (everybody in a versus round gets
// the same pieces), simple wall kicks, hold, ghost, levels, and garbage lines for versus.
export const W = 10, H = 20, HIDDEN = 2; // two hidden rows above the well for spawning
export const KINDS = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const;
export type Kind = (typeof KINDS)[number];
/** Cell values: 0 empty, 1..7 the piece kinds, 8 garbage. */
export const GARBAGE = 8;

const SHAPES: Record<Kind, number[][]> = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
};
const rot = (m: number[][]) => m[0].map((_, i) => m.map((r) => r[i]).reverse());
/** The four rotations of every piece as lists of [x, y] cells. */
const CELLS = Object.fromEntries(KINDS.map((k) => {
  const rs: [number, number][][] = [];
  let m = SHAPES[k];
  for (let r = 0; r < 4; r++) { rs.push(m.flatMap((row, y) => row.flatMap((v, x) => (v ? [[x, y] as [number, number]] : [])))); m = rot(m); }
  return [k, rs];
})) as Record<Kind, [number, number][][]>;
export const cells = (k: Kind, r: number) => CELLS[k][((r % 4) + 4) % 4];
export const colorOf = (k: Kind) => KINDS.indexOf(k) + 1;

/** Small seeded generator, so all players of a round get the same pieces. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export type Piece = { k: Kind; r: number; x: number; y: number };
export type Game = {
  board: number[]; // (H + HIDDEN) × W, row 0 is the hidden top
  cur: Piece; queue: Kind[]; hold: Kind | null; canHold: boolean;
  score: number; lines: number; level: number; combo: number; over: boolean;
  pending: number;   // garbage lines waiting to rise
  rand: () => number; garbageRand: () => number;
  cleared: number[]; // rows cleared by the last lock (for the flash)
  sent: number;      // lines sent by the last lock
};
const ROWS = H + HIDDEN;

function bag(g: Game) {
  const b = [...KINDS];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(g.rand() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  g.queue.push(...b);
}
export function newGame(seed: number, level = 1): Game {
  const g: Game = { board: Array(ROWS * W).fill(0), cur: { k: 'I', r: 0, x: 3, y: 0 }, queue: [], hold: null, canHold: true, score: 0, lines: 0, level, combo: -1, over: false, pending: 0, rand: rng(seed), garbageRand: rng(seed ^ 0x9e3779b9), cleared: [], sent: 0 };
  bag(g);
  next(g);
  return g;
}
export const fits = (g: Game, p: Piece) => cells(p.k, p.r).every(([cx, cy]) => {
  const x = p.x + cx, y = p.y + cy;
  return x >= 0 && x < W && y < ROWS && (y < 0 || !g.board[y * W + x]);
});
function spawn(g: Game, k: Kind) {
  g.cur = { k, r: 0, x: k === 'O' ? 4 : 3, y: k === 'I' ? 0 : 1 };
  if (!fits(g, g.cur)) g.over = true;
}
function next(g: Game) {
  if (g.queue.length < 7) bag(g);
  spawn(g, g.queue.shift()!);
  g.canHold = true;
}

export function move(g: Game, dx: number) {
  const p = { ...g.cur, x: g.cur.x + dx };
  if (g.over || !fits(g, p)) return false;
  g.cur = p;
  return true;
}
const KICKS = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0], [-1, -1], [1, -1]];
export function rotate(g: Game, dir: 1 | -1) {
  if (g.over || g.cur.k === 'O') return false;
  for (const [kx, ky] of KICKS) {
    const p = { ...g.cur, r: g.cur.r + dir, x: g.cur.x + kx, y: g.cur.y + ky };
    if (fits(g, p)) { g.cur = p; return true; }
  }
  return false;
}
export function holdPiece(g: Game) {
  if (g.over || !g.canHold) return false;
  const k = g.cur.k;
  if (g.hold) spawn(g, g.hold); else next(g);
  g.hold = k;
  g.canHold = false;
  return true;
}
export const ghost = (g: Game) => { let y = g.cur.y; while (fits(g, { ...g.cur, y: y + 1 })) y++; return y; };
/** Gravity / soft drop: one row down, or lock when it cannot fall. Returns true when the piece locked. */
export function step(g: Game) {
  if (g.over) return false;
  const p = { ...g.cur, y: g.cur.y + 1 };
  if (fits(g, p)) { g.cur = p; return false; }
  lock(g);
  return true;
}
export function hardDrop(g: Game) {
  if (g.over) return 0;
  const y = ghost(g), dist = y - g.cur.y;
  g.cur = { ...g.cur, y };
  g.score += dist * 2;
  lock(g);
  return dist;
}
/** Lines sent to the opponents for 1..4 cleared lines, plus a bonus for combos. */
export const ATTACK = [0, 0, 1, 2, 4];
export const POINTS = [0, 100, 300, 500, 800];
function lock(g: Game) {
  for (const [cx, cy] of cells(g.cur.k, g.cur.r)) {
    const y = g.cur.y + cy;
    if (y >= 0) g.board[y * W + g.cur.x + cx] = colorOf(g.cur.k);
  }
  g.cleared = [];
  for (let y = 0; y < ROWS; y++) if (g.board.slice(y * W, y * W + W).every(Boolean)) g.cleared.push(y);
  const n = g.cleared.length;
  for (const y of g.cleared) { g.board.splice(y * W, W); g.board.unshift(...Array(W).fill(0)); }
  g.sent = 0;
  if (n) {
    g.combo++;
    g.score += POINTS[n] * g.level + 50 * Math.max(0, g.combo) * g.level;
    g.lines += n;
    g.level = Math.max(g.level, 1 + Math.floor(g.lines / 10));
    let atk = ATTACK[n] + (g.combo >= 2 ? Math.floor(g.combo / 2) : 0);
    // what we send first cancels garbage that is still waiting for us
    const cancel = Math.min(atk, g.pending);
    g.pending -= cancel; atk -= cancel;
    g.sent = atk;
  } else {
    g.combo = -1;
    if (g.pending) { rise(g, g.pending); g.pending = 0; }
  }
  // anything left in the hidden rows means the stack topped out
  if (g.board.slice(0, HIDDEN * W).some(Boolean)) { g.over = true; return; }
  next(g);
}
/** Push n garbage rows up from the bottom; the gap stays in one column for a few rows, like in versus games. */
function rise(g: Game, n: number) {
  let hole = Math.floor(g.garbageRand() * W);
  for (let i = 0; i < n; i++) {
    if (i && g.garbageRand() < 0.3) hole = Math.floor(g.garbageRand() * W);
    g.board.splice(0, W);
    g.board.push(...Array.from({ length: W }, (_, x) => (x === hole ? 0 : GARBAGE)));
  }
  if (g.board.slice(0, HIDDEN * W).some(Boolean)) g.over = true;
}
/** Garbage sent by someone else: it rises when we next lock without clearing a line. */
export const receive = (g: Game, n: number) => { g.pending = Math.min(20, g.pending + n); };
/** Gravity interval in ms for a level. */
export const speed = (level: number) => Math.max(60, Math.round(800 * 0.84 ** (level - 1)));
/** Coins for cleared lines: more for several at once, scaled by the level. */
export const COINS = [0, 1, 3, 6, 12];
export const coinsFor = (n: number, level: number) => COINS[n] * Math.min(level, 15);

// ---------- bot ----------
/** Choose the best placement (rotation and column) with a classic heuristic. */
export function plan(g: Game): { r: number; x: number } {
  let best = { r: g.cur.r, x: g.cur.x }, bestScore = -Infinity;
  for (let r = 0; r < 4; r++) {
    for (let x = -2; x < W; x++) {
      let p: Piece = { ...g.cur, r: g.cur.r + r, x, y: 0 };
      if (!fits(g, p)) continue;
      while (fits(g, { ...p, y: p.y + 1 })) p = { ...p, y: p.y + 1 };
      const b = g.board.slice();
      for (const [cx, cy] of cells(p.k, p.r)) b[(p.y + cy) * W + p.x + cx] = 1;
      let lines = 0, holes = 0, bump = 0, agg = 0, prev = -1;
      for (let y = 0; y < ROWS; y++) if (b.slice(y * W, y * W + W).every(Boolean)) lines++;
      for (let cx = 0; cx < W; cx++) {
        let h = 0, seen = false;
        for (let y = 0; y < ROWS; y++) {
          if (b[y * W + cx]) { if (!seen) { h = ROWS - y; seen = true; } }
          else if (seen) holes++;
        }
        agg += h;
        if (prev >= 0) bump += Math.abs(h - prev);
        prev = h;
      }
      const s = -0.51 * agg + 0.76 * lines - 0.36 * holes - 0.18 * bump;
      if (s > bestScore) { bestScore = s; best = { r: g.cur.r + r, x }; }
    }
  }
  return best;
}

/** The board with the falling piece drawn in, as a short string for sending to the others. */
export function snapshot(g: Game) {
  const b = g.board.slice(HIDDEN * W);
  if (!g.over) for (const [cx, cy] of cells(g.cur.k, g.cur.r)) { const y = g.cur.y + cy - HIDDEN; if (y >= 0) b[y * W + g.cur.x + cx] = colorOf(g.cur.k); }
  return b.join('');
}
