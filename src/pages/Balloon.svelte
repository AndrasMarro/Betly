<script lang="ts">
  import { fly } from 'svelte/transition';
  import BalloonSky from '../components/BalloonSky.svelte';
  import ArcadeLayout from '../components/ArcadeLayout.svelte';
  import BetInput from '../components/BetInput.svelte';
  import { RISK, balloonMult, pops, type Risk } from '../games/balloon';
  import { wallet, settle, stake, fmt, settings } from '../lib/state.svelte';
  import { sfx } from '../lib/sfx';
  import { t } from '../lib/i18n';

  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
  // Up to three balloons per round, each with its own stake (the bet), pump and cash-out.
  // Very rarely the mountain bunker shoots a pumped balloon on its own: that pays its value ten times.
  // Shot by the player from the captured bunker it simply pays out its value.
  type B = { id: number; color: string; k: number; phase: 'play' | 'popped' | 'flown' | 'shot'; staked: number; won: number; push: number; busy: boolean; x?: number };
  let bet = $state(10);
  let risk = $state<Risk>('mid');
  let count = $state(1);
  let bs = $state<B[]>([]);
  let sel = $state(0); // the balloon the keyboard and the main button act on
  let history = $state<{ m: number; ok: boolean; id: number; shot?: boolean }[]>([]);
  let n = 0;
  let launch = $state<{ id: number; color: string }>();
  let els: HTMLDivElement[] = $state([]);
  let sky: HTMLDivElement;
  let skyArt: ReturnType<typeof BalloonSky> | undefined = $state();
  let gunner = $state(false); // secret: tap the bunker 5 times to aim and fire it yourself
  const COLORS = ['#e5484d', '#3d9bff', '#f2b01e', '#2fbf71', '#b05cff', '#ff7ab8'];

  const max = $derived(RISK[risk].max);
  const playing = $derived(bs.some((b) => b.phase === 'play'));
  const cur = $derived(bs[sel]);
  const roundWon = $derived(bs.reduce((a, b) => a + b.won, 0));
  const size = (b: B) => 0.32 + 0.68 * Math.min(1, b.k / max); // grows with every pump, full at the last one
  const value = (b: B) => Math.round(b.staked * balloonMult(risk, b.k) * 100) / 100;

  function start() {
    if (bet <= 0 || bet * count > wallet.balance) return false;
    stake(bet * count);
    const cols = [...COLORS].sort(() => Math.random() - 0.5);
    bs = Array.from({ length: count }, (_, i) => ({ id: ++n, color: cols[i], k: 0, phase: 'play' as const, staked: bet, won: 0, push: 0, busy: false }));
    sel = 0;
    return true;
  }
  /** Next balloon still in play after one finished. */
  function moveOn() {
    if (cur?.phase === 'play') return;
    const i = bs.findIndex((b) => b.phase === 'play');
    if (i >= 0) sel = i;
  }
  function done(b: B, ok: boolean, m: number, shot = false) {
    history = [{ m, ok, id: ++n, shot }, ...history].slice(0, 12);
    moveOn();
  }

  async function pump(i = sel) {
    if (!playing) { if (!start()) return; i = 0; }
    const b = bs[i];
    if (!b || b.phase !== 'play' || b.busy) return;
    sel = i;
    b.busy = true;
    b.push++;
    sfx('pump');
    await new Promise((r) => setTimeout(r, 260));
    if (b.phase !== 'play') return; // shot down meanwhile
    b.busy = false;
    if (pops(risk)) {
      b.phase = 'popped';
      settle(0, 0);
      sfx('pop');
      done(b, false, balloonMult(risk, b.k + 1));
    } else {
      b.k++;
      if (b.k >= max) cashOut(i); // full balloon: it lifts off on its own
    }
  }
  function cashOut(i = sel) {
    const b = bs[i];
    if (!b || b.phase !== 'play' || b.k < 1 || b.busy) return;
    b.won = value(b);
    settle(b.won, b.won);
    b.phase = 'flown';
    launch = { id: Date.now() + i, color: b.color }; // it shows up again far away in the sky
    sfx('cash');
    done(b, true, balloonMult(risk, b.k));
  }
  const cashAll = () => bs.forEach((_, i) => cashOut(i));

  // the pumped balloons in sky coordinates (the bunker aims at one, the player's shells can hit any)
  function targets() {
    if (!sky) return [];
    const s = sky.getBoundingClientRect();
    return bs.flatMap((b, i) => {
      const r = els[i]?.getBoundingClientRect();
      return b.phase === 'play' && b.k >= 1 && !b.busy && r ? [{ id: b.id, x: r.left + r.width / 2 - s.left, y: r.top + r.height * 0.42 - s.top, r: r.width * 0.42 }] : [];
    });
  }
  const aim = () => { const l = targets(); return l.length ? l[Math.floor(Math.random() * l.length)] : null; };
  function hit(id: number, mine: boolean) {
    const b = bs.find((x) => x.id === id);
    if (!b || b.phase !== 'play' || b.k < 1) return;
    const x = mine ? 1 : 10;
    b.won = Math.round(value(b) * x * 100) / 100;
    b.x = x;
    settle(b.won, b.won);
    b.phase = 'shot';
    sfx('pop');
    if (!mine) setTimeout(() => sfx('big'), 250);
    done(b, true, balloonMult(risk, b.k) * x, !mine);
  }

  function key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    if (e.code === 'Escape') skyArt?.exit();
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) pump(); }
    if (e.code === 'Enter') { e.preventDefault(); cashOut(); }
    const d = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
    if (d >= 0 && bs[d]?.phase === 'play') sel = d;
    if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && bs.length) {
      const order = bs.map((_, i) => i).filter((i) => bs[i].phase === 'play');
      if (order.length) sel = order[(order.indexOf(sel) + (e.code === 'ArrowLeft' ? -1 : 1) + order.length) % order.length] ?? order[0];
    }
  }
  // tapping the sky pumps the balloon in that part of the sky, so phones do not need the buttons
  function tap(e: MouseEvent) {
    const r = sky.getBoundingClientRect(), slots = Math.max(1, playing ? bs.length : count);
    if (skyArt?.tap(e.clientX - r.left, e.clientY - r.top)) return; // the bunker (or firing it) took the tap
    pump(playing ? Math.min(slots - 1, Math.floor(((e.clientX - r.left) / r.width) * slots)) : 0);
  }
  function point(e: PointerEvent) { const r = sky.getBoundingClientRect(); skyArt?.point(e.clientX - r.left, e.clientY - r.top); }
  // rubber shreds for the pop
  const SHREDS = Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * Math.PI * 2 + Math.random() * 0.4, d: 90 + Math.random() * 90, r: Math.random() * 720 - 360, s: 0.6 + Math.random() * 0.8 }));
  const shown = $derived(bs.length ? bs : [{ id: 0, color: COLORS[0], k: 0, phase: 'play', staked: 0, won: 0, push: 0, busy: false } as B]);
  const scaleFor = $derived(shown.length === 1 ? 1 : shown.length === 2 ? 0.8 : 0.64);
</script>

<svelte:window onkeydown={key} />

<ArcadeLayout eyebrow={L('Arcade · Pumpen oder kassieren', 'Arcade · Pump or cash out')} title={L('Ballon', 'Balloon')}>
  {#snippet controls()}
    {#if playing}
      {#each bs as b, i (b.id)}
        <div class="row" class:on={i === sel} class:out={b.phase !== 'play'}>
          <button class="who" onclick={() => b.phase === 'play' && (sel = i)} aria-label={L('Ballon wählen', 'Select balloon') + ' ' + (i + 1)}>
            <i style="background:{b.color}"></i><span class="mono">{b.phase === 'play' ? '×' + balloonMult(risk, b.k).toFixed(2) : b.phase === 'popped' ? L('Geplatzt', 'Popped') : '+' + fmt(b.won)}</span>
          </button>
          {#if b.phase === 'play'}
            <button class="btn sm" disabled={b.busy} onclick={() => pump(i)}>{L('Pumpen', 'Pump')}</button>
            <button class="btn sm cash" disabled={b.k < 1 || b.busy} onclick={() => cashOut(i)}>{fmt(value(b))}</button>
          {/if}
        </div>
      {/each}
      {#if bs.filter((b) => b.phase === 'play' && b.k > 0).length > 1}<button class="btn cashall" onclick={cashAll}>{L('Alle auszahlen', 'Cash out all')}</button>{/if}
    {:else}
      <button class="btn primary big" disabled={bet * count > wallet.balance} onclick={() => pump()}>{L('Spielen und pumpen', 'Play and pump')}</button>
    {/if}
    <BetInput bind:value={bet} disabled={playing} />
    <div class="field">{L('Ballons', 'Balloons')} <span class="muted small">({L('Einsatz je Ballon', 'stake per balloon')})</span>
      <div class="seg">
        {#each [1, 2, 3] as c}<button class:on={count === c} disabled={playing} onclick={() => (count = c)}>{c}</button>{/each}
      </div>
    </div>
    <div class="field">{L('Risiko', 'Risk')}
      <div class="seg">
        {#each [['low', L('Tief', 'Low')], ['mid', L('Mittel', 'Medium')], ['high', L('Hoch', 'High')]] as [r, label]}
          <button class:on={risk === r} disabled={playing} onclick={() => (risk = r as Risk)}>{label}</button>
        {/each}
      </div>
    </div>
    <div class="stats">
      <div><span class="eyebrow">{L('Platz-Chance', 'Pop chance')}</span><strong class="mono">{Math.round(RISK[risk].p * 100)} %</strong></div>
      <div><span class="eyebrow">{L('Nächster', 'Next')}</span><strong class="mono">×{balloonMult(risk, (playing && cur ? cur.k : 0) + 1).toFixed(2)}</strong></div>
      <div><span class="eyebrow">{L('Pumpstösse', 'Pumps')}</span><strong class="mono">{playing && cur ? cur.k : 0} / {max}</strong></div>
      <div><span class="eyebrow">{L('Maximal', 'Top')}</span><strong class="mono">×{balloonMult(risk, max).toFixed(2)}</strong></div>
    </div>
    <p class="small muted">{L('Leertaste oder Tippen auf den Himmel pumpt, Enter zahlt aus, 1–3 oder Pfeiltasten wählen den Ballon. Ein voller Ballon steigt von allein auf. Ganz selten trifft der Bunker einen Ballon: das zahlt zehnfach.', 'Space or a tap on the sky pumps, Enter cashes out, 1–3 or the arrow keys pick the balloon. A full balloon lifts off on its own. Very rarely the bunker hits a balloon: that pays ten times.')}</p>
  {/snippet}

  <div class="sky" bind:this={sky} class:shake={bs.some((b) => b.phase === 'popped' || b.phase === 'shot')} role="presentation" onclick={tap} class:gunner onpointermove={point}
    onpointerdown={(e) => { if (gunner && e.button === 0) { point(e); skyArt?.hold(true); } }} onpointerup={() => skyArt?.hold(false)} onpointerleave={() => skyArt?.hold(false)} onpointercancel={() => skyArt?.hold(false)}>
    <BalloonSky bind:this={skyArt} {launch} {aim} {targets} onhit={hit} oncontrol={(on) => { gunner = on; if (!on) skyArt?.hold(false); }} />
    {#if gunner}
      <div class="gunhint" in:fly={{ y: -8 }}>
        <span>💥 {L('Bunker gekapert! Tippen schiesst, gedrückt halten für Dauerfeuer', 'Bunker taken over! Tap to fire, hold for rapid fire')}</span>
        <button class="btn sm" onclick={(e) => { e.stopPropagation(); skyArt?.exit(); }}>{L('Beenden', 'Leave')} · Esc</button>
      </div>
    {/if}
    <div class="hist">
      {#each history as h (h.id)}<span class="hc mono" class:ok={h.ok} class:shot={h.shot} in:fly={{ x: -16, duration: 260 }}>{h.shot ? '💥' : ''}×{h.m.toFixed(2)}</span>{/each}
    </div>

    {#each shown as b, i (b.id)}
      <div class="stage" class:sel={playing && i === sel && bs.length > 1} style="left:{((i + 1) / (shown.length + 1)) * 100}%; --k:{scaleFor}; --km:{[1, 0.62, 0.46][shown.length - 1]}">
        <div bind:this={els[i]} class="balloon" class:gone={b.phase === 'popped' || b.phase === 'shot'} class:flown={b.phase === 'flown'} style="--s:{bs.length ? size(b) : 0.32}; --c:{b.color}">
          <svg viewBox="0 0 200 260" aria-hidden="true">
            <defs>
              <radialGradient id="bshine" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".55" /><stop offset=".35" stop-color="#fff" stop-opacity="0" /></radialGradient>
              <radialGradient id="bshade" cx="50%" cy="45%" r="60%"><stop offset=".6" stop-color="#000" stop-opacity="0" /><stop offset="1" stop-color="#000" stop-opacity=".35" /></radialGradient>
            </defs>
            <path d="M100 6 C152 6 186 48 186 100 C186 156 140 200 104 214 L96 214 C60 200 14 156 14 100 C14 48 48 6 100 6Z" fill="var(--c)" />
            <path d="M100 6 C152 6 186 48 186 100 C186 156 140 200 104 214 L96 214 C60 200 14 156 14 100 C14 48 48 6 100 6Z" fill="url(#bshade)" />
            <path d="M100 6 C152 6 186 48 186 100 C186 156 140 200 104 214 L96 214 C60 200 14 156 14 100 C14 48 48 6 100 6Z" fill="url(#bshine)" />
            <ellipse cx="62" cy="58" rx="16" ry="26" fill="#fff" opacity=".35" transform="rotate(-25 62 58)" />
            <path d="M92 214 L108 214 L104 226 L96 226Z" fill="var(--c)" stroke="rgba(0,0,0,.25)" stroke-width="2" />
          </svg>
          {#if bs.length}<span class="m mono">×{(b.phase === 'popped' ? 0 : balloonMult(risk, b.k)).toFixed(2)}</span>{/if}
        </div>
        {#if b.phase === 'popped' || b.phase === 'shot'}
          <div class="pop" style="--c:{b.color}">
            {#each SHREDS as sh}<i style="--x:{Math.cos(sh.a) * sh.d}px; --y:{Math.sin(sh.a) * sh.d}px; --r:{sh.r}deg; --k:{sh.s}"></i>{/each}
            <b>{b.phase === 'shot' ? L('TREFFER!', 'HIT!') + (b.x === 10 ? ' ×10' : '') : 'POP!'}</b>
          </div>
        {/if}
        <!-- string from the knot down to the pump nozzle -->
        <svg class="string" viewBox="0 0 40 200" preserveAspectRatio="none" aria-hidden="true" class:loose={b.phase !== 'play'}>
          <path d="M20 0 C8 50 32 100 20 200" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="2" />
        </svg>
        <div class="pump">
          {#key b.push}<div class="handle"><i></i></div>{/key}
          <div class="barrel"><span class="mono">{b.phase === 'play' && bs.length ? b.k : ''}</span></div>
          <div class="foot"></div>
        </div>
      </div>
    {/each}

    {#if playing && cur?.phase === 'play' && cur.k > 0}
      <button class="btn skycash" disabled={cur.busy} onclick={(e) => { e.stopPropagation(); cashOut(); }}>{t('a.cashout')}{bs.length > 1 ? ' ' + (sel + 1) : ''} <span class="mono">{fmt(value(cur))}</span></button>
    {/if}
    {#if bs.length && !playing}
      <p class="result mono" class:pos={roundWon > 0} in:fly={{ y: 10 }}>{roundWon > 0 ? '+' + fmt(roundWon) : L('Geplatzt', 'Popped') + ' · 0'}</p>
    {/if}
  </div>
</ArcadeLayout>

<style>
  .big { min-height: 54px; width: 100%; font-size: 1rem; }
  .cash:not(:disabled) { background: #2fbf71; color: #062a16; border-color: transparent; }
  .row { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 6px; padding: 6px; border-radius: 14px; border: 1px solid var(--line); }
  .row.on { border-color: var(--accent); }
  .row.out { opacity: 0.6; }
  .who { display: flex; align-items: center; gap: 8px; border: 0; background: none; color: inherit; padding: 4px; text-align: left; }
  .who i { width: 14px; height: 18px; border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%; flex: none; }
  .cashall { width: 100%; background: #2fbf71; color: #062a16; border-color: transparent; }
  .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .stats div { background: var(--bg-2); border-radius: 14px; padding: 10px 12px; display: grid; gap: 4px; }
  .stats strong { font-size: 1.05rem; }
  .seg { display: flex; border: 1px solid var(--line-2); border-radius: 999px; padding: 3px; gap: 3px; }
  .seg button { flex: 1; border: 0; background: none; min-height: 36px; border-radius: 999px; color: var(--muted); }
  .seg button.on { background: var(--text); color: var(--bg); }
  .small { font-size: 0.8rem; margin: 0; }
  .muted { color: var(--muted); }

  .sky {
    position: relative; overflow: hidden; height: clamp(440px, 64vh, 620px); border-radius: 28px;
    background: linear-gradient(180deg, #5aa9f0 0%, #9fd2f7 55%, #d9efff 100%); box-shadow: 0 30px 60px -30px rgba(0,0,0,.6);
  }
  .sky.shake { animation: shake 0.4s; }
  @media (max-width: 860px) { .sky { height: clamp(320px, 50vh, 460px); } }
  .sky { cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent; }
  @keyframes shake { 20% { transform: translate(-6px, 3px); } 40% { transform: translate(5px, -4px); } 60% { transform: translate(-3px, 2px); } 80% { transform: translate(2px, -1px); } }

  .sky.gunner { cursor: crosshair; }
  .gunhint { position: absolute; left: 50%; bottom: 14px; translate: -50% 0; z-index: 6; display: flex; align-items: center; gap: 10px; padding: 6px 6px 6px 14px; border-radius: 999px;
    background: rgba(20,24,30,.78); color: #fff; font-size: 0.82rem; backdrop-filter: blur(6px); white-space: nowrap; max-width: calc(100% - 20px); }
  .gunhint span { overflow: hidden; text-overflow: ellipsis; }
  .hist { position: absolute; top: 14px; left: 14px; right: 170px; display: flex; gap: 6px; flex-wrap: wrap; z-index: 3; }
  .hc { padding: 4px 9px; border-radius: 999px; font-size: 0.75rem; background: rgba(20,24,40,.55); color: #ffb3b5; }
  .hc.ok { color: #8ff0bf; }
  .hc.shot { color: #ffd84a; }

  /* each balloon stands on its own pump; with several they shrink a little (--k) */
  .stage { position: absolute; bottom: 0; width: 260px; height: 100%; translate: -50% 0; scale: var(--k); transform-origin: 50% 100%; }
  @media (max-width: 600px) { .stage { scale: var(--km); } }
  .stage.sel .pump { filter: drop-shadow(0 0 8px rgba(255,255,255,.8)); }
  .balloon {
    position: absolute; left: 50%; bottom: 150px; width: 220px; translate: -50% 0; transform-origin: 50% 100%;
    transform: scale(var(--s)); transition: transform 0.28s cubic-bezier(.3, 1.6, .5, 1); z-index: 2;
    filter: drop-shadow(0 10px 18px rgba(20,40,80,.25));
  }
  .balloon svg { display: block; width: 100%; animation: sway 3s ease-in-out infinite; transform-origin: 50% 100%; }
  @keyframes sway { 50% { rotate: 2deg; } }
  .balloon .m { position: absolute; left: 50%; top: 38%; translate: -50% -50%; font-size: calc(1.5rem / max(var(--s), 0.8)); font-weight: 700; color: #fff; text-shadow: 0 2px 6px rgba(0,0,0,.35); white-space: nowrap; }
  .balloon.gone { opacity: 0; transform: scale(calc(var(--s) * 1.25)); transition: transform 0.08s, opacity 0.08s; }
  .balloon.flown { animation: away 2.4s cubic-bezier(.4, 0, .6, 1) forwards; }
  @keyframes away { to { transform: translate(60px, -720px) scale(var(--s)) rotate(8deg); } }
  .pop { position: absolute; left: 50%; bottom: 300px; z-index: 3; }
  .pop i { position: absolute; width: 16px; height: 10px; border-radius: 40% 60% 30% 70%; background: var(--c); animation: shred 0.9s cubic-bezier(.2, .7, .4, 1) forwards; }
  @keyframes shred { to { transform: translate(var(--x), calc(var(--y) + 120px)) rotate(var(--r)) scale(var(--k)); opacity: 0; } }
  .pop b { position: absolute; translate: -50% -50%; font: 800 3rem/1 'Geist Variable', sans-serif; color: #fff; -webkit-text-stroke: 2px #1c1c22; white-space: nowrap; animation: popword 0.9s cubic-bezier(.3, 1.6, .5, 1) both; }
  @keyframes popword { from { scale: 0.3; opacity: 0; } 30% { opacity: 1; } to { scale: 1.2; opacity: 0; } }
  .string { position: absolute; left: 50%; bottom: 96px; width: 20px; height: 58px; translate: -50% 0; z-index: 1; transition: opacity 0.3s; }
  .string.loose { opacity: 0; }
  .pump { position: absolute; left: 50%; bottom: 18px; translate: -50% 0; width: 70px; height: 96px; transition: filter 0.2s; }
  .barrel { position: absolute; left: 13px; bottom: 10px; width: 44px; height: 62px; border-radius: 10px 10px 4px 4px; background: linear-gradient(90deg, #c33a3a, #e8584f 40%, #a82a2a); box-shadow: inset 0 -6px 0 rgba(0,0,0,.2); display: grid; place-items: center; }
  .barrel span { color: #fff; font-size: 0.9rem; font-weight: 700; }
  .foot { position: absolute; left: 0; bottom: 0; width: 70px; height: 12px; border-radius: 6px; background: #3a3f4a; }
  .handle { position: absolute; left: 50%; bottom: 66px; translate: -50% 0; width: 6px; height: 30px; background: #9aa0aa; animation: press 0.26s ease-in-out; }
  .handle i { position: absolute; left: -22px; top: -8px; width: 50px; height: 10px; border-radius: 5px; background: #2a2e37; }
  @keyframes press { 50% { transform: translateY(20px); } }
  .skycash { position: absolute; right: 14px; top: 12px; z-index: 5; background: #2fbf71; color: #062a16; border-color: transparent; font-weight: 600; }
  .result { position: absolute; left: 50%; top: 16%; translate: -50% 0; margin: 0; font-size: 2rem; font-weight: 700; color: #b02a2a; text-shadow: 0 2px 0 #fff; z-index: 4; }
  .result.pos { color: #1c8a52; }
</style>
