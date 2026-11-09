<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { newWorld, ensure, update, hit, logAt, blocked, warning, COLS, type World, type Lane } from '../games/crossy';
  import HowTo from '../components/HowTo.svelte';
  import { settle, fmt } from '../lib/state.svelte';
  import { dailyGame } from '../lib/daily';
  import { sfx } from '../lib/sfx';
  import { pop } from '../lib/motion';
  import { t } from '../lib/i18n';
  import duckUp from '../assets/duck/up.webp';
  import duckDown from '../assets/duck/down.webp';
  import duckLeft from '../assets/duck/left.webp';
  import duckRight from '../assets/duck/right.webp';

  type Dir = 'up' | 'down' | 'left' | 'right';
  const SPRITES: Record<Dir, HTMLImageElement> = { up: new Image(), down: new Image(), left: new Image(), right: new Image() };
  SPRITES.up.src = duckUp; SPRITES.down.src = duckDown; SPRITES.left.src = duckLeft; SPRITES.right.src = duckRight;

  let best = $state(+(localStorage.getItem('betly:crossy') || 0));
  let phase = $state<'ready' | 'play' | 'dead'>('ready');
  let score = $state(0);
  let cause = $state<'car' | 'water' | 'train' | 'eagle' | ''>('');
  let reward = $state(0);

  let world: World;
  const P = { x: 5, row: 0, fromX: 5, fromRow: 0, hop: 1, face: 'up' as Dir, onLog: false, deadT: 0 };
  let cam = 0, camMin = 0, shake = 0;
  let queued: Dir | null = null;
  type Bit = { x: number; y: number; vx: number; vy: number; life: number; c: string };
  let bits: Bit[] = [];

  function reset() {
    world = newWorld(Math.random);
    Object.assign(P, { x: 5, row: 2, fromX: 5, fromRow: 2, hop: 1, face: 'up', onLog: false, deadT: 0 });
    cam = 0; camMin = 0; shake = 0; bits = []; queued = null;
    score = 0; cause = ''; reward = 0;
  }
  reset();

  function move(d: Dir) {
    if (phase === 'dead') return;
    if (phase === 'ready') phase = 'play';
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
    if ((d === 'up' || d === 'down') && target?.type !== 'river') tx = Math.round(tx);
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
    reward = score;
    if (score > 0) settle(score, score);
    if (score > best) { best = score; localStorage.setItem('betly:crossy', String(best)); }
  }
  function burst(c: string, n: number) {
    for (let i = 0; i < n; i++) bits.push({ x: P.x + 0.5, y: P.row + 0.5, vx: (Math.random() - 0.5) * 6, vy: Math.random() * 6, life: 0.6 + Math.random() * 0.5, c });
  }

  const KEYS: Record<string, Dir> = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  function key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    if (KEYS[e.code]) { e.preventDefault(); if (!e.repeat) move(KEYS[e.code]); return; }
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
  let wrap: HTMLDivElement;
  let W = $state(640), H = $state(720);
  let raf = 0, last = performance.now(), clock = 0, warnTick = 0;
  onMount(() => {
    coarse = matchMedia('(pointer: coarse)').matches;
    const fit = () => {
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
    const rows = Math.ceil(H / (W / COLS)) + 2;
    update(world, dt, Math.floor(cam) - 2, Math.floor(cam) + rows);
    if (P.hop < 1) {
      P.hop = Math.min(1, P.hop + dt / 0.11);
      if (P.hop === 1) {
        land();
        if (queued) { const q = queued; queued = null; move(q); }
      }
    }
    if (phase === 'play') {
      const lane = world.lanes[P.row];
      if (P.onLog && lane.type === 'river') {
        P.x += lane.dir * lane.speed * dt;
        P.fromX = P.x;
        if (P.x < -0.45 || P.x > COLS - 0.55) die('water');
      }
      const vx = P.fromX + (P.x - P.fromX) * P.hop;
      if (hit(lane, vx)) die(lane.type === 'rail' ? 'train' : 'car');
      // the screen keeps creeping forward; fall behind and the eagle takes you
      const pressure = 0.28 + Math.min(score, 160) / 320;
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
      P.onLog = true;
    }
    if (P.row - 2 > score) score = P.row - 2;
  }

  // ---------- drawing: oblique voxel look ----------
  const CAR = ['#ff5a5f', '#ffb000', '#3d9bff', '#9b5cff', '#2fbf71', '#ff7ab8'];
  function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, d: number, h: number, top: string, side: string) {
    ctx.fillStyle = side; ctx.fillRect(x, y + d - h, w, h);
    ctx.fillStyle = top; ctx.fillRect(x, y - h, w, d);
  }
  const shade = (hex: string, k: number) => {
    const n = parseInt(hex.slice(1), 16), f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  };

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
      if (l.type === 'grass') {
        ctx.fillStyle = r % 2 ? '#8bd65a' : '#80cc50'; ctx.fillRect(0, y, W, C + 1);
        ctx.fillStyle = 'rgba(40,110,30,.18)';
        for (let c = 0; c < COLS; c++) if ((r * 7 + c * 13) % 5 === 0) ctx.fillRect(c * C + C * 0.3, y + C * 0.55, C * 0.12, C * 0.12);
      } else if (l.type === 'road') {
        ctx.fillStyle = '#4a4e5a'; ctx.fillRect(0, y, W, C + 1);
        if (world.lanes[r + 1]?.type === 'road') { ctx.fillStyle = 'rgba(255,255,255,.55)'; for (let x = 0; x < W; x += C) ctx.fillRect(x + C * 0.2, y - 1.5, C * 0.5, 3); }
      } else if (l.type === 'river') {
        ctx.fillStyle = '#3aa7e6'; ctx.fillRect(0, y, W, C + 1);
        ctx.fillStyle = 'rgba(255,255,255,.18)';
        const off = ((clock * l.speed * l.dir * C) % (C * 2) + C * 2) % (C * 2);
        for (let x = -C * 2 + off; x < W; x += C * 2) ctx.fillRect(x, y + C * (0.3 + (r % 3) * 0.2), C * 0.6, 2);
      } else {
        ctx.fillStyle = '#8f8070'; ctx.fillRect(0, y, W, C + 1);
        ctx.fillStyle = '#5a4030'; for (let x = 0; x < W; x += C * 0.5) ctx.fillRect(x + C * 0.1, y + C * 0.15, C * 0.18, C * 0.7);
        ctx.fillStyle = '#c9ced6'; ctx.fillRect(0, y + C * 0.28, W, C * 0.07); ctx.fillRect(0, y + C * 0.66, W, C * 0.07);
      }
    }
    // objects, far rows first so nearer things overlap them; the duck is drawn with its row
    const vx = P.fromX + (P.x - P.fromX) * P.hop;
    const vrow = P.fromRow + (P.row - P.fromRow) * P.hop;
    for (let r = hi; r >= lo; r--) {
      const l = world.lanes[r];
      if (!l) continue;
      const y = Y(r);
      if (l.type === 'grass') for (const c of l.trees) drawTree(ctx, c * C, y, C, (r * 31 + c * 7) % 4 === 0);
      if (l.type === 'river') for (const it of l.items) drawLog(ctx, it.x * C, y, it.len * C, C);
      if (l.type === 'road') for (const it of l.items) drawCar(ctx, it.x * C, y, it.len, C, CAR[it.c], l.dir);
      if (l.type === 'rail') {
        drawSignal(ctx, (COLS - 0.6) * C, y, C, warning(l));
        if (l.train) drawTrain(ctx, l.train.x * C, y, l.train.len, C, l.dir);
      }
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

  function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, C: number, rock: boolean) {
    if (rock) { box(ctx, x + C * 0.15, y + C * 0.2, C * 0.7, C * 0.6, C * 0.35, '#b8bcc6', '#8d929e'); return; }
    box(ctx, x + C * 0.38, y + C * 0.45, C * 0.24, C * 0.25, C * 0.35, '#8a5a32', '#6b4426');
    box(ctx, x + C * 0.1, y + C * 0.15, C * 0.8, C * 0.65, C * 0.65, '#5fbf3e', '#3f8f2a');
    box(ctx, x + C * 0.25, y + C * 0.2, C * 0.5, C * 0.45, C * 1.0, '#7fd85a', '#4fa534');
  }
  function drawLog(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, C: number) {
    box(ctx, x + 2, y + C * 0.2, w - 4, C * 0.6, C * 0.18, '#a8703f', '#7a4f2a');
    ctx.fillStyle = '#c99764'; ctx.fillRect(x + 2, y + C * 0.02, C * 0.18, C * 0.6); ctx.fillRect(x + w - 2 - C * 0.18, y + C * 0.02, C * 0.18, C * 0.6);
    ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let k = C * 0.6; k < w - C * 0.4; k += C * 0.7) ctx.fillRect(x + k, y + C * 0.1, 2, C * 0.45);
  }
  function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, C: number, col: string, dir: number) {
    const w = len * C - C * 0.12;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(x + C * 0.08, y + C * 0.78, w, C * 0.1);
    if (len >= 2) {
      // truck: cab plus white cargo box
      const cab = C * 0.75, cx = dir > 0 ? x + w - cab : x;
      box(ctx, dir > 0 ? x : x + cab, y + C * 0.12, w - cab, C * 0.7, C * 0.7, '#f1f1f4', '#c9cbd3');
      box(ctx, cx, y + C * 0.15, cab, C * 0.65, C * 0.5, col, shade(col, 0.72));
      ctx.fillStyle = '#9fd8ff'; ctx.fillRect(cx + (dir > 0 ? cab * 0.55 : cab * 0.1), y + C * 0.15 - C * 0.5 + 3, cab * 0.35, C * 0.25);
    } else {
      box(ctx, x + C * 0.06, y + C * 0.18, w, C * 0.62, C * 0.32, col, shade(col, 0.72));
      box(ctx, x + C * 0.06 + w * 0.22, y + C * 0.25, w * 0.5, C * 0.45, C * 0.58, shade(col, 1.12), shade(col, 0.6));
      ctx.fillStyle = '#9fd8ff'; ctx.fillRect(x + C * 0.06 + w * (dir > 0 ? 0.55 : 0.22), y + C * 0.25 - C * 0.58 + 2, w * 0.17, C * 0.4);
    }
    ctx.fillStyle = '#1c1c22';
    for (const k of [0.18, 0.72]) ctx.fillRect(x + w * k, y + C * 0.72, C * 0.2, C * 0.12);
    ctx.fillStyle = '#fff6b0'; ctx.fillRect(dir > 0 ? x + w - 2 : x + C * 0.06, y + C * 0.55, 4, C * 0.1);
  }
  function drawTrain(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, C: number, dir: number) {
    for (let k = 0; k < len; k += 3) {
      const cx = x + k * C, cw = Math.min(3, len - k) * C - C * 0.12;
      box(ctx, cx, y + C * 0.12, cw, C * 0.72, C * 0.85, '#e8e8ee', '#c33a3a');
      ctx.fillStyle = '#26303f'; for (let wx = cx + C * 0.3; wx < cx + cw - C * 0.4; wx += C * 0.7) ctx.fillRect(wx, y + C * 0.84 - C * 0.65, C * 0.4, C * 0.22);
    }
    ctx.fillStyle = '#ffe680'; ctx.fillRect(dir > 0 ? x + len * C - C * 0.2 : x, y + C * 0.84 - C * 0.3, C * 0.12, C * 0.14);
  }
  function drawSignal(ctx: CanvasRenderingContext2D, x: number, y: number, C: number, on: boolean) {
    box(ctx, x + C * 0.12, y + C * 0.05, C * 0.1, C * 0.1, C * 0.95, '#555', '#333');
    box(ctx, x, y + C * 0.02, C * 0.34, C * 0.12, C * 1.22, '#2a2a30', '#1a1a1f');
    const blink = on && Math.floor(clock * 6) % 2 === 0;
    for (const [k, b] of [[0.03, blink], [0.19, on && !blink]] as const) {
      ctx.fillStyle = b ? '#ff3b3b' : '#4a1a1a';
      if (b) { ctx.shadowColor = '#ff3b3b'; ctx.shadowBlur = 14; }
      ctx.beginPath(); ctx.arc(x + C * (k + 0.06), y + C * 0.02 - C * 1.05, C * 0.06, 0, 7); ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
  function drawDuck(ctx: CanvasRenderingContext2D, vx: number, vrow: number, C: number, Y: (r: number) => number) {
    const img = SPRITES[P.face];
    const cx = vx * C + C / 2, base = Y(vrow) + C * 0.8;
    const lift = P.hop < 1 ? Math.sin(P.hop * Math.PI) * C * 0.4 : 0;
    let sxk = 1, syk = 1, alpha = 1;
    if (phase === 'dead') {
      if (cause === 'car' || cause === 'train') { syk = 0.25; sxk = 1.5; }
      if (cause === 'water') { alpha = Math.max(0, 1 - P.deadT * 1.6); syk = Math.max(0.2, 1 - P.deadT); }
      if (cause === 'eagle') { alpha = Math.max(0, 1 - P.deadT * 1.2); }
    } else if (P.hop < 1) { syk = 1 + Math.sin(P.hop * Math.PI) * 0.12; sxk = 1 - Math.sin(P.hop * Math.PI) * 0.08; }
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath(); ctx.ellipse(cx, base - C * 0.05, C * 0.34, C * 0.12, 0, 0, 7); ctx.fill();
    if (!img.complete || !img.naturalWidth) return;
    const h = C * 1.32 * syk, w = (img.naturalWidth / img.naturalHeight) * C * 1.32 * sxk;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, cx - w / 2, base - h - lift, w, h);
    ctx.globalAlpha = 1;
  }

  const isDaily = dailyGame() === 'crossy';
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

  <div class="stage" bind:this={wrap}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="screen" style="width:{W}px; height:{H}px" onpointerdown={pdown} onpointerup={pup}>
      <canvas bind:this={canvas} style="width:{W}px; height:{H}px"></canvas>
      {#if phase === 'ready'}
        <div class="overlay soft" in:fly={{ y: 10, duration: 250 }}>
          <strong>{t('cr.ready')}</strong>
          <span>{coarse ? t('cr.touch') : t('cr.keys')}</span>
        </div>
      {:else if phase === 'dead'}
        <div class="overlay" in:fly={{ y: 10, duration: 300, delay: 250 }}>
          <span class="eyebrow light">{t(('cr.' + cause) as any)}</span>
          <strong class="mono big">{score}</strong>
          {#if reward}<span class="mono plus" in:pop={{ delay: 400 }}>+{fmt(reward)} Credits</span>{/if}
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
  .stage { display: grid; justify-items: center; gap: 12px; }
  .screen { position: relative; border-radius: 24px; overflow: hidden; box-shadow: 0 0 0 1px var(--line-2), 0 40px 80px -30px rgba(0,0,0,.7); touch-action: none; user-select: none; }
  canvas { display: block; }
  .overlay { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 8px; text-align: center; color: #fff; background: rgba(12, 10, 24, 0.55); backdrop-filter: blur(3px); padding: 20px; }
  .overlay.soft { backdrop-filter: none; background: linear-gradient(transparent 40%, rgba(12,10,24,.6)); place-content: end center; padding-bottom: 12%; }
  .overlay strong { font-size: clamp(1.4rem, 4vw, 2.2rem); letter-spacing: -0.03em; text-shadow: 0 2px 0 rgba(0,0,0,.3); }
  .overlay .big { font-size: clamp(3rem, 10vw, 5rem); }
  .overlay span { color: rgba(255,255,255,.85); }
  .eyebrow.light { color: #ffd23f; }
  .plus { color: #8ff0bf !important; font-size: 1.1rem; }
  .pad { display: grid; grid-template-columns: repeat(3, 68px); grid-template-rows: repeat(2, 58px); gap: 6px; }
  .pad button { border: 0; border-radius: 16px; background: var(--surface-2); color: var(--text); font-size: 1.2rem; touch-action: manipulation; }
  .pad button:active { background: var(--line-2); }
  .pad button:nth-child(1) { grid-column: 2; }
  .pad button:nth-child(2) { grid-column: 1; grid-row: 2; }
  .pad button:nth-child(3) { grid-column: 2; grid-row: 2; }
  .pad button:nth-child(4) { grid-column: 3; grid-row: 2; }
</style>
