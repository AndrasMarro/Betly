// Optional account (Supabase + Google login). Local first: the games keep reading and writing localStorage,
// this module mirrors every `betly:*` key to the `saves` table in the background (see docs/konzept-accounts.md).
import type { SupabaseClient } from '@supabase/supabase-js';
import { wallet, settings, ui } from './state.svelte';
import { t } from './i18n';

// Both are public by design; RLS on the table does the protecting.
const SB_URL = 'https://wcztqzznlunixrdpschq.supabase.co';
const KEY = 'sb_publishable_z1GFMefrjm_lIVM47elIlg_qBbGLoO9';
const TOKEN = 'sb-wcztqzznlunixrdpschq-auth-token'; // where supabase-js keeps the session
const META = 'betly-sync'; // { uid, keys: { key: { v: last synced value, t: server updated_at } } }
const SKIP = new Set(['betly:id', 'betly:sealed']); // per-browser seal, not progress

export const account = $state({ user: null as null | { id: string; email?: string; name?: string; avatar?: string }, busy: false, error: '' });

/** A stored session means this browser is (most likely) signed in, known before supabase-js has loaded. */
export const hasSession = () => { try { return !!localStorage.getItem(TOKEN); } catch { return false; } };

let client: Promise<SupabaseClient> | null = null;
export const sb = () =>
  (client ??= import('@supabase/supabase-js').then(({ createClient }) => {
    const c = createClient(SB_URL, KEY, { auth: { flowType: 'pkce' } });
    c.auth.onAuthStateChange((_, s) => {
      const id = s?.user.id;
      const md = s?.user.user_metadata ?? {};
      account.user = s ? { id: s.user.id, email: s.user.email, name: md.full_name ?? md.name, avatar: md.avatar_url ?? md.picture } : null;
      ui.signedIn = !!s;
      // a fresh browser still has the random default name: take the first name from Google (the account's saved name wins in pull)
      if (s && /^Player-\d{4}$/.test(settings.name) && (md.given_name || md.full_name)) settings.name = String(md.given_name || md.full_name).slice(0, 20);
      if (location.search.includes('code=')) history.replaceState(history.state, '', location.pathname + location.hash);
      // never await other auth calls inside this callback (supabase-js deadlocks), so run the sync afterwards
      if (id && id !== synced) { synced = id; setTimeout(() => pull().catch(fail), 0); }
    });
    return c;
  }));
let synced = '';

const fail = (e: unknown) => { account.error = e instanceof Error ? e.message : String(e); };

type Meta = { uid: string; keys: Record<string, { v: string; t: string }> };
const loadMeta = (): Meta => { try { return JSON.parse(localStorage.getItem(META) || ''); } catch { return { uid: '', keys: {} }; } };
const saveMeta = (m: Meta) => localStorage.setItem(META, JSON.stringify(m));
const keys = () => Object.keys(localStorage).filter((k) => k.startsWith('betly:') && !SKIP.has(k));

// wallet and settings live in $state, so they are read from and written to the state (the wallet's stored
// form carries a per-browser seal that would not survive another device)
function read(k: string) {
  if (k === 'betly:wallet') { const { balance, lastBonus, biggestWin, rounds } = wallet; return JSON.stringify({ balance, lastBonus, biggestWin, rounds }); }
  if (k === 'betly:settings') return JSON.stringify(settings);
  return localStorage.getItem(k);
}
function write(k: string, v: string) {
  if (k === 'betly:wallet') Object.assign(wallet, JSON.parse(v));
  else if (k === 'betly:settings') Object.assign(settings, JSON.parse(v));
  else localStorage.setItem(k, v);
}

/** Load the account's saves. Server changes win; keys only changed here are pushed afterwards. */
async function pull() {
  const c = await sb();
  const uid = account.user!.id;
  const { data: rows, error } = await c.from('saves').select('key,data,updated_at');
  if (error) throw error;
  let meta = loadMeta();
  if (meta.uid !== uid) meta = { uid, keys: {} };
  // first sync of this browser with an account that already has progress: ask which one to keep
  let keepLocal = false;
  const sw = rows.find((r) => r.key === 'betly:wallet');
  if (!Object.keys(meta.keys).length && sw && wallet.rounds > 0 && read('betly:wallet') !== sw.data) {
    keepLocal = !confirm(t('acc.pick').replace('{a}', fmtBal(JSON.parse(sw.data).balance)).replace('{b}', fmtBal(wallet.balance)));
  }
  for (const r of rows) {
    if (meta.keys[r.key]?.t === r.updated_at) continue; // unchanged on the server
    if (keepLocal && read(r.key) != null) { meta.keys[r.key] = { v: '', t: r.updated_at }; continue; } // pushed below
    write(r.key, r.data);
    meta.keys[r.key] = { v: r.data, t: r.updated_at };
  }
  saveMeta(meta);
  account.error = '';
  await push();
}
const fmtBal = (n: number) => new Intl.NumberFormat(settings.lang === 'de' ? 'de-CH' : 'en-US').format(n);

let pushing = false;
/** Send every key that changed since the last sync. */
async function push() {
  const meta = loadMeta();
  if (!account.user || meta.uid !== account.user.id || pushing) return;
  const rows = keys().map((key) => ({ user_id: meta.uid, key, data: read(key)! })).filter((r) => meta.keys[r.key]?.v !== r.data);
  if (!rows.length) return;
  pushing = true;
  try {
    const { data, error } = await (await sb()).from('saves').upsert(rows).select('key,data,updated_at');
    if (error) throw error;
    const m = loadMeta();
    for (const r of data) m.keys[r.key] = { v: r.data, t: r.updated_at };
    saveMeta(m);
    account.error = '';
  } finally { pushing = false; }
}

/** Start syncing when this browser already has a session (or is coming back from Google). */
export function initAccount() {
  if (!localStorage.getItem(TOKEN) && !location.search.includes('code=')) return;
  sb().catch(fail);
}
// ponytail: polls every 5 s instead of hooking every game's save; cheap string compares, push only on change
setInterval(() => account.user && push().catch(fail), 5000);
document.addEventListener('visibilitychange', () => {
  if (!account.user) return;
  (document.hidden ? push() : pull()).catch(fail);
});

export async function signIn() {
  account.busy = true;
  try {
    const { error } = await (await sb()).auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
    if (error) throw error;
  } catch (e) { fail(e); account.busy = false; }
}

/** Forget this browser's copy so the next guest or account starts fresh (the account keeps its saves). */
function clearLocal() {
  for (const k of keys()) if (k !== 'betly:settings') localStorage.removeItem(k);
  localStorage.removeItem(META);
  location.reload();
}

export async function signOut() {
  account.busy = true;
  try { await push(); } catch {}
  await (await sb()).auth.signOut({ scope: 'local' });
  clearLocal();
}

export async function deleteAccount() {
  if (!confirm(t('acc.deleteConfirm'))) return;
  account.busy = true;
  const c = await sb();
  const { error } = await c.rpc('delete_me');
  if (error) { fail(error); account.busy = false; return; }
  await c.auth.signOut({ scope: 'local' });
  clearLocal();
}

/** Download everything stored for this account as JSON. */
export async function exportData() {
  const { data, error } = await (await sb()).from('saves').select('key,data,updated_at');
  if (error) return fail(error);
  const blob = new Blob([JSON.stringify({ email: account.user?.email, saves: data }, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'betly-daten.json' });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
