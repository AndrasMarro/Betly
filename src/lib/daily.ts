// Daily features: one arcade and one classic game per day pay a bonus, and seeded randomness for daily challenges.
export const DAILY_BONUS = 0.2; // +20 % on every payout in the game of the day
const POOL = ['rocket', 'cases', 'mines', 'minesweeper', 'dice', 'hop', 'plinko', 'wheel', 'hilo', 'tower', 'coinflip', 'scratch', 'snake', 'crossy', 'balloon', 'keno', 'cups'];

/** Local calendar day as a number, e.g. 20261109. */
export const today = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

/** Small deterministic PRNG (mulberry32) so everybody gets the same daily setup. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const dailyGame = (day = today()) => POOL[Math.floor(rng(day * 7 + 3)() * POOL.length)];
// and one classic game per day, with the same bonus
const CLASSICS = ['roulette', 'blackjack', 'slots', 'holdem', 'baccarat', 'threecard', 'jass', 'derby', 'durak'];
export const dailyClassic = (day = today()) => CLASSICS[Math.floor(rng(day * 13 + 5)() * CLASSICS.length)];
export const isDaily = (id: string) => id === dailyGame() || id === dailyClassic();
// and one slot machine (ids from games/slots.ts)
const SLOTS = ['classic', 'gems', 'cosmic', 'clover', 'cards', 'crossy', 'snake', 'arm-field', 'arm-arsenal', 'arm-proto'];
export const dailySlot = (day = today()) => SLOTS[Math.floor(rng(day * 17 + 11)() * SLOTS.length)];
