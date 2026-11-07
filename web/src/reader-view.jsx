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

// Search state lives in the reader (and in the book's saved state), so closing the sheet and coming
// back keeps the query, the results and which one you opened.
function useBookSearch(doc, total, saved, onSave) {
  const [s, setS] = React.useState(() => saved || { q: '', res: [], done: false, active: -1 });
  const [busy, setBusy] = React.useState(false);
  const [scanned, setScanned] = React.useState(saved && saved.done ? total : 0);
  const token = React.useRef(0);
  const save = (n) => { setS(n); onSave && onSave({ ...n, res: n.res.slice(0, 200) }); };
  const run = async (q) => {
    const term = q.trim().toLowerCase(); if (term.length < 2 || !doc) return;
    const my = ++token.current; setBusy(true); setScanned(0);
    const found = [];
    setS({ q, res: [], done: false, active: -1 });
    for (let p = 1; p <= total && found.length < 200; p++) {
      if (token.current !== my) return;
      const text = await pageText(doc, p);
      const low = text.toLowerCase();
      let i = low.indexOf(term);
      while (i >= 0 && found.length < 200) {
        found.push({ p, snip: (i > 30 ? '…' : '') + text.slice(Math.max(0, i - 30), i + term.length + 50) + '…', at: i, len: term.length });
        i = low.indexOf(term, i + term.length);
        if (found.filter(f => f.p === p).length >= 5) break;
      }
      if (p % 10 === 0) { setScanned(p); setS({ q, res: [...found], done: false, active: -1 }); }
    }
    setBusy(false); setScanned(total);
    save({ q, res: found, done: true, active: -1 });
  };
  React.useEffect(() => () => { token.current++; }, []);
  return { ...s, busy, scanned, run, setActive: (i) => save({ ...s, active: i }), clear: () => { token.current++; setBusy(false); setScanned(0); save({ q: '', res: [], done: false, active: -1 }); }, setQ: (q) => setS(x => ({ ...x, q })) };
}

function SearchSheet({ search, total, onJump, onClose }) {
  const { q, res, busy, scanned, done, active } = search;
  return (
    <ReaderSheet title="Search" onClose={onClose}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, height: 46, padding: '0 14px', borderRadius: 999, background: 'var(--fill)', border: '1px solid var(--line)' }}>
          <Icon name="search" size={18} style={{ color: 'var(--ink-3)' }} />
          <input autoFocus={!q} value={q} onChange={e => search.setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search.run(q)} placeholder="Find in book" enterKeyHint="search"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-ui)', fontSize: 15, color: 'var(--ink)' }} />
          {q && <button onClick={search.clear} aria-label="Clear search" style={{ border: 'none', background: 'none', padding: 4, cursor: 'pointer', color: 'var(--ink-3)', display: 'flex' }}><Icon name="close" size={16} /></button>}
        </div>
        <Button style={{ height: 46, padding: '0 18px', fontSize: 14 }} onClick={() => search.run(q)}>Find</Button>
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 6, minHeight: 16 }}>
        {busy ? `Searching… page ${scanned} of ${total}` : done ? `${res.length}${res.length >= 200 ? '+' : ''} result${res.length === 1 ? '' : 's'} for “${q}”` : ''}
      </div>
      <div style={sheetScroll}>
        {res.map((r, i) => <ListRow key={i} bar={i === active ? 'var(--sage)' : null} title={`Page ${r.p}`} sub={r.snip} onClick={() => { search.setActive(i); onJump(r.p, true); }} right={<Icon name="chevronRight" size={16} style={{ color: 'var(--ink-3)' }} />} />)}
        {done && !busy && res.length === 0 && emptyNote('No matches. Try a shorter word.')}
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
// The page image gets the page-colour filter; the overlays (read tick, bookmark, search hits) don't.
function PageView({ n, doc, pw, ph, look, skipped, marked, read, onToggleRead, highlights, onHlTap, live, anim, hit, after }) {
  const [hits, setHits] = React.useState([]);
  const boxRef = React.useRef(null);
  const pageRef = React.useRef(null);
  const findHits = React.useCallback(() => {
    const box = boxRef.current, pg = pageRef.current;
    if (!hit || !box || !pg) { setHits([]); return; }
    const term = hit.toLowerCase(), pr = pg.getBoundingClientRect(), out = [];
    box.querySelectorAll('span').forEach(sp => {
      const node = sp.firstChild; if (!node || node.nodeType !== 3) return;
      const low = node.textContent.toLowerCase(); let i = low.indexOf(term);
      while (i >= 0) {
        const r = document.createRange(); r.setStart(node, i); r.setEnd(node, Math.min(node.length, i + term.length));
        [...r.getClientRects()].forEach(b => out.push([(b.left - pr.left) / pr.width, (b.top - pr.top) / pr.height, b.width / pr.width, b.height / pr.height]));
        i = low.indexOf(term, i + term.length);
      }
    });
    setHits(out);
    if (out.length && pg.scrollIntoView) { const el = pg.querySelector('[data-hit="0"]'); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }, [hit]);
  React.useEffect(() => { findHits(); }, [hit, pw]);
  return (
    <div style={{ flexShrink: 0, animation: anim }}>
      <div ref={pageRef} className="vp-page" data-page={n} style={{ position: 'relative', width: pw, height: ph, background: '#fff', outline: '1px solid var(--line)', userSelect: 'text', WebkitUserSelect: 'text', scrollSnapAlign: 'start', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, filter: PAGE_LOOKS[look] }}>
          {live && doc ? <PdfPage doc={doc} n={n} width={pw} textLayer onText={(box) => { boxRef.current = box; findHits(); }} /> : null}
          {highlights.map(h => h.rects.map((r, i) => (
            <div key={h.id + i} onClick={e => { e.stopPropagation(); onHlTap(h); }} style={{ position: 'absolute', left: r[0] * pw, top: r[1] * ph, width: r[2] * pw, height: r[3] * ph, background: HL_COLORS[h.color] || HL_COLORS.yellow, mixBlendMode: 'multiply', borderRadius: 2, zIndex: 3, cursor: 'pointer' }} />
          )))}
        </div>
        {!live && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-ui)', fontSize: 13, color: '#bbb' }}>{n}</div>}
        {hits.map((r, i) => <div key={'h' + i} data-hit={i} style={{ position: 'absolute', left: r[0] * pw - 2, top: r[1] * ph - 2, width: r[2] * pw + 4, height: r[3] * ph + 4, borderRadius: 4, background: 'rgba(255,196,0,0.45)', outline: '2px solid #F5A400', zIndex: 4, pointerEvents: 'none', animation: 'hitPulse 1.2s ease-out 2' }} />)}
        {highlights.filter(h => h.note).map(h => { const r = h.rects[h.rects.length - 1]; return (
          <div key={h.id + 'n'} onClick={e => { e.stopPropagation(); onHlTap(h); }} style={{ position: 'absolute', left: Math.min(pw - 18, (r[0] + r[2]) * pw + 2), top: r[1] * ph - 6, width: 14, height: 14, borderRadius: 999, background: HL_SWATCH[h.color], color: '#fff', zIndex: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Icon name="edit" size={8} stroke={2.6} /></div>
        ); })}
        {skipped && <div style={{ position: 'absolute', inset: 0, zIndex: 5, background: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 14, pointerEvents: 'none' }}><span style={{ padding: '6px 12px', borderRadius: 999, background: '#141414', color: '#fff', fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 12 }}>Not a reading page</span></div>}
        {marked && <div style={{ position: 'absolute', top: -1, right: 18, zIndex: 5, color: 'var(--sage)', pointerEvents: 'none' }}><svg width="18" height="26" viewBox="0 0 18 26"><path d="M0 0h18v26l-9-6-9 6z" fill="currentColor" /></svg></div>}
        {!skipped && onToggleRead && (
          <button onClick={e => { e.stopPropagation(); onToggleRead(n); }} aria-label={read ? `Page ${n} read` : `Mark page ${n} as read`} aria-pressed={read}
            style={{ position: 'absolute', right: 10, bottom: 10, zIndex: 6, height: 32, padding: read ? '0 12px 0 8px' : '0 12px 0 8px', borderRadius: 999, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              border: read ? '1px solid var(--sage)' : '1px solid rgba(0,0,0,0.14)', background: read ? 'var(--sage)' : 'rgba(255,255,255,0.94)', color: read ? '#fff' : '#141414', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 12 }}>
            <span style={{ width: 18, height: 18, borderRadius: 999, border: read ? 'none' : '1.5px solid #A3A3A3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{read && <Icon name="check" size={13} stroke={3} />}</span>
            {read ? 'Read' : 'Mark read'}
          </button>
        )}
      </div>
      {after}
    </div>
  );
}

// "End of day" marker shown after the last page of each plan day
function DayEnd({ d, status, onNext, vertical }) {
  const today = status === 'today', done = status === 'done';
  return (
    <div onClick={e => e.stopPropagation()} style={{ width: '100%', boxSizing: 'border-box', marginTop: vertical ? 10 : 12, padding: '12px 14px', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 12,
      background: today ? 'var(--sage)' : 'var(--surface)', color: today ? '#fff' : 'var(--ink)', border: today ? 'none' : '1px solid var(--line)' }}>
      <div style={{ width: 32, height: 32, borderRadius: 999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: today ? 'rgba(255,255,255,0.18)' : done ? 'var(--ink)' : 'var(--fill)', color: today || done ? '#fff' : 'var(--ink-2)' }}>
        <Icon name={done ? 'check' : 'flame'} size={16} stroke={done ? 2.6 : 1.75} />
      </div>
      <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-ui)' }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{today ? 'End of today’s reading' : `End of Day ${d + 1}`}</div>
        <div style={{ fontSize: 12, opacity: today ? 0.85 : 1, color: today ? '#fff' : 'var(--ink-2)', marginTop: 1 }}>{today ? 'That’s your goal for today. Keep going if you like.' : done ? 'Completed' : status === 'skipped' ? 'Skipped' : 'Planned for later'}</div>
      </div>
      {onNext && <button onClick={onNext} style={{ height: 32, padding: '0 12px', borderRadius: 999, border: today ? 'none' : '1px solid var(--line)', background: today ? '#fff' : 'var(--fill)', color: today ? 'var(--sage)' : 'var(--ink)', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', flexShrink: 0 }}>Keep reading</button>}
    </div>
  );
}

function MenuRow({ icon, label, sub, onClick, on }) {
  return (
    <button onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '13px 4px', background: 'none', border: 'none', borderBottom: '1px solid var(--line)', cursor: 'pointer', textAlign: 'left' }}>
      <div style={{ width: 36, height: 36, borderRadius: 999, background: on ? 'var(--sage)' : 'var(--fill)', color: on ? '#fff' : 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={icon} size={18} /></div>
      <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-ui)' }}>
        <div style={{ fontWeight: 500, fontSize: 15, color: 'var(--ink)' }}>{label}</div>
        {sub && <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 1 }}>{sub}</div>}
      </div>
    </button>
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
  const [pinch, setPinch] = React.useState(null); // { s, ox, oy } while two fingers are down
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
  const read = readSet(ctx);
  const rootRef = React.useRef(null), areaRef = React.useRef(null), innerRef = React.useRef(null);
  const ptrs = React.useRef(new Map()), pinch0 = React.useRef(null), swipe = React.useRef(null), suppressClick = React.useRef(false), lastTap = React.useRef(0);
  const lastAct = React.useRef(Date.now()), fromScroll = React.useRef(false), pendingScroll = React.useRef(null);
  const [vw, setVw] = React.useState(() => window.innerWidth);
  React.useEffect(() => { const on = () => setVw(window.innerWidth); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []);
  const W = Math.max(240, Math.min(vw, 900) - 2 * PAGE_GAP), pw = Math.round(W * zoom), ph = Math.round(pw * aspect);

  const setZoom = (fn, focal) => {
    const n = +Math.max(ZMIN, Math.min(ZMAX, typeof fn === 'function' ? fn(zoom) : fn)).toFixed(3);
    if (n === zoom) return;
    const el = areaRef.current;
    if (el) { // keep the point under the fingers (or the centre) where it is
      const r = el.getBoundingClientRect();
      const fx = focal ? focal.x - r.left : el.clientWidth / 2, fy = focal ? focal.y - r.top : el.clientHeight / 2;
      pendingScroll.current = { x: (el.scrollLeft + fx) * (n / zoom) - fx, y: (el.scrollTop + fy) * (n / zoom) - fy };
    }
    setZoomRaw(n); update({ readerZoom: n });
  };
  React.useLayoutEffect(() => { const p = pendingScroll.current, el = areaRef.current; if (p && el) { el.scrollLeft = p.x; el.scrollTop = p.y; } pendingScroll.current = null; }, [zoom]);

  // load the right document for this book
  React.useEffect(() => {
    if (!ctx.hasPdf || doc) return;
    const p = wantId ? PdfStore.openId(wantId) : PdfStore.restore();
    p.then(d => { setDoc(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  React.useEffect(() => { if (doc) doc.getPage(1).then(p => { const v = p.getViewport({ scale: 1 }); setAspect(v.height / v.width); }); }, [doc]);

  // plan days: where each day ends, and today's progress (pages ticked as read)
  const sched = plan.sched;
  const ends = React.useMemo(() => { const m = new Map(); sched.forEach(d => { if (!m.has(d.to)) m.set(d.to, d); }); return m; }, [ctx.days, ctx.planDays, ctx.doneDays, ctx.skip, ctx.planStart, ctx.pages]);
  const todayDone = todayIsDone(ctx);
  const cur = plan.finished ? null : sched[Math.min(sched.length - 1, plan.doneDays)];
  const readToday = cur ? readInRange(ctx, cur.from, cur.to) : 0;

  // vertical layout: page tops, with room for the end-of-day markers
  const DAY_H = 76;
  const tops = React.useMemo(() => {
    const t = []; let y = PAGE_GAP;
    for (let n = 1; n <= total; n++) { t.push(y); y += ph + PAGE_GAP + (mode === 'vertical' && ends.has(n) ? DAY_H : 0); }
    t.push(y); return t;
  }, [total, ph, mode, ends]);
  const pageAt = (y) => { let lo = 0, hi = total - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (tops[m] <= y) lo = m; else hi = m - 1; } return lo + 1; };

  // persist position
  React.useEffect(() => {
    update({ page });
    if (mode === 'horizontal' && areaRef.current && !pendingScroll.current) areaRef.current.scrollTop = 0;
  }, [page]);

  // vertical: keep the current page in view when layout changes
  React.useLayoutEffect(() => { if (mode === 'vertical' && areaRef.current && !pendingScroll.current) areaRef.current.scrollTop = tops[page - 1] - PAGE_GAP; }, [mode, ph]);

  // reading timer (counts while you're active on the page)
  React.useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible' || Date.now() - lastAct.current > 120000) return;
      setSecs(s => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);
  React.useEffect(() => {
    if (secs > 0 && secs % 10 === 0) update({ timeLog: { date: today, secs } });
    if (plan.goalType === 'time' && secs === plan.minutes * 60 && !todayDone) complete();
  }, [secs]);
  const startSecs = React.useRef(secs);
  const secsRef = React.useRef(secs); secsRef.current = secs;
  React.useEffect(() => () => update({ timeLog: { date: today, secs: secsRef.current }, endSession: secsRef.current - startSecs.current }), []);
  const poke = () => { lastAct.current = Date.now(); };

  function complete() {
    update(markTodayDone(ctx));
    setSheet('done');
    Platform.vibrate([14, 60, 30]);
    if (hostRef && hostRef.current) fireConfetti(hostRef.current);
  }

  // tick a page as read; finishing every page of today's range completes the day
  const toggleRead = (n) => {
    poke();
    const s = new Set(read); const add = !s.has(n);
    add ? s.add(n) : s.delete(n);
    update({ readPages: [...s].sort((a, b) => a - b), logPages: add ? 1 : 0 });
    if (add && cur && plan.goalType !== 'time' && !todayDone && n >= cur.from && n <= cur.to) {
      const left = readingList(ctx).filter(p => p >= cur.from && p <= cur.to && !s.has(p));
      if (left.length === 0) setTimeout(complete, 250);
    }
  };

  const nextFrom = (p, d) => { let n = Math.max(1, Math.min(total, p + d)); while (skipSet.has(n) && n > 1 && n < total) n += d; return n; };
  const goTo = (p) => {
    const n = Math.max(1, Math.min(total, p));
    if (mode === 'vertical' && areaRef.current) { fromScroll.current = true; areaRef.current.scrollTo({ top: tops[n - 1] - PAGE_GAP, behavior: Math.abs(n - page) > 3 ? 'auto' : 'smooth' }); }
    setPage(n);
  };
  const turn = (d) => { poke(); setPop(null); setDir(d); goTo(nextFrom(page, d)); };
  const jump = (p, keepSheet) => { if (!keepSheet) setSheet(null); else setSheet(null); setDir(0); goTo(p); };

  const onScroll = (e) => {
    poke();
    if (mode !== 'vertical') return;
    const el = e.currentTarget;
    const n = Math.max(1, Math.min(total, pageAt(el.scrollTop + el.clientHeight * 0.35)));
    if (n !== page) setPage(n);
  };

  // search: persistent across opening/closing the sheet
  const search = useBookSearch(doc, total, ctx.searchState, (s) => update({ searchState: s }));
  const activeHit = search.active >= 0 ? search.res[search.active] : null;
  const stepHit = (d) => { if (!search.res.length) return; const i = (search.active + d + search.res.length) % search.res.length; search.setActive(i); jump(search.res[i].p); };

  React.useEffect(() => {
    const k = (e) => {
      if (sheet || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight' || (mode === 'vertical' && e.key === 'PageDown')) turn(1);
      if (e.key === 'ArrowLeft' || (mode === 'vertical' && e.key === 'PageUp')) turn(-1);
      if (e.key === '+' || e.key === '=') setZoom(z => z * 1.25); if (e.key === '-') setZoom(z => z / 1.25); if (e.key === '0') setZoom(1);
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  React.useEffect(() => { // ctrl/⌘ + wheel or trackpad pinch
    const el = areaRef.current; if (!el) return;
    const w = (e) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); setZoom(z => z * (e.deltaY < 0 ? 1.1 : 0.9), { x: e.clientX, y: e.clientY }); };
    el.addEventListener('wheel', w, { passive: false }); return () => el.removeEventListener('wheel', w);
  });

  // text selection → highlight / note. On Android these live in the system Copy / Share menu.
  const selInfo = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const text = sel.toString().replace(/\s+/g, ' ').trim(); if (text.length < 2) return null;
    const range = sel.getRangeAt(0);
    const node = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    const pageEl = node && node.closest('[data-page]');
    if (!pageEl || !rootRef.current || !rootRef.current.contains(pageEl)) return null;
    const pr = pageEl.getBoundingClientRect(), rr = rootRef.current.getBoundingClientRect();
    const rects = [...range.getClientRects()].filter(r => r.width > 1 && r.height > 1)
      .map(r => [(r.left - pr.left) / pr.width, (r.top - pr.top) / pr.height, r.width / pr.width, r.height / pr.height])
      .filter(r => r[0] < 1 && r[1] < 1 && r[0] + r[2] > 0 && r[1] + r[3] > 0)
      .map(([x, y, w, h]) => [Math.max(0, x), Math.max(0, y), Math.min(w, 1 - Math.max(0, x)), Math.min(h, 1 - Math.max(0, y))]);
    if (!rects.length) return null;
    const b = range.getBoundingClientRect();
    return { page: +pageEl.dataset.page, text: text.slice(0, 600), rects, x: Math.max(110, Math.min(rr.width - 110, (b.left + b.right) / 2 - rr.left)), y: Math.max(130, b.top - rr.top - 10) };
  };
  React.useEffect(() => {
    if (Platform.native) return; // Android shows its own menu with Highlight and Note added
    let t;
    const on = () => { clearTimeout(t); t = setTimeout(() => setPop(selInfo()), 180); };
    document.addEventListener('selectionchange', on);
    return () => { document.removeEventListener('selectionchange', on); clearTimeout(t); };
  }, []);
  const clearSel = () => { const s = window.getSelection(); s && s.removeAllRanges(); setPop(null); };
  const addHl = (info, color, withNote) => {
    if (!info) return;
    const h = { id: Date.now().toString(36), page: info.page, text: info.text, rects: info.rects, color, note: '', at: Date.now() };
    update({ highlights: [...highlights, h] }); clearSel();
    if (withNote) setEditHl(h);
  };
  const hlRef = React.useRef(); hlRef.current = (action) => addHl(selInfo(), 'yellow', action === 'note');
  React.useEffect(() => {
    window.__vpSel = (action) => hlRef.current(action);
    Platform.setSelectionTools(true);
    return () => { delete window.__vpSel; Platform.setSelectionTools(false); };
  }, []);

  // gestures: swipe (horizontal mode), pinch zoom around the fingers, double-tap zoom
  const pts = () => [...ptrs.current.values()];
  const onPD = (e) => {
    poke(); ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 1) swipe.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    if (ptrs.current.size === 2) {
      const [a, b] = pts(), el = areaRef.current, r = el.getBoundingClientRect();
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      pinch0.current = { d: Math.hypot(a.x - b.x, a.y - b.y), mid, ox: mid.x - r.left + el.scrollLeft, oy: mid.y - r.top + el.scrollTop };
      swipe.current = null;
    }
  };
  const onPM = (e) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 2 && pinch0.current) {
      const [a, b] = pts(); const p0 = pinch0.current;
      const s = Math.max(ZMIN / zoom, Math.min(ZMAX / zoom, Math.hypot(a.x - b.x, a.y - b.y) / p0.d));
      setPinch({ s, ox: p0.ox, oy: p0.oy });
    }
  };
  const onPU = (e) => {
    const start = swipe.current; ptrs.current.delete(e.pointerId);
    if (pinch0.current && ptrs.current.size < 2) {
      const s = pinch ? pinch.s : 1, mid = pinch0.current.mid; pinch0.current = null; setPinch(null);
      if (Math.abs(s - 1) > 0.02) { setZoom(z => z * s, mid); suppressClick.current = true; }
      return;
    }
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y, sel = window.getSelection();
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && Date.now() - start.t < 300) { // double-tap to zoom
      const now = Date.now();
      if (now - lastTap.current < 300) { lastTap.current = 0; suppressClick.current = true; setZoom(zoom > 1.05 ? 1 : 2, { x: e.clientX, y: e.clientY }); return; }
      lastTap.current = now;
    }
    if (mode !== 'horizontal' || zoom > 1.01) { swipe.current = null; return; }
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - start.t < 700 && (!sel || sel.isCollapsed)) { suppressClick.current = true; turn(dx < 0 ? 1 : -1); }
    swipe.current = null;
  };
  const onTap = () => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    const sel = window.getSelection(); if (sel && !sel.isCollapsed) return;
    setTimeout(() => { if (lastTap.current) setChrome(c => !c); }, 310); // wait: might be a double-tap
  };

  const isTime = plan.goalType === 'time';
  const pct = isTime ? Math.min(100, (secs / (plan.minutes * 60)) * 100) : cur ? (readToday / Math.max(1, cur.count)) * 100 : 100;
  const fade = { opacity: chrome ? 1 : 0, pointerEvents: chrome ? 'auto' : 'none', transition: 'opacity .2s' };
  const toggleSkip = () => { const s = new Set(skipSet); s.has(page) ? s.delete(page) : s.add(page); update({ skip: [...s].sort((a, b) => a - b) }); };
  const toggleMark = () => update({ bookmarks: marked ? bookmarks.filter(p => p !== page) : [...bookmarks, page].sort((a, b) => a - b) });
  const hitFor = (n) => (activeHit && activeHit.p === n ? search.q.trim() : null);
  const pageProps = (n) => ({ n, doc, pw, ph, look, skipped: skipSet.has(n), marked: bookmarks.includes(n), read: read.has(n), onToggleRead: toggleRead, highlights: highlights.filter(h => h.page === n), onHlTap: setEditHl, hit: hitFor(n) });
  const todayIdx = todayDone ? plan.doneDays - 1 : plan.doneDays;
  const endFor = (n, vertical) => { const d = ends.get(n); if (!d) return null; const st = d.i === todayIdx ? 'today' : d.status === 'today' ? 'upcoming' : d.status; return <DayEnd d={d.i} status={st} vertical={vertical} onNext={n < total && mode === 'horizontal' ? () => turn(1) : null} />; };

  const pinchStyle = pinch ? { transform: `scale(${pinch.s})`, transformOrigin: `${pinch.ox}px ${pinch.oy}px` } : null;
  const innerW = Math.max(pw + 2 * PAGE_GAP, 0);
  const content = loading || !doc
    ? <div style={{ margin: '40px auto', width: pw, height: ph, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{loading ? <div className="spin" style={{ width: 22, height: 22, borderRadius: 999, border: '2.5px solid var(--fill-2)', borderTopColor: 'var(--sage)' }} /> : <span style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--ink-2)' }}>This PDF couldn&rsquo;t be opened.</span>}</div>
    : mode === 'horizontal'
      ? <div ref={innerRef} style={{ minWidth: '100%', width: innerW, minHeight: '100%', boxSizing: 'border-box', padding: PAGE_GAP, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: zoom > 1.01 ? 'flex-start' : 'center', ...pinchStyle }}>
          <PageView key={page} {...pageProps(page)} live anim={dir > 0 ? 'pgInNext .22s ease-out' : dir < 0 ? 'pgInPrev .22s ease-out' : 'veilIn .14s ease'} after={<div style={{ width: Math.min(pw, W) }}>{endFor(page, false)}</div>} />
        </div>
      : <div ref={innerRef} style={{ position: 'relative', width: Math.max(innerW, 1), minWidth: '100%', height: tops[total], ...pinchStyle }}>
          {Array.from({ length: total }, (_, i) => i + 1).filter(n => Math.abs(n - page) <= 3).map(n => (
            <div key={n} style={{ position: 'absolute', top: tops[n - 1], left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
              <PageView {...pageProps(n)} live after={ends.has(n) ? <div style={{ width: pw, height: DAY_H, boxSizing: 'border-box' }}>{endFor(n, true)}</div> : null} />
            </div>
          ))}
        </div>;

  const headStatus = plan.finished ? 'Plan complete'
    : todayDone ? `Today done · Day ${plan.day}: ${isTime ? `${plan.minutes} min` : `${readToday}/${cur ? cur.count : 0} pages`} next`
    : isTime ? `${Math.floor(secs / 60)}/${plan.minutes} min today` : `${readToday}/${cur ? cur.count : 0} pages read today`;

  return (
    <div ref={rootRef} style={{ height: '100%', position: 'relative', background: 'var(--fill)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 'calc(var(--sat) + 8px) 16px 10px', background: 'var(--cream)', borderBottom: '1px solid var(--line)', zIndex: 4, ...fade }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconBtn name="arrowLeft" size={40} onClick={onBack} />
          <button onClick={() => setSheet('goto')} style={{ flex: 1, minWidth: 0, textAlign: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 15, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{plan.title}</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-2)', marginTop: 1, display: 'inline-flex', alignItems: 'center', gap: 3 }}>Page {page} of {total} <Icon name="chevronDown" size={13} /></div>
          </button>
          <IconBtn name="more" size={40} onClick={() => setSheet('menu')} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <div style={{ flex: 1 }}><ProgressBar value={plan.finished ? 100 : todayDone ? 100 : pct} height={4} /></div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, color: todayDone ? 'var(--sage)' : 'var(--ink)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {todayDone && !plan.finished && <Icon name="check" size={13} stroke={2.6} />}{headStatus}
          </span>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <div ref={areaRef} onScroll={onScroll} onClick={onTap} onPointerDown={onPD} onPointerMove={onPM} onPointerUp={onPU} onPointerCancel={onPU}
          style={{ position: 'absolute', inset: 0, overflow: 'auto', cursor: 'default', touchAction: 'pan-x pan-y',
            scrollSnapType: mode === 'vertical' && snap ? 'y mandatory' : 'none', scrollPaddingTop: PAGE_GAP, overscrollBehavior: 'contain', scrollbarWidth: 'none' }}>
          {content}
        </div>
        {/* zoom — top of the canvas, small, out of the way of page turning */}
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 3, display: 'flex', alignItems: 'center', height: 32, borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--line)', ...fade }}>
          <button onClick={() => setZoom(z => z / 1.25)} title="Zoom out" style={zBtn}><Icon name="minus" size={15} /></button>
          <button onClick={() => setZoom(1)} title="Fit width" style={{ ...zBtn, width: 'auto', minWidth: 38, fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>{Math.round(zoom * (pinch ? pinch.s : 1) * 100)}%</button>
          <button onClick={() => setZoom(z => z * 1.25)} title="Zoom in" style={zBtn}><Icon name="plus" size={15} /></button>
        </div>
        {/* the last search stays here until you clear it */}
        {search.q && search.done && search.res.length > 0 && (
          <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 3, display: 'flex', alignItems: 'center', height: 32, borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--line)', paddingLeft: 10, maxWidth: 'calc(100% - 150px)', ...fade }}>
            <button onClick={() => setSheet('search')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
              <Icon name="search" size={13} /><span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{search.q}</span>
              <span style={{ color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{search.active >= 0 ? `${search.active + 1}/` : ''}{search.res.length}</span>
            </button>
            <button onClick={() => stepHit(-1)} aria-label="Previous result" style={zBtn}><Icon name="chevronDown" size={14} style={{ transform: 'rotate(180deg)' }} /></button>
            <button onClick={() => stepHit(1)} aria-label="Next result" style={zBtn}><Icon name="chevronDown" size={14} /></button>
            <button onClick={search.clear} aria-label="Clear search" style={zBtn}><Icon name="close" size={13} /></button>
          </div>
        )}
      </div>

      {pop && !Platform.native && (
        <div onPointerDown={e => e.preventDefault()} style={{ position: 'absolute', left: pop.x, top: pop.y, transform: 'translate(-50%, -100%)', zIndex: 7, display: 'flex', alignItems: 'center', gap: 2, padding: 4, borderRadius: 999, background: '#141414', animation: 'pop .18s ease-out' }}>
          {Object.keys(HL_SWATCH).map(c => <button key={c} onClick={() => addHl(pop, c)} aria-label={`Highlight ${c}`} style={{ width: 30, height: 30, borderRadius: 999, border: 'none', cursor: 'pointer', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ width: 18, height: 18, borderRadius: 999, background: HL_SWATCH[c] }} /></button>)}
          <span style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />
          <button onClick={() => addHl(pop, 'yellow', true)} style={popBtn}><Icon name="edit" size={14} /> Note</button>
          <button onClick={() => { Platform.copy(pop.text); clearSel(); }} style={popBtn}>Copy</button>
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
          <ToolBtn icon="search" label="Search" on={!!(search.q && search.done)} onClick={() => setSheet('search')} />
          <ToolBtn icon={marked ? 'bookmarkOn' : 'bookmark'} label={marked ? 'Saved' : 'Bookmark'} on={marked} onClick={toggleMark} />
          <ToolBtn icon="edit" label="Notes" onClick={() => setSheet('notes')} />
          <ToolBtn icon="sliders" label="Display" onClick={() => setSheet('display')} />
        </div>
      </div>

      {sheet === 'menu' && (
        <ReaderSheet title="Page options" onClose={() => setSheet(null)}>
          <div style={sheetScroll}>
            <MenuRow icon="check" on={read.has(page)} label={read.has(page) ? 'Page read' : 'Mark this page as read'} sub={read.has(page) ? 'Tap to untick it' : `Page ${page}`} onClick={() => { toggleRead(page); setSheet(null); }} />
            <MenuRow icon="pages" on={skipped} label={skipped ? 'Count this page as reading' : 'Skip this page'} sub={skipped ? 'It’s skipped now' : 'For covers, contents and notes'} onClick={() => { toggleSkip(); setSheet(null); }} />
            <MenuRow icon="arrowRight" label="Go to page" sub={`You’re on page ${page} of ${total}`} onClick={() => setSheet('goto')} />
            <MenuRow icon="list" label="Contents" sub="Chapters, bookmarks and notes" onClick={() => setSheet('contents')} />
            <MenuRow icon="sliders" label="Display" sub="Page colour, scrolling and zoom" onClick={() => setSheet('display')} />
          </div>
        </ReaderSheet>
      )}
      {(sheet === 'contents' || sheet === 'notes') && <ContentsSheet initialTab={sheet === 'notes' ? 'hl' : 'contents'} doc={doc} page={page} bookmarks={bookmarks} highlights={highlights} onJump={jump}
        onRemoveMark={p => update({ bookmarks: bookmarks.filter(x => x !== p) })} onEditHl={h => { setSheet(null); setEditHl(h); }} onClose={() => setSheet(null)} />}
      {sheet === 'search' && <SearchSheet search={search} total={total} onJump={jump} onClose={() => setSheet(null)} />}
      {sheet === 'display' && <DisplaySheet look={look} setLook={v => update({ pageLook: v })} mode={mode} setMode={v => update({ scrollMode: v })} snap={snap} setSnap={v => update({ vSnap: v })} zoom={zoom} setZoom={setZoom} onClose={() => setSheet(null)} />}
      {sheet === 'goto' && <GotoSheet page={page} total={total} today={plan.finished || !cur ? null : { from: cur.from }} onJump={jump} onClose={() => setSheet(null)} />}
      {editHl && <NoteSheet key={editHl.id} hl={editHl} onClose={() => setEditHl(null)}
        onSave={(note, color) => { update({ highlights: highlights.some(h => h.id === editHl.id) ? highlights.map(h => h.id === editHl.id ? { ...h, note, color } : h) : [...highlights, { ...editHl, note, color }] }); setEditHl(null); }}
        onDelete={() => { update({ highlights: highlights.filter(h => h.id !== editHl.id) }); setEditHl(null); }} />}
      {sheet === 'done' && (
        <ReaderSheet title={'Today’s reading is done'} onClose={() => setSheet(null)} right={<span />}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13.5, color: 'var(--ink-2)', marginTop: -8, marginBottom: 16 }}>Day {Math.max(1, plan.doneDays)} of {plan.days} complete</div>
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
