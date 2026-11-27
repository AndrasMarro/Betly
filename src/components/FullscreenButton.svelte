<script lang="ts" module>
  /** Is something on the page in full screen right now (kept in sync with the browser)? */
  export const fs = $state({ on: false });
  if (typeof document !== 'undefined') document.addEventListener('fullscreenchange', () => (fs.on = !!document.fullscreenElement));
  /** Puts `el` in full screen, or leaves it. Browsers only allow this right after a click or key press. */
  export async function toggleFullscreen(el: HTMLElement | undefined | null, want = !document.fullscreenElement) {
    try {
      if (want && el && !document.fullscreenElement) await el.requestFullscreen({ navigationUI: 'hide' });
      else if (!want && document.fullscreenElement) await document.exitFullscreen();
    } catch { /* not allowed here (iPhone Safari has no full screen for elements) */ }
  }
  export const canFullscreen = () => typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;
</script>

<script lang="ts">
  // Square button that puts a game area in full screen and back.
  import { settings } from '../lib/state.svelte';
  let { target }: { target: HTMLElement | undefined } = $props();
  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
</script>

{#if canFullscreen()}
  <button class="fsbtn" onclick={() => toggleFullscreen(target)} aria-label={fs.on ? L('Vollbild beenden', 'Exit full screen') : L('Vollbild', 'Full screen')} title={fs.on ? L('Vollbild beenden (Esc)', 'Exit full screen (Esc)') : L('Vollbild', 'Full screen')}>
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      {#if fs.on}<path d="M9 4v5H4 M15 4v5h5 M9 20v-5H4 M15 20v-5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      {:else}<path d="M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />{/if}
    </svg>
  </button>
{/if}

<style>
  .fsbtn { width: 38px; height: 38px; display: grid; place-items: center; padding: 0; border-radius: 12px; border: 1px solid var(--line-2); background: color-mix(in srgb, var(--surface) 85%, transparent); color: var(--text); backdrop-filter: blur(6px); transition: transform 0.25s var(--spring-snappy), border-color 0.25s var(--ease-snap); }
  .fsbtn:hover { border-color: var(--text); transform: scale(1.06); }
  .fsbtn:active { transform: scale(0.92); }
</style>
