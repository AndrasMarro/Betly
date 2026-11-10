// Math for the arcade games. Every game returns 97 % of stakes on average (3 % house edge).
export const EDGE = 0.97;
const r2 = (x: number) => Math.floor(x * 100) / 100;

// ---------- Crash ----------
/** P(crash >= m) = 0.97 / m. About 3 % of rounds bust instantly at 1.00. */
export const crashPoint = (u = Math.random()) => Math.max(1, r2(EDGE / (1 - u)));
/**
 * The crash decided as the flight goes on instead of up front (so it cannot be read from memory):
 * having survived to `prev`, the rocket survives to `m` with probability prev / m. Returns the crash
 * multiplier if it explodes in (prev, m], otherwise null. Same distribution as crashPoint().
 */
export function crashStep(prev: number, m: number, u = Math.random(), v = Math.random()) {
  if (u < 1 - prev / m) return Math.max(prev, r2(prev / (1 - v * (1 - prev / m))));
  return null;
}
/** At launch: the house edge is an instant bust at 1.00 with probability 1 - EDGE. */
export const bustAtStart = (u = Math.random()) => u < 1 - EDGE;
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
/**
 * Decide a tile only when it is clicked: with `mines` hidden among `hidden` unopened tiles the chance is
 * mines / hidden, exactly as if they had been placed beforehand, but there is nothing to read out early.
 */
export const lazyMine = (mines: number, hidden: number, u = Math.random()) => u < mines / hidden;
/** Fill in where the remaining mines were (for the reveal after the round), avoiding `known` tiles. */
export function placeRest(count: number, avoid: number[], tiles = TILES) {
  const free = Array.from({ length: tiles }, (_, i) => i).filter((i) => !avoid.includes(i));
  const out = new Set<number>();
  while (out.size < Math.min(count, free.length)) out.add(free[Math.floor(Math.random() * free.length)]);
  return out;
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
  mk('starter', 'Starter Case', 100, '#4b69ff', [['cherry', 'Cherry Pop'], ['lemon', 'Sour Drop'], ['plum', 'Plum Wave'], ['horseshoe', 'Iron Luck'], ['bell', 'Bell Ringer'], ['coin', 'Gold Coin'], ['hat', 'Top Hat'], ['clover', 'Four Leaf'], ['bar', 'Bar Chart'], ['crown', 'Crown Jewel'], ['sun', 'Solar Flare'], ['seven', 'Lucky Seven']]),
  mk('neon', 'Neon Case', 500, '#d32ce6', [['comet', 'Comet Tail'], ['moon', 'Half Moon'], ['amethyst', 'Violet Shard'], ['planet', 'Ring World'], ['ufo', 'Visitor'], ['emerald', 'Green Prism'], ['sapphire', 'Deep Blue'], ['ruby', 'Red Heart'], ['star', 'Super Nova'], ['wild', 'Wildcard'], ['sun', 'Red Giant'], ['crown', 'Neon Crown']]),
  mk('royal', 'Royal Case', 2500, '#e4ae39', [['coin', 'Old Coin'], ['bell', 'Brass Bell'], ['horseshoe', 'Silver Shoe'], ['hat', 'Gentleman'], ['pot', 'Pot of Gold'], ['sapphire', 'Royal Blue'], ['emerald', 'Emerald Ring'], ['ruby', 'Ruby Throne'], ['star', 'Golden Star'], ['seven', 'Seven Seas'], ['wild', 'Jester'], ['crown', 'The Crown']]),
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
type Tier = [number, string, string][];
const crate = (id: string, name: string, price: number, color: string, tiers: Tier[]): CaseDef => ({
  id, name, price, color, items: tiers.flatMap((tier, rarity) => tier.map(([mult, img, name]) => ({ rarity, mult, icon: img, img, name }))),
});
/** Three classic crates, all with the official drop rates; pricier crates have rarer art and higher top values. */
export const CLASSIC_CASES: CaseDef[] = [
  crate('field', 'Field Case', 100, '#8a9bb5', [
    [[0.08, 'steel-basic', 'Steel Basic'], [0.12, 'veteran', 'Veteran'], [0.16, 'midnight-op', 'Midnight Op'], [0.2, 'shadow-spray', 'Shadow Spray']],
    [[0.45, 'old-west', 'Old West'], [0.65, 'tide-breaker', 'Tide Breaker'], [0.85, 'desert-whisper', 'Desert Whisper']],
    [[1.8, 'jungle-edge', 'Jungle Edge'], [2.8, 'longshot', 'Longshot']],
    [[6, 'blood-moon', 'Blood Moon'], [10, 'tiger-claw', 'Tiger Claw']],
    [[45, 'silver-wing', 'Silver Wing']],
  ]),
  crate('arsenal', 'Arsenal Case', 250, '#e4ae39', [
    [[0.06, 'field-kit', 'Field Kit'], [0.1, 'sand-dune', 'Sand Dune'], [0.14, 'night-ops', 'Night Ops'], [0.18, 'iron-rust', 'Iron Rust']],
    [[0.4, 'blackout', 'Blackout'], [0.6, 'old-mint', 'Old Mint'], [0.8, 'gentleman', 'Gentleman']],
    [[1.8, 'brass-echo', 'Brass Echo'], [3, 'deep-tide', 'Deep Tide']],
    [[7, 'jade-fang', 'Jade Fang'], [13, 'crimson-web', 'Crimson Web']],
    [[60, 'golden-edge', 'Golden Edge']],
  ]),
  crate('prototype', 'Prototype Case', 750, '#d32ce6', [
    [[0.04, 'rust-tech', 'Rust-Tech'], [0.07, 'dune-scavenger', 'Dune Scavenger'], [0.1, 'glitch-trigger', 'Glitch Trigger'], [0.13, 'neo-vanguard', 'Neo Vanguard']],
    [[0.35, 'acid-bite', 'Acid Bite'], [0.55, 'night-phantom', 'Night Phantom'], [0.75, 'amber-volt', 'Amber Volt']],
    [[1.8, 'cyber-sting', 'Cyber Sting'], [3.4, 'overdrive', 'Overdrive']],
    [[8, 'solar-flare', 'Solar Flare'], [16, 'void-pulse', 'Void Pulse']],
    [[90, 'quantum-edge', 'Quantum Edge']],
  ]),
];
/** Chance of at least one gold item in n openings: 1 - (1 - p)^n. */
export const atLeastOneGold = (n: number) => 1 - (1 - GOLD_P) ** n;
