// Global persisted state: settings + play-money wallet (localStorage only, nothing leaves the browser).
import { dailyGame, DAILY_BONUS } from './daily';
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
    music: true,
    sfxVol: 0.7,
    musicVol: 0.5,
    name: 'Player-' + Math.floor(1000 + Math.random() * 9000),
    accepted: false,
  }),
);

export const START = 10_000;
export const BONUS = 1_000;
export const BONUS_COOLDOWN = 15 * 60_000;
export const BROKE = 100; // below this the bonus is always claimable

// ---------- wallet integrity ----------
// The wallet lives in localStorage, so it is sealed with a checksum over its values and a per-browser salt.
// Editing the stored balance by hand breaks the seal and the wallet starts over. (Without a server this
// cannot be perfect, but casual edits and console tricks no longer work.)
const SALT_KEY = 'betly:id';
const salt = (() => {
  try {
    let v = localStorage.getItem(SALT_KEY);
    if (!v) { v = Array.from(crypto.getRandomValues(new Uint32Array(4)), (x) => x.toString(36)).join(''); localStorage.setItem(SALT_KEY, v); }
    return v;
  } catch { return 'betly'; }
})();
function seal(w: { balance: number; lastBonus: number; biggestWin: number; rounds: number }) {
  // cyrb53-style hash: small, fast, good enough as a tamper seal
  const str = `${w.balance}|${w.lastBonus}|${w.biggestWin}|${w.rounds}|${salt}|b3tly`;
  let h1 = 0xdeadbeef ^ 7, h2 = 0x41c6ce57 ^ 7;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
const FRESH = { balance: START, lastBonus: 0, biggestWin: 0, rounds: 0 };
export let tampered = false;
function loadWallet() {
  try {
    const raw = localStorage.getItem('betly:wallet');
    if (!raw) return { ...FRESH };
    const w = JSON.parse(raw);
    const ok = [w.balance, w.lastBonus, w.biggestWin, w.rounds].every((x) => typeof x === 'number' && Number.isFinite(x) && x >= 0);
    // wallets from before the seal existed are accepted once (then marked) and sealed from now on
    const legacy = w.sig === undefined && !localStorage.getItem('betly:sealed');
    if (ok && (legacy || w.sig === seal(w))) return { balance: w.balance, lastBonus: w.lastBonus, biggestWin: w.biggestWin, rounds: w.rounds };
    tampered = true;
  } catch { tampered = true; }
  return { ...FRESH };
}
export const wallet = $state(loadWallet());

$effect.root(() => {
  $effect(() => {
    localStorage.setItem('betly:settings', JSON.stringify(settings));
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.lang = settings.lang;
  });
  $effect(() => {
    const w = { balance: wallet.balance, lastBonus: wallet.lastBonus, biggestWin: wallet.biggestWin, rounds: wallet.rounds };
    localStorage.setItem('betly:wallet', JSON.stringify({ ...w, sig: seal(w) }));
    localStorage.setItem('betly:sealed', '1');
  });
});

/** Apply the net result of a finished round (stake already included). The game of the day adds a bonus on payouts. */
export function settle(net: number, won = 0) {
  if (!Number.isFinite(net) || !Number.isFinite(won) || won < 0) throw new Error('invalid result');
  if (won > 0 && location.hash.slice(2).split(/[/?]/)[0] === dailyGame()) {
    const extra = Math.round(won * DAILY_BONUS * 100) / 100;
    net += extra;
    won += extra;
    ui.bonus = { amt: extra, id: Date.now() };
  }
  wallet.balance = Math.max(0, Math.round((wallet.balance + net) * 100) / 100);
  wallet.rounds++;
  if (won > wallet.biggestWin) wallet.biggestWin = won;
}

/** Take a stake off the balance up front (arcade games pay back via settle(win, win)). */
export function stake(amt: number) {
  // a stake must be a real, positive amount you can afford; anything else stops the round
  if (!Number.isFinite(amt) || amt <= 0 || amt > wallet.balance + 1e-9) throw new Error('invalid stake');
  wallet.balance = Math.round((wallet.balance - amt) * 100) / 100;
}

/** Return chips to the balance (e.g. cashing out a poker stack). */
export function credit(amt: number) {
  if (!Number.isFinite(amt) || amt < 0) throw new Error('invalid credit');
  wallet.balance = Math.round((wallet.balance + amt) * 100) / 100;
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
  new Intl.NumberFormat(settings.lang === 'de' ? 'de-CH' : 'en-US', { maximumFractionDigits: 2 }).format(n);

export const ui = $state({ credits: false, settings: false, nameAsk: null as null | ((ok: boolean) => void), welcome: false, bonus: null as null | { amt: number; id: number } });

let pending: Promise<boolean> | null = null;
/** Show the name dialog. welcome = first screen of a session (cannot be cancelled). Concurrent calls share one dialog. */
export function askName(welcome = false) {
  if (welcome) ui.welcome = true;
  return (pending ??= new Promise<boolean>((resolve) => {
    ui.nameAsk = (ok) => {
      pending = null;
      ui.nameAsk = null;
      ui.welcome = false;
      resolve(ok);
    };
  }));
}
