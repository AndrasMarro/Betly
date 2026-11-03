<script lang="ts">
  let { sym }: { sym: string } = $props();
  const uid = $props.id();
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
  {:else if sym === 'comet'}
    <defs><linearGradient id="{uid}-tail" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6ad5ff" stop-opacity="0" /><stop offset="1" stop-color="#6ad5ff" /></linearGradient></defs>
    <path d="M10 14 L62 54 L50 66 Z" fill="url(#{uid}-tail)" /><path d="M24 10 L66 50 L58 58 Z" fill="url(#{uid}-tail)" opacity=".6" />
    <circle cx="66" cy="64" r="18" fill="#bff0ff" /><circle cx="66" cy="64" r="12" fill="#ffffff" />
  {:else if sym === 'moon'}
    <path d="M62 14 A36 36 0 1 0 86 64 A28 28 0 1 1 62 14 Z" fill="#e8ebf5" />
    <circle cx="40" cy="60" r="5" fill="#c6cbdc" /><circle cx="52" cy="76" r="3.5" fill="#c6cbdc" /><circle cx="34" cy="42" r="3" fill="#c6cbdc" />
  {:else if sym === 'planet'}
    <defs><radialGradient id="{uid}-pl" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffd08a" /><stop offset="1" stop-color="#d9622b" /></radialGradient></defs>
    <ellipse cx="50" cy="52" rx="44" ry="12" fill="none" stroke="#f2c046" stroke-width="5" transform="rotate(-18 50 52)" />
    <circle cx="50" cy="50" r="26" fill="url(#{uid}-pl)" />
    <path d="M6 52 A44 12 0 0 0 94 52" fill="none" stroke="#f2c046" stroke-width="5" transform="rotate(-18 50 52)" />
  {:else if sym === 'ufo'}
    <ellipse cx="50" cy="44" rx="18" ry="16" fill="#8fe3ff" opacity=".9" />
    <ellipse cx="50" cy="58" rx="42" ry="14" fill="#9aa3b8" /><ellipse cx="50" cy="54" rx="42" ry="10" fill="#d7dce8" />
    {#each [22, 36, 50, 64, 78] as x}<circle cx={x} cy="60" r="3.5" fill="#f2c046" />{/each}
    <path d="M38 72 L30 90 L70 90 L62 72 Z" fill="#8fe3ff" opacity=".25" />
  {:else if sym === 'sun'}
    {#each Array(12) as _, i}<path d="M50 6 L55 22 L45 22 Z" fill="#ffb02e" transform="rotate({i * 30} 50 50)" />{/each}
    <circle cx="50" cy="50" r="26" fill="#ffd34d" stroke="#f08a1c" stroke-width="3" />
    <circle cx="42" cy="44" r="6" fill="#fff" opacity=".45" />
  {:else if sym === 'horseshoe'}
    <path d="M24 20 C24 72 34 86 50 86 C66 86 76 72 76 20 L62 20 C62 62 58 72 50 72 C42 72 38 62 38 20 Z" fill="#c7ccd8" stroke="#8a90a2" stroke-width="2" />
    {#each [[31, 34], [69, 34], [32, 54], [68, 54]] as [x, y]}<circle cx={x} cy={y} r="2.8" fill="#6a7082" />{/each}
  {:else if sym === 'coin'}
    <circle cx="50" cy="50" r="36" fill="#f2c046" stroke="#b9821f" stroke-width="4" />
    <circle cx="50" cy="50" r="27" fill="none" stroke="#fff3c4" stroke-width="2" opacity=".7" />
    <text x="50" y="52" class="t" fill="#8a5d12" font-size="34">B</text>
  {:else if sym === 'hat'}
    <rect x="28" y="16" width="44" height="50" rx="5" fill="#1f7a46" /><rect x="28" y="50" width="44" height="9" fill="#1d1d22" />
    <rect x="44" y="49" width="12" height="11" rx="2" fill="#f2c046" /><ellipse cx="50" cy="70" rx="40" ry="10" fill="#1a6a3c" />
  {:else if sym === 'pot'}
    {#each [[34, 30], [46, 24], [58, 28], [66, 34], [40, 36], [52, 34]] as [x, y]}<circle cx={x} cy={y} r="8" fill="#f2c046" stroke="#b9821f" stroke-width="2" />{/each}
    <path d="M18 40 H82 L76 80 C70 90 30 90 24 80 Z" fill="#26262c" /><rect x="14" y="36" width="72" height="10" rx="5" fill="#3a3a44" />
  {:else if sym === 'clover'}
    {#each [0, 90, 180, 270] as r}<path d="M50 50 C36 46 30 30 40 22 C46 18 50 24 50 30 C50 24 54 18 60 22 C70 30 64 46 50 50 Z" fill="#2fbf71" stroke="#1a7a46" stroke-width="2" transform="rotate({r} 50 50)" />{/each}
    <path d="M50 50 Q58 72 52 92" stroke="#1a7a46" stroke-width="5" fill="none" stroke-linecap="round" />
  {/if}
</svg>

<style>
  .sym { width: 100%; height: 100%; display: block; filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.35)); }
  .t { font-family: 'Geist Variable', sans-serif; font-weight: 800; text-anchor: middle; dominant-baseline: middle; letter-spacing: -0.02em; }
  .seven { fill: #e83346; stroke: #7a0d18; stroke-width: 3; font-style: italic; }
</style>
