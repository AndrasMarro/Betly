// JS twins of the CSS spring curves, for Svelte transitions.
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Damped spring, ~6 % overshoot, settles by t = 1 (matches --spring-snappy). */
export const spring = (t: number) => (t >= 1 ? 1 : 1 - Math.exp(-7 * t) * Math.cos(9.5 * t));

/** Element drops into place: a little high and big, then settles with a spring. */
export function drop(_: Element, { y = -16, s = 1.25, duration = 420, delay = 0 } = {}) {
  return reduce()
    ? { duration: 120, css: (t: number) => `opacity:${t}` }
    : { delay, duration, easing: spring, css: (t: number, u: number) => `transform: translateY(${u * y}px) scale(${1 + u * (s - 1)}); opacity:${Math.min(1, t * 2.5)}` };
}

/** Pop in from 90 % with a spring (never from 0). */
export function pop(_: Element, { duration = 450, delay = 0 } = {}) {
  return reduce()
    ? { duration: 120, css: (t: number) => `opacity:${t}` }
    : { delay, duration, easing: spring, css: (t: number, u: number) => `transform: scale(${1 - u * 0.1}); opacity:${Math.min(1, t * 2.5)}` };
}
