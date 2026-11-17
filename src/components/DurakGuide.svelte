<script lang="ts">
  // Durak rules with little looping card animations, in German, English and Russian.
  // With `story` it shows the hidden tale instead (the easter egg behind the jester's cap).
  import JassCard from './JassCard.svelte';
  import type { Deck } from '../games/jass';
  import type { DLang } from '../lib/durakText';
  let { lang, deck, story = false, onclose }: { lang: DLang; deck: Deck; story?: boolean; onclose: () => void } = $props();
  const L = (de: string, en: string, ru: string) => (lang === 'de' ? de : lang === 'en' ? en : ru);
  let dlg: HTMLDialogElement;
  $effect(() => { dlg.showModal(); });
  const B = { s: 0, r: 0 };
  type Scene = 'goal' | 'cards' | 'attack' | 'defend' | 'throw' | 'take' | 'bito' | 'transfer' | 'end';
  const STEPS: { k: Scene; h: [string, string, string]; p: [string, string, string] }[] = [
    { k: 'goal', h: ['Ziel', 'Goal', 'Цель'], p: [
      'Werde alle Karten los. Es gibt keinen Sieger im eigentlichen Sinn: Wer zuletzt noch Karten auf der Hand hat, ist der Durak, der Dummkopf. Alle anderen gewinnen.',
      'Get rid of all your cards. There is no real winner: whoever is last with cards in hand is the durak, the fool. Everyone else wins.',
      'Избавься от всех карт. Победителя в обычном смысле нет: кто последним останется с картами, тот дурак. Все остальные выиграли.'] },
    { k: 'cards', h: ['Karten und Trumpf', 'Cards and trump', 'Карты и козырь'], p: [
      '36 Karten von der 6 bis zum Ass. Jeder bekommt 6 Karten. Die nächste Karte liegt offen quer unter dem Stapel: Ihre Farbe ist Trumpf, und sie wird als letzte gezogen. Den ersten Angriff macht, wer den kleinsten Trumpf hat.',
      '36 cards from 6 to ace. Everyone gets 6. The next card lies face up across the bottom of the pack: its suit is trump and it is drawn last. Whoever holds the lowest trump attacks first.',
      '36 карт от шестёрки до туза. Каждому по 6 карт. Следующую карту кладут открыто поперёк под колоду: её масть — козырь, её берут последней. Первым ходит тот, у кого младший козырь.'] },
    { k: 'attack', h: ['Angriff', 'Attack', 'Атака'], p: [
      'Der Angreifer legt seinem linken Nachbarn, dem Verteidiger, eine Karte hin. Mehrere Karten gleichen Werts darfst du auch nacheinander legen.',
      'The attacker plays a card to the player on their left, the defender. Several cards of the same rank may follow one after the other.',
      'Нападающий ходит под соседа слева — отбивающегося. Можно положить и несколько карт одного достоинства.'] },
    { k: 'defend', h: ['Verteidigen', 'Defending', 'Защита'], p: [
      'Der Verteidiger deckt jede Karte mit einer höheren der gleichen Farbe – oder mit einem Trumpf. Ein Trumpf lässt sich nur mit einem höheren Trumpf schlagen.',
      'The defender covers each card with a higher one of the same suit — or with a trump. A trump can only be beaten by a higher trump.',
      'Отбивающийся кроет каждую карту старшей той же масти — или козырем. Козырь бьётся только старшим козырем.'] },
    { k: 'throw', h: ['Dazugeben', 'Throwing in', 'Подкидывание'], p: [
      'Solange der Verteidiger kämpft, dürfen der Angreifer und der Spieler links vom Verteidiger Karten dazugeben – aber nur Werte, die schon auf dem Tisch liegen. Höchstens 5 Karten bis zum ersten Bito, danach 6, und nie mehr, als der Verteidiger in der Hand hat.',
      'While the defender is fighting, the attacker and the player to the defender’s left may throw in more cards — only ranks already on the table. At most 5 cards until the first discard, 6 after that, and never more than the defender holds.',
      'Пока идёт отбой, нападающий и сосед слева от отбивающегося могут подкидывать карты — только тех достоинств, что уже лежат на столе. До первого «бито» не больше 5 карт, потом 6, и никогда больше, чем карт у отбивающегося.'] },
    { k: 'take', h: ['Nehmen', 'Taking', 'Взять'], p: [
      'Kann oder will der Verteidiger nicht schlagen, nimmt er alle Karten vom Tisch auf. Die Angreifer dürfen vorher noch passende Karten nachwerfen. Wer genommen hat, setzt den nächsten Angriff aus.',
      'If the defender cannot or will not beat the cards, they pick up everything on the table. The attackers may still throw in matching cards first. Whoever took skips the next attack.',
      'Если отбиться нельзя или не хочется, отбивающийся забирает все карты со стола. Перед этим нападающие ещё могут подкинуть подходящие. Взявший пропускает следующий ход.'] },
    { k: 'bito', h: ['Bito und Nachziehen', 'Discard and drawing', 'Бито и добор'], p: [
      'Ist alles gedeckt und niemand gibt mehr dazu, kommen die Karten weg: Bito! Dann ziehen alle auf 6 Karten nach – zuerst der Angreifer, der Verteidiger zuletzt. Der Verteidiger greift als Nächster an.',
      'Once everything is covered and nobody adds more, the cards are discarded: “bito”! Everyone draws back up to 6 — the attacker first, the defender last. The defender attacks next.',
      'Когда всё покрыто и подкидывать больше нечего — бито! Все добирают до 6 карт: сначала нападающий, отбивающийся последним. Следующим ходит отбившийся.'] },
    { k: 'transfer', h: ['Schieben (Variante)', 'Passing on (variant)', 'Переводной (вариант)'], p: [
      'Bevor er etwas schlägt, darf der Verteidiger eine Karte gleichen Werts dazulegen und den ganzen Angriff an den nächsten Spieler weiterschieben – wenn dieser genug Karten hat.',
      'Before beating anything, the defender may add a card of the same rank and pass the whole attack on to the next player — if that player holds enough cards.',
      'Пока ничего не побито, отбивающийся может подложить карту того же достоинства и перевести всю атаку на следующего — если у того хватает карт.'] },
    { k: 'end', h: ['Ende', 'The end', 'Конец игры'], p: [
      'Ist der Stapel leer, wird ohne Nachziehen weitergespielt; wer keine Karten mehr hat, ist raus. Der Letzte ist der Durak. Hier zahlt jeder, der nicht Durak wird, seinen Einsatz mit Gewinn aus. Wer zum Schluss Sechser aufnehmen musste, ist sogar ein «Durak mit Schulterstücken».',
      'When the pack is empty you play on without drawing; whoever runs out of cards is out. The last one is the durak. Here everyone who is not the durak gets their stake back with a profit. A durak who had to pick up sixes at the end even earns “epaulettes”.',
      'Когда колода кончилась, играют без добора; у кого кончились карты, тот вышел. Последний — дурак. Здесь каждый, кто не остался дураком, получает ставку с выигрышем. А если дураку под конец пришлось взять шестёрки — он «дурак с погонами».'] },
  ];
  // an original little tale, hidden behind the jester's cap
  const STORY: [string, string, string] = [
    `Winter 1893, eine Poststation an der Strasse nach Twer. Der Schneesturm hielt alle fest: einen Kutscher, eine Lehrerin, einen jungen Leutnant und Großmutter Agafja, die den Samowar hütete.\n\nDer Leutnant zog ein abgegriffenes Kartenspiel hervor. «Durak», sagte er, «und wer verliert, trägt bis zum Morgen die Mütze mit den Schellen.» Er war sich seiner Sache sehr sicher.\n\nAgafja spielte langsam, als hätte sie nie gelernt zu rechnen. Sie nahm, wo andere schlugen, sie schob, wo andere nahmen, und sie lächelte, wenn der Leutnant seine Trümpfe auf den Tisch knallte. Kurz vor dem Morgengrauen hatte er noch drei Karten. Es waren Sechser.\n\n«Mit Schulterstücken», sagte Agafja freundlich und legte ihm die Mütze auf. Draussen wurde es still. Der Kutscher schwor später, er habe die Alte nie wieder verlieren sehen – und der Leutnant spielte nie wieder um eine Mütze.`,
    `Winter 1893, a post station on the road to Tver. The blizzard kept them all there: a coachman, a schoolteacher, a young lieutenant and old Agafya, who watched over the samovar.\n\nThe lieutenant pulled out a worn deck. “Durak,” he said, “and the loser wears the cap with the bells until morning.” He was very sure of himself.\n\nAgafya played slowly, as if she had never learned to count. She took where others beat, passed on where others took, and smiled whenever the lieutenant slammed his trumps on the table. Just before dawn he was left with three cards. They were sixes.\n\n“With epaulettes,” Agafya said kindly, and put the cap on his head. Outside, the storm went quiet. The coachman later swore he never saw the old woman lose again — and the lieutenant never again played for a cap.`,
    `Зима 1893 года, почтовая станция на дороге в Тверь. Метель задержала всех: ямщика, учительницу, молодого поручика и бабку Агафью, что смотрела за самоваром.\n\nПоручик достал потрёпанную колоду. «В дурака, — сказал он, — и кто проиграет, до утра носит колпак с бубенцами». Он был очень в себе уверен.\n\nАгафья играла медленно, будто и считать не умела. Брала, где другие били, переводила, где другие брали, и улыбалась, когда поручик хлопал козырями по столу. Перед самым рассветом у него осталось три карты. Это были шестёрки.\n\n«С погонами», — ласково сказала Агафья и надела на него колпак. За окном стих буран. Ямщик потом божился, что больше никогда не видел, чтобы старуха проигрывала, — а поручик больше никогда не играл на колпак.`,
  ];
  let step = $state(0);
  const S = $derived(STEPS[step]);
  const H = (s: number, r: number) => ({ s, r });
</script>

<dialog bind:this={dlg} onclose={onclose} onclick={(e) => e.target === dlg && dlg.close()}>
  <div class="dlg">
    <header>
      <h2>{story ? L('Die Mütze mit den Schellen', 'The cap with the bells', 'Колпак с бубенцами') : L('So spielt man Durak', 'How to play Durak', 'Как играть в дурака')}</h2>
      <button class="btn icon sm ghost" onclick={() => dlg.close()} aria-label="close">×</button>
    </header>
    {#if story}
      <div class="story">{#each STORY[lang === 'de' ? 0 : lang === 'en' ? 1 : 2].split('\n\n') as para}<p>{para}</p>{/each}</div>
      <p class="egg">🃏 {L('Du hast das Easter Egg gefunden.', 'You found the easter egg.', 'Ты нашёл пасхалку.')}</p>
    {:else}
      <nav class="dots">{#each STEPS as s, i}<button class:on={i === step} onclick={() => (step = i)} aria-label={s.h[0]}></button>{/each}</nav>
      {#key step}
        <div class="scene {S.k}" style="--cw: 58px">
          {#if S.k === 'goal'}
            <div class="fan">{#each [H(0, 14), H(1, 12), H(2, 9), H(3, 7), H(0, 6)] as c, i}<div class="f" style="--i:{i}"><JassCard card={c} {deck} /></div>{/each}</div>
            <div class="gone">{#each [0, 1, 2] as i}<div class="g" style="--i:{i}"><JassCard card={B} {deck} down /></div>{/each}</div>
          {:else if S.k === 'cards'}
            <div class="ranks">{#each [6, 7, 8, 9, 10, 11, 12, 13, 14] as r, i}<div class="rk" style="--i:{i}"><JassCard card={H(0, r)} {deck} /></div>{/each}</div>
            <div class="trump"><div class="tc"><JassCard card={H(3, 8)} {deck} /></div><div class="pk"><JassCard card={B} {deck} down /></div><span class="lbl">{L('Trumpf', 'Trump', 'Козырь')}</span></div>
          {:else if S.k === 'attack'}
            <div class="a1"><JassCard card={H(1, 9)} {deck} /></div>
          {:else if S.k === 'defend'}
            <div class="row">
              <div class="pair"><JassCard card={H(1, 9)} {deck} /><div class="cov c1"><JassCard card={H(1, 12)} {deck} /></div></div>
              <div class="pair"><JassCard card={H(2, 14)} {deck} /><div class="cov c2"><JassCard card={H(3, 6)} {deck} /></div><span class="lbl">{L('Trumpf', 'Trump', 'Козырь')}</span></div>
            </div>
          {:else if S.k === 'throw'}
            <div class="row"><div class="pair"><JassCard card={H(1, 9)} {deck} /><div class="cov"><JassCard card={H(1, 12)} {deck} /></div></div><div class="pair th"><JassCard card={H(0, 9)} {deck} /></div><div class="pair th2"><JassCard card={H(2, 12)} {deck} /></div></div>
          {:else if S.k === 'take'}
            <div class="row tk"><div class="pair"><JassCard card={H(1, 9)} {deck} /><div class="cov"><JassCard card={H(1, 12)} {deck} /></div></div><div class="pair"><JassCard card={H(0, 13)} {deck} /></div></div>
          {:else if S.k === 'bito'}
            <div class="row bt"><div class="pair"><JassCard card={H(1, 9)} {deck} /><div class="cov"><JassCard card={H(1, 12)} {deck} /></div></div><div class="pair"><JassCard card={H(0, 7)} {deck} /><div class="cov"><JassCard card={H(0, 10)} {deck} /></div></div></div>
            <div class="draw">{#each [0, 1] as i}<div class="dr" style="--i:{i}"><JassCard card={B} {deck} down /></div>{/each}</div>
          {:else if S.k === 'transfer'}
            <div class="row tr"><div class="pair"><JassCard card={H(1, 9)} {deck} /></div><div class="pair add"><JassCard card={H(2, 9)} {deck} /></div><span class="arrow">→</span></div>
          {:else}
            <div class="fool"><div class="last"><JassCard card={H(0, 6)} {deck} /></div><div class="last l2"><JassCard card={H(2, 6)} {deck} /></div>
              <svg class="hat" viewBox="0 0 48 40" width="60" height="50" aria-hidden="true"><path d="M4 34 C6 20 14 10 24 8 C34 10 42 20 44 34Z" fill="#c8102e" /><path d="M24 8 C18 12 10 14 4 10 C10 20 16 26 18 34" fill="#f2c33a" /><path d="M24 8 C30 12 38 14 44 10 C38 20 32 26 30 34" fill="#1f5fbf" /><circle cx="4" cy="10" r="3.4" fill="#fff" /><circle cx="44" cy="10" r="3.4" fill="#fff" /><circle cx="24" cy="6" r="3.4" fill="#fff" /><rect x="2" y="32" width="44" height="6" rx="3" fill="#2a2a32" /></svg>
            </div>
          {/if}
        </div>
      {/key}
      <h3>{step + 1}. {S.h[lang === 'de' ? 0 : lang === 'en' ? 1 : 2]}</h3>
      <p class="txt">{S.p[lang === 'de' ? 0 : lang === 'en' ? 1 : 2]}</p>
      <div class="nav">
        <button class="btn sm" disabled={step === 0} onclick={() => step--}>← {L('Zurück', 'Back', 'Назад')}</button>
        {#if step < STEPS.length - 1}<button class="btn sm primary" onclick={() => step++}>{L('Weiter', 'Next', 'Далее')} →</button>
        {:else}<button class="btn sm primary" onclick={() => dlg.close()}>{L('Los geht’s', 'Let’s play', 'Играем')}</button>{/if}
      </div>
    {/if}
  </div>
</dialog>

<style>
  dialog { max-width: min(560px, calc(100vw - 24px)); }
  .dlg { display: grid; gap: 12px; padding: 22px; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  h2 { margin: 0; font-size: 1.4rem; letter-spacing: -0.02em; }
  h3 { margin: 4px 0 0; }
  .txt { margin: 0; line-height: 1.55; min-height: 5.5em; }
  .dots { display: flex; gap: 6px; justify-content: center; }
  .dots button { width: 9px; height: 9px; padding: 0; border-radius: 50%; border: 0; background: var(--line-2); }
  .dots button.on { background: var(--accent); width: 22px; border-radius: 999px; }
  .nav { display: flex; justify-content: space-between; }
  .story p { margin: 0 0 12px; line-height: 1.6; font-family: 'Instrument Serif', Georgia, serif; font-size: 1.12rem; }
  .egg { margin: 0; font-size: 0.8rem; color: var(--muted); }

  /* little stage: green felt, everything loops every 4 s */
  .scene { position: relative; height: 170px; border-radius: 18px; overflow: hidden; background: radial-gradient(ellipse at 50% 40%, #2d6a4a, #173a2a 80%); display: grid; place-items: center; }
  .scene :global(.card) { box-shadow: 0 6px 14px rgba(0,0,0,.35); }
  .lbl { position: absolute; bottom: -34px; left: 50%; translate: -50% 0; font-size: 0.72rem; color: #f2c33a; white-space: nowrap; }
  .row { display: flex; gap: 26px; align-items: center; }
  .pair { position: relative; }
  .cov { position: absolute; left: 30%; top: 22%; rotate: 8deg; animation: cover 4s infinite; }
  .c2 { animation-delay: 0.5s; }
  @keyframes cover { 0%, 15% { transform: translate(0, 140px); opacity: 0; } 35%, 100% { transform: none; opacity: 1; } }
  .fan { display: flex; }
  .f { margin-left: -24px; rotate: calc((var(--i) - 2) * 9deg); transform-origin: 50% 120%; animation: fan 4s infinite; animation-delay: calc(var(--i) * 0.12s); }
  .f:first-child { margin-left: 0; }
  @keyframes fan { 0%, 40% { transform: none; opacity: 1; } 60%, 80% { transform: translate(140px, -90px) rotate(30deg); opacity: 0; } 100% { opacity: 0; } }
  .gone { position: absolute; right: 30px; top: 30px; --cw: 34px; }
  .g { position: absolute; rotate: calc(var(--i) * 14deg - 10deg); }
  .ranks { display: flex; --cw: 40px; }
  .rk { margin-left: -14px; animation: rise 4s infinite; animation-delay: calc(var(--i) * 0.15s); }
  .rk:first-child { margin-left: 0; }
  @keyframes rise { 0%, 100% { transform: none; } 20% { transform: translateY(-10px); } 40% { transform: none; } }
  .trump { position: absolute; right: 24px; top: 40px; --cw: 44px; width: 70px; height: 70px; }
  .trump .tc { position: absolute; left: 18px; rotate: 90deg; animation: glow 2s infinite alternate; }
  .trump .pk { position: absolute; left: 0; }
  @keyframes glow { to { filter: drop-shadow(0 0 8px #f2c33a); } }
  .ranks + .trump { display: block; }
  .scene.cards { place-items: center start; padding-left: 20px; }
  .a1 { animation: attack 4s infinite; }
  @keyframes attack { 0%, 10% { transform: translate(-60px, 140px) rotate(-20deg); opacity: 0; } 35%, 100% { transform: none; opacity: 1; } }
  .th { animation: attack 4s infinite; animation-delay: 0.8s; }
  .th2 { animation: attack 4s infinite; animation-delay: 1.5s; }
  .tk { animation: take 4s infinite; }
  @keyframes take { 0%, 45% { transform: none; opacity: 1; } 75%, 100% { transform: translateY(160px) scale(0.6); opacity: 0; } }
  .bt { animation: bito 4s infinite; }
  @keyframes bito { 0%, 40% { transform: none; opacity: 1; } 70%, 100% { transform: translateX(260px) rotate(25deg); opacity: 0; } }
  .draw { position: absolute; left: 30px; top: 40px; --cw: 38px; }
  .dr { position: absolute; animation: draw 4s infinite; animation-delay: calc(1.6s + var(--i) * 0.3s); opacity: 0; }
  @keyframes draw { 0% { transform: none; opacity: 0; } 10% { opacity: 1; } 50%, 100% { transform: translate(120px, 140px); opacity: 0; } }
  .add { animation: attack 4s infinite; animation-delay: 0.6s; }
  .tr .arrow { font-size: 2.2rem; color: #f2c33a; animation: push 4s infinite; }
  @keyframes push { 0%, 50% { transform: none; opacity: 0.2; } 75% { transform: translateX(16px); opacity: 1; } 100% { opacity: 0.2; } }
  .fool { position: relative; display: flex; gap: 10px; }
  .last { rotate: -8deg; } .l2 { rotate: 10deg; }
  .hat { position: absolute; left: 50%; top: -40px; translate: -50% 0; animation: hat 4s infinite; }
  @keyframes hat { 0%, 20% { transform: translateY(-120px) rotate(-30deg); } 50%, 100% { transform: none; } }
  @media (prefers-reduced-motion: reduce) { .scene * { animation: none !important; opacity: 1 !important; } }
</style>
