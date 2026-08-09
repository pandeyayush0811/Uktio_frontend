// Shared across all pages: talks to the backend for signup/login/google,
// stores the Supabase session on-device, and guards pages that need auth.

const cfg = window.UKTIO_CONFIG;
const SESSION_KEY = 'utkio_session';

export function saveSession(session) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
  catch (e) { console.warn('saveSession failed', e); }
}

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); }
  catch (e) { /* ignore */ }
}

export function getAccessToken() {
  const s = getSession();
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
  const s = getSession();
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
      .then(({ ok, data }) => {
        if (ok && data.session) { saveSession(data.session); return data.session.access_token; }
        return s.access_token; // refresh failed — fall back to the old (soon-expired) token, let the call fail naturally rather than throwing here
      })
      .catch(() => s.access_token)
      .finally(() => { inFlightRefresh = null; });
  }
  return inFlightRefresh;
}

// Call at the top of any page that requires login. Redirects to login.html
// if there's no valid-looking session. Returns the session if present.
export function requireAuthOrRedirect() {
  const s = getSession();
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
export async function fetchProfileWithRetry(onStatus) {
  const delaysMs = [0, 2000, 4000, 8000]; // ~14s of retrying total, covers a cold start
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
        clearSession(); // token is bad — never keep retrying or looping on it
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

export function logout() {
  clearSession();
  clearCachedProfileBasic();
  try { localStorage.removeItem(API_KEY_STORAGE_KEY); }
  catch (e) { console.warn('failed to clear API key on logout', e); }
  window.location.href = 'login.html';
}

// Call right after a successful login/signup/google-auth to send the user
// to the right place: onboarding.html if they haven't finished it yet,
// chat.html otherwise. Loop-safe: an invalid token clears itself instead
// of bouncing forever, and an unreachable server shows a retry screen
// instead of guessing where to send the user.
export async function goToPostAuthDestination(onStatus) {
  const result = await fetchProfileWithRetry(onStatus);
  if (result.ok) {
    window.location.href = (result.profile && result.profile.onboarding_completed)
      ? 'chat.html'
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
  const s = requireAuthOrRedirect();
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
