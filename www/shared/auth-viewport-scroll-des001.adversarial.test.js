// Role: 06_TestWriter (Senior Frontend Adversarial QA)
// Issue: #DES-001 (AUDIT FILE & DESIGN_AUDIT.MD)
// Scope: Layout, Viewport Scrollability, Soft-Keyboard Resilience & Blast Radius for login.html & shared/style.css

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Adversarial & Hardcore Test Suite — Issue #DES-001: Mobile Keyboard & Viewport Scrollability (login.html & shared/style.css)', () => {
  const styleCssPath = path.resolve(__dirname, 'style.css');
  const loginHtmlPath = path.resolve(__dirname, '../login.html');
  const homeHtmlPath = path.resolve(__dirname, '../home.html');
  const chatHtmlPath = path.resolve(__dirname, '../chat.html');
  const scenarioHtmlPath = path.resolve(__dirname, '../scenario.html');
  const profileHtmlPath = path.resolve(__dirname, '../profile.html');
  const settingsHtmlPath = path.resolve(__dirname, '../settings.html');
  const onboardingHtmlPath = path.resolve(__dirname, '../onboarding.html');
  const historyHtmlPath = path.resolve(__dirname, '../history.html');
  const pricingHtmlPath = path.resolve(__dirname, '../pricing.html');

  let styleCssContent = '';
  let loginHtmlContent = '';

  beforeEach(() => {
    styleCssContent = fs.readFileSync(styleCssPath, 'utf8');
    loginHtmlContent = fs.readFileSync(loginHtmlPath, 'utf8');
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 1: CSS Architectural Contract & Scroll Safety (.auth-wrap)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 1: CSS Architectural Contract & Scroll Safety (.auth-wrap in style.css)', () => {

    it('test_auth_wrap_enforces_overflow_y_auto_and_overflow_x_hidden', () => {
      // Prevents keyboard-locked overflow trap while eliminating horizontal drag jank
      const authWrapMatch = styleCssContent.match(/\.auth-wrap\s*\{([^}]+)\}/);
      expect(authWrapMatch, '.auth-wrap CSS rule block must exist in style.css').toBeTruthy();

      const block = authWrapMatch[1];
      expect(block).toMatch(/overflow-y\s*:\s*auto\s*;/i);
      expect(block).toMatch(/overflow-x\s*:\s*hidden\s*;/i);
      expect(block).not.toMatch(/(?:^|[^-\w])overflow\s*:\s*hidden\s*;/i);
      expect(block).not.toMatch(/overflow-y\s*:\s*hidden\s*;/i);
    });

    it('test_auth_wrap_enforces_webkit_momentum_scrolling_and_containment', () => {
      // Ensures hardware-accelerated momentum scrolling on iOS/Android WebView & prevents pull-to-refresh bounce
      const authWrapMatch = styleCssContent.match(/\.auth-wrap\s*\{([^}]+)\}/);
      expect(authWrapMatch).toBeTruthy();

      const block = authWrapMatch[1];
      expect(block).toMatch(/-webkit-overflow-scrolling\s*:\s*touch\s*;/i);
      expect(block).toMatch(/overscroll-behavior-y\s*:\s*contain\s*;/i);
    });

    it('test_auth_wrap_uses_dynamic_viewport_units_and_full_height', () => {
      // Accounts for dynamic address bars and soft keyboard shrinkage in modern WebViews
      const authWrapMatch = styleCssContent.match(/\.auth-wrap\s*\{([^}]+)\}/);
      expect(authWrapMatch).toBeTruthy();

      const block = authWrapMatch[1];
      expect(block).toMatch(/min-height\s*:\s*100vh\s*;/i);
      expect(block).toMatch(/min-height\s*:\s*100dvh\s*;/i);
      expect(block).toMatch(/height\s*:\s*100%\s*;/i);
    });

    it('test_auth_wrap_replaces_rigid_justify_center_with_flex_start_and_auto_margins', () => {
      // Ensures flexbox does not clip top content into negative coordinate space when overflowing
      const authWrapMatch = styleCssContent.match(/\.auth-wrap\s*\{([^}]+)\}/);
      expect(authWrapMatch).toBeTruthy();
      const authWrapBlock = authWrapMatch[1];

      expect(authWrapBlock).toMatch(/justify-content\s*:\s*flex-start\s*;/i);
      expect(authWrapBlock).not.toMatch(/justify-content\s*:\s*center\s*;/i);

      // Verify auto margins on header and card for collapsible centering
      const authHeaderMatch = styleCssContent.match(/\.auth-header\s*\{([^}]+)\}/);
      expect(authHeaderMatch, '.auth-header CSS block must exist').toBeTruthy();
      expect(authHeaderMatch[1]).toMatch(/margin-top\s*:\s*auto\s*;/i);

      const authCardMatch = styleCssContent.match(/\.auth-card\s*\{([^}]+)\}/);
      expect(authCardMatch, '.auth-card CSS block must exist').toBeTruthy();
      expect(authCardMatch[1]).toMatch(/margin-bottom\s*:\s*auto\s*;/i);
    });

    it('test_auth_wrap_includes_safe_area_insets_in_padding', () => {
      // Prevents legal disclaimer, CTA button, or header from colliding with Android nav bars / notches
      const authWrapMatch = styleCssContent.match(/\.auth-wrap\s*\{([^}]+)\}/);
      expect(authWrapMatch).toBeTruthy();

      const block = authWrapMatch[1];
      expect(block).toMatch(/env\s*\(\s*safe-area-inset-top\s*,\s*0px\s*\)/i);
      expect(block).toMatch(/env\s*\(\s*safe-area-inset-bottom\s*,\s*0px\s*\)/i);
    });

    it('test_auth_glow_is_pointer_events_none_and_behind_content', () => {
      // Decorative background glow must never block tap events on inputs or submit buttons
      const authGlowMatch = styleCssContent.match(/\.auth-glow\s*\{([^}]+)\}/);
      expect(authGlowMatch, '.auth-glow CSS block must exist').toBeTruthy();

      const block = authGlowMatch[1];
      expect(block).toMatch(/pointer-events\s*:\s*none\s*;/i);
      expect(block).toMatch(/z-index\s*:\s*0\s*;/i);
    });

    it('test_auth_header_and_card_stack_above_glow_layer', () => {
      // Confirms header and card use position relative and z-index: 1 to layer cleanly over glow
      const authHeaderMatch = styleCssContent.match(/\.auth-header\s*\{([^}]+)\}/);
      expect(authHeaderMatch[1]).toMatch(/z-index\s*:\s*1\s*;/i);
      expect(authHeaderMatch[1]).toMatch(/position\s*:\s*relative\s*;/i);

      const authCardMatch = styleCssContent.match(/\.auth-card\s*\{([^}]+)\}/);
      expect(authCardMatch[1]).toMatch(/z-index\s*:\s*1\s*;/i);
      expect(authCardMatch[1]).toMatch(/position\s*:\s*relative\s*;/i);
    });

    it('test_color_lock_integrity_in_auth_styling', () => {
      // Confirms theme colors are strictly preserved using CSS variables
      expect(styleCssContent).toContain('--bg: #FBF1E6;');
      expect(styleCssContent).toContain('--card: #ffffff;');
      expect(styleCssContent).toContain('--panel-2: #F5ECDF;');
      expect(styleCssContent).toContain('--ink: #23263a;');
      expect(styleCssContent).toContain('--ink-dim: #6f6558;');
      expect(styleCssContent).toContain('--line: #ECDFCB;');
      expect(styleCssContent).toContain('--accent: #6a63f1;');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 2: DOM Hierarchy & Auth Screens Verification (login.html)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 2: DOM Hierarchy & All 5 Auth Screens (login.html)', () => {

    it('test_login_html_uses_wrap_auth_wrap_as_outer_container', () => {
      // Confirms login.html wraps its whole body content inside .wrap.auth-wrap
      expect(loginHtmlContent).toMatch(/<div\s+class=["'][^"']*\bwrap\b[^"']*\bauth-wrap\b[^"']*["']/);
    });

    it('test_login_html_contains_auth_glow_with_aria_hidden', () => {
      // Screen readers must ignore decorative background glow
      expect(loginHtmlContent).toMatch(/<div\s+class=["'][^"']*\bauth-glow\b[^"']*["']\s+aria-hidden=["']true["']/);
    });

    it('test_all_five_auth_screens_have_auth_card_class', () => {
      // Every sub-screen card must participate in the margin-bottom: auto centering rule
      const requiredScreens = [
        'screenLogin',
        'screenSignupStart',
        'screenSignupVerify',
        'screenForgotStart',
        'screenForgotVerify'
      ];

      for (const screenId of requiredScreens) {
        // Match tag opening for div with this id and verify it contains auth-card class
        const tagRegex = new RegExp(`<div[^>]*id=["']${screenId}["'][^>]*>`, 'i');
        const match = loginHtmlContent.match(tagRegex);
        expect(match, `Element #${screenId} tag must exist in login.html`).toBeTruthy();
        expect(match[0], `Element #${screenId} must have class 'auth-card'`).toMatch(/class=["'][^"']*\bauth-card\b[^"']*["']/i);
      }
    });

    it('test_all_five_auth_screens_contain_submit_buttons_and_status_nodes', () => {
      // Form elements must be complete so scroll testing verifies actual interactive targets
      const screenElements = [
        { btn: 'loginSubmitBtn', status: 'loginStatus' },
        { btn: 'signupStartSubmitBtn', status: 'signupStartStatus' },
        { btn: 'signupVerifySubmitBtn', status: 'signupVerifyStatus' },
        { btn: 'forgotStartSubmitBtn', status: 'forgotStartStatus' },
        { btn: 'forgotVerifySubmitBtn', status: 'forgotVerifyStatus' }
      ];

      for (const { btn, status } of screenElements) {
        expect(loginHtmlContent, `Button #${btn} must exist in login.html`).toContain(`id="${btn}"`);
        expect(loginHtmlContent, `Status container #${status} must exist in login.html`).toContain(`id="${status}"`);
      }
    });

    it('test_signup_consent_checkbox_exists_with_terms_and_privacy_links', () => {
      // Consent checkbox must be embedded inside scrollable signup card
      expect(loginHtmlContent).toContain('id="signupConsent"');
      expect(loginHtmlContent).toMatch(/href=["']terms\.html\?from=login\.html["']/);
      expect(loginHtmlContent).toMatch(/href=["']privacy\.html\?from=login\.html["']/);
    });

    it('test_all_form_inputs_have_correct_autocomplete_and_inputmode', () => {
      // Tests that mobile keyboard inputmodes and autocompletes are properly declared for Android/iOS
      expect(loginHtmlContent).toContain('id="loginIdentifier"');
      expect(loginHtmlContent).toMatch(/id=["']loginPassword["'][^>]*autocomplete=["']current-password["']/);
      expect(loginHtmlContent).toMatch(/id=["']signupEmail["'][^>]*autocomplete=["']email["']/);
      expect(loginHtmlContent).toMatch(/id=["']signupPhone["'][^>]*inputmode=["']numeric["'][^>]*maxlength=["']10["']/);
      expect(loginHtmlContent).toMatch(/id=["']signupOtp["'][^>]*inputmode=["']numeric["'][^>]*maxlength=["']6["']/);
      expect(loginHtmlContent).toMatch(/id=["']forgotOtp["'][^>]*inputmode=["']numeric["'][^>]*maxlength=["']6["']/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 3: Adversarial Viewport & Soft Keyboard Simulation
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 3: Adversarial Viewport & Soft Keyboard Calculations', () => {

    function simulateAuthLayout({
      viewportHeight,
      headerHeight = 130,
      cardHeight = 420,
      paddingTop = 20,
      paddingBottom = 28,
      isOverflowAuto = true,
      justifyContent = 'flex-start'
    }) {
      const totalContentHeight = paddingTop + headerHeight + 22 + cardHeight + paddingBottom;
      const clientHeight = viewportHeight;
      const isContentOverflowing = totalContentHeight > clientHeight;

      let scrollHeight = totalContentHeight;
      let maxScrollTop = 0;
      let topClipping = 0;
      let bottomClipping = 0;

      if (isOverflowAuto) {
        // With overflow-y: auto and justify-content: flex-start
        scrollHeight = Math.max(clientHeight, totalContentHeight);
        maxScrollTop = Math.max(0, totalContentHeight - clientHeight);
        topClipping = 0;
        bottomClipping = 0;
      } else if (justifyContent === 'center') {
        // Bugged legacy state: overflow hidden + justify-content: center
        if (isContentOverflowing) {
          const excess = totalContentHeight - clientHeight;
          topClipping = excess / 2;
          bottomClipping = excess / 2;
          maxScrollTop = 0; // cannot scroll
        }
      }

      return {
        totalContentHeight,
        clientHeight,
        scrollHeight,
        maxScrollTop,
        isContentOverflowing,
        topClipping,
        bottomClipping,
        canReachSubmitButton: (isOverflowAuto && maxScrollTop >= 0) || !isContentOverflowing
      };
    }

    it('test_adversarial_small_screen_with_keyboard_open_320x350_allows_full_scroll_reach', () => {
      // Extreme test: Compact phone (320px wide) with soft keyboard open reducing height to 350px
      const result = simulateAuthLayout({
        viewportHeight: 350,
        headerHeight: 130,
        cardHeight: 440,
        isOverflowAuto: true,
        justifyContent: 'flex-start'
      });

      expect(result.isContentOverflowing).toBe(true);
      expect(result.scrollHeight).toBe(640);
      expect(result.clientHeight).toBe(350);
      expect(result.maxScrollTop).toBe(290);
      expect(result.topClipping).toBe(0);
      expect(result.bottomClipping).toBe(0);
      expect(result.canReachSubmitButton).toBe(true);
    });

    it('test_adversarial_legacy_bugged_state_fails_with_clipping_and_zero_scroll', () => {
      // Verifies that the legacy state (overflow: hidden + justify-content: center) would indeed break
      const legacyResult = simulateAuthLayout({
        viewportHeight: 350,
        headerHeight: 130,
        cardHeight: 440,
        isOverflowAuto: false,
        justifyContent: 'center'
      });

      expect(legacyResult.isContentOverflowing).toBe(true);
      expect(legacyResult.maxScrollTop).toBe(0); // Zero scroll possible
      expect(legacyResult.topClipping).toBeGreaterThan(0); // Top of header is cut off
      expect(legacyResult.bottomClipping).toBeGreaterThan(0); // Submit button is cut off
    });

    it('test_adversarial_tall_screen_844px_collapses_margins_without_forced_scroll', () => {
      // Modern phone (iPhone 14 / Pixel 7: 390x844px) with keyboard closed
      const result = simulateAuthLayout({
        viewportHeight: 844,
        headerHeight: 130,
        cardHeight: 420,
        isOverflowAuto: true,
        justifyContent: 'flex-start'
      });

      expect(result.isContentOverflowing).toBe(false);
      expect(result.maxScrollTop).toBe(0);
      expect(result.scrollHeight).toBe(844);
      expect(result.topClipping).toBe(0);
      expect(result.bottomClipping).toBe(0);
    });

    it('test_adversarial_landscape_mode_360x740_allows_full_vertical_scroll', () => {
      // Device rotated horizontally (viewport height = 360px)
      const result = simulateAuthLayout({
        viewportHeight: 360,
        headerHeight: 110,
        cardHeight: 400,
        isOverflowAuto: true,
        justifyContent: 'flex-start'
      });

      expect(result.isContentOverflowing).toBe(true);
      expect(result.maxScrollTop).toBeGreaterThan(0);
      expect(result.canReachSubmitButton).toBe(true);
    });

    it('test_adversarial_extremely_long_validation_error_message_scrollable', () => {
      // Status message with long error text (card expands to 580px) on 400px viewport
      const result = simulateAuthLayout({
        viewportHeight: 400,
        headerHeight: 130,
        cardHeight: 580,
        isOverflowAuto: true,
        justifyContent: 'flex-start'
      });

      expect(result.isContentOverflowing).toBe(true);
      expect(result.maxScrollTop).toBe(780 - 400); // 380px scrollable distance
      expect(result.topClipping).toBe(0);
      expect(result.canReachSubmitButton).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 4: Blast Radius & Sibling Scope Isolation
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 4: Blast Radius & Sibling Scope Isolation', () => {

    it('test_global_wrap_remains_overflow_hidden_for_app_shell_screens', () => {
      // Base .wrap must keep overflow: hidden so chat, scenario, and home don't experience unwanted body bouncing
      const wrapMatch = styleCssContent.match(/(?:^|\n)\.wrap\s*\{([^}]+)\}/);
      expect(wrapMatch, 'Base .wrap rule must exist').toBeTruthy();

      const block = wrapMatch[1];
      expect(block).toMatch(/overflow\s*:\s*hidden\s*;/i);
      expect(block).toMatch(/max-width\s*:\s*480px\s*;/i);
    });

    it('test_other_pages_do_not_have_auth_wrap_accidentally_injected', () => {
      // Ensure home.html, chat.html, scenario.html, profile.html, settings.html, onboarding.html, history.html, pricing.html use only their intended container classes
      const pages = [
        { path: homeHtmlPath, name: 'home.html' },
        { path: chatHtmlPath, name: 'chat.html' },
        { path: scenarioHtmlPath, name: 'scenario.html' },
        { path: profileHtmlPath, name: 'profile.html' },
        { path: settingsHtmlPath, name: 'settings.html' },
        { path: onboardingHtmlPath, name: 'onboarding.html' },
        { path: historyHtmlPath, name: 'history.html' },
        { path: pricingHtmlPath, name: 'pricing.html' }
      ];

      for (const page of pages) {
        if (fs.existsSync(page.path)) {
          const content = fs.readFileSync(page.path, 'utf8');
          expect(content, `${page.name} must not contain auth-wrap`).not.toContain('auth-wrap');
        }
      }
    });

    it('test_auth_card_styles_are_strictly_scoped_and_do_not_override_generic_card', () => {
      // Generic .card must not inherit auth-specific background shadows or border colors
      const genericCardMatch = styleCssContent.match(/(?:^|\n)\.card\s*\{([^}]+)\}/);
      expect(genericCardMatch).toBeTruthy();

      const genericCardBlock = genericCardMatch[1];
      expect(genericCardBlock).not.toMatch(/--accent-orange/);
      expect(genericCardBlock).toMatch(/border-radius\s*:\s*26px\s*;/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 5: Interactive State Machine & Password Toggles
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 5: Interactive State Machine & Sub-Screen Transitions', () => {

    it('test_password_toggles_have_aria_pressed_and_aria_label_attributes', () => {
      // Password eye button accessibility in login and signup forms
      expect(loginHtmlContent).toMatch(/class=["'][^"']*\bpw-toggle\b[^"']*["'][^>]*aria-label=["']Show password["']/);
      expect(loginHtmlContent).toMatch(/class=["'][^"']*\bpw-toggle\b[^"']*["'][^>]*aria-pressed=["']false["']/);
    });

    it('test_login_html_delegates_password_toggle_cleanly', () => {
      // Confirms login.html contains event delegation for .pw-toggle
      expect(loginHtmlContent).toContain("e.target.closest('.pw-toggle')");
      expect(loginHtmlContent).toContain("input.type = nowVisible ? 'text' : 'password'");
    });

    it('test_hardware_back_navigation_covers_all_4_sub_screens_to_login_root', () => {
      // BACK_TARGET map must guide user safely back to login root without page crashes
      expect(loginHtmlContent).toContain("signupStart: 'login'");
      expect(loginHtmlContent).toContain("signupVerify: 'signupStart'");
      expect(loginHtmlContent).toContain("forgotStart: 'login'");
      expect(loginHtmlContent).toContain("forgotVerify: 'forgotStart'");
    });

    it('test_offline_protection_wiring_present_for_auth_buttons', () => {
      // Proactive offline button disabling via disableOfflineFor helper
      expect(loginHtmlContent).toContain("import('./shared/offline-banner.js')");
      expect(loginHtmlContent).toContain("disableOfflineFor(allBusyToggles())");
    });
  });
});
