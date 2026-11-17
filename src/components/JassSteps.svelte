<script lang="ts">
  // Schieber explained in steps, with the game's own cards (in the chosen deck).
  import GuideSteps, { type Step } from './GuideSteps.svelte';
  import JassCard from './JassCard.svelte';
  import { settings } from '../lib/state.svelte';
  import { pickDeck, JASS } from '../lib/decks';
  let { ondone }: { ondone?: () => void } = $props();
  const deck = $derived(pickDeck(settings.cards, JASS));
  const de = $derived(settings.lang === 'de');
  const L = (a: string, b: string) => (de ? a : b);
  const C = (s: number, r: number) => ({ s, r });
  const swiss = $derived(deck === 'de');
  const steps: Step[] = $derived([
    { h: L('Das Spiel', 'The game'), scene: team, p: L(
      'Schieber: Du und dein Partner (gegenüber) gegen zwei Gegner. Wer im Uhrzeigersinn dran ist, spielt eine Karte; die stärkste Karte gewinnt den Stich. Pro Runde gibt es 157 Punkte. Das Team, das zuerst das Ziel (z. B. 1000) erreicht, gewinnt.',
      'Schieber: you and your partner (opposite) against two opponents. Everyone plays a card in turn; the strongest card wins the trick. Each round is worth 157 points. The first team to the target (e.g. 1000) wins.') },
    { h: L('36 Karten', '36 cards'), scene: cards, p: swiss ? L(
      'Vier Farben: Rosen, Schilten, Eicheln, Schellen. Werte von der 6 bis zum Ass: 6, 7, 8, 9, Banner (10), Under, Ober, König, Ass. Jeder bekommt 9 Karten.',
      'Four suits: roses, shields, acorns, bells. Ranks from 6 to ace: 6, 7, 8, 9, banner (10), under, ober, king, ace. Everyone gets 9 cards.') : L(
      'Vier Farben: Herz, Schaufel, Kreuz, Ecken. Werte von der 6 bis zum Ass: 6, 7, 8, 9, 10, Bauer, Dame, König, Ass. Jeder bekommt 9 Karten.',
      'Four suits: hearts, spades, clubs, diamonds. Ranks from 6 to ace: 6, 7, 8, 9, 10, jack, queen, king, ace. Everyone gets 9 cards.') },
    { h: L('Trumpf ansagen oder schieben', 'Calling trump or pushing'), scene: call, p: L(
      'Wer an der Reihe ist, bestimmt das Spiel: eine Trumpffarbe, Obenabe oder Undenufe. Ist das Blatt schwach, kannst du schieben – dann muss dein Partner wählen.',
      'The player whose turn it is chooses the game: a trump suit, Obenabe or Undenufe. With a weak hand you can push — then your partner has to choose.') },
    { h: L('Die Trümpfe', 'The trumps'), scene: trumps, p: L(
      `Im Trumpf ändert sich die Reihenfolge: ${swiss ? 'Under' : 'Bauer'} (20 Punkte) ist die höchste Karte, dann die Nell, also die 9 (14), dann Ass (11), König, ${swiss ? 'Ober' : 'Dame'}, 10, 8, 7, 6. Ein Trumpf sticht jede andere Farbe.`,
      `In trumps the order changes: the ${swiss ? 'under' : 'jack'} (20 points) is the highest card, then the Nell, the 9 (14), then ace (11), king, ${swiss ? 'ober' : 'queen'}, 10, 8, 7, 6. A trump beats any other suit.`) },
    { h: L('Punkte der Nebenfarben', 'Points in the other suits'), scene: points, p: L(
      `Ass 11, 10 zählt 10, König 4, ${swiss ? 'Ober' : 'Dame'} 3, ${swiss ? 'Under' : 'Bauer'} 2; die 9 bis 6 zählen nichts. Der letzte Stich bringt 5 Punkte extra.`,
      `Ace 11, the 10 counts 10, king 4, ${swiss ? 'ober' : 'queen'} 3, ${swiss ? 'under' : 'jack'} 2; 9 to 6 count nothing. The last trick is worth 5 more.`) },
    { h: L('Farbe angeben', 'Following suit'), scene: follow, p: L(
      'Wer die ausgespielte Farbe hat, muss sie spielen – oder darf stattdessen trumpfen. Wer sie nicht hat, spielt eine beliebige Karte. Untertrumpfen ist verboten, und den Trumpf-Bauer musst du nie zugeben.',
      'If you have the suit led you must play it — or you may trump instead. Without it you may play any card. Undertrumping is not allowed, and you never have to give up the trump jack.') },
    { h: L('Obenabe und Undenufe', 'Obenabe and Undenufe'), scene: updown, p: L(
      'Ohne Trumpf: Bei Obenabe sticht das Ass, bei Undenufe die 6. Die Achter zählen je 8 Punkte, bei Undenufe zählt die 6 elf und das Ass nichts.',
      'No trumps: in Obenabe the ace is highest, in Undenufe the 6. The eights count 8 each; in Undenufe the 6 counts 11 and the ace nothing.') },
    { h: L('Weis und Stöck', 'Melds and Stöck'), scene: weis, p: L(
      'Im ersten Stich zeigt jeder seinen Weis: drei Karten in Folge 20, vier 50, fünf 100; vier Gleiche bis 200. Nur das Team mit dem besten Weis zählt. Stöck: König und Ober (Dame) im Trumpf in einer Hand geben 20 Punkte.',
      'In the first trick everyone shows their melds: three in sequence 20, four 50, five 100; four of a kind up to 200. Only the team with the best meld scores. Stöck: king and queen of trumps in one hand are worth 20.') },
    { h: L('Match', 'Match'), scene: match, p: L(
      'Macht ein Team alle 9 Stiche, gibt es 257 statt 157 Punkte. Ein Sieg des ganzen Spiels zahlt deinen Einsatz ×1,9. Mit Freunden: Raum öffnen, und Mitspieler übernehmen die Plätze der Bots.',
      'If a team takes all 9 tricks it scores 257 instead of 157. Winning the whole match pays your stake ×1.9. With friends: open a room and players take the bots’ seats.') },
  ]);
</script>

{#snippet card(c: { s: number; r: number }, cls = '', d = 0)}<div class={cls} style="--d:{d}s"><JassCard card={c} {deck} /></div>{/snippet}

{#snippet team()}
  <div class="col">
    <span class="chipx">{L('Partner', 'Partner')}</span>
    <div class="row"><span class="chipx">{L('Gegner', 'Opponent')}</span>
      <div class="row">{@render card(C(0, 14), 'fly', 0)}{@render card(C(0, 9), 'fly', 0.3)}{@render card(C(0, 13), 'fly', 0.6)}</div>
      <span class="chipx">{L('Gegner', 'Opponent')}</span></div>
    <span class="chipx gold">{L('Du', 'You')}</span>
  </div>
{/snippet}
{#snippet cards()}
  <div class="col"><div class="tight">{#each [6, 7, 8, 9, 10, 11, 12, 13, 14] as r, i}{@render card(C(0, r), 'rise', i * 0.12)}{/each}</div>
    <div class="row">{#each [0, 1, 2, 3] as s}<span class="chipx"><JassCard icon card={C(s, 6)} {deck} /></span>{/each}</div></div>
{/snippet}
{#snippet call()}
  <div class="row">{#each [0, 1, 2, 3] as s, i}<span class="chipx pop" style="--d:{i * 0.2}s"><JassCard icon card={C(s, 6)} {deck} /></span>{/each}
    <span class="chipx pop" style="--d:0.8s">↓ Obenabe</span><span class="chipx pop" style="--d:1s">↑ Undenufe</span><span class="chipx gold pop" style="--d:1.3s">{L('Schieben →', 'Push →')}</span></div>
{/snippet}
{#snippet trumps()}
  <div class="col"><div class="row" style="--cw:46px; gap:6px">{#each [11, 9, 14, 13, 12, 10] as r, i}{@render card(C(3, r), i < 2 ? 'glow' : '', i * 0.2)}{/each}</div>
    <div class="row" style="gap:6px">{#each [20, 14, 11, 4, 3, 10] as p}<span class="lbl" style="width:46px">{p}</span>{/each}</div></div>
{/snippet}
{#snippet points()}
  <div class="col"><div class="row">{#each [[14, 11], [10, 10], [13, 4], [12, 3], [11, 2], [9, 0]] as [r, p], i}<div class="col">{@render card(C(1, r), 'pop', i * 0.15)}<span class="lbl">{p}</span></div>{/each}</div></div>
{/snippet}
{#snippet follow()}
  <div class="row">{@render card(C(0, 10), 'fly', 0)}<span class="chipx">→</span>{@render card(C(0, 13), 'fly', 0.6)}<span class="chipx">{L('oder', 'or')}</span>{@render card(C(3, 7), 'fly glow', 1.1)}<span class="lbl">{L('Trumpf', 'Trump')}</span></div>
{/snippet}
{#snippet updown()}
  <div class="row"><div class="col">{@render card(C(2, 14), 'glow', 0)}<span class="lbl">↓ Obenabe</span></div><div class="col">{@render card(C(2, 6), 'glow', 0.8)}<span class="lbl">↑ Undenufe</span></div><div class="col">{@render card(C(2, 8), 'pop', 0.4)}<span class="lbl">8 = 8</span></div></div>
{/snippet}
{#snippet weis()}
  <div class="row"><div class="tight">{#each [7, 8, 9] as r, i}{@render card(C(1, r), 'pop', i * 0.2)}{/each}</div><span class="chipx gold pop" style="--d:0.8s">+20</span>
    <div class="tight">{#each [13, 12] as r, i}{@render card(C(3, r), 'pop glow', 1 + i * 0.2)}{/each}</div><span class="chipx gold pop" style="--d:1.5s">Stöck +20</span></div>
{/snippet}
{#snippet match()}
  <div class="col"><div class="tight">{#each Array.from({ length: 9 }, (_, i) => i) as i}{@render card(C(i % 4, 6 + i), 'out', i * 0.1)}{/each}</div><span class="chipx gold">257</span></div>
{/snippet}

<GuideSteps {steps} lang={settings.lang} {ondone} />
