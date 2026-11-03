# Betly

Play-money casino: Roulette, Blackjack and Slots with simulated credits. No real money, no payments.

- **Roulette**: European single zero, precise inside bets (click edges/corners for splits, corners, streets, six lines), racetrack with neighbours and call bets (Voisins, Tiers, Orphelins, Jeu Zéro), La Partage option.
- **Blackjack**: 5 seats, bots with basic strategy, strategy hints, presets (Vegas, Atlantic City, European, Single Deck, Downtown) plus custom rules: decks, H17/S17, 3:2 / 6:5 / 1:1, double restrictions, DAS, max splits, resplit aces, late surrender, insurance, peek / no hole card.
- **Slots**: Lucky Sevens (3x3, 5 lines), Midnight Gems (5x3, 10 lines, wild, free spins), Cosmic Cash (5x3, 20 lines, free spins), Lucky Clover (5x4, 20 lines). RTP about 96 %, checked by `npm test`.
- **Arcade**: Rocket (crash game with bots and multiplayer), Mines, Dice, Hop Street, Tower, Coin Flip, Hi-Lo, Plinko, Wheel of Luck, Scratch Card. All at about 97 % RTP, checked by `npm test`.
- **Placeholders**: Baccarat, Craps, Poker variants, Video Poker, Sic Bo, Keno, Limbo, Balloon, Penalty, Derby.
- **Sound**: everything synthesised with WebAudio (chips, cards, shuffle, wheel, reels, rocket engine, explosion), plus procedural lounge music in the menus.
- **Texas Hold'em**: no-limit, 6 seats, bots with five playing styles (Monte Carlo equity), side pots, short all-in rules, win-chance helper, multiplayer with hidden hole cards.
- **Baccarat**: Punto Banco with the drawing tableau, pair bets, Big Road. **Minesweeper**: first click safe, chording, long-press flags on touch.
- **Multiplayer**: "Open room" and share the code/link. Serverless peer-to-peer via WebRTC (PeerJS), the host's browser runs the table. A heartbeat drops players who vanish, absent players auto-stand after 30 s.
- **Bots** on/off, **DE/EN**, three themes (Noir, Midnight, Ivory), free credits every 15 minutes.

## Develop

```bash
npm install
npm run dev
npm test   # game math checks
```

## Deploy

Every push to `main` builds and publishes `dist/` to the `gh-pages` branch (`.github/workflows/deploy.yml`).
One-time setup: GitHub repo → Settings → Pages → Source "Deploy from a branch" → `gh-pages` / root.
