<script lang="ts">
  import { fly, scale } from 'svelte/transition';
  import ArcadeLayout from '../components/ArcadeLayout.svelte';
  import BetInput from '../components/BetInput.svelte';
  import { WHEELS, wheelLayout, type WheelRisk } from '../games/arcade';
  import { wallet, settle, stake, fmt } from '../lib/state.svelte';
  import { byId, gameName } from '../lib/games';
  import { sfx } from '../lib/sfx';
  import { t, type Key } from '../lib/i18n';

  let bet = $state(10);
  let risk = $state<WheelRisk>('medium');
  const segs = $derived(wheelLayout(risk));
  let rot = $state(0);
  let busy = $state(false);
  let result = $state<{ m: number; win: number } | null>(null);
  let history = $state<{ m: number; id: number }[]>([]);
  let n = 0;

  const COLORS: Record<string, string> = { '0': '#2a2f45', '1.2': '#2fa3a0', '1.3': '#36c2b4', '1.5': '#2fbf71', '2': '#4f8dff', '3': '#9b6bff', '4.4': '#f2c046', '29.1': '#ff4d5e' };
  const col = (m: number) => COLORS[String(m)] ?? '#888';
  const legend = $derived([...new Set(WHEELS[risk])].sort((a, b) => a - b).map((m) => ({ m, n: WHEELS[risk].filter((x) => x === m).length })));

  const pt = (deg: number, r: number) => { const a = (deg * Math.PI) / 180; return `${(r * Math.sin(a)).toFixed(2)} ${(-r * Math.cos(a)).toFixed(2)}`; };
  const wedge = (i: number, total: number) => {
    const step = 360 / total, a = i * step - step / 2, b = a + step;
    return `M0 0 L${pt(a, 96)} A96 96 0 0 1 ${pt(b, 96)} Z`;
  };

  async function spin() {
    if (busy || bet > wallet.balance || bet <= 0) return;
    const b = bet;
    stake(b);
    busy = true;
    result = null;
    const i = Math.floor(Math.random() * segs.length), step = 360 / segs.length;
    const jitter = (Math.random() - 0.5) * step * 0.7;
    // pointer is at the top: bring segment i to 0deg
    rot = Math.ceil(rot / 360) * 360 + 360 * 5 + (360 - i * step) + jitter;
    sfx('spin');
    await new Promise((r) => setTimeout(r, 4300));
    const m = segs[i], win = Math.round(b * m * 100) / 100;
    settle(win, win);
    result = { m, win };
    history = [{ m, id: ++n }, ...history].slice(0, 14);
    sfx(m >= 10 ? 'big' : m > 0 ? 'win' : 'lose');
    busy = false;
  }
  function key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, select, textarea, button')) return;
    if (e.code === 'Space') { e.preventDefault(); spin(); }
  }
</script>

<svelte:window onkeydown={key} />

<ArcadeLayout eyebrow="Arcade · {segs.length} segments" title={gameName(byId('wheel')!)}>
  {#snippet controls()}
    <button class="btn primary big" disabled={busy || bet > wallet.balance} onclick={spin}>{t('r.spin')}</button>
    <BetInput bind:value={bet} disabled={busy} />
    <div class="field">{t('pl.risk')}
      <div class="seg">
        {#each Object.keys(WHEELS) as r}<button class:on={risk === r} disabled={busy} onclick={() => (risk = r as WheelRisk)}>{t(('risk.' + r) as Key)}</button>{/each}
      </div>
    </div>
    <div class="legend">
      {#each legend as l}<span class="mono" style="--c:{col(l.m)}"><i></i>{l.m}× <em>{l.n}/{segs.length}</em></span>{/each}
    </div>
  {/snippet}

  <div class="stage">
    <div class="wheelbox">
      <svg class="pointer" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 38 L6 8 Q20 0 34 8 Z" /></svg>
      <svg viewBox="-100 -100 200 200" class="wheel" style="transform: rotate({rot}deg)" aria-hidden="true">
        <circle r="99" fill="#141828" />
        {#each segs as m, i}
          <path d={wedge(i, segs.length)} fill={col(m)} stroke="#141828" stroke-width="0.8" />
        {/each}
        {#if segs.length <= 20}
          {#each segs as m, i}
            <text transform="rotate({(i * 360) / segs.length}) translate(0 -78)" class="lbl">{m ? m + '×' : ''}</text>
          {/each}
        {/if}
        <circle r="34" fill="#141828" />
        <circle r="30" fill="url(#hub)" />
        <defs><radialGradient id="hub" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#3a4266" /><stop offset="1" stop-color="#1a1f33" /></radialGradient></defs>
      </svg>
      <div class="hub">
        {#if result}
          <strong class="mono" style="color:{result.m ? col(result.m) : '#ff9a9d'}" in:scale={{ start: 0.9, duration: 450 }}>{result.m}×</strong>
        {/if}
      </div>
    </div>
    <p class="win mono" class:pos={(result?.win ?? 0) > 0}>{result ? (result.win > 0 ? '+' + fmt(result.win) : '0') : ''}</p>
    <div class="hist">
      {#each history as h (h.id)}<span class="mono" style="--c:{col(h.m)}" in:fly={{ x: -10, duration: 250 }}>{h.m}×</span>{/each}
    </div>
  </div>
</ArcadeLayout>

<style>
  .big { min-height: 54px; width: 100%; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.08em; }
  .seg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .seg button { min-height: 38px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--bg-2); font-size: 0.85rem; transition: background-color 0.25s var(--ease-snap), color 0.25s var(--ease-snap), transform 0.16s var(--ease-snap); }
  .seg button.on { background: var(--text); color: var(--bg); }
  .seg button:active:not(:disabled) { transform: scale(0.97); }
  .seg button:disabled:not(.on) { opacity: 0.45; }
  .legend { display: grid; gap: 6px; font-size: 0.8rem; }
  .legend span { display: flex; align-items: center; gap: 8px; }
  .legend i { width: 12px; height: 12px; border-radius: 4px; background: var(--c); }
  .legend em { font-style: normal; color: var(--muted); margin-left: auto; }
  .stage { display: grid; justify-items: center; gap: 14px; padding: clamp(20px, 3vw, 36px); border-radius: 28px; background: radial-gradient(ellipse at 50% 20%, #232a4a, #0d1122 72%); box-shadow: 0 30px 60px -30px rgba(0,0,0,.6); color: #fff; }
  .wheelbox { position: relative; width: min(100%, 440px); aspect-ratio: 1; }
  .wheel { width: 100%; height: 100%; transition: transform 4.2s var(--ease-snap); filter: drop-shadow(0 20px 40px rgba(0,0,0,.5)); }
  .lbl { font: 700 7px 'Geist Mono Variable', monospace; fill: rgba(0,0,0,.72); text-anchor: middle; dominant-baseline: middle; }
  .pointer { position: absolute; left: 50%; top: -6px; width: 34px; height: 34px; translate: -50% 0; z-index: 2; filter: drop-shadow(0 4px 6px rgba(0,0,0,.5)); }
  .pointer path { fill: #f4f2ee; }
  .hub { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
  .hub strong { font-size: clamp(1.4rem, 3.4vw, 2rem); }
  .win { margin: 0; min-height: 1.6em; font-size: 1.4rem; color: rgba(255,255,255,.6); }
  .win.pos { color: #8ff0bf; }
  .hist { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; min-height: 26px; }
  .hist span { padding: 4px 9px; border-radius: 999px; font-size: 0.72rem; background: color-mix(in srgb, var(--c) 25%, transparent); color: color-mix(in srgb, var(--c) 70%, #fff); }
</style>
