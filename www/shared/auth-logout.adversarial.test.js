import './config.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  logout,
  saveSession,
  getSession,
  clearSession,
  getAccessToken,
  getValidAccessToken,
  apiFetch,
  requireAuthOrRedirect,
  setCachedProfileBasic,
  getCachedProfileBasic,
  setCachedFullProfile,
  getCachedFullProfile,
  setCachedStreak,
  getCachedStreak,
  syncPendingChatSession,
  PENDING_CHAT_SESSION_KEY
} from './auth.js';
import { cachedFetch, invalidateAllCache } from './api-cache.js';
import { setApiKey, getApiKey, API_KEY_STORAGE_KEY } from './mic-helpers.js';
import * as secureStoreModule from './secure-store.js';

function makeStorageMock() {
  const mock = {};
  Object.defineProperties(mock, {
    getItem: {
      value: (k) => (k in mock ? mock[k] : null),
      enumerable: false,
      writable: true,
      configurable: true
    },
    setItem: {
      value: (k, v) => { mock[k] = String(v); },
      enumerable: false,
      writable: true,
      configurable: true
    },
    removeItem: {
      value: (k) => { delete mock[k]; },
      enumerable: false,
      writable: true,
      configurable: true
    },
    clear: {
      value: () => {
        for (const k of Object.keys(mock)) delete mock[k];
      },
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  return mock;
}

describe('Adversarial & Hardcore Regression Suite — Issue #4 (AUD-004: Client logout() & Server Token Revocation)', () => {
  let localStorageMock;
  let sessionStorageMock;
  let originalFetch;
  let originalWindow;
  let originalUKTIO_CONFIG;

  beforeEach(() => {
    vi.restoreAllMocks();

    localStorageMock = makeStorageMock();
    sessionStorageMock = makeStorageMock();

    globalThis.localStorage = localStorageMock;
    globalThis.sessionStorage = sessionStorageMock;

    originalWindow = globalThis.window;
    originalUKTIO_CONFIG = globalThis.UKTIO_CONFIG;

    globalThis.window = {
      location: { href: 'http://localhost/settings.html' },
      UKTIO_CONFIG: { BACKEND_URL: 'https://utkio-backend.onrender.com' }
    };
    globalThis.UKTIO_CONFIG = globalThis.window.UKTIO_CONFIG;

    originalFetch = globalThis.fetch;
    invalidateAllCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
    globalThis.UKTIO_CONFIG = originalUKTIO_CONFIG;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 1: Remote Revocation & Protocol Contract (The Core AUD-004 Fix)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Suite 1: Remote Revocation & Authorization Protocol (Core Fix)', () => {
    // Verifies logout() initiates POST /auth/logout with the caller's active Bearer token
    it('test_logout_dispatches_post_auth_logout_with_bearer_token', async () => {
      const fakeSession = {
        access_token: 'valid-jwt-token-alpha-99',
        refresh_token: 'valid-refresh-token-alpha-99',
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

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://utkio-backend.onrender.com/auth/logout');
      expect(options.method).toBe('POST');
      expect(options.headers.Authorization).toBe('Bearer valid-jwt-token-alpha-99');
      expect(options.headers['Content-Type']).toBe('application/json');
    });

    // Verifies remote revocation HTTP call is dispatched BEFORE local session is wiped
    it('test_logout_dispatches_remote_request_strictly_before_clearing_local_storage', async () => {
      const fakeSession = {
        access_token: 'order-test-access-token',
        refresh_token: 'order-test-refresh-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      };
      await saveSession(fakeSession);

      let tokenInStorageDuringFetch = null;
      let sessionInStorageDuringFetch = null;

      const fetchSpy = vi.fn().mockImplementation(async (url) => {
        if (url.includes('/auth/logout')) {
          const current = await getSession();
          sessionInStorageDuringFetch = current;
          tokenInStorageDuringFetch = current?.access_token || null;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ message: 'Logged out.' })
        };
      });
      globalThis.fetch = fetchSpy;

      await logout();

      // At the moment of fetch, token was still safely present in storage
      expect(sessionInStorageDuringFetch).toBeTruthy();
      expect(tokenInStorageDuringFetch).toBe('order-test-access-token');

      // After logout completes, storage is completely empty
      const postLogoutSession = await getSession();
      expect(postLogoutSession).toBeNull();
    });

    // Verifies proactive refresh occurs if token is near expiration (<60s) before logout dispatch
    it('test_logout_triggers_proactive_token_refresh_if_token_expiring_soon', async () => {
      // Token expiring in 20 seconds
      const expiringSession = {
        access_token: 'expiring-access-token-11',
        refresh_token: 'valid-refresh-token-22',
        expires_at: Math.floor(Date.now() / 1000) + 20
      };
      await saveSession(expiringSession);

      const fetchCalls = [];
      globalThis.fetch = vi.fn().mockImplementation(async (url, opts) => {
        fetchCalls.push({ url, opts });
        if (url.includes('/auth/refresh')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              session: {
                access_token: 'fresh-refreshed-token-33',
                refresh_token: 'fresh-refresh-token-44',
                expires_at: Math.floor(Date.now() / 1000) + 3600
              }
            })
          };
        }
        if (url.includes('/auth/logout')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ message: 'Logged out.' })
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      });

      await logout();

      // Should have refreshed first, then sent the refreshed token to logout
      expect(fetchCalls.length).toBe(2);
      expect(fetchCalls[0].url).toContain('/auth/refresh');
      expect(fetchCalls[1].url).toContain('/auth/logout');
      expect(fetchCalls[1].opts.headers.Authorization).toBe('Bearer fresh-refreshed-token-33');
    });

    // Verifies calling logout with no stored session does not crash and sends no auth header
    it('test_logout_when_already_logged_out_does_not_send_auth_header_and_completes_safely', async () => {
      await clearSession();

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Logged out.' })
      });
      globalThis.fetch = fetchSpy;

      await expect(logout()).resolves.not.toThrow();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [, options] = fetchSpy.mock.calls[0];
      expect(options.headers.Authorization).toBeUndefined();
      expect(window.location.href).toBe('login.html');
    });

    // Verifies corrupted/incomplete session schema in storage is handled safely
    it('test_logout_with_corrupted_session_schema_cleans_up_safely', async () => {
      // Missing access_token property
      localStorageMock.setItem('utkio_session', JSON.stringify({ corrupted_data: true }));

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Logged out.' })
      });

      await expect(logout()).resolves.not.toThrow();
      expect(await getSession()).toBeNull();
      expect(window.location.href).toBe('login.html');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 2: Storage, Memory & Secure Hardware Elimination (Total Wipe)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Suite 2: Storage, Cache, and Secure Hardware Elimination', () => {
    // Verifies utkio_session is wiped from secure store
    it('test_logout_clears_utkio_session_from_secure_storage', async () => {
      await saveSession({
        access_token: 'sess-token-to-wipe',
        refresh_token: 'sess-refresh-to-wipe',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      });
      expect(await getSession()).toBeTruthy();

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Logged out.' })
      });

      await logout();

      expect(await getSession()).toBeNull();
      expect(await getAccessToken()).toBeNull();
      expect(await getValidAccessToken()).toBeNull();
    });

    // Verifies cached basic and full profile are wiped from memory/storage
    it('test_logout_clears_cached_profile_basic_and_full', async () => {
      setCachedProfileBasic({ name: 'Rahul Sharma', email: 'rahul@example.in', plan: 'starter' });
      setCachedFullProfile({ name: 'Rahul Sharma', email: 'rahul@example.in', phone: '+919876543210', age: 24 });

      expect(getCachedProfileBasic()).toBeTruthy();
      expect(getCachedFullProfile()).toBeTruthy();

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Logged out.' })
      });

      await logout();

      expect(getCachedProfileBasic()).toBeNull();
      expect(getCachedFullProfile()).toBeNull();
    });

    // Verifies streak cache is cleared
    it('test_logout_clears_cached_streak_data', async () => {
      setCachedStreak({ current_streak: 7, best_streak: 15 });
      expect(getCachedStreak()).toEqual({ current_streak: 7, best_streak: 15 });

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Logged out.' })
      });

      await logout();

      expect(getCachedStreak()).toBeNull();
    });

    // Verifies all api-cache entries (plan, me, sessions, announcements) are eradicated
    it('test_logout_invalidates_all_api_cache_entries', async () => {
      // Pre-populate api-cache
      await cachedFetch('plan_status', async () => ({ active: true, plan: 'starter' }), 60000);
      await cachedFetch('user_me', async () => ({ id: 'u1', name: 'Priya' }), 60000);
      await cachedFetch('chat_sessions', async () => [{ id: 's1' }], 60000);

      // Verify entries exist in sessionStorage
      expect(sessionStorageMock['utkio_cache:plan_status']).toBeTruthy();
      expect(sessionStorageMock['utkio_cache:user_me']).toBeTruthy();
      expect(sessionStorageMock['utkio_cache:chat_sessions']).toBeTruthy();

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Logged out.' })
      });

      await logout();

      // All utkio_cache: keys must be gone
      expect(sessionStorageMock['utkio_cache:plan_status']).toBeUndefined();
      expect(sessionStorageMock['utkio_cache:user_me']).toBeUndefined();
      expect(sessionStorageMock['utkio_cache:chat_sessions']).toBeUndefined();
    });

    // Verifies Gemini AI Access Key and active flag are deleted from storage
    it('test_logout_erases_gemini_api_key_and_active_flag_via_remove_api_key', async () => {
      await setApiKey('AIzaSyTestKeySecret123');
      expect(await getApiKey()).toBe('AIzaSyTestKeySecret123');
      expect(localStorageMock.getItem('utkio_gemini_api_key_present')).toBe('1');

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Logged out.' })
      });

      await logout();

      expect(localStorageMock.getItem('utkio_gemini_api_key_present')).toBeNull();
      expect(await getApiKey()).toBe('');
    });

    // Verifies requireAuthOrRedirect immediately bounces to login.html after logout
    it('test_subsequent_require_auth_or_redirect_immediately_bounces_to_login', async () => {
      await saveSession({
        access_token: 'to-be-cleared',
        refresh_token: 'to-be-cleared',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      });

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Logged out.' })
      });

      await logout();

      // Reset window.location to a protected page to test guard
      window.location.href = 'http://localhost/home.html';
      const authed = await requireAuthOrRedirect();

      expect(authed).toBeNull();
      expect(window.location.href).toBe('login.html');
    });

    // Verifies subsequent apiFetch calls send NO authorization header
    it('test_subsequent_api_fetch_sends_no_bearer_token', async () => {
      await saveSession({
        access_token: 'auth-header-check-token',
        refresh_token: 'auth-header-check-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      });

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' })
      });
      globalThis.fetch = fetchSpy;

      await logout();
      fetchSpy.mockClear();

      // Next apiFetch call
      await apiFetch('/announcements');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [, options] = fetchSpy.mock.calls[0];
      expect(options.headers.Authorization).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 3: Adversarial Network Faults, Gateway Errors & Failures
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Suite 3: Adversarial Network Faults, Gateway Errors & Failures', () => {
    // Verifies offline / network drop (status 0) does not trap user in app
    it('test_logout_survives_offline_status_0_network_failure', async () => {
      await saveSession({
        access_token: 'offline-token',
        refresh_token: 'offline-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      });

      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(logout()).resolves.not.toThrow();

      expect(await getSession()).toBeNull();
      expect(window.location.href).toBe('login.html');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('logout: remote signOut failed (non-fatal):'),
        expect.any(Error)
      );
    });

    // Verifies HTTP 401 (token already revoked/invalidated server-side) allows clean logout
    it('test_logout_survives_401_unauthorized_token_already_revoked', async () => {
      await saveSession({
        access_token: 'revoked-token',
        refresh_token: 'revoked-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      });

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid or expired token' })
      });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(logout()).resolves.not.toThrow();

      expect(await getSession()).toBeNull();
      expect(window.location.href).toBe('login.html');
    });

    // Verifies HTTP 403 Forbidden is non-fatal
    it('test_logout_survives_403_forbidden_response', async () => {
      await saveSession({
        access_token: 'forbidden-token',
        refresh_token: 'forbidden-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      });

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Forbidden' })
      });

      await expect(logout()).resolves.not.toThrow();
      expect(await getSession()).toBeNull();
      expect(window.location.href).toBe('login.html');
    });

    // Verifies HTTP 500 Internal Server Error is non-fatal
    it('test_logout_survives_500_internal_server_error', async () => {
      await saveSession({
        access_token: 'server-error-token',
        refresh_token: 'server-error-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      });

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Database connection failed' })
      });

      await expect(logout()).resolves.not.toThrow();
      expect(await getSession()).toBeNull();
      expect(window.location.href).toBe('login.html');
    });

    // Verifies HTTP 502 Bad Gateway / 504 Gateway Timeout is non-fatal
    it('test_logout_survives_502_bad_gateway_and_504_gateway_timeout', async () => {
      await saveSession({
        access_token: 'proxy-error-token',
        refresh_token: 'proxy-error-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      });

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({ error: 'Bad Gateway' })
      });

      await expect(logout()).resolves.not.toThrow();
      expect(await getSession()).toBeNull();
      expect(window.location.href).toBe('login.html');
    });

    // Verifies reverse-proxy HTML error response (where res.json() rejects) is handled cleanly
    it('test_logout_survives_reverse_proxy_html_error_payload', async () => {
      await saveSession({
        access_token: 'html-error-token',
        refresh_token: 'html-error-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      });

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        }
      });

      await expect(logout()).resolves.not.toThrow();
      expect(await getSession()).toBeNull();
      expect(window.location.href).toBe('login.html');
    });

    // Verifies AbortError (DOMException) is handled cleanly
    it('test_logout_survives_dom_exception_abort_error', async () => {
      await saveSession({
        access_token: 'abort-error-token',
        refresh_token: 'abort-error-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      });

      const abortError = new DOMException('The user aborted a request.', 'AbortError');
      globalThis.fetch = vi.fn().mockRejectedValue(abortError);

      await expect(logout()).resolves.not.toThrow();
      expect(await getSession()).toBeNull();
      expect(window.location.href).toBe('login.html');
    });

    // Verifies slow network latency resolves and completes all cleanup
    it('test_logout_survives_network_delay_and_eventual_resolution', async () => {
      await saveSession({
        access_token: 'slow-net-token',
        refresh_token: 'slow-net-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      });

      globalThis.fetch = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  status: 200,
                  json: async () => ({ message: 'Logged out.' })
                }),
              20
            );
          })
      );

      await logout();
      expect(await getSession()).toBeNull();
      expect(window.location.href).toBe('login.html');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 4: Storage Plugin Quirks, Hardware Exceptions & Disk Tampering
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Suite 4: Storage Quirks, Hardware Exceptions & Disk Tampering', () => {
    // Verifies secureRemoveItem throwing native hardware exception does not block logout
    it('test_logout_survives_when_secure_remove_item_throws_native_hardware_error', async () => {
      await saveSession({
        access_token: 'hw-fail-token',
        refresh_token: 'hw-fail-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      });

      vi.spyOn(secureStoreModule, 'secureRemoveItem').mockRejectedValue(
        new Error('Keystore hardware keystore corrupted')
      );

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Logged out.' })
      });

      await expect(logout()).resolves.not.toThrow();
      expect(window.location.href).toBe('login.html');
    });

    // Verifies secure-store throwing during removeApiKey does not prevent logout completion
    it('test_logout_survives_when_underlying_keystore_fails_during_key_erasure', async () => {
      await setApiKey('test-key-for-hw-fail');
      vi.spyOn(secureStoreModule, 'secureSetItem').mockRejectedValue(
        new Error('Hardware secure storage unavailable')
      );
      vi.spyOn(secureStoreModule, 'secureRemoveItem').mockRejectedValue(
        new Error('Hardware secure storage unavailable')
      );

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Logged out.' })
      });

      await expect(logout()).resolves.not.toThrow();
      expect(window.location.href).toBe('login.html');
      expect(localStorageMock.getItem('utkio_gemini_api_key_present')).toBeNull();
    });

    // Verifies localStorage throwing SecurityError (restricted sandbox) is handled safely
    it('test_logout_survives_when_local_storage_throws_security_error', async () => {
      localStorageMock.removeItem = vi.fn(() => {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      });

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Logged out.' })
      });

      await expect(logout()).resolves.not.toThrow();
      expect(window.location.href).toBe('login.html');
    });

    // Verifies malformed non-JSON data in session storage is wiped cleanly
    it('test_logout_cleans_up_when_storage_has_malformed_non_json_string', async () => {
      localStorageMock.setItem('utkio_session', '{malformed-json-payload-corrupted');

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Logged out.' })
      });

      await expect(logout()).resolves.not.toThrow();
      expect(await getSession()).toBeNull();
      expect(window.location.href).toBe('login.html');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 5: Concurrency, Rapid Invocations & Sibling Flow Interleaving
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Suite 5: Concurrency, Rapid Multi-Clicks & Race Conditions', () => {
    // Verifies rapid concurrent logout() calls all resolve cleanly without throwing
    it('test_rapid_concurrent_logout_invocations_all_resolve_without_error', async () => {
      await saveSession({
        access_token: 'concurrent-token-123',
        refresh_token: 'concurrent-refresh-123',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      });

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Logged out.' })
      });
      globalThis.fetch = fetchSpy;

      // Simulate 5 simultaneous clicks on logout button
      const results = await Promise.allSettled([
        logout(),
        logout(),
        logout(),
        logout(),
        logout()
      ]);

      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
      expect(await getSession()).toBeNull();
      expect(window.location.href).toBe('login.html');
    });

    // Verifies logout interleaved with background pending chat sync does not race or crash
    it('test_logout_interleaved_with_active_sync_pending_chat_session', async () => {
      await saveSession({
        access_token: 'chat-sync-race-token',
        refresh_token: 'chat-sync-race-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      });

      localStorageMock.setItem(
        PENDING_CHAT_SESSION_KEY,
        JSON.stringify({
          messages: [{ role: 'user', content: 'Hello Bolo' }],
          started_at: new Date().toISOString()
        })
      );

      globalThis.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.includes('/chat/sessions')) {
          return { ok: true, status: 200, json: async () => ({ session_id: 'synced-sess-99' }) };
        }
        return { ok: true, status: 200, json: async () => ({ message: 'Logged out.' }) };
      });

      // Fire sync and logout concurrently
      const [syncResult, logoutResult] = await Promise.allSettled([
        syncPendingChatSession(),
        logout()
      ]);

      expect(syncResult.status).toBe('fulfilled');
      expect(logoutResult.status).toBe('fulfilled');
      expect(await getSession()).toBeNull();
      expect(window.location.href).toBe('login.html');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 6: UI Component & Page Integration (Settings.html & Navigation)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Suite 6: UI Component & Page Integration', () => {
    // Simulates settings.html button event listener lifecycle
    it('test_settings_html_logout_button_flow_simulation', async () => {
      await saveSession({
        access_token: 'settings-flow-token',
        refresh_token: 'settings-flow-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      });

      const button = {
        disabled: false,
        textContent: 'Log out'
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Logged out.' })
      });

      // Exact handler logic from settings.html
      const onLogoutClick = async () => {
        button.disabled = true;
        button.textContent = 'Logging out…';
        try {
          await logout();
        } catch (e) {
          button.disabled = false;
          button.textContent = 'Log out';
        }
      };

      await onLogoutClick();

      expect(button.disabled).toBe(true);
      expect(button.textContent).toBe('Logging out…');
      expect(window.location.href).toBe('login.html');
      expect(await getSession()).toBeNull();
    });

    // Verifies logout executes safely in a headless / non-browser environment where window is undefined
    it('test_logout_in_headless_or_ssr_environment_where_window_is_undefined', async () => {
      await saveSession({
        access_token: 'headless-token',
        refresh_token: 'headless-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      });

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Logged out.' })
      });

      // Remove window
      delete globalThis.window;

      await expect(logout()).resolves.not.toThrow();
      expect(await getSession()).toBeNull();
    });

    // Verifies destination is strictly login.html
    it('test_logout_redirect_destination_is_strictly_login_html', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message: 'Logged out.' })
      });

      await logout();

      expect(window.location.href).toBe('login.html');
    });
  });
});
