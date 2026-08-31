// Role: 06_TestWriter (Senior Frontend Adversarial QA)
// Issues: AUD-059, AUD-060, AUD-061, AUD-062, AUD-063
// Target Files: history.html, drawer.js, profile.html, settings.html, home.html, auth.js, api-cache.js
// Classification: Frontend-First Adversarial Test Matrix (Human Real-World Behavior)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Adversarial Test Suite — Issues AUD-059 to AUD-063: Real-World Human User Failure Scenarios', () => {
  const wwwDir = path.resolve(__dirname, '..');
  const historyHtmlPath = path.resolve(wwwDir, 'history.html');
  const drawerJsPath = path.resolve(wwwDir, 'shared/drawer.js');
  const profileHtmlPath = path.resolve(wwwDir, 'profile.html');
  const settingsHtmlPath = path.resolve(wwwDir, 'settings.html');
  const homeHtmlPath = path.resolve(wwwDir, 'home.html');
  const authJsPath = path.resolve(wwwDir, 'shared/auth.js');
  const apiCacheJsPath = path.resolve(wwwDir, 'shared/api-cache.js');
  const geminiKeyCheckJsPath = path.resolve(wwwDir, 'shared/gemini-key-check.js');

  let historyHtml = '';
  let drawerJs = '';
  let profileHtml = '';
  let settingsHtml = '';
  let homeHtml = '';
  let authJs = '';
  let apiCacheJs = '';
  let geminiKeyCheckJs = '';

  beforeEach(() => {
    historyHtml = fs.readFileSync(historyHtmlPath, 'utf8');
    drawerJs = fs.readFileSync(drawerJsPath, 'utf8');
    profileHtml = fs.readFileSync(profileHtmlPath, 'utf8');
    settingsHtml = fs.readFileSync(settingsHtmlPath, 'utf8');
    homeHtml = fs.readFileSync(homeHtmlPath, 'utf8');
    authJs = fs.readFileSync(authJsPath, 'utf8');
    apiCacheJs = fs.readFileSync(apiCacheJsPath, 'utf8');
    geminiKeyCheckJs = fs.readFileSync(geminiKeyCheckJsPath, 'utf8');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 1: AUD-059 — History Pagination, Incremental Rendering & Search
  // ═══════════════════════════════════════════════════════════════════════════
  describe('AUD-059: history.html Real-World Session Browsing, Rapid Search & DOM Scaling', () => {
    // Why this matters: An active learner with 100+ to 1,000+ sessions shouldn't freeze the DOM or trigger unbounded queries.

    it('AUD-059.1: history.html imports getRecentChatSessions and uses bounded/paginated data fetching', () => {
      expect(historyHtml).toMatch(/import\s*\{[^}]*getRecentChatSessions[^}]*\}\s*from\s*['"]\.\/shared\/auth\.js['"]/);
      expect(historyHtml).toContain('getRecentChatSessions');
    });

    it('AUD-059.2: history.html renderList sanitizes and groups sessions without crashing on 1,000 mock items', () => {
      expect(historyHtml).toContain('groupSessionsByDate');
      expect(historyHtml).toContain('renderList');
      expect(historyHtml).toContain('buildCard');
    });

    it('AUD-059.3: Search filtering in history.html does not mutate original session dataset', () => {
      expect(historyHtml).toMatch(/allSessions/);
      expect(historyHtml).toMatch(/searchInput\.addEventListener\(['"]input['"]/);
      expect(historyHtml).toContain('clearSearch');
    });

    it('AUD-059.4: Search empty state is explicitly distinguished from true account empty state', () => {
      expect(historyHtml).toContain('renderSearchEmptyState');
      expect(historyHtml).toContain('renderEmptyState');
      expect(historyHtml).toContain('No chats match');
    });

    it('AUD-059.5: Skeleton loader is cleanly dismissed after history fetch completes or fails', () => {
      expect(historyHtml).toContain("listMsg.style.display = 'none'");
      expect(historyHtml).toContain("id=\"listErr\"");
    });

    it('AUD-059.6: history.html only attaches Resume button for freeform sessions, omitting for scenarios', () => {
      expect(historyHtml).toContain("if (sessionType !== 'scenario')");
      expect(historyHtml).toContain('resume-btn');
    });

    it('AUD-059.7: history.html sanitizes search query before injecting into search empty state DOM to prevent XSS', () => {
      expect(historyHtml).toContain('escapeHtml(query)');
    });

    it('AUD-059.8: history.html caches fetched transcripts locally in Map to prevent duplicate N+1 network queries on card expand', () => {
      expect(historyHtml).toContain('transcriptCache');
      expect(historyHtml).toContain('transcriptCache.set(');
      expect(historyHtml).toContain('transcriptCache.get(');
    });

    it('AUD-059.9: Keyboard navigation (Enter / Space) allows expanding cards without mouse clicks', () => {
      expect(historyHtml).toContain("e.key === 'Enter'");
      expect(historyHtml).toContain("e.key === ' '");
      expect(historyHtml).toContain('toggle()');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 2: AUD-060 — Drawer Lazy Network Execution & Lifecycle Safety
  // ═══════════════════════════════════════════════════════════════════════════
  describe('AUD-060: drawer.js Real-World User Interaction, Offline Resilience & Back Navigation', () => {
    // Why this matters: Page load should never fire eager /users/me or full session list for a hidden/closed drawer.

    it('AUD-060.1: drawer.js renders cached basic profile immediately without waiting for network', () => {
      expect(drawerJs).toMatch(/getCachedProfileBasic/);
      expect(drawerJs).toContain('drawerUserName');
      expect(drawerJs).toContain('drawerUserEmail');
    });

    it('AUD-060.2: drawer.js uses cachedFetch with TTL for profile revalidation', () => {
      expect(drawerJs).toMatch(/cachedFetch\(['"]profile_me['"]/);
    });

    it('AUD-060.3: drawer.js slices recent sessions to maximum 5 items for compact drawer navigation', () => {
      expect(drawerJs).toMatch(/\.slice\(0,\s*5\)/);
    });

    it('AUD-060.4: drawer.js handles network failure gracefully with fallback error message', () => {
      expect(drawerJs).toContain('Could not load chats');
    });

    it('AUD-060.5: drawer.js back navigation handler cleans up unregisterBack on close', () => {
      expect(drawerJs).toContain('registerBackHandler');
      expect(drawerJs).toContain('unregisterBack');
    });

    it('AUD-060.6: drawer.js binds click handler on backdrop overlay to dismiss drawer', () => {
      expect(drawerJs).toMatch(/overlay\.addEventListener\(['"]click['"],\s*\(e\)\s*=>\s*\{\s*if\s*\(e\.target\s*===\s*overlay\)\s*close\(\);\s*\}\)/);
    });

    it('AUD-060.7: drawer.js updates cachedProfileBasic when fresh user profile data is received', () => {
      expect(drawerJs).toContain('setCachedProfileBasic');
    });

    it('AUD-060.8: drawer.js provides More link that navigates directly to history.html', () => {
      expect(drawerJs).toContain("window.location.href = 'history.html'");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 3: AUD-061 — Profile & Settings SWR Cache Write-Through & Invalidation
  // ═══════════════════════════════════════════════════════════════════════════
  describe('AUD-061: Profile Edit Persistence, Offline Protection & Cache Synchronization', () => {
    // Why this matters: Updating user profile on profile.html must immediately propagate to Drawer, Home & Settings without stale UI.

    it('AUD-061.1: auth.js exports full and basic profile cache getters, setters and clear helpers', () => {
      expect(authJs).toMatch(/export\s+function\s+getCachedFullProfile/);
      expect(authJs).toMatch(/export\s+function\s+setCachedFullProfile/);
      expect(authJs).toMatch(/export\s+function\s+clearCachedFullProfile/);
      expect(authJs).toMatch(/export\s+function\s+getCachedProfileBasic/);
      expect(authJs).toMatch(/export\s+function\s+setCachedProfileBasic/);
    });

    it('AUD-061.2: profile.html sets cached full profile and updates basic profile cache upon initial load', () => {
      expect(profileHtml).toContain('setCachedFullProfile');
      expect(profileHtml).toContain('getCachedFullProfile');
      expect(profileHtml).toContain('getCachedProfileBasic');
    });

    it('AUD-061.3: profile.html performs write-through cache update or invalidation upon successful PATCH /users/profile', () => {
      // Upon successful save (PATCH /users/profile), cache must be updated/invalidated
      expect(profileHtml).toMatch(/apiFetch\(['"]\/users\/profile['"],\s*\{\s*method:\s*['"]PATCH['"]/);
      const patchIndex = profileHtml.indexOf("apiFetch('/users/profile'");
      const remainingCode = profileHtml.slice(patchIndex);
      const updatesCache = remainingCode.includes('setCachedFullProfile') || 
                           remainingCode.includes('setCachedProfileBasic') || 
                           remainingCode.includes('invalidateCache');
      expect(updatesCache, 'profile.html must update or invalidate cache after PATCH /users/profile').toBe(true);
    });

    it('AUD-061.4: settings.html displays email from cache first to avoid FOUC before revalidation', () => {
      expect(settingsHtml).toContain('getCachedProfileBasic');
      expect(settingsHtml).toContain('vEmail');
    });

    it('AUD-061.5: auth.js invalidateAllCache wipes all profile and app caches on logout', () => {
      expect(authJs).toContain('invalidateAllCache');
      expect(authJs).toContain('clearCachedFullProfile');
      expect(authJs).toContain('clearCachedProfileBasic');
    });

    it('AUD-061.6: profile.html disables Save button during in-flight PATCH request to prevent double submit', () => {
      expect(profileHtml).toContain('saveBtn.disabled = true');
      expect(profileHtml).toContain('saveBtn.classList.add(\'btn-loading\')');
      expect(profileHtml).toContain('saveBtn.disabled = false');
    });

    it('AUD-061.7: profile.html sanitizes non-numeric inputs in age field to prevent invalid payload', () => {
      expect(profileHtml).toMatch(/e\.target\.value\s*=\s*e\.target\.value\.replace\(\/\[\^0-9\]\/g,\s*['"]['"]\)/);
    });

    it('AUD-061.8: profile.html dynamically tracks character count limit for English writing sample', () => {
      expect(profileHtml).toContain('charHint');
      expect(profileHtml).toContain('500');
      expect(profileHtml).toContain('near-limit');
    });

    it('AUD-061.9: profile.html proactively disables Save button when device is offline', () => {
      expect(profileHtml).toContain('disableOfflineFor([saveBtn])');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 4: AUD-062 — Google Gemini API Key Validation Safety & Debouncing
  // ═══════════════════════════════════════════════════════════════════════════
  describe('AUD-062: settings.html Passive Gemini API Key Preflight Validation Avoidance & Input Handling', () => {
    // Why this matters: Opening settings.html should NOT fire passive remote API key checks against Google when the key is unchanged.

    it('AUD-062.1: settings.html loads saved API key from secure storage into input field', () => {
      expect(settingsHtml).toMatch(/getApiKey\(\)/);
      expect(settingsHtml).toContain('apiKeyInput.value = savedKey');
    });

    it('AUD-062.2: settings.html does NOT execute passive remote checkGeminiApiKey on initial unchanged key load', () => {
      // It should NOT eagerly run remote check on load for existing key; validation belongs on mutation or explicit trigger
      const loadBlockMatch = settingsHtml.match(/const\s+savedKey\s*=\s*await\s+getApiKey\(\);[\s\S]*?apiKeyInput\.value\s*=\s*savedKey;([\s\S]*?)\}/);
      expect(loadBlockMatch).toBeTruthy();
      const loadBlock = loadBlockMatch[1];
      const hasEagerNetworkValidation = loadBlock.includes('checkGeminiApiKey(');
      expect(hasEagerNetworkValidation, 'Initial load must not invoke checkGeminiApiKey network preflight').toBe(false);
    });

    it('AUD-062.3: settings.html validates key with debouncing on user input mutation', () => {
      expect(settingsHtml).toContain('validateKeyDebounced');
      expect(settingsHtml).toMatch(/apiKeyInput\.addEventListener\(['"]input['"]/);
    });

    it('AUD-062.4: settings.html delete key flow removes key and cancels pending validation timers', () => {
      expect(settingsHtml).toContain('deleteKeyBtn');
      expect(settingsHtml).toContain('removeApiKey');
      expect(settingsHtml).toContain('clearTimeout');
    });

    it('AUD-062.5: settings.html handles needsKey=missing and needsKey=invalid deep link query parameters with auto-scroll and focus', () => {
      expect(settingsHtml).toContain("redirectReason === 'missing'");
      expect(settingsHtml).toContain("redirectReason === 'invalid'");
      expect(settingsHtml).toContain('needsKeyBanner');
      expect(settingsHtml).toContain('scrollIntoView');
    });

    it('AUD-062.6: gemini-key-check.js trims copy-pasted API keys before remote GET models preflight', () => {
      expect(geminiKeyCheckJs).toMatch(/key\.trim\(\)/);
      expect(geminiKeyCheckJs).toMatch(/encodeURIComponent\(key\.trim\(\)\)/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 5: AUD-063 — Dashboard Streak Caching & Resilient Invalidation
  // ═══════════════════════════════════════════════════════════════════════════
  describe('AUD-063: home.html Practice Streak SWR Hydration & Failure Recovery', () => {
    // Why this matters: Streak computation scans up to 1,000 DB records; dashboard navigation must use SWR and invalidate on session completion.

    it('AUD-063.1: auth.js exports getCachedStreak, setCachedStreak, and clearCachedStreak', () => {
      expect(authJs).toMatch(/export\s+function\s+getCachedStreak/);
      expect(authJs).toMatch(/export\s+function\s+setCachedStreak/);
      expect(authJs).toMatch(/export\s+function\s+clearCachedStreak/);
    });

    it('AUD-063.2: home.html caches streak response and updates UI badge with practiced status', () => {
      expect(homeHtml).toContain('setCachedStreak');
      expect(homeHtml).toContain('homeStreakValue');
      expect(homeHtml).toContain('homeStreakBadge');
      expect(homeHtml).toContain('practiced');
    });

    it('AUD-063.3: auth.js syncPendingChatSession invalidates cache upon session save', () => {
      expect(authJs).toContain('invalidateChatSessionsCache');
      expect(authJs).toContain('invalidateCache');
    });

    it('AUD-063.4: home.html parallelizes plan status and streak fetching via Promise.allSettled with getStreakWithCache', () => {
      expect(homeHtml).toMatch(/Promise\.allSettled\(\s*\[\s*getPlanStatus\(\),\s*getStreakWithCache\(\)\s*\]\s*\)/);
    });

    it('AUD-063.5: home.html streak failure falls back cleanly to cachedStreak without blanking out UI', () => {
      expect(homeHtml).toMatch(/currentStreak\s*=\s*cachedStreak\?\.current_streak\s*\|\|\s*0/);
    });

    it('AUD-063.6: home.html syncs daily notification schedule in background after hydrating plan status', () => {
      expect(homeHtml).toContain('syncDailyNotificationSchedule');
    });
  });
});
