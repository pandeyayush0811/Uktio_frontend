import { describe, it, expect } from 'vitest';
import { DEFAULT_LIVE_MODEL, GOOGLE_WEB_CLIENT_ID } from './config.js';
import { LIVE_MODEL } from './voice-live-session.js';

describe('Configuration Centralization', () => {
  it('DEFAULT_LIVE_MODEL is a non-empty valid model string', () => {
    expect(DEFAULT_LIVE_MODEL).toBeDefined();
    expect(typeof DEFAULT_LIVE_MODEL).toBe('string');
    expect(DEFAULT_LIVE_MODEL).toContain('gemini');
  });

  it('LIVE_MODEL matches DEFAULT_LIVE_MODEL as single source of truth', () => {
    expect(LIVE_MODEL).toBe(DEFAULT_LIVE_MODEL);
  });

  it('GOOGLE_WEB_CLIENT_ID is exported and contains a valid Google Client ID', () => {
    expect(GOOGLE_WEB_CLIENT_ID).toBeDefined();
    expect(typeof GOOGLE_WEB_CLIENT_ID).toBe('string');
    expect(GOOGLE_WEB_CLIENT_ID).toContain('apps.googleusercontent.com');
  });
});
