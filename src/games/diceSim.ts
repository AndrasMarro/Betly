// The dice geometry and the throw, shared by the WebGL dice and the CSS fallback.
// Coordinates are CSS-like: x right, y DOWN, z towards the viewer, so "up" is -y; units are pixels of `size`.
export type V = [number, number, number];
export type M = number[]; // 3x3 row-major
export const mul = (a: M, b: M): M => [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]));
export const apply = (m: M, v: V): V => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
export function axisAngle([x, y, z]: V, a: number): M {
  const c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
}
export const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (v: V): V => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const I: M = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const UP: V = [0, -1, 0];

/** A face: its corners, centre, outward normal and the in-plane axes the number is written along (v = down). */
export type Face = { idx: number[]; P: V[]; c: V; n: V; u: V; v: V };
export type Solid = { f: number; verts: V[]; faces: Face[]; inr: number; opp: number[] };

export function solid(f: number, s: number): Solid {
  let verts: V[], polys: number[][];
  if (f === 6) {
    const a = s / 2;
    verts = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [i & 1 ? a : -a, i & 2 ? a : -a, i & 4 ? a : -a]);
    polys = [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]];
  } else if (f === 8) {
    const a = s * 0.72;
    verts = [[a, 0, 0], [-a, 0, 0], [0, a, 0], [0, -a, 0], [0, 0, a], [0, 0, -a]];
    polys = [0, 1].flatMap((x) => [2, 3].flatMap((y) => [4, 5].map((z) => [x, y, z])));
  } else {
    // pentagonal trapezohedron: two apexes, two rings of five twisted by 36°; z keeps the kites flat
    const r = s * 0.62, h = s * 0.66, c = Math.cos(Math.PI / 5), z = (h * (1 - c)) / (1 + c);
    const ring = (k: number, off: number, y: number): V => [r * Math.cos((k * 2 * Math.PI) / 5 + off), y, r * Math.sin((k * 2 * Math.PI) / 5 + off)];
    verts = [[0, -h, 0], [0, h, 0], ...[0, 1, 2, 3, 4].map((k) => ring(k, 0, -z)), ...[0, 1, 2, 3, 4].map((k) => ring(k, Math.PI / 5, z))];
    const U = (k: number) => 2 + (k % 5), L = (k: number) => 7 + (k % 5);
    polys = [0, 1, 2, 3, 4].flatMap((k) => [[0, U(k), L(k), U(k + 1)], [1, L(k), U(k + 1), L(k + 1)]]);
  }
  const faces = polys.map((idx) => {
    const P = idx.map((i) => verts[i]);
    const c = P.reduce((a, p) => [a[0] + p[0] / P.length, a[1] + p[1] / P.length, a[2] + p[2] / P.length] as V, [0, 0, 0] as V);
    let n = norm(cross(sub(P[1], P[0]), sub(P[2], P[0])));
    if (dot(n, c) < 0) n = [-n[0], -n[1], -n[2]];
    // the number reads upright towards the first corner (triangles, kites) or an edge (squares)
    const upTo = f === 6 ? (P[0].map((x, i) => (x + P[1][i]) / 2) as V) : P[0];
    const v = norm(sub(c, upTo)), u = cross(v, n);
    return { idx, P, c, n, u, v };
  });
  const opp = faces.map((a) => faces.findIndex((b) => dot(a.n, b.n) < -0.999));
  return { f, verts, faces, inr: dot(faces[0].n, faces[0].P[0]), opp };
}

/** The face pointing most upwards, and the turn that lays it exactly flat on top. */
export function topFace(S: Solid, R: M) {
  let best = 0, bestDot = -2;
  S.faces.forEach((fc, i) => { const d = -apply(R, fc.n)[1]; if (d > bestDot) { bestDot = d; best = i; } });
  const nw = apply(R, S.faces[best].n);
  return { best, axis: norm(cross(nw, UP)), ang: Math.acos(Math.max(-1, Math.min(1, -nw[1]))) };
}
/** Number the faces: the value on top, opposite faces add up to faces + 1 like on real dice. */
export function numbers(S: Solid, top: number, value: number) {
  const f = S.f, nums: number[] = Array(f).fill(0);
  nums[top] = value; nums[S.opp[top]] = f + 1 - value;
  const pairs = Array.from({ length: f / 2 }, (_, i) => [i + 1, f - i]).filter((pr) => !pr.includes(value)).sort(() => Math.random() - 0.5);
  for (let i = 0, k = 0; i < f; i++) if (!nums[i]) { const flip = Math.random() < 0.5; nums[i] = pairs[k][flip ? 1 : 0]; nums[S.opp[i]] = pairs[k++][flip ? 0 : 1]; }
  return nums;
}

export type Frame = { p: V; R: M };
export type Throw = { frames: Frame[]; nums: number[] };
/** Where die i of n rests, side by side. */
export const spread = (i: number, n: number, size: number) => (i - (n - 1) / 2) * size * (n > 2 ? 1.45 : 1.7);

/** A die lying still on the table, the given value on top. */
export function resting(S: Solid, x: number, value: number): Throw {
  let R = mul(axisAngle([0, 1, 0], x > 0 ? -0.35 : 0.3), axisAngle(norm([1, 0.3, 0.2]), S.f === 6 ? 0 : 0.4));
  const t = topFace(S, R);
  if (t.ang > 1e-4) R = mul(axisAngle(t.axis, t.ang), R);
  return { frames: [{ p: [x, -S.inr, 0], R }], nums: numbers(S, topFace(S, R).best, Math.min(S.f, value)) };
}

/** A tiny rigid-body throw (gravity, bounces, friction) simulated up front; the face on top gets `value`. */
export function simulate(S: Solid, size: number, value: number, targetX: number, lane: number): Throw {
  const half = S.inr, g = 2600 * (size / 96), dt = 1 / 120;
  let p: V = [-size * 4.2, -size * 2.6, lane * size * 0.4];
  let v: V = [size * (5.2 + Math.random()), -size * 1.2, (Math.random() - 0.5) * size];
  let w: V = [(Math.random() - 0.5) * 30, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 30];
  let R = mul(axisAngle(norm([Math.random(), Math.random(), Math.random()]), Math.random() * 6), I);
  const frames: Frame[] = [];
  for (let step = 0; step * dt < 1.15; step++) {
    v[1] += g * dt;
    p = [p[0] + v[0] * dt, p[1] + v[1] * dt, p[2] + v[2] * dt];
    if (p[1] > -half) { // hit the table
      p[1] = -half;
      v = [v[0] * 0.62, -v[1] * 0.42, v[2] * 0.62];
      w = [w[0] * 0.62, w[1] * 0.7, w[2] * 0.62];
    }
    const sp = Math.hypot(...w);
    if (sp > 0.001) R = mul(axisAngle(norm(w), sp * dt), R);
    w = [w[0] * 0.992, w[1] * 0.992, w[2] * 0.992];
    if (step % 2 === 0) frames.push({ p, R }); // 120 Hz physics, 60 fps playback
  }
  // settle: tip onto the face that points most upwards (its opposite lies flat on the table), slide to rest
  const { best, axis, ang } = topFace(S, R);
  const p0 = p, steps = 20;
  for (let i = 1; i <= steps; i++) {
    const k = 1 - (1 - i / steps) ** 3;
    frames.push({ p: [p0[0] + v[0] * 0.05 * k, -half, p0[2]], R: ang > 1e-4 ? mul(axisAngle(axis, ang * k), R) : R });
  }
  // shift the whole throw so it comes to rest where we want it
  const end = frames[frames.length - 1].p;
  const dx = targetX - end[0], dz = lane * size * 0.25 - end[2];
  for (const f of frames) f.p = [f.p[0] + dx, f.p[1], f.p[2] + dz];
  return { frames, nums: numbers(S, best, value) };
}
