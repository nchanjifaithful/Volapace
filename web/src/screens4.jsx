// screens4.jsx — Today (home) + Progress (analytics)

const H1 = { fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 30, color: 'var(--ink)', margin: 0, letterSpacing: -0.6, lineHeight: 1.1 };
const SCREEN_PAD = { minHeight: '100%', padding: 'calc(var(--sat) + 12px) 22px calc(var(--sab) + 120px)', boxSizing: 'border-box' };

function TodayScreen({ go, hostRef, ctx = {}, update, account, openBook }) {
  const lib = useLib();
  const hasPlan = !!(ctx.bookId && ctx.days);
  if (!hasPlan) return <TodayEmpty go={go} ctx={ctx} account={account} lib={lib} openBook={openBook} />;
  return <TodayPlan go={go} hostRef={hostRef} ctx={ctx} update={update} account={account} lib={lib} openBook={openBook} />;
}

function TodayHeader({ go, account }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
      <div>
        <Eyebrow style={{ marginBottom: 2 }}>{TODAY.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Eyebrow>
        <div style={{ fontFamily: 'var(--font-brand)', fontWeight: 800, fontSize: 29, color: 'var(--ink)', letterSpacing: -1.1, lineHeight: 1.1 }}>Volapace</div>
      </div>
      <button onClick={() => go('you')} aria-label="Profile" style={{ width: 46, height: 46, borderRadius: 999, border: 'none', background: 'var(--sage)', color: '#fff', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {account && account.name && account.name.trim() ? account.name.trim()[0].toUpperCase() : <Icon name="user" size={22} />}
      </button>
    </div>
  );
}

// Other books: ones with a plan (continue) and ones saved without one (up next)
function OtherBooks({ go, ctx, lib, openBook }) {
  const others = lib.filter(e => e.id !== ctx.bookId).map(e => entryBook(e, ctx));
  const continuing = others.filter(b => b.status === 'paused');
  const upNext = others.filter(b => b.status === 'unscheduled');
  return (
    <>
      {continuing.length > 0 && <>
        <SectionHead title="Continue reading" action="View all" onAction={() => go('library')} style={{ marginTop: 18 }} />
        <HScroll>
          {continuing.slice(0, 12).map(b => (
            <ProgressCard key={b.id} book={b} page={b.page} total={b.pages} onClick={() => openBook(b.entry)} style={{ flex: '0 0 290px', width: 290, scrollSnapAlign: 'start' }} />
          ))}
        </HScroll>
      </>}
      {upNext.length > 0 && <>
        <SectionHead title="Up next" action="View all" onAction={() => go('library')} style={{ marginTop: 22 }} />
        <HScroll>
          {upNext.slice(0, 12).map(b => (
            <button key={b.id} onClick={() => openBook(b.entry)} style={{ flex: '0 0 116px', scrollSnapAlign: 'start', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
              <BookCover book={b} w={116} radius={10} style={{ boxShadow: 'none' }} />
              <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 13.5, color: 'var(--ink)', marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title}</div>
              <div style={{ display: 'inline-flex', marginTop: 6, padding: '4px 10px', borderRadius: 999, border: '1px solid var(--line)', fontFamily: 'var(--font-ui)', fontSize: 11.5, color: 'var(--ink-2)' }}>{b.pages ? `${b.pages} pages` : b.genre}</div>
            </button>
          ))}
        </HScroll>
      </>}
    </>
  );
}

function TodayEmpty({ go, ctx, account, lib, openBook }) {
  const finished = ctx.bookId && ctx.finishedAt;
  return (
    <div style={SCREEN_PAD}>
      <TodayHeader go={go} account={account} />
      {lib.length > 0 && <SearchBar placeholder="Search your library" onClick={() => go('library')} style={{ marginBottom: 16 }} />}
      <div style={{ borderRadius: 'var(--card-radius)', background: 'var(--sage)', color: '#fff', padding: 20, marginBottom: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: 999, background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}><Icon name={finished ? 'check' : 'book'} size={24} /></div>
        <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 21, letterSpacing: -0.3, lineHeight: 1.15 }}>{finished ? 'Book finished. What’s next?' : lib.length ? 'Pick a book to plan' : 'Start your first reading plan'}</div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13.5, opacity: 0.85, marginTop: 6, lineHeight: 1.4 }}>Add a PDF or a paper book, set a pace, and Volapace turns it into a few pages a day.</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={() => go('upload')} style={featBtn(true)}>Add a book</button>
          {lib.length > 0 && <button onClick={() => go('library')} style={featBtn(false)}>Open library</button>}
        </div>
      </div>
      {doneSet(ctx).size > 0 && <div onClick={() => go('streak')} style={{ cursor: 'pointer' }}><StreakWeek ctx={ctx} style={{ marginBottom: 12 }} /></div>}
      <OtherBooks go={go} ctx={ctx} lib={lib} openBook={openBook} />
    </div>
  );
}

function TodayPlan({ go, hostRef, ctx = {}, update, account, lib, openBook }) {
  const plan = planOf(ctx);
  const cur = currentBook(ctx);
  const coverBook = cur.book;
  const GOAL = plan.goal, FROM = plan.from, TO = plan.to;
  const doneToday = doneSet(ctx).has(dayISO(TODAY));
  const isTime = plan.goalType === 'time';
  const minsToday = ctx.timeLog && ctx.timeLog.date === dayISO(TODAY) ? Math.floor(ctx.timeLog.secs / 60) : 0;
  const [logged, setLogged] = React.useState(() => Math.max(0, Math.min(GOAL, (ctx.page || FROM) - FROM)));
  const [open, setOpen] = React.useState(false);
  const [done, setDone] = React.useState(doneToday);
  const pct = Math.min(100, (logged / GOAL) * 100);
  const bonus = logged > GOAL;
  const add = (n) => setLogged(v => Math.max(0, v + n));
  const initLogged = React.useRef(logged);
  const complete = () => {
    setDone(true);
    update && update({ ...markTodayDone(ctx), page: Math.max(ctx.page || FROM, FROM + logged), logPages: Math.max(0, logged - initLogged.current) });
    Platform.vibrate([14, 60, 22, 60, 40]);
    if (hostRef && hostRef.current) fireConfetti(hostRef.current);
  };
  const read = () => ctx.hasPdf ? go('reader') : setOpen(true);

  return (
    <div style={SCREEN_PAD}>
      <TodayHeader go={go} account={account} />

      <SearchBar placeholder="Search your library" onClick={() => go('library')} style={{ marginBottom: 16 }} />

      {/* Featured: today's read */}
      <div style={{ borderRadius: 'var(--card-radius)', background: 'var(--sage)', color: '#fff', padding: 16, display: 'flex', gap: 16, marginBottom: 12 }}>
        <button onClick={() => go('book')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', borderRadius: 10, outline: '1.5px dashed rgba(255,255,255,0.6)', outlineOffset: 4, alignSelf: 'flex-start', margin: 4 }}>
          <BookCover book={coverBook} w={80} radius={8} style={{ boxShadow: 'none' }} />
        </button>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, opacity: 0.85 }}>{done ? 'Done for today' : `Today \u00b7 Day ${plan.day} of ${plan.days}`}</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 21, letterSpacing: -0.3, lineHeight: 1.15, marginTop: 3 }}>{done ? 'All caught up' : isTime ? `Read ${plan.minutes} minutes` : `Read ${GOAL} pages`}</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, opacity: 0.85, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{plan.title} &middot; p. {FROM}&ndash;{TO}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <div style={{ flex: 1 }}><ProgressBar value={done ? 100 : isTime ? Math.min(100, minsToday / plan.minutes * 100) : pct} height={5} track="rgba(255,255,255,0.25)" fill="#fff" /></div>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600 }}>{isTime ? `${done ? plan.minutes : minsToday}/${plan.minutes} min` : `${done ? GOAL : logged}/${GOAL}`}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={read} style={featBtn(true)}>{done ? (ctx.hasPdf ? 'Read ahead' : 'Log more') : ctx.hasPdf ? 'Start reading' : 'Log pages'}</button>
            <button onClick={() => go('book')} style={featBtn(false)}>View plan</button>
          </div>
        </div>
      </div>

      {doneSet(ctx).size > 0 && <div onClick={() => go('streak')} style={{ cursor: 'pointer' }}><StreakWeek ctx={ctx} style={{ marginBottom: 12 }} /></div>}

      {!done && !open && (
        <button onClick={() => setOpen(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 'var(--card-radius)', border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left', marginBottom: 12 }}>
          <Icon name="pages" size={20} style={{ color: 'var(--ink-2)' }} />
          <span style={{ flex: 1, fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 15, color: 'var(--ink)' }}>Reading a paper copy? Log pages</span>
          <Icon name="chevronRight" size={18} style={{ color: 'var(--ink-3)' }} />
        </button>
      )}
      {open && (
        <div style={{ borderRadius: 'var(--card-radius)', border: '1px solid var(--line)', background: 'var(--surface)', padding: 18, marginBottom: 12, animation: 'fadeUp .25s cubic-bezier(.2,.8,.2,1)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 15.5, color: 'var(--ink)' }}>Log progress</span>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-2)' }}>Hide</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 14px' }}>
            <BigStep label={'\u2212'} onClick={() => add(-1)} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 46, color: 'var(--ink)', lineHeight: 1, letterSpacing: -1.5, fontVariantNumeric: 'tabular-nums' }}>{logged}</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4 }}>of {GOAL} pages</div>
            </div>
            <BigStep label="+" onClick={() => add(1)} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <Chip onClick={() => add(5)} style={{ flex: 1 }}>+5</Chip>
            <Chip onClick={() => add(10)} style={{ flex: 1 }}>+10</Chip>
            <Chip on={logged >= GOAL} onClick={() => setLogged(GOAL)} style={{ flex: 1.4 }}>Reached goal</Chip>
          </div>
          {bonus && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 14, background: 'var(--sage-soft)', color: 'var(--sage-deep)', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13.5, marginBottom: 14, animation: 'pop .3s cubic-bezier(.2,1.3,.4,1)' }}>
              <Icon name="bolt" size={17} /> +{logged - GOAL} pages ahead of schedule
            </div>
          )}
          <Button full icon="check" onClick={complete} disabled={logged === 0}>Mark today complete</Button>
        </div>
      )}

      <OtherBooks go={go} ctx={ctx} lib={lib} openBook={openBook} />
    </div>
  );
}

const featBtn = (solid) => ({
  height: 34, padding: '0 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap',
  background: solid ? '#fff' : 'transparent', color: solid ? 'var(--sage)' : '#fff', border: solid ? 'none' : '1.5px solid rgba(255,255,255,0.8)',
});

function BigStep({ label, onClick }) {
  const [press, setPress] = React.useState(false);
  return (
    <button onClick={onClick}
      onPointerDown={() => setPress(true)} onPointerUp={() => setPress(false)} onPointerLeave={() => setPress(false)}
      style={{
        width: 54, height: 54, borderRadius: 999, border: '1px solid var(--line)', background: 'var(--fill)',
        color: 'var(--ink)', fontFamily: 'var(--font-ui)', fontSize: 26, fontWeight: 400, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
        transform: press ? 'scale(0.92)' : 'scale(1)', transition: 'transform .12s',
      }}>{label}</button>
  );
}

// ════════════════════════════════════════════════════════════
// PROGRESS — every figure comes from the local history (stats.jsx)
// ════════════════════════════════════════════════════════════
function GoalCalendar({ range, ctx }) {
  const set = doneSet(ctx);
  const day = (i) => shiftDay(TODAY, -i);
  // 3 = goal met, 1 = read but goal not met, 0 = nothing
  const level = (d) => { const iso = dayISO(d); if (set.has(iso)) return 3; const x = logDay(ctx, iso); return x && (x.s >= 60 || x.p > 0) ? 1 : 0; };
  const cell = (lv, extra = {}) => ({ borderRadius: 8, background: lv === 0 ? 'var(--fill)' : `color-mix(in srgb, var(--sage) ${25 + lv * 25}%, var(--surface))`, ...extra });

  if (range === 'week') {
    const days = Array.from({ length: 7 }, (_, k) => day(6 - k));
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {days.map((d, k) => {
          const done = set.has(dayISO(d)), today = k === 6;
          return (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--ink-3)' }}>{'SMTWTFS'[d.getDay()]}</span>
              <div style={{ width: '100%', aspectRatio: '1 / 1.25', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                background: done ? 'var(--sage)' : 'var(--fill)', color: done ? '#fff' : 'var(--ink)', border: today && !done ? '1.5px dashed var(--ink-3)' : '1.5px solid transparent' }}>
                <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 16 }}>{d.getDate()}</span>
                {done ? <Icon name="check" size={13} stroke={2.6} /> : <span style={{ height: 13 }} />}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  if (range === 'month') {
    const cells = Array.from({ length: 28 }, (_, k) => { const d = day(27 - k); return { d, lv: level(d) }; });
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {cells.slice(0, 7).map((c, k) => <div key={'l' + k} style={{ textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--ink-3)', marginBottom: 2 }}>{'SMTWTFS'[c.d.getDay()]}</div>)}
        {cells.map((c, k) => <div key={k} title={c.d.toDateString()} style={cell(c.lv, { aspectRatio: '1', outline: k === 27 ? '1.5px solid var(--ink)' : 'none', outlineOffset: 1 })} />)}
      </div>
    );
  }
  const met = monthsMet(ctx);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
      {met.map((v, i) => (
        <div key={i} style={{ padding: '10px 10px 9px', borderRadius: 12, background: v == null ? 'var(--fill)' : `color-mix(in srgb, var(--sage) ${15 + v * 0.75}%, var(--surface))`, color: v != null && v > 55 ? '#fff' : 'var(--ink)', opacity: v == null ? 0.55 : 1, outline: i === TODAY.getMonth() ? '1.5px solid var(--ink)' : 'none', outlineOffset: 1 }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11.5, fontWeight: 500 }}>{MONTH_ABBR[i]}</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 15, fontWeight: 600, marginTop: 6 }}>{v == null ? '–' : v + '%'}</div>
        </div>
      ))}
    </div>
  );
}

function ProgressScreen({ ctx = {}, go, update, openModal, closeModal }) {
  const [range, setRange] = React.useState('month');
  const R = React.useMemo(() => rangeStats(ctx, range), [ctx.log, ctx.finished, range]);
  const life = lifetimeStats(ctx);
  const sum = R.summary || { pages: life.pages, hours: life.hours, books: life.books };
  const [sel, setSel] = React.useState(null);
  const bars = R.bars, maxV = Math.max(0.0001, ...bars.map(d => d.v));
  const anyBar = bars.some(d => d.v > 0);
  const selIdx = sel == null || sel >= bars.length ? bars.reduce((m, d, i) => d.v > 0 ? i : m, range === 'year' ? TODAY.getMonth() : bars.length - 1) : sel;
  const selBar = bars[selIdx];
  const set = doneSet(ctx);
  const span = range === 'week' ? 7 : range === 'month' ? 28 : 0;
  const metDays = span ? Array.from({ length: span }, (_, i) => set.has(dayISO(shiftDay(TODAY, -i)))).filter(Boolean).length : null;
  const pickRange = (k) => { setRange(k); setSel(null); };
  const tm = todayMinutes(ctx);
  const pace = readingPace(ctx);

  const cheer = range === 'year'
    ? (() => { const doy = Math.floor((TODAY - new Date(TODAY.getFullYear(), 0, 1)) / 864e5) + 1; const exp = life.goal * doy / 365; const diff = life.books - exp;
        return { title: `${life.books} of ${life.goal} books this year`, sub: life.books >= life.goal ? 'Goal reached. Anything more is a bonus.' : `${life.goal - life.books} to go. ${Math.abs(diff) < 0.5 ? 'Right on pace.' : diff > 0 ? `${diff.toFixed(1)} books ahead of pace.` : `${(-diff).toFixed(1)} books behind pace.`}`, pct: (life.books / life.goal) * 100, marker: (exp / life.goal) * 100, edit: true }; })()
    : (() => {
        const word = range === 'week' ? 'this week' : 'in the last 28 days', last = range === 'week' ? 'last week' : 'the 28 days before';
        const d = sum.pages - R.prev;
        const sub = sum.pages === 0 && R.prev === 0 ? 'Pages you read or log will show up here.'
          : R.prev === 0 ? 'Your first stretch of history. Keep it going.'
          : d > 0 ? `${d} more than ${last}. Keep it going.` : d === 0 ? `Same as ${last}.` : `${-d} fewer than ${last}.`;
        return { title: `${sum.pages.toLocaleString()} pages ${word}`, sub, pct: R.prev ? Math.min(100, (sum.pages / (R.prev * 1.2)) * 100) : sum.pages ? 100 : 0 };
      })();

  return (
    <div style={SCREEN_PAD}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={H1}>Progress</h1>
        {set.size > 0 && <IconBtn name="share" onClick={() => go('streak')} />}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['week', 'This week'], ['month', 'This month'], ['year', 'This year']].map(([k, l]) => <Chip key={k} on={range === k} onClick={() => pickRange(k)}>{l}</Chip>)}
      </div>

      <div key={range} style={{ animation: 'fadeUp .28s cubic-bezier(.2,.8,.2,1)' }}>
        <PCard>
          <PHead title="Goal calendar" sub={metDays != null ? `${R.calTitle} · ${metDays}/${span} days` : `${R.calTitle} · days goal met`} />
          <GoalCalendar range={range} ctx={ctx} />
        </PCard>

        {life.streak > 0 && (
        <button onClick={() => go('streak')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', cursor: 'pointer', padding: 16, borderRadius: 'var(--card-radius)', marginBottom: 12, background: 'var(--sage)', border: 'none', color: '#fff' }}>
          <div style={{ width: 46, height: 46, borderRadius: 999, background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="flame" size={24} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 20, letterSpacing: -0.3 }}>{life.streak}-day streak</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, opacity: 0.85, marginTop: 2 }}>{life.streak >= life.longest ? 'Your longest yet' : `Best is ${life.longest} days`}</div>
          </div>
          <span style={{ height: 32, padding: '0 14px', borderRadius: 999, background: '#fff', color: 'var(--sage)', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center' }}>Share card</span>
        </button>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          {[[sum.books, 'Books finished', 'book'], [sum.pages.toLocaleString(), 'Pages read', 'pages'], [sum.hours, 'Hours reading', 'clock'], [range === 'year' ? life.longest : metDays, range === 'year' ? 'Longest streak' : 'Goal days', 'flame']].map(([n, l, ic]) => (
            <div key={l} style={bento}>
              <StatHead icon={ic} label={l} />
              <div style={bigNum}>{n}</div>
            </div>
          ))}
        </div>

        <PCard>
          <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 16, color: 'var(--ink)', letterSpacing: -0.2 }}>{cheer.title}</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13.5, color: 'var(--ink-2)', marginTop: 3, lineHeight: 1.4 }}>{cheer.sub}</div>
          <div style={{ marginTop: 12, position: 'relative' }}>
            <ProgressBar value={cheer.pct} height={6} />
            {cheer.marker != null && <div title="Where you should be today" style={{ position: 'absolute', left: `${Math.min(100, cheer.marker)}%`, top: -3, width: 2, height: 12, borderRadius: 1, background: 'var(--ink)' }} />}
          </div>
          {cheer.edit && <button onClick={() => openModal(<YearGoalSheet close={closeModal} value={life.goal} done={life.books} onSave={v => update({ yearGoal: v })} />)} style={{ marginTop: 12, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', textDecoration: 'underline' }}>Change goal</button>}
        </PCard>

        <PCard style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
          <Ring value={tm.avg ? Math.min(100, tm.mins / tm.avg * 100) : tm.mins ? 100 : 0} size={44} stroke={5}><Icon name="clock" size={15} style={{ color: 'var(--ink)' }} /></Ring>
          <div style={{ flex: 1, fontFamily: 'var(--font-ui)' }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{tm.mins} min today</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 1 }}>
              {!tm.hasAvg ? 'Time in the reader counts automatically'
                : tm.diff > 0 ? <><b style={{ color: 'var(--sage)', fontWeight: 600 }}>+{tm.diff} min</b> over your daily average</>
                : tm.diff === 0 ? 'Right on your daily average'
                : <>{-tm.diff} min under your daily average of {tm.avg}</>}
            </div>
          </div>
        </PCard>

        <PCard>
          <PHead title="Time invested" sub={R.barsTitle} />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: range === 'year' ? 5 : 10, height: 120 }}>
            {bars.map((d, i) => {
              const on = anyBar && selIdx === i;
              return (
                <button key={i} onClick={() => d.v && setSel(i)} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end', background: 'none', border: 'none', cursor: d.v ? 'pointer' : 'default', padding: 0 }}>
                  <div style={{ width: '100%', height: d.v ? `${Math.max(4, (d.v / maxV) * 100)}%` : 4, borderRadius: 6, transformOrigin: 'bottom', background: on ? 'var(--ink)' : 'var(--fill-2)', opacity: d.v ? 1 : 0.5, animation: `barRise .5s cubic-bezier(.2,.8,.2,1) ${i * 0.03}s both`, transition: 'background .2s' }} />
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: range === 'year' ? 9.5 : 11.5, fontWeight: on ? 600 : 400, color: on ? 'var(--ink)' : 'var(--ink-3)' }}>{range === 'year' ? d.m[0] : d.m}</span>
                </button>
              );
            })}
          </div>
          <div key={range + selIdx} style={{ marginTop: 14, padding: '12px 14px', borderRadius: 14, background: 'var(--fill)', fontFamily: 'var(--font-ui)', animation: 'fadeUp .25s' }}>
            {anyBar ? <>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{selBar.m} &middot; {selBar.v} {R.unit}</div>
              {selBar.top && <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2 }}>Mostly <i>{selBar.top}</i></div>}
            </> : <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>No reading time yet. Open a book in the reader and it&rsquo;s counted here.</div>}
          </div>
        </PCard>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={bento}>
            <StatHead icon="bolt" label="Velocity" />
            <div style={bigNum}>{pace.pph != null ? pace.pph : '–'}<span style={unit}> pg/hr</span></div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-2)', marginTop: 8 }}>{pace.pph != null ? 'Pages per hour in the reader' : 'Needs 10 min of reading'}</div>
          </div>
          <div style={bento}>
            <StatHead icon="clock" label="Endurance" />
            <div style={bigNum}>{pace.session != null ? pace.session : '–'}<span style={unit}> min</span></div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-2)', marginTop: 8 }}>Avg session length</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const bento = { padding: 16, borderRadius: 'var(--card-radius)', background: 'var(--fill)' };
const bigNum = { fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 30, color: 'var(--ink)', lineHeight: 1, letterSpacing: -0.8 };
const unit = { fontSize: 14, fontWeight: 500, color: 'var(--ink-2)', letterSpacing: 0 };

function PCard({ children, style = {} }) {
  return <div style={{ padding: 18, borderRadius: 'var(--card-radius)', background: 'var(--surface)', border: '1px solid var(--line)', marginBottom: 12, ...style }}>{children}</div>;
}
function PHead({ title, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
      <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 15.5, color: 'var(--ink)' }}>{title}</span>
      {sub && <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-3)' }}>{sub}</span>}
    </div>
  );
}
function StatHead({ icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14, color: 'var(--ink-2)' }}>
      <Icon name={icon} size={16} />
      <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 12.5 }}>{label}</span>
    </div>
  );
}

Object.assign(window, { TodayScreen, ProgressScreen, H1, SCREEN_PAD });
