// Word game: guess a 5-letter word; each letter is marked hit (right place), near (in the word) or miss.
// Lists live in src/assets/words (see the README there) and load only when the game opens.
export type Lang = 'de' | 'en';
export type Mark = 'hit' | 'near' | 'miss';
export const LEN = 5;

/** Marks for one guess. Repeated letters count only as often as they occur in the answer. */
export function judge(guess: string, answer: string): Mark[] {
  const g = [...guess], a = [...answer];
  const out: Mark[] = g.map((c, i) => (c === a[i] ? 'hit' : 'miss'));
  const left: Record<string, number> = {};
  a.forEach((c, i) => { if (out[i] !== 'hit') left[c] = (left[c] ?? 0) + 1; });
  g.forEach((c, i) => { if (out[i] !== 'hit' && left[c]) { out[i] = 'near'; left[c]--; } });
  return out;
}

export type Lists = { sol: string[]; valid: Set<string> };
const split = (s: string) => Array.from({ length: s.length / LEN }, (_, i) => s.slice(i * LEN, i * LEN + LEN));
const cache: Partial<Record<Lang, Promise<Lists>>> = {};
export function lists(lang: Lang): Promise<Lists> {
  return (cache[lang] ??= (lang === 'de' ? import('../assets/words/de.json') : import('../assets/words/en.json')).then((m) => {
    const d = (m as { default: { sol: string; valid: string } }).default;
    const sol = split(d.sol);
    return { sol, valid: new Set([...split(d.valid), ...sol]) };
  }));
}

/** Days since 1 Jan 2026 (local calendar), the number of the daily word. */
export function dayNo(d = new Date()) {
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2026, 0, 1)) / 864e5) + 1;
}
/** The daily word: the same for everybody, walking through the shuffled solution list. */
export const dailyWord = (l: Lists, n = dayNo()) => l.sol[((n % l.sol.length) + l.sol.length) % l.sol.length];

/** Hard mode: every hint shown so far has to be used in the next guess. Returns the broken rule or ''. */
export function hardRule(guess: string, rows: { w: string; m: Mark[] }[]) {
  for (const { w, m } of rows) {
    for (let i = 0; i < LEN; i++) if (m[i] === 'hit' && guess[i] !== w[i]) return `${i + 1}:${w[i]}`;
    const need: Record<string, number> = {};
    for (let i = 0; i < LEN; i++) if (m[i] !== 'miss') need[w[i]] = (need[w[i]] ?? 0) + 1;
    for (const [c, k] of Object.entries(need)) if ([...guess].filter((x) => x === c).length < k) return c;
  }
  return '';
}

/** Arcade: several words at once; more words, more guesses. */
export const BOARDS = [1, 2, 4, 8] as const;
export const GUESSES: Record<number, number> = { 1: 6, 2: 7, 4: 9, 8: 13 };
/** Payout with a stake when every word is solved: a base per mode, ×1.35 for every guess left over. */
const BASE: Record<number, number> = { 1: 0.6, 2: 0.9, 4: 1.4, 8: 2.2 };
export const multFor = (boards: number, left: number) => Math.round(BASE[boards] * 1.35 ** left * 100) / 100;
/** Coins for solving the daily word, by the number of guesses (once per day and language). */
export const DAILY_COINS = [0, 250, 150, 100, 60, 40, 25];
