<script lang="ts">
  // The lotto drum: a glass sphere on a brass stand with numbered balls bouncing inside (simple 2D physics).
  // `balls` are the numbers still inside; a number that disappears flies out through the top.
  import { onMount } from 'svelte';
  let { balls, mixing = false }: { balls: number[]; mixing?: boolean } = $props();

  const W = 300, H = 350, CX = 150, CY = 150, R = 124, BR = 13;
  type Body = { n: number; x: number; y: number; vx: number; vy: number; out?: number };
  let canvas: HTMLCanvasElement;
  let bodies: Body[] = [];
  // decade colours of the numbers, like the printed balls of a real draw
  const tint = (n: number) => ['#1f5fd6', '#c8262c', '#138a55', '#7a3fd0', '#c77a00'][Math.min(4, Math.floor((n - 1) / 9))];

  function sync() {
    for (const b of bodies) if (!balls.includes(b.n) && b.out === undefined) b.out = 0;
    for (const n of balls) if (!bodies.some((b) => b.n === n)) {
      const a = Math.random() * Math.PI, d = Math.random() * (R - BR * 2);
      bodies.push({ n, x: CX + Math.cos(a) * d, y: CY + Math.sin(a) * d * 0.8, vx: 0, vy: 0 });
    }
  }
  $effect(() => { void balls.length; sync(); });

  function step(dt: number) {
    const lim = R - BR - 5;
    for (const b of bodies) {
      if (b.out !== undefined) { // leaving: rise to the exit at the top
        b.out += dt;
        b.x += (CX - b.x) * Math.min(1, dt * 10);
        b.y += (CY - R - 30 - b.y) * Math.min(1, dt * 7);
        continue;
      }
      b.vy += 900 * dt;
      if (mixing) {
        // an air jet from the bottom plus some turbulence
        if (b.y > CY + R * 0.2) b.vy -= (2600 + Math.random() * 1800) * dt;
        b.vx += (Math.random() - 0.5) * 2600 * dt;
        b.vy += (Math.random() - 0.5) * 1400 * dt;
      }
      b.vx *= 0.995; b.vy *= 0.995;
      b.x += b.vx * dt; b.y += b.vy * dt;
      const dx = b.x - CX, dy = b.y - CY, d = Math.hypot(dx, dy);
      if (d > lim) {
        const nx = dx / d, ny = dy / d, vn = b.vx * nx + b.vy * ny;
        b.x = CX + nx * lim; b.y = CY + ny * lim;
        if (vn > 0) { const e = mixing ? 1.8 : 1.35; b.vx -= e * vn * nx; b.vy -= e * vn * ny; }
      }
    }
    bodies = bodies.filter((b) => (b.out ?? 0) < 0.6);
    const live = bodies.filter((b) => b.out === undefined);
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j], dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
      if (d2 >= 4 * BR * BR || d2 === 0) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, push = (2 * BR - d) / 2;
      a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vn < 0) { const k = vn * 0.9; a.vx += k * nx; a.vy += k * ny; b.vx -= k * nx; b.vy -= k * ny; }
    }
  }

  function ball(g: CanvasRenderingContext2D, b: Body) {
    const s = b.out === undefined ? 1 : 1 + b.out * 0.8;
    g.save();
    g.translate(b.x, b.y); g.scale(s, s);
    g.globalAlpha = b.out === undefined ? 1 : Math.max(0, 1 - b.out / 0.6);
    const grd = g.createRadialGradient(-4, -5, 1, 0, 0, BR);
    grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.7, '#e7e9ef'); grd.addColorStop(1, '#a9aebb');
    g.fillStyle = grd;
    g.beginPath(); g.arc(0, 0, BR, 0, 7); g.fill();
    g.fillStyle = tint(b.n);
    g.font = '700 11px "Geist Mono Variable", ui-monospace, monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(b.n), 0, 0.5);
    g.restore();
  }

  function draw(g: CanvasRenderingContext2D) {
    g.clearRect(0, 0, W, H);
    // brass stand
    const brass = g.createLinearGradient(80, 0, 220, 0);
    brass.addColorStop(0, '#6e4a17'); brass.addColorStop(0.35, '#f3d48a'); brass.addColorStop(0.55, '#c9973f'); brass.addColorStop(1, '#5a3a10');
    g.fillStyle = brass;
    g.beginPath(); g.moveTo(128, CY + R - 6); g.lineTo(172, CY + R - 6); g.lineTo(186, 318); g.lineTo(114, 318); g.closePath(); g.fill();
    g.beginPath(); g.ellipse(CX, 326, 92, 14, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(114, 314, 72, 3);
    // exit collar at the top
    g.fillStyle = brass; g.fillRect(CX - 18, CY - R - 16, 36, 20);
    g.fillStyle = '#2a1b06'; g.beginPath(); g.ellipse(CX, CY - R - 16, 18, 5, 0, 0, 7); g.fill();
    // back of the glass
    const back = g.createRadialGradient(CX, CY + 30, 20, CX, CY, R);
    back.addColorStop(0, 'rgba(60,90,170,.35)'); back.addColorStop(1, 'rgba(8,16,42,.75)');
    g.fillStyle = back; g.beginPath(); g.arc(CX, CY, R, 0, 7); g.fill();
    // back half of the brass meridian
    g.strokeStyle = 'rgba(216,178,106,.25)'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(CX, CY, R, R * 0.28, 0, Math.PI, 0); g.stroke();
    for (const b of bodies) ball(g, b);
    // front of the glass: rim, equator ring and reflections
    g.strokeStyle = 'rgba(216,178,106,.7)'; g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(CX, CY, R, R * 0.28, 0, 0, Math.PI); g.stroke();
    const rim = g.createLinearGradient(0, CY - R, 0, CY + R);
    rim.addColorStop(0, '#f6dc98'); rim.addColorStop(0.5, '#a87a2c'); rim.addColorStop(1, '#f0cf82');
    g.strokeStyle = rim; g.lineWidth = 6;
    g.beginPath(); g.arc(CX, CY, R + 2, 0, 7); g.stroke();
    const shine = g.createLinearGradient(CX - R, CY - R, CX, CY);
    shine.addColorStop(0, 'rgba(255,255,255,.45)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
    g.strokeStyle = shine; g.lineWidth = 10; g.lineCap = 'round';
    g.beginPath(); g.arc(CX, CY, R - 14, Math.PI * 1.08, Math.PI * 1.42); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.beginPath(); g.ellipse(CX + R * 0.45, CY - R * 0.55, 9, 4, -0.6, 0, 7); g.fill();
  }

  onMount(() => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    const g = canvas.getContext('2d')!;
    g.scale(dpr, dpr);
    sync();
    for (let i = 0; i < 240; i++) step(1 / 120); // start with the balls at rest
    let raf = 0, last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.033, (t - last) / 1000);
      last = t;
      step(dt / 2); step(dt / 2);
      draw(g);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });
</script>

<canvas bind:this={canvas} class="drum" aria-hidden="true"></canvas>

<style>
  .drum { width: min(100%, 300px); aspect-ratio: 300 / 350; display: block; filter: drop-shadow(0 24px 30px rgba(0,0,0,.45)); }
</style>
