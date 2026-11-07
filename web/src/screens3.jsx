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

function PlanScreen({ ctx, update, go, restart, hostRef, onBack, openModal, closeModal }) {
  const readList = React.useMemo(() => readingList(ctx).slice(Math.min(ctx.planStart || 0, Math.max(0, readingList(ctx).length - 1))), [ctx.pages, ctx.skip, ctx.planStart]);
  const pages = readList.length;
  const N = ctx.days || 1;
  const chs = useChapters();
  React.useEffect(() => { if (ctx.hasPdf && ctx.bookId && PdfStore.id !== ctx.bookId) PdfStore.openId(ctx.bookId).catch(() => {}); }, [ctx.bookId]);
  const saved = ctx.planDays && ctx.planDays.ver === (ctx.planVer || 0) && ctx.planDays.counts.length === N ? ctx.planDays : null;
  const catchUp = ctx.catchUp ?? true;

  // initial even distribution
  const initCounts = React.useMemo(() => {
    const base = Math.floor(pages / N), rem = pages - base * N;
    return Array.from({ length: N }, (_, i) => base + (i < rem ? 1 : 0));
  }, [pages, N]);

  const [counts, setCounts] = React.useState(() => saved ? saved.counts : initCounts);
  const [statuses, setStatuses] = React.useState(() => saved ? saved.statuses : Array.from({ length: N }, (_, i) => i < (ctx.doneDays ?? 0) ? 'done' : 'upcoming'));
  const [reminders, setReminders] = React.useState(() => saved && saved.reminders ? saved.reminders : Array(N).fill(true));
  const [streak, setStreak] = React.useState(() => streakCount(doneSet(ctx)));
  const [microRead, setMicroRead] = React.useState(0);
  const [banner, setBanner] = React.useState(false);
  const [expanded, setExpanded] = React.useState(null);

  const focus = statuses.findIndex(s => s === 'upcoming');
  React.useEffect(() => { update && update({ planDays: { ver: ctx.planVer || 0, counts, statuses, reminders } }); }, [counts, statuses, reminders]);
  const doneCount = statuses.filter(s => s === 'done').length;
  const allDone = focus === -1;

  // page ranges (skipped resolved days contribute 0)
  const ranges = React.useMemo(() => {
    let cur = 1; const r = [];
    counts.forEach((c) => { const start = cur; const end = Math.max(start, cur + c - 1); r.push([readList[start - 1] || start, readList[end - 1] || end]); cur += c; });
    return r;
  }, [counts, readList]);

  // the focused day is today; earlier days count back, later days follow the reading calendar
  const todayDone = doneSet(ctx).has(dayISO(TODAY));
  // the day finished today (or the focused day) is today; earlier days count back, later ones follow the reading calendar
  const anchor = focus < 0 ? N - 1 : todayDone && focus > 0 ? focus - 1 : focus;
  const dayDate = (i) => i === anchor ? TODAY : i < anchor ? shiftDay(TODAY, i - anchor) : addReadingDays(TODAY, i - anchor, catchUp);

  const completeDay = () => {
    if (focus < 0) return;
    setStatuses(s => s.map((v, i) => i === focus ? 'done' : v));
    setStreak(v => v + 1);
    update && update({ ...markTodayDone(ctx), logPages: microRead, page: Math.min(ctx.pages || 1, Math.max(ctx.page || 1, (ranges[focus] ? ranges[focus][1] : 0) + 1)) });
    setMicroRead(0);
    if (hostRef.current) fireConfetti(hostRef.current);
  };

  const [toast, setToast] = React.useState(null); // { prev: {counts, statuses}, text }
  const spread = (st, cs) => {
    const upcoming = st.map((s, i) => s === 'upcoming' ? i : -1).filter(i => i >= 0);
    const leftover = st.reduce((sum, s, i) => s === 'skipped' ? sum + cs[i] : sum, 0);
    if (!upcoming.length) return { counts: cs, n: 0, leftover };
    const add = Math.floor(leftover / upcoming.length), extra = leftover - add * upcoming.length;
    return { n: upcoming.length, leftover, counts: cs.map((v, i) => st[i] === 'skipped' ? 0 : upcoming.indexOf(i) >= 0 ? v + add + (upcoming.indexOf(i) < extra ? 1 : 0) : v) };
  };

  const skipDay = () => {
    if (focus < 0) return;
    const next = statuses.map((v, i) => i === focus ? 'skipped' : v);
    setStatuses(next); setMicroRead(0);
    if (ctx.autoCatchUp) {
      const r = spread(next, counts);
      setToast({ prev: { counts, statuses }, text: r.n ? `${r.leftover} missed pages spread across ${r.n} day${r.n === 1 ? '' : 's'}` : 'No days left to spread pages over' });
      setCounts(r.counts);
      setTimeout(() => setToast(t => t && t.prev.counts === counts ? null : t), 5000);
    } else setBanner(true);
  };
  const undoSpread = () => { if (!toast) return; setCounts(toast.prev.counts); setStatuses(toast.prev.statuses); setToast(null); };

  const recalculate = () => { setCounts(spread(statuses, counts).counts); setBanner(false); };

  const toggleReminder = (i) => setReminders(r => r.map((v, k) => k === i ? !v : v));

  const goal = focus >= 0 ? counts[focus] : 0;
  const microPct = goal ? Math.min(100, (microRead / goal) * 100) : 0;

  return (
    <div style={{ minHeight: '100%', paddingBottom: 40, boxSizing: 'border-box' }}>
      {onBack && (
        <button onClick={onBack} style={{ position: 'absolute', top: 'calc(var(--sat) + 10px)', left: 18, width: 40, height: 40, borderRadius: 999, background: 'var(--glass)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)', cursor: 'pointer', zIndex: 6 }}>
          <Icon name="arrowLeft" size={21} />
        </button>
      )}
      {/* header */}
      <div style={{ padding: 'calc(var(--sat) + 62px) 24px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 14 }}>
            <Eyebrow style={{ marginBottom: 6 }}>{ctx.mode || 'Casual'} pace</Eyebrow>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 26, color: 'var(--ink)', margin: 0, lineHeight: 1.12, letterSpacing: -0.5 }}>{ctx.title || 'Your book'}</h1>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--ink-2)', margin: '8px 0 0' }}>
              {allDone ? 'Finished \u2014 nicely done' : `Day ${focus + 1} of ${N}`}
            </p>
          </div>
          <Ring value={(doneCount / N) * 100} size={84} stroke={9}>
            <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 19, color: 'var(--ink)', lineHeight: 1, letterSpacing: -0.4 }}>{doneCount}/{N}</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 10.5, color: 'var(--ink-3)', marginTop: 3 }}>days</div>
          </Ring>
        </div>
      </div>

      <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="soft" icon="edit" style={{ flex: 1, height: 44, fontSize: 14 }} onClick={() => openModal(<EditPlanSheet ctx={ctx} update={update} close={closeModal} />)}>Edit plan</Button>
          <Button variant="soft" icon="refresh" style={{ flex: 1, height: 44, fontSize: 14 }} onClick={() => openModal(<ResetSheet ctx={ctx} update={update} close={closeModal} onNewPlan={() => { closeModal(); go('pace'); }} />)}>Reset</Button>
        </div>
        {toast && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 16, background: 'var(--ink)', color: 'var(--cream)', animation: 'fadeUp .25s' }}>
            <Icon name="refresh" size={18} />
            <span style={{ flex: 1, fontFamily: 'var(--font-ui)', fontSize: 13.5, fontWeight: 500 }}>{toast.text}</span>
            <button onClick={undoSpread} style={{ background: 'none', border: 'none', color: 'var(--cream)', fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', textDecoration: 'underline' }}>Undo</button>
          </div>
        )}
        {(() => { const c = currentBook(ctx); return <ProgressCard book={c.book} page={c.page} total={c.total} onClick={() => go('reader')} />; })()}
        {/* recalc banner */}
        {banner && (
          <div style={{ display: 'flex', gap: 13, alignItems: 'center', padding: '14px 16px', borderRadius: 16, background: 'var(--amber-soft)', border: '1px solid var(--amber-ring)', animation: 'fadeUp .35s' }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: 'var(--amber)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="refresh" size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>Yesterday got busy?</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-2)', marginTop: 1 }}>Spread the missed pages across the rest of your plan.</div>
            </div>
            <button onClick={recalculate} style={{ padding: '9px 14px', borderRadius: 11, border: 'none', background: 'var(--ink)', color: 'var(--surface)', fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', flexShrink: 0 }}>Recalculate</button>
          </div>
        )}

        {allDone && (
          <Card pad={26} style={{ textAlign: 'center', background: 'var(--sage-soft)', border: '1px solid var(--sage-ring)' }}>
            <div style={{ width: 60, height: 60, borderRadius: 999, background: 'var(--sage)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Icon name="check" size={32} stroke={2.4} />
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 23, color: 'var(--ink)' }}>Book complete</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14.5, color: 'var(--ink-2)', margin: '6px 0 18px' }}>You read all {pages} pages. That&rsquo;s a {streak}-day streak.</div>
            <Button variant="soft" full icon="plus" onClick={restart}>Start a new book</Button>
          </Card>
        )}

        {/* day list */}
        {statuses.map((st, i) => {
          if (st === 'done' || st === 'skipped') return <CompactDay key={i} i={i} st={st} range={ranges[i]} date={dayDate(i)} />;
          if (i === focus) {
            return (
              <HeroDay key={i} ahead={anchor !== focus} chs={chs} i={i} N={N} goal={goal} range={ranges[i]} date={dayDate(i)}
                microRead={microRead} microPct={microPct}
                onAdd={(p) => setMicroRead(m => Math.min(goal, m + p))}
                onComplete={completeDay} onSkip={skipDay} onRead={ctx.hasPdf ? () => go('reader') : null} />
            );
          }
          // upcoming
          return (
            <UpcomingDay key={i} chs={chs} i={i} range={ranges[i]} count={counts[i]} date={dayDate(i)}
              open={expanded === i} onToggle={() => setExpanded(expanded === i ? null : i)}
              reminder={reminders[i]} onReminder={() => toggleReminder(i)} time={ctx.time} />
          );
        })}
      </div>
    </div>
  );
}

function HeroDay({ ahead, chs, i, N, goal, range, date, microRead, microPct, onAdd, onComplete, onSkip, onRead }) {
  return (
    <Card pad={20} style={{ border: '1.5px solid var(--ink)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13, color: 'var(--sage)' }}>{ahead ? 'Next' : 'Today'} &middot; Day {i + 1}</span>
        </div>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-2)' }}>{fmtDate(date)}</span>
      </div>

      <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 28, color: 'var(--ink)', lineHeight: 1.05, letterSpacing: -0.6 }}>
        Read {goal} pages
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14.5, color: 'var(--ink-2)', marginTop: 5 }}>
        {withCh(`Pages ${range[0]}–${range[1]}`, chaptersFor(range[0], range[1], chs))}
      </div>

      {/* micro progress */}
      <div style={{ marginTop: 18, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-2)', fontWeight: 600 }}>{microRead} of {goal} pages read</span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--sage-deep)', fontWeight: 700 }}>{Math.round(microPct)}%</span>
        </div>
        <ProgressBar value={microPct} height={9} />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {[5, 10].map(p => (
            <button key={p} onClick={() => onAdd(p)} style={{ flex: 1, height: 38, borderRadius: 999, border: '1px solid var(--line)', background: 'var(--fill)', color: 'var(--ink)', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Icon name="plus" size={15} /> {p} pages
            </button>
          ))}
        </div>
      </div>

      {onRead && <Button full icon="book" onClick={onRead}>Start reading</Button>}
      <Button full variant={onRead ? "soft" : "primary"} icon="check" onClick={onComplete} style={{ marginTop: onRead ? 8 : 0 }}>Mark today complete</Button>
      <button onClick={onSkip} style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14, color: 'var(--ink-3)' }}>
        I missed today
      </button>
    </Card>
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

function UpcomingDay({ chs, i, range, count, date, open, onToggle, reminder, onReminder, time }) {
  return (
    <div style={{ borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--line)', overflow: 'hidden' }}>
      <button onClick={onToggle} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ width: 30, height: 30, borderRadius: 999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--fill)', color: 'var(--ink)', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13 }}>{i + 1}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>Day {i + 1} &middot; {count} pages</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-3)', marginTop: 1 }}>Pages {range[0]}&ndash;{range[1]} &middot; {fmtDate(date)}</div>
        </div>
        {reminder && <Icon name="bell" size={16} style={{ color: 'var(--sage-deep)' }} />}
        <div style={{ color: 'var(--ink-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><Icon name="chevronDown" size={18} /></div>
      </button>
      {open && (
        <div style={{ padding: '0 16px 14px', animation: 'fadeUp .25s' }}>
          <div style={{ height: 1, background: 'var(--line)', marginBottom: 12 }} />
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13.5, color: 'var(--ink-2)', marginBottom: 12 }}>
            {chaptersFor(range[0], range[1], chs) ? `${chaptersFor(range[0], range[1], chs)} · ends near a chapter break.` : `${count} pages from p. ${range[0]} to p. ${range[1]}.`}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Icon name="bell" size={18} style={{ color: 'var(--ink-2)' }} />
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 14.5, color: 'var(--ink)' }}>Remind me at {time || '8:30 PM'}</span>
            </div>
            <Toggle on={reminder} onChange={onReminder} />
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
  const [catchUp, setCatchUp] = React.useState(ctx.catchUp ?? true);
  const ppdN = basis === 'days' ? Math.ceil(left / days) : basis === 'pages' ? ppd : Math.max(1, Math.round(mins * PAGES_PER_HOUR / 60));
  const daysN = basis === 'days' ? days : Math.max(1, Math.ceil(left / ppdN));
  const finish = addReadingDays(TODAY, daysN, catchUp);
  const save = () => { update({ planStart: ri, doneDays: 0, days: daysN, ppd: ppdN, goalType: basis === 'time' ? 'time' : 'pages', minutes: mins, catchUp, mode: 'Custom', planVer: (ctx.planVer || 0) + 1 }); close(); };
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 2px 4px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 15, color: 'var(--ink)' }}>Catch-up days</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-2)', marginTop: 1 }}>Keep Sundays free</div>
        </div>
        <Toggle on={catchUp} onChange={setCatchUp} />
      </div>
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
  const tabs = [['home', 'Today', 'today'], ['chart', 'Progress', 'progress'], ['library', 'Library', 'library'], ['user', 'Profile', 'you']];
  return (
    <div style={{ padding: '10px 14px calc(var(--sab) + 12px)', background: 'var(--tabbar)', backdropFilter: 'blur(20px) saturate(160%)', WebkitBackdropFilter: 'blur(20px) saturate(160%)', borderTop: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
        {tabs.map(([icon, label, key]) => {
          const on = active === key;
          return (
            <button key={label} onClick={() => onNav && onNav(key)} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 12px', minWidth: 64,
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

Object.assign(window, { PlanScreen, TabBar, EditPlanSheet, ResetSheet });
