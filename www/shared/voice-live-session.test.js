import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

let mockListeners = {};
const mockMicPlugin = {
  addListener: vi.fn((event, cb) => {
    mockListeners[event] = cb;
    return Promise.resolve({ remove: vi.fn() });
  }),
  start: vi.fn(() => Promise.resolve()),
  stop: vi.fn(() => Promise.resolve()),
  startKeepAlive: vi.fn(() => Promise.resolve()),
  stopKeepAlive: vi.fn(() => Promise.resolve()),
};

vi.mock('./mic-helpers.js', () => ({
  getApiKey: vi.fn().mockResolvedValue('test-key-123'),
  getMicCapturePlugin: () => mockMicPlugin
}));

vi.mock('./gemini-key-check.js', () => ({
  checkGeminiApiKey: vi.fn().mockResolvedValue({ status: 'valid' })
}));

vi.mock('./network-status.js', () => ({
  isOnline: vi.fn().mockResolvedValue(true)
}));

import { createAudioPlayer, createVoiceSession } from './voice-live-session.js';

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

describe('createVoiceSession interruption handling', () => {
  beforeEach(() => {
    globalThis.AudioContext = MockAudioContext;
    globalThis.window = {
      Capacitor: {
        Plugins: {
          MicCapture: mockMicPlugin
        }
      }
    };
    mockListeners = {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('triggers onInterrupted callback and stops session when interrupted event is received', async () => {
    const onInterruptedMock = vi.fn();
    const onStatusMock = vi.fn();

    const voice = createVoiceSession({
      getSystemInstruction: () => 'Test instruction',
      callbacks: {
        onInterrupted: onInterruptedMock,
        onStatus: onStatusMock
      }
    });

    const mockSession = {
      sendRealtimeInput: vi.fn(),
      close: vi.fn()
    };

    class MockGoogleGenAI {
      constructor() {
        this.live = {
          connect: vi.fn().mockImplementation(async (config) => {
            if (config.callbacks && config.callbacks.onopen) {
              config.callbacks.onopen();
            }
            return mockSession;
          })
        };
      }
    }

    const result = await voice.start({
      GoogleGenAI: MockGoogleGenAI,
      Modality: { AUDIO: 'AUDIO' }
    });

    expect(result.ok).toBe(true);
    expect(voice.isActive()).toBe(true);
    expect(mockListeners['interrupted']).toBeDefined();

    // Simulate incoming phone call / audio focus loss
    mockListeners['interrupted']({ reason: 'audio_focus_loss', focusChange: -1 });

    expect(onInterruptedMock).toHaveBeenCalledWith({ reason: 'audio_focus_loss', focusChange: -1 });
    expect(voice.isActive()).toBe(false);
    expect(mockMicPlugin.stop).toHaveBeenCalled();
    expect(mockMicPlugin.stopKeepAlive).toHaveBeenCalled();
  });
});

