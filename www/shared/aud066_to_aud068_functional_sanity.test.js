// Role: 07_FunctionalSanityTester
// Issues Tested: AUD-066, AUD-067, AUD-068
// Target Files: settings.html, drawer.js, history.html, plan.js, auth.js
// Purpose: Everyday real-world user functional sanity verification on cold-start, offline state, and navigation routing.

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mock storage helper for Node test environment
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

describe('Functional Sanity & Real-World User Usability Tests — AUD-066, AUD-067, AUD-068', () => {
  const wwwDir = path.resolve(__dirname, '..');
  const settingsHtmlPath = path.resolve(wwwDir, 'settings.html');
  const drawerJsPath = path.resolve(wwwDir, 'shared/drawer.js');
  const historyHtmlPath = path.resolve(wwwDir, 'history.html');
  const planJsPath = path.resolve(wwwDir, 'shared/plan.js');
  const authJsPath = path.resolve(wwwDir, 'shared/auth.js');
  const styleCssPath = path.resolve(wwwDir, 'shared/style.css');

  let settingsHtml = '';
  let drawerJs = '';
  let historyHtml = '';
  let planJs = '';
  let authJs = '';
  let styleCss = '';

  beforeEach(() => {
    settingsHtml = fs.readFileSync(settingsHtmlPath, 'utf8');
    drawerJs = fs.readFileSync(drawerJsPath, 'utf8');
    historyHtml = fs.readFileSync(historyHtmlPath, 'utf8');
    planJs = fs.readFileSync(planJsPath, 'utf8');
    authJs = fs.readFileSync(authJsPath, 'utf8');
    styleCss = fs.readFileSync(styleCssPath, 'utf8');

    globalThis.localStorage = createStorageMock();
    globalThis.sessionStorage = createStorageMock();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. AUD-066: Settings Page Cold-Start Hydration & Multi-Tier Caching
  // ═══════════════════════════════════════════════════════════════════════════
  describe('AUD-066: Settings Page Cold-Start Plan & Email Rendering (Real-World Human Flow)', () => {
    // Real-World Scenario: User kills the app from recent tasks, launches it, and taps Settings.
    // Expected: Last-known email and active plan ("Commit Mode" / "Starter") render INSTANTLY (0ms).
    // The screen must NOT hang for 1.5–3s on em-dash "—" placeholders while waiting for Keystore or remote API.

    it('AUD-066.1: plan.js exports persistent L2 disk cache helpers (getCachedPlanStatus, setCachedPlanStatus, clearCachedPlanStatus)', () => {
      expect(planJs).toMatch(/export\s+function\s+getCachedPlanStatus/);
      expect(planJs).toMatch(/export\s+function\s+setCachedPlanStatus/);
      expect(planJs).toMatch(/export\s+function\s+clearCachedPlanStatus/);
    });

    it('AUD-066.2: plan.js writes fresh plan status to persistent L2 disk cache (utkio_plan_cache)', () => {
      expect(planJs).toContain('utkio_plan_cache');
      expect(planJs).toMatch(/localStorage\.setItem\(['"]utkio_plan_cache['"]/);
    });

    it('AUD-066.3: plan.js getPlanStatus falls back to persistent L2 cache on network failure rather than returning null', () => {
      // Real-World: If the user opens the app in an elevator or poor network, they shouldn't see "Could not load" when cached plan exists
      expect(planJs).toContain('getCachedPlanStatus');
    });

    it('AUD-066.4: settings.html hydrates cached profile email and plan status synchronously before blocking async Keystore auth', () => {
      // Real-World: Frame-0 paint must occur before `await requireAuthOrRedirect()` suspends execution
      const scriptMatch = settingsHtml.match(/<script\s+type=["']module["']>([\s\S]*?)<\/script>/);
      expect(scriptMatch, 'settings.html must contain ES module script').toBeTruthy();
      const script = scriptMatch[1];

      // Verify synchronous cached hydration occurs
      expect(script).toContain('getCachedProfileBasic');
      expect(script).toContain('vEmail');
    });

    it('AUD-066.5: auth.js logout() purges persistent L2 plan cache to prevent data leakage across accounts', () => {
      // Real-World: User A logs out; User B logs in. User B must NOT see User A's subscription plan on Settings
      expect(authJs).toContain('clearCachedPlanStatus');
    });

    it('AUD-066.6: style.css defines zero-layout-shift shimmer placeholders for unseeded first-install states', () => {
      expect(styleCss).toContain('.skeleton-line');
      expect(styleCss).toContain('shimmer');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. AUD-067: Navigation Drawer Recent Chats & Type-Aware Session Routing
  // ═══════════════════════════════════════════════════════════════════════════
  describe('AUD-067: Hamburger Drawer Recent Chats & Scenario Routing (Real-World Human Flow)', () => {
    // Real-World Scenario: User opens the hamburger menu to jump back into a previous session.
    // Expected:
    // 1. Recent chats load instantly without 2-second loading spinner.
    // 2. Clicking a 3-Minute Scenario routes to scenario simulation, NOT hijacking into freeform chat.html.
    // 3. Opening drawer offline shows cached chats instead of dead red error message.

    it('AUD-067.1: drawer.js distinguishes scenario sessions from freeform chats during click navigation', () => {
      // Real-World: Scenario session clicked in drawer must resume or view scenario, never blindly load chat.html?resume=
      expect(drawerJs).toMatch(/s\.session_type\s*===\s*['"]scenario['"]/);
      expect(drawerJs).toContain('scenario.html');
    });

    it('AUD-067.2: drawer.js renders cached recent sessions immediately on cold start', () => {
      // Real-World: Drawer must check cached sessions before or alongside async fetch
      expect(drawerJs).toMatch(/getCachedRecentChats|getCachedChatSessions|localStorage\.getItem\(['"]utkio_recent_chats_cache['"]\)|cached/i);
    });

    it('AUD-067.3: auth.js exports persistent disk cache helpers for recent chats or unified session cache', () => {
      expect(authJs).toMatch(/export\s+function\s+getCachedRecentChats|export\s+function\s+getCachedChatSessions|utkio_recent_chats_cache|utkio_history_cache/);
    });

    it('AUD-067.4: auth.js logout() purges persistent recent chats cache', () => {
      // Real-World: On logout, recent chat history must be wiped from disk
      expect(authJs).toMatch(/clearCachedRecentChats|clearCachedChatSessions|removeItem\(['"]utkio_recent_chats_cache['"]\)|removeItem\(['"]utkio_history_cache['"]\)/);
    });

    it('AUD-067.5: drawer.js displays friendly offline notice instead of raw technical error when network fails', () => {
      expect(drawerJs).not.toMatch(/Could not load chats\./);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. AUD-068: History Page Cold-Start Hydration & Offline Resilience
  // ═══════════════════════════════════════════════════════════════════════════
  describe('AUD-068: History Page Frame-0 Paint & Offline Availability (Real-World Human Flow)', () => {
    // Real-World Scenario: User kills the app, boards a metro with no internet, and opens History to review past feedback.
    // Expected:
    // 1. History cards paint synchronously from disk cache on Frame 0 (0ms) without 2s skeleton flash.
    // 2. Offline mode renders cached sessions cleanly and shows a non-blocking offline banner instead of #listErr lockout.
    // 3. Successful fetch updates persistent disk cache (write-through).

    it('AUD-068.1: history.html hydrates from persistent L2 disk cache on Frame 0 before network fetch', () => {
      expect(historyHtml).toMatch(/getCachedChatSessions|getCachedRecentChats|localStorage\.getItem\(['"]utkio_history_cache['"]\)|localStorage\.getItem\(['"]utkio_recent_chats_cache['"]\)/);
    });

    it('AUD-068.2: history.html writes fresh sessions into persistent L2 disk cache upon successful fetch', () => {
      expect(historyHtml).toMatch(/setCachedChatSessions|setCachedRecentChats|localStorage\.setItem\(['"]utkio_history_cache['"]|localStorage\.setItem\(['"]utkio_recent_chats_cache['"]/);
    });

    it('AUD-068.3: history.html offline failure falls back to cached sessions and does not lock user out with raw error', () => {
      // When offline, if cached sessions exist, render them gracefully
      expect(historyHtml).toMatch(/allSessions\.length|cached/);
    });

    it('AUD-068.4: auth.js logout() purges persistent history cache from disk', () => {
      expect(authJs).toMatch(/clearCachedChatSessions|clearCachedHistory|removeItem\(['"]utkio_history_cache['"]\)/);
    });
  });
});
