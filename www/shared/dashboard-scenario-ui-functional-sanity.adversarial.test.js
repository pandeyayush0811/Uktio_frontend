// Role: 10_FunctionalSanityTester & 06_TestWriter
// Target: Dashboard, Scenario & Commit Mode UI / Real-World Usability
// Issues Tested: AUD-034, DES-014, DES-015, DES-016, DES-017

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Functional Sanity & Real-World UI Tests — Dashboard & Scenario (home.html, scenario.html, commit-mode-widget.js)', () => {
  const homeHtmlPath = path.resolve(__dirname, '../home.html');
  const scenarioHtmlPath = path.resolve(__dirname, '../scenario.html');
  const reportHtmlPath = path.resolve(__dirname, '../report.html');
  const historyHtmlPath = path.resolve(__dirname, '../history.html');
  const styleCssPath = path.resolve(__dirname, 'style.css');
  const commitWidgetPath = path.resolve(__dirname, 'commit-mode-widget.js');

  let homeHtmlContent = '';
  let scenarioHtmlContent = '';
  let reportHtmlContent = '';
  let historyHtmlContent = '';
  let styleCssContent = '';
  let commitWidgetContent = '';

  beforeEach(() => {
    homeHtmlContent = fs.readFileSync(homeHtmlPath, 'utf8');
    scenarioHtmlContent = fs.readFileSync(scenarioHtmlPath, 'utf8');
    reportHtmlContent = fs.readFileSync(reportHtmlPath, 'utf8');
    historyHtmlContent = fs.readFileSync(historyHtmlPath, 'utf8');
    styleCssContent = fs.readFileSync(styleCssPath, 'utf8');
    commitWidgetContent = fs.readFileSync(commitWidgetPath, 'utf8');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. AUD-034: Commit Mode Banner on Scenario Screen
  // ─────────────────────────────────────────────────────────────────────────
  describe('AUD-034: Daily Commit Mode Progress Visibility on Scenario Screen', () => {
    it('test_scenario_html_includes_commitBanner_element', () => {
      // Real-World Issue: Commit Mode users practicing a scenario have zero visibility
      // into their daily chat time and scenario requirements.
      expect(scenarioHtmlContent).toMatch(/id=["']commitBanner["']/);
    });

    it('test_scenario_html_imports_and_calls_renderCommitModeBanner', () => {
      expect(scenarioHtmlContent).toMatch(/import\s*\{[^}]*renderCommitModeBanner[^}]*\}\s*from\s*['"]\.\/shared\/commit-mode-widget\.js['"]/);
      expect(scenarioHtmlContent).toMatch(/renderCommitModeBanner\s*\(/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. DES-014: Commit Mode Banner Aesthetics & Natural Micro-Copy
  // ─────────────────────────────────────────────────────────────────────────
  describe('DES-014: Commit Mode Banner Editorial Styling and Warm Copy', () => {
    it('test_commit_mode_widget_eliminates_robotic_jargon_copy', () => {
      // Real-World Issue: Copy like "Scenario baaki" and "Reset 14h 0m tak" feels clunky and unpolished.
      expect(commitWidgetContent).not.toMatch(/Scenario baaki/i);
      expect(commitWidgetContent).not.toMatch(/Reset \d+h \d+m tak/i);
      expect(commitWidgetContent).not.toMatch(/resetting…/i);
    });

    it('test_style_css_does_not_use_legacy_purple_for_commit_mode_banner', () => {
      const bannerRuleMatch = styleCssContent.match(/\.commit-mode-banner\s*\{([^}]+)\}/);
      if (bannerRuleMatch) {
        expect(bannerRuleMatch[1]).not.toMatch(/#6a63f1|#e7e5fd|var\(--accent\)/);
        expect(bannerRuleMatch[1]).toMatch(/var\(--panel-2\)|var\(--card\)|var\(--accent-orange\)/);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. DES-015: Complete Brand Token Unification (No Legacy Purple `--accent`)
  // ─────────────────────────────────────────────────────────────────────────
  describe('DES-015: Elimination of Legacy Purple Tokens Across App Shell', () => {
    it('test_report_html_uses_accent_orange_for_mistake_headers', () => {
      // Real-World Issue: Bold callout headers in reports use old purple #6a63f1, clashing with terracotta theme.
      expect(reportHtmlContent).not.toMatch(/color:\s*var\(--accent\)/);
      expect(reportHtmlContent).not.toMatch(/color:\s*#6a63f1/);
    });

    it('test_history_html_uses_accent_orange_for_user_tags', () => {
      expect(historyHtmlContent).not.toMatch(/color:\s*var\(--accent\)/);
      expect(historyHtmlContent).not.toMatch(/color:\s*#6a63f1/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. DES-016: Streak & Name Flash of Unhydrated Content (FOUC)
  // ─────────────────────────────────────────────────────────────────────────
  describe('DES-016: Home Dashboard Hydration Flash Prevention', () => {
    it('test_home_html_does_not_hardcode_zero_in_initial_streak_DOM', () => {
      // Real-World Issue: A user with an active streak sees "0 Day streak" for 1 second on load, inducing false panic.
      expect(homeHtmlContent).not.toMatch(/<span\s+id=["']homeStreakValue["']>0<\/span>/);
      expect(homeHtmlContent).toMatch(/<span\s+id=["']homeStreakValue["']>[\s–-]*<\/span>|<span\s+id=["']homeStreakValue["'][^>]*class=["'][^"']*skeleton/);
    });

    it('test_home_html_does_not_hardcode_there_in_initial_greeting_DOM', () => {
      expect(homeHtmlContent).not.toMatch(/<h1\s+id=["']homeName["']>there<\/h1>/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. DES-017: Dynamic Banners Cumulative Layout Shift (CLS)
  // ─────────────────────────────────────────────────────────────────────────
  describe('DES-017: Cumulative Layout Shift Prevention on Dynamic Banners', () => {
    it('test_style_css_defines_smooth_slide_down_for_async_banners', () => {
      // Real-World Issue: Announcement and Commit Mode banners pop in suddenly and shift primary CTAs under thumb.
      expect(styleCssContent).toMatch(/@keyframes\s+(bannerSlideDown|bannerExpand|accordionDown)/);
    });
  });
});
