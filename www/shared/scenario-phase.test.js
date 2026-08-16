import { describe, it, expect } from 'vitest';
import { formatCountdown, getPhaseBadgeState } from './scenario-phase.js';

describe('formatCountdown', () => {
  it('formats a full 3-minute start correctly', () => {
    expect(formatCountdown(180)).toBe('3:00');
  });

  it('pads single-digit seconds with a leading zero', () => {
    expect(formatCountdown(65)).toBe('1:05');
  });

  it('formats zero as 0:00', () => {
    expect(formatCountdown(0)).toBe('0:00');
  });

  it('clamps negative values to 0:00 instead of showing a negative time', () => {
    expect(formatCountdown(-5)).toBe('0:00');
  });

  it('handles sub-minute values with no leading minute digit issue', () => {
    expect(formatCountdown(9)).toBe('0:09');
  });

  it('treats missing/undefined input as 0 rather than throwing', () => {
    expect(formatCountdown(undefined)).toBe('0:00');
  });
});

describe('getPhaseBadgeState', () => {
  it('roleplay phase shows "Scene" label, live countdown, and the live css class', () => {
    const state = getPhaseBadgeState('roleplay', 125);
    expect(state).toEqual({ label: 'Scene', value: '2:05', cssClass: 'live' });
  });

  it('feedback phase shows a fixed "Feedback" value and the feedback css class regardless of seconds left', () => {
    const state = getPhaseBadgeState('feedback', 999);
    expect(state).toEqual({ label: 'Mode', value: 'Feedback', cssClass: 'feedback' });
  });

  it('idle phase (pre-session) has no active css class', () => {
    const state = getPhaseBadgeState('idle', 180);
    expect(state).toEqual({ label: 'Scene', value: '3:00', cssClass: '' });
  });

  it('roleplay countdown reaching zero still renders 0:00, not a negative or NaN value', () => {
    const state = getPhaseBadgeState('roleplay', 0);
    expect(state.value).toBe('0:00');
  });
});
