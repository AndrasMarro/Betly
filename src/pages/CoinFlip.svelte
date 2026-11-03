<script lang="ts">
  import { fly } from 'svelte/transition';
  import ArcadeLayout from '../components/ArcadeLayout.svelte';
  import BetInput from '../components/BetInput.svelte';
  import SlotSymbol from '../components/SlotSymbol.svelte';
  import { coinMult, flip } from '../games/arcade';
  import { wallet, settle, stake, fmt } from '../lib/state.svelte';
  import { byId, gameName } from '../lib/games';
  import { sfx } from '../lib/sfx';
  import { t } from '../lib/i18n';

  let bet = $state(10);
  let side = $state<'heads' | 'tails'>('heads');
  let phase = $state<'idle' | 'play' | 'over'>('idle'); // play = streak running, can flip again or cash out
  let wins = $state(0);
  let spin = $state(0); // accumulated rotation in degrees
  let flips = $state(0);
  let busy = $state(false);
  let stakeNow = $state(0);
  let won = $state(0);
  let history = $state<{ s: 'heads' | 'tails'; id: number }[]>([]);

  const mult = $derived(coinMult(wins));
  const next = $derived(coinMult(wins + 1));

  async function go() {
    if (busy) return;
    if (phase !== 'play') {
      if (bet > wallet.balance || bet <= 0) return;
      stakeNow = bet;
      stake(bet);
      wins = 0;
      won = 0;
    }
    busy = true;
    const r = flip();
    // land on the face that came up: heads = 0deg, tails = 180deg, plus 5-6 full turns
    const base = Math.ceil(spin / 360) * 360 + 360 * 5;
    spin = base + (r === 'tails' ? 180 : 0);
    flips++;
    sfx('flip');
    await new Promise((res) => setTimeout(res, 1300));
    history = [{ s: r, id: flips }, ...history].slice(0, 18);
    if (r === side) {
      wins++;
      phase = 'play';
      sfx('gem');
    } else {
      phase = 'over';
      wins = 0;
      settle(0, 0);
      sfx('lose');
    }
    busy = false;
  }
  function cashout() {
    if (phase !== 'play' || !wins || busy) return;
    won = Math.round(stakeNow * mult * 100) / 100;
    settle(won, won);
    phase = 'over';
    sfx('cash');
  }
  function key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, select, textarea, button')) return;
    if (e.code === 'Space') { e.preventDefault(); go(); }
  }
</script>

<svelte:window onkeydown={key} />

<ArcadeLayout eyebrow="Arcade · 50 / 50" title={gameName(byId('coinflip')!)}>
  {#snippet controls()}
    <button class="btn primary big" disabled={busy || (phase !== 'play' && bet > wallet.balance)} onclick={go}>
      {phase === 'play' ? t('cf.again') : t('cf.flip')} <span class="mono">×{(phase === 'play' ? next : coinMult(1)).toFixed(2)}</span>
    </button>
    {#if phase === 'play'}
      <button class="btn big cash" disabled={busy} onclick={cashout}>{t('a.cashout')} <span class="mono">{fmt(Math.round(stakeNow * mult * 100) / 100)}</span></button>
    {/if}
    <BetInput bind:value={bet} disabled={phase === 'play' || busy} />
    <div class="field">{t('cf.pick')}
      <div class="sides">
        {#each ['heads', 'tails'] as const as s}
          <button class:on={side === s} disabled={busy} onclick={() => { side = s; sfx('click'); }}>
            <span class="mini"><SlotSymbol sym={s === 'heads' ? 'crown' : 'star'} /></span>{t(s === 'heads' ? 'cf.heads' : 'cf.tails')}
          </button>
        {/each}
      </div>
    </div>
  {/snippet}

  <div class="stage">
    <div class="coinwrap" class:tossing={busy} style="animation-name:{flips ? (flips % 2 ? 'tossA' : 'tossB') : 'none'}">
      <div class="coin" style="transform: rotateY({spin}deg)">
        <div class="face"><SlotSymbol sym="crown" /></div>
        <div class="face back"><SlotSymbol sym="star" /></div>
        <i class="rim"></i>
      </div>
    </div>
    <div class="shadow" style="animation-name:{flips ? (flips % 2 ? 'shadeA' : 'shadeB') : 'none'}"></div>
    <div class="info">
      <div><span class="eyebrow light">{t('cf.streak')}</span><strong class="mono">{wins}</strong></div>
      <div><span class="eyebrow light">×</span><strong class="mono">{mult.toFixed(2)}</strong></div>
      <div><span class="eyebrow light">{t('bet.win')}</span><strong class="mono" class:pos={won > 0}>{fmt(won || Math.round(stakeNow * (wins ? mult : 0) * 100) / 100)}</strong></div>
    </div>
    <div class="hist">
      {#each history as h (h.id)}<span class="dot {h.s}" in:fly={{ x: -10, duration: 250 }}>{h.s === 'heads' ? t('cf.heads')[0] : t('cf.tails')[0]}</span>{/each}
    </div>
  </div>
</ArcadeLayout>

<style>
  .big { min-height: 54px; width: 100%; font-size: 1rem; }
  .cash:not(:disabled) { background: #2fbf71; color: #062a16; border-color: transparent; }
  .sides { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .sides button { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; border-radius: 14px; border: 1px solid var(--line-2); background: var(--bg-2); transition: background-color 0.25s var(--ease-snap), color 0.25s var(--ease-snap), transform 0.16s var(--ease-snap); }
  .sides button.on { background: var(--text); color: var(--bg); }
  .sides button:active:not(:disabled) { transform: scale(0.97); }
  .mini { width: 22px; height: 22px; }
  .stage {
    display: grid; justify-items: center; gap: 18px; padding: 56px 20px 24px; border-radius: 28px; color: #f4f2ee; min-height: 440px;
    background: radial-gradient(ellipse at 50% 30%, #2b2a46, #101020 70%); box-shadow: 0 30px 60px -30px rgba(0,0,0,.6); perspective: 1000px;
  }
  .coinwrap { animation-duration: 1.3s; animation-timing-function: var(--ease-snap); animation-fill-mode: both; transform-style: preserve-3d; }
  @keyframes tossA { 0% { transform: translateY(0); } 45% { transform: translateY(-110px) scale(1.1); } 85% { transform: translateY(0) scale(1); } 92% { transform: translateY(-8px); } 100% { transform: none; } }
  @keyframes tossB { 0% { transform: translateY(0); } 45% { transform: translateY(-110px) scale(1.1); } 85% { transform: translateY(0) scale(1); } 92% { transform: translateY(-8px); } 100% { transform: none; } }
  .coin { --s: clamp(150px, 22vw, 200px); width: var(--s); height: var(--s); position: relative; transform-style: preserve-3d; transition: transform 1.3s var(--spring-smooth); }
  .face {
    position: absolute; inset: 0; border-radius: 50%; backface-visibility: hidden; padding: 22%;
    background: radial-gradient(circle at 35% 30%, #fff2b8, #f2c046 40%, #b9821f 100%);
    box-shadow: inset 0 0 0 6px #d9a536, inset 0 0 0 9px #f7d77a, inset 0 0 22px rgba(0,0,0,.25);
  }
  .face.back { transform: rotateY(180deg); background: radial-gradient(circle at 35% 30%, #f4f4f8, #c6c9d6 45%, #7d8296 100%); box-shadow: inset 0 0 0 6px #a3a8b8, inset 0 0 0 9px #e2e4ec, inset 0 0 22px rgba(0,0,0,.25); }
  .rim { position: absolute; inset: 0; border-radius: 50%; transform: translateZ(-1px); background: #8a6420; }
  .shadow { width: 150px; height: 16px; border-radius: 50%; background: radial-gradient(closest-side, rgba(0,0,0,.6), transparent); margin-top: -6px; animation-duration: 1.3s; animation-timing-function: var(--ease-snap); animation-fill-mode: both; }
  @keyframes shadeA { 45% { transform: scale(0.5); opacity: 0.4; } 85% { transform: scale(1); opacity: 1; } }
  @keyframes shadeB { 45% { transform: scale(0.5); opacity: 0.4; } 85% { transform: scale(1); opacity: 1; } }
  .info { display: grid; grid-template-columns: repeat(3, minmax(90px, 1fr)); gap: 10px; width: min(100%, 460px); margin-top: 10px; }
  .info div { display: grid; gap: 4px; justify-items: center; background: rgba(0,0,0,.25); border-radius: 16px; padding: 12px; }
  .info strong { font-size: 1.2rem; }
  .eyebrow.light { color: rgba(255,255,255,.5); }
  .pos { color: #8ff0bf; }
  @media (max-width: 640px) { .stage { min-height: 0; padding-top: 40px; } }
  .hist { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; min-height: 28px; }
  .dot { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font: 700 0.7rem 'Geist Mono Variable', monospace; }
  .dot.heads { background: #f2c046; color: #3a2a06; }
  .dot.tails { background: #c6c9d6; color: #22252e; }
</style>
