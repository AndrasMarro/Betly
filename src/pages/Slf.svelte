<script lang="ts">
  // Stadt Land Fluss, online with friends or with bots. The host sets categories, rounds and time; every round a
  // letter is drawn, everybody writes, then all answers are shown and anyone can vote an answer down.
  // A few jokers per game (first come, first served) double one player's round, and everyone sees it.
  // Everything is set in the settings dialog: rounds, times, stop rule, letters, points, jokers, bots.
  // Stakes go into the pot and are shared like side pots by the final ranking (games/pot.ts).
  import { onDestroy, untrack } from 'svelte';
  import { fly, scale } from 'svelte/transition';
  import HowTo from '../components/HowTo.svelte';
  import RoomBar from '../components/RoomBar.svelte';
  import BetInput from '../components/BetInput.svelte';
  import PotSeats from '../components/PotSeats.svelte';
  import { Room } from '../lib/net.svelte';
  import { CLASSIC, POINTS, defaultCats, letters, fits, norm, scoreRound, isRejected, botAnswers, looksFake, type Cat, type Lang, type BotSkill, type Points } from '../games/slf';
  import { sidePots, ranks } from '../games/pot';
  import { wallet, settle, stake as takeStake, fmt, settings } from '../lib/state.svelte';
  import { sfx } from '../lib/sfx';
  import FullscreenButton, { fs } from '../components/FullscreenButton.svelte';

  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
  const saved = (() => { try { return JSON.parse(localStorage.getItem('betly:slf') || '{}'); } catch { return {}; } })();
  let lang = $state<Lang>(saved.lang ?? (settings.lang === 'en' ? 'en' : 'de'));
  let cats = $state<Cat[]>(saved.cats ?? defaultCats(saved.lang ?? (settings.lang === 'en' ? 'en' : 'de')));
  type Cfg = { rounds: number; time: number; review: number; pause: number; stop: boolean; grace: number; letters: string; jokers: number; jokerX: number; bots: number; skill: BotSkill; pts: Points };
  const DEF: Cfg = { rounds: 5, time: 90, review: 60, pause: 7, stop: true, grace: 10, letters: letters(false).join(''), jokers: 1, jokerX: 2, bots: 2, skill: 'mid', pts: { ...POINTS } };
  let cfg = $state<Cfg>({ ...DEF, ...saved.cfg, pts: { ...POINTS, ...saved.cfg?.pts } });
  let bet = $state(10);
  let dark = $state<boolean>(saved.dark ?? false);
  let sectionEl = $state<HTMLElement>();
  $effect(() => { const s = { lang, cats: $state.snapshot(cats), cfg: $state.snapshot(cfg), dark }; untrack(() => { try { localStorage.setItem('betly:slf', JSON.stringify(s)); } catch {} }); });
  /** Keep every number inside sensible limits (the inputs accept anything). */
  const clampNum = (v: unknown, lo: number, hi: number, d: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  function tidy() {
    cfg.rounds = clampNum(cfg.rounds, 1, 26, 5); cfg.time = clampNum(cfg.time, 15, 900, 90); cfg.review = clampNum(cfg.review, 10, 600, 60);
    cfg.pause = clampNum(cfg.pause, 2, 60, 7); cfg.grace = clampNum(cfg.grace, 0, 120, 10); cfg.jokers = clampNum(cfg.jokers, 0, 20, 1);
    cfg.jokerX = clampNum(cfg.jokerX, 2, 5, 2); cfg.bots = clampNum(cfg.bots, 0, 5, 2);
    for (const k of ['only', 'unique', 'same'] as const) cfg.pts[k] = clampNum(cfg.pts[k], 0, 1000, POINTS[k]);
    if (cfg.letters.length < 3) cfg.letters = DEF.letters;
  }

  type P = { id: string; name: string; bot?: boolean; stake: number; score: number; joker: 0 | 1 | 2; filled: number; done: boolean };
  const share = $state({
    phase: 'lobby' as 'lobby' | 'letter' | 'write' | 'review' | 'scores' | 'end', game: 0, round: 0,
    rounds: 5, time: 90, stop: true, grace: 10, jokersLeft: 1, jokerX: 2, ptsCfg: { ...POINTS } as Points, lang: 'de' as Lang, cats: [] as Cat[], letter: '', used: [] as string[], until: 0, stopBy: '',
    players: [] as P[], answers: {} as Record<string, string[]>, rejects: {} as Record<string, string[][]>, pts: {} as Record<string, number[]>,
    payouts: null as Record<string, number> | null,
  });
  let now = $state(Date.now());

  // ---------- host ----------
  let got: Record<string, string[]> = {}; // everyone's answers this round, revealed only in the review
  let botFinal: Record<string, string[]> = {};
  let guests = $state<{ id: string; name: string; stake: number }[]>([]);
  const room = new Room('slf', onMsg, (id) => {
    guests = guests.filter((g) => g.id !== id);
    share.players = share.players.filter((p) => p.id !== id || share.phase !== 'lobby');
    const p = share.players.find((x) => x.id === id);
    if (p) p.done = true;
    push(true);
  });
  const isHost = $derived(room.role !== 'guest');
  const BOT_NAMES = ['Mila', 'Jonas', 'Lea', 'Sven', 'Nora'];
  const roster = (): P[] => [
    { id: room.myId, name: settings.name || L('Du', 'You'), stake: bet },
    ...guests,
    ...BOT_NAMES.slice(0, cfg.bots).map((n, i) => ({ id: 'bot' + i, name: n, bot: true, stake: bet })),
  ].map((p) => ({ ...p, score: 0, joker: 0, filled: 0, done: false }));
  const lobby = $derived(share.phase === 'lobby' && isHost ? roster() : share.players);

  function onMsg(m: any, from: string) {
    if (room.role === 'guest') {
      if (m.t === 'state') {
        const newRound = m.s.round !== share.round || m.s.game !== share.game, stopped = !share.stopBy && m.s.stopBy;
        Object.assign(share, m.s);
        if (newRound) resetMine();
        if (stopped && share.phase === 'write') { clearTimeout(sendTimer); room.send({ t: 'ans', round: share.round, list: $state.snapshot(mine) }); } // someone stopped: hand in right now
        afterState();
      }
      return;
    }
    const p = share.players.find((x) => x.id === from);
    if (m.t === 'hello') {
      const g = { id: from, name: String(m.name || 'Guest').slice(0, 20), stake: Math.max(0, Math.min(100000, Number(m.stake) || 0)) };
      const i = guests.findIndex((x) => x.id === from);
      if (i >= 0) guests[i] = g; else guests.push(g);
      push(true);
    } else if (m.t === 'ans' && p && share.phase === 'write' && m.round === share.round && now <= share.until + 1500) {
      got[from] = (Array.isArray(m.list) ? m.list : []).slice(0, share.cats.length).map((x: unknown) => String(x ?? '').slice(0, 40));
      p.filled = got[from].filter((x) => x.trim()).length;
      push();
    } else if (m.t === 'stop') stop(from);
    else if (m.t === 'joker') joker(from);
    else if (m.t === 'vote') vote(from, String(m.pid), Number(m.ci));
    else if (m.t === 'done' && p && share.phase === 'review') { p.done = true; maybeScore(); push(true); }
  }
  let lastPush = 0;
  function push(force = false) {
    if (room.role !== 'host') return;
    if (!force && performance.now() - lastPush < 300) return;
    lastPush = performance.now();
    untrack(() => room.broadcast({ t: 'state', s: $state.snapshot(share) }));
  }
  $effect(() => { if (room.role === 'guest' && room.status === 'open') room.send({ t: 'hello', name: settings.name, stake: bet }); });
  $effect(() => { void [guests.length, bet, settings.name, lang, cats.length, JSON.stringify(cfg)]; untrack(() => { if (share.phase === 'lobby') { Object.assign(share, { players: roster(), cats: $state.snapshot(cats), lang, rounds: cfg.rounds, time: cfg.time, stop: cfg.stop, grace: cfg.grace, jokersLeft: cfg.jokers, jokerX: cfg.jokerX, ptsCfg: { ...cfg.pts } }); push(true); } }); });
  let wasGuest = false;
  $effect(() => {
    if (room.role === 'guest') wasGuest = true;
    else if (wasGuest) untrack(() => { wasGuest = false; Object.assign(share, { phase: 'lobby', players: roster(), payouts: null }); });
  });

  function startGame() {
    if (!isHost || cats.length < 3 || bet > wallet.balance || (share.phase !== 'lobby' && share.phase !== 'end')) return;
    tidy();
    Object.assign(share, { game: share.game + 1, round: 0, rounds: cfg.rounds, time: cfg.time, stop: cfg.stop, grace: cfg.grace, jokersLeft: cfg.jokers, jokerX: cfg.jokerX, ptsCfg: { ...cfg.pts }, lang, cats: $state.snapshot(cats), used: [], players: roster(), payouts: null });
    payStake();
    nextRound();
  }
  function nextRound() {
    let pool = [...cfg.letters].filter((l) => !share.used.includes(l));
    if (!pool.length) { share.used = []; pool = [...cfg.letters]; } // more rounds than letters: start over
    const letter = pool[Math.floor(Math.random() * pool.length)];
    got = {}; botFinal = {};
    for (const p of share.players) {
      p.filled = 0; p.done = false;
      if (p.joker === 1) p.joker = 2;
      if (p.bot) botFinal[p.id] = botAnswers(share.cats, letter, share.lang, cfg.skill);
    }
    Object.assign(share, { phase: 'letter', round: share.round + 1, letter, used: [...share.used, letter], until: Date.now() + 2800, stopBy: '', answers: {}, rejects: {}, pts: {} });
    resetMine();
    push(true);
  }
  function stop(by: string) {
    if (share.phase !== 'write' || !share.stop || share.stopBy) return;
    const a = got[by] ?? [];
    if (a.length < share.cats.length || a.some((x) => !x.trim())) return;
    share.stopBy = by;
    share.until = Math.min(share.until, Date.now() + share.grace * 1000); // 0: handed in at once
    push(true);
  }
  function joker(by: string) {
    const p = share.players.find((x) => x.id === by);
    if (!p || p.joker !== 0 || share.jokersLeft <= 0 || (share.phase !== 'letter' && share.phase !== 'write')) return;
    p.joker = 1;
    share.jokersLeft--;
    push(true);
  }
  function vote(by: string, pid: string, ci: number) {
    if (share.phase !== 'review' || by === pid || !share.rejects[pid]?.[ci]) return;
    const list = share.rejects[pid][ci];
    share.rejects[pid][ci] = list.includes(by) ? list.filter((x) => x !== by) : [...list, by];
    push(true);
  }
  /** Everyone but the author votes (bots only against made-up words). */
  const votersFor = (pid: string) => share.players.filter((h) => h.id !== pid).length;
  function toReview() {
    for (const p of share.players) if (p.bot) got[p.id] = botFinal[p.id];
    share.answers = Object.fromEntries(share.players.map((p) => [p.id, share.cats.map((_, i) => got[p.id]?.[i] ?? '')]));
    // bots vote down what is obviously made up
    const bots = share.players.filter((p) => p.bot).map((p) => p.id);
    share.rejects = Object.fromEntries(share.players.map((p) => [p.id, share.cats.map((_, ci) => (looksFake(share.answers[p.id][ci]) ? bots.filter((b) => b !== p.id) : []))]));
    for (const p of share.players) p.done = !!p.bot;
    Object.assign(share, { phase: 'review', until: Date.now() + cfg.review * 1000 });
    push(true);
  }
  function maybeScore() { if (share.phase === 'review' && share.players.every((p) => p.done)) score(); }
  function score() {
    const pts = scoreRound(share.cats.length, share.letter, share.answers, (pid, ci) => isRejected(share.rejects[pid][ci].length, votersFor(pid)), share.ptsCfg);
    for (const p of share.players) {
      if (p.joker === 1) pts[p.id] = pts[p.id].map((x) => x * share.jokerX);
      p.score += pts[p.id].reduce((a, b) => a + b, 0);
    }
    Object.assign(share, { phase: 'scores', pts, until: Date.now() + cfg.pause * 1000 });
    push(true);
  }
  function finish() {
    const r = ranks(share.players.map((p) => ({ id: p.id, score: p.score })));
    share.payouts = sidePots(share.players.map((p) => ({ id: p.id, stake: p.stake, rank: r[p.id] })));
    share.phase = 'end';
    afterState();
    push(true);
  }
  // the host's clock moves the phases on; bots fill their fields over time
  const clock = setInterval(() => {
    now = Date.now();
    if (room.role === 'guest' || share.phase === 'lobby' || share.phase === 'end') return;
    if (share.phase === 'write') {
      const t = 1 - (share.until - now) / (share.time * 1000);
      for (const p of share.players) if (p.bot) p.filled = Math.min(botFinal[p.id].filter(Boolean).length, Math.floor(t * 1.6 * share.cats.length));
      push();
    }
    if (now < share.until) return;
    if (share.phase === 'letter') { share.phase = 'write'; share.until = now + share.time * 1000; push(true); }
    else if (share.phase === 'write' && now > share.until + 1200) toReview(); // a moment for the last answers to arrive
    else if (share.phase === 'review') score();
    else if (share.phase === 'scores') { if (share.round < share.rounds) nextRound(); else finish(); }
  }, 250);
  onDestroy(() => { clearInterval(clock); clearTimeout(sendTimer); room.leave(); });

  // ---------- me ----------
  let mine = $state<string[]>([]);
  let sendTimer: ReturnType<typeof setTimeout> | undefined;
  function resetMine() { mine = share.cats.map(() => ''); }
  function typed() {
    if (room.role === 'guest') { clearTimeout(sendTimer); sendTimer = setTimeout(() => room.send({ t: 'ans', round: share.round, list: $state.snapshot(mine) }), 350); }
    else { got[room.myId] = $state.snapshot(mine); const p = share.players.find((x) => x.id === room.myId); if (p) p.filled = mine.filter((x) => x.trim()).length; }
  }
  const act = (msg: { t: string; [k: string]: unknown }) => (room.role === 'guest' ? room.send(msg) : onMsg(msg, room.myId));
  // the host handles its own messages through onMsg as if a guest sent them
  const writing = $derived(share.phase === 'write' && now <= share.until);
  const allFilled = $derived(mine.length > 0 && mine.every((x) => x.trim()));
  const meP = $derived(share.players.find((p) => p.id === room.myId));

  // ---------- money ----------
  let paidGame = -1, settledGame = -1;
  function payStake() {
    if (paidGame === share.game || !meP) return;
    paidGame = share.game;
    if (meP.stake > 0) takeStake(meP.stake);
  }
  function afterState() {
    if (share.phase !== 'lobby' && share.phase !== 'end') payStake();
    if (share.phase === 'end' && share.payouts && settledGame !== share.game && paidGame === share.game) {
      settledGame = share.game;
      const back = share.payouts[room.myId] ?? 0;
      settle(back, back);
      sfx(back > (meP?.stake ?? 0) ? 'big' : back > 0 ? 'cash' : 'lose');
    }
  }

  // ---------- the drawn letter: it scrambles, then lands ----------
  let shown = $state('?');
  let spin: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const ph = share.phase, l = share.letter, rd = share.round;
    void rd;
    untrack(() => {
      clearTimeout(spin);
      if (ph !== 'letter' || matchMedia('(prefers-reduced-motion: reduce)').matches) { shown = l || '?'; return; }
      const abc = letters(true);
      let k = 0;
      const tick = () => {
        k++;
        if (k > 22) { shown = l; sfx('big'); return; }
        shown = abc[Math.floor(Math.random() * abc.length)];
        sfx('tick');
        spin = setTimeout(tick, 40 + k * k * 0.35);
      };
      tick();
    });
  });
  // sound when the clock runs low or someone pressed stop
  $effect(() => { if (share.stopBy) untrack(() => sfx('stop')); });

  // ---------- settings dialog ----------
  let setupOpen = $state(false);
  /** Opens the dialog as a modal (Esc and the backdrop close it). */
  function modal(d: HTMLDialogElement) {
    d.showModal();
    const click = (e: MouseEvent) => { if (e.target === d) d.close(); };
    d.addEventListener('click', click);
    return { destroy: () => d.removeEventListener('click', click) };
  }

  // ---------- lobby: categories ----------
  let draft = $state('');
  function addCat(label: string, k?: string) {
    const l = label.trim().slice(0, 24);
    if (!l || cats.length >= 12 || cats.some((c) => c.label.toLowerCase() === l.toLowerCase())) return;
    cats = [...cats, k ? { k, label: l } : { label: l }];
    draft = '';
  }
  function setLang(l: Lang) {
    lang = l;
    cats = cats.map((c) => (c.k ? { k: c.k, label: CLASSIC.find((x) => x.k === c.k)![l] } : c));
  }

  const nameOf = (id: string) => share.players.find((p) => p.id === id)?.name ?? '?';
  const left = $derived(Math.max(0, Math.ceil((share.until - now) / 1000)));
  const seats = $derived(lobby.map((p) => ({ ...p, score: share.phase === 'lobby' ? undefined : (p.joker === 1 ? '🔥 ' : '') + p.score })));
  /** In the review: is this answer a duplicate / wrong letter / voted down? */
  const status = (pid: string, ci: number) => {
    const a = share.answers[pid]?.[ci] ?? '';
    if (!a.trim()) return 'empty';
    if (!fits(a, share.letter)) return 'letter';
    if (isRejected(share.rejects[pid]?.[ci]?.length ?? 0, votersFor(pid))) return 'out';
    if (share.players.some((o) => o.id !== pid && norm(share.answers[o.id]?.[ci] ?? '') === norm(a))) return 'same';
    return 'ok';
  };
  const ranking = $derived([...share.players].sort((a, b) => b.score - a.score));
</script>

<section class="slf" class:full={fs.on} bind:this={sectionEl}>
  <header class="head">
    <div class="h1row"><h1>{L('Stadt Land Fluss', 'Categories')}</h1><span class="eyebrow">{share.phase === 'lobby' ? L('Party', 'Party') : L(`Runde ${share.round} / ${share.rounds}`, `Round ${share.round} / ${share.rounds}`)}</span><HowTo id="slf" /><span class="tools"><button class="mode" onclick={() => (dark = !dark)} aria-label={dark ? L('Heller Bogen', 'Light sheet') : L('Dunkler Bogen', 'Dark sheet')} title={dark ? L('Heller Bogen', 'Light sheet') : L('Dunkler Bogen', 'Dark sheet')}>{dark ? '☀️' : '🌙'}</button><FullscreenButton target={sectionEl} /></span></div>
    <div></div>
    <div class="right"><RoomBar {room} /></div>
  </header>

  <div class="layout">
    <aside class="panel">
      {#if share.phase === 'lobby' || share.phase === 'end'}
        <div class="field">{L('Dein Einsatz im Topf', 'Your stake in the pot')}<BetInput bind:value={bet} /></div>
        {#if isHost}
          <div class="quickset">
            <div class="qhead"><span class="eyebrow">{L('Einstellungen', 'Settings')}</span>
              <button class="gear" onclick={() => (setupOpen = true)} aria-label={L('Alle Einstellungen', 'All settings')} title={L('Alle Einstellungen', 'All settings')}>
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.7 7.7 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4L10.7 6a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.7 7.7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.7 1.7 1l.3 2.5h4l.3-2.5c.6-.3 1.2-.6 1.7-1l2.4 1 2-3.4zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg>
              </button>
            </div>
            <div class="qgrid">
              {@render num(L('Runden', 'Rounds'), 'rounds', 1, 26, '')}
              {@render num(L('Bots', 'Bots'), 'bots', 0, 5, '')}
            </div>
            <div class="tseg" role="radiogroup" aria-label={L('Zeit pro Runde', 'Time per round')}>
              {#each [60, 90, 120, 180] as s2}<button role="radio" aria-checked={cfg.time === s2} class:on={cfg.time === s2} onclick={() => (cfg.time = s2)}>{s2}s</button>{/each}
            </div>
            <label class="tog"><input type="checkbox" checked={cfg.stop && cfg.grace === 0} onchange={(e) => { const on = e.currentTarget.checked; cfg.stop = true; cfg.grace = on ? 0 : 10; }} /> {L('Bei Stopp sofort abgeben', 'Hand in at once on stop')}</label>
          </div>
          <button class="btn primary big" disabled={cats.length < 3 || lobby.length < 2 || bet > wallet.balance} onclick={startGame}>{lobby.length < 2 ? L('Bot oder Freund dazunehmen', 'Add a bot or a friend') : share.phase === 'end' ? L('Neues Spiel', 'New game') : 'Start'}</button>
        {:else}<p class="muted small">{L('Der Gastgeber stellt ein und startet.', 'The host sets up and starts.')}</p>{/if}
      {:else}
        <div class="bigletter" class:land={share.phase !== 'letter'}><span class="mono">{shown}</span></div>
        {#if share.phase === 'letter' || share.phase === 'write'}
          {#if meP?.joker === 1}<p class="armed" in:scale={{ start: 0.9 }}>🔥 {L(`Joker aktiv: diese Runde zählt ×${share.jokerX}`, `Joker on: this round counts ×${share.jokerX}`)}</p>
          {:else if meP && meP.joker === 0 && share.jokersLeft > 0}<button class="btn joker" onclick={() => act({ t: 'joker' })}>🔥 {L(`Joker ×${share.jokerX} (noch ${share.jokersLeft} im Spiel)`, `Joker ×${share.jokerX} (${share.jokersLeft} left in the game)`)}</button>{/if}
        {/if}
      {/if}
      <PotSeats {seats} me={room.myId} payouts={share.phase === 'end' ? share.payouts : null} />
    </aside>

    <div class="paper" class:dark>
      {#if share.phase === 'lobby' || share.phase === 'end'}
        {#if share.phase === 'end'}
          <div class="final" in:fly={{ y: 10 }}>
            <h2>{ranks(share.players.map((p) => ({ id: p.id, score: p.score })))[room.myId] === 1 ? L('Gewonnen!', 'You win!') : L('Endstand', 'Final score')}</h2>
            <ol>{#each ranking as p, i (p.id)}<li class:me={p.id === room.myId} style="--i:{i}"><b>{i + 1}.</b> {p.name}<span class="mono">{p.score}</span></li>{/each}</ol>
          </div>
        {/if}
        <div class="cats">
          <div class="ch"><h3>{L('Kategorien', 'Categories')}</h3>{#if isHost}<div class="seg lang">{#each ['de', 'en'] as l}<button class:on={lang === l} onclick={() => setLang(l as Lang)}>{l.toUpperCase()}</button>{/each}</div>{/if}</div>
          <div class="chips">
            {#each (isHost ? cats : share.cats) as c, i (c.label)}
              <span class="cchip" in:scale={{ start: 0.9, duration: 250 }}>{c.label}{#if isHost && cats.length > 3}<button onclick={() => (cats = cats.filter((_, k) => k !== i))} aria-label="×">×</button>{/if}</span>
            {/each}
          </div>
          {#if isHost}
            <div class="add">
              {#each CLASSIC.filter((c) => !cats.some((x) => x.k === c.k)) as c}<button class="sugg" onclick={() => addCat(c[lang], c.k)}>+ {c[lang]}</button>{/each}
            </div>
            <form class="own" onsubmit={(e) => { e.preventDefault(); addCat(draft); }}>
              <input bind:value={draft} maxlength="24" placeholder={L('Eigene Kategorie, z. B. «Promi», «Automarke»', 'Your own, e.g. "Movie", "Car brand"')} />
              <button class="btn" disabled={!draft.trim() || cats.length >= 12}>+</button>
            </form>
            <small class="muted">{L('3 bis 12 Kategorien. Bots kennen nur die Klassiker; eigene Kategorien lassen sie leer.', '3 to 12 categories. Bots only know the classics and leave your own ones empty.')}</small>
          {/if}
        </div>
      {:else if share.phase === 'letter' || share.phase === 'write'}
        <div class="timer"><i style="transform: scaleX({share.phase === 'write' ? Math.max(0, (share.until - now) / (share.time * 1000)) : 1})" class:hot={share.phase === 'write' && left <= 10}></i></div>
        <div class="top">
          <span>{L('Buchstabe', 'Letter')} <b class="mono gold">{share.phase === 'letter' ? '…' : share.letter}</b></span>
          <span class="mono" class:hot={left <= 10 && share.phase === 'write'}>{share.phase === 'write' ? left + 's' : ''}</span>
        </div>
        {#if share.stopBy}<p class="stopped" in:fly={{ y: -6 }}>✋ {nameOf(share.stopBy)} {share.grace ? L(`hat Stopp gerufen! Noch ${left}s`, `called stop! Only ${left}s`) : L('hat abgegeben, alle Blätter werden eingesammelt.', 'handed in, all sheets are collected.')}</p>{/if}
        <div class="form">
          {#each share.cats as c, i}
            {@const v = mine[i] ?? ''}
            <label class="row" class:ok={!!v.trim() && fits(v, share.letter)} class:bad={!!v.trim() && share.phase === 'write' && !fits(v, share.letter)}>
              <span class="cl">{c.label}</span>
              <input bind:value={mine[i]} oninput={typed} disabled={!writing} placeholder={share.phase === 'write' ? share.letter + ' …' : ''} autocomplete="off" spellcheck="false" maxlength="40" />
              <i class="mark">{v.trim() ? (fits(v, share.letter) ? '✓' : '✗') : ''}</i>
            </label>
          {/each}
        </div>
        <div class="foot">
          {#if share.stop && share.phase === 'write'}<button class="btn primary" disabled={!allFilled || !!share.stopBy || !writing} onclick={() => { typed(); setTimeout(() => act({ t: 'stop' }), 400); }}>✋ {L('Stopp!', 'Stop!')}</button>{/if}
          <div class="race">{#each share.players.filter((p) => p.id !== room.myId) as p}<span>{p.name} <b class="mono">{p.filled}/{share.cats.length}</b></span>{/each}</div>
        </div>
      {:else if share.phase === 'review'}
        <div class="top"><span>{L('Prüfen', 'Check')} · <b class="mono gold">{share.letter}</b></span><span class="mono">{left}s</span></div>
        <p class="muted small">{L('Passt eine Antwort nicht? Tipp auf 👎. Mehr als die Hälfte der anderen dagegen: 0 Punkte.', 'Answer does not fit? Tap 👎. More than half of the others against it: 0 points.')}</p>
        <div class="review">
          {#each share.cats as c, ci}
            <div class="rc" style="--i:{ci}">
              <h4>{c.label}</h4>
              {#each share.players as p (p.id)}
                {@const st = status(p.id, ci)}
                {@const no = share.rejects[p.id]?.[ci] ?? []}
                <div class="ans {st}">
                  <span class="who">{p.id === room.myId ? L('Du', 'You') : p.name}</span>
                  <span class="txt">{share.answers[p.id]?.[ci] || '–'}</span>
                  {#if st === 'same'}<em>{L('doppelt', 'same')}</em>{:else if st === 'letter'}<em>{L('Buchstabe', 'letter')}</em>{:else if st === 'out'}<em>{L('abgelehnt', 'rejected')}</em>{/if}
                  {#if p.id !== room.myId && st !== 'empty' && st !== 'letter' && !meP?.bot}
                    <button class="no" class:on={no.includes(room.myId)} onclick={() => act({ t: 'vote', pid: p.id, ci })} aria-label={L('Ablehnen', 'Reject')}>👎{#if no.length}<span class="mono">{no.length}</span>{/if}</button>
                  {:else if no.length}<span class="mono cnt">👎 {no.length}</span>{/if}
                </div>
              {/each}
            </div>
          {/each}
        </div>
        <div class="foot">
          <button class="btn primary" disabled={meP?.done} onclick={() => act({ t: 'done' })}>{meP?.done ? L('Warten auf die anderen …', 'Waiting for the others …') : L('Fertig geprüft', 'Done checking')}</button>
          <span class="muted small">{share.players.filter((p) => p.done).length} / {share.players.length}</span>
        </div>
      {:else if share.phase === 'scores'}
        <div class="top"><span>{L('Punkte dieser Runde', 'Points this round')} · <b class="mono gold">{share.letter}</b></span><span class="mono">{left}s</span></div>
        <div class="scores">
          {#each [...share.players].sort((a, b) => (share.pts[b.id]?.reduce((x, y) => x + y, 0) ?? 0) - (share.pts[a.id]?.reduce((x, y) => x + y, 0) ?? 0)) as p, i (p.id)}
            {@const r = share.pts[p.id]?.reduce((x, y) => x + y, 0) ?? 0}
            <div class="sc" class:me={p.id === room.myId} style="--i:{i}">
              <span class="nm">{p.name}{#if p.joker === 1} 🔥×2{/if}</span>
              <span class="bars">{#each share.pts[p.id] ?? [] as v}<i class="v{v > 20 ? 20 : v}" title={v + ''}>{v || ''}</i>{/each}</span>
              <b class="mono">+{r}</b><span class="mono tot">{p.score}</span>
            </div>
          {/each}
        </div>
        {#if isHost}<div class="foot"><button class="btn primary" onclick={() => (share.until = Date.now())}>{share.round < share.rounds ? L('Nächste Runde', 'Next round') : L('Endstand', 'Final score')}</button></div>{/if}
      {/if}
    </div>
  </div>
</section>

{#if setupOpen}
  <dialog class="cfg" onclose={() => { tidy(); setupOpen = false; }} use:modal>
    <form method="dialog" class="dlg" onsubmit={() => tidy()}>
      <header><h2>{L('Einstellungen', 'Settings')}</h2><button class="btn icon sm ghost" aria-label={L('Schliessen', 'Close')}>×</button></header>
      <section>
        <h3>{L('Spiel', 'Game')}</h3>
        <div class="grid2">
          {@render num(L('Runden', 'Rounds'), 'rounds', 1, 26, '')}
          {@render num(L('Zeit pro Runde', 'Time per round'), 'time', 15, 900, 's')}
          {@render num(L('Zeit zum Prüfen', 'Time to check'), 'review', 10, 600, 's')}
          {@render num(L('Pause nach der Runde', 'Pause after a round'), 'pause', 2, 60, 's')}
        </div>
      </section>
      <section>
        <h3>{L('Stopp', 'Stop')}</h3>
        <label class="switch"><span>{L('Stopp-Taste: Wer alles ausgefüllt hat, darf beenden', 'Stop button: whoever filled everything may end the round')}</span><input type="checkbox" bind:checked={cfg.stop} /></label>
        {#if cfg.stop}
          <div class="grid2">
            {@render num(L('Restzeit nach Stopp', 'Time left after stop'), 'grace', 0, 120, 's')}
            <div class="quick">{#each [[0, L('Sofort abgeben', 'Hand in at once')], [5, '5 s'], [10, '10 s']] as [v, lb]}<button type="button" class:on={cfg.grace === v} onclick={() => (cfg.grace = v as number)}>{lb}</button>{/each}</div>
          </div>
        {/if}
      </section>
      <section>
        <h3>{L('Buchstaben', 'Letters')} <span class="muted">{cfg.letters.length}</span></h3>
        <div class="abc">{#each 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' as l}<button type="button" class:on={cfg.letters.includes(l)} onclick={() => (cfg.letters = cfg.letters.includes(l) ? cfg.letters.replace(l, '') : [...cfg.letters + l].sort().join(''))}>{l}</button>{/each}</div>
      </section>
      <section>
        <h3>{L('Punkte', 'Points')}</h3>
        <div class="grid3">
          {@render pts(L('Allein in der Kategorie', 'Only answer'), 'only')}
          {@render pts(L('Einzigartig', 'Unique'), 'unique')}
          {@render pts(L('Doppelt', 'Same as others'), 'same')}
        </div>
      </section>
      <section>
        <h3>Joker</h3>
        <div class="grid2">
          {@render num(L('Joker im ganzen Spiel', 'Jokers per game'), 'jokers', 0, 20, '')}
          {@render num(L('Faktor', 'Factor'), 'jokerX', 2, 5, '×')}
        </div>
        <small class="muted">{L('Wer zuerst zündet, bekommt ihn; jeder höchstens einen.', 'First come, first served; one per player at most.')}</small>
      </section>
      <section>
        <h3>Bots</h3>
        <div class="grid2">
          {@render num(L('Anzahl', 'Number'), 'bots', 0, 5, '')}
          <div class="quick">{#each [['easy', L('Leicht', 'Easy')], ['mid', L('Mittel', 'Medium')], ['hard', L('Schlau', 'Smart')]] as [k, lb]}<button type="button" class:on={cfg.skill === k} onclick={() => (cfg.skill = k as BotSkill)}>{lb}</button>{/each}</div>
        </div>
      </section>
      <footer>
        <button type="button" class="btn ghost" onclick={() => (cfg = { ...DEF, pts: { ...POINTS } })}>{L('Zurücksetzen', 'Reset')}</button>
        <button class="btn primary">{L('Fertig', 'Done')}</button>
      </footer>
    </form>
  </dialog>
{/if}

{#snippet num(label: string, key: 'rounds' | 'time' | 'review' | 'pause' | 'grace' | 'jokers' | 'jokerX' | 'bots', lo: number, hi: number, unit: string)}
  <label class="num">{label}
    <span class="box">
      <button type="button" onclick={() => (cfg[key] = Math.max(lo, (Number(cfg[key]) || 0) - 1))} aria-label="−">−</button>
      <input type="number" inputmode="numeric" min={lo} max={hi} bind:value={cfg[key]} onblur={tidy} />
      {#if unit}<em>{unit}</em>{/if}
      <button type="button" onclick={() => (cfg[key] = Math.min(hi, (Number(cfg[key]) || 0) + 1))} aria-label="+">+</button>
    </span>
  </label>
{/snippet}
{#snippet pts(label: string, key: 'only' | 'unique' | 'same')}
  <label class="num">{label}<span class="box"><input type="number" inputmode="numeric" min="0" max="1000" bind:value={cfg.pts[key]} onblur={tidy} /></span></label>
{/snippet}

<style>
  .slf { width: min(100%, 1280px); margin-inline: auto; padding: 0 20px 48px; display: grid; gap: 14px; }
  .slf.full { width: 100%; max-width: none; height: 100%; overflow-y: auto; background: var(--bg); padding: 16px 3vw 30px; align-content: start; }
  .tools { display: flex; gap: 6px; }
  .mode { width: 38px; height: 38px; display: grid; place-items: center; padding: 0; border-radius: 12px; border: 1px solid var(--line-2); background: var(--surface); color: var(--text); font-size: 1rem; transition: transform 0.35s var(--spring-snappy), border-color 0.25s var(--ease-snap); }
  .mode:hover { border-color: var(--text); transform: rotate(-12deg) scale(1.06); }
  /* big screens: the whole sheet grows instead of floating small in the middle */
  @media (min-width: 1600px) { .slf { zoom: 1.15; } }
  @media (min-width: 2200px) { .slf { zoom: 1.35; } }
  .head { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px 16px; padding: 12px 4px 0; min-height: 64px; }
  .right { display: flex; justify-content: flex-end; min-width: 0; }
  @media (max-width: 900px) { .head { grid-template-columns: 1fr; } .right { justify-content: flex-start; } }
  .h1row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  h1 { margin: 0; font-size: clamp(1.7rem, 3vw, 2.4rem); letter-spacing: -0.04em; line-height: 1; }
  .muted { color: var(--muted); } .small { font-size: 0.82rem; } .gold { color: #b8860b; }
  .layout { display: grid; grid-template-columns: 300px 1fr; gap: 18px; align-items: start; }
  @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } .panel { order: 2; } }
  .panel { display: grid; gap: 14px; padding: 16px; border-radius: 24px; background: var(--surface); box-shadow: inset 0 0 0 1px var(--line); }
  .field { display: grid; gap: 6px; font-size: 0.85rem; }
  .seg { display: flex; border: 1px solid var(--line-2); border-radius: 999px; padding: 3px; gap: 3px; }
  .seg button { flex: 1; border: 0; background: none; min-height: 32px; padding: 0 8px; border-radius: 999px; color: var(--muted); font-size: 0.8rem; font-weight: 600; transition: background 0.3s var(--ease-snap), color 0.3s var(--ease-snap); }
  .seg button.on { background: var(--text); color: var(--bg); }
  .big { min-height: 50px; width: 100%; }
  .bigletter { display: grid; place-items: center; height: 130px; border-radius: 22px; background: radial-gradient(circle at 40% 30%, #fff8e1, #f0d48c); box-shadow: inset 0 0 0 3px #c9973f, 0 14px 30px -14px rgba(0,0,0,.6); }
  .bigletter span { font-size: 5rem; font-weight: 800; color: #3a2408; line-height: 1; }
  .bigletter.land span { animation: land 0.6s var(--spring-snappy); }
  @keyframes land { from { transform: scale(1.25); } }
  .quickset { display: grid; gap: 10px; padding: 12px; border-radius: 18px; border: 1px solid var(--line-2); background: var(--surface-2); }
  .qhead { display: flex; align-items: center; justify-content: space-between; }
  .gear { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; border: 1px solid var(--line-2); background: var(--bg-2); color: var(--text); transition: transform 0.5s var(--spring-snappy), border-color 0.3s var(--ease-snap); }
  .gear:hover { transform: rotate(60deg); border-color: var(--gold); }
  .gear:active { transform: rotate(60deg) scale(0.92); }
  .qgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .tseg { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; padding: 3px; border-radius: 12px; background: var(--bg-2); }
  .tseg button { border: 0; background: none; color: var(--muted); border-radius: 9px; padding: 7px 0; font: 600 0.8rem 'Geist Mono Variable', monospace; transition: background 0.25s var(--ease-snap), color 0.25s var(--ease-snap); }
  .tseg button.on { background: var(--surface); color: var(--text); box-shadow: 0 1px 4px rgba(0,0,0,.3); }
  .tog { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--muted); cursor: pointer; }
  .tog input { accent-color: var(--gold); width: 16px; height: 16px; }
  .setup:hover { border-color: var(--gold); }
  .setup:active { transform: scale(0.98); }
  .cfg { width: min(620px, calc(100% - 24px)); max-height: calc(100dvh - 40px); overflow-y: auto; }
  .cfg .dlg { display: grid; gap: 18px; padding: 22px; }
  .cfg header, .cfg footer { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
  .cfg h2 { margin: 0; font-size: 1.5rem; letter-spacing: -0.03em; }
  .cfg section { display: grid; gap: 10px; padding-top: 14px; border-top: 1px solid var(--line); }
  .cfg h3 { font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); display: flex; gap: 8px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: end; }
  .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  @media (max-width: 520px) { .grid2, .grid3 { grid-template-columns: 1fr; } }
  .num { display: grid; gap: 6px; font-size: 0.82rem; color: var(--muted); }
  .box { display: flex; align-items: center; border: 1px solid var(--line-2); border-radius: 12px; background: var(--bg-2); overflow: hidden; transition: border-color 0.3s var(--ease-snap); }
  .box:focus-within { border-color: var(--gold); }
  .box input { flex: 1; min-width: 0; width: 100%; border: 0; background: none; color: var(--text); font: 600 1.05rem 'Geist Mono Variable', monospace; text-align: center; padding: 10px 4px; outline: none; appearance: textfield; -moz-appearance: textfield; }
  .box input::-webkit-inner-spin-button { -webkit-appearance: none; }
  .box em { font-style: normal; color: var(--muted); padding-right: 6px; }
  .box button { border: 0; background: none; color: var(--text); width: 40px; min-height: 42px; font-size: 1.1rem; transition: background 0.2s var(--ease-snap); }
  .box button:hover { background: var(--surface-2); }
  .quick { display: flex; gap: 4px; flex-wrap: wrap; }
  .quick button, .abc button { border: 1px solid var(--line-2); background: none; color: var(--muted); border-radius: 999px; padding: 8px 12px; font-size: 0.8rem; font-weight: 600; transition: background 0.25s var(--ease-snap), color 0.25s var(--ease-snap); }
  .quick button.on, .abc button.on { background: var(--text); color: var(--bg); border-color: var(--text); }
  .abc { display: grid; grid-template-columns: repeat(13, 1fr); gap: 4px; }
  .abc button { padding: 7px 0; border-radius: 8px; font-family: 'Geist Mono Variable', monospace; }
  @media (max-width: 520px) { .abc { grid-template-columns: repeat(7, 1fr); } }
  .joker { min-height: 46px; background: linear-gradient(90deg, #ff7a2a, #e5484d); color: #fff; border: 0; }
  .armed { margin: 0; padding: 10px 12px; border-radius: 14px; background: color-mix(in srgb, #ff7a2a 22%, transparent); font-weight: 600; font-size: 0.88rem; }

  /* the answer sheet: squared paper on a desk */
  .paper {
    --ink: #2b2a3a; --card: #fff; --sub: #f3efe2; --mut: #6b6a78; --tint: rgba(0,0,0,.06); --rule: rgba(0,0,0,.16); --chip: #2b2a3a;
    position: relative; display: grid; gap: 14px; align-content: start; min-height: 460px; padding: clamp(16px, 2.6vw, 30px); border-radius: 26px; color: var(--ink);
    background: linear-gradient(rgba(70,110,200,.13) 1px, transparent 1px) 0 0 / 22px 22px, linear-gradient(90deg, rgba(70,110,200,.13) 1px, transparent 1px) 0 0 / 22px 22px, #fbf8ef;
    box-shadow: 0 30px 60px -30px rgba(0,0,0,.7), inset 0 0 0 1px rgba(0,0,0,.06);
  }
  .paper .muted { color: var(--mut); }
  /* dark sheet: night-blue paper with light ink, same layout */
  .paper.dark {
    --ink: #ece6da; --card: #24222e; --sub: #2f2c3b; --mut: #a39fb0; --tint: rgba(255,255,255,.08); --rule: rgba(255,255,255,.2); --chip: #4b4560;
    background: linear-gradient(rgba(140,170,255,.07) 1px, transparent 1px) 0 0 / 22px 22px, linear-gradient(90deg, rgba(140,170,255,.07) 1px, transparent 1px) 0 0 / 22px 22px, #1a1922;
    box-shadow: 0 30px 60px -30px rgba(0,0,0,.8), inset 0 0 0 1px rgba(255,255,255,.08);
  }
  .paper.dark :global(input::placeholder) { color: #77738a; }
  .paper.dark .stopped { background: #4a1f27; color: #ffb3bd; }
  .paper.dark .ans.same em { background: #5a4a14; }
  .paper.dark .bars i.v5 { background: #5a4a14; color: #ffe08a; } .paper.dark .bars i.v10 { background: #1d4a32; color: #9ff0c2; }
  .paper .btn:not(.primary) { background: var(--card); color: var(--ink); border-color: var(--rule); }
  h2, h3, h4 { margin: 0; }
  .final { display: grid; gap: 10px; padding: 14px 18px; border-radius: 18px; background: var(--card); box-shadow: 0 10px 30px -16px rgba(0,0,0,.4); }
  .final ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  .final li { display: flex; gap: 8px; padding: 6px 10px; border-radius: 10px; background: var(--sub); animation: rise 0.5s var(--spring-snappy) calc(var(--i) * 80ms) backwards; }
  .final li.me { box-shadow: inset 0 0 0 2px #c9973f; }
  .final li .mono { margin-left: auto; font-weight: 700; }
  @keyframes rise { from { opacity: 0; transform: translateY(10px); } }
  .cats { display: grid; gap: 12px; }
  .ch { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
  .ch .seg { border-color: var(--rule); }
  .ch .seg button { color: var(--mut); }
  .ch .seg button.on { background: var(--chip); color: #fff; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .cchip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 6px 6px 12px; border-radius: 999px; background: var(--chip); color: #fff; font-weight: 600; font-size: 0.88rem; }
  .cchip button { border: 0; background: rgba(255,255,255,.18); color: #fff; width: 22px; height: 22px; border-radius: 50%; padding: 0; line-height: 1; }
  .add { display: flex; flex-wrap: wrap; gap: 6px; }
  .sugg { border: 1px dashed var(--rule); background: none; color: var(--ink); border-radius: 999px; padding: 5px 11px; font-size: 0.82rem; transition: background 0.3s var(--ease-snap); }
  .sugg:hover { background: var(--tint); }
  .own { display: flex; gap: 8px; }
  .own input { flex: 1; min-width: 0; min-height: 42px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--rule); background: var(--card); color: var(--ink); font: inherit; }
  .own input:focus { outline: 2px solid #c9973f; }

  .timer { height: 6px; border-radius: 3px; background: var(--tint); overflow: hidden; }
  .timer i { display: block; height: 100%; background: linear-gradient(90deg, #2fa968, #d9a531); transform-origin: left; transition: transform 0.3s linear; }
  .timer i.hot { background: #e5484d; }
  .top { display: flex; justify-content: space-between; align-items: baseline; font-size: 1.05rem; }
  .top b { font-size: 1.6rem; }
  .top .hot { color: #e5484d; animation: beat 1s ease-in-out infinite; }
  @keyframes beat { 50% { transform: scale(1.12); } }
  .stopped { margin: 0; padding: 10px 14px; border-radius: 12px; background: #ffe1e1; color: #a3122a; font-weight: 700; }
  .form { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
  .row { position: relative; display: grid; gap: 4px; padding: 10px 12px; border-radius: 14px; background: var(--card); box-shadow: 0 6px 16px -12px rgba(0,0,0,.5), inset 0 0 0 1px rgba(0,0,0,.06); transition: box-shadow 0.3s var(--ease-snap); }
  .row.ok { box-shadow: inset 0 0 0 2px rgba(47,169,104,.6); }
  .row.bad { box-shadow: inset 0 0 0 2px rgba(229,72,77,.6); }
  .cl { font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--mut); font-weight: 700; }
  .row input { border: 0; border-bottom: 2px solid var(--rule); background: none; font: 600 1.15rem 'Geist Variable', sans-serif; color: var(--ink); padding: 4px 24px 4px 0; outline: none; transition: border-color 0.3s var(--ease-snap); }
  .row input:focus { border-color: #c9973f; }
  .mark { position: absolute; right: 12px; bottom: 14px; font-style: normal; font-weight: 800; }
  .row.ok .mark { color: #2fa968; } .row.bad .mark { color: #e5484d; }
  .foot { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; }
  .race { display: flex; flex-wrap: wrap; gap: 6px; }
  .race span { padding: 4px 10px; border-radius: 999px; background: var(--tint); font-size: 0.82rem; }

  .review { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
  .rc { display: grid; gap: 6px; padding: 12px; border-radius: 16px; background: var(--card); box-shadow: 0 8px 20px -14px rgba(0,0,0,.5); animation: rise 0.5s var(--spring-snappy) calc(min(var(--i), 6) * 80ms) backwards; }
  .rc h4 { font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--mut); }
  .ans { display: grid; grid-template-columns: 64px 1fr auto auto; gap: 6px; align-items: center; padding: 5px 8px; border-radius: 10px; background: var(--sub); font-size: 0.9rem; }
  .ans .who { font-size: 0.75rem; color: var(--mut); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ans .txt { font-weight: 700; overflow: hidden; text-overflow: ellipsis; }
  .ans em { font-style: normal; font-size: 0.68rem; padding: 1px 6px; border-radius: 6px; background: var(--tint); }
  .ans.same em { background: #fff0c2; } .ans.letter, .ans.out { opacity: 0.6; } .ans.letter .txt, .ans.out .txt { text-decoration: line-through; }
  .ans.empty .txt { color: #a8a6b2; font-weight: 400; }
  .no { border: 0; background: var(--tint); border-radius: 8px; padding: 3px 7px; display: flex; gap: 4px; align-items: center; transition: background 0.3s var(--ease-snap), transform 0.16s var(--ease-snap); }
  .no:active { transform: scale(0.95); }
  .no.on { background: #ffd2d2; }
  .cnt { font-size: 0.75rem; }
  .scores { display: grid; gap: 8px; }
  .sc { display: grid; grid-template-columns: 130px 1fr auto 60px; gap: 10px; align-items: center; padding: 8px 12px; border-radius: 14px; background: var(--card); animation: rise 0.5s var(--spring-snappy) calc(var(--i) * 90ms) backwards; }
  .sc.me { box-shadow: inset 0 0 0 2px #c9973f; }
  .sc .nm { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bars { display: flex; gap: 3px; flex-wrap: wrap; }
  .bars i { min-width: 26px; height: 22px; display: grid; place-items: center; border-radius: 6px; font: normal 700 0.7rem 'Geist Mono Variable', monospace; background: var(--sub); color: var(--mut); }
  .bars i.v5 { background: #fff0c2; color: #7a5a00; } .bars i.v10 { background: #c9f2da; color: #145c35; } .bars i.v20 { background: #2fa968; color: #fff; }
  .sc b { font-size: 1.1rem; color: #2fa968; }
  .tot { text-align: right; color: var(--mut); }
  @media (max-width: 560px) { .sc { grid-template-columns: 90px 1fr auto; } .tot { display: none; } }
  @media (prefers-reduced-motion: reduce) { .final li, .rc, .sc, .bigletter.land span { animation: none; } }
</style>
