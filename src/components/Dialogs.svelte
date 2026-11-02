<script lang="ts">
  import { settings, wallet, ui, claimBonus, bonusReadyIn, resetWallet, fmt, BROKE, type Theme } from '../lib/state.svelte';
  import { t } from '../lib/i18n';
  import { sfx } from '../lib/sfx';

  let credits: HTMLDialogElement, prefs: HTMLDialogElement, gate: HTMLDialogElement;
  let now = $state(Date.now());

  $effect(() => { if (ui.credits) credits.showModal(); else credits.close(); });
  $effect(() => { if (ui.settings) prefs.showModal(); else prefs.close(); });
  $effect(() => { if (!settings.accepted && !gate.open) gate.showModal(); });
  $effect(() => {
    if (!ui.credits) return;
    const id = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(id);
  });

  const wait = $derived(bonusReadyIn(now));
  const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
  function claim() {
    if (claimBonus()) sfx('win');
    now = Date.now();
  }
  const themes: Theme[] = ['noir', 'midnight', 'ivory'];
</script>

<dialog bind:this={credits} onclose={() => (ui.credits = false)} onclick={(e) => e.target === credits && (ui.credits = false)}>
  <div class="dlg">
    <header><h2>{t('credits.title')}</h2><button class="btn icon sm ghost" onclick={() => (ui.credits = false)} aria-label={t('close')}>×</button></header>
    <div class="bal">
      <span class="eyebrow">{t('credits.balance')}</span>
      <strong class="mono">{fmt(wallet.balance)}</strong>
    </div>
    <button class="btn primary big" disabled={wait > 0} onclick={claim}>
      {#if wait > 0}{t('credits.next')} <span class="mono">{mmss(wait)}</span>{:else}{t('credits.bonus')}{/if}
    </button>
    {#if wallet.balance < BROKE}<p class="small accent">{t('credits.broke')}</p>{/if}
    <p class="small muted">{t('credits.info')}</p>
    <dl class="stats">
      <div><dt>{t('credits.biggest')}</dt><dd class="mono">{fmt(wallet.biggestWin)}</dd></div>
      <div><dt>{t('credits.rounds')}</dt><dd class="mono">{fmt(wallet.rounds)}</dd></div>
    </dl>
    <button class="btn sm ghost" onclick={() => confirm(t('credits.resetConfirm')) && resetWallet()}>{t('credits.reset')}</button>
  </div>
</dialog>

<dialog bind:this={prefs} onclose={() => (ui.settings = false)} onclick={(e) => e.target === prefs && (ui.settings = false)}>
  <div class="dlg">
    <header><h2>{t('settings.title')}</h2><button class="btn icon sm ghost" onclick={() => (ui.settings = false)} aria-label={t('close')}>×</button></header>
    <label class="field">{t('settings.name')}<input bind:value={settings.name} maxlength="20" /></label>
    <div class="field">{t('settings.lang')}
      <div class="seg">
        <button class:on={settings.lang === 'de'} onclick={() => (settings.lang = 'de')}>Deutsch</button>
        <button class:on={settings.lang === 'en'} onclick={() => (settings.lang = 'en')}>English</button>
      </div>
    </div>
    <div class="field">{t('settings.theme')}
      <div class="themes">
        {#each themes as th}
          <button class="th" data-theme={th} class:on={settings.theme === th} onclick={() => (settings.theme = th)}>
            <span class="sw"></span>{t(('theme.' + th) as any)}
          </button>
        {/each}
      </div>
    </div>
    <label class="switch"><span>{t('settings.bots')}</span><input type="checkbox" bind:checked={settings.bots} /></label>
    <label class="switch"><span>{t('settings.sound')}</span><input type="checkbox" bind:checked={settings.sound} /></label>
  </div>
</dialog>

<dialog bind:this={gate} oncancel={(e) => e.preventDefault()}>
  <div class="dlg">
    <p class="eyebrow">Betly</p>
    <h2>{t('gate.title')}</h2>
    <p class="muted">{t('gate.text')}</p>
    <div class="seg">
      <button class:on={settings.lang === 'de'} onclick={() => (settings.lang = 'de')}>Deutsch</button>
      <button class:on={settings.lang === 'en'} onclick={() => (settings.lang = 'en')}>English</button>
    </div>
    <!-- svelte-ignore a11y_autofocus -->
    <button class="btn primary big" autofocus onclick={() => { settings.accepted = true; gate.close(); }}>{t('gate.ok')}</button>
    <p class="small muted links"><a href="#/haftung">{t('legal.disclaimer')}</a> · <a href="#/datenschutz">{t('legal.privacy')}</a></p>
  </div>
</dialog>

<style>
  .dlg { display: grid; gap: 16px; padding: 24px; }
  header { display: flex; justify-content: space-between; align-items: center; }
  h2 { margin: 0; font-size: 1.6rem; letter-spacing: -0.03em; }
  .bal { display: grid; gap: 6px; }
  .bal strong { font-size: 2.4rem; letter-spacing: -0.03em; }
  .big { min-height: 52px; width: 100%; }
  .small { font-size: 0.82rem; margin: 0; }
  .muted { color: var(--muted); margin: 0; }
  .accent { color: var(--accent); }
  .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 0; }
  .stats div { background: var(--bg-2); border-radius: 14px; padding: 10px 12px; }
  dt { font-size: 0.75rem; color: var(--muted); }
  dd { margin: 2px 0 0; font-size: 1.05rem; }
  .seg { display: flex; border: 1px solid var(--line-2); border-radius: 999px; padding: 3px; gap: 3px; }
  .seg button { flex: 1; border: 0; background: none; min-height: 36px; border-radius: 999px; }
  .seg button.on { background: var(--text); color: var(--bg); }
  .themes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .th { display: grid; gap: 8px; justify-items: start; padding: 10px; border-radius: 14px; border: 1px solid var(--line-2); background: var(--bg); color: var(--text); font-size: 0.8rem; }
  .th.on { outline: 2px solid var(--accent); outline-offset: 1px; }
  .sw { width: 100%; height: 34px; border-radius: 8px; background: linear-gradient(135deg, var(--bg) 0 50%, var(--felt) 50% 80%, var(--accent) 80%); border: 1px solid var(--line-2); }
  .links a { color: var(--muted); }
</style>
