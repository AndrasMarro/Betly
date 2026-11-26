<script lang="ts">
  // Everything that is new today in one strip: the bonus games, the slot of the day, the daily word,
  // the daily lotto draw, the Snake challenge, and a button that throws you into a random game.
  import { onDestroy } from 'svelte';
  import { GAMES, byId, gameName, href } from '../lib/games';
  import { dailyGame, dailyClassic, dailySlot, today } from '../lib/daily';
  import { MACHINES, CARDS, CROSSY, SNAKE, ARMORY } from '../games/slots';
  import { dayNo } from '../games/words';
  import { drawAt, openDay, mine } from '../lib/dailyLotto';
  import { settings } from '../lib/state.svelte';
  import { sfx } from '../lib/sfx';
  import { mine as my, toggleFold } from '../lib/mine.svelte';

  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
  const read = (k: string) => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch { return {}; } };
  let now = $state(Date.now());
  const tick = setInterval(() => (now = Date.now()), 30_000);
  onDestroy(() => clearInterval(tick));

  const classic = byId(dailyClassic()), arcade = byId(dailyGame());
  const slot = [...MACHINES, CARDS, CROSSY, SNAKE, ...ARMORY].find((m) => m.id === dailySlot());
  const word = read('betly:words').daily?.[settings.lang === 'en' ? 'en' : 'de'];
  const wordDone = word?.day === dayNo() && word.paid !== undefined;
  const lottoIn = !!mine()[openDay()];
  const snake = read('betly:snake').best;
  const snakeBest = snake?.day === today() ? snake.daily : 0;
  const untilDraw = $derived(Math.max(0, drawAt(openDay(now)) - now));
  const hm = (ms: number) => `${Math.floor(ms / 3600e3)} h ${String(Math.floor(ms / 60e3) % 60).padStart(2, '0')} min`;

  // random game: names flicker for a moment, then off you go
  let rolling = $state('');
  function random() {
    if (rolling) return;
    const pool = GAMES.filter((g) => g.live);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { location.hash = href(pick); return; }
    let k = 0;
    const step = () => {
      k++;
      rolling = gameName(pool[Math.floor(Math.random() * pool.length)]);
      sfx('tick');
      if (k < 9) setTimeout(step, 45 + k * 12);
      else { rolling = gameName(pick); sfx('chip'); setTimeout(() => { location.hash = href(pick); rolling = ''; }, 260); }
    };
    step();
  }
</script>

<section class="today" aria-label={L('Heute', 'Today')}>
  <header><h2>{L('Heute', 'Today')}</h2><span class="eyebrow">{new Date().toLocaleDateString(settings.lang === 'de' ? 'de-CH' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span><button class="fold" class:shut={my.fold.today} onclick={() => toggleFold('today')} aria-expanded={!my.fold.today}>{my.fold.today ? L('Zeigen', 'Show') : L('Einklappen', 'Hide')}<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg></button></header>
  <div class="body" class:shut={my.fold.today}><div>
  <div class="row">
    {#if classic}<a class="tile gold" href={href(classic)} style="--i:0"><span class="ic">♠</span><small>{L('Classic des Tages', 'Classic of the day')}</small><b>{gameName(classic)}</b><em>+20 %</em></a>{/if}
    {#if arcade}<a class="tile gold" href={href(arcade)} style="--i:1"><span class="ic">⚡</span><small>{L('Arcade des Tages', 'Arcade of the day')}</small><b>{gameName(arcade)}</b><em>+20 %</em></a>{/if}
    {#if slot}<a class="tile gold" href="#/slots?m={slot.id}" style="--i:2"><span class="ic">🎰</span><small>{L('Slot des Tages', 'Slot of the day')}</small><b>{slot.name}</b><em>+20 %</em></a>{/if}
    <a class="tile" href="#/words" style="--i:3"><span class="ic">🔤</span><small>{L('Tageswort', 'Daily word')} #{dayNo()}</small><b>{L('Wortjagd', 'Word Hunt')}</b><em class:done={wordDone}>{wordDone ? L('erledigt ✓', 'done ✓') : L('bis 250 Coins', 'up to 250 coins')}</em></a>
    <a class="tile" href="#/lotto" style="--i:4"><span class="ic">🎱</span><small>{L('Tageslotto · gratis', 'Daily lotto · free')}</small><b>{L('Ziehung in', 'Draw in')} {hm(untilDraw)}</b><em class:done={lottoIn}>{lottoIn ? L('Schein im Topf ✓', 'ticket in ✓') : L('Schein abgeben', 'hand in a ticket')}</em></a>
    <a class="tile" href="#/snake?daily" style="--i:5"><span class="ic">🐍</span><small>{L('Snake-Challenge', 'Snake challenge')}</small><b>{L('Heutige Modifier', "Today's modifiers")}</b><em>{snakeBest ? L(`Rekord heute ${snakeBest}`, `best today ${snakeBest}`) : L('doppelte Auszahlung', 'double pay')}</em></a>
    <button class="tile rnd" onclick={random} style="--i:6" aria-label={L('Zufälliges Spiel', 'Random game')}>
      <span class="ic die" class:spin={!!rolling}>🎲</span><small>{L('Zufallsspiel', 'Random game')}</small><b class:roll={!!rolling}>{rolling || L('Überrasch mich', 'Surprise me')}</b><em>{L('direkt rein', 'straight in')}</em>
    </button>
  </div>
  </div></div>
</section>

<style>
  .today { display: grid; gap: 12px; margin-top: 18px; }
  header { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  h2 { margin: 0; font-size: 1.4rem; letter-spacing: -0.03em; }
  .row { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(170px, 1fr); gap: 10px; overflow-x: auto; scroll-snap-type: x mandatory; padding: 8px 2px 8px; margin: -8px -2px 0; scrollbar-width: thin; }
  .tile {
    position: relative; display: grid; align-content: start; gap: 3px; min-height: 118px; padding: 14px; border-radius: 20px; text-align: left; text-decoration: none; color: var(--text);
    background: var(--surface); border: 1px solid var(--line); scroll-snap-align: start; font: inherit;
    transition: transform 0.4s var(--ease-snap), border-color 0.3s var(--ease-snap);
    animation: rise 0.55s var(--spring-snappy) calc(var(--i) * 70ms) backwards;
  }
  .tile.gold { border-color: color-mix(in srgb, var(--gold) 40%, transparent); }
  .tile.rnd { cursor: pointer; background: linear-gradient(160deg, color-mix(in srgb, var(--accent) 22%, var(--surface)), var(--surface)); }
  @media (hover: hover) and (pointer: fine) { .tile:hover { transform: translateY(-4px); border-color: var(--line-2); } .tile.rnd:hover .die { transform: rotate(-20deg) scale(1.1); } }
  .tile:active { transform: scale(0.97); transition-duration: 0.16s; }
  @keyframes rise { from { opacity: 0; transform: translateY(12px); } }
  .ic { font-size: 1.25rem; margin-bottom: 4px; display: inline-block; transition: transform 0.4s var(--spring-snappy); }
  .die.spin { animation: spin 0.5s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  small { font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  b { font-size: 1rem; letter-spacing: -0.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  b.roll { color: var(--accent); }
  em { font-style: normal; font-size: 0.78rem; color: var(--gold); margin-top: auto; }
  em.done { color: #6ff0a6; }
  @media (prefers-reduced-motion: reduce) { .tile, .die.spin { animation: none; } }

  .fold { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line-2); background: none; color: var(--muted); border-radius: 999px; padding: 5px 10px 5px 12px; font-size: 0.75rem; font-weight: 600; transition: color 0.25s var(--ease-snap), border-color 0.25s var(--ease-snap); }
  .fold:hover { color: var(--text); border-color: var(--text); }
  .fold svg { transition: transform 0.45s var(--spring-snappy); }
  .fold.shut svg { transform: rotate(-90deg); }
  .body { display: grid; grid-template-rows: 1fr; transition: grid-template-rows 0.5s var(--spring-smooth), opacity 0.3s var(--ease-snap); }
  .body.shut { grid-template-rows: 0fr; opacity: 0; }
  .body > div { min-height: 0; overflow: hidden; }
  @media (prefers-reduced-motion: reduce) { .body, .fold svg { transition: none; } }
</style>
