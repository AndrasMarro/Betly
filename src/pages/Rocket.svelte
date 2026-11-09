<script lang="ts">
  import { onDestroy, onMount, untrack } from 'svelte';
  import { fly, scale } from 'svelte/transition';
  import ArcadeLayout from '../components/ArcadeLayout.svelte';
  import BetInput from '../components/BetInput.svelte';
  import RoomBar from '../components/RoomBar.svelte';
  import Sprite from '../components/Sprite.svelte';
  import { crashPoint, multAt, secAt } from '../games/arcade';
  import { Room } from '../lib/net.svelte';
  import { settings, wallet, settle, fmt } from '../lib/state.svelte';
  import { short } from '../lib/chips';
  import { sfx, engine } from '../lib/sfx';
  import { t } from '../lib/i18n';
  import teslaSrc from '../assets/space/tesla.webp';
  import forceSrc from '../assets/space/force.webp';
  import planetSrc from '../assets/space/planet.webp';
  import rockSrc from '../assets/space/rock.webp';
  const IMG: Record<string, HTMLImageElement> = {};
  for (const [k, src] of [['tesla', teslaSrc], ['force', forceSrc], ['planet', planetSrc], ['rock', rockSrc]]) { const i = new Image(); i.src = src; IMG[k] = i; }
  const ready = (k: string) => IMG[k]?.complete && IMG[k].naturalWidth > 0;
  // drawn width of each artwork sighting
  const ART_W: Record<string, number> = { tesla: 150, force: 124, planet: 190 };

  type P = { id: string; name: string; bot?: boolean; bet: number; auto: number; cash: number | null };
  const BET_MS = 6000, PAUSE_MS = 3500;

  // ---------- shared state (host authoritative) ----------
  const share = $state({ phase: 'bet' as 'bet' | 'fly' | 'boom', round: 0, crash: 0, history: [] as number[], players: [] as P[], left: BET_MS, elapsed: 0 });
  let betEnd = 0, flyStart = 0; // local clocks (performance.now based)
  let crashAt = 1; // host only, secret until the boom
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ticker: ReturnType<typeof setInterval> | undefined;

  const room = new Room('rocket', onMsg, (id) => {
    share.players = share.players.filter((p) => p.id !== id || p.bet > 0);
    push();
  });
  const isHost = $derived(room.role !== 'guest');

  function push() {
    if (room.role !== 'host') return;
    untrack(() => {
      const now = performance.now();
      room.broadcast({ t: 'state', s: { ...$state.snapshot(share), left: Math.max(0, betEnd - now), elapsed: now - flyStart } });
    });
  }

  function onMsg(m: any, from: string) {
    if (m.t === 'state') {
      if (room.role !== 'guest') return;
      const was = share.phase;
      Object.assign(share, m.s);
      const now = performance.now();
      betEnd = now + m.s.left;
      if (m.s.phase === 'fly') flyStart = now - m.s.elapsed;
      phaseFx(was);
      return;
    }
    if (room.role === 'guest') return;
    const p = share.players.find((x) => x.id === from);
    if (m.t === 'bet' && share.phase === 'bet' && !p?.bet) {
      const bet = Math.max(0, +m.amt || 0), auto = +m.auto >= 1.01 ? Math.round(+m.auto * 100) / 100 : 0;
      if (!bet) return;
      share.players = [...share.players.filter((x) => x.id !== from), { id: from, name: String(m.name).slice(0, 24), bet, auto, cash: null }];
    } else if (m.t === 'cancel' && share.phase === 'bet' && p) {
      share.players = share.players.filter((x) => x !== p);
    } else if (m.t === 'cash' && share.phase === 'fly' && p?.bet && !p.cash) {
      p.cash = Math.max(1, Math.min(+m.m || 1, cur()));
    } else return;
    push();
  }

  // ---------- round loop (host / solo) ----------
  const cur = () => multAt((performance.now() - flyStart) / 1000);
  const BOTS = ['Mila', 'Jonas', 'Lea', 'Finn', 'Ava'];
  function newRound() {
    const was = share.phase;
    share.phase = 'bet';
    share.round++;
    share.crash = 0;
    share.players = settings.bots
      ? BOTS.filter(() => Math.random() < 0.75).map((name, i) => ({
          id: 'bot' + i, name, bot: true, bet: [10, 25, 50, 100, 250, 500][Math.floor(Math.random() * 6)], auto: Math.round(Math.exp(Math.random() * Math.log(8)) * 100) / 100 + 0.1, cash: null,
        }))
      : [];
    betEnd = performance.now() + BET_MS;
    push();
    phaseFx(was);
    timer = setTimeout(launch, BET_MS);
  }
  function launch() {
    crashAt = crashPoint();
    share.phase = 'fly';
    flyStart = performance.now();
    push();
    phaseFx('bet');
    ticker = setInterval(() => {
      const m = cur();
      let changed = false;
      for (const p of share.players) if (p.bet && !p.cash && p.auto && p.auto <= Math.min(m, crashAt)) { p.cash = p.auto; changed = true; }
      if (m >= crashAt) boom();
      else if (changed) push();
    }, 50);
  }
  function boom() {
    clearInterval(ticker);
    for (const p of share.players) if (p.bet && !p.cash && p.auto && p.auto <= crashAt) p.cash = p.auto;
    share.phase = 'boom';
    share.crash = crashAt;
    share.history = [crashAt, ...share.history].slice(0, 16);
    push();
    phaseFx('fly');
    timer = setTimeout(newRound, PAUSE_MS);
  }
  function stopLoop() {
    clearTimeout(timer);
    clearInterval(ticker);
    timer = ticker = undefined;
  }
  // host/solo drives the rounds; a guest just follows
  let wasGuest = false;
  $effect(() => {
    const guest = room.role === 'guest';
    untrack(() => {
      if (guest) { wasGuest = true; return stopLoop(); }
      if (wasGuest) { wasGuest = false; share.players = []; }
      if (!timer && !ticker) newRound();
    });
  });

  // ---------- my bet ----------
  let bet = $state(10);
  let auto = $state(2);
  let useAuto = $state(false);
  let queued = $state(false);
  const me = $derived(share.players.find((p) => p.id === room.myId && p.bet));
  const canBet = $derived(bet > 0 && bet <= wallet.balance);

  function place() {
    if (!canBet) return;
    if (share.phase !== 'bet') return void (queued = !queued);
    room.send({ t: 'bet', amt: bet, auto: useAuto ? auto : 0, name: settings.name });
    sfx('chip');
  }
  $effect(() => {
    if (share.phase === 'bet' && queued && !me) untrack(() => { queued = false; place(); });
  });
  const cashout = () => { if (me && !me.cash && share.phase === 'fly') room.send({ t: 'cash', m: live }); };

  // book my result once per round
  let booked = 0;
  $effect(() => {
    if (share.phase !== 'boom' || share.round === booked) return;
    booked = share.round;
    untrack(() => {
      if (!me) return;
      const back = me.cash ? Math.round(me.bet * me.cash * 100) / 100 : 0;
      settle(back - me.bet, back);
    });
  });
  let cashedSeen = 0;
  $effect(() => {
    if (me?.cash && share.round !== cashedSeen) { cashedSeen = share.round; sfx('cash'); }
  });

  // ---------- sound per phase ----------
  let eng: ReturnType<typeof engine> | null = null;
  function phaseFx(was: string) {
    if (share.phase === 'fly' && was !== 'fly') { eng?.stop(); eng = engine(); }
    if (share.phase === 'boom' && was !== 'boom') { eng?.stop(); eng = null; sfx('boom'); }
  }

  // ---------- drawing ----------
  let live = $state(1);
  let left = $state(BET_MS);
  let canvas: HTMLCanvasElement;
  let box = $state({ w: 800, h: 420 });
  let rocket = $state({ x: 0, y: 0, rot: 45 });
  let raf = 0;
  let accent = '#e5484d';
  $effect(() => {
    void settings.theme;
    requestAnimationFrame(() => (accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || accent));
  });
  // keep my bet when my player id changes (opening a room)
  let prevId = 'me';
  $effect(() => {
    const id = room.myId;
    untrack(() => { for (const p of share.players) if (p.id === prevId) p.id = id; prevId = id; });
  });
  const stars = Array.from({ length: 110 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random() }));
  type Puff = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; spark?: boolean };
  type Rock = { x: number; y: number; vx: number; vy: number; r: number; a: number; va: number; pts: number[]; z: number };
  let puffs: Puff[] = [];
  let rocks: Rock[] = [];
  let ring = 0; // explosion shockwave progress
  let lastPhase = '';
  let lastT = performance.now();
  let cam = { x: 10, y: 2 }; // visible seconds / multiplier, eased so the view never jumps
  let ang = -Math.PI / 4; // rocket heading, eased
  let flySeen = 0;
  const mix = (a: number[], b: number[], k: number) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
  const niceStep = (range: number) => { const raw = range / 5, p = 10 ** Math.floor(Math.log10(raw)); return [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= raw)!; };
  function spawnRock(W: number, H: number, anywhere = false) {
    const r = 6 + Math.random() * 22, z = 0.3 + Math.random() * 0.7;
    const pts = Array.from({ length: 9 }, () => 0.72 + Math.random() * 0.36);
    rocks.push({ x: anywhere ? Math.random() * W : W + r * 2, y: anywhere ? Math.random() * H * 0.8 : -r * 2 + Math.random() * H * 0.7, vx: -(30 + Math.random() * 50) * z, vy: (10 + Math.random() * 25) * z, r: r * z, a: Math.random() * 6, va: (Math.random() - 0.5) * 1.4, pts, z });
  }
  function drawRock(ctx: CanvasRenderingContext2D, k: Rock) {
    if (ready('rock')) {
      ctx.save();
      ctx.translate(k.x, k.y);
      ctx.rotate(k.a);
      ctx.globalAlpha = 0.55 + k.z * 0.45;
      const d = k.r * 2.3;
      ctx.drawImage(IMG.rock, -d / 2, -d / 2, d, d * 0.89);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(k.x, k.y);
    ctx.rotate(k.a);
    ctx.beginPath();
    k.pts.forEach((m, i) => { const t = (i / k.pts.length) * Math.PI * 2; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(t) * k.r * m, Math.sin(t) * k.r * m); });
    ctx.closePath();
    const g = ctx.createRadialGradient(-k.r * 0.4, -k.r * 0.4, k.r * 0.1, 0, 0, k.r * 1.1);
    g.addColorStop(0, `rgba(170,160,190,${0.5 + k.z * 0.5})`);
    g.addColorStop(1, `rgba(60,52,80,${0.5 + k.z * 0.5})`);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = 'rgba(30,24,44,.45)';
    ctx.beginPath(); ctx.arc(k.r * 0.25, k.r * 0.1, k.r * 0.22, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(-k.r * 0.3, k.r * 0.35, k.r * 0.13, 0, 7); ctx.fill();
    ctx.restore();
  }

  // ---------- sightings: the higher you fly, the stranger the neighbourhood ----------
  type Fly = { kind: string; x: number; y: number; vx: number; vy: number; a: number; va: number; s: number; t: number };
  const SIGHTS: { at: number; kind: string; p: number; de: string; en: string }[] = [
    { at: 1.4, kind: 'sat', p: 1, de: 'Satellit', en: 'Satellite' },
    { at: 2.2, kind: 'force', p: 1, de: 'Space Force', en: 'Space Force' },
    { at: 3.5, kind: 'tesla', p: 0.6, de: 'Starman im Roadster', en: 'Starman in a roadster' },
    { at: 5, kind: 'ufo', p: 1, de: 'Aliens!', en: 'Aliens!' },
    { at: 10, kind: 'planet', p: 1, de: 'Ringplanet', en: 'Ringed planet' },
    { at: 25, kind: 'hole', p: 1, de: 'Schwarzes Loch', en: 'Black hole' },
    { at: 60, kind: 'whale', p: 1, de: 'Weltraumwal?!', en: 'Space whale?!' },
  ];
  let flybys: Fly[] = [];
  let sightRound = -1, sightNext = 0;
  let sighting = $state<{ label: string; id: number } | null>(null);
  function spawnSight(W: number, H: number, kind: string) {
    const big = kind === 'planet' || kind === 'hole' || kind === 'whale';
    flybys.push({ kind, x: W + (big ? 160 : 80), y: H * (big ? 0.22 : 0.15 + Math.random() * 0.35), vx: -(W + 320) / (big ? 11 : 6.5), vy: big ? 4 : 8, a: kind === 'tesla' ? -0.1 : 0, va: kind === 'tesla' ? 0.04 : kind === 'sat' ? 0.25 : 0, s: Math.max(0.7, Math.min(1.3, W / 800)), t: 0 });
  }
  function drawSight(ctx: CanvasRenderingContext2D, f: Fly) {
    ctx.save();
    ctx.translate(f.x, f.y + Math.sin(f.t * 1.6) * 5);
    ctx.rotate(f.a);
    ctx.scale(f.s, f.s);
    const blink = Math.sin(f.t * 8) > 0;
    if (ART_W[f.kind] && ready(f.kind)) {
      const img = IMG[f.kind], w = ART_W[f.kind], h = (w * img.naturalHeight) / img.naturalWidth;
      if (f.kind === 'planet') { ctx.shadowColor = 'rgba(255,200,150,.35)'; ctx.shadowBlur = 30; }
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
      return;
    }
    if (f.kind === 'sat') {
      for (const d of [-1, 1]) {
        ctx.fillStyle = '#2b4f9e'; ctx.fillRect(d > 0 ? 12 : -42, -9, 30, 18);
        ctx.strokeStyle = 'rgba(160,200,255,.6)'; ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo((d > 0 ? 12 : -42) + i * 7.5, -9); ctx.lineTo((d > 0 ? 12 : -42) + i * 7.5, 9); ctx.stroke(); }
        ctx.fillStyle = '#9aa3b5'; ctx.fillRect(d > 0 ? 8 : -12, -1.5, 4, 3);
      }
      ctx.fillStyle = '#d9a640'; ctx.fillRect(-8, -10, 16, 20);
      ctx.fillStyle = '#f2d79a'; ctx.fillRect(-8, -10, 16, 5);
      ctx.strokeStyle = '#ccc'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, -20); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -22, 4, Math.PI, 0); ctx.fillStyle = '#e8e8e8'; ctx.fill();
      ctx.fillStyle = blink ? '#ff5a5a' : '#5a1a1a'; ctx.beginPath(); ctx.arc(0, -26, 1.6, 0, 7); ctx.fill();
    } else if (f.kind === 'force') {
      // white shuttle with delta wings, escorted by its own exhaust
      ctx.fillStyle = 'rgba(120,180,255,.35)'; ctx.beginPath(); ctx.ellipse(46, 0, 18, 4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#e9edf5';
      ctx.beginPath(); ctx.moveTo(-40, 0); ctx.quadraticCurveTo(-30, -9, 10, -8); ctx.lineTo(30, -6); ctx.lineTo(30, 6); ctx.lineTo(10, 8); ctx.quadraticCurveTo(-30, 9, -40, 0); ctx.fill();
      ctx.fillStyle = '#c9cfdb'; ctx.beginPath(); ctx.moveTo(-6, 6); ctx.lineTo(24, 22); ctx.lineTo(30, 6); ctx.fill();
      ctx.beginPath(); ctx.moveTo(14, -7); ctx.lineTo(30, -20); ctx.lineTo(32, -6); ctx.fill();
      ctx.fillStyle = '#1d2433'; ctx.beginPath(); ctx.moveTo(-34, -2); ctx.quadraticCurveTo(-28, -7, -20, -6); ctx.lineTo(-20, -1); ctx.fill();
      ctx.fillStyle = '#2a5ac8'; ctx.fillRect(-8, -3, 22, 2.5);
      ctx.fillStyle = '#d6324b'; ctx.fillRect(-8, 0.5, 22, 2.5);
      ctx.font = '700 7px "Geist Mono Variable", monospace'; ctx.fillStyle = '#1d2433'; ctx.fillText('SPACE FORCE', -14, 12);
    } else if (f.kind === 'tesla') {
      // cherry-red roadster, tumbling, with a spacesuited driver
      ctx.fillStyle = '#c4161c';
      ctx.beginPath(); ctx.moveTo(-34, 4); ctx.quadraticCurveTo(-33, -6, -18, -7); ctx.lineTo(-6, -8); ctx.quadraticCurveTo(8, -16, 18, -8); ctx.quadraticCurveTo(32, -7, 34, 2); ctx.lineTo(34, 6); ctx.lineTo(-34, 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(160,210,255,.7)'; ctx.beginPath(); ctx.moveTo(-4, -8); ctx.lineTo(4, -14); ctx.lineTo(8, -8); ctx.fill();
      ctx.fillStyle = '#111'; for (const x of [-21, 21]) { ctx.beginPath(); ctx.arc(x, 6, 6.5, 0, 7); ctx.fill(); ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(x, 6, 2.5, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; }
      ctx.fillStyle = '#f4f4f4'; ctx.beginPath(); ctx.arc(10, -15, 6, 0, 7); ctx.fill();
      ctx.fillStyle = '#2b2b3a'; ctx.beginPath(); ctx.arc(11.5, -15, 3.6, 0, 7); ctx.fill();
      ctx.fillStyle = '#f4f4f4'; ctx.fillRect(6, -10, 8, 4);
    } else if (f.kind === 'ufo') {
      ctx.fillStyle = 'rgba(120,255,160,.10)'; ctx.beginPath(); ctx.moveTo(-14, 4); ctx.lineTo(14, 4); ctx.lineTo(34, 70); ctx.lineTo(-34, 70); ctx.fill();
      ctx.fillStyle = 'rgba(150,230,255,.55)'; ctx.beginPath(); ctx.ellipse(0, -6, 14, 12, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#6fe08a'; ctx.beginPath(); ctx.ellipse(0, -8, 5, 6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(-2, -9, 1.6, 2.2, -0.4, 0, 7); ctx.ellipse(2, -9, 1.6, 2.2, 0.4, 0, 7); ctx.fill();
      const g = ctx.createLinearGradient(0, -6, 0, 6); g.addColorStop(0, '#d7dbe6'); g.addColorStop(1, '#6b7284');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 34, 8, 0, 0, 7); ctx.fill();
      for (let i = -2; i <= 2; i++) { ctx.fillStyle = (i + Math.floor(f.t * 6)) % 2 ? '#ffd84a' : '#ff5a8a'; ctx.beginPath(); ctx.arc(i * 12, 2, 2.2, 0, 7); ctx.fill(); }
    } else if (f.kind === 'planet') {
      const g = ctx.createRadialGradient(-20, -20, 8, 0, 0, 70); g.addColorStop(0, '#f2c58a'); g.addColorStop(1, '#8a4f2a');
      ctx.strokeStyle = 'rgba(240,210,160,.5)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(0, 0, 118, 26, -0.35, Math.PI, 2 * Math.PI); ctx.stroke();
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 64, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(120,70,40,.35)'; ctx.lineWidth = 6; for (const y of [-22, 6, 28]) { ctx.beginPath(); ctx.ellipse(0, y, 60, 6, 0, 0, 7); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(240,210,160,.6)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(0, 0, 118, 26, -0.35, 0, Math.PI); ctx.stroke();
    } else if (f.kind === 'hole') {
      for (let i = 0; i < 3; i++) { ctx.strokeStyle = `rgba(255,${150 - i * 30},60,${0.5 - i * 0.12})`; ctx.lineWidth = 10 - i * 2; ctx.beginPath(); ctx.ellipse(0, 0, 80 + i * 18, 22 + i * 6, -0.2 + f.t * 0.05, 0, 7); ctx.stroke(); }
      const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 52); g.addColorStop(0, '#000'); g.addColorStop(0.7, '#000'); g.addColorStop(1, 'rgba(255,170,80,.0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 52, 0, 7); ctx.fill();
    } else if (f.kind === 'whale') {
      ctx.fillStyle = '#5a7bd8';
      ctx.beginPath(); ctx.moveTo(-90, 0); ctx.quadraticCurveTo(-60, -44, 20, -30); ctx.quadraticCurveTo(70, -20, 90, -40); ctx.lineTo(96, -10); ctx.quadraticCurveTo(70, 14, 20, 26); ctx.quadraticCurveTo(-60, 40, -90, 0); ctx.fill();
      ctx.fillStyle = '#b9cbff'; ctx.beginPath(); ctx.moveTo(-84, 6); ctx.quadraticCurveTo(-30, 34, 20, 22); ctx.quadraticCurveTo(-30, 20, -84, 6); ctx.fill();
      ctx.fillStyle = '#0b0d18'; ctx.beginPath(); ctx.arc(-62, -6, 3.5, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(200,230,255,.6)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-40 + i * 6, -40 - ((f.t * 30 + i * 12) % 30), 2.5, 0, 7); ctx.fill(); }
    }
    ctx.restore();
  }

  if (import.meta.env.DEV) (window as any).__sight = (k: string, x: number) => { spawnSight(box.w, box.h, k); flybys[flybys.length - 1].x = x; flybys[flybys.length - 1].vx = 0; };
  function draw() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    left = Math.max(0, betEnd - now);
    const sec = share.phase === 'fly' ? (now - flyStart) / 1000 : share.phase === 'boom' ? secAt(share.crash) : 0;
    live = share.phase === 'boom' ? share.crash : share.phase === 'fly' ? multAt(sec) : 1;
    eng?.set(live);
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      const dpr = devicePixelRatio || 1, W = box.w, H = box.h;
      if (canvas.width !== Math.round(W * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // sky darkens with altitude
      const alt = Math.min(1, Math.log(live) / Math.log(20));
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, `rgb(${mix([46, 34, 96], [6, 6, 16], alt)})`);
      sky.addColorStop(1, `rgb(${mix([92, 46, 88], [14, 12, 34], alt)})`);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      const speed = share.phase === 'fly' ? 0.05 + Math.log(live) * 0.14 : 0.006;
      for (const st of stars) {
        st.x = (st.x - speed * dt * (0.3 + st.z) + 1) % 1;
        st.y = (st.y + speed * dt * 0.55 * (0.3 + st.z)) % 1;
        ctx.globalAlpha = 0.2 + st.z * 0.6;
        ctx.fillStyle = '#fff';
        ctx.fillRect(st.x * W, st.y * H, 0.6 + st.z * 1.5, 0.6 + st.z * 1.5);
      }
      ctx.globalAlpha = 1;
      // asteroids drift past, faster the higher we fly
      if (!rocks.length) for (let i = 0; i < 5; i++) spawnRock(W, H, true);
      const rush = share.phase === 'fly' ? 1 + Math.log(live) * 2.2 : 0.35;
      if (rocks.length < 9 && Math.random() < dt * (share.phase === 'fly' ? 1.6 : 0.35)) spawnRock(W, H);
      for (const k of rocks) { k.x += k.vx * dt * rush; k.y += k.vy * dt * rush; k.a += k.va * dt; drawRock(ctx, k); }
      rocks = rocks.filter((k) => k.x > -60 && k.y < H + 60);
      // sightings, once per milestone and round (some are only lucky)
      if (share.phase === 'bet' && sightRound !== share.round) { sightRound = share.round; sightNext = 0; sighting = null; }
      while (share.phase === 'fly' && sightNext < SIGHTS.length && live >= SIGHTS[sightNext].at) {
        const sg = SIGHTS[sightNext++];
        if (Math.random() < sg.p) { spawnSight(W, H, sg.kind); sighting = { label: settings.lang === 'de' ? sg.de : sg.en, id: now }; }
      }
      for (const f of flybys) { f.x += f.vx * dt * (share.phase === 'fly' ? 1 : 0.4); f.y += f.vy * dt; f.a += f.va * dt; f.t += dt; drawSight(ctx, f); }
      flybys = flybys.filter((f) => f.x > -260);

      // camera eases towards the needed range and never lets the curve leave the view
      const padL = 46, padB = 34, padT = 26, padR = 22;
      const tx = Math.max(10, sec * 1.25), ty = Math.max(2, live * 1.3);
      const ease = Math.min(1, dt * 3.2);
      cam.x += (tx - cam.x) * ease;
      cam.y += (ty - cam.y) * ease;
      cam.x = Math.max(cam.x, sec * 1.08, 10);
      cam.y = Math.max(cam.y, live * 1.1, 2);
      if (share.phase === 'bet') { cam = { x: 10, y: 2 }; }
      const X = (sx: number) => padL + (sx / cam.x) * (W - padL - padR);
      const Y = (m: number) => H - padB - ((m - 1) / (cam.y - 1)) * (H - padB - padT);
      // grid: multiplier on the left, seconds along the bottom
      ctx.font = '11px "Geist Mono Variable", monospace';
      ctx.lineWidth = 1;
      const ys = niceStep(cam.y - 1);
      for (let m = 1; m <= cam.y; m += ys) {
        ctx.strokeStyle = 'rgba(255,255,255,.07)';
        ctx.beginPath(); ctx.moveTo(padL, Y(m)); ctx.lineTo(W - padR, Y(m)); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        ctx.fillText((Math.round(m * 100) / 100).toString() + '×', 6, Y(m) + 4);
      }
      const xs = niceStep(cam.x);
      for (let x = 0; x <= cam.x; x += xs) {
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        ctx.fillText(Math.round(x) + 's', X(x) - 6, H - 10);
      }
      ctx.strokeStyle = 'rgba(255,255,255,.18)';
      ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, H - padB); ctx.lineTo(W - padR, H - padB); ctx.stroke();

      let rx = X(0), ry = Y(1), target = -Math.PI / 3;
      if (share.phase !== 'bet') {
        if (share.phase === 'fly' && flySeen !== share.round) { flySeen = share.round; ang = -Math.PI / 3; for (let i = 0; i < 26; i++) puffs.push({ x: X(0), y: Y(1), vx: (Math.random() - 0.7) * 90, vy: -Math.random() * 40, life: 0, max: 0.8 + Math.random() * 0.8, r: 6 + Math.random() * 8 }); }
        const n = 120, pts: [number, number][] = [];
        for (let i = 0; i <= n; i++) { const s2 = (sec * i) / n; pts.push([X(s2), Y(multAt(s2))]); }
        const boom = share.phase === 'boom';
        // area under the curve
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.lineTo(pts[n][0], H - padB); ctx.lineTo(X(0), H - padB); ctx.closePath();
        const fill = ctx.createLinearGradient(0, pts[n][1], 0, H - padB);
        fill.addColorStop(0, boom ? 'rgba(255,255,255,.07)' : accent + '55');
        fill.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = fill;
        ctx.fill();
        // the curve: glow pass + crisp pass
        for (const [w, a] of [[10, 0.18], [3.5, 1]] as const) {
          ctx.beginPath();
          pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          const line = ctx.createLinearGradient(X(0), 0, pts[n][0], 0);
          line.addColorStop(0, boom ? 'rgba(255,255,255,.25)' : accent);
          line.addColorStop(1, boom ? 'rgba(255,255,255,.5)' : '#ffd27a');
          ctx.globalAlpha = a;
          ctx.lineWidth = w;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = line;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        rx = pts[n][0];
        ry = pts[n][1];
        // current level marker
        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = boom ? 'rgba(255,90,100,.6)' : 'rgba(255,210,122,.55)';
        ctx.beginPath(); ctx.moveTo(padL, ry); ctx.lineTo(W - padR, ry); ctx.stroke();
        ctx.setLineDash([]);
        // cash-out markers
        ctx.font = '600 11px "Geist Variable", sans-serif';
        for (const p of share.players) if (p.cash && p.cash <= live) {
          const x = X(secAt(p.cash)), y = Y(p.cash);
          ctx.fillStyle = p.id === room.myId ? '#2fbf71' : 'rgba(255,255,255,.85)';
          ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 7); ctx.fill();
          ctx.fillText(p.name, x + 8, y - 7);
        }
        const [x0, y0] = pts[Math.max(0, n - 6)];
        target = sec > 0.05 ? Math.atan2(ry - y0, rx - x0) : -Math.PI / 4;
        if (share.phase === 'fly') {
          const tx2 = rx - Math.cos(ang) * 26, ty2 = ry - Math.sin(ang) * 26;
          for (let i = 0; i < 2; i++)
            puffs.push({ x: tx2, y: ty2, vx: -Math.cos(ang) * (40 + Math.random() * 40) + (Math.random() - 0.5) * 30, vy: -Math.sin(ang) * (40 + Math.random() * 40) + (Math.random() - 0.5) * 30, life: 0, max: 0.6 + Math.random() * 0.6, r: 3 + Math.random() * 4 });
        }
      } else {
        // idle on the pad with a gentle hover
        ry = Y(1) - 14 + Math.sin(now / 420) * 2.5;
        rx = X(0) + 10;
      }
      ang += (target - ang) * Math.min(1, dt * 7);
      const shake = share.phase === 'fly' && sec < 0.6 ? (0.6 - sec) * 3 : 0;
      rocket = { x: rx + (Math.random() - 0.5) * shake, y: ry + (Math.random() - 0.5) * shake, rot: 90 + (ang * 180) / Math.PI };

      if (share.phase === 'boom' && lastPhase !== 'boom') {
        ring = 0.001;
        for (let i = 0; i < 80; i++) {
          const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 280;
          puffs.push({ x: rocket.x, y: rocket.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.5 + Math.random() * 0.9, r: 1.5 + Math.random() * 2.5, spark: true });
        }
        for (let i = 0; i < 18; i++) {
          const a = Math.random() * Math.PI * 2, v = 20 + Math.random() * 60;
          puffs.push({ x: rocket.x, y: rocket.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 1.2 + Math.random() * 0.8, r: 10 + Math.random() * 14 });
        }
      }
      lastPhase = share.phase;
      if (ring > 0 && ring < 1) {
        ring = Math.min(1, ring + dt * 1.8);
        ctx.strokeStyle = `rgba(255,190,90,${1 - ring})`;
        ctx.lineWidth = 3 * (1 - ring) + 0.5;
        ctx.beginPath(); ctx.arc(rocket.x, rocket.y, 10 + ring * 150, 0, 7); ctx.stroke();
      }
      puffs = puffs.filter((p) => (p.life += dt) < p.max).slice(-300);
      for (const p of puffs) {
        const k = p.life / p.max;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= 0.97; p.vy = p.vy * 0.97 + (p.spark ? 120 : -10) * dt;
        ctx.globalAlpha = (1 - k) * (p.spark ? 1 : 0.35);
        ctx.fillStyle = p.spark ? (k < 0.4 ? '#fff3c4' : '#ff8a3d') : k < 0.15 ? '#ffb02e' : '#c9c3d6';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.spark ? p.r : p.r * (0.6 + k * 1.6), 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    raf = requestAnimationFrame(draw);
  }
  onMount(() => {
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(([e]) => (box = { w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(canvas);
    return () => ro.disconnect();
  });
  onDestroy(() => {
    cancelAnimationFrame(raf);
    stopLoop();
    eng?.stop();
    room.leave();
  });

  function key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, select, textarea, button')) return;
    if (e.code === 'Space') { e.preventDefault(); me && share.phase === 'fly' ? cashout() : place(); }
  }
  const hue = (m: number) => (m >= 10 ? 'gold' : m >= 2 ? 'good' : 'bad');
</script>

<svelte:window onkeydown={key} />

<ArcadeLayout eyebrow="Arcade · Crash" title="Rocket">
  {#snippet top()}
    <RoomBar {room}>
      {#snippet extra()}
        {#if isHost}<label class="switch mini"><span>{t('bots')}</span><input type="checkbox" bind:checked={settings.bots} /></label>{/if}
      {/snippet}
    </RoomBar>
  {/snippet}

  {#snippet controls()}
    {#if me && share.phase === 'fly' && !me.cash}
      <button class="btn primary big cash" onclick={cashout}>{t('a.cashout')} <span class="mono">{fmt(Math.round(me.bet * live * 100) / 100)}</span></button>
    {:else if me && share.phase === 'bet'}
      <button class="btn big" onclick={() => room.send({ t: 'cancel' })}>{t('rk.cancel')} <span class="mono">{fmt(me.bet)}</span></button>
    {:else if me?.cash}
      <button class="btn big" disabled>{t('rk.cashed')} <span class="mono">×{me.cash.toFixed(2)}</span></button>
    {:else}
      <button class="btn primary big" class:queued disabled={!canBet} onclick={place}>
        {share.phase === 'bet' ? t('rk.place') : queued ? t('rk.cancel') + ' · ' + t('a.next') : t('a.next')}
      </button>
    {/if}
    <BetInput bind:value={bet} disabled={!!me} />
    <label class="switch"><span>{t('rk.auto')}</span><input type="checkbox" bind:checked={useAuto} disabled={!!me} /></label>
    {#if useAuto}
      <label class="field"><input class="mono" type="number" min="1.01" step="0.1" bind:value={auto} disabled={!!me} /></label>
    {/if}
    {#if share.players.length}
      <ul class="players">
        {#each share.players as p (p.id)}
          <li class:me={p.id === room.myId} class:won={!!p.cash} class:lost={share.phase === 'boom' && !p.cash}>
            <span class="pn">{p.name}</span>
            <span class="mono">{short(p.bet)}</span>
            <span class="mono">{p.cash ? '×' + p.cash.toFixed(2) : p.auto && share.phase !== 'boom' ? '→ ' + p.auto.toFixed(2) : ''}</span>
            <span class="mono">{p.cash ? '+' + short(Math.round(p.bet * (p.cash - 1) * 100) / 100) : share.phase === 'boom' ? '-' + short(p.bet) : ''}</span>
          </li>
        {/each}
      </ul>
    {/if}
  {/snippet}

  <div class="hist">
    {#each share.history as h, i (share.round - i)}<span class="mono {hue(h)}" in:fly={{ x: -14, duration: 260 }}>{h.toFixed(2)}×</span>{/each}
  </div>
  <div class="sky">
    <canvas bind:this={canvas}></canvas>
    <div class="ship" class:gone={share.phase === 'boom'} style="transform: translate3d({rocket.x}px, {rocket.y}px, 0) translate(-50%, -50%) rotate({rocket.rot}deg)">
      <Sprite kind="rocket" flame={share.phase === 'fly'} />
    </div>
    <div class="center" class:flying={share.phase !== 'bet'}>
      {#if share.phase === 'bet'}
        <span class="eyebrow light">{t('rk.starts')}</span>
        <strong class="mono count">{(left / 1000).toFixed(1)}s</strong>
        <div class="bar"><i style="transform: scaleX({left / BET_MS})"></i></div>
      {:else if share.phase === 'fly'}
        <strong class="mono big-m" class:hot={live >= 2}>{live.toFixed(2)}×</strong>
        {#if sighting}{#key sighting.id}<span class="sight" in:fly={{ y: 8, duration: 300 }}>{sighting.label}</span>{/key}{/if}
      {:else}
        <span class="eyebrow light">{t('rk.crashed')}</span>
        <strong class="mono big-m bad">{share.crash.toFixed(2)}×</strong>
      {/if}
    </div>
  </div>

</ArcadeLayout>

<style>
  .big { min-height: 56px; width: 100%; font-size: 1rem; }
  .cash { background: #2fbf71; color: #062a16; animation: throb 0.9s ease-in-out infinite alternate; }
  @keyframes throb { to { box-shadow: 0 0 0 6px rgba(47, 191, 113, 0.25); } }
  .queued { background: var(--surface-2); color: var(--text); }
  .switch.mini { min-height: 36px; font-size: 0.8rem; color: var(--muted); gap: 8px; }
  .hist { display: flex; gap: 6px; overflow: hidden; margin-bottom: 10px; min-height: 30px; }
  .hist span { flex: none; padding: 5px 10px; border-radius: 999px; font-size: 0.78rem; background: var(--surface); border: 1px solid var(--line); }
  .good { color: #2fbf71; } .bad { color: var(--accent); } .gold { color: var(--gold); }
  .sky { position: relative; height: clamp(280px, 52vh, 480px); border-radius: 28px; overflow: hidden; background: #160f2e; box-shadow: 0 30px 60px -30px rgba(0,0,0,.6); }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
  .ship { position: absolute; left: 0; top: 0; width: 64px; height: 64px; pointer-events: none; will-change: transform; filter: drop-shadow(0 8px 18px rgba(0,0,0,.45)); }
  .ship.gone { opacity: 0; transition: opacity 0.15s var(--ease-snap); }
  .center { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 8px; pointer-events: none; color: #fff; text-align: center; }
  .sight { font: 600 0.78rem 'Geist Mono Variable', monospace; letter-spacing: 0.08em; text-transform: uppercase; padding: 4px 10px; border-radius: 999px; background: rgba(0,0,0,.35); color: #ffe39a; animation: sightOut 3.2s forwards; }
  @keyframes sightOut { 80% { opacity: 1; } to { opacity: 0; } }
  .center.flying { place-content: start; justify-items: start; padding: clamp(18px, 4vw, 40px) 0 0 clamp(52px, 7vw, 72px); text-align: left; }
  .eyebrow.light { color: rgba(255,255,255,.6); }
  .count { font-size: clamp(2rem, 5vw, 3.4rem); }
  .big-m { font-size: clamp(3rem, 9vw, 6.5rem); letter-spacing: -0.04em; text-shadow: 0 6px 30px rgba(0,0,0,.6); font-variant-numeric: tabular-nums; transition: color 0.4s var(--ease-snap); }
  .big-m.hot { color: #ffd27a; }
  .big-m.bad { animation: shake 0.45s var(--ease-snap); }
  @keyframes shake { 20% { transform: translateX(-8px); } 40% { transform: translateX(7px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(2px); } }
  .bar { width: 200px; height: 4px; border-radius: 4px; background: rgba(255,255,255,.15); overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--accent); transform-origin: left; }
  .players { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  .players li { display: grid; grid-template-columns: 1fr auto auto auto; gap: 10px; padding: 7px 10px; border-radius: 12px; font-size: 0.8rem; background: var(--bg-2); text-align: right; }
  .players li .pn { text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .players li.me { box-shadow: inset 0 0 0 1px var(--accent); }
  .players li.won { color: #2fbf71; }
  .players li.lost { color: var(--muted); }
</style>
