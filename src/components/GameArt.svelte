<script lang="ts">
  import Wheel from './Wheel.svelte';
  import CardView from './Card.svelte';
  import SlotSymbol from './SlotSymbol.svelte';
  import Sprite from './Sprite.svelte';
  import golden from '../assets/cases/golden-edge.webp';
  import voidPulse from '../assets/cases/void-pulse.webp';
  import deepTide from '../assets/cases/deep-tide.webp';
  import CrossyArt from './CrossyArt.svelte';
  import DerbyArt from './DerbyArt.svelte';
  import planet from '../assets/space/planet.webp';
  import rock from '../assets/space/rock.webp';
  import { coinFace } from '../lib/coinface';
  import JassCard from './JassCard.svelte';
  import { settings } from '../lib/state.svelte';
  import diceArt from '../assets/dice-art.webp';
  import lottoDrum from '../assets/lotto-drum.webp';
  const coinCache: Record<string, string> = {};
  const coinImg = (side: 'heads' | 'tails') => (coinCache[side] ??= coinFace(side, 512).toDataURL('image/png'));
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
    <!-- a little one-armed bandit: on hover the lever drops and the reels spin, landing on 7 7 7 -->
    <div class="bandit">
      <div class="syms">
        {#each [0, 1, 2] as i}
          <div class="slotreel" style="--i:{i}"><div class="slotstrip">{#each ['seven', 'cherry', 'bell', 'bar', 'plum', 'lemon', 'seven'] as s}<div><SlotSymbol sym={s} /></div>{/each}</div></div>
        {/each}
      </div>
      <div class="lever"><i></i></div>
    </div>
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
    <!-- a still of the real 3D dice on their velvet table -->
    <img class="diceimg" src={diceArt} alt="" loading="lazy" />
  {:else if id === 'hop'}
    <!-- road with a fixed lane width, so the card looks right at any width -->
    <div class="hs">
      <div class="grass"></div>
      <div class="lanes">
        {#each ['', '', '#6aa8ff', '#ffc145'] as c, i}
          <div class="ln">
            {#if i < 2}<i class="gate"></i>{/if}
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
    <!-- the same struck coin as in the game, lying on the felt; it flips over to the star on hover -->
    <div class="cfelt"></div>
    <div class="coin3">
      <img class="cf front" src={coinImg('heads')} alt="" />
      <img class="cf back" src={coinImg('tails')} alt="" />
    </div>
    <div class="cshadow"></div>
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
    <!-- a small copy of the game wheel: purple stage, sunburst, gold rim with bulbs, SPIN hub, pin -->
    <div class="wrays"></div>
    <div class="wbox">
      <svg class="lw" viewBox="-50 -50 100 100">
        {#each ['#2fd17a', '#30355a', '#3d8bff', '#30355a', '#9b5cff', '#30355a', '#ffbe2e', '#30355a', '#00d1c1', '#30355a', '#ff3d6e', '#30355a'] as c, i}
          <path d="M0 0 L{(46 * Math.sin((i * 30 - 15) * Math.PI / 180)).toFixed(2)} {(-46 * Math.cos((i * 30 - 15) * Math.PI / 180)).toFixed(2)} A46 46 0 0 1 {(46 * Math.sin((i * 30 + 15) * Math.PI / 180)).toFixed(2)} {(-46 * Math.cos((i * 30 + 15) * Math.PI / 180)).toFixed(2)} Z" fill={c} stroke="rgba(0,0,0,.25)" stroke-width=".6" />
        {/each}
      </svg>
      <div class="wrim">{#each Array(16) as _, i}<i style="--a:{i * 22.5}deg; --i:{i}"></i>{/each}</div>
      <div class="whub">SPIN</div>
      <svg class="wpin" viewBox="0 0 20 28"><path d="M10 27 L2 9 A8 8 0 1 1 18 9 Z" fill="#e5484d" stroke="#fff" stroke-width="2" /><circle cx="10" cy="9" r="3" fill="#fff" /></svg>
    </div>
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
    <CrossyArt />
  {:else if id === 'durak'}
    <div class="dk">
      {#each [{ s: 0, r: 6 }, { s: 2, r: 6 }, { s: 1, r: 6 }] as c, i}<div class="dkc" style="--i:{i}"><JassCard card={c} deck="ru" /></div>{/each}
      <svg class="dkhat" viewBox="0 0 48 40" aria-hidden="true"><path d="M4 34 C6 20 14 10 24 8 C34 10 42 20 44 34Z" fill="#c8102e" /><path d="M24 8 C18 12 10 14 4 10 C10 20 16 26 18 34" fill="#f2c33a" /><path d="M24 8 C30 12 38 14 44 10 C38 20 32 26 30 34" fill="#1f5fbf" /><circle cx="4" cy="10" r="3.4" fill="#fff" /><circle cx="44" cy="10" r="3.4" fill="#fff" /><circle cx="24" cy="6" r="3.4" fill="#fff" /><rect x="2" y="32" width="44" height="6" rx="3" fill="#2a2a32" /></svg>
    </div>
  {:else if id === 'derby'}
    <DerbyArt />
  {:else if id === 'balloon'}
    <div class="bln">
      <i class="cl"></i>
      <svg viewBox="0 0 120 170" class="bb"><path d="M60 4 C92 4 112 30 112 62 C112 96 84 122 62 130 L58 130 C36 122 8 96 8 62 C8 30 28 4 60 4Z" fill="#e5484d" /><ellipse cx="38" cy="38" rx="10" ry="17" fill="#fff" opacity=".4" transform="rotate(-25 38 38)" /><path d="M55 130 L65 130 L62 138 L58 138Z" fill="#c33a3a" /><path d="M60 138 C54 150 66 158 60 170" stroke="#fff" stroke-width="1.5" fill="none" opacity=".8" /></svg>
      <span class="bm mono">×4.20</span>
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
  {:else if id === 'threecard'}
    <div class="tc">
      {#each [{ r: 12, s: 1 }, { r: 13, s: 1 }, { r: 1, s: 1 }] as c, i}<div class="tcc" style="--i:{i}"><CardView card={c} /></div>{/each}
    </div>
    <span class="tcpp mono">PAIR PLUS 40:1</span>
  {:else if id === 'jass'}
    <div class="js">
      {#each [{ s: 1, r: 11 }, { s: 1, r: 9 }, { s: 0, r: 14 }, { s: 3, r: 13 }] as c, i}<div class="jsc" style="--i:{i}; --y:{[8, 1, 1, 8][i]}px"><JassCard card={c} deck="fr" /></div>{/each}
    </div>
    <span class="tcpp mono">STÖCK · WEIS · STICH</span>
  {:else if id === 'baccarat'}
    <div class="fan">
      <div class="c1"><CardView card={{ r: 9, s: 1 }} /></div>
      <div class="c2"><CardView card={{ r: 13, s: 3 }} /></div>
    </div>
    <span class="bp p">P</span><span class="bp b">B</span>
  {:else if id === 'holdem'}
    <div class="flop">{#each [{ r: 1, s: 0 }, { r: 13, s: 0 }, { r: 12, s: 0 }, { r: 11, s: 0 }, { r: 10, s: 0 }] as c, i}<div style="--i:{i}"><CardView card={c} /></div>{/each}</div>
  {:else if id === 'keno'}
    <div class="kn">{#each Array(20) as _, i}<i class:p={[2, 6, 9, 13, 17].includes(i)} class:h={[6, 13].includes(i)} style="--i:{i}">{i + 1}</i>{/each}</div>
  {:else if id === 'lotto'}
    <div class="lt">
      <img class="drum" src={lottoDrum} alt="" loading="lazy" />
      <div class="ltb">{#each [[7, '#3d7cf0'], [23, '#22b06c'], [38, '#f2a922']] as [n, c], i}<b style="--i:{i}; --c:{c}">{n}</b>{/each}<b class="g" style="--i:3">★5</b></div>
    </div>
  {:else if id === 'scratch'}
    <div class="tk">{#each ['seven', 'seven', 'seven'] as s, i}<i class:foil={i === 2}><SlotSymbol sym={s} /></i>{/each}</div>
  {:else if id === 'cups'}
    <div class="cp">
      {#each [0, 1, 2] as i}
        <div class="cupa" class:mid={i === 1}>
          {#if i === 1}<i class="cball"></i>{/if}
          <svg viewBox="0 0 100 110"><path d="M30 8 Q50 2 70 8 L88 96 Q50 106 12 96 Z" fill="#a8182d" /><path d="M30 8 Q50 2 70 8 L60 96 Q40 100 12 96 Z" fill="#c8263a" opacity=".6" /><ellipse cx="50" cy="8" rx="20" ry="5" fill="#6a0f1c" /><path d="M24 34 Q50 40 76 34 L78 42 Q50 49 22 42 Z" fill="#e3b45a" /><path d="M14 88 Q50 98 86 88 L88 97 Q50 108 12 97 Z" fill="#e3b45a" /><path d="M36 14 Q32 50 24 86" stroke="#fff" stroke-opacity=".3" stroke-width="5" fill="none" stroke-linecap="round" /></svg>
        </div>
      {/each}
    </div>
  {:else if id === 'g2048'}
    <div class="t48">{#each [2, 0, 4, 8, 0, 16, 32, 0, 64, 128, 256, 512, 0, 1024, 2048, 4] as v, i}<i class="v{v}" style="--i:{i}">{v || ''}</i>{/each}</div>
  {:else if id === 'tetris'}
    <div class="tt">
      {#each [
        '..........', '..........', '..........', '..........', '..........', '....T.....', '...TTT....', '..........',
        'L.........', 'L.....OO..', 'LL..S.OO.I', 'ZZ.SSJJJ.I', 'GZZSGJIIII', 'GGGGG.GGGG'] as row, y}
        {#each row.split('') as c, x}<i class="t{c}" class:fall={c === 'T'} style="--x:{x}; --y:{y}"></i>{/each}
      {/each}
    </div>
  {/if}
</div>

<style>
  .art { position: relative; height: 100%; overflow: hidden; display: grid; place-items: center; background: radial-gradient(ellipse at 50% 20%, var(--felt), var(--felt-2)); }
  .art.slots { background: radial-gradient(ellipse at 50% 20%, #2a1b10, #120b07); }
  .art.rocket { background: radial-gradient(ellipse at 70% 10%, #24204a, #0a0918); }
  .art.mines { background: radial-gradient(ellipse at 50% 20%, #1c2a3a, #0b121b); }
  .art.balloon { background: linear-gradient(180deg, #5aa9f0, #bfe3fb); }
  .bln { position: absolute; inset: 0; display: grid; place-items: center; }
  .bb { height: 78%; transform-origin: 50% 90%; transition: transform 0.5s cubic-bezier(.3, 1.6, .5, 1); filter: drop-shadow(0 8px 12px rgba(20,40,80,.25)); }
  :global(.game:hover) .bb, :global(.dailycard:hover) .bb { transform: scale(1.12); }
  .bm { position: absolute; top: 34%; color: #fff; font-weight: 700; font-size: 1.2rem; text-shadow: 0 2px 4px rgba(0,0,0,.3); }
  .cl { position: absolute; left: 12%; top: 18%; width: 70px; height: 22px; border-radius: 999px; background: rgba(255,255,255,.85); box-shadow: 150px 40px 0 -4px rgba(255,255,255,.7); }
  .art.durak { background: radial-gradient(ellipse at 50% 30%, #2d6a4a, #173a2a); }
  .dk { position: relative; display: flex; --cw: 64px; padding-top: 24px; }
  .dkc { margin-left: -22px; rotate: calc((var(--i) - 1) * 12deg); transform-origin: 50% 120%; transition: rotate 0.5s var(--ease-snap); }
  .dkc:first-child { margin-left: 0; }
  :global(.game:hover) .dkc, :global(.dailycard:hover) .dkc { rotate: calc((var(--i) - 1) * 20deg); }
  .dkhat { position: absolute; left: 50%; top: -14px; width: 56px; translate: -50% 0; rotate: -10deg; filter: drop-shadow(0 4px 6px rgba(0,0,0,.4)); }
  .art.keno { background: radial-gradient(ellipse at 50% 0%, #1f3a5c, #0c1626 75%); }
  .kn { display: grid; grid-template-columns: repeat(5, 34px); gap: 6px; }
  .kn i { height: 28px; border-radius: 7px; display: grid; place-items: center; font: 600 0.75rem 'Geist Mono Variable', monospace; font-style: normal; color: #dfe7f5; background: #2e4766; transition: background 0.3s calc(var(--i) * 25ms), transform 0.3s calc(var(--i) * 25ms); }
  .kn i.p { background: #7a4ff0; color: #fff; }
  :global(.game:hover) .kn i.h, :global(.dailycard:hover) .kn i.h { background: #2fbf71; color: #052a18; transform: scale(1.15); }
  .art.lotto { background: radial-gradient(ellipse at 50% 0%, #1d4b8f, #0b1b38 70%); }
  .art.lotto { background: radial-gradient(ellipse at 40% 20%, #1d3c84, #0a1636 75%); box-shadow: inset 0 0 0 3px rgba(216,178,106,.55); }
  .lt { position: absolute; inset: 0; }
  .lt .drum { position: absolute; left: 50%; top: 8%; height: 88%; translate: -72% 0; filter: drop-shadow(0 14px 16px rgba(0,0,0,.5)); transition: transform 0.6s var(--spring-smooth); }
  .ltb { position: absolute; right: 8%; bottom: 14%; display: flex; gap: 5px; }
  .ltb b { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; font: 800 0.72rem 'Geist Mono Variable', monospace; color: #16161c;
    background: radial-gradient(circle at 50% 54%, #fbfbf7 0 42%, transparent 44%), radial-gradient(circle at 32% 28%, #fff, var(--c) 30%, var(--c) 70%, #1a1a24); box-shadow: 0 6px 12px rgba(0,0,0,.45); transition: transform 0.5s var(--spring-snappy) calc(var(--i) * 70ms); }
  .ltb b.g { background: radial-gradient(circle at 35% 30%, #fff1b8, #e0a92a 70%, #9a6b10); font-size: 0.66rem; }
  :global(.game:hover) .ltb b, :global(.dailycard:hover) .ltb b { transform: translateY(-14px); }
  :global(.game:hover) .lt .drum, :global(.dailycard:hover) .lt .drum { transform: rotate(-4deg) scale(1.04); }
  .art.cups { background: radial-gradient(ellipse at 50% 30%, #5a1830, #22070f 80%); }
  .cp { display: flex; gap: 6px; align-items: end; padding-top: 30px; }
  .cupa { position: relative; width: 74px; aspect-ratio: 100 / 110; }
  .cupa svg { position: absolute; inset: 0; width: 100%; height: 100%; filter: drop-shadow(0 8px 8px rgba(0,0,0,.5)); transition: transform 0.5s var(--spring-snappy); }
  .cball { position: absolute; left: 50%; bottom: 6px; width: 24px; height: 24px; translate: -50% 0; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff8d8, #f2c046 45%, #8a5a0c); opacity: 0; transition: opacity 0.2s; }
  :global(.game:hover) .cball, :global(.dailycard:hover) .cball { opacity: 1; }
  :global(.game:hover) .cupa.mid svg, :global(.dailycard:hover) .cupa.mid svg { transform: translateY(-55%) rotate(-6deg); }
  .art.g2048 { background: radial-gradient(ellipse at 50% 20%, #2a2140, #120e1c 80%); }
  .t48 { display: grid; grid-template-columns: repeat(4, 38px); gap: 5px; padding: 6px; border-radius: 10px; background: #3a3150; transform: rotate(-4deg); transition: transform 0.5s var(--spring-smooth); }
  .t48 i { height: 38px; border-radius: 6px; display: grid; place-items: center; font: 800 0.72rem 'Geist Variable', sans-serif; font-style: normal; background: rgba(255,255,255,.07); color: #fff; }
  .t48 .v2 { background: #f1ead9; color: #2b2238; } .t48 .v4 { background: #ecdfc0; color: #2b2238; } .t48 .v8 { background: #f2b179; } .t48 .v16 { background: #f59563; }
  .t48 .v32 { background: #f67c5f; } .t48 .v64 { background: #e8493c; } .t48 .v128 { background: #edcf72; } .t48 .v256 { background: #edcc61; }
  .t48 .v512 { background: #e8bb3c; } .t48 .v1024 { background: #d8a02a; font-size: 0.6rem; } .t48 .v2048 { background: linear-gradient(135deg, #f6d88e, #c9973f); font-size: 0.6rem; box-shadow: 0 0 16px rgba(246,216,142,.8); }
  :global(.game:hover) .t48, :global(.dailycard:hover) .t48 { transform: rotate(0) scale(1.05); }
  .art.tetris { background: radial-gradient(ellipse at 50% 0%, #1f2a55, #0b1022 75%); }
  .tt { position: relative; width: 140px; height: 196px; transform: scale(0.82); transform-origin: center; border-radius: 6px; background: #0e1430; box-shadow: 0 0 0 5px #5a3420, 0 0 0 6px rgba(232,196,120,.6), 0 14px 24px rgba(0,0,0,.5); overflow: hidden; }
  .tt i { position: absolute; left: calc(var(--x) * 14px); top: calc(var(--y) * 14px); width: 14px; height: 14px; box-shadow: inset 2px 2px 0 rgba(255,255,255,.35), inset -2px -2px 0 rgba(0,0,0,.3); }
  .tt i.t\. { display: none; }
  .tI { background: #36d6e7; } .tO { background: #f6d23a; } .tT { background: #a35cf0; } .tS { background: #46d36b; } .tZ { background: #ef4b5a; } .tJ { background: #3d7cf0; } .tL { background: #f39a2b; } .tG { background: #6b6f7a; }
  .tt i.fall { transition: transform 0.8s cubic-bezier(.5, 0, .9, .6); }
  :global(.game:hover) .tt i.fall, :global(.dailycard:hover) .tt i.fall { transform: translateY(56px); }
  .art.dice { background: #2a1640; }
  .diceimg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform 0.7s var(--spring-smooth); }
  :global(.game:hover) .diceimg, :global(.dailycard:hover) .diceimg { transform: scale(1.08) rotate(-1.5deg); }
  .art.hop { background: #2c2f36; }
  .art.tower { background: linear-gradient(180deg, #1d1838, #0f1424); }
  .art.coinflip { background: repeating-linear-gradient(90deg, #6b4126 0 54px, #5e3820 54px 56px, #744830 56px 110px, #5e3820 110px 112px); perspective: 700px; }
  .cfelt { position: absolute; left: 50%; top: 56%; width: 92%; height: 74%; translate: -50% -50%; border-radius: 50%; background: radial-gradient(circle, #155c3e, #0a3423 70%); box-shadow: inset 0 0 0 10px #0a3423, inset 0 0 0 13px rgba(232,196,120,.6), 0 20px 40px rgba(0,0,0,.5); }
  .coin3 { position: relative; width: 120px; height: 120px; transform-style: preserve-3d; transform: rotateX(28deg); transition: transform 0.9s var(--spring-smooth); z-index: 1; margin-top: 6px; }
  .cf { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 50%; backface-visibility: hidden; box-shadow: 0 0 0 4px #b77a18, 0 6px 0 #8a5a10; }
  .cf.back { transform: rotateY(180deg); }
  .cshadow { position: absolute; left: 50%; top: 70%; width: 130px; height: 30px; translate: -50% 0; border-radius: 50%; background: radial-gradient(closest-side, rgba(0,0,0,.55), transparent); transition: transform 0.9s var(--spring-smooth); }
  :global(.game:hover) .coin3, :global(.dailycard:hover) .coin3 { transform: rotateX(28deg) rotateY(180deg) translateZ(30px); }
  :global(.game:hover) .cshadow, :global(.dailycard:hover) .cshadow { transform: scale(0.75); }
  .art.plinko { background: radial-gradient(ellipse at 50% 0%, #22305a, #0d1326 75%); }
  .art.wheel { background: radial-gradient(ellipse at 50% 45%, #3a1d6e, #140a2e 72%); }
  .wrays { position: absolute; left: 50%; top: 50%; width: 170%; aspect-ratio: 1; translate: -50% -50%; background: repeating-conic-gradient(rgba(255,255,255,.07) 0 6deg, transparent 6deg 18deg); mask-image: radial-gradient(closest-side, #000 30%, transparent); animation: wspin 40s linear infinite; }
  .wbox { position: relative; width: 168px; aspect-ratio: 1; }
  .wbox .lw { position: absolute; inset: 6%; width: 88%; height: 88%; }
  .wrim { position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(closest-side, transparent 88%, #d39a2c 89%, #f7d77a 93%, #a8741a 97%, transparent 98%); }
  .wrim i { position: absolute; left: 50%; top: 50%; width: 5px; height: 5px; margin: -2.5px; border-radius: 50%; background: #fff4c2; box-shadow: 0 0 6px #ffd34d; transform: rotate(var(--a)) translateY(-78px); animation: wbulb 1.2s steps(1) infinite; animation-delay: calc(var(--i) * -0.15s); }
  @keyframes wbulb { 50% { background: #7a5a1a; box-shadow: none; } }
  .whub { position: absolute; left: 50%; top: 50%; width: 30%; aspect-ratio: 1; translate: -50% -50%; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 38% 30%, #fff, #e9e3ff 25%, #8f7bd9 70%, #4b3a8f); box-shadow: 0 0 0 3px #f2c046, 0 0 0 5px #8a5d12; color: #2a1a5e; font: 800 0.6rem 'Geist Variable', sans-serif; letter-spacing: 0.08em; }
  .wpin { position: absolute; left: 50%; top: -6px; width: 20px; translate: -50% 0; filter: drop-shadow(0 3px 4px rgba(0,0,0,.5)); }
  @keyframes wspin { to { rotate: 360deg; } }
  .art.snake, .art.crossy, .art.derby { padding: 0; }
  .snk { width: 100%; height: 100%; display: block; }
  .snk .apple { transform-origin: center; transform-box: fill-box; animation: bob 1.6s ease-in-out infinite; }
  .snk .gold { animation-delay: -0.8s; }
  @keyframes bob { 50% { transform: translateY(-3px) scale(1.06); } }
  @keyframes drive { to { left: 110%; } }
  @keyframes drift { to { right: 110%; } }
  .art.jass { background: radial-gradient(ellipse at 50% 30%, #1d6b48, #0c3a26 75%); }
  .js { position: relative; display: flex; --cw: 64px; margin-bottom: 18px; }
  .jsc { margin-left: -26px; transform: rotate(calc((var(--i) - 1.5) * 9deg)) translateY(var(--y)); transform-origin: 50% 120%; transition: transform .5s var(--spring-smooth); }
  .jsc:first-child { margin-left: 0; }
  :global(.game:hover) .jsc { transform: rotate(calc((var(--i) - 1.5) * 14deg)) translateY(calc(var(--y) * 1.4 - 6px)); }
  .art.threecard { background: radial-gradient(ellipse at 50% 20%, #6b1f2c, #33101a 75%); }
  .tc { display: flex; --cw: 74px; }
  .tcc { transform: rotate(calc((var(--i) - 1) * 12deg)) translateY(calc((var(--i) - 1) * (var(--i) - 1) * 8px)); margin: 0 -10px; transition: transform 0.5s var(--spring-snappy); filter: drop-shadow(0 10px 14px rgba(0,0,0,.5)); }
  :global(.game:hover) .tcc { transform: rotate(calc((var(--i) - 1) * 20deg)) translateY(calc((var(--i) - 1) * (var(--i) - 1) * 14px - 8px)); }
  .tcpp { white-space: nowrap; position: absolute; bottom: 12px; left: 50%; translate: -50% 0; font-size: 0.7rem; letter-spacing: 0.16em; color: #f2c046; padding: 4px 10px; border-radius: 999px; border: 1px solid rgba(242,192,70,.5); }
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
  .hl .c1 { transform: rotate(-8deg) translateX(-22px); } .hl .c2 { transform: rotate(8deg) translateX(22px) translateY(-14px); }
  .up { position: absolute; right: 24%; top: 18%; color: #2fbf71; font-size: 1.6rem; }
  .pk { position: relative; display: grid; gap: 14px; justify-items: center; }
  .pk div { display: flex; gap: 16px; }
  .pk i { width: 6px; height: 6px; border-radius: 50%; background: #e8ecf8; box-shadow: 0 0 6px rgba(160,190,255,.5); }
  .pk b { position: absolute; left: 50%; top: -14px; width: 14px; height: 14px; margin-left: -7px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff, #ff6b6f 45%, #b3202a); animation: plk 2.4s var(--ease-snap) infinite; }
  @keyframes plk { 0% { transform: translate(0, 0); } 30% { transform: translate(11px, 40px); } 55% { transform: translate(0, 80px); } 80% { transform: translate(11px, 120px); opacity: 1; } 100% { transform: translate(11px, 140px); opacity: 0; } }
  .lw { transition: transform 1.6s var(--ease-snap); filter: drop-shadow(0 12px 20px rgba(0,0,0,.5)); }
  :global(.game:hover) .lw, :global(.dailycard:hover) .lw { transform: rotate(390deg); }
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
  .bandit { position: relative; padding: 14px; border-radius: 26px; background: linear-gradient(160deg, #4a2a14, #1d1008); box-shadow: inset 0 0 0 2px #d8b26a, 0 20px 40px -20px rgba(0,0,0,.8); }
  .syms { display: flex; gap: 8px; padding: 8px; border-radius: 16px; background: #0b0b0c; }
  .slotreel { width: 64px; height: 76px; overflow: hidden; border-radius: 10px; background: linear-gradient(180deg, #d9d4c7, #fbfaf6 25%, #fbfaf6 75%, #d9d4c7); }
  .slotstrip { transform: translateY(-456px); }
  .slotstrip div { width: 64px; height: 76px; padding: 8px 4px; }
  :global(.game:hover) .slotstrip, :global(.dailycard:hover) .slotstrip, :global(.daily-slot:hover) .slotstrip { animation: reelspin calc(0.9s + var(--i) * 0.3s) cubic-bezier(.3, .1, .3, 1.08) both; }
  @keyframes reelspin { from { transform: translateY(0); filter: blur(2px); } 70% { filter: blur(1px); } to { transform: translateY(-456px); filter: none; } }
  .lever { position: absolute; right: -16px; top: 18px; width: 8px; height: 46px; border-radius: 4px; background: linear-gradient(90deg, #9aa0aa, #d9dde4); transform-origin: 50% 100%; transition: transform 0.25s; }
  .lever i { position: absolute; left: -6px; top: -14px; width: 20px; height: 20px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #ff8a8f, #c3262c); }
  :global(.game:hover) .lever, :global(.dailycard:hover) .lever, :global(.daily-slot:hover) .lever { animation: pull 0.6s ease-in-out; }
  @keyframes pull { 40% { transform: scaleY(-1); } }
  @media (prefers-reduced-motion: reduce) { .slotstrip { animation: none !important; } }
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
  .art.hop { container-type: size; }
  .hs { position: absolute; inset: 0; display: flex; }
  .grass { flex: 1; min-width: 18cqh; background: repeating-linear-gradient(90deg, #4c7a3c 0 14px, #52823f 14px 28px); box-shadow: inset -6px 0 0 #c9c3b5; }
  .grass.r { box-shadow: inset 6px 0 0 #c9c3b5; }
  .lanes { display: flex; flex: none; background: #34373f; }
  .ln { position: relative; width: 28cqh; overflow: hidden; }
  .ln + .ln { background-image: linear-gradient(rgba(255,255,255,.55) 50%, transparent 50%); background-size: 3px 22px; background-repeat: repeat-y; background-position: left top; }
  .gate { position: absolute; left: 6%; right: 6%; top: 34%; height: 9%; border-radius: 4px; background: repeating-linear-gradient(45deg, #fff 0 8px, #e5484d 8px 16px); box-shadow: 0 4px 0 rgba(0,0,0,.3); }
  .hcar { position: absolute; left: 50%; top: -40%; width: 22cqh; aspect-ratio: 0.62; translate: -50% 0; animation: drive var(--t) linear infinite; animation-delay: var(--d); filter: drop-shadow(0 6px 6px rgba(0,0,0,.4)); }
  .hcar :global(svg) { width: 100%; height: 100%; }
  @keyframes drive { to { top: 120%; } }
  .hen { position: absolute; width: 30cqh; height: 30cqh; left: calc(50% - 56cqh - 15cqh); top: 32%; transition: translate 0.5s cubic-bezier(0.16, 1, 0.3, 1); filter: drop-shadow(0 6px 4px rgba(0,0,0,.35)); z-index: 1; }
  .hs { --road: 112cqh; }
  .hen { left: calc(50% - var(--road) / 2 + 28cqh * 1.5 - 15cqh); top: 48%; }
  /* on hover the hen just does a happy little hop where she stands */
  :global(.game:hover) .hen, :global(.dailycard:hover) .hen { animation: henhop 0.6s var(--ease-snap); }
  @keyframes henhop { 40% { transform: translateY(-14%) scaleY(1.06); } 70% { transform: translateY(0) scaleY(0.94); } }
  .hm { position: absolute; right: 5%; top: 8%; font-size: 1.1rem; font-weight: 700; color: #fff; padding: 3px 10px; border-radius: 999px; background: rgba(0,0,0,.4); }
</style>
