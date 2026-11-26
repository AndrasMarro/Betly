<script lang="ts">
  // The picture on a memory card: a slot symbol or a playing card from the Blackjack deck.
  import SlotSymbol from './SlotSymbol.svelte';
  import CardView from './Card.svelte';
  import { SYMBOLS, type Theme } from '../games/memory';
  let { theme, face }: { theme: Theme; face: number } = $props();
</script>

<div class="face {theme}">
  {#if theme === 'symbols'}<SlotSymbol sym={SYMBOLS[face]} />
  {:else}<CardView card={{ r: (face % 13) + 1, s: Math.floor(face / 13) }} />{/if}
</div>

<style>
  .face { width: 100%; height: 100%; display: grid; place-items: center; container-type: size; }
  .symbols { padding: 14%; }
  .face :global(svg) { width: 100%; height: 100%; }
  /* playing cards keep their own shape inside the memory card */
  .cards { --cw: min(86cqw, 86cqh * 0.652); }
</style>
