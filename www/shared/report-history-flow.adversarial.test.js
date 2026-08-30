import './config.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { escapeHtml } from './sanitize.js';

function renderReportText(text) {
  const escaped = escapeHtml(text || '');
  const withBold = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const blocks = withBold.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  return blocks.map(b => `<p>${b.replace(/\n/g, '<br>')}</p>`).join('');
}

describe('Adversarial & Hardcore Test Suite — Phase 7: AI Feedback Report & Practice History (report.html & history.html)', () => {
  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 1: Report Markdown & XSS Defense (report.html)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 1: Report Formatting & XSS Sanitization (report.html)', () => {
    it('test_renderReportText_converts_markdown_bold_and_newlines_safely', () => {
      const input = `**Strengths**\nYou spoke clearly with good flow.\n\n**Mistakes & Corrections**\n1. **Wrong:** He go there\n**Right:** He went there`;
      const html = renderReportText(input);

      expect(html).toContain('<strong>Strengths</strong>');
      expect(html).toContain('<strong>Wrong:</strong>');
      expect(html).toContain('<strong>Right:</strong>');
      expect(html).toContain('<p>');
      expect(html).toContain('</p>');
    });

    it('test_renderReportText_strictly_escapes_xss_injections_inside_markdown', () => {
      const malicious = `**<script>alert('xss')</script>**\n\n<img src=x onerror=alert(1)>`;
      const html = renderReportText(malicious);

      expect(html).not.toContain('<script>');
      expect(html).not.toContain('<img');
      expect(html).toContain('&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;');
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('test_renderReportText_handles_empty_null_or_spaces_without_crashing', () => {
      expect(renderReportText('')).toBe('');
      expect(renderReportText(null)).toBe('');
      expect(renderReportText(undefined)).toBe('');
      expect(renderReportText('   \n\n   ')).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 2: Report Generation State Machine & 409/402 Handlers (report.html)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 2: Report Generation Concurrency & Status Handling (report.html)', () => {
    function createReportGenerationHarness(sessionId = 'sess-123') {
      let generateInFlight = false;
      let currentState = 'initial';
      let stateMessage = '';
      let renderedReport = null;
      let pollCount = 0;

      async function generateReport(mockAnalyzeCall, mockReportPollCall) {
        if (generateInFlight) return 'duplicate_blocked';
        generateInFlight = true;
        currentState = 'generating';
        stateMessage = 'Generating analysis report...';

        try {
          const data = await mockAnalyzeCall(sessionId);
          currentState = 'completed';
          renderedReport = data.report;
          return 'done';
        } catch (err) {
          if (err.status === 409) {
            // Concurrent request already claimed analysis -> switch to polling
            currentState = 'polling';
            return await pollForReport(mockReportPollCall);
          }
          if (err.status === 402) {
            currentState = 'quota_exhausted';
            stateMessage = 'Report Limit Reached';
            return 'paywall';
          }
          currentState = 'error';
          stateMessage = err.message || 'Could not generate report';
          return 'error';
        } finally {
          generateInFlight = false;
        }
      }

      async function pollForReport(mockReportPollCall) {
        for (let i = 0; i < 5; i++) {
          pollCount++;
          try {
            const data = await mockReportPollCall(sessionId);
            if (data && data.report_text) {
              currentState = 'completed';
              renderedReport = data;
              return 'polled_success';
            }
          } catch (e) {
            // Still generating, continue polling
          }
        }
        currentState = 'poll_timeout';
        return 'poll_timeout';
      }

      return {
        getState: () => currentState,
        getMessage: () => stateMessage,
        getReport: () => renderedReport,
        getPollCount: () => pollCount,
        generateReport
      };
    }

    it('test_generateReport_handles_409_by_polling_for_active_generation', async () => {
      const harness = createReportGenerationHarness('sess-100');

      const mockAnalyze = vi.fn().mockRejectedValue({ status: 409, message: 'Already generating' });
      const mockPoll = vi.fn()
        .mockRejectedValueOnce(new Error('Not ready yet'))
        .mockResolvedValueOnce({ report_text: '**Great job!** You improved your fluency.' });

      const result = await harness.generateReport(mockAnalyze, mockPoll);

      expect(result).toBe('polled_success');
      expect(harness.getState()).toBe('completed');
      expect(harness.getReport().report_text).toContain('Great job');
      expect(harness.getPollCount()).toBe(2);
    });

    it('test_generateReport_handles_402_trial_limit_reached_with_paywall_screen', async () => {
      const harness = createReportGenerationHarness('sess-101');

      const mockAnalyze = vi.fn().mockRejectedValue({ status: 402, message: 'Trial reports limit reached' });
      const result = await harness.generateReport(mockAnalyze, vi.fn());

      expect(result).toBe('paywall');
      expect(harness.getState()).toBe('quota_exhausted');
      expect(harness.getMessage()).toBe('Report Limit Reached');
    });

    it('test_generateReport_blocks_duplicate_clicks_during_in_flight_generation', async () => {
      const harness = createReportGenerationHarness('sess-102');
      let resolveAnalyze;
      const mockAnalyze = () => new Promise((res) => { resolveAnalyze = res; });

      const p1 = harness.generateReport(mockAnalyze, vi.fn());
      const p2 = harness.generateReport(mockAnalyze, vi.fn());

      expect(await p2).toBe('duplicate_blocked');

      resolveAnalyze({ report: { report_text: 'Report ready' } });
      expect(await p1).toBe('done');
      expect(harness.getState()).toBe('completed');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 3: History Search & Regex Injection Defense (history.html)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 3: History Search & Regex Injection Defense (history.html)', () => {
    function filterSessions(sessions, query) {
      const q = (query || '').trim().toLowerCase();
      if (!q) return sessions;
      return sessions.filter(s => {
        const title = (s.scenario_title || s.session_type || '').toLowerCase();
        const preview = (s.last_message || '').toLowerCase();
        return title.includes(q) || preview.includes(q);
      });
    }

    it('test_history_search_safely_handles_special_regex_characters_without_crashing', () => {
      const sessions = [
        { id: '1', scenario_title: 'Ordering Food at (Restaurant)', last_message: 'Can I have the menu?' },
        { id: '2', scenario_title: 'Job Interview [Tech]', last_message: 'Tell me about yourself.' },
        { id: '3', scenario_title: 'Asking Directions', last_message: 'Where is the metro station?' }
      ];

      // Query with regex metacharacters
      expect(filterSessions(sessions, '(')).toHaveLength(1);
      expect(filterSessions(sessions, '[Tech]')).toHaveLength(1);
      expect(filterSessions(sessions, '.*')).toHaveLength(0);
      expect(filterSessions(sessions, '+')).toHaveLength(0);
      expect(filterSessions(sessions, '?')).toHaveLength(2); // literal question marks in message 1 and 3
      expect(filterSessions(sessions, '\\')).toHaveLength(0);
    });

    it('test_history_search_matches_both_title_and_message_content_case_insensitively', () => {
      const sessions = [
        { id: '1', scenario_title: 'Restaurant Roleplay', last_message: 'I want chicken soup' },
        { id: '2', scenario_title: 'General Chat', last_message: 'Good morning Bolo' }
      ];

      expect(filterSessions(sessions, 'restaurant')).toHaveLength(1);
      expect(filterSessions(sessions, 'CHICKEN')).toHaveLength(1);
      expect(filterSessions(sessions, 'bolo')).toHaveLength(1);
      expect(filterSessions(sessions, 'nonexistent')).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SUITE 4: Incomplete Scenario Resumption vs Report Gating (AUD-031)
  // ═══════════════════════════════════════════════════════════════════════
  describe('Suite 4: Incomplete Scenario Resumption & Report Gating (AUD-031)', () => {
    function computeHistoryCardActions(session) {
      const isScenario = session.session_type === 'scenario';
      const isCompleted = session.is_completed === true;
      const turnCount = session.turn_count || 0;
      const hasReport = session.has_report === true;

      const actions = [];

      if (isScenario) {
        if (!isCompleted) {
          actions.push({ type: 'resume', label: 'Resume this scenario', href: `scenario.html?resume=${session.id}` });
        } else {
          if (hasReport) {
            actions.push({ type: 'view_report', label: '📊 View report', href: `report.html?session=${session.id}` });
          } else {
            actions.push({ type: 'generate_report', label: '📊 Generate report', href: `report.html?session=${session.id}&generate=1` });
          }
        }
      } else {
        // Freeform chat
        actions.push({ type: 'resume', label: 'Resume this chat', href: `chat.html?resume=${session.id}` });
        if (hasReport) {
          actions.push({ type: 'view_report', label: '📊 View report', href: `report.html?session=${session.id}` });
        } else if (turnCount >= 10) {
          actions.push({ type: 'generate_report', label: '📊 Generate report', href: `report.html?session=${session.id}&generate=1` });
        }
      }

      return actions;
    }

    it('test_incomplete_scenario_shows_resume_button_and_suppresses_report_generation', () => {
      const incompleteScenario = {
        id: 'sc-1',
        session_type: 'scenario',
        turn_count: 2,
        is_completed: false,
        has_report: false
      };

      const actions = computeHistoryCardActions(incompleteScenario);
      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('resume');
      expect(actions[0].label).toContain('Resume this scenario');
      expect(actions[0].href).toContain('scenario.html?resume=sc-1');
    });

    it('test_completed_scenario_shows_report_button_and_suppresses_resume', () => {
      const completedScenario = {
        id: 'sc-2',
        session_type: 'scenario',
        turn_count: 6,
        is_completed: true,
        has_report: false
      };

      const actions = computeHistoryCardActions(completedScenario);
      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('generate_report');
      expect(actions[0].label).toContain('Generate report');
    });

    it('test_freeform_chat_with_low_turns_suppresses_report_until_threshold_reached', () => {
      const shortChat = {
        id: 'chat-1',
        session_type: 'freeform',
        turn_count: 5,
        has_report: false
      };

      const actions = computeHistoryCardActions(shortChat);
      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('resume'); // Only resume, no report button
    });
  });
});
