// reader.jsx — core: PDF engine (bundled pdf.js), on-device library, plan math, streak model, shared book UI

// ── pdf.js: bundled in the app (vendor/pdf.min.js), worker served from the app too ──
function loadPdfJs() {
  const lib = window.pdfjsLib;
  if (!lib) return Promise.reject(new Error('pdf.js missing'));
  if (!lib.GlobalWorkerOptions.workerSrc) lib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
  return Promise.resolve(lib);
}

// ── On-device library ─────────────────────────────────────────
// The source of truth is the Volapace folder on the phone. The native side indexes it
// (content hash id, page count, cover thumbnail) and we merge that index with each book's
// progress snapshot, kept in localStorage 'vp_lib'. Paper books have no file (paper: true).
const Lib = {
  _l: null, subs: new Set(),
  list() { if (!this._l) { try { this._l = JSON.parse(localStorage.getItem('vp_lib')) || []; } catch { this._l = []; } } return this._l; },
  save(list) { this._l = list; try { localStorage.setItem('vp_lib', JSON.stringify(list)); } catch (e) {} this.subs.forEach(fn => fn()); },
  subscribe(fn) { this.subs.add(fn); return () => this.subs.delete(fn); },
  get(id) { return this.list().find(b => b.id === id) || null; },
  heal() { const l = this.list(); let ch = false; l.forEach(e => { if (e.snap && e.snap.pages && e.pages && e.snap.pages !== e.pages) { delete e.snap; ch = true; } }); if (ch) this.save([...l]); },
  upsert(entry) { const l = [...this.list()]; const i = l.findIndex(b => b.id === entry.id); if (i >= 0) l[i] = { ...l[i], ...entry }; else l.unshift(entry); this.save(l); },
  async remove(id) {
    const e = this.get(id);
    if (e && !e.paper) await Platform.deleteFile(id);
    this.save(this.list().filter(b => b.id !== id));
  },
  // Merge the folder index into the library. Progress survives renames because ids are content hashes.
  async sync() {
    let files;
    try { files = await Platform.listFiles(); } catch (e) { return; }
    const byId = new Map(this.list().map(e => [e.id, e]));
    const seen = new Set(); let changed = false;
    const next = [];
    for (const f of files) {
      seen.add(f.id);
      const old = byId.get(f.id);
      const cover = Platform.coverUrl(f);
      if (!old) { next.push({ id: f.id, file: f.name, title: f.title || f.name.replace(/\.pdf$/i, ''), author: '', pages: f.pages || 0, cover, addedAt: f.added || f.mtime || Date.now() }); changed = true; continue; }
      const upd = { ...old };
      if (old.file !== f.name) { upd.file = f.name; if (!old.metaTitle) upd.title = f.title || old.title; changed = true; }
      if (f.pages && old.pages !== f.pages) { upd.pages = f.pages; changed = true; }
      if (cover !== old.cover) { upd.cover = cover; changed = true; }
      next.push(upd);
    }
    // keep paper books; drop files that left the folder
    for (const e of this.list()) { if (e.paper) next.push(e); else if (!seen.has(e.id)) changed = true; }
    // most recently opened / added first
    next.sort((a, b) => Math.max(b.lastOpened || 0, b.addedAt || 0) - Math.max(a.lastOpened || 0, a.addedAt || 0));
    if (changed || next.length !== this.list().length) this.save(next);
  },
};
function useLib() {
  const [, set] = React.useState(0);
  React.useEffect(() => Lib.subscribe(() => set(t => t + 1)), []);
  return Lib.list();
}

// Fields that belong to one book (swapped in/out when you switch books)
const BOOK_FIELDS = ['fromScan', 'planStart', 'planVer', 'bookId', 'title', 'author', 'pages', 'hasPdf', 'page', 'skip', 'days', 'ppd', 'doneDays', 'mode', 'time', 'remindOn', 'catchUp', 'bookmarks', 'highlights', 'goalType', 'minutes', 'planDays', 'finishedAt', 'pageLook', 'scrollMode', 'vSnap', 'readerZoom'];
const pickBook = (ctx) => BOOK_FIELDS.reduce((o, k) => (ctx[k] !== undefined ? { ...o, [k]: ctx[k] } : o), {});
const clearBook = (ctx) => { const c = { ...ctx }; BOOK_FIELDS.forEach(k => delete c[k]); return c; };

async function coverDataURL(doc, w = 160) {
  const page = await doc.getPage(1); const v0 = page.getViewport({ scale: 1 }); const vp = page.getViewport({ scale: w / v0.width });
  const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
  await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  return c.toDataURL('image/jpeg', 0.72);
}

// Content-hash ids make duplicate files collapse on their own (the native index keeps one per hash).
async function dedupeLibrary() {}

// Chapter start pages from the PDF outline (empty when the PDF has none)
async function outlinePages(doc) {
  try {
    const items = await doc.getOutline(); if (!items) return [];
    const out = [];
    for (const it of items) {
      try {
        let dest = it.dest; if (typeof dest === 'string') dest = await doc.getDestination(dest);
        if (!dest) continue;
        const idx = await doc.getPageIndex(dest[0]);
        out.push({ title: it.title, page: idx + 1 });
      } catch (e) {}
    }
    return out.sort((a, b) => a.page - b.page);
  } catch (e) { return []; }
}

// One open document, cached in memory
const PdfStore = {
  doc: null, id: null, chapters: [],
  subs: new Set(),
  subscribe(fn) { this.subs.add(fn); return () => this.subs.delete(fn); },
  async openId(id) {
    if (this.id === id && this.doc) return this.doc;
    if (this._opening && this._openingId === id) return this._opening;
    this._openingId = id;
    this._opening = (async () => {
      const lib = await loadPdfJs();
      const src = await Platform.pdfSource(id);
      const doc = await lib.getDocument({ ...src, isEvalSupported: false }).promise;
      if (this._openingId !== id) return doc;
      if (this.doc && this.doc !== doc) this.doc.destroy().catch(() => {});
      this.doc = doc; this.id = id; this.chapters = [];
      try { localStorage.setItem('vp_current', id); } catch (e) {}
      this.subs.forEach(fn => fn(doc));
      // upgrade title / author from the PDF's info dictionary, once
      const e = Lib.get(id);
      if (e && !e.metaChecked) {
        const meta = await doc.getMetadata().catch(() => null);
        const t = meta && meta.info && meta.info.Title && String(meta.info.Title).trim();
        const a = meta && meta.info && meta.info.Author && String(meta.info.Author).trim();
        const good = t && t.length > 1 && !/^(untitled|microsoft word|document|\d+)$/i.test(t) && !/\.(docx?|pdf|indd|tex)$/i.test(t);
        Lib.upsert({ id, metaChecked: true, ...(good ? { title: t, metaTitle: true } : {}), ...(a ? { author: a } : {}), ...(!e.pages ? { pages: doc.numPages } : {}) });
      }
      outlinePages(doc).then(ch => { if (this.doc === doc) { this.chapters = ch; this.subs.forEach(fn => fn(doc)); } });
      return doc;
    })().finally(() => { this._opening = null; });
    return this._opening;
  },
  // Pick a PDF; it is copied into the Volapace folder and opened.
  async importPicked() {
    const f = await Platform.pickPdf();
    if (!f) return null;
    if (f.error) throw new Error(f.error);
    await Lib.sync();
    if (!Lib.get(f.id)) Lib.upsert({ id: f.id, file: f.name, title: f.title || f.name.replace(/\.pdf$/i, ''), author: '', pages: f.pages || 0, cover: Platform.coverUrl(f), addedAt: Date.now() });
    const doc = await this.openId(f.id);
    return { doc, entry: Lib.get(f.id) };
  },
  async restore() {
    if (this.doc && this.id) return this.doc;
    let cur = null; try { cur = localStorage.getItem('vp_current'); } catch (e) {}
    if (!cur || !Lib.get(cur)) return null;
    return this.openId(cur).catch(() => null);
  },
};
function useChapters() {
  const [ch, set] = React.useState(() => PdfStore.chapters);
  React.useEffect(() => { const un = PdfStore.subscribe(() => set(PdfStore.chapters)); return un; }, []);
  return ch;
}

// ── Plan math (shared by Today, Plan, Reader) ─────────────────
// Pages that count as reading (everything not in ctx.skip)
function readingList(ctx) {
  const total = ctx.pages || 1, ex = new Set(ctx.skip || []), out = [];
  for (let p = 1; p <= total; p++) if (!ex.has(p)) out.push(p);
  return out.length ? out : [1];
}
// number of reading pages strictly before page p
function readIdx(list, p) { let lo = 0, hi = list.length; while (lo < hi) { const m = (lo + hi) >> 1; if (list[m] < p) lo = m + 1; else hi = m; } return lo; }

const PAGES_PER_HOUR = 32;
function planOf(ctx) {
  const pages = ctx.pages || 1;
  const goalType = ctx.goalType || 'pages';
  const minutes = ctx.minutes || 20;
  const list = readingList(ctx), n = list.length;
  const days = ctx.days || 1;
  const ppd = ctx.ppd || Math.ceil(n / days);
  const doneDays = ctx.doneDays ?? 0;
  const start = Math.min(n - 1, ctx.planStart || 0);
  const fromIdx = Math.min(n - 1, start + doneDays * ppd);
  const toIdx = Math.min(n - 1, fromIdx + ppd - 1);
  return { goalType, minutes, pages, list, reading: n, skipped: pages - n, days, ppd, doneDays, day: Math.min(days, doneDays + 1), fromIdx, from: list[fromIdx], to: list[toIdx], goal: toIdx - fromIdx + 1, title: ctx.title || 'Your book', finished: doneDays >= days || start + doneDays * ppd >= n, start };
}

// ── Streak model: set of ISO dates on which the daily goal was met ──
const dayISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shiftDay = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
function doneSet(ctx) { return new Set(ctx.doneDates || []); }
function streakCount(set) {
  let d = set.has(dayISO(TODAY)) ? TODAY : shiftDay(TODAY, -1), n = 0;
  while (set.has(dayISO(d))) { n++; d = shiftDay(d, -1); }
  return n;
}
function markTodayDone(ctx) {
  const set = doneSet(ctx); set.add(dayISO(TODAY));
  return { doneDates: [...set], doneDays: (ctx.doneDays ?? 0) + 1 };
}

// ── Streak strip ──────────────────────────────────────────────
function StreakWeek({ ctx, compact, style = {} }) {
  const set = doneSet(ctx);
  const n = streakCount(set);
  const todayDone = set.has(dayISO(TODAY));
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(TODAY, i - 6));
  const L = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return (
    <div style={{ padding: compact ? 0 : 16, borderRadius: 'var(--card-radius)', border: compact ? 'none' : '1px solid var(--line)', ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="flame" size={20} style={{ color: 'var(--sage)' }} />
          <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 17, color: 'var(--ink)', letterSpacing: -0.2 }}>{n}-day streak</span>
        </div>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: todayDone ? 'var(--sage)' : 'var(--ink-2)', fontWeight: todayDone ? 600 : 400 }}>{todayDone ? 'Today done' : 'Read today to keep it'}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {days.map((d, i) => {
          const done = set.has(dayISO(d));
          const isToday = i === 6;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 36, height: 36, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? 'var(--sage)' : 'var(--fill)', color: '#fff',
                border: isToday && !done ? '1.5px dashed var(--ink-3)' : '1.5px solid transparent',
                animation: isToday && done ? 'pop .4s cubic-bezier(.2,1.4,.4,1)' : 'none' }}>
                {done && <Icon name="check" size={17} stroke={2.6} />}
              </div>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11.5, fontWeight: isToday ? 600 : 400, color: isToday ? 'var(--ink)' : 'var(--ink-3)' }}>{L[d.getDay()]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Page renderers ────────────────────────────────────────────
const RenderQ = { active: 0, max: 4, q: [],
  run(job) { return new Promise((res, rej) => { this.q.push({ job, res, rej }); this.pump(); }); },
  pump() { while (this.active < this.max && this.q.length) { const { job, res, rej } = this.q.shift(); this.active++; job().then(res, rej).finally(() => { this.active--; this.pump(); }); } },
};

function PdfPage({ doc, n, width, onSize, textLayer }) {
  const ref = React.useRef(null);
  const tl = React.useRef(null);
  React.useEffect(() => {
    let task, ttask, cancelled = false;
    const thumb = width <= 120;
    const work = () => doc.getPage(n).then(page => {
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const scale = width / base.width;
      const vp = page.getViewport({ scale: scale * (window.devicePixelRatio || 1) });
      const c = ref.current; if (!c) return;
      c.width = vp.width; c.height = vp.height;
      c.style.width = width + 'px'; c.style.height = (base.height * scale) + 'px';
      onSize && onSize(base.height * scale);
      task = page.render({ canvasContext: c.getContext('2d'), viewport: vp });
      if (textLayer && tl.current && window.pdfjsLib.renderTextLayer) {
        const box = tl.current; box.innerHTML = ''; box.style.setProperty('--scale-factor', scale);
        page.getTextContent().then(tc => {
          if (cancelled) return;
          ttask = window.pdfjsLib.renderTextLayer({ textContentSource: tc, container: box, viewport: page.getViewport({ scale }), textDivs: [] });
          ttask.promise && ttask.promise.catch(() => {});
        });
      }
      if (!thumb && n < doc.numPages) doc.getPage(n + 1); // warm next page (reader only)
      return task.promise.catch(() => {});
    });
    if (thumb) RenderQ.run(() => cancelled ? Promise.resolve() : work()); else work();
    return () => { cancelled = true; task && task.cancel(); ttask && ttask.cancel && ttask.cancel(); };
  }, [doc, n, width, textLayer]);
  if (!textLayer) return <canvas ref={ref} style={{ display: 'block', background: '#fff' }} />;
  return (
    <div style={{ position: 'relative' }}>
      <canvas ref={ref} style={{ display: 'block', background: '#fff' }} />
      <div ref={tl} className="textLayer" />
    </div>
  );
}

const SAMPLE_PARA = 'In my younger and more vulnerable years my father gave me some advice that I\u2019ve been turning over in my mind ever since. \u201cWhenever you feel like criticizing any one,\u201d he told me, \u201cjust remember that all the people in this world haven\u2019t had the advantages that you\u2019ve had.\u201d He didn\u2019t say any more, but we\u2019ve always been unusually communicative in a reserved way, and I understood that he meant a great deal more than that.';
const SAMPLE_CH = [1, 23, 46, 69, 93, 117, 141, 165, 191];

function SamplePage({ n, width }) {
  const ch = SAMPLE_CH.indexOf(n);
  const fs = width / 26;
  return (
    <div style={{ width, aspectRatio: '1 / 1.45', background: '#fff', color: '#1a1a1a', boxSizing: 'border-box', padding: `${width * 0.1}px ${width * 0.09}px`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {ch >= 0 && <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: fs * 1.9, textAlign: 'center', margin: `${fs * 2}px 0 ${fs * 1.6}px` }}>{['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][ch]}</div>}
      <div style={{ flex: 1, overflow: 'hidden', fontFamily: 'Newsreader, Georgia, serif', fontSize: fs, lineHeight: 1.5, textAlign: 'justify', hyphens: 'auto' }}>
        {[0, 1, 2].map(k => <p key={k} style={{ margin: 0, textIndent: k || ch < 0 ? fs * 1.4 : 0 }}>{SAMPLE_PARA}</p>)}
      </div>
      <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: fs * 0.8, textAlign: 'center', color: '#888', marginTop: fs }}>{n}</div>
    </div>
  );
}

// ── Continue-reading progress card ────────────────────────────
function ProgressCard({ book, page, total, onClick, style = {} }) {
  page = Math.max(0, Math.min(total, page));
  const pct = Math.min(100, Math.round((page / Math.max(1, total)) * 100));
  return (
    <button onClick={onClick} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 12, borderRadius: 18, border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left', width: '100%', ...style }}>
      <BookCover book={book} w={56} radius={7} style={{ boxShadow: 'none' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 16, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: -0.2 }}>{book.title}</div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2 }}>{book.author && book.author !== 'PDF' && book.author !== 'On this phone' ? `By ${book.author}` : (book.paper ? 'Paper book' : 'On this phone')}</div>
        <div style={{ margin: '12px 0 7px' }}><ProgressBar value={pct} height={5} fill="var(--ink)" /></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-ui)', fontSize: 11.5, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>
          <span>{pct}% complete</span><span>Page {Math.max(1, page)} of {total}</span>
        </div>
      </div>
    </button>
  );
}
function currentBook(ctx) {
  const plan = planOf(ctx);
  const entry = (ctx.bookId && Lib.get(ctx.bookId)) || { id: ctx.bookId || 'current', title: plan.title, author: ctx.author || '', pages: plan.pages, paper: !ctx.hasPdf };
  const book = entryBook(entry, { ...ctx, bookId: entry.id });
  return { book, page: Math.max(0, (ctx.page || plan.from) - 1), total: plan.pages };
}
const bookPage = (b) => b.page != null ? b.page : Math.round((b.planPct / 100) * b.pages);

// ── Page picker: tap pages that aren't reading (covers, contents, notes) ──
function parseRanges(txt, total) {
  const out = [];
  txt.split(/[,\s]+/).forEach(part => {
    const m = part.match(/^(\d+)(?:[-\u2013](\d+))?$/); if (!m) return;
    let a = +m[1], b = m[2] ? +m[2] : a; if (a > b) [a, b] = [b, a];
    for (let p = Math.max(1, a); p <= Math.min(total, b); p++) out.push(p);
  });
  return out;
}
function compactRanges(pages) {
  const s = [...pages].sort((a, b) => a - b), out = [];
  for (let i = 0; i < s.length; i++) { let j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++; out.push(i === j ? `${s[i]}` : `${s[i]}\u2013${s[j]}`); i = j; }
  return out;
}

function Thumb({ n, doc, off, locked, onClick, show, w }) {
  const [seen, setSeen] = React.useState(false);
  React.useEffect(() => { if (show && !seen) setSeen(true); }, [show]);
  return (
    <button onClick={onClick} disabled={locked} style={{ background: 'none', border: 'none', padding: 0, cursor: locked ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1.42', borderRadius: 6, overflow: 'hidden', background: '#fff',
        border: off ? '1.5px solid var(--sage)' : '1px solid var(--line)', opacity: off ? 0.45 : 1, transition: 'opacity .12s' }}>
        {doc && seen && w > 0 ? <PdfPage doc={doc} n={n} width={w} /> : (
          <div style={{ padding: '18% 14%', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[90, 100, 95, 100, 70, 100, 85].map((w, i) => <div key={i} style={{ height: 2, width: w + '%', background: '#E4E4E4', borderRadius: 2 }} />)}
          </div>
        )}
        {off && <div style={{ position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 999, background: 'var(--sage)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="close" size={11} stroke={2.8} /></div>}
      </div>
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: off ? 'var(--sage)' : 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
    </button>
  );
}

function PagePicker({ total, initial, locked, onDone, close }) {
  const [off, setOff] = React.useState(() => new Set(initial));
  const [doc, setDoc] = React.useState(() => PdfStore.doc);
  const [txt, setTxt] = React.useState('');
  const [top, setTop] = React.useState(0);
  const [tileW, setTileW] = React.useState(0);
  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    const un = PdfStore.subscribe(setDoc);
    if (PdfStore.doc) setDoc(PdfStore.doc); else PdfStore.restore().then(d => d && setDoc(d)).catch(() => {});
    return un;
  }, []);
  React.useLayoutEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const measure = () => setTileW(Math.floor((el.clientWidth - 8 - 4 * 10) / 5));
    measure(); const ro = new ResizeObserver(measure); ro.observe(el); return () => ro.disconnect();
  }, []);
  const VIEW = 360, rowH = tileW * 1.42 + 5 + 15 + 10;
  const firstRow = rowH ? Math.max(0, Math.floor(top / rowH) - 1) : 0;
  const lastRow = rowH ? Math.ceil((top + VIEW) / rowH) + 1 : 3;
  const isShown = (p) => { if (tileW <= 0) return false; const row = Math.floor((p - 1) / 5); return row >= firstRow && row <= lastRow; };
  const toggle = (p) => setOff(s => { const x = new Set(s); x.has(p) ? x.delete(p) : x.add(p); return x; });
  const addTxt = () => { const add = parseRanges(txt, total).filter(p => !locked.has(p)); if (add.length) setOff(s => new Set([...s, ...add])); setTxt(''); };
  return (
    <BottomSheet>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 22, color: 'var(--ink)', letterSpacing: -0.4 }}>Skip pages</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-2)', marginTop: 2 }}>Tap pages to be skipped.</div>
        </div>
        <span style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 999, background: 'var(--fill)', fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{off.size} skipped</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input value={txt} onChange={e => setTxt(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTxt()} placeholder="Type pages, e.g. 45-48, 120"
          style={{ flex: 1, minWidth: 0, height: 44, padding: '0 14px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--fill)', outline: 'none', fontFamily: 'var(--font-ui)', fontSize: 14.5, color: 'var(--ink)' }} />
        <Button style={{ height: 44, padding: '0 18px', fontSize: 14 }} onClick={addTxt}>Add</Button>
      </div>
      <div ref={scrollRef} onScroll={e => setTop(e.currentTarget.scrollTop)} style={{ maxHeight: VIEW, overflowY: 'auto', margin: '0 -4px', padding: '0 4px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 10 }}>
          {Array.from({ length: total }, (_, i) => i + 1).map(p => (
            <Thumb key={p} n={p} doc={doc} w={tileW} show={isShown(p)} off={off.has(p) || locked.has(p)} locked={locked.has(p)} onClick={() => toggle(p)} />
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <Button variant="soft" style={{ flex: 1 }} onClick={() => setOff(new Set())}>Clear</Button>
        <Button style={{ flex: 2 }} onClick={() => { onDone([...off]); close(); }}>Save</Button>
      </div>
    </BottomSheet>
  );
}

// First page of the open PDF as the book's cover
function PdfCover({ w, radius = 8, style = {} }) {
  const [doc, setDoc] = React.useState(() => PdfStore.doc);
  React.useEffect(() => {
    const un = PdfStore.subscribe(setDoc);
    if (!PdfStore.doc) PdfStore.restore().then(d => d && setDoc(d)).catch(() => {});
    return un;
  }, []);
  return (
    <div style={{ width: w, height: w * 1.5, borderRadius: radius, overflow: 'hidden', background: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)', ...style }}>
      {doc ? <PdfPage doc={doc} n={1} width={w} /> : null}
    </div>
  );
}

Lib.heal();
Object.assign(window, { dedupeLibrary, Lib, BOOK_FIELDS, pickBook, clearBook, PAGES_PER_HOUR, SamplePage, SAMPLE_PARA, SAMPLE_CH, PdfCover, PagePicker, parseRanges, compactRanges, readingList, readIdx, ProgressCard, currentBook, bookPage, PdfStore, loadPdfJs, planOf, doneSet, streakCount, markTodayDone, dayISO, StreakWeek, PdfPage });
