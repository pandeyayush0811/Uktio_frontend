import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cachedFetch, swrFetch, invalidateCache, invalidateAllCache } from './api-cache.js';

// vitest's default environment is 'node' (no window/sessionStorage), and
// this module intentionally degrades to "no cache" if sessionStorage
// throws — so we polyfill a minimal in-memory sessionStorage here to
// actually exercise the caching path, not just the fallback path.
//
// Real browser Storage objects expose their stored keys as own
// enumerable string properties (so Object.keys(sessionStorage) returns
// exactly the stored keys, e.g. invalidateAllCache() relies on this) —
// this mock mirrors that by keeping data as plain enumerable props and
// its methods as non-enumerable ones.
function makeSessionStorageMock() {
  const mock = {};
  Object.defineProperties(mock, {
    getItem:    { value: k => (k in mock ? mock[k] : null), enumerable: false },
    setItem:    { value: (k, v) => { mock[k] = String(v); }, enumerable: false },
    removeItem: { value: k => { delete mock[k]; }, enumerable: false },
  });
  return mock;
}

beforeEach(() => {
  globalThis.sessionStorage = makeSessionStorageMock();
  invalidateAllCache();
});

describe('cachedFetch', () => {
  it('calls the fetcher on a cold cache and caches the result', async () => {
    const fetcher = vi.fn().mockResolvedValue({ email: 'a@b.com' });
    const r1 = await cachedFetch('me', fetcher, 60000);
    expect(r1.value).toEqual({ email: 'a@b.com' });
    expect(r1.fromCache).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('serves subsequent calls within ttlMs from cache with zero network calls', async () => {
    const fetcher = vi.fn().mockResolvedValue({ plan: 'starter' });
    await cachedFetch('plan', fetcher, 60000);
    const r2 = await cachedFetch('plan', fetcher, 60000);
    expect(r2.fromCache).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('refetches once the ttl has expired', async () => {
    const fetcher = vi.fn().mockResolvedValue({ plan: 'starter' });
    await cachedFetch('plan', fetcher, 5);
    await new Promise(r => setTimeout(r, 15));
    const r2 = await cachedFetch('plan', fetcher, 5);
    expect(r2.fromCache).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('dedupes concurrent in-flight calls for the same key into one network call', async () => {
    let resolveFetch;
    const fetcher = vi.fn().mockReturnValue(new Promise(res => { resolveFetch = res; }));
    const p1 = cachedFetch('sessions', fetcher, 60000);
    const p2 = cachedFetch('sessions', fetcher, 60000);
    resolveFetch({ sessions: [] });
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(r1.value).toEqual({ sessions: [] });
    expect(r2.value).toEqual({ sessions: [] });
  });

  it('force:true bypasses a fresh cache and hits the network again', async () => {
    const fetcher = vi.fn().mockResolvedValue({ active: true });
    await cachedFetch('plan', fetcher, 60000);
    await cachedFetch('plan', fetcher, 60000, { force: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('falls back to a stale cached value instead of throwing when a refetch fails', async () => {
    const okFetcher = vi.fn().mockResolvedValue({ plan: 'starter' });
    await cachedFetch('plan', okFetcher, 5);
    await new Promise(r => setTimeout(r, 15));
    const failFetcher = vi.fn().mockRejectedValue(new Error('network down'));
    const r = await cachedFetch('plan', failFetcher, 5);
    expect(r.value).toEqual({ plan: 'starter' });
    expect(r.stale).toBe(true);
  });

  it('throws when the fetch fails and there is no cached value at all', async () => {
    const failFetcher = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(cachedFetch('brandNewKey', failFetcher, 60000)).rejects.toThrow('network down');
  });
});

describe('swrFetch', () => {
  it('returns the pending fetch on a cold cache (nothing to show yet)', async () => {
    const fetcher = vi.fn().mockResolvedValue({ name: 'Riya' });
    const result = await swrFetch('me', fetcher, 60000);
    expect(result.value).toEqual({ name: 'Riya' });
    expect(result.fromCache).toBe(false);
  });

  it('returns a fresh cached value instantly with no revalidation call', async () => {
    const fetcher = vi.fn().mockResolvedValue({ name: 'Riya' });
    await cachedFetch('me', fetcher, 60000); // warm the cache
    const onRevalidated = vi.fn();
    const result = await swrFetch('me', fetcher, 60000, onRevalidated);
    expect(result.fromCache).toBe(true);
    expect(result.stale).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1); // only the warm-up call, no revalidation
  });

  it('returns a stale cached value immediately and revalidates in the background', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ name: 'Old Name' })
      .mockResolvedValueOnce({ name: 'New Name' });
    await cachedFetch('me', fetcher, 5); // warm the cache
    await new Promise(r => setTimeout(r, 15)); // let it go stale

    let revalidatedWith = null;
    const result = await swrFetch('me', fetcher, 5, v => { revalidatedWith = v; });
    expect(result.fromCache).toBe(true);
    expect(result.stale).toBe(true);
    expect(result.value).toEqual({ name: 'Old Name' }); // instant, no wait for the background call

    await new Promise(r => setTimeout(r, 10)); // let the background revalidation resolve
    expect(revalidatedWith).toEqual({ name: 'New Name' });
  });
});

describe('invalidateCache / invalidateAllCache', () => {
  it('invalidateCache forces the next call to hit the network again', async () => {
    const fetcher = vi.fn().mockResolvedValue({ plan: 'starter' });
    await cachedFetch('plan', fetcher, 60000);
    invalidateCache('plan');
    const r = await cachedFetch('plan', fetcher, 60000);
    expect(r.fromCache).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('invalidateAllCache clears every cached key, not just one', async () => {
    const fetcherA = vi.fn().mockResolvedValue('A');
    const fetcherB = vi.fn().mockResolvedValue('B');
    await cachedFetch('keyA', fetcherA, 60000);
    await cachedFetch('keyB', fetcherB, 60000);
    invalidateAllCache();
    await cachedFetch('keyA', fetcherA, 60000);
    await cachedFetch('keyB', fetcherB, 60000);
    expect(fetcherA).toHaveBeenCalledTimes(2);
    expect(fetcherB).toHaveBeenCalledTimes(2);
  });
});
