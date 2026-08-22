import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAudioPlayer } from './voice-live-session.js';

class MockAudioContext {
  constructor(options = {}) {
    this.sampleRate = options.sampleRate || 24000;
    this.state = 'suspended';
    this.currentTime = 0;
    this.resumeCalledCount = 0;
    this.closeCalled = false;
  }

  async resume() {
    this.resumeCalledCount += 1;
    this.state = 'running';
    return Promise.resolve();
  }

  createBuffer(channels, length, sampleRate) {
    return {
      duration: length / sampleRate,
      copyToChannel: vi.fn()
    };
  }

  createBufferSource() {
    return {
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    };
  }

  get destination() {
    return {};
  }

  async close() {
    this.closeCalled = true;
    this.state = 'closed';
    return Promise.resolve();
  }
}

describe('createAudioPlayer auto-resume & lifecycle', () => {
  beforeEach(() => {
    globalThis.AudioContext = MockAudioContext;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('open() resumes context if initially suspended', async () => {
    const player = createAudioPlayer();
    await player.open();
    const ctx = player.getPlayCtx();
    expect(ctx).toBeDefined();
    expect(ctx.state).toBe('running');
    expect(ctx.resumeCalledCount).toBe(1);
    player.close();
  });

  it('playChunk() auto-resumes AudioContext if OS suspended it mid-session', async () => {
    const player = createAudioPlayer();
    await player.open();
    const ctx = player.getPlayCtx();
    expect(ctx.resumeCalledCount).toBe(1);

    // Simulate OS suspending AudioContext due to notification chime or call
    ctx.state = 'suspended';

    // A dummy base64 PCM 16-bit audio chunk (4 zero bytes = 2 samples)
    const base64Chunk = btoa('\x00\x00\x00\x00');
    player.playChunk(base64Chunk);

    expect(ctx.resumeCalledCount).toBe(2);
    expect(ctx.state).toBe('running');
    player.close();
  });

  it('close() stops audio sources and closes AudioContext', async () => {
    const player = createAudioPlayer();
    await player.open();
    const ctx = player.getPlayCtx();
    player.close();
    expect(ctx.closeCalled).toBe(true);
    expect(player.getPlayCtx()).toBeNull();
  });
});
