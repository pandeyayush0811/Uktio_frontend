import { describe, it, expect } from 'vitest';
import { formatTrialTimeLeft } from './trial-time.js';

describe('formatTrialTimeLeft', () => {
  it('rounds 2.9 up to a clean "3 days left" instead of showing the decimal', () => {
    expect(formatTrialTimeLeft(2.9)).toBe('3 days left');
  });

  it('shows a whole number with no trailing ".0" when already exact', () => {
    expect(formatTrialTimeLeft(2.0)).toBe('2 days left');
  });

  it('rounds down when the fraction is below the midpoint', () => {
    expect(formatTrialTimeLeft(2.3)).toBe('2 days left');
  });

  it('uses singular "day" for exactly 1', () => {
    expect(formatTrialTimeLeft(1)).toBe('1 day left');
  });

  it('switches to hours once under 1 full day', () => {
    expect(formatTrialTimeLeft(0.75)).toBe('18 hrs left');
  });

  it('uses singular "hr" for exactly 1 hour', () => {
    expect(formatTrialTimeLeft(1 / 24)).toBe('1 hr left');
  });

  it('falls back to a friendly floor message instead of "0 hrs left"', () => {
    expect(formatTrialTimeLeft(0.01)).toBe('Less than 1 hr left');
  });

  it('clamps negative/expired input to the floor message rather than a negative number', () => {
    expect(formatTrialTimeLeft(-0.5)).toBe('Less than 1 hr left');
  });

  it('treats missing/undefined input safely', () => {
    expect(formatTrialTimeLeft(undefined)).toBe('Less than 1 hr left');
  });
});
