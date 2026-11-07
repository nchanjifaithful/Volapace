package app.volapace;

import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * window.VPNative — what the UI can ask of the phone. Called on a WebView thread; anything that
 * touches views or starts activities hops to the UI thread. Async calls take a callback id and
 * answer through window.__vp.resolve(id, json).
 */
final class Bridge {
    private final MainActivity act;
    Bridge(MainActivity a) { act = a; }

    @JavascriptInterface public String listFiles() { return act.library.listJson(); }
    @JavascriptInterface public void rescan() { act.library.scan(); }
    @JavascriptInterface public String folderLabel() { return act.library.folderLabel(); }
    @JavascriptInterface public String takeIncoming() { return act.takeIncoming(); }

    @JavascriptInterface public void pickPdf(String cb) { act.runOnUiThread(() -> act.pickPdf(cb)); }

    @JavascriptInterface public boolean deleteFile(String id) { return act.library.delete(id); }

    @JavascriptInterface public void saveFile(String cb, String name, String mime, String b64) {
        byte[] data = Base64.decode(b64, Base64.DEFAULT);
        act.runOnUiThread(() -> act.saveFile(cb, name, mime, data));
    }

    @JavascriptInterface public void shareFile(String name, String mime, String b64, String text) {
        try {
            File f = new File(ShareProvider.dir(act), name.replaceAll("[\\\\/]", "_"));
            try (OutputStream o = new FileOutputStream(f)) { o.write(Base64.decode(b64, Base64.DEFAULT)); }
            Intent send = new Intent(Intent.ACTION_SEND)
                    .setType(mime)
                    .putExtra(Intent.EXTRA_STREAM, ShareProvider.uriFor(f.getName()))
                    .putExtra(Intent.EXTRA_TEXT, text)
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            send.setClipData(ClipData.newRawUri(name, ShareProvider.uriFor(f.getName())));
            act.runOnUiThread(() -> act.startActivity(Intent.createChooser(send, null)));
        } catch (Exception e) { toast("Couldn’t share that"); }
    }

    @JavascriptInterface public void setReminder(String json) {
        Reminders.save(act, json);
        if (json.contains("\"on\":true")) act.runOnUiThread(act::askNotificationPermission);
    }
    @JavascriptInterface public boolean notificationsAllowed() {
        return Build.VERSION.SDK_INT < 33 || act.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    @JavascriptInterface public void setTheme(boolean dark, String bg) { act.runOnUiThread(() -> act.applyTheme(dark)); }

    @JavascriptInterface public void vibrate(String csv) {
        try {
            String[] p = csv.split(",");
            long[] t = new long[p.length + 1];
            for (int i = 0; i < p.length; i++) t[i + 1] = Long.parseLong(p[i].trim());
            Vibrator v = (Vibrator) act.getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) v.vibrate(VibrationEffect.createWaveform(t, -1));
        } catch (Exception ignored) {}
    }

    @JavascriptInterface public void copy(String text) {
        ClipboardManager cm = (ClipboardManager) act.getSystemService(Context.CLIPBOARD_SERVICE);
        if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("Volapace", text));
    }

    @JavascriptInterface public void confirm(String cb, String title, String message, String ok) {
        act.runOnUiThread(() -> {
            boolean[] answered = {false};
            new AlertDialog.Builder(act)
                    .setTitle(title)
                    .setMessage(message == null || message.isEmpty() ? null : message)
                    .setPositiveButton(ok, (d, w) -> { answered[0] = true; act.resolve(cb, "true"); })
                    .setNegativeButton("Cancel", (d, w) -> { answered[0] = true; act.resolve(cb, "false"); })
                    .setOnDismissListener(d -> { if (!answered[0]) act.resolve(cb, "false"); })
                    .show();
        });
    }

    @JavascriptInterface public void toast(String msg) { act.runOnUiThread(() -> Toast.makeText(act, msg, Toast.LENGTH_SHORT).show()); }
}
