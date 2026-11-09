// screens3.jsx — The Plan (daily timeline, recalculator, confetti)

// Chapter labels come from the PDF's own outline (PdfStore.chapters). Paper books and PDFs without one show none.
function chaptersFor(start, end, chs) {
  if (!chs || !chs.length) return '';
  const idx = (p) => { let k = -1; chs.forEach((c, i) => { if (c.page <= p) k = i; }); return k; };
  const a = idx(start), b = idx(end);
  if (b < 0) return '';
  const name = (i) => (chs[i].title || `Chapter ${i + 1}`).trim();
  return a === b || a < 0 ? name(b) : `${name(Math.max(0, a))} – ${name(b)}`;
}
const withCh = (s, ch) => ch ? `${s} · ${ch}` : s;

function PlanScreen({ ctx, update, go, restart, hostRef, onBack, openModal, closeModal, planBook, onRemoved }) {
  const chs = useChapters();
  React.useEffect(() => { if (ctx.hasPdf && ctx.bookId && PdfStore.id !== ctx.bookId) PdfStore.openId(ctx.bookId).catch(() => {}); }, [ctx.bookId]);
  const [menu, setMenu] = React.useState(false);
  const entry = (ctx.bookId && Lib.get(ctx.bookId)) || { id: ctx.bookId, title: ctx.title, paper: !ctx.hasPdf };
  const planned = hasPlan(ctx);
  const sheet = (node) => { setMenu(false); openModal(node); };
  const remove = () => sheet(<RemoveBookSheet entry={entry} close={closeModal} onRemoved={() => { closeModal(); onRemoved && onRemoved(); }} />);
  const items = planned ? [
    ['edit', 'Edit plan', 'Pace, pages or time a day', () => sheet(<EditPlanSheet ctx={ctx} update={update} close={closeModal} />)],
    ['calendar', 'Change finish date', 'Move it earlier or later', () => sheet(<RecalibrateSheet ctx={ctx} update={update} close={closeModal} />)],
    ctx.paused ? ['play', 'Resume reading', 'Back on Today', () => { setMenu(false); update({ paused: false }); }]
      : ['pause', 'Pause reading', 'Off Today until you resume', () => { setMenu(false); update({ paused: true }); }],
    ['refresh', 'Reset', 'Start again, skipped pages, notes', () => sheet(<ResetSheet ctx={ctx} update={update} close={closeModal} onNewPlan={() => { closeModal(); planBook(); }} />)],
    ['trash', 'Remove from library', null, remove],
  ] : [
    ['target', 'Create a reading plan', 'A few pages a day', () => { setMenu(false); planBook(); }],
    ['trash', 'Remove from library', null, remove],
  ];
  return (
    <div style={{ minHeight: '100%', paddingBottom: 40, boxSizing: 'border-box', position: 'relative' }}>
      {onBack && <button onClick={onBack} aria-label="Back" style={{ ...floatBtn, left: 18 }}><Icon name="arrowLeft" size={21} /></button>}
      <button onClick={() => setMenu(m => !m)} aria-label="Quick actions" style={{ ...floatBtn, right: 18, background: menu ? 'var(--ink)' : floatBtn.background, color: menu ? 'var(--cream)' : 'var(--ink)' }}><Icon name="more" size={21} /></button>
      {menu && <>
        <div onClick={() => setMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 6 }} />
        <div style={{ position: 'absolute', top: 'calc(var(--sat) + 58px)', right: 18, zIndex: 7, width: 264, padding: '4px 14px', borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: 'var(--shadow-float)', animation: 'pop .18s ease-out', transformOrigin: 'top right' }}>
          {items.map(([ic, l, sub, fn], i) => (
            <button key={l} onClick={fn} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', background: 'none', border: 'none', borderBottom: i < items.length - 1 ? '1px solid var(--line)' : 'none', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ width: 34, height: 34, borderRadius: 999, background: ic === 'trash' ? 'var(--sage-soft)' : 'var(--fill)', color: ic === 'trash' ? 'var(--sage)' : 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={ic} size={17} /></div>
              <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-ui)' }}>
                <div style={{ fontWeight: 500, fontSize: 14.5, color: ic === 'trash' ? 'var(--sage)' : 'var(--ink)' }}>{l}</div>
                {sub && <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 1 }}>{sub}</div>}
              </div>
            </button>
          ))}
        </div>
      </>}
      {planned ? <PlanBody ctx={ctx} update={update} go={go} restart={restart} hostRef={hostRef} chs={chs} />
        : <NoPlanBody ctx={ctx} go={go} chs={chs} planBook={planBook} />}
    </div>
  );
}
const floatBtn = { position: 'absolute', top: 'calc(var(--sat) + 10px)', width: 40, height: 40, borderRadius: 999, background: 'var(--glass)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)', cursor: 'pointer', zIndex: 8 };

// Bookmarks of this book, right under today's reading
function PlanBookmarks({ ctx, chs, go }) {
  const [all, setAll] = React.useState(false);
  const marks = [...(ctx.bookmarks || [])].sort((a, b) => a - b);
  if (!ctx.hasPdf) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <SectionHead title="Bookmarks" action={marks.length > 4 ? (all ? 'Show less' : `All ${marks.length}`) : marks.length ? `${marks.length}` : null} onAction={() => setAll(a => !a)} />
      {marks.length === 0
        ? <div style={{ padding: '14px 16px', borderRadius: 16, background: 'var(--fill)', fontFamily: 'var(--font-ui)', fontSize: 13.5, color: 'var(--ink-2)' }}>Tap the bookmark in the reader to save a page here.</div>
        : <BookmarkList pages={all ? marks : marks.slice(0, 4)} chs={chs} highlights={ctx.highlights || []} onOpen={p => go('reader', { page: p })} />}
    </div>
  );
}

function PlanBody({ ctx, update, go, restart, hostRef, chs }) {
  const N = ctx.days || 1;
  const rest = restDaysOf(ctx);
  // everything below derives from ctx (planSchedule), so it updates as soon as you read anywhere
  const sched = planSchedule(ctx);
  const counts = sched.map(d => d.count);
  const statuses = sched.map(d => (d.status === 'today' ? 'upcoming' : d.status));
  const ranges = sched.map(d => [d.from, d.to]);
  const pd = ctx.planDays && ctx.planDays.ver === (ctx.planVer || 0) ? ctx.planDays : {};
  const skippedIdx = pd.skipped || [];
  const streak = streakCount(doneSet(ctx));
  const focus = (ctx.doneDays || 0) < N ? (ctx.doneDays || 0) : -1;
  const doneCount = statuses.filter(s => s === 'done').length;
  const allDone = focus === -1;
  const todayDone = todayIsDone(ctx);
  const plan = planOf(ctx);
  const isTime = plan.goalType === 'time';
  const readPct = Math.round(readSet(ctx).size / Math.max(1, plan.reading) * 100);
  const [microRead, setMicroRead] = React.useState(() => focus >= 0 && ctx.hasPdf ? readInRange(ctx, ranges[focus][0], ranges[focus][1]) : 0);
  React.useEffect(() => { if (focus >= 0 && ctx.hasPdf) setMicroRead(readInRange(ctx, ranges[focus][0], ranges[focus][1])); }, [ctx.readPages, focus]);
  const [banner, setBanner] = React.useState(false);
  const [expanded, setExpanded] = React.useState(null);
  const [more, setMore] = React.useState(false);
  const [view, setView] = React.useState('upcoming'); // reading outline: 'upcoming' | 'done' | 'all'
  const savePD = (patch) => update({ planDays: { ver: ctx.planVer || 0, counts, skipped: skippedIdx, ...patch } });

  // dates: finished days show the day they were finished; the focused day is today (tomorrow once today is done)
  const dayDate = (i) => {
    if (sched[i].doneOn) return new Date(sched[i].doneOn + 'T00:00:00');
    const f = focus < 0 ? N : focus;
    if (i < f) return shiftDay(TODAY, i - f);
    const k = i - f + (todayDone ? 1 : 0);
    return k === 0 ? TODAY : addReadingDays(TODAY, k, rest);
  };

  const completeDay = () => {
    if (focus < 0) return;
    const b = ranges[focus][1];
    update({ ...markTodayDone(ctx), logPages: ctx.hasPdf ? 0 : Math.max(microRead, 0), page: Math.min(ctx.pages || 1, Math.max(ctx.page || 1, b + 1)) });
    setMicroRead(0);
    Platform.vibrate([14, 60, 22, 60, 40]);
    if (hostRef.current) fireConfetti(hostRef.current);
  };

  const [toast, setToast] = React.useState(null); // { prev: { planDays, doneDays }, text }
  // move the pages of skipped days onto the days still to come
  const spread = (skipped, cs, from) => {
    const upcoming = cs.map((_, i) => i).filter(i => i >= from);
    const leftover = skipped.reduce((s, i) => s + cs[i], 0);
    if (!upcoming.length) return { counts: cs, n: 0, leftover };
    const add = Math.floor(leftover / upcoming.length), extra = leftover - add * upcoming.length;
    return { n: upcoming.length, leftover, counts: cs.map((v, i) => skipped.includes(i) ? 0 : upcoming.indexOf(i) >= 0 ? v + add + (upcoming.indexOf(i) < extra ? 1 : 0) : v) };
  };

  const skipDay = () => {
    if (focus < 0) return;
    const prev = { planDays: ctx.planDays || null, doneDays: ctx.doneDays || 0 };
    const sk = [...skippedIdx, focus];
    if (ctx.autoCatchUp) {
      const r = spread([focus], counts, focus + 1);
      update({ doneDays: focus + 1, planDays: { ver: ctx.planVer || 0, counts: r.counts, skipped: sk } });
      setToast({ prev, text: r.n ? `${r.leftover} missed pages spread across ${r.n} day${r.n === 1 ? '' : 's'}` : 'No days left to spread pages over' });
      setTimeout(() => setToast(null), 5000);
    } else { update({ doneDays: focus + 1, planDays: { ver: ctx.planVer || 0, counts, skipped: sk } }); setBanner(true); }
  };
  const undoSpread = () => { if (!toast) return; update({ planDays: toast.prev.planDays, doneDays: toast.prev.doneDays }); setToast(null); };
  const recalculate = () => {
    const pending = skippedIdx.filter(i => counts[i] > 0);
    savePD({ counts: spread(pending, counts, focus < 0 ? N : focus).counts });
    setBanner(false);
  };

  const goal = focus >= 0 ? counts[focus] : 0;
  const microPct = goal ? Math.min(100, (microRead / goal) * 100) : 0;
  const left = statuses.map((s, i) => i).filter(i => i > focus && statuses[i] === 'upcoming' && focus >= 0);
  const past = statuses.map((s, i) => i).filter(i => statuses[i] === 'done' || statuses[i] === 'skipped');
  const LIMIT = 10;
  const outline = view === 'upcoming' ? left : view === 'done' ? [...past].reverse() : [...past, ...(focus >= 0 ? [focus] : []), ...left];
  const shownDays = more ? outline : outline.slice(0, LIMIT);

  return (
    <>
      {/* the book first, then its reading stats */}
      <BookHeader ctx={ctx} badge={ctx.paused ? 'Paused' : allDone ? 'Finished' : `${ctx.mode || 'Casual'} pace`} stats={[
        [null, `${doneCount}/${N}`, 'days done'],
        [null, `${readPct}%`, 'read'],
        [null, allDone ? 'Done' : fmtDate(dayDate(N - 1)).replace(/^\w+, /, ''), allDone ? 'finished' : 'finish date'],
      ]} />

      <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 11 }}>
        {ctx.paused && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 16, background: 'var(--fill)', border: '1px solid var(--line)' }}>
            <Icon name="pause" size={18} style={{ color: 'var(--ink-2)' }} />
            <span style={{ flex: 1, fontFamily: 'var(--font-ui)', fontSize: 13.5, color: 'var(--ink)' }}>This plan is paused. It&rsquo;s off Today until you resume.</span>
            <button onClick={() => update({ paused: false })} style={{ height: 32, padding: '0 14px', borderRadius: 999, border: 'none', background: 'var(--ink)', color: 'var(--cream)', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Resume</button>
          </div>
        )}
        {toast && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 16, background: 'var(--ink)', color: 'var(--cream)', animation: 'fadeUp .25s' }}>
            <Icon name="refresh" size={18} />
            <span style={{ flex: 1, fontFamily: 'var(--font-ui)', fontSize: 13.5, fontWeight: 500 }}>{toast.text}</span>
            <button onClick={undoSpread} style={{ background: 'none', border: 'none', color: 'var(--cream)', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', textDecoration: 'underline' }}>Undo</button>
          </div>
        )}
        {banner && (
          <div style={{ display: 'flex', gap: 13, alignItems: 'center', padding: '14px 16px', borderRadius: 16, background: 'var(--amber-soft)', border: '1px solid var(--amber-ring)', animation: 'fadeUp .35s' }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--amber)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="refresh" size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>Yesterday got busy?</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-2)', marginTop: 1 }}>Spread the missed pages across the rest of your plan.</div>
            </div>
            <button onClick={recalculate} style={{ padding: '9px 14px', borderRadius: 999, border: 'none', background: 'var(--ink)', color: 'var(--surface)', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', flexShrink: 0 }}>Recalculate</button>
          </div>
        )}

        {allDone && (
          <Card pad={26} style={{ textAlign: 'center', background: 'var(--sage-soft)', border: '1px solid var(--sage-ring)' }}>
            <div style={{ width: 60, height: 60, borderRadius: 999, background: 'var(--sage)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Icon name="check" size={32} stroke={2.4} />
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 23, color: 'var(--ink)' }}>Book complete</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14.5, color: 'var(--ink-2)', margin: '6px 0 18px' }}>You read all {plan.reading} pages. That&rsquo;s a {streak}-day streak.</div>
            <Button variant="soft" full icon="plus" onClick={restart}>Start a new book</Button>
          </Card>
        )}

        {/* today's reading is done: its own green banner, separate from what's up next */}
        {todayDone && !allDone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderRadius: 16, background: 'var(--ok-soft)', border: '1px solid var(--ok-ring)', animation: 'fadeUp .3s cubic-bezier(.2,.8,.2,1)' }}>
            <div style={{ width: 32, height: 32, borderRadius: 999, background: READ_GREEN, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="check" size={17} stroke={2.6} /></div>
            <div style={{ flex: 1, fontFamily: 'var(--font-ui)' }}>
              <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>Today&rsquo;s reading is done</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 1 }}>Read ahead below if you like.</div>
            </div>
          </div>
        )}
        {focus >= 0 && (
          <HeroDay ahead={todayDone} hasPdf={ctx.hasPdf} chs={chs} i={focus} N={N} goal={goal} range={ranges[focus]} date={dayDate(focus)}
            isTime={isTime} minutes={plan.minutes} chapterGoal={plan.goalType === 'chapters'}
            microRead={microRead} microPct={microPct}
            onAdd={(p) => setMicroRead(m => Math.min(goal, m + p))}
            onComplete={completeDay} onSkip={skipDay} onRead={ctx.hasPdf ? () => go('reader') : null} />
        )}

        <PlanBookmarks ctx={ctx} chs={chs} go={go} />

        {(left.length > 0 || past.length > 0) && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SectionHead title="Reading outline" action={left.length ? `${left.length} day${left.length === 1 ? '' : 's'} left` : null} style={{ marginBottom: 2 }} />
            {/* Upcoming / Done / All — same pill switch as the rest of the app */}
            <div style={{ display: 'flex', padding: 3, borderRadius: 999, background: 'var(--fill)', border: '1px solid var(--line)' }}>
              {[['upcoming', 'Upcoming', left.length], ['done', 'Done', past.length], ['all', 'All', N]].map(([k, l, n]) => (
                <button key={k} onClick={() => { setView(k); setMore(false); }} style={{ flex: 1, height: 36, borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: view === k ? 600 : 500, fontSize: 13.5,
                  background: view === k ? 'var(--ink)' : 'transparent', color: view === k ? 'var(--cream)' : 'var(--ink-2)', transition: 'all .15s' }}>
                  {l} <span style={{ opacity: 0.6, fontWeight: 500 }}>{n}</span>
                </button>
              ))}
            </div>
            <div key={view} style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'fadeUp .22s cubic-bezier(.2,.8,.2,1)' }}>
              {outline.length === 0 && <div style={{ padding: '14px 16px', borderRadius: 16, background: 'var(--fill)', fontFamily: 'var(--font-ui)', fontSize: 13.5, color: 'var(--ink-2)' }}>{view === 'done' ? 'Days you finish show up here.' : 'No days left after today.'}</div>}
              {shownDays.map(i => statuses[i] === 'upcoming'
                ? <UpcomingDay key={i} chs={chs} i={i} range={ranges[i]} count={counts[i]} date={dayDate(i)} open={expanded === i} onToggle={() => setExpanded(expanded === i ? null : i)} />
                : <CompactDay key={i} i={i} st={statuses[i]} range={ranges[i]} date={dayDate(i)} />)}
              {outline.length > LIMIT && (
                <button onClick={() => setMore(m => !m)} style={outlineBtn}>
                  {more ? 'Show less' : `Show ${outline.length - LIMIT} more day${outline.length - LIMIT === 1 ? '' : 's'}`}
                  <Icon name="chevronDown" size={16} style={{ transform: more ? 'rotate(180deg)' : 'none' }} />
                </button>
              )}
            </div>

          </div>
        )}
      </div>
    </>
  );
}
// The book itself, at the top of its page: one card with the cover and details side by side (the
// details fill the cover's height: status on top, title and author, then tags at the bottom), and the
// reading stats under a hairline, split into three even columns.
function BookHeader({ ctx, badge, stats = [] }) {
  const c = currentBook(ctx);
  const e = ctx.bookId ? Lib.get(ctx.bookId) : null;
  const added = e && e.addedAt ? new Date(e.addedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null;
  const CW = 84, CH = 126;
  const tag = (t) => <span key={t} style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', borderRadius: 999, background: 'var(--fill)', fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 11.5, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{t}</span>;
  const tone = ctx.paused ? ['var(--fill)', 'var(--ink-2)'] : badge === 'Finished' ? ['var(--ok-soft)', 'var(--ok)'] : ['var(--sage-soft)', 'var(--sage)'];
  return (
    <div style={{ padding: 'calc(var(--sat) + 62px) 24px 14px' }}>
      <div style={{ borderRadius: 'var(--card-radius)', border: '1px solid var(--line)', background: 'var(--surface)', padding: 14 }}>
        <div style={{ display: 'flex', gap: 14 }}>
          <BookCover book={c.book} w={CW} radius={10} style={{ width: CW, height: CH, boxShadow: 'none', border: '1px solid var(--line)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, height: CH, display: 'flex', flexDirection: 'column' }}>
            <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px', borderRadius: 999, background: tone[0], color: tone[1], fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 11.5 }}>{badge}</span>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <h1 style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 19, color: 'var(--ink)', margin: 0, lineHeight: 1.2, letterSpacing: -0.3, display: '-webkit-box', WebkitLineClamp: ctx.author ? 2 : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ctx.title || 'Your book'}</h1>
              {ctx.author && <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-2)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ctx.author}</div>}
            </div>
            <div style={{ display: 'flex', gap: 5, overflow: 'hidden' }}>
              {tag(ctx.hasPdf ? 'PDF' : 'Paper book')}{tag(`${c.total} pages`)}
            </div>
          </div>
        </div>
        {stats.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
            {stats.map(([, v, l], i) => (
              <div key={i} style={{ textAlign: 'center', borderLeft: i ? '1px solid var(--line)' : 'none', padding: '2px 4px' }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 17, color: 'var(--ink)', letterSpacing: -0.3, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11.5, color: 'var(--ink-2)', marginTop: 2, whiteSpace: 'nowrap' }}>{l}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
const BookStats = () => null; // stats now live inside BookHeader

const outlineBtn = { height: 44,
 borderRadius: 999, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 };

// A book you're reading without a plan
function NoPlanBody({ ctx, go, chs, planBook }) {
  const c = currentBook(ctx);
  const total = c.total || 1;
  const read = readSet(ctx).size;
  const pct = Math.min(100, Math.round(read / total * 100));
  return (
    <>
      <BookHeader ctx={ctx} badge="No plan" stats={[
        [null, `${pct}%`, 'read'],
        [null, `p. ${Math.max(1, ctx.page || 1)}`, 'current page'],
        [null, `${Math.max(0, total - read)}`, 'pages to go'],
      ]} />
      <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 11 }}>
        <Card pad={20}>
          <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13, color: 'var(--sage)' }}>Reading freely</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 24, color: 'var(--ink)', lineHeight: 1.1, letterSpacing: -0.5, marginTop: 6 }}>Read at your own pace</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--ink-2)', margin: '6px 0 16px', lineHeight: 1.4 }}>Pages you mark as read still count toward your streak. Add a plan any time to get a few pages a day.</div>
          {ctx.hasPdf && <Button full icon="book" onClick={() => go('reader')}>{read ? 'Keep reading' : 'Start reading'}</Button>}
          <Button full variant={ctx.hasPdf ? 'soft' : 'primary'} icon="target" onClick={planBook} style={{ marginTop: ctx.hasPdf ? 8 : 0 }}>Create a reading plan</Button>
        </Card>
        <PlanBookmarks ctx={ctx} chs={chs} go={go} />
      </div>
    </>
  );
}

// Remove a book: from the library only (the PDF stays in the folder), or delete the PDF too
// Remove one book (entry) or several (entries): from the library only (PDFs stay in the folder),
// or delete the PDFs too. Paper books have no file, so they're simply removed.
function RemoveBookSheet({ entry, entries, close, onRemoved }) {
  const list = entries || [entry];
  const many = list.length > 1;
  const anyPdf = list.some(e => !e.paper);
  const [busy, setBusy] = React.useState(false);
  const run = async (hard) => {
    if (busy) return; setBusy(true);
    for (const e of list) { if (hard || e.paper) await Lib.remove(e.id); else Lib.hide(e.id); }
    onRemoved && onRemoved(list.map(e => e.id));
  };
  return (
    <BottomSheet>
      <SheetHeader icon="trash" title={many ? `Remove ${list.length} books?` : 'Remove this book?'} sub={many ? list.slice(0, 3).map(e => e.title).join(', ') + (list.length > 3 ? ` and ${list.length - 3} more` : '') : list[0].title} />
      <div style={{ borderRadius: 16, border: '1px solid var(--line)', overflow: 'hidden', marginBottom: 12 }}>
        {anyPdf && (
          <button onClick={() => run(false)} style={removeRow(true)}>
            <div style={removeIcon(false)}><Icon name="library" size={17} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 15, color: 'var(--ink)' }}>Remove from library</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-2)', marginTop: 1 }}>{many ? 'The PDFs stay in your Volapace folder' : 'The PDF stays in your Volapace folder'}</div>
            </div>
          </button>
        )}
        <button onClick={() => run(true)} style={removeRow(false)}>
          <div style={removeIcon(true)}><Icon name="trash" size={17} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 15, color: 'var(--sage)' }}>{!anyPdf ? (many ? 'Remove books' : 'Remove book') : many ? 'Delete the PDFs too' : 'Delete the PDF too'}</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-2)', marginTop: 1 }}>{!anyPdf ? 'Plans and progress are removed' : many ? 'Deletes the files, their plans and progress' : 'Deletes the file, its plan and progress'}</div>

          </div>
        </button>
      </div>
      <Button full variant="soft" onClick={close}>Cancel</Button>
    </BottomSheet>
  );
}
const removeRow = (line) => ({ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', background: 'none', border: 'none', borderBottom: line ? '1px solid var(--line)' : 'none', cursor: 'pointer', textAlign: 'left' });
const removeIcon = (red) => ({ width: 34, height: 34, borderRadius: 999, background: red ? 'var(--sage-soft)' : 'var(--fill)', color: red ? 'var(--sage)' : 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 });

// Move the finish date earlier or later; the rest of the book is re-spread from where you are
function RecalibrateSheet({ ctx, update, close }) {
  const plan = planOf(ctx);
  const list = plan.list;
  const rest = restDaysOf(ctx);
  const ri = Math.min(list.length - 1, readIdx(list, ctx.page || plan.from));
  const left = Math.max(1, list.length - ri);
  const remaining = Math.max(1, plan.days - plan.doneDays);
  const startOff = todayIsDone(ctx) ? 1 : 0;
  const curFinish = addReadingDays(TODAY, Math.max(0, remaining - 1 + startOff), rest);
  const [days, setDays] = React.useState(remaining);
  const finish = addReadingDays(TODAY, Math.max(0, days - 1), rest);
  const diff = Math.round((finish - curFinish) / 864e5);
  const ppd = Math.ceil(left / days);
  const onDate = (v) => { if (!v) return; const [y, m, d] = v.split('-').map(Number); setDays(Math.max(1, Math.min(365, readingDaysUntil(new Date(y, m - 1, d), rest) + 1))); };
  const save = () => { update({ planStart: ri, doneDays: 0, days, ppd, goalType: plan.goalType === 'time' ? 'time' : 'pages', restDays: rest, dayDates: {}, planDays: null, mode: 'Custom', planVer: (ctx.planVer || 0) + 1 }); close(); };
  return (
    <BottomSheet>
      <SheetHeader icon="calendar" title="Change finish date" sub="Re-plan the rest of the book from where you are" />
      <div style={{ display: 'flex', gap: 8, padding: 14, borderRadius: 16, background: 'var(--fill)', marginBottom: 16 }}>
        {[[fmtDate(curFinish).replace(/^\w+, /, ''), 'Finishing now'], [left, 'Pages left'], [`${plan.doneDays}/${plan.days}`, 'Days done']].map(([n, l]) => (
          <div key={l} style={{ flex: 1 }}><div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 18, color: 'var(--ink)', letterSpacing: -0.3 }}>{n}</div><div style={{ fontFamily: 'var(--font-ui)', fontSize: 11.5, color: 'var(--ink-2)', marginTop: 1 }}>{l}</div></div>
        ))}
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 13.5, color: 'var(--ink-2)', marginBottom: 8 }}>Reading days from today</div>
      <NumField value={days} onChange={setDays} min={1} max={365} suffix={days === 1 ? 'day' : 'days'} />
      <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 13.5, color: 'var(--ink-2)', margin: '16px 0 8px' }}>Or pick the date</div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, height: 50, padding: '0 14px', borderRadius: 14, background: 'var(--fill)', border: '1px solid var(--line)', cursor: 'pointer' }}>
        <Icon name="calendar" size={19} style={{ color: 'var(--ink-2)' }} />
        <input type="date" value={isoDate(finish)} min={isoDate(TODAY)} onChange={e => onDate(e.target.value)}
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 15.5, color: 'var(--ink)', colorScheme: 'light dark' }} />
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, background: 'var(--sage)', color: '#fff', margin: '14px 0 18px' }}>
        <Icon name="target" size={22} />
        <div style={{ flex: 1, fontFamily: 'var(--font-ui)' }}>
          <div style={{ fontSize: 12.5, opacity: 0.85 }}>{ppd} pages a day &middot; {diff === 0 ? 'same date' : `${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'} ${diff > 0 ? 'later' : 'earlier'}`}</div>
          <div style={{ fontWeight: 600, fontSize: 17, marginTop: 1 }}>Done by {fmtDate(finish)}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="soft" style={{ flex: 1 }} onClick={close}>Cancel</Button>
        <Button style={{ flex: 2 }} onClick={save}>Update finish date</Button>
      </div>
    </BottomSheet>
  );
}

function HeroDay({ ahead, hasPdf, chs, i, N, goal, range, date, isTime, minutes, chapterGoal, microRead, microPct, onAdd, onComplete, onSkip, onRead }) {
  const ch = chaptersFor(range[0], range[1], chs);
  return (
    <Card pad={20} style={{ border: ahead ? '1px solid var(--line)' : '1.5px solid var(--ink)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13, color: ahead ? 'var(--ink-2)' : 'var(--sage)' }}>{ahead ? 'Up next' : 'Today'} &middot; Day {i + 1}</span>
        </div>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-2)' }}>{fmtDate(date)}</span>
      </div>

      <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 28, color: 'var(--ink)', lineHeight: 1.05, letterSpacing: -0.6 }}>
        {isTime ? `Read ${minutes} minutes` : chapterGoal && ch ? ch : `Read ${goal} pages`}
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14.5, color: 'var(--ink-2)', marginTop: 5 }}>
        {withCh(`Pages ${range[0]}–${range[1]}`, chaptersFor(range[0], range[1], chs))}
      </div>

      {/* micro progress */}
      <div style={{ marginTop: 18, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-2)', fontWeight: 600 }}>{microRead} of {goal} pages {hasPdf ? 'ticked as read' : 'read'}</span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--sage-deep)', fontWeight: 600 }}>{Math.round(microPct)}%</span>
        </div>
        <ProgressBar value={microPct} height={9} />
        {!hasPdf && <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {[5, 10].map(p => (
            <button key={p} onClick={() => onAdd(p)} style={{ flex: 1, height: 38, borderRadius: 999, border: '1px solid var(--line)', background: 'var(--fill)', color: 'var(--ink)', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Icon name="plus" size={15} /> {p} pages
            </button>
          ))}
        </div>}
      </div>

      {onRead && <Button full icon="book" onClick={onRead}>{ahead ? 'Read ahead' : 'Start reading'}</Button>}
      <Button full variant={onRead ? "soft" : "primary"} icon="check" onClick={onComplete} style={{ marginTop: onRead ? 8 : 0 }}>{ahead ? `Mark Day ${i + 1} complete too` : 'Mark today complete'}</Button>
      {!ahead && <button onClick={onSkip} style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14, color: 'var(--ink-3)' }}>
        I missed today
      </button>}
    </Card>
  );
}

// Saved pages, each opening the reader at that page
function BookmarkList({ pages, chs, highlights = [], onOpen, title }) {
  return (
    <div style={{ borderRadius: 16, border: '1px solid var(--line)', background: 'var(--surface)', overflow: 'hidden' }}>
      {[...pages].sort((a, b) => a - b).map((p, k, arr) => {
        const ch = chaptersFor(p, p, chs);
        const notes = highlights.filter(h => h.page === p).length;
        return (
          <button key={p} onClick={() => onOpen(p)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'none', border: 'none', borderBottom: k < arr.length - 1 ? '1px solid var(--line)' : 'none', cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--sage-soft)', color: 'var(--sage)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="bookmarkOn" size={17} /></div>
            <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-ui)' }}>
              <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>{title ? `${title} · ` : ''}Page {p}</div>
              {(ch || notes > 0) && <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[ch, notes ? `${notes} note${notes === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ')}</div>}
            </div>
            <Icon name="chevronRight" size={18} style={{ color: 'var(--ink-3)' }} />
          </button>
        );
      })}
    </div>
  );
}

function CompactDay({ i, st, range, date }) {
  const done = st === 'done';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 16px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--line)', opacity: done ? 1 : 0.66 }}>
      <div style={{ width: 30, height: 30, borderRadius: 999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: done ? 'var(--ink)' : 'var(--fill)', color: done ? 'var(--cream)' : 'var(--ink-3)' }}>
        {done ? <Icon name="check" size={17} stroke={2.6} /> : <Icon name="close" size={15} stroke={2.4} />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>Day {i + 1} &middot; {done ? 'Completed' : 'Skipped'}</div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-3)', marginTop: 1, textDecoration: done ? 'none' : 'line-through' }}>
          {range[1] >= range[0] ? `Pages ${range[0]}\u2013${range[1]}` : 'Moved to later days'}
        </div>
      </div>
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-3)' }}>{MONTHS[date.getMonth()]} {date.getDate()}</span>
    </div>
  );
}

function UpcomingDay({ chs, i, range, count, date, open, onToggle }) {
  return (
    <div style={{ borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--line)', overflow: 'hidden' }}>
      <button onClick={onToggle} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ width: 30, height: 30, borderRadius: 999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--fill)', color: 'var(--ink)', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13 }}>{i + 1}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>Day {i + 1} &middot; {count} pages</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-3)', marginTop: 1 }}>Pages {range[0]}&ndash;{range[1]} &middot; {fmtDate(date)}</div>
        </div>
        <div style={{ color: 'var(--ink-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><Icon name="chevronDown" size={18} /></div>
      </button>
      {open && (
        <div style={{ padding: '0 16px 14px', animation: 'fadeUp .25s' }}>
          <div style={{ height: 1, background: 'var(--line)', marginBottom: 12 }} />
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.4 }}>
            {chaptersFor(range[0], range[1], chs) ? `${chaptersFor(range[0], range[1], chs)} · ${count} pages, p. ${range[0]}–${range[1]}.` : `${count} pages from p. ${range[0]} to p. ${range[1]}.`}
          </div>
        </div>
      )}
    </div>
  );
}

function EditPlanSheet({ ctx, update, close }) {
  const plan = planOf(ctx);
  const list = plan.list;
  const ri = Math.min(list.length - 1, readIdx(list, ctx.page || plan.from));
  const left = Math.max(1, list.length - ri);
  const [basis, setBasis] = React.useState(plan.goalType === 'time' ? 'time' : 'days');
  const [days, setDays] = React.useState(Math.max(1, Math.ceil(left / plan.ppd)));
  const [ppd, setPpd] = React.useState(plan.ppd);
  const [mins, setMins] = React.useState(plan.minutes);
  const [rest, setRest] = React.useState(() => restDaysOf(ctx));
  const ppdN = basis === 'days' ? Math.ceil(left / days) : basis === 'pages' ? ppd : Math.max(1, Math.round(mins * PAGES_PER_HOUR / 60));
  const daysN = basis === 'days' ? days : Math.max(1, Math.ceil(left / ppdN));
  const finish = addReadingDays(TODAY, Math.max(0, daysN - 1), rest);
  const save = () => { update({ planStart: ri, doneDays: 0, days: daysN, ppd: ppdN, goalType: basis === 'time' ? 'time' : 'pages', minutes: mins, restDays: rest, dayDates: {}, mode: 'Custom', planVer: (ctx.planVer || 0) + 1 }); close(); };
  const stat = (n, l) => <div style={{ flex: 1 }}><div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 18, color: 'var(--ink)', letterSpacing: -0.3 }}>{n}</div><div style={{ fontFamily: 'var(--font-ui)', fontSize: 11.5, color: 'var(--ink-2)', marginTop: 1 }}>{l}</div></div>;
  return (
    <BottomSheet>
      <SheetHeader icon="edit" title="Edit plan" sub="Re-plan from where you are now" />
      <div style={{ display: 'flex', gap: 8, padding: 14, borderRadius: 16, background: 'var(--fill)', marginBottom: 16 }}>
        {stat(`p. ${ctx.page || plan.from}`, 'You\u2019re on')}
        {stat(left, 'Pages left')}
        {stat(`${plan.doneDays}/${plan.days}`, 'Days done')}
      </div>
      <div style={{ display: 'flex', padding: 3, borderRadius: 999, background: 'var(--fill)', marginBottom: 14 }}>
        {[['days', 'Days left'], ['pages', 'Pages a day'], ['time', 'Time a day']].map(([k, l]) => (
          <button key={k} onClick={() => setBasis(k)} style={{ flex: 1, height: 34, borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: basis === k ? 600 : 500, fontSize: 13, background: basis === k ? 'var(--ink)' : 'transparent', color: basis === k ? 'var(--cream)' : 'var(--ink-2)' }}>{l}</button>
        ))}
      </div>
      {basis === 'days' && <NumField value={days} onChange={setDays} min={1} max={365} suffix={days === 1 ? 'day' : 'days'} />}
      {basis === 'pages' && <NumField value={ppd} onChange={setPpd} min={1} max={left} suffix="pages" />}
      {basis === 'time' && <NumField value={mins} onChange={setMins} min={5} max={240} suffix="min" />}
      <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 15, color: 'var(--ink)', margin: '16px 2px 8px' }}>Rest days</div>
      <RestDaysPicker value={rest} onChange={setRest} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, background: 'var(--sage)', color: '#fff', margin: '12px 0 18px' }}>
        <Icon name="target" size={22} />
        <div style={{ flex: 1, fontFamily: 'var(--font-ui)' }}>
          <div style={{ fontSize: 12.5, opacity: 0.85 }}>{basis === 'time' ? `${mins} min (~${ppdN} pages)` : `${ppdN} pages`} a day &middot; {daysN} days</div>
          <div style={{ fontWeight: 600, fontSize: 17, marginTop: 1 }}>Done by {fmtDate(finish)}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="soft" style={{ flex: 1 }} onClick={close}>Cancel</Button>
        <Button style={{ flex: 2 }} onClick={save}>Update plan</Button>
      </div>
    </BottomSheet>
  );
}

function ResetSheet({ ctx, update, close, onNewPlan }) {
  const [armed, setArmed] = React.useState(null);
  const [done, setDone] = React.useState(null);
  const first = readingList(ctx)[0] || 1;
  const nb = (ctx.bookmarks || []).length, nh = (ctx.highlights || []).length, ns = (ctx.skip || []).length;
  const actions = [
    ['progress', 'refresh', 'Start the book again', `Back to page ${first}, plan restarts at day 1`, () => update({ planStart: 0, doneDays: 0, page: first, planVer: (ctx.planVer || 0) + 1 })],
    ['skips', 'pages', 'Reset skipped pages', ns ? `${ns} page${ns === 1 ? '' : 's'} will count as reading again` : 'No pages skipped', () => update({ skip: [], planVer: (ctx.planVer || 0) + 1 }), !ns],
    ['marks', 'bookmark', 'Clear bookmarks & notes', nb + nh ? `${nb} bookmark${nb === 1 ? '' : 's'}, ${nh} highlight${nh === 1 ? '' : 's'}` : 'Nothing saved yet', () => update({ bookmarks: [], highlights: [] }), !(nb + nh)],
    ['display', 'sliders', 'Reset reader display', 'Zoom 100%, light pages, swipe to turn', () => update({ readerZoom: 1, pageLook: 'light', scrollMode: 'horizontal', vSnap: false })],
  ];
  const tap = (a) => { if (a[5]) return; if (armed !== a[0]) { setArmed(a[0]); return; } a[4](); setArmed(null); setDone(a[0]); setTimeout(() => setDone(null), 1600); };
  return (
    <BottomSheet>
      <SheetHeader icon="refresh" title="Reset" sub="Tap twice to confirm" />
      <div style={{ borderRadius: 16, border: '1px solid var(--line)', overflow: 'hidden', marginBottom: 12 }}>
        {actions.map((a, i) => {
          const on = armed === a[0], ok = done === a[0];
          return (
            <button key={a[0]} onClick={() => tap(a)} disabled={a[5]} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', background: on ? 'var(--sage-soft)' : 'none', border: 'none', borderBottom: i < actions.length - 1 ? '1px solid var(--line)' : 'none', cursor: a[5] ? 'default' : 'pointer', textAlign: 'left', opacity: a[5] ? 0.45 : 1, transition: 'background .15s' }}>
              <div style={{ width: 34, height: 34, borderRadius: 999, background: on ? 'var(--sage)' : 'var(--fill)', color: on ? '#fff' : 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={ok ? 'check' : a[1]} size={17} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 15, color: on ? 'var(--sage)' : 'var(--ink)' }}>{on ? 'Tap again to confirm' : ok ? 'Done' : a[2]}</div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-2)', marginTop: 1 }}>{a[3]}</div>
              </div>
            </button>
          );
        })}
      </div>
      <Button variant="soft" full icon="sliders" onClick={onNewPlan}>Set up a new plan</Button>
      <div style={{ marginTop: 10 }}><Button full onClick={close}>Close</Button></div>
    </BottomSheet>
  );
}

function TabBar({ active, onNav }) {
  const tabs = [['home', 'Today', 'today'], ['chart', 'Progress', 'progress'], ['note', 'Notes', 'notes'], ['library', 'Library', 'library'], ['user', 'Profile', 'you']];
  return (
    <div style={{ padding: '10px 6px calc(var(--sab) + 12px)', background: 'var(--tabbar)', backdropFilter: 'blur(20px) saturate(160%)', WebkitBackdropFilter: 'blur(20px) saturate(160%)', borderTop: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
        {tabs.map(([icon, label, key]) => {
          const on = active === key;
          return (
            <button key={label} onClick={() => onNav && onNav(key)} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', minWidth: 58, flex: 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              color: on ? 'var(--ink)' : 'var(--ink-3)', transition: 'color .15s',
            }}>
              <Icon name={icon} size={24} stroke={on ? 2.1 : 1.6} />
              <span style={{ fontFamily: 'var(--font-ui)', fontWeight: on ? 600 : 500, fontSize: 11 }}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { RemoveBookSheet, RecalibrateSheet, PlanScreen, TabBar,
 EditPlanSheet, ResetSheet, BookmarkList, chaptersFor });
