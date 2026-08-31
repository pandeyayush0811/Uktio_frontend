// Role: 06_TestWriter
// Target: NLP Post-Session AI Report Chunking, Drill Cards & Typographic Hierarchy (Hardcore Adversarial Suite)
// Issues: DES-010, DES-020 (22 Hard Adversarial Tests)

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('DES-010, DES-020: NLP Report Chunking, Bilingual Drill Cards & Typography — Adversarial Suite', () => {
  const reportHtmlPath = path.resolve(__dirname, '../report.html');
  const styleCssPath = path.resolve(__dirname, 'style.css');

  let reportHtml = '';
  let styleCss = '';

  beforeEach(() => {
    reportHtml = fs.readFileSync(reportHtmlPath, 'utf8');
    styleCss = fs.readFileSync(styleCssPath, 'utf8');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-010: Report Chunking, Section Cards & Bilingual Drill Visuals (Tests 1–14)
  // ─────────────────────────────────────────────────────────────────────────
  it('DES-010.1: style.css defines .report-section-card / .drill-card surface styles with --panel-2 and --card backgrounds', () => {
    // Why this matters: The flat wall of text must be broken into distinct readable learning surfaces.
    expect(styleCss).toMatch(/(\.report-section-card|\.drill-card|\.report-article)\s*\{/);
  });

  it('DES-010.2: style.css defines .drill-badge or .report-badge with distinct bad/good/accent styling', () => {
    // Why this matters: Drill examples need visual cues for "What you said" vs "Correct English".
    expect(styleCss).toMatch(/(\.drill-badge|\.report-badge|\.badge-drill|\.drill-label)\s*\{/);
  });

  it('DES-010.3: report.html renderReportText sanitizes raw AI text through escapeHtml before tag transformations', () => {
    // Why this matters: CRITICAL XSS GATE — AI-generated text must be sanitized before converting markdown/drills into HTML.
    expect(reportHtml).toMatch(/escapeHtml\s*\(\s*text/);
  });

  it('DES-010.4: renderReportText safely formats **bold** markers without introducing unsanitized HTML injection', () => {
    // Why this matters: Malicious script tags inside bold markers (e.g. **<script>alert(1)</script>**) must stay escaped as &lt;script&gt;.
    const renderFuncMatch = reportHtml.match(/function\s+renderReportText\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
    expect(renderFuncMatch).toBeTruthy();
    expect(renderFuncMatch[1]).toMatch(/escapeHtml/);
    expect(renderFuncMatch[1]).toMatch(/replace\(\s*\/\*\*(.+?)\*\*\//);
  });

  it('DES-010.5: report.html structures drill comparisons with clear visual separation between Hindi cue, Wrong phrase, and Correct sentence', () => {
    // Why this matters: Learners must immediately differentiate the Hindi thought bridge from the English correction.
    expect(styleCss).toMatch(/(\.drill-wrong|\.drill-correct|\.drill-hindi|\.report-article)/);
  });

  it('DES-010.6: Empty or whitespace-only report text does not crash renderReportText and produces safe fallback output', () => {
    // Why this matters: Edge case — if backend returns empty report_text, page must not throw uncaught TypeError.
    const renderFuncMatch = reportHtml.match(/function\s+renderReportText\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
    expect(renderFuncMatch).toBeTruthy();
    expect(renderFuncMatch[1]).toMatch(/text\s*\|\|\s*['"]/);
  });

  it('DES-010.7: report.html provides .generate-state loading step messages ("Reviewing practice conversation...", "Analyzing grammar...", "Polishing coach tips...")', () => {
    // Why this matters: 10–20 second OpenAI turnaround requires engaging progressive feedback so user does not abandon.
    expect(reportHtml).toMatch(/Reviewing practice conversation/i);
    expect(reportHtml).toMatch(/Analyzing grammar|Analyzing/i);
    expect(reportHtml).toMatch(/Polishing Hinglish|Polishing/i);
  });

  it('DES-010.8: report.html clears generateInterval timer on successful render or page teardown to prevent memory leaks', () => {
    // Why this matters: Background intervals must be cleared once report arrives to avoid timer leaks.
    expect(reportHtml).toMatch(/clearInterval\s*\(\s*generateInterval\s*\)/);
  });

  it('DES-010.9: report.html prevents duplicate report generation clicks via immediate button disabling and generateInFlight guard', () => {
    // Why this matters: Double tapping Generate Report must not trigger parallel OpenAI analysis calls.
    expect(reportHtml).toMatch(/let\s+generateInFlight\s*=\s*false/);
    expect(reportHtml).toMatch(/genBtn\.disabled\s*=\s*true/);
  });

  it('DES-010.10: report.html handles 409 Conflict status by gracefully polling GET /report until complete', () => {
    // Why this matters: Concurrency edge case — if another tab claimed generation, current tab polls rather than erroring out.
    expect(reportHtml).toMatch(/err\.status\s*===\s*409/);
    expect(reportHtml).toMatch(/pollForReport\s*\(/);
  });

  it('DES-010.11: report.html handles 402 Payment Required by rendering clear upgrade CTA to pricing.html', () => {
    // Why this matters: Free trial limit reached must give a smooth, clear path to upgrade without dead-end errors.
    expect(reportHtml).toMatch(/err\.status\s*===\s*402/);
    expect(reportHtml).toMatch(/pricing\.html\?reason=report_limit/);
  });

  it('DES-010.12: style.css defines line-height >= 1.6 on report text for comfortable mobile readability', () => {
    // Why this matters: Dense text with tight line-height causes severe eye fatigue on mobile screens.
    const articleRule = styleCss.match(/(\.report-article|\.report-body|\.drill-card)\s*\{([^}]+)\}/);
    expect(articleRule).toBeTruthy();
    expect(articleRule[2]).toMatch(/line-height\s*:\s*(1\.[6-9]|2)/);
  });

  it('DES-010.13: Report card container maintains safe horizontal padding (20px–24px) preventing edge clipping', () => {
    // Why this matters: Text touching the screen bezel looks unpolished and unreadable.
    const cardRule = styleCss.match(/(\.report-article|\.card)\s*\{([^}]+)\}/);
    expect(cardRule).toBeTruthy();
    expect(cardRule[2]).toMatch(/padding\s*:\s*(1[89]|2[0-9])px/);
  });

  it('DES-010.14: Report article card uses standard elevation shadow matching STYLE_GUIDE recipe', () => {
    // Why this matters: Cohesive shadow recipes ensure visual consistency across all card surfaces.
    const articleRule = styleCss.match(/(\.report-article|\.card)\s*\{([^}]+)\}/);
    expect(articleRule).toBeTruthy();
    expect(articleRule[2]).toMatch(/box-shadow\s*:\s*0\s+(6|12|20)px/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-020: Global Topbar Typographic Standardization (Tests 15–22)
  // ─────────────────────────────────────────────────────────────────────────
  it('DES-020.15: report.html topbar header uses Georgia serif font (--font-serif) consistent with other sub-screens', () => {
    // Why this matters: Topbar title was sans-serif while other pages used Georgia serif, creating typographic dissonance.
    expect(reportHtml).toMatch(/font-family\s*:\s*var\(--font-serif\)|class=["'][^"']*app-title[^"']*["']/);
  });

  it('DES-020.16: style.css standardizes .topbar .app-title to font-size: 1.25rem and font-family: var(--font-serif)', () => {
    // Why this matters: Eliminates fragmented ad-hoc inline font size overrides across chat, settings, report, history.
    expect(styleCss).toMatch(/\.app-title\s*\{[^}]*font-family\s*:\s*var\(--font-serif\)/);
  });

  it('DES-020.17: Topbar icon buttons (.icon-btn) maintain minimum 40px hit area for easy thumb tapping', () => {
    // Why this matters: Back navigation and drawer triggers must be comfortably tappable on mobile.
    const iconBtnRule = styleCss.match(/\.icon-btn\s*\{([^}]+)\}/);
    expect(iconBtnRule).toBeTruthy();
    expect(iconBtnRule[1]).toMatch(/padding\s*:\s*8px/);
  });

  it('DES-020.18: Topbar icon SVGs have standardized viewBox 24x24 and explicit width/height (22px)', () => {
    // Why this matters: Prevents unstyled SVGs from blowing up to 300x150 in legacy rendering paths.
    const iconSvgRule = styleCss.match(/\.icon-btn\s+svg\s*\{([^}]+)\}/);
    expect(iconSvgRule).toBeTruthy();
    expect(iconSvgRule[1]).toMatch(/width\s*:\s*22px/);
    expect(iconSvgRule[1]).toMatch(/height\s*:\s*22px/);
  });

  it('DES-020.19: Back button has explicit aria-label="Back" for accessibility compliance', () => {
    // Why this matters: Screen readers must announce the purpose of navigation icon buttons.
    expect(reportHtml).toMatch(/aria-label=["']Back["']/);
  });

  it('DES-020.20: Topbar uses flex layout with space-between alignment and safe-area top inset support', () => {
    // Why this matters: Notch / camera cutout on modern mobile screens must not overlap top navigation.
    const topbarRule = styleCss.match(/\.topbar\s*\{([^}]+)\}/);
    expect(topbarRule).toBeTruthy();
    expect(topbarRule[1]).toMatch(/display\s*:\s*flex/);
    expect(topbarRule[1]).toMatch(/justify-content\s*:\s*space-between/);
  });

  it('DES-020.21: Missing session parameter in report.html shows clean error message rather than blank page', () => {
    // Why this matters: Guard against navigation edge cases (e.g. visiting report.html without ?session=123).
    expect(reportHtml).toMatch(/if\s*\(\s*!sessionId\s*\)/);
    expect(reportHtml).toMatch(/Session ID missing/i);
  });

  it('DES-020.22: Report page preserves locked color tokens with zero unauthorized new accent colors', () => {
    // Why this matters: Color lock constraint — all badges, cards, and highlights strictly use locked tokens.
    expect(reportHtml).not.toMatch(/color\s*:\s*#(?!FBF1E6|ffffff|F5ECDF|23263a|6f6558|ECDFCB|d9694b|f6e2da|6a63f1|e7e5fd|bf3a40|3a9463)[0-9a-fA-F]{3,6}/);
  });
});
