// Role: 06_TestWriter (Senior Frontend Adversarial QA)
// Issue: AUD-066 (Persistent Plan Caching & Non-Blocking Frame-0 Hydration)
// Target Files: shared/plan.js, settings.html, shared/auth.js, shared/style.css
// Classification: Frontend-Triggered / Multi-Tier Storage Architecture

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('AUD-066: Adversarial & Stress Test Suite — Cold-Start Persistent Plan Caching & Frame-0 Hydration', () => {
  const wwwDir = path.resolve(__dirname, '..');
  const planJsPath = path.resolve(wwwDir, 'shared/plan.js');
  const settingsHtmlPath = path.resolve(wwwDir, 'settings.html');
  const authJsPath = path.resolve(wwwDir, 'shared/auth.js');
  const styleCssPath = path.resolve(wwwDir, 'shared/style.css');

  let planJsSource = '';
  let settingsHtmlSource = '';
  let authJsSource = '';
  let styleCssSource = '';

  beforeEach(() => {
    planJsSource = fs.readFileSync(planJsPath, 'utf8');
    settingsHtmlSource = fs.readFileSync(settingsHtmlPath, 'utf8');
    authJsSource = fs.readFileSync(authJsPath, 'utf8');
    styleCssSource = fs.readFileSync(styleCssPath, 'utf8');

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
  describe('AUD-066 Static AST & Non-Blocking Frame-0 Invariants', () => {
    // Why this matters: Top-level await requireAuthOrRedirect() blocks the JS thread for 100-300ms on Android Keystore, causing visible FOUC with "—" dashes.
    it('AUD-066.AST.1: settings.html must NOT execute top-level blocking await requireAuthOrRedirect() before synchronous cache reads', () => {
      const scriptMatch = settingsHtmlSource.match(/<script\s+type="module">([\s\S]*?)<\/script>/i);
      expect(scriptMatch, 'settings.html must contain a <script type="module">').toBeTruthy();
      const scriptBody = scriptMatch[1];

      // Check if top-level await requireAuthOrRedirect() exists at the start of module
      const topLevelAwaitAuth = /^\s*await\s+requireAuthOrRedirect\s*\(\s*\);/m.test(scriptBody);
      expect(topLevelAwaitAuth, 'settings.html must not use top-level await requireAuthOrRedirect() that blocks Frame-0 cache rendering').toBe(false);
    });

    // Why this matters: Plan status must be read synchronously on Tick 0 (Frame-0) to eliminate layout shift and em-dash flicker.
    it('AUD-066.AST.2: settings.html must import and call getCachedPlanStatus and getCachedProfileBasic for Frame-0 projection', () => {
      expect(settingsHtmlSource).toMatch(/import\s*\{[^}]*getCachedPlanStatus[^}]*\}\s*from\s*['"]\.\/shared\/plan\.js['"]/);
      expect(settingsHtmlSource).toMatch(/import\s*\{[^}]*getCachedProfileBasic[^}]*\}\s*from\s*['"]\.\/shared\/auth\.js['"]/);
      expect(settingsHtmlSource).toContain('getCachedPlanStatus()');
      expect(settingsHtmlSource).toContain('getCachedProfileBasic()');
    });

    // Why this matters: shared/plan.js must expose disk cache primitives for instant hydration and logout purges.
    it('AUD-066.AST.3: shared/plan.js must export getCachedPlanStatus, setCachedPlanStatus, and clearCachedPlanStatus', () => {
      expect(planJsSource).toMatch(/export\s+function\s+getCachedPlanStatus\s*\(/);
      expect(planJsSource).toMatch(/export\s+function\s+setCachedPlanStatus\s*\(/);
      expect(planJsSource).toMatch(/export\s+function\s+clearCachedPlanStatus\s*\(/);
    });

    // Why this matters: auth.js logout() must invoke clearCachedPlanStatus() to prevent plan state leaking to a newly logged-in account.
    it('AUD-066.AST.4: shared/auth.js logout() must invoke clearCachedPlanStatus()', () => {
      const logoutMatch = authJsSource.match(/export\s+async\s+function\s+logout\s*\(\)\s*\{([\s\S]*?)\}/);
      expect(logoutMatch).toBeTruthy();
      expect(logoutMatch[1]).toContain('clearCachedPlanStatus()');
    });

    // Why this matters: CSS must contain skeleton shimmer animation classes for zero-FOUC state when cache is empty.
    it('AUD-066.AST.5: shared/style.css must define .skeleton-line or .skeleton-card with shimmer keyframes', () => {
      expect(styleCssSource).toContain('skeleton-line');
      expect(styleCssSource).toContain('shimmer');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2: Runtime Unit & Adversarial Caching Mechanics
  // ═══════════════════════════════════════════════════════════════════════════
  describe('AUD-066 Runtime Caching, Offline Fallback & Boundary Scenarios', () => {
    let mockLocalStorage = {};
    let mockSessionStorage = {};
    let planModule = null;

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

      planModule = await import('./plan.js');
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    // Why this matters: getCachedPlanStatus must return null safely without throwing if localStorage contains corrupted or malformed JSON.
    it('AUD-066.RUN.1: getCachedPlanStatus handles corrupted JSON gracefully (returns null, no throw)', () => {
      mockLocalStorage['utkio_plan_cache'] = 'INVALID_JSON{{{';
      expect(() => {
        const cached = planModule.getCachedPlanStatus ? planModule.getCachedPlanStatus() : null;
        expect(cached).toBeNull();
      }).not.toThrow();

      mockLocalStorage['utkio_plan_cache'] = '[object Object]';
      expect(planModule.getCachedPlanStatus()).toBeNull();
    });

    // Why this matters: setCachedPlanStatus must write valid plan objects with cachedAt timestamp to utkio_plan_cache.
    it('AUD-066.RUN.2: setCachedPlanStatus serializes plan data into localStorage under utkio_plan_cache with timestamp', () => {
      const mockPlan = {
        plan: 'commit_mode',
        active: true,
        plan_expires_at: '2026-10-15T00:00:00.000Z',
        trial: null
      };

      planModule.setCachedPlanStatus(mockPlan);
      const storedRaw = mockLocalStorage['utkio_plan_cache'];
      expect(storedRaw).toBeTruthy();
      const parsed = JSON.parse(storedRaw);
      expect(parsed.plan).toBe('commit_mode');
      expect(parsed.active).toBe(true);
      expect(typeof parsed.cachedAt).toBe('number');
    });

    // Why this matters: Passing null or undefined to setCachedPlanStatus must not overwrite existing cache or throw.
    it('AUD-066.RUN.3: setCachedPlanStatus ignores null or undefined inputs without mutating storage', () => {
      mockLocalStorage['utkio_plan_cache'] = JSON.stringify({ plan: 'starter', active: true });
      planModule.setCachedPlanStatus(null);
      planModule.setCachedPlanStatus(undefined);
      const stored = JSON.parse(mockLocalStorage['utkio_plan_cache']);
      expect(stored.plan).toBe('starter');
    });

    // Why this matters: clearCachedPlanStatus must delete utkio_plan_cache from localStorage.
    it('AUD-066.RUN.4: clearCachedPlanStatus purges utkio_plan_cache from localStorage', () => {
      mockLocalStorage['utkio_plan_cache'] = JSON.stringify({ plan: 'starter', active: true });
      planModule.clearCachedPlanStatus();
      expect(mockLocalStorage['utkio_plan_cache']).toBeUndefined();
    });

    // Why this matters: Low storage / private mode throws QuotaExceededError; setCachedPlanStatus must not crash the app.
    it('AUD-066.RUN.5: setCachedPlanStatus swallows Storage QuotaExceededError without crashing', () => {
      global.localStorage.setItem = vi.fn(() => {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      });

      expect(() => {
        planModule.setCachedPlanStatus({ plan: 'unlimited', active: true });
      }).not.toThrow();
    });

    // Why this matters: getPlanStatus() must fall back to L2 persistent disk cache when remote network fails completely.
    it('AUD-066.RUN.6: getPlanStatus() returns L2 persistent disk cache when network/apiFetch rejects', async () => {
      const mockDiskPlan = {
        plan: 'commit_mode',
        active: true,
        plan_expires_at: '2026-12-31T23:59:59.000Z',
        cachedAt: Date.now() - 5000
      };
      mockLocalStorage['utkio_plan_cache'] = JSON.stringify(mockDiskPlan);

      // Invalidate L1/sessionStorage
      if (planModule.invalidatePlanCache) {
        planModule.invalidatePlanCache();
      }

      // Stub fetch to simulate immediate offline rejection
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network offline')));

      const status = await planModule.getPlanStatus();
      expect(status).toBeTruthy();
      expect(status.plan).toBe('commit_mode');
      expect(status.active).toBe(true);
    });

    // Why this matters: getPlanStatus() writes fresh network responses directly into L2 disk storage.
    it('AUD-066.RUN.7: getPlanStatus() writes through fresh network response to L2 disk cache', async () => {
      const freshPlan = {
        plan: 'starter',
        active: true,
        plan_expires_at: '2026-11-20T00:00:00.000Z',
        trial: null
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => freshPlan
      }));

      const res = await planModule.getPlanStatus({ force: true });
      expect(res.plan).toBe('starter');
      expect(mockLocalStorage['utkio_plan_cache']).toBeDefined();
      const stored = JSON.parse(mockLocalStorage['utkio_plan_cache']);
      expect(stored.plan).toBe('starter');
      expect(stored.active).toBe(true);
    });

    // Why this matters: invalidatePlanCache must invalidate both L1 memory/sessionStorage and clear L2 disk cache.
    it('AUD-066.RUN.8: invalidatePlanCache invalidates L1 session cache and removes L2 disk cache', () => {
      mockLocalStorage['utkio_plan_cache'] = JSON.stringify({ plan: 'starter' });
      mockSessionStorage['utkio_cache:plan_status'] = JSON.stringify({ value: { plan: 'starter' }, expiresAt: Date.now() + 60000 });

      if (planModule.invalidatePlanCache) {
        planModule.invalidatePlanCache();
      }

      expect(mockLocalStorage['utkio_plan_cache']).toBeUndefined();
      expect(mockSessionStorage['utkio_cache:plan_status']).toBeUndefined();
    });

    // Why this matters: trialBannerText must format trial credit counts correctly and handle zero-remaining boundary state.
    it('AUD-066.RUN.9: trialBannerText handles active, exhausted and null trial states', () => {
      expect(planModule.trialBannerText(null)).toBeNull();
      expect(planModule.trialBannerText({ plan: 'starter', trial: null })).toBeNull();

      const activeTrial = {
        plan: 'none',
        trial: {
          active: true,
          chats_remaining: 3,
          scenarios_remaining: 1,
          reports_remaining: 2,
          days_left: 2
        }
      };
      const text = planModule.trialBannerText(activeTrial);
      expect(text).toContain('3 chats');
      expect(text).toContain('1 scenario');
      expect(text).toContain('2 reports');

      const exhaustedTrial = {
        plan: 'none',
        trial: {
          active: true,
          chats_remaining: 0,
          scenarios_remaining: 0,
          reports_remaining: 0,
          days_left: 1
        }
      };
      const exhaustedText = planModule.trialBannerText(exhaustedTrial);
      expect(exhaustedText).toContain('Free trial limits reached');
    });

    // Why this matters: requireActivePlan must allow paid users without blocking and fail-open on null status
    it('AUD-066.RUN.10: requireActivePlan handles paid, trial, and network failure states correctly', async () => {
      mockLocalStorage['utkio_plan_cache'] = JSON.stringify({ plan: 'starter', active: true });
      const resStarter = await planModule.requireActivePlan('chat');
      expect(resStarter).toBeTruthy();
      expect(resStarter.plan).toBe('starter');

      // Network down with empty cache (fails open with null)
      delete mockLocalStorage['utkio_plan_cache'];
      mockSessionStorage = {};
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network drop')));
      const resFailOpen = await planModule.requireActivePlan('chat');
      expect(resFailOpen).toBeNull();
    });

    // Why this matters: clearCachedPlanStatus handles exceptions if localStorage throws SecurityError
    it('AUD-066.RUN.11: clearCachedPlanStatus swallows storage exceptions defensively', () => {
      global.localStorage.removeItem = vi.fn(() => {
        throw new Error('SecurityError: Access is denied');
      });
      expect(() => planModule.clearCachedPlanStatus()).not.toThrow();
    });
  });
});
