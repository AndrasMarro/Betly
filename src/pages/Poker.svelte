<script lang="ts">
  import { onDestroy, onMount, untrack } from 'svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut, cubicIn } from 'svelte/easing';
  import CardView from '../components/Card.svelte';
  import HowTo from '../components/HowTo.svelte';
  import HandRanks from '../components/HandRanks.svelte';
  import FlipCard from '../components/FlipCard.svelte';
  import RoomBar from '../components/RoomBar.svelte';
  import {
    newTable, emptySeat, startHand, act, legal, roundDone, nextStreet, botMove, bestHand, equity, potTotal, live, topRanks,
    SEATS, type Table, type Move,
  } from '../games/poker';
  import { Room } from '../lib/net.svelte';
  import { settings, wallet, stake, credit, fmt } from '../lib/state.svelte';
  import { chipOf, short } from '../lib/chips';
  import { sfx } from '../lib/sfx';
  import { drop, pop } from '../lib/motion';
  import { t, type Key } from '../lib/i18n';

  const BLINDS: [number, number][] = [[5, 10], [25, 50], [100, 200]];
  const BOTS = ['Mila', 'Jonas', 'Lea', 'Finn', 'Ava', 'Noah', 'Emma', 'Luca'];
  let T = $state<Table>(newTable());
  let view = $state<Table>(newTable());
  let botCount = $state(4);
  let help = $state(true);
  let alive = true;
  let busy = false;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, matchMedia('(prefers-reduced-motion: reduce)').matches ? Math.min(ms, 250) : ms));

  // ---------- networking: the host runs the table, everyone else sees a masked copy ----------
  const room = new Room('poker', onMsg, (id) => { standUp(id); sync(); pump(); });
  const isHost = $derived(room.role !== 'guest');

  function mask(t: Table, viewer: string): Table {
    const c: Table = structuredClone(t);
    c.deck = [];
    for (const s of c.seats) if (s.id !== viewer && !s.show) s.cards = s.cards.map(() => ({ r: 0, s: 0 }));
    return c;
  }
  function sync() {
    if (room.role === 'guest') return;
    untrack(() => {
      const snap = $state.snapshot(T) as Table;
      view = mask(snap, room.myId);
      for (const id of room.peers()) room.sendTo(id, { t: 'state', s: mask(snap, id) });
    });
  }

  function onMsg(m: any, from: string) {
    if (m.t === 'state') {
      if (room.role === 'guest') view = m.s;
      return;
    }
    if (room.role === 'guest') return;
    if (m.t === 'sit') sit(from, String(m.name).slice(0, 20), Math.max(0, +m.buyIn || 0), m.seat);
    else if (m.t === 'leave') standUp(from);
    else if (m.t === 'act') {
      const i = T.seats.findIndex((s) => s.id === from);
      if (i >= 0 && i === T.turn) act(T, i, m.move as Move);
    } else if (m.t !== 'hi') return;
    sync();
    pump();
  }
  $effect(() => { if (room.role === 'guest' && room.status === 'open') room.send({ t: 'hi' }); });

  // ---------- seats & money ----------
  function sit(id: string, name: string, buyIn: number, want?: number) {
    if (T.seats.some((s) => s.id === id) || buyIn <= 0) return;
    let i = want !== undefined && T.seats[want] && !T.seats[want].id ? want : T.seats.findIndex((s) => !s.id);
    if (i < 0) { i = T.seats.findIndex((s) => s.bot && !s.inHand); if (i >= 0) T.seats[i] = emptySeat(); }
    if (i < 0) return;
    Object.assign(T.seats[i], emptySeat(), { id, name, stack: buyIn });
  }
  function standUp(id: string) {
    const i = T.seats.findIndex((s) => s.id === id);
    if (i < 0) return;
    const s = T.seats[i];
    if (s.inHand && T.street !== 'idle' && T.street !== 'showdown') {
      if (!s.folded) {
        if (T.turn === i) act(T, i, { type: 'fold' });
        else { s.folded = true; s.last = 'fold'; if (roundDone(T)) T.turn = -1; }
      }
      // chips already in the pot stay there; the seat is cleared after the hand
      Object.assign(s, { stack: 0, id: 'left-' + i, leaving: true });
      return;
    }
    T.seats[i] = { ...emptySeat() };
  }
  function fillBots() {
    const want = settings.bots ? botCount : 0;
    for (const s of T.seats) if (s.leaving) Object.assign(s, emptySeat());
    for (const s of T.seats) if (s.bot && s.stack === 0) Object.assign(s, emptySeat());
    let bots = T.seats.filter((s) => s.bot);
    for (const s of bots.slice(want)) if (!s.inHand || T.street === 'idle' || T.street === 'showdown') Object.assign(s, emptySeat());
    bots = T.seats.filter((s) => s.bot);
    for (let k = 0; k < SEATS && bots.length < want; k++) {
      const s = T.seats[k];
      if (s.id) continue;
      const name = BOTS.find((n) => !T.seats.some((x) => x.name === n))!;
      Object.assign(s, emptySeat(), { id: 'bot-' + name, name, bot: true, style: BOTS.indexOf(name) % 5, stack: T.bb * 100 });
      bots.push(s);
    }
  }

  // ---------- table loop (host / solo) ----------
  async function pump() {
    if (room.role === 'guest' || busy) return;
    busy = true;
    try {
      while (alive) {
        if (T.street === 'idle' || T.street === 'showdown') {
          fillBots();
          sync();
          const humans = T.seats.filter((s) => s.id && !s.bot && s.stack > 0);
          const ready = T.seats.filter((s) => s.id && s.stack > 0);
          if (!humans.length || ready.length < 2) break;
          await sleep(T.street === 'showdown' ? 4200 : 900);
          if (!alive || T.seats.filter((s) => s.id && s.stack > 0).length < 2) break;
          fillBots();
          if (!startHand(T)) break;
          sync();
          await sleep(900);
          continue;
        }
        if (T.turn >= 0) {
          const s = T.seats[T.turn];
          if (!s.bot) break; // wait for a human
          await sleep(650 + Math.random() * 900);
          if (!alive) return;
          act(T, T.turn, botMove(T, T.turn));
          sync();
          continue;
        }
        await sleep(700);
        nextStreet(T);
        sync();
        await sleep((T.street as string) === 'showdown' ? 0 : 450);
      }
    } finally {
      busy = false;
    }
  }

  // remote players (and the host in a room) get 30 s per decision
  let deadline = $state(0);
  $effect(() => {
    const turn = view.turn, hand = view.hand, street = view.street;
    void street;
    deadline = 0;
    if (turn < 0) return;
    const s = view.seats[turn];
    if (!s || s.bot || room.role === 'solo') return;
    deadline = Date.now() + 30_000;
    if (room.role !== 'host') return;
    const id = setTimeout(() => {
      if (T.turn !== turn || T.hand !== hand) return;
      act(T, turn, legal(T, turn).check ? { type: 'check' } : { type: 'fold' });
      sync();
      pump();
    }, 30_000);
    return () => clearTimeout(id);
  });

  // ---------- my seat ----------
  const myIndex = $derived(view.seats.findIndex((s) => s.id === room.myId));
  const mine = $derived(myIndex >= 0 ? view.seats[myIndex] : null);
  let buyIn = $state(1000);
  let pendingBuyIn = 0;
  let lastStack = 0;
  $effect(() => { if (mine) { lastStack = mine.stack; if (pendingBuyIn) pendingBuyIn = 0; } });

  function takeSeat(seat?: number) {
    const amount = Math.min(buyIn, Math.floor(wallet.balance));
    if (amount < view.bb * 10 || mine) return;
    stake(amount);
    lastStack = amount;
    if (room.role === 'guest') {
      pendingBuyIn = amount;
      room.send({ t: 'sit', name: settings.name, buyIn: amount, seat });
      setTimeout(() => { if (pendingBuyIn) { credit(pendingBuyIn); pendingBuyIn = 0; } }, 6000);
    } else {
      sit(room.myId, settings.name, amount, seat);
      sync();
      pump();
    }
    sfx('chip');
  }
  function leaveSeat() {
    if (!mine) return;
    const back = mine.stack;
    if (room.role === 'guest') room.send({ t: 'leave' });
    else { standUp(room.myId); sync(); pump(); }
    credit(back);
    lastStack = 0;
  }
  const canStand = $derived(!!mine && (view.street === 'idle' || view.street === 'showdown' || mine.folded || !mine.inHand));
  onMount(() => {
    buyIn = Math.max(T.bb * 20, Math.min(T.bb * 100, Math.floor(wallet.balance)));
    if (wallet.balance >= T.bb * 20) takeSeat(0);
  });
  onDestroy(() => {
    alive = false;
    if (mine && room.role !== 'guest') credit(T.seats.find((s) => s.id === room.myId)?.stack ?? 0);
    else if (room.role === 'guest' && lastStack) credit(lastStack);
    room.leave();
  });

  // keep my seat when my id changes (opening a room); a guest whose host vanished cashes out
  let prevId = 'me', wasGuest = false;
  $effect(() => {
    const id = room.myId, role = room.role;
    untrack(() => {
      if (role === 'guest') {
        if (!wasGuest) {
          // joining someone else's table: cash out the seat we had at our own solo table
          const solo = T.seats.find((s) => s.id === prevId || s.id === id);
          if (solo?.stack) credit(solo.stack);
          T = newTable();
          lastStack = 0;
        }
        prevId = id;
        wasGuest = true;
        return;
      }
      if (wasGuest) {
        wasGuest = false;
        if (lastStack) credit(lastStack);
        lastStack = 0;
        T = newTable();
        sync();
        return;
      }
      for (const s of T.seats) if (s.id === prevId) s.id = id;
      prevId = id;
      sync();
      pump();
    });
  });
  $effect(() => {
    const n = settings.name;
    untrack(() => { for (const s of T.seats) if (s.id === room.myId) s.name = n; sync(); });
  });
  $effect(() => {
    void settings.bots; void botCount;
    untrack(() => { if (T.street === 'idle' || T.street === 'showdown') { fillBots(); sync(); pump(); } });
  });

  function setBlinds([sb, bb]: [number, number]) {
    if (!isHost || (view.street !== 'idle' && view.street !== 'showdown')) return;
    T.sb = sb;
    T.bb = bb;
    T.minRaise = bb;
    for (const s of T.seats) if (s.bot) s.stack = Math.max(s.stack, bb * 100);
    buyIn = Math.max(bb * 20, Math.min(bb * 100, Math.floor(wallet.balance)));
    sync();
  }

  // ---------- my decisions ----------
  const myTurn = $derived(myIndex >= 0 && view.turn === myIndex);
  const L = $derived(myTurn ? legal(view, myIndex) : null);
  const pot = $derived(potTotal(view));
  let raiseTo = $state(0);
  $effect(() => { if (L) raiseTo = L.minTo; });
  const send = (move: Move) => {
    if (room.role === 'guest') room.send({ t: 'act', move });
    else if (act(T, myIndex, move)) { sync(); pump(); }
  };
  const preset = (f: number) => (raiseTo = Math.max(L!.minTo, Math.min(L!.maxTo, Math.round(view.currentBet + (pot + L!.call) * f))));
  function key(e: KeyboardEvent) {
    if (!myTurn || !L || (e.target as HTMLElement).closest('input, select, textarea')) return;
    if (e.key === 'f' && L.fold) send({ type: 'fold' });
    else if (e.key === 'c') send({ type: 'call' });
    else if (e.key === 'r' && L.canRaise) send({ type: 'raise', to: raiseTo });
  }

  // ---------- helper: my hand and win chance ----------
  const myHand = $derived(mine && mine.cards.length && mine.cards[0].r && view.board.length >= 3 ? bestHand([...mine.cards, ...view.board]) : null);
  const preflop = $derived.by(() => {
    const c = mine?.cards;
    if (!c?.length || !c[0].r || view.board.length >= 3) return '';
    const [a, b] = [...c].sort((x, y) => (y.r === 1 ? 14 : y.r) - (x.r === 1 ? 14 : x.r));
    const n = (r: number) => RANK[r === 1 ? 14 : r];
    return a.r === b.r ? `${t('pk.cat.pair')} · ${n(a.r)}${n(b.r)}` : `${n(a.r)}${n(b.r)} ${a.s === b.s ? t('pk.suited') : t('pk.offsuit')}`;
  });
  let win = $state<number | null>(null);
  $effect(() => {
    const cards = mine?.cards, board = view.board, opp = live(view).length - 1;
    if (!help || !cards?.length || !cards[0].r || mine?.folded || view.street === 'showdown' || opp < 1) return void (win = null);
    const id = setTimeout(() => (win = equity($state.snapshot(cards) as any, $state.snapshot(board) as any, opp, 500)), 30);
    return () => clearTimeout(id);
  });

  // ---------- sounds from table changes (works for host and guests) ----------
  let seenLog = 0, seenBoard = 0, seenHand = 0;
  $effect(() => {
    const hand = view.hand, log = view.log.length, board = view.board.length, street = view.street;
    untrack(() => {
      if (hand !== seenHand) { seenHand = hand; seenLog = 0; seenBoard = 0; sfx('shuffle'); }
      if (log > seenLog) {
        const line = view.log[log - 1] ?? '';
        sfx(/fold/.test(line) ? 'card' : /check/.test(line) ? 'tick' : 'chip');
        seenLog = log;
      }
      if (board > seenBoard) { seenBoard = board; sfx('card'); }
      if (street === 'showdown' && view.winners.some((w) => w.seat === myIndex)) sfx('win');
    });
  });

  // ---------- geometry ----------
  let wide = $state(true);
  let showOpts = $state(false);
  onMount(() => {
    const mq = matchMedia('(min-width: 760px)');
    wide = mq.matches;
    mq.onchange = (e) => (wide = e.matches);
  });
  // wide table: top seats hang from the top edge, the hero stands on the bottom edge, so nothing leaves the table
  const POS_WIDE = [[50, 99], [9, 57], [19, 1], [50, 1], [81, 1], [91, 57]];
  // chips sit a fixed distance from each seat's cards, so they never slide under them on short screens
  const HANG = 'calc(1cqh + 138px)';
  const BET_WIDE: [number, string][] = [[50, 'calc(99cqh - var(--hcw) * 1.4 - 74px)'], [24, '57cqh'], [29, HANG], [50, HANG], [71, HANG], [76, '57cqh']];
  const POS_TALL = [[50, 79], [13, 66], [13, 30], [50, 8], [87, 30], [87, 66]];
  const base = $derived(myIndex >= 0 ? myIndex : 0);
  const posOf = (i: number) => (wide ? POS_WIDE : POS_TALL)[(i - base + SEATS) % SEATS];
  const toward = (i: number, k: number) => { const [x, y] = posOf(i); return [x + (50 - x) * k, y + (46 - y) * k]; };
  const betPos = (i: number): [number, string] => { if (wide) return BET_WIDE[(i - base + SEATS) % SEATS]; const [x, y] = toward(i, 0.4); return [x, y + 'cqh']; };
  const btnPos = (i: number): [number, string] => { if (!wide) { const [x, y] = toward(i, 0.2); return [x, y + 'cqh']; } const [x, y] = betPos(i); return [x + (x <= 50 ? 7 : -7), y]; };
  let roomy = $state(true); // enough width for all table options in the header row
  onMount(() => { const mq = matchMedia('(min-width: 1500px)'); roomy = mq.matches; mq.onchange = (e) => (roomy = e.matches); });

  let potEl = $state<HTMLElement>();
  function toPot(node: Element) {
    const a = node.getBoundingClientRect(), b = potEl?.getBoundingClientRect();
    const dx = b ? b.x + b.width / 2 - (a.x + a.width / 2) : 0, dy = b ? b.y + b.height / 2 - (a.y + a.height / 2) : 0;
    return { duration: 420, easing: cubicIn, css: (_t: number, u: number) => `transform: translate(${u * dx}px, ${u * dy}px) scale(${1 - u * 0.2}); opacity:${1 - u * 0.4}` };
  }
  function fromCenter(node: Element, { delay = 0 } = {}) {
    const a = node.getBoundingClientRect(), parent = node.closest('.table')!.getBoundingClientRect();
    const dx = parent.x + parent.width / 2 - (a.x + a.width / 2), dy = parent.y + parent.height * 0.46 - (a.y + a.height / 2);
    return { delay, duration: 480, easing: cubicOut, css: (_t: number, u: number) => `transform: translate(${u * dx}px, ${u * dy}px) rotate(${u * 30}deg) scale(${1 - u * 0.3}); opacity:${Math.min(1, (1 - u) * 3)}` };
  }

  let showRanks = $state(false);
  const RANK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  function handName(score: number) {
    const k = topRanks(score), cat = bestCat(score);
    const r = (v: number) => RANK[v === 14 ? 1 : v];
    const detail = cat === 'twoPair' ? `${r(k[0])} & ${r(k[1])}` : cat === 'fullHouse' ? `${r(k[0])} / ${r(k[1])}` : cat === 'royal' ? '' : r(k[0]);
    return t(('pk.cat.' + cat) as Key) + (detail ? ' · ' + detail : '');
  }
  const bestCat = (score: number) => (['high', 'pair', 'twoPair', 'trips', 'straight', 'flush', 'fullHouse', 'quads', 'straightFlush', 'royal'] as const)[Math.floor(score / 15 ** 5)];
  const ckey = (c: { r: number; s: number }) => c.r * 4 + c.s;
  const winSet = $derived(new Set(view.street === 'showdown' ? (view.winners[0]?.cards ?? []).map(ckey) : []));
  const lastLabel = (l: string) => (l ? t(('pk.a.' + l) as Key) : '');
</script>

<svelte:window onkeydown={key} />

<section class="pk">
  <header class="head">
    <div class="ttl">
      <div class="h1row"><h1>Texas Hold'em</h1><HowTo id="holdem" label={false} /><button class="btn sm" class:on={showRanks} onclick={() => (showRanks = !showRanks)} aria-expanded={showRanks}>{t('pk.ranks')}</button></div>
      <span class="mono blinds">{view.sb}/{view.bb}</span>
    </div>
    <RoomBar {room}>
      {#snippet extra()}
        {#if !roomy}<button class="btn sm" class:on={showOpts} onclick={() => (showOpts = !showOpts)} aria-expanded={showOpts}>{t('room.options')}</button>{/if}
        {#if isHost && (roomy || showOpts)}
          <div class="seg" role="group" aria-label="Blinds">
            {#each BLINDS as b}<button class:on={view.bb === b[1]} disabled={view.street !== 'idle' && view.street !== 'showdown'} onclick={() => setBlinds(b)}>{b[0]}/{b[1]}</button>{/each}
          </div>
          <label class="switch mini"><span>{t('bots')}</span><input type="checkbox" bind:checked={settings.bots} /></label>
          {#if settings.bots}
            <div class="seg" role="group" aria-label={t('bots')}>{#each [1, 2, 3, 4, 5] as n}<button class:on={botCount === n} onclick={() => (botCount = n)}>{n}</button>{/each}</div>
          {/if}
        {/if}
        {#if roomy || showOpts}<label class="switch mini"><span>{t('pk.help')}</span><input type="checkbox" bind:checked={help} /></label>{/if}
      {/snippet}
    </RoomBar>
  </header>

  <div class="table" class:wide>
    <div class="felt"></div>

    <!-- pot and board -->
    <div class="center">
      <div class="pot" bind:this={potEl}>
        {#if pot}
          <span class="chip" data-v={chipOf(pot)} style="--size:26px"></span>
          <span class="mono">{t('pk.pot')} {fmt(pot)}</span>
        {/if}
      </div>
      <div class="board">
        {#each Array(5) as _, i}
          {@const c = view.board[i]}
          <div class="bslot" class:dim={winSet.size > 0 && c && !winSet.has(ckey(c))} class:hi={c && winSet.has(ckey(c))}>
            {#if c}{#key view.hand + '-' + i}<div in:fly={{ y: -30, duration: 350, easing: cubicOut }}><FlipCard card={c} delay={160 + (i < 3 ? i * 140 : 0)} /></div>{/key}{/if}
          </div>
        {/each}
      </div>
      {#if view.street === 'showdown' && view.winners.length}
        <div class="result" in:pop>
          {#each view.winners as w}
            <span><strong>{view.seats[w.seat]?.name}</strong> +{fmt(w.amount)}{#if w.score >= 0} · {handName(w.score)}{/if}</span>
          {/each}
        </div>
      {/if}
    </div>

    <!-- dealer button -->
    {#if view.button >= 0 && view.street !== 'idle'}
      {@const [bx, by] = btnPos(view.button)}
      <div class="dealer" style="transform: translate({bx}cqw, {by})">D</div>
    {/if}

    <!-- seats -->
    {#each view.seats as s, i}
      {@const [x, y] = posOf(i)}
      {@const [cx, cy] = betPos(i)}
      {#if s.id}
        <div class="seat" style="left:{x}%; top:{y}%" class:hang={wide && y < 10} class:stand={wide && y > 90} class:me={i === myIndex} class:turn={view.turn === i} class:folded={s.folded} class:out={!s.inHand && view.street !== 'idle'} class:winner={s.won > 0 && view.street === 'showdown'}>
          <div class="hole">
            {#each s.cards as c, k (view.hand + '-' + k)}
              <div class="hc" class:hi={winSet.has(ckey(c))} in:fromCenter={{ delay: (((i - view.button + SEATS) % SEATS) + k * SEATS) * 70 }}>
                <CardView card={c} small={!(i === myIndex) && !s.show} />
              </div>
            {/each}
          </div>
          <div class="plate">
            <span class="av" class:bot={s.bot} style={view.turn === i && deadline ? `--dl:${Math.max(0, deadline - Date.now())}ms` : ''}>{s.name.slice(0, 1)}</span>
            <span class="nm">{s.name}</span>
            <span class="mono st">{fmt(s.stack)}</span>
          </div>
          {#if s.last && view.street !== 'showdown'}{#key s.last + view.street}<span class="say s-{s.last}" in:pop>{lastLabel(s.last)}</span>{/key}{/if}
          {#if s.won > 0 && view.street === 'showdown'}<span class="won mono" in:pop={{ delay: 300 }}>+{fmt(s.won)}</span>{/if}
        </div>
        {#if s.bet > 0}
          <div class="bet" style="left:{cx}%; top:{cy}" in:drop out:toPot>
            <span class="chip" data-v={chipOf(s.bet)} style="--size:24px"></span><span class="mono">{short(s.bet)}</span>
          </div>
        {/if}
      {:else if !mine}
        <button class="empty" style="left:{x}%; top:{y}%" onclick={() => takeSeat(i)} disabled={wallet.balance < view.bb * 10}>{t('bj.sit')}</button>
      {/if}
    {/each}

    {#if view.log.length}
      <ol class="log" aria-label="Log">
        {#each view.log.slice(-4) as l, k (view.hand + '-' + (view.log.length - 4 + k))}<li in:fly={{ x: -10, duration: 250 }}>{l.replace(/: (\w+)/, (_, a) => ': ' + (lastLabel(a) || a))}</li>{/each}
      </ol>
    {/if}
  </div>

  <div class="dock panel">
    {#if myTurn && L}
      <div class="acts" in:fly={{ y: 12, duration: 250 }}>
        {#if L.fold}<button class="btn act fold" onclick={() => send({ type: 'fold' })}>{t('pk.fold')} <kbd>F</kbd></button>{/if}
        <button class="btn act" onclick={() => send({ type: 'call' })}>{L.check ? t('pk.check') : t('pk.call') + ' ' + fmt(L.call)} <kbd>C</kbd></button>
        {#if L.canRaise}
          <div class="raise">
            <div class="presets">
              <button class="btn sm ghost" onclick={() => (raiseTo = L.minTo)}>Min</button>
              <button class="btn sm ghost" onclick={() => preset(0.5)}>½</button>
              <button class="btn sm ghost" onclick={() => preset(0.75)}>¾</button>
              <button class="btn sm ghost" onclick={() => preset(1)}>Pot</button>
              <button class="btn sm ghost" onclick={() => (raiseTo = L.maxTo)}>All-in</button>
            </div>
            <input type="range" min={L.minTo} max={L.maxTo} step={Math.max(1, view.sb)} bind:value={raiseTo} aria-label={t('pk.raise')} />
          </div>
          <button class="btn primary act" onclick={() => send({ type: 'raise', to: raiseTo })}>
            {raiseTo >= L.maxTo ? 'All-in' : view.currentBet ? t('pk.raiseTo') : t('pk.bet')} {fmt(raiseTo)} <kbd>R</kbd>
          </button>
        {/if}
      </div>
    {:else}
      <div class="info">
        {#if mine}
          <span class="muted">{t('pk.stack')} <strong class="mono">{fmt(mine.stack)}</strong></span>
          {#if mine.stack === 0 && (view.street === 'idle' || view.street === 'showdown')}
            <button class="btn sm primary" onclick={() => { leaveSeat(); setTimeout(() => takeSeat(), 50); }} disabled={wallet.balance < view.bb * 10}>{t('pk.rebuy')}</button>
          {/if}
          <button class="btn sm ghost" disabled={!canStand} onclick={leaveSeat}>{t('pk.stand')}</button>
          {#if view.turn >= 0}<span class="muted">{t('bj.waiting')} {view.seats[view.turn]?.name}</span>{/if}
        {:else}
          <label class="field inline">{t('pk.buyin')}
            <input class="mono" type="number" min={view.bb * 10} step={view.bb} bind:value={buyIn} />
          </label>
          <button class="btn sm primary" onclick={() => takeSeat()} disabled={wallet.balance < view.bb * 10}>{t('bj.sit')}</button>
        {/if}
      </div>
    {/if}
    {#if help && mine && (myHand || preflop) && !mine.folded}
      <div class="helper">
        <span class="eyebrow">{t('pk.hand')}</span>
        <strong>{myHand ? handName(myHand.score) : preflop}</strong>
        {#if win !== null}<span class="mono eq">{t('pk.equity')} {(win * 100).toFixed(0)} %</span>{/if}
        {#if L && L.call}<span class="mono eq">{t('pk.odds')} {((L.call / (pot + L.call)) * 100).toFixed(0)} %</span>{/if}
      </div>
    {/if}
  </div>
  {#if showRanks}
    <aside class="ranks panel" transition:fly={{ x: 40, duration: 280 }}>
      <header><strong>{t('pk.ranks')}</strong><button class="btn icon sm ghost" onclick={() => (showRanks = false)} aria-label={t('close')}>×</button></header>
      <HandRanks active={myHand && mine && !mine.folded ? bestCat(myHand.score) : ''} />
    </aside>
  {/if}
</section>

<style>
  .h1row .btn.on { background: var(--text); color: var(--bg); }
  .ranks { position: fixed; z-index: 60; right: 16px; top: calc(var(--nav-h) + 12px); width: min(430px, calc(100% - 32px)); max-height: calc(100dvh - var(--nav-h) - 24px); overflow: auto; padding: 12px 10px 14px; box-shadow: 0 30px 80px -20px rgba(0,0,0,.6); }
  .ranks header { display: flex; justify-content: space-between; align-items: center; padding: 0 6px 6px; }
  .h1row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .h1row h1 { margin: 0; }
  .pk { width: min(1280px, 100% - 32px); margin-inline: auto; padding-bottom: 40px; }
  /* desktop: header, table and dock always share exactly one screen */
  @media (min-width: 760px) {
    .pk { width: min(1600px, 100%); padding: 0 20px 14px; height: calc(100dvh - var(--nav-h)); min-height: 620px; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 8px; }
    .pk .head { padding: 10px 0 0; }
    .pk .table.wide { height: auto; min-height: 0; }
    .pk .dock { position: relative; bottom: auto; margin: 0; width: min(1240px, 100%); justify-self: center; }
  }
  .head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 18px 0 10px; }
  .ttl { display: flex; align-items: baseline; gap: 12px; }
  h1 { margin: 0; font-size: clamp(1.6rem, 3.4vw, 2.4rem); letter-spacing: -0.04em; }
  .blinds { color: var(--muted); font-size: 0.9rem; }
  .seg { display: flex; border: 1px solid var(--line-2); border-radius: 999px; overflow: hidden; }
  .seg button { border: 0; background: none; min-width: 34px; height: 32px; padding: 0 10px; font-size: 0.78rem; transition: background-color 0.25s var(--ease-snap), color 0.25s var(--ease-snap); }
  .seg button.on { background: var(--text); color: var(--bg); }
  .seg button:disabled:not(.on) { opacity: 0.4; }
  .switch.mini { min-height: 34px; font-size: 0.8rem; color: var(--muted); gap: 8px; }

  .table { position: relative; container-type: size; height: clamp(520px, calc(100dvh - var(--nav-h) - 230px), 760px); --cw: clamp(46px, min(5cqw, 8.5cqh), 86px); }
  .table.wide .center { top: 49%; }
  .table.wide { --hcw: clamp(56px, min(6.2cqw, 12cqh), 100px); }
  .table.wide .seat.me .hole { --cw: var(--hcw); }
  /* actions of top seats and the hero show beside the name plate instead of over the chips */
  .seat.hang .say, .seat.stand .say { top: auto; bottom: 12px; left: calc(100% + 6px); }
  /* phones: the table, hero seat and action dock fit one screen */
  .table:not(.wide) { height: clamp(340px, calc(100dvh - var(--nav-h) - 300px), 128vw); min-height: 0; margin-top: 28px; --cw: 40px; }
  .table:not(.wide) .seat.me .hole { --cw: 54px; }
  .felt {
    position: absolute; inset: 9% 4% 12%; border-radius: 999px;
    background: radial-gradient(ellipse at 50% 35%, #1a6b4c, #0b3626 70%); box-shadow: 0 0 0 14px #3a2416, 0 0 0 16px #5a3a22, inset 0 0 80px rgba(0,0,0,.5), 0 40px 80px -30px rgba(0,0,0,.7);
  }
  .table:not(.wide) .felt { inset: 7% 6% 9%; border-radius: 46% / 30%; }
  .center { position: absolute; left: 50%; top: 46%; translate: -50% -50%; display: grid; justify-items: center; gap: 10px; width: 80%; }
  .pot { display: flex; align-items: center; gap: 8px; min-height: 30px; padding: 4px 14px; border-radius: 999px; background: rgba(0,0,0,.35); color: #fff; font-size: 0.9rem; }
  .pot:empty { background: none; }
  .board { display: flex; gap: clamp(4px, 0.8cqw, 10px); }
  .bslot { width: var(--cw); aspect-ratio: 5 / 7; border-radius: 8px; box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.12); transition: opacity 0.4s var(--ease-snap), transform 0.4s var(--ease-snap); }
  .bslot.dim { opacity: 0.4; }
  .bslot.hi { transform: translateY(-6px); }
  .result { display: grid; gap: 4px; justify-items: center; padding: 8px 16px; border-radius: 16px; background: rgba(0,0,0,.5); color: #fff; font-size: 0.85rem; text-align: center; }
  .result strong { color: var(--gold); }

  .dealer {
    position: absolute; left: 0; top: 0; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%; display: grid; place-items: center;
    background: #f4f2ee; color: #1d1d22; font: 800 0.75rem 'Geist Mono Variable', monospace; box-shadow: 0 3px 8px rgba(0,0,0,.5); z-index: 4;
    transition: transform 0.7s var(--spring-smooth);
  }
  .seat { position: absolute; translate: -50% -50%; display: grid; justify-items: center; gap: 4px; z-index: 3; transition: opacity 0.3s var(--ease-snap); }
  .seat.folded .hole { opacity: 0.3; }
  .seat.out { opacity: 0.55; }
  .hole { display: flex; gap: 0; min-height: calc(var(--cw) * 0.7); }
  .hole .hc + .hc { margin-left: calc(var(--cw) * -0.35); }
  .seat.me .hole { --cw: clamp(62px, 6.6cqw, 100px); }
  .seat.me .hole .hc + .hc { margin-left: calc(var(--cw) * -0.2); }
  .hc { transition: transform 0.4s var(--ease-snap); }
  .hc.hi { transform: translateY(-8px); }
  .plate {
    display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; column-gap: 8px; align-items: center; min-width: 124px; padding: 5px 12px 5px 5px;
    border-radius: 999px; background: rgba(12, 14, 18, 0.88); color: #fff; box-shadow: 0 8px 20px rgba(0,0,0,.45); transition: box-shadow 0.3s var(--ease-snap);
  }
  .seat.turn .plate { box-shadow: 0 0 0 2px var(--gold), 0 0 26px -4px var(--gold); }
  .seat.winner .plate { box-shadow: 0 0 0 2px #2fbf71, 0 0 30px -4px #2fbf71; }
  .av { grid-row: span 2; position: relative; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: var(--accent); color: var(--accent-ink); font-weight: 700; }
  .av.bot { background: #3a3f4c; color: #cfd3dc; }
  .av[style*='--dl']::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; border: 3px solid var(--gold); animation: timer var(--dl) linear forwards; }
  @keyframes timer { from { clip-path: inset(0 0 0 0); } to { clip-path: inset(100% 0 0 0); } }
  .nm { font-size: 0.8rem; font-weight: 600; max-width: 96px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .st { font-size: 0.75rem; color: var(--gold); }
  .say { position: absolute; top: calc(100% + 2px); white-space: nowrap; font: 600 0.68rem 'Geist Mono Variable', monospace; text-transform: uppercase; letter-spacing: 0.08em; padding: 3px 8px; border-radius: 999px; background: rgba(0,0,0,.6); color: #fff; }
  .say.s-fold { color: rgba(255,255,255,.55); }
  .say.s-raise, .say.s-bet { background: #c8262c; } .say.s-allin { background: #6b3fa0; } .say.s-call { background: #2a6fd6; }
  .seat.hang { translate: -50% 0; }
  .seat.stand { translate: -50% -100%; }

  .won { position: absolute; top: -18px; padding: 3px 10px; border-radius: 999px; background: #2fbf71; color: #062a16; font-size: 0.8rem; font-weight: 700; }
  .bet { position: absolute; translate: -50% -50%; display: flex; align-items: center; gap: 5px; padding: 2px 8px 2px 2px; border-radius: 999px; background: rgba(0,0,0,.4); color: #fff; font-size: 0.75rem; z-index: 2; }
  .empty { position: absolute; translate: -50% -50%; width: 74px; height: 74px; border-radius: 50%; border: 2px dashed rgba(255,255,255,.35); background: rgba(0,0,0,.2); color: rgba(255,255,255,.8); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; z-index: 3; transition: border-color 0.25s var(--ease-snap), transform 0.35s var(--ease-snap); }
  .empty:hover:not(:disabled) { border-color: #fff; transform: scale(1.05); }
  .log { position: absolute; left: 1%; bottom: 1%; margin: 0; padding: 0; list-style: none; font-size: 0.72rem; color: var(--muted); display: grid; gap: 2px; max-width: 32%; }
  .table:not(.wide) .log { display: none; }

  .dock {
    position: sticky; bottom: 12px; z-index: 20; margin-top: 10px; padding: 12px 16px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 18px;
    background: color-mix(in srgb, var(--surface) 90%, transparent); backdrop-filter: blur(14px); border-radius: 24px; box-shadow: 0 20px 50px -20px rgba(0,0,0,.5); min-height: 76px;
  }
  .acts { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; flex: 1; }
  .act { min-height: 50px; min-width: 120px; font-size: 0.95rem; }
  .act.fold { color: #ff9a9d; }
  .raise { display: grid; gap: 6px; flex: 1; min-width: 220px; }
  .presets { display: flex; gap: 4px; flex-wrap: wrap; }
  .presets .btn { min-height: 30px; padding: 0 10px; }
  .raise input { width: 100%; accent-color: var(--accent); }
  kbd { font: 500 0.7rem 'Geist Mono Variable', monospace; opacity: 0.5; border: 1px solid var(--line-2); border-radius: 4px; padding: 0 4px; }
  .info { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .field.inline { display: flex; align-items: center; gap: 8px; }
  .field.inline input { width: 110px; min-height: 36px; }
  .muted { color: var(--muted); font-size: 0.85rem; }
  .helper { display: grid; gap: 2px; justify-items: end; text-align: right; }
  .helper strong { font-size: 0.95rem; }
  .eq { font-size: 0.78rem; color: var(--muted); }
  @media (max-width: 759px) {
    .plate { min-width: 0; grid-template-columns: auto; padding: 4px 8px; justify-items: center; border-radius: 14px; }
    .av { grid-row: auto; width: 26px; height: 26px; font-size: 0.75rem; }
    .nm { max-width: 64px; font-size: 0.7rem; }
    .act { min-width: 0; flex: 1 1 30%; }
    .helper { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; justify-items: start; text-align: left; width: 100%; }
    .helper .eyebrow { display: none; }
    .dock { padding: 10px; gap: 8px; bottom: 8px; }
    .act { min-height: 44px; font-size: 0.85rem; }
    .acts kbd { display: none; }
    .raise { min-width: 100%; order: 3; }
    .presets .btn { min-height: 28px; padding: 0 8px; font-size: 0.72rem; }
    .head { padding-top: 10px; }
  }
  @media (max-width: 400px) { h1 { font-size: 1.4rem; } .h1row { gap: 8px; } .blinds { font-size: 0.8rem; } }
</style>
