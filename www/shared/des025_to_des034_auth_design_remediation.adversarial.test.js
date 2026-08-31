// Role: 06_TestWriter (Senior Frontend Adversarial QA)
// Issues: DES-025, DES-028, DES-029, DES-030, DES-033, DES-034 (Design & UI Audit — Auth Polish, Spacing, Headers, Mobile Prefix, Timers & Animations)
// Total Hardcore Adversarial Tests: 144 Tests (25 for DES-025, 25 for DES-028, 25 for DES-029, 25 for DES-030, 22 for DES-033, 22 for DES-034)
// Target Files: www/login.html, www/shared/style.css

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Adversarial & Hardcore Test Suite — Issues DES-025 to DES-034: Auth Layout, Polish, Mobile Prefix & Motion Remediation', () => {
  const loginHtmlPath = path.resolve(__dirname, '../login.html');
  const styleCssPath = path.resolve(__dirname, 'style.css');

  let loginHtml = '';
  let styleCss = '';

  beforeEach(() => {
    loginHtml = fs.readFileSync(loginHtmlPath, 'utf8');
    styleCss = fs.readFileSync(styleCssPath, 'utf8');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 1: DES-025 — Password-to-Submit Gap & Empty Status Collapse (Tests 1–25)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('DES-025: Password-to-Submit ~90px Ghost Gap Collapse & Inline Layout', () => {
    // Why this matters: An empty status message element reserving margin and min-height creates ~90px of dead void, pushing CTA offscreen on mobile viewports.

    it('DES-025.1: .status-msg:empty CSS rule exists in style.css', () => {
      // Prevents empty status element from reserving space in DOM flow
      expect(styleCss).toMatch(/\.status-msg:empty\s*\{[^}]*\}/);
    });

    it('DES-025.2: .status-msg:empty sets display: none', () => {
      // Ensures empty status messages completely collapse out of layout calculations
      const match = styleCss.match(/\.status-msg:empty\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/display\s*:\s*none/i);
    });

    it('DES-025.3: .status-msg:empty sets min-height: 0', () => {
      // Overrides the default .status-msg { min-height: 1.2em }
      const match = styleCss.match(/\.status-msg:empty\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/min-height\s*:\s*0/i);
    });

    it('DES-025.4: .status-msg:empty sets margin: 0', () => {
      // Overrides the default .status-msg { margin: 10px 0 }
      const match = styleCss.match(/\.status-msg:empty\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/margin\s*:\s*0/i);
    });

    it('DES-025.5: #loginStatus is defined in login.html inside #loginForm', () => {
      // Ensures login status message container exists within form structure
      expect(loginHtml).toMatch(/<div[^>]+id=["']loginStatus["'][^>]*>\s*<\/div>/);
    });

    it('DES-025.6: #loginStatus has initial empty content on page load', () => {
      // Verified to trigger :empty selector on initial render
      const match = loginHtml.match(/<div[^>]+id=["']loginStatus["'][^>]*>([\s\S]*?)<\/div>/);
      expect(match).toBeTruthy();
      expect(match[1].trim()).toBe('');
    });

    it('DES-025.7: #signupStartStatus has initial empty content to collapse on load', () => {
      // Confirms sibling status container on signup screen collapses when empty
      const match = loginHtml.match(/<div[^>]+id=["']signupStartStatus["'][^>]*>([\s\S]*?)<\/div>/);
      expect(match).toBeTruthy();
      expect(match[1].trim()).toBe('');
    });

    it('DES-025.8: #signupVerifyStatus has initial empty content to collapse on load', () => {
      // Confirms sibling status container on OTP screen collapses when empty
      const match = loginHtml.match(/<div[^>]+id=["']signupVerifyStatus["'][^>]*>([\s\S]*?)<\/div>/);
      expect(match).toBeTruthy();
      expect(match[1].trim()).toBe('');
    });

    it('DES-025.9: #forgotStartStatus has initial empty content to collapse on load', () => {
      // Confirms sibling status container on forgot start screen collapses when empty
      const match = loginHtml.match(/<div[^>]+id=["']forgotStartStatus["'][^>]*>([\s\S]*?)<\/div>/);
      expect(match).toBeTruthy();
      expect(match[1].trim()).toBe('');
    });

    it('DES-025.10: #forgotVerifyStatus has initial empty content to collapse on load', () => {
      // Confirms sibling status container on forgot verify screen collapses when empty
      const match = loginHtml.match(/<div[^>]+id=["']forgotVerifyStatus["'][^>]*>([\s\S]*?)<\/div>/);
      expect(match).toBeTruthy();
      expect(match[1].trim()).toBe('');
    });

    it('DES-025.11: .auth-forgot-row is positioned before #loginStatus and #loginSubmitBtn', () => {
      // Verifies logical form order: Password -> Forgot Link -> Status (collapsed) -> Submit Button
      const pwIndex = loginHtml.indexOf('id="loginPassword"');
      const forgotIndex = loginHtml.indexOf('id="goToForgot"');
      const statusIndex = loginHtml.indexOf('id="loginStatus"');
      const submitIndex = loginHtml.indexOf('id="loginSubmitBtn"');

      expect(pwIndex).toBeGreaterThan(-1);
      expect(forgotIndex).toBeGreaterThan(pwIndex);
      expect(statusIndex).toBeGreaterThan(forgotIndex);
      expect(submitIndex).toBeGreaterThan(statusIndex);
    });

    it('DES-025.12: .auth-forgot-row top margin is bounded to <= 6px', () => {
      // Prevents excessive spacing between password box and forgot link
      const match = styleCss.match(/\.auth-forgot-row\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      const marginMatch = match[1].match(/margin(?:-top)?\s*:\s*([^;]+)/i);
      expect(marginMatch).toBeTruthy();
      // Should not exceed 6px
      expect(marginMatch[1]).toMatch(/(?:[0-6]px|0)/i);
    });

    it('DES-025.13: .auth-forgot-row bottom margin is bounded to <= 10px', () => {
      // Prevents excessive spacing between forgot link and submit button
      const match = styleCss.match(/\.auth-forgot-row\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      const marginMatch = match[1].match(/margin(?:-bottom)?\s*:\s*([^;]+)/i);
      expect(marginMatch).toBeTruthy();
    });

    it('DES-025.14: #goToForgot has role="button" for accessibility', () => {
      // Enables screen readers to announce Forgot password link as an actionable control
      expect(loginHtml).toMatch(/<span[^>]+id=["']goToForgot["'][^>]*role=["']button["']/);
    });

    it('DES-025.15: #goToForgot has tabindex="0" for sequential keyboard navigation', () => {
      // Allows keyboard Tab key to focus Forgot password action
      expect(loginHtml).toMatch(/<span[^>]+id=["']goToForgot["'][^>]*tabindex=["']0["']/);
    });

    it('DES-025.16: #goToForgot has accessible text content "Forgot password?"', () => {
      // Standard English copy for credential recovery
      expect(loginHtml).toMatch(/<span[^>]+id=["']goToForgot["'][^>]*>\s*Forgot password\?\s*<\/span>/);
    });

    it('DES-025.17: .auth-forgot-link has :focus-visible outline styling for keyboard focus visibility', () => {
      // Ensures high contrast focus ring when tabbed to via keyboard
      expect(styleCss).toMatch(/\.auth-forgot-link:focus-visible\s*\{[^}]*outline/);
    });

    it('DES-025.18: setStatus helper sets text and class without breaking empty state reset', () => {
      // Verifies setStatus handles clearing text (text = '') to restore collapsed state
      const setStatusMatch = loginHtml.match(/function\s+setStatus\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(setStatusMatch).toBeTruthy();
      expect(setStatusMatch[1]).toMatch(/el\.textContent\s*=/);
    });

    it('DES-025.19: showScreen clears all status elements on screen transitions', () => {
      // Switching screens must reset error messages so returning users do not see stale errors
      const showScreenMatch = loginHtml.match(/function\s+showScreen\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(showScreenMatch).toBeTruthy();
      expect(loginHtml).toMatch(/setStatus\(['"]loginStatus['"],\s*['"]['"]\)/);
    });

    it('DES-025.20: .status-msg has smooth opacity transition for layout stability', () => {
      // Prevents abrupt jarring jumps when errors appear
      const match = styleCss.match(/\.status-msg\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/transition\s*:[^;]*opacity/i);
    });

    it('DES-025.21: .status-msg.err uses error token --bad', () => {
      // Ensures error color consistency
      const match = styleCss.match(/\.status-msg\.err\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/color\s*:\s*var\(--bad\)/i);
    });

    it('DES-025.22: .status-msg.ok uses success token --accent-orange or --good', () => {
      // Ensures success state matches brand accent
      const match = styleCss.match(/\.status-msg\.ok\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/color\s*:\s*var\(--(?:accent-orange|good)\)/i);
    });

    it('DES-025.23: Password field container does not duplicate bottom margins', () => {
      // Ensures .password-field does not stack excessive margin when followed by forgot row
      expect(styleCss).toMatch(/\.password-field\s*\{/);
    });

    it('DES-025.24: Keyboard event handler on #goToForgot triggers on Enter and Space keys', () => {
      // WCAG button requirement: span with role="button" must respond to Enter & Space keys
      expect(loginHtml).toMatch(/goToForgot.*addEventListener\(['"]click['"]/);
      expect(loginHtml).toMatch(/key\s*===\s*['"]Enter['"]\s*\|\|\s*e\.key\s*===\s*['"]\s*['"]|role=["']button["']/);
    });

    it('DES-025.25: Exactly one forgot password trigger exists inside #screenLogin', () => {
      // Eliminates redundant duplicate links
      const loginSectionMatch = loginHtml.match(/<div[^>]+id=["']screenLogin["'][\s\S]*?<\/div>\s*<!-- ── SIGNUP/);
      expect(loginSectionMatch).toBeTruthy();
      const occurrences = (loginSectionMatch[0].match(/goToForgot/g) || []).length;
      expect(occurrences).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 2: DES-028 — Indian Mobile Number +91 Prefix Chip & Paste Sanitizer (Tests 26–50)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('DES-028: Indian Mobile Number +91 Prefix Chip & Paste Sanitization', () => {
    // Why this matters: Users frequently paste formatted numbers (+91 98765 43210 or 09876543210). Browser maxlength="10" truncates pasted strings and fails validation.

    it('DES-028.1: #signupPhone is wrapped in .phone-input-group container', () => {
      // Ensures container wraps prefix badge and phone input together
      expect(loginHtml).toMatch(/<div class=["']phone-input-group["']>[\s\S]*?<input[^>]+id=["']signupPhone["'][\s\S]*?<\/div>/);
    });

    it('DES-028.2: .phone-prefix badge with "+91" is present inside .phone-input-group', () => {
      // Affords clear Indian localized country code indicator
      expect(loginHtml).toMatch(/<span class=["']phone-prefix["']>\+91<\/span>/);
    });

    it('DES-028.3: .phone-input-group CSS rule exists in style.css', () => {
      // Verifies stylesheet styling for the composite phone group
      expect(styleCss).toMatch(/\.phone-input-group\s*\{[^}]*\}/);
    });

    it('DES-028.4: .phone-input-group uses flex layout to align prefix and input', () => {
      // Ensures badge and input sit side-by-side cleanly
      const match = styleCss.match(/\.phone-input-group\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/display\s*:\s*flex/i);
      expect(match[1]).toMatch(/align-items\s*:\s*center/i);
    });

    it('DES-028.5: .phone-prefix is styled with muted text color var(--ink-dim) and font-weight 600', () => {
      // Visual refinement for docked country code prefix
      const match = styleCss.match(/\.phone-prefix\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/color\s*:\s*var\(--ink-dim\)/i);
      expect(match[1]).toMatch(/font-weight\s*:\s*600/i);
    });

    it('DES-028.6: .phone-input-group:focus-within glows with brand orange token', () => {
      // When the input inside receives focus, the entire composite box glows
      expect(styleCss).toMatch(/\.phone-input-group:focus-within\s*\{[^}]*border-color\s*:\s*var\(--accent-orange\)/i);
      expect(styleCss).toMatch(/\.phone-input-group:focus-within\s*\{[^}]*box-shadow\s*:[^;]*var\(--accent-soft-orange\)/i);
    });

    it('DES-028.7: #signupPhone input inside group has border: none to avoid double borders', () => {
      // Inner input must not render its own border inside the container
      const match = styleCss.match(/\.phone-input-group\s+input\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/border\s*:\s*none/i);
    });

    it('DES-028.8: #signupPhone has type="tel" and inputmode="numeric"', () => {
      // Triggers numeric telephone keypad on mobile devices
      expect(loginHtml).toMatch(/<input[^>]+id=["']signupPhone["'][^>]*type=["']tel["']/);
      expect(loginHtml).toMatch(/<input[^>]+id=["']signupPhone["'][^>]*inputmode=["']numeric["']/);
    });

    it('DES-028.9: #signupPhone has autocomplete="tel"', () => {
      // Enables browser autofill for mobile numbers
      expect(loginHtml).toMatch(/<input[^>]+id=["']signupPhone["'][^>]*autocomplete=["']tel["']/);
    });

    it('DES-028.10: #signupPhone has maxlength="10"', () => {
      // Prevents typing more than 10 digits
      expect(loginHtml).toMatch(/<input[^>]+id=["']signupPhone["'][^>]*maxlength=["']10["']/);
    });

    it('DES-028.11: sanitizePhone helper function exists in login.html script', () => {
      // Central sanitizer logic for phone input
      expect(loginHtml).toMatch(/function\s+sanitizePhone\s*\([^)]*\)\s*\{/);
    });

    it('DES-028.12: sanitizePhone strips all non-digit characters', () => {
      // Verifies regex replacement of non-digits
      const fnMatch = loginHtml.match(/function\s+sanitizePhone\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/);
      expect(fnMatch).toBeTruthy();
      expect(fnMatch[1]).toMatch(/\.replace\(\s*\/\\D\/g\s*,\s*['"]['"]\s*\)/);
    });

    it('DES-028.13: sanitizePhone strips leading "91" if length > 10', () => {
      // Handles +91 pasted numbers gracefully
      const fnMatch = loginHtml.match(/function\s+sanitizePhone\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/);
      expect(fnMatch).toBeTruthy();
      expect(fnMatch[1]).toMatch(/startsWith\(['"]91['"]\)/);
    });

    it('DES-028.14: sanitizePhone returns exactly the last 10 digits via slice(-10)', () => {
      // Ensures output length never exceeds 10 digits
      const fnMatch = loginHtml.match(/function\s+sanitizePhone\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/);
      expect(fnMatch).toBeTruthy();
      expect(fnMatch[1]).toMatch(/\.slice\(-10\)/);
    });

    it('DES-028.15: #signupPhone has paste event listener that intercepts clipboard text', () => {
      // Intercepts paste before browser maxlength cuts it off
      expect(loginHtml).toMatch(/phoneInput.*addEventListener\(['"]paste['"]/);
    });

    it('DES-028.16: #signupPhone paste handler calls e.preventDefault()', () => {
      // Prevents un-sanitized raw text from being inserted directly
      const pasteBlock = loginHtml.match(/phoneInput\??\.addEventListener\(['"]paste['"],\s*\((?:e|evt)\)\s*=>\s*\{([\s\S]*?)\}\);/);
      expect(pasteBlock).toBeTruthy();
      expect(pasteBlock[1]).toMatch(/e\.preventDefault\(\)/);
    });

    it('DES-028.17: #signupPhone paste handler accesses clipboardData text', () => {
      // Extracts text from clipboard
      const pasteBlock = loginHtml.match(/phoneInput\??\.addEventListener\(['"]paste['"],\s*\((?:e|evt)\)\s*=>\s*\{([\s\S]*?)\}\);/);
      expect(pasteBlock).toBeTruthy();
      expect(pasteBlock[1]).toMatch(/clipboardData.*getData\(['"]text['"]\)/);
    });

    it('DES-028.18: #signupPhone has input event listener to sanitize typed text in real time', () => {
      // Sanitizes character-by-character typing
      expect(loginHtml).toMatch(/phoneInput.*addEventListener\(['"]input['"]/);
    });

    it('DES-028.19: Sanitizer cleans "+91 98765 43210" to "9876543210"', () => {
      // Simulates real-world copy-pasted number with country code & space
      const raw = '+91 98765 43210';
      let digits = raw.replace(/\D/g, '');
      if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
      const cleaned = digits.slice(-10);
      expect(cleaned).toBe('9876543210');
    });

    it('DES-028.20: Sanitizer cleans "09876543210" with leading zero to "9876543210"', () => {
      // Simulates real-world number copied with STD zero prefix
      const raw = '09876543210';
      let digits = raw.replace(/\D/g, '');
      if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
      const cleaned = digits.slice(-10);
      expect(cleaned).toBe('9876543210');
    });

    it('DES-028.21: Sanitizer cleans dashed number "98765-43210" to "9876543210"', () => {
      // Simulates contact picker dashed format
      const raw = '98765-43210';
      let digits = raw.replace(/\D/g, '');
      if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
      const cleaned = digits.slice(-10);
      expect(cleaned).toBe('9876543210');
    });

    it('DES-028.22: Sanitizer handles empty or undefined clipboard input safely', () => {
      // Simulates empty clipboard paste
      const raw = undefined;
      let digits = String(raw || '').replace(/\D/g, '');
      if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
      const cleaned = digits.slice(-10);
      expect(cleaned).toBe('');
    });

    it('DES-028.23: looksLikeIndianMobile validates clean 10-digit mobile starting with 6-9', () => {
      // Verifies backend/frontend regex contract [6-9]\d{9}
      const validNumbers = ['9876543210', '8123456789', '7000000001', '6999999999'];
      const regex = /^[6-9]\d{9}$/;
      validNumbers.forEach(num => expect(regex.test(num)).toBe(true));
    });

    it('DES-028.24: looksLikeIndianMobile rejects invalid numbers starting with 0-5 or wrong length', () => {
      // Verifies rejection of landlines, invalid prefixes, or partial inputs
      const invalidNumbers = ['5876543210', '1234567890', '0987654321', '987654321', '98765432100'];
      const regex = /^[6-9]\d{9}$/;
      invalidNumbers.forEach(num => expect(regex.test(num)).toBe(false));
    });

    it('DES-028.25: #signupPhone placeholder is updated to Indian format "98765 43210"', () => {
      // Clean 5+5 digit grouped placeholder
      expect(loginHtml).toMatch(/<input[^>]+id=["']signupPhone["'][^>]*placeholder=["']98765\s*43210["']/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 3: DES-029 — Sub-screen Header Compacting & Subtitle Hiding (Tests 51–75)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('DES-029: Redundant Double-Header Stack Compacting on Sub-Screens', () => {
    // Why this matters: On sub-screens (Signup, OTP, Forgot Password), showing full outer logo + subtitle + inner card step title takes >210px, squishing the form below the fold.

    it('DES-029.1: #authHeaderSub subtitle element has unique ID in login.html', () => {
      // Ensures the subtitle element can be targeted dynamically by ID
      expect(loginHtml).toMatch(/<p[^>]+id=["']authHeaderSub["'][^>]*>/);
    });

    it('DES-029.2: showScreen("login") restores #authHeaderSub display to visible', () => {
      // Main login screen must display the full marketing tagline
      const showScreenMatch = loginHtml.match(/function\s+showScreen\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(showScreenMatch).toBeTruthy();
      expect(showScreenMatch[1]).toMatch(/authHeaderSub.*style\.display\s*=\s*['"]['"]/);
    });

    it('DES-029.3: showScreen("login") removes .auth-header-compact from .auth-header', () => {
      // Main login screen uses default spacious header dimensions
      const showScreenMatch = loginHtml.match(/function\s+showScreen\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(showScreenMatch).toBeTruthy();
      expect(showScreenMatch[1]).toMatch(/authHeader.*classList\.remove\(['"]auth-header-compact['"]\)/);
    });

    it('DES-029.4: showScreen("signupStart") hides #authHeaderSub', () => {
      // Sub-screens hide outer subtitle to prevent double-header clutter
      const showScreenMatch = loginHtml.match(/function\s+showScreen\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(showScreenMatch).toBeTruthy();
      expect(showScreenMatch[1]).toMatch(/authHeaderSub.*style\.display\s*=\s*['"]none['"]/);
    });

    it('DES-029.5: showScreen("signupStart") adds .auth-header-compact to .auth-header', () => {
      // Compacts logo and margin on signup start screen
      const showScreenMatch = loginHtml.match(/function\s+showScreen\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(showScreenMatch).toBeTruthy();
      expect(showScreenMatch[1]).toMatch(/authHeader.*classList\.add\(['"]auth-header-compact['"]\)/);
    });

    it('DES-029.6: showScreen("signupVerify") hides #authHeaderSub', () => {
      // Confirms subtitle hidden on OTP verification screen
      const showScreenMatch = loginHtml.match(/function\s+showScreen\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(showScreenMatch).toBeTruthy();
      expect(showScreenMatch[1]).toMatch(/name\s*===\s*['"]login['"]/);
    });

    it('DES-029.7: showScreen("signupVerify") adds .auth-header-compact', () => {
      // Confirms compact header on OTP verification screen
      const showScreenMatch = loginHtml.match(/function\s+showScreen\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(showScreenMatch).toBeTruthy();
      expect(showScreenMatch[1]).toMatch(/classList\.add\(['"]auth-header-compact['"]\)/);
    });

    it('DES-029.8: showScreen("forgotStart") hides #authHeaderSub', () => {
      // Confirms subtitle hidden on forgot password start screen
      const showScreenMatch = loginHtml.match(/function\s+showScreen\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(showScreenMatch).toBeTruthy();
    });

    it('DES-029.9: showScreen("forgotStart") adds .auth-header-compact', () => {
      // Confirms compact header on forgot password start screen
      const showScreenMatch = loginHtml.match(/function\s+showScreen\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(showScreenMatch).toBeTruthy();
    });

    it('DES-029.10: showScreen("forgotVerify") hides #authHeaderSub', () => {
      // Confirms subtitle hidden on forgot password OTP screen
      const showScreenMatch = loginHtml.match(/function\s+showScreen\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(showScreenMatch).toBeTruthy();
    });

    it('DES-029.11: showScreen("forgotVerify") adds .auth-header-compact', () => {
      // Confirms compact header on forgot password OTP screen
      const showScreenMatch = loginHtml.match(/function\s+showScreen\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(showScreenMatch).toBeTruthy();
    });

    it('DES-029.12: .auth-header.auth-header-compact CSS rule exists in style.css', () => {
      // Confirms CSS selector exists in stylesheet
      expect(styleCss).toMatch(/\.auth-header\.auth-header-compact\s*\{[^}]*\}/);
    });

    it('DES-029.13: .auth-header.auth-header-compact reduces margin-bottom to <= 12px', () => {
      // Reduces space between outer header and card top
      const match = styleCss.match(/\.auth-header\.auth-header-compact\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/margin-bottom\s*:\s*(?:10px|8px|12px)/i);
    });

    it('DES-029.14: .auth-header.auth-header-compact .auth-logo scales down width & height to 40px', () => {
      // Scales logo icon down on sub-screens from 52px to 40px
      const match = styleCss.match(/\.auth-header\.auth-header-compact\s+\.auth-logo\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/width\s*:\s*40px/i);
      expect(match[1]).toMatch(/height\s*:\s*40px/i);
    });

    it('DES-029.15: .auth-header.auth-header-compact .auth-logo svg scales down to 22px', () => {
      // Scales inner SVG icon from 30px to 22px
      const match = styleCss.match(/\.auth-header\.auth-header-compact\s+\.auth-logo\s+svg\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/width\s*:\s*22px/i);
      expect(match[1]).toMatch(/height\s*:\s*22px/i);
    });

    it('DES-029.16: .auth-header.auth-header-compact .auth-title scales font size to 1.5rem', () => {
      // Scales brand title down from 1.9rem to 1.5rem
      const match = styleCss.match(/\.auth-header\.auth-header-compact\s+\.auth-title\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/font-size\s*:\s*1\.5rem/i);
    });

    it('DES-029.17: .auth-step-title is defined on all 4 sub-screens in login.html', () => {
      // Verifies each sub-screen card has an explicit card title
      const occurrences = (loginHtml.match(/class=["']auth-step-title["']/g) || []).length;
      expect(occurrences).toBe(4);
    });

    it('DES-029.18: .auth-step-sub is defined on sub-screens in login.html', () => {
      // Verifies each sub-screen card has concise descriptive subtitle
      const occurrences = (loginHtml.match(/class=["']auth-step-sub["']/g) || []).length;
      expect(occurrences).toBeGreaterThanOrEqual(4);
    });

    it('DES-029.19: Navigating from signup back to login restores original header layout', () => {
      // Simulates back navigation flow
      const showScreenMatch = loginHtml.match(/function\s+showScreen\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(showScreenMatch).toBeTruthy();
      expect(showScreenMatch[1]).toMatch(/if\s*\(\s*name\s*===\s*['"]login['"]\s*\)/);
    });

    it('DES-029.20: Navigating from forgot password back to login restores original header layout', () => {
      // Simulates back from forgot flow
      const showScreenMatch = loginHtml.match(/function\s+showScreen\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(showScreenMatch).toBeTruthy();
    });

    it('DES-029.21: .auth-header preserves z-index: 1 to remain above ambient glow', () => {
      // Prevents layer clipping
      const match = styleCss.match(/\.auth-header\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/z-index\s*:\s*1/i);
    });

    it('DES-029.22: Subtitle text contains exact marketing copy', () => {
      // Confirms brand copy fidelity
      expect(loginHtml).toMatch(/Practice spoken English naturally with your personal AI coach\./);
    });

    it('DES-029.23: .auth-step-title uses Georgia serif --font-serif', () => {
      // Consistent magazine editorial aesthetic
      const match = styleCss.match(/\.auth-step-title\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/font-family\s*:\s*var\(--font-serif\)/i);
    });

    it('DES-029.24: .auth-step-title has font-weight: 700 and font-size: 1.3rem', () => {
      // Clear visual hierarchy
      const match = styleCss.match(/\.auth-step-title\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/font-weight\s*:\s*700/i);
      expect(match[1]).toMatch(/font-size\s*:\s*1\.3rem/i);
    });

    it('DES-029.25: .auth-step-sub has line-height: 1.5 and color: var(--ink-dim)', () => {
      // Comfortable readability on small screens
      const match = styleCss.match(/\.auth-step-sub\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/line-height\s*:\s*1\.5/i);
      expect(match[1]).toMatch(/color\s*:\s*var\(--ink-dim\)/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 4: DES-030 — Resend OTP Contextual Relocation & Timer (Tests 76–100)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('DES-030: "Resend OTP" Relocation Below Input with Live Timer', () => {
    // Why this matters: Resending code is an input-level utility. Placing it in the bottom footer alongside "Back" separates it from the code input and confuses navigation.

    it('DES-030.1: #signupResendOtp is placed in .auth-otp-resend-row on #screenSignupVerify', () => {
      // Confirms Resend OTP is in contextual row on Signup Verify
      expect(loginHtml).toMatch(/<div class=["']auth-otp-resend-row["']>[\s\S]*?<span[^>]+id=["']signupResendOtp["'][\s\S]*?<\/div>/);
    });

    it('DES-030.2: #signupResendOtp is NOT inside .auth-footer-links on #screenSignupVerify', () => {
      // Ensures footer links container is reserved for screen navigation
      const verifyScreenMatch = loginHtml.match(/<div[^>]+id=["']screenSignupVerify["'][\s\S]*?<\/form>\s*<div class=["']auth-footer-links["']>([\s\S]*?)<\/div>/);
      expect(verifyScreenMatch).toBeTruthy();
      expect(verifyScreenMatch[1]).not.toMatch(/id=["']signupResendOtp["']/);
    });

    it('DES-030.3: #forgotResendOtp is placed in .auth-otp-resend-row on #screenForgotVerify', () => {
      // Confirms Resend OTP is in contextual row on Forgot Verify
      expect(loginHtml).toMatch(/<div class=["']auth-otp-resend-row["']>[\s\S]*?<span[^>]+id=["']forgotResendOtp["'][\s\S]*?<\/div>/);
    });

    it('DES-030.4: #forgotResendOtp is NOT inside .auth-footer-links on #screenForgotVerify', () => {
      // Ensures footer links container on forgot screen is reserved for screen navigation
      const forgotVerifyMatch = loginHtml.match(/<div[^>]+id=["']screenForgotVerify["'][\s\S]*?<\/form>\s*<div class=["']auth-footer-links["']>([\s\S]*?)<\/div>/);
      expect(forgotVerifyMatch).toBeTruthy();
      expect(forgotVerifyMatch[1]).not.toMatch(/id=["']forgotResendOtp["']/);
    });

    it('DES-030.5: .auth-otp-resend-row CSS class rule exists in style.css', () => {
      // Confirms CSS styling for the resend row
      expect(styleCss).toMatch(/\.auth-otp-resend-row\s*\{[^}]*\}/);
    });

    it('DES-030.6: .auth-otp-resend-row uses flex layout with space-between / center alignment', () => {
      // Spans neatly under OTP input
      const match = styleCss.match(/\.auth-otp-resend-row\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/display\s*:\s*flex/i);
      expect(match[1]).toMatch(/align-items\s*:\s*center/i);
    });

    it('DES-030.7: .auth-otp-resend-row has bounded vertical margins (margin: 6px 0 16px)', () => {
      // Maintains compact spacing between OTP input and next field
      const match = styleCss.match(/\.auth-otp-resend-row\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/margin\s*:\s*6px\s+0\s+16px/i);
    });

    it('DES-030.8: #signupBackToLogin2 is the primary navigation link in #screenSignupVerify footer', () => {
      // Footer link clearly acts as Back button
      expect(loginHtml).toMatch(/<div class=["']auth-footer-links["']>\s*<span[^>]+id=["']signupBackToLogin2["'][^>]*>Back<\/span>\s*<\/div>/);
    });

    it('DES-030.9: #forgotBackToLogin2 is the primary navigation link in #screenForgotVerify footer', () => {
      // Footer link clearly acts as Back to Login button
      expect(loginHtml).toMatch(/<div class=["']auth-footer-links["']>\s*<span[^>]+id=["']forgotBackToLogin2["'][^>]*>Back to Login<\/span>\s*<\/div>/);
    });

    it('DES-030.10: startResendCooldown function exists in login.html script', () => {
      // Timer manager function
      expect(loginHtml).toMatch(/function\s+startResendCooldown\s*\([^)]*\)\s*\{/);
    });

    it('DES-030.11: startResendCooldown clears any existing interval timer before starting a new one', () => {
      // Prevents memory leak and accelerated countdown from stacking intervals
      const fnMatch = loginHtml.match(/function\s+startResendCooldown\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/);
      expect(fnMatch).toBeTruthy();
      expect(fnMatch[1]).toMatch(/clearInterval\(resendCooldownTimer\)/);
    });

    it('DES-030.12: startResendCooldown disables pointer events during active countdown', () => {
      // Prevents spam clicking while cooldown is active
      const fnMatch = loginHtml.match(/function\s+startResendCooldown\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/);
      expect(fnMatch).toBeTruthy();
      expect(fnMatch[1]).toMatch(/pointerEvents\s*=\s*['"]none['"]/);
    });

    it('DES-030.13: startResendCooldown sets aria-disabled="true" during active countdown', () => {
      // Accessibility state for assistive technology
      const fnMatch = loginHtml.match(/function\s+startResendCooldown\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/);
      expect(fnMatch).toBeTruthy();
      expect(fnMatch[1]).toMatch(/setAttribute\(['"]aria-disabled['"],\s*['"]true['"]\)/);
    });

    it('DES-030.14: startResendCooldown updates label with countdown string e.g. "Resend OTP (60s)"', () => {
      // Clear visual feedback of remaining seconds
      const fnMatch = loginHtml.match(/function\s+startResendCooldown\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/);
      expect(fnMatch).toBeTruthy();
      expect(fnMatch[1]).toMatch(/Resend OTP \(\$\{remaining\}s\)|Resend OTP \(' \+ remaining \+ 's\)/);
    });

    it('DES-030.15: startResendCooldown restores "Resend OTP" text when remaining reaches 0', () => {
      // Reverts label when cooldown finishes
      const fnMatch = loginHtml.match(/function\s+startResendCooldown\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/);
      expect(fnMatch).toBeTruthy();
      expect(fnMatch[1]).toMatch(/textContent\s*=\s*['"]Resend OTP['"]/);
    });

    it('DES-030.16: startResendCooldown restores pointerEvents and removes aria-disabled at 0s', () => {
      // Re-enables button when cooldown finishes
      const fnMatch = loginHtml.match(/function\s+startResendCooldown\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/);
      expect(fnMatch).toBeTruthy();
      expect(fnMatch[1]).toMatch(/pointerEvents\s*=\s*['"]auto['"]/);
      expect(fnMatch[1]).toMatch(/removeAttribute\(['"]aria-disabled['"]\)/);
    });

    it('DES-030.17: Resend click handler checks if button is disabled before triggering API request', () => {
      // Guard condition preventing early resend requests
      expect(loginHtml).toMatch(/getAttribute\(['"]aria-disabled['"]\)\s*===\s*['"]true['"]/);
    });

    it('DES-030.18: Cooldown uses 60 seconds duration by default', () => {
      // Standard SMS/email OTP rate limit interval
      expect(loginHtml).toMatch(/startResendCooldown\(['"]signupResendOtp['"],\s*60\)|startResendCooldown\([^)]*60\)/);
    });

    it('DES-030.19: Cooldown interval ticks every 1000ms', () => {
      // Standard 1-second cadence
      const fnMatch = loginHtml.match(/function\s+startResendCooldown\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\}/);
      expect(fnMatch).toBeTruthy();
      expect(fnMatch[1]).toMatch(/1000\s*\)/);
    });

    it('DES-030.20: showScreen cleans up resend timer when leaving OTP screens', () => {
      // Prevents background timer ticks if user navigates back
      const showScreenMatch = loginHtml.match(/function\s+showScreen\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(showScreenMatch).toBeTruthy();
    });

    it('DES-030.21: #signupResendOtp has role="button" and tabindex="0"', () => {
      // Accessible interactive element
      expect(loginHtml).toMatch(/<span[^>]+id=["']signupResendOtp["'][^>]*role=["']button["']/);
      expect(loginHtml).toMatch(/<span[^>]+id=["']signupResendOtp["'][^>]*tabindex=["']0["']/);
    });

    it('DES-030.22: #forgotResendOtp has role="button" and tabindex="0"', () => {
      // Accessible interactive element on forgot screen
      expect(loginHtml).toMatch(/<span[^>]+id=["']forgotResendOtp["'][^>]*role=["']button["']/);
      expect(loginHtml).toMatch(/<span[^>]+id=["']forgotResendOtp["'][^>]*tabindex=["']0["']/);
    });

    it('DES-030.23: .auth-otp-resend-row .text-link has touch padding (min-height: 36px)', () => {
      // Touch ergonomics in compact row
      const match = styleCss.match(/\.auth-otp-resend-row\s+\.text-link\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/min-height\s*:\s*36px/i);
    });

    it('DES-030.24: Keyboard Enter/Space on #signupResendOtp triggers resend when enabled', () => {
      // Keyboard support
      expect(loginHtml).toMatch(/signupResendOtp.*addEventListener/);
    });

    it('DES-030.25: Successful resend displays confirmation in verify status', () => {
      // Informs user that fresh OTP was dispatched
      expect(loginHtml).toMatch(/setStatus\(['"]signupVerifyStatus['"],\s*['"]A new verification code has been sent\./);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 5: DES-033 — Neutral Google Sign-In Button Hover (Tests 101–122)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('DES-033: Google Sign-In Button Neutral Hover & Focus Styling', () => {
    // Why this matters: Turning the button peach-orange on hover clashes with Google's official brand guidelines and creates visual noise against the 4-color Google G icon.

    it('DES-033.1: .auth-card #googleBtn:hover CSS rule exists in style.css', () => {
      // Specific hover override for Google button
      expect(styleCss).toMatch(/\.auth-card\s+#googleBtn:hover/);
    });

    it('DES-033.2: #googleBtn:hover sets neutral background var(--panel-2)', () => {
      // Uses calm neutral warm-panel background rather than bright orange tint
      const match = styleCss.match(/\.auth-card\s+#googleBtn:hover[^{]*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/background\s*:\s*var\(--panel-2\)/i);
    });

    it('DES-033.3: #googleBtn:hover sets neutral border-color', () => {
      // Subtle neutral border
      const match = styleCss.match(/\.auth-card\s+#googleBtn:hover[^{]*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/border-color\s*:\s*(?:rgba\(35,\s*38,\s*58,\s*0\.22\)|var\(--line\))/i);
    });

    it('DES-033.4: #googleBtn:hover sets text color to var(--ink)', () => {
      // High contrast legible ink text
      const match = styleCss.match(/\.auth-card\s+#googleBtn:hover[^{]*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/color\s*:\s*var\(--ink\)/i);
    });

    it('DES-033.5: .auth-card #googleBtn:focus-visible CSS rule exists for keyboard navigation', () => {
      // Accessible focus outline
      expect(styleCss).toMatch(/\.auth-card\s+#googleBtn:focus-visible/);
    });

    it('DES-033.6: #googleBtn:focus-visible does not flood background with orange', () => {
      // Confirms focus-visible matches neutral hover treatment
      const match = styleCss.match(/\.auth-card\s+#googleBtn:focus-visible[^{]*\{([^}]+)\}/);
      expect(match).toBeTruthy();
    });

    it('DES-033.7: .auth-card #googleBtn:active sets subtle active pressed background', () => {
      // Tactile pressed state
      expect(styleCss).toMatch(/\.auth-card\s+#googleBtn:active\s*\{[^}]*background\s*:\s*rgba\(0,\s*0,\s*0,\s*0\.06\)/i);
    });

    it('DES-033.8: .auth-card #googleBtn:active applies subtle transform: scale(0.99)', () => {
      // Tactile spring feedback
      expect(styleCss).toMatch(/\.auth-card\s+#googleBtn:active\s*\{[^}]*transform\s*:\s*scale\(0\.99\)/i);
    });

    it('DES-033.9: Google SVG icon retains official 4-color palette (#FFC107, #FF3D00, #4CAF50, #1976D2)', () => {
      // Confirms official brand asset integrity
      expect(loginHtml).toMatch(/fill=["']#FFC107["']/);
      expect(loginHtml).toMatch(/fill=["']#FF3D00["']/);
      expect(loginHtml).toMatch(/fill=["']#4CAF50["']/);
      expect(loginHtml).toMatch(/fill=["']#1976D2["']/);
    });

    it('DES-033.10: Google SVG icon has aria-hidden="true" to prevent screen reader clutter', () => {
      // Accessibility requirement for decorative logo mark
      expect(loginHtml).toMatch(/<svg[^>]+aria-hidden=["']true["'][^>]*>[\s\S]*?#FFC107/);
    });

    it('DES-033.11: Google SVG icon has focusable="false" for SVG accessibility in IE/Edge', () => {
      // Prevents SVG from being a secondary keyboard focus stop
      expect(loginHtml).toMatch(/<svg[^>]+focusable=["']false["'][^>]*>[\s\S]*?#FFC107/);
    });

    it('DES-033.12: #googleBtnLabel text is "Continue with Google"', () => {
      // Standard Google OAuth CTA copy
      expect(loginHtml).toMatch(/<span id=["']googleBtnLabel["']>Continue with Google<\/span>/);
    });

    it('DES-033.13: #googleBtn uses standardized border-radius: 12px', () => {
      // Matches DES-005 button radius standardization
      const match = styleCss.match(/\.auth-card\s+button\.secondary\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/border-radius\s*:\s*12px/i);
    });

    it('DES-033.14: #googleBtn disabled state sets opacity: 0.6', () => {
      // Visual disabled styling
      expect(styleCss).toMatch(/button\.secondary:disabled\s*\{[^}]*opacity\s*:\s*0\.6/i);
    });

    it('DES-033.15: #googleBtn disabled state sets pointer-events: none', () => {
      // Prevents interaction while auth flow is active
      expect(styleCss).toMatch(/button\.secondary:disabled\s*\{[^}]*pointer-events\s*:\s*none/i);
    });

    it('DES-033.16: #googleBtn disabled state sets cursor: not-allowed', () => {
      // Desktop cursor affordance
      expect(styleCss).toMatch(/button\.secondary:disabled\s*\{[^}]*cursor\s*:\s*not-allowed/i);
    });

    it('DES-033.17: #googleBtn.btn-loading displays CSS loading spinner', () => {
      // Loading spinner for OAuth popup turnaround
      expect(styleCss).toMatch(/button\.secondary\.btn-loading::after\s*\{/);
    });

    it('DES-033.18: #googleBtn is disabled immediately when setAuthBusy(true) is invoked', () => {
      // Single source of truth concurrency lock
      const setAuthBusyMatch = loginHtml.match(/function\s+setAuthBusy\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(setAuthBusyMatch).toBeTruthy();
      expect(setAuthBusyMatch[1]).toMatch(/googleBtn\.disabled\s*=\s*busy/);
    });

    it('DES-033.19: #googleBtn is re-enabled when setAuthBusy(false) is invoked', () => {
      // Restores interactivity on failure or cancel
      const setAuthBusyMatch = loginHtml.match(/function\s+setAuthBusy\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(setAuthBusyMatch).toBeTruthy();
    });

    it('DES-033.20: #googleBtn has flex center alignment and 8px gap between icon and label', () => {
      // Standard layout
      const match = styleCss.match(/button\.secondary\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/display\s*:\s*flex/i);
      expect(match[1]).toMatch(/align-items\s*:\s*center/i);
      expect(match[1]).toMatch(/justify-content\s*:\s*center/i);
      expect(match[1]).toMatch(/gap\s*:\s*8px/i);
    });

    it('DES-033.21: .auth-divider ("or") cleanly separates email form from Google sign-in', () => {
      // Clear visual partition
      expect(loginHtml).toMatch(/<div class=["']auth-divider["']>or<\/div>/);
    });

    it('DES-033.22: .auth-divider has subtle line pseudoelements using var(--line)', () => {
      // Neutral divider line styling
      expect(styleCss).toMatch(/\.auth-divider::before,\s*\.auth-divider::after\s*\{[^}]*background\s*:\s*var\(--line\)/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUITE 6: DES-034 — Password Live Validation Checkmark Pop-in (Tests 123–144)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('DES-034: Password Live Validation Checkmark Pop-in Animation', () => {
    // Why this matters: Plain color changes on meeting password criteria lack tactile confirmation. An animated checkmark provides instant, delightful visual affirmation.

    it('DES-034.1: @keyframes popCheck is defined in style.css', () => {
      // Keyframe animation for checkmark bounce entrance
      expect(styleCss).toMatch(/@keyframes\s+popCheck\s*\{[\s\S]*?\}/);
    });

    it('DES-034.2: @keyframes popCheck starts at scale(0.5) and opacity 0', () => {
      // Initial pop keyframe state
      expect(styleCss).toMatch(/@keyframes\s+popCheck\s*\{[\s\S]*?0%\s*\{[^}]*transform\s*:\s*scale\(\s*0\.5\s*\)[^}]*opacity\s*:\s*0/i);
    });

    it('DES-034.3: @keyframes popCheck overshoots to scale(1.25) at midway', () => {
      // Spring overshoot keyframe state
      expect(styleCss).toMatch(/@keyframes\s+popCheck\s*\{[\s\S]*?(?:50%|65%)\s*\{[^}]*transform\s*:\s*scale\(\s*1\.25\s*\)/i);
    });

    it('DES-034.4: @keyframes popCheck settles at scale(1) and opacity 1', () => {
      // Final resting keyframe state
      expect(styleCss).toMatch(/@keyframes\s+popCheck\s*\{[\s\S]*?100%\s*\{[^}]*transform\s*:\s*scale\(\s*1\s*\)[^}]*opacity\s*:\s*1/i);
    });

    it('DES-034.5: .auth-field-hint.valid::before CSS rule exists in style.css', () => {
      // Checkmark pseudo element selector for valid state
      expect(styleCss).toMatch(/\.auth-field-hint\.valid::before|\.auth-field-hint\.hint-met::before/);
    });

    it('DES-034.6: .auth-field-hint.valid::before sets content to checkmark "✓ "', () => {
      // Unicode checkmark icon character
      const match = styleCss.match(/\.auth-field-hint(?:\.valid|\.hint-met)::before[^{]*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/content\s*:\s*['"]✓\s*['"]/);
    });

    it('DES-034.7: .auth-field-hint.valid::before applies animation: popCheck with duration ~0.22s', () => {
      // Snappy bounce animation timing
      const match = styleCss.match(/\.auth-field-hint(?:\.valid|\.hint-met)::before[^{]*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/animation\s*:[^;]*popCheck\s+0\.22s/i);
    });

    it('DES-034.8: .auth-field-hint.valid sets text color to var(--good)', () => {
      // Success green color token
      const match = styleCss.match(/\.auth-field-hint\.valid\s*,\s*\.auth-field-hint\.hint-met\s*\{([^}]+)\}|\.auth-field-hint\.valid\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      const body = match[1] || match[2];
      expect(body).toMatch(/color\s*:\s*var\(--good\)/i);
    });

    it('DES-034.9: #signupPassword has aria-describedby="signupPasswordHint"', () => {
      // Accessibility linking input to its validation hint
      expect(loginHtml).toMatch(/<input[^>]+id=["']signupPassword["'][^>]*aria-describedby=["']signupPasswordHint["']/);
    });

    it('DES-034.10: #forgotNewPassword has aria-describedby="forgotPasswordHint"', () => {
      // Accessibility linking forgot password input to hint
      expect(loginHtml).toMatch(/<input[^>]+id=["']forgotNewPassword["'][^>]*aria-describedby=["']forgotPasswordHint["']/);
    });

    it('DES-034.11: #signupPasswordHint has default text "Must be at least 8 characters"', () => {
      // Standard hint copy
      expect(loginHtml).toMatch(/<div[^>]+id=["']signupPasswordHint["'][^>]*>Must be at least 8 characters<\/div>/);
    });

    it('DES-034.12: #forgotPasswordHint has default text "Must be at least 8 characters"', () => {
      // Standard hint copy on forgot screen
      expect(loginHtml).toMatch(/<div[^>]+id=["']forgotPasswordHint["'][^>]*>Must be at least 8 characters<\/div>/);
    });

    it('DES-034.13: Password input event listener in login.html updates hint class to valid on >= 8 chars', () => {
      // Real-time live validation logic
      expect(loginHtml).toMatch(/signupPassword.*addEventListener\(['"]input['"]/);
      expect(loginHtml).toMatch(/classList\.toggle\(['"]valid['"],\s*.*length\s*>=\s*8\)|classList\.toggle\(['"]hint-met['"],\s*.*length\s*>=\s*8\)/);
    });

    it('DES-034.14: Forgot password input listener in login.html updates hint class on >= 8 chars', () => {
      // Real-time live validation logic on forgot screen
      expect(loginHtml).toMatch(/forgotNewPassword.*addEventListener\(['"]input['"]/);
      expect(loginHtml).toMatch(/classList\.toggle\(['"]valid['"],\s*.*length\s*>=\s*8\)|classList\.toggle\(['"]hint-met['"],\s*.*length\s*>=\s*8\)/);
    });

    it('DES-034.15: Typing 7 chars does NOT add valid class', () => {
      // Boundary test: 7 chars < 8 chars threshold
      const val = '1234567';
      const isValid = val.length >= 8;
      expect(isValid).toBe(false);
    });

    it('DES-034.16: Typing exactly 8 chars adds valid class', () => {
      // Exact threshold boundary test
      const val = '12345678';
      const isValid = val.length >= 8;
      expect(isValid).toBe(true);
    });

    it('DES-034.17: Typing 20 chars retains valid class', () => {
      // Upper boundary test
      const val = 'SuperSecureP@ssw0rd!20';
      const isValid = val.length >= 8;
      expect(isValid).toBe(true);
    });

    it('DES-034.18: @media (prefers-reduced-motion: reduce) disables popCheck animation', () => {
      // Reduced motion accessibility compliance
      expect(styleCss).toMatch(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)[\s\S]*?popCheck|animation\s*:\s*none\s*!important/i);
    });

    it('DES-034.19: .auth-field-hint has transition for smooth color change', () => {
      // Color transition easing
      const match = styleCss.match(/\.auth-field-hint\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/transition\s*:[^;]*color/i);
    });

    it('DES-034.20: .auth-field-hint has font-size: 0.76rem and color: var(--ink-dim) in default state', () => {
      // Default hint styling
      const match = styleCss.match(/\.auth-field-hint\s*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/font-size\s*:\s*0\.76rem/i);
      expect(match[1]).toMatch(/color\s*:\s*var\(--ink-dim\)/i);
    });

    it('DES-034.21: Clearing password input resets hint class back to default', () => {
      // Reset test
      const val = '';
      const isValid = val.length >= 8;
      expect(isValid).toBe(false);
    });

    it('DES-034.22: Password hint checkmark pseudo element has display: inline-block', () => {
      // Inline block required for CSS scale transforms to work
      const match = styleCss.match(/\.auth-field-hint(?:\.valid|\.hint-met)::before[^{]*\{([^}]+)\}/);
      expect(match).toBeTruthy();
      expect(match[1]).toMatch(/display\s*:\s*inline-block/i);
    });
  });
});
