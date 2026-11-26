// The pot of the party games: everybody puts in their own stake, visible to all.
// It is shared out like side pots in poker: from every other player you can win at most what you put in
// yourself. Betting big is the only way to win big, and someone who bets small risks little.

export type Seat = { id: string; stake: number; rank: number }; // rank 1 = best; equal ranks share

/** What every player gets back at the end (their own stake included). The sum equals the sum of stakes. */
export function sidePots(seats: Seat[]): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(seats.map((s) => [s.id, 0]));
  const levels = [...new Set(seats.map((s) => s.stake).filter((x) => x > 0))].sort((a, b) => a - b);
  let prev = 0;
  for (const lv of levels) {
    // the slice between the last level and this one: everybody who staked at least this much pays into it
    const payers = seats.filter((s) => s.stake >= lv);
    const slice = (lv - prev) * payers.length;
    const best = Math.min(...payers.map((s) => s.rank));
    const winners = payers.filter((s) => s.rank === best);
    const each = Math.floor((slice / winners.length) * 100) / 100;
    winners.forEach((w, i) => { out[w.id] += i === 0 ? Math.round((slice - each * (winners.length - 1)) * 100) / 100 : each; });
    prev = lv;
  }
  for (const k in out) out[k] = Math.round(out[k] * 100) / 100;
  return out;
}

/** Ranks from scores (higher is better): equal scores share a rank. */
export function ranks(scores: { id: string; score: number }[]): Record<string, number> {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const r: Record<string, number> = {};
  sorted.forEach((s, i) => { r[s.id] = i > 0 && s.score === sorted[i - 1].score ? r[sorted[i - 1].id] : i + 1; });
  return r;
}
