// streak.jsx — lifetime stats + shareable streak card (DOM preview + canvas PNG export)
// Load after reader.jsx.


const CARD_THEMES = {
  red:   { label: 'Red',   bg: '#D90429', fg: '#FFFFFF', sub: 'rgba(255,255,255,0.78)', off: 'rgba(255,255,255,0.18)', check: '#D90429', line: 'rgba(255,255,255,0.22)' },
  black: { label: 'Black', bg: '#111111', fg: '#FFFFFF', sub: 'rgba(255,255,255,0.62)', off: 'rgba(255,255,255,0.12)', check: '#111111', line: 'rgba(255,255,255,0.14)', accent: '#D90429' },
  paper: { label: 'Paper', bg: '#F6F2EA', fg: '#141414', sub: 'rgba(20,20,20,0.6)', off: 'rgba(20,20,20,0.08)', check: '#F6F2EA', line: 'rgba(20,20,20,0.12)', accent: '#D90429' },
};

function weekDays(ctx) {
  const set = doneSet(ctx), L = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(TODAY); d.setDate(d.getDate() + i - 6); return { l: L[d.getDay()], done: set.has(dayISO(d)) }; });
}

// The books you're reading (open book first, then most recently opened). Falls back to the open book.
function readingNow(ctx) {
  const list = Lib.visible().map(e => entryBook(e, ctx)).filter(b => b.status === 'active')
    .sort((a, b) => (b.id === ctx.bookId) - (a.id === ctx.bookId) || ((b.entry.lastOpened || 0) - (a.entry.lastOpened || 0)))
    .map(b => ({ book: b, page: Math.max(1, b.page), total: b.pages || 1, pct: b.planPct, covered: covered(b.snap, b.page, b.pages) }));
  if (list.length) return list;
  const c = currentBook(ctx);
  return [{ book: c.book, page: Math.max(1, c.page), total: c.total, pct: Math.round((c.page / Math.max(1, c.total)) * 100), covered: covered(ctx, c.page, c.total) }];
}
// pages covered: the pages marked read (PDFs); for paper books, the page you've reached
function covered(s, page, total) { const n = ((s && s.readPages) || []).length; return Math.min(total || n, n || Math.max(0, page || 0)); }

// ── Card layout, in card units (320 × 400). The DOM preview and the 1080 × 1350 export both use it,
// so the image you share looks exactly like the preview. The books are the centre of the card:
// a row of covers, each with its progress. ──
const CARD = {
  pad: 22, num: { top: 44, size: 64 }, week: { top: 126, dot: 24, label: 154 }, rule: 180, label: 194,
  covers: { top: 216, w: 58, h: 87, gap: 14, max: 4 }, title: 311, pct: 325,
  one: { titleTop: 224, pageTop: 270, pctTop: 286 },
  stats: { num: 352, label: 373 },
};
// which covers fit on the row: up to 4; with more books, 3 covers and a "+N" tile
const coverSlots = (books) => books.length > CARD.covers.max ? { show: books.slice(0, CARD.covers.max - 1), more: books.length - (CARD.covers.max - 1) } : { show: books, more: 0 };

// ── DOM preview ──
function StreakCardView({ ctx, theme }) {
  const t = CARD_THEMES[theme], s = lifetimeStats(ctx), wk = weekDays(ctx);
  const books = readingNow(ctx), c = books[0];
  const dot = t.accent || t.fg, P = CARD.pad, C = CARD.covers;
  const abs = (top, extra = {}) => ({ position: 'absolute', top, left: P, ...extra });
  const bar = (top, width, pct, h = 3) => (
    <div style={abs(top, { left: undefined, width, height: h, borderRadius: 999, background: t.off, overflow: 'hidden', position: 'absolute' })}>
      <div style={{ width: pct + '%', height: '100%', background: dot, borderRadius: 999 }} />
    </div>
  );
  const { show, more } = coverSlots(books);
  return (
    <div data-om-raster="true" style={{ position: 'relative', width: 320, height: 400, borderRadius: 22, background: t.bg, color: t.fg, fontFamily: 'var(--font-ui)', overflow: 'hidden' }}>
      <div style={abs(20, { right: P, display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 22 })}>
        <Brand logo={22} size={17} color={t.fg} variant={theme === 'paper' ? 'color' : 'white'} bookmark={t.bg} />
        <span style={{ fontSize: 11, color: t.sub }}>{TODAY.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      </div>
      <div style={abs(CARD.num.top, { display: 'flex', alignItems: 'flex-end', gap: 10 })}>
        <span style={{ fontWeight: 600, fontSize: CARD.num.size, lineHeight: `${CARD.num.size}px`, letterSpacing: -3 }}>{s.streak}</span>
        <span style={{ fontSize: 14, lineHeight: '17px', paddingBottom: 9, color: t.sub }}>day<br />reading streak</span>
      </div>
      <div style={abs(CARD.week.top, { right: P, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' })}>
        {wk.map((d, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: CARD.week.dot, height: CARD.week.dot, borderRadius: 999, background: d.done ? dot : t.off, color: theme === 'red' ? t.check : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {d.done && <Icon name="check" size={12} stroke={2.8} />}
            </div>
            <span style={{ fontSize: 9.5, lineHeight: '12px', color: t.sub }}>{d.l}</span>
          </div>
        ))}
      </div>
      <div style={abs(CARD.rule, { right: P, height: 1, background: t.line })} />
      <div style={abs(CARD.label, { fontSize: 10.5, lineHeight: '12px', color: t.sub })}>{books.length === 1 ? 'Currently reading' : `Reading ${books.length} books`}</div>

      {books.length === 1 ? <>
        <BookCover book={c.book} w={C.w} radius={6} style={{ ...abs(C.top), width: C.w, height: C.h, boxShadow: 'none' }} />
        <div style={abs(CARD.one.titleTop, { left: P + C.w + 12, right: P, fontWeight: 600, fontSize: 15, lineHeight: '18px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' })}>{c.book.title}</div>
        <div style={abs(CARD.one.pageTop, { left: P + C.w + 12, fontSize: 10.5, lineHeight: '12px', color: t.sub })}>Page {c.page} of {c.total}</div>
        <div style={abs(CARD.one.pctTop, { left: P + C.w + 12, fontSize: 10.5, lineHeight: '12px', color: t.sub })}>{c.covered} of {c.total} pages covered</div>
      </> : <>
        {show.map((b, i) => {
          const x = P + i * (C.w + C.gap);
          return (
            <React.Fragment key={b.book.id}>
              <BookCover book={b.book} w={C.w} radius={6} style={{ position: 'absolute', top: C.top, left: x, width: C.w, height: C.h, boxShadow: 'none' }} />
              <div style={{ position: 'absolute', top: CARD.title, left: x, width: C.w + 10, fontWeight: 600, fontSize: 10.5, lineHeight: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.book.title}</div>
              <div style={{ position: 'absolute', top: CARD.pct, left: x, width: C.w + 6, fontSize: 9.5, lineHeight: '12px', color: t.sub, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{b.covered}/{b.total} pages</div>
            </React.Fragment>
          );
        })}
        {more > 0 && (
          <div style={{ position: 'absolute', top: C.top, left: P + show.length * (C.w + C.gap), width: C.w, height: C.h, borderRadius: 6, background: t.off, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: 18, lineHeight: '20px' }}>+{more}</span>
            <span style={{ fontSize: 10, lineHeight: '12px', color: t.sub }}>more</span>
          </div>
        )}
      </>}

      {[[s.books, 'books'], [s.pages.toLocaleString(), 'pages'], [s.hours, 'hours']].map(([n, l], i) => (
        <React.Fragment key={l}>
          <div style={{ position: 'absolute', top: CARD.stats.num, left: P + i * ((320 - 2 * P) / 3), fontWeight: 600, fontSize: 18, lineHeight: '20px', letterSpacing: -0.4 }}>{n}</div>
          <div style={{ position: 'absolute', top: CARD.stats.label, left: P + i * ((320 - 2 * P) / 3), fontSize: 10.5, lineHeight: '12px', color: t.sub }}>{l} read</div>
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Canvas export (1080 × 1350) ──
async function coverCanvas(book, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  if (book.coverImg) {
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = book.coverImg; });
      const s = Math.max(w / img.width, h / img.height);
      g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, img.width * s, img.height * s);
      return c;
    } catch (e) {}
  }
  if (book.pdf && PdfStore.doc && PdfStore.id === book.id) {
    const page = await PdfStore.doc.getPage(1);
    const vp0 = page.getViewport({ scale: 1 }); const vp = page.getViewport({ scale: Math.max(w / vp0.width, h / vp0.height) });
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    await page.render({ canvasContext: g, viewport: vp }).promise;
    return c;
  }
  const cv = book.cover || coverStyleFor(book.title, book.paper);
  g.fillStyle = cv.bg[0]; g.fillRect(0, 0, w, h);
  g.fillStyle = cv.accent; g.fillRect(w * 0.1, h * 0.1, w * 0.18, 4);
  g.fillStyle = cv.ink; g.font = `600 ${w * 0.15}px Newsreader, Georgia, serif`; g.textBaseline = 'top';
  wrapText(g, book.title, w * 0.1, h * 0.16, w * 0.8, w * 0.17, 4);
  g.font = `${w * 0.065}px Newsreader, Georgia, serif`; g.globalAlpha = 0.85; g.fillText(book.author.toUpperCase(), w * 0.1, h * 0.86); g.globalAlpha = 1;
  return c;
}
function wrapText(g, text, x, y, maxW, lh, maxLines = 2) {
  const words = text.split(' '); let line = '', n = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i];
    if (g.measureText(test).width > maxW && line) {
      if (n === maxLines - 1) { while (g.measureText(line + '\u2026').width > maxW) line = line.slice(0, -1); g.fillText(line + '\u2026', x, y + n * lh); return; }
      g.fillText(line, x, y + n * lh); n++; line = words[i];
    } else line = test;
  }
  g.fillText(line, x, y + n * lh);
}
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

async function drawStreakCard(ctx, theme) {
  await document.fonts.ready;
  const t = CARD_THEMES[theme], s = lifetimeStats(ctx), wk = weekDays(ctx);
  const books = readingNow(ctx), c = books[0];
  const K = 1080 / 320, W = 1080, H = 1350, P = CARD.pad * K, C = CARD.covers;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const UI = 'Geist, -apple-system, system-ui, sans-serif', dot = t.accent || t.fg;
  const ls = (v) => { if ('letterSpacing' in g) g.letterSpacing = `${v}px`; };
  // text whose CSS line box is `lh` tall starting at `top` (matches the DOM preview's line-height)
  const text = (str, x, top, size, lh, color, weight = 400, align = 'left') => {
    g.font = `${weight} ${size * K}px ${UI}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle';
    g.fillText(str, x, (top + lh / 2) * K + size * K * 0.06); g.textAlign = 'left';
  };
  const bar = (x, top, w, h, pct) => {
    rrect(g, x, top * K, w, h * K, (h / 2) * K); g.fillStyle = t.off; g.fill();
    if (pct > 0) { rrect(g, x, top * K, Math.max(h * K, w * pct / 100), h * K, (h / 2) * K); g.fillStyle = dot; g.fill(); }
  };
  const cover = async (book, x, top) => {
    const cw = C.w * K, ch = C.h * K;
    const img = await coverCanvas(book, Math.round(cw), Math.round(ch));
    g.save(); rrect(g, x, top * K, cw, ch, 6 * K); g.clip(); g.drawImage(img, x, top * K, cw, ch); g.restore();
  };
  g.fillStyle = t.bg; g.fillRect(0, 0, W, H);

  // logo + wordmark + date (row 20–42)
  const lw = 22 * K, lh = lw * 788 / 890, white = theme !== 'paper';
  g.save(); g.translate(P, 31 * K - lh / 2); g.scale(lw / 890, lw / 890); g.translate(-128, -86);
  [['page3', white ? 'rgba(255,255,255,0.45)' : LOGO_FLAT.page3], ['page2', white ? 'rgba(255,255,255,0.72)' : LOGO_FLAT.page2], ['book', white ? '#fff' : LOGO_FLAT.book], ['mark', white ? t.bg : LOGO_FLAT.mark]].forEach(([k, col]) => { g.fillStyle = col; g.fill(new Path2D(LOGO_PATHS[k])); });
  g.restore();
  g.font = `800 ${17 * K}px "Bricolage Grotesque", Geist, sans-serif`; g.fillStyle = t.fg; g.textBaseline = 'middle'; ls(-0.6 * K);
  g.fillText('Volapace', P + lw + 5 * K, 31.5 * K); ls(0);
  text(TODAY.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), W - P, 25, 11, 12, t.sub, 400, 'right');

  // streak number + "day / reading streak"
  const N = CARD.num;
  g.font = `600 ${N.size * K}px ${UI}`; ls(-3 * K); const num = String(s.streak); const nw = g.measureText(num).width;
  text(num, P, N.top, N.size, N.size, t.fg, 600); ls(0);
  text('day', P + nw + 10 * K, N.top + N.size - 9 - 34, 14, 17, t.sub);
  text('reading streak', P + nw + 10 * K, N.top + N.size - 9 - 17, 14, 17, t.sub);

  // week
  const colW = (W - 2 * P) / 7, d0 = CARD.week.dot;
  wk.forEach((d, i) => {
    const cx = P + colW * i + colW / 2, cy = (CARD.week.top + d0 / 2) * K;
    g.beginPath(); g.arc(cx, cy, (d0 / 2) * K, 0, Math.PI * 2); g.fillStyle = d.done ? dot : t.off; g.fill();
    if (d.done) { g.strokeStyle = theme === 'red' ? t.check : '#fff'; g.lineWidth = 2.8 * K * 0.55; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(cx - 4.6 * K, cy); g.lineTo(cx - 1.3 * K, cy + 3.3 * K); g.lineTo(cx + 5 * K, cy - 3.7 * K); g.stroke(); }
    text(d.l, cx, CARD.week.label, 9.5, 12, t.sub, 400, 'center');
  });

  // rule + label
  g.fillStyle = t.line; g.fillRect(P, CARD.rule * K, W - 2 * P, Math.max(1, K));
  text(books.length === 1 ? 'Currently reading' : `Reading ${books.length} books`, P, CARD.label, 10.5, 12, t.sub);

  // the books
  if (books.length === 1) {
    await cover(c.book, P, C.top);
    const tx = P + (C.w + 12) * K, tw = W - P - tx;
    g.font = `600 ${15 * K}px ${UI}`; g.fillStyle = t.fg; g.textBaseline = 'middle';
    wrapText(g, c.book.title, tx, (CARD.one.titleTop + 9) * K + 15 * K * 0.06, tw, 18 * K, 2);
    text(`Page ${c.page} of ${c.total}`, tx, CARD.one.pageTop, 10.5, 12, t.sub);
    text(`${c.covered} of ${c.total} pages covered`, tx, CARD.one.pctTop, 10.5, 12, t.sub);
  } else {
    const { show, more } = coverSlots(books);
    for (let i = 0; i < show.length; i++) {
      const b = show[i], x = P + i * (C.w + C.gap) * K;
      await cover(b.book, x, C.top);
      g.font = `600 ${10.5 * K}px ${UI}`; g.fillStyle = t.fg; g.textBaseline = 'middle';
      let ttl = b.book.title; const tw = (C.w + 10) * K;
      if (g.measureText(ttl).width > tw) { while (ttl.length > 1 && g.measureText(ttl + '…').width > tw) ttl = ttl.slice(0, -1); ttl += '…'; }
      g.fillText(ttl, x, (CARD.title + 6.5) * K + 10.5 * K * 0.06);
      text(`${b.covered}/${b.total} pages`, x, CARD.pct, 9.5, 12, t.sub);

    }
    if (more > 0) {
      const x = P + show.length * (C.w + C.gap) * K, cx = x + (C.w / 2) * K;
      rrect(g, x, C.top * K, C.w * K, C.h * K, 6 * K); g.fillStyle = t.off; g.fill();
      text(`+${more}`, cx, C.top + C.h / 2 - 16, 18, 20, t.fg, 600, 'center');
      text('more', cx, C.top + C.h / 2 + 4, 10, 12, t.sub, 400, 'center');
    }
  }

  // stats
  [[s.books, 'books'], [s.pages.toLocaleString(), 'pages'], [s.hours, 'hours']].forEach(([n, l], i) => {
    const x = P + i * ((W - 2 * P) / 3);
    ls(-0.4 * K); text(String(n), x, CARD.stats.num, 18, 20, t.fg, 600); ls(0);
    text(`${l} read`, x, CARD.stats.label, 10.5, 12, t.sub);
  });
  return cv;
}
const cardBlob = (cv) => new Promise(res => cv.toBlob(res, 'image/png'));

// ── Streak screen ──
function StreakScreen({ ctx, onBack }) {
  const [theme, setTheme] = React.useState(ctx.cardTheme || 'red');
  const [busy, setBusy] = React.useState('');
  const [note, setNote] = React.useState('');
  const s = lifetimeStats(ctx);
  const pick = (k) => setTheme(k);
  const flash = (m) => { setNote(m); setTimeout(() => setNote(''), 2200); };

  const save = async () => {
    setBusy('save');
    try {
      const blob = await cardBlob(await drawStreakCard(ctx, theme));
      const ok = await Platform.saveFile(`volapace-streak-${s.streak}.png`, 'image/png', await blobToB64(blob));
      if (ok) flash('Image saved');
    } catch (e) { flash('Couldn’t create the image'); }
    setBusy('');
  };
  const share = async () => {
    setBusy('share');
    try {
      const blob = await cardBlob(await drawStreakCard(ctx, theme));
      await Platform.shareFile(`volapace-streak-${s.streak}.png`, 'image/png', await blobToB64(blob), `${s.streak}-day reading streak on Volapace`);
    } catch (e) { flash('Couldn’t create the image'); }
    setBusy('');
  };

  return (
    <div style={{ minHeight: '100%', padding: 'calc(var(--sat) + 8px) 22px calc(var(--sab) + 20px)', boxSizing: 'border-box', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <IconBtn name="arrowLeft" size={40} onClick={onBack} />
        <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>Your streak</span>
        <div style={{ width: 40 }} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <div key={theme} style={{ animation: 'pop .3s cubic-bezier(.2,1.1,.4,1)', boxShadow: 'var(--shadow-float)', borderRadius: 22 }}>
          <StreakCardView ctx={ctx} theme={theme} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
        {Object.entries(CARD_THEMES).map(([k, t]) => (
          <button key={k} onClick={() => pick(k)} title={t.label} style={{ width: 34, height: 34, borderRadius: 999, cursor: 'pointer', background: t.bg, border: '1px solid var(--line)', boxShadow: theme === k ? '0 0 0 2px var(--cream), 0 0 0 4px var(--ink)' : 'none', transition: 'box-shadow .15s' }} />
        ))}
      </div>


      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ padding: 14, borderRadius: 16, background: 'var(--fill)' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 22, color: 'var(--ink)', letterSpacing: -0.5 }}>{s.longest} days</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2 }}>Longest streak</div>
        </div>
        <div style={{ padding: 14, borderRadius: 16, background: 'var(--fill)' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 22, color: 'var(--ink)', letterSpacing: -0.5 }}>{s.streak >= s.longest ? 'Record' : `${s.longest - s.streak} to go`}</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2 }}>{s.streak >= s.longest ? 'You\u2019re at your best' : 'To beat your record'}</div>
        </div>
      </div>

      </div>

      {/* actions within thumb reach */}
      <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 12 }}>
        <Button variant="soft" icon="upload" style={{ flex: 1 }} onClick={save} disabled={!!busy}>{busy === 'save' ? 'Saving\u2026' : 'Save image'}</Button>
        <Button icon="share" style={{ flex: 1 }} onClick={share} disabled={!!busy}>{busy === 'share' ? 'Preparing\u2026' : 'Share'}</Button>
      </div>

      {note && <div style={{ position: 'absolute', left: '50%', bottom: 'calc(var(--sab) + 84px)', transform: 'translateX(-50%)', padding: '10px 16px', borderRadius: 999, background: 'var(--ink)', color: 'var(--cream)', fontFamily: 'var(--font-ui)', fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap', animation: 'fadeUp .25s' }}>{note}</div>}
    </div>
  );
}

Object.assign(window, { StreakScreen, StreakCardView, drawStreakCard });
