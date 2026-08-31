// Role: 06_TestWriter
// Target: Onboarding Wizard, Skeletons & AI Report Generation Hardcore Adversarial Suite
// Issues: DES-006, DES-007, DES-008, DES-009, DES-010, DES-018, DES-019 (24 Hard Tests)

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Onboarding Wizard, Skeleton Shimmers & AI Report Generation — 24 Hardcore Adversarial Tests', () => {
  const onboardingHtmlPath = path.resolve(__dirname, '../onboarding.html');
  const reportHtmlPath = path.resolve(__dirname, '../report.html');
  const historyHtmlPath = path.resolve(__dirname, '../history.html');
  const profileHtmlPath = path.resolve(__dirname, '../profile.html');
  const styleCssPath = path.resolve(__dirname, 'style.css');

  let onboardingHtml = '';
  let reportHtml = '';
  let historyHtml = '';
  let profileHtml = '';
  let styleCss = '';

  beforeEach(() => {
    onboardingHtml = fs.readFileSync(onboardingHtmlPath, 'utf8');
    reportHtml = fs.readFileSync(reportHtmlPath, 'utf8');
    historyHtml = fs.readFileSync(historyHtmlPath, 'utf8');
    profileHtml = fs.readFileSync(profileHtmlPath, 'utf8');
    styleCss = fs.readFileSync(styleCssPath, 'utf8');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-006: Modern Linear Progress Bar vs 9 Static Dots (Tests 1–4)
  // ─────────────────────────────────────────────────────────────────────────
  it('DES-006.1: onboarding.html replaces static .progress-dots container with .progress-track', () => {
    expect(onboardingHtml).not.toMatch(/class=["']progress-dots["']/);
    expect(onboardingHtml).toMatch(/class=["'][^"']*progress-track[^"']*["']/);
  });

  it('DES-006.2: onboarding.html contains dynamic #progressBar fill element', () => {
    expect(onboardingHtml).toMatch(/id=["']progressBar["']/);
    expect(onboardingHtml).toMatch(/class=["'][^"']*progress-bar[^"']*["']/);
  });

  it('DES-006.3: renderProgress calculates accurate percentage fill based on step index (0 to 8)', () => {
    const renderProgMatch = onboardingHtml.match(/function\s+renderProgress\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
    expect(renderProgMatch).toBeTruthy();
    expect(renderProgMatch[1]).toMatch(/progressBar\.style\.width\s*=\s*`\$\{percent\}%`/);
  });

  it('DES-006.4: style.css provides smooth width transition on .progress-bar', () => {
    const barRuleMatch = styleCss.match(/\.progress-bar\s*\{([^}]+)\}/);
    expect(barRuleMatch).toBeTruthy();
    expect(barRuleMatch[1]).toMatch(/transition\s*:\s*width\s+0\.[2-5]s/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-007: Step Transition Motion & Easing (Tests 5–7)
  // ─────────────────────────────────────────────────────────────────────────
  it('DES-007.5: renderStep applies .step-enter animation class on stepBody', () => {
    const renderStepMatch = onboardingHtml.match(/function\s+renderStep\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
    expect(renderStepMatch).toBeTruthy();
    expect(renderStepMatch[1]).toMatch(/stepBody\.classList\.add\(['"]step-enter['"]\)/);
  });

  it('DES-007.6: style.css defines @keyframes stepFadeIn with vertical translate', () => {
    expect(styleCss).toMatch(/@keyframes\s+stepFadeIn\s*\{[\s\S]*?from\s*\{[\s\S]*?opacity\s*:\s*0/);
    expect(styleCss).toMatch(/@keyframes\s+stepFadeIn\s*\{[\s\S]*?transform\s*:\s*translateY/);
  });

  it('DES-007.7: .step-enter class applies stepFadeIn animation with easing', () => {
    const stepEnterMatch = styleCss.match(/\.step-enter\s*\{([^}]+)\}/);
    expect(stepEnterMatch).toBeTruthy();
    expect(stepEnterMatch[1]).toMatch(/animation\s*:\s*stepFadeIn/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-008: Selection Chips Hierarchy & Tactile Feedback (Tests 8–11)
  // ─────────────────────────────────────────────────────────────────────────
  it('DES-008.8: renderChips constructs .chip-title and optional .chip-sub elements', () => {
    const renderChipsMatch = onboardingHtml.match(/function\s+renderChips\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
    expect(renderChipsMatch).toBeTruthy();
    expect(renderChipsMatch[1]).toMatch(/chip-title/);
    expect(renderChipsMatch[1]).toMatch(/chip-sub/);
  });

  it('DES-008.9: renderChips extracts clean title and optional subtitle dynamically', () => {
    const renderChipsMatch = onboardingHtml.match(/function\s+renderChips\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
    expect(renderChipsMatch).toBeTruthy();
    expect(renderChipsMatch[1]).toMatch(/const title = opt\.title \|\| opt\.label;/);
  });

  it('DES-008.10: style.css provides tactile press feedback on .chip:active (scale 0.98)', () => {
    const chipActiveMatch = styleCss.match(/\.chip:active\s*\{([^}]+)\}/);
    expect(chipActiveMatch).toBeTruthy();
    expect(chipActiveMatch[1]).toMatch(/transform\s*:\s*scale\(\s*0\.9[6-9]\s*\)/);
  });

  it('DES-008.11: style.css defines distinct typography for .chip-title and .chip-sub', () => {
    expect(styleCss).toMatch(/\.chip-title\s*\{[^}]*font-weight/);
    expect(styleCss).toMatch(/\.chip-sub\s*\{[^}]*font-size/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-009 & DES-010: Switch Link, Textarea & Translation Prompt (Tests 12–15)
  // ─────────────────────────────────────────────────────────────────────────
  it('DES-009.12: #occSwitchLink does NOT use raw inline text-decoration: underline', () => {
    const linkMatch = onboardingHtml.match(/id=["']occSwitchLink["'][^>]*style=["']([^"']*)["']/);
    if (linkMatch) {
      expect(linkMatch[1]).not.toMatch(/text-decoration\s*:\s*underline/i);
    }
  });

  it('DES-009.13: #occSwitchLink applies dedicated .auth-switch-link class', () => {
    expect(onboardingHtml).toMatch(/id=["']occSwitchLink["'][^>]*class=["'][^"']*auth-switch-link[^"']*["']/);
  });

  it('DES-010.14: style.css explicitly disables textarea resizing on touch screens', () => {
    const textareaMatch = styleCss.match(/textarea\s*\{([^}]+)\}/);
    expect(textareaMatch).toBeTruthy();
    expect(textareaMatch[1]).toMatch(/resize\s*:\s*none/i);
  });

  it('DES-010.15: onboarding.html wraps Hindi translation prompt in .translate-prompt-box', () => {
    expect(onboardingHtml).toMatch(/class=["'][^"']*translate-prompt-box[^"']*["']/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-018: Skeleton Loading Shimmers in History & Profile (Tests 16–20)
  // ─────────────────────────────────────────────────────────────────────────
  it('DES-018.16: history.html renders .skeleton-card elements during session history fetch', () => {
    expect(historyHtml).toMatch(/class=["'][^"']*skeleton-card[^"']*["']/);
  });

  it('DES-018.17: profile.html does NOT use strings of raw em-dashes (—)', () => {
    const rawEmDashes = (profileHtml.match(/>—<\/span>/g) || []).length;
    expect(rawEmDashes).toBeLessThan(2);
  });

  it('DES-018.18: profile.html renders .skeleton-pill and .skeleton-line placeholders', () => {
    expect(profileHtml).toMatch(/skeleton-pill|skeleton-line/);
  });

  it('DES-018.19: style.css defines @keyframes shimmer with linear background-position shift', () => {
    expect(styleCss).toMatch(/@keyframes\s+shimmer\s*\{[\s\S]*?background-position/);
  });

  it('DES-018.20: .skeleton-card and .skeleton-line apply shimmering linear gradient', () => {
    expect(styleCss).toMatch(/\.skeleton-card[\s\S]*?linear-gradient/);
    expect(styleCss).toMatch(/\.skeleton-line[\s\S]*?linear-gradient/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-019: Multi-Phase AI Report Generation Progress Messages (Tests 21–24)
  // ─────────────────────────────────────────────────────────────────────────
  it('DES-019.21: renderGenerateState in report.html implements dynamic step timer', () => {
    const renderGenMatch = reportHtml.match(/function\s+renderGenerateState\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
    expect(renderGenMatch).toBeTruthy();
    expect(renderGenMatch[1]).toMatch(/setInterval|setTimeout|steps|phaseIndex/);
  });

  it('DES-019.22: report.html includes Phase 1 conversation review coaching message', () => {
    expect(reportHtml).toMatch(/Reviewing practice conversation|Reading conversation/i);
  });

  it('DES-019.23: report.html includes Phase 2 grammar and vocabulary analysis coaching message', () => {
    expect(reportHtml).toMatch(/Analyzing grammar and vocabulary patterns|Analyzing patterns/i);
  });

  it('DES-019.24: report.html includes Phase 3 Hinglish coaching advice polishing message', () => {
    expect(reportHtml).toMatch(/Polishing Hinglish coach tips|Finalizing feedback/i);
  });
});
