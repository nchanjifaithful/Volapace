// app.jsx — Volapace shell: onboarding + 4-tab app, theming, modals, persistence, Android integration

const ACCENT = '#D90429';
const ONBOARD = ['upload', 'scan', 'pace'];
const TABS = ['today', 'progress', 'library', 'you'];
const PUSHED = ['book', 'reader', 'streak'];
const VALID = [...ONBOARD, ...TABS, ...PUSHED];

const readJSON = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } };
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

function App() {
  const [ctx, setCtx] = React.useState(() => readJSON('vp_ctx', {}));
  const [screen, setScreen] = React.useState(() => {
    const s = localStorage.getItem('vp_screen');
    const c = readJSON('vp_ctx', {});
    if (s === 'reader' && !c.hasPdf) return 'today';
    if (VALID.includes(s) && s !== 'scan' && s !== 'pace') return s;
    return Lib.list().length || c.days ? 'today' : 'upload';
  });
  const [themeMode, setThemeMode] = React.useState(() => localStorage.getItem('vp_theme') || 'system');
  const [account, setAccountRaw] = React.useState(() => ({ name: '', email: '', since: '', ...readJSON('vp_account', {}) }));
  const [anim, setAnim] = React.useState('in');
  const [modal, setModal] = React.useState(null);
  const prevRef = React.useRef('today'); // where a pushed screen was opened from
  const confettiRef = React.useRef(null);
  const scrollRef = React.useRef(null);
  const ctxRef = React.useRef(ctx); ctxRef.current = ctx;

  React.useEffect(() => { try { localStorage.setItem('vp_screen', screen); } catch (e) {} }, [screen]);
  React.useEffect(() => { writeJSON('vp_ctx', ctx); }, [ctx]);
  React.useEffect(() => { try { localStorage.setItem('vp_theme', themeMode); } catch (e) {} }, [themeMode]);
  const setAccount = (a) => { setAccountRaw(a); writeJSON('vp_account', a); };

  // first launch: "Reading since" is the month the app was first opened
  React.useEffect(() => { if (!account.since && !localStorage.getItem('vp_since_set')) { localStorage.setItem('vp_since_set', '1'); setAccount({ ...account, since: TODAY.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) }); } }, []);

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
    if (PUSHED.includes(next) || next === 'upload') prevRef.current = TABS.includes(screen) || screen === 'book' ? screen : prevRef.current || 'today';
    navigate(next, data);
  };
  const hasAnything = () => Lib.list().length > 0 || !!ctxRef.current.days;
  const back = () => {
    if (screen === 'pace') navigate(ctx.fromScan ? 'scan' : 'upload');
    else if (screen === 'scan') navigate('upload');
    else if (screen === 'upload') navigate(TABS.includes(prevRef.current) ? prevRef.current : 'today');
  };
  const bookBack = () => navigate(screen === 'book' ? (TABS.includes(prevRef.current) ? prevRef.current : 'today') : (prevRef.current || 'today'));
  const update = (data) => setCtx(c => applyHistory(c, data));

  // keep each book's progress snapshot in the library
  React.useEffect(() => {
    const e = ctx.bookId ? Lib.get(ctx.bookId) : null;
    if (e && (!ctx.pages || !e.pages || ctx.pages === e.pages)) Lib.upsert({ id: ctx.bookId, snap: pickBook(ctx), lastOpened: Date.now(), ...(ctx.finishedAt ? { finishedAt: ctx.finishedAt } : {}) });
  }, [ctx]);

  // pick up a better title / author found in the PDF's metadata
  React.useEffect(() => { const fix = () => {
    const c = ctxRef.current; const e = c.bookId && Lib.get(c.bookId);
    if (e && e.metaTitle && (e.title !== c.title || (e.author || '') !== (c.author || ''))) setCtx(x => x.bookId === e.id ? { ...x, title: e.title, author: e.author || '' } : x);
  }; fix(); return Lib.subscribe(fix); }, [ctx.bookId]);
  const startBook = (data) => { setCtx(c => ({ ...clearBook(c), ...data })); navigate('pace'); };
  const openBook = (entry) => {
    const c = ctxRef.current;
    if (entry.id === c.bookId) { go(c.days ? 'book' : 'pace'); return; }
    const snap = entry.snap && entry.snap.days ? entry.snap : null;
    const base = snap || { pages: entry.pages, title: entry.title, author: entry.author || '', page: 1, doneDays: 0 };
    setCtx(x => ({ ...clearBook(x), ...base, title: entry.title, author: entry.author || '', hasPdf: !entry.paper, bookId: entry.id }));
    if (!entry.paper) PdfStore.openId(entry.id).catch(() => {});
    if (snap) { prevRef.current = TABS.includes(screen) ? screen : 'library'; navigate('book'); } else navigate('pace');
  };
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
    const n = notifyOf(ctx), q = quietOf(ctx), plan = planOf(ctx);
    const hasPlan = !!(ctx.bookId && ctx.days && !ctx.finishedAt);
    const text = hasPlan ? (plan.goalType === 'time' ? `Read ${plan.minutes} minutes of ${plan.title} today.` : `Read pages ${plan.from}–${plan.to} of ${plan.title} today.`) : 'A few pages a day adds up. Pick up where you left off.';
    const done = [...doneSet(ctx)].sort();
    Platform.setReminder({ on: !!n.on && (hasPlan || Lib.list().length > 0), time: n.time, rescue: !!n.rescue && streakCount(doneSet(ctx)) > 0, text,
      lastDone: done[done.length - 1] || '', quiet: q.on ? { from: q.from, to: q.to, days: Object.keys(q.days).filter(d => q.days[d]) } : null });
  }, [ctx.notify, ctx.quiet, ctx.doneDates, ctx.bookId, ctx.days, ctx.doneDays, ctx.finishedAt]);

  // ── Android back button ──
  window.__vpBack = () => {
    if (modal) { setModal(null); return true; }
    if (PUSHED.includes(screen)) { bookBack(); return true; }
    if (screen === 'pace' || screen === 'scan') { back(); return true; }
    if (screen === 'upload' && hasAnything()) { back(); return true; }
    if (TABS.includes(screen) && screen !== 'today') { navigate('today'); return true; }
    return false;
  };

  const renderScreen = () => {
    switch (screen) {
      case 'upload':   return <UploadScreen go={go} startBook={startBook} openBook={openBook} onClose={hasAnything() ? back : null} />;
      case 'scan':     return <ScanScreen go={go} back={back} ctx={ctx} startBook={startBook} />;
      case 'pace':     return <PaceScreen go={go} back={back} ctx={ctx} openModal={openModal} closeModal={closeModal} />;
      case 'today':    return <TodayScreen go={go} hostRef={confettiRef} ctx={ctx} update={update} account={account} openBook={openBook} />;
      case 'progress': return <ProgressScreen ctx={ctx} go={go} update={update} openModal={openModal} closeModal={closeModal} />;
      case 'streak':   return <StreakScreen ctx={ctx} onBack={bookBack} />;
      case 'library':  return <LibraryScreen go={go} ctx={ctx} openBook={openBook} forget={forget} />;
      case 'you':      return <YouScreen theme={themeMode} setTheme={setThemeMode} openModal={openModal} closeModal={closeModal} account={account} setAccount={setAccount} ctx={ctx} update={update} />;
      case 'book':     return ctx.days ? <PlanScreen key={(ctx.bookId || 's') + ':' + (ctx.planVer || 0)} openModal={openModal} closeModal={closeModal} ctx={ctx} update={update} go={go} restart={restart} hostRef={confettiRef} onBack={bookBack} /> : <TodayScreen go={go} hostRef={confettiRef} ctx={ctx} update={update} account={account} openBook={openBook} />;
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
        <div style={{ position: 'relative', minHeight: '100%', height: screen === 'reader' ? '100%' : 'auto', background: 'var(--cream)' }}>
          <div key={screen} style={{ height: screen === 'reader' ? '100%' : 'auto', minHeight: '100%', animation: anim === 'in' ? 'screenIn .32s cubic-bezier(.2,.8,.2,1)' : 'screenOut .16s ease-in forwards' }}>
            {renderScreen()}
          </div>
        </div>
      </PhoneShell>
      {/* confetti overlay */}
      <div ref={confettiRef} style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 80 }} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
