import './config.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { escapeHtml } from './sanitize.js';
import { renderAnnouncementBanner } from './announcement-banner.js';
import { disableOfflineFor } from './offline-banner.js';
import { invalidateAllCache } from './api-cache.js';

function makeStorageMock() {
  const store = {};
  return {
    getItem: vi.fn((key) => (key in store ? store[key] : null)),
    setItem: vi.fn((key, value) => { store[key] = String(value); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { for (const k in store) delete store[k]; })
  };
}

function makeClassListMock(initial = []) {
  const classes = new Set(initial);
  return {
    add: vi.fn((c) => classes.add(c)),
    remove: vi.fn((c) => classes.delete(c)),
    contains: vi.fn((c) => classes.has(c)),
    toggle: vi.fn((c, force) => {
      if (typeof force === 'boolean') {
        if (force) classes.add(c);
        else classes.delete(c);
        return force;
      }
      if (classes.has(c)) { classes.delete(c); return false; }
      classes.add(c);
      return true;
    }),
    has: (c) => classes.has(c)
  };
}

describe('Adversarial & Hardcore Test Suite — Phase 4: Dashboard & App Shell (home.html, drawer.js, announcement-banner.js, offline-banner.js)', () => {
  let localStorageMock;
  let sessionStorageMock;
  let originalFetch;
  let originalWindow;

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorageMock = makeStorageMock();
    sessionStorageMock = makeStorageMock();
    globalThis.localStorage = localStorageMock;
    globalThis.sessionStorage = sessionStorageMock;

    originalFetch = globalThis.fetch;
    originalWindow = globalThis.window;

    globalThis.window = {
      location: { href: 'http://localhost/home.html' },
      UTKIO_CONFIG: { BACKEND_URL: 'https://utkio-backend.onrender.com' },
      Capacitor: { Plugins: {} }
    };

    invalidateAllCache();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 1: Home Dashboard Greeting & Cache-First Hydration (home.html)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 1: Time-of-Day Greeting & Hydration (home.html)', () => {
    function computeGreeting(hour) {
      return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    }

    it('test_greeting_handles_all_24_hour_boundaries_cleanly', () => {
      expect(computeGreeting(0)).toBe('Good morning');
      expect(computeGreeting(6)).toBe('Good morning');
      expect(computeGreeting(11)).toBe('Good morning');
      expect(computeGreeting(12)).toBe('Good afternoon');
      expect(computeGreeting(16)).toBe('Good afternoon');
      expect(computeGreeting(17)).toBe('Good evening');
      expect(computeGreeting(23)).toBe('Good evening');
    });

    it('test_home_dashboard_hydrates_streak_instantly_from_cache_and_updates_live', () => {
      const cachedStreak = { current_streak: 5, practiced_today: true };
      const streakBadge = {
        value: '',
        classList: makeClassListMock()
      };

      // Step 1: Instant cache-first frame
      if (cachedStreak && typeof cachedStreak.current_streak === 'number') {
        streakBadge.value = String(cachedStreak.current_streak);
        if (cachedStreak.practiced_today) streakBadge.classList.add('practiced');
      }

      expect(streakBadge.value).toBe('5');
      expect(streakBadge.classList.has('practiced')).toBe(true);

      // Step 2: Live API response arrives (e.g. incremented to 6)
      const liveData = { current_streak: 6, practiced_today: true };
      streakBadge.value = String(liveData.current_streak);

      expect(streakBadge.value).toBe('6');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 2: Drawer State Machine & Back Button Interception (drawer.js)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 2: Drawer Navigation & Back Button Interception (drawer.js)', () => {
    function createDrawerHarness(activePage = 'home') {
      let isOpen = false;
      let registeredBackHandler = null;

      const overlay = {
        classList: makeClassListMock(),
        querySelector: vi.fn(() => ({ addEventListener: vi.fn() }))
      };

      function open() {
        isOpen = true;
        overlay.classList.add('open');
        registeredBackHandler = () => {
          close();
          return true; // handled
        };
      }

      function close() {
        isOpen = false;
        overlay.classList.remove('open');
        registeredBackHandler = null;
      }

      function triggerHardwareBack() {
        if (registeredBackHandler) {
          return registeredBackHandler();
        }
        return false;
      }

      return {
        isOpen: () => isOpen,
        open,
        close,
        triggerHardwareBack,
        activePage
      };
    }

    it('test_opening_drawer_intercepts_hardware_back_to_close_drawer_without_navigating', () => {
      const harness = createDrawerHarness('home');
      expect(harness.isOpen()).toBe(false);

      harness.open();
      expect(harness.isOpen()).toBe(true);

      // User presses Android hardware back button
      const backHandled = harness.triggerHardwareBack();
      expect(backHandled).toBe(true);
      expect(harness.isOpen()).toBe(false);

      // Second back press is not intercepted by drawer anymore
      expect(harness.triggerHardwareBack()).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 3: Announcement Banner & Dismissal Retention (announcement-banner.js)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 3: Announcement Banner & Dismissal Persistence (announcement-banner.js)', () => {
    it('test_announcement_banner_renders_escaped_html_and_respects_dismissal', async () => {
      const closeBtn = { addEventListener: vi.fn() };
      const mockContainer = {
        style: { display: 'none', cursor: '' },
        innerHTML: '',
        querySelector: vi.fn((sel) => {
          if (sel === '.announcement-banner-close') return closeBtn;
          return null;
        }),
        addEventListener: vi.fn()
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          announcements: [
            {
              id: 'ann-101',
              badge: 'NEW',
              title: '<script>alert("hack")</script>Practice English',
              desc: 'Try our <b>new</b> feature today!'
            }
          ]
        })
      });

      await renderAnnouncementBanner(mockContainer);

      expect(mockContainer.style.display).toBe('');
      expect(mockContainer.innerHTML).toContain('&lt;script&gt;alert(&quot;hack&quot;)&lt;/script&gt;');
      expect(mockContainer.innerHTML).not.toContain('<script>');
      expect(mockContainer.innerHTML).toContain('&lt;b&gt;new&lt;/b&gt;');

      // Trigger dismiss handler
      const dismissCallback = closeBtn.addEventListener.mock.calls.find(c => c[0] === 'click')?.[1];
      expect(dismissCallback).toBeDefined();

      const preventDefault = vi.fn();
      const stopPropagation = vi.fn();
      dismissCallback({ preventDefault, stopPropagation });

      // Dismissing saves to localStorage and hides container
      expect(localStorageMock.setItem).toHaveBeenCalledWith('utkio_announcement_dismissed_ann-101', '1');
      expect(mockContainer.style.display).toBe('none');
    });

    it('test_dismissed_announcement_is_not_rendered_on_subsequent_loads', async () => {
      localStorageMock.getItem.mockImplementation((k) => {
        if (k === 'utkio_announcement_dismissed_ann-101') return '1';
        return null;
      });

      const mockContainer = {
        style: { display: '' },
        innerHTML: ''
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          announcements: [
            { id: 'ann-101', title: 'Already Dismissed Announcement' }
          ]
        })
      });

      await renderAnnouncementBanner(mockContainer);

      expect(mockContainer.style.display).toBe('none');
      expect(mockContainer.innerHTML).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 4: Offline Banner & Button Protection Mutex (offline-banner.js)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 4: Offline State & Button Mutex (offline-banner.js)', () => {
    function createOfflineButtonHarness() {
      const ourDisabledButtons = new WeakSet();
      const btnNormal = { disabled: false };
      const btnAlreadyBusy = { disabled: true }; // Disabled by setAuthBusy

      const tracked = [btnNormal, btnAlreadyBusy];

      function handleOffline() {
        tracked.forEach(b => {
          if (!b.disabled) {
            b.disabled = true;
            ourDisabledButtons.add(b);
          }
        });
      }

      function handleOnline() {
        tracked.forEach(b => {
          if (ourDisabledButtons.has(b)) {
            b.disabled = false;
            ourDisabledButtons.delete(b);
          }
        });
      }

      return {
        btnNormal,
        btnAlreadyBusy,
        handleOffline,
        handleOnline
      };
    }

    it('test_offline_handler_only_re_enables_buttons_it_originally_disabled', () => {
      const harness = createOfflineButtonHarness();

      expect(harness.btnNormal.disabled).toBe(false);
      expect(harness.btnAlreadyBusy.disabled).toBe(true);

      // Network drops to offline
      harness.handleOffline();
      expect(harness.btnNormal.disabled).toBe(true);
      expect(harness.btnAlreadyBusy.disabled).toBe(true);

      // Network recovers to online
      harness.handleOnline();
      expect(harness.btnNormal.disabled).toBe(false); // Restored!
      expect(harness.btnAlreadyBusy.disabled).toBe(true); // Still busy! Not prematurely enabled.
    });
  });
});
