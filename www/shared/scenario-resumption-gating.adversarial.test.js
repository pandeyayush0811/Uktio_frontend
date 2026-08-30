import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MIN_TURNS_FOR_ANALYSIS, MIN_SCENARIO_TURNS_FOR_ANALYSIS } from './config.js';
import { escapeHtml } from './sanitize.js';

// Role: 06_TestWriter (Senior Frontend/Backend Adversarial QA)
// Issue: AUD-031 — Incomplete Scenario Report Gating, Suppressed History Resumption & Chat Hijacking
// Scope: Frontend Adversarial Test Suite testing report button gating, history resumption affordances,
// chat page hijack interception, and scenario lifecycle persistence.

/**
 * Pure helper mirroring the report button decision in history.html:
 * Gating conditions for AUD-031:
 * - A report already exists -> true
 * - Scenario session: requires s.is_completed !== false AND turn_count >= MIN_SCENARIO_TURNS_FOR_ANALYSIS (2)
 * - Freeform session: requires turn_count >= MIN_TURNS_FOR_ANALYSIS (10)
 */
export function isReportButtonEligible(session) {
  if (!session || typeof session !== 'object' || Array.isArray(session)) return false;
  if (session.has_report === true) return true;

  const isScenario = session.session_type === 'scenario';
  if (isScenario && session.is_completed === false) {
    return false;
  }

  const minRequiredTurns = isScenario
    ? (MIN_SCENARIO_TURNS_FOR_ANALYSIS ?? 2)
    : (MIN_TURNS_FOR_ANALYSIS ?? 10);

  return typeof session.turn_count === 'number' &&
         !Number.isNaN(session.turn_count) &&
         Number.isFinite(session.turn_count) &&
         session.turn_count >= minRequiredTurns;
}

/**
 * Pure helper mirroring the "Resume scenario" button decision in history.html:
 * Gating conditions for AUD-031:
 * - Session must be a scenario (session_type === 'scenario')
 * - Session must be incomplete (is_completed === false)
 * - Session must not have an already generated report (!has_report)
 */
export function isResumeScenarioEligible(session) {
  if (!session || typeof session !== 'object' || Array.isArray(session)) return false;
  return session.session_type === 'scenario' &&
         session.is_completed === false &&
         !session.has_report;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight DOM Mock for Testing History Card & Action Rendering
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
      <div class="chat-card-icon">${isScenario ? 'ICON_USERS' : 'ICON_MIC'}</div>
      <div class="chat-card-title-col">
        <div class="chat-card-date">${s.started_at || 'Today'}</div>
        <div class="chat-card-meta"><span>${s.turn_count || 0} turns</span></div>
      </div>
      <div class="chat-card-chevron">ICON_CHEVRON</div>
    </div>
    <div class="expanded-transcript"></div>
    <div class="chat-card-actions"></div>`;

  const isEligibleForReport = s.has_report || (
    isScenario
      ? (s.is_completed !== false && s.turn_count >= minRequiredTurns)
      : (s.turn_count >= minRequiredTurns)
  );

  if (isEligibleForReport) {
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
  } else if (isScenario && s.is_completed === false && !s.has_report) {
    const resumeBtn = new MockDOMElement('button');
    resumeBtn.className = 'resume-btn';
    resumeBtn.innerHTML = `ICON_RESUME<span>Resume scenario</span>`;
    resumeBtn.addEventListener('click', (e) => {
      if (e && e.stopPropagation) e.stopPropagation();
      globalThis.window.location.href = 'scenario.html';
    });
    const actions = card.querySelector('.chat-card-actions');
    if (actions) actions.appendChild(resumeBtn);
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
// ADVERSARIAL TEST SUITES
// ─────────────────────────────────────────────────────────────────────────────

describe('Adversarial Test Suite — AUD-031: Incomplete Scenario Report Gating & History Resumption', () => {
  beforeEach(() => {
    globalThis.window = {
      location: { href: '' }
    };
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 1: Pure Decision Matrix for Incomplete vs Completed Scenarios
  // ───────────────────────────────────────────────────────────────────────────
  describe('Suite 1: Pure Decision Matrix for Incomplete vs Completed Scenarios', () => {
    it('test_incomplete_scenario_with_turn_count_0_to_100_strictly_denies_report_generation', () => {
      // Why this matters: AUD-031 core bug — any paused scenario with is_completed: false must NEVER allow report generation.
      const turnCases = [0, 1, 2, 3, 4, 5, 8, 10, 15, 50, 100];
      for (const turns of turnCases) {
        const session = {
          id: `scen-incomplete-${turns}`,
          session_type: 'scenario',
          turn_count: turns,
          is_completed: false,
          has_report: false
        };
        expect(isReportButtonEligible(session)).toBe(false);
        expect(isResumeScenarioEligible(session)).toBe(true);
      }
    });

    it('test_completed_scenario_requires_at_least_2_turns_and_allows_report', () => {
      // Why this matters: Completed scenarios (is_completed: true) with >= 2 turns must show report button and not resume button.
      expect(isReportButtonEligible({ id: 's0', session_type: 'scenario', turn_count: 0, is_completed: true, has_report: false })).toBe(false);
      expect(isReportButtonEligible({ id: 's1', session_type: 'scenario', turn_count: 1, is_completed: true, has_report: false })).toBe(false);
      expect(isResumeScenarioEligible({ id: 's1', session_type: 'scenario', turn_count: 1, is_completed: true, has_report: false })).toBe(false);

      for (let turns = 2; turns <= 10; turns++) {
        const session = {
          id: `scen-comp-${turns}`,
          session_type: 'scenario',
          turn_count: turns,
          is_completed: true,
          has_report: false
        };
        expect(isReportButtonEligible(session)).toBe(true);
        expect(isResumeScenarioEligible(session)).toBe(false);
      }
    });

    it('test_legacy_scenario_omitting_is_completed_defaults_to_completed_true_behavior', () => {
      // Why this matters: Backward compatibility — pre-existing records before migration 017 default to eligible at >= 2 turns.
      expect(isReportButtonEligible({ id: 'legacy-1', session_type: 'scenario', turn_count: 1, has_report: false })).toBe(false);
      expect(isReportButtonEligible({ id: 'legacy-2', session_type: 'scenario', turn_count: 2, has_report: false })).toBe(true);
      expect(isReportButtonEligible({ id: 'legacy-null', session_type: 'scenario', turn_count: 4, is_completed: null, has_report: false })).toBe(true);
      expect(isResumeScenarioEligible({ id: 'legacy-null', session_type: 'scenario', turn_count: 4, is_completed: null, has_report: false })).toBe(false);
    });

    it('test_has_report_true_takes_absolute_precedence_over_is_completed_and_turn_count', () => {
      // Why this matters: If a report already exists in DB, user must ALWAYS be able to see it.
      const anomalousCases = [
        { id: 'rep-1', session_type: 'scenario', turn_count: 0, is_completed: false, has_report: true },
        { id: 'rep-2', session_type: 'scenario', turn_count: 1, is_completed: false, has_report: true },
        { id: 'rep-3', session_type: 'scenario', turn_count: 5, is_completed: false, has_report: true },
        { id: 'rep-4', session_type: 'freeform', turn_count: 2, has_report: true }
      ];

      for (const s of anomalousCases) {
        expect(isReportButtonEligible(s)).toBe(true);
        expect(isResumeScenarioEligible(s)).toBe(false);
      }
    });

    it('test_freeform_session_ignores_is_completed_flag_and_strictly_requires_10_turns', () => {
      // Why this matters: Freeform chats are unconstrained by scenario completion states; must strictly require 10 turns.
      for (let turns = 0; turns <= 9; turns++) {
        expect(isReportButtonEligible({ id: `ff-${turns}`, session_type: 'freeform', turn_count: turns, is_completed: false, has_report: false })).toBe(false);
        expect(isReportButtonEligible({ id: `ff-${turns}`, session_type: 'freeform', turn_count: turns, is_completed: true, has_report: false })).toBe(false);
        expect(isResumeScenarioEligible({ id: `ff-${turns}`, session_type: 'freeform', turn_count: turns, is_completed: false, has_report: false })).toBe(false);
      }

      expect(isReportButtonEligible({ id: 'ff-10', session_type: 'freeform', turn_count: 10, is_completed: false, has_report: false })).toBe(true);
      expect(isReportButtonEligible({ id: 'ff-10', session_type: 'freeform', turn_count: 10, is_completed: true, has_report: false })).toBe(true);
    });

    it('test_corrupted_payloads_and_edge_values_fail_safe_without_throwing', () => {
      // Why this matters: Defends against dirty data, NaN, negative numbers, non-boolean completion types.
      const dirty = [
        null,
        undefined,
        '',
        123,
        [],
        {},
        { session_type: 'scenario', turn_count: -5, is_completed: true },
        { session_type: 'scenario', turn_count: NaN, is_completed: true },
        { session_type: 'scenario', turn_count: Infinity, is_completed: false },
        { session_type: 'scenario', turn_count: '2', is_completed: true },
        { session_type: 'scenario', turn_count: null, is_completed: false }
      ];

      for (const item of dirty) {
        expect(isReportButtonEligible(item)).toBe(false);
        if (!item || !item.session_type || item.session_type !== 'scenario' || item.is_completed !== false) {
          expect(isResumeScenarioEligible(item)).toBe(false);
        }
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 2: History Page Card DOM Rendering & Interaction
  // ───────────────────────────────────────────────────────────────────────────
  describe('Suite 2: History Page Card DOM Actions & Event Behavior', () => {
    it('test_incomplete_scenario_renders_resume_scenario_and_no_report_button', () => {
      // Why this matters: Paused scenario in History must show "Resume scenario" CTA and never "Generate report".
      const session = {
        id: 'scen-paused-001',
        session_type: 'scenario',
        turn_count: 3,
        is_completed: false,
        has_report: false,
        started_at: '2026-08-30T10:00:00.000Z'
      };

      const card = buildHistoryCard(session);
      const actions = card.querySelector('.chat-card-actions');
      expect(actions).not.toBeNull();

      const btn = actions.querySelector('button');
      expect(btn).not.toBeNull();
      expect(btn.className).toBe('resume-btn');
      expect(btn.innerHTML).toContain('Resume scenario');
      expect(btn.innerHTML).not.toContain('Generate report');
    });

    it('test_clicking_resume_scenario_redirects_to_scenario_html_and_stops_accordion_toggle', () => {
      // Why this matters: Tapping resume navigates cleanly to scenario simulator without opening drawer.
      const session = {
        id: 'scen-paused-002',
        session_type: 'scenario',
        turn_count: 4,
        is_completed: false,
        has_report: false
      };

      const card = buildHistoryCard(session);
      const resumeBtn = card.querySelector('.chat-card-actions').querySelector('button');

      let stopProp = false;
      resumeBtn.dispatchEvent({
        type: 'click',
        stopPropagation: () => { stopProp = true; }
      });

      expect(stopProp).toBe(true);
      expect(globalThis.window.location.href).toBe('scenario.html');
      expect(card.classList.contains('open')).toBe(false);
    });

    it('test_completed_scenario_renders_generate_report_and_no_resume_button', () => {
      // Why this matters: Finished scenario in History shows "Generate report" CTA.
      const session = {
        id: 'scen-comp-001',
        session_type: 'scenario',
        turn_count: 4,
        is_completed: true,
        has_report: false,
        started_at: '2026-08-30T10:00:00.000Z'
      };

      const card = buildHistoryCard(session);
      const actions = card.querySelector('.chat-card-actions');
      const btn = actions.querySelector('button');

      expect(btn).not.toBeNull();
      expect(btn.className).toBe('report-btn');
      expect(btn.innerHTML).toContain('Generate report');
      expect(btn.innerHTML).not.toContain('Resume scenario');
    });

    it('test_completed_scenario_with_report_renders_see_report', () => {
      // Why this matters: Analyzed scenario shows "See report" CTA.
      const session = {
        id: 'scen-comp-rep-001',
        session_type: 'scenario',
        turn_count: 4,
        is_completed: true,
        has_report: true,
        started_at: '2026-08-30T10:00:00.000Z'
      };

      const card = buildHistoryCard(session);
      const actions = card.querySelector('.chat-card-actions');
      const btn = actions.querySelector('button');

      expect(btn).not.toBeNull();
      expect(btn.className).toBe('report-btn');
      expect(btn.innerHTML).toContain('See report');
    });

    it('test_generate_report_click_disables_button_and_sets_generating_state', () => {
      // Why this matters: Prevents rapid double-click on mobile devices from firing duplicate requests.
      const session = {
        id: 'scen-comp-tap-001',
        session_type: 'scenario',
        turn_count: 4,
        is_completed: true,
        has_report: false
      };

      const card = buildHistoryCard(session);
      const btn = card.querySelector('.chat-card-actions').querySelector('button');

      let stopProp = false;
      btn.dispatchEvent({
        type: 'click',
        stopPropagation: () => { stopProp = true; }
      });

      expect(stopProp).toBe(true);
      expect(btn.disabled).toBe(true);
      expect(btn.innerHTML).toContain('Generating…');
      expect(globalThis.window.location.href).toBe('report.html?session=scen-comp-tap-001&generate=1');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 3: Chat Page Anti-Hijack Guard
  // ───────────────────────────────────────────────────────────────────────────
  describe('Suite 3: Chat Page Anti-Hijack Guard (`chat.html?resume=<id>`)', () => {
    function simulateChatResumeLoader({ sessionData, fetchError = null, redirectFn, setStatusFn, injectTranscriptFn }) {
      if (fetchError) {
        setStatusFn('Could not load previous chat — you can start a new session.', 'err');
        return { handled: false, error: fetchError };
      }

      if (sessionData && sessionData.session && sessionData.session.session_type === 'scenario') {
        redirectFn('scenario.html');
        return { handled: true, redirected: true, destination: 'scenario.html' };
      }

      const msgs = (sessionData && sessionData.messages) || [];
      if (msgs.length) {
        injectTranscriptFn(msgs);
      }
      setStatusFn('Tap the mic button below to start.', null);
      return { handled: true, redirected: false, injectedMessageCount: msgs.length };
    }

    it('test_chat_page_intercepts_scenario_session_and_redirects_to_scenario_html', () => {
      // Why this matters: AUD-031 hijack prevention — passing scenario ID in ?resume= must redirect to scenario.html immediately.
      let redirectedUrl = null;
      let statusSet = null;
      let injected = false;

      const payload = {
        session: {
          id: 'scen-session-hijack-target',
          session_type: 'scenario',
          turn_count: 3,
          is_completed: false
        },
        messages: [
          { role: 'user', content: 'Table for two please' },
          { role: 'assistant', content: 'Right this way' }
        ]
      };

      const res = simulateChatResumeLoader({
        sessionData: payload,
        redirectFn: (url) => { redirectedUrl = url; },
        setStatusFn: (msg) => { statusSet = msg; },
        injectTranscriptFn: () => { injected = true; }
      });

      expect(res.redirected).toBe(true);
      expect(redirectedUrl).toBe('scenario.html');
      expect(injected).toBe(false); // Transcript must NOT be injected into Bolo coach
    });

    it('test_chat_page_permits_freeform_session_resume_without_redirection', () => {
      // Why this matters: Normal freeform chat resume continues to function seamlessly.
      let redirectedUrl = null;
      let statusSet = null;
      let injectedMessages = null;

      const payload = {
        session: {
          id: 'ff-session-valid',
          session_type: 'freeform',
          turn_count: 4,
          is_completed: true
        },
        messages: [
          { role: 'user', content: 'Hi Bolo' },
          { role: 'assistant', content: 'Hello dost!' }
        ]
      };

      const res = simulateChatResumeLoader({
        sessionData: payload,
        redirectFn: (url) => { redirectedUrl = url; },
        setStatusFn: (msg) => { statusSet = msg; },
        injectTranscriptFn: (msgs) => { injectedMessages = msgs; }
      });

      expect(res.redirected).toBe(false);
      expect(redirectedUrl).toBeNull();
      expect(injectedMessages).not.toBeNull();
      expect(injectedMessages.length).toBe(2);
      expect(statusSet).toContain('Tap the mic button below to start.');
    });

    it('test_chat_page_handles_api_failure_without_redirect_or_crash', () => {
      // Why this matters: Network or 404 error during resume load fails gracefully to clean fresh state.
      let redirectedUrl = null;
      let statusSet = null;
      let statusType = null;

      const res = simulateChatResumeLoader({
        sessionData: null,
        fetchError: new Error('Session not found (404)'),
        redirectFn: (url) => { redirectedUrl = url; },
        setStatusFn: (msg, type) => { statusSet = msg; statusType = type; },
        injectTranscriptFn: () => {}
      });

      expect(res.handled).toBe(false);
      expect(redirectedUrl).toBeNull();
      expect(statusType).toBe('err');
      expect(statusSet).toContain('Could not load previous chat');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 4: Scenario Lifecycle & Resumption Payload Generation
  // ───────────────────────────────────────────────────────────────────────────
  describe('Suite 4: Scenario Lifecycle & Resumption Payload Generation', () => {
    function buildScenarioSyncPayload({
      activeSessionId,
      syncedTurnCount,
      sessionTurns,
      sessionStartedAt,
      scenarioKey,
      isCompleted = false
    }) {
      const meaningful = sessionTurns.filter(t => t.content && t.content.trim());
      if (!meaningful.length) return null;

      if (activeSessionId) {
        const deltaMessages = meaningful.slice(syncedTurnCount);
        if (!deltaMessages.length && !isCompleted) return null;
        return {
          session_id: activeSessionId,
          started_at: sessionStartedAt,
          ended_at: new Date().toISOString(),
          session_type: 'scenario',
          scenario_key: scenarioKey || null,
          is_completed: isCompleted,
          messages: deltaMessages.map(t => ({ role: t.role, content: t.content }))
        };
      }

      return {
        session_id: null,
        started_at: sessionStartedAt,
        ended_at: new Date().toISOString(),
        session_type: 'scenario',
        scenario_key: scenarioKey || null,
        is_completed: isCompleted,
        messages: meaningful.map(t => ({ role: t.role, content: t.content }))
      };
    }

    it('test_in_flight_turns_save_sets_is_completed_false', () => {
      // Why this matters: When user pauses or disconnects mid-roleplay, payload must carry is_completed: false.
      const payload = buildScenarioSyncPayload({
        activeSessionId: null,
        syncedTurnCount: 0,
        sessionTurns: [
          { role: 'user', content: 'Turn 1' },
          { role: 'assistant', content: 'Turn 2' }
        ],
        sessionStartedAt: '2026-08-30T10:00:00.000Z',
        scenarioKey: 'job_interview',
        isCompleted: false
      });

      expect(payload).not.toBeNull();
      expect(payload.is_completed).toBe(false);
      expect(payload.session_type).toBe('scenario');
      expect(payload.messages.length).toBe(2);
    });

    it('test_finalized_sync_explicitly_sets_is_completed_true', () => {
      // Why this matters: When Phase 2 feedback finishes, payload must carry is_completed: true.
      const payload = buildScenarioSyncPayload({
        activeSessionId: 'scen-123',
        syncedTurnCount: 2,
        sessionTurns: [
          { role: 'user', content: 'Turn 1' },
          { role: 'assistant', content: 'Turn 2' },
          { role: 'assistant', content: 'Feedback monologue' }
        ],
        sessionStartedAt: '2026-08-30T10:00:00.000Z',
        scenarioKey: 'job_interview',
        isCompleted: true
      });

      expect(payload).not.toBeNull();
      expect(payload.is_completed).toBe(true);
      expect(payload.session_type).toBe('scenario');
      expect(payload.messages.length).toBe(1); // delta turn
    });

    it('test_finalized_sync_with_zero_delta_turns_still_dispatches_payload_to_mark_completion', () => {
      // Why this matters: If all speech turns were already synced, finalization MUST still dispatch to update is_completed = true in DB.
      const payload = buildScenarioSyncPayload({
        activeSessionId: 'scen-456',
        syncedTurnCount: 3,
        sessionTurns: [
          { role: 'user', content: 'Turn 1' },
          { role: 'assistant', content: 'Turn 2' },
          { role: 'assistant', content: 'Turn 3' }
        ],
        sessionStartedAt: '2026-08-30T10:00:00.000Z',
        scenarioKey: 'job_interview',
        isCompleted: true
      });

      expect(payload).not.toBeNull();
      expect(payload.is_completed).toBe(true);
      expect(payload.messages.length).toBe(0); // empty delta is permitted when is_completed: true
    });

    it('test_intermediate_sync_with_zero_delta_turns_and_is_completed_false_suppresses_redundant_call', () => {
      // Why this matters: In-flight turn boundary check avoids hammering the backend if no new speech occurred.
      const payload = buildScenarioSyncPayload({
        activeSessionId: 'scen-456',
        syncedTurnCount: 3,
        sessionTurns: [
          { role: 'user', content: 'Turn 1' },
          { role: 'assistant', content: 'Turn 2' },
          { role: 'assistant', content: 'Turn 3' }
        ],
        sessionStartedAt: '2026-08-30T10:00:00.000Z',
        scenarioKey: 'job_interview',
        isCompleted: false
      });

      expect(payload).toBeNull();
    });
  });
});
