<script lang="ts">
  // Keno and Lotto explained in steps with animated balls.
  import GuideSteps, { type Step } from './GuideSteps.svelte';
  import { settings } from '../lib/state.svelte';
  import { kenoTable, LOTTO_TABLE } from '../games/lotto';
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
    { h: L('Der Tipp', 'The ticket'), scene: lpick, p: L(
      'Kreuze 6 der 42 Zahlen an und dazu eine Glückszahl von 1 bis 6. Ein Tipp kostet deinen Einsatz; du kannst bis zu 6 Tipps abgeben.',
      'Mark 6 of the 42 numbers plus one lucky number from 1 to 6. A ticket costs your stake; you can play up to 6 tickets.') },
    { h: L('Die Ziehung', 'The draw'), scene: ldraw, p: L(
      'Aus der Trommel kommen 6 weisse Kugeln und eine goldene Glückszahl. Im Raum sehen alle dieselbe Ziehung.',
      'The drum draws 6 white balls and one golden lucky number. In a room everyone sees the same draw.') },
    { h: L('Gewinnränge', 'Prize ranks'), scene: lranks, p: L(
      `Ab 3 Richtigen gewinnst du (oder 2 plus Glückszahl). 3 Richtige zahlen ×${LOTTO_TABLE[7]}, 4 ×${LOTTO_TABLE[5]}, 5 ×${LOTTO_TABLE[3]}, und 6 Richtige mit Glückszahl knacken den Jackpot: ×${LOTTO_TABLE[0].toLocaleString()}.`,
      `You win from 3 right (or 2 plus the lucky number). 3 right pay ×${LOTTO_TABLE[7]}, 4 ×${LOTTO_TABLE[5]}, 5 ×${LOTTO_TABLE[3]}, and 6 right with the lucky number crack the jackpot: ×${LOTTO_TABLE[0].toLocaleString()}.`) },
    { h: L('Zusammen spielen', 'Play together'), scene: lroom, p: L(
      'Eröffne oben einen Raum und teile den Code. Alle geben ihre Tipps ab, der Gastgeber startet die Ziehung, und am Ende zeigt die Rangliste, wer am meisten getroffen hat.',
      'Open a room at the top and share the code. Everyone hands in their tickets, the host starts the draw, and the leaderboard shows who hit the most.') },
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
  <div class="col">
    <div class="kgrid l">{#each Array(42) as _, i}<span class:mine={[4, 11, 19, 27, 33, 40].includes(i + 1)} class="pop" style="--d:{[4, 11, 19, 27, 33, 40].indexOf(i + 1) * 0.15}s">{i + 1}</span>{/each}</div>
    <div class="row lucky">{#each [1, 2, 3, 4, 5, 6] as n}<span class:mine={n === 5}>{n}</span>{/each}</div>
  </div>
{/snippet}
{#snippet ldraw()}
  {@render balls([ball(4, 'hit pop', 0), ball(12, 'pop', 0.3), ball(19, 'hit pop', 0.6), ball(27, 'hit pop', 0.9), ball(36, 'pop', 1.2), ball(41, 'pop', 1.5), ball(5, 'gold pop', 1.9)])}
{/snippet}
{#snippet lranks()}
  <div class="ranks">{#each [['6 + ★', 0], ['5', 3], ['4', 5], ['3', 7]] as [r, i]}<span class:on={i === 7}><b>{r}</b>×{LOTTO_TABLE[i as number].toLocaleString()}</span>{/each}</div>
{/snippet}
{#snippet lroom()}
  <div class="col">{#each [['Mila', 4, true], ['Du', 3, false], ['Jonas', 1, false]] as [n, h, top], i}<span class="chipx rise" class:gold={top} style="--d:{i * 0.25}s">{i + 1}. {n} · {h} {L('Richtige', 'right')}</span>{/each}</div>
{/snippet}

<GuideSteps {steps} lang={settings.lang} {ondone} />

<style>
  .ball { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; font: 700 0.85rem 'Geist Mono Variable', monospace; color: #1d1d22; background: radial-gradient(circle at 35% 30%, #fff, #d9dde6); box-shadow: 0 3px 6px rgba(0,0,0,.35); }
  .ball.hit { background: radial-gradient(circle at 35% 30%, #a8f5cd, #2fbf71); }
  .ball.gold { background: radial-gradient(circle at 35% 30%, #fff1b8, #e0a92a); }
  .kgrid { display: grid; grid-template-columns: repeat(10, 22px); gap: 4px; }
  .kgrid.l { grid-template-columns: repeat(14, 20px); }
  .kgrid span, .lucky span { height: 20px; border-radius: 5px; display: grid; place-items: center; font: 600 0.6rem 'Geist Mono Variable', monospace; background: rgba(255,255,255,.12); }
  .kgrid span:not(.mine) { animation: none; }
  .kgrid span.mine, .lucky span.mine { background: #8a5cff; }
  .lucky span { width: 22px; }
  .lucky span.mine { background: #e0a92a; color: #2a1a00; }
  .pays, .ranks { display: flex; gap: 6px; }
  .pays span, .ranks span { display: grid; justify-items: center; gap: 2px; padding: 6px 10px; border-radius: 10px; background: rgba(0,0,0,.3); font: 600 0.78rem 'Geist Mono Variable', monospace; }
  .pays b, .ranks b { font-size: 0.68rem; opacity: 0.7; }
  .pays .zero { opacity: 0.45; }
  .pays .on, .ranks .on { background: #f2c046; color: #2a1a00; }
</style>
