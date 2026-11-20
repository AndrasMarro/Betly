<script lang="ts">
  // Classic 2048. Free to play, or with a stake: the biggest tile sets the cash-out multiplier,
  // and a full board with no move left loses the stake.
  import { onDestroy } from 'svelte';
  import ArcadeLayout from '../components/ArcadeLayout.svelte';
  import BetInput from '../components/BetInput.svelte';
  import { SIZE, newBoard, slide, spawn, top, canMove, multFor, TIERS, type Tile, type Dir } from '../games/g2048';
  import { wallet, settle, stake as takeStake, fmt, settings } from '../lib/state.svelte';
  import { gameName, byId } from '../lib/games';
  import { sfx } from '../lib/sfx';

  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
  const saved = (() => { try { return JSON.parse(localStorage.getItem('betly:2048') || '{}'); } catch { return {}; } })();
  let best = $state<number>(saved.best ?? 0);
  let bestTile = $state<number>(saved.bestTile ?? 0);
  let paid = $state<boolean>(saved.paid ?? false);
  let bet = $state(10);
  $effect(() => { try { localStorage.setItem('betly:2048', JSON.stringify({ best, bestTile, paid })); } catch {} });

  let tiles = $state<Tile[]>([]);
  let score = $state(0);
  let phase = $state<'idle' | 'play' | 'over'>('idle');
  let staked = $state(0);
  let result = $state<{ win: number; cashed: boolean } | null>(null);
  const big = $derived(top(tiles));
  const mult = $derived(multFor(big));
  const win = $derived(Math.round(staked * mult * 100) / 100);
  let cleanup: ReturnType<typeof setTimeout> | undefined;

  function start() {
    if (phase === 'play' && staked) return;
    if (paid && bet > wallet.balance) return;
    staked = paid ? bet : 0;
    if (staked) takeStake(staked);
    tiles = newBoard();
    score = 0; result = null;
    phase = 'play';
    sfx('chip');
  }
  function end(cashed: boolean) {
    const w = cashed ? win : 0;
    if (staked) settle(w, w);
    result = { win: w, cashed };
    phase = 'over';
    staked = 0;
    sfx(cashed && w ? 'cash' : 'lose');
  }
  function move(d: Dir) {
    if (phase !== 'play') return;
    const r = slide(tiles, d);
    if (!r.moved) return;
    const before = big;
    tiles = spawn(r.tiles);
    score += r.gained;
    best = Math.max(best, score);
    bestTile = Math.max(bestTile, top(tiles));
    sfx(r.gained ? (top(tiles) > before && top(tiles) >= 128 ? 'gem' : 'bounce') : 'click');
    // merged pairs disappear once they have slid onto their target
    clearTimeout(cleanup);
    cleanup = setTimeout(() => (tiles = tiles.filter((t) => !t.gone)), 130);
    if (!canMove(tiles)) setTimeout(() => end(false), 500);
  }
  onDestroy(() => { clearTimeout(cleanup); if (phase === 'play' && staked) settle(0, 0); });

  function key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    const d = ({ ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' } as Record<string, Dir>)[e.key];
    if (d) { e.preventDefault(); move(d); }
    else if (e.code === 'Space' && phase !== 'play') { e.preventDefault(); start(); }
  }
  // swipes on touch screens
  let touch: { x: number; y: number } | null = null;
  const down = (e: PointerEvent) => { touch = { x: e.clientX, y: e.clientY }; };
  function up(e: PointerEvent) {
    if (!touch) return;
    const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
    touch = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  }
  const next = $derived(TIERS.find(([t]) => t > big));
</script>

<svelte:window onkeydown={key} />

<ArcadeLayout eyebrow={'Arcade · ' + L('Klassisch', 'Classic')} title={gameName(byId('g2048')!)}>
  {#snippet controls()}
    {#if phase === 'play' && staked}
      <button class="btn primary big" disabled={!mult} onclick={() => end(true)}>{L('Auszahlen', 'Cash out')} <span class="mono">{fmt(win)}</span></button>
    {:else}
      <button class="btn primary big" disabled={paid && bet > wallet.balance} onclick={start}>{phase === 'idle' ? L('Spiel starten', 'Start game') : L('Neues Spiel', 'New game')}</button>
    {/if}
    <label class="switch"><span>{L('Mit Einsatz', 'With stake')}</span><input type="checkbox" bind:checked={paid} disabled={phase === 'play'} /></label>
    {#if paid}
      <BetInput bind:value={bet} disabled={phase === 'play'} />
      <div class="tiers">{#each TIERS as [t, m]}<span class:on={big >= t}><b>{t}</b>×{m}</span>{/each}</div>
      <p class="small muted">{L('Ab 128 kannst du jederzeit auszahlen; die grösste Kachel bestimmt den Multiplikator. Geht nichts mehr, ist der Einsatz weg.', 'From 128 on you can cash out any time; the biggest tile sets the multiplier. If no move is left, the stake is lost.')}</p>
    {:else}
      <p class="small muted">{L('Pfeiltasten, WASD oder wischen. Gleiche Zahlen verschmelzen. Schaffst du die 2048?', 'Arrow keys, WASD or swipe. Equal numbers merge. Can you reach 2048?')}</p>
    {/if}
  {/snippet}

  <div class="wrap2048">
    <div class="stats">
      <span><small>{L('Punkte', 'Score')}</small><b class="mono">{score}</b></span>
      <span><small>{L('Rekord', 'Best')}</small><b class="mono">{best}</b></span>
      <span><small>{L('Grösste', 'Biggest')}</small><b class="mono">{big || '–'}</b></span>
      {#if staked}<span class="gold"><small>{next ? L('Nächste Stufe', 'Next tier') + ' ' + next[0] : 'Max'}</small><b class="mono">×{mult || '–'}</b></span>{/if}
    </div>
    <div class="board" role="application" aria-label="2048" onpointerdown={down} onpointerup={up}>
      {#each Array(SIZE * SIZE) as _}<i class="cell"></i>{/each}
      {#each tiles as t (t.id)}
        <div class="tile v{Math.min(t.v, 8192)}" class:merged={t.merged} class:fresh={t.fresh} class:small={t.v >= 1024} style="--x:{t.x}; --y:{t.y}">{t.v}</div>
      {/each}
      {#if phase !== 'play'}
        <div class="over">
          {#if result}<strong>{result.cashed ? L('Ausgezahlt', 'Cashed out') : L('Keine Züge mehr', 'No moves left')}</strong>{#if result.win}<span class="mono pos">+{fmt(result.win)}</span>{/if}<span class="muted">{score} {L('Punkte', 'points')}</span>
          {:else}<strong>2048</strong><span class="muted">{L('Leertaste oder Start', 'Space or start')}</span>{/if}
          <button class="btn primary" onclick={start} disabled={paid && bet > wallet.balance}>{result ? L('Nochmal', 'Again') : L('Start', 'Start')}</button>
        </div>
      {/if}
    </div>
  </div>
</ArcadeLayout>

<style>
  .big { min-height: 54px; width: 100%; font-size: 1rem; }
  .small { font-size: 0.8rem; margin: 0; } .muted { color: var(--muted); }
  .pos { color: #6ff0a6; }
  .tiers { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
  .tiers span { display: grid; justify-items: center; padding: 4px 0; border-radius: 8px; background: var(--surface-2); font: 600 0.72rem 'Geist Mono Variable', monospace; color: var(--muted); }
  .tiers span b { color: var(--text); font-size: 0.78rem; }
  .tiers span.on { background: color-mix(in srgb, var(--gold) 30%, transparent); color: var(--text); }

  .wrap2048 { display: grid; gap: 14px; justify-items: center; padding: clamp(14px, 3vw, 28px); border-radius: 28px; background: radial-gradient(ellipse at 50% 0%, #2a2140, #120e1c 75%); }
  .stats { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .stats span { display: grid; justify-items: center; min-width: 84px; padding: 6px 12px; border-radius: 12px; background: rgba(255,255,255,.06); color: #f4eedd; }
  .stats small { font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(244,238,221,.55); }
  .stats b { font-size: 1.2rem; }
  .stats .gold { background: rgba(232,196,120,.18); }
  .board {
    --gap: clamp(8px, 1.8vw, 14px); --cell: calc((min(100%, 480px) - var(--gap) * 5) / 4);
    position: relative; width: min(100%, 480px); aspect-ratio: 1; padding: var(--gap); border-radius: 18px; touch-action: none; user-select: none;
    display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--gap); background: #3a3150; box-shadow: inset 0 0 0 2px rgba(232,196,120,.25);
  }
  .cell { border-radius: 10px; background: rgba(255,255,255,.07); }
  .tile {
    --step: calc((100% - var(--gap)) / 4);
    position: absolute; left: var(--gap); top: var(--gap); width: calc(var(--step) - var(--gap)); height: calc(var(--step) - var(--gap));
    translate: calc(var(--x) * (100% + var(--gap))) calc(var(--y) * (100% + var(--gap)));
    display: grid; place-items: center; border-radius: 10px; font: 800 clamp(1.3rem, 4.6vw, 2.2rem) 'Geist Variable', sans-serif; color: #2b2238;
    transition: translate 110ms ease-out; box-shadow: inset 0 -4px 0 rgba(0,0,0,.12);
  }
  .tile.small { font-size: clamp(1rem, 3.6vw, 1.7rem); }
  .tile.fresh { animation: appear 0.2s 0.1s backwards var(--spring-snappy); }
  .tile.merged { animation: pop 0.22s 0.1s backwards var(--spring-snappy); z-index: 1; }
  @keyframes appear { from { transform: scale(0); } }
  @keyframes pop { from { transform: scale(0.6); } 60% { transform: scale(1.15); } }
  .v2 { background: #f1ead9; } .v4 { background: #ecdfc0; }
  .v8 { background: #f2b179; color: #fff; } .v16 { background: #f59563; color: #fff; } .v32 { background: #f67c5f; color: #fff; } .v64 { background: #e8493c; color: #fff; }
  .v128 { background: #edcf72; color: #fff; box-shadow: 0 0 18px rgba(237,207,114,.35); } .v256 { background: #edcc61; color: #fff; box-shadow: 0 0 22px rgba(237,204,97,.45); }
  .v512 { background: #e8bb3c; color: #fff; box-shadow: 0 0 26px rgba(232,187,60,.5); } .v1024 { background: #d8a02a; color: #fff; box-shadow: 0 0 30px rgba(216,160,42,.55); }
  .v2048 { background: linear-gradient(135deg, #f6d88e, #c9973f); color: #fff; box-shadow: 0 0 36px rgba(246,216,142,.7); }
  .v4096, .v8192 { background: linear-gradient(135deg, #7a3fd0, #3d1a7a); color: #fff; box-shadow: 0 0 36px rgba(140,90,255,.6); }
  .over { position: absolute; inset: 0; border-radius: 18px; display: grid; place-content: center; justify-items: center; gap: 8px; background: rgba(18,14,28,.72); backdrop-filter: blur(3px); color: #f4eedd; z-index: 3; text-align: center; }
  .over strong { font-size: 1.6rem; }
  .over .mono { font-size: 1.4rem; font-weight: 700; }
</style>
