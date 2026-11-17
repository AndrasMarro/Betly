<script lang="ts">
  // Game of the day: bigger card, pays a bonus on every win.
  import GameArt from './GameArt.svelte';
  import { gameName, href, type Game } from '../lib/games';
  import { t } from '../lib/i18n';
  let { g }: { g: Game } = $props();
</script>

<a class="dailycard" href={href(g)}>
  <div class="art"><GameArt id={g.id} /></div>
  <div class="dtxt">
    <span class="badge mono">{t('daily.badge')}</span>
    <p class="eyebrow">{t(g.cat === 'classic' ? 'daily.classic' : 'daily.arcade')}</p>
    <h3>{gameName(g)}</h3>
    <p>{t('daily.text')}</p>
    <span class="btn primary">{t('daily.play')} →</span>
  </div>
</a>

<style>
  /* fades in without moving, so it never slides over the cards below */
  .dailycard { position: relative; z-index: 1; display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); margin-bottom: 16px; border-radius: 28px; overflow: hidden; text-decoration: none; color: inherit;
    background: var(--surface); border: 1px solid color-mix(in srgb, var(--gold) 55%, transparent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--gold) 10%, transparent), 0 30px 60px -30px rgba(0,0,0,.6);
    transition: transform 0.45s var(--spring-snappy); animation: dfade 0.6s var(--ease-snap) backwards; }
  .dailycard:hover { transform: translateY(-4px); }
  @keyframes dfade { from { opacity: 0; } }
  .art { min-height: 240px; position: relative; display: grid; overflow: hidden; }
  .art :global(.art) { height: 100%; }
  .dtxt { display: grid; align-content: center; justify-items: start; gap: 8px; padding: clamp(18px, 2.6vw, 32px); }
  h3 { margin: 0; font-size: clamp(1.6rem, 2.8vw, 2.4rem); letter-spacing: -0.04em; line-height: 1; }
  .dtxt p { margin: 0; color: var(--muted); }
  .btn { margin-top: 8px; }
  .badge { padding: 4px 10px; border-radius: 999px; background: var(--gold); color: #1d1505; font-size: 0.75rem; font-weight: 700; animation: badge 2.4s ease-in-out infinite; }
  @keyframes badge { 50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--gold) 20%, transparent); } }
  @media (max-width: 720px) { .dailycard { grid-template-columns: 1fr; } .art { min-height: 180px; } }
</style>
