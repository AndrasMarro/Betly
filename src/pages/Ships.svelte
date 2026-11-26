<script lang="ts">
  // Schiffe versenken: 1 gegen 1, 2 gegen 2 or everyone for themselves (3 or 4). Against bots, or friends in a room.
  // Everybody places a fleet, then shoots in turn; a hit means another shot. Stakes go into the pot (games/pot.ts).
  // The host's browser keeps all fleets and judges every shot; the others see shots, their own and partners' ships.
  import { onDestroy, onMount, untrack } from 'svelte';
  import { fly } from 'svelte/transition';
  import HowTo from '../components/HowTo.svelte';
  import RoomBar from '../components/RoomBar.svelte';
  import BetInput from '../components/BetInput.svelte';
  import Sea from '../components/Sea.svelte';
  import PotSeats from '../components/PotSeats.svelte';
  import { Room } from '../lib/net.svelte';
  import { N, FLEET, canPlace, randomFleet, validFleet, fire as shoot, sunkAll, aim, type Ship, type Skill } from '../games/ships';
  import { sidePots } from '../games/pot';
  import { wallet, settle, stake as takeStake, fmt, settings } from '../lib/state.svelte';
  import { sfx } from '../lib/sfx';
  import { rng } from '../lib/daily';

  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
  const saved = (() => { try { return JSON.parse(localStorage.getItem('betly:ships') || '{}'); } catch { return {}; } })();
  type Mode = '1v1' | '2v2' | 'ffa';
  let mode = $state<Mode>(saved.mode ?? '1v1');
  let ffaSize = $state<number>(saved.ffa ?? 4);
  let skill = $state<Skill>(saved.skill ?? 'mid');
  let again = $state<boolean>(saved.again ?? true);
  let bet = $state(10);
  $effect(() => { const s = { mode, ffa: ffaSize, skill, again }; untrack(() => { try { localStorage.setItem('betly:ships', JSON.stringify(s)); } catch {} }); });
  const seatsFor = (m: Mode) => (m === '1v1' ? 2 : m === '2v2' ? 4 : ffaSize);

  type P = { id: string; name: string; bot?: boolean; team: number; stake: number; ready: boolean; alive: boolean; place: number; shots: string };
  const blank = '0'.repeat(N * N);
  const share = $state({
    phase: 'lobby' as 'lobby' | 'place' | 'battle' | 'end', round: 0, mode: '1v1' as Mode, again: true,
    players: [] as P[], turn: '', last: null as null | { by: string; target: string; cell: number; res: string; n: number }, payouts: null as Record<string, number> | null, until: 0,
  });
  let now = $state(Date.now());

  // ---------- host ----------
  let fleets = new Map<string, Ship[]>();
  let guests = $state<{ id: string; name: string; stake: number }[]>([]);
  const room = new Room('ships', onMsg, (id) => {
    guests = guests.filter((g) => g.id !== id);
    const p = share.players.find((x) => x.id === id);
    if (p && share.phase !== 'lobby' && share.phase !== 'end') { p.ready = true; if (p.alive) knockOut(p); if (share.turn === id) nextTurn(); }
    push(true);
  });
  const isHost = $derived(room.role !== 'guest');
  const BOT_NAMES = ['Mila', 'Jonas', 'Lea'];
  /** Humans first (as many as fit), bots fill the free seats; in 2 vs 2 the seats alternate between the teams. */
  function roster(): P[] {
    const humans = [{ id: room.myId, name: settings.name || L('Du', 'You'), stake: bet }, ...guests].slice(0, seatsFor(mode));
    const all = [...humans.map((h) => ({ ...h, bot: false })), ...BOT_NAMES.slice(0, seatsFor(mode) - humans.length).map((n, i) => ({ id: 'bot' + i, name: n, bot: true, stake: bet }))];
    return all.map((p, i) => ({ ...p, team: mode === '2v2' ? 1 + (i % 2) : 0, ready: !!p.bot, alive: true, place: 0, shots: blank }));
  }
  const lobby = $derived(share.phase === 'lobby' && isHost ? roster() : share.players);

  function onMsg(m: any, from: string) {
    if (room.role === 'guest') {
      if (m.t === 'state') { const fresh = m.s.round !== share.round && m.s.phase === 'place'; Object.assign(share, m.s); if (fresh) newFleet(); afterState(); }
      else if (m.t === 'mates') mates = m.fleets ?? {};
      else if (m.t === 'myfleet' && validFleet(m.fleet)) fleet = m.fleet; // placed at random by the host when time ran out
      return;
    }
    if (m.t === 'hello') {
      const g = { id: from, name: String(m.name || 'Guest').slice(0, 20), stake: Math.max(0, Math.min(100000, Number(m.stake) || 0)) };
      const i = guests.findIndex((x) => x.id === from);
      if (i >= 0) guests[i] = g; else guests.push(g);
      push(true);
    } else if (m.t === 'fleet' && share.phase === 'place' && validFleet(m.fleet)) {
      const p = share.players.find((x) => x.id === from);
      if (p) { fleets.set(from, m.fleet.map((s: Ship) => ({ len: +s.len, x: +s.x, y: +s.y, v: !!s.v }))); p.ready = true; maybeBattle(); push(true); }
    } else if (m.t === 'shot') shot(from, String(m.target), Number(m.cell));
  }
  let lastPush = 0;
  function push(force = false) {
    if (room.role !== 'host') return;
    if (!force && performance.now() - lastPush < 150) return;
    lastPush = performance.now();
    untrack(() => room.broadcast({ t: 'state', s: $state.snapshot(share) }));
  }
  $effect(() => { if (room.role === 'guest' && room.status === 'open') room.send({ t: 'hello', name: settings.name, stake: bet }); });
  $effect(() => { void [guests.length, bet, settings.name, mode, ffaSize]; untrack(() => { if (share.phase === 'lobby') { share.players = roster(); share.mode = mode; push(true); } }); });
  let wasGuest = false;
  $effect(() => {
    if (room.role === 'guest') wasGuest = true;
    else if (wasGuest) untrack(() => { wasGuest = false; Object.assign(share, { phase: 'lobby', players: [], payouts: null }); });
  });

  function start() {
    if (!isHost || share.phase === 'place' || share.phase === 'battle' || bet > wallet.balance) return;
    fleets = new Map();
    const players = roster();
    for (const p of players) if (p.bot) fleets.set(p.id, randomFleet());
    Object.assign(share, { phase: 'place', round: share.round + 1, mode, again, players, turn: '', last: null, payouts: null, until: Date.now() + 90_000 });
    newFleet();
    payStake();
    push(true);
    sfx('shuffle');
  }
  function maybeBattle() {
    if (share.phase !== 'place' || !share.players.every((p) => p.ready)) return;
    share.phase = 'battle';
    share.turn = share.players[Math.floor(Math.random() * share.players.length)].id;
    share.until = Date.now() + 30_000;
    // partners see each other's fleets
    if (share.mode === '2v2') for (const p of share.players) {
      const mate = share.players.find((q) => q.team === p.team && q.id !== p.id)!;
      const f = { [mate.id]: fleets.get(mate.id) };
      if (p.id === room.myId) mates = f as Record<string, Ship[]>;
      else if (!p.bot) room.sendTo(p.id, { t: 'mates', fleets: f });
    }
    sfx('chip');
    botMove();
  }
  const enemies = (id: string) => { const me = share.players.find((p) => p.id === id); return share.players.filter((p) => p.alive && p.id !== id && (share.mode !== '2v2' || p.team !== me?.team)); };
  /** A shot from `by` at `target`'s cell (host judges). */
  function shot(by: string, target: string, cell: number) {
    if (share.phase !== 'battle' || share.turn !== by || !(cell >= 0 && cell < N * N)) return;
    const t = enemies(by).find((p) => p.id === target);
    if (!t || t.shots[cell] !== '0') return;
    const arr = [...t.shots].map(Number);
    const { res } = shoot(fleets.get(t.id)!, arr, cell);
    t.shots = arr.join('');
    share.last = { by, target, cell, res, n: (share.last?.n ?? 0) + 1 };
    if (sunkAll(fleets.get(t.id)!, arr)) knockOut(t);
    if (share.phase === 'battle') {
      if (res === 'water' || !share.again || !enemies(by).length) nextTurn();
      share.until = Date.now() + 30_000;
    }
    push(true);
    botMove();
  }
  function knockOut(p: P) {
    p.alive = false;
    p.place = share.players.filter((x) => x.alive).length + 1;
    const teamsLeft = new Set(share.players.filter((x) => x.alive).map((x) => (share.mode === '2v2' ? 'T' + x.team : x.id)));
    if (teamsLeft.size <= 1) finish();
  }
  function nextTurn() {
    const ids = share.players.map((p) => p.id);
    for (let k = 1; k <= ids.length; k++) {
      const id = ids[(ids.indexOf(share.turn) + k) % ids.length];
      if (share.players.find((p) => p.id === id)?.alive) { share.turn = id; return; }
    }
  }
  function botMove() {
    const p = share.players.find((x) => x.id === share.turn);
    if (share.phase !== 'battle' || !p?.bot) return;
    const rd = share.round, n = share.last?.n;
    setTimeout(() => {
      if (share.phase !== 'battle' || share.round !== rd || share.turn !== p.id || share.last?.n !== n) return;
      // aim at the weakest enemy board (most hits), otherwise anyone
      const es = enemies(p.id);
      const t = [...es].sort((a, b) => [...b.shots].filter((c) => c === '2').length - [...a.shots].filter((c) => c === '2').length)[0];
      if (t) shot(p.id, t.id, aim([...t.shots].map(Number), skill));
    }, 850 + Math.random() * 500);
  }
  function finish() {
    share.phase = 'end';
    const win = share.players.filter((p) => p.alive);
    const rank = (p: P) => (p.alive ? 1 : share.mode === '2v2' ? (win.some((w) => w.team === p.team) ? 1 : 2) : p.place);
    share.payouts = sidePots(share.players.map((p) => ({ id: p.id, stake: p.stake, rank: rank(p) })));
    afterState();
  }
  // a turn that runs out shoots at random; placing too long places at random
  const clock = setInterval(() => {
    now = Date.now();
    if (room.role === 'guest' || !share.until || now < share.until) return;
    if (share.phase === 'place') {
      for (const p of share.players) if (!p.ready) {
        if (p.id === room.myId) { fleet = randomFleet(); ready(); }
        else { const f = randomFleet(); fleets.set(p.id, f); p.ready = true; room.sendTo(p.id, { t: 'myfleet', fleet: f }); }
      }
      maybeBattle(); push(true);
    } else if (share.phase === 'battle') {
      const t = enemies(share.turn)[0];
      if (t) shot(share.turn, t.id, aim([...t.shots].map(Number), 'easy'));
    }
  }, 500);
  onDestroy(() => { clearInterval(clock); room.leave(); });

  // ---------- my fleet and my shots ----------
  let fleet = $state<Ship[]>([]);
  let mates = $state<Record<string, Ship[]>>({});
  let holding = $state(-1); // index into FLEET of the ship in hand while placing
  let vert = $state(false);
  let hoverCell = $state(-1);
  function newFleet() { fleet = []; mates = {}; holding = 0; vert = false; }
  const placedLens = $derived(fleet.map((s) => s.len));
  const toPlace = $derived.by(() => { const left = [...FLEET]; for (const l of placedLens) left.splice(left.indexOf(l), 1); return left; });
  const preview = $derived(holding >= 0 && hoverCell >= 0 && toPlace.length ? { len: toPlace[Math.min(holding, toPlace.length - 1)], x: hoverCell % N, y: Math.floor(hoverCell / N), v: vert } : null);
  const meP = $derived(share.players.find((p) => p.id === room.myId));
  const placing = $derived(share.phase === 'place' && meP && !meP.ready);
  function placeAt(c: number) {
    if (!placing) return;
    // a click on a placed ship picks it up again
    const i = fleet.findIndex((s) => [...Array(s.len)].some((_, k) => (s.y + (s.v ? k : 0)) * N + s.x + (s.v ? 0 : k) === c));
    if (i >= 0) { fleet = fleet.filter((_, k) => k !== i); holding = 0; sfx('click'); return; }
    if (!preview || !canPlace(fleet, preview)) { sfx('stop'); return; }
    fleet = [...fleet, preview];
    holding = 0;
    sfx('chip');
  }
  function ready() {
    if (!placing || fleet.length !== FLEET.length) return;
    if (room.role === 'guest') { room.send({ t: 'fleet', fleet: $state.snapshot(fleet) }); }
    else { fleets.set(room.myId, $state.snapshot(fleet)); meP!.ready = true; maybeBattle(); push(true); }
    sfx('chip');
  }
  function fireAt(target: string, c: number) {
    if (share.turn !== room.myId) return;
    if (room.role === 'guest') room.send({ t: 'shot', target, cell: c });
    else shot(room.myId, target, c);
  }
  function key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, textarea')) return;
    if ((e.key === 'r' || e.key === 'R') && placing) { vert = !vert; e.preventDefault(); }
  }

  // ---------- money ----------
  let paidRound = -1, settledRound = -1;
  function payStake() {
    const me = share.players.find((p) => p.id === room.myId);
    if (paidRound === share.round || !me) return;
    paidRound = share.round;
    if (me.stake > 0) takeStake(me.stake);
  }
  function afterState() {
    if (share.phase === 'place' || share.phase === 'battle') payStake();
    if (share.phase === 'end' && share.payouts && settledRound !== share.round && paidRound === share.round) {
      settledRound = share.round;
      const back = share.payouts[room.myId] ?? 0, me = share.players.find((p) => p.id === room.myId);
      settle(back, back);
      sfx(back > (me?.stake ?? 0) ? 'big' : 'lose');
    }
  }
  // sounds for shots everyone sees
  let heard = 0;
  $effect(() => {
    const l = share.last;
    if (!l || l.n === heard) return;
    heard = l.n;
    untrack(() => sfx(l.res === 'water' ? 'splat' : l.res === 'sunk' ? 'big' : 'boom'));
  });
  onMount(() => { if (room.role === 'solo') share.players = roster(); });

  const demo = randomFleet(rng(7));
  const nameOf = (id: string) => share.players.find((p) => p.id === id)?.name ?? '?';
  const targets = $derived(share.phase === 'battle' || share.phase === 'end' ? share.players.filter((p) => p.id !== room.myId && (share.mode !== '2v2' || p.team !== meP?.team)) : []);
  const mate = $derived(share.mode === '2v2' ? share.players.find((p) => p.team === meP?.team && p.id !== room.myId) : undefined);
  const myTurn = $derived(share.phase === 'battle' && share.turn === room.myId);
  const left = $derived(Math.max(0, Math.ceil((share.until - now) / 1000)));
  const seats = $derived(lobby.map((p) => ({ ...p, out: share.phase !== 'lobby' && !p.alive, score: share.phase === 'battle' || share.phase === 'end' ? (p.alive ? '⚓' : `${p.place}.`) : share.phase === 'place' ? (p.ready ? '✓' : '…') : undefined })));
  const cellBig = $derived(targets.length > 2 ? 23 : targets.length > 1 ? 27 : 34);
  const won = $derived(share.phase === 'end' && (!!meP?.alive || (share.mode === '2v2' && share.players.some((p) => p.alive && p.team === meP?.team))));
</script>

<svelte:window onkeydown={key} />

<section class="sv">
  <header class="head">
    <div class="h1row"><h1>{L('Schiffe versenken', 'Battleships')}</h1><span class="eyebrow">{({ '1v1': '1 vs 1', '2v2': '2 vs 2', ffa: L(`Jeder gegen jeden · ${share.phase === 'lobby' ? ffaSize : share.players.length}`, `Free for all · ${share.phase === 'lobby' ? ffaSize : share.players.length}`) })[share.phase === 'lobby' ? mode : share.mode]}</span><HowTo id="ships" /></div>
    <div class="tabs" role="tablist">
      {#each [['1v1', '1 vs 1'], ['2v2', '2 vs 2'], ['ffa', L('Alle', 'FFA')]] as [m, lb]}
        <button role="tab" aria-selected={mode === m} class:on={(share.phase === 'lobby' ? mode : share.mode) === m} disabled={!isHost || (share.phase !== 'lobby' && share.phase !== 'end')} onclick={() => { mode = m as Mode; if (share.phase === 'end') share.phase = 'lobby'; }}>{lb}</button>
      {/each}
    </div>
    <div class="right"><RoomBar {room} /></div>
  </header>

  <div class="layout">
    <aside class="panel">
      {#if share.phase === 'lobby' || share.phase === 'end'}
        <div class="field">{L('Dein Einsatz im Topf', 'Your stake in the pot')}<BetInput bind:value={bet} /></div>
        {#if isHost}
          {#if mode === 'ffa'}<div class="field">{L('Spieler', 'Players')}<div class="seg">{#each [3, 4] as k}<button class:on={ffaSize === k} onclick={() => (ffaSize = k)}>{k}</button>{/each}</div></div>{/if}
          <div class="field">{L('Bots', 'Bots')}<div class="seg">{#each [['easy', L('Leicht', 'Easy')], ['mid', L('Mittel', 'Medium')], ['hard', L('Schwer', 'Hard')]] as [s, lb]}<button class:on={skill === s} onclick={() => (skill = s as Skill)}>{lb}</button>{/each}</div></div>
          <label class="switch"><span>{L('Treffer = nochmal schiessen', 'Hit = shoot again')}</span><input type="checkbox" bind:checked={again} /></label>
          <button class="btn primary big" disabled={bet > wallet.balance} onclick={start}>{share.phase === 'end' ? L('Neue Runde', 'New round') : L('Flotten setzen', 'Place fleets')}</button>
          <small class="muted">{L('Freie Plätze übernehmen Bots. Freunde: oben «Raum öffnen» und den Code teilen.', 'Bots take free seats. Friends: "Open room" at the top and share the code.')}</small>
        {:else}<p class="muted small">{L('Der Gastgeber startet die Runde.', 'The host starts the round.')}</p>{/if}
      {:else if share.phase === 'place'}
        <div class="status"><b>{placing ? L('Setz deine Flotte', 'Place your fleet') : L('Warten auf die anderen …', 'Waiting for the others …')}</b><span class="mono">{left}s</span></div>
        {#if placing}
          <div class="dock">
            {#each toPlace as len, i}<button class="shipbtn" class:on={holding === i} onclick={() => (holding = i)} style="--len:{len}" aria-label={len + ''}><i></i></button>{/each}
            {#if !toPlace.length}<span class="muted small">{L('Alle Schiffe gesetzt.', 'All ships placed.')}</span>{/if}
          </div>
          <div class="row3">
            <button class="btn" onclick={() => (vert = !vert)}>⟳ {vert ? L('Senkrecht', 'Vertical') : L('Waagrecht', 'Horizontal')} <kbd>R</kbd></button>
            <button class="btn" onclick={() => { fleet = randomFleet(); sfx('shuffle'); }}>🎲 {L('Zufällig', 'Random')}</button>
          </div>
          <button class="btn primary big" disabled={fleet.length !== FLEET.length} onclick={ready}>{L('Bereit', 'Ready')}</button>
          <small class="muted">{L('Schiffe dürfen sich nicht berühren, auch nicht an den Ecken. Ein Klick auf ein gesetztes Schiff nimmt es wieder auf.', 'Ships may not touch, not even at the corners. Click a placed ship to pick it up again.')}</small>
        {/if}
      {:else}
        <div class="status turn" class:mine={myTurn}>
          <b>{myTurn ? L('Feuer frei!', 'Fire away!') : L(`${nameOf(share.turn)} zielt …`, `${nameOf(share.turn)} is aiming …`)}</b><span class="mono">{left}s</span>
        </div>
        {#if share.last}
          {#key share.last.n}
            <p class="log" in:fly={{ y: -6 }}>
              <b>{share.last.by === room.myId ? L('Du', 'You') : nameOf(share.last.by)}</b> → {share.last.target === room.myId ? L('dich', 'you') : nameOf(share.last.target)}
              <span class="mono">{'ABCDEFGHIJ'[share.last.cell % N]}{Math.floor(share.last.cell / N) + 1}</span>
              <span class="res {share.last.res}">{({ water: L('Wasser', 'Splash'), hit: L('Treffer!', 'Hit!'), sunk: L('Versenkt!', 'Sunk!') } as Record<string, string>)[share.last.res]}</span>
            </p>
          {/key}
        {/if}
      {/if}
      <PotSeats {seats} me={room.myId} turn={share.phase === 'battle' ? share.turn : ''} payouts={share.phase === 'end' ? share.payouts : null} />
    </aside>

    <div class="ocean">
      {#if share.phase === 'lobby'}
        <div class="intro">
          <Sea ships={demo} cell={28} />
          <p class="muted">{L('Versenke alle Schiffe der Gegner, bevor sie deine finden.', 'Sink all enemy ships before they find yours.')}</p>
        </div>
      {:else if share.phase === 'place'}
        <div class="placing">
          <Sea ships={fleet} preview={placing ? preview : null} previewOk={!!preview && canPlace(fleet, preview)} hover={placing ? (c) => (hoverCell = c) : undefined} pick={placing ? placeAt : undefined} cell={36} label={L('Deine Flotte', 'Your fleet')} />
        </div>
      {:else}
        <div class="battle">
          <div class="foes" class:many={targets.length > 1}>
            {#each targets as t (t.id)}
              <div class="board" class:target={myTurn && t.alive} class:out={!t.alive}>
                <div class="bh"><span class="av" class:t1={t.team === 1} class:t2={t.team === 2}>{t.bot ? '🤖' : t.name.slice(0, 1)}</span>{t.name}{#if !t.alive}<em>{L('versenkt', 'sunk')}</em>{/if}{#if share.turn === t.id}<em class="aim">🎯</em>{/if}</div>
                <Sea shots={t.shots} cell={cellBig} fire={myTurn && t.alive ? (c) => fireAt(t.id, c) : undefined} last={share.last?.target === t.id ? share.last.cell : -1} dim={!t.alive} />
              </div>
            {/each}
          </div>
          <div class="mine">
            <div class="board small" class:hit={share.last?.target === room.myId && share.last.res !== 'water'}>
              {#key share.last?.n}<div class="bh">{L('Deine Flotte', 'Your fleet')}{#if meP && !meP.alive}<em>{L('versenkt', 'sunk')}</em>{/if}</div>{/key}
              <Sea shots={meP?.shots ?? blank} ships={fleet} cell={22} last={share.last?.target === room.myId ? share.last.cell : -1} />
            </div>
            {#if mate}
              <div class="board small">
                <div class="bh">{L('Partner', 'Partner')}: {mate.name}</div>
                <Sea shots={mate.shots} ships={mates[mate.id] ?? []} cell={22} last={share.last?.target === mate.id ? share.last.cell : -1} dim={!mate.alive} />
              </div>
            {/if}
          </div>
          {#if share.phase === 'end'}
            <div class="over" in:fly={{ y: 12 }}>
              <strong>{won ? L('Sieg! Alle Gegner versenkt.', 'Victory! All enemies sunk.') : L('Deine Flotte liegt am Grund.', 'Your fleet is at the bottom.')}</strong>
              {#if meP?.stake}{@const net = (share.payouts?.[room.myId] ?? 0) - meP.stake}<span class="mono" class:pos={net > 0} class:neg={net < 0}>{net > 0 ? '+' : ''}{fmt(net)}</span>{/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</section>

<style>
  .sv { width: min(100%, 1320px); margin-inline: auto; padding: 0 20px 48px; display: grid; gap: 14px; }
  .head { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px 16px; padding: 12px 4px 0; min-height: 64px; }
  .right { display: flex; justify-content: flex-end; min-width: 0; }
  @media (max-width: 1100px) { .head { grid-template-columns: 1fr auto; } .right { grid-column: 1 / -1; justify-content: flex-start; } }
  @media (max-width: 640px) { .head { grid-template-columns: 1fr; } .tabs { justify-self: start; } }
  .h1row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  h1 { margin: 0; font-size: clamp(1.7rem, 3vw, 2.4rem); letter-spacing: -0.04em; line-height: 1; }
  .tabs { display: flex; gap: 4px; padding: 4px; border-radius: 999px; background: var(--surface); box-shadow: inset 0 0 0 1px var(--line-2); }
  .tabs button { border: 0; background: none; color: var(--muted); min-height: 36px; padding: 0 16px; border-radius: 999px; font-weight: 600; transition: background 0.3s var(--ease-snap), color 0.3s var(--ease-snap); }
  .tabs button.on { background: linear-gradient(180deg, #f3d488, #c9973f); color: #2a1604; }
  .muted { color: var(--muted); } .small { font-size: 0.82rem; } .pos { color: #6ff0a6; } .neg { color: #ff9a9d; }

  .layout { display: grid; grid-template-columns: 310px 1fr; gap: 18px; align-items: start; }
  @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } .panel { order: 2; } }
  .panel { display: grid; gap: 14px; padding: 16px; border-radius: 24px; background: var(--surface); box-shadow: inset 0 0 0 1px var(--line); }
  .field { display: grid; gap: 6px; font-size: 0.85rem; }
  .seg { display: flex; border: 1px solid var(--line-2); border-radius: 999px; padding: 3px; gap: 3px; }
  .seg button { flex: 1; border: 0; background: none; min-height: 34px; border-radius: 999px; color: var(--muted); font-size: 0.82rem; font-weight: 600; transition: background 0.3s var(--ease-snap), color 0.3s var(--ease-snap); }
  .seg button.on { background: var(--text); color: var(--bg); }
  .big { min-height: 50px; width: 100%; }
  .row3 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  kbd { font: 600 0.65rem 'Geist Mono Variable', monospace; padding: 1px 5px; border-radius: 4px; background: var(--surface-2); margin-left: 4px; }
  .status { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-radius: 14px; background: var(--surface-2); }
  .status.turn.mine { background: color-mix(in srgb, #ff8a2a 22%, transparent); box-shadow: inset 0 0 0 1px rgba(255,138,42,.6); }
  .log { margin: 0; padding: 8px 12px; border-radius: 12px; background: var(--surface-2); font-size: 0.88rem; display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; }
  .res { font-weight: 700; } .res.water { color: #9fd3ff; } .res.hit { color: #ffb36b; } .res.sunk { color: #ff8a8d; }
  .dock { display: flex; flex-direction: column; gap: 6px; }
  .shipbtn { display: flex; align-items: center; padding: 6px 8px; border-radius: 10px; border: 1px solid var(--line-2); background: none; transition: border-color 0.3s var(--ease-snap), transform 0.16s var(--ease-snap); }
  .shipbtn:active { transform: scale(0.97); }
  .shipbtn.on { border-color: #7ff0b2; background: rgba(127,240,178,.1); }
  .shipbtn i { width: calc(var(--len) * 26px); height: 18px; border-radius: 40% 12% 12% 40% / 50%; background: linear-gradient(180deg, #c3ccd8, #7d8796 55%, #555e6c); }

  .ocean {
    min-height: 480px; display: grid; place-items: center; padding: clamp(14px, 2.6vw, 30px); border-radius: 30px; color: #e9f4ff;
    background: radial-gradient(ellipse at 50% 0%, #133a5e, #061527 80%); box-shadow: inset 0 0 0 1px rgba(150,210,255,.2), 0 30px 60px -30px rgba(0,0,0,.7);
  }
  .intro, .placing { display: grid; justify-items: center; gap: 14px; text-align: center; animation: rise 0.55s var(--spring-snappy); }
  @keyframes rise { from { opacity: 0; transform: translateY(14px); } }
  .battle { position: relative; display: grid; gap: 22px; justify-items: center; width: 100%; }
  .foes { display: flex; flex-wrap: wrap; gap: 18px; justify-content: center; }
  .mine { display: flex; flex-wrap: wrap; gap: 18px; justify-content: center; }
  .board { display: grid; gap: 6px; padding: 10px; border-radius: 18px; background: rgba(0,0,0,.18); transition: box-shadow 0.3s var(--ease-snap), opacity 0.3s var(--ease-snap); animation: rise 0.55s var(--spring-snappy); }
  .board.target { box-shadow: inset 0 0 0 2px rgba(255,138,42,.7), 0 0 30px -8px rgba(255,138,42,.6); }
  .board.out { opacity: 0.55; }
  .board.small.hit { animation: shake 0.45s var(--ease-snap); }
  @keyframes shake { 20%, 60% { transform: translateX(-5px); } 40%, 80% { transform: translateX(5px); } }
  .bh { display: flex; align-items: center; gap: 8px; font-size: 0.88rem; font-weight: 600; }
  .bh em { font-style: normal; font-weight: 500; color: #ff9a9d; font-size: 0.78rem; }
  .bh em.aim { color: inherit; }
  .av { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: #e8c478; color: #2a1c05; font-size: 0.75rem; }
  .av.t1 { box-shadow: 0 0 0 2px #3d7cf0; } .av.t2 { box-shadow: 0 0 0 2px #e5484d; }
  .over { display: flex; gap: 14px; align-items: baseline; padding: 12px 18px; border-radius: 16px; background: rgba(0,0,0,.35); box-shadow: inset 0 0 0 1px rgba(232,196,120,.35); }
  .over strong { font-size: 1.15rem; }
  .over .mono { font-size: 1.2rem; font-weight: 700; }
  @media (max-width: 560px) {
    .sv { padding: 0 8px 30px; }
    .ocean { padding: 10px; }
    .placing :global(.sea) { --cell: calc((100vw - 70px) / 10.6) !important; }
    .foes :global(.sea) { --cell: calc((100vw - 80px) / 10.6) !important; }
    .foes.many :global(.sea) { --cell: calc((100vw - 80px) / 10.6) !important; }
  }
  @media (prefers-reduced-motion: reduce) { .intro, .placing, .board, .board.small.hit { animation: none; } }
</style>
