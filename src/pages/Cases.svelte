<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import ArcadeLayout from '../components/ArcadeLayout.svelte';
  import SlotSymbol from '../components/SlotSymbol.svelte';
  import { CASES, RARITIES, pickItem, type CaseItem } from '../games/arcade';
  import { wallet, settle, stake, fmt } from '../lib/state.svelte';
  import { byId, gameName } from '../lib/games';
  import { sfx, reveal } from '../lib/sfx';
  import { pop } from '../lib/motion';
  import { t } from '../lib/i18n';

  let ci = $state(0);
  const box = $derived(CASES[ci]);
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
    const dur = matchMedia('(prefers-reduced-motion: reduce)').matches ? 300 : quick ? 1900 : 6200;
    const t0 = performance.now();
    let lastIdx = -1;
    sfx('spin');
    await new Promise<void>((resolve) => {
      const frame = (now: number) => {
        const k = Math.min(1, (now - t0) / dur);
        // long, smooth deceleration: fast start, many seconds of slowing ticks
        offset = target * (1 - Math.pow(1 - k, 4.2));
        fast = k < 0.32;
        const idx = Math.floor((offset + center) / STEP);
        if (idx !== lastIdx) { lastIdx = idx; sfx('caseTick'); }
        if (k < 1) raf = requestAnimationFrame(frame);
        else resolve();
      };
      raf = requestAnimationFrame(frame);
    });
    const value = Math.round(box.price * prize.mult * 100) / 100;
    settle(value, value);
    reveal(prize.rarity);
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

<ArcadeLayout eyebrow="Arcade · {box.items.length} items" title={gameName(byId('cases')!)}>
  {#snippet controls()}
    <button class="btn primary big" disabled={spinning || box.price > wallet.balance} onclick={open}>{t('cs.open')} <span class="mono">{fmt(box.price)}</span></button>
    <div class="picker">
      {#each CASES as c, i}
        <button class="case" class:on={ci === i} disabled={spinning} onclick={() => { ci = i; sfx('click'); }} style="--c:{c.color}">
          <span class="crate"><i></i></span>
          <span class="nm">{c.name}</span>
          <span class="mono pr">{fmt(c.price)}</span>
        </button>
      {/each}
    </div>
    <label class="switch"><span>{t('cs.quick')}</span><input type="checkbox" bind:checked={quick} disabled={spinning} /></label>
  {/snippet}

  <div class="stage">
    <div class="window" bind:this={viewport}>
      <div class="strip" class:fast style="transform: translate3d({-offset}px, 0, 0)">
        {#each reel as it, i}
          <div class="item" class:won={!spinning && win && i === WIN_AT} style="--c:{RARITIES[it.rarity].color}">
            <span class="ico"><SlotSymbol sym={it.icon} /></span>
            <span class="iname">{it.name}</span>
          </div>
        {/each}
      </div>
      <div class="marker" aria-hidden="true"></div>
      <div class="fade l"></div><div class="fade r"></div>
    </div>

    <div class="result">
      {#if win}
        <div class="prize" style="--c:{RARITIES[win.item.rarity].color}" in:pop>
          <span class="ico big"><SlotSymbol sym={win.item.icon} /></span>
          <div>
            <p class="eyebrow">{t(('cs.r' + win.item.rarity) as any)}</p>
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
          <span class="ico"><SlotSymbol sym={it.icon} /></span>
          <span class="iname">{it.name}</span>
          <span class="mono meta">{fmt(Math.round(box.price * it.mult * 100) / 100)} · {(chance(it) * 100).toFixed(chance(it) < 0.01 ? 2 : 1)} %</span>
        </div>
      {/each}
    </div>
    {#if history.length}
      <div class="hist">
        {#each history as h (h.id)}<span style="--c:{RARITIES[h.item.rarity].color}" title={h.item.name}><SlotSymbol sym={h.item.icon} /></span>{/each}
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
  .iname { font-size: 0.75rem; color: rgba(255,255,255,.75); }
  .item.won { animation: glow 1.2s var(--ease-snap) both; }
  @keyframes glow { 0% { box-shadow: inset 0 -4px 0 var(--c), 0 0 0 0 var(--c); } 40% { box-shadow: inset 0 -150px 0 color-mix(in srgb, var(--c) 30%, transparent), 0 0 40px 6px var(--c); } 100% { box-shadow: inset 0 -4px 0 var(--c), 0 0 24px 2px var(--c); } }
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
  }
</style>
