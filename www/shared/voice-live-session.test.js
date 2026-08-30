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

import {
  createAudioPlayer,
  createVoiceSession,
  calculatePcmRms,
  describeConnectError,
  describeMicError,
  INACTIVITY_TIMEOUT_MS,
  STAGNANT_TURN_TIMEOUT_MS,
  RMS_SPEECH_THRESHOLD
} from './voice-live-session.js';

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

describe('calculatePcmRms audio energy detection', () => {
  function pcmToBase64(int16Array) {
    const bytes = new Uint8Array(int16Array.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  it('handles null, undefined, empty, or invalid inputs safely', () => {
    expect(calculatePcmRms(null)).toBe(0);
    expect(calculatePcmRms(undefined)).toBe(0);
    expect(calculatePcmRms('')).toBe(0);
    expect(calculatePcmRms('not-valid-base64!!!')).toBe(0);
  });

  it('calculates 0 RMS for pure zero silence', () => {
    const silence = new Int16Array([0, 0, 0, 0, 0, 0]);
    expect(calculatePcmRms(pcmToBase64(silence))).toBe(0);
  });

  it('calculates expected RMS for low ambient noise (below threshold)', () => {
    // Ambient noise ~ 50 / 32768 = 0.0015 RMS
    const ambient = new Int16Array([50, -50, 40, -40, 30, -30]);
    const rms = calculatePcmRms(pcmToBase64(ambient));
    expect(rms).toBeGreaterThan(0);
    expect(rms).toBeLessThan(RMS_SPEECH_THRESHOLD);
  });

  it('calculates expected RMS for active speech (above threshold)', () => {
    // Active speech ~ 10000 / 32768 = 0.30 RMS
    const speech = new Int16Array([10000, -10000, 12000, -12000]);
    const rms = calculatePcmRms(pcmToBase64(speech));
    expect(rms).toBeGreaterThan(RMS_SPEECH_THRESHOLD);
  });
});

describe('createVoiceSession Inactivity & Stagnant Turn Watchdog', () => {
  function pcmToBase64(int16Array) {
    const bytes = new Uint8Array(int16Array.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  beforeEach(() => {
    vi.useFakeTimers();
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
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function setupSession(options = {}) {
    let capturedCallbacks = {};
    const mockSession = {
      sendRealtimeInput: vi.fn(),
      sendClientContent: vi.fn(),
      close: vi.fn()
    };

    class MockGoogleGenAI {
      constructor() {
        this.live = {
          connect: vi.fn().mockImplementation(async (config) => {
            capturedCallbacks = config.callbacks || {};
            if (capturedCallbacks.onopen) capturedCallbacks.onopen();
            return mockSession;
          })
        };
      }
    }

    const onInactivityTimeoutMock = vi.fn();
    const onStatusMock = vi.fn();
    const onOpenMock = vi.fn();
    const onCloseMock = vi.fn();

    const voice = createVoiceSession({
      getSystemInstruction: () => 'Test prompt',
      inactivityTimeoutMs: options.inactivityTimeoutMs || 90000,
      stagnantTurnTimeoutMs: options.stagnantTurnTimeoutMs || 120000,
      callbacks: {
        onInactivityTimeout: onInactivityTimeoutMock,
        onStatus: onStatusMock,
        onOpen: onOpenMock,
        onClose: onCloseMock,
        ...options.callbacks
      }
    });

    return {
      voice,
      mockSession,
      MockGoogleGenAI,
      onInactivityTimeoutMock,
      onStatusMock,
      getCapturedCallbacks: () => capturedCallbacks
    };
  }

  it('triggers inactivity timeout on 90s silence (screen locked / asleep)', async () => {
    const { voice, mockSession, MockGoogleGenAI, onInactivityTimeoutMock } = setupSession();
    await voice.start({ GoogleGenAI: MockGoogleGenAI, Modality: { AUDIO: 'AUDIO' } });

    expect(voice.isActive()).toBe(true);

    // Fast-forward 89 seconds — should still be active
    vi.advanceTimersByTime(89000);
    expect(voice.isActive()).toBe(true);
    expect(onInactivityTimeoutMock).not.toHaveBeenCalled();

    // Advance 2 more seconds (total 91s)
    vi.advanceTimersByTime(2000);
    expect(voice.isActive()).toBe(false);
    expect(mockSession.close).toHaveBeenCalled();
    expect(mockMicPlugin.stop).toHaveBeenCalled();
    expect(mockMicPlugin.stopKeepAlive).toHaveBeenCalled();
    expect(onInactivityTimeoutMock).toHaveBeenCalledWith(expect.objectContaining({ reason: 'silence' }));
  });

  it('resets silence timer when user speaks with RMS above threshold', async () => {
    const { voice, MockGoogleGenAI, onInactivityTimeoutMock } = setupSession({ stagnantTurnTimeoutMs: 300000 });
    await voice.start({ GoogleGenAI: MockGoogleGenAI, Modality: { AUDIO: 'AUDIO' } });

    const speechChunk = pcmToBase64(new Int16Array([10000, -10000, 8000, -8000]));

    // Advance 50s
    vi.advanceTimersByTime(50000);
    expect(voice.isActive()).toBe(true);

    // User speaks at 50s
    mockListeners['audioChunk']({ audio: speechChunk });

    // Advance 50s more (total 100s from start, which exceeds initial 90s, but only 50s from last speech)
    vi.advanceTimersByTime(50000);
    expect(voice.isActive()).toBe(true);
    expect(onInactivityTimeoutMock).not.toHaveBeenCalled();

    // Advance 42s more (92s from last speech) -> should time out due to silence
    vi.advanceTimersByTime(42000);
    expect(voice.isActive()).toBe(false);
    expect(onInactivityTimeoutMock).toHaveBeenCalledWith(expect.objectContaining({ reason: 'silence' }));
  });

  it('resets both silence and stagnant turn timers on turnComplete', async () => {
    const { voice, MockGoogleGenAI, onInactivityTimeoutMock, getCapturedCallbacks } = setupSession();
    await voice.start({ GoogleGenAI: MockGoogleGenAI, Modality: { AUDIO: 'AUDIO' } });

    // Advance 70s
    vi.advanceTimersByTime(70000);
    expect(voice.isActive()).toBe(true);

    // Model completes a turn at 70s
    getCapturedCallbacks().onmessage({ serverContent: { turnComplete: true } });

    // Advance 70s more (total 140s from start, but only 70s from turnComplete)
    vi.advanceTimersByTime(70000);
    expect(voice.isActive()).toBe(true);
    expect(onInactivityTimeoutMock).not.toHaveBeenCalled();

    // Advance 22s more (92s from turnComplete) -> should time out due to silence
    vi.advanceTimersByTime(22000);
    expect(voice.isActive()).toBe(false);
    expect(onInactivityTimeoutMock).toHaveBeenCalledWith(expect.objectContaining({ reason: 'silence' }));
  });

  it('does NOT reset silence timer on low-energy ambient noise', async () => {
    const { voice, MockGoogleGenAI, onInactivityTimeoutMock } = setupSession();
    await voice.start({ GoogleGenAI: MockGoogleGenAI, Modality: { AUDIO: 'AUDIO' } });

    const quietNoiseChunk = pcmToBase64(new Int16Array([10, -10, 5, -5]));

    // Ambient noise arrives continuously every 10s
    for (let i = 0; i < 9; i++) {
      vi.advanceTimersByTime(10000);
      mockListeners['audioChunk']({ audio: quietNoiseChunk });
    }

    // At 90s, despite continuous ambient noise, silence timeout trips
    vi.advanceTimersByTime(1000);
    expect(voice.isActive()).toBe(false);
    expect(onInactivityTimeoutMock).toHaveBeenCalledWith(expect.objectContaining({ reason: 'silence' }));
  });

  it('does NOT timeout while model is speaking', async () => {
    const { voice, MockGoogleGenAI, onInactivityTimeoutMock, getCapturedCallbacks } = setupSession();
    await voice.start({ GoogleGenAI: MockGoogleGenAI, Modality: { AUDIO: 'AUDIO' } });

    // Advance 60s
    vi.advanceTimersByTime(60000);

    // Model turn arrives with audio chunk
    const modelAudio = pcmToBase64(new Int16Array([5000, -5000]));
    getCapturedCallbacks().onmessage({
      serverContent: {
        modelTurn: {
          parts: [{ inlineData: { data: modelAudio } }]
        }
      }
    });

    // Advance 60s more (120s from start)
    vi.advanceTimersByTime(60000);
    expect(voice.isActive()).toBe(true);
    expect(onInactivityTimeoutMock).not.toHaveBeenCalled();
  });

  it('triggers stagnant turn timeout when room chatter continues for 120s without turn completion', async () => {
    const { voice, MockGoogleGenAI, onInactivityTimeoutMock } = setupSession();
    await voice.start({ GoogleGenAI: MockGoogleGenAI, Modality: { AUDIO: 'AUDIO' } });

    const loudChatter = pcmToBase64(new Int16Array([12000, -12000]));

    // Loud room chatter arrives every 40s (so silence timer never hits 90s)
    vi.advanceTimersByTime(40000);
    mockListeners['audioChunk']({ audio: loudChatter });

    vi.advanceTimersByTime(40000);
    mockListeners['audioChunk']({ audio: loudChatter });

    vi.advanceTimersByTime(40000);
    mockListeners['audioChunk']({ audio: loudChatter });

    // At 121s without a turnComplete event, stagnant turn watchdog trips
    vi.advanceTimersByTime(2000);
    expect(voice.isActive()).toBe(false);
    expect(onInactivityTimeoutMock).toHaveBeenCalledWith(expect.objectContaining({ reason: 'stagnant_turn' }));
  });

  it('manual stop clears watchdog and does not trigger onInactivityTimeout', async () => {
    const { voice, MockGoogleGenAI, onInactivityTimeoutMock } = setupSession();
    await voice.start({ GoogleGenAI: MockGoogleGenAI, Modality: { AUDIO: 'AUDIO' } });

    vi.advanceTimersByTime(45000);
    voice.stop();

    expect(voice.isActive()).toBe(false);

    // Advance past 90s
    vi.advanceTimersByTime(60000);
    expect(onInactivityTimeoutMock).not.toHaveBeenCalled();
  });
});

describe('describeConnectError provider brand sanitization', () => {
  it('does not leak "Gemini" or "Google AI Studio" in API key error messages', () => {
    const invalidKeyMsg = describeConnectError(new Error('api_key_invalid'));
    expect(invalidKeyMsg).toBe('Invalid AI key — please check your AI Key in Settings.');
    expect(invalidKeyMsg).not.toContain('Google');
    expect(invalidKeyMsg).not.toContain('Gemini');

    const permMsg = describeConnectError(new Error('permission_denied'));
    expect(permMsg).toBe('This AI key is not authorized for voice sessions — please check your AI Key in Settings.');
    expect(permMsg).not.toContain('Google');
    expect(permMsg).not.toContain('Gemini');

    const quotaMsg = describeConnectError(new Error('resource_exhausted'));
    expect(quotaMsg).toBe('AI usage limit reached — please try again later or check your AI Key in Settings.');
    expect(quotaMsg).not.toContain('Google');
    expect(quotaMsg).not.toContain('Gemini');

    const networkMsg = describeConnectError(new Error('failed to fetch'));
    expect(networkMsg).toBe('Could not connect to voice service — please check your internet connection.');
    expect(networkMsg).not.toContain('Google');
  });
});

describe('createVoiceSession asynchronous initialization & onOpen timing (AUD-030)', () => {
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

  it('guarantees session is active and sendTextTurn succeeds when called inside onOpen callback', async () => {
    const mockSession = {
      sendRealtimeInput: vi.fn(),
      sendClientContent: vi.fn(),
      close: vi.fn()
    };

    let onOpenRan = false;
    let isActiveInsideOnOpen = null;
    let sendTextTurnResultInsideOnOpen = null;

    let voice;
    voice = createVoiceSession({
      getSystemInstruction: () => 'Test instruction',
      callbacks: {
        onOpen: () => {
          onOpenRan = true;
          isActiveInsideOnOpen = voice.isActive();
          sendTextTurnResultInsideOnOpen = voice.sendTextTurn('[Session started. Greet the user warmly]');
        }
      }
    });

    class MockGoogleGenAI {
      constructor() {
        this.live = {
          connect: vi.fn().mockImplementation(async (config) => {
            // Emulate SDK calling onopen callback synchronously before returning session promise
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
    expect(onOpenRan).toBe(true);
    expect(isActiveInsideOnOpen).toBe(true);
    expect(sendTextTurnResultInsideOnOpen).toBe(true);
    expect(mockSession.sendClientContent).toHaveBeenCalledWith({
      turns: [{ role: 'user', parts: [{ text: '[Session started. Greet the user warmly]' }] }],
      turnComplete: true
    });
  });

  it('prevents concurrent start() calls during connection handshake (mutex lock)', async () => {
    const mockSession = {
      sendRealtimeInput: vi.fn(),
      sendClientContent: vi.fn(),
      close: vi.fn()
    };

    class MockDelayedGoogleGenAI {
      constructor() {
        this.live = {
          connect: vi.fn().mockImplementation(async (config) => {
            if (config.callbacks && config.callbacks.onopen) {
              config.callbacks.onopen();
            }
            await new Promise(r => setTimeout(r, 20));
            return mockSession;
          })
        };
      }
    }

    const voice = createVoiceSession({
      getSystemInstruction: () => 'Test instruction'
    });

    const start1Promise = voice.start({
      GoogleGenAI: MockDelayedGoogleGenAI,
      Modality: { AUDIO: 'AUDIO' }
    });

    const start2Promise = voice.start({
      GoogleGenAI: MockDelayedGoogleGenAI,
      Modality: { AUDIO: 'AUDIO' }
    });

    const [res1, res2] = await Promise.all([start1Promise, start2Promise]);
    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(false);
    expect(res2.reason).toBe('already_active');

    voice.stop();
  });
});



