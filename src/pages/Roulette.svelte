<script lang="ts">
  import { onDestroy, onMount, untrack } from 'svelte';
  import { fly } from 'svelte/transition';
  import Wheel from '../components/Wheel.svelte';
  import HowTo from '../components/HowTo.svelte';
  import Racetrack from '../components/Racetrack.svelte';
  import ChipTray from '../components/ChipTray.svelte';
  import RoomBar from '../components/RoomBar.svelte';
  import { WHEEL, OUTSIDE, color, spotAt, betOf, payout, numAt, type Bet } from '../games/roulette';
  import { Room } from '../lib/net.svelte';
  import { settings, wallet, settle, fmt } from '../lib/state.svelte';
  import { chipOf, short } from '../lib/chips';
  import { sfx, rolling } from '../lib/sfx';
  import { drop, pop } from '../lib/motion';
  import { t } from '../lib/i18n';

  type Player = { id: string; name: string; bot?: boolean; stake: number; net: number | null; bets?: { nums: number[]; amt: number }[] };
  const BET_MS = 15000, RESULT_MS = 3400;

  // ---------- local betting state ----------
  let chip = $state(25);
  let bets = $state<Bet[]>([]);
  let undoStack: Bet[][] = [];
  let lastBets = $state<Bet[]>([]);
  let hover = $state<number[]>([]);
  let partage = $state(false);
  const stake = $derived(bets.reduce((s, b) => s + b.amt, 0));

  // ---------- shared table state (host authoritative) ----------
  // auto: rounds run on their own; every round opens a betting window of BET_MS (like Rocket), players join or sit out
  const share = $state({ phase: 'bet' as 'bet' | 'spin' | 'result', result: -1, round: 0, history: [] as number[], players: [] as Player[], partage: false, auto: true, left: 0 });
  let lastWin = $state<number | null>(null);
  let myNet = $state<number | null>(null);
  let guests = $state<Player[]>([]); // host only
  let bots = $state<Player[]>([]); // host only
  let betEnd = $state(0); // local deadline (performance.now) of the open betting window, 0 = none
  let clock = $state(performance.now());
  let timer: ReturnType<typeof setTimeout> | undefined;
  const left = $derived(share.phase === 'bet' && betEnd ? Math.max(0, betEnd - clock) : 0);

  const room = new Room('roulette', onMsg, (id) => {
    guests = guests.filter((p) => p.id !== id);
    push();
  });
  const isHost = $derived(room.role !== 'guest');
  // after leaving someone else's room, start our own table fresh
  let wasGuest = false;
  $effect(() => {
    if (room.role === 'guest') { wasGuest = true; clearTimeout(timer); }
    else if (wasGuest) untrack(() => { wasGuest = false; share.players = []; openBetting(); });
  });
  const me = $derived<Player>({ id: room.myId, name: settings.name, stake, net: myNet });
  const players = $derived(isHost ? [me, ...guests, ...bots] : share.players);

  function onMsg(m: any, from: string) {
    if (m.t === 'state') {
      const spinNow = m.s.phase === 'spin' && m.s.round !== share.round;
      Object.assign(share, m.s);
      partage = share.partage;
      betEnd = share.phase === 'bet' && share.auto && share.left ? performance.now() + share.left : 0;
      if (spinNow) run(share.result);
    } else if (room.role === 'host' && m.t === 'hello') {
      let p = guests.find((x) => x.id === from);
      if (!p) guests.push((p = { id: from, name: 'Guest', stake: 0, net: null }));
      p.name = String(m.name).slice(0, 24);
      if (share.phase === 'bet') {
        p.bets = m.bets;
        p.stake = m.bets.reduce((s: number, b: any) => s + b.amt, 0);
      }
      push();
    }
  }
  function push() {
    if (room.role !== 'host') return;
    untrack(() => {
      share.left = betEnd ? Math.max(0, betEnd - performance.now()) : 0;
      room.broadcast({ t: 'state', s: { ...$state.snapshot(share), players: $state.snapshot(players).map(({ bets, ...p }) => p) } });
    });
  }

  // guest: tell the host who we are and what we bet
  $effect(() => {
    if (room.role === 'guest' && room.status === 'open') room.send({ t: 'hello', name: settings.name, bets: $state.snapshot(bets).map(({ nums, amt }) => ({ nums, amt })) });
  });
  // host: keep guests up to date with our own row and table options
  $effect(() => {
    share.partage = partage;
    void [stake, settings.name, bots.length];
    push();
  });

  const BOT_NAMES = ['Mila', 'Jonas', 'Lea'];
  $effect(() => {
    bots = settings.bots ? BOT_NAMES.map((name, i) => ({ id: 'bot' + i, name, bot: true, stake: 0, net: null })) : [];
  });

  function botBets() {
    const picks = ['red', 'black', 'even', 'odd', 'low', 'high', 'd1', 'd2', 'd3', 'c1', 'c2', 'c3'];
    const amts = [5, 10, 25, 50, 100];
    return Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => {
      const amt = amts[Math.floor(Math.random() * amts.length)];
      return Math.random() < 0.6 ? { nums: OUTSIDE[picks[Math.floor(Math.random() * picks.length)]], amt } : { nums: [Math.floor(Math.random() * 37)], amt: Math.ceil(amt / 5) };
    });
  }

  // ---------- betting ----------
  const can = (extra: number) => share.phase === 'bet' && stake + extra <= wallet.balance;
  function snapshot() { undoStack.push($state.snapshot(bets)); if (undoStack.length > 100) undoStack.shift(); }
  function add(b: Bet | null, amt = chip) {
    if (!b) return;
    if (!can(amt)) return flash();
    snapshot();
    const ex = bets.find((x) => x.key === b.key);
    if (ex) ex.amt += amt; else bets.push({ ...b, amt });
    sfx('chip');
  }
  function addGroups(groups: number[][]) {
    if (!can(groups.length * chip)) return flash();
    snapshot();
    for (const g of groups) {
      const b = betOf(g);
      const ex = bets.find((x) => x.key === b.key);
      if (ex) ex.amt += chip; else bets.push({ ...b, amt: chip });
    }
    sfx('chip');
  }
  function remove(key: string) {
    if (share.phase !== 'bet') return;
    snapshot();
    bets = bets.filter((b) => b.key !== key);
  }
  const undo = () => { if (share.phase === 'bet' && undoStack.length) bets = undoStack.pop()!; };
  const clear = () => { if (share.phase === 'bet' && bets.length) { snapshot(); bets = []; } };
  function rebet() {
    const s = lastBets.reduce((a, b) => a + b.amt, 0);
    if (!lastBets.length || !can(s - stake) || share.phase !== 'bet') return;
    snapshot();
    bets = structuredClone(lastBets);
    sfx('chip');
  }
  function double() {
    if (!bets.length || !can(stake)) return flash();
    snapshot();
    for (const b of bets) b.amt *= 2;
    sfx('chip');
  }
  let warn = $state(false);
  function flash() { warn = true; setTimeout(() => (warn = false), 1200); }

  // ---------- table geometry ----------
  // Logical coordinates (horizontal reference): numbers x∈[-1,12] (zero at x<0), y∈[0,3];
  // column bets x∈[12,13]; dozens y∈[3,3.7]; even-money y∈[3.7,4.4]. Vertical layout rotates this.
  const W = 14, H = 4.4;
  let vertical = $state(false);
  onMount(() => {
    const mq = matchMedia('(max-width: 720px)');
    vertical = mq.matches;
    mq.onchange = (e) => (vertical = e.matches);
  });
  function box(x: number, y: number, w: number, h: number) {
    return vertical
      ? `left:${((H - y - h) / H) * 100}%;top:${((x + 1) / W) * 100}%;width:${(h / H) * 100}%;height:${(w / W) * 100}%`
      : `left:${((x + 1) / W) * 100}%;top:${(y / H) * 100}%;width:${(w / W) * 100}%;height:${(h / H) * 100}%`;
  }
  const pointStyle = (x: number, y: number) => (vertical ? `left:${((H - y) / H) * 100}%;top:${((x + 1) / W) * 100}%` : `left:${((x + 1) / W) * 100}%;top:${(y / H) * 100}%`);

  const outside: { key: string; label: string; x: number; y: number; w: number; h: number; cls?: string }[] = $derived([
    ...[0, 1, 2].map((r) => ({ key: 'c' + (r + 1), label: '2:1', x: 12, y: r, w: 1, h: 1 })),
    ...[0, 1, 2].map((k) => ({ key: 'd' + (k + 1), label: ['1st 12', '2nd 12', '3rd 12'][k], x: k * 4, y: 3, w: 4, h: 0.7 })),
    ...[['low', '1-18'], ['even', t('r.even')], ['red', ''], ['black', ''], ['odd', t('r.odd')], ['high', '19-36']].map(([key, label], k) => ({ key, label, x: k * 2, y: 3.7, w: 2, h: 0.7, cls: key })),
  ]);
  const outsideBet = (key: string): Bet => {
    const o = outside.find((x) => x.key === key)!;
    return { key, nums: OUTSIDE[key], amt: 0, ax: o.x + o.w / 2, ay: o.y + o.h / 2 };
  };

  let tableEl: HTMLDivElement;
  function locate(e: PointerEvent | MouseEvent): Bet | null {
    const r = tableEl.getBoundingClientRect();
    const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
    const x = vertical ? v * W - 1 : u * W - 1;
    const y = vertical ? H - u * H : v * H;
    if (y < 3 && x < 12) return spotAt(x, y);
    if (y < 3) return outsideBet('c' + (Math.floor(y) + 1));
    if (x < 0 || x >= 12) return null;
    return y < 3.7 ? outsideBet('d' + (Math.floor(x / 4) + 1)) : outsideBet(['low', 'even', 'red', 'black', 'odd', 'high'][Math.floor(x / 2)]);
  }
  const lit = $derived(new Set(hover));

  // ---------- wheel animation ----------
  let rot = $state(0);
  let ball = $state<{ a: number; r: number } | null>(null);
  let resting = $state(-1); // pocket index the ball rests in
  const step = 360 / 37;
  let raf = 0;
  let spinning = $state(false);
  let lastSec = 0;
  function idle(now: number) {
    clock = now;
    if (!spinning) {
      rot = (rot + 0.04) % 360;
      if (resting >= 0) ball = { a: rot + resting * step, r: 64 };
    }
    // the croupier's last call: a soft tick for each of the final seconds
    const sec = Math.ceil(left / 1000);
    if (sec !== lastSec) { if (sec > 0 && sec <= 3 && alive) sfx('tick'); lastSec = sec; }
    raf = requestAnimationFrame(idle);
  }
  onMount(() => {
    raf = requestAnimationFrame(idle);
    openBetting();
  });
  // leaving the page stops everything audible at once: the rolling ball, the spin, the ticks
  let alive = true;
  let activeRoll: { stop(): void } | null = null;
  onDestroy(() => { alive = false; activeRoll?.stop(); cancelAnimationFrame(raf); clearTimeout(timer); room.leave(); });

  function animate(result: number) {
    return new Promise<void>((done) => {
      spinning = true;
      resting = -1;
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      sfx('spin');
      const dur = reduce ? 600 : 5600;
      const idx = WHEEL.indexOf(result);
      const w0 = rot, w1 = w0 + 360 * 1.2 + Math.random() * 90;
      const b0 = ball?.a ?? w0 + 180;
      let b1 = w1 + idx * step;
      while (b1 > b0 - 360 * 4) b1 -= 360;
      const t0 = performance.now();
      let lastPocket = -1;
      const ease = (x: number) => 1 - Math.pow(1 - x, 3);
      const roll = rolling();
      activeRoll = roll;
      const clacks = [0.63, 0.67, 0.705, 0.74, 0.775, 0.86];
      let nextClack = 0;
      const frame = (now: number) => {
        const k = Math.min(1, (now - t0) / dur);
        rot = w0 + (w1 - w0) * ease(k);
        const a = b0 + (b1 - b0) * (1 - Math.pow(1 - k, 2.6));
        // ball rides the rim, drops in at ~70 %, bounces a little, settles in the pocket
        const drop = k < 0.62 ? 0 : Math.min(1, (k - 0.62) / 0.18);
        const bounce = k > 0.8 && k < 0.92 ? Math.sin(((k - 0.8) / 0.12) * Math.PI) * 3 : 0;
        ball = { a, r: 89 - 25 * drop + bounce };
        // ball on the rim: rolling noise follows its speed; then it clatters over the frets
        roll.set(k < 0.62 ? Math.pow(1 - k, 1.6) : Math.max(0, 0.35 - (k - 0.62) * 2));
        if (nextClack < clacks.length && k >= clacks[nextClack]) { nextClack++; sfx('bounce'); }
        if (k > 0.8 && nextClack >= clacks.length - 1) roll.set(0);
        const pocket = Math.floor((a - rot) / step);
        if (drop > 0 && pocket !== lastPocket && k < 0.9) { lastPocket = pocket; sfx('tick'); }
        if (!alive) return;
        if (k < 1) requestAnimationFrame(frame);
        else { roll.stop(); activeRoll = null; rot %= 360; resting = idx; spinning = false; sfx('stop'); done(); }
      };
      requestAnimationFrame(frame);
    });
  }

  // ---------- round flow (host) ----------
  function openBetting() {
    if (!isHost) return;
    clearTimeout(timer);
    share.phase = 'bet';
    for (const p of [...guests, ...bots]) p.stake = 0;
    betEnd = share.auto ? performance.now() + BET_MS : 0;
    if (share.auto) timer = setTimeout(spin, BET_MS);
    push();
  }
  function setAuto(on: boolean) {
    share.auto = on;
    if (share.phase === 'bet') openBetting();
    else push();
  }
  async function spin() {
    if (!isHost || share.phase !== 'bet') return;
    clearTimeout(timer);
    betEnd = 0;
    const result = Math.floor(Math.random() * 37);
    for (const p of bots) { p.bets = botBets(); p.stake = p.bets.reduce((s, b) => s + b.amt, 0); }
    Object.assign(share, { phase: 'spin', result, round: share.round + 1 });
    push();
    await run(result);
    for (const p of [...guests, ...bots]) {
      const bs = p.bets ?? [];
      p.net = bs.length ? bs.reduce((s, b) => s + payout(b, result, partage), 0) - p.stake : null;
      p.bets = [];
    }
    share.history = [result, ...share.history].slice(0, 18);
    share.phase = 'result';
    push();
    timer = setTimeout(openBetting, RESULT_MS);
  }

  /** Every client animates the spin and settles its own bets. */
  async function run(result: number) {
    lastWin = null;
    await animate(result);
    const mine = $state.snapshot(bets);
    const back = mine.reduce((s, b) => s + payout(b, result, partage), 0);
    myNet = mine.length ? back - stake : null;
    if (mine.length) {
      settle(back - stake, back);
      lastBets = mine;
      lastWin = back;
      sfx(back >= stake * 10 && back > 0 ? 'big' : back > 0 ? 'win' : 'lose');
    }
    bets = [];
    undoStack = [];
  }

  // in auto mode the host may still spin early, as long as nobody else is waiting on the window
  const canSpinNow = $derived(isHost && share.phase === 'bet' && (!share.auto || guests.length === 0));
  function key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); if (canSpinNow) spin(); }
    if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); }
  }
  const colorName = (n: number) => t(('r.' + color(n) + '2') as any);
</script>

<svelte:window onkeydown={key} />

<section class="rt" class:vertical>
  <header class="head">
    <div class="h1row">
      <h1>Roulette</h1>
      <span class="eyebrow sub">Européenne · 0–36</span>
      <HowTo id="roulette" />
    </div>
    <RoomBar {room}>
      {#snippet extra()}
        {#if isHost}
          <label class="switch mini"><span>{t('r.auto')}</span><input type="checkbox" checked={share.auto} onchange={(e) => setAuto(e.currentTarget.checked)} /></label>
          <label class="switch mini"><span>{t('bots')}</span><input type="checkbox" bind:checked={settings.bots} /></label>
          <label class="switch mini"><span>{t('r.partage')}</span><input type="checkbox" bind:checked={partage} /></label>
        {/if}
      {/snippet}
    </RoomBar>
  </header>

  <div class="rail">
    <div class="felt">
      <div class="wheelcol">
        <div class="wheelbox">
          <Wheel rotation={rot} {ball} highlight={share.phase !== 'bet' && !spinning ? share.result : -1} />
          {#if share.phase !== 'bet' && !spinning && share.result >= 0}
            <div class="result {color(share.result)}" in:pop>{share.result}</div>
          {/if}
        </div>
        <div class="hist" aria-label={t('r.history')}>
          {#each share.history as n, i (share.round - i)}
            <span class="n {color(n)}" class:first={i === 0} in:fly={{ x: -16, duration: 300 }}>{n}</span>
          {/each}
        </div>
        <div class="trackwrap side">
          <Racetrack onbet={addGroups} onhover={(n) => (hover = n)} disabled={share.phase !== 'bet'} />
        </div>
        {#if players.length > 1}
          <ul class="players">
            {#each players as p (p.id)}
              <li class:me={p.id === room.myId}>
                <span class="av" class:bot={p.bot}>{p.name.slice(0, 1)}</span>
                <span class="pn">{p.name}</span>
                <span class="mono ps">{p.stake ? short(p.stake) : ''}</span>
                <span class="mono pnet" class:pos={(p.net ?? 0) > 0} class:neg={(p.net ?? 0) < 0}>{p.net === null ? '' : (p.net > 0 ? '+' : '') + short(p.net)}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <div class="tablecol">
        <!-- croupier banner: open window with countdown, no more bets, or the result -->
        <div class="banner" aria-live="polite">
          {#if share.phase === 'bet'}
            <span class="call">{t('r.place')}</span>
            {#if betEnd}
              <span class="mono secs" class:hot={left < 3500}>{Math.ceil(left / 1000)}</span>
              <span class="bar"><i style="transform: scaleX({left / BET_MS})"></i></span>
            {/if}
          {:else if share.phase === 'spin'}
            <span class="call serif">{t('r.noMore')}</span>
          {:else}
            <span class="call"><b class="dot {color(share.result)}"></b>{share.result} · {colorName(share.result)}</span>
            {#if lastWin !== null}<span class="mono won" class:zero={lastWin === 0} in:fly={{ y: 8 }}>{lastWin > 0 ? '+' + fmt(lastWin) : '0'}</span>{/if}
          {/if}
        </div>

        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
        <div
          class="table"
          class:locked={share.phase !== 'bet'}
          bind:this={tableEl}
          role="application"
          aria-label="Roulette table"
          onpointermove={(e) => { if (e.pointerType === 'mouse') hover = locate(e)?.nums ?? []; }}
          onpointerleave={() => (hover = [])}
          onclick={(e) => add(locate(e))}
          oncontextmenu={(e) => { e.preventDefault(); const b = locate(e); if (b) remove(b.key); }}>
          <div class="cell zero green" class:lit={lit.has(0)} class:won={share.phase === 'result' && share.result === 0} style={box(-1, 0, 1, 3)}><span>0</span></div>
          {#each Array(12) as _, c}
            {#each [0, 1, 2] as r}
              {@const n = numAt(c, r)}
              <div class="cell {color(n)}" class:lit={lit.has(n)} class:won={share.phase === 'result' && share.result === n} style={box(c, r, 1, 1)}><span>{n}</span></div>
            {/each}
          {/each}
          {#each outside as o}
            <div class="cell out {o.cls ?? ''}" class:lit={hover.length > 0 && OUTSIDE[o.key].every((n) => lit.has(n))} style={box(o.x, o.y, o.w, o.h)}>
              {#if o.key === 'red' || o.key === 'black'}<i class="diamond {o.key}"></i>{:else}<span>{o.label}</span>{/if}
            </div>
          {/each}
          {#each bets as b (b.key)}
            <div class="placed" style={pointStyle(b.ax!, b.ay!)} in:drop out:pop={{ duration: 220 }}>
              <span class="chip" data-v={chipOf(b.amt)}>{short(b.amt)}</span>
            </div>
          {/each}
        </div>
        <div class="trackwrap main">
          <Racetrack onbet={addGroups} onhover={(n) => (hover = n)} disabled={share.phase !== 'bet'} />
        </div>
        <p class="hint">{t('r.hint')}</p>
      </div>
    </div>
  </div>

  <div class="dock panel">
    <ChipTray bind:value={chip} />
    <div class="actions">
      <button class="btn sm ghost" onclick={undo} disabled={share.phase !== 'bet' || !bets.length}>{t('bet.undo')}</button>
      <button class="btn sm ghost" onclick={clear} disabled={share.phase !== 'bet' || !bets.length}>{t('bet.clear')}</button>
      <button class="btn sm ghost" onclick={rebet} disabled={share.phase !== 'bet' || !lastBets.length}>{t('bet.rebet')}</button>
      <button class="btn sm ghost" onclick={double} disabled={share.phase !== 'bet' || !bets.length}>×2</button>
    </div>
    <div class="total">
      <span class="eyebrow">{warn ? t('notEnough') : t('bet.total')}</span>
      <strong class="mono" class:warn>{fmt(stake)}</strong>
    </div>
    {#if canSpinNow}
      <button class="btn primary spin" onclick={spin}>
        {share.auto ? t('r.spinNow') : t('r.spin')}{#if betEnd}<span class="mono cd">{Math.ceil(left / 1000)}</span>{/if}
      </button>
    {:else}
      <span class="btn ghost spin waiting">
        {#if share.phase === 'bet' && betEnd}{t('r.place')} <span class="mono cd">{Math.ceil(left / 1000)}</span>
        {:else if share.phase === 'bet'}{t('r.waitHost')}
        {:else if share.phase === 'spin'}{t('r.noMore')}
        {:else}{t('r.next')}{/if}
      </span>
    {/if}
  </div>
</section>

<style>
  /* ---------- page frame: the table fills the screen on desktop ---------- */
  .rt { width: min(100%, 1680px); margin-inline: auto; padding: 0 20px 14px; display: grid; gap: 10px; }
  .head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; padding: 12px 4px 0; }
  .h1row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  h1 { margin: 0; font-size: clamp(1.7rem, 3vw, 2.4rem); letter-spacing: -0.04em; line-height: 1; font-weight: 700; }
  .sub { margin-top: 4px; }
  .switch.mini { min-height: 36px; font-size: 0.8rem; color: var(--muted); gap: 8px; }

  /* ---------- the royal table: walnut rail, gold inlay, deep felt ---------- */
  .rail {
    --gold-line: color-mix(in srgb, var(--gold) 62%, transparent);
    padding: 12px; border-radius: 44px; position: relative;
    background: linear-gradient(160deg, #6b3d22, #3b1f10 45%, #24120a 100%);
    box-shadow: 0 40px 80px -40px rgba(0,0,0,.8), inset 0 2px 0 rgba(255,255,255,.12), inset 0 -3px 0 rgba(0,0,0,.4);
  }
  .rail::before { content: ''; position: absolute; inset: 5px; border-radius: 39px; border: 1px solid rgba(232, 196, 120, 0.35); pointer-events: none; }
  .felt {
    position: relative; border-radius: 32px; padding: clamp(14px, 2.4vw, 32px);
    display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 2fr); gap: clamp(16px, 3vw, 44px); align-items: center;
    background:
      radial-gradient(ellipse at 30% 20%, color-mix(in srgb, var(--felt) 70%, #fff 6%), transparent 60%),
      repeating-conic-gradient(from 45deg, rgba(255,255,255,.018) 0 25%, transparent 0 50%) 0 0 / 28px 28px,
      radial-gradient(ellipse at 50% 40%, var(--felt), var(--felt-2) 80%);
    box-shadow: inset 0 0 0 2px rgba(0,0,0,.35), inset 0 0 0 9px rgba(0,0,0,.08), inset 0 0 0 10px var(--gold-line), inset 0 30px 80px rgba(0,0,0,.35);
  }

  /* ---------- wheel column ---------- */
  .wheelcol { display: grid; justify-items: center; align-content: center; gap: 14px; min-width: 0; }
  .wheelbox { position: relative; width: 100%; max-width: 640px; }
  .result {
    position: absolute; left: 50%; top: 50%; translate: -50% -50%; width: 25%; aspect-ratio: 1; border-radius: 50%;
    display: grid; place-items: center; font: 400 clamp(1.8rem, 3.2vw, 3rem) 'Instrument Serif', Georgia, serif; color: #fff;
    box-shadow: 0 0 0 3px #e8c478, 0 0 0 6px rgba(0,0,0,.4), 0 20px 40px rgba(0, 0, 0, 0.5);
  }
  .result.red { background: var(--pocket-red); } .result.black { background: var(--pocket-black); } .result.green { background: var(--pocket-green); }
  .hist { display: flex; gap: 4px; flex-wrap: wrap; justify-content: center; min-height: 28px; max-width: 100%; }
  .n { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; font: 600 0.75rem 'Geist Mono Variable', monospace; color: #fff; box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); }
  .n.first { box-shadow: 0 0 0 2px #e8c478; }
  .n.red { background: var(--pocket-red); } .n.black { background: var(--pocket-black); } .n.green { background: var(--pocket-green); }
  /* players sit around the wheel as small name plates */
  .players { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; max-width: 100%; color: #fff; }
  .players li { display: flex; gap: 6px; align-items: center; padding: 3px 10px 3px 3px; border-radius: 999px; font-size: 0.78rem; background: rgba(0,0,0,.28); box-shadow: inset 0 0 0 1px rgba(232,196,120,.18); }
  .players li.me { box-shadow: inset 0 0 0 1px #e8c478; }
  .pn { max-width: 9ch; }
  .av { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: #e8c478; color: #2a1c05; font-weight: 700; font-size: 0.72rem; }
  .av.bot { background: rgba(255,255,255,.1); color: rgba(255,255,255,.7); border: 1px dashed rgba(255,255,255,.3); }
  .pn { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ps { color: rgba(255,255,255,.55); }
  .pnet:empty, .ps:empty { display: none; }
  .pos { color: #6ff0a6; } .neg { color: #ff9a9d; }

  /* ---------- layout column ---------- */
  .tablecol { display: grid; justify-items: center; align-content: center; gap: clamp(10px, 1.6vw, 18px); min-width: 0; }
  .tablecol > * { width: 100%; }
  .banner {
    display: flex; align-items: center; justify-content: center; gap: 12px; min-height: 42px; color: #f7ecd4; position: relative;
    font: 500 1.05rem 'Geist Variable', sans-serif; letter-spacing: 0.02em;
  }
  .banner .call { display: inline-flex; align-items: center; gap: 8px; }
  .banner .serif { font-size: 1.5rem; }
  .banner .dot { width: 14px; height: 14px; border-radius: 50%; display: inline-block; box-shadow: 0 0 0 2px rgba(255,255,255,.4); }
  .dot.red { background: var(--pocket-red); } .dot.black { background: var(--pocket-black); } .dot.green { background: var(--pocket-green); }
  .secs { min-width: 2ch; font-size: 1.3rem; color: #e8c478; text-align: right; }
  .secs.hot { color: #ff8a8d; animation: beat 1s ease-in-out infinite; }
  @keyframes beat { 50% { transform: scale(1.15); } }
  .bar { width: min(220px, 30%); height: 4px; border-radius: 4px; background: rgba(255,255,255,.14); overflow: hidden; }
  .bar i { display: block; height: 100%; background: linear-gradient(90deg, #e8c478, #f6e2b0); transform-origin: left; }
  .won { font-size: 1.3rem; color: #6ff0a6; }
  .won.zero { color: rgba(255,255,255,.6); }

  .table { position: relative; aspect-ratio: 14 / 5.4; user-select: none; touch-action: manipulation; cursor: pointer; }
  .vertical .table { aspect-ratio: 4.4 / 8.6; max-width: 420px; margin-inline: auto; }
  .table.locked { cursor: default; }
  .cell {
    position: absolute; display: grid; place-items: center; border: 1.5px solid var(--gold-line); margin: -0.75px;
    color: #fff; font: 600 clamp(0.72rem, 1.2vw, 1.15rem) 'Geist Variable', sans-serif; transition: background 0.15s;
  }
  .cell span { pointer-events: none; }
  .cell.red span, .cell.black span, .cell.green span { width: 72%; max-width: 46px; aspect-ratio: 1; border-radius: 50%; display: grid; place-items: center; box-shadow: inset 0 -2px 0 rgba(0,0,0,.25), 0 1px 0 rgba(255,255,255,.12); }
  .cell.red span { background: var(--pocket-red); }
  .cell.black span { background: var(--pocket-black); }
  .cell.zero { border-radius: 60px 0 0 60px; }
  .vertical .cell.zero { border-radius: 60px 60px 0 0; }
  .cell.zero span { background: var(--pocket-green); }
  .cell.out { font: 400 clamp(0.9rem, 1.4vw, 1.35rem) 'Instrument Serif', Georgia, serif; font-style: italic; letter-spacing: 0.01em; color: #f7ecd4; }
  .cell.lit { background: rgba(255, 236, 190, 0.16); }
  .cell.won { background: rgba(255, 236, 190, 0.3); animation: glow 0.7s ease-in-out infinite alternate; }
  @keyframes glow { to { background: rgba(255, 236, 190, 0.08); } }
  .diamond { width: 34%; max-width: 34px; aspect-ratio: 1; transform: rotate(45deg) scaleY(0.7); pointer-events: none; box-shadow: 0 0 0 1.5px #e8c478; }
  .diamond.red { background: var(--pocket-red); } .diamond.black { background: var(--pocket-black); }
  .placed { position: absolute; translate: -50% -50%; pointer-events: none; z-index: 2; }
  .placed .chip { --size: clamp(24px, 2.7vw, 38px); }
  .vertical .placed .chip { --size: 28px; }
  .trackwrap { max-width: 640px; }
  .trackwrap.side { display: none; }
  .trackwrap :global(.outline), .trackwrap :global(.div) { stroke: var(--gold-line); }
  .hint { margin: 0; font-size: 0.76rem; color: rgba(255,255,255,.55); text-align: center; }

  /* ---------- dock ---------- */
  .dock {
    position: sticky; bottom: 10px; z-index: 20; padding: 12px 16px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 20px;
    width: min(1240px, 100%); margin-inline: auto;
    background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: blur(14px); border-radius: 24px; box-shadow: 0 20px 50px -20px rgba(0,0,0,.5);
  }
  .actions { display: flex; gap: 6px; flex-wrap: wrap; }
  .total { display: grid; gap: 4px; min-width: 90px; }
  .total strong { font-size: 1.25rem; }
  .warn { color: var(--accent); }
  .spin { min-width: 160px; min-height: 52px; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.08em; }
  .cd { display: inline-grid; place-items: center; min-width: 30px; height: 26px; padding: 0 6px; border-radius: 999px; background: rgba(0,0,0,.2); font-size: 0.85rem; letter-spacing: 0; }
  .waiting { cursor: default; color: var(--muted); }
  .waiting .cd { background: var(--surface-2); color: var(--text); }

  /* desktop: wheel, layout and dock always fit the window; sizes follow the felt's real height */
  @media (min-width: 1000px) {
    .rt { height: calc(100dvh - var(--nav-h)); min-height: 640px; grid-template-rows: auto minmax(0, 1fr) auto; }
    .rail { min-height: 0; }
    .felt { height: 100%; container-type: size; }
    .wheelbox { width: min(100%, calc(100cqh - 90px)); }
    /* layout ≈ 0.39 w, racetrack ≈ 0.17 w, plus banner and hint */
    .tablecol > * { width: min(100%, calc((92cqh - 110px) / 0.57)); }
    .trackwrap { width: min(100%, calc((92cqh - 110px) / 0.57 * 0.66)) !important; }
    .dock { position: relative; bottom: auto; }
  }
  /* short desktop screens: the racetrack moves under the wheel so the layout can stay large */
  @media (min-width: 1000px) and (max-height: 860px) {
    .trackwrap.main, .hint { display: none; }
    .trackwrap.side { display: block; width: 100%; }
    .wheelbox { width: min(100%, calc(100cqh - 80px - 9cqw)); }
    .tablecol > * { width: min(100%, calc((100cqh - 70px) / 0.386)); }
  }
  @media (max-width: 999px) {
    .rt { padding-bottom: 100px; }
    .felt { grid-template-columns: 1fr; }
    .wheelcol { grid-template-columns: minmax(170px, 280px) 1fr; align-items: center; justify-items: stretch; }
    .wheelcol .hist { justify-content: flex-start; }
    .players { grid-column: 1 / -1; justify-content: flex-start; }
  }
  @media (max-width: 720px) {
    .rt { padding: 0 10px 110px; }
    .rail { padding: 8px; border-radius: 30px; }
    .rail::before { border-radius: 26px; inset: 3px; }
    .felt { border-radius: 22px; padding: 14px 10px; }
    .wheelcol { grid-template-columns: 1fr; justify-items: center; }
    .wheelbox { max-width: 220px; }
    .wheelcol .hist { justify-content: center; }
    .banner { font-size: 0.95rem; }
    .dock { bottom: 8px; padding: 10px; gap: 8px; }
    .dock :global(.tray) { flex-wrap: nowrap; overflow-x: auto; width: 100%; justify-content: flex-start; padding: 8px 4px 4px; }
    .dock :global(.tray .chip) { --size: 38px; }
    .actions { order: 3; width: 100%; justify-content: space-between; }
    .actions .btn { min-height: 32px; flex: 1; padding: 0 6px; }
    .spin { flex: 1; min-height: 46px; min-width: 0; }
  }
</style>
