<script lang="ts">
  // Heart to keep a game in "Your games". Pops when set.
  import { mine, toggleFav } from '../lib/mine.svelte';
  import { settings } from '../lib/state.svelte';
  let { id }: { id: string } = $props();
  const on = $derived(mine.fav.includes(id));
  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
</script>

<button class="heart" class:on onclick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFav(id); }}
  aria-pressed={on} aria-label={on ? L('Aus Favoriten entfernen', 'Remove from favourites') : L('Zu Favoriten', 'Add to favourites')} title={on ? L('Favorit', 'Favourite') : L('Merken', 'Save')}>
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" /></svg>
</button>

<style>
  .heart { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; border: 0; padding: 0; background: rgba(0,0,0,.45); backdrop-filter: blur(6px); color: #fff; cursor: pointer; transition: transform 0.16s var(--ease-snap), background 0.3s var(--ease-snap); }
  .heart path { fill: none; stroke: currentColor; stroke-width: 2; transition: fill 0.25s var(--ease-snap); }
  .heart:hover { background: rgba(0,0,0,.65); }
  .heart:active { transform: scale(0.88); }
  .heart.on { color: #ff5a6e; }
  .heart.on path { fill: currentColor; }
  .heart.on svg { animation: pop 0.5s var(--spring-snappy); }
  @keyframes pop { 0% { transform: scale(0.4); } }
  @media (prefers-reduced-motion: reduce) { .heart.on svg { animation: none; } }
</style>
