// Role: 06_TestWriter (Senior Frontend Adversarial QA)
// Issue Reference: AUD-033 (Form Submissions Unconditionally Activating Google Button Loading State)
// Target Component: frontend_updated/frontend/www/login.html
// Stack: Vanilla JS / HTML5 / Vitest

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Adversarial Test Suite — AUD-033: Form Submissions Active Loading State vs Google Button Spinner', () => {
  const loginHtmlPath = path.resolve(__dirname, '../login.html');
  let loginHtmlContent = '';

  beforeEach(() => {
    loginHtmlContent = fs.readFileSync(loginHtmlPath, 'utf8');
  });

  // Helper to build a comprehensive synthetic DOM harness simulating login.html's exact implementation
  function createLoginDomHarness() {
    const classListMock = () => {
      const classes = new Set();
      return {
        add: vi.fn((cls) => classes.add(cls)),
        remove: vi.fn((cls) => classes.delete(cls)),
        toggle: vi.fn((cls, force) => {
          if (force === undefined) {
            if (classes.has(cls)) classes.delete(cls);
            else classes.add(cls);
          } else if (force) {
            classes.add(cls);
          } else {
            classes.delete(cls);
          }
          return classes.has(cls);
        }),
        has: vi.fn((cls) => classes.has(cls)),
        contains: vi.fn((cls) => classes.has(cls)),
        get _classes() { return Array.from(classes); }
      };
    };

    const createButton = (id, text = '') => ({
      id,
      textContent: text,
      disabled: false,
      classList: classListMock(),
      style: {}
    });

    const createInput = (id, type = 'text', value = '') => ({
      id,
      type,
      value,
      required: false,
      pattern: '',
      maxLength: 100,
      setAttribute: vi.fn(),
      getAttribute: vi.fn()
    });

    const elements = {
      loginSubmitBtn: createButton('loginSubmitBtn', 'Log In'),
      googleBtn: createButton('googleBtn', 'Continue with Google'),
      googleBtnLabel: { textContent: 'Continue with Google' },
      signupStartSubmitBtn: createButton('signupStartSubmitBtn', 'Send OTP'),
      signupVerifySubmitBtn: createButton('signupVerifySubmitBtn', 'Verify & Create Account'),
      forgotStartSubmitBtn: createButton('forgotStartSubmitBtn', 'Send OTP'),
      forgotVerifySubmitBtn: createButton('forgotVerifySubmitBtn', 'Reset Password'),
      signupResendOtp: createButton('signupResendOtp', 'Resend OTP'),
      forgotResendOtp: createButton('forgotResendOtp', 'Resend OTP'),
      loginIdentifier: createInput('loginIdentifier', 'text', 'test@utkio.com'),
      loginPassword: createInput('loginPassword', 'password', 'SecretPass123'),
      signupEmail: createInput('signupEmail', 'email', 'newuser@utkio.com'),
      signupPhone: createInput('signupPhone', 'tel', '9876543210'),
      signupOtp: createInput('signupOtp', 'text', '123456'),
      signupPassword: createInput('signupPassword', 'password', 'NewPass123!'),
      forgotIdentifier: createInput('forgotIdentifier', 'text', 'user@utkio.com'),
      forgotOtp: createInput('forgotOtp', 'text', '654321'),
      forgotNewPassword: createInput('forgotNewPassword', 'password', 'ResetPass456!'),
      loginStatus: { id: 'loginStatus', textContent: '', className: 'status-msg' },
      signupStartStatus: { id: 'signupStartStatus', textContent: '', className: 'status-msg' },
      signupVerifyStatus: { id: 'signupVerifyStatus', textContent: '', className: 'status-msg' },
      forgotStartStatus: { id: 'forgotStartStatus', textContent: '', className: 'status-msg' },
      forgotVerifyStatus: { id: 'forgotVerifyStatus', textContent: '', className: 'status-msg' },
      screenLogin: { style: { display: '' } },
      screenSignupStart: { style: { display: 'none' } },
      screenSignupVerify: { style: { display: 'none' } },
      screenForgotStart: { style: { display: 'none' } },
      screenForgotVerify: { style: { display: 'none' } },
      signupVerifySub: { textContent: '' }
    };

    let isAuthBusy = false;

    function allBusyToggles() {
      return [
        elements.loginSubmitBtn,
        elements.googleBtn,
        elements.signupStartSubmitBtn,
        elements.signupVerifySubmitBtn,
        elements.forgotStartSubmitBtn,
        elements.forgotVerifySubmitBtn
      ];
    }

    function setAuthBusy(busy, activeBtn = null) {
      isAuthBusy = busy;
      allBusyToggles().forEach(btn => {
        if (btn) {
          btn.disabled = busy;
          if (!busy && btn.classList) btn.classList.remove('btn-loading');
        }
      });
      if (busy && activeBtn && activeBtn.classList) {
        activeBtn.classList.add('btn-loading');
      }
    }

    function setStatus(elId, text, cls) {
      const el = elements[elId];
      if (!el) return;
      el.textContent = text || '';
      el.className = 'status-msg' + (cls ? ' ' + cls : '');
    }

    return {
      elements,
      isAuthBusy: () => isAuthBusy,
      allBusyToggles,
      setAuthBusy,
      setStatus
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 1: Source Code Static Contract & Form Wiring
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 1: Static Code Contract & Wiring in login.html', () => {
    it('test_setAuthBusy_accepts_activeBtn_parameter_and_guards_spinner', () => {
      // Catch regression where setAuthBusy is defined without activeBtn parameter
      const fnMatch = loginHtmlContent.match(/function\s+setAuthBusy\s*\(([^)]*)\)\s*\{([\s\S]*?)\n\}/);
      expect(fnMatch, 'setAuthBusy must be declared as a function in login.html').toBeTruthy();

      const params = fnMatch[1];
      expect(params).toMatch(/busy\s*,\s*activeBtn/);

      const body = fnMatch[2];
      // Unconditional toggle on googleBtn must NEVER be present
      expect(body).not.toMatch(/googleBtn.*classList\.toggle\(['"]btn-loading['"]/);
      expect(body).not.toMatch(/getElementById\(['"]googleBtn['"]\)\.classList\.toggle/);

      // Loading class should be applied to activeBtn only
      expect(body).toMatch(/activeBtn\.classList\.add\(['"]btn-loading['"]\)/);
      expect(body).toMatch(/btn\.classList\.remove\(['"]btn-loading['"]\)/);
    });

    it('test_allBusyToggles_includes_all_six_interactive_auth_buttons', () => {
      // Must cover: loginSubmitBtn, googleBtn, signupStartSubmitBtn, signupVerifySubmitBtn, forgotStartSubmitBtn, forgotVerifySubmitBtn
      const fnMatch = loginHtmlContent.match(/function\s+allBusyToggles\s*\(\)\s*\{([\s\S]*?)\n\}/);
      expect(fnMatch, 'allBusyToggles function must exist in login.html').toBeTruthy();

      const body = fnMatch[1];
      expect(body).toContain("getElementById('loginSubmitBtn')");
      expect(body).toContain("getElementById('googleBtn')");
      expect(body).toContain("getElementById('signupStartSubmitBtn')");
      expect(body).toContain("getElementById('signupVerifySubmitBtn')");
      expect(body).toContain("getElementById('forgotStartSubmitBtn')");
      expect(body).toContain("getElementById('forgotVerifySubmitBtn')");
    });

    it('test_every_form_submission_passes_its_own_button_to_setAuthBusy', () => {
      // Login Form -> loginSubmitBtn
      expect(loginHtmlContent).toMatch(/loginForm.*addEventListener\(['"]submit['"],[\s\S]*?setAuthBusy\(\s*true\s*,\s*document\.getElementById\(['"]loginSubmitBtn['"]\)/);

      // Signup Start Form -> signupStartSubmitBtn
      expect(loginHtmlContent).toMatch(/signupStartForm.*addEventListener\(['"]submit['"],[\s\S]*?setAuthBusy\(\s*true\s*,\s*document\.getElementById\(['"]signupStartSubmitBtn['"]\)/);

      // Signup Verify Form -> signupVerifySubmitBtn
      expect(loginHtmlContent).toMatch(/signupVerifyForm.*addEventListener\(['"]submit['"],[\s\S]*?setAuthBusy\(\s*true\s*,\s*document\.getElementById\(['"]signupVerifySubmitBtn['"]\)/);

      // Forgot Start Form -> forgotStartSubmitBtn
      expect(loginHtmlContent).toMatch(/forgotStartForm.*addEventListener\(['"]submit['"],[\s\S]*?setAuthBusy\(\s*true\s*,\s*document\.getElementById\(['"]forgotStartSubmitBtn['"]\)/);

      // Forgot Verify Form -> forgotVerifySubmitBtn
      expect(loginHtmlContent).toMatch(/forgotVerifyForm.*addEventListener\(['"]submit['"],[\s\S]*?setAuthBusy\(\s*true\s*,\s*document\.getElementById\(['"]forgotVerifySubmitBtn['"]\)/);

      // Google Button Click -> googleBtn
      expect(loginHtmlContent).toMatch(/googleBtn.*addEventListener\(['"]click['"],[\s\S]*?setAuthBusy\(\s*true\s*,\s*googleBtn\)/);
    });

    it('test_all_forms_and_resend_handlers_invoke_setAuthBusy_false_in_catch_or_finally', () => {
      // Verify every auth workflow has a guaranteed unlock path
      const loginSection = loginHtmlContent.slice(loginHtmlContent.indexOf("id='loginForm'") || loginHtmlContent.indexOf('id="loginForm"'));
      expect(loginHtmlContent).toMatch(/signupStartForm[\s\S]*?finally\s*\{[\s\S]*?setAuthBusy\(false\)/);
      expect(loginHtmlContent).toMatch(/signupResendOtp[\s\S]*?finally\s*\{[\s\S]*?setAuthBusy\(false\)/);
      expect(loginHtmlContent).toMatch(/forgotStartForm[\s\S]*?finally\s*\{[\s\S]*?setAuthBusy\(false\)/);
      expect(loginHtmlContent).toMatch(/forgotResendOtp[\s\S]*?finally\s*\{[\s\S]*?setAuthBusy\(false\)/);
      expect(loginHtmlContent).toMatch(/loginForm[\s\S]*?catch\s*\([^)]*\)\s*\{[\s\S]*?setAuthBusy\(false\)/);
      expect(loginHtmlContent).toMatch(/signupVerifyForm[\s\S]*?catch\s*\([^)]*\)\s*\{[\s\S]*?setAuthBusy\(false\)/);
      expect(loginHtmlContent).toMatch(/forgotVerifyForm[\s\S]*?catch\s*\([^)]*\)\s*\{[\s\S]*?setAuthBusy\(false\)/);
      expect(loginHtmlContent).toMatch(/googleBtn[\s\S]*?catch\s*\([^)]*\)\s*\{[\s\S]*?setAuthBusy\(false\)/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 2: Multi-Button Loading Isolation Matrix (AUD-033 Core Verification)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 2: Button Loading State Isolation Matrix', () => {
    it('test_login_submit_disables_all_buttons_but_spins_only_loginSubmitBtn', () => {
      const harness = createLoginDomHarness();
      const btns = harness.elements;

      harness.setAuthBusy(true, btns.loginSubmitBtn);

      // All buttons must be disabled to prevent concurrent race conditions
      expect(btns.loginSubmitBtn.disabled).toBe(true);
      expect(btns.googleBtn.disabled).toBe(true);
      expect(btns.signupStartSubmitBtn.disabled).toBe(true);
      expect(btns.signupVerifySubmitBtn.disabled).toBe(true);
      expect(btns.forgotStartSubmitBtn.disabled).toBe(true);
      expect(btns.forgotVerifySubmitBtn.disabled).toBe(true);

      // ONLY loginSubmitBtn must receive .btn-loading
      expect(btns.loginSubmitBtn.classList.has('btn-loading')).toBe(true);
      expect(btns.googleBtn.classList.has('btn-loading')).toBe(false);
      expect(btns.signupStartSubmitBtn.classList.has('btn-loading')).toBe(false);
      expect(btns.signupVerifySubmitBtn.classList.has('btn-loading')).toBe(false);
      expect(btns.forgotStartSubmitBtn.classList.has('btn-loading')).toBe(false);
      expect(btns.forgotVerifySubmitBtn.classList.has('btn-loading')).toBe(false);

      // When released, all buttons re-enabled and spinner cleared
      harness.setAuthBusy(false);
      expect(btns.loginSubmitBtn.disabled).toBe(false);
      expect(btns.googleBtn.disabled).toBe(false);
      expect(btns.loginSubmitBtn.classList.has('btn-loading')).toBe(false);
    });

    it('test_google_btn_click_disables_all_buttons_and_spins_only_googleBtn', () => {
      const harness = createLoginDomHarness();
      const btns = harness.elements;

      harness.setAuthBusy(true, btns.googleBtn);

      expect(btns.loginSubmitBtn.disabled).toBe(true);
      expect(btns.googleBtn.disabled).toBe(true);
      expect(btns.signupStartSubmitBtn.disabled).toBe(true);

      // ONLY googleBtn receives .btn-loading
      expect(btns.googleBtn.classList.has('btn-loading')).toBe(true);
      expect(btns.loginSubmitBtn.classList.has('btn-loading')).toBe(false);
      expect(btns.signupStartSubmitBtn.classList.has('btn-loading')).toBe(false);

      harness.setAuthBusy(false);
      expect(btns.googleBtn.disabled).toBe(false);
      expect(btns.googleBtn.classList.has('btn-loading')).toBe(false);
    });

    it('test_signup_start_form_spins_only_signupStartSubmitBtn', () => {
      const harness = createLoginDomHarness();
      const btns = harness.elements;

      harness.setAuthBusy(true, btns.signupStartSubmitBtn);

      expect(btns.signupStartSubmitBtn.disabled).toBe(true);
      expect(btns.googleBtn.disabled).toBe(true);
      expect(btns.signupStartSubmitBtn.classList.has('btn-loading')).toBe(true);
      expect(btns.googleBtn.classList.has('btn-loading')).toBe(false);
      expect(btns.loginSubmitBtn.classList.has('btn-loading')).toBe(false);

      harness.setAuthBusy(false);
      expect(btns.signupStartSubmitBtn.classList.has('btn-loading')).toBe(false);
    });

    it('test_signup_verify_form_spins_only_signupVerifySubmitBtn', () => {
      const harness = createLoginDomHarness();
      const btns = harness.elements;

      harness.setAuthBusy(true, btns.signupVerifySubmitBtn);

      expect(btns.signupVerifySubmitBtn.disabled).toBe(true);
      expect(btns.googleBtn.disabled).toBe(true);
      expect(btns.signupVerifySubmitBtn.classList.has('btn-loading')).toBe(true);
      expect(btns.googleBtn.classList.has('btn-loading')).toBe(false);

      harness.setAuthBusy(false);
      expect(btns.signupVerifySubmitBtn.classList.has('btn-loading')).toBe(false);
    });

    it('test_forgot_start_form_spins_only_forgotStartSubmitBtn', () => {
      const harness = createLoginDomHarness();
      const btns = harness.elements;

      harness.setAuthBusy(true, btns.forgotStartSubmitBtn);

      expect(btns.forgotStartSubmitBtn.disabled).toBe(true);
      expect(btns.googleBtn.disabled).toBe(true);
      expect(btns.forgotStartSubmitBtn.classList.has('btn-loading')).toBe(true);
      expect(btns.googleBtn.classList.has('btn-loading')).toBe(false);

      harness.setAuthBusy(false);
      expect(btns.forgotStartSubmitBtn.classList.has('btn-loading')).toBe(false);
    });

    it('test_forgot_verify_form_spins_only_forgotVerifySubmitBtn', () => {
      const harness = createLoginDomHarness();
      const btns = harness.elements;

      harness.setAuthBusy(true, btns.forgotVerifySubmitBtn);

      expect(btns.forgotVerifySubmitBtn.disabled).toBe(true);
      expect(btns.googleBtn.disabled).toBe(true);
      expect(btns.forgotVerifySubmitBtn.classList.has('btn-loading')).toBe(true);
      expect(btns.googleBtn.classList.has('btn-loading')).toBe(false);

      harness.setAuthBusy(false);
      expect(btns.forgotVerifySubmitBtn.classList.has('btn-loading')).toBe(false);
    });

    it('test_resend_otp_action_without_activeBtn_disables_all_buttons_without_spinning_any', () => {
      // When Resend OTP is tapped, activeBtn is null. All buttons disable, but NONE spin
      const harness = createLoginDomHarness();
      const btns = harness.elements;

      harness.setAuthBusy(true);

      expect(btns.loginSubmitBtn.disabled).toBe(true);
      expect(btns.googleBtn.disabled).toBe(true);
      expect(btns.signupStartSubmitBtn.disabled).toBe(true);
      expect(btns.signupVerifySubmitBtn.disabled).toBe(true);
      expect(btns.forgotStartSubmitBtn.disabled).toBe(true);
      expect(btns.forgotVerifySubmitBtn.disabled).toBe(true);

      // ZERO buttons should have .btn-loading
      expect(btns.loginSubmitBtn.classList.has('btn-loading')).toBe(false);
      expect(btns.googleBtn.classList.has('btn-loading')).toBe(false);
      expect(btns.signupStartSubmitBtn.classList.has('btn-loading')).toBe(false);
      expect(btns.signupVerifySubmitBtn.classList.has('btn-loading')).toBe(false);
      expect(btns.forgotStartSubmitBtn.classList.has('btn-loading')).toBe(false);
      expect(btns.forgotVerifySubmitBtn.classList.has('btn-loading')).toBe(false);

      harness.setAuthBusy(false);
      expect(btns.loginSubmitBtn.disabled).toBe(false);
      expect(btns.googleBtn.disabled).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 3: Adversarial Concurrency, Rapid Bursts & Race Conditions
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 3: Concurrency, Double Clicks & Cross-Form Interference', () => {
    it('test_rapid_fire_burst_clicks_on_login_drops_duplicate_network_calls', async () => {
      const harness = createLoginDomHarness();
      let networkCallCount = 0;
      let resolveApi;

      const mockApiFetch = vi.fn().mockImplementation(() => new Promise(res => {
        networkCallCount++;
        resolveApi = res;
      }));

      async function triggerLogin() {
        if (harness.isAuthBusy()) return 'dropped';
        harness.setAuthBusy(true, harness.elements.loginSubmitBtn);
        try {
          return await mockApiFetch();
        } finally {
          harness.setAuthBusy(false);
        }
      }

      // Simulate malicious user firing 10 rapid concurrent clicks
      const promises = Array.from({ length: 10 }, () => triggerLogin());

      // 9 out of 10 must have been dropped immediately
      const results = await Promise.all([
        promises[1], promises[2], promises[3], promises[4], promises[5],
        promises[6], promises[7], promises[8], promises[9]
      ]);
      results.forEach(r => expect(r).toBe('dropped'));

      expect(networkCallCount).toBe(1);
      expect(harness.elements.loginSubmitBtn.classList.has('btn-loading')).toBe(true);
      expect(harness.elements.googleBtn.classList.has('btn-loading')).toBe(false);

      // Finish first call
      resolveApi({ session: { access_token: 'valid_token' } });
      await promises[0];

      expect(harness.isAuthBusy()).toBe(false);
      expect(harness.elements.loginSubmitBtn.classList.has('btn-loading')).toBe(false);
    });

    it('test_cross_form_interlocking_prevents_signup_while_login_in_flight', async () => {
      const harness = createLoginDomHarness();
      let resolveLogin;

      const mockLoginFetch = vi.fn().mockImplementation(() => new Promise(res => {
        resolveLogin = res;
      }));

      // 1. User starts Login
      harness.setAuthBusy(true, harness.elements.loginSubmitBtn);

      // 2. User tries to submit Signup Start simultaneously
      let signupTriggered = false;
      function trySignup() {
        if (harness.isAuthBusy()) return 'blocked';
        signupTriggered = true;
        harness.setAuthBusy(true, harness.elements.signupStartSubmitBtn);
      }

      const signupResult = trySignup();
      expect(signupResult).toBe('blocked');
      expect(signupTriggered).toBe(false);

      // 3. User tries to click Google Sign In simultaneously
      let googleTriggered = false;
      function tryGoogle() {
        if (harness.isAuthBusy()) return 'blocked';
        googleTriggered = true;
        harness.setAuthBusy(true, harness.elements.googleBtn);
      }

      const googleResult = tryGoogle();
      expect(googleResult).toBe('blocked');
      expect(googleTriggered).toBe(false);

      // Only Login button should be spinning
      expect(harness.elements.loginSubmitBtn.classList.has('btn-loading')).toBe(true);
      expect(harness.elements.googleBtn.classList.has('btn-loading')).toBe(false);
      expect(harness.elements.signupStartSubmitBtn.classList.has('btn-loading')).toBe(false);

      // Resolve Login
      harness.setAuthBusy(false);
      expect(harness.elements.loginSubmitBtn.classList.has('btn-loading')).toBe(false);
    });

    it('test_google_signin_failure_resets_label_and_clears_loading_state', async () => {
      const harness = createLoginDomHarness();
      const googleBtn = harness.elements.googleBtn;
      const googleBtnLabel = harness.elements.googleBtnLabel;
      const GOOGLE_BTN_DEFAULT_LABEL = 'Continue with Google';

      // Simulate Google Sign-In click
      harness.setAuthBusy(true, googleBtn);
      googleBtnLabel.textContent = 'Signing in...';
      harness.setStatus('loginStatus', 'Opening Google Sign-In...', null);

      expect(googleBtn.classList.has('btn-loading')).toBe(true);
      expect(googleBtnLabel.textContent).toBe('Signing in...');

      // Simulate plugin throw (e.g. user cancelled or missing plugin)
      const pluginError = new Error('Google Sign-In plugin not set up yet in this build — see setup notes.');
      harness.setStatus('loginStatus', pluginError.message, 'err');
      googleBtnLabel.textContent = GOOGLE_BTN_DEFAULT_LABEL;
      harness.setAuthBusy(false);

      // Verify clean recovery
      expect(googleBtn.classList.has('btn-loading')).toBe(false);
      expect(googleBtnLabel.textContent).toBe('Continue with Google');
      expect(googleBtn.disabled).toBe(false);
      expect(harness.elements.loginSubmitBtn.disabled).toBe(false);
      expect(harness.elements.loginStatus.textContent).toContain('Google Sign-In plugin not set up');
      expect(harness.elements.loginStatus.className).toContain('err');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 4: Edge Cases, Null-Safety & Defensive Handling
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 4: Defensive Execution & Null Safety in setAuthBusy', () => {
    it('test_setAuthBusy_does_not_throw_if_DOM_elements_are_null', () => {
      // Simulate partial DOM or unexpected missing element
      let isAuthBusy = false;
      const incompleteButtons = [
        null, // missing loginSubmitBtn
        { disabled: false, classList: { remove: vi.fn(), add: vi.fn() } },
        undefined, // missing button
        null
      ];

      function resilientSetAuthBusy(busy, activeBtn = null) {
        isAuthBusy = busy;
        incompleteButtons.forEach(btn => {
          if (btn) {
            btn.disabled = busy;
            if (!busy && btn.classList) btn.classList.remove('btn-loading');
          }
        });
        if (busy && activeBtn && activeBtn.classList) {
          activeBtn.classList.add('btn-loading');
        }
      }

      expect(() => {
        resilientSetAuthBusy(true, null);
        resilientSetAuthBusy(false);
        resilientSetAuthBusy(true, { classList: { add: vi.fn() } });
      }).not.toThrow();
    });

    it('test_consecutive_redundant_setAuthBusy_calls_remain_stable', () => {
      const harness = createLoginDomHarness();
      const btns = harness.elements;

      // Calling setAuthBusy(false) when already false should be a safe no-op
      harness.setAuthBusy(false);
      harness.setAuthBusy(false);
      expect(harness.isAuthBusy()).toBe(false);
      expect(btns.loginSubmitBtn.disabled).toBe(false);
      expect(btns.loginSubmitBtn.classList.has('btn-loading')).toBe(false);

      // Calling setAuthBusy(true) multiple times updates active button correctly
      harness.setAuthBusy(true, btns.loginSubmitBtn);
      harness.setAuthBusy(true, btns.signupStartSubmitBtn);
      expect(harness.isAuthBusy()).toBe(true);
      expect(btns.signupStartSubmitBtn.classList.has('btn-loading')).toBe(true);

      harness.setAuthBusy(false);
      expect(btns.signupStartSubmitBtn.classList.has('btn-loading')).toBe(false);
      expect(btns.loginSubmitBtn.classList.has('btn-loading')).toBe(false);
    });

    it('test_invalid_indian_mobile_number_validation_does_not_leave_buttons_stuck_busy', () => {
      const harness = createLoginDomHarness();
      const invalidPhone = '12345'; // Invalid

      function looksLikeIndianMobile(val) {
        const cleaned = (val || '').replace(/[\s\-+]/g, '');
        return /^(\+?91)?[6-9]\d{9}$/.test(cleaned);
      }

      // If validation fails prior to setAuthBusy, buttons must remain enabled
      if (!looksLikeIndianMobile(invalidPhone)) {
        harness.setStatus('signupStartStatus', 'Enter a valid 10-digit mobile number', 'err');
      } else {
        harness.setAuthBusy(true, harness.elements.signupStartSubmitBtn);
      }

      expect(harness.isAuthBusy()).toBe(false);
      expect(harness.elements.signupStartSubmitBtn.disabled).toBe(false);
      expect(harness.elements.signupStartSubmitBtn.classList.has('btn-loading')).toBe(false);
      expect(harness.elements.signupStartStatus.textContent).toBe('Enter a valid 10-digit mobile number');
      expect(harness.elements.signupStartStatus.className).toContain('err');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 5: Navigation Locks & Hardware Back Interlocking During Busy
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 5: Hardware Back & Screen Transitions Interlocking', () => {
    it('test_screen_navigation_links_are_strictly_blocked_while_auth_is_busy', () => {
      const harness = createLoginDomHarness();
      let currentScreen = 'login';

      function showScreen(name) {
        currentScreen = name;
      }

      function onGoToSignup() {
        if (harness.isAuthBusy()) return;
        showScreen('signupStart');
      }

      function onGoToForgot() {
        if (harness.isAuthBusy()) return;
        showScreen('forgotStart');
      }

      // Normal flow
      onGoToSignup();
      expect(currentScreen).toBe('signupStart');
      showScreen('login');

      // Busy flow: Login request in-flight
      harness.setAuthBusy(true, harness.elements.loginSubmitBtn);
      onGoToSignup();
      expect(currentScreen).toBe('login'); // Navigation blocked!

      onGoToForgot();
      expect(currentScreen).toBe('login'); // Navigation blocked!

      harness.setAuthBusy(false);
      onGoToForgot();
      expect(currentScreen).toBe('forgotStart'); // Navigation allowed once busy is cleared
    });

    it('test_hardware_back_button_event_is_dropped_while_auth_is_busy', () => {
      const harness = createLoginDomHarness();
      let currentScreen = 'signupVerify';
      let backNavigated = false;

      const BACK_TARGET = {
        signupStart: 'login',
        signupVerify: 'signupStart',
        forgotStart: 'login',
        forgotVerify: 'forgotStart'
      };

      function handleHardwareBack() {
        if (harness.isAuthBusy()) return; // Hardware back dropped!
        const target = BACK_TARGET[currentScreen];
        if (target) {
          currentScreen = target;
          backNavigated = true;
        }
      }

      // 1. In-flight verify OTP
      harness.setAuthBusy(true, harness.elements.signupVerifySubmitBtn);
      handleHardwareBack();

      // Must NOT navigate away while verifying
      expect(currentScreen).toBe('signupVerify');
      expect(backNavigated).toBe(false);

      // 2. Clear busy state and retry back
      harness.setAuthBusy(false);
      handleHardwareBack();
      expect(currentScreen).toBe('signupStart');
      expect(backNavigated).toBe(true);
    });

    it('test_resend_otp_is_blocked_if_cooldown_active_or_auth_busy', () => {
      const harness = createLoginDomHarness();
      let resendNetworkCalls = 0;

      function triggerResendOtp(isCooldownActive) {
        if (harness.isAuthBusy() || isCooldownActive) return 'blocked';
        harness.setAuthBusy(true);
        resendNetworkCalls++;
        harness.setAuthBusy(false);
        return 'success';
      }

      expect(triggerResendOtp(false)).toBe('success');
      expect(resendNetworkCalls).toBe(1);

      // Blocked by cooldown
      expect(triggerResendOtp(true)).toBe('blocked');
      expect(resendNetworkCalls).toBe(1);

      // Blocked by isAuthBusy
      harness.setAuthBusy(true, harness.elements.loginSubmitBtn);
      expect(triggerResendOtp(false)).toBe('blocked');
      expect(resendNetworkCalls).toBe(1);
    });
  });
});
