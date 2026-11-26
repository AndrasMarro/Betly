<script lang="ts">
  import GameArt from './GameArt.svelte';
  import DailyCard from './DailyCard.svelte';
  import { GAMES, gameName, href, byId, matches, type Cat, type Game } from '../lib/games';
  import { dailyGame, dailyClassic } from '../lib/daily';
  import { t, type Key } from '../lib/i18n';
  // q: search text; daily: show this category's game of the day on top (the home page shows both together instead)
  // party: only the games to play together, from both categories
  let { cat, title = true, q = '', daily = true, party = false }: { cat: Cat; title?: boolean; q?: string; daily?: boolean; party?: boolean } = $props();
  const abc = (a: Game, b: Game) => gameName(a).localeCompare(gameName(b));
  const all = $derived(GAMES.filter((g) => (party ? g.party : g.cat === cat) && matches(g, q, t(('game.' + g.id) as Key))));
  // classics: card games first, then the rest, each alphabetical; arcade keeps its order
  const groups = $derived(cat === 'classic' && !party
    ? (['cards', 'table'] as const).map((k) => ({ k, games: all.filter((g) => g.live && g.group === k).sort(abc) })).filter((x) => x.games.length)
    : [{ k: '', games: all.filter((g) => g.live) }]);
  const soon = $derived(all.filter((g) => !g.live));
  const today = $derived(byId(cat === 'arcade' ? dailyGame() : dailyClassic()));
</script>

{#if all.length}
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
  {#if daily && today && !q && !party}<DailyCard g={today} />{/if}
  {#each groups as grp}
    {#if grp.k}<h3 class="grp eyebrow">{t(('group.' + grp.k) as Key)}</h3>{/if}
    <div class="grid">
      {#each grp.games as g, i (g.id)}
        <a class="game rise" class:isdaily={g.id === today?.id} style="--i:{Math.min(i, 6)}" href={href(g)}>
          <div class="art"><GameArt id={g.id} /></div>
          {#if g.party}<span class="pty" title={t('party.badge')}>👥</span>{/if}
          <div class="txt">
            <h3>{gameName(g)}</h3>
            <p>{t(('game.' + g.id) as Key)}</p>
          </div>
          <span class="arrow" aria-hidden="true">→</span>
        </a>
      {/each}
    </div>
  {/each}
  {#if soon.length}
    <div class="soon">
      {#each soon as g}
        <a class="tile" href={href(g)}><span>{gameName(g)}</span><span class="eyebrow">{t('home.soon')}</span></a>
      {/each}
    </div>
  {/if}
</section>
{/if}

<style>
  .pty { position: absolute; top: 14px; right: 14px; z-index: 1; display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; background: rgba(0,0,0,.45); backdrop-filter: blur(6px); font-size: 0.85rem; }
  .game.isdaily { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--gold) 60%, transparent); }
  .grp { margin: 26px 0 12px; font: 500 0.72rem/1 'Geist Mono Variable', monospace; letter-spacing: 0.14em; }
  .grp:first-of-type { margin-top: 0; }
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
