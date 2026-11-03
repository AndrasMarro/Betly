// Serverless multiplayer: WebRTC peer-to-peer via PeerJS. The host's browser is the authoritative table.
import Peer, { type DataConnection, type PeerOptions } from 'peerjs';

const PREFIX = 'betly-v1-';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');

// ?peer=host:port lets you point at a self-hosted PeerServer (used for local testing).
function peerOpts(): PeerOptions {
  const p = new URLSearchParams(location.search).get('peer');
  if (!p) return {};
  const [host, port] = p.split(':');
  return { host, port: +port || 9000, path: '/', secure: false };
}

export type Handler = (msg: any, from: string) => void;

export class Room {
  role = $state<'solo' | 'host' | 'guest'>('solo');
  status = $state<'idle' | 'connecting' | 'open' | 'error'>('idle');
  code = $state('');
  error = $state('');
  myId = $state('me');
  guests = $state(0);
  #peer?: Peer;
  #conns = new Map<string, DataConnection>();
  #host?: DataConnection;
  // Heartbeat: WebRTC often reports a vanished peer late or never, so both sides ping
  // every 2 s and treat 7 s of silence as "left". Otherwise a table would wait forever.
  #seen = new Map<string, number>();
  #beat?: ReturnType<typeof setInterval>;

  constructor(
    private game: string,
    private onMsg: Handler,
    private onLeave: (id: string) => void = () => {},
  ) {
    addEventListener('pagehide', () => this.leave());
  }

  #heartbeat() {
    clearInterval(this.#beat);
    this.#beat = setInterval(() => {
      const now = Date.now();
      if (this.#host) {
        this.#host.send({ t: '_ping' });
        if (now - (this.#seen.get('host') ?? now) > 7000) this.#fail('Host left the room');
      }
      for (const [id, c] of this.#conns) {
        c.send({ t: '_ping' });
        if (now - (this.#seen.get(id) ?? now) > 7000) c.close(), this.#drop(id);
      }
    }, 2000);
  }

  #recv(d: any, from: string) {
    this.#seen.set(from, Date.now());
    if (d?.t !== '_ping') this.onMsg(d, from);
  }

  #drop(id: string) {
    if (!this.#conns.delete(id)) return;
    this.guests = this.#conns.size;
    this.onLeave(id);
  }

  get online() {
    return this.role !== 'solo';
  }

  create() {
    this.leave();
    this.status = 'connecting';
    this.code = newCode();
    const peer = (this.#peer = new Peer(PREFIX + this.game + '-' + this.code, peerOpts()));
    peer.on('open', (id) => {
      this.myId = id;
      this.#heartbeat();
      this.role = 'host';
      this.status = 'open';
    });
    peer.on('connection', (c) => {
      c.on('open', () => {
        this.#conns.set(c.peer, c);
        this.#seen.set(c.peer, Date.now());
        this.guests = this.#conns.size;
      });
      c.on('data', (d) => this.#recv(d, c.peer));
      const gone = () => this.#drop(c.peer);
      c.on('close', gone);
      c.on('error', gone);
    });
    peer.on('error', (e) => this.#fail(e.type === 'unavailable-id' ? 'Code collision, try again' : e.message));
  }

  join(code: string) {
    this.leave();
    code = code.trim().toUpperCase();
    this.status = 'connecting';
    this.code = code;
    const peer = (this.#peer = new Peer(peerOpts()));
    peer.on('open', (id) => {
      this.myId = id;
      const c = peer.connect(PREFIX + this.game + '-' + code, { reliable: true });
      c.on('open', () => {
        this.#host = c;
        this.#seen.set('host', Date.now());
        this.#heartbeat();
        this.role = 'guest';
        this.status = 'open';
      });
      c.on('data', (d) => this.#recv(d, 'host'));
      c.on('close', () => this.#fail('Host left the room'));
    });
    peer.on('error', (e) => this.#fail(e.type === 'peer-unavailable' ? 'Room not found' : e.message));
  }

  #fail(msg: string) {
    this.leave();
    this.status = 'error';
    this.error = msg;
  }

  /** Guest → host. On host/solo the message is handled locally as if sent by ourselves. */
  send(msg: any) {
    if (this.role === 'guest') this.#host?.send(msg);
    else this.onMsg(msg, this.myId);
  }

  broadcast(msg: any) {
    for (const c of this.#conns.values()) c.send(msg);
  }

  /** Is this player id still at the table (ourselves, or a connected guest)? */
  has(id: string | null) {
    return id === this.myId || (id !== null && this.#conns.has(id));
  }

  sendTo(id: string, msg: any) {
    this.#conns.get(id)?.send(msg);
  }

  leave() {
    clearInterval(this.#beat);
    this.#seen.clear();
    this.#peer?.destroy();
    this.#peer = this.#host = undefined;
    this.#conns.clear();
    Object.assign(this, { role: 'solo', status: 'idle', code: '', error: '', myId: 'me', guests: 0 });
  }
}
