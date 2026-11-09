// onboarding.jsx — splash, intro, reminders & rest days, plan summary, welcome animation.
// Flow for a new book: Upload → Pace → Reminders → Summary → Welcome → Plan.

const RED = '#D90429';

// ── Splash: matches the Android launch screen (red, white mark), then fades into the app ──
function AppSplash({ onDone }) {
  const [out, setOut] = React.useState(false);
  React.useEffect(() => {
    const a = setTimeout(() => setOut(true), 900), b = setTimeout(onDone, 1250);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: RED, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
      opacity: out ? 0 : 1, transition: 'opacity .35s ease' }}>
      <div style={{ animation: 'splashIn .6s cubic-bezier(.2,.9,.25,1.15) both' }}><VolapaceLogo size={112} variant="white" bookmark={RED} /></div>
      <div style={{ fontFamily: 'var(--font-brand)', fontWeight: 800, fontSize: 34, color: '#fff', letterSpacing: -1.3, animation: 'fadeUpIn .5s .2s cubic-bezier(.2,.8,.2,1) both' }}>Volapace</div>
    </div>
  );
}

// ── Intro: what Volapace is, before "What are you reading next?" ──
// Same visual language as the rest of the app: white page, ink type, bordered cards, red as the accent.
const INTRO = [
  { k: 'plan', eyebrow: 'Welcome to Volapace', title: 'Finish the books you start', body: 'Volapace turns any PDF or paper book into a few pages a day, so big books feel small.' },
  { k: 'pace', eyebrow: 'Your pace', title: 'A plan that fits your days', body: 'Pick a finish date, pages a day or minutes a day. Miss a day and the plan quietly adjusts.' },
  { k: 'private', eyebrow: 'Private', title: 'Yours, on this phone', body: 'Your books, notes, streaks and progress stay on your device. No account, no ads, no tracking.' },
];

function IntroArt({ k }) {
  const card = { background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--line)' };
  if (k === 'plan') return <div style={{ animation: 'floaty 4s ease-in-out infinite' }}><VolapaceLogo size={150} /></div>;
  if (k === 'pace') return (
    <div style={{ width: 260, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[['Today', '1–15', true], ['Tomorrow', '16–30', false], ['Monday', '31–45', false]].map(([d, p, on], i) => (
        <div key={i} style={{ ...card, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, animation: `fadeUpIn .5s ${0.1 + i * 0.12}s both`, border: on ? '1.5px solid var(--ink)' : card.border }}>
          <div style={{ width: 30, height: 30, borderRadius: 999, background: on ? 'var(--sage)' : 'var(--fill)', color: on ? '#fff' : 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13 }}>{on ? <Icon name="check" size={16} stroke={2.6} /> : i + 1}</div>
          <div style={{ flex: 1, fontFamily: 'var(--font-ui)' }}>
            <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>{d}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>Pages {p}</div>
          </div>
          <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 12.5, color: on ? 'var(--sage)' : 'var(--ink-3)' }}>15 pages</span>
        </div>
      ))}
    </div>
  );
  return (
    <div style={{ ...card, width: 240, padding: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 58, height: 58, borderRadius: 999, background: 'var(--sage-soft)', color: 'var(--sage)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="10.5" width="14" height="9.5" rx="2.4" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></svg>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>{['Books', 'Notes', 'Streaks'].map(t => <span key={t} style={{ padding: '5px 11px', borderRadius: 999, background: 'var(--fill)', border: '1px solid var(--line)', fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>{t}</span>)}</div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-2)' }}>Stored only on this phone</div>
    </div>
  );
}

function IntroScreen({ onDone }) {
  const [i, setI] = React.useState(0);
  const sx = React.useRef(null);
  const last = i === INTRO.length - 1;
  const next = () => (last ? onDone() : setI(i + 1));
  const s = INTRO[i];
  return (
    <div onPointerDown={e => { sx.current = e.clientX; }} onPointerUp={e => { if (sx.current == null) return; const d = e.clientX - sx.current; sx.current = null; if (d < -50 && !last) setI(i + 1); if (d > 50 && i > 0) setI(i - 1); }}
      style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', padding: 'calc(var(--sat) + 12px) 22px calc(var(--sab) + 28px)', boxSizing: 'border-box', touchAction: 'pan-y', background: 'var(--cream)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 }}>
        <Brand logo={30} size={26} />
        {!last && <button onClick={onDone} style={{ background: 'none', border: 'none', color: 'var(--ink-2)', fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 15, cursor: 'pointer', padding: 8 }}>Skip</button>}
      </div>
      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', animation: 'introIn .4s cubic-bezier(.2,.8,.2,1) both' }}>
        <div style={{ display: 'flex', justifyContent: 'center', minHeight: 230, alignItems: 'center', marginBottom: 30 }}><IntroArt k={s.k} /></div>
        <Eyebrow style={{ marginBottom: 6 }}>{s.eyebrow}</Eyebrow>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 34, lineHeight: 1.08, color: 'var(--ink)', margin: '0 0 10px', letterSpacing: -0.8 }}>{s.title}</h1>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 15, lineHeight: 1.4, margin: 0, color: 'var(--ink-2)' }}>{s.body}</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 7, margin: '22px 0 18px' }}>{INTRO.map((_, k) => <button key={k} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} style={{ width: k === i ? 22 : 8, height: 8, borderRadius: 999, border: 'none', padding: 0, background: k === i ? 'var(--ink)' : 'var(--fill-2)', transition: 'all .25s', cursor: 'pointer' }} />)}</div>
      <Button full icon={last ? 'arrowRight' : null} onClick={next}>{last ? 'Get started' : 'Next'}</Button>
    </div>
  );
}

// ── Hello: your name and what kind of reader you are (after the intro) ──
const READER_TYPES = [
  { k: 'first', label: 'First-timer', sub: 'Building a reading habit', icon: 'sparkle', mode: 'scholar' },
  { k: 'casual', label: 'Casual reader', sub: 'A book now and then', icon: 'clock', mode: 'casual' },
  { k: 'avid', label: 'Avid reader', sub: 'Always mid-book', icon: 'flame', mode: 'sprinter' },
  { k: 'student', label: 'Student / researcher', sub: 'Papers, guides and set texts', icon: 'pages', mode: 'casual' },
];
function HelloScreen({ account = {}, onDone, onBack }) {
  const [name, setName] = React.useState(account.name || '');
  const [type, setType] = React.useState(account.readerType || '');
  const done = () => onDone({ name: name.trim(), ...(type ? { readerType: type } : {}) });
  return (
    <div style={{ minHeight: '100%', padding: 'calc(var(--sat) + 16px) 22px calc(var(--sab) + 28px)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <ScreenTop back={onBack} step="About you" title="Nice to meet you" sub="Volapace keeps this on your phone. It just makes the app feel like yours."
        right={<button onClick={() => onDone({})} style={{ background: 'none', border: 'none', color: 'var(--ink-2)', fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 15, cursor: 'pointer', padding: 8 }}>Skip</button>} />
      <label style={{ display: 'block', padding: '10px 14px', borderRadius: 14, background: 'var(--fill)', border: '1px solid var(--line)', marginBottom: 22 }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-2)' }}>What should we call you?</div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoComplete="given-name" autoCapitalize="words" onKeyDown={e => e.key === 'Enter' && e.target.blur()}
          style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', padding: '3px 0 0', fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 17, color: 'var(--ink)' }} />
      </label>
      <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13, color: 'var(--ink-2)', margin: '0 4px 8px', textTransform: 'uppercase', letterSpacing: 0.6 }}>What kind of reader are you?</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 22 }}>
        {READER_TYPES.map(t => {
          const on = type === t.k;
          return (
            <button key={t.k} onClick={() => setType(on ? '' : t.k)} style={{ padding: '14px 12px', borderRadius: 16, cursor: 'pointer', textAlign: 'left',
              background: on ? 'var(--ink)' : 'var(--fill)', color: on ? 'var(--cream)' : 'var(--ink)', border: on ? '1px solid var(--ink)' : '1px solid var(--line)', transition: 'all .15s' }}>
              <Icon name={t.icon} size={20} />
              <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14.5, marginTop: 10 }}>{t.label}</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, opacity: 0.7, marginTop: 2, lineHeight: 1.3 }}>{t.sub}</div>
            </button>
          );
        })}
      </div>
      <div style={{ flex: 1 }} />
      <Button full icon="arrowRight" onClick={done}>{name.trim() ? `Continue as ${name.trim().split(/\s+/)[0]}` : 'Continue'}</Button>
    </div>
  );
}

// ── Quiet hours: a real two-handle slider over the 24-hour day (15-minute steps) ──
const toMin = (hm) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
const toHM = (n) => { n = ((Math.round(n / 15) * 15) % 1440 + 1440) % 1440; return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`; };

function QuietSlider({ from, to, onChange }) {
  const ref = React.useRef(null);
  const drag = React.useRef(null);
  const a = toMin(from) / 1440 * 100, b = toMin(to) / 1440 * 100;
  const at = (e) => { const r = ref.current.getBoundingClientRect(); return Math.max(0, Math.min(1439, (e.clientX - r.left) / r.width * 1440)); };
  const down = (e) => {
    const m = at(e);
    drag.current = Math.abs(m - toMin(from)) <= Math.abs(m - toMin(to)) ? 'from' : 'to';
    e.currentTarget.setPointerCapture(e.pointerId); move(e);
  };
  const move = (e) => { if (!drag.current) return; const v = toHM(at(e)); if (drag.current === 'from') { if (v !== to) onChange(v, to); } else if (v !== from) onChange(from, v); };
  const up = () => { drag.current = null; };
  const knob = (p) => <div style={{ position: 'absolute', left: `${p}%`, top: '50%', width: 26, height: 26, borderRadius: 999, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,.25), 0 0 0 2.5px var(--sage)', transform: 'translate(-50%, -50%)' }} />;
  return (
    <div>
      <div ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ position: 'relative', height: 40, touchAction: 'none', cursor: 'pointer' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 16, height: 8, borderRadius: 999, background: 'var(--track-off)' }} />
        {b > a ? <div style={{ position: 'absolute', left: `${a}%`, width: `${b - a}%`, top: 16, height: 8, borderRadius: 999, background: 'var(--sage)' }} />
          : <><div style={{ position: 'absolute', left: 0, width: `${b}%`, top: 16, height: 8, borderRadius: 999, background: 'var(--sage)' }} /><div style={{ position: 'absolute', left: `${a}%`, right: 0, top: 16, height: 8, borderRadius: 999, background: 'var(--sage)' }} /></>}
        {knob(a)}{knob(b)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
        {['12 AM', '6 AM', '12 PM', '6 PM', '12 AM'].map((t, i) => <span key={i}>{t}</span>)}
      </div>
    </div>
  );
}

function RestDaysPicker({ value, onChange }) {
  const opts = [['none', 'None', []], ['sat', 'Saturday', [6]], ['sun', 'Sunday', [0]], ['both', 'Both', [0, 6]]];
  const key = (v) => { const s = restOf(v); return s.length === 0 ? 'none' : s.length === 2 ? 'both' : s[0] === 6 ? 'sat' : 'sun'; };
  const cur = key(value);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, padding: 4, borderRadius: 16, background: 'var(--fill)', border: '1px solid var(--line)' }}>
      {opts.map(([k, l, v]) => (
        <button key={k} onClick={() => onChange(v)} style={{ height: 40, borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: cur === k ? 700 : 500, fontSize: 13,
          background: cur === k ? 'var(--ink)' : 'transparent', color: cur === k ? 'var(--cream)' : 'var(--ink-2)', transition: 'all .15s' }}>{l}</button>
      ))}
    </div>
  );
}

function ScreenTop({ back, step, title, sub, right }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><button onClick={back} aria-label="Back" style={backBtn}><Icon name="arrowLeft" size={21} /></button>{right}</div>
      <div style={{ marginTop: 18, marginBottom: 22 }}>
        {step && <Eyebrow style={{ marginBottom: 4 }}>{step}</Eyebrow>}
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 30, color: 'var(--ink)', margin: 0, lineHeight: 1.1, letterSpacing: -0.6 }}>{title}</h1>
        {sub && <p style={{ fontFamily: 'var(--font-ui)', fontSize: 15, color: 'var(--ink-2)', margin: '6px 0 0', lineHeight: 1.4 }}>{sub}</p>}
      </div>
    </>
  );
}

function Group({ title, children, style = {} }) {
  return (
    <div style={{ marginBottom: 18, ...style }}>
      {title && <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13, color: 'var(--ink-2)', margin: '0 4px 8px', textTransform: 'uppercase', letterSpacing: 0.6 }}>{title}</div>}
      <div style={{ borderRadius: 'var(--card-radius)', border: '1px solid var(--line)', background: 'var(--surface)', overflow: 'hidden' }}>{children}</div>
    </div>
  );
}
function Row({ icon, title, sub, control, children, last }) {
  return (
    <div style={{ borderBottom: last ? 'none' : '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px' }}>
        {icon && <div style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--fill)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={icon} size={18} /></div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 15, color: 'var(--ink)' }}>{title}</div>
          {sub && <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-2)', marginTop: 1 }}>{sub}</div>}
        </div>
        {control}
      </div>
      {children && <div style={{ padding: '0 16px 14px' }}>{children}</div>}
    </div>
  );
}

// ── Reminders & rest days (onboarding step 3, and from Profile) ──
function RemindersScreen({ ctx, update, go, back, onboarding }) {
  const n = notifyOf(ctx), q = quietOf(ctx);
  const set = (k, v) => update({ notify: { ...n, [k]: v } });
  const setQ = (patch) => update({ quiet: { ...q, ...patch } });
  const hasPlan = !!ctx.days;
  const rest = restDaysOf(ctx);
  return (
    <div style={{ minHeight: '100%', padding: 'calc(var(--sat) + 16px) 22px calc(var(--sab) + 36px)', boxSizing: 'border-box' }}>
      <ScreenTop back={back} step={onboarding ? 'Step 3 of 4' : null} title={onboarding ? 'Stay on track' : 'Reminders'} sub={onboarding ? 'A daily nudge and your days off. More reminder options are in Profile.' : 'Gentle nudges, at times that suit you.'}
        right={onboarding ? <button onClick={() => go('summary')} style={{ background: 'none', border: 'none', color: 'var(--ink-2)', fontFamily: 'var(--font-ui)', fontWeight: 500, fontSize: 15, cursor: 'pointer', padding: 8 }}>Skip</button> : null} />

      <Group title="Daily reminder">
        <Row icon="bell" title="Remind me to read" sub={n.on ? `Every day at ${fmt12(n.time)}` : 'Off'} control={<Toggle on={n.on} onChange={v => set('on', v)} />} last={!n.on}>
        </Row>
        {n.on && <div style={{ padding: '0 16px 14px' }}><TimeField value={n.time} onChange={v => set('time', v)} /></div>}
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-3)', padding: '0 16px 14px', marginTop: n.on ? -4 : 0 }}>Skipped automatically on days you've already read.</div>
      </Group>

      {!onboarding && <>
      <Group title="Streak rescue">
        <Row icon="flame" title="Save my streak" sub={n.rescue ? `Extra nudge at ${fmt12(n.rescueTime)} if I haven't read yet` : 'Off'} control={<Toggle on={n.rescue} onChange={v => set('rescue', v)} />} last={!n.rescue} />
        {n.rescue && <div style={{ padding: '0 16px 14px' }}><TimeField value={n.rescueTime} onChange={v => set('rescueTime', v)} /></div>}
      </Group>

      <Group title="Quiet hours">
        <Row icon="moon" title="Don't disturb me" sub={q.on ? `${fmt12(q.from)} – ${fmt12(q.to)}` : 'Off'} control={<Toggle on={q.on} onChange={v => setQ({ on: v })} />} last={!q.on} />
        {q.on && (
          <div style={{ padding: '4px 16px 16px' }}>
            <QuietSlider from={q.from} to={q.to} onChange={(f, t) => setQ({ from: f, to: t })} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
              <TimeField compact value={q.from} onChange={v => setQ({ from: v })} />
              <TimeField compact value={q.to} onChange={v => setQ({ to: v })} />
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13, color: 'var(--ink-2)', margin: '14px 0 8px' }}>On these days</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {Object.keys(q.days).map(d => {
                const sel = q.days[d];
                return <button key={d} onClick={() => setQ({ days: { ...q.days, [d]: !sel } })} style={{ flex: 1, height: 40, cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 12.5, border: `1px solid ${sel ? 'var(--ink)' : 'var(--line)'}`, borderRadius: 999, background: sel ? 'var(--ink)' : 'var(--fill)', color: sel ? 'var(--cream)' : 'var(--ink-3)' }}>{d[0]}</button>;
              })}
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--ink-3)', marginTop: 10 }}>Reminders that land in quiet hours wait until they end.</div>
          </div>
        )}
      </Group>
      </>}

      {(hasPlan || onboarding) && (
        <Group title="Rest days">
          <div style={{ padding: 16 }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--ink-2)', marginBottom: 12, lineHeight: 1.4 }}>No reading is planned on rest days. Use them to catch up, or just take the day off.</div>
            <RestDaysPicker value={rest} onChange={v => update({ restDays: v })} />
          </div>
        </Group>
      )}

      {onboarding ? <Button full icon="arrowRight" onClick={() => go('summary')}>Review my plan</Button>
        : <Button full variant="soft" onClick={back}>Done</Button>}
    </div>
  );
}

// ── Summary: everything about the plan, before it starts ──
function SummaryScreen({ ctx, update, go, back }) {
  const plan = planOf(ctx);
  const cur = currentBook(ctx);
  const rest = restDaysOf(ctx);
  const n = notifyOf(ctx), q = quietOf(ctx);
  const finish = addReadingDays(TODAY, Math.max(0, plan.days - 1), rest);
  const sched = planSchedule(ctx);
  const dayDate = (i) => i === 0 ? TODAY : addReadingDays(TODAY, i, rest);
  const isTime = plan.goalType === 'time';
  const stat = (v, l) => (
    <div style={{ padding: '14px 14px', borderRadius: 16, background: 'var(--fill)' }}>
      <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 20, color: 'var(--ink)', letterSpacing: -0.5, lineHeight: 1.1 }}>{v}</div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-2)', marginTop: 3 }}>{l}</div>
    </div>
  );
  const line = (icon, t, v, last) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: last ? 'none' : '1px solid var(--line)' }}>
      <Icon name={icon} size={18} style={{ color: 'var(--ink-2)' }} />
      <span style={{ flex: 1, fontFamily: 'var(--font-ui)', fontSize: 14.5, color: 'var(--ink-2)' }}>{t}</span>
      <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14.5, color: 'var(--ink)', textAlign: 'right' }}>{v}</span>
    </div>
  );
  const start = () => { update({ planDraft: false, planStartDate: dayISO(TODAY) }); go('welcome'); };
  const firstRead = plan.list[plan.start] || 1, lastRead = plan.list[plan.list.length - 1] || plan.pages;
  return (
    <div style={{ minHeight: '100%', padding: 'calc(var(--sat) + 16px) 22px calc(var(--sab) + 36px)', boxSizing: 'border-box' }}>
      <ScreenTop back={back} step="Step 4 of 4" title="Your reading plan" sub="Here's everything at a glance. You can change any of it later." />

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: 16, borderRadius: 'var(--card-radius)', background: 'var(--sage)', color: '#fff', marginBottom: 12 }}>
        <BookCover book={cur.book} w={70} radius={8} style={{ boxShadow: 'none' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, opacity: 0.85 }}>{ctx.mode || 'Custom'} pace &middot; {ctx.hasPdf ? 'PDF' : 'Paper book'}</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 20, letterSpacing: -0.4, lineHeight: 1.15, marginTop: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{plan.title}</div>
          {ctx.author && <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, opacity: 0.85, marginTop: 2 }}>{ctx.author}</div>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {stat(isTime ? `${plan.minutes} min` : `${plan.ppd} pages`, isTime ? `a day (~${plan.ppd} pages)` : 'a day')}
        {stat(`${plan.days} days`, 'of reading')}
        {stat(fmtDate(TODAY).replace(/^\w+, /, ''), 'Starts today')}
        {stat(fmtDate(finish).replace(/^\w+, /, ''), `Finishes ${WDAYS[finish.getDay()]}`)}
      </div>

      <Group>
        {line('pages', 'Reading pages', `${plan.reading} (p. ${firstRead}–${lastRead})`)}
        {plan.skipped > 0 && line('close', 'Skipped pages', plan.skipped)}
        {line('calendar', 'Rest days', REST_LABEL(rest).replace(' free', ''))}
        {line('bell', 'Daily reminder', n.on ? fmt12(n.time) : 'Off', true)}
      </Group>

      <div style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13, color: 'var(--ink-2)', margin: '6px 4px 8px', textTransform: 'uppercase', letterSpacing: 0.6 }}>Your first week</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
        {sched.slice(0, 7).map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 14, background: i === 0 ? 'var(--sage-soft)' : 'var(--fill)', border: i === 0 ? '1px solid var(--sage-ring)' : '1px solid transparent' }}>
            <span style={{ width: 52, fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 13, color: i === 0 ? 'var(--sage-deep)' : 'var(--ink)' }}>{i === 0 ? 'Today' : `${WDAYS[dayDate(i).getDay()]} ${dayDate(i).getDate()}`}</span>
            <span style={{ flex: 1, fontFamily: 'var(--font-ui)', fontSize: 13.5, color: 'var(--ink-2)' }}>Day {i + 1} &middot; p. {d.from}&ndash;{d.to}</span>
            <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{d.count} page{d.count === 1 ? '' : 's'}</span>
          </div>
        ))}
      </div>

      <Button full variant="accent" icon="check" onClick={start}>Start my reading journey</Button>
      <button onClick={() => go('pace')} style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14, color: 'var(--ink-2)', padding: 8 }}>Change pace</button>
    </div>
  );
}

// ── Welcome: the plan comes together, then the journey begins ──
function WelcomeScreen({ ctx, go, hostRef }) {
  const plan = planOf(ctx);
  const cur = currentBook(ctx);
  const rest = restDaysOf(ctx);
  const finish = addReadingDays(TODAY, Math.max(0, plan.days - 1), rest);
  const [stage, setStage] = React.useState(0);
  const [count, setCount] = React.useState(0);
  const N = Math.min(plan.days, 42);
  React.useEffect(() => {
    const t = [setTimeout(() => setStage(1), 250), setTimeout(() => setStage(2), 900), setTimeout(() => setStage(3), 900 + N * 45 + 450)];
    return () => t.forEach(clearTimeout);
  }, []);
  React.useEffect(() => {
    if (stage !== 2) return;
    let k = 0; const id = setInterval(() => { k++; setCount(Math.round(k / N * plan.reading)); if (k >= N) clearInterval(id); }, 45);
    return () => clearInterval(id);
  }, [stage]);
  React.useEffect(() => { if (stage === 3 && hostRef && hostRef.current) fireConfetti(hostRef.current); }, [stage]);
  const begin = () => go(ctx.hasPdf ? 'reader' : 'book');
  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', padding: 'calc(var(--sat) + 12px) 22px calc(var(--sab) + 28px)', boxSizing: 'border-box', background: 'var(--cream)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'center', minHeight: 40, alignItems: 'center', opacity: stage >= 1 ? 1 : 0, transition: 'opacity .4s' }}><Brand logo={28} size={24} /></div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ transform: stage >= 1 ? 'none' : 'translateY(36px) scale(0.7)', opacity: stage >= 1 ? 1 : 0, transition: 'all .6s cubic-bezier(.2,1.15,.3,1)', marginBottom: 26 }}>
          <BookCover book={cur.book} w={116} radius={10} style={{ boxShadow: 'none' }} />
        </div>

        {/* the plan, one bar per reading day */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: N > 28 ? 2 : 4, height: 46, width: '100%', maxWidth: 320, justifyContent: 'center', marginBottom: 16 }}>
          {Array.from({ length: N }, (_, i) => (
            <div key={i} style={{ flex: 1, maxWidth: 12, borderRadius: 4, background: i === 0 ? 'var(--sage)' : 'var(--fill-2)',
              height: stage >= 2 ? `${45 + ((i * 37) % 55)}%` : '0%', transition: `height .4s cubic-bezier(.2,.9,.3,1.2) ${i * 0.045}s` }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 24, fontFamily: 'var(--font-ui)', textAlign: 'center', color: 'var(--ink)', opacity: stage >= 2 ? 1 : 0, transition: 'opacity .4s' }}>
          <div><div style={{ fontWeight: 600, fontSize: 24, letterSpacing: -0.6 }}>{count}</div><div style={{ fontSize: 12, color: 'var(--ink-2)' }}>pages</div></div>
          <div><div style={{ fontWeight: 600, fontSize: 24, letterSpacing: -0.6 }}>{plan.days}</div><div style={{ fontSize: 12, color: 'var(--ink-2)' }}>days</div></div>
          <div><div style={{ fontWeight: 600, fontSize: 24, letterSpacing: -0.6 }}>{MONTHS[finish.getMonth()]} {finish.getDate()}</div><div style={{ fontSize: 12, color: 'var(--ink-2)' }}>finish line</div></div>
        </div>
      </div>

      <div style={{ opacity: stage >= 3 ? 1 : 0, transform: stage >= 3 ? 'none' : 'translateY(14px)', transition: 'all .5s cubic-bezier(.2,.8,.2,1)' }}>
        <Eyebrow style={{ marginBottom: 6, textAlign: 'center' }}>Your plan is ready</Eyebrow>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 30, lineHeight: 1.1, letterSpacing: -0.7, color: 'var(--ink)', margin: '0 0 8px', textAlign: 'center' }}>Every great book starts with page one.</h1>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 15, lineHeight: 1.4, margin: '0 0 20px', textAlign: 'center', color: 'var(--ink-2)' }}>Your journey through <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{plan.title}</b> begins today: {plan.goalType === 'time' ? `${plan.minutes} minutes` : `pages ${plan.from}–${plan.to}`}.</p>
        <Button full icon="arrowRight" disabled={stage < 3} onClick={begin}>{ctx.hasPdf ? 'Read Day 1' : 'Open my plan'}</Button>
        <button onClick={() => go('today')} style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', color: 'var(--ink-2)', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14.5, cursor: 'pointer', padding: 10 }}>Go to Home</button>
      </div>
    </div>
  );
}

Object.assign(window, { HelloScreen, READER_TYPES, AppSplash, IntroScreen, RemindersScreen, SummaryScreen, WelcomeScreen, QuietSlider, RestDaysPicker, ScreenTop, Group, Row });
