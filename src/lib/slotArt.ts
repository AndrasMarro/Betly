// Slot symbols drawn with the games' own canvas renderers (Retro Crossy Run, Snake), rendered once to images.
import { drawDuck, drawCar, drawTree, drawCoin, art } from '../games/crossyDraw';
import { drawApple, drawHead, drawWall } from '../games/snakeDraw';

// Each symbol is drawn on a large canvas with room for glows and halos, then cropped to what was drawn,
// so nothing is cut off at the edges.
const S = 300, O = 70; // canvas size, offset of the drawing area (a 160 box in the middle)
const DRAW: Record<string, (ctx: CanvasRenderingContext2D) => void> = {
  'cr-tree': (c) => drawTree(c, O + 30, O + 62, 100, false),
  'cr-car': (c) => drawCar(c, O + 25, O + 52, 1, 110, 0, 1),
  'cr-taxi': (c) => drawCar(c, O + 25, O + 52, 1, 110, 7, 1),
  'cr-police': (c) => drawCar(c, O + 25, O + 52, 1, 110, 6, 1),
  'cr-fire': (c) => drawCar(c, O + 10, O + 70, 2, 72, 7, 1),
  'cr-duck': (c) => drawDuck(c, O + 80, O + 140, 120, 'down'),
  'cr-coin': (c) => drawCoin(c, O + 20, O + 10, 120),
  'sn-wall': (c) => drawWall(c, O + 25, O + 25, 110),
  'sn-poison': (c) => drawApple(c, O + 10, O + 10, 140, 'poison', Infinity, 0),
  'sn-red': (c) => drawApple(c, O + 10, O + 10, 140, 'red', Infinity, 0),
  'sn-gold': (c) => drawApple(c, O + 10, O + 10, 140, 'gold', Infinity, 0),
  'sn-cosmic': (c) => drawApple(c, O + 10, O + 10, 140, 'cosmic', Infinity, 0.6),
  'sn-head': (c) => drawHead(c, O + 5, O + 5, 150),
};
/** Crop a canvas to its drawn pixels, as a square with a small margin. */
function crop(cv: HTMLCanvasElement) {
  const d = cv.getContext('2d')!.getImageData(0, 0, S, S).data;
  let x0 = S, y0 = S, x1 = 0, y1 = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (d[(y * S + x) * 4 + 3] > 24) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const side = Math.max(x1 - x0, y1 - y0) + 8, out = document.createElement('canvas');
  out.width = out.height = side;
  out.getContext('2d')!.drawImage(cv, x0 - (side - (x1 - x0)) / 2, y0 - (side - (y1 - y0)) / 2, side, side, 0, 0, side, side);
  return out.toDataURL();
}
const cache = new Map<string, string>();
/** Image URL for a game symbol, or undefined if the symbol is not one of these. */
export function slotArt(sym: string): string | undefined {
  if (!DRAW[sym] || typeof document === 'undefined') return undefined;
  if (!cache.has(sym)) {
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    art.clock = 0.2; // police lights off, coin facing front
    DRAW[sym](cv.getContext('2d')!);
    cache.set(sym, crop(cv));
  }
  return cache.get(sym);
}
