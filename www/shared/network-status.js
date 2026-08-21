// Proactive connectivity check, backed by the native `Network` Capacitor
// plugin (@capacitor/network — add to package.json, then run
// `npx cap sync android` so the native module gets linked into the
// Android project, same as SecureStorage in shared/secure-store.js).
//
// WHY THIS EXISTS: apiFetch() in shared/auth.js already handles the
// *reactive* case (a request fires, fails, we show "no internet").
// That's necessary but not sufficient — it means the user always pays
// for at least one full request+timeout cycle before finding out they're
// offline. isOnline() lets a caller check network status BEFORE firing a
// request, so we can fail fast with zero latency instead of waiting on a
// doomed fetch.
//
// Same lenient-fallback pattern as secure-store.js / mic-helpers.js: if
// the native plugin isn't present (browser preview, or a build that
// hasn't run `cap sync` since this was added), we fall back to the
// browser's `navigator.onLine`. That's a weaker signal (it only reflects
// "is there a network interface with a link", not "can we actually
// reach the internet" — e.g. connected to Wi-Fi with no upstream still
// reports `true`), but it's the best available signal in that
// environment and keeps this module safe to call unconditionally
// everywhere, on every platform, without extra guards at call sites.

function getPlugin() {
  return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Network) || null;
}

let warnedFallback = false;
function fallbackWarnOnce() {
  if (warnedFallback) return;
  warnedFallback = true;
  console.warn(
    '%c⚠️ Network native plugin not found — falling back to navigator.onLine.',
    'font-weight:bold;color:#fff;background:#c0392b;padding:2px 6px;border-radius:3px;',
    'Expected in browser preview. On a real device/build this means `npx cap sync android` ' +
    'was not run after adding @capacitor/network — offline detection will be less accurate.'
  );
}

// Returns { connected: boolean, connectionType: string }.
// Never throws — worst case (plugin missing AND navigator.onLine
// unavailable for some reason) it assumes online, so this can never be
// the thing that blocks a request that would otherwise have succeeded.
export async function getNetworkStatus() {
  const plugin = getPlugin();
  if (!plugin) {
    fallbackWarnOnce();
    const connected = typeof navigator !== 'undefined' && 'onLine' in navigator ? navigator.onLine : true;
    return { connected, connectionType: connected ? 'unknown' : 'none' };
  }
  try {
    const status = await plugin.getStatus();
    return { connected: !!status.connected, connectionType: status.connectionType || 'unknown' };
  } catch (e) {
    // Plugin present but call failed for some reason — don't let a
    // broken status check itself become the reason a request never
    // gets attempted.
    console.warn('Network.getStatus failed, assuming online', e);
    return { connected: true, connectionType: 'unknown' };
  }
}

export async function isOnline() {
  const status = await getNetworkStatus();
  return status.connected;
}

// Optional: subscribe to connectivity changes. Returns an unsubscribe
// function (always safe to call, even as a no-op when the plugin/event
// isn't available) so callers can clean up on page/component teardown
// without needing to know whether they're on native or web.
export function onNetworkChange(callback) {
  const plugin = getPlugin();
  if (plugin && typeof plugin.addListener === 'function') {
    let handle = null;
    let cancelled = false;
    plugin.addListener('networkStatusChange', (status) => {
      callback({ connected: !!status.connected, connectionType: status.connectionType || 'unknown' });
    }).then((h) => { if (cancelled) { h.remove(); } else { handle = h; } });
    return () => { cancelled = true; if (handle) handle.remove(); };
  }
  // Browser fallback via the standard online/offline window events.
  const onOnline = () => callback({ connected: true, connectionType: 'unknown' });
  const onOffline = () => callback({ connected: false, connectionType: 'none' });
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}
