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

  constructor(
    private game: string,
    private onMsg: Handler,
    private onLeave: (id: string) => void = () => {},
  ) {}

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
      this.role = 'host';
      this.status = 'open';
    });
    peer.on('connection', (c) => {
      c.on('open', () => {
        this.#conns.set(c.peer, c);
        this.guests = this.#conns.size;
      });
      c.on('data', (d) => this.onMsg(d, c.peer));
      const gone = () => {
        if (!this.#conns.delete(c.peer)) return;
        this.guests = this.#conns.size;
        this.onLeave(c.peer);
      };
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
        this.role = 'guest';
        this.status = 'open';
      });
      c.on('data', (d) => this.onMsg(d, 'host'));
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

  sendTo(id: string, msg: any) {
    this.#conns.get(id)?.send(msg);
  }

  leave() {
    this.#peer?.destroy();
    this.#peer = this.#host = undefined;
    this.#conns.clear();
    Object.assign(this, { role: 'solo', status: 'idle', code: '', error: '', myId: 'me', guests: 0 });
  }
}
