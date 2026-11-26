// Memory: turn two cards, keep pairs. Faces are numbers into a theme's list of pictures (see Memory.svelte).
export type Theme = 'symbols' | 'cards' | 'jass' | 'arcade';
export const SIZES = [
  { n: 12, cols: 4 }, { n: 16, cols: 4 }, { n: 24, cols: 6 }, { n: 36, cols: 6 },
] as const;
export type Diff = 'easy' | 'normal' | 'hard';

export const SYMBOLS = ['cherry', 'lemon', 'plum', 'bell', 'bar', 'seven', 'amethyst', 'emerald', 'sapphire', 'ruby', 'crown', 'star', 'clover', 'coin', 'horseshoe', 'hat', 'pot', 'comet', 'moon', 'planet', 'sun', 'ufo', 'wild'];
export const SPRITES = ['rocket', 'gem', 'bomb', 'chicken', 'car', 'die'];
export const SLOT_ART = ['cr-tree', 'cr-car', 'cr-taxi', 'cr-police', 'cr-fire', 'cr-duck', 'cr-coin', 'sn-wall', 'sn-poison', 'sn-red', 'sn-gold', 'sn-cosmic', 'sn-head'];
/** How many different pictures a theme has. */
export const FACES: Record<Theme, number> = { symbols: SYMBOLS.length, cards: 52, jass: 36, arcade: SPRITES.length + SLOT_ART.length };

/** Shuffle 2 × pairs cards with different faces drawn from the theme. */
export function deal(pairs: number, theme: Theme, rnd = Math.random) {
  const pool = Array.from({ length: FACES[theme] }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const faces = pool.slice(0, pairs).flatMap((f) => [f, f]);
  for (let i = faces.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [faces[i], faces[j]] = [faces[j], faces[i]]; }
  return faces;
}

/**
 * Solo with a stake: the fewer turns per pair, the better. Turns per pair of 1 is luck, about 1.5 is a
 * very good memory, 2 and more is average. Bigger boards and harder settings pay more.
 */
export function soloMult(turns: number, pairs: number, size: number, diff: Diff) {
  const r = turns / pairs;
  const base = r <= 1.3 ? 2.5 : r <= 1.6 ? 1.6 : r <= 1.9 ? 1.2 : r <= 2.2 ? 0.8 : r <= 2.6 ? 0.4 : 0;
  const big = ({ 12: 0.8, 16: 1, 24: 1.15, 36: 1.3 } as Record<number, number>)[size] ?? 1;
  const d = { easy: 0.7, normal: 1, hard: 1.25 }[diff];
  return Math.round(base * big * d * 100) / 100;
}

/** A bot's memory: it sees every turned card but forgets some of them. */
export class Brain {
  seen = new Map<number, number>(); // position -> face
  forget: number;
  rnd: () => number;
  constructor(forget: number, rnd = Math.random) { this.forget = forget; this.rnd = rnd; }
  /** Remember a card shown at a position (unless it slips the mind). */
  see(pos: number, face: number) { if (this.rnd() >= this.forget) this.seen.set(pos, face); }
  drop(pos: number) { this.seen.delete(pos); }
  /** Two cards changed places (hard mode): following them is hard, so the bot may lose track. */
  blur(a: number, b: number) { for (const p of [a, b]) if (this.rnd() < Math.min(1, this.forget * 2 + 0.2)) this.seen.delete(p); }
  /** First card: a known pair if there is one, else an unknown card. */
  first(open: number[]): number {
    const known = [...this.seen].filter(([p]) => open.includes(p));
    for (const [p, f] of known) if (known.some(([q, g]) => q !== p && g === f)) return p;
    const unknown = open.filter((p) => !this.seen.has(p));
    const pool = unknown.length ? unknown : open;
    return pool[Math.floor(this.rnd() * pool.length)];
  }
  /** Second card, knowing the first one's face. */
  second(open: number[], first: number, face: number): number {
    const match = [...this.seen].find(([p, f]) => p !== first && f === face && open.includes(p));
    if (match) return match[0];
    const unknown = open.filter((p) => p !== first && !this.seen.has(p));
    const pool = unknown.length ? unknown : open.filter((p) => p !== first);
    return pool[Math.floor(this.rnd() * pool.length)];
  }
}
export const FORGET: Record<Diff, number> = { easy: 0.55, normal: 0.3, hard: 0.08 };
