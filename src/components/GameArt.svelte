<script lang="ts">
  import Wheel from './Wheel.svelte';
  import CardView from './Card.svelte';
  import SlotSymbol from './SlotSymbol.svelte';
  import Sprite from './Sprite.svelte';
  let { id }: { id: string } = $props();
</script>

<div class="art {id}" aria-hidden="true">
  {#if id === 'roulette'}
    <div class="mini-wheel"><Wheel /></div>
  {:else if id === 'blackjack'}
    <div class="fan">
      <div class="c1"><CardView card={{ r: 1, s: 0 }} /></div>
      <div class="c2"><CardView card={{ r: 13, s: 1 }} /></div>
    </div>
  {:else if id === 'slots'}
    <div class="syms">{#each ['seven', 'seven', 'seven'] as s}<div><SlotSymbol sym={s} /></div>{/each}</div>
  {:else if id === 'rocket'}
    <svg class="curve" viewBox="0 0 300 200" preserveAspectRatio="none"><path d="M0 200 Q180 190 260 40" /></svg>
    <div class="ship"><Sprite kind="rocket" /></div>
  {:else if id === 'mines'}
    <div class="grid">
      {#each [0, 1, 2, 3, 4, 5, 6, 7, 8] as i}<div class="tile" class:open={i !== 4 && i % 2 === 0}>{#if i === 4}<Sprite kind="bomb" />{:else if i % 2 === 0}<Sprite kind="gem" />{/if}</div>{/each}
    </div>
  {:else if id === 'dice'}
    <div class="pair"><div class="d1"><Sprite kind="die" n={5} /></div><div class="d2"><Sprite kind="die" n={2} /></div></div>
  {:else if id === 'hop'}
    <div class="road">{#each [0, 1, 2, 3] as l}<div class="lane"></div>{/each}</div>
    <div class="car"><Sprite kind="car" color="#6aa8ff" /></div>
    <div class="hen"><Sprite kind="chicken" /></div>
  {/if}
</div>

<style>
  .art { position: relative; height: 100%; overflow: hidden; display: grid; place-items: center; background: radial-gradient(ellipse at 50% 20%, var(--felt), var(--felt-2)); }
  .art.slots { background: radial-gradient(ellipse at 50% 20%, #2a1b10, #120b07); }
  .art.rocket { background: radial-gradient(ellipse at 70% 10%, #24204a, #0a0918); }
  .art.mines { background: radial-gradient(ellipse at 50% 20%, #1c2a3a, #0b121b); }
  .art.dice { background: radial-gradient(ellipse at 50% 20%, #4a1d24, #1a080b); }
  .art.hop { background: #2c2f36; }
  .mini-wheel { width: 300px; translate: 0 34%; transition: rotate 1.2s cubic-bezier(0.16, 1, 0.3, 1); }
  :global(.game:hover) .mini-wheel { rotate: 40deg; }
  .fan { position: relative; width: 160px; height: 150px; --cw: 92px; }
  .fan > div { position: absolute; left: 34px; top: 10px; transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
  .c1 { transform: rotate(-10deg) translateX(-26px); }
  .c2 { transform: rotate(9deg) translateX(26px); }
  :global(.game:hover) .c1 { transform: rotate(-16deg) translateX(-40px) translateY(-6px); }
  :global(.game:hover) .c2 { transform: rotate(15deg) translateX(40px) translateY(-6px); }
  .syms { display: flex; gap: 10px; padding: 18px; border-radius: 20px; background: #fbfaf6; box-shadow: inset 0 0 0 3px #d8b26a; }
  .syms div { width: 64px; height: 64px; transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
  :global(.game:hover) .syms div:nth-child(2) { transform: translateY(-8px); }
  .curve { position: absolute; inset: 0; width: 100%; height: 100%; }
  .curve path { fill: none; stroke: var(--accent); stroke-width: 4; stroke-linecap: round; filter: drop-shadow(0 0 8px var(--accent)); }
  .ship { position: absolute; width: 70px; height: 70px; left: 78%; top: 6%; rotate: 35deg; transition: translate 0.8s cubic-bezier(0.16, 1, 0.3, 1); }
  :global(.game:hover) .ship { translate: 10px -12px; }
  .grid { display: grid; grid-template-columns: repeat(3, 56px); gap: 8px; }
  .tile { width: 56px; height: 56px; border-radius: 12px; background: #2a3b52; box-shadow: inset 0 -4px 0 rgba(0,0,0,.3); padding: 10px; }
  .tile.open { background: #13202e; }
  .pair { display: flex; gap: 18px; }
  .pair div { width: 84px; height: 84px; transition: transform 0.7s cubic-bezier(0.16, 1, 0.3, 1); filter: drop-shadow(0 12px 16px rgba(0,0,0,.5)); }
  .d1 { transform: rotate(-14deg); } .d2 { transform: rotate(12deg) translateY(16px); }
  :global(.game:hover) .d1 { transform: rotate(-200deg); } :global(.game:hover) .d2 { transform: rotate(190deg) translateY(16px); }
  .road { position: absolute; inset: 0; display: flex; }
  .lane { flex: 1; border-right: 3px dashed rgba(255,255,255,.35); }
  .lane:first-child { background: #3d4a3a; }
  .car { position: absolute; width: 56px; height: 90px; left: 54%; top: -10%; animation: drive 2.6s linear infinite; }
  @keyframes drive { to { top: 110%; } }
  .hen { position: absolute; width: 70px; height: 70px; left: 8%; top: 38%; transition: translate 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
  :global(.game:hover) .hen { translate: 60px -10px; }
</style>
