<script lang="ts">
  import Wheel from '../components/Wheel.svelte';
  import GameSection from '../components/GameSection.svelte';
  import DailyCard from '../components/DailyCard.svelte';
  import { GAMES, byId, matches } from '../lib/games';
  import { dailyGame, dailyClassic } from '../lib/daily';
  import { t, type Key } from '../lib/i18n';
  let q = $state('');
  const dailies = [byId(dailyClassic()), byId(dailyGame())].filter((g) => !!g);
  const found = $derived(GAMES.some((g) => matches(g, q, t(('game.' + g.id) as Key))));
</script>

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
  <label class="search">
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" /><path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
    <input type="search" bind:value={q} placeholder={t('home.search')} aria-label={t('home.search')} />
  </label>
  {#if !q}
    <div class="dailies">{#each dailies as g (g.id)}<DailyCard {g} />{/each}</div>
    <div class="gap"></div>
  {/if}
  <GameSection cat="classic" {q} daily={false} />
  {#if !q}<div class="gap"></div>{/if}
  <GameSection cat="arcade" {q} daily={false} />
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
  .search { position: relative; display: flex; align-items: center; gap: 10px; max-width: 520px; margin: 0 auto 28px; padding: 0 18px; min-height: 52px; border-radius: 999px; border: 1px solid var(--line-2); background: var(--surface); color: var(--muted); }
  .search:focus-within { border-color: var(--accent); }
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
