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

/** Suit shapes in a 100x100 box (♠ ♥ ♦ ♣), shared by every card face. */
export const SUIT = [
    'M50 4 C40 22 6 40 6 62 C6 76 18 84 30 84 C38 84 44 80 47 74 C46 84 42 92 34 96 H66 C58 92 54 84 53 74 C56 80 62 84 70 84 C82 84 94 76 94 62 C94 40 60 22 50 4Z',
    'M50 90 C20 66 4 50 4 31 C4 17 15 7 28 7 C38 7 46 13 50 21 C54 13 62 7 72 7 C85 7 96 17 96 31 C96 50 80 66 50 90Z',
    'M50 4 L86 50 L50 96 L14 50Z',
    'M50 8 A19 19 0 0 1 66 39 A19 19 0 1 1 57 66 C57 80 62 90 70 96 H30 C38 90 43 80 43 66 A19 19 0 1 1 34 39 A19 19 0 0 1 50 8Z',
];
