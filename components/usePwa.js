'use client';

/* PWA plumbing: registers the service worker (offline + notification
   taps), shows a phone notification once per new alert id, and exposes
   the browser's "install app" prompt. */

import { useEffect, useState, useCallback } from 'react';

// Offline caching only in production builds, so dev hot-reload stays fresh.
const SW_PATH = process.env.NODE_ENV === 'production' ? '/sw.js?cache=1' : '/sw.js';
const ICON = '/icons/icon-192.png';

export function useServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(SW_PATH).catch(() => { /* notifications fall back to Notification API */ });
    }
  }, []);
}

async function show(alert) {
  const options = { body: alert.body, tag: alert.id, icon: ICON, badge: ICON, data: { url: `/#${alert.tab}` } };
  const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
  if (reg) await reg.showNotification(alert.title, options);
  else new Notification(alert.title, options);
}

export function useAlertNotifier(alerts, enabled, notifiedIds, markNotified) {
  useEffect(() => {
    if (!enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const done = new Set(notifiedIds);
    const fresh = alerts.filter((a) => !done.has(a.id));
    if (!fresh.length) return;
    markNotified(fresh.map((a) => a.id));   // mark first so other tabs / re-renders don't repeat
    fresh.forEach((a) => { show(a).catch(() => { /* permission revoked mid-session */ }); });
  }, [alerts, enabled, notifiedIds, markNotified]);
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

/* Install state: 'installed' | 'prompt' (Android/desktop button) |
   'ios' (Share → Add to Home Screen) | 'none'. */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [mode, setMode] = useState('none');

  useEffect(() => {
    if (isStandalone()) { setMode('installed'); return undefined; }
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) setMode('ios');
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); setMode('prompt'); };
    const onInstalled = () => { setDeferred(null); setMode('installed'); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === 'accepted') setMode('installed');
  }, [deferred]);

  return { mode, install };
}
