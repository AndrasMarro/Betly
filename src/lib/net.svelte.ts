// Multiplayer over Supabase Realtime: every room is a broadcast channel on the Betly project, so it works
// across any network (mobile data, NAT, firewalls), which direct WebRTC did not. The host's browser stays the
// authoritative table; presence tells who is in the room and when someone leaves.
import type { RealtimeChannel } from '@supabase/supabase-js';
import { sb } from './account.svelte';

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
const newId = () => 'p' + Math.random().toString(36).slice(2, 10);

export type Handler = (msg: any, from: string) => void;
type Packet = { to: string; from: string; d: any }; // to: 'host', a player id or '*'

export class Room {
  role = $state<'solo' | 'host' | 'guest'>('solo');
  status = $state<'idle' | 'connecting' | 'open' | 'error'>('idle');
  code = $state('');
  error = $state('');
  myId = $state('me');
  guests = $state(0);
  #ch?: RealtimeChannel;
  #hostId = '';
  #ids = new Set<string>(); // guests at the table (host only)

  constructor(
    private game: string,
    private onMsg: Handler,
    private onLeave: (id: string) => void = () => {},
  ) {
    addEventListener('pagehide', () => this.leave());
  }

  get online() {
    return this.role !== 'solo';
  }

  #add(id: string) {
    if (id === this.myId || this.#ids.has(id)) return;
    this.#ids.add(id);
    this.guests = this.#ids.size;
  }
  #drop(id: string) {
    if (!this.#ids.delete(id)) return;
    this.guests = this.#ids.size;
    this.onLeave(id);
  }

  async #open(code: string, host: boolean) {
    this.leave();
    this.status = 'connecting';
    this.code = code;
    const me = newId();
    let ch: RealtimeChannel;
    try {
      ch = (await sb()).channel(`betly-${this.game}-${code}`, { config: { broadcast: { self: false }, presence: { key: me } } });
    } catch {
      return this.#fail('No connection');
    }
    if (this.status !== 'connecting' || this.code !== code) return; // left or switched while loading
    this.#ch = ch;
    const hosts = () => Object.entries(ch.presenceState()).filter(([, v]) => (v as any[]).some((p) => p.host)).map(([k]) => k);

    ch.on('broadcast', { event: 'm' }, ({ payload: p }: { payload: Packet }) => {
      if (this.role === 'host' && p.to === 'host') { this.#add(p.from); this.onMsg(p.d, p.from); }
      else if (this.role === 'guest' && p.from === this.#hostId && (p.to === me || p.to === '*')) this.onMsg(p.d, 'host');
    });
    ch.on('presence', { event: 'join' }, ({ key }) => { if (this.role === 'host' && key !== me) this.#add(key); });
    ch.on('presence', { event: 'leave' }, ({ key }) => {
      if (this.role === 'host') this.#drop(key);
      else if (this.role === 'guest' && key === this.#hostId) this.#fail('Host left the room');
    });

    ch.subscribe(async (st) => {
      if (st === 'SUBSCRIBED' && this.#ch === ch && this.status === 'connecting') {
        if (host) {
          await ch.track({ host: true });
          Object.assign(this, { myId: me, role: 'host', status: 'open' });
          return;
        }
        // a guest needs a host: presence arrives with the first sync, give it a few seconds
        for (let i = 0; i < 25 && !hosts().length && this.#ch === ch; i++) await new Promise((r) => setTimeout(r, 200));
        if (this.#ch !== ch) return;
        if (!hosts().length) return this.#fail('Room not found');
        this.#hostId = hosts()[0];
        await ch.track({});
        Object.assign(this, { myId: me, role: 'guest', status: 'open' });
      } else if ((st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') && this.#ch === ch && this.status === 'connecting') this.#fail('No connection');
    });
  }

  create() {
    this.#open(newCode(), true);
  }

  join(code: string) {
    this.#open(code.trim().toUpperCase(), false);
  }

  #fail(msg: string) {
    this.leave();
    this.status = 'error';
    this.error = msg;
  }

  #post(to: string, d: any) {
    this.#ch?.send({ type: 'broadcast', event: 'm', payload: { to, from: this.myId, d: $state.snapshot(d) } });
  }

  /** Guest → host. On host/solo the message is handled locally as if sent by ourselves. */
  send(msg: any) {
    if (this.role === 'guest') this.#post('host', msg);
    else this.onMsg(msg, this.myId);
  }

  broadcast(msg: any) {
    if (this.role === 'host' && this.#ids.size) this.#post('*', msg);
  }

  /** Is this player id still at the table (ourselves, or a connected guest)? */
  has(id: string | null) {
    return id === this.myId || (id !== null && this.#ids.has(id));
  }

  /** Ids of connected guests (host only). */
  peers() {
    return [...this.#ids];
  }

  sendTo(id: string, msg: any) {
    if (this.role === 'host') this.#post(id, msg);
  }

  leave() {
    const ch = this.#ch;
    this.#ch = undefined;
    if (ch) ch.unsubscribe().then(() => ch.teardown?.()).catch(() => {});
    this.#ids.clear();
    this.#hostId = '';
    Object.assign(this, { role: 'solo', status: 'idle', code: '', error: '', myId: 'me', guests: 0 });
  }
}
