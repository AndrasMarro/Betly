// Drawing for Pappkameraden: everything is cardboard. The floor is the dark inside of a big box, walls are folded
// kraft cardboard, breakable boxes are thin and perforated, holes are cut into the floor. Tanks are painted
// cardboard with marker outlines. All on an 800 × 560 sheet; the caller sets the scale, so it stays sharp at any size.
import { T, COLS, ROWS, AW, AH, MINE_R, SPEC, type World, type Tank, type Kind } from '../games/tanks';

type Paint = { body: string; dark: string; trim: string; deco: 'star' | 'rust' | 'stripes' | 'dots' | 'hazard' | 'flames' | 'camo' | 'crown' | 'pearl' | 'eyes' | 'ring' };
export const PAINT: Record<Kind | 'player2', Paint> = {
  player: { body: '#4f7cff', dark: '#2a4bb8', trim: '#ffffff', deco: 'star' },
  player2: { body: '#ff8a2a', dark: '#b85a10', trim: '#fff3e6', deco: 'star' },
  dummy: { body: '#e8dcc4', dark: '#a8946c', trim: '#e5484d', deco: 'ring' },
  rust: { body: '#b0703f', dark: '#6b3d20', trim: '#e2a676', deco: 'rust' },
  patrol: { body: '#9aa1ab', dark: '#5b6068', trim: '#f0f2f5', deco: 'stripes' },
  arrow: { body: '#1fc1bf', dark: '#0a7473', trim: '#d9fffd', deco: 'stripes' },
  sapper: { body: '#f2c230', dark: '#a07b0c', trim: '#1f1d2b', deco: 'hazard' },
  hunter: { body: '#e5533f', dark: '#8f2418', trim: '#ffd9a8', deco: 'flames' },
  sniper: { body: '#6c9e47', dark: '#365a20', trim: '#d4ecb4', deco: 'camo' },
  commander: { body: '#8a5ad0', dark: '#4c2a7a', trim: '#f3d488', deco: 'crown' },
  phantom: { body: '#eef2f8', dark: '#aeb7c4', trim: '#ffffff', deco: 'pearl' },
  shadow: { body: '#2c2e35', dark: '#0b0c0f', trim: '#ff4d5a', deco: 'eyes' },
};
const INK = '#1a130d';

/** A tiny repeatable random from a number, so the static layer looks the same every time. */
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** The floor and everything that does not move. Call with a context already scaled to the sheet. */
export function drawStatic(ctx: CanvasRenderingContext2D, w: World) {
  ctx.clearRect(0, 0, AW, AH);
  // the inside of a dark cardboard box: corrugation lines, a few printed marks, a soft vignette
  ctx.fillStyle = '#2a2018'; ctx.fillRect(0, 0, AW, AH);
  ctx.fillStyle = 'rgba(255,220,170,.035)';
  for (let x = 0; x < AW; x += 7) ctx.fillRect(x, 0, 3, AH);
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x * T + 0.5, 0); ctx.lineTo(x * T + 0.5, AH); ctx.stroke(); }
  for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * T + 0.5); ctx.lineTo(AW, y * T + 0.5); ctx.stroke(); }
  ctx.save(); ctx.globalAlpha = 0.07; ctx.strokeStyle = '#ffe2b8'; ctx.fillStyle = '#ffe2b8'; ctx.lineWidth = 3; ctx.font = '700 22px Geist Mono Variable, monospace';
  for (let i = 0; i < 4; i++) {
    const x = 60 + hash(i + w.mission * 7) * 680, y = 50 + hash(i * 3 + 1 + w.mission) * 460;
    if (i % 2) { ctx.beginPath(); ctx.moveTo(x, y + 26); ctx.lineTo(x, y - 6); ctx.moveTo(x - 12, y + 6); ctx.lineTo(x, y - 8); ctx.lineTo(x + 12, y + 6); ctx.stroke(); }
    else ctx.fillText(i ? 'FRAGILE' : 'THIS SIDE UP', x - 50, y);
  }
  ctx.restore();
  const vg = ctx.createRadialGradient(AW / 2, AH / 2, AH * 0.3, AW / 2, AH / 2, AW * 0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, AW, AH);
  // holes, then shadows, then walls and boxes
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (w.grid[y][x] === 'o') hole(ctx, x * T, y * T, x * 31 + y);
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const c = w.grid[y][x]; if (c === '#' || c === 'c') { ctx.beginPath(); ctx.roundRect(x * T + 6, y * T + 8, T, T, 4); ctx.fill(); } }
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const c = w.grid[y][x];
    if (c === '#') wall(ctx, x * T, y * T, w.grid[y - 1]?.[x] === '#', w.grid[y + 1]?.[x] === '#', w.grid[y][x - 1] === '#', w.grid[y][x + 1] === '#', x * 13 + y * 7);
    else if (c === 'c') box(ctx, x * T, y * T, x * 7 + y * 3);
  }
}
/** Folded kraft cardboard: joins with its neighbours, corrugated edges, sometimes a strip of tape. */
function wall(ctx: CanvasRenderingContext2D, x: number, y: number, up: boolean, down: boolean, left: boolean, right: boolean, seed: number) {
  const x0 = x + (left ? 0 : 1), y0 = y + (up ? 0 : 1), x1 = x + T - (right ? 0 : 1), y1 = y + T - (down ? 0 : 1);
  const g = ctx.createLinearGradient(x, y, x + T, y + T);
  g.addColorStop(0, '#d9ab74'); g.addColorStop(1, '#b8854f');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(x0, y0, x1 - x0, y1 - y0, [up || left ? 0 : 4, up || right ? 0 : 4, down || right ? 0 : 4, down || left ? 0 : 4]); ctx.fill();
  // flute texture
  ctx.fillStyle = 'rgba(120,80,40,.18)';
  for (let k = x0 + 3; k < x1; k += 6) ctx.fillRect(k, y0, 2, y1 - y0);
  // the cut edges show the wavy inside of the cardboard
  ctx.strokeStyle = '#8a5f33'; ctx.lineWidth = 1.6;
  const wave = (ax: number, ay: number, bx: number, by: number) => {
    ctx.beginPath(); const n = 8;
    for (let i = 0; i <= n; i++) { const t = i / n, px = ax + (bx - ax) * t, py = ay + (by - ay) * t, o = Math.sin(i * Math.PI) * 1.6; ctx.lineTo(px + (ay === by ? 0 : o), py + (ay === by ? o : 0)); }
    ctx.stroke();
  };
  if (!down) wave(x0 + 2, y1 - 3, x1 - 2, y1 - 3);
  if (!right) wave(x1 - 3, y0 + 2, x1 - 3, y1 - 2);
  ctx.strokeStyle = 'rgba(255,240,215,.55)'; ctx.lineWidth = 1.5;
  if (!up) { ctx.beginPath(); ctx.moveTo(x0 + 2, y0 + 1.5); ctx.lineTo(x1 - 2, y0 + 1.5); ctx.stroke(); }
  if (!left) { ctx.beginPath(); ctx.moveTo(x0 + 1.5, y0 + 2); ctx.lineTo(x0 + 1.5, y1 - 2); ctx.stroke(); }
  if (hash(seed) < 0.22) { ctx.fillStyle = 'rgba(240,225,180,.75)'; ctx.fillRect(x + 4, y + T / 2 - 5, T - 8, 10); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x + 4, y + T / 2 - 5, T - 8, 3); }
}
/** Thin box that a mine can blow away: lighter, dashed tear line and a big X stamp. */
function box(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
  ctx.fillStyle = '#efe2c8'; ctx.beginPath(); ctx.roundRect(x + 3, y + 3, T - 6, T - 6, 3); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(26,19,13,.45)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x + 7, y + 7, T - 14, T - 14, 2); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(229,72,77,.75)'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  const o = hash(seed) * 2;
  ctx.beginPath(); ctx.moveTo(x + 13 + o, y + 13); ctx.lineTo(x + T - 13, y + T - 13 - o); ctx.moveTo(x + T - 13, y + 13 + o); ctx.lineTo(x + 13 + o, y + T - 13); ctx.stroke();
}
/** A hole cut into the floor: ragged edge, dark below. */
function hole(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
  const cx = x + T / 2, cy = y + T / 2;
  ctx.beginPath();
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, r = 15 + hash(seed + i) * 4; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  ctx.closePath();
  ctx.fillStyle = '#c8955c'; ctx.fill();
  ctx.save(); ctx.clip();
  const g = ctx.createRadialGradient(cx - 2, cy - 2, 2, cx, cy, 18);
  g.addColorStop(0, '#050403'); g.addColorStop(1, '#1d150e');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx + 2, cy + 2, 15, 0, 7); ctx.fill();
  ctx.restore();
}

/** One cardboard tank. `alpha` for the phantom. */
export function drawTank(ctx: CanvasRenderingContext2D, t: Pick<Tank, 'x' | 'y' | 'body' | 'turret' | 'kind' | 'key'>, p2 = false, alpha = 1) {
  const pt = PAINT[p2 ? 'player2' : t.kind];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(t.x, t.y);
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(4, 6, 21, 17, t.body, 0, 7); ctx.fill();
  ctx.rotate(t.body);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // treads: strips of dark corrugated cardboard whose ridges roll along
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#4a3a2a'; ctx.beginPath(); ctx.roundRect(-19, side * 13 - 5, 38, 10, 4); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,215,160,.4)'; ctx.lineWidth = 1.2;
    const off = (t.key * 12) % 5;
    for (let k = -17 + off; k < 17; k += 5) { ctx.beginPath(); ctx.moveTo(k, side * 13 - 3.5); ctx.lineTo(k, side * 13 + 3.5); ctx.stroke(); }
  }
  // hull: painted cardboard with a marker outline, a folded edge and a bit of tape
  ctx.fillStyle = pt.body; ctx.beginPath(); ctx.roundRect(-16, -11, 32, 22, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(-16, -11, 32, 5);
  ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(-16, 7, 32, 4);
  deco(ctx, pt.deco, pt.trim, pt.dark);
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-16, -11, 32, 22, 4); ctx.stroke();
  ctx.fillStyle = 'rgba(240,225,180,.8)'; ctx.fillRect(-16.5, -3, 6, 6);
  ctx.restore();
  // turret: a cardboard disc, barrel: a paper tube
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(t.x, t.y); ctx.rotate(t.turret);
  ctx.lineJoin = 'round';
  const rocket = SPEC[t.kind]?.rocket, bw = rocket ? 8 : 6.5;
  ctx.fillStyle = '#d9b484'; ctx.beginPath(); ctx.roundRect(3, -bw / 2, 21, bw, 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.fillStyle = 'rgba(120,80,40,.35)'; for (let k = 7; k < 22; k += 5) ctx.fillRect(k, -bw / 2, 1.2, bw);
  ctx.fillStyle = '#2a1d12'; ctx.beginPath(); ctx.ellipse(24, 0, 1.6, bw / 2 - 0.5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = pt.body; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(-2, -2, 6, 0, 7); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.stroke();
  ctx.fillStyle = pt.trim; ctx.beginPath(); ctx.arc(-1.5, 0, 2.4, 0, 7); ctx.fill();
  ctx.restore();
}
function deco(ctx: CanvasRenderingContext2D, d: Paint['deco'], trim: string, dark: string) {
  ctx.save();
  ctx.beginPath(); ctx.roundRect(-16, -11, 32, 22, 4); ctx.clip();
  ctx.fillStyle = trim; ctx.strokeStyle = trim;
  if (d === 'stripes') { ctx.lineWidth = 3; for (const x of [-9, 9]) { ctx.beginPath(); ctx.moveTo(x, -11); ctx.lineTo(x, 11); ctx.stroke(); } }
  else if (d === 'hazard') { ctx.lineWidth = 3; for (let x = -24; x < 24; x += 8) { ctx.beginPath(); ctx.moveTo(x, 11); ctx.lineTo(x + 10, -11); ctx.stroke(); } }
  else if (d === 'dots') for (const [a, b] of [[-8, -4], [0, 4], [8, -4]]) { ctx.beginPath(); ctx.arc(a, b, 2.5, 0, 7); ctx.fill(); }
  else if (d === 'rust') { ctx.globalAlpha = 0.5; for (const [a, b, r] of [[-9, 5, 4], [6, -6, 3], [11, 6, 2.5]]) { ctx.beginPath(); ctx.arc(a, b, r, 0, 7); ctx.fill(); } }
  else if (d === 'flames') { ctx.beginPath(); ctx.moveTo(-16, -9); ctx.quadraticCurveTo(-4, -7, -8, 0); ctx.quadraticCurveTo(-2, 6, -16, 9); ctx.fill(); }
  else if (d === 'camo') { ctx.fillStyle = dark; for (const [a, b, r] of [[-9, -5, 5], [4, 5, 6], [12, -6, 4]]) { ctx.beginPath(); ctx.ellipse(a, b, r, r * 0.7, 0.6, 0, 7); ctx.fill(); } }
  else if (d === 'crown') { ctx.lineWidth = 2; ctx.strokeRect(-13.5, -8.5, 27, 17); }
  else if (d === 'pearl') { ctx.globalAlpha = 0.6; ctx.fillStyle = '#c9d8ff'; ctx.fillRect(-16, -11, 32, 6); }
  else if (d === 'eyes') { for (const b of [-5, 5]) { ctx.beginPath(); ctx.arc(12, b, 2, 0, 7); ctx.fill(); } }
  else if (d === 'ring') { ctx.lineWidth = 2.5; for (const r of [8, 3]) { ctx.beginPath(); ctx.arc(-4, 0, r, 0, 7); ctx.stroke(); } }
  else if (d === 'star') star(ctx, -8, 0, 5);
  ctx.restore();
}
function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.fill();
}
const SCRAP: Record<string, string[]> = { crate: ['#efe2c8', '#d9c7a3', '#e5484d'] };
const scrapColors = (k: string) => SCRAP[k] ?? [PAINT[k as Kind]?.body ?? '#999', PAINT[k as Kind]?.dark ?? '#555', '#d9b484', '#4a3a2a'];

/** Everything that moves, on top of the static layer (drawn at the same scale). */
export function drawWorld(ctx: CanvasRenderingContext2D, w: World, stat: HTMLCanvasElement, p2Id = -1) {
  ctx.save();
  if (w.shake > 0) { const k = w.shake * 9; ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k); }
  ctx.drawImage(stat, 0, 0, AW, AH);
  for (const s of w.scorch) { const g = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, s.r); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill(); }
  // scraps of everything that was destroyed stay on the floor
  for (let i = 0; i < w.debris.length; i++) {
    const d = w.debris[i], cs = scrapColors(d.k);
    ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.a);
    ctx.fillStyle = cs[i % cs.length]; ctx.fillRect(-d.s / 2, -d.s / 3, d.s, d.s * 0.66);
    ctx.strokeStyle = 'rgba(26,19,13,.6)'; ctx.lineWidth = 0.8; ctx.strokeRect(-d.s / 2, -d.s / 3, d.s, d.s * 0.66);
    ctx.restore();
  }
  // tread marks
  ctx.fillStyle = '#f3d6aa';
  for (const m of w.tracks) {
    const a = Math.max(0, 1 - (w.t - m.t) / 14);
    if (!a) continue;
    ctx.globalAlpha = a * 0.13;
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.a); ctx.fillRect(-3, -15, 6, 4); ctx.fillRect(-3, 11, 6, 4); ctx.restore();
  }
  ctx.globalAlpha = 1;
  if (w.flag) {
    const f = w.flag, bob = Math.sin(w.t * 4) * 2;
    ctx.fillStyle = 'rgba(255,220,120,.18)'; ctx.beginPath(); ctx.arc(f.x, f.y, 24 + Math.sin(w.t * 3) * 3, 0, 7); ctx.fill();
    ctx.strokeStyle = '#f3e6cf'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(f.x - 6, f.y + 14); ctx.lineTo(f.x - 6, f.y - 18); ctx.stroke();
    ctx.fillStyle = '#e5484d'; ctx.beginPath(); ctx.moveTo(f.x - 5, f.y - 18 + bob); ctx.lineTo(f.x + 14, f.y - 12 + bob); ctx.lineTo(f.x - 5, f.y - 6 + bob); ctx.fill();
  }
  for (const m of w.mines) {
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.arc(m.x + 2, m.y + 3, MINE_R, 0, 7); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(m.x, m.y, MINE_R, 0, 7); ctx.clip();
    ctx.fillStyle = '#f5d90a'; ctx.fillRect(m.x - MINE_R, m.y - MINE_R, MINE_R * 2, MINE_R * 2);
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    for (let k = -14; k < 14; k += 7) { ctx.beginPath(); ctx.moveTo(m.x + k, m.y + MINE_R); ctx.lineTo(m.x + k + 9, m.y - MINE_R); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(m.x, m.y, MINE_R, 0, 7); ctx.stroke();
    const blink = m.t > 7.5 ? Math.sin(m.t * 22) > 0 : Math.sin(m.t * 6) > 0.4;
    ctx.fillStyle = blink ? '#ff3b3b' : '#7a1a1a'; ctx.beginPath(); ctx.arc(m.x, m.y, 3, 0, 7); ctx.fill();
    if (blink) { ctx.fillStyle = 'rgba(255,60,60,.3)'; ctx.beginPath(); ctx.arc(m.x, m.y, 10, 0, 7); ctx.fill(); }
  }
  for (const t of w.tanks) if (t.alive) drawTank(ctx, t, t.id === p2Id, t.team === 'e' && SPEC[t.kind].stealth ? Math.max(0.04, t.seen * 0.9) : 1);
  // shells glow so they stand out on the dark floor
  for (const s of w.shells) {
    const sp = Math.hypot(s.vx, s.vy) || 1, ux = s.vx / sp, uy = s.vy / sp, tail = s.rocket ? 30 : 20;
    const g = ctx.createLinearGradient(s.x, s.y, s.x - ux * tail, s.y - uy * tail);
    g.addColorStop(0, s.rocket ? 'rgba(255,150,40,.95)' : 'rgba(255,240,200,.85)'); g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.strokeStyle = g; ctx.lineWidth = s.rocket ? 6 : 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - ux * tail, s.y - uy * tail); ctx.stroke();
    const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 12);
    glow.addColorStop(0, s.team === 'p' ? 'rgba(140,190,255,.55)' : 'rgba(255,120,90,.55)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(s.x, s.y, 12, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(Math.atan2(uy, ux));
    ctx.fillStyle = s.rocket ? '#ffffff' : '#ffe08a'; ctx.beginPath(); ctx.roundRect(-5.5, -3, 10, 6, 3); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
    if (s.rocket) { ctx.fillStyle = '#e5484d'; ctx.fillRect(-5.5, -3, 2.5, 6); }
    ctx.restore();
  }
  for (const b of w.booms) {
    const life = b.big ? 0.9 : 0.4, k = b.t / life, r = (b.big ? 64 : 16) * (0.35 + k * 0.8);
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
    g.addColorStop(0, `rgba(255,250,210,${1 - k})`); g.addColorStop(0.35, `rgba(255,170,60,${0.9 * (1 - k)})`); g.addColorStop(0.75, `rgba(200,50,30,${0.5 * (1 - k)})`); g.addColorStop(1, 'rgba(60,40,30,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, 7); ctx.fill();
    if (b.big) {
      ctx.strokeStyle = `rgba(255,240,210,${0.6 * (1 - k)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, r * 1.25, 0, 7); ctx.stroke();
      // flying cardboard bits
      for (let i = 0; i < 8; i++) { const a = i * 0.785 + b.x * 0.01, d = r * (0.6 + k * 0.9); ctx.fillStyle = `rgba(217,180,132,${1 - k})`; ctx.fillRect(b.x + Math.cos(a) * d - 2, b.y + Math.sin(a) * d - 2, 4, 3); }
    }
  }
  ctx.restore();
}
/** The aiming aid: dotted line from the barrel to the cross hair. */
export function drawAim(ctx: CanvasRenderingContext2D, t: Tank, mx: number, my: number) {
  ctx.save();
  ctx.setLineDash([3, 7]); ctx.strokeStyle = 'rgba(160,195,255,.6)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(t.x + Math.cos(t.turret) * 26, t.y + Math.sin(t.turret) * 26); ctx.lineTo(mx, my); ctx.stroke();
  ctx.setLineDash([]); ctx.strokeStyle = '#9fc0ff'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(mx, my, 9, 0, 7); ctx.stroke();
  for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.beginPath(); ctx.moveTo(mx + a * 5, my + b * 5); ctx.lineTo(mx + a * 14, my + b * 14); ctx.stroke(); }
  ctx.restore();
}
