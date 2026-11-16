// Drawing for the horse race: a side-on TV view at golden hour. Parallax hills and grandstand, a mown turf
// track with rails and distance posts, and horses with a procedural gallop (legs, bobbing neck, flowing tail)
// carrying jockeys in racing silks. All in world metres; the camera picks which 34 m are on screen.
import { DIST, type Horse } from './horses.ts';

export const VIEW = 34; // metres across the screen
// coat: body, shade, mane/tail, legs (socks)
export const COATS = [
  ['#8a4b2a', '#5e2f18', '#1e130d', '#2a1a12'], // bay
  ['#b4612c', '#86431c', '#7a3613', '#b4612c'], // chestnut
  ['#2a2524', '#161312', '#0b0909', '#0b0909'], // black
  ['#b9b6b0', '#8f8b84', '#e8e4dc', '#6d6a64'], // grey
  ['#d7a95b', '#a97c35', '#f3e7c6', '#f3e7c6'], // palomino
  ['#5a321c', '#3a1f10', '#130b07', '#e9e3d6'], // dark bay, white socks
];
// silks: main, second
export const SILKS = [['#e5484d', '#ffffff'], ['#1f5fbf', '#f2c33a'], ['#2fbf71', '#ffffff'], ['#f2c33a', '#1c1c22'], ['#8e44ad', '#f39c12'], ['#ffffff', '#e5484d'], ['#ff7ab8', '#1f2c4f'], ['#e67e22', '#2c3e50']];

const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/**
 * One horse with jockey. (x, y) is the ground point under the girth in pixels, s pixels per metre,
 * stride the gallop phase in strides, run 0..1 how hard it gallops (0 = standing).
 */
export function drawHorse(ctx: CanvasRenderingContext2D, h: Horse, x: number, y: number, s: number, stride: number, run: number) {
  const [coat, shade, mane, sock] = COATS[h.coat];
  const [silk, silk2] = SILKS[h.silks];
  const P = 2 * Math.PI * stride;
  const bob = -0.07 * Math.abs(Math.sin(P)) * run;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // shadow on the turf, a little to the right (sun from the left)
  ctx.fillStyle = 'rgba(20,40,10,.32)';
  ctx.beginPath(); ctx.ellipse(0.15, 0, 1.25, 0.16, 0, 0, 7); ctx.fill();

  // one leg: pivot, upper/lower length, angles from vertical (+ = forward), width
  const leg = (px: number, py: number, a1: number, a2: number, l1: number, l2: number, col: string, foot: string) => {
    const kx = px + Math.sin(a1) * l1, ky = py + Math.cos(a1) * l1;
    const fx = kx + Math.sin(a2) * l2, fy = ky + Math.cos(a2) * l2;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = col; ctx.lineWidth = 0.2; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(kx, ky); ctx.stroke();
    ctx.lineWidth = 0.11; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.strokeStyle = foot; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.moveTo(fx, fy - 0.12); ctx.lineTo(fx + 0.03, fy); ctx.stroke();
    ctx.fillStyle = '#1a1310'; ctx.fillRect(fx - 0.06, fy - 0.02, 0.15, 0.06);
  };
  // gallop: each leg has its own phase in the stride (rotary gallop)
  const fore = (off: number, col: string, foot: string) => {
    const q = P + off * 2 * Math.PI, sw = Math.sin(q) * 0.62 * run, fold = Math.max(0, Math.cos(q)) * 1.5 * run;
    leg(0.58, -1.22 + bob, sw, sw - fold, 0.5, 0.62, col, foot);
  };
  const hind = (off: number, col: string, foot: string) => {
    const q = P + off * 2 * Math.PI, sw = Math.sin(q) * 0.55 * run - 0.08, fold = Math.max(0, -Math.cos(q)) * 1.1 * run + 0.25;
    leg(-0.66, -1.3 + bob, sw - 0.15, sw + fold, 0.58, 0.66, col, foot);
  };
  // far-side legs first, in the darker shade
  hind(0.12, shade, shade);
  fore(0.47, shade, shade);

  ctx.translate(0, bob);
  // tail, waving with the stride
  const tw = Math.sin(P * 1 + 1) * 0.12 * run;
  ctx.fillStyle = mane;
  ctx.beginPath(); ctx.moveTo(-0.95, -1.78);
  ctx.bezierCurveTo(-1.35, -1.85 + tw, -1.6, -1.55 + tw, -1.72, -1.22 + tw * 1.5);
  ctx.bezierCurveTo(-1.5, -1.38 + tw, -1.25, -1.55, -0.98, -1.55); ctx.closePath(); ctx.fill();

  // body: back, rump, belly, chest
  const g = ctx.createLinearGradient(0, -1.9, 0, -1.1);
  g.addColorStop(0, coat); g.addColorStop(1, shade);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0.5, -1.92);
  ctx.bezierCurveTo(0.1, -1.84, -0.45, -1.86, -0.8, -1.92);
  ctx.bezierCurveTo(-1.08, -1.92, -1.12, -1.42, -0.95, -1.2);
  ctx.bezierCurveTo(-0.7, -1.04, -0.3, -1.0, 0.3, -1.02);
  ctx.bezierCurveTo(0.76, -1.06, 0.98, -1.3, 0.94, -1.6);
  ctx.closePath(); ctx.fill();
  // neck and head, the neck stretching forward and down with the stride
  const nk = Math.sin(P + 0.8) * 0.06 * run;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0.42, -1.86);
  ctx.bezierCurveTo(0.7, -2.12, 0.95, -2.46 + nk, 1.16, -2.54 + nk);  // crest to poll
  ctx.bezierCurveTo(1.32, -2.62 + nk, 1.46, -2.5 + nk, 1.84, -2.1 + nk);  // forehead to nose
  ctx.bezierCurveTo(1.9, -2.02 + nk, 1.84, -1.9 + nk, 1.72, -1.92 + nk);  // muzzle
  ctx.bezierCurveTo(1.56, -1.96 + nk, 1.36, -1.98 + nk, 1.2, -2.06 + nk); // jaw
  ctx.bezierCurveTo(1.08, -1.98, 1.0, -1.75, 0.93, -1.5);             // throat to chest
  ctx.closePath(); ctx.fill();
  // ears, eye, nostril, a blaze on some
  ctx.fillStyle = shade;
  ctx.beginPath(); ctx.moveTo(1.1, -2.52 + nk); ctx.lineTo(1.08, -2.76 + nk); ctx.lineTo(1.22, -2.57 + nk); ctx.fill();
  ctx.fillStyle = '#120c09';
  ctx.beginPath(); ctx.arc(1.38, -2.38 + nk, 0.04, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(1.78, -2.04 + nk, 0.025, 0, 7); ctx.fill();
  if (h.n % 3 === 0) { ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(1.35, -2.48 + nk); ctx.lineTo(1.7, -2.15 + nk); ctx.stroke(); }
  // mane along the crest
  ctx.fillStyle = mane;
  ctx.beginPath(); ctx.moveTo(0.42, -1.88);
  for (let k = 0; k <= 6; k++) { const u = k / 6, mx = 0.42 + u * 0.74, my = -1.88 - u * 0.62 + nk * u; ctx.lineTo(mx - 0.1 - Math.sin(P + k) * 0.03 * run, my - 0.04); }
  ctx.lineTo(1.16, -2.48 + nk); ctx.bezierCurveTo(0.95, -2.36, 0.7, -2.06, 0.5, -1.84); ctx.fill();
  // bridle and reins
  ctx.strokeStyle = 'rgba(28,28,34,.85)'; ctx.lineWidth = 0.03;
  ctx.beginPath(); ctx.moveTo(1.22, -2.52 + nk); ctx.lineTo(1.3, -2.02 + nk); ctx.moveTo(1.58, -2.24 + nk); ctx.lineTo(1.62, -1.95 + nk); ctx.stroke();

  // saddle cloth with the number
  ctx.fillStyle = silk;
  ctx.fillRect(-0.12, -1.86, 0.62, 0.36);
  ctx.fillStyle = silk2;
  ctx.font = '700 0.26px Geist Variable, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(String(h.n), 0.19, -1.59);
  ctx.fillStyle = '#2a1d14'; ctx.fillRect(-0.02, -1.94, 0.42, 0.1); // saddle

  // jockey: crouched over the withers, rocking a little against the stride
  const jr = Math.sin(P + 2) * 0.04 * run;
  ctx.translate(jr, 0);
  ctx.strokeStyle = '#f4f1ea'; ctx.lineWidth = 0.13; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0.02, -2.0); ctx.lineTo(0.34, -1.86); ctx.lineTo(0.2, -1.6); ctx.stroke();  // breeches
  ctx.strokeStyle = '#1c1c22'; ctx.lineWidth = 0.1;
  ctx.beginPath(); ctx.moveTo(0.22, -1.66); ctx.lineTo(0.16, -1.52); ctx.stroke();                        // boot
  // torso in silks, with the pattern clipped onto it
  ctx.beginPath();
  ctx.moveTo(-0.04, -2.04); ctx.quadraticCurveTo(0.2, -2.36, 0.62, -2.3); ctx.lineTo(0.68, -2.12); ctx.quadraticCurveTo(0.3, -2.0, 0.08, -1.92); ctx.closePath();
  ctx.fillStyle = silk; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = silk2;
  if (h.pattern === 0) for (let k = -0.1; k < 0.8; k += 0.16) ctx.fillRect(k, -2.4, 0.07, 0.5);      // stripes
  else if (h.pattern === 1) { ctx.fillRect(-0.1, -2.24, 0.9, 0.08); ctx.fillRect(-0.1, -2.08, 0.9, 0.08); } // hoops
  else if (h.pattern === 2) { ctx.beginPath(); ctx.moveTo(0.1, -2.4); ctx.lineTo(0.28, -2.4); ctx.lineTo(0.5, -1.9); ctx.lineTo(0.32, -1.9); ctx.fill(); } // sash
  else if (h.pattern === 3) ctx.fillRect(0.3, -2.4, 0.5, 0.5);                                             // halves
  else for (const [sx, sy] of [[0.15, -2.12], [0.4, -2.2], [0.55, -2.08]]) { ctx.beginPath(); ctx.arc(sx, sy, 0.045, 0, 7); ctx.fill(); } // spots
  ctx.restore();
  // arm to the reins, head with cap
  ctx.strokeStyle = silk; ctx.lineWidth = 0.09;
  ctx.beginPath(); ctx.moveTo(0.55, -2.24); ctx.lineTo(0.84, -2.06); ctx.lineTo(1.02, -2.1); ctx.stroke();
  ctx.strokeStyle = '#1c1c22'; ctx.lineWidth = 0.02;
  ctx.beginPath(); ctx.moveTo(1.02, -2.1); ctx.lineTo(1.6, -2.0 + nk); ctx.stroke();
  ctx.fillStyle = '#e8c4a0'; ctx.beginPath(); ctx.arc(0.76, -2.36, 0.1, 0, 7); ctx.fill();
  ctx.fillStyle = silk2; ctx.beginPath(); ctx.arc(0.75, -2.39, 0.11, Math.PI, 0); ctx.fill();
  ctx.fillRect(0.75, -2.4, 0.17, 0.03);
  ctx.translate(-jr, -bob);

  // near-side legs on top
  hind(0, coat, sock);
  fore(0.58, coat, sock);
  ctx.restore();
}

export type Layout = { W: number; H: number; ppm: number; view: number; horizon: number; top: number; bottom: number; lane: (i: number) => { y: number; s: number } };
export function layout(W: number, H: number): Layout {
  // the picture height sets the zoom, so horses keep their size on narrow screens
  const ppm = Math.max(W / VIEW, H / 13), horizon = H * 0.3, top = H * 0.47, bottom = H * 0.93;
  return { W, H, ppm, view: W / ppm, horizon, top, bottom, lane: (i) => ({ y: top + (bottom - top) * (0.16 + (i / 5) * 0.72), s: ppm * (0.72 + 0.28 * (i / 5)) }) };
}

/** Everything behind the horses. cam: world x at the left edge, t: seconds (crowd and flags), live: race on. */
export function drawBackdrop(ctx: CanvasRenderingContext2D, L: Layout, cam: number, t: number, live: boolean) {
  const { W, H, ppm, horizon, top, bottom } = L;
  // sky at golden hour with a low sun
  const sky = ctx.createLinearGradient(0, 0, 0, horizon + 40);
  sky.addColorStop(0, '#2e4f86'); sky.addColorStop(0.55, '#e59a6a'); sky.addColorStop(1, '#f7d28e');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, horizon + 60);
  const sx = W * 0.78 - ((cam * ppm * 0.02) % (W * 1.5)), sg = ctx.createRadialGradient(sx, horizon - 8, 0, sx, horizon - 8, H * 0.4);
  sg.addColorStop(0, 'rgba(255,240,200,.95)'); sg.addColorStop(0.08, 'rgba(255,220,150,.8)'); sg.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W, horizon + 60);
  // hills in two layers
  for (const [par, col, amp, base] of [[0.06, '#7d6f8f', 0.07, 0.0], [0.14, '#55607a', 0.05, 0.04]] as const) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, horizon + 60);
    for (let x = 0; x <= W + 20; x += 16) {
      const wx = (x / ppm + cam * par) * 0.35;
      ctx.lineTo(x, horizon - H * base - H * amp * (0.6 + 0.4 * Math.sin(wx * 0.9) + 0.3 * Math.sin(wx * 2.3 + 1)));
    }
    ctx.lineTo(W, horizon + 60); ctx.fill();
  }
  // grandstand across the track (half parallax), crowd and flags
  const gp = 0.5, unit = 46, gTop = horizon - H * 0.02, gBot = top - H * 0.035;
  ctx.fillStyle = '#3a4a3a'; ctx.fillRect(0, gBot - 4, W, top - gBot + 8); // infield hedge
  const first = Math.floor((cam * gp - 4) / unit);
  for (let k = first; k < first + L.view / unit / gp + 3; k++) {
    const x0 = (k * unit - cam * gp) * ppm, w = (unit - 0.8) * ppm;
    ctx.fillStyle = '#e9e1d2'; ctx.fillRect(x0, gTop + 14, w, gBot - gTop - 14);
    // roof with a scalloped valance
    ctx.fillStyle = '#1f3557'; ctx.beginPath(); ctx.moveTo(x0 - 8, gTop + 16); ctx.lineTo(x0 + w * 0.08, gTop); ctx.lineTo(x0 + w * 0.92, gTop); ctx.lineTo(x0 + w + 8, gTop + 16); ctx.fill();
    ctx.fillStyle = '#f2f0ea'; for (let v = x0 - 6; v < x0 + w + 6; v += 12) { ctx.beginPath(); ctx.arc(v + 6, gTop + 16, 6, 0, Math.PI); ctx.fill(); }
    // crowd: rows of coloured dots that jump while the race is on
    const rows = 4, rh = (gBot - gTop - 30) / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < w / 7; c++) {
      const id = k * 997 + r * 131 + c, hu = hash(id);
      const jump = live ? Math.max(0, Math.sin(t * (6 + hu * 4) + id)) * 2.2 : 0;
      ctx.fillStyle = `hsl(${Math.floor(hu * 360)},${40 + hash(id + 1) * 40}%,${45 + hash(id + 2) * 25}%)`;
      ctx.beginPath(); ctx.arc(x0 + 5 + c * 7 + (r % 2) * 3, gTop + 30 + r * rh - jump, 2.6, 0, 7); ctx.fill();
    }
    // columns and flags
    ctx.fillStyle = '#cfc6b5'; for (let c = 0; c <= 4; c++) ctx.fillRect(x0 + (w - 4) * (c / 4), gTop + 16, 4, gBot - gTop - 16);
    for (const fx of [0.2, 0.5, 0.8]) {
      const px = x0 + w * fx, wave = Math.sin(t * 4 + k + fx * 10) * 3;
      ctx.fillStyle = '#d9d9d9'; ctx.fillRect(px, gTop - 22, 2, 22);
      ctx.fillStyle = ['#e5484d', '#f2c33a', '#2fbf71'][Math.floor(fx * 3)];
      ctx.beginPath(); ctx.moveTo(px + 2, gTop - 22); ctx.lineTo(px + 18, gTop - 18 + wave); ctx.lineTo(px + 2, gTop - 13); ctx.fill();
    }
  }
  // turf with mowing stripes, slanted for depth
  ctx.fillStyle = '#3f8a37'; ctx.fillRect(0, top, W, H - top);
  ctx.fillStyle = 'rgba(255,255,255,.06)';
  const stripe = 4, f0 = Math.floor(cam / stripe);
  for (let k = f0 - 1; k < f0 + L.view / stripe + 2; k += 2) {
    const x = (k * stripe - cam) * ppm;
    ctx.beginPath(); ctx.moveTo(x + 30, top); ctx.lineTo(x + 30 + stripe * ppm, top); ctx.lineTo(x + stripe * ppm, H); ctx.lineTo(x, H); ctx.fill();
  }
  // far rail
  rail(ctx, L, cam, top - 2, 0.72);
  // distance posts (metres to go) on the far rail and the finish line
  for (let d = 50; d < DIST; d += 50) {
    const x = (d - cam) * ppm;
    if (x < -40 || x > W + 40) continue;
    ctx.fillStyle = '#f4f4f4'; ctx.fillRect(x - 2, top - 40, 4, 38);
    ctx.fillStyle = '#1c1c22'; ctx.beginPath(); ctx.roundRect(x - 15, top - 54, 30, 18, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '700 11px Geist Mono Variable, monospace'; ctx.textAlign = 'center'; ctx.fillText(String(DIST - d), x, top - 41);
  }
  const fx = (DIST - cam) * ppm;
  if (fx > -60 && fx < W + 60) {
    // checkered line across the track (slanted like the stripes) and the winning post
    const sq = 9;
    for (let r = 0; r * sq < bottom - top + 20; r++) {
      const yy = top + r * sq, sl = 30 * (1 - (yy - top) / (H - top));
      for (let c = 0; c < 2; c++) { ctx.fillStyle = (r + c) % 2 ? '#111' : '#fafafa'; ctx.fillRect(fx + sl - 9 + c * sq, yy, sq, sq); }
    }
    ctx.fillStyle = '#fafafa'; ctx.fillRect(fx + 26, top - 90, 6, 90);
    ctx.fillStyle = '#e5484d'; ctx.beginPath(); ctx.arc(fx + 29, top - 96, 16, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(fx + 29, top - 96, 9, 0, 7); ctx.fill();
  }
  // starting gate, swung open after the start
  const gx = (-1.6 - cam) * ppm;
  if (gx > -8 * ppm && gx < W) {
    ctx.fillStyle = 'rgba(40,60,40,.25)'; ctx.fillRect(gx + 6, top + 6, 2.4 * ppm, bottom - top);
    ctx.fillStyle = '#2f7d4f'; ctx.fillRect(gx, top - 24, 2.2 * ppm, 16);
    ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(ppm * 0.42)}px Geist Variable, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('BETLY DERBY', gx + 1.1 * ppm, top - 12);
    for (let i = 0; i <= 6; i++) { const y = top + (bottom - top) * (0.06 + i * 0.145); ctx.fillStyle = '#2f7d4f'; ctx.fillRect(gx, y - 3, 2.2 * ppm, 6); }
    ctx.fillStyle = '#9aa0aa'; ctx.fillRect(gx, top - 10, 5, bottom - top + 10); ctx.fillRect(gx + 2.2 * ppm - 5, top - 10, 5, bottom - top + 10);
  }
}

function rail(ctx: CanvasRenderingContext2D, L: Layout, cam: number, y: number, k: number) {
  const { W, ppm } = L, gap = 2.5, f0 = Math.floor(cam / gap);
  ctx.fillStyle = '#f4f4f4';
  for (let i = f0; i < f0 + L.view / gap + 2; i++) { const x = (i * gap - cam) * ppm; ctx.fillRect(x, y - 26 * k, 4 * k, 26 * k); }
  ctx.fillRect(0, y - 28 * k, W, 6 * k);
  ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(0, y - 22 * k, W, 2 * k);
}

/** In front of the horses: the near rail, slightly blurred by depth. */
export function drawForeground(ctx: CanvasRenderingContext2D, L: Layout, cam: number) {
  ctx.fillStyle = '#356f2f'; ctx.fillRect(0, L.bottom + 8, L.W, L.H - L.bottom);
  rail(ctx, L, cam * 1.12, L.H - 2, 1.4);
}

/** Turf thrown up behind galloping hooves (procedural, no state). */
export function drawClods(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, stride: number, run: number) {
  if (run < 0.3) return;
  ctx.fillStyle = 'rgba(92,64,38,.75)';
  for (let k = 0; k < 4; k++) {
    const u = (stride * 2 + k * 0.25) % 1, dx = -(0.8 + u * 1.8) * s, dy = -Math.sin(u * Math.PI) * 0.5 * s;
    ctx.globalAlpha = (1 - u) * run;
    ctx.fillRect(x + dx - 0.6 * s, y + dy - 2, 0.07 * s + 1, 0.07 * s + 1);
  }
  ctx.globalAlpha = 1;
}
