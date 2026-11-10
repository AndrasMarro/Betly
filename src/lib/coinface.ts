// Canvas textures for the Betly coin: an embossed crown (heads) and star (tails) on a milled gold face,
// plus the wooden table and felt the coin lands on. Drawn once at runtime, no image files needed.

const gold = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, a: string, b: string, c: string) => {
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r);
  g.addColorStop(0, a); g.addColorStop(0.55, b); g.addColorStop(1, c);
  return g;
};

/** Draw a shape twice, offset dark then light, so it looks struck into the metal. */
function emboss(ctx: CanvasRenderingContext2D, path: (c: CanvasRenderingContext2D) => void, fill: string | CanvasGradient, depth = 6) {
  ctx.save(); ctx.translate(depth, depth); ctx.fillStyle = 'rgba(90,50,0,.55)'; path(ctx); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(-depth / 2, -depth / 2); ctx.fillStyle = 'rgba(255,250,220,.75)'; path(ctx); ctx.fill(); ctx.restore();
  ctx.fillStyle = fill; path(ctx); ctx.fill();
}

function arcText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, r: number, mid: number, bottom: boolean) {
  ctx.save();
  ctx.font = '800 58px "Geist Variable", system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const spread = 0.13;
  const n = text.length;
  for (let i = 0; i < n; i++) {
    const a = mid + (bottom ? -1 : 1) * (i - (n - 1) / 2) * spread;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.rotate(a + (bottom ? -Math.PI / 2 : Math.PI / 2));
    ctx.fillStyle = 'rgba(90,50,0,.5)'; ctx.fillText(text[i], 3, 3);
    ctx.fillStyle = '#fff3c4'; ctx.fillText(text[i], 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

function base(ctx: CanvasRenderingContext2D, S: number) {
  const c = S / 2;
  ctx.fillStyle = gold(ctx, c, c, c, '#fff4bd', '#f0b934', '#a86a10');
  ctx.fillRect(0, 0, S, S);
  // milled outer ring, then a polished channel and a ring of beads
  for (const [r, w, col] of [[c * 0.97, 26, '#c98a1c'], [c * 0.9, 8, '#ffe28a'], [c * 0.7, 6, '#c98a1c'], [c * 0.68, 3, '#fff0b0']] as const) {
    ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke();
  }
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    ctx.beginPath(); ctx.arc(c + Math.cos(a) * c * 0.84, c + Math.sin(a) * c * 0.84, 7, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 ? '#ffe9a3' : '#d99a22'; ctx.fill();
  }
}

export function coinFace(side: 'heads' | 'tails', S = 1024) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  base(ctx, S);
  const c = S / 2;
  const metal = gold(ctx, c, c, c * 0.6, '#fff8d6', '#f4c24a', '#c4841a');
  if (side === 'heads') {
    // crown: band, five points with pearls, three gems
    const k = c * 0.0062;
    const crown = (g: CanvasRenderingContext2D) => {
      g.beginPath();
      g.moveTo(c - 58 * k, c + 30 * k);
      g.lineTo(c - 66 * k, c - 26 * k); g.lineTo(c - 36 * k, c + 2 * k); g.lineTo(c - 18 * k, c - 44 * k);
      g.lineTo(c, c - 4 * k); g.lineTo(c + 18 * k, c - 44 * k); g.lineTo(c + 36 * k, c + 2 * k);
      g.lineTo(c + 66 * k, c - 26 * k); g.lineTo(c + 58 * k, c + 30 * k); g.closePath();
      g.rect(c - 60 * k, c + 32 * k, 120 * k, 20 * k);
    };
    emboss(ctx, crown, metal, 7);
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(120,70,0,.55)'; crown(ctx); ctx.stroke();
    for (const [x, y] of [[-66, -30], [-18, -48], [18, -48], [66, -30], [0, -8]]) {
      ctx.beginPath(); ctx.arc(c + x * k, c + y * k, 7 * k, 0, Math.PI * 2); ctx.fillStyle = '#fff7da'; ctx.fill();
    }
    for (const [x, col] of [[-34, '#2f7de1'], [0, '#e5484d'], [34, '#2fbf71']] as const) {
      ctx.beginPath(); ctx.arc(c + x * k, c + 42 * k, 8 * k, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      ctx.beginPath(); ctx.arc(c + x * k - 2.5 * k, c + 39 * k, 2.5 * k, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fill();
    }
    arcText(ctx, 'BETLY', c, c, c * 0.53, -Math.PI / 2, false);
    arcText(ctx, '★ ★ ★', c, c, c * 0.53, Math.PI / 2, true);
  } else {
    // five-point star with faceted halves
    const star = (g: CanvasRenderingContext2D) => {
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? c * 0.17 : c * 0.4, a = -Math.PI / 2 + (i * Math.PI) / 5;
        g[i ? 'lineTo' : 'moveTo'](c + Math.cos(a) * r, c + Math.sin(a) * r);
      }
      g.closePath();
    };
    emboss(ctx, star, metal, 8);
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(120,70,0,.55)'; star(ctx); ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5, b = a + Math.PI / 5;
      ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c + Math.cos(a) * c * 0.4, c + Math.sin(a) * c * 0.4); ctx.lineTo(c + Math.cos(b) * c * 0.17, c + Math.sin(b) * c * 0.17); ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,230,.35)'; ctx.fill();
    }
    arcText(ctx, 'BETLY', c, c, c * 0.53, -Math.PI / 2, false);
    arcText(ctx, '1 CREDIT', c, c, c * 0.53, Math.PI / 2, true);
  }
  return cv;
}

/** Warm wooden table with a round green felt mat in the middle. */
export function tableTop(S = 1024) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  const planks = 6, pw = S / planks;
  for (let p = 0; p < planks; p++) {
    const hue = 24 + (p % 3) * 3, light = 26 + ((p * 37) % 7);
    ctx.fillStyle = `hsl(${hue} 45% ${light}%)`;
    ctx.fillRect(p * pw, 0, pw, S);
    for (let i = 0; i < 70; i++) {
      const y = Math.random() * S;
      ctx.strokeStyle = `hsla(${hue} 40% ${light - 8 + Math.random() * 14}% / .35)`;
      ctx.lineWidth = 1 + Math.random() * 2.5;
      ctx.beginPath(); ctx.moveTo(p * pw + 2, y);
      ctx.bezierCurveTo(p * pw + pw * 0.3, y + (Math.random() - 0.5) * 30, p * pw + pw * 0.7, y + (Math.random() - 0.5) * 30, p * pw + pw - 2, y + (Math.random() - 0.5) * 20);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(p * pw, 0, 3, S);
  }
  // felt mat with a gold stitched border
  const c = S / 2, r = S * 0.3;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 30;
  const felt = ctx.createRadialGradient(c, c, r * 0.1, c, c, r);
  felt.addColorStop(0, '#155c3e'); felt.addColorStop(1, '#0a3423');
  ctx.fillStyle = felt; ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  const img = ctx.getImageData(c - r, c - r, r * 2, r * 2), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  ctx.putImageData(img, c - r, c - r);
  ctx.setLineDash([10, 8]); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(232,196,120,.75)';
  ctx.beginPath(); ctx.arc(c, c, r - 16, 0, Math.PI * 2); ctx.stroke();
  return cv;
}
