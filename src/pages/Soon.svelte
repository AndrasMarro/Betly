<script lang="ts">
  import { SOON } from '../lib/games';
  import { t } from '../lib/i18n';
  let { id }: { id: string } = $props();
</script>

<section class="wrap soon">
  <p class="eyebrow">{t('soon.title')}</p>
  <h1>{SOON[id] ?? '?'}</h1>
  <p class="sub">{t('soon.text')}</p>
  <div class="links">
    <a class="btn primary" href="#/roulette">Roulette</a>
    <a class="btn" href="#/blackjack">Blackjack</a>
    <a class="btn" href="#/slots">Slots</a>
  </div>
  <a class="back" href="#/">{t('soon.back')}</a>
</section>

<style>
  .soon { min-height: 70dvh; display: grid; align-content: center; justify-items: center; text-align: center; gap: 18px; padding: 60px 0; }
  h1 { margin: 0; font-size: clamp(3rem, 10vw, 8rem); letter-spacing: -0.05em; line-height: 0.9; }
  .sub { margin: 0; color: var(--muted); max-width: 42ch; }
  .links { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .links a { text-decoration: none; }
  .back { color: var(--muted); font-size: 0.85rem; }
</style>
