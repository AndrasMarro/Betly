<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import ArcadeLayout from '../components/ArcadeLayout.svelte';
  import BetInput from '../components/BetInput.svelte';
  import Sprite from '../components/Sprite.svelte';
  import { LEVELS, newGame, open, chord, flag, neighbours, type MS, type MsLevel } from '../games/minesweeper';
  import { wallet, settle, stake, fmt } from '../lib/state.svelte';
  import { sfx } from '../lib/sfx';
  import { pop } from '../lib/motion';
  import { t, type Key } from '../lib/i18n';

  const PAYS: Record<MsLevel, number> = { easy: 1.3, medium: 3, hard: 10 };
  let level = $state<MsLevel>('easy');
  let ms = $state<MS>(newGame(9, 9, 10));
  let touch = $state(false);
  let portrait = $state(false);
  let mode = $state<'dig' | 'flag'>('dig');
  let wager = $state(false);
  let bet = $state(10);
  let staked = $state(0);
  let t0 = 0;
  let secs = $state(0);
  let best = $state<Record<string, number>>({});
  let timer: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    touch = matchMedia('(pointer: coarse)').matches;
    portrait = matchMedia('(max-width: 640px)').matches;
    try { best = JSON.parse(localStorage.getItem('betly:ms-best') || '{}'); } catch {}
    reset();
  });
  onDestroy(() => clearInterval(timer));

  function reset() {
    clearInterval(timer);
    let [w, h, m]: number[] = [...LEVELS[level]];
    if (portrait && w > h) [w, h] = [h, w]; // tall board on phones
    ms = newGame(w, h, m);
    secs = 0;
    staked = 0;
  }
  $effect(() => { void level; reset(); });

  const flags = $derived(ms.cells.filter((c) => c.flag).length);
  const done = $derived(ms.state === 'won' || ms.state === 'lost');

  function begin() {
    t0 = performance.now();
    timer = setInterval(() => (secs = Math.floor((performance.now() - t0) / 1000)), 250);
    if (wager && bet <= wallet.balance && bet > 0) { staked = bet; stake(bet); }
  }
  function finish() {
    clearInterval(timer);
    secs = Math.floor((performance.now() - t0) / 1000);
    if (ms.state === 'won') {
      const prev = best[level];
      if (!prev || secs < prev) { best = { ...best, [level]: secs }; try { localStorage.setItem('betly:ms-best', JSON.stringify(best)); } catch {} }
      if (staked) { const win = Math.round(staked * PAYS[level] * 100) / 100; settle(win, win); }
      sfx('big');
    } else {
      if (staked) settle(0, 0);
      sfx('boom');
    }
  }

  function dig(i: number) {
    const wasReady = ms.state === 'ready';
    const c = ms.cells[i];
    if (c.open) { if (chord(ms, i)) sfx('gem'); }
    else if (!c.flag) { open(ms, i); sfx(ms.state === 'lost' ? 'boom' : 'tick'); }
    if (wasReady && ms.state !== 'ready') begin();
    if (ms.state === 'won' || ms.state === 'lost') finish();
  }
  function mark(i: number) {
    if (flag(ms, i)) { sfx('chip'); navigator.vibrate?.(18); }
  }

  // ---------- input: mouse = left dig / right flag; touch = tap + long press ----------
  let press: { i: number; x: number; y: number; timer: ReturnType<typeof setTimeout>; fired: boolean } | null = null;
  let pressing = $state(-1);
  const cellOf = (e: Event) => Number((e.target as HTMLElement).closest<HTMLElement>('[data-i]')?.dataset.i ?? -1);

  function down(e: PointerEvent) {
    const i = cellOf(e);
    if (i < 0 || done) return;
    if (e.pointerType === 'mouse') return; // mouse handled on click / contextmenu
    pressing = i;
    press = {
      i, x: e.clientX, y: e.clientY, fired: false,
      timer: setTimeout(() => {
        if (!press) return;
        press.fired = true;
        pressing = -1;
        mode === 'dig' ? mark(i) : dig(i);
      }, 380),
    };
  }
  function move(e: PointerEvent) {
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) cancel();
  }
  function cancel() {
    if (press) clearTimeout(press.timer);
    press = null;
    pressing = -1;
  }
  function up(e: PointerEvent) {
    if (e.pointerType === 'mouse') return;
    if (!press) return;
    const { i, fired } = press;
    cancel();
    if (!fired) (mode === 'dig' ? dig(i) : ms.cells[i].open ? dig(i) : mark(i));
  }
  function click(e: MouseEvent) {
    const pt = (e as PointerEvent).pointerType;
    if (pt ? pt !== 'mouse' : touch) return; // touch taps are handled by pointerup
    const i = cellOf(e);
    if (i >= 0 && !done) dig(i);
  }
  function context(e: MouseEvent) {
    e.preventDefault();
    const i = cellOf(e);
    if (i >= 0 && !done && !touch) mark(i);
  }

  const lostDist = (i: number) => {
    if (ms.hit < 0) return 0;
    const dx = (i % ms.w) - (ms.hit % ms.w), dy = Math.floor(i / ms.w) - Math.floor(ms.hit / ms.w);
    return Math.hypot(dx, dy);
  };
  const mm = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  void neighbours;
</script>

<ArcadeLayout eyebrow="Arcade · {ms.w}×{ms.h} · {ms.mines}" title="Minesweeper">
  {#snippet controls()}
    <button class="btn primary big" onclick={reset}>{t('ms.new')}</button>
    <div class="field">{t('tw.level')}
      <div class="seg">
        {#each Object.keys(LEVELS) as l}
          <button class:on={level === l} onclick={() => (level = l as MsLevel)}>{t(('ms.' + l) as Key)}</button>
        {/each}
      </div>
    </div>
    <label class="switch"><span>{t('ms.wager')} <em class="mono">×{PAYS[level]}</em></span><input type="checkbox" bind:checked={wager} disabled={ms.state === 'play'} /></label>
    {#if wager}<BetInput bind:value={bet} disabled={ms.state === 'play'} />{/if}
    <div class="howto">
      <p class="eyebrow">{t('ms.howto')}</p>
      {#if touch}
        <p>{t('ms.touch1')}</p><p>{t('ms.touch2')}</p><p>{t('ms.touch3')}</p>
      {:else}
        <p>{t('ms.mouse1')}</p><p>{t('ms.mouse2')}</p><p>{t('ms.mouse3')}</p>
      {/if}
    </div>
    {#if best[level]}<p class="muted small">{t('ms.best')}: <span class="mono">{mm(best[level])}</span></p>{/if}
  {/snippet}

  <div class="frame">
    <div class="hud">
      <span class="mono chip-stat"><span class="ico"><Sprite kind="bomb" /></span>{ms.mines - flags}</span>
      {#if touch}
        <div class="mode" role="group" aria-label="Mode">
          <button class:on={mode === 'dig'} onclick={() => (mode = 'dig')}>{t('ms.dig')}</button>
          <button class:on={mode === 'flag'} onclick={() => (mode = 'flag')}>{t('ms.flag')}</button>
        </div>
      {/if}
      <span class="mono chip-stat">{mm(secs)}</span>
    </div>
    <div class="scroll">
      <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
      <div
        class="board"
        class:lost={ms.state === 'lost'}
        class:won={ms.state === 'won'}
        style="--w:{ms.w}"
        onpointerdown={down}
        onpointermove={move}
        onpointerup={up}
        onpointercancel={cancel}
        onclick={click}
        oncontextmenu={context}>
        {#each ms.cells as c, i}
          {@const showMine = c.mine && (ms.state === 'lost')}
          <button
            class="cell n{c.n}"
            class:open={c.open}
            class:flag={c.flag && !c.open}
            class:mine={showMine}
            class:hit={ms.hit === i}
            class:wrong={ms.state === 'lost' && c.flag && !c.mine}
            class:pressing={pressing === i}
            style="--d:{c.open ? Math.min(c.d, 30) : showMine ? Math.min(lostDist(i) * 1.6, 40) : 0}"
            data-i={i}
            aria-label={c.open ? String(c.n || '') : c.flag ? 'flag' : 'hidden'}
            tabindex="-1">
            {#if c.open && !c.mine && c.n}{c.n}{/if}
            {#if showMine}<span class="ico"><Sprite kind="bomb" /></span>{/if}
            {#if c.flag && !c.open && !showMine}<span class="fl" in:pop={{ duration: 380 }}></span>{/if}
          </button>
        {/each}
      </div>
    </div>
    {#if done}
      <div class="banner" class:lose={ms.state === 'lost'} in:pop>
        {ms.state === 'won' ? t('ms.won') + ' · ' + mm(secs) : t('mn.boom')}
        {#if staked && ms.state === 'won'}<span class="mono"> · +{fmt(Math.round(staked * PAYS[level] * 100) / 100)}</span>{/if}
      </div>
    {/if}
  </div>
</ArcadeLayout>

<style>
  .big { min-height: 54px; width: 100%; font-size: 1rem; }
  .seg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .seg button { min-height: 38px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--bg-2); font-size: 0.85rem; transition: background-color 0.25s var(--ease-snap), color 0.25s var(--ease-snap), transform 0.16s var(--ease-snap); }
  .seg button.on { background: var(--text); color: var(--bg); }
  .seg button:active { transform: scale(0.97); }
  .switch em { font-style: normal; color: var(--muted); font-size: 0.8rem; }
  .howto { background: var(--bg-2); border-radius: 14px; padding: 12px 14px; font-size: 0.84rem; }
  .howto p { margin: 0 0 6px; }
  .howto p:last-child { margin: 0; }
  .muted { color: var(--muted); } .small { font-size: 0.82rem; margin: 0; }

  .frame { position: relative; border-radius: 28px; background: radial-gradient(ellipse at 50% 0%, #1f2a3d, #0b111b 75%); box-shadow: 0 30px 60px -30px rgba(0,0,0,.6); padding: clamp(10px, 2vw, 22px); }
  .hud { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 12px; color: #f4f2ee; }
  .chip-stat { display: inline-flex; align-items: center; gap: 8px; min-width: 76px; justify-content: center; padding: 6px 12px; border-radius: 999px; background: rgba(0,0,0,.35); font-size: 1rem; }
  .chip-stat .ico { width: 18px; height: 18px; }
  .mode { display: flex; padding: 3px; border-radius: 999px; background: rgba(0,0,0,.35); }
  .mode button { border: 0; background: none; color: rgba(255,255,255,.7); min-height: 36px; padding: 0 14px; border-radius: 999px; font-size: 0.85rem; transition: background-color 0.25s var(--ease-snap), color 0.25s var(--ease-snap); }
  .mode button.on { background: #f4f2ee; color: #0b111b; }
  .scroll { overflow: auto; max-height: 72vh; border-radius: 14px; }
  .board {
    --cell: clamp(26px, min(calc((100vw - 64px) / var(--w)), 4.2vw), 40px);
    display: grid; grid-template-columns: repeat(var(--w), var(--cell)); gap: 3px; width: max-content; margin: 0 auto;
    user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: manipulation;
  }
  .board.lost { animation: shake 0.45s var(--ease-snap); }
  @keyframes shake { 20% { transform: translateX(-6px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(2px); } }
  .cell {
    position: relative; width: var(--cell); height: var(--cell); padding: 0; border: 0; border-radius: 7px; display: grid; place-items: center;
    background: linear-gradient(180deg, #3a4a68, #2d3a54); box-shadow: inset 0 -3px 0 rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.08);
    font: 800 calc(var(--cell) * 0.5) / 1 'Geist Mono Variable', monospace; color: #fff; cursor: pointer;
    transition: background-color 0.2s var(--ease-snap), transform 0.16s var(--ease-snap);
  }
  @media (hover: hover) and (pointer: fine) { .cell:not(.open):hover { background: linear-gradient(180deg, #46597d, #35445f); } }
  .cell:not(.open):active { transform: scale(0.94); }
  .cell.open { background: #141b29; box-shadow: inset 0 0 0 1px rgba(255,255,255,.04); cursor: default; animation: reveal 0.4s var(--spring-snappy) both; animation-delay: calc(var(--d) * 18ms); }
  @keyframes reveal { from { transform: scale(0.9); opacity: 0; } }
  .n1 { color: #6aa8ff; } .n2 { color: #4fe3a0; } .n3 { color: #ff6b6f; } .n4 { color: #b57bff; }
  .n5 { color: #ffb02e; } .n6 { color: #54d8f0; } .n7 { color: #f4f2ee; } .n8 { color: #9aa0ad; }
  .fl { position: absolute; left: 30%; top: 22%; width: 42%; height: 30%; background: #e5484d; clip-path: polygon(0 0, 100% 50%, 0 100%); }
  .fl::after { content: ''; position: absolute; left: 0; top: 0; width: 2px; height: calc(var(--cell) * 0.5); background: #f4f2ee; }
  .cell.mine { background: #2a1418; animation: reveal 0.45s var(--spring-snappy) both; animation-delay: calc(var(--d) * 22ms); }
  .cell.mine .ico { width: 70%; height: 70%; }
  .cell.hit { background: #8e1b22; box-shadow: 0 0 0 2px #e5484d; }
  .cell.wrong { background: #3a2a10; }
  .cell.wrong::after { content: '×'; position: absolute; color: #ffb02e; font-size: calc(var(--cell) * 0.6); }
  .cell.pressing::before { content: ''; position: absolute; inset: -3px; border-radius: 9px; border: 2px solid #f2c046; animation: hold 0.38s linear both; }
  @keyframes hold { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
  .board.won .cell.open { animation: wave 0.9s var(--ease-snap) both; animation-delay: calc(var(--d) * 12ms); }
  @keyframes wave { 40% { background: #1f5c43; } }
  .banner {
    position: absolute; left: 50%; bottom: 22px; translate: -50% 0; padding: 12px 22px; border-radius: 999px; z-index: 5; white-space: nowrap;
    background: #10151f; color: #8ff0bf; font: 700 1.05rem 'Geist Mono Variable', monospace; box-shadow: 0 0 0 2px #2fbf71, 0 20px 50px rgba(0,0,0,.6);
  }
  .banner.lose { color: #ff9a9d; box-shadow: 0 0 0 2px #e5484d, 0 20px 50px rgba(0,0,0,.6); }
  @media (prefers-reduced-motion: reduce) { .cell.open, .cell.mine { animation: none; } }
</style>
