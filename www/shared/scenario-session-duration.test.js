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

describe('scenario.html sessionStartedAt State Management & Leakage Check (Issue #3 / AUD-003)', () => {
  const scenarioHtmlPath = path.resolve(__dirname, '../scenario.html');
  const scenarioHtmlContent = fs.readFileSync(scenarioHtmlPath, 'utf8');

  // Test 1: Static code check for finalizeAndSyncSession
  it('test_scenario_html_must_reset_session_started_at_upon_finalize', () => {
    const finalizeRegex = /async\s+function\s+finalizeAndSyncSession\s*\(\)\s*\{([\s\S]*?)\n\}/;
    const match = scenarioHtmlContent.match(finalizeRegex);

    expect(match).not.toBeNull();
    const finalizeBody = match ? match[1] : '';

    const resetsSessionStartedAt = /sessionStartedAt\s*=\s*null/.test(finalizeBody);

    expect(resetsSessionStartedAt,
      'BUG #3 DETECTED: finalizeAndSyncSession() in scenario.html clears sessionTurns but NEVER resets sessionStartedAt to null. ' +
      'Subsequent scenario sessions will reuse the stale started_at timestamp, inflating the duration.'
    ).toBe(true);
  });

  // Test 2: Static code check for startSession failure handling and try/catch
  it('test_scenario_html_must_reset_session_started_at_upon_failed_start', () => {
    const startSessionRegex = /async\s+function\s+startSession\s*\(\)\s*\{([\s\S]*?)\n\}/;
    const match = scenarioHtmlContent.match(startSessionRegex);

    expect(match).not.toBeNull();
    const startBody = match ? match[1] : '';

    const resetsOnNotOk = /if\s*\(\s*!result\.ok\s*\)\s*\{[\s\S]*?sessionStartedAt\s*=\s*null/.test(startBody);
    const hasTryCatch = /try\s*\{[\s\S]*?\}\s*catch\s*\([\s\S]*?\)\s*\{[\s\S]*?sessionStartedAt\s*=\s*null/.test(startBody);

    expect(resetsOnNotOk,
      'BUG #3 DETECTED: startSession() in scenario.html sets sessionStartedAt before voiceSession.start() but does not reset it to null if !result.ok.'
    ).toBe(true);

    expect(hasTryCatch,
      'BUG #3 DETECTED: startSession() in scenario.html lacks try...catch to reset sessionStartedAt to null if voiceSession.start() throws.'
    ).toBe(true);
  });
});

/**
 * Harness simulating scenario.html's exact session state machine and persistence logic
 */
class ScenarioSessionManager {
  constructor() {
    this.sessionTurns = [];
    this.sessionStartedAt = null;
    this.currentTurnIndex = -1;
    this.phase = 'idle'; // 'idle' | 'roleplay' | 'feedback'
    this.finalizeInFlight = false;
    this.sessionAttemptInFlight = false;
    this.syncedPayloads = [];
    this.todaysScenario = { key: 'interview_intro', title: 'Job Interview' };
  }

  async startSession(voiceSessionMock, currentTimeIso = new Date().toISOString()) {
    if (this.phase === 'feedback') return { ok: false, reason: 'completed' };

    this.sessionAttemptInFlight = true;
    if (!this.sessionStartedAt) this.sessionStartedAt = currentTimeIso;
    this.phase = 'roleplay';

    try {
      const result = await voiceSessionMock.start();
      if (!result.ok) {
        this.sessionAttemptInFlight = false;
        this.sessionStartedAt = null;
        return result;
      }
      return result;
    } catch (err) {
      this.sessionAttemptInFlight = false;
      this.sessionStartedAt = null;
      return { ok: false, reason: 'exception', error: err };
    }
  }

  addTurn(role, content, phase = 'roleplay') {
    this.currentTurnIndex++;
    this.sessionTurns.push({ role, content, phase });
  }

  persistLocalSession(currentTimeIso = new Date().toISOString()) {
    try {
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

  async finalizeAndSyncSession(currentTimeIso = new Date().toISOString()) {
    if (!this.sessionTurns.length || this.finalizeInFlight) return null;
    this.finalizeInFlight = true;

    try {
      const payload = this.persistLocalSession(currentTimeIso);
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
}

describe('Scenario Session State Machine & Lifecycle (Behavioral Harness)', () => {
  let localStorageMock;

  beforeEach(() => {
    localStorageMock = makeLocalStorageMock();
    vi.stubGlobal('localStorage', localStorageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('test_scenario_manager_clears_session_started_at_on_successful_finalize', async () => {
    const manager = new ScenarioSessionManager();
    const t0 = '2026-08-29T10:00:00.000Z';
    const t1 = '2026-08-29T10:02:30.000Z';

    const voiceSessionMock = { start: async () => ({ ok: true }) };
    await manager.startSession(voiceSessionMock, t0);

    expect(manager.sessionStartedAt).toBe(t0);
    manager.addTurn('assistant', 'Tell me about yourself.', 'roleplay');
    manager.addTurn('user', 'I am a software engineer.', 'roleplay');

    const synced = await manager.finalizeAndSyncSession(t1);

    expect(synced).not.toBeNull();
    expect(synced.started_at).toBe(t0);
    expect(synced.ended_at).toBe(t1);
    expect(synced.session_type).toBe('scenario');
    expect(manager.sessionTurns.length).toBe(0);
    expect(manager.sessionStartedAt).toBeNull();
  });

  it('test_failed_start_session_cleans_up_session_started_at', async () => {
    const manager = new ScenarioSessionManager();
    const tFail = '2026-08-29T10:00:00.000Z';
    const tSuccess = '2026-08-29T10:05:00.000Z';

    // 1. Failed start attempt (e.g. no api key)
    const failingVoiceSession = { start: async () => ({ ok: false, reason: 'no_api_key' }) };
    const failResult = await manager.startSession(failingVoiceSession, tFail);
    expect(failResult.ok).toBe(false);
    expect(manager.sessionStartedAt).toBeNull();
    expect(manager.sessionAttemptInFlight).toBe(false);

    // 2. Subsequent successful start after user fixes key
    const successVoiceSession = { start: async () => ({ ok: true }) };
    const successResult = await manager.startSession(successVoiceSession, tSuccess);
    expect(successResult.ok).toBe(true);
    expect(manager.sessionStartedAt).toBe(tSuccess);
  });

  it('test_start_session_exception_cleans_up_session_started_at', async () => {
    const manager = new ScenarioSessionManager();
    const tFail = '2026-08-29T10:00:00.000Z';
    const tSuccess = '2026-08-29T10:10:00.000Z';

    // 1. Microphone permission exception
    const throwingVoiceSession = {
      start: async () => { throw new Error('NotAllowedError: Permission denied'); }
    };
    const failResult = await manager.startSession(throwingVoiceSession, tFail);
    expect(failResult.ok).toBe(false);
    expect(manager.sessionStartedAt).toBeNull();

    // 2. Subsequent successful start
    const successVoiceSession = { start: async () => ({ ok: true }) };
    await manager.startSession(successVoiceSession, tSuccess);
    expect(manager.sessionStartedAt).toBe(tSuccess);
  });
});
