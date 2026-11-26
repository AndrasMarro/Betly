<script lang="ts">
  // Memory. Solo: clear the board in as few turns as possible (free, or with a stake that pays by turns per pair).
  // Duell: take turns against bots, people at this device or friends in a room; a pair means another turn.
  // Everybody puts their own stake in the pot (shared out like side pots, see games/pot.ts).
  // The host's browser holds the cards; others only ever see the faces that are turned.
  import { onDestroy, untrack } from 'svelte';
  import { fly } from 'svelte/transition';
  import HowTo from '../components/HowTo.svelte';
  import RoomBar from '../components/RoomBar.svelte';
  import BetInput from '../components/BetInput.svelte';
  import MemoryFace from '../components/MemoryFace.svelte';
  import PotSeats from '../components/PotSeats.svelte';
  import { Room } from '../lib/net.svelte';
  import { SIZES, FORGET, Brain, deal, soloMult, type Theme, type Diff } from '../games/memory';
  import { sidePots, ranks } from '../games/pot';
  import { wallet, settle, stake as takeStake, fmt, settings } from '../lib/state.svelte';
  import { sfx } from '../lib/sfx';

  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
  const saved = (() => { try { return JSON.parse(localStorage.getItem('betly:memory') || '{}'); } catch { return {}; } })();
  let theme = $state<Theme>(saved.theme ?? 'symbols');
  let size = $state<number>(saved.size ?? 16);
  let diff = $state<Diff>(saved.diff ?? 'normal');
  let botCount = $state<number>(saved.bots ?? 1);
  let best = $state<Record<string, number>>(saved.best ?? {});
  $effect(() => { const s = { theme, size, diff, bots: botCount, best }; untrack(() => { try { localStorage.setItem('betly:memory', JSON.stringify(s)); } catch {} }); });

  let mode = $state<'solo' | 'duel'>('solo');
  let paid = $state(false);
  let bet = $state(10); // solo stake, and my stake in the pot in a duel
  type P = { id: string; name: string; bot?: boolean; local?: boolean; stake: number; pairs: number };
  type C = { face: number | null; owner: string | null; pos: number };
  const share = $state({
    phase: 'lobby' as 'lobby' | 'play' | 'end', round: 0, size: 16, theme: 'symbols' as Theme, diff: 'normal' as Diff,
    cards: [] as C[], turn: '', open: [] as number[], players: [] as P[], payouts: null as Record<string, number> | null, turns: 0, note: '',
  });
  const cols = $derived(SIZES.find((s) => s.n === share.size)?.cols ?? 4);

  // ---------- host only ----------
  let faces: number[] = [];
  let busy = false, misses = 0, started = 0;
  let brains = new Map<string, Brain>();
  let guests = $state<{ id: string; name: string; stake: number }[]>([]);
  let locals = $state<string[]>([]);
  const BOT_NAMES = ['Mila', 'Jonas', 'Lea'];
  const room = new Room('memory', onMsg, (id) => {
    guests = guests.filter((g) => g.id !== id);
    if (share.phase === 'play' && share.players.some((p) => p.id === id)) {
      share.players = share.players.filter((p) => p.id !== id);
      if (share.turn === id) nextTurn();
    }
    push(true);
  });
  const isHost = $derived(room.role !== 'guest');
  $effect(() => { if (room.role !== 'solo') untrack(() => { mode = 'duel'; }); });

  const roster = (): P[] => mode === 'solo'
    ? [{ id: room.myId, name: settings.name || L('Du', 'You'), stake: paid ? bet : 0, pairs: 0 }]
    : [
      { id: room.myId, name: settings.name || L('Du', 'You'), stake: bet, pairs: 0 },
      ...locals.map((n, i) => ({ id: 'local' + i, name: n, local: true, stake: 0, pairs: 0 })),
      ...guests.map((g) => ({ ...g, pairs: 0 })),
      ...Array.from({ length: botCount }, (_, i) => ({ id: 'bot' + i, name: BOT_NAMES[i], bot: true, stake: bet, pairs: 0 })),
    ];
  const lobby = $derived(share.phase === 'lobby' && isHost ? roster() : share.players);

  function onMsg(m: any, from: string) {
    if (room.role === 'guest') {
      if (m.t === 'state') { Object.assign(share, m.s); afterState(); }
      return;
    }
    if (m.t === 'hello') {
      const g = { id: from, name: String(m.name || 'Guest').slice(0, 20), stake: Math.max(0, Math.min(100000, Number(m.stake) || 0)) };
      const i = guests.findIndex((x) => x.id === from);
      if (i >= 0) guests[i] = g; else guests.push(g);
      push(true);
    } else if (m.t === 'flip') flip(Number(m.i), from);
  }
  let lastPush = 0;
  function push(force = false) {
    if (room.role !== 'host') return;
    if (!force && performance.now() - lastPush < 120) return;
    lastPush = performance.now();
    untrack(() => room.broadcast({ t: 'state', s: $state.snapshot(share) }));
  }
  // guests tell the host their name and stake, again whenever the stake changes
  $effect(() => { if (room.role === 'guest' && room.status === 'open') room.send({ t: 'hello', name: settings.name, stake: bet }); });
  $effect(() => { void [guests.length, botCount, locals.length, bet, settings.name, mode, paid]; untrack(() => { if (share.phase === 'lobby') { share.players = roster(); push(true); } }); });
  let wasGuest = false;
  $effect(() => {
    if (room.role === 'guest') wasGuest = true;
    else if (wasGuest) untrack(() => { wasGuest = false; Object.assign(share, { phase: 'lobby', cards: [], players: [], payouts: null }); });
  });

  // ---------- the game (host / solo) ----------
  function start() {
    if (!isHost || (share.phase === 'play' && locked)) return; // a free solo game can simply be dealt again
    const players = roster();
    if (mode === 'solo' && paid && (bet <= 0 || bet > wallet.balance)) return;
    if (mode === 'duel' && (players.length < 2 || bet > wallet.balance)) return;
    faces = deal(size / 2, theme);
    brains = new Map(players.filter((p) => p.bot).map((p) => [p.id, new Brain(FORGET[diff])]));
    misses = 0; busy = false; started = Date.now();
    Object.assign(share, {
      phase: 'play', round: share.round + 1, size, theme, diff, players, payouts: null, open: [], turns: 0, note: '',
      cards: faces.map((_, i) => ({ face: null, owner: null, pos: i })),
      turn: players[mode === 'solo' ? 0 : Math.floor(Math.random() * players.length)].id,
    });
    payStake();
    sfx('shuffle');
    if (diff === 'easy') {
      // easy: everything face up for a moment
      busy = true;
      share.cards.forEach((c, i) => (c.face = faces[i]));
      for (const b of brains.values()) faces.forEach((f, i) => b.see(i, f));
      push(true);
      setTimeout(() => { share.cards.forEach((c) => (c.face = null)); busy = false; push(true); botTurn(); }, 2600);
    } else { push(true); botTurn(); }
  }
  /** Turn card i for player `by` (host decides whether that is allowed). */
  function flip(i: number, by: string) {
    const c = share.cards[i];
    if (share.phase !== 'play' || busy || !c || c.owner || share.open.includes(i) || share.open.length >= 2) return;
    const turnP = share.players.find((p) => p.id === share.turn);
    const allowed = by === share.turn || (by === room.myId && (turnP?.local || false));
    if (!allowed) return;
    c.face = faces[i];
    share.open.push(i);
    for (const b of brains.values()) b.see(i, faces[i]);
    sfx('card');
    push(true);
    if (share.open.length === 2) { busy = true; const rd = share.round; setTimeout(() => { if (share.round === rd && share.phase === 'play') resolve(); }, 950); }
  }
  function resolve() {
    const [a, b] = share.open;
    const me = share.players.find((p) => p.id === share.turn)!;
    share.turns++;
    if (faces[a] === faces[b]) {
      share.cards[a].owner = share.cards[b].owner = me.id;
      me.pairs++;
      for (const br of brains.values()) { br.drop(a); br.drop(b); }
      share.note = 'pair';
      sfx('gem');
    } else {
      share.cards[a].face = share.cards[b].face = null;
      misses++;
      share.note = '';
      // hard: every second miss two hidden cards change places, in plain sight
      if (share.diff === 'hard' && misses % 2 === 0) swapTwo();
      if (mode === 'duel') nextTurn();
    }
    share.open = [];
    busy = false;
    if (share.cards.every((c) => c.owner)) finish();
    push(true);
    botTurn();
  }
  function swapTwo() {
    const hidden = share.cards.map((c, i) => i).filter((i) => !share.cards[i].owner);
    if (hidden.length < 4) return;
    const x = hidden[Math.floor(Math.random() * hidden.length)];
    let y = x;
    while (y === x) y = hidden[Math.floor(Math.random() * hidden.length)];
    [share.cards[x].pos, share.cards[y].pos] = [share.cards[y].pos, share.cards[x].pos];
    for (const br of brains.values()) br.blur(x, y);
    share.note = 'swap';
    sfx('shuffle');
  }
  function nextTurn() {
    const ids = share.players.map((p) => p.id);
    share.turn = ids[(ids.indexOf(share.turn) + 1) % ids.length];
  }
  function botTurn() {
    const p = share.players.find((x) => x.id === share.turn);
    if (share.phase !== 'play' || !p?.bot) return;
    const brain = brains.get(p.id)!, rd = share.round;
    setTimeout(() => {
      if (share.phase !== 'play' || share.round !== rd || share.turn !== p.id || busy) return;
      const open = share.cards.map((c, i) => i).filter((i) => !share.cards[i].owner);
      const a = brain.first(open);
      flip(a, p.id);
      setTimeout(() => { if (share.turn === p.id && share.open.length === 1) flip(brain.second(open, a, faces[a]), p.id); }, 700);
    }, 800);
  }
  function finish() {
    share.phase = 'end';
    if (mode === 'solo') {
      const pairs = share.size / 2, m = soloMult(share.turns, pairs, share.size, share.diff);
      const me = share.players[0];
      share.payouts = { [me.id]: Math.round(me.stake * m * 100) / 100 };
      const key = `${share.size}-${share.diff}`;
      if (!best[key] || share.turns < best[key]) best = { ...best, [key]: share.turns };
    } else {
      const r = ranks(share.players.map((p) => ({ id: p.id, score: p.pairs })));
      share.payouts = sidePots(share.players.map((p) => ({ id: p.id, stake: p.stake, rank: r[p.id] })));
    }
    afterState();
  }

  // ---------- my money (every client for itself) ----------
  let paidRound = -1, settledRound = -1;
  function payStake() {
    const me = share.players.find((p) => p.id === room.myId);
    if (paidRound === share.round || !me) return;
    paidRound = share.round;
    if (me.stake > 0) takeStake(me.stake);
  }
  function afterState() {
    if (share.phase === 'play') payStake();
    if (share.phase === 'end' && share.payouts && settledRound !== share.round && paidRound === share.round) {
      settledRound = share.round;
      const back = share.payouts[room.myId] ?? 0;
      settle(back, back);
      const me = share.players.find((p) => p.id === room.myId);
      sfx(back > (me?.stake ?? 0) ? 'win' : back > 0 ? 'cash' : 'lose');
    }
  }

  function click(i: number) {
    if (room.role === 'guest') room.send({ t: 'flip', i });
    else flip(i, room.myId);
  }
  /** A free solo game may be left any time; a paid one or a duel runs to the end. */
  const locked = $derived(share.phase === 'play' && (mode === 'duel' || (share.players[0]?.stake ?? 0) > 0));
  function setMode(m: 'solo' | 'duel') {
    if (locked || (m === 'solo' && room.role !== 'solo')) return;
    mode = m;
    busy = false;
    Object.assign(share, { phase: 'lobby', round: share.round + 1, cards: [], open: [], payouts: null }); // a new round number stops old timers
  }
  onDestroy(() => room.leave());

  const turnName = $derived(share.players.find((p) => p.id === share.turn)?.name ?? '');
  const myTurn = $derived(share.turn === room.myId || (isHost && share.players.find((p) => p.id === share.turn)?.local));
  const COLORS = ['#f3d488', '#6aa8ff', '#ff8a8d', '#7ff0b2', '#c9a2ff', '#ffb36b', '#9be8ff'];
  const colorOf = (id: string | null) => COLORS[Math.max(0, share.players.findIndex((p) => p.id === id)) % COLORS.length];
  const pairsLeft = $derived(share.cards.filter((c) => !c.owner).length / 2);
  const seats = $derived(lobby.map((p) => ({ ...p, score: share.phase === 'lobby' ? undefined : p.pairs })));
</script>

<section class="mm">
  <header class="head">
    <div class="h1row"><h1>Memory</h1><span class="eyebrow">{share.size} {L('Karten', 'cards')} · {({ easy: L('Leicht', 'Easy'), normal: 'Normal', hard: L('Schwer', 'Hard') })[share.phase === 'lobby' ? diff : share.diff]}</span><HowTo id="memory" /></div>
    <div class="tabs" role="tablist">
      <button role="tab" aria-selected={mode === 'solo'} class:on={mode === 'solo'} disabled={room.role !== 'solo' || locked} onclick={() => setMode('solo')}>Solo</button>
      <button role="tab" aria-selected={mode === 'duel'} class:on={mode === 'duel'} disabled={locked} onclick={() => setMode('duel')}>👥 {L('Duell', 'Duel')}</button>
    </div>
    <div class="right">{#if mode === 'duel'}<RoomBar {room} />{/if}</div>
  </header>

  <div class="layout">
    <aside class="panel">
      {#if share.phase !== 'play' || (mode === 'solo' && !locked)}
        {#if isHost}
          <div class="field">{L('Motive', 'Pictures')}
            <div class="themes">
              {#each [['symbols', L('Symbole', 'Symbols'), 11], ['cards', L('Karten', 'Cards'), 13], ['jass', 'Jass', 17], ['arcade', 'Arcade', 9]] as [th, lb, f]}
                <button class:on={theme === th} onclick={() => (theme = th as Theme)}><span class="mini"><MemoryFace theme={th as Theme} face={f as number} /></span>{lb}</button>
              {/each}
            </div>
          </div>
          <div class="field">{L('Grösse', 'Size')}<div class="seg">{#each SIZES as s}<button class:on={size === s.n} onclick={() => (size = s.n)}>{s.n}</button>{/each}</div></div>
          <div class="field">{L('Schwierigkeit', 'Difficulty')}
            <div class="seg">{#each [['easy', L('Leicht', 'Easy')], ['normal', 'Normal'], ['hard', L('Schwer', 'Hard')]] as [d, lb]}<button class:on={diff === d} onclick={() => (diff = d as Diff)}>{lb}</button>{/each}</div>
            <small class="muted">{diff === 'easy' ? L('Am Anfang liegen alle Karten kurz offen.', 'All cards are shown briefly at the start.') : diff === 'hard' ? L('Nach jedem zweiten Fehlgriff tauschen zwei verdeckte Karten den Platz.', 'After every second miss two hidden cards swap places.') : L('Klassisch.', 'Classic.')}</small>
          </div>
        {/if}
        {#if mode === 'solo'}
          <label class="switch"><span>{L('Mit Einsatz', 'With stake')}</span><input type="checkbox" bind:checked={paid} /></label>
          {#if paid}<BetInput bind:value={bet} /><small class="muted">{L('Wenige Züge pro Paar zahlen: bis ×', 'Few turns per pair pay: up to ×')}{soloMult(size / 2, size / 2, size, diff)}</small>{/if}
          <button class="btn primary big" disabled={paid && bet > wallet.balance} onclick={start}>{share.phase === 'end' ? L('Nochmal', 'Again') : L('Mischen & los', 'Shuffle & go')}</button>
        {:else}
          <div class="field">{L('Dein Einsatz im Topf', 'Your stake in the pot')}<BetInput bind:value={bet} /></div>
          {#if isHost}
            <div class="field">Bots<div class="seg">{#each [0, 1, 2, 3] as k}<button class:on={botCount === k} onclick={() => (botCount = k)}>{k}</button>{/each}</div></div>
            <div class="row2">
              <button class="btn" disabled={locals.length >= 3} onclick={() => (locals = [...locals, L('Spieler', 'Player') + ' ' + (locals.length + 2)])}>+ {L('Am Gerät', 'This device')}</button>
              <button class="btn ghost" disabled={!locals.length} onclick={() => (locals = locals.slice(0, -1))}>−</button>
            </div>
            <button class="btn primary big" disabled={lobby.length < 2 || bet > wallet.balance} onclick={start}>{lobby.length < 2 ? L('Mitspieler dazunehmen', 'Add players') : share.phase === 'end' ? L('Neue Runde', 'New round') : 'Start'}</button>
          {:else}<p class="muted small">{L('Der Gastgeber startet die Runde.', 'The host starts the round.')}</p>{/if}
        {/if}
      {:else}
        <div class="status">
          {#if mode === 'solo'}
            <span><small>{L('Züge', 'Turns')}</small><b class="mono">{share.turns}</b></span>
            <span><small>{L('Paare übrig', 'Pairs left')}</small><b class="mono">{pairsLeft}</b></span>
            {#if share.players[0]?.stake}<span><small>{L('Jetzt', 'Now')}</small><b class="mono gold">×{soloMult(share.turns + pairsLeft, share.size / 2, share.size, share.diff)}</b></span>{/if}
          {:else}
            <span class="turn" class:mine={myTurn}>{myTurn ? L('Du bist dran', 'Your turn') : L(`${turnName} ist dran`, `${turnName}'s turn`)}</span>
          {/if}
        </div>
      {/if}
      {#if mode === 'duel' || share.players.length > 1}
        <PotSeats seats={seats} me={room.myId} turn={share.phase === 'play' ? share.turn : ''} payouts={share.phase === 'end' ? share.payouts : null} />
      {/if}
    </aside>

    <div class="felt">
      {#if share.cards.length}
        <div class="board" style="--cols:{cols}; --rows:{share.size / cols}">
          {#each share.cards as c, i (i)}
            {@const up = c.face !== null}
            <button class="card" class:up class:taken={!!c.owner} class:hint={share.phase === 'play' && !up && !c.owner && (myTurn || room.role !== 'guest' && mode === 'solo')}
              style="--c:{c.pos % cols}; --r:{Math.floor(c.pos / cols)}; --own:{colorOf(c.owner)}" onclick={() => click(i)} disabled={up || !!c.owner || share.phase !== 'play'}
              aria-label={up ? L('Offene Karte', 'Open card') : L('Verdeckte Karte', 'Hidden card')}>
              <span class="inner">
                <span class="back"><span class="logo"></span></span>
                <span class="front">{#if c.face !== null}<MemoryFace theme={share.theme} face={c.face} />{/if}</span>
              </span>
            </button>
          {/each}
        </div>
        <div class="note">
          {#if share.phase === 'end'}
            {@const back = share.payouts?.[room.myId] ?? 0}
            {@const mine = share.players.find((p) => p.id === room.myId)}
            <strong in:fly={{ y: 8 }}>{mode === 'solo' ? L(`Geschafft in ${share.turns} Zügen`, `Cleared in ${share.turns} turns`) : (ranks(share.players.map((p) => ({ id: p.id, score: p.pairs })))[room.myId] === 1 ? L('Gewonnen!', 'You win!') : L('Vorbei', 'Game over'))}</strong>
            {#if mine?.stake}<span class="mono" class:pos={back > mine.stake}>{back > mine.stake ? '+' + fmt(back - mine.stake) : back > 0 ? L('zurück', 'back') + ' ' + fmt(back) : '−' + fmt(mine.stake)}</span>{/if}
            {#if mode === 'solo'}<small class="muted">{L('Rekord', 'Best')}: {best[`${share.size}-${share.diff}`] ?? '–'} {L('Züge', 'turns')}</small>{/if}
          {:else if share.note === 'pair'}<span in:fly={{ y: 6 }}>✨ {L('Paar! Nochmal', 'Pair! Go again')}</span>
          {:else if share.note === 'swap'}<span in:fly={{ y: 6 }}>🔀 {L('Zwei Karten haben getauscht', 'Two cards swapped')}</span>{/if}
        </div>
      {:else}
        <div class="empty">
          <div class="fan">{#each [11, 3, 19, 7] as f, i}<span class="card up demo" style="--i:{i}"><span class="inner"><span class="front"><MemoryFace {theme} face={f} /></span></span></span>{/each}</div>
          <p class="muted">{mode === 'solo' ? L('Finde alle Paare in möglichst wenigen Zügen.', 'Find all pairs in as few turns as possible.') : L('Abwechselnd zwei Karten aufdecken. Wer ein Paar findet, ist nochmal dran.', 'Take turns flipping two cards. Find a pair and you go again.')}</p>
        </div>
      {/if}
    </div>
  </div>
</section>

<style>
  .mm { width: min(100%, 1280px); margin-inline: auto; padding: 0 20px 48px; display: grid; gap: 14px; }
  .head { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px 16px; padding: 12px 4px 0; min-height: 64px; }
  .right { display: flex; justify-content: flex-end; min-width: 0; }
  @media (max-width: 1100px) { .head { grid-template-columns: 1fr auto; } .right { grid-column: 1 / -1; justify-content: flex-start; } .right:empty { display: none; } }
  @media (max-width: 640px) { .head { grid-template-columns: 1fr; } .tabs { justify-self: start; } }
  .h1row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  h1 { margin: 0; font-size: clamp(1.7rem, 3vw, 2.4rem); letter-spacing: -0.04em; line-height: 1; }
  .tabs { display: flex; gap: 4px; padding: 4px; border-radius: 999px; background: var(--surface); box-shadow: inset 0 0 0 1px var(--line-2); }
  .tabs button { border: 0; background: none; color: var(--muted); min-height: 36px; padding: 0 18px; border-radius: 999px; font-weight: 600; transition: background 0.3s var(--ease-snap), color 0.3s var(--ease-snap); }
  .tabs button.on { background: linear-gradient(180deg, #f3d488, #c9973f); color: #2a1604; }
  .muted { color: var(--muted); } .small { font-size: 0.82rem; } .pos { color: #6ff0a6; } .gold { color: var(--gold); }

  .layout { display: grid; grid-template-columns: 300px 1fr; gap: 18px; align-items: start; }
  @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } .panel { order: 2; } }
  .panel { display: grid; gap: 14px; padding: 16px; border-radius: 24px; background: var(--surface); box-shadow: inset 0 0 0 1px var(--line); }
  .field { display: grid; gap: 6px; font-size: 0.85rem; }
  .field small { font-size: 0.74rem; }
  .seg { display: flex; border: 1px solid var(--line-2); border-radius: 999px; padding: 3px; gap: 3px; }
  .seg button { flex: 1; border: 0; background: none; min-height: 34px; border-radius: 999px; color: var(--muted); font-size: 0.82rem; font-weight: 600; transition: background 0.3s var(--ease-snap), color 0.3s var(--ease-snap); }
  .seg button.on { background: var(--text); color: var(--bg); }
  .themes { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .themes button { display: grid; justify-items: center; gap: 4px; padding: 6px 2px 8px; border-radius: 12px; border: 1px solid var(--line-2); background: none; color: var(--muted); font-size: 0.7rem; transition: border-color 0.3s var(--ease-snap), transform 0.16s var(--ease-snap); }
  .themes button:active { transform: scale(0.97); }
  .themes button.on { border-color: var(--gold); color: var(--text); background: color-mix(in srgb, var(--gold) 12%, transparent); }
  .mini { width: 44px; height: 58px; border-radius: 7px; background: #fbf6e8; overflow: hidden; }
  .row2 { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
  .big { min-height: 50px; width: 100%; }
  .status { display: flex; gap: 8px; flex-wrap: wrap; }
  .status span { display: grid; padding: 6px 12px; border-radius: 12px; background: var(--surface-2); }
  .status small { font-size: 0.66rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  .status b { font-size: 1.2rem; }
  .status .turn { font-weight: 700; padding: 10px 14px; }
  .status .turn.mine { background: color-mix(in srgb, var(--gold) 25%, transparent); color: var(--text); animation: nudge 1.6s var(--spring-snappy) infinite; }
  @keyframes nudge { 0%, 70% { transform: none; } 80% { transform: translateY(-2px); } }

  .felt {
    min-height: 420px; display: grid; gap: 12px; align-content: center; justify-items: center; padding: clamp(14px, 2.6vw, 30px); border-radius: 30px;
    background: repeating-conic-gradient(from 45deg, rgba(255,255,255,.02) 0 25%, transparent 0 50%) 0 0 / 26px 26px, radial-gradient(ellipse at 50% 30%, #1c4d3a, #0a2219 80%);
    box-shadow: inset 0 0 0 10px #3b1f10, inset 0 0 0 12px rgba(216,178,106,.6), inset 0 30px 80px rgba(0,0,0,.35);
  }
  .board {
    --gap: clamp(6px, 1.2vw, 12px);
    position: relative; width: min(100%, calc(var(--cols) * 104px)); aspect-ratio: calc(var(--cols) * 3) / calc(var(--rows) * 4);
  }
  .card {
    --w: calc((100% - var(--gap) * (var(--cols) - 1)) / var(--cols));
    position: absolute; left: 0; top: 0; width: var(--w); height: calc((100% - var(--gap) * (var(--rows) - 1)) / var(--rows));
    transform: translate(calc(var(--c) * (100% + var(--gap))), calc(var(--r) * (100% + var(--gap))));
    padding: 0; border: 0; background: none; perspective: 700px; cursor: pointer;
    transition: transform 0.7s var(--spring-smooth);
  }
  .card:disabled { cursor: default; }
  .inner { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform 0.55s var(--spring-smooth); }
  .card.up .inner { transform: rotateY(180deg); }
  .back, .front { position: absolute; inset: 0; border-radius: 10px; backface-visibility: hidden; -webkit-backface-visibility: hidden; display: grid; place-items: center; overflow: hidden; }
  .back {
    background: repeating-linear-gradient(45deg, rgba(255,255,255,.06) 0 6px, transparent 6px 12px), linear-gradient(160deg, #8e1b22, #4e0b10);
    box-shadow: inset 0 0 0 2px rgba(232,196,120,.7), inset 0 0 0 5px rgba(0,0,0,.2), 0 6px 12px -6px rgba(0,0,0,.6);
  }
  .logo { width: 34%; aspect-ratio: 1; border-radius: 50%; border: 3px solid rgba(243,212,136,.85); box-shadow: inset 0 0 0 4px rgba(0,0,0,.2), inset 0 0 0 9px rgba(243,212,136,.85); }
  .front { transform: rotateY(180deg); background: #fbf6e8; box-shadow: inset 0 0 0 2px rgba(232,196,120,.6), 0 6px 12px -6px rgba(0,0,0,.6); }
  @media (hover: hover) and (pointer: fine) { .card.hint:hover .inner { transform: translateY(-3px); } }
  .card:active:not(:disabled) .inner { transform: scale(0.97); }
  /* found pairs: a coloured frame of the finder; no opacity on the card itself, that would flatten the 3D flip */
  .card.taken .front { box-shadow: inset 0 0 0 3px var(--own), 0 0 18px -2px var(--own); animation: found 0.6s var(--spring-snappy); }
  .card.taken .front :global(.face) { filter: saturate(0.75) brightness(0.92); transition: filter 0.5s var(--ease-snap) 0.6s; }
  @keyframes found { 40% { transform: scale(1.06); } }
  .note { min-height: 30px; display: flex; gap: 12px; align-items: baseline; color: #f2ecdc; }
  .note strong { font-size: 1.2rem; }
  .note .mono { font-size: 1.15rem; font-weight: 700; }
  .empty { display: grid; justify-items: center; gap: 16px; text-align: center; }
  .fan { display: flex; }
  .fan .card { position: relative; width: 84px; height: 112px; margin: 0 -12px; transform: rotate(calc((var(--i) - 1.5) * 9deg)) translateY(calc(var(--i) * (3 - var(--i)) * -4px)); animation: deal 0.6s var(--spring-snappy) calc(var(--i) * 90ms) backwards; }
  @keyframes deal { from { opacity: 0; transform: translateY(20px) rotate(0); } }
  @media (prefers-reduced-motion: reduce) { .inner, .card { transition-duration: 0.01s; } .fan .card, .card.taken .front, .status .turn.mine { animation: none; } }
</style>
