// Role: 06_TestWriter
// Target: Scenario Screen, Dashboard, Commit Mode Widget & Brand Polish Hardcore Adversarial Suite
// Issues: AUD-034, DES-014, DES-015, DES-016, DES-017 (22 Hard Tests)

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('AUD-034 & Dashboard / Scenario Polish — 22 Hardcore Adversarial Tests', () => {
  const scenarioHtmlPath = path.resolve(__dirname, '../scenario.html');
  const homeHtmlPath = path.resolve(__dirname, '../home.html');
  const reportHtmlPath = path.resolve(__dirname, '../report.html');
  const historyHtmlPath = path.resolve(__dirname, '../history.html');
  const styleCssPath = path.resolve(__dirname, 'style.css');
  const commitWidgetPath = path.resolve(__dirname, 'commit-mode-widget.js');

  let scenarioHtml = '';
  let homeHtml = '';
  let reportHtml = '';
  let historyHtml = '';
  let styleCss = '';
  let commitWidget = '';

  beforeEach(() => {
    scenarioHtml = fs.readFileSync(scenarioHtmlPath, 'utf8');
    homeHtml = fs.readFileSync(homeHtmlPath, 'utf8');
    reportHtml = fs.readFileSync(reportHtmlPath, 'utf8');
    historyHtml = fs.readFileSync(historyHtmlPath, 'utf8');
    styleCss = fs.readFileSync(styleCssPath, 'utf8');
    commitWidget = fs.readFileSync(commitWidgetPath, 'utf8');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AUD-034: Commit Mode Banner Mounting on Scenario Screen (Tests 1–5)
  // ─────────────────────────────────────────────────────────────────────────
  it('AUD-034.1: scenario.html includes #commitBanner element in the app shell', () => {
    expect(scenarioHtml).toMatch(/id=["']commitBanner["']/);
  });

  it('AUD-034.2: scenario.html imports renderCommitModeBanner from commit-mode-widget.js', () => {
    expect(scenarioHtml).toMatch(/import\s*\{[^}]*renderCommitModeBanner[^}]*\}\s*from\s*['"]\.\/shared\/commit-mode-widget\.js['"]/);
  });

  it('AUD-034.3: scenario.html invokes renderCommitModeBanner passing container and plan data', () => {
    expect(scenarioHtml).toMatch(/renderCommitModeBanner\s*\(\s*document\.getElementById\(['"]commitBanner['"]\)/);
  });

  it('AUD-034.4: #commitBanner is placed above the scenario interaction card in DOM hierarchy', () => {
    const bannerIdx = scenarioHtml.indexOf('id="commitBanner"');
    const cardIdx = scenarioHtml.indexOf('id="scenarioCard"');
    expect(bannerIdx).toBeGreaterThan(0);
    expect(cardIdx).toBeGreaterThan(0);
    expect(bannerIdx).toBeLessThan(cardIdx);
  });

  it('AUD-034.5: commit-mode-banner applies proper styling class for consistent rendering', () => {
    expect(scenarioHtml).toMatch(/class=["'][^"']*commit-mode-banner[^"']*["']/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-014: Commit Mode Editorial Copy & Warm Aesthetics (Tests 6–10)
  // ─────────────────────────────────────────────────────────────────────────
  it('AUD-034.6: commit-mode-widget eliminates robotic "Scenario baaki" copy', () => {
    expect(commitWidget).not.toMatch(/Scenario baaki/i);
  });

  it('AUD-034.7: commit-mode-widget eliminates robotic "Reset ... tak" copy', () => {
    expect(commitWidget).not.toMatch(/Reset \d+h \d+m tak/i);
  });

  it('AUD-034.8: commit-mode-widget renders clean progress format "Chat X/Y min"', () => {
    expect(commitWidget).toMatch(/Chat \$\{chatMinsDone\}\/\$\{chatMinsReq\} min/i);
  });

  it('AUD-034.9: commit-mode-widget renders clean scenario completion status', () => {
    expect(commitWidget).toMatch(/Scenario:\s*Pending|✓ Scenario/i);
  });

  it('AUD-034.10: style.css avoids legacy purple (#6a63f1, #e7e5fd) in .commit-mode-banner', () => {
    const bannerRuleMatch = styleCss.match(/\.commit-mode-banner\s*\{([^}]+)\}/);
    expect(bannerRuleMatch).toBeTruthy();
    expect(bannerRuleMatch[1]).not.toMatch(/#6a63f1|#e7e5fd/i);
    expect(bannerRuleMatch[1]).toMatch(/var\(--panel-2\)|var\(--card\)|var\(--ink\)/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-015: Elimination of Legacy Purple Across App Shell (Tests 11–14)
  // ─────────────────────────────────────────────────────────────────────────
  it('AUD-034.11: report.html bold article headings avoid legacy purple (#6a63f1 / var(--accent))', () => {
    expect(reportHtml).not.toMatch(/\.report-article\s+strong\s*\{[^}]*color\s*:\s*(?:var\(--accent\)|#6a63f1)/);
    expect(reportHtml).toMatch(/\.report-article\s+strong\s*\{[^}]*color\s*:\s*var\(--accent-orange\)/);
  });

  it('AUD-034.12: history.html user bubble tag avoid legacy purple color', () => {
    expect(historyHtml).not.toMatch(/\.t-line\.user\s+\.t-tag\s*\{[^}]*color\s*:\s*(?:var\(--accent\)|#6a63f1)/);
    expect(historyHtml).toMatch(/\.t-line\.user\s+\.t-tag\s*\{[^}]*color\s*:\s*var\(--accent-orange\)/);
  });

  it('AUD-034.13: style.css assigns --accent-orange to warm terracotta', () => {
    expect(styleCss).toMatch(/--accent-orange\s*:\s*#(?:d9694b|e05a47)/i);
  });

  it('AUD-034.14: report.html action buttons use unified brand theme', () => {
    expect(reportHtml).toMatch(/var\(--accent-orange\)|var\(--panel-2\)/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-016: Prevention of Flash of Unhydrated Content (FOUC) (Tests 15–18)
  // ─────────────────────────────────────────────────────────────────────────
  it('AUD-034.15: home.html does NOT hardcode "0" inside #homeStreakValue', () => {
    expect(homeHtml).not.toMatch(/<span\s+id=["']homeStreakValue["']>0<\/span>/);
  });

  it('AUD-034.16: home.html uses neutral placeholder (–) inside #homeStreakValue during initial render', () => {
    expect(homeHtml).toMatch(/<span\s+id=["']homeStreakValue["']>[\s–-]*<\/span>|<span\s+id=["']homeStreakValue["'][^>]*class=["'][^"']*skeleton/);
  });

  it('AUD-034.17: home.html does NOT hardcode "there" in #homeName greeting header', () => {
    expect(homeHtml).not.toMatch(/<h1\s+id=["']homeName["']>there<\/h1>/);
  });

  it('AUD-034.18: home.html maintains clean empty heading for profile hydration', () => {
    expect(homeHtml).toMatch(/<h1[^>]*id=["']homeName["'][^>]*>\s*<\/h1>/);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // DES-017: Cumulative Layout Shift (CLS) Prevention for Dynamic Banners (Tests 19–22)
  // ─────────────────────────────────────────────────────────────────────────
  it('AUD-034.19: style.css defines @keyframes bannerSlideDown for async loaded banners', () => {
    expect(styleCss).toMatch(/@keyframes\s+bannerSlideDown\s*\{[\s\S]*?from\s*\{[\s\S]*?opacity\s*:\s*0/);
  });

  it('AUD-034.20: bannerSlideDown animates transform translateY from negative offset', () => {
    expect(styleCss).toMatch(/@keyframes\s+bannerSlideDown\s*\{[\s\S]*?transform\s*:\s*translateY\(-/);
  });

  it('AUD-034.21: .commit-mode-banner applies slide down animation with smooth timing', () => {
    const bannerRuleMatch = styleCss.match(/\.commit-mode-banner\s*\{([^}]+)\}/);
    expect(bannerRuleMatch).toBeTruthy();
    expect(bannerRuleMatch[1]).toMatch(/animation\s*:\s*bannerSlideDown/);
  });

  it('AUD-034.22: dynamic banners apply smooth entrance animation', () => {
    expect(styleCss).toMatch(/bannerSlideDown/);
  });
});
