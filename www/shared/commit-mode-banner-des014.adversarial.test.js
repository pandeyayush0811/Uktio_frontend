// Role: 06_TestWriter (Senior Frontend Adversarial QA)
// Issue: #DES-014 (Commit Mode Progress Banner Aesthetic Redesign & Micro-Copy Modernization)
// Scope: www/shared/commit-mode-widget.js, www/shared/style.css (lines 703-718), chat.html, home.html

import './config.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getCommitModeProgress, renderCommitModeBanner } from './commit-mode-widget.js';
import * as authModule from './auth.js';
import { invalidateAllCache } from './api-cache.js';

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.className = '';
    this.style = {};
    this.classList = {
      _classes: new Set(),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => this.classList._classes.delete(c),
      contains: (c) => this.classList._classes.has(c) || (this.className && this.className.includes(c)),
      toggle: (c, force) => {
        if (force === true) this.classList.add(c);
        else if (force === false) this.classList.remove(c);
        else if (this.classList.contains(c)) this.classList.remove(c);
        else this.classList.add(c);
      }
    };
    this.children = [];
    this._textContent = '';
  }

  get textContent() {
    if (this.children.length > 0) {
      return this.children.map(c => c.textContent).join(' ');
    }
    return this._textContent;
  }

  set textContent(v) {
    this._textContent = String(v);
    this.children = [];
  }

  set innerHTML(html) {
    if (html === '') {
      this.children = [];
      this._textContent = '';
    }
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }
}

function makeStorageMock() {
  const mock = {};
  Object.defineProperties(mock, {
    getItem: { value: (k) => (k in mock ? mock[k] : null), writable: true, configurable: true },
    setItem: { value: (k, v) => { mock[k] = String(v); }, writable: true, configurable: true },
    removeItem: { value: (k) => { delete mock[k]; }, writable: true, configurable: true },
    clear: { value: () => { for (const k of Object.keys(mock)) delete mock[k]; }, writable: true, configurable: true }
  });
  return mock;
}

describe('Adversarial & Hardcore Test Suite — Issue #DES-014: Commit Mode Banner Aesthetics & Micro-Copy Modernization', () => {
  const styleCssPath = path.resolve(__dirname, 'style.css');
  const commitWidgetPath = path.resolve(__dirname, 'commit-mode-widget.js');
  const chatHtmlPath = path.resolve(__dirname, '../chat.html');
  const homeHtmlPath = path.resolve(__dirname, '../home.html');

  let styleCssContent = '';
  let commitWidgetContent = '';
  let chatHtmlContent = '';
  let homeHtmlContent = '';

  let containerEl;
  let originalDocument;
  let originalWindow;
  let originalFetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.sessionStorage = makeStorageMock();
    globalThis.localStorage = makeStorageMock();

    originalWindow = globalThis.window;
    originalFetch = globalThis.fetch;
    originalDocument = globalThis.document;

    globalThis.document = {
      createElement: (tag) => new MockElement(tag)
    };

    globalThis.window = {
      location: { href: 'http://localhost/chat.html' },
      UKTIO_CONFIG: { BACKEND_URL: 'https://utkio-backend.onrender.com' }
    };
    globalThis.UKTIO_CONFIG = globalThis.window.UKTIO_CONFIG;

    containerEl = new MockElement('div');
    invalidateAllCache();

    styleCssContent = fs.readFileSync(styleCssPath, 'utf8');
    commitWidgetContent = fs.readFileSync(commitWidgetPath, 'utf8');
    chatHtmlContent = fs.readFileSync(chatHtmlPath, 'utf8');
    homeHtmlContent = fs.readFileSync(homeHtmlPath, 'utf8');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
    globalThis.document = originalDocument;
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 1: Master Stylesheet Brand Token Integrity & No Legacy Purple
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 1: Master Stylesheet Brand Token Compliance (style.css)', () => {

    it('test_commit_mode_banner_uses_warm_terracotta_panel_and_line_border', () => {
      // Why this matters: The progress banner must seamlessly blend with the warm terracotta luxury palette.
      const bannerRuleMatch = styleCssContent.match(/\.commit-mode-banner\s*\{([^}]+)\}/);
      expect(bannerRuleMatch, '.commit-mode-banner rule must exist in style.css').toBeTruthy();

      const block = bannerRuleMatch[1];
      expect(block).toMatch(/background\s*:\s*var\(--panel-2\)/i);
      expect(block).toMatch(/border\s*:\s*1px solid var\(--line\)/i);
      expect(block).toMatch(/border-radius\s*:\s*16px/i);
    });

    it('test_commit_mode_banner_purges_legacy_purple_and_neon_variables', () => {
      // Why this matters: Legacy electric purple tokens (#6a63f1, #e7e5fd) clash with brand identity.
      const bannerRuleMatch = styleCssContent.match(/\.commit-mode-banner\s*\{([^}]+)\}/);
      expect(bannerRuleMatch).toBeTruthy();

      const block = bannerRuleMatch[1];
      expect(block).not.toMatch(/#6a63f1/i);
      expect(block).not.toMatch(/#e7e5fd/i);
      expect(block).not.toMatch(/var\(--accent-soft\)/i);
      expect(block).not.toMatch(/var\(--accent\)/i);
    });

    it('test_commit_mode_banner_done_uses_organic_warm_success_styling', () => {
      // Why this matters: Completed banner state must use warm organic green instead of harsh neon mint (#e3f7ea).
      const bannerDoneMatch = styleCssContent.match(/\.commit-mode-banner\.commit-mode-done\s*\{([^}]+)\}/);
      expect(bannerDoneMatch, '.commit-mode-banner.commit-mode-done rule must exist').toBeTruthy();

      const block = bannerDoneMatch[1];
      expect(block).toMatch(/background\s*:\s*#EEF7EE/i);
      expect(block).toMatch(/border\s*:\s*1px solid rgba\(\s*46\s*,\s*125\s*,\s*50\s*,\s*0\.22\s*\)/i);
      expect(block).not.toMatch(/#e3f7ea/i);
      expect(block).not.toMatch(/#6a63f1/i);
    });

    it('test_commit_mode_chip_uncompleted_has_pill_geometry_and_neutral_styling', () => {
      // Why this matters: Uncompleted chips must display crisp pill geometry with clean neutral borders.
      const chipMatch = styleCssContent.match(/\.commit-mode-chip\s*\{([^}]+)\}/);
      expect(chipMatch, '.commit-mode-chip rule must exist').toBeTruthy();

      const block = chipMatch[1];
      expect(block).toMatch(/border-radius\s*:\s*999px/i);
      expect(block).toMatch(/background\s*:\s*#FFFFFF/i);
      expect(block).toMatch(/color\s*:\s*var\(--ink-dim\)/i);
      expect(block).toMatch(/border\s*:\s*1px solid var\(--line\)/i);
      expect(block).toMatch(/font-weight\s*:\s*700/i);
    });

    it('test_commit_mode_chip_done_uses_accent_orange_luxury_tokens', () => {
      // Why this matters: Completed task chips must highlight in vibrant terracotta orange, not legacy purple.
      const chipDoneMatch = styleCssContent.match(/\.commit-mode-chip\.done\s*\{([^}]+)\}/);
      expect(chipDoneMatch, '.commit-mode-chip.done rule must exist').toBeTruthy();

      const block = chipDoneMatch[1];
      expect(block).toMatch(/background\s*:\s*var\(--accent-orange\)/i);
      expect(block).toMatch(/color\s*:\s*#FFFFFF/i);
      expect(block).toMatch(/border-color\s*:\s*var\(--accent-orange\)/i);
      expect(block).not.toMatch(/var\(--accent\)/i);
      expect(block).not.toMatch(/#6a63f1/i);
    });

    it('test_commit_mode_countdown_typography_and_contrast', () => {
      // Why this matters: Countdown timer text must use readable muted ink with medium-bold weight.
      const countdownMatch = styleCssContent.match(/\.commit-mode-countdown\s*\{([^}]+)\}/);
      expect(countdownMatch, '.commit-mode-countdown rule must exist').toBeTruthy();

      const block = countdownMatch[1];
      expect(block).toMatch(/color\s*:\s*var\(--ink-dim\)/i);
      expect(block).toMatch(/font-weight\s*:\s*600/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 2: Strict Micro-Copy & Anti-Jargon Guardrails (commit-mode-widget.js)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 2: Strict Anti-Jargon Micro-Copy Guardrails (commit-mode-widget.js)', () => {

    it('test_source_code_strictly_purges_all_robotic_copy_fragments', () => {
      // Why this matters: Ensure no robotic Hindi particles (" tak", "baaki") or raw ellipsis exist in source.
      expect(commitWidgetContent).not.toMatch(/Scenario baaki/i);
      expect(commitWidgetContent).not.toMatch(/tak/i);
      expect(commitWidgetContent).not.toMatch(/resetting…/i);
      expect(commitWidgetContent).not.toMatch(/Reset \d+h \d+m tak/i);
    });

    it('test_format_countdown_zero_and_negative_ms_returns_resets_soon', async () => {
      // Why this matters: When timer expires (0 ms or negative delta past midnight), show clean "Resets soon".
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        chat_seconds_done: 0,
        chat_seconds_required: 300,
        chat_requirement_met: false,
        scenario_requirement_met: false,
        ms_until_reset: 0
      });

      await renderCommitModeBanner(containerEl, { plan: 'commit_mode' });
      expect(containerEl.textContent).toContain('Resets soon');
      expect(containerEl.textContent).not.toContain('Reset in');
      expect(containerEl.textContent).not.toContain('resetting…');
    });

    it('test_format_countdown_negative_drift_past_midnight_returns_resets_soon', async () => {
      // Why this matters: Late background sync slightly past midnight must not render negative time strings.
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        chat_seconds_done: 50,
        chat_seconds_required: 300,
        chat_requirement_met: false,
        scenario_requirement_met: false,
        ms_until_reset: -45000 // -45 seconds
      });

      await renderCommitModeBanner(containerEl, { plan: 'commit_mode' });
      expect(containerEl.textContent).toContain('Resets soon');
      expect(containerEl.textContent).not.toMatch(/-?\d+h/);
    });

    it('test_format_countdown_sub_hour_duration_omits_redundant_zero_hours', async () => {
      // Why this matters: 45 minutes should render as "Reset in 45m", not awkward "Reset in 0h 45m".
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        chat_seconds_done: 0,
        chat_seconds_required: 300,
        chat_requirement_met: false,
        scenario_requirement_met: false,
        ms_until_reset: 45 * 60 * 1000 // 45 minutes
      });

      await renderCommitModeBanner(containerEl, { plan: 'commit_mode' });
      expect(containerEl.textContent).toContain('Reset in 45m');
      expect(containerEl.textContent).not.toContain('0h');
    });

    it('test_format_countdown_exact_hour_and_minute_values', async () => {
      // Why this matters: Standard hours & minutes (14 hours 20 mins) formatted cleanly.
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        chat_seconds_done: 0,
        chat_seconds_required: 300,
        chat_requirement_met: false,
        scenario_requirement_met: false,
        ms_until_reset: (14 * 3600 + 20 * 60) * 1000 // 14h 20m
      });

      await renderCommitModeBanner(containerEl, { plan: 'commit_mode' });
      expect(containerEl.textContent).toContain('Reset in 14h 20m');
    });

    it('test_format_countdown_exactly_one_hour', async () => {
      // Why this matters: 1 hour boundary (60 mins) formats as "1h 0m".
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        chat_seconds_done: 0,
        chat_seconds_required: 300,
        chat_requirement_met: false,
        scenario_requirement_met: false,
        ms_until_reset: 3600 * 1000 // 1h
      });

      await renderCommitModeBanner(containerEl, { plan: 'commit_mode' });
      expect(containerEl.textContent).toContain('Reset in 1h 0m');
    });

    it('test_format_countdown_under_one_minute_positive', async () => {
      // Why this matters: 30 seconds remaining renders as "Reset in 0m".
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        chat_seconds_done: 0,
        chat_seconds_required: 300,
        chat_requirement_met: false,
        scenario_requirement_met: false,
        ms_until_reset: 30 * 1000 // 30s
      });

      await renderCommitModeBanner(containerEl, { plan: 'commit_mode' });
      expect(containerEl.textContent).toContain('Reset in 0m');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 3: Dynamic DOM State Machine & Chip Progression Matrix
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 3: Dynamic DOM Hierarchy & Chip State Progression', () => {

    it('test_matrix_state_1_brand_new_day_nothing_completed', async () => {
      // Why this matters: Morning state — chat at 0/5 min, scenario pending, countdown active.
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        chat_seconds_done: 0,
        chat_seconds_required: 300,
        chat_requirement_met: false,
        scenario_requirement_met: false,
        ms_until_reset: 10 * 3600 * 1000
      });

      await renderCommitModeBanner(containerEl, { plan: 'commit_mode' });

      expect(containerEl.children.length).toBe(3);
      const [chatChip, scenarioChip, countdown] = containerEl.children;

      expect(chatChip.textContent).toBe('Chat 0/5 min');
      expect(chatChip.className).toBe('commit-mode-chip');
      expect(chatChip.className).not.toContain('done');

      expect(scenarioChip.textContent).toBe('Scenario: Pending');
      expect(scenarioChip.className).toBe('commit-mode-chip');
      expect(scenarioChip.className).not.toContain('done');

      expect(countdown.textContent).toBe('Reset in 10h 0m');
      expect(containerEl.className).toBe('commit-mode-banner');
      expect(containerEl.className).not.toContain('commit-mode-done');
    });

    it('test_matrix_state_2_partial_chat_progress_scenario_pending', async () => {
      // Why this matters: User did 3m 40s (220s) of practice — floor minutes gives 3/5 min.
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        chat_seconds_done: 220,
        chat_seconds_required: 300,
        chat_requirement_met: false,
        scenario_requirement_met: false,
        ms_until_reset: 6 * 3600 * 1000
      });

      await renderCommitModeBanner(containerEl, { plan: 'commit_mode' });

      const [chatChip, scenarioChip] = containerEl.children;
      expect(chatChip.textContent).toBe('Chat 3/5 min');
      expect(chatChip.className).not.toContain('done');
      expect(scenarioChip.textContent).toBe('Scenario: Pending');
      expect(scenarioChip.className).not.toContain('done');
    });

    it('test_matrix_state_3_chat_completed_scenario_pending', async () => {
      // Why this matters: Chat goal reached (≥5 min) — chat chip turns into "✓ Chat" with done class.
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        chat_seconds_done: 300,
        chat_seconds_required: 300,
        chat_requirement_met: true,
        scenario_requirement_met: false,
        ms_until_reset: 4 * 3600 * 1000
      });

      await renderCommitModeBanner(containerEl, { plan: 'commit_mode' });

      const [chatChip, scenarioChip, countdown] = containerEl.children;
      expect(chatChip.textContent).toBe('✓ Chat');
      expect(chatChip.className).toContain('done');

      expect(scenarioChip.textContent).toBe('Scenario: Pending');
      expect(scenarioChip.className).not.toContain('done');

      expect(countdown.textContent).toBe('Reset in 4h 0m');
      expect(containerEl.className).not.toContain('commit-mode-done');
    });

    it('test_matrix_state_4_scenario_completed_chat_pending', async () => {
      // Why this matters: Learner did scenario simulation first — scenario chip turns into "✓ Scenario".
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        chat_seconds_done: 120,
        chat_seconds_required: 300,
        chat_requirement_met: false,
        scenario_requirement_met: true,
        ms_until_reset: 8 * 3600 * 1000
      });

      await renderCommitModeBanner(containerEl, { plan: 'commit_mode' });

      const [chatChip, scenarioChip] = containerEl.children;
      expect(chatChip.textContent).toBe('Chat 2/5 min');
      expect(chatChip.className).not.toContain('done');

      expect(scenarioChip.textContent).toBe('✓ Scenario');
      expect(scenarioChip.className).toContain('done');

      expect(containerEl.className).not.toContain('commit-mode-done');
    });

    it('test_matrix_state_5_both_completed_celebratory_banner', async () => {
      // Why this matters: Daily requirement met — banner turns green, chips both checked, celebratory text.
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        chat_seconds_done: 320,
        chat_seconds_required: 300,
        chat_requirement_met: true,
        scenario_requirement_met: true,
        ms_until_reset: 2 * 3600 * 1000
      });

      await renderCommitModeBanner(containerEl, { plan: 'commit_mode' });

      const [chatChip, scenarioChip, countdown] = containerEl.children;
      expect(chatChip.textContent).toBe('✓ Chat');
      expect(chatChip.className).toContain('done');

      expect(scenarioChip.textContent).toBe('✓ Scenario');
      expect(scenarioChip.className).toContain('done');

      expect(countdown.textContent).toBe('Aaj ka Commit Mode complete ✓');
      expect(containerEl.className).toBe('commit-mode-banner commit-mode-done');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 4: Adversarial Re-Rendering, Extreme Durations & Safety Gates
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 4: Adversarial Re-Rendering & Input Extremes', () => {

    it('test_rapid_consecutive_rerenders_do_not_leak_or_duplicate_dom_nodes', async () => {
      // Why this matters: Calling render repeatedly as chat progress updates must cleanly replace innerHTML.
      const spy = vi.spyOn(authModule, 'apiFetch');

      for (let i = 1; i <= 5; i++) {
        invalidateAllCache();
        spy.mockResolvedValueOnce({
          chat_seconds_done: i * 60,
          chat_seconds_required: 300,
          chat_requirement_met: i >= 5,
          scenario_requirement_met: false,
          ms_until_reset: 3600000
        });

        await renderCommitModeBanner(containerEl, { plan: 'commit_mode' });
        expect(containerEl.children.length, `Iteration ${i} must strictly have 3 children`).toBe(3);
      }
    });

    it('test_extreme_chat_duration_overage_does_not_break_formatting', async () => {
      // Why this matters: Heavy user talks for 2 hours (7200s done vs 300s required).
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        chat_seconds_done: 7200,
        chat_seconds_required: 300,
        chat_requirement_met: true,
        scenario_requirement_met: true,
        ms_until_reset: 5000000
      });

      await renderCommitModeBanner(containerEl, { plan: 'commit_mode' });
      expect(containerEl.textContent).toContain('✓ Chat');
      expect(containerEl.textContent).toContain('Aaj ka Commit Mode complete ✓');
    });

    it('test_boundary_seconds_precision_and_rounding', async () => {
      // Why this matters: 299s done (4m 59s) must show 4/5 min, not prematurely claim 5 min.
      vi.spyOn(authModule, 'apiFetch').mockResolvedValue({
        chat_seconds_done: 299,
        chat_seconds_required: 300,
        chat_requirement_met: false,
        scenario_requirement_met: false,
        ms_until_reset: 1000000
      });

      await renderCommitModeBanner(containerEl, { plan: 'commit_mode' });
      expect(containerEl.textContent).toContain('Chat 4/5 min');
      expect(containerEl.textContent).not.toContain('✓ Chat');
    });

    it('test_null_or_undefined_container_element_returns_cleanly_without_throwing', async () => {
      // Why this matters: If banner element is not present on page, function must exit cleanly.
      await expect(renderCommitModeBanner(null, { plan: 'commit_mode' })).resolves.toBeUndefined();
      await expect(renderCommitModeBanner(undefined, { plan: 'commit_mode' })).resolves.toBeUndefined();
    });

    it('test_non_commit_mode_plans_hide_element_immediately_without_api_call', async () => {
      // Why this matters: Free, Starter, or Unlimited plans should never fetch commit progress or show banner.
      const spy = vi.spyOn(authModule, 'apiFetch');

      const nonCommitPlans = [
        null,
        undefined,
        {},
        { plan: 'starter' },
        { plan: 'none' },
        { plan: 'unlimited' },
        { plan: '' },
        { plan: 99 }
      ];

      for (const status of nonCommitPlans) {
        containerEl.style.display = 'flex';
        await renderCommitModeBanner(containerEl, status);
        expect(containerEl.style.display).toBe('none');
        expect(spy).not.toHaveBeenCalled();
      }
    });

    it('test_network_error_fails_open_cleanly_hiding_banner', async () => {
      // Why this matters: Motivational widget must fail-open silently on network failure.
      vi.spyOn(authModule, 'apiFetch').mockRejectedValue(new Error('Network 500'));

      containerEl.style.display = 'flex';
      await renderCommitModeBanner(containerEl, { plan: 'commit_mode' });
      expect(containerEl.style.display).toBe('none');
      expect(containerEl.children.length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 5: Sibling Consumers & Page Integration Verification
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 5: Sibling Page Consumers Integration (chat.html & home.html)', () => {

    it('test_chat_html_contains_commit_mode_banner_placeholder_and_module_call', () => {
      // Why this matters: chat.html is the primary surface where the commit mode banner is rendered.
      expect(chatHtmlContent).toMatch(/id=["']commitModeBanner["']/);
      expect(chatHtmlContent).toMatch(/renderCommitModeBanner\s*\(/);
      expect(chatHtmlContent).toMatch(/import\s*\{[^}]*renderCommitModeBanner[^}]*\}\s*from\s*['"]\.\/shared\/commit-mode-widget\.js['"]/);
    });

    it('test_home_html_contains_commit_mode_banner_placeholder_and_module_call', () => {
      // Why this matters: home.html dashboard displays the daily accountability progress banner.
      expect(homeHtmlContent).toMatch(/id=["']commitBanner["']/);
      expect(homeHtmlContent).toMatch(/renderCommitModeBanner\s*\(/);
      expect(homeHtmlContent).toMatch(/import\s*\{[^}]*renderCommitModeBanner[^}]*\}\s*from\s*['"]\.\/shared\/commit-mode-widget\.js['"]/);
    });
  });
});
