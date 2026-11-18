// Canvas drawings shared by Snake and its slot machine.
export function drawApple(ctx: CanvasRenderingContext2D, x: number, y: number, c: number, kind: string, ttl: number, clock: number) {
  const r = c * 0.36, cx = x + c / 2, cy = y + c / 2 + c * 0.04;
  if (kind !== 'red' && ttl < 14 && Math.floor(clock * 8) % 2) return; // blink before vanishing
  ctx.save();
  const still = ttl === Infinity; // slot symbol: no glow or sparkles, so it is cropped to the same size as the red apple
  if (still) { /* plain */ } else if (kind === 'cosmic') {
    ctx.translate(cx, cy); ctx.rotate(clock * 1.5); ctx.translate(-cx, -cy);
    ctx.shadowColor = '#a78bff'; ctx.shadowBlur = c * 0.6;
  } else if (kind === 'gold') { ctx.shadowColor = '#ffd45a'; ctx.shadowBlur = c * 0.5; }
  const [hi, mid, lo] = kind === 'red' ? ['#ff9a8c', '#e0262f', '#7e0b14'] : kind === 'gold' ? ['#fff6c4', '#f0b92a', '#8f5a06'] : kind === 'poison' ? ['#d9b8ff', '#7a3fc0', '#2a0b48'] : ['#c4f1ff', '#6a6cf0', '#2a1180'];
  // apple silhouette: two shoulders with a dip for the stem, a full belly and a small dimple at the bottom
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.62);
    ctx.bezierCurveTo(cx + r * 0.32, cy - r * 1.02, cx + r * 1.08, cy - r * 0.98, cx + r * 1.02, cy - r * 0.08);
    ctx.bezierCurveTo(cx + r * 0.98, cy + r * 0.62, cx + r * 0.56, cy + r * 1.02, cx + r * 0.22, cy + r * 0.96);
    ctx.quadraticCurveTo(cx, cy + r * 0.86, cx - r * 0.22, cy + r * 0.96);
    ctx.bezierCurveTo(cx - r * 0.56, cy + r * 1.02, cx - r * 0.98, cy + r * 0.62, cx - r * 1.02, cy - r * 0.08);
    ctx.bezierCurveTo(cx - r * 1.08, cy - r * 0.98, cx - r * 0.32, cy - r * 1.02, cx, cy - r * 0.62);
    ctx.closePath();
  };
  const g = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.36, r * 0.08, cx + r * 0.1, cy + r * 0.1, r * 1.25);
  g.addColorStop(0, hi); g.addColorStop(0.45, mid); g.addColorStop(1, lo);
  ctx.fillStyle = g;
  body(); ctx.fill();
  ctx.shadowBlur = 0;
  // soft shade in the stem dip and a rim light on the right
  ctx.save(); body(); ctx.clip();
  const dip = ctx.createRadialGradient(cx, cy - r * 0.62, 0, cx, cy - r * 0.62, r * 0.42);
  dip.addColorStop(0, 'rgba(0,0,0,.35)'); dip.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = dip; ctx.fillRect(cx - r, cy - r * 1.1, r * 2, r);
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = r * 0.12;
  ctx.beginPath(); ctx.arc(cx - r * 0.1, cy + r * 0.05, r * 0.98, -0.5, 0.9); ctx.stroke();
  ctx.restore();
  // stem and leaf
  ctx.strokeStyle = '#4a2e14'; ctx.lineWidth = Math.max(1.5, r * 0.16); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.58); ctx.quadraticCurveTo(cx + r * 0.02, cy - r * 0.95, cx + r * 0.2, cy - r * 1.22); ctx.stroke();
  const leaf = ctx.createLinearGradient(cx + r * 0.15, cy - r * 1.2, cx + r * 0.95, cy - r * 0.9);
  const [l1, l2] = kind === 'cosmic' ? ['#fff3a8', '#e0a91c'] : ['#8ee26a', '#2f9a3e'];
  leaf.addColorStop(0, l1); leaf.addColorStop(1, l2);
  ctx.fillStyle = leaf;
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.12, cy - r * 0.98);
  ctx.quadraticCurveTo(cx + r * 0.45, cy - r * 1.5, cx + r * 1.0, cy - r * 1.18);
  ctx.quadraticCurveTo(cx + r * 0.6, cy - r * 0.78, cx + r * 0.12, cy - r * 0.98);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = Math.max(1, r * 0.04);
  ctx.beginPath(); ctx.moveTo(cx + r * 0.18, cy - r * 0.99); ctx.quadraticCurveTo(cx + r * 0.55, cy - r * 1.14, cx + r * 0.95, cy - r * 1.17); ctx.stroke();
  // glossy highlight
  const sh = ctx.createLinearGradient(cx - r * 0.7, cy - r * 0.6, cx - r * 0.3, cy + r * 0.1);
  sh.addColorStop(0, 'rgba(255,255,255,.75)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh;
  ctx.beginPath(); ctx.ellipse(cx - r * 0.48, cy - r * 0.22, r * 0.17, r * 0.38, 0.35, 0, 7); ctx.fill();
  if (kind === 'poison') {
    // a little skull: do not eat
    ctx.fillStyle = '#e9ffd9';
    ctx.beginPath(); ctx.arc(cx, cy - r * 0.05, r * 0.36, 0, 7); ctx.fill();
    ctx.fillRect(cx - r * 0.22, cy + r * 0.2, r * 0.44, r * 0.2);
    ctx.fillStyle = '#2a0b48';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + sx * r * 0.14, cy - r * 0.08, r * 0.1, 0, 7); ctx.fill(); }
  } else if (kind !== 'red' && !still) {
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
