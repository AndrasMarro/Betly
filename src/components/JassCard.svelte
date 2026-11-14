<script lang="ts">
  // A Jass card. French deck reuses the poker card; the Swiss German deck (Rosen, Schilten, Eicheln, Schellen)
  // is drawn here: pips for 6–9, the Banner flag, framed Under / Ober / König and a large Ass.
  import CardView from './Card.svelte';
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
</script>

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
