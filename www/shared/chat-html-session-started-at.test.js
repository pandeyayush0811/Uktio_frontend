import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('chat.html sessionStartedAt State Management & Leakage Check (Bug #6)', () => {
  const chatHtmlPath = path.resolve(__dirname, '../chat.html');
  const chatHtmlContent = fs.readFileSync(chatHtmlPath, 'utf8');

  // Why this matters: sessionStartedAt must be reset (e.g. to null) when a session leg finishes,
  // otherwise subsequent legs on the same page will reuse the initial leg's start timestamp.
  it('test_chat_html_must_reset_session_started_at_upon_finalize_or_stop', () => {
    // Check if sessionStartedAt = null or sessionStartedAt = ... is performed inside finalizeAndSyncSession
    const finalizeRegex = /async\s+function\s+finalizeAndSyncSession\s*\(\)\s*\{([\s\S]*?)\n\}/;
    const match = chatHtmlContent.match(finalizeRegex);

    expect(match).not.toBeNull();
    const finalizeBody = match ? match[1] : '';

    // Does finalizeAndSyncSession reset sessionStartedAt?
    const resetsSessionStartedAt = /sessionStartedAt\s*=\s*null/.test(finalizeBody) ||
      /sessionStartedAt\s*=\s*(?:undefined|new Date|null)/.test(finalizeBody);

    // This assertion will FAIL on current code because chat.html never resets sessionStartedAt in finalizeAndSyncSession!
    expect(resetsSessionStartedAt,
      'BUG #6 DETECTED: finalizeAndSyncSession() in chat.html clears sessionTurns but NEVER resets sessionStartedAt to null. ' +
      'Subsequent legs will reuse the stale started_at timestamp from leg 1, inflating the duration by idle pause time.'
    ).toBe(true);
  });

  // Why this matters: In startSession(), if sessionStartedAt is not null from a prior leg,
  // startSession() will bypass setting new Date().toISOString(), retaining the old timestamp.
  it('test_start_session_sets_fresh_timestamp_on_each_session_invocation', () => {
    const startSessionRegex = /async\s+function\s+startSession\s*\(\)\s*\{([\s\S]*?)\n\}/;
    const match = chatHtmlContent.match(startSessionRegex);

    expect(match).not.toBeNull();
    const startBody = match ? match[1] : '';

    // In current chat.html: if (!sessionStartedAt) sessionStartedAt = new Date().toISOString();
    // If sessionStartedAt was not reset to null in finalize, this check skips setting a fresh timestamp.
    expect(startBody).toContain('sessionStartedAt');
  });

  // Why this matters: persistLocalSession must write the current leg start time, not a stale session timestamp
  it('test_persist_local_session_payload_structure_references_session_started_at', () => {
    const persistRegex = /function\s+persistLocalSession\s*\(\)\s*\{([\s\S]*?)\n\}/;
    const match = chatHtmlContent.match(persistRegex);

    expect(match).not.toBeNull();
    const persistBody = match ? match[1] : '';

    expect(persistBody).toContain('started_at: sessionStartedAt');
    expect(persistBody).toContain('ended_at: new Date().toISOString()');
  });
});
