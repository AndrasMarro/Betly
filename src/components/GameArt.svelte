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
  {:else if id === 'tower'}
    <div class="tw">{#each [0, 1, 2, 3, 4] as r}<div>{#each [0, 1, 2] as c}<i class:g={(r + c) % 3 === 0}>{#if (r + c) % 3 === 0}<Sprite kind="gem" />{/if}</i>{/each}</div>{/each}</div>
  {:else if id === 'coinflip'}
    <div class="coin"><SlotSymbol sym="crown" /></div>
  {:else if id === 'hilo'}
    <div class="fan hl">
      <div class="c1"><CardView card={{ r: 5, s: 2 }} /></div>
      <div class="c2"><CardView card={{ r: 12, s: 3 }} /></div>
    </div>
    <span class="up">▲</span>
  {:else if id === 'plinko'}
    <div class="pk">
      {#each [0, 1, 2, 3, 4, 5] as r}<div>{#each Array(r + 3) as _}<i></i>{/each}</div>{/each}
      <b></b>
    </div>
  {:else if id === 'wheel'}
    <svg class="lw" viewBox="-50 -50 100 100">
      {#each ['#2fbf71', '#2a2f45', '#4f8dff', '#2a2f45', '#9b6bff', '#2a2f45', '#f2c046', '#2a2f45', '#2fa3a0', '#2a2f45'] as c, i}
        <path d="M0 0 L{(48 * Math.sin((i * 36 - 18) * Math.PI / 180)).toFixed(2)} {(-48 * Math.cos((i * 36 - 18) * Math.PI / 180)).toFixed(2)} A48 48 0 0 1 {(48 * Math.sin((i * 36 + 18) * Math.PI / 180)).toFixed(2)} {(-48 * Math.cos((i * 36 + 18) * Math.PI / 180)).toFixed(2)} Z" fill={c} stroke="#141828" />
      {/each}
      <circle r="15" fill="#141828" />
    </svg>
    <span class="tip"></span>
  {:else if id === 'scratch'}
    <div class="tk">{#each ['seven', 'seven', 'seven'] as s, i}<i class:foil={i === 2}><SlotSymbol sym={s} /></i>{/each}</div>
  {/if}
</div>

<style>
  .art { position: relative; height: 100%; overflow: hidden; display: grid; place-items: center; background: radial-gradient(ellipse at 50% 20%, var(--felt), var(--felt-2)); }
  .art.slots { background: radial-gradient(ellipse at 50% 20%, #2a1b10, #120b07); }
  .art.rocket { background: radial-gradient(ellipse at 70% 10%, #24204a, #0a0918); }
  .art.mines { background: radial-gradient(ellipse at 50% 20%, #1c2a3a, #0b121b); }
  .art.dice { background: radial-gradient(ellipse at 50% 20%, #4a1d24, #1a080b); }
  .art.hop { background: #2c2f36; }
  .art.tower { background: linear-gradient(180deg, #1d1838, #0f1424); }
  .art.coinflip { background: radial-gradient(ellipse at 50% 30%, #2b2a46, #101020 70%); }
  .art.plinko { background: radial-gradient(ellipse at 50% 0%, #22305a, #0d1326 75%); }
  .art.wheel { background: radial-gradient(ellipse at 50% 20%, #232a4a, #0d1122 72%); }
  .art.scratch { background: radial-gradient(ellipse at 50% 20%, #3a2a10, #140d05); }
  .tw { display: grid; gap: 6px; }
  .tw div { display: flex; gap: 6px; }
  .tw i { width: 46px; height: 24px; border-radius: 6px; background: #34406a; display: grid; place-items: center; padding: 2px; }
  .tw i.g { background: #141a2b; box-shadow: inset 0 0 0 2px rgba(79,227,160,.4); }
  .coin { width: 130px; height: 130px; border-radius: 50%; padding: 30px; background: radial-gradient(circle at 35% 30%, #fff2b8, #f2c046 40%, #b9821f 100%); box-shadow: inset 0 0 0 5px #d9a536, inset 0 0 0 8px #f7d77a, 0 20px 30px rgba(0,0,0,.45); transition: transform 0.8s var(--spring-smooth); }
  :global(.game:hover) .coin { transform: rotateY(180deg) translateY(-8px); }
  .hl .c1 { transform: rotate(-8deg) translateX(-22px); } .hl .c2 { transform: rotate(8deg) translateX(22px) translateY(-14px); }
  .up { position: absolute; right: 24%; top: 18%; color: #2fbf71; font-size: 1.6rem; }
  .pk { position: relative; display: grid; gap: 14px; justify-items: center; }
  .pk div { display: flex; gap: 16px; }
  .pk i { width: 6px; height: 6px; border-radius: 50%; background: #e8ecf8; box-shadow: 0 0 6px rgba(160,190,255,.5); }
  .pk b { position: absolute; left: 50%; top: -14px; width: 14px; height: 14px; margin-left: -7px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff, #ff6b6f 45%, #b3202a); animation: plk 2.4s var(--ease-snap) infinite; }
  @keyframes plk { 0% { transform: translate(0, 0); } 30% { transform: translate(11px, 40px); } 55% { transform: translate(0, 80px); } 80% { transform: translate(11px, 120px); opacity: 1; } 100% { transform: translate(11px, 140px); opacity: 0; } }
  .lw { width: 170px; height: 170px; transition: transform 1.2s var(--ease-snap); filter: drop-shadow(0 16px 24px rgba(0,0,0,.5)); }
  :global(.game:hover) .lw { transform: rotate(144deg); }
  .tip { position: absolute; left: 50%; top: 14px; translate: -50% 0; border: 10px solid transparent; border-top: 16px solid #f4f2ee; }
  .tk { display: flex; gap: 8px; padding: 16px; border-radius: 18px; background: linear-gradient(150deg, #ffe39a, #f2c046 45%, #d99a2b); box-shadow: 0 20px 30px rgba(0,0,0,.45); }
  .tk i { width: 56px; height: 56px; border-radius: 12px; background: #fffaf0; padding: 8px; position: relative; overflow: hidden; }
  .tk i.foil::after { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, #c9ccd6, #f1f2f6 45%, #b7bac6 55%, #e3e5ec); clip-path: polygon(40% 0, 100% 0, 100% 100%, 10% 100%); transition: clip-path 0.6s var(--ease-snap); }
  :global(.game:hover) .tk i.foil::after { clip-path: polygon(100% 0, 100% 0, 100% 100%, 100% 100%); }
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
