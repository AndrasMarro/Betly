<script lang="ts">
  import GameArt from './GameArt.svelte';
  import { GAMES, gameName, href, byId, type Cat } from '../lib/games';
  import { dailyGame } from '../lib/daily';
  import { t, type Key } from '../lib/i18n';
  let { cat, title = true }: { cat: Cat; title?: boolean } = $props();
  const live = $derived(GAMES.filter((g) => g.cat === cat && g.live));
  const soon = $derived(GAMES.filter((g) => g.cat === cat && !g.live));
  const daily = $derived(cat === 'arcade' ? byId(dailyGame()) : undefined);
</script>

<section class="sec" id={cat}>
  {#if title}
    <header class="sh">
      <div>
        <p class="eyebrow">{t(('cat.' + cat + '.eyebrow') as Key)}</p>
        <h2>{t(('cat.' + cat) as Key)}</h2>
      </div>
      <p>{t(('cat.' + cat + '.text') as Key)}</p>
    </header>
  {/if}
  {#if daily}
    <!-- game of the day: bigger card, pays a bonus on every win -->
    <a class="dailycard" href={href(daily)}>
      <div class="art"><GameArt id={daily.id} /></div>
      <div class="dtxt">
        <span class="badge mono">{t('daily.badge')}</span>
        <p class="eyebrow">{t('daily.title')}</p>
        <h3>{gameName(daily)}</h3>
        <p>{t('daily.text')}</p>
        <span class="btn primary">{t('daily.play')} →</span>
      </div>
    </a>
  {/if}
  <div class="grid">
    {#each live as g, i}
      <a class="game rise" class:isdaily={g.id === daily?.id} style="--i:{Math.min(i, 6)}" href={href(g)}>
        <div class="art"><GameArt id={g.id} /></div>
        <div class="txt">
          <h3>{gameName(g)}</h3>
          <p>{t(('game.' + g.id) as Key)}</p>
        </div>
        <span class="arrow" aria-hidden="true">→</span>
      </a>
    {/each}
  </div>
  <div class="soon">
    {#each soon as g}
      <a class="tile" href={href(g)}><span>{gameName(g)}</span><span class="eyebrow">{t('home.soon')}</span></a>
    {/each}
  </div>
</section>

<style>
  .dailycard { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); margin-bottom: 16px; border-radius: 28px; overflow: hidden; text-decoration: none; color: inherit;
    background: var(--surface); border: 1px solid color-mix(in srgb, var(--gold) 55%, transparent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--gold) 10%, transparent), 0 30px 60px -30px rgba(0,0,0,.6); transition: transform 0.45s var(--spring-snappy); }
  .dailycard:hover { transform: translateY(-4px); }
  /* fades in without moving, so it never slides over the cards below */
  .dailycard { position: relative; z-index: 1; animation: dfade 0.6s var(--ease-snap) backwards; }
  @keyframes dfade { from { opacity: 0; } }
  .dailycard .art { min-height: 240px; position: relative; display: grid; }
  .dailycard .art :global(.art) { height: 100%; }
  .dtxt { display: grid; align-content: center; justify-items: start; gap: 8px; padding: clamp(18px, 3vw, 36px); }
  .dtxt h3 { margin: 0; font-size: clamp(1.8rem, 3.6vw, 2.8rem); letter-spacing: -0.04em; line-height: 1; }
  .dtxt p { margin: 0; color: var(--muted); }
  .dtxt .btn { margin-top: 8px; }
  .badge { padding: 4px 10px; border-radius: 999px; background: var(--gold); color: #1d1505; font-size: 0.75rem; font-weight: 700; animation: badge 2.4s ease-in-out infinite; }
  @keyframes badge { 50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--gold) 20%, transparent); } }
  .game.isdaily { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--gold) 60%, transparent); }
  @media (max-width: 720px) { .dailycard { grid-template-columns: 1fr; } .dailycard .art { min-height: 180px; } }
  .sec { padding-top: 24px; scroll-margin-top: calc(var(--nav-h) + 12px); }
  .sh { display: flex; align-items: end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }
  .sh h2 { margin: 6px 0 0; font-size: clamp(1.8rem, 3.6vw, 3rem); letter-spacing: -0.04em; font-weight: 700; }
  .sh p:last-child { margin: 0; color: var(--muted); max-width: 46ch; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
  .game {
    position: relative; display: grid; grid-template-rows: 220px auto; text-decoration: none; border-radius: 28px; overflow: hidden;
    background: var(--surface); border: 1px solid var(--line); transition: transform 0.4s var(--ease-snap), border-color 0.3s var(--ease-snap);
  }
  .game:hover { transform: translateY(-4px); border-color: var(--line-2); }
  .game:active { transform: scale(0.98); transition-duration: 0.16s; }
  .art { overflow: hidden; }
  .txt { padding: 20px 22px 24px; }
  h3 { margin: 0 0 6px; font-size: 1.4rem; letter-spacing: -0.03em; }
  .txt p { margin: 0; color: var(--muted); font-size: 0.9rem; max-width: 40ch; padding-right: 20px; }
  .arrow { position: absolute; right: 20px; bottom: 22px; font-size: 1.2rem; transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
  .game:hover .arrow { transform: translateX(4px); }
  .soon { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-top: 12px; }
  .tile {
    display: grid; gap: 8px; align-content: space-between; min-height: 92px; padding: 16px; border-radius: 18px; text-decoration: none;
    border: 1px dashed var(--line-2); color: var(--text); font-weight: 600; letter-spacing: -0.02em; transition: background 0.3s;
  }
  .tile:hover { background: var(--surface); }
</style>
