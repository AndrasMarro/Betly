<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { fly, scale } from 'svelte/transition';
  import SlotSymbol from '../components/SlotSymbol.svelte';
  import HowTo from '../components/HowTo.svelte';
  import { MACHINES as BASE, ARMORY, strips, spinGrid, evaluate, type Win } from '../games/slots';
  // weapon art from the cases, shown instead of drawn symbols on the Armory machine
  const ART = Object.fromEntries(Object.entries(import.meta.glob('../assets/cases/*.webp', { eager: true, import: 'default' })).map(([k, v]) => [k.split('/').pop()!.replace('.webp', ''), v as string]));
  const MACHINES = [...BASE, ...ARMORY];
  const TABS = [...BASE.map((m, i) => ({ name: m.name, i })), { name: 'Armory', i: BASE.length }];
  import { wallet, settle, fmt } from '../lib/state.svelte';
  import { sfx } from '../lib/sfx';
  import { t } from '../lib/i18n';

  let mi = $state(0);
  const armoryOn = $derived(mi >= BASE.length);
  const m = $derived(MACHINES[mi]);
  const reelStrips = $derived(strips(m));
  let betIdx = $state(1);
  const lineBet = $derived(m.bets[Math.min(betIdx, m.bets.length - 1)]);
  const cost = $derived(lineBet * m.lines.length);

  type Reel = { items: string[]; k: number; dur: number; moving?: boolean };
  let reels = $state<Reel[]>([]);
  let stripEls: HTMLDivElement[] = $state([]);
  let spinning = $state(false);
  let wins = $state<Win[]>([]);
  let win = $state(0);
  const shownWin = new Tween(0, { duration: 900, easing: cubicOut });
  $effect(() => { shownWin.set(win, { duration: win ? 900 : 0 }); });
  let freeLeft = $state(0);
  let autoLeft = $state(0);
  let turbo = $state(false);
  let alive = true;
  onDestroy(() => (alive = false));

  // fresh reels whenever the machine changes
  $effect(() => {
    const g = spinGrid(m, reelStrips);
    reels = g.map((items) => ({ items, k: 0, dur: 0 }));
    wins = []; win = 0; freeLeft = 0; autoLeft = 0;
  });

  const lit = $derived(new Set(wins.flatMap((w) => m.lines[w.line].slice(0, w.count).map((row, reel) => reel + '-' + row))));

  async function spin() {
    if (spinning) return;
    const free = freeLeft > 0;
    if (!free && wallet.balance < cost) { autoLeft = 0; return; }
    spinning = true;
    wins = []; win = 0;
    if (free) freeLeft--;
    sfx('spin');
    const grid = spinGrid(m, reelStrips);
    const durs = grid.map((_, i) => (turbo ? 380 + i * 120 : 900 + i * 260));
    reels = reels.map((r, i) => {
      const s = reelStrips[i];
      const filler = Array.from({ length: (turbo ? 6 : 14) + i * (turbo ? 2 : 5) }, () => s[Math.floor(Math.random() * s.length)]);
      const items = [...grid[i], ...filler, ...r.items.slice(0, m.rows)];
      return { items, k: items.length - m.rows, dur: 0 };
    });
    await tick();
    stripEls.forEach((el) => el?.offsetHeight); // flush start position
    reels.forEach((r, i) => {
      r.dur = durs[i];
      r.k = 0;
      r.moving = true;
      setTimeout(() => { r.moving = false; }, durs[i] * 0.72);
      setTimeout(() => sfx('stop'), durs[i]);
    });
    await new Promise((r) => setTimeout(r, Math.max(...durs) + 80));
    if (!alive) return;
    reels = grid.map((items) => ({ items, k: 0, dur: 0 }));

    const res = evaluate(m, grid, lineBet);
    const mult = free ? m.scatter!.mult : 1;
    win = res.total * mult;
    wins = res.wins;
    settle(win - (free ? 0 : cost), win);
    if (res.free) freeLeft += res.free;
    if (win > 0) sfx(win >= cost * 10 ? 'big' : 'win');
    spinning = false;

    if (freeLeft > 0) setTimeout(() => alive && spin(), turbo ? 700 : 1300);
    else if (autoLeft > 0) setTimeout(() => { if (alive && autoLeft > 0) { autoLeft--; spin(); } }, turbo ? 350 : 700);
  }

  function auto(n: number) {
    autoLeft = n - 1;
    spin();
  }

  const pts = (line: number[]) => line.map((row, reel) => `${((reel + 0.5) / line.length) * 100},${((row + 0.5) / m.rows) * 100}`).join(' ');
  const LINE_COLORS = ['#f2c046', '#ff6b7a', '#6aa8ff', '#4fe3a0', '#b57bff', '#ff9f43', '#f78fb3', '#54d8f0', '#c8f05a', '#ffffff'];

  function key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, select, textarea, button')) return;
    if (e.code === 'Space') { e.preventDefault(); spin(); }
  }
</script>

<svelte:window onkeydown={key} />

{#snippet symbol(sym: string)}
  {#if ART[sym]}<img class="weapon" src={ART[sym]} alt={sym} draggable="false" />{:else}<SlotSymbol {sym} />{/if}
{/snippet}

<section class="wrap page">
  <header class="head">
    <div>
      <p class="eyebrow">{m.lines.length} {t('s.lines')} · {m.weights.length}×{m.rows}</p>
      <div class="h1row"><h1>Slots</h1><HowTo id="slots" /></div>
    </div>
    <div class="tabs" role="tablist">
      {#each TABS as tb}
        {@const on = tb.i === BASE.length ? armoryOn : mi === tb.i}
        <button role="tab" aria-selected={on} class:on disabled={spinning || freeLeft > 0} onclick={() => { if (!on) mi = tb.i; }}>{tb.name}</button>
      {/each}
    </div>
  </header>

  {#if armoryOn}
    <div class="sets" role="radiogroup" aria-label="Armory" in:fly={{ y: -6, duration: 220 }}>
      {#each ARMORY as a, k}
        {@const wild = a.wild!}
        <button class="set" class:on={mi === BASE.length + k} disabled={spinning || freeLeft > 0} onclick={() => { mi = BASE.length + k; betIdx = 1; sfx('click'); }}>
          <img src={ART[wild]} alt="" />
          <span>{a.name.split('· ')[1]}</span>
          <span class="mono">{fmt(a.bets[0] * a.lines.length)}–{fmt(a.bets.at(-1)! * a.lines.length)}</span>
        </button>
      {/each}
    </div>
  {/if}

  <div class="cabinet {m.id}" class:armory={armoryOn}>
    <div class="marquee">
      <span class="serif">{m.name}</span>
      {#if freeLeft > 0}<span class="free mono" in:scale>{t('s.free')}: {freeLeft} · ×{m.scatter?.mult}</span>{/if}
    </div>
    <div class="window" style="--rows:{m.rows}; --reels:{reels.length}">
      {#each reels as r, i}
        <div class="reel">
          <div class="strip" class:moving={r.moving} bind:this={stripEls[i]} style="transform: translateY({(-r.k / r.items.length) * 100}%); transition: transform {r.dur}ms cubic-bezier(.25,.9,.35,1.04)">
            {#each r.items as sym, j}
              <div class="cell" class:lit={!spinning && j < m.rows && lit.has(i + '-' + j)} class:dim={!spinning && wins.length > 0 && j < m.rows && !lit.has(i + '-' + j)} class:wild={sym === m.wild && !!ART[sym]}>
                {@render symbol(sym)}
              </div>
            {/each}
          </div>
        </div>
      {/each}
      {#if !spinning && wins.length}
        <svg class="lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {#each wins as w, i}
            <polyline pathLength="1" style="animation-delay:{i * 120}ms" points={pts(m.lines[w.line])} stroke={LINE_COLORS[w.line % LINE_COLORS.length]} />
          {/each}
        </svg>
      {/if}
    </div>
    <div class="readout">
      <div><span class="eyebrow">{t('bet.win')}</span>
        <strong class="mono big" class:pos={win > 0}>{fmt(Math.round(shownWin.current * 100) / 100)}</strong>
      </div>
      <div><span class="eyebrow">{t('s.lineBet')}</span>
        <div class="stepper">
          <button class="btn icon sm" disabled={spinning || betIdx === 0} onclick={() => betIdx--} aria-label="-">−</button>
          <strong class="mono">{lineBet}</strong>
          <button class="btn icon sm" disabled={spinning || betIdx >= m.bets.length - 1} onclick={() => betIdx++} aria-label="+">+</button>
        </div>
      </div>
      <div><span class="eyebrow">{t('bet.total')}</span><strong class="mono">{fmt(cost)}</strong></div>
    </div>
  </div>

  <div class="dock panel">
    <label class="switch mini"><span>{t('s.turbo')}</span><input type="checkbox" bind:checked={turbo} /></label>
    <div class="autos">
      {#if autoLeft > 0}
        <button class="btn sm" onclick={() => (autoLeft = 0)}>{t('s.stop')} ({autoLeft})</button>
      {:else}
        {#each [10, 25, 50] as n}<button class="btn sm ghost" disabled={spinning || freeLeft > 0 || wallet.balance < cost} onclick={() => auto(n)}>{t('s.auto')} {n}</button>{/each}
      {/if}
    </div>
    <button class="btn primary spinbtn" onclick={spin} disabled={spinning || freeLeft > 0 || wallet.balance < cost}>
      {wallet.balance < cost && freeLeft === 0 ? t('notEnough') : t('s.spin')}
    </button>
  </div>

  <section class="pay">
    <h2 class="eyebrow">{t('s.paytable')}</h2>
    <div class="paygrid">
      {#each Object.entries(m.pays).sort((a, b) => Math.max(...Object.values(b[1])) - Math.max(...Object.values(a[1]))) as [sym, p]}
        <div class="payitem">
          <div class="pi" class:wide={!!ART[sym]}>{@render symbol(sym)}</div>
          <div class="mono">
            {#each Object.entries(p).reverse() as [n, x]}<div><span class="muted">{n}×</span> {x * lineBet}</div>{/each}
          </div>
        </div>
      {/each}
      {#if m.scatter}
        <div class="payitem">
          <div class="pi"><SlotSymbol sym={m.scatter.sym} /></div>
          <div class="mono">
            {#each Object.entries(m.scatter.pays).reverse() as [n, x]}<div><span class="muted">{n}×</span> {x * cost}</div>{/each}
          </div>
        </div>
      {/if}
    </div>
    {#if m.scatter}<p class="muted small">{t('s.scatter')}. {t('s.wild')}.</p>{/if}
  </section>
</section>

<style>
  .h1row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .h1row h1 { margin: 0; }
  .page { padding-bottom: 120px; }
  .head { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 12px; padding: 28px 0 16px; }
  h1 { margin: 6px 0 0; font-size: clamp(2.2rem, 5vw, 3.6rem); letter-spacing: -0.04em; line-height: 0.95; font-weight: 700; }
  .tabs { display: flex; gap: 4px; padding: 4px; border-radius: 999px; border: 1px solid var(--line-2); max-width: 100%; overflow-x: auto; scrollbar-width: none; }
  .tabs button { flex: none; border: 0; background: none; min-height: 38px; padding: 0 16px; border-radius: 999px; font-size: 0.85rem; transition: background-color 0.3s var(--ease-snap), color 0.3s var(--ease-snap); }
  .tabs button.on { background: var(--text); color: var(--bg); }
  .sets { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; max-width: 720px; margin: -4px auto 12px; }
  .set { display: grid; grid-template-columns: 54px 1fr; grid-template-rows: auto auto; column-gap: 8px; align-items: center; text-align: left; padding: 5px 10px 5px 5px; border-radius: 16px; border: 1px solid var(--line-2); background: var(--surface); font-size: 0.85rem; font-weight: 600; transition: border-color 0.25s var(--ease-snap), transform 0.3s var(--ease-snap); }
  .set img { grid-row: span 2; width: 54px; height: 34px; object-fit: contain; }
  .set .mono { font-size: 0.72rem; color: var(--muted); font-weight: 400; }
  .set.on { border-color: var(--gold); box-shadow: 0 0 0 3px color-mix(in srgb, var(--gold) 22%, transparent); }
  .set:hover:not(:disabled) { transform: translateY(-2px); }
  .cabinet.armory { --frame: #c9a24a; background: linear-gradient(160deg, #1c1f2b, #0b0d14); }
  .cabinet.armory .reel { background: linear-gradient(180deg, #151826, #22263a 20%, #22263a 80%, #151826); }
  .weapon { width: 100%; height: 100%; object-fit: contain; display: block; filter: drop-shadow(0 4px 6px rgba(0,0,0,.5)); }
  .armory .cell { padding: 6%; }
  .cell.wild { background: radial-gradient(circle, rgba(242,192,70,.28), transparent 70%); }
  .pi.wide { width: 80px; }
  @media (max-width: 640px) {
    .set { grid-template-columns: 1fr; grid-template-rows: auto; justify-items: center; text-align: center; padding: 6px 4px; }
    .set img { grid-row: auto; width: 100%; height: 28px; }
    .set .mono { font-size: 0.64rem; }
  }
  .tabs button:disabled:not(.on) { opacity: 0.4; }

  .cabinet {
    --frame: #d8b26a; width: fit-content; max-width: 100%; margin: 0 auto; border-radius: 36px; padding: clamp(14px, 2.5vw, 28px);
    background: linear-gradient(160deg, #26180e, #120b07); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--frame) 60%, transparent), 0 40px 80px -30px rgba(0,0,0,.6);
  }
  .cabinet.gems { --frame: #8a7dff; background: linear-gradient(160deg, #1b1340, #0a0820); }
  .cabinet.cosmic { --frame: #6ad5ff; background: radial-gradient(ellipse at 70% 0%, #2a1f5c, #07061a 70%); }
  .cabinet.clover { --frame: #f2c046; background: linear-gradient(160deg, #0f4a2e, #062316); }
  .marquee { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #f4f2ee; padding: 0 6px 14px; }
  .marquee .serif { font-size: clamp(1.6rem, 3.5vw, 2.4rem); color: var(--frame); }
  .free { font-size: 0.8rem; background: var(--frame); color: #120b07; padding: 6px 12px; border-radius: 999px; }
  .window {
    position: relative; display: grid; width: fit-content; margin-inline: auto; --cell: min(140px, 14vh, calc(54vh / var(--rows)), calc((100vw - 96px) / var(--reels))); grid-template-columns: repeat(var(--reels), var(--cell)); gap: 6px; padding: 6px; border-radius: 22px;
    background: #0b0b0c; box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--frame) 40%, transparent), inset 0 20px 40px rgba(0,0,0,.6);
  }
  .reel { overflow: hidden; height: calc(var(--cell) * var(--rows)); border-radius: 14px; background: linear-gradient(180deg, #e8e4da, #fbfaf6 20%, #fbfaf6 80%, #e8e4da); position: relative; }
  .gems .reel { background: linear-gradient(180deg, #17142c, #241f48 20%, #241f48 80%, #17142c); }
  .cosmic .reel { background: linear-gradient(180deg, #0b0a24, #1a1846 20%, #1a1846 80%, #0b0a24); }
  .clover .reel { background: linear-gradient(180deg, #e9f3e3, #fbfdf8 20%, #fbfdf8 80%, #e9f3e3); }
  .reel::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg, rgba(0,0,0,.35), transparent 18%, transparent 82%, rgba(0,0,0,.35)); }
  .strip { will-change: transform; transition: filter 0.2s var(--ease-snap); }
  .strip.moving { filter: blur(1.8px) brightness(1.05); }
  .cell { aspect-ratio: 1; padding: 14%; transition: opacity 0.3s, transform 0.3s; }
  .cell.lit { animation: pulse 0.9s ease-in-out infinite alternate; }
  .cell.dim { opacity: 0.35; }
  @keyframes pulse { to { transform: scale(1.1); } }
  .lines { position: absolute; inset: 6px; width: calc(100% - 12px); height: calc(100% - 12px); pointer-events: none; }
  .lines polyline { fill: none; vector-effect: non-scaling-stroke; stroke-width: 4; stroke-linejoin: round; stroke-linecap: round; opacity: 0.85; filter: drop-shadow(0 0 4px rgba(0,0,0,.6)); stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 0.6s var(--ease-snap) forwards; }
  @keyframes draw { to { stroke-dashoffset: 0; } }
  .readout { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); min-width: min(100%, 440px); gap: 12px; padding: 18px 6px 2px; color: #f4f2ee; }
  .readout > div { display: grid; gap: 6px; justify-items: center; }
  .readout .eyebrow { color: rgba(244,242,238,.5); }
  .readout strong { font-size: 1.2rem; }
  .big { font-size: 1.6rem !important; }
  .pos { color: #6ff0a6; }
  .stepper { display: flex; align-items: center; gap: 10px; }
  .stepper .btn { background: rgba(255,255,255,.06); color: #f4f2ee; border-color: rgba(255,255,255,.2); }

  .dock {
    position: sticky; bottom: 12px; z-index: 20; max-width: 880px; margin: 20px auto 0; padding: 12px 16px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;
    background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: blur(14px); border-radius: 24px; box-shadow: 0 20px 50px -20px rgba(0,0,0,.5);
  }
  .switch.mini { min-height: 36px; font-size: 0.8rem; color: var(--muted); gap: 8px; }
  .autos { display: flex; gap: 6px; flex-wrap: wrap; }
  .spinbtn { min-width: 160px; min-height: 56px; font-size: 1.05rem; text-transform: uppercase; letter-spacing: 0.1em; }

  .pay { max-width: 880px; margin: 40px auto 0; }
  .paygrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-top: 14px; }
  .payitem { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 16px; background: var(--surface); border: 1px solid var(--line); font-size: 0.85rem; }
  .pi { width: 52px; height: 52px; flex: none; }
  .muted { color: var(--muted); } .small { font-size: 0.8rem; }

  @media (max-width: 640px) {
    .readout strong { font-size: 1rem; }
    .spinbtn { flex: 1 1 100%; }
  }
</style>
