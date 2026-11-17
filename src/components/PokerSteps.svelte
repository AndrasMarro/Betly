<script lang="ts">
  // Texas Hold'em explained in steps with real cards.
  import GuideSteps, { type Step } from './GuideSteps.svelte';
  import CardView from './Card.svelte';
  import { settings } from '../lib/state.svelte';
  let { ondone }: { ondone?: () => void } = $props();
  const de = $derived(settings.lang === 'de');
  const L = (a: string, b: string) => (de ? a : b);
  const C = (r: number, s: number) => ({ r, s }); // r 1 = ace … 13 = king · s 0♠ 1♥ 2♦ 3♣
  const B = { r: 0, s: 0 };
  type Row = [string, { r: number; s: number }[]];
  const steps: Step[] = $derived([
    { h: L('Das Ziel', 'The goal'), scene: goal, p: L(
      'Gewinne die Chips in der Mitte, den Pot: entweder mit der besten Hand beim Aufdecken oder indem alle anderen vorher aufgeben.',
      'Win the chips in the middle, the pot: either with the best hand at the showdown or by making everyone else give up first.') },
    { h: L('Zwei Karten für dich', 'Two cards for you'), scene: hole, p: L(
      'Jeder bekommt zwei verdeckte Karten, die nur er sieht. Vorher setzen die zwei Spieler links vom Dealer die Blinds, damit schon etwas im Pot liegt.',
      'Everyone gets two face-down cards only they can see. Before that the two players left of the dealer post the blinds, so there is already something in the pot.') },
    { h: L('Setzen: deine Möglichkeiten', 'Betting: your options'), scene: actions, p: L(
      'Wenn du dran bist: Passen (aufgeben), Schieben (nichts setzen, wenn niemand gesetzt hat), Mitgehen (gleich viel wie der letzte Einsatz), Setzen oder Erhöhen. Eine Setzrunde endet, wenn alle gleich viel gesetzt haben.',
      'On your turn: fold (give up), check (bet nothing if nobody has bet), call (match the last bet), bet or raise. A betting round ends when everyone has put in the same amount.') },
    { h: L('Flop, Turn, River', 'Flop, turn, river'), scene: board, p: L(
      'Dann kommen offene Gemeinschaftskarten, die alle nutzen: zuerst drei (Flop), dann eine (Turn), dann noch eine (River). Nach jedem Schritt wird wieder gesetzt.',
      'Then come face-up community cards everyone can use: first three (flop), then one (turn), then one more (river). After each step there is another round of betting.') },
    { h: L('Die beste Hand aus 7 Karten', 'The best hand from 7 cards'), scene: best, p: L(
      'Deine Hand sind die besten 5 Karten aus deinen 2 und den 5 auf dem Tisch. Hier: Drilling Könige – zwei auf der Hand, einer auf dem Tisch.',
      'Your hand is the best 5 cards from your 2 and the 5 on the board. Here: three kings — two in your hand, one on the board.') },
    { h: L('Rangfolge (von unten)', 'Rankings (from the bottom)'), scene: low, p: L(
      'Höchste Karte < Paar < Zwei Paare < Drilling (drei Gleiche) < Strasse (fünf in Folge).',
      'High card < pair < two pair < three of a kind < straight (five in a row).') },
    { h: L('Rangfolge (die Grossen)', 'Rankings (the big ones)'), scene: high, p: L(
      'Flush (fünf einer Farbe) < Full House (Drilling + Paar) < Vierling < Straight Flush < Royal Flush (10 bis Ass in einer Farbe). Bei Gleichstand entscheiden die höheren Karten.',
      'Flush (five of one suit) < full house (three + pair) < four of a kind < straight flush < royal flush (10 to ace in one suit). Ties are broken by the higher cards.') },
    { h: L('Showdown und All-in', 'Showdown and all-in'), scene: show, p: L(
      'Sind nach dem River noch mehrere dabei, werden die Karten gezeigt, die beste Hand gewinnt den Pot. Wer nicht mehr genug Chips hat, geht All-in und kann nur den Teil gewinnen, den er selbst bezahlt hat (Side-Pot).',
      'If more than one player is left after the river, the cards are shown and the best hand takes the pot. A player short of chips goes all-in and can only win the part they paid into (side pot).') },
  ]);
</script>

{#snippet c(card: { r: number; s: number }, cls = '', d = 0)}<div class={cls} style="--d:{d}s"><CardView {card} /></div>{/snippet}

{#snippet goal()}
  <div class="col"><span class="chipx gold pop">Pot 240</span><div class="row">{@render c(C(1, 1), 'fly', 0)}{@render c(C(13, 1), 'fly', 0.3)}</div></div>
{/snippet}
{#snippet hole()}
  <div class="row"><div class="col"><span class="chipx">SB 10</span><span class="chipx">BB 20</span></div>{@render c(C(1, 0), 'fly', 0.3)}{@render c(C(13, 0), 'fly', 0.6)}<div class="tight">{@render c(B, 'fly', 0.9)}{@render c(B, 'fly', 1.1)}</div></div>
{/snippet}
{#snippet actions()}
  <div class="col">{#each [L('Passen', 'Fold'), L('Schieben', 'Check'), L('Mitgehen 20', 'Call 20'), L('Erhöhen auf 60', 'Raise to 60')] as a, i}<span class="chipx pop" style="--d:{i * 0.35}s">{a}</span>{/each}</div>
{/snippet}
{#snippet board()}
  <div class="col"><div class="row">{#each [C(13, 2), C(7, 3), C(2, 1)] as k, i}{@render c(k, 'fly', i * 0.15)}{/each}{@render c(C(9, 0), 'fly', 1)}{@render c(C(5, 2), 'fly', 1.6)}</div>
    <div class="row"><span class="lbl">Flop</span><span class="lbl" style="margin-left:90px">Turn</span><span class="lbl">River</span></div></div>
{/snippet}
{#snippet best()}
  <div class="col"><div class="row">{@render c(C(13, 0), 'glow')}{@render c(C(13, 1), 'glow')}<span class="chipx">+</span>{@render c(C(13, 2), 'glow')}{@render c(C(7, 3), 'bad')}{@render c(C(2, 1), 'bad')}{@render c(C(9, 0))}{@render c(C(5, 2))}</div><span class="chipx gold">{L('Drilling', 'Three of a kind')}</span></div>
{/snippet}
{#snippet low()}
  <div class="grid2" style="--cw:30px">
    {#each ([[L('Paar', 'Pair'), [C(9, 0), C(9, 1)]], [L('Zwei Paare', 'Two pair'), [C(9, 0), C(9, 1), C(4, 2), C(4, 3)]], [L('Drilling', 'Three'), [C(12, 0), C(12, 1), C(12, 2)]], [L('Strasse', 'Straight'), [C(5, 0), C(6, 1), C(7, 2), C(8, 3), C(9, 0)]]] as Row[]) as [n, cs], i}
      <div class="row pop" style="--d:{i * 0.3}s"><span class="lbl" style="width:64px">{n}</span><div class="tight">{#each cs as k}{@render c(k)}{/each}</div></div>
    {/each}
  </div>
{/snippet}
{#snippet high()}
  <div class="grid2" style="--cw:30px">
    {#each ([['Flush', [C(2, 1), C(6, 1), C(9, 1), C(11, 1), C(13, 1)]], ['Full House', [C(8, 0), C(8, 1), C(8, 2), C(3, 3), C(3, 0)]], [L('Vierling', 'Four'), [C(7, 0), C(7, 1), C(7, 2), C(7, 3)]], ['Royal Flush', [C(10, 0), C(11, 0), C(12, 0), C(13, 0), C(1, 0)]]] as Row[]) as [n, cs], i}
      <div class="row pop" style="--d:{i * 0.3}s"><span class="lbl" style="width:64px">{n}</span><div class="tight">{#each cs as k}{@render c(k, i === 3 ? 'glow' : '')}{/each}</div></div>
    {/each}
  </div>
{/snippet}
{#snippet show()}
  <div class="row"><div class="col"><div class="tight">{@render c(C(13, 0))}{@render c(C(13, 1))}</div><span class="chipx gold pop" style="--d:0.8s">{L('Gewinnt', 'Wins')}</span></div>
    <span class="chipx">vs</span><div class="col"><div class="tight bad">{@render c(C(1, 2))}{@render c(C(12, 2))}</div><span class="chipx">All-in</span></div></div>
{/snippet}

<GuideSteps {steps} lang={settings.lang} {ondone} />

<style>
  .grid2 { display: grid; grid-template-columns: auto auto; gap: 14px 20px; }
</style>
