// Balloon: pump to grow the multiplier, every pump may pop the balloon. Cash out in time.
// Each pump pops with a fixed chance p (by risk level). Surviving k pumps has probability (1-p)^k, and the
// payout is RTP / (1-p)^k, so every cash-out point is worth the same 97 % on average.

export type Risk = 'low' | 'mid' | 'high';
export const RISK: Record<Risk, { p: number; max: number }> = {
  low: { p: 0.04, max: 40 },  // up to ~5x
  mid: { p: 0.1, max: 30 },   // up to ~23x
  high: { p: 0.2, max: 20 },  // up to ~84x
};
export const RTP = 0.97;

/** Multiplier after k successful pumps (0 pumps = nothing to cash out). */
export const balloonMult = (risk: Risk, k: number) => (k <= 0 ? 0 : Math.floor((RTP / (1 - RISK[risk].p) ** k) * 100) / 100);

/** Does this pump pop the balloon? */
export const pops = (risk: Risk, rand = Math.random) => rand() < RISK[risk].p;
