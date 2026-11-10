<script lang="ts">
  import { WHEEL, color, neighbours, ANNOUNCED } from '../games/roulette';
  import { t } from '../lib/i18n';
  let { onbet, onhover, disabled = false }: { onbet: (groups: number[][]) => void; onhover: (nums: number[]) => void; disabled?: boolean } = $props();

  // Stadium path: starts at the right end (zero) and runs clockwise.
  const R = 46, L = 300, CX1 = 54, CX2 = CX1 + L, CY = 56;
  const per = 2 * L + 2 * Math.PI * R;
  function at(s: number) {
    const q = (Math.PI * R) / 2;
    if (s < q) { const a = s / R; return [CX2 + R * Math.cos(a), CY + R * Math.sin(a)]; }
    s -= q;
    if (s < L) return [CX2 - s, CY + R];
    s -= L;
    if (s < Math.PI * R) { const a = Math.PI / 2 + s / R; return [CX1 + R * Math.cos(a), CY + R * Math.sin(a)]; }
    s -= Math.PI * R;
    if (s < L) return [CX1 + s, CY - R];
    s -= L;
    const a = -Math.PI / 2 + s / R;
    return [CX2 + R * Math.cos(a), CY + R * Math.sin(a)];
  }
  const slots = WHEEL.map((n, i) => ({ n, p: at((i / 37) * per) }));
  // the inner field is split into four equal segments that fill it exactly (ends follow the rounded track)
  const IN = R - 24, X0 = CX1 - IN, X1 = CX2 + IN, B = [X0, CX1 + 75, CX1 + 150, CX1 + 225, X1];
  const sections: [string, string, number, number][] = [['tiers', 'r.tiers', B[0], B[1]], ['orphelins', 'r.orphelins', B[1], B[2]], ['voisins', 'r.voisins', B[2], B[3]], ['zero', 'r.zero', B[3], B[4]]];
  const inner = `M${CX1} ${CY - IN} H${CX2} A${IN} ${IN} 0 0 1 ${CX2} ${CY + IN} H${CX1} A${IN} ${IN} 0 0 1 ${CX1} ${CY - IN}Z`;
  const uid = $props.id();
</script>

<svg viewBox="-2 -2 {CX2 + R + 16} {2 * CY + 4}" class="track" class:disabled role="group" aria-label={t('r.racetrack')}>
  <path d="M{CX1} {CY - R} H{CX2} A{R} {R} 0 0 1 {CX2} {CY + R} H{CX1} A{R} {R} 0 0 1 {CX1} {CY - R}Z" class="outline" />
  <defs><clipPath id="{uid}-in"><path d={inner} /></clipPath></defs>
  {#each sections as [key, label, a, b]}
    <g
      class="sec"
      role="button"
      tabindex="0"
      onclick={() => onbet(ANNOUNCED[key])}
      onkeydown={(e) => e.key === 'Enter' && onbet(ANNOUNCED[key])}
      onpointerenter={() => onhover(ANNOUNCED[key].flat())}
      onpointerleave={() => onhover([])}>
      <rect x={a} y={CY - IN} width={b - a} height={IN * 2} clip-path="url(#{uid}-in)" />
      <text x={(a + b) / 2} y={CY + 1}>{t(label as any)}</text>
    </g>
  {/each}
  {#each B.slice(1, -1) as x}<line x1={x} x2={x} y1={CY - IN} y2={CY + IN} class="div" />{/each}
  <path d={inner} class="outline inner" />
  {#each slots as { n, p }}
    <g
      class="slot {color(n)}"
      role="button"
      tabindex="-1"
      aria-label={String(n)}
      onclick={() => onbet(neighbours(n))}
      onkeydown={() => {}}
      onpointerenter={() => onhover(neighbours(n).flat())}
      onpointerleave={() => onhover([])}>
      <circle cx={p[0]} cy={p[1]} r="11" />
      <text x={p[0]} y={p[1] + 0.5}>{n}</text>
    </g>
  {/each}
</svg>

<style>
  .track { width: 100%; height: auto; display: block; user-select: none; }
  .disabled { pointer-events: none; opacity: 0.5; }
  .outline { fill: rgba(0, 0, 0, 0.12); stroke: var(--felt-line); stroke-width: 1; }
  .outline.inner { fill: none; }
  text { font: 700 9px 'Geist Variable', sans-serif; text-anchor: middle; dominant-baseline: middle; fill: #fff; pointer-events: none; }
  .sec rect { fill: transparent; stroke: transparent; transition: fill 0.2s; }
  .sec text { font: 600 8px 'Geist Mono Variable', monospace; letter-spacing: 0.08em; text-transform: uppercase; fill: rgba(255, 255, 255, 0.85); }
  .sec, .slot { cursor: pointer; outline: none; }
  .sec:hover rect, .sec:focus-visible rect { fill: rgba(255, 255, 255, 0.12); }
  .div { stroke: var(--felt-line); stroke-width: 1; opacity: 0.6; }
  .slot circle { stroke: rgba(255, 255, 255, 0.35); stroke-width: 0.8; transition: transform 0.2s; }
  .slot.red circle { fill: var(--pocket-red); }
  .slot.black circle { fill: var(--pocket-black); }
  .slot.green circle { fill: var(--pocket-green); }
  .slot:hover circle { stroke: #fff; stroke-width: 1.6; }
</style>
