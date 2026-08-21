// Visible "you're offline" banner + a reconnect signal, for pages where
// losing connectivity mid-action is disruptive enough to need an
// always-on indicator (not just a one-off error message that scrolls
// away). Currently wired into chat.html and scenario.html only — those
// are the two screens with a live voice session and/or a network-
// dependent initial load that's worth auto-retrying.
//
// This sits on top of shared/network-status.js (the low-level plugin
// wrapper) and is deliberately separate from shared/app-lifecycle.js
// (that module is about background/foreground transitions — a
// different signal with different causes and different correct
// responses — this one is purely about connectivity).

import { getNetworkStatus, onNetworkChange } from './network-status.js';

const BANNER_ID = 'utkioOfflineBanner';
let styleInjected = false;
let currentUnsubscribe = null;

function injectStyleOnce() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    #${BANNER_ID}{
      position:fixed; top:0; left:0; right:0; z-index:9999;
      display:flex; align-items:center; justify-content:center; gap:6px;
      padding:calc(10px + env(safe-area-inset-top, 0px)) 16px 10px;
      background:var(--bad, #d9534f); color:#fff;
      font-size:0.8rem; font-weight:600; text-align:center; line-height:1.3;
      transform:translateY(-100%); transition:transform 0.25s ease;
      pointer-events:none;
    }
    #${BANNER_ID}.show{ transform:translateY(0); }
  `;
  document.head.appendChild(style);
}

function ensureBannerEl() {
  let el = document.getElementById(BANNER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = BANNER_ID;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.textContent = '📡 Internet connection nahi hai — check karo';
    document.body.appendChild(el);
  }
  return el;
}

// initOfflineBanner(onRestored?)
//   - Shows a fixed top banner for as long as the device is offline
//     (including immediately on page load if it's already offline).
//   - onRestored, if given, fires exactly once each time connectivity
//     flips OFFLINE -> ONLINE (never on initial load if already online,
//     never repeatedly while staying online) — this is the hook a page
//     uses to auto-retry whatever failed while offline. Errors thrown
//     inside onRestored are caught here so a retry-callback bug can
//     never take down the rest of the page.
//   - Safe to call more than once per page (re-initializing replaces the
//     previous subscription instead of stacking listeners), though in
//     practice each page calls this exactly once.
//   - Returns an unsubscribe function.
export function initOfflineBanner(onRestored) {
  injectStyleOnce();
  const el = ensureBannerEl();
  let wasOffline = false;

  const applyStatus = (connected) => {
    el.classList.toggle('show', !connected);
    if (!connected) {
      wasOffline = true;
      return;
    }
    if (wasOffline) {
      wasOffline = false;
      if (typeof onRestored === 'function') {
        try { onRestored(); } catch (e) { console.warn('offline-banner: onRestored callback failed', e); }
      }
    }
  };

  if (currentUnsubscribe) currentUnsubscribe(); // guard against double-init stacking listeners
  getNetworkStatus().then((s) => applyStatus(s.connected));
  currentUnsubscribe = onNetworkChange((s) => applyStatus(s.connected));
  return currentUnsubscribe;
}
