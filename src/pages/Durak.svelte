<script lang="ts">
  // Durak: 2-6 players, the rest bots. The host's browser runs the game (seat 0); guests take free seats.
  // Every screen is turned so its own seat is at the bottom, and only its own hand is sent to it.
  import { onDestroy, untrack } from 'svelte';
  import { fly, scale } from 'svelte/transition';
  import JassCard from '../components/JassCard.svelte';
  import DeckSelect from '../components/DeckSelect.svelte';
  import BetInput from '../components/BetInput.svelte';
  import RoomBar from '../components/RoomBar.svelte';
  import DurakGuide from '../components/DurakGuide.svelte';
  import * as D from '../games/durak';
  import type { Card, Durak, Action, Opts } from '../games/durak';
  import { Room } from '../lib/net.svelte';
  import { settings, wallet, stake, settle, fmt } from '../lib/state.svelte';
  import { pickDeck } from '../lib/decks';
  import { tr, type DLang, type TKey } from '../lib/durakText';
  import { sfx } from '../lib/sfx';
  import { pop } from '../lib/motion';

  // ---------- language (this game alone also speaks Russian) ----------
  const LS = (k: string, v?: string) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch {} return null; };
  let lang = $state<DLang>((LS('betly:durak-lang') as DLang) || settings.lang);
  $effect(() => { LS('betly:durak-lang', lang); });
  const t = (k: TKey) => tr(k, lang);
  const deck = $derived(pickDeck(settings.cards, ['fr', 'intl', 'ru']));
  const BACK: Card = { s: 0, r: 0 };

  // ---------- table settings ----------
  let players = $state(+(LS('betly:durak-n') ?? 4) || 4);
  let opts = $state<Opts>({ transfer: true, allThrow: false });
  let bet = $state(100);
  $effect(() => { LS('betly:durak-n', String(players)); });

  // ---------- game (host) / view (guest) ----------
  let g = $state<Durak | null>(null);
  let lastLoser = -1;
  let match = $state(0);
  let staked = $state(0);
  let bubbles = $state<string[]>(Array(6).fill(''));
  let lastChange = performance.now();
  function say(p: number, text: string, ms = 2200) {
    bubbles[p] = text;
    setTimeout(() => { if (bubbles[p] === text) bubbles[p] = ''; }, ms);
  }

  // ---------- multiplayer ----------
  const BOTS = ['', 'Mischa', 'Olga', 'Dima', 'Katja', 'Sascha'];
  let seats = $state<Record<number, { id: string; name: string }>>({});
  let remote = $state<{ names: string[]; humans: boolean[] }>({ names: [], humans: [] });
  let me = $state(0);
  const room = new Room('durak', onMsg, (id) => {
    const seat = +Object.keys(seats).find((k) => seats[+k].id === id)!;
    if (Number.isNaN(seat)) return;
    delete seats[seat];
    say(seat, t('left'));
    push();
  });
  const isGuest = $derived(room.role === 'guest');
  const human = (p: number) => p === 0 || !!seats[p];
  const names = $derived(isGuest ? remote.names : Array.from({ length: g?.n ?? players }, (_, p) => (p === 0 ? settings.name || t('you') : seats[p]?.name ?? BOTS[p])));
  const humans = $derived(isGuest ? remote.humans : Array.from({ length: g?.n ?? players }, (_, p) => human(p)));

  function onMsg(m: any, from: string) {
    if (m.t === 'state') {
      if (!isGuest) return;
      const was = g?.phase, wasMatch = match, wasLen = g?.table.length ?? 0;
      g = m.s.g; me = m.s.seat; match = m.s.match; bubbles = m.s.bubbles; remote = { names: m.s.names, humans: m.s.humans };
      players = m.s.players; opts = m.s.opts;
      if ((g?.table.length ?? 0) > wasLen) sfx('card');
      if (g && match !== wasMatch && g.phase === 'play') guestStart();
      if (g?.phase === 'over' && was !== 'over') finish();
      return;
    }
    if (isGuest) return;
    if (m.t === 'join') {
      if (Object.values(seats).some((x) => x.id === from)) return push();
      // during a game only bot seats can be taken over; in the lobby any free seat
      const n = g?.n ?? players;
      const seat = Array.from({ length: n - 1 }, (_, i) => i + 1).find((p) => !seats[p]);
      if (seat === undefined) return room.sendTo(from, { t: 'full' });
      seats[seat] = { id: from, name: String(m.name ?? '').slice(0, 20) || 'Gast' };
      say(seat, t('joined'));
      return push();
    }
    const seat = +Object.keys(seats).find((k) => seats[+k].id === from)!;
    if (Number.isNaN(seat)) return;
    if (m.t === 'act' && g) doAct(seat, m.a);
    if (m.t === 'emote') { say(seat, String(m.e).slice(0, 4), 1800); push(); }
  }
  /** host: every change goes out; each guest sees its own hand only, the pack face down */
  function push() {
    if (room.role !== 'host') return;
    const snap = g ? $state.snapshot(g) : null;
    for (const [k, guest] of Object.entries(seats)) {
      const seat = +k;
      const view = snap && { ...snap, hands: snap.hands.map((h, i) => (i === seat ? h : h.map(() => BACK))), deck: snap.deck.map(() => BACK) };
      room.sendTo(guest.id, { t: 'state', s: { g: view, seat, match, bubbles: $state.snapshot(bubbles), names: $state.snapshot(names), humans: $state.snapshot(humans), players, opts: $state.snapshot(opts) } });
    }
  }
  $effect(() => { void $state.snapshot([g, bubbles, players, opts, seats]); untrack(push); });
  $effect(() => {
    const role = room.role;
    untrack(() => {
      if (role === 'guest') { g = null; room.send({ t: 'join', name: settings.name }); }
      else { me = 0; if (role === 'solo') seats = {}; }
    });
  });

  // ---------- running the game (host / solo) ----------
  function start() {
    if (isGuest || bet > wallet.balance || bet < 1) return;
    stake(bet); staked = bet;
    match++;
    g = D.newGame(players, $state.snapshot(opts), lastLoser);
    bubbles = Array(6).fill('');
    lastChange = performance.now();
    for (let i = 0; i < 6; i++) setTimeout(() => sfx('card'), i * 60);
  }
  function guestStart() {
    staked = bet > 0 && bet <= wallet.balance ? bet : 0;
    if (staked) stake(staked);
  }
  function doAct(p: number, a: Action) {
    if (!g) return false;
    const was = g.log;
    if (!D.act(g, p, a)) return false;
    lastChange = performance.now();
    sfx(a.t === 'take' ? 'stop' : 'card');
    if (a.t === 'take') say(p, t('sayTake'));
    if (a.t === 'transfer') say(p, t('sayTransfer'));
    if (g.log === 'bito' && was !== 'bito') say(g.attacker === p ? p : (g.n + g.attacker - 1) % g.n, t('sayBito'), 1600);
    if (g.phase === 'over') { lastLoser = g.loser; finish(); }
    return true;
  }
  function finish() {
    if (!g || !staked) return;
    const won = g.loser === -1 ? staked : g.loser === me ? 0 : Math.round(staked * D.payout(g.n) * 100) / 100;
    settle(won, won); // the stake already left the wallet at the start
    sfx(g.loser === me ? 'lose' : 'big');
    staked = 0;
  }
  // one step every 250 ms: humans with nothing to add pass on their own, bots move after a short pause,
  // and a human who sits on their turn too long is moved for (take / pass / lowest card)
  const tick = setInterval(() => {
    if (!g || isGuest || g.phase !== 'play') return;
    const since = performance.now() - lastChange;
    for (const p of D.throwers(g)) {
      if (human(p) && g.table.length && !g.passed[p] && !g.hands[p].some((c) => D.legal(g!, p, { t: 'attack', c })) && p !== g.defender) { D.act(g, p, { t: 'pass' }); lastChange = performance.now(); return; }
    }
    const order = [g.defender, g.attacker, ...Array.from({ length: g.n }, (_, i) => i)];
    if (since > (g.table.length ? 650 : 900)) {
      for (const p of order) {
        if (human(p)) continue;
        const a = D.bot(g, p);
        if (a && doAct(p, a)) return;
      }
    }
    const limit = g.table.length && D.throwers(g).includes(me) && me !== g.defender ? 12000 : 25000;
    if (since > limit) for (const p of order) { if (!human(p)) continue; const a = D.bot(g, p); if (a && doAct(p, a)) return; }
  }, 250);
  onDestroy(() => { clearInterval(tick); room.leave(); });

  // ---------- my moves ----------
  let sel = $state<Card | null>(null);
  const myHand = $derived(g ? D.sortHand(g.hands[me] ?? [], g.trump.s) : []);
  const amDef = $derived(!!g && g.phase === 'play' && g.defender === me);
  const canAttack = (c: Card) => !!g && D.legal(g, me, { t: 'attack', c });
  const targets = (c: Card) => (g ? g.table.map((x, i) => (D.legal(g!, me, { t: 'beat', c, i }) ? i : -1)).filter((i) => i >= 0) : []);
  const canTransfer = (c: Card) => !!g && D.legal(g, me, { t: 'transfer', c });
  const playable = (c: Card) => canAttack(c) || (amDef && (targets(c).length > 0 || canTransfer(c)));
  function send(a: Action) {
    sel = null;
    if (isGuest) return room.send({ t: 'act', a });
    doAct(me, a);
  }
  function tapCard(c: Card) {
    if (!g || !playable(c)) { sfx('lose'); return; }
    if (canAttack(c)) return send({ t: 'attack', c });
    const ts = targets(c);
    if (ts.length === 1 && !canTransfer(c)) return send({ t: 'beat', c, i: ts[0] });
    sel = sel && D.same(sel, c) ? null : c; // more than one choice: tap a table card (or pass it on)
  }
  function tapPair(i: number) { if (sel && targets(sel).includes(i)) send({ t: 'beat', c: sel, i }); }
  const canTake = $derived(!!g && D.legal(g, me, { t: 'take' }));
  const canPass = $derived(!!g && D.legal(g, me, { t: 'pass' }));
  const allCovered = $derived(!!g && g.table.length > 0 && g.table.every((x) => x.d));

  // ---------- table layout: me at the bottom, the others clockwise from the left over the top ----------
  const pos = (p: number) => (p - me + (g?.n ?? players)) % (g?.n ?? players);
  function seatXY(p: number) {
    const n = g?.n ?? players, j = pos(p), a = (Math.PI * j) / n;
    return { x: 50 - 45 * Math.cos(a), y: j === 0 ? 100 : 46 - 38 * Math.sin(a) };
  }
  const from = (p: number) => { const { x, y } = seatXY(p); return { x: (x - 50) * 7, y: (y - 50) * 5 }; };
  const status = $derived.by(() => {
    if (!g || g.phase !== 'play') return '';
    if (g.out.includes(me)) return t('youOut');
    if (amDef) return sel ? t('pickTarget') : t('yourDefence');
    if (g.attacker === me && !g.table.length) return t('yourAttack');
    if (D.throwers(g).includes(me) && g.table.length && !g.passed[me]) return t('throwIn');
    return `${t('waiting')} ${names[g.table.length ? g.defender : g.attacker]} …`;
  });
  const EMOTES = ['👍', '😂', '😱', '🤡', '🔥', '🙈'];
  function emote(e: string) { if (isGuest) room.send({ t: 'emote', e }); else say(me, e, 1800); }

  // ---------- easter egg: tap the jester's cap five times ----------
  let capTaps = 0, story = $state(false), guide = $state(false);
  function tapCap() { if (++capTaps >= 5) { capTaps = 0; story = true; } }
</script>

<section class="wrap page">
  <header class="head">
    <div>
      <p class="eyebrow">{t('eyebrow')}</p>
      <div class="h1row">
        <h1>{t('title')}</h1>
        <button class="cap" onclick={tapCap} aria-label="Durak">
          <svg viewBox="0 0 48 40" width="38" height="32" aria-hidden="true"><path d="M4 34 C6 20 14 10 24 8 C34 10 42 20 44 34Z" fill="#c8102e" /><path d="M24 8 C18 12 10 14 4 10 C10 20 16 26 18 34" fill="#f2c33a" /><path d="M24 8 C30 12 38 14 44 10 C38 20 32 26 30 34" fill="#1f5fbf" /><circle cx="4" cy="10" r="3.4" fill="#fff" /><circle cx="44" cy="10" r="3.4" fill="#fff" /><circle cx="24" cy="6" r="3.4" fill="#fff" /><rect x="2" y="32" width="44" height="6" rx="3" fill="#2a2a32" /></svg>
        </button>
        <button class="btn sm" onclick={() => (guide = true)}>? {t('guide')}</button>
      </div>
    </div>
    <div class="tools">
      <div class="langs" role="group" aria-label="Language">
        {#each [['de', 'DE'], ['en', 'EN'], ['ru', 'RU']] as [l, label]}<button class:on={lang === l} onclick={() => (lang = l as DLang)}>{label}</button>{/each}
      </div>
      <DeckSelect supported={['fr', 'intl', 'ru']} {lang} />
    </div>
  </header>
  <RoomBar {room} />

  <div class="felt">
    {#if g}
      {@const G = g}
      {#each Array.from({ length: G.n }, (_, p) => p).filter((p) => p !== me) as p (p)}
        {@const xy = seatXY(p)}
        <div class="seat" style="left:{xy.x}%; top:{xy.y}%" class:att={G.phase === 'play' && G.attacker === p} class:def={G.phase === 'play' && G.defender === p} class:gone={G.out.includes(p)} class:fool={G.phase === 'over' && G.loser === p}>
          <div class="backs">{#each G.hands[p].slice(0, 12) as _, i (i)}<div class="bk" style="--i:{i}"><JassCard card={BACK} {deck} down /></div>{/each}</div>
          <span class="nm">
            {#if G.phase === 'play' && G.attacker === p}<i class="role">⚔</i>{/if}{#if G.phase === 'play' && G.defender === p}<i class="role">🛡</i>{/if}
            {names[p]}{#if humans[p] && p !== me}<i class="hu">●</i>{/if}
            <b class="mono">{G.hands[p].length}</b>
          </span>
          {#if G.out.includes(p)}<span class="tag">{G.out.indexOf(p) + 1}. {t('out')}</span>{/if}
          {#if bubbles[p]}<span class="bubble" in:pop>{bubbles[p]}</span>{/if}
        </div>
      {/each}

      <!-- pack with the trump card under it, and the discard pile -->
      <div class="pack">
        {#if G.deck.length}
          <div class="trumpcard"><JassCard card={G.trump} {deck} /></div>
          {#if G.deck.length > 1}<div class="pk"><JassCard card={BACK} {deck} down /></div>{/if}
          <span class="cnt mono">{G.deck.length}</span>
        {:else}
          <span class="trumpicon" title={t('trump')}><JassCard icon card={G.trump} {deck} /></span>
        {/if}
      </div>
      <div class="bito" title={t('discard')}>
        {#each Array.from({ length: Math.min(6, Math.ceil(G.discard / 4)) }, (_, i) => i) as i}<div class="bk" style="--r:{(i * 37) % 24 - 12}deg"><JassCard card={BACK} {deck} down /></div>{/each}
      </div>

      <div class="table">
        {#each G.table as x, i (x.a.s * 100 + x.a.r)}
          <button class="pair" class:target={!!sel && targets(sel).includes(i)} onclick={() => tapPair(i)}
            in:fly={{ ...from(x.ab), duration: 320, opacity: 0.3 }}
            out:fly={{ ...(G.taker >= 0 ? from(G.taker) : { x: 380, y: -40 }), duration: 380, opacity: 0 }}>
            <JassCard card={x.a} {deck} />
            {#if x.d}<div class="cover" in:fly={{ ...from(x.db), duration: 300, opacity: 0.3 }}><JassCard card={x.d} {deck} /></div>{/if}
          </button>
        {/each}
      </div>

      {#if G.phase === 'over'}
        <div class="result" in:scale={{ start: 0.85, duration: 350 }}>
          {#if G.loser === -1}<h2>{t('draw')}</h2>
          {:else if G.loser === me}<h2 class="lose">{t('youDurak')}</h2>
          {:else}<h2>{names[G.loser]} {t('durakIs')}</h2>{/if}
          {#if D.pogony(G)}<p class="muted">{t('pogony')}</p>{/if}
          <ol>{#each G.out as p}<li>{names[p]}</li>{/each}</ol>
          {#if !isGuest}<button class="btn primary" onclick={start} disabled={bet > wallet.balance}>{t('again')}</button>{/if}
        </div>
      {/if}

      {#if bubbles[me]}<span class="bubble mine" in:pop>{bubbles[me]}</span>{/if}
      <div class="hand" class:my={amDef || (D.throwers(G).includes(me) && G.phase === 'play')}>
        {#each myHand as c (c.s * 100 + c.r)}
          <button class="hc" class:ok={playable(c)} class:sel={sel && D.same(sel, c)} onclick={() => tapCard(c)} in:fly={{ x: -260, y: -200, duration: 420 }} aria-label="card">
            <JassCard card={c} {deck} />
          </button>
        {/each}
      </div>
    {:else}
      <div class="intro" in:pop>
        <p>{t('intro')}</p>
        <p class="muted">{t('mpHint')}</p>
        {#if isGuest}<p class="muted">{t('guestWait')}</p>{/if}
        <ul class="who">{#each names as nm, p}<li class:hu={humans[p]}>{nm}</li>{/each}</ul>
      </div>
    {/if}
  </div>

  <div class="dock panel">
    {#if !g || g.phase === 'over'}
      <BetInput bind:value={bet} />
      <div class="field">{t('players')}
        <div class="seg">{#each [2, 3, 4, 5, 6] as n}<button class:on={players === n} disabled={isGuest || n <= Object.keys(seats).length} onclick={() => (players = n)}>{n}</button>{/each}</div>
      </div>
      <label class="switch" title={t('transferTip')}><span>{t('transfer')}</span><input type="checkbox" bind:checked={opts.transfer} disabled={isGuest} /></label>
      <label class="switch" title={t('allThrowTip')}><span>{t('allThrow')}</span><input type="checkbox" bind:checked={opts.allThrow} disabled={isGuest} /></label>
      <p class="small muted">{t('pays')} ×{D.payout(players)}</p>
      {#if !isGuest}<button class="btn primary big" onclick={start} disabled={bet < 1 || bet > wallet.balance}>{g ? t('again') : t('play')}</button>{/if}
    {:else}
      <p class="status">{status}</p>
      <div class="acts">
        {#if sel && canTransfer(sel)}<button class="btn" onclick={() => send({ t: 'transfer', c: sel! })}>{t('transferBtn')} →</button>{/if}
        {#if canTake}<button class="btn primary" onclick={() => send({ t: 'take' })}>{t('take')}</button>{/if}
        {#if canPass}<button class="btn" onclick={() => send({ t: 'pass' })}>{g.taking ? t('give') : allCovered ? t('bito') : t('pass')}</button>{/if}
      </div>
      <div class="emotes">{#each EMOTES as e}<button onclick={() => emote(e)} aria-label={e}>{e}</button>{/each}</div>
      <span class="mono muted small">{t('stake')} {fmt(staked)}</span>
    {/if}
  </div>
  {#if deck === 'ru'}<p class="credit">{lang === 'ru' ? 'Карты' : lang === 'en' ? 'Cards' : 'Karten'}: <a href="https://commons.wikimedia.org/wiki/File:Atlasnye_playing_cards_deck_2.svg" target="_blank" rel="noopener noreferrer">Atlasnye playing cards, Wikimedia Commons</a></p>{/if}
</section>

{#if guide}<DurakGuide {lang} {deck} onclose={() => (guide = false)} />{/if}
{#if story}<DurakGuide {lang} {deck} story onclose={() => (story = false)} />{/if}

<style>
  .page { padding-bottom: 80px; }
  .credit { font-size: 0.78rem; color: var(--muted); margin: 12px 0 0; }
  .credit a { color: inherit; }
  .head { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 12px; padding: 28px 0 8px; }
  .h1row { display: flex; align-items: center; gap: 10px; }
  h1 { margin: 6px 0 0; font-size: clamp(2.2rem, 5vw, 3.6rem); letter-spacing: -0.04em; line-height: 0.95; }
  .cap { border: 0; background: none; padding: 0; cursor: pointer; transition: transform 0.3s var(--ease-snap); }
  .cap:active { transform: rotate(-12deg) scale(0.92); }
  .tools { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .langs, .seg { display: flex; padding: 3px; gap: 3px; border-radius: 999px; border: 1px solid var(--line-2); }
  .langs button, .seg button { min-width: 40px; min-height: 34px; border: 0; background: none; border-radius: 999px; color: var(--muted); font: 600 0.8rem 'Geist Mono Variable', monospace; }
  .langs button.on, .seg button.on { background: var(--text); color: var(--bg); }
  .seg button:disabled { opacity: 0.35; }

  .felt {
    position: relative; height: clamp(460px, calc(100dvh - var(--nav-h) - 230px), 640px); border-radius: 32px; overflow: hidden;
    background: radial-gradient(ellipse at 50% 40%, #2d6a4a, #173a2a 75%); box-shadow: inset 0 0 0 10px #4a2e1c, inset 0 0 0 12px #6b4426, 0 30px 60px -30px rgba(0,0,0,.7);
    --cw: clamp(52px, 6vw, 74px); color: #fff;
  }
  .seat { position: absolute; translate: -50% -50%; display: grid; justify-items: center; gap: 4px; z-index: 2; transition: opacity 0.3s; }
  .seat.gone { opacity: 0.45; }
  .backs { display: flex; --cw: 26px; height: 40px; }
  .bk { margin-left: -16px; } .bk:first-child { margin-left: 0; }
  .nm { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 999px; background: rgba(0,0,0,.4); font-size: 0.8rem; white-space: nowrap; }
  .nm b { padding: 0 6px; border-radius: 999px; background: rgba(255,255,255,.15); font-size: 0.72rem; }
  .seat.att .nm { box-shadow: 0 0 0 2px #e5484d; }
  .seat.def .nm { box-shadow: 0 0 0 2px #3d9bff; }
  .seat.fool .nm { box-shadow: 0 0 0 2px #f2c33a; }
  .role, .hu { font-style: normal; }
  .hu { color: #2fbf71; font-size: 0.6rem; }
  .tag { font-size: 0.7rem; color: #8ff0bf; }
  .bubble { position: absolute; bottom: calc(100% + 4px); padding: 6px 10px; border-radius: 12px; background: #fffdf6; color: #1c1c22; font-weight: 600; font-size: 0.85rem; white-space: nowrap; box-shadow: 0 8px 20px rgba(0,0,0,.35); }
  .bubble.mine { position: absolute; left: 50%; bottom: calc(var(--cw) * 1.6 + 26px); translate: -50% 0; z-index: 6; }

  .pack { position: absolute; left: 6%; top: 50%; translate: 0 -50%; width: calc(var(--cw) * 1.4); height: calc(var(--cw) * 1.4); }
  .trumpcard { position: absolute; left: calc(var(--cw) * 0.5); top: 0; rotate: 90deg; transform-origin: 50% 50%; }
  .pk { position: absolute; left: 0; top: 0; filter: drop-shadow(2px 2px 0 rgba(0,0,0,.25)); }
  .cnt { position: absolute; left: 0; bottom: -24px; font-size: 0.8rem; background: rgba(0,0,0,.4); padding: 1px 8px; border-radius: 999px; }
  .trumpicon { position: absolute; left: 10px; top: 50%; font-size: 1.8rem; }
  .bito { position: absolute; right: 7%; top: 50%; translate: 0 -50%; --cw: 44px; }
  .bito .bk { position: absolute; margin: 0; rotate: var(--r); }

  .table { position: absolute; left: 50%; top: 47%; translate: -50% -50%; display: grid; grid-template-columns: repeat(3, auto); gap: 14px 22px; }
  .pair { position: relative; padding: 0; border: 0; background: none; border-radius: 10px; transition: box-shadow 0.2s; }
  .pair.target { box-shadow: 0 0 0 3px #f2c33a; cursor: pointer; }
  .cover { position: absolute; left: 30%; top: 22%; rotate: 8deg; }

  .result { position: absolute; left: 50%; top: 45%; translate: -50% -50%; z-index: 8; display: grid; gap: 8px; justify-items: center; padding: 22px 28px; border-radius: 22px; background: rgba(12,16,30,.8); backdrop-filter: blur(8px); text-align: center; }
  .result h2 { margin: 0; font-size: 1.6rem; }
  .result h2.lose { color: #ff9a9d; }
  .result ol { margin: 0; padding-left: 20px; text-align: left; font-size: 0.9rem; color: rgba(255,255,255,.8); }

  .hand { position: absolute; left: 0; right: 0; bottom: 10px; display: flex; justify-content: center; padding: 0 8px; z-index: 5; }
  .hc { padding: 0; border: 0; background: none; margin-left: calc(var(--cw) * -0.28); transition: transform 0.22s var(--ease-snap), filter 0.2s; }
  .hc:first-child { margin-left: 0; }
  .hand.my .hc:not(.ok) { filter: brightness(0.62); }
  .hc.ok { transform: translateY(-14px); cursor: pointer; }
  .hc.ok:hover { transform: translateY(-22px); }
  .hc.sel { transform: translateY(-30px); filter: drop-shadow(0 0 10px #f2c33a); }

  .intro { position: absolute; inset: 0; display: grid; place-content: center; gap: 10px; max-width: 520px; margin: auto; padding: 24px; text-align: center; }
  .intro p { margin: 0; }
  .who { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; padding: 0; margin: 6px 0 0; list-style: none; }
  .who li { padding: 4px 10px; border-radius: 999px; background: rgba(0,0,0,.35); font-size: 0.82rem; }
  .who li.hu { box-shadow: 0 0 0 2px #2fbf71; }
  .muted { color: rgba(255,255,255,.72); }
  .dock .muted { color: var(--muted); }

  .dock { margin-top: 14px; padding: 14px 16px; display: flex; flex-wrap: wrap; gap: 12px 16px; align-items: center; }
  .status { margin: 0; font-weight: 600; flex: 1 1 220px; }
  .acts { display: flex; gap: 8px; flex-wrap: wrap; }
  .emotes { display: flex; gap: 2px; }
  .emotes button { width: 34px; height: 34px; border: 0; background: none; font-size: 1.15rem; border-radius: 50%; transition: transform 0.15s; }
  .emotes button:hover { transform: scale(1.2); }
  .big { min-height: 48px; padding: 0 28px; }
  .small { font-size: 0.8rem; margin: 0; }
  .switch { display: inline-flex; gap: 10px; align-items: center; font-size: 0.88rem; }
  .field { display: inline-flex; gap: 10px; align-items: center; font-size: 0.88rem; }

  @media (max-width: 700px) {
    .felt { height: clamp(460px, calc(100dvh - var(--nav-h) - 170px), 620px); border-radius: 24px; --cw: 46px; }
    .backs { --cw: 18px; height: 28px; }
    .bk { margin-left: -12px; }
    .table { gap: 10px 14px; top: 45%; }
    .pack { left: 3%; } .bito { right: 3%; --cw: 34px; }
    .hc { margin-left: calc(var(--cw) * -0.42); }
    .nm { font-size: 0.72rem; padding: 3px 8px; }
  }
</style>
