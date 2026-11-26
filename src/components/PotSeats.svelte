<script lang="ts">
  // The players of a party game around the pot: name, stake in chips (everyone sees what everyone bets),
  // a score, whose turn it is, and at the end what each one takes home.
  import { flip } from 'svelte/animate';
  import { fmt, settings } from '../lib/state.svelte';
  export type Seat = { id: string; name: string; bot?: boolean; local?: boolean; stake: number; score?: number | string; team?: number; out?: boolean };
  let { seats, me, turn = '', payouts = null, label = '' }: { seats: Seat[]; me: string; turn?: string; payouts?: Record<string, number> | null; label?: string } = $props();
  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
  const pot = $derived(Math.round(seats.reduce((a, s) => a + s.stake, 0) * 100) / 100);
  // chip colours by size, like the tables
  const chip = (v: number) => (v >= 1000 ? 1000 : v >= 500 ? 500 : v >= 100 ? 100 : v >= 25 ? 25 : v >= 5 ? 5 : 1);
</script>

<div class="pot">
  <div class="sum"><span class="eyebrow">{label || L('Topf', 'Pot')}</span><strong class="mono">{fmt(pot)}</strong></div>
  <ul>
    {#each seats as s (s.id)}
      {@const net = payouts ? (payouts[s.id] ?? 0) - s.stake : null}
      <li class:me={s.id === me} class:turn={s.id === turn} class:out={s.out} class="t{s.team ?? 0}" animate:flip={{ duration: 400 }}>
        <span class="av" class:bot={s.bot}>{s.bot ? '🤖' : s.name.slice(0, 1).toUpperCase()}</span>
        <span class="nm">{s.name}{#if s.local}<em> · {L('am Gerät', 'this device')}</em>{/if}</span>
        {#if s.score !== undefined}<span class="sc mono">{s.score}</span>{/if}
        <span class="stake">
          {#if s.stake > 0}{#each Array(Math.min(5, Math.ceil(Math.log10(s.stake + 1) * 1.6))) as _, i}<span class="chip" data-v={chip(s.stake)} style="--size:18px; --i:{i}"></span>{/each}{/if}
          <span class="mono">{s.stake ? fmt(s.stake) : '–'}</span>
        </span>
        {#if net !== null}<span class="net mono" class:pos={net > 0} class:neg={net < 0}>{net > 0 ? '+' : ''}{fmt(net)}</span>{/if}
      </li>
    {/each}
  </ul>
</div>

<style>
  .pot { display: grid; gap: 10px; }
  .sum { display: flex; justify-content: space-between; align-items: baseline; }
  .sum strong { font-size: 1.3rem; color: var(--gold); }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  li { display: grid; grid-template-columns: 28px 1fr auto auto auto; gap: 8px; align-items: center; padding: 6px 10px 6px 6px; border-radius: 14px; background: rgba(0,0,0,.22); box-shadow: inset 0 0 0 1px rgba(232,196,120,.14); transition: box-shadow 0.3s var(--ease-snap), opacity 0.3s var(--ease-snap); }
  li.t1 { box-shadow: inset 3px 0 0 #3d7cf0, inset 0 0 0 1px rgba(232,196,120,.14); }
  li.t2 { box-shadow: inset 3px 0 0 #e5484d, inset 0 0 0 1px rgba(232,196,120,.14); }
  li.me { background: rgba(232,196,120,.12); }
  li.turn { box-shadow: inset 0 0 0 2px #f3d488, 0 0 18px -4px rgba(243,212,136,.6); }
  li.out { opacity: 0.45; }
  .av { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background: #e8c478; color: #2a1c05; font-weight: 700; font-size: 0.8rem; }
  .av.bot { background: rgba(255,255,255,.1); font-size: 0.85rem; }
  .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.9rem; }
  .nm em { font-style: normal; color: var(--muted); font-size: 0.75rem; }
  .sc { font-weight: 700; min-width: 2ch; text-align: right; }
  .stake { display: flex; align-items: center; gap: 0; font-size: 0.78rem; color: var(--muted); }
  .stake .chip { margin-right: -11px; box-shadow: 0 1px 2px rgba(0,0,0,.4); animation: drop 0.4s var(--spring-snappy) calc(var(--i) * 60ms) backwards; }
  .stake .mono { margin-left: 14px; }
  @keyframes drop { from { transform: translateY(-8px); opacity: 0; } }
  .net { font-weight: 700; font-size: 0.85rem; }
  .pos { color: #6ff0a6; } .neg { color: #ff9a9d; }
  @media (prefers-reduced-motion: reduce) { .stake .chip { animation: none; } }
</style>
