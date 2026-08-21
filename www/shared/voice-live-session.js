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

function base64ToInt16(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

export function describeMicError(err) {
  const name = err && err.name;
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError')
    return 'Microphone access was denied. Tap the mic icon in your address bar and select Allow.';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError')
    return 'Mic nahi mila: is device/browser mein koi microphone connected nahi hai.';
  if (name === 'NotReadableError' || name === 'TrackStartError')
    return 'Could not open the microphone (already retried). If another app is using it, close that app and try again.';
  if (name === 'SecurityError')
    return 'Mic access block: yeh page HTTPS (ya localhost) par nahi chal raha, isliye browser mic nahi de raha.';
  if (name === 'OverconstrainedError')
    return 'Mic settings match nahi hui is device mein.';
  return 'Mic access mein error: ' + (err && err.message ? err.message : 'wajah pata nahi chali (' + err + ')');
}

export function describeConnectError(err) {
  const msg = (err && err.message) ? err.message : String(err);
  if (/api key not valid|api_key_invalid|invalid api key/i.test(msg))
    return 'Invalid API key — go to Settings and paste a valid key from Google AI Studio.';
  if (/quota|resource_exhausted|rate limit/i.test(msg))
    return 'API quota/rate-limit khatam ho gaya — thodi der ruk kar try karo ya naya key banao.';
  if (/permission_denied|not authorized/i.test(msg))
    return `This API key cannot use Live API (${LIVE_MODEL}) — check the key's permissions in Google AI Studio.`;
  if (/failed to fetch|network|timeout|ENOTFOUND/i.test(msg))
    return 'Could not connect to Google — please check your internet connection.';
  if (/model not found|not_found/i.test(msg))
    return 'Model available nahi hai is region/account ke liye.';
  return 'Connect nahi ho paya, wajah: ' + msg;
}

export function describeCloseEvent(e) {
  if (!e) return 'Session band ho gaya (koi close-details nahi mile).';
  if (e.code === 1000) return null;
  const reason = e.reason ? (' — ' + e.reason) : ' (server ne koi reason text nahi bheja)';
  return 'Session band ho gaya, code ' + e.code + reason + '. Ye us API key/model access ki taraf se koi dikkat ho sakti hai.';
}

// Wraps the "audio currently playing" state + WebAudio scheduling queue
// that used to be five separate module-level variables in chat.html —
// bundled into one object so a caller (scenario.html) doesn't have to
// juggle them by hand.
function createAudioPlayer(onSpeakingChange) {
  let playCtx = null;
  let nextPlayTime = 0;
  let scheduledSources = [];
  let isModelSpeaking = false;

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

  return {
    async open() {
      playCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
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
    },
    isModelSpeaking() { return isModelSpeaking; },
    playChunk(base64Data) {
      if (!playCtx) return;
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
//   onTurnComplete()                  — model finished a turn
//   onOpen()                          — connection established
//   onClose(closeEvent)               — connection ended (any reason)
//   onSpeakingChange(isSpeaking)      — Utkio started/stopped talking —
//                                        this is the real "mic is
//                                        live-muted right now" signal;
//                                        the mic never actually sends
//                                        audio while this is true (see
//                                        startNativeMic below), so a
//                                        page should mirror this in the
//                                        UI rather than just guessing
//                                        from turn boundaries.
export function createVoiceSession({ getSystemInstruction, voiceName = 'Puck', callbacks = {} }) {
  let session = null;
  let audioPlayer = null;
  let micListenerHandle = null;
  let isBusy = false;
  let errorAlreadyShown = false;

  async function startNativeMic() {
    const MicCapture = getMicCapturePlugin();
    micListenerHandle = await MicCapture.addListener('audioChunk', (data) => {
      if (!session || !data || !data.audio) return;
      if (audioPlayer && audioPlayer.isModelSpeaking()) return;
      try {
        session.sendRealtimeInput({ audio: { data: data.audio, mimeType: 'audio/pcm;rate=16000' } });
      } catch (err) {
        console.error('mic send error', err);
        callbacks.onStatus && callbacks.onStatus('Audio bhejte waqt error: ' + err.message, 'err');
      }
    });
    await MicCapture.start();
  }

  async function stopNativeMic() {
    try {
      const MicCapture = getMicCapturePlugin();
      await MicCapture.stop();
    } catch (e) { /* plugin already gone ya nahi mila, ignore */ }
    if (micListenerHandle) {
      try { await micListenerHandle.remove(); } catch (e) { /* ignore */ }
      micListenerHandle = null;
    }
  }

  function handleMessage(msg) {
    try {
      const content = msg.serverContent;
      if (!content) return;

      if (content.interrupted && audioPlayer) audioPlayer.stop();

      if (content.inputTranscription && content.inputTranscription.text) {
        callbacks.onUserText && callbacks.onUserText(content.inputTranscription.text);
      }
      if (content.outputTranscription && content.outputTranscription.text) {
        callbacks.onModelText && callbacks.onModelText(content.outputTranscription.text);
      }
      if (content.modelTurn && content.modelTurn.parts) {
        for (const part of content.modelTurn.parts) {
          if (part.inlineData && part.inlineData.data && audioPlayer) {
            audioPlayer.playChunk(part.inlineData.data);
          }
        }
      }
      if (content.turnComplete) {
        callbacks.onTurnComplete && callbacks.onTurnComplete();
      }
    } catch (err) {
      console.error('message handling error', err, msg);
      callbacks.onStatus && callbacks.onStatus('Ek message process karte waqt error aaya: ' + err.message, 'err');
    }
  }

  // `imports`: the caller passes in { GoogleGenAI, Modality } from the
  // vendor bundle — kept as a parameter instead of importing the (large,
  // 216KB) bundle from inside this shared module, so a page that never
  // starts a session doesn't pay for parsing it.
  async function start(imports) {
    if (session || isBusy) return { ok: false, reason: 'already_active' };

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
    if (!apiKey) { audioPlayer.close(); audioPlayer = null; return { ok: false, reason: 'no_api_key' }; }

    // Lock as early as we safely can — right after the audio-gesture-
    // linked open() above and the (local, non-network) getApiKey() read,
    // and BEFORE any further await. Guards against a theoretical race
    // where two overlapping start() calls both slip past the `session ||
    // isBusy` check at the top before either sets isBusy.
    isBusy = true;

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
      return { ok: false, reason: 'offline', message: 'Internet connection nahi hai — check karke phir try karo.' };
    }

    callbacks.onStatus && callbacks.onStatus('Key check ho rahi hai...', null);
    const keyCheck = await checkGeminiApiKey(apiKey);
    if (keyCheck.status !== 'valid') {
      isBusy = false;
      if (audioPlayer) { audioPlayer.close(); audioPlayer = null; }
      return { ok: false, reason: 'invalid_api_key', message: keyCheck.message };
    }

    await startKeepAlive();

    callbacks.onStatus && callbacks.onStatus('Gemini se connect ho raha hai...', null);
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
            callbacks.onStatus && callbacks.onStatus('Connected — mic on, bolna shuru karo', 'live');
            isBusy = false;
            callbacks.onOpen && callbacks.onOpen();
          },
          onmessage: (msg) => handleMessage(msg),
          onerror: (e) => {
            console.error('live session error', e);
            const detail = (e && e.message) ? e.message : 'connection ne error event bheja, exact wajah server ne nahi batayi';
            callbacks.onStatus && callbacks.onStatus('Connection error — ' + detail, 'err');
            errorAlreadyShown = true;
            stop(true);
          },
          onclose: (e) => {
            if (!errorAlreadyShown) {
              const msg = describeCloseEvent(e);
              callbacks.onStatus && callbacks.onStatus(msg || 'Session band ho gaya.', msg ? 'err' : null);
            }
            errorAlreadyShown = false;
            session = null;
            isBusy = false;
            callbacks.onClose && callbacks.onClose(e);
          }
        }
      });

      callbacks.onStatus && callbacks.onStatus('Mic (native) shuru ho raha hai...', null);
      try {
        await startNativeMic();
        callbacks.onStatus && callbacks.onStatus('Connected — mic on, bolna shuru karo', 'live');
      } catch (err) {
        console.error('native mic error', err);
        callbacks.onStatus && callbacks.onStatus('Native mic start nahi ho paya: ' + (err && err.message ? err.message : err), 'err');
        errorAlreadyShown = true;
        stop(true);
        return { ok: false, reason: 'mic_start_failed', message: err && err.message };
      }

      return { ok: true };
    } catch (err) {
      console.error('connect error', err);
      isBusy = false;
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
    if (!session) return false;
    try {
      session.sendClientContent({ turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true });
      return true;
    } catch (err) {
      console.error('sendTextTurn error', err);
      callbacks.onStatus && callbacks.onStatus('Instruction bhejte waqt error: ' + err.message, 'err');
      return false;
    }
  }

  function stop(silent) {
    stopKeepAlive();
    stopNativeMic().catch((e) => console.error('stopNativeMic error', e));
    if (audioPlayer) { audioPlayer.close(); audioPlayer = null; }
    if (session) { try { session.close(); } catch (e) { console.error('session close error', e); } session = null; }
    isBusy = false;
    if (!silent) callbacks.onStatus && callbacks.onStatus('Ruk gaya.', null);
  }

  function isActive() { return !!session; }

  return { start, stop, sendTextTurn, isActive };
}