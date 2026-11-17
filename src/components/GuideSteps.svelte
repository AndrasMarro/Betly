<script lang="ts">
  // Step-by-step guide: a little felt stage with a looping card animation, a heading and a short text per step.
  // Scenes use the shared animation classes below (.fly, .cover, .out, .glow, .rise, .take, .pop) with --d as delay.
  import type { Snippet } from 'svelte';
  export type Step = { h: string; p: string; scene: Snippet };
  let { steps, lang = 'de', ondone }: { steps: Step[]; lang?: string; ondone?: () => void } = $props();
  const L = (de: string, en: string) => (lang === 'de' ? de : en);
  let i = $state(0);
  const S = $derived(steps[i]);
</script>

<div class="steps">
  <nav class="dots">{#each steps as s, k}<button class:on={k === i} onclick={() => (i = k)} aria-label={s.h}></button>{/each}</nav>
  {#key i}<div class="gscene">{@render S.scene()}</div>{/key}
  <h3>{i + 1}. {S.h}</h3>
  <p class="txt">{S.p}</p>
  <div class="nav">
    <button class="btn sm" disabled={i === 0} onclick={() => i--}>← {L('Zurück', 'Back')}</button>
    <span class="mono muted">{i + 1} / {steps.length}</span>
    {#if i < steps.length - 1}<button class="btn sm primary" onclick={() => i++}>{L('Weiter', 'Next')} →</button>
    {:else}<button class="btn sm primary" onclick={() => ondone?.()}>{L('Los geht’s', 'Let’s play')}</button>{/if}
  </div>
</div>

<style>
  .steps { display: grid; gap: 12px; }
  .dots { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
  .dots button { width: 9px; height: 9px; padding: 0; border-radius: 50%; border: 0; background: var(--line-2); transition: width 0.25s; }
  .dots button.on { background: var(--accent); width: 22px; border-radius: 999px; }
  h3 { margin: 4px 0 0; font-size: 1.05rem; }
  .txt { margin: 0; line-height: 1.55; min-height: 4.8em; font-size: 0.93rem; }
  .nav { display: flex; justify-content: space-between; align-items: center; }
  .muted { color: var(--muted); font-size: 0.8rem; }

  .gscene {
    position: relative; height: 190px; border-radius: 18px; overflow: hidden; display: grid; place-items: center;
    background: radial-gradient(ellipse at 50% 40%, #2d6a4a, #173a2a 80%); color: #fff; --cw: 54px;
  }
  .gscene :global(.row) { display: flex; gap: 14px; align-items: center; }
  .gscene :global(.tight) { display: flex; }
  .gscene :global(.tight > *) { margin-left: -16px; }
  .gscene :global(.tight > *:first-child) { margin-left: 0; }
  .gscene :global(.col) { display: grid; gap: 8px; justify-items: center; }
  .gscene :global(.lbl) { font-size: 0.72rem; color: #f2c33a; text-align: center; white-space: nowrap; }
  .gscene :global(.chipx) { padding: 4px 10px; border-radius: 999px; background: rgba(0,0,0,.4); font: 600 0.78rem 'Geist Mono Variable', monospace; white-space: nowrap; }
  .gscene :global(.gold) { color: #f2c33a; }
  .gscene :global(.bad) { opacity: 0.35; filter: grayscale(0.6); }
  .gscene :global(.hl) { box-shadow: 0 0 0 3px #f2c33a; border-radius: 8px; }
  .gscene :global(.stack) { position: relative; }
  .gscene :global(.stack > .on) { position: absolute; left: 30%; top: 20%; rotate: 8deg; }
  /* the animations, all on a 4 s loop */
  .gscene :global(.fly) { animation: g-fly 4s infinite; animation-delay: var(--d, 0s); }
  .gscene :global(.cover) { animation: g-cover 4s infinite; animation-delay: var(--d, 0s); }
  .gscene :global(.out) { animation: g-out 4s infinite; animation-delay: var(--d, 0s); }
  .gscene :global(.take) { animation: g-take 4s infinite; animation-delay: var(--d, 0s); }
  .gscene :global(.glow) { animation: g-glow 1.6s infinite alternate; animation-delay: var(--d, 0s); }
  .gscene :global(.rise) { animation: g-rise 4s infinite; animation-delay: var(--d, 0s); }
  .gscene :global(.pop) { animation: g-pop 4s infinite; animation-delay: var(--d, 0s); }
  @keyframes -global-g-fly { 0%, 8% { transform: translate(-40px, 150px) rotate(-18deg); opacity: 0; } 30%, 100% { transform: none; opacity: 1; } }
  @keyframes -global-g-cover { 0%, 18% { transform: translate(0, 150px); opacity: 0; } 40%, 100% { transform: none; opacity: 1; } }
  @keyframes -global-g-out { 0%, 45% { transform: none; opacity: 1; } 75%, 100% { transform: translate(220px, -20px) rotate(25deg); opacity: 0; } }
  @keyframes -global-g-take { 0%, 45% { transform: none; opacity: 1; } 75%, 100% { transform: translateY(160px) scale(0.6); opacity: 0; } }
  @keyframes -global-g-glow { to { filter: drop-shadow(0 0 10px #f2c33a); } }
  @keyframes -global-g-rise { 0%, 100% { transform: none; } 20% { transform: translateY(-12px); } 40% { transform: none; } }
  @keyframes -global-g-pop { 0%, 30% { transform: scale(0.4); opacity: 0; } 45%, 100% { transform: none; opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .gscene :global(*) { animation: none !important; opacity: 1 !important; } }
</style>
