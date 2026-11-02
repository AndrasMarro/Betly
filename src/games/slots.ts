// Slot machine engine: reel strips, paylines, evaluation. Machines are data, so new ones are just new entries.
export type Machine = {
  id: string;
  name: string;
  rows: number;
  weights: Record<string, number>[]; // per reel
  lines: number[][]; // row index per reel
  pays: Record<string, Record<number, number>>; // symbol -> count -> x line bet
  wild?: string;
  scatter?: { sym: string; pays: Record<number, number>; free: number; mult: number }; // pays x total bet
  bets: number[]; // line bet options
};

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic reel strips from weights (seeded shuffle, so the RTP test sees the same strips as the game). */
export function strips(m: Machine): string[][] {
  const r = rng(m.id.length * 7919);
  return m.weights.map((w) => {
    const s = Object.entries(w).flatMap(([sym, n]) => Array(n).fill(sym));
    for (let i = s.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [s[i], s[j]] = [s[j], s[i]];
    }
    return s;
  });
}

export function spinGrid(m: Machine, reels: string[][], rand = Math.random): string[][] {
  return reels.map((s) => {
    const stop = Math.floor(rand() * s.length);
    return Array.from({ length: m.rows }, (_, row) => s[(stop + row) % s.length]);
  });
}

export type Win = { line: number; sym: string; count: number; amount: number };

export function evaluate(m: Machine, grid: string[][], lineBet: number) {
  const wins: Win[] = [];
  m.lines.forEach((ln, line) => {
    const syms = ln.map((row, reel) => grid[reel][row]);
    const target = syms.find((s) => s !== m.wild) ?? m.wild!;
    if (target === m.scatter?.sym) return;
    let count = 0;
    while (count < syms.length && (syms[count] === target || syms[count] === m.wild)) count++;
    const mult = m.pays[target]?.[count] ?? 0;
    if (mult) wins.push({ line, sym: target, count, amount: mult * lineBet });
  });
  const scat = m.scatter ? grid.flat().filter((s) => s === m.scatter!.sym).length : 0;
  const scatterPay = m.scatter ? (m.scatter.pays[scat] ?? 0) * lineBet * m.lines.length : 0;
  const free = m.scatter && scat >= 3 ? m.scatter.free : 0;
  return { wins, scat, scatterPay, free, total: wins.reduce((a, w) => a + w.amount, 0) + scatterPay };
}

const same = (w: Record<string, number>, n: number) => Array.from({ length: n }, () => w);

export const MACHINES: Machine[] = [
  {
    id: 'classic',
    name: 'Lucky Sevens',
    rows: 3,
    weights: same({ cherry: 7, lemon: 7, plum: 6, bell: 5, bar: 3, seven: 2 }, 3),
    lines: [[1, 1, 1], [0, 0, 0], [2, 2, 2], [0, 1, 2], [2, 1, 0]],
    pays: { seven: { 3: 200 }, bar: { 3: 100 }, bell: { 3: 40 }, plum: { 3: 22 }, lemon: { 3: 15 }, cherry: { 2: 2, 3: 13 } },
    bets: [1, 2, 5, 10, 20, 50, 100],
  },
  {
    id: 'gems',
    name: 'Midnight Gems',
    rows: 3,
    weights: [
      { amethyst: 10, emerald: 9, sapphire: 8, ruby: 6, crown: 4, wild: 1, star: 1 },
      { amethyst: 10, emerald: 9, sapphire: 8, ruby: 6, crown: 4, wild: 2, star: 1 },
      { amethyst: 10, emerald: 9, sapphire: 8, ruby: 6, crown: 4, wild: 2, star: 1 },
      { amethyst: 10, emerald: 9, sapphire: 8, ruby: 6, crown: 4, wild: 2, star: 1 },
      { amethyst: 10, emerald: 9, sapphire: 8, ruby: 6, crown: 4, wild: 1, star: 1 },
    ],
    lines: [[1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [1, 0, 1, 2, 1]],
    pays: {
      amethyst: { 3: 4, 4: 12, 5: 40 }, emerald: { 3: 5, 4: 15, 5: 60 }, sapphire: { 3: 8, 4: 25, 5: 80 },
      ruby: { 3: 12, 4: 40, 5: 120 }, crown: { 3: 20, 4: 80, 5: 400 }, wild: { 3: 40, 4: 200, 5: 800 },
    },
    wild: 'wild',
    scatter: { sym: 'star', pays: { 3: 2, 4: 10, 5: 50 }, free: 8, mult: 2 },
    bets: [1, 2, 5, 10, 20, 50],
  },
];
