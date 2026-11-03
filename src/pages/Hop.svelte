<script lang="ts">
  import { tick } from 'svelte';
  import { scale } from 'svelte/transition';
  import ArcadeLayout from '../components/ArcadeLayout.svelte';
  import BetInput from '../components/BetInput.svelte';
  import Sprite from '../components/Sprite.svelte';
  import { LANES, LEVELS, hopMult, survives, type Level } from '../games/arcade';
  import { wallet, settle, stake, fmt } from '../lib/state.svelte';
  import { sfx } from '../lib/sfx';
  import { t, type Key } from '../lib/i18n';

  let bet = $state(10);
  let level = $state<Level>('easy');
  let phase = $state<'idle' | 'play' | 'over'>('idle');
  let pos = $state(0); // 0 = sidewalk, 1..LANES = lanes
  let dead = $state(false);
  let busy = $state(false);
  let won = $state(0);
  let stakeNow = $state(0);
  let road: HTMLDivElement;

  const COLORS = ['#e5484d', '#6aa8ff', '#f2c046', '#4fe3a0', '#b57bff', '#f4f2ee', '#ff9f43'];
  // decorative traffic, one car per lane with its own speed
  const traffic = Array.from({ length: LANES }, (_, i) => ({ color: COLORS[i % COLORS.length], dur: 1.4 + Math.random() * 1.6, delay: -Math.random() * 3 }));

  const mult = $derived(hopMult(level, pos));
  const next = $derived(pos < LANES ? hopMult(level, pos + 1) : mult);

  function follow() {
    tick().then(() => road?.scrollTo({ left: Math.max(0, pos * 112 - road.clientWidth / 2 + 56), behavior: 'smooth' }));
  }
  function start() {
    if (bet > wallet.balance || bet <= 0) return;
    stakeNow = bet;
    stake(bet);
    pos = 0;
    dead = false;
    won = 0;
    phase = 'play';
    sfx('chip');
    follow();
  }
  async function hop() {
    if (phase !== 'play' || busy) return;
    busy = true;
    const ok = survives(level);
    pos++;
    sfx('hop');
    follow();
    await new Promise((r) => setTimeout(r, 320));
    if (!ok) {
      dead = true;
      await new Promise((r) => setTimeout(r, 260));
      sfx('splat');
      settle(0, 0);
      phase = 'over';
    } else if (pos === LANES) cashout();
    busy = false;
  }
  function cashout() {
    if (phase !== 'play' || pos === 0) return;
    won = Math.round(stakeNow * mult * 100) / 100;
    settle(won, won);
    phase = 'over';
    sfx('cash');
  }
  function key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, select, textarea, button')) return;
    if (e.code === 'Space' || e.key === 'ArrowRight') { e.preventDefault(); phase === 'play' ? hop() : start(); }
    if (e.key === 'Enter') cashout();
  }
</script>

<svelte:window onkeydown={key} />

<ArcadeLayout eyebrow="Arcade · {LANES} lanes" title="Hop Street">
  {#snippet controls()}
    {#if phase === 'play'}
      <button class="btn primary big" disabled={busy} onclick={hop}>{t('hp.hop')} <span class="mono">×{next.toFixed(2)}</span></button>
      <button class="btn big" disabled={busy || pos === 0} onclick={cashout}>{t('a.cashout')} <span class="mono">{fmt(Math.round(stakeNow * mult * 100) / 100)}</span></button>
    {:else}
      <button class="btn primary big" disabled={bet > wallet.balance} onclick={start}>{phase === 'over' ? t('a.next') : t('hp.go')}</button>
    {/if}
    <BetInput bind:value={bet} disabled={phase === 'play'} />
    <div class="field">{t('hp.level')}
      <div class="lv">
        {#each Object.keys(LEVELS) as l}
          <button class:on={level === l} disabled={phase === 'play'} onclick={() => (level = l as Level)}>{t(('hp.' + l) as Key)}</button>
        {/each}
      </div>
    </div>
  {/snippet}

  <div class="wrapr">
  <div class="road" bind:this={road}>
    <div class="strip" style="--lanes:{LANES}">
      <div class="curb start"></div>
      {#each traffic as car, i}
        {@const lane = i + 1}
        <div class="lane" class:passed={lane < pos || (lane === pos && !dead)} class:next={phase === 'play' && lane === pos + 1}>
          {#if lane > pos && !(dead && lane === pos)}
            <div class="car" style="animation-duration:{car.dur}s; animation-delay:{car.delay}s"><Sprite kind="car" color={car.color} /></div>
          {/if}
          {#if lane <= pos && !(dead && lane === pos)}<div class="barrier"></div>{/if}
          <div class="mult mono">×{hopMult(level, lane).toFixed(2)}</div>
          {#if dead && lane === pos}<div class="killer"><Sprite kind="car" color="#e5484d" /></div>{/if}
        </div>
      {/each}
      <div class="curb end"></div>
      <div class="hen" class:dead style="left:{pos * 112 + 20}px">
        <Sprite kind="chicken" />
      </div>
    </div>
  </div>
    {#if phase === 'over'}
      <div class="banner" class:lose={dead} in:scale={{ start: 0.8, duration: 300 }}>
        {#if dead}{t('hp.hit')}{:else}{t('hp.safe')} <span class="mono">×{mult.toFixed(2)} +{fmt(won)}</span>{/if}
      </div>
    {/if}
  </div>
</ArcadeLayout>

<style>
  .big { min-height: 54px; width: 100%; font-size: 1rem; }
  .lv { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
  .lv button { min-height: 38px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--bg-2); font-size: 0.85rem; }
  .lv button.on { background: var(--text); color: var(--bg); }
  .lv button:disabled:not(.on) { opacity: 0.45; }
  .wrapr { position: relative; }
  .road { position: relative; overflow-x: auto; border-radius: 28px; background: #2c2f36; scrollbar-width: thin; }
  .strip { position: relative; display: flex; height: clamp(320px, 52vh, 460px); width: calc((var(--lanes) + 2) * 112px); }
  .curb { flex: 0 0 112px; background: repeating-linear-gradient(0deg, #4a5a45 0 24px, #43523e 24px 48px); }
  .curb.end { background: repeating-linear-gradient(45deg, #f4f2ee 0 14px, #1d1d22 14px 28px); opacity: 0.85; }
  .lane { position: relative; flex: 0 0 112px; border-right: 3px dashed rgba(255,255,255,.28); overflow: hidden; transition: background 0.3s; }
  .lane.passed { background: rgba(79, 227, 160, 0.07); }
  .lane.next { background: rgba(255, 255, 255, 0.05); }
  .mult {
    position: absolute; left: 50%; top: 50%; translate: -50% -50%; width: 78px; height: 78px; border-radius: 50%; display: grid; place-items: center;
    background: #3a3e47; box-shadow: inset 0 0 0 4px #4b505b; color: #f4f2ee; font-size: 0.85rem; font-weight: 700;
  }
  .lane.passed .mult { background: #1f5c43; box-shadow: inset 0 0 0 4px #2f8f66; }
  .car { position: absolute; left: 50%; width: 64px; height: 104px; translate: -50% 0; top: -120px; animation: drive linear infinite; z-index: 1; }
  @keyframes drive { to { top: 110%; } }
  .killer { position: absolute; left: 50%; width: 64px; height: 104px; translate: -50% 0; top: -120px; z-index: 3; animation: smash 0.3s ease-in forwards; }
  @keyframes smash { to { top: calc(50% - 52px); } }
  .barrier { position: absolute; left: 10px; right: 10px; top: 14px; height: 12px; border-radius: 6px; background: repeating-linear-gradient(45deg, #f2c046 0 10px, #1d1d22 10px 20px); }
  .hen { position: absolute; top: 50%; width: 72px; height: 72px; translate: 0 -50%; z-index: 2; transition: left 0.32s cubic-bezier(0.3, 1.4, 0.5, 1); filter: drop-shadow(0 8px 10px rgba(0,0,0,.5)); }
  .hen.dead { animation: flat 0.3s 0.25s forwards; }
  @keyframes flat { to { transform: scaleY(0.25) translateY(80px); opacity: 0.7; } }
  .banner {
    position: absolute; left: 50%; bottom: 24px; translate: -50% 0; padding: 14px 24px; border-radius: 999px;
    background: #16181d; color: #6ff0a6; font: 700 1.2rem 'Geist Mono Variable', monospace; box-shadow: 0 0 0 2px #6ff0a6, 0 20px 50px rgba(0,0,0,.6); white-space: nowrap; z-index: 5;
  }
  .banner.lose { color: #ff9a9d; box-shadow: 0 0 0 2px #e5484d, 0 20px 50px rgba(0,0,0,.6); }
  @media (prefers-reduced-motion: reduce) { .car { display: none; } }
</style>
