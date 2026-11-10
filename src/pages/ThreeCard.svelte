<script lang="ts">
  import { cubicOut } from 'svelte/easing';
  import CardView from '../components/Card.svelte';
  import HowTo from '../components/HowTo.svelte';
  import ChipTray from '../components/ChipTray.svelte';
  import { deal, rank3, qualifies, shouldPlay, settle3, PAIR_PLUS, ANTE_BONUS, CATS, type Round, type Outcome, type Cat } from '../games/threecard';
  import type { Card } from '../lib/cards';
  import { wallet, settle, stake, settings, fmt } from '../lib/state.svelte';
  import { chipOf, short } from '../lib/chips';
  import { sfx } from '../lib/sfx';
  import { drop, pop } from '../lib/motion';
  import { t } from '../lib/i18n';

  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
  const NAMES: Record<Cat, [string, string]> = {
    high: ['Höchste Karte', 'High card'], pair: ['Paar', 'Pair'], flush: ['Flush', 'Flush'],
    straight: ['Strasse', 'Straight'], trips: ['Drilling', 'Three of a kind'], sf: ['Straight Flush', 'Straight flush'],
  };
  const cname = (c: Cat) => NAMES[c][settings.lang === 'de' ? 0 : 1];

  let chip = $state(25);
  let ante = $state(0);
  let pp = $state(0);
  let last = $state<{ ante: number; pp: number } | null>(null);
  let phase = $state<'bet' | 'deal' | 'decide' | 'reveal' | 'done'>('bet');
  let round = $state.raw<Round | null>(null);
  let pCards = $state<Card[]>([]);
  let dCards = $state<Card[]>([]);
  let played = $state(false);
  let out = $state<Outcome | null>(null);
  let hints = $state(true);
  const staked = $derived(ante + pp + (played ? ante : 0));
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, matchMedia('(prefers-reduced-motion: reduce)').matches ? 50 : ms));
  const pRank = $derived(pCards.length === 3 && pCards.every((c) => c.r) ? rank3(pCards) : null);
  const dRank = $derived(dCards.length === 3 && dCards.every((c) => c.r) ? rank3(dCards) : null);
  const advice = $derived(phase === 'decide' && round ? shouldPlay(round.player) : null);

  // after a round the chips stay on the table: deal again to repeat, or click a spot to start new bets
  function fresh(keep = false) { if (phase === 'done') { phase = 'bet'; pCards = []; dCards = []; out = null; played = false; if (!keep) { ante = 0; pp = 0; } } }
  function add(k: 'ante' | 'pp') {
    if (phase !== 'bet' && phase !== 'done') return;
    fresh();
    // the play bet equals the ante, so keep room for it
    const need = k === 'ante' ? chip * 2 : chip;
    if ((ante * 2 + pp) + need > wallet.balance) return;
    if (k === 'ante') ante += chip; else pp += chip;
    sfx('chip');
  }
  const clear = () => { if (phase === 'bet' || phase === 'done') { fresh(); ante = 0; pp = 0; } };
  function rebet() {
    if (!last || (phase !== 'bet' && phase !== 'done') || last.ante * 2 + last.pp > wallet.balance) return;
    fresh(true);
    ({ ante, pp } = last);
    sfx('chip');
  }

  async function start() {
    if (!ante || phase === 'deal' || phase === 'decide' || phase === 'reveal' || ante * 2 + pp > wallet.balance) return;
    fresh(true);
    stake(ante + pp);
    phase = 'deal';
    round = deal();
    pCards = []; dCards = [];
    for (let i = 0; i < 3; i++) {
      pCards.push({ r: 0, s: 0 }); sfx('card'); await sleep(170);
      dCards.push({ r: 0, s: 0 }); sfx('card'); await sleep(170);
    }
    await sleep(200);
    for (let i = 0; i < 3; i++) { pCards[i] = round.player[i]; sfx('card'); await sleep(230); }
    phase = 'decide';
  }

  async function decide(play: boolean) {
    if (phase !== 'decide' || !round) return;
    if (play) { if (ante > wallet.balance) return; stake(ante); sfx('chip'); }
    played = play;
    phase = 'reveal';
    await sleep(350);
    for (let i = 0; i < 3; i++) { dCards[i] = round.dealer[i]; sfx('card'); await sleep(380); }
    await sleep(250);
    out = settle3(round, ante, pp, play);
    const total = ante + pp + (play ? ante : 0);
    settle(out.back, out.back);
    sfx(out.back > total ? (out.back >= total * 4 ? 'big' : 'win') : out.back === total ? 'stop' : 'lose');
    last = { ante, pp };
    phase = 'done';
  }

  function dealFx(_: Element, { y = -260 } = {}) {
    return { duration: 380, easing: cubicOut, css: (t: number, u: number) => `transform: translate(${u * 120}px, ${u * y}px) rotate(${u * -24}deg); opacity:${Math.min(1, t * 3)}` };
  }
  function key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    if (phase === 'decide') { if (e.key === 'p' || e.key === 'Enter') decide(true); if (e.key === 'f') decide(false); return; }
    if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); start(); }
  }
  const RES: Record<Outcome['result'], [string, string]> = {
    fold: ['Gepasst', 'Folded'], noqual: ['Dealer qualifiziert nicht', 'Dealer does not qualify'],
    win: ['Gewonnen', 'You win'], lose: ['Dealer gewinnt', 'Dealer wins'], push: ['Unentschieden', 'Push'],
  };
</script>

<svelte:window onkeydown={key} />

<section class="wrap page">
  <header class="head rise">
    <div>
      <p class="eyebrow">{L('Gegen den Dealer · Pair Plus', 'Against the dealer · Pair Plus')}</p>
      <div class="h1row"><h1>Three Card Poker</h1><HowTo id="threecard" /></div>
    </div>
    <label class="switch mini"><span>{L('Strategie-Tipp', 'Strategy hint')}</span><input type="checkbox" bind:checked={hints} /></label>
  </header>

  <div class="felt rise" style="--i:1">
    <div class="arc mono">{L('DEALER SPIELT AB DAME', 'DEALER PLAYS WITH QUEEN HIGH')} · PAIR PLUS · ANTE BONUS</div>

    <div class="hand dealer" class:win={out && (out.result === 'lose')}>
      <span class="label">Dealer</span>
      <div class="cards">{#each dCards as c, i (i)}<div in:dealFx={{ y: -120 }}><CardView card={c} /></div>{/each}</div>
      <span class="rk">{#if dRank}{cname(dRank.cat)}{#if round && !qualifies(round.dealer)} · <em>{L('qualifiziert nicht', 'no qualify')}</em>{/if}{/if}</span>
    </div>

    <div class="banner-slot">
      {#if out}
        <div class="banner {out.result}" in:pop>
          {L(...RES[out.result])}
          {#if out.back}<span class="mono gain">+{fmt(out.back)}</span>{/if}
          {#if out.bonus}<em>Ante Bonus +{fmt(out.bonus)}</em>{/if}
        </div>
      {:else if advice !== null && hints}
        <div class="tip" in:pop>{advice ? L('Tipp: Spielen (Q-6-4 oder besser)', 'Hint: play (Q-6-4 or better)') : L('Tipp: Passen (schwächer als Q-6-4)', 'Hint: fold (weaker than Q-6-4)')}</div>
      {/if}
    </div>

    <div class="hand player">
      <div class="cards">{#each pCards as c, i (i)}<div in:dealFx><CardView card={c} /></div>{/each}</div>
      <span class="rk">{pRank ? cname(pRank.cat) : ''}</span>
    </div>

    <div class="spots">
      <button class="spot pp" class:hit={out && out.pp > 0} disabled={phase !== 'bet' && phase !== 'done'} onclick={() => add('pp')}>
        <span class="nm">Pair Plus</span><span class="mono py">{L('bis', 'up to')} 40:1</span>
        {#if pp}{#key pp}<span class="chip" data-v={chipOf(pp)} in:drop>{short(pp)}</span>{/key}{/if}
      </button>
      <button class="spot ante" class:hit={out && out.ante > 0} disabled={phase !== 'bet' && phase !== 'done'} onclick={() => add('ante')}>
        <span class="nm">Ante</span><span class="mono py">1:1</span>
        {#if ante}{#key ante}<span class="chip" data-v={chipOf(ante)} in:drop>{short(ante)}</span>{/key}{/if}
      </button>
      <div class="spot play" class:on={played} class:hit={out && out.play > 0}>
        <span class="nm">Play</span><span class="mono py">1:1</span>
        {#if played}<span class="chip" data-v={chipOf(ante)} in:drop>{short(ante)}</span>{/if}
      </div>
    </div>
  </div>

  <div class="dock panel">
    {#if phase === 'decide'}
      <div class="acts" in:pop>
        <button class="btn act fold" onclick={() => decide(false)}>{L('Passen', 'Fold')} <kbd>F</kbd></button>
        <button class="btn primary act" class:tipped={hints && advice} onclick={() => decide(true)} disabled={ante > wallet.balance}>{L('Spielen', 'Play')} <span class="mono">{fmt(ante)}</span> <kbd>P</kbd></button>
      </div>
    {:else}
      <ChipTray bind:value={chip} max={Math.max(1, wallet.balance)} />
      <div class="actions">
        <button class="btn sm ghost" onclick={clear} disabled={!(ante || pp) || phase === 'deal' || phase === 'reveal'}>{t('bet.clear')}</button>
        <button class="btn sm ghost" onclick={rebet} disabled={!last || phase === 'deal' || phase === 'reveal'}>{t('bet.rebet')}</button>
      </div>
      <div class="totalbox"><span class="eyebrow">{t('bet.total')}</span><strong class="mono">{fmt(phase === 'reveal' || played ? staked : ante + pp)}</strong></div>
      <button class="btn primary deal" disabled={!ante || phase === 'deal' || phase === 'reveal'} onclick={start}>{t('bj.deal')}</button>
    {/if}
  </div>

  <section class="pays">
    <div>
      <h2 class="eyebrow">Pair Plus</h2>
      {#each [...CATS].reverse().filter((c) => PAIR_PLUS[c]) as c}<p><span>{cname(c)}</span><b class="mono">{PAIR_PLUS[c]}:1</b></p>{/each}
    </div>
    <div>
      <h2 class="eyebrow">Ante Bonus</h2>
      {#each [...CATS].reverse().filter((c) => ANTE_BONUS[c]) as c}<p><span>{cname(c)}</span><b class="mono">{ANTE_BONUS[c]}:1</b></p>{/each}
      <p class="muted">{L('Wird immer bezahlt, wenn du spielst, auch wenn der Dealer gewinnt.', 'Always paid when you play, even if the dealer wins.')}</p>
    </div>
  </section>
</section>

<style>
  .page { padding-bottom: 120px; }
  .head { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 12px; padding: 28px 0 12px; }
  .h1row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  h1 { margin: 6px 0 0; font-size: clamp(2.2rem, 5vw, 3.6rem); letter-spacing: -0.04em; line-height: 0.95; }
  .h1row h1 { margin: 0; }
  .switch.mini { min-height: 36px; font-size: 0.8rem; color: var(--muted); gap: 8px; }
  .felt {
    --cw: clamp(56px, min(7.5vw, 10.5vh), 108px); position: relative; display: grid; justify-items: center; gap: 10px; padding: clamp(18px, 3vw, 34px) clamp(14px, 3vw, 40px) clamp(22px, 3vw, 40px);
    border-radius: 40px 40px 50% 50% / 40px 40px 26% 26%; color: #fff;
    background: radial-gradient(ellipse at 50% 0%, #6b1f2c, #33101a 75%); box-shadow: inset 0 0 0 1px rgba(255,255,255,.06), inset 0 0 0 10px rgba(0,0,0,.14), 0 30px 60px -30px rgba(0,0,0,.6);
  }
  .arc { font-size: 0.7rem; letter-spacing: 0.2em; color: rgba(255,230,200,.45); text-align: center; }
  .hand { display: grid; justify-items: center; gap: 8px; padding: 10px 18px; border-radius: 22px; transition: box-shadow 0.4s var(--ease-snap); }
  .hand.win { box-shadow: 0 0 0 2px #ff9a9d; }
  .label { font: 600 0.72rem 'Geist Mono Variable', monospace; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,.55); }
  .cards { display: flex; gap: 10px; min-height: calc(var(--cw) * 1.4); }
  .rk { min-height: 1.3em; font-weight: 600; color: #ffe2b0; }
  .rk em { font-style: normal; color: rgba(255,255,255,.55); font-weight: 400; }
  .banner-slot { min-height: 50px; display: grid; place-items: center; }
  .banner { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: center; padding: 10px 20px; border-radius: 999px; background: rgba(0,0,0,.45); font-weight: 600; box-shadow: 0 0 0 2px rgba(255,255,255,.3); }
  .banner.win, .banner.noqual { box-shadow: 0 0 0 2px #2fbf71; }
  .banner.lose, .banner.fold { box-shadow: 0 0 0 2px #e5484d; }
  .banner em { font-style: normal; font-size: 0.78rem; color: var(--gold); }
  .gain { color: #8ff0bf; }
  .tip { padding: 8px 16px; border-radius: 999px; background: rgba(0,0,0,.35); font-size: 0.85rem; color: #ffe2b0; }
  .spots { display: grid; grid-template-columns: repeat(3, minmax(0, min(150px, 17vh))); gap: 14px; justify-content: center; margin-top: 4px; }
  .spot {
    position: relative; display: grid; justify-items: center; align-content: center; gap: 2px; aspect-ratio: 1; border-radius: 50%; color: #fff;
    border: 2px solid rgba(255,230,200,.4); background: rgba(0,0,0,.16); transition: transform 0.35s var(--ease-snap), box-shadow 0.3s var(--ease-snap);
  }
  button.spot:hover:not(:disabled) { transform: translateY(-2px); }
  .spot.pp { border-color: #f2c046; }
  .spot.play { border-style: dashed; }
  .spot.play.on { border-style: solid; border-color: #6aa8ff; }
  .spot.hit { box-shadow: 0 0 0 3px #f2c046, 0 0 30px -6px #f2c046; }
  .nm { font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; font-size: 0.85rem; }
  .py { font-size: 0.72rem; opacity: 0.7; }
  .spot .chip { --size: 42px; position: absolute; bottom: -8px; right: -4px; }
  .dock {
    position: sticky; bottom: 12px; z-index: 20; margin-top: 20px; padding: 12px 16px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 20px; min-height: 76px;
    background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: blur(14px); border-radius: 24px; box-shadow: 0 20px 50px -20px rgba(0,0,0,.5);
  }
  .actions { display: flex; gap: 6px; }
  .totalbox { display: grid; gap: 4px; min-width: 80px; }
  .totalbox strong { font-size: 1.25rem; }
  .deal { min-width: 140px; min-height: 52px; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.08em; }
  .acts { display: flex; gap: 10px; width: 100%; justify-content: center; }
  .act { min-width: 160px; min-height: 54px; font-size: 1rem; }
  .act.fold { color: #ff9a9d; }
  .act.tipped { box-shadow: 0 0 0 3px color-mix(in srgb, var(--gold) 55%, transparent); }
  kbd { font: 500 0.7rem 'Geist Mono Variable', monospace; opacity: 0.55; border: 1px solid currentColor; border-radius: 4px; padding: 0 4px; }
  .pays { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-top: 28px; }
  .pays > div { padding: 16px 18px; border-radius: 20px; background: var(--surface); border: 1px solid var(--line); }
  .pays h2 { margin: 0 0 8px; }
  .pays p { display: flex; justify-content: space-between; margin: 4px 0; font-size: 0.9rem; }
  .pays .muted { color: var(--muted); font-size: 0.78rem; display: block; }
  @media (max-width: 640px) {
    .felt { --cw: 58px; border-radius: 28px; }
    .spots { gap: 8px; grid-template-columns: repeat(3, 1fr); }
    .nm { font-size: 0.72rem; }
    .spot .chip { --size: 34px; }
    .act { min-width: 0; flex: 1; }
    .act kbd { display: none; }
    .arc { font-size: 0.6rem; letter-spacing: 0.12em; }
    .dock :global(.tray) { flex-wrap: nowrap; overflow-x: auto; width: 100%; justify-content: flex-start; padding: 8px 4px 4px; }
    .deal { flex: 1; min-width: 0; }
  }
</style>
