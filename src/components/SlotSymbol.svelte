<script lang="ts">
  let { sym }: { sym: string } = $props();
  const gem: Record<string, [string, string]> = {
    amethyst: ['#b57bff', '#5b2aa8'], emerald: ['#4fe3a0', '#0d7a4c'], sapphire: ['#6aa8ff', '#1846a8'], ruby: ['#ff6b7a', '#a3122a'],
  };
</script>

<svg viewBox="0 0 100 100" class="sym" aria-label={sym} role="img">
  {#if sym === 'cherry'}
    <path d="M50 18 C46 34 38 46 32 58 M50 18 C56 36 62 46 68 56" stroke="#3f8f3a" stroke-width="5" fill="none" stroke-linecap="round" />
    <path d="M50 18 C60 12 72 14 78 22 C66 24 58 22 50 18Z" fill="#4fae47" />
    <circle cx="32" cy="66" r="17" fill="#d8283a" /><circle cx="68" cy="64" r="17" fill="#e83346" />
    <circle cx="26" cy="60" r="5" fill="#fff" opacity=".45" /><circle cx="62" cy="58" r="5" fill="#fff" opacity=".45" />
  {:else if sym === 'lemon'}
    <path d="M14 50 C14 28 36 18 50 18 C64 18 86 28 86 50 C86 72 64 82 50 82 C36 82 14 72 14 50Z" fill="#f5d33d" transform="rotate(-20 50 50)" />
    <ellipse cx="38" cy="38" rx="10" ry="5" fill="#fff" opacity=".45" transform="rotate(-30 38 38)" />
  {:else if sym === 'plum'}
    <circle cx="50" cy="56" r="28" fill="#7a3fb5" /><path d="M50 30 C50 22 54 16 60 12" stroke="#3f8f3a" stroke-width="5" fill="none" stroke-linecap="round" />
    <path d="M50 30 Q50 56 50 82" stroke="#5d2a90" stroke-width="3" fill="none" /><circle cx="38" cy="44" r="6" fill="#fff" opacity=".35" />
  {:else if sym === 'bell'}
    <path d="M50 14 C30 14 26 34 26 50 C26 62 20 68 16 74 H84 C80 68 74 62 74 50 C74 34 70 14 50 14Z" fill="#f2c046" stroke="#a7781c" stroke-width="3" />
    <circle cx="50" cy="80" r="7" fill="#a7781c" /><path d="M36 30 C34 38 34 46 34 54" stroke="#fff" stroke-width="5" opacity=".45" stroke-linecap="round" />
  {:else if sym === 'bar'}
    <rect x="10" y="32" width="80" height="36" rx="8" fill="#16161a" stroke="#d8b26a" stroke-width="4" />
    <text x="50" y="52" class="t" fill="#f4f2ee" font-size="24">BAR</text>
  {:else if sym === 'seven'}
    <text x="50" y="56" class="t seven" font-size="84">7</text>
  {:else if sym in gem}
    <polygon points="50,10 84,34 72,88 28,88 16,34" fill={gem[sym][1]} />
    <polygon points="50,10 84,34 50,44 16,34" fill={gem[sym][0]} />
    <polygon points="50,44 72,88 28,88" fill={gem[sym][0]} opacity=".7" />
    <polygon points="16,34 50,44 28,88" fill={gem[sym][1]} opacity=".7" />
    <polygon points="36,22 50,14 56,24" fill="#fff" opacity=".55" />
  {:else if sym === 'crown'}
    <path d="M14 74 L18 32 L36 52 L50 22 L64 52 L82 32 L86 74Z" fill="#f2c046" stroke="#a7781c" stroke-width="3" stroke-linejoin="round" />
    <rect x="14" y="74" width="72" height="10" rx="3" fill="#d39e2c" />
    <circle cx="50" cy="60" r="6" fill="#e83346" /><circle cx="32" cy="64" r="4" fill="#4f8dff" /><circle cx="68" cy="64" r="4" fill="#4fe3a0" />
  {:else if sym === 'wild'}
    <rect x="8" y="26" width="84" height="48" rx="12" fill="url(#wildg)" />
    <defs><linearGradient id="wildg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5ea8" /><stop offset="1" stop-color="#7a3fb5" /></linearGradient></defs>
    <text x="50" y="52" class="t" fill="#fff" font-size="26">WILD</text>
  {:else if sym === 'star'}
    <polygon points="50,8 61,38 93,38 67,57 77,89 50,70 23,89 33,57 7,38 39,38" fill="#f2c046" stroke="#a7781c" stroke-width="3" stroke-linejoin="round" />
    <polygon points="50,22 56,40 44,40" fill="#fff" opacity=".5" />
  {/if}
</svg>

<style>
  .sym { width: 100%; height: 100%; display: block; filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.35)); }
  .t { font-family: 'Geist Variable', sans-serif; font-weight: 800; text-anchor: middle; dominant-baseline: middle; letter-spacing: -0.02em; }
  .seven { fill: #e83346; stroke: #7a0d18; stroke-width: 3; font-style: italic; }
</style>
