<script lang="ts">
  // A thick 3D coin on a table seen at an angle. It is tossed high, spins slower and slower, lands on its edge,
  // teeters between the two faces (with a fake-out) and only then falls flat: the climax takes its time.
  import { onDestroy, untrack } from 'svelte';
  import SlotSymbol from './SlotSymbol.svelte';
  import { sfx } from '../lib/sfx';

  let { face, tosses, size = 180, heads = 'H', tails = 'T', ondone, onphase }: {
    face: 'heads' | 'tails'; tosses: number; size?: number; heads?: string; tails?: string; ondone?: () => void; onphase?: (p: 'air' | 'edge' | 'fall' | 'rest') => void;
  } = $props();

  let theta = $state(0); // flip angle around the coin's horizontal axis, 0 = heads up, 180 = tails up
  let lift = $state(0); // height above the table, in coin diameters
  let raf = 0;
  const LAYERS = 16;
  const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

  $effect(() => {
    if (!tosses) return;
    const target = face;
    cancelAnimationFrame(raf);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = untrack(() => theta);
    const base = Math.ceil((start + 1) / 360) * 360 + 360 * (5 + Math.floor(Math.random() * 2));
    const end = base + (target === 'tails' ? 180 : 0);
    if (reduce) { theta = end; lift = 0; untrack(() => { onphase?.('rest'); ondone?.(); }); return; }
    const edge = end - 90; // standing on the rim, undecided
    const s = Math.random() < 0.5 ? 1 : -1; // which way the fake-out leans first
    // keyframes after landing: [time, angle]; the last step is the fall onto the winning face
    const teeter: [number, number][] = [[0, edge], [0.55, edge - 30 * s], [1.15, edge + 26 * s], [1.55, edge - 12 * s], [1.8, edge + 4 * s]];
    const AIR = 1.7, EDGE = 1.8, FALL = 0.42, SETTLE = 0.6;
    const t0 = performance.now();
    let step = 0, tick = -1;
    untrack(() => onphase?.('air'));
    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      if (t < AIR) {
        const u = t / AIR;
        lift = 1.15 * 4 * u * (1 - u);
        theta = start + (edge - start) * (1 - Math.pow(1 - u, 2.2)); // spins fast, then slows down before touching
      } else if (t < AIR + EDGE) {
        if (step === 0) { step = 1; sfx('bounce'); onphase?.('edge'); }
        lift = 0;
        const v = t - AIR;
        let i = 0;
        while (i < teeter.length - 2 && v > teeter[i + 1][0]) i++;
        const [ta, a] = teeter[i], [tb, b] = teeter[i + 1];
        theta = a + (b - a) * ease(Math.min(1, (v - ta) / (tb - ta)));
        if (i !== tick) { tick = i; sfx('tick'); }
      } else if (t < AIR + EDGE + FALL) {
        if (step === 1) { step = 2; onphase?.('fall'); }
        const w = (t - AIR - EDGE) / FALL, from = teeter[teeter.length - 1][1];
        theta = from + (end - from) * w * w; // gravity: slow start, fast finish
      } else if (t < AIR + EDGE + FALL + SETTLE) {
        if (step === 2) { step = 3; sfx('click'); sfx('bounce'); }
        const w = (t - AIR - EDGE - FALL) / SETTLE;
        lift = 0.06 * Math.max(0, Math.sin(w * Math.PI * 2)) * (1 - w);
        theta = end + 7 * Math.exp(-5 * w) * Math.sin(w * 18);
      } else {
        theta = end;
        lift = 0;
        onphase?.('rest');
        ondone?.();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
  onDestroy(() => cancelAnimationFrame(raf));

  // simple lighting from above-front: each face is brighter the more it faces the light
  const rad = $derived((theta * Math.PI) / 180);
  const lf = $derived(0.55 + 0.45 * Math.max(0, Math.cos(rad - 0.5)));
  const lb = $derived(0.55 + 0.45 * Math.max(0, Math.cos(rad - Math.PI - 0.5)));
  const shine = $derived(50 + 45 * Math.sin(rad));
</script>

<div class="stage" style="--s:{size}px">
  <div class="table">
    <div class="shadow" style="transform: translate(-50%, -50%) scale({1 - Math.min(0.6, lift * 0.3)}, {(1 - Math.min(0.6, lift * 0.3)) * (0.14 + 0.86 * Math.abs(Math.cos(rad)))}); opacity:{0.7 - Math.min(0.5, lift * 0.25)}"></div>
    <div class="coin" style="transform: translate(-50%, -50%) translateZ({lift * size + size * 0.5 * Math.abs(Math.sin(rad))}px) rotateX({theta}deg); --shine:{shine}%">
      {#each Array(LAYERS) as _, i}
        <i class="rim" style="transform: translateZ({(i / (LAYERS - 1) - 0.5) * size * 0.09}px)"></i>
      {/each}
      <div class="face front" style="--l:{lf}"><span class="ico"><SlotSymbol sym="crown" /></span><span class="word">{heads}</span><b class="gloss"></b></div>
      <div class="face back" style="--l:{lb}"><span class="ico"><SlotSymbol sym="star" /></span><span class="word">{tails}</span><b class="gloss"></b></div>
    </div>
  </div>
</div>

<style>
  /* the table is tilted away from the viewer; the coin lives in that 3D space (no filters here: they would flatten it) */
  .stage { width: calc(var(--s) * 2.6); height: calc(var(--s) * 2.3); padding-top: calc(var(--s) * 0.5); perspective: 1100px; perspective-origin: 50% 0%; display: grid; place-items: center; }
  .table {
    position: relative; width: calc(var(--s) * 2.4); height: calc(var(--s) * 2.4); transform-style: preserve-3d; transform: rotateX(56deg) translateY(calc(var(--s) * 0.2));
    border-radius: 50%; background: radial-gradient(closest-side, rgba(70, 120, 90, .55), rgba(30, 60, 45, .25) 70%, transparent);
  }
  .coin { position: absolute; left: 50%; top: 50%; width: var(--s); height: var(--s); transform-style: preserve-3d; will-change: transform; }
  .rim { position: absolute; inset: 0; border-radius: 50%; background: repeating-conic-gradient(#9a6a16 0 4deg, #d9a536 4deg 8deg); }
  .face {
    position: absolute; inset: 0; border-radius: 50%; display: grid; place-items: center; align-content: center; gap: 2%; overflow: hidden; backface-visibility: hidden;
    background: radial-gradient(circle at 35% 30%, #fff2b8, #f2c046 40%, #b9821f 100%);
    box-shadow: inset 0 0 0 calc(var(--s) * 0.035) #d9a536, inset 0 0 0 calc(var(--s) * 0.05) #f7d77a, inset 0 0 calc(var(--s) * 0.12) rgba(0,0,0,.25);
    filter: brightness(var(--l));
  }
  .front { transform: translateZ(calc(var(--s) * 0.046)); }
  .back { transform: rotateX(180deg) translateZ(calc(var(--s) * 0.046)); background: radial-gradient(circle at 35% 30%, #f6f6fa, #c6c9d6 45%, #7d8296 100%); box-shadow: inset 0 0 0 calc(var(--s) * 0.035) #a3a8b8, inset 0 0 0 calc(var(--s) * 0.05) #e2e4ec, inset 0 0 calc(var(--s) * 0.12) rgba(0,0,0,.25); }
  .ico { width: 44%; height: 44%; }
  .word { font: 800 calc(var(--s) * 0.11) 'Geist Variable', sans-serif; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(90, 60, 10, .75); }
  .back .word { color: rgba(40, 44, 58, .7); }
  .gloss { position: absolute; inset: 0; background: linear-gradient(115deg, transparent calc(var(--shine) - 18%), rgba(255,255,255,.55) var(--shine), transparent calc(var(--shine) + 18%)); mix-blend-mode: soft-light; }
  .shadow { position: absolute; left: 50%; top: 50%; width: var(--s); height: var(--s); border-radius: 50%; background: radial-gradient(closest-side, rgba(0,0,0,.7), transparent); }
</style>
