// Controls what Android's hardware/gesture back button and visual UI back
// links do on each screen. Provides a stack-aware navigation manager with
// dynamic origin resolution (?from= / ?returnTo=), modal/drawer interceptors,
// multi-step form transitions, and safe app minimization.

const SAFE_INTERNAL_PAGES = new Set([
  'home.html',
  'chat.html',
  'scenario.html',
  'history.html',
  'profile.html',
  'settings.html',
  'pricing.html',
  'login.html',
  'onboarding.html',
  'report.html',
  'terms.html',
  'privacy.html'
]);

/**
 * Validates and safely resolves a return URL from query params (?from= or ?returnTo=)
 * with a fallback to defaultParent. Protects against open redirects.
 * @param {string|null} defaultParent
 * @param {string} [currentSearch]
 * @returns {string|null}
 */
export function resolveReturnUrl(defaultParent = null, currentSearch) {
  try {
    const search = currentSearch !== undefined
      ? currentSearch
      : (typeof window !== 'undefined' && window.location ? window.location.search : '');
    const params = new URLSearchParams(search);
    const candidate = params.get('from') || params.get('returnTo');
    if (candidate) {
      const clean = candidate.trim().split('?')[0].split('#')[0];
      if (SAFE_INTERNAL_PAGES.has(clean) && !candidate.includes('://') && !candidate.startsWith('//')) {
        return candidate;
      }
    }
  } catch (e) { /* ignore */ }
  return defaultParent;
}

// Stack of active overlay/modal interceptors (LIFO)
const backHandlers = [];

/**
 * Registers an interceptor for the back button (e.g. drawer, modal, active session dialog).
 * If the handler returns true, the back event is considered handled and page navigation is stopped.
 * @param {() => boolean|void} handler
 * @returns {() => void} Unregister function
 */
export function registerBackHandler(handler) {
  if (typeof handler === 'function') {
    backHandlers.push(handler);
    return () => {
      const idx = backHandlers.indexOf(handler);
      if (idx !== -1) backHandlers.splice(idx, 1);
    };
  }
  return () => {};
}

let nativeListenerRegistered = false;
let globalPageBackAction = null;

/**
 * Executes the topmost back action:
 * 1. Check registered interceptors (drawers, modals) LIFO.
 * 2. If none handled, execute page-level back action.
 */
export function handleBackPress() {
  for (let i = backHandlers.length - 1; i >= 0; i--) {
    try {
      const handled = backHandlers[i]();
      if (handled === true) return;
    } catch (err) {
      console.error('backHandler error:', err);
    }
  }

  if (typeof globalPageBackAction === 'function') {
    globalPageBackAction();
  }
}

/**
 * Navigates back according to resolved parent or minimizes the app.
 * @param {string|null} defaultParent
 */
export function navigateBack(defaultParent = null) {
  const target = resolveReturnUrl(defaultParent);
  const App = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (target && typeof window !== 'undefined') {
    window.location.href = target;
  } else if (App) {
    App.minimizeApp();
  } else if (typeof window !== 'undefined' && window.history && window.history.length > 1) {
    window.history.back();
  }
}

/**
 * Initialize back navigation on a page.
 * Supports legacy signature initBackNav(parentPage, blockBack) and options object.
 * @param {string|null} defaultParent Default fallback page if no ?from= is present
 * @param {boolean|{blockBack?: boolean, onBack?: () => boolean|void, syncBackLink?: boolean}} options
 */
export function initBackNav(defaultParent, options = {}) {
  const isLegacyBoolean = typeof options === 'boolean';
  const blockBack = isLegacyBoolean ? options : !!options.blockBack;
  const onBack = (!isLegacyBoolean && typeof options.onBack === 'function') ? options.onBack : null;
  const syncBackLink = !isLegacyBoolean && options.syncBackLink !== false;

  const targetParent = resolveReturnUrl(defaultParent);

  // Sync visual UI back button in DOM if present (e.g. <a class="icon-btn" id="backLink"> or first back button in topbar)
  if (syncBackLink && targetParent && typeof document !== 'undefined') {
    const backBtn = document.getElementById('backLink') || document.querySelector('.topbar a.icon-btn[aria-label="Back"]');
    if (backBtn && backBtn.tagName === 'A') {
      backBtn.href = targetParent;
    }
  }

  globalPageBackAction = () => {
    if (blockBack) return; // swallow back entirely

    if (onBack) {
      const handled = onBack();
      if (handled === true || handled === false) return;
    }

    const App = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (targetParent && typeof window !== 'undefined') {
      window.location.href = targetParent;
    } else if (App) {
      App.minimizeApp(); // root screen — minimize rather than kill
    }
  };

  const App = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (App && !nativeListenerRegistered) {
    nativeListenerRegistered = true;
    App.addListener('backButton', () => {
      handleBackPress();
    });
  }
}
