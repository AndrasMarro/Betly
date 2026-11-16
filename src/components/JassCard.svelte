<script lang="ts">
  // A Jass card. French deck: number cards reuse the poker card, König / Dame / Bauer are classic double-headed
  // portraits. The Swiss German deck (Rosen, Schilten, Eicheln, Schellen) is drawn here: pips for 6–9, the Banner
  // flag, framed Under / Ober / König and a large Ass.
  import CardView from './Card.svelte';
  import { SUIT } from '../lib/cards';
  import type { JCard } from '../games/jass';
  let { card, deck = 'de', down = false, icon = false }: { card: JCard; deck?: 'de' | 'fr'; down?: boolean; icon?: boolean } = $props();
  const uid = $props.id();
  // engine suit -> poker suit (0♠ 1♥ 2♦ 3♣): Rosen=Herz, Schilten=Schaufel, Eicheln=Kreuz, Schellen=Ecken
  const FR = [1, 0, 3, 2];
  const LABEL: Record<number, string> = { 10: '10', 11: 'U', 12: 'O', 13: 'K', 14: 'A' };
  const COURT: Record<number, string> = { 11: 'Under', 12: 'Ober', 13: 'König' };
  // pip layouts in a 250 x 350 card
  const L = 92, R = 158, M = 125;
  const PIPS: Record<number, [number, number][]> = {
    6: [[L, 95], [R, 95], [L, 175], [R, 175], [L, 255], [R, 255]],
    7: [[L, 95], [R, 95], [M, 135], [L, 175], [R, 175], [L, 255], [R, 255]],
    8: [[L, 85], [R, 85], [L, 148], [R, 148], [L, 211], [R, 211], [L, 274], [R, 274]],
    9: [[L, 85], [R, 85], [L, 148], [R, 148], [M, 180], [L, 211], [R, 211], [L, 274], [R, 274]],
  };
  const ink = $derived(['#b3261e', '#1f1f24', '#6b4313', '#b07a0c'][card.s]);
  // French portraits: red suits wear red robes, black suits blue
  const frRed = $derived(card.s === 0 || card.s === 3);
  const FR_LABEL: Record<number, string> = { 11: 'B', 12: 'D', 13: 'K' };
</script>

{#snippet portrait(r: number, red: boolean, pip: number)}
  <!-- the upper half of a French court card, drawn around the centre line y = 175; the lower half is this rotated -->
  {@const robe = red ? '#c8262c' : '#1f4fa0'}
  {@const robe2 = red ? '#1f4fa0' : '#c8262c'}
  {#if r === 12}
    <!-- Dame: long hair behind the face -->
    <path d="M100 96 C96 122 98 150 106 175 L144 175 C152 150 154 122 150 96 C146 76 104 76 100 96Z" fill="#e8b23a" stroke="#6b4a10" stroke-width="2" />
  {/if}
  <!-- robe with a gold centre band and trim -->
  <path d="M46 175 C50 152 72 138 98 134 L152 134 C178 138 200 152 204 175Z" fill={robe} stroke="#1a1a1a" stroke-width="2" />
  <path d="M60 175 C64 160 78 150 96 146 L100 175Z" fill={robe2} />
  <path d="M190 175 C186 160 172 150 154 146 L150 175Z" fill={robe2} />
  <path d="M112 134 L138 134 L134 175 L116 175Z" fill="#f2c12e" stroke="#1a1a1a" stroke-width="1.5" />
  {#each [144, 156, 168] as y}<circle cx="125" cy={y} r="3" fill="#1a1a1a" />{/each}
  {#each [70, 84, 166, 180] as x}<path d="M{x} 160 l6 -6 l6 6 l-6 6Z" fill="#f2c12e" stroke="#1a1a1a" stroke-width="1" />{/each}
  <ellipse cx="125" cy="134" rx="31" ry="7" fill="#fbf7ee" stroke="#1a1a1a" stroke-width="1.5" />
  {#if r === 13}
    <!-- König: grey hair, full beard, crown and sceptre -->
    <path d="M104 94 C98 110 100 124 108 130 L112 108Z M146 94 C152 110 150 124 142 130 L138 108Z" fill="#d9d2bf" stroke="#3a2a1a" stroke-width="1.5" />
  {:else if r === 11}
    <path d="M105 92 C100 106 102 116 108 122 L110 102Z M145 92 C150 106 148 116 142 122 L140 102Z" fill="#7a4a1e" stroke="#3a2a1a" stroke-width="1.5" />
  {/if}
  <ellipse cx="125" cy="102" rx="19" ry="23" fill="#f8dcb8" stroke="#3a2a1a" stroke-width="1.5" />
  <circle cx="118" cy="98" r="1.9" fill="#1a1a1a" /><circle cx="132" cy="98" r="1.9" fill="#1a1a1a" />
  <path d="M113 92 q5 -3 9 0 M128 92 q5 -3 9 0" stroke="#3a2a1a" stroke-width="1.5" fill="none" />
  <path d="M125 100 L122 109 L127 109" stroke="#8a5a3a" stroke-width="1.5" fill="none" />
  {#if r === 13}
    <path d="M106 108 C107 128 117 138 125 138 C133 138 143 128 144 108 C139 118 132 120 125 120 C118 120 111 118 106 108Z" fill="#e9e2cf" stroke="#3a2a1a" stroke-width="1.5" />
    <path d="M117 114 Q125 110 133 114" stroke="#3a2a1a" stroke-width="2" fill="none" />
    <path d="M102 82 L102 60 L111 71 L118 54 L125 68 L132 54 L139 71 L148 60 L148 82Z" fill="#f2c12e" stroke="#7a5212" stroke-width="2" />
    <rect x="102" y="76" width="46" height="8" fill={robe} stroke="#7a5212" stroke-width="1.5" />
    <circle cx="125" cy="66" r="3.5" fill={robe2} /><circle cx="111" cy="70" r="2.5" fill="#fff" /><circle cx="139" cy="70" r="2.5" fill="#fff" />
    <path d="M68 172 L80 74" stroke="#7a5212" stroke-width="5" stroke-linecap="round" />
    <circle cx="81" cy="68" r="7" fill="#f2c12e" stroke="#7a5212" stroke-width="2" />
    <path d="M81 52 V62 M76 56 H86" stroke="#7a5212" stroke-width="2.5" />
  {:else if r === 12}
    <path d="M118 116 Q125 120 132 116" stroke="#c8262c" stroke-width="2.5" fill="none" />
    <path d="M108 82 L110 66 L117 75 L125 62 L133 75 L140 66 L142 82Z" fill="#f2c12e" stroke="#7a5212" stroke-width="2" />
    <circle cx="125" cy="71" r="3" fill={robe} />
    <path d="M172 170 L166 92" stroke="#3f7d2a" stroke-width="3.5" stroke-linecap="round" />
    <path d="M168 132 C180 126 186 116 184 108 C176 112 170 120 168 132Z" fill="#4f9a33" />
    <path d="M154 92 C154 74 164 70 166 82 C168 70 178 74 178 92 C176 102 156 102 154 92Z" fill="#e0453b" stroke="#7d1310" stroke-width="2" />
  {:else}
    <!-- Bauer: moustache, cap with feather and a halberd -->
    <path d="M115 112 Q125 106 135 112 Q125 116 115 112Z" fill="#7a4a1e" />
    <path d="M97 86 C98 66 152 66 153 86 C140 81 110 81 97 86Z" fill={robe2} stroke="#1a1a1a" stroke-width="2" />
    <path d="M95 88 C110 82 140 82 155 88" stroke="#f2c12e" stroke-width="3" fill="none" />
    <path d="M146 74 C158 48 178 44 186 52 C172 54 160 62 151 78Z" fill={robe} stroke="#1a1a1a" stroke-width="1.5" />
    <path d="M182 172 L172 62" stroke="#7a5212" stroke-width="4.5" stroke-linecap="round" />
    <path d="M171 66 L188 58 L191 78 L173 82Z" fill="#cfd5dd" stroke="#4a4f57" stroke-width="2" />
    <path d="M172 62 L168 44 L176 60Z" fill="#cfd5dd" stroke="#4a4f57" stroke-width="1.5" />
  {/if}
  <g transform="translate({r === 13 ? 158 : 62} 60) scale(.2)"><path d={SUIT[pip]} fill={red ? '#c8262c' : '#16161a'} /></g>
{/snippet}

{#snippet suit(s: number)}
  <!-- every suit in a 100 x 100 box -->
  {#if s === 0}
    <g stroke="#2c5f1e" stroke-width="2">{#each [0, 72, 144, 216, 288] as a}<path d="M50 50 L44 8 L56 8Z" fill="#4f9a33" transform="rotate({a + 36} 50 50)" />{/each}</g>
    <g stroke="#7d1310" stroke-width="2.5">{#each [0, 72, 144, 216, 288] as a}<circle cx="50" cy="24" r="17" fill="#e0453b" transform="rotate({a} 50 50)" />{/each}</g>
    <circle cx="50" cy="50" r="17" fill="#f4c430" stroke="#9a6a08" stroke-width="2.5" />
    <circle cx="50" cy="50" r="7" fill="#e0453b" />
  {:else if s === 1}
    <path d="M12 8 H88 V48 C88 72 70 88 50 96 C30 88 12 72 12 48Z" fill="#d23a2c" stroke="#5a1410" stroke-width="3" />
    <path d="M22 17 H50 V86 C36 80 22 68 22 48Z" fill="#1f1f24" />
    <path d="M50 17 H78 V48 C78 68 64 80 50 86Z" fill="#f4c430" />
  {:else if s === 2}
    <path d="M50 2 C52 8 52 12 50 16" stroke="#5a3a12" stroke-width="5" fill="none" stroke-linecap="round" />
    <ellipse cx="50" cy="64" rx="24" ry="32" fill="#e3b347" stroke="#7a5212" stroke-width="3" />
    <ellipse cx="44" cy="58" rx="6" ry="14" fill="rgba(255,255,255,.35)" />
    <path d="M18 40 C18 18 82 18 82 40 C82 46 18 46 18 40Z" fill="#7a4a1e" stroke="#3f2408" stroke-width="3" />
    <path d="M28 26 L40 42 M44 22 L54 42 M60 22 L68 40 M36 24 L28 40 M56 22 L46 42 M72 28 L62 42" stroke="#4d2c0c" stroke-width="2" />
  {:else}
    <circle cx="50" cy="12" r="7" fill="none" stroke="#8a5a10" stroke-width="4" />
    <circle cx="50" cy="56" r="38" fill="#f2c33a" stroke="#8a5a10" stroke-width="3" />
    <path d="M14 46 C30 36 70 36 86 46 L86 54 C70 46 30 46 14 54Z" fill="#d23a2c" />
    <circle cx="38" cy="44" r="6" fill="rgba(255,255,255,.45)" />
    <path d="M38 78 H62" stroke="#3a2406" stroke-width="5" stroke-linecap="round" />
    <circle cx="50" cy="70" r="5" fill="#3a2406" />
  {/if}
{/snippet}

{#if icon}
  {#if deck === 'fr'}<span class="fr" style:color={card.s === 0 || card.s === 3 ? '#e5484d' : 'currentColor'}>{['♥', '♠', '♣', '♦'][card.s]}</span>
  {:else}<svg class="ico" viewBox="0 0 100 100" aria-hidden="true">{@render suit(card.s)}</svg>{/if}
{:else if deck === 'fr' && !down && FR_LABEL[card.r]}
  <div class="card">
    <svg viewBox="0 0 250 350" role="img" aria-label="{({ 11: 'Bauer', 12: 'Dame', 13: 'König' } as Record<number, string>)[card.r]} {['Herz', 'Schaufel', 'Kreuz', 'Ecken'][card.s]}">
      <defs><clipPath id="{uid}-half"><rect x="44" y="36" width="162" height="139" /></clipPath></defs>
      <rect width="250" height="350" rx="22" fill="#fffdf6" />
      <rect x="2" y="2" width="246" height="346" rx="20" fill="none" stroke="rgba(0,0,0,.1)" stroke-width="2" />
      {#each [0, 180] as rot}
        <g transform="rotate({rot} 125 175)">
          <text x="24" y="50" class="idx" fill={frRed ? '#c8262c' : '#16161a'}>{FR_LABEL[card.r]}</text>
          <path d={SUIT[FR[card.s]]} transform="translate(10 60) scale(.28)" fill={frRed ? '#c8262c' : '#16161a'} />
          <g clip-path="url(#{uid}-half)"><g transform="translate(125 175) scale(1.16) translate(-125 -175)">{@render portrait(card.r, frRed, FR[card.s])}</g></g>
        </g>
      {/each}
      <rect x="44" y="36" width="162" height="278" rx="6" fill="none" stroke={frRed ? '#c8262c' : '#16161a'} stroke-width="2.5" />
      <path d="M44 175 H206" stroke="#1a1a1a" stroke-width="1.5" />
    </svg>
  </div>
{:else if deck === 'fr' || down}
  <CardView card={down ? { r: 0, s: 0 } : { r: card.r === 14 ? 1 : card.r, s: FR[card.s] }} />
{:else}
  <div class="card">
    <svg viewBox="0 0 250 350" role="img" aria-label="{COURT[card.r] ?? (card.r === 14 ? 'Ass' : card.r === 10 ? 'Banner' : card.r)} {['Rosen', 'Schilten', 'Eicheln', 'Schellen'][card.s]}">
      <defs>
        <linearGradient id="{uid}-p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf6" /><stop offset="1" stop-color="#f2ecdc" /></linearGradient>
        <linearGradient id="{uid}-c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fdf3dc" /><stop offset="1" stop-color="#efd9a8" /></linearGradient>
      </defs>
      <rect width="250" height="350" rx="22" fill="url(#{uid}-p)" />
      <rect x="2" y="2" width="246" height="346" rx="20" fill="none" stroke="rgba(0,0,0,.1)" stroke-width="2" />
      {#each [0, 180] as rot}
        <g transform="rotate({rot} 125 175)">
          <text x="30" y="52" class="idx" fill={ink} class:ten={card.r === 10}>{LABEL[card.r] ?? card.r}</text>
          <g transform="translate(13 60) scale(.34)">{@render suit(card.s)}</g>
        </g>
      {/each}
      {#if PIPS[card.r]}
        {#each PIPS[card.r] as [x, y]}<g transform="translate({x - 24} {y - 24}) scale(.48)">{@render suit(card.s)}</g>{/each}
      {:else if card.r === 10}
        <!-- Banner: a flag on a pole carrying the suit -->
        <path d="M86 70 V292" stroke="#6b4a1e" stroke-width="7" stroke-linecap="round" />
        <circle cx="86" cy="66" r="7" fill="#d9a52c" />
        <path d="M90 78 C120 66 150 92 178 80 V176 C150 188 120 162 90 174Z" fill="#f7efd9" stroke={ink} stroke-width="4" />
        <g transform="translate(106 96) scale(.56)">{@render suit(card.s)}</g>
        <g transform="translate(112 212) scale(.5)">{@render suit(card.s)}</g>
      {:else if card.r === 14}
        <rect x="58" y="88" width="134" height="174" rx="66" fill="none" stroke={ink} stroke-width="2" opacity=".35" />
        <g transform="translate(70 120) scale(1.1)">{@render suit(card.s)}</g>
      {:else}
        <rect x="56" y="70" width="138" height="210" rx="12" fill="url(#{uid}-c)" stroke={ink} stroke-width="3" />
        <rect x="64" y="78" width="122" height="194" rx="8" fill="none" stroke={ink} stroke-width="1" opacity=".35" />
        <g transform="translate(97 {card.r === 11 ? 196 : 92}) scale(.56)">{@render suit(card.s)}</g>
        <text x="125" y={card.r === 11 ? 176 : 226} class="court" fill={ink}>{LABEL[card.r]}</text>
        {#if card.r === 13}<path d="M98 252 L104 234 L114 246 L125 230 L136 246 L146 234 L152 252Z" fill="#d9a52c" stroke="#7a5212" stroke-width="2" />{/if}
      {/if}
    </svg>
  </div>
{/if}

<style>
  .card { width: var(--cw, 64px); aspect-ratio: 5 / 7; flex: none; }
  svg { display: block; width: 100%; height: 100%; border-radius: calc(var(--cw, 64px) * 0.088); box-shadow: 0 1px 1px rgba(0,0,0,.18), 0 12px 24px -12px rgba(0,0,0,.7); }
  .ico { width: 1.25em; height: 1.25em; vertical-align: -0.25em; }
  .fr { font-size: 1.15em; line-height: 1; }
  .idx { font: 700 46px 'Geist Variable', sans-serif; text-anchor: middle; letter-spacing: -0.04em; }
  .idx.ten { font-size: 38px; letter-spacing: -0.08em; }
  .court { font: 400 112px 'Instrument Serif', Georgia, serif; font-style: italic; text-anchor: middle; }
</style>
