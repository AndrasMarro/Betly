<script lang="ts">
  // Real 3D dice (W6, W8 or W10): a tiny rigid-body throw (gravity, bounces, friction) is simulated up front,
  // the face that ends up on top is given the rolled number, then the frames are played back.
  // Every face is a flat polygon placed in 3D, so the dice are solid from every side.
  // Mine dice are W6 with `mines` bomb faces: landing on one blows the die up.
  import { onDestroy, untrack } from 'svelte';
  import Sprite from './Sprite.svelte';

  let { values, rolls, size = 96, faces = 6, mines = 0, ondone }: { values: number[]; rolls: number; size?: number; faces?: 6 | 8 | 10; mines?: number; ondone?: () => void } = $props();

  type V = [number, number, number];
  type M = number[]; // 3x3 row-major
  const mul = (a: M, b: M): M => [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]));
  const apply = (m: M, v: V): V => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
  function axisAngle([x, y, z]: V, a: number): M {
    const c = Math.cos(a), s = Math.sin(a), t = 1 - c;
    return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
  }
  const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (v: V): V => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const I: M = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  // ---------- the solids (CSS axes: y points down, so "up" is -y) ----------
  type Face = { n: V; css: string; clip: string; w: number; h: number; lx: number; ly: number };
  type Solid = { faces: Face[]; inr: number; opp: number[] };
  function solid(f: number, s: number): Solid {
    let verts: V[], polys: number[][];
    if (f === 6) {
      const a = s / 2;
      verts = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [i & 1 ? a : -a, i & 2 ? a : -a, i & 4 ? a : -a]);
      polys = [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]];
    } else if (f === 8) {
      const a = s * 0.72;
      verts = [[a, 0, 0], [-a, 0, 0], [0, a, 0], [0, -a, 0], [0, 0, a], [0, 0, -a]];
      polys = [0, 1].flatMap((x) => [2, 3].flatMap((y) => [4, 5].map((z) => [x, y, z])));
    } else {
      // pentagonal trapezohedron: two apexes, two rings of five twisted by 36°; z keeps the kites flat
      const r = s * 0.62, h = s * 0.66, c = Math.cos(Math.PI / 5), z = (h * (1 - c)) / (1 + c);
      const ring = (k: number, off: number, y: number): V => [r * Math.cos((k * 2 * Math.PI) / 5 + off), y, r * Math.sin((k * 2 * Math.PI) / 5 + off)];
      verts = [[0, -h, 0], [0, h, 0], ...[0, 1, 2, 3, 4].map((k) => ring(k, 0, -z)), ...[0, 1, 2, 3, 4].map((k) => ring(k, Math.PI / 5, z))];
      const U = (k: number) => 2 + (k % 5), L = (k: number) => 7 + (k % 5);
      polys = [0, 1, 2, 3, 4].flatMap((k) => [[0, U(k), L(k), U(k + 1)], [1, L(k), U(k + 1), L(k + 1)]]);
    }
    const faces = polys.map((poly) => {
      const P = poly.map((i) => verts[i]);
      const c = P.reduce((a, p) => [a[0] + p[0] / P.length, a[1] + p[1] / P.length, a[2] + p[2] / P.length] as V, [0, 0, 0] as V);
      let n = norm(cross(sub(P[1], P[0]), sub(P[2], P[0])));
      if (dot(n, c) < 0) n = [-n[0], -n[1], -n[2]];
      // the number reads upright towards the first corner (triangles, kites) or an edge (squares)
      const upTo = P.length === 4 && f === 6 ? P[0].map((x, i) => (x + P[1][i]) / 2) as V : P[0];
      const v = norm(sub(c, upTo)), u = cross(v, n);
      const pts = P.map((p) => { const d = sub(p, c), x = dot(d, u), y = dot(d, v), k = 1 + 0.9 / Math.hypot(x, y); return [x * k, y * k]; }); // 0.9px wider: no seams
      const minx = Math.min(...pts.map((p) => p[0])), maxx = Math.max(...pts.map((p) => p[0])), miny = Math.min(...pts.map((p) => p[1])), maxy = Math.max(...pts.map((p) => p[1]));
      const w = maxx - minx, h = maxy - miny, t = [0, 1, 2].map((i) => c[i] + minx * u[i] + miny * v[i]);
      return {
        n, w, h, lx: -minx, ly: -miny,
        css: `matrix3d(${u.join(',')},0,${v.join(',')},0,${n.join(',')},0,${t.join(',')},1)`,
        clip: `polygon(${pts.map(([x, y]) => `${((x - minx) / w) * 100}% ${((y - miny) / h) * 100}%`).join(',')})`,
      };
    });
    const opp = faces.map((a) => faces.findIndex((b) => dot(a.n, b.n) < -0.999));
    return { faces, inr: dot(faces[0].n, sub(verts[polys[0][0]], [0, 0, 0])), opp };
  }

  const UP: V = [0, -1, 0];
  const TILT = 32 * (Math.PI / 180); // camera looks down at the table
  const LIGHT = norm([-0.45, -1, 0.55]);
  const S = $derived(solid(faces, size));

  type Frame = { p: V; R: M };
  type Die = { frames: Frame[]; nums: number[]; cur: Frame; shade: number[]; boom?: boolean };
  const shadeOf = (R: M) => S.faces.map((fc) => { const w = apply(R, fc.n); return 0.55 + 0.45 * Math.max(0, dot(w, LIGHT)); });
  const spread = (i: number, n: number) => (i - (n - 1) / 2) * size * (n > 2 ? 1.45 : 1.7);
  /** The face pointing most upwards, and the turn that lays it exactly flat on top. */
  function topFace(R: M) {
    let best = 0, bestDot = -2;
    S.faces.forEach((fc, i) => { const d = -apply(R, fc.n)[1]; if (d > bestDot) { bestDot = d; best = i; } });
    const nw = apply(R, S.faces[best].n);
    return { best, axis: norm(cross(nw, UP)), ang: Math.acos(Math.max(-1, Math.min(1, -nw[1]))) };
  }
  /** Number the faces: the value on top, opposite faces add up to faces + 1 like on real dice. */
  function numbers(top: number, value: number) {
    const nums: number[] = Array(faces).fill(0);
    nums[top] = value; nums[S.opp[top]] = faces + 1 - value;
    const pairs = Array.from({ length: faces / 2 }, (_, i) => [i + 1, faces - i]).filter((pr) => !pr.includes(value)).sort(() => Math.random() - 0.5);
    for (let i = 0, k = 0; i < faces; i++) if (!nums[i]) { const flip = Math.random() < 0.5; nums[i] = pairs[k][flip ? 1 : 0]; nums[S.opp[i]] = pairs[k++][flip ? 0 : 1]; }
    return nums;
  }
  const rest = (x: number, value: number): Die => {
    let R = mul(axisAngle([0, 1, 0], x > 0 ? -0.35 : 0.3), axisAngle(norm([1, 0.3, 0.2]), faces === 6 ? 0 : 0.4));
    const t = topFace(R);
    if (t.ang > 1e-4) R = mul(axisAngle(t.axis, t.ang), R);
    return { frames: [], nums: numbers(topFace(R).best, Math.min(faces, value)), cur: { p: [x, -S.inr, 0], R }, shade: shadeOf(R) };
  };
  let dice = $state<Die[]>([]);
  // a new kind or number of dice shows them at rest straight away
  $effect(() => { dice = values.map((v, i) => rest(spread(i, values.length), v)); });

  function simulate(value: number, targetX: number, lane: number): Die {
    const half = S.inr, g = 2600, dt = 1 / 120;
    let p: V = [-size * 4.2, -size * 2.6, lane * size * 0.4];
    let v: V = [size * (5.2 + Math.random()), -size * 1.2, (Math.random() - 0.5) * size];
    let w: V = [(Math.random() - 0.5) * 30, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 30];
    let R = mul(axisAngle(norm([Math.random(), Math.random(), Math.random()]), Math.random() * 6), I);
    const frames: Frame[] = [];
    for (let step = 0; step * dt < 1.15; step++) {
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
    // settle: tip onto the face that points most upwards (its opposite lies flat on the table), slide to rest
    const { best, axis, ang } = topFace(R);
    const p0 = p, steps = 20;
    for (let i = 1; i <= steps; i++) {
      const k = 1 - (1 - i / steps) ** 3;
      frames.push({ p: [p0[0] + v[0] * 0.05 * k, -half, p0[2]], R: ang > 1e-4 ? mul(axisAngle(axis, ang * k), R) : R });
    }
    // shift the whole throw so it comes to rest where we want it
    const end = frames[frames.length - 1].p;
    const dx = targetX - end[0], dz = lane * size * 0.25 - end[2];
    for (const f of frames) f.p = [f.p[0] + dx, f.p[1], f.p[2] + dz];
    return { frames, nums: numbers(best, value), cur: frames[0], shade: shadeOf(frames[0].R) };
  }

  let raf = 0;
  // only a new roll throws; changing the kind or count of dice in between does not
  $effect(() => { if (rolls) untrack(throwDice); });
  function throwDice() {
    const vals = values, safe = 6 - mines, n = vals.length;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const next = vals.map((v, i) => simulate(v, spread(i, n), n === 1 ? 0 : (i / (n - 1)) * 2 - 1));
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
        {#each S.faces as fc, i}
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
