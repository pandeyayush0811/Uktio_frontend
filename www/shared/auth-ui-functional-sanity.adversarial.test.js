// Role: 10_FunctionalSanityTester & 06_TestWriter
// Target: Authentication & Registration UI / Real-World Usability
// Issues Tested: AUD-033, DES-002, DES-003, DES-004, DES-005, DES-011, DES-013

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Functional Sanity & Real-World UI Tests — Auth & Login (login.html & style.css)', () => {
  const loginHtmlPath = path.resolve(__dirname, '../login.html');
  const styleCssPath = path.resolve(__dirname, 'style.css');
  const authJsPath = path.resolve(__dirname, 'auth.js');

  let loginHtmlContent = '';
  let styleCssContent = '';
  let authJsContent = '';

  beforeEach(() => {
    loginHtmlContent = fs.readFileSync(loginHtmlPath, 'utf8');
    styleCssContent = fs.readFileSync(styleCssPath, 'utf8');
    authJsContent = fs.readFileSync(authJsPath, 'utf8');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. AUD-033: Active Submit Button vs Google Button Spinner State
  // ─────────────────────────────────────────────────────────────────────────
  describe('AUD-033: Form Submissions Active Loading State vs Google Button Spinner', () => {
    it('test_setAuthBusy_does_not_unconditionally_spin_google_button', () => {
      // Real-World Issue: When user submits email/password login, Google button starts spinning,
      // creating massive confusion that Google login was triggered while Log In button looks frozen.
      const setAuthBusyMatch = loginHtmlContent.match(/function\s+setAuthBusy\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(setAuthBusyMatch, 'setAuthBusy function must exist in login.html').toBeTruthy();

      const functionBody = setAuthBusyMatch[1];
      // MUST NOT unconditionally toggle .btn-loading on googleBtn
      expect(functionBody).not.toMatch(/getElementById\(['"]googleBtn['"]\)\.classList\.toggle\(['"]btn-loading['"],\s*busy\)/);
    });

    it('test_login_form_submit_activates_loading_on_login_submit_button', () => {
      // When submitting #loginForm, the loading spinner must target #loginSubmitBtn
      expect(loginHtmlContent).toMatch(/setAuthBusy\s*\(\s*true\s*,\s*document\.getElementById\(['"]loginSubmitBtn['"]\)/);
    });

    it('test_signup_forms_activate_loading_on_respective_submit_buttons', () => {
      expect(loginHtmlContent).toMatch(/setAuthBusy\s*\(\s*true\s*,\s*document\.getElementById\(['"]signupStartSubmitBtn['"]\)/);
      expect(loginHtmlContent).toMatch(/setAuthBusy\s*\(\s*true\s*,\s*document\.getElementById\(['"]signupVerifySubmitBtn['"]\)/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. DES-002: Screen Switching Motion & Transition Class
  // ─────────────────────────────────────────────────────────────────────────
  describe('DES-002: Screen Switching Transitions (Login ↔ Signup ↔ Forgot Password)', () => {
    it('test_showScreen_triggers_entrance_animation_class', () => {
      // Real-World Issue: Instant DOM display toggle feels like a harsh glitch rather than a native mobile app.
      const showScreenMatch = loginHtmlContent.match(/function\s+showScreen\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(showScreenMatch).toBeTruthy();

      const body = showScreenMatch[1];
      expect(body).toMatch(/classList\.add\(['"]auth-card-enter['"]\)|auth-card-in|stepFadeIn/);
    });

    it('test_style_css_defines_auth_card_enter_keyframes', () => {
      expect(styleCssContent).toMatch(/@keyframes\s+(authCardIn|authCardEnter)/);
      expect(styleCssContent).toMatch(/\.auth-card-enter|\.auth-card\.enter/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. DES-003: 6-Digit OTP Field Formatting & Tabular Spacing
  // ─────────────────────────────────────────────────────────────────────────
  describe('DES-003: 6-Digit OTP Field Readability & Touch Polish', () => {
    it('test_signup_and_forgot_otp_inputs_have_dedicated_otp_styling_class', () => {
      // Real-World Issue: Cramped 0.95rem generic inputs make typing and verifying OTP numbers error-prone on mobile.
      expect(loginHtmlContent).toMatch(/<input[^>]*id=["']signupOtp["'][^>]*class=["'][^"']*auth-otp-input[^"']*["']/);
      expect(loginHtmlContent).toMatch(/<input[^>]*id=["']forgotOtp["'][^>]*class=["'][^"']*auth-otp-input[^"']*["']/);
    });

    it('test_style_css_defines_auth_otp_input_with_spaced_tabular_figures', () => {
      const otpRuleMatch = styleCssContent.match(/\.auth-otp-input\s*\{([^}]+)\}/);
      expect(otpRuleMatch, '.auth-otp-input rule must exist in style.css').toBeTruthy();

      const rule = otpRuleMatch[1];
      expect(rule).toMatch(/letter-spacing\s*:\s*(?:0\.[3-6]em|[1-2]rem)/i);
      expect(rule).toMatch(/text-align\s*:\s*center/i);
      expect(rule).toMatch(/font-size\s*:\s*(?:1\.[2-8]rem|2[0-4]px)/i);
      expect(rule).toMatch(/font-variant-numeric\s*:\s*tabular-nums/i);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. DES-004: Touch Target Bounds on Text Links & Consent Checkbox
  // ─────────────────────────────────────────────────────────────────────────
  describe('DES-004: Minimum Touch Target Bounds for Mobile Thumbs', () => {
    it('test_auth_footer_text_links_have_minimum_touch_height', () => {
      // Real-World Issue: Under 18px tap targets lead to frequent accidental mis-taps on mobile touchscreens.
      const textLinkMatch = styleCssContent.match(/\.auth-footer-links\s+\.text-link\s*\{([^}]+)\}/);
      expect(textLinkMatch, '.auth-footer-links .text-link rule must exist').toBeTruthy();

      const rule = textLinkMatch[1];
      expect(rule).toMatch(/padding\s*:\s*([4-9]|1[0-2])px/i);
      expect(rule).toMatch(/min-height\s*:\s*(?:3[6-9]|4[0-8])px/i);
      expect(rule).toMatch(/display\s*:\s*inline-flex/i);
    });

    it('test_auth_consent_label_has_comfortable_tap_padding', () => {
      const consentMatch = styleCssContent.match(/\.auth-consent\s*\{([^}]+)\}/);
      expect(consentMatch).toBeTruthy();
      expect(styleCssContent).toMatch(/\.auth-consent\s+label/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. DES-005: Button Border-Radius Consistency Across Auth & Onboarding
  // ─────────────────────────────────────────────────────────────────────────
  describe('DES-005: Button Geometry Consistency (12px Radius)', () => {
    it('test_auth_card_buttons_use_12px_radius_instead_of_999px_pill', () => {
      // Real-World Issue: Login buttons are 999px capsules while Onboarding buttons are 12px rectangles,
      // creating an amateurish visual clash.
      const authPrimaryBtn = styleCssContent.match(/\.auth-card\s+button\.primary\s*\{([^}]+)\}/);
      if (authPrimaryBtn) {
        expect(authPrimaryBtn[1]).not.toMatch(/border-radius\s*:\s*999px/);
        expect(authPrimaryBtn[1]).toMatch(/border-radius\s*:\s*(?:1[0-4]px|var\(--radius-button\)|var\(--radius-md\))/);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. DES-011: Form Validation Layout Shifts & Input Shake
  // ─────────────────────────────────────────────────────────────────────────
  describe('DES-011: Validation Error Layout Jump Prevention', () => {
    it('test_style_css_defines_input_shake_animation_for_invalid_submissions', () => {
      expect(styleCssContent).toMatch(/@keyframes\s+inputShake/);
      expect(styleCssContent).toMatch(/\.input-shake|\.is-invalid/);
    });

    it('test_status_msg_has_smooth_fade_transition', () => {
      const statusRule = styleCssContent.match(/\.status-msg\s*\{([^}]+)\}/);
      expect(statusRule).toBeTruthy();
      expect(statusRule[1]).toMatch(/transition\s*:\s*[^;]*opacity/i);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7. DES-013: Consumer-Facing Micro-Copy & Elimination of Developer Jargon
  // ─────────────────────────────────────────────────────────────────────────
  describe('DES-013: Consumer-Grade Copy and Zero Developer Jargon', () => {
    it('test_login_html_contains_no_raw_developer_build_notes', () => {
      // Real-World Issue: Error messages with developer instructions ("see setup notes") confuse real users.
      expect(loginHtmlContent).not.toMatch(/see setup notes/i);
      expect(loginHtmlContent).not.toMatch(/plugin not set up yet in this build/i);
    });

    it('test_auth_status_messages_avoid_developer_variable_names', () => {
      expect(loginHtmlContent).not.toMatch(/idToken/);
      expect(loginHtmlContent).not.toMatch(/raw payload/i);
    });
  });
});
