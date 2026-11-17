<script lang="ts">
  // Schieber Jass: you and your partner (top) against two bots. Trump, Obenabe or Undenufe, or push the
  // choice to your partner. Weis and Stöck count, first team to the target wins the match.
  // Multiplayer: the host's browser runs the game (seat 0); guests take over bot seats, the partner seat first.
  // Seats are absolute (0-3); every screen is turned so that its own seat sits at the bottom.
  import { onDestroy, untrack } from 'svelte';
  import RoomBar from '../components/RoomBar.svelte';
  import { Room } from '../lib/net.svelte';
  import { fly } from 'svelte/transition';
  import JassCard from '../components/JassCard.svelte';
  import obeIcon from '../assets/jass/icons/obe.webp';
  import undeIcon from '../assets/jass/icons/unde.webp';
  import pushIcon from '../assets/jass/icons/schieben.webp';
  import HowTo from '../components/HowTo.svelte';
  import BetInput from '../components/BetInput.svelte';
  import * as J from '../games/jass';
  import type { JCard, Mode, Play, Weis, Deck } from '../games/jass';
  import { wallet, settle, stake, settings, fmt } from '../lib/state.svelte';
  import { pickDeck } from '../lib/decks';
  import DeckSelect from '../components/DeckSelect.svelte';
  import { sfx } from '../lib/sfx';
  import { pop } from '../lib/motion';

  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
  const load = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} };

  const deck = $derived<Deck>(pickDeck(settings.cards, ['de', 'fr', 'intl', 'ru']));
  let target = $state(+load('betly:jass-target', '1000') || 1000);
  $effect(() => { save('betly:jass-target', String(target)); });
  let bet = $state(100);

  const SUIT_NAMES = $derived(deck === 'de' ? L('Rosen Schilten Eicheln Schellen', 'Roses Shields Acorns Bells').split(' ') : L('Herz Schaufel Kreuz Ecken', 'Hearts Spades Clubs Diamonds').split(' '));
  const modeName = (m: Mode) => (m === 'obe' ? 'Obenabe' : m === 'unde' ? 'Undenufe' : SUIT_NAMES[m]);
  // ---------- multiplayer ----------
  const BOT_NAMES = ['', 'Vreni', 'Ueli', 'Sepp'];
  let seats = $state<Record<number, { id: string; name: string }>>({}); // host: guest per seat
  let remoteNames = $state<string[]>(['', '', '', '']);
  let me = $state(0); // my seat
  let match = $state(0); // counts matches, so guests know when to stake and settle
  const room = new Room('jass', onMsg, (id) => {
    const seat = +Object.keys(seats).find((k) => seats[+k].id === id)!;
    if (Number.isNaN(seat)) return;
    delete seats[seat];
    say(seat, L('hat den Tisch verlassen', 'left the table'));
    // a bot takes over where the guest left off
    if (phase === 'choose' && chooser === seat) botChoose(gen, seat, !pushed);
    else if (phase === 'play' && turn === seat) run(gen);
  });
  const isGuest = $derived(room.role === 'guest');
  const human = (p: number) => p === 0 || !!seats[p];
  const names = $derived(isGuest ? remoteNames : [0, 1, 2, 3].map((p) => (p === 0 ? settings.name || L('Du', 'You') : seats[p]?.name ?? BOT_NAMES[p])));
  const myTeam = $derived(me % 2);
  const us = $derived(myTeam), them = $derived(1 - myTeam); // team indexes from my side of the table
  const view = (s: number) => (s + me) % 4; // screen position (0 bottom, 1 right, 2 top, 3 left) -> seat
  const pos = (p: number) => (p - me + 4) % 4; // seat -> screen position

  function onMsg(m: any, from: string) {
    if (m.t === 'state') {
      if (!isGuest) return;
      const was = { phase, n: trick.length };
      ({ phase, hands, mode, vorhand, chooser, pushed, turn, trick, collect, tricksWon, live, total, summary, winner, bubbles, target, match } = m.s);
      remoteNames = m.s.names; me = m.s.seat;
      if (trick.length > was.n) sfx('card');
      if (was.phase !== phase) guestPhase();
      return;
    }
    if (isGuest) return;
    if (m.t === 'join') {
      if (Object.values(seats).some((x) => x.id === from)) return push();
      const seat = [2, 1, 3].find((p) => !seats[p]);
      if (seat === undefined) return room.sendTo(from, { t: 'full' });
      seats[seat] = { id: from, name: String(m.name ?? '').slice(0, 20) || 'Gast' };
      say(seat, L('ist dabei!', 'joined!'));
      // if the game was waiting on the bot in that seat, it now waits for the player
      return push();
    }
    const seat = +Object.keys(seats).find((k) => seats[+k].id === from)!;
    if (Number.isNaN(seat)) return;
    if (m.t === 'pick') pickAs(seat, m.m);
    if (m.t === 'play' && m.c) playAs(seat, { s: +m.c.s, r: +m.c.r });
  }
  // host: every change goes out, each guest sees only its own cards
  function push() {
    if (room.role !== 'host') return;
    const s = $state.snapshot({ phase, mode, vorhand, chooser, pushed, turn, trick, collect, tricksWon, live, total, summary, winner, bubbles, target, match, names });
    for (const [k, g] of Object.entries(seats)) {
      const seat = +k;
      room.sendTo(g.id, { t: 'state', s: { ...s, seat, hands: hands.map((h, i) => (i === seat ? $state.snapshot(h) : h.map(() => back))) } });
    }
  }
  $effect(() => {
    // a deep read, so a changed bubble or a card leaving a hand counts too
    void $state.snapshot([phase, mode, vorhand, chooser, pushed, turn, trick, collect, tricksWon, live, total, summary, winner, bubbles, target, match, names, hands, seats]);
    untrack(push);
  });
  // guest: say hello (and again after reconnecting); host or solo: back to seat 0
  $effect(() => {
    const role = room.role;
    untrack(() => {
      if (role === 'guest') { gen++; room.send({ t: 'join', name: settings.name }); }
      else { me = 0; if (role === 'solo') { seats = {}; if (isGuestBefore) { gen++; phase = 'setup'; hands = [[], [], [], []]; trick = []; total = [0, 0]; mode = null; } } }
      isGuestBefore = role === 'guest';
    });
  });
  let isGuestBefore = false;
  // guests stake when a match starts and settle when it ends
  let staked0 = 0, bookedMatch = 0;
  function guestPhase() {
    if (phase === 'choose' && match !== bookedMatch && staked0 !== match) {
      staked0 = match;
      staked = bet > 0 && bet <= wallet.balance && total[0] + total[1] === 0 ? bet : 0;
      if (staked) stake(staked);
    }
    if (phase === 'over' && match !== bookedMatch) {
      bookedMatch = match;
      const won = staked && winner === myTeam ? Math.round(staked * J.PAYOUT * 100) / 100 : 0;
      if (staked) settle(won, won);
      sfx(winner === myTeam ? 'big' : 'lose');
    }
  }

  type Phase = 'setup' | 'choose' | 'play' | 'round' | 'over';
  let phase = $state<Phase>('setup');
  let hands = $state<JCard[][]>([[], [], [], []]);
  let mode = $state<Mode | null>(null);
  let vorhand = $state(0); // who chooses trump and leads this round
  let chooser = $state(0); // who announced (vorhand or the partner after a push)
  let pushed = $state(false);
  let turn = $state(-1);
  let trick = $state<Play[]>([]);
  let collect = $state(-1);
  let played: JCard[] = [];
  let tricks: { winner: number; cards: JCard[] }[] = [];
  let weis: Weis[][] = [[], [], [], []];
  let stSeat = -1;
  let tricksWon = $state([0, 0]);
  let live = $state([0, 0]); // card points this round so far
  let total = $state([0, 0]);
  let summary = $state<{ cards: number[]; weis: number[]; stoeck: number[]; match: number } | null>(null);
  let winner = $state(-1);
  let staked = $state(0);
  let bubbles = $state<string[]>(['', '', '', '']);
  let gen = 0;
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, reduce() ? 60 : ms));
  onDestroy(() => gen++);

  function say(p: number, text: string, ms = 2200) {
    bubbles[p] = text;
    setTimeout(() => { if (bubbles[p] === text) bubbles[p] = ''; }, ms);
  }

  // your hand: grouped by suit (alternating colours), strongest first, trump at the front
  function sorted(h: JCard[], m: Mode | null) {
    const order = [0, 1, 3, 2];
    const key = (c: JCard) => (m !== null && J.isTrump(c, m) ? -1 : order.indexOf(c.s)) * 100 - J.power(c, m ?? 'obe', c.s);
    return [...h].sort((a, b) => key(a) - key(b));
  }
  const myHand = $derived(sorted(hands[me] ?? [], mode));
  const legalNow = $derived(phase === 'play' && turn === me && mode !== null && trick.length < 4 ? J.legal(hands[me], trick, mode) : []);
  const canPlay = (c: JCard) => legalNow.some((x) => J.same(x, c));

  const weisName = (w: Weis) => {
    if (w.four) {
      const r = ({ 11: L('Bauern', 'Jacks'), 9: L('Nell', 'Nines'), 14: L('Asse', 'Aces'), 13: L('Könige', 'Kings'), 12: L('Ober', 'Queens'), 10: L('Banner', 'Tens') } as Record<number, string>)[w.top];
      return L(`Vier ${r}`, `Four ${r}`);
    }
    return w.n <= 5 ? L(['Dreiblatt', 'Vierblatt', 'Fünfblatt'][w.n - 3], `${w.n} in a row`) : L(`${w.n}-Blatt`, `${w.n} in a row`);
  };

  function newMatch() {
    if (isGuest || bet < 1 || bet > wallet.balance) return;
    stake(bet);
    staked = bet;
    match++;
    total = [0, 0];
    winner = -1;
    vorhand = Math.floor(Math.random() * 4);
    // the table is laid out to fit the screen from the top: bring it back into view
    scrollTo({ top: 0, behavior: reduce() ? 'auto' : 'smooth' });
    startRound();
  }

  async function startRound() {
    const g = ++gen;
    const h = J.deal();
    hands = h;
    mode = null; pushed = false; trick = []; collect = -1; played = []; tricks = [];
    tricksWon = [0, 0]; live = [0, 0]; summary = null; chooser = vorhand; turn = -1;
    phase = 'choose';
    for (let i = 0; i < 9; i++) { sfx('card'); await sleep(40); }
    if (!human(vorhand)) await botChoose(g, vorhand, true);
  }

  async function botChoose(g: number, p: number, canPush: boolean) {
    await sleep(900);
    if (g !== gen) return;
    const c = J.chooseMode(hands[p], canPush);
    if (c === 'push') {
      say(p, L('Schiebe!', 'I push!'));
      pushed = true;
      const partner = (p + 2) % 4;
      chooser = partner;
      if (human(partner)) return; // a player chooses
      await sleep(900);
      if (g !== gen) return;
      setMode(J.chooseMode(hands[partner], false) as Mode);
    } else setMode(c);
  }

  function pick(m: Mode | 'push') {
    if (isGuest) return room.send({ t: 'pick', m });
    pickAs(0, m);
  }
  function pickAs(p: number, m: Mode | 'push') {
    if (phase !== 'choose' || chooser !== p) return;
    if (m === 'push') {
      if (pushed) return;
      pushed = true;
      chooser = (p + 2) % 4;
      say(p, L('Schiebe!', 'I push!'));
      if (!human(chooser)) botChoose(gen, chooser, false);
      return;
    }
    if (![0, 1, 2, 3, 'obe', 'unde'].includes(m)) return;
    setMode(m);
  }

  function setMode(m: Mode) {
    mode = m;
    say(chooser, modeName(m), 2600);
    sfx('chip');
    weis = hands.map((h) => J.weisOf(h, m));
    stSeat = J.stoeckSeat(hands, m);
    phase = 'play';
    turn = vorhand;
    run(gen);
  }

  // bots play until it is a player's turn
  async function run(g: number) {
    while (g === gen && phase === 'play' && turn >= 0 && !human(turn)) {
      await sleep(trick.length ? 520 : 750);
      if (g !== gen || phase !== 'play') return;
      await place(g, turn, J.botPlay(hands[turn], trick, mode!, turn, played));
    }
  }

  function tap(c: JCard) {
    if (!canPlay(c)) { if (phase === 'play' && turn === me) sfx('lose'); return; }
    if (isGuest) { turn = -1; return room.send({ t: 'play', c }); }
    playAs(0, c);
  }
  function playAs(p: number, c: JCard) {
    if (phase !== 'play' || turn !== p || mode === null || !J.legal(hands[p], trick, mode).some((x) => J.same(x, c))) return;
    const g = gen;
    turn = -1;
    place(g, p, c).then(() => run(g));
  }

  async function place(g: number, p: number, c: JCard) {
    const m = mode!;
    hands[p] = hands[p].filter((x) => !J.same(x, c));
    trick = [...trick, { p, c }];
    played.push(c);
    sfx('card');
    // first trick: everybody announces their best Weis
    if (!tricks.length && weis[p].length) say(p, weisName(weis[p][0]) + ' · ' + weis[p][0].pts, 2600);
    // Stöck is called when the second of König / Ober of trump is played
    if (p === stSeat && J.isTrump(c, m) && (c.r === 12 || c.r === 13) && played.some((x) => J.isTrump(x, m) && x.r === 25 - c.r)) say(p, 'Stöck · 20');
    if (trick.length < 4) { turn = (p + 1) % 4; return; }
    turn = -1;
    await sleep(950);
    if (g !== gen) return;
    const w = J.trickWinner(trick, m);
    collect = w;
    await sleep(380);
    if (g !== gen) return;
    tricks.push({ winner: w, cards: trick.map((x) => x.c) });
    live[w % 2] += trick.reduce((a, x) => a + J.points(x.c, m), 0);
    tricksWon[w % 2]++;
    trick = []; collect = -1;
    if (tricks.length === 9) return endRound();
    turn = w;
  }

  function endRound() {
    const m = mode!;
    const cards = J.roundPoints(tricks, m);
    const ww = J.weisWinner(weis, m, vorhand);
    const wp = [0, 0];
    if (ww.team >= 0) wp[ww.team] = ww.pts;
    const st = [0, 0];
    if (stSeat >= 0) st[stSeat % 2] = 20;
    const match = tricks.every((t) => t.winner % 2 === 0) ? 0 : tricks.every((t) => t.winner % 2 === 1) ? 1 : -1;
    summary = { cards, weis: wp, stoeck: st, match };
    total = [0, 1].map((t) => total[t] + cards[t] + wp[t] + st[t]);
    if (total[0] >= target || total[1] >= target) {
      winner = total[0] === total[1] ? (cards[0] >= cards[1] ? 0 : 1) : total[0] > total[1] ? 0 : 1;
      phase = 'over';
      const won = winner === 0 ? Math.round(staked * J.PAYOUT * 100) / 100 : 0;
      if (staked) settle(won, won);
      sfx(winner === 0 ? 'big' : 'lose');
    } else {
      phase = 'round';
      sfx(cards[0] + wp[0] + st[0] > cards[1] + wp[1] + st[1] ? 'win' : 'stop');
    }
  }

  function nextRound() {
    if (isGuest) return;
    vorhand = (vorhand + 1) % 4;
    startRound();
  }

  // trick cards fly in from the seat that played them and out to the winner
  const OFF = [[0, 120], [160, 0], [0, -120], [-160, 0]];
  const SLOT = ['translate(-50%, -14%)', 'translate(10%, -50%) rotate(8deg)', 'translate(-50%, -86%)', 'translate(-110%, -50%) rotate(-8deg)'];
  const back: JCard = { s: 0, r: 0 };
</script>

<section class="wrap page">
  <header class="head rise">
    <div>
      <p class="eyebrow">Schieber · {L('2 gegen 2', '2 against 2')}</p>
      <div class="h1row"><h1>Jass</h1><HowTo id="jass" /></div>
    </div>
    <DeckSelect supported={['de', 'fr', 'intl', 'ru']} lang={settings.lang} />
  </header>
  <RoomBar {room} />

  <div class="score rise" style="--i:1">
    <div class="team us" class:lead={total[us] > total[them]}><span class="eyebrow">{L('Wir', 'Us')}<span class="who"> · {names[me]} & {names[(me + 2) % 4]}</span></span><strong class="mono">{total[us]}</strong><span class="mono sub">+{live[us]} · {tricksWon[us]} {L('Stiche', 'tricks')}</span></div>
    <div class="mid">
      {#if mode !== null}<span class="trump">{#if typeof mode === 'number'}<JassCard icon card={{ s: mode, r: 6 }} {deck} />{:else}<img class="mico" src={mode === 'obe' ? obeIcon : undeIcon} alt="" />{/if} {modeName(mode)}</span>{:else}<span class="muted">{L('Kein Trumpf', 'No trump')}</span>{/if}
      <span class="mono muted">{L('Ziel', 'Target')} {target}</span>
    </div>
    <div class="team them" class:lead={total[them] > total[us]}><span class="eyebrow">{L('Gegner', 'Them')}<span class="who"> · {names[(me + 1) % 4]} & {names[(me + 3) % 4]}</span></span><strong class="mono">{total[them]}</strong><span class="mono sub">+{live[them]} · {tricksWon[them]} {L('Stiche', 'tricks')}</span></div>
  </div>

  <div class="felt rise" style="--i:2">
    {#each [1, 2, 3] as v}
      {@const p = view(v)}
      <div class="seat s{v}" class:turn={turn === p}>
        <div class="backs">{#each hands[p] as _, i (i)}<div class="bk"><JassCard card={back} down /></div>{/each}</div>
        <span class="nm">{names[p]}{#if seats[p] || (isGuest && p === 0)}<i class="hu" title={L('Mitspieler', 'Player')}>●</i>{/if}{#if p === vorhand && phase !== 'setup'}<i class="vh" title="Vorhand">V</i>{/if}</span>
        {#if bubbles[p]}<span class="bubble" in:pop>{bubbles[p]}</span>{/if}
      </div>
    {/each}

    <div class="center">
      {#each trick as x (x.p + '-' + x.c.s + '-' + x.c.r)}
        <div class="tc" style:transform={collect >= 0 ? `${SLOT[pos(x.p)]} translate(${OFF[pos(collect)][0] * 1.6}px, ${OFF[pos(collect)][1] * 1.6}px) scale(.6)` : SLOT[pos(x.p)]} class:gone={collect >= 0} in:fly={{ x: OFF[pos(x.p)][0], y: OFF[pos(x.p)][1], duration: 300, opacity: 0.2 }}>
          <JassCard card={x.c} {deck} />
        </div>
      {/each}

      {#if phase === 'choose' && chooser === me}
        <div class="choose" in:pop>
          <p>{pushed ? names[(me + 2) % 4] + L(' hat geschoben: du bestimmst.', ' pushed: you decide.') : L('Du bestimmst den Trumpf.', 'You choose trump.')}</p>
          <div class="modes">
            {#each [0, 1, 2, 3] as s}<button class="btn" onclick={() => pick(s as Mode)}><JassCard icon card={{ s, r: 6 }} {deck} /> {SUIT_NAMES[s]}</button>{/each}
            <button class="btn" onclick={() => pick('obe')}><img class="mico" src={obeIcon} alt="" /> Obenabe</button>
            <button class="btn" onclick={() => pick('unde')}><img class="mico" src={undeIcon} alt="" /> Undenufe</button>
          </div>
          {#if !pushed}<button class="btn primary push" onclick={() => pick('push')}><img class="mico inv" src={pushIcon} alt="" /> {L('Schieben', 'Push')}</button>{/if}
        </div>
      {:else if phase === 'choose'}
        <p class="wait" in:pop>{names[chooser]} {L('überlegt …', 'is thinking …')}</p>
      {:else if (phase === 'round' || phase === 'over') && summary}
        <div class="sum" in:pop>
          {#if phase === 'over'}<h2 class:win={winner === us}>{winner === us ? L('Gewonnen!', 'You win!') : L('Verloren', 'You lose')}</h2>{/if}
          <table>
            <thead><tr><th></th><th>{L('Wir', 'Us')}</th><th>{L('Gegner', 'Them')}</th></tr></thead>
            <tbody>
              <tr><td>{L('Karten', 'Cards')}</td><td class="mono">{summary.cards[us]}</td><td class="mono">{summary.cards[them]}</td></tr>
              {#if summary.weis[0] || summary.weis[1]}<tr><td>Weis</td><td class="mono">{summary.weis[us]}</td><td class="mono">{summary.weis[them]}</td></tr>{/if}
              {#if summary.stoeck[0] || summary.stoeck[1]}<tr><td>Stöck</td><td class="mono">{summary.stoeck[us]}</td><td class="mono">{summary.stoeck[them]}</td></tr>{/if}
              <tr class="tot"><td>{L('Spielstand', 'Score')}</td><td class="mono">{total[us]}</td><td class="mono">{total[them]}</td></tr>
            </tbody>
          </table>
          {#if summary.match >= 0}<p class="match">Match! {summary.match === us ? L('Alle Stiche für uns', 'All tricks for us') : L('Alle Stiche für die Gegner', 'All tricks for them')}</p>{/if}
          {#if phase === 'round'}{#if isGuest}<p class="muted">{L('Der Host teilt gleich neu aus …', 'The host deals the next round …')}</p>{:else}<button class="btn primary" onclick={nextRound}>{L('Nächste Runde', 'Next round')}</button>{/if}
          {:else if staked}<p class="mono pay">{winner === us ? '+' + fmt(Math.round(staked * J.PAYOUT * 100) / 100) : '−' + fmt(staked)}</p>{/if}
        </div>
      {:else if phase === 'setup'}
        <div class="intro" in:pop>
          <p>{L(`Du spielst mit ${names[(me + 2) % 4]} (oben) gegen ${names[(me + 1) % 4]} und ${names[(me + 3) % 4]}. Wer zuerst das Ziel erreicht, gewinnt.`, `You play with ${names[(me + 2) % 4]} (top) against ${names[(me + 1) % 4]} and ${names[(me + 3) % 4]}. First team to the target wins.`)}</p>
          <p class="muted">{L('Mit Freunden: Raum öffnen und den Code teilen. Mitspieler übernehmen die Bot-Plätze, zuerst den deines Partners.', 'With friends: open a room and share the code. Players take over the bot seats, your partner first.')}</p>
          <p class="muted">{L('Sieg zahlt', 'A win pays')} ×{J.PAYOUT}</p>
        </div>
      {/if}
    </div>

    <div class="seat s0" class:turn={turn === me}>
      {#if bubbles[me]}<span class="bubble" in:pop>{bubbles[me]}</span>{/if}
    </div>
    <div class="hand" class:my={turn === me}>
      {#each myHand as c (c.s * 100 + c.r)}
        <button class="hc" class:ok={canPlay(c)} class:no={turn === me && !canPlay(c)} onclick={() => tap(c)} disabled={phase !== 'play'} aria-label="card">
          <JassCard card={c} {deck} />
        </button>
      {/each}
    </div>
  </div>


  <div class="dock panel">
    {#if phase === 'setup' || phase === 'over'}
      <BetInput bind:value={bet} />
      <label class="field">{L('Ziel', 'Target')}
        <select bind:value={target} disabled={isGuest}>{#each [500, 1000, 1500, 2500] as v}<option value={v}>{v}</option>{/each}</select>
      </label>
      {#if isGuest}<p class="status">{L('Dein Einsatz gilt, sobald der Host das Spiel startet.', 'Your stake counts once the host starts the match.')}</p>
      {:else}<button class="btn primary deal" onclick={newMatch} disabled={bet < 1 || bet > wallet.balance}>{phase === 'over' ? L('Neues Spiel', 'New match') : L('Spielen', 'Play')}</button>{/if}
    {:else}
      <p class="status">
        {#if phase === 'choose'}{chooser === me ? L('Wähle Trumpf oder schiebe.', 'Choose trump or push.') : names[chooser] + L(' wählt …', ' is choosing …')}
        {:else if phase === 'round'}{L('Runde fertig.', 'Round over.')}
        {:else if turn === me}{L('Du bist dran. Spielbare Karten sind angehoben.', 'Your turn. Playable cards are raised.')}
        {:else}{L('Warten auf die anderen …', 'Waiting for the others …')}{/if}
      </p>
      <span class="mono muted">{L('Einsatz', 'Stake')} {fmt(staked)}</span>
    {/if}
  </div>
    <p class="credit muted">
      {L('Bildquellen der Kartenblätter:', 'Card image sources:')}
      <a href="https://jassverzeichnis.ch/uebersicht/franzoesische-jasskarten" target="_blank" rel="noopener noreferrer">jassverzeichnis.ch</a>,
      <a href="https://github.com/d-sbrgr/DSPRO2-jassAIr/tree/main" target="_blank" rel="noopener noreferrer">d-sbrgr/DSPRO2-jassAIr</a>,
      <a href="https://github.com/saadelmoutaouakil/Jass-Game/tree/master" target="_blank" rel="noopener noreferrer">saadelmoutaouakil/Jass-Game</a>
    </p>
</section>

<style>
  .page { padding-bottom: 120px; }
  .credit { font-size: 0.78rem; margin: 14px 0 0; }
  .hu { margin-left: 5px; color: #2fbf71; font-style: normal; font-size: 0.7em; vertical-align: 0.15em; }
  /* the mode icons are black line art: light on the dark themes and on the red button */
  .mico { width: 1.3em; height: 1.3em; vertical-align: -0.3em; filter: invert(1); }
  :global([data-theme='ivory']) .mico:not(.inv) { filter: none; }
  .credit a { color: inherit; }
  .head { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 12px; padding: 28px 0 12px; }
  .h1row { display: flex; align-items: center; gap: 12px; }
  h1 { margin: 6px 0 0; font-size: clamp(2.2rem, 5vw, 3.6rem); letter-spacing: -0.04em; line-height: 0.95; }
  .h1row h1 { margin: 0; }
  .seg { display: flex; padding: 3px; gap: 3px; border-radius: 999px; border: 1px solid var(--line-2); }

  .score { display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center; margin-bottom: 12px; }
  .team { display: grid; gap: 2px; padding: 10px 14px; border-radius: 18px; background: var(--surface); border: 1px solid var(--line); }
  .team.them { text-align: right; }
  .team strong { font-size: 1.6rem; letter-spacing: -0.03em; }
  .team.lead strong { color: var(--gold); }
  .sub { font-size: 0.75rem; color: var(--muted); }
  .mid { display: grid; justify-items: center; gap: 4px; text-align: center; }
  .trump { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; background: var(--surface-2); font-weight: 600; }
  .muted { color: var(--muted); font-size: 0.8rem; }

  .felt {
    --cw: clamp(58px, min(7vw, 9.5vh), 96px);
    --hcw: clamp(56px, min(7.4vw, 11vh), 92px); --hh: calc(var(--hcw) * 1.53 + 26px);
    position: relative; height: clamp(440px, calc(100dvh - var(--nav-h, 64px) - 250px), 680px); border-radius: 40px; color: #fff; overflow: hidden;
    background: radial-gradient(ellipse at 50% 40%, #1d6b48, #0c3a26 75%);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.06), inset 0 0 0 10px rgba(0,0,0,.16), 0 30px 60px -30px rgba(0,0,0,.6);
  }
  .seat { position: absolute; display: grid; justify-items: center; gap: 6px; z-index: 2; }
  .seat.s1 { right: 14px; top: 50%; translate: 0 -50%; }
  .seat.s2 { left: 50%; top: 12px; translate: -50% 0; }
  .seat.s3 { left: 14px; top: 50%; translate: 0 -50%; }
  .seat.s0 { left: 50%; bottom: calc(var(--hh) + 4px); translate: -50% 0; }
  .backs { display: flex; --cw: 34px; }
  .bk + .bk { margin-left: -24px; }
  .nm { display: flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; background: rgba(0,0,0,.35); font-size: 0.8rem; font-weight: 600; transition: box-shadow .3s; }
  .seat.turn .nm { box-shadow: 0 0 0 2px var(--gold); }
  .vh { font-style: normal; font-size: 0.65rem; width: 16px; height: 16px; display: grid; place-items: center; border-radius: 50%; background: var(--gold); color: #1a1405; }
  .bubble { position: absolute; top: 100%; margin-top: 6px; white-space: nowrap; padding: 6px 12px; border-radius: 12px; background: #fff7e0; color: #1a1405; font-weight: 700; font-size: 0.82rem; box-shadow: 0 8px 20px -8px rgba(0,0,0,.6); }
  .seat.s0 .bubble { top: auto; bottom: 0; }
  .seat.s1 .bubble { right: 0; }
  .seat.s3 .bubble { left: 0; }

  .center { position: absolute; inset: 0 0 calc(var(--hh) - 30px); display: grid; place-items: center; }
  .tc { position: absolute; left: 50%; top: 50%; transition: transform .38s cubic-bezier(.5, 0, .7, .4), opacity .38s; }
  .tc.gone { opacity: 0; }
  .choose, .sum, .intro { position: relative; z-index: 3; display: grid; justify-items: center; gap: 10px; padding: 16px 18px; border-radius: 22px; background: rgba(6, 24, 16, .82); backdrop-filter: blur(6px); max-width: min(92%, 460px); text-align: center; }
  .choose p, .intro p { margin: 0; }
  .modes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; width: 100%; }
  .modes .btn { gap: 6px; min-height: 44px; font-size: 0.85rem; padding: 0 8px; }
  .push { min-width: 160px; }
  .wait { padding: 10px 16px; border-radius: 999px; background: rgba(0,0,0,.4); }
  .sum h2 { margin: 0; font-size: 1.6rem; color: #ff9a9d; }
  .sum h2.win { color: #8ff0bf; }
  table { border-collapse: collapse; min-width: 240px; }
  td, th { padding: 4px 10px; text-align: right; font-size: 0.9rem; }
  td:first-child, th:first-child { text-align: left; color: rgba(255,255,255,.7); }
  th { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,.6); }
  .tot td { border-top: 1px solid rgba(255,255,255,.25); font-weight: 700; }
  .match { margin: 0; color: var(--gold); font-weight: 700; }
  .pay { margin: 0; font-size: 1.2rem; }

  .hand { position: absolute; left: 0; right: 0; bottom: 6px; display: flex; justify-content: center; align-items: end; padding: 0 8px; z-index: 5; --cw: var(--hcw); height: var(--hh); }
  .hc { padding: 0; border: 0; background: none; transition: transform .25s var(--ease-snap), filter .25s; margin-left: calc(var(--cw) * -0.18); }
  .hc:first-child { margin-left: 0; }
  .hc:disabled { cursor: default; }
  .hand.my .hc.ok { transform: translateY(-14px); cursor: pointer; }
  .hand.my .hc.ok:hover { transform: translateY(-22px); }
  .hc.no { filter: brightness(.55); }

  .dock {
    margin-top: 14px; padding: 12px 16px; display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 12px 20px; min-height: 76px;
    background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: blur(14px); border-radius: 24px; box-shadow: 0 20px 50px -20px rgba(0,0,0,.5);
  }
  .dock .field { display: grid; gap: 8px; }
  .deal { min-width: 160px; min-height: 52px; font-size: 1rem; }
  .status { margin: 0; align-self: center; }
  .dock > .muted { align-self: center; }

  @media (max-width: 640px) {
    .felt { height: clamp(400px, calc(100dvh - var(--nav-h) - 204px), 600px); border-radius: 28px; --cw: 50px; --hcw: min(54px, calc((100vw - 36px) / 6.6)); }
    .head { padding: 12px 0 8px; align-items: center; }
    .head .eyebrow { display: none; }
    h1 { font-size: 2rem; }
    .score { gap: 6px; margin-bottom: 8px; }
    .who, .mid .mono { display: none; }
    .team { padding: 6px 10px; border-radius: 14px; }
    .team strong { font-size: 1.15rem; }
    .team .eyebrow { font-size: 0.6rem; }
    .sub { font-size: 0.65rem; }
    .trump { padding: 5px 10px; font-size: 0.85rem; }
    .backs { --cw: 26px; }
    .bk + .bk { margin-left: -20px; }
    .seat.s1, .seat.s3 { top: 40%; }
    .seat.s1 .backs, .seat.s3 .backs { display: none; }
    .hc { margin-left: calc(var(--cw) * -0.3); }
    .modes { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .deal { flex: 1; }
    .dock .field { flex: 1; }
  }
</style>
