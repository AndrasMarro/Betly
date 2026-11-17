<script lang="ts">
  // A Jass card from the scanned decks in src/assets/jass/<deck>/<farbe>-<wert>.webp (see the README there):
  // de = Swiss German (Rosen, Schilten, Eicheln, Schellen), fr = Swiss French, intl = international French pattern,
  // ru = the Russian Atlas deck. A deck's back.webp, if there, is used for face-down cards.
  // Face-down cards and anything missing fall back to the poker card.
  import CardView from './Card.svelte';
  import type { JCard, Deck } from '../games/jass';
  let { card, deck = 'de', down = false, icon = false }: { card: JCard; deck?: Deck; down?: boolean; icon?: boolean } = $props();
  const SCANS = import.meta.glob('../assets/jass/*/*.webp', { eager: true, import: 'default' }) as Record<string, string>;
  const FR_SUITS = ['herz', 'schaufel', 'kreuz', 'ecke'], FR_RANKS: Record<number, string> = { 11: 'bauer', 12: 'dame', 13: 'koenig', 14: 'ass' };
  const SUIT_FILE: Record<Deck, string[]> = { classic: FR_SUITS, fr: FR_SUITS, intl: FR_SUITS, ru: FR_SUITS, de: ['rosen', 'schilten', 'eicheln', 'schellen'] };
  const RANK_FILE: Record<Deck, Record<number, string>> = { classic: FR_RANKS, fr: FR_RANKS, intl: FR_RANKS, ru: FR_RANKS, de: { 10: 'banner', 11: 'under', 12: 'ober', 13: 'koenig', 14: 'ass' } };
  const name = $derived(`${SUIT_FILE[deck][card.s]}-${RANK_FILE[deck][card.r] ?? card.r}`);
  // the standard deck has no pictures: it is the drawn poker card below
  const scan = $derived(deck === 'classic' ? undefined : SCANS[`../assets/jass/${deck}/${name}.webp`]);
  const backScan = $derived(SCANS[`../assets/jass/${deck}/back.webp`]);
  const deIcon = $derived(SCANS[`../assets/jass/icons/${SUIT_FILE.de[card.s]}.webp`]);
  // engine suit -> poker suit (0♠ 1♥ 2♦ 3♣): Herz, Schaufel, Kreuz, Ecken
  const FR = [1, 0, 3, 2];
</script>

{#if icon}
  {#if deck === 'de' && deIcon}<img class="ico" src={deIcon} alt="" />
  {:else}<span class="fr" style:color={card.s === 0 || card.s === 3 ? '#e5484d' : 'currentColor'}>{['♥', '♠', '♣', '♦'][card.s]}</span>{/if}
{:else if (down ? backScan : scan)}
  <div class="card" class:intl={deck === 'intl'} class:ru={deck === 'ru'}><img class="scan" src={down ? backScan : scan} alt={down ? '' : name} draggable="false" /></div>
{:else}
  <CardView deck="classic" card={down ? { r: 0, s: 0 } : { r: card.r === 14 ? 1 : card.r, s: FR[card.s] }} />
{/if}

<style>
  /* the Swiss scans are 240 x 368, the international ones 240 x 336 */
  .card { width: var(--cw, 64px); aspect-ratio: 15 / 23; flex: none; }
  .card.intl { aspect-ratio: 5 / 7; }
  .card.ru { aspect-ratio: 2 / 3; } /* the international deck has the usual poker-card shape */
  .scan { display: block; width: 100%; height: 100%; border-radius: calc(var(--cw, 64px) * 0.06); box-shadow: 0 1px 1px rgba(0,0,0,.18), 0 12px 24px -12px rgba(0,0,0,.7); }
  .ico { width: 1.25em; height: 1.25em; vertical-align: -0.25em; object-fit: contain; }
  .fr { font-size: 1.15em; line-height: 1; }
</style>
