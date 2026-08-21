import { secureGetItem, secureSetItem, secureRemoveItem, migrateLegacyKey } from './secure-store.js';

// The user's own Gemini API key — this is real money on their Google
// billing account, so it lives in encrypted on-device storage (Android
// Keystore / iOS Keychain via secure-store.js), not plain localStorage.
// settings.html writes it, chat.html/scenario.html/voice-live-session.js only
// read it — this was previously the exact same three-line function
// copy-pasted into both pages separately.
//
// Home of the key's storage key name — moved here from auth.js (this is
// the module that actually owns get/set/remove for it; auth.js only
// needs to trigger removeApiKey() on logout, not know the storage key).
export const API_KEY_STORAGE_KEY = 'utkio_gemini_api_key';

// ─────────────────────────────────────────────────────────────────────────
// WHY THIS FILE DOESN'T TRUST THE SECURE-STORAGE PLUGIN FOR "IS A KEY
// SAVED?" ANYMORE
//
// Repro that exposed the bug: save a key -> logout -> log back in (even a
// fresh device flow) -> chat starts immediately with no key prompt ->
// Settings shows the "deleted" key still sitting there. This was 100%
// reproducible, not a race — meaning @aparajita/capacitor-secure-storage's
// native Android bridge cannot be trusted to actually perform a write or a
// removal every time it's asked to. get/read calls are fine (that's why
// the stale key kept surfacing correctly); it's specifically *mutating*
// calls (remove, and even overwrite-with-empty) that were observed to
// silently no-op on-device.
//
// Fix: presence/absence of the key is no longer decided by asking the
// secure-storage plugin "is anything there?". It's decided by a plain
// localStorage flag (ACTIVE_FLAG_KEY) — the exact same storage mechanism
// this app used for the API key BEFORE the secure-storage migration, which
// is on record as having never had this bug. The actual key *value* still
// lives encrypted in secure storage (that part — reading/writing a real
// value — has never been reported as broken), but whether the app
// considers a key "present" is gated entirely by this flag:
//   - setApiKey(value): writes to secure storage, THEN sets the flag.
//   - removeApiKey(): clears the flag FIRST (this is the operation that
//     must never fail), then best-effort tries to actually erase the
//     underlying secure-storage value for hygiene.
//   - getApiKey(): if the flag isn't set, returns '' WITHOUT even
//     consulting secure storage — so a native remove/overwrite that
//     silently failed can no longer resurrect a "deleted" key.
// ─────────────────────────────────────────────────────────────────────────
const ACTIVE_FLAG_KEY = 'utkio_gemini_api_key_present';
// Written into secure storage in place of the real key on delete, purely
// as defense-in-depth (so the raw value isn't just sitting there
// untouched) — never relied on for correctness, since ACTIVE_FLAG_KEY
// alone decides presence.
const DELETED_SENTINEL = '\u0000__UTKIO_KEY_DELETED__';

let migratedOnce = false;
async function ensureMigrated() {
  if (migratedOnce) return;
  migratedOnce = true;

  let hadLegacyPlaintext = false;
  try { hadLegacyPlaintext = localStorage.getItem(API_KEY_STORAGE_KEY) !== null; } catch (e) { /* ignore */ }

  await migrateLegacyKey(API_KEY_STORAGE_KEY, API_KEY_STORAGE_KEY);

  if (hadLegacyPlaintext) {
    // Upgrading user whose key just moved from plain localStorage into
    // secure storage for the first time — mark it active.
    try { localStorage.setItem(ACTIVE_FLAG_KEY, '1'); } catch (e) { /* ignore */ }
    return;
  }

  // Backward-compat bootstrap, one-time: devices that were already using
  // secure storage BEFORE the ACTIVE_FLAG_KEY gate existed have a real key
  // sitting in secure storage but no flag yet. Without this check, this
  // fix's rollout would wrongly tell every existing user "no key saved"
  // the moment they update. Adopt the existing value once instead.
  try {
    if (localStorage.getItem(ACTIVE_FLAG_KEY) !== '1') {
      const existing = await secureGetItem(API_KEY_STORAGE_KEY);
      if (existing && existing.trim() && existing !== DELETED_SENTINEL) {
        localStorage.setItem(ACTIVE_FLAG_KEY, '1');
      }
    }
  } catch (e) { /* ignore — worst case, this one user re-enters their key once */ }
}

export async function getApiKey() {
  await ensureMigrated();
  try {
    // Authoritative check — a native secure-storage bug (stale value that
    // failed to erase) can never leak through this gate.
    if (localStorage.getItem(ACTIVE_FLAG_KEY) !== '1') return '';
    const v = await secureGetItem(API_KEY_STORAGE_KEY);
    if (!v || v === DELETED_SENTINEL) return '';
    return v.trim();
  } catch (e) { return ''; }
}

export async function setApiKey(value) {
  await ensureMigrated();
  const v = (value || '').trim();
  if (!v) { await removeApiKey(); return; }
  await secureSetItem(API_KEY_STORAGE_KEY, v);
  // Flag goes up only AFTER the write attempt — if secureSetItem throws,
  // execution never reaches this line, so a failed save correctly leaves
  // the app believing no key is saved rather than lying about it.
  try { localStorage.setItem(ACTIVE_FLAG_KEY, '1'); } catch (e) { /* ignore */ }
}

export async function removeApiKey() {
  // THE fix: this is the one line that actually has to work, and it's
  // plain localStorage — proven reliable historically in this exact app.
  // From this instant on, getApiKey() returns '' no matter what the
  // secure-storage plugin does or doesn't manage to do underneath.
  // This line alone is what makes the FEATURE (re-enter key after logout)
  // correct — everything below is extra hardening for the separate,
  // narrower concern of not leaving the raw value sitting on disk.
  try { localStorage.removeItem(ACTIVE_FLAG_KEY); } catch (e) { /* ignore */ }

  // Hardened best-effort real erasure: retry a few times, overwrite with
  // random garbage (not just an empty string — some storage layers no-op
  // on an empty write, which is exactly the bug that caused this whole
  // investigation) before removing, and verify each attempt by reading
  // back. None of this is required for the app to behave correctly
  // (ACTIVE_FLAG_KEY already guarantees that) — it exists purely to
  // shrink the window in which a rooted-device / forensic-extraction
  // attacker could still recover the old key from raw storage.
  const attempts = 3;
  for (let i = 0; i < attempts; i++) {
    try {
      const garbage = DELETED_SENTINEL + '_' + cryptoRandomHex(24) + '_' + Date.now();
      await secureSetItem(API_KEY_STORAGE_KEY, garbage);
      await secureRemoveItem(API_KEY_STORAGE_KEY);

      const check = await secureGetItem(API_KEY_STORAGE_KEY);
      if (!check || check === garbage /* remove no-op'd, but at least it's garbage now, not the real key */ || check.startsWith(DELETED_SENTINEL)) {
        return; // good enough — real key value is gone either way
      }
    } catch (e) { /* fall through to retry */ }
  }
  // If we get here, secure storage genuinely would not cooperate after
  // several attempts. The app is still correct (flag is gone), so this is
  // logged for ops visibility, not surfaced to the user.
  console.error('removeApiKey: could not confirm underlying secure-storage erasure after retries — app-level delete is still safe (ACTIVE_FLAG_KEY cleared), but raw value may persist on disk.');
}

function cryptoRandomHex(bytes) {
  try {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    // Extremely unlikely (Web Crypto is universal in WebViews) — fall back
    // to Math.random rather than throwing out of a delete path.
    return String(Math.random()).slice(2) + String(Date.now());
  }
}

// Strict variant — throws a clear, actionable error if the native
// MicCapture plugin isn't available (e.g. running in browser preview
// instead of a real native build). Use this where the caller can't
// meaningfully continue without a mic (e.g. chat.html's live session).
export function getMicCapturePlugin() {
  if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.MicCapture) {
    throw new Error('MicCapture native plugin nahi mila — MainActivity.java mein registerPlugin(MicCapturePlugin.class) check karo, aur app rebuild karo.');
  }
  return window.Capacitor.Plugins.MicCapture;
}

// Lenient variant — returns null instead of throwing, for callers that
// have their own fallback path when the mic isn't available.
export function getMicCapturePluginOrNull() {
  if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.MicCapture) return null;
  return window.Capacitor.Plugins.MicCapture;
}