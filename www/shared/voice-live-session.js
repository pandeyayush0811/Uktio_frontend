// Shared Gemini Live API session plumbing: connect/disconnect, native mic
// capture, audio playback scheduling, and the human-readable error
// messages for each failure mode. Extracted out of chat.html's proven
// implementation so a second page (scenario.html) doesn't have to
// re-invent or copy-paste ~300 lines of WebAudio/Capacitor glue.
//
// NOTE: chat.html itself was deliberately NOT migrated to use this module
// as part of this change — it's a working, load-bearing feature, and
// swapping its internals for a new shared module carries real regression
// risk (audio bugs are notoriously easy to introduce and hard to catch
// without a physical device). This module is verbatim-equivalent logic
// to what chat.html already does inline. Recommend migrating chat.html
// onto this module in a follow-up, once scenario.html has proven it out
// in production.

import { getApiKey, getMicCapturePlugin } from './mic-helpers.js';
import { checkGeminiApiKey } from './gemini-key-check.js';
import { DEFAULT_LIVE_MODEL } from './config.js';

// Single source of truth for the Gemini Live API model string.
// Reads from window.UKTIO_CONFIG.LIVE_MODEL if present, with fallback to DEFAULT_LIVE_MODEL.
export const LIVE_MODEL = (typeof window !== 'undefined' && window.UKTIO_CONFIG?.LIVE_MODEL) || DEFAULT_LIVE_MODEL;

// Inactivity & silence thresholds:
// 1. INACTIVITY_TIMEOUT_MS: 90 seconds of silence (neither user nor model speaking)
// 2. STAGNANT_TURN_TIMEOUT_MS: 120 seconds of continuous room chatter / background noise without a completed AI turn
// 3. RMS_SPEECH_THRESHOLD: 0.015 RMS normalized energy (filters out background fan / ambient quiet room noise)
export const INACTIVITY_TIMEOUT_MS = 90 * 1000;
export const STAGNANT_TURN_TIMEOUT_MS = 120 * 1000;
export const RMS_SPEECH_THRESHOLD = 0.015;

function base64ToInt16(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

export function calculatePcmRms(base64Data) {
  if (!base64Data || typeof base64Data !== 'string') return 0;
  try {
    const samples = base64ToInt16(base64Data);
    if (!samples.length) return 0;
    let sumSquares = 0;
    for (let i = 0; i < samples.length; i++) {
      const normalized = samples[i] / 32768;
      sumSquares += normalized * normalized;
    }
    return Math.sqrt(sumSquares / samples.length);
  } catch (e) {
    return 0;
  }
}

export function describeMicError(err) {
  const name = err && err.name;
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError')
    return 'Microphone access was denied. Tap the mic icon in your address bar and select Allow.';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError')
    return 'Microphone not found: no microphone is connected to this device.';
  if (name === 'NotReadableError' || name === 'TrackStartError')
    return 'Could not open the microphone (already retried). If another app is using it, close that app and try again.';
  if (name === 'SecurityError')
    return 'Microphone access blocked: this page must be served over HTTPS to access the microphone.';
  if (name === 'OverconstrainedError')
    return 'Microphone settings could not be matched on this device.';
  return 'Microphone access error: ' + (err && err.message ? err.message : 'unknown reason (' + err + ')');
}

export function describeConnectError(err) {
  const msg = (err && err.message) ? err.message : String(err);
  if (/api key not valid|api_key_invalid|invalid api key/i.test(msg))
    return 'Invalid AI key — please check your AI Key in Settings.';
  if (/quota|resource_exhausted|rate limit/i.test(msg))
    return 'AI usage limit reached — please try again later or check your AI Key in Settings.';
  if (/permission_denied|not authorized/i.test(msg))
    return 'This AI key is not authorized for voice sessions — please check your AI Key in Settings.';
  if (/failed to fetch|network|timeout|ENOTFOUND/i.test(msg))
    return 'Could not connect to voice service — please check your internet connection.';
  if (/model not found|not_found/i.test(msg))
    return 'Voice model is not available for this account/region.';
  return 'Could not connect to voice service: ' + msg;
}

export function describeCloseEvent(e) {
  if (!e) return 'Session closed (no details provided).';
  if (e.code === 1000) return null;
  const reason = e.reason ? (' — ' + e.reason) : ' (server provided no reason)';
  return 'Session closed, code ' + e.code + reason + '.';
}

// Wraps the "audio currently playing" state + WebAudio scheduling queue
// that used to be five separate module-level variables in chat.html —
// bundled into one object so a caller (scenario.html) doesn't have to
// juggle them by hand.
export function createAudioPlayer(onSpeakingChange) {
  let playCtx = null;
  let nextPlayTime = 0;
  let scheduledSources = [];
  let isModelSpeaking = false;
  let onVisibilityChange = null;

  // Fires whenever isModelSpeaking flips, so a caller (scenario.html)
  // can show a real "mic is closed right now because Utkio is talking"
  // state — not just silently drop audio chunks in the background like
  // before. This is what makes the mute/unmute actually VISIBLE to the
  // user, especially important during the phase-2 feedback monologue.
  function setSpeaking(val) {
    if (isModelSpeaking === val) return;
    isModelSpeaking = val;
    if (onSpeakingChange) onSpeakingChange(val);
  }

  function ensureResumed() {
    if (playCtx && playCtx.state === 'suspended') {
      playCtx.resume().catch((e) => {
        console.warn('AudioContext auto-resume failed:', e);
      });
    }
  }

  return {
    async open() {
      const AudioCtxClass = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) ||
                            (typeof globalThis !== 'undefined' && (globalThis.AudioContext || globalThis.webkitAudioContext));
      if (!AudioCtxClass) return;
      playCtx = new AudioCtxClass({ sampleRate: 24000 });
      nextPlayTime = 0;
      // Mobile browsers frequently hand back a context in 'suspended' state,
      // especially if creation happens even a couple of async ticks away
      // from the original user gesture (mic tap). Without this, the whole
      // pipeline "works" — messages arrive, playChunk() runs, no errors —
      // but literally nothing plays. resume() is safe to call even if the
      // context is already 'running'.
      if (playCtx.state === 'suspended') {
        try { await playCtx.resume(); } catch (e) { console.error('AudioContext resume failed', e); }
      }

      // Auto-resume if app becomes visible after backgrounding or screen unlock / notification
      if (typeof document !== 'undefined') {
        onVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            ensureResumed();
          }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
      }
    },
    isModelSpeaking() { return isModelSpeaking; },
    getPlayCtx() { return playCtx; },
    playChunk(base64Data) {
      if (!playCtx) return;

      // Proactively auto-resume AudioContext if OS suspended it mid-session (notification chime, phone call, BT switch)
      ensureResumed();

      try {
        setSpeaking(true);
        const int16 = base64ToInt16(base64Data);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

        const buffer = playCtx.createBuffer(1, float32.length, 24000);
        buffer.copyToChannel(float32, 0);

        const src = playCtx.createBufferSource();
        src.buffer = buffer;
        src.connect(playCtx.destination);

        const now = playCtx.currentTime;
        if (nextPlayTime < now) nextPlayTime = now + 0.05;
        src.start(nextPlayTime);
        nextPlayTime += buffer.duration;
        scheduledSources.push(src);
        src.onended = () => {
          scheduledSources = scheduledSources.filter(s => s !== src);
          if (scheduledSources.length === 0) {
            setTimeout(() => {
              if (scheduledSources.length === 0) setSpeaking(false);
            }, 200);
          }
        };
      } catch (err) {
        console.error('playback error', err);
        throw err;
      }
    },
    stop() {
      scheduledSources.forEach(s => { try { s.stop(); } catch (e) { /* already stopped, ignore */ } });
      scheduledSources = [];
      setSpeaking(false);
      if (playCtx) nextPlayTime = playCtx.currentTime;
    },
    close() {
      this.stop();
      if (onVisibilityChange && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
        onVisibilityChange = null;
      }
      if (playCtx) { try { playCtx.close(); } catch (e) { /* ignore */ } playCtx = null; }
    }
  };
}

// keepAliveActive is module-scoped (not per-instance) because it maps to
// a single native OS-level foreground service — chat.html's original code
// had the same implicit assumption (only one live voice session can be
// active in the app at a time), just expressed as a bare module variable.
let keepAliveActive = false;
async function startKeepAlive() {
  if (keepAliveActive) return;
  keepAliveActive = true;
  try { await getMicCapturePlugin().startKeepAlive(); } catch (e) { /* browser preview or plugin missing — ignore */ }
}
async function stopKeepAlive() {
  if (!keepAliveActive) return;
  keepAliveActive = false;
  try { await getMicCapturePlugin().stopKeepAlive(); } catch (e) { /* ignore */ }
}

// Creates one Live API voice session controller. Mirrors chat.html's
// session lifecycle exactly (same connect() config shape, same
// onopen/onmessage/onerror/onclose wiring, same native-mic start/stop),
// generalized behind callbacks instead of page-global functions/DOM refs.
//
// `getSystemInstruction()` is a FUNCTION, not a string, because
// scenario.html needs to swap in a different instruction on reconnect
// scenarios — matching chat.html's own buildSystemInstruction() being
// called fresh at connect time, not memoized.
//
// callbacks:
//   onStatus(text, mode)              — mode: null | 'live' | 'err'
//   onUserText(text)                  — incremental input transcription
//   onModelText(text)                 — incremental output transcription
// callbacks:
//   onStatus(text, mode)              — mode: null | 'live' | 'err'
//   onUserText(text)                  — incremental input transcription
//   onModelText(text)                 — incremental output transcription
//   onTurnComplete()                  — model finished a turn
//   onOpen()                          — connection established
//   onClose(closeEvent)               — connection ended (any reason)
//   onInterrupted(info)               — session interrupted by incoming call / audio focus loss
//   onSpeakingChange(isSpeaking)      — Utkio started/stopped talking —
//                                        this is the real "mic is
//                                        live-muted right now" signal;
//                                        the mic never actually sends
//                                        audio while this is true (see
//                                        startNativeMic below), so a
//                                        page should mirror this in the
//                                        UI rather than just guessing
//                                        from turn boundaries.
//   onInactivityTimeout(info)         — triggered on 90s silence or 120s stagnant turn
export function createVoiceSession({
  getSystemInstruction,
  voiceName = 'Puck',
  inactivityTimeoutMs = INACTIVITY_TIMEOUT_MS,
  stagnantTurnTimeoutMs = STAGNANT_TURN_TIMEOUT_MS,
  callbacks = {}
}) {
  let session = null;
  let audioPlayer = null;
  let micListenerHandle = null;
  let interruptionListenerHandle = null;
  let isBusy = false;
  let errorAlreadyShown = false;
  let lastActiveTime = Date.now();
  let lastTurnTime = Date.now();
  let watchdogIntervalHandle = null;

  function startWatchdog() {
    stopWatchdog();
    lastActiveTime = Date.now();
    lastTurnTime = Date.now();
    watchdogIntervalHandle = setInterval(() => {
      if (!session) {
        stopWatchdog();
        return;
      }
      // If model is actively speaking or scheduled to speak, keep resetting silence timer
      if (audioPlayer && audioPlayer.isModelSpeaking()) {
        lastActiveTime = Date.now();
        return;
      }
      const now = Date.now();
      const silenceElapsed = now - lastActiveTime;
      const turnElapsed = now - lastTurnTime;

      if (silenceElapsed >= inactivityTimeoutMs) {
        console.warn(`[voice-session] Inactivity timeout reached (${silenceElapsed}ms silence). Stopping session.`);
        triggerInactivityTeardown('silence');
      } else if (turnElapsed >= stagnantTurnTimeoutMs) {
        console.warn(`[voice-session] Stagnant turn timeout reached (${turnElapsed}ms without turn completion). Stopping session.`);
        triggerInactivityTeardown('stagnant_turn');
      }
    }, 1000);
  }

  function stopWatchdog() {
    if (watchdogIntervalHandle) {
      clearInterval(watchdogIntervalHandle);
      watchdogIntervalHandle = null;
    }
  }

  function recordUserActivity() {
    lastActiveTime = Date.now();
  }

  function recordTurnActivity() {
    lastActiveTime = Date.now();
    lastTurnTime = Date.now();
  }

  function triggerInactivityTeardown(reason) {
    stopWatchdog();
    stop(false);
    const message = reason === 'stagnant_turn'
      ? 'Session paused due to extended inactivity. Tap mic to continue.'
      : 'Session closed due to 90 seconds of inactivity. Tap mic to resume.';
    callbacks.onStatus && callbacks.onStatus(message, null);
    if (callbacks.onInactivityTimeout) {
      callbacks.onInactivityTimeout({ reason, silenceElapsed: Date.now() - lastActiveTime });
    }
  }

  async function startNativeMic() {
    const MicCapture = getMicCapturePlugin();
    micListenerHandle = await MicCapture.addListener('audioChunk', (data) => {
      if (!session || !data || !data.audio) return;
      if (audioPlayer && audioPlayer.isModelSpeaking()) return;

      // Filter out low-energy ambient room noise (RMS < RMS_SPEECH_THRESHOLD)
      const rms = calculatePcmRms(data.audio);
      if (rms >= RMS_SPEECH_THRESHOLD) {
        recordUserActivity();
      }

      try {
        session.sendRealtimeInput({ audio: { data: data.audio, mimeType: 'audio/pcm;rate=16000' } });
      } catch (err) {
        console.error('mic send error', err);
        callbacks.onStatus && callbacks.onStatus('Error sending audio: ' + err.message, 'err');
      }
    });

    interruptionListenerHandle = await MicCapture.addListener('interrupted', (info) => {
      console.warn('Mic capture interrupted by incoming call / audio focus loss:', info);
      if (callbacks.onInterrupted) {
        callbacks.onInterrupted(info);
      }
      stop(false);
    });

    await MicCapture.start();
  }

  async function stopNativeMic() {
    try {
      const MicCapture = getMicCapturePlugin();
      await MicCapture.stop();
    } catch (e) { /* plugin already gone or missing, ignore */ }
    if (micListenerHandle) {
      try { await micListenerHandle.remove(); } catch (e) { /* ignore */ }
      micListenerHandle = null;
    }
    if (interruptionListenerHandle) {
      try { await interruptionListenerHandle.remove(); } catch (e) { /* ignore */ }
      interruptionListenerHandle = null;
    }
  }

  function handleMessage(msg) {
    try {
      const content = msg.serverContent;
      if (!content) return;

      if (content.interrupted && audioPlayer) audioPlayer.stop();

      if (content.inputTranscription && content.inputTranscription.text) {
        recordUserActivity();
        callbacks.onUserText && callbacks.onUserText(content.inputTranscription.text);
      }
      if (content.outputTranscription && content.outputTranscription.text) {
        recordUserActivity();
        callbacks.onModelText && callbacks.onModelText(content.outputTranscription.text);
      }
      if (content.modelTurn && content.modelTurn.parts) {
        recordUserActivity();
        for (const part of content.modelTurn.parts) {
          if (part.inlineData && part.inlineData.data && audioPlayer) {
            audioPlayer.playChunk(part.inlineData.data);
          }
        }
      }
      if (content.turnComplete) {
        recordTurnActivity();
        callbacks.onTurnComplete && callbacks.onTurnComplete();
      }
    } catch (err) {
      console.error('message handling error', err, msg);
      callbacks.onStatus && callbacks.onStatus('Error processing message: ' + err.message, 'err');
    }
  }

  // `imports`: the caller passes in { GoogleGenAI, Modality } from the
  // vendor bundle — kept as a parameter instead of importing the (large,
  // 216KB) bundle from inside this shared module, so a page that never
  // starts a session doesn't pay for parsing it.
  async function start(imports) {
    if (session || isBusy) return { ok: false, reason: 'already_active' };
    isBusy = true;

    // Create + resume the AudioContext FIRST, still inside the same call
    // stack as the user's mic-tap gesture — before any await touches the
    // network. Browsers are far more willing to let a context leave
    // 'suspended' when resume() is close to the original gesture; waiting
    // until after 2-3 network round-trips (key check, connect) is what was
    // causing silent "connected but no audio" sessions.
    audioPlayer = createAudioPlayer((isSpeaking) => {
      callbacks.onSpeakingChange && callbacks.onSpeakingChange(isSpeaking);
    });
    await audioPlayer.open();

    const apiKey = await getApiKey();
    if (!apiKey) {
      isBusy = false;
      if (audioPlayer) { audioPlayer.close(); audioPlayer = null; }
      return { ok: false, reason: 'no_api_key' };
    }

    // Proactive offline check FIRST — before checkGeminiApiKey(), which
    // itself makes a real network request to Google. Checking this
    // first means: (a) we never spend a doomed round-trip validating a
    // key we can't possibly reach Google with, and (b) a plain "no
    // internet" situation never gets misreported as reason:
    // 'invalid_api_key' (checkGeminiApiKey's fetch() throws when
    // offline — if checked first, as before, that failure used to be
    // indistinguishable from a genuinely bad key, sending the caller
    // off to Settings for a problem Settings can't fix).
    const { isOnline } = await import('./network-status.js');
    if (!(await isOnline())) {
      isBusy = false;
      if (audioPlayer) { audioPlayer.close(); audioPlayer = null; }
      return { ok: false, reason: 'offline', message: 'No internet connection — please check and try again.' };
    }

    callbacks.onStatus && callbacks.onStatus('Checking AI key...', null);
    const keyCheck = await checkGeminiApiKey(apiKey);
    if (keyCheck.status !== 'valid') {
      isBusy = false;
      if (audioPlayer) { audioPlayer.close(); audioPlayer = null; }
      return { ok: false, reason: 'invalid_api_key', message: keyCheck.message };
    }

    await startKeepAlive();

    callbacks.onStatus && callbacks.onStatus('Connecting to AI...', null);
    try {
      const { GoogleGenAI, Modality } = imports;
      const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1alpha' });

      session = await ai.live.connect({
        model: LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: { parts: [{ text: getSystemInstruction() }] },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
        },
        callbacks: {
          onopen: () => {
            callbacks.onStatus && callbacks.onStatus('AI connected — starting audio...', null);
          },
          onmessage: (msg) => handleMessage(msg),
          onerror: (e) => {
            console.error('live session error', e);
            const detail = (e && e.message) ? e.message : 'connection error event received from server';
            callbacks.onStatus && callbacks.onStatus('Connection error — ' + detail, 'err');
            errorAlreadyShown = true;
            stop(true);
          },
          onclose: (e) => {
            stopWatchdog();
            if (!errorAlreadyShown) {
              const msg = describeCloseEvent(e);
              callbacks.onStatus && callbacks.onStatus(msg || 'Session closed.', msg ? 'err' : null);
            }
            errorAlreadyShown = false;
            session = null;
            isBusy = false;
            callbacks.onClose && callbacks.onClose(e);
          }
        }
      });

      callbacks.onStatus && callbacks.onStatus('Starting native microphone...', null);
      try {
        await startNativeMic();
        startWatchdog();
        isBusy = false;
        callbacks.onStatus && callbacks.onStatus('Connected — microphone on, start speaking', 'live');
        callbacks.onOpen && callbacks.onOpen();
      } catch (err) {
        console.error('native mic error', err);
        callbacks.onStatus && callbacks.onStatus('Could not start native microphone: ' + (err && err.message ? err.message : err), 'err');
        errorAlreadyShown = true;
        stop(true);
        return { ok: false, reason: 'mic_start_failed', message: err && err.message };
      }

      return { ok: true };
    } catch (err) {
      console.error('connect error', err);
      isBusy = false;
      stopWatchdog();
      stopKeepAlive(); // connect itself failed — no session was ever created, so stop() below never runs to release this
      if (audioPlayer) { audioPlayer.close(); audioPlayer = null; }
      return { ok: false, reason: 'connect_failed', message: describeConnectError(err) };
    }
  }

  // Injects a new instruction as a user-role text turn into the ALREADY
  // OPEN session — this is the mechanism behind the scenario feature's
  // phase 1 -> phase 2 (roleplay -> tutor feedback) switch. The Live API
  // doesn't support re-sending systemInstruction mid-session, but it does
  // treat an explicit text turn as a strong steering signal, and the
  // session retains full memory of everything said so far — so this
  // reads to the model as "the same conversation, new directive", not a
  // reset. turnComplete:true so the model treats it as a real turn
  // boundary and responds right away instead of waiting for more input.
  function sendTextTurn(text) {
    if (!session) {
      console.warn('[voice-session] sendTextTurn called while session is inactive or not yet connected');
      return false;
    }
    recordTurnActivity();
    try {
      session.sendClientContent({ turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true });
      return true;
    } catch (err) {
      console.error('sendTextTurn error', err);
      callbacks.onStatus && callbacks.onStatus('Error sending instruction: ' + err.message, 'err');
      return false;
    }
  }

  function stop(silent) {
    stopWatchdog();
    stopKeepAlive();
    stopNativeMic().catch((e) => console.error('stopNativeMic error', e));
    if (audioPlayer) { audioPlayer.close(); audioPlayer = null; }
    if (session) { try { session.close(); } catch (e) { console.error('session close error', e); } session = null; }
    isBusy = false;
    if (!silent) callbacks.onStatus && callbacks.onStatus('Stopped.', null);
  }

  function isActive() { return !!session; }

  return { start, stop, sendTextTurn, isActive };
}