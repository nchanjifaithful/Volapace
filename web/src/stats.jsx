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
  const day = { s: 0, p: 0, n: 0, b: {}, ...(log[today] || {}) };
  day.b = { ...(day.b || {}) };
  const title = next.title || 'Untitled';
  let touched = false;

  // reading time from the reader timer (timeLog is today's running total)
  if (data.timeLog && data.timeLog.date === today) {
    const before = prev.timeLog && prev.timeLog.date === today ? prev.timeLog.secs : 0;
    const delta = data.timeLog.secs - before;
    if (delta > 0) { day.s += delta; day.b[title] = (day.b[title] || 0) + delta; touched = true; }
  }
  // a finished reading session (seconds)
  if (data.endSession != null) { if (data.endSession >= 30) { day.n += 1; touched = true; } delete next.endSession; }
  // pages logged by hand (paper copies) or turned forward in the reader
  if (data.logPages != null) {
    if (data.logPages > 0) { day.p += data.logPages; touched = true; }
    delete next.logPages;
  } else if (data.page != null && prev.page != null && prev.bookId === next.bookId) {
    const d = data.page - prev.page;
    if (d > 0 && d <= 5) { day.p += d; touched = true; }
  }
  if (touched) { log[today] = day; next.log = log; }

  // finishing a book
  if (next.bookId && next.days && !next.finishedAt) {
    const list = readingList(next);
    const plan = planOf(next);
    if ((next.page || 0) >= list[list.length - 1] || plan.finished) {
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
function rangeStats(ctx, range) {
  const day = (i) => shiftDay(TODAY, -i);
  if (range === 'week') {
    const bars = Array.from({ length: 7 }, (_, k) => { const d = day(6 - k); const x = sumDays(ctx, d, d); return { m: 'SMTWTFS'[d.getDay()], v: Math.round(x.s / 60), top: x.top }; });
    const cur = sumDays(ctx, day(6), TODAY), prev = sumDays(ctx, day(13), day(7));
    return { calTitle: 'This week', summary: { pages: cur.p, hours: hrs(cur.s), books: finishedBetween(ctx, day(6), TODAY) }, prev: prev.p, barsTitle: 'Minutes per day', unit: 'min', bars };
  }
  if (range === 'month') {
    const bars = Array.from({ length: 4 }, (_, k) => { const x = sumDays(ctx, day(27 - k * 7), day(21 - k * 7)); return { m: `Wk ${k + 1}`, v: hrs(x.s), top: x.top }; });
    const cur = sumDays(ctx, day(27), TODAY), prev = sumDays(ctx, day(55), day(28));
    return { calTitle: 'Last 28 days', summary: { pages: cur.p, hours: hrs(cur.s), books: finishedBetween(ctx, day(27), TODAY) }, prev: prev.p, barsTitle: 'Hours per week', unit: 'hrs', bars };
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

Object.assign(window, { applyHistory, lifetimeStats, rangeStats, monthsMet, todayMinutes, readingPace, longestStreak, MONTH_ABBR });
