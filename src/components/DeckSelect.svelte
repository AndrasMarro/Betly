<script lang="ts">
  // Deck dropdown for a card game. It writes the global setting, so the choice carries over to the other games.
  import JassCard from './JassCard.svelte';
  import { settings } from '../lib/state.svelte';
  import { decksFor, pickDeck } from '../lib/decks';
  import type { Deck } from '../games/jass';
  // which: the 36-card games share settings.cards, the 52-card games settings.cards52
  let { supported, lang = settings.lang, which = 'cards' }: { supported: Deck[]; lang?: 'de' | 'en' | 'ru'; which?: 'cards' | 'cards52' } = $props();
  const list = $derived(decksFor(supported));
  const deck = $derived(pickDeck(settings[which], supported));
  function choose(d: Deck) {
    if (which === 'cards52') settings.cards52 = d;
    else settings.cards = d;
  }
</script>

<label class="decksel">
  <span class="ic"><JassCard icon card={{ s: 0, r: 6 }} deck={deck === 'classic' ? 'fr' : deck} /></span>
  <select value={deck} onchange={(e) => choose((e.currentTarget as HTMLSelectElement).value as Deck)} aria-label={lang === 'ru' ? 'Колода' : lang === 'en' ? 'Deck' : 'Kartenblatt'}>
    {#each list as d}<option value={d.id}>{d[lang]}{which === 'cards52' && (d.id === 'fr' || d.id === 'intl') ? (lang === 'de' ? ' (2–5 Standard)' : lang === 'ru' ? ' (2–5 стандарт)' : ' (2–5 standard)') : ''}</option>{/each}
  </select>
  <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
</label>

<style>
  .decksel { position: relative; display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line-2); background: var(--surface); }
  .ic { display: grid; place-items: center; width: 22px; }
  select { appearance: none; border: 0; background: none; color: inherit; font: inherit; font-size: 0.88rem; padding-right: 18px; cursor: pointer; }
  svg { position: absolute; right: 12px; pointer-events: none; color: var(--muted); }
</style>
