<script lang="ts">
  import Wheel from '../components/Wheel.svelte';
  import GameSection from '../components/GameSection.svelte';
  import { t, type Key } from '../lib/i18n';
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
  <GameSection cat="classic" />
  <div class="gap"></div>
  <GameSection cat="arcade" />

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
  h3 { margin: 0 0 6px; letter-spacing: -0.03em; }
  .feats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 80px; border-top: 1px solid var(--line); padding-top: 32px; }
  .idx { color: var(--accent); font-size: 0.8rem; }
  .feat h3 { margin: 10px 0 6px; font-size: 1.2rem; }
  .feat p { margin: 0; color: var(--muted); max-width: 36ch; }

  @media (max-width: 960px) {
    .feats { grid-template-columns: 1fr; }
  }
</style>
