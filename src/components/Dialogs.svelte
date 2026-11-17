<script lang="ts">
  import { settings, wallet, ui, claimBonus, bonusReadyIn, resetWallet, fmt, BROKE, type Theme } from '../lib/state.svelte';
  import { t } from '../lib/i18n';
  import { sfx } from '../lib/sfx';
  import DeckSelect from './DeckSelect.svelte';
  import { JASS, FULL } from '../lib/decks';
  import { account, signIn, signOut, deleteAccount, exportData } from '../lib/account.svelte';

  let credits: HTMLDialogElement, prefs: HTMLDialogElement, gate: HTMLDialogElement, acct: HTMLDialogElement;
  let draft = $state('');
  let now = $state(Date.now());

  $effect(() => { if (ui.credits) credits.showModal(); else credits.close(); });
  $effect(() => { if (ui.settings) prefs.showModal(); else prefs.close(); });
  $effect(() => { if (ui.account) acct.showModal(); else acct.close(); });
  // the welcome screen's Google button: the notice counts as read, then off to Google
  function welcomeGoogle() {
    settings.accepted = true;
    signIn();
  }
  $effect(() => {
    if (ui.nameAsk) { draft = settings.name; if (!gate.open) gate.showModal(); }
    else if (gate.open) gate.close();
  });
  function confirmName(e: SubmitEvent) {
    e.preventDefault();
    const n = draft.trim().slice(0, 20);
    if (!n) return;
    settings.name = n;
    settings.accepted = true;
    ui.nameAsk?.(true);
  }
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

{#snippet google(onclick: () => void)}
    <button type="button" class="btn google" disabled={account.busy} {onclick}>
      <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
      {t('acc.google')}
    </button>
{/snippet}

<dialog bind:this={acct} onclose={() => (ui.account = false)} onclick={(e) => e.target === acct && (ui.account = false)}>
  <div class="dlg">
    <header><h2>{t('acc.title')}</h2><button class="btn icon sm ghost" onclick={() => (ui.account = false)} aria-label={t('close')}>×</button></header>
    {#if account.user}
      <div class="who">
        {#if account.user.avatar}<img src={account.user.avatar} alt="" referrerpolicy="no-referrer" />{/if}
        <div><strong>{account.user.name ?? settings.name}</strong><span class="small muted">{account.user.email}</span></div>
      </div>
      <p class="small muted">{t('acc.synced')}</p>
      <label class="field">{t('settings.name')}<input bind:value={settings.name} maxlength="20" /></label>
      <div class="acc">
        <button class="btn sm" onclick={exportData}>{t('acc.export')}</button>
        <button class="btn sm" disabled={account.busy} onclick={signOut}>{t('acc.signOut')}</button>
        <button class="btn sm ghost danger" disabled={account.busy} onclick={deleteAccount}>{t('acc.delete')}</button>
      </div>
    {:else}
      {@render google(signIn)}
      <p class="small muted">{t('acc.why')}</p>
    {/if}
    {#if account.error}<p class="small accent">{t('acc.error')} ({account.error})</p>{/if}
  </div>
</dialog>

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
    <div class="field">{settings.lang === 'de' ? 'Kartenblatt' : 'Card deck'}
      <span class="small muted">Jass &amp; Durak</span>
      <DeckSelect supported={JASS} lang={settings.lang} />
      <span class="small muted">Blackjack, Hold'em, Baccarat, Three Card, Hi-Lo</span>
      <DeckSelect supported={FULL} which="cards52" lang={settings.lang} />
    </div>
    <label class="switch"><span>{t('settings.bots')}</span><input type="checkbox" bind:checked={settings.bots} /></label>
    <label class="switch"><span>{t('settings.sound')}</span><input type="checkbox" bind:checked={settings.sound} /></label>
    <label class="vol" class:off={!settings.sound}><span>{t('settings.sfxVol')}</span><input type="range" min="0" max="1" step="0.05" bind:value={settings.sfxVol} disabled={!settings.sound} onchange={() => sfx('chip')} /><b class="mono">{Math.round(settings.sfxVol * 100)}</b></label>
    <label class="switch"><span>{t('settings.music')}</span><input type="checkbox" bind:checked={settings.music} /></label>
    <label class="vol" class:off={!settings.music || !settings.sound}><span>{t('settings.musicVol')}</span><input type="range" min="0" max="1" step="0.05" bind:value={settings.musicVol} disabled={!settings.music || !settings.sound} /><b class="mono">{Math.round(settings.musicVol * 100)}</b></label>
  </div>
</dialog>

<dialog bind:this={gate} oncancel={(e) => { e.preventDefault(); if (!ui.welcome) ui.nameAsk?.(false); }}>
  <form class="dlg" onsubmit={confirmName}>
    {#if ui.welcome}
      <p class="eyebrow">Betly</p>
      <h2>{t('gate.title')}</h2>
      <p class="muted">{t('gate.text')}</p>
      <div class="seg">
        <button type="button" class:on={settings.lang === 'de'} onclick={() => (settings.lang = 'de')}>Deutsch</button>
        <button type="button" class:on={settings.lang === 'en'} onclick={() => (settings.lang = 'en')}>English</button>
      </div>
      {@render google(welcomeGoogle)}
      <p class="small muted">{t('acc.welcome')}</p>
      <p class="or small muted"><span>{t('acc.guest')}</span></p>
    {:else}
      <h2>{t('name.title')}</h2>
    {/if}
    <label class="field">{t('settings.name')}
      <!-- svelte-ignore a11y_autofocus -->
      <input bind:value={draft} maxlength="20" autofocus autocomplete="nickname" enterkeyhint="go" />
    </label>
    <button class="btn primary big" disabled={!draft.trim()}>{ui.welcome ? t('gate.ok') : t('name.ok')}</button>
    {#if ui.welcome}
      <p class="small muted links"><a href="#/haftung">{t('legal.disclaimer')}</a> · <a href="#/datenschutz">{t('legal.privacy')}</a></p>
    {:else}
      <button type="button" class="btn sm ghost" onclick={() => ui.nameAsk?.(false)}>{t('name.cancel')}</button>
    {/if}
  </form>
</dialog>

<style>
  .vol { display: grid; grid-template-columns: 1fr minmax(120px, 1.4fr) 30px; align-items: center; gap: 10px; font-size: 0.85rem; color: var(--muted); padding-left: 12px; }
  .vol input { accent-color: var(--accent); width: 100%; }
  .vol b { font-weight: 500; font-size: 0.78rem; text-align: right; }
  .vol.off { opacity: 0.45; }
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
  .acc { display: flex; flex-wrap: wrap; gap: 8px; }
  .google { display: inline-flex; align-items: center; justify-content: center; gap: 10px; width: 100%; min-height: 44px; }
  .danger { color: var(--accent); }
  .who { display: flex; align-items: center; gap: 12px; }
  .who img { width: 48px; height: 48px; border-radius: 50%; }
  .who div { display: grid; gap: 2px; }
  .or { display: flex; align-items: center; gap: 10px; }
  .or::before, .or::after { content: ''; flex: 1; border-top: 1px solid var(--line-2); }
</style>
