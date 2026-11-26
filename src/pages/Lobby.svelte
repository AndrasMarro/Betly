<script lang="ts">
  import { untrack } from 'svelte';
  import GameSection from '../components/GameSection.svelte';
  import { t, type Key } from '../lib/i18n';
  import { GAMES, type Cat } from '../lib/games';
  let { page }: { page: Cat } = $props();
  // Arcade has a sub-filter: the party games (everything you can play together, from both categories)
  let party = $state(untrack(() => page === 'arcade') && /[?&]party/.test(location.hash)); // the page is re-created per route
  let q = $state('');
  function setParty(on: boolean) {
    party = on;
    history.replaceState(history.state, '', '#/' + page + (on ? '?party' : ''));
  }
  const partyCount = GAMES.filter((g) => g.party && g.live).length;
</script>

<div class="wrap lobby">
  <p class="eyebrow">{party ? t('party.eyebrow') : t(('cat.' + page + '.eyebrow') as Key)}</p>
  <h1>{party ? t('party.title') : t(('cat.' + page) as Key)}</h1>
  <p class="sub">{party ? t('party.text') : t(('cat.' + page + '.text') as Key)}</p>
  <div class="bar">
    {#if page === 'arcade'}
      <div class="chips" role="tablist">
        <button role="tab" aria-selected={!party} class:on={!party} onclick={() => setParty(false)}>{t('party.all')}</button>
        <button role="tab" aria-selected={party} class:on={party} onclick={() => setParty(true)}>👥 {t('party.title')} <span class="mono">{partyCount}</span></button>
      </div>
    {/if}
    <label class="search">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" /><path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
      <input type="search" bind:value={q} placeholder={t('home.search')} aria-label={t('home.search')} />
    </label>
  </div>
  {#key party}
    <GameSection cat={page} title={false} {q} {party} />
  {/key}
</div>

<style>
  .lobby { padding: 40px 0 100px; }
  h1 { margin: 8px 0 10px; font-size: clamp(2.6rem, 7vw, 5.5rem); letter-spacing: -0.05em; line-height: 0.92; }
  .sub { margin: 0 0 20px; color: var(--muted); max-width: 52ch; }
  .bar { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: center; justify-content: space-between; margin-bottom: 18px; }
  .chips { display: flex; gap: 4px; padding: 4px; border-radius: 999px; border: 1px solid var(--line-2); background: var(--surface); }
  .chips button { border: 0; background: none; color: var(--muted); min-height: 38px; padding: 0 16px; border-radius: 999px; font-weight: 600; font-size: 0.88rem; transition: background 0.3s var(--ease-snap), color 0.3s var(--ease-snap); }
  .chips button:active { transform: scale(0.97); }
  .chips button.on { background: var(--text); color: var(--bg); }
  .chips .mono { opacity: 0.6; font-size: 0.75rem; margin-left: 4px; }
  .search { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--line-2); background: var(--surface); color: var(--muted); min-width: min(100%, 280px); }
  .search:focus-within { border-color: var(--accent); }
  .search input { flex: 1; min-width: 0; border: 0; background: none; color: var(--text); font: inherit; outline: none; }
</style>
