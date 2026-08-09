package com.utkio.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Build;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.PermissionRequest;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  private static final int MIC_PERMISSION_CODE = 1001;
  private static final int NOTIF_PERMISSION_CODE = 1002;
  private PermissionRequest pendingWebRequest;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    // Naya native mic-capture plugin register karo. Yeh super.onCreate()
    // se PEHLE hona zaroori hai, warna Capacitor bridge isse pick nahi karega.
    registerPlugin(MicCapturePlugin.class);

    super.onCreate(savedInstanceState);

    // DEBUG: chrome://inspect se is WebView ko dekhne ke liye.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
      WebView.setWebContentsDebuggingEnabled(true);
    }

    // Yeh purana WebView-based mic permission flow ab sirf fallback ke
    // roop mein rakha hai — asli mic capture ab MicCapturePlugin se hoga.
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED) {
      ActivityCompat.requestPermissions(this,
              new String[]{Manifest.permission.RECORD_AUDIO}, MIC_PERMISSION_CODE);
    }

    // Screen-off voice fix: VoiceKeepAliveService's persistent notification
    // needs this on Android 13+, or the OS silently shows nothing (the
    // foreground service itself still runs fine either way — this is only
    // about the notification being visible to the user).
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED) {
      ActivityCompat.requestPermissions(this,
              new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIF_PERMISSION_CODE);
    }

    this.bridge.getWebView().setWebChromeClient(new android.webkit.WebChromeClient() {
      @Override
      public void onPermissionRequest(final PermissionRequest request) {
        runOnUiThread(() -> {
          if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO)
                  == PackageManager.PERMISSION_GRANTED) {
            request.grant(request.getResources());
          } else {
            pendingWebRequest = request;
            ActivityCompat.requestPermissions(MainActivity.this,
                    new String[]{Manifest.permission.RECORD_AUDIO}, MIC_PERMISSION_CODE);
          }
        });
      }

      @Override
      public boolean onConsoleMessage(ConsoleMessage cm) {
        Log.d("WebViewConsole",
                cm.message() + "  [line " + cm.lineNumber() + " @ " + cm.sourceId() + "]");
        return true;
      }
    });
  }

  @Override
  public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    if (requestCode == MIC_PERMISSION_CODE && pendingWebRequest != null) {
      if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
        pendingWebRequest.grant(pendingWebRequest.getResources());
      } else {
        pendingWebRequest.deny();
      }
      pendingWebRequest = null;
    }
  }
}