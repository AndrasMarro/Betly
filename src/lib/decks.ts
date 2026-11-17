// Card decks. Two settings: settings.cards for the 36-card games (Jass, Durak) and settings.cards52 for the
// 52-card games (Blackjack, Hold'em, Baccarat, Three Card, Hi-Lo), which start on the drawn standard deck; the
// French-suited picture decks can replace it there. A picture deck shows up once its files
// are in src/assets/jass/<deck>/ (see the README there); 'classic' are the drawn cards and always there.
import type { Deck } from '../games/jass';
export type Choice = Deck;

const FILES = Object.keys(import.meta.glob('../assets/jass/*/*.webp'));
export const hasDeck = (d: Deck) => d === 'classic' || FILES.some((f) => f.includes(`/jass/${d}/`));

export const DECKS: { id: Deck; de: string; en: string; ru: string }[] = [
  { id: 'classic', de: 'Standard', en: 'Standard', ru: 'Стандартная' },
  { id: 'de', de: 'Deutschschweizer Blatt', en: 'Swiss German', ru: 'Швейцарская (немецкая)' },
  { id: 'fr', de: 'Französisches Blatt', en: 'Swiss French', ru: 'Швейцарская (французская)' },
  { id: 'intl', de: 'International', en: 'International', ru: 'Международная' },
  { id: 'ru', de: 'Russisch (Atlas)', en: 'Russian (Atlas)', ru: 'Атласная (русская)' },
];

/** The decks a game can use, in the order shown, limited to the ones whose pictures are there. */
export const decksFor = (supported: Deck[]) => DECKS.filter((d) => supported.includes(d.id) && hasDeck(d.id));
/** The chosen deck if this game supports it, otherwise the game's first deck. */
export function pickDeck<T extends Deck>(chosen: Deck, supported: T[]): T {
  return (decksFor(supported).some((d) => d.id === chosen) ? chosen : decksFor(supported)[0]?.id ?? supported[0]) as T;
}
export const JASS: Deck[] = ['classic', 'de', 'fr', 'intl', 'ru'];
export const DURAK: Deck[] = ['classic', 'fr', 'intl', 'ru'];
/** The decks the 52-card games can use. */
export const FULL: Deck[] = ['classic', 'fr', 'intl', 'ru'];
