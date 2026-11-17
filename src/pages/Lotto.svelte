<script lang="ts">
  // Lotto 6 aus 42 plus Glückszahl. Alone or in a room: everyone hands in tickets, the host starts the draw,
  // all players see the same balls and a leaderboard. Each player pays and gets paid on their own device.
  import { onDestroy, untrack } from 'svelte';
  import { fly, scale } from 'svelte/transition';
  import HowTo from '../components/HowTo.svelte';
  import RoomBar from '../components/RoomBar.svelte';
  import BetInput from '../components/BetInput.svelte';
  import { Room } from '../lib/net.svelte';
  import { LOTTO_N, LOTTO_K, LUCKY, LOTTO_TABLE, RANKS, draw, lottoRank } from '../games/lotto';
  import { wallet, settle, stake, credit, fmt, settings } from '../lib/state.svelte';
  import { sfx } from '../lib/sfx';
  import { t } from '../lib/i18n';

  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
  type Ticket = { nums: number[]; lucky: number };
  type Player = { id: string; name: string; bot?: boolean; tickets: Ticket[]; bet: number; best?: number; win?: number; hits?: string };
  const MAX_TICKETS = 6, BALL_MS = 900;

  // ---------- my tickets ----------
  let bet = $state(10); // per ticket
  let tickets = $state<Ticket[]>([]);
  let edit = $state<Ticket>({ nums: [], lucky: 0 });
  let paid = $state(0); // what I staked for the coming draw (0 = not handed in)
  let myWin = $state<number | null>(null);
  const editOk = $derived(edit.nums.length === LOTTO_K && edit.lucky > 0);

  // ---------- the shared draw (host decides) ----------
  const share = $state({ phase: 'bet' as 'bet' | 'draw' | 'result', round: 0, drawn: [] as number[], lucky: 0, start: 0, players: [] as Player[] });
  let shown = $state(0); // balls revealed so far in this draw
  let guests = $state<Player[]>([]);
  let bots = $state<Player[]>([]);
  const room = new Room('lotto', onMsg, (id) => { guests = guests.filter((p) => p.id !== id); push(); });
  const isHost = $derived(room.role !== 'guest');
  const me = $derived<Player>({ id: room.myId, name: settings.name || L('Du', 'You'), tickets: paid ? tickets : [], bet });
  const players = $derived(isHost ? [me, ...guests, ...bots] : share.players);
  const BOT_NAMES = ['Mila', 'Jonas'];

  function onMsg(m: any, from: string) {
    if (m.t === 'state') {
      const fresh = m.s.phase === 'draw' && m.s.round !== share.round;
      Object.assign(share, m.s);
      if (fresh) reveal();
    } else if (room.role === 'host' && m.t === 'hello') {
      let p = guests.find((x) => x.id === from);
      if (!p) guests.push((p = { id: from, name: 'Guest', tickets: [], bet: 0 }));
      p.name = String(m.name).slice(0, 24);
      if (share.phase === 'bet') {
        // only well-formed tickets count
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
  // guests tell the host who they are and what they handed in
  $effect(() => {
    if (room.role === 'guest' && room.status === 'open') room.send({ t: 'hello', name: settings.name, tickets: paid ? $state.snapshot(tickets) : [], bet });
  });
  $effect(() => { void [paid, tickets.length, settings.name, bots.length, guests.length]; push(); });
  $effect(() => { bots = settings.bots && isHost ? BOT_NAMES.map((name, i) => ({ id: 'bot' + i, name, bot: true, tickets: [], bet: 10 })) : []; });
  // a guest who leaves a room starts fresh at home
  let wasGuest = false;
  $effect(() => {
    if (room.role === 'guest') wasGuest = true;
    else if (wasGuest) untrack(() => { wasGuest = false; Object.assign(share, { phase: 'bet', drawn: [], lucky: 0, players: [] }); });
  });

  // ---------- filling in a ticket ----------
  function toggle(n: number) {
    if (paid) return;
    if (edit.nums.includes(n)) edit.nums = edit.nums.filter((x) => x !== n);
    else if (edit.nums.length < LOTTO_K) edit.nums = [...edit.nums, n].sort((a, b) => a - b);
    sfx('click');
  }
  const quickTicket = (): Ticket => ({ nums: draw(LOTTO_N, LOTTO_K).sort((a, b) => a - b), lucky: 1 + Math.floor(Math.random() * LUCKY) });
  function quick() { if (!paid) { edit = quickTicket(); sfx('chip'); } }
  function addTicket() {
    if (paid || !editOk || tickets.length >= MAX_TICKETS) return;
    tickets = [...tickets, $state.snapshot(edit)];
    edit = { nums: [], lucky: 0 };
    sfx('chip');
  }
  const removeTicket = (i: number) => { if (!paid) tickets = tickets.filter((_, k) => k !== i); };
  const cost = $derived(Math.round(bet * tickets.length * 100) / 100);
  /** Hand the tickets in for the next draw (pays now) or take them back before it starts. */
  function handIn() {
    if (share.phase !== 'bet') return;
    if (paid) { credit(paid); paid = 0; return; }
    if (editOk && tickets.length < MAX_TICKETS) addTicket();
    if (!tickets.length || cost <= 0 || cost > wallet.balance) return;
    stake(cost);
    paid = cost;
    myWin = null;
    sfx('chip');
  }

  // ---------- the draw ----------
  function startDraw() {
    if (!isHost || share.phase === 'draw') return;
    if (share.phase === 'result') return newRound();
    for (const b of bots) b.tickets = Array.from({ length: 1 + Math.floor(Math.random() * 3) }, quickTicket);
    Object.assign(share, { phase: 'draw', round: share.round + 1, drawn: draw(LOTTO_N, LOTTO_K), lucky: 1 + Math.floor(Math.random() * LUCKY), start: Date.now() });
    push();
    reveal();
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  function reveal() {
    shown = 0;
    clearTimeout(timer);
    const fast = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const next = () => {
      shown++;
      sfx(shown === LOTTO_K + 1 ? 'big' : 'tick');
      if (shown <= LOTTO_K) timer = setTimeout(next, fast ? 30 : BALL_MS);
      else finish();
    };
    timer = setTimeout(next, fast ? 30 : 600);
  }
  const rankOf = (tk: Ticket) => lottoRank(tk.nums, tk.lucky, share.drawn, share.lucky);
  const winOf = (p: Player) => Math.round(p.tickets.reduce((a, tk) => a + (rankOf(tk) >= 0 ? p.bet * LOTTO_TABLE[rankOf(tk)] : 0), 0) * 100) / 100;
  const hitsOf = (tk: Ticket) => tk.nums.filter((n) => share.drawn.includes(n)).length;
  function finish() {
    // everyone settles their own tickets
    if (paid) {
      const w = winOf({ ...me, tickets, bet });
      settle(w, w);
      myWin = w;
      paid = 0;
      sfx(w > 0 ? 'win' : 'lose');
    }
    if (room.role !== 'guest') {
      // best ticket per player: its prize rank, or else just the most numbers right
      const best = (tks: Ticket[]) => ({ best: Math.min(99, ...tks.map(rankOf).map((r) => (r < 0 ? 99 : r))), hits: tks.length ? Math.max(...tks.map(hitsOf)) + (tks.some((tk) => tk.lucky === share.lucky) ? ' ★' : '') : '–' });
      for (const p of [...guests, ...bots]) Object.assign(p, { win: winOf(p) }, best(p.tickets));
      share.players = $state.snapshot(players).map((p) => (p.id === room.myId ? { ...p, win: myWin ?? 0, ...best(myWin === null ? [] : tickets) } : p));
      share.phase = 'result';
      push();
    }
  }
  function newRound() {
    Object.assign(share, { phase: 'bet', drawn: [], lucky: 0 });
    for (const p of [...guests, ...bots]) { p.tickets = []; p.win = undefined; p.best = undefined; }
    myWin = null;
    push();
  }
  // guests: when the host opens the next round, our handed-in state resets on our side too
  $effect(() => { if (room.role === 'guest' && share.phase === 'bet') untrack(() => { if (!paid) myWin = null; }); });
  onDestroy(() => { clearTimeout(timer); if (paid && share.phase === 'bet') credit(paid); room.leave(); });

  const ranked = $derived([...(share.phase === 'result' ? share.players : players)].sort((a, b) => (b.win ?? 0) - (a.win ?? 0)));
  const rankName = (i: number) => (i < 0 || i > 90 ? '–' : `${RANKS[i][0]}${RANKS[i][1] ? ' + ★' : ''}`);
  const drawnShown = $derived(share.drawn.slice(0, Math.min(shown, LOTTO_K)));
  const luckyShown = $derived(shown > LOTTO_K || share.phase === 'result');
</script>

<section class="wrap page">
  <header class="head rise">
    <div>
      <p class="eyebrow">{L('6 aus 42 · Glückszahl 1–6', '6 of 42 · lucky number 1–6')}</p>
      <div class="h1row"><h1>Lotto</h1><HowTo id="lotto" /></div>
    </div>
    <RoomBar {room}>
      {#snippet extra()}
        {#if isHost}<label class="switch mini"><span>{t('bots')}</span><input type="checkbox" bind:checked={settings.bots} /></label>{/if}
      {/snippet}
    </RoomBar>
  </header>

  <div class="grid rise" style="--i:1">
    <!-- the drum and the drawn balls -->
    <div class="stage">
      <div class="drum" class:spin={share.phase === 'draw'}>
        {#each Array(14) as _, i}<i style="--a:{i * 26}deg; --r:{18 + (i % 4) * 9}px; --d:{-i * 0.17}s">{(i * 7) % 42 + 1}</i>{/each}
      </div>
      <div class="balls">
        {#each Array(LOTTO_K) as _, i}
          <span class="ball slot">{#if drawnShown[i] !== undefined}{#key share.round}<b class="ball" class:mine={tickets.some((tk) => tk.nums.includes(drawnShown[i]))} in:scale={{ start: 0.2, duration: 380 }}>{drawnShown[i]}</b>{/key}{/if}</span>
        {/each}
        <span class="plus">+</span>
        <span class="ball slot gold">{#if luckyShown && share.lucky}<b class="ball gold" in:scale={{ start: 0.2, duration: 380 }}>{share.lucky}</b>{/if}</span>
      </div>
      <div class="status">
        {#if share.phase === 'draw'}{L('Ziehung läuft …', 'Drawing …')}
        {:else if share.phase === 'result'}
          {#if myWin !== null}<span class="mono" class:pos={myWin > 0} in:fly={{ y: 8 }}>{myWin > 0 ? L('Gewinn', 'Win') + ' +' + fmt(myWin) : L('Leider nichts', 'No win this time')}</span>{/if}
        {:else if room.role === 'guest'}{paid ? L('Abgegeben. Warten auf die Ziehung des Gastgebers.', 'Handed in. Waiting for the host to draw.') : L('Tipps ausfüllen und abgeben.', 'Fill in tickets and hand them in.')}
        {:else}{paid ? L('Bereit. Starte die Ziehung, sobald alle abgegeben haben.', 'Ready. Start the draw once everyone has handed in.') : L('Tipps ausfüllen und abgeben.', 'Fill in tickets and hand them in.')}{/if}
      </div>
      {#if isHost}
        <button class="btn primary drawbtn" disabled={share.phase === 'draw' || (share.phase === 'bet' && !players.some((p) => p.tickets.length))} onclick={startDraw}>
          {share.phase === 'result' ? L('Neue Runde', 'New round') : L('Ziehung starten', 'Start the draw')}
        </button>
      {/if}
      <!-- players and the leaderboard -->
      {#if ranked.length > 1 || share.phase === 'result'}
        <ol class="board">
          {#each ranked as p (p.id)}
            <li class:me={p.id === room.myId} in:fly={{ y: 6 }}>
              <span class="av" class:bot={p.bot}>{p.name.slice(0, 1)}</span>
              <span class="pn">{p.name}</span>
              {#if share.phase === 'result'}<span class="mono rk">{(p.best ?? 99) < 90 ? rankName(p.best ?? 99) : p.hits ? p.hits + ' ' + L('richtig', 'right') : '–'}</span><span class="mono" class:pos={(p.win ?? 0) > 0}>{(p.win ?? 0) > 0 ? '+' + fmt(p.win ?? 0) : '0'}</span>
              {:else}<span class="mono muted">{p.tickets.length ? p.tickets.length + ' ' + L('Tipps', 'tickets') : L('wählt …', 'picking …')}</span>{/if}
            </li>
          {/each}
        </ol>
      {/if}
    </div>

    <!-- my ticket -->
    <div class="slip">
      <div class="slip-head"><strong>{L('Dein Tipp', 'Your ticket')}</strong><span class="mono muted">{edit.nums.length} / {LOTTO_K}</span></div>
      <div class="nums">
        {#each Array(LOTTO_N) as _, i}
          {@const n = i + 1}
          <button class="n mono" class:on={edit.nums.includes(n)} disabled={!!paid} onclick={() => toggle(n)}>{n}</button>
        {/each}
      </div>
      <div class="slip-head"><strong>{L('Glückszahl', 'Lucky number')}</strong></div>
      <div class="lucky">
        {#each Array(LUCKY) as _, i}<button class="n mono" class:on={edit.lucky === i + 1} disabled={!!paid} onclick={() => (edit.lucky = i + 1)}>{i + 1}</button>{/each}
      </div>
      <div class="row2">
        <button class="btn" disabled={!!paid} onclick={quick}>🎲 {L('Quick-Tipp', 'Quick pick')}</button>
        <button class="btn" disabled={!!paid || !editOk || tickets.length >= MAX_TICKETS} onclick={addTicket}>+ {L('Tipp hinzufügen', 'Add ticket')}</button>
      </div>
      {#if tickets.length}
        <ul class="tickets">
          {#each tickets as tk, i}
            <li>
              <span class="mono">{#each tk.nums as n}<em class:hit={share.drawn.includes(n) && shown > share.drawn.indexOf(n)}>{n}</em>{/each} <em class="gold" class:hit={luckyShown && tk.lucky === share.lucky}>★{tk.lucky}</em></span>
              {#if share.phase === 'result' && share.drawn.length}<span class="mono res">{hitsOf(tk)}{tk.lucky === share.lucky ? '+★' : ''}{rankOf(tk) >= 0 ? ' · ×' + LOTTO_TABLE[rankOf(tk)] : ''}</span>
              {:else if !paid}<button class="x" onclick={() => removeTicket(i)} aria-label={L('Entfernen', 'Remove')}>×</button>{/if}
            </li>
          {/each}
        </ul>
      {/if}
      <div class="betbox"><BetInput bind:value={bet} disabled={!!paid} /></div>
      <button class="btn big" class:primary={!paid} disabled={share.phase !== 'bet' || (!paid && (!(tickets.length || editOk) || bet <= 0 || bet * Math.max(1, tickets.length + (editOk ? 1 : 0)) > wallet.balance))} onclick={handIn}>
        {paid ? L('Zurücknehmen', 'Take back') + ' · ' + fmt(paid) : L('Abgeben', 'Hand in') + ' · ' + fmt(Math.round(bet * Math.min(MAX_TICKETS, tickets.length + (editOk ? 1 : 0)) * 100) / 100)}
      </button>
      <details class="table">
        <summary>{L('Gewinnränge', 'Prize ranks')}</summary>
        <div>{#each RANKS as r, i}<span><b>{r[0]}{r[1] ? ' + ★' : ''}</b><em class="mono">×{LOTTO_TABLE[i].toLocaleString()}</em></span>{/each}</div>
      </details>
    </div>
  </div>
</section>

<style>
  .head { display: flex; justify-content: space-between; align-items: end; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
  .h1row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  h1 { margin: 0; }
  .grid { display: grid; grid-template-columns: 1fr 380px; gap: 20px; align-items: start; }
  @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  .muted { color: var(--muted); }
  .pos { color: #7ff0b2; }

  .stage {
    position: relative; display: grid; gap: 16px; justify-items: center; padding: clamp(18px, 3vw, 32px); border-radius: 28px; color: #fff; min-height: 460px; align-content: start;
    background: radial-gradient(ellipse at 50% 0%, #1d4b8f, #0b1b38 70%); box-shadow: 0 30px 60px -30px rgba(0,0,0,.6), inset 0 0 0 1px rgba(255,255,255,.08);
  }
  .drum { position: relative; width: 150px; height: 150px; border-radius: 50%; background: radial-gradient(circle at 40% 35%, rgba(255,255,255,.22), rgba(255,255,255,.04) 60%); box-shadow: inset 0 0 0 3px rgba(255,255,255,.25), 0 10px 30px rgba(0,0,0,.4); }
  .drum i { position: absolute; left: 50%; top: 50%; width: 22px; height: 22px; margin: -11px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff, #cfd5e2); color: #1d1d22; font: 700 0.55rem/22px 'Geist Mono Variable', monospace; text-align: center; font-style: normal;
    transform: rotate(var(--a)) translateX(var(--r)); }
  .drum.spin i { animation: tumble 0.9s linear infinite; animation-delay: var(--d); }
  @keyframes tumble { to { transform: rotate(calc(var(--a) + 360deg)) translateX(var(--r)) rotate(-200deg); } }
  .balls { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: center; }
  .ball { width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; font: 800 1.2rem 'Geist Mono Variable', monospace; color: #1d1d22; }
  .ball.slot { background: rgba(0,0,0,.25); box-shadow: inset 0 2px 6px rgba(0,0,0,.4); }
  b.ball { background: radial-gradient(circle at 35% 30%, #fff, #d4d9e4); box-shadow: 0 6px 14px rgba(0,0,0,.4); }
  b.ball.mine { background: radial-gradient(circle at 35% 30%, #b9f7d6, #2fbf71); }
  b.ball.gold { background: radial-gradient(circle at 35% 30%, #fff1b8, #e0a92a); }
  .plus { font-size: 1.4rem; opacity: 0.6; }
  .status { min-height: 26px; font-size: 1rem; text-align: center; }
  .drawbtn { min-width: 220px; min-height: 48px; }
  .board { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; width: min(100%, 460px); }
  .board li { display: grid; grid-template-columns: 26px 1fr auto auto; gap: 10px; align-items: center; padding: 6px 12px 6px 6px; border-radius: 999px; background: rgba(0,0,0,.25); font-size: 0.9rem; }
  .board li.me { box-shadow: inset 0 0 0 1px #f2c046; }
  .av { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: #3d9bff; font-weight: 700; font-size: 0.8rem; }
  .av.bot { background: #6c6f7d; }
  .rk { color: #f2c046; }

  .slip { display: grid; gap: 12px; padding: 18px; border-radius: 22px; background: #fff8e8; color: #3a2a12; box-shadow: 0 20px 40px -24px rgba(0,0,0,.6); }
  .slip-head { display: flex; justify-content: space-between; align-items: baseline; }
  .slip .muted { color: #8a7650; }
  .nums { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; }
  .lucky { display: grid; grid-template-columns: repeat(6, 1fr); gap: 5px; }
  .n { aspect-ratio: 1.2; border-radius: 8px; border: 1.5px solid #e2b9b9; background: #fff; color: #b0302f; font-size: 0.85rem; font-weight: 700; padding: 0; transition: transform 0.2s var(--ease-snap); }
  .n:hover:not(:disabled) { transform: scale(1.06); }
  .n.on { background: #c8262c; color: #fff; border-color: #c8262c; }
  .lucky .n { border-color: #e7cf8d; color: #9a6b00; }
  .lucky .n.on { background: #e0a92a; color: #2a1a00; border-color: #e0a92a; }
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .slip .btn:not(.primary) { background: #fff; color: #3a2a12; border-color: #e6d6b6; }
  .tickets { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  .tickets li { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; border-radius: 10px; background: #f6ead0; font-size: 0.82rem; }
  .tickets em { font-style: normal; margin-right: 6px; }
  .tickets em.hit { background: #2fbf71; color: #fff; border-radius: 5px; padding: 0 3px; }
  .tickets em.gold { color: #9a6b00; }
  .tickets .res { color: #1c8a52; font-weight: 700; }
  .x { border: 0; background: none; font-size: 1.1rem; color: #b0302f; }
  .big { min-height: 52px; width: 100%; }
  .betbox { padding: 10px 12px 12px; border-radius: 14px; background: var(--bg-2); color: var(--text); }
  .table summary { cursor: pointer; font-weight: 600; }
  .table div { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; margin-top: 8px; font-size: 0.82rem; }
  .table span { display: flex; justify-content: space-between; }
  .table em { font-style: normal; }
</style>
