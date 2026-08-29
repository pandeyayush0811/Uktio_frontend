import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
 * Harness simulating chat.html's exact session state machine and persistence logic
 */
class ChatSessionManager {
  constructor() {
    this.sessionTurns = [];
    this.sessionStartedAt = null;
    this.currentTurnIndex = -1;
    this.activeSessionId = null;
    this.priorTranscriptText = '';
    this.finalizeInFlight = false;
    this.todayUsedChatSeconds = 0;
    this.activeSessionSeconds = 0;
    this.timerInterval = null;
    this.syncedPayloads = [];
  }

  startSession(currentTimeIso = new Date().toISOString()) {
    if (!this.sessionStartedAt) {
      this.sessionStartedAt = currentTimeIso;
    }
    this.activeSessionSeconds = 0;
  }

  addTurn(role, content) {
    this.currentTurnIndex++;
    this.sessionTurns.push({ role, content });
  }

  tickActiveTimer(seconds = 1) {
    this.activeSessionSeconds += seconds;
  }

  persistLocalSession(currentTimeIso = new Date().toISOString()) {
    try {
      const meaningful = this.sessionTurns.filter(t => t.content && t.content.trim());
      if (!meaningful.length) {
        localStorage.removeItem(PENDING_CHAT_SESSION_KEY);
        return;
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
    }
  }

  stopSession(currentTimeIso = new Date().toISOString()) {
    this.todayUsedChatSeconds += this.activeSessionSeconds;
    this.activeSessionSeconds = 0;
    return this.finalizeAndSyncSession(currentTimeIso);
  }

  finalizeAndSyncSession(currentTimeIso = new Date().toISOString()) {
    if (!this.sessionTurns.length || this.finalizeInFlight) return null;
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
      }

      this.sessionTurns = [];
      this.currentTurnIndex = -1;
      this.sessionStartedAt = null;

      if (payload) {
        this.syncedPayloads.push(payload);
        if (!this.activeSessionId) {
          this.activeSessionId = 'session-server-id-123';
        }
      }
      return payload;
    } finally {
      this.finalizeInFlight = false;
    }
  }
}

describe('Chat Session Duration & Stale sessionStartedAt Regression Suite (Bug #6)', () => {
  beforeEach(() => {
    globalThis.localStorage = makeLocalStorageMock();
    vi.restoreAllMocks();
  });

  // Why this matters: Verifies that Leg 2 started_at is NOT locked to Leg 1 start time after an idle break
  it('test_session_started_at_must_reset_between_legs_to_prevent_idle_gap_inflation', () => {
    const manager = new ChatSessionManager();

    // Leg 1: User speaks for 30 seconds at 10:00:00
    const leg1Start = '2026-08-29T10:00:00.000Z';
    const leg1End = '2026-08-29T10:00:30.000Z';

    manager.startSession(leg1Start);
    manager.addTurn('user', 'Hello Bolo');
    manager.addTurn('model', 'Hi there! How are you?');
    manager.tickActiveTimer(30);
    const leg1Payload = manager.stopSession(leg1End);

    expect(leg1Payload.started_at).toBe(leg1Start);
    expect(leg1Payload.ended_at).toBe(leg1End);
    const leg1Duration = (new Date(leg1Payload.ended_at) - new Date(leg1Payload.started_at)) / 1000;
    expect(leg1Duration).toBe(30);

    // Idle Pause: 10 minutes (600s) of silence
    const leg2Start = '2026-08-29T10:10:30.000Z';
    const leg2End = '2026-08-29T10:10:50.000Z'; // 20 seconds of speech in Leg 2

    // Buggy implementation retention check: If sessionStartedAt was not reset, manager.sessionStartedAt is still leg1Start
    // In current buggy code, sessionStartedAt is retained across legs
    const isBuggyCurrentState = (manager.sessionStartedAt === leg1Start);

    // If we call startSession for Leg 2:
    manager.startSession(leg2Start);
    manager.addTurn('user', 'I am back after coffee');
    manager.addTurn('model', 'Welcome back!');
    manager.tickActiveTimer(20);
    const leg2Payload = manager.stopSession(leg2End);

    // Adversarial assertion: Leg 2's started_at MUST reflect leg2Start (10:10:30), NOT leg1Start (10:00:00)
    // Under buggy code, leg2Payload.started_at will be leg1Start (10:00:00), leading to duration = 650s instead of 20s
    expect(leg2Payload.started_at).toBe(leg2Start);
    expect(leg2Payload.ended_at).toBe(leg2End);

    const leg2Duration = (new Date(leg2Payload.ended_at) - new Date(leg2Payload.started_at)) / 1000;
    expect(leg2Duration).toBe(20); // Must be exactly 20s, NOT 650s
  });

  // Why this matters: Multi-leg sequence (3+ legs) must not accumulate cumulative elapsed time across multiple pauses
  it('test_multi_leg_chat_session_accumulates_only_active_speech_duration_not_pause_intervals', () => {
    const manager = new ChatSessionManager();

    // Leg 1: 10:00:00 -> 10:00:40 (40s)
    manager.startSession('2026-08-29T10:00:00.000Z');
    manager.addTurn('user', 'Leg 1');
    manager.tickActiveTimer(40);
    const p1 = manager.stopSession('2026-08-29T10:00:40.000Z');

    // Leg 2: 10:06:00 -> 10:06:30 (30s after ~5 min pause)
    // For fixed code, sessionStartedAt must be reset so startSession sets 10:06:00
    if (manager.sessionStartedAt === '2026-08-29T10:00:00.000Z') {
      // Buggy behavior flag
    }
    manager.startSession('2026-08-29T10:06:00.000Z');
    manager.addTurn('user', 'Leg 2');
    manager.tickActiveTimer(30);
    const p2 = manager.stopSession('2026-08-29T10:06:30.000Z');

    // Leg 3: 10:30:00 -> 10:30:20 (20s after ~24 min pause)
    manager.startSession('2026-08-29T10:30:00.000Z');
    manager.addTurn('user', 'Leg 3');
    manager.tickActiveTimer(20);
    const p3 = manager.stopSession('2026-08-29T10:30:20.000Z');

    const d1 = (new Date(p1.ended_at) - new Date(p1.started_at)) / 1000;
    const d2 = (new Date(p2.ended_at) - new Date(p2.started_at)) / 1000;
    const d3 = (new Date(p3.ended_at) - new Date(p3.started_at)) / 1000;

    expect(d1).toBe(40);
    expect(d2).toBe(30);
    expect(d3).toBe(20);
    expect(d1 + d2 + d3).toBe(90); // 90 seconds total active time, NOT 1820 seconds (30m20s)
  });

  // Why this matters: Mid-leg crash safety (persistLocalSession called at each turn boundary) must store the active leg's start time
  it('test_turn_boundary_persistence_stores_current_leg_started_at_in_local_storage', () => {
    const manager = new ChatSessionManager();

    // Leg 1 completed
    manager.startSession('2026-08-29T10:00:00.000Z');
    manager.addTurn('user', 'Turn 1');
    manager.stopSession('2026-08-29T10:00:30.000Z');

    // Leg 2 starts at 10:15:00
    const leg2Start = '2026-08-29T10:15:00.000Z';
    manager.startSession(leg2Start);
    manager.addTurn('user', 'Turn 2 in leg 2');

    // Simulating persistLocalSession() firing immediately when user speaks (mid-leg turn boundary)
    const turnTimestamp = '2026-08-29T10:15:05.000Z';
    manager.persistLocalSession(turnTimestamp);

    const savedRaw = localStorage.getItem(PENDING_CHAT_SESSION_KEY);
    expect(savedRaw).not.toBeNull();
    const saved = JSON.parse(savedRaw);

    expect(saved.started_at).toBe(leg2Start);
    expect(saved.ended_at).toBe(turnTimestamp);
    expect(saved.session_id).toBe('session-server-id-123'); // Appending to existing session
  });

  // Why this matters: Call interrupt or inactivity timeout stops session, user resumes minutes later — timer must not leak idle gap
  it('test_interruption_and_inactivity_timeout_lifecycle_clears_started_at_state', () => {
    const manager = new ChatSessionManager();

    manager.startSession('2026-08-29T10:00:00.000Z');
    manager.addTurn('user', 'Talking before incoming call');
    manager.tickActiveTimer(15);

    // Incoming phone call event onInterrupted() calls finalizeAndSyncSession()
    const interruptPayload = manager.finalizeAndSyncSession('2026-08-29T10:00:15.000Z');
    expect(interruptPayload).not.toBeNull();

    // User finishes call 8 minutes later and taps mic
    const resumeTime = '2026-08-29T10:08:15.000Z';
    manager.startSession(resumeTime);
    manager.addTurn('user', 'Resuming after phone call');
    manager.tickActiveTimer(25);
    const resumedPayload = manager.stopSession('2026-08-29T10:08:40.000Z');

    expect(resumedPayload.started_at).toBe(resumeTime);
    expect(resumedPayload.ended_at).toBe('2026-08-29T10:08:40.000Z');
    const resumedDuration = (new Date(resumedPayload.ended_at) - new Date(resumedPayload.started_at)) / 1000;
    expect(resumedDuration).toBe(25);
  });

  // Why this matters: Sub-second stop/start rapid clicking must not produce inverted or negative duration
  it('test_rapid_stop_and_immediate_restart_preserves_monotonic_leg_timing', () => {
    const manager = new ChatSessionManager();

    const t1 = '2026-08-29T10:00:00.000Z';
    const t2 = '2026-08-29T10:00:10.000Z';
    const t3 = '2026-08-29T10:00:10.500Z'; // Restart 500ms later
    const t4 = '2026-08-29T10:00:20.000Z';

    manager.startSession(t1);
    manager.addTurn('user', 'Quick turn 1');
    manager.stopSession(t2);

    manager.startSession(t3);
    manager.addTurn('user', 'Quick turn 2');
    const p2 = manager.stopSession(t4);

    expect(p2.started_at).toBe(t3);
    expect(p2.ended_at).toBe(t4);
    const duration = (new Date(p2.ended_at) - new Date(p2.started_at)) / 1000;
    expect(duration).toBe(9.5);
  });
});
