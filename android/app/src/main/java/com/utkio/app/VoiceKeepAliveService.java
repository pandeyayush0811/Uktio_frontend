package com.utkio.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

// Keeps the app process (and therefore the WebView + JS running inside it —
// mic capture, the live WebSocket, and TTS audio playback via AudioContext)
// alive while the screen is OFF.
//
// WHY THIS EXISTS: without a foreground service, Android's Doze / App
// Standby freezes background work (timers, some audio, JS execution) a few
// seconds/minutes after the screen locks. That's the actual cause of
// "screen band karo to voice chat ruk jaata hai" — not a network bug.
//
// SCOPE: this service spans a full voice TURN, not just the mic-recording
// window. It's started when a turn begins (mic tap / session start) and
// stopped only once BOTH recording AND the reply's audio playback have
// fully finished — see start()/stop() call sites in chat.html. Started/
// stopped via ACTION_START / ACTION_STOP intents from MicCapturePlugin,
// never called directly from JS.
public class VoiceKeepAliveService extends Service {
    private static final String TAG = "VoiceKeepAliveService";
    private static final String CHANNEL_ID = "voice_session";
    private static final int NOTIF_ID = 4471;

    public static final String ACTION_START = "com.utkio.app.action.START_VOICE_KEEPALIVE";
    public static final String ACTION_STOP = "com.utkio.app.action.STOP_VOICE_KEEPALIVE";

    private PowerManager.WakeLock wakeLock;

    // Safety net: if JS forgets to call stopKeepAlive() (crash, killed
    // listener, whatever), don't drain the user's battery all night.
    // 20 minutes is generously above any real single practice/voice
    // session; JS is expected to stop this within seconds of a turn
    // actually finishing.
    private static final long MAX_WAKELOCK_MS = 20 * 60 * 1000L;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_STOP.equals(action)) {
            stopSelfClean();
            return START_NOT_STICKY;
        }

        // Default / ACTION_START
        startForegroundCompat();
        acquireWakeLock();
        return START_NOT_STICKY; // if the system kills+restarts us with a null intent, don't silently re-arm
    }

    private void startForegroundCompat() {
        createChannelIfNeeded();

        Intent tapIntent = new Intent(this, MainActivity.class);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT
                | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent contentIntent = PendingIntent.getActivity(this, 0, tapIntent, piFlags);

        Notification notification = new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("Utkio")
                .setContentText("Voice session chal rahi hai...")
                .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setContentIntent(contentIntent)
                .setOngoing(true)
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) { // Android 14+
            startForeground(NOTIF_ID, notification,
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } else {
            startForeground(NOTIF_ID, notification);
        }
    }

    private void createChannelIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel existing = nm.getNotificationChannel(CHANNEL_ID);
        if (existing != null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Voice session", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Shown while a live voice conversation is active, so audio keeps working with the screen off.");
        channel.setShowBadge(false);
        nm.createNotificationChannel(channel);
    }

    private void acquireWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) return; // already held, e.g. stop() then start() raced
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm == null) return;
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Utkio:VoiceKeepAlive");
        wakeLock.setReferenceCounted(false);
        try {
            wakeLock.acquire(MAX_WAKELOCK_MS);
        } catch (Exception e) {
            Log.e(TAG, "wakeLock.acquire failed", e);
        }
    }

    private void releaseWakeLock() {
        if (wakeLock != null) {
            try { if (wakeLock.isHeld()) wakeLock.release(); } catch (Exception ignored) {}
            wakeLock = null;
        }
    }

    private void stopSelfClean() {
        releaseWakeLock();
        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        releaseWakeLock();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null; // not a bound service — started only, controlled via intents
    }
}
