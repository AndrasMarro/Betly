<script lang="ts">
  import { fly, scale } from 'svelte/transition';
  import ArcadeLayout from '../components/ArcadeLayout.svelte';
  import BetInput from '../components/BetInput.svelte';
  import Dice3D from '../components/Dice3D.svelte';
  import { diceMid, diceMult, diceProb, diceWins, mineMult, roll } from '../games/arcade';
  import { wallet, settle, stake, fmt, settings } from '../lib/state.svelte';
  import { byId, gameName } from '../lib/games';
  import { sfx } from '../lib/sfx';
  import { t } from '../lib/i18n';

  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
  // 1 to 3 dice, each a W6, W8 or W10; or mine dice: W6 with 1 to 5 bomb faces, every die has to miss them
  let bet = $state(10);
  let count = $state(2);
  let kind = $state<6 | 8 | 10 | 'mine'>(6);
  let mines = $state(1);
  let pickd = $state('over');
  let rolling = $state(false);
  let rolls = $state(0);
  let values = $state<number[]>([1, 1]);
  let done = () => {};
  let diceSize = $state(96);
  $effect(() => { diceSize = matchMedia('(max-width: 640px)').matches ? 66 : 92; });
  let last = $state<{ sum: number; boom: boolean; win: number } | null>(null);
  let history = $state<{ s: string; win: boolean; id: number }[]>([]);

  const f = $derived(kind === 'mine' ? 6 : kind);
  const mid = $derived(diceMid(count, f));
  // the bets on offer: no exact middle when it is not a whole number, no doubles with one die
  const opts = $derived([
    ['under', L('Tief', 'Low'), `${count}–${Math.ceil(mid) - 1}`],
    ...(Number.isInteger(mid) ? [['mid', L('Genau', 'Exactly'), String(mid)]] : []),
    ['over', L('Hoch', 'High'), `${Math.floor(mid) + 1}–${count * f}`],
    ...(count > 1 ? [['same', count === 2 ? L('Pasch', 'Doubles') : L('Drilling', 'Triples'), L('alle gleich', 'all equal')]] : []),
  ]);
  const sums = $derived(Array.from({ length: count * f - count + 1 }, (_, i) => 's' + (count + i)));
  const ok = (b: string) => opts.some((o) => o[0] === b) || sums.includes(b);
  $effect(() => { if (!ok(pickd)) pickd = 'over'; });
  $effect(() => { if (!rolling && values.length !== count) values = Array.from({ length: count }, (_, i) => values[i] ?? i + 1); });
  const mult = $derived(kind === 'mine' ? mineMult(mines, count) : diceMult(pickd, count, f));
  const chance = $derived(kind === 'mine' ? ((6 - mines) / 6) ** count : diceProb(pickd, count, f));

  async function go() {
    if (rolling || bet > wallet.balance || bet <= 0) return;
    const b = bet, m = mult, k = kind, safe = 6 - mines;
    stake(b);
    rolling = true;
    last = null;
    const vals = Array.from({ length: count }, () => roll(f));
    values = vals;
    const landed = new Promise<void>((r) => (done = r));
    rolls++;
    sfx('dice');
    setTimeout(() => sfx('dice'), 380);
    await landed;
    const boom = k === 'mine' && vals.some((v) => v > safe);
    const hit = k === 'mine' ? !boom : diceWins(pickd, vals, f);
    const win = hit ? Math.round(b * m * 100) / 100 : 0;
    settle(win, win);
    sfx(boom ? 'boom' : win ? 'win' : 'lose');
    const sum = vals.reduce((a, v) => a + v, 0);
    last = { sum, boom, win };
    history = [{ s: boom ? '💥' : k === 'mine' ? '✓' : String(sum), win: win > 0, id: Date.now() }, ...history].slice(0, 16);
    rolling = false;
  }
  function key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); go(); }
  }
  const pick = (o: string) => { pickd = o; sfx('click'); };
</script>

<svelte:window onkeydown={key} />

<ArcadeLayout eyebrow={'Arcade · ' + (kind === 'mine' ? count + ' × ' + L('Minenwürfel', 'mine dice') : count + ' × W' + f)} title={gameName(byId('dice')!)}>
  {#snippet controls()}
    <button class="btn primary big" disabled={rolling || bet > wallet.balance} onclick={go}>{t('dc.roll')}</button>
    <BetInput bind:value={bet} disabled={rolling} />
    <div class="field">{L('Würfel', 'Dice')}
      <div class="seg">{#each [1, 2, 3] as c}<button class:on={count === c} disabled={rolling} onclick={() => (count = c)}>{c}</button>{/each}</div>
    </div>
    <div class="field">{L('Art', 'Kind')}
      <div class="seg">
        {#each [[6, 'W6'], [8, 'W8'], [10, 'W10'], ['mine', '💣']] as [k, label]}
          <button class:on={kind === k} disabled={rolling} onclick={() => (kind = k as typeof kind)} title={k === 'mine' ? L('Minenwürfel', 'Mine dice') : ''}>{label}</button>
        {/each}
      </div>
    </div>
    {#if kind === 'mine'}
      <div class="field">{L('Minen pro Würfel', 'Mines per die')}
        <div class="seg">{#each [1, 2, 3, 4, 5] as m}<button class:on={mines === m} disabled={rolling} onclick={() => (mines = m)}>{m}</button>{/each}</div>
      </div>
    {/if}
    <div class="stats">
      <div><span class="eyebrow">×</span><strong class="mono">{mult.toFixed(2)}</strong></div>
      <div><span class="eyebrow">{t('dc.chance')}</span><strong class="mono">{(chance * 100).toFixed(1)} %</strong></div>
    </div>
    <p class="muted small">{t('a.profit')}: <span class="mono">{fmt(Math.round(bet * (mult - 1) * 100) / 100)}</span></p>
    {#if kind === 'mine'}<p class="muted small">{L('Jeder Würfel hat Bombenseiten. Landet einer darauf, explodiert er und der Einsatz ist weg. Überleben alle, gibt es den Multiplikator.', 'Each die has bomb faces. If one lands on a bomb it explodes and the stake is lost. If all survive, you get the multiplier.')}</p>{/if}
  {/snippet}

  <div class="table">
    <div class="stage"><Dice3D {values} {rolls} size={diceSize} faces={f} mines={kind === 'mine' ? mines : 0} ondone={() => done()} /></div>
    <div class="result">
      {#if last}
        {#if kind === 'mine'}
          <span class="sum" in:scale={{ start: 0.6, duration: 300 }}>{last.boom ? '💥 BOOM' : L('Überlebt', 'Survived')}</span>
        {:else}
          <span class="sum mono" in:scale={{ start: 0.6, duration: 300 }}>{last.sum}</span>
        {/if}
        <span class="mono" class:pos={last.win > 0} in:fly={{ y: 8 }}>{last.win > 0 ? '+' + fmt(last.win) : '0'}</span>
      {/if}
    </div>
    {#if kind !== 'mine'}
      <div class="opts" style="--n:{opts.length}">
        {#each opts as [o, name, range] (o)}
          <button class="opt" class:on={pickd === o} disabled={rolling} onclick={() => pick(o)}>
            <span>{name} <small class="mono">{range}</small></span><span class="mono">×{diceMult(o, count, f).toFixed(2)}</span>
          </button>
        {/each}
      </div>
      <div class="sums">
        {#each sums as o (o)}
          <button class="opt small" class:on={pickd === o} disabled={rolling} onclick={() => pick(o)}>
            <span class="mono">{o.slice(1)}</span><span class="mono m">×{diceMult(o, count, f).toFixed(1)}</span>
          </button>
        {/each}
      </div>
    {/if}
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
  .seg { display: flex; border: 1px solid var(--line-2); border-radius: 999px; padding: 3px; gap: 3px; }
  .seg button { flex: 1; border: 0; background: none; min-height: 36px; border-radius: 999px; color: var(--muted); }
  .seg button.on { background: var(--text); color: var(--bg); }

  /* a royal table: deep purple velvet, a damask shimmer and a gold inlay, like the coin toss */
  .table {
    --gold: #d6b25e;
    position: relative; border-radius: 28px; padding: clamp(16px, 3vw, 32px); color: #f6efdc; display: grid; gap: 18px; isolation: isolate;
    background:
      radial-gradient(circle at 50% 50%, rgba(214,178,94,.07) 0 2px, transparent 3px) 0 0 / 28px 28px,
      radial-gradient(ellipse at 50% 0%, #4a2a66, #24123a 55%, #12081f);
    box-shadow: 0 30px 60px -30px rgba(0,0,0,.7), inset 0 0 0 1px rgba(214,178,94,.55), inset 0 0 0 7px rgba(0,0,0,.25), inset 0 0 0 8px rgba(214,178,94,.25), inset 0 0 80px rgba(0,0,0,.5);
  }
  .table::before { content: '♛'; position: absolute; left: 50%; top: 10px; translate: -50% 0; font-size: 1.1rem; color: var(--gold); opacity: 0.55; z-index: -1; }
  .stage { padding: 10px 0 0; overflow: hidden; }
  .result { min-height: 54px; display: flex; gap: 16px; align-items: center; justify-content: center; font-size: 1.3rem; }
  .sum { font-size: 2.4rem; font-weight: 700; color: #ffe7a8; }
  .pos { color: #6ff0a6; }
  .opts { display: grid; grid-template-columns: repeat(var(--n), 1fr); gap: 8px; }
  .sums { display: grid; grid-template-columns: repeat(auto-fill, minmax(46px, 1fr)); gap: 6px; }
  .opt {
    display: grid; gap: 4px; justify-items: center; padding: 12px 6px; border-radius: 16px; border: 1px solid rgba(214,178,94,.28);
    background: rgba(0,0,0,.28); color: #f6efdc; font-weight: 600; transition: background-color 0.25s var(--ease-snap), color 0.25s var(--ease-snap), transform 0.35s var(--ease-snap);
  }
  .opt small { font-weight: 500; opacity: 0.7; }
  .opt:hover:not(:disabled) { transform: translateY(-2px); background: rgba(214,178,94,.12); }
  .opt:active:not(:disabled) { transform: scale(0.97); transition-duration: 0.16s; }
  .opt.on { background: linear-gradient(180deg, #f3d98f, #c79a3e); color: #2a1440; border-color: transparent; }
  .opt.small { padding: 8px 2px; font-size: 0.85rem; }
  .opt .m { font-size: 0.65rem; opacity: 0.7; }
  .hist { display: flex; gap: 6px; flex-wrap: wrap; min-height: 28px; }
  .hist span { min-width: 30px; height: 30px; padding: 0 4px; display: grid; place-items: center; border-radius: 8px; background: rgba(0,0,0,.35); font-size: 0.8rem; color: rgba(255,255,255,.6); }
  .hist span.pos { background: rgba(47,191,113,.25); }
  @media (max-width: 640px) {
    .opts { grid-template-columns: repeat(2, 1fr); }
  }
</style>
