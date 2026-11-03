<script lang="ts">
  import GameArt from './GameArt.svelte';
  import { GAMES, gameName, href, type Cat } from '../lib/games';
  import { t, type Key } from '../lib/i18n';
  let { cat, title = true }: { cat: Cat; title?: boolean } = $props();
  const live = $derived(GAMES.filter((g) => g.cat === cat && g.live));
  const soon = $derived(GAMES.filter((g) => g.cat === cat && !g.live));
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
  <div class="grid">
    {#each live as g, i}
      <a class="game rise" style="--i:{Math.min(i, 6)}" href={href(g)}>
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
