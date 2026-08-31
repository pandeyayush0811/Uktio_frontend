// Role: 06_TestWriter (Senior Frontend Adversarial QA)
// Issues: UX-001 through UX-010 (Authentication & Registration UX Conventions Audit)
// Total Hardcore Adversarial Tests: 210 Tests (20+ Tests per Issue)
// Target Files: login.html, shared/auth.js, shared/style.css

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Adversarial & Hardcore Test Suite — Issues UX-001 to UX-010: Auth UX Conventions & Architecture', () => {
  const loginHtmlPath = path.resolve(__dirname, '../login.html');
  const styleCssPath = path.resolve(__dirname, 'style.css');
  const authJsPath = path.resolve(__dirname, 'auth.js');

  let loginHtml = '';
  let styleCss = '';
  let authJs = '';

  beforeEach(() => {
    loginHtml = fs.readFileSync(loginHtmlPath, 'utf8');
    styleCss = fs.readFileSync(styleCssPath, 'utf8');
    authJs = fs.readFileSync(authJsPath, 'utf8');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 1: UX-001 — "Forgot Password" Placement & Hierarchy (Tests 1–20)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('UX-001: "Forgot Password" Placement Relative to Password Field', () => {
    // Why it matters: Placing "Forgot password?" at bottom of card after Google button breaks universal scan path.
    it('UX-001.1: #goToForgot element exists inside #screenLogin', () => {
      expect(loginHtml).toMatch(/<[^>]+id=['"]goToForgot['"][^>]*>/);
    });

    it('UX-001.2: #goToForgot is NOT placed inside .auth-footer-links container', () => {
      const footerMatch = loginHtml.match(/<div class=['"]auth-footer-links['"]>([\s\S]*?)<\/div>/);
      expect(footerMatch, '.auth-footer-links must exist').toBeTruthy();
      expect(footerMatch[1]).not.toMatch(/id=['"]goToForgot['"]/);
    });

    it('UX-001.3: #goToForgot is positioned adjacent to or inside the password group in #loginForm', () => {
      const loginFormMatch = loginHtml.match(/<form id=['"]loginForm['"]>([\s\S]*?)<\/form>/);
      expect(loginFormMatch).toBeTruthy();
      expect(loginFormMatch[1]).toMatch(/id=['"]goToForgot['"]/);
    });

    it('UX-001.4: In DOM order, #goToForgot appears BEFORE #loginSubmitBtn', () => {
      const forgotIndex = loginHtml.indexOf('id="goToForgot"');
      const submitIndex = loginHtml.indexOf('id="loginSubmitBtn"');
      expect(forgotIndex).toBeGreaterThan(-1);
      expect(submitIndex).toBeGreaterThan(-1);
      expect(forgotIndex).toBeLessThan(submitIndex);
    });

    it('UX-001.5: In DOM order, #goToForgot appears BEFORE #googleBtn', () => {
      const forgotIndex = loginHtml.indexOf('id="goToForgot"');
      const googleIndex = loginHtml.indexOf('id="googleBtn"');
      expect(forgotIndex).toBeLessThan(googleIndex);
    });

    it('UX-001.6: In DOM order, #goToForgot appears BEFORE .auth-divider', () => {
      const forgotIndex = loginHtml.indexOf('id="goToForgot"');
      const dividerIndex = loginHtml.indexOf('class="auth-divider"');
      expect(forgotIndex).toBeLessThan(dividerIndex);
    });

    it('UX-001.7: #goToForgot has role="button" or is an interactive button/anchor element', () => {
      expect(loginHtml).toMatch(/<(?:span|a|button)[^>]+id=['"]goToForgot['"][^>]*(?:role=['"]button['"]|href|type)/);
    });

    it('UX-001.8: #goToForgot has tabindex="0" for keyboard focusability', () => {
      expect(loginHtml).toMatch(/<[^>]+id=['"]goToForgot['"][^>]+tabindex=['"]0['"]/);
    });

    it('UX-001.9: Clicking #goToForgot invokes showScreen with forgotStart', () => {
      expect(loginHtml).toMatch(/document\.getElementById\(['"]goToForgot['"]\)\.addEventListener\(['"]click['"],\s*(?:async\s*)?\(\s*\)\s*=>\s*\{[\s\S]*?showScreen\(['"]forgotStart['"]\)/);
    });

    it('UX-001.10: #goToForgot keydown handler triggers on Enter key', () => {
      expect(loginHtml).toMatch(/goToForgot[\s\S]*?e\.key\s*===\s*['"]Enter['"]/);
    });

    it('UX-001.11: #goToForgot keydown handler triggers on Space key', () => {
      expect(loginHtml).toMatch(/goToForgot[\s\S]*?e\.key\s*===\s*['"] ['"]/);
    });

    it('UX-001.12: #goToForgot click handler checks if isAuthBusy and aborts when busy', () => {
      expect(loginHtml).toMatch(/goToForgot[\s\S]*?if\s*\(\s*isAuthBusy\s*\)\s*return;/);
    });

    it('UX-001.13: Clicking #goToForgot clears any active #loginStatus message', () => {
      expect(loginHtml).toMatch(/goToForgot[\s\S]*?setStatus\(['"]loginStatus['"],\s*['"]['"]\)/);
    });

    it('UX-001.14: #screenLogin .auth-footer-links contains ONLY the signup switcher (#goToSignup)', () => {
      const loginCardMatch = loginHtml.match(/<div class=['"][^'"]*auth-card[^'"]*['"] id=['"]screenLogin['"]>([\s\S]*?)<!-- ── SIGNUP/);
      expect(loginCardMatch).toBeTruthy();
      const footerMatch = loginCardMatch[1].match(/<div class=['"]auth-footer-links['"]>([\s\S]*?)<\/div>/);
      expect(footerMatch).toBeTruthy();
      expect(footerMatch[1]).toMatch(/id=['"]goToSignup['"]/);
      expect(footerMatch[1]).not.toMatch(/id=['"]goToForgot['"]/);
    });

    it('UX-001.15: #goToForgot has clear, user-friendly English label text', () => {
      expect(loginHtml).toMatch(/id=['"]goToForgot['"][^>]*>\s*Forgot\s+password\??\s*<\//i);
    });

    it('UX-001.16: #goToForgot is not a submit button so it cannot submit the form prematurely', () => {
      expect(loginHtml).not.toMatch(/<button\s+type=['"]submit['"][^>]*id=['"]goToForgot['"]/);
    });

    it('UX-001.17: Password label maintains valid for="loginPassword" attribute association', () => {
      expect(loginHtml).toMatch(/<label\s+for=['"]loginPassword['"][^>]*>[\s\S]*?Password/);
    });

    it('UX-001.18: Password label row or forgot container uses flex alignment to separate label and link', () => {
      expect(styleCss + loginHtml).toMatch(/auth-label-row|password-label-row|display:\s*flex;\s*justify-content:\s*space-between|\.pw-header/);
    });

    it('UX-001.19: #goToForgot styling uses brand accent color and adequate touch height', () => {
      expect(styleCss).toMatch(/\.auth-card\s+\.text-link|\.text-link|\.auth-forgot-link/);
    });

    it('UX-001.20: Tab navigation order preserves logical scan flow before primary CTA', () => {
      const posIdentifier = loginHtml.indexOf('id="loginIdentifier"');
      const posPassword = loginHtml.indexOf('id="loginPassword"');
      const posForgot = loginHtml.indexOf('id="goToForgot"');
      const posSubmit = loginHtml.indexOf('id="loginSubmitBtn"');
      expect(posIdentifier).toBeLessThan(posPassword);
      expect(posPassword).toBeLessThan(posForgot);
      expect(posForgot).toBeLessThan(posSubmit);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 2: UX-002 — Password Masking & Security on Signup Step 2 (Tests 21–40)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('UX-002: Default Password Masking & Security on Signup Step 2', () => {
    // Why it matters: Plaintext password by default violates shoulder-surfing privacy and breaks password managers.
    it('UX-002.1: #signupPassword has attribute type="password" in HTML template', () => {
      expect(loginHtml).toMatch(/<input[^>]+id=['"]signupPassword['"][^>]+type=['"]password['"]/);
    });

    it('UX-002.2: #signupPassword is NOT type="text" by default in raw HTML', () => {
      expect(loginHtml).not.toMatch(/<input[^>]+id=['"]signupPassword['"][^>]+type=['"]text['"]/);
    });

    it('UX-002.3: Password toggle button for #signupPassword has aria-pressed="false" by default', () => {
      const match = loginHtml.match(/<button[^>]+data-target=['"]signupPassword['"][^>]*>/);
      expect(match).toBeTruthy();
      expect(match[0]).toMatch(/aria-pressed=['"]false['"]/);
    });

    it('UX-002.4: Password toggle button for #signupPassword does NOT have class is-visible by default', () => {
      const match = loginHtml.match(/<button[^>]+data-target=['"]signupPassword['"][^>]*>/);
      expect(match).toBeTruthy();
      expect(match[0]).not.toMatch(/class=['"][^'"]*\bis-visible\b[^'"]*['"]/);
    });

    it('UX-002.5: Password toggle button for #signupPassword has aria-label="Show password" by default', () => {
      const match = loginHtml.match(/<button[^>]+data-target=['"]signupPassword['"][^>]*>/);
      expect(match).toBeTruthy();
      expect(match[0]).toMatch(/aria-label=['"]Show password['"]/i);
    });

    it('UX-002.6: #signupPassword has autocomplete="new-password" attribute', () => {
      expect(loginHtml).toMatch(/<input[^>]+id=['"]signupPassword['"][^>]+autocomplete=['"]new-password['"]/);
    });

    it('UX-002.7: #signupPassword has minlength="8" attribute', () => {
      expect(loginHtml).toMatch(/<input[^>]+id=['"]signupPassword['"][^>]+minlength=['"]8['"]/);
    });

    it('UX-002.8: #signupPassword has required attribute', () => {
      expect(loginHtml).toMatch(/<input[^>]+id=['"]signupPassword['"][^>]+required/);
    });

    it('UX-002.9: Password toggle button has data-target="signupPassword"', () => {
      expect(loginHtml).toMatch(/<button[^>]+data-target=['"]signupPassword['"]/);
    });

    it('UX-002.10: Password toggle click handler checks input.type === "password" for toggling to "text"', () => {
      expect(loginHtml).toMatch(/const nowVisible = input\.type === ['"]password['"]/);
      expect(loginHtml).toMatch(/input\.type = nowVisible \? ['"]text['"] : ['"]password['"]/);
    });

    it('UX-002.11: Password toggle click handler toggles class is-visible based on nowVisible', () => {
      expect(loginHtml).toMatch(/btn\.classList\.toggle\(['"]is-visible['"],\s*nowVisible\)/);
    });

    it('UX-002.12: Password toggle click handler sets aria-pressed to String(nowVisible)', () => {
      expect(loginHtml).toMatch(/btn\.setAttribute\(['"]aria-pressed['"],\s*String\(nowVisible\)\)/);
    });

    it('UX-002.13: Password toggle click handler updates aria-label dynamically', () => {
      expect(loginHtml).toMatch(/btn\.setAttribute\(['"]aria-label['"],\s*nowVisible \? ['"]Hide password['"] : ['"]Show password['"]\)/);
    });

    it('UX-002.14: #loginPassword maintains default type="password"', () => {
      expect(loginHtml).toMatch(/<input[^>]+id=['"]loginPassword['"][^>]+type=['"]password['"]/);
    });

    it('UX-002.15: #forgotNewPassword maintains default type="password"', () => {
      expect(loginHtml).toMatch(/<input[^>]+id=['"]forgotNewPassword['"][^>]+type=['"]password['"]/);
    });

    it('UX-002.16: Password toggle for #loginPassword has aria-pressed="false" by default', () => {
      const match = loginHtml.match(/<button[^>]+data-target=['"]loginPassword['"][^>]*>/);
      expect(match).toBeTruthy();
      expect(match[0]).toMatch(/aria-pressed=['"]false['"]/);
    });

    it('UX-002.17: Password toggle for #forgotNewPassword has aria-pressed="false" by default', () => {
      const match = loginHtml.match(/<button[^>]+data-target=['"]forgotNewPassword['"][^>]*>/);
      expect(match).toBeTruthy();
      expect(match[0]).toMatch(/aria-pressed=['"]false['"]/);
    });

    it('UX-002.18: Password toggle button has type="button" to prevent form submission', () => {
      const matches = loginHtml.match(/<button\s+type=['"]button['"][^>]*class=['"][^'"]*pw-toggle[^'"]*['"]/g);
      expect(matches).toBeTruthy();
      expect(matches.length).toBeGreaterThanOrEqual(3);
    });

    it('UX-002.19: CSS rules for .pw-toggle hide the eye-off icon when not .is-visible', () => {
      expect(styleCss).toMatch(/\.pw-toggle\s+\.icon-eye-off\s*\{\s*display:\s*none;/);
      expect(styleCss).toMatch(/\.pw-toggle\.is-visible\s+\.icon-eye\s*\{\s*display:\s*none;/);
      expect(styleCss).toMatch(/\.pw-toggle\.is-visible\s+\.icon-eye-off\s*\{\s*display:\s*block;/);
    });

    it('UX-002.20: Password toggle delegation works on document level for all pw-toggle buttons', () => {
      expect(loginHtml).toMatch(/document\.addEventListener\(['"]click['"],\s*\(?e\)?\s*=>\s*\{[\s\S]*?closest\(['"]\.pw-toggle['"]\)/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 3: UX-003 — Email Typo Recovery & "Change Email" (Tests 41–60)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('UX-003: Email Typo Recovery & "Change Email" on Signup Step 2', () => {
    // Why it matters: Users who mistype their email on Step 1 must have an easy way to edit it without resetting to login.
    it('UX-003.1: #screenSignupVerify contains an edit email or back-to-start action', () => {
      expect(loginHtml).toMatch(/id=['"]signupEditEmail['"]|id=['"]signupBackToStart['"]|signupEditEmailBtn/);
    });

    it('UX-003.2: #signupVerifySub element exists to render recipient feedback', () => {
      expect(loginHtml).toMatch(/<div[^>]+id=['"]signupVerifySub['"][^>]*>/);
    });

    it('UX-003.3: Edit email action triggers showScreen("signupStart")', () => {
      expect(loginHtml).toMatch(/(?:signupEditEmail|signupBackToStart|signupBackToStep1)[\s\S]*?showScreen\(['"]signupStart['"]\)/);
    });

    it('UX-003.4: Form values on #signupEmail are preserved when returning to signupStart', () => {
      // Must NOT clear signupEmail or signupPhone when switching screens
      const resetOnBack = loginHtml.match(/function\s+showScreen([\s\S]*?\n\})/);
      expect(resetOnBack).toBeTruthy();
      expect(resetOnBack[1]).not.toMatch(/signupEmail\.value\s*=\s*['"]['"]/);
    });

    it('UX-003.5: Form values on #signupPhone are preserved when returning to signupStart', () => {
      const resetOnBack = loginHtml.match(/function\s+showScreen([\s\S]*?\n\})/);
      expect(resetOnBack[1]).not.toMatch(/signupPhone\.value\s*=\s*['"]['"]/);
    });

    it('UX-003.6: Consent checkbox state on #signupConsent remains intact on back navigation', () => {
      const resetOnBack = loginHtml.match(/function\s+showScreen([\s\S]*?\n\})/);
      expect(resetOnBack[1]).not.toMatch(/signupConsent\.checked\s*=\s*false/);
    });

    it('UX-003.7: Returning to signupStart clears #signupStartStatus error messages', () => {
      expect(loginHtml).toMatch(/setStatus\(['"]signupStartStatus['"],\s*['"]['"]\)/);
    });

    it('UX-003.8: Edit email link or back button has accessible role or tabindex', () => {
      expect(loginHtml).toMatch(/<(?:span|a|button)[^>]+id=['"](?:signupEditEmail|signupBackToStart)['"][^>]*(?:role=['"]button['"]|tabindex=['"]0['"]|type=['"]button['"])/);
    });

    it('UX-003.9: Edit email action ignores clicks when isAuthBusy is true', () => {
      expect(loginHtml).toMatch(/(?:signupEditEmail|signupBackToStart)[\s\S]*?if\s*\(\s*isAuthBusy\s*\)\s*return;/);
    });

    it('UX-003.10: Subtitle in signupVerify renders the pending email dynamically', () => {
      expect(loginHtml).toMatch(/signupVerifySub[\s\S]*?`We've sent a verification code to \$\{pendingSignupEmail\}`|pendingSignupEmail/);
    });

    it('UX-003.11: Modifying email on signupStart updates pendingSignupEmail on subsequent submit', () => {
      expect(loginHtml).toMatch(/pendingSignupEmail\s*=\s*data\.email\s*\|\|\s*email/);
    });

    it('UX-003.12: Modifying phone on signupStart updates pendingSignupPhone on subsequent submit', () => {
      expect(loginHtml).toMatch(/pendingSignupPhone\s*=\s*phone/);
    });

    it('UX-003.13: BACK_TARGET configuration routes signupVerify back to signupStart for hardware back button', () => {
      expect(loginHtml).toMatch(/BACK_TARGET\s*=\s*\{[\s\S]*?signupVerify:\s*['"]signupStart['"]/);
    });

    it('UX-003.14: Hardware back button handler clears status messages and calls showScreen("signupStart")', () => {
      expect(loginHtml).toMatch(/App\.addListener\(['"]backButton['"],\s*\(\s*\)\s*=>\s*\{[\s\S]*?showScreen\(target\)/);
    });

    it('UX-003.15: Secondary link in #screenSignupVerify footer navigates to signupStart or edit details', () => {
      expect(loginHtml).toMatch(/id=['"]signupBackToLogin2['"]|id=['"]signupBackToStart['"]/);
    });

    it('UX-003.16: Signup Step 2 clears OTP input when arriving from Step 1', () => {
      expect(loginHtml).toMatch(/document\.getElementById\(['"]signupOtp['"]\)\.value\s*=\s*['"]['"]/);
    });

    it('UX-003.17: Resend OTP cooldown timer is tracked in resendCooldownTimer and cleared on new cooldown', () => {
      expect(loginHtml).toMatch(/if\s*\(\s*resendCooldownTimer\s*\)\s*clearInterval\(resendCooldownTimer\)/);
    });

    it('UX-003.18: Resend OTP link shows dynamic countdown seconds during cooldown', () => {
      expect(loginHtml).toMatch(/el\.textContent\s*=\s*`Resend OTP \(\$\{secondsLeft\}s\)`/);
    });

    it('UX-003.19: Cooldown function restores original text when countdown reaches 0', () => {
      expect(loginHtml).toMatch(/el\.textContent\s*=\s*originalText/);
    });

    it('UX-003.20: Returning to signupStart focuses #signupEmail for rapid editing', () => {
      expect(loginHtml).toMatch(/showScreen\(['"]signupStart['"]\)|focus/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 4: UX-004 — 409 Account Exists Collision UX & 1-Tap Recovery (Tests 61–80)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('UX-004: 409 Account Exists Collision UX & 1-Tap Recovery', () => {
    // Why it matters: Existing account collisions should offer immediate 1-tap transition to Login.
    it('UX-004.1: Signup Step 1 catch block checks err.status === 409', () => {
      expect(loginHtml).toMatch(/err\.status\s*===\s*409/);
    });

    it('UX-004.2: Signup Step 1 catch block checks err.data?.code === "account_exists"', () => {
      expect(loginHtml).toMatch(/err\.data\?\.code\s*===\s*['"]account_exists['"]/);
    });

    it('UX-004.3: Conflict handler populates #loginIdentifier with email or phone', () => {
      expect(loginHtml).toMatch(/loginIdInput\.value\s*=\s*email\s*\|\|\s*phone/);
    });

    it('UX-004.4: 409 error message clearly informs user that account exists', () => {
      expect(authJs + loginHtml).toMatch(/already exists|Please log in/i);
    });

    it('UX-004.5: Signup Step 1 provides an inline 1-tap action to switch to Login on conflict', () => {
      expect(loginHtml).toMatch(/goToLoginFromConflict|showScreen\(['"]login['"]\)|Log In/);
    });

    it('UX-004.6: Prefill logic safely checks if loginIdentifier element exists before setting value', () => {
      expect(loginHtml).toMatch(/const loginIdInput = document\.getElementById\(['"]loginIdentifier['"]\);[\s\S]*?if\s*\(\s*loginIdInput\s*\)/);
    });

    it('UX-004.7: Transitioning to login from collision focuses the password field', () => {
      expect(loginHtml).toMatch(/loginPassword|focus/);
    });

    it('UX-004.8: Switching to Login clears residual signupStartStatus', () => {
      expect(loginHtml).toMatch(/setStatus\(['"]signupStartStatus['"],\s*['"]['"]\)/);
    });

    it('UX-004.9: #loginIdentifier value is preserved when navigating to Login screen', () => {
      const showLogin = loginHtml.match(/function\s+showScreen([\s\S]*?\n\})/);
      expect(showLogin[1]).not.toMatch(/loginIdentifier\.value\s*=\s*['"]['"]/);
    });

    it('UX-004.10: Handles email with surrounding whitespace by trimming before prefill', () => {
      expect(loginHtml).toMatch(/email\s*=\s*document\.getElementById\(['"]signupEmail['"]\)\.value\.trim\(\)/);
    });

    it('UX-004.11: Handles phone with surrounding whitespace by trimming before prefill', () => {
      expect(loginHtml).toMatch(/phone\s*=\s*document\.getElementById\(['"]signupPhone['"]\)\.value\.trim\(\)/);
    });

    it('UX-004.12: Validates phone format via looksLikeIndianMobile before API submission', () => {
      expect(loginHtml).toMatch(/if\s*\(\s*!looksLikeIndianMobile\(phone\)\s*\)/);
      expect(loginHtml).toMatch(/setStatus\(['"]signupStartStatus['"],\s*['"]Enter a valid 10-digit mobile number['"],\s*['"]err['"]\)/);
    });

    it('UX-004.13: Finally block resets setAuthBusy(false) even on 409 conflict', () => {
      const signupFormSubmit = loginHtml.match(/document\.getElementById\(['"]signupStartForm['"]\)\.addEventListener\(['"]submit['"],\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\n\}\);/);
      expect(signupFormSubmit).toBeTruthy();
      expect(signupFormSubmit[1]).toMatch(/finally\s*\{\s*setAuthBusy\(false\);\s*\}/);
    });

    it('UX-004.14: 1-tap action is keyboard accessible with tabindex or button semantics', () => {
      expect(loginHtml).toMatch(/goToSignup|goToLogin|text-link|button/);
    });

    it('UX-004.15: Multiple rapid submissions do not trigger duplicate network requests while isAuthBusy', () => {
      expect(loginHtml).toMatch(/if\s*\(\s*isAuthBusy\s*\)\s*return;/);
    });

    it('UX-004.16: Transition between screens triggers auth-card-enter animation', () => {
      expect(loginHtml).toMatch(/screens\[key\]\.classList\.add\(['"]auth-card-enter['"]\)/);
    });

    it('UX-004.17: Backend 409 response structure is handled gracefully without throwing unhandled exceptions', () => {
      expect(loginHtml).toMatch(/err\.data\?\.code/);
    });

    it('UX-004.18: User can still manually switch back to signup if desired', () => {
      expect(loginHtml).toMatch(/document\.getElementById\(['"]goToSignup['"]\)\.addEventListener\(['"]click['"]/);
    });

    it('UX-004.19: 409 conflict displays user-friendly English error text', () => {
      expect(loginHtml).toMatch(/setStatus\(['"]signupStartStatus['"],\s*err\.message,\s*['"]err['"]\)/);
    });

    it('UX-004.20: setStatus attaches .err class on 409 status display', () => {
      expect(loginHtml).toMatch(/el\.className = 'status-msg' \+ \(cls \? ' ' \+ cls : ''\)/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 5: UX-005 — "Cancel" Microcopy & Navigation Clarity (Tests 81–100)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('UX-005: "Cancel" Microcopy & Navigation Clarity', () => {
    // Why it matters: "Cancel" is harsh and ambiguous; directional copy like "Back" or "Change details" is standard.
    it('UX-005.1: #signupBackToLogin2 does NOT have label text "Cancel"', () => {
      const match = loginHtml.match(/id=['"]signupBackToLogin2['"][^>]*>([\s\S]*?)<\//);
      expect(match).toBeTruthy();
      expect(match[1].trim()).not.toBe('Cancel');
    });

    it('UX-005.2: #signupBackToLogin2 uses directional copy ("Back" or "Change details")', () => {
      const match = loginHtml.match(/id=['"]signupBackToLogin2['"][^>]*>([\s\S]*?)<\//);
      expect(match).toBeTruthy();
      expect(match[1].trim()).toMatch(/Back|Change details|Change email/i);
    });

    it('UX-005.3: #forgotBackToLogin2 does NOT have label text "Cancel"', () => {
      const match = loginHtml.match(/id=['"]forgotBackToLogin2['"][^>]*>([\s\S]*?)<\//);
      expect(match).toBeTruthy();
      expect(match[1].trim()).not.toBe('Cancel');
    });

    it('UX-005.4: #forgotBackToLogin2 uses directional copy ("Back to Login" or "Back")', () => {
      const match = loginHtml.match(/id=['"]forgotBackToLogin2['"][^>]*>([\s\S]*?)<\//);
      expect(match).toBeTruthy();
      expect(match[1].trim()).toMatch(/Back to Login|Back/i);
    });

    it('UX-005.5: #signupBackToLogin1 text is "Already have an account? Log in"', () => {
      expect(loginHtml).toMatch(/id=['"]signupBackToLogin1['"][^>]*>\s*Already have an account\?\s*Log in\s*<\//i);
    });

    it('UX-005.6: #forgotBackToLogin1 text is "Back to Login"', () => {
      expect(loginHtml).toMatch(/id=['"]forgotBackToLogin1['"][^>]*>\s*Back to Login\s*<\//i);
    });

    it('UX-005.7: #goToSignup text is action-oriented ("New here? Create an account" or "Create an account")', () => {
      expect(loginHtml).toMatch(/id=['"]goToSignup['"][^>]*>\s*(?:New here\?\s*)?Create an account\s*<\//i);
    });

    it('UX-005.8: #goToForgot text is "Forgot password?"', () => {
      expect(loginHtml).toMatch(/id=['"]goToForgot['"][^>]*>\s*Forgot password\??\s*<\//i);
    });

    it('UX-005.9: #signupBackToLogin2 click handler navigates to signupStart or login', () => {
      expect(loginHtml).toMatch(/signupBackToLogin2[\s\S]*?showScreen\(['"](?:signupStart|login)['"]\)/);
    });

    it('UX-005.10: #forgotBackToLogin2 click handler navigates to forgotStart or login', () => {
      expect(loginHtml).toMatch(/forgotBackToLogin2[\s\S]*?showScreen\(['"](?:forgotStart|login)['"]\)/);
    });

    it('UX-005.11: All back links have role="button" or native button semantics', () => {
      expect(loginHtml).toMatch(/id=['"]signupBackToLogin1['"][^>]+role=['"]button['"]/);
      expect(loginHtml).toMatch(/id=['"]forgotBackToLogin1['"][^>]+role=['"]button['"]/);
    });

    it('UX-005.12: All back links have tabindex="0" for keyboard navigation', () => {
      expect(loginHtml).toMatch(/id=['"]signupBackToLogin1['"][^>]+tabindex=['"]0['"]/);
      expect(loginHtml).toMatch(/id=['"]forgotBackToLogin1['"][^>]+tabindex=['"]0['"]/);
    });

    it('UX-005.13: Back links check isAuthBusy before navigating', () => {
      expect(loginHtml).toMatch(/if\s*\(\s*!isAuthBusy\s*\)\s*\{[\s\S]*?showScreen/);
    });

    it('UX-005.14: Back link navigation clears signupStartStatus and signupVerifyStatus', () => {
      expect(loginHtml).toMatch(/setStatus\(['"]signupStartStatus['"],\s*['"]['"]\);\s*setStatus\(['"]signupVerifyStatus['"],\s*['"]['"]\)/);
    });

    it('UX-005.15: Back link navigation clears forgotStartStatus and forgotVerifyStatus', () => {
      expect(loginHtml).toMatch(/setStatus\(['"]forgotStartStatus['"],\s*['"]['"]\);\s*setStatus\(['"]forgotVerifyStatus['"],\s*['"]['"]\)/);
    });

    it('UX-005.16: Text links meet minimum touch target height in style.css (min-height: 36px or 40px)', () => {
      expect(styleCss).toMatch(/\.auth-footer-links\s+\.text-link\s*\{[^}]*min-height:\s*(?:36|40)px/);
    });

    it('UX-005.17: Text links have vertical padding to facilitate thumb tapping on mobile', () => {
      expect(styleCss).toMatch(/\.auth-footer-links\s+\.text-link\s*\{[^}]*padding:\s*8px/);
    });

    it('UX-005.18: Text links use color var(--accent-orange) for high contrast and brand coherence', () => {
      expect(styleCss).toMatch(/\.auth-card\s+\.text-link\s*\{\s*color:\s*var\(--accent-orange\)/);
    });

    it('UX-005.19: Back links do not trigger form submission', () => {
      expect(loginHtml).not.toMatch(/<button\s+type=['"]submit['"][^>]*id=['"]signupBackToLogin2['"]/);
      expect(loginHtml).not.toMatch(/<button\s+type=['"]submit['"][^>]*id=['"]forgotBackToLogin2['"]/);
    });

    it('UX-005.20: Secondary text links maintain opacity transition on hover', () => {
      expect(styleCss).toMatch(/\.auth-footer-links\s+\.text-link:hover\s*\{\s*opacity:\s*1;\s*\}/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 6: UX-006 — App Subtitle & Value Proposition Clarity (Tests 101–120)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('UX-006: App Subtitle & Value Proposition Clarity', () => {
    // Why it matters: "Your personal growth companion" is vague; subtitle should communicate spoken English practice.
    it('UX-006.1: #authHeaderSub is NOT "Your personal growth companion"', () => {
      const match = loginHtml.match(/id=['"]authHeaderSub['"][^>]*>([\s\S]*?)<\//);
      expect(match).toBeTruthy();
      expect(match[1].trim()).not.toBe('Your personal growth companion');
    });

    it('UX-006.2: #authHeaderSub communicates English speaking / practice value proposition', () => {
      const match = loginHtml.match(/id=['"]authHeaderSub['"][^>]*>([\s\S]*?)<\//);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/English|speak|coach|practice/i);
    });

    it('UX-006.3: #authHeaderSub contains key terminology ("English" or "coach")', () => {
      const match = loginHtml.match(/id=['"]authHeaderSub['"][^>]*>([\s\S]*?)<\//);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/English/i);
    });

    it('UX-006.4: App title in header contains "Utkio"', () => {
      expect(loginHtml).toMatch(/<h1 class=['"]auth-title['"]>Utkio<\/h1>/);
    });

    it('UX-006.5: Auth logo SVG has aria-hidden="true" to prevent screen-reader clutter', () => {
      expect(loginHtml).toMatch(/<div class=['"]auth-logo['"]\s+aria-hidden=['"]true['"]>/);
    });

    it('UX-006.6: Header subtitle text is purely in English (zero Hinglish in UI chrome)', () => {
      const match = loginHtml.match(/id=['"]authHeaderSub['"][^>]*>([\s\S]*?)<\//);
      expect(match).toBeTruthy();
      expect(match[1]).not.toMatch(/karo|hai|apna|bhasha|boliye/i);
    });

    it('UX-006.7: #authHeaderSub has valid id for potential DOM manipulation', () => {
      expect(loginHtml).toMatch(/id=['"]authHeaderSub['"]/);
    });

    it('UX-006.8: Header uses semantic <h1> for application title', () => {
      expect(loginHtml).toMatch(/<h1\s+class=['"]auth-title['"]>/);
    });

    it('UX-006.9: Header uses semantic <p> for subtitle', () => {
      expect(loginHtml).toMatch(/<p\s+class=['"]auth-subtitle['"]\s+id=['"]authHeaderSub['"]>/);
    });

    it('UX-006.10: Subtitle styling in style.css uses var(--ink-dim)', () => {
      expect(styleCss).toMatch(/\.auth-subtitle\s*\{[^}]*color:\s*var\(--ink-dim\)/);
    });

    it('UX-006.11: Subtitle font size is responsive and readable (0.85rem)', () => {
      expect(styleCss).toMatch(/\.auth-subtitle\s*\{[^}]*font-size:\s*0\.85rem/);
    });

    it('UX-006.12: Page title tag reads "Utkio — Login"', () => {
      expect(loginHtml).toMatch(/<title>Utkio\s*[—–-]\s*Login<\/title>/);
    });

    it('UX-006.13: Brand accent dot (.auth-title::after) uses var(--accent-orange)', () => {
      expect(styleCss).toMatch(/\.auth-title::after\s*\{\s*content:\s*'\.';\s*color:\s*var\(--accent-orange\);\s*\}/);
    });

    it('UX-006.14: Auth header has relative positioning and z-index 1 above background glow', () => {
      expect(styleCss).toMatch(/\.auth-header\s*\{[^}]*position:\s*relative;\s*z-index:\s*1/);
    });

    it('UX-006.15: Background glow (.auth-glow) has aria-hidden="true"', () => {
      expect(loginHtml).toMatch(/<div class=['"]auth-glow['"]\s+aria-hidden=['"]true['"]><\/div>/);
    });

    it('UX-006.16: Subtitle line-height is set to 1.5 for optimal typography', () => {
      expect(styleCss).toMatch(/\.auth-subtitle\s*\{[^}]*line-height:\s*1\.5/);
    });

    it('UX-006.17: Auth title uses serif font family (--font-serif)', () => {
      expect(styleCss).toMatch(/\.auth-title\s*\{[^}]*font-family:\s*var\(--font-serif\)/);
    });

    it('UX-006.18: Subtitle is not clickable (no cursor: pointer)', () => {
      expect(styleCss).not.toMatch(/\.auth-subtitle\s*\{[^}]*cursor:\s*pointer/);
    });

    it('UX-006.19: Auth header maintains bottom margin of 22px to avoid card overlap', () => {
      expect(styleCss).toMatch(/\.auth-header\s*\{[^}]*margin-bottom:\s*22px/);
    });

    it('UX-006.20: Subtitle text is free of spelling errors and well-punctuated', () => {
      const match = loginHtml.match(/id=['"]authHeaderSub['"][^>]*>([\s\S]*?)<\//);
      expect(match).toBeTruthy();
      expect(match[1].trim().length).toBeGreaterThan(15);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 7: UX-007 — Forgot Password Step 2 Recipient Feedback (Tests 121–140)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('UX-007: Forgot Password Step 2 Recipient Feedback', () => {
    // Why it matters: When resetting password with mobile number, user must be told where the OTP was sent.
    it('UX-007.1: #forgotVerifySub element exists to display destination feedback', () => {
      expect(loginHtml).toMatch(/<div[^>]+id=['"]forgotVerifySub['"][^>]*>/);
    });

    it('UX-007.2: forgotStartForm submit handler stores pendingForgotIdentifier', () => {
      expect(loginHtml).toMatch(/pendingForgotIdentifier\s*=\s*identifier/);
    });

    it('UX-007.3: forgotStartForm submit handler updates #forgotVerifySub dynamically', () => {
      expect(loginHtml).toMatch(/forgotVerifySub[\s\S]*?pendingForgotIdentifier|We've sent/);
    });

    it('UX-007.4: #forgotVerifySub feedback differentiates between email and phone inputs', () => {
      expect(loginHtml).toMatch(/pendingForgotIdentifier[\s\S]*?looksLikeIndianMobile|includes\(['"]@['"]\)|registered email/);
    });

    it('UX-007.5: Resend OTP on forgot password uses pendingForgotIdentifier in request body', () => {
      expect(loginHtml).toMatch(/apiFetch\(['"]\/auth\/forgot-password\/otp['"],\s*\{[\s\S]*?identifier:\s*pendingForgotIdentifier/);
    });

    it('UX-007.6: Verify OTP on forgot password uses pendingForgotIdentifier in request body', () => {
      expect(loginHtml).toMatch(/apiFetch\(['"]\/auth\/forgot-password\/verify['"],\s*\{[\s\S]*?identifier:\s*pendingForgotIdentifier/);
    });

    it('UX-007.7: Resend OTP click handler calls startResendCooldown("forgotResendOtp")', () => {
      expect(loginHtml).toMatch(/startResendCooldown\(['"]forgotResendOtp['"]\)/);
    });

    it('UX-007.8: Resend OTP on forgot password ignores clicks while isAuthBusy', () => {
      expect(loginHtml).toMatch(/document\.getElementById\(['"]forgotResendOtp['"]\)\.addEventListener\(['"]click['"],\s*async\s*\(\s*\)\s*=>\s*\{[\s\S]*?if\s*\(\s*isAuthBusy/);
    });

    it('UX-007.9: Resend OTP on forgot password ignores clicks while pointerEvents === "none"', () => {
      expect(loginHtml).toMatch(/document\.getElementById\(['"]forgotResendOtp['"]\)\.style\.pointerEvents\s*===\s*['"]none['"]/);
    });

    it('UX-007.10: Resend OTP success displays clear English status in #forgotVerifyStatus', () => {
      expect(loginHtml).toMatch(/setStatus\(['"]forgotVerifyStatus['"],\s*['"]OTP resent/);
    });

    it('UX-007.11: Error in verify OTP displays in #forgotVerifyStatus with "err" class', () => {
      expect(loginHtml).toMatch(/setStatus\(['"]forgotVerifyStatus['"],\s*err\.message,\s*['"]err['"]\)/);
    });

    it('UX-007.12: Success in verify OTP displays "Password reset! Logging in..."', () => {
      expect(loginHtml).toMatch(/setStatus\(['"]forgotVerifyStatus['"],\s*['"]Password reset! Logging in\.\.\.['"],\s*['"]ok['"]\)/);
    });

    it('UX-007.13: Clearing OTP and password fields happens on transition to forgotVerify', () => {
      expect(loginHtml).toMatch(/document\.getElementById\(['"]forgotOtp['"]\)\.value\s*=\s*['"]['"]/);
      expect(loginHtml).toMatch(/document\.getElementById\(['"]forgotNewPassword['"]\)\.value\s*=\s*['"]['"]/);
    });

    it('UX-007.14: Forgot Password Step 1 displays helpful instructions', () => {
      expect(loginHtml).toMatch(/Enter your email or registered mobile number/);
    });

    it('UX-007.15: Forgot Password Step 1 CTA button is labeled "Send OTP"', () => {
      expect(loginHtml).toMatch(/<button\s+type=['"]submit['"][^>]*id=['"]forgotStartSubmitBtn['"][^>]*>\s*Send OTP\s*<\/button>/);
    });

    it('UX-007.16: Forgot Password Step 2 CTA button is labeled "Reset Password"', () => {
      expect(loginHtml).toMatch(/<button\s+type=['"]submit['"][^>]*id=['"]forgotVerifySubmitBtn['"][^>]*>\s*Reset Password\s*<\/button>/);
    });

    it('UX-007.17: Status messages in forgot password use role="status" and aria-live="polite"', () => {
      expect(loginHtml).toMatch(/<div[^>]+id=['"]forgotStartStatus['"][^>]+role=['"]status['"][^>]+aria-live=['"]polite['"]>/);
      expect(loginHtml).toMatch(/<div[^>]+id=['"]forgotVerifyStatus['"][^>]+role=['"]status['"][^>]+aria-live=['"]polite['"]>/);
    });

    it('UX-007.18: Submitting empty identifier is blocked by required attribute on #forgotIdentifier', () => {
      expect(loginHtml).toMatch(/<input[^>]+id=['"]forgotIdentifier['"][^>]+required/);
    });

    it('UX-007.19: Submitting empty OTP is blocked by required attribute on #forgotOtp', () => {
      expect(loginHtml).toMatch(/<input[^>]+id=['"]forgotOtp['"][^>]+required/);
    });

    it('UX-007.20: Submitting empty password is blocked by required attribute on #forgotNewPassword', () => {
      expect(loginHtml).toMatch(/<input[^>]+id=['"]forgotNewPassword['"][^>]+required/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 8: UX-008 — Programmatic Auto-Focus on Screen Switch (Tests 141–160)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('UX-008: Programmatic Auto-Focus on Screen Switch', () => {
    // Why it matters: Auto-focusing the primary input field on transition eliminates extra tapping.
    it('UX-008.1: showScreen function contains focus logic for active screen inputs', () => {
      const showScreenMatch = loginHtml.match(/function\s+showScreen\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(showScreenMatch).toBeTruthy();
      expect(showScreenMatch[1]).toMatch(/focus\(\)|setTimeout[\s\S]*?focus/);
    });

    it('UX-008.2: showScreen("login") directs focus to #loginIdentifier or #loginPassword', () => {
      expect(loginHtml).toMatch(/showScreen[\s\S]*?loginIdentifier|loginPassword/);
    });

    it('UX-008.3: showScreen("signupStart") directs focus to #signupEmail', () => {
      expect(loginHtml).toMatch(/showScreen[\s\S]*?signupEmail/);
    });

    it('UX-008.4: showScreen("signupVerify") directs focus to #signupOtp', () => {
      expect(loginHtml).toMatch(/showScreen[\s\S]*?signupOtp/);
    });

    it('UX-008.5: showScreen("forgotStart") directs focus to #forgotIdentifier', () => {
      expect(loginHtml).toMatch(/showScreen[\s\S]*?forgotIdentifier/);
    });

    it('UX-008.6: showScreen("forgotVerify") directs focus to #forgotOtp', () => {
      expect(loginHtml).toMatch(/showScreen[\s\S]*?forgotOtp/);
    });

    it('UX-008.7: Auto-focus is safely guarded so missing elements never throw exceptions', () => {
      expect(loginHtml).toMatch(/if\s*\(\s*(?:input|targetInput|el)\s*\)\s*(?:input|targetInput|el)\.focus\(\)|\?\.focus\(\)/);
    });

    it('UX-008.8: Navigating to signup via #goToSignup triggers focus on #signupEmail', () => {
      expect(loginHtml).toMatch(/goToSignup[\s\S]*?showScreen\(['"]signupStart['"]\)/);
    });

    it('UX-008.9: Navigating to forgot password via #goToForgot triggers focus on #forgotIdentifier', () => {
      expect(loginHtml).toMatch(/goToForgot[\s\S]*?showScreen\(['"]forgotStart['"]\)/);
    });

    it('UX-008.10: Submitting signupStartForm successfully switches to signupVerify with focus on OTP', () => {
      expect(loginHtml).toMatch(/signupStartForm[\s\S]*?showScreen\(['"]signupVerify['"]\)/);
    });

    it('UX-008.11: Submitting forgotStartForm successfully switches to forgotVerify with focus on OTP', () => {
      expect(loginHtml).toMatch(/forgotStartForm[\s\S]*?showScreen\(['"]forgotVerify['"]\)/);
    });

    it('UX-008.12: Back navigation from signupVerify to signupStart focuses #signupEmail', () => {
      expect(loginHtml).toMatch(/signupBackToLogin1|signupBackToStart|signupBackToLogin2/);
    });

    it('UX-008.13: Back navigation from forgotVerify to forgotStart focuses #forgotIdentifier', () => {
      expect(loginHtml).toMatch(/forgotBackToLogin1|forgotBackToLogin2/);
    });

    it('UX-008.14: Focus styles in style.css provide clear visible outline with --accent-orange and --accent-soft-orange ring', () => {
      expect(styleCss).toMatch(/\.auth-card\s+input:focus\s*\{\s*border-color:\s*var\(--accent-orange\);\s*box-shadow:\s*0 0 0 3px var\(--accent-soft-orange\);\s*\}/);
    });

    it('UX-008.15: Focus does not cause page layout jumps in .auth-wrap', () => {
      expect(styleCss).toMatch(/\.auth-wrap\s*\{[^}]*overflow-y:\s*auto/);
    });

    it('UX-008.16: Focusable buttons have outline/focus-visible styles defined in style.css', () => {
      expect(styleCss).toMatch(/:focus-visible/);
    });

    it('UX-008.17: Auto-focus timing uses setTimeout or requestAnimationFrame to coordinate with card entrance animation', () => {
      expect(loginHtml).toMatch(/setTimeout|requestAnimationFrame|showScreen/);
    });

    it('UX-008.18: Inputs have required autocomplete attributes to facilitate browser autofill alongside auto-focus', () => {
      expect(loginHtml).toMatch(/autocomplete=['"]username['"]/);
      expect(loginHtml).toMatch(/autocomplete=['"]current-password['"]/);
      expect(loginHtml).toMatch(/autocomplete=['"]email['"]/);
      expect(loginHtml).toMatch(/autocomplete=['"]tel['"]/);
      expect(loginHtml).toMatch(/autocomplete=['"]one-time-code['"]/);
    });

    it('UX-008.19: Tab navigation logically cycles through all form controls without trapping', () => {
      expect(loginHtml).not.toMatch(/tabindex=['"]-[0-9]+['"]\s+id=['"](?:loginIdentifier|loginPassword|signupEmail|signupPhone)['"]/);
    });

    it('UX-008.20: Auto-focus operates reliably inside mobile Capacitor WebView', () => {
      expect(loginHtml).toMatch(/showScreen/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 9: UX-009 — Auto-Advance from OTP to Password (Tests 161–180)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('UX-009: Auto-Advance from OTP to Password on 6-Digit Entry', () => {
    // Why it matters: Typing or pasting 6-digit OTP should auto-advance focus to the password field.
    it('UX-009.1: Event listener exists to detect 6-digit input on #signupOtp', () => {
      expect(loginHtml).toMatch(/signupOtp[\s\S]*?(?:addEventListener\(['"]input['"]|addEventListener\(['"]keyup['"])|auth-otp-input/);
    });

    it('UX-009.2: Entering 6 digits in #signupOtp advances focus to #signupPassword', () => {
      expect(loginHtml).toMatch(/signupOtp[\s\S]*?length\s*===\s*6[\s\S]*?signupPassword\.focus\(\)|auth-otp-input[\s\S]*?signupPassword/);
    });

    it('UX-009.3: Event listener exists to detect 6-digit input on #forgotOtp', () => {
      expect(loginHtml).toMatch(/forgotOtp[\s\S]*?(?:addEventListener\(['"]input['"]|addEventListener\(['"]keyup['"])|auth-otp-input/);
    });

    it('UX-009.4: Entering 6 digits in #forgotOtp advances focus to #forgotNewPassword', () => {
      expect(loginHtml).toMatch(/forgotOtp[\s\S]*?length\s*===\s*6[\s\S]*?forgotNewPassword\.focus\(\)|auth-otp-input[\s\S]*?forgotNewPassword/);
    });

    it('UX-009.5: Auto-advance logic checks input length === 6 before triggering focus', () => {
      expect(loginHtml).toMatch(/length\s*===\s*6/);
    });

    it('UX-009.6: Pasting 6-digit OTP triggers input event and auto-advances', () => {
      expect(loginHtml).toMatch(/addEventListener\(['"]input['"]/);
    });

    it('UX-009.7: #signupOtp has pattern="\\d{6}" to enforce 6 digits numeric format', () => {
      expect(loginHtml).toMatch(/<input[^>]+id=['"]signupOtp['"][^>]+pattern=['"]\\d\{6\}['"]/);
    });

    it('UX-009.8: #forgotOtp has pattern="\\d{6}" to enforce 6 digits numeric format', () => {
      expect(loginHtml).toMatch(/<input[^>]+id=['"]forgotOtp['"][^>]+pattern=['"]\\d\{6\}['"]/);
    });

    it('UX-009.9: #signupOtp has inputmode="numeric" to trigger number pad on mobile', () => {
      expect(loginHtml).toMatch(/<input[^>]+id=['"]signupOtp['"][^>]+inputmode=['"]numeric['"]/);
    });

    it('UX-009.10: #forgotOtp has inputmode="numeric" to trigger number pad on mobile', () => {
      expect(loginHtml).toMatch(/<input[^>]+id=['"]forgotOtp['"][^>]+inputmode=['"]numeric['"]/);
    });

    it('UX-009.11: #signupOtp has autocomplete="one-time-code" for SMS/Email auto-fill detection', () => {
      expect(loginHtml).toMatch(/<input[^>]+id=['"]signupOtp['"][^>]+autocomplete=['"]one-time-code['"]/);
    });

    it('UX-009.12: #forgotOtp has autocomplete="one-time-code" for SMS/Email auto-fill detection', () => {
      expect(loginHtml).toMatch(/<input[^>]+id=['"]forgotOtp['"][^>]+autocomplete=['"]one-time-code['"]/);
    });

    it('UX-009.13: #signupOtp has maxlength="6"', () => {
      expect(loginHtml).toMatch(/<input[^>]+id=['"]signupOtp['"][^>]+maxlength=['"]6['"]/);
    });

    it('UX-009.14: #forgotOtp has maxlength="6"', () => {
      expect(loginHtml).toMatch(/<input[^>]+id=['"]forgotOtp['"][^>]+maxlength=['"]6['"]/);
    });

    it('UX-009.15: OTP field styling in style.css uses tabular numbers and letter spacing for readability', () => {
      expect(styleCss).toMatch(/\.auth-otp-input\s*\{[^}]*letter-spacing:\s*0\.5em;/);
      expect(styleCss).toMatch(/\.auth-otp-input\s*\{[^}]*text-align:\s*center;/);
      expect(styleCss).toMatch(/\.auth-otp-input\s*\{[^}]*font-variant-numeric:\s*tabular-nums;/);
    });

    it('UX-009.16: OTP input has enlarged font size (1.4rem) for mobile tap readability', () => {
      expect(styleCss).toMatch(/\.auth-otp-input\s*\{[^}]*font-size:\s*1\.4rem;/);
    });

    it('UX-009.17: Auto-advance does NOT submit the form automatically without password', () => {
      expect(loginHtml).not.toMatch(/signupOtp[\s\S]*?length\s*===\s*6[\s\S]*?signupVerifyForm\.submit\(\)/);
    });

    it('UX-009.18: Auto-advance listener handles delegating or direct attachment cleanly', () => {
      expect(loginHtml).toMatch(/signupOtp|forgotOtp|auth-otp-input/);
    });

    it('UX-009.19: Backspacing in password field does not trigger unwanted focus shift to OTP', () => {
      expect(loginHtml).not.toMatch(/signupPassword[\s\S]*?signupOtp\.focus\(\)/);
    });

    it('UX-009.20: Both signup and forgot verify screens share consistent auto-advance behavior', () => {
      expect(loginHtml).toMatch(/signupOtp/);
      expect(loginHtml).toMatch(/forgotOtp/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 10: UX-010 — Live Password Guidance & Microcopy (Tests 181–210)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('UX-010: Live Password Requirement Guidance & Microcopy', () => {
    // Why it matters: Telling the user "Must be at least 8 characters" prevents avoidable submission failures.
    it('UX-010.1: #screenSignupVerify contains password helper text element (.auth-field-hint)', () => {
      expect(loginHtml).toMatch(/auth-field-hint|signupPasswordHint/);
    });

    it('UX-010.2: #screenForgotVerify contains password helper text element (.auth-field-hint)', () => {
      expect(loginHtml).toMatch(/auth-field-hint|forgotPasswordHint/);
    });

    it('UX-010.3: Password helper text states "Must be at least 8 characters" or "Min 8 characters"', () => {
      expect(loginHtml).toMatch(/Must be at least 8 characters|Min 8 characters/i);
    });

    it('UX-010.4: Password helper is visible before submission in HTML template', () => {
      expect(loginHtml).toMatch(/<div class=['"][^'"]*auth-field-hint[^'"]*['"]|signupPasswordHint/);
    });

    it('UX-010.5: #signupPassword has aria-describedby pointing to password hint', () => {
      expect(loginHtml).toMatch(/<input[^>]+id=['"]signupPassword['"][^>]+aria-describedby=['"]signupPasswordHint['"]/);
    });

    it('UX-010.6: #forgotNewPassword has aria-describedby pointing to password hint', () => {
      expect(loginHtml).toMatch(/<input[^>]+id=['"]forgotNewPassword['"][^>]+aria-describedby=['"]forgotPasswordHint['"]/);
    });

    it('UX-010.7: Live input listener updates password hint class/state on #signupPassword', () => {
      expect(loginHtml).toMatch(/signupPassword[\s\S]*?(?:addEventListener\(['"]input['"]|auth-field-hint)/);
    });

    it('UX-010.8: Live input listener updates password hint class/state on #forgotNewPassword', () => {
      expect(loginHtml).toMatch(/forgotNewPassword[\s\S]*?(?:addEventListener\(['"]input['"]|auth-field-hint)/);
    });

    it('UX-010.9: Live validation checks value.length >= 8', () => {
      expect(loginHtml).toMatch(/length\s*>=\s*8/);
    });

    it('UX-010.10: Live validation toggles positive state class (e.g. .hint-met or .is-valid) on requirement met', () => {
      expect(loginHtml + styleCss).toMatch(/hint-met|is-valid|\.auth-field-hint\.valid/);
    });

    it('UX-010.11: CSS rules for .auth-field-hint define clean typography in style.css', () => {
      expect(styleCss).toMatch(/\.auth-field-hint/);
    });

    it('UX-010.12: .auth-field-hint font size is between 0.72rem and 0.82rem', () => {
      expect(styleCss).toMatch(/\.auth-field-hint\s*\{[^}]*font-size:\s*0\.(?:7[2-9]|8[0-2])rem/);
    });

    it('UX-010.13: .auth-field-hint default color uses var(--ink-dim)', () => {
      expect(styleCss).toMatch(/\.auth-field-hint\s*\{[^}]*color:\s*var\(--ink-dim\)/);
    });

    it('UX-010.14: .auth-field-hint positive state uses brand green or accent color', () => {
      expect(styleCss).toMatch(/\.auth-field-hint(?:\.hint-met|\.valid|\.ok)\s*\{[^}]*color:\s*var\(--good|--accent-orange\)/);
    });

    it('UX-010.15: Helper text does not overlap the absolute positioned .pw-toggle button', () => {
      expect(styleCss).toMatch(/\.password-field\s*\{[^}]*position:\s*relative/);
    });

    it('UX-010.16: Helper text is in pure English with zero mixed Hinglish', () => {
      expect(loginHtml).not.toMatch(/auth-field-hint[^>]*>[^<]*(?:kam se kam|hona chahiye)/i);
    });

    it('UX-010.17: Backend password verification in authRoutes.js enforces MIN_PASSWORD_LENGTH = 8', () => {
      expect(loginHtml + authJs).toMatch(/8/);
    });

    it('UX-010.18: Password placeholder text is clean and uncluttered ("Min 8 characters" or "Enter password")', () => {
      expect(loginHtml).toMatch(/placeholder=['"](?:Min 8 characters|Enter your password)['"]/);
    });

    it('UX-010.19: Submitting form with invalid password length triggers polite error message in status container', () => {
      expect(loginHtml).toMatch(/setStatus\(['"]signupVerifyStatus['"],\s*err\.message,\s*['"]err['"]\)/);
    });

    it('UX-010.20: Helper text remains responsive and legible on 320px small mobile displays', () => {
      expect(styleCss).toMatch(/\.auth-field-hint\s*\{[^}]*margin/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 11: Auth UI Polish Suite — Issues DES-001 to DES-034
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Auth UI Polish Suite — Issues DES-001 to DES-034', () => {
    // DES-025: Password-to-Submit Ghost Gap Collapse
    it('DES-025.1: style.css defines .status-msg:empty rule collapsing display, min-height, and margin', () => {
      expect(styleCss).toMatch(/\.status-msg:empty\s*\{[^}]*display:\s*none/);
      expect(styleCss).toMatch(/\.status-msg:empty\s*\{[^}]*min-height:\s*0/);
      expect(styleCss).toMatch(/\.status-msg:empty\s*\{[^}]*margin:\s*0/);
    });

    it('DES-025.2: .auth-forgot-row has tight vertical margins (margin <= 10px)', () => {
      expect(styleCss).toMatch(/\.auth-forgot-row\s*\{[^}]*margin:\s*2px\s+0\s+10px/);
    });

    // DES-028: Indian Mobile +91 Prefix Chip & Paste Sanitizer
    it('DES-028.1: #signupPhone is enclosed in a .phone-input-group container with .phone-prefix +91', () => {
      expect(loginHtml).toMatch(/<div class=['"]phone-input-group['"]>\s*<span class=['"]phone-prefix['"]>\+91<\/span>\s*<input[^>]+id=['"]signupPhone['"]/);
    });

    it('DES-028.2: style.css contains .phone-input-group and .phone-prefix styling rules', () => {
      expect(styleCss).toMatch(/\.phone-input-group\s*\{/);
      expect(styleCss).toMatch(/\.phone-prefix\s*\{/);
      expect(styleCss).toMatch(/\.phone-input-group:focus-within\s*\{[^}]*border-color:\s*var\(--accent-orange\)/);
    });

    it('DES-028.3: login.html includes paste and input sanitization for #signupPhone to strip non-digits and leading +91/0', () => {
      expect(loginHtml).toMatch(/signupPhone[\s\S]*?addEventListener\(['"]input['"]/);
      expect(loginHtml).toMatch(/signupPhone[\s\S]*?addEventListener\(['"]paste['"]/);
      expect(loginHtml).toMatch(/replace\(\/\\D\/g,\s*['"]['"]\)/);
    });

    // DES-029: Compact Header on Sub-Screens
    it('DES-029.1: showScreen() hides #authHeaderSub on non-login screens and shows it on login', () => {
      expect(loginHtml).toMatch(/authHeaderSub[\s\S]*?style\.display\s*=\s*['"]none['"]/);
      expect(loginHtml).toMatch(/authHeaderSub[\s\S]*?style\.display\s*=\s*['"]['"]/);
    });

    it('DES-029.2: showScreen() toggles .auth-header-compact class on .auth-header', () => {
      expect(loginHtml).toMatch(/auth-header-compact/);
    });

    it('DES-029.3: style.css defines .auth-header.auth-header-compact styles', () => {
      expect(styleCss).toMatch(/\.auth-header\.auth-header-compact\s*\{/);
      expect(styleCss).toMatch(/\.auth-header\.auth-header-compact\s+\.auth-logo\s*\{/);
    });

    // DES-003: 6-Digit OTP Formatting & Balanced Centering
    it('DES-003.1: .auth-otp-input has equal letter-spacing and text-indent for balanced optical centering', () => {
      expect(styleCss).toMatch(/\.auth-otp-input\s*\{[^}]*letter-spacing:\s*0\.5em/);
      expect(styleCss).toMatch(/\.auth-otp-input\s*\{[^}]*text-indent:\s*0\.5em/);
    });

    // DES-030: Resend OTP Relocated Below Input
    it('DES-030.1: #signupResendOtp is located in .auth-otp-resend-row directly under #signupOtp', () => {
      const signupVerifyMatch = loginHtml.match(/id=['"]screenSignupVerify['"][^>]*>([\s\S]*?)<\/form>/);
      expect(signupVerifyMatch).toBeTruthy();
      expect(signupVerifyMatch[1]).toMatch(/class=['"]auth-otp-resend-row['"][\s\S]*?id=['"]signupResendOtp['"]/);
    });

    it('DES-030.2: #forgotResendOtp is located in .auth-otp-resend-row directly under #forgotOtp', () => {
      const forgotVerifyMatch = loginHtml.match(/id=['"]screenForgotVerify['"][^>]*>([\s\S]*?)<\/form>/);
      expect(forgotVerifyMatch).toBeTruthy();
      expect(forgotVerifyMatch[1]).toMatch(/class=['"]auth-otp-resend-row['"][\s\S]*?id=['"]forgotResendOtp['"]/);
    });

    it('DES-030.3: style.css defines .auth-otp-resend-row flex layout and text-link sizing', () => {
      expect(styleCss).toMatch(/\.auth-otp-resend-row\s*\{/);
      expect(styleCss).toMatch(/\.auth-otp-resend-row\s+\.text-link\s*\{/);
    });

    // DES-033: Neutral Google Sign-In Button Hover State
    it('DES-033.1: style.css defines explicit neutral hover state for #googleBtn with --panel-2 background', () => {
      expect(styleCss).toMatch(/\.auth-card\s+#googleBtn:hover/);
      expect(styleCss).toMatch(/#googleBtn:hover[^{]*\{[^}]*background:\s*var\(--panel-2\)/);
    });

    // DES-034: Password Validation Pop-in Checkmark Animation
    it('DES-034.1: style.css defines @keyframes popCheck and .auth-field-hint checkmark pseudo-element', () => {
      expect(styleCss).toMatch(/@keyframes\s+popCheck/);
      expect(styleCss).toMatch(/\.auth-field-hint(?:\.hint-met|\.valid)::before\s*\{[^}]*content:\s*['"]✓\s*['"]/);
    });

    // DES-004: Tap Target Accessibility
    it('DES-004.1: .auth-consent label has min-height of at least 40px', () => {
      expect(styleCss).toMatch(/\.auth-consent\s+label\s*\{[^}]*min-height:\s*40px/);
    });

    // DES-002: Reduced Motion Accessibility Support
    it('DES-002.1: style.css includes @media (prefers-reduced-motion: reduce) rule disabling animations', () => {
      expect(styleCss).toMatch(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{[\s\S]*?\.auth-card-enter/);
    });
  });
});
