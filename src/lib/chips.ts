export const CHIPS = [1, 5, 25, 100, 500, 1000, 5000];
export const chipOf = (amt: number) => [...CHIPS].reverse().find((c) => c <= amt) ?? 1;
export const short = (n: number) => (n >= 1e6 ? +(n / 1e6).toFixed(1) + 'M' : n >= 1000 ? +(n / 1000).toFixed(1) + 'K' : String(+n.toFixed(2)));
