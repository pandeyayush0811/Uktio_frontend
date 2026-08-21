// Persistent "you're offline" banner + auto-recovery hook, layered on
// top of shared/network-status.js.
//
// WHY THIS IS A SEPARATE MODULE (and not folded into network-status.js):
// network-status.js is a pure, side-effect-free connectivity check
// (isOnline / getNetworkStatus / onNetworkChange) used by auth.js and
// voice-live-session.js for the *reactive/proactive fail-fast* case —
// it must stay DOM-free so it's safe to import from non-page contexts.
// This module is the DOM-touching layer on top: it owns a single fixed
// banner element and shows/hides it as connectivity changes, so the
// user finds out immediately (not just when they tap something that
// happens to hit the network).
//
// SAFETY / ISOLATION: this module never touches session state, mic
// state, or any existing setStatus()/UI logic on the page. It only
// ever (a) inserts one small fixed <div>, and (b) — if the caller opts
// in via onBackOnline — invokes a caller-supplied callback once when
// connectivity is restored. If a page never calls initOfflineBanner(),
// nothing changes for it. This keeps every existing feature (proactive
// isOnline() checks in chat.html / scenario.html / voice-live-session.js,
// setStatus(), lockChatForToday(), etc.) completely untouched.

import { getNetworkStatus, onNetworkChange } from './network-status.js';

let bannerEl = null;
let wasOffline = false;

function ensureBanner() {
  if (bannerEl) return bannerEl;
  bannerEl = document.createElement('div');
  bannerEl.id = 'offlineBanner';
  bannerEl.setAttribute('role', 'alert');
  bannerEl.setAttribute('aria-live', 'assertive');
  bannerEl.textContent = 'No internet connection — please turn on internet / Wi-Fi.';
  Object.assign(bannerEl.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    zIndex: '2147483647', // always above app UI, never intercepted by a lower page z-index
    background: '#c0392b',
    color: '#fff',
    fontFamily: 'inherit',
    fontSize: '13px',
    fontWeight: '600',
    lineHeight: '1.3',
    textAlign: 'center',
    padding: 'max(8px, env(safe-area-inset-top)) 14px 8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
    pointerEvents: 'none', // never blocks taps on whatever is underneath
    transform: 'translateY(-100%)',
    transition: 'transform 0.25s ease',
  });
  // Appended lazily (first offline event), so pages that never go
  // offline during a session never even get the extra DOM node.
  document.body.appendChild(bannerEl);
  return bannerEl;
}

function showBanner() {
  ensureBanner().style.transform = 'translateY(0)';
}

function hideBanner() {
  if (!bannerEl) return;
  bannerEl.style.transform = 'translateY(-100%)';
}

/**
 * Mounts the offline banner for the current page and starts watching
 * connectivity. Safe to call once per page load.
 *
 * @param {Object} [options]
 * @param {() => void} [options.onOffline] - Called whenever connectivity
 *   is (re)confirmed lost — including once immediately if the page is
 *   already offline at mount time, not just on a live transition. Use
 *   this to proactively disable actions (e.g. the mic button) that are
 *   guaranteed to fail without a network, so the user gets instant
 *   feedback instead of tapping something doomed. Must be idempotent —
 *   may be called more than once in a row if connectivity flaps. Any
 *   error thrown is caught and logged, never crashes the page.
 * @param {() => void} [options.onBackOnline] - Called at most once per
 *   offline episode, right after the banner hides, when connectivity
 *   transitions offline -> online (never fires on initial page load if
 *   already online). Use this to silently retry whatever failed while
 *   offline (e.g. re-fetch data, re-enable the mic button). Must be
 *   idempotent / safe to call more than once across the page's
 *   lifetime. Any error thrown is caught and logged — it can never
 *   crash the page.
 * @returns {() => void} unsubscribe function.
 */
export function initOfflineBanner(options = {}) {
  const onOffline = typeof options.onOffline === 'function' ? options.onOffline : null;
  const onBackOnline = typeof options.onBackOnline === 'function' ? options.onBackOnline : null;

  function fireOffline() {
    if (onOffline) { try { onOffline(); } catch (e) { console.error('[offline-banner] onOffline callback failed', e); } }
  }

  // Establish initial state without waiting on the change-listener's
  // first event (which some platforms only fire on an actual
  // transition, not on subscribe) — so a page opened while already
  // offline shows the banner AND runs onOffline (e.g. disables the mic)
  // right away, not only after the next connectivity flap.
  getNetworkStatus()
    .then((status) => {
      wasOffline = !status.connected;
      if (wasOffline) { showBanner(); fireOffline(); }
    })
    .catch(() => { /* best-effort only, never blocks page load */ });

  return onNetworkChange((status) => {
    if (!status.connected) {
      wasOffline = true;
      showBanner();
      fireOffline();
      return;
    }
    hideBanner();
    if (wasOffline && onBackOnline) {
      try { onBackOnline(); } catch (e) { console.error('[offline-banner] onBackOnline callback failed', e); }
    }
    wasOffline = false;
  });
}

/**
 * Convenience wrapper around initOfflineBanner() for the common case:
 * "disable these buttons while offline, re-enable them when back
 * online" — used for any action that is guaranteed to need the network
 * (submit forms, checkout, save, generate-report, etc.), so tapping it
 * fails instantly and silently instead of the user waiting on a doomed
 * request.
 *
 * SAFETY: this only ever re-enables an element that THIS function
 * itself disabled (tracked in a WeakSet). If an element was already
 * disabled for some other, page-specific reason (mid-request
 * "isBusy" state, a permanently-disabled button like an already-joined
 * waitlist CTA, a locked/completed state, etc.) before we went offline,
 * we skip it going offline and — critically — never re-enable it
 * coming back online either, because it was never ours to begin with.
 * This means it can NEVER fight with a page's own disabled/enabled
 * logic; it only ever adds a temporary, clearly-scoped extra reason for
 * "disabled" on top of whatever the page already does.
 *
 * @param {(HTMLElement|null|undefined)[]} elements - Buttons/inputs to
 *   gate. null/undefined entries are ignored, so callers can pass
 *   elements that might not exist on every render.
 * @returns {() => void} unsubscribe function.
 */
export function disableOfflineFor(elements) {
  const disabledByUs = new WeakSet();
  const targets = (elements || []).filter(Boolean);

  return initOfflineBanner({
    onOffline: () => {
      targets.forEach((el) => {
        if (!el.disabled) {
          el.disabled = true;
          disabledByUs.add(el);
        }
      });
    },
    onBackOnline: () => {
      targets.forEach((el) => {
        if (disabledByUs.has(el)) {
          el.disabled = false;
          disabledByUs.delete(el);
        }
      });
    }
  });
}