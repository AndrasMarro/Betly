<script lang="ts">
  import GameSection from '../components/GameSection.svelte';
  import { t, type Key } from '../lib/i18n';
  import type { Cat } from '../lib/games';
  let { page }: { page: Cat } = $props();
</script>

<div class="wrap lobby">
  <p class="eyebrow">{t(('cat.' + page + '.eyebrow') as Key)}</p>
  <h1>{t(('cat.' + page) as Key)}</h1>
  <p class="sub">{t(('cat.' + page + '.text') as Key)}</p>
  <GameSection cat={page} title={false} />
</div>

<style>
  .lobby { padding: 40px 0 100px; }
  h1 { margin: 8px 0 10px; font-size: clamp(2.6rem, 7vw, 5.5rem); letter-spacing: -0.05em; line-height: 0.92; }
  .sub { margin: 0 0 20px; color: var(--muted); max-width: 52ch; }
</style>
