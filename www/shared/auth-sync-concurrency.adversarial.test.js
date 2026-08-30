import './config.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { syncPendingChatSession, PENDING_CHAT_SESSION_KEY, saveSession, getRecentChatSessions } from './auth.js';
import { invalidateAllCache } from './api-cache.js';

function createStableStorageMock() {
  const store = {};
  return {
    getItem(k) { return (k in store ? store[k] : null); },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; },
    clear() {
      for (const k of Object.keys(store)) delete store[k];
    },
    _store: store
  };
}

describe('AUD-024 ADVERSARIAL: Frontend Lifecycle Concurrency & syncPendingChatSession Mutex Suite', () => {
  const localStorageMock = createStableStorageMock();
  const sessionStorageMock = createStableStorageMock();
  let originalFetch;
  let originalWindow;
  let originalUKTIO_CONFIG;

  beforeEach(async () => {
    localStorageMock.clear();
    sessionStorageMock.clear();

    globalThis.localStorage = localStorageMock;
    globalThis.sessionStorage = sessionStorageMock;

    originalWindow = globalThis.window;
    originalUKTIO_CONFIG = globalThis.UKTIO_CONFIG;
    originalFetch = globalThis.fetch;

    globalThis.window = {
      location: { href: 'http://localhost/chat.html' },
      UKTIO_CONFIG: { BACKEND_URL: 'https://utkio-backend.onrender.com' },
      localStorage: localStorageMock,
      sessionStorage: sessionStorageMock
    };
    globalThis.UKTIO_CONFIG = globalThis.window.UKTIO_CONFIG;

    invalidateAllCache();

    await saveSession({
      access_token: 'fake-jwt-token',
      refresh_token: 'fake-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
    globalThis.UKTIO_CONFIG = originalUKTIO_CONFIG;
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. High-Concurrency & Multi-Caller Deduplication
  // ───────────────────────────────────────────────────────────────────────────

  // Catches missing mutex / race condition when multiple callers trigger simultaneously
  it('1. deduplicates 10 rapid concurrent syncPendingChatSession calls into exactly 1 HTTP POST fetch', async () => {
    const removeSpy = vi.spyOn(localStorageMock, 'removeItem');
    const pendingPayload = {
      session_id: null,
      started_at: '2026-08-30T08:00:00.000Z',
      ended_at: '2026-08-30T08:02:00.000Z',
      session_type: 'freeform',
      messages: [{ role: 'user', content: 'Hello' }, { role: 'assistant', content: 'Hi' }]
    };

    localStorageMock.setItem(PENDING_CHAT_SESSION_KEY, JSON.stringify(pendingPayload));

    let fetchCallCount = 0;
    let resolveNetworkResponse;
    const networkPromise = new Promise((resolve) => { resolveNetworkResponse = resolve; });

    globalThis.fetch = vi.fn().mockImplementation(async () => {
      fetchCallCount++;
      await networkPromise;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ session_id: 'sess-dedup-10-callers', turn_count: 2 })
      };
    });

    const promises = Array.from({ length: 10 }, () => syncPendingChatSession());
    resolveNetworkResponse();
    const results = await Promise.all(promises);

    for (const res of results) expect(res).toBe('sess-dedup-10-callers');
    expect(fetchCallCount).toBe(1);
    expect(removeSpy).toHaveBeenCalledWith(PENDING_CHAT_SESSION_KEY);
    expect(localStorageMock.getItem(PENDING_CHAT_SESSION_KEY)).toBeNull();
  });

  // Catches lifecycle collision between page unload keepalive and session finish handlers
  it('2. simulates chat.html & scenario.html lifecycle: handles concurrent finalizeAndSyncSession and handlePageExit ({ keepalive: true })', async () => {
    const removeSpy = vi.spyOn(localStorageMock, 'removeItem');
    const pendingPayload = {
      session_id: null,
      started_at: '2026-08-30T08:10:00.000Z',
      ended_at: '2026-08-30T08:13:00.000Z',
      session_type: 'scenario',
      scenario_key: 'restaurant_order',
      messages: [{ role: 'assistant', content: 'Welcome' }, { role: 'user', content: 'Table for two' }]
    };

    localStorageMock.setItem(PENDING_CHAT_SESSION_KEY, JSON.stringify(pendingPayload));

    let networkBlocked = true;
    let finishNetwork;
    const networkGate = new Promise((res) => { finishNetwork = res; });

    globalThis.fetch = vi.fn().mockImplementation(async () => {
      if (networkBlocked) await networkGate;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ session_id: 'sess-scenario-999', turn_count: 2 })
      };
    });

    const normalSyncPromise = syncPendingChatSession();
    const pageExitSyncPromise = syncPendingChatSession({ keepalive: true });

    networkBlocked = false;
    finishNetwork();

    const [id1, id2] = await Promise.all([normalSyncPromise, pageExitSyncPromise]);
    expect(id1).toBe('sess-scenario-999');
    expect(id2).toBe('sess-scenario-999');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledWith(PENDING_CHAT_SESSION_KEY);
  });

  // Catches history page load firing sync while previous page is still completing sync
  it('3. simulates history.html load: getRecentChatSessions shares in-flight sync promise without double-POSTing', async () => {
    const pendingPayload = {
      session_id: null,
      started_at: '2026-08-30T08:20:00.000Z',
      ended_at: '2026-08-30T08:22:00.000Z',
      session_type: 'freeform',
      messages: [{ role: 'user', content: 'Turn 1' }, { role: 'assistant', content: 'Turn 2' }]
    };

    localStorageMock.setItem(PENDING_CHAT_SESSION_KEY, JSON.stringify(pendingPayload));

    let finishPost;
    const postGate = new Promise((r) => { finishPost = r; });

    globalThis.fetch = vi.fn().mockImplementation(async (url, opts) => {
      if (url.includes('/chat/sessions') && opts?.method === 'POST') {
        await postGate;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ session_id: 'sess-hist-sync', turn_count: 2 })
        };
      }
      if (url.includes('/chat/sessions') && (!opts?.method || opts.method === 'GET')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            sessions: [{ id: 'sess-hist-sync', started_at: '2026-08-30T08:20:00.000Z', turn_count: 2, session_type: 'freeform' }]
          })
        };
      }
      return { ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({}) };
    });

    const pSync = syncPendingChatSession();
    const pHistory = getRecentChatSessions();

    finishPost();

    const [syncRes, historyData] = await Promise.all([pSync, pHistory]);

    expect(syncRes).toBe('sess-hist-sync');
    expect(historyData).toBeDefined();
    expect(Array.isArray(historyData.sessions)).toBe(true);
    expect(historyData.sessions[0].id).toBe('sess-hist-sync');

    const postCalls = globalThis.fetch.mock.calls.filter(c => c[0].includes('/chat/sessions') && c[1]?.method === 'POST');
    expect(postCalls.length).toBe(1);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Mutex Lifecycle & Sequential State Transitions
  // ───────────────────────────────────────────────────────────────────────────

  // Catches locked mutex that prevents subsequent distinct sessions from saving
  it('4. resets syncInFlightPromise upon completion so subsequent distinct sync calls can proceed', async () => {
    const payload1 = {
      session_id: null,
      started_at: '2026-08-30T08:00:00.000Z',
      ended_at: '2026-08-30T08:02:00.000Z',
      session_type: 'freeform',
      messages: [{ role: 'user', content: 'Turn 1' }]
    };

    localStorageMock.setItem(PENDING_CHAT_SESSION_KEY, JSON.stringify(payload1));

    globalThis.fetch = vi.fn().mockImplementation(async (url, opts) => {
      const body = JSON.parse(opts.body);
      const isFirst = body.started_at === '2026-08-30T08:00:00.000Z';
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ session_id: isFirst ? 'sess-first' : 'sess-second', turn_count: 1 })
      };
    });

    const res1 = await syncPendingChatSession();
    expect(res1).toBe('sess-first');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    const payload2 = {
      session_id: null,
      started_at: '2026-08-30T09:00:00.000Z',
      ended_at: '2026-08-30T09:05:00.000Z',
      session_type: 'freeform',
      messages: [{ role: 'user', content: 'New session turn' }]
    };
    localStorageMock.setItem(PENDING_CHAT_SESSION_KEY, JSON.stringify(payload2));

    const res2 = await syncPendingChatSession();
    expect(res2).toBe('sess-second');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Error Resilience & Recovery
  // ───────────────────────────────────────────────────────────────────────────

  // Catches unhandled network error locking the mutex permanently and discarding unsynced data
  it('5. resets mutex on transient network error (500) and PRESERVES localStorage item for retry', async () => {
    const removeSpy = vi.spyOn(localStorageMock, 'removeItem');
    const payload = {
      session_id: null,
      started_at: '2026-08-30T08:00:00.000Z',
      ended_at: '2026-08-30T08:02:00.000Z',
      session_type: 'freeform',
      messages: [{ role: 'user', content: 'Will fail once' }]
    };

    localStorageMock.setItem(PENDING_CHAT_SESSION_KEY, JSON.stringify(payload));

    let attempt = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      attempt++;
      if (attempt === 1) {
        return {
          ok: false,
          status: 500,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ error: 'Internal Server Error' })
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ session_id: 'sess-recovered', turn_count: 1 })
      };
    });

    const res1 = await syncPendingChatSession();
    expect(res1).toBeNull();
    expect(removeSpy).not.toHaveBeenCalledWith(PENDING_CHAT_SESSION_KEY);
    expect(localStorageMock.getItem(PENDING_CHAT_SESSION_KEY)).toBeDefined();

    const res2 = await syncPendingChatSession();
    expect(res2).toBe('sess-recovered');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(removeSpy).toHaveBeenCalledWith(PENDING_CHAT_SESSION_KEY);
    expect(localStorageMock.getItem(PENDING_CHAT_SESSION_KEY)).toBeNull();
  });

  // Catches endless retry loop on 409 locked session (report already generated)
  it('6. discards pending session on terminal 409 Conflict and resets mutex', async () => {
    const removeSpy = vi.spyOn(localStorageMock, 'removeItem');
    const payload = {
      session_id: 'sess-locked',
      started_at: '2026-08-30T08:00:00.000Z',
      ended_at: '2026-08-30T08:02:00.000Z',
      session_type: 'freeform',
      messages: [{ role: 'user', content: 'Late turn' }]
    };

    localStorageMock.setItem(PENDING_CHAT_SESSION_KEY, JSON.stringify(payload));

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ error: 'locked', message: 'Report already generated' })
    });

    const res = await syncPendingChatSession();
    expect(res).toBeNull();
    expect(removeSpy).toHaveBeenCalledWith(PENDING_CHAT_SESSION_KEY);
    expect(localStorageMock.getItem(PENDING_CHAT_SESSION_KEY)).toBeNull();
  });

  // Catches endless retry loop on 402 Payment Required (trial credits exhausted)
  it('7. discards pending session on terminal 402 Payment Required and resets mutex', async () => {
    const removeSpy = vi.spyOn(localStorageMock, 'removeItem');
    const payload = {
      session_id: null,
      started_at: '2026-08-30T08:00:00.000Z',
      ended_at: '2026-08-30T08:02:00.000Z',
      session_type: 'freeform',
      messages: [{ role: 'user', content: 'Trial exhausted' }]
    };

    localStorageMock.setItem(PENDING_CHAT_SESSION_KEY, JSON.stringify(payload));

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ error: 'trial_exhausted', message: 'Trial exhausted' })
    });

    const res = await syncPendingChatSession();
    expect(res).toBeNull();
    expect(removeSpy).toHaveBeenCalledWith(PENDING_CHAT_SESSION_KEY);
    expect(localStorageMock.getItem(PENDING_CHAT_SESSION_KEY)).toBeNull();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Malformed Storage, Mutex Reset & Sibling Edge Cases
  // ───────────────────────────────────────────────────────────────────────────

  // Catches uncaught JSON.parse exceptions crashing caller and permanently locking mutex
  it('8. cleans up corrupted JSON payload in localStorage, returns null without network request, and releases mutex', async () => {
    const removeSpy = vi.spyOn(localStorageMock, 'removeItem');
    localStorageMock.setItem(PENDING_CHAT_SESSION_KEY, '{"corrupted_json: true');

    globalThis.fetch = vi.fn();

    const res = await syncPendingChatSession();
    expect(res).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalledWith(PENDING_CHAT_SESSION_KEY);
    expect(localStorageMock.getItem(PENDING_CHAT_SESSION_KEY)).toBeNull();
  });

  // Catches empty messages array payload and ensures mutex is released for subsequent syncs
  it('9. cleans up payload with empty messages array without making network call and releases mutex', async () => {
    const removeSpy = vi.spyOn(localStorageMock, 'removeItem');
    localStorageMock.setItem(PENDING_CHAT_SESSION_KEY, JSON.stringify({
      started_at: '2026-08-30T08:00:00.000Z',
      messages: []
    }));

    globalThis.fetch = vi.fn();

    const res = await syncPendingChatSession();
    expect(res).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalledWith(PENDING_CHAT_SESSION_KEY);
    expect(localStorageMock.getItem(PENDING_CHAT_SESSION_KEY)).toBeNull();
  });

  // Catches non-array messages property without crashing and releases mutex
  it('10. cleans up payload with non-array messages property without making network call and releases mutex', async () => {
    const removeSpy = vi.spyOn(localStorageMock, 'removeItem');
    localStorageMock.setItem(PENDING_CHAT_SESSION_KEY, JSON.stringify({
      started_at: '2026-08-30T08:00:00.000Z',
      messages: 'not-an-array'
    }));

    globalThis.fetch = vi.fn();

    const res = await syncPendingChatSession();
    expect(res).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalledWith(PENDING_CHAT_SESSION_KEY);
    expect(localStorageMock.getItem(PENDING_CHAT_SESSION_KEY)).toBeNull();
  });

  // Catches missing localStorage data returning null gracefully
  it('11. returns null when no pending session exists in localStorage and does not lock mutex', async () => {
    globalThis.fetch = vi.fn();

    const res = await syncPendingChatSession();
    expect(res).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
