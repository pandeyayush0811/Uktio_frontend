import { describe, it, expect } from 'vitest';
import { groupSessionsByDate } from './history-grouping.js';

const NOW = new Date('2026-08-16T15:00:00');

describe('groupSessionsByDate', () => {
  it('returns an empty array for no sessions', () => {
    expect(groupSessionsByDate([], NOW)).toEqual([]);
  });

  it('returns an empty array for null/undefined input instead of throwing', () => {
    expect(groupSessionsByDate(undefined, NOW)).toEqual([]);
    expect(groupSessionsByDate(null, NOW)).toEqual([]);
  });

  it('buckets a same-day session under "Today"', () => {
    const sessions = [{ id: 1, started_at: '2026-08-16T09:00:00' }];
    const result = groupSessionsByDate(sessions, NOW);
    expect(result).toEqual([{ label: 'Today', items: sessions }]);
  });

  it('buckets exactly one calendar day back under "Yesterday"', () => {
    const sessions = [{ id: 1, started_at: '2026-08-15T22:00:00' }];
    const result = groupSessionsByDate(sessions, NOW);
    expect(result[0].label).toBe('Yesterday');
  });

  it('buckets 2-7 calendar days back under "This week"', () => {
    const sessions = [
      { id: 1, started_at: '2026-08-14T09:00:00' }, // 2 days back
      { id: 2, started_at: '2026-08-09T09:00:00' }, // 7 days back
    ];
    const result = groupSessionsByDate(sessions, NOW);
    expect(result).toEqual([{ label: 'This week', items: sessions }]);
  });

  it('buckets more than 7 calendar days back under "Earlier"', () => {
    const sessions = [{ id: 1, started_at: '2026-08-01T09:00:00' }];
    const result = groupSessionsByDate(sessions, NOW);
    expect(result[0].label).toBe('Earlier');
  });

  it('treats an unparseable date as "Earlier" instead of dropping the session', () => {
    const sessions = [{ id: 1, started_at: 'not-a-date' }];
    const result = groupSessionsByDate(sessions, NOW);
    expect(result).toEqual([{ label: 'Earlier', items: sessions }]);
  });

  it('preserves original (newest-first) order within a bucket', () => {
    const sessions = [
      { id: 1, started_at: '2026-08-16T14:00:00' },
      { id: 2, started_at: '2026-08-16T09:00:00' },
    ];
    const result = groupSessionsByDate(sessions, NOW);
    expect(result[0].items.map((s) => s.id)).toEqual([1, 2]);
  });

  it('only returns non-empty buckets, in Today → Yesterday → This week → Earlier order', () => {
    const sessions = [
      { id: 1, started_at: '2026-08-16T09:00:00' }, // Today
      { id: 2, started_at: '2026-08-01T09:00:00' }, // Earlier
    ];
    const result = groupSessionsByDate(sessions, NOW);
    expect(result.map((b) => b.label)).toEqual(['Today', 'Earlier']);
  });

  it('handles day-boundary edge case just after midnight as "Today", not "Yesterday"', () => {
    const sessions = [{ id: 1, started_at: '2026-08-16T00:05:00' }];
    const result = groupSessionsByDate(sessions, NOW);
    expect(result[0].label).toBe('Today');
  });
});
