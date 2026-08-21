// Wires Capacitor's App.addListener('appStateChange', ...) once per page
// load, and turns it into a plain DOM CustomEvent (`utkio:resume` /
// `utkio:pause`) any module on the page can subscribe to — so pages
// don't need to import Capacitor plugin globals directly, and so this
// file can add its own generic, safe, cross-page handling without
// needing to know about page-specific state (voice sessions, quiz
// timers, etc).
//
// WHY THIS MATTERS FOR THIS APP SPECIFICALLY: voice sessions
// (chat.html/scenario.html) keep running in the background via a native
// foreground service (VoiceKeepAliveService.java) even when the WebView
// itself is paused/backgrounded by the OS or phone-locked. That's
// correct and intentional — audio must keep flowing. But it means the
// JS/UI layer can drift out of sync with what actually happened while
// backgrounded: a fresh transcript synced to the backend, a token that
// expired, cached data that's now stale. This module's job is ONLY to
// signal "we're back" — it deliberately does NOT touch any voice
// session state itself (session objects, mic handles, audio contexts)
// so it can never be the thing that breaks a working, load-bearing
// audio feature. Anything session-specific reacts to the event itself.
//
// initAppLifecycle() is safe to call multiple times (e.g. if a future
// page imports this directly in addition to config.js) — it no-ops
// after the first successful registration per page load.

let initialized = false;

export function initAppLifecycle() {
  if (initialized) return;
  const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (!App) return; // browser preview / plugin missing — no background service to resync with anyway
  initialized = true;

  App.addListener('appStateChange', ({ isActive }) => {
    try {
      window.dispatchEvent(new CustomEvent(isActive ? 'utkio:resume' : 'utkio:pause'));
    } catch (e) {
      // Don't let a listener error here cascade into anything else —
      // this is a best-effort signal, not load-bearing app logic.
      console.warn('app-lifecycle: appStateChange handling failed', e);
    }
  });
}

// Generic, page-agnostic resync work that's safe to do on EVERY page,
// every time the app resumes:
//  - Drop the cached recent-chat-sessions list (shared/auth.js) so the
//    drawer/history re-fetch fresh data instead of showing whatever was
//    cached before backgrounding — cheap, and avoids showing a stale
//    session list after a voice session finished syncing while the app
//    was in the background.
//  - Nudge the access token to refresh-check on next apiFetch call by
//    doing a lightweight getValidAccessToken() call now (proactively),
//    rather than waiting for the next user action to discover the token
//    expired after a long background stint.
// Wrapped in try/catch and dynamic imports so a failure here can never
// throw out of the appStateChange handler or block page-specific resume
// listeners from also running.
export function registerDefaultResumeHandling() {
  window.addEventListener('utkio:resume', async () => {
    try {
      const { invalidateChatSessionsCache, getValidAccessToken } = await import('./auth.js');
      invalidateChatSessionsCache();
      await getValidAccessToken(); // refreshes in the background if the session is near/past expiry; no-op otherwise
    } catch (e) {
      console.warn('app-lifecycle: default resume handling failed', e);
    }
  });
}
