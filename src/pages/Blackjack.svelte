<script lang="ts">
  import { onDestroy, onMount, untrack } from 'svelte';
  import { fly, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import CardView from '../components/Card.svelte';
  import ChipTray from '../components/ChipTray.svelte';
  import RoomBar from '../components/RoomBar.svelte';
  import {
    newTable, PRESETS, start, dealOrder, afterDeal, act, insure, dealerNeedsCard, draw, settle as settleTable, total, exposure,
    canHit, canDouble, canSplit, canSurrender, current, emptySeat, type BJ, type Action, type Rules,
  } from '../games/blackjack';
  import { advise } from '../games/strategy';
  import { newShoe } from '../lib/cards';
  import { Room } from '../lib/net.svelte';
  import { settings, wallet, settle, fmt } from '../lib/state.svelte';
  import { chipOf, short } from '../lib/chips';
  import { sfx } from '../lib/sfx';
  import { t, type Key } from '../lib/i18n';

  let st = $state<BJ>(newTable(PRESETS.vegas));
  let chip = $state(25);
  let botCount = $state(2);
  let hints = $state(true);
  let showRules = $state(false);
  let busy = false;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, matchMedia('(prefers-reduced-motion: reduce)').matches ? 60 : ms));

  const room = new Room('blackjack', onMsg, () => {
    push();
    pump();
  });
  const isHost = $derived(room.role !== 'guest');
  if (import.meta.env.DEV) (window as any).__bj = () => ({ st: $state.snapshot(st), busy, myId: room.myId });
  const betting = $derived(st.phase === 'bet' || st.phase === 'done');

  // ---------- networking ----------
  function push() {
    if (room.role !== 'host') return;
    untrack(() => {
      const s = $state.snapshot(st);
      room.broadcast({ t: 'state', s: { ...s, shoe: [], dealer: s.hole ? [s.dealer[0], { r: 0, s: 0 }] : s.dealer } });
    });
  }

  function onMsg(m: any, from: string) {
    if (m.t === 'state') {
      if (room.role === 'guest') st = m.s;
      return;
    }
    if (room.role === 'guest') return;
    const seat = st.seats[m.seat];
    const mine = seat && seat.owner === from;
    if (m.t === 'sit' && seat && !seat.owner && betting) Object.assign(seat, emptySeat(), { owner: from, name: String(m.name).slice(0, 24) });
    else if (m.t === 'leave' && mine && betting) Object.assign(seat, emptySeat());
    else if (m.t === 'bet' && mine && betting) seat.bet = Math.max(0, +m.amt || 0);
    else if (m.t === 'ins' && mine) insure(st, m.seat, !!m.take);
    else if (m.t === 'hi') {}
    else if (m.t === 'act' && st.turn && st.seats[st.turn[0]].owner === from) {
      if (act(st, m.a)) sfx('card');
    } else return;
    push();
    pump();
  }

  // ---------- seats ----------
  let prevId = 'me';
  let wasGuest = false;
  $effect(() => {
    const id = room.myId, role = room.role;
    untrack(() => {
      if (role === 'guest') return void ((prevId = id), (wasGuest = true));
      if (wasGuest) {
        // the table we saw belonged to the old host: start fresh
        wasGuest = false;
        st = newTable(st.rules);
        Object.assign(st.seats[2], { owner: id, name: settings.name });
      }
      for (const s of st.seats) if (s.owner === prevId) s.owner = id;
      prevId = id;
      push();
      pump();
    });
  });
  $effect(() => {
    if (room.role === 'guest' && room.status === 'open') room.send({ t: 'hi' });
  });
  onMount(() => {
    Object.assign(st.seats[2], { owner: room.myId, name: settings.name });
  });
  onDestroy(() => room.leave());

  const BOTS = ['Mila', 'Jonas', 'Lea', 'Finn'];
  $effect(() => {
    const want = settings.bots ? botCount : 0;
    if (!isHost || !betting) return;
    untrack(() => {
      let have = st.seats.filter((s) => s.bot);
      for (const s of have.slice(want)) Object.assign(s, emptySeat());
      for (const i of [4, 0, 3, 1, 2]) {
        if (st.seats.filter((s) => s.bot).length >= want) break;
        const s = st.seats[i];
        if (!s.owner) Object.assign(s, emptySeat(), { owner: 'bot', bot: true, name: BOTS.find((n) => !st.seats.some((x) => x.name === n))! });
      }
      push();
    });
  });
  $effect(() => {
    const n = settings.name;
    untrack(() => { for (const s of st.seats) if (s.owner === room.myId) s.name = n; push(); });
  });

  const myExposure = $derived(exposure(st, room.myId));
  const free = $derived(wallet.balance - myExposure);

  const sit = (i: number) => room.send({ t: 'sit', seat: i, name: settings.name });
  const leaveSeat = (i: number) => room.send({ t: 'leave', seat: i });
  function addBet(i: number) {
    if (!betting || st.seats[i].owner !== room.myId) return;
    if (chip > free) return;
    room.send({ t: 'bet', seat: i, amt: st.seats[i].bet + chip });
    sfx('chip');
  }
  function clearBets() {
    st.seats.forEach((s, i) => s.owner === room.myId && s.bet && room.send({ t: 'bet', seat: i, amt: 0 }));
  }
  // never leave standing bets you can no longer cover
  $effect(() => {
    if (betting && free < 0) untrack(clearBets);
  });

  // ---------- round flow (host) ----------
  async function deal() {
    if (!isHost || !betting || busy) return;
    for (const s of st.seats) {
      if (s.bot) s.bet = [10, 25, 25, 50, 100][Math.floor(Math.random() * 5)];
      if (gone(s)) Object.assign(s, emptySeat());
    }
    const fresh = st.round === 0 || st.shoe.length < st.rules.decks * 52 * 0.25;
    if (!start(st)) return;
    busy = true;
    try {
      push();
      if (fresh) { sfx('shuffle'); await sleep(900); }
      for (const op of dealOrder(st)) {
        op();
        push();
        sfx('card');
        await sleep(280);
      }
      afterDeal(st);
      push();
    } finally {
      busy = false;
    }
    pump();
  }

  // A human seat whose player is no longer connected (left the room, or a stale seat from an old room).
  const gone = (s: { owner: string | null; bot: boolean }) => !!s.owner && !s.bot && !room.has(s.owner);

  /** Decide for absent players so the table never waits on someone who isn't there. */
  function autoStandGone() {
    while (st.phase === 'play' && st.turn && gone(st.seats[st.turn[0]])) act(st, 'stand');
    if (st.phase === 'insurance') st.seats.forEach((s, i) => gone(s) && s.ins === null && insure(st, i, false));
  }

  // Remote players get 30 s per decision, then they stand / decline insurance.
  $effect(() => {
    if (room.role !== 'host') return;
    const key = st.phase + JSON.stringify(st.turn) + st.seats.map((s) => s.ins).join();
    const waiting =
      (st.phase === 'play' && st.turn && st.seats[st.turn[0]].owner !== room.myId && !st.seats[st.turn[0]].bot) ||
      (st.phase === 'insurance' && st.seats.some((s) => s.ins === null && s.owner !== room.myId));
    if (!waiting) return;
    const id = setTimeout(() => {
      if (st.phase + JSON.stringify(st.turn) + st.seats.map((s) => s.ins).join() !== key) return;
      if (st.phase === 'play') act(st, 'stand');
      else st.seats.forEach((s, i) => s.ins === null && s.owner !== room.myId && insure(st, i, false));
      push();
      pump();
    }, 30_000);
    return () => clearTimeout(id);
  });

  async function pump() {
    if (!isHost || busy) return;
    busy = true;
    try {
      for (;;) {
        autoStandGone();
        if (st.phase === 'play' && st.turn) {
          const s = st.seats[st.turn[0]];
          if (!s.bot) break;
          await sleep(750);
          const h = current(st)!;
          act(st, advise(h.cards, st.dealer[0], st.rules, { double: canDouble(st, s, h), split: canSplit(st, s, h), surrender: canSurrender(st, s, h) }));
          sfx('card');
          push();
        } else if (st.phase === 'dealer') {
          await sleep(500);
          if (st.hole) st.hole = false;
          else if (dealerNeedsCard(st)) st.dealer.push(draw(st));
          else settleTable(st);
          sfx('card');
          push();
        } else break;
      }
    } finally {
      busy = false;
    }
    if (st.phase === 'done') {
      for (const s of st.seats) if (gone(s)) Object.assign(s, emptySeat());
      push();
    }
  }

  // every client books its own seats when a round finishes
  let booked = 0;
  $effect(() => {
    if (st.phase !== 'done' || st.round === booked) return;
    booked = st.round;
    untrack(() => {
      const seats = st.seats.filter((s) => s.owner === room.myId && s.hands.length);
      if (!seats.length) return;
      const net = seats.reduce((a, s) => a + s.net, 0);
      const back = seats.reduce((a, s) => a + s.hands.reduce((x, h) => x + (h.payout ?? 0), 0), 0);
      settle(net, back);
      sfx(seats.some((s) => s.hands.some((h) => h.result === 'bj')) ? 'big' : net > 0 ? 'win' : net < 0 ? 'lose' : 'stop');
    });
  });

  // ---------- player actions ----------
  const turnSeat = $derived(st.turn ? st.seats[st.turn[0]] : null);
  const myTurn = $derived(st.phase === 'play' && turnSeat?.owner === room.myId);
  const hand = $derived(myTurn ? current(st) : undefined);
  const extra = $derived(hand?.bet ?? 0);
  const allowed = $derived({
    hit: !!hand && canHit(hand),
    stand: !!hand,
    double: !!hand && canDouble(st, turnSeat!, hand) && free >= extra,
    split: !!hand && canSplit(st, turnSeat!, hand) && free >= extra,
    surrender: !!hand && canSurrender(st, turnSeat!, hand),
  });
  const tip = $derived(hand && hints ? advise(hand.cards, st.dealer[0], st.rules, allowed) : null);
  const doAct = (a: Action) => allowed[a] && room.send({ t: 'act', a });

  function key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    const map: Record<string, Action> = { h: 'hit', s: 'stand', d: 'double', p: 'split', r: 'surrender' };
    if (myTurn && map[e.key]) doAct(map[e.key]);
    else if ((e.code === 'Space' || e.key === 'Enter') && betting && isHost) { e.preventDefault(); deal(); }
  }

  // ---------- rules ----------
  const presetName = $derived(Object.entries(PRESETS).find(([, r]) => JSON.stringify(r) === JSON.stringify(st.rules))?.[0] ?? 'custom');
  function setRules(r: Partial<Rules>) {
    if (!isHost || !betting) return;
    const decks = st.rules.decks;
    Object.assign(st.rules, r);
    if (st.rules.decks !== decks) { st.shoe = newShoe(st.rules.decks); sfx('shuffle'); }
    push();
  }
  const ratio = (x: number) => (x === 1.5 ? '3:2' : x === 1.2 ? '6:5' : '1:1');
  const label = (cards: { r: number }[]) => {
    const { t: v, soft } = total(cards as any);
    return soft && v < 21 && cards.length ? `${v - 10}/${v}` : String(v);
  };
  const dealerCards = $derived(st.hole && room.role !== 'guest' ? [st.dealer[0], { r: 0, s: 0 }] : st.dealer);
  const anyBet = $derived(st.seats.some((s) => s.owner && s.bet > 0));
  const insuranceSeats = $derived(st.phase === 'insurance' ? st.seats.map((s, i) => [s, i] as const).filter(([s]) => s.owner === room.myId && s.ins === null) : []);
</script>

<svelte:window onkeydown={key} />

<section class="wrap page">
  <header class="head">
    <div>
      <p class="eyebrow">{presetName === 'custom' ? t('bj.custom') : t(('preset.' + presetName) as Key)} · {st.rules.decks} {t('bj.decks')}</p>
      <h1>Blackjack</h1>
    </div>
    <RoomBar {room}>
      {#snippet extra()}
        {#if isHost}
          <label class="switch mini"><span>{t('bots')}</span><input type="checkbox" bind:checked={settings.bots} /></label>
          {#if settings.bots}
            <div class="seg" role="group" aria-label={t('bots')}>
              {#each [1, 2, 3, 4] as n}<button class:on={botCount === n} onclick={() => (botCount = n)}>{n}</button>{/each}
            </div>
          {/if}
        {/if}
        <label class="switch mini"><span>{t('bj.hints')}</span><input type="checkbox" bind:checked={hints} /></label>
        <button class="btn sm" onclick={() => (showRules = !showRules)} aria-expanded={showRules}>{t('bj.rules')}</button>
      {/snippet}
    </RoomBar>
  </header>

  {#if showRules}
    <div class="rules panel" transition:fly={{ y: -8, duration: 250 }}>
      <fieldset disabled={!isHost || !betting}>
        <label class="field">{t('bj.preset')}
          <select value={presetName} onchange={(e) => { const v = e.currentTarget.value; if (PRESETS[v]) setRules({ ...PRESETS[v] }); }}>
            {#each Object.keys(PRESETS) as p}<option value={p}>{t(('preset.' + p) as Key)}</option>{/each}
            <option value="custom" disabled>{t('bj.custom')}</option>
          </select>
        </label>
        <label class="field">{t('bj.decks')}
          <select value={st.rules.decks} onchange={(e) => setRules({ decks: +e.currentTarget.value })}>
            {#each [1, 2, 4, 6, 8] as d}<option value={d}>{d}</option>{/each}
          </select>
        </label>
        <label class="field">{t('bj.pays')}
          <select value={st.rules.bjPays} onchange={(e) => setRules({ bjPays: +e.currentTarget.value })}>
            {#each [1.5, 1.2, 1] as x}<option value={x}>{ratio(x)}</option>{/each}
          </select>
        </label>
        <label class="field">{t('bj.doubleOn')}
          <select value={st.rules.double} onchange={(e) => setRules({ double: e.currentTarget.value as Rules['double'] })}>
            <option value="any">{t('bj.any')}</option><option value="9-11">9–11</option><option value="10-11">10–11</option>
          </select>
        </label>
        <label class="field">{t('bj.maxSplits')}
          <select value={st.rules.maxSplits} onchange={(e) => setRules({ maxSplits: +e.currentTarget.value })}>
            {#each [0, 1, 2, 3] as d}<option value={d}>{d}</option>{/each}
          </select>
        </label>
        {#each [['h17', 'bj.h17'], ['das', 'bj.das'], ['rsa', 'bj.rsa'], ['surrender', 'bj.surrenderRule'], ['insurance', 'bj.insuranceRule'], ['peek', 'bj.peek']] as [k, l]}
          <label class="switch"><span>{t(l as Key)}</span><input type="checkbox" checked={(st.rules as any)[k]} onchange={(e) => setRules({ [k]: e.currentTarget.checked })} /></label>
        {/each}
      </fieldset>
      {#if !betting}<p class="muted small">{t('bj.locked')}</p>{/if}
    </div>
  {/if}

  <div class="felt">

    <div class="dealer">
      <span class="eyebrow light">{t('bj.dealer')}</span>
      <div class="cards">
        {#each dealerCards as c, i (i)}
          <div class="slot" in:fly={{ y: -120, x: 80, duration: 380, easing: cubicOut }}><CardView card={c} /></div>
        {/each}
      </div>
      {#if st.dealer.length}<span class="total" class:bust={total(dealerCards).t > 21}>{label(dealerCards)}</span>{/if}
    </div>

    <svg class="arc" viewBox="0 0 800 120" aria-hidden="true">
      <path id="arcp" d="M60 20 Q400 150 740 20" fill="none" />
      <text><textPath href="#arcp" startOffset="50%">BLACKJACK PAYS {ratio(st.rules.bjPays)} · DEALER {st.rules.h17 ? 'HITS' : 'STANDS ON'} SOFT 17{st.rules.insurance ? ' · INSURANCE PAYS 2:1' : ''}</textPath></text>
    </svg>

    <div class="status">
      {#if st.phase === 'insurance' && insuranceSeats.length}
        <div class="prompt" in:scale>
          <strong>{t('bj.insurance')}</strong>
          {#each insuranceSeats as [s, i]}
            <button class="btn sm primary" disabled={free < s.hands[0].bet / 2} onclick={() => room.send({ t: 'ins', seat: i, take: true })}>{t('bj.yes')} ({short(s.hands[0].bet / 2)})</button>
            <button class="btn sm" onclick={() => room.send({ t: 'ins', seat: i, take: false })}>{t('bj.no')}</button>
          {/each}
        </div>
      {:else if myTurn}
        <span class="pill accent">{t('bj.yourTurn')}</span>
      {:else if st.phase === 'play' && turnSeat}
        <span class="pill">{t('bj.waiting')} {turnSeat.name}</span>
      {:else if betting && !anyBet}
        <span class="pill">{t('bj.placeBets')}</span>
      {/if}
    </div>

    <div class="seats">
      {#each st.seats as s, i}
        {@const own = s.owner === room.myId}
        <div class="seat" class:own class:active={st.turn?.[0] === i} style="--y:{[0, 22, 34, 22, 0][i]}px">
          <div class="hands">
            {#each s.hands as h, j}
              <div class="hand" class:on={st.turn?.[0] === i && st.turn?.[1] === j}>
                <div class="cards fan">
                  {#each h.cards as c, k (k)}
                    <div class="slot" in:fly={{ y: -260, x: (2 - i) * 60, duration: 420, easing: cubicOut }}><CardView card={c} small={s.hands.length > 1} /></div>
                  {/each}
                </div>
                <div class="meta">
                  <span class="total" class:bust={total(h.cards).t > 21}>{label(h.cards)}</span>
                  {#if h.result}<span class="res {h.result}" in:scale>{t(('bj.res.' + h.result) as Key)}</span>{/if}
                  {#if s.hands.length > 1 || h.doubled}<span class="mono hb">{short(h.bet)}</span>{/if}
                </div>
              </div>
            {/each}
          </div>
          {#if s.owner}
            <button class="spot" class:has={s.bet > 0} disabled={!own || !betting} onclick={() => addBet(i)} aria-label="Bet seat {i + 1}">
              {#if s.bet > 0}
                {#key s.bet}<span class="chip" data-v={chipOf(s.bet)} in:scale={{ start: 1.4, duration: 220 }}>{short(s.bet)}</span>{/key}
              {/if}
              {#if s.ins}<span class="ins mono">+{short(s.ins)}</span>{/if}
            </button>
            <div class="name">
              <span class:bot={s.bot}>{s.name}</span>
              {#if st.phase === 'done' && s.hands.length}<span class="mono net" class:pos={s.net > 0} class:neg={s.net < 0}>{s.net > 0 ? '+' : ''}{short(s.net)}</span>{/if}
              {#if own && betting}<button class="x" onclick={() => leaveSeat(i)} aria-label={t('bj.leaveSeat')}>×</button>{/if}
            </div>
          {:else}
            <button class="spot empty" disabled={!betting} onclick={() => sit(i)}>{t('bj.sit')}</button>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <div class="dock panel">
    {#if myTurn}
      <div class="acts" in:fly={{ y: 12, duration: 250 }}>
        {#each [['hit', 'bj.hit', 'H'], ['stand', 'bj.stand', 'S'], ['double', 'bj.double', 'D'], ['split', 'bj.split', 'P'], ['surrender', 'bj.surrender', 'R']] as [a, l, k]}
          {#if a !== 'surrender' || st.rules.surrender}
            <button class="btn act" class:tip={tip === a} disabled={!allowed[a as Action]} onclick={() => doAct(a as Action)}>
              {t(l as Key)} <kbd>{k}</kbd>
            </button>
          {/if}
        {/each}
      </div>
    {:else}
      <ChipTray bind:value={chip} max={Math.max(0, free)} />
      <div class="actions">
        <button class="btn sm ghost" onclick={clearBets} disabled={!betting || !myExposure}>{t('bet.clear')}</button>
      </div>
      <div class="totalbox">
        <span class="eyebrow">{t('bet.total')}</span>
        <strong class="mono">{fmt(myExposure)}</strong>
      </div>
      {#if isHost}
        <button class="btn primary deal" onclick={deal} disabled={!betting || !anyBet}>{t('bj.deal')}</button>
      {:else}
        <span class="btn ghost deal waiting">{betting ? t('bj.waitHost') : '…'}</span>
      {/if}
    {/if}
  </div>
</section>

<style>
  .page { padding-bottom: 120px; }
  .head { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 12px; padding: 28px 0 8px; }
  h1 { margin: 6px 0 0; font-size: clamp(2.2rem, 5vw, 3.6rem); letter-spacing: -0.04em; line-height: 0.95; font-weight: 700; }
  .switch.mini { min-height: 36px; font-size: 0.8rem; color: var(--muted); gap: 8px; }
  .seg { display: flex; border: 1px solid var(--line-2); border-radius: 999px; overflow: hidden; }
  .seg button { border: 0; background: none; width: 32px; height: 32px; font-size: 0.8rem; }
  .seg button.on { background: var(--text); color: var(--bg); }
  .rules { padding: 18px; margin: 8px 0 16px; }
  .rules fieldset { border: 0; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px 24px; align-items: end; }
  .rules fieldset:disabled { opacity: 0.6; }
  .rules .switch { font-size: 0.85rem; }
  .muted { color: var(--muted); } .small { font-size: 0.8rem; margin: 10px 0 0; }

  .felt {
    position: relative; margin-top: 8px; border-radius: 40px 40px 50% 50% / 40px 40px 140px 140px; padding: 24px clamp(10px, 2vw, 28px) 64px;
    background: radial-gradient(ellipse at 50% 10%, var(--felt), var(--felt-2) 75%);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.06), inset 0 0 0 10px rgba(0,0,0,.12), inset 0 40px 100px rgba(0,0,0,.25);
    min-height: 520px; overflow: hidden;
  }
  .arc { display: block; width: min(620px, 80%); margin: 0 auto -6px; pointer-events: none; }
  .arc text { font: 600 13px 'Geist Mono Variable', monospace; letter-spacing: 0.18em; fill: rgba(255,255,255,.32); text-anchor: middle; }
  .dealer { display: grid; justify-items: center; gap: 10px; min-height: 160px; position: relative; z-index: 1; }
  .eyebrow.light { color: rgba(255,255,255,.5); }
  .cards { display: flex; gap: 8px; min-height: 90px; }
  .cards.fan { gap: 0; }
  .cards.fan .slot + .slot { margin-left: calc(var(--cw, 64px) * -0.55); }
  .total { font: 700 0.8rem 'Geist Mono Variable', monospace; background: rgba(0,0,0,.45); color: #fff; padding: 4px 10px; border-radius: 999px; }
  .total.bust { background: var(--accent); }
  .status { min-height: 56px; display: grid; place-items: center; position: relative; z-index: 1; }
  .pill { font-size: 0.8rem; padding: 6px 14px; border-radius: 999px; background: rgba(0,0,0,.35); color: rgba(255,255,255,.85); }
  .pill.accent { background: var(--accent); color: var(--accent-ink); }
  .prompt { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: center; color: #fff; background: rgba(0,0,0,.4); padding: 8px 12px; border-radius: 999px; }

  .seats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; align-items: start; position: relative; z-index: 1; }
  .seat { display: grid; justify-items: center; gap: 10px; transform: translateY(var(--y)); min-width: 0; }
  .hands { display: flex; gap: 6px; min-height: 120px; align-items: end; }
  .hand { display: grid; justify-items: center; gap: 6px; padding: 6px; border-radius: 14px; transition: background 0.3s; }
  .hand.on { background: rgba(255,255,255,.12); box-shadow: 0 0 0 1px rgba(255,255,255,.3); }
  .meta { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; justify-content: center; }
  .res { font: 600 0.68rem 'Geist Mono Variable', monospace; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 999px; background: rgba(0,0,0,.4); color: #fff; }
  .res.win, .res.bj { background: #2fbf71; color: #062a16; }
  .res.lose, .res.bust { background: rgba(0,0,0,.55); color: rgba(255,255,255,.6); }
  .hb { font-size: 0.7rem; color: rgba(255,255,255,.7); }
  .spot {
    width: 64px; height: 64px; border-radius: 50%; border: 2px solid var(--felt-line); background: rgba(0,0,0,.12); display: grid; place-items: center; position: relative;
    color: rgba(255,255,255,.7); font-size: 0.7rem; transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s;
  }
  .seat.own .spot:not(:disabled) { border-color: var(--gold); cursor: pointer; }
  .seat.own .spot:not(:disabled):hover { transform: scale(1.06); }
  .spot.empty { border-style: dashed; text-transform: uppercase; letter-spacing: 0.06em; }
  .spot.empty:not(:disabled):hover { border-color: #fff; color: #fff; }
  .spot .chip { --size: 46px; }
  .ins { position: absolute; right: -14px; top: -6px; font-size: 0.65rem; background: var(--gold); color: #1d1505; border-radius: 999px; padding: 2px 6px; }
  .name { display: flex; gap: 6px; align-items: center; font-size: 0.8rem; color: #fff; max-width: 100%; }
  .name span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .name .bot { color: rgba(255,255,255,.6); }
  .seat.own .name span:first-child { font-weight: 600; }
  .net.pos { color: #6ff0a6; } .net.neg { color: #ff9a9d; }
  .x { border: 0; background: rgba(0,0,0,.3); color: #fff; width: 22px; height: 22px; border-radius: 50%; line-height: 1; }

  .dock {
    position: sticky; bottom: 12px; z-index: 20; margin-top: 20px; padding: 12px 16px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 20px;
    background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: blur(14px); border-radius: 24px; box-shadow: 0 20px 50px -20px rgba(0,0,0,.5); min-height: 76px;
  }
  .acts { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; width: 100%; }
  .act { min-width: 110px; min-height: 52px; font-size: 0.95rem; }
  .act.tip { border-color: var(--gold); box-shadow: 0 0 0 3px color-mix(in srgb, var(--gold) 35%, transparent); }
  kbd { font: 500 0.7rem 'Geist Mono Variable', monospace; opacity: 0.5; border: 1px solid var(--line-2); border-radius: 4px; padding: 0 4px; }
  .totalbox { display: grid; gap: 4px; min-width: 80px; }
  .totalbox strong { font-size: 1.25rem; }
  .deal { min-width: 140px; min-height: 52px; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.08em; }
  .waiting { cursor: default; color: var(--muted); }

  @media (max-width: 820px) {
    .felt { border-radius: 28px; padding-bottom: 24px; }
    .arc { display: none; }
    .seats { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 8px; }
    .seat { transform: none; flex: 0 0 46%; scroll-snap-align: center; }
    .cards.fan { --cw: 52px; }
    .act { min-width: 0; flex: 1 1 28%; }
    .dock :global(.tray) { flex-wrap: nowrap; overflow-x: auto; width: 100%; justify-content: flex-start; padding: 8px 4px 4px; }
    .dock :global(.tray .chip) { --size: 38px; }
    .dock { gap: 8px; padding: 10px; }
    .deal { flex: 1; min-width: 0; min-height: 46px; }
    .felt { min-height: 0; }
  }
</style>
