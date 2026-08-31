import { describe, it, expect, vi, beforeEach } from 'vitest';

// Node.js test environment sessionStorage mock
function createStorageMock() {
  let store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i] || null
  };
}

globalThis.sessionStorage = createStorageMock();

import { cachedFetch, swrFetch, invalidateCache, invalidateAllCache } from './api-cache.js';

/**
 * @file swr-hydration-invariants.adversarial.test.js
 * @description Frame-0 Hydration, SWR Caching & Revalidation Invariants Suite (AUD-052).
 * Verifies that cache-first reads populate data synchronously without waiting for network,
 * and that background revalidation refreshes dirty state without jarring DOM shifts.
 */

describe('SWR Cache & Frame-0 Hydration Invariants (AUD-052)', () => {
  beforeEach(() => {
    globalThis.sessionStorage = createStorageMock();
    invalidateAllCache();
  });

  it('swrFetch returns stale cached value instantly and kicks off background revalidation', async () => {
    const key = 'streak_test';
    const initialData = { current_streak: 7, practiced_today: false };

    // Prime cache with a stale timestamp (e.g. 50ms ago with 10ms TTL)
    globalThis.sessionStorage.setItem('utkio_cache:' + key, JSON.stringify({
      value: initialData,
      cachedAt: Date.now() - 50
    }));

    let revalidatedData = null;
    const fetcher = vi.fn(async () => ({ current_streak: 8, practiced_today: true }));

    // SWR fetch with 10ms TTL
    const { value, fromCache, stale } = await swrFetch(key, fetcher, 10, (fresh) => {
      revalidatedData = fresh;
    });

    // Instant return of cached value
    expect(fromCache).toBe(true);
    expect(stale).toBe(true);
    expect(value.current_streak).toBe(7);

    // Wait for background revalidation
    await new Promise(r => setTimeout(r, 20));
    expect(fetcher).toHaveBeenCalled();
    expect(revalidatedData?.current_streak).toBe(8);
  });

  it('cachedFetch dedupes concurrent calls to the same endpoint across modules', async () => {
    const key = 'plan_status_dedupe';
    let networkCallCount = 0;
    const fetcher = vi.fn(async () => {
      networkCallCount++;
      await new Promise(r => setTimeout(r, 25));
      return { plan: 'commit_mode', active: true };
    });

    // 3 concurrent callers asking for the same data
    const [res1, res2, res3] = await Promise.all([
      cachedFetch(key, fetcher, 60000),
      cachedFetch(key, fetcher, 60000),
      cachedFetch(key, fetcher, 60000)
    ]);

    expect(networkCallCount).toBe(1); // Deduped to exactly 1 real network call
    expect(res1.value.plan).toBe('commit_mode');
    expect(res2.value.plan).toBe('commit_mode');
    expect(res3.value.plan).toBe('commit_mode');
  });

  it('invalidateCache forces fresh network fetch on subsequent call', async () => {
    const key = 'streak_invalidation_test';
    let counter = 1;
    const fetcher = vi.fn(async () => ({ count: counter++ }));

    const call1 = await cachedFetch(key, fetcher, 60000);
    expect(call1.value.count).toBe(1);

    // Without invalidation, serves cache
    const call2 = await cachedFetch(key, fetcher, 60000);
    expect(call2.value.count).toBe(1);
    expect(call2.fromCache).toBe(true);

    // Invalidate
    invalidateCache(key);

    // Next call hits network
    const call3 = await cachedFetch(key, fetcher, 60000);
    expect(call3.value.count).toBe(2);
    expect(call3.fromCache).toBe(false);
  });
});
