<script lang="ts">
  // Search all games from anywhere: the magnifier in the nav, "/" or Ctrl/Cmd+K. Arrow keys pick, Enter opens.
  import { GAMES, gameName, href, matches, score, type Game } from '../lib/games';
  import { ui } from '../lib/state.svelte';
  import { t, type Key } from '../lib/i18n';

  let dlg: HTMLDialogElement, input: HTMLInputElement;
  let q = $state('');
  let sel = $state(0);
  let viaKeys = false; // opened by keyboard: no animation, speed is the point
  const live = GAMES.filter((g) => g.live);
  let filter = $state<'all' | 'classic' | 'arcade' | 'party'>('all');
  const inFilter = (g: Game) => filter === 'all' || (filter === 'party' ? !!g.party : g.cat === filter);
  // empty query: the quick words, or with a filter set every game in it
  const results = $derived(q.trim()
    ? live.filter((g) => inFilter(g) && matches(g, q, t(('game.' + g.id) as Key))).sort((a, b) => score(a, q) - score(b, q) || gameName(a).localeCompare(gameName(b)))
    : filter === 'all' ? [] : live.filter(inFilter).sort((a, b) => gameName(a).localeCompare(gameName(b))));
  $effect(() => { void filter; sel = 0; });
  $effect(() => { void q; sel = 0; });
  $effect(() => {
    if (ui.search && !dlg.open) { q = ''; filter = 'all'; dlg.classList.toggle('instant', viaKeys); dlg.showModal(); input.focus(); }
    else if (!ui.search && dlg.open) dlg.close();
    viaKeys = false;
  });
  function go(g: Game | undefined) {
    if (!g) return;
    ui.search = false;
    location.hash = href(g);
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(results.length - 1, sel + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); go(results[sel]); }
  }
  function global(e: KeyboardEvent) {
    const typing = (e.target as HTMLElement).closest('input, textarea, select, [contenteditable]');
    // F as well, except at the poker tables where F folds
    const f = (e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey && !e.altKey && !/^#\/(holdem|threecard)/.test(location.hash);
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || ((e.key === '/' || f) && !typing)) {
      e.preventDefault();
      viaKeys = true;
      ui.search = true;
    }
  }
  const cats = (g: Game) => (g.cat === 'classic' ? 'Classic' : 'Arcade');
</script>

<svelte:window onkeydown={global} />

<dialog bind:this={dlg} class="search" onclose={() => (ui.search = false)} onclick={(e) => e.target === dlg && (ui.search = false)}>
  <div class="box">
    <label class="field">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" /><path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
      <input bind:this={input} bind:value={q} onkeydown={key} placeholder={t('search.hint')} aria-label={t('search.title')} autocomplete="off" spellcheck="false" />
      <kbd>Esc</kbd>
    </label>
    <div class="chips" role="tablist">
      {#each [['all', t('party.all')], ['classic', 'Classic'], ['arcade', 'Arcade'], ['party', '👥 ' + t('party.title')]] as [k, lb]}
        <button role="tab" aria-selected={filter === k} class:on={filter === k} onclick={() => { filter = k as typeof filter; input.focus(); }}>{lb}</button>
      {/each}
    </div>
    {#if results.length || q.trim()}
      {#if results.length}
        <ul role="listbox" aria-label={t('search.title')}>
          {#each results as g, i (g.id)}
            <li role="option" aria-selected={i === sel}>
              <a href={href(g)} class:sel={i === sel} onmouseenter={() => (sel = i)} onclick={(e) => { e.preventDefault(); go(g); }}>
                <span class="nm">{gameName(g)}{#if g.party}<em title={t('party.badge')}>👥</em>{/if}</span>
                <span class="ds">{t(('game.' + g.id) as Key)}</span>
                <span class="ct mono">{cats(g)}</span>
              </a>
            </li>
          {/each}
        </ul>
      {:else}<p class="empty">{t('search.empty')}</p>{/if}
    {:else}
      <div class="quick">
        {#each ['party', 'karten', 'würfel', 'puzzle', 'zahlen'] as w}<button onclick={() => { q = w; input.focus(); }}>{w}</button>{/each}
      </div>
    {/if}
  </div>
</dialog>

<style>
  .search { width: min(640px, calc(100vw - 24px)); max-height: min(560px, 80dvh); margin: 12vh auto auto; padding: 0; border: 1px solid var(--line-2); border-radius: 22px; background: var(--surface); color: var(--text); box-shadow: 0 40px 80px -20px rgba(0,0,0,.6); overflow: hidden; }
  .search::backdrop { background: rgba(0,0,0,.5); backdrop-filter: blur(4px); }
  .search[open]:not(.instant) { animation: in 0.45s var(--spring-snappy); }
  @keyframes in { from { opacity: 0; transform: translateY(-8px) scale(0.97); } }
  @media (prefers-reduced-motion: reduce) { .search[open]:not(.instant) { animation: none; } }
  .box { display: grid; max-height: inherit; }
  .field { display: flex; align-items: center; gap: 10px; padding: 0 16px; min-height: 58px; border-bottom: 1px solid var(--line); color: var(--muted); }
  .field input { flex: 1; min-width: 0; border: 0; background: none; color: var(--text); font: inherit; font-size: 1.05rem; outline: none; }
  kbd { font: 600 0.68rem 'Geist Mono Variable', monospace; padding: 3px 6px; border-radius: 6px; background: var(--surface-2); color: var(--muted); }
  ul { list-style: none; margin: 0; padding: 6px; overflow-y: auto; max-height: calc(min(560px, 80dvh) - 104px); }
  a { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; padding: 10px 12px; border-radius: 14px; text-decoration: none; color: var(--text); }
  a.sel { background: var(--surface-2); }
  .nm { font-weight: 600; display: flex; gap: 6px; align-items: center; }
  .nm em { font-style: normal; font-size: 0.8rem; }
  .ds { grid-column: 1; font-size: 0.82rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ct { grid-row: 1 / 3; grid-column: 2; align-self: center; font-size: 0.7rem; color: var(--muted); letter-spacing: 0.1em; }
  .empty { margin: 0; padding: 22px 18px; color: var(--muted); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 16px 0; }
  .chips button { border: 1px solid var(--line-2); background: none; color: var(--muted); border-radius: 999px; padding: 5px 11px; font-size: 0.78rem; font-weight: 600; }
  .chips button.on { background: var(--text); color: var(--bg); border-color: var(--text); }
  .quick { display: flex; flex-wrap: wrap; gap: 6px; padding: 14px 16px 16px; }
  .quick button { border: 1px solid var(--line-2); background: none; color: var(--muted); border-radius: 999px; padding: 6px 12px; font-size: 0.82rem; transition: background 0.3s var(--ease-snap), color 0.3s var(--ease-snap); }
  .quick button:hover { background: var(--surface-2); color: var(--text); }
</style>
