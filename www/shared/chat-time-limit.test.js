import { describe, it, expect } from 'vitest';

const DAILY_CHAT_LIMIT_SECONDS = 10 * 60; // 600 seconds

function formatTimeMMSS(sec) {
  const s = Math.max(0, Math.floor(sec));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function calculatePracticeLimitState(todayUsedSec, currentLegSec = 0) {
  const total = Math.min(DAILY_CHAT_LIMIT_SECONDS, todayUsedSec + currentLegSec);
  const remaining = Math.max(0, DAILY_CHAT_LIMIT_SECONDS - total);
  const isWarning = remaining <= 60 && remaining > 0;
  const isExhausted = remaining <= 0;

  return {
    total,
    remaining,
    isWarning,
    isExhausted,
    displayText: `⏱️ Practice: ${formatTimeMMSS(total)} / 10:00`
  };
}

describe('Cumulative Daily 10-Minute Chat Cap', () => {
  it('formats MM:SS correctly', () => {
    expect(formatTimeMMSS(0)).toBe('0:00');
    expect(formatTimeMMSS(45)).toBe('0:45');
    expect(formatTimeMMSS(60)).toBe('1:00');
    expect(formatTimeMMSS(275)).toBe('4:35');
    expect(formatTimeMMSS(600)).toBe('10:00');
    expect(formatTimeMMSS(-10)).toBe('0:00');
  });

  it('calculates remaining practice time from prior legs and current leg', () => {
    // User spoke 4 minutes (240s) earlier, now speaking for 2 minutes (120s)
    const state = calculatePracticeLimitState(240, 120);
    expect(state.total).toBe(360);
    expect(state.remaining).toBe(240);
    expect(state.isWarning).toBe(false);
    expect(state.isExhausted).toBe(false);
    expect(state.displayText).toBe('⏱️ Practice: 6:00 / 10:00');
  });

  it('triggers warning when remaining time is 60 seconds or less', () => {
    const state = calculatePracticeLimitState(540, 0); // 9 minutes used, 1 min left
    expect(state.remaining).toBe(60);
    expect(state.isWarning).toBe(true);
    expect(state.isExhausted).toBe(false);
  });

  it('triggers exhausted when reaching the 10-minute cap (600s)', () => {
    const state = calculatePracticeLimitState(500, 100);
    expect(state.total).toBe(600);
    expect(state.remaining).toBe(0);
    expect(state.isWarning).toBe(false);
    expect(state.isExhausted).toBe(true);
    expect(state.displayText).toBe('⏱️ Practice: 10:00 / 10:00');
  });
});
