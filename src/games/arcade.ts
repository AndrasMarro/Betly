// Math for the arcade games. Every game returns 97 % of stakes on average (3 % house edge).
export const EDGE = 0.97;
const r2 = (x: number) => Math.floor(x * 100) / 100;

// ---------- Crash ----------
/** P(crash >= m) = 0.97 / m. About 3 % of rounds bust instantly at 1.00. */
export const crashPoint = (u = Math.random()) => Math.max(1, r2(EDGE / (1 - u)));
export const GROWTH = 0.075; // multiplier = e^(GROWTH * seconds)
export const multAt = (sec: number) => Math.exp(GROWTH * Math.max(0, sec));
export const secAt = (m: number) => Math.log(m) / GROWTH;

// ---------- Mines ----------
export const TILES = 25;
/** Payout multiplier after `picks` safe tiles with `mines` mines on the board. */
export function minesMult(mines: number, picks: number) {
  let m = EDGE;
  for (let i = 0; i < picks; i++) m *= (TILES - i) / (TILES - mines - i);
  return r2(m);
}
export function placeMines(mines: number) {
  const idx = Array.from({ length: TILES }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return new Set(idx.slice(0, mines));
}

// ---------- Dice (two dice) ----------
const ways = (s: number) => 6 - Math.abs(s - 7); // combinations for sum s
export const DICE_BETS: Record<string, (a: number, b: number) => boolean> = {
  under: (a, b) => a + b < 7,
  seven: (a, b) => a + b === 7,
  over: (a, b) => a + b > 7,
  double: (a, b) => a === b,
  ...Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`s${i + 2}`, (a: number, b: number) => a + b === i + 2])),
};
export function diceProb(bet: string) {
  if (bet === 'under' || bet === 'over') return 15 / 36;
  if (bet === 'seven' || bet === 'double') return 6 / 36;
  return ways(+bet.slice(1)) / 36;
}
export const diceMult = (bet: string) => r2(EDGE / diceProb(bet));
export const roll = () => 1 + Math.floor(Math.random() * 6);

// ---------- Hop Street (cross the road, cash out any time) ----------
export const LANES = 15;
export const LEVELS = { easy: 0.9, medium: 0.8, hard: 0.65, extreme: 0.5 } as const;
export type Level = keyof typeof LEVELS;
export const hopMult = (level: Level, lanes: number) => (lanes === 0 ? 1 : r2(EDGE / LEVELS[level] ** lanes));
export const survives = (level: Level) => Math.random() < LEVELS[level];

// ---------- Tower (climb floors, each floor hides bombs) ----------
export const FLOORS = 8;
export const TOWER = { easy: [4, 1], medium: [3, 1], hard: [2, 1], expert: [3, 2], master: [4, 3] } as const; // [tiles, bombs]
export type TowerLevel = keyof typeof TOWER;
export const towerSafe = (lv: TowerLevel) => (TOWER[lv][0] - TOWER[lv][1]) / TOWER[lv][0];
export const towerMult = (lv: TowerLevel, floors: number) => (floors === 0 ? 1 : r2(EDGE / towerSafe(lv) ** floors));
export function towerBombs(lv: TowerLevel) {
  const [tiles, bombs] = TOWER[lv];
  return Array.from({ length: FLOORS }, () => {
    const idx = Array.from({ length: tiles }, (_, i) => i).sort(() => Math.random() - 0.5);
    return new Set(idx.slice(0, bombs));
  });
}

// ---------- Coin flip (keep the streak going or cash out) ----------
export const coinMult = (wins: number) => (wins === 0 ? 1 : r2(EDGE * 2 ** wins));
export const flip = (): 'heads' | 'tails' => (Math.random() < 0.5 ? 'heads' : 'tails');

// ---------- Hi-Lo (rank 1 = Ace low ... 13 = King) ----------
export const pHigher = (r: number) => (14 - r) / 13; // higher or same
export const pLower = (r: number) => r / 13; // lower or same
/** Multiplier after a chain of correct guesses with the given probabilities (one edge for the whole chain). */
export const hiloMult = (probs: number[]) => (probs.length ? r2(EDGE / probs.reduce((a, p) => a * p, 1)) : 1);
export const drawRank = () => 1 + Math.floor(Math.random() * 13);

// ---------- Plinko ----------
export const PLINKO_ROWS = [8, 12, 16] as const;
// edge/center ratio; steep curve so most balls land below 1× and the edges carry the return
export const RISKS = { low: { 8: 30, 12: 60, 16: 90 }, medium: { 8: 90, 12: 300, 16: 1000 }, high: { 8: 380, 12: 2250, 16: 12500 } } as const;
export type Risk = keyof typeof RISKS;
const binom = (n: number, k: number) => { let c = 1; for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i; return c; };
export const plinkoProb = (rows: number, i: number) => binom(rows, i) / 2 ** rows;
const roundMult = (x: number) => (x >= 100 ? Math.round(x) : x >= 10 ? Math.round(x * 10) / 10 : Math.round(x * 100) / 100);
/** Bucket multipliers: exponential towards the edges, symmetric, scaled so the expected return is 97 %. */
export function plinkoTable(rows: number, risk: Risk) {
  const ratio = (RISKS[risk] as Record<number, number>)[rows];
  const shape = Array.from({ length: rows + 1 }, (_, i) => ratio ** ((Math.abs(i - rows / 2) / (rows / 2)) ** 2));
  const ev = shape.reduce((a, m, i) => a + m * plinkoProb(rows, i), 0);
  return shape.map((m) => roundMult((m * EDGE) / ev));
}
/** Left/right decisions for one ball; the bucket index is the number of rights. */
export const plinkoPath = (rows: number) => Array.from({ length: rows }, () => Math.random() < 0.5);

// ---------- Wheel of luck ----------
const rep = (x: number, n: number) => Array(n).fill(x);
export const WHEELS = {
  low: [1.3, ...rep(1.2, 7), 0, 0],
  medium: [1.5, 1.5, 1.5, 1.5, 2, 2, 2, 3, 4.4, ...rep(0, 11)],
  high: [29.1, ...rep(0, 29)],
};
export type WheelRisk = keyof typeof WHEELS;
/** Interleave segments so wins and zeros alternate around the wheel. */
export function wheelLayout(risk: WheelRisk) {
  const segs = [...WHEELS[risk]].sort((a, b) => b - a);
  const zeros = segs.filter((x) => x === 0), wins = segs.filter((x) => x > 0), out: number[] = [];
  while (wins.length || zeros.length) {
    if (wins.length) out.push(wins.shift()!);
    if (zeros.length) out.push(zeros.shift()!);
    if (wins.length > zeros.length && wins.length) out.push(wins.pop()!);
  }
  return out;
}

// ---------- Scratch card ----------
export const SCRATCH = [
  { sym: 'seven', mult: 50, p: 0.004 },
  { sym: 'bar', mult: 10, p: 0.015 },
  { sym: 'bell', mult: 5, p: 0.03 },
  { sym: 'plum', mult: 2, p: 0.1 },
  { sym: 'cherry', mult: 1, p: 0.27 },
];
const SYMS = ['seven', 'bar', 'bell', 'plum', 'cherry', 'lemon'];
/** Draw a prize, then build a 3x3 card showing exactly that prize three times (or no triple on a loss). */
export function scratchCard(u = Math.random()) {
  let acc = 0;
  const prize = SCRATCH.find((x) => (acc += x.p) > u) ?? null;
  const cells: string[] = prize ? [prize.sym, prize.sym, prize.sym] : [];
  const count = (s: string) => cells.filter((c) => c === s).length;
  while (cells.length < 9) {
    const s = SYMS[Math.floor(Math.random() * SYMS.length)];
    if (s !== prize?.sym && count(s) < 2) cells.push(s);
  }
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return { cells, prize };
}

// ---------- Cases (open a case, a reel spins and lands on one item) ----------
export const RARITIES = [
  { p: 0.7992, color: '#4b69ff' }, // common
  { p: 0.1598, color: '#8847ff' }, // uncommon
  { p: 0.032, color: '#d32ce6' }, // rare
  { p: 0.0064, color: '#eb4b4b' }, // epic
  { p: 0.0026, color: '#e4ae39' }, // legendary
];
const CASE_MULTS = [[0.2, 0.3, 0.4, 0.5], [1, 1.4, 1.8], [3.5, 5.1], [12, 22], [84.5]];
export type CaseItem = { rarity: number; mult: number; icon: string; name: string; img?: string };
export type CaseDef = { id: string; name: string; price: number; color: string; items: CaseItem[] };
const mk = (id: string, name: string, price: number, color: string, list: [string, string][]): CaseDef => {
  let k = 0;
  const items = CASE_MULTS.flatMap((ms, rarity) => ms.map((mult) => ({ rarity, mult, icon: list[k][0], name: list[k++][1] })));
  return { id, name, price, color, items };
};
export const CASES: CaseDef[] = [
  mk('starter', 'Starter Case', 10, '#4b69ff', [['cherry', 'Cherry Pop'], ['lemon', 'Sour Drop'], ['plum', 'Plum Wave'], ['horseshoe', 'Iron Luck'], ['bell', 'Bell Ringer'], ['coin', 'Gold Coin'], ['hat', 'Top Hat'], ['clover', 'Four Leaf'], ['bar', 'Bar Chart'], ['crown', 'Crown Jewel'], ['sun', 'Solar Flare'], ['seven', 'Lucky Seven']]),
  mk('neon', 'Neon Case', 50, '#d32ce6', [['comet', 'Comet Tail'], ['moon', 'Half Moon'], ['amethyst', 'Violet Shard'], ['planet', 'Ring World'], ['ufo', 'Visitor'], ['emerald', 'Green Prism'], ['sapphire', 'Deep Blue'], ['ruby', 'Red Heart'], ['star', 'Super Nova'], ['wild', 'Wildcard'], ['sun', 'Red Giant'], ['crown', 'Neon Crown']]),
  mk('royal', 'Royal Case', 250, '#e4ae39', [['coin', 'Old Coin'], ['bell', 'Brass Bell'], ['horseshoe', 'Silver Shoe'], ['hat', 'Gentleman'], ['pot', 'Pot of Gold'], ['sapphire', 'Royal Blue'], ['emerald', 'Emerald Ring'], ['ruby', 'Ruby Throne'], ['star', 'Golden Star'], ['seven', 'Seven Seas'], ['wild', 'Jester'], ['crown', 'The Crown']]),
];
export function pickItem(c: CaseDef, u = Math.random()) {
  let acc = 0;
  const rarity = Math.max(0, RARITIES.findIndex((r) => (acc += r.p) > u));
  const pool = c.items.filter((i) => i.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}
export const caseRtp = (c: CaseDef) =>
  RARITIES.reduce((a, r, i) => { const pool = c.items.filter((x) => x.rarity === i); return a + r.p * pool.reduce((s, x) => s + x.mult, 0) / pool.length; }, 0);

// Scratch card, "lucky pick" mode: open exactly 3 of 9 fields; three of a kind wins, a 4th field voids the ticket.
export const SCRATCH3 = [
  { sym: 'seven', mult: 100, p: 0.0023 },
  { sym: 'bar', mult: 20, p: 0.01 },
  { sym: 'bell', mult: 8, p: 0.02 },
  { sym: 'plum', mult: 3, p: 0.06 },
  { sym: 'cherry', mult: 1, p: 0.2 },
];
export function pick3Prize(u = Math.random()) {
  let acc = 0;
  return SCRATCH3.find((x) => (acc += x.p) > u) ?? null;
}
/** Symbols for the three opened fields: all the prize symbol, or (on a loss) never three alike. */
export function pick3Symbols(prize: { sym: string } | null) {
  if (prize) return [prize.sym, prize.sym, prize.sym];
  const a = SYMS[Math.floor(Math.random() * SYMS.length)], b = SYMS[Math.floor(Math.random() * SYMS.length)];
  let c = SYMS[Math.floor(Math.random() * SYMS.length)];
  while (a === b && c === a) c = SYMS[Math.floor(Math.random() * SYMS.length)];
  return [a, b, c];
}
export const randomSym = () => SYMS[Math.floor(Math.random() * SYMS.length)];

// Classic cases: official drop rates, item values like the real thing (the case is a losing bet on average).
// Items carry an `img` slug (artwork in src/assets/cases). The neon "prototype" set sits mostly in the top tiers.
export const GOLD_P = RARITIES[4].p;
const CLASSIC_TIERS: [number, string, string][][] = [
  [[0.06, 'field-kit', 'Field Kit'], [0.08, 'sand-dune', 'Sand Dune'], [0.1, 'night-ops', 'Night Ops'], [0.12, 'iron-rust', 'Iron Rust'], [0.14, 'blackout', 'Blackout'], [0.16, 'old-mint', 'Old Mint'], [0.18, 'gentleman', 'Gentleman']],
  [[0.4, 'brass-echo', 'Brass Echo'], [0.5, 'dune-scavenger', 'Dune Scavenger'], [0.6, 'rust-tech', 'Rust-Tech'], [0.7, 'jade-fang', 'Jade Fang'], [0.8, 'deep-tide', 'Deep Tide']],
  [[1.6, 'acid-bite', 'Acid Bite'], [2, 'glitch-trigger', 'Glitch Trigger'], [2.4, 'neo-vanguard', 'Neo Vanguard'], [2.8, 'night-phantom', 'Night Phantom'], [3.2, 'crimson-web', 'Crimson Web']],
  [[7, 'amber-volt', 'Amber Volt'], [8.5, 'cyber-sting', 'Cyber Sting'], [10, 'overdrive', 'Overdrive'], [11.5, 'solar-flare', 'Solar Flare'], [13, 'void-pulse', 'Void Pulse']],
  [[50, 'golden-edge', 'Golden Edge'], [70, 'quantum-edge', 'Quantum Edge']],
];
export const CLASSIC_CASE: CaseDef = {
  id: 'classic', name: 'Classic Case', price: 25, color: '#e4ae39',
  items: CLASSIC_TIERS.flatMap((tier, rarity) => tier.map(([mult, img, name]) => ({ rarity, mult, icon: img, img, name }))),
};
/** Chance of at least one gold item in n openings: 1 - (1 - p)^n. */
export const atLeastOneGold = (n: number) => 1 - (1 - GOLD_P) ** n;
