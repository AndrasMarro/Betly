<script lang="ts">
  // One 10 × 10 sea: shots (water, hit, sunk), visible ships (own fleet, a partner's, every sunk one),
  // and while placing a preview ship. Cells are buttons when the board can be fired at.
  // The latest shot plays an impact: rings running out over the water, spray, and on a hit a flash and smoke.
  import Warship from './Warship.svelte';
  import { N, cellsOf, type Ship, type Intel } from '../games/ships';
  // wrecks: the sunk ships when known exactly (side-by-side fleets); otherwise they are read from the sunk cells.
  // mines: own mines to show; intel: sonar and direction-finder readings; zone: cells to highlight while aiming.
  let { shots = '', ships = [], fire, preview = null, previewOk = true, hover, pick, shot = null, cell = 32, dim = false, label = '', wrecks, mines = [], intel = [], zone = [] }: {
    shots?: string; ships?: Ship[]; fire?: (c: number) => void; preview?: Ship | null; previewOk?: boolean;
    hover?: (c: number) => void; pick?: (c: number) => void; shot?: { cell: number; res: string; n: number } | null; cell?: number; dim?: boolean; label?: string;
    wrecks?: Ship[]; mines?: number[]; intel?: Intel[]; zone?: number[];
  } = $props();
  const at = (c: number) => +(shots[c] ?? 0);
  const zoned = $derived(new Set(zone));
  // sunk ships show their hull: the given wrecks, or the runs of sunk cells
  const sunk = $derived.by(() => {
    if (wrecks) return wrecks;
    const out: Ship[] = [], seen = new Set<number>();
    for (let c = 0; c < N * N; c++) {
      if (at(c) !== 3 || seen.has(c)) continue;
      const v = c + N < N * N && at(c + N) === 3;
      let len = 0;
      while (len < 6) { const k = v ? c + len * N : c + len; if (k >= N * N || at(k) !== 3 || (!v && Math.floor(k / N) !== Math.floor(c / N))) break; seen.add(k); len++; }
      out.push({ len, x: c % N, y: Math.floor(c / N), v });
    }
    return out;
  });
  const own = $derived(ships.filter((s) => !sunk.some((k) => k.x === s.x && k.y === s.y && k.v === s.v)));
  const canShoot = (v: number) => v === 0 || v === 4;
  const prev = $derived(preview ? new Set(cellsOf(preview).filter((c) => c >= 0 && c < N * N)) : new Set<number>());
  const COLS = 'ABCDEFGHIJ';
  const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
</script>

<div class="sea" class:dim class:armed={!!fire} style="--cell:{cell}px" aria-label={label}>
  <div class="cols">{#each COLS as l}<span>{l}</span>{/each}</div>
  <div class="rows">{#each Array(N) as _, i}<span>{i + 1}</span>{/each}</div>
  <div class="grid" role="presentation" onpointerleave={() => hover?.(-1)}>
    <div class="waves" aria-hidden="true"></div>
    {#each Array(N * N) as _, c}
      {@const v = at(c)}
      <button class="c" class:w={v === 1 || v === 5} class:h={v === 2} class:s={v === 3} class:dent={v === 4} class:pv={prev.has(c)} class:bad={prev.has(c) && !previewOk} class:zone={zoned.has(c)}
        disabled={!fire && !pick && !hover} tabindex={fire && canShoot(v) ? 0 : -1}
        onpointerenter={() => hover?.(c)} onclick={() => (fire && canShoot(v) ? fire(c) : pick?.(c))} aria-label={COLS[c % N] + (Math.floor(c / N) + 1)}>
        {#if v === 1}<i class="drop" class:fresh={shot?.cell === c}></i>
        {:else if v === 5}<i class="mine boom" class:fresh={shot?.cell === c}></i>
        {:else if v === 4}<i class="spark" class:fresh={shot?.cell === c}></i>
        {:else if v >= 2}<i class="fire" class:fresh={shot?.cell === c}><i class="core"></i></i>
        {:else if mines.includes(c)}<i class="mine"></i>{/if}
      </button>
    {/each}
    {#each [...own.map((s) => ({ s, k: 'own' })), ...sunk.map((s) => ({ s, k: 'sunk' }))] as { s, k } (k + s.x + '-' + s.y + s.v)}
      <span class="hull {k}" class:v={s.v} style="--x:{s.x}; --y:{s.y}; --len:{s.len}"><span class="rot"><Warship len={s.len} k={s.k} sunk={k === 'sunk'} /></span></span>
    {/each}
    {#each intel as it}
      {#if it.w === 'sonar'}<span class="sonar" style="--x:{it.c % N}; --y:{Math.floor(it.c / N)}"><b>{it.n}</b></span>
      {:else}<span class="peil row" style="--y:{Math.floor(it.c / N)}"><b>{it.n}</b></span><span class="peil col" style="--x:{it.c % N}"><b>{it.m}</b></span>{/if}
    {/each}
    {#if shot && shot.cell >= 0 && !still}
      {#key shot.n}
        <span class="fx {shot.res}" style="--x:{shot.cell % N}; --y:{Math.floor(shot.cell / N)}" aria-hidden="true">
          <i class="ring r1"></i><i class="ring r2"></i><i class="ring r3"></i>
          {#each Array(10) as _, k}<b style="--a:{k * 36 + (k % 2) * 14}deg; --d:{0.55 + (k % 3) * 0.25}"></b>{/each}
          {#if shot.res !== 'water' && shot.res !== 'scan'}<em class="flash"></em><em class="smoke s1"></em><em class="smoke s2"></em>{/if}
        </span>
      {/key}
    {/if}
  </div>
</div>

<style>
  .sea { display: grid; grid-template-columns: calc(var(--cell) * 0.6) auto; grid-template-rows: calc(var(--cell) * 0.6) auto; user-select: none; }
  .cols { grid-column: 2; display: grid; grid-template-columns: repeat(10, var(--cell)); }
  .rows { grid-row: 2; display: grid; grid-template-rows: repeat(10, var(--cell)); }
  .cols span, .rows span { display: grid; place-items: center; font: 600 calc(var(--cell) * 0.32) 'Geist Mono Variable', monospace; color: rgba(220,235,255,.5); }
  .grid {
    position: relative; display: grid; grid-template-columns: repeat(10, var(--cell)); grid-template-rows: repeat(10, var(--cell)); border-radius: 8px; overflow: hidden; isolation: isolate;
    background: radial-gradient(ellipse at 30% 20%, rgba(120,200,255,.2), transparent 60%), linear-gradient(160deg, #11496f, #072038);
    box-shadow: inset 0 0 0 1px rgba(150,210,255,.25), inset 0 0 40px rgba(0,0,0,.35), 0 14px 30px -14px rgba(0,0,0,.7);
  }
  /* slow swell over the water */
  .waves {
    position: absolute; inset: -50%; z-index: 0; pointer-events: none; opacity: 0.55;
    background: repeating-radial-gradient(ellipse at 40% 60%, rgba(255,255,255,.05) 0 2px, transparent 3px 16px), repeating-linear-gradient(115deg, rgba(150,220,255,.05) 0 1px, transparent 1px 22px);
    animation: swell 26s linear infinite;
  }
  @keyframes swell { to { transform: translate(18%, 9%); } }
  .dim .grid { filter: saturate(0.6) brightness(0.8); }
  .c { position: relative; z-index: 1; padding: 0; border: 0; background: none; box-shadow: inset 0 0 0 0.5px rgba(150,210,255,.15); display: grid; place-items: center; }
  .armed .c:not(.w):not(.h):not(.s) { cursor: crosshair; }
  @media (hover: hover) and (pointer: fine) {
    .armed .c:not(.w):not(.h):not(.s):not(.zone):hover { background: radial-gradient(circle, transparent 38%, rgba(255,214,120,.9) 40% 46%, transparent 48%), rgba(255,214,120,.12); box-shadow: inset 0 0 0 1.5px rgba(255,214,120,.8); }
  }
  .c:disabled { cursor: default; }
  .c.pv { background: rgba(120,255,190,.32); }
  .c.bad { background: rgba(255,90,90,.35); }
  /* every marker is decoration only: clicks always reach the cell underneath */
  .drop, .fire, .hull, .fx, .fx *, .mine, .spark, .sonar, .peil { pointer-events: none; }
  .c.zone { background: rgba(255,214,120,.22); box-shadow: inset 0 0 0 1px rgba(255,214,120,.7); }
  /* a sea mine: dark ball with horns; once it went off, a scorched ring */
  .mine { width: 46%; aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #6b7380, #20252c 70%); box-shadow: 0 0 0 2px rgba(0,0,0,.3), 0 -4px 0 -2px #20252c, 0 4px 0 -2px #20252c, -4px 0 0 -2px #20252c, 4px 0 0 -2px #20252c; }
  .mine.boom { background: radial-gradient(circle, #ffb36b, #8a2a12 55%, transparent 72%); box-shadow: 0 0 10px rgba(255,120,40,.6); width: 62%; }
  .mine.fresh { animation: plop 0.5s var(--spring-snappy); }
  /* armour took one hit: sparks, shoot again to get through */
  .spark { width: 46%; aspect-ratio: 1; background: conic-gradient(from 0deg, #ffe9a8 0 8%, transparent 8% 25%, #ffe9a8 25% 33%, transparent 33% 50%, #ffe9a8 50% 58%, transparent 58% 75%, #ffe9a8 75% 83%, transparent 83%); border-radius: 50%; filter: drop-shadow(0 0 4px #ffcf6a); animation: spin 3s linear infinite; }
  .c.dent { background: rgba(255,207,106,.12); }
  @keyframes spin { to { rotate: 360deg; } }
  .sonar { position: absolute; z-index: 4; left: calc((var(--x) - 1) * var(--cell)); top: calc((var(--y) - 1) * var(--cell)); width: calc(3 * var(--cell)); height: calc(3 * var(--cell)); border-radius: 50%; border: 1.5px dashed rgba(120,255,220,.75); background: radial-gradient(circle, rgba(120,255,220,.14), transparent 70%); display: grid; place-items: center; animation: ping 0.8s var(--spring-snappy); }
  .sonar b, .peil b { font: 700 calc(var(--cell) * 0.45) 'Geist Mono Variable', monospace; color: #b9fff0; text-shadow: 0 0 6px rgba(0,0,0,.8); }
  @keyframes ping { from { transform: scale(0.3); opacity: 0; } }
  .peil { position: absolute; z-index: 4; display: flex; align-items: center; background: rgba(120,255,220,.1); }
  .peil.row { left: 0; right: 0; top: calc(var(--y) * var(--cell)); height: var(--cell); border-block: 1px dashed rgba(120,255,220,.6); justify-content: flex-end; padding-right: 4px; }
  .peil.col { top: 0; bottom: 0; left: calc(var(--x) * var(--cell)); width: var(--cell); border-inline: 1px dashed rgba(120,255,220,.6); flex-direction: column; justify-content: flex-end; padding-bottom: 2px; }
  .drop { width: 24%; aspect-ratio: 1; border-radius: 50%; background: rgba(220,240,255,.8); box-shadow: 0 0 0 2px rgba(220,240,255,.18); }
  .drop.fresh { animation: plop 0.5s var(--spring-snappy); }
  @keyframes plop { from { transform: scale(2.4); opacity: 0; } }
  .fire { position: relative; z-index: 3; width: 52%; aspect-ratio: 1; display: grid; place-items: center; border-radius: 50%; background: radial-gradient(circle, rgba(255,150,60,.55), transparent 70%); }
  .fire .core { width: 62%; aspect-ratio: 1; border-radius: 50% 50% 50% 0; rotate: -45deg; background: radial-gradient(circle at 60% 40%, #fff3b0, #ff8a2a 50%, #c8262c 85%); box-shadow: 0 0 8px 2px rgba(255,120,40,.7); animation: flicker 0.9s ease-in-out infinite alternate; }
  .s .fire { background: radial-gradient(circle, rgba(40,10,10,.5), transparent 70%); }
  .s .fire .core { background: radial-gradient(circle, #ffb36b, #6a1414); box-shadow: none; animation: none; opacity: 0.85; }
  .fire.fresh { animation: plop 0.45s var(--spring-snappy); }
  @keyframes flicker { to { transform: scale(1.15) translateY(-6%); filter: brightness(1.25); } }

  .hull { position: absolute; z-index: 2; left: calc(var(--x) * var(--cell)); top: calc(var(--y) * var(--cell)); width: calc(var(--len) * var(--cell)); height: var(--cell); animation: float 0.5s var(--spring-snappy); }
  .hull.v { width: var(--cell); height: calc(var(--len) * var(--cell)); }
  .rot { position: absolute; left: 2%; top: 6%; width: 96%; height: 88%; }
  .hull.v .rot { left: 6%; top: 2%; width: calc(var(--len) * var(--cell) * 0.96); height: calc(var(--cell) * 0.88); transform-origin: top left; transform: translateX(calc(var(--cell) * 0.88)) rotate(90deg); }
  .hull.sunk { animation: sink 0.8s var(--spring-smooth); }
  @keyframes float { from { opacity: 0; transform: scale(0.94); } }
  @keyframes sink { from { opacity: 0; transform: scale(1.06); filter: brightness(2.2); } }

  /* impact: rings over the water, spray, and for hits a flash with smoke */
  .fx { position: absolute; z-index: 5; left: calc(var(--x) * var(--cell)); top: calc(var(--y) * var(--cell)); width: var(--cell); height: var(--cell); }
  .ring { position: absolute; inset: 0; border-radius: 50%; border: 2px solid rgba(220,240,255,.85); opacity: 0; animation: ring 1.1s var(--ease-snap) forwards; }
  .r2 { animation-delay: 0.14s; border-width: 1.5px; } .r3 { animation-delay: 0.3s; border-width: 1px; }
  @keyframes ring { 0% { transform: scale(0.3); opacity: 0.95; } 100% { transform: scale(4.2); opacity: 0; } }
  .fx b { position: absolute; left: 44%; top: 44%; width: 12%; height: 12%; border-radius: 50%; background: rgba(230,245,255,.95); opacity: 0; animation: spray 0.7s var(--ease-snap) forwards; }
  @keyframes spray { 0% { opacity: 1; transform: rotate(var(--a)) translateX(0) scale(1.2); } 100% { opacity: 0; transform: rotate(var(--a)) translateX(calc(var(--cell) * var(--d) * 1.4)) scale(0.4); } }
  .hit .ring, .sunk .ring, .mine .ring, .dent .ring { border-color: rgba(255,200,130,.85); }
  .hit b, .sunk b, .mine b, .dent b { background: #ffb36b; box-shadow: 0 0 6px #ff7a2a; }
  .scan .ring { border-color: rgba(120,255,220,.85); border-style: dashed; }
  .scan b { display: none; }
  .mine .flash { inset: -110%; }
  .flash { position: absolute; inset: -60%; border-radius: 50%; background: radial-gradient(circle, rgba(255,250,220,1), rgba(255,170,60,.85) 30%, rgba(200,40,30,.35) 55%, transparent 70%); animation: flash 0.6s var(--ease-snap) forwards; }
  @keyframes flash { 0% { transform: scale(0.3); opacity: 1; } 100% { transform: scale(1.5); opacity: 0; } }
  .smoke { position: absolute; left: 20%; top: 10%; width: 60%; height: 60%; border-radius: 50%; background: radial-gradient(circle, rgba(60,60,66,.75), transparent 70%); opacity: 0; animation: smoke 1.6s var(--ease-snap) 0.2s forwards; }
  .s2 { left: 35%; animation-delay: 0.4s; }
  @keyframes smoke { 0% { opacity: 0.9; transform: translateY(0) scale(0.6); } 100% { opacity: 0; transform: translateY(calc(var(--cell) * -1.4)) scale(2.2); } }
  .sunk .flash { inset: -120%; }
  @media (prefers-reduced-motion: reduce) { .spark, .sonar, .waves, .drop, .fire, .fire .core, .hull, .fx { animation: none !important; } }
</style>
