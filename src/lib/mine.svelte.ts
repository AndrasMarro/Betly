// Your games: favourites, the last ones played and how often each was opened. Kept in this browser only.
import { byId } from './games';

type Mine = { fav: string[]; recent: string[]; plays: Record<string, number>; fold: Record<string, boolean> };
const KEY = 'betly:mine';
function load(): Mine {
  try { const m = JSON.parse(localStorage.getItem(KEY) || '{}'); return { fav: m.fav ?? [], recent: m.recent ?? [], plays: m.plays ?? {}, fold: m.fold ?? {} }; }
  catch { return { fav: [], recent: [], plays: {}, fold: {} }; }
}
export const mine = $state<Mine>(load());
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(mine)); } catch {} };

export function toggleFav(id: string) {
  mine.fav = mine.fav.includes(id) ? mine.fav.filter((x) => x !== id) : [id, ...mine.fav];
  save();
}
/** Called on every route change: counts a visit when the route is a live game. */
export function visit(id: string) {
  if (!byId(id)?.live) return;
  mine.recent = [id, ...mine.recent.filter((x) => x !== id)].slice(0, 12);
  mine.plays[id] = (mine.plays[id] ?? 0) + 1;
  save();
}
export const most = () => Object.entries(mine.plays).sort((a, b) => b[1] - a[1]).map(([id]) => id).filter((id) => byId(id)?.live).slice(0, 12);
/** Home sections that can be folded away (remembered). */
export function toggleFold(k: string) { mine.fold[k] = !mine.fold[k]; save(); }
