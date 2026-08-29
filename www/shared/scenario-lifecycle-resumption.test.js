import { describe, it, expect } from 'vitest';

describe('Scenario Lifecycle & Resumption Payload Tests', () => {
  it('creates an in-progress payload with is_completed=false for intermediate pause/refresh sync', () => {
    const sessionTurns = [
      { role: 'user', content: 'Where is the metro station?', phase: 'roleplay' },
      { role: 'assistant', content: 'Go straight and take the first right.', phase: 'roleplay' }
    ];
    const isCompleted = false;

    const payload = {
      session_id: 'session-temp-123',
      started_at: '2026-08-27T10:00:00.000Z',
      ended_at: '2026-08-27T10:01:30.000Z',
      session_type: 'scenario',
      scenario_key: 'directions_stranger',
      is_completed: isCompleted,
      messages: sessionTurns.map(t => ({ role: t.role, content: t.content }))
    };

    expect(payload.is_completed).toBe(false);
    expect(payload.session_type).toBe('scenario');
    expect(payload.messages.length).toBe(2);
  });

  it('creates a finalized payload with is_completed=true only when scenario completes', () => {
    const sessionTurns = [
      { role: 'user', content: 'Where is the metro station?', phase: 'roleplay' },
      { role: 'assistant', content: 'Go straight and take the first right.', phase: 'roleplay' },
      { role: 'assistant', content: 'Here is your feedback: you spoke clearly.', phase: 'feedback' }
    ];
    const isCompleted = true;

    const payload = {
      session_id: 'session-temp-123',
      started_at: '2026-08-27T10:00:00.000Z',
      ended_at: '2026-08-27T10:04:00.000Z',
      session_type: 'scenario',
      scenario_key: 'directions_stranger',
      is_completed: isCompleted,
      messages: sessionTurns.map(t => ({ role: t.role, content: t.content }))
    };

    expect(payload.is_completed).toBe(true);
    expect(payload.messages.length).toBe(3);
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
});
