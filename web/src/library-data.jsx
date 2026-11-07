// library-data.jsx — Volapace book catalogue + original typographic covers
// Covers are original stylizations (no reproduced cover art). Load before screens4/5.

// No sample catalogue: the library starts empty and fills with the reader's own books.
const BOOKS = [];

// Generated typographic cover for books without a rendered first page (paper books, PDFs still indexing)
const COVER_PALETTES = [
  { bg: ['#0E3B45', '#07212C'], ink: '#F4E9C9', accent: '#E8C547' },
  { bg: ['#2B2E63', '#15173A'], ink: '#E7E9F6', accent: '#9DA7E8' },
  { bg: ['#3C5A6E', '#27414F'], ink: '#FBFDFE', accent: '#C9DDE8' },
  { bg: ['#6E2230', '#481018'], ink: '#F6E7DC', accent: '#E0A24B' },
  { bg: ['#C9772F', '#A85C1E'], ink: '#FFF6EC', accent: '#FBE3C2' },
  { bg: ['#5B3A52', '#3A2336'], ink: '#F3E6EE', accent: '#D9A6C2' },
  { bg: ['#2B5A57', '#163230'], ink: '#E7F4F1', accent: '#7FC4B8' },
  { bg: ['#1c1c1c', '#0d0d0d'], ink: '#FFFFFF', accent: '#D90429' },
];
function coverStyleFor(title, paper) {
  let h = 7; const s = title || ''; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const p = COVER_PALETTES[h % COVER_PALETTES.length];
  return { layout: ['classic', 'band', 'minimal'][(h >> 3) % 3], ...p, eyebrow: paper ? 'Paper book' : 'PDF' };
}

// Library entry (+ live ctx for the open book) -> book model used by covers, cards and rows
function entryBook(e, ctx = {}) {
  const cur = ctx.bookId && e.id === ctx.bookId;
  const s = cur ? ctx : (e.snap || {});
  const pages = e.pages || s.pages || 0;
  const page = Math.max(0, Math.min(pages || 1, (s.page || 1) - 1));
  const finished = !!(s.finishedAt || e.finishedAt);
  const pct = finished ? 100 : Math.min(100, Math.round((page / Math.max(1, pages)) * 100));
  const hasPlan = !!s.days;
  const status = finished ? 'completed' : cur && hasPlan ? 'active' : hasPlan ? 'paused' : 'unscheduled';
  const fin = s.finishedAt || e.finishedAt;
  return {
    id: e.id, user: true, entry: e, pdf: !e.paper, paper: !!e.paper, coverImg: e.cover || null,
    title: e.title || 'Untitled', author: e.author || '', pages, page, planPct: pct, status,
    genre: e.paper ? 'Paper book' : 'PDF', cover: coverStyleFor(e.title, e.paper),
    dayLabel: finished ? (fin ? `Finished ${new Date(fin).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'Finished') : hasPlan ? `Day ${Math.min(s.days, (s.doneDays || 0) + 1)} of ${s.days}` : '',
  };
}

const STATUS_META = {
  active:      { label: 'Reading', tone: 'sage' },
  completed:   { label: 'Finished', tone: 'done' },
  paused:      { label: 'Paused', tone: 'amber' },
  unscheduled: { label: 'Saved', tone: 'neutral' },
};

// ── Typographic cover (original artwork, parameterized) ───────
function BookCover({ book, w = 150, radius = 10, style = {}, scanning = false, foot = 0, head = 0 }) {
  if (book.coverImg) return <img src={book.coverImg} alt="" loading="lazy" decoding="async" style={{ width: w, height: w * 1.5, borderRadius: radius, objectFit: 'cover', objectPosition: 'top', background: '#fff', display: 'block', flexShrink: 0, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)', ...style }} />;
  if (!book.cover) book = { ...book, cover: coverStyleFor(book.title, book.paper) };
  const c = book.cover;
  const h = w * 1.5;
  const wrap = {
    width: w, height: h, borderRadius: radius, position: 'relative', overflow: 'hidden',
    background: `linear-gradient(160deg, ${c.bg[0]} 0%, ${c.bg[1]} 100%)`,
    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)',
    flexShrink: 0, ...style,
  };
  const serif = 'var(--font-serif)';

  let inner;
  if (c.layout === 'classic') {
    inner = (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: `calc(13% + ${head}px) 11% calc(13% + ${foot}px)`, textAlign: 'center' }}>
        <div style={{ fontFamily: serif, fontSize: w * 0.072, letterSpacing: w * 0.02, color: c.accent, textTransform: 'uppercase', fontWeight: 500 }}>{c.eyebrow}</div>
        <div>
          <div style={{ fontFamily: serif, fontWeight: 600, fontSize: w * 0.135, lineHeight: 1.12, color: c.ink, letterSpacing: 0.3 }}>{book.title}</div>
          <div style={{ width: '44%', height: 2, background: c.accent, margin: `${w * 0.05}px auto`, opacity: 0.85 }} />
          <div style={{ fontFamily: serif, fontSize: w * 0.056, letterSpacing: 1.1, color: c.ink, opacity: 0.82, textTransform: 'uppercase' }}>{book.author}</div>
        </div>
        <div style={{ fontFamily: serif, fontSize: w * 0.05, letterSpacing: 2, color: c.accent, opacity: 0.7 }}>&#9670; &#9670; &#9670;</div>
      </div>
    );
  } else if (c.layout === 'band') {
    inner = (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', padding: `${w * 0.12 + head}px ${w * 0.1}px 0` }}>
          <div style={{ fontFamily: serif, fontSize: w * 0.064, letterSpacing: w * 0.018, color: c.accent, textTransform: 'uppercase', fontWeight: 500 }}>{c.eyebrow}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.10)', borderTop: `2px solid ${c.accent}`, borderBottom: `2px solid ${c.accent}`, padding: `${w * 0.08}px ${w * 0.1}px` }}>
          <div style={{ fontFamily: serif, fontWeight: 600, fontSize: w * 0.155, lineHeight: 1.05, color: c.ink }}>{book.title}</div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', padding: `0 ${w * 0.1}px ${w * 0.12 + foot}px` }}>
          <div style={{ fontFamily: serif, fontSize: w * 0.062, letterSpacing: 0.8, color: c.ink, opacity: 0.85, textTransform: 'uppercase' }}>{book.author}</div>
        </div>
      </div>
    );
  } else { // minimal
    inner = (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: `${w * 0.12 + head}px ${w * 0.1}px ${w * 0.12 + foot}px`, textAlign: 'left' }}>
        <div>
          <div style={{ width: w * 0.18, height: 3, background: c.accent, marginBottom: w * 0.07 }} />
          <div style={{ fontFamily: serif, fontWeight: 600, fontSize: w * 0.165, lineHeight: 1.04, color: c.ink, letterSpacing: 0.2 }}>{book.title}</div>
        </div>
        <div>
          <div style={{ fontFamily: serif, fontSize: w * 0.058, letterSpacing: w * 0.012, color: c.accent, textTransform: 'uppercase', marginBottom: w * 0.03 }}>{c.eyebrow}</div>
          <div style={{ fontFamily: serif, fontSize: w * 0.062, letterSpacing: 0.6, color: c.ink, opacity: 0.85, textTransform: 'uppercase' }}>{book.author}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      {inner}
      {scanning && typeof ScanOverlay !== 'undefined' && <ScanOverlay w={w} />}
    </div>
  );
}

// ── Status badge pill ─────────────────────────────────────────
function StatusBadge({ status, style = {} }) {
  const m = STATUS_META[status] || STATUS_META.unscheduled;
  const tones = {
    sage:    { bg: 'color-mix(in srgb, var(--st-reading) 12%, var(--surface))',  fg: 'var(--st-reading)',  dot: 'var(--st-reading)' },
    done:    { bg: 'color-mix(in srgb, var(--st-finished) 12%, var(--surface))', fg: 'var(--st-finished)', dot: 'var(--st-finished)' },
    amber:   { bg: 'color-mix(in srgb, var(--st-paused) 12%, var(--surface))',   fg: 'var(--st-paused)',   dot: 'var(--st-paused)' },
    neutral: { bg: 'color-mix(in srgb, var(--st-saved) 12%, var(--surface))',    fg: 'var(--st-saved)',    dot: 'var(--st-saved)' },
  };
  const t = tones[m.tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px 5px 9px',
      borderRadius: 999, background: t.bg, color: t.fg,
      fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 11.5, letterSpacing: 0,
      whiteSpace: 'nowrap', ...style,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: t.dot }} />
      {m.label}
    </span>
  );
}

Object.assign(window, { BOOKS, STATUS_META, BookCover, StatusBadge, entryBook, coverStyleFor });
