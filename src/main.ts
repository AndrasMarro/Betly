import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource/instrument-serif/400-italic.css';
import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { initAccount } from './lib/account.svelte';

mount(App, { target: document.getElementById('app')! });
initAccount();

// installable app + offline play (production only, so dev reloads stay fresh)
if (import.meta.env.PROD && 'serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));

// ask the browser to keep our local data (wallet, records) instead of evicting it when space runs low
navigator.storage?.persist?.().catch(() => {});
