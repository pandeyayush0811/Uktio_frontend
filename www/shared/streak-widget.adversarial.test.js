import './config.js';
import { describe, it, expect } from 'vitest';
import { groupSessionsByDate } from './history-grouping.js';
import { formatDuration } from './formatters.js';

describe('Frontend Adversarial Suite — Issue #6 (AUD-006: History Grouping & Practice Streak Session Formatting)', () => {
  const refNow = new Date('2026-08-29T12:00:00.000Z');

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 1: Scale & Unbounded Session History on Client
  // ─────────────────────────────────────────────────────────────────────────

  it('test_handles_massive_history_of_1000_sessions_without_blocking_ui', () => {
    // Why this matters: Power learners viewing history list must not freeze the WebView.
    const sessions = Array.from({ length: 1000 }, (_, i) => ({
      id: `session-${i}`,
      started_at: new Date(refNow.getTime() - i * 3600 * 1000).toISOString(),
      turn_count: 8
    }));

    const startTime = performance.now();
    const grouped = groupSessionsByDate(sessions, refNow);
    const elapsedMs = performance.now() - startTime;

    expect(grouped.length).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(100); // Under 100ms on mobile webview
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 2: Dirty Data, Corrupted Timestamps & Fail-Safe Fallbacks
  // ─────────────────────────────────────────────────────────────────────────

  it('test_corrupted_session_timestamps_never_dropped_placed_in_earlier', () => {
    // Why this matters: If a timestamp is corrupted (e.g. "invalid-date", null, 0), session must still be accessible.
    const sessions = [
      { id: 'good-today', started_at: '2026-08-29T10:00:00.000Z' },
      { id: 'corrupted-1', started_at: 'garbage-date-format' },
      { id: 'corrupted-2', started_at: null },
      { id: 'corrupted-3', started_at: '' }
    ];

    const grouped = groupSessionsByDate(sessions, refNow);
    const earlierBucket = grouped.find(b => b.label === 'Earlier');
    expect(earlierBucket).toBeDefined();
    expect(earlierBucket.items.map(s => s.id)).toEqual(['corrupted-1', 'corrupted-2', 'corrupted-3']);
  });

  it('test_future_timestamps_from_skewed_phone_clock_bucketed_in_today', () => {
    // Why this matters: User phone clock is 2 hours ahead of server.
    const futureSession = { id: 'future-1', started_at: new Date(refNow.getTime() + 7200000).toISOString() };
    const grouped = groupSessionsByDate([futureSession], refNow);

    expect(grouped[0].label).toBe('Today');
    expect(grouped[0].items[0].id).toBe('future-1');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SUITE 3: Session Duration & Formatting Boundary Stress
  // ─────────────────────────────────────────────────────────────────────────

  it('test_format_duration_boundary_values', () => {
    const t0 = new Date('2026-08-29T10:00:00.000Z');

    // 0 seconds
    expect(formatDuration(t0, t0)).toBe('0 sec');

    // Negative interval (backward clock jump)
    const tMinus45 = new Date('2026-08-29T09:59:15.000Z');
    expect(formatDuration(t0, tMinus45)).toBe('0 sec');

    // Exact 59 seconds
    const t59 = new Date('2026-08-29T10:00:59.000Z');
    expect(formatDuration(t0, t59)).toBe('59 sec');

    // Exact 1 minute (60 seconds)
    const t60 = new Date('2026-08-29T10:01:00.000Z');
    expect(formatDuration(t0, t60)).toBe('1 min 0 sec');

    // Multi-minute session (3 min 20 sec = 200 seconds)
    const t200 = new Date('2026-08-29T10:03:20.000Z');
    expect(formatDuration(t0, t200)).toBe('3 min 20 sec');
  });
});
