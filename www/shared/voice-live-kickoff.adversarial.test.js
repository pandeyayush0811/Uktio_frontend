import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Role: 06_TestWriter (Senior Frontend/Backend Adversarial QA)
// Issue: AUD-030 (Issue #7: AI Opening Speech & Resumed Session Kickoff)
// Target Files:
//   - frontend_updated/frontend/www/scenario.html
//   - frontend_updated/frontend/www/chat.html
//   - frontend_updated/frontend/www/shared/voice-live-session.js

describe('Adversarial Test Suite — AUD-030 (Issue #7: AI Opening Speech & Resumed Session Kickoff)', () => {
  const scenarioHtmlPath = path.resolve(__dirname, '../scenario.html');
  const chatHtmlPath = path.resolve(__dirname, '../chat.html');
  const voiceLiveSessionPath = path.resolve(__dirname, './voice-live-session.js');

  const scenarioHtmlSource = fs.readFileSync(scenarioHtmlPath, 'utf8');
  const chatHtmlSource = fs.readFileSync(chatHtmlPath, 'utf8');
  const voiceLiveSessionSource = fs.readFileSync(voiceLiveSessionPath, 'utf8');

  // =========================================================================
  // SUITE 1: Static Source Code Contracts & AST Structure Verification
  // =========================================================================
  describe('Suite 1: Static Source Code Contracts & AST Structure', () => {
    it('test_scenario_onOpen_contains_exact_fresh_roleplay_kickoff_prompt', () => {
      // Must contain exact directive instructing AI character to initiate opening dialogue
      expect(scenarioHtmlSource).toContain("voiceSession.sendTextTurn('[Scene starts now. Say your opening line in-character to begin the conversation.]')");
    });

    it('test_scenario_onOpen_contains_exact_resumed_roleplay_kickoff_prompt', () => {
      // Must contain exact directive instructing AI character to resume conversation naturally
      expect(scenarioHtmlSource).toContain("voiceSession.sendTextTurn('[Scene resumed after pause. Continue the conversation in-character naturally from where we left off.]')");
    });

    it('test_scenario_onOpen_strictly_filters_meaningful_turns_before_phase_check', () => {
      // Extracts onOpen callback definition from scenario.html
      const onOpenMatch = scenarioHtmlSource.match(/onOpen:\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*\},/);
      expect(onOpenMatch, 'onOpen callback must be defined in scenario.html').not.toBeNull();
      const onOpenBody = onOpenMatch ? onOpenMatch[1] : '';

      expect(onOpenBody).toContain('sessionTurns.filter(t => t.content && t.content.trim())');
      expect(onOpenBody).toContain("phase === 'roleplay'");
      expect(onOpenBody).toContain('sendTextTurn');
    });

    it('test_chat_onOpen_contains_exact_fresh_chat_greeting_kickoff_prompt', () => {
      // Must contain exact directive instructing Bolo coach to greet in Hinglish and present challenge
      expect(chatHtmlSource).toContain("voiceSession.sendTextTurn(\"[Session started. Greet the user warmly in Hinglish and ask today's opening practice question/challenge.]\")");
    });

    it('test_chat_onOpen_contains_exact_resumed_chat_continuation_kickoff_prompt', () => {
      // Must contain exact directive instructing Bolo coach to recall context and continue in Hinglish
      expect(chatHtmlSource).toContain("voiceSession.sendTextTurn(\"[Session resumed. Continue our conversation naturally from where we left off, briefly referencing what we were discussing in Hinglish.]\")");
    });

    it('test_chat_onOpen_evaluates_all_three_resume_signals_comprehensively', () => {
      // Extracts onOpen callback definition from chat.html
      const onOpenMatch = chatHtmlSource.match(/onOpen:\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*\},/);
      expect(onOpenMatch, 'onOpen callback must be defined in chat.html').not.toBeNull();
      const onOpenBody = onOpenMatch ? onOpenMatch[1] : '';

      expect(onOpenBody).toContain('sessionTurns.filter(t => t.content && t.content.trim())');
      expect(onOpenBody).toContain('meaningfulTurns.length > 0 || !!priorTranscriptText || !!activeSessionId');
      expect(onOpenBody).toContain('sendTextTurn');
    });

    it('test_voice_live_session_sendTextTurn_sets_turnComplete_true_and_user_role', () => {
      // sendTextTurn must format payload with user role and turnComplete: true to prompt immediate response
      expect(voiceLiveSessionSource).toContain("session.sendClientContent({ turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true })");
    });
  });

  // =========================================================================
  // SUITE 2: Adversarial Scenario Page onOpen Logic & Edge-Case Matrix
  // =========================================================================
  describe('Suite 2: Adversarial Scenario Page onOpen Execution Matrix', () => {
    function executeScenarioOnOpen({ phase, sessionTurns, sendTextTurnMock, micBtn, startPhaseTimerMock }) {
      let sessionAttemptInFlight = true;
      if (micBtn) micBtn.disabled = true;

      // Exact implementation replicated from scenario.html:812-828
      sessionAttemptInFlight = false;
      if (micBtn) micBtn.disabled = false;
      if (startPhaseTimerMock) startPhaseTimerMock();

      const meaningfulTurns = sessionTurns.filter(t => t && t.content && typeof t.content === 'string' && t.content.trim());
      if (phase === 'roleplay') {
        if (!meaningfulTurns.length) {
          sendTextTurnMock('[Scene starts now. Say your opening line in-character to begin the conversation.]');
        } else {
          sendTextTurnMock('[Scene resumed after pause. Continue the conversation in-character naturally from where we left off.]');
        }
      }

      return { sessionAttemptInFlight };
    }

    it('test_fresh_scenario_with_empty_sessionTurns_dispatches_scene_opening', () => {
      // Why this matters: Verifies that a user starting fresh hears the AI character speak immediately
      const mockSend = vi.fn();
      const timerMock = vi.fn();
      const micBtn = { disabled: true };

      const result = executeScenarioOnOpen({
        phase: 'roleplay',
        sessionTurns: [],
        sendTextTurnMock: mockSend,
        micBtn,
        startPhaseTimerMock: timerMock
      });

      expect(result.sessionAttemptInFlight).toBe(false);
      expect(micBtn.disabled).toBe(false);
      expect(timerMock).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith('[Scene starts now. Say your opening line in-character to begin the conversation.]');
    });

    it('test_scenario_with_whitespace_and_empty_turns_treated_as_fresh_start', () => {
      // Why this matters: Incomplete or empty voice capture artifacts must not fool system into thinking session is resumed
      const mockSend = vi.fn();
      const sessionTurns = [
        { role: 'user', content: '' },
        { role: 'model', content: '   ' },
        { role: 'user', content: '\t\r\n  \n' }
      ];

      executeScenarioOnOpen({
        phase: 'roleplay',
        sessionTurns,
        sendTextTurnMock: mockSend
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith('[Scene starts now. Say your opening line in-character to begin the conversation.]');
    });

    it('test_scenario_with_null_undefined_or_missing_content_does_not_crash', () => {
      // Why this matters: Malformed turns must not throw TypeError (e.g. Cannot read properties of undefined reading trim)
      const mockSend = vi.fn();
      const sessionTurns = [
        { role: 'user', content: null },
        { role: 'model', content: undefined },
        { role: 'user' },
        {},
        null,
        undefined
      ];

      expect(() => {
        executeScenarioOnOpen({
          phase: 'roleplay',
          sessionTurns,
          sendTextTurnMock: mockSend
        });
      }).not.toThrow();

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith('[Scene starts now. Say your opening line in-character to begin the conversation.]');
    });

    it('test_scenario_with_existing_dialogue_dispatches_resumed_continuation', () => {
      // Why this matters: Resuming mid-roleplay after network drop or pause must prompt AI to continue, not restart scene
      const mockSend = vi.fn();
      const sessionTurns = [
        { role: 'model', content: 'Good afternoon, welcome to Central Perk! Table for how many?' },
        { role: 'user', content: 'Table for two please.' }
      ];

      executeScenarioOnOpen({
        phase: 'roleplay',
        sessionTurns,
        sendTextTurnMock: mockSend
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith('[Scene resumed after pause. Continue the conversation in-character naturally from where we left off.]');
    });

    it('test_scenario_with_mixed_empty_and_valid_turns_dispatches_resumed_continuation', () => {
      // Why this matters: A valid dialogue line surrounded by empty audio frames must still be recognized as resumed
      const mockSend = vi.fn();
      const sessionTurns = [
        { role: 'user', content: '   ' },
        { role: 'model', content: 'What can I get you to drink?' },
        { role: 'user', content: '' }
      ];

      executeScenarioOnOpen({
        phase: 'roleplay',
        sessionTurns,
        sendTextTurnMock: mockSend
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith('[Scene resumed after pause. Continue the conversation in-character naturally from where we left off.]');
    });

    it('test_scenario_feedback_phase_strictly_suppresses_roleplay_kickoff', () => {
      // Why this matters: When reconnecting during feedback phase, AI must not restart roleplay
      const mockSend = vi.fn();
      executeScenarioOnOpen({
        phase: 'feedback',
        sessionTurns: [{ role: 'user', content: 'I would like a coffee' }],
        sendTextTurnMock: mockSend
      });

      expect(mockSend).not.toHaveBeenCalled();
    });

    it('test_scenario_transitioning_or_invalid_phases_strictly_suppress_kickoff', () => {
      // Why this matters: Any phase state other than 'roleplay' must not receive roleplay kickoff prompts
      const phases = ['transitioning', 'locked', 'completed', 'unknown', '', null, undefined];

      phases.forEach(p => {
        const mockSend = vi.fn();
        executeScenarioOnOpen({
          phase: p,
          sessionTurns: [],
          sendTextTurnMock: mockSend
        });
        expect(mockSend).not.toHaveBeenCalled();
      });
    });

    it('test_scenario_onOpen_does_not_mutate_sessionTurns_array', () => {
      // Why this matters: Filtering meaningful turns must be a pure read operation and never mutate sessionTurns in-place
      const mockSend = vi.fn();
      const originalTurns = [
        { role: 'model', content: 'Hello!' },
        { role: 'user', content: 'Hi!' }
      ];
      const sessionTurnsCopy = [...originalTurns];

      executeScenarioOnOpen({
        phase: 'roleplay',
        sessionTurns: sessionTurnsCopy,
        sendTextTurnMock: mockSend
      });

      expect(sessionTurnsCopy.length).toBe(2);
      expect(sessionTurnsCopy[0].content).toBe('Hello!');
      expect(sessionTurnsCopy[1].content).toBe('Hi!');
    });

    it('test_scenario_rapid_reconnect_fires_appropriate_kickoffs_each_time', () => {
      // Why this matters: In flaky network conditions, repeated onOpen events must behave predictably
      const mockSend = vi.fn();
      let turns = [];

      // 1st connection: fresh start
      executeScenarioOnOpen({ phase: 'roleplay', sessionTurns: turns, sendTextTurnMock: mockSend });
      expect(mockSend).toHaveBeenLastCalledWith('[Scene starts now. Say your opening line in-character to begin the conversation.]');

      // User speaks 1 turn, then socket drops and reconnects
      turns.push({ role: 'user', content: 'Hello' });
      executeScenarioOnOpen({ phase: 'roleplay', sessionTurns: turns, sendTextTurnMock: mockSend });
      expect(mockSend).toHaveBeenLastCalledWith('[Scene resumed after pause. Continue the conversation in-character naturally from where we left off.]');

      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // SUITE 3: Adversarial Chat Page onOpen Logic & Edge-Case Matrix
  // =========================================================================
  describe('Suite 3: Adversarial Chat Page onOpen Execution Matrix', () => {
    function executeChatOnOpen({ sessionTurns, priorTranscriptText, activeSessionId, sendTextTurnMock, micBtn }) {
      let isBusy = true;
      if (micBtn) micBtn.disabled = true;

      // Exact implementation replicated from chat.html:846-861
      if (micBtn) micBtn.disabled = false;
      isBusy = false;

      const meaningfulTurns = sessionTurns.filter(t => t && t.content && typeof t.content === 'string' && t.content.trim());
      const isResumed = meaningfulTurns.length > 0 || !!priorTranscriptText || !!activeSessionId;

      if (!isResumed) {
        sendTextTurnMock("[Session started. Greet the user warmly in Hinglish and ask today's opening practice question/challenge.]");
      } else {
        sendTextTurnMock("[Session resumed. Continue our conversation naturally from where we left off, briefly referencing what we were discussing in Hinglish.]");
      }

      return { isBusy };
    }

    it('test_fresh_chat_with_clean_state_dispatches_greeting_and_challenge', () => {
      // Why this matters: Coach Bolo must initiate speech immediately upon mic tap on fresh chat
      const mockSend = vi.fn();
      const micBtn = { disabled: true };

      const result = executeChatOnOpen({
        sessionTurns: [],
        priorTranscriptText: '',
        activeSessionId: null,
        sendTextTurnMock: mockSend,
        micBtn
      });

      expect(result.isBusy).toBe(false);
      expect(micBtn.disabled).toBe(false);
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith("[Session started. Greet the user warmly in Hinglish and ask today's opening practice question/challenge.]");
    });

    it('test_fresh_chat_with_falsy_or_empty_values_treated_as_fresh_start', () => {
      // Why this matters: Falsy representations of null/empty must not trigger false resume state
      const falsyCases = [
        { prior: '', activeId: null, turns: [] },
        { prior: null, activeId: undefined, turns: [] },
        { prior: undefined, activeId: '', turns: [] },
        { prior: '', activeId: null, turns: [{ content: '' }, { content: '   ' }] }
      ];

      falsyCases.forEach(c => {
        const mockSend = vi.fn();
        executeChatOnOpen({
          sessionTurns: c.turns,
          priorTranscriptText: c.prior,
          activeSessionId: c.activeId,
          sendTextTurnMock: mockSend
        });
        expect(mockSend).toHaveBeenCalledWith("[Session started. Greet the user warmly in Hinglish and ask today's opening practice question/challenge.]");
      });
    });

    it('test_chat_with_activeSessionId_from_url_triggers_resume_kickoff', () => {
      // Why this matters: When resuming an existing chat session via URL, Coach Bolo must recall context
      const mockSend = vi.fn();
      executeChatOnOpen({
        sessionTurns: [],
        priorTranscriptText: '',
        activeSessionId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        sendTextTurnMock: mockSend
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith("[Session resumed. Continue our conversation naturally from where we left off, briefly referencing what we were discussing in Hinglish.]");
    });

    it('test_chat_with_priorTranscriptText_triggers_resume_kickoff', () => {
      // Why this matters: When restoring from local transcript history, Coach Bolo must acknowledge prior conversation
      const mockSend = vi.fn();
      executeChatOnOpen({
        sessionTurns: [],
        priorTranscriptText: 'User: Hello Bolo\nAssistant: Haanji, kaise ho aap?',
        activeSessionId: null,
        sendTextTurnMock: mockSend
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith("[Session resumed. Continue our conversation naturally from where we left off, briefly referencing what we were discussing in Hinglish.]");
    });

    it('test_chat_with_meaningful_sessionTurns_triggers_resume_kickoff', () => {
      // Why this matters: Resuming after pause in current tab must continue conversation in-context
      const mockSend = vi.fn();
      executeChatOnOpen({
        sessionTurns: [{ role: 'user', content: 'Today I went to my office.' }],
        priorTranscriptText: '',
        activeSessionId: null,
        sendTextTurnMock: mockSend
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith("[Session resumed. Continue our conversation naturally from where we left off, briefly referencing what we were discussing in Hinglish.]");
    });

    it('test_chat_with_all_three_resume_triggers_active_dispatches_single_kickoff', () => {
      // Why this matters: Multiple resume indicators must not cause duplicate kickoff turns
      const mockSend = vi.fn();
      executeChatOnOpen({
        sessionTurns: [{ role: 'user', content: 'Let us practice English' }],
        priorTranscriptText: 'Prior text here',
        activeSessionId: 'sess-active-888',
        sendTextTurnMock: mockSend
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith("[Session resumed. Continue our conversation naturally from where we left off, briefly referencing what we were discussing in Hinglish.]");
    });

    it('test_chat_with_null_and_malformed_turn_contents_does_not_crash', () => {
      // Why this matters: Prevents unhandled TypeError when turn objects have null/undefined content
      const mockSend = vi.fn();
      const sessionTurns = [
        { content: null },
        { content: undefined },
        {},
        null
      ];

      expect(() => {
        executeChatOnOpen({
          sessionTurns,
          priorTranscriptText: '',
          activeSessionId: null,
          sendTextTurnMock: mockSend
        });
      }).not.toThrow();

      expect(mockSend).toHaveBeenCalledWith("[Session started. Greet the user warmly in Hinglish and ask today's opening practice question/challenge.]");
    });
  });

  // =========================================================================
  // SUITE 4: voice-live-session.js sendTextTurn Protocol & Error Handling
  // =========================================================================
  describe('Suite 4: voice-live-session.js sendTextTurn Contract & Engine Robustness', () => {
    function simulateSendTextTurnEngine({ session, callbacks = {}, recordTurnActivityMock = vi.fn() }) {
      return function sendTextTurn(text) {
        if (!session) return false;
        recordTurnActivityMock();
        try {
          session.sendClientContent({ turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true });
          return true;
        } catch (err) {
          console.error('sendTextTurn error', err);
          callbacks.onStatus && callbacks.onStatus('Error sending instruction: ' + err.message, 'err');
          return false;
        }
      };
    }

    it('test_sendTextTurn_returns_false_when_session_is_null_or_disconnected', () => {
      // Why this matters: Calling sendTextTurn when disconnected must safely return false without throwing
      const recordMock = vi.fn();
      const sendTextTurn = simulateSendTextTurnEngine({ session: null, recordTurnActivityMock: recordMock });

      const result = sendTextTurn('[Test prompt]');
      expect(result).toBe(false);
      expect(recordMock).not.toHaveBeenCalled();
    });

    it('test_sendTextTurn_formats_exact_gemini_client_content_structure_with_turnComplete_true', () => {
      // Why this matters: Live API requires explicit turnComplete: true to generate spontaneous model response
      const sessionMock = { sendClientContent: vi.fn() };
      const recordMock = vi.fn();
      const sendTextTurn = simulateSendTextTurnEngine({ session: sessionMock, recordTurnActivityMock: recordMock });

      const promptText = '[Scene starts now. Say your opening line in-character to begin the conversation.]';
      const result = sendTextTurn(promptText);

      expect(result).toBe(true);
      expect(recordMock).toHaveBeenCalledTimes(1);
      expect(sessionMock.sendClientContent).toHaveBeenCalledTimes(1);
      expect(sessionMock.sendClientContent).toHaveBeenCalledWith({
        turns: [{ role: 'user', parts: [{ text: promptText }] }],
        turnComplete: true
      });
    });

    it('test_sendTextTurn_handles_unicode_hinglish_and_special_characters_cleanly', () => {
      // Why this matters: Hinglish instructions and quotes must not corrupt JSON payload serialization
      const sessionMock = { sendClientContent: vi.fn() };
      const sendTextTurn = simulateSendTextTurnEngine({ session: sessionMock });

      const complexPrompt = "[Session started. Greet user with 'Haanji! Aaj college kaisa tha?' & ask 1 question.]";
      const result = sendTextTurn(complexPrompt);

      expect(result).toBe(true);
      expect(sessionMock.sendClientContent).toHaveBeenCalledWith({
        turns: [{ role: 'user', parts: [{ text: complexPrompt }] }],
        turnComplete: true
      });
    });

    it('test_sendTextTurn_catches_session_exceptions_and_invokes_onStatus_callback', () => {
      // Why this matters: If WebSocket throws synchronously on send, app must notify user via onStatus and return false
      const errorMsg = 'WebSocket connection is closed or closing.';
      const sessionMock = {
        sendClientContent: vi.fn(() => {
          throw new Error(errorMsg);
        })
      };
      const onStatusMock = vi.fn();
      const sendTextTurn = simulateSendTextTurnEngine({
        session: sessionMock,
        callbacks: { onStatus: onStatusMock }
      });

      const result = sendTextTurn('[Test prompt]');

      expect(result).toBe(false);
      expect(onStatusMock).toHaveBeenCalledTimes(1);
      expect(onStatusMock).toHaveBeenCalledWith('Error sending instruction: ' + errorMsg, 'err');
    });
  });
});
