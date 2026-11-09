// stats.jsx — real reading history and every number on Progress / Streak / Profile.
// Nothing here is seeded: a new install shows zeros until the reader reads.
//
// ctx.log      { 'YYYY-MM-DD': { s: seconds read, p: pages read, n: sessions, b: { [title]: seconds } } }
// ctx.finished [{ id, title, pages, date: 'YYYY-MM-DD' }]   books finished
// ctx.doneDates                                             days the daily goal was met (streak)

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function logDay(ctx, iso) { return (ctx.log && ctx.log[iso]) || null; }

// Fold bookkeeping fields from an update into the history. Returns the next ctx.
function applyHistory(prev, data) {
  const next = { ...prev, ...data };
  const today = dayISO(TODAY);
  const log = { ...(prev.log || {}) };
  const day = { s: 0, p: 0, n: 0, b: {}, k: {}, bp: {}, ...(log[today] || {}) };
  day.b = { ...(day.b || {}) }; day.k = { ...(day.k || {}) }; day.bp = { ...(day.bp || {}) };
  const title = next.title || 'Untitled';
  const bid = next.bookId || 'none';
  let touched = false;

  // reading time from the reader timer (timeLog is today's running total, across books)
  if (data.timeLog && data.timeLog.date === today) {
    const before = prev.timeLog && prev.timeLog.date === today ? prev.timeLog.secs : 0;
    const delta = data.timeLog.secs - before;
    if (delta > 0) { day.s += delta; day.b[title] = (day.b[title] || 0) + delta; day.k[bid] = (day.k[bid] || 0) + delta; touched = true; }
  }
  // a finished reading session (seconds)
  if (data.endSession != null) { if (data.endSession >= 30) { day.n += 1; touched = true; } delete next.endSession; }
  // Pages read: a PDF page counts once, the first time it's ticked as read (double-tap, the dot, or
  // finishing the day). Paper books count the pages logged by hand.
  let fresh = 0;
  if (data.readPages && prev.bookId === next.bookId && next.hasPdf) {
    // a page counts once ever, even if it's unticked and ticked again
    const counted = new Set([...(prev.countedPages || []), ...(prev.readPages || [])]);
    const added = data.readPages.filter(p => !counted.has(p));
    fresh = added.length;
    if (fresh) next.countedPages = [...counted, ...added].sort((a, b) => a - b);
  }
  if (data.logPages != null) { if (!next.hasPdf && data.logPages > 0) fresh += data.logPages; delete next.logPages; }
  if (fresh > 0) { day.p += fresh; day.bp[bid] = (day.bp[bid] || 0) + fresh; touched = true; }
  if (touched) { log[today] = day; next.log = log; }

  // reading a book that has no plan still counts toward the streak
  if (fresh > 0 && next.bookId && !hasPlan(next)) Object.assign(next, streakPatch(next, next.bookId));

  // finishing a book: the plan's last day is done, or every reading page is ticked
  if (next.bookId && !next.finishedAt && (hasPlan(next) || (next.readPages || []).length)) {
    const list = readingList(next);
    const plan = planOf(next);
    const rs = new Set(next.readPages || []);
    if ((hasPlan(next) && plan.finished) || (next.hasPdf && list.length > 1 && list.every(p => rs.has(p)))) {
      next.finishedAt = Date.now();
      next.finished = [...(prev.finished || []).filter(f => f.id !== next.bookId), { id: next.bookId, title, pages: plan.reading, date: today }];
    }
  }
  return next;
}

function sumDays(ctx, from, to) { // inclusive Date range
  let s = 0, p = 0, n = 0; const b = {};
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const x = logDay(ctx, dayISO(d)); if (!x) continue;
    s += x.s || 0; p += x.p || 0; n += x.n || 0;
    Object.entries(x.b || {}).forEach(([k, v]) => { b[k] = (b[k] || 0) + v; });
  }
  const top = Object.entries(b).sort((x, y) => y[1] - x[1])[0];
  return { s, p, n, top: top ? top[0] : null };
}
const finishedBetween = (ctx, from, to) => (ctx.finished || []).filter(f => f.date >= dayISO(from) && f.date <= dayISO(to)).length;
const hrs = (s) => { const h = s / 3600; return h >= 10 ? Math.round(h) : Math.round(h * 10) / 10; };

function longestStreak(set) {
  const days = [...set].sort(); let best = 0, run = 0, prev = null;
  for (const iso of days) {
    const d = new Date(iso + 'T00:00:00');
    run = prev && Math.round((d - prev) / 864e5) === 1 ? run + 1 : 1;
    best = Math.max(best, run); prev = d;
  }
  return best;
}

function lifetimeStats(ctx) {
  let s = 0, p = 0;
  Object.values(ctx.log || {}).forEach(x => { s += x.s || 0; p += x.p || 0; });
  const set = doneSet(ctx);
  const streak = streakCount(set);
  const year = String(TODAY.getFullYear());
  const fin = ctx.finished || [];
  const monthKey = dayISO(TODAY).slice(0, 7);
  return {
    books: fin.filter(f => f.date.startsWith(year)).length,
    booksAll: fin.length,
    booksMonth: fin.filter(f => f.date.startsWith(monthKey)).length,
    pages: p, hours: hrs(s), secs: s, streak,
    longest: Math.max(streak, longestStreak(set)), goal: ctx.yearGoal || 12,
  };
}

// Week / month / year figures for the Progress screen
// Calendar periods: the week runs Monday to Sunday; the month is split into Week 1 (days 1–7), Week 2…
const weekStart = (d = TODAY) => shiftDay(d, -((d.getDay() + 6) % 7));
function rangeStats(ctx, range) {
  if (range === 'week') {
    const mon = weekStart();
    const bars = Array.from({ length: 7 }, (_, k) => { const d = shiftDay(mon, k); if (d > TODAY) return { m: 'MTWTFSS'[k], v: 0, top: null, future: true }; const x = sumDays(ctx, d, d); return { m: 'MTWTFSS'[k], v: Math.round(x.s / 60), top: x.top }; });
    const cur = sumDays(ctx, mon, TODAY), prev = sumDays(ctx, shiftDay(mon, -7), shiftDay(mon, -1));
    return { calTitle: 'This week', summary: { pages: cur.p, hours: hrs(cur.s), books: finishedBetween(ctx, mon, TODAY) }, prev: prev.p, barsTitle: 'Minutes per day', unit: 'min', bars, prevLabel: 'last week' };
  }
  if (range === 'month') {
    const y = TODAY.getFullYear(), mo = TODAY.getMonth(), first = new Date(y, mo, 1), last = new Date(y, mo + 1, 0).getDate();
    const nW = Math.ceil(last / 7);
    const bars = Array.from({ length: nW }, (_, k) => {
      const a = new Date(y, mo, 1 + k * 7), b = new Date(y, mo, Math.min(last, 7 + k * 7));
      if (a > TODAY) return { m: `Wk ${k + 1}`, v: 0, top: null, future: true };
      const x = sumDays(ctx, a, b < TODAY ? b : TODAY); return { m: `Wk ${k + 1}`, v: hrs(x.s), top: x.top };
    });
    const cur = sumDays(ctx, first, TODAY), prev = sumDays(ctx, new Date(y, mo - 1, 1), new Date(y, mo, 0));
    return { calTitle: first.toLocaleDateString(undefined, { month: 'long' }), summary: { pages: cur.p, hours: hrs(cur.s), books: finishedBetween(ctx, first, TODAY) }, prev: prev.p, barsTitle: 'Hours per week', unit: 'hrs', bars, prevLabel: 'last month' };
  }
  const y = TODAY.getFullYear();
  const bars = MONTH_ABBR.map((m, i) => {
    if (i > TODAY.getMonth()) return { m, v: 0, top: null };
    const x = sumDays(ctx, new Date(y, i, 1), i === TODAY.getMonth() ? TODAY : new Date(y, i + 1, 0));
    return { m, v: hrs(x.s), top: x.top };
  });
  return { calTitle: String(y), summary: null, prev: null, barsTitle: 'Hours per month', unit: 'hrs', bars };
}

// % of days in each month this year on which the goal was met (null for future months)
function monthsMet(ctx) {
  const set = doneSet(ctx), y = TODAY.getFullYear();
  return MONTH_ABBR.map((_, i) => {
    if (i > TODAY.getMonth()) return null;
    const days = i === TODAY.getMonth() ? TODAY.getDate() : new Date(y, i + 1, 0).getDate();
    let met = 0; for (let d = 1; d <= days; d++) if (set.has(dayISO(new Date(y, i, d)))) met++;
    return Math.round(met / days * 100);
  });
}

// Minutes today vs the daily average over the last 28 reading days
function todayMinutes(ctx) {
  const t = logDay(ctx, dayISO(TODAY));
  const mins = Math.round(((t && t.s) || 0) / 60);
  let tot = 0, n = 0;
  for (let i = 1; i <= 28; i++) { const x = logDay(ctx, dayISO(shiftDay(TODAY, -i))); if (x && x.s > 0) { tot += x.s; n++; } }
  const avg = n ? Math.round(tot / n / 60) : 0;
  return { mins, avg, diff: mins - avg, hasAvg: n > 0 };
}

// Pages per hour and average session length, from reader sessions
function readingPace(ctx) {
  let s = 0, p = 0, n = 0;
  Object.values(ctx.log || {}).forEach(x => { if (x.s > 0) { s += x.s; p += x.p || 0; } n += x.n || 0; });
  return { pph: s >= 600 && p > 0 ? Math.round(p / (s / 3600)) : null, session: n ? Math.round(s / n / 60) : null };
}

// Seconds spent in one book's reader today (for time-based daily goals)
const bookSecsToday = (ctx, id) => { const x = logDay(ctx, dayISO(TODAY)); return (x && x.k && x.k[id]) || 0; };

Object.assign(window, { bookSecsToday, logDay, weekStart, applyHistory, lifetimeStats, rangeStats, monthsMet, todayMinutes, readingPace, longestStreak, MONTH_ABBR });
