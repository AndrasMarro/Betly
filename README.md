# Betly

**Ein Spielgeld-Casino im Browser: Classic-Tischspiele, Arcade-Games, Mehrspieler und Bots, komplett ohne Echtgeld.**

[Live spielen →](https://andrasmarro.github.io/Betly/) · Deutsch & English · Kein Konto, keine Zahlung, keine Cookies

> *English:* Betly is a free play-money casino that runs entirely in the browser. Classic table games, slots and arcade games, multiplayer rooms without a server, bots you can switch on or off, three themes and synthesised sound. Credits have no monetary value and can never be bought or cashed out.

---

## Was ist Betly?

Betly ist ein privates Hobbyprojekt: eine Casino-Simulation, die sich wie ein echtes Casino anfühlen soll, aber **niemals um Geld spielt**. Jeder startet mit 10'000 Credits. Wer pleite ist, holt sich alle 15 Minuten neue Gratis-Credits. Alles läuft lokal im Browser; es gibt keinen Server, keine Datenbank und kein Tracking.

## Spiele

### Classic
| Spiel | Highlights |
|---|---|
| **Roulette** | Grosser royaler Tisch, europäisch (eine Null), Auto-Runden mit Setz-Countdown zum jederzeit Einsteigen (abschaltbar), präzises Setzen auf Splits/Carrés/Transversalen, Racetrack mit Nachbar- und Ansagewetten (Voisins, Tiers, Orphelins, Jeu Zéro), La Partage |
| **Blackjack** | 5 Plätze, Vollbild-Tisch, Regel-Varianten (Vegas, Atlantic City, Europäisch, Single Deck, Downtown) und frei einstellbar, Basic-Strategy-Tipps, Bots |
| **Texas Hold'em** | No-Limit an 6 Plätzen, Side-Pots, korrekte Mindest-Erhöhungen, Bots mit fünf Spielstilen (Monte-Carlo-Gewinnchancen), Helfer für Hand, Gewinnchance und Pot Odds, Übersicht aller Hände |
| **Baccarat** | Punto Banco mit echter Ziehregel, Paar-Wetten, Big-Road-Anzeigetafel |
| **Slots** | Lucky Sevens, Midnight Gems, Cosmic Cash, Lucky Clover (Wilds, Scatter, Freispiele) |

### Arcade
Rocket (Crash) · Kisten (Cases, *Classic*-Modus mit offiziellen Drop-Raten und eigenem Item-Set) · Minen · Minesweeper · Würfel (echte 3D-Physik) · Hop Street · Turm · Münzwurf (3D) · Hi-Lo · Plinko · Glücksrad · Rubbellos (Klassisch & Glücksgriff)

Weitere Spiele sind als *Demnächst* angelegt (Craps, Video Poker, Sic Bo, Keno, Limbo, …).

## Features

- **Mehrspieler ohne Server**: Raum öffnen, Code oder Link teilen. Die Verbindung läuft direkt von Browser zu Browser (WebRTC über PeerJS). Der Browser des Hosts führt den Tisch; beim Poker sieht jeder nur seine eigenen Karten. Ein Heartbeat erkennt Spieler, die verschwinden, und abwesende Plätze werden automatisch weitergespielt.
- **Bots an/aus** pro Tisch, inklusive Anzahl.
- **Anleitungen** für jedes Spiel (ausser ganz einfachen wie dem Münzwurf), auf Deutsch und Englisch.
- **Installierbar (PWA)**: Auf dem Handy «Zum Startbildschirm hinzufügen» liefert das Betly-Icon; die Seite funktioniert danach auch offline (ohne Mehrspieler).
- **Responsive**: Tische passen sich der Bildschirmhöhe an, vom Handy bis 1440p.
- **Deutsch & Englisch**, Schweizer Schreibweise und Zahlenformat (10'000).
- **Drei Designs**: Noir (Standard), Midnight (blau), Ivory (hell).
- **Sound**: Effekte und die Lounge-Musik im Menü werden live mit WebAudio erzeugt; einzige Aufnahme ist das Öffnen der Kisten.
- **Bewegung**: Federnde Animationen, die `prefers-reduced-motion` respektieren.

## Fairness & Mathematik

Die Spielmathematik ist von der Oberfläche getrennt (`src/games/*.ts`) und wird bei jedem Deploy mit `npm test` geprüft:

| Spiel | Auszahlungsquote (RTP) |
|---|---|
| Roulette | 97,3 % (36/37, jede Wette) |
| Blackjack | je nach Regeln ~99,5 % bei Basic Strategy |
| Baccarat | Bank 98,94 %, Spieler 98,76 %, Unentschieden 85,6 % |
| Slots | 96–97 % (Simulation über 400'000 Spins) |
| Arcade (Rocket, Minen, Würfel, Hop Street, Turm, Münzwurf, Hi-Lo, Plinko, Glücksrad, Rubbellos, Kisten) | 97 % |
| Kisten *Classic* | ~49 % (bewusst wie das Original, mit Erklärung der geometrischen Verteilung) |

Beim Poker spielen die Bots gegeneinander und gegen dich; die Engine ist mit 400 zufällig gespielten Händen getestet (Chips bleiben erhalten, jede Hand endet).

## Technik

- [Svelte 5](https://svelte.dev) + [Vite](https://vite.dev), TypeScript
- Statische Seite, Hash-Routing, Spiele werden erst beim Öffnen geladen
- [PeerJS](https://peerjs.com) für WebRTC-Mehrspieler
- Lokal eingebundene Schriften (Geist, Geist Mono, Instrument Serif)
- Deployment über GitHub Actions auf GitHub Pages

```
src/
  games/       Spielmathematik und Engines (Roulette, Blackjack, Poker, Baccarat, Slots, Arcade, Minesweeper)
  pages/       Eine Seite pro Spiel plus Startseite, Lobbys und Rechtstexte
  components/  Karten, Würfel, Münze, Rad, Chips, Raum-Leiste, …
  lib/         Zustand & Wallet, Übersetzungen, Sound, Mehrspieler, Animationen
tests/         Prüfungen der Spielmathematik (npm test)
```

## Lokal starten

```bash
npm install
npm run dev     # Entwicklungsserver
npm test        # Spielmathematik prüfen
npm run build   # statische Seite nach dist/
```

Für lokale Mehrspieler-Tests ohne Internet lässt sich ein eigener PeerServer angeben: `http://localhost:5173/?peer=127.0.0.1:9000`.

## Rechtliches

Betly ist kein Geldspiel im Sinne des Schweizer Geldspielgesetzes (BGS): Es gibt keinen Einsatz in Geld und keinen Gewinn mit Geldwert. Credits können weder gekauft noch ausgezahlt werden. Das Angebot richtet sich an Erwachsene. Details stehen auf der Seite unter *Impressum*, *Datenschutz* und *Haftung & Distanzierung*.

Hilfe bei Spielsucht: [SOS Spielsucht](https://www.sos-spielsucht.ch), 0800 040 080 (CH) · [check-dein-spiel.de](https://www.check-dein-spiel.de) (DE).

## Lizenz

Siehe [LICENSE](LICENSE). Fragen und Fehler gerne über die [Issues](https://github.com/AndrasMarro/Betly/issues).
