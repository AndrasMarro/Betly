<script lang="ts">
  // Playing card drawn as SVG: real pip layouts, framed court cards, patterned back, 3D flip.
  import { RANKS, type Card } from '../lib/cards';
  let { card, small = false }: { card: Card; small?: boolean } = $props();
  const uid = $props.id();
  const red = $derived(card.s === 1 || card.s === 2);
  const ink = $derived(red ? '#c8262c' : '#16161a');

  // Suits in a 100x100 box, centred on 50/50.
  const SUIT = [
    'M50 4 C40 22 6 40 6 62 C6 76 18 84 30 84 C38 84 44 80 47 74 C46 84 42 92 34 96 H66 C58 92 54 84 53 74 C56 80 62 84 70 84 C82 84 94 76 94 62 C94 40 60 22 50 4Z',
    'M50 90 C20 66 4 50 4 31 C4 17 15 7 28 7 C38 7 46 13 50 21 C54 13 62 7 72 7 C85 7 96 17 96 31 C96 50 80 66 50 90Z',
    'M50 4 L86 50 L50 96 L14 50Z',
    'M50 8 A19 19 0 0 1 66 39 A19 19 0 1 1 57 66 C57 80 62 90 70 96 H30 C38 90 43 80 43 66 A19 19 0 1 1 34 39 A19 19 0 0 1 50 8Z',
  ];
  // Pip positions (x, y in a 250 x 350 card), the classic layouts.
  const C = [70, 125, 180], R = [70, 120, 145, 175, 205, 230, 280];
  const PIPS: Record<number, [number, number][]> = {
    2: [[C[1], R[0]], [C[1], R[6]]],
    3: [[C[1], R[0]], [C[1], R[3]], [C[1], R[6]]],
    4: [[C[0], R[0]], [C[2], R[0]], [C[0], R[6]], [C[2], R[6]]],
    5: [[C[0], R[0]], [C[2], R[0]], [C[1], R[3]], [C[0], R[6]], [C[2], R[6]]],
    6: [[C[0], R[0]], [C[2], R[0]], [C[0], R[3]], [C[2], R[3]], [C[0], R[6]], [C[2], R[6]]],
    7: [[C[0], R[0]], [C[2], R[0]], [C[1], R[1] + 6], [C[0], R[3]], [C[2], R[3]], [C[0], R[6]], [C[2], R[6]]],
    8: [[C[0], R[0]], [C[2], R[0]], [C[1], R[1] + 6], [C[0], R[3]], [C[2], R[3]], [C[1], R[5] - 6], [C[0], R[6]], [C[2], R[6]]],
    9: [[C[0], R[0]], [C[2], R[0]], [C[0], 140], [C[2], 140], [C[1], R[3]], [C[0], 210], [C[2], 210], [C[0], R[6]], [C[2], R[6]]],
    10: [[C[0], R[0]], [C[2], R[0]], [C[1], 100], [C[0], 140], [C[2], 140], [C[0], 210], [C[2], 210], [C[1], 250], [C[0], R[6]], [C[2], R[6]]],
  };
  const COURT: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K' };
</script>

<div class="card" class:small class:down={card.r === 0}>
  <div class="inner">
    <svg class="face" viewBox="0 0 250 350" aria-label="{RANKS[card.r]} {['spades', 'hearts', 'diamonds', 'clubs'][card.s]}" role="img">
      <defs>
        <linearGradient id="{uid}-paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" /><stop offset="1" stop-color="#f1eee6" /></linearGradient>
        <linearGradient id="{uid}-court" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color={red ? '#fff1ec' : '#eef1f8'} /><stop offset="1" stop-color={red ? '#f8d9cf' : '#d9deeb'} /></linearGradient>
      </defs>
      <rect width="250" height="350" rx="22" fill="url(#{uid}-paper)" />
      <rect x="2" y="2" width="246" height="346" rx="20" fill="none" stroke="rgba(0,0,0,.08)" stroke-width="2" />
      {#if card.r}
        <g fill={ink}>
          {#each [0, 180] as rot}
            <g transform="rotate({rot} 125 175)">
              <text x="34" y="60" class="idx" class:ten={card.r === 10}>{RANKS[card.r]}</text>
              <path d={SUIT[card.s]} transform="translate(21 70) scale(.26)" />
            </g>
          {/each}
          {#if card.r === 1}
            <path d={SUIT[card.s]} transform="translate({125 - (card.s === 0 ? 55 : 40)} {175 - (card.s === 0 ? 55 : 40)}) scale({card.s === 0 ? 1.1 : 0.8})" />
          {:else if COURT[card.r]}
            <rect x="52" y="64" width="146" height="222" rx="10" fill="url(#{uid}-court)" stroke={ink} stroke-width="3" />
            <rect x="60" y="72" width="130" height="206" rx="6" fill="none" stroke={ink} stroke-width="1" opacity=".35" />
            <text x="125" y="214" class="court" fill={ink}>{COURT[card.r]}</text>
            <path d={SUIT[card.s]} transform="translate(68 80) scale(.3)" />
            <path d={SUIT[card.s]} transform="rotate(180 125 175) translate(68 80) scale(.3)" />
          {:else}
            {#each PIPS[card.r] as [x, y]}
              <path d={SUIT[card.s]} transform="translate({x - 19} {y - 19}) scale(.38) {y > 175 ? 'rotate(180 50 50)' : ''}" />
            {/each}
          {/if}
        </g>
      {/if}
    </svg>
    <svg class="back" viewBox="0 0 250 350" aria-hidden="true">
      <defs>
        <pattern id="{uid}-lat" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="18" height="18" fill="var(--card-back, #8e1b22)" />
          <path d="M0 9 H18 M9 0 V18" stroke="rgba(255,255,255,.16)" stroke-width="2" />
        </pattern>
      </defs>
      <rect width="250" height="350" rx="22" fill="#fbfaf7" />
      <rect x="12" y="12" width="226" height="326" rx="14" fill="url(#{uid}-lat)" />
      <rect x="20" y="20" width="210" height="310" rx="10" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2" />
      <circle cx="125" cy="175" r="34" fill="#fbfaf7" />
      <circle cx="125" cy="175" r="24" fill="none" stroke="var(--card-back, #8e1b22)" stroke-width="9" stroke-dasharray="9 6" />
    </svg>
  </div>
</div>

<style>
  .card { width: var(--cw, 64px); aspect-ratio: 5 / 7; perspective: 800px; flex: none; }
  .card.small { --cw: 48px; }
  .inner { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; transition: transform 0.6s var(--spring-smooth); }
  .down .inner { transform: rotateY(180deg); }
  .face, .back {
    position: absolute; inset: 0; width: 100%; height: 100%; backface-visibility: hidden; border-radius: calc(var(--cw, 64px) * 0.088);
    box-shadow: 0 1px 1px rgba(0,0,0,.18), 0 12px 24px -12px rgba(0,0,0,.7);
  }
  .back { transform: rotateY(180deg); }
  .idx { font: 700 50px 'Geist Variable', sans-serif; text-anchor: middle; letter-spacing: -0.04em; }
  .idx.ten { font-size: 40px; letter-spacing: -0.08em; }
  .court { font: 400 128px 'Instrument Serif', Georgia, serif; font-style: italic; text-anchor: middle; }
</style>
