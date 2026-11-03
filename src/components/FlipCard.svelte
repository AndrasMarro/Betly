<script lang="ts">
  // A card that arrives face down and turns over a moment later.
  import { onMount } from 'svelte';
  import CardView from './Card.svelte';
  import type { Card } from '../lib/cards';
  let { card, delay = 220, small = false }: { card: Card; delay?: number; small?: boolean } = $props();
  let up = $state(false);
  onMount(() => { const id = setTimeout(() => (up = true), delay); return () => clearTimeout(id); });
</script>

<CardView card={up ? card : { r: 0, s: 0 }} {small} />
