<script lang="ts">
  // Shared frame for arcade games: controls on the left, the board on the right (stacked on mobile).
  import type { Snippet } from 'svelte';
  import HowTo from './HowTo.svelte';
  import { dailyGame } from '../lib/daily';
  import { t } from '../lib/i18n';
  let { eyebrow, title, controls, children, top }: { eyebrow: string; title: string; controls: Snippet; children: Snippet; top?: Snippet } = $props();
  const game = location.hash.slice(2).split(/[/?]/)[0]; // the route is the game id
</script>

<section class="wrap page">
  <header class="head rise">
    <div>
      <p class="eyebrow">{eyebrow}{#if game === dailyGame()}<span class="daily">{t('daily.badge')}</span>{/if}</p>
      <h1>{title}</h1>
    </div>
    <div class="tools">
      {#if top}{@render top()}{/if}
      <HowTo id={game} />
    </div>
  </header>
  <div class="layout">
    <aside class="panel controls rise" style="--i:1">{@render controls()}</aside>
    <div class="board rise" style="--i:0">{@render children()}</div>
  </div>
</section>

<style>
  .page { padding-bottom: 80px; }
  .head { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 12px; padding: 28px 0 16px; }
  h1 { margin: 6px 0 0; font-size: clamp(2.2rem, 5vw, 3.6rem); letter-spacing: -0.04em; line-height: 0.95; font-weight: 700; }
  .daily { margin-left: 10px; padding: 3px 8px; border-radius: 999px; background: var(--gold); color: #1d1505; letter-spacing: 0.06em; }
  .tools { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .layout { display: grid; grid-template-columns: 300px 1fr; gap: 20px; align-items: start; }
  .controls { padding: 18px; display: grid; gap: 16px; position: sticky; top: calc(var(--nav-h) + 12px); }
  .board { min-width: 0; }
  @media (max-width: 860px) {
    .layout { grid-template-columns: 1fr; }
    .controls { position: static; order: 2; }
  }
</style>
