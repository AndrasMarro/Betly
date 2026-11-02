<script lang="ts">
  import { CHIPS, short } from '../lib/chips';
  import { sfx } from '../lib/sfx';
  let { value = $bindable(25), max = Infinity }: { value?: number; max?: number } = $props();
</script>

<div class="tray" role="radiogroup" aria-label="Chip">
  {#each CHIPS as c}
    <button
      class="chip"
      data-v={c}
      class:on={value === c}
      role="radio"
      aria-checked={value === c}
      disabled={c > max}
      onclick={() => { value = c; sfx('chip'); }}>{short(c)}</button>
  {/each}
</div>

<style>
  .tray { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: center; }
  .chip { cursor: pointer; transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s; }
  .chip:hover:not(:disabled) { transform: translateY(-3px); }
  .chip.on { transform: translateY(-6px) scale(1.08); box-shadow: inset 0 0 0 2px rgba(0,0,0,.25), 0 0 0 3px var(--bg), 0 0 0 5px var(--accent), 0 10px 20px -6px rgba(0,0,0,.7); }
  .chip:disabled { opacity: 0.3; cursor: not-allowed; }
</style>
