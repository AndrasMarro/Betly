<script lang="ts">
  import FullscreenButton, { fs } from '../components/FullscreenButton.svelte';
  import { onDestroy, onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { newWorld, ensure, update, hit, logAt, blocked, warning, multAt, coinShare, COLS, MIN_STAKE, MAX_STAKE, BONUS_EVERY, BONUS, HOP_UP, BREAK, SINK, type World, type Lane, type Item } from '../games/crossy';
  import HowTo from '../components/HowTo.svelte';
  import { settle, stake as takeStake, credit, wallet, settings, fmt } from '../lib/state.svelte';
  import { isDaily as daily } from '../lib/daily';
  import { sfx } from '../lib/sfx';
  import { pop } from '../lib/motion';
  import { t } from '../lib/i18n';
  import { art, coinShape, drawGround, drawRow, drawDuck as paintDuck } from '../games/crossyDraw';
  type Dir = 'up' | 'down' | 'left' | 'right';

  let best = $state(+(localStorage.getItem('betly:crossy') || 0));
  let runBest = 0, recordPaid = false; // the record at the start of this run; its line pays a coin once
  let phase = $state<'ready' | 'play' | 'dead'>('ready');
  let score = $state(0);
  let cause = $state<'car' | 'water' | 'train' | 'eagle' | 'log' | 'cash' | ''>('');
  let reward = $state(0);
  // stake mode: capped bet, multiplier grows with steps (+30 % at every 50), coins pay back part of the stake
  let betAmt = $state(50);
  let staked = $state(0);
  let coinsGot = $state(0);
  let lastLog: Item | null = null;
  let flash = $state<{ text: string; id: number; big?: boolean } | null>(null);
  const mult = $derived(multAt(score));

  let world: World;
  const P = { x: 5, row: 0, fromX: 5, fromRow: 0, hop: 1, face: 'up' as Dir, onLog: false, deadT: 0 };
  let cam = 0, camMin = 0, shake = 0, runT = 0;
  let queued: Dir | null = null;
  type Bit = { x: number; y: number; vx: number; vy: number; life: number; c: string };
  let bits: Bit[] = [];

  function reset() {
    world = newWorld(Math.random);
    Object.assign(P, { x: 5, row: 2, fromX: 5, fromRow: 2, hop: 1, face: 'up', onLog: false, deadT: 0 });
    cam = 0; camMin = 0; shake = 0; runT = 0; bits = []; queued = null;
    score = 0; cause = ''; reward = 0; staked = 0; coinsGot = 0; flash = null;
    runBest = best; recordPaid = false;
  }
  reset();

  function move(d: Dir) {
    if (phase === 'dead') return;
    if (phase === 'ready') {
      // every run is played for credits: no stake, no reward
      const amt = Math.min(MAX_STAKE, Math.floor(wallet.balance), Math.max(MIN_STAKE, Math.round(betAmt)));
      if (amt < MIN_STAKE) { bump(); return; }
      staked = amt;
      takeStake(amt);
      phase = 'play';
    }
    if (P.hop < 1) { queued = d; return; }
    P.face = d;
    let tx = P.x, tr = P.row;
    if (d === 'up') tr++;
    if (d === 'down') tr--;
    if (d === 'left') tx--;
    if (d === 'right') tx++;
    ensure(world, tr + 30);
    const target = world.lanes[tr];
    // land on whole cells except on rivers, where you keep riding your offset
    if ((d === 'up' || d === 'down') && (target?.type !== 'river' || target.pads)) tx = Math.round(tx);
    // hopping forward or back from a log near the edge pulls you back onto the board instead of blocking
    if (d === 'up' || d === 'down') tx = Math.max(-0.3, Math.min(COLS - 0.7, tx));
    if (tr < 0 || tx < -0.3 || tx > COLS - 0.7 || blocked(target, Math.round(tx)) || tr < Math.floor(cam) - 1) { bump(); return; }
    P.fromX = P.x; P.fromRow = P.row; P.x = tx; P.row = tr; P.hop = 0; P.onLog = false;
    sfx('hop');
  }
  function bump() { shake = Math.max(shake, 0.12); }

  function die(c: typeof cause) {
    if (phase !== 'play') return;
    phase = 'dead';
    cause = c;
    P.deadT = 0;
    shake = 0.45;
    sfx(c === 'water' ? 'bounce' : c === 'train' ? 'boom' : 'splat');
    if (c === 'water') burst('#bfe8ff', 18);
    if (c === 'car' || c === 'train') burst('#ffd23f', 22);
    if (c === 'log') burst('#a8703f', 18);
    reward = coinsGot;
    settle(0, 0);
    if (score > best) { best = score; localStorage.setItem('betly:crossy', String(best)); }
  }
  function cashOut() {
    if (phase !== 'play' || !staked || P.hop < 1) return;
    phase = 'dead';
    cause = 'cash';
    P.deadT = 0;
    const win = Math.round(staked * mult * 100) / 100;
    settle(win, win);
    reward = win + coinsGot;
    sfx('cash');
    if (score > best) { best = score; localStorage.setItem('betly:crossy', String(best)); }
  }
  function show(text: string, big = false) { flash = { text, id: performance.now(), big }; }
  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
  function burst(c: string, n: number) {
    for (let i = 0; i < n; i++) bits.push({ x: P.x + 0.5, y: P.row + 0.5, vx: (Math.random() - 0.5) * 6, vy: Math.random() * 6, life: 0.6 + Math.random() * 0.5, c });
  }

  const KEYS: Record<string, Dir> = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  function key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    if (KEYS[e.code]) { e.preventDefault(); if (!e.repeat) move(KEYS[e.code]); return; }
    if (e.code === 'Enter' && phase === 'play' && staked) { e.preventDefault(); cashOut(); return; }
    if ((e.code === 'Space' || e.code === 'Enter') && phase === 'dead' && P.deadT > 0.6) { e.preventDefault(); reset(); phase = 'ready'; }
    else if (e.code === 'Space') e.preventDefault();
  }
  let touch: { x: number; y: number } | null = null;
  function pdown(e: PointerEvent) { touch = { x: e.clientX, y: e.clientY }; }
  function pup(e: PointerEvent) {
    if (!touch) return;
    const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
    touch = null;
    if (phase === 'dead') { if (P.deadT > 0.6) { reset(); phase = 'ready'; } return; }
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return move('up'); // tap = hop forward
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  }
  let coarse = $state(false);

  // ---------- loop ----------
  let canvas: HTMLCanvasElement;
  let wrap = $state<HTMLDivElement>()!;
  let W = $state(640), H = $state(720);
  let fit = () => {};
  $effect(() => { void fs.on; requestAnimationFrame(() => fit()); });
  let raf = 0, last = performance.now(), clock = 0, warnTick = 0;
  onMount(() => {
    coarse = matchMedia('(pointer: coarse)').matches;
    fit = () => {
      // full screen: as big as the screen allows, keeping the shape
      if (fs.on) { const h = innerHeight - 24; W = Math.round(Math.min(wrap.clientWidth - 24, h / 1.15)); H = Math.round(Math.min(W * 1.15, h)); return; }
      W = Math.min(wrap.clientWidth, 760);
      const top = wrap.getBoundingClientRect().top + scrollY;
      H = Math.round(Math.max(340, Math.min(W * 1.15, innerHeight - top - (coarse ? 150 : 20))));
    };
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    fit();
    raf = requestAnimationFrame(loop);
    return () => ro.disconnect();
  });
  onDestroy(() => cancelAnimationFrame(raf));

  function loop(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;
    art.clock = clock;
    const rows = Math.ceil(H / (W / COLS)) + 2;
    // the whole world speeds up the longer you survive
    const pace = Math.min(2, 1 + runT / 70);
    update(world, dt, Math.floor(cam) - 2, Math.floor(cam) + rows, pace);
    if (P.hop < 1) {
      P.hop = Math.min(1, P.hop + dt / 0.11);
      if (P.hop === 1) {
        land();
        if (queued) { const q = queued; queued = null; move(q); }
      }
    }
    if (phase === 'play') {
      runT += dt;
      const lane = world.lanes[P.row];
      if (P.onLog && lane.type === 'river') {
        P.x += lane.dir * lane.speed * pace * dt;
        P.fromX = P.x;
        const it = logAt(lane, P.x);
        if (P.x < -0.55 || P.x > COLS - 0.45) die('water'); // only once the duck's middle leaves the screen
        else if (!it) die(lastLog?.gone ? 'log' : 'water');
        else { if (it.weak && it.breakT === undefined) { it.breakT = 0; sfx('tick'); } lastLog = it; }
      }
      // collisions use where the duck visibly is, not where it is heading
      const vx = P.fromX + (P.x - P.fromX) * P.hop;
      const here = world.lanes[P.hop < 0.5 ? P.fromRow : P.row];
      if (here && hit(here, vx)) die(here.type === 'rail' ? 'train' : 'car');
      // the screen keeps creeping forward, faster over time; fall behind and the eagle takes you
      const pressure = Math.min(1.1, 0.25 + runT / 240 + score / 400);
      camMin += pressure * dt;
      if (P.row < camMin - 0.6) die('eagle');
      // train warnings for rails on screen
      warnTick -= dt;
      if (warnTick <= 0) {
        for (let r = Math.floor(cam); r < cam + rows; r++) {
          const l = world.lanes[r];
          if (l && warning(l) && !l.train) { sfx('tick'); warnTick = 0.28; break; }
        }
      }
    }
    if (phase === 'dead') P.deadT += dt;
    const target = Math.max(camMin, P.row - 3);
    cam += (target - cam) * Math.min(1, dt * 6);
    camMin = Math.max(camMin, cam - 0.01);
    shake = Math.max(0, shake - dt);
    for (const b of bits) { b.x += b.vx * dt; b.y += b.vy * dt; b.vy -= 12 * dt; b.life -= dt; }
    bits = bits.filter((b) => b.life > 0);
    draw(rows);
    raf = requestAnimationFrame(loop);
  }

  function land() {
    if (phase !== 'play') return;
    const lane = world.lanes[P.row];
    if (lane.type === 'river') {
      const log = logAt(lane, P.x);
      if (!log) { die('water'); return; }
      // a near miss at the end of a log counts: step the duck fully onto it
      P.x = P.fromX = Math.max(log.x - 0.1, Math.min(log.x + log.len - 0.9, P.x));
      if (log.weak && log.breakT === undefined) { log.breakT = 0; sfx('tick'); }
      lastLog = log;
      P.onLog = true;
    }
    if (lane.coin !== null && lane.type !== 'river' && Math.round(P.x) === lane.coin) {
      lane.coin = null;
      const amt = Math.round(staked * coinShare(P.row) * 100) / 100;
      credit(amt);
      coinsGot += amt;
      sfx('cash');
      show('+' + fmt(amt));
      for (let i = 0; i < 14; i++) bits.push({ x: P.x + 0.5, y: P.row + 0.5, vx: (Math.random() - 0.5) * 5, vy: 2 + Math.random() * 5, life: 0.5 + Math.random() * 0.4, c: '#ffd23f' });
    }
    if (P.row - 2 > score) {
      score = P.row - 2;
      if (score % BONUS_EVERY === 0) {
        const pct = Math.round((HOP_UP ** (score / BONUS_EVERY) - 1) * 100);
        show(L('Reihe ' + score + ' · ×' + BONUS + ' · +' + pct + ' % pro Hop', 'Row ' + score + ' · ×' + BONUS + ' · +' + pct + ' % per hop'), true);
        sfx('big');
      }
      // passing the old record pays a record coin (10 % of the stake) once per run
      if (runBest > 0 && score === runBest + 1 && !recordPaid) {
        recordPaid = true;
        const amt = Math.round(staked * 0.1 * 100) / 100;
        credit(amt);
        coinsGot += amt;
        show(L('Neuer Rekord! +', 'New record! +') + fmt(amt), true);
        sfx('cash');
        for (let i = 0; i < 20; i++) bits.push({ x: P.x + 0.5, y: P.row + 0.5, vx: (Math.random() - 0.5) * 6, vy: 2 + Math.random() * 6, life: 0.6 + Math.random() * 0.5, c: '#ffd23f' });
      }
    }
  }

  // ---------- drawing: oblique voxel look ----------
  function draw(rows: number) {
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const dpr = devicePixelRatio || 1, C = W / COLS;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sx = shake > 0 ? (Math.random() - 0.5) * shake * 18 : 0, sy = shake > 0 ? (Math.random() - 0.5) * shake * 18 : 0;
    ctx.translate(sx, sy);
    const Y = (row: number) => H - (row - cam + 1) * C; // top of a row's footprint
    const lo = Math.floor(cam) - 2, hi = Math.floor(cam) + rows;
    ensure(world, hi + 2);
    // ground
    for (let r = hi; r >= lo; r--) {
      const l = world.lanes[r], y = Y(r);
      if (!l) { ctx.fillStyle = '#6fbf4a'; ctx.fillRect(0, y, W, C + 1); continue; }
      drawGround(ctx, l, r, y, W, C, world.lanes[r + 1]?.type === 'road');
    }
    // objects, far rows first so nearer things overlap them; the duck is drawn with its row
    const vx = P.fromX + (P.x - P.fromX) * P.hop;
    const vrow = P.fromRow + (P.row - P.fromRow) * P.hop;
    for (let r = hi; r >= lo; r--) {
      const l = world.lanes[r];
      if (!l) continue;
      const y = Y(r);
      // your record from earlier runs: a dashed golden line with a trophy coin
      if (runBest > 0 && r === runBest + 2) drawRecord(ctx, y, C, recordPaid);
      drawRow(ctx, l, r, y, C);
      if (Math.round(vrow) === r) drawDuck(ctx, vx, vrow, C, Y);
    }
    for (const b of bits) { ctx.globalAlpha = Math.max(0, b.life * 1.6); ctx.fillStyle = b.c; ctx.fillRect(b.x * C - 3, Y(b.y) - 3, 6, 6); }
    ctx.globalAlpha = 1;
    // the edge that swallows you: a darkening band at the bottom
    const g = ctx.createLinearGradient(0, H - C * 1.4, 0, H);
    g.addColorStop(0, 'rgba(10,8,20,0)'); g.addColorStop(1, 'rgba(10,8,20,.55)');
    ctx.fillStyle = g; ctx.fillRect(0, H - C * 1.4, W, C * 1.4);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawRecord(ctx: CanvasRenderingContext2D, y: number, C: number, taken: boolean) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,214,90,.9)'; ctx.lineWidth = Math.max(2, C * 0.06); ctx.setLineDash([C * 0.3, C * 0.2]);
    ctx.beginPath(); ctx.moveTo(0, y + C); ctx.lineTo(W, y + C); ctx.stroke();
    ctx.setLineDash([]);
    const tx = C * 0.15, ty = y + C * 0.55;
    ctx.fillStyle = 'rgba(20,16,4,.6)'; ctx.beginPath(); ctx.roundRect(tx, ty - C * 0.3, C * 2.4, C * 0.5, C * 0.25); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.font = `700 ${Math.round(C * 0.28)}px Geist Mono Variable, monospace`; ctx.textAlign = 'left';
    ctx.fillText(L('Rekord ', 'Best ') + runBest, tx + C * 0.18, ty + C * 0.05);
    if (!taken) coinShape(ctx, W / 2, y + C * 0.5 + Math.sin(clock * 3) * C * 0.05, C * 0.6, 1);
    ctx.restore();
  }
  function drawDuck(ctx: CanvasRenderingContext2D, vx: number, vrow: number, C: number, Y: (r: number) => number) {
    const cx = vx * C + C / 2, base = Y(vrow) + C * 0.8;
    const lift = P.hop < 1 ? Math.sin(P.hop * Math.PI) * C * 0.4 : 0;
    let sxk = 1, syk = 1, alpha = 1;
    if (phase === 'dead') {
      if (cause === 'car' || cause === 'train') { syk = 0.25; sxk = 1.5; }
      if (cause === 'water') { alpha = Math.max(0, 1 - P.deadT * 1.6); syk = Math.max(0.2, 1 - P.deadT); }
      if (cause === 'eagle') { alpha = Math.max(0, 1 - P.deadT * 1.2); }
    } else if (P.hop < 1) { syk = 1 + Math.sin(P.hop * Math.PI) * 0.12; sxk = 1 - Math.sin(P.hop * Math.PI) * 0.08; }
    // a soft contact shadow under the feet that shrinks while airborne
    const air = P.hop < 1 ? Math.sin(P.hop * Math.PI) : 0;
    ctx.fillStyle = `rgba(0,0,0,${0.32 - air * 0.14})`;
    ctx.beginPath(); ctx.ellipse(cx, base - C * 0.06, C * 0.2 * (1 - air * 0.35), C * 0.07 * (1 - air * 0.35), 0, 0, 7); ctx.fill();
    // squash and stretch around the feet
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, base - lift); ctx.scale(sxk, syk); ctx.translate(-cx, -base);
    paintDuck(ctx, cx, base, C, P.face);
    ctx.restore();
  }

  const isDaily = daily('crossy');
  if (import.meta.env.DEV) (window as any).__cr = { jump(r: number) { ensure(world, r + 40); P.row = P.fromRow = r; cam = camMin = r - 3; for (const l of world.lanes) if (l.type === 'rail') l.t = 1; }, world: () => world };
</script>

<svelte:window onkeydown={key} />

<section class="wrap page">
  <header class="head">
    <div>
      <p class="eyebrow">Arcade · {t('cr.eyebrow')}{#if isDaily}<span class="daily">{t('daily.badge')}</span>{/if}</p>
      <h1>Retro Crossy Run</h1>
    </div>
    <div class="tools">
      <div class="score"><span class="eyebrow">{t('cr.score')}</span><strong class="mono">{score}</strong></div>
      <div class="score"><span class="eyebrow">{t('sn.best')}</span><strong class="mono">{best}</strong></div>
      <HowTo id="crossy" />
    </div>
  </header>

  <!-- stake bar: choose before the run, cash out during it -->
  <div class="bar">
    {#if phase === 'play' && staked}
      <span class="m"><span class="eyebrow">×</span><strong class="mono">{mult.toFixed(2)}</strong></span>
      <span class="m"><span class="eyebrow">{t('cr.next')}</span><strong class="mono">{BONUS_EVERY - (score % BONUS_EVERY)}</strong></span>
      <button class="btn primary cash" onclick={cashOut}>{t('a.cashout')} <span class="mono">{fmt(Math.round(staked * mult * 100) / 100)}</span>{#if !coarse}<kbd>Enter</kbd>{/if}</button>
    {:else if phase !== 'play'}
      <span class="lbl">{t('a.bet')}</span>
      <div class="amts" role="radiogroup">
        {#each [MIN_STAKE, 50, 100, 250, MAX_STAKE] as a}<button class:on={betAmt === a} disabled={a > wallet.balance} onclick={() => (betAmt = a)}>{a}</button>{/each}
      </div>
      <span class="hint">{wallet.balance < MIN_STAKE ? t('notEnough') : t('cr.stakeHint')}</span>
    {/if}
  </div>

  <div class="stage" class:full={fs.on} bind:this={wrap}>
    <span class="fsb"><FullscreenButton target={wrap} /></span>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="screen" style="width:{W}px; height:{H}px" onpointerdown={pdown} onpointerup={pup}>
      <canvas bind:this={canvas} style="width:{W}px; height:{H}px"></canvas>
      {#if flash}{#key flash.id}<span class="flash mono" class:big={flash.big} in:fly={{ y: 16, duration: 260 }}>{flash.text}</span>{/key}{/if}
      {#if phase === 'ready'}
        <div class="overlay soft" in:fly={{ y: 10, duration: 250 }}>
          <strong>{t('cr.ready')}</strong>
          <span>{coarse ? t('cr.touch') : t('cr.keys')}</span>
        </div>
      {:else if phase === 'dead'}
        <div class="overlay" in:fly={{ y: 10, duration: 300, delay: 250 }}>
          <span class="eyebrow light">{t(('cr.' + cause) as any)}</span>
          <strong class="mono big">{score}</strong>
          {#if staked && cause !== 'cash'}<span class="mono minus">−{fmt(staked)}</span>{/if}
          {#if reward}<span class="mono plus" in:pop={{ delay: 400 }}>+{fmt(reward)} Credits{#if cause === 'cash'} · ×{mult.toFixed(2)}{/if}</span>{/if}
          <span>{coarse ? t('cr.again.touch') : t('cr.again')}</span>
        </div>
      {/if}
    </div>
    {#if coarse}
      <div class="pad">
        <button aria-label="up" onclick={() => move('up')}>▲</button>
        <button aria-label="left" onclick={() => move('left')}>◀</button>
        <button aria-label="down" onclick={() => move('down')}>▼</button>
        <button aria-label="right" onclick={() => move('right')}>▶</button>
      </div>
    {/if}
  </div>
</section>

<style>
  .page { padding-bottom: 60px; }
  .head { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 12px; padding: 22px 0 14px; }
  h1 { margin: 6px 0 0; font-size: clamp(2rem, 4.6vw, 3.2rem); letter-spacing: -0.04em; line-height: 0.95; }
  .daily { margin-left: 10px; padding: 3px 8px; border-radius: 999px; background: var(--gold); color: #1d1505; letter-spacing: 0.06em; }
  .tools { display: flex; align-items: center; gap: 14px; }
  .score { display: grid; gap: 2px; justify-items: end; }
  .score strong { font-size: 1.4rem; }
  .stage { position: relative; display: grid; justify-items: center; gap: 12px; }
  .stage.full { place-content: center; background: radial-gradient(ellipse at 50% 30%, #1d3a2a, #07120c 80%); }
  .fsb { position: absolute; top: 10px; right: 10px; z-index: 5; }
  .stage:not(.full) .fsb { right: max(10px, calc(50% - 380px + 10px)); }
  .screen { position: relative; border-radius: 24px; overflow: hidden; box-shadow: 0 0 0 1px var(--line-2), 0 40px 80px -30px rgba(0,0,0,.7); touch-action: none; user-select: none; }
  canvas { display: block; }
  .overlay { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 8px; text-align: center; color: #fff; background: rgba(12, 10, 24, 0.55); backdrop-filter: blur(3px); padding: 20px; }
  .overlay.soft { backdrop-filter: none; background: linear-gradient(transparent 40%, rgba(12,10,24,.6)); place-content: end center; padding-bottom: 12%; }
  .overlay strong { font-size: clamp(1.4rem, 4vw, 2.2rem); letter-spacing: -0.03em; text-shadow: 0 2px 0 rgba(0,0,0,.3); }
  .overlay .big { font-size: clamp(3rem, 10vw, 5rem); }
  .overlay span { color: rgba(255,255,255,.85); }
  .eyebrow.light { color: #ffd23f; }
  .plus { color: #8ff0bf !important; font-size: 1.1rem; }
  .bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px 16px; min-height: 52px; margin: 0 auto 10px; max-width: 760px; }
  .amts { display: flex; gap: 4px; padding: 3px; border-radius: 999px; border: 1px solid var(--line-2); }
  .amts button { border: 0; background: none; min-width: 44px; height: 32px; border-radius: 999px; font: 500 0.8rem 'Geist Mono Variable', monospace; }
  .amts button.on { background: var(--text); color: var(--bg); }
  .amts button:disabled { opacity: 0.35; }
  .hint { font-size: 0.78rem; color: var(--muted); }
  .lbl { font-size: 0.88rem; }
  .m { display: grid; justify-items: center; gap: 2px; }
  .m strong { font-size: 1.2rem; }
  .cash { min-height: 46px; background: #2fbf71; color: #062a16; gap: 10px; }
  .cash kbd { font: 500 0.68rem 'Geist Mono Variable', monospace; opacity: 0.6; border: 1px solid rgba(0,0,0,.25); border-radius: 4px; padding: 0 4px; }
  .flash { position: absolute; left: 50%; top: 14%; translate: -50% 0; padding: 6px 14px; border-radius: 999px; background: #ffd23f; color: #3a2a06; font-weight: 700; pointer-events: none; animation: fl 1.4s forwards; box-shadow: 0 8px 20px rgba(0,0,0,.3); }
  .flash.big { top: 30%; font-size: 1.1rem; padding: 10px 20px; animation-duration: 2.6s; box-shadow: 0 0 0 3px rgba(255,255,255,.6), 0 12px 30px rgba(0,0,0,.35); }
  @keyframes fl { 70% { opacity: 1; } to { opacity: 0; transform: translateY(-14px); } }
  .minus { color: #ff9a9d !important; }
  .pad { display: grid; grid-template-columns: repeat(3, 68px); grid-template-rows: repeat(2, 58px); gap: 6px; }
  .pad button { border: 0; border-radius: 16px; background: var(--surface-2); color: var(--text); font-size: 1.2rem; touch-action: manipulation; }
  .pad button:active { background: var(--line-2); }
  .pad button:nth-child(1) { grid-column: 2; }
  .pad button:nth-child(2) { grid-column: 1; grid-row: 2; }
  .pad button:nth-child(3) { grid-column: 2; grid-row: 2; }
  .pad button:nth-child(4) { grid-column: 3; grid-row: 2; }
</style>
