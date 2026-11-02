export type Card = { r: number; s: number }; // r: 1 (A) .. 13 (K), 0 = face down; s: 0♠ 1♥ 2♦ 3♣

export function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const newShoe = (decks: number) =>
  shuffle(Array.from({ length: decks * 52 }, (_, i) => ({ r: (i % 13) + 1, s: Math.floor(i / 13) % 4 })));

export const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS = ['♠', '♥', '♦', '♣'];
