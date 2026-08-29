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

describe('Adversarial & Human Use-Cases Suite — Issue #8 (AUD-008: Plan Gating, Fallbacks & Status Entitlements)', () => {
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

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 1: Normal Human Being Use Cases — Page Gating & Permissions
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Suite 1: Standard Human Being Use Cases (Happy Paths & Gating)', () => {
    // Verifies paid starter plan user is unblocked from chat without redirect
    it('test_human_paid_starter_subscriber_unblocked_on_chat_page', async () => {
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        plan: 'starter',
        plan_expires_at: new Date(Date.now() + 86400000).toISOString(),
        active: true,
        can_chat: true,
        can_report: true,
        can_scenario: true,
        trial: null
      });

      const result = await requireActivePlan('chat');
      expect(result).toBeTruthy();
      expect(result.plan).toBe('starter');
      expect(window.location.href).toBe('http://localhost/chat.html'); // No redirect
    });

    // Verifies active trial user with remaining chat quota is unblocked
    it('test_human_trial_user_with_chats_available_unblocked_on_chat_page', async () => {
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        plan: 'none',
        plan_expires_at: null,
        active: true,
        can_chat: true,
        can_report: true,
        can_scenario: true,
        trial: {
          active: true,
          days_left: 2.5,
          chats_remaining: 3,
          reports_remaining: 4,
          scenarios_remaining: 1
        }
      });

      const result = await requireActivePlan('chat');
      expect(result).toBeTruthy();
      expect(result.can_chat).toBe(true);
      expect(window.location.href).toBe('http://localhost/chat.html');
    });

    // Verifies trial user who used all 5 chats is redirected with reason=chat_limit
    it('test_human_trial_user_with_exhausted_chats_redirected_to_pricing_with_chat_limit_reason', async () => {
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

    // Verifies trial user who used scenario is redirected with reason=scenario_limit when trying scenario
    it('test_human_trial_user_with_exhausted_scenario_redirected_with_scenario_limit_reason', async () => {
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        plan: 'none',
        plan_expires_at: null,
        active: true,
        can_chat: true,
        can_report: true,
        can_scenario: false,
        trial: {
          active: true,
          days_left: 1.5,
          chats_remaining: 2,
          reports_remaining: 2,
          scenarios_remaining: 0
        }
      });

      window.location.href = 'http://localhost/scenario.html';
      const result = await requireActivePlan('scenario');
      expect(result).toBeNull();
      expect(window.location.href).toBe('pricing.html?reason=scenario_limit');
    });

    // Verifies trial user whose 3-day trial period expired is redirected with reason=trial_expired
    it('test_human_trial_expired_user_redirected_with_trial_expired_reason', async () => {
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
          chats_remaining: 1,
          reports_remaining: 1,
          scenarios_remaining: 0
        }
      });

      const result = await requireActivePlan('chat');
      expect(result).toBeNull();
      expect(window.location.href).toBe('pricing.html?reason=trial_expired');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 2: Adversarial AUD-008 Bug Impact & Inconsistent Payload Resilience
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Suite 2: Adversarial Fallback Contradictions & Payload Resilience', () => {
    // Documents the critical downstream impact of Issue #8:
    // If backend returns can_chat: true when trial is actually expired/inactive,
    // frontend gating is tricked into letting the user through.
    it('test_adversarial_backend_sending_fail_closed_status_correctly_blocks_unpaid_user', async () => {
      // With Issue #8 properly fixed on backend:
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

    // Verifies report gating redirects with report_limit when reports_remaining is 0 but chats remain
    it('test_adversarial_report_gating_redirects_with_report_limit_reason', async () => {
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

    // Verifies report gating allows access when can_report is true
    it('test_adversarial_report_gating_unblocks_when_can_report_is_true', async () => {
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        plan: 'none',
        plan_expires_at: null,
        active: true,
        can_chat: false,
        can_report: true,
        can_scenario: false,
        trial: {
          active: true,
          days_left: 1.0,
          chats_remaining: 0,
          reports_remaining: 2,
          scenarios_remaining: 0
        }
      });

      window.location.href = 'http://localhost/report.html';
      const result = await requireActivePlan('report');
      expect(result).toBeTruthy();
      expect(result.can_report).toBe(true);
      expect(window.location.href).toBe('http://localhost/report.html');
    });

    // Verifies paid plans (commit_mode, unlimited) are unblocked on report and scenario kinds
    it('test_adversarial_paid_plans_unblocked_on_report_and_scenario_kinds', async () => {
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        plan: 'commit_mode',
        plan_expires_at: new Date(Date.now() + 86400000).toISOString(),
        active: true,
        can_chat: true,
        can_report: true,
        can_scenario: true,
        trial: null
      });

      const reportResult = await requireActivePlan('report');
      expect(reportResult).toBeTruthy();
      expect(reportResult.plan).toBe('commit_mode');

      invalidatePlanCache();

      const scenarioResult = await requireActivePlan('scenario');
      expect(scenarioResult).toBeTruthy();
      expect(scenarioResult.plan).toBe('commit_mode');
    });

    // Tests frontend handling when backend status response is missing can_* flags (legacy fallback)
    it('test_adversarial_legacy_fallback_when_can_flags_missing_in_status_response', async () => {
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        plan: 'none',
        active: true,
        // can_chat, can_report, can_scenario omitted (legacy response shape)
        trial: {
          active: true,
          chats_remaining: 0,
          scenarios_remaining: 1,
          reports_remaining: 2
        }
      });

      // When can_chat is undefined, fallback checks status.trial.chats_remaining > 0 (which is 0 -> false)
      const chatResult = await requireActivePlan('chat');
      expect(chatResult).toBeNull();
      expect(window.location.href).toBe('pricing.html?reason=chat_limit');

      invalidatePlanCache();

      // For scenario: scenarios_remaining is 1 -> allowed
      window.location.href = 'http://localhost/scenario.html';
      const scenResult = await requireActivePlan('scenario');
      expect(scenResult).toBeTruthy();
      expect(window.location.href).toBe('http://localhost/scenario.html');

      invalidatePlanCache();

      // For report: reports_remaining is 2 -> allowed
      window.location.href = 'http://localhost/report.html';
      const repResult = await requireActivePlan('report');
      expect(repResult).toBeTruthy();
      expect(window.location.href).toBe('http://localhost/report.html');
    });

    // Tests legacy fallback for report when reports_remaining is 0
    it('test_adversarial_legacy_fallback_when_reports_remaining_is_zero', async () => {
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        plan: 'none',
        active: true,
        trial: {
          active: true,
          chats_remaining: 2,
          scenarios_remaining: 1,
          reports_remaining: 0
        }
      });

      window.location.href = 'http://localhost/report.html';
      const reportResult = await requireActivePlan('report');
      expect(reportResult).toBeNull();
      expect(window.location.href).toBe('pricing.html?reason=report_limit');
    });

    // Verifies network failure (status 0 / exception) fails OPEN gracefully on client side
    // (with console.warn, allowing user through so backend requirePlan middleware acts as real gate)
    it('test_adversarial_network_offline_fails_open_with_warning_without_trapping_user', async () => {
      vi.spyOn(authModule, 'apiFetch').mockRejectedValue(new Error('Network disconnected'));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await requireActivePlan('chat');

      expect(result).toBeNull();
      expect(window.location.href).toBe('http://localhost/chat.html'); // Did NOT redirect to pricing
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Could not verify plan status — allowing through for now'));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 3: trialBannerText Formatting Exhaustive Matrix
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Suite 3: trialBannerText UI Formatter Permutations', () => {
    it('test_banner_null_for_paid_plan_and_null_status', () => {
      expect(trialBannerText(null)).toBeNull();
      expect(trialBannerText(undefined)).toBeNull();
      expect(trialBannerText({ plan: 'starter', trial: null })).toBeNull();
      expect(trialBannerText({ plan: 'unlimited', trial: null })).toBeNull();
      expect(trialBannerText({ plan: 'commit_mode', trial: null })).toBeNull();
    });

    it('test_banner_null_for_inactive_trial', () => {
      expect(trialBannerText({ plan: 'none', trial: { active: false } })).toBeNull();
    });

    it('test_banner_limits_reached_when_all_remaining_are_zero', () => {
      const text = trialBannerText({
        plan: 'none',
        trial: { active: true, chats_remaining: 0, scenarios_remaining: 0, reports_remaining: 0, days_left: 1.2 }
      });
      expect(text).toBe('Free trial limits reached — Upgrade to continue practicing.');
    });

    it('test_banner_plural_formatting_with_multiple_units', () => {
      const text = trialBannerText({
        plan: 'none',
        trial: { active: true, chats_remaining: 5, scenarios_remaining: 1, reports_remaining: 5, days_left: 3.0 }
      });
      expect(text).toBe('Free trial: 5 chats, 1 scenario, 5 reports remaining (3 days left).');
    });

    it('test_banner_singular_formatting_with_one_unit_each', () => {
      const text = trialBannerText({
        plan: 'none',
        trial: { active: true, chats_remaining: 1, scenarios_remaining: 1, reports_remaining: 1, days_left: 1.0 }
      });
      expect(text).toBe('Free trial: 1 chat, 1 scenario, 1 report remaining (1 day left).');
    });

    it('test_banner_handling_when_scenarios_remaining_is_undefined', () => {
      const text = trialBannerText({
        plan: 'none',
        trial: { active: true, chats_remaining: 2, reports_remaining: 3, days_left: 2.0 }
      });
      expect(text).toBe('Free trial: 2 chats, 3 reports remaining (2 days left).');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 4: Caching, Force Fetch & Lifecycle Concurrency
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Suite 4: Caching, Invalidation & Concurrency', () => {
    it('test_get_plan_status_caches_response_and_force_bypasses_cache', async () => {
      let callCount = 0;
      vi.spyOn(authModule, 'apiFetch').mockImplementation(async () => {
        callCount++;
        return { plan: 'starter', active: true };
      });

      const first = await getPlanStatus();
      expect(first).toEqual({ plan: 'starter', active: true });
      expect(callCount).toBe(1);

      // Second call serves from cache
      const cached = await getPlanStatus();
      expect(cached).toEqual({ plan: 'starter', active: true });
      expect(callCount).toBe(1);

      // Forced call bypasses cache
      const forced = await getPlanStatus({ force: true });
      expect(forced).toEqual({ plan: 'starter', active: true });
      expect(callCount).toBe(2);
    });

    it('test_concurrent_get_plan_status_collapses_to_single_network_call', async () => {
      let callCount = 0;
      vi.spyOn(authModule, 'apiFetch').mockImplementation(async () => {
        callCount++;
        await new Promise((r) => setTimeout(r, 10));
        return { plan: 'starter', active: true };
      });

      const [r1, r2, r3] = await Promise.all([
        getPlanStatus(),
        getPlanStatus(),
        getPlanStatus()
      ]);

      expect(r1).toEqual({ plan: 'starter', active: true });
      expect(r2).toEqual({ plan: 'starter', active: true });
      expect(r3).toEqual({ plan: 'starter', active: true });
      expect(callCount).toBe(1);
    });
  });
});
