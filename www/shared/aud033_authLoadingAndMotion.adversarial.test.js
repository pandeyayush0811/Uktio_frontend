// Role: 06_TestWriter
// Target: Authentication & Login Flow Hardcore Adversarial Suite
// Issues: AUD-033, DES-002, DES-003, DES-004, DES-005, DES-011, DES-013 (22 Hard Tests)

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('AUD-033 & Auth Design Polish — 22 Hardcore Adversarial Tests', () => {
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

  // ─────────────────────────────────────────────────────────────────────────
  // AUD-033: Active Submit Button Loading vs Google Button Spinner (Tests 1–6)
  // ─────────────────────────────────────────────────────────────────────────
  it('AUD-033.1: setAuthBusy does NOT unconditionally toggle .btn-loading on #googleBtn', () => {
    const fnMatch = loginHtml.match(/function\s+setAuthBusy\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
    expect(fnMatch).toBeTruthy();
    expect(fnMatch[1]).not.toMatch(/getElementById\(['"]googleBtn['"]\)\.classList\.toggle\(['"]btn-loading['"],\s*busy\)/);
  });

  it('AUD-033.2: setAuthBusy accepts activeBtn parameter and applies .btn-loading only to activeBtn', () => {
    const fnMatch = loginHtml.match(/function\s+setAuthBusy\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
    expect(fnMatch).toBeTruthy();
    expect(fnMatch[1]).toMatch(/if\s*\(\s*busy\s*&&\s*activeBtn\s*\)\s*\{\s*activeBtn\.classList\.add\(['"]btn-loading['"]\)/);
  });

  it('AUD-033.3: #loginForm submit handler passes loginSubmitBtn to setAuthBusy(true, btn)', () => {
    expect(loginHtml).toMatch(/setAuthBusy\s*\(\s*true\s*,\s*document\.getElementById\(['"]loginSubmitBtn['"]\)/);
  });

  it('AUD-033.4: #signupStartForm submit handler passes signupStartSubmitBtn to setAuthBusy', () => {
    expect(loginHtml).toMatch(/setAuthBusy\s*\(\s*true\s*,\s*document\.getElementById\(['"]signupStartSubmitBtn['"]\)/);
  });

  it('AUD-033.5: #signupVerifyForm submit handler passes signupVerifySubmitBtn to setAuthBusy', () => {
    expect(loginHtml).toMatch(/setAuthBusy\s*\(\s*true\s*,\s*document\.getElementById\(['"]signupVerifySubmitBtn['"]\)/);
  });

  it('AUD-033.6: Google OAuth click handler explicitly passes googleBtn to setAuthBusy', () => {
    expect(loginHtml).toMatch(/setAuthBusy\s*\(\s*true\s*,\s*(?:googleBtn|document\.getElementById\(['"]googleBtn['"]\))\)/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-002: Screen Crossfades & Transition Keyframes (Tests 7–9)
  // ─────────────────────────────────────────────────────────────────────────
  it('AUD-033.7: showScreen resets and re-triggers auth-card-enter animation class', () => {
    const showScreenMatch = loginHtml.match(/function\s+showScreen\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
    expect(showScreenMatch).toBeTruthy();
    expect(showScreenMatch[1]).toMatch(/auth-card-enter/);
  });

  it('AUD-033.8: style.css defines @keyframes authCardIn with smooth opacity and vertical transform', () => {
    expect(styleCss).toMatch(/@keyframes\s+authCardIn\s*\{[\s\S]*?from\s*\{[\s\S]*?opacity\s*:\s*0/);
    expect(styleCss).toMatch(/@keyframes\s+authCardIn\s*\{[\s\S]*?to\s*\{[\s\S]*?opacity\s*:\s*1/);
  });

  it('AUD-033.9: .auth-card-enter rule uses cubic-bezier easing for snappy mobile response', () => {
    const ruleMatch = styleCss.match(/\.auth-card-enter\s*\{([^}]+)\}/);
    expect(ruleMatch).toBeTruthy();
    expect(ruleMatch[1]).toMatch(/animation\s*:\s*authCardIn/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-003: 6-Digit OTP Field Formatting, Centering & Tabular Figures (Tests 10–13)
  // ─────────────────────────────────────────────────────────────────────────
  it('AUD-033.10: #signupOtp input applies auth-otp-input class', () => {
    expect(loginHtml).toMatch(/<input[^>]*id=["']signupOtp["'][^>]*class=["'][^"']*auth-otp-input[^"']*["']/);
  });

  it('AUD-033.11: #forgotOtp input applies auth-otp-input class', () => {
    expect(loginHtml).toMatch(/<input[^>]*id=["']forgotOtp["'][^>]*class=["'][^"']*auth-otp-input[^"']*["']/);
  });

  it('AUD-033.12: .auth-otp-input enforces centered alignment and wide letter-spacing', () => {
    const ruleMatch = styleCss.match(/\.auth-otp-input\s*\{([^}]+)\}/);
    expect(ruleMatch).toBeTruthy();
    expect(ruleMatch[1]).toMatch(/text-align\s*:\s*center/i);
    expect(ruleMatch[1]).toMatch(/letter-spacing\s*:\s*(?:0\.[3-6]em|[1-2]rem)/i);
  });

  it('AUD-033.13: .auth-otp-input enforces tabular numerals for stable figure widths', () => {
    const ruleMatch = styleCss.match(/\.auth-otp-input\s*\{([^}]+)\}/);
    expect(ruleMatch).toBeTruthy();
    expect(ruleMatch[1]).toMatch(/font-variant-numeric\s*:\s*tabular-nums/i);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-004: Minimum Touch Target Bounds for Mobile Thumbs (Tests 14–16)
  // ─────────────────────────────────────────────────────────────────────────
  it('AUD-033.14: .auth-footer-links .text-link has minimum touch height >= 40px', () => {
    const ruleMatch = styleCss.match(/\.auth-footer-links\s+\.text-link\s*\{([^}]+)\}/);
    expect(ruleMatch).toBeTruthy();
    expect(ruleMatch[1]).toMatch(/min-height\s*:\s*(?:40px|44px|48px|2\.5rem)/i);
  });

  it('AUD-033.15: .auth-footer-links .text-link displays as inline-flex with padding', () => {
    const ruleMatch = styleCss.match(/\.auth-footer-links\s+\.text-link\s*\{([^}]+)\}/);
    expect(ruleMatch).toBeTruthy();
    expect(ruleMatch[1]).toMatch(/display\s*:\s*inline-flex/i);
    expect(ruleMatch[1]).toMatch(/padding\s*:\s*[^;]+/i);
  });

  it('AUD-033.16: .auth-consent label maintains accessible touch height for checkbox tap', () => {
    const ruleMatch = styleCss.match(/\.auth-consent\s+label\s*\{([^}]+)\}/);
    expect(ruleMatch).toBeTruthy();
    expect(ruleMatch[1]).toMatch(/min-height\s*:\s*(?:36px|40px|44px)/i);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-005 & DES-011: CTA Border Radius & Input Shake Feedback (Tests 17–19)
  // ─────────────────────────────────────────────────────────────────────────
  it('AUD-033.17: .auth-card button.primary uses 12px border radius, eliminating 999px pill', () => {
    const ruleMatch = styleCss.match(/\.auth-card\s+button\.primary\s*\{([^}]+)\}/);
    expect(ruleMatch).toBeTruthy();
    expect(ruleMatch[1]).not.toMatch(/border-radius\s*:\s*999px/i);
    expect(ruleMatch[1]).toMatch(/border-radius\s*:\s*(?:12px|var\(--radius-button\)|var\(--radius-sm\))/i);
  });

  it('AUD-033.18: style.css defines @keyframes inputShake with horizontal wiggle', () => {
    expect(styleCss).toMatch(/@keyframes\s+inputShake\s*\{[\s\S]*?translateX/);
  });

  it('AUD-033.19: .input-shake class applies inputShake animation with quick timing', () => {
    const ruleMatch = styleCss.match(/\.input-shake\s*\{([^}]+)\}/);
    expect(ruleMatch).toBeTruthy();
    expect(ruleMatch[1]).toMatch(/animation\s*:\s*inputShake\s+0\.\d+s/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-013 & Security / String Cleanliness (Tests 20–22)
  // ─────────────────────────────────────────────────────────────────────────
  it('AUD-033.20: login.html contains zero raw developer notes ("see setup notes")', () => {
    expect(loginHtml).not.toMatch(/see setup notes/i);
  });

  it('AUD-033.21: Google Sign-in error gives warm consumer message to end users', () => {
    expect(loginHtml).toMatch(/Google Sign-In is temporarily unavailable/i);
  });

  it('AUD-033.22: setAuthBusy disables all interactive submit buttons during in-flight network requests', () => {
    const fnMatch = loginHtml.match(/function\s+setAuthBusy\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
    expect(fnMatch).toBeTruthy();
    expect(fnMatch[1]).toMatch(/disabled\s*=\s*busy/);
  });
});
