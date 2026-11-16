<script lang="ts">
  // Lobby and daily-banner art for Retro Crossy Run: a small hand-placed scene drawn with the game's own
  // renderer (meadow, two roads with police and bus, a river with logs, a house), traffic and logs moving.
  import { onMount } from 'svelte';
  import { art, drawGround, drawRow } from '../games/crossyDraw';
  import type { Lane } from '../games/crossy';
  import duckImg from '../assets/duck/down.webp';

  let wrap: HTMLDivElement, canvas: HTMLCanvasElement;
  const duck = new Image();
  duck.src = duckImg;
  const lane = (type: Lane['type'], o: Partial<Lane> = {}): Lane =>
    ({ type, dir: 1, speed: 0, items: [], trees: [], deco: {}, decor: [], coin: null, t: 0, train: null, ...o });

  // rows from the bottom; columns are relative to the middle (the duck stands at 0)
  function scene(cols: number): Lane[] {
    const m = Math.floor(cols / 2), at = (c: number) => m + c;
    const grass = (trees: [number, Lane['deco'][number]][], decor: [number, Lane['decor'][number]['k']][]) =>
      lane('grass', { trees: trees.map(([c]) => at(c)), deco: Object.fromEntries(trees.map(([c, k]) => [at(c), k])), decor: decor.map(([c, k]) => ({ c: at(c), k })) });
    return [
      grass([[-4, 'tree'], [-2, 'bush'], [2, 'stump'], [4, 'pine'], [6, 'boulder'], [-6, 'pine']], [[-1, 'flowers'], [1, 'tuft'], [3, 'mushroom'], [-3, 'grass'], [5, 'flowers2']]),
      lane('road', { dir: 1, speed: 1.3, items: [{ x: at(-5), len: 1, c: 6 }, { x: at(1.4), len: 1, c: 7 }, { x: at(6), len: 1, c: 2 }] }),
      lane('road', { dir: -1, speed: 1.0, items: [{ x: at(-3.2), len: 2, c: 5 }, { x: at(2.6), len: 1, c: 8 }, { x: at(7), len: 2, c: 7 }] }),
      lane('river', { dir: 1, speed: 0.6, items: [{ x: at(-6), len: 3, c: 0 }, { x: at(-1.2), len: 2, c: 0 }, { x: at(3), len: 3, c: 0 }] }),
      grass([[-5, 'lamp'], [-3, 'house'], [-2, 'house2'], [0, 'tree'], [1, 'hay'], [3, 'pine'], [5, 'tree'], [7, 'lamp']], [[2, 'flower1'], [4, 'pebble1'], [-1, 'fern']]),
    ];
  }

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, C = 0, cols = 0, lanes: Lane[] = [], raf = 0, last = performance.now(), clock = 0;
    const fit = () => {
      if (!wrap) return;
      W = wrap.clientWidth; H = wrap.clientHeight;
      const dpr = devicePixelRatio || 1;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      C = H / 5.8; cols = Math.ceil(W / C) + 1;
      lanes = scene(cols);
      draw();
    };
    function draw() {
      if (!C) return;
      art.clock = clock; // each picture keeps its own time (blinking lights, water)
      ctx.clearRect(0, 0, W, H);
      const ox = W / 2 - (Math.floor(cols / 2) + 0.5) * C;
      ctx.save(); ctx.translate(ox, 0);
      const Y = (r: number) => H - (r + 1.05) * C;
      for (let r = lanes.length; r >= -1; r--) drawGround(ctx, lanes[r] ?? lane('grass'), r, Y(r), cols * C, C, lanes[r + 1]?.type === 'road' && lanes[r]?.type === 'road');
      for (let r = lanes.length - 1; r >= 0; r--) {
        drawRow(ctx, lanes[r], r, Y(r), C, cols);
        if (r === 0 && duck.complete && duck.naturalWidth) {
          const cx = (Math.floor(cols / 2) + 0.5) * C, base = Y(0) + C * 0.8, bob = Math.abs(Math.sin(art.clock * 3)) * C * 0.12;
          ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(cx, base - C * 0.06, C * 0.2, C * 0.07, 0, 0, 7); ctx.fill();
          const h = C * 1.08, w = (duck.naturalWidth / duck.naturalHeight) * h;
          ctx.drawImage(duck, cx - w / 2, base - h - bob, w, h);
        }
      }
      ctx.restore();
    }
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;
      for (const l of lanes) for (const it of l.items) {
        it.x += l.dir * l.speed * dt;
        if (l.dir > 0 && it.x > cols + 1) it.x -= cols + it.len + 3;
        if (l.dir < 0 && it.x + it.len < -2) it.x += cols + it.len + 3;
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    duck.onload = draw;
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    fit();
    // only animate while on screen
    const io = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf);
      if (e.isIntersecting && !still) { last = performance.now(); raf = requestAnimationFrame(loop); }
    });
    io.observe(wrap);
    return () => { ro.disconnect(); io.disconnect(); cancelAnimationFrame(raf); };
  });
</script>

<div class="cra" bind:this={wrap}><canvas bind:this={canvas}></canvas></div>

<style>
  .cra { position: absolute; inset: 0; background: #80cc50; }
  canvas { display: block; width: 100%; height: 100%; }
</style>
