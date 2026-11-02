<script lang="ts">
  import { RANKS, SUITS, type Card } from '../lib/cards';
  let { card, small = false }: { card: Card; small?: boolean } = $props();
  const red = $derived(card.s === 1 || card.s === 2);
</script>

<div class="card" class:small class:down={card.r === 0}>
  <div class="inner">
    <div class="face" class:red>
      <span class="corner">{RANKS[card.r]}<br />{SUITS[card.s]}</span>
      <span class="pip">{SUITS[card.s]}</span>
      <span class="corner br">{RANKS[card.r]}<br />{SUITS[card.s]}</span>
    </div>
    <div class="back"></div>
  </div>
</div>

<style>
  .card { width: var(--cw, 64px); aspect-ratio: 5 / 7; perspective: 600px; flex: none; }
  .card.small { --cw: 48px; }
  .inner { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; transition: transform 0.55s cubic-bezier(0.16, 1, 0.3, 1); }
  .down .inner { transform: rotateY(180deg); }
  .face, .back {
    position: absolute; inset: 0; border-radius: calc(var(--cw, 64px) * 0.1); backface-visibility: hidden;
    box-shadow: 0 1px 0 rgba(0,0,0,.2), 0 10px 22px -10px rgba(0,0,0,.75);
  }
  .face { background: #fbfaf7; color: #18181b; font-family: 'Geist Variable', sans-serif; }
  .face.red { color: #c8262c; }
  .corner { position: absolute; top: 6%; left: 9%; font-weight: 700; font-size: calc(var(--cw, 64px) * 0.22); line-height: 0.95; text-align: center; font-variant-emoji: text; }
  .corner.br { top: auto; left: auto; bottom: 6%; right: 9%; transform: rotate(180deg); }
  .pip { position: absolute; inset: 0; display: grid; place-items: center; font-size: calc(var(--cw, 64px) * 0.5); font-variant-emoji: text; }
  .back {
    transform: rotateY(180deg);
    background: repeating-linear-gradient(45deg, var(--accent) 0 3px, transparent 3px 9px), repeating-linear-gradient(-45deg, var(--accent) 0 3px, #1a1a1e 3px 9px);
    border: 4px solid #fbfaf7;
  }
</style>
