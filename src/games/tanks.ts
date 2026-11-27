// Pappkameraden (Cardboard Tanks): cardboard tanks in a big cardboard box. Clear every enemy tank in a mission without
// being hit. Shells bounce off walls, shells shoot each other down, mines go off when an enemy rolls by, when shot
// or after their fuse, and blow up cardboard crates. Holes in the floor stop tanks but not shells.
// Pure game logic: the page feeds inputs, calls step() and draws the world (lib/tankDraw.ts).
export const T = 40, COLS = 20, ROWS = 14, AW = COLS * T, AH = ROWS * T;
export const TANK_R = 15, SHELL_R = 4, MINE_R = 9, BLAST = 66;

export type Team = 'p' | 'e';
export type Kind = 'player' | 'dummy' | 'rust' | 'patrol' | 'arrow' | 'sapper' | 'hunter' | 'sniper' | 'commander' | 'phantom' | 'shadow';
type Spec = {
  speed: number; turn: number; cd: [number, number]; max: number; bounce: number; shell: number; rocket?: boolean;
  mines?: number; mineCd?: number; aim: 'direct' | 'lead' | 'bank'; move: 'still' | 'wander' | 'chase'; dodge?: boolean; stealth?: boolean; noise?: number;
};
/** Each enemy kind: how it drives, aims and shoots. */
export const SPEC: Record<Kind, Spec> = {
  player: { speed: 95, turn: 99, cd: [0.12, 0.12], max: 5, bounce: 1, shell: 190, mines: 2, aim: 'direct', move: 'still' },
  dummy: { speed: 0, turn: 0.6, cd: [99, 99], max: 0, bounce: 0, shell: 0, aim: 'direct', move: 'still' },
  rust: { speed: 0, turn: 1.1, cd: [2.8, 4.5], max: 1, bounce: 1, shell: 140, aim: 'direct', move: 'still', noise: 0.22 },
  patrol: { speed: 42, turn: 1.6, cd: [2, 3.4], max: 1, bounce: 1, shell: 150, aim: 'direct', move: 'wander', noise: 0.12 },
  arrow: { speed: 0, turn: 2.2, cd: [1.8, 3], max: 1, bounce: 0, shell: 330, rocket: true, aim: 'direct', move: 'still' },
  sapper: { speed: 70, turn: 1.6, cd: [2.4, 3.8], max: 1, bounce: 1, shell: 150, mines: 4, mineCd: 3.5, aim: 'direct', move: 'wander', noise: 0.1 },
  hunter: { speed: 72, turn: 3, cd: [0.45, 1], max: 3, bounce: 1, shell: 185, aim: 'lead', move: 'chase', dodge: true },
  sniper: { speed: 0, turn: 2.6, cd: [1.8, 2.8], max: 1, bounce: 2, shell: 320, rocket: true, aim: 'bank', move: 'still' },
  commander: { speed: 96, turn: 3.6, cd: [0.35, 0.8], max: 4, bounce: 1, shell: 195, mines: 2, mineCd: 5, aim: 'lead', move: 'chase', dodge: true },
  phantom: { speed: 78, turn: 2.8, cd: [0.9, 1.8], max: 2, bounce: 1, shell: 190, aim: 'lead', move: 'chase', dodge: true, stealth: true },
  shadow: { speed: 128, turn: 4.2, cd: [0.5, 1.1], max: 3, bounce: 0, shell: 340, rocket: true, mines: 2, mineCd: 4, aim: 'lead', move: 'chase', dodge: true },
};
export const KIND_OF: Record<string, Kind> = { d: 'dummy', b: 'rust', g: 'patrol', t: 'arrow', y: 'sapper', r: 'hunter', s: 'sniper', p: 'commander', w: 'phantom', k: 'shadow' };
export const NAMES: Record<Kind, [string, string]> = {
  player: ['Du', 'You'], dummy: ['Zielscheibe', 'Target'], rust: ['Rostlaube', 'Rust Bucket'], patrol: ['Patrouille', 'Patrol'], arrow: ['Pfeil', 'Dart'], sapper: ['Pionier', 'Sapper'],
  hunter: ['Jäger', 'Hunter'], sniper: ['Scharfschütze', 'Marksman'], commander: ['Kommandant', 'Commander'], phantom: ['Phantom', 'Phantom'], shadow: ['Schatten', 'Shadow'],
};

export type Tank = {
  id: number; pid?: string; kind: Kind; team: Team; x: number; y: number; body: number; turret: number; alive: boolean;
  cool: number; mineCool: number; vx: number; vy: number; goal: { x: number; y: number }[]; think: number; want: number; aimOk: boolean;
  odo: number; seen: number; spawn: number; key: number;
};
export type Shell = { id: number; x: number; y: number; vx: number; vy: number; b: number; owner: number; team: Team; rocket: boolean; age: number };
export type Mine = { id: number; x: number; y: number; owner: number; team: Team; t: number };
export type Boom = { x: number; y: number; t: number; big: boolean };
export type Mark = { x: number; y: number; a: number; t: number };
/** What stays on the floor: scraps of a crate or a tank (k: 'crate' or the tank kind). */
export type Scrap = { x: number; y: number; a: number; s: number; k: string };
export type World = {
  mission: number; grid: string[][]; tanks: Tank[]; shells: Shell[]; mines: Mine[]; booms: Boom[]; tracks: Mark[]; scorch: { x: number; y: number; r: number }[];
  t: number; seq: number; events: string[]; dirty: boolean; debris: Scrap[]; shake: number; flag?: { x: number; y: number } | null;
};
export type Input = { mx: number; my: number; aim: number; fire: boolean; mine: boolean };

// ---------- missions: 20 x 14, '#' tin block, 'c' cardboard crate, 'o' hole, P/Q players, letters enemies ----------
export const MISSIONS: string[][] = [
  ['....................', '....................', '....................', '....................', '.........###........', '.........#..........', '..P......#.......b..', '.........#..........', '.........###........', '....................', '....................', '....................', '....................', '..Q.................'],
  ['....................', '....................', '....#..........#....', '....#..........#..b.', '....#..........#....', '....................', '..P.....cccc........', '........cccc........', '....................', '....#..........#....', '....#..........#..b.', '....#..........#....', '....................', '..Q.................'],
  ['....................', '.................g..', '......######........', '....................', '....................', '..P.....o..o........', '........o..o........', '........o..o.....b..', '....................', '....................', '......######........', '.................g..', '....................', '..Q.................'],
  ['....................', '..........#.......t.', '..........#.........', '...cc.....#.........', '...cc...............', '....................', '..P.......##........', '..........##.....g..', '....................', '...cc...............', '...cc.....#.........', '..........#.........', '..........#.......t.', '..Q.................'],
  ['....................', '....#.........#.....', '....#..ccc....#...y.', '....#.........#.....', '....######..###.....', '....................', '..P.....oooo........', '........oooo.....g..', '....................', '....###..######.....', '....#.........#.....', '....#....ccc..#...y.', '....#.........#.....', '..Q.................'],
  ['....................', '.......#....#.......', '.......#.ss.#.......', '.......#....#.......', '.......######.......', '....................', '..P................t', '...................b', '....................', '.......######.......', '.......#....#.......', '.......#....#.......', '.......#....#.......', '..Q.................'],
  ['....................', '...######..######...', '...#............#...', '...#..r.....g...#...', '...#............#...', '........cccc........', '..P.....c..c........', '........c..c........', '........cccc........', '...#............#...', '...#..g.....r...#...', '...#............#...', '...######..######...', '..Q.................'],
  ['..........o.........', '..........o......y..', '...###....o.........', '...#......o....###..', '...#...........#....', '.........cc....#....', '..P......cc.........', '.........cc......r..', '...#...........#....', '...#......o....#....', '...###....o....###..', '..........o.........', '..........o......y..', '..Q.......o.........'],
  ['....................', '..#....#....#....#..', '..#.s..#....#..t.#..', '..#....#....#....#..', '....................', '....................', '..P.....cccc.....r..', '........cccc........', '....................', '....................', '..#....#....#....#..', '..#.t..#....#..s.#..', '..#....#....#....#..', '..Q.................'],
  ['....................', '.....##########.....', '.....#........#.....', '.....#..p..r..#.....', '.....#........#.....', '.....###.cc.###.....', '..P.................', '....................', '.....###.cc.###.....', '.....#........#.....', '.....#..r.....#.....', '.....#........#.....', '.....##########.....', '..Q.................'],
  ['oooooo........oooooo', '....................', '...g.....##.....g...', '.........##.........', '....ccc......ccc....', '....c..........c....', '..P.c....ww....c....', '....c..........c....', '....ccc......ccc....', '.........##.........', '...g.....##.....y...', '....................', '....................', '..Q...........oooooo'],
  ['....................', '...#..........#..s..', '...#...####...#.....', '...#...#..#...#.....', '...#...#.p#...#.....', '...........r........', '..P.................', '...........r........', '...#...#..#...#.....', '...#...#..#...#.....', '...#...####...#.....', '...#..........#..s..', '....................', '..Q.................'],
  ['....................', '....######..######..', '....#..y.....y...#..', '....#............#..', '....#..cccccccc..#..', '.......c......c.....', '..P....c..kk..c.....', '.......c......c.....', '....#..cccccccc..#..', '....#............#..', '....#..y.....y...#..', '....######..######..', '....................', '..Q.................'],
  ['.........##.........', '...t.....##.....t...', '.........##.........', '...oooo..##..oooo...', '....................', '.....#........#.....', '..P..#..pwwp..#.....', '.....#........#.....', '....................', '...oooo..##..oooo...', '.........##.........', '...t.....##.....t...', '.........##.........', '..Q.................'],
  ['....................', '..##..##..##..##..##', '....................', '..s.....r.....s.....', '....................', '##..##..##..##..##..', '..P.................', '....................', '..##..##..##..##..##', '....................', '..s.....r.....k.....', '....................', '##..##..##..##..##..', '..Q.................'],
  ['....................', '....#c#c#c#c#c#c#...', '....c.........w.c...', '....#..........y#...', '....c...#####...c...', '....#...#...#...#...', '..P.c...#.k.#...c...', '....#...#...#...#...', '....c...##.##...c...', '....#..........p#...', '....c.........w.c...', '....#c#c#c#c#c#c#...', '....................', '..Q.................'],
  ['oooo..........oooo..', 'o..o..r....r..o..o..', 'oooo..........oooo..', '......#....#........', '......#.cc.#........', '..........p.........', '..P.................', '...........p........', '......#.cc.#........', '......#....#........', 'oooo..........oooo..', 'o..o..s....s..o..o..', 'oooo..........oooo..', '..Q.................'],
  ['....................', '.##.##.##.##.##.##..', '.#k................#', '.#...ccccccccccc...#', '.#...c.........c...#', '.....c..##.##..c....', '..P..c..#.w.#..c..w.', '.....c..##.##..c....', '.#...c.........c...#', '.#...ccccccccccc...#', '.#k................#', '.##.##.##.##.##.##..', '....................', '..Q.................'],
  ['.........#..........', '..s......#......s...', '.........#..........', '...ccc...#...ccc....', '...c.c.......c.c....', '...ccc..k.k..ccc....', '..P......#..........', '...ccc..p.p..ccc....', '...c.c.......c.c....', '...ccc...#...ccc....', '.........#..........', '..w......#......w...', '.........#..........', '..Q......#..........'],
  ['....................', '..#######..#######..', '..#..k.........k.#..', '..#..............#..', '..#..##cccccc##..#..', '.....#........#.....', '..P..#..kppk..#.....', '.....#........#.....', '..#..##cccccc##..#..', '..#..............#..', '..#..w.........w.#..', '..#######..#######..', '....................', '..Q.................'],
];
/** Missions after the 20th are built at random, harder every time. */
export function genMission(n: number, rnd = Math.random): string[] {
  const g = Array.from({ length: ROWS }, () => Array(COLS).fill('.'));
  const put = (x: number, y: number, c: string) => { if (x >= 0 && y >= 0 && x < COLS && y < ROWS) { g[y][x] = c; g[ROWS - 1 - y][COLS - 1 - x] = c === 'c' || c === '#' || c === 'o' ? c : g[ROWS - 1 - y][COLS - 1 - x]; } };
  for (let i = 0; i < 9; i++) {
    const x = 4 + Math.floor(rnd() * 14), y = Math.floor(rnd() * ROWS), len = 2 + Math.floor(rnd() * 4), v = rnd() < 0.5, c = rnd() < 0.6 ? '#' : rnd() < 0.6 ? 'c' : 'o';
    for (let k = 0; k < len; k++) put(v ? x : x + k, v ? y + k : y, c);
  }
  for (let y = 4; y <= 9; y++) for (let x = 0; x <= 4; x++) g[y][x] = '.';
  g[6][2] = 'P'; g[13][2] = '.'; g[12][2] = 'Q'; g[12][1] = '.'; g[12][3] = '.'; g[11][2] = '.';
  const pool = 'grtysp' + (n > 25 ? 'wk' : 'w');
  const count = Math.min(9, 4 + Math.floor((n - 20) / 3));
  for (let i = 0, tries = 0; i < count && tries < 300; tries++) {
    const x = 9 + Math.floor(rnd() * 11), y = Math.floor(rnd() * ROWS);
    if (g[y][x] === '.') { g[y][x] = pool[Math.floor(rnd() * pool.length)]; i++; }
  }
  return g.map((r) => r.join(''));
}
export const missionMap = (n: number, rnd = Math.random) => (n < MISSIONS.length ? MISSIONS[n] : genMission(n, rnd));
export const enemyCount = (rows: string[]) => rows.join('').split('').filter((c) => KIND_OF[c]).length;
/** Lives: 3 to start, one more for every 5 missions cleared. */
export const bonusLife = (cleared: number) => cleared > 0 && cleared % 5 === 0;
/** What a mission run is worth: grows with every cleared mission. */
export const multFor = (cleared: number) => Math.round((1 + 0.22 * cleared + 0.018 * cleared * cleared) * 100) / 100;

// ---------- the world ----------
/** A fresh world for mission n. `players`: ids of the human tanks (1 or 2). `gone`: enemy slots already destroyed (kept on a retry). */
export function newWorld(n: number, players: string[], gone: number[] = [], rnd = Math.random, custom?: string[]): World {
  const rows = custom ?? missionMap(n, rnd);
  const grid = rows.map((r) => r.split(''));
  const w: World = { mission: n, grid, tanks: [], shells: [], mines: [], booms: [], tracks: [], scorch: [], t: 0, seq: 1, events: [], dirty: true, debris: [], shake: 0, flag: null };
  let slot = 0;
  const pts = { P: null as null | [number, number], Q: null as null | [number, number] };
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const c = grid[y][x];
    if (c === 'P' || c === 'Q') { pts[c] = [x, y]; grid[y][x] = '.'; }
    else if (KIND_OF[c]) {
      grid[y][x] = '.';
      const s = slot++;
      if (!gone.includes(s)) w.tanks.push(mk(w, KIND_OF[c], 'e', x, y, Math.PI, s));
    }
  }
  const P = pts.P ?? [2, 6], Q = pts.Q ?? [P[0], Math.min(ROWS - 1, P[1] + 2)];
  players.forEach((pid, i) => { const t = mk(w, 'player', 'p', ...(i ? Q : P), 0, -1 - i); t.pid = pid; w.tanks.push(t); });
  return w;
}
function mk(w: World, kind: Kind, team: Team, gx: number, gy: number, a: number, spawn: number): Tank {
  return { id: w.seq++, kind, team, x: gx * T + T / 2, y: gy * T + T / 2, body: a, turret: a, alive: true, cool: team === 'p' ? 0 : 1 + Math.random(), mineCool: team === 'p' ? 0 : 2, vx: 0, vy: 0, goal: [], think: 0, want: a, aimOk: false, odo: 0, seen: 0, spawn, key: 0 };
}
const cell = (w: World, x: number, y: number) => { const gx = Math.floor(x / T), gy = Math.floor(y / T); return gx < 0 || gy < 0 || gx >= COLS || gy >= ROWS ? '#' : w.grid[gy][gx]; };
/** Blocks shells: tin blocks and crates. */
export const hard = (w: World, x: number, y: number) => { const c = cell(w, x, y); return c === '#' || c === 'c'; };
/** Blocks tanks: also holes. */
const blocked = (w: World, x: number, y: number) => { const c = cell(w, x, y); return c === '#' || c === 'c' || c === 'o'; };
function tankFits(w: World, x: number, y: number) {
  const r = TANK_R - 1;
  return !blocked(w, x - r, y - r) && !blocked(w, x + r, y - r) && !blocked(w, x - r, y + r) && !blocked(w, x + r, y + r) && !blocked(w, x, y);
}
const ang = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const turnTo = (a: number, b: number, max: number) => { const d = ang(b - a); return Math.abs(d) <= max ? b : a + Math.sign(d) * max; };

/** Follows a shell from (x, y) at angle a: the first tank it would hit (or null), checking up to `len` pixels. */
export function trace(w: World, x: number, y: number, a: number, bounces: number, len = 1400, skip = -1): Tank | null {
  let vx = Math.cos(a) * 4, vy = Math.sin(a) * 4, b = bounces;
  for (let d = 0; d < len; d += 4) {
    const nx = x + vx;
    if (hard(w, nx, y)) { if (b-- <= 0) return null; vx = -vx; } else x = nx;
    const ny = y + vy;
    if (hard(w, x, ny)) { if (b-- <= 0) return null; vy = -vy; } else y = ny;
    for (const t of w.tanks) if (t.alive && t.id !== skip && (x - t.x) ** 2 + (y - t.y) ** 2 < (TANK_R + 2) ** 2) return t;
  }
  return null;
}
const muzzle = (t: Tank) => ({ x: t.x + Math.cos(t.turret) * 24, y: t.y + Math.sin(t.turret) * 24 });

function fire(w: World, t: Tank) {
  const s = SPEC[t.kind];
  if (t.cool > 0 || w.shells.filter((x) => x.owner === t.id).length >= s.max) return false;
  const m = muzzle(t);
  if (hard(w, m.x, m.y)) return false; // barrel in a wall
  w.shells.push({ id: w.seq++, x: m.x, y: m.y, vx: Math.cos(t.turret) * s.shell, vy: Math.sin(t.turret) * s.shell, b: s.bounce, owner: t.id, team: t.team, rocket: !!s.rocket, age: 0 });
  t.cool = s.cd[0] + Math.random() * (s.cd[1] - s.cd[0]);
  w.events.push(s.rocket ? 'rocket' : 'fire');
  return true;
}
function layMine(w: World, t: Tank) {
  const s = SPEC[t.kind];
  if (t.mineCool > 0 || w.mines.filter((m) => m.owner === t.id).length >= (s.mines ?? 0)) return;
  if (w.mines.some((m) => (m.x - t.x) ** 2 + (m.y - t.y) ** 2 < 30 * 30)) return;
  w.mines.push({ id: w.seq++, x: t.x, y: t.y, owner: t.id, team: t.team, t: 0 });
  t.mineCool = t.team === 'p' ? 0.4 : (s.mineCd ?? 4);
  w.events.push('mine');
}
function explode(w: World, x: number, y: number) {
  w.booms.push({ x, y, t: 0, big: true });
  w.scorch.push({ x, y, r: BLAST * 0.7 });
  w.events.push('boom');
  w.shake = Math.max(w.shake, 0.35);
  for (const t of w.tanks) if (t.alive && (t.x - x) ** 2 + (t.y - y) ** 2 < (BLAST + TANK_R * 0.4) ** 2) kill(w, t);
  w.shells = w.shells.filter((s) => (s.x - x) ** 2 + (s.y - y) ** 2 > BLAST * BLAST);
  // cardboard crates inside the blast are gone
  for (let gy = 0; gy < ROWS; gy++) for (let gx = 0; gx < COLS; gx++) {
    if (w.grid[gy][gx] !== 'c') continue;
    const cx = Math.max(gx * T, Math.min(x, gx * T + T)), cy = Math.max(gy * T, Math.min(y, gy * T + T));
    if ((cx - x) ** 2 + (cy - y) ** 2 < BLAST * BLAST * 0.8) { w.grid[gy][gx] = '.'; w.dirty = true; w.booms.push({ x: gx * T + T / 2, y: gy * T + T / 2, t: 0.1, big: false }); scraps(w, gx * T + T / 2, gy * T + T / 2, 'crate', 9, 22); }
  }
  // other mines nearby go off too
  const chain = w.mines.filter((m) => (m.x - x) ** 2 + (m.y - y) ** 2 < BLAST * BLAST);
  w.mines = w.mines.filter((m) => !chain.includes(m));
  for (const m of chain) explode(w, m.x, m.y);
}
function kill(w: World, t: Tank) {
  if (!t.alive) return;
  t.alive = false;
  w.booms.push({ x: t.x, y: t.y, t: 0, big: true });
  w.scorch.push({ x: t.x, y: t.y, r: 30 });
  scraps(w, t.x, t.y, t.kind === 'player' && t.spawn === -2 ? 'player2' : t.kind, 12, 30);
  w.shake = Math.max(w.shake, t.team === 'p' ? 0.7 : 0.4);
  w.events.push(t.team === 'p' ? 'lost' : 'kill');
}
/** Leaves n scraps of kind k scattered within r around (x, y). */
function scraps(w: World, x: number, y: number, k: string, n: number, r: number) {
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, d = Math.random() * r; w.debris.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, a: Math.random() * 6.3, s: 3 + Math.random() * 6, k }); }
  if (w.debris.length > 500) w.debris.splice(0, w.debris.length - 500);
}

// ---------- enemy brains ----------
function pathTo(w: World, from: Tank, tx: number, ty: number): { x: number; y: number }[] {
  const sx = Math.floor(from.x / T), sy = Math.floor(from.y / T), gx = Math.floor(tx / T), gy = Math.floor(ty / T);
  const prev = new Map<number, number>(), q = [sy * COLS + sx];
  prev.set(q[0], -1);
  while (q.length) {
    const c = q.shift()!;
    if (c === gy * COLS + gx) break;
    const x = c % COLS, y = Math.floor(c / COLS);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = ny * COLS + nx;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || prev.has(k) || '#co'.includes(w.grid[ny][nx])) continue;
      if (w.mines.some((m) => Math.abs(m.x - (nx * T + T / 2)) < T && Math.abs(m.y - (ny * T + T / 2)) < T)) continue;
      prev.set(k, c); q.push(k);
    }
  }
  if (!prev.has(gy * COLS + gx)) return [];
  const out: { x: number; y: number }[] = [];
  for (let c = gy * COLS + gx; c !== -1 && c !== sy * COLS + sx; c = prev.get(c)!) out.unshift({ x: (c % COLS) * T + T / 2, y: Math.floor(c / COLS) * T + T / 2 });
  return out.slice(0, 6);
}
function brain(w: World, t: Tank, dt: number, rnd: () => number) {
  const s = SPEC[t.kind];
  const foes = w.tanks.filter((x) => x.alive && x.team === 'p');
  if (!foes.length) return;
  const foe = foes.reduce((a, b) => ((a.x - t.x) ** 2 + (a.y - t.y) ** 2 < (b.x - t.x) ** 2 + (b.y - t.y) ** 2 ? a : b));
  t.think -= dt;
  // aiming
  if (t.think <= 0) {
    t.think = s.aim === 'bank' ? 0.45 : 0.25;
    const hitsFoe = (a: number) => { const m = { x: t.x + Math.cos(a) * 24, y: t.y + Math.sin(a) * 24 }; const h = trace(w, m.x, m.y, a, s.bounce, 1400, t.id); return !!h && h.team === 'p'; };
    let want = Math.atan2(foe.y - t.y, foe.x - t.x);
    if (s.aim === 'lead') {
      const d = Math.hypot(foe.x - t.x, foe.y - t.y), time = d / s.shell;
      want = Math.atan2(foe.y + foe.vy * time - t.y, foe.x + foe.vx * time - t.x);
    }
    if (s.noise) want += (rnd() - 0.5) * s.noise * 2;
    let ok = hitsFoe(want);
    if (!ok && (s.aim === 'bank' || s.bounce > 0)) {
      // look for a bank shot around the walls
      const tries = s.aim === 'bank' ? 90 : 24;
      for (let i = 0; i < tries && !ok; i++) {
        const a = s.aim === 'bank' ? (i / tries) * Math.PI * 2 : want + (rnd() - 0.5) * 1.6;
        if (hitsFoe(a)) { want = a; ok = true; }
      }
    }
    t.want = want; t.aimOk = ok;
    // otherwise idle the turret around a little
    if (!ok && s.aim !== 'bank') t.want = t.turret + (rnd() - 0.5) * 1.2;
  }
  t.turret = turnTo(t.turret, t.want, s.turn * dt);
  if (t.aimOk && Math.abs(ang(t.turret - t.want)) < 0.06) {
    // never fire into a friend
    const m = muzzle(t), h = trace(w, m.x, m.y, t.turret, s.bounce, 1400, t.id);
    if (h && h.team === 'p') fire(w, t);
  }
  // mines
  t.mineCool -= dt;
  if (s.mines && t.mineCool <= 0 && rnd() < dt * 0.6) layMine(w, t);
  // driving
  if (!s.speed) { t.vx = t.vy = 0; return; }
  let mx = 0, my = 0;
  // dodge incoming shells and keep away from mines
  if (s.dodge) for (const sh of w.shells) {
    if (sh.team === t.team) continue;
    const rx = t.x - sh.x, ry = t.y - sh.y, sp = Math.hypot(sh.vx, sh.vy), along = (rx * sh.vx + ry * sh.vy) / sp;
    if (along < 0 || along > 160) continue;
    const side = (rx * sh.vy - ry * sh.vx) / sp;
    if (Math.abs(side) < 34) { mx += (sh.vy / sp) * Math.sign(side || 1) * 2; my += (-sh.vx / sp) * Math.sign(side || 1) * 2; }
  }
  for (const m of w.mines) { const d = Math.hypot(t.x - m.x, t.y - m.y); if (d < BLAST + 20) { mx += (t.x - m.x) / d * 2; my += (t.y - m.y) / d * 2; } }
  if (!mx && !my) {
    if (!t.goal.length || rnd() < dt * 0.3) {
      let tx: number, ty: number;
      if (s.move === 'chase') {
        // close in, but stop at a fighting distance
        const d = Math.hypot(foe.x - t.x, foe.y - t.y), keep = t.kind === 'shadow' ? 120 : 170;
        const k = d > keep ? 1 : -0.6;
        tx = t.x + (foe.x - t.x) * 0.6 * k + (rnd() - 0.5) * 80; ty = t.y + (foe.y - t.y) * 0.6 * k + (rnd() - 0.5) * 80;
      } else { tx = t.x + (rnd() - 0.5) * 320; ty = t.y + (rnd() - 0.5) * 320; }
      t.goal = pathTo(w, t, Math.max(T, Math.min(AW - T, tx)), Math.max(T, Math.min(AH - T, ty)));
    }
    const g = t.goal[0];
    if (g) { const d = Math.hypot(g.x - t.x, g.y - t.y); if (d < 6) t.goal.shift(); else { mx = (g.x - t.x) / d; my = (g.y - t.y) / d; } }
  }
  const len = Math.hypot(mx, my);
  t.vx = len ? (mx / len) * s.speed : 0; t.vy = len ? (my / len) * s.speed : 0;
}

/** Advances the world by dt seconds. inputs: per player id. */
export function step(w: World, dt: number, inputs: Record<string, Input>, rnd = Math.random) {
  w.t += dt;
  w.shake = Math.max(0, w.shake - dt);
  for (const t of w.tanks) {
    if (!t.alive) continue;
    t.cool -= dt;
    if (t.team === 'p') {
      const i = inputs[t.pid ?? ''];
      t.mineCool -= dt;
      if (i) {
        const l = Math.hypot(i.mx, i.my);
        t.vx = l > 0.1 ? (i.mx / Math.max(1, l)) * SPEC.player.speed : 0; t.vy = l > 0.1 ? (i.my / Math.max(1, l)) * SPEC.player.speed : 0;
        t.turret = i.aim;
        if (i.fire) fire(w, t);
        if (i.mine) layMine(w, t);
      } else t.vx = t.vy = 0;
    } else brain(w, t, dt, rnd);
    // drive: the body turns towards where it goes, the tread links roll along (key)
    if (t.vx || t.vy) {
      const a = Math.atan2(t.vy, t.vx);
      const d = ang(a - t.body);
      // a tank can drive backwards: pick the nearer of both ends
      const target = Math.abs(d) > Math.PI / 2 ? a + Math.PI : a;
      t.body = turnTo(t.body, target, 7 * dt);
      const nx = t.x + t.vx * dt, ny = t.y + t.vy * dt;
      const ox = t.x, oy = t.y;
      if (tankFits(w, nx, t.y)) t.x = nx;
      if (tankFits(w, t.x, ny)) t.y = ny;
      const moved = Math.hypot(t.x - ox, t.y - oy);
      t.odo += moved; t.key += moved * 0.08;
      if (t.odo > 9) { t.odo = 0; w.tracks.push({ x: t.x, y: t.y, a: t.body, t: w.t }); }
      if (moved < 0.01 && t.team === 'e') t.goal = [];
    }
    t.seen = SPEC[t.kind].stealth && w.t > 2.5 ? Math.max(0, t.seen - dt) : 1;
  }
  // tanks push each other apart
  for (const a of w.tanks) for (const b of w.tanks) {
    if (a.id >= b.id || !a.alive || !b.alive) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = TANK_R * 2;
    if (d > 0 && d < min) {
      const p = (min - d) / 2, ux = dx / d, uy = dy / d;
      if (tankFits(w, a.x - ux * p, a.y - uy * p)) { a.x -= ux * p; a.y -= uy * p; }
      if (tankFits(w, b.x + ux * p, b.y + uy * p)) { b.x += ux * p; b.y += uy * p; }
    }
  }
  // shells
  const dead = new Set<number>();
  for (const s of w.shells) {
    s.age += dt;
    const n = Math.ceil((Math.hypot(s.vx, s.vy) * dt) / 3);
    for (let k = 0; k < n && !dead.has(s.id); k++) {
      const sx = (s.vx * dt) / n, sy = (s.vy * dt) / n;
      if (hard(w, s.x + sx, s.y)) { if (s.b-- <= 0) { dead.add(s.id); w.booms.push({ x: s.x, y: s.y, t: 0, big: false }); w.events.push('pop'); break; } s.vx = -s.vx; w.events.push('bounce'); } else s.x += sx;
      if (hard(w, s.x, s.y + sy)) { if (s.b-- <= 0) { dead.add(s.id); w.booms.push({ x: s.x, y: s.y, t: 0, big: false }); w.events.push('pop'); break; } s.vy = -s.vy; w.events.push('bounce'); } else s.y += sy;
      for (const t of w.tanks) {
        if (!t.alive || (t.id === s.owner && s.age < 0.25)) continue;
        if ((t.x - s.x) ** 2 + (t.y - s.y) ** 2 < (TANK_R + SHELL_R) ** 2) { kill(w, t); dead.add(s.id); break; }
      }
      for (const m of w.mines) if ((m.x - s.x) ** 2 + (m.y - s.y) ** 2 < (MINE_R + SHELL_R) ** 2) { dead.add(s.id); m.t = 1e9; }
    }
    // a tank with stealth shows itself for a moment when it fires
    if (s.age < dt * 1.5) { const o = w.tanks.find((t) => t.id === s.owner); if (o) o.seen = 1; }
  }
  // shells shoot each other down
  for (const a of w.shells) for (const b of w.shells) {
    if (a.id >= b.id || dead.has(a.id) || dead.has(b.id)) continue;
    if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 < (SHELL_R * 2 + 2) ** 2) { dead.add(a.id); dead.add(b.id); w.booms.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, t: 0, big: false }); w.events.push('pop'); }
  }
  w.shells = w.shells.filter((s) => !dead.has(s.id));
  // mines: armed after a moment, go off when an enemy rolls close, when shot or when the fuse runs out (10 s)
  const going: Mine[] = [];
  for (const m of w.mines) {
    m.t += dt;
    const near = m.t > 0.6 && w.tanks.some((t) => t.alive && t.team !== m.team && (t.x - m.x) ** 2 + (t.y - m.y) ** 2 < 42 * 42);
    if (near || m.t > 10) going.push(m);
  }
  if (going.length) { w.mines = w.mines.filter((m) => !going.includes(m)); for (const m of going) explode(w, m.x, m.y); }
  for (const b of w.booms) b.t += dt;
  w.booms = w.booms.filter((b) => b.t < (b.big ? 0.9 : 0.4));
  if (w.tracks.length > 900) w.tracks.splice(0, w.tracks.length - 900);
  if (w.scorch.length > 60) w.scorch.splice(0, w.scorch.length - 60);
}
export const cleared = (w: World) => !w.tanks.some((t) => t.alive && t.team === 'e');
export const wiped = (w: World) => !w.tanks.some((t) => t.alive && t.team === 'p');
/** Enemy slots destroyed so far (they stay destroyed when the mission is tried again). */
export const goneSlots = (w: World, before: number[]) => [...before, ...w.tanks.filter((t) => t.team === 'e' && !t.alive).map((t) => t.spawn)];

// ---------- the training: five short lessons ----------
export type Lesson = { map: string[]; goal: 'reach' | 'kill' | 'crates'; flag?: [number, number]; de: [string, string]; en: [string, string] };
const open = (rows: Record<number, string>) => Array.from({ length: ROWS }, (_, y) => rows[y] ?? '....................');
export const LESSONS: Lesson[] = [
  { map: open({ 6: '..P.................' }), goal: 'reach', flag: [16, 6], de: ['Fahren', 'Fahr mit WASD oder den Pfeiltasten zur Fahne. Am Handy mit dem Stick unten links.'], en: ['Driving', 'Drive to the flag with WASD or the arrow keys. On a phone use the stick bottom left.'] },
  { map: open({ 6: '..P...........d.....' }), goal: 'kill', de: ['Schiessen', 'Der Turm folgt der Maus. Ziel auf die Zielscheibe und klick (am Handy: tippen).'], en: ['Shooting', 'The turret follows the mouse. Aim at the target and click (on a phone: tap).'] },
  { map: open({ 2: '........#...........', 3: '........#...........', 4: '........#...........', 5: '........#...........', 6: '..P.....#.....d.....', 7: '........#...........', 8: '........#...........', 9: '........#...........', 10: '........#...........', 11: '........#...........' }), goal: 'kill', de: ['Abpraller', 'Die Wand ist im Weg. Schiess schräg an den oberen oder unteren Rand: Geschosse prallen einmal ab.'], en: ['Bank shots', 'The wall is in the way. Fire at an angle off the top or bottom edge: shells bounce once.'] },
  { map: open({ 4: '..........cc........', 5: '..........cc........', 6: '..P.......cc........', 7: '..........cc........', 8: '..........cc........' }), goal: 'crates', de: ['Minen', 'Fahr an die Kisten, leg mit Leertaste (oder Rechtsklick, 💣) eine Mine und fahr schnell weg. Sprenge alle Kisten.'], en: ['Mines', 'Drive up to the crates, lay a mine with Space (or right click, 💣) and get away fast. Blow up all crates.'] },
  { map: open({ 3: '......#.....#.......', 6: '..P...........b.....', 9: '......#.....#.......' }), goal: 'kill', de: ['Ernstfall', 'Diese Rostlaube schiesst zurück. Schiess ihre Geschosse ab oder weich aus, dann erwisch sie.'], en: ['For real', 'This one shoots back. Shoot its shells down or dodge them, then get it.'] },
];
export function lessonWorld(i: number, player: string): World {
  const l = LESSONS[i];
  const w = newWorld(0, [player], [], Math.random, l.map);
  if (l.flag) w.flag = { x: l.flag[0] * T + T / 2, y: l.flag[1] * T + T / 2 };
  for (const t of w.tanks) if (t.kind === 'rust') t.cool = 3;
  return w;
}
export function lessonDone(i: number, w: World) {
  const l = LESSONS[i], me = w.tanks.find((t) => t.team === 'p');
  if (l.goal === 'reach') return !!me && !!w.flag && Math.hypot(me.x - w.flag.x, me.y - w.flag.y) < 26;
  if (l.goal === 'crates') return !w.grid.some((r) => r.includes('c'));
  return cleared(w);
}
