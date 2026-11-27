// Drawing for Blechbüchsen: a checked kitchen floor, tin blocks with rivets, cardboard crates, drain holes,
// and wind-up tin tanks whose key turns while they drive. Everything is drawn on an 800 × 560 sheet.
import { T, COLS, ROWS, AW, AH, TANK_R, MINE_R, SPEC, type World, type Tank, type Kind } from '../games/tanks';

export const PAINT: Record<Kind | 'player2', { body: string; dark: string; trim: string; deco: 'star' | 'rust' | 'stripes' | 'dots' | 'hazard' | 'flames' | 'camo' | 'crown' | 'pearl' | 'eyes' }> = {
  player: { body: '#3e63dd', dark: '#25409c', trim: '#f2f4ff', deco: 'star' },
  player2: { body: '#f76b15', dark: '#b2480a', trim: '#fff3e6', deco: 'star' },
  rust: { body: '#a0623a', dark: '#6b3d20', trim: '#d89a6a', deco: 'rust' },
  patrol: { body: '#8a9099', dark: '#5b6068', trim: '#e3e6ea', deco: 'stripes' },
  arrow: { body: '#0ea5a4', dark: '#07706f', trim: '#c9fffb', deco: 'stripes' },
  sapper: { body: '#e8b923', dark: '#a07b0c', trim: '#1f1d2b', deco: 'hazard' },
  hunter: { body: '#d6402f', dark: '#8f2418', trim: '#ffd9a8', deco: 'flames' },
  sniper: { body: '#5b8c3a', dark: '#365a20', trim: '#c9e3a6', deco: 'camo' },
  commander: { body: '#7b4bb7', dark: '#4c2a7a', trim: '#f3d488', deco: 'crown' },
  phantom: { body: '#e9eef5', dark: '#aeb7c4', trim: '#ffffff', deco: 'pearl' },
  shadow: { body: '#22242a', dark: '#0b0c0f', trim: '#ff4d5a', deco: 'eyes' },
};

/** The floor and everything that does not move, drawn once per map (and again after a crate is blown up). */
export function drawStatic(ctx: CanvasRenderingContext2D, w: World) {
  ctx.clearRect(0, 0, AW, AH);
  // kitchen floor: cream and mint tiles with grout
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    ctx.fillStyle = (x + y) % 2 ? '#e9f1e6' : '#f7f0de';
    ctx.fillRect(x * T, y * T, T, T);
  }
  ctx.strokeStyle = 'rgba(120,110,90,.12)'; ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x * T + 0.5, 0); ctx.lineTo(x * T + 0.5, AH); ctx.stroke(); }
  for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * T + 0.5); ctx.lineTo(AW, y * T + 0.5); ctx.stroke(); }
  // holes first (in the floor), then shadows, then blocks and crates
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (w.grid[y][x] === 'o') hole(ctx, x * T, y * T);
  ctx.fillStyle = 'rgba(40,30,20,.22)';
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const c = w.grid[y][x]; if (c === '#' || c === 'c') roundRect(ctx, x * T + 5, y * T + 7, T, T, 6, true); }
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const c = w.grid[y][x]; if (c === '#') block(ctx, x * T, y * T); else if (c === 'c') crate(ctx, x * T, y * T, x * 7 + y * 3); }
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill = false) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); if (fill) ctx.fill();
}
function block(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const g = ctx.createLinearGradient(x, y, x + T, y + T);
  g.addColorStop(0, '#9fb3c9'); g.addColorStop(0.5, '#7189a3'); g.addColorStop(1, '#556b84');
  ctx.fillStyle = g; roundRect(ctx, x + 1, y + 1, T - 2, T - 2, 5, true);
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + 4, y + T - 6); ctx.lineTo(x + 4, y + 4); ctx.lineTo(x + T - 6, y + 4); ctx.stroke();
  ctx.strokeStyle = 'rgba(20,30,45,.45)';
  ctx.beginPath(); ctx.moveTo(x + T - 3, y + 6); ctx.lineTo(x + T - 3, y + T - 3); ctx.lineTo(x + 6, y + T - 3); ctx.stroke();
  ctx.fillStyle = '#3c4d61';
  for (const [a, b] of [[8, 8], [T - 9, 8], [8, T - 9], [T - 9, T - 9]]) { ctx.beginPath(); ctx.arc(x + a, y + b, 2, 0, 7); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,.18)'; roundRect(ctx, x + 12, y + 12, T - 24, T - 24, 3, true);
}
function crate(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
  ctx.fillStyle = '#c99a5e'; roundRect(ctx, x + 2, y + 2, T - 4, T - 4, 3, true);
  ctx.strokeStyle = '#8a6334'; ctx.lineWidth = 1.5; roundRect(ctx, x + 2.5, y + 2.5, T - 5, T - 5, 3); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(x + 3, y + 3, T - 6, 4);
  // packing tape across, and a little arrow print
  ctx.fillStyle = 'rgba(233,215,160,.9)'; if (seed % 2) ctx.fillRect(x + T / 2 - 4, y + 2, 8, T - 4); else ctx.fillRect(x + 2, y + T / 2 - 4, T - 4, 8);
  ctx.strokeStyle = 'rgba(90,60,25,.6)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x + 9, y + T - 9); ctx.lineTo(x + 9, y + T - 17); ctx.moveTo(x + 6, y + T - 14); ctx.lineTo(x + 9, y + T - 17); ctx.lineTo(x + 12, y + T - 14); ctx.stroke();
}
function hole(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const cx = x + T / 2, cy = y + T / 2;
  const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 16);
  g.addColorStop(0, '#0b0d10'); g.addColorStop(0.8, '#23272e'); g.addColorStop(1, '#4a5260');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 16, 0, 7); ctx.fill();
  ctx.strokeStyle = '#a9b4c2'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 16, 0, 7); ctx.stroke();
  ctx.strokeStyle = 'rgba(169,180,194,.55)'; ctx.lineWidth = 2;
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 6, cy - 14); ctx.lineTo(cx + i * 6, cy + 14); ctx.stroke(); }
}

/** One tin tank. `alpha` for the phantom. */
export function drawTank(ctx: CanvasRenderingContext2D, t: Pick<Tank, 'x' | 'y' | 'body' | 'turret' | 'kind' | 'key' | 'odo'>, p2 = false, alpha = 1) {
  const pt = PAINT[p2 ? 'player2' : t.kind];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(t.x, t.y);
  // shadow
  ctx.fillStyle = 'rgba(30,20,10,.25)'; ctx.beginPath(); ctx.ellipse(4, 6, 21, 17, t.body, 0, 7); ctx.fill();
  ctx.rotate(t.body);
  // treads with moving links
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#2b2d33'; roundRect(ctx, -19, side * 13 - 5, 38, 10, 4, true);
    ctx.strokeStyle = 'rgba(160,165,175,.65)'; ctx.lineWidth = 1.5;
    const off = (t.key * 12) % 6;
    for (let k = -18 + off; k < 18; k += 6) { ctx.beginPath(); ctx.moveTo(k, side * 13 - 4); ctx.lineTo(k, side * 13 + 4); ctx.stroke(); }
  }
  // the wind-up key at the back
  ctx.save(); ctx.translate(-21, 0);
  ctx.fillStyle = '#d9b44a'; ctx.fillRect(-4, -1.5, 5, 3);
  const k = Math.cos(t.key * 3);
  ctx.beginPath(); ctx.ellipse(-7, -5 * Math.abs(k) - 1, 3, 4 * Math.abs(k) + 0.6, 0, 0, 7); ctx.ellipse(-7, 5 * Math.abs(k) + 1, 3, 4 * Math.abs(k) + 0.6, 0, 0, 7); ctx.fill();
  ctx.restore();
  // hull: painted tin with a highlight and rivets
  const g = ctx.createLinearGradient(0, -12, 0, 12);
  g.addColorStop(0, shade(pt.body, 0.25)); g.addColorStop(0.5, pt.body); g.addColorStop(1, pt.dark);
  ctx.fillStyle = g; roundRect(ctx, -17, -11, 34, 22, 6, true);
  ctx.strokeStyle = pt.dark; ctx.lineWidth = 1.5; roundRect(ctx, -17, -11, 34, 22, 6); ctx.stroke();
  deco(ctx, pt.deco, pt.trim, pt.dark);
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  for (const [a, b] of [[-14, -8], [14, -8], [-14, 8], [14, 8]]) { ctx.beginPath(); ctx.arc(a, b, 1.3, 0, 7); ctx.fill(); }
  ctx.restore();
  // turret and barrel
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(t.x, t.y); ctx.rotate(t.turret);
  const rocket = SPEC[t.kind]?.rocket;
  ctx.fillStyle = pt.dark; roundRect(ctx, 2, rocket ? -4 : -3, 22, rocket ? 8 : 6, 2, true);
  ctx.fillStyle = shade(pt.body, -0.1); ctx.fillRect(18, rocket ? -4.5 : -3.5, 5, rocket ? 9 : 7);
  const tg = ctx.createRadialGradient(-3, -3, 1, 0, 0, 10);
  tg.addColorStop(0, shade(pt.body, 0.35)); tg.addColorStop(1, pt.dark);
  ctx.fillStyle = tg; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = pt.trim; ctx.beginPath(); ctx.arc(-2, -2, 2.2, 0, 7); ctx.fill();
  ctx.restore();
}
function deco(ctx: CanvasRenderingContext2D, d: string, trim: string, dark: string) {
  ctx.save();
  ctx.beginPath(); ctx.roundRect(-17, -11, 34, 22, 6); ctx.clip();
  ctx.fillStyle = trim; ctx.strokeStyle = trim;
  if (d === 'stripes') { ctx.lineWidth = 3; for (const x of [-10, 10]) { ctx.beginPath(); ctx.moveTo(x, -11); ctx.lineTo(x, 11); ctx.stroke(); } }
  else if (d === 'hazard') { ctx.lineWidth = 3; for (let x = -24; x < 24; x += 8) { ctx.beginPath(); ctx.moveTo(x, 11); ctx.lineTo(x + 10, -11); ctx.stroke(); } }
  else if (d === 'dots') for (const [a, b] of [[-8, -4], [0, 4], [8, -4]]) { ctx.beginPath(); ctx.arc(a, b, 2.5, 0, 7); ctx.fill(); }
  else if (d === 'rust') { ctx.globalAlpha = 0.55; for (const [a, b, r] of [[-9, 5, 4], [6, -6, 3], [11, 6, 2.5]]) { ctx.beginPath(); ctx.arc(a, b, r, 0, 7); ctx.fill(); } }
  else if (d === 'flames') { ctx.beginPath(); ctx.moveTo(-17, -9); ctx.quadraticCurveTo(-4, -7, -8, 0); ctx.quadraticCurveTo(-2, 6, -17, 9); ctx.fill(); }
  else if (d === 'camo') { ctx.fillStyle = dark; for (const [a, b, r] of [[-9, -5, 5], [4, 5, 6], [12, -6, 4]]) { ctx.beginPath(); ctx.ellipse(a, b, r, r * 0.7, 0.6, 0, 7); ctx.fill(); } }
  else if (d === 'crown') { ctx.lineWidth = 2; ctx.strokeRect(-14.5, -8.5, 29, 17); }
  else if (d === 'pearl') { ctx.globalAlpha = 0.6; ctx.fillStyle = '#c9d8ff'; ctx.fillRect(-17, -11, 34, 6); }
  else if (d === 'eyes') { for (const b of [-5, 5]) { ctx.beginPath(); ctx.arc(13, b, 2, 0, 7); ctx.fill(); } }
  else if (d === 'star') { star(ctx, -9, 0, 5); }
  ctx.restore();
}
function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.fill();
}
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16), f = (c: number) => Math.max(0, Math.min(255, Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** Everything that moves, on top of the static layer. `p2`: id of the second player's tank. */
export function drawWorld(ctx: CanvasRenderingContext2D, w: World, stat: HTMLCanvasElement, p2Id = -1) {
  ctx.drawImage(stat, 0, 0, AW, AH);
  // scorch marks and tread marks on the floor
  for (const s of w.scorch) { const g = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, s.r); g.addColorStop(0, 'rgba(40,30,20,.35)'); g.addColorStop(1, 'rgba(40,30,20,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#5a4a36';
  for (const m of w.tracks) {
    const a = Math.max(0, 1 - (w.t - m.t) / 14);
    if (!a) continue;
    ctx.globalAlpha = a * 0.22;
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.a); ctx.fillRect(-3, -15, 6, 4); ctx.fillRect(-3, 11, 6, 4); ctx.restore();
  }
  ctx.globalAlpha = 1;
  // mines: striped pucks with a blinking light, faster near the end of the fuse
  for (const m of w.mines) {
    ctx.fillStyle = 'rgba(30,20,10,.25)'; ctx.beginPath(); ctx.arc(m.x + 2, m.y + 3, MINE_R, 0, 7); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(m.x, m.y, MINE_R, 0, 7); ctx.clip();
    ctx.fillStyle = '#f5d90a'; ctx.fillRect(m.x - MINE_R, m.y - MINE_R, MINE_R * 2, MINE_R * 2);
    ctx.strokeStyle = '#1f1d2b'; ctx.lineWidth = 3;
    for (let k = -14; k < 14; k += 7) { ctx.beginPath(); ctx.moveTo(m.x + k, m.y + MINE_R); ctx.lineTo(m.x + k + 9, m.y - MINE_R); ctx.stroke(); }
    ctx.restore();
    const blink = m.t > 7.5 ? Math.sin(m.t * 22) > 0 : Math.sin(m.t * 6) > 0.4;
    ctx.fillStyle = blink ? '#ff3b3b' : '#7a1a1a'; ctx.beginPath(); ctx.arc(m.x, m.y, 3, 0, 7); ctx.fill();
    if (blink) { ctx.fillStyle = 'rgba(255,60,60,.25)'; ctx.beginPath(); ctx.arc(m.x, m.y, 8, 0, 7); ctx.fill(); }
  }
  // tanks
  for (const t of w.tanks) if (t.alive) drawTank(ctx, t, t.id === p2Id, t.team === 'e' && SPEC[t.kind].stealth ? Math.max(0.05, t.seen * 0.9) : 1);
  // shells and rockets with their trail
  for (const s of w.shells) {
    const sp = Math.hypot(s.vx, s.vy), ux = s.vx / sp, uy = s.vy / sp, tail = s.rocket ? 26 : 14;
    const g = ctx.createLinearGradient(s.x, s.y, s.x - ux * tail, s.y - uy * tail);
    g.addColorStop(0, s.rocket ? 'rgba(255,170,60,.9)' : 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = g; ctx.lineWidth = s.rocket ? 5 : 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - ux * tail, s.y - uy * tail); ctx.stroke();
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(Math.atan2(uy, ux));
    ctx.fillStyle = s.rocket ? '#e8eef5' : '#c99a3e'; roundRect(ctx, -5, -2.6, 9, 5.2, 2.6, true);
    ctx.fillStyle = s.rocket ? '#e5484d' : '#8a6420'; ctx.fillRect(-5, -2.6, 2.5, 5.2);
    ctx.restore();
  }
  // explosions
  for (const b of w.booms) {
    const life = b.big ? 0.9 : 0.4, k = b.t / life, r = (b.big ? 62 : 16) * (0.35 + k * 0.8);
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
    g.addColorStop(0, `rgba(255,250,210,${1 - k})`); g.addColorStop(0.35, `rgba(255,170,60,${0.9 * (1 - k)})`); g.addColorStop(0.75, `rgba(200,50,30,${0.5 * (1 - k)})`); g.addColorStop(1, 'rgba(60,40,30,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, 7); ctx.fill();
    if (b.big) { ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - k)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x, b.y, r * 1.25, 0, 7); ctx.stroke(); }
  }
  void TANK_R;
}
/** The aiming aid: dotted line from the barrel to the cross hair. */
export function drawAim(ctx: CanvasRenderingContext2D, t: Tank, mx: number, my: number) {
  ctx.save();
  ctx.setLineDash([3, 7]); ctx.strokeStyle = 'rgba(62,99,221,.55)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(t.x + Math.cos(t.turret) * 26, t.y + Math.sin(t.turret) * 26); ctx.lineTo(mx, my); ctx.stroke();
  ctx.setLineDash([]); ctx.strokeStyle = '#3e63dd'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(mx, my, 9, 0, 7); ctx.stroke();
  for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.beginPath(); ctx.moveTo(mx + a * 5, my + b * 5); ctx.lineTo(mx + a * 14, my + b * 14); ctx.stroke(); }
  ctx.restore();
}
