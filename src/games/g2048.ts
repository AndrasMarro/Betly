// 2048: slide the tiles, equal neighbours merge into their sum. Tiles keep an id so the page can animate them.
export const SIZE = 4;
export type Tile = { id: number; v: number; x: number; y: number; gone?: boolean; merged?: boolean; fresh?: boolean };
export type Dir = 'left' | 'right' | 'up' | 'down';
let nextId = 1;

/** Put a 2 (90 %) or a 4 on a random empty cell. */
export function spawn(tiles: Tile[], rnd = Math.random): Tile[] {
  const live = tiles.filter((t) => !t.gone);
  const free: [number, number][] = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (!live.some((t) => t.x === x && t.y === y)) free.push([x, y]);
  if (!free.length) return tiles;
  const [x, y] = free[Math.floor(rnd() * free.length)];
  return [...tiles, { id: nextId++, v: rnd() < 0.9 ? 2 : 4, x, y, fresh: true }];
}
export const newBoard = (rnd = Math.random) => spawn(spawn([], rnd), rnd);

/**
 * Slide everything towards `dir`. Each tile merges at most once per move. Merged pairs move onto their target
 * and are marked gone (the page removes them after the slide), the sum appears there as a new tile.
 */
export function slide(tiles: Tile[], dir: Dir) {
  const live = tiles.filter((t) => !t.gone).map((t) => ({ ...t, merged: false, fresh: false }));
  const out: Tile[] = [];
  let moved = false, gained = 0;
  for (let line = 0; line < SIZE; line++) {
    // the tiles of this row/column, from the edge they slide towards
    const cells = live.filter((t) => (dir === 'left' || dir === 'right' ? t.y === line : t.x === line));
    const key = (t: Tile) => (dir === 'left' || dir === 'right' ? t.x : t.y);
    cells.sort((a, b) => (dir === 'left' || dir === 'up' ? key(a) - key(b) : key(b) - key(a)));
    let slot = 0;
    for (let i = 0; i < cells.length; i++) {
      const a = cells[i], b = cells[i + 1];
      const pos = dir === 'left' || dir === 'up' ? slot : SIZE - 1 - slot;
      const place = (t: Tile) => {
        const [x, y] = dir === 'left' || dir === 'right' ? [pos, line] : [line, pos];
        if (t.x !== x || t.y !== y) moved = true;
        t.x = x; t.y = y;
      };
      if (b && b.v === a.v) {
        place(a); place(b);
        moved = true;
        out.push({ ...a, gone: true }, { ...b, gone: true }, { id: nextId++, v: a.v * 2, x: a.x, y: a.y, merged: true });
        gained += a.v * 2;
        i++;
      } else {
        place(a);
        out.push(a);
      }
      slot++;
    }
  }
  return { tiles: out, moved, gained };
}

export const top = (tiles: Tile[]) => Math.max(0, ...tiles.filter((t) => !t.gone).map((t) => t.v));
export const canMove = (tiles: Tile[]) => (['left', 'right', 'up', 'down'] as Dir[]).some((d) => slide(tiles, d).moved);

/** Cash-out multiplier by the biggest tile reached (with a stake); nothing below 128. */
export const TIERS: [tile: number, mult: number][] = [[128, 1.1], [256, 1.4], [512, 2], [1024, 4], [2048, 10], [4096, 25], [8192, 60]];
export const multFor = (tile: number) => TIERS.reduce((m, [t, x]) => (tile >= t ? x : m), 0);
