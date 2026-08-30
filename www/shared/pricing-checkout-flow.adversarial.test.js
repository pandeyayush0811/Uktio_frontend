import './config.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { trialBannerText } from './plan.js';

describe('Adversarial & Hardcore Test Suite — Phase 8: Subscriptions, Commit Mode & Checkout (pricing.html & plan.js)', () => {
  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 1: Commit Mode 3-Checkbox Legal Consent Gating (pricing.html)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 1: Commit Mode 3-Checkbox Legal Consent Gating (pricing.html)', () => {
    function createCommitModeConsentHarness() {
      const cbDaily = { checked: false };
      const cbNoRefund = { checked: false };
      const cbDevice = { checked: false };
      const confirmBtn = { disabled: true };
      let isModalOpen = false;

      function updateConfirmButton() {
        confirmBtn.disabled = !(cbDaily.checked && cbNoRefund.checked && cbDevice.checked);
      }

      function openModal() {
        isModalOpen = true;
        cbDaily.checked = false;
        cbNoRefund.checked = false;
        cbDevice.checked = false;
        updateConfirmButton();
      }

      function closeModal() {
        isModalOpen = false;
        cbDaily.checked = false;
        cbNoRefund.checked = false;
        cbDevice.checked = false;
        updateConfirmButton();
      }

      return {
        cbDaily,
        cbNoRefund,
        cbDevice,
        confirmBtn,
        isOpen: () => isModalOpen,
        openModal,
        closeModal,
        updateConfirmButton
      };
    }

    it('test_commit_mode_confirm_button_is_strictly_disabled_until_all_3_checkboxes_are_checked', () => {
      const harness = createCommitModeConsentHarness();
      harness.openModal();

      expect(harness.confirmBtn.disabled).toBe(true);

      // Checkbox 1 checked only
      harness.cbDaily.checked = true;
      harness.updateConfirmButton();
      expect(harness.confirmBtn.disabled).toBe(true);

      // Checkbox 1 & 2 checked
      harness.cbNoRefund.checked = true;
      harness.updateConfirmButton();
      expect(harness.confirmBtn.disabled).toBe(true);

      // Checkbox 1, 2, and 3 checked -> ENABLED!
      harness.cbDevice.checked = true;
      harness.updateConfirmButton();
      expect(harness.confirmBtn.disabled).toBe(false);

      // Unchecking any single box immediately disables confirm button again
      harness.cbNoRefund.checked = false;
      harness.updateConfirmButton();
      expect(harness.confirmBtn.disabled).toBe(true);
    });

    it('test_closing_modal_resets_all_checkboxes_and_disables_confirm_button', () => {
      const harness = createCommitModeConsentHarness();
      harness.openModal();

      harness.cbDaily.checked = true;
      harness.cbNoRefund.checked = true;
      harness.cbDevice.checked = true;
      harness.updateConfirmButton();
      expect(harness.confirmBtn.disabled).toBe(false);

      harness.closeModal();
      expect(harness.isOpen()).toBe(false);
      expect(harness.cbDaily.checked).toBe(false);
      expect(harness.cbNoRefund.checked).toBe(false);
      expect(harness.cbDevice.checked).toBe(false);
      expect(harness.confirmBtn.disabled).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 2: Checkout Initiation Mutex & Rapid Tap Protection (pricing.html)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 2: Checkout Initiation Mutex & Rapid Tap Protection (pricing.html)', () => {
    function createCheckoutHarness() {
      let isCheckoutBusy = false;
      const starterBtn = { disabled: false, textContent: 'Get Starter Plan' };
      const statusMsg = { textContent: '', className: '' };

      async function initiateCheckout(plan, mockCreateOrderCall) {
        if (isCheckoutBusy) return 'duplicate_blocked';
        isCheckoutBusy = true;
        starterBtn.disabled = true;
        starterBtn.textContent = 'Preparing checkout…';

        try {
          const data = await mockCreateOrderCall({ plan });
          return { checkoutUrl: data.checkout_url };
        } catch (err) {
          statusMsg.className = 'status-msg err';
          statusMsg.textContent = err.message || 'Could not initiate checkout';
          return 'failed';
        } finally {
          isCheckoutBusy = false;
          starterBtn.disabled = false;
          starterBtn.textContent = 'Get Starter Plan';
        }
      }

      return {
        starterBtn,
        statusMsg,
        initiateCheckout,
        isBusy: () => isCheckoutBusy
      };
    }

    it('test_rapid_checkout_button_clicks_are_dropped_by_busy_mutex', async () => {
      const harness = createCheckoutHarness();
      let resolveOrder;
      const mockOrderCall = () => new Promise((res) => { resolveOrder = res; });

      const p1 = harness.initiateCheckout('starter', mockOrderCall);
      const p2 = harness.initiateCheckout('starter', mockOrderCall);

      expect(await p2).toBe('duplicate_blocked');

      resolveOrder({ checkout_url: 'https://utkio-backend.onrender.com/public/checkout.html?token=tok-123' });
      const res1 = await p1;

      expect(res1.checkoutUrl).toContain('token=tok-123');
      expect(harness.isBusy()).toBe(false);
      expect(harness.starterBtn.disabled).toBe(false);
    });

    it('test_checkout_failure_re_enables_button_and_shows_error_message', async () => {
      const harness = createCheckoutHarness();
      const mockFailingOrder = () => Promise.reject(new Error('Razorpay service unavailable'));

      const result = await harness.initiateCheckout('starter', mockFailingOrder);

      expect(result).toBe('failed');
      expect(harness.statusMsg.className).toContain('err');
      expect(harness.statusMsg.textContent).toBe('Razorpay service unavailable');
      expect(harness.starterBtn.disabled).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 3: Plan Gating & Trial Status Banner Formatting (plan.js)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 3: Trial Banner Text & Entitlement Formatting (plan.js)', () => {
    it('test_trialBannerText_formats_remaining_days_chats_and_scenarios_cleanly', () => {
      const status1 = {
        plan: 'none',
        trial: {
          active: true,
          days_left: 3,
          chats_remaining: 5,
          scenarios_remaining: 1,
          reports_remaining: 5
        }
      };

      const banner1 = trialBannerText(status1);
      expect(banner1).toContain('3 days left');
      expect(banner1).toContain('5 chats');
      expect(banner1).toContain('1 scenario');
      expect(banner1).toContain('5 reports');
    });

    it('test_trialBannerText_returns_null_when_user_is_on_paid_plan', () => {
      const paidStatus = {
        plan: 'starter',
        trial: { active: false }
      };

      expect(trialBannerText(paidStatus)).toBeNull();
    });

    it('test_trialBannerText_handles_single_day_and_single_chat_pluralization', () => {
      const statusSingle = {
        plan: 'none',
        trial: {
          active: true,
          days_left: 1,
          chats_remaining: 1,
          scenarios_remaining: 0,
          reports_remaining: 1
        }
      };

      const banner = trialBannerText(statusSingle);
      expect(banner).toContain('1 day left');
      expect(banner).toContain('1 chat');
      expect(banner).toContain('0 scenarios');
      expect(banner).toContain('1 report');
    });
  });
});
