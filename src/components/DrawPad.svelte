<script lang="ts" module>
  import { SW, SH, PAPER, type Drawing } from '../games/doodle';
  /** Paints a drawing onto a canvas sized w × h pixels (the sheet is 800 × 600). */
  export function paint(ctx: CanvasRenderingContext2D, d: Drawing, w: number, h: number) {
    const k = w / SW;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const s of d) {
      ctx.strokeStyle = s.c; ctx.lineWidth = s.w * k;
      ctx.beginPath();
      ctx.moveTo(s.p[0] * k, s.p[1] * k);
      if (s.p.length === 2) ctx.lineTo(s.p[0] * k + 0.01, s.p[1] * k);
      for (let i = 2; i < s.p.length; i += 2) ctx.lineTo(s.p[i] * k, s.p[i + 1] * k);
      ctx.stroke();
    }
    void h;
  }
</script>

<script lang="ts">
  // The drawing sheet: pen in 12 colours and 3 sizes, eraser, undo and clear. Strokes are kept as point lists
  // on an 800 × 600 sheet so they are small to send and look the same on every screen.
  // guide: the part above (monster mode), of which only the bottom strip shows at the top of the sheet.
  import { COLORS, SIZES, simplify } from '../games/doodle';
  let { drawing = $bindable([]), guide = null, disabled = false }: { drawing?: Drawing; guide?: Drawing | null; disabled?: boolean } = $props();
  let cv: HTMLCanvasElement, box: HTMLDivElement;
  let color = $state(COLORS[0]), size = $state(SIZES[1]), eraser = $state(false);
  let cur: number[] | null = null;
  let w = $state(0);

  function redraw() {
    if (!cv) return;
    const dpr = devicePixelRatio || 1, cw = Math.round(w * dpr), ch = Math.round((w * 3) / 4 * dpr);
    if (cv.width !== cw) { cv.width = cw; cv.height = ch; }
    const ctx = cv.getContext('2d')!;
    const live = cur ? [...drawing, { c: eraser ? PAPER : color, w: eraser ? 60 : size, p: cur }] : drawing;
    paint(ctx, live, cw, ch);
    if (guide) {
      // the bottom 15 % of the part above, shifted to the top, then a dashed line where the new part starts
      const off = document.createElement('canvas'); off.width = cw; off.height = ch;
      paint(off.getContext('2d')!, guide, cw, ch);
      const strip = ch * 0.15;
      ctx.globalAlpha = 0.9; ctx.drawImage(off, 0, ch - strip, cw, strip, 0, 0, cw, strip); ctx.globalAlpha = 1;
      ctx.setLineDash([10 * dpr, 8 * dpr]); ctx.strokeStyle = 'rgba(62,99,221,.6)'; ctx.lineWidth = 2 * dpr;
      ctx.beginPath(); ctx.moveTo(0, strip); ctx.lineTo(cw, strip); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  $effect(() => { void [drawing, w, guide]; redraw(); });

  const pos = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * SW, ((e.clientY - r.top) / r.height) * SH]; };
  function down(e: PointerEvent) {
    if (disabled || e.button > 0) return;
    cv.setPointerCapture(e.pointerId);
    cur = pos(e);
    redraw();
  }
  function move(e: PointerEvent) {
    if (!cur) return;
    for (const ev of e.getCoalescedEvents?.() ?? [e]) cur.push(...pos(ev));
    redraw();
  }
  function up() {
    if (!cur) return;
    drawing = [...drawing, { c: eraser ? PAPER : color, w: eraser ? 60 : size, p: simplify(cur) }];
    cur = null;
  }
  const undo = () => (drawing = drawing.slice(0, -1));
  function key(e: KeyboardEvent) { if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !disabled) { e.preventDefault(); undo(); } }
</script>

<svelte:window onkeydown={key} />

<div class="pad" class:disabled>
  <div class="sheet" bind:this={box} bind:clientWidth={w}>
    <canvas bind:this={cv} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} style="touch-action: none"></canvas>
  </div>
  {#if !disabled}
    <div class="tools">
      <div class="colors">
        {#each COLORS as c}<button class="sw" class:on={!eraser && color === c} style="--c:{c}" onclick={() => { color = c; eraser = false; }} aria-label={c}></button>{/each}
      </div>
      <div class="sizes">
        {#each SIZES as s}<button class="sz" class:on={!eraser && size === s} onclick={() => { size = s; eraser = false; }} aria-label={'size ' + s}><i style="--s:{Math.max(4, s * 0.8)}px; --c:{color}"></i></button>{/each}
        <button class="tool" class:on={eraser} onclick={() => (eraser = !eraser)} title="Radierer / Eraser" aria-label="Eraser">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 17l8-8 7 7-4 4H7z M11 9l4-4 6 6-3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" /></svg>
        </button>
        <button class="tool" onclick={undo} disabled={!drawing.length} title="Rückgängig (Ctrl+Z)" aria-label="Undo">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 7L4 12l5 5 M4 12h10a6 6 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" transform="translate(0 -3)" /></svg>
        </button>
        <button class="tool" onclick={() => (drawing = [])} disabled={!drawing.length} title="Alles löschen / Clear" aria-label="Clear">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 7h14 M9 7V4h6v3 M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" /></svg>
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .pad { display: grid; gap: 10px; }
  .sheet { position: relative; width: 100%; aspect-ratio: 4 / 3; border-radius: 16px; overflow: hidden; box-shadow: 0 18px 40px -18px rgba(0,0,0,.6), inset 0 0 0 1px rgba(0,0,0,.08); background: #fffdf6; }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; cursor: crosshair; }
  .disabled canvas { cursor: default; }
  .tools { display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center; }
  .colors { display: grid; grid-template-columns: repeat(12, 1fr); gap: 5px; flex: 1 1 320px; }
  .sw { aspect-ratio: 1; min-width: 22px; border-radius: 50%; border: 2px solid rgba(0,0,0,.25); background: var(--c); padding: 0; transition: transform 0.25s var(--spring-snappy); }
  .sw.on { transform: scale(1.18); box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--text); }
  .sw:active { transform: scale(0.9); }
  .sizes { display: flex; gap: 5px; }
  .sz, .tool { width: 38px; height: 38px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--surface-2); color: var(--text); display: grid; place-items: center; padding: 0; transition: border-color 0.2s var(--ease-snap), transform 0.16s var(--ease-snap); }
  .sz.on, .tool.on { border-color: var(--gold); background: color-mix(in srgb, var(--gold) 16%, var(--surface-2)); }
  .sz:active, .tool:active:not(:disabled) { transform: scale(0.92); }
  .tool:disabled { opacity: 0.35; }
  .sz i { width: var(--s); height: var(--s); border-radius: 50%; background: var(--c); box-shadow: 0 0 0 1px rgba(255,255,255,.3); }
</style>
