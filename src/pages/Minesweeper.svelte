<script lang="ts">
  import { onDestroy, onMount, untrack } from 'svelte';
  import { fly } from 'svelte/transition';
  import ArcadeLayout from '../components/ArcadeLayout.svelte';
  import BetInput from '../components/BetInput.svelte';
  import RoomBar from '../components/RoomBar.svelte';
  import Sprite from '../components/Sprite.svelte';
  import {
    LEVELS, newGame, open, chord, flag, tick, scan, detect, smartAfterFlag, hunt, deduce, safeMoveIn, cloneMS, neighbours,
    type MS, type MsLevel, type Opts,
  } from '../games/minesweeper';
  import { Room } from '../lib/net.svelte';
  import { settings, wallet, settle, stake, fmt } from '../lib/state.svelte';
  import { sfx } from '../lib/sfx';
  import { pop } from '../lib/motion';
  import { t, type Key } from '../lib/i18n';

  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
  type Mode = 'classic' | 'arcade' | 'coop';
  let mode = $state<Mode>('classic');

  // ---------- persisted progress ----------
  const saved = (() => { try { return JSON.parse(localStorage.getItem('betly:ms') || '{}'); } catch { return {}; } })();
  let best = $state<Record<string, number>>(saved.best ?? (() => { try { return JSON.parse(localStorage.getItem('betly:ms-best') || '{}'); } catch { return {}; } })());
  let campaign = $state<number>(saved.campaign ?? 0); // arcade levels beaten
  let ccamp = $state<number>(saved.ccamp ?? 0); // classic levels beaten
  $effect(() => { try { localStorage.setItem('betly:ms', JSON.stringify({ best, campaign, ccamp })); } catch {} });

  // ---------- classic options ----------
  const PAYS: Record<MsLevel, number> = { easy: 1.3, medium: 3, hard: 10 };
  let level = $state<MsLevel | 'custom'>('easy');
  let cw = $state(20), ch = $state(14), cm = $state(45);
  // fitted so the presets come out right (easy 1.3, medium 3, hard 10): density matters most, size a little
  const customPay = $derived(Math.min(50, Math.max(1.02, Math.round((1 + 2.573 * (Math.min(cm, cw * ch - 10) / (cw * ch)) ** 3.14 * (cw * ch) ** 1.006) * 100) / 100)));
  let csub = $state<'free' | 'campaign'>('free');
  let clvl = $state(0);
  const CLASSIC_CAMPAIGN: { w: number; h: number; m: number; boss?: boolean }[] = [
    { w: 9, h: 9, m: 10 }, { w: 10, h: 10, m: 14 }, { w: 12, h: 12, m: 22 }, { w: 16, h: 16, m: 40, boss: true }, { w: 16, h: 14, m: 42 },
    { w: 18, h: 16, m: 56 }, { w: 20, h: 16, m: 66 }, { w: 30, h: 16, m: 99, boss: true }, { w: 24, h: 18, m: 90 }, { w: 30, h: 20, m: 145, boss: true },
  ];

  // ---------- arcade options ----------
  let sub = $state<'free' | 'campaign'>('free');
  let asize = $state<'s' | 'm' | 'l'>('m');
  let hex = $state(false);
  let doubles = $state(true), moving = $state(false), timers = $state(false);
  let noGuess = $state(false), smartFlag = $state(false);
  let lvl = $state(0); // campaign level index
  const SIZES = { s: [9, 9, 12], m: [16, 14, 40], l: [24, 16, 80] } as const;
  type Lvl = { w: number; h: number; m: number; o: Opts; boss?: boolean };
  const CAMPAIGN: Lvl[] = [
    { w: 9, h: 9, m: 10, o: {} },
    { w: 10, h: 10, m: 14, o: { doubles: 0.15 } },
    { w: 12, h: 10, m: 20, o: { hex: true } },
    { w: 20, h: 14, m: 50, o: { moving: 2 }, boss: true },
    { w: 12, h: 12, m: 24, o: { hex: true, doubles: 0.2 } },
    { w: 14, h: 12, m: 30, o: { timers: 1 } },
    { w: 14, h: 14, m: 34, o: { hex: true, moving: 2 } },
    { w: 24, h: 16, m: 80, o: { hex: true, timers: 2, doubles: 0.15 }, boss: true },
    { w: 16, h: 14, m: 42, o: { moving: 3, timers: 1, doubles: 0.2 } },
    { w: 16, h: 16, m: 48, o: { hex: true, doubles: 0.25, moving: 2 } },
    { w: 18, h: 16, m: 58, o: { timers: 2, moving: 3 } },
    { w: 30, h: 20, m: 130, o: { hex: true, doubles: 0.2, moving: 4, timers: 2 }, boss: true },
  ];
  const BONI = [[2, 'detector'], [4, 'shield'], [8, 'scanner']] as const; // beat level n → +1 at the start
  const arcadePay = $derived.by(() => {
    let p = { s: 1.25, m: 2.2, l: 5 }[asize] * 0.7; // three lives are forgiving
    if (hex) p *= 1.12; if (doubles) p *= 1.15; if (moving) p *= 1.2; if (timers) p *= 1.15; if (noGuess) p *= 0.85;
    return Math.round(p * 100) / 100;
  });

  // ---------- co-op options ----------
  let coopKind = $state<'coop' | 'versus'>('coop');
  let csize = $state<'s' | 'm'>('m');
  let zones = $state(false);
  const COOP_SIZE = { s: [12, 10, 22], m: [20, 14, 56] } as const;
  const VS_SIZE = { s: [9, 9, 11], m: [16, 16, 51] } as const; // odd mine count: no ties

  // ---------- board state ----------
  let ms = $state<MS>(newGame(9, 9, 10));
  let touch = $state(false), portrait = $state(false);
  let tool = $state<'dig' | 'flag' | 'scan'>('dig');
  let wager = $state(false);
  let bet = $state(10);
  let staked = $state(0);
  let t0 = 0, secs = $state(0);
  let timerId: ReturnType<typeof setInterval> | undefined;
  let items = $state({ shield: 0, scanner: 0, detector: 0 });
  let openedSinceItem = 0;
  let toast = $state<{ text: string; id: number; bad?: boolean } | null>(null);
  let detected = $state(-1);
  // full screen: the board fills the window and sizes its cells to fit, no scrolling
  let full = $state(false);
  function toggleFull() {
    full = !full;
    try {
      if (full) document.documentElement.requestFullscreen?.().catch(() => {});
      else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    } catch {}
  }
  $effect(() => {
    const sync = () => { if (!document.fullscreenElement && full) full = false; };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && full) full = false; };
    document.addEventListener('fullscreenchange', sync);
    addEventListener('keydown', esc);
    return () => { document.removeEventListener('fullscreenchange', sync); removeEventListener('keydown', esc); };
  });
  onDestroy(() => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); });
  const say = (text: string, bad = false) => (toast = { text, id: performance.now(), bad });

  // replay: a snapshot before every action, plus what was clicked
  type Frame = { ms: MS; i: number; a: string; by?: string };
  const lastIndex = <T,>(a: T[], f: (x: T) => boolean) => { for (let k = a.length - 1; k >= 0; k--) if (f(a[k])) return k; return -1; };
  let frames: Frame[] = $state.raw([]);
  let replay = $state<{ k: number; frames: Frame[]; fatal: number; hint: number } | null>(null);
  let analysis = $state<{ text: string; good: boolean } | null>(null);

  // ---------- co-op / versus players ----------
  type P = { id: string; name: string; bot?: boolean; score: number; color: string };
  const COLORS = ['#6aa8ff', '#ff9a3c', '#4fe3a0', '#d97bff'];
  let players = $state<P[]>([]);
  let turn = $state(0);
  let coopMsg: any = null;
  const room = new Room('minesweeper', onMsg, (id) => { players = players.filter((p) => p.id !== id); ensureBot(); push(); });
  const isGuest = $derived(room.role === 'guest');
  const myId = $derived(room.myId);
  onDestroy(() => { clearInterval(timerId); clearInterval(botTimer); room.leave(); });

  onMount(() => {
    touch = matchMedia('(pointer: coarse)').matches;
    portrait = matchMedia('(max-width: 640px)').matches;
    reset();
  });

  // phones get tall boards instead of wide ones
  const tall = (r: [number, number, number, Opts]): [number, number, number, Opts] => (portrait && r[0] > r[1] && room.role === 'solo' ? [r[1], r[0], r[2], r[3]] : r);
  function setup(): [number, number, number, Opts] { return tall(setupRaw()); }
  function setupRaw(): [number, number, number, Opts] {
    if (mode === 'classic') {
      if (csub === 'campaign') { const c = CLASSIC_CAMPAIGN[clvl]; return [c.w, c.h, c.m, {}]; }
      const [w, h, m] = level === 'custom' ? [cw, ch, Math.min(cm, cw * ch - 10)] : [...LEVELS[level]];
      return [w, h, m, {}];
    }
    if (mode === 'arcade') {
      if (sub === 'campaign') { const c = CAMPAIGN[lvl]; return [c.w, c.h, c.m, { ...c.o, lives: 3, noGuess: noGuess && !c.o.doubles }]; }
      const [w, h, m] = SIZES[asize];
      return [w, h, m, { hex, lives: 3, doubles: doubles && !noGuess ? 0.2 : 0, moving: moving ? 2 + (asize === 'l' ? 2 : 0) : 0, timers: timers ? 1 + (asize === 'l' ? 1 : 0) : 0, noGuess }];
    }
    const [w, h, m] = coopKind === 'versus' ? VS_SIZE[csize] : COOP_SIZE[csize];
    return [w, h, m, coopKind === 'versus' ? {} : { lives: 3, noGuess }];
  }

  function reset() {
    if (isGuest) return;
    clearInterval(timerId);
    const [w, h, m, o] = setup();
    ms = newGame(w, h, m, o);
    secs = 0; staked = 0; frames = []; replay = null; analysis = null; detected = -1; toast = null; tool = 'dig';
    openedSinceItem = 0;
    items = { shield: 1, scanner: 1, detector: 1 };
    if (mode === 'arcade') for (const [n, k] of BONI) if (campaign >= n) items[k]++;
    if (mode === 'coop') { for (const p of players) p.score = 0; turn = 0; ensureBot(); push(); }
  }
  $effect(() => { void [mode, level, csub, clvl, sub, lvl, asize, hex, doubles, moving, timers, noGuess, coopKind, csize]; untrack(reset); });
  $effect(() => { if (mode !== 'coop' && room.role !== 'solo') untrack(() => room.leave()); });

  const flags = $derived(ms.cells.reduce((a, c) => a + (c.open ? 0 : c.flag), 0));
  const mineTotal = $derived(ms.state === 'ready' ? ms.mines + Math.round((ms.opts.doubles ?? 0) * ms.mines) : ms.cells.reduce((a, c) => a + c.mine, 0));
  const done = $derived(ms.state === 'won' || ms.state === 'lost');
  const versus = $derived(mode === 'coop' && coopKind === 'versus');
  const payNow = $derived(mode === 'classic' ? (csub === 'campaign' ? 0 : level === 'custom' ? customPay : PAYS[level]) : mode === 'arcade' ? (sub === 'campaign' ? 0 : arcadePay) : versus ? 1.9 : 1.5);

  function begin() {
    t0 = performance.now();
    timerId = setInterval(() => (secs = Math.floor((performance.now() - t0) / 1000)), 250);
    if (wager && payNow && bet <= wallet.balance && bet > 0) { staked = bet; stake(bet); }
  }
  function finish(won: boolean) {
    clearInterval(timerId);
    secs = Math.floor((performance.now() - t0) / 1000);
    if (won) {
      const key = mode === 'classic' ? (csub === 'campaign' ? 'c-lvl' + clvl : level === 'custom' ? `c${cw}x${ch}x${cm}` : level) : mode === 'arcade' && sub === 'campaign' ? 'lvl' + lvl : '';
      if (key && (!best[key] || secs < best[key])) best = { ...best, [key]: secs };
      if (staked) { const win = Math.round(staked * payNow * 100) / 100; settle(win, win); }
      if (mode === 'classic' && csub === 'campaign' && clvl + 1 > ccamp) { ccamp = clvl + 1; say(L('Level geschafft!', 'Level cleared!')); }
      if (mode === 'arcade' && sub === 'campaign' && lvl + 1 > campaign) {
        campaign = lvl + 1;
        const bonus = BONI.find(([n]) => n === campaign);
        say(bonus ? L('Bonus freigeschaltet: +1 ', 'Bonus unlocked: +1 ') + itemName(bonus[1]) : L('Level geschafft!', 'Level cleared!'));
      }
      sfx('big');
    } else {
      if (staked) settle(0, 0);
      sfx('boom');
    }
    if (mode !== 'classic' && !versus) analyse();
  }

  // ---------- actions ----------
  function act(a: 'dig' | 'flag' | 'scan', i: number, by = myId) {
    if (done || i < 0) return;
    const c = ms.cells[i];
    if (mode === 'coop' && zones && !versus && !inZone(i, by)) return;
    if (versus) return actVersus(a, i, by);
    const wasReady = ms.state === 'ready';
    ms.note = '';
    frames = [...frames, { ms: cloneMS(ms), i, a, by }];
    if (a === 'flag') {
      if (flag(ms, i)) {
        sfx('chip'); navigator.vibrate?.(18);
        // gentle smart flagging: a flag that completes a number opens that number's other neighbours
        if (smartFlag && mode !== 'classic' && smartAfterFlag(ms, i, by)) { if (done) finish(ms.state === 'won'); }
        else frames = frames.slice(0, -1);
      } else frames = frames.slice(0, -1);
      push(); return;
    }
    if (a === 'scan') {
      if (!items.scanner) return;
      items.scanner--; tool = 'dig';
      scan(ms, i, by); sfx('gem'); say(L('Scanner: Bereich aufgedeckt', 'Scanner: area revealed'));
    } else if (c.open) {
      if (chord(ms, i, by)) sfx('gem'); else { frames = frames.slice(0, -1); return; }
    } else if (!c.flag) {
      const before = ms.cells.filter((x) => x.open).length;
      const r = open(ms, i, by);
      if (r === 'hit') { sfx('boom'); say(L('Mine! Ein Leben weniger', 'Mine! One life lost'), true); }
      else if (r === 'shield') { sfx('stop'); say(L('Der Schild hat dich gerettet', 'The shield saved you')); }
      else if (r !== 'lost') sfx('tick');
      openedSinceItem += ms.cells.filter((x) => x.open).length - before;
    } else { frames = frames.slice(0, -1); return; }
    if (mode !== 'classic') {
      tick(ms);
      const note = ms.note as MS['note'];
      if (note === 'moved') say(L('Eine Mine hat sich bewegt!', 'A mine has moved!'), true);
      if (note === 'timer') say(L('Zeitbombe aktiv! Finde und flagge sie', 'Time bomb armed! Find and flag it'), true);
      if (note === 'defused') say(L('Zeitbombe entschärft', 'Time bomb defused'));
      if (note === 'blast') { sfx('boom'); say(L('Die Zeitbombe ist explodiert', 'The time bomb went off'), true); }
      // power-ups for progress
      if (mode === 'arcade' && openedSinceItem >= 40) {
        openedSinceItem -= 40;
        const k = (['shield', 'scanner', 'detector'] as const)[Math.floor(Math.random() * 3)];
        items[k]++;
        say('+1 ' + itemName(k));
      }
    }
    if (wasReady && ms.state !== 'ready') begin();
    if (done) finish(ms.state === 'won');
    push();
  }

  function useShield() { if (!items.shield || done) return; items.shield--; ms.shield++; sfx('chip'); say(L('Schild aktiv: verzeiht eine Mine', 'Shield up: forgives one mine')); }
  function useDetector() {
    if (!items.detector || ms.state !== 'play') return;
    const i = detect(ms);
    if (i < 0) return;
    items.detector--; detected = i; sfx('gem'); say(L('Detektor: Mine markiert', 'Detector: mine marked'));
    setTimeout(() => (detected = -1), 1600);
  }
  const itemName = (k: string) => ({ shield: L('Schild', 'Shield'), scanner: 'Scanner', detector: L('Detektor', 'Detector') })[k] ?? k;

  // ---------- replay & analysis ----------
  function analyse() {
    if (ms.state === 'won') { analysis = { text: L('Sauber gelöst.', 'Cleanly solved.'), good: true }; return; }
    const k = lastIndex(frames, (f: Frame) => f.a === 'dig' && !!f.ms.cells[f.i].mine && !f.ms.cells[f.i].flag);
    if (k < 0) { analysis = null; return; }
    const safe = safeMoveIn(frames[k].ms);
    analysis = safe >= 0
      ? { text: L('Denkfehler: Es gab einen sicheren Zug (grün im Replay).', 'Logic slip: there was a safe move (green in the replay).'), good: false }
      : { text: L('Pech: An dieser Stelle musste man raten.', 'Bad luck: this spot needed a guess.'), good: true };
  }
  let replayTimer: ReturnType<typeof setInterval> | undefined;
  function startReplay() {
    if (!frames.length) return;
    const all = [...frames, { ms: cloneMS(ms), i: -1, a: 'end' }];
    const fatal = lastIndex(frames, (f: Frame) => f.a === 'dig' && !!f.ms.cells[f.i].mine && !f.ms.cells[f.i].flag);
    replay = { k: 0, frames: all, fatal, hint: fatal >= 0 ? safeMoveIn(frames[fatal].ms) : -1 };
    clearInterval(replayTimer);
    replayTimer = setInterval(() => {
      if (!replay) return clearInterval(replayTimer);
      if (replay.k >= replay.frames.length - 1) return clearInterval(replayTimer);
      // slow down on the fatal move so you can see it
      if (replay.k === replay.fatal && !paused) { paused = true; setTimeout(() => { paused = false; if (replay) replay.k++; }, 1800); return; }
      if (!paused) replay.k++;
    }, 160);
  }
  let paused = false;
  onDestroy(() => clearInterval(replayTimer));
  const view = $derived(replay ? replay.frames[replay.k].ms : ms);
  const mark = $derived(replay ? replay.frames[replay.k].i : -1);

  // ---------- versus ----------
  function actVersus(a: string, i: number, by: string) {
    if (players[turn]?.id !== by || a !== 'dig') return;
    if (ms.state === 'ready') begin();
    const r = hunt(ms, i, by);
    if (r === 'none') return;
    if (r === 'mine') {
      const p = players.find((x) => x.id === by)!;
      p.score++;
      sfx('gem');
      if (p.score > ms.mines / 2) {
        ms.state = 'won';
        clearInterval(timerId);
        if (staked) { if (by === myId) { const win = Math.round(staked * payNow * 100) / 100; settle(win, win); } else settle(0, 0); }
        sfx(by === myId ? 'big' : 'lose');
      }
    } else { sfx('tick'); turn = (turn + 1) % players.length; }
    push();
    scheduleBot();
  }

  // ---------- co-op: zones, bot partner, networking ----------
  const inZone = (i: number, by: string) => {
    const k = players.findIndex((p) => p.id === by);
    if (k < 0 || players.length < 2) return true;
    const x = i % ms.w;
    return k === 0 ? x < ms.w / 2 : x >= ms.w / 2 - (ms.w % 2 ? 0.5 : 0);
  };
  function ensureBot() {
    if (mode !== 'coop' || isGuest) return;
    const me = players.find((p) => p.id === myId) ?? { id: myId, name: settings.name, score: 0, color: COLORS[0] };
    const humans = players.filter((p) => !p.bot && p.id !== myId);
    players = [me, ...humans];
    if (!humans.length && settings.bots) players.push({ id: 'bot', name: 'Mila', bot: true, score: 0, color: COLORS[1] });
    players.forEach((p, k) => (p.color = COLORS[k % COLORS.length]));
    scheduleBot();
  }
  $effect(() => { void settings.bots; void myId; untrack(ensureBot); });

  let botTimer: ReturnType<typeof setInterval> | undefined;
  function scheduleBot() {
    clearInterval(botTimer);
    if (mode !== 'coop' || isGuest || !players.some((p) => p.bot)) return;
    botTimer = setInterval(botMove, versus ? 900 : 1500);
  }
  function botMove() {
    const bot = players.find((p) => p.bot);
    if (!bot || done || ms.state === 'ready' || replay) return;
    const known = deduce(cloneMS(ms));
    if (versus) {
      if (players[turn]?.id !== bot.id) return;
      const mine = [...known].find(([j, v]) => v === 'm' && !ms.cells[j].open);
      if (mine) return actVersus('dig', mine[0], bot.id);
      // otherwise the cell next to the most crowded numbers
      let pick = -1, bestP = -1;
      ms.cells.forEach((c, i) => {
        if (c.open || known.get(i) === 's') return;
        let p = 0.15;
        for (const j of neighbours(ms, i)) {
          const o = ms.cells[j];
          if (!o.open || !o.n) continue;
          const nb = neighbours(ms, j), hidden = nb.filter((x) => !ms.cells[x].open).length, found = nb.filter((x) => ms.cells[x].open && ms.cells[x].mine).length;
          if (hidden) p = Math.max(p, (o.n - found) / hidden);
        }
        p += Math.random() * 0.05;
        if (p > bestP) { bestP = p; pick = i; }
      });
      if (pick >= 0) actVersus('dig', pick, bot.id);
      return;
    }
    const safe = [...known].find(([j, v]) => v === 's' && !ms.cells[j].open && inZone(j, bot.id));
    if (safe) return act('dig', safe[0], bot.id);
    const mine = [...known].find(([j, v]) => v === 'm' && !ms.cells[j].flag && inZone(j, bot.id));
    if (mine) act('flag', mine[0], bot.id);
  }
  $effect(() => { void [mode, coopKind]; untrack(scheduleBot); });

  function masked() {
    const s = cloneMS(ms);
    if (!done) for (const c of s.cells) if (!c.open) { c.mine = 0; c.n = 0; c.kind = undefined; }
    return s;
  }
  function push() {
    if (room.role !== 'host' || mode !== 'coop') return;
    untrack(() => room.broadcast({ t: 'state', ms: masked(), players: $state.snapshot(players), turn, coopKind, zones, secs }));
  }
  function onMsg(m: any, from: string) {
    if (m.t === 'state' && isGuest) { mode = 'coop'; coopMsg = m; ms = m.ms; players = m.players; turn = m.turn; coopKind = m.coopKind; zones = m.zones; secs = m.secs; return; }
    if (room.role !== 'host') return;
    if (m.t === 'hello') {
      if (!players.some((p) => p.id === from)) players = [...players.filter((p) => !p.bot), { id: from, name: String(m.name).slice(0, 20), score: 0, color: COLORS[players.length % 4] }];
      ensureBot();
      push();
    } else if (m.t === 'act') act(m.a, +m.i, from);
  }
  $effect(() => { if (isGuest && room.status === 'open') untrack(() => room.send({ t: 'hello', name: settings.name })); });
  $effect(() => { void zones; untrack(push); });
  void coopMsg;

  function doAct(a: 'dig' | 'flag' | 'scan', i: number) {
    if (replay) return;
    if (isGuest) { room.send({ t: 'act', a, i }); return; }
    act(a, i);
  }

  // ---------- input: mouse = left dig / right flag; touch = tap + long press ----------
  let press: { i: number; x: number; y: number; timer: ReturnType<typeof setTimeout>; fired: boolean } | null = null;
  let pressing = $state(-1);
  const cellOf = (e: Event) => Number((e.target as HTMLElement).closest<HTMLElement>('[data-i]')?.dataset.i ?? -1);
  const primary = (i: number) => (tool === 'scan' ? doAct('scan', i) : tool === 'flag' && !ms.cells[i].open ? doAct('flag', i) : doAct('dig', i));
  function down(e: PointerEvent) {
    const i = cellOf(e);
    if (i < 0 || done || e.pointerType === 'mouse') return;
    pressing = i;
    press = { i, x: e.clientX, y: e.clientY, fired: false, timer: setTimeout(() => { if (!press) return; press.fired = true; pressing = -1; tool === 'dig' ? doAct('flag', i) : doAct('dig', i); }, 380) };
  }
  function move(e: PointerEvent) { if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) cancel(); }
  function cancel() { if (press) clearTimeout(press.timer); press = null; pressing = -1; }
  function up(e: PointerEvent) {
    if (e.pointerType === 'mouse' || !press) return;
    const { i, fired } = press;
    cancel();
    if (!fired) primary(i);
  }
  function click(e: MouseEvent) {
    const pt = (e as PointerEvent).pointerType;
    if (pt ? pt !== 'mouse' : touch) return;
    const i = cellOf(e);
    if (i >= 0 && !done) primary(i);
  }
  function context(e: MouseEvent) {
    e.preventDefault();
    const i = cellOf(e);
    if (i >= 0 && !done && !touch && !versus) doAct('flag', i);
  }

  const rows = $derived(Array.from({ length: view.h }, (_, y) => Array.from({ length: view.w }, (_, x) => y * view.w + x)));
  const colorOf = (id?: string) => players.find((p) => p.id === id)?.color;
  const lostDist = (i: number) => {
    if (view.hit < 0) return 0;
    return Math.hypot((i % view.w) - (view.hit % view.w), Math.floor(i / view.w) - Math.floor(view.hit / view.w));
  };
  const mm = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const MODES: [Mode, string][] = [['classic', 'Classic'], ['arcade', 'Arcade'], ['coop', 'Co-op']];
  const winner = $derived(versus && ms.state === 'won' ? players.reduce((a, b) => (b.score > a.score ? b : a), players[0]) : null);
</script>

<ArcadeLayout eyebrow="{MODES.find(([m]) => m === mode)![1]} · {ms.w}×{ms.h}{ms.hex ? ' · Hex' : ''}" title="Minesweeper">
  {#snippet controls()}
    <div class="seg three" role="tablist">
      {#each MODES as [m, label]}<button role="tab" class:on={mode === m} aria-selected={mode === m} disabled={isGuest} onclick={() => (mode = m)}>{label}</button>{/each}
    </div>
    <button class="btn primary big" onclick={reset} disabled={isGuest}>{t('ms.new')}</button>

    {#if mode === 'classic'}
      <div class="seg two">
        <button class:on={csub === 'free'} onclick={() => (csub = 'free')}>{L('Freies Spiel', 'Free play')}</button>
        <button class:on={csub === 'campaign'} onclick={() => (csub = 'campaign')}>{L('Kampagne', 'Campaign')}</button>
      </div>
    {/if}
    {#if mode === 'classic' && csub === 'campaign'}
      <div class="map">
        {#each CLASSIC_CAMPAIGN as c, k}
          <button class="lv" class:boss={c.boss} class:done={k < ccamp} class:on={clvl === k} disabled={k > ccamp} onclick={() => (clvl = k)} title="{c.w}×{c.h} · {c.m}">
            {#if c.boss}<span class="crown">♛</span>{/if}<span class="mono">{k + 1}</span>
          </button>
        {/each}
      </div>
      <p class="small muted">{CLASSIC_CAMPAIGN[clvl].boss ? L('Boss-Ebene · ', 'Boss level · ') : ''}{CLASSIC_CAMPAIGN[clvl].w}×{CLASSIC_CAMPAIGN[clvl].h} · {CLASSIC_CAMPAIGN[clvl].m} {L('Minen · ein Leben, keine Hilfen', 'mines · one life, no aids')}{ccamp >= CLASSIC_CAMPAIGN.length ? ' ♛ ' + L('Klassik-Meister!', 'Classic master!') : ''}</p>
    {:else if mode === 'classic'}
      <div class="field">{t('tw.level')}
        <div class="seg four">
          {#each [...Object.keys(LEVELS), 'custom'] as l}
            <button class:on={level === l} onclick={() => (level = l as MsLevel | 'custom')}>{l === 'custom' ? L('Eigene', 'Custom') : t(('ms.' + l) as Key)}</button>
          {/each}
        </div>
      </div>
      {#if level === 'custom'}
        <div class="custom">
          <label>{L('Breite', 'Width')} <input type="range" min="8" max="40" bind:value={cw} /><b class="mono">{cw}</b></label>
          <label>{L('Höhe', 'Height')} <input type="range" min="8" max="30" bind:value={ch} /><b class="mono">{ch}</b></label>
          <label>{L('Minen', 'Mines')} <input type="range" min="5" max={Math.floor(cw * ch * 0.35)} bind:value={cm} /><b class="mono">{cm}</b></label>
          <button class="btn sm" onclick={reset}>{L('Übernehmen', 'Apply')}</button>
        </div>
      {/if}
    {:else if mode === 'arcade'}
      <div class="seg two">
        <button class:on={sub === 'free'} onclick={() => (sub = 'free')}>{L('Freies Spiel', 'Free play')}</button>
        <button class:on={sub === 'campaign'} onclick={() => (sub = 'campaign')}>{L('Kampagne', 'Campaign')}</button>
      </div>
      {#if sub === 'free'}
        <div class="seg">
          {#each [['s', L('Klein', 'Small')], ['m', L('Mittel', 'Medium')], ['l', L('Gross', 'Large')]] as [k, l]}<button class:on={asize === k} onclick={() => (asize = k as 's')}>{l}</button>{/each}
        </div>
        <label class="switch"><span>{L('Sechseck-Raster', 'Hex grid')}</span><input type="checkbox" bind:checked={hex} /></label>
        <p class="lbl">{L('Minen-Typen', 'Mine types')}</p>
        <label class="switch"><span>{L('Doppel-Minen', 'Double mines')}</span><input type="checkbox" bind:checked={doubles} disabled={noGuess} /></label>
        <label class="switch"><span>{L('Wandernde Minen', 'Moving mines')}</span><input type="checkbox" bind:checked={moving} /></label>
        <label class="switch"><span>{L('Zeitbomben', 'Time bombs')}</span><input type="checkbox" bind:checked={timers} /></label>
      {:else}
        <div class="map">
          {#each CAMPAIGN as c, k}
            <button class="lv" class:boss={c.boss} class:done={k < campaign} class:on={lvl === k} disabled={k > campaign} onclick={() => (lvl = k)} title="{c.w}×{c.h} · {c.m}">
              {#if c.boss}<span class="crown">♛</span>{/if}<span class="mono">{k + 1}</span>
            </button>
          {/each}
        </div>
        <p class="small muted">
          {CAMPAIGN[lvl].boss ? L('Boss-Ebene · ', 'Boss level · ') : ''}{CAMPAIGN[lvl].w}×{CAMPAIGN[lvl].h} · {CAMPAIGN[lvl].m} {L('Minen', 'mines')}{CAMPAIGN[lvl].o.hex ? ' · Hex' : ''}{CAMPAIGN[lvl].o.doubles ? ' · ' + L('Doppel', 'doubles') : ''}{CAMPAIGN[lvl].o.moving ? ' · ' + L('wandernd', 'moving') : ''}{CAMPAIGN[lvl].o.timers ? ' · ' + L('Zeitbomben', 'time bombs') : ''}
        </p>
        <p class="small muted">{L('Boni: Level 2 +1 Detektor, Level 4 +1 Schild, Level 8 +1 Scanner zu Beginn jeder Runde.', 'Bonuses: level 2 +1 detector, level 4 +1 shield, level 8 +1 scanner at the start of every round.')}{campaign >= 12 ? ' ♛ ' + L('Minenmeister!', 'Mine master!') : ''}</p>
      {/if}
    {:else}
      <RoomBar {room} />
      <div class="seg two">
        <button class:on={coopKind === 'coop'} disabled={isGuest} onclick={() => (coopKind = 'coop')}>Koop</button>
        <button class:on={coopKind === 'versus'} disabled={isGuest} onclick={() => (coopKind = 'versus')}>{L('Minenjagd', 'Mine hunt')}</button>
      </div>
      <div class="seg two">
        {#each [['s', L('Klein', 'Small')], ['m', L('Gross', 'Large')]] as [k, l]}<button class:on={csize === k} disabled={isGuest} onclick={() => (csize = k as 's')}>{l}</button>{/each}
      </div>
      {#if !versus}<label class="switch"><span>{L('Bereiche aufteilen', 'Split the board')}</span><input type="checkbox" bind:checked={zones} disabled={isGuest} /></label>{/if}
      <label class="switch"><span>{t('bots')}</span><input type="checkbox" bind:checked={settings.bots} disabled={isGuest} /></label>
      <p class="small muted">{versus ? L('Abwechselnd ziehen. Wer eine Mine findet, bekommt einen Punkt und darf nochmal. Mehr als die Hälfte gewinnt.', 'Take turns. Finding a mine scores and you go again. More than half wins.') : L('Gemeinsames Feld, gemeinsame Flaggen und drei gemeinsame Leben.', 'Shared board, shared flags and three shared lives.')}</p>
    {/if}

    {#if mode !== 'classic'}
      <p class="lbl">{L('Komfort (optional)', 'Comfort (optional)')}</p>
      {#if !versus}<label class="switch"><span>{L('Ohne Raten (No-Guess)', 'No-guess boards')}</span><input type="checkbox" bind:checked={noGuess} disabled={isGuest} /></label>{/if}
      {#if !versus}<label class="switch"><span>Smart-Flagging</span><input type="checkbox" bind:checked={smartFlag} /></label>{/if}
    {/if}

    {#if payNow && !isGuest}
      <label class="switch"><span>{t('ms.wager')} <em class="mono">×{payNow}</em></span><input type="checkbox" bind:checked={wager} disabled={ms.state === 'play'} /></label>
      {#if wager}<BetInput bind:value={bet} disabled={ms.state === 'play'} />{/if}
    {/if}
    {#if mode === 'classic'}
      {@const key = level === 'custom' ? `c${cw}x${ch}x${cm}` : level}
      {#if best[key]}<p class="muted small">{t('ms.best')}: <span class="mono">{mm(best[key])}</span></p>{/if}
    {/if}
  {/snippet}

  <div class="frame" class:full>
    <div class="hud">
      <span class="mono chip-stat"><span class="ico"><Sprite kind="bomb" /></span>{versus ? ms.mines - players.reduce((a, p) => a + p.score, 0) : mineTotal - flags}</span>
      {#if ms.lives > 1 || (mode !== 'classic' && !versus)}<span class="lives" aria-label="lives">{#each Array(ms.opts.lives ?? 1) as _, k}<i class:gone={k >= ms.lives}>♥</i>{/each}</span>{/if}
      {#if ms.timer}<span class="mono chip-stat bomb" in:pop>⏱ {ms.timer.left}</span>{/if}
      {#if touch && !versus}
        <div class="mode" role="group" aria-label="Mode">
          <button class:on={tool === 'dig'} onclick={() => (tool = 'dig')}>{t('ms.dig')}</button>
          <button class:on={tool === 'flag'} onclick={() => (tool = 'flag')}>{t('ms.flag')}</button>
        </div>
      {/if}
      <span class="tr">
        <span class="mono chip-stat">{mm(secs)}</span>
        <button class="fs" onclick={toggleFull} aria-label={full ? L('Vollbild beenden', 'Exit full screen') : L('Vollbild', 'Full screen')} title={full ? L('Vollbild beenden (Esc)', 'Exit full screen (Esc)') : L('Vollbild', 'Full screen')}>
          {#if full}<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg>
          {:else}<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>{/if}
        </button>
      </span>
    </div>

    {#if mode === 'arcade' && !replay}
      <div class="items">
        <button class="item" disabled={!items.shield || done} class:active={ms.shield > 0} onclick={useShield} title={L('Verzeiht eine Mine', 'Forgives one mine')}>🛡 {itemName('shield')} <b class="mono">{items.shield}</b></button>
        <button class="item" disabled={!items.scanner || done} class:active={tool === 'scan'} onclick={() => (tool = tool === 'scan' ? 'dig' : 'scan')} title={L('Deckt 3×3 sicher auf', 'Safely reveals 3×3')}>◎ Scanner <b class="mono">{items.scanner}</b></button>
        <button class="item" disabled={!items.detector || ms.state !== 'play'} onclick={useDetector} title={L('Markiert eine Mine', 'Marks one mine')}>⌖ {itemName('detector')} <b class="mono">{items.detector}</b></button>
      </div>
    {/if}
    {#if mode === 'coop' && players.length}
      <div class="players">
        {#each players as p, k}
          <span class="pl" class:turn={versus && turn === k && !done} style="--c:{p.color}"><i></i>{p.name}{#if p.bot} 🤖{/if}{#if versus}<b class="mono">{p.score}</b>{/if}</span>
        {/each}
        {#if versus && !done}<span class="muted small">{players[turn]?.id === myId ? L('Du bist dran', 'Your turn') : L('Warte auf ', 'Waiting for ') + (players[turn]?.name ?? '')}</span>{/if}
      </div>
    {/if}

    <div class="scroll">
      <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
      <div
        class="board"
        class:hex={view.hex}
        class:lost={view.state === 'lost'}
        class:won={view.state === 'won'}
        class:scanning={tool === 'scan'}
        style="--w:{view.w}; --rh:{view.hex ? view.h * 0.84 + 0.3 : view.h}"
        onpointerdown={down}
        onpointermove={move}
        onpointerup={up}
        onpointercancel={cancel}
        onclick={click}
        oncontextmenu={context}>
        {#each rows as row, y}
          <div class="row" class:odd={y % 2 === 1}>
            {#each row as i (i)}
              {@const c = view.cells[i]}
              {@const showMine = !!c.mine && (view.state === 'lost' || (c.open && versus))}
              <button
                class="cell n{Math.min(c.n, 8)}"
                class:open={c.open && !c.mine}
                class:flag={!!c.flag && !c.open}
                class:mine={showMine}
                class:boom={c.boom}
                class:hit={view.hit === i}
                class:wrong={view.state === 'lost' && c.flag && !c.mine}
                class:pressing={pressing === i}
                class:detected={detected === i}
                class:mark={mark === i}
                class:fatal={replay && replay.k === replay.fatal && mark === i}
                class:hint={replay && replay.k >= replay.fatal && replay.hint === i}
                class:zone={mode === 'coop' && zones && !versus && !inZone(i, myId)}
                style="--d:{c.open ? Math.min(c.d, 30) : showMine ? Math.min(lostDist(i) * 1.6, 40) : 0}; --own:{(mode === 'coop' && (c.open || showMine) && colorOf(c.by)) || 'transparent'}"
                data-i={i}
                aria-label={c.open ? String(c.n || '') : c.flag ? 'flag' : 'hidden'}
                tabindex="-1">
                {#if c.open && !c.mine && c.n}{c.n}{/if}
                {#if showMine || c.boom}<span class="ico"><Sprite kind="bomb" /></span>{#if c.mine === 2}<em class="x2">×2</em>{/if}{/if}
                {#if c.flag && !c.open && !showMine && !c.boom}<span class="fl" in:pop={{ duration: 380 }}></span>{#if c.flag === 2}<em class="x2">2</em>{/if}{/if}
              </button>
            {/each}
          </div>
        {/each}
      </div>
    </div>

    {#if toast}{#key toast.id}<div class="toast" class:bad={toast.bad} in:fly={{ y: -10, duration: 220 }}>{toast.text}</div>{/key}{/if}

    {#if done && !replay}
      <div class="banner" class:lose={ms.state === 'lost' || (winner && winner.id !== myId)} in:pop>
        {#if versus && winner}{winner.id === myId ? L('Gewonnen', 'You win') : winner.name + L(' gewinnt', ' wins')} · {winner.score}
        {:else}{ms.state === 'won' ? t('ms.won') + ' · ' + mm(secs) : t('mn.boom')}{/if}
        {#if staked && ms.state === 'won' && (!versus || winner?.id === myId)}<span class="mono"> · +{fmt(Math.round(staked * payNow * 100) / 100)}</span>{/if}
      </div>
    {/if}
    {#if done && frames.length && !versus && mode !== 'classic'}
      <div class="after">
        {#if analysis}<span class="ana" class:good={analysis.good}>{analysis.text}</span>{/if}
        {#if replay}
          <span class="mono small">{replay.k}/{replay.frames.length - 1}</span>
          <button class="btn sm" onclick={() => { replay = null; clearInterval(replayTimer); }}>{L('Replay schliessen', 'Close replay')}</button>
        {:else}
          <button class="btn sm" onclick={startReplay}>▶ Replay</button>
        {/if}
      </div>
    {/if}
  </div>
</ArcadeLayout>

<style>
  .big { min-height: 54px; width: 100%; font-size: 1rem; }
  .seg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .seg.two { grid-template-columns: 1fr 1fr; }
  .seg.four { grid-template-columns: repeat(4, 1fr); }
  .seg button { min-height: 38px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--bg-2); font-size: 0.82rem; transition: background-color 0.25s var(--ease-snap), color 0.25s var(--ease-snap), transform 0.16s var(--ease-snap); }
  .seg button.on { background: var(--text); color: var(--bg); }
  .seg button:active { transform: scale(0.97); }
  .seg button:disabled:not(.on) { opacity: 0.45; }
  .switch em { font-style: normal; color: var(--muted); font-size: 0.8rem; }
  .lbl { margin: 4px 0 -6px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); }
  .muted { color: var(--muted); } .small { font-size: 0.8rem; margin: 0; }
  .custom { display: grid; gap: 8px; padding: 10px 12px; border-radius: 14px; background: var(--bg-2); min-width: 0; }
  .custom label { display: grid; grid-template-columns: 54px minmax(0, 1fr) 28px; align-items: center; gap: 8px; font-size: 0.8rem; min-width: 0; }
  .custom input { accent-color: var(--accent); width: 100%; min-width: 0; margin: 0; }
  .seg.four button { font-size: 0.74rem; padding: 0 2px; min-width: 0; }
  .seg button { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .custom b { font-weight: 500; text-align: right; }
  .map { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
  .lv { position: relative; aspect-ratio: 1; border-radius: 12px; border: 1px solid var(--line-2); background: var(--bg-2); font-size: 0.85rem; }
  .lv.done { background: color-mix(in srgb, #2fbf71 22%, var(--bg-2)); border-color: #2fbf71; }
  .lv.boss { border-color: var(--gold); }
  .lv.on { box-shadow: 0 0 0 2px var(--text); }
  .lv:disabled { opacity: 0.35; }
  .crown { position: absolute; top: -9px; left: 50%; translate: -50% 0; color: var(--gold); font-size: 0.8rem; }

  .frame { position: relative; border-radius: 28px; background: radial-gradient(ellipse at 50% 0%, #1f2a3d, #0b111b 75%); box-shadow: 0 30px 60px -30px rgba(0,0,0,.6); padding: clamp(10px, 2vw, 22px); color: #f4f2ee; }
  .hud { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
  @media (max-width: 640px) { .item { min-height: 32px; padding: 0 9px; font-size: 0.76rem; } .chip-stat { min-width: 0; } }
  .chip-stat { display: inline-flex; align-items: center; gap: 6px; min-width: 64px; flex: none; justify-content: center; padding: 6px 12px; border-radius: 999px; background: rgba(0,0,0,.35); font-size: 1rem; }
  .chip-stat .ico { width: 18px; height: 18px; }
  .chip-stat.bomb { background: #8e1b22; animation: tickt 1s ease-in-out infinite; }
  @keyframes tickt { 50% { box-shadow: 0 0 0 5px rgba(229,72,77,.3); } }
  .lives { display: flex; gap: 3px; font-size: 1.1rem; color: #ff5a6a; }
  .lives i { font-style: normal; transition: opacity 0.3s, transform 0.3s; }
  .lives i.gone { opacity: 0.2; transform: scale(0.8); }
  @media (max-width: 400px) { .hud { gap: 6px; } .chip-stat { padding: 6px 9px; font-size: 0.9rem; } .mode button { padding: 0 10px !important; } }
  .mode { display: flex; padding: 3px; border-radius: 999px; background: rgba(0,0,0,.35); }
  .mode button { border: 0; background: none; color: rgba(255,255,255,.7); min-height: 36px; padding: 0 14px; border-radius: 999px; font-size: 0.85rem; transition: background-color 0.25s var(--ease-snap), color 0.25s var(--ease-snap); }
  .mode button.on { background: #f4f2ee; color: #0b111b; }
  .items { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; margin-bottom: 10px; }
  .item { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,.15); background: rgba(0,0,0,.3); color: #f4f2ee; font-size: 0.82rem; transition: background-color 0.2s, border-color 0.2s; }
  .item b { padding: 1px 7px; border-radius: 999px; background: rgba(255,255,255,.12); font-weight: 500; }
  .item.active { border-color: #f2c046; background: rgba(242,192,70,.18); }
  .item:disabled { opacity: 0.4; }
  .players { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; justify-content: center; margin-bottom: 10px; }
  .pl { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; background: rgba(0,0,0,.3); font-size: 0.82rem; box-shadow: inset 0 0 0 1px rgba(255,255,255,.1); }
  .pl i { width: 10px; height: 10px; border-radius: 50%; background: var(--c); }
  .pl b { margin-left: 4px; color: var(--c); }
  .pl.turn { box-shadow: inset 0 0 0 2px var(--c); }
  .scroll { overflow: auto; max-height: 72vh; border-radius: 14px; }
  .tr { display: flex; gap: 6px; align-items: center; }
  .fs { width: 36px; height: 36px; border-radius: 50%; border: 0; display: grid; place-items: center; background: rgba(0,0,0,.35); color: #f4f2ee; }
  .fs:hover { background: rgba(255,255,255,.12); }
  .frame.full { position: fixed; inset: 0; z-index: 200; border-radius: 0; display: flex; flex-direction: column; padding: 14px 18px; }
  .frame.full .scroll { flex: 1; max-height: none; display: grid; place-items: center; }
  .frame.full .board { --cell: max(16px, min(48px, calc((100vw - 44px) / var(--w) - 3px), calc((100dvh - 150px) / var(--rh) - 3px))); }
  .board {
    --cell: clamp(24px, min(calc((100vw - 64px) / var(--w)), 4.2vw), 40px); --gap: 3px;
    display: grid; gap: var(--gap); width: max-content; margin: 0 auto; padding: 2px;
    user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: manipulation;
  }
  .row { display: flex; gap: var(--gap); }
  .board.hex { gap: 0; }
  .hex .row { margin-top: calc(var(--cell) * -0.28 + var(--gap)); }
  .hex .row:first-child { margin-top: 0; }
  .hex .row.odd { padding-left: calc((var(--cell) + var(--gap)) / 2); }
  .hex .cell { height: calc(var(--cell) * 1.12); border-radius: 0; clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); box-shadow: none; }
  .board.lost { animation: shake 0.45s var(--ease-snap); }
  .board.scanning .cell:not(.open) { cursor: crosshair; }
  @keyframes shake { 20% { transform: translateX(-6px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(2px); } }
  .cell {
    position: relative; width: var(--cell); height: var(--cell); flex: none; padding: 0; border: 0; border-radius: 7px; display: grid; place-items: center;
    background: linear-gradient(180deg, #3a4a68, #2d3a54); box-shadow: inset 0 -3px 0 rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.08);
    font: 800 calc(var(--cell) * 0.5) / 1 'Geist Mono Variable', monospace; color: #fff; cursor: pointer;
    transition: background-color 0.2s var(--ease-snap), transform 0.16s var(--ease-snap);
  }
  @media (hover: hover) and (pointer: fine) { .cell:not(.open):hover { background: linear-gradient(180deg, #46597d, #35445f); } }
  .cell:not(.open):active { transform: scale(0.94); }
  .cell.open { background: #141b29; box-shadow: inset 0 0 0 1px rgba(255,255,255,.04), inset 0 -3px 0 var(--own); cursor: default; animation: reveal 0.4s var(--spring-snappy) both; animation-delay: calc(var(--d) * 18ms); }
  .hex .cell.open { background: #1d2738; }
  .hex .cell { background: linear-gradient(180deg, #46597d, #33415d); }
  .hex .cell.boom, .hex .cell.mine { background: #5a1a1f; }
  .hex .cell.hit, .hex .cell.fatal { background: #8e1b22; }
  @keyframes reveal { from { transform: scale(0.9); opacity: 0; } }
  .n1 { color: #6aa8ff; } .n2 { color: #4fe3a0; } .n3 { color: #ff6b6f; } .n4 { color: #b57bff; }
  .n5 { color: #ffb02e; } .n6 { color: #54d8f0; } .n7 { color: #f4f2ee; } .n8 { color: #9aa0ad; }
  .fl { position: absolute; left: 30%; top: 22%; width: 42%; height: 30%; background: #e5484d; clip-path: polygon(0 0, 100% 50%, 0 100%); }
  .fl::after { content: ''; position: absolute; left: 0; top: 0; width: 2px; height: calc(var(--cell) * 0.5); background: #f4f2ee; }
  .x2 { position: absolute; right: 8%; bottom: 6%; font: 800 calc(var(--cell) * 0.3) 'Geist Mono Variable', monospace; font-style: normal; color: #ffd45a; }
  .cell.mine { background: #2a1418; animation: reveal 0.45s var(--spring-snappy) both; animation-delay: calc(var(--d) * 22ms); box-shadow: inset 0 0 0 2px var(--own); }
  .cell.boom { background: #5a1a1f; }
  .cell.mine .ico, .cell.boom .ico { width: 70%; height: 70%; }
  .cell.hit { background: #8e1b22; box-shadow: 0 0 0 2px #e5484d; }
  .cell.wrong { background: #3a2a10; }
  .cell.wrong::after { content: '×'; position: absolute; color: #ffb02e; font-size: calc(var(--cell) * 0.6); }
  .cell.detected { animation: ping 0.5s ease-in-out 3; }
  @keyframes ping { 50% { box-shadow: 0 0 0 4px #f2c046; } }
  .cell.zone { opacity: 0.55; }
  .cell.mark { box-shadow: 0 0 0 2px #f4f2ee; z-index: 1; }
  .cell.fatal { box-shadow: 0 0 0 3px #e5484d; background: #8e1b22; }
  .cell.hint { box-shadow: 0 0 0 3px #2fbf71; z-index: 1; }
  .cell.pressing::before { content: ''; position: absolute; inset: -3px; border-radius: 9px; border: 2px solid #f2c046; animation: hold 0.38s linear both; }
  @keyframes hold { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
  .board.won .cell.open { animation: wave 0.9s var(--ease-snap) both; animation-delay: calc(var(--d) * 12ms); }
  @keyframes wave { 40% { background: #1f5c43; } }
  .toast { position: absolute; left: 50%; bottom: 14px; translate: -50% 0; z-index: 6; padding: 8px 16px; border-radius: 999px; background: #10151f; box-shadow: 0 0 0 1px #2fbf71, 0 12px 30px rgba(0,0,0,.5); font-size: 0.85rem; white-space: nowrap; pointer-events: none; animation: tfade 2.6s forwards; }
  .toast.bad { box-shadow: 0 0 0 1px #e5484d, 0 12px 30px rgba(0,0,0,.5); }
  @keyframes tfade { 80% { opacity: 1; } to { opacity: 0; } }
  .banner {
    position: absolute; left: 50%; bottom: 64px; translate: -50% 0; padding: 12px 22px; border-radius: 999px; z-index: 5; white-space: nowrap;
    background: #10151f; color: #8ff0bf; font: 700 1.05rem 'Geist Mono Variable', monospace; box-shadow: 0 0 0 2px #2fbf71, 0 20px 50px rgba(0,0,0,.6);
  }
  .banner.lose { color: #ff9a9d; box-shadow: 0 0 0 2px #e5484d, 0 20px 50px rgba(0,0,0,.6); }
  .after { display: flex; gap: 10px; align-items: center; justify-content: center; flex-wrap: wrap; margin-top: 12px; }
  .ana { font-size: 0.85rem; color: #ff9a9d; }
  .ana.good { color: #8ff0bf; }
  @media (prefers-reduced-motion: reduce) { .cell.open, .cell.mine { animation: none; } }
</style>
