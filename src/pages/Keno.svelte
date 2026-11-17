<script lang="ts">
  import { fly, scale } from 'svelte/transition';
  import ArcadeLayout from '../components/ArcadeLayout.svelte';
  import BetInput from '../components/BetInput.svelte';
  import { KENO_N, KENO_D, KENO_MAX, KENO_RISK, kenoTable, hyper, draw, type KenoRisk } from '../games/lotto';
  import { wallet, settle, stake, fmt, settings } from '../lib/state.svelte';
  import { sfx } from '../lib/sfx';

  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
  // Keno: pick 1 to 10 of 40 numbers, 10 are drawn. The more of yours come up, the higher the multiplier.
  let bet = $state(10);
  let risk = $state<KenoRisk>('classic');
  let picks = $state<number[]>([]);
  let drawn = $state<number[]>([]);
  let busy = $state(false);
  let last = $state<{ hits: number; win: number; m: number } | null>(null);
  let history = $state<{ h: number; k: number; win: boolean; id: number }[]>([]);

  const table = $derived(picks.length ? kenoTable(picks.length, risk) : []);
  const chance = (x: number) => (x >= 0.001 ? (x * 100).toFixed(1) + '%' : '1:' + Math.round(1 / x).toLocaleString());
  const hits = $derived(drawn.filter((n) => picks.includes(n)).length);

  function toggle(n: number) {
    if (busy) return;
    if (drawn.length) { drawn = []; last = null; } // a new ticket starts after a draw
    if (picks.includes(n)) picks = picks.filter((x) => x !== n);
    else if (picks.length < KENO_MAX) picks = [...picks, n];
    sfx('click');
  }
  function quick() {
    if (busy) return;
    drawn = []; last = null;
    picks = draw(KENO_N, picks.length || KENO_MAX);
    sfx('chip');
  }
  const clear = () => { if (!busy) { picks = []; drawn = []; last = null; } };

  async function play() {
    if (busy || !picks.length || bet <= 0 || bet > wallet.balance) return;
    const b = bet, k = picks.length, tb = table;
    stake(b);
    busy = true; last = null; drawn = [];
    const balls = draw(KENO_N, KENO_D);
    const fast = matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const n of balls) {
      drawn = [...drawn, n];
      sfx(picks.includes(n) ? 'gem' : 'tick');
      if (!fast) await new Promise((r) => setTimeout(r, 170));
    }
    const h = balls.filter((n) => picks.includes(n)).length, m = tb[h], win = Math.round(b * m * 100) / 100;
    settle(win, win);
    sfx(win > b ? 'big' : win ? 'win' : 'lose');
    last = { hits: h, win, m };
    history = [{ h, k, win: win > 0, id: Date.now() }, ...history].slice(0, 14);
    busy = false;
  }
  function key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); play(); }
  }
</script>

<svelte:window onkeydown={key} />

<ArcadeLayout eyebrow={'Arcade · ' + L('10 aus 40', '10 of 40')} title="Keno">
  {#snippet controls()}
    <button class="btn primary big" disabled={busy || !picks.length || bet > wallet.balance} onclick={play}>{picks.length ? L('Ziehen', 'Draw') : L('Zahlen wählen', 'Pick numbers')}</button>
    <BetInput bind:value={bet} disabled={busy} />
    <div class="field">{L('Risiko', 'Risk')}
      <div class="seg">
        {#each Object.keys(KENO_RISK) as r}
          <button class:on={risk === r} disabled={busy} onclick={() => (risk = r as KenoRisk)}>{({ low: L('Tief', 'Low'), classic: L('Klassisch', 'Classic'), high: L('Hoch', 'High') } as Record<string, string>)[r]}</button>
        {/each}
      </div>
    </div>
    <div class="row2">
      <button class="btn" disabled={busy} onclick={quick}>🎲 {L('Zufall', 'Quick pick')}</button>
      <button class="btn ghost" disabled={busy || !picks.length} onclick={clear}>{L('Leeren', 'Clear')}</button>
    </div>
    <p class="small muted">{L(`Wähle 1 bis ${KENO_MAX} Zahlen. Es werden ${KENO_D} von ${KENO_N} gezogen; je mehr Treffer, desto höher der Multiplikator.`, `Pick 1 to ${KENO_MAX} numbers. ${KENO_D} of ${KENO_N} are drawn; the more hits, the higher the multiplier.`)}</p>
  {/snippet}

  <div class="board">
    <div class="top">
      <span class="count mono">{picks.length} / {KENO_MAX}</span>
      <div class="res">
        {#if last}
          <span class="mono big2" in:scale={{ start: 0.6, duration: 300 }}>{last.hits} {L('Treffer', 'hits')}</span>
          <span class="mono" class:pos={last.win > 0} in:fly={{ y: 8 }}>{last.win > 0 ? '×' + last.m + ' · +' + fmt(last.win) : '0'}</span>
        {:else if busy}<span class="mono">{drawn.length} / {KENO_D}</span>{/if}
      </div>
    </div>
    <div class="grid">
      {#each Array(KENO_N) as _, i}
        {@const n = i + 1}
        {@const mine = picks.includes(n)}
        {@const out = drawn.includes(n)}
        <button class="cell" class:mine class:out class:hit={mine && out} disabled={busy} onclick={() => toggle(n)}>
          {#if mine && out}<span class="gem" in:scale={{ start: 0.3, duration: 300 }}>◆</span>{/if}
          <span class="num mono">{n}</span>
        </button>
      {/each}
    </div>
    {#if picks.length}
      <div class="pays">
        {#each table as m, h}
          <div class="pay" class:on={drawn.length === KENO_D && h === hits} class:zero={!m}>
            <span class="mono h">{h}×</span><span class="mono">{m ? '×' + m : '–'}</span>
            <small class="mono">{chance(hyper(KENO_N, KENO_D, picks.length, h))}</small>
          </div>
        {/each}
      </div>
    {:else}
      <p class="hint">{L('Tippe Zahlen an oder nimm einen Zufallstipp.', 'Tap numbers or take a quick pick.')}</p>
    {/if}
    <div class="hist">
      {#each history as h (h.id)}<span class="mono" class:pos={h.win} in:fly={{ x: -12, duration: 250 }}>{h.h}/{h.k}</span>{/each}
    </div>
  </div>
</ArcadeLayout>

<style>
  .big { min-height: 54px; width: 100%; font-size: 1rem; }
  .seg { display: flex; border: 1px solid var(--line-2); border-radius: 999px; padding: 3px; gap: 3px; }
  .seg button { flex: 1; border: 0; background: none; min-height: 36px; border-radius: 999px; color: var(--muted); }
  .seg button.on { background: var(--text); color: var(--bg); }
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .small { font-size: 0.8rem; margin: 0; } .muted { color: var(--muted); }

  .board { display: grid; gap: 14px; padding: clamp(14px, 2.6vw, 28px); border-radius: 28px; color: #f2f4fa; background: radial-gradient(ellipse at 50% 0%, #1f3a5c, #0c1626 75%); box-shadow: 0 30px 60px -30px rgba(0,0,0,.6); }
  .top { display: flex; justify-content: space-between; align-items: center; min-height: 40px; }
  .count { color: rgba(255,255,255,.6); }
  .res { display: flex; gap: 14px; align-items: baseline; }
  .big2 { font-size: 1.6rem; font-weight: 700; }
  .pos { color: #7ff0b2; }
  .grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 8px; }
  .cell {
    position: relative; aspect-ratio: 1.7; border: 0; border-radius: 12px; background: linear-gradient(180deg, #2e4766, #233852); color: #dfe7f5; box-shadow: inset 0 -4px 0 rgba(0,0,0,.25);
    font-size: 1rem; font-weight: 600; display: grid; place-items: center; transition: transform 0.3s var(--ease-snap), background 0.25s;
  }
  .cell:hover:not(:disabled) { transform: translateY(-2px); }
  .cell.mine { background: linear-gradient(180deg, #8a5cff, #6a3de0); color: #fff; }
  .cell.out:not(.mine) { background: #172537; color: rgba(255,255,255,.4); box-shadow: inset 0 0 0 2px rgba(255,255,255,.18); }
  .cell.hit { background: linear-gradient(180deg, #33d28a, #1c9a62); color: #052a18; animation: pop 0.4s var(--spring-snappy); }
  .cell:disabled { cursor: default; }
  .gem { position: absolute; top: 3px; right: 6px; font-size: 0.7rem; }
  @keyframes pop { from { transform: scale(0.85); } }
  .pays { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; }
  .pay { flex: 1 0 64px; display: grid; justify-items: center; gap: 2px; padding: 8px 4px; border-radius: 12px; background: rgba(0,0,0,.25); font-size: 0.85rem; }
  .pay .h { color: rgba(255,255,255,.6); font-size: 0.75rem; }
  .pay small { font-size: 0.62rem; opacity: 0.5; }
  .pay.zero { opacity: 0.5; }
  .pay.on { background: #f2c046; color: #2a1a00; opacity: 1; }
  .hint { margin: 0; text-align: center; color: rgba(255,255,255,.55); }
  .hist { display: flex; gap: 6px; flex-wrap: wrap; min-height: 28px; }
  .hist span { padding: 4px 8px; border-radius: 8px; background: rgba(0,0,0,.3); font-size: 0.75rem; color: rgba(255,255,255,.6); }
  .hist span.pos { background: rgba(47,191,113,.28); color: #bff5d8; }
  @media (max-width: 640px) { .grid { gap: 5px; } .cell { font-size: 0.85rem; border-radius: 9px; } }
</style>
