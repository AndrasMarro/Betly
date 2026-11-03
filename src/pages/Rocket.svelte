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
  const stars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.4 + 0.3 }));

  function draw() {
    const now = performance.now();
    left = Math.max(0, betEnd - now);
    const sec = share.phase === 'fly' ? (now - flyStart) / 1000 : share.phase === 'boom' ? secAt(share.crash) : 0;
    live = share.phase === 'boom' ? share.crash : share.phase === 'fly' ? multAt(sec) : 1;
    eng?.set(live);
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      const dpr = devicePixelRatio || 1, W = box.w, H = box.h;
      if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // stars drift faster as the rocket speeds up
      const speed = share.phase === 'fly' ? 0.02 + Math.log(live) * 0.05 : 0.004;
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      for (const s of stars) {
        s.y = (s.y + speed * s.r * 0.05) % 1;
        ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, 7); ctx.fill();
      }
      const pad = 36, xmax = Math.max(10, sec * 1.15), ymax = Math.max(2, live * 1.18);
      const X = (s: number) => pad + (s / xmax) * (W - pad * 2);
      const Y = (m: number) => H - pad - ((m - 1) / (ymax - 1)) * (H - pad * 2);
      // grid
      ctx.strokeStyle = 'rgba(255,255,255,.07)';
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ctx.font = '11px "Geist Mono Variable", monospace';
      const stepM = ymax > 20 ? 10 : ymax > 6 ? 2 : ymax > 3 ? 1 : 0.5;
      for (let m = 1; m <= ymax; m += stepM) {
        ctx.beginPath(); ctx.moveTo(pad, Y(m)); ctx.lineTo(W - pad, Y(m)); ctx.stroke();
        ctx.fillText(m.toFixed(m % 1 ? 1 : 0) + '×', 4, Y(m) + 4);
      }
      if (share.phase !== 'bet') {
        ctx.beginPath();
        ctx.moveTo(X(0), Y(1));
        const n = 80;
        for (let i = 1; i <= n; i++) { const s = (sec * i) / n; ctx.lineTo(X(s), Y(multAt(s))); }
        ctx.lineWidth = 4;
        ctx.strokeStyle = share.phase === 'boom' ? 'rgba(255,255,255,.35)' : accent;
        ctx.shadowColor = accent;
        ctx.shadowBlur = share.phase === 'boom' ? 0 : 16;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.lineTo(X(sec), H - pad); ctx.lineTo(X(0), H - pad); ctx.closePath();
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, share.phase === 'boom' ? 'rgba(255,255,255,.05)' : accent + '55');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fill();
        const dx = X(sec) - X(sec * 0.97), dy = Y(multAt(sec)) - Y(multAt(sec * 0.97));
        rocket = { x: X(sec), y: Y(live), rot: 90 + (Math.atan2(dy, dx) * 180) / Math.PI };
      } else rocket = { x: X(0), y: Y(1), rot: 45 };
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
    <div class="ship" class:gone={share.phase === 'boom'} style="left:{rocket.x}px; top:{rocket.y}px; rotate:{rocket.rot}deg">
      <Sprite kind="rocket" />
    </div>
    {#if share.phase === 'boom'}
      <div class="boom" style="left:{rocket.x}px; top:{rocket.y}px" in:scale={{ start: 0.2, duration: 350 }}><Sprite kind="boom" /></div>
    {/if}
    <div class="center">
      {#if share.phase === 'bet'}
        <span class="eyebrow light">{t('rk.starts')}</span>
        <strong class="mono count">{(left / 1000).toFixed(1)}s</strong>
        <div class="bar"><i style="transform: scaleX({left / BET_MS})"></i></div>
      {:else if share.phase === 'fly'}
        <strong class="mono big-m">{live.toFixed(2)}×</strong>
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
  .sky { position: relative; height: clamp(260px, 50vh, 460px); border-radius: 28px; overflow: hidden; background: radial-gradient(ellipse at 70% 0%, #24204a, #0a0918 70%); }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
  .ship { position: absolute; width: 56px; height: 56px; translate: -50% -50%; pointer-events: none; filter: drop-shadow(0 0 12px rgba(255,180,80,.5)); }
  .ship.gone { opacity: 0; transition: opacity 0.2s; }
  .boom { position: absolute; width: 110px; height: 110px; translate: -50% -50%; pointer-events: none; }
  .center { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 8px; pointer-events: none; color: #fff; text-align: center; }
  .eyebrow.light { color: rgba(255,255,255,.6); }
  .count { font-size: clamp(2rem, 5vw, 3.4rem); }
  .big-m { font-size: clamp(3rem, 9vw, 6.5rem); letter-spacing: -0.04em; text-shadow: 0 6px 30px rgba(0,0,0,.6); }
  .bar { width: 200px; height: 4px; border-radius: 4px; background: rgba(255,255,255,.15); overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--accent); transform-origin: left; }
  .players { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  .players li { display: grid; grid-template-columns: 1fr auto auto auto; gap: 10px; padding: 7px 10px; border-radius: 12px; font-size: 0.8rem; background: var(--bg-2); text-align: right; }
  .players li .pn { text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .players li.me { box-shadow: inset 0 0 0 1px var(--accent); }
  .players li.won { color: #2fbf71; }
  .players li.lost { color: var(--muted); }
</style>
