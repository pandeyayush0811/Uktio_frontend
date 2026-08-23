import { describe, it, expect } from 'vitest';
import { formatDuration, looksLikeIndianMobile } from './formatters.js';

describe('shared/formatters', () => {
  describe('formatDuration', () => {
    it('formats seconds under a minute', () => {
      expect(formatDuration('2026-08-24T00:00:00Z', '2026-08-24T00:00:45Z')).toBe('45 sec');
      expect(formatDuration('2026-08-24T00:00:00Z', '2026-08-24T00:00:00Z')).toBe('0 sec');
    });

    it('formats minutes and seconds correctly', () => {
      expect(formatDuration('2026-08-24T00:00:00Z', '2026-08-24T00:03:05Z')).toBe('3 min 5 sec');
      expect(formatDuration('2026-08-24T00:00:00Z', '2026-08-24T00:02:00Z')).toBe('2 min 0 sec');
    });
  });

  describe('looksLikeIndianMobile', () => {
    it('returns true for valid 10-digit Indian numbers', () => {
      expect(looksLikeIndianMobile('9876543210')).toBe(true);
      expect(looksLikeIndianMobile('8123456789')).toBe(true);
      expect(looksLikeIndianMobile('7000000000')).toBe(true);
      expect(looksLikeIndianMobile('6111111111')).toBe(true);
      expect(looksLikeIndianMobile(' 98765 43210 ')).toBe(true);
      expect(looksLikeIndianMobile('98765-43210')).toBe(true);
    });

    it('returns false for invalid numbers', () => {
      expect(looksLikeIndianMobile('')).toBe(false);
      expect(looksLikeIndianMobile(null)).toBe(false);
      expect(looksLikeIndianMobile('5123456789')).toBe(false);
      expect(looksLikeIndianMobile('98765')).toBe(false);
      expect(looksLikeIndianMobile('987654321012')).toBe(false);
      expect(looksLikeIndianMobile('abcdefghij')).toBe(false);
    });
  });
});
