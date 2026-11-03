// Classic Minesweeper. The first click is always safe (mines are placed afterwards, away from it).
export type Cell = { mine: boolean; n: number; open: boolean; flag: boolean; d: number };
export type MS = { w: number; h: number; mines: number; cells: Cell[]; state: 'ready' | 'play' | 'won' | 'lost'; hit: number };

export const LEVELS = { easy: [9, 9, 10], medium: [16, 16, 40], hard: [30, 16, 99] } as const;
export type MsLevel = keyof typeof LEVELS;

export const newGame = (w: number, h: number, mines: number): MS => ({
  w, h, mines, state: 'ready', hit: -1,
  cells: Array.from({ length: w * h }, () => ({ mine: false, n: 0, open: false, flag: false, d: 0 })),
});

export function neighbours(ms: MS, i: number) {
  const x = i % ms.w, y = Math.floor(i / ms.w), out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = x + dx, ny = y + dy;
    if ((dx || dy) && nx >= 0 && ny >= 0 && nx < ms.w && ny < ms.h) out.push(ny * ms.w + nx);
  }
  return out;
}

function place(ms: MS, safe: number) {
  const banned = new Set([safe, ...neighbours(ms, safe)]);
  const free = ms.cells.map((_, i) => i).filter((i) => !banned.has(i));
  for (let k = 0; k < ms.mines && free.length; k++) {
    const j = Math.floor(Math.random() * free.length);
    ms.cells[free.splice(j, 1)[0]].mine = true;
  }
  ms.cells.forEach((c, i) => (c.n = neighbours(ms, i).filter((j) => ms.cells[j].mine).length));
}

/** Open a cell; empty areas flood-fill. `d` is the BFS depth, used to stagger the reveal animation. */
export function open(ms: MS, i: number) {
  if (ms.state === 'won' || ms.state === 'lost') return;
  if (ms.state === 'ready') { place(ms, i); ms.state = 'play'; }
  const c = ms.cells[i];
  if (c.open || c.flag) return;
  if (c.mine) {
    c.open = true;
    ms.hit = i;
    ms.state = 'lost';
    return;
  }
  const queue: [number, number][] = [[i, 0]];
  c.open = true;
  c.d = 0;
  while (queue.length) {
    const [j, d] = queue.shift()!;
    if (ms.cells[j].n) continue;
    for (const k of neighbours(ms, j)) {
      const nb = ms.cells[k];
      if (!nb.open && !nb.flag && !nb.mine) { nb.open = true; nb.d = d + 1; queue.push([k, d + 1]); }
    }
  }
  if (ms.cells.every((x) => x.mine || x.open)) {
    ms.state = 'won';
    ms.cells.forEach((x) => x.mine && (x.flag = true));
  }
}

/** Clicking an opened number whose flags are all placed opens the remaining neighbours. */
export function chord(ms: MS, i: number) {
  const c = ms.cells[i];
  if (!c.open || !c.n || ms.state !== 'play') return false;
  const nb = neighbours(ms, i);
  if (nb.filter((j) => ms.cells[j].flag).length !== c.n) return false;
  for (const j of nb) if (!ms.cells[j].flag && !ms.cells[j].open) open(ms, j);
  return true;
}

export function flag(ms: MS, i: number) {
  const c = ms.cells[i];
  if (c.open || ms.state === 'won' || ms.state === 'lost') return false;
  c.flag = !c.flag;
  return true;
}
