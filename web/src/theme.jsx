// theme.jsx — Volapace shared design tokens, icons, and UI atoms
// Exports to window. Load after React/Babel, before screens.

const FONT_UI = 'var(--font-ui)';
const FONT_SERIF = 'var(--font-serif)';

// ─────────────────────────────────────────────────────────────
// Icons — stroke style, currentColor, ~1.75px
// ─────────────────────────────────────────────────────────────
function Icon({ name, size = 24, stroke = 1.75, style = {} }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    camera: <><path d="M3 9a2 2 0 0 1 2-2h1.5l1-1.6a1 1 0 0 1 .85-.4h3.3a1 1 0 0 1 .85.4l1 1.6H16a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" {...p}/><circle cx="10.5" cy="12" r="3" {...p}/></>,
    upload: <><path d="M11 14V4m0 0L7.5 7.5M11 4l3.5 3.5" {...p}/><path d="M4 13v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" {...p}/></>,
    book: <><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H17v15H6.5A1.5 1.5 0 0 0 5 19.5z" {...p}/><path d="M5 19.5A1.5 1.5 0 0 1 6.5 18H17" {...p}/></>,
    check: <path d="M4 11l5 5 9-10" {...p}/>,
    bell: <><path d="M6 9a5 5 0 0 1 10 0c0 4 1.5 5 1.5 5h-13S6 13 6 9z" {...p}/><path d="M9 18a2 2 0 0 0 4 0" {...p}/></>,
    chevronDown: <path d="M5 8l6 6 6-6" {...p}/>,
    chevronRight: <path d="M8 5l6 6-6 6" {...p}/>,
    arrowLeft: <path d="M16 11H5m0 0l4.5-4.5M5 11l4.5 4.5" {...p}/>,
    arrowRight: <path d="M5 11h11m0 0l-4.5-4.5M16 11l-4.5 4.5" {...p}/>,
    scan: <><path d="M4 8V6a2 2 0 0 1 2-2h2M14 4h2a2 2 0 0 1 2 2v2M18 14v2a2 2 0 0 1-2 2h-2M8 18H6a2 2 0 0 1-2-2v-2" {...p}/><path d="M4 11h14" {...p}/></>,
    clock: <><circle cx="11" cy="11" r="7.5" {...p}/><path d="M11 6.5V11l3 2" {...p}/></>,
    flame: <path d="M11 3c.5 3-2 4-2 7a3 3 0 0 0 6 0c0-1-.4-1.8-.4-1.8.8.6 1.4 1.7 1.4 3.3a5 5 0 0 1-10 0C6 7.5 9.5 6 11 3z" {...p}/>,
    close: <path d="M6 6l10 10M16 6L6 16" {...p}/>,
    plus: <path d="M11 5v12M5 11h12" {...p}/>,
    sun: <><circle cx="11" cy="11" r="4" {...p}/><path d="M11 2v2M11 18v2M2 11h2M18 11h2M4.5 4.5l1.4 1.4M16.1 16.1l1.4 1.4M17.5 4.5l-1.4 1.4M5.9 16.1l-1.4 1.4" {...p}/></>,
    moon: <path d="M18 12.6A7.2 7.2 0 1 1 9.4 4a5.6 5.6 0 0 0 8.6 8.6z" {...p}/>,
    bookCheck: <><path d="M4 5.2A1.7 1.7 0 0 1 5.7 3.5H17v15H5.7A1.7 1.7 0 0 0 4 20.2z" {...p}/><path d="M4 20.2a1.7 1.7 0 0 1 1.7-1.7H17" {...p}/><path d="M8 10.6l2.2 2.2L14 9" {...p}/></>,
    note: <><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3h9A1.5 1.5 0 0 1 17 4.5V13l-5 5H6.5A1.5 1.5 0 0 1 5 16.5z" {...p}/><path d="M12 18v-3.5a1.5 1.5 0 0 1 1.5-1.5H17M8.5 7.5h5M8.5 10.5h3" {...p}/></>,
    trash: <><path d="M4.5 6.5h13M9 6.5V4.8a.8.8 0 0 1 .8-.8h2.4a.8.8 0 0 1 .8.8v1.7" {...p}/><path d="M6.2 6.5l.8 11a1.5 1.5 0 0 0 1.5 1.4h5a1.5 1.5 0 0 0 1.5-1.4l.8-11M9.5 10v5.5M12.5 10v5.5" {...p}/></>,
    pause: <path d="M8 5.5v11M14 5.5v11" {...p}/>,
    download: <><path d="M11 4v10m0 0l-3.5-3.5M11 14l3.5-3.5" {...p}/><path d="M4 13v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" {...p}/></>,
    home: <><path d="M4 10l7-6 7 6" {...p}/><path d="M6 9v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9" {...p}/></>,
    library: <><path d="M5 4h3v14H5zM10 4h3v14h-3z" {...p}/><path d="M15.5 5l2.7.7-3 12.5-2.6-.7" {...p}/></>,
    chart: <><path d="M4 18V4M4 18h14" {...p}/><path d="M8 14v-3M11.5 14V8M15 14v-5" {...p}/></>,
    user: <><circle cx="11" cy="8" r="3.2" {...p}/><path d="M5 18a6 6 0 0 1 12 0" {...p}/></>,
    sparkle: <path d="M11 3l1.6 4.4L17 9l-4.4 1.6L11 15l-1.6-4.4L5 9l4.4-1.6z" {...p}/>,
    target: <><circle cx="11" cy="11" r="7.5" {...p}/><circle cx="11" cy="11" r="3.5" {...p}/></>,
    refresh: <><path d="M17 7a7 7 0 1 0 1.5 5" {...p}/><path d="M18 3v4h-4" {...p}/></>,
    pages: <><path d="M6 4h6l4 4v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" {...p}/><path d="M12 4v4h4M8 12h6M8 15h4" {...p}/></>,
    share: <><circle cx="6" cy="11" r="2.4" {...p}/><circle cx="15.5" cy="5.5" r="2.4" {...p}/><circle cx="15.5" cy="16.5" r="2.4" {...p}/><path d="M8.1 9.9l5.3-3.1M8.1 12.1l5.3 3.1" {...p}/></>,
    cog: <><circle cx="11" cy="11" r="2.6" {...p}/><path d="M11 3.5v2M11 16.5v2M3.5 11h2M16.5 11h2M5.7 5.7l1.4 1.4M14.9 14.9l1.4 1.4M16.3 5.7l-1.4 1.4M7.1 14.9l-1.4 1.4" {...p}/></>,
    award: <><circle cx="11" cy="8" r="4.5" {...p}/><path d="M7.5 11.5L6 19l5-2.6L16 19l-1.5-7.5" {...p}/></>,
    calendar: <><rect x="4" y="5" width="14" height="13" rx="2" {...p}/><path d="M4 9h14M8 3.5v3M14 3.5v3" {...p}/></>,
    edit: <><path d="M13.5 4.5l4 4L8 18H4v-4z" {...p}/><path d="M12 6l4 4" {...p}/></>,
    sliders: <><path d="M4 7h7M15 7h3M4 14h3M11 14h7" {...p}/><circle cx="13" cy="7" r="2" {...p}/><circle cx="9" cy="14" r="2" {...p}/></>,
    paper: <><rect x="5" y="3.5" width="12" height="15" rx="1.5" {...p}/><path d="M8 7.5h6M8 10.5h6M8 13.5h4" {...p}/></>,
    bolt: <path d="M12 3L5 12h5l-1 7 7-9h-5z" {...p}/>,
    search: <><circle cx="10" cy="10" r="6" {...p}/><path d="M14.5 14.5L18.5 18.5" {...p}/></>,
    more: <><circle cx="5" cy="11" r="1.3" fill="currentColor" stroke="none"/><circle cx="11" cy="11" r="1.3" fill="currentColor" stroke="none"/><circle cx="17" cy="11" r="1.3" fill="currentColor" stroke="none"/></>,
    grid: <><rect x="4" y="4" width="5.5" height="5.5" rx="1.4" {...p}/><rect x="12.5" y="4" width="5.5" height="5.5" rx="1.4" {...p}/><rect x="4" y="12.5" width="5.5" height="5.5" rx="1.4" {...p}/><rect x="12.5" y="12.5" width="5.5" height="5.5" rx="1.4" {...p}/></>,
    list: <path d="M8 6h10M8 11h10M8 16h10M4 6h.01M4 11h.01M4 16h.01" {...p}/>,
    minus: <path d="M5 11h12" {...p}/>,
    bookmark: <path d="M6.5 3.5h9a1 1 0 0 1 1 1v14l-5.5-3.6-5.5 3.6v-14a1 1 0 0 1 1-1z" {...p}/>,
    bookmarkOn: <path d="M6.5 3.5h9a1 1 0 0 1 1 1v14l-5.5-3.6-5.5 3.6v-14a1 1 0 0 1 1-1z" {...p} fill="currentColor"/>,
    play: <path d="M7 5l10 6-10 6z" {...p}/>,
    headphones: <><path d="M4 12v-1a7 7 0 0 1 14 0v1" {...p}/><rect x="3" y="12" width="3.5" height="6" rx="1.5" {...p}/><rect x="15.5" y="12" width="3.5" height="6" rx="1.5" {...p}/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" style={{ display: 'block', flexShrink: 0, ...style }}>
      {paths[name]}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Primary / secondary buttons
// ─────────────────────────────────────────────────────────────
function Button({ children, onClick, variant = 'primary', icon, full, style = {}, disabled }) {
  const [press, setPress] = React.useState(false);
  const base = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
    fontFamily: FONT_UI, fontWeight: 600, fontSize: 16, letterSpacing: -0.2,
    height: 52, padding: '0 22px', borderRadius: 999, border: 'none', cursor: 'pointer',
    width: full ? '100%' : undefined, boxSizing: 'border-box',
    transition: 'transform .14s cubic-bezier(.2,.8,.2,1), filter .14s, box-shadow .2s',
    transform: press ? 'scale(0.975)' : 'scale(1)',
    opacity: disabled ? 0.45 : 1, pointerEvents: disabled ? 'none' : 'auto',
    WebkitTapHighlightColor: 'transparent', userSelect: 'none',
  };
  const variants = {
    primary: { background: 'var(--ink)', color: 'var(--cream)', boxShadow: 'none' },
    accent: { background: 'var(--sage)', color: '#fff', boxShadow: 'none' },
    soft: { background: 'var(--fill)', color: 'var(--ink)', boxShadow: 'none' },
    ghost: { background: 'var(--surface)', color: 'var(--ink)', boxShadow: 'inset 0 0 0 1px var(--line)' },
    dark: { background: 'var(--ink)', color: 'var(--cream)', boxShadow: 'none' },
  };
  return (
    <button onClick={onClick} disabled={disabled}
      onPointerDown={() => setPress(true)} onPointerUp={() => setPress(false)} onPointerLeave={() => setPress(false)}
      style={{ ...base, ...variants[variant], ...style }}>
      {icon && <Icon name={icon} size={20} />}
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────────────────────
function Card({ children, style = {}, pad = 20, glass, ...rest }) {
  return (
    <div style={{
      background: glass ? 'var(--glass)' : 'var(--surface)',
      backdropFilter: glass ? 'blur(20px) saturate(140%)' : undefined,
      WebkitBackdropFilter: glass ? 'blur(20px) saturate(140%)' : undefined,
      border: '1px solid var(--line)',
      borderRadius: 'var(--card-radius)', padding: pad,
      boxShadow: 'var(--shadow-card)', boxSizing: 'border-box', ...style,
    }} {...rest}>{children}</div>
  );
}

// ─────────────────────────────────────────────────────────────
// Toggle switch (iOS style, sage when on)
// ─────────────────────────────────────────────────────────────
function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{
      width: 50, height: 30, borderRadius: 999, border: 'none', cursor: 'pointer', padding: 0,
      background: on ? 'var(--sage)' : 'var(--track-off)',
      position: 'relative', transition: 'background .22s cubic-bezier(.2,.8,.2,1)',
      flexShrink: 0, WebkitTapHighlightColor: 'transparent',
    }}>
      <span style={{
        position: 'absolute', top: 2, left: 2, width: 26, height: 26, borderRadius: 999,
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        transform: on ? 'translateX(20px)' : 'translateX(0)',
        transition: 'transform .22s cubic-bezier(.2,.8,.2,1)',
      }} />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Progress bar
// ─────────────────────────────────────────────────────────────
function ProgressBar({ value, height = 6, track = 'var(--track-off)', fill = 'var(--sage)' }) {
  return (
    <div style={{ height, borderRadius: 999, background: track, overflow: 'hidden', width: '100%' }}>
      <div style={{
        height: '100%', width: `${Math.max(0, Math.min(100, value))}%`, background: fill,
        borderRadius: 999, transition: 'width .5s cubic-bezier(.2,.8,.2,1)',
      }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Progress ring (Apple Watch style)
// ─────────────────────────────────────────────────────────────
function Ring({ value, size = 92, stroke = 10, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--track-off)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--sage)" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, value/100))}
          style={{ transition: 'stroke-dashoffset .7s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Eyebrow label
// ─────────────────────────────────────────────────────────────
function Eyebrow({ children, style = {} }) {
  return <div style={{
    fontFamily: FONT_UI, fontWeight: 500, fontSize: 13.5, letterSpacing: 0,
    color: 'var(--ink-2)', ...style,
  }}>{children}</div>;
}

// Section header: title + optional action ("View all")
function SectionHead({ title, action, onAction, style = {} }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, ...style }}>
      <span style={{ fontFamily: FONT_UI, fontWeight: 600, fontSize: 17, color: 'var(--ink)', letterSpacing: -0.2 }}>{title}</span>
      {action && <button onClick={onAction} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: FONT_UI, fontWeight: 500, fontSize: 13.5, color: 'var(--ink-2)' }}>{action}</button>}
    </div>
  );
}

// Pill chip (black when on, light fill when off)
function Chip({ on, children, onClick, style = {} }) {
  return (
    <button onClick={onClick} style={{
      flexShrink: 0, height: 36, padding: '0 16px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
      fontFamily: FONT_UI, fontWeight: 500, fontSize: 14, border: on ? '1px solid var(--ink)' : '1px solid var(--line)',
      background: on ? 'var(--ink)' : 'var(--fill)', color: on ? 'var(--cream)' : 'var(--ink)',
      transition: 'background .18s, color .18s, border-color .18s', ...style,
    }}>{children}</button>
  );
}

// Round icon button (light fill)
function IconBtn({ name, onClick, size = 44, dark, style = {} }) {
  return (
    <button onClick={onClick} style={{
      width: size, height: size, borderRadius: 999, border: dark ? 'none' : '1px solid var(--line)', cursor: 'pointer', flexShrink: 0,
      background: dark ? 'var(--ink)' : 'var(--fill)', color: dark ? 'var(--cream)' : 'var(--ink)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', ...style,
    }}><Icon name={name} size={size * 0.46} /></button>
  );
}

// Search field (tappable)
function SearchBar({ placeholder = 'Search books or authors', onClick, style = {} }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', height: 48, borderRadius: 999, border: '1px solid var(--line)', background: 'var(--fill)', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px', color: 'var(--ink-3)', textAlign: 'left', ...style,
    }}>
      <Icon name="search" size={19} />
      <span style={{ fontFamily: FONT_UI, fontSize: 15, color: 'var(--ink-3)' }}>{placeholder}</span>
    </button>
  );
}

// Horizontal scroller with edge-to-edge bleed
// Horizontal scroller — clipped to the page's content edges (never bleeds to the phone edge)
function HScroll({ children, gap = 12, style = {} }) {
  return (
    <div style={{ display: 'flex', gap, overflowX: 'auto', scrollbarWidth: 'none', scrollSnapType: 'x proximity', padding: '2px 0 4px', borderRadius: 2, ...style }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Confetti burst
// ─────────────────────────────────────────────────────────────
function fireConfetti(host) {
  const colors = ['#D90429', '#141414', '#9A031E', '#C9C9C9', '#FFFFFF', '#6B6B6B'];
  const N = 80;
  for (let i = 0; i < N; i++) {
    const el = document.createElement('div');
    const size = 6 + Math.random() * 7;
    el.style.cssText = `position:absolute;top:38%;left:50%;width:${size}px;height:${size*0.6}px;
      background:${colors[i % colors.length]};border-radius:2px;pointer-events:none;z-index:200;
      will-change:transform,opacity;`;
    host.appendChild(el);
    const angle = (Math.PI * 2 * i) / N + (Math.random() - 0.5);
    const vel = 120 + Math.random() * 200;
    const dx = Math.cos(angle) * vel;
    const dy = Math.sin(angle) * vel - 120;
    const rot = (Math.random() - 0.5) * 720;
    el.animate([
      { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 380}px)) rotate(${rot}deg)`, opacity: 0 },
    ], { duration: 1100 + Math.random() * 700, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => el.remove();
  }
}

Object.assign(window, {
  Icon, Button, Card, Toggle, ProgressBar, Ring, Eyebrow, SectionHead, Chip, IconBtn, SearchBar, HScroll, fireConfetti, FONT_UI, FONT_SERIF,
});
