<script lang="ts">
  // Hütchenspiel: the ball is shown under a cup, the cups cross each other, then you pick one.
  // Every move is a crossing where two cups meet on the same spot, so the shuffle is honest but untrackable
  // (see cupsPlan): the chance is exactly 1 in n and the payout n × 0.97.
  import ArcadeLayout from '../components/ArcadeLayout.svelte';
  import BetInput from '../components/BetInput.svelte';
  import { cupsMult, cupsPlan } from '../games/arcade';
  import { wallet, settle, stake, fmt, settings } from '../lib/state.svelte';
  import { gameName, byId } from '../lib/games';
  import { sfx } from '../lib/sfx';

  const L = (de: string, en: string) => (settings.lang === 'de' ? de : en);
  let bet = $state(10);
  let n = $state(3);
  let speed = $state<'slow' | 'normal' | 'fast'>('normal');
  // slot of every cup (cup ids are stable, so each cup element keeps its identity while it moves)
  let slotOf = $state([0, 1, 2]);
  let lifted = $state<boolean[]>([true, true, true]);
  let ballCup = $state(1);
  let phase = $state<'idle' | 'mix' | 'pick' | 'done'>('idle');
  let picked = $state(-1);
  let last = $state<{ win: number } | null>(null);
  let history = $state<{ win: boolean; id: number }[]>([]);
  // cups that are moving: their x position (in slot units) while they travel, and whether they ride on top
  let at = $state<(number | null)[]>([null, null, null]);
  let dur = $state(0);
  const mult = $derived(cupsMult(n));
  const ms = $derived({ slow: 420, normal: 300, fast: 200 }[speed]);
  const wait = (t: number) => new Promise((r) => setTimeout(r, t));

  function setup(k: number) {
    if (phase === 'mix' || phase === 'pick') return;
    n = k;
    slotOf = Array.from({ length: k }, (_, i) => i);
    lifted = Array(k).fill(true);
    at = Array(k).fill(null);
    ballCup = Math.floor(k / 2);
    phase = 'idle'; picked = -1; last = null;
  }

  async function play() {
    if (phase === 'mix' || phase === 'pick' || bet <= 0 || bet > wallet.balance) return;
    stake(bet);
    last = null; picked = -1;
    const fast = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // fresh layout, the ball under a random cup, shown for a moment
    slotOf = Array.from({ length: n }, (_, i) => i);
    ballCup = Math.floor(Math.random() * n);
    lifted = Array(n).fill(false);
    lifted[ballCup] = true;
    phase = 'mix';
    sfx('click');
    await wait(fast ? 200 : 900);
    lifted = Array(n).fill(false);
    sfx('chip');
    await wait(fast ? 100 : 450);
    const plan = cupsPlan(n, slotOf[ballCup], 6 + n * 2);
    for (let k = 0; k < plan.moves.length; k++) {
      const [i, j] = plan.moves[k];
      const a = slotOf.indexOf(i), b = slotOf.indexOf(j);
      const mid = (i + j) / 2;
      dur = fast ? 0 : ms;
      at[a] = mid; at[b] = mid; // both cups meet on exactly the same spot
      sfx('tick');
      await wait(dur + 10);
      if (plan.swaps[k]) { slotOf[a] = j; slotOf[b] = i; }
      at[a] = null; at[b] = null;
      await wait(dur + 10);
    }
    dur = 0;
    phase = 'pick';
  }

  async function pick(cup: number) {
    if (phase !== 'pick') return;
    phase = 'done';
    picked = cup;
    lifted[cup] = true;
    const win = cup === ballCup ? Math.round(bet * mult * 100) / 100 : 0;
    settle(win, win);
    sfx(win ? 'win' : 'lose');
    last = { win };
    history = [{ win: win > 0, id: Date.now() }, ...history].slice(0, 16);
    await wait(600);
    lifted = lifted.map(() => true); // show where the ball was
  }
  // a cup's x position: travelling, or at its slot
  const xOf = (c: number) => at[c] ?? slotOf[c];
  function key(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); play(); }
    const d = Number(e.key);
    if (phase === 'pick' && d >= 1 && d <= n) pick(slotOf.indexOf(d - 1));
  }
</script>

<svelte:window onkeydown={key} />

<ArcadeLayout eyebrow={'Arcade · ' + L(`${n} Becher, 1 Kugel`, `${n} cups, 1 ball`)} title={gameName(byId('cups')!)}>
  {#snippet controls()}
    <button class="btn primary big" disabled={phase === 'mix' || phase === 'pick' || bet > wallet.balance} onclick={play}>
      {phase === 'pick' ? L('Wähle einen Becher', 'Pick a cup') : phase === 'mix' ? L('Mischen …', 'Shuffling …') : L('Mischen', 'Shuffle')}
    </button>
    <BetInput bind:value={bet} disabled={phase === 'mix' || phase === 'pick'} />
    <div class="field">{L('Becher', 'Cups')}
      <div class="seg">{#each [3, 4, 5] as k}<button class:on={n === k} disabled={phase === 'mix' || phase === 'pick'} onclick={() => setup(k)}>{k} · ×{cupsMult(k)}</button>{/each}</div>
    </div>
    <div class="field">{L('Tempo', 'Speed')}
      <div class="seg">{#each [['slow', L('Langsam', 'Slow')], ['normal', 'Normal'], ['fast', L('Schnell', 'Fast')]] as [s, label]}<button class:on={speed === s} disabled={phase === 'mix'} onclick={() => (speed = s as typeof speed)}>{label}</button>{/each}</div>
    </div>
    <p class="small muted">{L(`Schau, unter welchem Becher die Kugel liegt. Die Becher kreuzen sich; wo sie sich treffen, kann niemand sehen, ob sie getauscht haben. Triffst du die Kugel, gibt es ×${mult}.`, `Watch which cup hides the ball. The cups cross each other; where they meet nobody can tell whether they swapped. Find the ball and win ×${mult}.`)}</p>
  {/snippet}

  <div class="table" style="--n:{n}; --dur:{dur}ms">
    <div class="msg">
      {#if last}<span class="mono big2" class:pos={last.win > 0}>{last.win ? '+' + fmt(last.win) : L('Daneben', 'Missed')}</span>
      {:else if phase === 'pick'}<span class="serif">{L('Wo ist die Kugel?', 'Where is the ball?')}</span>
      {:else if phase === 'mix'}<span class="serif">{L('Gut aufpassen …', 'Watch closely …')}</span>
      {:else}<span class="serif">{L('Einsatz wählen und mischen', 'Choose a stake and shuffle')}</span>{/if}
    </div>
    <div class="row">
      {#each slotOf as _, c (c)}
        {@const moving = at[c] !== null}
        <button class="cup" class:up={lifted[c]} class:moving class:pickable={phase === 'pick'} class:chosen={picked === c}
          style="--x:{xOf(c)}" disabled={phase !== 'pick'} onclick={() => pick(c)} aria-label={L('Becher', 'Cup') + ' ' + (slotOf[c] + 1)}>
          {#if c === ballCup}<i class="ball" class:found={phase === 'done' && picked === c}></i>{/if}
          <svg class="shell" viewBox="0 0 100 110" aria-hidden="true">
            <defs>
              <linearGradient id="cupg{c}" x1="0" x2="1"><stop offset="0" stop-color="#5a0f1c" /><stop offset=".35" stop-color="#c8263a" /><stop offset=".6" stop-color="#9a1428" /><stop offset="1" stop-color="#3e0812" /></linearGradient>
              <linearGradient id="cupb{c}" x1="0" x2="1"><stop offset="0" stop-color="#7a5418" /><stop offset=".4" stop-color="#f6d88e" /><stop offset=".7" stop-color="#c39037" /><stop offset="1" stop-color="#5e3d0e" /></linearGradient>
            </defs>
            <path d="M30 8 Q50 2 70 8 L88 96 Q50 106 12 96 Z" fill="url(#cupg{c})" />
            <ellipse cx="50" cy="8" rx="20" ry="5" fill="#7a1222" />
            <path d="M24 34 Q50 40 76 34 L78 42 Q50 49 22 42 Z" fill="url(#cupb{c})" />
            <path d="M14 88 Q50 98 86 88 L88 97 Q50 108 12 97 Z" fill="url(#cupb{c})" />
            <path d="M36 14 Q32 50 24 86" stroke="#fff" stroke-opacity=".28" stroke-width="5" fill="none" stroke-linecap="round" />
          </svg>
          <span class="shadow"></span>
        </button>
      {/each}
    </div>
    <div class="hist">{#each history as h (h.id)}<span class:pos={h.win}>{h.win ? '●' : '○'}</span>{/each}</div>
  </div>
</ArcadeLayout>

<style>
  .big { min-height: 54px; width: 100%; font-size: 1rem; }
  .seg { display: flex; border: 1px solid var(--line-2); border-radius: 999px; padding: 3px; gap: 3px; }
  .seg button { flex: 1; border: 0; background: none; min-height: 36px; border-radius: 999px; color: var(--muted); font-size: 0.82rem; }
  .seg button.on { background: var(--text); color: var(--bg); }
  .small { font-size: 0.8rem; margin: 0; } .muted { color: var(--muted); }
  .pos { color: #6ff0a6; }
  .serif { font: 400 1.5rem 'Instrument Serif', Georgia, serif; }
  .big2 { font-size: 1.8rem; font-weight: 700; }

  /* walnut rail around burgundy velvet */
  .table {
    position: relative; display: grid; gap: 10px; padding: 22px clamp(12px, 3vw, 36px) 18px; border-radius: 32px; color: #f7ecd4; min-height: 420px;
    background:
      repeating-conic-gradient(from 45deg, rgba(255,255,255,.02) 0 25%, transparent 0 50%) 0 0 / 26px 26px,
      radial-gradient(ellipse at 50% 35%, #5a1830, #22070f 80%);
    box-shadow: inset 0 0 0 10px #3b1f10, inset 0 0 0 12px rgba(216,178,106,.6), inset 0 30px 80px rgba(0,0,0,.4), 0 30px 60px -30px rgba(0,0,0,.7);
  }
  .msg { min-height: 48px; display: grid; place-items: center; }
  .row { position: relative; height: 260px; margin-inline: auto; width: min(100%, calc(var(--n) * 150px)); }
  .cup {
    --w: min(130px, calc(100% / var(--n) - 12px));
    position: absolute; bottom: 30px; left: calc((100% / var(--n)) * (var(--x) + 0.5)); width: var(--w); translate: -50% 0;
    border: 0; padding: 0; background: none; aspect-ratio: 100 / 110; cursor: default;
    transition: left var(--dur) cubic-bezier(.45, 0, .55, 1);
  }
  .cup.moving { z-index: 2; }
  .cup .shell { position: absolute; inset: 0; width: 100%; height: 100%; transition: transform 0.45s var(--spring-snappy); filter: drop-shadow(0 10px 10px rgba(0,0,0,.45)); }
  .cup.up .shell { transform: translateY(-62%) rotate(-6deg); }
  .cup.pickable { cursor: pointer; }
  .cup.pickable:hover .shell { transform: translateY(-8%); }
  .cup.chosen .shell { filter: drop-shadow(0 0 14px rgba(255,214,120,.7)); }
  .shadow { position: absolute; left: 8%; right: 8%; bottom: -6px; height: 14px; border-radius: 50%; background: radial-gradient(closest-side, rgba(0,0,0,.55), transparent); }
  .ball {
    position: absolute; left: 50%; bottom: 7%; width: 30%; aspect-ratio: 1; translate: -50% 0; border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #fff8d8, #f2c046 45%, #8a5a0c); box-shadow: 0 4px 8px rgba(0,0,0,.5);
    opacity: 0; transition: opacity 0s 0.3s; /* hidden once the cup is down, so it never peeks out */
  }
  .cup.up .ball { opacity: 1; transition-delay: 0s; }
  .ball.found { animation: glow 0.9s ease-in-out infinite alternate; }
  @keyframes glow { to { box-shadow: 0 0 22px 6px rgba(255,214,120,.8); } }
  .hist { display: flex; gap: 4px; justify-content: center; min-height: 18px; color: rgba(247,236,212,.4); }
  .hist .pos { color: #f2c046; }
</style>
