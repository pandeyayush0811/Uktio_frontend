// Role: 10_FunctionalSanityTester & 06_TestWriter
// Target: Reports, History & Profile Loading UX / Real-World Usability
// Issues Tested: DES-018, DES-019

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Functional Sanity & Real-World UI Tests — Reports & History UX (report.html, history.html, profile.html)', () => {
  const reportHtmlPath = path.resolve(__dirname, '../report.html');
  const historyHtmlPath = path.resolve(__dirname, '../history.html');
  const profileHtmlPath = path.resolve(__dirname, '../profile.html');
  const styleCssPath = path.resolve(__dirname, 'style.css');

  let reportHtmlContent = '';
  let historyHtmlContent = '';
  let profileHtmlContent = '';
  let styleCssContent = '';

  beforeEach(() => {
    reportHtmlContent = fs.readFileSync(reportHtmlPath, 'utf8');
    historyHtmlContent = fs.readFileSync(historyHtmlPath, 'utf8');
    profileHtmlContent = fs.readFileSync(profileHtmlPath, 'utf8');
    styleCssContent = fs.readFileSync(styleCssPath, 'utf8');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. DES-018: Skeleton Loading Card Shimmers vs Basic Spinners / Em-Dashes
  // ─────────────────────────────────────────────────────────────────────────
  describe('DES-018: Skeleton Shimmers in History and Profile Screens', () => {
    it('test_history_html_implements_skeleton_card_shimmers', () => {
      // Real-World Issue: Raw spinner and blank screen give no sense of structure while loading past chats.
      expect(historyHtmlContent).toMatch(/class=["'][^"']*(?:skeleton-card|history-skeleton|skeleton-shimmer)[^"']*["']/);
    });

    it('test_profile_html_does_not_rely_on_raw_em_dash_strings', () => {
      // Real-World Issue: Multiple "—" characters look broken and jarring before profile data hydrates.
      const rawEmDashes = (profileHtmlContent.match(/>—<\/span>/g) || []).length;
      expect(rawEmDashes, 'profile.html should use skeleton placeholders instead of raw em-dashes').toBeLessThan(2);
    });

    it('test_style_css_defines_skeleton_shimmer_animation', () => {
      expect(styleCssContent).toMatch(/@keyframes\s+(shimmer|skeletonPulse|skeletonGlow)/);
      expect(styleCssContent).toMatch(/\.skeleton-card|\.skeleton-line|\.skeleton-pill/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. DES-019: Multi-Stage Progress Status During AI Report Generation
  // ─────────────────────────────────────────────────────────────────────────
  describe('DES-019: Dynamic Progress Feedback During Multi-Second AI Report Generation', () => {
    it('test_report_html_implements_dynamic_status_progression', () => {
      // Real-World Issue: A single static spinner with fixed text during a 7-second OpenAI analysis
      // makes users think the app crashed, causing them to press back and lose their report.
      const renderGenerateMatch = reportHtmlContent.match(/function\s+renderGenerateState\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
      expect(renderGenerateMatch, 'renderGenerateState function in report.html').toBeTruthy();

      const body = renderGenerateMatch[1];
      expect(body).toMatch(/setInterval|setTimeout|generationSteps|phaseIndex/);
    });

    it('test_report_html_contains_engaging_coaching_progress_copy', () => {
      expect(reportHtmlContent).toMatch(/Analyzing grammar|Reviewing|Polishing Hinglish coach tips|Crafting/i);
    });
  });
});
