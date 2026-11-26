<script lang="ts">
  // Wortjagd: find the 5-letter word. Tageswort = the same word for everybody each day (German or English),
  // Arcade = 1, 2, 4 or 8 words at once with shared guesses, free or with a stake that pays for leftover guesses.
  import { onMount, untrack } from 'svelte';
  import { fly } from 'svelte/transition';
  import HowTo from '../components/HowTo.svelte';
  import BetInput from '../components/BetInput.svelte';
  import { LEN, BOARDS, GUESSES, DAILY_COINS, judge, lists, dailyWord, dayNo, hardRule, multFor, type Lang, type Lists, type Mark } from '../games/words';
  import { wallet, settle, stake as takeStake, fmt, settings } from '../lib/state.svelte';
  import { sfx } from '../lib/sfx';

  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
  type Saved = {
    hard?: boolean; boards?: number; paid?: boolean;
    daily?: Partial<Record<Lang, { day: number; rows: string[]; paid?: boolean }>>;
    stats?: Partial<Record<Lang, { played: number; won: number; streak: number; max: number; last: number; dist: number[] }>>;
  };
  const load = (): Saved => { try { return JSON.parse(localStorage.getItem('betly:words') || '{}'); } catch { return {}; } };
  const save = (f: (s: Saved) => void) => { const s = load(); f(s); try { localStorage.setItem('betly:words', JSON.stringify(s)); } catch {} };

  let lang = $state<Lang>(settings.lang === 'en' ? 'en' : 'de');
  let mode = $state<'daily' | 'arcade'>('daily');
  let boards = $state<number>(load().boards ?? 4);
  let hard = $state<boolean>(load().hard ?? false);
  let paid = $state<boolean>(load().paid ?? false);
  let bet = $state(10);
  $effect(() => { const b = boards, h = hard, p = paid; untrack(() => save((s) => Object.assign(s, { boards: b, hard: h, paid: p }))); });

  let lists_ = $state<Lists | null>(null);
  let answers = $state<string[]>([]);
  let rows = $state<string[]>([]);
  let cur = $state('');
  let phase = $state<'load' | 'play' | 'won' | 'lost'>('load');
  let staked = $state(0);
  let result = $state<{ coins: number; text: string } | null>(null);
  let toast = $state<{ text: string; id: number } | null>(null);
  let shake = $state(false);
  let revealing = $state(-1); // row being flipped: the keyboard waits for it
  const n = $derived(answers.length || 1);
  const maxRows = $derived(mode === 'daily' ? 6 : GUESSES[n]);
  const marks = $derived(rows.map((w) => answers.map((a) => judge(w, a))));
  // the row in which each board was solved, or -1
  const solvedAt = $derived(answers.map((a) => rows.indexOf(a)));
  const dayN = dayNo();

  function say(text: string) { toast = { text, id: Date.now() }; setTimeout(() => { if (toast && Date.now() - toast.id >= 1900) toast = null; }, 2000); }

  async function setup(keepDaily = true) {
    phase = 'load';
    result = null; cur = ''; rows = [];
    const l = await lists(lang);
    lists_ = l;
    if (mode === 'daily') {
      answers = [dailyWord(l, dayN)];
      const d = load().daily?.[lang];
      if (keepDaily && d?.day === dayN) rows = d.rows.filter((w) => l.valid.has(w) || l.sol.includes(w));
      phase = 'play';
      check(true);
    } else {
      const pick = new Set<string>();
      while (pick.size < boards) pick.add(l.sol[Math.floor(Math.random() * l.sol.length)]);
      answers = [...pick];
      phase = 'play';
    }
  }
  onMount(() => { setup(); });
  function switchTo(m: 'daily' | 'arcade', lg = lang) {
    if (staked && phase === 'play') return;
    mode = m; lang = lg;
    staked = 0;
    setup();
  }
  /** Start an arcade round (pays the stake if there is one). */
  function newArcade() {
    if (mode !== 'arcade' || (staked && phase === 'play')) return;
    if (paid && (bet <= 0 || bet > wallet.balance)) return;
    staked = paid ? bet : 0;
    if (staked) takeStake(staked);
    setup().then(() => sfx('chip'));
  }

  function type(c: string) {
    if (phase !== 'play' || cur.length >= LEN) return; // typing the next row may start while the last one flips
    cur += c;
    sfx('click');
  }
  const back = () => { if (phase === 'play') cur = cur.slice(0, -1); };
  function enter() {
    if (phase !== 'play' || !lists_ || solvedAt.every((r) => r >= 0) || rows.length >= maxRows) return; // already decided, the reveal is still running
    if (mode === 'arcade' && paid && !staked) return say(L('Erst «Neue Runde» mit Einsatz starten', 'Start a new round with your stake first'));
    if (cur.length < LEN) return bad(L('Zu kurz', 'Not enough letters'));
    if (!lists_.valid.has(cur)) return bad(L('Nicht in der Wortliste', 'Not in the word list'));
    if (hard) {
      const open = answers.map((a, b) => b).filter((b) => solvedAt[b] < 0);
      for (const b of open) {
        const broken = hardRule(cur, rows.map((w, r) => ({ w, m: marks[r][b] })));
        if (broken) return bad(broken.includes(':') ? L(`Stelle ${broken.split(':')[0]} muss ${broken.split(':')[1]} sein`, `Letter ${broken.split(':')[0]} must be ${broken.split(':')[1]}`) : L(`Das Wort muss ${broken} enthalten`, `The word must contain ${broken}`));
      }
    }
    rows = [...rows, cur];
    cur = '';
    revealing = rows.length - 1;
    sfx('tick');
    const fast = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const r = revealing;
    setTimeout(() => { if (revealing === r) revealing = -1; check(false); }, fast ? 0 : 110 * LEN + 380);
    if (mode === 'daily') save((s) => { s.daily = { ...s.daily, [lang]: { ...(s.daily?.[lang]?.day === dayN ? s.daily[lang] : {}), day: dayN, rows: $state.snapshot(rows) } }; });
  }
  function bad(text: string) {
    say(text);
    shake = true;
    setTimeout(() => (shake = false), 450);
    sfx('stop');
  }
  /** After a reveal: solved, out of guesses, or on. `silent` when restoring a saved daily game. */
  function check(silent: boolean) {
    if (!answers.length) return;
    const all = solvedAt.every((r) => r >= 0);
    if (!all && rows.length < maxRows) { if (!silent && rows.length && solvedAt.includes(rows.length - 1)) sfx('gem'); return; }
    phase = all ? 'won' : 'lost';
    if (mode === 'daily') finishDaily(all, silent);
    else {
      const coins = all && staked ? Math.round(staked * multFor(n, maxRows - rows.length) * 100) / 100 : 0;
      if (staked) settle(coins, coins);
      staked = 0;
      result = { coins, text: all ? L(`Geschafft in ${rows.length} Versuchen`, `Solved in ${rows.length} guesses`) : L('Keine Versuche mehr', 'Out of guesses') };
      if (!silent) sfx(all ? (coins > 0 ? 'win' : 'cash') : 'lose');
    }
  }
  function finishDaily(won: boolean, silent: boolean) {
    const d = load().daily?.[lang];
    let coins = 0;
    if (!d?.paid) {
      coins = won ? DAILY_COINS[rows.length] : 0;
      if (coins) settle(coins, coins);
      save((s) => {
        s.daily = { ...s.daily, [lang]: { day: dayN, rows: $state.snapshot(rows), paid: true } };
        const st = s.stats?.[lang] ?? { played: 0, won: 0, streak: 0, max: 0, last: 0, dist: [0, 0, 0, 0, 0, 0, 0] };
        st.played++;
        if (won) { st.won++; st.dist[rows.length]++; st.streak = st.last === dayN - 1 ? st.streak + 1 : 1; st.max = Math.max(st.max, st.streak); }
        else st.streak = 0;
        st.last = won ? dayN : st.last;
        s.stats = { ...s.stats, [lang]: st };
      });
    }
    result = { coins, text: won ? L(`Tageswort in ${rows.length}/6`, `Daily word in ${rows.length}/6`) : L('Heute nicht geschafft', 'Not today') };
    if (!silent) sfx(won ? 'win' : 'lose');
  }
  const stats = $derived.by(() => { void result; return load().stats?.[lang]; });

  // ---------- keyboard ----------
  const KEYS: Record<Lang, string[]> = { de: ['QWERTZUIOPÜ', 'ASDFGHJKLÖÄ', '⏎YXCVBNM⌫'], en: ['QWERTYUIOP', 'ASDFGHJKL', '⏎ZXCVBNM⌫'] };
  const RANK: Record<Mark, number> = { miss: 1, near: 2, hit: 3 };
  /** Per board the best mark seen for each letter (only rows already revealed). */
  const keyMarks = $derived(answers.map((_, b) => {
    const m: Record<string, Mark> = {};
    rows.forEach((w, r) => {
      if (r === revealing || (solvedAt[b] >= 0 && r > solvedAt[b])) return;
      [...w].forEach((c, i) => { const k = marks[r][b][i]; if (!m[c] || RANK[k] > RANK[m[c]]) m[c] = k; });
    });
    return m;
  }));
  const COLOR: Record<Mark | 'none' | 'done', string> = { hit: 'var(--w-hit)', near: 'var(--w-near)', miss: 'var(--w-miss)', none: 'var(--w-key)', done: 'var(--w-done)' };
  /** A key shows one stripe per board (solved boards greyed); one board: one colour. */
  function keyBg(c: string) {
    const parts = keyMarks.map((m, b) => (solvedAt[b] >= 0 && revealing !== solvedAt[b] ? 'done' : m[c] ?? 'none'));
    if (parts.every((p) => p === parts[0])) return COLOR[parts[0]];
    const w = 100 / parts.length;
    return `linear-gradient(90deg, ${parts.map((p, i) => `${COLOR[p]} ${i * w}% ${(i + 1) * w}%`).join(', ')})`;
  }
  const keyUsed = (c: string) => keyMarks.length > 0 && keyMarks.every((m, b) => m[c] === 'miss' || solvedAt[b] >= 0);
  function press(k: string) { if (k === '⏎') enter(); else if (k === '⌫') back(); else type(k); }
  function keydown(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter') { e.preventDefault(); if (phase === 'play') enter(); else if (mode === 'arcade') newArcade(); }
    else if (e.key === 'Backspace') { e.preventDefault(); back(); }
    else if (/^[a-zäöü]$/i.test(e.key)) {
      const c = e.key.toUpperCase();
      if (lang === 'en' && /[ÄÖÜ]/.test(c)) return;
      type(c);
    }
  }

  // ---------- share (daily) ----------
  async function share() {
    const grid = rows.map((_, r) => marks[r][0].map((m) => (m === 'hit' ? '🟩' : m === 'near' ? '🟨' : '⬛')).join('')).join('\n');
    const text = `${L('Wortjagd', 'Word Hunt')} ${lang.toUpperCase()} #${dayN} ${phase === 'won' ? rows.length : 'X'}/6${hard ? '*' : ''}\n${grid}\n${location.origin + location.pathname}#/words`;
    try { await navigator.clipboard.writeText(text); say(L('In die Zwischenablage kopiert', 'Copied to the clipboard')); } catch { say(text); }
  }
</script>

<svelte:window onkeydown={keydown} />

<section class="wj">
  <header class="head">
    <div class="h1row">
      <h1>{L('Wortjagd', 'Word Hunt')}</h1>
      <span class="eyebrow">{mode === 'daily' ? L(`Tageswort #${dayN}`, `Daily word #${dayN}`) : `Arcade · ${n} ${n === 1 ? L('Wort', 'word') : L('Wörter', 'words')}`}</span>
      <HowTo id="words" />
    </div>
    <div class="tabs" role="tablist">
      <button role="tab" aria-selected={mode === 'daily'} class:on={mode === 'daily'} onclick={() => switchTo('daily')}>☀ {L('Tageswort', 'Daily')}</button>
      <button role="tab" aria-selected={mode === 'arcade'} class:on={mode === 'arcade'} onclick={() => switchTo('arcade')}>Arcade</button>
    </div>
    <div class="right">
      <div class="seg lang">{#each ['de', 'en'] as lg}<button class:on={lang === lg} disabled={!!staked && phase === 'play'} onclick={() => switchTo(mode, lg as Lang)}>{lg.toUpperCase()}</button>{/each}</div>
    </div>
  </header>

  <div class="table">
    {#if mode === 'arcade'}
      <div class="opts">
        <div class="seg">{#each BOARDS as b}<button class:on={boards === b} disabled={!!staked && phase === 'play'} onclick={() => { boards = b; if (!staked) setup(); }}>{b} · {GUESSES[b]}</button>{/each}</div>
        <label class="switch"><span>{L('Schwer', 'Hard')}</span><input type="checkbox" bind:checked={hard} disabled={phase === 'play' && rows.length > 0} /></label>
        <label class="switch"><span>{L('Mit Einsatz', 'With stake')}</span><input type="checkbox" bind:checked={paid} disabled={!!staked} /></label>
        {#if paid}<div class="bet"><BetInput bind:value={bet} disabled={!!staked} /></div>{/if}
        <button class="btn primary" disabled={!!staked && phase === 'play'} onclick={newArcade}>{L('Neue Runde', 'New round')}</button>
        {#if paid}<span class="mono gold">{L('Alle gelöst', 'All solved')}: ×{multFor(n, 0)} … ×{multFor(n, GUESSES[n] - n)}</span>{/if}
      </div>
    {:else}
      <div class="opts">
        <label class="switch"><span>{L('Schwer', 'Hard')}</span><input type="checkbox" bind:checked={hard} disabled={rows.length > 0} /></label>
        <span class="muted small">{L('Gleiches Wort für alle, jeden Tag neu. Gelöst gibt es bis zu', 'Same word for everyone, new every day. Solving pays up to')} {DAILY_COINS[1]} Coins.</span>
      </div>
    {/if}

    <div class="boards n{n}" class:shake>
      {#if phase === 'load'}<p class="muted">{L('Lade Wörter …', 'Loading words …')}</p>{/if}
      {#each answers as ans, b (b + ans)}
        <div class="board" class:solved={solvedAt[b] >= 0 && revealing !== solvedAt[b]}>
          {#each Array(maxRows) as _, r}
            {@const done = r < rows.length && (solvedAt[b] < 0 || r <= solvedAt[b])}
            {@const typing = r === rows.length && phase === 'play' && solvedAt[b] < 0}
            {@const win = solvedAt[b] === r && revealing !== r}
            <div class="row" class:win>
              {#each Array(LEN) as _, i}
                {@const c = done ? rows[r][i] : typing ? cur[i] ?? '' : ''}
                <span class="tile {done ? marks[r][b][i] : ''}" class:flip={done} class:filled={!!c && !done}
                  style="--d:{r === revealing ? i * 110 : 0}ms; --w:{i * 80 + 60}ms">{c}</span>
              {/each}
            </div>
          {/each}
          {#if phase === 'lost' && solvedAt[b] < 0}<span class="sol" in:fly={{ y: 8 }}>{ans}</span>{/if}
        </div>
      {/each}
      {#if toast}{#key toast.id}<div class="toast" in:fly={{ y: -8, duration: 260 }}>{toast.text}</div>{/key}{/if}
    </div>

    {#if result}
      <div class="result" in:fly={{ y: 10 }}>
        <strong>{result.text}</strong>
        {#if result.coins}<span class="mono pos">+{fmt(result.coins)}</span>{/if}
        {#if mode === 'daily'}
          {#if stats}
            <div class="stats">
              <span><b class="mono">{stats.played}</b>{L('gespielt', 'played')}</span>
              <span><b class="mono">{Math.round((stats.won / Math.max(1, stats.played)) * 100)}%</b>{L('gelöst', 'solved')}</span>
              <span><b class="mono">{stats.streak}</b>{L('Serie', 'streak')}</span>
              <span><b class="mono">{stats.max}</b>{L('Beste Serie', 'best streak')}</span>
            </div>
            <div class="dist">
              {#each [1, 2, 3, 4, 5, 6] as g, i}
                {@const v = stats.dist[g] ?? 0}
                <div class="bar"><span class="mono">{g}</span><i class:me={phase === 'won' && rows.length === g} style="--v:{Math.max(0.06, v / Math.max(1, ...stats.dist))}; --i:{i}"><em class="mono">{v}</em></i></div>
              {/each}
            </div>
          {/if}
          <div class="row2">
            <button class="btn" onclick={share}>{L('Teilen', 'Share')}</button>
            <button class="btn primary" onclick={() => switchTo('arcade')}>{L('Weiter mit Arcade', 'Play arcade')}</button>
          </div>
        {:else}
          <button class="btn primary" onclick={newArcade} disabled={paid && bet > wallet.balance}>{L('Nochmal', 'Again')}</button>
        {/if}
      </div>
    {/if}

    <div class="kb" aria-label={L('Tastatur', 'Keyboard')}>
      {#each KEYS[lang] as line}
        <div class="kr">
          {#each line as k}
            <button class="key" class:wide={k === '⏎' || k === '⌫'} class:used={k.length === 1 && k !== '⏎' && k !== '⌫' && keyUsed(k)}
              style={k === '⏎' || k === '⌫' ? '' : `background: ${keyBg(k)}`} onclick={() => press(k)} aria-label={k === '⏎' ? 'Enter' : k === '⌫' ? 'Backspace' : k}>{k}</button>
          {/each}
        </div>
      {/each}
    </div>
  </div>
</section>

<style>
  .wj {
    --w-hit: #2fa968; --w-near: #d9a531; --w-miss: #3a3d4a; --w-key: #5a5f73; --w-done: #2b2e38;
    width: min(100%, 1100px); margin-inline: auto; padding: 0 20px 48px; display: grid; gap: 14px;
  }
  .head { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px 16px; padding: 12px 4px 0; min-height: 64px; }
  .right { display: flex; justify-content: flex-end; }
  @media (max-width: 760px) { .head { grid-template-columns: 1fr auto; } .right { grid-column: 2; grid-row: 1; } .tabs { grid-column: 1 / -1; justify-self: start; } }
  .h1row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  h1 { margin: 0; font-size: clamp(1.7rem, 3vw, 2.4rem); letter-spacing: -0.04em; line-height: 1; }
  .tabs { display: flex; gap: 4px; padding: 4px; border-radius: 999px; background: var(--surface); box-shadow: inset 0 0 0 1px var(--line-2); }
  .tabs button { border: 0; background: none; color: var(--muted); min-height: 36px; padding: 0 18px; border-radius: 999px; font-weight: 600; transition: background 0.3s var(--ease-snap), color 0.3s var(--ease-snap); }
  .tabs button.on { background: linear-gradient(180deg, #f3d488, #c9973f); color: #2a1604; }
  .seg { display: flex; border: 1px solid var(--line-2); border-radius: 999px; padding: 3px; gap: 3px; }
  .seg button { border: 0; background: none; min-height: 32px; padding: 0 12px; border-radius: 999px; color: var(--muted); font-size: 0.82rem; font-weight: 600; transition: background 0.3s var(--ease-snap), color 0.3s var(--ease-snap); }
  .seg button.on { background: var(--text); color: var(--bg); }
  .muted { color: var(--muted); } .small { font-size: 0.82rem; } .pos { color: #6ff0a6; } .gold { color: var(--gold); font-size: 0.8rem; }

  .table { display: grid; gap: 16px; justify-items: center; padding: clamp(14px, 2.6vw, 28px); border-radius: 30px; background: radial-gradient(ellipse at 50% 0%, #22264a, #0d0f1d 75%); box-shadow: inset 0 0 0 1px rgba(232,196,120,.22); color: #eef0f8; }
  .opts { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; justify-content: center; }
  .opts .switch { color: rgba(238,240,248,.75); font-size: 0.85rem; }
  .bet { width: 200px; }

  .boards { position: relative; display: grid; gap: clamp(10px, 2vw, 22px); justify-content: center; }
  .boards { --t: 58px; }
  .boards.n2 { --t: 46px; grid-template-columns: repeat(2, auto); }
  .boards.n4 { --t: 34px; grid-template-columns: repeat(2, auto); }
  .boards.n8 { --t: 24px; grid-template-columns: repeat(4, auto); gap: 10px; }
  .board { position: relative; display: grid; gap: calc(var(--t) * 0.09); padding: 6px; border-radius: 12px; transition: opacity 0.4s var(--ease-snap); }
  .boards:not(.n1) .board.solved { opacity: 0.55; }
  .row { display: grid; grid-template-columns: repeat(5, var(--t)); gap: calc(var(--t) * 0.09); }
  .tile {
    width: var(--t); height: var(--t); display: grid; place-items: center; border-radius: calc(var(--t) * 0.14);
    font: 800 calc(var(--t) * 0.52) 'Geist Variable', sans-serif; color: #f4f5fb; background: rgba(255,255,255,.04); box-shadow: inset 0 0 0 2px rgba(255,255,255,.12);
  }
  .tile.filled { box-shadow: inset 0 0 0 2px rgba(255,255,255,.42); animation: pop 0.22s var(--spring-snappy); }
  .tile.hit { background: var(--w-hit); box-shadow: none; }
  .tile.near { background: var(--w-near); box-shadow: none; }
  .tile.miss { background: var(--w-miss); box-shadow: none; }
  /* reveal: flip on the x axis, the colour switches when the tile is edge-on */
  .tile.flip { animation: flip 0.44s var(--ease-snap) var(--d) backwards, paint 0.22s steps(1, end) var(--d) backwards; }
  .win .tile { animation: hop 0.6s var(--spring-snappy) var(--w) backwards; }
  @keyframes pop { from { transform: scale(1.08); } }
  @keyframes flip { 0% { transform: rotateX(0); } 50% { transform: rotateX(90deg); } 100% { transform: rotateX(0); } }
  @keyframes paint { from { background: rgba(255,255,255,.04); box-shadow: inset 0 0 0 2px rgba(255,255,255,.42); } }
  @keyframes hop { 40% { transform: translateY(calc(var(--t) * -0.28)); } }
  .shake { animation: shake 0.42s var(--ease-snap); }
  @keyframes shake { 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }
  .sol { justify-self: center; margin-top: 4px; padding: 3px 10px; border-radius: 8px; background: rgba(232,196,120,.18); color: #f3d488; font: 700 calc(var(--t) * 0.36 + 6px) 'Geist Mono Variable', monospace; letter-spacing: 0.12em; }
  .toast { position: fixed; top: calc(var(--nav-h) + 18px); left: 50%; translate: -50% 0; z-index: 30; padding: 8px 14px; border-radius: 12px; background: #f4f5fb; color: #15172a; font-weight: 600; font-size: 0.88rem; box-shadow: 0 12px 28px rgba(0,0,0,.4); white-space: nowrap; }

  .result { display: grid; justify-items: center; gap: 10px; padding: 14px 20px; border-radius: 18px; background: rgba(0,0,0,.28); box-shadow: inset 0 0 0 1px rgba(232,196,120,.25); min-width: min(100%, 360px); }
  .result strong { font-size: 1.15rem; }
  .result .pos { font-size: 1.3rem; font-weight: 700; }
  .stats { display: flex; gap: 14px; }
  .stats span { display: grid; justify-items: center; font-size: 0.7rem; color: rgba(238,240,248,.6); }
  .stats b { font-size: 1.3rem; color: #fff; }
  .dist { display: grid; gap: 4px; width: 100%; }
  .bar { display: grid; grid-template-columns: 14px 1fr; gap: 8px; align-items: center; font-size: 0.75rem; }
  .bar i { display: flex; justify-content: flex-end; height: 18px; border-radius: 4px; background: var(--w-miss); transform-origin: left; transform: scaleX(var(--v)); animation: grow 0.6s var(--spring-snappy) calc(var(--i) * 80ms) backwards; }
  .bar i.me { background: var(--w-hit); }
  .bar em { font-style: normal; padding: 0 6px; font-size: 0.7rem; transform: scaleX(calc(1 / var(--v))); transform-origin: right; }
  @keyframes grow { from { transform: scaleX(0.02); } }
  .row2 { display: flex; gap: 8px; }

  .kb { display: grid; gap: 6px; width: min(100%, 560px); user-select: none; }
  .kr { display: flex; gap: 5px; justify-content: center; }
  .key {
    flex: 1; max-width: 46px; min-height: 52px; padding: 0; border: 0; border-radius: 8px; color: #fff; font: 700 0.95rem 'Geist Variable', sans-serif; background: var(--w-key);
    transition: transform 0.16s var(--ease-snap), opacity 0.3s var(--ease-snap); touch-action: manipulation;
  }
  .key.wide { max-width: 72px; flex: 1.5; font-size: 1.1rem; background: #6a7088; }
  .key.used { opacity: 0.45; }
  .key:active { transform: scale(0.95); }
  @media (hover: hover) and (pointer: fine) { .key:hover { filter: brightness(1.12); } }
  @media (max-width: 560px) {
    .wj { padding: 0 8px 30px; }
    .boards { --t: min(58px, calc((100vw - 70px) / 5.5)); }
    .boards.n2 { --t: calc((100vw - 90px) / 11); }
    .boards.n4 { --t: calc((100vw - 90px) / 11); }
    .boards.n8 { --t: calc((100vw - 80px) / 22); gap: 4px; }
    .key { min-height: 48px; font-size: 0.85rem; }
    .kr { gap: 4px; }
  }
  @media (max-width: 560px) { .boards.n8 .board { padding: 2px; } }
  @media (prefers-reduced-motion: reduce) {
    .tile.filled, .tile.flip, .win .tile, .shake, .bar i { animation: paint 0.01s steps(1, end) backwards; }
  }
</style>
