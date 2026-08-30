import './config.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getPlanStatus,
  invalidatePlanCache,
  requireActivePlan,
  trialBannerText
} from './plan.js';
import * as authModule from './auth.js';
import { invalidateAllCache } from './api-cache.js';

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

describe('Frontend Adversarial Test Suite — Issue #5 (AUD-025: NULL trial_started_at Fallback & Page Gating)', () => {
  let sessionStorageMock;
  let localStorageMock;
  let originalWindow;
  let originalFetch;

  beforeEach(() => {
    vi.restoreAllMocks();

    sessionStorageMock = makeStorageMock();
    localStorageMock = makeStorageMock();

    globalThis.sessionStorage = sessionStorageMock;
    globalThis.localStorage = localStorageMock;

    originalWindow = globalThis.window;
    originalFetch = globalThis.fetch;

    globalThis.window = {
      location: { href: 'http://localhost/chat.html' },
      UKTIO_CONFIG: { BACKEND_URL: 'https://utkio-backend.onrender.com' }
    };
    globalThis.UKTIO_CONFIG = globalThis.window.UKTIO_CONFIG;

    invalidateAllCache();
    invalidatePlanCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Fresh User with NULL trial_started_at (Auto-Healed to Active Trial)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('1. Fresh User NULL trial_started_at Auto-Healed Frontend Gating', () => {
    it('test_new_user_with_null_trial_started_at_unblocked_on_chat_page', async () => {
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        plan: 'none',
        plan_expires_at: null,
        active: true,
        can_chat: true,
        can_report: true,
        can_scenario: true,
        trial: {
          active: true,
          days_left: 3.0,
          chats_remaining: 5,
          reports_remaining: 5,
          scenarios_remaining: 1
        }
      });

      const result = await requireActivePlan('chat');
      expect(result).toBeTruthy();
      expect(result.active).toBe(true);
      expect(result.can_chat).toBe(true);
      expect(window.location.href).toBe('http://localhost/chat.html'); // No redirect
    });

    it('test_new_user_with_null_trial_started_at_unblocked_on_scenario_page', async () => {
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        plan: 'none',
        plan_expires_at: null,
        active: true,
        can_chat: true,
        can_report: true,
        can_scenario: true,
        trial: {
          active: true,
          days_left: 3.0,
          chats_remaining: 5,
          reports_remaining: 5,
          scenarios_remaining: 1
        }
      });

      window.location.href = 'http://localhost/scenario.html';
      const result = await requireActivePlan('scenario');
      expect(result).toBeTruthy();
      expect(result.can_scenario).toBe(true);
      expect(window.location.href).toBe('http://localhost/scenario.html');
    });

    it('test_new_user_with_null_trial_started_at_unblocked_on_report_page', async () => {
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        plan: 'none',
        plan_expires_at: null,
        active: true,
        can_chat: true,
        can_report: true,
        can_scenario: true,
        trial: {
          active: true,
          days_left: 3.0,
          chats_remaining: 5,
          reports_remaining: 5,
          scenarios_remaining: 1
        }
      });

      window.location.href = 'http://localhost/report.html';
      const result = await requireActivePlan('report');
      expect(result).toBeTruthy();
      expect(result.can_report).toBe(true);
      expect(window.location.href).toBe('http://localhost/report.html');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Legacy User with NULL trial_started_at (Expired Trial Fallback)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('2. Expired Legacy User NULL trial_started_at Redirect Gating', () => {
    it('test_expired_legacy_user_redirected_to_pricing_with_trial_expired_reason', async () => {
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        plan: 'none',
        plan_expires_at: null,
        active: false,
        can_chat: false,
        can_report: false,
        can_scenario: false,
        trial: {
          active: false,
          days_left: 0,
          chats_remaining: 0,
          reports_remaining: 0,
          scenarios_remaining: 0
        }
      });

      const result = await requireActivePlan('chat');
      expect(result).toBeNull();
      expect(window.location.href).toBe('pricing.html?reason=trial_expired');
    });

    it('test_expired_legacy_user_on_scenario_page_redirected_with_trial_expired_reason', async () => {
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        plan: 'none',
        plan_expires_at: null,
        active: false,
        can_chat: false,
        can_report: false,
        can_scenario: false,
        trial: {
          active: false,
          days_left: 0,
          chats_remaining: 0,
          reports_remaining: 0,
          scenarios_remaining: 0
        }
      });

      window.location.href = 'http://localhost/scenario.html';
      const result = await requireActivePlan('scenario');
      expect(result).toBeNull();
      expect(window.location.href).toBe('pricing.html?reason=trial_expired');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Quota Exhaustion Granular Gating
  // ─────────────────────────────────────────────────────────────────────────────
  describe('3. Quota Exhaustion Redirect Reasons', () => {
    it('test_chat_exhausted_redirects_with_chat_limit_while_scenario_still_active', async () => {
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        plan: 'none',
        plan_expires_at: null,
        active: true,
        can_chat: false,
        can_report: true,
        can_scenario: true,
        trial: {
          active: true,
          days_left: 2.0,
          chats_remaining: 0,
          reports_remaining: 3,
          scenarios_remaining: 1
        }
      });

      const result = await requireActivePlan('chat');
      expect(result).toBeNull();
      expect(window.location.href).toBe('pricing.html?reason=chat_limit');
    });

    it('test_scenario_exhausted_redirects_with_scenario_limit_while_chat_still_active', async () => {
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        plan: 'none',
        plan_expires_at: null,
        active: true,
        can_chat: true,
        can_report: true,
        can_scenario: false,
        trial: {
          active: true,
          days_left: 2.0,
          chats_remaining: 3,
          reports_remaining: 3,
          scenarios_remaining: 0
        }
      });

      window.location.href = 'http://localhost/scenario.html';
      const result = await requireActivePlan('scenario');
      expect(result).toBeNull();
      expect(window.location.href).toBe('pricing.html?reason=scenario_limit');
    });

    it('test_report_exhausted_redirects_with_report_limit_while_chat_still_active', async () => {
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        plan: 'none',
        plan_expires_at: null,
        active: true,
        can_chat: true,
        can_report: false,
        can_scenario: true,
        trial: {
          active: true,
          days_left: 2.0,
          chats_remaining: 3,
          reports_remaining: 0,
          scenarios_remaining: 1
        }
      });

      window.location.href = 'http://localhost/report.html';
      const result = await requireActivePlan('report');
      expect(result).toBeNull();
      expect(window.location.href).toBe('pricing.html?reason=report_limit');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Banner Text Formatting with Auto-Healed Trial Status
  // ─────────────────────────────────────────────────────────────────────────────
  describe('4. Banner Text Formatting for Auto-Healed Trial', () => {
    it('test_banner_formats_fresh_auto_healed_trial_correctly', () => {
      const banner = trialBannerText({
        plan: 'none',
        trial: {
          active: true,
          days_left: 3.0,
          chats_remaining: 5,
          reports_remaining: 5,
          scenarios_remaining: 1
        }
      });
      expect(banner).toBe('Free trial: 5 chats, 1 scenario, 5 reports remaining (3 days left).');
    });

    it('test_banner_formats_partial_usage_trial_correctly', () => {
      const banner = trialBannerText({
        plan: 'none',
        trial: {
          active: true,
          days_left: 1.5,
          chats_remaining: 2,
          reports_remaining: 4,
          scenarios_remaining: 0
        }
      });
      expect(banner).toBe('Free trial: 2 chats, 0 scenarios, 4 reports remaining (2 days left).');

      const bannerUnderOneDay = trialBannerText({
        plan: 'none',
        trial: {
          active: true,
          days_left: 0.5,
          chats_remaining: 1,
          reports_remaining: 1,
          scenarios_remaining: 1
        }
      });
      expect(bannerUnderOneDay).toBe('Free trial: 1 chat, 1 scenario, 1 report remaining (12 hrs left).');
    });

    it('test_banner_returns_limit_reached_message_when_all_quotas_exhausted', () => {
      const banner = trialBannerText({
        plan: 'none',
        trial: {
          active: true,
          days_left: 1.0,
          chats_remaining: 0,
          reports_remaining: 0,
          scenarios_remaining: 0
        }
      });
      expect(banner).toBe('Free trial limits reached — Upgrade to continue practicing.');
    });
  });
});
