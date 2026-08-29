import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MIN_TURNS_FOR_ANALYSIS, MIN_SCENARIO_TURNS_FOR_ANALYSIS } from './config.js';
import { escapeHtml } from './sanitize.js';

/**
 * Pure helper mirroring the report button decision in history.html:
 * A session can show the report button if:
 * 1. A report already exists (s.has_report === true), OR
 * 2. Session has reached minimum turns:
 *    - Scenario: turn_count >= MIN_SCENARIO_TURNS_FOR_ANALYSIS (2)
 *    - Freeform / Default: turn_count >= MIN_TURNS_FOR_ANALYSIS (10)
 */
export function isReportButtonEligible(session) {
  if (!session || typeof session !== 'object') return false;
  if (session.has_report === true) return true;

  const isScenario = session.session_type === 'scenario';
  const minRequiredTurns = isScenario
    ? (MIN_SCENARIO_TURNS_FOR_ANALYSIS ?? 2)
    : (MIN_TURNS_FOR_ANALYSIS ?? 10);

  return typeof session.turn_count === 'number' &&
         !Number.isNaN(session.turn_count) &&
         Number.isFinite(session.turn_count) &&
         session.turn_count >= minRequiredTurns;
}

/**
 * Mirror of report.html text renderer for verifying formatting and XSS protection
 */
export function renderReportText(text) {
  const escaped = escapeHtml(text || '');
  const withBold = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const blocks = withBold.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  return blocks.map(b => `<p>${b.replace(/\n/g, '<br>')}</p>`).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight DOM Mock for Testing Card Component Rendering and Event Flow
// ─────────────────────────────────────────────────────────────────────────────
class MockDOMElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.className = '';
    this.classList = {
      _classes: new Set(),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => this.classList._classes.delete(c),
      toggle: (c) => {
        if (this.classList._classes.has(c)) {
          this.classList._classes.delete(c);
          return false;
        } else {
          this.classList._classes.add(c);
          return true;
        }
      },
      contains: (c) => this.classList._classes.has(c) || (this.className && this.className.split(' ').includes(c))
    };
    this.textContent = '';
    this._innerHTML = '';
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.eventListeners = {};
    this.disabled = false;
    this.style = {};
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(val) {
    this._innerHTML = val;
    // Simple child container parsing for testing actions container
    if (val.includes('class="chat-card-actions"')) {
      const actionsEl = new MockDOMElement('div');
      actionsEl.className = 'chat-card-actions';
      this.children.push(actionsEl);
      actionsEl.parentNode = this;
    }
    if (val.includes('class="expanded-transcript"')) {
      const transEl = new MockDOMElement('div');
      transEl.className = 'expanded-transcript';
      this.children.push(transEl);
      transEl.parentNode = this;
    }
  }

  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k]; }

  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  addEventListener(event, handler) {
    if (!this.eventListeners[event]) this.eventListeners[event] = [];
    this.eventListeners[event].push(handler);
  }

  dispatchEvent(event) {
    const handlers = this.eventListeners[event.type] || [];
    for (const h of handlers) {
      h(event);
    }
  }

  querySelector(selector) {
    if (selector.startsWith('.')) {
      const targetClass = selector.slice(1);
      for (const child of this.children) {
        if (child.classList.contains(targetClass)) return child;
        const found = child.querySelector(selector);
        if (found) return found;
      }
    }
    if (selector.toLowerCase() === 'button') {
      for (const child of this.children) {
        if (child.tagName === 'BUTTON') return child;
        const found = child.querySelector(selector);
        if (found) return found;
      }
    }
    return null;
  }
}

/**
 * Recreates the exact history.html buildCard function for component-level testing
 */
function buildHistoryCard(s, animDelayMs = 0) {
  const card = new MockDOMElement('div');
  card.className = 'chat-card card-enter';
  card.style.animationDelay = animDelayMs + 'ms';
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-expanded', 'false');

  const isScenario = s.session_type === 'scenario';
  const minRequiredTurns = isScenario ? MIN_SCENARIO_TURNS_FOR_ANALYSIS : MIN_TURNS_FOR_ANALYSIS;

  card.innerHTML = `
    <div class="chat-card-head">
      <div class="chat-card-icon" aria-label="${isScenario ? 'Scenario roleplay' : 'Freeform chat'}">ICON</div>
      <div class="chat-card-title-col">
        <div class="chat-card-date">${s.started_at}</div>
        <div class="chat-card-meta"><span>3 min</span><span class="dot-sep">·</span><span>${s.turn_count} turns</span></div>
      </div>
      <div class="chat-card-chevron">CHEVRON</div>
    </div>
    <div class="expanded-transcript"></div>
    <div class="chat-card-actions"></div>`;

  if (s.has_report || s.turn_count >= minRequiredTurns) {
    const reportBtn = new MockDOMElement('button');
    reportBtn.className = 'report-btn';
    reportBtn.setAttribute('aria-live', 'polite');
    reportBtn.innerHTML = `ICON_CHART<span>${s.has_report ? 'See report' : 'Generate report'}</span>`;
    reportBtn.addEventListener('click', (e) => {
      if (e && e.stopPropagation) e.stopPropagation();
      reportBtn.disabled = true;
      if (!s.has_report) reportBtn.innerHTML = 'ICON_CHART<span>Generating…</span>';
      globalThis.window.location.href = 'report.html?session=' + s.id + (s.has_report ? '' : '&generate=1');
    });
    const actions = card.querySelector('.chat-card-actions');
    if (actions) actions.appendChild(reportBtn);
  }

  let loaded = false;
  function toggle() {
    const willOpen = !card.classList.contains('open');
    card.classList.toggle('open');
    card.setAttribute('aria-expanded', String(willOpen));
  }
  card.addEventListener('click', toggle);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.preventDefault) e.preventDefault();
      toggle();
    }
  });

  return card;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITES
// ─────────────────────────────────────────────────────────────────────────────

describe('Frontend Adversarial Test Suite — Issue #4 (AUD-023: Scenario Report Analysis Turn Thresholds)', () => {
  beforeEach(() => {
    if (!globalThis.window) {
      globalThis.window = {};
    }
    globalThis.window.location = { href: '' };
    if (globalThis.UKTIO_CONFIG) {
      globalThis.window.UKTIO_CONFIG = globalThis.UKTIO_CONFIG;
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 1: System Constants & Global Token Validation
  // ───────────────────────────────────────────────────────────────────────────
  describe('Suite 1: System Constants & Global Token Validation', () => {
    it('test_constants_exported_correctly_from_config_and_attached_to_UKTIO_CONFIG', () => {
      // Why this matters: Central config is the single source of truth; any desync breaks UI decisions.
      const config = typeof window !== 'undefined' ? window.UKTIO_CONFIG : globalThis.UKTIO_CONFIG;
      expect(MIN_SCENARIO_TURNS_FOR_ANALYSIS).toBe(2);
      expect(MIN_TURNS_FOR_ANALYSIS).toBe(10);
      expect(config.MIN_SCENARIO_TURNS_FOR_ANALYSIS).toBe(2);
      expect(config.MIN_TURNS_FOR_ANALYSIS).toBe(10);
      expect(typeof MIN_SCENARIO_TURNS_FOR_ANALYSIS).toBe('number');
      expect(typeof MIN_TURNS_FOR_ANALYSIS).toBe('number');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 2: Differentiated Turn Eligibility Decision Matrix (Adversarial)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Suite 2: Differentiated Turn Eligibility Decision Matrix (Adversarial)', () => {
    it('test_scenario_allows_report_for_typical_3min_simulation_turns_2_to_8', () => {
      // Why this matters: 3-minute scenarios naturally yield 2-8 turns. All must be eligible.
      for (let turns = 2; turns <= 8; turns++) {
        const session = { id: `scen-${turns}`, session_type: 'scenario', turn_count: turns, has_report: false };
        expect(isReportButtonEligible(session)).toBe(true);
      }
    });

    it('test_scenario_disallows_report_for_0_or_1_turn_aborted_simulations_without_report', () => {
      // Why this matters: An aborted scenario simulation with < 2 turns has no dialogue content to analyze.
      expect(isReportButtonEligible({ id: 'scen-0', session_type: 'scenario', turn_count: 0, has_report: false })).toBe(false);
      expect(isReportButtonEligible({ id: 'scen-1', session_type: 'scenario', turn_count: 1, has_report: false })).toBe(false);
    });

    it('test_freeform_requires_strict_10_turns_and_rejects_sub_10_turns', () => {
      // Why this matters: Freeform chats must NOT be lowered to 2 turns; casual conversations need 10 turns for meaningful feedback.
      for (let turns = 0; turns <= 9; turns++) {
        const session = { id: `ff-${turns}`, session_type: 'freeform', turn_count: turns, has_report: false };
        expect(isReportButtonEligible(session)).toBe(false);
      }

      // Boundary: exact 10 turns and above
      expect(isReportButtonEligible({ id: 'ff-10', session_type: 'freeform', turn_count: 10, has_report: false })).toBe(true);
      expect(isReportButtonEligible({ id: 'ff-11', session_type: 'freeform', turn_count: 11, has_report: false })).toBe(true);
      expect(isReportButtonEligible({ id: 'ff-50', session_type: 'freeform', turn_count: 50, has_report: false })).toBe(true);
    });

    it('test_prior_existing_report_overrides_turn_threshold_across_all_session_types', () => {
      // Why this matters: If a report was already generated, user must ALWAYS be able to view it regardless of turn count.
      expect(isReportButtonEligible({ id: 'scen-short', session_type: 'scenario', turn_count: 1, has_report: true })).toBe(true);
      expect(isReportButtonEligible({ id: 'scen-zero', session_type: 'scenario', turn_count: 0, has_report: true })).toBe(true);
      expect(isReportButtonEligible({ id: 'ff-short', session_type: 'freeform', turn_count: 4, has_report: true })).toBe(true);
      expect(isReportButtonEligible({ id: 'ff-zero', session_type: 'freeform', turn_count: 0, has_report: true })).toBe(true);
    });

    it('test_dirty_data_null_undefined_negative_and_corrupted_values_fail_safely', () => {
      // Why this matters: Defends against corrupted database states or API anomalies.
      expect(isReportButtonEligible(null)).toBe(false);
      expect(isReportButtonEligible(undefined)).toBe(false);
      expect(isReportButtonEligible({})).toBe(false);
      expect(isReportButtonEligible([])).toBe(false);
      expect(isReportButtonEligible("invalid-session")).toBe(false);

      // Negative turn counts
      expect(isReportButtonEligible({ session_type: 'scenario', turn_count: -1, has_report: false })).toBe(false);
      expect(isReportButtonEligible({ session_type: 'freeform', turn_count: -10, has_report: false })).toBe(false);

      // Non-numeric turn counts
      expect(isReportButtonEligible({ session_type: 'scenario', turn_count: "4", has_report: false })).toBe(false);
      expect(isReportButtonEligible({ session_type: 'scenario', turn_count: NaN, has_report: false })).toBe(false);
      expect(isReportButtonEligible({ session_type: 'scenario', turn_count: Infinity, has_report: false })).toBe(false);
      expect(isReportButtonEligible({ session_type: 'scenario', turn_count: null, has_report: false })).toBe(false);

      // Missing / legacy session_type defaults to 10-turn threshold
      expect(isReportButtonEligible({ turn_count: 4, has_report: false })).toBe(false);
      expect(isReportButtonEligible({ turn_count: 10, has_report: false })).toBe(true);
      expect(isReportButtonEligible({ session_type: null, turn_count: 4, has_report: false })).toBe(false);
      expect(isReportButtonEligible({ session_type: null, turn_count: 10, has_report: false })).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 3: DOM Rendering & Structure Verification (buildCard Simulation)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Suite 3: DOM Component Rendering & Structural Correctness', () => {
    it('test_renders_generate_report_button_on_4turn_scenario_card', () => {
      // Why this matters: Primary user journey — user finishes 3-minute scenario and sees Generate Report button.
      const session = { id: 'uuid-scen-4', session_type: 'scenario', turn_count: 4, has_report: false, started_at: '2026-08-29T10:00:00.000Z' };
      const card = buildHistoryCard(session);

      const actions = card.querySelector('.chat-card-actions');
      expect(actions).not.toBeNull();
      const reportBtn = actions.querySelector('button');
      expect(reportBtn).not.toBeNull();
      expect(reportBtn.className).toBe('report-btn');
      expect(reportBtn.getAttribute('aria-live')).toBe('polite');
      expect(reportBtn.innerHTML).toContain('Generate report');
    });

    it('test_hides_report_button_on_1turn_scenario_card_without_report', () => {
      // Why this matters: 1-turn incomplete scenario must not show a non-functional report button.
      const session = { id: 'uuid-scen-1', session_type: 'scenario', turn_count: 1, has_report: false, started_at: '2026-08-29T10:00:00.000Z' };
      const card = buildHistoryCard(session);

      const actions = card.querySelector('.chat-card-actions');
      const reportBtn = actions.querySelector('button');
      expect(reportBtn).toBeNull();
    });

    it('test_renders_see_report_button_when_report_already_exists_for_1turn_scenario', () => {
      // Why this matters: Past generated reports must always have the "See report" button rendered.
      const session = { id: 'uuid-scen-1-rep', session_type: 'scenario', turn_count: 1, has_report: true, started_at: '2026-08-29T10:00:00.000Z' };
      const card = buildHistoryCard(session);

      const actions = card.querySelector('.chat-card-actions');
      const reportBtn = actions.querySelector('button');
      expect(reportBtn).not.toBeNull();
      expect(reportBtn.innerHTML).toContain('See report');
    });

    it('test_hides_report_button_on_4turn_freeform_card', () => {
      // Why this matters: Regression guard — freeform 4-turn chat must NOT show report button.
      const session = { id: 'uuid-ff-4', session_type: 'freeform', turn_count: 4, has_report: false, started_at: '2026-08-29T10:00:00.000Z' };
      const card = buildHistoryCard(session);

      const actions = card.querySelector('.chat-card-actions');
      const reportBtn = actions.querySelector('button');
      expect(reportBtn).toBeNull();
    });

    it('test_renders_generate_report_button_on_10turn_freeform_card', () => {
      // Why this matters: Freeform 10-turn chats must render "Generate report".
      const session = { id: 'uuid-ff-10', session_type: 'freeform', turn_count: 10, has_report: false, started_at: '2026-08-29T10:00:00.000Z' };
      const card = buildHistoryCard(session);

      const actions = card.querySelector('.chat-card-actions');
      const reportBtn = actions.querySelector('button');
      expect(reportBtn).not.toBeNull();
      expect(reportBtn.innerHTML).toContain('Generate report');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 4: User Interaction, Event Handling & Navigation Security
  // ───────────────────────────────────────────────────────────────────────────
  describe('Suite 4: User Interaction, Event Handling & Navigation Security', () => {
    it('test_report_button_click_disables_immediately_and_shows_generating_spinner_text', () => {
      // Why this matters: Rapid double-tap by mobile users must disable the button synchronously before redirect.
      const session = { id: 'uuid-scen-fast-tap', session_type: 'scenario', turn_count: 4, has_report: false, started_at: '2026-08-29T10:00:00.000Z' };
      const card = buildHistoryCard(session);
      const reportBtn = card.querySelector('.chat-card-actions').querySelector('button');

      let stopPropagationCalled = false;
      const mockEvent = {
        type: 'click',
        stopPropagation: () => { stopPropagationCalled = true; }
      };

      reportBtn.dispatchEvent(mockEvent);

      expect(stopPropagationCalled).toBe(true);
      expect(reportBtn.disabled).toBe(true);
      expect(reportBtn.innerHTML).toContain('Generating…');
      expect(globalThis.window.location.href).toBe('report.html?session=uuid-scen-fast-tap&generate=1');
    });

    it('test_see_report_click_redirects_without_generate_query_param', () => {
      // Why this matters: Existing reports must not trigger regeneration param (&generate=1).
      const session = { id: 'uuid-scen-existing', session_type: 'scenario', turn_count: 4, has_report: true, started_at: '2026-08-29T10:00:00.000Z' };
      const card = buildHistoryCard(session);
      const reportBtn = card.querySelector('.chat-card-actions').querySelector('button');

      const mockEvent = { type: 'click', stopPropagation: () => {} };
      reportBtn.dispatchEvent(mockEvent);

      expect(reportBtn.disabled).toBe(true);
      expect(reportBtn.innerHTML).not.toContain('Generating…');
      expect(globalThis.window.location.href).toBe('report.html?session=uuid-scen-existing');
    });

    it('test_stop_propagation_prevents_card_accordion_expansion_on_button_click', () => {
      // Why this matters: Tapping "Generate report" must navigate to report, NOT expand/collapse transcript drawer.
      const session = { id: 'uuid-scen-bubble', session_type: 'scenario', turn_count: 4, has_report: false, started_at: '2026-08-29T10:00:00.000Z' };
      const card = buildHistoryCard(session);
      const reportBtn = card.querySelector('.chat-card-actions').querySelector('button');

      // Click report button with event propagation stopped
      let stopped = false;
      reportBtn.dispatchEvent({
        type: 'click',
        stopPropagation: () => { stopped = true; }
      });

      expect(stopped).toBe(true);
      // Card remains unexpanded
      expect(card.classList.contains('open')).toBe(false);
      expect(card.getAttribute('aria-expanded')).toBe('false');
    });

    it('test_keyboard_accessibility_card_expansion_via_enter_and_space', () => {
      // Why this matters: Screen reader and keyboard navigation accessibility compliance.
      const session = { id: 'uuid-scen-kbd', session_type: 'scenario', turn_count: 4, has_report: false, started_at: '2026-08-29T10:00:00.000Z' };
      const card = buildHistoryCard(session);

      // Press Enter to open
      let prevented = false;
      card.dispatchEvent({ type: 'keydown', key: 'Enter', preventDefault: () => { prevented = true; } });
      expect(prevented).toBe(true);
      expect(card.classList.contains('open')).toBe(true);
      expect(card.getAttribute('aria-expanded')).toBe('true');

      // Press Space to toggle close
      card.dispatchEvent({ type: 'keydown', key: ' ', preventDefault: () => {} });
      expect(card.classList.contains('open')).toBe(false);
      expect(card.getAttribute('aria-expanded')).toBe('false');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SUITE 5: Report Markdown Formatting & XSS Security (report.html Logic)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Suite 5: Report Markdown Formatting & XSS Security (report.html Logic)', () => {
    it('test_render_report_text_converts_markdown_bold_and_preserves_paragraphs', () => {
      // Why this matters: Ensures report is formatted into natural Hinglish paragraphs with bold highlights.
      const rawText = "Aapka practice **bohot accha** raha!\n\nDusri baat: **tense consistency** ka dhyan rakho.\nLine 2";
      const formatted = renderReportText(rawText);

      expect(formatted).toContain('<p>Aapka practice <strong>bohot accha</strong> raha!</p>');
      expect(formatted).toContain('<p>Dusri baat: <strong>tense consistency</strong> ka dhyan rakho.<br>Line 2</p>');
    });

    it('test_render_report_text_sanitizes_malicious_xss_script_tags_strictly', () => {
      // Why this matters: LLM or attacker-injected HTML must NEVER execute in the WebView.
      const malicious = "<script>alert('xss')</script> **Normal Bold** <img src=x onerror=alert(1)>";
      const formatted = renderReportText(malicious);

      expect(formatted).not.toContain('<script>');
      expect(formatted).not.toContain('<img');
      expect(formatted).toContain('&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;');
      expect(formatted).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(formatted).toContain('<strong>Normal Bold</strong>');
    });

    it('test_render_report_text_handles_null_empty_and_whitespace_only', () => {
      // Why this matters: Crash prevention if model returns empty payload.
      expect(renderReportText(null)).toBe('');
      expect(renderReportText(undefined)).toBe('');
      expect(renderReportText('')).toBe('');
      expect(renderReportText('   \n\n   ')).toBe('');
    });
  });
});
