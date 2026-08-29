import './config.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logout, saveSession, getSession } from './auth.js';

function createStorageMock() {
  const store = {};
  return {
    getItem: vi.fn(k => (k in store ? store[k] : null)),
    setItem: vi.fn((k, v) => { store[k] = String(v); }),
    removeItem: vi.fn(k => { delete store[k]; }),
    clear: vi.fn(() => {
      for (const k of Object.keys(store)) delete store[k];
    }),
    _store: store
  };
}

describe('logout() behavior and resilience', () => {
  let localStorageMock;
  let sessionStorageMock;
  let originalFetch;

  beforeEach(() => {
    vi.restoreAllMocks();

    localStorageMock = createStorageMock();
    sessionStorageMock = createStorageMock();

    globalThis.localStorage = localStorageMock;
    globalThis.sessionStorage = sessionStorageMock;

    globalThis.window = {
      location: { href: 'http://localhost/settings.html' },
      UKTIO_CONFIG: { BACKEND_URL: 'https://utkio-backend.onrender.com' }
    };
    globalThis.UKTIO_CONFIG = globalThis.window.UKTIO_CONFIG;

    originalFetch = globalThis.fetch;
  });

  it('calls POST /auth/logout with Bearer token and redirects to login.html', async () => {
    const fakeSession = {
      access_token: 'fake-access-token-123',
      refresh_token: 'fake-refresh-token-456',
      expires_at: Math.floor(Date.now() / 1000) + 3600
    };
    await saveSession(fakeSession);

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message: 'Logged out.' })
    });
    globalThis.fetch = fetchSpy;

    await logout();

    // Verify remote call
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://utkio-backend.onrender.com/auth/logout');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer fake-access-token-123');

    // Verify local session cleared
    const remainingSession = await getSession();
    expect(remainingSession).toBeNull();

    // Verify redirect
    expect(window.location.href).toBe('login.html');
  });

  it('invokes POST /auth/logout BEFORE clearing local session token', async () => {
    const fakeSession = {
      access_token: 'active-token-order-test',
      refresh_token: 'active-refresh-order-test',
      expires_at: Math.floor(Date.now() / 1000) + 3600
    };
    await saveSession(fakeSession);

    let sessionExistedDuringFetch = null;
    const fetchSpy = vi.fn().mockImplementation(async () => {
      // Check if session is still in storage at the moment fetch is executed
      const current = await getSession();
      sessionExistedDuringFetch = !!(current && current.access_token);
      return {
        ok: true,
        status: 200,
        json: async () => ({ message: 'Logged out.' })
      };
    });
    globalThis.fetch = fetchSpy;

    await logout();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(sessionExistedDuringFetch).toBe(true);

    const afterSession = await getSession();
    expect(afterSession).toBeNull();
  });

  it('gracefully completes local cleanup and redirect when network is offline / fetch fails', async () => {
    const fakeSession = {
      access_token: 'offline-test-token',
      refresh_token: 'offline-test-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600
    };
    await saveSession(fakeSession);

    // Network level error (fetch throws TypeError / NetworkError)
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(logout()).resolves.not.toThrow();

    // Local session wiped
    const remainingSession = await getSession();
    expect(remainingSession).toBeNull();

    // Redirected
    expect(window.location.href).toBe('login.html');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('gracefully completes local cleanup when server returns 401 or 500', async () => {
    const fakeSession = {
      access_token: 'expired-test-token',
      refresh_token: 'expired-test-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600
    };
    await saveSession(fakeSession);

    // 401 Unauthorized from server
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid or expired token' })
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(logout()).resolves.not.toThrow();

    const remainingSession = await getSession();
    expect(remainingSession).toBeNull();
    expect(window.location.href).toBe('login.html');
  });

  it('does not throw when called with no active session', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message: 'Logged out.' })
    });

    await expect(logout()).resolves.not.toThrow();
    expect(window.location.href).toBe('login.html');
  });
});
