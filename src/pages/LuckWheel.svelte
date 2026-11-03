<script lang="ts">
  import { fly, scale } from 'svelte/transition';
  import ArcadeLayout from '../components/ArcadeLayout.svelte';
  import BetInput from '../components/BetInput.svelte';
  import { WHEELS, wheelLayout, type WheelRisk } from '../games/arcade';
  import { wallet, settle, stake, fmt } from '../lib/state.svelte';
  import { byId, gameName } from '../lib/games';
  import { sfx } from '../lib/sfx';
  import { pop } from '../lib/motion';
  import { t, type Key } from '../lib/i18n';

  let bet = $state(10);
  let risk = $state<WheelRisk>('medium');
  const segs = $derived(wheelLayout(risk));
  let rot = $state(0);
  let flick = $state(0);
  let lastIndex = $state(-1);
  let confetti = $state<{ id: number; x: number; y: number; r: number; c: string; d: number }[] | null>(null);
  let busy = $state(false);
  let result = $state<{ m: number; win: number } | null>(null);
  let history = $state<{ m: number; id: number }[]>([]);
  let n = 0;

  const COLORS: Record<string, string> = { '0': '#30355a', '1.2': '#18b5a8', '1.3': '#00d1c1', '1.5': '#2fd17a', '2': '#3d8bff', '3': '#9b5cff', '4.4': '#ffbe2e', '29.1': '#ff3d6e' };
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
    const r0 = rot, r1 = Math.ceil(rot / 360) * 360 + 360 * 5 + (360 - i * step) + jitter;
    const dur = matchMedia('(prefers-reduced-motion: reduce)').matches ? 300 : 4600;
    sfx('spin');
    await new Promise<void>((done) => {
      const t0 = performance.now();
      let lastSeg = Math.floor((r0 + step / 2) / step), kick = 0;
      const frame = (now: number) => {
        const k = Math.min(1, (now - t0) / dur);
        rot = r0 + (r1 - r0) * (1 - Math.pow(1 - k, 4));
        // every segment edge that passes the pointer ticks and flicks it
        const seg = Math.floor((rot + step / 2) / step);
        if (seg !== lastSeg) { lastSeg = seg; kick = now; sfx('tick'); }
        flick = -24 * Math.max(0, 1 - (now - kick) / 140);
        if (k < 1) requestAnimationFrame(frame);
        else { flick = 0; done(); }
      };
      requestAnimationFrame(frame);
    });
    lastIndex = i;
    const m = segs[i], win = Math.round(b * m * 100) / 100;
    if (m > 1) {
      const palette = ['#f2c046', '#ff5d63', '#4fe3a0', '#6aa8ff', '#b57bff', '#ffffff'];
      confetti = Array.from({ length: m >= 4 ? 60 : 30 }, (_, k) => {
        const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 180;
        return { id: n * 100 + k, x: Math.cos(a) * d, y: Math.sin(a) * d - 60, r: Math.random() * 720 - 360, c: palette[k % palette.length], d: Math.random() * 120 };
      });
      setTimeout(() => (confetti = null), 1600);
    }
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

  <div class="stage" class:spinning={busy}>
    <div class="rays" aria-hidden="true"></div>
    <div class="wheelbox">
      <svg class="pointer" viewBox="0 0 40 52" aria-hidden="true" style="rotate:{flick}deg">
        <defs><linearGradient id="pin" x1="0" x2="1"><stop offset="0" stop-color="#ff7a7f" /><stop offset="1" stop-color="#b3202a" /></linearGradient></defs>
        <path d="M20 50 L5 14 A16 16 0 1 1 35 14 Z" fill="url(#pin)" stroke="#fff" stroke-width="2.5" stroke-linejoin="round" />
        <circle cx="20" cy="15" r="5.5" fill="#fff" />
      </svg>
      <div class="rim" aria-hidden="true">
        {#each Array(24) as _, i}<i style="--i:{i}; transform: rotate({i * 15}deg) translateY(calc(var(--r) * -1))"></i>{/each}
      </div>
      <svg viewBox="-100 -100 200 200" class="wheel" style="transform: rotate({rot}deg)" aria-hidden="true">
        <defs>
          {#each Object.entries(COLORS) as [m, c]}
            <radialGradient id="g{m.replace('.', '_')}" cx="0" cy="0" r="96" gradientUnits="userSpaceOnUse">
              <stop offset="0.35" stop-color={c} stop-opacity=".75" /><stop offset="1" stop-color={c} />
            </radialGradient>
          {/each}
        </defs>
        {#each segs as m, i}
          <path d={wedge(i, segs.length)} fill="url(#g{String(m).replace('.', '_')})" stroke="rgba(255,255,255,.85)" stroke-width="0.9" class:hit={result && !busy && i === lastIndex} />
        {/each}
        {#each segs as m, i}
          {#if segs.length <= 20 || m}
            <text transform="rotate({(i * 360) / segs.length}) translate(0 -74)" class="lbl" class:z={!m}>{m ? m + '×' : '0'}</text>
          {/if}
        {/each}
        <circle r="98" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="1" />
      </svg>
      <button class="hubbtn" disabled={busy || bet > wallet.balance} onclick={spin} aria-label={t('r.spin')}>
        {#if result && !busy}
          {#key result}<strong class="mono" style="color:{result.m ? col(result.m) : '#ff9a9d'}" in:pop>{result.m}×</strong>{/key}
        {:else}<span>{t('r.spin')}</span>{/if}
      </button>
      {#if confetti}
        <div class="confetti" aria-hidden="true">
          {#each confetti as c (c.id)}<i style="--x:{c.x}px; --y:{c.y}px; --r:{c.r}deg; --c:{c.c}; --d:{c.d}ms"></i>{/each}
        </div>
      {/if}
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
  .stage { position: relative; overflow: hidden; display: grid; justify-items: center; gap: 14px; padding: clamp(24px, 3vw, 40px); border-radius: 28px; background: radial-gradient(ellipse at 50% 40%, #3a1d6e, #140a2e 70%); box-shadow: 0 30px 60px -30px rgba(0,0,0,.6); color: #fff; }
  .rays { position: absolute; left: 50%; top: 44%; width: 160%; aspect-ratio: 1; translate: -50% -50%; background: repeating-conic-gradient(rgba(255,255,255,.06) 0 6deg, transparent 6deg 18deg); animation: rays 40s linear infinite; pointer-events: none; mask-image: radial-gradient(closest-side, #000 30%, transparent); }
  .stage.spinning .rays { animation-duration: 8s; }
  @keyframes rays { to { rotate: 360deg; } }
  .wheelbox { --r: 46.6cqw; position: relative; width: min(100%, 440px); aspect-ratio: 1; container-type: inline-size; }
  .wheel { position: absolute; inset: 5%; width: 90%; height: 90%; will-change: transform; filter: drop-shadow(0 16px 30px rgba(0,0,0,.5)); }
  .wheel path { transition: filter 0.3s var(--ease-snap); }
  .wheel path.hit { filter: brightness(1.35) drop-shadow(0 0 6px #fff); animation: segpulse 0.8s var(--ease-snap) 3; }
  @keyframes segpulse { 50% { filter: brightness(1.7) drop-shadow(0 0 10px #fff); } }
  .lbl { font: 800 7.5px 'Geist Variable', sans-serif; fill: #fff; text-anchor: middle; dominant-baseline: middle; paint-order: stroke; stroke: rgba(0,0,0,.45); stroke-width: 1.6px; }
  .lbl.z { fill: rgba(255,255,255,.4); font-size: 6px; stroke-width: 0; }
  .rim { position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(closest-side, transparent 88%, #d39a2c 89%, #f7d77a 93%, #a8741a 97%, transparent 98%); }
  .rim i { position: absolute; left: 50%; top: 50%; width: 3.2%; height: 3.2%; margin: -1.6% 0 0 -1.6%; border-radius: 50%; background: #fff4c2; box-shadow: 0 0 8px #ffd34d; animation: bulb 1.2s steps(1) infinite; animation-delay: calc(var(--i) * -0.1s); }
  .rim i { transform-origin: center; }
  .stage.spinning .rim i { animation-duration: 0.36s; }
  @keyframes bulb { 50% { background: #7a5a1a; box-shadow: none; } }
  .pointer { position: absolute; left: 50%; top: -2%; width: 11%; translate: -50% 0; z-index: 3; transform-origin: 50% 28%; filter: drop-shadow(0 4px 6px rgba(0,0,0,.5)); }
  .hubbtn {
    position: absolute; left: 50%; top: 50%; width: 27%; aspect-ratio: 1; translate: -50% -50%; border-radius: 50%; border: 0; z-index: 2; display: grid; place-items: center;
    background: radial-gradient(circle at 38% 30%, #ffffff, #e9e3ff 25%, #8f7bd9 70%, #4b3a8f); box-shadow: 0 0 0 5px #f2c046, 0 0 0 8px #8a5d12, 0 12px 30px rgba(0,0,0,.55), inset 0 -6px 12px rgba(0,0,0,.25);
    color: #2a1a5e; font: 800 clamp(0.8rem, 2.6cqw, 1.1rem) 'Geist Variable', sans-serif; letter-spacing: 0.08em; text-transform: uppercase; transition: transform 0.35s var(--ease-snap);
  }
  .hubbtn:not(:disabled) { animation: breathe 1.8s var(--ease-snap) infinite alternate; }
  .hubbtn:hover:not(:disabled) { transform: scale(1.05); }
  .hubbtn:active:not(:disabled) { transform: scale(0.96); }
  @keyframes breathe { to { box-shadow: 0 0 0 5px #f2c046, 0 0 0 8px #8a5d12, 0 0 30px 6px rgba(242,192,70,.45), inset 0 -6px 12px rgba(0,0,0,.25); } }
  .hubbtn strong { font-size: clamp(1.1rem, 4.4cqw, 1.8rem); text-shadow: 0 1px 0 rgba(255,255,255,.6); }
  .confetti { position: absolute; left: 50%; top: 50%; pointer-events: none; z-index: 4; }
  .confetti i { position: absolute; width: 8px; height: 12px; border-radius: 2px; background: var(--c); animation: conf 1.4s var(--ease-snap) var(--d) both; }
  @keyframes conf { 0% { transform: translate(0, 0) rotate(0); opacity: 1; } 70% { opacity: 1; } 100% { transform: translate(var(--x), calc(var(--y) + 160px)) rotate(var(--r)); opacity: 0; } }
  .win { margin: 0; min-height: 1.6em; font-size: 1.4rem; color: rgba(255,255,255,.6); }
  .win.pos { color: #8ff0bf; }
  .hist { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; min-height: 26px; }
  .hist span { padding: 4px 9px; border-radius: 999px; font-size: 0.72rem; background: color-mix(in srgb, var(--c) 25%, transparent); color: color-mix(in srgb, var(--c) 70%, #fff); }
</style>
