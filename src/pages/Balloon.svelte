<script lang="ts">
  import { fly } from 'svelte/transition';
  import { onDestroy } from 'svelte';
  import jetSrc from '../assets/space/force.webp';
  import teslaSrc from '../assets/space/tesla.webp';
  import ArcadeLayout from '../components/ArcadeLayout.svelte';
  import BetInput from '../components/BetInput.svelte';
  import { RISK, balloonMult, pops, type Risk } from '../games/balloon';
  import { wallet, settle, stake, fmt, settings } from '../lib/state.svelte';
  import { sfx } from '../lib/sfx';
  import { t } from '../lib/i18n';

  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
  let bet = $state(10);
  let risk = $state<Risk>('mid');
  let phase = $state<'idle' | 'play' | 'popped' | 'flown'>('idle');
  let k = $state(0); // pumps so far
  let staked = $state(0);
  let won = $state(0);
  let busy = $state(false);
  let push = $state(0); // bumps the pump animation
  let history = $state<{ m: number; ok: boolean; id: number }[]>([]);
  let n = 0;
  let round = $state(0); // a fresh balloon element per round
  const COLORS = ['#e5484d', '#3d9bff', '#f2b01e', '#2fbf71', '#b05cff', '#ff7ab8'];
  let color = $state(COLORS[0]);

  const max = $derived(RISK[risk].max);
  const mult = $derived(balloonMult(risk, k));
  const next = $derived(balloonMult(risk, k + 1));
  // the balloon grows with every pump; full at the last pump
  const size = $derived(phase === 'idle' ? 0.32 : 0.32 + 0.68 * Math.min(1, k / max));

  async function pump() {
    if (busy) return;
    if (phase !== 'play') {
      if (bet > wallet.balance || bet <= 0) return;
      staked = bet;
      stake(bet);
      k = 0; won = 0;
      color = COLORS[Math.floor(Math.random() * COLORS.length)];
      phase = 'play';
      round++;
    }
    busy = true;
    push++;
    sfx('pump');
    await new Promise((r) => setTimeout(r, 260));
    if (pops(risk)) {
      phase = 'popped';
      settle(0, 0);
      sfx('pop');
      history = [{ m: balloonMult(risk, k + 1), ok: false, id: ++n }, ...history].slice(0, 12);
    } else {
      k++;
      if (k >= max) cashOut(); // full balloon: it lifts off on its own
    }
    busy = false;
  }
  function cashOut() {
    if (phase !== 'play' || k < 1) return;
    won = Math.round(staked * mult * 100) / 100;
    settle(won, won);
    phase = 'flown';
    sfx('cash');
    history = [{ m: mult, ok: true, id: ++n }, ...history].slice(0, 12);
  }
  function key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) pump(); }
    if (e.code === 'Enter') { e.preventDefault(); cashOut(); }
  }
  // easter eggs far away in the sky: now and then a jet, a flock of birds, a hot-air balloon, very rarely a car
  type Egg = { kind: 'jet' | 'birds' | 'hot' | 'tesla'; id: number; top: number; dur: number };
  let egg = $state<Egg | null>(null);
  let eggTimer: ReturnType<typeof setTimeout>;
  function nextEgg(wait = 9000 + Math.random() * 16000) {
    eggTimer = setTimeout(() => {
      const r = Math.random();
      const kind = r < 0.04 ? 'tesla' : r < 0.4 ? 'jet' : r < 0.75 ? 'birds' : 'hot';
      egg = { kind, id: Date.now(), top: 6 + Math.random() * 22, dur: kind === 'hot' ? 40 : kind === 'birds' ? 22 : kind === 'jet' ? 14 : 18 };
      setTimeout(() => (egg = null), egg.dur * 1000);
      nextEgg(egg.dur * 1000 + 8000 + Math.random() * 20000);
    }, wait);
  }
  nextEgg(4000);
  onDestroy(() => clearTimeout(eggTimer));
  // three cloud layers: far ones are small, faint and slow
  const CLOUDS = [
    { top: 8, s: 1, dur: 90, delay: -30, o: 0.95 }, { top: 20, s: 0.6, dur: 140, delay: -100, o: 0.75 },
    { top: 40, s: 0.42, dur: 180, delay: -40, o: 0.6 }, { top: 4, s: 0.5, dur: 160, delay: -130, o: 0.7 }, { top: 30, s: 0.8, dur: 110, delay: -75, o: 0.85 },
  ];

  // rubber shreds for the pop
  const SHREDS = Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * Math.PI * 2 + Math.random() * 0.4, d: 90 + Math.random() * 90, r: Math.random() * 720 - 360, s: 0.6 + Math.random() * 0.8 }));
</script>

<svelte:window onkeydown={key} />

<ArcadeLayout eyebrow={L('Arcade · Pumpen oder kassieren', 'Arcade · Pump or cash out')} title={L('Ballon', 'Balloon')}>
  {#snippet controls()}
    {#if phase === 'play'}
      <button class="btn big cash" disabled={k < 1 || busy} onclick={cashOut}>{t('a.cashout')} <span class="mono">{fmt(Math.round(staked * mult * 100) / 100)}</span></button>
    {/if}
    <button class="btn primary big" disabled={busy || (phase !== 'play' && bet > wallet.balance)} onclick={pump}>
      {phase === 'play' ? L('Pumpen', 'Pump') : L('Spielen und pumpen', 'Play and pump')}
    </button>
    <BetInput bind:value={bet} disabled={phase === 'play'} />
    <div class="field">{L('Risiko', 'Risk')}
      <div class="seg">
        {#each [['low', L('Tief', 'Low')], ['mid', L('Mittel', 'Medium')], ['high', L('Hoch', 'High')]] as [r, label]}
          <button class:on={risk === r} disabled={phase === 'play'} onclick={() => (risk = r as Risk)}>{label}</button>
        {/each}
      </div>
    </div>
    <div class="stats">
      <div><span class="eyebrow">{L('Platz-Chance', 'Pop chance')}</span><strong class="mono">{Math.round(RISK[risk].p * 100)} %</strong></div>
      <div><span class="eyebrow">{L('Nächster', 'Next')}</span><strong class="mono">×{(phase === 'play' ? next : balloonMult(risk, 1)).toFixed(2)}</strong></div>
      <div><span class="eyebrow">{L('Pumpstösse', 'Pumps')}</span><strong class="mono">{k} / {max}</strong></div>
      <div><span class="eyebrow">{L('Maximal', 'Top')}</span><strong class="mono">×{balloonMult(risk, max).toFixed(2)}</strong></div>
    </div>
    <p class="small muted">{L('Leertaste oder Tippen auf den Himmel pumpt, Enter zahlt aus. Ist der Ballon voll, steigt er von allein auf und zahlt aus.', 'Space or a tap on the sky pumps, Enter cashes out. A full balloon lifts off and pays out on its own.')}</p>
  {/snippet}

  <!-- tapping the sky pumps too, so phones do not need to scroll to the button -->
  <div class="sky" class:shake={phase === 'popped'} role="presentation" onclick={pump}>
    <div class="sun" aria-hidden="true"></div>
    {#if egg}
      {#key egg.id}
        <div class="egg {egg.kind}" style="top:{egg.top}%; --dur:{egg.dur}s" aria-hidden="true">
          {#if egg.kind === 'jet'}<i class="trail"></i><img src={jetSrc} alt="" />
          {:else if egg.kind === 'tesla'}<img src={teslaSrc} alt="" />
          {:else if egg.kind === 'birds'}
            <svg viewBox="0 0 120 50">{#each [[10, 20], [30, 10], [50, 24], [70, 14], [92, 28]] as [x, y], i}<path class="wing" style="animation-delay:{i * -0.13}s" d="M{x} {y} q6 -6 12 0 q6 -6 12 0" fill="none" stroke="#2c3e57" stroke-width="2.2" stroke-linecap="round" />{/each}</svg>
          {:else}
            <svg viewBox="0 0 40 60"><path d="M20 2 C34 2 38 14 38 22 C38 32 28 38 24 44 L16 44 C12 38 2 32 2 22 C2 14 6 2 20 2Z" fill="#f2b01e" /><path d="M20 2 C26 2 28 14 28 22 C28 32 23 38 22 44 L18 44 C17 38 12 32 12 22 C12 14 14 2 20 2Z" fill="#e5484d" /><path d="M16 44 L17 50 M24 44 L23 50" stroke="#6b4a2a" /><rect x="15" y="50" width="10" height="7" rx="1" fill="#8a5a2b" /></svg>
          {/if}
        </div>
      {/key}
    {/if}
    {#each CLOUDS as c}
      <svg class="cloud" viewBox="0 0 220 90" style="top:{c.top}%; --s:{c.s}; opacity:{c.o}; animation-duration:{c.dur}s; animation-delay:{c.delay}s" aria-hidden="true">
        <defs><linearGradient id="cl" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#fff" /><stop offset="1" stop-color="#d6e6f5" /></linearGradient></defs>
        <path d="M24 80 C6 80 2 62 16 56 C10 40 30 30 44 38 C48 18 74 10 90 24 C100 6 136 6 146 28 C160 18 186 24 186 44 C204 44 214 60 204 72 C200 78 194 80 186 80Z" fill="url(#cl)" />
        <path d="M44 38 C48 30 56 26 64 26 M90 24 C96 20 104 18 112 20" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8" fill="none" />
      </svg>
    {/each}
    <!-- the land: far mountains in the haze, rolling hills, the meadow the pump stands on -->
    <svg class="land" viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 120 L80 84 L150 104 L240 60 L320 98 L400 74 L470 96 L560 50 L640 92 L720 70 L800 100 L880 66 L1000 96 V200 H0Z" fill="#a9c6e3" />
      <path d="M548 56 L560 50 L574 58 L566 60 L560 56 L552 60Z M232 64 L240 60 L250 66 L244 67 L240 64 L236 67Z" fill="#fff" opacity=".9" />
      <path d="M0 150 C120 120 220 128 330 140 C450 152 540 118 660 124 C780 130 880 146 1000 132 V200 H0Z" fill="#7fb87a" />
      <path d="M0 172 C160 156 300 162 500 166 C700 170 840 158 1000 164 V200 H0Z" fill="#5ea35a" />
      <path d="M0 184 C200 178 400 182 600 180 C800 178 900 184 1000 182 V200 H0Z" fill="#4c9149" />
      {#each Array.from({ length: 40 }, (_, i) => i) as i}<path d="M{i * 25 + 8} 186 l3 -9 l3 9 M{i * 25 + 14} 188 l2 -6 l2 6" stroke="#3c7d3a" stroke-width="1.6" fill="none" />{/each}
    </svg>
    <div class="hist">
      {#each history as h (h.id)}<span class="hc mono" class:ok={h.ok} in:fly={{ x: -16, duration: 260 }}>×{h.m.toFixed(2)}</span>{/each}
    </div>

    <div class="stage">
      {#key round}
        <div class="balloon" class:gone={phase === 'popped'} class:flown={phase === 'flown'} style="--s:{size}; --c:{color}">
          <svg viewBox="0 0 200 260" aria-hidden="true">
            <defs>
              <radialGradient id="bshine" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".55" /><stop offset=".35" stop-color="#fff" stop-opacity="0" /></radialGradient>
              <radialGradient id="bshade" cx="50%" cy="45%" r="60%"><stop offset=".6" stop-color="#000" stop-opacity="0" /><stop offset="1" stop-color="#000" stop-opacity=".35" /></radialGradient>
            </defs>
            <path d="M100 6 C152 6 186 48 186 100 C186 156 140 200 104 214 L96 214 C60 200 14 156 14 100 C14 48 48 6 100 6Z" fill="var(--c)" />
            <path d="M100 6 C152 6 186 48 186 100 C186 156 140 200 104 214 L96 214 C60 200 14 156 14 100 C14 48 48 6 100 6Z" fill="url(#bshade)" />
            <path d="M100 6 C152 6 186 48 186 100 C186 156 140 200 104 214 L96 214 C60 200 14 156 14 100 C14 48 48 6 100 6Z" fill="url(#bshine)" />
            <ellipse cx="62" cy="58" rx="16" ry="26" fill="#fff" opacity=".35" transform="rotate(-25 62 58)" />
            <path d="M92 214 L108 214 L104 226 L96 226Z" fill="var(--c)" stroke="rgba(0,0,0,.25)" stroke-width="2" />
          </svg>
          {#if phase !== 'idle'}<span class="m mono">×{(phase === 'popped' ? 0 : mult).toFixed(2)}</span>{/if}
        </div>
      {/key}
      {#if phase === 'popped'}
        <div class="pop" style="--c:{color}">
          {#each SHREDS as sh}<i style="--x:{Math.cos(sh.a) * sh.d}px; --y:{Math.sin(sh.a) * sh.d}px; --r:{sh.r}deg; --k:{sh.s}"></i>{/each}
          <b>POP!</b>
        </div>
      {/if}
      <!-- string from the knot down to the pump nozzle -->
      <svg class="string" viewBox="0 0 40 200" preserveAspectRatio="none" aria-hidden="true" class:loose={phase === 'flown' || phase === 'popped'}>
        <path d="M20 0 C8 50 32 100 20 200" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="2" />
      </svg>
      <div class="pump">
        {#key push}<div class="handle"><i></i></div>{/key}
        <div class="barrel"><span class="mono">{phase === 'play' ? k : ''}</span></div>
        <div class="foot"></div>
      </div>
    </div>

    {#if phase === 'play' && k > 0}
      <button class="btn skycash" disabled={busy} onclick={(e) => { e.stopPropagation(); cashOut(); }}>{t('a.cashout')} <span class="mono">{fmt(Math.round(staked * mult * 100) / 100)}</span></button>
    {/if}
    {#if phase === 'flown'}<p class="result mono pos" in:fly={{ y: 10 }}>+{fmt(won)}</p>{/if}
    {#if phase === 'popped'}<p class="result mono" in:fly={{ y: 10 }}>{L('Geplatzt', 'Popped')} · 0</p>{/if}
  </div>
</ArcadeLayout>

<style>
  .big { min-height: 54px; width: 100%; font-size: 1rem; }
  .cash:not(:disabled) { background: #2fbf71; color: #062a16; border-color: transparent; }
  .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .stats div { background: var(--bg-2); border-radius: 14px; padding: 10px 12px; display: grid; gap: 4px; }
  .stats strong { font-size: 1.05rem; }
  .seg { display: flex; border: 1px solid var(--line-2); border-radius: 999px; padding: 3px; gap: 3px; }
  .seg button { flex: 1; border: 0; background: none; min-height: 36px; border-radius: 999px; color: var(--muted); }
  .seg button.on { background: var(--text); color: var(--bg); }
  .small { font-size: 0.8rem; margin: 0; }
  .muted { color: var(--muted); }

  .sky {
    position: relative; overflow: hidden; height: clamp(440px, 64vh, 620px); border-radius: 28px; container-type: inline-size;
    background: linear-gradient(180deg, #5aa9f0 0%, #9fd2f7 55%, #d9efff 100%); box-shadow: 0 30px 60px -30px rgba(0,0,0,.6);
  }
  .sky.shake { animation: shake 0.4s; }
  @media (max-width: 860px) { .sky { height: clamp(320px, 50vh, 460px); } }
  .sky { cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent; }
  @keyframes shake { 20% { transform: translate(-6px, 3px); } 40% { transform: translate(5px, -4px); } 60% { transform: translate(-3px, 2px); } 80% { transform: translate(2px, -1px); } }
  .sun { position: absolute; right: 9%; top: 8%; width: 90px; height: 90px; border-radius: 50%; background: radial-gradient(circle, #fffbe6 0 38%, rgba(255,240,180,.55) 40%, transparent 70%); filter: blur(1px); }
  .cloud { position: absolute; left: 0; width: 220px; transform: scale(var(--s)); transform-origin: 0 0; animation: drift linear infinite; filter: drop-shadow(0 6px 10px rgba(40,80,130,.12)); }
  @keyframes drift { from { translate: -240px 0; } to { translate: calc(100cqw + 20px) 0; } }
  .land { position: absolute; left: 0; bottom: 0; width: 100%; height: 30%; min-height: 120px; }
  .egg { position: absolute; left: 0; animation: cross var(--dur) linear forwards; pointer-events: none; }
  @keyframes cross { from { translate: calc(100cqw + 40px) 0; } to { translate: -320px 0; } }
  .egg.jet img { width: 54px; opacity: 0.7; filter: saturate(.6) blur(.3px); }
  .egg.jet .trail { position: absolute; left: 44px; top: 50%; width: 260px; height: 3px; border-radius: 2px; background: linear-gradient(90deg, rgba(255,255,255,.9), transparent); }
  .egg.tesla img { width: 48px; opacity: 0.8; animation: bob 2s ease-in-out infinite; }
  .egg.birds svg { width: 70px; opacity: 0.7; }
  .wing { animation: flap 0.5s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: center; }
  @keyframes flap { to { transform: scaleY(-0.6); } }
  .egg.hot { animation-name: rise; }
  .egg.hot svg { width: 26px; opacity: 0.75; }
  @keyframes rise { from { translate: 12cqw 160px; } to { translate: 26cqw -60px; } }
  @keyframes bob { 50% { transform: translateY(-4px) rotate(-3deg); } }
  @media (prefers-reduced-motion: reduce) { .cloud { animation: none; translate: 30% 0; } .egg { display: none; } }

  .hist { position: absolute; top: 14px; left: 14px; right: 170px; display: flex; gap: 6px; flex-wrap: wrap; z-index: 3; }
  .hc { padding: 4px 9px; border-radius: 999px; font-size: 0.75rem; background: rgba(20,24,40,.55); color: #ffb3b5; }
  .hc.ok { color: #8ff0bf; }

  .stage { position: absolute; left: 50%; bottom: 0; width: 260px; height: 100%; translate: -50% 0; }
  .balloon {
    position: absolute; left: 50%; bottom: 150px; width: 220px; translate: -50% 0; transform-origin: 50% 100%;
    transform: scale(var(--s)); transition: transform 0.28s cubic-bezier(.3, 1.6, .5, 1); z-index: 2;
    filter: drop-shadow(0 10px 18px rgba(20,40,80,.25));
  }
  .balloon svg { display: block; width: 100%; animation: sway 3s ease-in-out infinite; transform-origin: 50% 100%; }
  @keyframes sway { 50% { rotate: 2deg; } }
  .balloon .m { position: absolute; left: 50%; top: 38%; translate: -50% -50%; font-size: calc(1.5rem / max(var(--s), 0.8)); font-weight: 700; color: #fff; text-shadow: 0 2px 6px rgba(0,0,0,.35); white-space: nowrap; }
  .balloon.gone { opacity: 0; transform: scale(calc(var(--s) * 1.25)); transition: transform 0.08s, opacity 0.08s; }
  .balloon.flown { animation: away 2.4s cubic-bezier(.4, 0, .6, 1) forwards; }
  @keyframes away { to { transform: translate(60px, -720px) scale(var(--s)) rotate(8deg); } }
  .pop { position: absolute; left: 50%; bottom: 300px; z-index: 3; }
  .pop i { position: absolute; width: 16px; height: 10px; border-radius: 40% 60% 30% 70%; background: var(--c); animation: shred 0.9s cubic-bezier(.2, .7, .4, 1) forwards; }
  @keyframes shred { to { transform: translate(var(--x), calc(var(--y) + 120px)) rotate(var(--r)) scale(var(--k)); opacity: 0; } }
  .pop b { position: absolute; translate: -50% -50%; font: 800 3rem/1 'Geist Variable', sans-serif; color: #fff; -webkit-text-stroke: 2px #1c1c22; animation: popword 0.7s cubic-bezier(.3, 1.6, .5, 1) both; }
  @keyframes popword { from { scale: 0.3; opacity: 0; } 30% { opacity: 1; } to { scale: 1.2; opacity: 0; } }
  .string { position: absolute; left: 50%; bottom: 96px; width: 20px; height: 58px; translate: -50% 0; z-index: 1; transition: opacity 0.3s; }
  .string.loose { opacity: 0; }
  .pump { position: absolute; left: 50%; bottom: 18px; translate: -50% 0; width: 70px; height: 96px; }
  .barrel { position: absolute; left: 13px; bottom: 10px; width: 44px; height: 62px; border-radius: 10px 10px 4px 4px; background: linear-gradient(90deg, #c33a3a, #e8584f 40%, #a82a2a); box-shadow: inset 0 -6px 0 rgba(0,0,0,.2); display: grid; place-items: center; }
  .barrel span { color: #fff; font-size: 0.9rem; font-weight: 700; }
  .foot { position: absolute; left: 0; bottom: 0; width: 70px; height: 12px; border-radius: 6px; background: #3a3f4a; }
  .handle { position: absolute; left: 50%; bottom: 66px; translate: -50% 0; width: 6px; height: 30px; background: #9aa0aa; animation: press 0.26s ease-in-out; }
  .handle i { position: absolute; left: -22px; top: -8px; width: 50px; height: 10px; border-radius: 5px; background: #2a2e37; }
  @keyframes press { 50% { transform: translateY(20px); } }
  .skycash { position: absolute; right: 14px; top: 12px; z-index: 5; background: #2fbf71; color: #062a16; border-color: transparent; font-weight: 600; }
  .result { position: absolute; left: 50%; top: 16%; translate: -50% 0; margin: 0; font-size: 2rem; font-weight: 700; color: #b02a2a; text-shadow: 0 2px 0 #fff; z-index: 4; }
  .result.pos { color: #1c8a52; }
</style>
