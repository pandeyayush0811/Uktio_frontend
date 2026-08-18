import { API_KEY_STORAGE_KEY } from './auth.js';
import { secureGetItem, secureSetItem, secureRemoveItem, migrateLegacyKey } from './secure-store.js';

// The user's own Gemini API key — this is real money on their Google
// billing account, so it lives in encrypted on-device storage (Android
// Keystore / iOS Keychain via secure-store.js), not plain localStorage.
// settings.html writes it, chat.html/quiz.html/voice-live-session.js only
// read it — this was previously the exact same three-line function
// copy-pasted into both pages separately.
let migratedOnce = false;
async function ensureMigrated() {
  if (migratedOnce) return;
  migratedOnce = true;
  await migrateLegacyKey(API_KEY_STORAGE_KEY, API_KEY_STORAGE_KEY);
}

export async function getApiKey() {
  await ensureMigrated();
  try {
    const v = await secureGetItem(API_KEY_STORAGE_KEY);
    return (v || '').trim();
  } catch (e) { return ''; }
}

export async function setApiKey(value) {
  await ensureMigrated();
  const v = (value || '').trim();
  if (!v) { await removeApiKey(); return; }
  await secureSetItem(API_KEY_STORAGE_KEY, v);
}

export async function removeApiKey() {
  await secureRemoveItem(API_KEY_STORAGE_KEY);
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
// have their own fallback path when the mic isn't available (e.g.
// quiz.html falls back to auto-skipping the speak question instead of
// crashing).
export function getMicCapturePluginOrNull() {
  if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.MicCapture) return null;
  return window.Capacitor.Plugins.MicCapture;
}
