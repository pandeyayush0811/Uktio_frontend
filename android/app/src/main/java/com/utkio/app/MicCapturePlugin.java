package com.utkio.app;

import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.media.audiofx.AcousticEchoCanceler;
import android.media.audiofx.NoiseSuppressor;
import android.os.Build;
import android.util.Base64;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;

// Yeh plugin WebView ke getUserMedia() ko bilkul bypass karta hai.
// Mic audio seedha native AudioRecord API se capture hota hai (jo
// WebView ke Chromium audio-capture engine se zyada reliable hai),
// aur 16kHz mono PCM chunks ko base64 mein JS ko event ke through
// bhejta hai — bilkul wahi format jo pehle ScriptProcessor deta tha.
@CapacitorPlugin(
        name = "MicCapture",
        permissions = {
                @Permission(strings = { android.Manifest.permission.RECORD_AUDIO }, alias = "microphone")
        }
)
public class MicCapturePlugin extends Plugin {
    private AudioRecord audioRecord;
    private Thread recordingThread;
    private volatile boolean isRecording = false;
    private AcousticEchoCanceler echoCanceler;
    private NoiseSuppressor noiseSuppressor;
    private AudioFocusRequest audioFocusRequest;
    private AudioManager.OnAudioFocusChangeListener audioFocusChangeListener;

    private static final int SAMPLE_RATE = 16000;
    private static final int BUFFER_SAMPLES = 4096; // pehle wale ScriptProcessor jaisa hi chunk size

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "micPermsCallback");
            return;
        }
        startRecording(call);
    }

    @PermissionCallback
    private void micPermsCallback(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            startRecording(call);
        } else {
            call.reject("Microphone permission denied");
        }
    }

    private void startRecording(PluginCall call) {
        if (isRecording) {
            call.resolve();
            return;
        }
        try {
            AudioManager audioManager = (AudioManager) getContext().getSystemService(android.content.Context.AUDIO_SERVICE);
            if (audioManager != null) {
                audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);

                if (audioFocusChangeListener == null) {
                    audioFocusChangeListener = new AudioManager.OnAudioFocusChangeListener() {
                        @Override
                        public void onAudioFocusChange(int focusChange) {
                            if (focusChange == AudioManager.AUDIOFOCUS_LOSS ||
                                focusChange == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT ||
                                focusChange == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) {
                                Log.d("MicCapturePlugin", "Audio focus lost (call / system interruption): " + focusChange);
                                JSObject data = new JSObject();
                                data.put("reason", "audio_focus_loss");
                                data.put("focusChange", focusChange);
                                notifyListeners("interrupted", data);
                                stopRecordingInternal();
                            }
                        }
                    };
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    AudioAttributes playbackAttributes = new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build();
                    audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
                            .setAudioAttributes(playbackAttributes)
                            .setAcceptsDelayedFocusGain(false)
                            .setOnAudioFocusChangeListener(audioFocusChangeListener)
                            .build();
                    audioManager.requestAudioFocus(audioFocusRequest);
                } else {
                    audioManager.requestAudioFocus(audioFocusChangeListener, AudioManager.STREAM_VOICE_CALL, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE);
                }
            }

            int minBuf = AudioRecord.getMinBufferSize(
                    SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
            int bufferSize = Math.max(minBuf, BUFFER_SAMPLES * 4);

            audioRecord = new AudioRecord(
                    MediaRecorder.AudioSource.VOICE_COMMUNICATION, // MIC ki jagah — isse Android ka echo-cancelling voice audio path use hota hai
                    SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    bufferSize);

            if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                call.reject("AudioRecord initialize nahi ho paya (state != INITIALIZED)");
                audioRecord = null;
                return;
            }

            // Explicitly Acoustic Echo Cancellation aur Noise Suppression
            // attach karte hain is recording session pe — yeh AI ki apni
            // awaaz ko speaker se mic mein wapas aane se rokta hai (jo
            // "AI khud ko sun raha hai" wali dikkat ki wajah thi).
            int sessionId = audioRecord.getAudioSessionId();
            if (AcousticEchoCanceler.isAvailable()) {
                echoCanceler = AcousticEchoCanceler.create(sessionId);
                if (echoCanceler != null) {
                    echoCanceler.setEnabled(true);
                    Log.d("MicCapturePlugin", "AcousticEchoCanceler enabled");
                }
            } else {
                Log.d("MicCapturePlugin", "AcousticEchoCanceler is NOT available on this device");
            }
            if (NoiseSuppressor.isAvailable()) {
                noiseSuppressor = NoiseSuppressor.create(sessionId);
                if (noiseSuppressor != null) {
                    noiseSuppressor.setEnabled(true);
                }
            }

            audioRecord.startRecording();
            isRecording = true;

            recordingThread = new Thread(() -> {
                short[] buffer = new short[BUFFER_SAMPLES];
                while (isRecording && audioRecord != null) {
                    int read = audioRecord.read(buffer, 0, buffer.length);
                    if (read > 0) {
                        byte[] bytes = shortsToBytes(buffer, read);
                        String b64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
                        JSObject data = new JSObject();
                        data.put("audio", b64);
                        notifyListeners("audioChunk", data);
                    }
                }
            }, "MicCaptureThread");
            recordingThread.start();

            call.resolve();
        } catch (Exception e) {
            call.reject("Recording start nahi ho payi: " + e.getMessage());
        }
    }

    private synchronized void stopRecordingInternal() {
        isRecording = false;
        if (recordingThread != null) {
            try { recordingThread.join(300); } catch (InterruptedException ignored) {}
            recordingThread = null;
        }
        if (echoCanceler != null) {
            try { echoCanceler.release(); } catch (Exception ignored) {}
            echoCanceler = null;
        }
        if (noiseSuppressor != null) {
            try { noiseSuppressor.release(); } catch (Exception ignored) {}
            noiseSuppressor = null;
        }
        if (audioRecord != null) {
            try { audioRecord.stop(); } catch (Exception ignored) {}
            try { audioRecord.release(); } catch (Exception ignored) {}
            audioRecord = null;
        }
        try {
            AudioManager audioManager = (AudioManager) getContext().getSystemService(android.content.Context.AUDIO_SERVICE);
            if (audioManager != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
                    audioManager.abandonAudioFocusRequest(audioFocusRequest);
                    audioFocusRequest = null;
                } else if (audioFocusChangeListener != null) {
                    audioManager.abandonAudioFocus(audioFocusChangeListener);
                }
                audioManager.setMode(AudioManager.MODE_NORMAL);
            }
        } catch (Exception ignored) {}
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopRecordingInternal();
        call.resolve();
    }

    // ---- keep-alive across a full voice turn (recording + reply playback) ----
    // See VoiceKeepAliveService for why this exists: without it, the screen
    // locking mid-conversation freezes the app (Doze) and audio just stops,
    // which is the exact "screen band karo to chat/awaaz ruk jaati hai" bug.
    // Deliberately separate from start()/stop() above — recording can (and
    // in a live-turn flow, DOES) stop well before the reply's TTS audio
    // has finished playing, so the JS side controls this window explicitly
    // rather than it being implicitly tied to mic state.
    @PluginMethod
    public void startKeepAlive(PluginCall call) {
        try {
            android.content.Intent intent = new android.content.Intent(getContext(), VoiceKeepAliveService.class);
            intent.setAction(VoiceKeepAliveService.ACTION_START);
            androidx.core.content.ContextCompat.startForegroundService(getContext(), intent);
            call.resolve();
        } catch (Exception e) {
            // Never let a keep-alive failure block the actual voice feature —
            // worst case without it is back to the pre-fix screen-off behavior,
            // not a broken call.
            Log.e("MicCapturePlugin", "startKeepAlive failed", e);
            call.resolve();
        }
    }

    @PluginMethod
    public void stopKeepAlive(PluginCall call) {
        try {
            android.content.Intent intent = new android.content.Intent(getContext(), VoiceKeepAliveService.class);
            intent.setAction(VoiceKeepAliveService.ACTION_STOP);
            getContext().startService(intent);
        } catch (Exception e) {
            Log.e("MicCapturePlugin", "stopKeepAlive failed", e);
        }
        call.resolve();
    }

    private byte[] shortsToBytes(short[] shorts, int len) {
        byte[] bytes = new byte[len * 2];
        for (int i = 0; i < len; i++) {
            bytes[i * 2] = (byte) (shorts[i] & 0xff);
            bytes[i * 2 + 1] = (byte) ((shorts[i] >> 8) & 0xff);
        }
        return bytes;
    }
}