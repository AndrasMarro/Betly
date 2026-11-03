<script lang="ts">
  import { tick } from 'svelte';
  import ArcadeLayout from '../components/ArcadeLayout.svelte';
  import BetInput from '../components/BetInput.svelte';
  import SlotSymbol from '../components/SlotSymbol.svelte';
  import { SCRATCH, SCRATCH3, scratchCard, pick3Prize, pick3Symbols, randomSym } from '../games/arcade';
  import { wallet, settle, stake, fmt } from '../lib/state.svelte';
  import { byId, gameName } from '../lib/games';
  import { sfx } from '../lib/sfx';
  import { pop } from '../lib/motion';
  import { t } from '../lib/i18n';

  let mode = $state<'classic' | 'pick'>('classic');
  let bet = $state(10);
  let phase = $state<'idle' | 'play' | 'over'>('idle');
  let cells = $state<string[]>(Array(9).fill(''));
  let opened = $state<boolean[]>(Array(9).fill(false));
  let prize = $state<{ sym: string; mult: number } | null>(null);
  let price = $state(0);
  let won = $state(0);
  let voided = $state(false);
  let canvas = $state<HTMLCanvasElement>();
  let cellEls: HTMLDivElement[] = $state([]);
  let pickSyms: string[] = [];
  let down = false, last: [number, number] | null = null, lastSound = 0;

  // coverage sampling: a coarse grid for the whole card, and 7x7 samples inside every field
  const GRID = 24;
  let scratched = new Set<number>();
  let samples: { x: number; y: number; hit: boolean }[][] = [];
  const touched = $derived(opened.filter(Boolean).length);
  let started = $state<number[]>([]); // fields that have been scratched noticeably (pick mode)

  async function buy() {
    if (bet > wallet.balance || bet <= 0) return;
    price = bet;
    stake(bet);
    won = 0;
    voided = false;
    opened = Array(9).fill(false);
    started = [];
    scratched = new Set();
    if (mode === 'classic') {
      const c = scratchCard();
      cells = c.cells;
      prize = c.prize;
    } else {
      prize = pick3Prize();
      pickSyms = pick3Symbols(prize);
      cells = Array(9).fill('');
    }
    phase = 'play';
    sfx('chip');
    await tick();
    paint();
  }

  function paint() {
    if (!canvas) return;
    const r = canvas.getBoundingClientRect(), dpr = devicePixelRatio || 1;
    canvas.width = r.width * dpr;
    canvas.height = r.height * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, '#c9ccd6'); g.addColorStop(0.45, '#f1f2f6'); g.addColorStop(0.55, '#b7bac6'); g.addColorStop(1, '#e3e5ec');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(40,44,60,.4)';
    ctx.font = `700 ${13 * dpr}px "Geist Mono Variable", monospace`;
    ctx.textAlign = 'center';
    if (mode === 'pick') {
      // mark every field so you can aim
      cellEls.forEach((el) => {
        const c = el.getBoundingClientRect();
        ctx.strokeStyle = 'rgba(40,44,60,.25)';
        ctx.lineWidth = 2 * dpr;
        ctx.strokeRect((c.left - r.left + 6) * dpr, (c.top - r.top + 6) * dpr, (c.width - 12) * dpr, (c.height - 12) * dpr);
        ctx.fillText('?', (c.left - r.left + c.width / 2) * dpr, (c.top - r.top + c.height / 2 + 5) * dpr);
      });
    } else {
      for (let y = 1; y < 6; y++) for (let x = 0; x < 4; x++) ctx.fillText('BETLY', ((x + 0.5 + (y % 2) * 0.5) * canvas.width) / 4, (y * canvas.height) / 6);
    }
    samples = cellEls.map((el) => {
      const c = el.getBoundingClientRect(), pts = [];
      for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) pts.push({ x: c.left - r.left + ((i + 0.5) / 7) * c.width, y: c.top - r.top + ((j + 0.5) / 7) * c.height, hit: false });
      return pts;
    });
    canvas.style.opacity = '1';
  }

  function stroke(x: number, y: number) {
    const r = canvas!.getBoundingClientRect(), dpr = devicePixelRatio || 1, rad = Math.max(14, r.width * 0.05);
    const ctx = canvas!.getContext('2d')!;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = rad * 2 * dpr;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const [px, py] = last ?? [x, y];
    ctx.moveTo(px * dpr, py * dpr);
    ctx.lineTo(x * dpr, y * dpr);
    ctx.stroke();
    // coverage along the segment
    const steps = Math.max(1, Math.ceil(Math.hypot(x - px, y - py) / (rad / 2)));
    for (let k = 0; k <= steps; k++) {
      const cx = px + ((x - px) * k) / steps, cy = py + ((y - py) * k) / steps;
      for (let gy = 0; gy < GRID; gy++) for (let gx = 0; gx < GRID; gx++) {
        const sx = ((gx + 0.5) * r.width) / GRID, sy = ((gy + 0.5) * r.height) / GRID;
        if ((sx - cx) ** 2 + (sy - cy) ** 2 < rad * rad) scratched.add(gy * GRID + gx);
      }
      for (const pts of samples) for (const p of pts) if (!p.hit && (p.x - cx) ** 2 + (p.y - cy) ** 2 < rad * rad) p.hit = true;
    }
    last = [x, y];
  }

  function onMove(e: PointerEvent) {
    if (!down || phase !== 'play' || !canvas) return;
    if (mode === 'pick' && touched >= 3) return; // decided: three fields are open
    const r = canvas.getBoundingClientRect();
    stroke(e.clientX - r.left, e.clientY - r.top);
    if (performance.now() - lastSound > 60) { sfx('scratch'); lastSound = performance.now(); }
    if (mode === 'classic') {
      if (scratched.size / (GRID * GRID) > 0.6) finish();
      return;
    }
    // pick mode: a field counts as touched at 12 %, opens at 32 %
    samples.forEach((pts, i) => {
      const cov = pts.filter((p) => p.hit).length / pts.length;
      if (cov > 0.12 && !started.includes(i)) started = [...started, i];
      if (cov > 0.32 && !opened[i] && touched < 3) openField(i);
    });
    if (started.length > 3) void4();
  }

  function openField(i: number) {
    cells[i] = pickSyms[touched];
    opened[i] = true;
    const r = canvas!.getBoundingClientRect(), c = cellEls[i].getBoundingClientRect(), dpr = devicePixelRatio || 1;
    canvas!.getContext('2d')!.clearRect((c.left - r.left) * dpr, (c.top - r.top) * dpr, c.width * dpr, c.height * dpr);
    sfx('gem');
    if (opened.filter(Boolean).length === 3) setTimeout(finish, 450);
  }

  function void4() {
    if (phase !== 'play') return;
    voided = true;
    prize = null;
    finish();
  }

  function finish() {
    if (phase !== 'play') return;
    phase = 'over';
    down = false;
    if (canvas) canvas.style.opacity = '0';
    if (mode === 'pick') cells = cells.map((c) => c || randomSym());
    won = prize && !voided ? Math.round(price * prize.mult * 100) / 100 : 0;
    settle(won, won);
    sfx(won >= price * 10 ? 'big' : won > 0 ? 'win' : 'lose');
  }
  const winning = (i: number) => phase === 'over' && !voided && !!prize && cells[i] === prize.sym && (mode === 'classic' || opened[i]);
</script>

<ArcadeLayout eyebrow="Arcade · {mode === 'classic' ? 'Lucky 3' : 'Pick 3'}" title={gameName(byId('scratch')!)}>
  {#snippet controls()}
    {#if phase === 'play' && mode === 'classic'}
      <button class="btn big" onclick={finish}>{t('sc.reveal')}</button>
    {:else}
      <button class="btn primary big" disabled={phase === 'play' || bet > wallet.balance} onclick={buy}>{t('sc.buy')}</button>
    {/if}
    <div class="seg" role="group">
      <button class:on={mode === 'classic'} disabled={phase === 'play'} onclick={() => (mode = 'classic')}>{t('sc.classic')}</button>
      <button class:on={mode === 'pick'} disabled={phase === 'play'} onclick={() => (mode = 'pick')}>{t('sc.pick')}</button>
    </div>
    <BetInput bind:value={bet} disabled={phase === 'play'} />
    <div class="prizes">
      {#each mode === 'classic' ? SCRATCH : SCRATCH3 as p}
        <div><span class="ps">{#each [0, 1, 2] as _}<i><SlotSymbol sym={p.sym} /></i>{/each}</span><strong class="mono">{p.mult}×</strong></div>
      {/each}
    </div>
  {/snippet}

  <div class="ticket" class:pick={mode === 'pick'}>
    <header>
      <span class="serif">{mode === 'classic' ? 'Lucky 3' : 'Pick 3'}</span>
      <span class="mono">{t('sc.price')} {fmt(price || bet)}</span>
    </header>
    <div class="area">
      <div class="cells">
        {#each cells as sym, i}
          <div class="cell" bind:this={cellEls[i]} class:win={winning(i)} class:open={opened[i]} class:dim={mode === 'pick' && phase === 'over' && !opened[i]}>
            {#if sym && (mode === 'classic' || opened[i] || phase === 'over')}<span class="sy" in:pop><SlotSymbol {sym} /></span>{/if}
          </div>
        {/each}
      </div>
      {#if phase === 'play'}
        <canvas bind:this={canvas} class="foil"
          onpointerdown={(e) => { down = true; last = null; (e.target as HTMLElement).setPointerCapture(e.pointerId); onMove(e); }}
          onpointermove={onMove} onpointerup={() => { down = false; last = null; }} onpointercancel={() => { down = false; last = null; }}></canvas>
      {:else if phase === 'idle'}
        <div class="cover"><span>{mode === 'classic' ? t('sc.hint') : t('sc.pickHint')}</span></div>
      {/if}
    </div>
    <p class="hint">
      {#if phase === 'over'}
        <strong class="mono" class:pos={won > 0} in:pop>{voided ? t('sc.void') : won > 0 ? '+' + fmt(won) : t('sc.none')}</strong>
      {:else if phase === 'play' && mode === 'pick'}
        <span class="mono" class:warn={started.length >= 3}>{t('sc.fields')} {Math.min(started.length, 3)}/3</span>
      {:else}{mode === 'classic' ? t('sc.hint') : t('sc.pickHint')}{/if}
    </p>
  </div>
</ArcadeLayout>

<style>
  .big { min-height: 54px; width: 100%; font-size: 1rem; }
  .seg { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .seg button { min-height: 38px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--bg-2); font-size: 0.82rem; transition: background-color 0.25s var(--ease-snap), color 0.25s var(--ease-snap), transform 0.16s var(--ease-snap); }
  .seg button.on { background: var(--text); color: var(--bg); }
  .seg button:active:not(:disabled) { transform: scale(0.97); }
  .seg button:disabled:not(.on) { opacity: 0.45; }
  .prizes { display: grid; gap: 6px; }
  .prizes div { display: flex; align-items: center; justify-content: space-between; background: var(--bg-2); border-radius: 12px; padding: 6px 10px; }
  .ps { display: flex; gap: 2px; }
  .ps i { width: 22px; height: 22px; }
  .ticket {
    max-width: 520px; margin: 0 auto; border-radius: 26px; padding: 18px; color: #2b1d06;
    background: linear-gradient(150deg, #ffe39a, #f2c046 45%, #d99a2b); box-shadow: 0 30px 60px -30px rgba(0,0,0,.6), inset 0 0 0 3px rgba(255,255,255,.35);
  }
  .ticket.pick { background: linear-gradient(150deg, #b9f3d7, #4fe3a0 45%, #1f9e66); }
  header { display: flex; justify-content: space-between; align-items: baseline; padding: 0 6px 12px; }
  header .serif { font-size: 2rem; }
  header .mono { font-size: 0.8rem; opacity: 0.75; }
  .area { position: relative; border-radius: 18px; overflow: hidden; background: #fffaf0; box-shadow: inset 0 0 0 2px rgba(0,0,0,.08); touch-action: none; user-select: none; }
  .cells { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 14px; }
  .cell { aspect-ratio: 1; border-radius: 14px; background: #f6efe0; padding: 14%; transition: background-color 0.3s var(--ease-snap), transform 0.5s var(--spring-snappy), opacity 0.3s var(--ease-snap); }
  .cell.open { background: #fff4d6; }
  .cell.win { background: #2fbf71; transform: scale(1.04); }
  .cell.dim { opacity: 0.35; }
  .sy { display: block; width: 100%; height: 100%; }
  .foil { position: absolute; inset: 0; width: 100%; height: 100%; cursor: crosshair; transition: opacity 0.5s var(--ease-snap); }
  .cover { position: absolute; inset: 0; display: grid; place-items: center; background: linear-gradient(135deg, #c9ccd6, #f1f2f6 45%, #b7bac6 55%, #e3e5ec); color: #3a3f52; font-weight: 600; text-align: center; padding: 24px; }
  .hint { text-align: center; margin: 14px 0 2px; font-weight: 600; min-height: 1.6em; }
  .hint strong { font-size: 1.3rem; color: #7a1d1d; }
  .hint strong.pos { color: #0b5a33; }
  .warn { color: #8e1b22; }
</style>
