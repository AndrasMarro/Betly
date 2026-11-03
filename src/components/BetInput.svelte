<script lang="ts">
  import { wallet } from '../lib/state.svelte';
  import { t } from '../lib/i18n';
  let { value = $bindable(10), disabled = false }: { value?: number; disabled?: boolean } = $props();
  const fix = (v: number) => (value = Math.max(1, Math.min(Math.floor(wallet.balance) || 1, Math.round(v * 100) / 100 || 1)));
</script>

<div class="bet">
  <label class="field">{t('a.bet')}
    <input class="mono" type="number" min="1" step="1" inputmode="decimal" bind:value {disabled} onchange={() => fix(value)} />
  </label>
  <div class="q">
    <button class="btn sm" type="button" {disabled} onclick={() => fix(value / 2)}>½</button>
    <button class="btn sm" type="button" {disabled} onclick={() => fix(value * 2)}>2×</button>
    <button class="btn sm" type="button" {disabled} onclick={() => fix(wallet.balance)}>Max</button>
  </div>
</div>

<style>
  .bet { display: grid; gap: 8px; }
  .q { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .q .btn { padding: 0; }
  input { width: 100%; font-size: 1.05rem; }
</style>
