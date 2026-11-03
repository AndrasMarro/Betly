<script lang="ts">
  // A thick 3D coin: tossed up, flipping end over end, lands with a clink, bounces once and wobbles flat.
  import { onDestroy, untrack } from 'svelte';
  import SlotSymbol from './SlotSymbol.svelte';
  import { sfx } from '../lib/sfx';

  let { face, tosses, size = 180, ondone }: { face: 'heads' | 'tails'; tosses: number; size?: number; ondone?: () => void } = $props();

  let theta = $state(0); // rotation around the horizontal axis, degrees
  let lift = $state(0); // 0..1 height above the table
  let raf = 0;
  const LAYERS = 14;

  $effect(() => {
    if (!tosses) return;
    const target = face;
    cancelAnimationFrame(raf);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = untrack(() => theta) % 360;
    const turns = 6 + Math.floor(Math.random() * 3);
    const end = start - (start % 360) + 360 * turns + (target === 'tails' ? 180 : 0);
    if (reduce) { theta = end % 360; lift = 0; untrack(() => ondone?.()); return; }
    const AIR = 1.05, BOUNCE = 0.26, SETTLE = 0.55, over = 28 + Math.random() * 10;
    const t0 = performance.now();
    let landed = false, bounced = false;
    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      if (t < AIR) {
        const u = t / AIR;
        lift = 4 * u * (1 - u);
        theta = start + (end + over - start) * (1 - Math.pow(1 - u, 1.35));
      } else if (t < AIR + BOUNCE) {
        if (!landed) { landed = true; sfx('bounce'); }
        const v = (t - AIR) / BOUNCE;
        lift = 0.14 * 4 * v * (1 - v);
        theta = end + over * Math.cos(v * Math.PI * 0.9);
      } else if (t < AIR + BOUNCE + SETTLE) {
        if (!bounced) { bounced = true; sfx('click'); }
        const w = (t - AIR - BOUNCE) / SETTLE;
        lift = 0;
        theta = end + over * -0.31 * Math.exp(-5 * w) * Math.cos(w * 16);
      } else {
        theta = end;
        lift = 0;
        ondone?.();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
  onDestroy(() => cancelAnimationFrame(raf));

  const rad = $derived((theta * Math.PI) / 180);
  const light = $derived(0.62 + 0.38 * Math.abs(Math.cos(rad)));
  const shine = $derived(50 + 45 * Math.sin(rad));
</script>

<div class="stage" style="--s:{size}px">
  <div class="coin" style="transform: translateY({-lift * size * 1.15}px) scale({1 + lift * 0.22}) rotateX({theta}deg); --l:{light}; --shine:{shine}%">
    {#each Array(LAYERS) as _, i}
      <i class="rim" style="transform: translateZ({(i / (LAYERS - 1) - 0.5) * size * 0.08}px)"></i>
    {/each}
    <div class="face front"><span class="ico"><SlotSymbol sym="crown" /></span><b class="gloss"></b></div>
    <div class="face back"><span class="ico"><SlotSymbol sym="star" /></span><b class="gloss"></b></div>
  </div>
  <div class="shadow" style="transform: scale({1 - lift * 0.55}); opacity:{0.75 - lift * 0.5}"></div>
</div>

<style>
  .stage { display: grid; justify-items: center; perspective: 900px; padding-top: calc(var(--s) * 1.2); }
  .coin { position: relative; width: var(--s); height: var(--s); transform-style: preserve-3d; will-change: transform; filter: brightness(var(--l)); }
  .rim { position: absolute; inset: 0; border-radius: 50%; background: repeating-conic-gradient(#a8741a 0 4deg, #d9a536 4deg 8deg); }
  .face {
    position: absolute; inset: 0; border-radius: 50%; display: grid; place-items: center; overflow: hidden; backface-visibility: hidden;
    background: radial-gradient(circle at 35% 30%, #fff2b8, #f2c046 40%, #b9821f 100%);
    box-shadow: inset 0 0 0 calc(var(--s) * 0.035) #d9a536, inset 0 0 0 calc(var(--s) * 0.05) #f7d77a, inset 0 0 calc(var(--s) * 0.12) rgba(0,0,0,.25);
  }
  .front { transform: translateZ(calc(var(--s) * 0.041)); }
  .back { transform: rotateX(180deg) translateZ(calc(var(--s) * 0.041)); background: radial-gradient(circle at 35% 30%, #f6f6fa, #c6c9d6 45%, #7d8296 100%); box-shadow: inset 0 0 0 calc(var(--s) * 0.035) #a3a8b8, inset 0 0 0 calc(var(--s) * 0.05) #e2e4ec, inset 0 0 calc(var(--s) * 0.12) rgba(0,0,0,.25); }
  .ico { width: 52%; height: 52%; }
  .gloss { position: absolute; inset: 0; background: linear-gradient(115deg, transparent calc(var(--shine) - 18%), rgba(255,255,255,.55) var(--shine), transparent calc(var(--shine) + 18%)); mix-blend-mode: soft-light; }
  .shadow { width: calc(var(--s) * 0.85); height: calc(var(--s) * 0.12); margin-top: calc(var(--s) * 0.08); border-radius: 50%; background: radial-gradient(closest-side, rgba(0,0,0,.65), transparent); }
</style>
