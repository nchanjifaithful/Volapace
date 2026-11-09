// notes.jsx — the Notes tab: every highlight, note and bookmark, grouped by book. Tapping one opens
// the reader at that page. Load after reader-view.jsx (uses HL_SWATCH).

function NotesScreen({ ctx = {}, openBook }) {
  const lib = useLib();
  const [tab, setTab] = React.useState('notes');
  const [q, setQ] = React.useState('');
  const books = lib.map(e => ({ e, s: e.id === ctx.bookId ? ctx : (e.snap || {}) }));
  const needle = q.trim().toLowerCase();
  const match = (h, e) => !needle || (h.text || '').toLowerCase().includes(needle) || (h.note || '').toLowerCase().includes(needle) || (e.title || '').toLowerCase().includes(needle);
  const withNotes = books.map(({ e, s }) => ({ e, items: [...(s.highlights || [])].filter(h => match(h, e)).sort((a, b) => a.page - b.page || a.at - b.at) })).filter(x => x.items.length);
  const withMarks = books.map(({ e, s }) => ({ e, s, pages: (s.bookmarks || []).filter(p => !needle || (e.title || '').toLowerCase().includes(needle) || String(p) === needle) })).filter(x => x.pages.length);
  const nNotes = books.reduce((n, x) => n + (x.s.highlights || []).length, 0);
  const nMarks = books.reduce((n, x) => n + (x.s.bookmarks || []).length, 0);
  const empty = tab === 'notes' ? withNotes.length === 0 : withMarks.length === 0;

  return (
    <div style={SCREEN_PAD}>
      <h1 style={{ ...H1, marginBottom: 4 }}>Notes</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--ink-2)', marginBottom: 16 }}>
        <Icon name="note" size={16} /> {nNotes} note{nNotes === 1 ? '' : 's'} &amp; highlight{nNotes === 1 ? '' : 's'} &middot; {nMarks} bookmark{nMarks === 1 ? '' : 's'}
      </div>

      {(nNotes + nMarks) > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 48, padding: '0 16px', borderRadius: 999, background: 'var(--fill)', border: '1px solid var(--line)', marginBottom: 14 }}>
          <Icon name="search" size={19} style={{ color: 'var(--ink-3)' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search your notes" enterKeyHint="search"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-ui)', fontSize: 15.5, color: 'var(--ink)' }} />
          {q && <button onClick={() => setQ('')} aria-label="Clear search" style={{ border: 'none', background: 'none', padding: 4, cursor: 'pointer', color: 'var(--ink-3)', display: 'flex' }}><Icon name="close" size={16} /></button>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <Chip on={tab === 'notes'} onClick={() => setTab('notes')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Icon name="edit" size={15} />Notes &amp; highlights</Chip>
        <Chip on={tab === 'marks'} onClick={() => setTab('marks')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Icon name="bookmark" size={15} />Bookmarks</Chip>
      </div>

      {empty ? (
        <div style={{ textAlign: 'center', padding: '40px 12px 20px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: 'var(--fill)', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><Icon name={tab === 'notes' ? 'note' : 'bookmark'} size={28} /></div>
          <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 17, color: 'var(--ink)' }}>{needle ? `Nothing matches “${q.trim()}”` : tab === 'notes' ? 'No notes yet' : 'No bookmarks yet'}</div>
          {!needle && <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.45 }}>{tab === 'notes' ? 'Select text in the reader to highlight it, or add a note from Contents.' : 'Tap the bookmark button in the reader to save a page.'}</div>}
        </div>
      ) : tab === 'notes' ? withNotes.map(({ e, items }) => (
        <div key={e.id} style={{ marginBottom: 20 }}>
          <BookGroupHead entry={e} count={`${items.length} note${items.length === 1 ? '' : 's'}`} onClick={() => openBook(e)} />
          <div style={{ borderRadius: 16, border: '1px solid var(--line)', background: 'var(--surface)', overflow: 'hidden' }}>
            {items.map((h, k) => (
              <button key={h.id} onClick={() => openBook(e, h.page)} style={{ width: '100%', display: 'flex', gap: 12, padding: '13px 14px', background: 'none', border: 'none', borderBottom: k < items.length - 1 ? '1px solid var(--line)' : 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ alignSelf: 'stretch', width: 3, borderRadius: 2, background: h.text ? (HL_SWATCH[h.color] || HL_SWATCH.yellow) : 'var(--ink)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {h.text ? <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15, lineHeight: 1.4, color: 'var(--ink)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>&ldquo;{h.text}&rdquo;</div>
                    : <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13, color: 'var(--ink-2)' }}>Page note</div>}
                  {h.note && <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13.5, lineHeight: 1.4, color: 'var(--ink)', marginTop: h.text ? 6 : 2 }}>{h.note}</div>}
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>Page {h.page}{h.at ? ` · ${new Date(h.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}</div>
                </div>
                <Icon name="chevronRight" size={18} style={{ color: 'var(--ink-3)', alignSelf: 'center' }} />
              </button>
            ))}
          </div>
        </div>
      )) : withMarks.map(({ e, s, pages }) => (
        <div key={e.id} style={{ marginBottom: 20 }}>
          <BookGroupHead entry={e} count={`${pages.length} bookmark${pages.length === 1 ? '' : 's'}`} onClick={() => openBook(e)} />
          <BookmarkList pages={pages} highlights={s.highlights || []} chs={e.chapters || (e.id === PdfStore.id ? PdfStore.chapters : [])} onOpen={p => openBook(e, p)} />
        </div>
      ))}
    </div>
  );
}

function BookGroupHead({ entry, count, onClick }) {
  return (
    <button onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: '0 2px', marginBottom: 10, cursor: 'pointer', textAlign: 'left' }}>
      <BookCover book={entryBook(entry)} w={26} radius={4} style={{ boxShadow: 'none' }} />
      <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 15, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.title}</span>
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-3)', flexShrink: 0 }}>{count}</span>
    </button>
  );
}

Object.assign(window, { NotesScreen, BookGroupHead });
