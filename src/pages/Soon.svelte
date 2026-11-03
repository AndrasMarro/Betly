<script lang="ts">
  import { GAMES, byId, gameName, href } from '../lib/games';
  import { t, type Key } from '../lib/i18n';
  let { id }: { id: string } = $props();
  const g = $derived(byId(id));
  const others = $derived(GAMES.filter((x) => x.live && x.cat === g?.cat));
</script>

<section class="wrap soon">
  <p class="eyebrow">{g ? t(('cat.' + g.cat) as Key) : ''} · {t('soon.title')}</p>
  <h1>{g ? gameName(g) : '?'}</h1>
  <p class="sub">{t('soon.text')}</p>
  <div class="links">
    {#each others as o, i}<a class="btn" class:primary={i === 0} href={href(o)}>{gameName(o)}</a>{/each}
  </div>
  <a class="back" href="#/{g?.cat ?? ''}">{t('soon.back')}</a>
</section>

<style>
  .soon { min-height: 70dvh; display: grid; align-content: center; justify-items: center; text-align: center; gap: 18px; padding: 60px 0; }
  h1 { margin: 0; font-size: clamp(3rem, 10vw, 8rem); letter-spacing: -0.05em; line-height: 0.9; }
  .sub { margin: 0; color: var(--muted); max-width: 42ch; }
  .links { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .links a { text-decoration: none; }
  .back { color: var(--muted); font-size: 0.85rem; }
</style>
