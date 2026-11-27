// Kritzelpost (Doodle Post): telephone with pictures. Everyone starts a chain; every step the chains move one seat on.
// Normal: write a sentence, the next one draws it, the next one writes what they see, and so on.
// Memory: draw something, the next one sees it for a few seconds and draws it again from memory, with less time each step.
// Monster: three players draw head, body and legs of one creature, seeing only the bottom edge of the part above.
// At the end every chain is shown step by step, everyone can hand out hearts, and the most hearts win the pot.
export type Mode = 'normal' | 'memory' | 'monster';
export type Lang = 'de' | 'en';
export type Stroke = { c: string; w: number; p: number[] }; // flat x,y list on an 800 × 600 sheet
export type Drawing = Stroke[];
export type Kind = 'write' | 'draw' | 'guess' | 'copy' | 'part';
export type Entry = { by: string; kind: Kind; text?: string; draw?: Drawing };
export const SW = 800, SH = 600;
export const COLORS = ['#1f1d2b', '#ffffff', '#9aa0a6', '#e5484d', '#f76b15', '#f5d90a', '#46a758', '#0ea5a4', '#3e63dd', '#8e4ec6', '#d6409f', '#8d5a3b'];
export const SIZES = [4, 10, 24];
/** The paper colour: the eraser paints with it. */
export const PAPER = '#fffdf6';

/** How many steps a game has: every chain passes every player once (at least 3 steps), monsters have 3 parts. */
export const stepsFor = (mode: Mode, n: number) => (mode === 'monster' ? 3 : Math.max(3, n));
export function kindOf(mode: Mode, s: number): Kind {
  if (mode === 'monster') return 'part';
  if (mode === 'memory') return s === 0 ? 'draw' : 'copy';
  return s === 0 ? 'write' : s % 2 ? 'draw' : 'guess';
}
/** Who works on chain c at step s (index into the seats). */
export const author = (c: number, s: number, n: number) => (c + s) % n;
/** Which chain seat i works on at step s. */
export const chainOf = (i: number, s: number, n: number) => (((i - s) % n) + n) % n;
/** Seconds for a step: drawing gets the draw time, writing the write time; memory gets faster every step. */
export function timeFor(mode: Mode, kind: Kind, s: number, t: { write: number; draw: number }) {
  if (kind === 'write' || kind === 'guess') return t.write;
  if (mode === 'memory') return Math.round(t.draw * Math.max(0.4, 1 - 0.12 * s));
  return t.draw;
}
/** Memory mode: seconds to look at the picture before it disappears. */
export const peekFor = (s: number) => Math.max(3, 9 - s);
export const PARTS = { de: ['Kopf', 'Körper', 'Beine'], en: ['Head', 'Body', 'Legs'] };

/** Drop points closer than d to the last kept one and round to whole numbers (keeps messages small). */
export function simplify(p: number[], d = 3) {
  if (p.length <= 4) return p.map(Math.round);
  const out = [Math.round(p[0]), Math.round(p[1])];
  for (let i = 2; i < p.length - 2; i += 2) {
    const dx = p[i] - out[out.length - 2], dy = p[i + 1] - out[out.length - 1];
    if (dx * dx + dy * dy >= d * d) out.push(Math.round(p[i]), Math.round(p[i + 1]));
  }
  out.push(Math.round(p[p.length - 2]), Math.round(p[p.length - 1]));
  return out;
}
/** Checks and trims a drawing that comes from another player. */
export function cleanDrawing(d: unknown): Drawing {
  if (!Array.isArray(d)) return [];
  const out: Drawing = [];
  let pts = 0;
  for (const s of d.slice(0, 600)) {
    const p = Array.isArray(s?.p) ? s.p.slice(0, 2000).map((v: unknown) => Math.max(-50, Math.min(850, Math.round(Number(v) || 0)))) : [];
    if (p.length < 2) continue;
    pts += p.length;
    if (pts > 24000) break;
    out.push({ c: COLORS.includes(s.c) || s.c === PAPER ? s.c : COLORS[0], w: SIZES.includes(Number(s.w)) || Number(s.w) === 60 ? Number(s.w) : 10, p: p.length % 2 ? p.slice(0, -1) : p });
  }
  return out;
}
/** A shaky copy from memory: everything shifts a little, some details get lost (bots in memory mode). */
export function wobble(d: Drawing, amount: number, rnd = Math.random): Drawing {
  return d.filter(() => rnd() > amount * 0.25).map((s) => {
    const dx = (rnd() - 0.5) * amount * 60, dy = (rnd() - 0.5) * amount * 60, k = 1 + (rnd() - 0.5) * amount * 0.3;
    return { ...s, p: s.p.map((v, i) => Math.round((i % 2 ? (v - 300) * k + 300 + dy : (v - 400) * k + 400 + dx) + (rnd() - 0.5) * amount * 14)) };
  });
}

// ---------- the bots' sketchbook ----------
const ring = (cx: number, cy: number, rx: number, ry = rx, a0 = 0, a1 = Math.PI * 2, n = 28) => {
  const p: number[] = [];
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; p.push(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry)); }
  return p;
};
const S = (c: string, w: number, p: number[]): Stroke => ({ c, w, p });
const K = '#1f1d2b';
type Sketch = { de: string; en: string; keys: string; draw: () => Drawing };
export const SKETCHES: Sketch[] = [
  { de: 'Ein Haus', en: 'A house', keys: 'haus house heim home hütte', draw: () => [S(K, 10, [250, 300, 250, 500, 550, 500, 550, 300, 250, 300]), S('#e5484d', 10, [230, 310, 400, 170, 570, 310]), S('#8d5a3b', 10, [370, 500, 370, 410, 430, 410, 430, 500]), S('#3e63dd', 4, [290, 340, 340, 340, 340, 390, 290, 390, 290, 340])] },
  { de: 'Die Sonne', en: 'The sun', keys: 'sonne sun sommer summer hitze heat', draw: () => [S('#f5d90a', 24, ring(400, 300, 90)), ...Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; return S('#f76b15', 10, [Math.round(400 + Math.cos(a) * 130), Math.round(300 + Math.sin(a) * 130), Math.round(400 + Math.cos(a) * 190), Math.round(300 + Math.sin(a) * 190)]); })] },
  { de: 'Eine Katze', en: 'A cat', keys: 'katze cat kater mieze kitten', draw: () => [S(K, 10, ring(400, 330, 110, 95)), S(K, 10, [315, 270, 320, 170, 370, 240]), S(K, 10, [430, 240, 480, 170, 485, 270]), S('#46a758', 10, [355, 310, 365, 310]), S('#46a758', 10, [435, 310, 445, 310]), S(K, 4, [330, 360, 250, 350, 330, 375, 250, 390]), S(K, 4, [470, 360, 550, 350, 470, 375, 550, 390]), S('#d6409f', 10, [395, 345, 405, 345])] },
  { de: 'Ein Baum', en: 'A tree', keys: 'baum tree wald forest eiche oak', draw: () => [S('#8d5a3b', 24, [400, 520, 400, 330]), S('#46a758', 24, ring(400, 250, 130, 110)), S('#e5484d', 10, ring(350, 230, 8)), S('#e5484d', 10, ring(450, 280, 8))] },
  { de: 'Ein Auto', en: 'A car', keys: 'auto car fahren drive wagen taxi', draw: () => [S('#e5484d', 10, [180, 400, 180, 330, 270, 330, 320, 260, 500, 260, 560, 330, 630, 340, 630, 400, 180, 400]), S(K, 24, ring(270, 410, 40)), S(K, 24, ring(540, 410, 40)), S('#3e63dd', 4, [340, 320, 370, 280, 480, 280, 520, 320, 340, 320])] },
  { de: 'Ein Fisch', en: 'A fish', keys: 'fisch fish meer sea ozean ocean hai shark', draw: () => [S('#0ea5a4', 10, ring(380, 300, 150, 80)), S('#0ea5a4', 10, [520, 300, 620, 220, 620, 380, 520, 300]), S(K, 10, ring(300, 285, 8)), S('#3e63dd', 4, ring(200, 200, 14)), S('#3e63dd', 4, ring(170, 140, 9))] },
  { de: 'Eine Blume', en: 'A flower', keys: 'blume flower rose garten garden frühling spring', draw: () => [S('#46a758', 10, [400, 540, 400, 330]), S('#46a758', 10, [400, 450, 340, 410, 400, 430]), ...Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2; return S('#d6409f', 10, ring(Math.round(400 + Math.cos(a) * 55), Math.round(260 + Math.sin(a) * 55), 40)); }), S('#f5d90a', 24, ring(400, 260, 22))] },
  { de: 'Ein Schiff', en: 'A boat', keys: 'schiff boot boat ship segeln sail see lake', draw: () => [S('#8d5a3b', 10, [220, 380, 580, 380, 520, 450, 280, 450, 220, 380]), S(K, 10, [400, 380, 400, 150]), S('#ffffff', 10, [410, 160, 540, 350, 410, 350, 410, 160]), S('#3e63dd', 10, [120, 470, 200, 450, 280, 475, 360, 450, 440, 475, 520, 450, 600, 475, 680, 450])] },
  { de: 'Eine Rakete', en: 'A rocket', keys: 'rakete rocket weltall space mond moon stern star fliegen fly', draw: () => [S('#9aa0a6', 10, [400, 120, 460, 220, 460, 420, 340, 420, 340, 220, 400, 120]), S('#3e63dd', 10, ring(400, 260, 28)), S('#e5484d', 10, [340, 360, 290, 450, 340, 420]), S('#e5484d', 10, [460, 360, 510, 450, 460, 420]), S('#f76b15', 24, [370, 440, 400, 530, 430, 440])] },
  { de: 'Ein Herz', en: 'A heart', keys: 'herz heart liebe love verliebt kuss kiss', draw: () => [S('#e5484d', 24, [400, 480, 260, 330, 250, 250, 300, 200, 360, 200, 400, 250, 440, 200, 500, 200, 550, 250, 540, 330, 400, 480])] },
  { de: 'Ein Gespenst', en: 'A ghost', keys: 'gespenst geist ghost halloween spuk', draw: () => [S(K, 10, [280, 480, 280, 280, ...ring(400, 280, 120, 120, Math.PI, Math.PI * 2, 16).slice(2), 520, 480, 490, 450, 460, 480, 430, 450, 400, 480, 370, 450, 340, 480, 310, 450, 280, 480]), S(K, 24, ring(360, 300, 10)), S(K, 24, ring(440, 300, 10)), S(K, 10, ring(400, 370, 18, 26))] },
  { de: 'Eine Pizza', en: 'A pizza', keys: 'pizza essen food hunger italien italy', draw: () => [S('#f5d90a', 24, [250, 200, 550, 200, 400, 500, 250, 200]), S('#8d5a3b', 24, [240, 195, 560, 195]), S('#e5484d', 10, ring(360, 260, 22)), S('#e5484d', 10, ring(440, 290, 20)), S('#e5484d', 10, ring(400, 380, 18))] },
  { de: 'Ein Schneemann', en: 'A snowman', keys: 'schneemann snowman schnee snow winter weihnachten christmas', draw: () => [S(K, 10, ring(400, 430, 110)), S(K, 10, ring(400, 260, 75)), S('#f76b15', 10, [400, 265, 470, 275, 400, 285]), S(K, 24, [330, 190, 470, 190]), S(K, 24, [360, 190, 360, 130, 440, 130, 440, 190]), S('#8d5a3b', 10, [310, 400, 200, 330]), S('#8d5a3b', 10, [490, 400, 600, 330])] },
  { de: 'Ein Regenschirm', en: 'An umbrella', keys: 'regen rain schirm umbrella wetter weather', draw: () => [S('#8e4ec6', 10, [230, 300, ...ring(400, 300, 170, 140, Math.PI, Math.PI * 2, 18), 230, 300]), S(K, 10, [400, 300, 400, 480, 380, 500, 360, 480]), S('#3e63dd', 4, [250, 380, 240, 410]), S('#3e63dd', 4, [560, 400, 550, 430])] },
  { de: 'Ein Kuchen', en: 'A cake', keys: 'kuchen cake geburtstag birthday torte party fest', draw: () => [S('#d6409f', 10, [250, 300, 550, 300, 550, 460, 250, 460, 250, 300]), S('#ffffff', 10, [250, 340, 290, 360, 330, 340, 370, 360, 410, 340, 450, 360, 490, 340, 550, 350]), S('#f5d90a', 10, [400, 300, 400, 230]), S('#f76b15', 10, ring(400, 210, 10, 16))] },
  { de: 'Ein Apfel', en: 'An apple', keys: 'apfel apple obst fruit gesund healthy', draw: () => [S('#e5484d', 24, ring(400, 330, 120, 110)), S('#8d5a3b', 10, [400, 220, 410, 160]), S('#46a758', 10, [410, 190, 470, 160, 430, 205])] },
  { de: 'Ein Berg', en: 'A mountain', keys: 'berg mountain alpen alps wandern hike gipfel', draw: () => [S('#9aa0a6', 10, [120, 480, 330, 180, 450, 340, 520, 260, 680, 480]), S('#ffffff', 10, [285, 245, 330, 180, 375, 245, 350, 230, 330, 250, 305, 230, 285, 245]), S('#46a758', 10, [100, 490, 700, 490])] },
  { de: 'Ein Hund', en: 'A dog', keys: 'hund dog welpe puppy bellen bark', draw: () => [S('#8d5a3b', 10, ring(400, 300, 100, 90)), S('#8d5a3b', 24, [310, 250, 270, 360]), S('#8d5a3b', 24, [490, 250, 530, 360]), S(K, 24, ring(400, 330, 14)), S(K, 10, ring(365, 285, 6)), S(K, 10, ring(435, 285, 6)), S('#e5484d', 10, [400, 350, 400, 380])] },
  { de: 'Eine Brille', en: 'Glasses', keys: 'brille glasses sehen see lesen read', draw: () => [S(K, 10, ring(310, 300, 70)), S(K, 10, ring(490, 300, 70)), S(K, 10, [380, 295, 400, 280, 420, 295]), S(K, 10, [240, 290, 170, 260]), S(K, 10, [560, 290, 630, 260])] },
  { de: 'Ein Strichmännchen', en: 'A stick figure', keys: 'mann man frau woman mensch person kind child freund friend', draw: () => [S(K, 10, ring(400, 180, 50)), S(K, 10, [400, 230, 400, 390]), S(K, 10, [320, 290, 400, 270, 480, 290]), S(K, 10, [340, 500, 400, 390, 460, 500]), S(K, 4, [380, 195, 400, 210, 420, 195])] },
];
/** Monster parts the bots draw: each fills its own band and ends with a neck/hip near the bottom middle. */
export const MONSTER_PARTS: Drawing[][] = [
  [ // heads
    [S('#46a758', 10, ring(400, 300, 170, 150)), S(K, 24, ring(340, 260, 25)), S(K, 24, ring(460, 260, 25)), S(K, 10, [330, 370, 470, 370]), S('#46a758', 10, [380, 450, 380, 600]), S('#46a758', 10, [420, 450, 420, 600]), S('#8e4ec6', 10, [300, 170, 260, 60]), S('#8e4ec6', 10, [500, 170, 540, 60])],
    [S('#f76b15', 10, [250, 450, 300, 150, 500, 150, 550, 450, 250, 450]), S(K, 24, ring(400, 260, 40)), S('#ffffff', 10, ring(400, 260, 15)), S(K, 10, [320, 380, 360, 360, 400, 380, 440, 360, 480, 380]), S('#f76b15', 10, [370, 450, 370, 600]), S('#f76b15', 10, [430, 450, 430, 600])],
    [S('#8e4ec6', 10, ring(400, 330, 140)), S(K, 10, ring(340, 300, 20)), S(K, 10, ring(400, 280, 20)), S(K, 10, ring(460, 300, 20)), S('#e5484d', 10, [340, 400, 400, 430, 460, 400]), S('#8e4ec6', 10, [385, 470, 385, 600]), S('#8e4ec6', 10, [415, 470, 415, 600])],
  ],
  [ // bodies
    [S('#3e63dd', 10, [380, 0, 300, 120, 260, 480, 540, 480, 500, 120, 420, 0]), S('#f5d90a', 10, ring(400, 280, 60)), S('#3e63dd', 10, [290, 200, 150, 120]), S('#3e63dd', 10, [510, 200, 650, 300]), S('#3e63dd', 10, [360, 480, 360, 600]), S('#3e63dd', 10, [440, 480, 440, 600])],
    [S('#d6409f', 10, ring(400, 300, 180, 240)), S('#ffffff', 10, [300, 200, 500, 200]), S('#ffffff', 10, [290, 280, 510, 280]), S('#ffffff', 10, [300, 360, 500, 360]), S('#d6409f', 10, [230, 250, 120, 180, 100, 100]), S('#d6409f', 10, [570, 250, 680, 180, 700, 100]), S('#d6409f', 10, [370, 530, 370, 600]), S('#d6409f', 10, [430, 530, 430, 600])],
    [S('#0ea5a4', 10, [390, 0, 330, 100, 330, 500, 470, 500, 470, 100, 410, 0]), S('#0ea5a4', 10, [330, 220, 200, 260, 160, 200]), S('#0ea5a4', 10, [470, 220, 600, 260, 640, 200]), S(K, 10, ring(400, 300, 10)), S('#0ea5a4', 10, [370, 500, 370, 600]), S('#0ea5a4', 10, [430, 500, 430, 600])],
  ],
  [ // legs
    [S('#3e63dd', 10, [370, 0, 300, 300, 220, 480, 300, 500]), S('#3e63dd', 10, [430, 0, 500, 300, 580, 480, 500, 500]), S(K, 24, [200, 520, 320, 520]), S(K, 24, [480, 520, 600, 520])],
    [...Array.from({ length: 6 }, (_, i) => S('#46a758', 10, [380 + i * 8, 0, 200 + i * 80, 300 + (i % 2) * 60, 180 + i * 90, 520]))],
    [S('#f76b15', 24, [400, 0, 400, 380]), S('#f76b15', 24, ring(400, 450, 80, 60)), S(K, 10, [330, 520, 300, 560]), S(K, 10, [470, 520, 500, 560])],
  ],
];
export const sketchName = (i: number, lang: Lang) => SKETCHES[i][lang];
/** The sketch a bot draws for a sentence: one whose keywords appear in it, otherwise any. */
export function pickSketch(text: string, rnd = Math.random) {
  const t = text.toLowerCase();
  const hits = SKETCHES.map((s, i) => (s.keys.split(' ').some((k) => t.includes(k)) ? i : -1)).filter((i) => i >= 0);
  return hits.length ? hits[Math.floor(rnd() * hits.length)] : Math.floor(rnd() * SKETCHES.length);
}
/** Sentence starters for writing and for the "idea" button. */
export const PROMPTS: Record<Lang, string[]> = {
  de: ['Eine Katze erklärt einem Hund das Internet', 'Ein Schneemann im Hallenbad', 'Ein Pirat verliert seinen Regenschirm', 'Die Sonne macht Ferien am Meer', 'Ein Haus, das davonläuft', 'Eine Rakete voller Pizza', 'Ein Gespenst hat Angst vor dem Dunkeln', 'Zwei Fische spielen Schach', 'Ein Baum mit Sonnenbrille', 'Ein Apfel fährt Ski', 'Oma auf dem Skateboard', 'Ein Hund kocht Spaghetti', 'Ein Kuchen explodiert vor Freude', 'Der Mond isst Käse', 'Ein Roboter verliebt sich in einen Toaster', 'Ein Berg niest', 'Eine Blume tanzt Tango', 'Ein Dinosaurier beim Zahnarzt', 'Ein Auto mit Flügeln', 'Ein Pinguin in der Wüste', 'Eine Kuh auf dem Mond', 'Ein Schiff im Wohnzimmer', 'Ein Strichmännchen fängt einen Fisch', 'Ein Huhn mit Krone', 'Ein Elefant auf einem Velo', 'Eine Giraffe mit Schal', 'Ein Zauberer verliert seinen Hut', 'Ein Hamster im Fitnessstudio', 'Ein Drache mit Schnupfen', 'Eine Schnecke gewinnt ein Rennen', 'Ein Ritter fürchtet sich vor einer Maus', 'Eine Wolke regnet Konfetti', 'Ein Kaktus will umarmt werden', 'Ein Fussball schläft im Tor', 'Ein Krokodil mit Zahnspange'],
  en: ['A cat explains the internet to a dog', 'A snowman at the swimming pool', 'A pirate loses his umbrella', 'The sun goes on holiday to the sea', 'A house running away', 'A rocket full of pizza', 'A ghost afraid of the dark', 'Two fish playing chess', 'A tree wearing sunglasses', 'An apple goes skiing', 'Grandma on a skateboard', 'A dog cooking spaghetti', 'A cake exploding with joy', 'The moon eating cheese', 'A robot falls in love with a toaster', 'A mountain sneezes', 'A flower dancing tango', 'A dinosaur at the dentist', 'A car with wings', 'A penguin in the desert', 'A cow on the moon', 'A ship in the living room', 'A stick figure catching a fish', 'A chicken wearing a crown', 'An elephant on a bike', 'A giraffe with a scarf', 'A wizard loses his hat', 'A hamster at the gym', 'A dragon with a cold', 'A snail wins a race', 'A knight scared of a mouse', 'A cloud raining confetti', 'A cactus wants a hug', 'A football asleep in the goal', 'A crocodile with braces'],
};
/** What a bot writes for a picture it did not draw: a wild guess. */
export function botGuess(lang: Lang, rnd = Math.random) {
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const what = pick(SKETCHES)[lang];
  const tail = lang === 'de' ? pick(['im Regen', 'auf dem Mond', 'mit Hut', 'beim Tanzen', 'in den Ferien', 'mit schlechter Laune', 'um Mitternacht']) : pick(['in the rain', 'on the moon', 'with a hat', 'dancing', 'on holiday', 'in a bad mood', 'at midnight']);
  return `${what} ${tail}`;
}
