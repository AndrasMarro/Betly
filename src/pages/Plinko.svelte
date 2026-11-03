<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import ArcadeLayout from '../components/ArcadeLayout.svelte';
  import BetInput from '../components/BetInput.svelte';
  import { PLINKO_ROWS, plinkoPath, plinkoTable, type Risk } from '../games/arcade';
  import { wallet, settle, stake, fmt } from '../lib/state.svelte';
  import { sfx } from '../lib/sfx';
  import { t, type Key } from '../lib/i18n';

  let bet = $state(10);
  let rows = $state<number>(12);
  let risk = $state<Risk>('medium');
  const table = $derived(plinkoTable(rows, risk));
  const sp = $derived(100 / (rows + 2)); // horizontal spacing in % of board width
  const rowH = $derived(88 / (rows + 1)); // vertical spacing in % of board height

  type Ball = { id: number; path: boolean[]; t0: number; bet: number; x: number; y: number; done?: boolean; gone?: boolean; rows: number; table: number[]; k: number; o: number };
  let balls = $state<Ball[]>([]);
  let hits = $state<{ i: number; id: number; m: number }[]>([]);
  let last = $state<number[]>([]);
  let id = 0, raf = 0;
  const STEP = 150; // ms per peg row
  const live = $derived(balls.length > 0);

  let count = $state(1);
  let dropping = $state(false);
  const MAX_LIVE = 30;
  /** Release a batch; the button stays locked until the batch is out, and the board holds at most 30 balls. */
  function drop() {
    if (dropping) return;
    const n = Math.min(count, MAX_LIVE - balls.length);
    if (n <= 0 || bet > wallet.balance || bet <= 0) return;
    dropping = true;
    for (let k = 0; k < n; k++)
      setTimeout(() => {
        if (bet > wallet.balance) return;
        stake(bet);
        balls.push({ id: ++id, path: plinkoPath(rows), t0: performance.now(), bet, x: 50, y: -3, rows, table, k: -1, o: 1 });
        sfx('chip');
      }, k * 140);
    setTimeout(() => (dropping = false), n * 140 + 320);
  }
  /**
   * Ball timeline in row units (s): [0,1) drop onto the first peg, then one row per unit
   * (hop off the peg, fall onto the next one), then fall into the bucket behind its front.
   */
  function frame(now: number) {
    for (const b of balls) {
      const s = Math.max(0, (now - b.t0) / STEP);
      const sp = 100 / (b.rows + 2), rh = 88 / (b.rows + 1);
      const rowY = (k: number) => 2 + rh * (k + 1) - 1.8; // resting on top of peg row k
      const xAt = (k: number) => 50 + (b.path.slice(0, k).filter(Boolean).length - k / 2) * sp;
      if (s < 1) {
        b.x = 50;
        b.y = -3 + (rowY(0) + 3) * s * s;
      } else if (s < b.rows + 1) {
        const k = Math.floor(s - 1), f = s - 1 - k, dir = b.path[k] ? 1 : -1;
        b.x = xAt(k) + (dir * sp * f) / 2;
        b.y = rowY(k) + (rowY(k + 1) - rowY(k)) * f * f - Math.sin(f * Math.PI) * rh * 0.45;
        if (k !== b.k) { b.k = k; sfx('peg'); }
      } else {
        const f = Math.min(1, (s - b.rows - 1) / 0.7);
        b.x = xAt(b.rows);
        b.y = rowY(b.rows) + (107 - rowY(b.rows)) * f * f;
        b.o = f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4;
        if (f >= 0.45 && !b.done) {
          b.done = true;
          const i = b.path.filter(Boolean).length, m = b.table[i];
          const win = Math.round(b.bet * m * 100) / 100;
          settle(win, win);
          hits.push({ i, id: b.id, m });
          last = [m, ...last].slice(0, 12);
          sfx(m >= 10 ? 'big' : m >= 1 ? 'win' : 'tick');
          setTimeout(() => (hits = hits.filter((h) => h.id !== b.id)), 450);
        }
        if (f >= 1) b.gone = true;
      }
    }
    if (balls.some((b) => b.gone)) balls = balls.filter((b) => !b.gone);
    raf = requestAnimationFrame(frame);
  }
  onMount(() => (raf = requestAnimationFrame(frame)));
  onDestroy(() => cancelAnimationFrame(raf));

  const heat = (m: number) => (m >= 20 ? '#ff4d5e' : m >= 5 ? '#ff7a45' : m >= 2 ? '#f2a63a' : m >= 1 ? '#e5c04a' : '#7d8aa8');
  function key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, select, textarea, button')) return;
    if (e.code === 'Space') { e.preventDefault(); drop(); }
  }
</script>

<svelte:window onkeydown={key} />

<ArcadeLayout eyebrow="Arcade · {rows} rows" title="Plinko">
  {#snippet controls()}
    <button class="btn primary big" disabled={dropping || balls.length >= MAX_LIVE || bet > wallet.balance} onclick={drop}>{count > 1 ? t('pl.dropN').replace('{n}', String(count)) : t('pl.drop')}</button>
    <BetInput bind:value={bet} />
    <div class="field">{t('pl.balls')}
      <div class="seg four">
        {#each [1, 5, 10, 20] as n}<button class:on={count === n} onclick={() => (count = n)}>{n}</button>{/each}
      </div>
    </div>
    <div class="field">{t('pl.risk')}
      <div class="seg">
        {#each ['low', 'medium', 'high'] as r}<button class:on={risk === r} disabled={live} onclick={() => (risk = r as Risk)}>{t(('risk.' + r) as Key)}</button>{/each}
      </div>
    </div>
    <div class="field">{t('pl.rows')}
      <div class="seg">
        {#each PLINKO_ROWS as r}<button class:on={rows === r} disabled={live} onclick={() => (rows = r)}>{r}</button>{/each}
      </div>
    </div>
  {/snippet}

  <div class="board">
    <div class="field-area">
      {#each Array(rows) as _, k}
        {#each Array(k + 3) as _, j}
          <i class="peg" style="left:{50 + (j - (k + 2) / 2) * sp}%; top:{2 + rowH * (k + 1)}%"></i>
        {/each}
      {/each}
      {#each balls as b (b.id)}
        <i class="ball" style="left:{b.x}%; top:{b.y}%; opacity:{b.o}"></i>
      {/each}
    </div>
    <div class="buckets" style="--n:{rows + 1}; --sp:{sp}%">
      {#each table as m, i}
        <span class="bucket mono" class:hit={hits.some((h) => h.i === i)} style="--c:{heat(m)}">{m}<small>×</small></span>
      {/each}
    </div>
    <div class="last">
      {#each last as m, i (i + '-' + last.length)}<span class="mono" style="--c:{heat(m)}">{m}×</span>{/each}
    </div>
  </div>
</ArcadeLayout>

<style>
  .big { min-height: 54px; width: 100%; font-size: 1rem; }
  .seg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .seg.four { grid-template-columns: repeat(4, 1fr); }
  .seg button { min-height: 38px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--bg-2); font-size: 0.85rem; transition: background-color 0.25s var(--ease-snap), color 0.25s var(--ease-snap), transform 0.16s var(--ease-snap); }
  .seg button.on { background: var(--text); color: var(--bg); }
  .seg button:active:not(:disabled) { transform: scale(0.97); }
  .seg button:disabled:not(.on) { opacity: 0.45; }
  .board { border-radius: 28px; padding: 18px clamp(10px, 2vw, 22px) 16px; background: radial-gradient(ellipse at 50% 0%, #22305a, #0d1326 75%); box-shadow: 0 30px 60px -30px rgba(0,0,0,.6); }
  .field-area { position: relative; aspect-ratio: 1 / 0.82; max-width: 720px; margin: 0 auto; }
  .peg { position: absolute; width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 50%; background: #e8ecf8; box-shadow: 0 0 8px rgba(160, 190, 255, 0.5); }
  .ball { position: absolute; width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff, #ff6b6f 45%, #b3202a); box-shadow: 0 0 12px rgba(255, 107, 111, 0.7); z-index: 2; }
  .buckets { display: grid; grid-template-columns: repeat(var(--n), 1fr); gap: 3px; max-width: 720px; margin: 0 auto; padding: 0 calc(var(--sp) / 2); }
  .bucket {
    position: relative; z-index: 3; display: flex; justify-content: center; align-items: center; min-height: 30px; border-radius: 8px; font-size: clamp(0.55rem, 1vw, 0.72rem); font-weight: 700; overflow: hidden; color: #120c06;
    background: var(--c); box-shadow: 0 4px 0 color-mix(in srgb, var(--c) 60%, #000); transition: transform 0.35s var(--spring-snappy);
  }
  .bucket.hit { transform: translateY(5px); }
  @media (max-width: 640px) {
    .bucket { font-size: 0.5rem; min-height: 24px; border-radius: 5px; letter-spacing: -0.04em; }
    .bucket small { display: none; }
    .buckets { gap: 2px; }
  }
  .last { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; margin-top: 16px; min-height: 26px; }
  .last span { padding: 4px 8px; border-radius: 999px; font-size: 0.72rem; background: color-mix(in srgb, var(--c) 25%, transparent); color: var(--c); }
</style>
