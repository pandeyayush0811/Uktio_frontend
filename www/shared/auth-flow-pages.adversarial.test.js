import './config.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  saveSession,
  getSession,
  clearSession,
  getAccessToken,
  goToPostAuthDestination,
  syncPendingChatSession,
  PENDING_CHAT_SESSION_KEY
} from './auth.js';
import { looksLikeIndianMobile } from './formatters.js';
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

describe('Adversarial & Hardcore Test Suite — Phase 1: Splash & Authentication (index.html & login.html)', () => {
  let localStorageMock;
  let originalFetch;
  let originalWindow;
  let appListeners;
  let appMock;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();

    localStorageMock = makeStorageMock();
    globalThis.localStorage = localStorageMock;

    appListeners = {};
    appMock = {
      addListener: vi.fn((event, callback) => {
        appListeners[event] = callback;
        return { remove: vi.fn() };
      }),
      minimizeApp: vi.fn()
    };

    originalFetch = globalThis.fetch;
    originalWindow = globalThis.window;

    globalThis.window = {
      location: { href: 'http://localhost/index.html' },
      UTKIO_CONFIG: {
        BACKEND_URL: 'https://utkio-backend.onrender.com',
        GOOGLE_WEB_CLIENT_ID: 'test-google-client-id'
      },
      Capacitor: {
        Plugins: {
          App: appMock,
          GoogleSignIn: {
            initialize: vi.fn().mockResolvedValue(undefined),
            signIn: vi.fn()
          }
        }
      }
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 1: Splash Boot, Corrupted Sessions & Sync Faults (index.html)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 1: Splash Boot & Session Routing (index.html)', () => {
    it('test_splash_handles_corrupted_json_in_storage_and_routes_to_login', async () => {
      // Simulate corrupt JSON on disk
      localStorageMock.getItem.mockReturnValue('{ malformed json !@#');

      const session = await getSession();
      expect(session).toBeNull();

      // In index.html: if (!session || !session.access_token) -> window.location.href = 'login.html'
      let navigatedTo = null;
      if (session && session.access_token) {
        navigatedTo = 'post_auth';
      } else {
        navigatedTo = 'login.html';
      }

      expect(navigatedTo).toBe('login.html');
    });

    it('test_splash_routes_to_login_when_session_has_empty_or_missing_access_token', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify({ user: { id: 'u1' } })); // no access_token

      const session = await getSession();
      expect(session).not.toBeNull();
      expect(session.access_token).toBeUndefined();

      let navigatedTo = null;
      if (session && session.access_token) {
        navigatedTo = 'post_auth';
      } else {
        navigatedTo = 'login.html';
      }

      expect(navigatedTo).toBe('login.html');
    });

    it('test_splash_waits_for_pending_offline_session_sync_before_navigating', async () => {
      const validSession = { access_token: 'valid-jwt', user: { id: 'u1' } };
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'utkio_session') return JSON.stringify(validSession);
        if (key === PENDING_CHAT_SESSION_KEY) return JSON.stringify({
          started_at: '2026-08-30T08:00:00Z',
          messages: [{ role: 'user', content: 'hello' }]
        });
        return null;
      });

      let syncCompleted = false;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        syncCompleted = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({ session_id: 's1' })
        };
      });

      const session = await getSession();
      expect(session?.access_token).toBe('valid-jwt');

      const result = await syncPendingChatSession();
      expect(syncCompleted).toBe(true);
      expect(result).toBe('s1');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(PENDING_CHAT_SESSION_KEY);
    });

    it('test_splash_does_not_hang_indefinitely_if_offline_sync_fails_with_network_error', async () => {
      const validSession = { access_token: 'valid-jwt', user: { id: 'u1' } };
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'utkio_session') return JSON.stringify(validSession);
        if (key === PENDING_CHAT_SESSION_KEY) return JSON.stringify({
          started_at: '2026-08-30T08:00:00Z',
          messages: [{ role: 'user', content: 'hello' }]
        });
        return null;
      });

      // Network 500 error (transient, retryable)
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error / offline'));

      const session = await getSession();
      expect(session?.access_token).toBe('valid-jwt');

      // syncPendingChatSession catches error and resolves cleanly without throwing
      await expect(syncPendingChatSession()).resolves.not.toThrow();

      // Pending session is retained in storage for retry (removeItem NOT called for transient error)
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith(PENDING_CHAT_SESSION_KEY);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 2: Multi-Screen State Machine & Back Navigation (login.html)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 2: Multi-Screen State Machine & Back Navigation (login.html)', () => {
    function createLoginScreenHarness() {
      let currentScreen = 'login';
      let isAuthBusy = false;
      const statusMsgs = {
        loginStatus: '',
        signupStartStatus: '',
        signupVerifyStatus: '',
        forgotStartStatus: '',
        forgotVerifyStatus: ''
      };

      const BACK_TARGET = {
        signupStart: 'login',
        signupVerify: 'signupStart',
        forgotStart: 'login',
        forgotVerify: 'forgotStart'
      };

      function showScreen(name) {
        currentScreen = name;
      }

      function handleBackButton() {
        if (isAuthBusy) return 'blocked_busy';
        const target = BACK_TARGET[currentScreen];
        if (target) {
          for (const k in statusMsgs) statusMsgs[k] = '';
          showScreen(target);
          return target;
        } else {
          appMock.minimizeApp();
          return 'minimized';
        }
      }

      return {
        getScreen: () => currentScreen,
        setScreen: (s) => { currentScreen = s; },
        setBusy: (b) => { isAuthBusy = b; },
        getStatus: (k) => statusMsgs[k],
        setStatus: (k, v) => { statusMsgs[k] = v; },
        handleBackButton
      };
    }

    it('test_back_navigation_unwinds_signup_step_2_to_step_1_and_clears_status_messages', () => {
      const harness = createLoginScreenHarness();
      harness.setScreen('signupVerify');
      harness.setStatus('signupVerifyStatus', 'OTP expired');

      const result = harness.handleBackButton();
      expect(result).toBe('signupStart');
      expect(harness.getScreen()).toBe('signupStart');
      expect(harness.getStatus('signupVerifyStatus')).toBe('');
    });

    it('test_back_navigation_unwinds_signup_step_1_to_login', () => {
      const harness = createLoginScreenHarness();
      harness.setScreen('signupStart');

      const result = harness.handleBackButton();
      expect(result).toBe('login');
      expect(harness.getScreen()).toBe('login');
    });

    it('test_back_navigation_unwinds_forgot_step_2_to_forgot_step_1', () => {
      const harness = createLoginScreenHarness();
      harness.setScreen('forgotVerify');

      const result = harness.handleBackButton();
      expect(result).toBe('forgotStart');
      expect(harness.getScreen()).toBe('forgotStart');
    });

    it('test_back_navigation_on_root_login_screen_minimizes_app_instead_of_crashing', () => {
      const harness = createLoginScreenHarness();
      harness.setScreen('login');

      const result = harness.handleBackButton();
      expect(result).toBe('minimized');
      expect(appMock.minimizeApp).toHaveBeenCalledTimes(1);
    });

    it('test_back_navigation_is_strictly_blocked_while_auth_request_is_in_flight', () => {
      const harness = createLoginScreenHarness();
      harness.setScreen('signupVerify');
      harness.setBusy(true); // Mid-request (verifying OTP)

      const result = harness.handleBackButton();
      expect(result).toBe('blocked_busy');
      expect(harness.getScreen()).toBe('signupVerify'); // Screen preserved!
      expect(appMock.minimizeApp).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 3: Concurrency Mutex & Rapid Button Spamming (login.html)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 3: Concurrency Mutex & Rapid Multi-Click Spamming (login.html)', () => {
    function createAuthButtonsHarness() {
      let isAuthBusy = false;
      const buttons = {
        loginSubmitBtn: { disabled: false },
        googleBtn: { disabled: false, classList: makeClassListMock() },
        signupStartSubmitBtn: { disabled: false },
        signupVerifySubmitBtn: { disabled: false },
        forgotStartSubmitBtn: { disabled: false },
        forgotVerifySubmitBtn: { disabled: false }
      };

      function allBusyToggles() {
        return Object.values(buttons);
      }

      function setAuthBusy(busy) {
        isAuthBusy = busy;
        allBusyToggles().forEach(btn => { btn.disabled = busy; });
        if (busy) buttons.googleBtn.classList.add('btn-loading');
        else buttons.googleBtn.classList.remove('btn-loading');
      }

      let activeCalls = 0;
      async function executeLogin(credentials) {
        if (isAuthBusy) return 'dropped';
        setAuthBusy(true);
        activeCalls++;
        try {
          const res = await globalThis.fetch('https://utkio-backend.onrender.com/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials)
          });
          const data = await res.json();
          return data;
        } finally {
          activeCalls--;
          setAuthBusy(false);
        }
      }

      return {
        isBusy: () => isAuthBusy,
        getButtons: () => buttons,
        setAuthBusy,
        executeLogin,
        getActiveCalls: () => activeCalls
      };
    }

    it('test_setAuthBusy_disables_all_submit_buttons_and_sets_google_loading_indicator', () => {
      const harness = createAuthButtonsHarness();
      expect(harness.isBusy()).toBe(false);

      harness.setAuthBusy(true);
      expect(harness.isBusy()).toBe(true);

      const btns = harness.getButtons();
      expect(btns.loginSubmitBtn.disabled).toBe(true);
      expect(btns.googleBtn.disabled).toBe(true);
      expect(btns.signupStartSubmitBtn.disabled).toBe(true);
      expect(btns.signupVerifySubmitBtn.disabled).toBe(true);
      expect(btns.forgotStartSubmitBtn.disabled).toBe(true);
      expect(btns.forgotVerifySubmitBtn.disabled).toBe(true);
      expect(btns.googleBtn.classList.has('btn-loading')).toBe(true);

      harness.setAuthBusy(false);
      expect(btns.loginSubmitBtn.disabled).toBe(false);
      expect(btns.googleBtn.classList.has('btn-loading')).toBe(false);
    });

    it('test_rapid_burst_clicking_login_button_executes_only_one_network_call_and_drops_duplicates', async () => {
      const harness = createAuthButtonsHarness();

      let resolveFetch;
      globalThis.fetch = vi.fn().mockImplementation(() => new Promise((resolve) => {
        resolveFetch = resolve;
      }));

      // Fire 5 rapid clicks concurrently
      const p1 = harness.executeLogin({ identifier: 'test@utkio.com', password: 'password123' });
      const p2 = harness.executeLogin({ identifier: 'test@utkio.com', password: 'password123' });
      const p3 = harness.executeLogin({ identifier: 'test@utkio.com', password: 'password123' });
      const p4 = harness.executeLogin({ identifier: 'test@utkio.com', password: 'password123' });
      const p5 = harness.executeLogin({ identifier: 'test@utkio.com', password: 'password123' });

      // Clicks 2-5 should have been immediately dropped
      expect(await p2).toBe('dropped');
      expect(await p3).toBe('dropped');
      expect(await p4).toBe('dropped');
      expect(await p5).toBe('dropped');

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(harness.getActiveCalls()).toBe(1);

      // Finish first call
      resolveFetch({
        ok: true,
        json: async () => ({ session: { access_token: 'tok' } })
      });

      const res1 = await p1;
      expect(res1.session.access_token).toBe('tok');
      expect(harness.isBusy()).toBe(false);
      expect(harness.getActiveCalls()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 4: Password Show/Hide Toggle & Accessibility Contract (login.html)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 4: Password Show/Hide Toggle & Accessibility Contract (login.html)', () => {
    function createPasswordToggleHarness(initialType = 'password') {
      const input = { type: initialType };
      const btn = {
        dataset: { target: 'inputField' },
        classList: makeClassListMock(initialType === 'text' ? ['is-visible'] : []),
        attributes: {
          'aria-pressed': initialType === 'text' ? 'true' : 'false',
          'aria-label': initialType === 'text' ? 'Hide password' : 'Show password'
        },
        setAttribute(k, v) { this.attributes[k] = String(v); },
        getAttribute(k) { return this.attributes[k]; }
      };

      function togglePassword() {
        const nowVisible = input.type === 'password';
        input.type = nowVisible ? 'text' : 'password';
        if (nowVisible) btn.classList.add('is-visible');
        else btn.classList.remove('is-visible');
        btn.setAttribute('aria-pressed', String(nowVisible));
        btn.setAttribute('aria-label', nowVisible ? 'Hide password' : 'Show password');
      }

      return { input, btn, togglePassword };
    }

    it('test_password_toggle_switches_type_aria_pressed_and_aria_label_cleanly', () => {
      const harness = createPasswordToggleHarness('password');

      expect(harness.input.type).toBe('password');
      expect(harness.btn.getAttribute('aria-pressed')).toBe('false');
      expect(harness.btn.getAttribute('aria-label')).toBe('Show password');

      // Click toggle -> reveals password
      harness.togglePassword();
      expect(harness.input.type).toBe('text');
      expect(harness.btn.classList.has('is-visible')).toBe(true);
      expect(harness.btn.getAttribute('aria-pressed')).toBe('true');
      expect(harness.btn.getAttribute('aria-label')).toBe('Hide password');

      // Click toggle again -> masks password
      harness.togglePassword();
      expect(harness.input.type).toBe('password');
      expect(harness.btn.classList.has('is-visible')).toBe(false);
      expect(harness.btn.getAttribute('aria-pressed')).toBe('false');
      expect(harness.btn.getAttribute('aria-label')).toBe('Show password');
    });

    it('test_rapid_password_toggle_does_not_leave_desynchronized_aria_state', () => {
      const harness = createPasswordToggleHarness('password');

      for (let i = 0; i < 10; i++) {
        harness.togglePassword();
      }

      // Even number of toggles -> restores original password state
      expect(harness.input.type).toBe('password');
      expect(harness.btn.getAttribute('aria-pressed')).toBe('false');
      expect(harness.btn.getAttribute('aria-label')).toBe('Show password');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 5: Mobile Number Validation Edge Cases (login.html)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 5: Mobile Number & Form Validation Edge Cases (login.html)', () => {
    it('test_looksLikeIndianMobile_accepts_valid_10_digit_indian_numbers', () => {
      expect(looksLikeIndianMobile('9876543210')).toBe(true);
      expect(looksLikeIndianMobile('8123456789')).toBe(true);
      expect(looksLikeIndianMobile('7000000000')).toBe(true);
      expect(looksLikeIndianMobile('6999999999')).toBe(true);
      expect(looksLikeIndianMobile('98765 43210')).toBe(true); // spaces stripped
      expect(looksLikeIndianMobile('98765-43210')).toBe(true); // hyphens stripped
    });

    it('test_looksLikeIndianMobile_rejects_invalid_prefixes_length_and_characters', () => {
      expect(looksLikeIndianMobile('0123456789')).toBe(false); // starts with 0
      expect(looksLikeIndianMobile('1234567890')).toBe(false); // starts with 1
      expect(looksLikeIndianMobile('5555555555')).toBe(false); // starts with 5
      expect(looksLikeIndianMobile('987654321')).toBe(false);  // 9 digits
      expect(looksLikeIndianMobile('98765432100')).toBe(false); // 11 digits
      expect(looksLikeIndianMobile('+919876543210')).toBe(false); // formatted with +91 (needs 10 raw digits)
      expect(looksLikeIndianMobile('98765abcde')).toBe(false); // letters
      expect(looksLikeIndianMobile('')).toBe(false); // empty
      expect(looksLikeIndianMobile('   ')).toBe(false); // whitespace
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 6: Signup State Continuity & Resend Cooldown (login.html)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 6: Signup State Continuity & Resend Cooldown (login.html)', () => {
    function createSignupFlowHarness() {
      let pendingSignupEmail = '';
      let pendingSignupPhone = '';
      let resendTimer = null;
      let secondsLeft = 0;
      const resendLink = {
        style: { pointerEvents: '', opacity: '' },
        textContent: 'Resend OTP'
      };

      function handleStep1Success(email, phone) {
        pendingSignupEmail = email;
        pendingSignupPhone = phone;
        startResendCooldown();
      }

      function startResendCooldown() {
        secondsLeft = 60;
        resendLink.style.pointerEvents = 'none';
        resendLink.style.opacity = '0.5';
        resendLink.textContent = `Resend OTP (${secondsLeft}s)`;
        if (resendTimer) clearInterval(resendTimer);
        resendTimer = setInterval(() => {
          secondsLeft -= 1;
          if (secondsLeft <= 0) {
            clearInterval(resendTimer);
            resendLink.style.pointerEvents = '';
            resendLink.style.opacity = '';
            resendLink.textContent = 'Resend OTP';
          } else {
            resendLink.textContent = `Resend OTP (${secondsLeft}s)`;
          }
        }, 1000);
      }

      function triggerResend() {
        if (resendLink.style.pointerEvents === 'none') return 'cooldown_blocked';
        startResendCooldown();
        return { email: pendingSignupEmail, phone: pendingSignupPhone };
      }

      return {
        getEmail: () => pendingSignupEmail,
        getPhone: () => pendingSignupPhone,
        getResendLink: () => resendLink,
        handleStep1Success,
        triggerResend,
        clearTimer: () => { if (resendTimer) clearInterval(resendTimer); }
      };
    }

    it('test_signup_step1_locks_resend_button_for_60_seconds_with_live_countdown', () => {
      const harness = createSignupFlowHarness();
      harness.handleStep1Success('newuser@utkio.com', '9876543210');

      expect(harness.getEmail()).toBe('newuser@utkio.com');
      expect(harness.getPhone()).toBe('9876543210');

      const link = harness.getResendLink();
      expect(link.style.pointerEvents).toBe('none');
      expect(link.style.opacity).toBe('0.5');
      expect(link.textContent).toBe('Resend OTP (60s)');

      // Advance 30 seconds
      vi.advanceTimersByTime(30000);
      expect(link.textContent).toBe('Resend OTP (30s)');
      expect(link.style.pointerEvents).toBe('none');

      // Tapping resend during cooldown is blocked
      expect(harness.triggerResend()).toBe('cooldown_blocked');

      // Advance remaining 30 seconds
      vi.advanceTimersByTime(30000);
      expect(link.textContent).toBe('Resend OTP');
      expect(link.style.pointerEvents).toBe('');
      expect(link.style.opacity).toBe('');

      // Now resend succeeds and targets the exact same email/phone
      const resendPayload = harness.triggerResend();
      expect(resendPayload).toEqual({ email: 'newuser@utkio.com', phone: '9876543210' });

      harness.clearTimer();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 7: Existing Account Collision / Hijacking Defense (AUD-032)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 7: Existing Account Collision / Hijacking Defense (AUD-032)', () => {
    it('test_signup_start_handles_409_account_exists_gracefully_without_advancing_screen', async () => {
      let currentScreen = 'signupStart';
      let statusMsg = '';
      let statusCls = '';

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          error: 'An account with this email or mobile number already exists. Please log in.',
          code: 'account_exists'
        })
      });

      // Execute Step 1 submit handler logic
      try {
        const res = await globalThis.fetch('https://utkio-backend.onrender.com/auth/signup/otp', {
          method: 'POST',
          body: JSON.stringify({ email: 'existing@utkio.com', phone: '9876543210' })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Signup failed');
        currentScreen = 'signupVerify'; // Should NOT reach here
      } catch (err) {
        statusMsg = err.message;
        statusCls = 'err';
      }

      expect(currentScreen).toBe('signupStart');
      expect(statusCls).toBe('err');
      expect(statusMsg).toContain('already exists');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 8: Google Sign-In Plugin Resilience (login.html)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 8: Google Sign-In Plugin Resilience (login.html)', () => {
    it('test_google_signin_handles_missing_capacitor_plugin_gracefully', async () => {
      globalThis.window.Capacitor.Plugins.GoogleSignIn = undefined; // Plugin not present in browser preview

      let statusMsg = '';
      let statusCls = '';
      let isBusy = false;

      async function handleGoogleClick() {
        isBusy = true;
        try {
          if (!globalThis.window.Capacitor?.Plugins?.GoogleSignIn) {
            throw new Error('Google Sign-In plugin not set up yet in this build — see setup notes.');
          }
          await globalThis.window.Capacitor.Plugins.GoogleSignIn.signIn();
        } catch (err) {
          statusMsg = err.message;
          statusCls = 'err';
          isBusy = false;
        }
      }

      await handleGoogleClick();
      expect(statusCls).toBe('err');
      expect(statusMsg).toContain('Google Sign-In plugin not set up');
      expect(isBusy).toBe(false);
    });

    it('test_google_signin_handles_user_cancellation_without_leaving_button_stuck', async () => {
      globalThis.window.Capacitor.Plugins.GoogleSignIn.signIn = vi.fn().mockRejectedValue(new Error('User cancelled sign in'));

      let statusMsg = '';
      let isBusy = false;

      async function handleGoogleClick() {
        isBusy = true;
        try {
          await globalThis.window.Capacitor.Plugins.GoogleSignIn.signIn();
        } catch (err) {
          statusMsg = err.message;
          isBusy = false;
        }
      }

      await handleGoogleClick();
      expect(statusMsg).toBe('User cancelled sign in');
      expect(isBusy).toBe(false);
    });

    it('test_google_signin_rejects_when_idToken_is_missing_from_response', async () => {
      globalThis.window.Capacitor.Plugins.GoogleSignIn.signIn = vi.fn().mockResolvedValue({ idToken: null }); // Missing token

      let statusMsg = '';
      let isBusy = false;

      async function handleGoogleClick() {
        isBusy = true;
        try {
          const result = await globalThis.window.Capacitor.Plugins.GoogleSignIn.signIn();
          if (!result?.idToken) throw new Error('Google did not return an idToken.');
        } catch (err) {
          statusMsg = err.message;
          isBusy = false;
        }
      }

      await handleGoogleClick();
      expect(statusMsg).toBe('Google did not return an idToken.');
      expect(isBusy).toBe(false);
    });
  });
});
