<script lang="ts">
  import { onMount } from 'svelte';
  import type { Room } from '../lib/net.svelte';
  import { askName } from '../lib/state.svelte';
  import { t } from '../lib/i18n';
  let { room, extra }: { room: Room; extra?: import('svelte').Snippet } = $props();
  let code = $state('');
  let copied = $state(false);
  let open = $state(false); // phones: room controls and table options fold into one row

  onMount(() => {
    const c = new URLSearchParams(location.hash.split('?')[1]).get('room');
    if (c) askName().then((ok) => ok && room.join(c));
  });

  function copy() {
    const url = location.href.split('#')[0] + '#' + location.hash.slice(1).split('?')[0] + '?room=' + room.code;
    navigator.clipboard?.writeText(url);
    copied = true;
    setTimeout(() => (copied = false), 1500);
  }
</script>

<div class="bar" class:open>
  <button class="toggle" onclick={() => (open = !open)} aria-expanded={open}>
    <span class="dot" class:live={room.role !== 'solo' && room.status === 'open'} class:wait={room.status === 'connecting'}></span>
    <span>{room.role === 'host' ? t('room.host') : room.role === 'guest' ? t('room.guest') : t('room.solo')}</span>
    {#if room.code && room.role !== 'solo'}<strong class="mono code">{room.code}</strong>{/if}
    <span class="opt">{t('room.options')}</span>
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
  </button>
  <div class="left">
    {#if room.status === 'connecting'}
      <span class="dot wait"></span><span class="muted">{t('room.connecting')}</span>
    {:else if room.role === 'host'}
      <span class="dot live"></span>
      <span class="muted">{t('room.host')}</span>
      <strong class="mono code">{room.code}</strong>
      <span class="muted">· {room.guests + 1} {t('room.players')}</span>
      <button class="btn sm" onclick={copy}>{copied ? t('room.copied') : t('room.copy')}</button>
      <button class="btn sm ghost" onclick={() => room.leave()}>{t('room.leave')}</button>
    {:else if room.role === 'guest'}
      <span class="dot live"></span>
      <span class="muted">{t('room.guest')}</span>
      <strong class="mono code">{room.code}</strong>
      <button class="btn sm ghost" onclick={() => room.leave()}>{t('room.leave')}</button>
    {:else}
      <span class="dot"></span><span class="muted">{t('room.solo')}</span>
      <button class="btn sm" onclick={async () => (await askName()) && room.create()}>{t('room.create')}</button>
      <form onsubmit={async (e) => { e.preventDefault(); if (code.trim().length >= 4 && (await askName())) room.join(code); }}>
        <input class="mono" bind:value={code} placeholder={t('room.code')} maxlength="5" aria-label={t('room.code')} />
        <button class="btn sm ghost" disabled={code.trim().length < 4}>{t('room.join')}</button>
      </form>
    {/if}
    {#if room.error}<span class="err">{room.error}</span>{/if}
  </div>
  {#if extra}<div class="right">{@render extra()}</div>{/if}
</div>

<style>
  .bar { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; justify-content: space-between; padding: 10px 0; font-size: 0.85rem; }
  .left, .right { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .muted { color: var(--muted); }
  .code { letter-spacing: 0.12em; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--line-2); }
  .dot.live { background: #2fbf71; box-shadow: 0 0 0 4px rgba(47, 191, 113, 0.18); }
  .dot.wait { background: var(--gold); animation: pulse 1s infinite alternate; }
  @keyframes pulse { to { opacity: 0.3; } }
  form { display: flex; gap: 6px; }
  input { width: 92px; min-height: 36px; border-radius: 999px; border: 1px solid var(--line-2); background: var(--bg-2); padding: 0 12px; text-transform: uppercase; letter-spacing: 0.12em; }
  .err { color: var(--accent); }
  .toggle { display: none; }
  @media (max-width: 720px) {
    .bar { padding: 4px 0; }
    .toggle { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 40px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--line-2); background: var(--surface); font-size: 0.82rem; }
    .toggle .opt { margin-left: auto; color: var(--muted); }
    .toggle svg { transition: transform 0.3s var(--ease-snap); }
    .open .toggle svg { transform: rotate(180deg); }
    .left, .right { display: none; }
    .open .left, .open .right { display: flex; width: 100%; }
    .left > .dot, .left > .dot + .muted { display: none; }
  }
</style>
