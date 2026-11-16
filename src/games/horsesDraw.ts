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

export type Layout = { W: number; H: number; ppm: number; view: number; horizon: number; standTop: number; standBot: number; top: number; bottom: number; lane: (i: number) => { y: number; s: number } };
export function layout(W: number, H: number): Layout {
  // the picture height sets the zoom, so horses keep their size on narrow screens
  const ppm = Math.max(W / 40, H / 17), horizon = H * 0.2, standTop = H * 0.11, standBot = H * 0.5, top = H * 0.53, bottom = H * 0.95;
  return { W, H, ppm, view: W / ppm, horizon, standTop, standBot, top, bottom, lane: (i) => ({ y: top + (bottom - top) * (0.2 + (i / 5) * 0.7), s: ppm * (0.78 + 0.22 * (i / 5)) }) };
}

// ---------- sponsors: invented brands (plus Betly) for the boards and banners ----------
type Icon = 'mark' | 'chip' | 'peak' | 'clock' | 'plane' | 'cup' | 'bean';
type Ad = { bg: string; fg: string; txt: string; icon?: Icon };
export const SPONSORS: Ad[] = [
  { bg: '#121216', fg: '#ffffff', txt: 'BETLY', icon: 'mark' },
  { bg: '#c8102e', fg: '#ffffff', txt: 'ROTFUCHS RACING', icon: 'peak' },
  { bg: '#f2c33a', fg: '#1c1c22', txt: 'BETLY TOKENS', icon: 'chip' },
  { bg: '#1f2c4f', fg: '#f2c33a', txt: 'GIPFELZEIT', icon: 'clock' },
  { bg: '#ffffff', fg: '#e5484d', txt: 'DERBY' },
  { bg: '#1e88e5', fg: '#ffffff', txt: 'FÖHNWIND AIR', icon: 'plane' },
  { bg: '#f4ead5', fg: '#5a3a22', txt: 'KUHGLOCKE KAFFEE', icon: 'cup' },
  { bg: '#121216', fg: '#f2c33a', txt: 'BETLY · PLAY MONEY ONLY', icon: 'chip' },
  { bg: '#4b2a6b', fg: '#ffffff', txt: 'ALPENGLANZ', icon: 'bean' },
  { bg: '#c8102e', fg: '#ffffff', txt: 'ROTFUCHS', icon: 'peak' },
];

/** A small logo in a square of size z with its centre at (x, y). */
function icon(g: CanvasRenderingContext2D, k: Icon, x: number, y: number, z: number, fg: string) {
  const r = z / 2;
  g.save();
  if (k === 'mark') { // the Betly mark: red disc with a dark ring inside
    g.fillStyle = '#e5484d'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.strokeStyle = '#121216'; g.lineWidth = r * 0.2; g.beginPath(); g.arc(x, y, r * 0.58, 0, 7); g.stroke();
  } else if (k === 'chip') { // a Betly token: gold chip with edge marks and a B
    g.fillStyle = '#d99a1c'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.strokeStyle = '#fff6d8'; g.lineWidth = r * 0.22;
    for (let a = 0; a < 8; a++) { g.beginPath(); g.arc(x, y, r * 0.86, (a / 8) * Math.PI * 2, (a / 8) * Math.PI * 2 + 0.32); g.stroke(); }
    g.fillStyle = '#f2c33a'; g.beginPath(); g.arc(x, y, r * 0.62, 0, 7); g.fill();
    g.fillStyle = '#7a4f0a'; g.font = `900 ${Math.round(r * 0.95)}px Geist Variable, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('B', x, y + r * 0.05);
  } else if (k === 'peak') {
    g.fillStyle = fg; g.beginPath(); g.moveTo(x - r, y + r * 0.7); g.lineTo(x - r * 0.15, y - r * 0.75); g.lineTo(x + r * 0.25, y - r * 0.05); g.lineTo(x + r * 0.5, y - r * 0.4); g.lineTo(x + r, y + r * 0.7); g.fill();
  } else if (k === 'clock') {
    g.strokeStyle = fg; g.lineWidth = r * 0.16; g.lineCap = 'round'; g.beginPath(); g.arc(x, y, r * 0.85, 0, 7); g.moveTo(x, y); g.lineTo(x, y - r * 0.55); g.moveTo(x, y); g.lineTo(x + r * 0.4, y + r * 0.1); g.stroke();
  } else if (k === 'plane') {
    g.fillStyle = fg; g.beginPath(); g.moveTo(x + r, y); g.lineTo(x - r * 0.2, y - r * 0.2); g.lineTo(x - r * 0.5, y - r * 0.9); g.lineTo(x - r * 0.75, y - r * 0.9); g.lineTo(x - r * 0.55, y - r * 0.15); g.lineTo(x - r, y - r * 0.15); g.lineTo(x - r, y + r * 0.15); g.lineTo(x - r * 0.55, y + r * 0.15); g.lineTo(x - r * 0.75, y + r * 0.9); g.lineTo(x - r * 0.5, y + r * 0.9); g.lineTo(x - r * 0.2, y + r * 0.2); g.fill();
  } else if (k === 'cup') {
    g.fillStyle = fg; g.beginPath(); g.moveTo(x - r * 0.7, y - r * 0.2); g.lineTo(x + r * 0.5, y - r * 0.2); g.lineTo(x + r * 0.35, y + r * 0.7); g.lineTo(x - r * 0.55, y + r * 0.7); g.fill();
    g.strokeStyle = fg; g.lineWidth = r * 0.14; g.beginPath(); g.arc(x + r * 0.55, y + r * 0.15, r * 0.25, -1.4, 1.4); g.stroke();
    g.beginPath(); g.moveTo(x - r * 0.25, y - r * 0.4); g.quadraticCurveTo(x - r * 0.05, y - r * 0.7, x - r * 0.25, y - r); g.moveTo(x + r * 0.1, y - r * 0.4); g.quadraticCurveTo(x + r * 0.3, y - r * 0.7, x + r * 0.1, y - r); g.stroke();
  } else if (k === 'bean') {
    g.fillStyle = '#c99a62'; g.beginPath(); g.ellipse(x, y, r * 0.6, r * 0.85, 0.5, 0, 7); g.fill();
    g.strokeStyle = '#4b2a6b'; g.lineWidth = r * 0.12; g.beginPath(); g.moveTo(x - r * 0.3, y - r * 0.55); g.quadraticCurveTo(x + r * 0.15, y, x + r * 0.25, y + r * 0.6); g.stroke();
  }
  g.restore();
}

/** One advertising board: background, logo on the left, the name shrunk to fit. */
export function paintAd(g: CanvasRenderingContext2D, ad: Ad, x: number, y: number, w: number, h: number) {
  g.fillStyle = ad.bg; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, y, w, Math.max(1, h * 0.08));
  const z = h * 0.66, hasIcon = !!ad.icon, room = w * 0.86 - (hasIcon ? z * 1.25 : 0);
  let fs = Math.round(h * 0.5);
  g.font = `800 ${fs}px Geist Variable, sans-serif`;
  const tw = g.measureText(ad.txt).width;
  if (tw > room) { fs = Math.max(6, Math.floor((fs * room) / tw)); g.font = `800 ${fs}px Geist Variable, sans-serif`; }
  const total = Math.min(tw, room) + (hasIcon ? z * 1.25 : 0), x0 = x + (w - total) / 2;
  if (ad.icon) icon(g, ad.icon, x0 + z / 2, y + h / 2, z, ad.fg);
  g.fillStyle = ad.fg; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText(ad.txt, x0 + (hasIcon ? z * 1.25 : 0), y + h / 2 + 1);
}

// ---------- grandstand: drawn once per size into two tiles (crowd sitting / cheering), then only copied ----------
const STAND_M = 48; // tile length in metres (stand coordinates), repeats seamlessly
const SHIRTS = ['#e5484d', '#3d9bff', '#f2c33a', '#2fbf71', '#ffffff', '#1f2c4f', '#ff7ab8', '#e67e22', '#8e44ad', '#cfd8dc', '#c0392b', '#16a085'];
const SKIN = ['#f1c8a5', '#d9a07a', '#a86b45', '#7a4a2c', '#f6d8bd'];
let standCache: { key: string; tiles: HTMLCanvasElement[] } | null = null;
function standTiles(ppm: number, h: number) {
  const key = `${ppm.toFixed(2)}x${Math.round(h)}x${devicePixelRatio || 1}`;
  if (standCache?.key === key) return standCache.tiles;
  const dpr = devicePixelRatio || 1, w = Math.round(STAND_M * ppm);
  const tiles = [0, 1].map((frame) => {
    const c = document.createElement('canvas');
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    const roof = h * 0.12, front = h * 0.82;
    // back wall and roof
    g.fillStyle = '#d8cfbd'; g.fillRect(0, roof, w, front - roof);
    // tiers of seated fans, rows getting bigger towards the front
    const rows = 7, heights = Array.from({ length: rows }, (_, r) => 1 + r * 0.09), sum = heights.reduce((a, b) => a + b, 0);
    let y = roof + h * 0.04;
    heights.forEach((k, r) => {
      const rh = ((front - roof - h * 0.05) * k) / sum;
      g.fillStyle = r % 2 ? '#bdb3a0' : '#c7bda9'; g.fillRect(0, y, w, rh);
      g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, y + rh - 2, w, 2);
      const sp = rh * 0.62, n = Math.floor(w / sp);
      for (let i = 0; i < n; i++) {
        const id = r * 1009 + i, cx = (i + 0.5) * (w / n) + (r % 2 ? sp * 0.25 : 0) % sp;
        if (hash(id) < 0.08) { g.fillStyle = '#2f5f9e'; g.fillRect(cx - sp * 0.2, y + rh * 0.45, sp * 0.4, rh * 0.4); continue; } // empty seat
        const up = frame === 1 && hash(id + 7) < 0.45, lift = up ? rh * 0.12 : 0;
        const shirt = SHIRTS[Math.floor(hash(id + 1) * SHIRTS.length)], skin = SKIN[Math.floor(hash(id + 2) * SKIN.length)];
        const by = y + rh * 0.42 - lift;
        if (up) { g.strokeStyle = skin; g.lineWidth = Math.max(1.5, sp * 0.08); g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - sp * 0.16, by + rh * 0.1); g.lineTo(cx - sp * 0.3, by - rh * 0.28); g.moveTo(cx + sp * 0.16, by + rh * 0.1); g.lineTo(cx + sp * 0.3, by - rh * 0.28); g.stroke(); }
        g.fillStyle = shirt; g.beginPath(); g.roundRect(cx - sp * 0.22, by, sp * 0.44, rh * 0.58, sp * 0.14); g.fill();
        g.fillStyle = skin; g.beginPath(); g.arc(cx, by - rh * 0.13, rh * 0.17, 0, 7); g.fill();
        if (hash(id + 3) < 0.35) { g.fillStyle = hash(id + 4) < 0.5 ? '#2a1d14' : '#e3c27a'; g.beginPath(); g.arc(cx, by - rh * 0.17, rh * 0.17, Math.PI, 0); g.fill(); } // hair
        if (hash(id + 5) < 0.05) { // a flag waved by a fan
          const fx = cx + sp * 0.3, fy = by - rh * (up ? 0.75 : 0.55);
          g.fillStyle = '#7a5a3a'; g.fillRect(fx, fy, Math.max(1, sp * 0.05), rh * 0.7);
          g.fillStyle = SHIRTS[Math.floor(hash(id + 6) * 4)]; g.fillRect(fx, fy, sp * 0.55, rh * 0.32);
        }
      }
      y += rh;
    });
    // shade under the roof, roof slab and its lit edge
    const sh = g.createLinearGradient(0, roof, 0, roof + h * 0.32);
    sh.addColorStop(0, 'rgba(20,24,40,.5)'); sh.addColorStop(1, 'rgba(20,24,40,0)');
    g.fillStyle = sh; g.fillRect(0, roof, w, h * 0.32);
    g.fillStyle = '#2b3240'; g.fillRect(0, 0, w, roof);
    g.fillStyle = '#566178'; g.fillRect(0, roof - 3, w, 3);
    g.fillStyle = 'rgba(255,255,255,.12)'; for (let x = 0; x < w; x += ppm * 2) g.fillRect(x, 0, 1, roof - 3);
    // pillars and advertising boards along the front
    g.fillStyle = '#3a4150'; for (let m = 6; m < STAND_M; m += 12) g.fillRect(m * ppm, roof, Math.max(3, ppm * 0.14), front - roof);
    const aw = w / SPONSORS.length;
    SPONSORS.forEach((ad, i) => paintAd(g, ad, i * aw, front, aw - 2, h - front));
    // hanging banners from the roof, between the pillars
    for (let k = 0; k < STAND_M / 12; k++) {
      const m = 12 * k + 1.5; // clear of the tile edge and of the pillars
      const ad = SPONSORS[(k * 3) % SPONSORS.length], bw = Math.max(18, ppm * 1.5), bh = h * 0.42, bx = m * ppm - bw / 2;
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(bx + 3, roof + 3, bw, bh);
      g.fillStyle = ad.bg; g.fillRect(bx, roof, bw, bh);
      g.beginPath(); g.moveTo(bx, roof + bh); g.lineTo(bx + bw / 2, roof + bh + bw * 0.35); g.lineTo(bx + bw, roof + bh); g.fill(); // swallowtail point
      if (ad.icon) icon(g, ad.icon, bx + bw / 2, roof + bw * 0.6, bw * 0.62, ad.fg);
      g.save(); g.translate(bx + bw / 2, roof + bh * 0.62); g.rotate(-Math.PI / 2);
      let fs = Math.round(bw * 0.42); g.font = `800 ${fs}px Geist Variable, sans-serif`;
      const tw = g.measureText(ad.txt).width, room = bh * 0.62;
      if (tw > room) { fs = Math.max(6, Math.floor((fs * room) / tw)); g.font = `800 ${fs}px Geist Variable, sans-serif`; }
      g.fillStyle = ad.fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ad.txt, 0, 1);
      g.restore();
    }
    // evening light from the left
    const lt = g.createLinearGradient(0, 0, w, 0);
    lt.addColorStop(0, 'rgba(255,190,120,.12)'); lt.addColorStop(0.5, 'rgba(255,190,120,0)'); lt.addColorStop(1, 'rgba(255,190,120,.12)');
    g.fillStyle = lt; g.fillRect(0, 0, w, h);
    return c;
  });
  standCache = { key, tiles };
  return tiles;
}

/** Everything behind the horses. cam: world x at the left edge, t: seconds (crowd and flags), live: race on. */
export function drawBackdrop(ctx: CanvasRenderingContext2D, L: Layout, cam: number, t: number, live: boolean) {
  const { W, H, ppm, horizon, top, bottom, standTop, standBot } = L;
  // sky at golden hour with a low sun
  const sky = ctx.createLinearGradient(0, 0, 0, standBot);
  sky.addColorStop(0, '#2e4f86'); sky.addColorStop(0.45, '#e59a6a'); sky.addColorStop(0.8, '#f7d28e');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, standBot);
  const sx = W * 0.8 - ((cam * ppm * 0.02) % (W * 1.5)), sg = ctx.createRadialGradient(sx, horizon - 4, 0, sx, horizon - 4, H * 0.3);
  sg.addColorStop(0, 'rgba(255,240,200,.95)'); sg.addColorStop(0.1, 'rgba(255,220,150,.75)'); sg.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W, standBot);
  // hills in two layers
  for (const [par, col, amp, base] of [[0.04, '#8a7a96', 0.06, 0.02], [0.1, '#5d6782', 0.045, 0.0]] as const) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, standBot);
    for (let x = 0; x <= W + 20; x += 16) {
      const wx = (x / ppm + cam * par) * 0.35;
      ctx.lineTo(x, horizon - H * base - H * amp * (0.6 + 0.4 * Math.sin(wx * 0.9) + 0.3 * Math.sin(wx * 2.3 + 1)));
    }
    ctx.lineTo(W, standBot); ctx.fill();
  }
  // grandstand (half parallax): two pre-drawn tiles, the cheering one alternates in while the race is on
  const gp = 0.5, tiles = standTiles(ppm, standBot - standTop), tw = STAND_M * ppm;
  const tile = tiles[live && Math.floor(t * 3.2) % 2 ? 1 : 0];
  const off = ((cam * gp * ppm) % tw + tw) % tw;
  for (let x = -off; x < W; x += tw) ctx.drawImage(tile, x, standTop, tw, standBot - standTop);
  // flags on the roof
  for (let m = Math.floor((cam * gp) / 12) * 12; (m - cam * gp) * ppm < W + 20; m += 12) {
    const px = (m - cam * gp) * ppm + 6 * ppm, wave = Math.sin(t * 4 + m) * 3;
    if (px < -30 || px > W + 30) continue;
    ctx.fillStyle = '#d9d9d9'; ctx.fillRect(px, standTop - 22, 2, 22);
    ctx.fillStyle = ['#e5484d', '#f2c33a', '#2fbf71', '#3d9bff'][((m / 12) % 4 + 4) % 4];
    ctx.beginPath(); ctx.moveTo(px + 2, standTop - 22); ctx.lineTo(px + 18, standTop - 18 + wave); ctx.lineTo(px + 2, standTop - 13); ctx.fill();
  }
  // infield: a row of low sponsor boards between the stand and the track (a little parallax)
  ctx.fillStyle = '#2f5e2c'; ctx.fillRect(0, standBot, W, top - standBot);
  const bp = 0.85, bl = 5, bh = (top - standBot) * 0.8;
  for (let k = Math.floor((cam * bp) / bl); (k * bl - cam * bp) * ppm < W; k++) {
    const x = (k * bl - cam * bp) * ppm;
    if (x + bl * ppm < 0) continue;
    paintAd(ctx, SPONSORS[((k * 7) % SPONSORS.length + SPONSORS.length) % SPONSORS.length], x, top - bh - 2, bl * ppm - 3, bh);
  }
  // turf with mowing stripes, slanted for depth
  ctx.fillStyle = '#3f8a37'; ctx.fillRect(0, top, W, H - top);
  ctx.fillStyle = 'rgba(255,255,255,.06)';
  // stripes sit on even multiples in the world, so they slide by instead of swapping light and dark
  const stripe = 4, f0 = Math.floor(cam / (stripe * 2)) * 2 - 2;
  for (let k = f0; k < f0 + L.view / stripe + 4; k += 2) {
    const x = (k * stripe - cam) * ppm;
    ctx.beginPath(); ctx.moveTo(x + 30, top); ctx.lineTo(x + 30 + stripe * ppm, top); ctx.lineTo(x + stripe * ppm, H); ctx.lineTo(x, H); ctx.fill();
  }
  // far rail
  rail(ctx, L, cam, top - 2, 0.7 * Math.min(1, ppm / 36)); // rails scale with the zoom
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
  // starting gate: a green frame over all six stalls, one divider per lane at the horses' height
  const gx = (-2.3 - cam) * ppm, gw = 2.7 * ppm;
  if (gx > -gw * 2 && gx < W) {
    const gTop = L.lane(0).y - L.lane(0).s * 3.05 - Math.max(10, L.lane(0).s * 0.3) - 26;
    ctx.fillStyle = 'rgba(20,40,20,.18)'; ctx.fillRect(gx + 8, top, gw, bottom - top);
    ctx.fillStyle = '#9aa0aa'; ctx.fillRect(gx, gTop, 6, bottom - gTop + 4); ctx.fillRect(gx + gw - 6, gTop, 6, bottom - gTop + 4);
    ctx.fillStyle = '#2f7d4f'; ctx.beginPath(); ctx.roundRect(gx - 6, gTop - 4, gw + 12, 22, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(Math.min(14, ppm * 0.38))}px Geist Variable, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('BETLY DERBY', gx + gw / 2, gTop + 7);
    ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < 6; i++) {
      const { y, s } = L.lane(i);
      ctx.fillStyle = '#3c9a62'; ctx.fillRect(gx, y - 1.55 * s, gw, Math.max(3, s * 0.1));
      ctx.fillStyle = '#2f7d4f'; ctx.fillRect(gx, y - 0.25 * s, gw, Math.max(2, s * 0.06));
    }
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
  rail(ctx, L, cam * 1.12, L.H - 2, 1.4 * Math.min(1, L.ppm / 36));
}

/** Soft dust puffs where the hooves strike, growing and fading behind the horse (procedural, no state). */
export function drawClods(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, stride: number, run: number) {
  if (run < 0.3) return;
  for (let k = 0; k < 3; k++) {
    const u = (stride * 2 + k / 3) % 1; // age of this puff: 0 = just kicked up
    const px = x - (0.4 + u * 1.6) * s - (k % 2) * 0.5 * s, py = y - 0.08 * s - u * 0.35 * s, r = (0.12 + u * 0.38) * s;
    ctx.fillStyle = `rgba(232,222,190,${(1 - u) * 0.22 * run})`;
    ctx.beginPath(); ctx.ellipse(px, py, r * 1.4, r, 0, 0, 7); ctx.fill();
  }
}

/** A faint golden line across the track at the leader's nose (drawn under the horses). */
export function drawLeadLine(ctx: CanvasRenderingContext2D, L: Layout, noseX: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,214,90,.55)'; ctx.lineWidth = 2; ctx.setLineDash([8, 7]);
  ctx.beginPath(); ctx.moveTo(noseX + 18, L.top); ctx.lineTo(noseX, L.bottom + 6); ctx.stroke();
  ctx.restore();
}

/** Number tag above a horse; the leader's is gold and carries a waving pennant. x, y as in drawHorse. */
export function drawTag(ctx: CanvasRenderingContext2D, h: Horse, x: number, y: number, s: number, lead: boolean, t: number) {
  const [a, b] = SILKS[h.silks];
  const cx = x + 0.75 * s, cy = y - 3.05 * s, r = Math.max(10, s * 0.3);
  ctx.save();
  if (lead) {
    // pennant on a short pole
    const wave = Math.sin(t * 9) * r * 0.3, top = cy - r * 4.4;
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(cx - 1.5, top, 3, r * 3.6);
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 6;
    ctx.fillStyle = '#ffd25a';
    ctx.beginPath(); ctx.moveTo(cx + 1.5, top); ctx.quadraticCurveTo(cx + r * 1.8, top + r * 0.3 + wave, cx + r * 3.2, top + r * 0.75 + wave); ctx.quadraticCurveTo(cx + r * 1.8, top + r * 1.2 + wave, cx + 1.5, top + r * 1.6); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1c1c22'; ctx.font = `800 ${Math.round(r * 0.95)}px Geist Variable, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('1.', cx + r * 0.45, top + r * 0.8 + wave * 0.5);
  }
  ctx.beginPath(); ctx.roundRect(cx - r, cy - r * 0.8, r * 2, r * 1.6, r * 0.45);
  ctx.fillStyle = a; ctx.fill();
  ctx.lineWidth = lead ? 3 : 1.5; ctx.strokeStyle = lead ? '#ffd25a' : 'rgba(0,0,0,.35)'; ctx.stroke();
  ctx.fillStyle = a === '#ffffff' || a === '#f2c33a' ? '#1c1c22' : '#fff';
  void b;
  ctx.font = `800 ${Math.round(r * 1.05)}px Geist Mono Variable, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(h.n), cx, cy + 1);
  ctx.restore();
}
