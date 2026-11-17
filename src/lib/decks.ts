// Card decks for the 36-card games (Jass, Durak). The choice is one global setting; every game offers the decks it
// supports in its own dropdown, which changes the same setting. A deck only shows up once its pictures exist in
// src/assets/jass/<deck>/ (the Russian one is added by cutting the Atlas deck, see the README there).
import type { Deck } from '../games/jass';

const FILES = Object.keys(import.meta.glob('../assets/jass/*/*.webp'));
export const hasDeck = (d: Deck) => FILES.some((f) => f.includes(`/jass/${d}/`));

export const DECKS: { id: Deck; de: string; en: string; ru: string }[] = [
  { id: 'de', de: 'Deutschschweizer Blatt', en: 'Swiss German', ru: 'Швейцарская (немецкая)' },
  { id: 'fr', de: 'Französisches Blatt', en: 'Swiss French', ru: 'Швейцарская (французская)' },
  { id: 'intl', de: 'International', en: 'International', ru: 'Международная' },
  { id: 'ru', de: 'Russisch (Atlas)', en: 'Russian (Atlas)', ru: 'Атласная (русская)' },
];

/** The decks a game can use, in the order shown, limited to the ones whose pictures are there. */
export const decksFor = (supported: Deck[]) => DECKS.filter((d) => supported.includes(d.id) && hasDeck(d.id));
/** The global choice if this game supports it, otherwise the game's first deck. */
export const pickDeck = (chosen: Deck, supported: Deck[]) => (decksFor(supported).some((d) => d.id === chosen) ? chosen : decksFor(supported)[0]?.id ?? supported[0]);
