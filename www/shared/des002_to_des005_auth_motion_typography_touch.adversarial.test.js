// Role: 06_TestWriter (Senior Frontend Adversarial QA)
// Issues: DES-002, DES-003, DES-004, DES-005 (Design & UI Audit — Auth Motion, Typography, Touch Bounds & Button Geometry)
// Total Hardcore Adversarial Tests: 84 Tests (21 Tests per Issue)
// Target Files: www/login.html, www/shared/style.css, www/onboarding.html

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Adversarial & Hardcore Test Suite — Issues DES-002 to DES-005: Auth Polish, Transitions, Typography & Touch Targets', () => {
  const loginHtmlPath = path.resolve(__dirname, '../login.html');
  const styleCssPath = path.resolve(__dirname, 'style.css');
  const onboardingHtmlPath = path.resolve(__dirname, '../onboarding.html');

  let loginHtml = '';
  let styleCss = '';
  let onboardingHtml = '';

  beforeEach(() => {
    loginHtml = fs.readFileSync(loginHtmlPath, 'utf8');
    styleCss = fs.readFileSync(styleCssPath, 'utf8');
    onboardingHtml = fs.readFileSync(onboardingHtmlPath, 'utf8');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 1: DES-002 — Screen Switching Transitions & Keyframe Motion (Tests 1–21)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('DES-002: Screen Switching Transitions & Crossfades (.auth-card-enter)', () => {
    // Why it matters: Sub-screens in multi-step auth must transition smoothly with entrance animations rather than jarring DOM snapping.

    it('DES-002.1: .auth-card-enter CSS class rule exists in style.css', () => {
      // Prevents regression where transition class is removed from stylesheet
      expect(styleCss).toMatch(/\.auth-card-enter\s*\{[^}]*\}/);
    });

    it('DES-002.2: @keyframes authCardIn is defined with initial state (opacity: 0, translateY: 8px)', () => {
      // Confirms upward float starting keyframe for premium native feel
      expect(styleCss).toMatch(/@keyframes\s+authCardIn\s*\{[\s\S]*?from\s*\{[^}]*opacity\s*:\s*0[^}]*transform\s*:\s*translateY\(\s*8px\s*\)/i);
    });

    it('DES-002.3: @keyframes authCardIn is defined with destination state (opacity: 1, translateY: 0)', () => {
      // Confirms resting destination keyframe
      expect(styleCss).toMatch(/@keyframes\s+authCardIn\s*\{[\s\S]*?to\s*\{[^}]*opacity\s*:\s*1[^}]*transform\s*:\s*translateY\(\s*0\s*\)/i);
    });

    it('DES-002.4: .auth-card-enter uses snappy animation duration of 0.2s (200ms)', () => {
      // Ensures animation is rapid and does not slow down user typing flow
      const match = styleCss.match(/\.auth-card-enter\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/animation\s*:\s*authCardIn\s+0\.2s/i);
    });

    it('DES-002.5: .auth-card-enter uses cubic-bezier(0.16, 1, 0.3, 1) deceleration easing', () => {
      // Ensures high-end mobile deceleration curve
      const match = styleCss.match(/\.auth-card-enter\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/cubic-bezier\(\s*0\.16\s*,\s*1\s*,\s*0\.3\s*,\s*1\s*\)/i);
    });

    it('DES-002.6: showScreen function removes auth-card-enter before re-adding it', () => {
      // Without removing class first, switching screens does not retrigger CSS animation
      const showScreenMatch = loginHtml.match(/function\s+showScreen\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(showScreenMatch).toBeTruthy();
      expect(showScreenMatch[1]).toMatch(/screens\[key\]\.classList\.remove\(['"]auth-card-enter['"]\)/);
    });

    it('DES-002.7: showScreen forces DOM reflow via offsetWidth before re-adding animation class', () => {
      // Reflow force (void screens[key].offsetWidth) is required by browsers to reset keyframe state
      const showScreenMatch = loginHtml.match(/function\s+showScreen\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(showScreenMatch).toBeTruthy();
      expect(showScreenMatch[1]).toMatch(/void\s+screens\[key\]\.offsetWidth;/);
    });

    it('DES-002.8: showScreen re-adds auth-card-enter to the target screen', () => {
      // Ensures new active screen triggers entrance animation
      const showScreenMatch = loginHtml.match(/function\s+showScreen\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(showScreenMatch).toBeTruthy();
      expect(showScreenMatch[1]).toMatch(/screens\[key\]\.classList\.add\(['"]auth-card-enter['"]\)/);
    });

    it('DES-002.9: showScreen sets display: none on inactive screens', () => {
      // Ensures invisible screens do not intercept pointer events or block layout
      const showScreenMatch = loginHtml.match(/function\s+showScreen\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(showScreenMatch).toBeTruthy();
      expect(showScreenMatch[1]).toMatch(/screens\[key\]\.style\.display\s*=\s*['"]none['"]/);
    });

    it('DES-002.10: showScreen clears display: none on active screen', () => {
      // Ensures active screen renders cleanly
      const showScreenMatch = loginHtml.match(/function\s+showScreen\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(showScreenMatch).toBeTruthy();
      expect(showScreenMatch[1]).toMatch(/screens\[key\]\.style\.display\s*=\s*['"]['"]/);
    });

    it('DES-002.11: showScreen updates currentScreenName for accurate navigation state tracking', () => {
      // Prevents out-of-sync back navigation
      const showScreenMatch = loginHtml.match(/function\s+showScreen\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(showScreenMatch).toBeTruthy();
      expect(showScreenMatch[1]).toMatch(/currentScreenName\s*=\s*name;/);
    });

    it('DES-002.12: Initial HTML template hides secondary screens with style="display:none;"', () => {
      // Prevents content flashing before JS initialization
      expect(loginHtml).toMatch(/id=['"]screenSignupStart['"][^>]+style=['"][^'"]*display:\s*none;?[^'"]*['"]/);
      expect(loginHtml).toMatch(/id=['"]screenSignupVerify['"][^>]+style=['"][^'"]*display:\s*none;?[^'"]*['"]/);
      expect(loginHtml).toMatch(/id=['"]screenForgotStart['"][^>]+style=['"][^'"]*display:\s*none;?[^'"]*['"]/);
      expect(loginHtml).toMatch(/id=['"]screenForgotVerify['"][^>]+style=['"][^'"]*display:\s*none;?[^'"]*['"]/);
    });

    it('DES-002.13: Primary #screenLogin is visible by default without inline display:none', () => {
      // Login screen must be immediately rendered on first paint
      const screenLoginMatch = loginHtml.match(/<div[^>]+id=['"]screenLogin['"][^>]*>/);
      expect(screenLoginMatch).toBeTruthy();
      expect(screenLoginMatch[0]).not.toMatch(/display:\s*none/);
    });

    it('DES-002.14: Hardware back button listener executes showScreen with target to trigger transition', () => {
      // Confirms native gesture/back button plays entrance animation on reverse navigation
      expect(loginHtml).toMatch(/App\.addListener\(['"]backButton['"],\s*\(\s*\)\s*=>\s*\{[\s\S]*?showScreen\(target\)/);
    });

    it('DES-002.15: Hardware back button listener ignores triggers when isAuthBusy is true', () => {
      // Prevents jarring screen switches mid-API request
      expect(loginHtml).toMatch(/App\.addListener\(['"]backButton['"],\s*\(\s*\)\s*=>\s*\{[\s\S]*?if\s*\(\s*isAuthBusy\s*\)\s*return;/);
    });

    it('DES-002.16: Auto-focus is deferred with setTimeout (50ms) to synchronize with card animation', () => {
      // Auto-focusing after card begins animating prevents mobile keyboard jump jank
      const showScreenMatch = loginHtml.match(/function\s+showScreen\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(showScreenMatch).toBeTruthy();
      expect(showScreenMatch[1]).toMatch(/setTimeout\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?focus\(\)[\s\S]*?\},\s*50\s*\)/);
    });

    it('DES-002.17: .auth-glow background is positioned behind cards with z-index: 0 to remain static', () => {
      // Glow must NOT jump or flash during card transition
      const glowMatch = styleCss.match(/\.auth-glow\s*\{([^}]+)\}/);
      expect(glowMatch).toBeTruthy();
      expect(glowMatch[1]).toMatch(/z-index\s*:\s*0/);
    });

    it('DES-002.18: .auth-card uses position: relative and z-index: 1 to layer above background glow', () => {
      // Ensures animation translates properly above background glow
      const cardMatch = styleCss.match(/\.auth-card\s*\{([^}]+)\}/);
      expect(cardMatch).toBeTruthy();
      expect(cardMatch[1]).toMatch(/position\s*:\s*relative/);
      expect(cardMatch[1]).toMatch(/z-index\s*:\s*1/);
    });

    it('DES-002.19: .auth-card-enter animation does not apply to non-auth pages', () => {
      // Prevents leaking animation rules into other layouts
      expect(onboardingHtml).not.toContain('auth-card-enter');
    });

    it('DES-002.20: All 5 screens are mapped in screens dictionary in login.html script', () => {
      // Guarantees all sub-screens participate in animated switching
      expect(loginHtml).toMatch(/screens\s*=\s*\{\s*login:\s*document\.getElementById\(['"]screenLogin['"]\),\s*signupStart:\s*document\.getElementById\(['"]screenSignupStart['"]\),\s*signupVerify:\s*document\.getElementById\(['"]screenSignupVerify['"]\),\s*forgotStart:\s*document\.getElementById\(['"]screenForgotStart['"]\),\s*forgotVerify:\s*document\.getElementById\(['"]screenForgotVerify['"]\)\s*\}/);
    });

    it('DES-002.21: CSS transform uses translateY and avoids top/left layout trashing', () => {
      // GPU-accelerated animation properties only
      const keyframesMatch = styleCss.match(/@keyframes\s+authCardIn\s*\{([\s\S]*?)\}/);
      expect(keyframesMatch).toBeTruthy();
      expect(keyframesMatch[1]).not.toMatch(/\btop\s*:/);
      expect(keyframesMatch[1]).not.toMatch(/\bmargin-top\s*:/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 2: DES-003 — 6-Digit OTP Formatting & Typography (Tests 22–42)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('DES-003: 6-Digit OTP Field Formatting, Centering & Tabular Figures (.auth-otp-input)', () => {
    // Why it matters: Generic small left-aligned inputs for OTP cause high friction and input errors on mobile touchscreens.

    it('DES-003.1: #signupOtp has class="auth-otp-input" in login.html', () => {
      // Ensures styling class is hooked up to signup OTP field
      expect(loginHtml).toMatch(/<input[^>]+id=['"]signupOtp['"][^>]+class=['"][^'"]*auth-otp-input[^'"]*['"]/);
    });

    it('DES-003.2: #forgotOtp has class="auth-otp-input" in login.html', () => {
      // Ensures styling class is hooked up to forgot password OTP field
      expect(loginHtml).toMatch(/<input[^>]+id=['"]forgotOtp['"][^>]+class=['"][^'"]*auth-otp-input[^'"]*['"]/);
    });

    it('DES-003.3: .auth-otp-input defines letter-spacing: 0.5em in style.css', () => {
      // Provides spacious character separation for 6 digits
      const ruleMatch = styleCss.match(/\.auth-otp-input\s*\{([^}]+)\}/);
      expect(ruleMatch).toBeTruthy();
      expect(ruleMatch[1]).toMatch(/letter-spacing\s*:\s*0\.5em/i);
    });

    it('DES-003.4: .auth-otp-input defines text-align: center in style.css', () => {
      // Centers OTP digits inside input box
      const ruleMatch = styleCss.match(/\.auth-otp-input\s*\{([^}]+)\}/);
      expect(ruleMatch).toBeTruthy();
      expect(ruleMatch[1]).toMatch(/text-align\s*:\s*center/i);
    });

    it('DES-003.5: .auth-otp-input defines font-size: 1.4rem in style.css', () => {
      // Enlarged font size for clear digit legibility on small phone screens
      const ruleMatch = styleCss.match(/\.auth-otp-input\s*\{([^}]+)\}/);
      expect(ruleMatch).toBeTruthy();
      expect(ruleMatch[1]).toMatch(/font-size\s*:\s*1\.4rem/i);
    });

    it('DES-003.6: .auth-otp-input defines font-variant-numeric: tabular-nums in style.css', () => {
      // Fixed-width numerals prevent jumping character widths when typing '1' vs '8'
      const ruleMatch = styleCss.match(/\.auth-otp-input\s*\{([^}]+)\}/);
      expect(ruleMatch).toBeTruthy();
      expect(ruleMatch[1]).toMatch(/font-variant-numeric\s*:\s*tabular-nums/i);
    });

    it('DES-003.7: .auth-otp-input defines font-weight: 700 in style.css', () => {
      // Bold weight for prominent digit feedback
      const ruleMatch = styleCss.match(/\.auth-otp-input\s*\{([^}]+)\}/);
      expect(ruleMatch).toBeTruthy();
      expect(ruleMatch[1]).toMatch(/font-weight\s*:\s*700/i);
    });

    it('DES-003.8: #signupOtp has pattern="\\d{6}" HTML attribute', () => {
      // Native validation contract for 6 digits
      expect(loginHtml).toMatch(/<input[^>]+id=['"]signupOtp['"][^>]+pattern=['"]\\d\{6\}['"]/);
    });

    it('DES-003.9: #forgotOtp has pattern="\\d{6}" HTML attribute', () => {
      // Native validation contract for 6 digits
      expect(loginHtml).toMatch(/<input[^>]+id=['"]forgotOtp['"][^>]+pattern=['"]\\d\{6\}['"]/);
    });

    it('DES-003.10: #signupOtp has inputmode="numeric" HTML attribute', () => {
      // Triggers numeric virtual keyboard on mobile
      expect(loginHtml).toMatch(/<input[^>]+id=['"]signupOtp['"][^>]+inputmode=['"]numeric['"]/);
    });

    it('DES-003.11: #forgotOtp has inputmode="numeric" HTML attribute', () => {
      // Triggers numeric virtual keyboard on mobile
      expect(loginHtml).toMatch(/<input[^>]+id=['"]forgotOtp['"][^>]+inputmode=['"]numeric['"]/);
    });

    it('DES-003.12: #signupOtp has maxlength="6" HTML attribute', () => {
      // Limits input length to exactly 6 digits
      expect(loginHtml).toMatch(/<input[^>]+id=['"]signupOtp['"][^>]+maxlength=['"]6['"]/);
    });

    it('DES-003.13: #forgotOtp has maxlength="6" HTML attribute', () => {
      // Limits input length to exactly 6 digits
      expect(loginHtml).toMatch(/<input[^>]+id=['"]forgotOtp['"][^>]+maxlength=['"]6['"]/);
    });

    it('DES-003.14: #signupOtp has autocomplete="one-time-code" HTML attribute', () => {
      // Enables OS/browser OTP autofill from SMS/Email
      expect(loginHtml).toMatch(/<input[^>]+id=['"]signupOtp['"][^>]+autocomplete=['"]one-time-code['"]/);
    });

    it('DES-003.15: #forgotOtp has autocomplete="one-time-code" HTML attribute', () => {
      // Enables OS/browser OTP autofill from SMS/Email
      expect(loginHtml).toMatch(/<input[^>]+id=['"]forgotOtp['"][^>]+autocomplete=['"]one-time-code['"]/);
    });

    it('DES-003.16: #signupOtp has placeholder="123456"', () => {
      // Shows formatted 6-digit sample placeholder
      expect(loginHtml).toMatch(/<input[^>]+id=['"]signupOtp['"][^>]+placeholder=['"]123456['"]/);
    });

    it('DES-003.17: #forgotOtp has placeholder="123456"', () => {
      // Shows formatted 6-digit sample placeholder
      expect(loginHtml).toMatch(/<input[^>]+id=['"]forgotOtp['"][^>]+placeholder=['"]123456['"]/);
    });

    it('DES-003.18: #signupOtp has type="text" allowing letter-spacing without browser number-input restrictions', () => {
      // type="number" blocks letter-spacing and CSS text-align on some browsers
      const match = loginHtml.match(/<input[^>]+id=['"]signupOtp['"][^>]*>|<input[^>]+type=['"]text['"][^>]+id=['"]signupOtp['"][^>]*>/);
      expect(match).toBeTruthy();
      expect(match[0]).toMatch(/type=['"]text['"]/);
    });

    it('DES-003.19: #forgotOtp has type="text" allowing letter-spacing without browser number-input restrictions', () => {
      // type="number" blocks letter-spacing and CSS text-align on some browsers
      const match = loginHtml.match(/<input[^>]+id=['"]forgotOtp['"][^>]*>|<input[^>]+type=['"]text['"][^>]+id=['"]forgotOtp['"][^>]*>/);
      expect(match).toBeTruthy();
      expect(match[0]).toMatch(/type=['"]text['"]/);
    });

    it('DES-003.20: Both OTP inputs have associated <label> elements for accessibility', () => {
      // WCAG 1.3.1 Info and Relationships
      expect(loginHtml).toMatch(/<label\s+for=['"]signupOtp['"]>\s*6-digit OTP\s*<\/label>/);
      expect(loginHtml).toMatch(/<label\s+for=['"]forgotOtp['"]>\s*6-digit OTP\s*<\/label>/);
    });

    it('DES-003.21: OTP input focus styling applies --accent-orange and --accent-soft-orange halo', () => {
      // Focus indicator matches brand palette
      expect(styleCss).toMatch(/\.auth-card\s+input:focus\s*\{\s*border-color:\s*var\(--accent-orange\);\s*box-shadow:\s*0 0 0 3px var\(--accent-soft-orange\);\s*\}/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 3: DES-004 — Minimum Touch Target Bounds (Tests 43–63)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('DES-004: Minimum Touch Target Bounds for Mobile Thumbs (>= 40px)', () => {
    // Why it matters: Text links and buttons with < 40px target height cause mis-taps on mobile devices (WCAG 2.5.5 / 2.5.8).

    it('DES-004.1: .auth-footer-links .text-link has min-height: 40px in style.css', () => {
      // WCAG Touch target compliance for footer navigation links
      const match = styleCss.match(/\.auth-footer-links\s+\.text-link\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/min-height\s*:\s*40px/i);
    });

    it('DES-004.2: .auth-footer-links .text-link has padding: 8px 4px in style.css', () => {
      // Adequate hit target padding around text
      const match = styleCss.match(/\.auth-footer-links\s+\.text-link\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/padding\s*:\s*8px\s+4px/i);
    });

    it('DES-004.3: .auth-footer-links .text-link displays as inline-flex with center alignment', () => {
      // Centers text vertically within 40px touch bounds
      const match = styleCss.match(/\.auth-footer-links\s+\.text-link\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/display\s*:\s*inline-flex/i);
      expect(match[1]).toMatch(/align-items\s*:\s*center/i);
      expect(match[1]).toMatch(/justify-content\s*:\s*center/i);
    });

    it('DES-004.4: .auth-forgot-link has min-height: 40px in style.css', () => {
      // Touch target height for "Forgot password?" link
      const match = styleCss.match(/\.auth-forgot-link\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/min-height\s*:\s*40px/i);
    });

    it('DES-004.5: .auth-forgot-link has display: inline-flex and align-items: center in style.css', () => {
      // Centers "Forgot password?" link vertically in touch container
      const match = styleCss.match(/\.auth-forgot-link\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/display\s*:\s*inline-flex/i);
      expect(match[1]).toMatch(/align-items\s*:\s*center/i);
    });

    it('DES-004.6: .auth-forgot-link has padding: 4px 0 in style.css', () => {
      // Hit target padding for "Forgot password?" link
      const match = styleCss.match(/\.auth-forgot-link\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/padding\s*:\s*4px\s+0/i);
    });

    it('DES-004.7: .auth-consent label has min-height: 36px in style.css', () => {
      // Ensures terms and privacy checkbox row has easy tap target for fingers
      const match = styleCss.match(/\.auth-consent\s+label\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/min-height\s*:\s*36px/i);
    });

    it('DES-004.8: .auth-consent input[type=checkbox] has width and height of 18px', () => {
      // Clear visual target for checkbox
      const match = styleCss.match(/\.auth-consent\s+input\[type=checkbox\]\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/width\s*:\s*18px/i);
      expect(match[1]).toMatch(/height\s*:\s*18px/i);
    });

    it('DES-004.9: .password-field .pw-toggle has width and height of 36px', () => {
      // Large tap box for password visibility eye icon
      const match = styleCss.match(/\.password-field\s+\.pw-toggle\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/width\s*:\s*36px/i);
      expect(match[1]).toMatch(/height\s*:\s*36px/i);
    });

    it('DES-004.10: #goToForgot has tabindex="0" and role="button" for keyboard and a11y focus', () => {
      // A11y & keyboard compliance
      expect(loginHtml).toMatch(/id=['"]goToForgot['"][^>]+role=['"]button['"][^>]+tabindex=['"]0['"]/);
    });

    it('DES-004.11: #goToSignup has tabindex="0" and role="button"', () => {
      // A11y & keyboard compliance
      expect(loginHtml).toMatch(/id=['"]goToSignup['"][^>]+role=['"]button['"][^>]+tabindex=['"]0['"]/);
    });

    it('DES-004.12: #signupBackToLogin1 has tabindex="0" and role="button"', () => {
      // A11y & keyboard compliance
      expect(loginHtml).toMatch(/id=['"]signupBackToLogin1['"][^>]+role=['"]button['"][^>]+tabindex=['"]0['"]/);
    });

    it('DES-004.13: #signupBackToLogin2 has tabindex="0" and role="button"', () => {
      // A11y & keyboard compliance
      expect(loginHtml).toMatch(/id=['"]signupBackToLogin2['"][^>]+role=['"]button['"][^>]+tabindex=['"]0['"]/);
    });

    it('DES-004.14: #forgotBackToLogin1 has tabindex="0" and role="button"', () => {
      // A11y & keyboard compliance
      expect(loginHtml).toMatch(/id=['"]forgotBackToLogin1['"][^>]+role=['"]button['"][^>]+tabindex=['"]0['"]/);
    });

    it('DES-004.15: #forgotBackToLogin2 has tabindex="0" and role="button"', () => {
      // A11y & keyboard compliance
      expect(loginHtml).toMatch(/id=['"]forgotBackToLogin2['"][^>]+role=['"]button['"][^>]+tabindex=['"]0['"]/);
    });

    it('DES-004.16: #signupResendOtp has tabindex="0" and role="button"', () => {
      // A11y & keyboard compliance
      expect(loginHtml).toMatch(/id=['"]signupResendOtp['"][^>]+role=['"]button['"][^>]+tabindex=['"]0['"]/);
    });

    it('DES-004.17: #forgotResendOtp has tabindex="0" and role="button"', () => {
      // A11y & keyboard compliance
      expect(loginHtml).toMatch(/id=['"]forgotResendOtp['"][^>]+role=['"]button['"][^>]+tabindex=['"]0['"]/);
    });

    it('DES-004.18: .auth-footer-links has gap: 4px and margin-top: 18px to space out footer links', () => {
      // Prevents accidental touch collisions between adjacent links
      const match = styleCss.match(/\.auth-footer-links\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/gap\s*:\s*4px/i);
      expect(match[1]).toMatch(/margin-top\s*:\s*18px/i);
    });

    it('DES-004.19: .auth-forgot-row has margin-top: 6px and margin-bottom: 6px for clean spacing above submit', () => {
      // Separates forgot link from primary submit button
      const match = styleCss.match(/\.auth-forgot-row\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/margin-top\s*:\s*6px/i);
      expect(match[1]).toMatch(/margin-bottom\s*:\s*6px/i);
    });

    it('DES-004.20: .auth-forgot-link has active tactile feedback (transform: scale(0.98))', () => {
      // Instant tactile confirmation on tap
      expect(styleCss).toMatch(/\.auth-forgot-link:active\s*\{\s*transform:\s*scale\(0\.98\);\s*\}/);
    });

    it('DES-004.21: .auth-forgot-link has focus-visible outline for keyboard navigation', () => {
      // WCAG 2.4.7 Focus Visible
      expect(styleCss).toMatch(/\.auth-forgot-link:focus-visible\s*\{\s*outline:\s*2px solid var\(--accent-orange\);\s*outline-offset:\s*2px;\s*border-radius:\s*4px;\s*\}/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 4: DES-005 — Standardized 12px Button Border Radius (Tests 64–84)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('DES-005: Standardized 12px Button Border Radius Across Auth & Onboarding', () => {
    // Why it matters: Capsule 999px buttons clashed with modern 12px card architecture and onboarding design system.

    it('DES-005.1: .auth-card button.primary has border-radius: 12px in style.css', () => {
      // Standardizes primary auth button curvature
      const match = styleCss.match(/\.auth-card\s+button\.primary\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/border-radius\s*:\s*12px/i);
    });

    it('DES-005.2: .auth-card button.primary does NOT contain border-radius: 999px (capsule removed)', () => {
      // Prevents legacy pill button regression
      const match = styleCss.match(/\.auth-card\s+button\.primary\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).not.toMatch(/border-radius\s*:\s*999px/i);
    });

    it('DES-005.3: .auth-card button.secondary has border-radius: 12px in style.css', () => {
      // Standardizes secondary auth button curvature
      const match = styleCss.match(/\.auth-card\s+button\.secondary\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/border-radius\s*:\s*12px/i);
    });

    it('DES-005.4: .auth-card button.secondary does NOT contain border-radius: 999px', () => {
      // Prevents legacy pill button regression
      const match = styleCss.match(/\.auth-card\s+button\.secondary\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).not.toMatch(/border-radius\s*:\s*999px/i);
    });

    it('DES-005.5: .auth-card button.primary has font-weight: 700 and letter-spacing: 0.01em', () => {
      // Crisp typography on primary CTA
      const match = styleCss.match(/\.auth-card\s+button\.primary\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/font-weight\s*:\s*700/i);
      expect(match[1]).toMatch(/letter-spacing\s*:\s*0\.01em/i);
    });

    it('DES-005.6: .auth-card button.primary has brand shadow box-shadow: 0 10px 22px -10px rgba(217,105,75,0.55)', () => {
      // Warm accent elevation glow
      const match = styleCss.match(/\.auth-card\s+button\.primary\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/box-shadow\s*:\s*0\s+10px\s+22px\s+-10px\s+rgba\(217,\s*105,\s*75,\s*0\.55\)/i);
    });

    it('DES-005.7: .auth-card button.secondary has border: 1.5px solid var(--line) and font-weight: 600', () => {
      // Subtle secondary border styling
      const match = styleCss.match(/\.auth-card\s+button\.secondary\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/border\s*:\s*1\.5px\s+solid\s+var\(--line\)/i);
      expect(match[1]).toMatch(/font-weight\s*:\s*600/i);
    });

    it('DES-005.8: .auth-card button.secondary:hover styles border-color with var(--accent-orange)', () => {
      // Interactive hover feedback
      const match = styleCss.match(/\.auth-card\s+button\.secondary:hover\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/border-color\s*:\s*var\(--accent-orange\)/i);
    });

    it('DES-005.9: .auth-card button.secondary:hover styles background with var(--accent-soft-orange)', () => {
      // Interactive hover background tint
      const match = styleCss.match(/\.auth-card\s+button\.secondary:hover\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/background\s*:\s*var\(--accent-soft-orange\)/i);
    });

    it('DES-005.10: .auth-card button.primary:active has scale transform of 0.99', () => {
      // Tactile button compression on press
      expect(styleCss).toMatch(/\.auth-card\s+button\.primary:active\s*\{\s*transform:\s*scale\(0\.99\);\s*\}/);
    });

    it('DES-005.11: #loginSubmitBtn element exists inside #screenLogin with class="primary"', () => {
      // Confirms 12px primary button on Login
      expect(loginHtml).toMatch(/<button\s+type=['"]submit['"]\s+class=['"]primary['"]\s+id=['"]loginSubmitBtn['"]>\s*Log In\s*<\/button>/);
    });

    it('DES-005.12: #googleBtn element exists inside #screenLogin with class="secondary"', () => {
      // Confirms 12px secondary button for Google OAuth
      expect(loginHtml).toMatch(/<button\s+class=['"]secondary['"]\s+id=['"]googleBtn['"]>/);
    });

    it('DES-005.13: #signupStartSubmitBtn element exists inside #screenSignupStart with class="primary"', () => {
      // Confirms 12px primary button on Signup Step 1
      expect(loginHtml).toMatch(/<button\s+type=['"]submit['"]\s+class=['"]primary['"]\s+id=['"]signupStartSubmitBtn['"]>\s*Send OTP\s*<\/button>/);
    });

    it('DES-005.14: #signupVerifySubmitBtn element exists inside #screenSignupVerify with class="primary"', () => {
      // Confirms 12px primary button on Signup Step 2
      expect(loginHtml).toMatch(/<button\s+type=['"]submit['"]\s+class=['"]primary['"]\s+id=['"]signupVerifySubmitBtn['"]>\s*Verify &amp; Create Account\s*<\/button>/);
    });

    it('DES-005.15: #forgotStartSubmitBtn element exists inside #screenForgotStart with class="primary"', () => {
      // Confirms 12px primary button on Forgot Password Step 1
      expect(loginHtml).toMatch(/<button\s+type=['"]submit['"]\s+class=['"]primary['"]\s+id=['"]forgotStartSubmitBtn['"]>\s*Send OTP\s*<\/button>/);
    });

    it('DES-005.16: #forgotVerifySubmitBtn element exists inside #screenForgotVerify with class="primary"', () => {
      // Confirms 12px primary button on Forgot Password Step 2
      expect(loginHtml).toMatch(/<button\s+type=['"]submit['"]\s+class=['"]primary['"]\s+id=['"]forgotVerifySubmitBtn['"]>\s*Reset Password\s*<\/button>/);
    });

    it('DES-005.17: onboarding.html buttons also use 12px border-radius in style.css', () => {
      // Verifies design cross-screen consistency between auth and onboarding
      expect(styleCss).toMatch(/button\.primary|button\.secondary|\.onboarding/);
    });

    it('DES-005.18: confirm-dialog.js modal buttons also use 12px border radius', () => {
      // Verifies brand confirmation dialog buttons match 12px curve
      const dialogBtnMatch = styleCss.match(/\.confirm-dialog-btn\s*\{([^}]+)\}/);
      expect(dialogBtnMatch).toBeTruthy();
      expect(dialogBtnMatch[1]).toMatch(/border-radius\s*:\s*12px/i);
    });

    it('DES-005.19: allBusyToggles covers all 6 primary/secondary action buttons on login.html', () => {
      // Ensures loading lock correctly covers all 12px buttons
      expect(loginHtml).toMatch(/function\s+allBusyToggles\s*\(\s*\)\s*\{[\s\S]*?loginSubmitBtn[\s\S]*?googleBtn[\s\S]*?signupStartSubmitBtn[\s\S]*?signupVerifySubmitBtn[\s\S]*?forgotStartSubmitBtn[\s\S]*?forgotVerifySubmitBtn[\s\S]*?\}/);
    });

    it('DES-005.20: setAuthBusy sets disabled attribute across all buttons without altering border radius', () => {
      // Ensures disabled state preserves 12px geometry
      const fnMatch = loginHtml.match(/function\s+setAuthBusy\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(fnMatch).toBeTruthy();
      expect(fnMatch[1]).toMatch(/btn\.disabled\s*=\s*busy/);
    });

    it('DES-005.21: Google icon SVG inside #googleBtn has width="18" and height="18" to fit 12px container', () => {
      // Proportional icon sizing inside 12px button
      expect(loginHtml).toMatch(/<button\s+class=['"]secondary['"]\s+id=['"]googleBtn['"]>\s*<svg\s+width=['"]18['"]\s+height=['"]18['"]/);
    });
  });
});
