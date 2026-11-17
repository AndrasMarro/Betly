// Canvas drawings shared by Snake and its slot machine.
export function drawApple(ctx: CanvasRenderingContext2D, x: number, y: number, c: number, kind: string, ttl: number, clock: number) {
  const r = c * 0.36, cx = x + c / 2, cy = y + c / 2 + c * 0.04;
  if (kind !== 'red' && ttl < 14 && Math.floor(clock * 8) % 2) return; // blink before vanishing
  ctx.save();
  if (kind === 'cosmic') {
    ctx.translate(cx, cy); ctx.rotate(clock * 1.5); ctx.translate(-cx, -cy);
    ctx.shadowColor = '#a78bff'; ctx.shadowBlur = c * 0.6;
  } else if (kind === 'gold') { ctx.shadowColor = '#ffd45a'; ctx.shadowBlur = c * 0.5; }
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.1);
  const [a, b] = kind === 'red' ? ['#ff7a72', '#c0141f'] : kind === 'gold' ? ['#fff3b0', '#d39a12'] : kind === 'poison' ? ['#c9a2ff', '#3b1460'] : ['#9be8ff', '#6a2bd9'];
  g.addColorStop(0, a); g.addColorStop(1, b);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.7);
  ctx.bezierCurveTo(cx + r * 1.2, cy - r * 1.3, cx + r * 1.35, cy + r * 0.6, cx, cy + r);
  ctx.bezierCurveTo(cx - r * 1.35, cy + r * 0.6, cx - r * 1.2, cy - r * 1.3, cx, cy - r * 0.7);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = Math.max(1.5, c * 0.07); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.6); ctx.lineTo(cx + r * 0.15, cy - r * 1.15); ctx.stroke();
  ctx.fillStyle = kind === 'cosmic' ? '#ffe17a' : '#3fbf5a';
  ctx.beginPath(); ctx.ellipse(cx + r * 0.5, cy - r * 1.0, r * 0.38, r * 0.17, -0.5, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath(); ctx.ellipse(cx - r * 0.42, cy - r * 0.15, r * 0.13, r * 0.26, 0.3, 0, 7); ctx.fill();
  if (kind === 'poison') {
    // a little skull: do not eat
    ctx.fillStyle = '#e9ffd9';
    ctx.beginPath(); ctx.arc(cx, cy - r * 0.05, r * 0.36, 0, 7); ctx.fill();
    ctx.fillRect(cx - r * 0.22, cy + r * 0.2, r * 0.44, r * 0.2);
    ctx.fillStyle = '#3b1460';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + sx * r * 0.14, cy - r * 0.08, r * 0.1, 0, 7); ctx.fill(); }
  } else if (kind !== 'red') {
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 3; i++) {
      const t = clock * 2 + i * 2.1, sx = cx + Math.cos(t) * r * 1.25, sy = cy + Math.sin(t * 1.3) * r * 1.1, s = c * 0.05 * (1 + Math.sin(t * 3));
      ctx.fillRect(sx - s, sy - s * 0.25, s * 2, s * 0.5); ctx.fillRect(sx - s * 0.25, sy - s, s * 0.5, s * 2);
    }
  }
  ctx.restore();
}

/** The snake's head, looking right: rounded green snout, eyes and a tongue. */
export function drawHead(ctx: CanvasRenderingContext2D, x: number, y: number, c: number) {
  const g = ctx.createLinearGradient(x, y, x, y + c);
  g.addColorStop(0, '#5fd987'); g.addColorStop(1, '#1f7a45');
  ctx.fillStyle = '#e5484d'; ctx.fillRect(x + c * 0.86, y + c * 0.48, c * 0.12, c * 0.04);
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x + c * 0.08, y + c * 0.18, c * 0.8, c * 0.64, c * 0.3); ctx.fill();
  for (const ey of [0.34, 0.66]) {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + c * 0.6, y + c * ey, c * 0.1, 0, 7); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x + c * 0.63, y + c * ey, c * 0.05, 0, 7); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(x + c * 0.3, y + c * 0.3, c * 0.14, c * 0.06, 0, 0, 7); ctx.fill();
}
/** A stone wall block. */
export function drawWall(ctx: CanvasRenderingContext2D, x: number, y: number, c: number) {
  ctx.fillStyle = '#6b6f7a'; ctx.fillRect(x + 1, y + 1, c - 2, c - 2);
  ctx.fillStyle = '#8b909c'; ctx.fillRect(x + 1, y + 1, c - 2, c * 0.18);
  ctx.fillStyle = '#4b4e57'; ctx.fillRect(x + 1, y + c * 0.82, c - 2, c * 0.18 - 1);
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = Math.max(1, c * 0.02);
  ctx.beginPath(); ctx.moveTo(x + c / 2, y + c * 0.2); ctx.lineTo(x + c / 2, y + c * 0.5); ctx.moveTo(x + 2, y + c * 0.5); ctx.lineTo(x + c - 2, y + c * 0.5); ctx.moveTo(x + c * 0.3, y + c * 0.5); ctx.lineTo(x + c * 0.3, y + c * 0.82); ctx.stroke();
}
