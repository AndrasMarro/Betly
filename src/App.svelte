<script lang="ts">
  import { fade } from 'svelte/transition';
  import Dialogs from './components/Dialogs.svelte';
  import { settings, wallet, ui, fmt, bonusReadyIn, askName, tampered } from './lib/state.svelte';
  let tamperNote = $state(tampered);
  import { t } from './lib/i18n';
  import { byId } from './lib/games';
  import { menuMusic, setVolumes } from './lib/sfx';

  let hash = $state(location.hash);
  const path = $derived(hash.slice(1).split('?')[0] || '/');
  const [section, arg] = $derived(path.split('/').filter(Boolean));

  const pages: Record<string, () => Promise<{ default: any }>> = {
    roulette: () => import('./pages/Roulette.svelte'),
    blackjack: () => import('./pages/Blackjack.svelte'),
    slots: () => import('./pages/Slots.svelte'),
    rocket: () => import('./pages/Rocket.svelte'),
    mines: () => import('./pages/Mines.svelte'),
    dice: () => import('./pages/Dice.svelte'),
    hop: () => import('./pages/Hop.svelte'),
    tower: () => import('./pages/Tower.svelte'),
    coinflip: () => import('./pages/CoinFlip.svelte'),
    hilo: () => import('./pages/HiLo.svelte'),
    plinko: () => import('./pages/Plinko.svelte'),
    wheel: () => import('./pages/LuckWheel.svelte'),
    scratch: () => import('./pages/Scratch.svelte'),
    cases: () => import('./pages/Cases.svelte'),
    snake: () => import('./pages/Snake.svelte'),
    crossy: () => import('./pages/Crossy.svelte'),
    minesweeper: () => import('./pages/Minesweeper.svelte'),
    baccarat: () => import('./pages/Baccarat.svelte'),
    threecard: () => import('./pages/ThreeCard.svelte'),
    holdem: () => import('./pages/Poker.svelte'),
    classic: () => import('./pages/Lobby.svelte'),
    arcade: () => import('./pages/Lobby.svelte'),
    soon: () => import('./pages/Soon.svelte'),
    impressum: () => import('./pages/Legal.svelte'),
    datenschutz: () => import('./pages/Legal.svelte'),
    haftung: () => import('./pages/Legal.svelte'),
  };
  import Home from './pages/Home.svelte';

  function onhash() {
    // in-page anchors (#games) are not routes
    if (location.hash && !location.hash.startsWith('#/')) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
      history.replaceState(null, '', '#/');
      return;
    }
    const prev = hash.split('?')[0];
    hash = location.hash;
    if (prev !== hash.split('?')[0]) scrollTo(0, 0);
  }

  let now = $state(Date.now());
  $effect(() => {
    const id = setInterval(() => (now = Date.now()), 5000);
    return () => clearInterval(id);
  });
  const bonusReady = $derived(bonusReadyIn(now) === 0);
  const links = [['classic', 'cat.classic'], ['arcade', 'cat.arcade']] as const;
  const activeCat = $derived(section === 'soon' ? byId(arg)?.cat : (byId(section)?.cat ?? section));

  // ask for a name once per browser session (also shows the play-money notice)
  try {
    if (!sessionStorage.getItem('betly:hi')) askName(true).then(() => sessionStorage.setItem('betly:hi', '1'));
  } catch {
    askName(true);
  }

  // lounge music only in the menus
  const inMenu = $derived(!section || section === 'classic' || section === 'arcade');
  $effect(() => menuMusic(inMenu && settings.music && settings.sound));
  $effect(() => setVolumes(settings.sfxVol, settings.musicVol));
</script>

<svelte:window onhashchange={onhash} />

<nav class="nav">
  <div class="wrap row">
    <a class="logo" href="#/" aria-label="Betly">
      <span class="mark" aria-hidden="true"></span>Betly
    </a>
    <div class="links">
      {#each links as [id, key]}
        <a href="#/{id}" class:on={activeCat === id}>{t(key)}</a>
      {/each}
    </div>
    <div class="tools">
      <button class="balance" onclick={() => (ui.credits = true)} aria-label={t('nav.credits')}>
        <span class="chip" data-v="1000" style="--size:22px"></span>
        <span class="mono">{fmt(wallet.balance)}</span>
        <span class="plus" class:ready={bonusReady}>+</span>
        {#if ui.bonus}{#key ui.bonus.id}<span class="dflash mono">+{fmt(ui.bonus.amt)} · Daily</span>{/key}{/if}
      </button>
      <button class="btn icon ghost music" class:off={!settings.music || !settings.sound} onclick={() => (settings.music = !(settings.music && settings.sound)) && (settings.sound = true)} aria-label={t('settings.music')} aria-pressed={settings.music && settings.sound}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></svg>
      </button>
      <button class="btn icon ghost gear" onclick={() => (ui.settings = true)} aria-label={t('nav.settings')}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
      </button>
    </div>
  </div>
</nav>

<main>
  {#key path}
    <div in:fade={{ duration: 220 }}>
      {#if !section}
        <Home />
      {:else if pages[section]}
        {#await pages[section]() then m}
          <m.default id={arg} page={section} />
        {/await}
      {:else}
        <Home />
      {/if}
    </div>
  {/key}
</main>

<footer class="foot">
  <div class="wrap">
    <div class="top">
      <a class="logo" href="#/"><span class="mark" aria-hidden="true"></span>Betly</a>
      <nav aria-label="Legal">
        <a href="#/impressum">{t('legal.imprint')}</a>
        <a href="#/datenschutz">{t('legal.privacy')}</a>
        <a href="#/haftung">{t('legal.disclaimer')}</a>
      </nav>
    </div>
    <p>{t('footer.note')}</p>
    <p class="muted">{t('footer.help')}</p>
  </div>
</footer>

<Dialogs />

{#if tamperNote}
  <div class="tamper" role="alert">
    <span>{t('tamper')}</span>
    <button class="btn sm" onclick={() => (tamperNote = false)}>OK</button>
  </div>
{/if}

<style>
  :global(:root) { --nav-h: 68px; }
  .nav {
    position: sticky; top: 0; z-index: 50; height: var(--nav-h); display: flex; align-items: center;
    background: color-mix(in srgb, var(--bg) 72%, transparent); backdrop-filter: blur(14px); border-bottom: 1px solid var(--line);
  }
  .row { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 16px; }
  .row .logo { justify-self: start; }
  .row .tools { justify-self: end; }
  .logo { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; font-weight: 700; font-size: 1.2rem; letter-spacing: -0.04em; }
  .mark { width: 22px; height: 22px; border-radius: 50%; background: var(--accent); box-shadow: inset 0 0 0 5px var(--accent), inset 0 0 0 7px var(--bg); }
  .links { display: flex; gap: 4px; padding: 4px; border-radius: 999px; border: 1px solid var(--line); }
  .links a { text-decoration: none; font-size: 0.85rem; padding: 7px 14px; border-radius: 999px; color: var(--muted); transition: color 0.2s, background 0.2s; }
  .links a:hover { color: var(--text); }
  .links a.on { background: var(--surface-2); color: var(--text); }
  .tools { display: flex; gap: 6px; align-items: center; }
  .music.off { opacity: 0.4; }
  .music.off svg { stroke-dasharray: 2 2; }
  .balance {
    display: inline-flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 6px 0 10px; border-radius: 999px; border: 1px solid var(--line-2);
    background: var(--surface); font-size: 0.9rem; font-weight: 600;
  }
  .balance { position: relative; }
  .dflash { position: absolute; right: 8px; top: calc(100% + 6px); padding: 3px 8px; border-radius: 999px; background: var(--gold); color: #1d1505; font-size: 0.72rem; white-space: nowrap; pointer-events: none; animation: dflash 2.4s var(--ease-snap) forwards; }
  @keyframes dflash { 0% { opacity: 0; transform: translateY(-6px); } 12% { opacity: 1; transform: none; } 80% { opacity: 1; } 100% { opacity: 0; transform: translateY(4px); } }
  .plus { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--surface-2); font-size: 1.1rem; position: relative; }
  .plus.ready { background: var(--accent); color: var(--accent-ink); }
  .plus.ready::after { content: ''; position: absolute; inset: -3px; border-radius: 50%; border: 2px solid var(--accent); animation: ring 1.6s ease-out infinite; }
  @keyframes ring { to { transform: scale(1.5); opacity: 0; } }
  main { min-height: 70dvh; }
  .tamper { position: fixed; left: 50%; bottom: 20px; translate: -50% 0; z-index: 300; display: flex; gap: 12px; align-items: center; max-width: calc(100% - 32px); padding: 12px 16px; border-radius: 18px; background: var(--surface); box-shadow: 0 0 0 1px var(--accent), 0 20px 50px rgba(0,0,0,.5); font-size: 0.88rem; }
  .foot { border-top: 1px solid var(--line); padding: 40px 0 48px; font-size: 0.85rem; }
  .foot .top { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 18px; }
  .foot nav { display: flex; gap: 18px; flex-wrap: wrap; }
  .foot nav a { color: var(--muted); text-decoration: none; }
  .foot nav a:hover { color: var(--text); }
  .foot p { margin: 4px 0; }
  .muted { color: var(--muted); }

  @media (max-width: 760px) {
    :global(:root) { --nav-h: 112px; }
    .row { grid-template-columns: 1fr auto; gap: 8px; }
    .links { order: 3; grid-column: 1 / -1; justify-content: space-between; }
    .links a { flex: 1; text-align: center; padding: 7px 6px; }
    .nav { height: auto; min-height: var(--nav-h); padding: 10px 0; }
  }
</style>
