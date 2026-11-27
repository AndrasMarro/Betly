<script lang="ts">
  // A little looping film for the guide, played by the real game engine: each scene scripts the player's input.
  import { onDestroy, onMount } from 'svelte';
  import { newWorld, step, trace, T, AW, AH, type World, type Input } from '../games/tanks';
  import { drawStatic, drawWorld } from '../lib/tankDraw';
  let { n }: { n: number } = $props();
  const open = (rows: Record<number, string>) => Array.from({ length: 14 }, (_, y) => rows[y] ?? '....................');
  type Scene = { map: string[]; len: number; cx: number; start?: number; setup?: (w: World) => void; input: (t: number, w: World) => Partial<Input> };
  const aimAt = (w: World, x: number, y: number) => { const me = w.tanks.find((t) => t.pid === 'me')!; return Math.atan2(y - me.y, x - me.x); };
  let bank = 0;
  const SCENES: Scene[] = [
    { map: open({ 6: '...P................' }), len: 4, cx: 7, input: (t) => ({ mx: t < 1.4 ? 1 : t < 2.2 ? 0.2 : 1, my: t < 1.4 ? 0 : t < 2.2 ? -1 : 0.4, aim: Math.sin(t * 1.5) * 0.6 }) },
    { map: open({ 6: '...P........d.......' }), len: 3, cx: 8, input: (t, w) => ({ aim: aimAt(w, 12 * T + 20, 6 * T + 20), fire: t > 0.7 && t < 0.72 }) },
    { map: open({ 3: '........#...........', 4: '........#...........', 5: '........#...........', 6: '...P....#....d......', 7: '........#...........', 8: '........#...........', 9: '........#...........' }), len: 3.6, cx: 8.5,
      setup: (w) => { const me = w.tanks.find((t) => t.pid === 'me')!; for (let a = -Math.PI; a < Math.PI; a += 0.004) { const h = trace(w, me.x + Math.cos(a) * 24, me.y + Math.sin(a) * 24, a, 1, 1400, me.id); if (h && h.kind === 'dummy') { bank = a; break; } } },
      input: (t) => ({ aim: bank, fire: t > 0.6 && t < 0.62 }) },
    { map: open({ 4: '..........c.........', 5: '..........c.........', 6: '........P.c.........', 7: '..........c.........', 8: '..........c.........' }), len: 3.4, cx: 8,
      input: (t, w) => { if (w.mines[0] && w.mines[0].t < 8.8) w.mines[0].t = 8.8; return { mine: t > 0.3 && t < 0.32, mx: t > 0.4 && t < 1.6 ? -1 : 0, aim: Math.PI }; } },
    { map: open({ 6: '...P..........b.....' }), len: 3, cx: 8.5,
      setup: (w) => { w.tanks.find((t) => t.kind === 'rust')!.cool = 99; w.shells.push({ id: 9999, x: 14 * T - 10, y: 6 * T + 20, vx: -170, vy: 0, b: 0, owner: -9, team: 'e', rocket: false, age: 1 }); },
      input: (t) => ({ aim: 0, fire: t > 0.5 && t < 0.52 }) },
    { map: open({ 2: '....#.........#.....', 6: '..P.................', 9: '..........w.........', 10: '....#.........#.....' }), len: 6, start: 2, cx: 8,
      input: (t) => ({ aim: Math.sin(t) * 0.5, mx: 0, my: 0 }) },
  ];
  let cv: HTMLCanvasElement, raf = 0;
  const stat = document.createElement('canvas');
  onMount(() => {
    const sc = SCENES[n], ctx = cv.getContext('2d')!, dpr = devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight, k = W / (11 * T);
    cv.width = W * dpr; cv.height = H * dpr;
    stat.width = AW * k * dpr; stat.height = AH * k * dpr;
    let w: World, t = 0, last = 0, camY = 6.5 * T;
    const reset = () => {
      w = newWorld(0, ['me'], [], Math.random, sc.map);
      w.t = sc.start ?? 0;
      for (const e of w.tanks) if (e.team === 'e') e.cool = 99;
      sc.setup?.(w);
      const c = stat.getContext('2d')!; c.setTransform(k * dpr, 0, 0, k * dpr, 0, 0); drawStatic(c, w); w.dirty = false;
      t = 0;
    };
    reset();
    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts;
      t += dt;
      const i = sc.input(t, w);
      step(w, dt, { me: { mx: 0, my: 0, aim: 0, fire: false, mine: false, ...i } });
      if (w.dirty) { const c = stat.getContext('2d')!; c.setTransform(k * dpr, 0, 0, k * dpr, 0, 0); drawStatic(c, w); w.dirty = false; }
      // show the middle band of the box
      // the camera looks at the scene's middle and follows the player up and down
      const me = w.tanks.find((x) => x.pid === 'me');
      camY += ((me ? me.y : 6.5 * T) - camY) * 0.08;
      const left = Math.max(0, Math.min(AW - W / k, sc.cx * T - W / k / 2)), top = Math.max(0, Math.min(AH - H / k, camY - H / k / 2));
      ctx.setTransform(k * dpr, 0, 0, k * dpr, -left * k * dpr, -top * k * dpr);
      drawWorld(ctx, w, stat);
      if (t > sc.len) reset();
    };
    raf = requestAnimationFrame(frame);
  });
  onDestroy(() => cancelAnimationFrame(raf));
</script>

<canvas bind:this={cv} class="tscene"></canvas>

<style>
  .tscene { position: absolute; inset: 0; width: 100%; height: 100%; }
</style>
