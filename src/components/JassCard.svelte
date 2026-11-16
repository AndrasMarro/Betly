<script lang="ts">
  // A Jass card from the scanned decks in src/assets/jass/<deck>/<farbe>-<wert>.webp (see the README there):
  // de = Swiss German (Rosen, Schilten, Eicheln, Schellen), fr = Swiss French, intl = international French pattern.
  // Face-down cards and anything missing fall back to the poker card.
  import CardView from './Card.svelte';
  import type { JCard, Deck } from '../games/jass';
  let { card, deck = 'de', down = false, icon = false }: { card: JCard; deck?: Deck; down?: boolean; icon?: boolean } = $props();
  const SCANS = import.meta.glob('../assets/jass/*/*.webp', { eager: true, import: 'default' }) as Record<string, string>;
  const FR_SUITS = ['herz', 'schaufel', 'kreuz', 'ecke'], FR_RANKS: Record<number, string> = { 11: 'bauer', 12: 'dame', 13: 'koenig', 14: 'ass' };
  const SUIT_FILE: Record<Deck, string[]> = { fr: FR_SUITS, intl: FR_SUITS, de: ['rosen', 'schilten', 'eicheln', 'schellen'] };
  const RANK_FILE: Record<Deck, Record<number, string>> = { fr: FR_RANKS, intl: FR_RANKS, de: { 10: 'banner', 11: 'under', 12: 'ober', 13: 'koenig', 14: 'ass' } };
  const name = $derived(`${SUIT_FILE[deck][card.s]}-${RANK_FILE[deck][card.r] ?? card.r}`);
  const scan = $derived(SCANS[`../assets/jass/${deck}/${name}.webp`]);
  const deIcon = $derived(SCANS[`../assets/jass/icons/${SUIT_FILE.de[card.s]}.webp`]);
  // engine suit -> poker suit (0♠ 1♥ 2♦ 3♣): Herz, Schaufel, Kreuz, Ecken
  const FR = [1, 0, 3, 2];
</script>

{#if icon}
  {#if deck === 'de' && deIcon}<img class="ico" src={deIcon} alt="" />
  {:else}<span class="fr" style:color={card.s === 0 || card.s === 3 ? '#e5484d' : 'currentColor'}>{['♥', '♠', '♣', '♦'][card.s]}</span>{/if}
{:else if scan && !down}
  <div class="card"><img class="scan" src={scan} alt={name} draggable="false" /></div>
{:else}
  <CardView card={down ? { r: 0, s: 0 } : { r: card.r === 14 ? 1 : card.r, s: FR[card.s] }} />
{/if}

<style>
  /* the scans are 240 x 368 */
  .card { width: var(--cw, 64px); aspect-ratio: 15 / 23; flex: none; }
  .scan { display: block; width: 100%; height: 100%; border-radius: calc(var(--cw, 64px) * 0.06); box-shadow: 0 1px 1px rgba(0,0,0,.18), 0 12px 24px -12px rgba(0,0,0,.7); }
  .ico { width: 1.25em; height: 1.25em; vertical-align: -0.25em; object-fit: contain; }
  .fr { font-size: 1.15em; line-height: 1; }
</style>
