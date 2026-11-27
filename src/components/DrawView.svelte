<script lang="ts">
  // A finished drawing, rendered sharp at any size.
  import { paint } from './DrawPad.svelte';
  import type { Drawing } from '../games/doodle';
  let { drawing }: { drawing: Drawing } = $props();
  let cv: HTMLCanvasElement;
  let w = $state(0);
  $effect(() => {
    void drawing;
    if (!cv || !w) return;
    const dpr = devicePixelRatio || 1;
    cv.width = Math.round(w * dpr); cv.height = Math.round((w * 3) / 4 * dpr);
    paint(cv.getContext('2d')!, drawing, cv.width, cv.height);
  });
</script>

<div class="view" bind:clientWidth={w}><canvas bind:this={cv}></canvas></div>

<style>
  .view { position: relative; width: 100%; aspect-ratio: 4 / 3; border-radius: 14px; overflow: hidden; background: #fffdf6; box-shadow: inset 0 0 0 1px rgba(0,0,0,.08); }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
</style>
