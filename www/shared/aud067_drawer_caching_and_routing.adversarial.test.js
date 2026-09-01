// Role: 06_TestWriter (Senior Frontend Adversarial QA)
// Issue: AUD-067 (Drawer L2 Disk Caching, Type-Aware Routing & Frame-0 Projection)
// Target Files: shared/drawer.js, shared/auth.js
// Classification: Frontend-Triggered / Multi-Tier Storage Architecture & Navigation

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import './config.js';

describe('AUD-067: Adversarial & Stress Test Suite — Drawer Caching, Type-Aware Routing & Avatar Initial', () => {
  const wwwDir = path.resolve(__dirname, '..');
  const drawerJsPath = path.resolve(wwwDir, 'shared/drawer.js');
  const authJsPath = path.resolve(wwwDir, 'shared/auth.js');

  let drawerJsSource = '';
  let authJsSource = '';

  beforeEach(() => {
    drawerJsSource = fs.readFileSync(drawerJsPath, 'utf8');
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
  describe('AUD-067 Static AST & Navigation Contract Invariants', () => {
    // Why this matters: drawer.js must import and synchronously invoke getCachedRecentChats on mount to eliminate the 2s spinner on cold launch.
    it('AUD-067.AST.1: shared/drawer.js imports and invokes getCachedRecentChats for Frame-0 projection', () => {
      expect(drawerJsSource).toMatch(/import\s*\{[^}]*getCachedRecentChats[^}]*\}\s*from\s*['"]\.\/auth\.js['"]/);
      expect(drawerJsSource).toContain('getCachedRecentChats()');
    });

    // Why this matters: auth.js must export persistent L2 helpers for recent chats.
    it('AUD-067.AST.2: shared/auth.js exports getCachedRecentChats, setCachedRecentChats, and clearCachedRecentChats', () => {
      expect(authJsSource).toMatch(/export\s+function\s+getCachedRecentChats\s*\(/);
      expect(authJsSource).toMatch(/export\s+function\s+setCachedRecentChats\s*\(/);
      expect(authJsSource).toMatch(/export\s+function\s+clearCachedRecentChats\s*\(/);
    });

    // Why this matters: auth.js logout() must invoke clearCachedRecentChats() to prevent recent chats leaking to the next account.
    it('AUD-067.AST.3: shared/auth.js logout() must invoke clearCachedRecentChats()', () => {
      const logoutMatch = authJsSource.match(/export\s+async\s+function\s+logout\s*\(\)\s*\{([\s\S]*?)\}/);
      expect(logoutMatch).toBeTruthy();
      expect(logoutMatch[1]).toContain('clearCachedRecentChats()');
    });

    // Why this matters: Clicking a scenario session in the drawer must NOT blindly navigate to chat.html?resume= (destroying scenario context).
    it('AUD-067.AST.4: shared/drawer.js click handler inspects session_type and implements type-aware routing', () => {
      // Must not have unqualified item click unconditionally setting chat.html?resume=
      const hasUnconditionalChatResume = /item\.addEventListener\(['"]click['"],\s*\(\)\s*=>\s*window\.location\.href\s*=\s*['"]chat\.html\?resume=['"]\s*\+\s*s\.id\)/.test(drawerJsSource);
      expect(hasUnconditionalChatResume, 'drawer.js must not unconditionally redirect all session types to chat.html?resume=').toBe(false);

      // Must branch on session_type === 'scenario'
      expect(drawerJsSource).toMatch(/isScenario|session_type\s*===?\s*['"]scenario['"]/);
      expect(drawerJsSource).toContain('report.html');
      expect(drawerJsSource).toContain('scenario.html');
    });

    // Why this matters: Drawer avatar header should display personalized initial badge matching profile.html rather than static anonymous vector icon.
    it('AUD-067.AST.5: shared/drawer.js contains avatar initial letter container matching profile.html styling', () => {
      expect(drawerJsSource).toContain('drawerAvatarInitial');
      expect(drawerJsSource).toContain('drawerAvatarFallback');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2: Runtime Unit, Type-Aware Routing & Storage Mechanics
  // ═══════════════════════════════════════════════════════════════════════════
  describe('AUD-067 Runtime Caching, Unified Slicing & Adversarial Scenarios', () => {
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

    // Why this matters: getCachedRecentChats must safely parse valid JSON or return null on corrupted JSON without crashing.
    it('AUD-067.RUN.1: getCachedRecentChats handles corrupted JSON in localStorage gracefully', () => {
      mockLocalStorage['utkio_recent_chats_cache'] = 'INVALID_JSON_CORRUPT<<<';
      expect(() => {
        const res = authModule.getCachedRecentChats();
        expect(res).toBeNull();
      }).not.toThrow();

      mockLocalStorage['utkio_recent_chats_cache'] = '12345';
      expect(authModule.getCachedRecentChats()).toBe(12345);
    });

    // Why this matters: setCachedRecentChats must limit the stored list to maximum 5 compact items.
    it('AUD-067.RUN.2: setCachedRecentChats slices arrays to maximum 5 items to protect localStorage budget', () => {
      const tenSessions = Array.from({ length: 10 }, (_, i) => ({
        id: `sess_${i}`,
        session_type: i % 2 === 0 ? 'freeform' : 'scenario',
        started_at: new Date(Date.now() - i * 60000).toISOString(),
        ended_at: new Date(Date.now() - i * 60000 + 30000).toISOString(),
        turn_count: 5 + i
      }));

      authModule.setCachedRecentChats(tenSessions);
      const stored = JSON.parse(mockLocalStorage['utkio_recent_chats_cache']);
      expect(Array.isArray(stored)).toBe(true);
      expect(stored.length).toBe(5);
      expect(stored[0].id).toBe('sess_0');
      expect(stored[4].id).toBe('sess_4');
    });

    // Why this matters: setCachedRecentChats ignores non-array inputs without mutating storage.
    it('AUD-067.RUN.3: setCachedRecentChats ignores non-array or null/undefined inputs', () => {
      mockLocalStorage['utkio_recent_chats_cache'] = JSON.stringify([{ id: 'valid_sess' }]);
      authModule.setCachedRecentChats(null);
      authModule.setCachedRecentChats('not_an_array');
      authModule.setCachedRecentChats({ id: 'single_object' });

      const stored = JSON.parse(mockLocalStorage['utkio_recent_chats_cache']);
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe('valid_sess');
    });

    // Why this matters: clearCachedRecentChats must remove the utkio_recent_chats_cache key.
    it('AUD-067.RUN.4: clearCachedRecentChats removes utkio_recent_chats_cache on logout', () => {
      mockLocalStorage['utkio_recent_chats_cache'] = JSON.stringify([{ id: 'sess_1' }]);
      authModule.clearCachedRecentChats();
      expect(mockLocalStorage['utkio_recent_chats_cache']).toBeUndefined();
    });

    // Why this matters: If history.html already downloaded chat_sessions into sessionStorage, getRecentChatSessions({ limit: 5 }) must slice from it without firing a new HTTP request.
    it('AUD-067.RUN.5: getRecentChatSessions({ limit: 5 }) derives data from existing full chat_sessions cache (Unified Cache Slicing)', async () => {
      const fullHistorySessions = Array.from({ length: 8 }, (_, i) => ({
        id: `full_sess_${i}`,
        session_type: 'freeform',
        started_at: new Date().toISOString(),
        turn_count: 4 + i
      }));

      // Simulate full history cache populated by history.html
      mockSessionStorage['utkio_cache:chat_sessions'] = JSON.stringify({
        value: { sessions: fullHistorySessions },
        expiresAt: Date.now() + 60000
      });

      const res = await authModule.getRecentChatSessions({ limit: 5 });
      expect(res).toBeTruthy();
      expect(res.sessions).toBeDefined();
      expect(res.sessions.length).toBe(5);
      expect(res.sessions[0].id).toBe('full_sess_0');

      // Must also update L2 disk cache
      expect(mockLocalStorage['utkio_recent_chats_cache']).toBeDefined();
      const l2Stored = JSON.parse(mockLocalStorage['utkio_recent_chats_cache']);
      expect(l2Stored.length).toBe(5);
    });

    // Why this matters: When offline on cold start, getRecentChatSessions falls back to L2 disk cache instead of throwing fatal exception.
    it('AUD-067.RUN.6: getRecentChatSessions returns L2 disk cached sessions with offline flag when network rejects', async () => {
      const mockDiskSessions = [
        { id: 'offline_sess_1', session_type: 'freeform', turn_count: 6, started_at: new Date().toISOString() },
        { id: 'offline_sess_2', session_type: 'scenario', turn_count: 4, started_at: new Date().toISOString() }
      ];
      mockLocalStorage['utkio_recent_chats_cache'] = JSON.stringify(mockDiskSessions);

      // Ensure sessionStorage is empty
      mockSessionStorage = {};

      // Stub fetch to simulate immediate offline rejection
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network offline')));

      const result = await authModule.getRecentChatSessions({ limit: 5 });
      expect(result).toBeTruthy();
      expect(result.sessions).toEqual(mockDiskSessions);
      expect(result.offline).toBe(true);
      expect(result.fromCache).toBe(true);
    });

    // Why this matters: If recent chats cache is empty but history cache exists on disk, getRecentChatSessions({ limit: 5 }) falls back to history cache.
    it('AUD-067.RUN.7: getRecentChatSessions falls back to getCachedHistorySessions if recent chats cache is empty', async () => {
      const mockHistorySessions = [
        { id: 'hist_1', session_type: 'scenario', turn_count: 10, started_at: new Date().toISOString() },
        { id: 'hist_2', session_type: 'freeform', turn_count: 12, started_at: new Date().toISOString() }
      ];
      mockLocalStorage['utkio_history_cache'] = JSON.stringify(mockHistorySessions);

      // Ensure recent chats is empty
      delete mockLocalStorage['utkio_recent_chats_cache'];
      mockSessionStorage = {};

      // Stub fetch to simulate immediate offline rejection
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network offline')));

      const result = await authModule.getRecentChatSessions({ limit: 5 });
      expect(result).toBeTruthy();
      expect(result.sessions).toHaveLength(2);
      expect(result.sessions[0].id).toBe('hist_1');
      expect(result.offline).toBe(true);
    });

    // Why this matters: Storage quota exception inside setCachedRecentChats must not crash.
    it('AUD-067.RUN.8: setCachedRecentChats swallows QuotaExceededError defensively', () => {
      global.localStorage.setItem = vi.fn(() => {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      });

      expect(() => {
        authModule.setCachedRecentChats([{ id: 'quota_sess' }]);
      }).not.toThrow();
    });

    // Why this matters: clearCachedRecentChats handles storage exceptions cleanly
    it('AUD-067.RUN.9: clearCachedRecentChats swallows storage exceptions defensively', () => {
      global.localStorage.removeItem = vi.fn(() => {
        throw new Error('SecurityError: Access is denied');
      });
      expect(() => authModule.clearCachedRecentChats()).not.toThrow();
    });
  });
});
