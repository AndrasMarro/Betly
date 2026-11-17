<script lang="ts">
  // One lotto ticket as a small card: 42 numbers, 6 lucky numbers. Editable, or showing its hits after a draw.
  import { LOTTO_N, LOTTO_K, LUCKY } from '../games/lotto';
  type Ticket = { nums: number[]; lucky: number };
  let { ticket, label, drawn = [], lucky = 0, edit = false, result = '', win = false, onchange, onquick, onremove }: {
    ticket: Ticket; label: string; drawn?: number[]; lucky?: number; edit?: boolean; result?: string; win?: boolean;
    onchange?: (t: Ticket) => void; onquick?: () => void; onremove?: () => void;
  } = $props();

  function pick(n: number) {
    if (!edit) return;
    const nums = ticket.nums.includes(n) ? ticket.nums.filter((x) => x !== n) : ticket.nums.length < LOTTO_K ? [...ticket.nums, n].sort((a, b) => a - b) : ticket.nums;
    onchange?.({ ...ticket, nums });
  }
</script>

<div class="card" class:edit class:win>
  <div class="top">
    <span class="lbl">{label}</span>
    <span class="mono cnt" class:ok={ticket.nums.length === LOTTO_K && ticket.lucky}>{result || `${ticket.nums.length}/${LOTTO_K}`}</span>
    {#if edit && onquick}<button class="ic" onclick={onquick} aria-label="Quick">🎲</button>{/if}
    {#if edit && onremove}<button class="ic" onclick={onremove} aria-label="×">×</button>{/if}
  </div>
  <div class="nums">
    {#each Array(LOTTO_N) as _, i}
      {@const n = i + 1}
      {@const on = ticket.nums.includes(n)}
      {@const out = drawn.includes(n)}
      <button class="mono" class:on class:out class:hit={on && out} disabled={!edit} onclick={() => pick(n)}>{n}</button>
    {/each}
  </div>
  <div class="lucky">
    {#each Array(LUCKY) as _, i}
      {@const on = ticket.lucky === i + 1}
      <button class="mono" class:on class:out={lucky === i + 1} class:hit={on && lucky === i + 1} disabled={!edit} onclick={() => edit && onchange?.({ ...ticket, lucky: on ? 0 : i + 1 })}>★{i + 1}</button>
    {/each}
  </div>
</div>

<style>
  .card {
    position: relative; display: grid; gap: 8px; padding: 12px; border-radius: 16px; color: #f3e6c4;
    background: linear-gradient(160deg, #4a1426, #2a0a16 70%);
    box-shadow: inset 0 0 0 1px rgba(232,196,120,.55), inset 0 0 0 4px rgba(0,0,0,.25), inset 0 0 0 5px rgba(232,196,120,.18), 0 14px 28px -16px rgba(0,0,0,.8);
  }
  .card.win { box-shadow: inset 0 0 0 2px #6ff0a6, 0 0 24px -4px rgba(111,240,166,.45); }
  .top { display: flex; align-items: center; gap: 6px; min-height: 24px; }
  .lbl { flex: 1; font: italic 400 1.05rem 'Instrument Serif', Georgia, serif; letter-spacing: 0.02em; color: #e8c478; }
  .cnt { font-size: 0.75rem; color: rgba(243,230,196,.55); }
  .cnt.ok { color: #e8c478; }
  .win .cnt { color: #6ff0a6; font-weight: 700; }
  .ic { border: 0; background: rgba(0,0,0,.25); color: #f3e6c4; width: 24px; height: 24px; border-radius: 7px; padding: 0; font-size: 0.8rem; line-height: 1; }
  .ic:hover { background: rgba(232,196,120,.25); }
  .nums { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
  .lucky { display: grid; grid-template-columns: repeat(6, 1fr); gap: 3px; padding-top: 6px; border-top: 1px dashed rgba(232,196,120,.3); }
  button.mono { aspect-ratio: 1.25; padding: 0; border: 0; border-radius: 6px; background: rgba(0,0,0,.22); color: rgba(243,230,196,.75); font-size: 0.72rem; font-weight: 600; transition: transform 0.15s var(--ease-snap), background 0.2s; }
  .lucky button.mono { aspect-ratio: 1.6; font-size: 0.66rem; color: rgba(232,196,120,.8); }
  .lucky button.on { color: #2a1604; }
  .lucky button.hit { color: #04311b; }
  .edit button.mono:hover { transform: scale(1.1); background: rgba(232,196,120,.2); }
  button.mono:disabled { cursor: default; }
  button.on { background: radial-gradient(circle at 35% 30%, #fbe7ae, #d8a845); color: #2a1604; box-shadow: 0 2px 4px rgba(0,0,0,.4); }
  button.out:not(.on) { box-shadow: inset 0 0 0 1.5px rgba(255,255,255,.45); color: #fff; }
  button.hit { background: radial-gradient(circle at 35% 30%, #c4fbe0, #2fbf71); color: #04311b; animation: pop 0.45s var(--spring-snappy); }
  @keyframes pop { from { transform: scale(0.6); } }
</style>
