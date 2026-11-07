// platform.jsx — bridge to the Android shell (window.VPNative), with a browser fallback for development.
// Everything here is on-device: no network calls anywhere in the app.

// The real date, as a local calendar day. The app reloads itself when the day changes (see app.jsx).
const TODAY = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

const Platform = (() => {
  const N = window.VPNative || null;
  const subs = { library: new Set(), resume: new Set() };
  const pending = {};
  let seq = 0;
  const call = (fn, ...args) => new Promise((res) => { const id = 'c' + (++seq); pending[id] = res; fn(id, ...args); });
  // The native side calls these.
  window.__vp = {
    resolve(id, json) { const r = pending[id]; delete pending[id]; if (r) r(json == null ? null : JSON.parse(json)); },
    library() { subs.library.forEach(fn => fn()); },
    resume() { subs.resume.forEach(fn => fn()); },
    insets(top, bottom) { const s = document.documentElement.style; s.setProperty('--sat', top + 'px'); s.setProperty('--sab', bottom + 'px'); },
  };

  // ── Browser fallback: PDFs in IndexedDB, downloads via <a download> ──
  const idb = () => new Promise((res, rej) => {
    const r = indexedDB.open('volapace-dev', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const tx = async (mode, fn) => { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('files', mode); const q = fn(t.objectStore('files')); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); };
  const devFiles = () => tx('readonly', s => s.getAll());
  const blobUrls = {};
  const hashBuf = async (buf) => { const h = await crypto.subtle.digest('SHA-1', buf); return 'h' + [...new Uint8Array(h)].slice(0, 10).map(b => b.toString(16).padStart(2, '0')).join(''); };
  const download = (name, blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  const b64ToBlob = (b64, mime) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: mime }); };

  return {
    native: !!N,
    onLibrary(fn) { subs.library.add(fn); return () => subs.library.delete(fn); },
    onResume(fn) { subs.resume.add(fn); return () => subs.resume.delete(fn); },

    // Files in the Volapace folder: [{ id, name, size, mtime, pages, title, cover }]
    async listFiles() {
      if (N) return JSON.parse(N.listFiles() || '[]');
      return (await devFiles()).map(f => ({ id: f.id, name: f.name, size: f.buf.byteLength, mtime: f.added, pages: f.pages, title: f.title, cover: f.cover || null, added: f.added }));
    },
    rescan() { if (N) N.rescan(); },
    folderLabel() { return N ? N.folderLabel() : 'Browser storage'; },
    pdfUrl(id) {
      if (N) return '/pdf/' + encodeURIComponent(id);
      return blobUrls[id] || null;
    },
    async pdfSource(id) {
      if (N) return { url: '/pdf/' + encodeURIComponent(id) };
      const f = await tx('readonly', s => s.get(id));
      if (!f) throw new Error('missing');
      return { data: new Uint8Array(f.buf.slice(0)) };
    },
    coverUrl(f) { return N ? (f.cover ? '/cover/' + encodeURIComponent(f.id) + '.jpg?v=' + f.mtime : null) : (f.cover || null); },
    // Pick a PDF; it is copied into the Volapace folder. Resolves with its file entry, or null if cancelled.
    pickPdf() {
      if (N) return call((id) => N.pickPdf(id));
      return new Promise((res) => {
        const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/pdf,.pdf';
        input.onchange = async () => {
          const file = input.files[0]; if (!file) return res(null);
          const buf = await file.arrayBuffer(); const id = await hashBuf(buf);
          let pages = 0, cover = null;
          try { const lib = await loadPdfJs(); const doc = await lib.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise; pages = doc.numPages; cover = await coverDataURL(doc); } catch (e) { return res({ error: 'unreadable' }); }
          const rec = { id, name: file.name, buf, pages, cover, title: file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' '), added: Date.now() };
          await tx('readwrite', s => s.put(rec, id));
          subs.library.forEach(fn => fn());
          res({ id, name: rec.name, size: buf.byteLength, mtime: rec.added, pages, title: rec.title, cover, added: rec.added });
        };
        input.click();
      });
    },
    async deleteFile(id) {
      if (N) return N.deleteFile(id);
      await tx('readwrite', s => s.delete(id)); return true;
    },
    // Save a file through the system document picker (Files). data is base64.
    saveFile(name, mime, b64) {
      if (N) return call((id) => N.saveFile(id, name, mime, b64));
      download(name, b64ToBlob(b64, mime)); return Promise.resolve(true);
    },
    shareFile(name, mime, b64, text) {
      if (N) { N.shareFile(name, mime, b64, text || ''); return Promise.resolve(true); }
      download(name, b64ToBlob(b64, mime)); return Promise.resolve(true);
    },
    setReminder(cfg) { if (N) N.setReminder(JSON.stringify(cfg)); },
    notificationsAllowed() { return N ? N.notificationsAllowed() : true; },
    setTheme(dark, bg) { if (N) N.setTheme(!!dark, bg || (dark ? '#000000' : '#FFFFFF')); },
    vibrate(pattern) { if (N) N.vibrate(pattern.join(',')); else if (navigator.vibrate) navigator.vibrate(pattern); },
    copy(text) { if (N) N.copy(text); else if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {}); },
    confirm(title, message, ok) {
      if (N) return call((id) => N.confirm(id, title, message, ok || 'OK'));
      return Promise.resolve(window.confirm(message ? title + '\n\n' + message : title));
    },
    toast(msg) { if (N) N.toast(msg); },
    // Adds Highlight / Note to Android's text-selection menu while the reader is open.
    setSelectionTools(on) { if (N && N.setSelectionTools) N.setSelectionTools(!!on); },
    // Profile photo: resolves with a small square JPEG data URL, or null.
    pickImage() {
      if (N) return call((id) => N.pickImage(id)).then(r => (r && r.data) || null);
      return new Promise((res) => {
        const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
        input.onchange = () => {
          const f = input.files[0]; if (!f) return res(null);
          const img = new Image(); img.onload = () => {
            const s = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = 256;
            c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256);
            res(c.toDataURL('image/jpeg', 0.85)); URL.revokeObjectURL(img.src);
          };
          img.onerror = () => res(null); img.src = URL.createObjectURL(f);
        };
        input.click();
      });
    },
    // The books folder: { path, shared (top-level folder in use), canShare (permission can be asked) }
    folderInfo() { return N && N.folderInfo ? JSON.parse(N.folderInfo()) : { path: 'Browser storage', shared: false, canShare: false }; },
    requestFolderAccess() { if (N && N.requestFolderAccess) N.requestFolderAccess(); },
    openFolder() { if (N && N.openFolder) N.openFolder(); },
    appVersion() { return N && N.appVersion ? N.appVersion() : 'dev'; },
    // Asks GitHub for the latest release (the only network request the app makes, and only when tapped).
    checkUpdate() { return N && N.checkUpdate ? call((id) => N.checkUpdate(id)) : Promise.resolve({ error: 'Only available in the Android app' }); },
    openUrl(url) { if (N && N.openUrl) N.openUrl(url); else window.open(url, '_blank'); },
    // A book handed to Volapace from another app ("Open with" / "Share"), if any.
    takeIncoming() { return N ? JSON.parse(N.takeIncoming() || 'null') : null; },
  };
})();

const blobToB64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
const textToB64 = (s) => { const u = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(bin); };

Object.assign(window, { TODAY, Platform, blobToB64, textToB64 });
