<script lang="ts">
  // Lotto 6 aus 42 plus Glückszahl, two ways to play:
  // - Tageslotto: one free ticket per day, the server draws at 20:00 (Zurich), fixed prizes, list of everyone in it.
  // - Runde: alone or in a room, everyone hands in paid tickets, the host starts the draw, all see the same balls.
  import { onDestroy, onMount, untrack } from 'svelte';
  import { fly, scale } from 'svelte/transition';
  import HowTo from '../components/HowTo.svelte';
  import RoomBar from '../components/RoomBar.svelte';
  import BetInput from '../components/BetInput.svelte';
  import LottoDrum from '../components/LottoDrum.svelte';
  import LottoCard from '../components/LottoCard.svelte';
  import { Room } from '../lib/net.svelte';
  import { LOTTO_N, LOTTO_K, LUCKY, LOTTO_TABLE, DAILY_PRIZE, RANKS, draw, lottoRank } from '../games/lotto';
  import * as daily from '../lib/dailyLotto';
  import { wallet, settle, stake, credit, fmt, settings } from '../lib/state.svelte';
  import { sfx } from '../lib/sfx';
  import { t } from '../lib/i18n';

  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
  type Ticket = { nums: number[]; lucky: number };
  type Player = { id: string; name: string; bot?: boolean; tickets: Ticket[]; bet: number; win?: number };
  type Draw = { nums: number[]; lucky: number };
  const MAX_TICKETS = 6, BALL_MS = 900;
  const blank = (): Ticket => ({ nums: [], lucky: 0 });
  const full = (tk: Ticket) => tk.nums.length === LOTTO_K && tk.lucky > 0;
  const quickTicket = (): Ticket => ({ nums: draw(LOTTO_N, LOTTO_K).sort((a, b) => a - b), lucky: 1 + Math.floor(Math.random() * LUCKY) });
  const rankOf = (tk: Ticket, d: Draw) => lottoRank(tk.nums, tk.lucky, d.nums, d.lucky);
  const hitsOf = (tk: Ticket, d: Draw) => tk.nums.filter((n) => d.nums.includes(n)).length;
  const rankName = (i: number) => `${RANKS[i][0]}${RANKS[i][1] ? ' + ★' : ''}`;
  /** Short result for a ticket: "3 + ★ · ×12" or "2 richtig". */
  const resultOf = (tk: Ticket, d: Draw, prize: (r: number) => string) => {
    const r = rankOf(tk, d);
    return r >= 0 ? rankName(r) + ' · ' + prize(r) : hitsOf(tk, d) + (tk.lucky === d.lucky ? ' + ★' : '') + ' ' + L('richtig', 'right');
  };
  const dateName = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString(settings.lang === 'de' ? 'de-CH' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const same = (a: number[], b: number[]) => a.join() === b.join();
  const drawDate = dateName; // a daily draw for day D happens at 20:00 on D

  let mode = $state<'daily' | 'room'>('daily');

  // ---------- the stage: drum, drawn balls, reveal ----------
  let stage = $state<Draw>({ nums: [], lucky: 0 });
  let shown = $state(0); // balls revealed so far (LOTTO_K + 1 = all, lucky included)
  let drawing = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  function reveal(d: Draw, done: () => void) {
    stage = d; shown = 0; drawing = true;
    clearTimeout(timer);
    const fast = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const next = () => {
      shown++;
      sfx(shown === LOTTO_K + 1 ? 'big' : 'tick');
      if (shown <= LOTTO_K) timer = setTimeout(next, fast ? 30 : BALL_MS);
      else { drawing = false; done(); }
    };
    timer = setTimeout(next, fast ? 30 : 1400);
  }
  const drawnShown = $derived(stage.nums.slice(0, Math.min(shown, LOTTO_K)));
  const luckyShown = $derived(shown > LOTTO_K ? stage.lucky : 0);
  const inDrum = $derived(Array.from({ length: LOTTO_N }, (_, i) => i + 1).filter((n) => !drawnShown.includes(n)));

  // ================= Runde (paid, alone or in a room) =================
  let bet = $state(10); // per ticket
  let tickets = $state<Ticket[]>([blank()]);
  let paid = $state(0); // staked for the coming draw (0 = not handed in)
  let myWin = $state<number | null>(null);
  const ready = $derived(tickets.filter(full));
  const cost = $derived(Math.round(bet * ready.length * 100) / 100);

  const share = $state({ phase: 'bet' as 'bet' | 'draw' | 'result', round: 0, drawn: [] as number[], lucky: 0, players: [] as Player[], history: [] as Draw[] });
  const sd = $derived<Draw>({ nums: share.drawn, lucky: share.lucky });
  let guests = $state<Player[]>([]);
  let bots = $state<Player[]>([]);
  const room = new Room('lotto', onMsg, (id) => { guests = guests.filter((p) => p.id !== id); push(); });
  const isHost = $derived(room.role !== 'guest');
  const me = $derived<Player>({ id: room.myId, name: settings.name || L('Du', 'You'), tickets: paid ? tickets : [], bet });
  const players = $derived(isHost ? [me, ...guests, ...bots] : share.players);
  const BOT_NAMES = ['Mila', 'Jonas'];
  $effect(() => { if (room.role !== 'solo') untrack(() => { mode = 'room'; }); });

  function onMsg(m: any, from: string) {
    if (m.t === 'state') {
      const fresh = m.s.phase === 'draw' && m.s.round !== share.round;
      Object.assign(share, m.s);
      if (fresh) reveal({ nums: share.drawn, lucky: share.lucky }, finish);
    } else if (room.role === 'host' && m.t === 'hello') {
      let p = guests.find((x) => x.id === from);
      if (!p) guests.push((p = { id: from, name: 'Guest', tickets: [], bet: 0 }));
      p.name = String(m.name).slice(0, 24);
      if (share.phase === 'bet') {
        p.tickets = (Array.isArray(m.tickets) ? m.tickets : []).slice(0, MAX_TICKETS).filter((x: any) => Array.isArray(x?.nums) && x.nums.length === LOTTO_K && x.lucky >= 1 && x.lucky <= LUCKY);
        p.bet = Math.max(0, Number(m.bet) || 0);
      }
      push();
    }
  }
  function push() {
    if (room.role !== 'host') return;
    untrack(() => room.broadcast({ t: 'state', s: { ...$state.snapshot(share), players: $state.snapshot(players) } }));
  }
  $effect(() => {
    if (room.role === 'guest' && room.status === 'open') room.send({ t: 'hello', name: settings.name, tickets: paid ? $state.snapshot(tickets) : [], bet });
  });
  $effect(() => { void [paid, tickets.length, settings.name, bots.length, guests.length]; push(); });
  $effect(() => { bots = settings.bots && isHost ? BOT_NAMES.map((name, i) => ({ id: 'bot' + i, name, bot: true, tickets: [], bet: 10 })) : []; });
  let wasGuest = false;
  $effect(() => {
    if (room.role === 'guest') wasGuest = true;
    else if (wasGuest) untrack(() => { wasGuest = false; Object.assign(share, { phase: 'bet', drawn: [], lucky: 0, players: [], history: [] }); });
  });

  const canEdit = $derived(!paid && share.phase === 'bet');
  function setTicket(i: number, tk: Ticket) { if (canEdit) { tickets[i] = tk; sfx('click'); } }
  function addTicket() { if (canEdit && tickets.length < MAX_TICKETS) { tickets.push(blank()); sfx('chip'); } }
  /** Throw away all tickets (and take the stake back if they were already handed in). */
  function clearAll() {
    if (share.phase === 'draw') return;
    if (paid) { credit(paid); paid = 0; }
    tickets = [blank()];
    myWin = null;
  }
  function handIn() {
    if (share.phase !== 'bet') return;
    if (paid) { credit(paid); paid = 0; return; }
    if (!ready.length || cost <= 0 || cost > wallet.balance) return;
    tickets = ready.map((tk) => $state.snapshot(tk));
    stake(cost);
    paid = cost;
    myWin = null;
    sfx('chip');
  }
  function startDraw() {
    if (!isHost || share.phase === 'draw') return;
    if (share.phase === 'result') return newRound();
    for (const b of bots) b.tickets = Array.from({ length: 1 + Math.floor(Math.random() * 3) }, quickTicket);
    Object.assign(share, { phase: 'draw', round: share.round + 1, drawn: draw(LOTTO_N, LOTTO_K), lucky: 1 + Math.floor(Math.random() * LUCKY) });
    push();
    reveal({ nums: share.drawn, lucky: share.lucky }, finish);
  }
  const winOf = (p: Player, d: Draw) => Math.round(p.tickets.reduce((a, tk) => a + (rankOf(tk, d) >= 0 ? p.bet * LOTTO_TABLE[rankOf(tk, d)] : 0), 0) * 100) / 100;
  function finish() {
    const d = { nums: share.drawn, lucky: share.lucky };
    if (paid) {
      const w = winOf({ ...me, tickets }, d);
      settle(w, w);
      myWin = w;
      paid = 0;
      sfx(w > 0 ? 'win' : 'lose');
    }
    if (room.role !== 'guest') {
      for (const p of [...guests, ...bots]) p.win = winOf(p, d);
      share.players = $state.snapshot(players).map((p) => (p.id === room.myId ? { ...p, tickets: myWin === null ? [] : $state.snapshot(tickets), win: myWin ?? 0 } : p));
      share.history = [{ nums: [...d.nums], lucky: d.lucky }, ...share.history].slice(0, 12);
      share.phase = 'result';
      push();
    }
  }
  function newRound() {
    Object.assign(share, { phase: 'bet', drawn: [], lucky: 0 });
    for (const p of [...guests, ...bots]) { p.tickets = []; p.win = undefined; }
    myWin = null; shown = 0;
    push();
  }
  $effect(() => { if (room.role === 'guest' && share.phase === 'bet') untrack(() => { if (!paid) { myWin = null; shown = 0; } }); });
  const ranked = $derived([...(share.phase === 'result' ? share.players : players)].sort((a, b) => (b.win ?? 0) - (a.win ?? 0)));
  const roomPrize = (r: number) => '×' + LOTTO_TABLE[r].toLocaleString('de-CH');
  const showMine = $derived(!!paid || myWin !== null); // my cards light up during and after the draw

  // ================= Tageslotto (free, server draw at 20:00) =================
  let now = $state(Date.now());
  let day = $state(daily.openDay());
  let dTicket = $state<Ticket>(daily.mine()[daily.openDay()] ?? blank());
  let dIn = $state(!!daily.mine()[daily.openDay()]);
  let dBusy = $state(false);
  let dErr = $state('');
  let dData = $state<Awaited<ReturnType<typeof daily.stats>> | null>(null);
  let dPrev = $state<{ day: string; ticket: Ticket; draw: Draw; win: number } | null>(null); // my last finished ticket
  const nextDraw = $derived(daily.drawAt(day));
  const left = $derived(Math.max(0, nextDraw - now));
  const hms = (ms: number) => [ms / 3600e3, (ms / 60e3) % 60, (ms / 1e3) % 60].map((x) => String(Math.floor(x)).padStart(2, '0')).join(':');
  const dailyPrize = (r: number) => fmt(DAILY_PRIZE[r]);

  const failMsg = (e: unknown) => {
    const m = (e as { message?: string })?.message ?? String(e);
    return /lotto_|relation|schema cache|function/i.test(m) ? L('Das Tageslotto ist auf dem Server noch nicht eingerichtet.', 'The daily lotto is not set up on the server yet.') : m;
  };
  async function loadDaily() {
    try { dData = await daily.stats(); dErr = ''; } catch (e) { dErr = failMsg(e); }
  }
  /** Draw and pay my tickets of finished days; the newest one is drawn on the stage. */
  async function settleDaily() {
    const today = daily.openDay();
    const open = Object.entries(daily.mine()).filter(([d, tk]) => d < today && tk.paid === undefined).sort();
    try {
      for (const [d, tk] of open) {
        const dr = await daily.getDraw(d);
        if (!dr) continue;
        const r = rankOf(tk, dr), w = r >= 0 ? DAILY_PRIZE[r] : 0;
        daily.markPaid(d, w); // first, so a reload can never pay twice
        const pay = () => { if (w) { settle(w, w); sfx('big'); } dPrev = { day: d, ticket: tk, draw: dr, win: w }; };
        if (d === open.at(-1)![0] && mode === 'daily' && !drawing) reveal(dr, pay); else pay();
      }
      if (!dPrev) {
        const last = Object.entries(daily.mine()).filter(([d]) => d < today).sort().at(-1);
        if (last) { const dr = await daily.getDraw(last[0]); if (dr) dPrev = { day: last[0], ticket: last[1], draw: dr, win: last[1].paid ?? 0 }; }
      }
    } catch (e) { dErr = failMsg(e); }
  }
  async function handInDaily() {
    if (dIn || dBusy || !full(dTicket)) return;
    dBusy = true;
    try {
      await daily.handIn(settings.name || 'Player', $state.snapshot(dTicket));
      dIn = true;
      sfx('chip');
      loadDaily();
    } catch (e) { dErr = failMsg(e); }
    dBusy = false;
  }
  // when the clock passes 20:00 the open day moves on: draw, pay, reload
  $effect(() => {
    const d = daily.openDay(now);
    if (d !== day) untrack(() => {
      day = d;
      dTicket = daily.mine()[d] ?? blank();
      dIn = !!daily.mine()[d];
      setTimeout(async () => {
        await settleDaily();
        await loadDaily();
        // nobody here played: still show the draw that just happened
        const dr = dData?.draws[0];
        if (!drawing && mode === 'daily' && dr && dr.day === daily.prevDay(d) && !same(stage.nums, dr.nums)) reveal(dr, () => {});
      }, 1500);
    });
  });
  // the stage shows the last daily draw when nothing else is going on
  $effect(() => {
    const last = dData?.draws[0];
    if (mode === 'daily' && last && !drawing && !stage.nums.length) untrack(() => { stage = last; shown = LOTTO_K + 1; });
  });
  function setMode(m: 'daily' | 'room') {
    if (drawing || mode === m || (m === 'daily' && room.role !== 'solo')) return;
    mode = m;
    stage = m === 'room' ? sd : (dData?.draws[0] ?? { nums: [], lucky: 0 });
    shown = stage.nums.length ? LOTTO_K + 1 : 0;
  }
  const winners = (d: string) => {
    const dr = dData?.draws.find((x) => x.day === d);
    return dr ? (dData?.results ?? []).filter((r) => r.day === d && rankOf(r, dr) >= 0).sort((a, b) => rankOf(a, dr) - rankOf(b, dr)) : [];
  };
  const lastWinner = $derived.by(() => {
    for (const dr of dData?.draws ?? []) { const w = winners(dr.day); if (w.length) return { ...w[0], rank: rankOf(w[0], dr) }; }
    return null;
  });

  let tick: ReturnType<typeof setInterval>;
  onMount(() => {
    tick = setInterval(() => (now = Date.now()), 1000);
    loadDaily().then(settleDaily);
  });
  onDestroy(() => { clearTimeout(timer); clearInterval(tick); if (paid && share.phase === 'bet') credit(paid); room.leave(); });
</script>

<section class="lt">
  <header class="head">
    <div class="h1row">
      <h1>Lotto</h1>
      <span class="eyebrow">{L('6 aus 42 · Glückszahl 1–6', '6 of 42 · lucky number 1–6')}</span>
      <HowTo id="lotto" />
    </div>
    <div class="tabs" role="tablist">
      <button role="tab" aria-selected={mode === 'daily'} class:on={mode === 'daily'} disabled={room.role !== 'solo' || drawing} onclick={() => setMode('daily')}>☀ {L('Tageslotto', 'Daily draw')}</button>
      <button role="tab" aria-selected={mode === 'room'} class:on={mode === 'room'} disabled={drawing} onclick={() => setMode('room')}>🎱 {L('Runde', 'Round')}</button>
    </div>
    {#if mode === 'room'}
      <RoomBar {room}>
        {#snippet extra()}
          {#if isHost}<label class="switch mini"><span>{t('bots')}</span><input type="checkbox" bind:checked={settings.bots} /></label>{/if}
        {/snippet}
      </RoomBar>
    {/if}
  </header>

  <div class="rail">
    <div class="felt">
      <!-- the drum and the draw -->
      <div class="drawcol">
        <LottoDrum balls={inDrum} mixing={drawing} />
        <div class="balls">
          {#each Array(LOTTO_K) as _, i}
            <span class="ball slot">{#if drawnShown[i] !== undefined}{#key stage}<b class="ball" in:scale={{ start: 0.2, duration: 380 }}>{drawnShown[i]}</b>{/key}{/if}</span>
          {/each}
          <span class="plus">+</span>
          <span class="ball slot gold">{#if luckyShown}<b class="ball gold" in:scale={{ start: 0.2, duration: 380 }}>★{luckyShown}</b>{/if}</span>
        </div>
        <div class="status">
          {#if drawing}<span class="serif">{L('Ziehung läuft …', 'Drawing …')}</span>
          {:else if mode === 'daily'}
            {#if dPrev && same(dPrev.draw.nums, stage.nums)}
              <span class="mono" class:pos={dPrev.win > 0}>{dPrev.win ? L('Gewinn', 'Win') + ' +' + fmt(dPrev.win) : L('Diesmal nichts', 'Nothing this time')}</span>
            {:else if dData?.draws[0] && same(stage.nums, dData.draws[0].nums)}<span class="muted">{L('Ziehung vom', 'Draw of')} {drawDate(dData.draws[0].day)}</span>{/if}
          {:else if share.phase === 'result'}
            {#if myWin !== null}<span class="mono" class:pos={myWin > 0} in:fly={{ y: 8 }}>{myWin > 0 ? L('Gewinn', 'Win') + ' +' + fmt(myWin) : L('Leider nichts', 'No win this time')}</span>{/if}
          {:else if room.role === 'guest'}{paid ? L('Abgegeben. Der Gastgeber startet die Ziehung.', 'Handed in. The host starts the draw.') : L('Scheine ausfüllen und abgeben.', 'Fill in tickets and hand them in.')}
          {:else}{paid ? L('Bereit. Starte die Ziehung, sobald alle abgegeben haben.', 'Ready. Start the draw once everyone has handed in.') : L('Scheine ausfüllen und abgeben.', 'Fill in tickets and hand them in.')}{/if}
        </div>
        {#if mode === 'room' && isHost}
          <button class="btn primary drawbtn" disabled={drawing || (share.phase === 'bet' && !players.some((p) => p.tickets.length))} onclick={startDraw}>
            {share.phase === 'result' ? L('Neue Runde', 'New round') : L('Ziehung starten', 'Start the draw')}
          </button>
        {/if}
        {#if mode === 'room' && share.history.length}
          <div class="hist" aria-label={L('Letzte Ziehungen', 'Last draws')}>
            {#each share.history as h, i (share.round - i)}
              <div class="hrow" class:first={i === 0} in:fly={{ y: -10, duration: 300 }}>{#each [...h.nums].sort((a, b) => a - b) as n}<span>{n}</span>{/each}<span class="g">★{h.lucky}</span></div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- right: players (room) or the daily board -->
      <aside class="side">
        {#if mode === 'room'}
          <h3 class="serif">{share.phase === 'result' ? L('Ergebnis', 'Results') : L('Am Tisch', 'At the table')}</h3>
          <ol class="board">
            {#each ranked as p, i (p.id)}
              <li class:me={p.id === room.myId} class:won={share.phase === 'result' && (p.win ?? 0) > 0} in:fly={{ y: 6 }}>
                <div class="who">
                  {#if share.phase === 'result'}<span class="pl mono">{i + 1}.</span>{/if}
                  <span class="av" class:bot={p.bot}>{p.name.slice(0, 1)}</span>
                  <span class="pn">{p.name}</span>
                  {#if share.phase === 'result'}<span class="mono" class:pos={(p.win ?? 0) > 0}>{(p.win ?? 0) > 0 ? '+' + fmt(p.win ?? 0) : '–'}</span>
                  {:else}<span class="mono muted">{p.tickets.length ? p.tickets.length + ' ' + (p.tickets.length === 1 ? L('Schein', 'ticket') : L('Scheine', 'tickets')) : L('wählt …', 'picking …')}</span>{/if}
                </div>
                {#if share.phase !== 'bet' && p.tickets.length}
                  {#each p.tickets as tk}
                    {@const r = share.phase === 'result' ? rankOf(tk, sd) : -1}
                    <div class="tk mono">
                      {#each tk.nums as n}<span class:hit={drawnShown.includes(n)}>{n}</span>{/each}<span class="g" class:hit={luckyShown === tk.lucky}>★{tk.lucky}</span>
                      {#if share.phase === 'result'}<em class:pos={r >= 0}>{r >= 0 ? rankName(r) + ' · ' + roomPrize(r) : hitsOf(tk, sd) + ' ' + L('richtig', 'right')}</em>{/if}
                    </div>
                  {/each}
                {/if}
              </li>
            {/each}
          </ol>
        {:else}
          <div class="clock">
            <span class="muted">{L('Nächste Ziehung', 'Next draw')} · {new Date(nextDraw).toLocaleString(settings.lang === 'de' ? 'de-CH' : 'en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' })}</span>
            <strong class="mono">{hms(left)}</strong>
            <span class="muted small">{L('Gratis · ein Schein pro Tag · Jackpot', 'Free · one ticket a day · jackpot')} {fmt(DAILY_PRIZE[0])}</span>
          </div>
          {#if dErr}<p class="err">{dErr}</p>{/if}
          {#if dData}
            {#if lastWinner}
              <p class="lastwin">🏆 {L('Zuletzt gewonnen', 'Last winner')}: <b>{lastWinner.name}</b> · {rankName(lastWinner.rank)} · +{dailyPrize(lastWinner.rank)} <span class="muted">({drawDate(lastWinner.day)})</span></p>
            {/if}
            <h3 class="serif">{L('Heute im Topf', 'In today’s draw')} <span class="mono muted">{dData.today.length}</span></h3>
            <div class="names">
              {#each dData.today.slice(0, 60) as n}<span>{n}</span>{:else}<em class="muted">{L('Noch niemand. Mach den Anfang!', 'Nobody yet. Be the first!')}</em>{/each}
              {#if dData.today.length > 60}<span class="muted">+{dData.today.length - 60}</span>{/if}
            </div>
            <h3 class="serif">{L('Letzte Ziehungen', 'Last draws')}</h3>
            <ul class="draws">
              {#each dData.draws as dr (dr.day)}
                {@const w = winners(dr.day)}
                {@const n = dData.results.filter((r) => r.day === dr.day).length}
                <li>
                  <div class="drow"><span class="dt">{drawDate(dr.day)}</span><span class="hrow mono">{#each [...dr.nums].sort((a, b) => a - b) as x}<span>{x}</span>{/each}<span class="g">★{dr.lucky}</span></span></div>
                  <div class="muted small">{n} {n === 1 ? L('Schein', 'ticket') : L('Scheine', 'tickets')}{#if w.length}&nbsp;·&nbsp;{#each w.slice(0, 4) as r, k}{k ? ', ' : ''}<b class="gold">{r.name}</b> {rankName(rankOf(r, dr))}{/each}{#if w.length > 4} +{w.length - 4}{/if}{:else}{n ? ' · ' + L('kein Gewinn', 'no winner') : ''}{/if}</div>
                </li>
              {:else}<li class="muted small">{L('Noch keine Ziehung.', 'No draw yet.')}</li>{/each}
            </ul>
          {:else if !dErr}<p class="muted">{L('Lade …', 'Loading …')}</p>{/if}
        {/if}
        <details class="prizes">
          <summary>{L('Gewinnränge', 'Prize ranks')}{mode === 'room' ? ' · ' + L('× Einsatz', '× stake') : ''}</summary>
          <div>{#each RANKS as _, i}<span><b>{rankName(i)}</b><em class="mono">{mode === 'room' ? roomPrize(i) : dailyPrize(i)}</em></span>{/each}</div>
        </details>
      </aside>
    </div>
  </div>

  <!-- my tickets -->
  <div class="slips">
    {#if mode === 'room'}
      <div class="cards">
        {#each tickets as tk, i}
          {@const done = share.phase === 'result' && myWin !== null}
          <LottoCard ticket={tk} label={L('Schein', 'Ticket') + ' ' + (i + 1)} edit={canEdit} drawn={showMine ? drawnShown : []} lucky={showMine ? luckyShown : 0}
            result={done ? resultOf(tk, sd, roomPrize) : ''} win={done && rankOf(tk, sd) >= 0}
            onchange={(x) => setTicket(i, x)} onquick={() => setTicket(i, quickTicket())} onremove={tickets.length > 1 ? () => (tickets = tickets.filter((_, k) => k !== i)) : undefined} />
        {/each}
        {#if canEdit && tickets.length < MAX_TICKETS}
          <button class="addcard" onclick={addTicket}><span>+</span>{L('Schein', 'Ticket')}</button>
        {/if}
      </div>
      <div class="dock">
        <div class="betbox"><BetInput bind:value={bet} disabled={!!paid} /></div>
        <span class="muted small">{L('Einsatz pro Schein', 'Stake per ticket')}</span>
        <div class="grow"></div>
        <button class="btn ghost" disabled={share.phase === 'draw'} onclick={clearAll}>🗑 {L('Alle löschen', 'Clear all')}</button>
        <button class="btn" disabled={!canEdit} onclick={() => { tickets = tickets.map((tk) => (full(tk) ? tk : quickTicket())); sfx('chip'); }}>🎲 {L('Leere ausfüllen', 'Fill empty')}</button>
        <button class="btn big" class:primary={!paid} disabled={share.phase !== 'bet' || (!paid && (!ready.length || cost > wallet.balance))} onclick={handIn}>
          {paid ? L('Zurücknehmen', 'Take back') + ' · ' + fmt(paid) : L('Abgeben', 'Hand in') + ' · ' + fmt(cost)}
        </button>
      </div>
    {:else}
      <div class="cards">
        <LottoCard ticket={dTicket} label={dIn ? L('Im Topf', 'In the draw') + ' ✓' : L('Dein Gratis-Schein', 'Your free ticket')} edit={!dIn} result={dIn ? dateName(day) + ' 20:00' : ''}
          onchange={(x) => { dTicket = x; sfx('click'); }} onquick={() => { dTicket = quickTicket(); sfx('chip'); }} />
        {#if dPrev}
          {@const live = same(stage.nums, dPrev.draw.nums)}
          <LottoCard ticket={dPrev.ticket} label={drawDate(dPrev.day)} drawn={live ? drawnShown : dPrev.draw.nums} lucky={live ? luckyShown : dPrev.draw.lucky}
            result={live && drawing ? '…' : resultOf(dPrev.ticket, dPrev.draw, dailyPrize)} win={!(live && drawing) && dPrev.win > 0} />
        {/if}
      </div>
      <div class="dock">
        <span class="muted small">{dIn ? L('Viel Glück! Gezogen wird um 20:00, du musst dafür nicht online sein. Den Gewinn bekommst du beim nächsten Besuch.', 'Good luck! The draw is at 20:00, you don’t need to be online. You get the prize on your next visit.') : L('6 Zahlen und eine Glückszahl wählen, dann gratis abgeben.', 'Pick 6 numbers and a lucky number, then hand it in for free.')}</span>
        <div class="grow"></div>
        {#if !dIn}
          <button class="btn primary big" disabled={!full(dTicket) || dBusy || !!dErr} onclick={handInDaily}>{dBusy ? '…' : L('Gratis abgeben', 'Hand in for free')}</button>
        {/if}
      </div>
    {/if}
  </div>
</section>

<style>
  .lt { width: min(100%, 1400px); margin-inline: auto; padding: 0 20px 48px; display: grid; gap: 14px; }
  .head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 16px; padding: 12px 4px 0; }
  .h1row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  h1 { margin: 0; font-size: clamp(1.7rem, 3vw, 2.4rem); letter-spacing: -0.04em; line-height: 1; }
  .tabs { display: flex; gap: 4px; padding: 4px; border-radius: 999px; background: var(--surface); box-shadow: inset 0 0 0 1px var(--line-2); }
  .tabs button { border: 0; background: none; color: var(--muted); min-height: 36px; padding: 0 16px; border-radius: 999px; font-weight: 600; }
  .tabs button.on { background: linear-gradient(180deg, #f3d488, #c9973f); color: #2a1604; }
  .switch.mini { min-height: 36px; font-size: 0.8rem; color: var(--muted); gap: 8px; }
  .muted { color: rgba(247,236,212,.55); }
  .small { font-size: 0.8rem; }
  .pos { color: #6ff0a6; }
  .gold { color: #e8c478; }
  .serif { font: 400 1.25rem 'Instrument Serif', Georgia, serif; letter-spacing: 0.01em; }

  /* walnut rail and deep royal-blue velvet with a gold inlay, like the roulette table */
  .rail {
    padding: 12px; border-radius: 40px; position: relative;
    background: linear-gradient(160deg, #6b3d22, #3b1f10 45%, #24120a 100%);
    box-shadow: 0 40px 80px -40px rgba(0,0,0,.8), inset 0 2px 0 rgba(255,255,255,.12), inset 0 -3px 0 rgba(0,0,0,.4);
  }
  .rail::before { content: ''; position: absolute; inset: 5px; border-radius: 35px; border: 1px solid rgba(232,196,120,.35); pointer-events: none; }
  .felt {
    border-radius: 30px; padding: clamp(16px, 2.4vw, 30px); color: #f7ecd4;
    display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: clamp(16px, 3vw, 40px);
    background:
      radial-gradient(ellipse at 30% 15%, rgba(120,150,255,.16), transparent 60%),
      repeating-conic-gradient(from 45deg, rgba(255,255,255,.018) 0 25%, transparent 0 50%) 0 0 / 28px 28px,
      radial-gradient(ellipse at 50% 40%, #16306e, #0a1636 80%);
    box-shadow: inset 0 0 0 2px rgba(0,0,0,.35), inset 0 0 0 9px rgba(0,0,0,.08), inset 0 0 0 10px rgba(216,178,106,.6), inset 0 30px 80px rgba(0,0,0,.35);
  }
  .drawcol { display: grid; justify-items: center; align-content: start; gap: 14px; min-width: 0; }
  .balls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: center; }
  .ball { width: 50px; height: 50px; border-radius: 50%; display: grid; place-items: center; font: 800 1.15rem 'Geist Mono Variable', monospace; color: #1d1d22; }
  .ball.slot { background: rgba(0,0,0,.3); box-shadow: inset 0 2px 6px rgba(0,0,0,.5), 0 0 0 1px rgba(232,196,120,.25); }
  b.ball { background: radial-gradient(circle at 35% 30%, #fff, #d4d9e4 70%, #9da3b2); box-shadow: 0 6px 14px rgba(0,0,0,.45); }
  b.ball.gold { background: radial-gradient(circle at 35% 30%, #fff1b8, #e0a92a 70%, #9a6b10); font-size: 1rem; }
  .plus { font-size: 1.4rem; color: #e8c478; }
  .status { min-height: 28px; text-align: center; font-size: 1rem; }
  .status .mono { font-size: 1.2rem; font-weight: 700; }
  .drawbtn { min-width: 240px; min-height: 50px; text-transform: uppercase; letter-spacing: 0.08em; }
  .hist { display: grid; gap: 4px; justify-items: center; }
  .hrow { display: flex; gap: 3px; opacity: 0.7; }
  .hrow.first { opacity: 1; }
  .hrow span { min-width: 26px; height: 26px; padding: 0 3px; border-radius: 50%; display: grid; place-items: center; font: 600 0.72rem 'Geist Mono Variable', monospace; background: rgba(255,255,255,.9); color: #1d1d22; }
  .hrow .g { background: #e0a92a; color: #2a1604; border-radius: 13px; }

  .side { display: grid; gap: 12px; align-content: start; min-width: 0; }
  .side h3 { margin: 4px 0 0; display: flex; gap: 8px; align-items: baseline; color: #e8c478; }
  .clock { display: grid; gap: 2px; padding: 14px 16px; border-radius: 18px; background: rgba(0,0,0,.28); box-shadow: inset 0 0 0 1px rgba(232,196,120,.3); }
  .clock strong { font-size: clamp(1.8rem, 3.4vw, 2.6rem); color: #f3d488; letter-spacing: 0.04em; }
  .lastwin { margin: 0; padding: 10px 14px; border-radius: 14px; background: linear-gradient(90deg, rgba(232,196,120,.22), rgba(232,196,120,.05)); font-size: 0.9rem; }
  .err { margin: 0; padding: 10px 14px; border-radius: 14px; background: rgba(229,72,77,.18); color: #ffc2c4; font-size: 0.88rem; }
  .names { display: flex; flex-wrap: wrap; gap: 5px; }
  .names span { padding: 3px 10px; border-radius: 999px; background: rgba(0,0,0,.28); box-shadow: inset 0 0 0 1px rgba(232,196,120,.2); font-size: 0.8rem; }
  .draws { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .draws li { display: grid; gap: 4px; padding: 8px 10px; border-radius: 12px; background: rgba(0,0,0,.22); }
  .drow { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  .dt { font-size: 0.82rem; color: #e8c478; }
  .draws .hrow { opacity: 1; }
  .draws .hrow span { min-width: 22px; height: 22px; font-size: 0.66rem; }

  .board { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; max-height: 440px; overflow-y: auto; }
  .board li { display: grid; gap: 4px; padding: 8px 12px; border-radius: 16px; background: rgba(0,0,0,.25); box-shadow: inset 0 0 0 1px rgba(232,196,120,.14); }
  .board li.me { box-shadow: inset 0 0 0 1px #e8c478; }
  .board li.won { background: linear-gradient(90deg, rgba(47,191,113,.22), rgba(0,0,0,.2)); }
  .who { display: flex; align-items: center; gap: 8px; }
  .pl { color: #e8c478; width: 2ch; }
  .pn { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .av { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: #e8c478; color: #2a1c05; font-weight: 700; font-size: 0.78rem; }
  .av.bot { background: rgba(255,255,255,.1); color: rgba(255,255,255,.7); border: 1px dashed rgba(255,255,255,.3); }
  .tk { display: flex; flex-wrap: wrap; gap: 3px; align-items: center; font-size: 0.72rem; padding-left: 34px; }
  .tk span { min-width: 22px; padding: 2px 0; text-align: center; border-radius: 6px; background: rgba(255,255,255,.08); color: rgba(247,236,212,.7); }
  .tk span.g { color: #e8c478; padding: 2px 4px; }
  .tk span.hit { background: #2fbf71; color: #04311b; font-weight: 700; }
  .tk em { font-style: normal; margin-left: auto; color: rgba(247,236,212,.55); }
  .tk em.pos { color: #6ff0a6; font-weight: 700; }

  .prizes { font-size: 0.85rem; }
  .prizes summary { cursor: pointer; color: #e8c478; }
  .prizes div { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 14px; margin-top: 8px; }
  .prizes span { display: flex; justify-content: space-between; gap: 8px; }
  .prizes em { font-style: normal; color: #f3d488; }

  /* tickets below the table */
  .slips { display: grid; gap: 12px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }
  .addcard {
    min-height: 200px; border-radius: 16px; border: 1.5px dashed rgba(216,178,106,.5); background: rgba(216,178,106,.05); color: var(--gold);
    display: grid; place-content: center; justify-items: center; gap: 4px; font-weight: 600; transition: background 0.2s;
  }
  .addcard span { font-size: 2rem; line-height: 1; }
  .addcard:hover { background: rgba(216,178,106,.12); }
  .dock {
    display: flex; flex-wrap: wrap; align-items: center; gap: 10px 12px; padding: 12px 14px; border-radius: 22px;
    background: var(--surface); box-shadow: inset 0 0 0 1px var(--line);
  }
  .dock .muted { color: var(--muted); }
  .betbox { width: 220px; }
  .grow { flex: 1; }
  .big { min-height: 50px; min-width: 200px; }

  @media (max-width: 900px) {
    .felt { grid-template-columns: 1fr; }
    .lt { padding: 0 10px 30px; }
    .rail { padding: 8px; border-radius: 30px; }
    .rail::before { inset: 3px; border-radius: 26px; }
    .felt { border-radius: 22px; }
    .ball { width: 40px; height: 40px; font-size: 0.95rem; }
    .dock .big, .betbox { width: 100%; }
    .cards { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
  }
</style>
