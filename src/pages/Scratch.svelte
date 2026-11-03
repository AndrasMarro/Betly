<script lang="ts">
  import { tick } from 'svelte';
  import { scale } from 'svelte/transition';
  import ArcadeLayout from '../components/ArcadeLayout.svelte';
  import BetInput from '../components/BetInput.svelte';
  import SlotSymbol from '../components/SlotSymbol.svelte';
  import { SCRATCH, scratchCard } from '../games/arcade';
  import { wallet, settle, stake, fmt } from '../lib/state.svelte';
  import { byId, gameName } from '../lib/games';
  import { sfx } from '../lib/sfx';
  import { t } from '../lib/i18n';

  let bet = $state(10);
  let phase = $state<'idle' | 'play' | 'over'>('idle');
  let card = $state<ReturnType<typeof scratchCard> | null>(null);
  let price = $state(0);
  let won = $state(0);
  let canvas = $state<HTMLCanvasElement>();
  const GRID = 24;
  let scratched = new Set<number>();
  let down = false, lastSound = 0;

  async function buy() {
    if (bet > wallet.balance || bet <= 0) return;
    price = bet;
    stake(bet);
    card = scratchCard();
    won = 0;
    scratched = new Set();
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
    ctx.fillStyle = 'rgba(40,44,60,.45)';
    ctx.font = `700 ${14 * dpr}px "Geist Mono Variable", monospace`;
    ctx.textAlign = 'center';
    for (let y = 1; y < 6; y++) for (let x = 0; x < 4; x++) ctx.fillText('BETLY', ((x + 0.5 + (y % 2) * 0.5) * canvas.width) / 4, (y * canvas.height) / 6);
    canvas.style.opacity = '1';
  }
  function scratchAt(e: PointerEvent) {
    if (!down || phase !== 'play' || !canvas) return;
    const r = canvas.getBoundingClientRect(), dpr = devicePixelRatio || 1;
    const x = e.clientX - r.left, y = e.clientY - r.top, rad = Math.max(16, r.width * 0.06);
    const ctx = canvas.getContext('2d')!;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(x * dpr, y * dpr, rad * dpr, 0, 7); ctx.fill();
    // track coverage on a coarse grid
    for (let gy = 0; gy < GRID; gy++) for (let gx = 0; gx < GRID; gx++) {
      const cx = ((gx + 0.5) * r.width) / GRID, cy = ((gy + 0.5) * r.height) / GRID;
      if ((cx - x) ** 2 + (cy - y) ** 2 < rad * rad) scratched.add(gy * GRID + gx);
    }
    if (performance.now() - lastSound > 70) { sfx('scratch'); lastSound = performance.now(); }
    if (scratched.size / (GRID * GRID) > 0.6) reveal();
  }
  function reveal() {
    if (phase !== 'play' || !card) return;
    phase = 'over';
    if (canvas) canvas.style.opacity = '0';
    won = card.prize ? Math.round(price * card.prize.mult * 100) / 100 : 0;
    settle(won, won);
    sfx(won >= price * 10 ? 'big' : won > 0 ? 'win' : 'lose');
  }
</script>

<ArcadeLayout eyebrow="Arcade · Lucky 3" title={gameName(byId('scratch')!)}>
  {#snippet controls()}
    {#if phase === 'play'}
      <button class="btn big" onclick={reveal}>{t('sc.reveal')}</button>
    {:else}
      <button class="btn primary big" disabled={bet > wallet.balance} onclick={buy}>{t('sc.buy')}</button>
    {/if}
    <BetInput bind:value={bet} disabled={phase === 'play'} />
    <div class="prizes">
      {#each SCRATCH as p}
        <div><span class="ps">{#each [0, 1, 2] as _}<i><SlotSymbol sym={p.sym} /></i>{/each}</span><strong class="mono">{p.mult}×</strong></div>
      {/each}
    </div>
  {/snippet}

  <div class="ticket">
    <header>
      <span class="serif">Lucky 3</span>
      <span class="mono">{t('sc.price')} {fmt(price || bet)}</span>
    </header>
    <div class="area">
      <div class="cells">
        {#each card?.cells ?? Array(9).fill('') as sym}
          <div class="cell" class:win={phase === 'over' && card?.prize?.sym === sym}>{#if sym}<SlotSymbol {sym} />{/if}</div>
        {/each}
      </div>
      {#if phase === 'play'}
        <canvas bind:this={canvas} class="foil"
          onpointerdown={(e) => { down = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); scratchAt(e); }}
          onpointermove={scratchAt} onpointerup={() => (down = false)} onpointercancel={() => (down = false)}></canvas>
      {:else if phase === 'idle'}
        <div class="cover"><span>{t('sc.hint')}</span></div>
      {/if}
    </div>
    <p class="hint">
      {#if phase === 'over'}
        <strong class="mono" class:pos={won > 0} in:scale={{ start: 0.9, duration: 400 }}>{won > 0 ? '+' + fmt(won) : t('sc.none')}</strong>
      {:else}{t('sc.hint')}{/if}
    </p>
  </div>
</ArcadeLayout>

<style>
  .big { min-height: 54px; width: 100%; font-size: 1rem; }
  .prizes { display: grid; gap: 6px; }
  .prizes div { display: flex; align-items: center; justify-content: space-between; background: var(--bg-2); border-radius: 12px; padding: 6px 10px; }
  .ps { display: flex; gap: 2px; }
  .ps i { width: 22px; height: 22px; }
  .ticket {
    max-width: 520px; margin: 0 auto; border-radius: 26px; padding: 18px; color: #2b1d06;
    background: linear-gradient(150deg, #ffe39a, #f2c046 45%, #d99a2b); box-shadow: 0 30px 60px -30px rgba(0,0,0,.6), inset 0 0 0 3px rgba(255,255,255,.35);
  }
  header { display: flex; justify-content: space-between; align-items: baseline; padding: 0 6px 12px; }
  header .serif { font-size: 2rem; }
  header .mono { font-size: 0.8rem; opacity: 0.75; }
  .area { position: relative; border-radius: 18px; overflow: hidden; background: #fffaf0; box-shadow: inset 0 0 0 2px rgba(0,0,0,.08); touch-action: none; }
  .cells { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 14px; }
  .cell { aspect-ratio: 1; border-radius: 14px; background: #f6efe0; padding: 14%; transition: background-color 0.3s var(--ease-snap), transform 0.5s var(--spring-snappy); }
  .cell.win { background: #2fbf71; transform: scale(1.04); }
  .foil { position: absolute; inset: 0; width: 100%; height: 100%; cursor: crosshair; transition: opacity 0.5s var(--ease-snap); }
  .cover { position: absolute; inset: 0; display: grid; place-items: center; background: linear-gradient(135deg, #c9ccd6, #f1f2f6 45%, #b7bac6 55%, #e3e5ec); color: #3a3f52; font-weight: 600; text-align: center; padding: 20px; }
  .hint { text-align: center; margin: 14px 0 2px; font-weight: 600; min-height: 1.6em; }
  .hint strong { font-size: 1.3rem; color: #7a1d1d; }
  .hint strong.pos { color: #0b5a33; }
</style>
