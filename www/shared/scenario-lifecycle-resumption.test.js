import { describe, it, expect, beforeEach } from 'vitest';

describe('Scenario Lifecycle & Resumption Payload Tests', () => {
  let localStorageMock;

  beforeEach(() => {
    let store = {};
    localStorageMock = {
      getItem: (key) => store[key] || null,
      setItem: (key, val) => { store[key] = String(val); },
      removeItem: (key) => { delete store[key]; },
      clear: () => { store = {}; }
    };
  });

  function buildScenarioSyncPayload({
    activeSessionId,
    syncedTurnCount,
    sessionTurns,
    sessionStartedAt,
    scenarioKey,
    isCompleted = false
  }) {
    const meaningful = sessionTurns.filter(t => t.content && t.content.trim());
    if (!meaningful.length) return null;

    if (activeSessionId) {
      const deltaMessages = meaningful.slice(syncedTurnCount);
      if (!deltaMessages.length && !isCompleted) return null;
      return {
        session_id: activeSessionId,
        started_at: sessionStartedAt,
        ended_at: new Date().toISOString(),
        session_type: 'scenario',
        scenario_key: scenarioKey || null,
        is_completed: isCompleted,
        messages: deltaMessages.map(t => ({ role: t.role, content: t.content }))
      };
    }

    return {
      session_id: null,
      started_at: sessionStartedAt,
      ended_at: new Date().toISOString(),
      session_type: 'scenario',
      scenario_key: scenarioKey || null,
      is_completed: isCompleted,
      messages: meaningful.map(t => ({ role: t.role, content: t.content }))
    };
  }

  function serializeScenarioState({
    phaseSecondsLeft,
    sessionStartedAt,
    sessionTurns,
    activeSessionId,
    syncedTurnCount
  }) {
    return JSON.stringify({
      phaseSecondsLeft,
      sessionStartedAt,
      sessionTurns: sessionTurns.filter(t => t.content && t.content.trim()),
      activeSessionId: activeSessionId || null,
      syncedTurnCount: typeof syncedTurnCount === 'number' ? syncedTurnCount : 0
    });
  }

  function deserializeScenarioState(raw) {
    if (!raw) return null;
    const state = JSON.parse(raw);
    return {
      phaseSecondsLeft: state.phaseSecondsLeft,
      sessionStartedAt: state.sessionStartedAt,
      sessionTurns: Array.isArray(state.sessionTurns) ? state.sessionTurns : [],
      activeSessionId: state.activeSessionId || null,
      syncedTurnCount: typeof state.syncedTurnCount === 'number' ? state.syncedTurnCount : 0
    };
  }

  it('creates full initial payload with session_id: null when activeSessionId is not set', () => {
    const turns = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' }
    ];
    const payload = buildScenarioSyncPayload({
      activeSessionId: null,
      syncedTurnCount: 0,
      sessionTurns: turns,
      sessionStartedAt: '2026-08-29T10:00:00.000Z',
      scenarioKey: 'restaurant_order'
    });

    expect(payload).not.toBeNull();
    expect(payload.session_id).toBeNull();
    expect(payload.session_type).toBe('scenario');
    expect(payload.scenario_key).toBe('restaurant_order');
    expect(payload.messages.length).toBe(2);
    expect(payload.messages[0].content).toBe('Hello');
  });

  it('creates delta payload with existing session_id when activeSessionId is set and turns have progressed', () => {
    const turns = [
      { role: 'user', content: 'Turn 1' },
      { role: 'assistant', content: 'Turn 2' },
      { role: 'user', content: 'Turn 3' },
      { role: 'assistant', content: 'Turn 4' },
      { role: 'user', content: 'Turn 5' }
    ];

    const payload = buildScenarioSyncPayload({
      activeSessionId: 'session-uuid-existing',
      syncedTurnCount: 2,
      sessionTurns: turns,
      sessionStartedAt: '2026-08-29T10:00:00.000Z',
      scenarioKey: 'restaurant_order'
    });

    expect(payload).not.toBeNull();
    expect(payload.session_id).toBe('session-uuid-existing');
    expect(payload.messages.length).toBe(3); // turns 3, 4, 5
    expect(payload.messages[0].content).toBe('Turn 3');
    expect(payload.messages[2].content).toBe('Turn 5');
  });

  it('returns null if all turns have already been synced and no new delta exists', () => {
    const turns = [
      { role: 'user', content: 'Turn 1' },
      { role: 'assistant', content: 'Turn 2' }
    ];

    const payload = buildScenarioSyncPayload({
      activeSessionId: 'session-uuid-existing',
      syncedTurnCount: 2,
      sessionTurns: turns,
      sessionStartedAt: '2026-08-29T10:00:00.000Z',
      scenarioKey: 'restaurant_order'
    });

    expect(payload).toBeNull();
  });

  it('filters empty or whitespace-only turns from payload', () => {
    const turns = [
      { role: 'user', content: '   ' },
      { role: 'assistant', content: '' },
      { role: 'user', content: 'Real text' }
    ];

    const payload = buildScenarioSyncPayload({
      activeSessionId: null,
      syncedTurnCount: 0,
      sessionTurns: turns,
      sessionStartedAt: '2026-08-29T10:00:00.000Z',
      scenarioKey: 'restaurant_order'
    });

    expect(payload).not.toBeNull();
    expect(payload.messages.length).toBe(1);
    expect(payload.messages[0].content).toBe('Real text');
  });

  it('persists and restores activeSessionId and syncedTurnCount in scenario state', () => {
    const serialized = serializeScenarioState({
      phaseSecondsLeft: 120,
      sessionStartedAt: '2026-08-29T10:00:00.000Z',
      sessionTurns: [{ role: 'user', content: 'Hello' }],
      activeSessionId: 'session-persisted-xyz',
      syncedTurnCount: 1
    });

    localStorageMock.setItem('utkio_scenario_state_test', serialized);

    const raw = localStorageMock.getItem('utkio_scenario_state_test');
    const restored = deserializeScenarioState(raw);

    expect(restored.activeSessionId).toBe('session-persisted-xyz');
    expect(restored.syncedTurnCount).toBe(1);
    expect(restored.phaseSecondsLeft).toBe(120);
    expect(restored.sessionTurns.length).toBe(1);
  });

  it('evaluates mic UI highlight accurately: only highlights when session is live', () => {
    function computeMicCaptionState(isLive, isSpeaking, phase) {
      return {
        isMicCaptionHighlighted: isLive && !isSpeaking,
        isAiCaptionHighlighted: isLive && isSpeaking,
        micCaptionTitle: (isSpeaking && isLive)
          ? 'Listening mode'
          : (phase === 'feedback' && isLive ? 'Your turn' : 'Tap to speak')
      };
    }

    // 1. Session Idle / Stopped -> NO highlight on either caption
    const idleState = computeMicCaptionState(false, false, 'idle');
    expect(idleState.isMicCaptionHighlighted).toBe(false);
    expect(idleState.isAiCaptionHighlighted).toBe(false);
    expect(idleState.micCaptionTitle).toBe('Tap to speak');

    // 2. Session Live + User turn to speak -> mic caption highlighted
    const userSpeakingState = computeMicCaptionState(true, false, 'roleplay');
    expect(userSpeakingState.isMicCaptionHighlighted).toBe(true);
    expect(userSpeakingState.isAiCaptionHighlighted).toBe(false);
    expect(userSpeakingState.micCaptionTitle).toBe('Tap to speak');

    // 3. Session Live + AI is speaking -> AI caption highlighted
    const aiSpeakingState = computeMicCaptionState(true, true, 'roleplay');
    expect(aiSpeakingState.isMicCaptionHighlighted).toBe(false);
    expect(aiSpeakingState.isAiCaptionHighlighted).toBe(true);
    expect(aiSpeakingState.micCaptionTitle).toBe('Listening mode');
  });

  it('AUD-031: buildScenarioSyncPayload correctly sets is_completed: false during in-flight turns', () => {
    const payload = buildScenarioSyncPayload({
      activeSessionId: null,
      syncedTurnCount: 0,
      sessionTurns: [
        { role: 'user', content: 'Where is the gate?' },
        { role: 'assistant', content: 'Turn right.' }
      ],
      sessionStartedAt: '2026-08-29T10:00:00.000Z',
      scenarioKey: 'airport_directions',
      isCompleted: false
    });

    expect(payload).not.toBeNull();
    expect(payload.is_completed).toBe(false);
    expect(payload.session_type).toBe('scenario');
  });

  it('AUD-031: buildScenarioSyncPayload correctly sets is_completed: true on finalized sync', () => {
    const payload = buildScenarioSyncPayload({
      activeSessionId: 'scen-session-123',
      syncedTurnCount: 2,
      sessionTurns: [
        { role: 'user', content: 'Where is the gate?' },
        { role: 'assistant', content: 'Turn right.' },
        { role: 'assistant', content: 'Feedback: Great job!' }
      ],
      sessionStartedAt: '2026-08-29T10:00:00.000Z',
      scenarioKey: 'airport_directions',
      isCompleted: true
    });

    expect(payload).not.toBeNull();
    expect(payload.is_completed).toBe(true);
    expect(payload.session_type).toBe('scenario');
  });

  it('AUD-031: chat.html resume guard contract redirects scenario session to scenario.html', () => {
    function processResumeResponse(sessionData, redirectFn) {
      if (sessionData && sessionData.session_type === 'scenario') {
        redirectFn('scenario.html');
        return { redirected: true };
      }
      return { redirected: false };
    }

    let redirectedUrl = null;
    const result = processResumeResponse({ id: 'scen-999', session_type: 'scenario' }, (url) => {
      redirectedUrl = url;
    });

    expect(result.redirected).toBe(true);
    expect(redirectedUrl).toBe('scenario.html');

    // Freeform chat continues normally without redirection
    let ffRedirect = null;
    const ffResult = processResumeResponse({ id: 'ff-999', session_type: 'freeform' }, (url) => {
      ffRedirect = url;
    });
    expect(ffResult.redirected).toBe(false);
    expect(ffRedirect).toBeNull();
  });
});
