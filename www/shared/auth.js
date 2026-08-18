// Shared across all pages: talks to the backend for signup/login/google,
// stores the Supabase session on-device, and guards pages that need auth.

import { secureGetItem, secureSetItem, secureRemoveItem, migrateLegacyKey } from './secure-store.js';
import { cachedFetch, invalidateCache, invalidateAllCache } from './api-cache.js';

const cfg = window.UKTIO_CONFIG;
const SESSION_KEY = 'utkio_session';

// The session (access + refresh token) now lives in encrypted storage
// (Android Keystore / iOS Keychain via shared/secure-store.js) instead of
// plain localStorage — a stolen/rooted-device or backup dump no longer
// hands over a live login. See shared/secure-store.js for the fallback
// behavior in browser preview.
//
// migratedOnce guards the legacy-localStorage migration so it only runs
// once per page load, not on every saveSession()/getSession() call.
let migratedOnce = false;
async function ensureMigrated() {
  if (migratedOnce) return;
  migratedOnce = true;
  await migrateLegacyKey(SESSION_KEY, SESSION_KEY);
}

export async function saveSession(session) {
  await ensureMigrated();
  try { await secureSetItem(SESSION_KEY, JSON.stringify(session)); }
  catch (e) { console.warn('saveSession failed', e); }
}

export async function getSession() {
  await ensureMigrated();
  try {
    const raw = await secureGetItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export async function clearSession() {
  try { await secureRemoveItem(SESSION_KEY); }
  catch (e) { /* ignore */ }
}

export async function getAccessToken() {
  const s = await getSession();
  return s ? s.access_token : null;
}

// Supabase access tokens expire after 1 hour. Without this, anyone who
// keeps the app open (or comes back after an hour) gets silently logged
// out on their next request. This refreshes proactively — 60s before
// expiry — using the long-lived refresh_token, so the user effectively
// never gets logged out just from time passing.
//
// inFlightRefresh dedupes concurrent calls: if 3 apiFetch calls fire at
// once near expiry, only ONE actual refresh request goes out; the other
// two just await the same promise.
let inFlightRefresh = null;

// Exported (unlike the rest of this refresh machinery) for any streaming
// caller that can't go through apiFetch() — apiFetch always parses the
// response as one JSON blob, which breaks a streamed response. Such a
// caller should grab a fresh token with this the same way apiFetch does
// internally, instead of reading getAccessToken()'s possibly-stale value.
export async function getValidAccessToken() {
  const s = await getSession();
  if (!s || !s.access_token) return null;

  const expiresAtMs = (s.expires_at || 0) * 1000; // Supabase gives seconds, Date.now() is ms
  const isExpiringSoon = expiresAtMs && (expiresAtMs - Date.now() < 60 * 1000);
  if (!isExpiringSoon) return s.access_token;

  if (!s.refresh_token) return s.access_token; // nothing we can do — let the request fail naturally

  if (!inFlightRefresh) {
    inFlightRefresh = fetch(cfg.BACKEND_URL + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: s.refresh_token })
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(async ({ ok, data }) => {
        if (ok && data.session) { await saveSession(data.session); return data.session.access_token; }
        return s.access_token; // refresh failed — fall back to the old (soon-expired) token, let the call fail naturally rather than throwing here
      })
      .catch(() => s.access_token)
      .finally(() => { inFlightRefresh = null; });
  }
  return inFlightRefresh;
}

// Call at the top of any page that requires login. Redirects to login.html
// if there's no valid-looking session. Returns the session if present.
// Async now (secure storage read) — every call site already awaits it,
// either inside an async function or via ES module top-level await.
export async function requireAuthOrRedirect() {
  const s = await getSession();
  if (!s || !s.access_token) {
    window.location.href = 'login.html';
    return null;
  }
  return s;
}

// Thin wrapper around fetch() that talks to YOUR backend (not Supabase
// directly) and attaches the Supabase access token as a Bearer header.
export async function apiFetch(path, options = {}) {
  const token = await getValidAccessToken();
  const res = await fetch(cfg.BACKEND_URL + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || ('Request failed (' + res.status + ')'));
    err.status = res.status; // callers use this to tell "bad token" apart from "server unreachable"
    throw err;
  }
  return data;
}

// Fetches /users/me with automatic retries — built specifically to survive
// Render's free-tier cold start (first request after idle can take 15-30s).
// Returns exactly one of:
//   { ok: true, profile }                 — success
//   { ok: false, reason: 'unauthenticated' } — token is genuinely invalid/expired (401/403). Session is cleared.
//   { ok: false, reason: 'unreachable' }     — server never responded after retries. Session is left untouched.
// onStatus(text) is called before each retry so the UI can show progress.
//
// The long 4-attempt/~14s ladder below exists ONLY to ride out a free-tier
// Render service spinning back up from sleep. A paid Render plan never
// sleeps, so once you upgrade, every one of those extra retries on a
// genuinely-down backend is just 3 wasted extra hits (and 14 extra
// seconds of "connecting..." shown to the user) for no benefit — flip
// UKTIO_CONFIG.BACKEND_COLD_START to false in shared/config.js and this
// automatically drops to one quick retry, which is all a paid/always-on
// backend ever needs (covers a normal network blip, not a 15-30s wake-up).
export async function fetchProfileWithRetry(onStatus) {
  const hasColdStart = !cfg || cfg.BACKEND_COLD_START !== false; // default true = today's free-tier behavior, safe if config.js hasn't been updated yet
  const delaysMs = hasColdStart
    ? [0, 2000, 4000, 8000]   // ~14s total — covers a free-tier cold start
    : [0, 1500];              // one quick retry — covers an ordinary network blip on an always-on backend
  for (let attempt = 0; attempt < delaysMs.length; attempt++) {
    if (delaysMs[attempt] > 0) {
      onStatus && onStatus(`Server se connect ho raha hai... (${attempt}/${delaysMs.length - 1})`);
      await new Promise(r => setTimeout(r, delaysMs[attempt]));
    }
    try {
      const data = await apiFetch('/users/me');
      return { ok: true, profile: data.profile || null };
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        await clearSession(); // token is bad — never keep retrying or looping on it
        return { ok: false, reason: 'unauthenticated' };
      }
      // Network error / server down / cold start — worth retrying.
      if (attempt === delaysMs.length - 1) {
        return { ok: false, reason: 'unreachable' };
      }
    }
  }
}

// Takes over the page with a friendly "can't connect" message + retry button.
// Used only when the backend never responded after all retries — deliberately
// does NOT redirect anywhere, since bouncing between pages with a dead
// backend is exactly what caused the login<->home loop before.
export function showConnectionError() {
  document.body.innerHTML = `
    <div class="wrap" style="justify-content:center;">
      <div class="card">
        <div class="step-title">Connect nahi ho pa raha 😕</div>
        <div class="step-sub">Server abhi respond nahi kar raha (pehli baar thoda time lag sakta hai). Internet check karo ya thodi der baad try karo.</div>
        <button class="primary" onclick="location.reload()">Dobara try karo</button>
      </div>
    </div>`;
}

// Must match the key used in settings.html — kept here too so logout()
// can wipe it without importing settings.html's script.
export const API_KEY_STORAGE_KEY = 'utkio_gemini_api_key';

// Cache-first profile display (stale-while-revalidate): only the small,
// non-sensitive display fields — never the full profile, and never
// anything auth-related. Used so the drawer/profile header can render
// instantly instead of waiting on a network round-trip every time.
// ALWAYS pair a cache read with a background apiFetch to revalidate —
// this is a display shortcut, not a replacement for the real data.
const PROFILE_CACHE_KEY = 'utkio_profile_cache';

export function getCachedProfileBasic() {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function setCachedProfileBasic({ name, email }) {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ name, email, cachedAt: Date.now() }));
  } catch (e) { /* ignore */ }
}

function clearCachedProfileBasic() {
  try { localStorage.removeItem(PROFILE_CACHE_KEY); } catch (e) { /* ignore */ }
}

// Recent chat sessions (used by the drawer's "Recent chats" list AND by
// history.html's own full list) — cached because both places used to
// fire their own independent GET /chat/sessions, so opening history.html
// alone fired it TWICE (once from mountDrawer(), once from history.html's
// own list) within milliseconds of each other for the exact same data.
export const CHAT_SESSIONS_CACHE_KEY = 'chat_sessions';
// Short TTL — this list changes right after every chat session (which is
// the core loop of the app), so it can't be cached long. This mainly
// exists to collapse the drawer-vs-page double-fetch above, not to skip
// fetches across a whole visit.
const CHAT_SESSIONS_CACHE_TTL_MS = 30 * 1000;

export async function getRecentChatSessions(opts) {
  const { value } = await cachedFetch(CHAT_SESSIONS_CACHE_KEY, () => apiFetch('/chat/sessions'), CHAT_SESSIONS_CACHE_TTL_MS, opts);
  return value;
}

/** Call right after a chat session is successfully saved so the drawer/
 *  history list picks up the new session on its very next read instead
 *  of hiding it for up to CHAT_SESSIONS_CACHE_TTL_MS. */
export function invalidateChatSessionsCache() {
  invalidateCache(CHAT_SESSIONS_CACHE_KEY);
}

// Local-write, batch-sync pattern for chat history: chat.html writes
// turns here as the conversation happens (crash-safe), then pushes the
// whole thing to the backend in one call when the session ends. If that
// push fails (app killed, network drop), the data stays here and
// syncPendingChatSession() picks it up next time the app opens.
export const PENDING_CHAT_SESSION_KEY = 'utkio_pending_chat_session';

// Called silently on every app open (from index.html's splash check), and
// also by chat.html right after a session ends. No UI, no blocking
// navigation — pure best-effort background sync of whatever chat session
// got stranded on-device. Returns the backend session_id on success (so
// chat.html can keep appending to the same session), or null otherwise.
export async function syncPendingChatSession() {
  let raw;
  try { raw = localStorage.getItem(PENDING_CHAT_SESSION_KEY); } catch (e) { return null; }
  if (!raw) return null;

  let payload;
  try { payload = JSON.parse(raw); } catch (e) {
    try { localStorage.removeItem(PENDING_CHAT_SESSION_KEY); } catch (_) { /* ignore */ }
    return null;
  }
  if (!payload || !Array.isArray(payload.messages) || !payload.messages.length) {
    try { localStorage.removeItem(PENDING_CHAT_SESSION_KEY); } catch (_) { /* ignore */ }
    return null;
  }

  try {
    const result = await apiFetch('/chat/sessions', { method: 'POST', body: JSON.stringify(payload) });
    try { localStorage.removeItem(PENDING_CHAT_SESSION_KEY); } catch (_) { /* ignore */ }
    invalidateChatSessionsCache(); // this session is now real — don't let a cached list hide it
    return result.session_id || null;
  } catch (err) {
    // 409 = session locked (its report was already generated — see the
    // resume-mode check in chatRoutes.js). This is a TERMINAL failure, not
    // a "try again later" one: the server will refuse this exact payload
    // forever, so retrying on every future app-open would just loop
    // silently forever. Drop it instead. In practice this shouldn't happen
    // — chat.html's own lock (has_report) stops the user from generating
    // new turns for a reported session before this ever fires — but this
    // is the backstop for whatever stale-state path got here anyway.
    if (err.status === 409) {
      console.warn('pending chat session was locked (report already generated) — discarding instead of retrying', err);
      try { localStorage.removeItem(PENDING_CHAT_SESSION_KEY); } catch (_) { /* ignore */ }
      return null;
    }
    // Still unreachable/still failing — leave it in place, we'll retry
    // on the next app open. Never throw from here; this must stay silent.
    console.warn('pending chat session sync failed, will retry later', err);
    return null;
  }
}

export async function logout() {
  await clearSession();
  clearCachedProfileBasic();
  invalidateAllCache(); // wipe plan/profile/sessions caches — next login must never show the previous account's cached data
  try { await secureRemoveItem(API_KEY_STORAGE_KEY); }
  catch (e) { console.warn('failed to clear API key on logout', e); }
  window.location.href = 'login.html';
}

// Call right after a successful login/signup/google-auth to send the user
// to the right place: onboarding.html if they haven't finished it yet,
// home.html (the app's hub) otherwise. Loop-safe: an invalid token clears
// itself instead of bouncing forever, and an unreachable server shows a
// retry screen instead of guessing where to send the user.
export async function goToPostAuthDestination(onStatus) {
  const result = await fetchProfileWithRetry(onStatus);
  if (result.ok) {
    window.location.href = (result.profile && result.profile.onboarding_completed)
      ? 'home.html'
      : 'onboarding.html';
  } else if (result.reason === 'unauthenticated') {
    window.location.href = 'login.html';
  } else {
    showConnectionError();
  }
}

// Guard for pages that require a *finished* profile (chat.html, profile.html
// etc). Redirects to login.html if not logged in (or if the token turns out
// to be invalid), or onboarding.html if logged in but onboarding isn't done
// yet. Returns the profile on success, or null (already handled the page).
export async function requireCompleteProfile(onStatus) {
  const s = await requireAuthOrRedirect();
  if (!s) return null;

  const result = await fetchProfileWithRetry(onStatus);
  if (result.ok) {
    if (!result.profile || !result.profile.onboarding_completed) {
      window.location.href = 'onboarding.html';
      return null;
    }
    return result.profile;
  } else if (result.reason === 'unauthenticated') {
    window.location.href = 'login.html';
    return null;
  } else {
    showConnectionError();
    return null;
  }
}
