package app.volapace;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Hosts the Volapace UI (assets/www) in a WebView. Everything is served from inside the APK by
 * shouldInterceptRequest under https://volapace.local/ — the app has no INTERNET permission, so
 * nothing can reach the network. PDFs from the Volapace folder are served at /pdf/<id> and cover
 * thumbnails at /cover/<id>.jpg.
 */
public class MainActivity extends Activity {
    static final String ORIGIN = "https://volapace.local/";
    private static final int REQ_PICK = 11, REQ_SAVE = 12, REQ_NOTIFY = 13, REQ_IMAGE = 14, REQ_STORAGE = 15, REQ_TEXT = 16;

    ReaderWebView web;
    Library library;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private String pickCb, saveCb, imageCb, textCb;
    private byte[] saveData;
    private String incoming;           // JSON of a book handed over by another app, until the UI takes it
    private boolean dark, askedNotify;
    private FrameLayout root;

    @SuppressLint("SetJavaScriptEnabled")
    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        library = new Library(this);
        library.setListener(() -> js("window.__vp && __vp.library()"));

        Window w = getWindow();
        w.setStatusBarColor(Color.TRANSPARENT);
        w.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 29) { w.setNavigationBarContrastEnforced(false); w.setStatusBarContrastEnforced(false); }
        if (Build.VERSION.SDK_INT >= 30) w.setDecorFitsSystemWindows(false);
        else w.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);

        root = new FrameLayout(this);
        web = new ReaderWebView(this);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        root.setBackgroundColor(0xFFD90429); // matches the launch splash until the UI picks its theme
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);                 // the design sets its own type sizes
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        if (Build.VERSION.SDK_INT >= 33) s.setAlgorithmicDarkeningAllowed(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setBackgroundColor(Color.TRANSPARENT);
        web.addJavascriptInterface(new Bridge(this), "VPNative");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) { return serve(req.getUrl()); }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                return !req.getUrl().toString().startsWith(ORIGIN); // never leave the app
            }
            @Override public void onPageFinished(WebView v, String url) { sendInsets(); }
        });

        root.setOnApplyWindowInsetsListener((v, insets) -> { lastInsets = insets; sendInsets(); return insets; });

        handleIntent(getIntent());
        library.watch();
        library.scan();
        web.loadUrl(ORIGIN + "index.html");
    }

    // ── insets: status / navigation bar heights go to CSS as --sat / --sab; the keyboard shrinks the WebView ──
    private WindowInsets lastInsets;
    @SuppressWarnings("deprecation")
    private void sendInsets() {
        WindowInsets in = lastInsets;
        if (in == null || web == null) return;
        float d = getResources().getDisplayMetrics().density;
        int top, bottom, ime;
        if (Build.VERSION.SDK_INT >= 30) {
            android.graphics.Insets bars = in.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
            top = bars.top; bottom = bars.bottom;
            ime = in.getInsets(WindowInsets.Type.ime()).bottom;
        } else {
            top = in.getSystemWindowInsetTop(); bottom = in.getStableInsetBottom();
            ime = Math.max(0, in.getSystemWindowInsetBottom() - bottom);
        }
        boolean kb = ime > bottom;
        FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) web.getLayoutParams();
        int margin = kb ? ime : 0;
        if (lp.bottomMargin != margin) { lp.bottomMargin = margin; web.setLayoutParams(lp); }
        js("window.__vp && __vp.insets(" + Math.round(top / d) + "," + (kb ? 0 : Math.round(bottom / d)) + ")");
    }

    // ── serving the app and the books ──
    private static final Map<String, String> MIME = new HashMap<>();
    static {
        MIME.put("html", "text/html"); MIME.put("js", "text/javascript"); MIME.put("css", "text/css");
        MIME.put("woff2", "font/woff2"); MIME.put("json", "application/json"); MIME.put("svg", "image/svg+xml");
        MIME.put("png", "image/png"); MIME.put("jpg", "image/jpeg");
    }

    private WebResourceResponse serve(Uri url) {
        String u = url.toString();
        if (!u.startsWith(ORIGIN)) return blocked();
        String path = url.getPath() == null ? "/" : url.getPath();
        try {
            if (path.startsWith("/pdf/")) {
                File f = library.fileFor(Uri.decode(path.substring(5)));
                if (f == null) return notFound();
                return response("application/pdf", new FileInputStream(f), f.length());
            }
            if (path.startsWith("/cover/")) {
                String id = Uri.decode(path.substring(7)).replace(".jpg", "");
                File f = library.coverFile(id);
                if (!f.exists()) return notFound();
                return response("image/jpeg", new FileInputStream(f), f.length());
            }
            String p = path.equals("/") ? "index.html" : path.substring(1);
            if (p.contains("..")) return notFound();
            String ext = p.substring(p.lastIndexOf('.') + 1);
            InputStream in = getAssets().open("www/" + p);
            return response(MIME.containsKey(ext) ? MIME.get(ext) : "application/octet-stream", in, -1);
        } catch (Exception e) { return notFound(); }
    }
    private WebResourceResponse response(String mime, InputStream in, long len) {
        Map<String, String> h = new HashMap<>();
        h.put("Access-Control-Allow-Origin", ORIGIN.substring(0, ORIGIN.length() - 1));
        h.put("Cache-Control", "no-store");
        if (len >= 0) h.put("Content-Length", String.valueOf(len));
        boolean text = mime.startsWith("text/") || mime.endsWith("json");
        return new WebResourceResponse(mime, text ? "utf-8" : null, 200, "OK", h, in);
    }
    private WebResourceResponse notFound() { return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<>(), new java.io.ByteArrayInputStream(new byte[0])); }
    private WebResourceResponse blocked() { return new WebResourceResponse("text/plain", "utf-8", 403, "Offline", new HashMap<>(), new java.io.ByteArrayInputStream(new byte[0])); }

    // ── JS helpers ──
    void js(String code) { runOnUiThread(() -> { if (web != null) web.evaluateJavascript(code, null); }); }
    void resolve(String cb, String json) { js("window.__vp && __vp.resolve(" + JSONObject.quote(cb) + "," + (json == null ? "null" : JSONObject.quote(json)) + ")"); }

    // ── picking a PDF: copied into the Volapace folder, then indexed ──
    void pickPdf(String cb) {
        if (pickCb != null) resolve(pickCb, null);
        pickCb = cb;
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/pdf");
        try { startActivityForResult(i, REQ_PICK); } catch (Exception e) { resolve(cb, null); pickCb = null; }
    }

    private void importUri(Uri uri, java.util.function.Consumer<String> done) {
        io.execute(() -> {
            String out;
            try {
                File f = library.importUri(uri);
                Library.Row r = library.indexNow(f);
                out = r.pages > 0 ? r.toJson().toString() : "{\"error\":\"unreadable\"}";
            } catch (Exception e) { out = "{\"error\":\"unreadable\"}"; }
            final String result = out;
            runOnUiThread(() -> { done.accept(result); js("window.__vp && __vp.library()"); });
        });
    }

    // ── saving a file (export, streak card) through the system document picker ──
    void saveFile(String cb, String name, String mime, byte[] data) {
        if (saveCb != null) resolve(saveCb, "false");
        saveCb = cb; saveData = data;
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime).putExtra(Intent.EXTRA_TITLE, name);
        try { startActivityForResult(i, REQ_SAVE); } catch (Exception e) { resolve(cb, "false"); saveCb = null; saveData = null; }
    }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        Uri uri = res == RESULT_OK && data != null ? data.getData() : null;
        if (req == REQ_IMAGE) {
            String cb = imageCb; imageCb = null;
            if (uri == null) { resolve(cb, null); return; }
            io.execute(() -> resolve(cb, squarePhoto(uri)));
            return;
        }
        if (req == REQ_TEXT) {
            String cb = textCb; textCb = null;
            if (uri == null) { resolve(cb, null); return; }
            io.execute(() -> resolve(cb, readText(uri)));
            return;
        }
        if (req == REQ_PICK) {
            String cb = pickCb; pickCb = null;
            if (uri == null) { resolve(cb, null); return; }
            importUri(uri, json -> resolve(cb, json));
        } else if (req == REQ_SAVE) {
            String cb = saveCb; byte[] bytes = saveData; saveCb = null; saveData = null;
            if (uri == null || bytes == null) { resolve(cb, "false"); return; }
            io.execute(() -> {
                boolean ok;
                try (OutputStream o = getContentResolver().openOutputStream(uri, "wt")) { o.write(bytes); ok = true; } catch (Exception e) { ok = false; }
                resolve(cb, ok ? "true" : "false");
            });
        }
    }

    // ── import: a CSV or JSON export picked from Files, handed to the UI as text ──
    void pickText(String cb) {
        if (textCb != null) resolve(textCb, null);
        textCb = cb;
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*")
                .putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"text/csv", "text/comma-separated-values", "text/plain", "application/json", "application/octet-stream"});
        try { startActivityForResult(i, REQ_TEXT); } catch (Exception e) { resolve(cb, null); textCb = null; }
    }
    private String readText(Uri uri) {
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
            byte[] buf = new byte[16384]; int n; long total = 0;
            while ((n = in.read(buf)) > 0) { bo.write(buf, 0, n); total += n; if (total > 20_000_000) break; }
            String name = "";
            try (android.database.Cursor c = getContentResolver().query(uri, new String[]{android.provider.OpenableColumns.DISPLAY_NAME}, null, null, null)) {
                if (c != null && c.moveToFirst()) name = c.getString(0);
            } catch (Exception ignored) {}
            return new JSONObject().put("name", name == null ? "" : name).put("text", bo.toString("UTF-8")).toString();
        } catch (Exception e) { return "{\"error\":\"unreadable\"}"; }
    }

    // ── profile photo: picked from the gallery, cropped to a 256 px square on the phone ──
    void pickImage(String cb) {
        if (imageCb != null) resolve(imageCb, null);
        imageCb = cb;
        Intent i = new Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("image/*");
        try { startActivityForResult(Intent.createChooser(i, null), REQ_IMAGE); } catch (Exception e) { resolve(cb, null); imageCb = null; }
    }
    private String squarePhoto(Uri uri) {
        try {
            android.graphics.Bitmap src;
            if (Build.VERSION.SDK_INT >= 28) {
                src = android.graphics.ImageDecoder.decodeBitmap(android.graphics.ImageDecoder.createSource(getContentResolver(), uri), (dec, info, s) -> {
                    int m = Math.min(info.getSize().getWidth(), info.getSize().getHeight());
                    if (m > 1024) dec.setTargetSampleSize(m / 512);
                    dec.setAllocator(android.graphics.ImageDecoder.ALLOCATOR_SOFTWARE);
                });
            } else {
                android.graphics.BitmapFactory.Options o = new android.graphics.BitmapFactory.Options(); o.inSampleSize = 4;
                try (InputStream in = getContentResolver().openInputStream(uri)) { src = android.graphics.BitmapFactory.decodeStream(in, null, o); }
            }
            int s = Math.min(src.getWidth(), src.getHeight());
            android.graphics.Bitmap sq = android.graphics.Bitmap.createBitmap(src, (src.getWidth() - s) / 2, (src.getHeight() - s) / 2, s, s);
            android.graphics.Bitmap out = android.graphics.Bitmap.createScaledBitmap(sq, 256, 256, true);
            java.io.ByteArrayOutputStream b = new java.io.ByteArrayOutputStream();
            out.compress(android.graphics.Bitmap.CompressFormat.JPEG, 85, b);
            return new JSONObject().put("data", "data:image/jpeg;base64," + android.util.Base64.encodeToString(b.toByteArray(), android.util.Base64.NO_WRAP)).toString();
        } catch (Throwable t) { return null; }
    }

    // ── books folder: ask for storage access, open it in the Files app ──
    void requestFolderAccess() {
        if (Library.sharedAllowed(this)) { library.relocateIfAllowed(); return; }
        if (Build.VERSION.SDK_INT >= 30) {
            try { startActivity(new Intent(android.provider.Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:" + getPackageName()))); }
            catch (Exception e) { startActivity(new Intent(android.provider.Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)); }
        } else {
            requestPermissions(new String[]{android.Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_STORAGE);
        }
    }
    @Override public void onRequestPermissionsResult(int req, String[] p, int[] r) {
        super.onRequestPermissionsResult(req, p, r);
        if (req == REQ_STORAGE) { library.relocateIfAllowed(); js("window.__vp && __vp.resume()"); }
    }
    void openFolder() {
        Uri doc = android.provider.DocumentsContract.buildDocumentUri("com.android.externalstorage.documents", "primary:" + library.relativePath());
        Intent view = new Intent(Intent.ACTION_VIEW).setDataAndType(doc, android.provider.DocumentsContract.Document.MIME_TYPE_DIR)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try { startActivity(view); return; } catch (Exception ignored) {}
        try { startActivity(new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).putExtra(android.provider.DocumentsContract.EXTRA_INITIAL_URI, doc)); return; } catch (Exception ignored) {}
        android.widget.Toast.makeText(this, "Open your file manager and go to " + library.relativePath(), android.widget.Toast.LENGTH_LONG).show();
    }

    // ── updates: the only network request, made only when the user taps "Check for updates" ──
    static final String RELEASES_API = "https://api.github.com/repos/nchanjifaithful/Volapace/releases/latest";
    String appVersion() {
        try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return "1.0"; }
    }
    void checkUpdate(String cb) {
        io.execute(() -> {
            JSONObject out = new JSONObject();
            java.net.HttpURLConnection c = null;
            try {
                out.put("current", appVersion());
                c = (java.net.HttpURLConnection) new java.net.URL(RELEASES_API).openConnection();
                c.setConnectTimeout(8000); c.setReadTimeout(8000);
                c.setRequestProperty("Accept", "application/vnd.github+json");
                c.setRequestProperty("User-Agent", "Volapace-Android");
                if (c.getResponseCode() != 200) throw new Exception("HTTP " + c.getResponseCode());
                StringBuilder sb = new StringBuilder();
                try (InputStream in = c.getInputStream()) { byte[] b = new byte[8192]; int n; while ((n = in.read(b)) > 0) sb.append(new String(b, 0, n, "UTF-8")); }
                JSONObject rel = new JSONObject(sb.toString());
                String tag = rel.optString("tag_name", "").replaceFirst("^[vV]", "");
                out.put("latest", tag);
                out.put("url", rel.optString("html_url"));
                out.put("notes", rel.optString("body", ""));
                org.json.JSONArray assets = rel.optJSONArray("assets");
                if (assets != null) for (int i = 0; i < assets.length(); i++) { String u = assets.getJSONObject(i).optString("browser_download_url"); if (u.endsWith(".apk")) { out.put("apk", u); break; } }
                out.put("newer", newer(tag, appVersion()));
            } catch (Exception e) {
                try { out.put("error", "Couldn’t reach GitHub. Check your connection and try again."); } catch (Exception ignored) {}
            } finally { if (c != null) c.disconnect(); }
            resolve(cb, out.toString());
        });
    }
    static boolean newer(String a, String b) {
        String[] x = a.split("\\."), y = b.split("\\.");
        for (int i = 0; i < Math.max(x.length, y.length); i++) {
            int p = i < x.length ? num(x[i]) : 0, q = i < y.length ? num(y[i]) : 0;
            if (p != q) return p > q;
        }
        return false;
    }
    private static int num(String s) { try { return Integer.parseInt(s.replaceAll("\\D.*$", "")); } catch (Exception e) { return 0; } }
    void openUrl(String url) {
        if (url == null || !url.startsWith("https://github.com/nchanjifaithful/Volapace")) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) {}
    }

    // ── "Open with" / "Share to" Volapace ──
    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); handleIntent(intent); }
    @SuppressWarnings("deprecation")
    private void handleIntent(Intent i) {
        if (i == null) return;
        Uri uri = null;
        if (Intent.ACTION_VIEW.equals(i.getAction())) uri = i.getData();
        else if (Intent.ACTION_SEND.equals(i.getAction())) uri = i.getParcelableExtra(Intent.EXTRA_STREAM);
        if (uri == null) return;
        i.setAction(Intent.ACTION_MAIN); // handle once
        importUri(uri, json -> {
            if (json.contains("\"error\"")) { android.widget.Toast.makeText(this, "Couldn’t open that PDF", android.widget.Toast.LENGTH_LONG).show(); return; }
            incoming = json;
            js("window.__vp && __vp.resume()");
        });
    }
    synchronized String takeIncoming() { String s = incoming; incoming = null; return s; }

    // ── theme: status / navigation bar icon colours follow the app theme ──
    @SuppressWarnings("deprecation")
    void applyTheme(boolean isDark) {
        dark = isDark;
        root.setBackgroundColor(isDark ? Color.BLACK : Color.WHITE);
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                c.setSystemBarsAppearance(isDark ? 0 : mask, mask);
            }
        } else {
            View d = getWindow().getDecorView();
            int f = d.getSystemUiVisibility();
            int light = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | (Build.VERSION.SDK_INT >= 27 ? View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : 0);
            d.setSystemUiVisibility(isDark ? f & ~light : f | light);
        }
    }

    void askNotificationPermission() {
        if (Build.VERSION.SDK_INT < 33 || askedNotify) return;
        if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return;
        askedNotify = true;
        requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFY);
    }

    // ── lifecycle ──
    @Override protected void onResume() {
        super.onResume();
        if (web != null) { web.onResume(); library.relocateIfAllowed(); library.scan(); js("window.__vp && __vp.resume()"); }
    }
    @Override protected void onPause() { if (web != null) web.onPause(); super.onPause(); }

    @SuppressWarnings("deprecation")
    @Override public void onBackPressed() {
        web.evaluateJavascript("window.__vpBack ? window.__vpBack() : false", r -> { if (!"true".equals(r)) moveTaskToBack(true); });
    }

    @Override protected void onDestroy() {
        if (web != null) { web.removeJavascriptInterface("VPNative"); web.destroy(); web = null; }
        super.onDestroy();
    }
}
