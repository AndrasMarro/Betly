<script lang="ts">
  // Small hand-drawn SVG sprites shared by the arcade games and their lobby art.
  let { kind, n = 1, color = '#e5484d' }: { kind: 'rocket' | 'gem' | 'bomb' | 'chicken' | 'car' | 'die' | 'boom'; n?: number; color?: string } = $props();
  const PIPS: Record<number, [number, number][]> = {
    1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
    6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
  };
</script>

<svg viewBox="0 0 100 100" class="sprite" aria-hidden="true">
  {#if kind === 'rocket'}
    <path d="M50 6 C66 20 70 42 66 66 H34 C30 42 34 20 50 6Z" fill="#f4f2ee" />
    <path d="M50 6 C58 13 63 22 65 32 H35 C37 22 42 13 50 6Z" fill={color} />
    <circle cx="50" cy="44" r="8" fill="#6aa8ff" stroke="#1d1d22" stroke-width="3" />
    <path d="M34 50 L20 72 L34 68Z M66 50 L80 72 L66 68Z" fill={color} />
    <path d="M40 66 H60 L56 76 H44Z" fill="#8a8a92" />
  {:else if kind === 'boom'}
    <polygon points="50,4 60,32 90,22 70,48 96,62 64,66 70,96 50,74 30,96 36,66 4,62 30,48 10,22 40,32" fill="#ffb02e" />
    <polygon points="50,22 56,40 74,36 62,52 76,62 58,62 60,80 50,66 40,80 42,62 24,62 38,52 26,36 44,40" fill="#ff5a3c" />
  {:else if kind === 'gem'}
    <polygon points="50,10 84,34 72,88 28,88 16,34" fill="#0d7a4c" />
    <polygon points="50,10 84,34 50,44 16,34" fill="#4fe3a0" />
    <polygon points="50,44 72,88 28,88" fill="#4fe3a0" opacity=".7" />
    <polygon points="36,22 50,14 56,24" fill="#fff" opacity=".55" />
  {:else if kind === 'bomb'}
    <circle cx="46" cy="58" r="30" fill="#1d1d22" stroke="#4a4a52" stroke-width="2" />
    <rect x="58" y="20" width="14" height="14" rx="3" transform="rotate(40 65 27)" fill="#4a4a52" />
    <path d="M70 18 Q78 6 88 10" stroke="#d8b26a" stroke-width="3" fill="none" />
    <circle cx="89" cy="9" r="5" fill="#ffb02e" />
    <circle cx="36" cy="46" r="7" fill="#fff" opacity=".25" />
  {:else if kind === 'chicken'}
    <ellipse cx="50" cy="60" rx="28" ry="26" fill="#fbfaf6" />
    <circle cx="58" cy="34" r="16" fill="#fbfaf6" />
    <path d="M52 18 Q55 10 60 16 Q64 8 68 18 Z" fill="#e5484d" />
    <path d="M72 34 L84 38 L72 42Z" fill="#f2c046" />
    <circle cx="62" cy="31" r="3" fill="#1d1d22" />
    <path d="M68 44 Q72 50 66 52" fill="#e5484d" />
    <path d="M28 60 Q40 52 46 64 Q36 70 28 60Z" fill="#e8e4da" />
    <path d="M42 86 V94 M56 86 V94" stroke="#f2c046" stroke-width="4" stroke-linecap="round" />
  {:else if kind === 'car'}
    <rect x="22" y="6" width="56" height="88" rx="16" fill={color} />
    <rect x="30" y="22" width="40" height="18" rx="5" fill="#1d1d22" opacity=".75" />
    <rect x="30" y="64" width="40" height="14" rx="5" fill="#1d1d22" opacity=".6" />
    <rect x="26" y="8" width="10" height="5" rx="2" fill="#fff6c2" /><rect x="64" y="8" width="10" height="5" rx="2" fill="#fff6c2" />
  {:else if kind === 'die'}
    <rect x="6" y="6" width="88" height="88" rx="18" fill="#fbfaf6" stroke="#d6d2c8" stroke-width="2" />
    {#each PIPS[n] ?? [] as [x, y]}<circle cx={x} cy={y} r="8" fill={n === 1 ? '#c8262c' : '#1d1d22'} />{/each}
  {/if}
</svg>

<style>
  .sprite { width: 100%; height: 100%; display: block; overflow: visible; }
</style>
