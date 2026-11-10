<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { scale } from 'svelte/transition';
  import ArcadeLayout from '../components/ArcadeLayout.svelte';
  import BetInput from '../components/BetInput.svelte';
  import Sprite from '../components/Sprite.svelte';
  import { LANES, LEVELS, hopMult, survives, type Level } from '../games/arcade';
  import { wallet, settle, stake, settings, fmt } from '../lib/state.svelte';
  import { sfx } from '../lib/sfx';
  import { t, type Key } from '../lib/i18n';

  const LANE_W = 120;
  let bet = $state(10);
  let level = $state<Level>('easy');
  let phase = $state<'idle' | 'play' | 'over'>('idle');
  let pos = $state(0); // 0 = sidewalk, 1..LANES = lanes
  let dead = $state(false);
  let cleared = $state(0); // lanes confirmed safe (the barrier drops only on these)
  let busy = $state(false);
  let won = $state(0);
  let stakeNow = $state(0);
  // themes: same game, different street
  const THEMES = ['country', 'city', 'desert', 'snow', 'night'] as const;
  type Theme = (typeof THEMES)[number];
  let theme = $state<Theme>((() => { try { return (localStorage.getItem('betly:hop-theme') as Theme) || 'country'; } catch { return 'country'; } })());
  $effect(() => { try { localStorage.setItem('betly:hop-theme', theme); } catch {} });
  const TNAME: Record<Theme, [string, string]> = { country: ['Land', 'Country'], city: ['Stadt', 'City'], desert: ['Wüste', 'Desert'], snow: ['Schnee', 'Snow'], night: ['Nacht', 'Night'] };
  let road: HTMLDivElement;
  let roadH = $state(420);

  const COLORS = ['#e5484d', '#4f8dff', '#f2c046', '#2fbf71', '#9b6bff', '#f4f2ee', '#ff8a3d', '#1d1d22'];
  type Car = { id: number; lane: number; color: string; kind: 'pass' | 'brake' | 'hit'; dur: number };
  let cars = $state<Car[]>([]);
  let carId = 0;
  const spawn = (lane: number, kind: Car['kind'], dur = 1.8 + Math.random() * 1.2) =>
    cars.push({ id: ++carId, lane, kind, dur, color: COLORS[Math.floor(Math.random() * COLORS.length)] });

  // Light, irregular traffic: only on lanes ahead, never on the lane you are about to step on.
  const traffic = setInterval(() => {
    if (document.hidden) return;
    for (let lane = Math.max(1, pos + 2); lane <= LANES; lane++)
      if (Math.random() < 0.045 && !cars.some((c) => c.lane === lane)) spawn(lane, 'pass');
  }, 500);
  onDestroy(() => clearInterval(traffic));

  const mult = $derived(hopMult(level, pos));
  const next = $derived(pos < LANES ? hopMult(level, pos + 1) : mult);
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  function follow() {
    tick().then(() => road?.scrollTo({ left: Math.max(0, pos * LANE_W - road.clientWidth / 3), behavior: 'smooth' }));
  }
  function start() {
    if (bet > wallet.balance || bet <= 0) return;
    stakeNow = bet;
    stake(bet);
    pos = 0;
    cleared = 0;
    dead = false;
    won = 0;
    cars = cars.filter((c) => c.kind === 'pass');
    phase = 'play';
    sfx('chip');
    follow();
  }
  async function hop() {
    if (phase !== 'play' || busy) return;
    busy = true;
    const ok = survives(level);
    cars = cars.filter((c) => c.lane !== pos + 1); // clear the lane we step into
    pos++;
    sfx('hop');
    follow();
    await sleep(380);
    if (!ok) {
      spawn(pos, 'hit', 0.34);
      await sleep(320);
      dead = true;
      sfx('splat');
      settle(0, 0);
      phase = 'over';
    } else {
      cleared = pos;
      if (Math.random() < 0.4) { spawn(pos, 'brake', 0.75); setTimeout(() => sfx('stop'), 520); }
      if (pos === LANES) cashout();
    }
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
      <button class="btn primary big" disabled={busy || pos === LANES} onclick={hop}>{t('hp.hop')} <span class="mono">×{next.toFixed(2)}</span></button>
      <button class="btn big cash" disabled={busy || pos === 0} onclick={cashout}>{t('a.cashout')} <span class="mono">{fmt(Math.round(stakeNow * mult * 100) / 100)}</span></button>
    {:else}
      <button class="btn primary big" disabled={bet > wallet.balance} onclick={start}>{phase === 'over' ? t('a.next') : t('hp.go')}</button>
    {/if}
    <BetInput bind:value={bet} disabled={phase === 'play'} />
    <div class="field">Theme
      <div class="themes">
        {#each THEMES as th}<button class="th {th}" class:on={theme === th} onclick={() => (theme = th)} title={TNAME[th][settings.lang === 'de' ? 0 : 1]}><i></i><span>{TNAME[th][settings.lang === 'de' ? 0 : 1]}</span></button>{/each}
      </div>
    </div>
    <div class="field">{t('hp.level')}
      <div class="seg4">
        {#each Object.keys(LEVELS) as l}
          <button class:on={level === l} disabled={phase === 'play'} onclick={() => (level = l as Level)}>{t(('hp.' + l) as Key)}</button>
        {/each}
      </div>
    </div>
  {/snippet}

  <div class="frame t-{theme}">
    <div class="hud">
      <div><span class="eyebrow">×</span><strong class="mono">{mult.toFixed(2)}</strong></div>
      <div><span class="eyebrow">{t('mn.next')}</span><strong class="mono">×{next.toFixed(2)}</strong></div>
      <div><span class="eyebrow">{t('a.profit')}</span><strong class="mono">{fmt(Math.round(stakeNow * (mult - 1) * 100) / 100)}</strong></div>
    </div>
    <div class="road" bind:this={road} bind:clientHeight={roadH}>
      <div class="strip" style="--lanes:{LANES}; --lw:{LANE_W}px; --h:{roadH}px">
        <div class="curb start"></div>
        {#each Array(LANES) as _, i}
          {@const lane = i + 1}
          <div class="lane" class:passed={lane <= cleared} class:next={phase === 'play' && lane === pos + 1} class:hit={dead && lane === pos}>
            <div class="hole"><span class="mono">×{hopMult(level, lane).toFixed(2)}</span></div>
            <div class="gate"></div>
          </div>
        {/each}
        <div class="curb end"><span class="flag mono">GOAL</span></div>

        {#each cars as c (c.id)}
          <div class="car {c.kind}" style="left:{c.lane * LANE_W + LANE_W / 2}px; animation-duration:{c.dur}s" onanimationend={() => c.kind === 'pass' && (cars = cars.filter((x) => x.id !== c.id))}>
            <Sprite kind="car" color={c.color} />
          </div>
        {/each}

        <div class="hen" class:dead style="transform: translateX({pos * LANE_W + LANE_W / 2}px)">
          {#key pos}<div class="jump"><div class="bob"><Sprite kind="chicken" /></div></div>{/key}
        </div>
      </div>
    </div>
    {#if phase === 'over'}
      <div class="banner" class:lose={dead} in:scale={{ start: 0.9, duration: 450 }}>
        {#if dead}{t('hp.hit')}{:else}{t('hp.safe')} <span class="mono">×{mult.toFixed(2)} · +{fmt(won)}</span>{/if}
      </div>
    {/if}
  </div>
</ArcadeLayout>

<style>
  .big { min-height: 54px; width: 100%; font-size: 1rem; }
  .cash:not(:disabled) { background: #2fbf71; color: #062a16; border-color: transparent; }
  .seg4 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
  .seg4 button { min-height: 38px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--bg-2); font-size: 0.85rem; transition: background 0.25s var(--ease-snap), color 0.25s var(--ease-snap), transform 0.16s var(--ease-snap); }
  .seg4 button:active:not(:disabled) { transform: scale(0.97); }
  .seg4 button.on { background: var(--text); color: var(--bg); }
  .seg4 button:disabled:not(.on) { opacity: 0.45; }

  .frame {
    --side: repeating-linear-gradient(0deg, #3b3f48 0 38px, #343841 38px 40px), #3b3f48; --kerb: #8a8f99;
    --asphalt: #2a2d34; --asphalt-next: #30343c; --asphalt-ok: #262f2b; --mark: rgba(255,255,255,.22);
    --hole: #3a3e47; --hole2: #31353d; --hole-ring: #4a4f5a; --hud: #1b1d23;
    position: relative; border-radius: 28px; overflow: hidden; background: #23262d; box-shadow: 0 30px 60px -30px rgba(0,0,0,.6);
  }
  .t-country { --side: repeating-linear-gradient(90deg, #4c7a3c 0 14px, #52823f 14px 28px); --kerb: #c9c3b5; --asphalt: #34373f; --asphalt-next: #3b3f48; --asphalt-ok: #2f3a33; --mark: rgba(255,255,255,.5); }
  .t-desert { --side: repeating-linear-gradient(20deg, #d9b26f 0 18px, #d2a961 18px 36px); --kerb: #efe0bd; --asphalt: #5a5048; --asphalt-next: #655a51; --asphalt-ok: #4f5546; --mark: rgba(255,240,200,.55); --hole: #6a5f55; --hole2: #5f544b; --hole-ring: #7d7064; --hud: #2a231c; }
  .t-snow { --side: radial-gradient(circle at 30% 30%, #fff 0 2px, transparent 3px) 0 0 / 22px 22px, linear-gradient(#eef3f8, #dfe8f1); --kerb: #a9b6c4; --asphalt: #4a5560; --asphalt-next: #55616d; --asphalt-ok: #40555a; --mark: rgba(255,255,255,.7); --hole: #5b6874; --hole2: #515d69; --hole-ring: #8796a6; --hud: #1c232b; }
  .t-night { --side: repeating-linear-gradient(0deg, #15171f 0 38px, #1a1d27 38px 40px), #15171f; --kerb: #6a5cff; --asphalt: #12141b; --asphalt-next: #191c26; --asphalt-ok: #122019; --mark: rgba(120,200,255,.45); --hole: #1d2130; --hole2: #171a26; --hole-ring: #3b3f6a; --hud: #0d0f15; }
  .t-night .lane::after { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 50%, rgba(255,214,120,.08), transparent 60%); pointer-events: none; }
  .t-snow .hen :global(svg) { filter: drop-shadow(0 2px 2px rgba(0,0,0,.25)); }
  .themes { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
  .th { display: grid; justify-items: center; gap: 4px; padding: 6px 2px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--bg-2); font-size: 0.68rem; }
  .th i { width: 100%; height: 22px; border-radius: 6px; }
  .th.on { border-color: var(--text); box-shadow: 0 0 0 2px var(--text) inset; }
  .th.country i { background: linear-gradient(90deg, #52823f 0 30%, #34373f 30% 70%, #52823f 70%); }
  .th.city i { background: linear-gradient(90deg, #3b3f48 0 30%, #2a2d34 30% 70%, #3b3f48 70%); }
  .th.desert i { background: linear-gradient(90deg, #d9b26f 0 30%, #5a5048 30% 70%, #d9b26f 70%); }
  .th.snow i { background: linear-gradient(90deg, #eef3f8 0 30%, #4a5560 30% 70%, #eef3f8 70%); }
  .th.night i { background: linear-gradient(90deg, #15171f 0 30%, #12141b 30% 70%, #15171f 70%); box-shadow: inset 0 0 0 1px #6a5cff; }
  .hud { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: rgba(255,255,255,.06); }
  .hud div { background: var(--hud); padding: 12px 16px; display: grid; gap: 4px; color: #f4f2ee; }
  .hud .eyebrow { color: rgba(255,255,255,.45); }
  .hud strong { font-size: 1.1rem; }
  .road { position: relative; overflow-x: auto; overflow-y: hidden; scrollbar-width: thin; height: clamp(340px, 52vh, 480px); }
  .strip { position: relative; display: flex; height: 100%; width: calc((var(--lanes) + 2) * var(--lw)); }
  .curb { flex: 0 0 var(--lw); position: relative; }
  .curb.start { background: var(--side); box-shadow: inset -6px 0 0 var(--kerb); }
  .curb.end { background: repeating-conic-gradient(#f4f2ee 0 25%, #1d1d22 0 50%) 0 0 / 30px 30px; box-shadow: inset 6px 0 0 var(--kerb); }
  .flag { position: absolute; left: 50%; top: 50%; translate: -50% -50%; background: #1b1d23; color: var(--gold); padding: 6px 10px; border-radius: 8px; font-size: 0.75rem; letter-spacing: 0.15em; }
  .lane {
    position: relative; flex: 0 0 var(--lw); transition: background-color 0.4s var(--ease-snap);
    background: radial-gradient(circle at 30% 20%, rgba(255,255,255,.025), transparent 60%), var(--asphalt);
    border-right: 2px dashed var(--mark);
  }
  .lane.next { background-color: var(--asphalt-next); }
  .lane.passed { background-color: var(--asphalt-ok); }
  .hole {
    position: absolute; left: 50%; top: 50%; translate: -50% -50%; width: 86px; height: 86px; border-radius: 50%; display: grid; place-items: center;
    background: radial-gradient(circle, var(--hole) 0 55%, var(--hole2) 56%); box-shadow: inset 0 0 0 3px var(--hole-ring), 0 2px 0 rgba(0,0,0,.35);
    color: rgba(255,255,255,.75); font-size: 0.82rem; font-weight: 700; transition: box-shadow 0.4s var(--ease-snap), color 0.4s var(--ease-snap);
  }
  .lane.next .hole { color: #fff; box-shadow: inset 0 0 0 3px rgba(255,255,255,.55), 0 0 24px rgba(255,255,255,.12); }
  .lane.passed .hole { color: #8ff0bf; box-shadow: inset 0 0 0 3px #2f8f66, 0 0 22px rgba(47,191,113,.25); }
  .lane.hit .hole { color: #ff9a9d; box-shadow: inset 0 0 0 3px #e5484d; }
  .gate {
    position: absolute; left: 8px; right: 8px; top: calc(50% - 72px); height: 10px; border-radius: 5px;
    background: repeating-linear-gradient(-45deg, #f2c046 0 10px, #1d1d22 10px 20px); box-shadow: 0 3px 6px rgba(0,0,0,.4);
    transform: translateY(-40px) scaleX(0.4); opacity: 0; transition: transform 0.55s var(--spring-snappy), opacity 0.2s var(--ease-snap);
  }
  .lane.passed .gate { transform: none; opacity: 1; }

  .car { position: absolute; top: 0; width: 64px; height: 104px; margin-left: -32px; z-index: 2; animation-fill-mode: forwards; filter: drop-shadow(0 10px 10px rgba(0,0,0,.45)); }
  .car.pass { animation-name: drive; animation-timing-function: linear; }
  .car.brake { animation-name: brake; animation-timing-function: var(--spring-snappy); }
  .car.hit { animation-name: ram; animation-timing-function: cubic-bezier(0.55, 0, 1, 0.45); z-index: 4; }
  @keyframes drive { from { transform: translateY(-120px); } to { transform: translateY(calc(var(--h) + 20px)); } }
  @keyframes brake { from { transform: translateY(-120px); } to { transform: translateY(calc(var(--h) / 2 - 190px)); } }
  @keyframes ram { from { transform: translateY(-120px); } to { transform: translateY(calc(var(--h) / 2 - 60px)); } }

  .hen { position: absolute; top: 50%; left: 0; width: 84px; height: 84px; margin: -54px 0 0 -42px; z-index: 3; transition: transform 0.38s var(--spring-smooth); }
  .jump { width: 100%; height: 100%; animation: jump 0.38s var(--ease-snap); }
  .bob { width: 100%; height: 100%; animation: bob 1.6s ease-in-out infinite alternate; transform-origin: 50% 90%; }
  @keyframes jump { 0% { transform: translateY(0) scale(1.08, 0.88); } 40% { transform: translateY(-34px) scale(0.94, 1.08); } 80% { transform: translateY(0) scale(1.1, 0.9); } 100% { transform: none; } }
  @keyframes bob { to { transform: scale(1.02, 0.98) rotate(-2deg); } }
  .hen.dead .bob { animation: flat 0.35s var(--ease-snap) forwards; }
  @keyframes flat { to { transform: scale(1.4, 0.18) translateY(160px); opacity: 0.85; } }

  .banner {
    position: absolute; left: 50%; bottom: 24px; translate: -50% 0; padding: 14px 24px; border-radius: 999px; z-index: 6;
    background: #16181d; color: #8ff0bf; font: 700 1.1rem 'Geist Mono Variable', monospace; box-shadow: 0 0 0 2px #2fbf71, 0 20px 50px rgba(0,0,0,.6); white-space: nowrap;
  }
  .banner.lose { color: #ff9a9d; box-shadow: 0 0 0 2px #e5484d, 0 20px 50px rgba(0,0,0,.6); }
  @media (max-width: 640px) { .hud strong { font-size: 0.95rem; } .hud div { padding: 10px 12px; } }
  @media (prefers-reduced-motion: reduce) { .car.pass { display: none; } .bob { animation: none; } }
</style>
