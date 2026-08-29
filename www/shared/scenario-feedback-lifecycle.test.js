import { describe, it, expect } from 'vitest';

const MAX_FEEDBACK_EXCHANGES = 3;
const FEEDBACK_SILENCE_TIMEOUT_MS = 90 * 1000;

function evaluateFeedbackProgress(currentExchanges, silenceElapsedMs = 0) {
  const isMaxReached = currentExchanges >= MAX_FEEDBACK_EXCHANGES;
  const isSilenceTimeout = silenceElapsedMs >= FEEDBACK_SILENCE_TIMEOUT_MS;
  const shouldAutoFinish = isMaxReached || isSilenceTimeout;

  return {
    currentExchanges,
    remainingExchanges: Math.max(0, MAX_FEEDBACK_EXCHANGES - currentExchanges),
    shouldAutoFinish,
    reason: isMaxReached ? 'max_exchanges' : (isSilenceTimeout ? 'silence_timeout' : null)
  };
}

describe('Scenario Feedback Phase Lifecycle (Q&A Budget & Silence Guard)', () => {
  it('allows user to ask follow-up questions up to the max exchange limit', () => {
    // Initial feedback turn (exchange 1)
    let p = evaluateFeedbackProgress(1);
    expect(p.shouldAutoFinish).toBe(false);
    expect(p.remainingExchanges).toBe(2);

    // User asks 1st follow up doubt (exchange 2)
    p = evaluateFeedbackProgress(2);
    expect(p.shouldAutoFinish).toBe(false);
    expect(p.remainingExchanges).toBe(1);

    // User asks 2nd follow up doubt (exchange 3 - final)
    p = evaluateFeedbackProgress(3);
    expect(p.shouldAutoFinish).toBe(true);
    expect(p.reason).toBe('max_exchanges');
  });

  it('triggers auto-finish only after 90 seconds of inactivity post-feedback', () => {
    // 30 seconds of silence -> still keep listening/reading
    let p = evaluateFeedbackProgress(1, 30000);
    expect(p.shouldAutoFinish).toBe(false);

    // 90 seconds of silence -> auto complete scenario
    p = evaluateFeedbackProgress(1, 90000);
    expect(p.shouldAutoFinish).toBe(true);
    expect(p.reason).toBe('silence_timeout');
  });
});
