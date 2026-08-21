// Crash / error reporting — Sentry's browser SDK, vendored the same way
// as vendor/google-genai.bundle.mjs (see vendor/README.md): a self-
// contained esbuild bundle shipped inside the app, so error reporting
// doesn't depend on reaching a third-party CDN at runtime.
//
// Imported once from shared/config.js (which is the very first import on
// every single page in this app), so this runs before anything else has
// a chance to throw.
//
// Gated entirely on UKTIO_CONFIG.SENTRY_DSN being set: with no DSN
// configured, init() is never called and this module is a complete
// no-op (captureError() below just logs to console, same as before this
// existed). This is deliberate — do NOT hardcode a DSN here; it's
// project-specific and belongs in config.js, set by whoever owns the
// Sentry project.
import * as Sentry from '../vendor/sentry-browser.bundle.mjs';

let ready = false;

export function initCrashReporting() {
  const cfg = (typeof window !== 'undefined' ? window.UKTIO_CONFIG : (typeof globalThis !== 'undefined' ? globalThis.UKTIO_CONFIG : null)) || {};
  if (!cfg.SENTRY_DSN) {
    console.info(
      'Crash reporting is OFF — set UKTIO_CONFIG.SENTRY_DSN in shared/config.js to enable it before shipping to real users.'
    );
    return;
  }
  try {
    Sentry.init({
      dsn: cfg.SENTRY_DSN,
      // Bump this on every release so Sentry can tell you which build a
      // crash came from — wire it to your actual version string/commit
      // if you have one (e.g. from capacitor.config.json or a build step).
      release: cfg.APP_VERSION || 'utkio@unknown',
      environment: cfg.BACKEND_URL && cfg.BACKEND_URL.includes('localhost') ? 'development' : 'production',
      // Sentry's default integrations already install window.onerror /
      // unhandledrejection listeners on init() — no manual wiring needed
      // here, unlike the app's own console.error-only handlers in
      // chat.html/scenario.html (those stay, they're for on-device debug
      // logging, which is still useful independently of Sentry).
      tracesSampleRate: 0, // no perf tracing — this app just needs crash/error visibility, not APM
    });
    ready = true;
  } catch (e) {
    console.warn('Sentry init failed — crash reporting disabled for this session', e);
  }
}

// Manual capture point for catch blocks that want more than console.error
// — e.g. "this failed, but I recovered/showed a fallback UI, still want
// to know it happened". No-ops safely if Sentry was never initialized.
export function logError(context, error) {
  console.error(context, error);
  if (!ready) return;
  try {
    Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
      tags: { context }
    });
  } catch (e) { /* never let error reporting itself crash the app */ }
}
