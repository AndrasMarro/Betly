<script lang="ts">
  // CSS 3D dice (W6, W8 or W10): used on the home card and where WebGL is missing. The throw comes from diceSim.
  // Every face is a flat polygon placed in 3D, so the dice are solid from every side.
  // Mine dice are W6 with `mines` bomb faces: landing on one blows the die up.
  import { onDestroy, untrack } from 'svelte';
  import Sprite from './Sprite.svelte';
  import { apply, dot, norm, resting, simulate, solid, spread, type Frame, type M } from '../games/diceSim';

  let { values, rolls, size = 96, faces = 6, mines = 0, ondone }: { values: number[]; rolls: number; size?: number; faces?: 6 | 8 | 10; mines?: number; ondone?: () => void } = $props();

  const TILT = 32 * (Math.PI / 180); // camera looks down at the table
  const LIGHT = norm([-0.45, -1, 0.55]);
  const S = $derived(solid(faces, size));
  // each face as a clipped div: its box in the face plane and the matrix that puts it there
  const F = $derived(S.faces.map(({ P, c, n, u, v }) => {
    const pts = P.map((p) => { const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]] as const, x = d[0] * u[0] + d[1] * u[1] + d[2] * u[2], y = d[0] * v[0] + d[1] * v[1] + d[2] * v[2], k = 1 + 0.9 / Math.hypot(x, y); return [x * k, y * k]; }); // 0.9px wider: no seams
    const minx = Math.min(...pts.map((q) => q[0])), maxx = Math.max(...pts.map((q) => q[0])), miny = Math.min(...pts.map((q) => q[1])), maxy = Math.max(...pts.map((q) => q[1]));
    const w = maxx - minx, h = maxy - miny, t = [0, 1, 2].map((i) => c[i] + minx * u[i] + miny * v[i]);
    return {
      w, h, lx: -minx, ly: -miny,
      css: `matrix3d(${u.join(',')},0,${v.join(',')},0,${n.join(',')},0,${t.join(',')},1)`,
      clip: `polygon(${pts.map(([x, y]) => `${((x - minx) / w) * 100}% ${((y - miny) / h) * 100}%`).join(',')})`,
    };
  }));

  type Die = { frames: Frame[]; nums: number[]; cur: Frame; shade: number[]; boom?: boolean };
  const shadeOf = (R: M) => S.faces.map((fc) => 0.55 + 0.45 * Math.max(0, dot(apply(R, fc.n), LIGHT)));
  const die = (t: { frames: Frame[]; nums: number[] }): Die => ({ ...t, cur: t.frames[0], shade: shadeOf(t.frames[0].R) });
  let dice = $state<Die[]>([]);
  // a new kind or number of dice shows them at rest straight away
  $effect(() => { dice = values.map((v, i) => die(resting(S, spread(i, values.length, size), v))); });

  let raf = 0;
  // only a new roll throws; changing the kind or count of dice in between does not
  $effect(() => { if (rolls) untrack(throwDice); });
  function throwDice() {
    const vals = values, safe = 6 - mines, n = vals.length;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const next = vals.map((v, i) => die(simulate(S, size, v, spread(i, n, size), n === 1 ? 0 : (i / (n - 1)) * 2 - 1)));
    const land = () => { if (safe < 6) dice.forEach((d, i) => (d.boom = vals[i] > safe)); ondone?.(); };
    cancelAnimationFrame(raf);
    if (reduce) {
      for (const d of next) { d.cur = d.frames[d.frames.length - 1]; d.shade = shadeOf(d.cur.R); }
      dice = next;
      land();
      return;
    }
    dice = next;
    const t0 = performance.now();
    const tick = (now: number) => {
      let running = false;
      dice.forEach((d, i) => {
        const f = Math.floor(((now - t0 - i * 70) / 1000) * 60);
        const fr = d.frames[Math.max(0, Math.min(d.frames.length - 1, f))];
        if (f < d.frames.length - 1) running = true;
        d.cur = fr;
        d.shade = shadeOf(fr.R);
      });
      if (running) raf = requestAnimationFrame(tick);
      else land();
    };
    raf = requestAnimationFrame(tick);
  }
  onDestroy(() => cancelAnimationFrame(raf));

  const m3d = (R: M) => `matrix3d(${R[0]},${R[3]},${R[6]},0,${R[1]},${R[4]},${R[7]},0,${R[2]},${R[5]},${R[8]},0,0,0,0,1)`;
</script>

<div class="scene" style="--s:{size}px; --tilt:{TILT}rad">
  <div class="world">
    <div class="floor"></div>
    {#each dice as d}
      {@const h = -d.cur.p[1] - S.inr}
      <div class="shadow" class:gone={d.boom} style="transform: translate3d({d.cur.p[0]}px, 0, {d.cur.p[2]}px) rotateX(90deg) scale({1 - Math.min(0.6, h / (size * 3))}); opacity:{0.65 - Math.min(0.45, h / (size * 4))}"></div>
      <div class="die d{faces}" class:mine={mines > 0} class:boom={d.boom} style="transform: translate3d({d.cur.p[0]}px, {d.cur.p[1]}px, {d.cur.p[2]}px) {m3d(d.cur.R)}">
        {#each F as fc, i}
          <div class="face" style="width:{fc.w}px; height:{fc.h}px; transform:{fc.css}; clip-path:{fc.clip}; --l:{d.shade[i]}">
            {#if faces === 6 && d.nums[i] > 6 - mines}
              <span class="pip" style="left:{fc.lx}px; top:{fc.ly}px"><Sprite kind="bomb" /></span>
            {:else if faces === 6}
              <Sprite kind="die" n={d.nums[i]} />
            {:else}
              <b class:u={d.nums[i] === 6 || d.nums[i] === 9} style="left:{fc.lx}px; top:{fc.ly}px">{d.nums[i]}</b>
            {/if}
          </div>
        {/each}
      </div>
      {#if d.boom}
        <div class="boom" style="transform: translate3d({d.cur.p[0]}px, {d.cur.p[1]}px, {d.cur.p[2]}px) rotateX(var(--tilt))"><Sprite kind="boom" /></div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .scene { position: relative; height: calc(var(--s) * 2.6); perspective: 1100px; perspective-origin: 50% 20%; }
  .world { position: absolute; left: 50%; top: 60%; transform-style: preserve-3d; transform: rotateX(calc(var(--tilt) * -1)); }
  .floor { position: absolute; width: calc(var(--s) * 7); height: calc(var(--s) * 4); left: calc(var(--s) * -3.5); top: calc(var(--s) * -2); transform: rotateX(90deg); background: radial-gradient(closest-side, rgba(255,255,255,.06), transparent); }
  .shadow { position: absolute; left: calc(var(--s) / -2); top: calc(var(--s) / -2); width: var(--s); height: var(--s); border-radius: 30%; background: radial-gradient(closest-side, rgba(0,0,0,.75), transparent); transition: opacity 0.3s; }
  .shadow.gone { opacity: 0 !important; }
  .die { position: absolute; left: 0; top: 0; transform-style: preserve-3d; }
  .face { position: absolute; left: 0; top: 0; transform-origin: 0 0; backface-visibility: hidden; background: #fbfaf6; }
  .face::after { content: ''; position: absolute; inset: 0; background: #000; opacity: calc(1 - var(--l)); pointer-events: none; }
  .d8 .face { background: linear-gradient(160deg, #3460d6, #1d3a94); }
  .d10 .face { background: linear-gradient(160deg, #22a067, #136240); }
  .face b { position: absolute; translate: -50% -42%; font: 800 calc(var(--s) * 0.26)/1 'Geist Variable', sans-serif; color: #fff4d6; text-shadow: 0 1px 0 rgba(0,0,0,.35); }
  .d10 .face b { font-size: calc(var(--s) * 0.2); translate: -50% -20%; }
  .face b.u { text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 2px; }
  .face .pip { position: absolute; width: 58%; aspect-ratio: 1; translate: -50% -50%; }
  .mine .face { background: #f3efe6; }
  .die.boom { animation: blast 0.35s ease-in forwards; }
  @keyframes blast { to { scale: 1.6; opacity: 0; } }
  .boom { position: absolute; left: calc(var(--s) * -0.9); top: calc(var(--s) * -0.9); width: calc(var(--s) * 1.8); height: calc(var(--s) * 1.8); pointer-events: none; animation: bang 0.9s ease-out forwards; }
  @keyframes bang { from { scale: 0.2; opacity: 1; } 45% { scale: 1.15; opacity: 1; } to { scale: 1.3; opacity: 0; } }
</style>
