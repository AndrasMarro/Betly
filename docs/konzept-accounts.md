# Konzept: Konten und gespeicherter Fortschritt

Stand: November 2026. Ziel: Spielstand (Guthaben, Rekorde, Kampagnen, Einstellungen) soll Browser-Wechsel, gelöschten Cache und neue Geräte überleben. Login mit Google, Gastmodus bleibt.

## 1. Ausgangslage

- Heute liegt alles im `localStorage` des Browsers (`betly:wallet`, `betly:snake`, `betly:crossy` …).
- Ein normaler Reload verliert **nichts** (geprüft). Verloren geht der Stand bei:
  - «Browserdaten / Websitedaten löschen» oder Cache leeren inklusive Website-Daten
  - privatem Fenster
  - Safari (iPhone/Mac): Website-Speicher wird nach **7 Tagen ohne Besuch** gelöscht, ausser die Seite ist als App auf dem Home-Bildschirm installiert
  - anderem Browser oder Gerät
- Sofort umgesetzt: `navigator.storage.persist()` bittet den Browser, die Daten nicht automatisch zu räumen. Das hilft gegen Speicherplatz-Räumung, nicht gegen manuelles Löschen.

## 2. Was GitHub kann und was nicht

| | GitHub | Bemerkung |
|---|---|---|
| Website hosten | ✅ GitHub Pages | bleibt wie heute |
| Code, Datenbank-Schema, Migrationen | ✅ Repo (`supabase/migrations/*.sql`) | |
| Automatisierung | ✅ GitHub Actions | Deploy, Migrationen einspielen, «Keep-alive»-Ping |
| Datenbank / Server / Login | ❌ | Pages liefert nur statische Dateien aus |

Spielerdaten «im Repo» oder in Gists zu speichern geht nicht sinnvoll: Der Browser bräuchte dafür ein GitHub-Token mit Schreibrechten, das jeder aus dem Code lesen und missbrauchen könnte. Ausserdem gibt es Rate-Limits, und es verstösst gegen die Nutzungsbedingungen.

**Also:** Frontend bleibt auf GitHub Pages, Daten und Login kommen von einem «Backend as a Service».

## 3. Empfehlung: Supabase

| | **Supabase** (empfohlen) | Firebase |
|---|---|---|
| Google-Login | ✅ | ✅ |
| Datenbank | Postgres (SQL, Tabellen) | Firestore (Dokumente) |
| Gratis-Kontingent | 500 MB DB, 50 000 aktive Nutzer/Monat | grosszügig |
| Server-Logik gratis | ✅ SQL-Funktionen (RPC) und Edge Functions | ❌ Cloud Functions brauchen den Blaze-Plan (Kreditkarte) |
| Serverstandort EU/CH-nah | ✅ Frankfurt wählbar | ✅ wählbar |
| Haken | Gratis-Projekte pausieren nach 7 Tagen ohne Anfragen | Vendor-Lock-in, Regeln in eigener Sprache |

Supabase gewinnt wegen der kostenlosen Server-Logik. Die braucht es, damit das Guthaben nicht einfach per Konsole überschrieben werden kann (siehe Abschnitt 6). Das Pausieren verhindert eine GitHub Action, die die Datenbank einmal am Tag anpingt.

## 4. Architektur

```
Browser (GitHub Pages)                       Supabase (Frankfurt)
┌──────────────────────────┐   HTTPS       ┌──────────────────────────┐
│ Betly (Svelte)           │ ────────────► │ Auth (Google OAuth)      │
│  localStorage = Cache    │               │ Postgres + Row Level Sec.│
│  sync.ts (lädt/speichert)│ ◄──────────── │ RPC: claim_bonus,        │
└──────────────────────────┘               │      apply_result        │
                                           └──────────────────────────┘
```

- **Local first:** Das Spiel liest und schreibt weiter sofort in `localStorage`, ohne Wartezeit. Eine Sync-Schicht gleicht im Hintergrund mit dem Server ab.
- **Gastmodus bleibt:** Ohne Login läuft alles wie heute. Ein Konto ist optional.
- `@supabase/supabase-js` wird erst geladen, wenn jemand auf «Anmelden» tippt oder bereits angemeldet ist. So bleibt der Start schnell.

### Login-Ablauf

1. In den Einstellungen: «Mit Google anmelden».
2. Supabase leitet zu Google weiter und wieder zurück nach `https://andrasmarro.github.io/Betly/`.
3. **PKCE-Flow** verwenden: Der Code kommt als `?code=…` zurück, nicht im `#`. Sonst kollidiert er mit dem Hash-Routing (`#/roulette`).
4. Beim **ersten** Login mit vorhandenem lokalem Spielstand fragt die App: «Lokalen Spielstand ins Konto übernehmen?»

## 5. Datenmodell

> **Umgesetzt (vereinfacht):** eine Tabelle `saves (user_id, key, data, updated_at)` mit einer Zeile pro `localStorage`-Schlüssel, siehe `supabase/migrations/001_init.sql`. Ein Trigger prüft das Guthaben (0 bis 100 Mio., Runden nur vorwärts). Die getrennten Tabellen und RPCs unten sind der Plan für Stufe 2.

```sql
-- Spielername (kein E-Mail-Feld: das speichert Supabase Auth selbst)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  created_at timestamptz default now()
);

-- Guthaben
create table wallets (
  user_id uuid primary key references auth.users on delete cascade,
  balance numeric(14,2) not null default 10000 check (balance >= 0 and balance <= 100000000),
  last_bonus timestamptz,
  biggest_win numeric(14,2) not null default 0,
  rounds int not null default 0,
  updated_at timestamptz not null default now()
);

-- alles andere pro Spiel als JSON: Rekorde, Kampagnen, Einstellungen
create table progress (
  user_id uuid references auth.users on delete cascade,
  key text,                 -- 'snake', 'crossy', 'minesweeper', 'settings' …
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table profiles enable row level security;
alter table wallets  enable row level security;
alter table progress enable row level security;
-- jeder sieht und ändert nur die eigenen Zeilen
create policy own on profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy own on progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy read_own on wallets for select using (auth.uid() = user_id);
-- wallets: KEIN direktes update aus dem Browser, nur über die Funktionen unten
```

Die `progress`-Schlüssel entsprechen den heutigen `localStorage`-Einträgen. Die Sync-Schicht kann sie also fast 1:1 übernehmen.

## 6. Schummeln: drei Stufen

Alles, was im Browser läuft, kann ein Nutzer verändern. Ein Server macht das Spiel nur so fair, wie viel Logik er selbst übernimmt.

| Stufe | Wie | Aufwand | Schutz |
|---|---|---|---|
| 1 | Browser schreibt das Guthaben direkt (mit RLS) | klein | wie heute: per Konsole änderbar |
| **2 (empfohlen)** | Guthaben ändert sich nur über SQL-Funktionen | mittel | Bonus nur mit Server-Uhr; Gewinne plausibel begrenzt |
| 3 | Server würfelt selbst (Edge Function), Browser animiert nur | gross, pro Spiel | echt fair, Voraussetzung für Ranglisten um echte Preise |

Stufe 2, Beispiele:

- `claim_bonus()`: prüft `last_bonus` gegen `now()` auf dem Server. Die Uhr im Browser zählt nicht mehr.
- `apply_result(game text, stake numeric, payout numeric)`:
  - prüft `stake <= balance` und `payout <= stake × Maximal-Multiplikator des Spiels` (z. B. Roulette 36, Plinko 1000).
  - begrenzt Runden pro Minute.
  - schreibt `balance`, `rounds`, `biggest_win` atomar.

Damit gehen «Guthaben auf 1 Million setzen» und «Bonus im Sekundentakt» nicht mehr. Ein manipuliertes Spiel kann aber weiterhin «glücklich» sein. Für Spielgeld ohne Preise ist das vertretbar. Gibt es später eine öffentliche Rangliste, sollte sie nur Spiele der Stufe 3 zählen.

## 7. Synchronisation

- **Speichern:** nach Änderungen 3 Sekunden sammeln (debounce), dann senden. Zusätzlich bei `visibilitychange` (Tab wechselt in den Hintergrund) und `pagehide`.
- **Laden beim Start:** angemeldet → Serverstand holen. Pro Schlüssel gewinnt das neuere `updated_at` («neuester Stand gewinnt»). Das reicht für mehrere Geräte.
- **Offline:** Änderungen bleiben lokal markiert und werden beim nächsten Online-Gehen nachgeschickt.
- **Abmelden:** lokaler Stand wird auf einen Gast-Stand zurückgesetzt, damit das nächste Konto nicht den alten Spielstand erbt.

## 8. Datenschutz (Schweiz, revDSG; für EU-Gäste DSGVO)

Mit Konten werden erstmals Personendaten gespeichert. Die Datenschutzerklärung (`src/pages/Legal.svelte`) sagt heute ausdrücklich «kein Konto, keine Personendaten». Sie muss vor dem Start angepasst werden:

- **Welche Daten:** Google-Konto-ID und E-Mail (für das Login, bei Supabase Auth), Spielername, Spielstand.
- **Zweck:** Spielstand geräteübergreifend speichern. Keine Werbung, kein Tracking, keine Weitergabe.
- **Auftragsbearbeiter:** Supabase Inc. (Server in Frankfurt; Datenverarbeitungsvertrag im Dashboard abschliessen) und Google als Login-Anbieter. Bekanntgabe ins Ausland (USA) erwähnen.
- **Löschen:** Button «Konto löschen» in den Einstellungen. Er ruft eine Edge Function auf, die den Nutzer mit dem Service-Key löscht; `on delete cascade` räumt alle Tabellen.
- **Auskunft und Export:** Button «Meine Daten herunterladen» (JSON).
- **Datensparsamkeit:** Gastmodus bleibt Standard. Ein Konto ist freiwillig.

## 9. Was du selbst einrichten musst (Konsole, ca. 30 Minuten)

1. **Supabase-Konto** erstellen → neues Projekt, Region **Frankfurt (eu-central-1)**, Datenbank-Passwort sicher ablegen.
2. **Google Cloud Console** → neues Projekt → «OAuth-Zustimmungsbildschirm» (extern, App-Name Betly) → «Anmeldedaten» → «OAuth-Client-ID» (Webanwendung).
   - Autorisierte Weiterleitungs-URI: `https://<projekt>.supabase.co/auth/v1/callback`
3. **Supabase** → Authentication → Providers → Google: Client-ID und Secret eintragen.
   - Authentication → URL Configuration: Site URL `https://andrasmarro.github.io/Betly/`, zusätzlich `http://localhost:5173` für die Entwicklung.
4. Mir die **Projekt-URL** und den **anon key** geben.
   - Beide sind öffentlich gedacht und dürfen im Code stehen; die Sicherheit kommt von RLS.
   - Den **service_role key** niemals in den Code oder in den Chat. Er gehört nur in Supabase/GitHub-Secrets.

## 10. Umsetzung durch mich (Reihenfolge)

1. `supabase/migrations/001_init.sql`: Tabellen, RLS, Funktionen `claim_bonus` und `apply_result`.
2. `src/lib/sync.ts`: Login/Logout, Laden/Speichern, Konflikt nach `updated_at`.
3. Einstellungen: «Mit Google anmelden», Spielername, «Lokalen Stand übernehmen», «Konto löschen», «Daten herunterladen».
4. Wallet-Funktionen (`stake`, `settle`, `claimBonus`) rufen im angemeldeten Zustand die RPCs auf, lokal bleibt die Anzeige sofort.
5. Datenschutzerklärung DE/EN anpassen.
6. GitHub Action: Migrationen einspielen und täglicher Keep-alive-Ping.

Grobe Grösse: Stufe 2 komplett etwa ein grösserer Arbeitsschritt wie ein neues Spiel. Stufe 3 danach Spiel für Spiel, beginnend mit den einfachen (Münzwurf, Würfel, Roulette, Plinko).

## Alternative ohne Konto: Spielstand-Code

Falls du (noch) keine Personendaten willst:
- Button «Spielstand sichern» erzeugt einen Code oder QR-Code (signierter, komprimierter Spielstand).
- Auf einem anderen Gerät oder nach dem Löschen lässt er sich wieder einlesen.
- Kein Server, kein Datenschutz-Aufwand, in kurzer Zeit gebaut.
- Nachteil: Man muss selbst daran denken, den Code aufzubewahren.
