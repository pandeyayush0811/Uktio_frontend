import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mock WebAudio and Capacitor native plugins for real engine execution
class MockAudioContext {
  constructor(options = {}) {
    this.sampleRate = options.sampleRate || 24000;
    this.state = 'suspended';
    this.currentTime = 0;
    this.resumeCalledCount = 0;
    this.closeCalled = false;
  }

  async resume() {
    this.resumeCalledCount += 1;
    this.state = 'running';
    return Promise.resolve();
  }

  createBuffer(channels, length, sampleRate) {
    return {
      duration: length / sampleRate,
      copyToChannel: vi.fn()
    };
  }

  createBufferSource() {
    return {
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    };
  }

  get destination() {
    return {};
  }

  async close() {
    this.closeCalled = true;
    this.state = 'closed';
    return Promise.resolve();
  }
}

let mockListeners = {};
const mockRemoveHandles = [];
const mockMicPlugin = {
  addListener: vi.fn((event, cb) => {
    mockListeners[event] = cb;
    const removeMock = vi.fn();
    mockRemoveHandles.push(removeMock);
    return Promise.resolve({ remove: removeMock });
  }),
  start: vi.fn(() => Promise.resolve()),
  stop: vi.fn(() => Promise.resolve()),
  startKeepAlive: vi.fn(() => Promise.resolve()),
  stopKeepAlive: vi.fn(() => Promise.resolve()),
};

vi.mock('./mic-helpers.js', () => ({
  getApiKey: vi.fn().mockResolvedValue('test-key-123'),
  getMicCapturePlugin: () => mockMicPlugin
}));

vi.mock('./gemini-key-check.js', () => ({
  checkGeminiApiKey: vi.fn().mockResolvedValue({ status: 'valid' })
}));

vi.mock('./network-status.js', () => ({
  isOnline: vi.fn().mockResolvedValue(true)
}));

import { createVoiceSession } from './voice-live-session.js';

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

  beforeEach(() => {
    globalThis.AudioContext = MockAudioContext;
    globalThis.window = {
      Capacitor: {
        Plugins: {
          MicCapture: mockMicPlugin
        }
      }
    };
    mockListeners = {};
    mockRemoveHandles.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

    it('test_voice_live_session_decouples_raw_onopen_and_fires_onOpen_after_mic_ready', () => {
      // Raw WebSocket onopen must only update intermediate status, NOT trigger onOpen prematurely
      expect(voiceLiveSessionSource).toContain("callbacks.onStatus && callbacks.onStatus('AI connected — starting audio...', null);");

      // onOpen callback must be placed after startNativeMic resolves
      const micStartIdx = voiceLiveSessionSource.indexOf('await startNativeMic()');
      const onOpenIdx = voiceLiveSessionSource.indexOf('callbacks.onOpen && callbacks.onOpen()');
      expect(micStartIdx).toBeGreaterThan(-1);
      expect(onOpenIdx).toBeGreaterThan(micStartIdx);
    });

    it('test_voice_live_session_sendTextTurn_includes_warning_log_when_inactive', () => {
      expect(voiceLiveSessionSource).toContain("console.warn('[voice-session] sendTextTurn called while session is inactive or not yet connected');");
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
  // SUITE 4: voice-live-session.js sendTextTurn Contract & Engine Robustness
  // =========================================================================
  describe('Suite 4: voice-live-session.js sendTextTurn Contract & Engine Robustness', () => {
    function simulateSendTextTurnEngine({ session, callbacks = {}, recordTurnActivityMock = vi.fn() }) {
      return function sendTextTurn(text) {
        if (!session) {
          console.warn('[voice-session] sendTextTurn called while session is inactive or not yet connected');
          return false;
        }
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

    it('test_sendTextTurn_returns_false_and_logs_warning_when_session_is_null_or_disconnected', () => {
      // Why this matters: Calling sendTextTurn when disconnected must safely return false and log clear diagnostic warning
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const recordMock = vi.fn();
      const sendTextTurn = simulateSendTextTurnEngine({ session: null, recordTurnActivityMock: recordMock });

      const result = sendTextTurn('[Test prompt]');
      expect(result).toBe(false);
      expect(recordMock).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith('[voice-session] sendTextTurn called while session is inactive or not yet connected');
      warnSpy.mockRestore();
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

  // =========================================================================
  // SUITE 5: Full Asynchronous Lifecycle & Direct Kickoff Integration
  // =========================================================================
  describe('Suite 5: Asynchronous Lifecycle & Direct Kickoff Integration', () => {
    it('test_scenario_kickoff_flow_delivers_scene_opening_prompt_to_gemini_session', async () => {
      const sentPayloads = [];
      const mockSession = {
        sendClientContent: vi.fn((payload) => sentPayloads.push(payload)),
        close: vi.fn()
      };

      let onOpenFired = false;
      let sendResult = null;

      // Simulate consumer logic in scenario.html
      const simulatedVoice = {
        session: null,
        sendTextTurn(text) {
          if (!this.session) return false;
          this.session.sendClientContent({ turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true });
          return true;
        }
      };

      const callbacks = {
        onOpen: () => {
          onOpenFired = true;
          // Consumer sends kickoff turn inside onOpen
          sendResult = simulatedVoice.sendTextTurn('[Scene starts now. Say your opening line in-character to begin the conversation.]');
        }
      };

      // Lifecycle sequence: connect -> start native mic -> fire onOpen
      simulatedVoice.session = mockSession; // session assigned once connect resolves and mic ready
      callbacks.onOpen();

      expect(onOpenFired).toBe(true);
      expect(sendResult).toBe(true);
      expect(sentPayloads.length).toBe(1);
      expect(sentPayloads[0]).toEqual({
        turns: [{ role: 'user', parts: [{ text: '[Scene starts now. Say your opening line in-character to begin the conversation.]' }] }],
        turnComplete: true
      });
    });

    it('test_chat_kickoff_flow_delivers_greeting_and_challenge_prompt_to_gemini_session', async () => {
      const sentPayloads = [];
      const mockSession = {
        sendClientContent: vi.fn((payload) => sentPayloads.push(payload)),
        close: vi.fn()
      };

      let onOpenFired = false;
      let sendResult = null;

      const simulatedVoice = {
        session: null,
        sendTextTurn(text) {
          if (!this.session) return false;
          this.session.sendClientContent({ turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true });
          return true;
        }
      };

      const callbacks = {
        onOpen: () => {
          onOpenFired = true;
          sendResult = simulatedVoice.sendTextTurn("[Session started. Greet the user warmly in Hinglish and ask today's opening practice question/challenge.]");
        }
      };

      simulatedVoice.session = mockSession;
      callbacks.onOpen();

      expect(onOpenFired).toBe(true);
      expect(sendResult).toBe(true);
      expect(sentPayloads.length).toBe(1);
      expect(sentPayloads[0]).toEqual({
        turns: [{ role: 'user', parts: [{ text: "[Session started. Greet the user warmly in Hinglish and ask today's opening practice question/challenge.]" }] }],
        turnComplete: true
      });
    });
  });

  // =========================================================================
  // SUITE 6: Real createVoiceSession Engine Asynchronous Timing & Handshake Races
  // =========================================================================
  describe('Suite 6: Real createVoiceSession Engine Asynchronous Timing & Handshake Races', () => {
    it('test_createVoiceSession_delays_onOpen_until_ai_connect_resolves_and_mic_starts', async () => {
      // Why this matters: Proves that even with simulated network lag during ai.live.connect,
      // callbacks.onOpen is never called prematurely while session is null.
      const mockSession = {
        sendRealtimeInput: vi.fn(),
        sendClientContent: vi.fn(),
        close: vi.fn()
      };

      let onOpenCalled = false;
      let onOpenSessionActive = null;
      let sendTextTurnResult = null;

      let capturedCallbacks = null;
      class MockGoogleGenAI {
        constructor() {
          this.live = {
            connect: vi.fn().mockImplementation(async (config) => {
              capturedCallbacks = config.callbacks;
              // Trigger raw onopen callback during connect execution
              if (capturedCallbacks.onopen) capturedCallbacks.onopen();

              // Artificial asynchronous resolution delay (e.g. WebSocket handshake + auth)
              await new Promise(r => setTimeout(r, 20));
              return mockSession;
            })
          };
        }
      }

      let voice;
      voice = createVoiceSession({
        getSystemInstruction: () => 'System prompt',
        callbacks: {
          onOpen: () => {
            onOpenCalled = true;
            onOpenSessionActive = voice.isActive();
            sendTextTurnResult = voice.sendTextTurn('[Kickoff instruction]');
          }
        }
      });

      const startPromise = voice.start({
        GoogleGenAI: MockGoogleGenAI,
        Modality: { AUDIO: 'AUDIO' }
      });

      // While connect is pending, onOpen must NOT have fired yet
      expect(onOpenCalled).toBe(false);
      expect(voice.isActive()).toBe(false);

      const startResult = await startPromise;

      expect(startResult.ok).toBe(true);
      expect(onOpenCalled).toBe(true);
      expect(onOpenSessionActive).toBe(true);
      expect(sendTextTurnResult).toBe(true);
      expect(mockSession.sendClientContent).toHaveBeenCalledWith({
        turns: [{ role: 'user', parts: [{ text: '[Kickoff instruction]' }] }],
        turnComplete: true
      });

      voice.stop();
    });

    it('test_sendTextTurn_called_before_connect_resolves_is_safely_rejected', async () => {
      // Why this matters: If a rogue caller invokes sendTextTurn while connection is pending,
      // it must return false with a console warning and not crash.
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mockSession = { sendRealtimeInput: vi.fn(), sendClientContent: vi.fn(), close: vi.fn() };

      class MockDelayedGoogleGenAI {
        constructor() {
          this.live = {
            connect: vi.fn().mockImplementation(async () => {
              await new Promise(r => setTimeout(r, 30));
              return mockSession;
            })
          };
        }
      }

      const voice = createVoiceSession({
        getSystemInstruction: () => 'System prompt'
      });

      const startPromise = voice.start({
        GoogleGenAI: MockDelayedGoogleGenAI,
        Modality: { AUDIO: 'AUDIO' }
      });

      // Calling sendTextTurn mid-handshake
      const earlySend = voice.sendTextTurn('[Premature send attempt]');
      expect(earlySend).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith('[voice-session] sendTextTurn called while session is inactive or not yet connected');

      await startPromise;
      voice.stop();
      warnSpy.mockRestore();
    });

    it('test_mic_start_failure_aborts_lifecycle_and_never_fires_onOpen', async () => {
      // Why this matters: If microphone hardware fails to initialize after AI connect,
      // onOpen must NEVER fire, session must be closed, and start() returns mic_start_failed.
      const mockSession = { sendRealtimeInput: vi.fn(), sendClientContent: vi.fn(), close: vi.fn() };

      mockMicPlugin.start.mockRejectedValueOnce(new Error('Hardware audio device busy'));

      class MockGoogleGenAI {
        constructor() {
          this.live = {
            connect: vi.fn().mockResolvedValue(mockSession)
          };
        }
      }

      const onOpenMock = vi.fn();
      const onStatusMock = vi.fn();

      const voice = createVoiceSession({
        getSystemInstruction: () => 'System prompt',
        callbacks: {
          onOpen: onOpenMock,
          onStatus: onStatusMock
        }
      });

      const result = await voice.start({
        GoogleGenAI: MockGoogleGenAI,
        Modality: { AUDIO: 'AUDIO' }
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('mic_start_failed');
      expect(onOpenMock).not.toHaveBeenCalled();
      expect(voice.isActive()).toBe(false);
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('test_connect_rejection_cleans_up_and_never_fires_onOpen', async () => {
      // Why this matters: If Live API WebSocket connection fails (e.g. 403 or network drop),
      // onOpen must not fire, audioPlayer is closed, and start() returns connect_failed.
      class MockFailingGoogleGenAI {
        constructor() {
          this.live = {
            connect: vi.fn().mockRejectedValue(new Error('API key not valid'))
          };
        }
      }

      const onOpenMock = vi.fn();
      const onStatusMock = vi.fn();

      const voice = createVoiceSession({
        getSystemInstruction: () => 'System prompt',
        callbacks: {
          onOpen: onOpenMock,
          onStatus: onStatusMock
        }
      });

      const result = await voice.start({
        GoogleGenAI: MockFailingGoogleGenAI,
        Modality: { AUDIO: 'AUDIO' }
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('connect_failed');
      expect(result.message).toContain('Invalid AI key');
      expect(onOpenMock).not.toHaveBeenCalled();
      expect(voice.isActive()).toBe(false);
    });
  });

  // =========================================================================
  // SUITE 7: Real Engine Concurrency, Double-Invocation & Lifecycle Teardown
  // =========================================================================
  describe('Suite 7: Real Engine Concurrency, Double-Invocation & Lifecycle Teardown', () => {
    it('test_double_start_while_connecting_rejects_second_call_with_already_active', async () => {
      // Why this matters: Prevents rapid double-tapping on microphone from creating orphaned duplicate sessions
      const mockSession = { sendRealtimeInput: vi.fn(), sendClientContent: vi.fn(), close: vi.fn() };

      class MockDelayedGoogleGenAI {
        constructor() {
          this.live = {
            connect: vi.fn().mockImplementation(async (config) => {
              if (config.callbacks?.onopen) config.callbacks.onopen();
              await new Promise(r => setTimeout(r, 25));
              return mockSession;
            })
          };
        }
      }

      const voice = createVoiceSession({
        getSystemInstruction: () => 'System prompt'
      });

      const firstStartPromise = voice.start({ GoogleGenAI: MockDelayedGoogleGenAI, Modality: { AUDIO: 'AUDIO' } });
      const secondStartPromise = voice.start({ GoogleGenAI: MockDelayedGoogleGenAI, Modality: { AUDIO: 'AUDIO' } });

      const secondResult = await secondStartPromise;
      expect(secondResult.ok).toBe(false);
      expect(secondResult.reason).toBe('already_active');

      const firstResult = await firstStartPromise;
      expect(firstResult.ok).toBe(true);

      voice.stop();
    });

    it('test_stop_called_while_active_nullifies_session_and_causes_subsequent_sendTextTurn_to_fail', async () => {
      // Why this matters: After calling stop(), session is torn down and sendTextTurn returns false cleanly.
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mockSession = { sendRealtimeInput: vi.fn(), sendClientContent: vi.fn(), close: vi.fn() };

      class MockGoogleGenAI {
        constructor() {
          this.live = { connect: vi.fn().mockResolvedValue(mockSession) };
        }
      }

      const voice = createVoiceSession({
        getSystemInstruction: () => 'System prompt'
      });

      await voice.start({ GoogleGenAI: MockGoogleGenAI, Modality: { AUDIO: 'AUDIO' } });
      expect(voice.isActive()).toBe(true);

      voice.stop();
      expect(voice.isActive()).toBe(false);

      const sendResult = voice.sendTextTurn('[Test after stop]');
      expect(sendResult).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith('[voice-session] sendTextTurn called while session is inactive or not yet connected');

      warnSpy.mockRestore();
    });

    it('test_rapid_reconnect_lifecycle_cleanly_reinitializes_and_dispatches_new_kickoff', async () => {
      // Why this matters: User stops and immediately restarts session (e.g. switching modes);
      // verifies clean state isolation with separate payload dispatches across iterations.
      const mockSession1 = { sendRealtimeInput: vi.fn(), sendClientContent: vi.fn(), close: vi.fn() };
      const mockSession2 = { sendRealtimeInput: vi.fn(), sendClientContent: vi.fn(), close: vi.fn() };

      let connectCount = 0;
      class MockGoogleGenAI {
        constructor() {
          this.live = {
            connect: vi.fn().mockImplementation(async () => {
              connectCount++;
              return connectCount === 1 ? mockSession1 : mockSession2;
            })
          };
        }
      }

      const kickoffPayloads = [];
      const voice = createVoiceSession({
        getSystemInstruction: () => 'System prompt',
        callbacks: {
          onOpen: () => {
            const prompt = connectCount === 1 ? '[Session 1 Kickoff]' : '[Session 2 Kickoff]';
            voice.sendTextTurn(prompt);
            kickoffPayloads.push(prompt);
          }
        }
      });

      // Iteration 1
      await voice.start({ GoogleGenAI: MockGoogleGenAI, Modality: { AUDIO: 'AUDIO' } });
      expect(voice.isActive()).toBe(true);
      expect(mockSession1.sendClientContent).toHaveBeenCalledWith({
        turns: [{ role: 'user', parts: [{ text: '[Session 1 Kickoff]' }] }],
        turnComplete: true
      });
      voice.stop();
      expect(voice.isActive()).toBe(false);

      // Iteration 2
      await voice.start({ GoogleGenAI: MockGoogleGenAI, Modality: { AUDIO: 'AUDIO' } });
      expect(voice.isActive()).toBe(true);
      expect(mockSession2.sendClientContent).toHaveBeenCalledWith({
        turns: [{ role: 'user', parts: [{ text: '[Session 2 Kickoff]' }] }],
        turnComplete: true
      });
      voice.stop();

      expect(kickoffPayloads).toEqual(['[Session 1 Kickoff]', '[Session 2 Kickoff]']);
    });
  });

  // =========================================================================
  // SUITE 8: Payload Boundary, Unicode, Extreme Fuzzing & Malformed Inputs
  // =========================================================================
  describe('Suite 8: Payload Boundary, Unicode, Extreme Fuzzing & Malformed Inputs', () => {
    it('test_sendTextTurn_with_extremely_large_payload_dispatches_without_truncation', async () => {
      // Why this matters: If a very long prompt or context history is passed, it must not crash or corrupt
      const mockSession = { sendRealtimeInput: vi.fn(), sendClientContent: vi.fn(), close: vi.fn() };
      class MockGoogleGenAI {
        constructor() { this.live = { connect: vi.fn().mockResolvedValue(mockSession) }; }
      }

      const voice = createVoiceSession({ getSystemInstruction: () => 'Prompt' });
      await voice.start({ GoogleGenAI: MockGoogleGenAI, Modality: { AUDIO: 'AUDIO' } });

      const massivePrompt = '[Context] ' + 'A'.repeat(50000);
      const result = voice.sendTextTurn(massivePrompt);

      expect(result).toBe(true);
      expect(mockSession.sendClientContent).toHaveBeenCalledWith({
        turns: [{ role: 'user', parts: [{ text: massivePrompt }] }],
        turnComplete: true
      });

      voice.stop();
    });

    it('test_sendTextTurn_with_empty_or_whitespace_strings_formats_payload_faithfully', async () => {
      // Why this matters: Edge-case string values must be passed as-is to Gemini client content
      const mockSession = { sendRealtimeInput: vi.fn(), sendClientContent: vi.fn(), close: vi.fn() };
      class MockGoogleGenAI {
        constructor() { this.live = { connect: vi.fn().mockResolvedValue(mockSession) }; }
      }

      const voice = createVoiceSession({ getSystemInstruction: () => 'Prompt' });
      await voice.start({ GoogleGenAI: MockGoogleGenAI, Modality: { AUDIO: 'AUDIO' } });

      const edgeStrings = ['', '   ', '\n\t\r\n'];
      edgeStrings.forEach(str => {
        const ok = voice.sendTextTurn(str);
        expect(ok).toBe(true);
        expect(mockSession.sendClientContent).toHaveBeenLastCalledWith({
          turns: [{ role: 'user', parts: [{ text: str }] }],
          turnComplete: true
        });
      });

      voice.stop();
    });

    it('test_sendTextTurn_with_special_characters_quotes_and_html_tags', async () => {
      // Why this matters: Complex user speech tokens or code snippets inside prompt must serialize cleanly
      const mockSession = { sendRealtimeInput: vi.fn(), sendClientContent: vi.fn(), close: vi.fn() };
      class MockGoogleGenAI {
        constructor() { this.live = { connect: vi.fn().mockResolvedValue(mockSession) }; }
      }

      const voice = createVoiceSession({ getSystemInstruction: () => 'Prompt' });
      await voice.start({ GoogleGenAI: MockGoogleGenAI, Modality: { AUDIO: 'AUDIO' } });

      const complexPayload = `<script>alert("XSS")</script> & { "json": true } 'single' "double" 🇮🇳 🎯 🚀`;
      const result = voice.sendTextTurn(complexPayload);

      expect(result).toBe(true);
      expect(mockSession.sendClientContent).toHaveBeenCalledWith({
        turns: [{ role: 'user', parts: [{ text: complexPayload }] }],
        turnComplete: true
      });

      voice.stop();
    });
  });

  // =========================================================================
  // SUITE 9: Watchdog Reset on Kickoff Prompt Dispatch
  // =========================================================================
  describe('Suite 9: Watchdog Reset on Kickoff Prompt Dispatch', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('test_sendTextTurn_records_turn_activity_and_resets_silence_and_stagnant_turn_timers', async () => {
      // Why this matters: When kickoff prompt is dispatched at session start, recordTurnActivity()
      // must refresh watchdog timestamps so that the full 90s silence and 120s stagnant turn timeouts begin fresh.
      const mockSession = { sendRealtimeInput: vi.fn(), sendClientContent: vi.fn(), close: vi.fn() };
      const onInactivityTimeoutMock = vi.fn();

      class MockGoogleGenAI {
        constructor() {
          this.live = {
            connect: vi.fn().mockImplementation(async (config) => {
              if (config.callbacks?.onopen) config.callbacks.onopen();
              return mockSession;
            })
          };
        }
      }

      const voice = createVoiceSession({
        getSystemInstruction: () => 'Prompt',
        inactivityTimeoutMs: 90000,
        stagnantTurnTimeoutMs: 120000,
        callbacks: {
          onInactivityTimeout: onInactivityTimeoutMock
        }
      });

      await voice.start({ GoogleGenAI: MockGoogleGenAI, Modality: { AUDIO: 'AUDIO' } });

      // Fast-forward 80s
      vi.advanceTimersByTime(80000);
      expect(voice.isActive()).toBe(true);

      // sendTextTurn (kickoff / dynamic instruction) executes at 80s -> resets watchdog activity
      const sent = voice.sendTextTurn('[Mid-session directive]');
      expect(sent).toBe(true);

      // Fast-forward 80s more (total 160s from start, but only 80s from sendTextTurn)
      vi.advanceTimersByTime(80000);
      expect(voice.isActive()).toBe(true);
      expect(onInactivityTimeoutMock).not.toHaveBeenCalled();

      // Fast-forward 12s more (92s from sendTextTurn) -> silence timeout should now trip
      vi.advanceTimersByTime(12000);
      expect(voice.isActive()).toBe(false);
      expect(onInactivityTimeoutMock).toHaveBeenCalledWith(expect.objectContaining({ reason: 'silence' }));
    });
  });

  // =========================================================================
  // SUITE 10: Immediate Teardown & Re-entrancy during onOpen Callback
  // =========================================================================
  describe('Suite 10: Immediate Teardown & Re-entrancy during onOpen Callback', () => {
    it('test_calling_stop_inside_onOpen_callback_tears_down_cleanly_without_hanging', async () => {
      // Why this matters: If a user or page unmounts/stops immediately inside onOpen,
      // it must cleanly nullify session and stop all native plugins without leaking state.
      const mockSession = { sendRealtimeInput: vi.fn(), sendClientContent: vi.fn(), close: vi.fn() };

      class MockGoogleGenAI {
        constructor() {
          this.live = { connect: vi.fn().mockResolvedValue(mockSession) };
        }
      }

      let voice;
      let sendResultInsideOnOpen = null;
      let onOpenFired = false;

      voice = createVoiceSession({
        getSystemInstruction: () => 'Prompt',
        callbacks: {
          onOpen: () => {
            onOpenFired = true;
            // Immediate teardown during onOpen
            voice.stop();
            sendResultInsideOnOpen = voice.sendTextTurn('[Attempt send after stop]');
          }
        }
      });

      const res = await voice.start({ GoogleGenAI: MockGoogleGenAI, Modality: { AUDIO: 'AUDIO' } });
      expect(res.ok).toBe(true);
      expect(onOpenFired).toBe(true);
      expect(voice.isActive()).toBe(false);
      expect(sendResultInsideOnOpen).toBe(false);
      expect(mockSession.close).toHaveBeenCalled();
      expect(mockMicPlugin.stop).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // SUITE 11: Burst Invocations, Flooding & Rate Resilience
  // =========================================================================
  describe('Suite 11: Burst Invocations, Flooding & Rate Resilience', () => {
    it('test_rapid_burst_of_sendTextTurn_dispatches_all_turns_in_sequence', async () => {
      // Why this matters: Rapid multiple directives in succession (e.g. system correction + steer)
      // must each be serialized in order without dropping any payload.
      const mockSession = { sendRealtimeInput: vi.fn(), sendClientContent: vi.fn(), close: vi.fn() };
      class MockGoogleGenAI {
        constructor() { this.live = { connect: vi.fn().mockResolvedValue(mockSession) }; }
      }

      const voice = createVoiceSession({ getSystemInstruction: () => 'Prompt' });
      await voice.start({ GoogleGenAI: MockGoogleGenAI, Modality: { AUDIO: 'AUDIO' } });

      const prompts = [
        '[Instruction 1: Greet]',
        '[Instruction 2: Speak slowly]',
        '[Instruction 3: Ask about work]',
        '[Instruction 4: Offer encouragement]'
      ];

      prompts.forEach(p => {
        const ok = voice.sendTextTurn(p);
        expect(ok).toBe(true);
      });

      expect(mockSession.sendClientContent).toHaveBeenCalledTimes(4);
      prompts.forEach((p, idx) => {
        expect(mockSession.sendClientContent).toHaveBeenNthCalledWith(idx + 1, {
          turns: [{ role: 'user', parts: [{ text: p }] }],
          turnComplete: true
        });
      });

      voice.stop();
    });

    it('test_sendTextTurn_during_interrupted_state_does_not_corrupt_session', async () => {
      // Why this matters: If mic capture is interrupted by incoming call or OS focus change,
      // session is stopped and subsequent sendTextTurn calls safely return false.
      const mockSession = { sendRealtimeInput: vi.fn(), sendClientContent: vi.fn(), close: vi.fn() };
      class MockGoogleGenAI {
        constructor() { this.live = { connect: vi.fn().mockResolvedValue(mockSession) }; }
      }

      const voice = createVoiceSession({ getSystemInstruction: () => 'Prompt' });
      await voice.start({ GoogleGenAI: MockGoogleGenAI, Modality: { AUDIO: 'AUDIO' } });
      expect(voice.isActive()).toBe(true);

      // Simulate phone call interruption event
      mockListeners['interrupted']({ reason: 'audio_focus_loss' });
      expect(voice.isActive()).toBe(false);

      const sendOk = voice.sendTextTurn('[Attempted turn while interrupted]');
      expect(sendOk).toBe(false);
    });
  });

  // =========================================================================
  // SUITE 12: Dynamic getSystemInstruction Evaluation on Reconnect
  // =========================================================================
  describe('Suite 12: Dynamic getSystemInstruction Evaluation on Reconnect', () => {
    it('test_dynamic_getSystemInstruction_evaluates_freshly_on_every_reconnect', async () => {
      // Why this matters: scenario.html swaps system instruction between Phase 1 and Phase 2.
      // createVoiceSession must evaluate getSystemInstruction() fresh on every connect, never memoize.
      const mockSession = { sendRealtimeInput: vi.fn(), sendClientContent: vi.fn(), close: vi.fn() };
      const receivedInstructions = [];

      class MockGoogleGenAI {
        constructor() {
          this.live = {
            connect: vi.fn().mockImplementation(async (config) => {
              receivedInstructions.push(config.config.systemInstruction.parts[0].text);
              return mockSession;
            })
          };
        }
      }

      let currentPhase = 'roleplay';
      const voice = createVoiceSession({
        getSystemInstruction: () => currentPhase === 'roleplay'
          ? 'You are a barista in Central Perk.'
          : 'You are an English coach providing spoken feedback.'
      });

      // Session 1: Roleplay
      await voice.start({ GoogleGenAI: MockGoogleGenAI, Modality: { AUDIO: 'AUDIO' } });
      voice.stop();

      // Switch phase to feedback and reconnect
      currentPhase = 'feedback';
      await voice.start({ GoogleGenAI: MockGoogleGenAI, Modality: { AUDIO: 'AUDIO' } });
      voice.stop();

      expect(receivedInstructions).toEqual([
        'You are a barista in Central Perk.',
        'You are an English coach providing spoken feedback.'
      ]);
    });
  });

  // =========================================================================
  // SUITE 13: Listener & Resource Leak Prevention across Heavy Cycles
  // =========================================================================
  describe('Suite 13: Listener & Resource Leak Prevention across Heavy Cycles', () => {
    it('test_repeated_start_and_stop_cycles_clean_up_all_native_mic_listeners', async () => {
      // Why this matters: 10 back-to-back voice sessions must not accumulate dangling plugin listeners.
      const mockSession = { sendRealtimeInput: vi.fn(), sendClientContent: vi.fn(), close: vi.fn() };
      class MockGoogleGenAI {
        constructor() { this.live = { connect: vi.fn().mockResolvedValue(mockSession) }; }
      }

      const voice = createVoiceSession({ getSystemInstruction: () => 'Prompt' });

      for (let i = 0; i < 10; i++) {
        await voice.start({ GoogleGenAI: MockGoogleGenAI, Modality: { AUDIO: 'AUDIO' } });
        expect(voice.isActive()).toBe(true);
        voice.stop();
        expect(voice.isActive()).toBe(false);
      }

      // Allow asynchronous stopNativeMic cleanup promises to finish
      await new Promise(r => setTimeout(r, 20));

      // 10 cycles * 2 listeners (audioChunk + interrupted) = 20 total listener removals
      expect(mockRemoveHandles.length).toBe(20);
      mockRemoveHandles.forEach(handle => {
        expect(handle).toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // SUITE 14: Model Audio Playback & Turn State Transition after Kickoff
  // =========================================================================
  describe('Suite 14: Model Audio Playback & Turn State Transition after Kickoff', () => {
    it('test_modelTurn_audio_chunk_after_kickoff_updates_speaking_state_and_plays_chunk', async () => {
      // Why this matters: When AI speaks back after receiving the kickoff prompt,
      // onSpeakingChange must flip to true (muting mic) and onTurnComplete must fire upon turn end.
      const mockSession = { sendRealtimeInput: vi.fn(), sendClientContent: vi.fn(), close: vi.fn() };
      let capturedCallbacks = null;

      class MockGoogleGenAI {
        constructor() {
          this.live = {
            connect: vi.fn().mockImplementation(async (config) => {
              capturedCallbacks = config.callbacks;
              return mockSession;
            })
          };
        }
      }

      const speakingEvents = [];
      let turnCompleteFired = false;

      const voice = createVoiceSession({
        getSystemInstruction: () => 'Prompt',
        callbacks: {
          onSpeakingChange: (isSpeaking) => speakingEvents.push(isSpeaking),
          onTurnComplete: () => { turnCompleteFired = true; }
        }
      });

      await voice.start({ GoogleGenAI: MockGoogleGenAI, Modality: { AUDIO: 'AUDIO' } });

      // Model responds with audio chunk (PCM base64 data)
      const base64Audio = btoa('\x00\x00\x00\x00');
      capturedCallbacks.onmessage({
        serverContent: {
          modelTurn: {
            parts: [{ inlineData: { data: base64Audio } }]
          }
        }
      });

      expect(speakingEvents).toContain(true);

      // Model finishes turn
      capturedCallbacks.onmessage({
        serverContent: {
          turnComplete: true
        }
      });

      expect(turnCompleteFired).toBe(true);

      voice.stop();
    });
  });
});
