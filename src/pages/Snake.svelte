<script lang="ts">
  import { drawApple } from '../games/snakeDraw';
  import { onDestroy, onMount, untrack } from 'svelte';
  import { fly } from 'svelte/transition';
  import ArcadeLayout from '../components/ArcadeLayout.svelte';
  import BetInput from '../components/BetInput.svelte';
  import { newSnake, step, multiplier, factor, dailyMods, DEFAULT_MODS, MOD_FACTOR, HUNGER, TICK_MS, PER_POINT, OPPOSITE, type Snake, type Dir, type Mods, type Pt } from '../games/snake';
  import { rng, today } from '../lib/daily';
  import { wallet, settle, stake as takeStake, fmt } from '../lib/state.svelte';
  import { byId, gameName } from '../lib/games';
  import { sfx } from '../lib/sfx';
  import { pop } from '../lib/motion';
  import { t, type Key } from '../lib/i18n';

  // ---------- settings (remembered) ----------
  const saved = (() => { try { return JSON.parse(localStorage.getItem('betly:snake') || '{}'); } catch { return {}; } })();
  let mods = $state<Mods>({ ...DEFAULT_MODS, ...saved.mods });
  let paid = $state<boolean>(saved.paid ?? true);
  let bet = $state(10);
  let mode = $state<'free' | 'daily'>('free');
  const stored = { free: 0, day: 0, daily: 0, ...saved.best };
  let best = $state<{ free: number; day: number; daily: number }>(stored.day === today() ? stored : { ...stored, day: today(), daily: 0 });
  $effect(() => { try { localStorage.setItem('betly:snake', JSON.stringify({ mods, paid, best })); } catch {} });

  const DAY = today();
  const DAILY = dailyMods(rng(DAY * 13 + 1));
  const active = $derived(mode === 'daily' ? DAILY : mods);
  const perPoint = $derived(Math.round(PER_POINT * factor(active, mode === 'daily') * 1000) / 1000);

  // ---------- game state ----------
  let phase = $state<'idle' | 'play' | 'over' | 'cashed'>('idle');
  let game: Snake = newSnake(DEFAULT_MODS, Math.random);
  let prev: Pt[] = game.body.map((p) => ({ ...p }));
  let rand = Math.random;
  let queue: Dir[] = [];
  let points = $state(0);
  let mult = $state(0);
  let staked = $state(0);
  let result = $state(0);
  let isDaily = false;
  // preview the chosen board while not playing
  $effect(() => {
    const m = $state.snapshot(active) as Mods;
    untrack(() => { if (phase !== 'play') { game = newSnake(m, Math.random); prev = game.body.map((p) => ({ ...p })); } });
  });

  function start() {
    if (phase === 'play') return;
    const m = $state.snapshot(active) as Mods;
    isDaily = mode === 'daily';
    staked = paid ? bet : 0;
    if (staked > wallet.balance) return;
    if (staked) takeStake(staked);
    rand = isDaily ? rng(DAY * 101) : Math.random;
    game = newSnake(m, rand);
    prev = game.body.map((p) => ({ ...p }));
    queue = [];
    points = 0; mult = 0; result = 0;
    phase = 'play';
    acc = 0;
    sfx('click');
  }
  function cashOut() {
    if (phase !== 'play') return;
    result = Math.round(staked * mult * 100) / 100;
    if (staked) settle(result, result);
    record();
    phase = 'cashed';
    sfx(result > staked ? 'cash' : 'stop');
  }
  function die() {
    phase = 'over';
    result = 0;
    if (staked) settle(0, 0);
    record();
    sfx('boom');
  }
  function record() {
    if (isDaily) best.daily = Math.max(best.daily, points);
    else best.free = Math.max(best.free, points);
  }

  function turn(d: Dir) {
    if (phase !== 'play') return;
    if (game.mods.mirror) d = OPPOSITE[d]; // mirrored controls
    const last = queue.at(-1) ?? game.dir;
    if (d === last || d === OPPOSITE[last] || queue.length >= 3) return;
    queue.push(d);
  }
  const KEYS: Record<string, Dir> = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  function key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    if (KEYS[e.code]) { if (phase === 'play') { e.preventDefault(); turn(KEYS[e.code]); } return; }
    if (e.code === 'Space') { e.preventDefault(); if (phase !== 'play') start(); }
    if (e.code === 'Enter' && phase === 'play') { e.preventDefault(); cashOut(); }
  }
  // swipe on the board
  let touchStart: { x: number; y: number } | null = null;
  function down(e: PointerEvent) { touchStart = { x: e.clientX, y: e.clientY }; }
  function up(e: PointerEvent) {
    if (!touchStart) return;
    const dx = e.clientX - touchStart.x, dy = e.clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  }
  let coarse = $state(false);
  onMount(() => (coarse = matchMedia('(pointer: coarse)').matches));

  // ---------- loop ----------
  let canvas: HTMLCanvasElement;
  let wrap: HTMLDivElement;
  let size = $state(480);
  let raf = 0, last = performance.now(), acc = 0, clock = 0;
  let bg: HTMLCanvasElement | null = null, bgKey = '';
  onMount(() => {
    const ro = new ResizeObserver(() => { if (wrap) size = Math.floor(Math.min(wrap.clientWidth, 680)); });
    ro.observe(wrap);
    raf = requestAnimationFrame(loop);
    return () => ro.disconnect();
  });
  onDestroy(() => cancelAnimationFrame(raf));

  function loop(now: number) {
    const dt = Math.min(100, now - last);
    last = now;
    clock += dt / 1000;
    // a touch faster as the snake grows
    const tick = TICK_MS[game.mods.speed] * Math.max(0.72, 1 - game.body.length * 0.004);
    if (phase === 'play') {
      acc += dt;
      while (acc >= tick && phase === 'play') {
        acc -= tick;
        prev = game.body.map((p) => ({ ...p }));
        const r = step(game, queue.shift() ?? game.dir, rand);
        if (r === 'eat') { points = game.points; mult = multiplier(game, isDaily); sfx('gem'); }
        if (r === 'poison') { points = game.points; mult = multiplier(game, isDaily); sfx('lose'); }
        if (r === 'dead') die();
      }
    }
    draw(phase === 'play' ? Math.min(1, acc / tick) : 1);
    raf = requestAnimationFrame(loop);
  }

  // ---------- drawing (own icons: apples, stone walls, portals, the snake) ----------
  const apple = (ctx: CanvasRenderingContext2D, x: number, y: number, c: number, kind: string, ttl: number) => drawApple(ctx, x, y, c, kind, ttl, clock);

  function draw(alpha: number) {
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const dpr = Math.max(2, devicePixelRatio || 1), n = game.n, c = size / n; // render at least 2x for crisp edges
    if (canvas.width !== Math.round(size * dpr)) { canvas.width = Math.round(size * dpr); canvas.height = Math.round(size * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // the grass is painted once per size into an offscreen canvas
    const key = size + 'x' + n + 'x' + dpr;
    if (bgKey !== key) {
      bg = document.createElement('canvas');
      bg.width = canvas.width; bg.height = canvas.height;
      const g = bg.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        g.fillStyle = (x + y) % 2 ? '#1c3a28' : '#21442f';
        g.fillRect(x * c, y * c, c + 0.5, c + 0.5);
        // a few blades of grass per tile
        g.strokeStyle = 'rgba(120,200,120,.10)'; g.lineWidth = Math.max(1, c * 0.04);
        for (let k = 0; k < 3; k++) {
          const gx = x * c + ((x * 7 + y * 13 + k * 5) % 10) / 10 * c, gy = y * c + ((x * 3 + y * 11 + k * 7) % 10) / 10 * c;
          g.beginPath(); g.moveTo(gx, gy + c * 0.12); g.lineTo(gx + c * 0.04, gy); g.stroke();
        }
      }
      const v = g.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.75);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.35)');
      g.fillStyle = v; g.fillRect(0, 0, size, size);
      bgKey = key;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bg!, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // portals
    if (game.portals) game.portals.forEach((p, i) => {
      const cx = p.x * c + c / 2, cy = p.y * c + c / 2, col = i ? '#ff9a3c' : '#4fb2ff';
      ctx.save(); ctx.translate(cx, cy);
      ctx.shadowColor = col; ctx.shadowBlur = c * 0.5;
      for (let k = 0; k < 3; k++) {
        ctx.rotate(clock * (1.5 + k) * (i ? -1 : 1));
        ctx.strokeStyle = col; ctx.globalAlpha = 1 - k * 0.25; ctx.lineWidth = c * 0.08;
        ctx.setLineDash([c * 0.18, c * 0.12]);
        ctx.beginPath(); ctx.arc(0, 0, c * (0.42 - k * 0.11), 0, 7); ctx.stroke();
      }
      ctx.restore();
    });
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    // stone walls
    for (const w of game.walls) {
      const x = w.x * c, y = w.y * c;
      ctx.fillStyle = '#6b6f7a'; ctx.fillRect(x + 1, y + 1, c - 2, c - 2);
      ctx.fillStyle = '#8b909c'; ctx.fillRect(x + 1, y + 1, c - 2, c * 0.18);
      ctx.fillStyle = '#4b4e57'; ctx.fillRect(x + 1, y + c * 0.82, c - 2, c * 0.18 - 1);
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + c / 2, y + c * 0.2); ctx.lineTo(x + c / 2, y + c * 0.5); ctx.moveTo(x + 2, y + c * 0.5); ctx.lineTo(x + c - 2, y + c * 0.5); ctx.moveTo(x + c * 0.3, y + c * 0.5); ctx.lineTo(x + c * 0.3, y + c * 0.82); ctx.stroke();
    }
    for (const a of game.apples) apple(ctx, a.x * c, a.y * c, c, a.kind, a.ttl);
    // snake: the head slides to its new cell, the tail slides after it, everything in between sits exactly on
    // the grid, so corners stay square and nothing cuts diagonally
    const P = (q: Pt) => ({ x: q.x * c + c / 2, y: q.y * c + c / 2 });
    const lerp = (a: Pt, b: Pt, k: number) => (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 1 ? P(b) : P({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }));
    const body = game.body, pv = prev.length ? prev : body;
    const pts = [lerp(pv[0], body[0], alpha), ...body.slice(1).map(P), lerp(pv[pv.length - 1], body[body.length - 1], alpha)];
    const runs: { x: number; y: number }[][] = [[]];
    pts.forEach((p, i) => { if (i && Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) > c * 1.6) runs.push([]); runs.at(-1)!.push(p); });
    const dead = phase === 'over';
    const N = pts.length;
    // width tapers from the head to the tail
    const wAt = (i: number) => c * (0.82 - 0.3 * (i / Math.max(1, N - 1)));
    const stroke = (col: string, k: number, dx = 0, dy = 0) => {
      ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      let i = 0;
      for (const run of runs) {
        for (let j = 1; j < run.length; j++, i++) {
          ctx.lineWidth = wAt(i) * k;
          ctx.beginPath(); ctx.moveTo(run[j - 1].x + dx, run[j - 1].y + dy); ctx.lineTo(run[j].x + dx, run[j].y + dy); ctx.stroke();
        }
        if (run.length === 1) { ctx.lineWidth = wAt(i) * k; ctx.beginPath(); ctx.moveTo(run[0].x + dx, run[0].y + dy); ctx.lineTo(run[0].x + dx + 0.1, run[0].y + dy); ctx.stroke(); }
        i++;
      }
    };
    stroke('rgba(0,0,0,.28)', 1, c * 0.08, c * 0.12); // soft shadow on the grass
    stroke(dead ? '#5e2626' : '#17663a', 1);
    stroke(dead ? '#a33a3a' : '#3fbf66', 0.78);
    stroke(dead ? '#d56b6b' : '#7fe39a', 0.3, -c * 0.05, -c * 0.06);
    // scales: small dots along the back
    ctx.fillStyle = dead ? 'rgba(255,200,200,.25)' : 'rgba(10,60,30,.35)';
    for (let i = 2; i < N - 1; i += 1) {
      const p = pts[i];
      if (!p) continue;
      ctx.beginPath(); ctx.arc(p.x + c * 0.12, p.y + c * 0.1, c * 0.07, 0, 7); ctx.fill();
    }
    // head: a slightly wider rounded snout
    const h = pts[0];
    ctx.fillStyle = dead ? '#a33a3a' : '#46c96d';
    ctx.beginPath(); ctx.arc(h.x, h.y, c * 0.47, 0, 7); ctx.fill();
    ctx.fillStyle = dead ? 'rgba(255,220,220,.3)' : 'rgba(180,255,200,.35)';
    ctx.beginPath(); ctx.arc(h.x - c * 0.1, h.y - c * 0.14, c * 0.2, 0, 7); ctx.fill();
    // eyes looking where it goes
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[game.dir];
    for (const s of [-1, 1]) {
      const ex = h.x + d[0] * c * 0.12 + d[1] * s * c * 0.18, ey = h.y + d[1] * c * 0.12 + d[0] * s * c * 0.18;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, c * 0.13, 0, 7); ctx.fill();
      ctx.fillStyle = '#10131a'; ctx.beginPath(); ctx.arc(ex + d[0] * c * 0.04, ey + d[1] * c * 0.04, dead ? c * 0.03 : c * 0.065, 0, 7); ctx.fill();
    }
    // darkness: only a circle of light around the head
    if (game.mods.dark && phase !== 'idle') {
      const g = ctx.createRadialGradient(h.x, h.y, c * 2.2, h.x, h.y, c * 4.6);
      g.addColorStop(0, 'rgba(4,8,6,0)'); g.addColorStop(1, 'rgba(4,8,6,.96)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
      // apples still glimmer faintly in the dark
      ctx.globalAlpha = 0.3;
      for (const ap of game.apples) apple(ctx, ap.x * c, ap.y * c, c, ap.kind, ap.ttl);
      ctx.globalAlpha = 1;
    }
    // wrap-around: the border is open, shown as a dashed edge
    if (game.mods.wrap) {
      ctx.strokeStyle = 'rgba(160,240,190,.45)'; ctx.lineWidth = 2; ctx.setLineDash([c * 0.3, c * 0.25]);
      ctx.strokeRect(1, 1, size - 2, size - 2); ctx.setLineDash([]);
    }
    // hunger: a bar along the top that empties; it blinks red while the tail withers
    if (game.mods.hunger && phase === 'play') {
      const left = Math.max(0, 1 - game.hungry / HUNGER), starving = left === 0;
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(6, 6, size - 12, 6);
      ctx.fillStyle = starving ? (Math.floor(clock * 6) % 2 ? '#ff4d5e' : '#7a1c26') : left < 0.3 ? '#ffb347' : '#7fe39a';
      ctx.fillRect(6, 6, starving ? size - 12 : (size - 12) * left, 6);
    }
    if (phase === 'play' && Math.floor(clock * 3) % 3 === 0) {
      ctx.strokeStyle = '#ff5a6a'; ctx.lineWidth = c * 0.06;
      ctx.beginPath(); ctx.moveTo(h.x + d[0] * c * 0.4, h.y + d[1] * c * 0.4); ctx.lineTo(h.x + d[0] * c * 0.62, h.y + d[1] * c * 0.62); ctx.stroke();
    }
  }

  const win = $derived(Math.round((phase === 'play' ? staked : paid ? bet : 0) * mult * 100) / 100);
  const MODS_UI: [keyof typeof MOD_FACTOR, Key][] = [
    ['walls', 'sn.walls'], ['portals', 'sn.portals'], ['many', 'sn.many'], ['rare', 'sn.rare'], ['wrap', 'sn.wrap'],
    ['poison', 'sn.poison'], ['mirror', 'sn.mirror'], ['hunger', 'sn.hunger'], ['runner', 'sn.runner'], ['dark', 'sn.dark'],
  ];
</script>

<svelte:window onkeydown={key} />

<ArcadeLayout eyebrow="Arcade · {active.size}×{active.size}{mode === 'daily' ? ' · Daily' : ''}" title={gameName(byId('snake')!)}>
  {#snippet controls()}
    {#if phase === 'play'}
      <button class="btn primary big cash" onclick={cashOut} disabled={!staked}>{t('a.cashout')} <span class="mono">{fmt(win)}</span></button>
    {:else}
      <button class="btn primary big" onclick={start} disabled={paid && bet > wallet.balance}>{phase === 'idle' ? t('sn.start') : t('sn.again')}</button>
    {/if}
    <div class="seg two" role="group">
      <button class:on={mode === 'free'} disabled={phase === 'play'} onclick={() => (mode = 'free')}>{t('sn.free')}</button>
      <button class:on={mode === 'daily'} disabled={phase === 'play'} onclick={() => (mode = 'daily')}>{t('sn.daily')}</button>
    </div>
    <label class="switch"><span>{t('sn.stake')}</span><input type="checkbox" bind:checked={paid} disabled={phase === 'play'} /></label>
    {#if paid}<BetInput bind:value={bet} disabled={phase === 'play'} />{/if}

    {#if mode === 'daily'}
      <div class="dailybox">
        <p class="eyebrow">{t('sn.daily')} · {String(DAY).slice(6)}.{String(DAY).slice(4, 6)}.</p>
        <p class="small">{t('sn.dailyText')}</p>
        <div class="chips">
          <span>{t(({ 12: 'sn.small', 18: 'sn.mid', 24: 'sn.large' } as const)[DAILY.size])}</span>
          <span>{t(('sn.' + DAILY.speed) as Key)}</span>
          {#each MODS_UI as [k, l]}{#if DAILY[k]}<span>{t(l)}</span>{/if}{/each}
        </div>
      </div>
    {:else}
      <fieldset disabled={phase === 'play'}>
        <span class="lbl">{t('sn.size')}</span>
        <div class="seg">
          {#each [[12, 'sn.small'], [18, 'sn.mid'], [24, 'sn.large']] as [v, l]}<button class:on={mods.size === v} onclick={() => (mods.size = v as Mods['size'])}>{t(l as Key)}</button>{/each}
        </div>
        <span class="lbl">{t('sn.speed')}</span>
        <div class="seg">
          {#each ['normal', 'fast', 'turbo'] as v}<button class:on={mods.speed === v} onclick={() => (mods.speed = v as Mods['speed'])}>{t(('sn.' + v) as Key)}</button>{/each}
        </div>
        <span class="lbl">Modifier</span>
        <div class="mods">
          {#each MODS_UI as [k, l]}
            <button type="button" class="mod" class:on={mods[k]} aria-pressed={mods[k]} title={t((l + '.tip') as Key)} onclick={() => (mods[k] = !mods[k])}>
              <span>{t(l)}</span>{#if MOD_FACTOR[k] !== 1}<i class="mono" class:down={MOD_FACTOR[k] < 1}>×{MOD_FACTOR[k]}</i>{/if}
            </button>
          {/each}
        </div>
      </fieldset>
    {/if}
    <div class="stats">
      <div><span class="eyebrow">{t('sn.perPoint')}</span><strong class="mono">×{perPoint}</strong></div>
      <div><span class="eyebrow">{t('sn.best')}</span><strong class="mono">{mode === 'daily' ? best.daily : best.free}</strong></div>
    </div>
  {/snippet}

  <div class="stage">
    <div class="hud">
      <span><span class="eyebrow">{t('sn.points')}</span><strong class="mono">{points}</strong></span>
      <span><span class="eyebrow">×</span><strong class="mono" class:up={mult >= 1}>{mult.toFixed(2)}</strong></span>
      <span><span class="eyebrow">{t('bet.win')}</span><strong class="mono">{fmt(win)}</strong></span>
    </div>
    <div class="boardwrap" bind:this={wrap}>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="board" style="width:{size}px; height:{size}px" onpointerdown={down} onpointerup={up}>
        <canvas bind:this={canvas} style="width:{size}px; height:{size}px"></canvas>
        {#if phase !== 'play'}
          <div class="overlay" in:fly={{ y: 10, duration: 250 }}>
            {#if phase === 'idle'}
              <strong>{t('sn.press')}</strong>
              <span>{coarse ? t('sn.hintTouch') : t('sn.hint')}</span>
            {:else if phase === 'over'}
              <strong class="bad">{t('sn.dead')}</strong>
              <span>{points} {t('sn.points')}{staked ? ' · −' + fmt(staked) : ''}</span>
            {:else}
              <strong class="good" in:pop>+{fmt(result)}</strong>
              <span>{points} {t('sn.points')} · ×{mult.toFixed(2)}</span>
            {/if}
          </div>
        {/if}
      </div>
    </div>
    {#if coarse}
      <div class="pad">
        <button aria-label="up" onclick={() => turn('up')}>▲</button>
        <button aria-label="left" onclick={() => turn('left')}>◀</button>
        <button aria-label="down" onclick={() => turn('down')}>▼</button>
        <button aria-label="right" onclick={() => turn('right')}>▶</button>
      </div>
    {/if}
  </div>
</ArcadeLayout>

<style>
  .big { min-height: 56px; width: 100%; font-size: 1rem; }
  .cash:not(:disabled) { background: #2fbf71; color: #062a16; }
  fieldset { border: 0; margin: 0; padding: 0; display: grid; gap: 8px; }
  fieldset:disabled { opacity: 0.55; }
  .lbl { font-size: 0.8rem; color: var(--muted); }
  .seg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .mods { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
  .mod { display: flex; justify-content: space-between; align-items: center; gap: 4px; min-height: 40px; padding: 4px 10px; border-radius: 12px; border: 1px solid var(--line-2); background: none; color: var(--muted); font-size: 0.8rem; text-align: left; }
  .mod.on { background: color-mix(in srgb, #3fbf66 22%, transparent); border-color: #3fbf66; color: var(--text); }
  .mod i { font-style: normal; font-size: 0.68rem; color: #7fe39a; }
  .mod i.down { color: #ffb347; }
  .seg.two { grid-template-columns: 1fr 1fr; }
  .seg button { min-height: 38px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--bg-2); font-size: 0.82rem; transition: background-color 0.25s var(--ease-snap), color 0.25s var(--ease-snap); }
  .seg button.on { background: var(--text); color: var(--bg); }
  .seg button:disabled:not(.on) { opacity: 0.45; }
  .dailybox { padding: 12px; border-radius: 14px; background: color-mix(in srgb, var(--gold) 12%, var(--bg-2)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--gold) 45%, transparent); }
  .dailybox .eyebrow { margin: 0 0 6px; color: var(--gold); }
  .small { font-size: 0.8rem; color: var(--muted); margin: 0 0 8px; }
  .chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .chips span { font-size: 0.72rem; padding: 3px 8px; border-radius: 999px; background: var(--surface-2); }
  .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .stats div { background: var(--bg-2); border-radius: 14px; padding: 10px 12px; display: grid; gap: 4px; }
  .stats strong { font-size: 1.1rem; }

  .stage { display: grid; gap: 12px; padding: clamp(12px, 2vw, 22px); border-radius: 28px; background: radial-gradient(ellipse at 50% 0%, #17321f, #0a140e 75%); box-shadow: 0 30px 60px -30px rgba(0,0,0,.6); color: #f4f2ee; }
  .hud { display: flex; justify-content: space-around; gap: 10px; }
  .hud > span { display: grid; justify-items: center; gap: 2px; }
  .hud .eyebrow { color: rgba(244,242,238,.5); }
  .hud strong { font-size: 1.25rem; }
  .hud .up { color: #8ff0bf; }
  .boardwrap { width: 100%; max-width: min(680px, calc(100dvh - var(--nav-h) - 230px)); min-width: 260px; margin: 0 auto; display: grid; justify-items: center; }
  .board { position: relative; border-radius: 14px; overflow: hidden; box-shadow: 0 0 0 3px #2c5a3d, 0 20px 40px rgba(0,0,0,.5); touch-action: none; }
  canvas { display: block; }
  .overlay { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 6px; text-align: center; padding: 16px; background: rgba(8, 16, 11, 0.55); backdrop-filter: blur(2px); }
  .overlay strong { font-size: clamp(1.4rem, 4vw, 2.2rem); letter-spacing: -0.03em; }
  .overlay span { color: rgba(255,255,255,.75); font-size: 0.9rem; }
  .overlay .bad { color: #ff9a9d; } .overlay .good { color: #8ff0bf; font-family: 'Geist Mono Variable', monospace; }
  .pad { display: grid; grid-template-columns: repeat(3, 64px); grid-template-rows: repeat(2, 56px); gap: 6px; justify-content: center; }
  .pad button { border: 0; border-radius: 14px; background: rgba(255,255,255,.1); color: #fff; font-size: 1.2rem; touch-action: manipulation; }
  .pad button:active { background: rgba(255,255,255,.25); }
  .pad button:nth-child(1) { grid-column: 2; }
  .pad button:nth-child(2) { grid-column: 1; grid-row: 2; }
  .pad button:nth-child(3) { grid-column: 2; grid-row: 2; }
  .pad button:nth-child(4) { grid-column: 3; grid-row: 2; }
</style>
