<script lang="ts">
  // "Your games" on the home page: favourites, the last played and the most played. Hidden until there is something to show.
  import { byId, gameName, href, type Game } from '../lib/games';
  import { mine, most } from '../lib/mine.svelte';
  import { settings } from '../lib/state.svelte';
  import FavButton from './FavButton.svelte';
  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
  type Tab = 'fav' | 'recent' | 'most';
  const lists = $derived({ fav: mine.fav, recent: mine.recent, most: most() } as Record<Tab, string[]>);
  let tab = $state<Tab>(mine.fav.length ? 'fav' : 'recent');
  const games = $derived(lists[tab].map(byId).filter((g): g is Game => !!g?.live));
  const any = $derived(mine.fav.length + mine.recent.length > 0);
  const TABS: [Tab, string][] = $derived([['fav', L('Favoriten', 'Favourites')], ['recent', L('Zuletzt', 'Recent')], ['most', L('Meistgespielt', 'Most played')]]);
</script>

{#if any}
  <section class="yours" aria-label={L('Deine Spiele', 'Your games')}>
    <header>
      <h2>{L('Deine Spiele', 'Your games')}</h2>
      <div class="tabs" role="tablist">
        {#each TABS as [k, lb]}<button role="tab" aria-selected={tab === k} class:on={tab === k} onclick={() => (tab = k)}>{lb}{#if k === 'fav' && mine.fav.length}<small>{mine.fav.length}</small>{/if}</button>{/each}
      </div>
    </header>
    {#key tab}
      <div class="row">
        {#each games as g, i (g.id)}
          <div class="slot" style="--i:{Math.min(i, 8)}">
            <a class="tile" href={href(g)}>
              <small>{g.cat === 'classic' ? 'Classic' : 'Arcade'}{#if g.party} · 👥{/if}</small>
              <b>{gameName(g)}</b>
              <em>{tab === 'most' ? `${mine.plays[g.id] ?? 0}× ${L('gespielt', 'played')}` : L('Weiterspielen', 'Play again')} →</em>
            </a>
            <span class="fv"><FavButton id={g.id} /></span>
          </div>
        {:else}
          <p class="empty">{tab === 'fav' ? L('Tippe auf das Herz bei einem Spiel, um es hier zu merken.', 'Tap the heart on a game to keep it here.') : L('Noch nichts gespielt.', 'Nothing played yet.')}</p>
        {/each}
      </div>
    {/key}
  </section>
{/if}

<style>
  .yours { display: grid; gap: 12px; margin-top: 22px; }
  header { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  h2 { margin: 0; font-size: 1.4rem; letter-spacing: -0.03em; }
  .tabs { display: flex; gap: 4px; padding: 3px; border-radius: 999px; background: var(--surface); border: 1px solid var(--line); }
  .tabs button { border: 0; background: none; color: var(--muted); border-radius: 999px; padding: 6px 12px; font-size: 0.8rem; font-weight: 600; display: flex; gap: 6px; align-items: center; transition: background 0.25s var(--ease-snap), color 0.25s var(--ease-snap); }
  .tabs button.on { background: var(--text); color: var(--bg); }
  .tabs small { font-size: 0.68rem; opacity: 0.7; }
  .row { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(170px, 210px); gap: 10px; overflow-x: auto; padding: 8px 2px; margin: -8px -2px 0; scrollbar-width: thin; }
  .slot { position: relative; display: grid; animation: rise 0.5s var(--spring-snappy) calc(var(--i) * 50ms) backwards; }
  .tile { display: grid; align-content: start; gap: 4px; min-height: 104px; padding: 14px 14px 12px; border-radius: 20px; text-decoration: none; color: var(--text); background: var(--surface); border: 1px solid var(--line); transition: transform 0.4s var(--ease-snap), border-color 0.3s var(--ease-snap); }
  .tile small { font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  .tile b { font-size: 1rem; padding-right: 30px; }
  .tile em { margin-top: auto; font-style: normal; font-size: 0.78rem; color: var(--muted); }
  .fv { position: absolute; top: 10px; right: 10px; transition: transform 0.4s var(--ease-snap); }
  @media (hover: hover) and (pointer: fine) { .slot:hover .tile { transform: translateY(-4px); border-color: var(--line-2); } .slot:hover .fv { transform: translateY(-4px); } }
  .tile:active { transform: scale(0.97); }
  @keyframes rise { from { opacity: 0; transform: translateY(10px); } }
  .empty { margin: 0; padding: 18px 4px; color: var(--muted); font-size: 0.9rem; grid-column: 1 / -1; }
  @media (prefers-reduced-motion: reduce) { .slot { animation: none; } }
</style>
