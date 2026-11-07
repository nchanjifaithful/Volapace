// reader-view.jsx — the PDF reader: paging (swipe) or vertical scrolling (continuous / snap),
// zoom, highlights + notes, bookmarks, contents, search, go-to-page, reading timer.
// Load after reader.jsx.

const PAGE_LOOKS = { light: 'none', sepia: 'sepia(0.4) brightness(0.97)', dark: 'invert(0.9) hue-rotate(180deg)' };
const ZMIN = 0.5, ZMAX = 4, PAGE_GAP = 12, SAMPLE_ASPECT = 1.45;
const HL_COLORS = { yellow: 'rgba(255,200,0,0.42)', red: 'rgba(217,4,41,0.24)', green: 'rgba(46,158,87,0.3)' };
const HL_SWATCH = { yellow: '#F5C400', red: '#D90429', green: '#2E9E57' };

// ── Sheets ──────────────────────────────────────────────────
function ReaderSheet({ title, onClose, children, right }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 8, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.32)', animation: 'veilIn .2s' }} />
      <div style={{ position: 'relative', width: '100%', maxHeight: '80%', display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderRadius: '28px 28px 0 0', padding: '10px 20px 34px', boxSizing: 'border-box', paddingBottom: 'calc(var(--sab) + 24px)', animation: 'sheetUp .3s cubic-bezier(.2,.8,.2,1)' }}>
        <div style={{ width: 38, height: 5, borderRadius: 999, background: 'var(--dash)', margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 22, color: 'var(--ink)', letterSpacing: -0.4 }}>{title}</span>
          {right || <IconBtn name="close" size={36} onClick={onClose} />}
        </div>
        {children}
      </div>
    </div>
  );
}

function ListRow({ title, sub, onClick, right, indent = 0, bar }) {
  return (
    <button onClick={onClick} style={{ width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 12, padding: `12px 4px 12px ${4 + indent * 16}px`, background: 'none', border: 'none', borderBottom: '1px solid var(--line)', cursor: 'pointer', textAlign: 'left' }}>
      {bar && <span style={{ alignSelf: 'stretch', width: 3, borderRadius: 2, background: bar, flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontWeight: indent ? 400 : 500, fontSize: 15, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        {sub && <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{sub}</div>}
      </div>
      {right}
    </button>
  );
}
const emptyNote = (t) => <div style={{ padding: 20, textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.45 }}>{t}</div>;
const sheetScroll = { overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none', minHeight: 120 };

async function pdfOutline(doc) {
  const items = await doc.getOutline().catch(() => null);
  if (!items) return [];
  const out = [];
  const walk = async (list, depth) => {
    for (const it of list) {
      let page = null;
      try {
        const dest = typeof it.dest === 'string' ? await doc.getDestination(it.dest) : it.dest;
        if (dest && dest[0]) page = (typeof dest[0] === 'number' ? dest[0] : await doc.getPageIndex(dest[0])) + 1;
      } catch (e) {}
      out.push({ title: it.title, page, depth });
      if (it.items && it.items.length && depth < 1) await walk(it.items, depth + 1);
    }
  };
  await walk(items, 0);
  return out;
}

const _textCache = new Map();
async function pageText(doc, n) {
  const k = (doc.fingerprints ? doc.fingerprints[0] : '') + ':' + n;
  if (_textCache.has(k)) return _textCache.get(k);
  const tc = await (await doc.getPage(n)).getTextContent();
  const t = tc.items.map(i => i.str).join(' ').replace(/\s+/g, ' ');
  _textCache.set(k, t); return t;
}

function Tabs({ tabs, value, onChange }) {
  return (
    <div style={{ display: 'flex', padding: 3, borderRadius: 999, background: 'var(--fill)', marginBottom: 8 }}>
      {tabs.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} style={{ flex: 1, height: 34, borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: value === k ? 600 : 500, fontSize: 13, background: value === k ? 'var(--ink)' : 'transparent', color: value === k ? 'var(--cream)' : 'var(--ink-2)' }}>{l}</button>
      ))}
    </div>
  );
}

function ContentsSheet({ doc, page, bookmarks, highlights, onJump, onRemoveMark, onEditHl, onClose, initialTab = 'contents' }) {
  const [tab, setTab] = React.useState(initialTab);
  const [toc, setToc] = React.useState(null);
  React.useEffect(() => {
    if (doc) pdfOutline(doc).then(setToc);
    else setToc([]);
  }, [doc]);
  const hl = [...highlights].sort((a, b) => a.page - b.page || a.at - b.at);
  return (
    <ReaderSheet title="Contents" onClose={onClose}>
      <Tabs value={tab} onChange={setTab} tabs={[['contents', 'Chapters'], ['marks', `Bookmarks${bookmarks.length ? ' \u00b7 ' + bookmarks.length : ''}`], ['hl', `Notes${hl.length ? ' \u00b7 ' + hl.length : ''}`]]} />
      <div style={sheetScroll}>
        {tab === 'contents' && (toc === null ? emptyNote('Loading\u2026')
          : toc.length === 0 ? emptyNote('This PDF has no chapter list. Use bookmarks to mark your own.')
          : toc.map((t, i) => <ListRow key={i} indent={t.depth} title={t.title} onClick={() => t.page && onJump(t.page)}
              right={<span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: t.page && page >= t.page && (!toc[i + 1] || !toc[i + 1].page || page < toc[i + 1].page) ? 'var(--sage)' : 'var(--ink-3)' }}>{t.page || '\u2013'}</span>} />))}
        {tab === 'marks' && (bookmarks.length === 0 ? emptyNote('No bookmarks yet. Tap the bookmark button while reading.')
          : bookmarks.map(p => <ListRow key={p} title={`Page ${p}`} sub={p === page ? 'You are here' : null} onClick={() => onJump(p)}
              right={<span onClick={e => { e.stopPropagation(); onRemoveMark(p); }} style={{ width: 32, height: 32, borderRadius: 999, background: 'var(--fill)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)' }}><Icon name="close" size={14} /></span>} />))}
        {tab === 'hl' && (hl.length === 0 ? emptyNote('Select text on a page to highlight it or add a note.')
          : hl.map(h => <ListRow key={h.id} bar={HL_SWATCH[h.color]} title={`\u201c${h.text}\u201d`} sub={<>{h.note && <span style={{ color: 'var(--ink)' }}>{h.note} &middot; </span>}Page {h.page}</>} onClick={() => onJump(h.page)}
              right={<span onClick={e => { e.stopPropagation(); onEditHl(h); }} style={{ width: 32, height: 32, borderRadius: 999, background: 'var(--fill)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)' }}><Icon name="edit" size={14} /></span>} />))}
      </div>
    </ReaderSheet>
  );
}

function SearchSheet({ doc, total, onJump, onClose }) {
  const [q, setQ] = React.useState('');
  const [res, setRes] = React.useState([]);
  const [scanned, setScanned] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const token = React.useRef(0);
  const run = async () => {
    const term = q.trim().toLowerCase(); if (term.length < 2) return;
    const my = ++token.current; setRes([]); setBusy(true); setScanned(0);
    const found = [];
    for (let p = 1; p <= total && found.length < 60; p++) {
      if (token.current !== my) return;
      const text = doc ? await pageText(doc, p) : SAMPLE_PARA;
      const i = text.toLowerCase().indexOf(term);
      if (i >= 0) { found.push({ p, snip: (i > 30 ? '\u2026' : '') + text.slice(Math.max(0, i - 30), i + term.length + 50) + '\u2026' }); if (found.length % 5 === 1) setRes([...found]); }
      if (p % 10 === 0) setScanned(p);
    }
    setRes(found); setScanned(total); setBusy(false);
  };
  React.useEffect(() => () => { token.current++; }, []);
  return (
    <ReaderSheet title="Search" onClose={onClose}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, height: 46, padding: '0 14px', borderRadius: 999, background: 'var(--fill)', border: '1px solid var(--line)' }}>
          <Icon name="search" size={18} style={{ color: 'var(--ink-3)' }} />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} placeholder="Find in book"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-ui)', fontSize: 15, color: 'var(--ink)' }} />
        </div>
        <Button style={{ height: 46, padding: '0 18px', fontSize: 14 }} onClick={run}>Find</Button>
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 6, minHeight: 16 }}>
        {busy ? `Searching\u2026 page ${scanned} of ${total}` : scanned ? `${res.length}${res.length >= 60 ? '+' : ''} result${res.length === 1 ? '' : 's'}` : ''}
      </div>
      <div style={sheetScroll}>
        {res.map((r, i) => <ListRow key={i} title={`Page ${r.p}`} sub={r.snip} onClick={() => onJump(r.p)} right={<Icon name="chevronRight" size={16} style={{ color: 'var(--ink-3)' }} />} />)}
      </div>
    </ReaderSheet>
  );
}

function SegRow({ value, options, onChange }) {
  return (
    <div style={{ display: 'flex', padding: 3, borderRadius: 999, background: 'var(--fill)', border: '1px solid var(--line)' }}>
      {options.map(([k, l, ic]) => (
        <button key={k} onClick={() => onChange(k)} style={{ flex: 1, height: 38, borderRadius: 999, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          fontFamily: 'var(--font-ui)', fontWeight: value === k ? 600 : 500, fontSize: 13.5, background: value === k ? 'var(--surface)' : 'transparent', color: value === k ? 'var(--ink)' : 'var(--ink-2)', boxShadow: value === k ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
          {ic && <Icon name={ic} size={16} />}{l}
        </button>
      ))}
    </div>
  );
}

function DisplaySheet({ look, setLook, mode, setMode, snap, setSnap, zoom, setZoom, onClose }) {
  const lbl = (t) => <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-2)', margin: '0 0 8px' }}>{t}</div>;
  return (
    <ReaderSheet title="Display" onClose={onClose}>
      <div style={sheetScroll}>
        {lbl('Page colour')}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 18 }}>
          {[['light', 'Light', '#fff', '#141414'], ['sepia', 'Sepia', '#F3E7CF', '#4A3B26'], ['dark', 'Night', '#1A1A1A', '#E8E8E8']].map(([k, l, bg, fg]) => (
            <button key={k} onClick={() => setLook(k)} style={{ height: 60, borderRadius: 16, cursor: 'pointer', background: bg, color: fg, border: look === k ? '2px solid var(--sage)' : '1px solid var(--line)' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, lineHeight: 1 }}>Aa</div><div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, marginTop: 4 }}>{l}</div>
            </button>
          ))}
        </div>
        {lbl('Page turning')}
        <SegRow value={mode} onChange={setMode} options={[['horizontal', 'Swipe sideways', 'arrowRight'], ['vertical', 'Scroll down', 'chevronDown']]} />
        {mode === 'vertical' && (
          <div style={{ marginTop: 10 }}>
            <SegRow value={snap ? 'snap' : 'continuous'} onChange={v => setSnap(v === 'snap')} options={[['continuous', 'Continuous'], ['snap', 'One page at a time']]} />
          </div>
        )}
        <div style={{ height: 18 }} />
        {lbl('Zoom')}
        <div style={{ display: 'flex', gap: 8 }}>
          {[[1, 'Fit width'], [1.5, '150%'], [2, '200%']].map(([z, l]) => <Chip key={z} on={zoom === z} onClick={() => setZoom(z)} style={{ flex: 1 }}>{l}</Chip>)}
        </div>
      </div>
    </ReaderSheet>
  );
}

function GotoSheet({ page, total, onJump, onClose, today }) {
  const [v, setV] = React.useState(String(page));
  const n = parseInt(v); const valid = n >= 1 && n <= total;
  const go = () => { if (valid) onJump(n); };
  return (
    <ReaderSheet title="Go to page" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 6 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, height: 52, padding: '0 16px', borderRadius: 999, background: 'var(--fill)', border: '1px solid var(--line)', boxSizing: 'border-box' }}>
          <input autoFocus inputMode="numeric" value={v} onChange={e => setV(e.target.value.replace(/\D/g, ''))} onKeyDown={e => e.key === 'Enter' && go()}
            style={{ flex: 1, minWidth: 0, width: '100%', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 22, color: 'var(--ink)', height: 50, padding: 0 }} />
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--ink-3)', flexShrink: 0 }}>of {total}</span>
        </div>
        <Button style={{ height: 52, padding: '0 24px', flexShrink: 0 }} disabled={!valid} onClick={go}>Go</Button>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {today && <Chip onClick={() => onJump(today.from)}>Today&rsquo;s start &middot; p. {today.from}</Chip>}
        <Chip onClick={() => onJump(1)}>First page</Chip>
        <Chip onClick={() => onJump(total)}>Last page</Chip>
      </div>
      </div>
    </ReaderSheet>
  );
}

function NoteSheet({ hl, onSave, onDelete, onClose }) {
  const [note, setNote] = React.useState(hl.note || '');
  const [color, setColor] = React.useState(hl.color || 'yellow');
  return (
    <ReaderSheet title={hl.note ? 'Edit note' : 'Add a note'} onClose={onClose}>
      <div style={{ padding: '10px 14px', borderLeft: `3px solid ${HL_SWATCH[color]}`, background: 'var(--fill)', borderRadius: '0 12px 12px 0', fontFamily: 'var(--font-serif)', fontSize: 15, lineHeight: 1.45, color: 'var(--ink)', marginBottom: 12, maxHeight: 110, overflow: 'auto' }}>&ldquo;{hl.text}&rdquo;</div>
      <textarea autoFocus value={note} onChange={e => setNote(e.target.value)} placeholder="Your thoughts on this passage" rows={4}
        style={{ width: '100%', boxSizing: 'border-box', resize: 'none', padding: 14, borderRadius: 16, border: '1px solid var(--line)', background: 'var(--surface)', outline: 'none', fontFamily: 'var(--font-ui)', fontSize: 15, lineHeight: 1.45, color: 'var(--ink)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 18px' }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-2)', flex: 1 }}>Colour</span>
        {Object.keys(HL_SWATCH).map(c => <button key={c} onClick={() => setColor(c)} aria-label={c} style={{ width: 28, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer', background: HL_SWATCH[c], boxShadow: color === c ? '0 0 0 2px var(--surface), 0 0 0 4px var(--ink)' : 'none' }} />)}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="soft" style={{ flex: 1 }} onClick={onDelete}>Remove highlight</Button>
        <Button style={{ flex: 1 }} onClick={() => onSave(note.trim(), color)}>Save</Button>
      </div>
    </ReaderSheet>
  );
}

function ToolBtn({ icon, label, on, onClick }) {
  return (
    <button onClick={onClick} title={label} style={{ flex: 1, height: 44, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, color: on ? 'var(--sage)' : 'var(--ink)' }}>
      <Icon name={icon} size={21} />
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 10.5, fontWeight: 500, color: on ? 'var(--sage)' : 'var(--ink-2)' }}>{label}</span>
    </button>
  );
}

// ── One page with its overlays ─────────────────────────────
function PageView({ n, doc, pw, ph, look, skipped, marked, highlights, onHlTap, live, anim }) {
  return (
    <div className="vp-page" data-page={n} style={{ position: 'relative', width: pw, height: ph, flexShrink: 0, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.06)', outline: '1px solid var(--line)', filter: PAGE_LOOKS[look], userSelect: 'text', WebkitUserSelect: 'text', animation: anim, scrollSnapAlign: 'start', overflow: 'hidden' }}>
      {live && (doc ? <PdfPage doc={doc} n={n} width={pw} textLayer /> : null)}
      {!live && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-ui)', fontSize: 13, color: '#bbb' }}>{n}</div>}
      {highlights.map(h => h.rects.map((r, i) => (
        <div key={h.id + i} onClick={e => { e.stopPropagation(); onHlTap(h); }} style={{ position: 'absolute', left: r[0] * pw, top: r[1] * ph, width: r[2] * pw, height: r[3] * ph, background: HL_COLORS[h.color] || HL_COLORS.yellow, mixBlendMode: 'multiply', borderRadius: 2, zIndex: 3, cursor: 'pointer' }} />
      )))}
      {highlights.filter(h => h.note).map(h => { const r = h.rects[h.rects.length - 1]; return (
        <div key={h.id + 'n'} onClick={e => { e.stopPropagation(); onHlTap(h); }} style={{ position: 'absolute', left: Math.min(pw - 18, (r[0] + r[2]) * pw + 2), top: r[1] * ph - 6, width: 14, height: 14, borderRadius: 999, background: HL_SWATCH[h.color], color: '#fff', zIndex: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Icon name="edit" size={8} stroke={2.6} /></div>
      ); })}
      {skipped && <div style={{ position: 'absolute', inset: 0, zIndex: 5, background: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 14, pointerEvents: 'none' }}><span style={{ padding: '6px 12px', borderRadius: 999, background: '#141414', color: '#fff', fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 12 }}>Not a reading page</span></div>}
      {marked && <div style={{ position: 'absolute', top: -1, right: 18, zIndex: 5, color: 'var(--sage)', pointerEvents: 'none' }}><svg width="18" height="26" viewBox="0 0 18 26"><path d="M0 0h18v26l-9-6-9 6z" fill="currentColor" /></svg></div>}
    </div>
  );
}

// ── Reader ─────────────────────────────────────────────────
function ReaderScreen({ ctx, update, onBack, hostRef }) {
  const plan = planOf(ctx);
  const wantId = ctx.hasPdf ? (ctx.bookId || null) : undefined;
  const docOk = (d) => d && (wantId === null || PdfStore.id === wantId);
  const [doc, setDoc] = React.useState(() => ctx.hasPdf && docOk(PdfStore.doc) ? PdfStore.doc : null);
  const [loading, setLoading] = React.useState(ctx.hasPdf && !doc);
  const [aspect, setAspect] = React.useState(SAMPLE_ASPECT);
  const total = doc ? doc.numPages : plan.pages;
  const [page, setPage] = React.useState(() => Math.min(total, Math.max(1, ctx.page || plan.from)));
  const [dir, setDir] = React.useState(0);
  const [chrome, setChrome] = React.useState(true);
  const [sheet, setSheet] = React.useState(null);
  const [editHl, setEditHl] = React.useState(null);
  const [pop, setPop] = React.useState(null);
  const [zoom, setZoomRaw] = React.useState(ctx.readerZoom || 1);
  const [pinch, setPinch] = React.useState(1);
  const today = dayISO(TODAY);
  const [secs, setSecs] = React.useState(() => (ctx.timeLog && ctx.timeLog.date === today ? ctx.timeLog.secs : 0));
  const look = ctx.pageLook || 'light';
  const mode = ctx.scrollMode || 'horizontal';
  const snap = !!ctx.vSnap;
  const bookmarks = ctx.bookmarks || [];
  const highlights = ctx.highlights || [];
  const marked = bookmarks.includes(page);
  const skipSet = new Set(ctx.skip || []);
  const skipped = skipSet.has(page);
  const rootRef = React.useRef(null), areaRef = React.useRef(null);
  const ptrs = React.useRef(new Map()), pinch0 = React.useRef(null), swipe = React.useRef(null), suppressClick = React.useRef(false);
  const lastAct = React.useRef(Date.now()), prevPage = React.useRef(page), fromScroll = React.useRef(false);
  const [vw, setVw] = React.useState(() => window.innerWidth);
  React.useEffect(() => { const on = () => setVw(window.innerWidth); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []);
  const W = Math.max(240, Math.min(vw, 900) - 50), pw = Math.round(W * zoom), ph = Math.round(pw * aspect), stride = ph + PAGE_GAP;

  const setZoom = (fn) => { const n = +Math.max(ZMIN, Math.min(ZMAX, typeof fn === 'function' ? fn(zoom) : fn)).toFixed(2); setZoomRaw(n); update({ readerZoom: n }); };

  // load the right document for this book
  React.useEffect(() => {
    if (!ctx.hasPdf || doc) return;
    const p = wantId ? PdfStore.openId(wantId) : PdfStore.restore();
    p.then(d => { setDoc(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  React.useEffect(() => { if (doc) doc.getPage(1).then(p => { const v = p.getViewport({ scale: 1 }); setAspect(v.height / v.width); }); }, [doc]);

  // persist position; detect "finished today's pages"
  React.useEffect(() => {
    update({ page });
    if (plan.goalType !== 'time' && !plan.finished && prevPage.current <= plan.to && page > plan.to) complete();
    prevPage.current = page;
    if (mode === 'horizontal' && areaRef.current) areaRef.current.scrollTop = 0;
  }, [page]);

  // vertical: keep the current page in view when layout changes
  React.useLayoutEffect(() => { if (mode === 'vertical' && areaRef.current) areaRef.current.scrollTop = (page - 1) * stride; }, [mode, stride]);

  // reading timer (counts while you're active on the page)
  React.useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible' || Date.now() - lastAct.current > 120000) return;
      setSecs(s => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);
  // persist every 10 s so a crash loses little; complete a time goal when it's reached
  React.useEffect(() => {
    if (secs > 0 && secs % 10 === 0) update({ timeLog: { date: today, secs } });
    if (plan.goalType === 'time' && secs === plan.minutes * 60 && !doneSet(ctx).has(today)) complete();
  }, [secs]);
  const startSecs = React.useRef(secs);
  React.useEffect(() => () => update({ timeLog: { date: today, secs: secsRef.current }, endSession: secsRef.current - startSecs.current }), []);
  const secsRef = React.useRef(secs); secsRef.current = secs;
  const poke = () => { lastAct.current = Date.now(); };

  function complete() {
    update(markTodayDone(ctx));
    setSheet('done');
    Platform.vibrate([14, 60, 30]);
    if (hostRef && hostRef.current) fireConfetti(hostRef.current);
  }

  const nextFrom = (p, d) => { let n = Math.max(1, Math.min(total, p + d)); while (skipSet.has(n) && n > 1 && n < total) n += d; return n; };
  const goTo = (p) => {
    const n = Math.max(1, Math.min(total, p));
    if (mode === 'vertical' && areaRef.current) { fromScroll.current = true; areaRef.current.scrollTo({ top: (n - 1) * stride, behavior: Math.abs(n - page) > 3 ? 'auto' : 'smooth' }); }
    setPage(n);
  };
  const turn = (d) => { poke(); setPop(null); setDir(d); goTo(nextFrom(page, d)); };
  const jump = (p) => { setSheet(null); setDir(0); goTo(p); };

  const onScroll = (e) => {
    poke();
    if (mode !== 'vertical') return;
    const el = e.currentTarget;
    const cur = Math.max(1, Math.min(total, Math.floor((el.scrollTop + el.clientHeight * 0.35) / stride) + 1));
    if (cur !== page) setPage(cur);
  };

  React.useEffect(() => {
    const k = (e) => {
      if (sheet || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight' || (mode === 'vertical' && e.key === 'PageDown')) turn(1);
      if (e.key === 'ArrowLeft' || (mode === 'vertical' && e.key === 'PageUp')) turn(-1);
      if (e.key === '+' || e.key === '=') setZoom(z => z + 0.25); if (e.key === '-') setZoom(z => z - 0.25); if (e.key === '0') setZoom(1);
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  React.useEffect(() => { // ctrl/⌘ + wheel or trackpad pinch
    const el = areaRef.current; if (!el) return;
    const w = (e) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); setZoom(z => z * (e.deltaY < 0 ? 1.1 : 0.9)); };
    el.addEventListener('wheel', w, { passive: false }); return () => el.removeEventListener('wheel', w);
  }, []);

  // text selection → highlight popover
  React.useEffect(() => {
    let t;
    const check = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) { setPop(null); return; }
      const text = sel.toString().replace(/\s+/g, ' ').trim(); if (text.length < 2) { setPop(null); return; }
      const range = sel.getRangeAt(0);
      const node = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
      const pageEl = node && node.closest('[data-page]');
      if (!pageEl || !rootRef.current || !rootRef.current.contains(pageEl)) { setPop(null); return; }
      const pr = pageEl.getBoundingClientRect(), rr = rootRef.current.getBoundingClientRect(), s = 1;
      const rects = [...range.getClientRects()].filter(r => r.width > 1 && r.height > 1)
        .map(r => [(r.left - pr.left) / pr.width, (r.top - pr.top) / pr.height, r.width / pr.width, r.height / pr.height])
        .filter(r => r[0] < 1 && r[1] < 1 && r[0] + r[2] > 0 && r[1] + r[3] > 0)
        .map(([x, y, w, h]) => [Math.max(0, x), Math.max(0, y), Math.min(w, 1 - Math.max(0, x)), Math.min(h, 1 - Math.max(0, y))]);
      if (!rects.length) return;
      const b = range.getBoundingClientRect();
      setPop({ page: +pageEl.dataset.page, text: text.slice(0, 600), rects, x: Math.max(110, Math.min(292, ((b.left + b.right) / 2 - rr.left) / s)), y: Math.max(130, (b.top - rr.top) / s - 10) });
    };
    const on = () => { clearTimeout(t); t = setTimeout(check, 180); };
    document.addEventListener('selectionchange', on);
    return () => { document.removeEventListener('selectionchange', on); clearTimeout(t); };
  }, []);
  const clearSel = () => { const s = window.getSelection(); s && s.removeAllRanges(); setPop(null); };
  const addHl = (color, withNote) => {
    if (!pop) return;
    const h = { id: Date.now().toString(36), page: pop.page, text: pop.text, rects: pop.rects, color, note: '', at: Date.now() };
    update({ highlights: [...highlights, h] }); clearSel();
    if (withNote) setEditHl(h);
  };
  const copySel = () => { if (pop) Platform.copy(pop.text); clearSel(); };

  // gestures: swipe (horizontal mode), pinch zoom
  const dist = () => { const [a, b] = [...ptrs.current.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const onPD = (e) => {
    poke(); ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 1) swipe.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    if (ptrs.current.size === 2) { pinch0.current = dist(); swipe.current = null; }
  };
  const onPM = (e) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 2 && pinch0.current) setPinch(Math.max(ZMIN / zoom, Math.min(ZMAX / zoom, dist() / pinch0.current)));
  };
  const onPU = (e) => {
    const start = swipe.current; ptrs.current.delete(e.pointerId);
    if (pinch0.current && ptrs.current.size < 2) { const p = pinch; pinch0.current = null; setPinch(1); if (Math.abs(p - 1) > 0.02) { setZoom(z => z * p); suppressClick.current = true; } return; }
    if (!start || mode !== 'horizontal' || zoom > 1.01) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y, sel = window.getSelection();
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - start.t < 700 && (!sel || sel.isCollapsed)) { suppressClick.current = true; turn(dx < 0 ? 1 : -1); }
    swipe.current = null;
  };
  const onTap = () => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    const sel = window.getSelection(); if (sel && !sel.isCollapsed) return;
    setChrome(c => !c);
  };

  const readToday = Math.max(0, Math.min(plan.goal, readIdx(plan.list, page) - plan.fromIdx));
  const isTime = plan.goalType === 'time';
  const pct = isTime ? Math.min(100, (secs / (plan.minutes * 60)) * 100) : (readToday / plan.goal) * 100;
  const fade = { opacity: chrome ? 1 : 0, pointerEvents: chrome ? 'auto' : 'none', transition: 'opacity .2s' };
  const toggleSkip = () => { const s = new Set(skipSet); s.has(page) ? s.delete(page) : s.add(page); update({ skip: [...s].sort((a, b) => a - b) }); };
  const toggleMark = () => update({ bookmarks: marked ? bookmarks.filter(p => p !== page) : [...bookmarks, page].sort((a, b) => a - b) });
  const pageProps = (n) => ({ n, doc, pw, ph, look, skipped: skipSet.has(n), marked: bookmarks.includes(n), highlights: highlights.filter(h => h.page === n), onHlTap: setEditHl });
  const content = loading
    ? <div style={{ margin: 'auto', width: pw, height: ph, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spin" style={{ width: 22, height: 22, borderRadius: 999, border: '2.5px solid var(--fill-2)', borderTopColor: 'var(--sage)' }} /></div>
    : mode === 'horizontal'
      ? <div style={{ margin: 'auto', transform: pinch !== 1 ? `scale(${pinch})` : 'none' }}><PageView key={page} {...pageProps(page)} live anim={dir > 0 ? 'pgInNext .22s ease-out' : dir < 0 ? 'pgInPrev .22s ease-out' : 'veilIn .14s ease'} /></div>
      : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: PAGE_GAP, margin: '0 auto', width: 'fit-content', minWidth: '100%', transform: pinch !== 1 ? `scale(${pinch})` : 'none', transformOrigin: 'top center' }}>
          {Array.from({ length: total }, (_, i) => i + 1).map(n => <PageView key={n} {...pageProps(n)} live={Math.abs(n - page) <= 2} />)}
        </div>;

  return (
    <div ref={rootRef} style={{ height: '100%', position: 'relative', background: 'var(--fill)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 'calc(var(--sat) + 8px) 16px 10px', background: 'var(--cream)', borderBottom: '1px solid var(--line)', zIndex: 4, ...fade }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconBtn name="arrowLeft" size={40} onClick={onBack} />
          <button onClick={() => setSheet('goto')} style={{ flex: 1, minWidth: 0, textAlign: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 15, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{plan.title}</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-2)', marginTop: 1, display: 'inline-flex', alignItems: 'center', gap: 3 }}>Page {page} of {total} <Icon name="chevronDown" size={13} /></div>
          </button>
          <button onClick={toggleMark} aria-label={marked ? 'Remove bookmark' : 'Bookmark this page'} style={{ width: 40, height: 40, borderRadius: 999, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--line)', background: marked ? 'var(--sage)' : 'var(--fill)', color: marked ? '#fff' : 'var(--ink)', transition: 'background .15s' }}><Icon name={marked ? 'bookmarkOn' : 'bookmark'} size={18} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <div style={{ flex: 1 }}><ProgressBar value={plan.finished ? 100 : pct} height={4} /></div>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
            {plan.finished ? 'Plan complete' : isTime ? `${Math.floor(secs / 60)}/${plan.minutes} min today` : `${readToday}/${plan.goal} pages today`}
          </span>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <div ref={areaRef} onScroll={onScroll} onClick={onTap} onPointerDown={onPD} onPointerMove={onPM} onPointerUp={onPU} onPointerCancel={onPU}
          style={{ position: 'absolute', inset: 0, overflow: 'auto', display: mode === 'horizontal' ? 'flex' : 'block', padding: PAGE_GAP, boxSizing: 'border-box', cursor: 'default',
            touchAction: zoom > 1.01 ? 'pan-x pan-y' : mode === 'horizontal' ? 'pan-y' : 'pan-y', scrollSnapType: mode === 'vertical' && snap ? 'y mandatory' : 'none', scrollPaddingTop: PAGE_GAP, overscrollBehavior: 'contain', scrollbarWidth: 'none' }}>
          {content}
        </div>
        {/* zoom — top of the canvas, small, out of the way of page turning */}
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 3, display: 'flex', alignItems: 'center', height: 32, borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', ...fade }}>
          <button onClick={() => setZoom(z => z - 0.25)} title="Zoom out" style={zBtn}><Icon name="minus" size={15} /></button>
          <button onClick={() => setZoom(1)} title="Fit width" style={{ ...zBtn, width: 'auto', minWidth: 38, fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>{Math.round(zoom * pinch * 100)}%</button>
          <button onClick={() => setZoom(z => z + 0.25)} title="Zoom in" style={zBtn}><Icon name="plus" size={15} /></button>
        </div>
      </div>

      {pop && (
        <div onPointerDown={e => e.preventDefault()} style={{ position: 'absolute', left: pop.x, top: pop.y, transform: 'translate(-50%, -100%)', zIndex: 7, display: 'flex', alignItems: 'center', gap: 2, padding: 4, borderRadius: 999, background: '#141414', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', animation: 'pop .18s ease-out' }}>
          {Object.keys(HL_SWATCH).map(c => <button key={c} onClick={() => addHl(c)} aria-label={`Highlight ${c}`} style={{ width: 30, height: 30, borderRadius: 999, border: 'none', cursor: 'pointer', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ width: 18, height: 18, borderRadius: 999, background: HL_SWATCH[c] }} /></button>)}
          <span style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />
          <button onClick={() => addHl('yellow', true)} style={popBtn}><Icon name="edit" size={14} /> Note</button>
          <button onClick={copySel} style={popBtn}>Copy</button>
        </div>
      )}

      <div style={{ padding: '8px 12px calc(var(--sab) + 12px)', background: 'var(--cream)', borderTop: '1px solid var(--line)', zIndex: 4, ...fade }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
          <button onClick={() => turn(-1)} disabled={page <= 1} style={{ ...navBtn, background: 'var(--fill)', color: 'var(--ink)', border: '1px solid var(--line)', opacity: page <= 1 ? 0.4 : 1 }}><Icon name="arrowLeft" size={18} /> Prev</button>
          <div style={{ flex: 1, position: 'relative', height: 30, display: 'flex', alignItems: 'center' }}>
            <div style={{ position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 999, background: 'var(--track-off)' }} />
            <div style={{ position: 'absolute', left: 0, width: `${((page - 1) / Math.max(1, total - 1)) * 100}%`, height: 4, borderRadius: 999, background: 'var(--ink)' }} />
            {bookmarks.map(p => <div key={p} style={{ position: 'absolute', left: `${((p - 1) / Math.max(1, total - 1)) * 100}%`, top: 4, width: 2, height: 8, background: 'var(--sage)', borderRadius: 1 }} />)}
            <input type="range" min={1} max={total} value={page} onChange={e => { setDir(0); goTo(+e.target.value); }} className="vol-slider" style={{ position: 'absolute', left: 0, right: 0, width: '100%', margin: 0 }} />
          </div>
          <button onClick={() => turn(1)} disabled={page >= total} style={{ ...navBtn, background: 'var(--ink)', color: 'var(--cream)', border: '1px solid var(--ink)', opacity: page >= total ? 0.4 : 1 }}>Next <Icon name="arrowRight" size={18} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 6 }}>
          <ToolBtn icon="list" label="Contents" onClick={() => setSheet('contents')} />
          <ToolBtn icon="search" label="Search" onClick={() => setSheet('search')} />
          <ToolBtn icon={skipped ? 'close' : 'pages'} label={skipped ? 'Skipped' : 'Skip page'} on={skipped} onClick={toggleSkip} />
          <ToolBtn icon="edit" label="Notes" onClick={() => setSheet('notes')} />
          <ToolBtn icon="sliders" label="Display" onClick={() => setSheet('display')} />
        </div>
      </div>

      {(sheet === 'contents' || sheet === 'notes') && <ContentsSheet initialTab={sheet === 'notes' ? 'hl' : 'contents'} doc={doc} page={page} bookmarks={bookmarks} highlights={highlights} onJump={jump}
        onRemoveMark={p => update({ bookmarks: bookmarks.filter(x => x !== p) })} onEditHl={h => { setSheet(null); setEditHl(h); }} onClose={() => setSheet(null)} />}
      {sheet === 'search' && <SearchSheet doc={doc} total={total} onJump={jump} onClose={() => setSheet(null)} />}
      {sheet === 'display' && <DisplaySheet look={look} setLook={v => update({ pageLook: v })} mode={mode} setMode={v => update({ scrollMode: v })} snap={snap} setSnap={v => update({ vSnap: v })} zoom={zoom} setZoom={setZoom} onClose={() => setSheet(null)} />}
      {sheet === 'goto' && <GotoSheet page={page} total={total} today={plan.finished ? null : plan} onJump={jump} onClose={() => setSheet(null)} />}
      {editHl && <NoteSheet key={editHl.id} hl={editHl} onClose={() => setEditHl(null)}
        onSave={(note, color) => { update({ highlights: highlights.some(h => h.id === editHl.id) ? highlights.map(h => h.id === editHl.id ? { ...h, note, color } : h) : [...highlights, { ...editHl, note, color }] }); setEditHl(null); }}
        onDelete={() => { update({ highlights: highlights.filter(h => h.id !== editHl.id) }); setEditHl(null); }} />}
      {sheet === 'done' && (
        <ReaderSheet title={'Today’s reading is done'} onClose={() => setSheet(null)} right={<span />}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13.5, color: 'var(--ink-2)', marginTop: -8, marginBottom: 16 }}>Day {Math.max(1, plan.day - 1)} of {plan.days}</div>
          <StreakWeek ctx={ctx} style={{ marginBottom: 18 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="soft" style={{ flex: 1 }} onClick={() => setSheet(null)}>Keep reading</Button>
            <Button style={{ flex: 1 }} onClick={onBack}>Done</Button>
          </div>
        </ReaderSheet>
      )}
    </div>
  );
}
const zBtn = { width: 30, height: 30, borderRadius: 999, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 };
const navBtn = { height: 40, padding: '0 14px', borderRadius: 999, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13.5, flexShrink: 0 };
const popBtn = { height: 30, padding: '0 10px', borderRadius: 999, border: 'none', cursor: 'pointer', background: 'none', color: '#fff', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13 };

Object.assign(window, { ReaderScreen, HL_SWATCH });
