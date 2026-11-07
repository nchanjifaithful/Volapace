// screens1.jsx — Add a book (PDF / paper)

function ScanOverlay({ w }) {
  const bracket = (pos) => (
    <div style={{ position: 'absolute', width: 22, height: 22, ...pos,
      borderColor: '#fff', borderStyle: 'solid' }} />
  );
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* sweeping laser */}
      <div className="laser" style={{
        position: 'absolute', left: 0, right: 0, height: 3,
        background: 'var(--sage)',
      }}>
        
      </div>
      {/* corner brackets */}
      {bracket({ top: 8, left: 8, borderWidth: '3px 0 0 3px', borderRadius: '6px 0 0 0' })}
      {bracket({ top: 8, right: 8, borderWidth: '3px 3px 0 0', borderRadius: '0 6px 0 0' })}
      {bracket({ bottom: 8, left: 8, borderWidth: '0 0 3px 3px', borderRadius: '0 0 0 6px' })}
      {bracket({ bottom: 8, right: 8, borderWidth: '0 3px 3px 0', borderRadius: '0 0 6px 0' })}
    </div>
  );
}

// ── Screen 1: Add a book ────────────────────────────────────
function UploadScreen({ go, startBook, openBook, onClose }) {
  const mine = useLib();
  const recent = [...mine].sort((a, b) => (b.lastOpened || b.addedAt || 0) - (a.lastOpened || a.addedAt || 0));
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');

  const choose = async () => {
    if (busy) return;
    setErr(''); setBusy(true);
    try {
      const r = await PdfStore.importPicked();
      if (!r) { setBusy(false); return; }
      const e = r.entry;
      if (e.snap && e.snap.days) { openBook(e); return; } // already in the library with a plan
      startBook({ pages: r.doc.numPages, title: e.title, author: e.author || '', hasPdf: true, bookId: e.id, page: 1, doneDays: 0 });
    } catch (e) { setErr('Couldn’t open that PDF.'); setBusy(false); }
  };

  return (
    <div style={{ minHeight: '100%', padding: 'calc(var(--sat) + 12px) 22px calc(var(--sab) + 40px)', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 34 }}>
        {onClose ? <IconBtn name="arrowLeft" size={40} onClick={onClose} /> : <span style={{ fontFamily: 'var(--font-brand)', fontWeight: 800, fontSize: 27, color: 'var(--ink)', letterSpacing: -1 }}>Volapace</span>}
        {onClose ? <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>Add a book</span> : null}
        <IconBtn name="user" size={40} onClick={() => go('you')} />
      </div>

      <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 34, lineHeight: 1.08, color: 'var(--ink)', margin: '0 0 8px', letterSpacing: -0.8 }}>What are you<br/>reading next?</h1>
      <p style={{ fontFamily: 'var(--font-ui)', fontSize: 15, color: 'var(--ink-2)', margin: '0 0 24px', lineHeight: 1.4 }}>Add a PDF from your phone. It stays on this device, works offline, and opens right where you left off.</p>

      <div onClick={choose}
        style={{ borderRadius: 'var(--card-radius)', padding: '38px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: 12,
          border: '1.5px dashed var(--dash)', background: 'var(--fill)', transition: 'all .15s' }}>
        <div style={{ width: 56, height: 56, borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          {busy ? <div className="spin" style={{ width: 22, height: 22, borderRadius: 999, border: '2.5px solid var(--fill-2)', borderTopColor: 'var(--sage)' }} /> : <Icon name="upload" size={26} />}
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 17, color: 'var(--ink)' }}>{busy ? 'Opening your book…' : 'Pick a PDF'}</div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: err ? 'var(--sage)' : 'var(--ink-2)', marginTop: 3 }}>{err || 'from Downloads, Drive or any folder'}</div>
      </div>

      <Button full icon="upload" onClick={choose} disabled={busy}>Choose a PDF</Button>
      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <Button variant="soft" icon="book" style={{ flex: 1, fontSize: 14.5 }} onClick={() => go('scan')}>Add a paper book</Button>
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-3)', marginTop: 14, lineHeight: 1.45, textAlign: 'center' }}>
        PDFs you copy into <b style={{ fontWeight: 600, color: 'var(--ink-2)' }}>{Platform.folderLabel()}</b> show up here automatically.
      </div>

      {recent.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <SectionHead title="On this phone" action={`${recent.length} book${recent.length === 1 ? '' : 's'}`} onAction={() => go('library')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recent.slice(0, 4).map(e => {
              const b = entryBook(e);
              return <ProgressCard key={e.id} book={b} page={b.page} total={b.pages} onClick={() => openBook(e)} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Screen 2: Paper book ────────────────────────────────────
// The prototype simulated an AI cover scan. There is no on-device recogniser in this build,
// so paper books are entered by hand and tracked by logging pages on Today.
function ScanScreen({ back, startBook }) {
  const [title, setTitle] = React.useState('');
  const [author, setAuthor] = React.useState('');
  const [pages, setPages] = React.useState(0);
  const ok = title.trim().length > 0 && pages > 0;
  const field = (label, value, set, props = {}) => (
    <label style={{ display: 'block', padding: '10px 14px', borderRadius: 14, background: 'var(--fill)', border: '1px solid var(--line)' }}>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-2)' }}>{label}</div>
      <input value={value} onChange={e => set(e.target.value)} {...props}
        style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', padding: '3px 0 0', fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 16, color: 'var(--ink)' }} />
    </label>
  );
  const add = () => {
    const id = 'p' + Date.now().toString(36);
    const t = title.trim(), a = author.trim();
    Lib.upsert({ id, paper: true, title: t, author: a, pages, addedAt: Date.now() });
    startBook({ pages, title: t, author: a, hasPdf: false, bookId: id, page: 1, doneDays: 0, fromScan: true });
  };

  return (
    <div style={{ minHeight: '100%', padding: 'calc(var(--sat) + 8px) 22px calc(var(--sab) + 40px)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <IconBtn name="arrowLeft" size={40} onClick={back} />
        <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>Paper book</span>
        <div style={{ width: 40 }} />
      </div>

      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <Eyebrow style={{ marginBottom: 4 }}>Reading a printed copy?</Eyebrow>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 28, color: 'var(--ink)', margin: 0, letterSpacing: -0.6 }}>Tell us about it</h1>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
        <BookCover book={{ title: title.trim() || 'Your book', author: author.trim(), paper: true }} w={132} radius={10} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        {field('Title', title, setTitle, { placeholder: 'Book title', autoCapitalize: 'words' })}
        {field('Author (optional)', author, setAuthor, { placeholder: 'Author', autoCapitalize: 'words' })}
      </div>

      <Card pad={16} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>Total pages</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-3)', marginTop: 1 }}>The last numbered page</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Stepper label={'−'} onClick={() => setPages(p => Math.max(0, p - 1))} />
          <input inputMode="numeric" value={pages || ''} placeholder="0" onChange={e => setPages(Math.min(9999, Math.max(0, parseInt(e.target.value.replace(/\D/g, '') || '0'))))}
            style={{ width: 64, textAlign: 'center', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 19, color: 'var(--ink)', background: 'var(--fill)', border: '1px solid var(--line)', borderRadius: 12, height: 44, outline: 'none' }} />
          <Stepper label="+" onClick={() => setPages(p => p + 1)} />
        </div>
      </Card>

      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-2)', textAlign: 'center', marginBottom: 12, lineHeight: 1.4 }}>Paper books are tracked by logging pages on Today.</div>
      <Button full icon="arrowRight" disabled={!ok} onClick={add}>Set my reading pace</Button>
    </div>
  );
}

function Stepper({ label, onClick }) {
  return (
    <button onClick={onClick} style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 999, border: '1px solid var(--line)', background: 'var(--fill)', color: 'var(--ink)', fontFamily: 'var(--font-ui)', fontSize: 22, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{label}</button>
  );
}

Object.assign(window, { UploadScreen, ScanScreen, Stepper });
