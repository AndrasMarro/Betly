// European single-zero roulette: pure logic, no UI.
export const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const color = (n: number) => (n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black');

export type Bet = { key: string; nums: number[]; amt: number; ax?: number; ay?: number };

// Table grid: 12 columns x 3 rows, row 0 is the top row (3, 6, 9 ...). Zero sits left of column 0.
export const numAt = (c: number, r: number) => 3 * c + 3 - r;
export const cellOf = (n: number) => ({ c: Math.floor((n - 1) / 3), r: 2 - ((n - 1) % 3) });

/**
 * Map a pointer position on the number grid to a bet. X in [-1, 12) (negative = zero cell), Y in [0, 3).
 * Near an edge between cells -> split, near a corner -> corner, on the outer long edge -> street / six line.
 */
export function spotAt(X: number, Y: number, e = 0.24): Bet | null {
  if (X < -e) return { key: '0', nums: [0], amt: 0, ax: -0.5, ay: 1.5 };
  const c = Math.min(11, Math.max(0, Math.floor(X)));
  const r = Math.min(2, Math.max(0, Math.floor(Y)));
  const fx = X - c, fy = Y - r;
  let vb = X < 0 ? 0 : fx < e ? c : fx > 1 - e ? c + 1 : -1;
  if (vb === 12) vb = -1;
  const hb = fy < e ? r : fy > 1 - e ? r + 1 : -1;
  const cols = vb === 0 ? [0] : vb > 0 ? [vb - 1, vb] : [c];
  const rows = hb === 0 || hb === 3 ? [0, 1, 2] : hb > 0 ? [hb - 1, hb] : [r];
  const nums = cols.flatMap((cc) => rows.map((rr) => numAt(cc, rr)));
  if (vb === 0) nums.push(0);
  nums.sort((a, b) => a - b);
  return { key: nums.join('-'), nums, amt: 0, ax: vb >= 0 ? vb : c + 0.5, ay: hb >= 0 ? hb : r + 0.5 };
}

/** Bet from an explicit number set (racetrack / announced bets), anchored at the centroid. */
export function betOf(nums: number[]): Bet {
  nums = [...nums].sort((a, b) => a - b);
  if (nums.length === 1 && nums[0] === 0) return { key: '0', nums, amt: 0, ax: -0.5, ay: 1.5 };
  const pts = nums.filter((n) => n > 0).map(cellOf);
  const ax = nums[0] === 0 ? 0 : pts.reduce((s, p) => s + p.c + 0.5, 0) / pts.length;
  const ay = pts.reduce((s, p) => s + p.r + 0.5, 0) / pts.length;
  return { key: nums.join('-'), nums, amt: 0, ax, ay };
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
export const OUTSIDE: Record<string, number[]> = {
  d1: range(1, 12), d2: range(13, 24), d3: range(25, 36),
  c1: range(1, 36).filter((n) => n % 3 === 0), c2: range(1, 36).filter((n) => n % 3 === 2), c3: range(1, 36).filter((n) => n % 3 === 1),
  low: range(1, 18), high: range(19, 36),
  even: range(1, 36).filter((n) => n % 2 === 0), odd: range(1, 36).filter((n) => n % 2 === 1),
  red: range(1, 36).filter((n) => color(n) === 'red'), black: range(1, 36).filter((n) => color(n) === 'black'),
};

// Announced bets: list of number groups, one chip each.
export const ANNOUNCED: Record<string, number[][]> = {
  voisins: [[0, 2, 3], [0, 2, 3], [4, 7], [12, 15], [18, 21], [19, 22], [32, 35], [25, 26, 28, 29], [25, 26, 28, 29]],
  tiers: [[5, 8], [10, 11], [13, 16], [23, 24], [27, 30], [33, 36]],
  orphelins: [[1], [6, 9], [14, 17], [17, 20], [31, 34]],
  zero: [[0, 3], [12, 15], [26], [32, 35]],
};
export const neighbours = (n: number, k = 2) => {
  const i = WHEEL.indexOf(n);
  return range(-k, k).map((d) => [WHEEL[(i + d + 37) % 37]]);
};

/** Total returned for a bet (stake included). n covered numbers pay 36/n. La Partage halves even-money bets on zero. */
export function payout(b: { nums: number[]; amt: number }, result: number, partage = false) {
  if (b.nums.includes(result)) return (b.amt * 36) / b.nums.length;
  if (partage && result === 0 && b.nums.length === 18) return b.amt / 2;
  return 0;
}

export const spin = () => Math.floor(Math.random() * 37);
