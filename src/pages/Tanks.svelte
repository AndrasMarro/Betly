<script lang="ts">
  // Blechbüchsen: wind-up tin tanks. Clear every enemy tank of a mission without being hit; 20 missions, then it
  // goes on with random ones. 3 lives, one more every 5 missions. The stake grows with every cleared mission and
  // can be cashed out between missions. Co-op: a friend joins the room and drives the orange tank; the host's
  // browser runs the battle, the friend sends steering and sees snapshots. Friendly fire is on.
  import { onDestroy, onMount, untrack } from 'svelte';
  import { fly, scale } from 'svelte/transition';
  import HowTo from '../components/HowTo.svelte';
  import RoomBar from '../components/RoomBar.svelte';
  import BetInput from '../components/BetInput.svelte';
  import { Room } from '../lib/net.svelte';
  import { newWorld, step, cleared as isCleared, wiped, goneSlots, enemyCount, missionMap, multFor, bonusLife, SPEC, NAMES, AW, AH, type World, type Input, type Kind } from '../games/tanks';
  import { drawStatic, drawWorld, drawAim, drawTank } from '../lib/tankDraw';
  import { wallet, settle, stake as takeStake, fmt, settings } from '../lib/state.svelte';
  import { sfx } from '../lib/sfx';

  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
  const saved = (() => { try { return JSON.parse(localStorage.getItem('betly:tanks') || '{}'); } catch { return {}; } })();
  let best = $state<number>(saved.best ?? 0);
  let bet = $state(10);
  const save = () => { try { localStorage.setItem('betly:tanks', JSON.stringify({ best })); } catch {} };

  type Phase = 'lobby' | 'intro' | 'play' | 'clear' | 'dead' | 'between' | 'over';
  const share = $state({ phase: 'lobby' as Phase, run: 0, mission: 0, lives: 3, cleared: 0, coop: false, hostPid: '', enemies: 0, left: 0, stakes: {} as Record<string, number>, cashed: false });
  let world: World | null = null;
  let gone: number[] = [];
  let phaseAt = 0;

  // ---------- room (co-op) ----------
  let guest = $state<{ id: string; name: string; stake: number } | null>(null);
  const room = new Room('tanks', onMsg, (id) => { if (guest?.id === id) { guest = null; if (world) for (const t of world.tanks) if (t.pid === id) t.alive = false; } });
  const isHost = $derived(room.role !== 'guest');
  let guestIn: Input & { f: number; m: number } = { mx: 0, my: 0, aim: 0, fire: false, mine: false, f: 0, m: 0 };
  let seenF = 0, seenM = 0;
  // the guest's copy of the battle
  let snap: any = null, prevSnap: any = null, snapAt = 0;
  function onMsg(m: any, from: string) {
    if (room.role === 'guest') {
      if (m.t === 'state') { const run = share.run; Object.assign(share, m.s); if (share.run !== run) paid = false; afterState(); }
      else if (m.t === 'snap') { prevSnap = snap; snap = m.w; snapAt = performance.now(); if (m.w.grid) gridCopy = m.w.grid; for (const e of m.w.ev ?? []) sound(e); }
      return;
    }
    if (m.t === 'hello') { guest = { id: from, name: String(m.name || 'Guest').slice(0, 20), stake: Math.max(0, Math.min(100000, Number(m.stake) || 0)) }; push(); }
    else if (m.t === 'in' && from === guest?.id) {
      guestIn = { mx: clamp(m.mx), my: clamp(m.my), aim: Number(m.aim) || 0, fire: false, mine: false, f: Number(m.f) || 0, m: Number(m.m) || 0 };
    }
  }
  const clamp = (v: unknown) => Math.max(-1, Math.min(1, Number(v) || 0));
  function push() { if (room.role === 'host') untrack(() => room.broadcast({ t: 'state', s: $state.snapshot(share) })); }
  $effect(() => { if (room.role === 'guest' && room.status === 'open') room.send({ t: 'hello', name: settings.name, stake: bet }); });

  // ---------- running a campaign (host or solo) ----------
  function start(coop: boolean) {
    if (!isHost || (coop && !guest) || bet > wallet.balance) return;
    gone = [];
    Object.assign(share, { run: share.run + 1, hostPid: room.myId, mission: 0, lives: 3, cleared: 0, coop, cashed: false, stakes: { [room.myId]: bet, ...(coop && guest ? { [guest.id]: guest.stake } : {}) } });
    paid = false;
    payStake();
    begin();
    canvas?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function begin() {
    const ids = [room.myId, ...(share.coop && guest ? [guest.id] : [])];
    world = newWorld(share.mission, ids, gone);
    share.enemies = enemyCount(missionMap(share.mission)) ;
    share.left = world.tanks.filter((t) => t.team === 'e').length;
    setPhase('intro');
    sentGrid = -1;
    sfx('shuffle');
  }
  function setPhase(p: Phase) { share.phase = p; phaseAt = performance.now(); push(); }
  function tick(dt: number) {
    if (!world) return;
    const now = performance.now();
    if (share.phase === 'intro' && now - phaseAt > 2200) setPhase('play');
    if (share.phase === 'play') {
      const inputs: Record<string, Input> = { [room.myId]: myInput() };
      if (share.coop && guest) {
        inputs[guest.id] = { ...guestIn, fire: guestIn.f > seenF, mine: guestIn.m > seenM };
        seenF = guestIn.f; seenM = guestIn.m;
      }
      step(world, dt, inputs);
      fireQueued = mineQueued = false;
      share.left = world.tanks.filter((t) => t.team === 'e' && t.alive).length;
      if (isCleared(world)) {
        share.cleared++;
        if (bonusLife(share.cleared)) { share.lives++; sfx('big'); }
        if (share.cleared > best) { best = share.cleared; save(); }
        setPhase('clear');
        sfx('win');
      } else if (wiped(world)) {
        share.lives--;
        gone = goneSlots(world, gone);
        setPhase(share.lives > 0 ? 'dead' : 'over');
        if (share.lives <= 0) afterState();
      }
    } else if (share.phase === 'clear' || share.phase === 'dead') step(world, dt, {}); // let explosions finish
    if (share.phase === 'clear' && now - phaseAt > 2400) { world.shells = []; world.mines = []; setPhase('between'); }
    if (share.phase === 'dead' && now - phaseAt > 2400) begin();
  }
  function next() {
    if (!isHost || share.phase !== 'between') return;
    share.mission++; gone = [];
    begin();
  }
  function cashOut() {
    if (!isHost || share.phase !== 'between') return;
    share.cashed = true;
    setPhase('over');
    afterState();
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
  function key(e: KeyboardEvent, down: boolean) {
    if ((e.target as HTMLElement).closest('input, textarea')) return;
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k) && share.phase !== 'lobby') e.preventDefault();
    if (down) keys.add(k); else keys.delete(k);
    if (down && !e.repeat && (k === ' ' || k === 'k' || k === 'shift')) { mineQueued = true; mineN++; }
    if (down && !e.repeat && k === 'j') { fireQueued = true; fireN++; }
    if (down && (k === 'p' || k === 'escape') && room.role === 'solo' && ['play', 'intro'].includes(share.phase)) paused = !paused;
  }
  let canvas: HTMLCanvasElement;
  const toWorld = (e: PointerEvent | MouseEvent) => { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * AW, y: ((e.clientY - r.top) / r.height) * AH }; };
  function pdown(e: PointerEvent) {
    if (share.phase === 'lobby') return;
    mouse = toWorld(e);
    if (e.pointerType === 'touch') touchUi = true;
    if (e.button === 2) { mineQueued = true; mineN++; } else { fireQueued = true; fireN++; }
  }
  // the on-screen stick for phones
  let stickEl = $state<HTMLElement>();
  function stick(e: PointerEvent) {
    if (e.type === 'pointerup' || e.type === 'pointercancel') { joy = { on: false, x: 0, y: 0 }; return; }
    if (e.type === "pointerdown") stickEl?.setPointerCapture(e.pointerId);
    if (e.type === 'pointermove' && !joy.on) return;
    const r = stickEl!.getBoundingClientRect(), dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2), l = Math.hypot(dx, dy);
    joy = { on: true, x: l > 1 ? dx / l : dx, y: l > 1 ? dy / l : dy };
  }

  // ---------- the loop ----------
  let ctx: CanvasRenderingContext2D;
  const stat = document.createElement('canvas');
  stat.width = AW; stat.height = AH;
  let statFor: any = null;
  let raf = 0, last = 0, acc = 0, lastSend = 0, sentGrid = -1, gridCopy: string[] | null = null, frames = 0;
  function sound(e: string) {
    const map: Record<string, string> = { fire: 'pop', rocket: 'pump', bounce: 'bounce', pop: 'tick', boom: 'boom', kill: 'boom', lost: 'lose', mine: 'chip' };
    if (map[e]) sfx(map[e] as any);
  }
  function loop(ts: number) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (ts - (last || ts)) / 1000);
    last = ts;
    if (!ctx) return;
    if (isHost && world && !paused) {
      acc += dt;
      while (acc >= 1 / 60) { tick(1 / 60); acc -= 1 / 60; }
      const ev = world.events.splice(0);
      const heard = new Set<string>();
      for (const e of ev) if (!heard.has(e)) { heard.add(e); sound(e); }
      // co-op: send a snapshot about 20 times a second
      if (room.role === 'host' && share.coop && ts - lastSend > 50) {
        lastSend = ts;
        room.broadcast({ t: 'snap', w: pack(world, [...heard]) });
      }
    }
    if (room.role === 'guest' && ts - lastSend > 33 && share.phase !== 'lobby') {
      lastSend = ts;
      const i = myInput();
      room.send({ t: 'in', mx: i.mx, my: i.my, aim: i.aim, f: fireN, m: mineN });
    }
    render();
  }
  /** Compact snapshot for the guest: positions rounded, grid only when it changed. */
  function pack(w: World, ev: string[]) {
    frames++;
    const r = (v: number) => Math.round(v * 10) / 10;
    const out: any = {
      t: r(w.t), tanks: w.tanks.filter((t) => t.alive).map((t) => [t.id, t.kind, t.team, r(t.x), r(t.y), r(t.body * 100) / 100, r(t.turret * 100) / 100, r(t.key), Math.round(t.seen * 10) / 10, t.pid ?? '']),
      shells: w.shells.map((s) => [r(s.x), r(s.y), r(s.vx), r(s.vy), s.rocket ? 1 : 0]), mines: w.mines.map((m) => [r(m.x), r(m.y), r(m.t)]),
      booms: w.booms.map((b) => [r(b.x), r(b.y), r(b.t), b.big ? 1 : 0]), scorch: w.scorch.slice(-30).map((s) => [r(s.x), r(s.y), s.r]), ev,
    };
    const gid = w.mission * 1000 + w.grid.flat().filter((c) => c === 'c').length;
    if (gid !== sentGrid || frames % 40 === 0) { out.grid = w.grid.map((row) => row.join('')); sentGrid = gid; }
    return out;
  }
  const unpack = (a: any[]) => ({ id: a[0], kind: a[1], team: a[2], x: a[3], y: a[4], body: a[5], turret: a[6], key: a[7], seen: a[8], pid: a[9], alive: true, odo: 0 });
  /** The guest builds a drawable world from the last two snapshots (smoothed in between). */
  const gTracks: { x: number; y: number; a: number; t: number }[] = [];
  const lastMark = new Map<number, { x: number; y: number }>();
  function guestWorld(): World | null {
    if (!snap || !gridCopy) return null;
    const k = prevSnap ? Math.min(1, (performance.now() - snapAt) / 50) : 1;
    const before = new Map<number, any>((prevSnap?.tanks ?? []).map((a: any[]) => [a[0], unpack(a)]));
    const lerp = (a: number, b: number) => a + (b - a) * k;
    const lerpA = (a: number, b: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
    const tanks = snap.tanks.map((a: any[]) => { const t = unpack(a), p = before.get(t.id); return p ? { ...t, x: lerp(p.x, t.x), y: lerp(p.y, t.y), body: lerpA(p.body, t.body), turret: t.pid === room.myId ? t.turret : lerpA(p.turret, t.turret) } : t; });
    // tread marks are made here from the tank positions (they are not sent)
    for (const t of tanks) {
      const m = lastMark.get(t.id);
      if (!m || Math.hypot(m.x - t.x, m.y - t.y) > 9) { lastMark.set(t.id, { x: t.x, y: t.y }); if (m) gTracks.push({ x: t.x, y: t.y, a: t.body, t: snap.t }); }
    }
    if (gTracks.length > 900) gTracks.splice(0, gTracks.length - 900);
    return {
      mission: share.mission, grid: gridCopy.map((r) => r.split('')), tanks, events: [], dirty: false, seq: 0, t: snap.t, tracks: gTracks,
      shells: snap.shells.map((s: any[], i: number) => ({ id: i, x: s[0] + s[2] * (k * 0.05), y: s[1] + s[3] * (k * 0.05), vx: s[2], vy: s[3], rocket: !!s[4], b: 0, owner: 0, team: 'e', age: 1 })),
      mines: snap.mines.map((m: any[], i: number) => ({ id: i, x: m[0], y: m[1], t: m[2], owner: 0, team: 'e' })),
      booms: snap.booms.map((b: any[]) => ({ x: b[0], y: b[1], t: b[2], big: !!b[3] })), scorch: snap.scorch.map((s: any[]) => ({ x: s[0], y: s[1], r: s[2] })),
    } as World;
  }
  function render() {
    const w = isHost ? world : guestWorld();
    if (!w) { drawPreview(); return; }
    const key = isHost ? (w.dirty ? null : statFor) : JSON.stringify(w.grid);
    if (key === null || key !== statFor || (isHost && w.dirty)) { drawStatic(stat.getContext('2d')!, w); statFor = isHost ? w : key; if (isHost) w.dirty = false; }
    ctx.setTransform(scaleK, 0, 0, scaleK, 0, 0);
    const orange = w.tanks.find((t) => t.team === 'p' && t.pid && t.pid !== share.hostPid);
    drawWorld(ctx, w, stat, orange?.id ?? -1);
    const me = w.tanks.find((t) => t.pid === room.myId && t.alive);
    if (me && share.phase === 'play' && !touchUi) drawAim(ctx, me, mouse.x, mouse.y);
  }
  // the lobby shows mission 1 with its tanks standing still
  let preview: World | null = null;
  function drawPreview() {
    if (!preview) { preview = newWorld(0, ['me']); drawStatic(stat.getContext('2d')!, preview); statFor = 'preview'; }
    if (statFor !== 'preview') { drawStatic(stat.getContext('2d')!, preview); statFor = 'preview'; }
    ctx.setTransform(scaleK, 0, 0, scaleK, 0, 0);
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
  onDestroy(() => { cancelAnimationFrame(raf); room.leave(); });

  // ---------- lobby bits ----------
  const ROSTER: [Kind, string, string][] = $derived([
    ['rust', L('Steht still, dreht langsam, schiesst selten.', 'Stands still, turns slowly, rarely fires.'), '1'],
    ['patrol', L('Fährt gemächlich Streife, einfache Schüsse.', 'Slow patrols, plain shells.'), '3'],
    ['arrow', L('Schnelle Raketen, die nicht abprallen.', 'Fast rockets that do not bounce.'), '4'],
    ['sapper', L('Legt fleissig Minen.', 'Busy laying mines.'), '5'],
    ['hunter', L('Jagt dich, zielt voraus, mehrere Schüsse.', 'Hunts you, leads its aim, several shells.'), '7'],
    ['sniper', L('Rührt sich nicht, trifft über zwei Banden.', 'Never moves, hits off two walls.'), '6'],
    ['commander', L('Schneller und klüger als der Jäger, legt Minen.', 'Faster and smarter than the hunter, lays mines.'), '10'],
    ['phantom', L('Wird unsichtbar. Achte auf die Spuren!', 'Turns invisible. Watch the tracks!'), '11'],
    ['shadow', L('Der Schnellste: Raketen, Minen, Ausweichen.', 'The fastest: rockets, mines, dodging.'), '13'],
  ]);
  function rosterArt(node: HTMLCanvasElement, kind: Kind) {
    const c = node.getContext('2d')!, dpr = devicePixelRatio || 1;
    node.width = 64 * dpr; node.height = 64 * dpr;
    let a = 0, id = 0;
    const draw = () => { c.setTransform(dpr * 1.25, 0, 0, dpr * 1.25, 0, 0); c.clearRect(0, 0, 64, 64); drawTank(c, { x: 25.6, y: 25.6, body: -0.5, turret: -0.5 + Math.sin(a) * 0.7, kind, key: a * 3, odo: 0 }); a += 0.03; id = requestAnimationFrame(draw); };
    draw();
    return { destroy: () => cancelAnimationFrame(id) };
  }
  const myStake = $derived(share.stakes[room.myId] ?? 0);
  const lifeIcons = $derived(Array(Math.max(0, Math.min(9, share.lives))));
</script>

<svelte:window onkeydown={(e) => key(e, true)} onkeyup={(e) => key(e, false)} onblur={() => keys.clear()} />

<section class="tk">
  <header class="head">
    <div class="h1row"><h1>{L('Blechbüchsen', 'Tin Tanks')}</h1><span class="eyebrow">{share.phase === 'lobby' ? (share.coop ? 'Koop' : 'Arcade') : `Mission ${share.mission + 1}`}</span><HowTo id="tanks" /></div>
    <div></div>
    <div class="right"><RoomBar {room} /></div>
  </header>

  <div class="layout">
    <aside class="panel">
      {#if share.phase === 'lobby' || share.phase === 'over'}
        <div class="field">{L('Einsatz', 'Stake')}<BetInput bind:value={bet} /></div>
        {#if isHost}
          <button class="btn primary big" disabled={bet > wallet.balance} onclick={() => start(false)}>{share.phase === 'over' ? L('Neuer Feldzug', 'New campaign') : L('Feldzug starten', 'Start campaign')}</button>
          <button class="btn big" disabled={!guest || bet > wallet.balance} onclick={() => start(true)}>👥 {guest ? L(`Koop mit ${guest.name}`, `Co-op with ${guest.name}`) : L('Koop: Freund in den Raum holen', 'Co-op: get a friend into the room')}</button>
        {:else}<p class="muted small">{L('Der Gastgeber startet den Koop-Feldzug. Du fährst den orangen Panzer.', 'The host starts the co-op campaign. You drive the orange tank.')}</p>{/if}
        <div class="stats"><span>{L('Rekord', 'Best')}</span><b class="mono">{best} {L('Missionen', 'missions')}</b></div>
        <div class="ladder">
          {#each [1, 3, 5, 10, 15, 20] as k}<span><small>{k}×</small><b class="mono">×{multFor(k).toFixed(2)}</b></span>{/each}
        </div>
        <small class="muted">{L('Jede geschaffte Mission erhöht deinen Gewinn. Zwischen den Missionen kannst du auszahlen. Sind alle Leben weg, ist der Einsatz verloren.', 'Every cleared mission raises your win. Cash out between missions. Lose all lives and the stake is gone.')}</small>
      {:else}
        <div class="hud2">
          <div><small>{L('Leben', 'Lives')}</small><span class="lives">{#each lifeIcons as _}<i></i>{/each}</span></div>
          <div><small>{L('Gegner', 'Enemies')}</small><b class="mono">{share.left} / {share.enemies}</b></div>
          <div><small>{L('Geschafft', 'Cleared')}</small><b class="mono">{share.cleared}</b></div>
          {#if myStake}<div><small>{L('Wert jetzt', 'Worth now')}</small><b class="mono gold">{fmt(value(myStake))}</b></div>{/if}
        </div>
        {#if touchUi}<p class="muted small">{L('Stick unten links fährt, Tippen schiesst, 💣 legt eine Mine.', 'Stick bottom left drives, tap fires, 💣 lays a mine.')}</p>{:else}
        <div class="keys">
          <span><kbd>WASD</kbd> {L('fahren', 'drive')}</span><span><kbd>🖱️</kbd> {L('zielen, Klick schiesst', 'aim, click fires')}</span>
          <span><kbd>{L('Leertaste', 'Space')}</kbd> / <kbd>{L('Rechtsklick', 'Right click')}</kbd> {L('Mine', 'mine')}</span>{#if room.role === 'solo'}<span><kbd>P</kbd> {L('Pause', 'pause')}</span>{/if}
        </div>{/if}
      {/if}
    </aside>

    <div class="arena-wrap">
      <div class="arena" bind:clientWidth={boxW} class:live={share.phase === 'play'}>
        <canvas bind:this={canvas} onpointerdown={pdown} onpointermove={(e) => (mouse = toWorld(e))} oncontextmenu={(e) => e.preventDefault()}></canvas>
        {#if share.phase === 'lobby'}
          <div class="veil">
            <div class="roster">
              {#each ROSTER as [k, txt, from], i}
                <div class="rc" style="--i:{i}"><canvas use:rosterArt={k}></canvas><div><b>{NAMES[k][settings.lang === 'de' ? 0 : 1]}</b><small>{txt}</small><em class="mono">{L('ab Mission', 'from mission')} {from}</em></div></div>
              {/each}
            </div>
          </div>
        {:else if share.phase === 'intro'}
          <div class="banner" in:scale={{ start: 0.85, duration: 450 }}><b>Mission {share.mission + 1}</b><span>{L('Gegner', 'Enemies')} × {share.left}</span></div>
        {:else if share.phase === 'clear'}
          <div class="banner win" in:scale={{ start: 0.85, duration: 450 }}><b>{L('Mission geschafft!', 'Mission cleared!')}</b>{#if bonusLife(share.cleared)}<span>+1 {L('Leben', 'life')} 🎉</span>{/if}</div>
        {:else if share.phase === 'dead'}
          <div class="banner lose" in:scale={{ start: 0.85, duration: 450 }}><b>{L('Getroffen!', 'Hit!')}</b><span>{L('Noch', 'Lives left:')} {share.lives} {L('Leben', '')}</span></div>
        {:else if share.phase === 'between'}
          <div class="card" in:fly={{ y: 16 }}>
            <h2>{L(`${share.cleared} ${share.cleared === 1 ? 'Mission' : 'Missionen'} geschafft`, `${share.cleared} mission${share.cleared === 1 ? '' : 's'} cleared`)}</h2>
            {#if myStake}<p>{L('Dein Einsatz ist jetzt', 'Your stake is now worth')} <b class="mono gold">{fmt(value(myStake))}</b> <small class="mono">(×{multFor(share.cleared).toFixed(2)})</small>. {L('Nächste Mission:', 'Next mission:')} <b class="mono">×{multFor(share.cleared + 1).toFixed(2)}</b></p>{/if}
            {#if isHost}
              <div class="row"><button class="btn primary big" onclick={next}>{L('Weiter zu Mission', 'On to mission')} {share.mission + 2} →</button>{#if myStake}<button class="btn big" onclick={cashOut}>💰 {L('Auszahlen', 'Cash out')} {fmt(value(myStake))}</button>{/if}</div>
            {:else}<p class="muted">{L('Der Gastgeber entscheidet: weiter oder auszahlen.', 'The host decides: go on or cash out.')}</p>{/if}
          </div>
        {:else if share.phase === 'over'}
          <div class="card" in:fly={{ y: 16 }}>
            <h2>{share.cashed ? L('Ausgezahlt!', 'Cashed out!') : L('Feldzug vorbei', 'Campaign over')}</h2>
            <p>{L('Geschafft:', 'Cleared:')} <b class="mono">{share.cleared}</b> {L('Missionen', 'missions')}{#if myStake} · {share.cashed ? L('Gewinn', 'Win') : L('Einsatz verloren', 'Stake lost')} <b class="mono" class:gold={share.cashed}>{share.cashed ? fmt(value(myStake)) : fmt(myStake)}</b>{/if}</p>
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

<style>
  .tk { width: min(100%, 1400px); margin-inline: auto; padding: 0 20px 48px; display: grid; gap: 14px; }
  .head { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px 16px; padding: 12px 4px 0; min-height: 64px; }
  .right { display: flex; justify-content: flex-end; min-width: 0; }
  @media (max-width: 1100px) { .head { grid-template-columns: 1fr; } .right { justify-content: flex-start; } }
  .h1row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  h1 { margin: 0; font-size: clamp(1.7rem, 3vw, 2.4rem); letter-spacing: -0.04em; line-height: 1; }
  .muted { color: var(--muted); } .small { font-size: 0.82rem; } .gold { color: var(--gold); }
  .layout { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 18px; align-items: start; }
  .panel > * { min-width: 0; }
  @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } .panel { order: 2; } }
  .panel { display: grid; gap: 14px; padding: 16px; border-radius: 24px; background: var(--surface); box-shadow: inset 0 0 0 1px var(--line); }
  .field { display: grid; gap: 6px; font-size: 0.85rem; }
  .big { min-height: 50px; width: 100%; }
  .stats { display: flex; justify-content: space-between; padding: 10px 14px; border-radius: 14px; background: var(--surface-2); font-size: 0.88rem; }
  .ladder { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .ladder span { display: grid; padding: 6px 8px; border-radius: 10px; background: var(--surface-2); }
  .ladder small { font-size: 0.68rem; color: var(--muted); }
  .ladder b { font-size: 0.88rem; color: var(--gold); }
  .hud2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .hud2 div { display: grid; gap: 2px; padding: 10px 12px; border-radius: 14px; background: var(--surface-2); }
  .hud2 small { font-size: 0.7rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
  .lives { display: flex; gap: 4px; flex-wrap: wrap; min-height: 18px; }
  .lives i { width: 18px; height: 13px; border-radius: 4px; background: linear-gradient(#5b7fe8, #25409c); box-shadow: inset 0 -3px 0 #1d2f70; animation: pop 0.4s var(--spring-snappy); }
  @keyframes pop { from { transform: scale(0.4); } }
  .keys { display: grid; gap: 6px; font-size: 0.8rem; color: var(--muted); }
  kbd { font: 600 0.68rem 'Geist Mono Variable', monospace; padding: 2px 6px; border-radius: 5px; background: var(--surface-2); color: var(--text); }

  .arena-wrap { padding: 12px; border-radius: 26px; background: linear-gradient(160deg, #6b4a2b, #3f2a17); box-shadow: inset 0 0 0 1px rgba(255,220,170,.25), 0 30px 60px -30px rgba(0,0,0,.7); }
  .arena { position: relative; width: 100%; aspect-ratio: 800 / 560; border-radius: 14px; overflow: hidden; box-shadow: inset 0 0 0 3px #2a1a0c; }
  .arena canvas { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; }
  .arena.live canvas { cursor: none; }
  .veil { position: absolute; inset: 0; display: grid; place-items: center; padding: 16px; background: linear-gradient(rgba(20,14,8,.25), rgba(20,14,8,.55)); }
  .roster { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; width: min(760px, 100%); }
  @media (max-width: 700px) { .roster { grid-template-columns: 1fr 1fr; } .rc small { display: none; } }
  .rc { display: flex; gap: 8px; align-items: center; padding: 8px 10px; border-radius: 14px; background: rgba(255,250,238,.92); color: #2b2a3a; box-shadow: 0 8px 18px -10px rgba(0,0,0,.6); animation: rise 0.5s var(--spring-snappy) calc(var(--i) * 60ms) backwards; }
  .rc canvas { position: static; width: 48px; height: 48px; flex: none; }
  .rc div { display: grid; gap: 1px; min-width: 0; }
  .rc b { font-size: 0.9rem; }
  .rc small { font-size: 0.72rem; color: #5b5a68; line-height: 1.25; }
  .rc em { font-style: normal; font-size: 0.62rem; color: #8a6a3a; }
  @keyframes rise { from { opacity: 0; transform: translateY(10px); } }
  .banner { position: absolute; left: 50%; top: 50%; translate: -50% -50%; display: grid; justify-items: center; gap: 4px; padding: 16px 40px; border-radius: 14px; background: linear-gradient(180deg, #c8262c, #8f1a1e); color: #fff; box-shadow: 0 0 0 4px #f3d488, 0 20px 40px -10px rgba(0,0,0,.6); pointer-events: none; }
  .banner b { font-size: clamp(1.4rem, 3vw, 2.2rem); letter-spacing: -0.02em; }
  .banner span { font: 600 0.95rem 'Geist Mono Variable', monospace; color: #ffe9b8; }
  .banner.win { background: linear-gradient(180deg, #2fa968, #1c6e43); }
  .banner.lose { background: linear-gradient(180deg, #3a3d46, #1f2127); }
  .card { position: absolute; left: 50%; top: 50%; translate: -50% -50%; width: min(520px, 90%); display: grid; gap: 12px; padding: 22px; border-radius: 20px; background: rgba(255,250,238,.97); color: #2b2a3a; box-shadow: 0 30px 60px -20px rgba(0,0,0,.7); }
  .card h2 { margin: 0; letter-spacing: -0.03em; }
  .card p { margin: 0; }
  .card .gold { color: #a5740f; }
  .card .muted { color: #6b6a78; }
  .card .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .card .btn:not(.primary) { background: #fff; color: #2b2a3a; border-color: rgba(0,0,0,.15); }
  .stick { position: absolute; left: 18px; bottom: 18px; width: 120px; height: 120px; border-radius: 50%; background: rgba(30,20,10,.25); box-shadow: inset 0 0 0 2px rgba(255,255,255,.4); display: grid; place-items: center; touch-action: none; }
  .stick i { width: 52px; height: 52px; border-radius: 50%; background: rgba(255,255,255,.8); box-shadow: 0 4px 10px rgba(0,0,0,.3); }
  .minebtn { position: absolute; right: 18px; bottom: 18px; width: 72px; height: 72px; border-radius: 50%; border: 0; background: rgba(245,217,10,.9); font-size: 1.8rem; box-shadow: 0 6px 14px rgba(0,0,0,.35); }
  .minebtn:active { transform: scale(0.92); }
  @media (prefers-reduced-motion: reduce) { .rc, .lives i { animation: none; } }
</style>
