// Global persisted state: settings + play-money wallet (localStorage only, nothing leaves the browser).
const load = <T extends object>(key: string, def: T): T => {
  try {
    return { ...def, ...JSON.parse(localStorage.getItem(key) || '{}') };
  } catch {
    return def;
  }
};

export type Theme = 'noir' | 'midnight' | 'ivory';
export type Lang = 'de' | 'en';

export const settings = $state(
  load('betly:settings', {
    theme: 'noir' as Theme,
    lang: (navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en') as Lang,
    bots: true,
    sound: true,
    name: 'Player-' + Math.floor(1000 + Math.random() * 9000),
    accepted: false,
  }),
);

export const START = 10_000;
export const BONUS = 1_000;
export const BONUS_COOLDOWN = 15 * 60_000;
export const BROKE = 100; // below this the bonus is always claimable

export const wallet = $state(load('betly:wallet', { balance: START, lastBonus: 0, biggestWin: 0, rounds: 0 }));

$effect.root(() => {
  $effect(() => {
    localStorage.setItem('betly:settings', JSON.stringify(settings));
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.lang = settings.lang;
  });
  $effect(() => localStorage.setItem('betly:wallet', JSON.stringify(wallet)));
});

/** Apply the net result of a finished round (stake already included). */
export function settle(net: number, won = 0) {
  wallet.balance = Math.max(0, Math.round((wallet.balance + net) * 100) / 100);
  wallet.rounds++;
  if (won > wallet.biggestWin) wallet.biggestWin = won;
}

export const bonusReadyIn = (now: number) =>
  wallet.balance < BROKE ? 0 : Math.max(0, wallet.lastBonus + BONUS_COOLDOWN - now);

export function claimBonus() {
  if (bonusReadyIn(Date.now()) > 0) return false;
  wallet.balance += wallet.balance < BROKE ? Math.max(BONUS, START / 2) : BONUS;
  wallet.lastBonus = Date.now();
  return true;
}

export function resetWallet() {
  Object.assign(wallet, { balance: START, lastBonus: 0, biggestWin: 0, rounds: 0 });
}

export const fmt = (n: number) =>
  new Intl.NumberFormat(settings.lang === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 2 }).format(n);

export const ui = $state({ credits: false, settings: false });
