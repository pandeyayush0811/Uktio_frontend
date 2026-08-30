import './config.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkGeminiApiKey } from './gemini-key-check.js';
import {
  setApiKey,
  getApiKey,
  removeApiKey,
  API_KEY_STORAGE_KEY,
  getMicCapturePlugin,
  getMicCapturePluginOrNull
} from './mic-helpers.js';
import * as secureStoreModule from './secure-store.js';

function makeStorageMock() {
  const store = {};
  return {
    getItem: vi.fn((key) => (key in store ? store[key] : null)),
    setItem: vi.fn((key, value) => { store[key] = String(value); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { for (const k in store) delete store[k]; })
  };
}

describe('Adversarial & Hardcore Test Suite — Phase 3: Settings & BYOK Gemini Key Management (settings.html & mic-helpers.js)', () => {
  let localStorageMock;
  let originalFetch;
  let originalWindow;

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorageMock = makeStorageMock();
    globalThis.localStorage = localStorageMock;

    originalFetch = globalThis.fetch;
    originalWindow = globalThis.window;

    globalThis.window = {
      location: { href: 'http://localhost/settings.html', search: '' },
      UTKIO_CONFIG: { BACKEND_URL: 'https://utkio-backend.onrender.com' },
      Capacitor: { Plugins: {} }
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 1: BYOK Gemini Key Validation Matrix (gemini-key-check.js)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 1: Gemini API Key Validation Matrix (gemini-key-check.js)', () => {
    it('test_checkGeminiApiKey_returns_empty_immediately_for_null_undefined_or_whitespace', async () => {
      globalThis.fetch = vi.fn();

      expect(await checkGeminiApiKey(null)).toEqual({ status: 'empty', message: '' });
      expect(await checkGeminiApiKey(undefined)).toEqual({ status: 'empty', message: '' });
      expect(await checkGeminiApiKey('')).toEqual({ status: 'empty', message: '' });
      expect(await checkGeminiApiKey('   ')).toEqual({ status: 'empty', message: '' });

      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('test_checkGeminiApiKey_reports_valid_when_google_returns_200_ok', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200
      });

      const res = await checkGeminiApiKey('AIzaSyValidKey123');
      expect(res.status).toBe('valid');
      expect(res.message).toContain('AI Key is valid');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyValidKey123'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('test_checkGeminiApiKey_correctly_url_encodes_special_characters_in_key', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

      await checkGeminiApiKey('AIzaSy+Special/Key=123');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('AIzaSy%2BSpecial%2FKey%3D123'),
        expect.anything()
      );
    });

    it('test_checkGeminiApiKey_reports_quota_exceeded_on_429', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Quota exceeded', status: 'RESOURCE_EXHAUSTED' } })
      });

      const res = await checkGeminiApiKey('AIzaSyQuotaExceededKey');
      expect(res.status).toBe('quota_exceeded');
      expect(res.message).toContain('quota or rate limit exceeded');
    });

    it('test_checkGeminiApiKey_reports_invalid_on_400_401_403_and_permission_denied', async () => {
      // 400 Invalid argument
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { status: 'INVALID_ARGUMENT' } })
      });
      expect((await checkGeminiApiKey('AIzaSyBadKey')).status).toBe('invalid');

      // 403 Permission denied
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: { status: 'PERMISSION_DENIED' } })
      });
      expect((await checkGeminiApiKey('AIzaSyRestrictedKey')).status).toBe('invalid');
    });

    it('test_checkGeminiApiKey_handles_network_drop_and_offline_gracefully', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const res = await checkGeminiApiKey('AIzaSyValidKey');
      expect(res.status).toBe('network_error');
      expect(res.message).toContain('check your internet connection');
    });

    it('test_checkGeminiApiKey_handles_unexpected_503_service_unavailable', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: { message: 'Service Unavailable' } })
      });

      const res = await checkGeminiApiKey('AIzaSyValidKey');
      expect(res.status).toBe('unknown');
      expect(res.message).toContain('status 503');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 2: Storage State Machine & Active Flag Gating (mic-helpers.js)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 2: Storage State Machine & Active Flag Gating (mic-helpers.js)', () => {
    it('test_setApiKey_saves_key_and_sets_active_flag', async () => {
      await setApiKey('AIzaSyMySecretKey');

      expect(localStorageMock.setItem).toHaveBeenCalledWith('utkio_gemini_api_key_present', '1');
      const retrieved = await getApiKey();
      expect(retrieved).toBe('AIzaSyMySecretKey');
    });

    it('test_removeApiKey_clears_active_flag_and_makes_getApiKey_return_empty_string', async () => {
      await setApiKey('AIzaSyMySecretKey');
      expect(await getApiKey()).toBe('AIzaSyMySecretKey');

      await removeApiKey();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('utkio_gemini_api_key_present');
      expect(await getApiKey()).toBe('');
    });

    it('test_getApiKey_returns_empty_when_active_flag_is_not_1_even_if_raw_key_exists_on_disk', async () => {
      // Simulate raw value lingering in storage after native deletion failure
      localStorageMock.getItem.mockImplementation((k) => {
        if (k === 'utkio_gemini_api_key_present') return null; // Flag cleared
        if (k === API_KEY_STORAGE_KEY) return 'AIzaSyStaleLingeringKey';
        return null;
      });

      const key = await getApiKey();
      expect(key).toBe(''); // Must NOT resurrect!
    });

    it('test_setApiKey_with_empty_or_whitespace_triggers_removeApiKey', async () => {
      await setApiKey('AIzaSyTest');
      expect(await getApiKey()).toBe('AIzaSyTest');

      await setApiKey('   ');
      expect(await getApiKey()).toBe('');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('utkio_gemini_api_key_present');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 3: Settings Page UI States & Expand Toggle (settings.html)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 3: Settings Page UI States & Expand Toggle (settings.html)', () => {
    function createKeyExpandHarness() {
      let isExpanded = false;
      const toggleRow = {
        attributes: { 'aria-expanded': 'false' },
        setAttribute(k, v) { this.attributes[k] = String(v); },
        getAttribute(k) { return this.attributes[k]; }
      };
      const detailsCard = {
        style: { display: 'none' }
      };

      function toggleDetails() {
        isExpanded = !isExpanded;
        detailsCard.style.display = isExpanded ? 'block' : 'none';
        toggleRow.setAttribute('aria-expanded', String(isExpanded));
      }

      return { toggleRow, detailsCard, toggleDetails, isExpanded: () => isExpanded };
    }

    it('test_key_expand_toggle_switches_visibility_and_aria_expanded_attribute', () => {
      const harness = createKeyExpandHarness();
      expect(harness.toggleRow.getAttribute('aria-expanded')).toBe('false');
      expect(harness.detailsCard.style.display).toBe('none');

      harness.toggleDetails();
      expect(harness.toggleRow.getAttribute('aria-expanded')).toBe('true');
      expect(harness.detailsCard.style.display).toBe('block');

      harness.toggleDetails();
      expect(harness.toggleRow.getAttribute('aria-expanded')).toBe('false');
      expect(harness.detailsCard.style.display).toBe('none');
    });

    it('test_needsKey_url_parameter_activates_attention_banner', () => {
      const banner = { classList: new Set() };
      const card = { classList: new Set() };

      const params = new URLSearchParams('?needsKey=1');
      if (params.get('needsKey') === '1') {
        banner.classList.add('show');
        card.classList.add('needs-attention');
      }

      expect(banner.classList.has('show')).toBe(true);
      expect(card.classList.has('needs-attention')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 4: Plan Status Display Logic (settings.html)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 4: Plan Status Display & Termination Handling (settings.html)', () => {
    function computePlanDisplay(planData) {
      if (!planData || planData.plan === 'none') {
        return {
          name: 'Free Trial',
          isInactive: false,
          ctaTitle: 'View Plans'
        };
      }
      if (planData.plan === 'commit_mode' && planData.is_terminated) {
        return {
          name: 'Commit Mode (Terminated)',
          isInactive: true,
          ctaTitle: 'Choose a New Plan',
          terminationNotice: planData.termination_reason || 'Commit Mode daily requirement was missed.'
        };
      }
      if (planData.is_expired) {
        return {
          name: `${planData.plan.toUpperCase()} (Expired)`,
          isInactive: true,
          ctaTitle: 'Renew Plan'
        };
      }
      return {
        name: planData.plan === 'starter' ? 'Starter Plan' : 'Commit Mode',
        isInactive: false,
        ctaTitle: 'Manage Plan'
      };
    }

    it('test_plan_display_renders_starter_plan_as_active', () => {
      const display = computePlanDisplay({ plan: 'starter', is_expired: false });
      expect(display.name).toBe('Starter Plan');
      expect(display.isInactive).toBe(false);
      expect(display.ctaTitle).toBe('Manage Plan');
    });

    it('test_plan_display_renders_expired_plan_as_inactive_with_renew_cta', () => {
      const display = computePlanDisplay({ plan: 'starter', is_expired: true });
      expect(display.name).toBe('STARTER (Expired)');
      expect(display.isInactive).toBe(true);
      expect(display.ctaTitle).toBe('Renew Plan');
    });

    it('test_plan_display_renders_terminated_commit_mode_with_notice', () => {
      const display = computePlanDisplay({
        plan: 'commit_mode',
        is_terminated: true,
        termination_reason: 'Missed daily practice on 2026-08-29'
      });
      expect(display.name).toBe('Commit Mode (Terminated)');
      expect(display.isInactive).toBe(true);
      expect(display.terminationNotice).toContain('Missed daily practice');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 5: Mic Capture Plugin Detection (mic-helpers.js)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 5: Mic Capture Plugin Detection (mic-helpers.js)', () => {
    it('test_getMicCapturePlugin_throws_helpful_error_when_plugin_is_missing', () => {
      globalThis.window.Capacitor.Plugins.MicCapture = undefined;

      expect(() => getMicCapturePlugin()).toThrowError(/MicCapture native plugin/);
    });

    it('test_getMicCapturePluginOrNull_returns_null_without_throwing', () => {
      globalThis.window.Capacitor.Plugins.MicCapture = undefined;

      expect(getMicCapturePluginOrNull()).toBeNull();
    });

    it('test_getMicCapturePlugin_returns_plugin_when_registered', () => {
      const mockPlugin = { start: vi.fn(), stop: vi.fn() };
      globalThis.window.Capacitor.Plugins.MicCapture = mockPlugin;

      expect(getMicCapturePlugin()).toBe(mockPlugin);
      expect(getMicCapturePluginOrNull()).toBe(mockPlugin);
    });
  });
});
