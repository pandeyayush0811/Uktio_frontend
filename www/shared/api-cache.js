// Generic stale-while-revalidate cache for backend GET-ish reads that
// don't change often (own profile, plan status, recent chat sessions)
// but currently get re-fetched on almost every page open — home ->
// history -> settings -> back fires 5-6 backend hits in under 10
// seconds for data that was accurate 3 seconds ago. On a paid Render
// plan there's no free cold-start to hide that behind, so cutting the
// actual *request count* is what saves money, not just perceived speed.
//
// Two layers:
//   - `memory` (a plain Map, cleared on full reload) dedupes concurrent
//     callers within the SAME page load — e.g. drawer.js and a page's
//     own script both asking for '/chat/sessions' within a few ms of
//     each other collapse into exactly one network call.
//   - sessionStorage persists the last good value ACROSS page loads
//     (this app navigates between real .html documents, not client-side
//     routes, so module-level state alone doesn't survive a navigation)
//     but only for the lifetime of the app session — closing the app
//     clears it, so nothing goes stale for days on-device.
//
// Nothing here is sensitive: only cache display data you'd be fine
// showing for up to `ttlMs` after it changed server-side (profile
// name/email, plan label, recent chat list). Never cache auth tokens or
// anything security-relevant through this module — that's what
// shared/secure-store.js is for.

const PREFIX = 'utkio_cache:';
const inFlight = new Map(); // key -> Promise<value>, page-load-scoped

function readEntry(key) {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null; // corrupt entry or storage unavailable (private mode etc.) — treat as a cache miss
  }
}

function writeEntry(key, value) {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify({ value, cachedAt: Date.now() }));
  } catch (e) {
    // Quota exceeded or storage disabled — caching is a nice-to-have,
    // never let it break the actual data flow.
  }
}

/** Drop one cached key immediately — call this right after a mutation
 *  that makes the cached value wrong (e.g. plan just changed). */
export function invalidateCache(key) {
  try { sessionStorage.removeItem(PREFIX + key); } catch (e) { /* ignore */ }
  inFlight.delete(key);
}

/** Drop every cached key — call on logout so the next login never shows
 *  a flash of the previous account's cached name/plan/chats. */
export function invalidateAllCache() {
  try {
    Object.keys(sessionStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => sessionStorage.removeItem(k));
  } catch (e) { /* ignore */ }
  inFlight.clear();
}

/**
 * Await-style cache: resolves from cache with NO network call if the
 * entry is younger than ttlMs, otherwise fetches (deduped) and caches.
 * On a fetch failure, falls back to a stale cached value if one exists
 * rather than throwing — a transient blip shouldn't blank out a screen
 * that already had something to show.
 *
 * @param {string} key unique cache key, e.g. 'plan_status' or 'me'
 * @param {() => Promise<any>} fetcher performs the real network call
 * @param {number} ttlMs how long a cached value is served with zero network calls
 * @param {{force?: boolean}} [opts] force:true always bypasses the cache (use after a mutation you KNOW changed the server value, e.g. right after a payment succeeds)
 * @returns {Promise<{value: any, fromCache: boolean, stale?: boolean}>}
 */
export async function cachedFetch(key, fetcher, ttlMs, opts = {}) {
  if (!opts.force) {
    const entry = readEntry(key);
    if (entry && (Date.now() - entry.cachedAt) < ttlMs) {
      return { value: entry.value, fromCache: true };
    }
  }

  if (inFlight.has(key)) {
    const value = await inFlight.get(key);
    return { value, fromCache: false };
  }

  const promise = fetcher().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);

  try {
    const value = await promise;
    writeEntry(key, value);
    return { value, fromCache: false };
  } catch (err) {
    const stale = readEntry(key);
    if (stale) return { value: stale.value, fromCache: true, stale: true };
    throw err;
  }
}

/**
 * Stale-while-revalidate: returns whatever is cached (even if expired)
 * SYNCHRONOUSLY-ish (well, still a Promise, but resolves instantly with
 * no network wait) so the UI can render immediately with no spinner,
 * then calls onRevalidated(freshValue) once a background refresh
 * completes if the value actually changed. Use for "show something
 * instantly, correct it quietly if wrong" UI like the drawer header or
 * settings page — never for anything the user is about to act on based
 * on exact correctness (e.g. don't gate a purchase button on this).
 *
 * @returns {Promise<{value: any|null, fromCache: boolean}>} value is
 *   null only when there was truly nothing cached yet AND the caller
 *   should await the returned `pending` promise itself for the first-ever load.
 */
export function swrFetch(key, fetcher, ttlMs, onRevalidated) {
  const entry = readEntry(key);
  const isFresh = entry && (Date.now() - entry.cachedAt) < ttlMs;

  const kickOffRevalidate = () => {
    if (inFlight.has(key)) return inFlight.get(key);
    const promise = fetcher()
      .then(value => {
        writeEntry(key, value);
        if (onRevalidated && JSON.stringify(value) !== JSON.stringify(entry ? entry.value : undefined)) {
          onRevalidated(value);
        }
        return value;
      })
      .catch(() => { /* background revalidation failure is silent — cached/last-good value stands */ })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
    return promise;
  };

  if (entry && isFresh) {
    return Promise.resolve({ value: entry.value, fromCache: true, stale: false });
  }
  if (entry && !isFresh) {
    kickOffRevalidate(); // refresh in background, don't await it
    return Promise.resolve({ value: entry.value, fromCache: true, stale: true });
  }
  // Nothing cached at all yet — caller has no fallback to show, so hand
  // back the in-flight fetch itself for them to await.
  const pending = kickOffRevalidate();
  return pending.then(value => ({ value, fromCache: false, stale: false }));
}
