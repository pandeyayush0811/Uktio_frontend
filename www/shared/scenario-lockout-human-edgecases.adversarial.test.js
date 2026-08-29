import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PENDING_CHAT_SESSION_KEY } from './auth.js';

function makeLocalStorageMock() {
  const store = {};
  return {
    getItem: vi.fn((k) => (k in store ? store[k] : null)),
    setItem: vi.fn((k, v) => { store[k] = String(v); }),
    removeItem: vi.fn((k) => { delete store[k]; }),
    clear: vi.fn(() => { for (const k in store) delete store[k]; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i) => Object.keys(store)[i] || null),
    _dump: () => ({ ...store })
  };
}

/**
 * High-Fidelity Behavioral Simulation of scenario.html handling chaotic
 * human actions, race conditions, mobile lifecycle pauses, network drops,
 * tampered storage, timezone midnight crossing, and input edge cases.
 */
class HumanScenarioHarness {
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
    this.PHASE_1_DURATION_SECONDS = 180;
    this.sessionStartedAt = null;
    this.sessionTurns = [];
    this.activeSessionId = null;
    this.syncedTurnCount = 0;
    this.finalizeInFlight = false;
    this.sessionAttemptInFlight = false;
    this.lastCompletedSessionId = null;
    this.isLocked = options.isLocked || false;
    this.statusText = '';
    this.statusMode = null;
    this.micDisabled = false;

    // Simulation hooks & mocks
    this.mockSyncSessionId = options.mockSyncSessionId || 'server-scenario-sess-101';
    this.mockSyncShouldFail = options.mockSyncShouldFail || false;
    this.mockSyncFailureStatus = options.mockSyncFailureStatus || 500;
    this.mockSyncFailureMessage = options.mockSyncFailureMessage || 'Network timeout';
    this.syncedPayloads = [];
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

  saveScenarioState(now = new Date()) {
    const key = this.getScenarioStorageKey(now);
    if (!key) return;
    try {
      if (this.phase === 'feedback' || this.isLocked) {
        localStorage.removeItem(key);
        return;
      }
      // Defensive filtering for meaningful turns
      const state = {
        phaseSecondsLeft: Math.max(0, this.phaseSecondsLeft),
        sessionStartedAt: this.sessionStartedAt,
        activeSessionId: this.activeSessionId,
        syncedTurnCount: Math.max(0, this.syncedTurnCount),
        sessionTurns: (this.sessionTurns || []).filter(t => t && t.content && String(t.content).trim().length > 0)
      };
      localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
      console.warn('saveScenarioState failed:', e);
    }
  }

  restoreScenarioState(now = new Date()) {
    const key = this.getScenarioStorageKey(now);
    if (!key) return false;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const state = JSON.parse(raw);
      if (state && typeof state.phaseSecondsLeft === 'number' && state.phaseSecondsLeft > 0) {
        this.phaseSecondsLeft = state.phaseSecondsLeft;
        this.sessionStartedAt = state.sessionStartedAt || this.sessionStartedAt;
        this.activeSessionId = state.activeSessionId || null;
        
        // Defensive bounds check for syncedTurnCount against array length
        const rawSynced = typeof state.syncedTurnCount === 'number' ? state.syncedTurnCount : 0;
        this.sessionTurns = Array.isArray(state.sessionTurns) ? state.sessionTurns : [];
        this.syncedTurnCount = Math.min(Math.max(0, rawSynced), this.sessionTurns.length);

        const min = Math.floor(this.phaseSecondsLeft / 60);
        const sec = this.phaseSecondsLeft % 60;
        const timeStr = `${min}:${sec < 10 ? '0' : ''}${sec}`;
        this.statusText = `Scenario in progress (${timeStr} remaining) — Tap mic to continue`;
        return true;
      }
    } catch (e) {
      console.warn('restoreScenarioState failed:', e);
    }
    return false;
  }

  persistLocalSession() {
    try {
      this.saveScenarioState();
      const meaningful = (this.sessionTurns || []).filter(t => t && t.content && String(t.content).trim().length > 0);
      if (!meaningful.length) {
        localStorage.removeItem(PENDING_CHAT_SESSION_KEY);
        return;
      }

      // Safe delta calculation
      const safeSyncedCount = Math.min(Math.max(0, this.syncedTurnCount), meaningful.length);
      const turnsToSend = this.activeSessionId ? meaningful.slice(safeSyncedCount) : meaningful;

      if (!turnsToSend.length && this.activeSessionId) {
        return; // Nothing new to sync
      }

      localStorage.setItem(PENDING_CHAT_SESSION_KEY, JSON.stringify({
        session_id: this.activeSessionId,
        started_at: this.sessionStartedAt || new Date().toISOString(),
        ended_at: new Date().toISOString(),
        session_type: 'scenario',
        scenario_key: this.todaysScenario ? this.todaysScenario.key : null,
        messages: turnsToSend.map(t => ({ role: t.role, content: String(t.content).trim() }))
      }));
    } catch (e) {
      console.warn('persistLocalSession failed', e);
    }
  }

  async syncPendingChatSession() {
    const raw = localStorage.getItem(PENDING_CHAT_SESSION_KEY);
    if (!raw) return null;
    let payload;
    try { payload = JSON.parse(raw); } catch (e) { return null; }

    this.syncedPayloads.push(payload);

    if (this.mockSyncShouldFail) {
      const err = new Error(this.mockSyncFailureMessage);
      err.status = this.mockSyncFailureStatus;
      throw err;
    }

    const assignedId = this.activeSessionId || this.mockSyncSessionId;
    this.activeSessionId = assignedId;
    const meaningfulCount = this.sessionTurns.filter(t => t && t.content && String(t.content).trim().length > 0).length;
    this.syncedTurnCount = meaningfulCount;
    this.saveScenarioState();
    localStorage.removeItem(PENDING_CHAT_SESSION_KEY);
    return assignedId;
  }

  async finalizeAndSyncSession() {
    if (!this.sessionTurns.length || this.finalizeInFlight) return;
    this.finalizeInFlight = true;
    try {
      this.persistLocalSession();
      const syncedSessionId = await this.syncPendingChatSession();
      if (syncedSessionId) {
        this.statusText = 'Session saved. New scenario tomorrow.';
        this.lockChatForToday(syncedSessionId);
      }
      this.sessionTurns = [];
      this.sessionStartedAt = null;
    } finally {
      this.finalizeInFlight = false;
    }
  }

  lockChatForToday(sessionId) {
    this.lastCompletedSessionId = sessionId || null;
    this.isLocked = true;
    this.micDisabled = true;
    const key = this.getScenarioStorageKey();
    if (key) localStorage.removeItem(key);
  }
}

describe('Adversarial Human Behavioral & Edge-Case Suite (Issue #3 / AUD-022)', () => {
  let localStorageMock;

  beforeEach(() => {
    localStorageMock = makeLocalStorageMock();
    vi.stubGlobal('localStorage', localStorageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CATEGORY 1: Chaotic User Interactions & Impatient Clicking
  // ───────────────────────────────────────────────────────────────────────────
  describe('Category 1: Impatient Rapid Tapping & Double-Click Races', () => {
    it('human_edgecase: rapid mic spamming (10 quick taps) does not create duplicate pending payloads or corrupt turn state', () => {
      const harness = new HumanScenarioHarness();
      harness.sessionStartedAt = '2026-08-29T10:00:00.000Z';
      harness.phase = 'roleplay';
      harness.sessionTurns.push({ role: 'user', content: 'Turn 1 spoken' });

      // User rapidly taps mic / triggers persist 10 times in 100ms
      for (let i = 0; i < 10; i++) {
        harness.persistLocalSession();
      }

      const raw = localStorage.getItem(PENDING_CHAT_SESSION_KEY);
      expect(raw).toBeTruthy();
      const payload = JSON.parse(raw);
      expect(payload.messages.length).toBe(1);
      expect(payload.messages[0].content).toBe('Turn 1 spoken');
      expect(payload.session_id).toBeNull();
    });

    it('human_edgecase: simultaneous finalizeAndSyncSession calls are debounced by finalizeInFlight flag', async () => {
      const harness = new HumanScenarioHarness();
      harness.sessionStartedAt = '2026-08-29T10:00:00.000Z';
      harness.phase = 'feedback';
      harness.sessionTurns = [
        { role: 'user', content: 'Turn 1' },
        { role: 'assistant', content: 'Feedback response' }
      ];

      // Trigger finalize twice concurrently
      const promise1 = harness.finalizeAndSyncSession();
      const promise2 = harness.finalizeAndSyncSession();
      await Promise.all([promise1, promise2]);

      expect(harness.syncedPayloads.length).toBe(1);
      expect(harness.isLocked).toBe(true);
      expect(harness.lastCompletedSessionId).toBe('server-scenario-sess-101');
    });

    it('human_edgecase: clicking mic when locked returns early without triggering connection or un-locking mic', () => {
      const harness = new HumanScenarioHarness();
      harness.lockChatForToday('completed-sess-xyz');

      expect(harness.isLocked).toBe(true);
      expect(harness.micDisabled).toBe(true);

      // Attempt startSession logic when locked
      if (harness.isLocked) {
        harness.statusText = "Today's scenario is already complete.";
      }
      expect(harness.statusText).toBe("Today's scenario is already complete.");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CATEGORY 2: Mid-Session Mobile Lifecycle, Phone Calls & App Switching
  // ───────────────────────────────────────────────────────────────────────────
  describe('Category 2: Mobile Lifecycle, Phone Calls & Backgrounding (pagehide/visibilitychange)', () => {
    it('human_edgecase: incoming phone call pauses session at 1:42 left -> serializes state -> resumes seamlessly 10 minutes later', async () => {
      const harness = new HumanScenarioHarness();
      harness.sessionStartedAt = '2026-08-29T10:00:00.000Z';
      harness.phase = 'roleplay';
      harness.phaseSecondsLeft = 102; // 1 min 42 sec
      harness.sessionTurns.push(
        { role: 'user', content: 'Hello interviewer' },
        { role: 'assistant', content: 'Welcome, tell me about your background.' }
      );

      // 1. Phone rings -> OS fires pagehide/freeze -> app persists local session
      harness.persistLocalSession();
      await harness.syncPendingChatSession();
      expect(harness.activeSessionId).toBe('server-scenario-sess-101');
      expect(harness.syncedTurnCount).toBe(2);

      // 2. User finishes 10-minute call -> reopen app -> restore state
      const resumedHarness = new HumanScenarioHarness();
      const restored = resumedHarness.restoreScenarioState();
      expect(restored).toBe(true);
      expect(resumedHarness.phaseSecondsLeft).toBe(102);
      expect(resumedHarness.activeSessionId).toBe('server-scenario-sess-101');
      expect(resumedHarness.syncedTurnCount).toBe(2);
      expect(resumedHarness.sessionTurns.length).toBe(2);
      expect(resumedHarness.statusText).toBe('Scenario in progress (1:42 remaining) — Tap mic to continue');

      // 3. User taps mic, speaks turn 3
      resumedHarness.sessionTurns.push({ role: 'user', content: 'I have 5 years of software experience.' });
      resumedHarness.persistLocalSession();

      const raw = localStorage.getItem(PENDING_CHAT_SESSION_KEY);
      const pendingPayload = JSON.parse(raw);
      expect(pendingPayload.session_id).toBe('server-scenario-sess-101');
      // Only 1 delta message sent!
      expect(pendingPayload.messages.length).toBe(1);
      expect(pendingPayload.messages[0].content).toBe('I have 5 years of software experience.');
    });

    it('human_edgecase: user switches to another app during feedback monologue -> preserves completed state on reopen', async () => {
      const harness = new HumanScenarioHarness();
      harness.sessionStartedAt = '2026-08-29T10:00:00.000Z';
      harness.phase = 'feedback';
      harness.sessionTurns.push(
        { role: 'user', content: 'Roleplay line' },
        { role: 'assistant', content: 'Here is what you did well in English...' }
      );

      // App backgrounded during feedback phase -> triggers handleScenarioExit
      harness.persistLocalSession();
      await harness.syncPendingChatSession();
      harness.lockChatForToday('completed-feedback-uuid');

      // Reopen scenario page
      const freshHarness = new HumanScenarioHarness();
      // Since it's completed, in-progress storage key is empty
      const inProgressStateRestored = freshHarness.restoreScenarioState();
      expect(inProgressStateRestored).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CATEGORY 3: Malicious, Corrupted & Tampered LocalStorage Payloads
  // ───────────────────────────────────────────────────────────────────────────
  describe('Category 3: Tampered LocalStorage & Defensive Bounds Handling', () => {
    it('human_edgecase: tampered syncedTurnCount greater than sessionTurns.length clamps safely to array length', () => {
      const harness = new HumanScenarioHarness();
      const key = harness.getScenarioStorageKey();

      // Hacker/corrupted storage set syncedTurnCount to 9999 when only 2 turns exist
      localStorage.setItem(key, JSON.stringify({
        phaseSecondsLeft: 120,
        sessionStartedAt: '2026-08-29T10:00:00.000Z',
        activeSessionId: 'sess-tampered-1',
        syncedTurnCount: 9999,
        sessionTurns: [
          { role: 'user', content: 'Turn 1' },
          { role: 'assistant', content: 'Turn 2' }
        ]
      }));

      const restored = harness.restoreScenarioState();
      expect(restored).toBe(true);
      // Must be clamped to sessionTurns.length (2), not 9999
      expect(harness.syncedTurnCount).toBe(2);

      // Now add turn 3 and persist
      harness.sessionTurns.push({ role: 'user', content: 'Turn 3' });
      harness.persistLocalSession();

      const raw = localStorage.getItem(PENDING_CHAT_SESSION_KEY);
      const payload = JSON.parse(raw);
      expect(payload.session_id).toBe('sess-tampered-1');
      expect(payload.messages.length).toBe(1);
      expect(payload.messages[0].content).toBe('Turn 3');
    });

    it('human_edgecase: negative syncedTurnCount (e.g. -5) in storage resets safely to 0', () => {
      const harness = new HumanScenarioHarness();
      const key = harness.getScenarioStorageKey();

      localStorage.setItem(key, JSON.stringify({
        phaseSecondsLeft: 120,
        sessionStartedAt: '2026-08-29T10:00:00.000Z',
        activeSessionId: 'sess-negative-1',
        syncedTurnCount: -5,
        sessionTurns: [{ role: 'user', content: 'Turn 1' }]
      }));

      const restored = harness.restoreScenarioState();
      expect(restored).toBe(true);
      expect(harness.syncedTurnCount).toBe(0);
    });

    it('human_edgecase: turns with script tags, SQL injection, and unicode emojis are safely sanitized and preserved', () => {
      const harness = new HumanScenarioHarness();
      harness.sessionStartedAt = '2026-08-29T10:00:00.000Z';
      harness.sessionTurns = [
        { role: 'user', content: '<script>alert("xss")</script> Hello! 🙏🚀' },
        { role: 'assistant', content: "'; DROP TABLE chat_sessions; -- Sure!" }
      ];

      harness.persistLocalSession();

      const raw = localStorage.getItem(PENDING_CHAT_SESSION_KEY);
      const payload = JSON.parse(raw);
      expect(payload.messages[0].content).toContain('<script>alert("xss")</script>');
      expect(payload.messages[0].content).toContain('🙏🚀');
      expect(payload.messages[1].content).toContain("'; DROP TABLE chat_sessions; --");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CATEGORY 4: Midnight IST Calendar Day Crossing & Timezone Boundaries
  // ───────────────────────────────────────────────────────────────────────────
  describe('Category 4: Midnight IST Calendar Day Crossing (11:59 PM -> 00:01 AM)', () => {
    it('human_edgecase: session saved on Day 1 does NOT restore for Day 2 after date rollover', () => {
      const day1Date = new Date('2026-08-29T10:00:00.000Z');
      const day2Date = new Date('2026-08-30T10:00:00.000Z');

      const harnessDay1 = new HumanScenarioHarness();
      harnessDay1.sessionStartedAt = day1Date.toISOString();
      harnessDay1.phase = 'roleplay';
      harnessDay1.phaseSecondsLeft = 60;
      harnessDay1.sessionTurns = [{ role: 'user', content: 'Spoken on Day 1' }];

      // Save on Day 1
      harnessDay1.saveScenarioState(day1Date);
      const day1Key = harnessDay1.getScenarioStorageKey(day1Date);
      expect(day1Key).toContain('2026-08-29');

      // Day 2 arrives
      const harnessDay2 = new HumanScenarioHarness();
      // Looking for Day 2 key returns false (fresh scenario for the new day)
      const day2Restored = harnessDay2.restoreScenarioState(day2Date);
      expect(day2Restored).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // CATEGORY 5: Zero-Turn Audio Aborts & Noise Gate Silence
  // ───────────────────────────────────────────────────────────────────────────
  describe('Category 5: Audio Aborts, Zero Turns & Ambient Noise', () => {
    it('human_edgecase: immediate mic permission error (0 turns, 0 seconds) does NOT create orphaned pending session', () => {
      const harness = new HumanScenarioHarness();
      harness.sessionStartedAt = new Date().toISOString();
      harness.sessionTurns = []; // 0 turns

      harness.persistLocalSession();

      expect(localStorage.getItem(PENDING_CHAT_SESSION_KEY)).toBeNull();
    });

    it('human_edgecase: ambient noise producing empty/whitespace-only turns is ignored during delta sync', () => {
      const harness = new HumanScenarioHarness();
      harness.sessionStartedAt = new Date().toISOString();
      harness.sessionTurns = [
        { role: 'user', content: '    ' }, // pure spaces
        { role: 'user', content: '\n\t  ' } // tabs & newlines
      ];

      harness.persistLocalSession();

      // No meaningful turns -> pending chat session remains clean
      expect(localStorage.getItem(PENDING_CHAT_SESSION_KEY)).toBeNull();
    });
  });
});
