<script lang="ts">
  // Shared frame for arcade games: controls on the left, the board on the right (stacked on mobile).
  import type { Snippet } from 'svelte';
  let { eyebrow, title, controls, children, top }: { eyebrow: string; title: string; controls: Snippet; children: Snippet; top?: Snippet } = $props();
</script>

<section class="wrap page">
  <header class="head rise">
    <div>
      <p class="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
    </div>
    {#if top}{@render top()}{/if}
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
  .layout { display: grid; grid-template-columns: 300px 1fr; gap: 20px; align-items: start; }
  .controls { padding: 18px; display: grid; gap: 16px; position: sticky; top: calc(var(--nav-h) + 12px); }
  .board { min-width: 0; }
  @media (max-width: 860px) {
    .layout { grid-template-columns: 1fr; }
    .controls { position: static; order: 2; }
  }
</style>
