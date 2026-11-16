<script lang="ts">
  import { onDestroy, onMount, untrack } from 'svelte';
  import { fly, scale } from 'svelte/transition';
  import BetInput from '../components/BetInput.svelte';
  import RoomBar from '../components/RoomBar.svelte';
  import HowTo from '../components/HowTo.svelte';
  import { field, simulate, oddsAsync, payout, timeline, at, DIST, N, type Horse, type Odds, type BetKind } from '../games/horses';
  import { drawHorse, drawBackdrop, drawForeground, drawClods, layout, SILKS } from '../games/horsesDraw';
  import { Room } from '../lib/net.svelte';
  import { settings, wallet, settle, stake, credit, fmt } from '../lib/state.svelte';
  import { dailyGame } from '../lib/daily';
  import { sfx } from '../lib/sfx';
  import { t } from '../lib/i18n';

  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
  type Bet = { kind: BetKind; sel: number[]; amt: number };
  type P = { id: string; name: string; bot?: boolean; bets: Bet[] };
  const BET_MS = 20000, RESULT_MS = 7000;

  // ---------- shared state (host authoritative, guests follow) ----------
  const share = $state({
    phase: 'wait' as 'wait' | 'bet' | 'race' | 'result', round: 0, seed: 1, horses: [] as Horse[], odds: null as Odds | null,
    players: [] as P[], history: [] as { n: number; name: string; silks: number }[], left: 0, elapsed: 0,
  });
  let betEnd = 0, raceStart = 0, timer: ReturnType<typeof setTimeout> | undefined;
  const room = new Room('derby', onMsg, (id) => { share.players = share.players.filter((p) => p.id !== id); push(); });
  const isGuest = $derived(room.role === 'guest');
  // a new guest gets the table right away, not only with the next bet or phase
  $effect(() => { if (room.guests) untrack(push); });

  function push() {
    if (room.role !== 'host') return;
    untrack(() => {
      const now = performance.now();
      room.broadcast({ t: 'state', s: { ...$state.snapshot(share), left: Math.max(0, betEnd - now), elapsed: now - raceStart } });
    });
  }
  function onMsg(m: any, from: string) {
    if (m.t === 'state') {
      if (room.role !== 'guest') return;
      const was = share.phase;
      Object.assign(share, m.s);
      const now = performance.now();
      betEnd = now + m.s.left;
      if (m.s.phase === 'race') raceStart = now - m.s.elapsed;
      if (was !== share.phase) phaseFx();
      return;
    }
    if (room.role === 'guest') return;
    if (share.phase !== 'bet' || !share.odds) return;
    let p = share.players.find((x) => x.id === from);
    if (m.t === 'bet') {
      const kind = (['win', 'place', 'exacta'] as const).find((k) => k === m.kind), amt = Math.floor(+m.amt * 100) / 100;
      const sel = (Array.isArray(m.sel) ? m.sel : []).map(Number).slice(0, kind === 'exacta' ? 2 : 1);
      if (!kind || !(amt > 0) || sel.some((i: number) => !(i >= 0 && i < N)) || sel.length !== (kind === 'exacta' ? 2 : 1) || (kind === 'exacta' && sel[0] === sel[1])) return;
      if (!p) share.players.push((p = { id: from, name: String(m.name ?? '').slice(0, 24), bets: [] }));
      if (p.bets.length >= 8) return;
      p.bets.push({ kind, sel, amt });
    } else if (m.t === 'unbet' && p) {
      p.bets.splice(+m.i, 1);
    } else if (m.t === 'go' && from === room.myId) {
      return startRace();
    } else return;
    push();
  }

  // ---------- rounds (host / solo) ----------
  const BOTS = ['Mila', 'Jonas', 'Lea', 'Finn', 'Ava', 'Noah'];
  async function newRound() {
    clearTimeout(timer);
    share.round++;
    share.seed = Math.floor(Math.random() * 2 ** 31);
    share.horses = field(share.seed);
    share.odds = null;
    share.players = [];
    share.phase = 'bet';
    betEnd = performance.now() + BET_MS;
    push();
    phaseFx();
    const round = share.round;
    const o = await oddsAsync($state.snapshot(share.horses) as Horse[]);
    if (round !== share.round || isGuest) return;
    share.odds = o;
    // bots like favourites, but not only
    if (settings.bots) share.players = BOTS.filter(() => Math.random() < 0.6).map((name, i) => {
      const pick = () => { const w = o.win.map((x) => 1 / x); let r = Math.random() * w.reduce((a, b) => a + b, 0); return w.findIndex((x) => (r -= x) < 0); };
      const kind: BetKind = Math.random() < 0.6 ? 'win' : Math.random() < 0.7 ? 'place' : 'exacta';
      const a = pick(); let b = pick(); if (b === a) b = (a + 1) % N;
      return { id: 'bot' + i, name, bot: true, bets: [{ kind, sel: kind === 'exacta' ? [a, b] : [a], amt: [10, 20, 50, 100, 250][Math.floor(Math.random() * 5)] }] };
    });
    push();
    timer = setTimeout(startRace, Math.max(0, betEnd - performance.now()));
  }
  function startRace() {
    if (share.phase !== 'bet' || !share.odds) return;
    clearTimeout(timer);
    share.phase = 'race';
    raceStart = performance.now();
    push();
    phaseFx();
    timer = setTimeout(endRace, tl.wall * 1000 + 1200);
  }
  function endRace() {
    share.phase = 'result';
    const w = race.order[0], h = share.horses[w];
    share.history = [{ n: h.n, name: h.name, silks: h.silks }, ...share.history].slice(0, 12);
    push();
    phaseFx();
    timer = setTimeout(newRound, RESULT_MS);
  }
  let wasGuest = false;
  $effect(() => {
    const guest = room.role === 'guest';
    untrack(() => {
      // switching tables: bets still open on the old one come back
      if (guest) { wasGuest = true; clearTimeout(timer); timer = undefined; refundOpen(); return; }
      if (wasGuest || share.phase === 'wait') { wasGuest = false; refundOpen(); newRound(); }
    });
  });
  onDestroy(() => { clearTimeout(timer); room.leave(); refundOpen(); });

  // the race itself: every client simulates it from the shared seed
  const race = $derived(simulate($state.snapshot(share.horses) as Horse[], share.seed));
  const tl = $derived(timeline(race));

  // ---------- my bets ----------
  let amt = $state(20);
  let kind = $state<BetKind>('win');
  let first = $state<number | null>(null);
  const me = $derived(share.players.find((p) => p.id === room.myId));
  const myBets = $derived(me?.bets ?? []);
  const myStake = $derived(myBets.reduce((a, b) => a + b.amt, 0));
  // stakes leave the wallet when placed; this remembers what is still on the table for this round
  let open = { round: 0, amt: 0 };
  function place(sel: number[]) {
    if (share.phase !== 'bet' || !share.odds || amt <= 0 || amt > wallet.balance || myBets.length >= 8) return;
    stake(amt);
    if (open.round !== share.round) open = { round: share.round, amt: 0 };
    open.amt += amt;
    room.send({ t: 'bet', kind, sel, amt, name: settings.name });
    sfx('chip');
    first = null;
  }
  function unbet(i: number) {
    const b = myBets[i];
    if (share.phase !== 'bet' || !b) return;
    credit(b.amt);
    open.amt -= b.amt;
    room.send({ t: 'unbet', i });
  }
  function refundOpen() { if (open.amt > 0 && open.round === share.round && share.phase === 'bet') credit(open.amt); open = { round: 0, amt: 0 }; }
  function pick(i: number) {
    if (kind !== 'exacta') return place([i]);
    if (first === null || first === i) first = first === i ? null : i;
    else place([first, i]);
  }
  // book my result once per round
  let booked = 0;
  let myWin = $state(0);
  $effect(() => {
    if (share.phase !== 'result' || share.round === booked) return;
    booked = share.round;
    untrack(() => {
      open = { round: 0, amt: 0 };
      if (!myBets.length || !share.odds) return;
      const o = share.odds;
      myWin = Math.round(myBets.reduce((a, b) => a + b.amt * payout(b.kind, b.sel, race.order, o), 0) * 100) / 100;
      settle(myWin, myWin);
      if (myWin > 0) sfx('win');
    });
  });
  const winOf = (p: P) => (share.odds ? Math.round(p.bets.reduce((a, b) => a + b.amt * payout(b.kind, b.sel, race.order, share.odds!), 0) * 100) / 100 : 0);
  const betLabel = (b: Bet) => (b.kind === 'win' ? L('Sieg', 'Win') : b.kind === 'place' ? L('Platz', 'Place') : L('Zweier', 'Exacta')) + ' ' + b.sel.map((i) => share.horses[i]?.n).join('-');
  const oddsOf = (b: Bet) => (!share.odds ? 0 : b.kind === 'win' ? share.odds.win[b.sel[0]] : b.kind === 'place' ? share.odds.place[b.sel[0]] : share.odds.exacta[b.sel[0]][b.sel[1]]);

  // ---------- sound per phase ----------
  function phaseFx() {
    if (share.phase === 'race') { sfx('flip'); wrap?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    if (share.phase === 'result') sfx('big');
    if (share.phase === 'bet') myWin = 0;
  }

  // ---------- drawing ----------
  let wrap: HTMLDivElement, canvas: HTMLCanvasElement;
  let W = $state(900), H = $state(430);
  let leftS = $state(0), meters = $state(0), slow = $state(false), live = $state<number[]>([]);
  let raf = 0, cam = -12;
  const STYLE = { front: L('Frontläufer', 'Front-runner'), even: L('Gleichmässig', 'Stalker'), closer: L('Steher', 'Closer') };
  onMount(() => {
    const fit = () => { W = wrap.clientWidth; H = Math.round(Math.max(300, Math.min(W * (W < 700 ? 0.8 : 0.46), innerHeight * 0.62))); };
    const ro = new ResizeObserver(fit); ro.observe(wrap); fit();
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      draw(now, dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  });
  function draw(now: number, dt: number) {
    const ctx = canvas?.getContext('2d');
    if (!ctx || !share.horses.length) return;
    const dpr = devicePixelRatio || 1;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const Lay = layout(W, H);
    // where is everybody?
    let rt = 0, pos: number[], prev: number[];
    if (share.phase === 'race' || share.phase === 'result') {
      const wall = share.phase === 'result' ? tl.wall + 5 : (now - raceStart) / 1000;
      rt = tl.race(wall);
      pos = at(race, rt); prev = at(race, Math.max(0, rt - 0.1));
      slow = share.phase === 'race' && tl.race(wall + 0.05) - rt < 0.03 && wall < tl.wall;
    } else { pos = share.horses.map(() => 0); prev = pos; slow = false; }
    const lead = Math.max(...pos);
    // before the start the gate sits in the middle; then the camera runs with the leaders
    const view = Lay.view;
    const target = share.phase === 'bet' || share.phase === 'wait' ? -view * 0.5 + 1 : Math.min(DIST + 9 - view, lead - view * 0.62);
    cam += (target - cam) * Math.min(1, dt * (share.phase === 'race' ? 3 : 1.5));
    drawBackdrop(ctx, Lay, cam, now / 1000, share.phase === 'race');
    // back lanes first; the horse's position is its nose, the drawing origin is the girth
    share.horses.forEach((h, i) => {
      const { y, s } = Lay.lane(i);
      const v = (pos[i] - prev[i]) / 0.1, run = Math.min(1, v / 9);
      const stride = pos[i] / 6.4 + i * 0.37 + (run < 0.1 ? 0 : 0);
      const x = (pos[i] - 1.85 - cam) * Lay.ppm;
      if (x < -3 * Lay.ppm || x > W + 3 * Lay.ppm) return;
      drawClods(ctx, x, y, s, stride, run);
      drawHorse(ctx, h, x, y, s, stride, run);
    });
    drawForeground(ctx, Lay, cam);
    leftS = Math.ceil(Math.max(0, betEnd - now) / 1000);
    meters = Math.max(0, Math.round(DIST - lead));
    live = share.horses.map((_, i) => i).sort((a, b) => pos[b] - pos[a]);
  }
  const photo = $derived(share.phase === 'result' && race.finish[race.order[1]] - race.finish[race.order[0]] < 0.08);
  const isDaily = dailyGame() === 'derby';
</script>

<section class="wrap page">
  <header class="head">
    <div>
      <p class="eyebrow">Classic · {L('Galopprennen über', 'Flat race over')} {DIST} m{#if isDaily}<span class="daily">{t('daily.badge')}</span>{/if}</p>
      <h1>{L('Pferderennen', 'Horse Racing')}</h1>
    </div>
    <HowTo id="derby" />
  </header>
  <RoomBar {room} />

  <div class="screen" bind:this={wrap} style:height="{H}px">
    <canvas bind:this={canvas} style:width="{W}px" style:height="{H}px"></canvas>
    <div class="hud">
      <span class="pill mono">
        {#if share.phase === 'bet'}{share.odds ? L('Wetten offen · ', 'Betting · ') + leftS + ' s' : L('Quoten werden berechnet …', 'Working out the odds …')}
        {:else if share.phase === 'race'}{meters > 0 ? meters + ' m' : L('Im Ziel', 'Finished')}{#if slow} · {L('Zeitlupe', 'Slow motion')}{/if}
        {:else}{L('Ergebnis', 'Result')}{/if}
      </span>
      {#if share.phase === 'race'}
        <div class="order">{#each live as i, k (i)}<span class="silk" style="--a:{SILKS[share.horses[i].silks][0]}; --b:{SILKS[share.horses[i].silks][1]}" title={share.horses[i].name}>{share.horses[i].n}</span>{#if k === 0}<em></em>{/if}{/each}</div>
      {/if}
    </div>
    {#if share.phase === 'result'}
      <div class="podium" in:scale={{ start: 0.9, duration: 400 }}>
        {#if photo}<p class="photo">{L('Fotofinish!', 'Photo finish!')}</p>{/if}
        {#each race.order.slice(0, 3) as i, k}
          {@const h = share.horses[i]}
          <div class="place p{k}" in:fly={{ y: 16, delay: 150 * k }}>
            <b class="mono">{k + 1}.</b>
            <span class="silk" style="--a:{SILKS[h.silks][0]}; --b:{SILKS[h.silks][1]}">{h.n}</span>
            <span class="nm">{h.name}</span>
            {#if share.odds}<span class="mono od">{k === 0 ? '×' + share.odds.win[i].toFixed(2) : ''}</span>{/if}
          </div>
        {/each}
        {#if myBets.length}<p class="mine mono" class:pos={myWin > 0}>{myWin > 0 ? '+' + fmt(myWin) : L('Kein Treffer', 'No luck') + ' · −' + fmt(myStake)}</p>{/if}
      </div>
    {/if}
    {#if share.phase === 'bet' && !isGuest && share.odds}
      <button class="btn go" onclick={() => room.send({ t: 'go' })}>{L('Start jetzt', 'Start now')} ▶</button>
    {/if}
  </div>

  <div class="below">
    <div class="card panel">
      <div class="cardhead">
        <div class="seg">
          {#each [['win', L('Sieg', 'Win')], ['place', L('Platz', 'Place')], ['exacta', L('Zweierwette', 'Exacta')]] as [k, l]}
            <button class:on={kind === k} onclick={() => { kind = k as BetKind; first = null; }}>{l}</button>
          {/each}
        </div>
        <span class="small muted">{kind === 'win' ? L('Dein Pferd gewinnt.', 'Your horse wins.') : kind === 'place' ? L('Dein Pferd wird Erster oder Zweiter.', 'Your horse finishes first or second.') : first === null ? L('Wähle den Sieger …', 'Pick the winner …') : L('… und jetzt den Zweiten.', '… now the runner-up.')}</span>
      </div>
      <table>
        <thead><tr><th></th><th>{L('Pferd', 'Horse')}</th><th class="hide">{L('Stil', 'Style')}</th><th class="hide">{L('Form', 'Form')}</th><th>{kind === 'exacta' && first !== null ? L('Quote', 'Odds') : kind === 'place' ? L('Platz', 'Place') : L('Sieg', 'Win')}</th></tr></thead>
        <tbody>
          {#each share.horses as h, i}
            {@const o = !share.odds ? null : kind === 'exacta' ? (first === null || first === i ? null : share.odds.exacta[first][i]) : kind === 'place' ? share.odds.place[i] : share.odds.win[i]}
            <tr class:sel={first === i} class:won={share.phase === 'result' && race.order[0] === i}>
              <td><span class="silk" style="--a:{SILKS[h.silks][0]}; --b:{SILKS[h.silks][1]}">{h.n}</span></td>
              <td class="nm">{h.name}</td>
              <td class="hide muted small">{STYLE[h.style]}</td>
              <td class="hide"><span class="form">{#each [0, 1, 2, 3, 4] as k}<i class:on={k < Math.round((h.strength + 1.1) / 2.2 * 4) + 1}></i>{/each}</span></td>
              <td>
                <button class="odd mono" disabled={share.phase !== 'bet' || !share.odds || (kind !== 'exacta' && !o) || amt > wallet.balance} onclick={() => pick(i)}>
                  {kind === 'exacta' && first === null ? L('1.', '1st') : kind === 'exacta' && first === i ? '✓' : o ? '×' + o.toFixed(2) : '…'}
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      <BetInput bind:value={amt} disabled={share.phase !== 'bet'} />
    </div>

    <div class="side">
      <div class="panel box">
        <p class="eyebrow">{L('Deine Wetten', 'Your bets')}</p>
        {#if myBets.length}
          {#each myBets as b, i}
            <div class="bet" in:fly={{ x: 12, duration: 200 }}>
              <span>{betLabel(b)}</span><span class="mono muted">{fmt(b.amt)} × {oddsOf(b).toFixed(2)}</span>
              {#if share.phase === 'bet'}<button class="x" onclick={() => unbet(i)} aria-label="remove">×</button>
              {:else if share.phase === 'result'}<span class="mono" class:pos={payout(b.kind, b.sel, race.order, share.odds!) > 0}>{payout(b.kind, b.sel, race.order, share.odds!) > 0 ? '+' + fmt(Math.round(b.amt * oddsOf(b) * 100) / 100) : '–'}</span>{/if}
            </div>
          {/each}
          <p class="small muted">{L('Einsatz', 'Stake')} <span class="mono">{fmt(myStake)}</span></p>
        {:else}<p class="small muted">{L('Tippe auf eine Quote, um zu wetten. Mehrere Wetten pro Rennen sind erlaubt.', 'Tap a price to bet. Several bets per race are fine.')}</p>{/if}
      </div>
      <div class="panel box">
        <p class="eyebrow">{L('Am Tisch', 'At the rail')}</p>
        {#each share.players.filter((p) => p.bets.length) as p (p.id)}
          <div class="pl">
            <span>{p.name}{p.bot ? ' · Bot' : ''}</span>
            <span class="mono muted small">{p.bets.map(betLabel).join(', ')}</span>
            {#if share.phase === 'result'}<span class="mono" class:pos={winOf(p) > 0}>{winOf(p) > 0 ? '+' + fmt(winOf(p)) : '–'}</span>{/if}
          </div>
        {:else}<p class="small muted">{L('Noch keine Wetten.', 'No bets yet.')}</p>{/each}
      </div>
      {#if share.history.length}
        <div class="panel box">
          <p class="eyebrow">{L('Letzte Sieger', 'Last winners')}</p>
          <div class="hist">{#each share.history as h}<span class="silk" style="--a:{SILKS[h.silks][0]}; --b:{SILKS[h.silks][1]}" title={h.name}>{h.n}</span>{/each}</div>
        </div>
      {/if}
    </div>
  </div>
</section>

<style>
  .page { padding-bottom: 80px; }
  .head { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 12px; padding: 28px 0 8px; }
  h1 { margin: 6px 0 0; font-size: clamp(2.2rem, 5vw, 3.6rem); letter-spacing: -0.04em; line-height: 0.95; }
  .daily { margin-left: 10px; padding: 3px 8px; border-radius: 999px; background: var(--gold); color: #1d1505; }
  .screen { position: relative; border-radius: 26px; overflow: hidden; box-shadow: 0 30px 60px -30px rgba(0,0,0,.7); background: #2e4f86; }
  canvas { display: block; }
  .hud { position: absolute; inset: 12px 12px auto; display: flex; justify-content: space-between; align-items: start; gap: 10px; pointer-events: none; }
  .pill { padding: 7px 12px; border-radius: 999px; background: rgba(12,16,30,.62); color: #fff; font-size: 0.82rem; backdrop-filter: blur(6px); }
  .order { display: flex; gap: 4px; padding: 5px; border-radius: 999px; background: rgba(12,16,30,.55); backdrop-filter: blur(6px); }
  .order em { width: 1px; background: rgba(255,255,255,.3); margin: 2px 2px; }
  .silk {
    display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; font: 700 0.8rem/1 'Geist Mono Variable', monospace;
    background: linear-gradient(135deg, var(--a) 0 55%, var(--b) 55%); color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,.6); box-shadow: inset 0 0 0 1px rgba(0,0,0,.15);
  }
  .order .silk { transition: transform 0.3s; }
  .go { position: absolute; right: 14px; bottom: 14px; background: rgba(255,255,255,.92); color: #1c1c22; border: 0; font-weight: 600; }
  .podium { position: absolute; left: 50%; top: 50%; translate: -50% -50%; display: grid; gap: 8px; padding: 18px 22px; min-width: min(360px, 86%); border-radius: 22px; background: rgba(12,16,30,.72); backdrop-filter: blur(10px); color: #fff; }
  .photo { margin: 0 0 4px; font: 800 1.05rem/1 'Geist Variable', sans-serif; color: #f2c33a; letter-spacing: 0.04em; text-transform: uppercase; }
  .place { display: flex; align-items: center; gap: 10px; }
  .place b { width: 24px; color: rgba(255,255,255,.7); }
  .place.p0 .nm { font-weight: 700; font-size: 1.15rem; }
  .place .od { margin-left: auto; color: #8ff0bf; }
  .mine { margin: 6px 0 0; color: #ffb3b5; }
  .mine.pos, .pos { color: #2fbf71; }
  .below { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; margin-top: 16px; align-items: start; }
  .card { padding: 16px; display: grid; gap: 12px; }
  .cardhead { display: grid; gap: 8px; }
  .seg { display: flex; border: 1px solid var(--line-2); border-radius: 999px; padding: 3px; gap: 3px; }
  .seg button { flex: 1; border: 0; background: none; min-height: 36px; border-radius: 999px; color: var(--muted); }
  .seg button.on { background: var(--text); color: var(--bg); }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 0.72rem; color: var(--muted); font-weight: 500; padding: 4px 6px; }
  td { padding: 6px; border-top: 1px solid var(--line); }
  td.nm { font-weight: 600; }
  tr.sel td { background: color-mix(in srgb, var(--accent) 12%, transparent); }
  tr.won td { background: color-mix(in srgb, #2fbf71 16%, transparent); }
  .form { display: inline-flex; gap: 3px; }
  .form i { width: 6px; height: 14px; border-radius: 2px; background: var(--line-2); }
  .form i.on { background: var(--gold); }
  .odd { min-width: 78px; min-height: 36px; border-radius: 10px; border: 1px solid var(--line-2); background: var(--bg-2); font-weight: 600; transition: transform 0.2s var(--ease-snap), background 0.2s; }
  .odd:hover:not(:disabled) { background: var(--surface-2); transform: translateY(-1px); }
  .odd:disabled { opacity: 0.5; }
  .side { display: grid; gap: 12px; }
  .box { padding: 14px 16px; display: grid; gap: 8px; }
  .eyebrow { margin: 0; }
  .bet, .pl { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: center; font-size: 0.88rem; }
  .pl { grid-template-columns: auto 1fr auto; }
  .x { width: 26px; height: 26px; border-radius: 50%; border: 1px solid var(--line-2); background: none; }
  .hist { display: flex; flex-wrap: wrap; gap: 6px; }
  .small { font-size: 0.8rem; margin: 0; }
  .muted { color: var(--muted); }
  @media (max-width: 860px) {
    .below { grid-template-columns: 1fr; }
    .hide { display: none; }
    .order .silk { width: 20px; height: 20px; font-size: 0.66rem; border-radius: 6px; }
  }
</style>
