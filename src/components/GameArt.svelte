<script lang="ts">
  import Wheel from './Wheel.svelte';
  import CardView from './Card.svelte';
  import SlotSymbol from './SlotSymbol.svelte';
  import Sprite from './Sprite.svelte';
  import golden from '../assets/cases/golden-edge.webp';
  import voidPulse from '../assets/cases/void-pulse.webp';
  import deepTide from '../assets/cases/deep-tide.webp';
  import duck from '../assets/duck/right.webp';
  import planet from '../assets/space/planet.webp';
  import rock from '../assets/space/rock.webp';
  const CASE_ART = [[deepTide, '#8847ff'], [golden, '#e4ae39'], [voidPulse, '#eb4b4b']] as const;
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
    <div class="stars"></div>
    <img class="planet" src={planet} alt="" />
    {#each [[8, 18, 15, 0], [52, 12, 9, 1], [88, 66, 11, 2], [30, 52, 7, 3]] as [x, y, w, i]}<img class="rock" src={rock} alt="" style="left:{x}%; top:{y}%; width:{w}%; --i:{i}" />{/each}
    <svg class="curve" viewBox="0 0 300 200" preserveAspectRatio="none">
      <defs><linearGradient id="rkfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e5484d" stop-opacity=".2" /><stop offset="1" stop-color="#e5484d" stop-opacity="0" /></linearGradient></defs>
      <path class="area" d="M0 200 Q165 192 228 74 L228 200 Z" />
      <path class="line" d="M0 200 Q165 192 228 74" />
    </svg>
    <div class="ship"><Sprite kind="rocket" flame /></div>
    <span class="mult mono">2.47×</span>
  {:else if id === 'mines'}
    <div class="grid">
      {#each [0, 1, 2, 3, 4, 5, 6, 7, 8] as i}<div class="tile" class:open={i !== 4 && i % 2 === 0}>{#if i === 4}<Sprite kind="bomb" />{:else if i % 2 === 0}<Sprite kind="gem" />{/if}</div>{/each}
    </div>
  {:else if id === 'dice'}
    <div class="pair"><div class="d1"><Sprite kind="die" n={5} /></div><div class="d2"><Sprite kind="die" n={2} /></div></div>
  {:else if id === 'hop'}
    <!-- road with a fixed lane width, so the card looks right at any width -->
    <div class="hs">
      <div class="grass"></div>
      <div class="lanes">
        {#each ['', '', '#6aa8ff', '#ffc145'] as c, i}
          <div class="ln">
            {#if i === 0}<i class="gate"></i>{/if}
            {#if c}<div class="hcar" style="--d:{i * -0.9}s; --t:{2.2 + i * 0.35}s"><Sprite kind="car" color={c} /></div>{/if}
          </div>
        {/each}
      </div>
      <div class="grass r"></div>
      <div class="hen"><Sprite kind="chicken" /></div>
      <span class="hm mono">×2.31</span>
    </div>
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
  {:else if id === 'snake'}
    <svg class="snk" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice">
      <defs><pattern id="snkgrid" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#1d3b2a" /><rect width="10" height="10" fill="#21432f" /><rect x="10" y="10" width="10" height="10" fill="#21432f" /></pattern></defs>
      <rect width="200" height="120" fill="url(#snkgrid)" />
      <path class="body" d="M30 90 H90 V50 H130 V30" fill="none" stroke="#1f7a45" stroke-width="17" stroke-linecap="round" stroke-linejoin="round" />
      <path class="body" d="M30 90 H90 V50 H130 V30" fill="none" stroke="#43c46e" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="126" cy="27" r="3" fill="#fff" /><circle cx="134" cy="27" r="3" fill="#fff" /><circle cx="126" cy="26" r="1.5" fill="#111" /><circle cx="134" cy="26" r="1.5" fill="#111" />
      <g class="apple"><circle cx="166" cy="40" r="7.5" fill="#e0262f" /><circle cx="174" cy="40" r="7.5" fill="#e0262f" /><path d="M170 33 l1.5 -6" stroke="#5a3a1e" stroke-width="2" /><ellipse cx="176" cy="27" rx="4.5" ry="2" fill="#3fbf5a" /><ellipse cx="166" cy="37" rx="2" ry="3" fill="#fff" opacity=".5" /></g>
      <g class="apple gold"><circle cx="57" cy="46" r="6" fill="#f2c046" /><circle cx="63" cy="46" r="6" fill="#f2c046" /><path d="M60 40 l1 -5" stroke="#5a3a1e" stroke-width="2" /><ellipse cx="57" cy="44" rx="1.6" ry="2.4" fill="#fff" opacity=".6" /></g>
      <rect x="150" y="80" width="18" height="18" fill="#6b6f7a" /><rect x="150" y="80" width="18" height="4" fill="#8b909c" />
    </svg>
  {:else if id === 'crossy'}
    <div class="cr">
      <i class="g"></i><i class="r"><b style="--d:0s"></b></i><i class="w"><u></u></i><i class="g"></i>
      <img src={duck} alt="" class="duck" />
    </div>
  {:else if id === 'cases'}
    <div class="drops">
      {#each CASE_ART as [src, c], i}<span class="drop" style="--c:{c}; --i:{i}"><img {src} alt="" /></span>{/each}
    </div>
    <span class="cmark"></span>
  {:else if id === 'minesweeper'}
    <div class="msw">
      {#each ['1', '1', '2', '', '', '1', 'f', '2', '1', '', '1', '2', 'f', '1', '', '', '1', '1', '1', ''] as v, i}<i class="v{v}" class:closed={v === 'f' || i % 7 === 3}>{v === 'f' ? '' : v}</i>{/each}
    </div>
  {:else if id === 'baccarat'}
    <div class="fan">
      <div class="c1"><CardView card={{ r: 9, s: 1 }} /></div>
      <div class="c2"><CardView card={{ r: 13, s: 3 }} /></div>
    </div>
    <span class="bp p">P</span><span class="bp b">B</span>
  {:else if id === 'holdem'}
    <div class="flop">{#each [{ r: 1, s: 0 }, { r: 13, s: 0 }, { r: 12, s: 0 }, { r: 11, s: 0 }, { r: 10, s: 0 }] as c, i}<div style="--i:{i}"><CardView card={c} /></div>{/each}</div>
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
  .art.snake, .art.crossy { padding: 0; }
  .snk { width: 100%; height: 100%; display: block; }
  .snk .apple { transform-origin: center; transform-box: fill-box; animation: bob 1.6s ease-in-out infinite; }
  .snk .gold { animation-delay: -0.8s; }
  @keyframes bob { 50% { transform: translateY(-3px) scale(1.06); } }
  .cr { position: absolute; inset: 0; display: grid; grid-template-rows: 1fr 1fr 1fr 1fr; overflow: hidden; }
  .cr i { position: relative; overflow: hidden; }
  .cr .g { background: #8bd65a; }
  .cr .r { background: #4a4e5a; }
  .cr .r b { position: absolute; top: 18%; left: -30%; width: 22%; height: 64%; border-radius: 4px; background: #ff5a5f; box-shadow: inset 0 -6px 0 rgba(0,0,0,.25); animation: drive 3.2s linear infinite; }
  .cr .w { background: #3aa7e6; }
  .cr .w u { position: absolute; top: 22%; right: -40%; width: 38%; height: 56%; border-radius: 4px; background: #a8703f; box-shadow: inset 0 -5px 0 #7a4f2a; animation: drift 5s linear infinite; }
  @keyframes drive { to { left: 110%; } }
  @keyframes drift { to { right: 110%; } }
  .cr .duck { position: absolute; left: 50%; bottom: 14%; height: 58%; translate: -50% 0; filter: drop-shadow(0 6px 4px rgba(0,0,0,.25)); transition: transform 0.4s var(--spring-snappy); }
  :global(.game:hover) .cr .duck, :global(.dailycard:hover) .cr .duck { transform: translateY(-14%); }
  .art.cases { background: radial-gradient(ellipse at 50% 0%, #22243a, #0e0f18 75%); }
  /* the reel in miniature: three real items, the gold one under the marker */
  .drops { display: flex; gap: 8px; align-items: center; }
  .drop { position: relative; width: 92px; height: 72px; border-radius: 12px; display: grid; place-items: center; overflow: hidden;
    background: linear-gradient(180deg, #1d1f2c, color-mix(in srgb, var(--c) 30%, #1d1f2c)); box-shadow: inset 0 -3px 0 var(--c), 0 14px 24px rgba(0,0,0,.45);
    transform: translateY(calc((var(--i) - 1) * (var(--i) - 1) * 6px)) scale(calc(1 - (var(--i) - 1) * (var(--i) - 1) * 0.12)); transition: transform 0.45s var(--spring-snappy); }
  .drop:nth-child(2) { box-shadow: inset 0 -3px 0 var(--c), 0 0 26px -4px var(--c), 0 14px 24px rgba(0,0,0,.45); z-index: 1; }
  .drop img { width: 92%; height: 92%; object-fit: contain;
    -webkit-mask: radial-gradient(ellipse 70% 70% at 50% 50%, #000 60%, transparent 100%); mask: radial-gradient(ellipse 70% 70% at 50% 50%, #000 60%, transparent 100%); }
  :global(.game:hover) .drop { transform: translateY(-6px) scale(1.04); }
  .cmark { position: absolute; left: 50%; top: 10%; bottom: 10%; width: 3px; background: #f2c046; box-shadow: 0 0 12px #f2c046; opacity: .35; }
  .art.minesweeper { background: radial-gradient(ellipse at 50% 0%, #1f2a3d, #0b111b 75%); }
  .msw { display: grid; grid-template-columns: repeat(5, 34px); gap: 4px; }
  .msw i { height: 34px; border-radius: 6px; background: #141b29; display: grid; place-items: center; font: 800 0.95rem 'Geist Mono Variable', monospace; font-style: normal; }
  .msw i.closed { background: linear-gradient(180deg, #3a4a68, #2d3a54); }
  .msw .vf { background: linear-gradient(180deg, #3a4a68, #2d3a54); position: relative; }
  .msw .vf::after { content: ''; position: absolute; left: 11px; top: 8px; width: 13px; height: 10px; background: #e5484d; clip-path: polygon(0 0, 100% 50%, 0 100%); }
  .msw .v1 { color: #6aa8ff; } .msw .v2 { color: #4fe3a0; }
  .art.baccarat { background: radial-gradient(ellipse at 50% 0%, #17406a, #0b2140 75%); }
  .bp { position: absolute; bottom: 18px; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font: 800 0.8rem 'Geist Mono Variable', monospace; border: 3px solid; background: #f4f2ee; }
  .bp.p { left: 32%; border-color: #2a6fd6; color: #2a6fd6; } .bp.b { right: 32%; border-color: #c8262c; color: #c8262c; }
  .art.holdem { background: radial-gradient(ellipse at 50% 30%, #1a6b4c, #0b3626 70%); }
  .flop { display: flex; --cw: 56px; }
  .flop div { margin-left: -14px; transform: rotate(calc((var(--i) - 2) * 6deg)) translateY(calc((var(--i) - 2) * (var(--i) - 2) * 2px)); transition: transform 0.5s var(--ease-snap); }
  :global(.game:hover) .flop div { transform: rotate(calc((var(--i) - 2) * 9deg)) translateY(-6px); }
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
  .curve .area { fill: url(#rkfill); stroke: none; }
  .curve .line { fill: none; stroke: #ff5a5f; stroke-width: 3.5; stroke-linecap: round; vector-effect: non-scaling-stroke; filter: drop-shadow(0 0 6px #ff5a5f); }
  .stars { position: absolute; inset: 0; opacity: .7; background-image: radial-gradient(1.2px 1.2px at 12% 30%, #fff, transparent), radial-gradient(1px 1px at 34% 70%, #fff, transparent), radial-gradient(1.4px 1.4px at 62% 22%, #fff, transparent), radial-gradient(1px 1px at 80% 44%, #fff, transparent), radial-gradient(1.2px 1.2px at 46% 40%, #fff, transparent), radial-gradient(1px 1px at 92% 18%, #fff, transparent), radial-gradient(1px 1px at 22% 86%, #fff, transparent); }
  .planet { position: absolute; right: -9%; top: -14%; width: 38%; opacity: .9; filter: drop-shadow(0 0 20px rgba(255, 200, 150, .25)); transition: transform 1.2s var(--ease-snap); }
  .rock { position: absolute; animation: tumble calc(9s + var(--i) * 3s) linear infinite; animation-delay: calc(var(--i) * -2s); opacity: .9; }
  @keyframes tumble { to { transform: translate(-40px, 26px) rotate(360deg); } }
  .mult { position: absolute; left: 7%; top: 10%; font-size: 1.5rem; font-weight: 700; color: #fff; text-shadow: 0 0 18px rgba(255, 90, 95, .7); }
  :global(.game:hover) .planet { transform: translate(-8px, 6px) scale(1.04); }
  .ship { position: absolute; width: 64px; height: 64px; left: 76%; top: 37%; translate: -50% -60%; rotate: 28deg; transition: translate 0.8s cubic-bezier(0.16, 1, 0.3, 1); filter: drop-shadow(0 6px 10px rgba(0,0,0,.5)); }
  :global(.game:hover) .ship { translate: calc(-50% + 8px) calc(-60% - 12px); }
  .grid { display: grid; grid-template-columns: repeat(3, 56px); gap: 8px; }
  .tile { width: 56px; height: 56px; border-radius: 12px; background: #2a3b52; box-shadow: inset 0 -4px 0 rgba(0,0,0,.3); padding: 10px; }
  .tile.open { background: #13202e; }
  .pair { display: flex; gap: 18px; }
  .pair div { width: 84px; height: 84px; transition: transform 0.7s cubic-bezier(0.16, 1, 0.3, 1); filter: drop-shadow(0 12px 16px rgba(0,0,0,.5)); }
  .d1 { transform: rotate(-14deg); } .d2 { transform: rotate(12deg) translateY(16px); }
  :global(.game:hover) .d1 { transform: rotate(-200deg); } :global(.game:hover) .d2 { transform: rotate(190deg) translateY(16px); }
  .art.hop { container-type: size; }
  .hs { position: absolute; inset: 0; display: flex; }
  .grass { flex: 1; min-width: 18cqh; background: repeating-linear-gradient(90deg, #4c7a3c 0 14px, #52823f 14px 28px); box-shadow: inset -6px 0 0 #c9c3b5; }
  .grass.r { box-shadow: inset 6px 0 0 #c9c3b5; }
  .lanes { display: flex; flex: none; background: #34373f; }
  .ln { position: relative; width: 28cqh; overflow: hidden; }
  .ln + .ln { background-image: linear-gradient(rgba(255,255,255,.55) 50%, transparent 50%); background-size: 3px 22px; background-repeat: repeat-y; background-position: left top; }
  .gate { position: absolute; left: 6%; right: 6%; top: 44%; height: 9%; border-radius: 4px; background: repeating-linear-gradient(45deg, #fff 0 8px, #e5484d 8px 16px); box-shadow: 0 4px 0 rgba(0,0,0,.3); }
  .hcar { position: absolute; left: 50%; top: -40%; width: 22cqh; aspect-ratio: 0.62; translate: -50% 0; animation: drive var(--t) linear infinite; animation-delay: var(--d); filter: drop-shadow(0 6px 6px rgba(0,0,0,.4)); }
  .hcar :global(svg) { width: 100%; height: 100%; }
  @keyframes drive { to { top: 120%; } }
  .hen { position: absolute; width: 30cqh; height: 30cqh; left: calc(50% - 56cqh - 15cqh); top: 32%; transition: translate 0.5s cubic-bezier(0.16, 1, 0.3, 1); filter: drop-shadow(0 6px 4px rgba(0,0,0,.35)); z-index: 1; }
  .hs { --road: 112cqh; }
  .hen { left: calc(50% - var(--road) / 2 + 28cqh * 1.5 - 15cqh); top: 34%; }
  /* on hover the hen just does a happy little hop where she stands */
  :global(.game:hover) .hen, :global(.dailycard:hover) .hen { animation: henhop 0.6s var(--ease-snap); }
  @keyframes henhop { 40% { transform: translateY(-14%) scaleY(1.06); } 70% { transform: translateY(0) scaleY(0.94); } }
  .hm { position: absolute; right: 5%; top: 8%; font-size: 1.1rem; font-weight: 700; color: #fff; padding: 3px 10px; border-radius: 999px; background: rgba(0,0,0,.4); }
</style>
