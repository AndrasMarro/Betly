<script lang="ts">
  // Animated scenes for the Lotto guide, built from the game's own parts (ticket card, drum, balls).
  import { onDestroy, onMount } from 'svelte';
  import LottoCard from './LottoCard.svelte';
  import LottoDrum from './LottoDrum.svelte';
  import { LOTTO_TABLE, DAILY_PRIZE, RANKS } from '../games/lotto';
  import { drawAt, openDay } from '../lib/dailyLotto';
  import { settings } from '../lib/state.svelte';
  let { kind }: { kind: 'pick' | 'draw' | 'hits' | 'ranks' | 'daily' | 'room' } = $props();
  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);

  const PICK = [4, 11, 19, 27, 33, 40], DRAWN = [27, 4, 36, 19, 12, 41], LUCKY = 5;
  let step = $state(0); // advances over time and loops
  let now = $state(Date.now());
  let timer: ReturnType<typeof setInterval>;
  onMount(() => {
    const ms = kind === 'draw' ? 750 : kind === 'pick' ? 450 : 600, len = kind === 'pick' ? 11 : kind === 'draw' ? 11 : 11;
    timer = setInterval(() => { step = (step + 1) % len; now = Date.now(); }, ms);
  });
  onDestroy(() => clearInterval(timer));

  const picked = $derived({ nums: PICK.slice(0, Math.min(step, 6)), lucky: step > 6 ? LUCKY : 0 });
  const shown = $derived(DRAWN.slice(0, Math.min(step, 6)));
  const left = $derived(Math.max(0, drawAt(openDay(now)) - now));
  const hms = (ms: number) => [ms / 3600e3, (ms / 60e3) % 60, (ms / 1e3) % 60].map((x) => String(Math.floor(x)).padStart(2, '0')).join(':');
  const rankName = (i: number) => `${RANKS[i][0]}${RANKS[i][1] ? ' + ★' : ''}`;
</script>

<div class="lfelt">
  {#if kind === 'pick'}
    <div class="cardbox"><LottoCard ticket={picked} label={L('Schein', 'Ticket') + ' 1'} /></div>
    <div class="note">
      <b class:ok={picked.nums.length === 6}>{picked.nums.length} / 6</b><span>{L('Zahlen ankreuzen', 'mark numbers')}</span>
      <b class:ok={!!picked.lucky}>★ {picked.lucky || '–'}</b><span>{L('eine Glückszahl', 'one lucky number')}</span>
    </div>
  {:else if kind === 'draw'}
    <div class="drum"><LottoDrum balls={Array.from({ length: 42 }, (_, i) => i + 1).filter((n) => !shown.includes(n))} mixing={step < 8} /></div>
    <div class="balls">
      {#each DRAWN as n, i}<span class="ball" class:in={i < shown.length}>{i < shown.length ? n : ''}</span>{/each}
      <span class="ball gold" class:in={step > 6}>{step > 6 ? '★' + LUCKY : ''}</span>
    </div>
  {:else if kind === 'hits'}
    <div class="cardbox"><LottoCard ticket={{ nums: PICK, lucky: LUCKY }} label={L('Schein', 'Ticket') + ' 1'} drawn={shown} lucky={step > 6 ? LUCKY : 0}
      result={step > 6 ? '3 + ★ · ×' + LOTTO_TABLE[6] : ''} win={step > 6} /></div>
    <div class="balls col">
      {#each DRAWN as n, i}<span class="ball sm" class:in={i < shown.length} class:hit={PICK.includes(n)}>{i < shown.length ? n : ''}</span>{/each}
      <span class="ball sm gold" class:in={step > 6}>{step > 6 ? '★' + LUCKY : ''}</span>
    </div>
  {:else if kind === 'ranks'}
    <table>
      <thead><tr><th>{L('Richtige', 'Right')}</th><th>{L('Runde', 'Round')}</th><th>{L('Tageslotto', 'Daily')}</th></tr></thead>
      <tbody>
        {#each [0, 2, 4, 6, 7, 8] as r, k}
          <tr class:on={step % 6 === k}><td>{rankName(r)}</td><td class="mono">×{LOTTO_TABLE[r].toLocaleString('de-CH')}</td><td class="mono">{DAILY_PRIZE[r].toLocaleString('de-CH')}</td></tr>
        {/each}
      </tbody>
    </table>
  {:else if kind === 'daily'}
    <div class="daily">
      <span class="muted">{L('Nächste Ziehung · 20:00', 'Next draw · 20:00')}</span>
      <strong class="mono">{hms(left)}</strong>
      <div class="names">{#each ['Mila', 'Jonas', L('Du', 'You'), 'Lea', 'Sven'] as n, i}<span class:in={step > i}>{n}</span>{/each}</div>
      <span class="win" class:in={step > 6}>🏆 Mila · 4 + ★ · +{DAILY_PRIZE[4].toLocaleString('de-CH')}</span>
    </div>
  {:else}
    <div class="board">
      {#each [['Mila', [4, 19, 27, 33], '+' + 10 * LOTTO_TABLE[5]], [L('Du', 'You'), [4, 19, 27], '+' + 10 * LOTTO_TABLE[7]], ['Jonas', [12], '–']] as [n, h, w], i}
        <div class="who" class:top={i === 0}>
          <b>{i + 1}. {n}</b>
          {#each [4, 12, 19, 27, 33, 41] as x, k}<em class:hit={(h as number[]).includes(x) && step > k}>{x}</em>{/each}
          <span class="mono" class:pos={w !== '–'}>{step > 6 ? w : ''}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .lfelt {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 18px; color: #f7ecd4; overflow: hidden;
    background: radial-gradient(ellipse at 50% 30%, #16306e, #0a1636 80%); box-shadow: inset 0 0 0 4px rgba(216,178,106,.55);
  }
  .cardbox { width: 129px; height: 166px; }
  .cardbox :global(.card) { transform: scale(0.56); transform-origin: top left; width: 230px; }
  .note { display: grid; grid-template-columns: auto auto; gap: 4px 10px; align-items: baseline; font-size: 0.82rem; }
  .note b { font: 700 1.05rem 'Geist Mono Variable', monospace; color: rgba(247,236,212,.5); transition: color 0.3s; }
  .note b.ok { color: #f3d488; }
  .note span { color: rgba(247,236,212,.75); }
  .drum { width: 150px; }
  .drum :global(.drum) { width: 150px; max-width: none; }
  .balls { display: grid; grid-template-columns: repeat(4, 36px); gap: 8px; }
  .balls.col { grid-template-columns: repeat(2, 30px); gap: 6px; }
  .ball { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; font: 800 0.85rem 'Geist Mono Variable', monospace; color: #1d1d22;
    background: rgba(0,0,0,.3); box-shadow: inset 0 2px 5px rgba(0,0,0,.5); transition: transform 0.4s var(--spring-snappy); transform: scale(0.85); }
  .ball.sm { width: 30px; height: 30px; font-size: 0.72rem; }
  .ball.in { background: radial-gradient(circle at 35% 30%, #fff, #d4d9e4 70%, #9da3b2); box-shadow: 0 4px 8px rgba(0,0,0,.4); transform: scale(1); }
  .ball.in.hit { background: radial-gradient(circle at 35% 30%, #c4fbe0, #2fbf71); color: #04311b; }
  .ball.gold.in { background: radial-gradient(circle at 35% 30%, #fff1b8, #e0a92a 70%, #9a6b10); font-size: 0.72rem; }
  table { border-collapse: collapse; font-size: 0.74rem; }
  th { font-weight: 500; color: #e8c478; padding: 1px 14px; text-align: left; }
  td { padding: 1.5px 14px; border-top: 1px solid rgba(232,196,120,.15); transition: background 0.3s; }
  tr.on td { background: rgba(232,196,120,.22); }
  .daily { display: grid; justify-items: center; gap: 6px; }
  .daily strong { font-size: 1.8rem; color: #f3d488; letter-spacing: 0.04em; }
  .muted { color: rgba(247,236,212,.6); font-size: 0.8rem; }
  .names { display: flex; gap: 5px; }
  .names span, .win { padding: 3px 10px; border-radius: 999px; background: rgba(0,0,0,.3); box-shadow: inset 0 0 0 1px rgba(232,196,120,.25); font-size: 0.75rem; opacity: 0; transform: translateY(6px); transition: opacity 0.3s, transform 0.4s var(--spring-snappy); }
  .names span.in, .win.in { opacity: 1; transform: none; }
  .win { background: linear-gradient(90deg, rgba(232,196,120,.3), rgba(232,196,120,.08)); }
  .board { display: grid; gap: 6px; }
  .who { display: flex; gap: 3px; align-items: center; padding: 4px 10px; border-radius: 10px; background: rgba(0,0,0,.3); box-shadow: inset 0 0 0 1px rgba(232,196,120,.2); font-size: 0.75rem; }
  .who.top { box-shadow: inset 0 0 0 1px #e8c478; }
  .who b { min-width: 64px; font-weight: 600; }
  .who em { font: normal 600 0.66rem 'Geist Mono Variable', monospace; min-width: 20px; text-align: center; border-radius: 5px; padding: 2px 0; background: rgba(255,255,255,.08); transition: background 0.3s; }
  .who em.hit { background: #2fbf71; color: #04311b; }
  .who .mono { min-width: 54px; text-align: right; color: rgba(247,236,212,.5); }
  .who .pos { color: #6ff0a6; }
</style>
