// Controls what Android's hardware/gesture back button does on each
// screen. Without this, Capacitor's default behavior is: if the WebView
// has no page to go back to, EXIT THE APP — which is what was happening
// on almost every screen, since this is a multi-page app with lots of
// guard-redirects that leave WebView history in an unpredictable state.
//
// Usage: call this once per page, right after DOM is ready.
//   initBackNav('chat.html')   — back button goes to chat.html
//   initBackNav(null)          — this IS a root screen: back MINIMIZES
//                                 the app (standard Android behavior —
//                                 never fully kill the process on back)
//   initBackNav(null, true)    — root screen where back should do
//                                 NOTHING (used for mandatory onboarding,
//                                 so it can't be bypassed with back)
export function initBackNav(parentPage, blockBack) {
  const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (!App) return; // not running inside the native app (e.g. browser preview) — no-op

  App.addListener('backButton', () => {
    if (blockBack) return; // swallow the press entirely
    if (parentPage) { window.location.href = parentPage; }
    else { App.minimizeApp(); } // send to background, don't kill the process
  });
}
