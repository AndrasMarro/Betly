<script lang="ts">
  import { fly, scale } from 'svelte/transition';
  import ArcadeLayout from '../components/ArcadeLayout.svelte';
  import BetInput from '../components/BetInput.svelte';
  import Sprite from '../components/Sprite.svelte';
  import { DICE_BETS, diceMult, diceProb, roll } from '../games/arcade';
  import { wallet, settle, stake, fmt } from '../lib/state.svelte';
  import { byId, gameName } from '../lib/games';
  import { sfx } from '../lib/sfx';
  import { t, type Key } from '../lib/i18n';

  let bet = $state(10);
  let pickd = $state('over');
  let rolling = $state(false);
  let rolls = $state(0);
  let dice = $state([{ rx: 0, ry: 0, n: 1 }, { rx: 0, ry: 0, n: 1 }]);
  let last = $state<{ a: number; b: number; win: number } | null>(null);
  let history = $state<{ s: number; win: boolean; id: number }[]>([]);

  // cube rotation that shows face n at the front
  const FRONT: Record<number, [number, number]> = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] };
  const FACES: [number, string][] = [[1, 'rotateY(0deg)'], [6, 'rotateY(180deg)'], [3, 'rotateY(90deg)'], [4, 'rotateY(-90deg)'], [2, 'rotateX(90deg)'], [5, 'rotateX(-90deg)']];
  const spinTo = (cur: number, target: number, turns: number) => target + 360 * (Math.ceil((cur - target) / 360) + turns);

  async function go() {
    if (rolling || bet > wallet.balance || bet <= 0) return;
    const b = bet, choice = pickd;
    stake(b);
    rolling = true;
    last = null;
    const a = roll(), c = roll();
    dice = dice.map((d, i) => {
      const n = i ? c : a, [x, y] = FRONT[n];
      return { n, rx: spinTo(d.rx, x, 2 + i), ry: spinTo(d.ry, y, 2) };
    });
    rolls++;
    sfx('dice');
    await new Promise((r) => setTimeout(r, 1250));
    const win = DICE_BETS[choice](a, c) ? Math.round(b * diceMult(choice) * 100) / 100 : 0;
    settle(win, win);
    sfx(win ? 'win' : 'lose');
    last = { a, b: c, win };
    history = [{ s: a + c, win: win > 0, id: Date.now() }, ...history].slice(0, 14);
    rolling = false;
  }
  const opts = ['under', 'seven', 'over', 'double'];
  const sums = Array.from({ length: 11 }, (_, i) => 's' + (i + 2));
  function key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); go(); }
  }
</script>

<svelte:window onkeydown={key} />

<ArcadeLayout eyebrow="Arcade · 2 × W6" title={gameName(byId('dice')!)}>
  {#snippet controls()}
    <button class="btn primary big" disabled={rolling || bet > wallet.balance} onclick={go}>{t('dc.roll')}</button>
    <BetInput bind:value={bet} disabled={rolling} />
    <div class="stats">
      <div><span class="eyebrow">×</span><strong class="mono">{diceMult(pickd).toFixed(2)}</strong></div>
      <div><span class="eyebrow">{t('dc.chance')}</span><strong class="mono">{(diceProb(pickd) * 100).toFixed(1)} %</strong></div>
    </div>
    <p class="muted small">{t('a.profit')}: <span class="mono">{fmt(Math.round(bet * (diceMult(pickd) - 1) * 100) / 100)}</span></p>
  {/snippet}

  <div class="table">
    <div class="stage">
      {#each dice as d, i}
        <div class="slot">
          <div class="toss" style="--d:{i * 70}ms; animation-name:{rolls ? (rolls % 2 ? 'tossA' : 'tossB') : 'none'}"><div class="cube" style="transform: rotateX({d.rx}deg) rotateY({d.ry}deg)">
            <i class="core x"></i><i class="core y"></i><i class="core z"></i>
            {#each FACES as [n, tr]}<div class="face" style="transform: {tr} translateZ(var(--half))"><Sprite kind="die" {n} /></div>{/each}
          </div></div>
          <div class="shadow" style="--d:{i * 70}ms; animation-name:{rolls ? (rolls % 2 ? 'shadeA' : 'shadeB') : 'none'}"></div>
        </div>
      {/each}
    </div>
    <div class="result">
      {#if last}
        <span class="sum mono" in:scale={{ start: 0.6, duration: 300 }}>{last.a + last.b}</span>
        <span class="mono" class:pos={last.win > 0} in:fly={{ y: 8 }}>{last.win > 0 ? '+' + fmt(last.win) : '0'}</span>
      {/if}
    </div>
    <div class="opts">
      {#each opts as o}
        <button class="opt" class:on={pickd === o} disabled={rolling} onclick={() => { pickd = o; sfx('click'); }}>
          <span>{t(('dc.' + o) as Key)}</span><span class="mono">×{diceMult(o).toFixed(2)}</span>
        </button>
      {/each}
    </div>
    <div class="sums">
      {#each sums as o}
        <button class="opt small" class:on={pickd === o} disabled={rolling} onclick={() => { pickd = o; sfx('click'); }}>
          <span class="mono">{o.slice(1)}</span><span class="mono m">×{diceMult(o).toFixed(1)}</span>
        </button>
      {/each}
    </div>
    <div class="hist">
      {#each history as h (h.id)}<span class="mono" class:pos={h.win} in:fly={{ x: -12, duration: 250 }}>{h.s}</span>{/each}
    </div>
  </div>
</ArcadeLayout>

<style>
  .big { min-height: 54px; width: 100%; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.08em; }
  .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .stats div { background: var(--bg-2); border-radius: 14px; padding: 10px 12px; display: grid; gap: 4px; }
  .stats strong { font-size: 1.15rem; }
  .muted { color: var(--muted); } .small { font-size: 0.82rem; margin: 0; }
  .table { box-shadow: 0 30px 60px -30px rgba(0,0,0,.6); border-radius: 28px; padding: clamp(16px, 3vw, 32px); background: radial-gradient(ellipse at 50% 0%, #4a1d24, #1a080b); color: #f4f2ee; display: grid; gap: 18px; }
  .stage { display: flex; justify-content: center; gap: clamp(28px, 7vw, 72px); padding: 40px 0 6px; perspective: 1000px; }
  .slot { --size: clamp(80px, 13vw, 116px); --half: calc(var(--size) / 2); display: grid; justify-items: center; gap: 14px; }
  .toss { animation-duration: 1.15s; animation-timing-function: var(--ease-snap); animation-fill-mode: both; animation-delay: var(--d); transform-style: preserve-3d; }
  @keyframes tossA { 0% { transform: translateY(0) scale(1); } 30% { transform: translateY(-70px) scale(1.06); } 62% { transform: translateY(0) scale(1); } 70% { transform: translateY(-12px); } 82% { transform: translateY(0); } 100% { transform: none; } }
  @keyframes tossB { 0% { transform: translateY(0) scale(1); } 30% { transform: translateY(-70px) scale(1.06); } 62% { transform: translateY(0) scale(1); } 70% { transform: translateY(-12px); } 82% { transform: translateY(0); } 100% { transform: none; } }
  .cube { width: var(--size); height: var(--size); position: relative; transform-style: preserve-3d; transition: transform 1.15s var(--spring-smooth); transition-delay: var(--d); }
  .face { position: absolute; inset: 0; backface-visibility: hidden; border-radius: 18%; }
  /* inner planes hide the see-through gaps at the rounded corners */
  .core { position: absolute; inset: 4%; background: #e9e5db; border-radius: 10%; }
  .core.x { transform: rotateY(90deg); } .core.y { transform: rotateX(90deg); }
  .shadow { width: calc(var(--size) * 0.9); height: 14px; border-radius: 50%; background: radial-gradient(closest-side, rgba(0,0,0,.55), transparent); animation-duration: 1.15s; animation-timing-function: var(--ease-snap); animation-fill-mode: both; animation-delay: var(--d); }
  @keyframes shadeA { 30% { transform: scale(0.55); opacity: 0.45; } 62% { transform: scale(1); opacity: 1; } }
  @keyframes shadeB { 30% { transform: scale(0.55); opacity: 0.45; } 62% { transform: scale(1); opacity: 1; } }
  .result { min-height: 54px; display: flex; gap: 16px; align-items: center; justify-content: center; font-size: 1.3rem; }
  .sum { font-size: 2.4rem; font-weight: 700; }
  .pos { color: #6ff0a6; }
  .opts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .sums { display: grid; grid-template-columns: repeat(11, 1fr); gap: 6px; }
  .opt {
    display: grid; gap: 4px; justify-items: center; padding: 12px 6px; border-radius: 16px; border: 1px solid rgba(255,255,255,.14);
    background: rgba(0,0,0,.25); color: #f4f2ee; font-weight: 600; transition: background-color 0.25s var(--ease-snap), color 0.25s var(--ease-snap), transform 0.35s var(--ease-snap);
  }
  .opt:hover:not(:disabled) { transform: translateY(-2px); background: rgba(255,255,255,.08); }
  .opt:active:not(:disabled) { transform: scale(0.97); transition-duration: 0.16s; }
  .opt.on { background: #f4f2ee; color: #1a080b; border-color: transparent; }
  .opt.small { padding: 8px 2px; font-size: 0.85rem; }
  .opt .m { font-size: 0.65rem; opacity: 0.7; }
  .hist { display: flex; gap: 6px; flex-wrap: wrap; min-height: 28px; }
  .hist span { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 8px; background: rgba(0,0,0,.35); font-size: 0.8rem; color: rgba(255,255,255,.6); }
  .hist span.pos { background: rgba(47,191,113,.25); }
  @media (max-width: 640px) {
    .opts { grid-template-columns: repeat(2, 1fr); }
    .sums { grid-template-columns: repeat(6, 1fr); }
  }
</style>
