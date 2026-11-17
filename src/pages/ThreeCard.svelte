<script lang="ts">
  // Three Card Poker at a shared table: everyone plays their own hand against one dealer. Alone, with bots, or in a
  // room: the host deals from one deck, every player decides Play or Fold, then the dealer shows and each player
  // settles their own bets on their own device.
  import { onDestroy, untrack } from 'svelte';
  import DeckSelect from '../components/DeckSelect.svelte';
  import { FULL } from '../lib/decks';
  import { cubicOut } from 'svelte/easing';
  import CardView from '../components/Card.svelte';
  import HowTo from '../components/HowTo.svelte';
  import ChipTray from '../components/ChipTray.svelte';
  import RoomBar from '../components/RoomBar.svelte';
  import { Room } from '../lib/net.svelte';
  import { dealTable, rank3, qualifies, shouldPlay, settle3, PAIR_PLUS, ANTE_BONUS, CATS, type Outcome, type Cat } from '../games/threecard';
  import type { Card } from '../lib/cards';
  import { wallet, settle, stake, credit, settings, fmt } from '../lib/state.svelte';
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

  // ---------- my bets (local) ----------
  let chip = $state(25);
  let ante = $state(0);
  let pp = $state(0);
  let last = $state<{ ante: number; pp: number } | null>(null);
  let ready = $state(0); // what I staked for the coming deal (ante + pair plus), 0 = not ready
  let phase = $state<'bet' | 'wait' | 'deal' | 'decide' | 'sent' | 'reveal' | 'done'>('bet');
  let pCards = $state<Card[]>([]);
  let dCards = $state<Card[]>([]);
  let played = $state(false);
  let out = $state<Outcome | null>(null);
  let hints = $state(true);
  const staked = $derived(ante + pp + (played ? ante : 0));
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, matchMedia('(prefers-reduced-motion: reduce)').matches ? 50 : ms));
  const pRank = $derived(pCards.length === 3 && pCards.every((c) => c.r) ? rank3(pCards) : null);
  const dRank = $derived(dCards.length === 3 && dCards.every((c) => c.r) ? rank3(dCards) : null);
  const advice = $derived(phase === 'decide' && pCards.length === 3 ? shouldPlay(pCards) : null);
  const canBet = $derived((phase === 'bet' || phase === 'done') && !ready);

  // ---------- the shared table (host decides) ----------
  type Seat = { id: string; name: string; bot?: boolean; ante: number; pp: number; ready: boolean; cards: Card[]; decision: '' | 'play' | 'fold'; back?: number; result?: Outcome['result'] };
  const share = $state({ phase: 'bet' as 'bet' | 'decide' | 'reveal' | 'done', round: 0, dealer: [] as Card[], seats: [] as Seat[], until: 0 });
  const room = new Room('threecard', onMsg, (id) => { share.seats = share.seats.filter((x) => x.id !== id); hostCheck(); sync(); });
  const isHost = $derived(room.role !== 'guest');
  const mine = $derived(share.seats.find((x) => x.id === room.myId));
  const others = $derived(share.seats.filter((x) => x.id !== room.myId));
  const BOTS = ['Mila', 'Jonas', 'Lea'];
  const seat = (id: string, name: string, bot = false): Seat => ({ id, name, bot, ante: 0, pp: 0, ready: false, cards: [], decision: '' });

  function onMsg(m: any, from: string) {
    if (m.t === 'state') { Object.assign(share, m.s); react(); return; }
    if (room.role === 'guest') return;
    let st = share.seats.find((x) => x.id === from);
    if (!st) share.seats.push((st = seat(from, 'Guest')));
    if (m.t === 'hello') st.name = String(m.name).slice(0, 24);
    if (m.t === 'bet' && (share.phase === 'bet' || share.phase === 'done')) {
      if (share.phase === 'done') nextRound();
      st = share.seats.find((x) => x.id === from)!;
      Object.assign(st, { ante: Math.max(0, +m.ante || 0), pp: Math.max(0, +m.pp || 0), ready: !!m.ready && +m.ante > 0 });
      hostCheck();
    }
    if (m.t === 'decide' && share.phase === 'decide' && st.cards.length && !st.decision) { st.decision = m.play ? 'play' : 'fold'; hostCheck(); }
    sync();
  }
  /** Host: send the table to everyone and run the same reaction locally. */
  function sync() {
    if (room.role === 'guest') return;
    untrack(() => { room.broadcast({ t: 'state', s: $state.snapshot(share) }); react(); });
  }
  // guests say hello; the host keeps its own seat and the bots in the list
  $effect(() => { if (room.role === 'guest' && room.status === 'open') room.send({ t: 'hello', name: settings.name }); });
  $effect(() => {
    if (room.role === 'guest') return;
    const name = settings.name || L('Du', 'You'), bots = settings.bots, me = room.myId;
    untrack(() => {
      const keep = share.seats.filter((x) => !x.bot && x.id !== me && x.id !== 'me');
      const meSeat = share.seats.find((x) => x.id === me || x.id === 'me') ?? seat(me, name);
      Object.assign(meSeat, { id: me, name });
      share.seats = [meSeat, ...keep, ...(bots ? BOTS.map((n, i) => share.seats.find((x) => x.id === 'bot' + i) ?? seat('bot' + i, n, true)) : [])];
      sync();
    });
  });
  // after leaving a room, a fresh table at home
  let wasGuest = false;
  $effect(() => {
    if (room.role === 'guest') wasGuest = true;
    else if (wasGuest) untrack(() => { wasGuest = false; if (ready) credit(ready); ready = 0; Object.assign(share, { phase: 'bet', dealer: [], seats: [], until: 0 }); phase = 'bet'; pCards = []; dCards = []; out = null; });
  });

  // ---------- host: when to deal, when to show ----------
  let timer: ReturnType<typeof setTimeout> | undefined;
  function hostCheck() {
    if (room.role === 'guest') return;
    clearTimeout(timer);
    const humans = share.seats.filter((x) => !x.bot);
    if (share.phase === 'bet') {
      const r = humans.filter((x) => x.ready);
      if (!r.length) { share.until = 0; return; }
      // everyone ready: deal now; otherwise give the others a few seconds
      if (r.length === humans.length) return hostDeal();
      if (!share.until) share.until = Date.now() + 12000;
      timer = setTimeout(hostDeal, share.until - Date.now());
    } else if (share.phase === 'decide') {
      const open = share.seats.filter((x) => x.cards.length && !x.decision);
      if (!open.length) return hostReveal();
      timer = setTimeout(() => { for (const x of open) if (!x.decision) x.decision = 'fold'; hostReveal(); }, Math.max(0, share.until - Date.now()));
    }
  }
  function hostDeal() {
    if (share.phase !== 'bet') return;
    for (const b of share.seats.filter((x) => x.bot)) Object.assign(b, { ante: [10, 25, 25, 50, 100][Math.floor(Math.random() * 5)], pp: Math.random() < 0.5 ? 10 : 0, ready: true });
    const inn = share.seats.filter((x) => x.ready);
    if (!inn.length) return;
    const d = dealTable(inn.length);
    inn.forEach((x, i) => { x.cards = d.hands[i]; x.decision = ''; });
    Object.assign(share, { phase: 'decide', round: share.round + 1, dealer: d.dealer, until: Date.now() + 25000 });
    // bots think for a moment, then follow the Q-6-4 rule (with a little bluff now and then)
    for (const b of inn.filter((x) => x.bot)) setTimeout(() => { if (share.phase === 'decide' && !b.decision) { b.decision = shouldPlay(b.cards) || Math.random() < 0.1 ? 'play' : 'fold'; hostCheck(); sync(); } }, 2200 + Math.random() * 2500);
    sync();
    hostCheck();
  }
  function hostReveal() {
    if (share.phase !== 'decide') return;
    for (const x of share.seats) if (x.cards.length) { const o = settle3({ player: x.cards, dealer: share.dealer }, x.ante, x.pp, x.decision === 'play'); x.back = o.back; x.result = o.result; }
    share.phase = 'reveal';
    sync();
    timer = setTimeout(() => { share.phase = 'done'; sync(); }, 2600);
  }
  function nextRound() {
    for (const x of share.seats) Object.assign(x, { ready: false, cards: [], decision: '', back: undefined, result: undefined, ...(x.bot ? { ante: 0, pp: 0 } : {}) });
    Object.assign(share, { phase: 'bet', dealer: [], until: 0 });
  }

  // ---------- every player: follow the table ----------
  let dealt = 0, shown = 0;
  function react() {
    if (share.phase === 'bet' && !ready && (phase === 'done' || phase === 'wait')) { /* keep the finished hand on screen until a new bet */ }
    if (share.phase === 'decide' && share.round !== dealt) { dealt = share.round; animateDeal(); }
    if ((share.phase === 'reveal' || share.phase === 'done') && share.round !== shown && dealt === share.round) { shown = share.round; animateReveal(); }
  }
  async function animateDeal() {
    const myCards = mine?.cards ?? [];
    const round = share.round;
    fresh(true);
    phase = 'deal';
    pCards = []; dCards = [];
    for (let i = 0; i < 3; i++) {
      if (myCards.length) { pCards.push({ r: 0, s: 0 }); sfx('card'); await sleep(170); }
      dCards.push({ r: 0, s: 0 }); sfx('card'); await sleep(170);
    }
    await sleep(200);
    for (let i = 0; i < myCards.length; i++) { pCards[i] = myCards[i]; sfx('card'); await sleep(230); }
    if (share.round !== round) return;
    phase = myCards.length ? (mine?.decision ? 'sent' : 'decide') : 'wait';
  }
  async function animateReveal() {
    while (phase === 'deal') await sleep(100);
    const myCards = mine?.cards ?? [];
    phase = 'reveal';
    await sleep(350);
    for (let i = 0; i < 3; i++) { dCards[i] = share.dealer[i]; sfx('card'); await sleep(380); }
    await sleep(250);
    if (myCards.length && ready) {
      const o = settle3({ player: myCards, dealer: share.dealer }, ante, pp, played);
      out = o;
      settle(o.back, o.back);
      const total = ante + pp + (played ? ante : 0);
      sfx(o.back > total ? (o.back >= total * 4 ? 'big' : 'win') : o.back === total ? 'stop' : 'lose');
      last = { ante, pp };
    }
    ready = 0;
    phase = 'done';
  }

  // after a round the chips stay on the table: deal again to repeat, or click a spot to start new bets
  function fresh(keep = false) { if (phase === 'done' || phase === 'wait') { phase = 'bet'; pCards = []; dCards = []; out = null; played = false; if (!keep) { ante = 0; pp = 0; } } }
  function add(k: 'ante' | 'pp') {
    if (!canBet) return;
    fresh();
    // the play bet equals the ante, so keep room for it
    const need = k === 'ante' ? chip * 2 : chip;
    if ((ante * 2 + pp) + need > wallet.balance) return;
    if (k === 'ante') ante += chip; else pp += chip;
    sfx('chip');
  }
  const clear = () => { if (canBet) { fresh(); ante = 0; pp = 0; } };
  function rebet() {
    if (!last || !canBet || last.ante * 2 + last.pp > wallet.balance) return;
    fresh(true);
    ({ ante, pp } = last);
    sfx('chip');
  }

  /** Deal: lock in my bets. Alone I'm dealt at once; in a room the host waits for the others. */
  function start() {
    if (ready) { // take the bets back before the cards come
      if (share.phase !== 'bet') return;
      credit(ready); ready = 0; phase = 'bet';
      tell(false);
      return;
    }
    if (!ante || !canBet || ante * 2 + pp > wallet.balance) return;
    fresh(true);
    stake(ante + pp);
    ready = ante + pp;
    played = false;
    phase = 'wait';
    tell(true);
  }
  function tell(r: boolean) {
    if (room.role === 'guest') room.send({ t: 'bet', ante, pp, ready: r });
    else onMsg({ t: 'bet', ante, pp, ready: r }, room.myId);
  }

  function decide(play: boolean) {
    if (phase !== 'decide') return;
    if (play) { if (ante > wallet.balance) return; stake(ante); sfx('chip'); }
    played = play;
    phase = 'sent';
    if (room.role === 'guest') room.send({ t: 'decide', play });
    else onMsg({ t: 'decide', play }, room.myId);
  }
  onDestroy(() => { clearTimeout(timer); if (ready && share.phase === 'bet') credit(ready); room.leave(); });

  // countdown shown while the table waits for the others
  let now = $state(Date.now());
  $effect(() => { const id = setInterval(() => (now = Date.now()), 250); return () => clearInterval(id); });
  const secs = $derived(share.until ? Math.max(0, Math.ceil((share.until - now) / 1000)) : 0);

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
      <div class="h1row"><h1>Three Card Poker</h1><HowTo id="threecard" /><DeckSelect supported={FULL} which="cards52" /></div>
    </div>
    <RoomBar {room}>
      {#snippet extra()}
        {#if isHost}<label class="switch mini"><span>{t('bots')}</span><input type="checkbox" bind:checked={settings.bots} /></label>{/if}
        <label class="switch mini"><span>{L('Strategie-Tipp', 'Strategy hint')}</span><input type="checkbox" bind:checked={hints} /></label>
      {/snippet}
    </RoomBar>
  </header>

  <div class="felt rise" style="--i:1">
    <div class="arc mono">{L('DEALER SPIELT AB DAME', 'DEALER PLAYS WITH QUEEN HIGH')} · PAIR PLUS · ANTE BONUS</div>

    <div class="hand dealer" class:win={out && (out.result === 'lose')}>
      <span class="label">Dealer</span>
      <div class="cards">{#each dCards as c, i (i)}<div in:dealFx={{ y: -120 }}><CardView card={c} /></div>{/each}</div>
      <span class="rk">{#if dRank}{cname(dRank.cat)}{#if !qualifies(dCards)} · <em>{L('qualifiziert nicht', 'no qualify')}</em>{/if}{/if}</span>
    </div>

    <!-- the other players at the table -->
    {#if others.length}
      <div class="seats">
        {#each others as o (o.id)}
          {@const open = share.phase === 'reveal' || share.phase === 'done'}
          <div class="seat" class:fold={o.decision === 'fold'} class:won={open && (o.back ?? 0) > o.ante + o.pp + (o.decision === 'play' ? o.ante : 0)}>
            <div class="sh"><span class="av" class:bot={o.bot}>{o.name.slice(0, 1)}</span><span class="nm2">{o.name}</span></div>
            <div class="mini">{#each o.cards.length ? o.cards : [] as c, i (i)}<CardView card={open && o.decision !== 'fold' ? c : { r: 0, s: 0 }} />{/each}</div>
            <span class="st mono">
              {#if open && o.cards.length}{o.decision === 'fold' ? L('Gepasst', 'Folded') : cname(rank3(o.cards).cat)}{#if (o.back ?? 0) > 0} · +{fmt(o.back ?? 0)}{/if}
              {:else if share.phase === 'decide' && o.cards.length}{o.decision ? (o.decision === 'play' ? L('Spielt', 'Plays') : L('Passt', 'Folds')) : L('überlegt …', 'thinking …')}
              {:else if o.ready}{L('Bereit', 'Ready')} · {fmt(o.ante + o.pp)}{:else}{L('setzt …', 'betting …')}{/if}
            </span>
          </div>
        {/each}
      </div>
    {/if}

    <div class="banner-slot">
      {#if out}
        <div class="banner {out.result}" in:pop>
          {L(...RES[out.result])}
          {#if out.back}<span class="mono gain">+{fmt(out.back)}</span>{/if}
          {#if out.bonus}<em>Ante Bonus +{fmt(out.bonus)}</em>{/if}
        </div>
      {:else if phase === 'wait' && share.phase === 'bet'}
        <div class="tip" in:pop>{secs ? L(`Warten auf die anderen … ${secs}s`, `Waiting for the others … ${secs}s`) : L('Gleich wird ausgeteilt …', 'Dealing in a moment …')}</div>
      {:else if phase === 'sent' || (phase === 'wait' && share.phase === 'decide')}
        <div class="tip" in:pop>{L('Die anderen entscheiden noch …', 'The others are still deciding …')}{secs ? ` ${secs}s` : ''}</div>
      {:else if advice !== null && hints}
        <div class="tip" in:pop>{advice ? L('Tipp: Spielen (Q-6-4 oder besser)', 'Hint: play (Q-6-4 or better)') : L('Tipp: Passen (schwächer als Q-6-4)', 'Hint: fold (weaker than Q-6-4)')}</div>
      {/if}
    </div>

    <div class="hand player">
      <div class="cards">{#each pCards as c, i (i)}<div in:dealFx><CardView card={c} /></div>{/each}</div>
      <span class="rk">{pRank ? cname(pRank.cat) : ''}</span>
    </div>

    <div class="spots">
      <button class="spot pp" class:hit={out && out.pp > 0} disabled={!canBet} onclick={() => add('pp')}>
        <span class="nm">Pair Plus</span><span class="mono py">{L('bis', 'up to')} 40:1</span>
        {#if pp}{#key pp}<span class="chip" data-v={chipOf(pp)} in:drop>{short(pp)}</span>{/key}{/if}
      </button>
      <button class="spot ante" class:hit={out && out.ante > 0} disabled={!canBet} onclick={() => add('ante')}>
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
        <button class="btn sm ghost" onclick={clear} disabled={!(ante || pp) || !canBet}>{t('bet.clear')}</button>
        <button class="btn sm ghost" onclick={rebet} disabled={!last || !canBet}>{t('bet.rebet')}</button>
      </div>
      <div class="totalbox"><span class="eyebrow">{t('bet.total')}</span><strong class="mono">{fmt(phase === 'reveal' || played ? staked : ante + pp)}</strong></div>
      {#if ready && share.phase === 'bet'}
        <button class="btn deal" onclick={start}>{L('Zurücknehmen', 'Take back')}</button>
      {:else}
        <button class="btn primary deal" disabled={!ante || !canBet} onclick={start}>{t('bj.deal')}</button>
      {/if}
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
  /* the other players: small name plates with their three cards */
  .seats { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; --cw: 34px; }
  .seat { display: grid; justify-items: center; gap: 6px; padding: 8px 12px; border-radius: 16px; background: rgba(0,0,0,.22); min-width: 130px; transition: box-shadow 0.3s, opacity 0.3s; }
  .seat.fold { opacity: 0.55; }
  .seat.won { box-shadow: 0 0 0 2px #2fbf71; }
  .sh { display: flex; gap: 6px; align-items: center; font-size: 0.82rem; }
  .av { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: #3d9bff; font-weight: 700; font-size: 0.72rem; }
  .av.bot { background: #6c6f7d; }
  .mini { display: flex; gap: 3px; min-height: calc(var(--cw) * 1.4); }
  .st { font-size: 0.7rem; color: #ffe2b0; min-height: 1.2em; }
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
