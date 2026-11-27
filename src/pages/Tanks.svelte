<script lang="ts">
  // Pappkameraden: cardboard tanks in a big box. Clear every enemy tank of a mission without being hit; 20 missions,
  // then random ones. 3 lives, one more every 5 missions. Every round starts with a countdown; when you are hit your
  // tank blows up and the round starts over. The stake grows with every cleared mission and can be cashed out between
  // missions. Training: five short lessons to try the controls. Co-op: a friend in the room drives the orange tank;
  // the host's browser runs the battle, the friend sends steering and sees snapshots. Friendly fire is on.
  import { onDestroy, onMount, untrack } from 'svelte';
  import { fly, scale, fade } from 'svelte/transition';
  import HowTo from '../components/HowTo.svelte';
  import RoomBar from '../components/RoomBar.svelte';
  import BetInput from '../components/BetInput.svelte';
  import MiniTank from '../components/MiniTank.svelte';
  import FullscreenButton, { fs, toggleFullscreen, canFullscreen } from '../components/FullscreenButton.svelte';
  import { Room } from '../lib/net.svelte';
  import { newWorld, step, cleared as isCleared, wiped, goneSlots, enemyCount, missionMap, multFor, bonusLife, lessonWorld, lessonDone, LESSONS, NAMES, AW, AH, type World, type Input, type Kind } from '../games/tanks';
  import { drawStatic, drawWorld, drawAim, drawTank } from '../lib/tankDraw';
  import { wallet, settle, stake as takeStake, fmt, settings } from '../lib/state.svelte';
  import { sfx, treads } from '../lib/sfx';

  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
  const saved = (() => { try { return JSON.parse(localStorage.getItem('betly:tanks') || '{}'); } catch { return {}; } })();
  let best = $state<number>(saved.best ?? 0);
  let fsPref = $state<boolean>(saved.fs ?? true);
  let trained = $state<boolean>(saved.trained ?? false);
  let bet = $state(10);
  $effect(() => { const s = { best, fs: fsPref, trained }; untrack(() => { try { localStorage.setItem('betly:tanks', JSON.stringify(s)); } catch {} }); });

  type Phase = 'lobby' | 'count' | 'play' | 'boom' | 'clear' | 'between' | 'over';
  const share = $state({ phase: 'lobby' as Phase, run: 0, mission: 0, lives: 3, cleared: 0, coop: false, tut: false, lesson: 0, hostPid: '', enemies: 0, left: 0, stakes: {} as Record<string, number>, cashed: false });
  let world: World | null = null;
  let gone: number[] = [];
  let phaseAt = $state(0);
  let clock = $state(0);

  // ---------- room (co-op) ----------
  let guest = $state<{ id: string; name: string; stake: number } | null>(null);
  const room = new Room('tanks', onMsg, (id) => { if (guest?.id === id) { guest = null; if (world) for (const t of world.tanks) if (t.pid === id) t.alive = false; } });
  const isHost = $derived(room.role !== 'guest');
  let guestIn: Input & { f: number; m: number } = { mx: 0, my: 0, aim: 0, fire: false, mine: false, f: 0, m: 0 };
  let seenF = 0, seenM = 0;
  let snap: any = null, prevSnap: any = null, snapAt = 0;
  function onMsg(m: any, from: string) {
    if (room.role === 'guest') {
      if (m.t === 'state') { const run = share.run, ph = share.phase; Object.assign(share, m.s); if (share.run !== run) paid = false; if (ph !== share.phase) { phaseAt = performance.now(); onPhase(); } afterState(); }
      else if (m.t === 'snap') { prevSnap = snap; snap = m.w; snapAt = performance.now(); if (m.w.grid) gridCopy = m.w.grid; for (const e of m.w.ev ?? []) sound(e); }
      return;
    }
    if (m.t === 'hello') { guest = { id: from, name: String(m.name || 'Guest').slice(0, 20), stake: Math.max(0, Math.min(100000, Number(m.stake) || 0)) }; push(); }
    else if (m.t === 'in' && from === guest?.id) guestIn = { mx: clamp(m.mx), my: clamp(m.my), aim: Number(m.aim) || 0, fire: false, mine: false, f: Number(m.f) || 0, m: Number(m.m) || 0 };
  }
  const clamp = (v: unknown) => Math.max(-1, Math.min(1, Number(v) || 0));
  function push() { if (room.role === 'host') untrack(() => room.broadcast({ t: 'state', s: $state.snapshot(share) })); }
  $effect(() => { if (room.role === 'guest' && room.status === 'open') room.send({ t: 'hello', name: settings.name, stake: bet }); });

  // ---------- running a campaign or the training (host or solo) ----------
  let stage = $state<HTMLElement>();
  function start(coop: boolean, tut = false) {
    if (!isHost || (coop && !guest) || (!tut && bet > wallet.balance)) return;
    if (fsPref) toggleFullscreen(stage, true);
    gone = [];
    Object.assign(share, { run: share.run + 1, hostPid: room.myId, mission: 0, lesson: 0, tut, lives: 3, cleared: 0, coop, cashed: false, stakes: tut ? {} : { [room.myId]: bet, ...(coop && guest ? { [guest.id]: guest.stake } : {}) } });
    paid = false;
    payStake();
    begin();
    if (!fsPref) stage?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function begin() {
    const ids = [room.myId, ...(share.coop && guest ? [guest.id] : [])];
    world = share.tut ? lessonWorld(share.lesson, room.myId) : newWorld(share.mission, ids, gone);
    share.enemies = share.tut ? world.tanks.filter((t) => t.team === 'e').length : enemyCount(missionMap(share.mission));
    share.left = world.tanks.filter((t) => t.team === 'e').length;
    sentGrid = -1;
    setPhase('count');
  }
  function setPhase(p: Phase) { share.phase = p; phaseAt = performance.now(); onPhase(); push(); }
  // countdown 3 · 2 · 1 · go, with a tick on every number
  const COUNT = 2.25;
  let lastBeat = -1;
  const beat = $derived(share.phase === 'count' ? Math.floor((clock - phaseAt) / 750) : -1);
  $effect(() => { if (beat >= 0 && beat !== lastBeat) { lastBeat = beat; untrack(() => sfx('tick')); } if (beat < 0) lastBeat = -1; });
  let goAt = $state(0);
  function onPhase() {
    if (share.phase === 'play') { goAt = performance.now(); sfx('big'); }
    if (share.phase !== 'play') hum?.set(0);
  }
  function tick(dt: number) {
    if (!world) return;
    const now = performance.now();
    if (share.phase === 'count' && now - phaseAt > COUNT * 1000) setPhase('play');
    if (share.phase === 'play') {
      const inputs: Record<string, Input> = { [room.myId]: myInput() };
      if (share.coop && guest) { inputs[guest.id] = { ...guestIn, fire: guestIn.f > seenF, mine: guestIn.m > seenM }; seenF = guestIn.f; seenM = guestIn.m; }
      step(world, dt, inputs);
      fireQueued = mineQueued = false;
      share.left = world.tanks.filter((t) => t.team === 'e' && t.alive).length;
      if (share.tut ? lessonDone(share.lesson, world) : isCleared(world)) {
        if (!share.tut) {
          share.cleared++;
          if (bonusLife(share.cleared)) { share.lives++; sfx('big'); }
          if (share.cleared > best) best = share.cleared;
        }
        setPhase('clear');
        sfx('win');
      } else if (wiped(world)) setPhase('boom');
    } else if (share.phase === 'boom' || share.phase === 'clear') step(world, dt, {}); // let the explosion play out
    if (share.phase === 'boom' && now - phaseAt > 1900) {
      if (share.tut) begin();
      else {
        share.lives--;
        gone = goneSlots(world, gone);
        if (share.lives > 0) begin(); else { setPhase('over'); afterState(); }
      }
    }
    if (share.phase === 'clear' && now - phaseAt > 2000) {
      world.shells = []; world.mines = [];
      if (share.tut && share.lesson + 1 >= LESSONS.length) { trained = true; setPhase('over'); }
      else setPhase('between');
    }
  }
  function next() {
    if (!isHost || share.phase !== 'between') return;
    if (share.tut) share.lesson++; else { share.mission++; gone = []; }
    begin();
  }
  function cashOut() {
    if (!isHost || share.phase !== 'between' || share.tut) return;
    share.cashed = true;
    setPhase('over');
    afterState();
  }
  /** Back to the lobby (training, free play, or after a campaign is over). */
  function quit() {
    if (!isHost) return;
    if (share.phase !== 'over' && !share.tut && (share.stakes[room.myId] ?? 0)) return;
    world = null; share.tut = false;
    setPhase('lobby');
    toggleFullscreen(null, false);
  }
  const value = (stakeAmt: number) => Math.round(stakeAmt * multFor(share.cleared) * 100) / 100;

  // ---------- money ----------
  let paid = false, settledRun = -1;
  function payStake() {
    const mine = share.stakes[room.myId] ?? 0;
    if (paid || !mine) { paid = true; return; }
    paid = true;
    takeStake(mine);
  }
  function afterState() {
    if (share.phase !== 'lobby' && share.phase !== 'over') payStake();
    if (share.phase === 'over' && settledRun !== share.run && paid) {
      settledRun = share.run;
      const mine = share.stakes[room.myId] ?? 0;
      if (!mine) return;
      const back = share.cashed ? value(mine) : 0;
      settle(back, back);
      sfx(back > mine ? 'big' : 'lose');
    }
  }

  // ---------- controls ----------
  const keys = new Set<string>();
  let mouse = { x: AW / 2, y: AH / 2 };
  let fireQueued = false, mineQueued = false, fireN = 0, mineN = 0;
  let joy = $state({ on: false, x: 0, y: 0 });
  let touchUi = $state(false);
  let paused = $state(false);
  function myInput(): Input {
    let mx = 0, my = 0;
    if (keys.has('a') || keys.has('arrowleft')) mx--;
    if (keys.has('d') || keys.has('arrowright')) mx++;
    if (keys.has('w') || keys.has('arrowup')) my--;
    if (keys.has('s') || keys.has('arrowdown')) my++;
    if (joy.on) { mx = joy.x; my = joy.y; }
    const me = (world?.tanks ?? []).find((t) => t.pid === room.myId) ?? snapMe();
    const aim = me ? Math.atan2(mouse.y - me.y, mouse.x - me.x) : 0;
    return { mx, my, aim, fire: fireQueued, mine: mineQueued };
  }
  const snapMe = () => snap?.tanks?.map(unpack).find((t: any) => t.pid === room.myId);
  const playing = () => share.phase !== 'lobby' && share.phase !== 'over';
  function key(e: KeyboardEvent, down: boolean) {
    if ((e.target as HTMLElement).closest('input, textarea')) return;
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k) && playing()) e.preventDefault();
    if (down) keys.add(k); else keys.delete(k);
    if (!down || e.repeat || !playing()) return;
    if (k === ' ' || k === 'k' || k === 'shift') { mineQueued = true; mineN++; }
    if (k === 'j') { fireQueued = true; fireN++; }
    if (k === 'p' && room.role === 'solo' && ['play', 'count'].includes(share.phase)) paused = !paused;
  }
  let canvas: HTMLCanvasElement;
  const toWorld = (e: PointerEvent | MouseEvent) => { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * AW, y: ((e.clientY - r.top) / r.height) * AH }; };
  function pdown(e: PointerEvent) {
    if (!playing()) return;
    mouse = toWorld(e);
    if (e.pointerType === 'touch') touchUi = true;
    if (e.button === 2) { mineQueued = true; mineN++; } else { fireQueued = true; fireN++; }
  }
  let stickEl = $state<HTMLElement>();
  function stick(e: PointerEvent) {
    if (e.type === 'pointerup' || e.type === 'pointercancel') { joy = { on: false, x: 0, y: 0 }; return; }
    if (e.type === 'pointerdown') stickEl?.setPointerCapture(e.pointerId);
    if (e.type === 'pointermove' && !joy.on) return;
    const r = stickEl!.getBoundingClientRect(), dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2), l = Math.hypot(dx, dy);
    joy = { on: true, x: l > 1 ? dx / l : dx, y: l > 1 ? dy / l : dy };
  }

  // ---------- the loop ----------
  let ctx: CanvasRenderingContext2D;
  const stat = document.createElement('canvas');
  let statFor: unknown = null, statScale = 0;
  let raf = 0, last = 0, acc = 0, lastSend = 0, sentGrid = -1, gridCopy: string[] | null = null, frames = 0;
  let hum: ReturnType<typeof treads> | null = null;
  function sound(e: string) {
    const map: Record<string, string> = { fire: 'pop', rocket: 'pump', bounce: 'bounce', pop: 'tick', boom: 'boom', kill: 'boom', lost: 'lose', mine: 'chip' };
    if (map[e]) sfx(map[e] as any);
  }
  let myMoving = false;
  function loop(ts: number) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (ts - (last || ts)) / 1000);
    last = ts;
    clock = performance.now();
    if (!ctx) return;
    if (isHost && world && !paused) {
      acc += dt;
      while (acc >= 1 / 60) { tick(1 / 60); acc -= 1 / 60; }
      const ev = world?.events.splice(0) ?? [];
      const heard = new Set<string>();
      for (const e of ev) if (!heard.has(e)) { heard.add(e); sound(e); }
      if (room.role === 'host' && share.coop && world && ts - lastSend > 50) { lastSend = ts; room.broadcast({ t: 'snap', w: pack(world, [...heard]) }); }
    }
    if (room.role === 'guest' && ts - lastSend > 33 && playing()) {
      lastSend = ts;
      const i = myInput();
      room.send({ t: 'in', mx: i.mx, my: i.my, aim: i.aim, f: fireN, m: mineN });
    }
    render();
    // soft rolling sound: mostly my own tank, a little for the others
    const w = isHost ? world : guestW;
    if (w && share.phase === 'play' && !paused) {
      hum ??= treads();
      const me = w.tanks.find((t) => t.pid === room.myId && t.alive);
      const mine = me ? (isHost ? Math.hypot(me.vx, me.vy) / 95 : myMoving ? 1 : 0) : 0;
      const others = w.tanks.filter((t) => t.alive && t !== me && (t.vx || t.vy)).length;
      hum.set(Math.min(1, mine * 0.8 + others * 0.06));
    } else hum?.set(0);
  }
  function pack(w: World, ev: string[]) {
    frames++;
    const r = (v: number) => Math.round(v * 10) / 10;
    const out: any = {
      t: r(w.t), sh: r(w.shake), tanks: w.tanks.filter((t) => t.alive).map((t) => [t.id, t.kind, t.team, r(t.x), r(t.y), r(t.body * 100) / 100, r(t.turret * 100) / 100, r(t.key), Math.round(t.seen * 10) / 10, t.pid ?? '']),
      shells: w.shells.map((s) => [r(s.x), r(s.y), r(s.vx), r(s.vy), s.rocket ? 1 : 0, s.team]), mines: w.mines.map((m) => [r(m.x), r(m.y), r(m.t)]),
      booms: w.booms.map((b) => [r(b.x), r(b.y), r(b.t), b.big ? 1 : 0]), scorch: w.scorch.slice(-30).map((s) => [r(s.x), r(s.y), s.r]),
      debris: w.debris.slice(-160).map((d) => [r(d.x), r(d.y), r(d.a), r(d.s), d.k]), ev,
    };
    const gid = w.mission * 1000 + w.grid.flat().filter((c) => c === 'c').length;
    if (gid !== sentGrid || frames % 40 === 0) { out.grid = w.grid.map((row) => row.join('')); sentGrid = gid; }
    return out;
  }
  const unpack = (a: any[]) => ({ id: a[0], kind: a[1], team: a[2], x: a[3], y: a[4], body: a[5], turret: a[6], key: a[7], seen: a[8], pid: a[9], alive: true, odo: 0, vx: 0, vy: 0 });
  const gTracks: { x: number; y: number; a: number; t: number }[] = [];
  const lastMark = new Map<number, { x: number; y: number }>();
  let guestW: World | null = null;
  function guestWorld(): World | null {
    if (!snap || !gridCopy) return null;
    const k = prevSnap ? Math.min(1, (performance.now() - snapAt) / 50) : 1;
    const before = new Map<number, any>((prevSnap?.tanks ?? []).map((a: any[]) => [a[0], unpack(a)]));
    const lerp = (a: number, b: number) => a + (b - a) * k;
    const lerpA = (a: number, b: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
    const tanks = snap.tanks.map((a: any[]) => { const t = unpack(a), p = before.get(t.id); return p ? { ...t, x: lerp(p.x, t.x), y: lerp(p.y, t.y), body: lerpA(p.body, t.body), turret: t.pid === room.myId ? t.turret : lerpA(p.turret, t.turret), vx: t.x - p.x, vy: t.y - p.y } : t; });
    for (const t of tanks) {
      const m = lastMark.get(t.id);
      if (!m || Math.hypot(m.x - t.x, m.y - t.y) > 9) { lastMark.set(t.id, { x: t.x, y: t.y }); if (m) gTracks.push({ x: t.x, y: t.y, a: t.body, t: snap.t }); }
    }
    myMoving = !!tanks.find((t: any) => t.pid === room.myId && (Math.abs(t.vx) > 0.2 || Math.abs(t.vy) > 0.2));
    if (gTracks.length > 900) gTracks.splice(0, gTracks.length - 900);
    return (guestW = {
      mission: share.mission, grid: gridCopy.map((r) => r.split('')), tanks, events: [], dirty: false, seq: 0, t: snap.t, tracks: gTracks, shake: snap.sh ?? 0, flag: null,
      shells: snap.shells.map((s: any[], i: number) => ({ id: i, x: s[0] + s[2] * (k * 0.05), y: s[1] + s[3] * (k * 0.05), vx: s[2], vy: s[3], rocket: !!s[4], team: s[5], b: 0, owner: 0, age: 1 })),
      mines: snap.mines.map((m: any[], i: number) => ({ id: i, x: m[0], y: m[1], t: m[2], owner: 0, team: 'e' })),
      booms: snap.booms.map((b: any[]) => ({ x: b[0], y: b[1], t: b[2], big: !!b[3] })), scorch: snap.scorch.map((s: any[]) => ({ x: s[0], y: s[1], r: s[2] })),
      debris: (snap.debris ?? []).map((d: any[]) => ({ x: d[0], y: d[1], a: d[2], s: d[3], k: d[4] })),
    } as World);
  }
  /** The static layer is drawn at the screen's resolution, so the cardboard stays crisp, also in full screen. */
  function ensureStatic(w: World, key: unknown) {
    if (statScale !== scaleK) { stat.width = Math.round(AW * scaleK); stat.height = Math.round(AH * scaleK); statScale = scaleK; statFor = null; }
    if (key === statFor && !w.dirty) return;
    const c = stat.getContext('2d')!;
    c.setTransform(scaleK, 0, 0, scaleK, 0, 0);
    drawStatic(c, w);
    statFor = key; w.dirty = false;
  }
  function render() {
    const w = isHost ? world : guestWorld();
    ctx.setTransform(scaleK, 0, 0, scaleK, 0, 0);
    if (!w) { drawPreview(); return; }
    ensureStatic(w, isHost ? w : JSON.stringify(w.grid));
    const orange = w.tanks.find((t) => t.team === 'p' && t.pid && t.pid !== share.hostPid);
    drawWorld(ctx, w, stat, orange?.id ?? -1);
    const me = w.tanks.find((t) => t.pid === room.myId && t.alive);
    if (me && share.phase === 'play' && !touchUi) drawAim(ctx, me, mouse.x, mouse.y);
  }
  let preview: World | null = null;
  function drawPreview() {
    preview ??= newWorld(2, ['me']);
    ensureStatic(preview, 'preview');
    preview.t += 0.016;
    for (const t of preview.tanks) t.turret = t.body + Math.sin(preview.t * 0.8 + t.id) * 0.6;
    drawWorld(ctx, preview, stat);
  }
  let boxW = $state(800);
  let scaleK = 1;
  $effect(() => {
    void boxW;
    if (!canvas) return;
    const dpr = devicePixelRatio || 1;
    canvas.width = Math.round(boxW * dpr); canvas.height = Math.round((boxW * AH) / AW * dpr);
    scaleK = canvas.width / AW;
  });
  onMount(() => { ctx = canvas.getContext('2d')!; raf = requestAnimationFrame(loop); touchUi = matchMedia('(pointer: coarse)').matches; });
  onDestroy(() => { cancelAnimationFrame(raf); hum?.stop(); room.leave(); if (fs.on) toggleFullscreen(null, false); });

  // ---------- bits for the screen ----------
  const ROSTER: [Kind, string, string][] = $derived([
    ['rust', L('Steht still, dreht langsam, schiesst selten.', 'Stands still, turns slowly, rarely fires.'), '1'],
    ['patrol', L('Fährt gemächlich Streife, einfache Schüsse.', 'Slow patrols, plain shells.'), '3'],
    ['arrow', L('Schnelle Raketen, die nicht abprallen.', 'Fast rockets that do not bounce.'), '4'],
    ['sapper', L('Legt fleissig Minen.', 'Busy laying mines.'), '5'],
    ['sniper', L('Rührt sich nicht, trifft über zwei Banden.', 'Never moves, hits off two walls.'), '6'],
    ['hunter', L('Jagt dich, zielt voraus, mehrere Schüsse.', 'Hunts you, leads its aim, several shells.'), '7'],
    ['commander', L('Schneller und klüger als der Jäger, legt Minen.', 'Faster and smarter than the hunter, lays mines.'), '10'],
    ['phantom', L('Wird unsichtbar. Achte auf die Spuren!', 'Turns invisible. Watch the tracks!'), '11'],
    ['shadow', L('Der Schnellste: Raketen, Minen, Ausweichen.', 'The fastest: rockets, mines, dodging.'), '13'],
  ]);
  let rosterOpen = $state(false);
  function modal(d: HTMLDialogElement) {
    d.showModal();
    const click = (e: MouseEvent) => { if (e.target === d) d.close(); };
    d.addEventListener('click', click);
    return { destroy: () => d.removeEventListener('click', click) };
  }
  function rosterArt(node: HTMLCanvasElement, kind: Kind) {
    const c = node.getContext('2d')!, dpr = devicePixelRatio || 1;
    node.width = 64 * dpr; node.height = 64 * dpr;
    let a = 0, id = 0;
    const draw = () => { c.setTransform(dpr * 1.25, 0, 0, dpr * 1.25, 0, 0); c.clearRect(0, 0, 64, 64); drawTank(c, { x: 25.6, y: 25.6, body: -0.5, turret: -0.5 + Math.sin(a) * 0.7, kind, key: a * 3 }); a += 0.03; id = requestAnimationFrame(draw); };
    draw();
    return { destroy: () => cancelAnimationFrame(id) };
  }
  const myStake = $derived(share.stakes[room.myId] ?? 0);
  const countNum = $derived(share.phase === 'count' ? Math.max(1, 3 - Math.floor((clock - phaseAt) / 750)) : 0);
  const showGo = $derived(share.phase === 'play' && clock - goAt < 650);
  const lesson = $derived(share.tut ? LESSONS[share.lesson] : null);
  const inGame = $derived(share.phase !== 'lobby' && share.phase !== 'over');
  const P1 = '#4f7cff';
</script>

<svelte:window onkeydown={(e) => key(e, true)} onkeyup={(e) => key(e, false)} onblur={() => keys.clear()} />

<section class="tk">
  <header class="head">
    <div class="h1row"><h1>{L('Pappkameraden', 'Cardboard Tanks')}</h1><span class="eyebrow">{share.tut ? L('Training', 'Training') : share.phase === 'lobby' ? 'Arcade' : `Mission ${share.mission + 1}`}</span><HowTo id="tanks" /></div>
    <div></div>
    <div class="right"><RoomBar {room} /></div>
  </header>

  <div class="layout">
    <aside class="panel">
      {#if !inGame}
        <div class="field">{L('Einsatz', 'Stake')}<BetInput bind:value={bet} /></div>
        {#if isHost}
          <button class="btn primary big" disabled={bet > wallet.balance} onclick={() => start(false)}>{share.phase === 'over' && !share.tut ? L('Neuer Feldzug', 'New campaign') : L('Feldzug starten', 'Start campaign')}</button>
          <button class="btn big" disabled={!guest || bet > wallet.balance} onclick={() => start(true)}>👥 {guest ? L(`Koop mit ${guest.name}`, `Co-op with ${guest.name}`) : L('Koop: Freund in den Raum holen', 'Co-op: get a friend into the room')}</button>
          <div class="row2">
            <button class="btn" onclick={() => start(false, true)}>🎯 {trained ? L('Training', 'Training') : L('Training', 'Training')}{#if !trained}<em class="new">{L('neu hier?', 'new?')}</em>{/if}</button>
            <button class="btn" onclick={() => (rosterOpen = true)}>🪖 {L('Gegner', 'Enemies')}</button>
          </div>
          {#if canFullscreen()}<label class="switch"><span>{L('Im Vollbild spielen', 'Play in full screen')}</span><input type="checkbox" bind:checked={fsPref} /></label>{/if}
        {:else}<p class="muted small">{L('Der Gastgeber startet den Koop-Feldzug. Du fährst den orangen Panzer.', 'The host starts the co-op campaign. You drive the orange tank.')}</p>{/if}
        <div class="stats"><span>{L('Rekord', 'Best')}</span><b class="mono">{best} {L('Missionen', 'missions')}</b></div>
        <div class="ladder">
          {#each [1, 3, 5, 10, 15, 20] as k}<span><small>{k}×</small><b class="mono">×{multFor(k).toFixed(2)}</b></span>{/each}
        </div>
        <small class="muted">{L('Jede geschaffte Mission erhöht deinen Gewinn. Zwischen den Missionen kannst du auszahlen. Sind alle Leben weg, ist der Einsatz verloren.', 'Every cleared mission raises your win. Cash out between missions. Lose all lives and the stake is gone.')}</small>
      {:else}
        {#if touchUi}<p class="muted small">{L('Stick unten links fährt, Tippen schiesst, 💣 legt eine Mine.', 'Stick bottom left drives, tap fires, 💣 lays a mine.')}</p>
        {:else}
          <div class="keys">
            <span><kbd>WASD</kbd> {L('fahren', 'drive')}</span><span><kbd>🖱️</kbd> {L('zielen, Klick schiesst', 'aim, click fires')}</span>
            <span><kbd>{L('Leertaste', 'Space')}</kbd> / <kbd>{L('Rechtsklick', 'Right click')}</kbd> {L('Mine', 'mine')}</span>
            {#if room.role === 'solo'}<span><kbd>P</kbd> {L('Pause', 'pause')}</span>{/if}
          </div>
        {/if}
        {#if share.tut}<button class="btn" onclick={quit}>{L('Training beenden', 'Leave training')}</button>{/if}
      {/if}
    </aside>

    <div class="stage" class:full={fs.on} bind:this={stage}>
      <div class="arena" bind:clientWidth={boxW} class:live={share.phase === 'play'}>
        <canvas bind:this={canvas} onpointerdown={pdown} onpointermove={(e) => (mouse = toWorld(e))} oncontextmenu={(e) => e.preventDefault()}></canvas>

        <div class="hud">
          {#if inGame}
            <div class="pill lives">{#if share.tut}<b>🎯 {share.lesson + 1}/{LESSONS.length}</b>{:else}{#each Array(Math.max(0, Math.min(8, share.lives))) as _, i (i)}<MiniTank color={P1} />{/each}{/if}</div>
            {#if !share.tut}<div class="pill"><small>Mission</small><b class="mono">{share.mission + 1}</b></div>{/if}
            {#if !lesson || lesson.goal === 'kill'}<div class="pill"><small>{L('Gegner', 'Enemies')}</small><b class="mono">{share.left}/{share.enemies}</b></div>{/if}
            {#if myStake}<div class="pill"><small>{L('Wert', 'Worth')}</small><b class="mono gold">{fmt(value(myStake))}</b></div>{/if}
          {/if}
          <span class="sp"></span>
          <FullscreenButton target={stage} />
        </div>

        {#if lesson && (share.phase === 'play' || share.phase === 'count')}
          <div class="lesson" in:fly={{ y: -10 }}><b>{share.lesson + 1}. {lesson[settings.lang === 'de' ? 'de' : 'en'][0]}</b><span>{lesson[settings.lang === 'de' ? 'de' : 'en'][1]}</span></div>
        {/if}
        {#if share.phase === 'count'}
          {#key countNum}<div class="count" in:scale={{ start: 1.8, duration: 400 }}>{countNum}</div>{/key}
          {#if !share.tut}<div class="sub" in:fade>Mission {share.mission + 1} · {L('Gegner', 'Enemies')} × {share.left}</div>{/if}
        {:else if showGo}
          <div class="count go" out:fade={{ duration: 200 }}>{L('Los!', 'Go!')}</div>
        {:else if share.phase === 'boom'}
          <div class="banner lose" in:scale={{ start: 0.85, duration: 450, delay: 600 }}><b>{L('Getroffen!', 'Hit!')}</b><span>{share.tut ? L('Nochmal', 'Again') : share.lives > 1 ? L(`Noch ${share.lives - 1} Leben`, `${share.lives - 1} lives left`) : L('Letztes Leben verloren', 'Last life lost')}</span></div>
        {:else if share.phase === 'clear'}
          <div class="banner win" in:scale={{ start: 0.85, duration: 450 }}><b>{share.tut ? L('Geschafft!', 'Done!') : L('Mission geschafft!', 'Mission cleared!')}</b>{#if !share.tut && bonusLife(share.cleared)}<span>+1 {L('Leben', 'life')} 🎉</span>{/if}</div>
        {:else if share.phase === 'between'}
          <div class="card" in:fly={{ y: 16 }}>
            {#if share.tut}
              <h2>{L('Lektion', 'Lesson')} {share.lesson + 1} ✓</h2>
              <p>{L('Als Nächstes:', 'Next up:')} <b>{LESSONS[share.lesson + 1][settings.lang === 'de' ? 'de' : 'en'][0]}</b></p>
              <div class="row"><button class="btn primary big" onclick={next}>{L('Weiter', 'Next')} →</button><button class="btn big" onclick={quit}>{L('Beenden', 'Stop')}</button></div>
            {:else}
              <h2>{L(`${share.cleared} ${share.cleared === 1 ? 'Mission' : 'Missionen'} geschafft`, `${share.cleared} mission${share.cleared === 1 ? '' : 's'} cleared`)}</h2>
              {#if myStake}<p>{L('Dein Einsatz ist jetzt', 'Your stake is now worth')} <b class="mono gold">{fmt(value(myStake))}</b> <small class="mono">(×{multFor(share.cleared).toFixed(2)})</small>. {L('Nächste Mission:', 'Next mission:')} <b class="mono">×{multFor(share.cleared + 1).toFixed(2)}</b></p>{/if}
              {#if isHost}
                <div class="row"><button class="btn primary big" onclick={next}>{L('Weiter zu Mission', 'On to mission')} {share.mission + 2} →</button>{#if myStake}<button class="btn big" onclick={cashOut}>💰 {L('Auszahlen', 'Cash out')} {fmt(value(myStake))}</button>{:else}<button class="btn big" onclick={quit}>{L('Aufhören', 'Stop')}</button>{/if}</div>
              {:else}<p class="muted">{L('Der Gastgeber entscheidet: weiter oder auszahlen.', 'The host decides: go on or cash out.')}</p>{/if}
            {/if}
          </div>
        {:else if share.phase === 'over'}
          <div class="card" in:fly={{ y: 16 }}>
            {#if share.tut}
              <h2>{L('Training geschafft! 🎖️', 'Training complete! 🎖️')}</h2>
              <p>{L('Du kannst fahren, zielen, über Banden schiessen und Minen legen. Bereit für den Feldzug.', 'You can drive, aim, bank shots and lay mines. Ready for the campaign.')}</p>
              {#if isHost}<div class="row"><button class="btn primary big" disabled={bet > wallet.balance} onclick={() => start(false)}>{L('Feldzug starten', 'Start campaign')}</button><button class="btn big" onclick={quit}>{L('Zur Lobby', 'To the lobby')}</button></div>{/if}
            {:else}
              <h2>{share.cashed ? L('Ausgezahlt!', 'Cashed out!') : L('Feldzug vorbei', 'Campaign over')}</h2>
              <p>{L('Geschafft:', 'Cleared:')} <b class="mono">{share.cleared}</b> {L('Missionen', 'missions')}{#if myStake} · {share.cashed ? L('Gewinn', 'Win') : L('Einsatz verloren', 'Stake lost')} <b class="mono" class:gold={share.cashed}>{share.cashed ? fmt(value(myStake)) : fmt(myStake)}</b>{/if}</p>
              {#if isHost}<div class="row"><button class="btn primary big" disabled={bet > wallet.balance} onclick={() => start(share.coop && !!guest)}>{L('Nochmal', 'Play again')}</button><button class="btn big" onclick={quit}>{L('Zur Lobby', 'To the lobby')}</button></div>{/if}
            {/if}
          </div>
        {:else if share.phase === 'lobby'}
          <div class="lobbycta">
            <b>{L('Pappkameraden', 'Cardboard Tanks')}</b>
            <span>{L('Räum jede Mission, ohne getroffen zu werden.', 'Clear every mission without being hit.')}</span>
          </div>
        {/if}
        {#if paused}<div class="banner"><b>{L('Pause', 'Paused')}</b><span>P</span></div>{/if}
        {#if touchUi && share.phase === 'play'}
          <div class="stick" bind:this={stickEl} onpointerdown={stick} onpointermove={stick} onpointerup={stick} onpointercancel={stick} role="presentation"><i style="transform: translate({joy.x * 30}px, {joy.y * 30}px)"></i></div>
          <button class="minebtn" onpointerdown={(e) => { e.stopPropagation(); mineQueued = true; mineN++; }}>💣</button>
        {/if}
      </div>
    </div>
  </div>
</section>

{#if rosterOpen}
  <dialog class="roster" use:modal onclose={() => (rosterOpen = false)}>
    <header><h2>{L('Die Gegner', 'The enemies')}</h2><button class="x" onclick={() => (rosterOpen = false)} aria-label="×">×</button></header>
    <div class="grid">
      {#each ROSTER as [k, txt, from], i}
        <div class="rc" style="--i:{i}"><canvas use:rosterArt={k}></canvas><div><b>{NAMES[k][settings.lang === 'de' ? 0 : 1]}</b><small>{txt}</small><em class="mono">{L('ab Mission', 'from mission')} {from}</em></div></div>
      {/each}
    </div>
  </dialog>
{/if}

<style>
  .tk { width: min(100%, 1400px); margin-inline: auto; padding: 0 20px 48px; display: grid; gap: 14px; }
  .head { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px 16px; padding: 12px 4px 0; min-height: 64px; }
  .right { display: flex; justify-content: flex-end; min-width: 0; }
  @media (max-width: 1100px) { .head { grid-template-columns: 1fr; } .right { justify-content: flex-start; } }
  .h1row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  h1 { margin: 0; font-size: clamp(1.7rem, 3vw, 2.4rem); letter-spacing: -0.04em; line-height: 1; }
  .muted { color: var(--muted); } .small { font-size: 0.82rem; } .gold { color: var(--gold); }
  .layout { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 18px; align-items: start; }
  @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } .panel { order: 2; } }
  .panel { display: grid; gap: 12px; padding: 16px; border-radius: 24px; background: var(--surface); box-shadow: inset 0 0 0 1px var(--line); }
  .panel > * { min-width: 0; }
  .field { display: grid; gap: 6px; font-size: 0.85rem; }
  .big { min-height: 50px; width: 100%; }
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .row2 .btn { position: relative; min-height: 44px; padding-inline: 8px; font-size: 0.85rem; }
  .new { position: absolute; top: -8px; right: -4px; font-style: normal; font-size: 0.62rem; padding: 2px 6px; border-radius: 999px; background: var(--gold); color: #2b1d05; font-weight: 700; }
  .stats { display: flex; justify-content: space-between; padding: 10px 14px; border-radius: 14px; background: var(--surface-2); font-size: 0.88rem; }
  .ladder { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .ladder span { display: grid; padding: 6px 8px; border-radius: 10px; background: var(--surface-2); }
  .ladder small { font-size: 0.68rem; color: var(--muted); }
  .ladder b { font-size: 0.88rem; color: var(--gold); }
  .keys { display: grid; gap: 6px; font-size: 0.8rem; color: var(--muted); }
  kbd { font: 600 0.68rem 'Geist Mono Variable', monospace; padding: 2px 6px; border-radius: 5px; background: var(--surface-2); color: var(--text); }

  /* the stage is what goes full screen: the box sits in the middle, as big as the screen allows */
  .stage { padding: 12px; border-radius: 26px; background: linear-gradient(160deg, #5a3f24, #2c1d10); box-shadow: inset 0 0 0 1px rgba(255,220,170,.2), 0 30px 60px -30px rgba(0,0,0,.7); }
  .stage.full { display: grid; place-items: center; padding: 0; border-radius: 0; background: radial-gradient(ellipse at 50% 40%, #3a2817, #120b05 75%); }
  .stage.full .arena { width: min(100vw - 24px, (100vh - 24px) * 800 / 560); border-radius: 10px; }
  .arena { position: relative; width: 100%; aspect-ratio: 800 / 560; border-radius: 14px; overflow: hidden; box-shadow: inset 0 0 0 3px #1a120a, 0 0 0 2px #8a6440; }
  .arena canvas { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; }
  .arena.live canvas { cursor: none; }
  .hud { position: absolute; left: 10px; right: 10px; top: 10px; display: flex; gap: 8px; align-items: center; pointer-events: none; z-index: 2; }
  .hud > :global(*) { pointer-events: auto; }
  .hud .sp { flex: 1; }
  .pill { display: flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 12px; background: rgba(26,19,13,.72); color: #f3e6cf; backdrop-filter: blur(4px); box-shadow: inset 0 0 0 1px rgba(255,220,170,.18); font-size: 0.85rem; }
  .pill small { font-size: 0.62rem; letter-spacing: 0.08em; text-transform: uppercase; color: #c9b08a; }
  .pill .gold { color: #f3d488; }
  .pill.lives { gap: 2px; padding: 3px 8px; min-height: 30px; }
  .lesson { position: absolute; left: 50%; top: 56px; translate: -50% 0; width: min(560px, 86%); display: grid; gap: 2px; padding: 10px 16px; border-radius: 14px; background: rgba(243,230,207,.96); color: #2b1d10; box-shadow: 0 12px 26px -10px rgba(0,0,0,.6); text-align: center; pointer-events: none; z-index: 2; }
  .lesson b { font-size: 1rem; } .lesson span { font-size: 0.88rem; }
  .count { position: absolute; inset: 0; display: grid; place-items: center; font: 800 clamp(5rem, 16vw, 11rem) 'Geist Variable', system-ui, sans-serif; color: #f3e6cf; text-shadow: 0 6px 0 #1a120a, 0 0 40px rgba(255,180,90,.45); pointer-events: none; -webkit-text-stroke: 3px #1a120a; }
  .count.go { color: #ffd34d; }
  .sub { position: absolute; left: 0; right: 0; bottom: 18%; text-align: center; font: 700 1.1rem 'Geist Mono Variable', monospace; color: #f3e6cf; text-shadow: 0 2px 0 #1a120a; pointer-events: none; }
  .banner { position: absolute; left: 50%; top: 50%; translate: -50% -50%; display: grid; justify-items: center; gap: 4px; padding: 16px 40px; border-radius: 14px; background: linear-gradient(180deg, #c8262c, #8f1a1e); color: #fff; box-shadow: 0 0 0 4px #f3d488, 0 20px 40px -10px rgba(0,0,0,.6); pointer-events: none; }
  .banner b { font-size: clamp(1.4rem, 3vw, 2.2rem); letter-spacing: -0.02em; }
  .banner span { font: 600 0.95rem 'Geist Mono Variable', monospace; color: #ffe9b8; }
  .banner.win { background: linear-gradient(180deg, #2fa968, #1c6e43); }
  .banner.lose { background: linear-gradient(180deg, #3a3d46, #1f2127); }
  .card { position: absolute; left: 50%; top: 50%; translate: -50% -50%; width: min(520px, 90%); display: grid; gap: 12px; padding: 22px; border-radius: 20px; background: rgba(243,230,207,.97); color: #2b1d10; box-shadow: 0 30px 60px -20px rgba(0,0,0,.7); z-index: 3; }
  .card h2 { margin: 0; letter-spacing: -0.03em; }
  .card p { margin: 0; }
  .card .gold { color: #a5740f; }
  .card .muted { color: #6b5a48; }
  .card .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .card .btn:not(.primary) { background: #fffaf0; color: #2b1d10; border-color: rgba(0,0,0,.15); }
  .lobbycta { position: absolute; left: 50%; bottom: 22px; translate: -50% 0; display: grid; justify-items: center; gap: 2px; padding: 10px 22px; border-radius: 14px; background: rgba(26,19,13,.75); color: #f3e6cf; box-shadow: inset 0 0 0 1px rgba(255,220,170,.2); text-align: center; pointer-events: none; }
  .lobbycta b { font-size: 1.2rem; }
  .lobbycta span { font-size: 0.85rem; color: #c9b08a; }
  .stick { position: absolute; left: 18px; bottom: 18px; width: 120px; height: 120px; border-radius: 50%; background: rgba(243,230,207,.12); box-shadow: inset 0 0 0 2px rgba(243,230,207,.4); display: grid; place-items: center; touch-action: none; z-index: 3; }
  .stick i { width: 52px; height: 52px; border-radius: 50%; background: rgba(243,230,207,.85); box-shadow: 0 4px 10px rgba(0,0,0,.3); }
  .minebtn { position: absolute; right: 18px; bottom: 18px; width: 72px; height: 72px; border-radius: 50%; border: 0; background: rgba(245,217,10,.9); font-size: 1.8rem; box-shadow: 0 6px 14px rgba(0,0,0,.35); z-index: 3; }
  .minebtn:active { transform: scale(0.92); }

  .roster { width: min(820px, calc(100vw - 24px)); max-height: 86dvh; padding: 0; border: 0; border-radius: 22px; background: #2a2018; color: #f3e6cf; box-shadow: 0 40px 80px -20px rgba(0,0,0,.7), inset 0 0 0 1px rgba(255,220,170,.2); }
  .roster::backdrop { background: rgba(0,0,0,.55); backdrop-filter: blur(4px); }
  .roster[open] { animation: pop 0.45s var(--spring-snappy); }
  @keyframes pop { from { opacity: 0; transform: translateY(10px) scale(0.97); } }
  .roster header { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px 8px; }
  .roster h2 { margin: 0; letter-spacing: -0.03em; }
  .roster .x { width: 36px; height: 36px; border-radius: 50%; border: 1px solid rgba(255,220,170,.3); background: none; color: inherit; font-size: 1.3rem; }
  .roster .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; padding: 8px 20px 20px; }
  .rc { display: flex; gap: 8px; align-items: center; padding: 8px 10px; border-radius: 14px; background: rgba(243,230,207,.95); color: #2b1d10; animation: rise 0.45s var(--spring-snappy) calc(var(--i) * 50ms) backwards; }
  .rc canvas { width: 52px; height: 52px; flex: none; border-radius: 10px; background: #2a2018; }
  .rc div { display: grid; gap: 1px; min-width: 0; }
  .rc b { font-size: 0.92rem; }
  .rc small { font-size: 0.74rem; color: #5b4a38; line-height: 1.25; }
  .rc em { font-style: normal; font-size: 0.62rem; color: #8a6a3a; }
  @keyframes rise { from { opacity: 0; transform: translateY(10px); } }
  @media (prefers-reduced-motion: reduce) { .rc, .roster[open] { animation: none; } }
</style>
