import { settings } from './state.svelte';

export type Cat = 'classic' | 'arcade';
// group: the classics are shown as card games first, then table games, each alphabetical
export type Game = { id: string; name: string | [de: string, en: string]; cat: Cat; live?: boolean; group?: 'cards' | 'table' };

export const GAMES: Game[] = [
  { id: 'roulette', group: 'table', name: 'Roulette', cat: 'classic', live: true },
  { id: 'blackjack', group: 'cards', name: 'Blackjack', cat: 'classic', live: true },
  { id: 'slots', group: 'table', name: 'Slots', cat: 'classic', live: true },
  { id: 'holdem', group: 'cards', name: "Texas Hold'em", cat: 'classic', live: true },
  { id: 'baccarat', group: 'cards', name: 'Baccarat', cat: 'classic', live: true },
  { id: 'craps', name: 'Craps', cat: 'classic' },
  { id: 'caribbean', name: 'Caribbean Stud', cat: 'classic' },
  { id: 'paigow', name: 'Pai Gow', cat: 'classic' },
  { id: 'threecard', group: 'cards', name: 'Three Card Poker', cat: 'classic', live: true },
  { id: 'jass', group: 'cards', name: 'Jass', cat: 'classic', live: true },
  { id: 'derby', group: 'table', name: ['Pferderennen', 'Horse Racing'], cat: 'classic', live: true },
  { id: 'durak', group: 'cards', name: 'Durak', cat: 'classic', live: true },
  { id: 'lotto', group: 'table', name: 'Lotto', cat: 'classic', live: true },
  { id: 'sicbo', name: 'Sic Bo', cat: 'classic' },

  { id: 'rocket', name: 'Rocket', cat: 'arcade', live: true },
  { id: 'crossy', name: 'Retro Crossy Run', cat: 'arcade', live: true },
  { id: 'snake', name: 'Snake', cat: 'arcade', live: true },
  { id: 'cases', name: ['Kisten', 'Cases'], cat: 'arcade', live: true },
  { id: 'mines', name: ['Minen', 'Mines'], cat: 'arcade', live: true },
  { id: 'minesweeper', name: 'Minesweeper', cat: 'arcade', live: true },
  { id: 'dice', name: ['Würfel', 'Dice'], cat: 'arcade', live: true },
  { id: 'hop', name: 'Hop Street', cat: 'arcade', live: true },
  { id: 'plinko', live: true, name: 'Plinko', cat: 'arcade' },
  { id: 'wheel', live: true, name: ['Glücksrad', 'Wheel of Luck'], cat: 'arcade' },
  { id: 'hilo', live: true, name: 'Hi-Lo', cat: 'arcade' },
  { id: 'keno', live: true, name: 'Keno', cat: 'arcade' },
  { id: 'tower', live: true, name: ['Turm', 'Tower'], cat: 'arcade' },
  { id: 'coinflip', live: true, name: ['Münzwurf', 'Coin Flip'], cat: 'arcade' },
  { id: 'limbo', name: 'Limbo', cat: 'arcade' },
  { id: 'balloon', live: true, name: ['Ballon', 'Balloon'], cat: 'arcade' },
  { id: 'penalty', name: ['Elfmeter', 'Penalty'], cat: 'arcade' },
  { id: 'scratch', live: true, name: ['Rubbellos', 'Scratch Card'], cat: 'arcade' },
];

export const gameName = (g: Game) => (typeof g.name === 'string' ? g.name : g.name[settings.lang === 'de' ? 0 : 1]);
export const byId = (id: string) => GAMES.find((g) => g.id === id);
export const href = (g: Game) => (g.live ? `#/${g.id}` : `#/soon/${g.id}`);
/** Search: matches the German and the English name and the id. */
export const matches = (g: Game, q: string) => {
  q = q.trim().toLowerCase();
  return !q || [g.id, ...(typeof g.name === 'string' ? [g.name] : g.name)].some((n) => n.toLowerCase().includes(q));
};
