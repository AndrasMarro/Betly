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
  threecard: {
    ranks: false,
    de: [
      { h: 'Ziel', p: 'Mit drei Karten die bessere Hand als der Dealer haben. Dazu kannst du auf Pair Plus setzen, das nur auf deine eigene Hand schaut.' },
      { h: 'Ablauf', li: ['Ante setzen (und optional Pair Plus), dann geben.', 'Du siehst deine drei Karten. Spielen kostet nochmals so viel wie die Ante, Passen verliert die Ante.', 'Der Dealer deckt auf. Er spielt nur mit Dame oder besser.'] },
      { h: 'Auszahlung', li: ['Dealer qualifiziert nicht: Ante 1:1, Play zurück.', 'Deine Hand besser: Ante und Play je 1:1. Schlechter: beide verloren. Gleich: beide zurück.', 'Ante Bonus, wenn du spielst (auch wenn der Dealer gewinnt): Strasse 1:1, Drilling 4:1, Straight Flush 5:1.', 'Pair Plus: Paar 1:1, Flush 4:1, Strasse 6:1, Drilling 30:1, Straight Flush 40:1.'] },
      { h: 'Hände (beste zuerst)', p: 'Straight Flush, Drilling, Strasse, Flush, Paar, höchste Karte. Achtung: Mit drei Karten ist die Strasse mehr wert als der Flush. A-2-3 ist die tiefste Strasse.' },
      { h: 'Strategie', p: 'Spiele mit Dame-6-4 oder besser, passe darunter. Der Tipp-Schalter zeigt dir das an.' },
    ],
    en: [
      { h: 'Goal', p: 'Beat the dealer with three cards. You can also bet Pair Plus, which only looks at your own hand.' },
      { h: 'Flow', li: ['Place the ante (and optionally Pair Plus), then deal.', 'You see your three cards. Playing costs the ante again, folding loses the ante.', 'The dealer reveals. The dealer only plays with queen high or better.'] },
      { h: 'Payouts', li: ['Dealer does not qualify: ante 1:1, play returned.', 'Your hand is better: ante and play 1:1 each. Worse: both lost. Equal: both returned.', 'Ante bonus whenever you play (even if the dealer wins): straight 1:1, three of a kind 4:1, straight flush 5:1.', 'Pair Plus: pair 1:1, flush 4:1, straight 6:1, three of a kind 30:1, straight flush 40:1.'] },
      { h: 'Hands (best first)', p: 'Straight flush, three of a kind, straight, flush, pair, high card. Note: with three cards a straight beats a flush. A-2-3 is the lowest straight.' },
      { h: 'Strategy', p: 'Play with queen-6-4 or better, fold below. The hint switch shows you.' },
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
      { h: 'Ziel', p: 'Zwei Würfel werden geworfen. Tippe auf das Ergebnis, bevor sie fallen.' },
      { h: 'Wetten', li: ['Unter 7 (2–6) oder Über 7 (8–12)', 'Genau 7', 'Pasch (beide Würfel gleich)', 'Eine bestimmte Summe von 2 bis 12'] },
      { h: 'Auszahlung', p: 'Je unwahrscheinlicher die Wette, desto höher der Multiplikator. Chance und Multiplikator stehen neben dem Knopf.' },
    ],
    en: [
      { h: 'Goal', p: 'Two dice are thrown. Call the result before they land.' },
      { h: 'Bets', li: ['Under 7 (2–6) or over 7 (8–12)', 'Exactly 7', 'Doubles (both dice equal)', 'A specific sum from 2 to 12'] },
      { h: 'Payout', p: 'The less likely the bet, the higher the multiplier. Chance and multiplier are shown next to the button.' },
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
    ],
    en: [
      { h: 'Goal', p: 'Climb the tower. Every floor has at least one trap tile.' },
      { h: 'Flow', li: ['Choose bet and difficulty (more traps = higher multipliers).', 'Pick one tile per floor. Safe? Up one floor.', 'Cash out any time; a trap ends the round with nothing.'] },
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
      { h: 'Ziel', p: 'Friss Äpfel, wachse und crashe nicht: Rand, Mauern und der eigene Körper sind tödlich. Jeder Punkt erhöht den Multiplikator.' },
      { h: 'Steuerung', li: ['Pfeiltasten oder WASD (Handy: wischen oder die Pfeile tippen).', 'Leertaste startet, Enter zahlt aus.'] },
      { h: 'Äpfel', li: ['Roter Apfel: 1 Punkt', 'Goldener Apfel: 3 Punkte, verschwindet nach kurzer Zeit', 'Kosmischer Apfel: 10 Punkte, sehr selten und schnell weg'] },
      { h: 'Modifier', li: ['Spielfeld klein/mittel/gross, Tempo normal/schnell/turbo', 'Mauern: nach jedem dritten Apfel wächst ein Block', 'Portale: rein in das eine, raus beim anderen', 'Härtere Einstellungen zahlen mehr pro Punkt, mehr Äpfel zahlen weniger.'] },
      { h: 'Einsatz', p: 'Mit Einsatz bekommst du beim Auszahlen Einsatz × Multiplikator. Crashst du vorher, ist der Einsatz weg. Ohne Einsatz spielst du nur um den Rekord.' },
      { h: 'Daily-Challenge', p: 'Jeden Tag neue, zufällige und harte Modifier, für alle gleich. Dafür doppelte Auszahlung pro Punkt.' },
    ],
    en: [
      { h: 'Goal', p: 'Eat apples, grow and do not crash: the border, walls and your own body are deadly. Every point raises the multiplier.' },
      { h: 'Controls', li: ['Arrow keys or WASD (phone: swipe or tap the arrows).', 'Space starts, Enter cashes out.'] },
      { h: 'Apples', li: ['Red apple: 1 point', 'Golden apple: 3 points, vanishes after a while', 'Cosmic apple: 10 points, very rare and quickly gone'] },
      { h: 'Modifiers', li: ['Board small/medium/large, speed normal/fast/turbo', 'Walls: a block grows after every third apple', 'Portals: in through one, out of the other', 'Harder settings pay more per point, more apples pay less.'] },
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
      { h: 'Tipp', p: 'Mit Maus oder Finger rubbeln. «Alles aufdecken» zeigt das klassische Los sofort.' },
    ],
    en: [
      { h: 'Classic', p: 'Scratch the whole ticket. Three matching symbols win the multiplier shown.' },
      { h: 'Lucky pick', p: 'Scratch exactly three of the nine fields. All three equal and you win. Start a fourth field and the ticket is void.' },
      { h: 'Tip', p: 'Scratch with mouse or finger. "Reveal all" uncovers the classic ticket at once.' },
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
