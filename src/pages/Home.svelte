<script lang="ts">
  import Wheel from '../components/Wheel.svelte';
  import CardView from '../components/Card.svelte';
  import SlotSymbol from '../components/SlotSymbol.svelte';
  import { t, type Key } from '../lib/i18n';
  import { SOON } from '../lib/games';

  const games = [
    { href: '#/roulette', name: 'Roulette', key: 'game.roulette', art: 'roul' },
    { href: '#/blackjack', name: 'Blackjack', key: 'game.blackjack', art: 'cards' },
    { href: '#/slots', name: 'Slots', key: 'game.slots', art: 'slots' },
  ] as const;
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

<section id="games" class="wrap games">
  <header class="sh">
    <h2>{t('home.games')}</h2>
  </header>
  <div class="grid">
    {#each games as g, i}
      <a class="game" href={g.href} style="--i:{i}">
        <div class="art {g.art}" aria-hidden="true">
          {#if g.art === 'roul'}
            <div class="mini-wheel"><Wheel /></div>
          {:else if g.art === 'cards'}
            <div class="fan">
              <div class="c1"><CardView card={{ r: 1, s: 0 }} /></div>
              <div class="c2"><CardView card={{ r: 13, s: 1 }} /></div>
            </div>
          {:else}
            <div class="syms">{#each ['seven', 'seven', 'seven'] as s}<div><SlotSymbol sym={s} /></div>{/each}</div>
          {/if}
        </div>
        <div class="txt">
          <h3>{g.name}</h3>
          <p>{t(g.key as Key)}</p>
        </div>
        <span class="arrow" aria-hidden="true">→</span>
      </a>
    {/each}
  </div>

  <header class="sh soonh">
    <h2>{t('home.soon')}</h2>
    <p>{t('home.soonText')}</p>
  </header>
  <div class="soon">
    {#each Object.entries(SOON) as [id, name]}
      <a class="tile" href="#/soon/{id}"><span>{name}</span><span class="eyebrow">{t('home.soon')}</span></a>
    {/each}
  </div>

  <div class="feats">
    {#each [['feat.money', 'feat.moneyText'], ['feat.multi', 'feat.multiText'], ['feat.bots', 'feat.botsText']] as [h, p], i}
      <div class="feat">
        <span class="mono idx">0{i + 1}</span>
        <h3>{t(h as Key)}</h3>
        <p>{t(p as Key)}</p>
      </div>
    {/each}
  </div>
</section>

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

  .games { padding: 40px 0 80px; }
  .sh { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }
  .sh h2 { margin: 0; font-size: clamp(1.8rem, 3.6vw, 3rem); letter-spacing: -0.04em; font-weight: 700; }
  .sh p { margin: 0; color: var(--muted); }
  .soonh { margin-top: 80px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .game {
    position: relative; display: grid; grid-template-rows: 260px auto; text-decoration: none; border-radius: 28px; overflow: hidden;
    background: var(--surface); border: 1px solid var(--line); transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s;
  }
  .game:hover { transform: translateY(-6px); border-color: var(--line-2); }
  .art { position: relative; overflow: hidden; display: grid; place-items: center; background: radial-gradient(ellipse at 50% 20%, var(--felt), var(--felt-2)); }
  .art.slots { background: radial-gradient(ellipse at 50% 20%, #2a1b10, #120b07); }
  .mini-wheel { width: 300px; translate: 0 34%; transition: rotate 1.2s cubic-bezier(0.16, 1, 0.3, 1); }
  .game:hover .mini-wheel { rotate: 40deg; }
  .fan { position: relative; width: 160px; height: 150px; --cw: 92px; }
  .fan > div { position: absolute; left: 34px; top: 10px; transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
  .c1 { transform: rotate(-10deg) translateX(-26px); }
  .c2 { transform: rotate(9deg) translateX(26px); }
  .game:hover .c1 { transform: rotate(-16deg) translateX(-40px) translateY(-6px); }
  .game:hover .c2 { transform: rotate(15deg) translateX(40px) translateY(-6px); }
  .syms { display: flex; gap: 10px; padding: 18px; border-radius: 20px; background: #fbfaf6; box-shadow: inset 0 0 0 3px #d8b26a; }
  .syms div { width: 64px; height: 64px; transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
  .game:hover .syms div:nth-child(2) { transform: translateY(-8px); }
  .txt { padding: 22px 24px 26px; }
  h3 { margin: 0 0 6px; font-size: 1.5rem; letter-spacing: -0.03em; }
  .txt p { margin: 0; color: var(--muted); font-size: 0.92rem; max-width: 40ch; }
  .arrow { position: absolute; right: 22px; bottom: 22px; font-size: 1.2rem; transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
  .game:hover .arrow { transform: translateX(4px); }

  .soon { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
  .tile {
    display: grid; gap: 8px; align-content: space-between; min-height: 120px; padding: 18px; border-radius: 20px; text-decoration: none;
    border: 1px dashed var(--line-2); color: var(--text); font-weight: 600; letter-spacing: -0.02em; transition: background 0.3s;
  }
  .tile:hover { background: var(--surface); }
  .feats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 80px; border-top: 1px solid var(--line); padding-top: 32px; }
  .idx { color: var(--accent); font-size: 0.8rem; }
  .feat h3 { margin: 10px 0 6px; font-size: 1.2rem; }
  .feat p { margin: 0; color: var(--muted); max-width: 36ch; }

  @media (max-width: 960px) {
    .grid { grid-template-columns: 1fr; }
    .soon { grid-template-columns: repeat(2, 1fr); }
    .feats { grid-template-columns: 1fr; }
    .game { grid-template-rows: 220px auto; }
  }
</style>
