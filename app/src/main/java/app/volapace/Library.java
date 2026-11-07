package app.volapace;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.FileObserver;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import android.database.Cursor;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * The "On this phone" library: every PDF in the Volapace folder.
 *
 * The folder is app-specific external storage (Android/data/app.volapace/files/Volapace), so it
 * needs no storage permission and is reachable over USB. Files are indexed, not opened: the index
 * (index.json) keeps one row per file with its content-hash id, size, modified time, page count and
 * title, and only new or changed files are parsed. Ids are content hashes, so progress survives a
 * rename and duplicate copies collapse into one book. Covers are page-1 thumbnails rendered on a
 * small background pool (2 at a time) and cached on disk.
 */
final class Library {
    interface Listener { void onChanged(); }

    static final class Row {
        String id, name; long size, mtime, added; int pages; String title; boolean cover;
        JSONObject toJson() throws Exception {
            JSONObject o = new JSONObject();
            o.put("id", id); o.put("name", name); o.put("size", size); o.put("mtime", mtime);
            o.put("added", added); o.put("pages", pages); o.put("title", title); o.put("cover", cover);
            return o;
        }
        static Row fromJson(JSONObject o) {
            Row r = new Row();
            r.id = o.optString("id"); r.name = o.optString("name"); r.size = o.optLong("size"); r.mtime = o.optLong("mtime");
            r.added = o.optLong("added"); r.pages = o.optInt("pages"); r.title = o.optString("title"); r.cover = o.optBoolean("cover");
            return r;
        }
    }

    private final Context ctx;
    private final File dir, indexFile, coverDir;
    private final Map<String, Row> byName = new HashMap<>();   // file name -> row
    private final ExecutorService scanner = Executors.newSingleThreadExecutor();
    private final ExecutorService covers = Executors.newFixedThreadPool(2);
    private final Handler main = new Handler(Looper.getMainLooper());
    private Listener listener;
    private FileObserver observer;
    private boolean scanQueued;

    Library(Context c) {
        ctx = c.getApplicationContext();
        File base = ctx.getExternalFilesDir(null);
        if (base == null) base = ctx.getFilesDir();
        dir = new File(base, "Volapace");
        dir.mkdirs();
        indexFile = new File(ctx.getFilesDir(), "index.json");
        coverDir = new File(ctx.getCacheDir(), "covers");
        coverDir.mkdirs();
        load();
    }

    File folder() { return dir; }
    String folderLabel() { return "Android/data/" + ctx.getPackageName() + "/files/Volapace"; }
    void setListener(Listener l) { listener = l; }

    @SuppressWarnings("deprecation")
    void watch() {
        if (observer != null) return;
        observer = new FileObserver(dir.getAbsolutePath(), FileObserver.CLOSE_WRITE | FileObserver.MOVED_TO | FileObserver.MOVED_FROM | FileObserver.DELETE) {
            @Override public void onEvent(int event, String path) { if (path != null && path.toLowerCase().endsWith(".pdf")) main.postDelayed(Library.this::scan, 400); }
        };
        observer.startWatching();
    }

    // ── index persistence ──
    private synchronized void load() {
        try {
            if (!indexFile.exists()) return;
            JSONArray a = new JSONArray(readText(indexFile));
            for (int i = 0; i < a.length(); i++) { Row r = Row.fromJson(a.getJSONObject(i)); byName.put(r.name, r); }
        } catch (Exception ignored) {}
    }
    private synchronized void save() {
        try {
            JSONArray a = new JSONArray();
            for (Row r : byName.values()) a.put(r.toJson());
            File tmp = new File(indexFile.getPath() + ".tmp");
            try (OutputStream o = new FileOutputStream(tmp)) { o.write(a.toString().getBytes("UTF-8")); }
            tmp.renameTo(indexFile);
        } catch (Exception ignored) {}
    }

    /** Books ready to show: indexed, readable, one per content hash. */
    synchronized String listJson() {
        JSONArray a = new JSONArray();
        Set<String> seen = new HashSet<>();
        List<Row> rows = new ArrayList<>(byName.values());
        rows.sort((x, y) -> Long.compare(x.added, y.added));
        for (Row r : rows) {
            if (r.pages <= 0 || r.id == null || r.id.isEmpty() || !seen.add(r.id)) continue;
            try { a.put(r.toJson()); } catch (Exception ignored) {}
        }
        return a.toString();
    }
    synchronized File fileFor(String id) {
        for (Row r : byName.values()) if (id.equals(r.id)) { File f = new File(dir, r.name); if (f.exists()) return f; }
        return null;
    }
    File coverFile(String id) { return new File(coverDir, id + ".jpg"); }

    synchronized boolean delete(String id) {
        boolean any = false;
        for (Row r : new ArrayList<>(byName.values())) {
            if (!id.equals(r.id)) continue;
            File f = new File(dir, r.name);
            if (!f.exists() || f.delete()) { byName.remove(r.name); any = true; }
        }
        coverFile(id).delete();
        save();
        return any;
    }

    // ── incremental scan: compare (name, size, mtime); parse only new or changed files ──
    void scan() {
        synchronized (this) { if (scanQueued) return; scanQueued = true; }
        scanner.execute(() -> {
            synchronized (this) { scanQueued = false; }
            boolean changed = false;
            File[] files = dir.listFiles();
            Set<String> present = new HashSet<>();
            if (files != null) for (File f : files) {
                if (!f.isFile() || !f.getName().toLowerCase().endsWith(".pdf")) continue;
                present.add(f.getName());
                Row r;
                synchronized (this) { r = byName.get(f.getName()); }
                if (r != null && r.size == f.length() && r.mtime == f.lastModified()) continue;
                Row n = index(f, r);
                synchronized (this) { byName.put(f.getName(), n); }
                changed = true;
            }
            synchronized (this) {
                for (String name : new ArrayList<>(byName.keySet())) if (!present.contains(name)) { byName.remove(name); changed = true; }
            }
            if (changed) { save(); notifyChanged(); }
            queueCovers();
        });
    }

    /** Index one file now (used right after copying a picked file in). */
    Row indexNow(File f) {
        Row n = index(f, null);
        synchronized (this) { byName.put(f.getName(), n); }
        save();
        renderCover(n);
        return n;
    }

    private Row index(File f, Row old) {
        Row n = new Row();
        n.name = f.getName(); n.size = f.length(); n.mtime = f.lastModified();
        n.added = old != null && old.added > 0 ? old.added : System.currentTimeMillis();
        n.title = titleFromName(f.getName());
        try { n.id = hash(f); } catch (Exception e) { n.id = ""; }
        // a renamed file keeps its id; reuse what we know about that content
        Row same = null;
        synchronized (this) { for (Row r : byName.values()) if (n.id.equals(r.id) && r.pages > 0) { same = r; break; } }
        if (same != null) { n.pages = same.pages; n.added = Math.min(n.added, same.added); n.cover = coverFile(n.id).exists(); return n; }
        try (ParcelFileDescriptor pfd = ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY);
             PdfRenderer pr = new PdfRenderer(pfd)) {
            n.pages = pr.getPageCount();
        } catch (Throwable t) { n.pages = -1; } // encrypted or damaged: skipped, not retried until it changes
        n.cover = coverFile(n.id).exists();
        return n;
    }

    private void queueCovers() {
        List<Row> todo = new ArrayList<>();
        synchronized (this) { for (Row r : byName.values()) if (r.pages > 0 && !r.cover) todo.add(r); }
        for (Row r : todo) covers.execute(() -> { if (renderCover(r)) { save(); notifyChanged(); } });
    }

    private boolean renderCover(Row r) {
        File out = coverFile(r.id);
        if (out.exists()) { r.cover = true; return true; }
        File f = new File(dir, r.name);
        try (ParcelFileDescriptor pfd = ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY);
             PdfRenderer pr = new PdfRenderer(pfd);
             PdfRenderer.Page page = pr.openPage(0)) {
            int w = 240, h = Math.max(1, Math.round(w * (float) page.getHeight() / page.getWidth()));
            Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            new Canvas(bmp).drawColor(Color.WHITE);
            page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
            File tmp = new File(out.getPath() + ".tmp");
            try (OutputStream o = new FileOutputStream(tmp)) { bmp.compress(Bitmap.CompressFormat.JPEG, 82, o); }
            bmp.recycle();
            tmp.renameTo(out);
            r.cover = true;
            return true;
        } catch (Throwable t) { return false; }
    }

    private void notifyChanged() { main.post(() -> { if (listener != null) listener.onChanged(); }); }

    /** Copy a picked/shared PDF into the folder. Reuses an identical file already there. */
    File importUri(Uri uri) throws Exception {
        String name = displayName(uri);
        if (name == null || name.trim().isEmpty()) name = "Book.pdf";
        name = name.replaceAll("[\\\\/:*?\"<>|]", "_");
        if (!name.toLowerCase().endsWith(".pdf")) name += ".pdf";
        File tmp = new File(dir, ".incoming-" + System.nanoTime());
        try (InputStream in = ctx.getContentResolver().openInputStream(uri); OutputStream o = new FileOutputStream(tmp)) {
            if (in == null) throw new Exception("unreadable");
            byte[] buf = new byte[64 * 1024]; int n;
            while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
        }
        String id = hash(tmp);
        synchronized (this) {
            for (Row r : byName.values()) if (id.equals(r.id)) { File have = new File(dir, r.name); if (have.exists()) { tmp.delete(); return have; } }
        }
        File dest = new File(dir, name);
        String base = name.substring(0, name.length() - 4);
        for (int i = 2; dest.exists(); i++) dest = new File(dir, base + " (" + i + ").pdf");
        if (!tmp.renameTo(dest)) { tmp.delete(); throw new Exception("copy failed"); }
        return dest;
    }

    private String displayName(Uri uri) {
        if ("file".equals(uri.getScheme())) return new File(uri.getPath()).getName();
        try (Cursor c = ctx.getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception ignored) {}
        String last = uri.getLastPathSegment();
        return last == null ? null : last.replaceAll(".*/", "");
    }

    // SHA-1 of size + first 64 KB + last 64 KB: fast on large files, stable across renames.
    static String hash(File f) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-1");
        long len = f.length();
        md.update(Long.toString(len).getBytes());
        try (RandomAccessFile raf = new RandomAccessFile(f, "r")) {
            byte[] buf = new byte[(int) Math.min(65536, len)];
            raf.readFully(buf); md.update(buf);
            if (len > 65536) {
                long from = Math.max(65536, len - 65536);
                byte[] tail = new byte[(int) (len - from)];
                raf.seek(from); raf.readFully(tail); md.update(tail);
            }
        }
        byte[] d = md.digest();
        StringBuilder sb = new StringBuilder("h");
        for (int i = 0; i < 10; i++) sb.append(String.format("%02x", d[i]));
        return sb.toString();
    }

    static String titleFromName(String name) {
        String t = name.replaceAll("(?i)\\.pdf$", "").replaceAll("[_]+", " ").replaceAll("\\s+-\\s+|-{2,}", " - ").trim();
        return t.isEmpty() ? "Untitled" : t;
    }

    static String readText(File f) throws Exception {
        try (InputStream in = new FileInputStream(f)) {
            byte[] b = new byte[(int) f.length()]; int off = 0, n;
            while (off < b.length && (n = in.read(b, off, b.length - off)) > 0) off += n;
            return new String(b, 0, off, "UTF-8");
        }
    }
}
