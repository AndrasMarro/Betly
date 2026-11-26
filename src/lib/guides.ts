// How-to-play texts per game (German first, English second). Simple games like coin flip need none.
export type Section = { h: string; p?: string; li?: string[] };
type Guide = { de: Section[]; en: Section[]; ranks?: boolean };

export const GUIDES: Record<string, Guide> = {
  roulette: {
    de: [
      { h: 'Ziel', p: 'Setze auf die Zahl oder Zahlengruppe, in der die Kugel landet. Der Kessel hat 37 Fächer: 1–36 und die grüne Null.' },
      { h: 'Setzen', li: ['Chip wählen, dann auf den Tisch klicken: Mitte eines Feldes = Zahl, Kante zwischen zwei Zahlen = Split, Ecke = Carré, Aussenkante einer Reihe = Transversale.', 'Rechtsklick (oder Rückgängig) nimmt Chips wieder weg; ×2 verdoppelt alles, Nochmal setzt die letzte Runde erneut.', 'Der Kessel-Ring (Racetrack) setzt Nachbarwetten und Ansagen: Voisins, Tiers, Orphelins, Jeu Zéro.'] },
      { h: 'Auszahlungen', li: ['Plein (1 Zahl) 35:1 · Cheval/Split 17:1 · Transversale 11:1 · Carré 8:1 · Sixain 5:1', 'Dutzend / Kolonne 2:1', 'Rot/Schwarz, Gerade/Ungerade, 1–18/19–36 1:1'] },
      { h: 'Autoplay', p: 'Mit «Auto-Runden» dreht der Kessel von selbst: Jede Runde hat ein Zeitfenster zum Setzen, danach heisst es «Rien ne va plus». Du kannst jederzeit einsteigen oder aussetzen, wie bei Rocket.' },
      { h: 'La Partage', p: 'Wenn aktiv, bekommst du bei der Null die Hälfte deiner einfachen Chancen (Rot/Schwarz usw.) zurück.' },
    ],
    en: [
      { h: 'Goal', p: 'Bet on the number or group of numbers the ball lands in. The wheel has 37 pockets: 1–36 and the green zero.' },
      { h: 'Placing bets', li: ['Pick a chip, then click the layout: centre of a box = straight, edge between two numbers = split, corner = corner, outer edge of a row = street.', 'Right-click (or Undo) removes chips; ×2 doubles everything, Rebet repeats the last round.', 'The racetrack places neighbour and call bets: Voisins, Tiers, Orphelins, Jeu Zéro.'] },
      { h: 'Payouts', li: ['Straight 35:1 · Split 17:1 · Street 11:1 · Corner 8:1 · Six line 5:1', 'Dozen / column 2:1', 'Red/black, even/odd, 1–18/19–36 1:1'] },
      { h: 'Autoplay', p: 'With "Auto rounds" the wheel spins on its own: every round has a betting window, then "no more bets". Join or sit out any time, just like Rocket.' },
      { h: 'La Partage', p: 'When on, a zero returns half of your even-money bets (red/black etc.).' },
    ],
  },
  blackjack: {
    de: [
      { h: 'Ziel', p: 'Komm näher an 21 als der Dealer, ohne darüber zu gehen. Zahlenkarten zählen ihren Wert, Bilder 10, Ass 1 oder 11.' },
      { h: 'Ablauf', li: ['Platz nehmen, Chip wählen und auf deinen Kreis setzen. Du kannst mehrere Plätze spielen.', 'Austeilen: Jeder bekommt zwei Karten, der Dealer eine offen.', 'Blackjack (Ass + 10er mit den ersten zwei Karten) zahlt 3:2, je nach Regel auch 6:5.'] },
      { h: 'Aktionen', li: ['Hit (H): weitere Karte · Stand (S): stehen bleiben', 'Double (D): Einsatz verdoppeln, genau eine Karte', 'Split (P): Paar in zwei Hände teilen', 'Surrender (R): aufgeben, halber Einsatz zurück (falls erlaubt)', 'Insurance: Absicherung, wenn der Dealer ein Ass zeigt; zahlt 2:1'] },
      { h: 'Dealer', p: 'Der Dealer zieht bis 17. Bei «H17» zieht er auch auf eine weiche 17. Die Regeln (Decks, Double, Split, Surrender …) stellst du unter «Regeln» ein.' },
      { h: 'Tipps', p: 'Der Tipp-Schalter markiert die Basic-Strategy-Aktion mit einem goldenen Rand.' },
    ],
    en: [
      { h: 'Goal', p: 'Get closer to 21 than the dealer without going over. Number cards count their value, faces 10, aces 1 or 11.' },
      { h: 'Flow', li: ['Take a seat, pick a chip and click your circle. You can play several seats.', 'Deal: everyone gets two cards, the dealer shows one.', 'Blackjack (ace + ten-value on the first two cards) pays 3:2, or 6:5 depending on the rules.'] },
      { h: 'Actions', li: ['Hit (H): another card · Stand (S): keep your hand', 'Double (D): double the bet, exactly one card', 'Split (P): split a pair into two hands', 'Surrender (R): give up, half the bet back (if allowed)', 'Insurance: side bet when the dealer shows an ace; pays 2:1'] },
      { h: 'Dealer', p: 'The dealer draws to 17. With "H17" the dealer also hits a soft 17. Set the rules (decks, double, split, surrender …) under "Rules".' },
      { h: 'Hints', p: 'The hints switch marks the basic strategy action with a gold outline.' },
    ],
  },
  holdem: {
    ranks: true,
    de: [
      { h: 'Ziel', p: 'Gewinne den Pot: mit der besten Fünf-Karten-Hand beim Showdown oder indem alle anderen aufgeben.' },
      { h: 'Ablauf', li: ['Small und Big Blind sind Pflichteinsätze links vom Dealer-Knopf.', 'Jeder bekommt zwei verdeckte Karten (Preflop).', 'Flop: drei Gemeinschaftskarten · Turn: eine vierte · River: eine fünfte.', 'Nach jeder Phase gibt es eine Setzrunde.', 'Aus deinen zwei und den fünf offenen Karten zählt die beste Kombination aus fünf.'] },
      { h: 'Aktionen', li: ['Fold: aufgeben · Check: schieben, wenn nichts zu bezahlen ist', 'Call: mitgehen · Bet/Raise: setzen oder erhöhen (mindestens um die letzte Erhöhung)', 'All-in: alles setzen; es entstehen Side-Pots'] },
      { h: 'Helfer', p: 'Zeigt deine aktuelle Hand, die Gewinnchance (simuliert) und die Pot Odds. Wenn die Gewinnchance grösser ist als die Pot Odds, lohnt sich ein Call meist.' },
    ],
    en: [
      { h: 'Goal', p: 'Win the pot: with the best five-card hand at showdown, or by making everyone else fold.' },
      { h: 'Flow', li: ['Small and big blind are forced bets left of the dealer button.', 'Everyone gets two hole cards (preflop).', 'Flop: three community cards · Turn: a fourth · River: a fifth.', 'Each street has a betting round.', 'The best five of your two cards plus the five on the board count.'] },
      { h: 'Actions', li: ['Fold: give up · Check: pass when there is nothing to call', 'Call: match the bet · Bet/Raise: bet or raise (at least by the last raise)', 'All-in: bet everything; side pots are formed'] },
      { h: 'Helper', p: 'Shows your current hand, the (simulated) win chance and the pot odds. When the win chance is higher than the pot odds, a call usually pays.' },
    ],
  },
  jass: {
    de: [
      { h: 'Ziel', p: 'Schieber: Du spielst mit Ueli (oben) gegen Vreni und Sepp. Pro Runde gibt es 157 Punkte. Das Team, das zuerst das Ziel (z. B. 1000) erreicht, gewinnt das Spiel. Ein Sieg zahlt deinen Einsatz ×1,9.' },
      { h: 'Karten', li: ['36 Karten: 4 Farben mit je 6, 7, 8, 9, Banner (10), Under/Bauer, Ober/Dame, König und Ass. Jeder bekommt 9 Karten.', 'Deutsches Blatt: Rosen, Schilten, Eicheln, Schellen. Französisches Blatt: Herz, Schaufel, Kreuz, Ecken. Umschalten oben rechts.'] },
      { h: 'Trumpf bestimmen', li: ['Die Vorhand (gelbes V) bestimmt: eine Trumpffarbe, Obenabe oder Undenufe.', 'Oder sie schiebt: Dann muss der Partner bestimmen. Die Vorhand spielt trotzdem die erste Karte aus.', 'Die Vorhand wechselt jede Runde im Gegenuhrzeigersinn.'] },
      { h: 'Trumpf (Rangfolge und Punkte)', li: ['Bauer 20 · Nell (9) 14 · Ass 11 · König 4 · Ober 3 · Banner 10 · 8, 7, 6 je 0', 'Reihenfolge von stark nach schwach: Bauer, Nell, Ass, König, Ober, Banner, 8, 7, 6.', 'Nebenfarben: Ass 11, König 4, Ober 3, Under 2, Banner 10, 9 bis 6 je 0 (Rangfolge Ass hoch).'] },
      { h: 'Obenabe und Undenufe', li: ['Kein Trumpf. Obenabe: Ass ist die höchste Karte. Undenufe: die 6 ist die höchste, das Ass die tiefste.', 'Die Achter zählen je 8 Punkte. Obenabe: Ass 11. Undenufe: 6 zählt 11, Ass 0. So bleibt es bei 157 Punkten.'] },
      { h: 'Spielregeln', li: ['Farbe angeben: Wer die ausgespielte Farbe hat, muss sie spielen oder darf stattdessen trumpfen.', 'Wer die Farbe nicht hat, darf jede Karte spielen.', 'Untertrumpfen ist verboten: Liegt schon ein Trumpf im Stich, darfst du keinen tieferen Trumpf spielen (ausser du hast nur noch Trümpfe).', 'Der Bauer muss nie zugegeben werden: Wird Trumpf ausgespielt und du hast nur noch den Bauer als Trumpf, darfst du eine andere Karte spielen.', 'Den Stich gewinnt der höchste Trumpf, sonst die höchste Karte der ausgespielten Farbe. Wer sticht, spielt aus.'] },
      { h: 'Weis', li: ['Im ersten Stich zeigt jeder seinen Weis: Dreiblatt 20, Vierblatt 50, Fünfblatt 100 (je weitere Karte +50).', 'Vier Gleiche: vier Bauern 200, vier Nell 150, vier Asse, Könige, Ober oder Banner je 100.', 'Nur das Team mit dem höchsten Weis bekommt Punkte, dann aber für alle seine Weise. Gleich hoch: mehr Karten, dann höhere Karte, dann Trumpf, dann wer früher spielt.'] },
      { h: 'Stöck, letzter Stich, Match', li: ['Stöck: König und Ober im Trumpf in einer Hand zählen 20 Punkte.', 'Der letzte Stich gibt 5 Punkte extra.', 'Match: Ein Team macht alle 9 Stiche und bekommt 257 statt 157 Punkte.'] },
      { h: 'Mit Freunden', li: ['Raum öffnen und den Code oder Link teilen. Wer beitritt, übernimmt einen Bot-Platz: zuerst den deines Partners, dann die Gegner.', 'Jeder sieht den Tisch von seinem Platz aus und nur die eigenen Karten.', 'Der Host startet das Spiel und teilt die Runden aus. Jeder setzt seinen eigenen Einsatz und bekommt ×1,9, wenn sein Team gewinnt.', 'Verlässt jemand den Tisch, spielt ein Bot an seinem Platz weiter.'] },
      { h: 'Andere Jassarten', p: 'Differenzler: Jeder spielt allein und schätzt vorher seine Punkte; gezählt wird die Abweichung. Coiffeur: Jedes Team muss alle Spielarten (jede Trumpffarbe, Obenabe, Undenufe) einmal spielen, mit Multiplikatoren. Hier spielst du den Schieber, die beliebteste Variante.' },
    ],
    en: [
      { h: 'Goal', p: 'Schieber: you play with Ueli (top) against Vreni and Sepp. Each round is worth 157 points. The first team to reach the target (e.g. 1000) wins the match. A win pays your stake ×1.9.' },
      { h: 'Cards', li: ['36 cards: 4 suits with 6, 7, 8, 9, Banner (10), Under/Jack, Ober/Queen, King and Ace. Everyone gets 9 cards.', 'Swiss German deck: Roses, Shields, Acorns, Bells. French deck: Hearts, Spades, Clubs, Diamonds. Switch at the top right.'] },
      { h: 'Choosing trump', li: ['The forehand (yellow V) chooses: a trump suit, Obenabe (top-down) or Undenufe (bottom-up).', 'Or pushes: then the partner has to choose. The forehand still leads the first card.', 'The forehand moves on counterclockwise every round.'] },
      { h: 'Trump (order and points)', li: ['Jack (Bauer) 20 · Nine (Nell) 14 · Ace 11 · King 4 · Queen 3 · Ten 10 · 8, 7, 6 zero', 'Order from strong to weak: Jack, Nine, Ace, King, Queen, Ten, 8, 7, 6.', 'Side suits: Ace 11, King 4, Queen 3, Jack 2, Ten 10, 9 to 6 zero (ace high).'] },
      { h: 'Obenabe and Undenufe', li: ['No trump. Obenabe: the ace is highest. Undenufe: the 6 is highest, the ace lowest.', 'Eights count 8 each. Obenabe: ace 11. Undenufe: the 6 counts 11, the ace 0. That keeps the total at 157.'] },
      { h: 'Rules of play', li: ['Follow suit: if you have the suit led you must play it, or you may trump instead.', 'Without the suit you may play any card.', 'No undertrumping: if a trump is already in the trick you may not play a lower trump (unless you only have trumps left).', 'The trump Jack never has to be played: if trump is led and the Jack is your only trump, you may play another card.', 'The highest trump wins the trick, otherwise the highest card of the suit led. The winner leads next.'] },
      { h: 'Melds (Weis)', li: ['In the first trick everybody shows their meld: 3 in a row 20, 4 in a row 50, 5 in a row 100 (+50 per extra card).', 'Four of a kind: four Jacks 200, four Nines 150, four Aces, Kings, Queens or Tens 100 each.', 'Only the team with the best single meld scores, but then for all its melds. Equal: more cards, then higher card, then trump, then whoever plays first.'] },
      { h: 'Stöck, last trick, Match', li: ['Stöck: King and Queen of trump in one hand count 20 points.', 'The last trick is worth 5 extra points.', 'Match: one team takes all 9 tricks and scores 257 instead of 157.'] },
      { h: 'With friends', li: ['Open a room and share the code or link. Whoever joins takes over a bot seat: your partner first, then the opponents.', 'Everyone sees the table from their own seat and only their own cards.', 'The host starts the match and deals the rounds. Everyone sets their own stake and gets ×1.9 if their team wins.', 'If someone leaves, a bot plays on in their seat.'] },
      { h: 'Other Jass games', p: 'Differenzler: everyone plays alone and predicts their points; the difference counts. Coiffeur: every team has to play every mode (each trump suit, Obenabe, Undenufe) once, with multipliers. Here you play Schieber, the most popular variant.' },
    ],
  },
  threecard: {
    ranks: false,
    de: [
      { h: 'Ziel', p: 'Mit drei Karten die bessere Hand als der Dealer haben. Dazu kannst du auf Pair Plus setzen, das nur auf deine eigene Hand schaut.' },
      { h: 'Ablauf', li: ['Ante setzen (und optional Pair Plus), dann geben.', 'Du siehst deine drei Karten. Spielen kostet nochmals so viel wie die Ante, Passen verliert die Ante.', 'Der Dealer deckt auf. Er spielt nur mit Dame oder besser.'] },
      { h: 'Auszahlung', li: ['Dealer qualifiziert nicht: Ante 1:1, Play zurück.', 'Deine Hand besser: Ante und Play je 1:1. Schlechter: beide verloren. Gleich: beide zurück.', 'Ante Bonus, wenn du spielst (auch wenn der Dealer gewinnt): Strasse 1:1, Drilling 4:1, Straight Flush 5:1.', 'Pair Plus: Paar 1:1, Flush 4:1, Strasse 6:1, Drilling 30:1, Straight Flush 40:1.'] },
      { h: 'Hände (beste zuerst)', p: 'Straight Flush, Drilling, Strasse, Flush, Paar, höchste Karte. Achtung: Mit drei Karten ist die Strasse mehr wert als der Flush. A-2-3 ist die tiefste Strasse.' },
      { h: 'Strategie', p: 'Spiele mit Dame-6-4 oder besser, passe darunter. Der Tipp-Schalter zeigt dir das an.' },
      { h: 'Am Tisch mit anderen', p: 'Bots und Freunde spielen jeweils ihre eigene Hand gegen denselben Dealer. Im Raum wird ausgeteilt, sobald alle gesetzt haben (oder nach 12 Sekunden für alle Bereiten). Für Spielen oder Passen hat jeder 25 Sekunden, danach wird gepasst. Gesetzte Chips kannst du vor dem Austeilen zurücknehmen.' },
    ],
    en: [
      { h: 'Goal', p: 'Beat the dealer with three cards. You can also bet Pair Plus, which only looks at your own hand.' },
      { h: 'Flow', li: ['Place the ante (and optionally Pair Plus), then deal.', 'You see your three cards. Playing costs the ante again, folding loses the ante.', 'The dealer reveals. The dealer only plays with queen high or better.'] },
      { h: 'Payouts', li: ['Dealer does not qualify: ante 1:1, play returned.', 'Your hand is better: ante and play 1:1 each. Worse: both lost. Equal: both returned.', 'Ante bonus whenever you play (even if the dealer wins): straight 1:1, three of a kind 4:1, straight flush 5:1.', 'Pair Plus: pair 1:1, flush 4:1, straight 6:1, three of a kind 30:1, straight flush 40:1.'] },
      { h: 'Hands (best first)', p: 'Straight flush, three of a kind, straight, flush, pair, high card. Note: with three cards a straight beats a flush. A-2-3 is the lowest straight.' },
      { h: 'Strategy', p: 'Play with queen-6-4 or better, fold below. The hint switch shows you.' },
      { h: 'At the table with others', p: 'Bots and friends each play their own hand against the same dealer. In a room the cards come once everyone has bet (or after 12 seconds for everyone ready). Each player has 25 seconds to play or fold, then folds. You can take your chips back before the deal.' },
    ],
  },
  baccarat: {
    de: [
      { h: 'Ziel', p: 'Tippe, welche Hand näher an 9 kommt: Spieler (Punto) oder Bank (Banco). Du spielst keine Hand selbst.' },
      { h: 'Kartenwerte', p: 'Ass = 1, 2–9 = Augenwert, 10 und Bilder = 0. Gezählt wird nur die Einerstelle: 7 + 8 = 15 → 5.' },
      { h: 'Dritte Karte', li: ['8 oder 9 mit zwei Karten ist ein «Natural», dann wird nicht mehr gezogen.', 'Der Spieler zieht bei 0–5 und steht bei 6–7.', 'Die Bank zieht nach festen Regeln, abhängig von ihrem Wert und der dritten Karte des Spielers.'] },
      { h: 'Auszahlungen', li: ['Spieler 1:1 · Bank 0,95:1 (5 % Kommission) · Unentschieden 8:1', 'Spieler- oder Bank-Paar (erste zwei Karten gleich) 11:1'] },
      { h: 'Big Road', p: 'Die Anzeigetafel zeigt den Verlauf: blau = Spieler, rot = Bank. Sie hilft nicht beim Vorhersagen, jede Runde ist unabhängig.' },
    ],
    en: [
      { h: 'Goal', p: 'Bet on which hand gets closer to 9: Player (Punto) or Banker (Banco). You do not play a hand yourself.' },
      { h: 'Card values', p: 'Ace = 1, 2–9 = face value, 10 and court cards = 0. Only the last digit counts: 7 + 8 = 15 → 5.' },
      { h: 'Third card', li: ['8 or 9 with two cards is a "natural" and nobody draws.', 'The player draws on 0–5 and stands on 6–7.', 'The banker draws by fixed rules, depending on its total and the player\'s third card.'] },
      { h: 'Payouts', li: ['Player 1:1 · Banker 0.95:1 (5 % commission) · Tie 8:1', 'Player or banker pair (first two cards equal) 11:1'] },
      { h: 'Big Road', p: 'The scoreboard shows the history: blue = player, red = banker. It does not predict anything, every round is independent.' },
    ],
  },
  slots: {
    de: [
      { h: 'Ziel', p: 'Drei oder mehr gleiche Symbole auf einer Gewinnlinie, von links beginnend, zahlen ein Vielfaches des Linieneinsatzes.' },
      { h: 'Bedienung', li: ['Linieneinsatz und Anzahl Linien wählen; Gesamteinsatz = Linieneinsatz × Linien.', 'Spin (oder Leertaste); Turbo spielt schneller, Auto spielt mehrere Runden.', 'Die Gewinntabelle zeigt, was jedes Symbol zahlt.'] },
      { h: 'Armory', p: 'Die Waffen aus den Kisten als Slot. Drei Sets mit gleicher Mathematik, aber anderen Einsätzen: Field (10 bis 200 pro Spin), Arsenal (50 bis 1000) und Prototype (250 bis 5000). Die seltenste Waffe des Sets ist das Wild.' },
      { h: 'Sondersymbole', li: ['Wild ersetzt alle normalen Symbole.', 'Scatter zahlt überall auf den Walzen; drei oder mehr starten Freispiele (bei Maschinen mit Freispielen).'] },
    ],
    en: [
      { h: 'Goal', p: 'Three or more matching symbols on a pay line, starting from the left, pay a multiple of the line bet.' },
      { h: 'Controls', li: ['Choose line bet and number of lines; total bet = line bet × lines.', 'Spin (or space bar); Turbo plays faster, Auto plays several rounds.', 'The pay table shows what each symbol pays.'] },
      { h: 'Armory', p: 'The case weapons as a slot. Three sets with the same maths but different stakes: Field (10 to 200 per spin), Arsenal (50 to 1000) and Prototype (250 to 5000). The rarest weapon of the set is the wild.' },
      { h: 'Special symbols', li: ['Wild substitutes for all regular symbols.', 'Scatter pays anywhere on the reels; three or more start free spins (on machines that have them).'] },
    ],
  },
  derby: {
    de: [
      { h: 'Ziel', p: 'Sechs Pferde laufen 300 m. Wette auf den Ausgang, bevor sich die Startboxen öffnen.' },
      { h: 'Wetten', li: ['Sieg: Dein Pferd gewinnt.', 'Platz: Dein Pferd wird Erster oder Zweiter (kleinere Quote).', 'Zweierwette: Sieger und Zweiter in der richtigen Reihenfolge (grosse Quote).', 'Tippe auf eine Quote, um mit dem eingestellten Betrag zu wetten. Mehrere Wetten pro Rennen sind erlaubt, bis zum Start lassen sie sich zurücknehmen.'] },
      { h: 'Quoten', p: 'Die Quoten kommen aus Tausenden simulierten Rennen mit genau diesem Feld. Wie am Totalisator behält die Bahn 5 %: Im Schnitt fliessen 95 % der Einsätze zurück.' },
      { h: 'Das Feld', li: ['Form: wie stark das Pferd grundsätzlich ist.', 'Frontläufer gehen schnell weg und werden hinten müde, Steher kommen am Schluss.', 'Dazu kommt die Tagesform: Auch ein Aussenseiter kann gewinnen.'] },
      { h: 'Mehrspieler', p: 'Raum öffnen und den Code teilen: Alle sehen dasselbe Rennen und wetten mit ihrem eigenen Guthaben. Bots wetten mit, wenn sie eingeschaltet sind.' },
    ],
    en: [
      { h: 'Goal', p: 'Six horses run 300 m. Bet on the outcome before the stalls open.' },
      { h: 'Bets', li: ['Win: your horse wins.', 'Place: your horse finishes first or second (shorter price).', 'Exacta: winner and runner-up in the right order (big price).', 'Tap a price to bet the amount set below. Several bets per race are fine and can be taken back until the start.'] },
      { h: 'Odds', p: 'The prices come from thousands of simulated races with exactly this field. Like a tote the track keeps 5 %: on average 95 % of the stakes come back.' },
      { h: 'The field', li: ['Form: how strong a horse is in general.', 'Front-runners go fast early and tire, closers come late.', 'On top there is the form of the day: an outsider can win too.'] },
      { h: 'Multiplayer', p: 'Open a room and share the code: everyone watches the same race and bets with their own balance. Bots bet along when they are switched on.' },
    ],
  },
  balloon: {
    de: [
      { h: 'Ziel', p: 'Pump den Ballon auf und zahl aus, bevor er platzt. Jeder Pumpstoss erhöht den Multiplikator.' },
      { h: 'Ablauf', li: ['Einsatz und Risiko wählen, dann «Spielen und pumpen» (oder Leertaste).', 'Jeder weitere Stoss kann den Ballon platzen lassen: Dann ist der Einsatz weg.', '«Auszahlen» (oder Enter) zahlt Einsatz × Multiplikator aus.', 'Ist der Ballon voll, steigt er von allein auf und zahlt den Höchstwert aus.'] },
      { h: 'Risiko', li: ['Tief: 4 % Platz-Chance pro Stoss, bis 40 Stösse (bis ×5).', 'Mittel: 10 %, bis 30 Stösse (bis ×23).', 'Hoch: 20 %, bis 20 Stösse (bis ×84).'] },
      { h: 'Fair', p: 'Der Multiplikator ist so gerechnet, dass jeder Ausstiegspunkt im Schnitt 97 % des Einsatzes zurückgibt. Wann du aussteigst, ist reine Geschmackssache.' },
    ],
    en: [
      { h: 'Goal', p: 'Pump up the balloon and cash out before it pops. Every pump raises the multiplier.' },
      { h: 'Flow', li: ['Choose stake and risk, then "Play and pump" (or space).', 'Every further pump may pop the balloon: the stake is lost.', '"Cash out" (or Enter) pays stake × multiplier.', 'A full balloon lifts off on its own and pays the top value.'] },
      { h: 'Risk', li: ['Low: 4 % pop chance per pump, up to 40 pumps (up to ×5).', 'Medium: 10 %, up to 30 pumps (up to ×23).', 'High: 20 %, up to 20 pumps (up to ×84).'] },
      { h: 'Fair', p: 'The multiplier is set so that every cash-out point returns 97 % of the stake on average. When you stop is purely a matter of taste.' },
    ],
  },
  rocket: {
    de: [
      { h: 'Ziel', p: 'Die Rakete steigt und der Multiplikator wächst, bis sie explodiert. Steig vorher aus, um Einsatz × Multiplikator zu bekommen.' },
      { h: 'Ablauf', li: ['Während des Countdowns setzen. Verpasst? Dein Einsatz wird für die nächste Runde vorgemerkt.', 'Nach dem Start jederzeit «Auszahlen» drücken (oder Leertaste).', 'Auto-Auszahlung steigt automatisch bei deinem Wunsch-Multiplikator aus.', 'Explodiert die Rakete vorher, ist der Einsatz verloren.'] },
      { h: 'Mehrspieler', p: 'Alle im Raum fliegen dieselbe Rakete. Bots und Mitspieler stehen in der Liste mit ihrem Ausstieg.' },
    ],
    en: [
      { h: 'Goal', p: 'The rocket climbs and the multiplier grows until it explodes. Cash out before that to get bet × multiplier.' },
      { h: 'Flow', li: ['Bet during the countdown. Missed it? Your bet is queued for the next round.', 'After launch press "Cash out" (or space) any time.', 'Auto cash-out leaves automatically at your target multiplier.', 'If the rocket explodes first, the bet is lost.'] },
      { h: 'Multiplayer', p: 'Everyone in the room flies the same rocket. Bots and players are listed with their cash-out.' },
    ],
  },
  cases: {
    de: [
      { h: 'Ziel', p: 'Öffne eine Kiste: Die Walze rollt und bleibt auf einem Item stehen. Sein Wert wird dir gutgeschrieben.' },
      { h: 'Classic', p: 'Drei Kisten: Field (100), Arsenal (250) und Prototype (750), jede mit eigenen Items und Werten. Alle mit den offiziellen Drop-Raten: Mil-Spec 79,92 %, Restricted 15,98 %, Classified 3,20 %, Covert 0,64 %, Gold 0,26 %. Wie beim Original verlierst du im Schnitt deutlich mehr, als du bekommst; seltene Items sind wirklich selten.' },
      { h: 'Arcade', p: 'Drei Kisten mit Auszahlungsquote 97 %: Starter, Neon und Royal, jeweils mit eigenen Items.' },
      { h: 'Tipps', li: ['Leertaste öffnet die nächste Kiste.', '«Schnell öffnen» verkürzt die Animation.', 'Unter «Inhalt» siehst du Wert und Chance jedes Items.'] },
    ],
    en: [
      { h: 'Goal', p: 'Open a case: the reel spins and stops on one item. Its value is credited to you.' },
      { h: 'Classic', p: 'Three cases: Field (100), Arsenal (250) and Prototype (750), each with its own items and values. All use the official drop rates: Mil-Spec 79.92 %, Restricted 15.98 %, Classified 3.20 %, Covert 0.64 %, Gold 0.26 %. Like the original you lose a lot more than you get on average; rare items really are rare.' },
      { h: 'Arcade', p: 'Three cases with a 97 % return: Starter, Neon and Royal, each with its own items.' },
      { h: 'Tips', li: ['Space opens the next case.', '"Quick open" shortens the animation.', '"Contents" lists the value and chance of every item.'] },
    ],
  },
  mines: {
    de: [
      { h: 'Ziel', p: 'Unter 25 Feldern liegen Minen. Jedes sichere Feld erhöht deinen Multiplikator; steig aus, bevor du eine Mine triffst.' },
      { h: 'Ablauf', li: ['Einsatz und Anzahl Minen wählen (mehr Minen = höhere Multiplikatoren).', 'Starten, dann Felder aufdecken. «Zufall» deckt ein beliebiges Feld auf.', '«Auszahlen» sichert den aktuellen Gewinn. Eine Mine beendet die Runde ohne Gewinn.'] },
    ],
    en: [
      { h: 'Goal', p: 'Mines hide under 25 tiles. Every safe tile raises your multiplier; cash out before you hit a mine.' },
      { h: 'Flow', li: ['Choose your bet and the number of mines (more mines = higher multipliers).', 'Start, then reveal tiles. "Random" reveals any tile.', '"Cash out" locks in the current win. A mine ends the round with nothing.'] },
    ],
  },
  minesweeper: {
    de: [
      { h: 'Ziel', p: 'Decke alle Felder ohne Mine auf. Zahlen zeigen, wie viele Minen um ein Feld liegen (acht Nachbarn, im Sechseck-Raster sechs).' },
      { h: 'Steuerung', li: ['Computer: Klick deckt auf, Rechtsklick setzt eine Fahne, Klick auf eine Zahl mit passenden Fahnen deckt die Nachbarn auf.', 'Handy: Tippen deckt auf, lange drücken setzt eine Fahne; oder den Fahnen-Modus einschalten.', 'Der erste Klick ist immer sicher.'] },
      { h: 'Classic', p: 'Das Original: Leicht, Mittel, Schwer oder eine eigene Grösse mit eigener Minenzahl. Keine Hilfen, ein Fehler und es ist vorbei.' },
      { h: 'Arcade', li: ['3 Leben: Eine Mine kostet ein Leben und wird automatisch markiert.', 'Schild: verzeiht die nächste Mine. Scanner: deckt einen 3×3-Bereich sicher auf. Detektor: markiert eine Mine. Alle 40 aufgedeckten Felder gibt es ein neues Item.', 'Doppel-Minen zählen in den Zahlen doppelt. Die Fahne wechselt dann zwischen einfach und doppelt.', 'Wandernde Minen springen alle paar Züge an eine versteckte Stelle, die Zahlen ändern sich.', 'Zeitbomben werden aktiv, sobald eine Zahl daneben sichtbar ist: Flagge sie innerhalb von 12 Zügen, sonst explodieren sie.', 'Sechseck-Raster: jedes Feld hat nur sechs Nachbarn.', 'Kampagne: 12 Level mit Boss-Ebenen (♛). Level 2, 4 und 8 schalten zusätzliche Start-Items frei.'] },
      { h: 'Co-op', li: ['Koop: gemeinsames Feld, gemeinsame Flaggen und drei gemeinsame Leben. «Bereiche aufteilen» gibt jedem eine Hälfte.', 'Minenjagd: abwechselnd ziehen, aber hier sucht ihr Minen. Wer eine findet, bekommt einen Punkt und darf nochmal. Wer mehr als die Hälfte hat, gewinnt.', 'Raum öffnen und den Code teilen; ohne Mitspieler spielt ein Bot mit.'] },
      { h: 'Komfort (nur Arcade und Co-op)', li: ['Ohne Raten: Das Feld ist immer rein logisch lösbar.', 'Smart-Flagging: Ist eine Zahl erfüllt, werden die übrigen Nachbarn automatisch aufgedeckt (und erzwungene Minen markiert).', 'Replay: Nach der Runde im Schnelldurchlauf ansehen. Bei einem Fehler zeigt die Analyse, ob es einen sicheren Zug gegeben hätte (grün).'] },
      { h: 'Einsatz', p: 'Optional. Gewinnst du, bekommst du je nach Schwierigkeit und Modifiern ein Vielfaches zurück. Ohne Einsatz gibt es keine Credits.' },
    ],
    en: [
      { h: 'Goal', p: 'Reveal every tile without a mine. Numbers show how many mines touch a tile (eight neighbours, six on the hex grid).' },
      { h: 'Controls', li: ['Desktop: click reveals, right-click flags, clicking a number with enough flags around it opens its neighbours.', 'Phone: tap reveals, long-press flags; or switch on flag mode.', 'The first click is always safe.'] },
      { h: 'Classic', p: 'The original: easy, medium, hard or a custom size and mine count. No help, one mistake and it is over.' },
      { h: 'Arcade', li: ['3 lives: a mine costs a life and gets flagged automatically.', 'Shield: forgives the next mine. Scanner: safely reveals a 3×3 area. Detector: marks a mine. Every 40 revealed tiles earn a new item.', 'Double mines count twice in the numbers. Flags then cycle between single and double.', 'Moving mines jump to a hidden spot every few moves, and the numbers change.', 'Time bombs arm once a number next to them is visible: flag them within 12 moves or they go off.', 'Hex grid: every tile has only six neighbours.', 'Campaign: 12 levels with boss stages (♛). Levels 2, 4 and 8 unlock extra starting items.'] },
      { h: 'Co-op', li: ['Co-op: shared board, shared flags and three shared lives. "Split the board" gives each player one half.', 'Mine hunt: take turns, but here you look for mines. Find one, score a point and go again. More than half wins.', 'Open a room and share the code; without a partner a bot joins.'] },
      { h: 'Comfort (arcade and co-op only)', li: ['No-guess: the board can always be solved by logic.', 'Smart flagging: once a number is satisfied its other neighbours open automatically (and forced mines get flagged).', 'Replay: watch the round in fast forward. After a mistake the analysis shows whether there was a safe move (green).'] },
      { h: 'Stake', p: 'Optional. Win and you get a multiple back depending on difficulty and modifiers. Without a stake there are no credits.' },
    ],
  },
  dice: {
    de: [
      { h: 'Ziel', p: 'Ein, zwei oder drei Würfel werden geworfen. Tippe auf das Ergebnis, bevor sie fallen.' },
      { h: 'Würfel', li: ['W6, W8 oder W10: sechs, acht oder zehn Seiten.', 'Minenwürfel (💣): W6 mit 1 bis 5 Bombenseiten. Landet ein Würfel auf einer Bombe, explodiert er und der Einsatz ist weg.'] },
      { h: 'Wetten', li: ['Tief oder Hoch: die Summe liegt unter oder über der Mitte', 'Genau die Mitte (wenn sie eine ganze Zahl ist, z. B. 7 bei 2 × W6)', 'Pasch oder Drilling: alle Würfel gleich', 'Eine bestimmte Summe'] },
      { h: 'Auszahlung', p: 'Je unwahrscheinlicher die Wette, desto höher der Multiplikator. Chance und Multiplikator stehen neben dem Knopf.' },
    ],
    en: [
      { h: 'Goal', p: 'One, two or three dice are thrown. Call the result before they land.' },
      { h: 'Dice', li: ['D6, D8 or D10: six, eight or ten faces.', 'Mine dice (💣): D6 with 1 to 5 bomb faces. If a die lands on a bomb it explodes and the stake is lost.'] },
      { h: 'Bets', li: ['Low or high: the sum is below or above the middle', 'Exactly the middle (when it is a whole number, e.g. 7 with 2 × D6)', 'Doubles or triples: all dice equal', 'A specific sum'] },
      { h: 'Payout', p: 'The less likely the bet, the higher the multiplier. Chance and multiplier are shown next to the button.' },
    ],
  },
  words: {
    de: [
      { h: 'Ziel', p: 'Errate das Wort mit 5 Buchstaben. Nach jedem Versuch zeigen die Felder, wie nah du bist.' },
      { h: 'Farben', li: ['Grün: Der Buchstabe steht an der richtigen Stelle.', 'Gold: Der Buchstabe kommt vor, aber an einer anderen Stelle.', 'Grau: Der Buchstabe kommt nicht (mehr) vor. Doppelte Buchstaben zählen nur so oft, wie sie im Wort stehen.', 'Nur echte Wörter zählen; Ä, Ö und Ü sind eigene Buchstaben.'] },
      { h: 'Tageswort', p: 'Jeden Tag ein neues Wort, für alle gleich, auf Deutsch und auf Englisch. Wer es löst, bekommt Coins: in 1 Versuch 250, in 2 Versuchen 150, dann 100, 60, 40 und 25. Mit «Teilen» kopierst du dein Ergebnis ohne Lösung.' },
      { h: 'Arcade', li: ['Löse 1, 2, 4 oder 8 Wörter gleichzeitig: Jeder Versuch gilt für alle Felder. Dafür gibt es 6, 7, 9 oder 13 Versuche.', 'Die Tasten zeigen pro Feld einen eigenen Streifen.', 'Mit Einsatz zahlt das Lösen aller Wörter: je mehr Wörter, desto mehr, und jeder übrige Versuch ×1.35 dazu.'] },
      { h: 'Schwer', p: 'Im schweren Modus musst du jeden gefundenen Hinweis weiterverwenden: Grüne Buchstaben bleiben an ihrer Stelle, goldene müssen wieder vorkommen.' },
    ],
    en: [
      { h: 'Goal', p: 'Guess the 5-letter word. After every guess the tiles show how close you are.' },
      { h: 'Colours', li: ['Green: the letter is in the right spot.', 'Gold: the letter is in the word, but in another spot.', 'Grey: the letter is not (or no more) in the word. Repeated letters count only as often as the word has them.', 'Only real words count.'] },
      { h: 'Daily word', p: 'A new word every day, the same for everyone, in German and in English. Solving it pays coins: 250 in 1 guess, 150 in 2, then 100, 60, 40 and 25. "Share" copies your result without the answer.' },
      { h: 'Arcade', li: ['Solve 1, 2, 4 or 8 words at once: every guess counts on all boards. You get 6, 7, 9 or 13 guesses.', 'The keys show one stripe per board.', 'With a stake, solving all words pays: more words pay more, and every guess left over ×1.35 on top.'] },
      { h: 'Hard', p: 'In hard mode every hint you found must be used again: green letters stay in place, gold ones must appear again.' },
    ],
  },
  memory: {
    de: [
      { h: 'Ziel', p: 'Decke pro Zug zwei Karten auf. Zeigen sie dasselbe Bild, gehört dir das Paar; sonst werden sie wieder umgedreht. Merk dir, wo was liegt.' },
      { h: 'Einstellungen', li: ['Motive: Slot-Symbole, Spielkarten, Jass-Karten oder Arcade-Figuren.', 'Grösse: 12, 16, 24 oder 36 Karten.', 'Leicht: Am Anfang liegen alle Karten kurz offen. Schwer: Nach jedem zweiten Fehlgriff tauschen zwei verdeckte Karten sichtbar den Platz.'] },
      { h: 'Solo', p: 'Räume das Brett in möglichst wenigen Zügen ab. Mit Einsatz zahlt das Verhältnis Züge pro Paar: unter 1.3 am meisten, ab etwa 2.6 nichts mehr. Grössere Bretter und Schwer zahlen mehr, Leicht weniger.' },
      { h: 'Duell', li: ['Abwechselnd gegen Bots, Leute am selben Gerät oder Freunde im Raum. Wer ein Paar findet, ist nochmal dran.', 'Jeder legt seinen eigenen Einsatz in den Topf, alle sehen ihn. Wer die meisten Paare hat, gewinnt.', 'Wie bei Poker-Side-Pots kann man von jedem nur so viel gewinnen, wie man selbst gesetzt hat. Wer wenig setzt, riskiert wenig, gewinnt aber auch wenig.'] },
    ],
    en: [
      { h: 'Goal', p: 'Turn two cards per turn. If they show the same picture the pair is yours; otherwise they turn back. Remember where everything is.' },
      { h: 'Settings', li: ['Pictures: slot symbols, playing cards, Jass cards or arcade characters.', 'Size: 12, 16, 24 or 36 cards.', 'Easy: all cards are shown briefly at the start. Hard: after every second miss two hidden cards visibly swap places.'] },
      { h: 'Solo', p: 'Clear the board in as few turns as possible. With a stake, turns per pair decide: under 1.3 pays most, from about 2.6 nothing. Bigger boards and hard pay more, easy less.' },
      { h: 'Duel', li: ['Take turns against bots, people at the same device or friends in a room. Find a pair and you go again.', 'Everyone puts their own stake in the pot, visible to all. Most pairs wins.', 'Like poker side pots you can win from each player only as much as you staked yourself. Bet small, risk little, win little.'] },
    ],
  },
  ships: {
    de: [
      { h: 'Ziel', p: 'Jeder versteckt eine Flotte auf einem 10 × 10-Meer: Schiffe mit 5, 4, 3, 3 und 2 Feldern. Wer alle gegnerischen Schiffe versenkt, gewinnt.' },
      { h: 'Flotte setzen', li: ['Schiff links wählen, über das Meer fahren und klicken. R oder der Knopf dreht es.', 'Schiffe dürfen sich nicht berühren, auch nicht an den Ecken.', 'Ein Klick auf ein gesetztes Schiff nimmt es wieder auf; «Zufällig» setzt alles auf einmal.', 'Nach 90 Sekunden wird der Rest zufällig gesetzt.'] },
      { h: 'Schiessen', li: ['Wer dran ist, klickt ein Feld auf einem gegnerischen Meer: Wasser, Treffer oder versenkt.', 'Ein Treffer heisst: nochmal schiessen (abschaltbar).', 'Ein versenktes Schiff zeigt seinen Rumpf, und das Wasser rundherum wird aufgedeckt.', 'Pro Schuss gibt es 30 Sekunden, dann fällt ein zufälliger Schuss.'] },
      { h: 'Modi', li: ['1 gegen 1: gegen einen Bot oder einen Freund.', '2 gegen 2: Partner sehen die Flotte des anderen; ein Team verliert, wenn beide Flotten am Grund liegen.', 'Jeder gegen jeden mit 3 oder 4: Du wählst selbst, wen du beschiesst. Wer zuletzt schwimmt, gewinnt.', 'Freie Plätze übernehmen Bots (Leicht, Mittel oder Schwer).'] },
      { h: 'Einsatz', p: 'Jeder legt seinen eigenen Einsatz in den Topf, alle sehen ihn. Wie bei Poker-Side-Pots kann man von jedem nur so viel gewinnen, wie man selbst gesetzt hat. Im Team teilen sich die Sieger den Gewinn.' },
    ],
    en: [
      { h: 'Goal', p: 'Everyone hides a fleet in a 10 × 10 sea: ships of 5, 4, 3, 3 and 2 cells. Sink all enemy ships to win.' },
      { h: 'Placing', li: ['Pick a ship on the left, move over the sea and click. R or the button turns it.', 'Ships may not touch, not even at the corners.', 'Click a placed ship to pick it up; "Random" places everything at once.', 'After 90 seconds the rest is placed at random.'] },
      { h: 'Shooting', li: ['On your turn click a cell on an enemy sea: splash, hit or sunk.', 'A hit means you shoot again (can be switched off).', 'A sunk ship shows its hull, and the water around it is revealed.', 'Each shot has 30 seconds, then a random shot is fired.'] },
      { h: 'Modes', li: ['1 vs 1: against a bot or a friend.', '2 vs 2: partners see each other\'s fleet; a team loses when both fleets are at the bottom.', 'Free for all with 3 or 4: you choose whom to shoot at. The last one afloat wins.', 'Bots take free seats (easy, medium or hard).'] },
      { h: 'Stakes', p: 'Everyone puts their own stake in the pot, visible to all. Like poker side pots you can win from each player only as much as you staked yourself. Team winners share.' },
    ],
  },
  cups: {
    de: [
      { h: 'Ziel', p: 'Am Anfang siehst du, unter welchem Becher die goldene Kugel liegt. Dann werden die Becher gemischt. Wähle danach den Becher mit der Kugel.' },
      { h: 'Mischen', li: ['Die Becher kreuzen sich immer paarweise. Wo sich zwei treffen, stehen sie genau übereinander: Ob sie getauscht haben oder zurückgehen, kann niemand sehen.', 'Darum ist es fair für alle: Die Chance ist immer genau 1 zu 3 (bzw. 1 zu 4 oder 1 zu 5).', 'Das Tempo ändert nur, wie schnell gemischt wird, nicht die Chance.'] },
      { h: 'Auszahlung', li: ['3 Becher: ×2.91', '4 Becher: ×3.88', '5 Becher: ×4.85'] },
      { h: 'Tasten', p: 'Leertaste mischt, die Zahlentasten 1–5 wählen einen Becher von links.' },
    ],
    en: [
      { h: 'Goal', p: 'At the start you see which cup hides the golden ball. Then the cups are shuffled. Afterwards pick the cup with the ball.' },
      { h: 'Shuffle', li: ['The cups always cross in pairs. Where two meet they stand exactly on top of each other: nobody can see whether they swapped or went back.', 'That keeps it fair for everyone: the chance is always exactly 1 in 3 (or 1 in 4, 1 in 5).', 'The speed only changes how fast they shuffle, not the chance.'] },
      { h: 'Payout', li: ['3 cups: ×2.91', '4 cups: ×3.88', '5 cups: ×4.85'] },
      { h: 'Keys', p: 'Space shuffles, number keys 1–5 pick a cup from the left.' },
    ],
  },
  g2048: {
    de: [
      { h: 'Ziel', p: 'Schiebe alle Kacheln in eine Richtung. Zwei gleiche Zahlen, die aufeinandertreffen, verschmelzen zu ihrer Summe. Nach jedem Zug erscheint eine neue 2 oder 4. Schaffst du die 2048?' },
      { h: 'Steuerung', li: ['Pfeiltasten oder WASD, auf dem Handy wischen.', 'Jede Kachel verschmilzt pro Zug höchstens einmal.', 'Geht kein Zug mehr, ist das Spiel vorbei.'] },
      { h: 'Mit Einsatz', li: ['Die grösste Kachel bestimmt den Multiplikator: 128 ×1.1 · 256 ×1.4 · 512 ×2 · 1024 ×4 · 2048 ×10 · 4096 ×25 · 8192 ×60.', 'Ab 128 kannst du jederzeit auszahlen.', 'Ist das Brett voll, bevor du auszahlst, ist der Einsatz weg.'] },
    ],
    en: [
      { h: 'Goal', p: 'Slide all tiles in one direction. Two equal numbers that meet merge into their sum. After every move a new 2 or 4 appears. Can you reach 2048?' },
      { h: 'Controls', li: ['Arrow keys or WASD, swipe on a phone.', 'Each tile merges at most once per move.', 'When no move is left, the game is over.'] },
      { h: 'With a stake', li: ['The biggest tile sets the multiplier: 128 ×1.1 · 256 ×1.4 · 512 ×2 · 1024 ×4 · 2048 ×10 · 4096 ×25 · 8192 ×60.', 'From 128 on you can cash out any time.', 'If the board fills up before you cash out, the stake is lost.'] },
    ],
  },
  tetris: {
    de: [
      { h: 'Ziel', p: 'Steine fallen in den Schacht. Schiebe und drehe sie so, dass volle Reihen entstehen: Die verschwinden und bringen Punkte und Coins. Reicht der Stapel bis oben, ist das Spiel vorbei.' },
      { h: 'Steuerung', li: ['← → schieben, ↑ oder X drehen, Z andersrum drehen.', '↓ lässt schneller fallen, Leertaste lässt sofort fallen.', 'C oder Shift legt den Stein zur Seite (Hold) und holt ihn später wieder.', 'Auf dem Handy die Knöpfe unter dem Spielfeld.'] },
      { h: 'Klassisch', li: ['Alle 10 Linien steigt das Level und alles wird schneller.', 'Coins pro Durchgang: 1 Linie 1 · 2 Linien 3 · 3 Linien 6 · 4 Linien 12, jeweils mal Level (bis 15).', 'Die Coins werden am Ende des Spiels gutgeschrieben.'] },
      { h: 'Versus', li: ['Alle spielen gleichzeitig mit denselben Steinen, nebeneinander.', 'Wer 2 Linien auf einmal löscht, schickt 1 Müll-Zeile zu einem Gegner, 3 Linien schicken 2, 4 Linien schicken 4. Serien geben extra.', 'Müll steigt beim nächsten Stein von unten auf; eigene Linien heben ihn vorher auf (roter Balken links).', 'Wer als Letzter übrig bleibt, gewinnt 50 Coins pro Gegner, dazu die Coins für die Linien.', 'Gegen Bots (Leicht, Mittel, Schwer) oder mit Freunden: Raum öffnen und Code teilen.'] },
    ],
    en: [
      { h: 'Goal', p: 'Blocks fall into the well. Move and rotate them to fill rows: full rows vanish and bring points and coins. If the stack reaches the top, the game is over.' },
      { h: 'Controls', li: ['← → move, ↑ or X rotate, Z rotate the other way.', '↓ soft drop, Space hard drop.', 'C or Shift puts the piece aside (hold) to use it later.', 'On a phone use the buttons below the well.'] },
      { h: 'Classic', li: ['Every 10 lines the level goes up and everything gets faster.', 'Coins per clear: 1 line 1 · 2 lines 3 · 3 lines 6 · 4 lines 12, each times the level (up to 15).', 'The coins are paid at the end of the game.'] },
      { h: 'Versus', li: ['Everybody plays at the same time with the same pieces, side by side.', 'Clearing 2 lines at once sends 1 garbage row to an opponent, 3 lines send 2, 4 lines send 4. Combos add more.', 'Garbage rises from below with your next piece; your own clears cancel it first (red bar on the left).', 'The last one standing wins 50 coins per opponent, plus the coins for lines.', 'Against bots (easy, medium, hard) or with friends: open a room and share the code.'] },
    ],
  },
  keno: {
    de: [
      { h: 'Ziel', p: 'Wähle 1 bis 10 der Zahlen 1–40. Danach werden 10 Zahlen gezogen; jede gezogene Zahl auf deinem Tipp ist ein Treffer.' },
      { h: 'Auszahlung', li: ['Unter dem Feld steht für jede Trefferzahl der Multiplikator und die Chance.', 'Mehr gewählte Zahlen brauchen mehr Treffer, zahlen dafür ganz oben deutlich mehr.', 'Risiko Tief zahlt oft kleine Beträge, Hoch selten, dann aber sehr hohe.'] },
      { h: 'Tipps', li: ['«Zufall» füllt den Tipp (mit so vielen Zahlen wie gewählt, sonst 10).', 'Nach einer Ziehung bleibt der Tipp stehen: Leertaste spielt ihn nochmal.'] },
    ],
    en: [
      { h: 'Goal', p: 'Pick 1 to 10 of the numbers 1–40. Then 10 numbers are drawn; every drawn number on your ticket is a hit.' },
      { h: 'Payout', li: ['Below the board you see the multiplier and the chance for each number of hits.', 'More picked numbers need more hits but pay much more at the top.', 'Low risk pays small amounts often, high rarely but a lot.'] },
      { h: 'Tips', li: ['"Quick pick" fills the ticket (as many numbers as picked, otherwise 10).', 'After a draw the ticket stays: space plays it again.'] },
    ],
  },
  lotto: {
    de: [
      { h: 'Ziel', p: 'Kreuze auf einem Schein 6 der Zahlen 1–42 und eine Glückszahl 1–6 an. Gezogen werden 6 Zahlen und eine Glückszahl.' },
      { h: 'Tageslotto', li: ['Ein Gratis-Schein pro Tag. Abgeben bis 20:00 (Zürcher Zeit), dann wird gezogen.', 'Du musst bei der Ziehung nicht online sein: Den Gewinn bekommst du beim nächsten Besuch.', 'Feste Gewinne von 15 (2 + ★) bis 1 000 000 (6 + ★).', 'Rechts: wer heute im Topf ist, die letzten Ziehungen und wer gewonnen hat.'] },
      { h: 'Runde', li: ['Bis zu 6 Scheine, der Einsatz gilt pro Schein. «Leere ausfüllen» füllt offene Scheine zufällig.', '«Abgeben» bezahlt, «Zurücknehmen» gibt den Einsatz vor der Ziehung zurück, «Alle löschen» räumt alle Scheine weg.', 'Wer den Tisch eröffnet hat, startet die Ziehung. Unter der Trommel stehen die letzten Ziehungen.'] },
      { h: 'Gewinnränge', li: ['6 Richtige + Glückszahl: Jackpot', '6, 5 + ★, 5, 4 + ★, 4, 3 + ★, 3 Richtige', '2 Richtige + Glückszahl'] },
      { h: 'Mehrspieler', p: 'Eröffne im Reiter «Runde» einen Raum und teile den Code. Alle sehen dieselbe Ziehung; rechts steht bei jedem, welche Zahlen getroffen haben und was gewonnen wurde. Bots spielen mit, wenn sie eingeschaltet sind.' },
    ],
    en: [
      { h: 'Goal', p: 'On a ticket mark 6 of the numbers 1–42 and a lucky number 1–6. The draw is 6 numbers and one lucky number.' },
      { h: 'Daily draw', li: ['One free ticket a day. Hand it in before 20:00 (Zurich time), then the draw happens.', 'You do not need to be online for the draw: you get the prize on your next visit.', 'Fixed prizes from 15 (2 + ★) to 1,000,000 (6 + ★).', 'On the right: who is in today, the last draws and who won.'] },
      { h: 'Round', li: ['Up to 6 tickets, the stake is per ticket. "Fill empty" fills open tickets at random.', '"Hand in" pays, "Take back" refunds before the draw, "Clear all" removes every ticket.', 'Whoever opened the table starts the draw. The last draws are listed below the drum.'] },
      { h: 'Prize ranks', li: ['6 right + lucky number: jackpot', '6, 5 + ★, 5, 4 + ★, 4, 3 + ★, 3 right', '2 right + lucky number'] },
      { h: 'Multiplayer', p: 'Open a room in the "Round" tab and share the code. Everyone sees the same draw; on the right you see for each player which numbers hit and what they won. Bots join in when switched on.' },
    ],
  },
  hop: {
    de: [
      { h: 'Ziel', p: 'Bring das Huhn über die Strasse. Jede überquerte Spur erhöht den Multiplikator.' },
      { h: 'Ablauf', li: ['Einsatz und Schwierigkeit wählen, dann «Losgehen».', '«Weiter» springt eine Spur weiter. Manchmal kommt dabei ein Auto: Glück gehabt, es bremst vor der Barriere, oder Pech.', '«Auszahlen» sichert den Gewinn. Wirst du überfahren, ist der Einsatz weg.'] },
    ],
    en: [
      { h: 'Goal', p: 'Get the chicken across the road. Every lane crossed raises the multiplier.' },
      { h: 'Flow', li: ['Choose bet and difficulty, then "Start".', '"Next lane" jumps one lane. Sometimes a car comes: lucky, it brakes at the barrier, or unlucky.', '"Cash out" locks in the win. Get run over and the bet is gone.'] },
    ],
  },
  tower: {
    de: [
      { h: 'Ziel', p: 'Klettere den Turm hoch. Auf jeder Etage ist mindestens ein Feld eine Falle.' },
      { h: 'Ablauf', li: ['Einsatz und Schwierigkeit wählen (mehr Fallen = höhere Multiplikatoren).', 'Pro Etage ein Feld wählen. Sicher? Eine Etage höher.', 'Jederzeit auszahlen; die Falle beendet die Runde ohne Gewinn.'] },
      { h: 'Modus Aufstieg', p: '12 Etagen statt 8, und der Turm wird unterwegs schwerer: je drei Etagen Leicht (4 Felder, 1 Falle), Mittel (3/1), Schwer (2/1) und Experte (3 Felder, 2 Fallen). Wer die Krone ganz oben erreicht, gewinnt über ×1600.' },
    ],
    en: [
      { h: 'Goal', p: 'Climb the tower. Every floor has at least one trap tile.' },
      { h: 'Flow', li: ['Choose bet and difficulty (more traps = higher multipliers).', 'Pick one tile per floor. Safe? Up one floor.', 'Cash out any time; a trap ends the round with nothing.'] },
      { h: 'Climb mode', p: '12 floors instead of 8, and the tower gets harder on the way: three floors each of easy (4 tiles, 1 trap), medium (3/1), hard (2/1) and expert (3 tiles, 2 traps). Reach the crown at the top and win over ×1600.' },
    ],
  },
  hilo: {
    de: [
      { h: 'Ziel', p: 'Errate, ob die nächste Karte höher oder tiefer ist. Jeder Treffer multipliziert deinen Gewinn.' },
      { h: 'Ablauf', li: ['Einsatz wählen und starten. Die erste Karte liegt offen.', '«Höher» oder «Tiefer»: Der Multiplikator hängt von der Wahrscheinlichkeit ab (auf eine 2 «höher» zahlt wenig).', '«Überspringen» legt eine neue Karte ohne Risiko.', 'Ein Fehler beendet die Runde; auszahlen kannst du jederzeit.'] },
    ],
    en: [
      { h: 'Goal', p: 'Guess whether the next card is higher or lower. Every hit multiplies your win.' },
      { h: 'Flow', li: ['Choose a bet and start. The first card is face up.', '"Higher" or "Lower": the multiplier depends on the odds ("higher" on a 2 pays little).', '"Skip" deals a new card without risk.', 'A miss ends the round; you can cash out any time.'] },
    ],
  },
  plinko: {
    de: [
      { h: 'Ziel', p: 'Die Kugel fällt durch die Stifte und landet in einem Fach. Das Fach bestimmt den Multiplikator.' },
      { h: 'Einstellungen', li: ['Reihen: mehr Reihen = mehr Fächer und extremere Ränder.', 'Risiko: höher = in der Mitte weniger, am Rand viel mehr.', 'Kugeln: bis zu 20 auf einmal, jede kostet den Einsatz.'] },
      { h: 'Wahrscheinlichkeit', p: 'Die meisten Kugeln landen in der Mitte, wo der Multiplikator unter 1 liegt. Die Ränder treffen selten, zahlen dafür gross.' },
    ],
    en: [
      { h: 'Goal', p: 'The ball drops through the pegs into a bucket. The bucket sets the multiplier.' },
      { h: 'Settings', li: ['Rows: more rows = more buckets and more extreme edges.', 'Risk: higher = less in the middle, much more at the edges.', 'Balls: up to 20 at once, each costs the bet.'] },
      { h: 'Odds', p: 'Most balls land in the middle, where the multiplier is below 1. The edges are hit rarely but pay big.' },
    ],
  },
  snake: {
    de: [
      { h: 'Ziel', p: 'Friss Äpfel, wachse und crashe nicht: Rand (ausser mit Durchgang), Mauern und der eigene Körper sind tödlich. Jeder Punkt erhöht den Multiplikator.' },
      { h: 'Steuerung', li: ['Pfeiltasten oder WASD (Handy: wischen oder die Pfeile tippen).', 'Leertaste startet, Enter zahlt aus.'] },
      { h: 'Äpfel', li: ['Roter Apfel: 1 Punkt', 'Goldener Apfel: 3 Punkte, verschwindet nach kurzer Zeit', 'Kosmischer Apfel: 10 Punkte, sehr selten und schnell weg'] },
      { h: 'Modifier', li: ['Spielfeld klein/mittel/gross, Tempo normal/schnell/turbo', 'Mauern: nach jedem dritten Apfel wächst ein Block', 'Portale: rein in das eine, raus beim anderen', 'Durchgang: kein tödlicher Rand, du kommst gegenüber wieder raus (×0.8)', 'Giftäpfel (lila mit Totenkopf): −2 Punkte und zwei Teile kürzer (×1.15)', 'Spiegel: alle Richtungen vertauscht (×1.35)', 'Hunger: Iss regelmässig, sonst schrumpft der Schwanz; der Balken oben zeigt es (×1.2)', 'Fluchtäpfel: die Äpfel hüpfen vor dir weg (×1.2)', 'Dunkelheit: du siehst nur rund um den Kopf (×1.25)', 'Die Faktoren werden multipliziert: Härtere Einstellungen zahlen mehr pro Punkt, leichtere weniger.'] },
      { h: 'Einsatz', p: 'Mit Einsatz bekommst du beim Auszahlen Einsatz × Multiplikator. Crashst du vorher, ist der Einsatz weg. Ohne Einsatz spielst du nur um den Rekord.' },
      { h: 'Daily-Challenge', p: 'Jeden Tag neue, zufällige und harte Modifier, für alle gleich. Dafür doppelte Auszahlung pro Punkt.' },
    ],
    en: [
      { h: 'Goal', p: 'Eat apples, grow and do not crash: the border (unless wrap-around is on), walls and your own body are deadly. Every point raises the multiplier.' },
      { h: 'Controls', li: ['Arrow keys or WASD (phone: swipe or tap the arrows).', 'Space starts, Enter cashes out.'] },
      { h: 'Apples', li: ['Red apple: 1 point', 'Golden apple: 3 points, vanishes after a while', 'Cosmic apple: 10 points, very rare and quickly gone'] },
      { h: 'Modifiers', li: ['Board small/medium/large, speed normal/fast/turbo', 'Walls: a block grows after every third apple', 'Portals: in through one, out of the other', 'Wrap-around: no deadly border, you come out on the opposite side (×0.8)', 'Poison apples (purple with a skull): −2 points and two pieces shorter (×1.15)', 'Mirrored: every direction is reversed (×1.35)', 'Hunger: eat regularly or the tail shrinks; the bar at the top shows it (×1.2)', 'Runaway apples: the apples hop away from you (×1.2)', 'Darkness: you only see around your head (×1.25)', 'The factors multiply: harder settings pay more per point, easier ones less.'] },
      { h: 'Stake', p: 'With a stake, cashing out pays stake × multiplier. Crash first and the stake is gone. Without a stake you only play for the record.' },
      { h: 'Daily challenge', p: 'New, random and hard modifiers every day, the same for everyone. In return double pay per point.' },
    ],
  },
  crossy: {
    de: [
      { h: 'Ziel', p: 'Komm so weit wie möglich und zahl rechtzeitig aus: Jeder Schritt nach vorne erhöht deinen Multiplikator.' },
      { h: 'Steuerung', li: ['WASD oder Pfeiltasten: ein Druck, ein Feld.', 'Handy: tippen hüpft vorwärts, wischen ändert die Richtung.', 'Leertaste oder Enter startet nach dem Game Over neu.'] },
      { h: 'Gefahren', li: ['Autos und Lastwagen: Berührung ist tödlich.', 'Flüsse: nur auf Baumstämmen stehen, sie tragen dich mit. Wasser oder Abdriften aus dem Bild ist das Ende.', 'Bahngleise: leuchten die Lampen rot und blinkt das Gleis, kommt in knapp 2 Sekunden ein sehr schneller Zug.', 'Rissige Baumstämme (später im Fluss, mit «!» markiert): sie tragen dich kurz, dann brechen sie. Schnell weiterhüpfen!', 'Mit der Zeit wird alles schneller.', 'Der Bildschirm schiebt sich langsam nach vorne. Wer hinten trödelt, wird geschnappt.'] },
      { h: 'Hindernisse', p: 'Bäume, Büsche, Steine, Baumstümpfe, Kisten, Zäune, Absperrungen und Läden blockieren den Weg. Blumen, Pilze, Gras und Kegel sind nur Deko. Seerosen liegen still im Teich und tragen dich.' },
      { h: 'Einsatz', li: ['Jeder Lauf kostet einen Einsatz von 10 bis 500, vor dem Start wählen.', 'Der Multiplikator startet bei ×0.5 und steigt mit jedem Schritt; ab 20 Schritten bist du im Plus.', 'Alle 50 Reihen kommt ein Checkpoint quer über das Feld: ×1.3 obendrauf, und jeder weitere Hop bringt 10 % mehr als vorher.', 'Deine Rekord-Reihe ist gestrichelt markiert. Wer sie überquert, bekommt einen Rekord-Coin (10 % des Einsatzes).', 'Mit Enter oder «Auszahlen» sicherst du Einsatz × Multiplikator. Stirbst du vorher, ist der Einsatz weg.', 'Coins (etwa alle 20 bis 60 Reihen) zahlen sofort 5 bis 30 % des Einsatzes zurück, je weiter du bist, desto mehr. Die bleiben dir auch, wenn du danach stirbst.'] },
    ],
    en: [
      { h: 'Goal', p: 'Get as far as you can and cash out in time: every step forward raises your multiplier.' },
      { h: 'Controls', li: ['WASD or arrow keys: one press, one tile.', 'Phone: tap to hop forward, swipe to change direction.', 'Space or Enter restarts after game over.'] },
      { h: 'Dangers', li: ['Cars and trucks: touching them is fatal.', 'Rivers: only stand on logs, they carry you along. Water or drifting off screen ends the run.', 'Railways: when the lamps glow red and the track flashes, a very fast train arrives in under 2 seconds.', 'Cracked logs (later in rivers, marked with "!"): they hold you for a moment, then break. Hop on quickly!', 'Everything speeds up over time.', 'The screen slowly pushes forward. Dawdle at the bottom and you get snatched.'] },
      { h: 'Obstacles', p: 'Trees, bushes, rocks, stumps, crates, fences, barriers and stalls block the way. Flowers, mushrooms, grass and cones are decoration. Lily pads sit still in ponds and carry you.' },
      { h: 'Stake', li: ['Every run costs a stake of 10 to 500, chosen before the start.', 'The multiplier starts at ×0.5 and grows with every step; after 20 steps you are ahead.', 'Every 50 rows a checkpoint spans the field: ×1.3 on top, and every further hop is worth 10 % more than before.', 'Your record row is marked with a dashed line. Crossing it pays a record coin (10 % of the stake).', 'Enter or "Cash out" locks in stake × multiplier. Die first and the stake is gone.', 'Coins (about every 20 to 60 rows) pay back 5 to 30 % of the stake at once, more the further you are. You keep them even if you die later.'] },
    ],
  },
  scratch: {
    de: [
      { h: 'Klassisch', p: 'Kratze das ganze Los frei. Drei gleiche Symbole gewinnen den angezeigten Multiplikator.' },
      { h: 'Glücksgriff', p: 'Kratze genau drei der neun Felder frei. Sind alle drei gleich, gewinnst du. Fängst du ein viertes Feld an, ist das Los ungültig.' },
      { h: 'Diamant', p: 'Zwei Schichten: Unter dem Silber liegt eine harte Goldschicht, die erst nach mehrmaligem Rubbeln verschwindet. Darunter: drei gleiche Symbole und ein Bonusfeld (×1 bis ×10), das deinen Gewinn multipliziert. Bis ×500.' },
      { h: 'Zahlenglück', p: 'Oben zwei Gewinnzahlen, unten acht deiner Zahlen mit je einem Betrag. Steht eine Gewinnzahl bei deinen Zahlen, gewinnst du den Betrag darunter (bis ×100).' },
      { h: 'Tipp', p: 'Mit Maus oder Finger rubbeln. «Alles aufdecken» zeigt das Los sofort (ausser beim Glücksgriff).' },
    ],
    en: [
      { h: 'Classic', p: 'Scratch the whole ticket. Three matching symbols win the multiplier shown.' },
      { h: 'Lucky pick', p: 'Scratch exactly three of the nine fields. All three equal and you win. Start a fourth field and the ticket is void.' },
      { h: 'Diamond', p: 'Two layers: below the silver lies a tough gold layer that only comes off after scratching several times. Underneath: three alike and a bonus box (×1 to ×10) that multiplies your win. Up to ×500.' },
      { h: 'Lucky Numbers', p: 'Two winning numbers on top, eight of your numbers below, each with a prize. If a winning number is among yours, you win the prize below it (up to ×100).' },
      { h: 'Tip', p: 'Scratch with mouse or finger. "Reveal all" uncovers the ticket at once (except Pick 3).' },
    ],
  },
};

/** Poker hand categories, best first, with an example hand (r: 1=A..13=K, s: 0♠ 1♥ 2♦ 3♣) and the cards that make it. */
export const HAND_RANKS: { cat: string; cards: [number, number][]; use: number; de: string; en: string }[] = [
  { cat: 'royal', cards: [[1, 0], [13, 0], [12, 0], [11, 0], [10, 0]], use: 5, de: 'A-K-Q-J-10 in einer Farbe', en: 'A-K-Q-J-10 of one suit' },
  { cat: 'straightFlush', cards: [[9, 1], [8, 1], [7, 1], [6, 1], [5, 1]], use: 5, de: 'Fünf in Folge, gleiche Farbe', en: 'Five in a row, same suit' },
  { cat: 'quads', cards: [[12, 0], [12, 1], [12, 2], [12, 3], [4, 0]], use: 4, de: 'Vier gleiche Werte', en: 'Four of the same rank' },
  { cat: 'fullHouse', cards: [[10, 0], [10, 1], [10, 3], [7, 2], [7, 0]], use: 5, de: 'Drilling plus Paar', en: 'Three of a kind plus a pair' },
  { cat: 'flush', cards: [[13, 2], [10, 2], [8, 2], [5, 2], [3, 2]], use: 5, de: 'Fünf Karten einer Farbe', en: 'Five cards of one suit' },
  { cat: 'straight', cards: [[8, 3], [7, 1], [6, 0], [5, 2], [4, 3]], use: 5, de: 'Fünf in Folge, Farbe egal (A-2-3-4-5 zählt)', en: 'Five in a row, any suit (A-2-3-4-5 counts)' },
  { cat: 'trips', cards: [[7, 0], [7, 2], [7, 3], [13, 1], [2, 0]], use: 3, de: 'Drei gleiche Werte', en: 'Three of the same rank' },
  { cat: 'twoPair', cards: [[11, 1], [11, 3], [4, 0], [4, 2], [9, 1]], use: 4, de: 'Zwei verschiedene Paare', en: 'Two different pairs' },
  { cat: 'pair', cards: [[1, 2], [1, 3], [12, 0], [8, 1], [3, 3]], use: 2, de: 'Zwei gleiche Werte', en: 'Two of the same rank' },
  { cat: 'high', cards: [[1, 0], [11, 2], [8, 3], [6, 1], [2, 0]], use: 1, de: 'Nichts davon: die höchste Karte zählt', en: 'None of the above: the highest card plays' },
];
