<script lang="ts">
  // Lobby art for the horse race: three horses galloping towards the winning post, drawn with the game's renderer.
  import { onMount } from 'svelte';
  import { field, DIST } from '../games/horses';
  import { drawHorse, drawBackdrop, drawForeground, drawClods, layout } from '../games/horsesDraw';

  let wrap: HTMLDivElement, canvas: HTMLCanvasElement;
  const horses = field(11).slice(0, 3);
  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, raf = 0, t = 0, last = performance.now();
    const fit = () => {
      W = wrap.clientWidth; H = wrap.clientHeight;
      const dpr = devicePixelRatio || 1;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };
    function draw() {
      if (!W) return;
      // a taller picture than the game: zoom on the leading three
      const L = layout(W, H * 2.1);
      ctx.save(); ctx.translate(0, -H * 0.93);
      const lead = DIST - 6 + ((t * 2) % 8), cam = lead - L.view * 0.7;
      drawBackdrop(ctx, L, cam, t, true);
      horses.forEach((h, k) => {
        const i = [1, 3, 5][k], { y, s } = L.lane(i), x = (lead - [1.2, 0, 0.8][k] - 1.85 - cam) * L.ppm, stride = t * 2.6 + k * 0.33;
        drawClods(ctx, x, y, s, stride, 1);
        drawHorse(ctx, h, x, y, s, stride, 1);
      });
      drawForeground(ctx, L, cam);
      ctx.restore();
    }
    const loop = (now: number) => { t += Math.min(0.05, (now - last) / 1000); last = now; draw(); raf = requestAnimationFrame(loop); };
    const ro = new ResizeObserver(fit); ro.observe(wrap); fit();
    const io = new IntersectionObserver(([e]) => { cancelAnimationFrame(raf); if (e.isIntersecting && !still) { last = performance.now(); raf = requestAnimationFrame(loop); } });
    io.observe(wrap);
    return () => { ro.disconnect(); io.disconnect(); cancelAnimationFrame(raf); };
  });
</script>

<div class="da" bind:this={wrap}><canvas bind:this={canvas}></canvas></div>

<style>
  .da { position: absolute; inset: 0; background: #2e4f86; }
  canvas { display: block; width: 100%; height: 100%; }
</style>
