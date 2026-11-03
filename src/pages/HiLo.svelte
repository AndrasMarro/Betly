<script lang="ts">
  import { fly } from 'svelte/transition';
  import ArcadeLayout from '../components/ArcadeLayout.svelte';
  import BetInput from '../components/BetInput.svelte';
  import CardView from '../components/Card.svelte';
  import { drawRank, hiloMult, pHigher, pLower } from '../games/arcade';
  import { wallet, settle, stake, fmt } from '../lib/state.svelte';
  import { sfx } from '../lib/sfx';
  import { t } from '../lib/i18n';
  import type { Card } from '../lib/cards';

  let bet = $state(10);
  let phase = $state<'idle' | 'play' | 'over'>('idle');
  let card = $state<Card>({ r: 0, s: 0 });
  let chain = $state<{ card: Card; dir: 'hi' | 'lo' | 'skip' | 'start'; id: number }[]>([]);
  let probs = $state<number[]>([]);
  let stakeNow = $state(0);
  let won = $state(0);
  let busy = $state(false);
  let n = 0;

  const deal = (): Card => ({ r: drawRank(), s: Math.floor(Math.random() * 4) });
  const mult = $derived(hiloMult(probs));
  const hi = $derived(pHigher(card.r)), lo = $derived(pLower(card.r));
  const pct = (p: number) => (p * 100).toFixed(1) + ' %';

  function start() {
    if (bet > wallet.balance || bet <= 0) return;
    stakeNow = bet;
    stake(bet);
    probs = [];
    won = 0;
    card = deal();
    chain = [{ card, dir: 'start', id: ++n }];
    phase = 'play';
    sfx('card');
  }
  async function guess(dir: 'hi' | 'lo' | 'skip') {
    if (phase !== 'play' || busy) return;
    busy = true;
    const prev = card.r, p = dir === 'hi' ? hi : lo;
    const nextCard = deal();
    card = nextCard;
    chain = [...chain, { card: nextCard, dir, id: ++n }].slice(-10);
    sfx('card');
    await new Promise((r) => setTimeout(r, 380));
    if (dir !== 'skip') {
      const ok = dir === 'hi' ? nextCard.r >= prev : nextCard.r <= prev;
      if (ok) { probs = [...probs, p]; sfx('gem'); }
      else { phase = 'over'; settle(0, 0); sfx('lose'); }
    }
    busy = false;
  }
  function cashout() {
    if (phase !== 'play' || !probs.length || busy) return;
    won = Math.round(stakeNow * mult * 100) / 100;
    settle(won, won);
    phase = 'over';
    sfx('cash');
  }
  const RANK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
</script>

<ArcadeLayout eyebrow="Arcade · A low, K high" title="Hi-Lo">
  {#snippet controls()}
    {#if phase === 'play'}
      <button class="btn big cash" disabled={!probs.length || busy} onclick={cashout}>{t('a.cashout')} <span class="mono">{fmt(Math.round(stakeNow * mult * 100) / 100)}</span></button>
    {:else}
      <button class="btn primary big" disabled={bet > wallet.balance} onclick={start}>{t('hl.start')}</button>
    {/if}
    <BetInput bind:value={bet} disabled={phase === 'play'} />
    <div class="stats">
      <div><span class="eyebrow">×</span><strong class="mono">{mult.toFixed(2)}</strong></div>
      <div><span class="eyebrow">{t('a.profit')}</span><strong class="mono">{fmt(Math.round(stakeNow * (mult - 1) * 100) / 100)}</strong></div>
    </div>
  {/snippet}

  <div class="table">
    <div class="deck">
      <div class="stack" aria-hidden="true"><CardView card={{ r: 0, s: 0 }} /></div>
      <div class="current">
        {#key chain.length}
          <div class="flip" in:fly={{ x: -140, duration: 450, opacity: 0.4 }}><CardView card={phase === 'idle' ? { r: 0, s: 0 } : card} /></div>
        {/key}
      </div>
    </div>
    <div class="guess">
      <button class="g hi" disabled={phase !== 'play' || busy || hi === 1} onclick={() => guess('hi')}>
        <span class="arrow">▲</span><span>{t('hl.higher')}</span>
        <span class="mono small">{pct(hi)} · ×{hiloMult([...probs, hi]).toFixed(2)}</span>
      </button>
      <button class="g lo" disabled={phase !== 'play' || busy || lo === 1} onclick={() => guess('lo')}>
        <span class="arrow">▼</span><span>{t('hl.lower')}</span>
        <span class="mono small">{pct(lo)} · ×{hiloMult([...probs, lo]).toFixed(2)}</span>
      </button>
      <button class="btn sm ghost skip" disabled={phase !== 'play' || busy} onclick={() => guess('skip')}>{t('hl.skip')} ↷</button>
    </div>
    <div class="chain">
      {#each chain as c (c.id)}
        <div class="mini" in:fly={{ x: 20, duration: 300 }}>
          <span class="dir mono">{c.dir === 'hi' ? '▲' : c.dir === 'lo' ? '▼' : c.dir === 'skip' ? '↷' : '•'}</span>
          <CardView card={c.card} small />
        </div>
      {/each}
    </div>
    {#if phase === 'over'}<p class="result mono" class:pos={won > 0} in:fly={{ y: 8 }}>{won > 0 ? '+' + fmt(won) : RANK[card.r] + ' · 0'}</p>{/if}
  </div>
</ArcadeLayout>

<style>
  .big { min-height: 54px; width: 100%; font-size: 1rem; }
  .cash:not(:disabled) { background: #2fbf71; color: #062a16; border-color: transparent; }
  .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .stats div { background: var(--bg-2); border-radius: 14px; padding: 10px 12px; display: grid; gap: 4px; }
  .stats strong { font-size: 1.1rem; }
  .table { display: grid; gap: 22px; justify-items: center; padding: clamp(20px, 3vw, 36px); border-radius: 28px; background: radial-gradient(ellipse at 50% 0%, var(--felt), var(--felt-2)); box-shadow: 0 30px 60px -30px rgba(0,0,0,.6); color: #fff; }
  .deck { display: flex; gap: 28px; align-items: center; --cw: clamp(100px, 14vw, 140px); }
  .stack { position: relative; opacity: 0.85; }
  .stack::before, .stack::after { content: ''; position: absolute; inset: 0; border-radius: 10px; background: #fbfaf7; transform: translate(4px, 4px); z-index: -1; opacity: 0.4; }
  .stack::after { transform: translate(8px, 8px); opacity: 0.2; }
  .current { min-width: var(--cw); }
  .guess { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: min(100%, 520px); }
  .g {
    display: grid; gap: 4px; justify-items: center; padding: 14px 10px; border-radius: 18px; border: 1px solid rgba(255,255,255,.18); color: #fff; font-weight: 600;
    transition: transform 0.35s var(--ease-snap), background-color 0.25s var(--ease-snap);
  }
  .g.hi { background: rgba(47, 191, 113, 0.18); }
  .g.lo { background: rgba(229, 72, 77, 0.18); }
  .g:hover:not(:disabled) { transform: translateY(-2px); }
  .g:active:not(:disabled) { transform: scale(0.97); transition-duration: 0.16s; }
  .g:disabled { opacity: 0.4; cursor: not-allowed; }
  .arrow { font-size: 1.1rem; }
  .small { font-size: 0.75rem; opacity: 0.8; font-weight: 500; }
  .skip { grid-column: 1 / -1; justify-self: center; color: rgba(255,255,255,.8); border-color: rgba(255,255,255,.2); }
  .chain { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; min-height: 80px; }
  .mini { display: grid; justify-items: center; gap: 4px; }
  .dir { font-size: 0.7rem; color: rgba(255,255,255,.7); }
  .result { margin: 0; font-size: 1.4rem; color: #ff9a9d; }
  .result.pos { color: #8ff0bf; }
</style>
