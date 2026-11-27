<script lang="ts">
  // Kritzelpost: telephone with pictures, online with friends or with bots (games/doodle.ts has the rules).
  // The host keeps every chain and hands each player only the entry they need for the current step.
  // At the end the host leafs through the chains for everyone; hearts decide who takes the pot.
  import { onDestroy, untrack } from 'svelte';
  import { fly, scale } from 'svelte/transition';
  import HowTo from '../components/HowTo.svelte';
  import RoomBar from '../components/RoomBar.svelte';
  import BetInput from '../components/BetInput.svelte';
  import PotSeats from '../components/PotSeats.svelte';
  import DrawPad from '../components/DrawPad.svelte';
  import DrawView from '../components/DrawView.svelte';
  import { Room } from '../lib/net.svelte';
  import {
    stepsFor, kindOf, author, chainOf, timeFor, peekFor, cleanDrawing, wobble, pickSketch, botGuess, SKETCHES, MONSTER_PARTS, PROMPTS, PARTS,
    type Mode, type Lang, type Kind, type Entry, type Drawing,
  } from '../games/doodle';
  import { sidePots, ranks } from '../games/pot';
  import { wallet, settle, stake as takeStake, fmt, settings } from '../lib/state.svelte';
  import { sfx } from '../lib/sfx';

  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
  const saved = (() => { try { return JSON.parse(localStorage.getItem('betly:doodle') || '{}'); } catch { return {}; } })();
  type Tempo = 'fast' | 'normal' | 'slow';
  const TEMPO: Record<Tempo, { write: number; draw: number }> = { fast: { write: 25, draw: 60 }, normal: { write: 40, draw: 90 }, slow: { write: 60, draw: 150 } };
  let mode = $state<Mode>(saved.mode ?? 'normal');
  let tempo = $state<Tempo>(saved.tempo ?? 'normal');
  let lang = $state<Lang>(saved.lang ?? (settings.lang === 'en' ? 'en' : 'de'));
  let bots = $state<number>(saved.bots ?? 2);
  let bet = $state(10);
  $effect(() => { const s = { mode, tempo, lang, bots }; untrack(() => { try { localStorage.setItem('betly:doodle', JSON.stringify(s)); } catch {} }); });

  type P = { id: string; name: string; bot?: boolean; stake: number; done: boolean; hearts: number };
  const share = $state({
    phase: 'lobby' as 'lobby' | 'play' | 'reveal' | 'end', game: 0, mode: 'normal' as Mode, lang: 'de' as Lang, steps: 0, step: 0, kind: 'write' as Kind, until: 0,
    players: [] as P[], rc: 0, re: -1, hearts: {} as Record<string, number>, payouts: null as Record<string, number> | null,
  });
  let now = $state(Date.now());

  // ---------- host ----------
  let chains: (Entry & { s?: number })[][] = [];
  let hearted = new Set<string>();
  let guests = $state<{ id: string; name: string; stake: number }[]>([]);
  const room = new Room('doodle', onMsg, (id) => {
    guests = guests.filter((g) => g.id !== id);
    if (share.phase === 'lobby') share.players = share.players.filter((p) => p.id !== id);
    else { const i = share.players.findIndex((p) => p.id === id); if (i >= 0 && share.phase === 'play' && !share.players[i].done) { const p = share.players[i]; p.bot = true; p.name += ' 🤖'; botStep(i); } }
    push(true);
  });
  const isHost = $derived(room.role !== 'guest');
  const BOT_NAMES = ['Mila', 'Jonas', 'Lea', 'Sven', 'Nora'];
  const roster = (): P[] => [
    { id: room.myId, name: settings.name || L('Du', 'You'), stake: bet },
    ...guests,
    ...BOT_NAMES.slice(0, bots).map((n, i) => ({ id: 'bot' + i, name: n, bot: true, stake: bet })),
  ].slice(0, 10).map((p) => ({ ...p, done: false, hearts: 0 }));
  const lobby = $derived(share.phase === 'lobby' && isHost ? roster() : share.players);

  function onMsg(m: any, from: string) {
    if (room.role === 'guest') {
      if (m.t === 'state') { const g = share.game; Object.assign(share, m.s); if (g !== share.game) { album = []; myHearts = new Set(); } afterState(); }
      else if (m.t === 'task') takeTask(m);
      else if (m.t === 'entry') showEntry(m);
      return;
    }
    const i = share.players.findIndex((x) => x.id === from);
    if (m.t === 'hello') {
      const g = { id: from, name: String(m.name || 'Guest').slice(0, 20), stake: Math.max(0, Math.min(100000, Number(m.stake) || 0)) };
      const k = guests.findIndex((x) => x.id === from);
      if (k >= 0) guests[k] = g; else guests.push(g);
      push(true);
    } else if (m.t === 'sub' && i >= 0 && share.phase === 'play' && m.game === share.game && m.step === share.step) {
      const kind = kindOf(share.mode, share.step);
      const text = String(m.text ?? '').slice(0, 120);
      submit(i, kind === 'write' || kind === 'guess' ? { by: from, kind, text } : { by: from, kind, draw: cleanDrawing(m.draw) });
    } else if (m.t === 'heart') heart(from, Number(m.c), Number(m.e));
  }
  let lastPush = 0;
  function push(force = false) {
    if (room.role !== 'host') return;
    if (!force && performance.now() - lastPush < 250) return;
    lastPush = performance.now();
    untrack(() => room.broadcast({ t: 'state', s: $state.snapshot(share) }));
  }
  $effect(() => { if (room.role === 'guest' && room.status === 'open') room.send({ t: 'hello', name: settings.name, stake: bet }); });
  $effect(() => { void [guests.length, bet, settings.name, mode, lang, bots]; untrack(() => { if (share.phase === 'lobby') { Object.assign(share, { players: roster(), mode, lang }); push(true); } }); });
  let wasGuest = false;
  $effect(() => {
    if (room.role === 'guest') wasGuest = true;
    else if (wasGuest) untrack(() => { wasGuest = false; Object.assign(share, { phase: 'lobby', players: roster(), payouts: null }); });
  });

  function startGame() {
    if (!isHost || lobby.length < 2 || bet > wallet.balance || (share.phase !== 'lobby' && share.phase !== 'end')) return;
    const players = roster();
    chains = players.map(() => []);
    hearted = new Set();
    Object.assign(share, { game: share.game + 1, mode, lang, steps: stepsFor(mode, players.length), step: -1, players, rc: 0, re: -1, hearts: {}, payouts: null });
    album = []; myHearts = new Set();
    payStake();
    nextStep();
    sfx('shuffle');
  }
  /** Hands every seat its task for the next step, or starts the reveal after the last one. */
  function nextStep() {
    share.step++;
    if (share.step >= share.steps) { share.phase = 'reveal'; share.rc = 0; share.re = -1; push(true); revealNext(); return; }
    const n = share.players.length, s = share.step, kind = kindOf(share.mode, s);
    const peek = kind === 'copy' ? peekFor(s) : 0;
    Object.assign(share, { phase: 'play', kind, until: Date.now() + (peek + timeFor(share.mode, kind, s, TEMPO[tempo])) * 1000 });
    share.players.forEach((p, i) => {
      p.done = false;
      const c = chainOf(i, s, n), input = s > 0 ? chains[c][s - 1] : null;
      const task = { t: 'task', game: share.game, step: s, kind, input: input ? { by: input.by, kind: input.kind, text: input.text, draw: input.draw } : null, peek, until: share.until };
      if (p.bot) botStep(i);
      else if (p.id === room.myId) takeTask(task);
      else room.sendTo(p.id, task);
    });
    push(true);
  }
  function submit(i: number, e: Entry & { s?: number }) {
    const p = share.players[i];
    if (!p || p.done) return;
    chains[chainOf(i, share.step, share.players.length)][share.step] = e;
    p.done = true;
    push(true);
    if (share.players.every((x) => x.done)) setTimeout(() => { if (share.phase === 'play' && share.players.every((x) => x.done)) nextStep(); }, 700);
  }
  /** Bots write, draw or guess after a little while. */
  function botStep(i: number) {
    const s = share.step, g = share.game, n = share.players.length, kind = kindOf(share.mode, s);
    const input = s > 0 ? chains[chainOf(i, s, n)][s - 1] : null;
    const id = share.players[i].id;
    setTimeout(() => {
      if (share.game !== g || share.step !== s || share.phase !== 'play') return;
      let e: Entry & { s?: number };
      if (kind === 'write') e = { by: id, kind, text: PROMPTS[share.lang][Math.floor(Math.random() * PROMPTS[share.lang].length)] };
      else if (kind === 'guess') e = { by: id, kind, text: input?.s !== undefined && Math.random() < 0.75 ? SKETCHES[input.s][share.lang] : botGuess(share.lang) };
      else if (kind === 'draw') { const k = s === 0 ? Math.floor(Math.random() * SKETCHES.length) : pickSketch(input?.text ?? ''); e = { by: id, kind, draw: wobble(SKETCHES[k].draw(), 0.15), s: k }; }
      else if (kind === 'copy') e = { by: id, kind, draw: wobble(input?.draw ?? [], 0.3 + 0.08 * s), s: input?.s };
      else { const parts = MONSTER_PARTS[Math.min(2, s)]; e = { by: id, kind, draw: wobble(parts[Math.floor(Math.random() * parts.length)], 0.1) }; }
      submit(i, e);
    }, 2500 + Math.random() * 6000);
  }
  // ---------- reveal ----------
  function revealNext() {
    if (!isHost || share.phase !== 'reveal') return;
    if (share.re + 1 < share.steps) share.re++;
    else if (share.rc + 1 < chains.length) { share.rc++; share.re = 0; }
    else { finish(); return; }
    const e = chains[share.rc][share.re] ?? { by: '', kind: kindOf(share.mode, share.re), text: '…' };
    const msg = { t: 'entry', game: share.game, c: share.rc, e: share.re, entry: { by: e.by, kind: e.kind, text: e.text, draw: e.draw } };
    room.broadcast(msg);
    showEntry(msg);
    // bots hand out a heart now and then
    for (const b of share.players.filter((p) => p.bot)) if (Math.random() < 0.22) heart(b.id, share.rc, share.re);
    push(true);
    sfx(e.kind === 'write' || e.kind === 'guess' ? 'tick' : 'chip');
  }
  function heart(from: string, c: number, e: number) {
    if (share.phase !== 'reveal' || c !== share.rc || !(e >= 0 && e <= share.re)) return;
    const entry = chains[c]?.[e];
    const key = `${from}:${c}:${e}`;
    if (!entry || entry.by === from || hearted.has(key)) return;
    hearted.add(key);
    share.hearts[`${c}-${e}`] = (share.hearts[`${c}-${e}`] ?? 0) + 1;
    const p = share.players.find((x) => x.id === entry.by);
    if (p) p.hearts++;
    push(true);
  }
  function finish() {
    share.phase = 'end';
    const r = ranks(share.players.map((p) => ({ id: p.id, score: p.hearts })));
    share.payouts = sidePots(share.players.map((p) => ({ id: p.id, stake: p.stake, rank: r[p.id] })));
    push(true);
    afterState();
  }
  // a step that runs out: whatever is missing is handed in empty
  const clock = setInterval(() => {
    now = Date.now();
    if (room.role === 'guest' || share.phase !== 'play' || now < share.until + 2500) return;
    share.players.forEach((p, i) => { if (!p.done) submit(i, { by: p.id, kind: share.kind, ...(share.kind === 'write' || share.kind === 'guess' ? { text: '…' } : { draw: [] }) }); });
  }, 400);
  onDestroy(() => { clearInterval(clock); room.leave(); });

  // ---------- my task ----------
  type Task = { game: number; step: number; kind: Kind; input: Entry | null; peek: number; until: number };
  let task = $state<Task | null>(null);
  let text = $state('');
  let drawing = $state<Drawing>([]);
  let sent = $state(false);
  let peekUntil = $state(0);
  let total = $state(1);
  function takeTask(m: any) {
    task = { game: m.game, step: m.step, kind: m.kind, input: m.input, peek: m.peek, until: m.until };
    total = Math.max(1, (m.until - Date.now()) / 1000 - (m.peek ?? 0));
    text = ''; drawing = []; sent = false;
    peekUntil = Date.now() + (m.peek ?? 0) * 1000;
    sfx('click');
  }
  function send() {
    if (!task || sent) return;
    sent = true;
    const words = task.kind === 'write' || task.kind === 'guess';
    const out = { t: 'sub', game: task.game, step: task.step, ...(words ? { text: text.trim() || '…' } : { draw: $state.snapshot(drawing) }) };
    room.send(out);
    sfx('chip');
  }
  // hand in automatically when the time is up
  $effect(() => { if (task && !sent && share.phase === 'play' && now > task.until - 300) untrack(send); });
  const idea = () => { const list = PROMPTS[share.lang]; text = list[Math.floor(Math.random() * list.length)]; };

  // ---------- the album everyone sees ----------
  let album = $state<{ c: number; e: number; entry: Entry }[]>([]);
  let myHearts = $state(new Set<string>());
  let feed: HTMLElement | undefined = $state();
  function showEntry(m: any) {
    if (m.game !== share.game) return;
    if (album.length && album[album.length - 1].c !== m.c) album = [];
    album = [...album, { c: m.c, e: m.e, entry: m.entry }];
    setTimeout(() => feed?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
  }
  function giveHeart(c: number, e: number) {
    const k = `${c}-${e}`;
    if (myHearts.has(k)) return;
    myHearts = new Set([...myHearts, k]);
    room.send({ t: 'heart', c, e });
    sfx('chip');
  }

  // ---------- money ----------
  let paidGame = -1, settledGame = -1;
  function payStake() {
    const me = share.players.find((p) => p.id === room.myId);
    if (paidGame === share.game || !me) return;
    paidGame = share.game;
    if (me.stake > 0) takeStake(me.stake);
  }
  function afterState() {
    if (share.phase === 'play' || share.phase === 'reveal') payStake();
    if (share.phase === 'end' && share.payouts && settledGame !== share.game && paidGame === share.game) {
      settledGame = share.game;
      const back = share.payouts[room.myId] ?? 0, me = share.players.find((p) => p.id === room.myId);
      settle(back, back);
      sfx(back > (me?.stake ?? 0) ? 'big' : 'lose');
    }
  }

  const nameOf = (id: string) => share.players.find((p) => p.id === id)?.name ?? '?';
  const left = $derived(Math.max(0, Math.ceil(((task?.until ?? share.until) - now) / 1000)));
  const peeking = $derived(!!task && task.kind === 'copy' && now < peekUntil);
  const waitingFor = $derived(share.players.filter((p) => !p.done).map((p) => p.name));
  const seats = $derived(lobby.map((p) => ({ ...p, score: share.phase === 'play' ? (p.done ? '✓' : '✎') : share.phase === 'lobby' ? undefined : `♥ ${p.hearts}` })));
  const chainOwner = $derived(album.length ? nameOf(album[0].entry.by) : '');
  const lastOfAll = $derived(share.rc + 1 >= share.players.length && share.re + 1 >= share.steps);
  const MODES: [Mode, string, string, string][] = $derived([
    ['normal', L('Normal', 'Normal'), L('Schreiben, zeichnen, raten, immer im Wechsel.', 'Write, draw, guess, taking turns.'), '✍️'],
    ['memory', L('Gedächtnis', 'Memory'), L('Kurz anschauen, aus dem Kopf nachzeichnen. Jede Runde weniger Zeit.', 'Look briefly, redraw from memory. Less time every round.'), '🧠'],
    ['monster', L('Monster', 'Monster'), L('Kopf, Körper, Beine: jeder sieht nur den Rand des Teils darüber.', 'Head, body, legs: everyone only sees the edge of the part above.'), '👾'],
  ]);
  const taskTitle = (k: Kind, s: number) => ({
    write: L('Schreib einen lustigen Satz', 'Write a funny sentence'),
    draw: s === 0 ? L('Zeichne irgendwas', 'Draw anything') : L('Zeichne diesen Satz', 'Draw this sentence'),
    guess: L('Was ist auf dem Bild?', 'What is in the picture?'),
    copy: L('Zeichne es aus dem Gedächtnis nach', 'Redraw it from memory'),
    part: L(`Zeichne: ${PARTS.de[s] ?? ''}`, `Draw: ${PARTS.en[s] ?? ''}`),
  })[k];
  const lastOf = (e: { c: number; e: number }) => e.e === share.re && e.c === share.rc;
  void author;
</script>

<section class="dd">
  <header class="head">
    <div class="h1row"><h1>{L('Kritzelpost', 'Doodle Post')}</h1><span class="eyebrow">{share.phase === 'play' ? L(`Schritt ${share.step + 1} / ${share.steps}`, `Step ${share.step + 1} / ${share.steps}`) : 'Party'}</span><HowTo id="doodle" /></div>
    <div></div>
    <div class="right"><RoomBar {room} /></div>
  </header>

  <div class="layout">
    <aside class="panel">
      {#if share.phase === 'lobby' || share.phase === 'end'}
        <div class="field">{L('Dein Einsatz im Topf', 'Your stake in the pot')}<BetInput bind:value={bet} /></div>
        {#if isHost}
          <div class="field">{L('Tempo', 'Pace')}<div class="seg">{#each [['fast', L('Schnell', 'Fast')], ['normal', 'Normal'], ['slow', L('Gemütlich', 'Relaxed')]] as [k, lb]}<button class:on={tempo === k} onclick={() => (tempo = k as Tempo)}>{lb}</button>{/each}</div></div>
          <div class="row2">
            <div class="field">{L('Bots', 'Bots')}<div class="seg">{#each [0, 1, 2, 3, 4] as k}<button class:on={bots === k} onclick={() => (bots = k)}>{k}</button>{/each}</div></div>
            <div class="field">{L('Sprache', 'Language')}<div class="seg">{#each ['de', 'en'] as l}<button class:on={lang === l} onclick={() => (lang = l as Lang)}>{l.toUpperCase()}</button>{/each}</div></div>
          </div>
          <button class="btn primary big" disabled={lobby.length < 2 || bet > wallet.balance} onclick={startGame}>{lobby.length < 2 ? L('Bot oder Freund dazunehmen', 'Add a bot or a friend') : share.phase === 'end' ? L('Neues Spiel', 'New game') : L('Los geht’s', 'Start')}</button>
          <small class="muted">{L('Am lustigsten mit Freunden: oben «Raum öffnen» und den Link teilen. Bots zeichnen aus ihrem eigenen Skizzenbuch.', 'Best with friends: "Open room" at the top and share the link. Bots draw from their own sketchbook.')}</small>
        {:else}<p class="muted small">{L('Der Gastgeber wählt den Modus und startet.', 'The host picks the mode and starts.')}</p>{/if}
      {:else if share.phase === 'play'}
        <div class="status"><b>{sent ? L('Abgegeben ✓', 'Handed in ✓') : taskTitle(share.kind, share.step)}</b><span class="mono" class:low={left <= 10}>{left}s</span></div>
        <div class="bar"><i style="width:{Math.min(100, (left / total) * 100)}%"></i></div>
        {#if sent && waitingFor.length}<p class="muted small">{L('Warten auf', 'Waiting for')} {waitingFor.join(', ')}</p>{/if}
      {:else}
        <div class="status"><b>{L('Auflösung', 'The reveal')}</b><span class="mono">{share.rc + 1} / {share.players.length}</span></div>
        {#if isHost}<button class="btn primary big" onclick={revealNext}>{lastOfAll ? L('Ergebnis', 'Results') : share.re + 1 >= share.steps ? L('Nächste Kette →', 'Next chain →') : L('Weiter →', 'Next →')}</button>
        {:else}<p class="muted small">{L('Der Gastgeber blättert weiter. Verteil Herzen für die besten Einträge!', 'The host turns the pages. Hand out hearts for the best entries!')}</p>{/if}
      {/if}
      <PotSeats {seats} me={room.myId} payouts={share.phase === 'end' ? share.payouts : null} />
    </aside>

    <div class="desk">
      {#if share.phase === 'lobby'}
        <div class="modes">
          {#each MODES as [k, lb, txt, ic], i}
            <button class="mode" class:on={(isHost ? mode : share.mode) === k} disabled={!isHost} onclick={() => (mode = k)} style="--i:{i}">
              <span class="ic">{ic}</span><b>{lb}</b><small>{txt}</small>
            </button>
          {/each}
        </div>
        <div class="how">
          {#if (isHost ? mode : share.mode) === 'monster'}
            <div class="mstack"><span>{L('Kopf', 'Head')}</span><span>{L('Körper', 'Body')}</span><span>{L('Beine', 'Legs')}</span></div>
          {:else}
            <ol class="flow">
              {#each ((isHost ? mode : share.mode) === 'memory' ? [['✏️', L('Zeichnen', 'Draw')], ['👀', L('Anschauen', 'Look')], ['✏️', L('Nachzeichnen', 'Redraw')], ['🎞️', L('Auflösung', 'Reveal')]] : [['💬', L('Schreiben', 'Write')], ['✏️', L('Zeichnen', 'Draw')], ['🤔', L('Raten', 'Guess')], ['🎞️', L('Auflösung', 'Reveal')]]) as [ic, lb], i}
                <li style="--i:{i}"><span>{ic}</span>{lb}</li>
              {/each}
            </ol>
          {/if}
          <p class="muted">{L('Jeder startet eine Kette. Am Ende seht ihr, was aus jedem Anfang geworden ist, und verteilt Herzen. Die meisten Herzen gewinnen den Topf.', 'Everyone starts a chain. At the end you see what became of every start and hand out hearts. Most hearts win the pot.')}</p>
        </div>
      {:else if share.phase === 'play' && task}
        {#key task.step}
          <div class="task" in:fly={{ y: 14, duration: 450 }}>
            {#if task.input && (task.kind === 'draw')}
              <div class="prompt"><small>{nameOf(task.input.by)} {L('schreibt', 'writes')}</small><b>«{task.input.text}»</b></div>
            {:else if task.input && task.kind === 'guess'}
              <div class="seen"><DrawView drawing={task.input.draw ?? []} /></div>
            {/if}
            {#if task.kind === 'write' || task.kind === 'guess'}
              <div class="write">
                <input bind:value={text} maxlength="120" disabled={sent} placeholder={task.kind === 'write' ? L('z. B. «Ein Pinguin in der Wüste»', 'e.g. "A penguin in the desert"') : L('Ich sehe …', 'I see …')} onkeydown={(e) => e.key === 'Enter' && send()} />
                {#if task.kind === 'write' && !sent}<button class="btn" onclick={idea} title={L('Idee', 'Idea')}>💡</button>{/if}
                <button class="btn primary" disabled={sent} onclick={send}>{sent ? '✓' : L('Fertig', 'Done')}</button>
              </div>
            {:else if peeking}
              <div class="peek"><DrawView drawing={task.input?.draw ?? []} /><span class="pk mono">{Math.ceil((peekUntil - now) / 1000)}</span><p>{L('Gut anschauen …', 'Take a good look …')}</p></div>
            {:else}
              {#if task.kind === 'part'}<p class="partlbl">{taskTitle('part', task.step)}{#if task.step > 0} · <span class="muted">{L('oben siehst du den Rand des Teils darüber', 'at the top you see the edge of the part above')}</span>{/if}</p>{/if}
              <DrawPad bind:drawing guide={task.kind === 'part' && task.input ? (task.input.draw ?? []) : null} disabled={sent} />
              <div class="doneRow"><button class="btn primary big" disabled={sent} onclick={send}>{sent ? L('Abgegeben ✓', 'Handed in ✓') : L('Fertig', 'Done')}</button></div>
            {/if}
          </div>
        {/key}
      {:else if share.phase === 'reveal' || share.phase === 'end'}
        {#if share.phase === 'end'}
          <div class="final" in:scale={{ start: 0.95 }}>
            <h2>{ranks(share.players.map((p) => ({ id: p.id, score: p.hearts })))[room.myId] === 1 ? L('Die meisten Herzen! 🏆', 'Most hearts! 🏆') : L('Herzen verteilt', 'Hearts handed out')}</h2>
            <ol>{#each [...share.players].sort((a, b) => b.hearts - a.hearts) as p, i (p.id)}<li class:me={p.id === room.myId} style="--i:{i}"><b>{i + 1}.</b> {p.name}<span class="mono">♥ {p.hearts}</span></li>{/each}</ol>
          </div>
        {/if}
        {#if album.length}
          <div class="chainhead"><span class="eyebrow">{L('Kette von', 'Chain of')}</span><b>{chainOwner}</b></div>
          <div class="feed" class:monster={share.mode === 'monster'} bind:this={feed}>
            {#each album as a (a.c + '-' + a.e)}
              {@const k = `${a.c}-${a.e}`}
              <div class="ent {a.entry.kind}" in:fly={{ y: 18, duration: 500 }}>
                {#if share.mode !== 'monster'}<span class="who"><i>{nameOf(a.entry.by).slice(0, 1)}</i>{nameOf(a.entry.by)}</span>{/if}
                <div class="body" class:txt={a.entry.text !== undefined}>
                  {#if a.entry.text !== undefined}<p class="bubble">{a.entry.text}</p>
                  {:else}<div class="pic"><DrawView drawing={a.entry.draw ?? []} /></div>{/if}
                  {#if share.phase === 'reveal' && a.entry.by !== room.myId && a.entry.by}
                    <button class="heart" class:on={myHearts.has(k)} onclick={() => giveHeart(a.c, a.e)} aria-label="♥">♥ <span class="mono">{share.hearts[k] ?? 0}</span></button>
                  {:else if share.hearts[k]}<span class="heart static">♥ <span class="mono">{share.hearts[k]}</span></span>{/if}
                </div>
              </div>
            {/each}
            {#if share.mode === 'monster' && share.phase === 'reveal' && lastOf(album[album.length - 1])}<p class="muted small cap">{album.map((a) => nameOf(a.entry.by)).join(' · ')}</p>{/if}
          </div>
        {/if}
      {/if}
    </div>
  </div>
</section>

<style>
  .dd { width: min(100%, 1320px); margin-inline: auto; padding: 0 20px 48px; display: grid; gap: 14px; }
  @media (min-width: 1700px) { .dd { zoom: 1.12; } }
  .head { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px 16px; padding: 12px 4px 0; min-height: 64px; }
  .right { display: flex; justify-content: flex-end; min-width: 0; }
  @media (max-width: 1100px) { .head { grid-template-columns: 1fr; } .right { justify-content: flex-start; } }
  .h1row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  h1 { margin: 0; font-size: clamp(1.7rem, 3vw, 2.4rem); letter-spacing: -0.04em; line-height: 1; }
  .muted { color: var(--muted); } .small { font-size: 0.82rem; }
  .layout { display: grid; grid-template-columns: 300px 1fr; gap: 18px; align-items: start; }
  @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } .panel { order: 2; } }
  .panel { display: grid; gap: 14px; padding: 16px; border-radius: 24px; background: var(--surface); box-shadow: inset 0 0 0 1px var(--line); }
  .field { display: grid; gap: 6px; font-size: 0.85rem; }
  .row2 { display: grid; grid-template-columns: 1.4fr 1fr; gap: 8px; }
  .seg { display: flex; border: 1px solid var(--line-2); border-radius: 999px; padding: 3px; gap: 3px; }
  .seg button { flex: 1; border: 0; background: none; min-height: 32px; padding: 0 6px; border-radius: 999px; color: var(--muted); font-size: 0.8rem; font-weight: 600; transition: background 0.3s var(--ease-snap), color 0.3s var(--ease-snap); }
  .seg button.on { background: var(--text); color: var(--bg); }
  .big { min-height: 50px; width: 100%; }
  .status { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 14px; background: var(--surface-2); }
  .status .low { color: #ff9a9d; animation: pulse 0.9s ease-in-out infinite alternate; }
  @keyframes pulse { to { opacity: 0.5; } }
  .bar { height: 6px; border-radius: 3px; background: var(--surface-2); overflow: hidden; margin-top: -8px; }
  .bar i { display: block; height: 100%; background: linear-gradient(90deg, #f76b15, #f5d90a); transition: width 0.4s linear; }

  /* the desk: a cork board with paper on it */
  .desk {
    min-height: 520px; padding: clamp(14px, 2.6vw, 30px); border-radius: 30px; display: grid; align-content: start; gap: 16px; color: #2b2a3a;
    background: radial-gradient(circle at 20% 15%, rgba(255,255,255,.18), transparent 40%), repeating-radial-gradient(circle at 30% 40%, rgba(120,70,20,.08) 0 2px, transparent 2px 7px), linear-gradient(160deg, #c79a62, #a87842);
    box-shadow: inset 0 0 0 8px #6b4423, inset 0 0 0 10px rgba(255,230,180,.35), 0 30px 60px -30px rgba(0,0,0,.7);
  }
  .modes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  @media (max-width: 640px) { .modes { grid-template-columns: 1fr; } }
  .mode { position: relative; display: grid; gap: 6px; justify-items: start; text-align: left; padding: 16px; border-radius: 6px; border: 0; background: #fffdf6; color: #2b2a3a; box-shadow: 0 10px 20px -10px rgba(0,0,0,.5); transform: rotate(calc((var(--i) - 1) * 1.6deg)); transition: transform 0.45s var(--spring-snappy), box-shadow 0.3s var(--ease-snap); animation: pin 0.6s var(--spring-snappy) calc(var(--i) * 80ms) backwards; }
  .mode::before { content: ''; position: absolute; top: -7px; left: 50%; width: 14px; height: 14px; margin-left: -7px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #ff8a8d, #c8262c); box-shadow: 0 2px 3px rgba(0,0,0,.4); }
  .mode:hover:not(:disabled) { transform: rotate(0) translateY(-4px); }
  .mode.on { box-shadow: 0 0 0 3px #f5d90a, 0 14px 26px -10px rgba(0,0,0,.6); transform: rotate(0) scale(1.03); }
  .mode .ic { font-size: 1.8rem; }
  .mode b { font-size: 1.15rem; }
  .mode small { font-size: 0.82rem; color: #5b5a68; }
  @keyframes pin { from { opacity: 0; transform: translateY(-16px) rotate(-6deg); } }
  .how { display: grid; gap: 12px; padding: 18px; border-radius: 6px; background: #fffdf6; box-shadow: 0 10px 20px -10px rgba(0,0,0,.5); }
  .how .muted { color: #5b5a68; margin: 0; }
  .flow { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .flow li { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 999px; background: #f1ead8; font-weight: 600; animation: pin 0.5s var(--spring-snappy) calc(var(--i) * 90ms + 200ms) backwards; }
  .flow li:not(:last-child)::after { content: '→'; margin-left: 8px; color: #9a8f7a; }
  .mstack { display: grid; width: min(220px, 60%); }
  .mstack span { padding: 14px; text-align: center; font-weight: 700; border: 2px dashed #b9ad94; margin-top: -2px; background: #fbf6e8; }

  .task { display: grid; gap: 14px; max-width: 860px; width: 100%; justify-self: center; }
  .prompt { display: grid; gap: 4px; padding: 16px 20px; border-radius: 6px; background: #fff7c2; box-shadow: 0 10px 20px -10px rgba(0,0,0,.5); transform: rotate(-0.8deg); }
  .prompt small { color: #6b6a78; font-size: 0.78rem; }
  .prompt b { font: italic 600 1.5rem 'Instrument Serif', Georgia, serif; }
  .seen { padding: 10px; border-radius: 6px; background: #fffdf6; box-shadow: 0 10px 20px -10px rgba(0,0,0,.5); }
  .write { display: flex; gap: 8px; }
  .write input { flex: 1; min-width: 0; min-height: 54px; padding: 0 18px; border-radius: 14px; border: 2px solid rgba(0,0,0,.15); background: #fffdf6; color: #2b2a3a; font: 600 1.1rem inherit; outline: none; }
  .write input:focus { border-color: #f76b15; }
  .write .btn { min-height: 54px; }
  .peek { position: relative; display: grid; gap: 8px; justify-items: center; }
  .peek .pk { position: absolute; top: 12px; right: 16px; width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; background: #2b2a3a; color: #fff; font-size: 1.3rem; font-weight: 700; animation: pulse 0.5s ease-in-out infinite alternate; }
  .peek p { margin: 0; font-weight: 700; color: #fffdf6; text-shadow: 0 1px 2px rgba(0,0,0,.5); }
  .partlbl { margin: 0; font-weight: 700; color: #fffdf6; text-shadow: 0 1px 2px rgba(0,0,0,.4); }
  .partlbl .muted { color: #f3e6cf; font-weight: 500; }
  .task :global(.tools) { padding: 10px; border-radius: 16px; background: rgba(30,20,10,.55); }
  .doneRow { display: flex; justify-content: flex-end; }
  .doneRow .big { width: auto; padding: 0 36px; }

  .final { display: grid; gap: 10px; padding: 16px 20px; border-radius: 6px; background: #fffdf6; box-shadow: 0 10px 20px -10px rgba(0,0,0,.5); }
  .final h2 { margin: 0; }
  .final ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  .final li { display: flex; gap: 8px; padding: 6px 10px; border-radius: 10px; background: #f3efe2; animation: pin 0.5s var(--spring-snappy) calc(var(--i) * 80ms) backwards; }
  .final li.me { box-shadow: inset 0 0 0 2px #c9973f; }
  .final li .mono { margin-left: auto; font-weight: 700; color: #d6409f; }
  .chainhead { display: flex; align-items: baseline; gap: 10px; color: #fffdf6; text-shadow: 0 1px 2px rgba(0,0,0,.4); }
  .chainhead .eyebrow { color: #f3e6cf; }
  .chainhead b { font-size: 1.4rem; }
  .feed { display: grid; gap: 14px; max-width: 720px; width: 100%; justify-self: center; }
  .ent { position: relative; display: grid; gap: 6px; }
  .who { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 700; color: #fffdf6; text-shadow: 0 1px 2px rgba(0,0,0,.4); }
  .who i { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-style: normal; background: #f5d90a; color: #2b2a3a; text-shadow: none; }
  .bubble { margin: 0; padding: 14px 18px; border-radius: 18px 18px 18px 4px; background: #fffdf6; font: italic 600 1.35rem 'Instrument Serif', Georgia, serif; box-shadow: 0 10px 20px -12px rgba(0,0,0,.5); justify-self: start; max-width: 100%; }
  .pic { padding: 8px; border-radius: 6px; background: #fffdf6; box-shadow: 0 12px 24px -12px rgba(0,0,0,.55); }
  .body { position: relative; }
  .body.txt { justify-self: start; display: flex; align-items: center; gap: 10px; }
  .body.txt .heart { position: static; }
  .heart { position: absolute; right: 16px; bottom: 16px; display: inline-flex; gap: 5px; align-items: center; padding: 6px 12px; border-radius: 999px; border: 0; background: rgba(43,42,58,.85); color: #fff; font-weight: 700; transition: transform 0.35s var(--spring-snappy), background 0.25s var(--ease-snap); }
  .heart:hover { transform: scale(1.08); }
  .heart.on { background: #d6409f; animation: beat 0.5s var(--spring-snappy); }
  .heart.static { pointer-events: none; }
  @keyframes beat { 30% { transform: scale(1.3); } }
  /* monster: the parts stack into one creature */
  .feed.monster { gap: 0; max-width: 520px; }
  .feed.monster .pic { padding: 0 8px; border-radius: 0; box-shadow: none; }
  .feed.monster .ent:first-child .pic { padding-top: 8px; border-radius: 6px 6px 0 0; }
  .feed.monster .ent:last-of-type .pic { padding-bottom: 8px; border-radius: 0 0 6px 6px; }
  .feed.monster :global(.view) { border-radius: 0; box-shadow: none; }
  /* the top 15 % of a part was the guide strip: cut it off so the parts join */
  .feed.monster .ent + .ent .pic { overflow: hidden; }
  .feed.monster .ent + .ent .pic :global(.view) { margin-top: -11.25%; }
  .cap { margin: 8px 0 0; color: #f3e6cf; text-align: center; }
  @media (prefers-reduced-motion: reduce) { .mode, .flow li, .final li, .heart.on, .status .low, .peek .pk { animation: none; } }
</style>
