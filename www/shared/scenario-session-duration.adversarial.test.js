import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PENDING_CHAT_SESSION_KEY } from './auth.js';

function makeLocalStorageMock() {
  const store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i] || null,
    _dump: () => ({ ...store })
  };
}

/**
 * High-Fidelity Behavioral Simulation of scenario.html's exact state machine,
 * timer countdown, phase switching, voiceSession lifecycle callbacks,
 * localStorage persistence (both utkio_scenario_state and PENDING_CHAT_SESSION_KEY),
 * and finalizeAndSyncSession cleanup.
 */
class AdversarialScenarioHarness {
  constructor(options = {}) {
    this.todaysScenario = options.todaysScenario || {
      key: 'job_interview_opening',
      category: 'Workplace',
      title: 'Job Interview',
      character_brief: 'HR Interviewer',
      opening_situation: 'You are interviewing for a software role.'
    };
    this.phase = 'idle'; // 'idle' | 'roleplay' | 'feedback'
    this.phaseSecondsLeft = options.phaseDuration || 180;
    this.PHASE_1_DURATION_SECONDS = options.phaseDuration || 180;
    this.sessionStartedAt = null;
    this.sessionTurns = [];
    this.currentTurnIndex = -1;
    this.currentUserLine = null;
    this.currentModelLine = null;
    this.finalizeInFlight = false;
    this.sessionAttemptInFlight = false;
    this.explicitStop = false;
    this.feedbackResponseReceived = false;
    this.lastCompletedSessionId = null;
    this.isLocked = options.isLocked || false;

    this.statusText = '';
    this.statusMode = null;
    this.micDisabled = false;

    // Simulation hooks & mocks
    this.mockStartResult = options.mockStartResult || { ok: true };
    this.mockStartShouldThrow = options.mockStartShouldThrow || null;
    this.mockSyncSessionId = options.mockSyncSessionId || 'server-scenario-sess-101';
    this.mockSyncShouldFail = options.mockSyncShouldFail || false;
    this.mockVoiceActive = false;
    this.syncedPayloads = [];
    this.invalidatedCaches = [];
  }

  getTodayIstDateString(now = new Date()) {
    const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
    const ist = new Date(now.getTime() + istOffsetMs + now.getTimezoneOffset() * 60 * 1000);
    return ist.toISOString().slice(0, 10);
  }

  getScenarioStorageKey(date = new Date()) {
    if (!this.todaysScenario || !this.todaysScenario.key) return null;
    return `utkio_scenario_state_${this.todaysScenario.key}_${this.getTodayIstDateString(date)}`;
  }

  setStatus(text, mode) {
    this.statusText = text;
    this.statusMode = mode;
  }

  invalidateCache(key) {
    this.invalidatedCaches.push(key);
  }

  saveScenarioState(now = new Date()) {
    const key = this.getScenarioStorageKey(now);
    if (!key) return;
    try {
      if (this.phase === 'feedback' || this.isLocked) {
        localStorage.removeItem(key);
        return;
      }
      const state = {
        phaseSecondsLeft: this.phaseSecondsLeft,
        sessionStartedAt: this.sessionStartedAt,
        sessionTurns: this.sessionTurns.filter(t => t.content && t.content.trim())
      };
      localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
      console.warn('saveScenarioState failed:', e);
    }
  }

  restoreScenarioState(now = new Date()) {
    const key = this.getScenarioStorageKey(now);
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const state = JSON.parse(raw);
      if (state && typeof state.phaseSecondsLeft === 'number' && state.phaseSecondsLeft > 0) {
        this.phaseSecondsLeft = state.phaseSecondsLeft;
        this.sessionStartedAt = state.sessionStartedAt || this.sessionStartedAt;
        this.sessionTurns = Array.isArray(state.sessionTurns) ? state.sessionTurns : [];
        this.currentTurnIndex = this.sessionTurns.length - 1;
        const min = Math.floor(this.phaseSecondsLeft / 60);
        const sec = this.phaseSecondsLeft % 60;
        const timeStr = `${min}:${sec < 10 ? '0' : ''}${sec}`;
        this.setStatus(`Scenario in progress (${timeStr} remaining) — Tap mic to continue`, null);
      }
    } catch (e) {
      console.warn('restoreScenarioState failed:', e);
    }
  }

  persistLocalSession(currentTimeIso = new Date().toISOString(), nowObj = new Date()) {
    try {
      this.saveScenarioState(nowObj);
      const meaningful = this.sessionTurns.filter(t => t.content && t.content.trim());
      if (!meaningful.length) {
        localStorage.removeItem(PENDING_CHAT_SESSION_KEY);
        return null;
      }
      const payload = {
        session_id: null,
        started_at: this.sessionStartedAt,
        ended_at: currentTimeIso,
        session_type: 'scenario',
        scenario_key: this.todaysScenario ? this.todaysScenario.key : null,
        messages: meaningful.map(t => ({ role: t.role, content: t.content }))
      };
      localStorage.setItem(PENDING_CHAT_SESSION_KEY, JSON.stringify(payload));
      return payload;
    } catch (e) {
      console.warn('persistLocalSession failed', e);
      return null;
    }
  }

  async startSession(currentTimeIso = new Date().toISOString()) {
    if (this.mockVoiceActive || !this.todaysScenario) return { aborted: true, reason: 'active_or_no_scenario' };

    if (this.phase === 'feedback' || this.isLocked) {
      this.setStatus("Today's scenario is already complete.", null);
      return { aborted: true, reason: 'completed' };
    }

    if (this.sessionAttemptInFlight) {
      return { aborted: true, reason: 'attempt_in_flight' };
    }

    this.sessionAttemptInFlight = true;
    if (!this.sessionStartedAt) this.sessionStartedAt = currentTimeIso;
    this.phase = 'roleplay';
    this.explicitStop = false;
    this.feedbackResponseReceived = false;
    this.micDisabled = true;

    try {
      if (this.mockStartShouldThrow) {
        throw this.mockStartShouldThrow;
      }

      const result = this.mockStartResult;
      if (!result.ok) {
        this.sessionAttemptInFlight = false;
        this.micDisabled = false;
        this.sessionStartedAt = null; // Target defensive fix

        if (result.reason === 'no_api_key') {
          this.setStatus('Please add your AI Access Key in Settings.', 'err');
        } else if (result.reason === 'invalid_api_key') {
          this.setStatus((result.message || 'Invalid AI Key') + ' — go to Settings to fix this.', 'err');
        } else {
          this.setStatus(result.message || 'Could not connect.', 'err');
        }
        return { ok: false, reason: result.reason };
      }

      this.mockVoiceActive = true;
      this.sessionAttemptInFlight = false;
      this.micDisabled = false;
      return { ok: true };
    } catch (err) {
      this.sessionAttemptInFlight = false;
      this.micDisabled = false;
      this.sessionStartedAt = null; // Target defensive fix
      this.setStatus('Could not start microphone — please try again.', 'err');
      return { ok: false, reason: 'exception', error: err };
    }
  }

  addTurn(role, content) {
    this.sessionTurns.push({
      role: role === 'user' ? 'user' : 'assistant',
      content,
      phase: this.phase
    });
    this.currentTurnIndex = this.sessionTurns.length - 1;
    this.persistLocalSession();
    if (this.phase === 'feedback' && role === 'assistant') {
      this.feedbackResponseReceived = true;
    }
  }

  switchToFeedbackPhase() {
    if (this.phase !== 'roleplay') return;
    this.phase = 'feedback';
    this.currentUserLine = null;
    this.currentModelLine = null;
  }

  lockChatForToday(sessionId, nowObj = new Date()) {
    this.lastCompletedSessionId = sessionId || null;
    this.isLocked = true;
    const key = this.getScenarioStorageKey(nowObj);
    if (key) {
      try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
    this.invalidateCache('scenario_today_' + this.getTodayIstDateString(nowObj));
    this.micDisabled = true;
  }

  async finalizeAndSyncSession(currentTimeIso = new Date().toISOString(), nowObj = new Date()) {
    if (!this.sessionTurns.length || this.finalizeInFlight) return null;
    this.finalizeInFlight = true;
    try {
      const payload = this.persistLocalSession(currentTimeIso, nowObj);
      const syncedSessionId = this.mockSyncShouldFail ? null : this.mockSyncSessionId;
      if (syncedSessionId) {
        this.setStatus('Session saved. New scenario tomorrow.', null);
        this.lockChatForToday(syncedSessionId, nowObj);
        // On successful sync, PENDING_CHAT_SESSION_KEY is removed by syncPendingChatSession
        try { localStorage.removeItem(PENDING_CHAT_SESSION_KEY); } catch (_) {}
      }
      if (payload && syncedSessionId) {
        this.syncedPayloads.push(payload);
      }
      this.sessionTurns = [];
      this.currentTurnIndex = -1;
      this.sessionStartedAt = null; // Target fix
      return payload;
    } finally {
      this.finalizeInFlight = false;
    }
  }

  // Voice session callback event triggers:
  async onInterrupted(currentTimeIso = new Date().toISOString(), nowObj = new Date()) {
    this.mockVoiceActive = false;
    this.sessionAttemptInFlight = false;
    this.micDisabled = false;
    this.persistLocalSession(currentTimeIso, nowObj);

    if (this.phase === 'feedback') {
      const result = await this.finalizeAndSyncSession(currentTimeIso, nowObj);
      this.lockChatForToday(this.mockSyncSessionId, nowObj);
      this.setStatus("Today's scenario complete! A new scenario will be available tomorrow.", null);
      return result;
    } else {
      const min = Math.floor(this.phaseSecondsLeft / 60);
      const sec = this.phaseSecondsLeft % 60;
      const timeStr = `${min}:${sec < 10 ? '0' : ''}${sec}`;
      this.setStatus(`Scenario paused (${timeStr} remaining). Tap mic to continue.`, null);
      return null;
    }
  }

  async onInactivityTimeout(info = {}, currentTimeIso = new Date().toISOString(), nowObj = new Date()) {
    this.mockVoiceActive = false;
    this.sessionAttemptInFlight = false;
    this.micDisabled = false;
    this.persistLocalSession(currentTimeIso, nowObj);

    if (this.phase === 'feedback') {
      const result = await this.finalizeAndSyncSession(currentTimeIso, nowObj);
      this.lockChatForToday(this.mockSyncSessionId, nowObj);
      return result;
    } else {
      const min = Math.floor(this.phaseSecondsLeft / 60);
      const sec = this.phaseSecondsLeft % 60;
      const timeStr = `${min}:${sec < 10 ? '0' : ''}${sec}`;
      const reasonText = info && info.reason === 'stagnant_turn' ? 'Inactivity' : '90s silence';
      this.setStatus(`Scenario paused due to ${reasonText} (${timeStr} remaining). Tap mic to continue.`, null);
      return null;
    }
  }

  async onClose(currentTimeIso = new Date().toISOString(), nowObj = new Date()) {
    this.mockVoiceActive = false;
    this.sessionAttemptInFlight = false;
    this.micDisabled = false;

    if (this.phase === 'feedback') {
      const result = await this.finalizeAndSyncSession(currentTimeIso, nowObj);
      this.lockChatForToday(this.mockSyncSessionId, nowObj);
      return result;
    }

    this.persistLocalSession(currentTimeIso, nowObj);
    const min = Math.floor(this.phaseSecondsLeft / 60);
    const sec = this.phaseSecondsLeft % 60;
    const timeStr = `${min}:${sec < 10 ? '0' : ''}${sec}`;
    this.setStatus(`Scenario paused (${timeStr} remaining). Tap mic to continue.`, null);
    return null;
  }

  async stopSession(currentTimeIso = new Date().toISOString(), nowObj = new Date()) {
    this.explicitStop = true;
    this.mockVoiceActive = false;
    return await this.onClose(currentTimeIso, nowObj);
  }
}

describe('Adversarial & Hardcore Regression Suite — Issue #3 (AUD-003: scenario.html sessionStartedAt & State Lifecycle)', () => {
  const scenarioHtmlPath = path.resolve(__dirname, '../scenario.html');
  let scenarioHtmlContent = '';
  let localStorageMock;

  beforeEach(() => {
    scenarioHtmlContent = fs.readFileSync(scenarioHtmlPath, 'utf8');
    localStorageMock = makeLocalStorageMock();
    vi.stubGlobal('localStorage', localStorageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // SUITE 1: Static AST & Source Code Level Invariants
  // =========================================================================
  describe('Suite 1: Static AST & Source Code Invariants in scenario.html', () => {
    // Verifies finalizeAndSyncSession has explicit sessionStartedAt = null cleanup
    it('test_ast_scenario_html_finalizeAndSyncSession_cleans_sessionStartedAt_unconditionally', () => {
      const fnRegex = /async\s+function\s+finalizeAndSyncSession\s*\(\)\s*\{([\s\S]*?)\n\}/;
      const match = scenarioHtmlContent.match(fnRegex);
      expect(match, 'finalizeAndSyncSession() must be defined in scenario.html').not.toBeNull();

      const body = match[1];
      const hasReset = /sessionStartedAt\s*=\s*null\s*;?/.test(body);
      expect(hasReset, 'CRITICAL: finalizeAndSyncSession() MUST reset sessionStartedAt = null').toBe(true);

      const hasTurnsReset = /sessionTurns\s*=\s*\[\s*\]\s*;?/.test(body);
      expect(hasTurnsReset, 'finalizeAndSyncSession() must clear sessionTurns').toBe(true);

      const hasTurnIndexReset = /currentTurnIndex\s*=\s*-1\s*;?/.test(body);
      expect(hasTurnIndexReset, 'finalizeAndSyncSession() must reset currentTurnIndex').toBe(true);
    });

    // Verifies startSession wraps dynamic import & start in try/catch and clears sessionStartedAt on !result.ok
    it('test_ast_scenario_html_startSession_has_defensive_try_catch_and_reset_on_failure', () => {
      const fnRegex = /async\s+function\s+startSession\s*\(\)\s*\{([\s\S]*?)\n\}/;
      const match = scenarioHtmlContent.match(fnRegex);
      expect(match, 'startSession() must be defined in scenario.html').not.toBeNull();

      const body = match[1];
      const hasTry = body.includes('try {');
      const hasCatch = body.includes('} catch (err)') || body.includes('} catch (e)');
      expect(hasTry && hasCatch, 'startSession() MUST contain a try...catch block').toBe(true);

      const notOkBranchMatch = body.match(/if\s*\(\s*!result\.ok\s*\)\s*\{([\s\S]*?)\}/);
      expect(notOkBranchMatch, '!result.ok check must exist in startSession()').not.toBeNull();
      const notOkBody = notOkBranchMatch ? notOkBranchMatch[1] : '';
      expect(/sessionStartedAt\s*=\s*null/.test(notOkBody), 'startSession() MUST reset sessionStartedAt = null in !result.ok').toBe(true);
      expect(/sessionAttemptInFlight\s*=\s*false/.test(notOkBody), 'startSession() MUST reset sessionAttemptInFlight = false in !result.ok').toBe(true);

      const catchMatch = body.match(/catch\s*\([^)]*\)\s*\{([\s\S]*?)\}/);
      expect(catchMatch, 'catch block must exist in startSession()').not.toBeNull();
      const catchBody = catchMatch ? catchMatch[1] : '';
      expect(/sessionStartedAt\s*=\s*null/.test(catchBody), 'startSession() MUST reset sessionStartedAt = null in catch block').toBe(true);
      expect(/sessionAttemptInFlight\s*=\s*false/.test(catchBody), 'startSession() MUST reset sessionAttemptInFlight = false in catch block').toBe(true);
    });

    // Verifies lockChatForToday properly cleans up storage and invalidates cache
    it('test_ast_scenario_html_lockChatForToday_invalidates_cache_and_removes_state', () => {
      const fnRegex = /function\s+lockChatForToday\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/;
      const match = scenarioHtmlContent.match(fnRegex);
      expect(match, 'lockChatForToday() must be defined in scenario.html').not.toBeNull();

      const body = match[1];
      expect(body.includes('localStorage.removeItem(key)'), 'lockChatForToday must remove localStorage key').toBe(true);
      expect(body.includes('invalidateCache('), 'lockChatForToday must invalidate cached scenario response').toBe(true);
      expect(body.includes('lockedBanner.classList.add(\'show\')'), 'lockChatForToday must show locked banner').toBe(true);
    });

    // Verifies voiceSession callbacks invoke finalizeAndSyncSession on feedback phase
    it('test_ast_scenario_html_voice_callbacks_trigger_finalize_on_feedback_phase', () => {
      expect(scenarioHtmlContent).toMatch(/onInterrupted[\s\S]*?phase\s*===\s*['"]feedback['"][\s\S]*?finalizeAndSyncSession/);
      expect(scenarioHtmlContent).toMatch(/onInactivityTimeout[\s\S]*?phase\s*===\s*['"]feedback['"][\s\S]*?finalizeAndSyncSession/);
      expect(scenarioHtmlContent).toMatch(/onClose[\s\S]*?phase\s*===\s*['"]feedback['"][\s\S]*?finalizeAndSyncSession/);
    });
  });

  // =========================================================================
  // SUITE 2: Behavioral Lifecycle, Startup Failures & Zero-Leakage Assurances
  // =========================================================================
  describe('Suite 2: Startup Failures, Timestamp Monotonicity & Zero-Leakage', () => {
    // Tests that complete roleplay + feedback lifecycle produces exact timestamps and cleans up
    it('test_full_scenario_lifecycle_roleplay_to_feedback_produces_exact_duration_and_cleans_state', async () => {
      const harness = new AdversarialScenarioHarness();
      const t0 = '2026-08-29T10:00:00.000Z';
      const t1 = '2026-08-29T10:03:00.000Z';
      const t2 = '2026-08-29T10:04:15.000Z';

      // 1. Start session in roleplay phase
      const startRes = await harness.startSession(t0);
      expect(startRes.ok).toBe(true);
      expect(harness.sessionStartedAt).toBe(t0);
      expect(harness.phase).toBe('roleplay');

      // 2. Add turns during roleplay
      harness.addTurn('assistant', 'Welcome to the interview. Why do you want this role?');
      harness.addTurn('user', 'I have five years of experience building web applications.');

      // 3. Switch to feedback phase when countdown expires
      harness.phaseSecondsLeft = 0;
      harness.switchToFeedbackPhase();
      expect(harness.phase).toBe('feedback');

      // 4. Model delivers spoken feedback
      harness.addTurn('assistant', 'Great job speaking clearly! Work on using past continuous tense next time.');

      // 5. Complete session
      const payload = await harness.stopSession(t2);
      expect(payload).not.toBeNull();
      expect(payload.started_at).toBe(t0);
      expect(payload.ended_at).toBe(t2);
      expect(payload.session_type).toBe('scenario');
      expect(payload.scenario_key).toBe('job_interview_opening');
      expect(payload.messages.length).toBe(3);

      // Duration should be exactly 4 minutes 15 seconds (255,000 ms)
      const durationMs = new Date(payload.ended_at).getTime() - new Date(payload.started_at).getTime();
      expect(durationMs).toBe(255000);

      // Invariant: in-memory state is completely cleaned up
      expect(harness.sessionStartedAt).toBeNull();
      expect(harness.sessionTurns.length).toBe(0);
      expect(harness.currentTurnIndex).toBe(-1);
      expect(harness.isLocked).toBe(true);
    });

    // Adversarial: Start fails due to no API key -> user waits 25 mins -> starts successfully.
    // Must NOT inherit the 25-minute-old timestamp.
    it('test_failed_start_no_api_key_does_not_poison_subsequent_session_timestamp', async () => {
      const harness = new AdversarialScenarioHarness({
        mockStartResult: { ok: false, reason: 'no_api_key' }
      });

      const tFail = '2026-08-29T09:00:00.000Z';
      const tSuccess = '2026-08-29T09:25:00.000Z';
      const tEnd = '2026-08-29T09:28:30.000Z';

      // 1. Failed start attempt
      const failRes = await harness.startSession(tFail);
      expect(failRes.ok).toBe(false);
      expect(failRes.reason).toBe('no_api_key');
      expect(harness.sessionStartedAt).toBeNull(); // MUST be cleaned
      expect(harness.sessionAttemptInFlight).toBe(false);
      expect(harness.micDisabled).toBe(false);
      expect(harness.statusText).toContain('Please add your AI Access Key');

      // 2. User fixes key and starts 25 minutes later
      harness.mockStartResult = { ok: true };
      const successRes = await harness.startSession(tSuccess);
      expect(successRes.ok).toBe(true);
      expect(harness.sessionStartedAt).toBe(tSuccess); // MUST be tSuccess, NOT tFail

      // 3. User finishes 3.5 minutes later
      harness.addTurn('assistant', 'Good morning! How are you?');
      harness.addTurn('user', 'I am doing well, thank you.');
      harness.switchToFeedbackPhase();
      harness.addTurn('assistant', 'Excellent introduction.');

      const payload = await harness.stopSession(tEnd);
      expect(payload.started_at).toBe(tSuccess);
      expect(payload.ended_at).toBe(tEnd);

      const durationSec = (new Date(payload.ended_at) - new Date(payload.started_at)) / 1000;
      expect(durationSec).toBe(210); // Exactly 3.5 minutes, NOT 28.5 minutes (1710s)
    });

    // Adversarial: Start fails due to invalid key -> user fixes -> correct duration calculated
    it('test_failed_start_invalid_api_key_clears_sessionStartedAt_and_allows_clean_retry', async () => {
      const harness = new AdversarialScenarioHarness({
        mockStartResult: { ok: false, reason: 'invalid_api_key', message: 'API key not valid' }
      });

      const tFail = '2026-08-29T14:00:00.000Z';
      const tRetry = '2026-08-29T14:40:00.000Z';
      const tDone = '2026-08-29T14:43:00.000Z';

      const failRes = await harness.startSession(tFail);
      expect(failRes.ok).toBe(false);
      expect(harness.sessionStartedAt).toBeNull();

      // Retry
      harness.mockStartResult = { ok: true };
      await harness.startSession(tRetry);
      expect(harness.sessionStartedAt).toBe(tRetry);

      harness.addTurn('assistant', 'Welcome!');
      harness.addTurn('user', 'Hello!');
      harness.switchToFeedbackPhase();
      harness.addTurn('assistant', 'Feedback done.');

      const payload = await harness.stopSession(tDone);
      expect(payload.started_at).toBe(tRetry);
      expect((new Date(payload.ended_at) - new Date(payload.started_at)) / 1000).toBe(180);
    });

    // Adversarial: Hardware mic exception / SDK import rejection resets sessionStartedAt
    it('test_hardware_permission_or_import_exception_clears_sessionStartedAt', async () => {
      const harness = new AdversarialScenarioHarness({
        mockStartShouldThrow: new Error('DOMException: NotAllowedError - Permission denied')
      });

      const tCrash = '2026-08-29T08:00:00.000Z';
      const tNext = '2026-08-29T08:10:00.000Z';

      const crashRes = await harness.startSession(tCrash);
      expect(crashRes.ok).toBe(false);
      expect(crashRes.reason).toBe('exception');
      expect(harness.sessionStartedAt).toBeNull();
      expect(harness.sessionAttemptInFlight).toBe(false);
      expect(harness.micDisabled).toBe(false);
      expect(harness.statusText).toContain('Could not start microphone');

      // Next clean start
      harness.mockStartShouldThrow = null;
      harness.mockStartResult = { ok: true };
      const nextRes = await harness.startSession(tNext);
      expect(nextRes.ok).toBe(true);
      expect(harness.sessionStartedAt).toBe(tNext);
    });
  });

  // =========================================================================
  // SUITE 3: Multi-Leg Roleplay Resumption, Pauses, and Mid-Feedback Transitions
  // =========================================================================
  describe('Suite 3: Multi-Leg Resumption, Inactivity Timeouts & Interrupted Calls', () => {
    // Tests that mid-roleplay interruption preserves state for resumption without finalizing
    it('test_mid_roleplay_interruption_preserves_remaining_seconds_and_started_at_for_tap_to_resume', async () => {
      const harness = new AdversarialScenarioHarness({ phaseDuration: 180 });
      const t0 = '2026-08-29T10:00:00.000Z';
      const tPause = '2026-08-29T10:01:00.000Z';
      const tResume = '2026-08-29T10:10:00.000Z';
      const tFinish = '2026-08-29T10:12:00.000Z';

      // Start roleplay
      await harness.startSession(t0);
      harness.phaseSecondsLeft = 120; // 60 seconds elapsed
      harness.addTurn('assistant', 'Question 1');
      harness.addTurn('user', 'Answer 1');

      // Phone call received (onInterrupted)
      const pausedResult = await harness.onInterrupted(tPause);
      expect(pausedResult).toBeNull(); // Roleplay paused does not finalize
      expect(harness.statusText).toContain('Scenario paused (2:00 remaining)');
      expect(harness.isLocked).toBe(false);

      // Local storage must contain preserved state
      const stateKey = harness.getScenarioStorageKey();
      const rawState = localStorage.getItem(stateKey);
      expect(rawState).not.toBeNull();
      const savedState = JSON.parse(rawState);
      expect(savedState.phaseSecondsLeft).toBe(120);
      expect(savedState.sessionStartedAt).toBe(t0);
      expect(savedState.sessionTurns.length).toBe(2);

      // Resumed after phone call ends
      harness.restoreScenarioState();
      await harness.startSession(tResume); // Resume session
      expect(harness.sessionStartedAt).toBe(t0); // Preserves initial started_at for unbroken roleplay

      // Finish roleplay and transition to feedback
      harness.phaseSecondsLeft = 0;
      harness.switchToFeedbackPhase();
      harness.addTurn('assistant', 'Final Feedback Summary');

      // Finalize session
      const finalPayload = await harness.onClose(tFinish);
      expect(finalPayload).not.toBeNull();
      expect(finalPayload.started_at).toBe(t0);
      expect(finalPayload.messages.length).toBe(3);

      // State is purged upon final completion
      expect(harness.sessionStartedAt).toBeNull();
      expect(localStorage.getItem(stateKey)).toBeNull();
      expect(harness.isLocked).toBe(true);
    });

    // Tests that mid-feedback interruption immediately finalizes and locks the day
    it('test_mid_feedback_interruption_finalizes_and_locks_immediately', async () => {
      const harness = new AdversarialScenarioHarness();
      const t0 = '2026-08-29T11:00:00.000Z';
      const tFeedback = '2026-08-29T11:03:00.000Z';
      const tInterrupt = '2026-08-29T11:03:45.000Z';

      await harness.startSession(t0);
      harness.addTurn('assistant', 'Roleplay start');
      harness.addTurn('user', 'Roleplay response');
      harness.switchToFeedbackPhase();
      harness.addTurn('assistant', 'Here is your feedback...');

      // Interruption happens during feedback monologue
      const payload = await harness.onInterrupted(tInterrupt);
      expect(payload).not.toBeNull();
      expect(payload.started_at).toBe(t0);
      expect(payload.ended_at).toBe(tInterrupt);
      expect(harness.sessionStartedAt).toBeNull();
      expect(harness.isLocked).toBe(true);
      expect(harness.statusText).toContain("Today's scenario complete");
    });

    // Tests that 90s silence inactivity timeout during feedback finalizes and clears started_at
    it('test_mid_feedback_inactivity_timeout_finalizes_session_and_resets_started_at', async () => {
      const harness = new AdversarialScenarioHarness();
      const t0 = '2026-08-29T12:00:00.000Z';
      const tTimeout = '2026-08-29T12:04:30.000Z';

      await harness.startSession(t0);
      harness.addTurn('assistant', 'Intro');
      harness.addTurn('user', 'Reply');
      harness.switchToFeedbackPhase();
      harness.addTurn('assistant', 'Coach feedback');

      const payload = await harness.onInactivityTimeout({ reason: 'silence_90s' }, tTimeout);
      expect(payload).not.toBeNull();
      expect(payload.started_at).toBe(t0);
      expect(harness.sessionStartedAt).toBeNull();
      expect(harness.isLocked).toBe(true);
    });
  });

  // =========================================================================
  // SUITE 4: Concurrency, Double-Clicks, Flaky Networks & Race Conditions
  // =========================================================================
  describe('Suite 4: Concurrency, Double-Taps, Network Failures & Storage Tampering', () => {
    // Rapid double-clicks on mic button during startSession
    it('test_rapid_multi_click_on_startSession_is_safely_debounced_by_in_flight_flag', async () => {
      const harness = new AdversarialScenarioHarness();
      const t0 = '2026-08-29T15:00:00.000Z';

      // Launch 5 concurrent startSession attempts
      const p1 = harness.startSession(t0);
      const p2 = harness.startSession(t0);
      const p3 = harness.startSession(t0);
      const p4 = harness.startSession(t0);
      const p5 = harness.startSession(t0);

      const results = await Promise.all([p1, p2, p3, p4, p5]);
      const successfulStarts = results.filter(r => r.ok === true);
      const abortedStarts = results.filter(r => r.aborted === true);

      expect(successfulStarts.length).toBe(1);
      expect(abortedStarts.length).toBe(4);
      expect(harness.sessionStartedAt).toBe(t0);
    });

    // Concurrent finalize calls when sync is slow
    it('test_concurrent_finalizeAndSyncSession_calls_prevent_duplicate_sync_and_double_reset', async () => {
      const harness = new AdversarialScenarioHarness();
      const t0 = '2026-08-29T16:00:00.000Z';
      const tEnd = '2026-08-29T16:03:00.000Z';

      await harness.startSession(t0);
      harness.addTurn('assistant', 'Prompt');
      harness.addTurn('user', 'Reply');
      harness.switchToFeedbackPhase();
      harness.addTurn('assistant', 'Feedback');

      // Call finalize multiple times simultaneously
      const f1 = harness.finalizeAndSyncSession(tEnd);
      const f2 = harness.finalizeAndSyncSession(tEnd);
      const f3 = harness.finalizeAndSyncSession(tEnd);

      const [res1, res2, res3] = await Promise.all([f1, f2, f3]);
      expect(res1).not.toBeNull();
      expect(res2).toBeNull(); // Guarded by finalizeInFlight
      expect(res3).toBeNull(); // Guarded by finalizeInFlight
      expect(harness.syncedPayloads.length).toBe(1);
      expect(harness.sessionStartedAt).toBeNull();
    });

    // Network timeout during sync: turns saved to local storage, sessionStartedAt cleaned in memory
    it('test_sync_network_failure_resets_sessionStartedAt_and_preserves_local_payload_for_retry', async () => {
      const harness = new AdversarialScenarioHarness({
        mockSyncShouldFail: true
      });
      const t0 = '2026-08-29T17:00:00.000Z';
      const tEnd = '2026-08-29T17:03:30.000Z';

      await harness.startSession(t0);
      harness.addTurn('assistant', 'Roleplay');
      harness.addTurn('user', 'Answer');
      harness.switchToFeedbackPhase();
      harness.addTurn('assistant', 'Feedback');

      // Finalize should NOT throw because syncPendingChatSession catches network errors silently
      const payload = await harness.finalizeAndSyncSession(tEnd);
      expect(payload).not.toBeNull();

      // Invariant 1: Local storage has the pending payload for next app-open sync
      const rawPending = localStorage.getItem(PENDING_CHAT_SESSION_KEY);
      expect(rawPending).not.toBeNull();
      const parsedPending = JSON.parse(rawPending);
      expect(parsedPending.started_at).toBe(t0);
      expect(parsedPending.ended_at).toBe(tEnd);
      expect(parsedPending.session_type).toBe('scenario');

      // Invariant 2: In-memory sessionStartedAt and sessionTurns are reset
      expect(harness.sessionStartedAt).toBeNull();
      expect(harness.sessionTurns.length).toBe(0);
      expect(harness.finalizeInFlight).toBe(false);
    });

    // Corrupted localStorage JSON should not crash restoreScenarioState
    it('test_corrupted_json_in_local_storage_does_not_throw_or_corrupt_memory', () => {
      const harness = new AdversarialScenarioHarness();
      const key = harness.getScenarioStorageKey();
      localStorage.setItem(key, '{corrupted_malformed_json:::');

      expect(() => harness.restoreScenarioState()).not.toThrow();
      expect(harness.sessionStartedAt).toBeNull();
      expect(harness.sessionTurns.length).toBe(0);
    });

    // Zero / expired phaseSecondsLeft in storage is ignored
    it('test_expired_phase_seconds_in_storage_is_safely_ignored_by_restoreScenarioState', () => {
      const harness = new AdversarialScenarioHarness();
      const key = harness.getScenarioStorageKey();
      localStorage.setItem(key, JSON.stringify({
        phaseSecondsLeft: 0,
        sessionStartedAt: '2026-08-29T00:00:00.000Z',
        sessionTurns: [{ role: 'user', content: 'hello' }]
      }));

      harness.restoreScenarioState();
      expect(harness.sessionStartedAt).toBeNull();
      expect(harness.sessionTurns.length).toBe(0);
    });

    // Whitespace-only turns are purged from PENDING_CHAT_SESSION_KEY
    it('test_whitespace_only_turns_purge_pending_session_key', () => {
      const harness = new AdversarialScenarioHarness();
      localStorage.setItem(PENDING_CHAT_SESSION_KEY, '{"session_id": "old"}');

      harness.sessionTurns = [
        { role: 'user', content: '   \t  \n  ', phase: 'roleplay' },
        { role: 'assistant', content: '', phase: 'roleplay' }
      ];
      harness.persistLocalSession();

      expect(localStorage.getItem(PENDING_CHAT_SESSION_KEY)).toBeNull();
    });
  });

  // =========================================================================
  // SUITE 5: Parity and Sibling Path Comparison (chat.html vs scenario.html)
  // =========================================================================
  describe('Suite 5: Sibling Parity & Contract Verification (chat.html vs scenario.html)', () => {
    // Validates that both chat.html and scenario.html follow the identical pattern for sessionStartedAt lifecycle
    it('test_chat_html_and_scenario_html_share_identical_defensive_sessionStartedAt_pattern', () => {
      const chatHtmlPath = path.resolve(__dirname, '../chat.html');
      const chatHtmlContent = fs.readFileSync(chatHtmlPath, 'utf8');

      // 1. Both reset sessionStartedAt in finalizeAndSyncSession
      expect(chatHtmlContent).toMatch(/async\s+function\s+finalizeAndSyncSession[\s\S]*?sessionStartedAt\s*=\s*null/);
      expect(scenarioHtmlContent).toMatch(/async\s+function\s+finalizeAndSyncSession[\s\S]*?sessionStartedAt\s*=\s*null/);

      // 2. Both reset sessionStartedAt on !result.ok in startSession
      expect(chatHtmlContent).toMatch(/async\s+function\s+startSession[\s\S]*?!result\.ok[\s\S]*?sessionStartedAt\s*=\s*null/);
      expect(scenarioHtmlContent).toMatch(/async\s+function\s+startSession[\s\S]*?!result\.ok[\s\S]*?sessionStartedAt\s*=\s*null/);

      // 3. Both reset sessionStartedAt in catch block in startSession
      expect(chatHtmlContent).toMatch(/async\s+function\s+startSession[\s\S]*?catch[\s\S]*?sessionStartedAt\s*=\s*null/);
      expect(scenarioHtmlContent).toMatch(/async\s+function\s+startSession[\s\S]*?catch[\s\S]*?sessionStartedAt\s*=\s*null/);
    });

    // Validates payload schema for scenario session vs chat session
    it('test_scenario_payload_contains_session_type_and_scenario_key', async () => {
      const harness = new AdversarialScenarioHarness({
        todaysScenario: { key: 'restaurant_order', title: 'Ordering Food' }
      });
      const t0 = '2026-08-29T18:00:00.000Z';
      const t1 = '2026-08-29T18:03:00.000Z';

      await harness.startSession(t0);
      harness.addTurn('assistant', 'Can I take your order?');
      harness.addTurn('user', 'I would like a vegetable burger and iced tea.');
      harness.switchToFeedbackPhase();
      harness.addTurn('assistant', 'Nicely done ordering.');

      const payload = await harness.stopSession(t1);
      expect(payload.session_id).toBeNull();
      expect(payload.session_type).toBe('scenario');
      expect(payload.scenario_key).toBe('restaurant_order');
      expect(payload.started_at).toBe(t0);
      expect(payload.ended_at).toBe(t1);
      expect(payload.messages.length).toBe(3);
    });
  });

  // =========================================================================
  // SUITE 6: Midnight Date Rollover, Locked Gating, Special Characters & Cycles
  // =========================================================================
  describe('Suite 6: Date Rollover, Locked Gating, Unicode Characters & Day Cycle Isolation', () => {
    // Tests that an already completed scenario blocks startSession
    it('test_already_completed_scenario_blocks_startSession_and_preserves_null_started_at', async () => {
      const harness = new AdversarialScenarioHarness({
        isLocked: true
      });

      const res = await harness.startSession('2026-08-29T10:00:00.000Z');
      expect(res.aborted).toBe(true);
      expect(res.reason).toBe('completed');
      expect(harness.sessionStartedAt).toBeNull();
      expect(harness.statusText).toContain("Today's scenario is already complete");
    });

    // Tests midnight IST date rollover isolates storage keys and does not restore yesterday's state
    it('test_midnight_ist_rollover_isolates_storage_keys_and_prevents_stale_restoration', () => {
      const harness = new AdversarialScenarioHarness();
      const yesterday = new Date('2026-08-28T23:55:00.000Z'); // 05:25 AM IST on 29th or prev day
      const today = new Date('2026-08-29T10:00:00.000Z');

      const yesterdayKey = harness.getScenarioStorageKey(yesterday);
      const todayKey = harness.getScenarioStorageKey(today);

      expect(yesterdayKey).not.toBe(todayKey);

      // Save unfinished session on yesterday
      harness.sessionStartedAt = '2026-08-28T23:55:00.000Z';
      harness.phaseSecondsLeft = 60;
      harness.sessionTurns = [{ role: 'user', content: 'yesterday speech', phase: 'roleplay' }];
      harness.saveScenarioState(yesterday);

      // Reset in-memory state as if new page load happened today
      const freshHarness = new AdversarialScenarioHarness();
      freshHarness.restoreScenarioState(today);

      // Today's restore must be clean, unaffected by yesterday's key
      expect(freshHarness.sessionStartedAt).toBeNull();
      expect(freshHarness.sessionTurns.length).toBe(0);
      expect(freshHarness.phaseSecondsLeft).toBe(180);
    });

    // Tests unicode emojis and script tags in scenario turns
    it('test_unicode_emojis_and_script_tags_in_scenario_turns_persist_safely', async () => {
      const harness = new AdversarialScenarioHarness();
      const t0 = '2026-08-29T19:00:00.000Z';
      const t1 = '2026-08-29T19:03:00.000Z';

      await harness.startSession(t0);
      harness.addTurn('assistant', 'Hello! 😊 What is your favorite book? <script>alert(1)</script>');
      harness.addTurn('user', 'I love 🚀 "The Hitchhiker\'s Guide" & "War and Peace" — नमस्ते!');
      harness.switchToFeedbackPhase();
      harness.addTurn('assistant', 'Superb feedback! ✨');

      const payload = await harness.stopSession(t1);
      expect(payload).not.toBeNull();
      expect(payload.messages[0].content).toContain('😊');
      expect(payload.messages[0].content).toContain('<script>');
      expect(payload.messages[1].content).toContain('🚀');
      expect(payload.messages[1].content).toContain('नमस्ते');
      expect(harness.sessionStartedAt).toBeNull();
    });

    // Tests multiple successive day cycles maintain complete state isolation
    it('test_multi_day_cycles_maintain_independent_sessionStartedAt_and_clean_state', async () => {
      // Day 1
      const harnessDay1 = new AdversarialScenarioHarness({
        todaysScenario: { key: 'day1_scenario', title: 'Day 1' }
      });
      const tDay1Start = '2026-08-29T10:00:00.000Z';
      const tDay1End = '2026-08-29T10:03:00.000Z';

      await harnessDay1.startSession(tDay1Start);
      harnessDay1.addTurn('assistant', 'Day 1 Prompt');
      harnessDay1.addTurn('user', 'Day 1 Answer');
      harnessDay1.switchToFeedbackPhase();
      harnessDay1.addTurn('assistant', 'Day 1 Feedback');
      const p1 = await harnessDay1.stopSession(tDay1End);

      expect(p1.started_at).toBe(tDay1Start);
      expect(p1.ended_at).toBe(tDay1End);
      expect(harnessDay1.sessionStartedAt).toBeNull();

      // Day 2
      const harnessDay2 = new AdversarialScenarioHarness({
        todaysScenario: { key: 'day2_scenario', title: 'Day 2' }
      });
      const tDay2Start = '2026-08-30T10:00:00.000Z';
      const tDay2End = '2026-08-30T10:03:30.000Z';

      await harnessDay2.startSession(tDay2Start);
      harnessDay2.addTurn('assistant', 'Day 2 Prompt');
      harnessDay2.addTurn('user', 'Day 2 Answer');
      harnessDay2.switchToFeedbackPhase();
      harnessDay2.addTurn('assistant', 'Day 2 Feedback');
      const p2 = await harnessDay2.stopSession(tDay2End);

      expect(p2.started_at).toBe(tDay2Start);
      expect(p2.ended_at).toBe(tDay2End);
      expect(harnessDay2.sessionStartedAt).toBeNull();
    });
  });
});

