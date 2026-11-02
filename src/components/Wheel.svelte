<script lang="ts">
  import { WHEEL, color } from '../games/roulette';
  let { rotation = 0, ball = null, mono = false, highlight = -1 }: { rotation?: number; ball?: { a: number; r: number } | null; mono?: boolean; highlight?: number } = $props();

  const step = 360 / 37;
  const pt = (deg: number, r: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(r * Math.sin(a)).toFixed(3)} ${(-r * Math.cos(a)).toFixed(3)}`;
  };
  const wedge = (i: number, r1: number, r2: number) => {
    const a = i * step - step / 2, b = a + step;
    return `M${pt(a, r2)} A${r2} ${r2} 0 0 1 ${pt(b, r2)} L${pt(b, r1)} A${r1} ${r1} 0 0 0 ${pt(a, r1)}Z`;
  };
  const fill = (n: number) => (mono ? (color(n) === 'black' ? 'var(--surface-2)' : color(n) === 'red' ? 'var(--accent)' : 'var(--text)') : `var(--pocket-${color(n)})`);
  const bx = $derived(ball ? ball.r * Math.sin((ball.a * Math.PI) / 180) : 0);
  const by = $derived(ball ? -ball.r * Math.cos((ball.a * Math.PI) / 180) : 0);
</script>

<svg viewBox="-100 -100 200 200" class="wheel" class:mono aria-hidden="true">
  <defs>
    <radialGradient id="rim" cx="0.5" cy="0.4" r="0.6">
      <stop offset="0" stop-color="#5a3a22" /><stop offset="1" stop-color="#2a1a10" />
    </radialGradient>
    <radialGradient id="cone" cx="0.45" cy="0.4" r="0.7">
      <stop offset="0" stop-color="#7a5232" /><stop offset="1" stop-color="#3a2414" />
    </radialGradient>
    <radialGradient id="ballg" cx="0.35" cy="0.3" r="0.8">
      <stop offset="0" stop-color="#fff" /><stop offset="1" stop-color="#bdbdbd" />
    </radialGradient>
  </defs>
  <circle r="99" fill={mono ? 'var(--bg-2)' : 'url(#rim)'} stroke="var(--line-2)" stroke-width="0.6" />
  <circle r="84" fill={mono ? 'var(--bg)' : '#1a120c'} />
  <g transform="rotate({rotation})">
    {#each WHEEL as n, i}
      <path d={wedge(i, 56, 80)} fill={fill(n)} stroke={mono ? 'var(--line-2)' : '#d8b26a'} stroke-width="0.4" class:hit={n === highlight} />
      <text transform="rotate({i * step}) translate(0 -73.5)" class="num" fill={mono && color(n) !== 'black' ? 'var(--bg)' : '#fff'}>{n}</text>
    {/each}
    <circle r="56" fill={mono ? 'var(--surface)' : 'url(#cone)'} stroke={mono ? 'var(--line-2)' : '#d8b26a'} stroke-width="0.6" />
    <circle r="62" fill="none" stroke={mono ? 'var(--line-2)' : '#d8b26a'} stroke-width="0.35" opacity="0.6" />
    {#each [0, 1, 2, 3] as k}
      <rect x="-2" y="-40" width="4" height="80" rx="2" fill={mono ? 'var(--line-2)' : '#d8b26a'} transform="rotate({k * 45})" />
    {/each}
    <circle r="9" fill={mono ? 'var(--surface-2)' : '#e7c27a'} stroke={mono ? 'var(--line-2)' : '#8a6630'} />
  </g>
  {#if ball}
    <circle cx={bx} cy={by} r="3.6" fill="url(#ballg)" class="ball" />
  {/if}
</svg>

<style>
  .wheel { width: 100%; height: auto; display: block; filter: drop-shadow(0 30px 60px rgba(0, 0, 0, 0.45)); }
  .num { font: 700 6.2px 'Geist Variable', sans-serif; text-anchor: middle; dominant-baseline: middle; }
  .hit { animation: blink 0.8s ease-in-out infinite alternate; }
  @keyframes blink { to { opacity: 0.45; } }
  .ball { filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.6)); }
</style>
