<script lang="ts">
  // The lotto drum: a glass sphere in a turning brass cage, held by a cradle on a wooden base.
  // Numbered balls bounce inside (simple 2D physics that goes to sleep once they rest, so nothing wobbles).
  // `balls` are the numbers still inside; a number that disappears rises out through the top.
  import { onMount } from 'svelte';
  let { balls, mixing = false }: { balls: number[]; mixing?: boolean } = $props();

  const W = 320, H = 370, CX = 160, CY = 160, R = 118, BR = 12;
  type Body = { n: number; x: number; y: number; vx: number; vy: number; out?: number };
  let canvas: HTMLCanvasElement;
  let bodies: Body[] = [];
  let asleep = false, calm = 0, phi = 0.4;
  // balls are coloured by decade like printed lottery balls, with a white disc for the number
  const tint = (n: number) => ['#3d7cf0', '#ec4148', '#22b06c', '#9b5cf0', '#f2a922'][Math.min(4, Math.floor((n - 1) / 9))];

  function sync() {
    for (const b of bodies) if (!balls.includes(b.n) && b.out === undefined) b.out = 0;
    for (const n of balls) if (!bodies.some((b) => b.n === n)) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * (R - BR * 2);
      bodies.push({ n, x: CX + Math.cos(a) * d, y: CY + Math.sin(a) * d, vx: 0, vy: 0 });
      asleep = false;
    }
  }
  $effect(() => { void balls.length; sync(); });
  $effect(() => { if (mixing) asleep = false; });

  function physics(dt: number) {
    const lim = R - BR - 3, live = bodies.filter((b) => b.out === undefined);
    let fast = 0;
    for (const b of live) {
      b.vy += 1500 * dt;
      if (mixing) {
        // the turning cage drags the balls round, an air jet from below throws them up, plus turbulence
        const dx = b.x - CX, dy = b.y - CY, r = Math.hypot(dx, dy) || 1;
        b.vx += (-dy / r) * 500 * dt; b.vy += (dx / r) * 500 * dt;
        if (dy > R * 0.3 && Math.abs(dx) < R * 0.45) b.vy -= (6000 + Math.random() * 6000) * dt;
        b.vx += (Math.random() - 0.5) * 9000 * dt;
        b.vy += (Math.random() - 0.5) * 9000 * dt;
      }
      const damp = mixing ? 0.999 : 0.985;
      b.vx *= damp; b.vy *= damp;
      b.x += b.vx * dt; b.y += b.vy * dt;
    }
    for (let it = 0; it < 3; it++) {
      for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
        const a = live[i], b = live[j], dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 >= 4 * BR * BR || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, push = (2 * BR - d) / 2;
        a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
        if (it === 0) {
          const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (vn < 0) { const k = vn * (mixing ? 0.9 : 0.6); a.vx += k * nx; a.vy += k * ny; b.vx -= k * nx; b.vy -= k * ny; }
        }
      }
      for (const b of live) {
        const dx = b.x - CX, dy = b.y - CY, d = Math.hypot(dx, dy);
        if (d <= lim) continue;
        const nx = dx / d, ny = dy / d, vn = b.vx * nx + b.vy * ny;
        b.x = CX + nx * lim; b.y = CY + ny * lim;
        if (vn > 0) { const e = mixing ? 1.85 : 1.25; b.vx -= e * vn * nx; b.vy -= e * vn * ny; }
      }
    }
    for (const b of live) fast = Math.max(fast, Math.hypot(b.vx, b.vy));
    return fast;
  }

  function step(dt: number) {
    // leaving balls rise to the exit at the top
    for (const b of bodies) if (b.out !== undefined) {
      b.out += dt;
      b.x += (CX - b.x) * Math.min(1, dt * 10);
      b.y += (CY - R - 34 - b.y) * Math.min(1, dt * 7);
    }
    bodies = bodies.filter((b) => (b.out ?? 0) < 0.6);
    phi += dt * (mixing ? 2.6 : 0.12);
    if (asleep) return;
    let fast = 0;
    for (let k = 0; k < 3; k++) fast = physics(dt / 3);
    // resting balls: stop simulating so the pile stays perfectly still
    calm = !mixing && fast < 22 ? calm + dt : 0;
    if (calm > 0.5) { asleep = true; for (const b of bodies) { b.vx = 0; b.vy = 0; } }
  }

  function ball(g: CanvasRenderingContext2D, b: Body) {
    const s = b.out === undefined ? 1 : 1 + b.out * 0.7;
    g.save();
    g.translate(b.x, b.y); g.scale(s, s);
    g.globalAlpha = b.out === undefined ? 1 : Math.max(0, 1 - b.out / 0.6);
    const c = tint(b.n);
    const grd = g.createRadialGradient(-4, -5, 1, 0, 0, BR);
    grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.22, c); grd.addColorStop(0.72, c); grd.addColorStop(1, '#1a1a24');
    g.fillStyle = grd;
    g.beginPath(); g.arc(0, 0, BR, 0, 7); g.fill();
    g.fillStyle = '#fbfbf7';
    g.beginPath(); g.arc(0, 0.5, BR * 0.6, 0, 7); g.fill();
    g.fillStyle = '#16161c';
    g.font = `700 ${b.n > 9 ? 9 : 10}px "Geist Mono Variable", ui-monospace, monospace`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(b.n), 0, 1);
    g.fillStyle = 'rgba(255,255,255,.75)';
    g.beginPath(); g.ellipse(-4.5, -6, 3, 1.8, -0.6, 0, 7); g.fill();
    g.restore();
  }

  let brass: CanvasGradient, brassV: CanvasGradient;
  /** Meridians of the turning cage: the half facing us is drawn after the balls. */
  function cage(g: CanvasRenderingContext2D, front: boolean) {
    for (let i = 0; i < 4; i++) {
      const p = phi + (i * Math.PI) / 4, rx = R * Math.abs(Math.cos(p));
      const right = Math.cos(p) > 0, isFront = Math.sin(p) > 0;
      // the half on the `right` side faces us when sin(p) > 0
      const drawRight = isFront === front ? right : !right;
      g.strokeStyle = front ? 'rgba(232,196,120,.55)' : 'rgba(232,196,120,.16)';
      g.lineWidth = front ? 2.2 : 1.5;
      g.beginPath();
      g.ellipse(CX, CY, Math.max(0.5, rx), R, 0, drawRight ? -Math.PI / 2 : Math.PI / 2, drawRight ? Math.PI / 2 : Math.PI * 1.5);
      g.stroke();
    }
  }

  function draw(g: CanvasRenderingContext2D) {
    g.clearRect(0, 0, W, H);
    // floor shadow
    const sh = g.createRadialGradient(CX, 352, 4, CX, 352, 120);
    sh.addColorStop(0, 'rgba(0,0,0,.5)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh; g.fillRect(20, 320, 280, 50);
    // wooden base with a gold rim
    const wood = g.createLinearGradient(0, 322, 0, 352);
    wood.addColorStop(0, '#6b3d22'); wood.addColorStop(1, '#2a160b');
    g.fillStyle = wood;
    g.beginPath(); g.ellipse(CX, 340, 98, 16, 0, 0, Math.PI); g.lineTo(CX - 98, 330); g.ellipse(CX, 330, 98, 16, 0, Math.PI, 0); g.closePath(); g.fill();
    g.fillStyle = '#7a4a2a'; g.beginPath(); g.ellipse(CX, 330, 98, 16, 0, 0, 7); g.fill();
    g.strokeStyle = brass; g.lineWidth = 2.5; g.beginPath(); g.ellipse(CX, 330, 98, 16, 0, 0, 7); g.stroke();
    // column and cradle
    g.fillStyle = brassV;
    g.beginPath(); g.moveTo(CX - 14, CY + R + 18); g.lineTo(CX + 14, CY + R + 18); g.lineTo(CX + 24, 330); g.lineTo(CX - 24, 330); g.closePath(); g.fill();
    g.strokeStyle = brass; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.arc(CX, CY, R + 16, Math.PI * 0.02, Math.PI * 0.98); g.stroke();
    // exit tube at the top
    g.fillStyle = brassV; g.fillRect(CX - 16, CY - R - 22, 32, 26);
    g.fillStyle = '#1c1206'; g.beginPath(); g.ellipse(CX, CY - R - 22, 16, 5, 0, 0, 7); g.fill();
    g.strokeStyle = brass; g.lineWidth = 3; g.beginPath(); g.ellipse(CX, CY - R - 22, 16, 5, 0, 0, 7); g.stroke();
    // back of the glass
    const back = g.createRadialGradient(CX, CY + 40, 10, CX, CY, R);
    back.addColorStop(0, 'rgba(70,100,190,.32)'); back.addColorStop(1, 'rgba(6,12,34,.82)');
    g.fillStyle = back; g.beginPath(); g.arc(CX, CY, R, 0, 7); g.fill();
    cage(g, false);
    g.strokeStyle = 'rgba(232,196,120,.18)'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(CX, CY, R, R * 0.22, 0, Math.PI, 0); g.stroke();
    for (const b of bodies) ball(g, b);
    cage(g, true);
    g.strokeStyle = 'rgba(232,196,120,.7)'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(CX, CY, R, R * 0.22, 0, 0, Math.PI); g.stroke();
    // glass reflections
    const shine = g.createLinearGradient(CX - R, CY - R, CX - R * 0.2, CY);
    shine.addColorStop(0, 'rgba(255,255,255,.5)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
    g.strokeStyle = shine; g.lineWidth = 12; g.lineCap = 'round';
    g.beginPath(); g.arc(CX, CY, R - 16, Math.PI * 1.1, Math.PI * 1.4); g.stroke();
    const glow = g.createRadialGradient(CX + R * 0.4, CY + R * 0.55, 2, CX + R * 0.4, CY + R * 0.55, R * 0.5);
    glow.addColorStop(0, 'rgba(255,255,255,.12)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(CX, CY, R, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.6)';
    g.beginPath(); g.ellipse(CX + R * 0.5, CY - R * 0.55, 8, 3.5, -0.7, 0, 7); g.fill();
    // the brass frame ring around the glass, with rivets
    g.strokeStyle = brassV; g.lineWidth = 7;
    g.beginPath(); g.arc(CX, CY, R + 3, 0, 7); g.stroke();
    g.fillStyle = '#fbe7ae';
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; g.beginPath(); g.arc(CX + Math.cos(a) * (R + 3), CY + Math.sin(a) * (R + 3), 1.4, 0, 7); g.fill(); }
    // axle hubs on both sides
    for (const sx of [-1, 1]) {
      const hub = g.createRadialGradient(CX + sx * (R + 14) - 3, CY - 3, 1, CX + sx * (R + 14), CY, 11);
      hub.addColorStop(0, '#fff1c4'); hub.addColorStop(0.5, '#d4a24a'); hub.addColorStop(1, '#5a3a10');
      g.fillStyle = hub; g.beginPath(); g.arc(CX + sx * (R + 14), CY, 11, 0, 7); g.fill();
    }
  }

  onMount(() => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    const g = canvas.getContext('2d')!;
    g.scale(dpr, dpr);
    brass = g.createLinearGradient(CX - R, 0, CX + R, 0);
    brass.addColorStop(0, '#6e4a17'); brass.addColorStop(0.3, '#f3d48a'); brass.addColorStop(0.55, '#c9973f'); brass.addColorStop(1, '#5a3a10');
    brassV = g.createLinearGradient(0, CY - R, 0, CY + R + 60);
    brassV.addColorStop(0, '#f6dc98'); brassV.addColorStop(0.45, '#a87a2c'); brassV.addColorStop(0.7, '#f0cf82'); brassV.addColorStop(1, '#6e4a17');
    sync();
    for (let i = 0; i < 400 && !asleep; i++) step(1 / 60); // start with the balls at rest
    let raf = 0, last = performance.now();
    const loop = (t: number) => {
      step(Math.min(0.033, (t - last) / 1000));
      last = t;
      draw(g);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });
</script>

<canvas bind:this={canvas} class="drum" aria-hidden="true"></canvas>

<style>
  .drum { width: min(100%, 320px); aspect-ratio: 320 / 370; display: block; filter: drop-shadow(0 24px 30px rgba(0,0,0,.45)); }
</style>
