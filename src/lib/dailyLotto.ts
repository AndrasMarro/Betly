// Daily lotto: one free ticket per day and device, drawn at 20:00 Zurich time by the server
// (supabase/migrations/002_daily_lotto.sql). Prizes are paid locally when the ticket's draw is seen.
import { sb } from './account.svelte';

export type DailyTicket = { nums: number[]; lucky: number };
export type DailyDraw = { day: string; nums: number[]; lucky: number };
export type DailyResult = { id: number; day: string; name: string; nums: number[]; lucky: number; hits: number; star: boolean };

const ZURICH = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Zurich', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
/** Zurich wall-clock time of the instant t, as if it were UTC. */
function wall(t: number) {
  const p = Object.fromEntries(ZURICH.formatToParts(t).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
}
const H4 = 4 * 3600e3;
/** The day tickets go into right now: after 20:00 it is already tomorrow (same rule as lotto_day() in SQL). */
export const openDay = (t = Date.now()) => new Date(wall(t) + H4).toISOString().slice(0, 10);
/** The instant day's draw happens: 20:00 Zurich on that day. */
export function drawAt(day: string) {
  const w = Date.parse(day + 'T20:00:00Z');
  return w - (wall(w) - w);
}
export const prevDay = (day: string, n = 1) => new Date(Date.parse(day) - n * 864e5).toISOString().slice(0, 10);

// this device's id for the daily ticket, and which tickets it handed in / has been paid for
const PID = 'betly:lotto-pid', MINE = 'betly:lotto-daily';
export function pid() {
  let id = localStorage.getItem(PID);
  if (!id) localStorage.setItem(PID, (id = crypto.randomUUID()));
  return id;
}
type Mine = Record<string, DailyTicket & { paid?: number }>;
export const mine = (): Mine => { try { return JSON.parse(localStorage.getItem(MINE) || '{}'); } catch { return {}; } };
function saveMine(m: Mine) {
  // keep the last two weeks only
  const keep = prevDay(openDay(), 14);
  localStorage.setItem(MINE, JSON.stringify(Object.fromEntries(Object.entries(m).filter(([d]) => d >= keep))));
}
export function markPaid(day: string, amt: number) { const m = mine(); if (m[day]) { m[day].paid = amt; saveMine(m); } }

export async function handIn(name: string, t: DailyTicket) {
  const day = openDay();
  const { error } = await (await sb()).from('lotto_tickets').insert({ day, pid: pid(), name: name.slice(0, 24) || 'Player', nums: t.nums, lucky: t.lucky });
  if (error && error.code !== '23505') throw error; // 23505: already handed in from another tab
  saveMine({ ...mine(), [day]: { nums: [...t.nums], lucky: t.lucky } });
  return day;
}

/** The draw of a past day (the server draws it on the first request after 20:00). */
export async function getDraw(day: string): Promise<DailyDraw | null> {
  const { data, error } = await (await sb()).rpc('lotto_draw', { d: day });
  if (error) throw error;
  return data?.day ? data : null;
}

/** Names on today's tickets, the last draws and their tickets with results. */
export async function stats(days = 7) {
  const c = await sb(), today = openDay(), from = prevDay(today, days);
  const [t, d, r] = await Promise.all([
    c.from('lotto_tickets').select('name').eq('day', today).order('created_at').limit(500),
    c.from('lotto_draws').select('day,nums,lucky').gte('day', from).order('day', { ascending: false }),
    c.from('lotto_results').select('id,day,name,nums,lucky,hits,star').gte('day', from).order('hits', { ascending: false }).limit(1000),
  ]);
  const err = t.error || d.error || r.error;
  if (err) throw err;
  return { today: t.data.map((x) => x.name as string), draws: d.data as DailyDraw[], results: r.data as DailyResult[] };
}
