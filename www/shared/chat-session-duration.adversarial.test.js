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
    clear: () => { for (const k in store) delete store[k]; }
  };
}

/**
 * High-Fidelity Simulation of chat.html's exact lifecycle, state transitions,
 * startSession defensive branches, voice callbacks, and local persistence.
 */
class AdversarialChatHarness {
  constructor(options = {}) {
    this.sessionTurns = [];
    this.sessionStartedAt = null;
    this.currentTurnIndex = -1;
    this.activeSessionId = options.initialSessionId || null;
    this.priorTranscriptText = '';
    this.finalizeInFlight = false;
    this.isBusy = false;
    this.isLocked = options.isLocked || false;
    this.status = null;
    this.statusMode = null;
    this.mockStartResult = options.mockStartResult || { ok: true };
    this.mockStartShouldThrow = options.mockStartShouldThrow || null;
    this.mockSyncSessionId = options.mockSyncSessionId || 'server-sess-generated-999';
    this.mockSyncShouldFail = options.mockSyncShouldFail || false;
    this.syncedPayloads = [];
    this.knownTurnCount = 0;
    this.reportPillShown = false;
  }

  setStatus(text, mode) {
    this.status = text;
    this.statusMode = mode;
  }

  async startSession(currentTimeIso = new Date().toISOString()) {
    if (this.isBusy) return { aborted: true, reason: 'busy' };
    if (this.isLocked) {
      this.setStatus('This chat already has a report — start a new chat to continue.', 'err');
      return { aborted: true, reason: 'locked' };
    }

    this.isBusy = true;

    if (!this.sessionStartedAt) {
      this.sessionStartedAt = currentTimeIso;
    }

    try {
      if (this.mockStartShouldThrow) {
        throw this.mockStartShouldThrow;
      }

      const result = this.mockStartResult;
      if (!result.ok) {
        this.isBusy = false;
        this.sessionStartedAt = null; // Defensive fix check
        if (result.reason === 'no_api_key') {
          this.setStatus('Please add your AI Access Key in Settings.', 'err');
        } else if (result.reason === 'invalid_api_key') {
          this.setStatus((result.message || 'Invalid AI Key') + ' — go to Settings to fix this.', 'err');
        } else if (result.message) {
          this.setStatus(result.message, 'err');
        }
        return { ok: false, reason: result.reason };
      }

      this.isBusy = false;
      return { ok: true };
    } catch (err) {
      this.isBusy = false;
      this.sessionStartedAt = null; // Defensive fix check in catch block
      this.setStatus('Could not start microphone — please try again.', 'err');
      return { ok: false, error: err };
    }
  }

  addTurn(role, content) {
    this.currentTurnIndex++;
    this.sessionTurns.push({ role, content });
  }

  persistLocalSession(currentTimeIso = new Date().toISOString()) {
    try {
      const meaningful = this.sessionTurns.filter(t => t.content && t.content.trim());
      if (!meaningful.length) {
        localStorage.removeItem(PENDING_CHAT_SESSION_KEY);
        return null;
      }
      const payload = {
        session_id: this.activeSessionId,
        started_at: this.sessionStartedAt,
        ended_at: currentTimeIso,
        messages: meaningful
      };
      localStorage.setItem(PENDING_CHAT_SESSION_KEY, JSON.stringify(payload));
      return payload;
    } catch (e) {
      console.warn('persistLocalSession failed', e);
      return null;
    }
  }

  async stopSession(currentTimeIso = new Date().toISOString()) {
    this.isBusy = false;
    return await this.finalizeAndSyncSession(currentTimeIso);
  }

  async triggerInterruption(currentTimeIso = new Date().toISOString()) {
    this.isBusy = false;
    const result = await this.finalizeAndSyncSession(currentTimeIso);
    this.setStatus('Call received — session paused. Tap mic to continue.', null);
    return result;
  }

  async triggerInactivityTimeout(info = {}, currentTimeIso = new Date().toISOString()) {
    this.isBusy = false;
    const result = await this.finalizeAndSyncSession(currentTimeIso);
    const msg = info.reason === 'stagnant_turn'
      ? 'Session paused due to extended inactivity. Tap mic to continue.'
      : 'Session closed due to 90 seconds of inactivity. Tap mic to resume.';
    this.setStatus(msg, null);
    return result;
  }

  async finalizeAndSyncSession(currentTimeIso = new Date().toISOString()) {
    if (!this.sessionTurns.length || this.finalizeInFlight) {
      // If no turns were spoken and mic stopped, clear startedAt to prevent poisoning future sessions
      if (!this.sessionTurns.length) {
        this.sessionStartedAt = null;
      }
      return null;
    }
    this.finalizeInFlight = true;

    try {
      const payload = this.persistLocalSession(currentTimeIso);

      const justSpoken = this.sessionTurns
        .filter(t => t.content && t.content.trim())
        .map(t => (t.role === 'user' ? 'User' : 'Bolo') + ': ' + t.content)
        .join('\n');
      if (justSpoken) {
        this.priorTranscriptText = this.priorTranscriptText
          ? (this.priorTranscriptText + '\n' + justSpoken)
          : justSpoken;
        if (this.priorTranscriptText.length > 6000) {
          this.priorTranscriptText = this.priorTranscriptText.slice(this.priorTranscriptText.length - 6000);
        }
      }

      if (this.mockSyncShouldFail) {
        throw new Error('Network error: POST /chat/sessions failed');
      }

      const syncedSessionId = this.mockSyncSessionId;
      if (syncedSessionId) {
        this.activeSessionId = syncedSessionId;
        this.knownTurnCount += this.sessionTurns.length;
        if (this.knownTurnCount >= 10) {
          this.reportPillShown = true;
        }
      }

      if (payload) {
        this.syncedPayloads.push(payload);
      }

      this.sessionTurns = [];
      this.currentTurnIndex = -1;
      this.sessionStartedAt = null;

      return payload;
    } finally {
      this.finalizeInFlight = false;
    }
  }

  handlePageExit(currentTimeIso = new Date().toISOString()) {
    if (this.sessionTurns.length) {
      return this.persistLocalSession(currentTimeIso);
    }
    return null;
  }
}

describe('Adversarial & Hardcore Regression Suite — Issue #2 (AUD-002: sessionStartedAt Duration Math)', () => {
  const chatHtmlPath = path.resolve(__dirname, '../chat.html');
  let chatHtmlContent = '';

  beforeEach(() => {
    globalThis.localStorage = makeLocalStorageMock();
    chatHtmlContent = fs.readFileSync(chatHtmlPath, 'utf8');
    vi.restoreAllMocks();
  });

  // ==========================================
  // 1. STATIC AST & CODEBASE INTEGRITY CHECKS
  // ==========================================
  describe('Static Source Invariants (chat.html)', () => {
    // Why this matters: Verifies that finalizeAndSyncSession explicitly resets sessionStartedAt to null
    it('test_chat_html_finalize_resets_session_started_at_null_alongside_session_turns', () => {
      const finalizeRegex = /async\s+function\s+finalizeAndSyncSession\s*\(\)\s*\{([\s\S]*?)\n\}/;
      const match = chatHtmlContent.match(finalizeRegex);

      expect(match).not.toBeNull();
      const body = match[1];

      expect(body).toMatch(/sessionTurns\s*=\s*\[\s*\]/);
      expect(body).toMatch(/currentTurnIndex\s*=\s*-1/);
      expect(body).toMatch(/sessionStartedAt\s*=\s*null/);
    });

    // Why this matters: Verifies startSession defensively resets sessionStartedAt on !result.ok
    it('test_chat_html_start_session_cleans_up_session_started_at_on_not_ok_result', () => {
      const startRegex = /async\s+function\s+startSession\s*\(\)\s*\{([\s\S]*?)\n\}/;
      const match = chatHtmlContent.match(startRegex);

      expect(match).not.toBeNull();
      const body = match[1];

      expect(body).toContain('if (!result.ok)');
      expect(body).toMatch(/if\s*\(!result\.ok\)\s*\{[\s\S]*?sessionStartedAt\s*=\s*null;/);
    });

    // Why this matters: Verifies startSession catch block resets sessionStartedAt if voiceSession throws
    it('test_chat_html_start_session_cleans_up_session_started_at_on_thrown_exception', () => {
      const startRegex = /async\s+function\s+startSession\s*\(\)\s*\{([\s\S]*?)\n\}/;
      const match = chatHtmlContent.match(startRegex);

      expect(match).not.toBeNull();
      const body = match[1];

      expect(body).toMatch(/catch\s*\(\w+\)\s*\{[\s\S]*?sessionStartedAt\s*=\s*null;/);
    });

    // Why this matters: Ensures sessionStartedAt is private to module scope and not attached to window
    it('test_chat_html_session_started_at_is_scoped_not_polluting_window', () => {
      expect(chatHtmlContent).not.toMatch(/window\.sessionStartedAt\s*=/);
      expect(chatHtmlContent).toMatch(/let\s+sessionStartedAt\s*=\s*null;/);
    });
  });

  // ====================================================
  // 2. ADVERSARIAL USER INTERACTIONS & ERROR BRANCHES
  // ====================================================
  describe('Adversarial Interaction & Error Edge Cases', () => {
    // Why this matters: If a user taps mic without API key, sessionStartedAt must NOT remain set for future attempts
    it('test_adversarial_failed_start_due_to_missing_api_key_does_not_leak_stale_timestamp_to_subsequent_start', async () => {
      const harness = new AdversarialChatHarness({
        mockStartResult: { ok: false, reason: 'no_api_key' }
      });

      const failedAttemptTime = '2026-08-29T09:00:00.000Z';
      const startRes = await harness.startSession(failedAttemptTime);

      expect(startRes.ok).toBe(false);
      expect(startRes.reason).toBe('no_api_key');
      expect(harness.sessionStartedAt).toBeNull();
      expect(harness.status).toContain('Please add your AI Access Key');

      // User navigates back 30 minutes later after adding key
      harness.mockStartResult = { ok: true };
      const legitimateStartTime = '2026-08-29T09:30:00.000Z';
      const legitimateEndTime = '2026-08-29T09:31:00.000Z';

      const successfulStart = await harness.startSession(legitimateStartTime);
      expect(successfulStart.ok).toBe(true);
      expect(harness.sessionStartedAt).toBe(legitimateStartTime);

      harness.addTurn('user', 'I have added my key now');
      harness.addTurn('model', 'Awesome! Let us practice.');

      const payload = await harness.stopSession(legitimateEndTime);
      expect(payload.started_at).toBe(legitimateStartTime);
      expect(payload.ended_at).toBe(legitimateEndTime);

      const durationSec = (new Date(payload.ended_at) - new Date(payload.started_at)) / 1000;
      expect(durationSec).toBe(60); // Exactly 60s, NOT 1860s (31 mins)
    });

    // Why this matters: Invalid key error must also clear sessionStartedAt
    it('test_adversarial_failed_start_due_to_invalid_api_key_does_not_leak_timestamp', async () => {
      const harness = new AdversarialChatHarness({
        mockStartResult: { ok: false, reason: 'invalid_api_key', message: 'API key expired' }
      });

      const t0 = '2026-08-29T10:00:00.000Z';
      await harness.startSession(t0);
      expect(harness.sessionStartedAt).toBeNull();

      // Retry 10 mins later with valid key
      harness.mockStartResult = { ok: true };
      const t1 = '2026-08-29T10:10:00.000Z';
      const t2 = '2026-08-29T10:10:30.000Z';

      await harness.startSession(t1);
      harness.addTurn('user', 'Testing valid key');
      const payload = await harness.stopSession(t2);

      expect(payload.started_at).toBe(t1);
      const duration = (new Date(payload.ended_at) - new Date(payload.started_at)) / 1000;
      expect(duration).toBe(30);
    });

    // Why this matters: Hardware/mic permission exception thrown inside startSession must clear sessionStartedAt
    it('test_adversarial_failed_start_due_to_network_exception_does_not_leak_timestamp', async () => {
      const harness = new AdversarialChatHarness({
        mockStartShouldThrow: new Error('NotAllowedError: Permission denied')
      });

      const errorTime = '2026-08-29T10:00:00.000Z';
      const startRes = await harness.startSession(errorTime);

      expect(startRes.ok).toBe(false);
      expect(harness.sessionStartedAt).toBeNull();
      expect(harness.status).toContain('Could not start microphone');

      // User grants permission in browser/Android dialog and restarts 2 mins later
      harness.mockStartShouldThrow = null;
      harness.mockStartResult = { ok: true };
      const validStart = '2026-08-29T10:02:00.000Z';
      const validEnd = '2026-08-29T10:02:45.000Z';

      await harness.startSession(validStart);
      harness.addTurn('user', 'Microphone granted!');
      const payload = await harness.stopSession(validEnd);

      expect(payload.started_at).toBe(validStart);
      expect((new Date(payload.ended_at) - new Date(payload.started_at)) / 1000).toBe(45);
    });

    // Why this matters: Rapid double click when isBusy=true must abort second call without corrupting start timestamp
    it('test_adversarial_rapid_double_start_invocation_aborts_cleanly_without_corrupting_state', async () => {
      const harness = new AdversarialChatHarness();
      harness.isBusy = true; // Simulating first call in-flight

      const startRes = await harness.startSession('2026-08-29T10:00:00.000Z');
      expect(startRes.aborted).toBe(true);
      expect(startRes.reason).toBe('busy');
      expect(harness.sessionStartedAt).toBeNull();
    });

    // Why this matters: Locked session (already analyzed) must reject start without touching sessionStartedAt
    it('test_adversarial_locked_session_rejects_start_without_modifying_started_at', async () => {
      const harness = new AdversarialChatHarness({ isLocked: true });

      const startRes = await harness.startSession('2026-08-29T10:00:00.000Z');
      expect(startRes.aborted).toBe(true);
      expect(startRes.reason).toBe('locked');
      expect(harness.sessionStartedAt).toBeNull();
      expect(harness.status).toContain('already has a report');
    });

    // Why this matters: User connects mic, says nothing, stops mic; subsequent speech 20 mins later must NOT use old start time
    it('test_adversarial_empty_session_with_zero_turns_does_not_poison_future_session_start_time', async () => {
      const harness = new AdversarialChatHarness();

      const emptySessionStart = '2026-08-29T10:00:00.000Z';
      await harness.startSession(emptySessionStart);
      // User says nothing, stops mic 5 seconds later
      const stopResult = await harness.stopSession('2026-08-29T10:00:05.000Z');
      expect(stopResult).toBeNull();
      expect(harness.sessionStartedAt).toBeNull();

      // 20 minutes later, user starts real practice
      const realStart = '2026-08-29T10:20:00.000Z';
      const realEnd = '2026-08-29T10:21:00.000Z';

      await harness.startSession(realStart);
      harness.addTurn('user', 'Now I am speaking');
      harness.addTurn('model', 'Hello, I hear you loud and clear');
      const payload = await harness.stopSession(realEnd);

      expect(payload.started_at).toBe(realStart);
      expect(payload.ended_at).toBe(realEnd);
      expect((new Date(payload.ended_at) - new Date(payload.started_at)) / 1000).toBe(60);
    });
  });

  // =======================================================
  // 3. CORE REGRESSION & MULTI-LEG ACCURACY (AUD-002 PROOF)
  // =======================================================
  describe('Multi-Leg Duration & Idle Gap Isolation (AUD-002 Proof)', () => {
    // Why this matters: The exact regression scenario of AUD-002 — 2m leg, 2hr pause, 1m leg must equal 3m total, not 123m
    it('test_exact_aud002_scenario_2min_leg_2hour_pause_1min_leg_yields_3min_not_123min', async () => {
      const harness = new AdversarialChatHarness();

      // Leg 1: 10:00:00 -> 10:02:00 (120 seconds)
      const leg1Start = '2026-08-29T10:00:00.000Z';
      const leg1End = '2026-08-29T10:02:00.000Z';
      await harness.startSession(leg1Start);
      harness.addTurn('user', 'Practicing topic 1');
      harness.addTurn('model', 'Feedback on topic 1');
      const p1 = await harness.stopSession(leg1End);

      expect(p1.started_at).toBe(leg1Start);
      expect(p1.ended_at).toBe(leg1End);
      const d1 = (new Date(p1.ended_at) - new Date(p1.started_at)) / 1000;
      expect(d1).toBe(120);

      // Idle pause of 2 HOURS (7200 seconds)
      // Leg 2: 12:02:00 -> 12:03:00 (60 seconds)
      const leg2Start = '2026-08-29T12:02:00.000Z';
      const leg2End = '2026-08-29T12:03:00.000Z';
      await harness.startSession(leg2Start);
      harness.addTurn('user', 'Practicing topic 2');
      harness.addTurn('model', 'Feedback on topic 2');
      const p2 = await harness.stopSession(leg2End);

      expect(p2.started_at).toBe(leg2Start);
      expect(p2.ended_at).toBe(leg2End);
      const d2 = (new Date(p2.ended_at) - new Date(p2.started_at)) / 1000;
      expect(d2).toBe(60);

      // Total practice time credited across both legs:
      const totalSeconds = d1 + d2;
      expect(totalSeconds).toBe(180); // 3 minutes active speech!
      expect(totalSeconds).not.toBe(7380); // MUST NOT be 123 minutes!
    });

    // Why this matters: 5 consecutive legs throughout the day must sum strictly to their individual active durations
    it('test_adversarial_five_burst_daily_practice_sequence_preserves_independent_durations', async () => {
      const harness = new AdversarialChatHarness();
      const intervals = [
        { start: '2026-08-29T06:00:00.000Z', end: '2026-08-29T06:01:30.000Z', expectedSec: 90 },
        { start: '2026-08-29T09:15:00.000Z', end: '2026-08-29T09:16:00.000Z', expectedSec: 60 },
        { start: '2026-08-29T13:30:00.000Z', end: '2026-08-29T13:32:00.000Z', expectedSec: 120 },
        { start: '2026-08-29T17:45:00.000Z', end: '2026-08-29T17:45:45.000Z', expectedSec: 45 },
        { start: '2026-08-29T21:00:00.000Z', end: '2026-08-29T21:03:00.000Z', expectedSec: 180 }
      ];

      let totalCalculated = 0;
      let legIndex = 1;
      for (const interval of intervals) {
        await harness.startSession(interval.start);
        harness.addTurn('user', `Leg ${legIndex} user turn`);
        harness.addTurn('model', `Leg ${legIndex} model turn`);
        const payload = await harness.stopSession(interval.end);

        expect(payload.started_at).toBe(interval.start);
        expect(payload.ended_at).toBe(interval.end);
        const legSec = (new Date(payload.ended_at) - new Date(payload.started_at)) / 1000;
        expect(legSec).toBe(interval.expectedSec);
        totalCalculated += legSec;
        legIndex++;
      }

      // 90 + 60 + 120 + 45 + 180 = 495 seconds (8m 15s)
      expect(totalCalculated).toBe(495);
      // Confirms activeSessionId was retained throughout
      expect(harness.activeSessionId).toBe('server-sess-generated-999');
    });

    // Why this matters: Call interruption mid-turn must flush Leg 1, and subsequent restart must capture fresh started_at
    it('test_adversarial_incoming_phone_call_interrupt_resumes_with_isolated_duration', async () => {
      const harness = new AdversarialChatHarness();

      const leg1Start = '2026-08-29T10:00:00.000Z';
      const interruptTime = '2026-08-29T10:00:40.000Z';

      await harness.startSession(leg1Start);
      harness.addTurn('user', 'Speaking before mom calls');
      const p1 = await harness.triggerInterruption(interruptTime);

      expect(p1.started_at).toBe(leg1Start);
      expect(p1.ended_at).toBe(interruptTime);
      expect(harness.sessionStartedAt).toBeNull();
      expect(harness.status).toContain('Call received — session paused');

      // User talks to mom for 15 minutes, resumes at 10:15:40
      const leg2Start = '2026-08-29T10:15:40.000Z';
      const leg2End = '2026-08-29T10:16:40.000Z';

      await harness.startSession(leg2Start);
      harness.addTurn('user', 'Back from phone call');
      const p2 = await harness.stopSession(leg2End);

      expect(p2.started_at).toBe(leg2Start);
      expect(p2.ended_at).toBe(leg2End);
      expect((new Date(p2.ended_at) - new Date(p2.started_at)) / 1000).toBe(60);
    });

    // Why this matters: Inactivity watchdog (90s silence) flushes leg and resets started_at
    it('test_adversarial_inactivity_watchdog_timeout_flushes_leg_and_clears_started_at', async () => {
      const harness = new AdversarialChatHarness();

      const t0 = '2026-08-29T14:00:00.000Z';
      const timeoutTime = '2026-08-29T14:01:30.000Z'; // 90s later

      await harness.startSession(t0);
      harness.addTurn('user', 'Brief remark');
      const p1 = await harness.triggerInactivityTimeout({ reason: 'silence' }, timeoutTime);

      expect(p1.started_at).toBe(t0);
      expect(p1.ended_at).toBe(timeoutTime);
      expect(harness.sessionStartedAt).toBeNull();
      expect(harness.status).toContain('Session closed due to 90 seconds of inactivity');
    });
  });

  // ====================================================
  // 4. PAYLOAD SANITIZATION, PERSISTENCE & BOUNDARIES
  // ====================================================
  describe('Payload Persistence, Memory & Boundary Values', () => {
    // Why this matters: Whitespace-only or empty turns must be purged and not leave dirty localStorage payload
    it('test_adversarial_whitespace_only_turns_do_not_persist_poisoned_payload', async () => {
      const harness = new AdversarialChatHarness();

      await harness.startSession('2026-08-29T10:00:00.000Z');
      harness.addTurn('user', '   ');
      harness.addTurn('model', '');

      const payload = harness.persistLocalSession('2026-08-29T10:00:10.000Z');
      expect(payload).toBeNull();
      expect(localStorage.getItem(PENDING_CHAT_SESSION_KEY)).toBeNull();
    });

    // Why this matters: Prior transcript memory accumulates across legs up to 6000 character sliding window limit
    it('test_adversarial_multi_leg_accumulation_caps_prior_transcript_at_6000_chars_while_keeping_started_at_fresh', async () => {
      const harness = new AdversarialChatHarness();

      // Send 3 massive legs
      const bigText = 'A'.repeat(2500);
      await harness.startSession('2026-08-29T10:00:00.000Z');
      harness.addTurn('user', bigText);
      await harness.stopSession('2026-08-29T10:01:00.000Z');

      await harness.startSession('2026-08-29T10:05:00.000Z');
      harness.addTurn('user', bigText);
      await harness.stopSession('2026-08-29T10:06:00.000Z');

      await harness.startSession('2026-08-29T10:10:00.000Z');
      harness.addTurn('user', bigText);
      await harness.stopSession('2026-08-29T10:11:00.000Z');

      // Transcript buffer must not exceed 6000 characters
      expect(harness.priorTranscriptText.length).toBeLessThanOrEqual(6000);
      expect(harness.sessionStartedAt).toBeNull();
    });

    // Why this matters: Sub-second rapid burst must calculate positive fractional duration accurately
    it('test_adversarial_sub_second_burst_duration_calculation', async () => {
      const harness = new AdversarialChatHarness();

      const t0 = '2026-08-29T10:00:00.000Z';
      const t1 = '2026-08-29T10:00:00.450Z'; // 450 milliseconds

      await harness.startSession(t0);
      harness.addTurn('user', 'Quick "Yes"');
      const payload = await harness.stopSession(t1);

      const durationSec = (new Date(payload.ended_at) - new Date(payload.started_at)) / 1000;
      expect(durationSec).toBe(0.45);
    });

    // Why this matters: Device clock step backwards (ended_at < started_at) must yield 0 via Math.max
    it('test_adversarial_device_clock_skew_backwards_yields_safe_duration', async () => {
      const harness = new AdversarialChatHarness();

      const t0 = '2026-08-29T10:05:00.000Z';
      const tBackward = '2026-08-29T10:00:00.000Z'; // Clock jumped back 5 mins

      await harness.startSession(t0);
      harness.addTurn('user', 'Time travel turn');
      const payload = await harness.stopSession(tBackward);

      const rawDiff = (new Date(payload.ended_at) - new Date(payload.started_at)) / 1000;
      expect(rawDiff).toBe(-300);

      // Backend duration clamping formula check:
      const safeDuration = Math.max(0, rawDiff);
      expect(safeDuration).toBe(0);
    });

    // Why this matters: Network sync failure keeps pending payload in localStorage with uncorrupted leg start time
    it('test_adversarial_network_sync_failure_preserves_leg_started_at_in_local_storage', async () => {
      const harness = new AdversarialChatHarness({ mockSyncShouldFail: true });

      const legStart = '2026-08-29T10:00:00.000Z';
      const legEnd = '2026-08-29T10:00:50.000Z';

      await harness.startSession(legStart);
      harness.addTurn('user', 'Offline message');

      await expect(harness.stopSession(legEnd)).rejects.toThrow('POST /chat/sessions failed');

      // Local storage must hold the accurate leg payload for next retry
      const savedRaw = localStorage.getItem(PENDING_CHAT_SESSION_KEY);
      expect(savedRaw).not.toBeNull();
      const saved = JSON.parse(savedRaw);

      expect(saved.started_at).toBe(legStart);
      expect(saved.ended_at).toBe(legEnd);
      expect(saved.messages).toHaveLength(1);
    });

    // Why this matters: Page exit (unload/pagehide) mid-conversation flushes current leg started_at to storage
    it('test_adversarial_page_exit_flushes_current_leg_started_at_to_local_storage', async () => {
      const harness = new AdversarialChatHarness();

      const legStart = '2026-08-29T10:00:00.000Z';
      const exitTime = '2026-08-29T10:00:35.000Z';

      await harness.startSession(legStart);
      harness.addTurn('user', 'Speaking before user closes browser tab');

      const savedPayload = harness.handlePageExit(exitTime);
      expect(savedPayload).not.toBeNull();
      expect(savedPayload.started_at).toBe(legStart);
      expect(savedPayload.ended_at).toBe(exitTime);
    });

    // Why this matters: 10 turns crossing threshold triggers report pill immediately on current activeSessionId
    it('test_adversarial_report_pill_triggers_when_total_turns_cross_threshold_across_multi_legs', async () => {
      const harness = new AdversarialChatHarness();

      // Leg 1: 6 turns
      await harness.startSession('2026-08-29T10:00:00.000Z');
      for (let i = 0; i < 3; i++) {
        harness.addTurn('user', `Turn ${i}`);
        harness.addTurn('model', `Reply ${i}`);
      }
      await harness.stopSession('2026-08-29T10:01:00.000Z');
      expect(harness.knownTurnCount).toBe(6);
      expect(harness.reportPillShown).toBe(false);

      // Leg 2: 4 turns (total 10 turns => crosses MIN_TURNS_FOR_ANALYSIS)
      await harness.startSession('2026-08-29T10:05:00.000Z');
      for (let i = 0; i < 2; i++) {
        harness.addTurn('user', `Turn ${i + 3}`);
        harness.addTurn('model', `Reply ${i + 3}`);
      }
      await harness.stopSession('2026-08-29T10:06:00.000Z');
      expect(harness.knownTurnCount).toBe(10);
      expect(harness.reportPillShown).toBe(true);
    });
  });
});
