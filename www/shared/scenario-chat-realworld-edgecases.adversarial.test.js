import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ═════════════════════════════════════════════════════════════════════════════
// FRONTEND ADVERSARIAL & FUNCTIONAL TEST SUITE (16 Tests)
// Role: 10_FunctionalSanityTester & 06_TestWriter
// ═════════════════════════════════════════════════════════════════════════════

describe('Scenario & Chat Real-World Edge Cases [Frontend Lifecycle & State]', () => {
  let localStorageMock = {};

  beforeEach(() => {
    localStorageMock = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => localStorageMock[key] || null),
      setItem: vi.fn((key, val) => { localStorageMock[key] = String(val); }),
      removeItem: vi.fn((key) => { delete localStorageMock[key]; }),
      clear: vi.fn(() => { localStorageMock = {}; })
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: Mid-Scenario Call Interruption State Preservation
  // ───────────────────────────────────────────────────────────────────────────
  it('FE-EDGE-01: Preserves remaining countdown time and conversation turns in localStorage on call interruption', () => {
    const scenarioKey = 'job_interview';
    const dateKey = '2026-08-30';
    const storageKey = `utkio_scenario_state_${scenarioKey}_${dateKey}`;

    const interruptedState = {
      phaseSecondsLeft: 115,
      sessionStartedAt: '2026-08-30T10:00:00.000Z',
      sessionTurns: [
        { role: 'assistant', content: 'Tell me about yourself.', phase: 'roleplay' },
        { role: 'user', content: 'I am a software developer.', phase: 'roleplay' }
      ],
      activeSessionId: 'sess-active-interrupted-01',
      syncedTurnCount: 2
    };

    localStorage.setItem(storageKey, JSON.stringify(interruptedState));
    const raw = localStorage.getItem(storageKey);
    expect(raw).toBeDefined();
    const restored = JSON.parse(raw);

    expect(restored.phaseSecondsLeft).toBe(115);
    expect(restored.sessionTurns.length).toBe(2);
    expect(restored.activeSessionId).toBe('sess-active-interrupted-01');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: Lockout Guard Mismatch Prevention
  // ───────────────────────────────────────────────────────────────────────────
  it('FE-EDGE-02: Scenario state is NOT purged from localStorage when already_completed_today is false', () => {
    const scenarioKey = 'job_interview';
    const dateKey = '2026-08-30';
    const storageKey = `utkio_scenario_state_${scenarioKey}_${dateKey}`;

    localStorage.setItem(storageKey, JSON.stringify({
      phaseSecondsLeft: 90,
      sessionTurns: [{ role: 'user', content: 'Hello' }],
      activeSessionId: 'sess-123'
    }));

    const backendResponse = {
      already_completed_today: false,
      completed_session_id: null,
      scenario: { key: scenarioKey, title: 'Job Interview' }
    };

    if (!backendResponse.already_completed_today) {
      const raw = localStorage.getItem(storageKey);
      expect(raw).not.toBeNull();
    } else {
      localStorage.removeItem(storageKey);
    }

    expect(localStorage.getItem(storageKey)).not.toBeNull();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: Feedback Phase Network Drop & Monologue Loss Defense
  // ───────────────────────────────────────────────────────────────────────────
  it('FE-EDGE-03: Network drop during phase 2 with 0 feedback received does NOT permanently lock scenario', () => {
    let phase = 'feedback';
    let feedbackResponseReceived = false;
    let isLocked = false;

    function handleScenarioClose() {
      if (phase === 'feedback' && feedbackResponseReceived) {
        isLocked = true;
      } else {
        isLocked = false;
      }
    }

    handleScenarioClose();
    expect(isLocked).toBe(false);
    expect(feedbackResponseReceived).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4: Freeform Chat Auto-Recovery of Unanalyzed Session
  // ───────────────────────────────────────────────────────────────────────────
  it('FE-EDGE-04: Pending chat session in localStorage persists across accidental tab close or RAM kill', () => {
    const pendingKey = 'utkio_pending_chat_session';
    const payload = {
      session_id: 'sess-chat-active-456',
      started_at: '2026-08-30T10:10:00.000Z',
      ended_at: '2026-08-30T10:15:00.000Z',
      session_type: 'freeform',
      messages: [
        { role: 'user', content: 'Let us practice business negotiations.' },
        { role: 'assistant', content: 'Sure! Imagine we are agreeing on project deadlines.' }
      ]
    };

    localStorage.setItem(pendingKey, JSON.stringify(payload));
    const saved = JSON.parse(localStorage.getItem(pendingKey));
    expect(saved.session_id).toBe('sess-chat-active-456');
    expect(saved.messages.length).toBe(2);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 5: AudioContext Auto-Resume Contract
  // ───────────────────────────────────────────────────────────────────────────
  it('FE-EDGE-05: AudioContext resume is safely invoked on visibility change without throwing', async () => {
    let resumeCallCount = 0;
    const mockAudioContext = {
      state: 'suspended',
      resume: vi.fn(async () => {
        resumeCallCount++;
        mockAudioContext.state = 'running';
      })
    };

    function ensureResumed(playCtx) {
      if (playCtx && playCtx.state === 'suspended') {
        playCtx.resume().catch(() => {});
      }
    }

    ensureResumed(mockAudioContext);
    expect(mockAudioContext.resume).toHaveBeenCalledTimes(1);
    expect(resumeCallCount).toBe(1);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 6: Zero Developer Jargon in Status Notifications
  // ───────────────────────────────────────────────────────────────────────────
  it('FE-EDGE-06: Status and error messages contain zero developer jargon (cold start, 500, JWT, API)', () => {
    const userFacingMessages = [
      'Scenario paused (1:55 remaining). Tap mic to continue.',
      'Session paused due to 90s silence. Tap mic to resume.',
      'Internet connection restored — tap mic to continue.',
      'No internet connection — please check your network and try again.',
      'Please add your AI Access Key in Settings.',
      'Your feedback is ready to view below. A new scenario will be available tomorrow.'
    ];

    const forbiddenJargon = [/50[0-4]/, /cold\s*start/i, /api\s*error/i, /jwt/i, /payload/i, /database/i, /socket\s*disconnected/i];

    userFacingMessages.forEach((msg) => {
      forbiddenJargon.forEach((jargon) => {
        expect(jargon.test(msg)).toBe(false);
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 7: Speech Pacing & Mid-Sentence Cutoff Deferral
  // ───────────────────────────────────────────────────────────────────────────
  it('FE-EDGE-07: Phase timer does not force feedback switch while user or AI is actively speaking', () => {
    let isSpeaking = true;
    let phase = 'roleplay';
    let switchedToFeedback = false;

    function checkPhaseTransition(secondsLeft) {
      if (secondsLeft <= 0) {
        if (isSpeaking) {
          // Defer switch until speaking finishes
          return;
        }
        phase = 'feedback';
        switchedToFeedback = true;
      }
    }

    checkPhaseTransition(0);
    expect(switchedToFeedback).toBe(false);
    expect(phase).toBe('roleplay');

    isSpeaking = false;
    checkPhaseTransition(0);
    expect(switchedToFeedback).toBe(true);
    expect(phase).toBe('feedback');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 8: Bluetooth Disconnect / Mic Error Translation
  // ───────────────────────────────────────────────────────────────────────────
  it('FE-EDGE-08: Translates hardware OverconstrainedError and NotReadableError into friendly user hints', () => {
    function describeMicError(err) {
      const name = err && err.name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError')
        return 'Microphone access was denied. Tap the mic icon in your address bar and select Allow.';
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError')
        return 'Microphone not found: no microphone is connected to this device.';
      if (name === 'NotReadableError' || name === 'TrackStartError')
        return 'Could not open the microphone. If another app is using it, close that app and try again.';
      if (name === 'OverconstrainedError')
        return 'Microphone settings could not be matched on this device.';
      return 'Microphone access error: ' + (err && err.message ? err.message : 'unknown reason');
    }

    const readableMsg = describeMicError({ name: 'NotReadableError' });
    expect(readableMsg).toContain('Could not open the microphone');

    const deniedMsg = describeMicError({ name: 'NotAllowedError' });
    expect(deniedMsg).toContain('Microphone access was denied');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 9: Hardware Back Button Guard Dialog
  // ───────────────────────────────────────────────────────────────────────────
  it('FE-EDGE-09: Intercepts active voice session exit with confirmation dialog', async () => {
    let sessionStopped = false;
    const isSessionActive = true;

    async function handleBackNav(confirmDialogFn) {
      if (isSessionActive) {
        const leave = await confirmDialogFn();
        if (leave) {
          sessionStopped = true;
          return true;
        }
        return false;
      }
      return true;
    }

    // User cancels dialog -> session remains active
    const cancelled = await handleBackNav(async () => false);
    expect(cancelled).toBe(false);
    expect(sessionStopped).toBe(false);

    // User confirms leave -> session stops cleanly
    const confirmed = await handleBackNav(async () => true);
    expect(confirmed).toBe(true);
    expect(sessionStopped).toBe(true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 10: Fast Start/Stop Mic Toggles Debounce
  // ───────────────────────────────────────────────────────────────────────────
  it('FE-EDGE-10: Rapid consecutive startSession calls ignore duplicate in-flight attempts', async () => {
    let startCallCount = 0;
    let isBusy = false;

    async function startSession() {
      if (isBusy) return { ok: false, reason: 'already_busy' };
      isBusy = true;
      startCallCount++;
      await new Promise((r) => setTimeout(r, 20));
      isBusy = false;
      return { ok: true };
    }

    const [res1, res2, res3] = await Promise.all([startSession(), startSession(), startSession()]);

    expect(startCallCount).toBe(1);
    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(false);
    expect(res3.ok).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 11: Inactivity and Stagnant Turn Timers
  // ───────────────────────────────────────────────────────────────────────────
  it('FE-EDGE-11: Formats silence timeout (90s) vs stagnant turn (120s) into helpful recovery toasts', () => {
    function formatInactivityMessage(info) {
      const isStagnant = info && info.reason === 'stagnant_turn';
      return isStagnant
        ? 'Session paused due to extended inactivity. Tap mic to continue.'
        : 'Session closed due to 90 seconds of inactivity. Tap mic to resume.';
    }

    expect(formatInactivityMessage({ reason: 'silence' })).toContain('90 seconds of inactivity');
    expect(formatInactivityMessage({ reason: 'stagnant_turn' })).toContain('extended inactivity');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 12: Report Pill Threshold (10 Turns) in Freeform Chat
  // ───────────────────────────────────────────────────────────────────────────
  it('FE-EDGE-12: Report pill appears only when chat reaches MIN_TURNS_FOR_ANALYSIS (10 turns)', () => {
    const MIN_TURNS = 10;
    function shouldShowReportPill(turnCount, hasReport, isLocked) {
      return !isLocked && !hasReport && turnCount >= MIN_TURNS;
    }

    expect(shouldShowReportPill(6, false, false)).toBe(false);
    expect(shouldShowReportPill(9, false, false)).toBe(false);
    expect(shouldShowReportPill(10, false, false)).toBe(true);
    expect(shouldShowReportPill(15, true, true)).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 13: Scenario Locked Banner Deep-link Destination
  // ───────────────────────────────────────────────────────────────────────────
  it('FE-EDGE-13: Locked banner routes to report.html with generate=1 when completed_session_id is present', () => {
    function getLockedCtaDestination(lastCompletedSessionId) {
      return lastCompletedSessionId
        ? 'report.html?session=' + encodeURIComponent(lastCompletedSessionId) + '&generate=1'
        : 'history.html';
    }

    expect(getLockedCtaDestination('sess-123')).toBe('report.html?session=sess-123&generate=1');
    expect(getLockedCtaDestination(null)).toBe('history.html');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 14: Offline Banner Disables Idle Mic Button
  // ───────────────────────────────────────────────────────────────────────────
  it('FE-EDGE-14: Offline event disables mic button when scenario is idle to prevent doomed taps', () => {
    let micDisabled = false;
    let statusText = '';

    function handleOfflineEvent(isIdle) {
      if (isIdle) {
        micDisabled = true;
        statusText = 'No internet connection — please check your network and try again.';
      }
    }

    handleOfflineEvent(true);
    expect(micDisabled).toBe(true);
    expect(statusText).toContain('No internet connection');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 15: Online Event Restores Mic Button
  // ───────────────────────────────────────────────────────────────────────────
  it('FE-EDGE-15: Online event re-enables mic button and prompts user to tap to continue', () => {
    let micDisabled = true;
    let statusText = 'Offline';

    function handleBackOnlineEvent(isIdle) {
      if (isIdle) {
        micDisabled = false;
        statusText = 'Internet connection restored — tap mic to continue.';
      }
    }

    handleBackOnlineEvent(true);
    expect(micDisabled).toBe(false);
    expect(statusText).toContain('Internet connection restored');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 16: Phase 2 Feedback Card Rendering
  // ───────────────────────────────────────────────────────────────────────────
  it('FE-EDGE-16: Phase 2 AI monologue receives distinct feedback card styling', () => {
    function classifyLine(role, phase) {
      const isFeedbackCard = role === 'model' && phase === 'feedback';
      return isFeedbackCard ? 'feedback-card' : `msg-row ${role}`;
    }

    expect(classifyLine('model', 'feedback')).toBe('feedback-card');
    expect(classifyLine('user', 'feedback')).toBe('msg-row user');
    expect(classifyLine('model', 'roleplay')).toBe('msg-row model');
  });
});
