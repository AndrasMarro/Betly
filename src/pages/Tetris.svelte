<script lang="ts">
  import FullscreenButton, { fs } from '../components/FullscreenButton.svelte';
  let arenaEl = $state<HTMLElement>();
  // full screen: grow the play area until it fills the screen
  let zoom = $state(1);
  $effect(() => {
    if (!fs.on || !arenaEl) { zoom = 1; return; }
    requestAnimationFrame(() => {
      const kids = [...arenaEl!.children].filter((c) => !c.classList.contains('fsb')) as HTMLElement[];
      const w = kids.reduce((a, c) => a + c.offsetWidth, 0) + 40, h = Math.max(...kids.map((c) => c.offsetHeight)) + 30;
      zoom = Math.max(1, Math.min((innerWidth - 24) / w, (innerHeight - 24) / h));
    });
  });
  // Falling blocks. Klassisch: alone, faster with every 10 lines, coins for every cleared line.
  // Versus: side by side against bots or friends in a room; cleared lines rise as garbage under the others,
  // the last one standing wins a bonus. Everybody plays their own well; the host relays boards and attacks.
  import { onDestroy, onMount, untrack } from 'svelte';
  import { fly } from 'svelte/transition';
  import HowTo from '../components/HowTo.svelte';
  import RoomBar from '../components/RoomBar.svelte';
  import { Room } from '../lib/net.svelte';
  import * as T from '../games/tetris';
  import { board as drawBoard, block, well, preview } from '../games/tetrisDraw';
  import { settle, fmt, settings } from '../lib/state.svelte';
  import { sfx } from '../lib/sfx';

  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
  const S = 30; // cell size of the main well in canvas pixels
  const saved = (() => { try { return JSON.parse(localStorage.getItem('betly:tetris') || '{}'); } catch { return {}; } })();
  let best = $state<number>(saved.best ?? 0);
  let startLevel = $state<number>(saved.level ?? 1);
  let botCount = $state<number>(saved.bots ?? 1);
  let botSkill = $state<'easy' | 'mid' | 'hard'>(saved.skill ?? 'mid');
  $effect(() => { try { localStorage.setItem('betly:tetris', JSON.stringify({ best, level: startLevel, bots: botCount, skill: botSkill })); } catch {} });

  let mode = $state<'classic' | 'versus'>('classic');
  let phase = $state<'idle' | 'count' | 'play' | 'pause' | 'over'>('idle');
  let count = $state(0);
  let g: T.Game | null = null; // my game; mutated every frame, so not reactive
  const ui = $state({ score: 0, lines: 0, level: 1, pending: 0, earned: 0, hold: null as T.Kind | null });
  let flash: { rows: number[]; t: number } | null = null;
  let paidOut = $state(0); // coins paid at the end of the last game
  let mainCv: HTMLCanvasElement, nextCv: HTMLCanvasElement, holdCv: HTMLCanvasElement;

  // ---------- versus: shared state (the host decides) ----------
  type P = { id: string; name: string; bot?: boolean; board: string; score: number; lines: number; alive: boolean; place: number; pending: number };
  const share = $state({ phase: 'lobby' as 'lobby' | 'count' | 'play' | 'end', round: 0, seed: 0, players: [] as P[], winner: '' });
  let myRound = 0;
  type Bot = { p: P; g: T.Game; next: number; target: { r: number; x: number } | null };
  let bots: Bot[] = [];
  let guests = $state<{ id: string; name: string }[]>([]);
  const room = new Room('tetris', onMsg, (id) => {
    guests = guests.filter((x) => x.id !== id);
    const p = share.players.find((x) => x.id === id);
    if (p && p.alive) eliminate(p);
    share.players = share.players.filter((x) => x.id !== id);
    push(true);
  });
  const isHost = $derived(room.role !== 'guest');
  $effect(() => { if (room.role !== 'solo') untrack(() => { mode = 'versus'; }); });
  const blank = '0'.repeat(T.W * T.H);
  const BOT_NAMES = ['Mila', 'Jonas', 'Lea'];
  const fresh = (id: string, name: string, bot = false): P => ({ id, name, bot, board: blank, score: 0, lines: 0, alive: true, place: 0, pending: 0 });
  /** Everybody who would play the next round: me, the guests in the room and the bots. */
  const roster = () => [fresh(room.myId, settings.name || L('Du', 'You')), ...guests.map((x) => fresh(x.id, x.name)), ...Array.from({ length: botCount }, (_, i) => fresh('bot' + i, BOT_NAMES[i], true))];
  const lobby = $derived<P[]>(share.phase === 'lobby' && isHost ? roster() : share.players);
  const SKILL = { easy: { delay: 520, miss: 0.25 }, mid: { delay: 300, miss: 0.08 }, hard: { delay: 150, miss: 0 } };

  function onMsg(m: any, from: string) {
    if (room.role === 'guest') {
      if (m.t === 'state') {
        const fresh = m.s.phase === 'count' && m.s.round !== myRound;
        Object.assign(share, m.s);
        if (fresh) { myRound = share.round; begin(share.seed, 1); }
        if (share.phase === 'end' && phase === 'play') finishVersus();
        if (share.phase === 'end' && phase !== 'play') untrack(() => settleVersus());
      } else if (m.t === 'garbage' && g && !g.over) { T.receive(g, m.n); ui.pending = g.pending; sfx('stop'); }
      return;
    }
    // host
    if (m.t === 'hello') {
      if (!guests.some((x) => x.id === from)) guests.push({ id: from, name: String(m.name || 'Guest').slice(0, 20) });
      else guests.find((x) => x.id === from)!.name = String(m.name || 'Guest').slice(0, 20);
      push(true);
    } else if (m.t === 'b') {
      const p = share.players.find((x) => x.id === from);
      if (!p || share.phase !== 'play') return;
      Object.assign(p, { board: String(m.board).slice(0, T.W * T.H), score: +m.score || 0, lines: +m.lines || 0, pending: +m.pending || 0 });
      if (!m.alive && p.alive) eliminate(p);
    } else if (m.t === 'atk' && share.phase === 'play') route(from, Math.min(10, +m.n || 0));
  }
  let lastPush = 0;
  function push(force = false) {
    if (room.role !== 'host') return;
    const now = performance.now();
    if (!force && now - lastPush < 250) return;
    lastPush = now;
    untrack(() => room.broadcast({ t: 'state', s: $state.snapshot(share) }));
  }
  $effect(() => { if (room.role === 'guest' && room.status === 'open') room.send({ t: 'hello', name: settings.name }); });
  $effect(() => { void [guests.length, botCount, settings.name]; untrack(() => { if (share.phase === 'lobby') { share.players = $state.snapshot(lobby); push(true); } }); });
  let wasGuest = false;
  $effect(() => {
    if (room.role === 'guest') wasGuest = true;
    else if (wasGuest) untrack(() => { wasGuest = false; Object.assign(share, { phase: 'lobby', players: [], winner: '' }); stopGame(); });
  });

  /** Send garbage from one player to another one that is still in (host only). */
  function route(from: string, n: number) {
    if (n <= 0) return;
    const alive = share.players.filter((p) => p.alive && p.id !== from);
    if (!alive.length) return;
    const to = alive[Math.floor(Math.random() * alive.length)];
    if (to.id === room.myId) { if (g && !g.over) { T.receive(g, n); ui.pending = g.pending; sfx('stop'); } }
    else if (to.bot) { const b = bots.find((x) => x.p.id === to.id); if (b) T.receive(b.g, n); }
    else room.sendTo(to.id, { t: 'garbage', n });
  }
  function eliminate(p: P) {
    p.alive = false;
    p.place = share.players.filter((x) => x.alive).length + 1;
    const alive = share.players.filter((x) => x.alive);
    if (share.players.length > 1 && alive.length <= 1) {
      share.winner = alive[0]?.id ?? p.id;
      if (alive[0]) alive[0].place = 1;
      share.phase = 'end';
      if (phase === 'play') finishVersus(); else settleVersus();
    }
    push(true);
  }

  // ---------- starting and ending ----------
  function begin(seed: number, level: number) {
    g = T.newGame(seed, level);
    Object.assign(ui, { score: 0, lines: 0, level, pending: 0, earned: 0, hold: null });
    paidOut = 0;
    flash = null;
    phase = 'count';
    count = 3;
    sfx('click');
    const tick = () => {
      count--;
      if (count > 0) { sfx('click'); countTimer = setTimeout(tick, 650); }
      else { phase = 'play'; gravityAt = performance.now(); sfx('chip'); }
    };
    countTimer = setTimeout(tick, 650);
  }
  let countTimer: ReturnType<typeof setTimeout> | undefined;
  function startClassic() {
    if (phase === 'play' || phase === 'count') return;
    begin(Math.floor(Math.random() * 2 ** 31), startLevel);
  }
  function startVersus() {
    if (!isHost || share.phase === 'count' || share.phase === 'play') return;
    const seed = Math.floor(Math.random() * 2 ** 31);
    share.players = roster();
    Object.assign(share, { phase: 'count', round: share.round + 1, seed, winner: '' });
    myRound = share.round;
    const now = performance.now();
    bots = share.players.filter((p) => p.bot).map((p, i) => ({ p, g: T.newGame(seed, 1), next: now + 2000 + i * 90, target: null }));
    push(true);
    begin(seed, 1);
    setTimeout(() => { if (share.phase === 'count') { share.phase = 'play'; push(true); } }, 1950);
  }
  /** Pay the coins of this game (once). */
  function payCoins(extra = 0) {
    const c = ui.earned + extra;
    if (c > 0) settle(c, c);
    paidOut = c;
    ui.earned = 0;
  }
  function gameOver() {
    phase = 'over';
    sfx('lose');
    best = Math.max(best, ui.score);
    if (mode === 'classic') payCoins();
    else {
      sendBoard(true);
      if (isHost) { const me = share.players.find((p) => p.id === room.myId); if (me && me.alive) eliminate(me); }
    }
  }
  function finishVersus() { if (g && !g.over) { g.over = true; phase = 'over'; } settleVersus(); }
  let settledRound = -1;
  function settleVersus() {
    if (settledRound === share.round) return;
    settledRound = share.round;
    const won = share.winner === room.myId, bonus = won ? 50 * Math.max(1, share.players.length - 1) : 0;
    best = Math.max(best, ui.score);
    payCoins(bonus);
    sfx(won ? 'big' : 'stop');
  }
  function stopGame() { clearTimeout(countTimer); g = null; phase = 'idle'; }
  function setMode(m: 'classic' | 'versus') {
    if (mode === m || phase === 'play' || phase === 'count' || (m === 'classic' && room.role !== 'solo')) return;
    if (ui.earned) payCoins();
    mode = m; stopGame();
    Object.assign(share, { phase: 'lobby', winner: '' });
  }

  // ---------- my moves ----------
  function locked() {
    if (!g) return;
    const n = g.cleared.length;
    if (n) {
      flash = { rows: g.cleared.map((y) => y - T.HIDDEN), t: performance.now() };
      ui.earned += T.coinsFor(n, g.level);
      sfx(n === 4 ? 'big' : n > 1 ? 'win' : 'cash');
    } else sfx('bounce');
    if (g.sent) { if (isHost) route(room.myId, g.sent); else room.send({ t: 'atk', n: g.sent }); }
    Object.assign(ui, { score: g.score, lines: g.lines, level: g.level, pending: g.pending, hold: g.hold });
    if (mode === 'versus') sendBoard(true);
    if (g.over) gameOver();
  }
  function act(fn: () => unknown, sound: 'click' | 'tick' | null = null) {
    if (phase !== 'play' || !g) return;
    if (fn() && sound) sfx(sound);
  }
  const left = () => act(() => g && T.move(g, -1));
  const right = () => act(() => g && T.move(g, 1));
  const rotCw = () => act(() => g && T.rotate(g, 1), 'tick');
  const rotCcw = () => act(() => g && T.rotate(g, -1), 'tick');
  const drop = () => act(() => { if (!g) return; T.hardDrop(g); gravityAt = performance.now(); locked(); });
  const soft = () => act(() => { if (!g) return; if (T.step(g)) locked(); else g.score += 1; gravityAt = performance.now(); });
  const hold = () => act(() => { if (g && T.holdPiece(g)) { ui.hold = g.hold; sfx('chip'); } });
  function pause() {
    if (mode !== 'classic') return;
    if (phase === 'play') phase = 'pause';
    else if (phase === 'pause') { phase = 'play'; gravityAt = performance.now(); }
  }

  // held keys: sideways auto-repeat and soft drop
  const held: Record<string, number> = {};
  let repeatAt = 0;
  function keydown(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    const k = e.code;
    const known = ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Space', 'KeyX', 'KeyZ', 'KeyC', 'ShiftLeft', 'ShiftRight', 'KeyP', 'Escape', 'KeyA', 'KeyD', 'KeyS', 'KeyW'];
    if (!known.includes(k)) return;
    if (phase === 'play' || phase === 'count' || k === 'Space') e.preventDefault();
    if (e.repeat) return;
    if (k === 'Space' && phase !== 'play' && phase !== 'count' && phase !== 'pause') { if (mode === 'classic') startClassic(); else startVersus(); return; }
    held[k] = performance.now();
    repeatAt = performance.now() + 150;
    if (k === 'ArrowLeft' || k === 'KeyA') left();
    else if (k === 'ArrowRight' || k === 'KeyD') right();
    else if (k === 'ArrowDown' || k === 'KeyS') soft();
    else if (k === 'ArrowUp' || k === 'KeyX' || k === 'KeyW') rotCw();
    else if (k === 'KeyZ') rotCcw();
    else if (k === 'Space') drop();
    else if (k === 'KeyC' || k.startsWith('Shift')) hold();
    else if (k === 'KeyP' || k === 'Escape') pause();
  }
  const keyup = (e: KeyboardEvent) => { delete held[e.code]; };
  // touch buttons repeat while pressed
  let touchTimer: ReturnType<typeof setInterval> | undefined;
  function press(fn: () => void, repeat = true) {
    fn();
    clearInterval(touchTimer);
    if (repeat) { const t0 = setTimeout(() => (touchTimer = setInterval(fn, 55)), 170); touchTimer = t0 as unknown as ReturnType<typeof setInterval>; }
  }
  const release = () => clearInterval(touchTimer);

  // ---------- the loop ----------
  let raf = 0, gravityAt = 0, boardAt = 0;
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    if (g && phase === 'play') {
      // auto-repeat for held keys
      const side = held.ArrowLeft || held.KeyA ? -1 : held.ArrowRight || held.KeyD ? 1 : 0;
      if (side && now >= repeatAt) { T.move(g, side); repeatAt = now + 45; }
      if ((held.ArrowDown || held.KeyS) && now - (held.ArrowDown || held.KeyS) > 120 && now - gravityAt > 35) soft();
      if (g && now - gravityAt >= T.speed(g.level)) { gravityAt = now; if (T.step(g)) locked(); }
      if (mode === 'versus' && now - boardAt > 400) sendBoard();
    }
    if (mode === 'versus' && isHost && share.phase === 'play') { runBots(now); push(); }
    draw(now);
  }
  function sendBoard(force = false) {
    if (!g) return;
    const now = performance.now();
    if (!force && now - boardAt < 400) return;
    boardAt = now;
    const msg = { board: T.snapshot(g), score: g.score, lines: g.lines, alive: !g.over, pending: g.pending };
    if (isHost) { const me = share.players.find((p) => p.id === room.myId); if (me) Object.assign(me, msg, { alive: me.alive }); }
    else room.send({ t: 'b', ...msg });
  }
  function runBots(now: number) {
    for (const b of bots) {
      if (!b.p.alive || now < b.next) continue;
      const sk = SKILL[botSkill];
      b.next = now + sk.delay * (0.7 + Math.random() * 0.6);
      const q = b.g;
      if (!b.target) {
        b.target = T.plan(q);
        if (Math.random() < sk.miss) b.target = { r: b.target.r + (Math.random() < 0.5 ? 1 : 0), x: b.target.x + (Math.random() < 0.5 ? -1 : 1) };
      }
      // rotate, then slide; when blocked, just drop where it is
      const turn = ((b.target.r - q.cur.r) % 4 + 4) % 4 !== 0;
      if (turn && T.rotate(q, 1)) { /* turned */ }
      else if (!turn && q.cur.x !== b.target.x && T.move(q, Math.sign(b.target.x - q.cur.x))) { /* moved */ }
      else {
        T.hardDrop(q);
        b.target = null;
        if (q.sent) route(b.p.id, q.sent);
        if (q.over) { b.p.board = T.snapshot(q); eliminate(b.p); continue; }
      }
      Object.assign(b.p, { board: T.snapshot(q), score: q.score, lines: q.lines, pending: q.pending });
    }
  }

  // ---------- drawing ----------
  function draw(now: number) {
    if (!mainCv) return;
    const c = mainCv.getContext('2d')!;
    if (!g) { well(c, S); }
    else {
      well(c, S);
      for (let y = 0; y < T.H; y++) for (let x = 0; x < T.W; x++) { const v = g.board[(y + T.HIDDEN) * T.W + x]; if (v) block(c, x * S, y * S, S, v, g.over ? 0.4 : 1); }
      if (!g.over && phase !== 'count') {
        const gy = T.ghost(g);
        for (const [cx, cy] of T.cells(g.cur.k, g.cur.r)) {
          const y = gy + cy - T.HIDDEN;
          if (y >= 0) { c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.strokeRect((g.cur.x + cx) * S + 3, y * S + 3, S - 6, S - 6); }
        }
        for (const [cx, cy] of T.cells(g.cur.k, g.cur.r)) { const y = g.cur.y + cy - T.HIDDEN; if (y >= 0) block(c, (g.cur.x + cx) * S, y * S, S, T.colorOf(g.cur.k)); }
      }
      if (flash) {
        const k = (now - flash.t) / 260;
        if (k >= 1) flash = null;
        else { c.fillStyle = `rgba(255,248,220,${0.85 * (1 - k)})`; for (const y of flash.rows) if (y >= 0) c.fillRect(0, y * S, T.W * S, S); }
      }
    }
    if (nextCv) {
      const n = nextCv.getContext('2d')!;
      n.clearRect(0, 0, nextCv.width, nextCv.height);
      g?.queue.slice(0, 5).forEach((k, i) => preview(n, k, nextCv.width / 2, 34 + i * 62, i ? 15 : 19, i ? 0.85 : 1));
    }
    if (holdCv) {
      const h = holdCv.getContext('2d')!;
      h.clearRect(0, 0, holdCv.width, holdCv.height);
      if (g?.hold) preview(h, g.hold, holdCv.width / 2, holdCv.height / 2, 19, g.canHold ? 1 : 0.4);
    }
  }
  /** Small boards of the opponents. */
  function mini(node: HTMLCanvasElement, b: string) {
    const paint = (s: string) => drawBoard(node.getContext('2d')!, s, 12);
    paint(b);
    return { update: paint };
  }

  onMount(() => { raf = requestAnimationFrame(frame); });
  onDestroy(() => {
    cancelAnimationFrame(raf); clearTimeout(countTimer); clearInterval(touchTimer);
    if (ui.earned > 0) settle(ui.earned, ui.earned);
    room.leave();
  });

  const opponents = $derived((share.phase === 'lobby' ? lobby : share.players).filter((p) => p.id !== room.myId));
  const ranking = $derived([...share.players].sort((a, b) => (a.place || 99) - (b.place || 99)));
</script>

<svelte:window onkeydown={keydown} onkeyup={keyup} />

<section class="tt">
  <header class="head">
    <div class="h1row">
      <h1>Tetris</h1>
      <span class="eyebrow">{mode === 'classic' ? L('Klassisch · Coins pro Linie', 'Classic · coins per line') : L('Versus · Linien rauf zum Gegner', 'Versus · send lines up')}</span>
      <HowTo id="tetris" />
    </div>
    <div class="tabs" role="tablist">
      <button role="tab" aria-selected={mode === 'classic'} class:on={mode === 'classic'} disabled={room.role !== 'solo' || phase === 'play'} onclick={() => setMode('classic')}>{L('Klassisch', 'Classic')}</button>
      <button role="tab" aria-selected={mode === 'versus'} class:on={mode === 'versus'} disabled={phase === 'play'} onclick={() => setMode('versus')}>Versus</button>
    </div>
    <div class="right">{#if mode === 'versus'}<RoomBar {room} />{/if}</div>
  </header>

  <div class="arena" class:vs={mode === 'versus'} class:full={fs.on} bind:this={arenaEl} style={fs.on ? `--z:${zoom}` : ''}>
    <span class="fsb"><FullscreenButton target={arenaEl} /></span>
    <aside class="side l">
      <div class="box"><small>Hold <kbd>C</kbd></small><canvas bind:this={holdCv} width="110" height="70"></canvas></div>
      <div class="stats">
        <span><small>{L('Punkte', 'Score')}</small><b class="mono">{ui.score.toLocaleString('de-CH')}</b></span>
        <span><small>{L('Linien', 'Lines')}</small><b class="mono">{ui.lines}</b></span>
        <span><small>Level</small><b class="mono">{ui.level}</b></span>
        <span class="coins"><small>Coins</small><b class="mono">+{fmt(ui.earned || paidOut)}</b></span>
        <span><small>{L('Rekord', 'Best')}</small><b class="mono">{best.toLocaleString('de-CH')}</b></span>
      </div>
      <p class="keys muted">← → {L('schieben', 'move')} · ↑ {L('drehen', 'rotate')} · ↓ {L('schneller', 'soft drop')} · {L('Leertaste', 'Space')} {L('fallen lassen', 'hard drop')}{mode === 'classic' ? ' · P Pause' : ''}</p>
    </aside>

    <div class="wellbox">
      {#if mode === 'versus' && ui.pending}<div class="meter" style="--h:{Math.min(20, ui.pending) * 5}%"></div>{/if}
      <canvas class="main" bind:this={mainCv} width={T.W * S} height={T.H * S}></canvas>
      {#if phase === 'count'}<div class="over"><strong class="cnt" in:fly={{ y: -10 }}>{count}</strong></div>
      {:else if phase === 'pause'}<div class="over"><strong>Pause</strong><button class="btn primary" onclick={pause}>{L('Weiter', 'Resume')}</button></div>
      {:else if phase !== 'play'}
        <div class="over">
          {#if mode === 'classic'}
            {#if phase === 'over'}<strong>Game over</strong><span class="mono">{ui.score.toLocaleString('de-CH')} {L('Punkte', 'points')} · {ui.lines} {L('Linien', 'lines')}</span>{#if paidOut}<span class="mono pos">+{fmt(paidOut)} Coins</span>{/if}
            {:else}<strong>Tetris</strong>{/if}
            <div class="field">Start-Level
              <div class="seg">{#each [1, 5, 10, 15] as lv}<button class:on={startLevel === lv} onclick={() => (startLevel = lv)}>{lv}</button>{/each}</div>
            </div>
            <button class="btn primary big" onclick={startClassic}>{phase === 'over' ? L('Nochmal', 'Play again') : L('Start', 'Start')}</button>
            <small class="muted">{L('Coins pro Linie × Level, 4 Linien auf einmal zahlen am meisten.', 'Coins per line × level, 4 lines at once pay the most.')}</small>
          {:else if share.phase === 'end'}
            <strong>{share.winner === room.myId ? L('Gewonnen!', 'You win!') : L('Vorbei', 'Game over')}</strong>
            <ol class="rank">{#each ranking as p}<li class:me={p.id === room.myId}><b>{p.place || '–'}.</b> {p.name}<span class="mono">{p.lines} {L('Linien', 'lines')}</span></li>{/each}</ol>
            {#if paidOut}<span class="mono pos">+{fmt(paidOut)} Coins</span>{/if}
            {#if isHost}<button class="btn primary big" onclick={startVersus}>{L('Neue Runde', 'New round')}</button>{:else}<small class="muted">{L('Der Gastgeber startet die nächste Runde.', 'The host starts the next round.')}</small>{/if}
          {:else if phase === 'over'}
            <strong>{L('Ausgeschieden', 'Knocked out')}</strong><small class="muted">{L('Die anderen spielen noch …', 'The others are still playing …')}</small>
          {:else}
            <strong>Versus</strong>
            <small class="muted">{L('Wer 2+ Linien auf einmal löscht, schickt Müll-Zeilen zu den anderen. Wer übrig bleibt, gewinnt.', 'Clear 2+ lines at once to send garbage rows to the others. Last one standing wins.')}</small>
            {#if isHost}
              <div class="field">Bots
                <div class="seg">{#each [0, 1, 2, 3] as k}<button class:on={botCount === k} onclick={() => (botCount = k)}>{k}</button>{/each}</div>
              </div>
              {#if botCount}<div class="seg">{#each [['easy', L('Leicht', 'Easy')], ['mid', L('Mittel', 'Medium')], ['hard', L('Schwer', 'Hard')]] as [s, lb]}<button class:on={botSkill === s} onclick={() => (botSkill = s as typeof botSkill)}>{lb}</button>{/each}</div>{/if}
              <button class="btn primary big" disabled={roster().length < 2} onclick={startVersus}>{roster().length < 2 ? L('Bot oder Freund dazunehmen', 'Add a bot or a friend') : L('Start', 'Start')}</button>
            {:else}<small class="muted">{L('Warten auf den Gastgeber …', 'Waiting for the host …')}</small>{/if}
          {/if}
        </div>
      {/if}
    </div>

    <aside class="side r">
      <div class="box"><small>{L('Nächste', 'Next')}</small><canvas bind:this={nextCv} width="110" height="300"></canvas></div>
    </aside>

    {#if mode === 'versus'}
      <div class="opps">
        {#each opponents as p (p.id)}
          <div class="opp" class:out={!p.alive} class:win={share.phase === 'end' && share.winner === p.id}>
            <div class="on"><span class="av" class:bot={p.bot}>{p.name.slice(0, 1)}</span>{p.name}<span class="mono">{p.lines}</span></div>
            <canvas use:mini={p.board} width={T.W * 12} height={T.H * 12}></canvas>
            {#if !p.alive}<span class="ko">{p.place}.</span>{/if}
          </div>
        {:else}<p class="muted small">{L('Noch keine Gegner. Nimm Bots dazu oder eröffne oben einen Raum.', 'No opponents yet. Add bots or open a room at the top.')}</p>{/each}
      </div>
    {/if}
  </div>

  <!-- touch controls -->
  <div class="pad" aria-label="Controls">
    <button onpointerdown={() => press(left)} onpointerup={release} onpointerleave={release} aria-label="left">◀</button>
    <button onpointerdown={() => press(right)} onpointerup={release} onpointerleave={release} aria-label="right">▶</button>
    <button onpointerdown={() => press(rotCw, false)} aria-label="rotate">⟳</button>
    <button onpointerdown={() => press(soft)} onpointerup={release} onpointerleave={release} aria-label="soft drop">▼</button>
    <button onpointerdown={() => press(drop, false)} aria-label="hard drop">⤓</button>
    <button onpointerdown={() => press(hold, false)} aria-label="hold">C</button>
  </div>
</section>

<style>
  .arena { position: relative; }
  .fsb { position: absolute; top: 0; right: 0; z-index: 5; }

  .arena.full > :global(*:not(.fsb)) { zoom: var(--z, 1); }
  .tt { width: min(100%, 1280px); margin-inline: auto; padding: 0 20px 40px; display: grid; gap: 14px; }
  .head { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px 16px; padding: 12px 4px 0; min-height: 64px; }
  .right { display: flex; justify-content: flex-end; min-width: 0; }
  @media (max-width: 1100px) { .head { grid-template-columns: 1fr auto; } .right { grid-column: 1 / -1; justify-content: flex-start; } .right:empty { display: none; } }
  @media (max-width: 640px) { .head { grid-template-columns: 1fr; } .tabs { justify-self: start; } }
  .h1row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  h1 { margin: 0; font-size: clamp(1.7rem, 3vw, 2.4rem); letter-spacing: -0.04em; line-height: 1; }
  .tabs { display: flex; gap: 4px; padding: 4px; border-radius: 999px; background: var(--surface); box-shadow: inset 0 0 0 1px var(--line-2); }
  .tabs button { border: 0; background: none; color: var(--muted); min-height: 36px; padding: 0 18px; border-radius: 999px; font-weight: 600; }
  .tabs button.on { background: linear-gradient(180deg, #f3d488, #c9973f); color: #2a1604; }
  .muted { color: var(--muted); } .small { font-size: 0.8rem; }
  .pos { color: #6ff0a6; }

  .arena {
    display: grid; grid-template-columns: 150px auto 150px; justify-content: center; align-items: start; gap: 18px;
    padding: clamp(14px, 2.4vw, 28px); border-radius: 32px; color: #f2ecdc;
    background: radial-gradient(ellipse at 50% 0%, #1f2a55, #0b1022 75%); box-shadow: inset 0 0 0 1px rgba(232,196,120,.25), 0 30px 60px -30px rgba(0,0,0,.7);
  }
  .arena.vs { grid-template-columns: 150px auto 150px minmax(0, 1fr); }
  /* full screen: same columns, each part scaled up, the whole thing centred */
  .arena.full { grid-template-columns: repeat(3, auto); place-content: center; border-radius: 0; box-shadow: none; }
  .arena.full.vs { grid-template-columns: repeat(4, auto); }
  .arena.full > .side { width: 150px; }
  .side { display: grid; gap: 12px; align-content: start; }
  .box { display: grid; gap: 4px; padding: 10px; border-radius: 16px; background: rgba(0,0,0,.28); box-shadow: inset 0 0 0 1px rgba(232,196,120,.25); }
  .box small, .stats small { font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(242,236,220,.55); }
  .box canvas { width: 100%; height: auto; }
  kbd { font: 600 0.62rem 'Geist Mono Variable', monospace; padding: 0 4px; border-radius: 4px; background: rgba(255,255,255,.1); }
  .stats { display: grid; gap: 6px; }
  .stats span { display: grid; padding: 6px 10px; border-radius: 12px; background: rgba(0,0,0,.22); }
  .stats b { font-size: 1.1rem; }
  .stats .coins b { color: #f3d488; }
  .keys { font-size: 0.72rem; line-height: 1.5; margin: 0; color: rgba(242,236,220,.5); }

  .wellbox { position: relative; padding: 8px; border-radius: 14px; background: linear-gradient(160deg, #6b3d22, #24120a); box-shadow: inset 0 0 0 2px rgba(232,196,120,.55), 0 20px 40px rgba(0,0,0,.5); }
  .main { display: block; width: min(300px, calc((100dvh - 260px) / 2)); min-width: 200px; height: auto; border-radius: 6px; }
  .meter { position: absolute; left: -10px; bottom: 8px; width: 6px; height: var(--h); border-radius: 3px; background: linear-gradient(#ff8a8d, #e5484d); box-shadow: 0 0 10px rgba(229,72,77,.7); transition: height 0.2s; }
  .over { position: absolute; inset: 8px; border-radius: 6px; display: grid; place-content: center; justify-items: center; gap: 10px; padding: 16px; text-align: center; background: rgba(8,10,24,.78); backdrop-filter: blur(2px); }
  .over strong { font-size: 1.7rem; }
  .over .cnt { font-size: 4rem; color: #f3d488; }
  .over .big { min-width: 180px; min-height: 48px; }
  .field { display: grid; gap: 6px; font-size: 0.8rem; justify-items: center; }
  .seg { display: flex; border: 1px solid rgba(255,255,255,.2); border-radius: 999px; padding: 3px; gap: 3px; }
  .seg button { border: 0; background: none; min-height: 32px; min-width: 40px; padding: 0 10px; border-radius: 999px; color: rgba(242,236,220,.65); font-size: 0.8rem; }
  .seg button.on { background: #f2ecdc; color: #11152a; }
  .rank { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; min-width: 200px; }
  .rank li { display: flex; gap: 8px; padding: 4px 10px; border-radius: 10px; background: rgba(255,255,255,.06); }
  .rank li.me { box-shadow: inset 0 0 0 1px #e8c478; }
  .rank .mono { margin-left: auto; color: rgba(242,236,220,.55); }

  .opps { display: flex; flex-wrap: wrap; gap: 12px; align-content: start; }
  .opp { position: relative; display: grid; gap: 4px; padding: 6px; border-radius: 12px; background: rgba(0,0,0,.28); box-shadow: inset 0 0 0 1px rgba(232,196,120,.2); }
  .opp canvas { width: 120px; height: 240px; border-radius: 4px; }
  .opp.out canvas { filter: grayscale(1) brightness(0.5); }
  .opp.win { box-shadow: inset 0 0 0 2px #f3d488, 0 0 20px rgba(243,212,136,.4); }
  .opp .on { display: flex; align-items: center; gap: 6px; font-size: 0.78rem; }
  .opp .on .mono { margin-left: auto; color: rgba(242,236,220,.6); }
  .av { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; background: #e8c478; color: #2a1c05; font-weight: 700; font-size: 0.66rem; }
  .av.bot { background: rgba(255,255,255,.12); color: rgba(255,255,255,.75); }
  .ko { position: absolute; inset: 30px 6px 6px; display: grid; place-items: center; font: 800 2rem 'Geist Mono Variable', monospace; color: rgba(255,255,255,.7); }

  .pad { display: none; }
  @media (max-width: 900px), (pointer: coarse) {
    .arena, .arena.vs { grid-template-columns: 1fr auto 1fr; gap: 10px; padding: 12px; }
    .side.l { order: 0; } .wellbox { order: 1; } .side.r { order: 2; }
    .keys { display: none; }
    .opps { grid-column: 1 / -1; order: 3; justify-content: center; }
    .opp canvas { width: 80px; height: 160px; }
    .pad { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; position: sticky; bottom: 8px; z-index: 5; }
    .pad button { min-height: 58px; border-radius: 16px; border: 0; background: var(--surface-2); color: var(--text); font-size: 1.3rem; touch-action: manipulation; user-select: none; }
  }
  @media (max-width: 600px) {
    .tt { padding: 0 6px 20px; }
    .arena, .arena.vs { grid-template-columns: 58px auto 58px; gap: 6px; padding: 8px; border-radius: 22px; }
    .box { padding: 5px; border-radius: 10px; }
    .box small, .stats small { font-size: 0.56rem; letter-spacing: 0.04em; }
    .stats span { padding: 3px 5px; border-radius: 8px; }
    .stats b { font-size: 0.78rem; }
    .wellbox { padding: 5px; }
    .main { width: calc(100vw - 172px); min-width: 0; max-width: 260px; }
    .pad { gap: 5px; }
    .pad button { min-height: 52px; font-size: 1.1rem; }
  }
</style>
