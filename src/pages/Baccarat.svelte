<script lang="ts">
  import { cubicOut } from 'svelte/easing';
  import CardView from '../components/Card.svelte';
  import ChipTray from '../components/ChipTray.svelte';
  import { coup, payout, points, type BetKey, type Coup } from '../games/baccarat';
  import { newShoe, type Card } from '../lib/cards';
  import { wallet, settle, fmt } from '../lib/state.svelte';
  import { chipOf, short } from '../lib/chips';
  import { sfx } from '../lib/sfx';
  import { drop, pop } from '../lib/motion';
  import { t, type Key } from '../lib/i18n';

  let chip = $state(25);
  let bets = $state<Record<BetKey, number>>({ player: 0, banker: 0, tie: 0, pPair: 0, bPair: 0 });
  let last = $state<Record<BetKey, number> | null>(null);
  let undoStack = $state<Record<BetKey, number>[]>([]);
  let shoe = newShoe(8);
  let phase = $state<'bet' | 'deal' | 'done'>('bet');
  let pCards = $state<Card[]>([]);
  let bCards = $state<Card[]>([]);
  let result = $state<Coup | null>(null);
  let won = $state(0);
  let history = $state<('player' | 'banker' | 'tie')[]>([]);
  const total = $derived(Object.values(bets).reduce((a, b) => a + b, 0));
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, matchMedia('(prefers-reduced-motion: reduce)').matches ? 50 : ms));

  function add(k: BetKey) {
    if (phase === 'deal') return;
    if (phase === 'done') { phase = 'bet'; pCards = []; bCards = []; result = null; }
    if (total + chip > wallet.balance) return;
    undoStack.push({ ...bets });
    bets[k] += chip;
    sfx('chip');
  }
  const undo = () => { if (phase !== 'deal' && undoStack.length) bets = undoStack.pop()!; };
  const clear = () => { if (phase !== 'deal') { undoStack.push({ ...bets }); bets = { player: 0, banker: 0, tie: 0, pPair: 0, bPair: 0 }; } };
  function rebet() {
    if (!last || phase === 'deal') return;
    const s = Object.values(last).reduce((a, b) => a + b, 0);
    if (s > wallet.balance) return;
    if (phase === 'done') { phase = 'bet'; pCards = []; bCards = []; result = null; }
    bets = { ...last };
    sfx('chip');
  }

  async function deal() {
    if (!total || phase === 'deal' || total > wallet.balance) return;
    if (shoe.length < 30) { shoe = newShoe(8); sfx('shuffle'); await sleep(900); }
    phase = 'deal';
    pCards = []; bCards = []; result = null; won = 0;
    const c = coup(() => shoe.pop()!);
    // deal P, B, P, B face down, then reveal; third cards come afterwards
    const order: [Card[], Card][] = [[c.player, c.player[0]], [c.banker, c.banker[0]], [c.player, c.player[1]], [c.banker, c.banker[1]]];
    for (const [side, card] of order) {
      (side === c.player ? pCards : bCards).push({ r: 0, s: 0 });
      sfx('card');
      await sleep(260);
      void card;
    }
    await sleep(250);
    for (let i = 0; i < 2; i++) { pCards[i] = c.player[i]; sfx('card'); await sleep(320); bCards[i] = c.banker[i]; sfx('card'); await sleep(320); }
    if (c.player[2]) { await sleep(350); pCards.push(c.player[2]); sfx('card'); await sleep(520); }
    if (c.banker[2]) { await sleep(350); bCards.push(c.banker[2]); sfx('card'); await sleep(520); }
    result = c;
    const back = (Object.keys(bets) as BetKey[]).reduce((s, k) => s + payout(k, bets[k], c), 0);
    won = back;
    settle(back - total, back);
    sfx(back > total ? (back >= total * 5 ? 'big' : 'win') : back === total ? 'stop' : 'lose');
    history = [...history, c.winner].slice(-120);
    last = { ...bets };
    bets = { player: 0, banker: 0, tie: 0, pPair: 0, bPair: 0 };
    undoStack = [];
    phase = 'done';
  }

  // Big Road: a new column whenever the winner changes, ties are marked on the previous mark
  const bigRoad = $derived.by(() => {
    const cols: { w: 'player' | 'banker'; ties: number }[][] = [];
    for (const h of history) {
      if (h === 'tie') { const col = cols[cols.length - 1]; if (col) col[col.length - 1].ties++; continue; }
      const col = cols[cols.length - 1];
      if (col && col[0].w === h) col.push({ w: h, ties: 0 });
      else cols.push([{ w: h, ties: 0 }]);
    }
    return cols.slice(-24);
  });
  const counts = $derived({ player: history.filter((h) => h === 'player').length, banker: history.filter((h) => h === 'banker').length, tie: history.filter((h) => h === 'tie').length });

  function dealFx(_: Element, { x = 0, y = -260 } = {}) {
    return { duration: 420, easing: cubicOut, css: (t: number, u: number) => `transform: translate(${u * x}px, ${u * y}px) rotate(${u * -20}deg); opacity:${Math.min(1, t * 3)}` };
  }
  const SPOTS: [BetKey, string, string][] = [['pPair', 'bc.pPair', '11:1'], ['player', 'bc.player', '1:1'], ['tie', 'bc.tie', '8:1'], ['banker', 'bc.banker', '0.95:1'], ['bPair', 'bc.bPair', '11:1']];
  function key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); deal(); }
  }
</script>

<svelte:window onkeydown={key} />

<section class="wrap page">
  <header class="head rise">
    <div>
      <p class="eyebrow">Punto Banco · 8 decks</p>
      <h1>Baccarat</h1>
    </div>
    <div class="stats mono">
      <span class="p">P {counts.player}</span><span class="b">B {counts.banker}</span><span class="tt">T {counts.tie}</span>
    </div>
  </header>

  <div class="felt rise" style="--i:1">
    <div class="hands">
      {#each [['player', pCards, result?.p], ['banker', bCards, result?.b]] as [side, cards, pts]}
        {@const list = cards as Card[]}
        <div class="side {side}" class:win={result?.winner === side}>
          <span class="label">{t(('bc.' + side) as Key)}</span>
          <div class="cards">
            {#each list as c, i (i)}
              <div class="slot" class:third={i === 2} in:dealFx={{ x: side === 'player' ? 260 : -40, y: -240 }}><CardView card={c} /></div>
            {/each}
          </div>
          <span class="pts mono">{list.length && list.every((c) => c.r) ? points(list) : pts ?? ''}</span>
        </div>
      {/each}
    </div>
    <div class="banner-slot">
      {#if result}
        <div class="banner {result.winner}" in:pop>
          {t(('bc.win.' + result.winner) as Key)} <span class="mono">{result.p} : {result.b}</span>
          {#if result.natural}<em>Natural</em>{/if}
          {#if won}<span class="mono gain">+{fmt(won)}</span>{/if}
        </div>
      {/if}
    </div>
    <div class="spots">
      {#each SPOTS as [k, label, pays]}
        <button class="spot {k}" class:small={k === 'pPair' || k === 'bPair'} class:hit={result && payout(k, 1, result) > 1} disabled={phase === 'deal'} onclick={() => add(k)}>
          <span class="nm">{t(label as Key)}</span>
          <span class="mono py">{pays}</span>
          {#if bets[k]}{#key bets[k]}<span class="chip" data-v={chipOf(bets[k])} in:drop>{short(bets[k])}</span>{/key}{/if}
        </button>
      {/each}
    </div>
    <div class="road" aria-label="Big Road">
      {#each bigRoad as col}
        <div class="col">
          {#each col.slice(0, 6) as m}<i class={m.w} class:tie={m.ties > 0}></i>{/each}
        </div>
      {/each}
    </div>
  </div>

  <div class="dock panel">
    <ChipTray bind:value={chip} max={Math.max(1, wallet.balance - total)} />
    <div class="actions">
      <button class="btn sm ghost" onclick={undo} disabled={phase === 'deal' || !undoStack.length}>{t('bet.undo')}</button>
      <button class="btn sm ghost" onclick={clear} disabled={phase === 'deal' || !total}>{t('bet.clear')}</button>
      <button class="btn sm ghost" onclick={rebet} disabled={phase === 'deal' || !last}>{t('bet.rebet')}</button>
    </div>
    <div class="totalbox"><span class="eyebrow">{t('bet.total')}</span><strong class="mono">{fmt(total)}</strong></div>
    <button class="btn primary deal" disabled={!total || phase === 'deal'} onclick={deal}>{t('bj.deal')}</button>
  </div>
</section>

<style>
  .page { padding-bottom: 120px; }
  .head { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 12px; padding: 28px 0 12px; }
  h1 { margin: 6px 0 0; font-size: clamp(2.2rem, 5vw, 3.6rem); letter-spacing: -0.04em; line-height: 0.95; }
  .stats { display: flex; gap: 8px; font-size: 0.85rem; }
  .stats span { padding: 6px 12px; border-radius: 999px; background: var(--surface); }
  .p { color: #6aa8ff; } .b { color: #ff6b6f; } .tt { color: #4fe3a0; }
  .felt {
    --cw: clamp(64px, 7vw, 104px); position: relative; display: grid; gap: 18px; padding: clamp(18px, 3vw, 34px); border-radius: 40px 40px 120px 120px;
    background: radial-gradient(ellipse at 50% 0%, #17406a, #0b2140 75%); box-shadow: inset 0 0 0 1px rgba(255,255,255,.06), 0 30px 60px -30px rgba(0,0,0,.6); color: #fff;
  }
  .hands { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .side { display: grid; justify-items: center; gap: 10px; padding: 14px; border-radius: 22px; background: rgba(0,0,0,.18); transition: box-shadow 0.4s var(--ease-snap), background-color 0.4s var(--ease-snap); min-height: calc(var(--cw) * 1.4 + 90px); }
  .side.player.win { box-shadow: 0 0 0 2px #6aa8ff, 0 0 40px -10px #6aa8ff; }
  .side.banker.win { box-shadow: 0 0 0 2px #ff6b6f, 0 0 40px -10px #ff6b6f; }
  .label { font: 600 0.75rem 'Geist Mono Variable', monospace; letter-spacing: 0.18em; text-transform: uppercase; }
  .player .label { color: #9cc3ff; } .banker .label { color: #ff9a9d; }
  .cards { display: flex; gap: 8px; align-items: center; min-height: calc(var(--cw) * 1.4); }
  .slot.third { transform: rotate(90deg); margin: 0 calc(var(--cw) * 0.2); }
  .pts { font-size: 1.6rem; font-weight: 700; min-height: 1.2em; }
  .banner-slot { min-height: 52px; display: grid; place-items: center; }
  .banner { display: flex; gap: 10px; align-items: center; padding: 10px 20px; border-radius: 999px; background: rgba(0,0,0,.45); font-weight: 600; }
  .banner.player { box-shadow: 0 0 0 2px #6aa8ff; } .banner.banker { box-shadow: 0 0 0 2px #ff6b6f; } .banner.tie { box-shadow: 0 0 0 2px #4fe3a0; }
  .banner em { font-style: normal; font-size: 0.75rem; color: var(--gold); text-transform: uppercase; letter-spacing: 0.1em; }
  .gain { color: #8ff0bf; }
  .spots { display: grid; grid-template-columns: 0.7fr 1.2fr 0.9fr 1.2fr 0.7fr; gap: 10px; }
  .spot {
    position: relative; display: grid; justify-items: center; align-content: center; gap: 4px; min-height: 104px; border-radius: 22px; color: #fff;
    border: 2px solid rgba(255,255,255,.28); background: rgba(0,0,0,.14); transition: transform 0.35s var(--ease-snap), background-color 0.25s var(--ease-snap), box-shadow 0.3s var(--ease-snap);
  }
  .spot:hover:not(:disabled) { transform: translateY(-2px); background: rgba(255,255,255,.06); }
  .spot:active:not(:disabled) { transform: scale(0.97); transition-duration: 0.16s; }
  .spot.player { border-color: #6aa8ff; } .spot.banker { border-color: #ff6b6f; } .spot.tie { border-color: #4fe3a0; }
  .spot.small { min-height: 104px; font-size: 0.78rem; }
  .spot.hit { box-shadow: 0 0 0 3px #f2c046, 0 0 30px -6px #f2c046; }
  .nm { font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; font-size: 0.85rem; }
  .py { font-size: 0.72rem; opacity: 0.7; }
  .spot .chip { --size: 40px; position: absolute; right: 8px; top: 8px; }
  .road { display: flex; gap: 2px; min-height: 92px; padding: 8px; border-radius: 14px; background: #f4f2ee; overflow: hidden; }
  .col { display: grid; grid-template-rows: repeat(6, 12px); gap: 2px; }
  .col i { width: 12px; height: 12px; border-radius: 50%; border: 2.5px solid; position: relative; }
  .col i.player { border-color: #2a6fd6; } .col i.banker { border-color: #c8262c; }
  .col i.tie::after { content: ''; position: absolute; left: -2px; right: -2px; top: 50%; height: 2px; background: #1b8a55; transform: rotate(-45deg); }
  .dock {
    position: sticky; bottom: 12px; z-index: 20; margin-top: 20px; padding: 12px 16px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 20px;
    background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: blur(14px); border-radius: 24px; box-shadow: 0 20px 50px -20px rgba(0,0,0,.5);
  }
  .actions { display: flex; gap: 6px; }
  .totalbox { display: grid; gap: 4px; min-width: 80px; }
  .totalbox strong { font-size: 1.25rem; }
  .deal { min-width: 140px; min-height: 52px; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.08em; }
  @media (max-width: 720px) {
    .felt { border-radius: 28px; }
    .spots { grid-template-columns: repeat(3, 1fr); }
    .spot.small { grid-row: 2; min-height: 70px; }
    .spot { min-height: 84px; }
    .hands { gap: 10px; }
    .side { padding: 10px 6px; }
    .felt { --cw: 54px; }
    .dock { padding: 10px; gap: 8px; }
    .dock :global(.tray) { flex-wrap: nowrap; overflow-x: auto; width: 100%; justify-content: flex-start; padding: 8px 4px 4px; }
    .dock :global(.tray .chip) { --size: 38px; }
    .deal { flex: 1; min-width: 0; }
  }
</style>
