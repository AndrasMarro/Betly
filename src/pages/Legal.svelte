<script lang="ts">
  import { settings } from '../lib/state.svelte';
  import { OWNER, UPDATED } from '../lib/legal';
  let { page }: { page: 'impressum' | 'datenschutz' | 'haftung' } = $props();
  const de = $derived(settings.lang === 'de');
</script>

<article class="wrap legal">
  {#if !de}<p class="note">English translation for convenience. The German version is legally binding.</p>{/if}

  {#if page === 'impressum'}
    <h1>{de ? 'Impressum' : 'Imprint'}</h1>
    <h2>{de ? 'Angaben gemäß § 5 DDG' : 'Information pursuant to § 5 DDG (German Digital Services Act)'}</h2>
    <p>{OWNER.name}<br />{OWNER.street}<br />{OWNER.city}<br />{OWNER.country}</p>
    <h2>{de ? 'Kontakt' : 'Contact'}</h2>
    <p>E-Mail: {OWNER.email}</p>
    <h2>{de ? 'Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV' : 'Responsible for content according to § 18 (2) MStV'}</h2>
    <p>{OWNER.name}, {de ? 'Anschrift wie oben' : 'address as above'}</p>
    <h2>{de ? 'Art des Angebots' : 'Nature of this service'}</h2>
    <p>
      {de
        ? 'Betly ist ein privates, nicht-kommerzielles Hobbyprojekt. Es handelt sich um eine kostenlose Casino-Simulation mit Spielgeld. Es werden keine Zahlungen angenommen, keine Gewinne ausgeschüttet und keine Werbung geschaltet.'
        : 'Betly is a private, non-commercial hobby project: a free casino simulation using play money. No payments are accepted, no prizes are paid out and no advertising is shown.'}
    </p>
    <h2>{de ? 'Streitbeilegung' : 'Dispute resolution'}</h2>
    <p>
      {de
        ? 'Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.'
        : 'We are neither willing nor obliged to participate in dispute resolution proceedings before a consumer arbitration board.'}
    </p>
  {:else if page === 'datenschutz'}
    <h1>{de ? 'Datenschutzerklärung' : 'Privacy policy'}</h1>
    <p class="muted">{de ? 'Stand' : 'Last updated'}: {UPDATED}</p>

    <h2>1. {de ? 'Verantwortlicher' : 'Controller'}</h2>
    <p>{OWNER.name}, {OWNER.street}, {OWNER.city}, {OWNER.country}, E-Mail: {OWNER.email}</p>

    <h2>2. {de ? 'Das Wichtigste in Kürze' : 'Summary'}</h2>
    <p>
      {de
        ? 'Betly benötigt kein Konto, setzt keine Cookies, verwendet keine Analyse- oder Tracking-Werkzeuge und zeigt keine Werbung. Spielstand und Einstellungen bleiben ausschließlich in deinem Browser. Personenbezogene Daten werden nur verarbeitet, soweit dies technisch für die Auslieferung der Website und, falls du sie nutzt, für die Mehrspieler-Funktion erforderlich ist.'
        : 'Betly needs no account, sets no cookies, uses no analytics or tracking tools and shows no advertising. Game progress and settings stay in your browser only. Personal data is processed only where technically necessary to deliver the website and, if you use it, the multiplayer feature.'}
    </p>

    <h2>3. Hosting (GitHub Pages)</h2>
    <p>
      {de
        ? 'Diese Website wird über GitHub Pages bereitgestellt, einen Dienst der GitHub Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA. Beim Aufruf der Seite verarbeitet GitHub technisch notwendige Verbindungsdaten (insbesondere IP-Adresse, Zeitpunkt, abgerufene Datei, Browser-Kennung) in Server-Logfiles, um die Seite auszuliefern und die Sicherheit des Dienstes zu gewährleisten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse liegt in der sicheren und zuverlässigen Bereitstellung der Website. Eine Übermittlung in die USA ist möglich. GitHub ist unter dem EU-US Data Privacy Framework zertifiziert (Angemessenheitsbeschluss der EU-Kommission, Art. 45 DSGVO). Weitere Informationen: '
        : 'This website is served via GitHub Pages, a service of GitHub Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA. When you open the site, GitHub processes technically necessary connection data (in particular IP address, time, requested file, browser identifier) in server log files to deliver the site and keep the service secure. Legal basis is Art. 6(1)(f) GDPR; our legitimate interest is the secure and reliable provision of the website. Data may be transferred to the USA. GitHub is certified under the EU-US Data Privacy Framework (adequacy decision, Art. 45 GDPR). More information: '}
      <a href="https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer">GitHub Privacy Statement</a>.
    </p>

    <h2>4. {de ? 'Lokale Speicherung im Browser' : 'Local storage in your browser'}</h2>
    <p>
      {de
        ? 'Dein Spielgeld-Guthaben, Statistiken und Einstellungen (Sprache, Design, Sound, Bots, Spielername) werden im lokalen Speicher (localStorage) deines Browsers abgelegt. Diese Daten werden nicht an uns oder Dritte übertragen. Die Speicherung ist für die von dir ausdrücklich gewünschte Funktion unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG; Art. 6 Abs. 1 lit. b und f DSGVO). Du kannst die Daten jederzeit über die Browser-Einstellungen oder über „Konto zurücksetzen“ löschen.'
        : 'Your play-money balance, statistics and settings (language, theme, sound, bots, player name) are kept in your browser\'s local storage. This data is not transmitted to us or to third parties. Storage is strictly necessary for the function you explicitly requested (§ 25(2) no. 2 TDDDG; Art. 6(1)(b) and (f) GDPR). You can delete it at any time via your browser settings or via "Reset account".'}
    </p>

    <h2>5. {de ? 'Schriftarten' : 'Fonts'}</h2>
    <p>
      {de
        ? 'Alle Schriftarten (Geist, Geist Mono, Instrument Serif) sind lokal eingebunden. Es wird keine Verbindung zu Servern von Google oder anderen Schriftanbietern hergestellt.'
        : 'All fonts (Geist, Geist Mono, Instrument Serif) are self-hosted. No connection to Google or other font providers is made.'}
    </p>

    <h2>6. {de ? 'Mehrspieler-Funktion (optional)' : 'Multiplayer (optional)'}</h2>
    <p>
      {de
        ? 'Nur wenn du aktiv einen Raum öffnest oder einem Raum beitrittst, wird eine direkte Peer-to-Peer-Verbindung (WebRTC) zwischen den Browsern der Mitspielenden aufgebaut. Dazu wird die Open-Source-Bibliothek PeerJS verwendet. Für den Verbindungsaufbau werden deine IP-Adresse und eine zufällige Raum-/Verbindungs-ID an den Vermittlungsserver der PeerJS-Cloud (0.peerjs.com) sowie an STUN/TURN-Server (Google, stun.l.google.com, und PeerJS, *.turn.peerjs.com) übermittelt; diese können sich in Drittländern, insbesondere den USA, befinden. Kann keine direkte Verbindung hergestellt werden, werden die Spieldaten verschlüsselt über einen TURN-Server weitergeleitet. Über die Verbindung werden dein Spielername sowie Spielaktionen und Einsätze in Spielgeld an die anderen Personen im Raum übertragen. Technisch bedingt können die Mitspielenden dabei deine IP-Adresse erfahren. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung der von dir angeforderten Funktion). Wenn du dies nicht möchtest, spiele einfach am Solo-Tisch; dann findet keine dieser Übermittlungen statt.'
        : 'Only if you actively open or join a room, a direct peer-to-peer connection (WebRTC) is established between the players\' browsers, using the open-source library PeerJS. To set up the connection, your IP address and a random room/connection ID are sent to the PeerJS cloud signalling server (0.peerjs.com) and to STUN/TURN servers (Google, stun.l.google.com, and PeerJS, *.turn.peerjs.com), which may be located in third countries, in particular the USA. If no direct connection is possible, game data is relayed in encrypted form through a TURN server. Over the connection your player name, game actions and play-money bets are shared with the other people in the room. For technical reasons other players may learn your IP address. Legal basis is Art. 6(1)(b) GDPR (providing the feature you requested). If you do not want this, simply play at the solo table; none of these transfers happen then.'}
    </p>

    <h2>7. {de ? 'Deine Rechte' : 'Your rights'}</h2>
    <p>
      {de
        ? 'Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21). Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO). Da wir selbst keine personenbezogenen Daten speichern, wende dich für Daten in Server-Logfiles bitte zusätzlich an GitHub.'
        : 'You have the right of access (Art. 15 GDPR), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18), data portability (Art. 20) and to object to processing based on legitimate interests (Art. 21). You may also lodge a complaint with a data protection supervisory authority (Art. 77 GDPR). As we do not store any personal data ourselves, please also contact GitHub regarding server log data.'}
    </p>

    <h2>8. {de ? 'Keine automatisierte Entscheidungsfindung' : 'No automated decision-making'}</h2>
    <p>{de ? 'Es findet keine automatisierte Entscheidungsfindung einschließlich Profiling statt.' : 'There is no automated decision-making, including profiling.'}</p>
  {:else}
    <h1>{de ? 'Haftungsausschluss & Distanzierung' : 'Disclaimer & dissociation'}</h1>

    <h2>1. {de ? 'Kein Glücksspiel, nur Spielgeld' : 'No gambling, play money only'}</h2>
    <p>
      {de
        ? 'Betly ist eine kostenlose Casino-Simulation ausschließlich zu Unterhaltungszwecken. Alle Spiele werden mit simulierten Credits gespielt. Diese Credits haben keinen Geldwert, können nicht gekauft, verkauft, übertragen oder ausgezahlt werden und berechtigen zu keinerlei Gewinn, Prämie oder sonstiger Gegenleistung. Es wird zu keinem Zeitpunkt ein Entgelt verlangt. Damit handelt es sich nicht um ein Glücksspiel im Sinne von § 3 Abs. 1 Glücksspielstaatsvertrag 2021 und nicht um ein Glücksspiel im Sinne von § 284 StGB.'
        : 'Betly is a free casino simulation for entertainment purposes only. All games use simulated credits. These credits have no monetary value, cannot be bought, sold, transferred or cashed out, and do not entitle anyone to any prize, reward or other consideration. No fee is charged at any time. It is therefore not gambling within the meaning of § 3(1) of the German Interstate Treaty on Gambling 2021 or § 284 of the German Criminal Code.'}
    </p>

    <h2>2. {de ? 'Distanzierung von Echtgeld-Glücksspiel' : 'Dissociation from real-money gambling'}</h2>
    <p>
      {de
        ? 'Wir distanzieren uns ausdrücklich von unerlaubtem Glücksspiel und bewerben weder Echtgeld-Glücksspiel noch Glücksspielanbieter. Betly steht in keiner Verbindung zu Casinos, Wettanbietern oder sonstigen Glücksspielunternehmen und erhält von solchen keine Vergütung. Ergebnisse, Gewinne und Strategien (zum Beispiel Basic-Strategy-Tipps beim Blackjack) in der Simulation lassen keine Rückschlüsse auf reale Spiele zu; Spiele mit Hausvorteil führen auf Dauer zu Verlusten.'
        : 'We expressly dissociate ourselves from unlawful gambling and promote neither real-money gambling nor gambling operators. Betly is not affiliated with casinos, betting providers or other gambling businesses and receives no compensation from them. Results, wins and strategies (for example basic strategy hints in blackjack) in the simulation allow no conclusions about real games; games with a house edge lose money in the long run.'}
    </p>

    <h2>3. {de ? 'Jugend- und Spielerschutz' : 'Youth and player protection'}</h2>
    <p>
      {de
        ? 'Das Angebot richtet sich an Erwachsene; wir empfehlen die Nutzung ab 18 Jahren. Auch simuliertes Glücksspiel kann problematisches Spielverhalten begünstigen. Wenn du merkst, dass Glücksspiel dir oder Angehörigen Probleme bereitet, findest du kostenlose und anonyme Hilfe bei der Bundeszentrale für gesundheitliche Aufklärung (BZgA): '
        : 'This service is intended for adults; we recommend use from age 18. Even simulated gambling can encourage problematic gambling behaviour. If gambling causes problems for you or someone close to you, free and anonymous help is available (Germany) from the Federal Centre for Health Education (BZgA): '}
      <a href="https://www.check-dein-spiel.de" target="_blank" rel="noopener noreferrer">check-dein-spiel.de</a>, {de ? 'Telefon' : 'phone'} 0800 1 37 27 00 ({de ? 'kostenlos' : 'free of charge'}).
    </p>

    <h2>4. {de ? 'Haftung für Inhalte' : 'Liability for content'}</h2>
    <p>
      {de
        ? 'Die Inhalte dieser Seiten wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte übernehmen wir jedoch keine Gewähr. Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte nach den allgemeinen Gesetzen verantwortlich. Es besteht kein Anspruch auf Verfügbarkeit des Angebots oder auf Erhalt eines Spielgeld-Guthabens; Spielstände können etwa durch das Löschen der Browserdaten verloren gehen.'
        : 'The content of these pages was created with great care. However, we cannot guarantee its accuracy, completeness or timeliness. As a service provider we are responsible for our own content under general law (§ 7(1) DDG). There is no entitlement to availability of the service or to keeping a play-money balance; progress can be lost, for example by clearing browser data.'}
    </p>

    <h2>5. {de ? 'Haftung für Links' : 'Liability for links'}</h2>
    <p>
      {de
        ? 'Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Für diese fremden Inhalte übernehmen wir keine Gewähr; verantwortlich ist stets der jeweilige Anbieter oder Betreiber. Zum Zeitpunkt der Verlinkung waren keine Rechtsverstöße erkennbar. Wir distanzieren uns ausdrücklich von allen Inhalten verlinkter Seiten, die nach der Verlinkung verändert wurden. Bei Bekanntwerden von Rechtsverletzungen entfernen wir derartige Links umgehend.'
        : 'Our service contains links to external third-party websites whose content we cannot influence. We accept no liability for such external content; the respective provider or operator is always responsible. No legal violations were apparent at the time of linking. We expressly dissociate ourselves from any content of linked pages that was changed after linking. If we become aware of any infringements, we will remove such links immediately.'}
    </p>

    <h2>6. {de ? 'Urheberrecht' : 'Copyright'}</h2>
    <p>
      {de
        ? 'Die durch den Seitenbetreiber erstellten Inhalte und Werke unterliegen dem deutschen Urheberrecht. Der Quellcode steht unter der im Repository angegebenen Lizenz. Verwendete Schriftarten stehen unter der SIL Open Font License. Spielnamen wie Roulette, Blackjack oder Baccarat bezeichnen allgemein bekannte Spiele.'
        : 'Content and works created by the site operator are subject to German copyright law. The source code is licensed as stated in the repository. Fonts used are licensed under the SIL Open Font License. Game names such as roulette, blackjack or baccarat refer to commonly known games.'}
    </p>
  {/if}
</article>

<style>
  .legal { max-width: 760px; padding: 48px 0 100px; }
  h1 { font-size: clamp(2.2rem, 5vw, 3.6rem); letter-spacing: -0.04em; line-height: 1; margin: 0 0 28px; }
  h2 { font-size: 1.05rem; margin: 32px 0 8px; letter-spacing: -0.01em; }
  p { color: color-mix(in srgb, var(--text) 82%, transparent); margin: 0 0 12px; }
  .muted { color: var(--muted); }
  .note { font-size: 0.85rem; color: var(--muted); border: 1px solid var(--line-2); border-radius: 12px; padding: 10px 14px; }
</style>
