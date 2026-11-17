// Card decks for the 36-card games (Jass, Durak). The choice is one global setting; every game offers the decks it
// supports in its own dropdown, which changes the same setting. A deck only shows up once its pictures exist in
// src/assets/jass/<deck>/ (the Russian one is added by cutting the Atlas deck, see the README there).
import type { Deck } from '../games/jass';
/** classic: the drawn standard deck of the 52-card games (Blackjack, Poker …). Only full 52-card picture decks can replace it. */
export type Choice = Deck | 'classic';

const FILES = Object.keys(import.meta.glob('../assets/jass/*/*.webp'));
export const hasDeck = (d: Choice) => d === 'classic' || FILES.some((f) => f.includes(`/jass/${d}/`));

export const DECKS: { id: Choice; de: string; en: string; ru: string }[] = [
  { id: 'classic', de: 'Standard', en: 'Standard', ru: 'Стандартная' },
  { id: 'de', de: 'Deutschschweizer Blatt', en: 'Swiss German', ru: 'Швейцарская (немецкая)' },
  { id: 'fr', de: 'Französisches Blatt', en: 'Swiss French', ru: 'Швейцарская (французская)' },
  { id: 'intl', de: 'International', en: 'International', ru: 'Международная' },
  { id: 'ru', de: 'Russisch (Atlas)', en: 'Russian (Atlas)', ru: 'Атласная (русская)' },
];

/** The decks a game can use, in the order shown, limited to the ones whose pictures are there. */
export const decksFor = (supported: Choice[]) => DECKS.filter((d) => supported.includes(d.id) && hasDeck(d.id));
/** The global choice if this game supports it, otherwise the game's first deck. */
export function pickDeck<T extends Choice>(chosen: Choice, supported: T[]): T {
  return (decksFor(supported).some((d) => d.id === chosen) ? chosen : decksFor(supported)[0]?.id ?? supported[0]) as T;
}
/** The decks the 52-card games can use. */
export const FULL: Choice[] = ['classic', 'ru'];
