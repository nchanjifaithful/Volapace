// shell.jsx — full-screen phone layout (replaces the prototype's iOS device frame).
// Content scrolls under a transparent status bar; the tab bar and sheets sit above it.
// Screen padding uses --sat / --sab (status / navigation bar heights from the Android shell).

const ScrollCtx = React.createContext(null);

function PhoneShell({ children, tabBar, overlay, scrollRef, bg }) {
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: bg }}>
      {/* status bar backdrop: content scrolls underneath it, never over the clock */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 'var(--sat)', zIndex: 9, pointerEvents: 'none', background: 'var(--cream)' }} />
      <ScrollCtx.Provider value={scrollRef}>
        <div ref={scrollRef} style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>{children}</div>
      </ScrollCtx.Provider>
      {tabBar && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 45 }}>{tabBar}</div>}
      {overlay && <div style={{ position: 'absolute', inset: 0, zIndex: 58 }}>{overlay}</div>}
    </div>
  );
}

Object.assign(window, { PhoneShell, ScrollCtx });
