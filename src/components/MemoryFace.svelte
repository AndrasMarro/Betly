<script lang="ts">
  // The picture on a memory card, drawn with the site's existing art: slot symbols, playing cards,
  // Jass cards or the arcade sprites and game symbols.
  import SlotSymbol from './SlotSymbol.svelte';
  import CardView from './Card.svelte';
  import JassCard from './JassCard.svelte';
  import Sprite from './Sprite.svelte';
  import { slotArt } from '../lib/slotArt';
  import { SYMBOLS, SPRITES, SLOT_ART, type Theme } from '../games/memory';
  let { theme, face }: { theme: Theme; face: number } = $props();
</script>

<div class="face {theme}">
  {#if theme === 'symbols'}<SlotSymbol sym={SYMBOLS[face]} />
  {:else if theme === 'cards'}<CardView card={{ r: (face % 13) + 1, s: Math.floor(face / 13) }} />
  {:else if theme === 'jass'}<JassCard card={{ s: Math.floor(face / 9), r: 6 + (face % 9) }} deck="de" />
  {:else if face < SPRITES.length}<Sprite kind={SPRITES[face] as 'rocket'} n={5} />
  {:else}<img src={slotArt(SLOT_ART[face - SPRITES.length])} alt="" draggable="false" />{/if}
</div>

<style>
  .face { width: 100%; height: 100%; display: grid; place-items: center; container-type: size; }
  .symbols, .arcade { padding: 14%; }
  .face :global(svg), .face img { width: 100%; height: 100%; object-fit: contain; }
  /* playing cards keep their own shape inside the memory card */
  .cards, .jass { --cw: min(86cqw, 86cqh * 0.652); }
</style>
