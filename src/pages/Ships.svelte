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
  import Warship from '../components/Warship.svelte';
  import { N, FLEET, ARSENAL, canPlace, randomFleet, validFleet, fire as shoot, bomb, sonar, peil, canDive, layMines, withKinds, open as shootable, sunkAll, aim, cellsOf, type Ship, type Skill, type Weapon, type Intel, type Ammo } from '../games/ships';
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
  type Variant = 'classic' | 'arcade';
  let variant = $state<Variant>(saved.variant ?? 'classic');
  let touch = $state<boolean>(saved.touch ?? false);
  let bet = $state(10);
  $effect(() => { const s = { mode, ffa: ffaSize, skill, again, variant, touch }; untrack(() => { try { localStorage.setItem('betly:ships', JSON.stringify(s)); } catch {} }); });
  const seatsFor = (m: Mode) => (m === '1v1' ? 2 : m === '2v2' ? 4 : ffaSize);

  type P = { id: string; name: string; bot?: boolean; team: number; stake: number; ready: boolean; alive: boolean; place: number; shots: string;
    wrecks: Ship[]; intel: Intel[]; ammo: Ammo; skip: number };
  const blank = '0'.repeat(N * N);
  const share = $state({
    phase: 'lobby' as 'lobby' | 'place' | 'battle' | 'end', round: 0, mode: '1v1' as Mode, again: true, variant: 'classic' as Variant, touch: false,
    players: [] as P[], turn: '', last: null as null | { by: string; target: string; cell: number; res: string; n: number }, payouts: null as Record<string, number> | null, until: 0,
  });
  let now = $state(Date.now());

  // ---------- host ----------
  let fleets = new Map<string, Ship[]>();
  let minesOf = new Map<string, number[]>();
  const arcade = $derived(share.variant === 'arcade');
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
    return all.map((p, i) => ({ ...p, team: mode === '2v2' ? 1 + (i % 2) : 0, ready: !!p.bot, alive: true, place: 0, shots: blank, wrecks: [], intel: [], ammo: { ...ARSENAL }, skip: 0 }));
  }
  const lobby = $derived(share.phase === 'lobby' && isHost ? roster() : share.players);

  function onMsg(m: any, from: string) {
    if (room.role === 'guest') {
      if (m.t === 'state') { const fresh = m.s.round !== share.round && m.s.phase === 'place'; Object.assign(share, m.s); if (fresh) newFleet(); afterState(); }
      else if (m.t === 'mates') mates = m.fleets ?? {};
      else if (m.t === 'myfleet' && validFleet(m.fleet, share.touch)) fleet = m.fleet; // placed at random when time ran out, or after a dive
      else if (m.t === 'mines' && Array.isArray(m.mines)) myMines = m.mines.map(Number);
      return;
    }
    if (m.t === 'hello') {
      const g = { id: from, name: String(m.name || 'Guest').slice(0, 20), stake: Math.max(0, Math.min(100000, Number(m.stake) || 0)) };
      const i = guests.findIndex((x) => x.id === from);
      if (i >= 0) guests[i] = g; else guests.push(g);
      push(true);
    } else if (m.t === 'fleet' && share.phase === 'place' && validFleet(m.fleet, share.touch)) {
      const p = share.players.find((x) => x.id === from);
      if (p) { fleets.set(from, withKinds(m.fleet.map((s: Ship) => ({ len: +s.len, x: +s.x, y: +s.y, v: !!s.v })), arcade)); p.ready = true; maybeBattle(); push(true); }
    } else if (m.t === 'shot') shot(from, String(m.target), Number(m.cell), (['shot', 'bomb', 'sonar', 'peil'].includes(m.w) ? m.w : 'shot') as Weapon);
    else if (m.t === 'dive' && m.to) dive(from, { len: +m.to.len, x: +m.to.x, y: +m.to.y, v: !!m.to.v });
  }
  let lastPush = 0;
  function push(force = false) {
    if (room.role !== 'host') return;
    if (!force && performance.now() - lastPush < 150) return;
    lastPush = performance.now();
    untrack(() => room.broadcast({ t: 'state', s: $state.snapshot(share) }));
  }
  $effect(() => { if (room.role === 'guest' && room.status === 'open') room.send({ t: 'hello', name: settings.name, stake: bet }); });
  $effect(() => { void [guests.length, bet, settings.name, mode, ffaSize, variant, touch]; untrack(() => { if (share.phase === 'lobby') { share.players = roster(); share.mode = mode; share.variant = variant; share.touch = touch; push(true); } }); });
  let wasGuest = false;
  $effect(() => {
    if (room.role === 'guest') wasGuest = true;
    else if (wasGuest) untrack(() => { wasGuest = false; Object.assign(share, { phase: 'lobby', players: [], payouts: null }); });
  });

  function start() {
    if (!isHost || share.phase === 'place' || share.phase === 'battle' || bet > wallet.balance) return;
    fleets = new Map(); minesOf = new Map();
    const players = roster();
    for (const p of players) if (p.bot) fleets.set(p.id, withKinds(randomFleet(Math.random, touch), variant === 'arcade'));
    Object.assign(share, { phase: 'place', round: share.round + 1, mode, again, variant, touch, players, turn: '', last: null, payouts: null, until: Date.now() + 90_000 });
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
    // arcade: two mines in every sea, each player sees only their own
    if (arcade) for (const p of share.players) {
      const ms = layMines(fleets.get(p.id)!);
      minesOf.set(p.id, ms);
      if (p.id === room.myId) myMines = ms;
      else if (!p.bot) room.sendTo(p.id, { t: 'mines', mines: ms });
    }
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
  /** A shot (or bomb, sonar, direction finder) from `by` at `target`'s cell (host judges). */
  function shot(by: string, target: string, cell: number, w: Weapon = 'shot') {
    if (share.phase !== 'battle' || share.turn !== by || !(cell >= 0 && cell < N * N)) return;
    const me = share.players.find((p) => p.id === by)!;
    const t = enemies(by).find((p) => p.id === target);
    if (!t || (w !== 'shot' && (!arcade || !(me.ammo[w] > 0)))) return;
    const f = fleets.get(t.id)!, arr = [...t.shots].map(Number), n = (share.last?.n ?? 0) + 1;
    if (w === 'sonar' || w === 'peil') {
      me.ammo[w]--;
      t.intel = [...t.intel.filter((x) => x.w !== w || x.c !== cell), w === 'sonar' ? sonar(f, arr, cell) : peil(f, arr, cell)];
      share.last = { by, target, cell, res: 'scan', n };
      nextTurn();
    } else {
      if (!shootable(arr[cell])) return;
      const ms = minesOf.get(t.id) ?? [];
      let res: string, mine = false;
      if (w === 'bomb') {
        me.ammo.bomb--;
        const b = bomb(f, arr, cell, share.touch, ms);
        res = b.res; mine = b.mine;
        t.wrecks = [...t.wrecks, ...b.sunk];
      } else {
        const r = shoot(f, arr, cell, share.touch, ms);
        res = r.res; mine = r.res === 'mine';
        if (r.res === 'sunk' && r.ship) t.wrecks = [...t.wrecks, r.ship];
      }
      t.shots = arr.join('');
      share.last = { by, target, cell, res, n };
      if (mine) me.skip = 1; // whoever hits a mine sits out their next turn
      if (sunkAll(f, arr)) knockOut(t);
      if (share.phase === 'battle' && (res === 'water' || mine || !share.again || !enemies(by).length)) nextTurn();
    }
    if (share.phase === 'battle') share.until = Date.now() + 30_000;
    push(true);
    botMove();
  }
  /** Arcade: the submarine dives to a new spot instead of a shot. */
  function dive(by: string, to: Ship) {
    if (share.phase !== 'battle' || share.turn !== by || !arcade) return;
    const me = share.players.find((p) => p.id === by)!, f = fleets.get(by)!;
    if (!(me.ammo.dive > 0) || !canDive(f, to, [...me.shots].map(Number), minesOf.get(by) ?? [], share.touch)) return;
    me.ammo.dive--;
    const nf = f.map((s) => (s.k === 'sub' ? { ...to, k: s.k } : s));
    fleets.set(by, nf);
    if (by === room.myId) fleet = nf; else room.sendTo(by, { t: 'myfleet', fleet: nf });
    share.last = { by, target: by, cell: -1, res: 'dive', n: (share.last?.n ?? 0) + 1 };
    nextTurn();
    share.until = Date.now() + 30_000;
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
      const p = share.players.find((q) => q.id === id);
      if (!p?.alive) continue;
      if (p.skip > 0 && share.players.filter((q) => q.alive).length > 1) { p.skip--; continue; } // sits out after a mine
      share.turn = id; return;
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
      if (!t) return;
      const board = [...t.shots].map(Number), sunk = t.wrecks.map((w) => w.len);
      // arcade bots throw their bomb once they have something to aim at
      if (arcade && p.ammo.bomb > 0 && skill !== 'easy' && board.some((v) => v === 2)) { const c = aim(board, skill, Math.random, sunk); shot(p.id, t.id, c, 'bomb'); return; }
      shot(p.id, t.id, aim(board, skill, Math.random, sunk));
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
        if (p.id === room.myId) { fleet = randomFleet(Math.random, share.touch); ready(); }
        else { const f = withKinds(randomFleet(Math.random, share.touch), arcade); fleets.set(p.id, f); p.ready = true; room.sendTo(p.id, { t: 'myfleet', fleet: f }); }
      }
      maybeBattle(); push(true);
    } else if (share.phase === 'battle') {
      const t = enemies(share.turn)[0];
      if (t) shot(share.turn, t.id, aim([...t.shots].map(Number), 'easy', Math.random, t.wrecks.map((w) => w.len)));
    }
  }, 500);
  onDestroy(() => { clearInterval(clock); room.leave(); });

  // ---------- my fleet and my shots ----------
  let fleet = $state<Ship[]>([]);
  let mates = $state<Record<string, Ship[]>>({});
  let holding = $state(-1); // index into FLEET of the ship in hand while placing
  let vert = $state(false);
  let hoverCell = $state(-1);
  let myMines = $state<number[]>([]);
  let weapon = $state<Weapon | 'dive'>('shot');
  let aimAt = $state<{ t: string; c: number } | null>(null);
  function newFleet() { fleet = []; mates = {}; holding = 0; vert = false; myMines = []; weapon = 'shot'; }
  const myFleet = $derived(withKinds(fleet, arcade));
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
    if (!preview || !canPlace(fleet, preview, -1, share.touch)) { sfx('stop'); return; }
    fleet = [...fleet, preview];
    holding = 0;
    sfx('chip');
  }
  function ready() {
    if (!placing || fleet.length !== FLEET.length) return;
    if (room.role === 'guest') { room.send({ t: 'fleet', fleet: $state.snapshot(fleet) }); }
    else { fleets.set(room.myId, withKinds($state.snapshot(fleet), arcade)); meP!.ready = true; maybeBattle(); push(true); }
    sfx('chip');
  }
  function fireAt(target: string, c: number) {
    if (share.turn !== room.myId || weapon === 'dive') return;
    const w = weapon;
    if (room.role === 'guest') room.send({ t: 'shot', target, cell: c, w });
    else shot(room.myId, target, c, w);
    weapon = 'shot';
  }
  // diving: the sub follows the pointer on my own board
  const mySub = $derived(myFleet.find((s) => s.k === 'sub'));
  const diveTo = $derived(weapon === 'dive' && mySub && hoverCell >= 0 ? { len: mySub.len, v: mySub.v, x: hoverCell % N, y: Math.floor(hoverCell / N) } : null);
  const diveOk = $derived(!!diveTo && canDive(myFleet, diveTo, [...(meP?.shots ?? blank)].map(Number), myMines, share.touch));
  function diveHere() {
    if (!diveTo || !diveOk || !myTurn) { sfx('stop'); return; }
    if (room.role === 'guest') room.send({ t: 'dive', to: diveTo }); else dive(room.myId, diveTo);
    weapon = 'shot'; hoverCell = -1;
  }
  /** Cells a weapon covers around c, for the aiming highlight. */
  function area(c: number): number[] {
    const x = c % N, y = Math.floor(c / N), out: number[] = [];
    if (weapon === 'bomb') for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { if (x + a >= 0 && x + a < N && y + b >= 0 && y + b < N) out.push((y + b) * N + x + a); }
    else if (weapon === 'sonar') for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { if (x + a >= 0 && x + a < N && y + b >= 0 && y + b < N) out.push((y + b) * N + x + a); }
    else if (weapon === 'peil') for (let i = 0; i < N; i++) out.push(y * N + i, i * N + x);
    return out;
  }
  function key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, textarea')) return;
    if ((e.key === 'r' || e.key === 'R') && placing) { vert = !vert; e.preventDefault(); }
    if (e.key === 'Escape' && weapon !== 'shot') weapon = 'shot';
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
    untrack(() => sfx(l.res === 'water' ? 'splat' : l.res === 'sunk' ? 'big' : l.res === 'scan' || l.res === 'dive' ? 'tick' : 'boom'));
  });
  onMount(() => { if (room.role === 'solo') share.players = roster(); });

  const demo = randomFleet(rng(7));
  const nameOf = (id: string) => share.players.find((p) => p.id === id)?.name ?? '?';
  const targets = $derived(share.phase === 'battle' || share.phase === 'end' ? share.players.filter((p) => p.id !== room.myId && (share.mode !== '2v2' || p.team !== meP?.team)) : []);
  const mate = $derived(share.mode === '2v2' ? share.players.find((p) => p.team === meP?.team && p.id !== room.myId) : undefined);
  const myTurn = $derived(share.phase === 'battle' && share.turn === room.myId);
  const left = $derived(Math.max(0, Math.ceil((share.until - now) / 1000)));
  const seats = $derived(lobby.map((p) => ({ ...p, out: share.phase !== 'lobby' && !p.alive, score: share.phase === 'battle' || share.phase === 'end' ? (p.alive ? '⚓' : `${p.place}.`) : share.phase === 'place' ? (p.ready ? '✓' : '…') : undefined })));
  // board sizes follow the space in the ocean
  let oceanW = $state(900);
  const W = $derived(Math.max(260, oceanW - 40));
  const fit = (w: number, max: number) => Math.max(18, Math.min(max, Math.floor(w / 10.7)));
  const side = $derived(targets.length === 1 && W >= 760);
  const cellBig = $derived(targets.length > 2 ? fit((W - 60) / 3, 36) : targets.length > 1 ? fit((W - 40) / 2, 42) : fit(side ? W * 0.6 : W, 52));
  const cellMine = $derived(side ? fit(W * 0.36, 34) : fit(Math.min(W, 420), weapon === 'dive' ? 40 : 28));
  const cellPlace = $derived(fit(W, 54));
  const won = $derived(share.phase === 'end' && (!!meP?.alive || (share.mode === '2v2' && share.players.some((p) => p.alive && p.team === meP?.team))));
</script>

<svelte:window onkeydown={key} />

<section class="sv">
  <header class="head">
    <div class="h1row"><h1>{L('Schiffe versenken', 'Battleships')}</h1><span class="eyebrow">{({ '1v1': '1 vs 1', '2v2': '2 vs 2', ffa: L(`Jeder gegen jeden · ${share.phase === 'lobby' ? ffaSize : share.players.length}`, `Free for all · ${share.phase === 'lobby' ? ffaSize : share.players.length}`) })[share.phase === 'lobby' ? mode : share.mode]}</span>{#if (share.phase === 'lobby' ? variant : share.variant) === 'arcade'}<span class="arc">Arcade</span>{/if}<HowTo id="ships" /></div>
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
          <div class="field">{L('Variante', 'Variant')}<div class="seg">{#each [['classic', L('Klassisch', 'Classic')], ['arcade', 'Arcade']] as [v, lb]}<button class:on={variant === v} onclick={() => (variant = v as Variant)}>{lb}</button>{/each}</div></div>
          {#if variant === 'arcade'}<p class="arcnote small">{L('Panzerschiff (2 Treffer pro Feld), U-Boot zum Abtauchen, je 2 Minen im Meer, dazu Bombe, Sonar und Peiler.', 'Armoured battleship (2 hits per part), a submarine that dives, 2 mines in every sea, plus a bomb, sonar and direction finder.')}</p>{/if}
          {#if mode === 'ffa'}<div class="field">{L('Spieler', 'Players')}<div class="seg">{#each [3, 4] as k}<button class:on={ffaSize === k} onclick={() => (ffaSize = k)}>{k}</button>{/each}</div></div>{/if}
          <div class="field">{L('Bots', 'Bots')}<div class="seg">{#each [['easy', L('Leicht', 'Easy')], ['mid', L('Mittel', 'Medium')], ['hard', L('Schwer', 'Hard')]] as [s, lb]}<button class:on={skill === s} onclick={() => (skill = s as Skill)}>{lb}</button>{/each}</div></div>
          <label class="switch"><span>{L('Treffer = nochmal schiessen', 'Hit = shoot again')}</span><input type="checkbox" bind:checked={again} /></label>
          <label class="switch"><span>{L('Schiffe dürfen sich berühren', 'Ships may touch')}<small class="muted">{L('Versenkte Schiffe zeigen dann kein Wasser rundherum.', 'Sunk ships then reveal no water around them.')}</small></span><input type="checkbox" bind:checked={touch} /></label>
          <button class="btn primary big" disabled={bet > wallet.balance} onclick={start}>{share.phase === 'end' ? L('Neue Runde', 'New round') : L('Flotten setzen', 'Place fleets')}</button>
          <small class="muted">{L('Freie Plätze übernehmen Bots. Freunde: oben «Raum öffnen» und den Code teilen.', 'Bots take free seats. Friends: "Open room" at the top and share the code.')}</small>
        {:else}<p class="muted small">{L('Der Gastgeber startet die Runde.', 'The host starts the round.')}</p>{/if}
      {:else if share.phase === 'place'}
        <div class="status"><b>{placing ? L('Setz deine Flotte', 'Place your fleet') : L('Warten auf die anderen …', 'Waiting for the others …')}</b><span class="mono">{left}s</span></div>
        {#if placing}
          <div class="dock">
            {#each toPlace as len, i}<button class="shipbtn" class:on={holding === i} onclick={() => (holding = i)} style="--len:{len}" aria-label={len + ''}><span class="ws"><Warship {len} k={share.variant !== 'arcade' ? undefined : len === 5 ? 'armor' : len === 3 && !fleet.some((f) => f.len === 3) && i === toPlace.indexOf(3) ? 'sub' : undefined} /></span><small class="mono">{len}</small></button>{/each}
            {#if !toPlace.length}<span class="muted small">{L('Alle Schiffe gesetzt.', 'All ships placed.')}</span>{/if}
          </div>
          <div class="row3">
            <button class="btn rot" onclick={() => (vert = !vert)} aria-label={vert ? L('Senkrecht', 'Vertical') : L('Waagrecht', 'Horizontal')}><span class="ri" class:v={vert} aria-hidden="true"></span>{L('Drehen', 'Rotate')} <kbd>R</kbd></button>
            <button class="btn" onclick={() => { fleet = randomFleet(); sfx('shuffle'); }}>🎲 {L('Zufällig', 'Random')}</button>
          </div>
          <button class="btn primary big" disabled={fleet.length !== FLEET.length} onclick={ready}>{L('Bereit', 'Ready')}</button>
          <small class="muted">{share.touch ? L('Schiffe dürfen nebeneinander liegen.', 'Ships may lie side by side.') : L('Schiffe dürfen sich nicht berühren, auch nicht an den Ecken.', 'Ships may not touch, not even at the corners.')} {L('Ein Klick auf ein gesetztes Schiff nimmt es wieder auf.', 'Click a placed ship to pick it up again.')}</small>
        {/if}
      {:else}
        <div class="status turn" class:mine={myTurn}>
          <b>{myTurn ? L('Feuer frei!', 'Fire away!') : L(`${nameOf(share.turn)} zielt …`, `${nameOf(share.turn)} is aiming …`)}</b><span class="mono">{left}s</span>
        </div>
        {#if arcade && meP?.alive && share.phase === 'battle'}
          <div class="arsenal" class:live={myTurn}>
            {#each [['shot', '🎯', L('Schuss', 'Shot'), -1], ['bomb', '💣', L('Bombe', 'Bomb'), meP.ammo.bomb], ['sonar', '📡', 'Sonar', meP.ammo.sonar], ['peil', '🧭', L('Peiler', 'Finder'), meP.ammo.peil], ['dive', '🌊', L('Tauchen', 'Dive'), mySub && ![...cellsOf(mySub)].some((c) => meP!.shots[c] !== '0') ? meP.ammo.dive : 0]] as [w, ic, lb, n]}
              <button class:on={weapon === w} disabled={!myTurn || n === 0} onclick={() => (weapon = weapon === w ? 'shot' : (w as Weapon | 'dive'))} title={lb as string}>
                <span>{ic}</span><small>{lb}</small>{#if (n as number) >= 0}<em class="mono">{n}</em>{/if}
              </button>
            {/each}
          </div>
          {#if weapon !== 'shot'}<p class="hint small" in:fly={{ y: -4 }}>{({ bomb: L('Bombe: trifft ein Kreuz aus fünf Feldern.', 'Bomb: hits a cross of five cells.'), sonar: L('Sonar: zählt Schiffsteile im 3 × 3-Feld.', 'Sonar: counts ship parts in a 3 × 3 area.'), peil: L('Peiler: zählt Schiffsteile in Zeile und Spalte.', 'Finder: counts ship parts in the row and column.'), dive: L('Tauchen: wähle unten in deiner Flotte ein Ziel bis 2 Felder weit, nur in unerforschtes Wasser.', 'Dive: pick a spot up to 2 cells away in your fleet below, unexplored water only.') } as Record<string, string>)[weapon]}</p>{/if}
          {#if meP.skip > 0}<p class="hint small warn">💥 {L('Mine erwischt: du setzt eine Runde aus.', 'You hit a mine: you sit out a turn.')}</p>{/if}
        {/if}
        {#if share.last}
          {#key share.last.n}
            <p class="log" in:fly={{ y: -6 }}>
              <b>{share.last.by === room.myId ? L('Du', 'You') : nameOf(share.last.by)}</b>
              {#if share.last.res === 'dive'}<span class="res scan">{share.last.by === room.myId ? L('tauchst ab 🌊', 'dive 🌊') : L('taucht ab 🌊', 'dives 🌊')}</span>
              {:else}→ {share.last.target === room.myId ? L('dich', 'you') : nameOf(share.last.target)}
              <span class="mono">{'ABCDEFGHIJ'[share.last.cell % N]}{Math.floor(share.last.cell / N) + 1}</span>
              <span class="res {share.last.res}">{({ water: L('Wasser', 'Splash'), hit: L('Treffer!', 'Hit!'), sunk: L('Versenkt!', 'Sunk!'), dent: L('Panzer hält!', 'Armour holds!'), mine: L('Mine! Setzt aus', 'Mine! Sits out'), scan: L('Ortung', 'Scan') } as Record<string, string>)[share.last.res]}</span>{/if}
            </p>
          {/key}
        {/if}
      {/if}
      <PotSeats {seats} me={room.myId} turn={share.phase === 'battle' ? share.turn : ''} payouts={share.phase === 'end' ? share.payouts : null} />
    </aside>

    <div class="ocean" bind:clientWidth={oceanW}>
      {#if share.phase === 'lobby'}
        <div class="intro">
          <Sea ships={withKinds(demo, variant === 'arcade')} cell={cellPlace} />
          <p class="muted">{L('Versenke alle Schiffe der Gegner, bevor sie deine finden.', 'Sink all enemy ships before they find yours.')}</p>
        </div>
      {:else if share.phase === 'place'}
        <div class="placing">
          <Sea ships={myFleet} preview={placing ? preview : null} previewOk={!!preview && canPlace(fleet, preview, -1, share.touch)} hover={placing ? (c) => (hoverCell = c) : undefined} pick={placing ? placeAt : undefined} cell={cellPlace} label={L('Deine Flotte', 'Your fleet')} />
        </div>
      {:else}
        <div class="battle" class:side>
          <div class="foes" class:many={targets.length > 1}>
            {#each targets as t (t.id)}
              <div class="board" class:target={myTurn && t.alive} class:out={!t.alive}>
                <div class="bh"><span class="av" class:t1={t.team === 1} class:t2={t.team === 2}>{t.bot ? '🤖' : t.name.slice(0, 1)}</span>{t.name}{#if !t.alive}<em>{L('versenkt', 'sunk')}</em>{/if}{#if share.turn === t.id}<em class="aim">🎯</em>{/if}</div>
                <Sea shots={t.shots} cell={cellBig} fire={myTurn && t.alive && weapon !== 'dive' ? (c) => fireAt(t.id, c) : undefined} shot={share.last?.target === t.id ? share.last : null} dim={!t.alive}
                  wrecks={t.wrecks} intel={t.intel} hover={myTurn && t.alive && weapon !== 'shot' && weapon !== 'dive' ? (c) => (aimAt = c >= 0 ? { t: t.id, c } : null) : undefined}
                  zone={aimAt?.t === t.id && weapon !== 'shot' ? area(aimAt.c) : []} />
              </div>
            {/each}
          </div>
          <div class="mine">
            <div class="board small" class:hit={share.last?.target === room.myId && share.last.res !== 'water'}>
              {#key share.last?.n}<div class="bh">{L('Deine Flotte', 'Your fleet')}{#if meP && !meP.alive}<em>{L('versenkt', 'sunk')}</em>{/if}</div>{/key}
              <Sea shots={meP?.shots ?? blank} ships={myFleet} cell={cellMine} shot={share.last?.target === room.myId ? share.last : null} wrecks={meP?.wrecks} mines={myMines}
                preview={weapon === 'dive' ? diveTo : null} previewOk={diveOk} hover={weapon === 'dive' ? (c) => (hoverCell = c) : undefined} pick={weapon === 'dive' ? diveHere : undefined} />
            </div>
            {#if mate}
              <div class="board small">
                <div class="bh">{L('Partner', 'Partner')}: {mate.name}</div>
                <Sea shots={mate.shots} ships={mates[mate.id] ?? []} cell={cellMine} shot={share.last?.target === mate.id ? share.last : null} dim={!mate.alive} wrecks={mate.wrecks} />
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
  .res { font-weight: 700; } .res.water { color: #9fd3ff; } .res.hit, .res.dent { color: #ffb36b; } .res.sunk, .res.mine { color: #ff8a8d; } .res.scan { color: #8ff5dc; }
  .dock { display: flex; flex-direction: column; gap: 6px; }
  .shipbtn { display: flex; align-items: center; padding: 6px 8px; border-radius: 10px; border: 1px solid var(--line-2); background: none; transition: border-color 0.3s var(--ease-snap), transform 0.16s var(--ease-snap); }
  .shipbtn:active { transform: scale(0.97); }
  .shipbtn.on { border-color: #7ff0b2; background: rgba(127,240,178,.1); }
  .shipbtn { justify-content: space-between; min-height: 44px; background: linear-gradient(90deg, rgba(17,73,111,.5), rgba(7,32,56,.4)); }
  .shipbtn .ws { position: relative; display: block; width: calc(var(--len) * 44px); max-width: 88%; height: 36px; }
  .shipbtn small { color: var(--muted); font-size: 0.72rem; }
  .row3 .btn { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rot { display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
  .ri { width: 18px; height: 6px; border-radius: 3px; background: currentColor; transition: transform 0.45s var(--spring-snappy); }
  .ri.v { transform: rotate(90deg); }
  .arc { font: 700 0.7rem 'Geist Mono Variable', monospace; letter-spacing: 0.12em; text-transform: uppercase; padding: 4px 9px; border-radius: 999px; color: #04241d; background: linear-gradient(135deg, #8ff5dc, #3fc9a6); }
  .arcnote { margin: -6px 0 0; color: var(--muted); }
  .arsenal { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; opacity: 0.6; transition: opacity 0.3s var(--ease-snap); }
  .arsenal.live { opacity: 1; }
  .arsenal button { position: relative; display: grid; justify-items: center; gap: 2px; padding: 8px 2px 6px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--surface-2); color: var(--text); transition: border-color 0.25s var(--ease-snap), transform 0.16s var(--ease-snap), background 0.25s var(--ease-snap); }
  .arsenal button span { font-size: 1.15rem; line-height: 1; }
  .arsenal button small { font-size: 0.62rem; color: var(--muted); }
  .arsenal button em { position: absolute; top: -6px; right: -4px; font-style: normal; font-size: 0.65rem; padding: 1px 5px; border-radius: 999px; background: #3fc9a6; color: #04241d; font-weight: 700; }
  .arsenal button.on { border-color: #8ff5dc; background: rgba(143,245,220,.14); transform: translateY(-2px); }
  .arsenal button:active:not(:disabled) { transform: scale(0.95); }
  .arsenal button:disabled { opacity: 0.4; }
  .hint { margin: 0; padding: 8px 12px; border-radius: 12px; background: rgba(143,245,220,.08); color: #b9fff0; }
  .hint.warn { background: rgba(255,120,60,.12); color: #ffb48f; }
  .switch small { display: block; font-size: 0.75rem; }
  .battle.side { grid-template-columns: auto auto; align-items: start; justify-content: center; gap: 28px; }

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
  }
  @media (prefers-reduced-motion: reduce) { .intro, .placing, .board, .board.small.hit { animation: none; } }
</style>
