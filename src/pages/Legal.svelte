<script lang="ts">
  import { settings } from '../lib/state.svelte';
  import { CONTACT, UPDATED } from '../lib/legal';
  let { page }: { page: 'impressum' | 'datenschutz' | 'haftung' } = $props();
  const de = $derived(settings.lang === 'de');
</script>

<article class="wrap legal">
  {#if !de}<p class="note">English translation for convenience. The German version is authoritative.</p>{/if}

  {#if page === 'impressum'}
    <h1>{de ? 'Impressum' : 'Imprint'}</h1>
    <h2>{de ? 'Anbieter' : 'Provider'}</h2>
    <p>
      {de
        ? 'Betly ist ein privates, nicht-kommerzielles Hobbyprojekt mit Sitz in der Schweiz. Es werden weder Waren noch Dienstleistungen gegen Entgelt angeboten, keine Zahlungen angenommen und keine Werbung geschaltet. Eine Pflicht zur Anbieterkennzeichnung für den elektronischen Geschäftsverkehr (Art. 3 Abs. 1 lit. s UWG) besteht daher nicht. Das Angebot ist auch nicht geschäftsmässig im Sinne des deutschen Digitale-Dienste-Gesetzes (§ 5 DDG).'
        : 'Betly is a private, non-commercial hobby project based in Switzerland. No goods or services are offered for payment, no payments are accepted and no advertising is shown. There is therefore no obligation to provide trader identification for e-commerce (Art. 3(1)(s) of the Swiss Unfair Competition Act). The service is not a commercial service within the meaning of the German Digital Services Act (§ 5 DDG) either.'}
    </p>
    <h2>{de ? 'Kontakt' : 'Contact'}</h2>
    <p>
      {de ? 'Anfragen, Hinweise auf Fehler oder Rechtsverletzungen und Auskunftsbegehren bitte über das öffentliche Projekt-Repository:' : 'Questions, reports of errors or infringements and data requests via the public project repository:'}
      <a href={CONTACT} target="_blank" rel="noopener noreferrer">{CONTACT.replace('https://', '')}</a>
    </p>
    <h2>{de ? 'Art des Angebots' : 'Nature of this service'}</h2>
    <p>
      {de
        ? 'Kostenlose Casino- und Arcade-Simulation mit Spielgeld. Credits haben keinen Geldwert, sind weder käuflich noch auszahlbar und berechtigen zu keinem Gewinn.'
        : 'Free casino and arcade simulation with play money. Credits have no monetary value, cannot be bought or cashed out and entitle to no prize.'}
    </p>
  {:else if page === 'datenschutz'}
    <h1>{de ? 'Datenschutzerklärung' : 'Privacy policy'}</h1>
    <p class="muted">{de ? 'Stand' : 'Last updated'}: {UPDATED}</p>

    <h2>1. {de ? 'Verantwortliche Stelle und anwendbares Recht' : 'Controller and applicable law'}</h2>
    <p>
      {de
        ? 'Verantwortlich für die Datenbearbeitung ist der private Betreiber dieser Website in der Schweiz. Kontakt, auch für Auskunfts- und Löschbegehren: '
        : 'The controller is the private operator of this website in Switzerland. Contact, including for access and deletion requests: '}
      <a href={CONTACT} target="_blank" rel="noopener noreferrer">{CONTACT.replace('https://', '')}</a>.
      {de
        ? ' Massgebend ist das Schweizer Bundesgesetz über den Datenschutz (DSG). Soweit Personen in der EU bzw. im EWR betroffen sind, gilt ergänzend die Datenschutz-Grundverordnung (DSGVO).'
        : ' The Swiss Federal Act on Data Protection (FADP) applies. Where persons in the EU/EEA are concerned, the General Data Protection Regulation (GDPR) applies in addition.'}
    </p>

    <h2>2. {de ? 'Das Wichtigste in Kürze' : 'Summary'}</h2>
    <p>
      {de
        ? 'Betly benötigt kein Konto, setzt keine Cookies, verwendet keine Analyse- oder Tracking-Werkzeuge und zeigt keine Werbung. Spielstand und Einstellungen bleiben ausschliesslich in deinem Browser. Personendaten werden nur bearbeitet, soweit dies technisch für die Auslieferung der Website und, falls du sie nutzt, für die Mehrspieler-Funktion nötig ist.'
        : 'Betly needs no account, sets no cookies, uses no analytics or tracking tools and shows no advertising. Game progress and settings stay in your browser only. Personal data is processed only where technically necessary to deliver the website and, if you use it, the multiplayer feature.'}
    </p>

    <h2>3. Hosting (GitHub Pages)</h2>
    <p>
      {de
        ? 'Die Website wird über GitHub Pages bereitgestellt, einen Dienst der GitHub Inc. (USA, eine Tochtergesellschaft der Microsoft Corporation). Beim Aufruf bearbeitet GitHub technisch notwendige Verbindungsdaten (insbesondere IP-Adresse, Zeitpunkt, abgerufene Datei, Browser-Kennung) in Server-Logfiles, um die Seite auszuliefern und den Dienst abzusichern. Dabei werden Daten in die USA bekanntgegeben. Die USA gelten für Unternehmen, die unter dem Swiss-US bzw. EU-US Data Privacy Framework zertifiziert sind, als Staat mit angemessenem Datenschutz (Art. 16 DSG, Art. 45 DSGVO); GitHub bzw. Microsoft gibt an, an diesen Rahmenwerken teilzunehmen. Weitere Informationen: '
        : 'The website is served via GitHub Pages, a service of GitHub Inc. (USA, a subsidiary of Microsoft Corporation). When you open the site, GitHub processes technically necessary connection data (in particular IP address, time, requested file, browser identifier) in server logs to deliver the site and keep the service secure. Data is thereby disclosed to the USA. For companies certified under the Swiss-US and EU-US Data Privacy Frameworks the USA is considered to provide adequate protection (Art. 16 FADP, Art. 45 GDPR); GitHub/Microsoft states that it participates in these frameworks. More information: '}
      <a href="https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer">GitHub Privacy Statement</a>.
      {de ? ' Für Personen in der EU stützt sich diese Bearbeitung auf berechtigte Interessen (Art. 6 Abs. 1 lit. f DSGVO).' : ' For persons in the EU this processing is based on legitimate interests (Art. 6(1)(f) GDPR).'}
    </p>

    <h2>4. {de ? 'Lokale Speicherung im Browser' : 'Local storage in your browser'}</h2>
    <p>
      {de
        ? 'Dein Spielgeld-Guthaben, Statistiken, Bestzeiten und Einstellungen (Sprache, Design, Sound, Bots, Spielername) werden im lokalen Speicher (localStorage) deines Browsers abgelegt; im Sitzungsspeicher (sessionStorage) wird vermerkt, dass du in dieser Sitzung bereits nach deinem Namen gefragt wurdest. Diese Daten werden nicht an den Betreiber oder an Dritte übertragen und dienen ausschliesslich der von dir gewünschten Funktion. Du kannst sie jederzeit über die Browser-Einstellungen oder über «Konto zurücksetzen» löschen. Für Nutzer in der EU ist die Speicherung für den ausdrücklich gewünschten Dienst unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG bzw. Art. 5 Abs. 3 ePrivacy-Richtlinie).'
        : 'Your play-money balance, statistics, best times and settings (language, theme, sound, bots, player name) are kept in your browser\'s local storage; session storage notes that you were already asked for your name in this session. This data is not transmitted to the operator or to third parties and serves only the function you requested. You can delete it at any time via your browser settings or via "Reset account". For users in the EU this storage is strictly necessary for the service explicitly requested (§ 25(2) no. 2 TDDDG / Art. 5(3) ePrivacy Directive).'}
    </p>

    <h2>5. {de ? 'Schriftarten' : 'Fonts'}</h2>
    <p>
      {de
        ? 'Alle Schriftarten (Geist, Geist Mono, Instrument Serif) sind lokal eingebunden. Es wird keine Verbindung zu Google oder anderen Schriftanbietern hergestellt.'
        : 'All fonts (Geist, Geist Mono, Instrument Serif) are self-hosted. No connection to Google or other font providers is made.'}
    </p>

    <h2>6. {de ? 'Mehrspieler-Funktion (optional)' : 'Multiplayer (optional)'}</h2>
    <p>
      {de
        ? 'Nur wenn du aktiv einen Raum öffnest oder einem Raum beitrittst, wird eine direkte Peer-to-Peer-Verbindung (WebRTC) zwischen den Browsern der Mitspielenden aufgebaut. Dazu wird die Open-Source-Bibliothek PeerJS verwendet. Für den Verbindungsaufbau werden deine IP-Adresse und eine zufällige Verbindungs-ID an den Vermittlungsserver der PeerJS-Cloud (0.peerjs.com) sowie an STUN/TURN-Server (Google, stun.l.google.com, und PeerJS, *.turn.peerjs.com) übermittelt; diese können sich im Ausland, insbesondere in den USA, befinden. Kann keine direkte Verbindung hergestellt werden, werden die Spieldaten verschlüsselt über einen TURN-Server weitergeleitet. Über die Verbindung werden dein Spielername sowie Spielaktionen und Einsätze in Spielgeld an die anderen Personen im Raum übertragen; technisch bedingt können die Mitspielenden dabei deine IP-Adresse erfahren. Die Bekanntgabe erfolgt, weil du die Funktion ausdrücklich nutzt (für Personen in der EU: Art. 6 Abs. 1 lit. b DSGVO). Wenn du das nicht möchtest, spiele am Solo-Tisch; dann findet keine dieser Übermittlungen statt.'
        : 'Only if you actively open or join a room, a direct peer-to-peer connection (WebRTC) is established between the players\' browsers, using the open-source library PeerJS. To set up the connection, your IP address and a random connection ID are sent to the PeerJS cloud signalling server (0.peerjs.com) and to STUN/TURN servers (Google, stun.l.google.com, and PeerJS, *.turn.peerjs.com), which may be located abroad, in particular in the USA. If no direct connection is possible, game data is relayed in encrypted form through a TURN server. Your player name, game actions and play-money bets are shared with the other people in the room; for technical reasons other players may learn your IP address. This disclosure happens because you explicitly use the feature (for persons in the EU: Art. 6(1)(b) GDPR). If you do not want this, play at the solo table; none of these transfers happen then.'}
    </p>

    <h2>7. {de ? 'Deine Rechte' : 'Your rights'}</h2>
    <p>
      {de
        ? 'Nach dem DSG hast du insbesondere das Recht auf Auskunft (Art. 25), auf Herausgabe oder Übertragung deiner Daten (Art. 28) sowie auf Berichtigung und Löschung (Art. 32). Du kannst dich an den Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten (EDÖB, www.edoeb.admin.ch) wenden. Personen in der EU stehen zusätzlich die Rechte nach Art. 15–21 DSGVO und ein Beschwerderecht bei einer Aufsichtsbehörde (Art. 77 DSGVO) zu. Da der Betreiber selbst keine Personendaten speichert, wende dich für Daten in Server-Logfiles bitte zusätzlich an GitHub.'
        : 'Under the FADP you have in particular the right of access (Art. 25), to receive or transfer your data (Art. 28) and to rectification and erasure (Art. 32). You may contact the Federal Data Protection and Information Commissioner (FDPIC, www.edoeb.admin.ch). Persons in the EU additionally have the rights under Art. 15–21 GDPR and may lodge a complaint with a supervisory authority (Art. 77 GDPR). As the operator does not store any personal data, please also contact GitHub regarding server log data.'}
    </p>

    <h2>8. {de ? 'Keine automatisierten Einzelentscheidungen' : 'No automated decisions'}</h2>
    <p>{de ? 'Es finden keine automatisierten Einzelentscheidungen und kein Profiling statt (Art. 21 DSG, Art. 22 DSGVO).' : 'There are no automated individual decisions and no profiling (Art. 21 FADP, Art. 22 GDPR).'}</p>
  {:else}
    <h1>{de ? 'Haftungsausschluss & Distanzierung' : 'Disclaimer & dissociation'}</h1>

    <h2>1. {de ? 'Kein Geldspiel, nur Spielgeld' : 'No gambling, play money only'}</h2>
    <p>
      {de
        ? 'Betly ist eine kostenlose Casino- und Arcade-Simulation ausschliesslich zur Unterhaltung. Alle Spiele werden mit simulierten Credits gespielt. Diese haben keinen Geldwert, können weder gekauft, verkauft, übertragen noch ausgezahlt werden und berechtigen zu keinem Gewinn, keiner Prämie und keinem anderen geldwerten Vorteil. Es wird zu keinem Zeitpunkt ein Einsatz in Geld verlangt. Damit liegt kein Geldspiel im Sinne von Art. 3 lit. a des Bundesgesetzes über Geldspiele (Geldspielgesetz, BGS) vor, und es ist keine Bewilligung oder Konzession nach dem BGS erforderlich. Ergänzend für die EU: Es handelt sich auch nicht um ein Glücksspiel im Sinne von § 3 Abs. 1 des deutschen Glücksspielstaatsvertrags 2021.'
        : 'Betly is a free casino and arcade simulation for entertainment only. All games use simulated credits. They have no monetary value, cannot be bought, sold, transferred or cashed out, and entitle to no prize, reward or other monetary advantage. No stake in money is ever required. It is therefore not a money game within the meaning of Art. 3(a) of the Swiss Federal Act on Gambling (Money Gaming Act, BGS), and no licence or concession under that act is required. In addition for the EU: it is not gambling within the meaning of § 3(1) of the German Interstate Treaty on Gambling 2021 either.'}
    </p>

    <h2>2. {de ? 'Distanzierung von Echtgeld-Geldspielen' : 'Dissociation from real-money gambling'}</h2>
    <p>
      {de
        ? 'Wir distanzieren uns ausdrücklich von unbewilligten Geldspielen und bewerben weder Echtgeld-Geldspiele noch deren Anbieter. In der Schweiz dürfen Online-Spielbankenspiele nur von konzessionierten Spielbanken angeboten werden; unbewilligte Angebote werden gesperrt. Betly steht in keiner Verbindung zu Spielbanken, Lotterie- oder Wettanbietern und erhält von solchen keine Vergütung. Ergebnisse und Strategien in der Simulation (zum Beispiel Strategie-Tipps beim Blackjack) lassen keine Rückschlüsse auf reale Spiele zu; Spiele mit Hausvorteil führen auf Dauer zu Verlusten.'
        : 'We expressly dissociate ourselves from unlicensed gambling and promote neither real-money gambling nor its operators. In Switzerland online casino games may only be offered by licensed casinos; unlicensed offers are blocked. Betly is not affiliated with casinos, lottery or betting operators and receives no compensation from them. Results and strategies in the simulation (for example blackjack strategy hints) allow no conclusions about real games; games with a house edge lose money in the long run.'}
    </p>

    <h2>3. {de ? 'Jugend- und Spielerschutz' : 'Youth and player protection'}</h2>
    <p>
      {de
        ? 'Das Angebot richtet sich an Erwachsene; wir empfehlen die Nutzung ab 18 Jahren. Auch simulierte Geldspiele können problematisches Spielverhalten begünstigen. Hilfe erhältst du kostenlos und anonym:'
        : 'This service is intended for adults; we recommend use from age 18. Even simulated gambling can encourage problematic behaviour. Free and anonymous help:'}
    </p>
    <ul>
      <li>{de ? 'Schweiz' : 'Switzerland'}: SOS Spielsucht, <a href="https://www.sos-spielsucht.ch" target="_blank" rel="noopener noreferrer">sos-spielsucht.ch</a>, 0800 040 080 · Sucht Schweiz, <a href="https://www.suchtschweiz.ch" target="_blank" rel="noopener noreferrer">suchtschweiz.ch</a></li>
      <li>{de ? 'Deutschland' : 'Germany'}: BZgA, <a href="https://www.check-dein-spiel.de" target="_blank" rel="noopener noreferrer">check-dein-spiel.de</a>, 0800 1 37 27 00</li>
    </ul>

    <h2>4. {de ? 'Haftung für Inhalte' : 'Liability for content'}</h2>
    <p>
      {de
        ? 'Die Inhalte wurden mit grösster Sorgfalt erstellt, für Richtigkeit, Vollständigkeit und Aktualität wird jedoch keine Gewähr übernommen. Die Haftung für Schäden aus der Nutzung des kostenlosen Angebots wird ausgeschlossen, soweit dies gesetzlich zulässig ist (insbesondere nicht für rechtswidrige Absicht oder grobe Fahrlässigkeit, Art. 100 OR). Es besteht kein Anspruch auf Verfügbarkeit des Angebots oder auf Erhalt eines Spielgeld-Guthabens; Spielstände können etwa durch das Löschen der Browserdaten verloren gehen.'
        : 'The content was created with great care, but no guarantee is given for accuracy, completeness or timeliness. Liability for damages arising from the use of this free service is excluded to the extent permitted by law (in particular not for unlawful intent or gross negligence, Art. 100 of the Swiss Code of Obligations). There is no entitlement to availability of the service or to keeping a play-money balance; progress can be lost, for example by clearing browser data.'}
    </p>

    <h2>5. {de ? 'Haftung für Links' : 'Liability for links'}</h2>
    <p>
      {de
        ? 'Dieses Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Für diese Inhalte ist stets der jeweilige Anbieter verantwortlich. Zum Zeitpunkt der Verlinkung waren keine Rechtsverletzungen erkennbar. Wir distanzieren uns ausdrücklich von allen Inhalten verlinkter Seiten, die nach der Verlinkung verändert wurden, und entfernen solche Links umgehend, sobald uns Rechtsverletzungen bekannt werden.'
        : 'This service contains links to external third-party websites whose content we cannot influence. The respective provider is always responsible for such content. No infringements were apparent at the time of linking. We expressly dissociate ourselves from any content of linked pages that was changed after linking and remove such links immediately once we become aware of infringements.'}
    </p>

    <h2>6. {de ? 'Urheberrecht' : 'Copyright'}</h2>
    <p>
      {de
        ? 'Die durch den Betreiber erstellten Inhalte unterliegen dem schweizerischen Urheberrechtsgesetz (URG). Der Quellcode steht unter der im Repository angegebenen Lizenz, die Schriftarten unter der SIL Open Font License. Spielnamen wie Roulette, Blackjack, Baccarat oder Poker bezeichnen allgemein bekannte Spiele; alle Grafiken und Klänge sind eigene Gestaltungen.'
        : 'Content created by the operator is protected by the Swiss Copyright Act. The source code is licensed as stated in the repository, the fonts under the SIL Open Font License. Game names such as roulette, blackjack, baccarat or poker refer to commonly known games; all graphics and sounds are original.'}
    </p>

    <h2>7. {de ? 'Anwendbares Recht' : 'Applicable law'}</h2>
    <p>
      {de
        ? 'Es gilt Schweizer Recht. Zwingende Bestimmungen zum Schutz von Verbraucherinnen und Verbrauchern in ihrem Wohnsitzstaat, etwa in der EU, bleiben vorbehalten.'
        : 'Swiss law applies. Mandatory consumer protection provisions of the user\'s country of residence, for example in the EU, remain reserved.'}
    </p>
  {/if}
</article>

<style>
  .legal { max-width: 760px; padding: 48px 0 100px; }
  h1 { font-size: clamp(2.2rem, 5vw, 3.6rem); letter-spacing: -0.04em; line-height: 1; margin: 0 0 28px; }
  h2 { font-size: 1.05rem; margin: 32px 0 8px; letter-spacing: -0.01em; }
  p, li { color: color-mix(in srgb, var(--text) 82%, transparent); margin: 0 0 12px; }
  ul { padding-left: 20px; margin: 0 0 12px; }
  .muted { color: var(--muted); }
  .note { font-size: 0.85rem; color: var(--muted); border: 1px solid var(--line-2); border-radius: 12px; padding: 10px 14px; }
</style>
