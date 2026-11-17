<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { fly, scale } from 'svelte/transition';
  import SlotSymbol from '../components/SlotSymbol.svelte';
  import HowTo from '../components/HowTo.svelte';
  import CardView from '../components/Card.svelte';
  import DeckSelect from '../components/DeckSelect.svelte';
  import { FULL } from '../lib/decks';
  import { MACHINES as BASE, ARMORY, CARDS, CROSSY, SNAKE, strips, spinGrid, evaluate, type Win, type Machine } from '../games/slots';
  // weapon art from the cases, shown instead of drawn symbols on the Armory machine
  const ART = Object.fromEntries(Object.entries(import.meta.glob('../assets/cases/*.webp', { eager: true, import: 'default' })).map(([k, v]) => [k.split('/').pop()!.replace('.webp', ''), v as string]));
  import GameArt from '../components/GameArt.svelte';
  import { slotArt } from '../lib/slotArt';
  import { dailySlot } from '../lib/daily';
  const MACHINES = [...BASE, CARDS, CROSSY, SNAKE, ...ARMORY];
  const today = MACHINES.find((x) => x.id === dailySlot());
  // the joker of the Russian Atlas deck, for every deck until the others have their own
  import JOKER from '../assets/jass/ru/joker-red.webp';
  import { wallet, settle, fmt, settings } from '../lib/state.svelte';
  import { sfx } from '../lib/sfx';
  import { t } from '../lib/i18n';

  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
  // the machine lobby: #/slots shows all machines, #/slots?m=<id> one of them (so the back button returns to the lobby)
  const pick = () => Math.max(-1, MACHINES.findIndex((x) => x.id === new URLSearchParams(location.hash.split('?')[1]).get('m')));
  let mi = $state(pick());
  const lobby = $derived(mi < 0);
  const open = (i: number) => { location.hash = '#/slots' + (i < 0 ? '' : '?m=' + MACHINES[i].id); };
  const BLURB: Record<string, [string, string]> = {
    classic: ['Der Klassiker: drei Walzen, Früchte, BAR und die Sieben.', 'The classic: three reels, fruit, BAR and the seven.'],
    gems: ['Edelsteine auf fünf Walzen, Wild und Freispiele ×2.', 'Gems on five reels, wild and free spins ×2.'],
    cosmic: ['Zwanzig Linien im All, Wild und Freispiele ×2.', 'Twenty lines in space, wild and free spins ×2.'],
    clover: ['Vier Reihen, zwanzig Linien, Glück aus Irland.', 'Four rows, twenty lines, luck of the Irish.'],
    crossy: ['Die Ente, Autos, Polizei und Feuerwehr aus Retro Crossy Run. Die Ente ist Wild, Münzen geben Freispiele.', 'The duck, cars, police and fire engine from Retro Crossy Run. The duck is wild, coins give free spins.'],
    snake: ['Äpfel, Giftäpfel und Mauern aus Snake, der Schlangenkopf ist Wild.', 'Apples, poison apples and walls from Snake, the snake head is wild.'],
    cards: ['Spielkarten im Kartenblatt deiner Wahl, der Joker ist Wild.', 'Playing cards in the deck of your choice, the joker is wild.'],
    'arm-field': ['Die Waffen aus den Kisten, kleine Einsätze.', 'The case weapons, small stakes.'],
    'arm-arsenal': ['Die Waffen aus den Kisten, mittlere Einsätze.', 'The case weapons, medium stakes.'],
    'arm-proto': ['Die seltensten Waffen, hohe Einsätze.', 'The rarest weapons, high stakes.'],
  };
  /** The three best-paying symbols, for the lobby card. */
  const top3 = (x: Machine) => Object.entries(x.pays).sort((a, b) => Math.max(...Object.values(b[1])) - Math.max(...Object.values(a[1]))).slice(0, 3).map(([k]) => k);
  const m = $derived(MACHINES[Math.max(0, mi)]);
  const reelStrips = $derived(strips(m));
  let betIdx = $state(1);
  const lineBet = $derived(m.bets[Math.min(betIdx, m.bets.length - 1)]);
  const cost = $derived(lineBet * m.lines.length);

  type Reel = { items: string[]; k: number; dur: number; moving?: boolean };
  let reels = $state<Reel[]>([]);
  let stripEls: HTMLDivElement[] = $state([]);
  let spinning = $state(false);
  let wins = $state<Win[]>([]);
  let win = $state(0);
  const shownWin = new Tween(0, { duration: 900, easing: cubicOut });
  $effect(() => { shownWin.set(win, { duration: win ? 900 : 0 }); });
  let freeLeft = $state(0);
  let autoLeft = $state(0);
  let turbo = $state(false);
  let alive = true;
  onDestroy(() => (alive = false));

  // fresh reels whenever the machine changes
  $effect(() => {
    const g = spinGrid(m, reelStrips);
    reels = g.map((items) => ({ items, k: 0, dur: 0 }));
    wins = []; win = 0; freeLeft = 0; autoLeft = 0;
  });

  const lit = $derived(new Set(wins.flatMap((w) => (m.lines[w.line] ?? []).slice(0, w.count).map((row, reel) => reel + '-' + row))));

  async function spin() {
    if (spinning) return;
    const free = freeLeft > 0;
    if (!free && wallet.balance < cost) { autoLeft = 0; return; }
    spinning = true;
    wins = []; win = 0;
    if (free) freeLeft--;
    sfx('spin');
    const grid = spinGrid(m, reelStrips);
    const durs = grid.map((_, i) => (turbo ? 380 + i * 120 : 900 + i * 260));
    reels = reels.map((r, i) => {
      const s = reelStrips[i];
      const filler = Array.from({ length: (turbo ? 6 : 14) + i * (turbo ? 2 : 5) }, () => s[Math.floor(Math.random() * s.length)]);
      const items = [...grid[i], ...filler, ...r.items.slice(0, m.rows)];
      return { items, k: items.length - m.rows, dur: 0 };
    });
    await tick();
    stripEls.forEach((el) => el?.offsetHeight); // flush start position
    reels.forEach((r, i) => {
      r.dur = durs[i];
      r.k = 0;
      r.moving = true;
      setTimeout(() => { r.moving = false; }, durs[i] * 0.72);
      setTimeout(() => sfx('stop'), durs[i]);
    });
    await new Promise((r) => setTimeout(r, Math.max(...durs) + 80));
    if (!alive) return;
    reels = grid.map((items) => ({ items, k: 0, dur: 0 }));

    const res = evaluate(m, grid, lineBet);
    const mult = free ? m.scatter!.mult : 1;
    win = res.total * mult;
    wins = res.wins;
    settle(win - (free ? 0 : cost), win);
    if (res.free) freeLeft += res.free;
    if (win > 0) sfx(win >= cost * 10 ? 'big' : 'win');
    spinning = false;

    if (freeLeft > 0) setTimeout(() => alive && spin(), turbo ? 700 : 1300);
    else if (autoLeft > 0) setTimeout(() => { if (alive && autoLeft > 0) { autoLeft--; spin(); } }, turbo ? 350 : 700);
  }

  function auto(n: number) {
    autoLeft = n - 1;
    spin();
  }

  const pts = (line: number[]) => line.map((row, reel) => `${((reel + 0.5) / line.length) * 100},${((row + 0.5) / m.rows) * 100}`).join(' ');
  const LINE_COLORS = ['#f2c046', '#ff6b7a', '#6aa8ff', '#4fe3a0', '#b57bff', '#ff9f43', '#f78fb3', '#54d8f0', '#c8f05a', '#ffffff'];

  function key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, select, textarea, button')) return;
    if (e.code === 'Space') { e.preventDefault(); spin(); }
  }
</script>

<svelte:window onkeydown={(e) => !lobby && key(e)} onhashchange={() => { if (!spinning && !freeLeft) { wins = []; mi = pick(); autoLeft = 0; } }} />

{#snippet symbol(sym: string)}
  {#if ART[sym]}<img class="weapon" src={ART[sym]} alt={sym} draggable="false" />
  {:else if slotArt(sym)}<img class="gameart" src={slotArt(sym)} alt={sym} draggable="false" />
  {:else if sym.startsWith('card-')}{@const [, r, su] = sym.split('-')}<div class="pc"><CardView card={{ r: +r, s: +su }} /></div>
  {:else if sym === 'joker'}<div class="pc"><img class="joker" src={JOKER} alt="Joker" draggable="false" /></div>
  {:else}<SlotSymbol {sym} />{/if}
{/snippet}

{#if lobby}
<section class="wrap page">
  <header class="head">
    <div>
      <p class="eyebrow">Classic · {MACHINES.length} {L('Automaten', 'machines')}</p>
      <div class="h1row"><h1>Slots</h1><HowTo id="slots" /></div>
    </div>
  </header>
  {#if today}
    <!-- slot of the day: the overview art, a bonus on every win in this machine -->
    <button class="daily-slot" onclick={() => open(MACHINES.indexOf(today))}>
      <div class="dart"><GameArt id="slots" /></div>
      <div class="dtxt">
        <span class="badge mono">{t('daily.badge')}</span>
        <p class="eyebrow">{L('Slot des Tages', 'Slot of the day')}</p>
        <h3>{today.name}</h3>
        <p>{L(...BLURB[today.id])} {t('daily.text')}</p>
        <span class="btn primary">{t('daily.play')} →</span>
      </div>
    </button>
  {/if}
  <div class="machines">
    {#each MACHINES as x, i (x.id)}
      <button class="mcard {x.id}" class:armory={x.id.startsWith('arm')} onclick={() => open(i)}>
        <div class="mart">
          {#each top3(x) as sym, k}<div class="mcell" style="--k:{k}">{@render symbol(sym)}</div>{/each}
        </div>
        <div class="mtxt">
          <h3>{x.name}</h3>
          <p>{L(...BLURB[x.id])}</p>
          <div class="tags mono">
            <span>{x.weights.length}×{x.rows}</span><span>{x.lines.length} {t('s.lines')}</span>
            {#if x.wild}<span>Wild</span>{/if}{#if x.scatter}<span>{t('s.free')} ×{x.scatter.mult}</span>{/if}
            <span>{fmt(x.bets[0] * x.lines.length)}–{fmt(x.bets.at(-1)! * x.lines.length)}</span>
          </div>
        </div>
      </button>
    {/each}
  </div>
</section>
{:else}

<section class="wrap page">
  <header class="head">
    <div>
      <p class="eyebrow">Slots{#if m.id === today?.id}<span class="dbadge mono">{t('daily.badge')}</span>{/if} · {m.lines.length} {t('s.lines')} · {m.weights.length}×{m.rows}</p>
      <div class="h1row">
        <button class="btn sm back" disabled={spinning || freeLeft > 0} onclick={() => open(-1)}>← {L('Alle Automaten', 'All machines')}</button>
        <h1>{m.name}</h1><HowTo id="slots" />
        {#if m.id === 'cards'}<DeckSelect supported={FULL} which="cards52" />{/if}
      </div>
    </div>
  </header>


  <div class="cabinet {m.id}" class:armory={m.id.startsWith('arm')}>
    <div class="marquee">
      <span class="serif">{m.name}</span>
      {#if freeLeft > 0}<span class="free mono" in:scale>{t('s.free')}: {freeLeft} · ×{m.scatter?.mult}</span>{/if}
    </div>
    <div class="window" style="--rows:{m.rows}; --reels:{reels.length}">
      {#each reels as r, i}
        <div class="reel">
          <div class="strip" class:moving={r.moving} bind:this={stripEls[i]} style="transform: translateY({(-r.k / r.items.length) * 100}%); transition: transform {r.dur}ms cubic-bezier(.25,.9,.35,1.04)">
            {#each r.items as sym, j}
              <div class="cell" class:lit={!spinning && j < m.rows && lit.has(i + '-' + j)} class:dim={!spinning && wins.length > 0 && j < m.rows && !lit.has(i + '-' + j)} class:wild={sym === m.wild && !!ART[sym]}>
                {@render symbol(sym)}
              </div>
            {/each}
          </div>
        </div>
      {/each}
      {#if !spinning && wins.length}
        <svg class="lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {#each wins as w, i}
            <polyline pathLength="1" style="animation-delay:{i * 120}ms" points={pts(m.lines[w.line])} stroke={LINE_COLORS[w.line % LINE_COLORS.length]} />
          {/each}
        </svg>
      {/if}
    </div>
    <div class="readout">
      <div><span class="eyebrow">{t('bet.win')}</span>
        <strong class="mono big" class:pos={win > 0}>{fmt(Math.round(shownWin.current * 100) / 100)}</strong>
      </div>
      <div><span class="eyebrow">{t('s.lineBet')}</span>
        <div class="stepper">
          <button class="btn icon sm" disabled={spinning || betIdx === 0} onclick={() => betIdx--} aria-label="-">−</button>
          <strong class="mono">{lineBet}</strong>
          <button class="btn icon sm" disabled={spinning || betIdx >= m.bets.length - 1} onclick={() => betIdx++} aria-label="+">+</button>
        </div>
      </div>
      <div><span class="eyebrow">{t('bet.total')}</span><strong class="mono">{fmt(cost)}</strong></div>
    </div>
  </div>

  <div class="dock panel">
    <label class="switch mini"><span>{t('s.turbo')}</span><input type="checkbox" bind:checked={turbo} /></label>
    <div class="autos">
      {#if autoLeft > 0}
        <button class="btn sm" onclick={() => (autoLeft = 0)}>{t('s.stop')} ({autoLeft})</button>
      {:else}
        {#each [10, 25, 50] as n}<button class="btn sm ghost" disabled={spinning || freeLeft > 0 || wallet.balance < cost} onclick={() => auto(n)}>{t('s.auto')} {n}</button>{/each}
      {/if}
    </div>
    <button class="btn primary spinbtn" onclick={spin} disabled={spinning || freeLeft > 0 || wallet.balance < cost}>
      {wallet.balance < cost && freeLeft === 0 ? t('notEnough') : t('s.spin')}
    </button>
  </div>

  <section class="pay">
    <h2 class="eyebrow">{t('s.paytable')}</h2>
    <div class="paygrid">
      {#each Object.entries(m.pays).sort((a, b) => Math.max(...Object.values(b[1])) - Math.max(...Object.values(a[1]))) as [sym, p]}
        <div class="payitem">
          <div class="pi" class:wide={!!ART[sym]}>{@render symbol(sym)}</div>
          <div class="mono">
            {#each Object.entries(p).reverse() as [n, x]}<div><span class="muted">{n}×</span> {x * lineBet}</div>{/each}
          </div>
        </div>
      {/each}
      {#if m.scatter}
        <div class="payitem">
          <div class="pi">{@render symbol(m.scatter.sym)}</div>
          <div class="mono">
            {#each Object.entries(m.scatter.pays).reverse() as [n, x]}<div><span class="muted">{n}×</span> {x * cost}</div>{/each}
          </div>
        </div>
      {/if}
    </div>
    {#if m.scatter}<p class="muted small">{t('s.scatter')}. {t('s.wild')}.</p>{/if}
  </section>
</section>
{/if}

<style>
  .back { margin-right: 4px; }
  .machines { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; padding-bottom: 40px; }
  .mcard { display: grid; grid-template-rows: 190px auto; padding: 0; text-align: left; border-radius: 28px; overflow: hidden; border: 1px solid var(--line); background: var(--surface); color: inherit; transition: transform 0.4s var(--ease-snap), border-color 0.3s; }
  .mcard:hover { transform: translateY(-4px); border-color: var(--line-2); }
  .mart { display: flex; justify-content: center; align-items: center; gap: 8px; background: linear-gradient(160deg, #26180e, #120b07); }
  .mcard.gems .mart { background: linear-gradient(160deg, #1b1340, #0a0820); }
  .mcard.cosmic .mart { background: radial-gradient(ellipse at 70% 0%, #2a1f5c, #07061a 70%); }
  .mcard.clover .mart { background: linear-gradient(160deg, #0f4a2e, #062316); }
  .mcard.cards .mart { background: radial-gradient(ellipse at 50% 30%, #2d6a4a, #173a2a 80%); }
  .mcard.armory .mart { background: linear-gradient(160deg, #1c1f2b, #0b0d14); }
  .mcell { width: 78px; height: 78px; padding: 10px; border-radius: 14px; background: rgba(255,255,255,.92); box-shadow: inset 0 0 0 2px rgba(216,178,106,.5); transition: transform 0.5s var(--spring-snappy, ease); }
  .mcard.gems .mcell, .mcard.cosmic .mcell, .mcard.armory .mcell { background: rgba(255,255,255,.08); }
  .mcard.cards .mcell { background: none; box-shadow: none; padding: 0; }
  .mcard:hover .mcell { transform: translateY(calc(-6px + var(--k) * 3px)) rotate(calc((var(--k) - 1) * 4deg)); }
  .mtxt { padding: 18px 20px 20px; display: grid; gap: 6px; }
  .mtxt h3 { margin: 0; font-size: 1.35rem; letter-spacing: -0.03em; }
  .mtxt p { margin: 0; color: var(--muted); font-size: 0.88rem; }
  .mtxt { grid-template-rows: auto 1fr auto; height: 100%; }
  .tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; align-self: end; }
  .tags span { display: inline-flex; align-items: center; height: 22px; padding: 0 9px; border-radius: 999px; border: 1px solid var(--line-2); font-size: 0.7rem; line-height: 1; color: var(--muted); }
  .gameart { width: 100%; height: 100%; object-fit: contain; display: block; }
  .mcard.crossy .mart { background: linear-gradient(180deg, #8fd36b, #4c9f3e); }
  .mcard.snake .mart { background: repeating-conic-gradient(#1d3b2a 0 25%, #21432f 0 50%) 0 0 / 26px 26px; }
  .mcard.crossy .mcell, .mcard.snake .mcell { background: rgba(255,255,255,.14); }
  .cabinet.crossy { --frame: #ffd84a; background: linear-gradient(160deg, #3f8f2a, #173d12); }
  .cabinet.crossy .reel { background: linear-gradient(180deg, #3a3f4a, #4f5562 20%, #4f5562 80%, #3a3f4a); }
  .cabinet.snake { --frame: #43c46e; background: linear-gradient(160deg, #123222, #06150d); }
  .cabinet.snake .reel { background: repeating-conic-gradient(#1d3b2a 0 25%, #21432f 0 50%) 0 0 / 30px 30px; }
  .daily-slot { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); width: 100%; margin-bottom: 18px; padding: 0; text-align: left; border-radius: 28px; overflow: hidden; color: inherit;
    background: var(--surface); border: 1px solid color-mix(in srgb, var(--gold) 55%, transparent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--gold) 10%, transparent); transition: transform 0.4s var(--ease-snap); }
  .daily-slot:hover { transform: translateY(-4px); }
  .dart { min-height: 230px; display: grid; }
  .dart :global(.art) { height: 100%; }
  .daily-slot .dtxt { display: grid; align-content: center; justify-items: start; gap: 8px; padding: clamp(18px, 3vw, 34px); }
  .daily-slot h3 { margin: 0; font-size: clamp(1.7rem, 3vw, 2.5rem); letter-spacing: -0.04em; line-height: 1; }
  .daily-slot .dtxt p { margin: 0; color: var(--muted); }
  .badge, .dbadge { padding: 4px 10px; border-radius: 999px; background: var(--gold); color: #1d1505; font-size: 0.75rem; font-weight: 700; }
  .dbadge { margin-left: 8px; padding: 2px 8px; font-size: 0.65rem; letter-spacing: 0; }
  @media (max-width: 720px) { .daily-slot { grid-template-columns: 1fr; } .dart { min-height: 180px; } }
  /* cards are sized by height, so the taller decks (Atlas 2:3, Swiss 15:23) fit the square cell like the others */
  .pc { width: 100%; height: 100%; display: grid; place-items: center; }
  .pc :global(.card) { width: auto; height: 96%; }
  .joker { width: 64%; height: auto; aspect-ratio: 2 / 3; display: block; border-radius: 6px; box-shadow: 0 1px 1px rgba(0,0,0,.18), 0 8px 16px -8px rgba(0,0,0,.6); }
  .cabinet.cards { --frame: #e5c27a; background: radial-gradient(ellipse at 50% 0%, #2d6a4a, #0f2a1d 80%); }
  .cabinet.cards .reel { background: linear-gradient(180deg, #123524, #1d4a33 20%, #1d4a33 80%, #123524); }
  .cabinet.cards .cell { padding: 4%; }
  .h1row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .h1row h1 { margin: 0; }
  .page { padding-bottom: 120px; }
  .head { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 12px; padding: 28px 0 16px; }
  h1 { margin: 6px 0 0; font-size: clamp(2.2rem, 5vw, 3.6rem); letter-spacing: -0.04em; line-height: 0.95; font-weight: 700; }
  .cabinet.armory { --frame: #c9a24a; background: linear-gradient(160deg, #1c1f2b, #0b0d14); }
  .cabinet.armory .reel { background: linear-gradient(180deg, #151826, #22263a 20%, #22263a 80%, #151826); }
  .weapon { width: 100%; height: 100%; object-fit: contain; display: block; filter: drop-shadow(0 4px 6px rgba(0,0,0,.5)); }
  .armory .cell { padding: 6%; }
  .cell.wild { background: radial-gradient(circle, rgba(242,192,70,.28), transparent 70%); }
  .pi.wide { width: 80px; }

  .cabinet {
    --frame: #d8b26a; width: fit-content; max-width: 100%; margin: 0 auto; border-radius: 36px; padding: clamp(14px, 2.5vw, 28px);
    background: linear-gradient(160deg, #26180e, #120b07); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--frame) 60%, transparent), 0 40px 80px -30px rgba(0,0,0,.6);
  }
  .cabinet.gems { --frame: #8a7dff; background: linear-gradient(160deg, #1b1340, #0a0820); }
  .cabinet.cosmic { --frame: #6ad5ff; background: radial-gradient(ellipse at 70% 0%, #2a1f5c, #07061a 70%); }
  .cabinet.clover { --frame: #f2c046; background: linear-gradient(160deg, #0f4a2e, #062316); }
  .marquee { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #f4f2ee; padding: 0 6px 14px; }
  .marquee .serif { font-size: clamp(1.6rem, 3.5vw, 2.4rem); color: var(--frame); }
  .free { font-size: 0.8rem; background: var(--frame); color: #120b07; padding: 6px 12px; border-radius: 999px; }
  .window {
    position: relative; display: grid; width: fit-content; margin-inline: auto; --cell: min(140px, 14vh, calc(54vh / var(--rows)), calc((100vw - 96px) / var(--reels))); grid-template-columns: repeat(var(--reels), var(--cell)); gap: 6px; padding: 6px; border-radius: 22px;
    background: #0b0b0c; box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--frame) 40%, transparent), inset 0 20px 40px rgba(0,0,0,.6);
  }
  .reel { overflow: hidden; height: calc(var(--cell) * var(--rows)); border-radius: 14px; background: linear-gradient(180deg, #e8e4da, #fbfaf6 20%, #fbfaf6 80%, #e8e4da); position: relative; }
  .gems .reel { background: linear-gradient(180deg, #17142c, #241f48 20%, #241f48 80%, #17142c); }
  .cosmic .reel { background: linear-gradient(180deg, #0b0a24, #1a1846 20%, #1a1846 80%, #0b0a24); }
  .clover .reel { background: linear-gradient(180deg, #e9f3e3, #fbfdf8 20%, #fbfdf8 80%, #e9f3e3); }
  .reel::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg, rgba(0,0,0,.35), transparent 18%, transparent 82%, rgba(0,0,0,.35)); }
  .strip { will-change: transform; transition: filter 0.2s var(--ease-snap); }
  .strip.moving { filter: blur(1.8px) brightness(1.05); }
  .cell { aspect-ratio: 1; padding: 14%; transition: opacity 0.3s, transform 0.3s; }
  .cell.lit { animation: pulse 0.9s ease-in-out infinite alternate; }
  .cell.dim { opacity: 0.35; }
  @keyframes pulse { to { transform: scale(1.1); } }
  .lines { position: absolute; inset: 6px; width: calc(100% - 12px); height: calc(100% - 12px); pointer-events: none; }
  .lines polyline { fill: none; vector-effect: non-scaling-stroke; stroke-width: 4; stroke-linejoin: round; stroke-linecap: round; opacity: 0.85; filter: drop-shadow(0 0 4px rgba(0,0,0,.6)); stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 0.6s var(--ease-snap) forwards; }
  @keyframes draw { to { stroke-dashoffset: 0; } }
  .readout { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); min-width: min(100%, 440px); gap: 12px; padding: 18px 6px 2px; color: #f4f2ee; }
  .readout > div { display: grid; gap: 6px; justify-items: center; }
  .readout .eyebrow { color: rgba(244,242,238,.5); }
  .readout strong { font-size: 1.2rem; }
  .big { font-size: 1.6rem !important; }
  .pos { color: #6ff0a6; }
  .stepper { display: flex; align-items: center; gap: 10px; }
  .stepper .btn { background: rgba(255,255,255,.06); color: #f4f2ee; border-color: rgba(255,255,255,.2); }

  .dock {
    position: sticky; bottom: 12px; z-index: 20; max-width: 880px; margin: 20px auto 0; padding: 12px 16px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px;
    background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: blur(14px); border-radius: 24px; box-shadow: 0 20px 50px -20px rgba(0,0,0,.5);
  }
  .switch.mini { min-height: 36px; font-size: 0.8rem; color: var(--muted); gap: 8px; }
  .autos { display: flex; gap: 6px; flex-wrap: wrap; }
  .spinbtn { min-width: 160px; min-height: 56px; font-size: 1.05rem; text-transform: uppercase; letter-spacing: 0.1em; }

  .pay { max-width: 880px; margin: 40px auto 0; }
  .paygrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-top: 14px; }
  .payitem { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 16px; background: var(--surface); border: 1px solid var(--line); font-size: 0.85rem; }
  .pi { width: 52px; height: 52px; flex: none; }
  .muted { color: var(--muted); } .small { font-size: 0.8rem; }

  @media (max-width: 640px) {
    .readout strong { font-size: 1rem; }
    .spinbtn { flex: 1 1 100%; }
  }
</style>
