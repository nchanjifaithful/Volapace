// screens2.jsx — Pace Configurator + The Plan

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
// TODAY comes from platform.jsx (the real local date).

function addReadingDays(start, n, skipSundays) {
  const d = new Date(start); let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    if (skipSundays && d.getDay() === 0) continue;
    added++;
  }
  return d;
}
const fmtDate = (d) => `${WDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;

// ── Screen 3: Pace Configurator ─────────────────────────────
const MODES = {
  sprinter: { label: 'Sprinter', days: 4, desc: 'Finish in a few intense sittings', icon: 'flame' },
  casual:   { label: 'Casual',   days: 14, desc: 'A relaxed couple of weeks', icon: 'clock' },
  scholar:  { label: 'Scholar',  days: 30, desc: 'Small daily increments, deep notes', icon: 'sparkle' },
};

function readingDaysUntil(target, skipSundays) {
  let n = 0; const d = new Date(TODAY);
  while (d < target && n < 400) { d.setDate(d.getDate() + 1); if (skipSundays && d.getDay() === 0) continue; n++; }
  return Math.max(1, n);
}
const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmt12 = (hm) => { const [h, m] = hm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };

function NumField({ value, onChange, min, max, suffix }) {
  const [txt, setTxt] = React.useState(String(value));
  React.useEffect(() => setTxt(String(value)), [value]);
  const commit = (v) => { const n = Math.max(min, Math.min(max, parseInt(v) || min)); onChange(n); setTxt(String(n)); };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Stepper label={'\u2212'} onClick={() => commit(value - 1)} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, height: 56, borderRadius: 14, border: '1.5px solid var(--ink)', background: 'var(--surface)', padding: '0 12px' }}>
        <input inputMode="numeric" value={txt} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setTxt(v); if (v) onChange(Math.max(min, Math.min(max, +v))); }} onBlur={e => commit(e.target.value)}
          style={{ width: 70, textAlign: 'right', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 30, color: 'var(--ink)', letterSpacing: -1, height: 54, fontVariantNumeric: 'tabular-nums' }} />
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 15, color: 'var(--ink-2)' }}>{suffix}</span>
      </div>
      <Stepper label="+" onClick={() => commit(value + 1)} />
    </div>
  );
}

function PaceScreen({ go, back, ctx, openModal, closeModal }) {
  const total = ctx.pages || 1;
  const [startP, setStartP] = React.useState(1);
  const [endP, setEndP] = React.useState(total);
  const [extra, setExtra] = React.useState([]);
  const locked = React.useMemo(() => { const s = new Set(); for (let p = 1; p < startP; p++) s.add(p); for (let p = endP + 1; p <= total; p++) s.add(p); return s; }, [startP, endP, total]);
  const skip = React.useMemo(() => [...new Set([...locked, ...extra])].sort((a, b) => a - b), [locked, extra]);
  const pages = Math.max(1, total - skip.length);
  const openPicker = () => openModal(<PagePicker total={total} initial={extra.filter(p => !locked.has(p))} locked={locked} onDone={setExtra} close={closeModal} />);
  const [mode, setMode] = React.useState('casual');
  const [basis, setBasis] = React.useState('deadline');
  const [days, setDays] = React.useState(14);
  const [ppd, setPpd] = React.useState(16);
  const [mins, setMins] = React.useState(20);
  const [remindOn, setRemindOn] = React.useState(() => ctx.notify ? !!ctx.notify.on : true);
  const [time, setTime] = React.useState(() => (ctx.notify && ctx.notify.time) || '20:00');
  const [catchUp, setCatchUp] = React.useState(true);

  const pickMode = (m) => { setMode(m); const d = MODES[m].days; setDays(d); setPpd(Math.ceil(pages / d)); setBasis('deadline'); };
  const timePpd = Math.max(1, Math.round(mins * PAGES_PER_HOUR / 60));
  const effDays = basis === 'deadline' ? days : basis === 'time' ? Math.max(1, Math.ceil(pages / timePpd)) : Math.max(1, Math.ceil(pages / ppd));
  const effPpd = basis === 'deadline' ? Math.ceil(pages / days) : basis === 'time' ? timePpd : ppd;
  const finish = addReadingDays(TODAY, effDays, catchUp);
  const setD = (v) => { setDays(v); setMode('custom'); };
  const setP = (v) => { setPpd(v); setMode('custom'); };
  const setM = (v) => { setMins(v); setMode('custom'); };
  const onDate = (v) => { if (!v) return; const [y, m, d] = v.split('-').map(Number); setD(Math.min(365, readingDaysUntil(new Date(y, m - 1, d), catchUp))); };

  const sliderVal = basis === 'deadline' ? days : basis === 'time' ? mins : ppd;
  const sliderMin = basis === 'time' ? 5 : 1;
  const sliderMax = basis === 'deadline' ? 90 : basis === 'time' ? 120 : 100;
  const pct = ((Math.min(sliderVal, sliderMax) - sliderMin) / (sliderMax - sliderMin)) * 100;
  const label = { fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 13.5, color: 'var(--ink-2)', marginBottom: 8 };

  return (
    <div style={{ minHeight: '100%', padding: 'calc(var(--sat) + 16px) 22px calc(var(--sab) + 36px)', boxSizing: 'border-box' }}>
      <button onClick={back} style={backBtn}><Icon name="arrowLeft" size={21} /></button>

      <div style={{ marginTop: 18, marginBottom: 22 }}>
        <Eyebrow style={{ marginBottom: 4 }}>Step 2 of 2</Eyebrow>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 30, color: 'var(--ink)', margin: 0, lineHeight: 1.1, letterSpacing: -0.6 }}>Choose your pace</h1>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 15, color: 'var(--ink-2)', margin: '6px 0 0' }}>{ctx.title || 'Your book'} &middot; {total} pages</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
        {Object.entries(MODES).map(([k, m]) => {
          const on = mode === k;
          return (
            <button key={k} onClick={() => pickMode(k)} style={{ flex: 1, padding: '14px 10px', borderRadius: 16, cursor: 'pointer', textAlign: 'left',
              background: on ? 'var(--ink)' : 'var(--fill)', color: on ? 'var(--cream)' : 'var(--ink)', border: on ? '1px solid var(--ink)' : '1px solid var(--line)', transition: 'all .15s' }}>
              <Icon name={m.icon} size={20} />
              <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 15, marginTop: 10 }}>{m.label}</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, opacity: 0.7, marginTop: 1 }}>{m.days} days</div>
            </button>
          );
        })}
      </div>

      <div style={{ padding: 18, borderRadius: 'var(--card-radius)', border: '1px solid var(--line)', marginBottom: 12 }}>
        <div style={{ display: 'flex', padding: 3, borderRadius: 999, background: 'var(--fill)', marginBottom: 18 }}>
          {[['deadline', 'Deadline'], ['effort', 'Pages a day'], ['time', 'Time a day']].map(([k, l]) => (
            <button key={k} onClick={() => setBasis(k)} style={{ flex: 1, height: 36, borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: basis === k ? 600 : 500, fontSize: 14,
              background: basis === k ? 'var(--ink)' : 'transparent', color: basis === k ? 'var(--cream)' : 'var(--ink-2)', transition: 'all .15s' }}>{l}</button>
          ))}
        </div>

        {basis === 'time' ? (
          <>
            <div style={label}>Read each day for</div>
            <NumField value={mins} onChange={setM} min={5} max={240} suffix="min" />
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-2)', marginTop: 10, lineHeight: 1.4 }}>About {timePpd} pages at your usual {PAGES_PER_HOUR} pages an hour. The reader times your sessions and ticks the day off when you hit {mins} minutes.</div>
          </>
        ) : basis === 'deadline' ? (
          <>
            <div style={label}>Finish in</div>
            <NumField value={days} onChange={setD} min={1} max={365} suffix={days === 1 ? 'day' : 'days'} />
            <div style={{ ...label, marginTop: 16 }}>Or finish by date</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, height: 50, padding: '0 14px', borderRadius: 14, background: 'var(--fill)', border: '1px solid var(--line)', cursor: 'pointer' }}>
              <Icon name="calendar" size={19} style={{ color: 'var(--ink-2)' }} />
              <input type="date" value={isoDate(finish)} min={isoDate(addReadingDays(TODAY, 1, false))} onChange={e => onDate(e.target.value)}
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 15.5, color: 'var(--ink)', colorScheme: 'light dark' }} />
            </label>
          </>
        ) : (
          <>
            <div style={label}>Read each day</div>
            <NumField value={ppd} onChange={setP} min={1} max={pages} suffix="pages" />
          </>
        )}

        <div style={{ position: 'relative', height: 30, display: 'flex', alignItems: 'center', marginTop: 16 }}>
          <div style={{ position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 999, background: 'var(--track-off)' }} />
          <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 4, borderRadius: 999, background: 'var(--ink)' }} />
          <input type="range" min={sliderMin} max={sliderMax} value={Math.min(sliderVal, sliderMax)} onChange={e => basis === 'deadline' ? setD(+e.target.value) : basis === 'time' ? setM(+e.target.value) : setP(+e.target.value)}
            className="vol-slider" style={{ position: 'absolute', left: 0, right: 0, width: '100%', margin: 0 }} />
        </div>
      </div>

      <div style={{ padding: 18, borderRadius: 'var(--card-radius)', border: '1px solid var(--line)', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 15.5, color: 'var(--ink)' }}>Reading pages</span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-2)' }}>{pages} of {total} &middot; {skip.length} skipped</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <PageBound label="Book starts on" value={startP} onChange={v => setStartP(Math.min(v, endP))} min={1} max={total} />
          <PageBound label="Book ends on" value={endP} onChange={v => setEndP(Math.max(v, startP))} min={1} max={total} />
        </div>
        <button onClick={openPicker} style={{ width: '100%', marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, height: 50, padding: '0 14px', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--fill)', cursor: 'pointer', textAlign: 'left' }}>
          <Icon name="grid" size={18} style={{ color: 'var(--ink-2)' }} />
          <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-ui)', fontSize: 14.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {extra.filter(p => !locked.has(p)).length ? `Also skipping ${compactRanges(extra.filter(p => !locked.has(p))).join(', ')}` : 'Skip other pages'}
          </span>
          <Icon name="chevronRight" size={18} style={{ color: 'var(--ink-3)' }} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 18, borderRadius: 'var(--card-radius)', background: 'var(--sage)', color: '#fff', marginBottom: 12 }}>
        <Icon name="target" size={24} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, opacity: 0.85 }}>{basis === 'time' ? `${mins} min (~${effPpd} pages) a day` : `${effPpd} pages a day`} &middot; {effDays} reading days</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 19, marginTop: 2, letterSpacing: -0.3 }}>Done by {fmtDate(finish)}</div>
        </div>
      </div>

      <div style={{ borderRadius: 'var(--card-radius)', border: '1px solid var(--line)', marginBottom: 22 }}>
        <OptionRow icon="bell" title="Reminder" sub={remindOn ? `Daily at ${fmt12(time)}` : 'Off'} control={<Toggle on={remindOn} onChange={setRemindOn} />} />
        {remindOn && (
          <div style={{ padding: '0 16px 14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, height: 50, padding: '0 14px', borderRadius: 14, background: 'var(--fill)', border: '1px solid var(--line)', cursor: 'pointer' }}>
              <Icon name="clock" size={19} style={{ color: 'var(--ink-2)' }} />
              <input type="time" value={time} onChange={e => e.target.value && setTime(e.target.value)}
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 15.5, color: 'var(--ink)', colorScheme: 'light dark' }} />
            </label>
          </div>
        )}
        <div style={{ height: 1, background: 'var(--line)', margin: '0 16px' }} />
        <OptionRow icon="refresh" title="Catch-up days" sub="Keep Sundays free as a buffer" control={<Toggle on={catchUp} onChange={setCatchUp} />} last />
      </div>

      <Button full icon="arrowRight" onClick={() => go('book', { pages: total, skip, doneDays: 0, page: startP, goalType: basis === 'time' ? 'time' : 'pages', minutes: mins, highlights: ctx.highlights || [], bookmarks: ctx.bookmarks || [], days: effDays, ppd: effPpd, mode: mode === 'custom' ? 'Custom' : MODES[mode].label, time: fmt12(time), remindOn, catchUp, planStart: 0, planVer: (ctx.planVer || 0) + 1, planDays: null, finishedAt: null, notify: { rescue: true, ...(ctx.notify || {}), on: remindOn, time } })}>
        Build my plan
      </Button>
    </div>
  );
}

function PageBound({ label, value, onChange, min, max }) {
  const [txt, setTxt] = React.useState(String(value));
  React.useEffect(() => setTxt(String(value)), [value]);
  const commit = (v) => { const n = Math.max(min, Math.min(max, parseInt(v) || min)); onChange(n); setTxt(String(n)); };
  return (
    <label style={{ display: 'block', padding: '10px 12px', borderRadius: 14, background: 'var(--fill)', border: '1px solid var(--line)' }}>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-2)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--ink-3)' }}>p.</span>
        <input inputMode="numeric" value={txt} onChange={e => setTxt(e.target.value.replace(/\D/g, ''))} onBlur={e => commit(e.target.value)} onKeyDown={e => e.key === 'Enter' && e.target.blur()}
          style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 20, color: 'var(--ink)', padding: 0 }} />
      </div>
    </label>
  );
}

function OptionRow({ icon, title, sub, control, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', borderBottom: last ? 'none' : undefined }}>
      <div style={{ width: 38, height: 38, borderRadius: 999, background: 'var(--fill)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={20} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 15.5, color: 'var(--ink)' }}>{title}</div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-2)', marginTop: 1 }}>{sub}</div>
      </div>
      {control}
    </div>
  );
}

const backBtn = { width: 40, height: 40, borderRadius: 999, background: 'var(--surface)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)', cursor: 'pointer' };

Object.assign(window, { NumField, PaceScreen, addReadingDays, fmtDate });
