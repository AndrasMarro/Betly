import { settings } from './state.svelte';

export type Cat = 'classic' | 'arcade';
// group: the classics are shown as card games first, then table games, each alphabetical
// party: can be played together (rooms or shared tables); tags: extra search words, German and English
export type Game = { id: string; name: string | [de: string, en: string]; cat: Cat; live?: boolean; group?: 'cards' | 'table'; party?: boolean; tags?: string };

export const GAMES: Game[] = [
  { id: 'roulette', group: 'table', name: 'Roulette', cat: 'classic', live: true, party: true, tags: 'kessel kugel wheel tisch table' },
  { id: 'blackjack', group: 'cards', name: 'Blackjack', cat: 'classic', live: true, party: true, tags: '21 karten cards' },
  { id: 'slots', group: 'table', name: 'Slots', cat: 'classic', live: true, tags: 'automat spielautomat machine fruits früchte' },
  { id: 'holdem', group: 'cards', name: "Texas Hold'em", cat: 'classic', live: true, party: true, tags: 'poker karten cards' },
  { id: 'baccarat', group: 'cards', name: 'Baccarat', cat: 'classic', live: true, tags: 'karten cards punto banco' },
  { id: 'craps', name: 'Craps', cat: 'classic' },
  { id: 'caribbean', name: 'Caribbean Stud', cat: 'classic' },
  { id: 'paigow', name: 'Pai Gow', cat: 'classic' },
  { id: 'threecard', group: 'cards', name: 'Three Card Poker', cat: 'classic', live: true, party: true, tags: 'poker karten cards' },
  { id: 'jass', group: 'cards', name: 'Jass', cat: 'classic', live: true, party: true, tags: 'karten cards schweiz swiss schieber' },
  { id: 'derby', group: 'table', name: ['Pferderennen', 'Horse Racing'], cat: 'classic', live: true, party: true, tags: 'pferde rennen horses race wetten bet' },
  { id: 'durak', group: 'cards', name: 'Durak', cat: 'classic', live: true, party: true, tags: 'karten cards russisch russian' },
  { id: 'lotto', group: 'table', name: 'Lotto', cat: 'classic', live: true, party: true, tags: 'ziehung draw zahlen numbers tageslotto daily' },
  { id: 'sicbo', name: 'Sic Bo', cat: 'classic' },

  { id: 'rocket', name: 'Rocket', cat: 'arcade', live: true, party: true, tags: 'crash rakete multiplier' },
  { id: 'crossy', name: 'Retro Crossy Run', cat: 'arcade', live: true, tags: 'hüpfen hop huhn chicken strasse road' },
  { id: 'snake', name: 'Snake', cat: 'arcade', live: true, tags: 'schlange äpfel apples' },
  { id: 'cases', name: ['Kisten', 'Cases'], cat: 'arcade', live: true, tags: 'kisten case opening skins' },
  { id: 'mines', name: ['Minen', 'Mines'], cat: 'arcade', live: true, tags: 'minen bomben bombs gems' },
  { id: 'minesweeper', name: 'Minesweeper', cat: 'arcade', live: true, party: true, tags: 'minen bomben bombs logik logic' },
  { id: 'dice', name: ['Würfel', 'Dice'], cat: 'arcade', live: true, tags: 'würfel wuerfel w6 w8 w10' },
  { id: 'hop', name: 'Hop Street', cat: 'arcade', live: true, tags: 'huhn chicken strasse road' },
  { id: 'plinko', live: true, name: 'Plinko', cat: 'arcade', tags: 'kugel ball pins' },
  { id: 'wheel', live: true, name: ['Glücksrad', 'Wheel of Luck'], cat: 'arcade', tags: 'rad glücksrad fortune' },
  { id: 'hilo', live: true, name: 'Hi-Lo', cat: 'arcade', tags: 'karten cards höher tiefer higher lower' },
  { id: 'keno', live: true, name: 'Keno', cat: 'arcade', tags: 'zahlen numbers ziehung draw' },
  { id: 'tower', live: true, name: ['Turm', 'Tower'], cat: 'arcade', tags: 'turm leiter climb' },
  { id: 'coinflip', live: true, name: ['Münzwurf', 'Coin Flip'], cat: 'arcade', tags: 'münze kopf zahl heads tails' },
  { id: 'limbo', name: 'Limbo', cat: 'arcade' },
  { id: 'balloon', live: true, name: ['Ballon', 'Balloon'], cat: 'arcade', tags: 'ballon pump platzen pop' },
  { id: 'penalty', name: ['Elfmeter', 'Penalty'], cat: 'arcade' },
  { id: 'scratch', live: true, name: ['Rubbellos', 'Scratch Card'], cat: 'arcade', tags: 'rubbellos los lottery ticket' },
  { id: 'cups', live: true, name: ['Hütchenspiel', 'Shell Game'], cat: 'arcade', tags: 'becher hütchen kugel ball shell' },
  { id: 'g2048', live: true, name: '2048', cat: 'arcade', tags: 'zahlen puzzle kacheln tiles' },
  { id: 'words', live: true, name: ['Wortjagd', 'Word Hunt'], cat: 'arcade', tags: 'wort word rätsel puzzle buchstaben letters täglich daily raten guess' },
  { id: 'memory', live: true, name: 'Memory', cat: 'arcade', party: true, tags: 'paare pairs karten cards gedächtnis concentration' },
  { id: 'ships', live: true, name: ['Schiffe versenken', 'Battleships'], cat: 'arcade', party: true, tags: 'schiffe battleship seeschlacht flotte fleet 2v2 team' },
  { id: 'tetris', live: true, name: 'Tetris', cat: 'arcade', party: true, tags: 'blöcke blocks steine puzzle versus' },
];

export const gameName = (g: Game) => (typeof g.name === 'string' ? g.name : g.name[settings.lang === 'de' ? 0 : 1]);
export const byId = (id: string) => GAMES.find((g) => g.id === id);
export const href = (g: Game) => (g.live ? `#/${g.id}` : `#/soon/${g.id}`);
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** Search: every word of the query must appear in the German or English name, the id, the tags or the description. */
export const matches = (g: Game, q: string, text = '') => {
  const words = fold(q).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fold([g.id, ...(typeof g.name === 'string' ? [g.name] : g.name), g.tags ?? '', g.party ? 'party multiplayer mehrspieler online freunde friends' : '', text].join(' '));
  return words.every((w) => hay.includes(w));
};
/** Best matches first: a name that starts with the query beats a hit in the description. */
export const score = (g: Game, q: string) => {
  const f = fold(q.trim()), names = (typeof g.name === 'string' ? [g.name] : g.name).map(fold);
  return names.some((n) => n.startsWith(f)) ? 0 : names.some((n) => n.includes(f)) ? 1 : 2;
};
