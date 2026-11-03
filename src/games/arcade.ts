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
