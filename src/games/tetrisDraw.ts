// Drawing the well and the blocks on a canvas (shared by the main board, the opponents and the previews).
import { W, H, cells, colorOf, type Kind } from './tetris';

const COLORS = ['', '#36d6e7', '#f6d23a', '#a35cf0', '#46d36b', '#ef4b5a', '#3d7cf0', '#f39a2b', '#6b6f7a'];
const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16), f = (v: number) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

/** One block with a bevel: light top-left edge, dark bottom-right edge and a soft shine. */
export function block(g: CanvasRenderingContext2D, x: number, y: number, s: number, v: number, alpha = 1) {
  const c = COLORS[v];
  if (!c) return;
  g.globalAlpha = alpha;
  const e = Math.max(1, s * 0.14);
  g.fillStyle = c; g.fillRect(x, y, s, s);
  g.fillStyle = shade(c, 0.45);
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + s, y); g.lineTo(x + s - e, y + e); g.lineTo(x + e, y + e); g.lineTo(x + e, y + s - e); g.lineTo(x, y + s); g.fill();
  g.fillStyle = shade(c, -0.35);
  g.beginPath(); g.moveTo(x + s, y + s); g.lineTo(x, y + s); g.lineTo(x + e, y + s - e); g.lineTo(x + s - e, y + s - e); g.lineTo(x + s - e, y + e); g.lineTo(x + s, y); g.fill();
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + e, y + e, (s - 2 * e) * 0.45, (s - 2 * e) * 0.3);
  g.globalAlpha = 1;
}

/** The empty well: dark glass with a faint grid. */
export function well(g: CanvasRenderingContext2D, s: number) {
  const bg = g.createLinearGradient(0, 0, 0, H * s);
  bg.addColorStop(0, '#141a33'); bg.addColorStop(1, '#0a0e1f');
  g.fillStyle = bg; g.fillRect(0, 0, W * s, H * s);
  g.strokeStyle = 'rgba(255,255,255,.045)'; g.lineWidth = 1;
  g.beginPath();
  for (let x = 1; x < W; x++) { g.moveTo(x * s + 0.5, 0); g.lineTo(x * s + 0.5, H * s); }
  for (let y = 1; y < H; y++) { g.moveTo(0, y * s + 0.5); g.lineTo(W * s, y * s + 0.5); }
  g.stroke();
}

/** A board given as W×H cell values (array or digit string), drawn whole. */
export function board(g: CanvasRenderingContext2D, b: ArrayLike<number | string>, s: number, dim = false) {
  well(g, s);
  for (let i = 0; i < W * H; i++) { const v = +b[i]; if (v) block(g, (i % W) * s, Math.floor(i / W) * s, s, v, dim ? 0.45 : 1); }
}

/** A piece centred in a small box (next queue, hold). */
export function preview(g: CanvasRenderingContext2D, k: Kind, cx: number, cy: number, s: number, alpha = 1) {
  const cs = cells(k, 0), xs = cs.map((c) => c[0]), ys = cs.map((c) => c[1]);
  const w = (Math.max(...xs) - Math.min(...xs) + 1) * s, h = (Math.max(...ys) - Math.min(...ys) + 1) * s;
  for (const [x, y] of cs) block(g, cx - w / 2 + (x - Math.min(...xs)) * s, cy - h / 2 + (y - Math.min(...ys)) * s, s, colorOf(k), alpha);
}
