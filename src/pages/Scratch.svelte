<script lang="ts">
  // Scratch cards: four tickets to choose from. Lucky 3 (three alike), Pick 3 (scratch only three fields),
  // Diamond (two foil layers: silver, then a tougher gold layer, with a bonus multiplier) and Lucky Numbers
  // (match a winning number and win the prize under it).
  import { tick } from 'svelte';
  import ArcadeLayout from '../components/ArcadeLayout.svelte';
  import BetInput from '../components/BetInput.svelte';
  import SlotSymbol from '../components/SlotSymbol.svelte';
  import { SCRATCH, SCRATCH3, DIAMOND, DIAMOND_BONUS, NUMBERS, scratchCard, diamondCard, numbersCard, pick3Prize, pick3Symbols, randomSym } from '../games/arcade';
  import { wallet, settle, stake, fmt, settings } from '../lib/state.svelte';
  import { byId, gameName } from '../lib/games';
  import { sfx } from '../lib/sfx';
  import { pop } from '../lib/motion';
  import { t } from '../lib/i18n';

  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
  type Mode = 'classic' | 'pick' | 'diamond' | 'numbers';
  const TICKETS: { id: Mode; name: string; top: string; de: string; en: string }[] = [
    { id: 'classic', name: 'Lucky 3', top: '50×', de: 'Drei Gleiche gewinnen', en: 'Three alike win' },
    { id: 'pick', name: 'Pick 3', top: '100×', de: 'Nur drei Felder rubbeln', en: 'Scratch only three fields' },
    { id: 'diamond', name: 'Diamant', top: '500×', de: 'Zwei Schichten + Bonus', en: 'Two layers + bonus' },
    { id: 'numbers', name: L('Zahlenglück', 'Lucky Numbers'), top: '100×', de: 'Gewinnzahl finden', en: 'Find a winning number' },
  ];
  let mode = $state<Mode>('classic');
  let bet = $state(10);
  let phase = $state<'idle' | 'play' | 'over'>('idle');
  let cells = $state<string[]>(Array(9).fill(''));
  let opened = $state<boolean[]>(Array(9).fill(false));
  let prize = $state<{ sym: string; mult: number } | null>(null);
  let bonus = $state(1);
  let nums = $state<{ winning: number[]; yours: { n: number; mult: number }[]; prize: number }>({ winning: [0, 0], yours: Array(8).fill({ n: 0, mult: 0 }), prize: 0 });
  let price = $state(0);
  let won = $state(0);
  let voided = $state(false);
  let area = $state<HTMLDivElement>();
  let canvases: HTMLCanvasElement[] = $state([]);
  let cellEls: HTMLDivElement[] = $state([]);
  let pickSyms: string[] = [];
  let down = false, last: [number, number] | null = null, lastSound = 0;
  const layers = $derived(mode === 'diamond' ? 2 : 1);

  // coverage: a coarse grid over the card counts how often each spot was scratched (gold needs several passes),
  // and 7x7 samples inside every field tell which fields are open (pick mode)
  const GRID = 24, GOLD_PASSES = 9;
  let hits = new Uint16Array(GRID * GRID);
  let samples: { x: number; y: number; hit: boolean }[][] = [];
  const touched = $derived(opened.filter(Boolean).length);
  let started = $state<number[]>([]);
  let progress = $state(0);

  async function buy() {
    if (bet > wallet.balance || bet <= 0) return;
    price = bet;
    stake(bet);
    won = 0; voided = false; bonus = 1; progress = 0;
    opened = Array(9).fill(false);
    started = [];
    hits = new Uint16Array(GRID * GRID);
    if (mode === 'classic') ({ cells, prize } = scratchCard());
    else if (mode === 'diamond') ({ cells, prize, bonus } = diamondCard());
    else if (mode === 'numbers') { nums = numbersCard(); prize = null; }
    else { prize = pick3Prize(); pickSyms = pick3Symbols(prize); cells = Array(9).fill(''); }
    phase = 'play';
    sfx('chip');
    await tick();
    paint();
  }

  function paint() {
    if (!area) return;
    const r = area.getBoundingClientRect(), dpr = devicePixelRatio || 1;
    canvases.forEach((cv, k) => {
      if (!cv) return;
      cv.width = r.width * dpr; cv.height = r.height * dpr;
      const ctx = cv.getContext('2d')!;
      ctx.globalCompositeOperation = 'source-over';
      const g = ctx.createLinearGradient(0, 0, cv.width, cv.height);
      // layer 0 is the silver on top, layer 1 the gold underneath (diamond)
      const cols = k === 0 ? ['#c9ccd6', '#f1f2f6', '#b7bac6', '#e3e5ec'] : ['#c8962e', '#ffe08a', '#b07a1c', '#f2c046'];
      cols.forEach((c, i) => g.addColorStop([0, 0.45, 0.55, 1][i], c));
      ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = k === 0 ? 'rgba(40,44,60,.4)' : 'rgba(90,55,0,.35)';
      ctx.font = `700 ${13 * dpr}px "Geist Mono Variable", monospace`;
      ctx.textAlign = 'center';
      if (mode === 'pick') {
        cellEls.forEach((el) => {
          const c = el.getBoundingClientRect();
          ctx.strokeStyle = 'rgba(40,44,60,.25)'; ctx.lineWidth = 2 * dpr;
          ctx.strokeRect((c.left - r.left + 6) * dpr, (c.top - r.top + 6) * dpr, (c.width - 12) * dpr, (c.height - 12) * dpr);
          ctx.fillText('?', (c.left - r.left + c.width / 2) * dpr, (c.top - r.top + c.height / 2 + 5) * dpr);
        });
      } else for (let y = 1; y < 6; y++) for (let x = 0; x < 4; x++) ctx.fillText(k === 0 ? 'BETLY' : '◆', ((x + 0.5 + (y % 2) * 0.5) * cv.width) / 4, (y * cv.height) / 6);
    });
    samples = cellEls.filter(Boolean).map((el) => {
      const c = el.getBoundingClientRect(), pts = [];
      for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) pts.push({ x: c.left - r.left + ((i + 0.5) / 7) * c.width, y: c.top - r.top + ((j + 0.5) / 7) * c.height, hit: false });
      return pts;
    });
  }

  function stroke(x: number, y: number) {
    const r = area!.getBoundingClientRect(), dpr = devicePixelRatio || 1, rad = Math.max(14, r.width * 0.05);
    const [px, py] = last ?? [x, y];
    canvases.forEach((cv, k) => {
      if (!cv) return;
      const ctx = cv.getContext('2d')!;
      ctx.globalCompositeOperation = 'destination-out';
      // silver comes off in one go, the gold only bit by bit
      ctx.strokeStyle = k === 0 ? '#000' : 'rgba(0,0,0,.17)';
      ctx.lineWidth = rad * 2 * dpr; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px * dpr, py * dpr); ctx.lineTo(x * dpr, y * dpr); ctx.stroke();
    });
    const steps = Math.max(1, Math.ceil(Math.hypot(x - px, y - py) / (rad / 2))), now = new Set<number>();
    for (let k = 0; k <= steps; k++) {
      const cx = px + ((x - px) * k) / steps, cy = py + ((y - py) * k) / steps;
      for (let gy = 0; gy < GRID; gy++) for (let gx = 0; gx < GRID; gx++) {
        const sx = ((gx + 0.5) * r.width) / GRID, sy = ((gy + 0.5) * r.height) / GRID;
        if ((sx - cx) ** 2 + (sy - cy) ** 2 < rad * rad) now.add(gy * GRID + gx);
      }
      for (const pts of samples) for (const p of pts) if (!p.hit && (p.x - cx) ** 2 + (p.y - cy) ** 2 < rad * rad) p.hit = true;
    }
    for (const i of now) hits[i]++;
    last = [x, y];
  }

  function onMove(e: PointerEvent) {
    if (!down || phase !== 'play' || !area) return;
    if (mode === 'pick' && touched >= 3) return; // decided: three fields are open
    const r = area.getBoundingClientRect();
    stroke(e.clientX - r.left, e.clientY - r.top);
    if (performance.now() - lastSound > 60) { sfx('scratch'); lastSound = performance.now(); }
    if (mode !== 'pick') {
      const need = layers === 2 ? GOLD_PASSES : 1;
      progress = hits.reduce((a, h) => a + (h >= need ? 1 : 0), 0) / hits.length;
      if (progress > 0.6) finish();
      return;
    }
    // pick mode: a field counts as touched at 12 %, opens at 32 %
    samples.forEach((pts, i) => {
      const cov = pts.filter((p) => p.hit).length / pts.length;
      if (cov > 0.12 && !started.includes(i)) started = [...started, i];
      if (cov > 0.32 && !opened[i] && touched < 3) openField(i);
    });
    if (started.length > 3) { voided = true; prize = null; finish(); }
  }

  function openField(i: number) {
    cells[i] = pickSyms[touched];
    opened[i] = true;
    const r = area!.getBoundingClientRect(), c = cellEls[i].getBoundingClientRect(), dpr = devicePixelRatio || 1;
    canvases[0]?.getContext('2d')!.clearRect((c.left - r.left) * dpr, (c.top - r.top) * dpr, c.width * dpr, c.height * dpr);
    sfx('gem');
    if (opened.filter(Boolean).length === 3) setTimeout(finish, 450);
  }

  function finish() {
    if (phase !== 'play') return;
    phase = 'over';
    down = false;
    if (mode === 'pick') cells = cells.map((c) => c || randomSym());
    const mult = voided ? 0 : mode === 'numbers' ? nums.prize : prize ? prize.mult * (mode === 'diamond' ? bonus : 1) : 0;
    won = Math.round(price * mult * 100) / 100;
    settle(won, won);
    sfx(won >= price * 10 ? 'big' : won > 0 ? 'win' : 'lose');
  }
  const winning = (i: number) => phase === 'over' && !voided && !!prize && cells[i] === prize.sym && (mode !== 'pick' || opened[i]);
  const hitNum = (n: number) => phase === 'over' && nums.winning.includes(n);
  const T = $derived(TICKETS.find((x) => x.id === mode)!);
</script>

<ArcadeLayout eyebrow="Arcade · {T.name}" title={gameName(byId('scratch')!)}>
  {#snippet controls()}
    {#if phase === 'play' && mode !== 'pick'}
      <button class="btn big" onclick={finish}>{t('sc.reveal')}</button>
    {:else}
      <button class="btn primary big" disabled={phase === 'play' || bet > wallet.balance} onclick={buy}>{t('sc.buy')}</button>
    {/if}
    <!-- the ticket shelf -->
    <div class="shelf" role="group" aria-label={L('Los wählen', 'Choose a ticket')}>
      {#each TICKETS as tk}
        <button class="mini {tk.id}" class:on={mode === tk.id} disabled={phase === 'play'} onclick={() => { mode = tk.id; phase = 'idle'; }}>
          <b>{tk.name}</b><small>{L(tk.de, tk.en)}</small><em class="mono">{L('bis', 'up to')} {tk.top}</em>
        </button>
      {/each}
    </div>
    <BetInput bind:value={bet} disabled={phase === 'play'} />
    <div class="prizes">
      {#if mode === 'numbers'}
        {#each NUMBERS as p}<div><span>{L('Treffer mit', 'Match with')} ×{p.mult}</span><strong class="mono">{p.mult}×</strong></div>{/each}
      {:else}
        {#each mode === 'pick' ? SCRATCH3 : mode === 'diamond' ? DIAMOND : SCRATCH as p}
          <div><span class="ps">{#each [0, 1, 2] as _}<i><SlotSymbol sym={p.sym} /></i>{/each}</span><strong class="mono">{p.mult}×</strong></div>
        {/each}
        {#if mode === 'diamond'}<div><span>Bonus</span><strong class="mono">{DIAMOND_BONUS.map((b) => '×' + b.m).join(' ')}</strong></div>{/if}
      {/if}
    </div>
  {/snippet}

  <div class="ticket {mode}">
    <header>
      <span class="serif">{T.name}</span>
      <span class="mono">{t('sc.price')} {fmt(price || bet)}</span>
    </header>
    <div class="area" bind:this={area}>
      {#if mode === 'numbers'}
        <div class="nums">
          <div class="lbl">{L('Gewinnzahlen', 'Winning numbers')}</div>
          <div class="win2">{#each nums.winning as n, i}<div class="nb big2" bind:this={cellEls[i]}>{phase === 'idle' ? '' : n}</div>{/each}</div>
          <div class="lbl">{L('Deine Zahlen', 'Your numbers')}</div>
          <div class="yours">
            {#each nums.yours as y, i}
              <div class="nb" class:win={hitNum(y.n)} bind:this={cellEls[i + 2]}>{#if phase !== 'idle'}<b>{y.n}</b><small class="mono">×{y.mult}</small>{/if}</div>
            {/each}
          </div>
        </div>
      {:else}
        <div class="cells">
          {#each cells as sym, i}
            <div class="cell" bind:this={cellEls[i]} class:win={winning(i)} class:open={opened[i]} class:dim={mode === 'pick' && phase === 'over' && !opened[i]}>
              {#if sym && (mode !== 'pick' || opened[i] || phase === 'over')}<span class="sy" in:pop><SlotSymbol {sym} /></span>{/if}
            </div>
          {/each}
        </div>
        {#if mode === 'diamond'}
          <div class="bonus" class:win={phase === 'over' && !!prize && bonus > 1}><span>Bonus</span><strong class="mono">{phase === 'idle' ? '?' : '×' + bonus}</strong></div>
        {/if}
      {/if}
      {#if phase === 'play'}
        <div class="foils" role="presentation"
          onpointerdown={(e) => { down = true; last = null; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); onMove(e); }}
          onpointermove={onMove} onpointerup={() => { down = false; last = null; }} onpointercancel={() => { down = false; last = null; }}>
          {#each Array(layers) as _, k}<canvas bind:this={canvases[layers - 1 - k]} class="foil"></canvas>{/each}
        </div>
      {:else if phase === 'idle'}
        <div class="cover"><span>{mode === 'pick' ? t('sc.pickHint') : mode === 'diamond' ? L('Zwei Schichten: erst Silber, darunter hartes Gold. Rubbel kräftig!', 'Two layers: silver first, tough gold below. Scratch hard!') : mode === 'numbers' ? L('Findest du eine Gewinnzahl bei deinen Zahlen, gewinnst du den Betrag darunter.', 'Find a winning number among yours and win the prize below it.') : t('sc.hint')}</span></div>
      {/if}
    </div>
    <p class="hint">
      {#if phase === 'over'}
        <strong class="mono" class:pos={won > 0} in:pop>{voided ? t('sc.void') : won > 0 ? '+' + fmt(won) + (mode === 'diamond' && bonus > 1 ? ` (Bonus ×${bonus})` : '') : t('sc.none')}</strong>
      {:else if phase === 'play' && mode === 'pick'}
        <span class="mono" class:warn={started.length >= 3}>{t('sc.fields')} {Math.min(started.length, 3)}/3</span>
      {:else if phase === 'play' && mode === 'diamond'}
        <span class="mono">{L('Gold freigelegt', 'Gold cleared')} {Math.round(Math.min(1, progress / 0.6) * 100)} %</span>
      {:else}{L(T.de, T.en)}{/if}
    </p>
  </div>
</ArcadeLayout>

<style>
  .big { min-height: 54px; width: 100%; font-size: 1rem; }
  .shelf { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .mini { display: grid; gap: 2px; text-align: left; padding: 10px 12px; border-radius: 14px; border: 2px solid transparent; color: #2b1d06; transition: transform 0.25s var(--ease-snap), border-color 0.2s; }
  .mini b { font-size: 0.95rem; } .mini small { font-size: 0.68rem; opacity: 0.75; } .mini em { font-style: normal; font-size: 0.7rem; font-weight: 700; }
  .mini.on { border-color: var(--text); transform: translateY(-2px); }
  .mini:disabled:not(.on) { opacity: 0.45; }
  .mini.classic, .ticket.classic { background: linear-gradient(150deg, #ffe39a, #f2c046 45%, #d99a2b); }
  .mini.pick, .ticket.pick { background: linear-gradient(150deg, #b9f3d7, #4fe3a0 45%, #1f9e66); }
  .mini.diamond, .ticket.diamond { background: linear-gradient(150deg, #d6f1ff, #6cc4f5 45%, #2b6fd1); }
  .mini.numbers, .ticket.numbers { background: linear-gradient(150deg, #ffd6ec, #ff7ab8 45%, #b03c86); }
  .prizes { display: grid; gap: 6px; }
  .prizes div { display: flex; align-items: center; justify-content: space-between; background: var(--bg-2); border-radius: 12px; padding: 6px 10px; font-size: 0.85rem; }
  .ps { display: flex; gap: 2px; }
  .ps i { width: 22px; height: 22px; }
  .ticket { max-width: 520px; margin: 0 auto; border-radius: 26px; padding: 18px; color: #2b1d06; box-shadow: 0 30px 60px -30px rgba(0,0,0,.6), inset 0 0 0 3px rgba(255,255,255,.35); }
  header { display: flex; justify-content: space-between; align-items: baseline; padding: 0 6px 12px; }
  header .serif { font-size: 2rem; }
  header .mono { font-size: 0.8rem; opacity: 0.75; }
  .area { position: relative; border-radius: 18px; overflow: hidden; background: #fffaf0; box-shadow: inset 0 0 0 2px rgba(0,0,0,.08); touch-action: none; user-select: none; }
  .cells { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 14px; }
  .cell { aspect-ratio: 1; border-radius: 14px; background: #f6efe0; padding: 14%; transition: background-color 0.3s var(--ease-snap), transform 0.5s var(--spring-snappy), opacity 0.3s var(--ease-snap); }
  .cell.open { background: #fff4d6; }
  .cell.win, .nb.win, .bonus.win { background: #2fbf71; color: #fff; transform: scale(1.04); }
  .cell.dim { opacity: 0.35; }
  .sy { display: block; width: 100%; height: 100%; }
  .bonus { display: flex; justify-content: space-between; align-items: center; margin: 0 14px 14px; padding: 12px 18px; border-radius: 14px; background: #e6f3ff; font-weight: 700; transition: transform 0.5s var(--spring-snappy); }
  .bonus strong { font-size: 1.5rem; }
  .nums { display: grid; gap: 8px; padding: 14px; }
  .lbl { font: 700 0.7rem 'Geist Mono Variable', monospace; letter-spacing: 0.16em; text-transform: uppercase; opacity: 0.6; }
  .win2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .yours { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .nb { display: grid; place-items: center; align-content: center; min-height: 70px; border-radius: 14px; background: #fdeaf3; font-weight: 800; transition: transform 0.5s var(--spring-snappy); }
  .nb b { font-size: 1.5rem; } .nb small { font-size: 0.72rem; opacity: 0.7; }
  .nb.big2 { font-size: 2rem; background: #ffe3f0; }
  .foils { position: absolute; inset: 0; cursor: crosshair; }
  .foil { position: absolute; inset: 0; width: 100%; height: 100%; }
  .cover { position: absolute; inset: 0; display: grid; place-items: center; background: linear-gradient(135deg, #c9ccd6, #f1f2f6 45%, #b7bac6 55%, #e3e5ec); color: #3a3f52; font-weight: 600; text-align: center; padding: 24px; }
  .hint { text-align: center; margin: 14px 0 2px; font-weight: 600; min-height: 1.6em; }
  .hint strong { font-size: 1.3rem; color: #7a1d1d; }
  .hint strong.pos { color: #0b5a33; }
  .warn { color: #8e1b22; }
</style>
