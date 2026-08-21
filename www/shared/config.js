import { initCrashReporting } from './crash-log.js';
import { initAppLifecycle, registerDefaultResumeHandling } from './app-lifecycle.js';

// Fill these in from:
// - Supabase Dashboard -> Project Settings -> API (URL + anon public key)
// - The backend URL wherever you deploy uktio-backend (Render/Railway/etc.)
// The anon key is safe to ship in the app — it only allows what your
// Supabase RLS policies permit, nothing more.

// Testing against a locally-run backend vs. the deployed production one?
// Don't retype/comment-swap the URL every time — just flip this one word
// and reload (browser preview: instant; native app: `npx cap sync android`
// then rebuild, since www/ gets copied into the Android project).
const ACTIVE_BACKEND = 'main'; // 'main' | 'local'

const BACKENDS = {
  main: 'https://utkio-backend.onrender.com',
  local: 'http://10.215.18.30:3999' 
};

// Safety net: this is easy to forget about after a local-testing
// session. It doesn't change any behavior — the app still connects to
// whatever ACTIVE_BACKEND says above — it just makes it loud and hard
// to miss in the console if 'local' is still active, so a production
// build doesn't silently ship pointed at a dev machine's home/office
// Wi-Fi IP (which would just fail for every real user).
if (ACTIVE_BACKEND === 'local') {
  console.warn(
    '%c⚠️ ACTIVE_BACKEND is set to \'local\' (%s) — shared/config.js',
    'font-weight:bold;font-size:14px;color:#fff;background:#c0392b;padding:4px 8px;border-radius:4px;',
    BACKENDS.local
  );
  console.warn('If this is a production/release build, flip ACTIVE_BACKEND to \'main\' before shipping.');
}

export const DEFAULT_LIVE_MODEL = 'gemini-3.1-flash-live-preview';

const root = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : global);

root.UKTIO_CONFIG = {
  SUPABASE_URL: 'https://pwdglktwuquoswqoyely.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3ZGdsa3R3dXF1b3N3cW95ZWx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MTYyODAsImV4cCI6MjEwMTE5MjI4MH0.GdwAJAXx8x98QvkvW1HAZh7F3PIZiV3Uqeoqm54ohRo',
  BACKEND_URL: BACKENDS[ACTIVE_BACKEND], // no trailing slash

  // ── Gemini Live Voice Model ──────────────────────────────────────────────
  // Single source of truth for the real-time bidirectional audio stream.
  LIVE_MODEL: DEFAULT_LIVE_MODEL,

  // ── Community / support link ────────────────────────────────────────────
  // Change only this one string whenever the Telegram group URL changes —
  // every page that shows the "Contact" button reads from here. No redeploy
  // of HTML files needed; just update this file and run `npx cap sync android`.
  TELEGRAM_URL: 'https://t.me/uktio',

  // ── Crash reporting (shared/crash-log.js) ───────────────────────────────
  // Empty = crash reporting stays OFF (see crash-log.js). Get a DSN from
  // your own Sentry project (sentry.io -> Settings -> Client Keys) and
  // paste it here before shipping to real users — otherwise you'll have
  // zero visibility into crashes once this is on 1000+ devices.
  SENTRY_DSN: '',
  APP_VERSION: 'utkio@1.0.0', // bump this (or wire to your build number) on every release you ship

  // ── Backend cold-start behavior (shared/auth.js: fetchProfileWithRetry) ──
  // true  = the backend can be a sleeping free-tier Render service, so a
  //         failed first request retries up to 4x over ~14s before giving
  //         up (that's what "Server se connect ho raha hai..." covers).
  // false = the backend is always-on (paid Render/Railway/etc. — no sleep,
  //         no cold start), so it retries just ONCE, quickly. Leaving this
  //         `true` on an always-on backend costs nothing when the server is
  //         healthy (first attempt always succeeds either way) — it only
  //         matters when the server is genuinely down, where `true` means
  //         3 extra wasted hits and ~14s of "connecting..." shown to the
  //         user for no benefit. Flip this the day you move off the free tier.
  BACKEND_COLD_START: true,
};

// Crash reporting is wired up here (not in each individual page) because
// config.js is the very first import on every single page in this app —
// this guarantees it's initialized before anything else has a chance to
// throw. See shared/crash-log.js for what this does when SENTRY_DSN
// above is empty (nothing — safe no-op).
initCrashReporting();

// See shared/app-lifecycle.js for why this matters: voice sessions keep
// running in the background via a native service even when the WebView
// is paused, so the JS layer needs a signal for "we're back" to resync
// caches/tokens. Wired here (not per-page) for the same reason crash
// reporting is wired here — config.js is the first import on every page,
// so this is guaranteed to be registered before the user can background
// the app from any screen.
initAppLifecycle();
registerDefaultResumeHandling();
