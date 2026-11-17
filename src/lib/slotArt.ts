// Slot symbols drawn with the games' own canvas renderers (Retro Crossy Run, Snake), rendered once to images.
import { drawDuck, drawCar, drawTree, drawCoin, art } from '../games/crossyDraw';
import { drawApple, drawHead, drawWall } from '../games/snakeDraw';

const S = 160; // image size
const DRAW: Record<string, (ctx: CanvasRenderingContext2D) => void> = {
  'cr-tree': (c) => drawTree(c, 30, 62, 100, false),
  'cr-car': (c) => drawCar(c, 25, 52, 1, 110, 0, 1),
  'cr-taxi': (c) => drawCar(c, 25, 52, 1, 110, 7, 1),
  'cr-police': (c) => drawCar(c, 25, 52, 1, 110, 6, 1),
  'cr-fire': (c) => drawCar(c, 10, 70, 2, 72, 7, 1),
  'cr-duck': (c) => drawDuck(c, 80, 140, 120, 'down'),
  'cr-coin': (c) => { art.clock = 0; drawCoin(c, 20, 10, 120); },
  'sn-wall': (c) => drawWall(c, 25, 25, 110),
  'sn-poison': (c) => drawApple(c, 10, 10, 140, 'poison', Infinity, 0),
  'sn-red': (c) => drawApple(c, 10, 10, 140, 'red', Infinity, 0),
  'sn-gold': (c) => drawApple(c, 10, 10, 140, 'gold', Infinity, 0),
  'sn-cosmic': (c) => drawApple(c, 10, 10, 140, 'cosmic', Infinity, 0.6),
  'sn-head': (c) => drawHead(c, 5, 5, 150),
};
const cache = new Map<string, string>();
/** Image URL for a game symbol, or undefined if the symbol is not one of these. */
export function slotArt(sym: string): string | undefined {
  if (!DRAW[sym] || typeof document === 'undefined') return undefined;
  if (!cache.has(sym)) {
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    DRAW[sym](cv.getContext('2d')!);
    cache.set(sym, cv.toDataURL());
  }
  return cache.get(sym);
}
