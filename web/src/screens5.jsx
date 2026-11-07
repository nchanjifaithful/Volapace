// screens5.jsx — Library (Bookshelf) + You (Identity Hub) + modals/sheets

// ════════════════════════════════════════════════════════════
// Shared overlay wrappers (app renders backdrop; these position)
// ════════════════════════════════════════════════════════════
function BottomSheet({ children }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 2,
      animation: 'sheetUp .32s cubic-bezier(.2,.8,.2,1)',
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: '28px 28px 0 0', padding: '10px 20px calc(var(--sab) + 28px)', maxHeight: 'calc(100vh - var(--sat) - 20px)', overflowY: 'auto', boxSizing: 'border-box',
        boxShadow: '0 -12px 40px rgba(0,0,0,0.22)', border: '1px solid var(--line)', borderBottom: 'none',
      }}>
        <div style={{ width: 38, height: 5, borderRadius: 999, background: 'var(--dash)', margin: '0 auto 18px' }} />
        {children}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB 3 — LIBRARY
// ════════════════════════════════════════════════════════════
const LIB_FILTERS = [['all', 'All'], ['active', 'Reading'], ['completed', 'Finished'], ['paused', 'Paused'], ['unscheduled', 'Saved']];

// Windowed list: only rows near the viewport are mounted, so 1,000+ books stay smooth.
// Rows have a fixed height; the scroller is the app's content area (ScrollCtx from shell.jsx).
function VirtualRows({ count, rowHeight, render, overscan = 4 }) {
  const scroller = React.useContext(ScrollCtx);
  const ref = React.useRef(null);
  const [win, setWin] = React.useState([0, Math.min(count, 12)]);
  React.useLayoutEffect(() => {
    const el = scroller && scroller.current; if (!el || !ref.current) return;
    const calc = () => {
      const top = ref.current.getBoundingClientRect().top - el.getBoundingClientRect().top;
      const first = Math.max(0, Math.floor(-top / rowHeight) - overscan);
      const last = Math.min(count, Math.ceil((el.clientHeight - top) / rowHeight) + overscan);
      setWin(w => (w[0] === first && w[1] === last ? w : [first, Math.max(first, last)]));
    };
    calc();
    el.addEventListener('scroll', calc, { passive: true }); window.addEventListener('resize', calc);
    return () => { el.removeEventListener('scroll', calc); window.removeEventListener('resize', calc); };
  }, [count, rowHeight, scroller]);
  const rows = [];
  for (let i = win[0]; i < win[1]; i++) rows.push(<div key={i} style={{ position: 'absolute', left: 0, right: 0, top: i * rowHeight, height: rowHeight }}>{render(i)}</div>);
  return <div ref={ref} style={{ position: 'relative', height: count * rowHeight }}>{rows}</div>;
}

function LibraryScreen({ go, ctx = {}, openBook, forget }) {
  const [filter, setFilter] = React.useState('all');
  const [view, setView] = React.useState('grid');
  const [openId, setOpenId] = React.useState(null);
  const [q, setQ] = React.useState('');
  const [searching, setSearching] = React.useState(false);
  const lib = useLib();
  const ALL = React.useMemo(() => lib.map(e => entryBook(e, ctx)), [lib, ctx]);
  const needle = q.trim().toLowerCase();
  const shown = ALL.filter(b => (filter === 'all' || b.status === filter) && (!needle || b.title.toLowerCase().includes(needle) || (b.author || '').toLowerCase().includes(needle)));
  const finished = ALL.filter(b => b.status === 'completed').length;
  const open = (b) => openBook(b.entry);
  const remove = async (b) => {
    const ok = await Platform.confirm(`Remove “${b.title}”?`, b.paper ? 'Its plan and progress are removed from Volapace.' : 'The PDF is deleted from the Volapace folder on this phone, along with its plan and progress.', 'Remove');
    if (!ok) return;
    await Lib.remove(b.id);
    if (b.id === ctx.bookId) forget && forget();
  };
  const label = LIB_FILTERS.find(f => f[0] === filter)[1];

  // grid geometry: 3 columns inside 22px gutters, 12px gaps; title area fixed at two lines
  const [vw, setVw] = React.useState(() => window.innerWidth);
  React.useEffect(() => { const on = () => setVw(window.innerWidth); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []);
  const colW = (Math.min(vw, 900) - 44 - 24) / 3;
  const gridRowH = Math.round(colW * 1.5 + 8 + 34 + 18 + 20);
  const listRowH = 128;
  const VIRTUAL = shown.length > 48;

  const gridRow = (r) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', columnGap: 12 }}>
      {shown.slice(r * 3, r * 3 + 3).map(b => <GridBook key={b.id} book={b} onClick={() => open(b)} />)}
    </div>
  );
  const listRow = (b) => <SwipeRow key={b.id} book={b} go={() => open(b)} onRemove={() => remove(b)} open={openId === b.id} setOpen={(v) => setOpenId(v ? b.id : null)} />;

  return (
    <div style={{ ...SCREEN_PAD, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={H1}>Library</h1>
        {ALL.length > 0 && <IconBtn name={searching ? 'close' : 'search'} onClick={() => { setSearching(s => !s); setQ(''); }} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--ink-2)', marginBottom: 18 }}>
        <Icon name="library" size={16} /> {ALL.length} book{ALL.length === 1 ? '' : 's'} on this phone &middot; {finished} finished
      </div>

      {searching && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 48, padding: '0 16px', borderRadius: 999, background: 'var(--fill)', border: '1px solid var(--line)', marginBottom: 16 }}>
          <Icon name="search" size={19} style={{ color: 'var(--ink-3)' }} />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Title or author"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-ui)', fontSize: 15.5, color: 'var(--ink)' }} />
        </div>
      )}

      {ALL.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 12px 20px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: 'var(--fill)', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><Icon name="library" size={28} /></div>
          <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 17, color: 'var(--ink)' }}>Your shelf is empty</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.45 }}>Add a PDF or a paper book. PDFs you copy into <b style={{ fontWeight: 600 }}>{Platform.folderLabel()}</b> appear here too.</div>
          <div style={{ marginTop: 18 }}><Button icon="plus" onClick={() => go('upload')}>Add a book</Button></div>
        </div>
      ) : <>
      <HScroll gap={8} style={{ marginBottom: 18 }}>
        {LIB_FILTERS.map(([k, l]) => <Chip key={k} on={filter === k} onClick={() => { setFilter(k); setOpenId(null); }} style={{ scrollSnapAlign: 'start', display: 'inline-flex', alignItems: 'center', gap: 7 }}>{GRID_STATE[k] && <span style={{ width: 8, height: 8, borderRadius: 999, background: GRID_STATE[k].solid, boxShadow: filter === k ? '0 0 0 1.5px var(--cream)' : 'none' }} />}{l}</Chip>)}
      </HScroll>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 17, color: 'var(--ink)', letterSpacing: -0.2 }}>
          {needle ? 'Results' : filter === 'all' ? 'All books' : label} <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>{shown.length}</span>
        </span>
        <div style={{ display: 'flex', padding: 3, borderRadius: 999, background: 'var(--fill)', border: '1px solid var(--line)' }}>
          {[['grid', 'grid'], ['list', 'list']].map(([k, ic]) => (
            <button key={k} onClick={() => setView(k)} style={{ width: 36, height: 30, borderRadius: 999, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: view === k ? 'var(--surface)' : 'transparent', color: view === k ? 'var(--ink)' : 'var(--ink-3)', boxShadow: view === k ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all .15s' }}>
              <Icon name={ic} size={17} />
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 && <div style={{ textAlign: 'center', padding: '28px 0', fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--ink-2)' }}>{needle ? `No books match “${q.trim()}”` : 'No books here yet'}</div>}

      <div key={filter + view} style={{ animation: 'fadeUp .28s cubic-bezier(.2,.8,.2,1)' }}>
        {view === 'grid' ? (
          VIRTUAL ? <VirtualRows count={Math.ceil(shown.length / 3)} rowHeight={gridRowH} render={gridRow} />
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', columnGap: 12, rowGap: 20 }}>
            {shown.map(b => <GridBook key={b.id} book={b} onClick={() => open(b)} />)}
          </div>
        ) : (
          <>
            {VIRTUAL ? <VirtualRows count={shown.length} rowHeight={listRowH} render={(i) => listRow(shown[i])} />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{shown.map(listRow)}</div>}
            {shown.length > 0 && <div style={{ textAlign: 'center', marginTop: 16, fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-3)' }}>
              Swipe right to read, left to remove
            </div>}
          </>
        )}
      </div>
      </>}
      <div style={{ position: 'sticky', bottom: 'calc(var(--sab) + 108px)', height: 0, display: 'flex', justifyContent: 'flex-end', zIndex: 10 }}>
        <button onClick={() => go('upload')} aria-label="Add a book" style={{ marginTop: -60, width: 58, height: 58, borderRadius: 999, border: 'none', cursor: 'pointer', background: 'var(--ink)', color: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.22)' }}>
          <Icon name="plus" size={26} stroke={2.2} />
        </button>
      </div>
    </div>
  );
}

function bookMeta(b) {
  if (b.status === 'completed') return b.dayLabel;
  if (b.status === 'unscheduled') return 'Saved';
  if (b.status === 'paused') return `Paused \u00b7 ${b.planPct}%`;
  return `${b.planPct}% \u00b7 ${b.dayLabel}`;
}

const GRID_STATE = {
  active:      { label: 'Reading',  solid: 'var(--st-reading)',  solidFg: '#fff', icon: 'book' },
  completed:   { label: 'Finished', solid: 'var(--st-finished)', solidFg: '#fff', icon: 'check' },
  paused:      { label: 'Paused',   solid: 'var(--st-paused)',   solidFg: '#fff', icon: 'clock' },
  unscheduled: { label: 'Saved',    solid: 'var(--st-saved)',    solidFg: '#fff', icon: 'bookmark' },
};

function GridBook({ book, onClick }) {
  const [press, setPress] = React.useState(false);
  const st = GRID_STATE[book.status] || GRID_STATE.unscheduled;
  const showPct = book.status === 'active' || book.status === 'paused';
  return (
    <button onClick={onClick} onPointerDown={() => setPress(true)} onPointerUp={() => setPress(false)} onPointerLeave={() => setPress(false)}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', alignSelf: 'start', transform: press ? 'scale(0.96)' : 'none', transition: 'transform .14s' }}>
      <div style={{ position: 'relative' }}>
        <BookCover book={book} w={108} radius={10} foot={22} head={showPct ? 18 : 0} style={{ width: '100%', height: 'auto', aspectRatio: '2/3', boxShadow: 'none' }} />
        {showPct && <span style={{ position: 'absolute', right: 6, top: 6, height: 20, padding: '0 7px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', background: '#fff', color: '#141414', fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 11, fontVariantNumeric: 'tabular-nums', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>{bookPage(book)}/{book.pages}</span>}
        <span style={{ position: 'absolute', left: 6, bottom: 6, display: 'inline-flex', alignItems: 'center', gap: 3, height: 18, padding: st.icon ? '0 6px 0 5px' : '0 7px', borderRadius: 999,
          background: st.solid, color: st.solidFg, fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 9.5, boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
          {st.icon && <Icon name={st.icon} size={9} stroke={2.6} />}{st.label}
        </span>
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 13.5, color: 'var(--ink)', marginTop: 8, lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{book.title}</div>
      {!showPct && <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3 }}>{book.status === 'completed' ? book.dayLabel : `${book.pages} pages`}</div>}
    </button>
  );
}

function SwipeRow({ book, go, open, setOpen, onRemove }) {
  const [dx, setDx] = React.useState(0);
  const drag = React.useRef(null);
  const REVEAL = 88, THRESH = 50;
  React.useEffect(() => { if (!open) setDx(0); }, [open]);
  const onDown = (e) => { drag.current = { x: e.clientX, base: dx }; e.currentTarget.setPointerCapture(e.pointerId); };
  const onMove = (e) => {
    if (!drag.current) return;
    setDx(Math.max(-REVEAL - 20, Math.min(REVEAL + 20, drag.current.base + (e.clientX - drag.current.x))));
  };
  const onUp = () => {
    if (!drag.current) return;
    drag.current = null;
    if (dx > THRESH) { setDx(REVEAL); setOpen(true); }
    else if (dx < -THRESH) { setDx(-REVEAL); setOpen(true); }
    else { setDx(0); setOpen(false); }
  };
  const moved = Math.abs(dx) > 4;
  const tap = () => { if (open) { setDx(0); setOpen(false); } else if (!moved) go(); };
  const act = (bg, icon, label, show, onClick) => (
    <button onClick={onClick} style={{ width: REVEAL, background: bg, border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: show ? 1 : 0 }}>
      <Icon name={icon} size={21} /><span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 11 }}>{label}</span>
    </button>
  );

  return (
    <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--line)' }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        {act('var(--ink)', 'play', 'Read', dx > 0, () => { setDx(0); setOpen(false); go(); })}
        <div style={{ flex: 1 }} />
        {act('var(--sage)', 'close', onRemove ? 'Remove' : 'Archive', dx < 0, () => { setDx(0); setOpen(false); onRemove && onRemove(); })}
      </div>
      <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onClick={tap}
        style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, padding: 12, background: 'var(--surface)', cursor: 'pointer', touchAction: 'pan-y',
          transform: `translateX(${dx}px)`, transition: drag.current ? 'none' : 'transform .28s cubic-bezier(.2,.8,.2,1)' }}>
        <BookCover book={book} w={52} radius={7} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 15, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.title}</div>
            <StatusBadge status={book.status} />
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-2)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.author ? `By ${book.author} · ` : ''}{book.pages ? `${book.pages} pages` : book.genre}</div>
          {book.status !== 'unscheduled' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 9 }}>
              <div style={{ flex: 1 }}><ProgressBar value={book.planPct} height={5} fill="var(--ink)" /></div>
            </div>
          )}
          {book.status !== 'unscheduled' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: 'var(--font-ui)', fontSize: 11.5, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>
              <span>{book.status === 'completed' ? 'Finished' : `${bookPage(book)}/${book.pages} pages`}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB 4 — YOU
// ════════════════════════════════════════════════════════════

const DEFAULT_NOTIFY = { on: true, time: '20:00', rescue: true };
const DEFAULT_QUIET = { on: false, from: '09:00', to: '17:00', days: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: false, Sun: false } };
const notifyOf = (ctx) => ({ ...DEFAULT_NOTIFY, ...(ctx.notify || {}) });
const quietOf = (ctx) => ({ ...DEFAULT_QUIET, ...(ctx.quiet || {}), days: { ...DEFAULT_QUIET.days, ...((ctx.quiet && ctx.quiet.days) || {}) } });

function YouScreen({ theme, setTheme, openModal, closeModal, account, setAccount, ctx = {}, update }) {
  const themes = [['light', 'Light', 'sun'], ['dark', 'Dark', 'moon'], ['system', 'System', 'cog']];
  const editAccount = () => openModal(<AccountSheet close={closeModal} account={account} onSave={setAccount} />);
  const name = (account.name || '').trim();
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  const lib = useLib();
  const life = lifetimeStats(ctx);
  const stats = [[lib.length, lib.length === 1 ? 'Book' : 'Books'], [life.streak, 'Day streak'], [life.hours, 'Hours']];
  const n = notifyOf(ctx), qt = quietOf(ctx);
  const qDays = Object.keys(qt.days).filter(d => qt.days[d]);
  const [rescanned, setRescanned] = React.useState(false);
  return (
    <div style={SCREEN_PAD}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={H1}>Profile</h1>
        <IconBtn name="more" onClick={() => editAccount()} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: 999, background: 'var(--sage)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 24, flexShrink: 0 }}>{initials || <Icon name="user" size={28} />}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 20, color: name ? 'var(--ink)' : 'var(--ink-3)', letterSpacing: -0.3 }}>{name || 'Your name'}</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13.5, color: 'var(--ink-2)', marginTop: 2 }}>{account.since ? `Reading since ${account.since}` : account.email || 'Stored only on this phone'}</div>
        </div>
        <button onClick={() => editAccount()} style={{ height: 34, padding: '0 14px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>Edit</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 26 }}>
        {stats.map(([v, l]) => (
          <div key={l} style={{ padding: '14px 12px', borderRadius: 16, background: 'var(--fill)' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 22, color: 'var(--ink)', letterSpacing: -0.5 }}>{v}</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>

      <SectionHead title="Appearance" />
      <div style={{ display: 'flex', padding: 4, borderRadius: 999, background: 'var(--fill)', border: '1px solid var(--line)', marginBottom: 26 }}>
        {themes.map(([k, label, icon]) => {
          const on = theme === k;
          return (
            <button key={k} onClick={() => setTheme(k)} style={{ flex: 1, height: 40, borderRadius: 999, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-2)', boxShadow: on ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              fontFamily: 'var(--font-ui)', fontWeight: on ? 600 : 500, fontSize: 13.5, transition: 'all .18s' }}>
              <Icon name={icon} size={17} /> {label}
            </button>
          );
        })}
      </div>

      <SectionHead title="Preferences" />
      <div style={{ borderRadius: 'var(--card-radius)', background: 'var(--surface)', border: '1px solid var(--line)', overflow: 'hidden', marginBottom: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--fill)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="refresh" size={18} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 15, color: 'var(--ink)' }}>Smart catch-up</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-2)', marginTop: 1 }}>{ctx.autoCatchUp ? 'Missed pages spread automatically' : 'Ask before spreading missed pages'}</div>
          </div>
          <Toggle on={!!ctx.autoCatchUp} onChange={v => update({ autoCatchUp: v })} />
        </div>
        <PrefRow icon="target" title="Yearly goal" sub={`${life.goal} books in ${TODAY.getFullYear()}`} onClick={() => openModal(<YearGoalSheet close={closeModal} value={life.goal} done={life.books} onSave={v => update({ yearGoal: v })} />)} />
        <PrefRow icon="bell" title="Notifications" sub={n.on ? `Daily nudge at ${fmt12(n.time)}` : 'Off'} onClick={() => openModal(<NotificationSheet close={closeModal} value={n} onSave={v => update({ notify: v })} />)} />
        <PrefRow icon="calendar" title="Reading windows" sub={qt.on && qDays.length ? `Quiet ${fmt12(qt.from)} – ${fmt12(qt.to)} on ${qDays.length === 5 && !qt.days.Sat && !qt.days.Sun ? 'weekdays' : qDays.join(', ')}` : 'No quiet hours'} onClick={() => openModal(<ReadingWindowsSheet close={closeModal} value={qt} onSave={v => update({ quiet: v })} />)} />
        <PrefRow icon="user" title="Account" sub={account.email || 'Name and email, kept on this phone'} onClick={() => editAccount()} />
        <PrefRow icon="upload" title="Export data" sub="Save your reading history as a file" onClick={() => openModal(<ExportSheet close={closeModal} ctx={ctx} account={account} />)} last />
      </div>

      <SectionHead title="Storage" />
      <div style={{ borderRadius: 'var(--card-radius)', background: 'var(--surface)', border: '1px solid var(--line)', overflow: 'hidden' }}>
        <PrefRow icon="library" title="Books folder" sub={rescanned ? 'Checked for new PDFs' : Platform.folderLabel()} onClick={() => { Platform.rescan(); Lib.sync(); setRescanned(true); setTimeout(() => setRescanned(false), 2000); }} last />
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-3)', marginTop: 10, lineHeight: 1.45, padding: '0 4px' }}>
        Everything stays on this phone. Volapace has no account, no sync and no internet access.
      </div>
    </div>
  );
}

function PrefRow({ icon, title, sub, onClick, last }) {
  return (
    <button onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', background: 'none', border: 'none', borderBottom: last ? 'none' : '1px solid var(--line)', cursor: 'pointer', textAlign: 'left' }}>
      <div style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--fill)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 15, color: 'var(--ink)' }}>{title}</div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-2)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
      </div>
      <Icon name="chevronRight" size={18} style={{ color: 'var(--ink-3)' }} />
    </button>
  );
}

// ════════════════════════════════════════════════════════════
// MODALS & SHEETS
// ════════════════════════════════════════════════════════════
function SheetHeader({ icon, title, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 20 }}>
      <div style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--fill)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={23} />
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 21, color: 'var(--ink)' }}>{title}</div>
        {sub && <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-2)', marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

function TimeField({ value, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, height: 50, padding: '0 14px', borderRadius: 14, background: 'var(--fill)', border: '1px solid var(--line)', cursor: 'pointer' }}>
      <Icon name="clock" size={19} style={{ color: 'var(--ink-2)' }} />
      <input type="time" value={value} onChange={e => e.target.value && onChange(e.target.value)}
        style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 15.5, color: 'var(--ink)', colorScheme: 'light dark' }} />
    </label>
  );
}

function NotificationSheet({ close, value = DEFAULT_NOTIFY, onSave }) {
  const [on, setOn] = React.useState(value.on);
  const [time, setTime] = React.useState(value.time);
  const [nudge, setNudge] = React.useState(value.rescue);
  const blocked = on && !Platform.notificationsAllowed();
  return (
    <BottomSheet>
      <SheetHeader icon="bell" title="Notification tuning" sub="When Volapace should nudge you" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SheetToggleRow title="Daily reminder" sub="One nudge a day, unless you already read" on={on} onChange={setOn} />
        {on && <TimeField value={time} onChange={setTime} />}
        <SheetToggleRow title="Streak rescue" sub="Extra alert at 9 PM if your streak is about to break" on={nudge} onChange={setNudge} />
        {blocked && <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.4 }}>Android will ask to allow notifications when you tap Done.</div>}
      </div>
      <div style={{ marginTop: 22 }}><Button full onClick={() => { onSave && onSave({ on, time, rescue: nudge }); close(); }}>Done</Button></div>
    </BottomSheet>
  );
}

function ReadingWindowsSheet({ close, value = DEFAULT_QUIET, onSave }) {
  const [on, setOn] = React.useState(value.on);
  const [from, setFrom] = React.useState(value.from);
  const [to, setTo] = React.useState(value.to);
  const [days, setDays] = React.useState(value.days);
  const mins = (hm) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
  const a = mins(from) / 1440 * 100, b = mins(to) / 1440 * 100;
  return (
    <BottomSheet>
      <SheetHeader icon="calendar" title="Reading windows" sub="Hours to keep quiet so nudges never interrupt" />
      <div style={{ marginBottom: 12 }}><SheetToggleRow title="Quiet hours" sub="Reminders that fall inside wait until after" on={on} onChange={setOn} /></div>
      {on && <>
        <div style={{ padding: '16px 16px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--line)', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>Quiet hours</span>
            <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 18, color: 'var(--sage-deep)' }}>{fmt12(from)} &ndash; {fmt12(to)}</span>
          </div>
          <div style={{ position: 'relative', height: 30, display: 'flex', alignItems: 'center', marginTop: 12 }}>
            <div style={{ position: 'absolute', left: 0, right: 0, height: 8, borderRadius: 999, background: 'var(--track-off)' }} />
            {b > a ? <div style={{ position: 'absolute', left: `${a}%`, width: `${b - a}%`, height: 8, borderRadius: 999, background: 'var(--sage)' }} />
              : <><div style={{ position: 'absolute', left: 0, width: `${b}%`, height: 8, borderRadius: 999, background: 'var(--sage)' }} /><div style={{ position: 'absolute', left: `${a}%`, right: 0, height: 8, borderRadius: 999, background: 'var(--sage)' }} /></>}
            {[a, b].map((p, i) => <div key={i} style={{ position: 'absolute', left: `${p}%`, width: 22, height: 22, borderRadius: 999, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,.25), 0 0 0 2.5px var(--sage)', transform: 'translateX(-50%)' }} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            <TimeField value={from} onChange={setFrom} />
            <TimeField value={to} onChange={setTo} />
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13, color: 'var(--ink-2)', marginBottom: 10 }}>Active days</div>
        <div style={{ display: 'flex', gap: 7, marginBottom: 6 }}>
          {Object.keys(days).map(d => {
            const sel = days[d];
            return (
              <button key={d} onClick={() => setDays(s => ({ ...s, [d]: !s[d] }))} style={{
                flex: 1, height: 44, cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 12.5,
                border: `1px solid ${sel ? 'var(--ink)' : 'var(--line)'}`, borderRadius: 999,
                background: sel ? 'var(--ink)' : 'var(--fill)', color: sel ? 'var(--cream)' : 'var(--ink-3)',
              }}>{d[0]}</button>
            );
          })}
        </div>
      </>}
      <div style={{ marginTop: 22 }}><Button full onClick={() => { onSave && onSave({ on, from, to, days }); close(); }}>Save windows</Button></div>
    </BottomSheet>
  );
}

function AccountSheet({ close, account, onSave }) {
  const [name, setName] = React.useState(account.name || '');
  const [email, setEmail] = React.useState(account.email || '');
  const [since, setSince] = React.useState(account.since || '');
  const validEmail = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const ok = validEmail;
  const field = (label, value, set, props = {}) => (
    <label style={{ display: 'block', padding: '10px 14px', borderRadius: 14, background: 'var(--fill)', border: '1px solid var(--line)' }}>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-2)' }}>{label}</div>
      <input value={value} onChange={e => set(e.target.value)} {...props}
        style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', padding: '3px 0 0', fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 16, color: 'var(--ink)' }} />
    </label>
  );
  return (
    <BottomSheet>
      <SheetHeader icon="user" title="Account details" sub="Kept on this phone only" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {field('Display name', name, setName, { autoComplete: 'name', placeholder: 'Your name' })}
        {field('Email (optional)', email, setEmail, { type: 'email', autoComplete: 'email', placeholder: 'you@example.com' })}
        {!validEmail && <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--sage)', marginTop: -4, paddingLeft: 4 }}>Enter a valid email address</div>}
        {field('Reading since', since, setSince, { placeholder: 'e.g. March 2026' })}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <Button variant="soft" style={{ flex: 1 }} onClick={close}>Cancel</Button>
        <Button style={{ flex: 2 }} disabled={!ok} onClick={() => { onSave({ name: name.trim(), email: email.trim(), since: since.trim() }); close(); }}>Save changes</Button>
      </div>
    </BottomSheet>
  );
}

function buildExport(ctx, account, inc) {
  const data = { exportedAt: new Date().toISOString(), app: 'Volapace' };
  const books = Lib.list().map(e => ({ e, b: entryBook(e, ctx), s: e.id === ctx.bookId ? ctx : (e.snap || {}) }));
  if (inc.account) data.account = account;
  if (inc.books) data.books = books.map(({ e, b, s }) => ({
    title: b.title, author: b.author, type: e.paper ? 'paper' : 'pdf', file: e.file || '', status: STATUS_META[b.status].label.toLowerCase(),
    pages: b.pages, currentPage: s.page || 1, percent: b.planPct, planDays: s.days || '', daysDone: s.doneDays || 0, pagesPerDay: s.ppd || '', skippedPages: s.skip || [],
  }));
  if (inc.books) data.history = Object.keys(ctx.log || {}).sort().map(d => ({ date: d, minutes: Math.round((ctx.log[d].s || 0) / 60), pages: ctx.log[d].p || 0, sessions: ctx.log[d].n || 0 }));
  if (inc.streak) { const set = doneSet(ctx); data.streak = { current: streakCount(set), longest: longestStreak(set), goalDays: [...set].sort() }; }
  if (inc.bookmarks) data.bookmarks = books.flatMap(({ b, s }) => (s.bookmarks || []).map(p => ({ book: b.title, page: p })));
  if (inc.highlights) data.highlights = books.flatMap(({ b, s }) => (s.highlights || []).map(h => ({ book: b.title, page: h.page, color: h.color, text: h.text, note: h.note || '' })));
  return data;
}
function toCSV(data) {
  const esc = (v) => { const s = Array.isArray(v) ? v.join(' ') : v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const table = (name, rows) => { if (!rows || !rows.length) return ''; const cols = [...new Set(rows.flatMap(r => Object.keys(r)))]; return `# ${name}\n${cols.join(',')}\n${rows.map(r => cols.map(c => esc(r[c])).join(',')).join('\n')}\n\n`; };
  let out = '';
  if (data.account) out += table('account', [data.account]);
  if (data.books) out += table('books', data.books);
  if (data.history) out += table('reading_days', data.history);
  if (data.streak) out += table('goal_days', data.streak.goalDays.map(d => ({ date: d, goal_met: 'yes' })));
  if (data.bookmarks) out += table('bookmarks', data.bookmarks);
  if (data.highlights) out += table('highlights', data.highlights);
  return out || '# nothing to export yet\n';
}

function ExportSheet({ close, ctx, account }) {
  const [fmt, setFmt] = React.useState('csv');
  const [inc, setInc] = React.useState({ books: true, streak: true, bookmarks: true, highlights: true, account: false });
  const [done, setDone] = React.useState(false);
  const opts = [['books', 'Books & progress', 'Titles, pages, daily reading'], ['streak', 'Streak history', 'Every day you met your goal'], ['bookmarks', 'Bookmarks', 'Saved pages'], ['highlights', 'Highlights & notes', 'Passages and your thoughts'], ['account', 'Account details', 'Name and email']];
  const any = Object.values(inc).some(Boolean);
  const run = async () => {
    const data = buildExport(ctx, account, inc);
    const body = fmt === 'json' ? JSON.stringify(data, null, 2) : toCSV(data);
    const ok = await Platform.saveFile(`volapace-export-${dayISO(TODAY)}.${fmt}`, fmt === 'json' ? 'application/json' : 'text/csv', textToB64(body));
    if (ok) { setDone(true); setTimeout(close, 900); }
  };
  return (
    <BottomSheet>
      <SheetHeader icon="upload" title="Export data" sub="A copy of your reading history" />
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-2)', marginBottom: 8 }}>Format</div>
      <div style={{ display: 'flex', padding: 3, borderRadius: 999, background: 'var(--fill)', marginBottom: 16 }}>
        {[['csv', 'CSV · spreadsheets'], ['json', 'JSON · developers']].map(([k, l]) => (
          <button key={k} onClick={() => setFmt(k)} style={{ flex: 1, height: 36, borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: fmt === k ? 600 : 500, fontSize: 13.5, background: fmt === k ? 'var(--ink)' : 'transparent', color: fmt === k ? 'var(--cream)' : 'var(--ink-2)' }}>{l}</button>
        ))}
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-2)', marginBottom: 8 }}>Include</div>
      <div style={{ borderRadius: 16, border: '1px solid var(--line)', overflow: 'hidden' }}>
        {opts.map(([k, t, sub], i) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: i < opts.length - 1 ? '1px solid var(--line)' : 'none' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 15, color: 'var(--ink)' }}>{t}</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-2)', marginTop: 1 }}>{sub}</div>
            </div>
            <Toggle on={inc[k]} onChange={v => setInc(s => ({ ...s, [k]: v }))} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <Button variant="soft" style={{ flex: 1 }} onClick={close}>Cancel</Button>
        <Button icon={done ? 'check' : 'upload'} style={{ flex: 2 }} disabled={!any} onClick={run}>{done ? 'Saved' : `Export ${fmt.toUpperCase()}`}</Button>
      </div>
    </BottomSheet>
  );
}

function YearGoalSheet({ close, value, done = 0, onSave }) {
  const [v, setV] = React.useState(value);
  return (
    <BottomSheet>
      <SheetHeader icon="target" title="Yearly goal" sub={`How many books in ${TODAY.getFullYear()}?`} />
      <NumField value={v} onChange={setV} min={1} max={200} suffix={v === 1 ? 'book' : 'books'} />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {[6, 12, 24, 52].map(n => <Chip key={n} on={v === n} onClick={() => setV(n)} style={{ flex: 1 }}>{n}</Chip>)}
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-2)', marginTop: 14, lineHeight: 1.4 }}>
        That&rsquo;s about one book every {Math.max(1, Math.round(365 / v))} days. You&rsquo;ve finished {done} so far.
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <Button variant="soft" style={{ flex: 1 }} onClick={close}>Cancel</Button>
        <Button style={{ flex: 2 }} onClick={() => { onSave(v); close(); }}>Save goal</Button>
      </div>
    </BottomSheet>
  );
}

function SheetToggleRow({ title, sub, on, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', borderRadius: 14, background: 'var(--fill)', border: '1px solid var(--line)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{title}</div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-2)', marginTop: 1 }}>{sub}</div>
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

Object.assign(window, {
  LibraryScreen, YouScreen, BottomSheet, VirtualRows, notifyOf, quietOf,
  ExportSheet, YearGoalSheet, NotificationSheet, ReadingWindowsSheet, AccountSheet,
});
