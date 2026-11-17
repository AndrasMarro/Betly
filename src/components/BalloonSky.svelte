<script lang="ts">
  // The sky behind Balloon, drawn on a canvas so everything moves smoothly: a day and night cycle with sun, moon,
  // stars and rare shooting stars, drifting clouds, the Matterhorn, a mountain bunker that now and then opens fire,
  // hills and a meadow, and rare easter eggs far away (a tiny jet or roadster from Rocket, birds, a hot-air balloon,
  // a fighter dropping paratroopers). Balloons the player cashed out float up in the distance a little later.
  import { onMount } from 'svelte';
  import jetSrc from '../assets/space/force.webp';
  import teslaSrc from '../assets/space/tesla.webp';
  // aim: where a pumped balloon is (asked when the bunker fires); onhit: the bunker hit that balloon
  // oncontrol: the secret bunker control (tap the bunker 5 times) was switched on or off
  // targets: the pumped balloons (for the player's own shells); onhit: a balloon was hit, mine = by the player
  type Spot = { id: number; x: number; y: number; r: number };
  let { launch, aim, targets, onhit, oncontrol }: { launch?: { id: number; color: string }; aim?: () => Spot | null; targets?: () => Spot[]; onhit?: (id: number, mine: boolean) => void; oncontrol?: (on: boolean) => void } = $props();
  // set up in onMount, called by the page: tap (true if the sky used the tap), point (aiming), hold (rapid fire), exit (leave control)
  let api = { tap: (_x: number, _y: number) => false, point: (_x: number, _y: number) => {}, hold: (_on: boolean) => {}, exit: () => {} };
  export const tap = (x: number, y: number) => api.tap(x, y);
  export const point = (x: number, y: number) => api.point(x, y);
  export const hold = (on: boolean) => api.hold(on);
  export const exit = () => api.exit();

  let canvas: HTMLCanvasElement;
  type Cloud = { x: number; y: number; s: number; v: number; seed: number };
  type Egg = { kind: 'jet' | 'tesla' | 'birds' | 'hot' | 'fighter'; x: number; y: number; dir: number; v: number; t: number; drop?: number; hit?: number; dead?: boolean[] };
  type Trooper = { x: number; y: number; vy: number; t: number; open: boolean; c: string; cut?: boolean };
  type Bg = { x: number; y: number; color: string; s: number; t: number; drift: number };
  type Star = { x: number; y: number; r: number; tw: number };
  const bgs: Bg[] = [];
  let pending: { at: number; color: string }[] = [];
  let clock = 0;
  $effect(() => { if (launch) pending.push({ at: clock + 2.5 + Math.random() * 2, color: launch.color }); });

  // colour helpers
  const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a: number[], b: number[], k: number) => a.map((x, i) => Math.round(x + (b[i] - x) * k));
  const rgb = (c: number[], a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const SKY = { dayT: hex('#4f9fe8'), dayB: hex('#d6edff'), nightT: hex('#060b1e'), nightB: hex('#1b2a50'), duskT: hex('#3c3f7c'), duskB: hex('#ff9a62') };
  const NIGHT = hex('#0b1626');

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const jet = new Image(); jet.src = jetSrc;
    const tesla = new Image(); tesla.src = teslaSrc;
    let W = 0, H = 0, dpr = 1, raf = 0, last = performance.now();
    let clouds: Cloud[] = [], stars: Star[] = [], blades: { x: number; h: number; lean: number; c: number }[] = [], flowers: { x: number; y: number; c: string }[] = [];
    let egg: Egg | null = null, nextEgg = 25 + Math.random() * 30;
    const troopers: Trooper[] = [];
    let shoot: { x: number; y: number; vx: number; vy: number; t: number } | null = null, nextShoot = 8;
    // bunker: closed, opening, firing, closing; the shell flies up and bursts
    let bunker = { state: 0, t: 0, next: 30 + Math.random() * 25 };
    // shells in flight: aimed at a balloon (target), fired by the player (mine) or just into the sky
    type Shell = { x: number; y: number; vx: number; vy: number; t: number; burst: number; T: number; target?: number; mine?: boolean; big?: boolean };
    let shells: Shell[] = [];
    const smoke: { x: number; y: number; t: number }[] = [];
    let gun = -0.75, gunTo = -0.75, flash = 0, controlling = false, taps: number[] = [], cool = 0, holding = false;
    const aimPt = { x: 0, y: 0 };
    const falls: { x: number; y: number; vx: number; vy: number; t: number }[] = []; // birds that were shot
    const BIRDS = [[0, 0], [-10, -5], [-20, 3], [-30, -7], [-40, 5]];
    const eggY = (e: Egg) => e.y + Math.sin(e.t * 0.7) * (e.kind === 'birds' ? 6 : 1.5);
    const bpos = { x: 0, y: 0 };
    const G = 60; // gravity on the shells
    const shoot_ = (x: number, y: number) => { gunTo = Math.atan2(y - bpos.y, x - bpos.x); fire(x, y, Math.max(0.35, Math.hypot(x - bpos.x, y - bpos.y) / 520), { mine: true }); };
    function fire(tx: number, ty: number, T: number, extra: Partial<Shell> = {}) {
      const x = bpos.x + Math.cos(gunTo) * 12, y = bpos.y + Math.sin(gunTo) * 12;
      const sh: Shell = { x, y, vx: (tx - x) / T, vy: (ty - y) / T - (G / 2) * T, t: 0, burst: 0, T, ...extra };
      gunTo = Math.atan2(sh.vy, sh.vx); flash = 0.15;
      shells.push(sh);
    }
    // the mountains, made once per size: a far jagged ridge and a row of snowy peaks in front of it
    let FAR: [number, number][] = [], PEAKS: { x: number; w: number; h: number; l: [number, number][]; r: [number, number][]; snow: number }[] = [];

    function fit() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(2, devicePixelRatio || 1);
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      clouds = Array.from({ length: 7 }, (_, i) => ({ x: Math.random() * W, y: H * (0.06 + 0.42 * Math.random()), s: 0.45 + (i % 3) * 0.3, v: 0, seed: Math.random() * 100 }))
        .map((c) => ({ ...c, v: 4 + c.s * 7 })).sort((a, b) => a.s - b.s);
      stars = Array.from({ length: Math.round(W * H / 3500) }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.62, r: Math.random() * 1.2 + 0.3, tw: Math.random() * 6 }));
      blades = Array.from({ length: Math.round(W / 1.6) }, () => ({ x: Math.random() * W, h: 10 + Math.random() * 18, lean: Math.random() * 8 - 4, c: Math.floor(Math.random() * 3) })).sort((a, b) => b.h - a.h);
      const y0 = H * 0.74;
      FAR = []; for (let x = -20, up = true; x < W + 60; x += 25 + Math.random() * 45, up = !up) FAR.push([x, y0 - H * (up ? 0.14 + Math.random() * 0.1 : 0.06 + Math.random() * 0.05)]);
      PEAKS = [[0.04, 0.1, 0.17], [0.36, 0.1, 0.2], [0.5, 0.12, 0.25], [0.6, 0.08, 0.16], [0.9, 0.11, 0.22], [1.0, 0.09, 0.15]].map(([fx, fw, fh]) => {
        const x = W * fx, w = W * fw * (0.85 + Math.random() * 0.3), h = H * fh * (0.85 + Math.random() * 0.3);
        const jag = (k: number) => (Math.random() - 0.5) * w * 0.12 * k;
        return { x, w, h, snow: 0.55 + Math.random() * 0.15,
          l: [0.25, 0.5, 0.75].map((f) => [x - w * (1 - f) + jag(1), y0 - h * f + jag(0.8)] as [number, number]),
          r: [0.75, 0.5, 0.25].map((f) => [x + w * (1 - f) + jag(1), y0 - h * f + jag(0.8)] as [number, number]) };
      }).sort((a, b) => b.h - a.h);
      flowers = Array.from({ length: Math.round(W / 45) }, () => ({ x: Math.random() * W, y: H - 4 - Math.random() * 18, c: ['#fff', '#ffd84a', '#ff8fb8', '#b98cff'][Math.floor(Math.random() * 4)] }));
    }
    fit();
    const ro = new ResizeObserver(fit); ro.observe(canvas);

    // ---------- the land ----------
    const horizon = () => H * 0.74;
    const ridge = (x: number, amp: number, f: number, ph: number) => Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.3 + ph * 1.7) * amp * 0.4;
    // where the slope from a to b reaches the bottom edge, so the flanks run on into the ground instead of dropping straight down
    const foot = (a: [number, number], b: [number, number]): [number, number] => [b[0] + ((b[0] - a[0]) / (b[1] - a[1])) * (H - b[1]), H];
    function mountains(light: number, haze: number[]) {
      const y0 = horizon();
      const dark = (c: number[], k: number) => mix(c, NIGHT, (1 - light) * k);
      // far ridge in the haze, down to the ground so nothing floats
      ctx.fillStyle = rgb(dark(mix(hex('#a9c0dc'), haze, 0.45), 0.75));
      ctx.beginPath(); ctx.moveTo(-20, H); FAR.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.lineTo(W + 60, H); ctx.fill();
      // a row of snowy peaks
      const rock = dark(mix(hex('#8794a8'), haze, 0.3), 0.72), shade = mix(rock, NIGHT, 0.3), snow = dark(hex('#f4f7fb'), 0.6);
      for (const p of PEAKS) {
        const top: [number, number] = [p.x, y0 - p.h], L: [number, number] = [p.x - p.w, y0], R: [number, number] = [p.x + p.w, y0];
        const poly: [number, number][] = [foot(p.l[0], L), L, ...p.l, top, ...p.r, R, foot(p.r[2], R)];
        const trace = () => { ctx.beginPath(); poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); };
        ctx.fillStyle = rgb(rock); trace(); ctx.fill();
        ctx.save(); trace(); ctx.clip();
        ctx.fillStyle = rgb(shade); ctx.beginPath(); ctx.moveTo(...top); ctx.lineTo(p.x + p.w * 0.25, H); ctx.lineTo(p.x + p.w * 9, H); ctx.lineTo(p.x + p.w * 9, 0); ctx.fill();
        const sy = y0 - p.h * p.snow;
        ctx.fillStyle = rgb(snow); ctx.beginPath(); ctx.moveTo(p.x - p.w, 0); ctx.lineTo(p.x - p.w, sy);
        for (let k = -4; k <= 4; k++) ctx.lineTo(p.x + (k / 4) * p.w * 0.6, sy + (k % 2 ? p.h * 0.08 : -p.h * 0.02));
        ctx.lineTo(p.x + p.w, sy); ctx.lineTo(p.x + p.w, 0); ctx.fill();
        ctx.restore();
      }
      // the Matterhorn: steep pyramid, summit leaning east with its little hook, snow above the shoulder
      const mx = W * 0.72, mw = Math.min(W * 0.14, 160), mh = Math.min(H * 0.46, mw * 2.1), base = y0 + 4;
      const P: [number, number][] = [[-2.27, -1], [-1, 0], [-0.62, 0.3], [-0.38, 0.5], [-0.2, 0.74], [-0.07, 0.92], [0.04, 1], [0.12, 0.985], [0.17, 0.95], [0.22, 0.955], [0.3, 0.84], [0.46, 0.6], [0.66, 0.36], [1, 0], [1.94, -1]];
      const pt = ([u, v]: [number, number]): [number, number] => [mx + u * mw, base - v * mh];
      const mrock = dark(mix(hex('#7d8aa0'), haze, 0.2), 0.7);
      const outline = () => { ctx.beginPath(); P.forEach((q, i) => (i ? ctx.lineTo(...pt(q)) : ctx.moveTo(...pt(q)))); };
      ctx.fillStyle = rgb(mrock); outline(); ctx.fill();
      ctx.save(); outline(); ctx.clip();
      ctx.fillStyle = rgb(mix(mrock, NIGHT, 0.35));
      ctx.beginPath(); ctx.moveTo(...pt([0.04, 1])); ctx.lineTo(...pt([0.15, -1])); ctx.lineTo(...pt([2.2, -1])); ctx.lineTo(...pt([2.2, 1.2])); ctx.fill();
      ctx.fillStyle = rgb(snow);
      ctx.beginPath(); ctx.moveTo(...pt([-0.5, 0.42])); ctx.lineTo(...pt([-0.3, 0.6])); ctx.lineTo(...pt([-0.18, 0.55])); ctx.lineTo(...pt([-0.05, 0.7])); ctx.lineTo(...pt([0.1, 0.62]));
      ctx.lineTo(...pt([0.25, 0.7])); ctx.lineTo(...pt([0.42, 0.5])); ctx.lineTo(...pt([0.6, 0.38])); ctx.lineTo(...pt([0.6, 1.1])); ctx.lineTo(...pt([-0.5, 1.1])); ctx.fill();
      ctx.fillStyle = rgb(mix(snow, hex('#9fb0c8'), 0.35));
      ctx.beginPath(); ctx.moveTo(...pt([0.04, 1])); ctx.lineTo(...pt([0.6, 0.38])); ctx.lineTo(...pt([0.42, 0.5])); ctx.lineTo(...pt([0.25, 0.7])); ctx.lineTo(...pt([0.15, 0.62])); ctx.fill();
      ctx.restore();
      // the bunker mountain on the left, lower than the peaks, with a little snow; the bunker sits on its lit face
      const bx = W * 0.2, bw = Math.min(W * 0.16, 190), bh = H * 0.12;
      const bm = dark(mix(hex('#7a857f'), haze, 0.18), 0.72);
      const sx = bx - bw * 0.05, sy = base - bh; // summit
      ctx.fillStyle = rgb(bm);
      const bl = foot([bx - bw * 0.6, base - bh * 0.42], [bx - bw, base]), br = foot([bx + bw * 0.66, base - bh * 0.3], [bx + bw, base]);
      ctx.beginPath(); ctx.moveTo(...bl); ctx.lineTo(bx - bw, base); ctx.lineTo(bx - bw * 0.6, base - bh * 0.42); ctx.lineTo(bx - bw * 0.36, base - bh * 0.7); ctx.lineTo(bx - bw * 0.2, base - bh * 0.84); ctx.lineTo(sx, sy);
      ctx.lineTo(bx + bw * 0.14, base - bh * 0.86); ctx.lineTo(bx + bw * 0.4, base - bh * 0.55); ctx.lineTo(bx + bw * 0.66, base - bh * 0.3); ctx.lineTo(bx + bw, base); ctx.lineTo(...br); ctx.fill();
      ctx.fillStyle = rgb(mix(bm, NIGHT, 0.3));
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(bx + bw * 0.14, base - bh * 0.86); ctx.lineTo(bx + bw * 0.4, base - bh * 0.55); ctx.lineTo(bx + bw * 0.66, base - bh * 0.3); ctx.lineTo(bx + bw, base); ctx.lineTo(...br); ctx.lineTo(bx + bw * 0.15, H); ctx.fill();
      ctx.fillStyle = rgb(snow);
      ctx.beginPath(); ctx.moveTo(bx - bw * 0.2, base - bh * 0.84); ctx.lineTo(sx, sy); ctx.lineTo(bx + bw * 0.14, base - bh * 0.86); ctx.lineTo(bx + bw * 0.08, base - bh * 0.78);
      ctx.lineTo(bx + bw * 0.0, base - bh * 0.84); ctx.lineTo(bx - bw * 0.07, base - bh * 0.74); ctx.lineTo(bx - bw * 0.14, base - bh * 0.8); ctx.fill();
      bpos.x = bx - bw * 0.42; bpos.y = base - bh * 0.42;
      drawBunker(bpos.x, bpos.y, light, bm);
    }

    function drawBunker(x: number, y: number, light: number, rockCol: number[]) {
      // camouflaged: a low concrete lip in the rock's colour, the doors barely darker
      const w = 18, h = 8, open = controlling ? 1 : bunker.state === 1 ? bunker.t : bunker.state === 2 ? 1 : bunker.state === 3 ? 1 - bunker.t : 0;
      ctx.fillStyle = rgb(mix(rockCol, hex('#9a9c98'), 0.12)); ctx.beginPath(); ctx.roundRect(x - w / 2 - 2, y - h / 2 - 2, w + 4, h + 4, 2); ctx.fill();
      ctx.fillStyle = 'rgba(12,14,16,.85)'; ctx.fillRect(x - w / 2, y - h / 2, w, h);
      if (open > 0) {
        ctx.save(); ctx.translate(x, y + 1); ctx.rotate(gun);
        ctx.fillStyle = '#3c4148'; ctx.fillRect(-2, -1.6, 3 + 10 * open, 3.2);
        ctx.restore();
        if (flash > 0) {
          const fx = x + Math.cos(gun) * 13, fy = y + Math.sin(gun) * 13, g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 11);
          g.addColorStop(0, 'rgba(255,240,180,.95)'); g.addColorStop(1, 'rgba(255,140,40,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy, 11, 0, 7); ctx.fill();
        }
      }
      ctx.fillStyle = rgb(mix(rockCol, hex('#3a3f3c'), 0.16));
      ctx.fillRect(x - w / 2, y - h / 2, (w / 2) * (1 - open), h);
      ctx.fillRect(x + (w / 2) * open, y - h / 2, (w / 2) * (1 - open), h);
      if (light < 0.4) { ctx.fillStyle = 'rgba(255,80,60,.7)'; ctx.beginPath(); ctx.arc(x + w / 2 + 1, y - h / 2 - 1, 1.1, 0, 7); ctx.fill(); }
    }

    function hills(light: number) {
      const y0 = horizon();
      const layer = (c: string, base: number, amp: number, f: number, ph: number, dark: number) => {
        ctx.fillStyle = rgb(mix(hex(c), NIGHT, (1 - light) * dark));
        ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 6) ctx.lineTo(x, base + ridge(x, amp, f, ph));
        ctx.lineTo(W, H); ctx.fill();
      };
      layer('#86bd7c', y0 + H * 0.02, H * 0.025, 0.006, 2, 0.75);
      layer('#68ab5f', y0 + H * 0.1, H * 0.018, 0.009, 4, 0.78);
      layer('#549a4c', H - 22, 4, 0.02, 1, 0.8);
      // grass: soft curved blades in three greens, swaying a little
      const greens = ['#3f8a3b', '#4d9b45', '#5fae52'].map((c) => rgb(mix(hex(c), NIGHT, (1 - light) * 0.8)));
      ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      for (const b of blades) {
        const sway = Math.sin(clock * 1.6 + b.x * 0.05) * 1.6;
        ctx.strokeStyle = greens[b.c];
        ctx.beginPath(); ctx.moveTo(b.x, H); ctx.quadraticCurveTo(b.x + b.lean * 0.3, H - b.h * 0.6, b.x + b.lean + sway, H - b.h); ctx.stroke();
      }
      for (const f of flowers) { ctx.fillStyle = f.c; ctx.globalAlpha = 0.35 + light * 0.65; ctx.beginPath(); ctx.arc(f.x, f.y, 1.8, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
    }

    // ---------- the sky ----------
    function cloud(c: Cloud, tint: number[], a: number) {
      // one soft shape: puffs on a flat rounded base, lit from above
      const s = c.s * Math.min(1.3, W / 700), x = c.x, y = c.y;
      const g = ctx.createLinearGradient(0, y - 40 * s, 0, y + 22 * s);
      g.addColorStop(0, rgb(tint, a)); g.addColorStop(0.6, rgb(tint, a)); g.addColorStop(1, rgb(mix(tint, hex('#7f97b8'), 0.3), a));
      ctx.fillStyle = g;
      ctx.beginPath();
      for (const [dx, dy, r] of [[-14, 8, 14], [4, -2, 20], [28, -14, 26], [58, -8, 22], [80, 4, 16], [96, 10, 11]] as const) { ctx.moveTo(x + (dx + r) * s, y + dy * s); ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); }
      ctx.roundRect(x - 26 * s, y + 4 * s, 132 * s, 18 * s, 9 * s);
      ctx.fill();
    }

    function balloonAt(x: number, y: number, s: number, color: string) {
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(x, y + s * 1.1); ctx.quadraticCurveTo(x - s * 0.3, y + s * 1.8, x, y + s * 2.6); ctx.stroke();
      ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, s * 0.82, s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(x - s * 0.3, y - s * 0.35, s * 0.18, s * 0.3, -0.4, 0, 7); ctx.fill();
    }

    function hotAir(x: number, y: number) {
      ctx.fillStyle = '#f2b01e'; ctx.beginPath(); ctx.ellipse(x, y, 9, 11, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#e5484d'; ctx.beginPath(); ctx.ellipse(x, y, 4, 11, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(x - 4, y + 9); ctx.lineTo(x - 2, y + 15); ctx.moveTo(x + 4, y + 9); ctx.lineTo(x + 2, y + 15); ctx.stroke();
      ctx.fillStyle = '#8a5a2b'; ctx.fillRect(x - 2.5, y + 15, 5, 3.5);
    }

    // a four-engine transport plane with a high wing, the rear ramp open for the jump
    function fighter(x: number, y: number, dir: number) {
      ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
      const body = '#5d6a5a', dark = '#3e483d';
      ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(-18, -2); ctx.lineTo(-24, -13); ctx.lineTo(-19, -13); ctx.lineTo(-11, -3); ctx.fill(); // tail fin
      ctx.fillRect(-25, -4, 9, 2.2); // tailplane
      ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(22, 0); ctx.quadraticCurveTo(22, -5, 14, -5); ctx.lineTo(-14, -4); ctx.lineTo(-22, -2); ctx.lineTo(-16, 3.5); ctx.lineTo(14, 4); ctx.quadraticCurveTo(22, 4, 22, 0); ctx.fill();
      ctx.fillStyle = '#9fc4dd'; ctx.fillRect(16, -3.5, 3.5, 2); // cockpit
      ctx.fillStyle = 'rgba(20,24,20,.6)'; for (let k = -8; k < 12; k += 4) ctx.fillRect(k, -2, 1.6, 1.4); // windows
      ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(-16, 3.5); ctx.lineTo(-22, 6); ctx.lineTo(-13, 4); ctx.fill(); // open ramp
      ctx.fillStyle = body; ctx.fillRect(-4, -6.5, 14, 2); // wing (seen edge-on) with engines
      for (const ex of [-1, 7]) {
        ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(ex + 3, -4.5, 3, 1.6, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = `rgba(30,30,30,${0.35 + 0.25 * Math.sin(clock * 40 + ex)})`; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(ex + 6.2, -8); ctx.lineTo(ex + 6.2, -1); ctx.stroke(); // spinning propeller
      }
      ctx.restore();
    }

    function trooper(p: Trooper) {
      if (p.open && !p.cut) {
        ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y - 9, 6, Math.PI, 0); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(p.x - 2, p.y - 10, 2.5, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = 'rgba(40,40,40,.6)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(p.x - 6, p.y - 9); ctx.lineTo(p.x, p.y - 1); ctx.lineTo(p.x + 6, p.y - 9); ctx.stroke();
      }
      ctx.fillStyle = '#2f3a2c'; ctx.fillRect(p.x - 1, p.y - 2, 2, 4);
    }

    function spawnEgg() {
      const r = Math.random(), dir = Math.random() < 0.5 ? 1 : -1;
      const kind: Egg['kind'] = r < 0.05 ? 'tesla' : r < 0.32 ? 'jet' : r < 0.56 ? 'birds' : r < 0.78 ? 'hot' : 'fighter';
      if (kind === 'hot') egg = { kind, x: W * (0.15 + Math.random() * 0.7), y: horizon() + 6, dir, v: 3 + Math.random() * 3, t: 0 };
      else egg = { kind, x: dir > 0 ? -60 : W + 60, y: H * (kind === 'birds' ? 0.25 + Math.random() * 0.2 : 0.06 + Math.random() * 0.16), dir, v: kind === 'birds' ? 26 : kind === 'fighter' ? 80 : kind === 'jet' ? 46 : 30, t: 0, drop: W * (0.3 + Math.random() * 0.4), dead: [] };
    }

    function frame(now: number) {
      const dt = still ? 0 : Math.min(0.05, (now - last) / 1000); last = now;
      clock += dt;
      // day and night: a 6 minute cycle starting in the late morning, nights shorter than days
      const p = (clock / 360 + 0.18) % 1, e = Math.sin(p * Math.PI * 2);
      // the sun sets at e = -0.45, so days are long and the night lasts about a quarter of the cycle
      const el = (e + 0.45) / 1.45;
      const light = smooth(-0.22, 0.2, el), dusk = Math.exp(-((el / 0.12) ** 2));
      const top = mix(mix(SKY.nightT, SKY.dayT, light), SKY.duskT, dusk * 0.7), bot = mix(mix(SKY.nightB, SKY.dayB, light), SKY.duskB, dusk * 0.85);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, rgb(top)); g.addColorStop(0.75, rgb(bot)); g.addColorStop(1, rgb(bot));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // stars and shooting stars at night
      const night = 1 - smooth(0, 0.5, light);
      if (night > 0.02) {
        for (const s of stars) { ctx.fillStyle = `rgba(255,255,255,${night * (0.55 + 0.45 * Math.sin(clock * 2 + s.tw))})`; ctx.fillRect(s.x, s.y, s.r, s.r); }
        nextShoot -= dt;
        if (!shoot && nextShoot < 0 && night > 0.7) { shoot = { x: W * (0.2 + Math.random() * 0.7), y: H * (0.05 + Math.random() * 0.2), vx: -(260 + Math.random() * 200), vy: 120 + Math.random() * 80, t: 0 }; nextShoot = 18 + Math.random() * 40; }
      }
      if (shoot) {
        shoot.t += dt; shoot.x += shoot.vx * dt; shoot.y += shoot.vy * dt;
        const a = Math.max(0, 1 - shoot.t / 0.9), tail = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * 0.18, shoot.y - shoot.vy * 0.18);
        tail.addColorStop(0, `rgba(255,255,255,${a})`); tail.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = tail; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x - shoot.vx * 0.18, shoot.y - shoot.vy * 0.18); ctx.stroke();
        if (shoot.t > 0.9) shoot = null;
      }
      // sun by day, moon by night, both on an arc over the valley
      const arc = (q: number, h: number) => [W * (0.06 + 0.88 * q), horizon() - h * H * 0.7] as const;
      const up = (p + 0.074 + 1) % 1; // 0 at sunrise, 0.648 at sunset
      if (el > -0.06 && up < 0.66) {
        const [sx, sy] = arc(up / 0.648, el);
        const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 60);
        sg.addColorStop(0, rgb(mix(hex('#fffbe6'), hex('#ffb070'), dusk), 1)); sg.addColorStop(0.3, rgb(mix(hex('#fff2b0'), hex('#ff8a4a'), dusk), 0.9)); sg.addColorStop(0.42, 'rgba(255,230,160,.35)'); sg.addColorStop(1, 'rgba(255,230,160,0)');
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 60, 0, 7); ctx.fill();
      }
      if (el < 0.06 && up > 0.63) {
        const [mx, my] = arc((up - 0.648) / 0.352, Math.max(0, -el) * 2.2);
        // a crescent: the lit outer edge and the terminator as a half ellipse, with a soft glow
        const mg = ctx.createRadialGradient(mx, my, 6, mx, my, 40); mg.addColorStop(0, 'rgba(230,235,255,.22)'); mg.addColorStop(1, 'rgba(230,235,255,0)');
        ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, 40, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(244,242,228,.97)'; ctx.beginPath(); ctx.arc(mx, my, 13, -Math.PI / 2, Math.PI / 2, true); ctx.ellipse(mx, my, 6, 13, 0, Math.PI / 2, -Math.PI / 2, false); ctx.fill();
      }
      // clouds, tinted by the time of day
      const tint = mix(mix(hex('#3a4566'), hex('#ffffff'), light), hex('#ffc9a8'), dusk * 0.6);
      for (const c of clouds) {
        c.x += c.v * dt;
        if (c.x > W + 40) { c.x = -160 * c.s; c.y = H * (0.06 + 0.42 * Math.random()); }
        cloud(c, tint, (0.55 + c.s * 0.35) * (0.45 + 0.55 * light));
      }
      // easter eggs far away
      if (!still) { nextEgg -= dt; if (!egg && nextEgg < 0) { spawnEgg(); nextEgg = 45 + Math.random() * 60; } }
      if (egg) {
        egg.t += dt;
        if (egg.kind === 'hot') { egg.y -= egg.v * dt; egg.x += egg.dir * 2.2 * dt; hotAir(egg.x, egg.y + Math.sin(egg.t * 0.8) * 1.5); if (egg.y < -30) egg = null; }
        else {
          egg.x += egg.dir * egg.v * dt;
          if (egg.hit !== undefined) {
            // hit: it trails smoke and sinks away behind the mountains
            egg.hit += dt; egg.y += (10 + egg.hit * 14) * dt;
            if (Math.random() < dt * 30) smoke.push({ x: egg.x - egg.dir * 10, y: egg.y + 4, t: 0 });
            if (egg.y > horizon()) egg = null;
          }
        }
        if (egg && egg.kind !== 'hot') {
          const y = eggY(egg);
          if (egg.kind === 'jet' || egg.kind === 'tesla') {
            const img = egg.kind === 'jet' ? jet : tesla, w = egg.kind === 'jet' ? 26 : 20, h = w * (img.naturalHeight / img.naturalWidth || 0.4);
            // the pictures face left; the contrail starts at the engine, just above the picture's middle
            const tailX = egg.x - egg.dir * w * 0.5, tailY = y + h * (egg.kind === 'jet' ? 0.46 : 0.55);
            if (egg.kind === 'jet' && egg.hit === undefined) {
              const tg = ctx.createLinearGradient(tailX, 0, tailX - egg.dir * 150, 0);
              tg.addColorStop(0, `rgba(255,255,255,${0.75 * (0.3 + light * 0.7)})`); tg.addColorStop(1, 'rgba(255,255,255,0)');
              ctx.strokeStyle = tg; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(tailX - egg.dir * 150, tailY); ctx.stroke();
            }
            ctx.save(); ctx.globalAlpha = 0.85; ctx.translate(egg.x, y); ctx.scale(-egg.dir, 1); if (egg.hit !== undefined) ctx.rotate(-Math.min(0.5, egg.hit * 0.3)); ctx.drawImage(img, -w / 2, 0, w, h); ctx.restore();
          } else if (egg.kind === 'birds') {
            ctx.strokeStyle = rgb(mix(hex('#2c3e57'), hex('#0a0f1a'), 1 - light)); ctx.lineWidth = 1.3;
            for (const [k, [dx, dy]] of BIRDS.entries()) {
              if (egg.dead?.[k]) continue;
              const bx = egg.x - egg.dir * dx, by = y + dy, f = Math.sin(clock * 9 + dx) * 3;
              ctx.beginPath(); ctx.moveTo(bx - 5, by - f); ctx.quadraticCurveTo(bx - 2.5, by - 3, bx, by); ctx.quadraticCurveTo(bx + 2.5, by - 3, bx + 5, by - f); ctx.stroke();
            }
          } else if (egg.kind === 'fighter') {
            fighter(egg.x, y, egg.dir);
            if (egg.drop !== undefined && (egg.dir > 0 ? egg.x > egg.drop : egg.x < egg.drop)) {
              for (let k = 0; k < 4; k++) troopers.push({ x: egg.x - egg.dir * (k * 9 + 20), y: y + 5, vy: 30, t: -k * 0.25, open: false, c: k % 2 ? '#1f2124' : '#5a4430' });
              egg.drop = undefined;
            }
          }
          if (egg.x < -80 || egg.x > W + 80) egg = null;
        }
      }
      // smoke of a crashing plane and the shot birds stay behind the mountains
      for (let i = smoke.length - 1; i >= 0; i--) {
        const q = smoke[i]; q.t += dt; q.y -= 6 * dt;
        ctx.fillStyle = `rgba(90,90,95,${Math.max(0, 0.45 - q.t * 0.25)})`; ctx.beginPath(); ctx.arc(q.x, q.y, 2 + q.t * 5, 0, 7); ctx.fill();
        if (q.t > 1.8) smoke.splice(i, 1);
      }
      for (let i = falls.length - 1; i >= 0; i--) {
        const f = falls[i]; f.t += dt; f.vy += 90 * dt; f.x += f.vx * dt; f.y += f.vy * dt;
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.t * 7); ctx.strokeStyle = rgb(mix(hex('#2c3e57'), hex('#0a0f1a'), 1 - light)); ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(-4, -1); ctx.lineTo(0, 1); ctx.lineTo(4, -1); ctx.stroke(); ctx.restore();
        if (f.y > horizon()) falls.splice(i, 1);
      }
      mountains(light, bot);
      // the bunker: every 40 to 80 seconds the doors open, it fires once and closes again. Its target changes:
      // the transport plane or the jet if one is passing, very rarely a pumped balloon (a hit pays double),
      // otherwise somewhere into the sky
      if (!still && !controlling) {
        if (bunker.state === 0) { bunker.next -= dt; if (bunker.next < 0) bunker = { state: 1, t: 0, next: 0 }; }
        else {
          bunker.t += dt / (bunker.state === 2 ? 1.6 : 1.2);
          if (bunker.state === 2 && bunker.t > 0.25 && !bunker.next) {
            bunker.next = 1;
            const tg = Math.random() < 0.15 ? aim?.() : null;
            const plane = egg && (egg.kind === 'fighter' || egg.kind === 'jet') && egg.hit === undefined && egg.x > 0 && egg.x < W ? egg : null;
            if (tg) fire(tg.x, tg.y, 0.75, { target: tg.id });
            else if (plane && Math.random() < 0.6) fire(plane.x + plane.dir * plane.v * 1.1, plane.y + 4, 1.1);
            else { const a = -Math.PI * (0.15 + Math.random() * 0.7), d = H * (0.35 + Math.random() * 0.3); fire(bpos.x + Math.cos(a) * d * 1.4, bpos.y + Math.sin(a) * d, 0.8 + Math.random() * 0.3); }
          }
          if (bunker.t >= 1) bunker = bunker.state === 3 ? { state: 0, t: 0, next: 40 + Math.random() * 40 } : { state: bunker.state + 1, t: 0, next: 0 };
        }
      }
      // the barrel turns towards its next target, the muzzle flash fades
      gun += (gunTo - gun) * Math.min(1, dt * 10); flash = Math.max(0, flash - dt); cool = Math.max(0, cool - dt);
      // rapid fire while the button is held: faster, a little less accurate
      if (controlling && holding && cool <= 0 && aimPt.y < bpos.y) { shoot_(aimPt.x + (Math.random() - 0.5) * 14, aimPt.y + (Math.random() - 0.5) * 14); cool = 0.11; }
      const spots = shells.some((s) => s.mine && !s.burst) ? targets?.() ?? [] : [];
      for (let i = shells.length - 1; i >= 0; i--) {
        const sh = shells[i]; sh.t += dt;
        if (!sh.burst) {
          sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.vy += G * dt;
          ctx.strokeStyle = 'rgba(255,220,150,.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(sh.x - sh.vx * 0.04, sh.y - sh.vy * 0.04); ctx.stroke();
          // hits a plane or the roadster on the way
          if (egg && egg.hit === undefined && (egg.kind === 'fighter' || egg.kind === 'jet' || egg.kind === 'tesla') && Math.hypot(sh.x - egg.x, sh.y - egg.y - 4) < 16) {
            egg.hit = 0; sh.burst = 0.001;
            if (egg.kind === 'fighter' && egg.drop !== undefined) egg.drop = egg.x; // everyone bails out
          }
          // the hot-air balloon goes up in a fireball
          if (egg?.kind === 'hot' && Math.hypot(sh.x - egg.x, sh.y - egg.y - 2) < 13) { sh.burst = 0.001; sh.big = true; sh.x = egg.x; sh.y = egg.y; egg = null; }
          // birds: the one hit tumbles down
          if (egg?.kind === 'birds') {
            const ey = eggY(egg);
            BIRDS.forEach(([dx, dy], k) => {
              const bx = egg!.x - egg!.dir * dx, by = ey + dy;
              if (!egg!.dead![k] && Math.hypot(sh.x - bx, sh.y - by) < 8) { egg!.dead![k] = true; sh.burst = 0.001; falls.push({ x: bx, y: by, vx: egg!.dir * egg!.v * 0.5, vy: -20, t: 0 }); }
            });
            if (egg.dead!.every(Boolean) && egg.dead!.length === BIRDS.length) egg = null;
          }
          // paratroopers: the canopy is gone and he drops
          for (const p of troopers) if (!p.cut && p.t > 0 && Math.hypot(sh.x - p.x, sh.y - p.y + 5) < 9) { p.cut = true; sh.burst = 0.001; }
          // the player's own shells pop the balloons far away and also the pumped ones (those still pay out)
          if (sh.mine) {
            for (let k = bgs.length - 1; k >= 0; k--) if (Math.hypot(sh.x - bgs[k].x, sh.y - bgs[k].y) < bgs[k].s + 4) { bgs.splice(k, 1); sh.burst = 0.001; }
            for (const b of spots) if (!sh.burst && Math.hypot(sh.x - b.x, sh.y - b.y) < b.r) { sh.burst = 0.001; onhit?.(b.id, true); }
          }
          if (!sh.burst && sh.t > sh.T) { sh.burst = 0.001; if (sh.target !== undefined) onhit?.(sh.target, false); }
        } else {
          sh.burst += dt;
          const k = sh.burst / 1.4, rr = (6 + k * 26) * (sh.big ? 2.2 : 1);
          ctx.fillStyle = `rgba(255,200,120,${Math.max(0, 0.8 - k)})`; ctx.beginPath(); ctx.arc(sh.x, sh.y, rr * 0.5, 0, 7); ctx.fill();
          ctx.fillStyle = `rgba(150,150,150,${Math.max(0, 0.5 - k * 0.5)})`; ctx.beginPath(); ctx.arc(sh.x + 3, sh.y - 2, rr, 0, 7); ctx.fill();
          if (k >= 1) shells.splice(i, 1);
        }
      }
      // paratroopers drift down behind the hills
      for (let i = troopers.length - 1; i >= 0; i--) {
        const p = troopers[i]; p.t += dt;
        if (p.t < 0) continue;
        if (!p.open && p.t > 0.7) p.open = true;
        p.vy = p.open && !p.cut ? Math.max(14, p.vy - 60 * dt) : p.vy + 120 * dt;
        p.y += p.vy * dt; p.x += Math.sin(p.t * 1.3 + i) * 6 * dt;
        trooper(p);
        if (p.y > horizon() + H * 0.12) troopers.splice(i, 1);
      }
      // the player's balloons, now far away
      for (const q of pending) if (q.at <= clock) bgs.push({ x: W * (0.15 + Math.random() * 0.7), y: horizon() + 10, color: q.color, s: 5 + Math.random() * 3, t: 0, drift: (Math.random() - 0.5) * 10 });
      pending = pending.filter((q) => q.at > clock);
      for (let i = bgs.length - 1; i >= 0; i--) {
        const b = bgs[i]; b.t += dt; b.y -= (9 + b.s) * dt; b.x += (b.drift + Math.sin(b.t * 0.6) * 4) * dt;
        balloonAt(b.x, b.y, b.s, b.color);
        if (b.y < -30) bgs.splice(i, 1);
      }
      hills(light);
      raf = requestAnimationFrame(frame);
    }
    api = {
      tap(x, y) {
        if (controlling) {
          // aim and fire where the player tapped; the shells only burst in the sky
          if (cool <= 0 && y < bpos.y) { shoot_(x, y); cool = 0.3; }
          return true;
        }
        if (Math.hypot(x - bpos.x, y - bpos.y) > 22) return false;
        const now = performance.now();
        taps = [...taps.filter((t) => now - t < 3000), now];
        if (taps.length >= 5) { taps = []; controlling = true; oncontrol?.(true); }
        return true;
      },
      point(x, y) { aimPt.x = x; aimPt.y = y; if (controlling && y < bpos.y) gunTo = Math.max(-Math.PI + 0.1, Math.min(-0.1, Math.atan2(y - bpos.y, x - bpos.x))); },
      hold(on) { holding = on; },
      exit() { if (!controlling) return; controlling = false; bunker = { state: 3, t: 0, next: 0 }; oncontrol?.(false); },
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  });
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
</style>
