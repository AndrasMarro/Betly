<script lang="ts">
  // Keno and Lotto explained in steps with animated balls.
  import GuideSteps, { type Step } from './GuideSteps.svelte';
  import { settings } from '../lib/state.svelte';
  import { kenoTable, LOTTO_TABLE, DAILY_PRIZE } from '../games/lotto';
  import LottoScene from './LottoScene.svelte';
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
      'Unter dem Tisch liegt dein Schein. Tippe 6 der 42 Zahlen an, bis oben rechts 6/6 steht, und unten eine Glückszahl ★1 bis ★6. Der Würfel oben rechts füllt den Schein zufällig aus.',
      'Your ticket lies below the table. Tap 6 of the 42 numbers until the top right shows 6/6, and a lucky number ★1 to ★6 at the bottom. The die at the top right fills the ticket at random.') },
    { h: L('Die Ziehung', 'The draw'), scene: ldraw, p: L(
      'Die Kugeln wirbeln in der Trommel. Nacheinander fallen 6 Kugeln heraus, zum Schluss die goldene Glückszahl.',
      'The balls swirl in the drum. One after another 6 balls drop out, and last the golden lucky number.') },
    { h: L('Treffer', 'Hits'), scene: lhits, p: L(
      'Gezogene Zahlen, die du angekreuzt hast, werden auf deinem Schein grün. Gezogene Zahlen ohne Kreuz bekommen nur einen weissen Rahmen. Oben rechts erscheint das Ergebnis, hier 3 Richtige plus Glückszahl.',
      'Drawn numbers you marked turn green on your ticket. Drawn numbers you did not mark only get a white frame. The result appears at the top right, here 3 right plus the lucky number.') },
    { h: L('Gewinnränge', 'Prize ranks'), scene: lranks, p: L(
      'Gewinnen kannst du ab 3 Richtigen oder mit 2 Richtigen plus Glückszahl. In der Runde wird dein Einsatz multipliziert, im Tageslotto gibt es feste Beträge.',
      'You win from 3 right, or with 2 right plus the lucky number. In a round your stake is multiplied; the daily draw pays fixed amounts.') },
    { h: L('Tageslotto', 'Daily draw'), scene: ldaily, p: L(
      `Jeden Tag gibt es einen Gratis-Schein. Gib ihn bis 20:00 ab, dann wird gezogen. Du musst nicht online sein: Den Gewinn bekommst du beim nächsten Besuch, der Jackpot ist ${DAILY_PRIZE[0].toLocaleString('de-CH')}. Rechts siehst du, wer heute dabei ist und wer zuletzt gewonnen hat.`,
      `Every day there is a free ticket. Hand it in before 20:00, then the draw happens. You don’t need to be online: you get the prize on your next visit, and the jackpot is ${DAILY_PRIZE[0].toLocaleString('en-US')}. On the right you see who is in today and who won last.`) },
    { h: L('Runde mit Freunden', 'A round with friends'), scene: lroom, p: L(
      'Im Reiter «Runde» spielst du um Einsatz, mit bis zu 6 Scheinen. Eröffne oben einen Raum und teile den Code. Wenn alle abgegeben haben, startet der Gastgeber die Ziehung, und rechts siehst du bei allen, welche Zahlen getroffen haben.',
      'In the "Round" tab you play for a stake, with up to 6 tickets. Open a room at the top and share the code. Once everyone has handed in, the host starts the draw, and on the right you see everyone’s hits.') },
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
{#snippet lpick()}<LottoScene kind="pick" />{/snippet}
{#snippet ldraw()}<LottoScene kind="draw" />{/snippet}
{#snippet lhits()}<LottoScene kind="hits" />{/snippet}
{#snippet lranks()}<LottoScene kind="ranks" />{/snippet}
{#snippet ldaily()}<LottoScene kind="daily" />{/snippet}
{#snippet lroom()}<LottoScene kind="room" />{/snippet}

<GuideSteps {steps} lang={settings.lang} {ondone} />

<style>
  .ball { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; font: 700 0.85rem 'Geist Mono Variable', monospace; color: #1d1d22; background: radial-gradient(circle at 35% 30%, #fff, #d9dde6); box-shadow: 0 3px 6px rgba(0,0,0,.35); }
  .ball.hit { background: radial-gradient(circle at 35% 30%, #a8f5cd, #2fbf71); }
  .ball.gold { background: radial-gradient(circle at 35% 30%, #fff1b8, #e0a92a); }
  .kgrid { display: grid; grid-template-columns: repeat(10, 22px); gap: 4px; }
  .kgrid span { height: 20px; border-radius: 5px; display: grid; place-items: center; font: 600 0.6rem 'Geist Mono Variable', monospace; background: rgba(255,255,255,.12); }
  .kgrid span:not(.mine) { animation: none; }
  .kgrid span.mine { background: #8a5cff; }
  .pays { display: flex; gap: 6px; }
  .pays span { display: grid; justify-items: center; gap: 2px; padding: 6px 10px; border-radius: 10px; background: rgba(0,0,0,.3); font: 600 0.78rem 'Geist Mono Variable', monospace; }
  .pays b { font-size: 0.68rem; opacity: 0.7; }
  .pays .zero { opacity: 0.45; }
  .pays .on { background: #f2c046; color: #2a1a00; }
</style>
