<script lang="ts">
  import Wheel from '../components/Wheel.svelte';
  import GameSection from '../components/GameSection.svelte';
  import DailyCard from '../components/DailyCard.svelte';
  import YourGames from '../components/YourGames.svelte';
  import TodayStrip from '../components/TodayStrip.svelte';
  import { GAMES, byId, matches, score, gameName, href, type Game } from '../lib/games';
  import { dailyGame, dailyClassic } from '../lib/daily';
  import { t, type Key } from '../lib/i18n';
  let q = $state('');
  // the search opens up when used: filters, quick words and the best hits right below it
  let open = $state(false);
  let filter = $state<'all' | 'classic' | 'arcade' | 'party'>('all');
  let sel = $state(0);
  let box: HTMLElement;
  const inFilter = (g: Game) => filter === 'all' || (filter === 'party' ? !!g.party : g.cat === filter);
  const hits = $derived(q.trim() ? GAMES.filter((g) => g.live && inFilter(g) && matches(g, q, t(('game.' + g.id) as Key))).sort((a, b) => score(a, q) - score(b, q)).slice(0, 6) : []);
  $effect(() => { void q; sel = 0; });
  function keys(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' && hits.length) { e.preventDefault(); sel = Math.min(hits.length - 1, sel + 1); }
    else if (e.key === 'ArrowUp' && hits.length) { e.preventDefault(); sel = Math.max(0, sel - 1); }
    else if (e.key === 'Enter' && hits[sel]) location.hash = href(hits[sel]);
  }
  const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { open = false; (document.activeElement as HTMLElement)?.blur(); } };
  const leave = (e: FocusEvent) => { if (!box.contains(e.relatedTarget as Node)) open = false; };
  const dailies = [byId(dailyClassic()), byId(dailyGame())].filter((g) => !!g);
  const found = $derived(GAMES.some((g) => inFilter(g) && matches(g, q, t(('game.' + g.id) as Key))));
</script>

<svelte:window onkeydown={(e) => open && esc(e)} />

<section class="hero">
  <div class="glow" aria-hidden="true"></div>
  <div class="hero-wheel" aria-hidden="true"><div class="spinner"><Wheel mono /></div></div>
  <div class="content">
    <p class="eyebrow r" style="--d:0">{t('hero.eyebrow')}</p>
    <h1 class="r" style="--d:1">
      {t('hero.a')} <span class="serif accent">{t('hero.red')}</span><br />{t('hero.b')}
    </h1>
    <p class="sub r" style="--d:2">{t('hero.sub')}</p>
    <a class="cta r" style="--d:3" href="#games">{t('hero.cta')}</a>
  </div>
</section>

<div id="games" class="wrap games">
  <div class="finder" class:open bind:this={box} onfocusout={leave} role="search">
    <label class="search">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" /><path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
      <input type="search" bind:value={q} onfocus={() => (open = true)} onkeydown={keys} placeholder={t('home.search')} aria-label={t('home.search')} />
      {#if filter !== 'all'}<span class="fchip">{({ classic: 'Classic', arcade: 'Arcade', party: '👥 Party' })[filter]}</span>{/if}
    </label>
    {#if open}
      <div class="panel">
        <div class="chips" role="tablist">
          {#each [['all', t('party.all')], ['classic', 'Classic'], ['arcade', 'Arcade'], ['party', '👥 ' + t('party.title')]] as [k, lb]}
            <button role="tab" aria-selected={filter === k} class:on={filter === k} onclick={() => (filter = k as typeof filter)}>{lb}</button>
          {/each}
        </div>
        {#if hits.length}
          <ul>
            {#each hits as g, i (g.id)}
              <li><a href={href(g)} class:sel={i === sel} onmouseenter={() => (sel = i)}><span class="nm">{gameName(g)}{#if g.party} <em>👥</em>{/if}</span><span class="ds">{t(('game.' + g.id) as Key)}</span><span class="ct mono">{g.cat}</span></a></li>
            {/each}
          </ul>
        {:else if q.trim()}<p class="none2">{t('search.empty')}</p>
        {:else}
          <div class="quick">{#each ['karten', 'würfel', 'zahlen', 'puzzle', 'wort', 'rennen'] as w}<button onclick={() => (q = w)}>{w}</button>{/each}</div>
        {/if}
      </div>
    {/if}
  </div>
  {#if !q}
    <div class="dailies">{#each dailies as g (g.id)}<DailyCard {g} />{/each}</div>
    <TodayStrip /><YourGames />
    <div class="gap"></div>
  {/if}
  {#if filter === 'party'}
    <GameSection cat="arcade" {q} daily={false} party title={false} />
  {:else}
    {#if filter !== 'arcade'}<GameSection cat="classic" {q} daily={false} />{/if}
    {#if !q && filter === 'all'}<div class="gap"></div>{/if}
    {#if filter !== 'classic'}<GameSection cat="arcade" {q} daily={false} />{/if}
  {/if}
  {#if !found}<p class="none">{t('home.none')}</p>{/if}

  <div class="feats">
    {#each [['feat.money', 'feat.moneyText'], ['feat.multi', 'feat.multiText'], ['feat.bots', 'feat.botsText']] as [h, p], i}
      <div class="feat">
        <span class="mono idx">0{i + 1}</span>
        <h3>{t(h as Key)}</h3>
        <p>{t(p as Key)}</p>
      </div>
    {/each}
  </div>
</div>

<style>
  .hero { position: relative; min-height: 100dvh; display: grid; place-items: center; overflow: hidden; margin-top: calc(-1 * var(--nav-h)); padding: calc(var(--nav-h) + 24px) 16px 18vh; }
  .glow { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 60% 50% at 50% 38%, var(--glow), transparent 70%); }
  .hero-wheel {
    position: absolute; left: 50%; bottom: 0; width: min(1100px, 130vw); translate: -50% 65%; opacity: 0.85;
    animation: fadein 1.4s ease-out both;
    mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.35) 4%, #000 18%, transparent 38%);
  }
  .spinner { animation: spin 90s linear infinite; will-change: transform; }
  .hero-wheel :global(svg) { filter: none; }
  @keyframes spin { to { rotate: 360deg; } }
  @keyframes fadein { from { opacity: 0; } }
  .content { position: relative; z-index: 1; display: grid; justify-items: center; text-align: center; gap: 22px; }
  h1 { margin: 0; font-size: clamp(2.75rem, 8.2vw, 8.5rem); font-weight: 700; letter-spacing: -0.045em; line-height: 0.92; max-width: 14ch; text-wrap: balance; }
  .accent { color: var(--hero-red, var(--accent)); font-size: 1.08em; letter-spacing: -0.02em; padding-right: 0.04em; }
  .sub { margin: 0; max-width: 44ch; font-size: clamp(1rem, 1.25vw, 1.2rem); color: var(--muted); line-height: 1.6; }
  .cta {
    display: inline-flex; align-items: center; min-height: 52px; padding: 0 2rem; border-radius: 999px; background: var(--text); color: var(--bg);
    text-decoration: none; font-weight: 600; font-size: 0.875rem; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 6px;
    transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .cta:hover { transform: translateY(-2px); box-shadow: 0 12px 34px -8px var(--accent); }
  .cta:active { transform: translateY(0) scale(0.98); }
  .r { animation: up 0.8s cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: calc(0.1s + var(--d) * 0.12s); }
  @keyframes up { from { opacity: 0; transform: translateY(30px); filter: blur(8px); } }

  .games { padding: 40px 0 80px; scroll-margin-top: var(--nav-h); }
  .gap { height: 72px; }
  .finder { position: relative; z-index: 5; max-width: 520px; margin: 0 auto 28px; transition: max-width 0.55s var(--spring-snappy); }
  .finder.open { max-width: 760px; }
  .search { position: relative; display: flex; align-items: center; gap: 10px; padding: 0 18px; min-height: 52px; border-radius: 999px; border: 1px solid var(--line-2); background: var(--surface); color: var(--muted); transition: border-radius 0.3s var(--ease-snap), border-color 0.3s var(--ease-snap); }
  .finder.open .search { border-radius: 26px 26px 0 0; border-color: var(--accent); border-bottom-color: var(--line); }
  .fchip { font-size: 0.75rem; padding: 3px 10px; border-radius: 999px; background: var(--surface-2); color: var(--text); }
  .panel { position: absolute; left: 0; right: 0; top: 100%; display: grid; gap: 10px; padding: 12px; border: 1px solid var(--accent); border-top: 0; border-radius: 0 0 26px 26px; background: var(--surface); box-shadow: 0 30px 60px -20px rgba(0,0,0,.6); transform-origin: top; animation: drop 0.4s var(--spring-snappy); }
  @keyframes drop { from { opacity: 0; transform: translateY(-6px) scaleY(0.96); } }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chips button, .quick button { border: 1px solid var(--line-2); background: none; color: var(--muted); border-radius: 999px; padding: 6px 12px; font-size: 0.82rem; font-weight: 600; transition: background 0.25s var(--ease-snap), color 0.25s var(--ease-snap); }
  .chips button.on { background: var(--text); color: var(--bg); border-color: var(--text); }
  .chips button:active, .quick button:active { transform: scale(0.97); }
  .quick { display: flex; flex-wrap: wrap; gap: 6px; }
  .finder ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  .finder a { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; padding: 9px 12px; border-radius: 14px; text-decoration: none; color: var(--text); }
  .finder a.sel { background: var(--surface-2); }
  .finder .nm { font-weight: 600; } .finder .nm em { font-style: normal; font-size: 0.8rem; }
  .finder .ds { grid-column: 1; font-size: 0.8rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .finder .ct { grid-row: 1 / 3; grid-column: 2; align-self: center; font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
  .none2 { margin: 0; padding: 8px 4px; color: var(--muted); font-size: 0.88rem; }
  @media (prefers-reduced-motion: reduce) { .finder, .panel { transition: none; animation: none; } }
  .search input { flex: 1; min-width: 0; border: 0; background: none; color: var(--text); font: inherit; font-size: 1rem; outline: none; }
  .dailies { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .dailies :global(.dailycard) { margin: 0; }
  .none { text-align: center; color: var(--muted); padding: 40px 0; }
  h3 { margin: 0 0 6px; letter-spacing: -0.03em; }
  .feats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 80px; border-top: 1px solid var(--line); padding-top: 32px; }
  .idx { color: var(--accent); font-size: 0.8rem; }
  .feat h3 { margin: 10px 0 6px; font-size: 1.2rem; }
  .feat p { margin: 0; color: var(--muted); max-width: 36ch; }

  @media (max-width: 960px) {
    .feats { grid-template-columns: 1fr; }
    .dailies { grid-template-columns: 1fr; }
  }
</style>
