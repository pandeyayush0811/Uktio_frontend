import { API_KEY_STORAGE_KEY } from './auth.js';

// The Gemini API key lives only in localStorage (settings.html writes it,
// chat.html/quiz.html only read it) — this was previously the exact same
// three-line function copy-pasted into both pages separately.
export function getApiKey() {
  try { return (localStorage.getItem(API_KEY_STORAGE_KEY) || '').trim(); }
  catch (e) { return ''; }
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
