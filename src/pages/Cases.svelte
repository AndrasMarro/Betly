<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import ArcadeLayout from '../components/ArcadeLayout.svelte';
  import SlotSymbol from '../components/SlotSymbol.svelte';
  import { CASES, CLASSIC_CASES, RARITIES, GOLD_P, pickItem, atLeastOneGold, caseRtp, type CaseItem } from '../games/arcade';
  import { wallet, settle, stake, fmt } from '../lib/state.svelte';
  import { byId, gameName } from '../lib/games';
  import { sfx, reveal, sampler } from '../lib/sfx';
  import caseUrl from '../assets/case-open.mp3';
  // item artwork, keyed by file name (golden-edge.webp -> 'golden-edge')
  const ART = Object.fromEntries(Object.entries(import.meta.glob('../assets/cases/*.webp', { eager: true, import: 'default' })).map(([k, v]) => [k.split('/').pop()!.replace('.webp', ''), v as string]));
  // the recording holds the case unlock (0-1.5 s), a reel rattle and the reveal (from 7.6 s); single clicks are cut from it
  const rec = sampler(caseUrl, 0.9);
  rec.preload();
  import { pop } from '../lib/motion';
  import { t } from '../lib/i18n';

  let mode = $state<'arcade' | 'classic'>('classic');
  let ci = $state(0);
  let cci = $state(1); // classic crate
  const box = $derived(mode === 'classic' ? CLASSIC_CASES[cci] : CASES[ci]);
  // classic mode keeps lifetime stats, like a real inventory history
  let stats = $state({ opened: 0, golds: 0, spent: 0, back: 0 });
  try { Object.assign(stats, JSON.parse(localStorage.getItem('betly:cases-classic') || '{}')); } catch {}
  $effect(() => { try { localStorage.setItem('betly:cases-classic', JSON.stringify(stats)); } catch {} });
  const curve = $derived(Array.from({ length: 61 }, (_, i) => [i * 25, atLeastOneGold(i * 25)] as const));
  let kick = $state(0);
  let quick = $state(false);
  let spinning = $state(false);
  let fast = $state(false);
  let reel = $state<CaseItem[]>([]);
  let offset = $state(0);
  let win = $state<{ item: CaseItem; value: number } | null>(null);
  let history = $state<{ item: CaseItem; id: number }[]>([]);
  let viewport: HTMLDivElement;
  let raf = 0, n = 0;
  const ITEM = 150, GAP = 8, STEP = ITEM + GAP, WIN_AT = 52;
  onDestroy(() => cancelAnimationFrame(raf));

  const sorted = $derived([...box.items].sort((a, b) => b.mult - a.mult));
  const chance = (it: CaseItem) => RARITIES[it.rarity].p / box.items.filter((x) => x.rarity === it.rarity).length;

  // idle reel so the window is never empty
  $effect(() => {
    reel = Array.from({ length: 12 }, () => pickItem(box));
    offset = 0;
  });

  async function open() {
    if (spinning || box.price > wallet.balance) return;
    stake(box.price);
    spinning = true;
    win = null;
    const prize = pickItem(box);
    reel = Array.from({ length: WIN_AT + 8 }, (_, i) => (i === WIN_AT ? prize : pickItem(box)));
    offset = 0;
    await tick();
    const center = viewport.clientWidth / 2;
    const target = WIN_AT * STEP + ITEM / 2 - center + (Math.random() - 0.5) * (ITEM * 0.8);
    const dur = matchMedia('(prefers-reduced-motion: reduce)').matches ? 300 : quick ? 2200 : 7200;
    const t0 = performance.now();
    let lastIdx = -1;
    rec.play(0.15, 1.35, 0.8);
    await new Promise<void>((resolve) => {
      const frame = (now: number) => {
        const k = Math.min(1, (now - t0) / dur);
        // very fast start, then a long cubic slowdown so the last items crawl past the marker
        offset = target * (1 - Math.pow(1 - k, 3.1));
        fast = k < 0.22;
        const idx = Math.floor((offset + center) / STEP);
        if (idx !== lastIdx) { lastIdx = idx; rec.play(6.195, 0.07, 2.2); kick = now; }
        if (k < 1) raf = requestAnimationFrame(frame);
        else resolve();
      };
      raf = requestAnimationFrame(frame);
    });
    await new Promise((r) => setTimeout(r, quick ? 120 : 380)); // a breath before the reveal
    const value = Math.round(box.price * prize.mult * 100) / 100;
    if (mode === 'classic') { stats.opened++; stats.spent += box.price; stats.back += value; if (prize.rarity === 4) stats.golds++; }
    settle(value, value);
    rec.play(7.58, undefined, prize.rarity >= 2 ? 1 : 0.7);
    if (prize.rarity >= 2) reveal(prize.rarity);
    win = { item: prize, value };
    history = [{ item: prize, id: ++n }, ...history].slice(0, 12);
    spinning = false;
  }
  function key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, select, textarea, button')) return;
    if (e.code === 'Space') { e.preventDefault(); open(); }
  }
</script>

<svelte:window onkeydown={key} />

{#snippet art(it: CaseItem)}
  {#if it.img && ART[it.img]}<img src={ART[it.img]} alt="" draggable="false" />{:else}<SlotSymbol sym={it.icon} />{/if}
{/snippet}

<ArcadeLayout eyebrow="{mode === 'classic' ? 'Classic' : 'Arcade'} · {box.items.length} items" title={gameName(byId('cases')!)}>
  {#snippet controls()}
    <button class="btn primary big" disabled={spinning || box.price > wallet.balance} onclick={open}>{t('cs.open')} <span class="mono">{fmt(box.price)}</span></button>
    <div class="seg" role="group">
      <button class:on={mode === 'arcade'} disabled={spinning} onclick={() => (mode = 'arcade')}>Arcade</button>
      <button class:on={mode === 'classic'} disabled={spinning} onclick={() => (mode = 'classic')}>Classic</button>
    </div>
    {#if mode === 'arcade'}
      <div class="picker">
        {#each CASES as c, i}
          <button class="case" class:on={ci === i} disabled={spinning} onclick={() => { ci = i; sfx('click'); }} style="--c:{c.color}">
            <span class="crate"><i></i></span>
            <span class="nm">{c.name}</span>
            <span class="mono pr">{fmt(c.price)}</span>
          </button>
        {/each}
      </div>
    {:else}
      <div class="picker">
        {#each CLASSIC_CASES as c, i}
          {@const top = c.items.find((x) => x.rarity === 4)!}
          <button class="case" class:on={cci === i} disabled={spinning} onclick={() => { cci = i; sfx('click'); }} style="--c:{c.color}">
            <span class="thumb"><img src={ART[top.img!]} alt="" /></span>
            <span class="nm">{c.name}</span>
            <span class="mono pr">{fmt(c.price)}</span>
          </button>
        {/each}
      </div>
      <div class="math">
        <p class="eyebrow">{t('cs.odds')}</p>
        {#each RARITIES as r, i}
          <div class="row" style="--c:{r.color}"><i></i><span>{t(('cs.c' + i) as any)}</span><span class="mono">{(r.p * 100).toFixed(2)} %</span><span class="mono muted">1 : {1 / r.p < 10 ? (1 / r.p).toFixed(2) : Math.round(1 / r.p)}</span></div>
        {/each}
      </div>
    {/if}
    <label class="switch"><span>{t('cs.quick')}</span><input type="checkbox" bind:checked={quick} disabled={spinning} /></label>
  {/snippet}

  <div class="stage">
    <div class="window" bind:this={viewport}>
      <div class="strip" class:fast style="transform: translate3d({-offset}px, 0, 0)">
        {#each reel as it, i}
          <div class="item" class:won={!spinning && win && i === WIN_AT} style="--c:{RARITIES[it.rarity].color}">
            <span class="ico" class:pic={!!it.img}>{@render art(it)}</span>
            <span class="iname">{it.name}</span>
          </div>
        {/each}
      </div>
      {#key kick}<div class="marker" class:nudge={spinning} aria-hidden="true"></div>{/key}
      <div class="fade l"></div><div class="fade r"></div>
    </div>

    <div class="result">
      {#if win}
        <div class="prize" style="--c:{RARITIES[win.item.rarity].color}" in:pop>
          <span class="ico big" class:pic={!!win.item.img}>{@render art(win.item)}</span>
          <div>
            <p class="eyebrow">{t(((mode === 'classic' ? 'cs.c' : 'cs.r') + win.item.rarity) as any).replace(/ \(.*\)$/, '')}</p>
            <h3>{win.item.name}</h3>
            <p class="mono val" class:pos={win.value >= box.price}>+{fmt(win.value)} <span>({win.item.mult}×)</span></p>
          </div>
        </div>
      {:else}
        <p class="hint">{spinning ? '…' : t('cs.hint')}</p>
      {/if}
    </div>

    <h4 class="eyebrow">{t('cs.contents')}</h4>
    <div class="contents">
      {#each sorted as it}
        <div class="cell" style="--c:{RARITIES[it.rarity].color}">
          <span class="ico" class:pic={!!it.img}>{@render art(it)}</span>
          <span class="iname">{it.name}</span>
          <span class="mono meta">{fmt(Math.round(box.price * it.mult * 100) / 100)} · {(chance(it) * 100).toFixed(chance(it) < 0.01 ? 2 : 1)} %</span>
        </div>
      {/each}
    </div>
    {#if mode === 'classic'}
      <!-- the maths stays out of the way: a quiet toggle at the bottom, read-only -->
      <details class="geo">
        <summary aria-label={t('cs.geoTitle')}><span class="mono">∑</span></summary>
        <div class="geo-body">
          <div class="geo-text">
            <h4 class="eyebrow">{t('cs.geoTitle')}</h4>
            <p class="formula mono">P(≥1) = 1 − (1 − {GOLD_P})<sup>n</sup></p>
            <div class="table mono">
              {#each [100, 385, 1000] as n}<span>n = {n}</span><strong>{(atLeastOneGold(n) * 100).toFixed(1)} %</strong>{/each}
            </div>
            <p class="small">{t('cs.geoText')}</p>
            <p class="small">{t('cs.evText').replace('{ev}', ((caseRtp(box) - 1) * 100).toFixed(0))}</p>
            <div class="mine">
              <span>{t('cs.opened')} <strong class="mono">{stats.opened}</strong></span>
              <span>Gold <strong class="mono">{stats.golds}</strong></span>
              <span>{t('cs.chanceSoFar')} <strong class="mono">{(atLeastOneGold(stats.opened) * 100).toFixed(1)} %</strong></span>
              <span>{t('cs.spent')} <strong class="mono">{fmt(stats.spent)}</strong></span>
              <span>{t('cs.back')} <strong class="mono" class:neg={stats.back < stats.spent}>{fmt(Math.round(stats.back * 100) / 100)}</strong></span>
            </div>
          </div>
          <svg class="plot" viewBox="0 0 300 140" aria-label="P(n)">
            <path d="M20 120 H290 M20 120 V10" class="axis" />
            <path class="line" d={'M' + curve.map(([x, y]) => `${20 + (x / 1500) * 270} ${120 - y * 110}`).join(' L')} />
            <line x1={20 + (385 / 1500) * 270} x2={20 + (385 / 1500) * 270} y1="10" y2="120" class="mark" />
            <circle cx={20 + (Math.min(1500, stats.opened) / 1500) * 270} cy={120 - atLeastOneGold(stats.opened) * 110} r="4" class="me" />
            <text x="20" y="136">0</text><text x="150" y="136">750</text><text x="270" y="136">1500</text>
            <text x="2" y="14">100%</text>
          </svg>
        </div>
      </details>
    {/if}
    {#if history.length}
      <div class="hist">
        {#each history as h (h.id)}<span style="--c:{RARITIES[h.item.rarity].color}" title={h.item.name} class:pic={!!h.item.img}>{@render art(h.item)}</span>{/each}
      </div>
    {/if}
  </div>
</ArcadeLayout>

<style>
  .big { min-height: 56px; width: 100%; font-size: 1rem; }
  .picker { display: grid; gap: 8px; }
  .case {
    display: grid; grid-template-columns: 52px 1fr auto; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 16px;
    border: 1px solid var(--line-2); background: var(--bg-2); text-align: left; transition: border-color 0.25s var(--ease-snap), transform 0.35s var(--ease-snap), background-color 0.25s var(--ease-snap);
  }
  .case:hover:not(:disabled) { transform: translateY(-2px); }
  .case:active:not(:disabled) { transform: scale(0.97); transition-duration: 0.16s; }
  .case.on { border-color: var(--c); background: color-mix(in srgb, var(--c) 14%, var(--bg-2)); }
  .crate { position: relative; height: 40px; border-radius: 8px; background: linear-gradient(160deg, color-mix(in srgb, var(--c) 80%, #fff), var(--c) 50%, color-mix(in srgb, var(--c) 55%, #000)); box-shadow: inset 0 -4px 0 rgba(0,0,0,.25); }
  .crate::before { content: ''; position: absolute; left: 0; right: 0; top: 12px; height: 3px; background: rgba(0,0,0,.35); }
  .crate i { position: absolute; left: 50%; top: 9px; width: 12px; height: 10px; margin-left: -6px; border-radius: 3px; background: #f2c046; box-shadow: 0 1px 0 rgba(0,0,0,.4); }
  .nm { font-weight: 600; font-size: 0.9rem; }
  .thumb { height: 40px; border-radius: 8px; display: grid; place-items: center; overflow: hidden; background: linear-gradient(180deg, #1d1f2c, color-mix(in srgb, var(--c) 35%, #1d1f2c)); box-shadow: inset 0 -2px 0 var(--c); }
  .thumb img { width: 100%; height: 100%; object-fit: contain; }
  .pr { font-size: 0.8rem; color: var(--muted); }

  .stage { display: grid; gap: 18px; padding: clamp(16px, 2.4vw, 28px); border-radius: 28px; background: radial-gradient(ellipse at 50% 0%, #22243a, #0e0f18 75%); box-shadow: 0 30px 60px -30px rgba(0,0,0,.6); color: #f4f2ee; }
  .window { position: relative; overflow: hidden; border-radius: 18px; background: #0b0c12; box-shadow: inset 0 0 0 1px rgba(255,255,255,.08); padding: 14px 0; }
  .strip { display: flex; gap: 8px; will-change: transform; transition: filter 0.4s var(--ease-snap); }
  .strip.fast { filter: blur(2px); }
  .item {
    flex: 0 0 150px; height: 150px; border-radius: 12px; display: grid; justify-items: center; align-content: center; gap: 8px; position: relative;
    background: linear-gradient(180deg, #1d1f2c, color-mix(in srgb, var(--c) 28%, #1d1f2c)); box-shadow: inset 0 -4px 0 var(--c);
  }
  .item .ico { width: 70px; height: 70px; }
  .ico.pic { width: 100% !important; height: auto !important; aspect-ratio: 3 / 2; display: block; }
  .ico.pic img, .hist .pic img { width: 100%; height: 100%; object-fit: contain; display: block; pointer-events: none;
    -webkit-mask: linear-gradient(90deg, transparent, #000 9%, #000 91%, transparent), linear-gradient(transparent, #000 9%, #000 91%, transparent); -webkit-mask-composite: source-in;
    mask: linear-gradient(90deg, transparent, #000 9%, #000 91%, transparent), linear-gradient(transparent, #000 9%, #000 91%, transparent); mask-composite: intersect; }
  .item .ico.pic { padding: 0 6px; }
  .cell .ico.pic { max-width: 150px; }
  .ico.big.pic { width: 150px !important; }
  .hist span.pic { width: 54px; padding: 2px; }
  .iname { font-size: 0.75rem; color: rgba(255,255,255,.75); }
  .item.won { animation: glow 1.2s var(--ease-snap) both; }
  @keyframes glow { 0% { box-shadow: inset 0 -4px 0 var(--c), 0 0 0 0 var(--c); } 40% { box-shadow: inset 0 -150px 0 color-mix(in srgb, var(--c) 30%, transparent), 0 0 40px 6px var(--c); } 100% { box-shadow: inset 0 -4px 0 var(--c), 0 0 24px 2px var(--c); } }
  .seg { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .seg button { min-height: 38px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--bg-2); font-size: 0.85rem; transition: background-color 0.25s var(--ease-snap), color 0.25s var(--ease-snap); }
  .seg button.on { background: var(--text); color: var(--bg); }
  .seg button:disabled:not(.on) { opacity: 0.45; }
  .math { display: grid; gap: 6px; font-size: 0.82rem; }
  .math .row { display: grid; grid-template-columns: 10px 1fr auto auto; gap: 8px; align-items: center; }
  .math .row i { width: 10px; height: 10px; border-radius: 3px; background: var(--c); }
  .muted { color: var(--muted); }
  .small { font-size: 0.78rem; color: var(--muted); margin: 4px 0 0; }
  .geo { justify-self: end; }
  .geo summary { list-style: none; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; color: rgba(255,255,255,.28); font-size: 0.85rem; transition: color 0.2s, background-color 0.2s; }
  .geo summary::-webkit-details-marker { display: none; }
  .geo summary:hover, .geo[open] summary { color: #e4ae39; background: #161824; }
  .geo[open] { justify-self: stretch; }
  .geo:not([open]) .geo-body { display: none; }
  .geo[open] summary { margin-left: auto; }
  .geo-body { display: grid; grid-template-columns: 1fr minmax(220px, 300px); gap: 18px; align-items: center; padding: 16px; margin-top: 8px; border-radius: 16px; background: #161824; }
  .table { display: grid; grid-template-columns: auto auto; justify-content: start; gap: 4px 18px; font-size: 0.85rem; margin-bottom: 6px; }
  .table strong { color: #e4ae39; }
  .geo h4 { margin: 0 0 8px; color: rgba(255,255,255,.55); }
  .formula { margin: 0 0 10px; font-size: 0.95rem; }
  .mine { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 10px; font-size: 0.8rem; color: rgba(255,255,255,.65); }
  .mine strong { color: #fff; }
  .mine .neg { color: #ff9a9d; }
  .plot { width: 100%; height: auto; }
  .plot .axis { stroke: rgba(255,255,255,.25); fill: none; }
  .plot .line { stroke: #e4ae39; stroke-width: 2.5; fill: none; }
  .plot .mark { stroke: rgba(255,255,255,.35); stroke-dasharray: 3 4; }
  .plot .me { fill: #2fbf71; }
  .plot text { fill: rgba(255,255,255,.45); font: 9px 'Geist Mono Variable', monospace; }
  .marker.nudge { animation: nudge 0.12s var(--ease-snap); }
  @keyframes nudge { 40% { transform: scaleX(1.8); } }
  .marker { position: absolute; left: 50%; top: 0; bottom: 0; width: 3px; margin-left: -1.5px; background: #f2c046; box-shadow: 0 0 14px #f2c046; }
  .marker::before, .marker::after { content: ''; position: absolute; left: 50%; translate: -50% 0; border: 9px solid transparent; }
  .marker::before { top: 0; border-top-color: #f2c046; }
  .marker::after { bottom: 0; border-bottom-color: #f2c046; }
  .fade { position: absolute; top: 0; bottom: 0; width: 18%; pointer-events: none; }
  .fade.l { left: 0; background: linear-gradient(90deg, #0b0c12, transparent); }
  .fade.r { right: 0; background: linear-gradient(-90deg, #0b0c12, transparent); }
  .result { min-height: 104px; display: grid; place-items: center; }
  .prize { display: flex; gap: 18px; align-items: center; padding: 14px 22px 14px 14px; border-radius: 20px; background: color-mix(in srgb, var(--c) 18%, #12131c); box-shadow: 0 0 0 1px var(--c), 0 20px 50px -20px var(--c); }
  .ico.big { width: 76px; height: 76px; }
  .prize h3 { margin: 2px 0; font-size: 1.3rem; letter-spacing: -0.02em; }
  .prize .eyebrow { color: var(--c); }
  .val { margin: 0; font-size: 1.05rem; color: #ff9a9d; }
  .val.pos { color: #8ff0bf; }
  .val span { opacity: 0.6; }
  .hint { color: rgba(255,255,255,.55); margin: 0; }
  h4.eyebrow { margin: 0; color: rgba(255,255,255,.5); }
  .contents { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 8px; }
  .cell { display: grid; justify-items: center; gap: 4px; padding: 10px 6px; border-radius: 12px; background: #161824; box-shadow: inset 0 -3px 0 var(--c); text-align: center; transition: transform 0.35s var(--ease-snap); }
  .cell:hover { transform: translateY(-3px); }
  .cell .ico { width: 44px; height: 44px; }
  .meta { font-size: 0.66rem; color: rgba(255,255,255,.55); }
  .hist { display: flex; gap: 6px; flex-wrap: wrap; }
  .hist span { width: 34px; height: 34px; padding: 5px; border-radius: 9px; background: #161824; box-shadow: inset 0 -3px 0 var(--c); }
  @media (max-width: 640px) {
    .item { flex-basis: 150px; }
    .geo-body { grid-template-columns: 1fr; }
  }
</style>
