import { describe, it, expect } from 'vitest';
import { DEFAULT_LIVE_MODEL } from './config.js';
import { LIVE_MODEL } from './voice-live-session.js';

describe('Gemini Live Model Centralization', () => {
  it('DEFAULT_LIVE_MODEL is a non-empty valid model string', () => {
    expect(DEFAULT_LIVE_MODEL).toBeDefined();
    expect(typeof DEFAULT_LIVE_MODEL).toBe('string');
    expect(DEFAULT_LIVE_MODEL).toContain('gemini');
  });

  it('LIVE_MODEL matches DEFAULT_LIVE_MODEL as single source of truth', () => {
    expect(LIVE_MODEL).toBe(DEFAULT_LIVE_MODEL);
  });
});
