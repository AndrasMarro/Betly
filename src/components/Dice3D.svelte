<script lang="ts">
  // Two real 3D dice: a tiny rigid-body throw (gravity, bounces, friction) is simulated up front,
  // the face that ends up on top is given the rolled number, then the frames are played back.
  import { onDestroy } from 'svelte';
  import Sprite from './Sprite.svelte';

  let { values, rolls, size = 96, ondone }: { values: [number, number]; rolls: number; size?: number; ondone?: () => void } = $props();

  type V = [number, number, number];
  type M = number[]; // 3x3 row-major
  const mul = (a: M, b: M): M => [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]));
  const apply = (m: M, v: V): V => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
  function axisAngle([x, y, z]: V, a: number): M {
    const c = Math.cos(a), s = Math.sin(a), t = 1 - c;
    return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
  }
  const norm = (v: V): V => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const I: M = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  // Local face normals (CSS axes: y points down, so "up" is -y), in the order the faces are rendered.
  const NORMALS: V[] = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, -1, 0], [0, 1, 0]];
  const FACE_TF = ['rotateY(0deg)', 'rotateY(180deg)', 'rotateY(90deg)', 'rotateY(-90deg)', 'rotateX(90deg)', 'rotateX(-90deg)'];
  const UP: V = [0, -1, 0];
  const TILT = 32 * (Math.PI / 180); // camera looks down at the table
  const LIGHT = norm([-0.45, -1, 0.55]);

  type Frame = { p: V; R: M };
  type Die = { frames: Frame[]; pips: number[]; cur: Frame; shade: number[] };
  const rest = (x: number): Die => ({ frames: [], pips: [1, 6, 3, 4, 2, 5], cur: { p: [x, -size / 2, 0], R: axisAngle([0, 1, 0], x > 0 ? -0.35 : 0.3) }, shade: Array(6).fill(1) });
  const initial = () => [rest(-size * 0.85), rest(size * 0.85)].map((d) => ({ ...d, shade: shadeOf(d.cur.R) }));
  let dice = $state<Die[]>(initial());

  function shadeOf(R: M) {
    return NORMALS.map((n) => {
      const w = apply(R, n);
      return 0.55 + 0.45 * Math.max(0, w[0] * LIGHT[0] + w[1] * LIGHT[1] + w[2] * LIGHT[2]);
    });
  }

  function simulate(value: number, targetX: number, lane: number): Die {
    const half = size / 2, g = 2600, dt = 1 / 120;
    let p: V = [-size * 4.2, -size * 2.6, lane * size * 0.4];
    let v: V = [size * (5.2 + Math.random()), -size * 1.2, (Math.random() - 0.5) * size];
    let w: V = [(Math.random() - 0.5) * 30, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 30];
    let R = mul(axisAngle(norm([Math.random(), Math.random(), Math.random()]), Math.random() * 6), I);
    const frames: Frame[] = [];
    const total = 1.15;
    for (let step = 0; step * dt < total; step++) {
      v[1] += g * dt;
      p = [p[0] + v[0] * dt, p[1] + v[1] * dt, p[2] + v[2] * dt];
      if (p[1] > -half) { // hit the table
        p[1] = -half;
        v = [v[0] * 0.62, -v[1] * 0.42, v[2] * 0.62];
        w = [w[0] * 0.62, w[1] * 0.7, w[2] * 0.62];
      }
      const sp = Math.hypot(...w);
      if (sp > 0.001) R = mul(axisAngle(norm(w), sp * dt), R);
      w = [w[0] * 0.992, w[1] * 0.992, w[2] * 0.992];
      if (step % 2 === 0) frames.push({ p, R }); // 120 Hz physics, 60 fps playback
    }
    // settle: tip onto the face that points most upwards, slide to rest
    let best = 0, bestDot = -2;
    NORMALS.forEach((n, i) => { const d = -apply(R, n)[1]; if (d > bestDot) { bestDot = d; best = i; } });
    const nw = apply(R, NORMALS[best]);
    const axis = norm([nw[1] * UP[2] - nw[2] * UP[1], nw[2] * UP[0] - nw[0] * UP[2], nw[0] * UP[1] - nw[1] * UP[0]]);
    const ang = Math.acos(Math.max(-1, Math.min(1, -nw[1])));
    const p0 = p, steps = 20;
    for (let i = 1; i <= steps; i++) {
      const k = 1 - (1 - i / steps) ** 3;
      frames.push({ p: [p0[0] + v[0] * 0.05 * k, -half, p0[2]], R: mul(axisAngle(axis, ang * k), R) });
    }
    // shift the whole throw so it comes to rest where we want it
    const end = frames[frames.length - 1].p;
    const dx = targetX - end[0], dz = lane * size * 0.25 - end[2];
    for (const f of frames) f.p = [f.p[0] + dx, f.p[1], f.p[2] + dz];
    // number the faces: rolled value on top, opposite faces add up to 7
    const pips = Array(6).fill(0);
    const opposite = (i: number) => i ^ 1; // NORMALS are listed in opposite pairs
    pips[best] = value;
    pips[opposite(best)] = 7 - value;
    const pairs = [[1, 6], [2, 5], [3, 4]].filter((pr) => !pr.includes(value)).sort(() => Math.random() - 0.5);
    const others = [0, 2, 4].filter((i) => i !== best && i !== opposite(best) && opposite(i) !== best);
    others.forEach((i, k) => { const flipPair = Math.random() < 0.5; pips[i] = pairs[k][flipPair ? 1 : 0]; pips[opposite(i)] = pairs[k][flipPair ? 0 : 1]; });
    return { frames, pips, cur: frames[0], shade: shadeOf(frames[0].R) };
  }

  let raf = 0;
  $effect(() => {
    if (!rolls) return;
    const [a, b] = values;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const next = [simulate(a, -size * 0.85, -1), simulate(b, size * 0.85, 1)];
    cancelAnimationFrame(raf);
    if (reduce) {
      for (const d of next) { d.cur = d.frames[d.frames.length - 1]; d.shade = shadeOf(d.cur.R); }
      dice = next;
      ondone?.();
      return;
    }
    dice = next;
    const t0 = performance.now(), delay = [0, 70];
    const tick = (now: number) => {
      let running = false;
      dice.forEach((d, i) => {
        const f = Math.floor(((now - t0 - delay[i]) / 1000) * 60);
        const fr = d.frames[Math.max(0, Math.min(d.frames.length - 1, f))];
        if (f < d.frames.length - 1) running = true;
        d.cur = fr;
        d.shade = shadeOf(fr.R);
      });
      if (running) raf = requestAnimationFrame(tick);
      else ondone?.();
    };
    raf = requestAnimationFrame(tick);
  });
  onDestroy(() => cancelAnimationFrame(raf));

  const m3d = (R: M) => `matrix3d(${R[0]},${R[3]},${R[6]},0,${R[1]},${R[4]},${R[7]},0,${R[2]},${R[5]},${R[8]},0,0,0,0,1)`;
</script>

<div class="scene" style="--s:{size}px; --tilt:{TILT}rad">
  <div class="world">
    <div class="floor"></div>
    {#each dice as d}
      {@const h = -d.cur.p[1] - size / 2}
      <div class="shadow" style="transform: translate3d({d.cur.p[0]}px, 0, {d.cur.p[2]}px) rotateX(90deg) scale({1 - Math.min(0.6, h / (size * 3))}); opacity:{0.65 - Math.min(0.45, h / (size * 4))}"></div>
      <div class="die" style="transform: translate3d({d.cur.p[0]}px, {d.cur.p[1]}px, {d.cur.p[2]}px) {m3d(d.cur.R)}">
        <i class="core x"></i><i class="core y"></i><i class="core z"></i>
        {#each FACE_TF as tf, i}
          <div class="face" style="transform: {tf} translateZ(calc(var(--s) / 2)); --l:{d.shade[i]}"><Sprite kind="die" n={d.pips[i]} /></div>
        {/each}
      </div>
    {/each}
  </div>
</div>

<style>
  .scene { position: relative; height: calc(var(--s) * 2.6); perspective: 1100px; perspective-origin: 50% 20%; }
  .world { position: absolute; left: 50%; top: 60%; transform-style: preserve-3d; transform: rotateX(calc(var(--tilt) * -1)); }
  .floor { position: absolute; width: calc(var(--s) * 7); height: calc(var(--s) * 4); left: calc(var(--s) * -3.5); top: calc(var(--s) * -2); transform: rotateX(90deg); background: radial-gradient(closest-side, rgba(255,255,255,.06), transparent); }
  .die, .shadow { position: absolute; left: calc(var(--s) / -2); top: calc(var(--s) / -2); width: var(--s); height: var(--s); transform-style: preserve-3d; }
  .shadow { border-radius: 30%; background: radial-gradient(closest-side, rgba(0,0,0,.75), transparent); transform-style: flat; }
  .face { position: absolute; inset: 0; backface-visibility: hidden; border-radius: 16%; overflow: hidden; }
  .face::after { content: ''; position: absolute; inset: 0; background: #000; opacity: calc(1 - var(--l)); pointer-events: none; border-radius: inherit; }
  .core { position: absolute; inset: 3%; background: #e9e5db; border-radius: 12%; }
  .core.x { transform: rotateY(90deg); } .core.y { transform: rotateX(90deg); }
</style>
