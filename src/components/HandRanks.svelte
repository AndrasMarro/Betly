<script lang="ts">
  // Poker hand rankings, best first, each with an example; `active` highlights the category you currently hold.
  import { RANKS, SUITS } from '../lib/cards';
  import { HAND_RANKS } from '../lib/guides';
  import { settings } from '../lib/state.svelte';
  import { t, type Key } from '../lib/i18n';
  let { active = '' }: { active?: string } = $props();
</script>

<ol class="ranks">
  {#each HAND_RANKS as h, i}
    <li class:on={h.cat === active}>
      <span class="no mono">{i + 1}</span>
      <div class="txt">
        <strong>{t(('pk.cat.' + h.cat) as Key)}</strong>
        <span>{settings.lang === 'de' ? h.de : h.en}</span>
      </div>
      <div class="cards">
        {#each h.cards as [r, s], k}<span class="mc" class:red={s === 1 || s === 2} class:dim={k >= h.use}><b>{RANKS[r]}</b><i>{SUITS[s]}</i></span>{/each}
      </div>
    </li>
  {/each}
</ol>

<style>
  .ranks { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  li { display: grid; grid-template-columns: 22px 1fr auto; gap: 12px; align-items: center; padding: 8px 10px; border-radius: 12px; transition: background-color 0.25s var(--ease-snap); }
  li.on { background: color-mix(in srgb, var(--gold) 18%, transparent); box-shadow: inset 0 0 0 1px var(--gold); }
  .no { color: var(--muted); font-size: 0.78rem; }
  .txt { display: grid; gap: 1px; min-width: 0; }
  .txt strong { font-size: 0.9rem; }
  .txt span { font-size: 0.75rem; color: var(--muted); }
  .cards { display: flex; gap: 3px; }
  .mc { width: 30px; height: 40px; border-radius: 5px; background: linear-gradient(#fff, #f1eee6); color: #16161a; display: grid; place-items: center; align-content: center; line-height: 1; box-shadow: 0 1px 0 rgba(0,0,0,.25), 0 4px 10px -6px rgba(0,0,0,.6); }
  .mc b { font: 700 0.8rem 'Geist Variable', sans-serif; letter-spacing: -0.04em; }
  .mc i { font-style: normal; font-size: 0.8rem; }
  .mc.red { color: #c8262c; }
  .mc.dim { opacity: 0.3; }
  @media (max-width: 480px) {
    li { grid-template-columns: 18px 1fr; }
    .cards { grid-column: 2; }
    .mc { width: 27px; height: 36px; }
  }
</style>
