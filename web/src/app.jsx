// app.jsx — Volapace shell: onboarding + 4-tab app, theming, modals, persistence, Android integration

const ACCENT = '#D90429';
const ONBOARD = ['intro', 'hello', 'upload', 'scan', 'pace', 'reminders', 'summary', 'welcome'];
const TABS = ['today', 'progress', 'library', 'notes', 'you'];
const PUSHED = ['book', 'reader', 'streak'];
const VALID = [...ONBOARD, ...TABS, ...PUSHED];
const FULL = ['reader', 'intro', 'welcome', 'streak']; // screens that fill the viewport exactly

const readJSON = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

function App() {
  const [ctx, setCtx] = React.useState(() => readJSON('vp_ctx', {}));
  const [screen, setScreen] = React.useState(() => {
    const s = localStorage.getItem('vp_screen');
    const c = readJSON('vp_ctx', {});
    if (!localStorage.getItem('vp_intro')) return 'intro';
    if (s === 'reader' && !c.hasPdf) return 'today';
    if (VALID.includes(s) && !['scan', 'pace', 'summary', 'welcome', 'intro', 'hello'].includes(s) && !(s === 'reminders' && c.planDraft)) return s;
    return Lib.list().length || c.days ? 'today' : 'upload';
  });
  const [themeMode, setThemeMode] = React.useState(() => localStorage.getItem('vp_theme') || 'system');
  const [account, setAccountRaw] = React.useState(() => ({ name: '', email: '', since: '', ...readJSON('vp_account', {}) }));
  const [anim, setAnim] = React.useState('in');
  const [modal, setModal] = React.useState(null);
  const [splash, setSplash] = React.useState(true);
  const prevRef = React.useRef('today'); // where a pushed screen was opened from
  const paceFrom = React.useRef('upload'); // where Back on "Choose your pace" goes
  const confettiRef = React.useRef(null);
  const scrollRef = React.useRef(null);
  const ctxRef = React.useRef(ctx); ctxRef.current = ctx;

  React.useEffect(() => { try { localStorage.setItem('vp_screen', screen); } catch (e) {} }, [screen]);
  React.useEffect(() => { writeJSON('vp_ctx', ctx); }, [ctx]);
  React.useEffect(() => { try { localStorage.setItem('vp_theme', themeMode); } catch (e) {} }, [themeMode]);
  const setAccount = (a) => { setAccountRaw(a); writeJSON('vp_account', a); };

  // first launch: "Reading since" is the month the app was first opened
  React.useEffect(() => { if (!account.since && !localStorage.getItem('vp_since_set')) { localStorage.setItem('vp_since_set', '1'); setAccount({ ...account, since: dayISO(TODAY) }); } }, []);

  // ── theme ──
  const [sysDark, setSysDark] = React.useState(() => window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  React.useEffect(() => {
    if (!window.matchMedia) return;
    const mq = matchMedia('(prefers-color-scheme: dark)'); const on = (e) => setSysDark(e.matches);
    mq.addEventListener('change', on); return () => mq.removeEventListener('change', on);
  }, []);
  const effTheme = themeMode === 'system' ? (sysDark ? 'dark' : 'light') : themeMode;
  const isDark = effTheme === 'dark';
  React.useEffect(() => { Platform.setTheme(isDark); document.body.style.background = isDark ? '#000' : '#fff'; }, [isDark]);

  // ── navigation ──
  const navigate = (next, data) => {
    if (data) setCtx(c => applyHistory(c, data));
    setModal(null);
    setAnim('out');
    setTimeout(() => { setScreen(next); setAnim('in'); if (scrollRef.current) scrollRef.current.scrollTop = 0; }, 160);
  };
  const go = (next, data) => {
    if (next === 'reader' && !(data ? { ...ctxRef.current, ...data } : ctxRef.current).hasPdf) next = 'book';
    if (PUSHED.includes(next) || next === 'upload' || (next === 'reminders' && !ctxRef.current.planDraft && !(data && data.planDraft))) prevRef.current = TABS.includes(screen) || screen === 'book' ? screen : prevRef.current || 'today';
    navigate(next, data);
  };
  const hasAnything = () => Lib.list().length > 0 || !!ctxRef.current.days;
  const back = () => {
    if (screen === 'pace') navigate(paceFrom.current || 'today');
    else if (screen === 'scan') navigate('upload');
    else if (screen === 'upload') navigate(TABS.includes(prevRef.current) ? prevRef.current : 'today');
    else if (screen === 'reminders') navigate(ctx.planDraft ? 'pace' : (TABS.includes(prevRef.current) || prevRef.current === 'book' ? prevRef.current : 'you'));
    else if (screen === 'summary') navigate('reminders');
  };
  const bookBack = () => navigate(screen === 'book' ? (TABS.includes(prevRef.current) ? prevRef.current : 'today') : (prevRef.current || 'today'));
  const update = (data) => setCtx(c => applyHistory(c, data));

  // keep each book's progress snapshot in the library (batched, so reading and scrolling stay smooth)
  const snapT = React.useRef(null);
  const flushSnap = () => {
    clearTimeout(snapT.current); snapT.current = null;
    const c = ctxRef.current; const e = c.bookId ? Lib.get(c.bookId) : null;
    if (e && (!c.pages || !e.pages || c.pages === e.pages)) Lib.upsert({ id: c.bookId, snap: pickBook(c), lastOpened: Date.now(), ...(c.finishedAt ? { finishedAt: c.finishedAt } : {}) });
  };
  React.useEffect(() => { clearTimeout(snapT.current); snapT.current = setTimeout(flushSnap, 500); }, [ctx]);
  React.useEffect(() => { const f = () => { if (document.visibilityState === 'hidden') flushSnap(); }; document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f); }, []);

  // pick up a better title / author found in the PDF's metadata
  React.useEffect(() => { const fix = () => {
    const c = ctxRef.current; const e = c.bookId && Lib.get(c.bookId);
    if (e && e.metaTitle && (e.title !== c.title || (e.author || '') !== (c.author || ''))) setCtx(x => x.bookId === e.id ? { ...x, title: e.title, author: e.author || '' } : x);
  }; fix(); return Lib.subscribe(fix); }, [ctx.bookId]);
  const startBook = (data) => { flushSnap(); paceFrom.current = data.fromScan ? 'scan' : 'upload'; setCtx(c => ({ ...clearBook(c), ...data })); navigate('pace'); };
  // Make a book the open one. Every book keeps its own pages, plan and notes (its snapshot);
  // only the streak, settings and history are shared.
  const selectBook = (entry, extra = {}) => {
    const c = ctxRef.current;
    if (entry.id === c.bookId) { if (Object.keys(extra).length) setCtx(x => ({ ...x, ...extra })); return; }
    flushSnap();
    const snap = { ...(entry.snap || {}) };
    if (snap.planDraft) { delete snap.days; delete snap.planDraft; delete snap.planDays; } // an unfinished setup isn't a plan
    const base = { pages: entry.pages || snap.pages, page: 1, doneDays: 0, ...snap };
    setCtx(x => ({ ...clearBook(x), ...base, title: entry.title, author: entry.author || '', hasPdf: !entry.paper, bookId: entry.id, ...extra }));
    if (!entry.paper) PdfStore.openId(entry.id).catch(() => {});
  };
  // openBook(entry)            -> the book's page (its plan, or reading without one)
  // openBook(entry, page)      -> the reader at that page
  // openBook(entry, 0, 'reader' | 'pace')
  const openBook = (entry, atPage, to) => {
    selectBook(entry, atPage ? { page: atPage } : {});
    const target = to || (atPage ? 'reader' : 'book');
    const from = TABS.includes(screen) || screen === 'book' ? screen : 'library';
    if (target === 'pace') { paceFrom.current = from; navigate('pace'); return; }
    prevRef.current = from === 'book' && target === 'book' ? 'today' : from;
    navigate(target === 'reader' && entry.paper ? 'book' : target);
  };
  const planBook = () => { paceFrom.current = screen === 'book' ? 'book' : TABS.includes(screen) ? screen : 'today'; navigate('pace'); };
  const forget = () => setCtx(c => clearBook(c)); // current book was removed
  const jump = (s) => navigate(s);
  const restart = () => { setCtx(c => clearBook(c)); navigate('upload'); };

  const openModal = (node) => setModal(node);
  const closeModal = () => setModal(null);

  // ── library: folder index, Android "Open with", resume, day change ──
  React.useEffect(() => {
    Lib.heal();
    const take = async () => {
      const inc = Platform.takeIncoming();
      if (!inc) return;
      await Lib.sync();
      const e = Lib.get(inc.id);
      if (e) openBook(e);
    };
    Lib.sync().then(take);
    if (ctxRef.current.hasPdf && ctxRef.current.bookId) PdfStore.openId(ctxRef.current.bookId).catch(() => {});
    const un1 = Platform.onLibrary(() => Lib.sync());
    const un2 = Platform.onResume(() => {
      if (dayISO(new Date()) !== dayISO(TODAY)) { location.reload(); return; }
      Lib.sync().then(take);
    });
    return () => { un1(); un2(); };
  }, []);

  // ── reminders (local notifications, scheduled by the Android shell) ──
  React.useEffect(() => {
    const n = notifyOf(ctx), q = quietOf(ctx);
    const active = activeBooks(ctx);
    const first = active[0];
    const text = !first ? 'A few pages a day adds up. Pick up where you left off.'
      : (first.plan.goalType === 'time' ? `Read ${first.plan.minutes} minutes of ${first.plan.title}` : `Read pages ${first.plan.from}–${first.plan.to} of ${first.plan.title}`) + (active.length > 1 ? `, plus ${active.length - 1} more book${active.length > 2 ? 's' : ''}.` : ' today.');
    const done = [...doneSet(ctx)].sort();
    Platform.setReminder({ on: !!n.on && (active.length > 0 || Lib.list().length > 0), time: n.time, rescueTime: n.rescueTime, rescue: !!n.rescue && streakCount(doneSet(ctx)) > 0, text,
      lastDone: done[done.length - 1] || '', quiet: q.on ? { from: q.from, to: q.to, days: Object.keys(q.days).filter(d => q.days[d]) } : null });
    Platform.setWidget({ days: done.slice(-400), book: first ? first.plan.title : '' });
  }, [ctx.notify, ctx.quiet, ctx.doneDates, ctx.bookId, ctx.days, ctx.doneDays, ctx.finishedAt]);

  // ── Android back button ──
  window.__vpBack = () => {
    if (modal) { setModal(null); return true; }
    if (PUSHED.includes(screen)) { bookBack(); return true; }
    if (['pace', 'scan', 'reminders', 'summary'].includes(screen)) { back(); return true; }
    if (screen === 'welcome') { navigate('today'); return true; }
    if (screen === 'hello') { navigate('intro'); return true; }
    if (screen === 'upload' && hasAnything()) { back(); return true; }
    if (TABS.includes(screen) && screen !== 'today') { navigate('today'); return true; }
    return false;
  };

  const renderScreen = () => {
    switch (screen) {
      case 'intro':    return <IntroScreen onDone={() => navigate('hello')} />;
      case 'hello':    return <HelloScreen account={account} onBack={() => navigate('intro')} onDone={(a) => { setAccount({ ...account, ...a }); try { localStorage.setItem('vp_intro', '1'); } catch (e) {} navigate(hasAnything() ? 'today' : 'upload'); }} />;
      case 'reminders': return <RemindersScreen ctx={ctx} update={update} go={go} back={back} onboarding={!!ctx.planDraft} />;
      case 'summary':  return <SummaryScreen ctx={ctx} update={update} go={go} back={back} />;
      case 'welcome':  return <WelcomeScreen ctx={ctx} go={(s) => { prevRef.current = 'today'; navigate(s); }} hostRef={confettiRef} />;
      case 'upload':   return <UploadScreen go={go} startBook={startBook} openBook={openBook} onClose={hasAnything() ? back : null} />;
      case 'scan':     return <ScanScreen go={go} back={back} ctx={ctx} startBook={startBook} />;
      case 'pace':     return <PaceScreen go={go} back={back} ctx={ctx} update={update} openModal={openModal} closeModal={closeModal} account={account} />;
      case 'today':    return <TodayScreen go={go} hostRef={confettiRef} ctx={ctx} update={update} account={account} openBook={openBook} />;

      case 'progress': return <ProgressScreen ctx={ctx} go={go} update={update} openModal={openModal} closeModal={closeModal} />;
      case 'streak':   return <StreakScreen ctx={ctx} onBack={bookBack} />;
      case 'library':  return <LibraryScreen go={go} ctx={ctx} openBook={openBook} forget={forget} openModal={openModal} closeModal={closeModal} />;
      case 'notes':    return <NotesScreen ctx={ctx} openBook={openBook} />;
      case 'you':      return <YouScreen go={go} theme={themeMode} setTheme={setThemeMode} openModal={openModal} closeModal={closeModal} account={account} setAccount={setAccount} ctx={ctx} update={update} />;
      case 'book':     return <PlanScreen key={(ctx.bookId || 's') + ':' + (ctx.planVer || 0)} openModal={openModal} closeModal={closeModal} ctx={ctx} update={update} go={go} restart={restart} hostRef={confettiRef} onBack={bookBack} planBook={planBook} onRemoved={() => { forget(); navigate(TABS.includes(prevRef.current) ? prevRef.current : 'library'); }} />;
      case 'reader':   return <ReaderScreen key={ctx.bookId || 'r'} ctx={ctx} update={update} hostRef={confettiRef} onBack={bookBack} />;
      default:         return null;
    }
  };

  const showTabs = TABS.includes(screen);
  const overlayNode = modal ? (
    <>
      <div onClick={closeModal} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.36)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)', animation: 'veilIn .2s ease' }} />
      {modal}
    </>
  ) : null;

  return (
    <div className="vp-root" data-theme={effTheme} style={{ position: 'fixed', inset: 0, '--sage': ACCENT, '--card-radius': '20px', '--font-serif': '"Geist", system-ui, sans-serif', fontFamily: 'var(--font-ui)' }}>
      <PhoneShell bg="var(--cream)" scrollRef={scrollRef}
        tabBar={showTabs ? <TabBar active={screen} onNav={jump} /> : null}
        overlay={overlayNode}>
        <div style={{ position: 'relative', minHeight: '100%', height: FULL.includes(screen) ? '100%' : 'auto', background: 'var(--cream)' }}>
          <div key={screen} style={{ height: FULL.includes(screen) ? '100%' : 'auto', minHeight: '100%', animation: anim === 'in' ? 'screenIn .32s cubic-bezier(.2,.8,.2,1)' : 'screenOut .16s ease-in forwards' }}>
            {renderScreen()}
          </div>
        </div>
      </PhoneShell>
      {/* add a book: floating action button on Today and Library */}
      {(screen === 'today' || screen === 'library') && !modal && (
        <button onClick={() => go('upload')} aria-label="Add a book" style={{ position: 'fixed', right: 20, bottom: 'calc(var(--sab) + 86px)', zIndex: 50, width: 58, height: 58, borderRadius: 999, border: 'none', cursor: 'pointer', background: 'var(--ink)', color: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pop .3s cubic-bezier(.2,1.3,.4,1)' }}>
          <Icon name="plus" size={26} stroke={2.2} />
        </button>
      )}
      {splash && <AppSplash onDone={() => setSplash(false)} />}
      {/* confetti overlay */}
      <div ref={confettiRef} style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 80 }} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
