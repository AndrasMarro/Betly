<script lang="ts">
  // Small hand-drawn SVG sprites shared by the arcade games and their lobby art.
  let { kind, n = 1, color = '#e5484d', flame = false }: { kind: 'rocket' | 'gem' | 'bomb' | 'chicken' | 'car' | 'die' | 'boom'; n?: number; color?: string; flame?: boolean } = $props();
  const uid = $props.id();
  const PIPS: Record<number, [number, number][]> = {
    1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
    6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
  };
</script>

<svg viewBox="0 0 100 100" class="sprite" aria-hidden="true">
  {#if kind === 'rocket'}
    <defs>
      <linearGradient id="{uid}-hull" x1="0" x2="1"><stop offset="0" stop-color="#ffffff" /><stop offset=".55" stop-color="#e9e7f2" /><stop offset="1" stop-color="#a9a6bd" /></linearGradient>
      <linearGradient id="{uid}-red" x1="0" x2="1"><stop offset="0" stop-color="#ff6b6f" /><stop offset="1" stop-color="#b3202a" /></linearGradient>
      <radialGradient id="{uid}-glass" cx=".35" cy=".35" r=".8"><stop offset="0" stop-color="#bfe3ff" /><stop offset=".6" stop-color="#3f7fd9" /><stop offset="1" stop-color="#1b3c7a" /></radialGradient>
      <linearGradient id="{uid}-fire" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c2" /><stop offset=".35" stop-color="#ffb02e" /><stop offset="1" stop-color="#ff4d2e" stop-opacity="0" /></linearGradient>
    </defs>
    {#if flame}
      <g class="flame"><path d="M42 74 Q50 112 58 74 Z" fill="url(#{uid}-fire)" /><path d="M46 74 Q50 96 54 74 Z" fill="#fffbe6" /></g>
    {/if}
    <path d="M36 52 L22 72 L24 78 L38 70 Z M64 52 L78 72 L76 78 L62 70 Z" fill="url(#{uid}-red)" />
    <path d="M50 4 C64 16 68 36 66 58 L64 72 H36 L34 58 C32 36 36 16 50 4 Z" fill="url(#{uid}-hull)" />
    <path d="M50 4 C58 10 62 18 64 26 H36 C38 18 42 10 50 4 Z" fill="url(#{uid}-red)" />
    <circle cx="50" cy="40" r="8.5" fill="#3a3a46" /><circle cx="50" cy="40" r="6.5" fill="url(#{uid}-glass)" />
    <path d="M47 37 A4 4 0 0 1 52 35" stroke="#fff" stroke-width="1.5" fill="none" opacity=".8" stroke-linecap="round" />
    <rect x="47.5" y="54" width="5" height="18" rx="2.5" fill="url(#{uid}-red)" />
    <path d="M38 72 H62 L58 80 H42 Z" fill="#4a4858" />
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
    <defs>
      <linearGradient id="{uid}-plum" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" /><stop offset="1" stop-color="#e6dfcf" /></linearGradient>
      <linearGradient id="{uid}-wing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#efe8da" /><stop offset="1" stop-color="#cfc5b0" /></linearGradient>
      <linearGradient id="{uid}-comb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5d63" /><stop offset="1" stop-color="#c41f2b" /></linearGradient>
    </defs>
    <ellipse cx="50" cy="94" rx="20" ry="3.5" fill="#000" opacity=".25" />
    <g stroke="#f29f1b" stroke-width="3" stroke-linecap="round" fill="none">
      <path d="M45 78 L43 91 M43 91 L38 93 M43 91 L47 93.5" /><path d="M55 78 L57 91 M57 91 L52 93.5 M57 91 L61 93" />
    </g>
    <path d="M27 52 C16 46 14 30 22 22 C24 32 29 38 35 41 Z" fill="#d9d0bd" />
    <path d="M30 48 C22 40 24 28 30 24 C31 33 34 38 39 41 Z" fill="#ece6d8" />
    <path d="M30 57 C30 41 44 33 58 36 C71 39 77 50 75 62 C73 75 62 82 48 81 C36 80 30 70 30 57 Z" fill="url(#{uid}-plum)" />
    <path d="M55 40 C56 30 60 20 66 18 C75 16 81 23 80 31 C79 38 74 42 70 46 Z" fill="url(#{uid}-plum)" />
    <path d="M60 17 C58 10 64 7 66 12 C67 5 74 6 73 12 C77 9 81 13 77 18 C72 16 65 16 60 17 Z" fill="url(#{uid}-comb)" />
    <path d="M79 27 L89 30 L79 33 Z" fill="#f5a524" /><path d="M79 30 L89 30 L79 33 Z" fill="#d9821a" />
    <path d="M77 35 C80 38 79 44 75 43 C73 41 74 37 77 35 Z" fill="url(#{uid}-comb)" />
    <circle cx="72" cy="25" r="2.8" fill="#1d1d22" /><circle cx="72.9" cy="24.1" r=".9" fill="#fff" />
    <path d="M38 56 C44 47 59 48 63 57 C59 68 46 70 38 63 Z" fill="url(#{uid}-wing)" />
    <path d="M44 60 C49 58 54 58 58 61 M42 64 C47 63 52 63 56 65" stroke="#bdb39c" stroke-width="1.4" fill="none" stroke-linecap="round" />
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
  .flame { transform-origin: 50px 74px; animation: flicker 0.12s linear infinite alternate; }
  @keyframes flicker { from { transform: scaleY(0.85) scaleX(1.05); } to { transform: scaleY(1.15) scaleX(0.92); } }
</style>
