// Role: 06_TestWriter (Senior Frontend Adversarial QA)
// Issue: AUD-068 (History L2 Disk Persistence, Non-Blocking Frame-0 Hydration & Offline Fallback)
// Target Files: history.html, shared/auth.js
// Classification: Frontend-Triggered / Multi-Tier Storage Architecture & Offline Resilience

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('AUD-068: Adversarial & Stress Test Suite — Chat History Caching, Frame-0 Projection & Offline Resilience', () => {
  const wwwDir = path.resolve(__dirname, '..');
  const historyHtmlPath = path.resolve(wwwDir, 'history.html');
  const authJsPath = path.resolve(wwwDir, 'shared/auth.js');

  let historyHtmlSource = '';
  let authJsSource = '';

  beforeEach(() => {
    historyHtmlSource = fs.readFileSync(historyHtmlPath, 'utf8');
    authJsSource = fs.readFileSync(authJsPath, 'utf8');

    if (typeof window !== 'undefined') {
      window.UKTIO_CONFIG = {
        ACTIVE_BACKEND: 'main',
        BACKENDS: {
          main: 'https://utkio-backend.onrender.com',
          local: 'http://localhost:3000'
        }
      };
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1: Static AST & Architectural Invariant Verification
  // ═══════════════════════════════════════════════════════════════════════════
  describe('AUD-068 Static AST & Non-Blocking Invariants', () => {
    // Why this matters: Top-level await requireAuthOrRedirect() blocks JS execution on Android Keystore decryption for 100-300ms, causing skeleton flashes.
    it('AUD-068.AST.1: history.html must NOT execute top-level blocking await requireAuthOrRedirect() before synchronous Frame-0 disk cache reads', () => {
      const scriptMatch = historyHtmlSource.match(/<script\s+type="module">([\s\S]*?)<\/script>/i);
      expect(scriptMatch, 'history.html must contain a <script type="module">').toBeTruthy();
      const scriptBody = scriptMatch[1];

      // Check if top-level await requireAuthOrRedirect() exists at top of script
      const hasTopLevelBlockingAuth = /^\s*await\s+requireAuthOrRedirect\s*\(\s*\);/m.test(scriptBody);
      expect(hasTopLevelBlockingAuth, 'history.html must not use top-level await requireAuthOrRedirect() that blocks Frame-0 cache projection').toBe(false);
    });

    // Why this matters: history.html must import getCachedHistorySessions and setCachedHistorySessions for Frame-0 synchronous projection.
    it('AUD-068.AST.2: history.html imports getCachedHistorySessions and setCachedHistorySessions', () => {
      expect(historyHtmlSource).toMatch(/import\s*\{[^}]*getCachedHistorySessions[^}]*\}\s*from\s*['"]\.\/shared\/auth\.js['"]/);
      expect(historyHtmlSource).toMatch(/import\s*\{[^}]*setCachedHistorySessions[^}]*\}\s*from\s*['"]\.\/shared\/auth\.js['"]/);
      expect(historyHtmlSource).toContain('getCachedHistorySessions()');
      expect(historyHtmlSource).toContain('setCachedHistorySessions(');
    });

    // Why this matters: auth.js must export history disk persistence helpers.
    it('AUD-068.AST.3: shared/auth.js exports getCachedHistorySessions, setCachedHistorySessions, and clearCachedHistorySessions', () => {
      expect(authJsSource).toMatch(/export\s+function\s+getCachedHistorySessions\s*\(/);
      expect(authJsSource).toMatch(/export\s+function\s+setCachedHistorySessions\s*\(/);
      expect(authJsSource).toMatch(/export\s+function\s+clearCachedHistorySessions\s*\(/);
    });

    // Why this matters: auth.js logout() must invoke clearCachedHistorySessions() to guarantee complete cross-user history isolation.
    it('AUD-068.AST.4: shared/auth.js logout() must invoke clearCachedHistorySessions()', () => {
      const logoutMatch = authJsSource.match(/export\s+async\s+function\s+logout\s*\(\)\s*\{([\s\S]*?)\}/);
      expect(logoutMatch).toBeTruthy();
      expect(logoutMatch[1]).toContain('clearCachedHistorySessions()');
    });

    // Why this matters: When network fails on cold start, history.html must NOT show #listErr if cached sessions are already rendered.
    it('AUD-068.AST.5: history.html catch block guards against showing fatal error message if cached sessions exist', () => {
      expect(historyHtmlSource).toMatch(/if\s*\(\s*!allSessions\.length\s*\)\s*\{\s*const errEl/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2: Runtime Unit, Offline Resilience & Boundary Scenarios
  // ═══════════════════════════════════════════════════════════════════════════
  describe('AUD-068 Runtime History Caching, Pagination & Offline Scenarios', () => {
    let mockLocalStorage = {};
    let mockSessionStorage = {};
    let authModule = null;

    beforeEach(async () => {
      mockLocalStorage = {};
      mockSessionStorage = {};

      vi.stubGlobal('localStorage', {
        getItem: vi.fn((key) => mockLocalStorage[key] || null),
        setItem: vi.fn((key, val) => { mockLocalStorage[key] = String(val); }),
        removeItem: vi.fn((key) => { delete mockLocalStorage[key]; }),
        clear: vi.fn(() => { mockLocalStorage = {}; })
      });

      vi.stubGlobal('sessionStorage', {
        getItem: vi.fn((key) => mockSessionStorage[key] || null),
        setItem: vi.fn((key, val) => { mockSessionStorage[key] = String(val); }),
        removeItem: vi.fn((key) => { delete mockSessionStorage[key]; }),
        clear: vi.fn(() => { mockSessionStorage = {}; })
      });

      authModule = await import('./auth.js');
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    // Why this matters: getCachedHistorySessions must return null safely without throwing if localStorage is corrupted.
    it('AUD-068.RUN.1: getCachedHistorySessions handles corrupted JSON gracefully (returns null, no throw)', () => {
      mockLocalStorage['utkio_history_cache'] = 'INVALID_JSON_CORRUPTED<<<';
      expect(() => {
        const res = authModule.getCachedHistorySessions();
        expect(res).toBeNull();
      }).not.toThrow();

      mockLocalStorage['utkio_history_cache'] = 'true';
      expect(authModule.getCachedHistorySessions()).toBe(true);
    });

    // Why this matters: setCachedHistorySessions must write the initial 20 sessions to utkio_history_cache.
    it('AUD-068.RUN.2: setCachedHistorySessions bounds storage payload to initial 20 items', () => {
      const fiftySessions = Array.from({ length: 50 }, (_, i) => ({
        id: `history_sess_${i}`,
        session_type: i % 3 === 0 ? 'scenario' : 'freeform',
        started_at: new Date(Date.now() - i * 3600000).toISOString(),
        turn_count: 10 + i
      }));

      authModule.setCachedHistorySessions(fiftySessions);
      const stored = JSON.parse(mockLocalStorage['utkio_history_cache']);
      expect(Array.isArray(stored)).toBe(true);
      expect(stored.length).toBe(20);
      expect(stored[0].id).toBe('history_sess_0');
      expect(stored[19].id).toBe('history_sess_19');
    });

    // Why this matters: setCachedHistorySessions ignores non-array inputs without mutating storage.
    it('AUD-068.RUN.3: setCachedHistorySessions ignores non-array or null/undefined inputs', () => {
      mockLocalStorage['utkio_history_cache'] = JSON.stringify([{ id: 'existing_history_item' }]);
      authModule.setCachedHistorySessions(null);
      authModule.setCachedHistorySessions(undefined);
      authModule.setCachedHistorySessions({ not: 'array' });

      const stored = JSON.parse(mockLocalStorage['utkio_history_cache']);
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe('existing_history_item');
    });

    // Why this matters: clearCachedHistorySessions must wipe the history disk cache upon logout.
    it('AUD-068.RUN.4: clearCachedHistorySessions removes utkio_history_cache on logout', () => {
      mockLocalStorage['utkio_history_cache'] = JSON.stringify([{ id: 'sess_abc' }]);
      authModule.clearCachedHistorySessions();
      expect(mockLocalStorage['utkio_history_cache']).toBeUndefined();
    });

    // Why this matters: Storage quota exceptions must not crash the app.
    it('AUD-068.RUN.5: setCachedHistorySessions swallows Storage QuotaExceededError without crashing', () => {
      global.localStorage.setItem = vi.fn(() => {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      });

      expect(() => {
        authModule.setCachedHistorySessions([{ id: 'test_sess' }]);
      }).not.toThrow();
    });

    // Why this matters: When offline on cold start, getRecentChatSessions({ limit: 20 }) returns L2 disk cache.
    it('AUD-068.RUN.6: getRecentChatSessions returns L2 disk history cache when network rejects', async () => {
      const mockHistory = Array.from({ length: 15 }, (_, i) => ({
        id: `offline_hist_${i}`,
        session_type: 'freeform',
        turn_count: 8,
        started_at: new Date().toISOString()
      }));
      mockLocalStorage['utkio_history_cache'] = JSON.stringify(mockHistory);
      mockSessionStorage = {};

      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network offline')));

      const result = await authModule.getRecentChatSessions({ limit: 20 });
      expect(result).toBeTruthy();
      expect(result.sessions).toEqual(mockHistory);
      expect(result.offline).toBe(true);
      expect(result.fromCache).toBe(true);
    });

    // Why this matters: Pagination cursor requests (load more) must not overwrite the initial L2 disk cache.
    it('AUD-068.RUN.7: getRecentChatSessions with cursor (before) does not overwrite L2 root cache', async () => {
      const initialRootCache = [{ id: 'root_sess_1', started_at: '2026-09-01T00:00:00.000Z' }];
      mockLocalStorage['utkio_history_cache'] = JSON.stringify(initialRootCache);

      const olderPageSessions = [{ id: 'older_sess_1', started_at: '2026-08-01T00:00:00.000Z' }];

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ sessions: olderPageSessions, has_more: false })
      }));

      const res = await authModule.getRecentChatSessions({ limit: 20, before: '2026-08-15T00:00:00.000Z' });
      expect(res.sessions[0].id).toBe('older_sess_1');

      // Root L2 cache must still retain initial root sessions, not older page
      const diskStored = JSON.parse(mockLocalStorage['utkio_history_cache']);
      expect(diskStored[0].id).toBe('root_sess_1');
    });

    // Why this matters: auth.js must maintain backward-compatible aliases for legacy history cache getters/setters.
    it('AUD-068.RUN.8: auth.js maintains backwards-compatible alias exports for chat session caching', () => {
      expect(authModule.getCachedChatSessions).toBe(authModule.getCachedHistorySessions);
      expect(authModule.setCachedChatSessions).toBe(authModule.setCachedHistorySessions);
      expect(authModule.clearCachedChatSessions).toBe(authModule.clearCachedHistorySessions);
      expect(authModule.clearCachedHistory).toBe(authModule.clearCachedHistorySessions);
    });

    // Why this matters: clearCachedHistorySessions swallows storage errors defensively
    it('AUD-068.RUN.9: clearCachedHistorySessions swallows storage exceptions defensively', () => {
      global.localStorage.removeItem = vi.fn(() => {
        throw new Error('SecurityError: Access is denied');
      });
      expect(() => authModule.clearCachedHistorySessions()).not.toThrow();
    });
  });
});
