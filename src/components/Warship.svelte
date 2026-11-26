<script lang="ts">
  // A First World War warship seen from above, bow to the right: grey hull, teak deck, gun turrets,
  // funnels with soot, bridge and masts. The length picks the class: 5 dreadnought, 4 battlecruiser,
  // 3 cruiser, 2 destroyer. Sunk ships turn dark and scorched.
  // k: 'sub' draws a submarine (cigar hull, conning tower, periscope), 'armor' adds riveted belt plates.
  let { len, sunk = false, k }: { len: number; sunk?: boolean; k?: 'sub' | 'armor' } = $props();
  const uid = $props.id();
  const W = $derived(len * 100);
  type Kit = { turrets: [number, number][]; funnels: number[]; bridge: number; masts: number[]; boats: number[]; small?: boolean };
  // positions as a share of the length; turrets: [x, facing] (1 = forward, -1 = aft)
  const KIT: Record<number, Kit> = {
    5: { turrets: [[0.12, -1], [0.24, -1], [0.64, 1], [0.77, 1]], funnels: [0.39, 0.48], bridge: 0.56, masts: [0.33, 0.58], boats: [0.43] },
    4: { turrets: [[0.14, -1], [0.68, 1], [0.8, 1]], funnels: [0.34, 0.44, 0.54], bridge: 0.61, masts: [0.27, 0.63], boats: [0.39, 0.49] },
    3: { turrets: [[0.15, -1], [0.8, 1]], funnels: [0.42, 0.55], bridge: 0.66, masts: [0.32, 0.68], boats: [0.48] },
    2: { turrets: [[0.17, -1], [0.83, 1]], funnels: [0.42, 0.52, 0.62], bridge: 0.72, masts: [0.74], boats: [], small: true },
  };
  const kit = $derived(KIT[len] ?? KIT[3]);
  const hull = $derived(`M 10 31 Q 2 50 10 69 L ${W * 0.7} 76 Q ${W * 0.93} 72 ${W - 3} 50 Q ${W * 0.93} 28 ${W * 0.7} 24 Z`);
  const deck = $derived(`M 15 35 Q 9 50 15 65 L ${W * 0.7} 70 Q ${W * 0.9} 67 ${W - 14} 50 Q ${W * 0.9} 33 ${W * 0.7} 30 Z`);
</script>

{#if k === 'sub'}
<svg class="ship" class:sunk viewBox="0 0 {W} 100" preserveAspectRatio="none" aria-hidden="true">
  <defs>
    <linearGradient id="{uid}-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2a2f" /><stop offset=".45" stop-color="#4f6a70" /><stop offset="1" stop-color="#151e22" /></linearGradient>
  </defs>
  <path d="M 6 50 Q -14 50 6 42 M 6 50 Q -14 50 6 58" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="2.5" />
  <path d="M 8 50 Q 10 33 {W * 0.2} 32 L {W * 0.8} 32 Q {W - 4} 36 {W - 3} 50 Q {W - 4} 64 {W * 0.8} 68 L {W * 0.2} 68 Q 10 67 8 50 Z" fill="url(#{uid}-s)" stroke="#0c1316" stroke-width="2" />
  <path d="M {W * 0.12} 50 H {W * 0.9}" stroke="rgba(180,220,220,.25)" stroke-width="1.5" stroke-dasharray="6 5" />
  {#each [0.18, 0.3, 0.7, 0.82] as h}<circle cx={W * h} cy="40" r="2" fill="#0c1316" /><circle cx={W * h} cy="60" r="2" fill="#0c1316" />{/each}
  <rect x={W * 0.42} y="38" width={W * 0.18} height="24" rx="11" fill="#2e4146" stroke="#0c1316" stroke-width="1.6" />
  <rect x={W * 0.47} y="44" width={W * 0.08} height="12" rx="5" fill="#4f6a70" />
  <circle cx={W * 0.53} cy="50" r="3" fill="#c9d6d8" stroke="#0c1316" stroke-width="1" />
  <path d="M {W * 0.53} 50 L {W * 0.6} 46" stroke="#c9d6d8" stroke-width="1.6" />
  <rect x={W * 0.68} y="47" width="16" height="6" rx="2" fill="#2e4146" /><rect x={W * 0.68 + 12} y="48.5" width="14" height="3" rx="1.5" fill="#1b2629" />
  <path d="M {W - 6} 50 L {W * 0.88} 34 M {W - 6} 50 L {W * 0.88} 66" stroke="rgba(255,255,255,.35)" stroke-width="2" />
</svg>
{:else}
<svg class="ship" class:sunk viewBox="0 0 {W} 100" preserveAspectRatio="none" aria-hidden="true">
  <defs>
    <linearGradient id="{uid}-h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f353e" /><stop offset=".5" stop-color="#7f8a97" /><stop offset="1" stop-color="#262b33" /></linearGradient>
    <linearGradient id="{uid}-d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d6a40" /><stop offset=".5" stop-color="#b8915c" /><stop offset="1" stop-color="#7a5a34" /></linearGradient>
    <radialGradient id="{uid}-t" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#b3bcc7" /><stop offset="1" stop-color="#4d5560" /></radialGradient>
    <pattern id="{uid}-p" width="24" height="5" patternUnits="userSpaceOnUse"><path d="M0 4.6 H24" stroke="rgba(60,35,10,.35)" stroke-width="0.8" /><path d="M12 0 V5" stroke="rgba(60,35,10,.2)" stroke-width="0.6" /></pattern>
  </defs>
  <!-- wake at the stern and a bow wave -->
  <path d="M 10 40 Q -20 50 10 60" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="3" />
  <path d="M {W - 6} 50 L {W * 0.86} 24 M {W - 6} 50 L {W * 0.86} 76" stroke="rgba(255,255,255,.4)" stroke-width="2" />
  <path d={hull} fill="url(#{uid}-h)" stroke="#161a20" stroke-width="2" />
  <path d={deck} fill="url(#{uid}-d)" />
  <path d={deck} fill="url(#{uid}-p)" />
  {#if k === 'armor'}
    <!-- armour belt: riveted plates along both sides -->
    <path d="M 18 31.5 L {W * 0.7} 26 M 18 68.5 L {W * 0.7} 74" stroke="#c8d2dc" stroke-width="3" opacity=".8" />
    {#each Array(Math.floor(W / 40)) as _, i}<circle cx={24 + i * 40} cy={31 - i * 0.09} r="1.4" fill="#2b3038" /><circle cx={24 + i * 40} cy={69 + i * 0.09} r="1.4" fill="#2b3038" />{/each}
  {/if}
  <!-- centre superstructure from the first funnel to the bridge -->
  <rect x={W * (kit.funnels[0] - 0.05)} y="39" width={W * (kit.bridge - kit.funnels[0] + 0.08)} height="22" rx="5" fill="#8c96a3" stroke="#4b525c" stroke-width="1.5" />
  {#each kit.boats as b}<rect x={W * b - 9} y="33" width="18" height="6" rx="3" fill="#e9e4d6" stroke="#6b6455" stroke-width="1" /><rect x={W * b - 9} y="61" width="18" height="6" rx="3" fill="#e9e4d6" stroke="#6b6455" stroke-width="1" />{/each}
  <!-- bridge -->
  <rect x={W * kit.bridge - 8} y="36" width="18" height="28" rx="4" fill="#a7b0bb" stroke="#4b525c" stroke-width="1.5" />
  <path d="M {W * kit.bridge + 6} 39 V 61" stroke="#2b3038" stroke-width="2.5" />
  <!-- funnels with soot -->
  {#each kit.funnels as f}
    <ellipse cx={W * f} cy="50" rx={kit.small ? 5 : 8} ry={kit.small ? 6 : 10} fill="#3a4049" stroke="#1b1f25" stroke-width="1.5" />
    <ellipse cx={W * f} cy="50" rx={kit.small ? 3 : 5} ry={kit.small ? 3.5 : 6.5} fill="#0f1114" />
    <ellipse cx={W * f} cy="50" rx={kit.small ? 6 : 9.5} ry={kit.small ? 7 : 11.5} fill="none" stroke="#c9b48a" stroke-width="1.2" opacity=".55" />
  {/each}
  <!-- masts with yards -->
  {#each kit.masts as m}<path d="M {W * m} 30 V 70" stroke="#2a2f36" stroke-width="1.6" /><circle cx={W * m} cy="50" r="3.5" fill="#2a2f36" />{/each}
  <!-- gun turrets: barrels first, then the armoured house -->
  {#each kit.turrets as [t, face]}
    {@const x = W * t}
    {@const r = kit.small ? 8 : 13}
    {@const bl = kit.small ? 16 : 30}
    <rect x={face > 0 ? x : x - bl} y={kit.small ? 48.5 : 45.5} width={bl} height={kit.small ? 3 : 3.2} rx="1.5" fill="#3a4049" />
    {#if !kit.small}<rect x={face > 0 ? x : x - bl} y="51.3" width={bl} height="3.2" rx="1.5" fill="#3a4049" />{/if}
    <circle cx={x} cy="50" r={r + 2} fill="#59616c" />
    <path d="M {x - r} {50 - r * 0.8} H {x + r * 0.5} Q {x + r * 1.05} 50 {x + r * 0.5} {50 + r * 0.8} H {x - r} Z" fill="url(#{uid}-t)" stroke="#2c3138" stroke-width="1.2" transform={face < 0 ? `rotate(180 ${x} 50)` : ''} />
    <circle cx={x - r * 0.3 * face} cy="50" r="2" fill="#2c3138" />
  {/each}
</svg>
{/if}

<style>
  .ship { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; filter: drop-shadow(0 3px 2px rgba(0,0,0,.45)); }
  .ship.sunk { filter: grayscale(0.7) brightness(0.45) sepia(0.6) hue-rotate(-30deg) saturate(2.2); }
</style>
