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
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
  private static final int MIC_PERMISSION_CODE = 1001;
  private static final int COMBINED_PERMISSIONS_CODE = 1003;
  private PermissionRequest pendingWebRequest;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    // Naya native mic-capture plugin register karo. Yeh super.onCreate()
    // se PEHLE hona zaroori hai, warna Capacitor bridge isse pick nahi karega.
    registerPlugin(MicCapturePlugin.class);

    super.onCreate(savedInstanceState);

    // DEBUG: chrome://inspect se is WebView ko dekhne ke liye.
    // Sirf debug builds mein — release build mein remote debugging
    // off rehni chahiye (security hardening, koi feature isse touch nahi hota).
    if (BuildConfig.DEBUG && Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
      WebView.setWebContentsDebuggingEnabled(true);
    }

    // Atomic permission request: Collect all required missing permissions and request
    // them in a single call. Requesting permissions separately in sequence causes the
    // second system dialog to cancel/dismiss the first dialog on Android (refs ISSUE #20).
    List<String> neededPermissions = new ArrayList<>();
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED) {
      neededPermissions.add(Manifest.permission.RECORD_AUDIO);
    }

    // Screen-off voice fix: VoiceKeepAliveService's persistent notification
    // needs this on Android 13+, or the OS silently shows nothing.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED) {
      neededPermissions.add(Manifest.permission.POST_NOTIFICATIONS);
    }

    if (!neededPermissions.isEmpty()) {
      ActivityCompat.requestPermissions(this,
              neededPermissions.toArray(new String[0]), COMBINED_PERMISSIONS_CODE);
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
    if (pendingWebRequest != null) {
      boolean audioGranted = false;
      for (int i = 0; i < permissions.length; i++) {
        if (Manifest.permission.RECORD_AUDIO.equals(permissions[i]) &&
            grantResults.length > i && grantResults[i] == PackageManager.PERMISSION_GRANTED) {
          audioGranted = true;
          break;
        }
      }
      if (audioGranted) {
        pendingWebRequest.grant(pendingWebRequest.getResources());
      } else {
        pendingWebRequest.deny();
      }
      pendingWebRequest = null;
    }
  }
}