// Drawing for Retro Crossy Run in an oblique voxel look: everything is stacked boxes (a top face and a front face)
// that cast a hard shadow to the bottom right. Shared by the game and the lobby art.
import { BREAK, SINK, warning, type Item, type Lane } from './crossy';

/** Animation time in seconds; whoever draws sets it every frame. */
export const art = { clock: 0 };

export const CAR = ['#ff5a5f', '#ffb000', '#3d9bff', '#9b5cff', '#2fbf71', '#ff7ab8'];
export function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, d: number, h: number, top: string, side: string) {
  ctx.fillStyle = side; ctx.fillRect(x, y + d - h, w, h);
  ctx.fillStyle = top; ctx.fillRect(x, y - h, w, d);
}
export const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16), f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

// Props on the grass, drawn in the same box style as the trees and cars. Coordinates are in cell units:
// x and z are the left and back edge of the footprint, w and d its size, h the height, e a lift above the ground.
// Every prop casts one shadow first, then its boxes are stacked bottom to top, back to front.
export function prop(ctx: CanvasRenderingContext2D, k: string, X: number, Y: number, C: number, j = 0.5) {
  const small = !['bush', 'rock', 'stone1', 'stone2', 'stump', 'crate', 'shop', 'fence', 'barrier', 'pine', 'hay', 'boulder', 'lamp', 'house'].includes(k);
  if (small) { X += (j - 0.5) * C * 0.4; Y += (j - 0.5) * C * 0.18; }
  const S = (x: number, z: number, w: number, d: number, h: number) => castBox(ctx, X + x * C, Y + z * C, w * C, d * C, h * C);
  const B = (x: number, z: number, w: number, d: number, h: number, top: string, side: string, e = 0) => box(ctx, X + x * C, Y + (z - e) * C, w * C, d * C, h * C, top, side);
  const R = (x: number, sy: number, w: number, h: number, col: string) => { ctx.fillStyle = col; ctx.fillRect(X + x * C, Y + sy * C, w * C, h * C); };
  const LEAF = ['#5fae3c', '#3f8429'], WOOD = ['#b07a46', '#7a4f2a'], STONE = ['#b8bcc6', '#8d929e'], STONE2 = ['#cfd2da', '#a3a7b1'];
  switch (k) {
    case 'bush':
      S(0.1, 0.22, 0.8, 0.58, 0.78);
      B(0.1, 0.22, 0.8, 0.58, 0.38, '#4f9e34', '#356f22');
      B(0.2, 0.3, 0.6, 0.42, 0.22, '#5cb23d', '#3f8429', 0.38);
      B(0.32, 0.38, 0.36, 0.28, 0.16, '#6cc046', '#4a9330', 0.6);
      R(0.16, 0.5, 0.06, 0.06, '#6cc046'); R(0.66, 0.6, 0.06, 0.06, '#6cc046'); R(0.4, 0.66, 0.05, 0.05, '#2a5c1c');
      break;
    case 'rock': case 'stone1':
      S(0.12, 0.35, 0.72, 0.45, 0.52);
      B(0.12, 0.35, 0.72, 0.45, 0.3, STONE[0], STONE[1]);
      B(0.22, 0.42, 0.42, 0.3, 0.22, STONE2[0], STONE2[1], 0.3);
      R(0.3, 0.62, 0.12, 0.04, '#7c818c');
      break;
    case 'stone2':
      S(0.08, 0.42, 0.84, 0.4, 0.38);
      B(0.08, 0.42, 0.84, 0.4, 0.24, STONE[0], STONE[1]);
      B(0.3, 0.47, 0.42, 0.28, 0.14, STONE2[0], STONE2[1], 0.24);
      break;
    case 'stump':
      S(0.2, 0.38, 0.6, 0.42, 0.42);
      B(0.1, 0.62, 0.16, 0.16, 0.1, '#8a5a32', '#6b4426');
      B(0.74, 0.6, 0.16, 0.16, 0.1, '#8a5a32', '#6b4426');
      B(0.22, 0.38, 0.56, 0.42, 0.42, '#c08a52', '#7a4a26');
      // year rings on the cut
      R(0.3, 0.0, 0.4, 0.3, '#a8743f'); R(0.38, 0.06, 0.24, 0.18, '#c99a62'); R(0.46, 0.11, 0.08, 0.07, '#a8743f');
      R(0.32, 0.5, 0.04, 0.24, '#5e381c'); R(0.6, 0.46, 0.04, 0.3, '#5e381c');
      break;
    case 'crate': {
      S(0.17, 0.3, 0.66, 0.5, 0.62);
      B(0.17, 0.3, 0.66, 0.5, 0.62, '#c08a55', '#9a6533');
      // planks: a frame and a diagonal brace on the front, an inset lid on top
      ctx.strokeStyle = '#5e3b1c'; ctx.lineWidth = Math.max(1.5, C * 0.04);
      const fx = X + 0.17 * C, fy = Y + 0.18 * C, fw = 0.66 * C, fh = 0.62 * C, i = C * 0.06;
      ctx.strokeRect(fx + i, fy + i, fw - 2 * i, fh - 2 * i);
      ctx.beginPath(); ctx.moveTo(fx + i, fy + fh - i); ctx.lineTo(fx + fw - i, fy + i); ctx.stroke();
      R(0.25, -0.24, 0.5, 0.34, '#a8743f');
      break;
    }
    case 'fence':
      S(0, 0.45, 1, 0.1, 0.7);
      B(0.08, 0.45, 0.1, 0.1, 0.7, WOOD[0], WOOD[1]);
      B(0.82, 0.45, 0.1, 0.1, 0.7, WOOD[0], WOOD[1]);
      B(0, 0.47, 1, 0.06, 0.12, '#c08a55', '#8a5a32', 0.2);
      B(0, 0.47, 1, 0.06, 0.12, '#c08a55', '#8a5a32', 0.48);
      R(0.3, 0.13, 0.08, 0.03, '#7a4f2a'); R(0.6, -0.15, 0.08, 0.03, '#7a4f2a');
      break;
    case 'barrier':
      S(0, 0.48, 1, 0.12, 0.66);
      for (const lx of [0.1, 0.78]) { B(lx - 0.04, 0.46, 0.2, 0.16, 0.05, '#7c818c', '#5c616b'); B(lx, 0.5, 0.08, 0.08, 0.62, '#9aa0aa', '#6c727c'); }
      for (const e of [0.2, 0.46]) for (let i = 0; i < 5; i++) B(i * 0.2, 0.48, 0.2, 0.06, 0.16, i % 2 ? '#f4f4f4' : '#e0393e', i % 2 ? '#c9c9cf' : '#a8242a', e);
      break;
    case 'shop':
      S(0.04, 0.22, 0.92, 0.58, 1.05);
      B(0.08, 0.24, 0.06, 0.06, 0.95, '#8a5a32', '#6b4426');
      B(0.86, 0.24, 0.06, 0.06, 0.95, '#8a5a32', '#6b4426');
      B(0.06, 0.4, 0.88, 0.4, 0.42, '#e0b07a', '#b5814b');
      for (const px of [0.28, 0.5, 0.72]) R(px, 0.4, 0.02, 0.38, '#94643a');
      R(0.1, 0.0, 0.8, 0.08, '#c99a62');
      B(0.08, 0.74, 0.06, 0.06, 0.95, '#8a5a32', '#6b4426');
      B(0.86, 0.74, 0.06, 0.06, 0.95, '#8a5a32', '#6b4426');
      // striped awning with a scalloped edge
      for (let i = 0; i < 5; i++) B(i * 0.2, 0.18, 0.2, 0.64, 0.08, i % 2 ? '#f4f4f4' : '#e04848', i % 2 ? '#cfcfd6' : '#a83232', 0.95);
      for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? '#cfcfd6' : '#a83232'; ctx.beginPath(); ctx.arc(X + (i * 0.2 + 0.1) * C, Y + (0.82 - 0.95) * C, C * 0.1, 0, Math.PI); ctx.fill(); }
      break;
    case 'cone':
      S(0.3, 0.55, 0.4, 0.25, 0.45);
      B(0.28, 0.55, 0.44, 0.26, 0.05, '#ff8a2a', '#d0651a');
      B(0.38, 0.6, 0.24, 0.16, 0.12, '#ff8a2a', '#d0651a', 0.05);
      B(0.4, 0.61, 0.2, 0.14, 0.1, '#f6f6f6', '#cfcfcf', 0.17);
      B(0.42, 0.62, 0.16, 0.12, 0.1, '#ff8a2a', '#d0651a', 0.27);
      B(0.44, 0.63, 0.12, 0.1, 0.08, '#f6f6f6', '#cfcfcf', 0.37);
      break;
    case 'sign': {
      S(0.47, 0.62, 0.06, 0.06, 1.0);
      B(0.47, 0.62, 0.06, 0.06, 0.62, STONE[0], STONE[1]);
      const cx = X + 0.5 * C, top = Y + (0.68 - 1.04) * C, bot = Y + (0.68 - 0.58) * C, hw = 0.24 * C;
      const tri = (dx: number, dy: number, k2: number, col: string) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx + dx, top + dy + (bot - top) * (1 - k2)); ctx.lineTo(cx + dx + hw * k2, bot + dy); ctx.lineTo(cx + dx - hw * k2, bot + dy); ctx.closePath(); ctx.fill(); };
      tri(C * 0.03, C * 0.03, 1, '#8a1a1e');
      tri(0, 0, 1, '#e0393e');
      tri(0, -C * 0.03, 0.66, '#f6f6f6');
      ctx.fillStyle = '#1c1c22'; ctx.fillRect(cx - C * 0.025, bot - C * 0.27, C * 0.05, C * 0.13); ctx.fillRect(cx - C * 0.025, bot - C * 0.11, C * 0.05, C * 0.05);
      break;
    }
    case 'mushroom':
      S(0.34, 0.55, 0.32, 0.22, 0.38);
      B(0.43, 0.58, 0.14, 0.12, 0.18, '#f4ead8', '#d6c6a6');
      B(0.32, 0.52, 0.36, 0.26, 0.12, '#d8323a', '#a0202a', 0.18);
      B(0.38, 0.56, 0.24, 0.18, 0.08, '#e2444b', '#b0262f', 0.3);
      R(0.36, 0.42, 0.06, 0.05, '#fff'); R(0.56, 0.4, 0.06, 0.05, '#fff'); R(0.46, 0.2, 0.06, 0.05, '#fff'); R(0.4, 0.2, 0.04, 0.04, '#fff');
      break;
    case 'flowers': case 'flowers2': {
      const daisy = k === 'flowers2';
      const spots: [number, number, number][] = daisy ? [[0.3, 0.6, 0.16], [0.52, 0.52, 0.22], [0.6, 0.66, 0.12]] : [[0.18, 0.56, 0.22], [0.34, 0.66, 0.14], [0.46, 0.5, 0.26], [0.6, 0.62, 0.18], [0.74, 0.54, 0.24], [0.28, 0.46, 0.2]];
      spots.forEach(([fx, fz, h], i) => {
        const col = daisy ? ['#f6f6f6', '#cfcfd6'] : i % 3 === 1 ? ['#ffd23f', '#d8a520'] : ['#e0453b', '#a8242a'];
        S(fx, fz, 0.04, 0.04, h + 0.06);
        B(fx, fz, 0.04, 0.04, h, '#4f9a33', '#3c7d27');
        B(fx - 0.05, fz - 0.02, 0.14, 0.08, 0.06, col[0], col[1], h);
        R(fx - 0.005, fz - h - 0.06, 0.05, 0.04, daisy ? '#ffd23f' : '#fff3b0');
      });
      if (daisy) B(0.36, 0.64, 0.24, 0.08, 0.06, LEAF[0], LEAF[1]);
      break;
    }
    case 'flower1':
      S(0.42, 0.6, 0.16, 0.1, 0.42);
      B(0.4, 0.6, 0.2, 0.12, 0.16, LEAF[0], LEAF[1]);
      B(0.48, 0.62, 0.04, 0.04, 0.3, '#4f9a33', '#3c7d27');
      B(0.44, 0.6, 0.12, 0.08, 0.1, '#e0453b', '#a8242a', 0.3);
      R(0.48, 0.18, 0.04, 0.03, '#ffd23f');
      break;
    case 'grass': case 'tuft': {
      const blades: [number, number][] = k === 'tuft' ? [[0.3, 0.42], [0.38, 0.3], [0.46, 0.5], [0.54, 0.36], [0.62, 0.46], [0.42, 0.22], [0.68, 0.26]] : [[0.3, 0.2], [0.4, 0.3], [0.5, 0.16], [0.58, 0.26], [0.66, 0.14]];
      S(0.3, 0.64, 0.4, 0.04, k === 'tuft' ? 0.4 : 0.22);
      blades.forEach(([bx, h], i) => B(bx, 0.62 + (i % 2) * 0.03, 0.04, 0.04, h, i % 3 ? '#7fd85a' : '#5fae3c', i % 3 ? '#4fa534' : '#3f8429'));
      break;
    }
    case 'fern':
      S(0.16, 0.56, 0.68, 0.14, 0.05);
      B(0.16, 0.58, 0.68, 0.1, 0.04, '#2f7a3a', '#235c2c');
      B(0.45, 0.4, 0.1, 0.44, 0.04, '#2f7a3a', '#235c2c');
      for (const fx of [0.22, 0.34, 0.6, 0.72]) B(fx, 0.55, 0.06, 0.16, 0.04, '#3a8f46', '#2a6b33');
      break;
    case 'pebble1': S(0.4, 0.62, 0.2, 0.12, 0.1); B(0.4, 0.62, 0.2, 0.12, 0.08, STONE[0], STONE[1]); B(0.44, 0.64, 0.1, 0.08, 0.05, STONE2[0], STONE2[1], 0.08); break;
    case 'pebble2': S(0.44, 0.64, 0.12, 0.08, 0.07); B(0.44, 0.64, 0.12, 0.08, 0.06, STONE[0], STONE[1]); break;
    case 'pine': {
      S(0.12, 0.3, 0.76, 0.54, 1.55);
      B(0.42, 0.62, 0.16, 0.14, 0.32, '#8a5a32', '#6b4426');
      const tiers: [number, number, number][] = [[0.76, 0.54, 0.25], [0.58, 0.42, 0.6], [0.4, 0.3, 0.95], [0.2, 0.16, 1.28]];
      tiers.forEach(([w, d, e], n) => B(0.5 - w / 2, 0.57 - d / 2, w, d, 0.32, n % 2 ? '#2f8f4c' : '#3aa057', n % 2 ? '#1f6634' : '#287a3f', e));
      R(0.3, 0.2, 0.06, 0.06, '#5cc77a'); R(0.58, -0.2, 0.05, 0.05, '#5cc77a');
      break;
    }
    case 'hay':
      S(0.1, 0.3, 0.8, 0.5, 0.52);
      B(0.1, 0.3, 0.8, 0.5, 0.52, '#ecc65c', '#c99c34');
      for (const ly of [0.42, 0.56, 0.7]) R(0.12, ly, 0.76, 0.02, 'rgba(140,96,20,.45)');
      for (const ly of [-0.12, 0.02, 0.16]) R(0.14, ly, 0.72, 0.02, 'rgba(180,130,40,.35)');
      for (const tx of [0.3, 0.64]) R(tx, -0.22, 0.04, 1.02, '#9a6a26');
      break;
    case 'boulder':
      S(0.02, 0.24, 0.96, 0.58, 0.9);
      B(0.02, 0.32, 0.96, 0.5, 0.45, STONE[0], STONE[1]);
      B(0.12, 0.28, 0.74, 0.44, 0.3, STONE2[0], STONE2[1], 0.45);
      B(0.28, 0.34, 0.4, 0.28, 0.16, '#dfe2e8', '#b6bac4', 0.75);
      R(0.14, -0.08, 0.2, 0.1, '#6aa84a'); R(0.6, -0.36, 0.14, 0.08, '#6aa84a'); R(0.3, 0.5, 0.1, 0.05, '#7c818c');
      break;
    case 'lamp': {
      S(0.44, 0.6, 0.1, 0.1, 1.55);
      B(0.38, 0.56, 0.22, 0.18, 0.08, '#4a505c', '#30343d');
      B(0.45, 0.61, 0.08, 0.08, 1.45, '#3a3f4a', '#262a32', 0.08);
      B(0.45, 0.6, 0.28, 0.06, 0.05, '#3a3f4a', '#262a32', 1.48);
      const on = 0.85 + 0.15 * Math.sin(art.clock * 2);
      const gx = X + 0.68 * C, gy = Y + (0.66 - 1.4) * C, g = ctx.createRadialGradient(gx, gy, 0, gx, gy, C * 0.6);
      g.addColorStop(0, `rgba(255,236,160,${0.55 * on})`); g.addColorStop(1, 'rgba(255,236,160,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(gx, gy, C * 0.6, 0, 7); ctx.fill();
      B(0.6, 0.58, 0.18, 0.12, 0.1, '#4a505c', '#30343d', 1.4);
      R(0.62, 0.58 + 0.12 - 1.4, 0.14, 0.05, '#fff1b8');
      break;
    }
    case 'house': {
      // two cells wide: walls, door and windows on the front, a stepped tiled roof and a chimney
      S(0.04, 0.16, 1.92, 0.66, 1.3);
      B(0.08, 0.22, 1.84, 0.58, 0.72, '#f3e6cc', '#d9c4a0');
      R(0.86, 0.38, 0.28, 0.42, '#7a4a26'); R(1.08, 0.58, 0.03, 0.04, '#e8c35a');
      for (const wx of [0.26, 1.42]) { R(wx - 0.03, 0.27, 0.36, 0.28, '#fff'); R(wx, 0.3, 0.3, 0.22, '#8fd0f5'); R(wx + 0.14, 0.3, 0.02, 0.22, '#fff'); }
      B(0.0, 0.14, 2.0, 0.74, 0.1, '#d8504a', '#a83a35', 0.72);
      B(0.14, 0.22, 1.72, 0.58, 0.14, '#e05f58', '#b3443e', 0.82);
      B(1.4, 0.28, 0.18, 0.16, 0.42, '#a8704f', '#7a4f35', 0.82);
      B(0.3, 0.3, 1.4, 0.42, 0.14, '#e86a62', '#bf4c45', 0.96);
      B(0.5, 0.4, 1.0, 0.22, 0.1, '#f07a72', '#c4544c', 1.1);
      break;
    }
    case 'hydrant':
      S(0.4, 0.6, 0.2, 0.16, 0.44);
      B(0.38, 0.6, 0.24, 0.18, 0.05, '#b02626', '#7f1a1a');
      B(0.42, 0.62, 0.16, 0.14, 0.3, '#e03a3a', '#a82424', 0.05);
      B(0.34, 0.66, 0.32, 0.06, 0.07, '#e03a3a', '#a82424', 0.17);
      B(0.44, 0.63, 0.12, 0.12, 0.07, '#f2c94c', '#c9a030', 0.35);
      break;
  }
}
/** The betly coin as a blocky gold disc; spin squeezes it, the thickness shows on the right. */
export function coinShape(ctx: CanvasRenderingContext2D, cx: number, bottom: number, h: number, spin: number) {
  const w = h * 0.8 * spin, t = h * 0.12 * (1 - spin * 0.6), y = bottom - h;
  const oct = (x: number, yy: number, ww: number, hh: number, col: string) => {
    const c = Math.min(ww, hh) * 0.28;
    ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(x + c, yy); ctx.lineTo(x + ww - c, yy); ctx.lineTo(x + ww, yy + c); ctx.lineTo(x + ww, yy + hh - c); ctx.lineTo(x + ww - c, yy + hh); ctx.lineTo(x + c, yy + hh); ctx.lineTo(x, yy + hh - c); ctx.lineTo(x, yy + c); ctx.closePath(); ctx.fill();
  };
  oct(cx - w / 2 + t, y, w, h, '#b8800f');
  oct(cx - w / 2, y, w, h, '#f2b01e');
  oct(cx - w / 2 + w * 0.16, y + h * 0.13, w * 0.68, h * 0.74, '#ffd84a');
  ctx.fillStyle = '#e0a21a'; ctx.fillRect(cx - w * 0.07, y + h * 0.3, w * 0.14, h * 0.4);
  ctx.fillStyle = '#fff6c0'; ctx.fillRect(cx - w * 0.3, y + h * 0.2, w * 0.1, h * 0.14);
}
// Shadows: light comes from the top left, so everything casts a flat, hard-edged shadow to the bottom right
// that starts right at its base (the footprint of each box, shifted).
export const SHADOW = 'rgba(0,0,0,.24)';
export function castBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, d: number, h: number) {
  const s = h * 0.45, t = h * 0.12;
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w + s, y + t); ctx.lineTo(x + w + s, y + d + t); ctx.lineTo(x + s, y + d + t); ctx.lineTo(x, y + d);
  ctx.closePath(); ctx.fill();
}
export function drawFlag(ctx: CanvasRenderingContext2D, x: number, y: number, C: number) {
  castBox(ctx, x - C * 0.03, y + C * 0.74, C * 0.06, C * 0.06, C * 1.35);
  ctx.fillStyle = '#e8e8ee'; ctx.fillRect(x - C * 0.03, y - C * 0.55, C * 0.06, C * 1.35);
  const wave = Math.sin(art.clock * 5) * C * 0.05;
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.moveTo(x + C * 0.03, y - C * 0.55); ctx.lineTo(x + C * 0.45 + wave, y - C * 0.4); ctx.lineTo(x + C * 0.03, y - C * 0.25); ctx.closePath(); ctx.fill();
}
export function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, C: number) {
  const bob = Math.sin(art.clock * 3) * C * 0.06, spin = Math.abs(Math.cos(art.clock * 2.2)) * 0.6 + 0.4;
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(x + C / 2, y + C * 0.72, C * 0.22, C * 0.07, 0, 0, 7); ctx.fill();
  ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = C * 0.4;
  coinShape(ctx, x + C / 2, y + C * 0.62 + bob, C * 0.62, spin);
  ctx.shadowBlur = 0;
}
export function drawPad(ctx: CanvasRenderingContext2D, x: number, y: number, C: number, r: number) {
  const cx = x + C / 2, cy = y + C * 0.52, a = (r * 1.7 + x) % 6.28;
  ctx.fillStyle = '#2f8a3a'; ctx.beginPath(); ctx.ellipse(cx, cy + 2, C * 0.42, C * 0.3, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#4fbf55'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.ellipse(cx, cy, C * 0.42, C * 0.3, 0, a + 0.35, a + 6.0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(30,90,40,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a + 3) * C * 0.3, cy + Math.sin(a + 3) * C * 0.2); ctx.stroke();
  if ((r + Math.round(x / C)) % 3 === 0) { ctx.fillStyle = '#ff8fb8'; ctx.beginPath(); ctx.arc(cx + C * 0.16, cy - C * 0.06, C * 0.08, 0, 7); ctx.fill(); ctx.fillStyle = '#ffe0ec'; ctx.beginPath(); ctx.arc(cx + C * 0.16, cy - C * 0.08, C * 0.04, 0, 7); ctx.fill(); }
}
export function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, C: number, rock: boolean) {
  castBox(ctx, x + C * 0.1, y + C * 0.15, C * 0.8, C * 0.65, rock ? C * 0.35 : C * 1.0);
  if (rock) { box(ctx, x + C * 0.15, y + C * 0.2, C * 0.7, C * 0.6, C * 0.35, '#b8bcc6', '#8d929e'); return; }
  box(ctx, x + C * 0.38, y + C * 0.45, C * 0.24, C * 0.25, C * 0.35, '#8a5a32', '#6b4426');
  box(ctx, x + C * 0.1, y + C * 0.15, C * 0.8, C * 0.65, C * 0.65, '#5fbf3e', '#3f8f2a');
  box(ctx, x + C * 0.25, y + C * 0.2, C * 0.5, C * 0.45, C * 1.0, '#7fd85a', '#4fa534');
}
export function drawLog(ctx: CanvasRenderingContext2D, it: Item, y: number, C: number) {
  const x = it.x * C, w = it.len * C;
  if (!it.weak) {
    box(ctx, x + 2, y + C * 0.2, w - 4, C * 0.6, C * 0.18, '#a8703f', '#7a4f2a');
    ctx.fillStyle = '#c99764'; ctx.fillRect(x + 2, y + C * 0.02, C * 0.18, C * 0.6); ctx.fillRect(x + w - 2 - C * 0.18, y + C * 0.02, C * 0.18, C * 0.6);
    ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let k = C * 0.6; k < w - C * 0.4; k += C * 0.7) ctx.fillRect(x + k, y + C * 0.1, 2, C * 0.45);
    return;
  }
  // cracked log: dry, pale wood already split into pieces (dark jagged seams, splinters, a warning mark).
  // Stepped on, it shakes and the seams open; then the pieces drift apart, tip over and sink with ripples.
  const t = it.breakT, n = Math.max(2, Math.round(it.len));
  const k = t === undefined ? 0 : Math.min(1, t / BREAK);
  const s = t !== undefined && t > BREAK ? Math.min(1, (t - BREAK) / (SINK - BREAK)) : 0;
  const ease = 1 - (1 - s) ** 3;
  const seg = (w - 4) / n;
  const pieces = Array.from({ length: n }, (_, i) => {
    const mid = i - (n - 1) / 2;
    const jit = t !== undefined && !s ? Math.sin(t * 55 + i * 2.1) * C * 0.035 * (0.3 + k) : 0;
    return { i, cx: x + 2 + i * seg + seg / 2 + mid * C * 0.45 * ease + jit, cy: y + C * 0.5 + k * C * 0.025 * (i % 2 ? 1 : -1) + s * C * 0.22, rot: (i % 2 ? 1 : -1) * 0.22 * ease + mid * 0.04 * k };
  });
  // ripples spread under the pieces while they go down
  if (s) for (const pc of pieces) {
    ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - s)})`; ctx.lineWidth = Math.max(1.5, C * 0.035);
    for (const d of [0, 0.4]) {
      const rr = Math.max(0, s - d) / (1 - d);
      if (rr > 0) { ctx.beginPath(); ctx.ellipse(pc.cx, y + C * 0.66, seg * 0.35 + C * 0.4 * rr, C * (0.1 + 0.12 * rr), 0, 0, 7); ctx.stroke(); }
    }
  }
  const gap = C * 0.035 + C * 0.05 * k;
  for (const { i, cx, cy, rot } of pieces) {
    ctx.save();
    ctx.globalAlpha = 1 - s ** 1.8;
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    // below the water line the piece disappears: clip it while it sinks
    if (s) { ctx.beginPath(); ctx.rect(-seg, -C * 1.2, seg * 2, C * 1.2 + C * 0.32 - s * C * 0.5); ctx.clip(); }
    const pw = seg - gap, px = -seg / 2 + gap / 2;
    // same log as the solid ones, but older wood: darker, with moss and bark lines
    box(ctx, px, -C * 0.3, pw, C * 0.6, C * 0.18, '#94643a', '#64401f');
    ctx.fillStyle = 'rgba(255,230,190,.16)'; ctx.fillRect(px, -C * 0.44, pw, C * 0.1);
    ctx.fillStyle = 'rgba(0,0,0,.16)'; for (let bx = px + C * 0.25; bx < px + pw - C * 0.1; bx += C * 0.45) ctx.fillRect(bx, -C * 0.4, 2, C * 0.42);
    ctx.fillStyle = '#5f8a2e';
    for (const [mx, my, mr] of [[0.3, -0.18, 0.07], [0.62, -0.32, 0.05], [0.45, -0.05, 0.05]]) { ctx.beginPath(); ctx.arc(px + pw * mx, my * C, mr * C, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#c99764';
    if (i === 0) ctx.fillRect(px, -C * 0.48, C * 0.16, C * 0.6);
    if (i === n - 1) ctx.fillRect(px + pw - C * 0.16, -C * 0.48, C * 0.16, C * 0.6);
    // broken ends: pale splintered wood with a jagged edge
    ctx.fillStyle = '#e2c79c';
    for (const side of [i > 0 ? -1 : 0, i < n - 1 ? 1 : 0]) {
      if (!side) continue;
      const ex = side > 0 ? px + pw : px;
      ctx.beginPath(); ctx.moveTo(ex, -C * 0.48);
      for (let j = 1; j <= 6; j++) ctx.lineTo(ex - side * (j % 2 ? C * 0.07 : C * 0.02), -C * 0.48 + (j * C * 0.6) / 6);
      ctx.lineTo(ex, C * 0.12); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // the seams between the pieces: dark gaps, plainly visible before you step on
  if (!s) {
    ctx.fillStyle = '#1c120a';
    for (let i = 0; i < n - 1; i++) {
      const gx = (pieces[i].cx + pieces[i + 1].cx) / 2;
      ctx.fillRect(gx - gap / 2, y + C * 0.02, gap, C * 0.6);
    }
  }
  // wood chips fly up the moment it snaps
  if (t !== undefined && t > BREAK * 0.9 && s < 0.6) {
    const u = t - BREAK * 0.9;
    ctx.fillStyle = '#d9b98c';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI - Math.PI, v = C * (1.6 + (i % 3) * 0.5);
      ctx.fillRect(x + w / 2 + Math.cos(a) * v * u * 1.4 - 2, y + C * 0.3 + Math.sin(a) * v * u + 9 * C * u * u - 2, Math.max(3, C * 0.08), Math.max(3, C * 0.06));
    }
  }
  if (t === undefined) {
    // a little warning mark floats above cracked logs
    ctx.fillStyle = 'rgba(255,214,90,.95)';
    ctx.font = `800 ${Math.round(C * 0.34)}px Geist Variable, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('!', x + w / 2, y - C * 0.02 + Math.sin(art.clock * 4) * 2);
  }
}
// Vehicles by colour index: small cars 0-5 plain, 6 police, 7 taxi, 8 sports car; long ones 0-4 trucks, 5-6 bus, 7-8 fire engine.
export function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, C: number, c: number, dir: number) {
  const w = len * C - C * 0.12, x0 = x + C * 0.06, fwd = dir > 0;
  // a flashing lamp with a halo (rgb as 'r,g,b')
  const lamp = (lx: number, ly: number, rgb: string, on: boolean) => {
    if (on) {
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, C * 0.5);
      g.addColorStop(0, `rgba(${rgb},.6)`); g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, C * 0.5, 0, 7); ctx.fill();
    }
    ctx.fillStyle = on ? '#fff' : `rgba(${rgb},.55)`; ctx.fillRect(lx - C * 0.06, ly - C * 0.04, C * 0.12, C * 0.08);
  };
  const wheels = (ks: number[]) => { ctx.fillStyle = '#1c1c22'; for (const k of ks) ctx.fillRect(x + w * k, y + C * 0.72, C * 0.2, C * 0.12); };
  const head = () => { ctx.fillStyle = '#fff6b0'; ctx.fillRect(fwd ? x + w - 2 : x0, y + C * 0.55, 4, C * 0.1); };
  const blink = Math.floor(art.clock * 6) % 2 === 0;
  if (len >= 2) {
    castBox(ctx, x0, y + C * 0.12, w, C * 0.7, C * 0.75);
    if (c === 5 || c === 6) {
      // bus: one long body with a band of windows and a door at the front
      const col = c === 5 ? '#ffb000' : '#2e7dd7', top = y + C * 0.82 - C * 0.75;
      box(ctx, x0, y + C * 0.12, w, C * 0.7, C * 0.75, shade(col, 1.08), shade(col, 0.78));
      ctx.fillStyle = '#26303f';
      for (let wx = x0 + C * 0.14; wx < x0 + w - C * 0.3; wx += C * 0.36) ctx.fillRect(wx, top + C * 0.1, C * 0.26, C * 0.2);
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x0, top + C * 0.44, w, C * 0.04);
      ctx.fillStyle = '#26303f'; ctx.fillRect(fwd ? x0 + w - C * 0.3 : x0 + C * 0.12, top + C * 0.34, C * 0.18, C * 0.38);
      wheels([0.14, 0.76]); head(); return;
    }
    if (c === 7 || c === 8) {
      // fire engine: red, a ladder on top and blue flashing lights on the cab
      const cab = C * 0.62, cx = fwd ? x0 + w - cab : x0, ly = y + C * 0.14 - C * 0.62;
      box(ctx, x0, y + C * 0.14, w, C * 0.66, C * 0.62, '#e8403a', '#a82420');
      ctx.fillStyle = '#dcdce4'; ctx.fillRect(x0 + C * 0.08, y + C * 0.8 - C * 0.3, w - C * 0.16, C * 0.05);
      box(ctx, cx, y + C * 0.16, cab, C * 0.62, C * 0.78, '#f04a44', '#b02a26');
      ctx.fillStyle = '#9fd8ff'; ctx.fillRect(cx + (fwd ? cab * 0.5 : cab * 0.1), y + C * 0.78 - C * 0.72, cab * 0.4, C * 0.22);
      const lx0 = fwd ? x0 + C * 0.1 : x0 + cab + C * 0.1, lw = w - cab - C * 0.2;
      ctx.fillStyle = '#e6e6ee'; ctx.fillRect(lx0, ly + C * 0.12, lw, C * 0.05); ctx.fillRect(lx0, ly + C * 0.4, lw, C * 0.05);
      for (let k = lx0 + C * 0.1; k < lx0 + lw; k += C * 0.2) ctx.fillRect(k, ly + C * 0.12, C * 0.04, C * 0.32);
      lamp(cx + cab * 0.3, y + C * 0.16 - C * 0.8, '70,140,255', blink);
      lamp(cx + cab * 0.7, y + C * 0.16 - C * 0.8, '70,140,255', !blink);
      wheels([0.12, 0.5, 0.8]); head(); return;
    }
    // truck: cab plus white cargo box
    const col = CAR[c % 6], cab = C * 0.75, cx = fwd ? x + w - cab : x;
    box(ctx, fwd ? x : x + cab, y + C * 0.12, w - cab, C * 0.7, C * 0.7, '#f1f1f4', '#c9cbd3');
    box(ctx, cx, y + C * 0.15, cab, C * 0.65, C * 0.5, col, shade(col, 0.72));
    ctx.fillStyle = '#9fd8ff'; ctx.fillRect(cx + (fwd ? cab * 0.55 : cab * 0.1), y + C * 0.15 - C * 0.5 + 3, cab * 0.35, C * 0.25);
    wheels([0.18, 0.72]); head(); return;
  }
  if (c === 8) {
    // sports car: low and wide, dark glass cabin set back, rear spoiler
    castBox(ctx, x0, y + C * 0.2, w, C * 0.6, C * 0.45);
    const col = '#ff3b30';
    box(ctx, x0, y + C * 0.2, w, C * 0.6, C * 0.24, col, shade(col, 0.68));
    box(ctx, x0 + w * (fwd ? 0.24 : 0.34), y + C * 0.3, w * 0.42, C * 0.4, C * 0.4, shade(col, 1.1), shade(col, 0.55));
    ctx.fillStyle = '#26303f'; ctx.fillRect(x0 + w * (fwd ? 0.28 : 0.38), y + C * 0.7 - C * 0.36, w * 0.34, C * 0.12);
    ctx.fillStyle = '#7fc8ff'; ctx.fillRect(x0 + w * (fwd ? 0.5 : 0.36), y + C * 0.3 - C * 0.4 + 2, w * 0.14, C * 0.3);
    ctx.fillStyle = '#fff'; ctx.fillRect(x0, y + C * 0.8 - C * 0.14, w, C * 0.035);
    // spoiler: a thin wing on two struts at the back
    const sx = fwd ? x0 : x0 + w - C * 0.16;
    ctx.fillStyle = '#1c1c22'; ctx.fillRect(sx + C * 0.05, y + C * 0.2 - C * 0.36, C * 0.04, C * 0.14);
    box(ctx, sx, y + C * 0.22 - C * 0.24, C * 0.16, C * 0.56, C * 0.05, '#2a2a33', '#16161c');
    wheels([0.16, 0.7]); head(); return;
  }
  castBox(ctx, x0, y + C * 0.18, w, C * 0.62, c === 6 ? C * 0.72 : C * 0.58);
  const police = c === 6, taxi = c === 7;
  const col = police ? '#f4f4f6' : taxi ? '#ffc61a' : CAR[c % 6];
  box(ctx, x0, y + C * 0.18, w, C * 0.62, C * 0.32, col, police ? '#1f2c4f' : shade(col, 0.72));
  box(ctx, x0 + w * 0.22, y + C * 0.25, w * 0.5, C * 0.45, C * 0.58, police ? '#ffffff' : shade(col, 1.12), police ? '#26355e' : shade(col, 0.6));
  ctx.fillStyle = '#9fd8ff'; ctx.fillRect(x0 + w * (fwd ? 0.55 : 0.22), y + C * 0.25 - C * 0.58 + 2, w * 0.17, C * 0.4);
  if (taxi) {
    // roof sign and a checker stripe on the side
    box(ctx, x0 + w * 0.4, y + C * 0.32 - C * 0.58, w * 0.16, C * 0.12, C * 0.1, '#fff', '#d0d0d6');
    ctx.fillStyle = '#1c1c22'; for (let k = 0; k < 6; k++) ctx.fillRect(x0 + w * (0.04 + k * 0.16), y + C * 0.8 - C * 0.2, w * 0.08, C * 0.06);
  }
  if (police) {
    // light bar on the roof, red and blue in turn, and a stripe along the doors
    const by = y + C * 0.4 - C * 0.62;
    ctx.fillStyle = '#1c1c22'; ctx.fillRect(x0 + w * 0.3, by - C * 0.02, w * 0.34, C * 0.06);
    lamp(x0 + w * 0.36, by - C * 0.04, '255,60,60', blink);
    lamp(x0 + w * 0.58, by - C * 0.04, '60,120,255', !blink);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x0 + w * 0.06, y + C * 0.8 - C * 0.2, w * 0.88, C * 0.05);
  }
  wheels([0.18, 0.72]); head();
}
export function drawTrain(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, C: number, dir: number) {
  castBox(ctx, x, y + C * 0.12, len * C - C * 0.12, C * 0.72, C * 0.85);
  for (let k = 0; k < len; k += 3) {
    const cx = x + k * C, cw = Math.min(3, len - k) * C - C * 0.12;
    box(ctx, cx, y + C * 0.12, cw, C * 0.72, C * 0.85, '#e8e8ee', '#c33a3a');
    ctx.fillStyle = '#26303f'; for (let wx = cx + C * 0.3; wx < cx + cw - C * 0.4; wx += C * 0.7) ctx.fillRect(wx, y + C * 0.84 - C * 0.65, C * 0.4, C * 0.22);
  }
  ctx.fillStyle = '#ffe680'; ctx.fillRect(dir > 0 ? x + len * C - C * 0.2 : x, y + C * 0.84 - C * 0.3, C * 0.12, C * 0.14);
}
export function drawSignal(ctx: CanvasRenderingContext2D, x: number, y: number, C: number, on: boolean) {
  castBox(ctx, x + C * 0.13, y + C * 0.05, C * 0.08, C * 0.1, C * 1.1);
  box(ctx, x + C * 0.13, y + C * 0.05, C * 0.08, C * 0.1, C * 0.9, '#666', '#3a3a40');
  box(ctx, x - C * 0.04, y + C * 0.02, C * 0.42, C * 0.14, C * 1.3, '#26262c', '#16161a');
  // alternating lamps with a big halo: impossible to miss before a train comes
  const blink = Math.floor(art.clock * 5) % 2 === 0;
  for (const [k, b] of [[0, on && blink], [0.2, on && !blink]] as const) {
    const lx = x + C * (k + 0.07), ly = y + C * 0.02 - C * 1.12;
    if (b) {
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, C * 0.9);
      g.addColorStop(0, 'rgba(255,70,60,.75)'); g.addColorStop(1, 'rgba(255,70,60,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, C * 0.9, 0, 7); ctx.fill();
    }
    ctx.fillStyle = b ? '#ffe2dc' : '#4a1a1a';
    ctx.beginPath(); ctx.arc(lx, ly, C * 0.075, 0, 7); ctx.fill();
    if (b) { ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = C * 0.03; ctx.stroke(); }
  }
}

// Grass changes its look every 30 rows: fresh spring green, lush dark meadow, dry late-summer grass.
const GRASS = [['#8bd65a', '#80cc50', 'rgba(40,110,30,.2)'], ['#6cc04a', '#63b544', 'rgba(20,80,20,.24)'], ['#b9d462', '#aec859', 'rgba(130,110,30,.3)']];

/** The ground of one row: y is the top of its footprint, W the canvas width, roadAbove draws lane markings. */
export function drawGround(ctx: CanvasRenderingContext2D, l: Lane, r: number, y: number, W: number, C: number, roadAbove: boolean) {
  if (l.checkpoint) {
    // checkpoint meadow: golden stripes, the row number painted on the grass, flags at both ends
    ctx.fillStyle = '#9adf62'; ctx.fillRect(0, y, W, C + 1);
    ctx.fillStyle = 'rgba(255,214,90,.45)'; for (let x = 0; x < W; x += C) ctx.fillRect(x, y + C * 0.12, C * 0.5, C * 0.76);
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = `800 ${Math.round(C * 0.5)}px Geist Variable, sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(String(l.checkpoint), W / 2, y + C * 0.68);
    return;
  }
  if (l.type === 'grass') {
    const [a, b, dot] = GRASS[((Math.floor(r / 30) % 3) + 3) % 3];
    ctx.fillStyle = r % 2 ? a : b; ctx.fillRect(0, y, W, C + 1);
    // little pairs of blades in a fixed pattern
    ctx.fillStyle = dot;
    for (let c = 0; c < W / C; c++) {
      const h = (r * 7 + c * 13) % 5;
      if (h !== 0 && h !== 3) continue;
      const bx = c * C + C * (h ? 0.68 : 0.26), by = y + C * (h ? 0.3 : 0.58);
      ctx.fillRect(bx, by, C * 0.05, C * 0.14); ctx.fillRect(bx + C * 0.08, by + C * 0.04, C * 0.05, C * 0.1);
    }
  } else if (l.type === 'road') {
    ctx.fillStyle = '#4a4e5a'; ctx.fillRect(0, y, W, C + 1);
    if (roadAbove) { ctx.fillStyle = 'rgba(255,255,255,.55)'; for (let x = 0; x < W; x += C) ctx.fillRect(x + C * 0.2, y - 1.5, C * 0.5, 3); }
  } else if (l.type === 'river') {
    ctx.fillStyle = '#3aa7e6'; ctx.fillRect(0, y, W, C + 1);
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    const off = ((art.clock * l.speed * l.dir * C) % (C * 2) + C * 2) % (C * 2);
    for (let x = -C * 2 + off; x < W; x += C * 2) ctx.fillRect(x, y + C * (0.3 + (r % 3) * 0.2), C * 0.6, 2);
  } else {
    ctx.fillStyle = '#8f8070'; ctx.fillRect(0, y, W, C + 1);
    ctx.fillStyle = '#5a4030'; for (let x = 0; x < W; x += C * 0.5) ctx.fillRect(x + C * 0.1, y + C * 0.15, C * 0.18, C * 0.7);
    ctx.fillStyle = '#c9ced6'; ctx.fillRect(0, y + C * 0.28, W, C * 0.07); ctx.fillRect(0, y + C * 0.66, W, C * 0.07);
    if (warning(l)) { ctx.fillStyle = `rgba(255,50,50,${0.12 + 0.12 * (Math.floor(art.clock * 5) % 2)})`; ctx.fillRect(0, y, W, C + 1); }
  }
}

/** Everything standing on one row (props, logs, traffic, trains), drawn back to front. cols: row width in cells. */
export function drawRow(ctx: CanvasRenderingContext2D, l: Lane, r: number, y: number, C: number, cols = 10) {
  if (l.checkpoint) for (const fx of [0.2, cols - 0.2]) drawFlag(ctx, fx * C, y, C);
  if (l.type === 'grass') {
    for (const d of l.decor) prop(ctx, d.k, d.c * C, y, C, (d.c * 37 + r * 11) % 7 / 7);
    for (const c of l.trees) {
      const k = l.deco[c];
      if (k === 'tree') drawTree(ctx, c * C, y, C, false);
      else if (k !== 'house2') prop(ctx, k === 'rock' ? ((r + c) % 2 ? 'stone1' : 'stone2') : k, c * C, y, C);
    }
  }
  if (l.type === 'river') for (const it of l.items) (l.pads ? drawPad(ctx, it.x * C, y, C, r) : drawLog(ctx, it, y, C));
  if (l.coin !== null && l.type !== 'river') drawCoin(ctx, l.coin * C, y, C);
  if (l.type === 'road') for (const it of l.items) drawCar(ctx, it.x * C, y, it.len, C, it.c, l.dir);
  if (l.type === 'rail') {
    drawSignal(ctx, 0.25 * C, y, C, warning(l));
    drawSignal(ctx, (cols - 0.6) * C, y, C, warning(l));
    if (l.train) drawTrain(ctx, l.train.x * C, y, l.train.len, C, l.dir);
  }
}
