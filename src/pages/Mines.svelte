<script lang="ts">
  import { scale } from 'svelte/transition';
  import ArcadeLayout from '../components/ArcadeLayout.svelte';
  import BetInput from '../components/BetInput.svelte';
  import Sprite from '../components/Sprite.svelte';
  import { TILES, minesMult, lazyMine, placeRest } from '../games/arcade';
  import { wallet, settle, stake, fmt } from '../lib/state.svelte';
  import { sfx } from '../lib/sfx';
  import { pop } from '../lib/motion';
  import { t } from '../lib/i18n';
  import { byId, gameName } from '../lib/games';

  let bet = $state(10);
  let mines = $state(3);
  let phase = $state<'idle' | 'play' | 'over'>('idle');
  let field = $state(new Set<number>());
  let open = $state<number[]>([]);
  let hit = $state(-1);
  let won = $state(0);
  let stakeNow = $state(0);

  const picks = $derived(open.length);
  const mult = $derived(minesMult(mines, picks));
  const nextMult = $derived(picks < TILES - mines ? minesMult(mines, picks + 1) : mult);

  function start() {
    if (bet > wallet.balance || bet <= 0) return;
    stakeNow = bet;
    stake(bet);
    field = new Set(); // nothing is decided yet: every tile is rolled when you click it
    open = [];
    hit = -1;
    won = 0;
    phase = 'play';
    sfx('chip');
  }
  function pick(i: number) {
    if (phase !== 'play' || open.includes(i)) return;
    if (lazyMine(mines, TILES - open.length)) {
      field = new Set([i, ...placeRest(mines - 1, [...open, i])]);
      hit = i;
      phase = 'over';
      settle(0, 0);
      sfx('boom');
      return;
    }
    open = [...open, i];
    sfx('gem');
    if (open.length === TILES - mines) cashout();
  }
  function cashout() {
    if (phase !== 'play' || !picks) return;
    won = Math.round(stakeNow * mult * 100) / 100;
    settle(won, won);
    field = placeRest(mines, open); // show where the mines would have been
    phase = 'over';
    sfx('cash');
  }
  function randomPick() {
    const free = Array.from({ length: TILES }, (_, i) => i).filter((i) => !open.includes(i));
    pick(free[Math.floor(Math.random() * free.length)]);
  }
  function key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, select, textarea, button')) return;
    if (e.code === 'Space') { e.preventDefault(); phase === 'play' ? randomPick() : start(); }
  }
</script>

<svelte:window onkeydown={key} />

<ArcadeLayout eyebrow="Arcade · 5×5" title={gameName(byId('mines')!)}>
  {#snippet controls()}
    {#if phase === 'play'}
      <button class="btn big cash" disabled={!picks} onclick={cashout}>
        {t('a.cashout')} <span class="mono">{fmt(Math.round(stakeNow * mult * 100) / 100)}</span>
      </button>
      <button class="btn" onclick={randomPick}>{t('mn.random')}</button>
    {:else}
      <button class="btn primary big" disabled={bet > wallet.balance} onclick={start}>{phase === 'over' ? t('a.next') : t('a.start')}</button>
    {/if}
    <BetInput bind:value={bet} disabled={phase === 'play'} />
    <label class="field">{t('mn.mines')}: <strong class="mono">{mines}</strong>
      <input type="range" min="1" max="24" bind:value={mines} disabled={phase === 'play'} />
    </label>
    <div class="stats">
      <div><span class="eyebrow">×</span><strong class="mono">{mult.toFixed(2)}</strong></div>
      <div><span class="eyebrow">{t('mn.next')}</span><strong class="mono">×{nextMult.toFixed(2)}</strong></div>
    </div>
  {/snippet}

  <div class="board" class:over={phase === 'over'} class:boom={hit >= 0}>
    {#each Array(TILES) as _, i}
      {@const isOpen = open.includes(i)}
      {@const show = isOpen || (phase === 'over' && (field.has(i) || hit >= 0))}
      <button class="tile" class:open={isOpen} class:hit={hit === i} class:ghost={!isOpen && show} disabled={phase !== 'play' || isOpen} onclick={() => pick(i)} aria-label="Tile {i + 1}">
        {#if show}
          <span class="ico" class:rise={isOpen}><Sprite kind={field.has(i) ? 'bomb' : 'gem'} /></span>
        {/if}
      </button>
    {/each}
    {#if phase === 'over'}
      <div class="banner" class:lose={hit >= 0} in:pop>
        {#if hit >= 0}{t('mn.boom')}{:else}<span class="mono">×{mult.toFixed(2)}</span> +{fmt(won)}{/if}
      </div>
    {/if}
  </div>
</ArcadeLayout>

<style>
  .big { min-height: 54px; width: 100%; font-size: 1rem; }
  .cash:not(:disabled) { background: #2fbf71; color: #062a16; border-color: transparent; }
  .field input[type='range'] { accent-color: var(--accent); }
  .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .stats div { background: var(--bg-2); border-radius: 14px; padding: 10px 12px; display: grid; gap: 4px; }
  .stats strong { font-size: 1.15rem; }
  .board {
    position: relative; display: grid; grid-template-columns: repeat(5, 1fr); gap: clamp(6px, 1.2vw, 12px); padding: clamp(12px, 2vw, 24px);
    border-radius: 28px; background: radial-gradient(ellipse at 50% 0%, #1c2a3a, #0b121b); max-width: min(620px, max(300px, calc(100dvh - var(--nav-h) - 170px))); margin: 0 auto; box-shadow: 0 30px 60px -30px rgba(0,0,0,.6);
  }
  .tile {
    aspect-ratio: 1; border: 0; border-radius: 16px; background: linear-gradient(180deg, #34496a, #2a3b52); box-shadow: inset 0 -5px 0 rgba(0,0,0,.3);
    padding: 18%; position: relative; overflow: hidden; transition: transform 0.35s var(--ease-snap), background-color 0.25s var(--ease-snap);
  }
  .tile:not(:disabled):hover { transform: translateY(-3px); background: linear-gradient(180deg, #3f5880, #31455f); }
  .tile:disabled { cursor: default; }
  .tile:not(:disabled):active { transform: scale(0.97); transition-duration: 0.16s; }
  /* reveal: the tile dips, a ring of light bursts out, the gem springs up and catches a glint */
  .tile.open { background: #13202e; box-shadow: inset 0 0 0 2px rgba(79, 227, 160, .35), 0 0 24px rgba(79, 227, 160, .12); animation: dip 0.5s var(--spring-snappy); overflow: visible; }
  @keyframes dip { 0% { transform: scale(0.88); background: #3f5880; } 100% { transform: none; } }
  .tile.open::before { content: ''; position: absolute; inset: 0; border-radius: inherit; box-shadow: 0 0 0 0 rgba(111, 240, 166, .7); animation: ring 0.6s var(--ease-snap) forwards; pointer-events: none; }
  @keyframes ring { to { box-shadow: 0 0 0 14px rgba(111, 240, 166, 0); } }
  .ico.rise { animation: gemIn 0.6s var(--spring-snappy) both; }
  @keyframes gemIn { 0% { transform: translateY(35%) scale(0.2) rotate(-20deg); opacity: 0; } 55% { opacity: 1; } 100% { transform: none; } }
  .tile.open::after { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; overflow: hidden;
    background: linear-gradient(115deg, transparent 35%, rgba(255,255,255,.35) 50%, transparent 65%) -150% 0 / 250% 100% no-repeat; animation: glint 0.9s 0.25s var(--ease-snap) forwards; }
  @keyframes glint { to { background-position: 150% 0; } }
  .board.boom { animation: shake 0.45s var(--ease-snap); }
  .tile.hit { background: #5a1a1f; box-shadow: inset 0 0 0 2px #e5484d; animation: shake 0.4s; }
  .tile.ghost .ico { opacity: 0.4; animation: fadeIn 0.4s var(--ease-snap) both; }
  @keyframes fadeIn { from { opacity: 0; transform: scale(0.7); } }
  .ico { display: block; width: 100%; height: 100%; }
  @keyframes shake { 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
  .banner {
    position: absolute; left: 50%; top: 50%; translate: -50% -50%; padding: 14px 24px; border-radius: 999px; background: #0b121b; color: #6ff0a6;
    font: 700 1.3rem 'Geist Mono Variable', monospace; box-shadow: 0 0 0 2px #6ff0a6, 0 20px 50px rgba(0,0,0,.6); white-space: nowrap; pointer-events: none;
  }
  .banner.lose { color: #ff9a9d; box-shadow: 0 0 0 2px #e5484d, 0 20px 50px rgba(0,0,0,.6); }
</style>
