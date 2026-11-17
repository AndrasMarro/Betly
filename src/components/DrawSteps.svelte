<script lang="ts">
  // Keno and Lotto explained in steps with animated balls.
  import GuideSteps, { type Step } from './GuideSteps.svelte';
  import { settings } from '../lib/state.svelte';
  import { kenoTable, LOTTO_TABLE, DAILY_PRIZE } from '../games/lotto';
  import LottoCard from './LottoCard.svelte';
  let { game, ondone }: { game: 'keno' | 'lotto'; ondone?: () => void } = $props();
  const L = (a: string, b: string) => (settings.lang === 'de' ? a : b);
  const k5 = kenoTable(5, 'classic');
  const steps: Step[] = $derived(game === 'keno' ? [
    { h: L('Das Ziel', 'The goal'), scene: kpick, p: L(
      'Auf dem Feld liegen die Zahlen 1 bis 40. Du wählst 1 bis 10 davon aus, das ist dein Tipp. Danach werden 10 Zahlen gezogen.',
      'The board has the numbers 1 to 40. You pick 1 to 10 of them, that is your ticket. Then 10 numbers are drawn.') },
    { h: L('Die Ziehung', 'The draw'), scene: kdraw, p: L(
      'Die 10 Kugeln kommen nacheinander. Jede gezogene Zahl, die du auch gewählt hast, ist ein Treffer und leuchtet grün.',
      'The 10 balls come one after another. Every drawn number you also picked is a hit and lights up green.') },
    { h: L('Die Auszahlung', 'The payout'), scene: kpay, p: L(
      `Unter dem Feld steht, was jede Trefferzahl bringt. Mit 5 gewählten Zahlen zahlen z. B. 3 Treffer ×${k5[3]}, 4 Treffer ×${k5[4]} und alle 5 ×${k5[5]}.`,
      `Below the board you see what each number of hits pays. With 5 picked numbers e.g. 3 hits pay ×${k5[3]}, 4 hits ×${k5[4]} and all 5 ×${k5[5]}.`) },
    { h: L('Risiko und Tipps', 'Risk and tips'), scene: krisk, p: L(
      'Tief zahlt öfter, aber weniger. Hoch zahlt erst bei vielen Treffern, dann aber sehr viel. Mehr gewählte Zahlen heisst: mehr Treffer nötig, aber höhere Spitzengewinne. «Zufall» füllt den Tipp für dich.',
      'Low pays more often but less. High only pays with many hits, but then a lot. More picked numbers means more hits needed, but bigger top prizes. "Quick pick" fills the ticket for you.') },
  ] : [
    { h: L('Der Schein', 'The ticket'), scene: lpick, p: L(
      'Unter dem Tisch liegen deine Scheine. Kreuze auf jedem 6 der 42 Zahlen an und unten eine Glückszahl ★1 bis ★6. Der Würfel füllt einen Schein zufällig aus.',
      'Your tickets lie below the table. On each one mark 6 of the 42 numbers and, at the bottom, a lucky number ★1 to ★6. The die fills a ticket at random.') },
    { h: L('Die Ziehung', 'The draw'), scene: ldraw, p: L(
      'Die Kugeln wirbeln in der Trommel. Nacheinander kommen 6 weisse Kugeln heraus und zum Schluss die goldene Glückszahl.',
      'The balls swirl in the drum. One after another 6 white balls come out, and last the golden lucky number.') },
    { h: L('Treffer', 'Hits'), scene: lhits, p: L(
      'Jede gezogene Zahl auf deinem Schein leuchtet grün, gezogene Zahlen ohne Kreuz bekommen einen weissen Rahmen. Oben rechts auf dem Schein steht das Ergebnis.',
      'Every drawn number on your ticket lights up green; drawn numbers you did not mark get a white frame. The result shows at the top right of the ticket.') },
    { h: L('Gewinnränge', 'Prize ranks'), scene: lranks, p: L(
      `Ab 3 Richtigen gewinnst du (oder 2 plus Glückszahl). In der Runde zahlen 3 Richtige ×${LOTTO_TABLE[7]}, 4 ×${LOTTO_TABLE[5]}, 5 ×${LOTTO_TABLE[3]} und 6 mit Glückszahl ×${LOTTO_TABLE[0].toLocaleString()}.`,
      `You win from 3 right (or 2 plus the lucky number). In a round 3 right pay ×${LOTTO_TABLE[7]}, 4 ×${LOTTO_TABLE[5]}, 5 ×${LOTTO_TABLE[3]} and 6 with the lucky number ×${LOTTO_TABLE[0].toLocaleString()}.`) },
    { h: L('Tageslotto', 'Daily draw'), scene: ldaily, p: L(
      `Jeden Tag ein Gratis-Schein. Gezogen wird um 20:00, auch wenn du nicht online bist; den Gewinn bekommst du beim nächsten Besuch. Der Jackpot: ${DAILY_PRIZE[0].toLocaleString('de-CH')}. Rechts siehst du, wer heute mitspielt und wer zuletzt gewonnen hat.`,
      `One free ticket every day. The draw is at 20:00, even if you are offline; you get the prize on your next visit. The jackpot: ${DAILY_PRIZE[0].toLocaleString('en-US')}. On the right you see who is in today and who won last.`) },
    { h: L('Runde mit Freunden', 'A round with friends'), scene: lroom, p: L(
      'Im Reiter «Runde» setzt du pro Schein. Eröffne einen Raum und teile den Code: Alle geben ab, der Gastgeber startet die Ziehung, und rechts siehst du bei jedem, welche Zahlen getroffen haben.',
      'In the "Round" tab you stake per ticket. Open a room and share the code: everyone hands in, the host starts the draw, and on the right you see for each player which numbers hit.') },
  ]);
  const ball = (n: number | string, cls = '', d = 0) => ({ n, cls, d });
</script>

{#snippet balls(list: { n: number | string; cls: string; d: number }[])}
  <div class="row">{#each list as b}<span class="ball {b.cls}" style="--d:{b.d}s">{b.n}</span>{/each}</div>
{/snippet}
{#snippet kpick()}
  <div class="kgrid">{#each Array(40) as _, i}<span class:mine={[3, 9, 17, 22, 35].includes(i + 1)} class="pop" style="--d:{[3, 9, 17, 22, 35].indexOf(i + 1) * 0.15}s">{i + 1}</span>{/each}</div>
{/snippet}
{#snippet kdraw()}
  <div class="col">
    {@render balls([ball(9, 'hit pop', 0), ball(14, 'pop', 0.2), ball(22, 'hit pop', 0.4), ball(31, 'pop', 0.6), ball(5, 'pop', 0.8), ball(35, 'hit pop', 1)])}
    <span class="lbl">{L('3 Treffer', '3 hits')}</span>
  </div>
{/snippet}
{#snippet kpay()}
  <div class="pays">{#each k5 as m, h}<span class:on={h === 3} class:zero={!m}><b>{h}</b>{m ? '×' + m : '–'}</span>{/each}</div>
{/snippet}
{#snippet krisk()}
  <div class="row">{#each [[L('Tief', 'Low'), 'low'], [L('Klassisch', 'Classic'), 'classic'], [L('Hoch', 'High'), 'high']] as [n, r], i}<div class="col rise" style="--d:{i * 0.3}s"><span class="chipx">{n}</span><span class="lbl">5: ×{kenoTable(5, r as 'low').at(-1)}</span></div>{/each}</div>
{/snippet}
{#snippet lpick()}
  <div class="lfelt"><div class="lcard"><LottoCard ticket={{ nums: [4, 11, 19, 27, 33, 40], lucky: 5 }} label={L('Schein', 'Ticket') + ' 1'} /></div></div>
{/snippet}
{#snippet ldraw()}
  <div class="lfelt col">
    <div class="drum"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    {@render balls([ball(4, 'pop', 0.2), ball(12, 'pop', 0.5), ball(19, 'pop', 0.8), ball(27, 'pop', 1.1), ball(36, 'pop', 1.4), ball(41, 'pop', 1.7), ball('★5', 'gold pop', 2.1)])}
  </div>
{/snippet}
{#snippet lhits()}
  <div class="lfelt"><div class="lcard"><LottoCard ticket={{ nums: [4, 11, 19, 27, 33, 40], lucky: 5 }} label={L('Schein', 'Ticket') + ' 1'} drawn={[4, 12, 19, 27, 36, 41]} lucky={5} result={'3 + ★ · ×' + LOTTO_TABLE[6]} win /></div></div>
{/snippet}
{#snippet lranks()}
  <div class="lfelt"><div class="ranks">{#each [['6 + ★', 0], ['5', 3], ['4', 5], ['3', 7]] as [r, i]}<span class:on={i === 7}><b>{r}</b>×{LOTTO_TABLE[i as number].toLocaleString()}</span>{/each}</div></div>
{/snippet}
{#snippet ldaily()}
  <div class="lfelt col">
    <span class="clock mono">03:12:45</span>
    <div class="row names">{#each ['Mila', 'Jonas', L('Du', 'You'), 'Lea'] as n, i}<span class="pop" style="--d:{i * 0.2}s">{n}</span>{/each}</div>
    <span class="lbl">🏆 Mila · 4 + ★ · +{DAILY_PRIZE[4].toLocaleString()}</span>
  </div>
{/snippet}
{#snippet lroom()}
  <div class="lfelt col">{#each [['Mila', [4, 19, 27, 33], true], [L('Du', 'You'), [4, 19, 27], false], ['Jonas', [12], false]] as [n, h, top], i}
    <span class="who rise" class:gold={top} style="--d:{i * 0.25}s"><b>{i + 1}. {n}</b>{#each [4, 12, 19, 27, 33, 41] as x}<em class:hit={(h as number[]).includes(x)}>{x}</em>{/each}</span>
  {/each}</div>
{/snippet}

<GuideSteps {steps} lang={settings.lang} {ondone} />

<style>
  .ball { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; font: 700 0.85rem 'Geist Mono Variable', monospace; color: #1d1d22; background: radial-gradient(circle at 35% 30%, #fff, #d9dde6); box-shadow: 0 3px 6px rgba(0,0,0,.35); }
  .ball.hit { background: radial-gradient(circle at 35% 30%, #a8f5cd, #2fbf71); }
  .ball.gold { background: radial-gradient(circle at 35% 30%, #fff1b8, #e0a92a); }
  .kgrid { display: grid; grid-template-columns: repeat(10, 22px); gap: 4px; }
  .kgrid span { height: 20px; border-radius: 5px; display: grid; place-items: center; font: 600 0.6rem 'Geist Mono Variable', monospace; background: rgba(255,255,255,.12); }
  .kgrid span:not(.mine) { animation: none; }
  .kgrid span.mine { background: #8a5cff; }
  .pays, .ranks { display: flex; gap: 6px; }
  .pays span, .ranks span { display: grid; justify-items: center; gap: 2px; padding: 6px 10px; border-radius: 10px; background: rgba(0,0,0,.3); font: 600 0.78rem 'Geist Mono Variable', monospace; }
  .pays b, .ranks b { font-size: 0.68rem; opacity: 0.7; }
  .pays .zero { opacity: 0.45; }
  .pays .on, .ranks .on { background: #f2c046; color: #2a1a00; }
  .lfelt { position: absolute; inset: 0; display: grid; place-items: center; color: #f7ecd4; background: radial-gradient(ellipse at 50% 40%, #16306e, #0a1636 80%); box-shadow: inset 0 0 0 4px rgba(216,178,106,.55); }
  .lfelt.col { place-content: center; justify-items: center; gap: 10px; }
  .lcard { width: 230px; transform: scale(0.66); }
  .drum { position: relative; width: 74px; height: 74px; border-radius: 50%; border: 3px solid #d8b26a; background: radial-gradient(circle at 50% 70%, rgba(60,90,170,.4), rgba(8,16,42,.8)); overflow: hidden; }
  .drum i { position: absolute; width: 14px; height: 14px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff, #b9bfcc); left: calc(50% - 7px); top: calc(50% - 7px); animation: swirl 1.2s linear infinite; }
  .drum i:nth-child(2n) { animation-duration: 0.9s; animation-direction: reverse; }
  .drum i:nth-child(1) { --r: 22px; } .drum i:nth-child(2) { --r: 14px; animation-delay: -0.3s; } .drum i:nth-child(3) { --r: 24px; animation-delay: -0.6s; } .drum i:nth-child(4) { --r: 8px; animation-delay: -0.2s; }
  .drum i:nth-child(5) { --r: 18px; animation-delay: -0.8s; } .drum i:nth-child(6) { --r: 20px; animation-delay: -0.5s; } .drum i:nth-child(7) { --r: 12px; animation-delay: -1s; } .drum i:nth-child(8) { --r: 23px; animation-delay: -0.1s; }
  @keyframes swirl { from { transform: rotate(0) translateX(var(--r, 16px)); } to { transform: rotate(360deg) translateX(var(--r, 16px)); } }
  .clock { font-size: 1.6rem; color: #f3d488; letter-spacing: 0.04em; }
  .names span, .who { padding: 3px 10px; border-radius: 999px; background: rgba(0,0,0,.3); box-shadow: inset 0 0 0 1px rgba(232,196,120,.25); font-size: 0.75rem; }
  .names { gap: 5px; }
  .who { display: flex; gap: 3px; align-items: center; border-radius: 10px; }
  .who b { min-width: 70px; font-weight: 600; }
  .who.gold { box-shadow: inset 0 0 0 1px #e8c478; }
  .who em { font: normal 600 0.66rem 'Geist Mono Variable', monospace; min-width: 20px; text-align: center; border-radius: 5px; padding: 2px 0; background: rgba(255,255,255,.08); }
  .who em.hit { background: #2fbf71; color: #04311b; }
</style>
