// Encrypted on-device storage for secrets (session tokens, the user's own
// Gemini API key) — backed by Android Keystore / iOS Keychain via the
// native `SecureStorage` Capacitor plugin (@aparajita/capacitor-secure-storage,
// added to package.json — run `npx cap sync android` after installing so
// the native module gets linked into the Android project).
//
// Same calling convention as MicCapture elsewhere in this codebase
// (`window.Capacitor.Plugins.<Name>`) — no bundler needed, since Capacitor
// exposes registered native plugins on that global regardless of whether
// the JS npm wrapper is imported. We talk to the plugin's raw methods
// directly (internalGetItem/internalSetItem/internalRemoveItem) and
// replicate the small amount of prefixing logic the npm package's JS
// wrapper would otherwise add, so we don't have to vendor/bundle it.
//
// Falls back to localStorage when the native plugin isn't present yet
// (browser preview during development, or a build that hasn't run
// `cap sync` since this was added) — same lenient-fallback pattern as
// getMicCapturePluginOrNull(). This keeps `npm run dev`-style browser
// preview working without a native build, while real devices get real
// encryption. A loud one-time console warning marks the fallback so it's
// obvious in logs if a *shipped* build is ever missing the native plugin.

const KEY_PREFIX = 'utkio_secure_';
let warnedFallback = false;

function getPlugin() {
  return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SecureStorage) || null;
}

function fallbackWarnOnce() {
  if (warnedFallback) return;
  warnedFallback = true;
  console.warn(
    '%c⚠️ SecureStorage native plugin not found — falling back to plain localStorage.',
    'font-weight:bold;color:#fff;background:#c0392b;padding:2px 6px;border-radius:3px;',
    'This is expected in browser preview. On a real device/build this means `npx cap sync android` ' +
    'was not run after adding the plugin — secrets will NOT be encrypted. Fix before shipping.'
  );
}

export async function secureGetItem(key) {
  const plugin = getPlugin();
  if (!plugin) {
    fallbackWarnOnce();
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  try {
    const { data } = await plugin.internalGetItem({ prefixedKey: KEY_PREFIX + key });
    return data === undefined ? null : data;
  } catch (e) {
    console.warn('secureGetItem failed for', key, e);
    return null;
  }
}

export async function secureSetItem(key, value) {
  const plugin = getPlugin();
  if (!plugin) {
    fallbackWarnOnce();
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }
  try {
    await plugin.internalSetItem({ prefixedKey: KEY_PREFIX + key, data: value });
    return true;
  } catch (e) {
    console.warn('secureSetItem failed for', key, e);
    return false;
  }
}

export async function secureRemoveItem(key) {
  const plugin = getPlugin();
  if (!plugin) {
    fallbackWarnOnce();
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
    return;
  }

  // ROOT-CAUSE FIX: on real devices, @aparajita/capacitor-secure-storage's
  // native `internalRemoveItem` has been observed to silently fail (throw,
  // or no-op) on Android even though `internalSetItem`/`internalGetItem`
  // work perfectly fine — this is why a "deleted" API key kept reappearing
  // after logout -> login: the delete call never actually removed
  // anything, and the very next read still found the old value.
  //
  // Fix: never rely on remove as the ONLY erasure mechanism. Overwrite the
  // value with an empty string using the SAME internalSetItem call path
  // that we already know works reliably (proven by the fact that saved
  // keys are correctly read back elsewhere in the app). Every reader in
  // this codebase (getApiKey, getSession, etc.) already treats an empty
  // string as "nothing saved" — '' is falsy, so `raw ? ... : null` and
  // `(v || '').trim()` both already do the right thing with no other
  // changes needed. We still attempt the real native remove afterwards,
  // best-effort, purely as extra hygiene (actually free the storage
  // entry) — its failure is no longer load-bearing.
  let overwriteOk = false;
  try {
    await plugin.internalSetItem({ prefixedKey: KEY_PREFIX + key, data: '' });
    overwriteOk = true;
  } catch (e) {
    console.warn('secureRemoveItem: overwrite-with-empty failed for', key, e);
  }

  try { await plugin.internalRemoveItem({ prefixedKey: KEY_PREFIX + key }); }
  catch (e) {
    // Expected to sometimes fail per the note above — not fatal as long
    // as the overwrite above succeeded, since every reader treats '' as
    // "no value". Only worth a console note for debugging.
    console.warn('secureRemoveItem: native remove failed for', key, '(non-fatal, value was already overwritten)', e);
  }

  if (!overwriteOk) {
    // Both erasure paths failed — this is the one case that's genuinely
    // dangerous (old value could still be read back). Surface it loudly
    // so it shows up in device logs / crash reporting instead of vanishing
    // into a console.warn no one sees.
    console.error('secureRemoveItem: FAILED TO ERASE key', key, '— value may still be readable.');
  }
}

// One-time upgrade path: older app versions kept this data in plain
// localStorage under `legacyKey`. The first time a page reads a secure
// key and finds nothing, check localStorage — if something's there, move
// it into secure storage and wipe the plaintext copy, so upgrading users
// don't get silently logged out / lose their saved API key.
export async function migrateLegacyKey(legacyKey, secureKey) {
  let legacy = null;
  try { legacy = localStorage.getItem(legacyKey); } catch (e) { /* ignore */ }
  if (legacy === null || legacy === undefined) return;
  await secureSetItem(secureKey, legacy);
  try { localStorage.removeItem(legacyKey); } catch (e) { /* ignore */ }
}