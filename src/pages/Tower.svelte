<script lang="ts">
  import ArcadeLayout from '../components/ArcadeLayout.svelte';
  import BetInput from '../components/BetInput.svelte';
  import Sprite from '../components/Sprite.svelte';
  import { FLOORS, TOWER, CLIMB, planMult, lazyMine, placeRest, type TowerLevel, type Plan } from '../games/arcade';
  import { wallet, settle, stake, fmt } from '../lib/state.svelte';
  import { byId, gameName } from '../lib/games';
  import { sfx } from '../lib/sfx';
  import { t, type Key } from '../lib/i18n';
  import { settings } from '../lib/state.svelte';
  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);

  let bet = $state(10);
  let level = $state<TowerLevel>('medium');
  // classic: 8 floors of one difficulty; climb: 12 floors that get harder every three floors
  let mode = $state<'classic' | 'climb'>('classic');
  const ZONES = ['easy', 'medium', 'hard', 'expert'] as const;
  const plan: Plan = $derived(mode === 'climb' ? CLIMB : Array(FLOORS).fill(TOWER[level]));
  const zone = (f: number) => (mode === 'climb' ? ZONES[Math.floor(f / 3)] : level);
  let phase = $state<'idle' | 'play' | 'over'>('idle');
  let bombs = $state<Set<number>[]>([]);
  let picks = $state<number[]>([]); // chosen tile per cleared floor
  let lostAt = $state<[number, number] | null>(null);
  let stakeNow = $state(0);
  let won = $state(0);

  const floor = $derived(picks.length);
  const mult = $derived(planMult(plan, floor));

  function start() {
    if (bet > wallet.balance || bet <= 0) return;
    stakeNow = bet;
    stake(bet);
    bombs = []; // traps are rolled floor by floor when you pick a tile, never stored ahead
    picks = [];
    lostAt = null;
    won = 0;
    phase = 'play';
    sfx('chip');
  }
  function pick(f: number, i: number) {
    if (phase !== 'play' || f !== floor) return;
    const [n, b] = plan[f];
    const trap = lazyMine(b, n);
    bombs[f] = trap ? new Set([i, ...placeRest(b - 1, [i], n)]) : placeRest(b, [i], n);
    if (trap) for (let k = f + 1; k < plan.length; k++) bombs[k] = placeRest(plan[k][1], [], plan[k][0]);
    if (trap) {
      lostAt = [f, i];
      phase = 'over';
      settle(0, 0);
      sfx('boom');
      return;
    }
    picks = [...picks, i];
    sfx('gem');
    if (picks.length === plan.length) cashout();
  }
  function cashout() {
    if (phase !== 'play' || !floor) return;
    won = Math.round(stakeNow * mult * 100) / 100;
    settle(won, won);
    for (let k = floor; k < plan.length; k++) bombs[k] = placeRest(plan[k][1], [], plan[k][0]);
    phase = 'over';
    sfx('cash');
  }
  const shown = (f: number, i: number) => picks[f] === i || (phase === 'over' && (bombs[f]?.has(i) || f >= floor));
</script>

<ArcadeLayout eyebrow="Arcade · {plan.length} {t('tw.floor')}" title={gameName(byId('tower')!)}>
  {#snippet controls()}
    {#if phase === 'play'}
      <button class="btn big cash" disabled={!floor} onclick={cashout}>{t('a.cashout')} <span class="mono">{fmt(Math.round(stakeNow * mult * 100) / 100)}</span></button>
    {:else}
      <button class="btn primary big" disabled={bet > wallet.balance} onclick={start}>{phase === 'over' ? t('a.next') : t('a.start')}</button>
    {/if}
    <BetInput bind:value={bet} disabled={phase === 'play'} />
    <div class="field">{L('Modus', 'Mode')}
      <div class="seg two">
        <button class:on={mode === 'classic'} disabled={phase === 'play'} onclick={() => (mode = 'classic')}>{L('Klassisch', 'Classic')}</button>
        <button class:on={mode === 'climb'} disabled={phase === 'play'} onclick={() => (mode = 'climb')}>{L('Aufstieg', 'Climb')} · 12</button>
      </div>
    </div>
    {#if mode === 'climb'}
      <p class="small muted">{L('12 Etagen, alle drei Etagen wird es schwerer: Leicht, Mittel, Schwer, Experte. Ganz oben wartet die Krone mit ×' + planMult(CLIMB, 12).toFixed(0) + '.', '12 floors, every three floors it gets harder: easy, medium, hard, expert. The crown at the top pays ×' + planMult(CLIMB, 12).toFixed(0) + '.')}</p>
    {:else}
    <div class="field">{t('tw.level')}
      <div class="seg">
        {#each Object.keys(TOWER) as l}
          <button class:on={level === l} disabled={phase === 'play'} onclick={() => (level = l as TowerLevel)}>{t(('tw.' + l) as Key)}</button>
        {/each}
      </div>
    </div>
    {/if}
  {/snippet}

  <div class="tower" class:climb={mode === 'climb'}>
    {#if mode === 'climb'}<div class="crown" class:won={phase === 'over' && floor === plan.length}>♛</div>{/if}
    {#each plan as _, k}
      {@const f = plan.length - 1 - k}
      <div class="floor z-{zone(f)}" style="--tiles:{plan[f][0]}" class:zstart={mode === 'climb' && f % 3 === 2} class:current={phase === 'play' && f === floor} class:done={f < floor} class:locked={phase === 'play' && f > floor}>
        <span class="mult mono">×{planMult(plan, f + 1).toFixed(2)}</span>
        <div class="tiles">
          {#each Array(plan[f][0]) as _, i}
            {@const open = shown(f, i)}
            {@const bomb = bombs[f]?.has(i)}
            <button class="tile" class:open class:bomb={open && bomb} class:boom={lostAt?.[0] === f && lostAt?.[1] === i} class:dim={phase === 'over' && picks[f] !== i && !(lostAt?.[0] === f && lostAt?.[1] === i)}
              disabled={phase !== 'play' || f !== floor} onclick={() => pick(f, i)} aria-label="{t('tw.floor')} {f + 1}">
              <span class="ico">{#if open}<Sprite kind={bomb ? 'bomb' : 'gem'} />{/if}</span>
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</ArcadeLayout>

<style>
  .big { min-height: 54px; width: 100%; font-size: 1rem; }
  .cash:not(:disabled) { background: #2fbf71; color: #062a16; border-color: transparent; }
  .seg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .seg button { min-height: 38px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--bg-2); font-size: 0.8rem; transition: background-color 0.25s var(--ease-snap), color 0.25s var(--ease-snap), transform 0.16s var(--ease-snap); }
  .seg button.on { background: var(--text); color: var(--bg); }
  .seg button:active:not(:disabled) { transform: scale(0.97); }
  .seg button:disabled:not(.on) { opacity: 0.45; }
  .seg.two { grid-template-columns: 1fr 1fr; }
  .small { font-size: 0.8rem; margin: 0; } .muted { color: var(--muted); }
  /* climb mode: each zone of three floors has its own colour, the crown waits on top */
  .climb .floor { border-left: 3px solid var(--zc); }
  .climb .floor.zstart { margin-top: 6px; }
  .z-easy { --zc: #2fbf71; } .z-medium { --zc: #3d9bff; } .z-hard { --zc: #f2a51e; } .z-expert { --zc: #e5484d; }
  .climb .tile { background: linear-gradient(180deg, color-mix(in srgb, var(--zc) 30%, #3d4a72), #2e3858); }
  .crown { text-align: center; font-size: 2rem; color: #d6b25e; opacity: 0.5; line-height: 1; transition: opacity 0.4s, transform 0.4s var(--spring-snappy); }
  .crown.won { opacity: 1; transform: scale(1.3); text-shadow: 0 0 20px rgba(246, 215, 122, .8); }

  .tower {
    display: grid; gap: 8px; padding: clamp(14px, 2.4vw, 26px); border-radius: 28px; max-width: 640px; margin: 0 auto;
    background: linear-gradient(180deg, #1d1838, #0f1424); box-shadow: 0 30px 60px -30px rgba(0,0,0,.6);
  }
  .floor { display: grid; grid-template-columns: 70px 1fr; gap: 10px; align-items: center; padding: 6px; border-radius: 16px; transition: background-color 0.4s var(--ease-snap), opacity 0.4s var(--ease-snap); }
  .floor.current { background: rgba(255, 255, 255, 0.07); box-shadow: inset 0 0 0 1px rgba(255,255,255,.18); }
  .floor.locked { opacity: 0.5; }
  .mult { color: rgba(255,255,255,.65); font-size: 0.8rem; text-align: right; }
  .floor.current .mult { color: #fff; }
  .floor.done .mult { color: #8ff0bf; }
  .tiles { display: grid; grid-template-columns: repeat(var(--tiles), 1fr); gap: 8px; }
  .tile {
    height: clamp(40px, 6.2vh, 54px); border: 0; border-radius: 12px; background: linear-gradient(180deg, #3d4a72, #2e3858); box-shadow: inset 0 -4px 0 rgba(0,0,0,.3);
    display: grid; place-items: center; transition: transform 0.35s var(--ease-snap), background-color 0.3s var(--ease-snap), opacity 0.3s var(--ease-snap);
  }
  .tile:not(:disabled):hover { transform: translateY(-3px); }
  .tile:not(:disabled):active { transform: scale(0.97); }
  .tile:disabled { cursor: default; }
  .tile.open { background: #141a2b; box-shadow: inset 0 0 0 2px rgba(79, 227, 160, 0.4); animation: pop 0.5s var(--spring-snappy); }
  .tile.bomb { box-shadow: inset 0 0 0 2px rgba(229, 72, 77, 0.5); }
  .tile.boom { background: #5a1a1f; box-shadow: inset 0 0 0 2px #e5484d; }
  .tile.dim { opacity: 0.45; }
  .ico { width: 34px; height: 34px; }
  @keyframes pop { from { transform: scale(0.9); } }
  @media (max-width: 640px) { .tile { height: 34px; } .floor { grid-template-columns: 54px 1fr; padding: 3px 4px; } .tower { gap: 4px; } .ico { width: 26px; height: 26px; } }
</style>
