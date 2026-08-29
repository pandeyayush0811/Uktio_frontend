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
 * High-Fidelity Simulation of scenario.html's exact state persistence,
 * delta turn slicing, resumption lifecycle, and sync recovery machine.
 */
class ScenarioResumptionHarness {
  constructor(options = {}) {
    this.todaysScenario = options.todaysScenario || {
      key: 'restaurant_order',
      category: 'Daily Life',
      title: 'Ordering Food',
      character_brief: 'Waiter',
      opening_situation: 'You are at a cafe.'
    };
    this.phase = 'idle'; // 'idle' | 'roleplay' | 'feedback'
    this.phaseSecondsLeft = options.phaseSecondsLeft || 180;
    this.PHASE_1_DURATION_SECONDS = 180;
    this.sessionStartedAt = null;
    this.sessionTurns = [];
    this.activeSessionId = null;
    this.syncedTurnCount = 0;
    this.finalizeInFlight = false;
    this.sessionAttemptInFlight = false;
    this.lastCompletedSessionId = null;
    this.isLocked = false;
    this.statusText = '';
    this.statusMode = null;
    this.micDisabled = false;

    // Injected mock for syncPendingChatSession
    this.mockSyncResult = options.mockSyncResult || 'server-sess-generated-uuid';
    this.mockSyncShouldFail = options.mockSyncShouldFail || false;
    this.mockSyncStatus = options.mockSyncStatus || null;
    this.syncCalls = [];
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

  saveScenarioState() {
    const key = this.getScenarioStorageKey();
    if (!key) return;
    try {
      if (this.phase === 'feedback' || this.isLocked) {
        localStorage.removeItem(key);
        return;
      }
      const state = {
        phaseSecondsLeft: this.phaseSecondsLeft,
        sessionStartedAt: this.sessionStartedAt,
        activeSessionId: this.activeSessionId,
        syncedTurnCount: this.syncedTurnCount,
        sessionTurns: this.sessionTurns.filter(t => t.content && t.content.trim())
      };
      localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
      console.warn('saveScenarioState failed:', e);
    }
  }

  restoreScenarioState() {
    const key = this.getScenarioStorageKey();
    if (!key) return false;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const state = JSON.parse(raw);
      if (state && typeof state.phaseSecondsLeft === 'number' && state.phaseSecondsLeft > 0) {
        this.phaseSecondsLeft = state.phaseSecondsLeft;
        this.sessionStartedAt = state.sessionStartedAt || this.sessionStartedAt;
        this.activeSessionId = state.activeSessionId || null;
        this.syncedTurnCount = typeof state.syncedTurnCount === 'number' ? state.syncedTurnCount : 0;
        this.sessionTurns = Array.isArray(state.sessionTurns) ? state.sessionTurns : [];

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
      const meaningful = this.sessionTurns.filter(t => t.content && t.content.trim());
      if (!meaningful.length) {
        localStorage.removeItem(PENDING_CHAT_SESSION_KEY);
        return;
      }

      // Delta turn calculation: if activeSessionId is set, send only unsynced delta turns
      const turnsToSend = this.activeSessionId ? meaningful.slice(this.syncedTurnCount) : meaningful;

      if (!turnsToSend.length && this.activeSessionId) {
        // Nothing new to sync in delta mode
        return;
      }

      localStorage.setItem(PENDING_CHAT_SESSION_KEY, JSON.stringify({
        session_id: this.activeSessionId,
        started_at: this.sessionStartedAt || new Date().toISOString(),
        ended_at: new Date().toISOString(),
        session_type: 'scenario',
        scenario_key: this.todaysScenario ? this.todaysScenario.key : null,
        messages: turnsToSend.map(t => ({ role: t.role, content: t.content }))
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

    this.syncCalls.push(payload);

    if (this.mockSyncShouldFail) {
      const err = new Error('Sync failed');
      err.status = this.mockSyncStatus || 500;
      throw err;
    }

    const assignedId = this.activeSessionId || this.mockSyncResult;
    this.activeSessionId = assignedId;
    this.syncedTurnCount = this.sessionTurns.length;
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

describe('Adversarial Frontend Suite — Issue #3 (AUD-022: Scenario Premature Lockout & Resumption)', () => {
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
  // Suite 1: State Machine & Resumption Persistence (saveScenarioState / restoreScenarioState)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Suite 1: In-Progress State Machine & Resumption Persistence', () => {
    it('test_saves_and_restores_activeSessionId_and_syncedTurnCount_across_turns', () => {
      const harness = new ScenarioResumptionHarness();
      harness.sessionStartedAt = '2026-08-29T10:00:00.000Z';
      harness.phaseSecondsLeft = 145;
      harness.activeSessionId = 'sess-active-abc';
      harness.syncedTurnCount = 2;
      harness.sessionTurns = [
        { role: 'user', content: 'Turn 1' },
        { role: 'assistant', content: 'Turn 2' },
        { role: 'user', content: 'Turn 3' }
      ];

      harness.saveScenarioState();

      const key = harness.getScenarioStorageKey();
      const rawStored = localStorage.getItem(key);
      expect(rawStored).toBeTruthy();
      const parsed = JSON.parse(rawStored);
      expect(parsed.activeSessionId).toBe('sess-active-abc');
      expect(parsed.syncedTurnCount).toBe(2);
      expect(parsed.phaseSecondsLeft).toBe(145);
      expect(parsed.sessionTurns.length).toBe(3);

      // Restore into fresh harness
      const restoredHarness = new ScenarioResumptionHarness();
      const restored = restoredHarness.restoreScenarioState();
      expect(restored).toBe(true);
      expect(restoredHarness.activeSessionId).toBe('sess-active-abc');
      expect(restoredHarness.syncedTurnCount).toBe(2);
      expect(restoredHarness.phaseSecondsLeft).toBe(145);
      expect(restoredHarness.sessionTurns.length).toBe(3);
    });

    it('test_backward_compatibility_restores_legacy_state_without_activeSessionId_defensively', () => {
      const harness = new ScenarioResumptionHarness();
      const key = harness.getScenarioStorageKey();

      // Legacy payload stored before fix (no activeSessionId / syncedTurnCount fields)
      localStorage.setItem(key, JSON.stringify({
        phaseSecondsLeft: 120,
        sessionStartedAt: '2026-08-29T09:00:00.000Z',
        sessionTurns: [{ role: 'user', content: 'Legacy Turn' }]
      }));

      const restored = harness.restoreScenarioState();
      expect(restored).toBe(true);
      expect(harness.activeSessionId).toBeNull();
      expect(harness.syncedTurnCount).toBe(0);
      expect(harness.sessionTurns.length).toBe(1);
    });

    it('test_corrupted_localStorage_payloads_fail_safely_without_crashing', () => {
      const harness = new ScenarioResumptionHarness();
      const key = harness.getScenarioStorageKey();

      // Case A: Malformed JSON
      localStorage.setItem(key, '{ invalid json syntax');
      expect(harness.restoreScenarioState()).toBe(false);

      // Case B: Non-number phaseSecondsLeft
      localStorage.setItem(key, JSON.stringify({ phaseSecondsLeft: '180', sessionTurns: [] }));
      expect(harness.restoreScenarioState()).toBe(false);

      // Case C: Negative or 0 phaseSecondsLeft
      localStorage.setItem(key, JSON.stringify({ phaseSecondsLeft: 0, sessionTurns: [] }));
      expect(harness.restoreScenarioState()).toBe(false);

      // Case D: Non-array sessionTurns
      localStorage.setItem(key, JSON.stringify({ phaseSecondsLeft: 100, sessionTurns: 'not an array' }));
      expect(harness.restoreScenarioState()).toBe(true);
      expect(Array.isArray(harness.sessionTurns)).toBe(true);
    });

    it('test_cross_day_and_cross_scenario_state_isolation', () => {
      const harness = new ScenarioResumptionHarness({
        todaysScenario: { key: 'scenario_today' }
      });

      // State saved for yesterday's scenario or different scenario key
      const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const yesterdayKey = `utkio_scenario_state_scenario_today_${harness.getTodayIstDateString(yesterdayDate)}`;
      localStorage.setItem(yesterdayKey, JSON.stringify({
        phaseSecondsLeft: 150,
        sessionTurns: [{ role: 'user', content: 'Yesterday message' }]
      }));

      const restored = harness.restoreScenarioState();
      expect(restored).toBe(false);
      expect(harness.sessionTurns.length).toBe(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 2: Delta Slicing & Anti-Duplicate Sync Payloads (persistLocalSession)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Suite 2: Delta Turn Slicing & Anti-Duplicate Sync Payloads', () => {
    it('test_initial_sync_sends_session_id_null_and_all_turns', () => {
      const harness = new ScenarioResumptionHarness();
      harness.activeSessionId = null;
      harness.syncedTurnCount = 0;
      harness.sessionStartedAt = '2026-08-29T10:00:00.000Z';
      harness.sessionTurns = [
        { role: 'user', content: 'I would like a coffee' },
        { role: 'assistant', content: 'Hot or iced?' }
      ];

      harness.persistLocalSession();

      const raw = localStorage.getItem(PENDING_CHAT_SESSION_KEY);
      expect(raw).toBeTruthy();
      const payload = JSON.parse(raw);
      expect(payload.session_id).toBeNull();
      expect(payload.session_type).toBe('scenario');
      expect(payload.scenario_key).toBe('restaurant_order');
      expect(payload.messages.length).toBe(2);
      expect(payload.messages[0].content).toBe('I would like a coffee');
    });

    it('test_resumed_sync_sends_activeSessionId_and_ONLY_unsynced_delta_turns', () => {
      const harness = new ScenarioResumptionHarness();
      harness.activeSessionId = 'sess-existing-456';
      harness.syncedTurnCount = 2; // Turns 0 and 1 were already synced to DB
      harness.sessionStartedAt = '2026-08-29T10:00:00.000Z';
      harness.sessionTurns = [
        { role: 'user', content: 'Turn 1 (already synced)' },
        { role: 'assistant', content: 'Turn 2 (already synced)' },
        { role: 'user', content: 'Turn 3 (NEW delta)' },
        { role: 'assistant', content: 'Turn 4 (NEW delta)' },
        { role: 'user', content: 'Turn 5 (NEW delta)' }
      ];

      harness.persistLocalSession();

      const raw = localStorage.getItem(PENDING_CHAT_SESSION_KEY);
      expect(raw).toBeTruthy();
      const payload = JSON.parse(raw);
      expect(payload.session_id).toBe('sess-existing-456');
      expect(payload.messages.length).toBe(3); // Only turns 3, 4, 5!
      expect(payload.messages[0].content).toBe('Turn 3 (NEW delta)');
      expect(payload.messages[1].content).toBe('Turn 4 (NEW delta)');
      expect(payload.messages[2].content).toBe('Turn 5 (NEW delta)');
    });

    it('test_delta_sync_skips_writing_empty_pending_payload_when_no_new_turns_exist', () => {
      const harness = new ScenarioResumptionHarness();
      harness.activeSessionId = 'sess-existing-456';
      harness.syncedTurnCount = 2;
      harness.sessionTurns = [
        { role: 'user', content: 'Turn 1' },
        { role: 'assistant', content: 'Turn 2' }
      ];

      // No new turns since last sync
      harness.persistLocalSession();

      // Should NOT set pending chat session when no new turns to append
      const raw = localStorage.getItem(PENDING_CHAT_SESSION_KEY);
      expect(raw).toBeNull();
    });

    it('test_filters_out_whitespace_and_empty_turns_before_delta_slicing', () => {
      const harness = new ScenarioResumptionHarness();
      harness.activeSessionId = 'sess-existing-789';
      harness.syncedTurnCount = 1;
      harness.sessionTurns = [
        { role: 'user', content: 'Valid Turn 1' },
        { role: 'assistant', content: '   ' }, // Whitespace
        { role: 'user', content: '' }, // Empty
        { role: 'assistant', content: 'Valid Turn 2' }
      ];

      harness.persistLocalSession();

      const raw = localStorage.getItem(PENDING_CHAT_SESSION_KEY);
      expect(raw).toBeTruthy();
      const payload = JSON.parse(raw);
      expect(payload.session_id).toBe('sess-existing-789');
      // Meaningful turns are ['Valid Turn 1', 'Valid Turn 2']. Sliced at index 1 -> ['Valid Turn 2']
      expect(payload.messages.length).toBe(1);
      expect(payload.messages[0].content).toBe('Valid Turn 2');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 3: Multi-Leg Lifecycle, Interruption & Recovery
  // ───────────────────────────────────────────────────────────────────────────
  describe('Suite 3: Multi-Leg Lifecycle, Interruption & Recovery', () => {
    it('test_step_by_step_multi_turn_pause_and_resume_flow', async () => {
      const harness = new ScenarioResumptionHarness();

      // Leg 1: User starts scenario and speaks 2 turns
      harness.sessionStartedAt = '2026-08-29T10:00:00.000Z';
      harness.phase = 'roleplay';
      harness.phaseSecondsLeft = 160;
      harness.sessionTurns.push(
        { role: 'user', content: 'Hi, is this table free?' },
        { role: 'assistant', content: 'Yes, please have a seat.' }
      );

      // Intermediate sync (e.g. on pause / network sync)
      harness.persistLocalSession();
      const syncedId1 = await harness.syncPendingChatSession();
      expect(syncedId1).toBe('server-sess-generated-uuid');
      expect(harness.activeSessionId).toBe('server-sess-generated-uuid');
      expect(harness.syncedTurnCount).toBe(2);

      // Leg 2: User resumes and speaks 2 more turns
      harness.phaseSecondsLeft = 100;
      harness.sessionTurns.push(
        { role: 'user', content: 'Can I see the dessert menu?' },
        { role: 'assistant', content: 'Here is our dessert menu.' }
      );

      harness.persistLocalSession();
      expect(harness.syncCalls.length).toBe(1);

      const syncedId2 = await harness.syncPendingChatSession();
      expect(syncedId2).toBe('server-sess-generated-uuid');
      expect(harness.activeSessionId).toBe('server-sess-generated-uuid');
      expect(harness.syncedTurnCount).toBe(4);

      // Verify the second sync sent delta turns only
      expect(harness.syncCalls.length).toBe(2);
      expect(harness.syncCalls[1].session_id).toBe('server-sess-generated-uuid');
      expect(harness.syncCalls[1].messages.length).toBe(2);
      expect(harness.syncCalls[1].messages[0].content).toBe('Can I see the dessert menu?');
      expect(harness.syncCalls[1].messages[1].content).toBe('Here is our dessert menu.');
    });

    it('test_abrupt_0_turn_abort_does_not_persist_pending_session', () => {
      const harness = new ScenarioResumptionHarness();
      harness.sessionStartedAt = '2026-08-29T10:00:00.000Z';
      harness.sessionTurns = []; // 0 turns

      harness.persistLocalSession();

      const raw = localStorage.getItem(PENDING_CHAT_SESSION_KEY);
      expect(raw).toBeNull();
    });

    it('test_network_sync_failure_preserves_local_state_for_later_retry', async () => {
      const harness = new ScenarioResumptionHarness({
        mockSyncShouldFail: true,
        mockSyncStatus: 502
      });

      harness.sessionStartedAt = '2026-08-29T10:00:00.000Z';
      harness.sessionTurns = [{ role: 'user', content: 'Turn 1' }];
      harness.persistLocalSession();

      let caughtErr = null;
      try {
        await harness.syncPendingChatSession();
      } catch (err) {
        caughtErr = err;
      }

      expect(caughtErr).toBeTruthy();
      // Verify local scenario state is still preserved in localStorage
      const key = harness.getScenarioStorageKey();
      const rawStored = localStorage.getItem(key);
      expect(rawStored).toBeTruthy();
      const parsed = JSON.parse(rawStored);
      expect(parsed.sessionTurns.length).toBe(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Suite 4: Completion & Lockout Gate
  // ───────────────────────────────────────────────────────────────────────────
  describe('Suite 4: Genuine Completion & Lockout Gate', () => {
    it('test_completion_finalizes_session_and_locks_chat_with_completed_session_id', async () => {
      const harness = new ScenarioResumptionHarness();
      harness.sessionStartedAt = '2026-08-29T10:00:00.000Z';
      harness.phase = 'feedback';
      harness.sessionTurns = [
        { role: 'user', content: 'Roleplay line' },
        { role: 'assistant', content: 'Feedback monologue' }
      ];

      await harness.finalizeAndSyncSession();

      expect(harness.isLocked).toBe(true);
      expect(harness.micDisabled).toBe(true);
      expect(harness.lastCompletedSessionId).toBe('server-sess-generated-uuid');

      // Local state key should be wiped on completion
      const key = harness.getScenarioStorageKey();
      expect(localStorage.getItem(key)).toBeNull();
    });
  });
});
