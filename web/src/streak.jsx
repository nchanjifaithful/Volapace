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

// ── DOM preview (320 × 400, same layout as the 1080 × 1350 export) ──
function StreakCardView({ ctx, theme }) {
  const t = CARD_THEMES[theme], s = lifetimeStats(ctx), c = currentBook(ctx), wk = weekDays(ctx);
  const pct = Math.round((c.page / c.total) * 100);
  const dot = t.accent || t.fg;
  return (
    <div data-om-raster="true" style={{ width: 320, height: 400, borderRadius: 22, background: t.bg, color: t.fg, padding: 22, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-ui)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'var(--font-brand)', fontWeight: 800, fontSize: 17, letterSpacing: -0.6 }}>Volapace</span>
        <span style={{ fontSize: 11, color: t.sub }}>{TODAY.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      </div>
      <div style={{ marginTop: 18, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 88, lineHeight: 0.85, letterSpacing: -4 }}>{s.streak}</span>
        <span style={{ fontSize: 15, lineHeight: 1.2, paddingBottom: 4, color: t.sub }}>day<br />reading streak</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginTop: 18 }}>
        {wk.map((d, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 28, height: 28, borderRadius: 999, background: d.done ? dot : t.off, color: theme === 'red' ? t.check : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {d.done && <Icon name="check" size={14} stroke={2.8} />}
            </div>
            <span style={{ fontSize: 10, color: t.sub }}>{d.l}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 'auto', paddingTop: 14, borderTop: `1px solid ${t.line}` }}>
        <BookCover book={c.book} w={46} radius={5} style={{ boxShadow: 'none' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, color: t.sub }}>Currently reading</div>
          <div style={{ fontWeight: 600, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{c.book.title}</div>
          <div style={{ height: 4, borderRadius: 999, background: t.off, marginTop: 7, overflow: 'hidden' }}><div style={{ width: pct + '%', height: '100%', background: dot, borderRadius: 999 }} /></div>
          <div style={{ fontSize: 10.5, color: t.sub, marginTop: 5 }}>{pct}% &middot; Page {Math.max(1, c.page)} of {c.total}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 14 }}>
        {[[s.books, 'books'], [s.pages.toLocaleString(), 'pages'], [s.hours, 'hours']].map(([n, l]) => (
          <div key={l}><div style={{ fontWeight: 600, fontSize: 20, letterSpacing: -0.5 }}>{n}</div><div style={{ fontSize: 10.5, color: t.sub }}>{l} read</div></div>
        ))}
      </div>
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
  const cv = book.cover, gr = g.createLinearGradient(0, 0, w * 0.6, h);
  gr.addColorStop(0, cv.bg[0]); gr.addColorStop(1, cv.bg[1]); g.fillStyle = gr; g.fillRect(0, 0, w, h);
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
  const t = CARD_THEMES[theme], s = lifetimeStats(ctx), cb = currentBook(ctx), wk = weekDays(ctx);
  const K = 1080 / 320, W = 1080, H = 1350, P = 22 * K;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const UI = 'Geist, -apple-system, system-ui, sans-serif', dot = t.accent || t.fg;
  g.fillStyle = t.bg; g.fillRect(0, 0, W, H);
  g.textBaseline = 'alphabetic';
  g.fillStyle = t.fg; g.font = `800 ${17 * K}px "Bricolage Grotesque", Geist, sans-serif`; if ('letterSpacing' in g) g.letterSpacing = `${-0.6 * K}px`; g.fillText('Volapace', P, P + 16 * K); if ('letterSpacing' in g) g.letterSpacing = '0px';
  g.fillStyle = t.sub; g.font = `${11 * K}px ${UI}`; g.textAlign = 'right';
  g.fillText(TODAY.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), W - P, P + 16 * K); g.textAlign = 'left';
  // streak number
  g.fillStyle = t.fg; g.font = `600 ${88 * K}px ${UI}`; const num = String(s.streak);
  if ('letterSpacing' in g) g.letterSpacing = `${-4 * K}px`;
  const base = P + 40 * K + 74 * K; g.fillText(num, P, base); const nw = g.measureText(num).width;
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  g.fillStyle = t.sub; g.font = `${15 * K}px ${UI}`; g.fillText('day', P + nw + 12 * K, base - 22 * K); g.fillText('reading streak', P + nw + 12 * K, base - 4 * K);
  // week
  const colW = (W - 2 * P) / 7, wy = base + 32 * K;
  wk.forEach((d, i) => {
    const cx = P + colW * i + colW / 2;
    g.beginPath(); g.arc(cx, wy, 14 * K, 0, Math.PI * 2); g.fillStyle = d.done ? dot : t.off; g.fill();
    if (d.done) { g.strokeStyle = theme === 'red' ? t.check : '#fff'; g.lineWidth = 2.8 * K * 0.64; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(cx - 5.5 * K, wy); g.lineTo(cx - 1.5 * K, wy + 4 * K); g.lineTo(cx + 6 * K, wy - 4.5 * K); g.stroke(); }
    g.fillStyle = t.sub; g.font = `${10 * K}px ${UI}`; g.textAlign = 'center'; g.fillText(d.l, cx, wy + 28 * K); g.textAlign = 'left';
  });
  // stats row (bottom)
  const sy = H - P;
  [[s.books, 'books'], [s.pages.toLocaleString(), 'pages'], [s.hours, 'hours']].forEach(([n, l], i) => {
    const x = P + i * ((W - 2 * P) / 3);
    g.fillStyle = t.fg; g.font = `600 ${20 * K}px ${UI}`; g.fillText(String(n), x, sy - 16 * K);
    g.fillStyle = t.sub; g.font = `${10.5 * K}px ${UI}`; g.fillText(`${l} read`, x, sy);
  });
  // book block
  const bh = 69 * K, by = sy - 36 * K - 14 * K - bh;
  g.fillStyle = t.line; g.fillRect(P, by - 14 * K, W - 2 * P, Math.max(1, K * 0.6));
  const cw = 46 * K, ch = 69 * K;
  const cover = await coverCanvas(cb.book, Math.round(cw), Math.round(ch));
  g.save(); rrect(g, P, by, cw, ch, 5 * K); g.clip(); g.drawImage(cover, P, by, cw, ch); g.restore();
  const tx = P + cw + 12 * K, tw = W - P - tx, pct = Math.round((cb.page / cb.total) * 100);
  g.fillStyle = t.sub; g.font = `${10.5 * K}px ${UI}`; g.fillText('Currently reading', tx, by + 16 * K);
  g.fillStyle = t.fg; g.font = `600 ${14.5 * K}px ${UI}`; wrapText(g, cb.book.title, tx, by + 34 * K, tw, 18 * K, 1);
  rrect(g, tx, by + 43 * K, tw, 4 * K, 2 * K); g.fillStyle = t.off; g.fill();
  if (pct > 0) { rrect(g, tx, by + 43 * K, Math.max(4 * K, tw * pct / 100), 4 * K, 2 * K); g.fillStyle = dot; g.fill(); }
  g.fillStyle = t.sub; g.font = `${10.5 * K}px ${UI}`; g.fillText(`${pct}% \u00b7 Page ${Math.max(1, cb.page)} of ${cb.total}`, tx, by + 62 * K);
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
    <div style={{ minHeight: '100%', padding: 'calc(var(--sat) + 8px) 22px calc(var(--sab) + 40px)', boxSizing: 'border-box', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <IconBtn name="arrowLeft" size={40} onClick={onBack} />
        <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>Your streak</span>
        <div style={{ width: 40 }} />
      </div>

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

      <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
        <Button variant="soft" icon="upload" style={{ flex: 1 }} onClick={save} disabled={!!busy}>{busy === 'save' ? 'Saving\u2026' : 'Save image'}</Button>
        <Button icon="share" style={{ flex: 1 }} onClick={share} disabled={!!busy}>{busy === 'share' ? 'Preparing\u2026' : 'Share'}</Button>
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

      {note && <div style={{ position: 'absolute', left: '50%', bottom: 46, transform: 'translateX(-50%)', padding: '10px 16px', borderRadius: 999, background: 'var(--ink)', color: 'var(--cream)', fontFamily: 'var(--font-ui)', fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap', animation: 'fadeUp .25s' }}>{note}</div>}
    </div>
  );
}

Object.assign(window, { StreakScreen, StreakCardView, drawStreakCard });
