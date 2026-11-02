<script lang="ts">
  import { onDestroy, onMount, untrack } from 'svelte';
  import { fly, scale } from 'svelte/transition';
  import Wheel from '../components/Wheel.svelte';
  import Racetrack from '../components/Racetrack.svelte';
  import ChipTray from '../components/ChipTray.svelte';
  import RoomBar from '../components/RoomBar.svelte';
  import { WHEEL, OUTSIDE, color, spotAt, betOf, payout, numAt, type Bet } from '../games/roulette';
  import { Room } from '../lib/net.svelte';
  import { settings, wallet, settle, fmt } from '../lib/state.svelte';
  import { chipOf, short } from '../lib/chips';
  import { sfx } from '../lib/sfx';
  import { t } from '../lib/i18n';

  type Player = { id: string; name: string; bot?: boolean; stake: number; net: number | null; bets?: { nums: number[]; amt: number }[] };

  // ---------- local betting state ----------
  let chip = $state(25);
  let bets = $state<Bet[]>([]);
  let undoStack: Bet[][] = [];
  let lastBets = $state<Bet[]>([]);
  let hover = $state<number[]>([]);
  let partage = $state(false);
  const stake = $derived(bets.reduce((s, b) => s + b.amt, 0));

  // ---------- shared table state (host authoritative) ----------
  const share = $state({ phase: 'bet' as 'bet' | 'spin' | 'result', result: -1, round: 0, history: [] as number[], players: [] as Player[], partage: false });
  let lastWin = $state<number | null>(null);
  let myNet = $state<number | null>(null);
  let guests = $state<Player[]>([]); // host only
  let bots = $state<Player[]>([]); // host only

  const room = new Room('roulette', onMsg, (id) => {
    guests = guests.filter((p) => p.id !== id);
    push();
  });
  const isHost = $derived(room.role !== 'guest');
  const me = $derived<Player>({ id: room.myId, name: settings.name, stake, net: myNet });
  const players = $derived(isHost ? [me, ...guests, ...bots] : share.players);

  function onMsg(m: any, from: string) {
    if (m.t === 'state') {
      const spinNow = m.s.phase === 'spin' && m.s.round !== share.round;
      Object.assign(share, m.s);
      partage = share.partage;
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
    untrack(() => room.broadcast({ t: 'state', s: { ...$state.snapshot(share), players: $state.snapshot(players).map(({ bets, ...p }) => p) } }));
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
  function idle() {
    if (!spinning) {
      rot = (rot + 0.04) % 360;
      if (resting >= 0) ball = { a: rot + resting * step, r: 64 };
    }
    raf = requestAnimationFrame(idle);
  }
  onMount(() => { raf = requestAnimationFrame(idle); });
  onDestroy(() => { cancelAnimationFrame(raf); room.leave(); });

  function animate(result: number) {
    return new Promise<void>((done) => {
      spinning = true;
      resting = -1;
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const dur = reduce ? 600 : 5600;
      const idx = WHEEL.indexOf(result);
      const w0 = rot, w1 = w0 + 360 * 1.2 + Math.random() * 90;
      const b0 = ball?.a ?? w0 + 180;
      let b1 = w1 + idx * step;
      while (b1 > b0 - 360 * 4) b1 -= 360;
      const t0 = performance.now();
      let lastPocket = -1;
      const ease = (x: number) => 1 - Math.pow(1 - x, 3);
      const frame = (now: number) => {
        const k = Math.min(1, (now - t0) / dur);
        rot = w0 + (w1 - w0) * ease(k);
        const a = b0 + (b1 - b0) * (1 - Math.pow(1 - k, 2.6));
        // ball rides the rim, drops in at ~70 %, bounces a little, settles in the pocket
        const drop = k < 0.62 ? 0 : Math.min(1, (k - 0.62) / 0.18);
        const bounce = k > 0.8 && k < 0.92 ? Math.sin(((k - 0.8) / 0.12) * Math.PI) * 3 : 0;
        ball = { a, r: 89 - 25 * drop + bounce };
        const pocket = Math.floor((a - rot) / step);
        if (drop > 0 && pocket !== lastPocket && k < 0.9) { lastPocket = pocket; sfx('tick'); }
        if (k < 1) requestAnimationFrame(frame);
        else { rot %= 360; resting = idx; spinning = false; sfx('stop'); done(); }
      };
      requestAnimationFrame(frame);
    });
  }

  // ---------- round flow ----------
  async function spin() {
    if (!isHost || share.phase !== 'bet') return;
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
    setTimeout(() => {
      share.phase = 'bet';
      for (const p of [...guests, ...bots]) p.stake = 0;
      push();
    }, 2200);
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
      sfx(back > 0 ? 'win' : 'lose');
    }
    bets = [];
    undoStack = [];
  }

  function key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); spin(); }
    if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo(); }
  }
</script>

<svelte:window onkeydown={key} />

<section class="wrap page">
  <header class="head">
    <div>
      <p class="eyebrow">European · 1–36 + 0</p>
      <h1>Roulette</h1>
    </div>
    <RoomBar {room}>
      {#snippet extra()}
        {#if isHost}
          <label class="switch mini"><span>{t('bots')}</span><input type="checkbox" bind:checked={settings.bots} /></label>
          <label class="switch mini"><span>{t('r.partage')}</span><input type="checkbox" bind:checked={partage} /></label>
        {/if}
      {/snippet}
    </RoomBar>
  </header>

  <div class="layout">
    <aside class="side">
      <div class="wheelbox">
        <Wheel rotation={rot} {ball} highlight={share.phase !== 'bet' && !spinning ? share.result : -1} />
        {#if share.phase !== 'bet' && !spinning && share.result >= 0}
          <div class="result {color(share.result)}" in:scale={{ start: 0.6, duration: 400 }}>{share.result}</div>
        {/if}
      </div>
      {#if lastWin !== null && !spinning}
        <p class="win" class:lose={lastWin === 0} in:fly={{ y: 10 }}>{lastWin > 0 ? '+' + fmt(lastWin) : '0'}</p>
      {/if}
      <div class="hist">
        <span class="eyebrow">{t('r.history')}</span>
        <div class="nums">
          {#each share.history as n, i (share.round - i)}
            <span class="n {color(n)}" in:fly={{ x: -16, duration: 300 }}>{n}</span>
          {/each}
        </div>
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
    </aside>

    <div class="tablecol">
      <div class="felt">
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
        <div
          class="table"
          class:vertical
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
            <div class="placed" style={pointStyle(b.ax!, b.ay!)} in:scale={{ start: 1.6, duration: 260 }}>
              <span class="chip" data-v={chipOf(b.amt)}>{short(b.amt)}</span>
            </div>
          {/each}
        </div>
        <div class="trackwrap">
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
    {#if isHost}
      <button class="btn primary spin" onclick={spin} disabled={share.phase !== 'bet'}>{share.phase === 'bet' ? t('r.spin') : t('r.noMore')}</button>
    {:else}
      <span class="btn ghost spin waiting">{share.phase === 'bet' ? t('r.waitHost') : t('r.noMore')}</span>
    {/if}
  </div>
</section>

<style>
  .page { padding-bottom: 120px; }
  .head { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 12px; padding: 28px 0 8px; }
  h1 { margin: 6px 0 0; font-size: clamp(2.2rem, 5vw, 3.6rem); letter-spacing: -0.04em; line-height: 0.95; font-weight: 700; }
  .switch.mini { min-height: 36px; font-size: 0.8rem; color: var(--muted); gap: 8px; }
  .layout { display: grid; grid-template-columns: minmax(240px, 340px) 1fr; gap: 28px; align-items: start; margin-top: 8px; }
  .side { display: grid; gap: 18px; }
  .wheelbox { position: relative; }
  .result {
    position: absolute; left: 50%; top: 50%; translate: -50% -50%; width: 26%; aspect-ratio: 1; border-radius: 50%;
    display: grid; place-items: center; font: 700 clamp(1.4rem, 3vw, 2.2rem) 'Geist Mono Variable', monospace; color: #fff;
    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.85), 0 20px 40px rgba(0, 0, 0, 0.5);
  }
  .result.red { background: var(--pocket-red); } .result.black { background: var(--pocket-black); } .result.green { background: var(--pocket-green); }
  .win { margin: -8px 0 0; text-align: center; font: 700 1.6rem 'Geist Mono Variable', monospace; color: #2fbf71; }
  .win.lose { color: var(--muted); }
  .hist { display: grid; gap: 8px; }
  .nums { display: flex; gap: 4px; flex-wrap: wrap; min-height: 28px; }
  .n { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; font: 600 0.75rem 'Geist Mono Variable', monospace; color: #fff; }
  .n.red { background: var(--pocket-red); } .n.black { background: var(--pocket-black); border: 1px solid var(--line-2); } .n.green { background: var(--pocket-green); }
  .players { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  .players li { display: grid; grid-template-columns: 26px 1fr auto 64px; gap: 10px; align-items: center; padding: 6px 10px; border-radius: 12px; font-size: 0.85rem; }
  .players li.me { background: var(--surface); }
  .av { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: var(--accent); color: var(--accent-ink); font-weight: 700; font-size: 0.75rem; }
  .av.bot { background: var(--surface-2); color: var(--muted); border: 1px dashed var(--line-2); }
  .pn { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ps { color: var(--muted); }
  .pnet { text-align: right; }
  .pos { color: #2fbf71; } .neg { color: var(--accent); }

  .felt { background: radial-gradient(ellipse at 50% 0%, var(--felt), var(--felt-2)); border-radius: 28px; padding: clamp(14px, 2.4vw, 28px); box-shadow: inset 0 0 0 1px rgba(255,255,255,.06), inset 0 30px 80px rgba(0,0,0,.25); }
  .table { position: relative; aspect-ratio: 14 / 5.4; user-select: none; touch-action: manipulation; cursor: pointer; }
  .table.vertical { aspect-ratio: 4.4 / 8.6; max-width: 420px; margin-inline: auto; }
  .table.locked { cursor: default; }
  .cell {
    position: absolute; display: grid; place-items: center; border: 1px solid var(--felt-line); margin: -0.5px;
    color: #fff; font: 600 clamp(0.7rem, 1.25vw, 1.05rem) 'Geist Variable', sans-serif; transition: background 0.15s;
  }
  .cell span { pointer-events: none; }
  .cell.red span, .cell.black span, .cell.green span { width: 70%; max-width: 40px; aspect-ratio: 1; border-radius: 50%; display: grid; place-items: center; }
  .cell.red span { background: var(--pocket-red); }
  .cell.black span { background: var(--pocket-black); }
  .cell.zero { border-radius: 40px 0 0 40px; }
  .vertical .cell.zero { border-radius: 40px 40px 0 0; }
  .cell.zero span { background: var(--pocket-green); }
  .cell.out { font: 600 clamp(0.62rem, 1vw, 0.85rem) 'Geist Mono Variable', monospace; letter-spacing: 0.04em; color: rgba(255,255,255,.88); }
  .cell.lit { background: rgba(255, 255, 255, 0.16); }
  .cell.won { background: rgba(255, 255, 255, 0.28); animation: glow 0.7s ease-in-out infinite alternate; }
  @keyframes glow { to { background: rgba(255, 255, 255, 0.08); } }
  .diamond { width: 34%; max-width: 30px; aspect-ratio: 1; transform: rotate(45deg) scaleY(0.7); pointer-events: none; }
  .diamond.red { background: var(--pocket-red); } .diamond.black { background: var(--pocket-black); border: 1px solid rgba(255,255,255,.4); }
  .placed { position: absolute; translate: -50% -50%; pointer-events: none; z-index: 2; }
  .placed .chip { --size: clamp(24px, 3vw, 36px); }
  .vertical .placed .chip { --size: 28px; }
  .trackwrap { margin: clamp(14px, 2vw, 22px) auto 0; max-width: 620px; }
  .hint { margin: 12px 0 0; font-size: 0.78rem; color: rgba(255,255,255,.6); text-align: center; }

  .dock {
    position: sticky; bottom: 12px; z-index: 20; margin-top: 20px; padding: 12px 16px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 20px;
    background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: blur(14px); border-radius: 24px; box-shadow: 0 20px 50px -20px rgba(0,0,0,.5);
  }
  .actions { display: flex; gap: 6px; flex-wrap: wrap; }
  .total { display: grid; gap: 4px; min-width: 90px; }
  .total strong { font-size: 1.25rem; }
  .warn { color: var(--accent); }
  .spin { min-width: 140px; min-height: 52px; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.08em; }
  .waiting { cursor: default; color: var(--muted); }

  @media (max-width: 900px) {
    .layout { grid-template-columns: 1fr; }
    .side { grid-template-columns: minmax(160px, 220px) 1fr; align-items: start; }
    .players { grid-column: 1 / -1; }
  }
  @media (max-width: 720px) {
    .dock { bottom: 8px; padding: 10px; gap: 8px; }
    .dock :global(.tray) { flex-wrap: nowrap; overflow-x: auto; width: 100%; justify-content: flex-start; padding: 8px 4px 4px; }
    .dock :global(.tray .chip) { --size: 38px; }
    .actions { order: 3; width: 100%; justify-content: space-between; }
    .actions .btn { min-height: 32px; flex: 1; padding: 0 6px; }
    .spin { flex: 1; min-height: 46px; }
  }
</style>
