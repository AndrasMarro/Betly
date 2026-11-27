<script lang="ts">
  // A little cardboard tank, used for the lives.
  let { color = '#4f7cff', lost = false }: { color?: string; lost?: boolean } = $props();
</script>

<svg class="mt" class:lost viewBox="0 0 36 26" width="30" height="22" aria-hidden="true">
  <rect x="3" y="2" width="26" height="6" rx="3" fill="#4a3a2a" stroke="#1a130d" stroke-width="1.4" />
  <rect x="3" y="18" width="26" height="6" rx="3" fill="#4a3a2a" stroke="#1a130d" stroke-width="1.4" />
  <rect x="4" y="6" width="24" height="14" rx="3" fill={color} stroke="#1a130d" stroke-width="1.8" />
  <rect x="17" y="11" width="17" height="4.5" rx="1.5" fill="#d9b484" stroke="#1a130d" stroke-width="1.4" />
  <circle cx="15" cy="13" r="5.5" fill={color} stroke="#1a130d" stroke-width="1.8" />
  <circle cx="14" cy="12" r="1.6" fill="#fff" />
</svg>

<style>
  .mt { display: block; filter: drop-shadow(0 2px 1px rgba(0,0,0,.35)); animation: drop 0.45s var(--spring-snappy); }
  .mt.lost { filter: grayscale(1) brightness(0.5); opacity: 0.45; }
  @keyframes drop { from { transform: translateY(-6px) scale(0.6); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .mt { animation: none; } }
</style>
