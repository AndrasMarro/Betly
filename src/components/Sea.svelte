<script lang="ts">
  // One 10 × 10 sea: shots (water, hit, sunk), visible ships (own fleet, a partner's, every sunk one),
  // and while placing a preview ship. Cells are buttons when the board can be fired at.
  import { N, cellsOf, type Ship } from '../games/ships';
  let { shots = '', ships = [], fire, preview = null, previewOk = true, hover, pick, last = -1, cell = 32, dim = false, label = '' }: {
    shots?: string; ships?: Ship[]; fire?: (c: number) => void; preview?: Ship | null; previewOk?: boolean;
    hover?: (c: number) => void; pick?: (c: number) => void; last?: number; cell?: number; dim?: boolean; label?: string;
  } = $props();
  const at = (c: number) => +(shots[c] ?? 0);
  // sunk ships show their hull: find the runs of sunk cells
  const sunk = $derived.by(() => {
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
  const prev = $derived(preview ? new Set(cellsOf(preview).filter((c) => c >= 0 && c < N * N)) : new Set<number>());
  const COLS = 'ABCDEFGHIJ';
</script>

<div class="sea" class:dim class:armed={!!fire} style="--cell:{cell}px" aria-label={label}>
  <div class="cols">{#each COLS as l}<span>{l}</span>{/each}</div>
  <div class="rows">{#each Array(N) as _, i}<span>{i + 1}</span>{/each}</div>
  <div class="grid" role="presentation" onpointerleave={() => hover?.(-1)}>
    {#each Array(N * N) as _, c}
      {@const v = at(c)}
      <button class="c" class:w={v === 1} class:h={v === 2} class:s={v === 3} class:pv={prev.has(c)} class:bad={prev.has(c) && !previewOk} class:new={c === last}
        disabled={!fire && !pick && !hover} tabindex={fire && !v ? 0 : -1}
        onpointerenter={() => hover?.(c)} onclick={() => (fire && !v ? fire(c) : pick?.(c))} aria-label={COLS[c % N] + (Math.floor(c / N) + 1)}>
        {#if v === 1}<i class="drop"></i>{:else if v >= 2}<i class="fire"></i>{/if}
      </button>
    {/each}
    {#each [...own.map((s) => ({ s, k: 'own' })), ...sunk.map((s) => ({ s, k: 'sunk' }))] as { s, k } (k + s.x + '-' + s.y + s.v)}
      <span class="hull {k}" class:v={s.v} style="--x:{s.x}; --y:{s.y}; --len:{s.len}"></span>
    {/each}
  </div>
</div>

<style>
  .sea { display: grid; grid-template-columns: calc(var(--cell) * 0.6) auto; grid-template-rows: calc(var(--cell) * 0.6) auto; user-select: none; }
  .cols { grid-column: 2; display: grid; grid-template-columns: repeat(10, var(--cell)); }
  .rows { grid-row: 2; display: grid; grid-template-rows: repeat(10, var(--cell)); }
  .cols span, .rows span { display: grid; place-items: center; font: 600 calc(var(--cell) * 0.32) 'Geist Mono Variable', monospace; color: rgba(220,235,255,.5); }
  .grid {
    position: relative; display: grid; grid-template-columns: repeat(10, var(--cell)); grid-template-rows: repeat(10, var(--cell)); border-radius: 8px; overflow: hidden;
    background: radial-gradient(ellipse at 30% 20%, rgba(120,200,255,.18), transparent 60%), repeating-radial-gradient(circle at 70% 120%, rgba(255,255,255,.035) 0 2px, transparent 2px 14px), linear-gradient(160deg, #10456b, #082440);
    box-shadow: inset 0 0 0 1px rgba(150,210,255,.25), 0 14px 30px -14px rgba(0,0,0,.7);
  }
  .dim .grid { filter: saturate(0.6) brightness(0.8); }
  .c { position: relative; padding: 0; border: 0; background: none; box-shadow: inset 0 0 0 0.5px rgba(150,210,255,.14); display: grid; place-items: center; z-index: 1; }
  .armed .c:not(.w):not(.h):not(.s) { cursor: crosshair; }
  @media (hover: hover) and (pointer: fine) { .armed .c:not(.w):not(.h):not(.s):hover { background: rgba(255,214,120,.25); box-shadow: inset 0 0 0 2px rgba(255,214,120,.8); } }
  .c:disabled { cursor: default; }
  .c.pv { background: rgba(120,255,190,.32); }
  .c.bad { background: rgba(255,90,90,.35); }
  .drop { width: 26%; aspect-ratio: 1; border-radius: 50%; background: rgba(220,240,255,.75); }
  .new .drop { animation: drop 0.5s var(--spring-snappy); }
  .new.w::after { content: ''; position: absolute; inset: 15%; border-radius: 50%; border: 2px solid rgba(220,240,255,.8); animation: ring 0.8s var(--ease-snap) forwards; }
  @keyframes drop { from { transform: scale(2.2); opacity: 0; } }
  @keyframes ring { from { transform: scale(0.4); opacity: 1; } to { transform: scale(1.9); opacity: 0; } }
  .fire { width: 46%; aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle at 40% 35%, #fff3b0, #ff8a2a 45%, #c8262c 80%); box-shadow: 0 0 10px 2px rgba(255,120,40,.7); animation: flicker 1.4s ease-in-out infinite alternate; z-index: 3; }
  .s .fire { width: 34%; background: radial-gradient(circle, #ffb36b, #8a1a1a); box-shadow: none; animation: none; }
  .new .fire { animation: burst 0.55s var(--spring-snappy), flicker 1.4s ease-in-out 0.55s infinite alternate; }
  .new.h::after, .new.s::after { content: ''; position: absolute; inset: -40%; border-radius: 50%; background: radial-gradient(circle, rgba(255,220,140,.9), rgba(255,100,40,.4) 40%, transparent 70%); animation: ring 0.6s var(--ease-snap) forwards; z-index: 4; }
  @keyframes burst { from { transform: scale(2.4); } }
  @keyframes flicker { to { filter: brightness(1.25); transform: scale(1.08); } }
  .hull {
    position: absolute; z-index: 2; pointer-events: none; left: calc(var(--x) * var(--cell) + var(--cell) * 0.08); top: calc(var(--y) * var(--cell) + var(--cell) * 0.12);
    width: calc(var(--len) * var(--cell) - var(--cell) * 0.16); height: calc(var(--cell) * 0.76); border-radius: 40% 12% 12% 40% / 50%;
    background: linear-gradient(180deg, #c3ccd8, #7d8796 55%, #555e6c); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.35), 0 4px 6px rgba(0,0,0,.4);
    animation: float 0.5s var(--spring-snappy);
  }
  .hull::after { content: ''; position: absolute; left: 28%; right: 22%; top: 30%; bottom: 30%; border-radius: 3px; background: rgba(40,48,60,.55); }
  .hull.v { width: calc(var(--cell) * 0.76); height: calc(var(--len) * var(--cell) - var(--cell) * 0.16); left: calc(var(--x) * var(--cell) + var(--cell) * 0.12); top: calc(var(--y) * var(--cell) + var(--cell) * 0.08); border-radius: 50% / 40% 40% 12% 12%; background: linear-gradient(90deg, #c3ccd8, #7d8796 55%, #555e6c); }
  .hull.v::after { left: 30%; right: 30%; top: 28%; bottom: 22%; }
  .hull.sunk { background: linear-gradient(180deg, #6a3a3a, #3a1e1e); opacity: 0.85; animation: sink 0.7s var(--spring-smooth); }
  .hull.sunk.v { background: linear-gradient(90deg, #6a3a3a, #3a1e1e); }
  @keyframes float { from { opacity: 0; transform: scale(0.92); } }
  @keyframes sink { from { opacity: 0; transform: scale(1.08); filter: brightness(2); } }
  @media (prefers-reduced-motion: reduce) { .drop, .fire, .hull, .new.w::after, .new.h::after, .new.s::after { animation: none !important; } }
</style>
