<script lang="ts">
  // "How to play" button plus dialog with the game's guide (and the poker hand rankings where relevant).
  import { GUIDES } from '../lib/guides';
  import HandRanks from './HandRanks.svelte';
  import { settings } from '../lib/state.svelte';
  import { t } from '../lib/i18n';
  let { id, label = true }: { id: string; label?: boolean } = $props();
  const guide = $derived(GUIDES[id]);
  let dlg = $state<HTMLDialogElement>()!;
</script>

{#if guide}
  <button class="btn sm howto" onclick={() => dlg.showModal()} aria-label={t('howto')}>
    <span class="q" aria-hidden="true">?</span>{#if label}<span>{t('howto')}</span>{/if}
  </button>
  <dialog bind:this={dlg} class="guide" onclick={(e) => e.target === dlg && dlg.close()}>
    <div class="dlg">
      <header><h2>{t('howto')}</h2><button class="btn icon sm ghost" onclick={() => dlg.close()} aria-label={t('close')}>×</button></header>
      {#each settings.lang === 'de' ? guide.de : guide.en as s}
        <section>
          <h3 class="eyebrow">{s.h}</h3>
          {#if s.p}<p>{s.p}</p>{/if}
          {#if s.li}<ul>{#each s.li as x}<li>{x}</li>{/each}</ul>{/if}
        </section>
      {/each}
      {#if guide.ranks}
        <section><h3 class="eyebrow">{t('pk.ranks')}</h3><HandRanks /></section>
      {/if}
    </div>
  </dialog>
{/if}

<style>
  .howto { gap: 8px; padding-left: 6px; }
  .q { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: var(--surface-2); font-weight: 700; font-size: 0.8rem; }
  .guide { width: min(640px, calc(100% - 24px)); max-height: min(86dvh, 900px); }
  .dlg { padding: 22px 24px 26px; display: grid; gap: 16px; }
  header { display: flex; justify-content: space-between; align-items: center; position: sticky; top: -22px; margin: -22px -24px 0; padding: 18px 24px 10px; background: var(--surface); z-index: 1; }
  h2 { margin: 0; font-size: 1.35rem; letter-spacing: -0.03em; }
  h3 { margin: 0 0 6px; }
  section p { margin: 0; color: var(--text); font-size: 0.92rem; }
  ul { margin: 0; padding-left: 18px; display: grid; gap: 5px; font-size: 0.92rem; }
  li::marker { color: var(--accent); }
</style>
