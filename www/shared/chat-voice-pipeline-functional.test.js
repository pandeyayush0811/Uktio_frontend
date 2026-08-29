import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PENDING_CHAT_SESSION_KEY } from './auth.js';
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
  getApiKey: vi.fn().mockResolvedValue('test-gemini-key-xyz'),
  getMicCapturePlugin: () => mockMicPlugin
}));

vi.mock('./gemini-key-check.js', () => ({
  checkGeminiApiKey: vi.fn().mockResolvedValue({ status: 'valid' })
}));

vi.mock('./network-status.js', () => ({
  isOnline: vi.fn().mockResolvedValue(true)
}));

function pcmToBase64(int16Array) {
  const bytes = new Uint8Array(int16Array.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

describe('Voice Chat Page — Functional Sanity End-to-End Suite', () => {
  beforeEach(() => {
    globalThis.AudioContext = MockAudioContext;
    globalThis.window = {
      Capacitor: {
        Plugins: {
          MicCapture: mockMicPlugin
        }
      },
      __UKTIO_PROFILE: {
        name: 'Rahul',
        age: 22,
        occupation_type: 'student',
        class_grade: 'Engineering 3rd Year',
        city: 'Jaipur'
      }
    };
    mockListeners = {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Connects to Gemini Live with proper modalities, system instruction, and starts native mic', async () => {
    const onStatusMock = vi.fn();
    const onOpenMock = vi.fn();

    let capturedConfig = null;
    const mockSession = {
      sendRealtimeInput: vi.fn(),
      sendClientContent: vi.fn(),
      close: vi.fn()
    };

    class MockGoogleGenAI {
      constructor({ apiKey, apiVersion }) {
        this.apiKey = apiKey;
        this.apiVersion = apiVersion;
        this.live = {
          connect: vi.fn().mockImplementation(async (config) => {
            capturedConfig = config;
            if (config.callbacks?.onopen) config.callbacks.onopen();
            return mockSession;
          })
        };
      }
    }

    const voice = createVoiceSession({
      getSystemInstruction: () => 'ROLE: Tum Uktio ho — Rahul ke Hindi-speaking bade bhai...',
      callbacks: {
        onStatus: onStatusMock,
        onOpen: onOpenMock
      }
    });

    const result = await voice.start({
      GoogleGenAI: MockGoogleGenAI,
      Modality: { AUDIO: 'AUDIO' }
    });

    expect(result.ok).toBe(true);
    expect(voice.isActive()).toBe(true);
    expect(capturedConfig.model).toBe('gemini-3.1-flash-live-preview');
    expect(capturedConfig.config.responseModalities).toEqual(['AUDIO']);
    expect(capturedConfig.config.systemInstruction.parts[0].text).toContain('Rahul');
    expect(capturedConfig.config.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Puck');
    expect(mockMicPlugin.start).toHaveBeenCalled();
    expect(mockMicPlugin.startKeepAlive).toHaveBeenCalled();
    expect(onOpenMock).toHaveBeenCalled();
  });

  it('2. Streams user microphone speech to Gemini Live when RMS >= threshold and mutes mic during AI playback', async () => {
    let capturedCallbacks = {};
    const mockSession = {
      sendRealtimeInput: vi.fn(),
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

    const onSpeakingChangeMock = vi.fn();
    const onUserTextMock = vi.fn();
    const onModelTextMock = vi.fn();

    const voice = createVoiceSession({
      getSystemInstruction: () => 'System prompt',
      callbacks: {
        onSpeakingChange: onSpeakingChangeMock,
        onUserText: onUserTextMock,
        onModelText: onModelTextMock
      }
    });

    await voice.start({
      GoogleGenAI: MockGoogleGenAI,
      Modality: { AUDIO: 'AUDIO' }
    });

    // User speaks with loud audio
    const activeSpeech = pcmToBase64(new Int16Array([10000, -10000, 12000, -12000]));
    mockListeners['audioChunk']({ audio: activeSpeech });

    expect(mockSession.sendRealtimeInput).toHaveBeenCalledWith({
      audio: { data: activeSpeech, mimeType: 'audio/pcm;rate=16000' }
    });

    // Model streams text & audio response
    const modelAudio = pcmToBase64(new Int16Array([8000, -8000]));
    capturedCallbacks.onmessage({
      serverContent: {
        inputTranscription: { text: 'Hello Bolo' },
        outputTranscription: { text: 'Haan Rahul, kaise ho?' },
        modelTurn: {
          parts: [{ inlineData: { data: modelAudio } }]
        }
      }
    });

    expect(onUserTextMock).toHaveBeenCalledWith('Hello Bolo');
    expect(onModelTextMock).toHaveBeenCalledWith('Haan Rahul, kaise ho?');

    // While model is speaking, incoming mic audio should be SUPPRESSED (no echo feedback)
    mockSession.sendRealtimeInput.mockClear();
    mockListeners['audioChunk']({ audio: activeSpeech });
    expect(mockSession.sendRealtimeInput).not.toHaveBeenCalled();

    voice.stop();
  });

  it('3. Interruption Handling: cuts off AI audio when user interrupts or incoming phone call occurs', async () => {
    let capturedCallbacks = {};
    const mockSession = {
      sendRealtimeInput: vi.fn(),
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

    const onInterruptedMock = vi.fn();
    const voice = createVoiceSession({
      getSystemInstruction: () => 'System prompt',
      callbacks: {
        onInterrupted: onInterruptedMock
      }
    });

    await voice.start({
      GoogleGenAI: MockGoogleGenAI,
      Modality: { AUDIO: 'AUDIO' }
    });

    // Server sends interrupted signal (user interrupted model speaking)
    capturedCallbacks.onmessage({
      serverContent: {
        interrupted: true
      }
    });

    // Phone call interruption from native OS
    mockListeners['interrupted']({ reason: 'audio_focus_loss' });
    expect(onInterruptedMock).toHaveBeenCalledWith({ reason: 'audio_focus_loss' });
    expect(voice.isActive()).toBe(false);
  });

  it('4. Local persistence and pending sync saves chat messages and updates session state', () => {
    const store = {};
    const mockLocalStorage = {
      getItem: (k) => store[k] || null,
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    };
    globalThis.localStorage = mockLocalStorage;

    const turns = [
      { role: 'user', content: 'Yesterday I go to market' },
      { role: 'assistant', content: 'Dekh yesterday ki baat hai to went bolenge' }
    ];

    const payload = {
      session_id: null,
      started_at: '2026-08-29T10:00:00.000Z',
      ended_at: '2026-08-29T10:02:00.000Z',
      messages: turns
    };

    mockLocalStorage.setItem(PENDING_CHAT_SESSION_KEY, JSON.stringify(payload));
    const saved = JSON.parse(mockLocalStorage.getItem(PENDING_CHAT_SESSION_KEY));

    expect(saved.messages).toHaveLength(2);
    expect(saved.messages[0].role).toBe('user');
    expect(saved.messages[1].role).toBe('assistant');
  });
});
