<script lang="ts">
  import { fly, scale } from 'svelte/transition';
  import ArcadeLayout from '../components/ArcadeLayout.svelte';
  import BetInput from '../components/BetInput.svelte';
  import SlotSymbol from '../components/SlotSymbol.svelte';
  import Coin3D from '../components/Coin3D.svelte';
  import CoinGL from '../components/CoinGL.svelte';
  let gl = $state(true); // the 3D model; falls back to the CSS coin without WebGL
  import { coinMult, flip } from '../games/arcade';
  import { wallet, settle, stake, fmt } from '../lib/state.svelte';
  import { byId, gameName } from '../lib/games';
  import { sfx } from '../lib/sfx';
  import { t } from '../lib/i18n';

  let bet = $state(10);
  let side = $state<'heads' | 'tails'>('heads');
  let phase = $state<'idle' | 'play' | 'over'>('idle'); // play = streak running, can flip again or cash out
  let wins = $state(0);
  let face = $state<'heads' | 'tails'>('heads');
  let done = () => {};
  let coinSize = $state(180);
  $effect(() => { coinSize = matchMedia('(max-width: 640px)').matches ? 120 : 190; });
  let flips = $state(0);
  let busy = $state(false);
  let stakeNow = $state(0);
  let won = $state(0);
  let history = $state<{ s: 'heads' | 'tails'; id: number }[]>([]);
  let cphase = $state<'air' | 'edge' | 'fall' | 'rest'>('rest');
  let last = $state<'heads' | 'tails' | null>(null);
  let lastHit = $state(false);

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
    last = null;
    const r = flip();
    // land on the face that came up: heads = 0deg, tails = 180deg, plus 5-6 full turns
    face = r;
    const landed = new Promise<void>((res) => (done = res));
    flips++;
    sfx('flip');
    await landed;
    history = [{ s: r, id: flips }, ...history].slice(0, 18);
    last = r;
    lastHit = r === side;
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
    <div class="coinbox">
      {#if gl}
        <CoinGL {face} tosses={flips} size={coinSize} ondone={() => done()} onphase={(p) => (cphase = p)} onfail={() => (gl = false)} />
      {:else}
        <Coin3D {face} tosses={flips} size={coinSize} heads={t('cf.heads')} tails={t('cf.tails')} ondone={() => done()} onphase={(p) => (cphase = p)} />
      {/if}
      <div class="call" aria-live="polite">
        {#if cphase === 'edge'}<span class="tense">{t('cf.edge')}</span>
        {:else if cphase === 'rest' && last}{#key flips}<span class="res {last}" class:hit={lastHit} in:scale={{ start: 0.6, duration: 380 }}>{t(last === 'heads' ? 'cf.heads' : 'cf.tails')}!</span>{/key}{/if}
      </div>
    </div>
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
  /* the 3D table fills the stage; the read-outs float on top of it */
  .stage {
    position: relative; display: grid; align-content: end; justify-items: center; gap: 10px; padding: 12px 16px 20px; overflow: hidden; border-radius: 28px; color: #f4f2ee; min-height: 520px; height: min(640px, calc(100dvh - var(--nav-h) - 170px));
    background: radial-gradient(ellipse at 50% 30%, #2b2a46, #101020 70%); box-shadow: 0 30px 60px -30px rgba(0,0,0,.6); perspective: 1000px;
  }
  .coinbox { position: absolute; inset: 0; }
  .info, .hist { position: relative; z-index: 1; }
  .info div { backdrop-filter: blur(6px); }
  .call { position: absolute; left: 0; right: 0; top: 6%; z-index: 1; display: grid; place-items: center; pointer-events: none; min-height: 48px; }
  .tense { font: 600 0.9rem 'Geist Mono Variable', monospace; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,.75); animation: tense 0.5s ease-in-out infinite alternate; }
  @keyframes tense { to { opacity: 0.35; letter-spacing: 0.3em; } }
  .res { font: 800 clamp(2rem, 6vw, 3.2rem) 'Geist Variable', sans-serif; letter-spacing: -0.03em; padding: 4px 22px; border-radius: 999px; }
  .res.heads { color: #f6d77a; } .res.tails { color: #dfe2ec; }
  .res.hit { text-shadow: 0 0 30px rgba(143, 240, 191, .55); }
  .res:not(.hit) { opacity: 0.85; }
  .info { display: grid; grid-template-columns: repeat(3, minmax(90px, 1fr)); gap: 10px; width: min(100%, 460px); margin-top: 10px; }
  .info div { display: grid; gap: 4px; justify-items: center; background: rgba(0,0,0,.25); border-radius: 16px; padding: 12px; }
  .info strong { font-size: 1.2rem; }
  .eyebrow.light { color: rgba(255,255,255,.5); }
  .pos { color: #8ff0bf; }
  @media (max-width: 640px) { .stage { min-height: 0; } }
  .hist { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; min-height: 28px; }
  .dot { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font: 700 0.7rem 'Geist Mono Variable', monospace; }
  .dot.heads { background: #f2c046; color: #3a2a06; }
  .dot.tails { background: #c6c9d6; color: #22252e; }
</style>
