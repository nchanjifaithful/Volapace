# Volapace — build notes for Claude Code

Volapace is an offline-first PDF reading planner. The HTML prototype (`Volapace.html` + `*.jsx`) is the design reference. Use it for screens, flows, copy and interaction details. Don't use it for production architecture.

# Developing Volapace

Read this part first. The sections after "Design handoff" are the original product requirements; this part describes the app as it is actually built.

## What it is

An Android app (Java, no third-party libraries) that hosts the design's React screens in a WebView. React, pdf.js (with its cMaps and standard fonts) and the three fonts are bundled into the APK, so the UI never touches the network.

- Repo: https://github.com/nchanjifaithful/Volapace (public). Releases ship the signed APK.
- Package `app.volapace`, minSdk 26, target/compile 34, Java 17.
- The official logo is in `brand/` (flat-colour versions derived from the original SVG).
- Machine-specific notes (local paths, tool locations, the signing-key backup) are in `CLAUDE.local.md`, which is not committed.

## Requirements

- **Node.js 18+** for the UI build.
- **No Android SDK or JDK needed locally.** APKs are built only by GitHub Actions. Don't try to run Gradle locally.
- **gh** (GitHub CLI), logged in to the repo owner's account, for releases and secrets.
- The signing key lives in GitHub secrets (`VOLAPACE_KEYSTORE_BASE64`, `VOLAPACE_KEYSTORE_PASSWORD`). Never regenerate it: updates only install over builds signed with the same key. `setup-signing.sh` refuses to overwrite an existing key.

## Build and preview the UI

```bash
cd web
npm ci                 # first time, or after package-lock changes
node build.mjs --dev   # readable build; plain `npm run build` minifies
node serve.mjs         # http://localhost:5178
```

- `build.mjs` compiles `web/src/*.jsx` with esbuild and writes everything to `app/src/main/assets/www/`, which is gitignored and generated.
- In the desktop app's browser pane, use `preview_start` with the `volapace-web` config in `.claude/launch.json`, then switch the viewport to mobile.
- In a browser, `platform.jsx` falls back to IndexedDB for PDFs and `<a download>` for files. No `window.VPNative` means browser mode.
- npm 11 prints an "install-scripts" warning on `npm ci`. It's harmless: esbuild ships its binary as a package.

## Release flow

- Push to branch `next`: CI builds a signed APK artifact for review (no release). Use it to show work before publishing.
- Merge to `main` (fast-forward), then tag: `git tag -a v1.2 -m "Volapace 1.2" && git push origin v1.2`. CI publishes the "Volapace 1.2" release with `Volapace-v1.2.apk`, using the newest `## x.y` section of `CHANGELOG.md` as notes.
- Before tagging, bump `versionName` in `app/build.gradle.kts` and add the changelog section. `versionCode` comes from the CI run number automatically.
- Don't publish a release before the user has approved the changes.
- Workflow: `.github/workflows/build.yml` (Node 22 → `npm ci && npm run build` in `web/` → JDK 17 + SDK 34 → `assembleRelease` → apksigner check → release on tags).

## Code map

```
app/src/main/java/app/volapace/
  MainActivity.java     WebView host. Serves assets at https://volapace.local/ via shouldInterceptRequest
                        (/pdf/<id>, /cover/<id>.jpg, everything else from assets/www). Edge-to-edge insets → CSS
                        --sat/--sab. File pick/save, photo pick, folder access, update check, back button.
  Bridge.java           window.VPNative: every call the UI can make. Async calls take a callback id and answer
                        through window.__vp.resolve(id, json).
  Library.java          Books folder index (index.json): content-hash ids (SHA-1 of size + first/last 64 KB), page
                        counts and 240 px covers via PdfRenderer, FileObserver, incremental scan. Folder is
                        /storage/emulated/0/Volapace once "All files access" is granted, else the app's own folder.
  ReaderWebView.java    Adds Highlight / Note to Android's text-selection menu while the reader is open.
  Reminders.java        AlarmManager + local notifications: daily reminder, streak rescue, quiet hours.
                        Receivers: ReminderReceiver, BootReceiver. ShareProvider serves files to the share sheet.
web/src/ (load order is in build.mjs — the files share globals, as in the prototype; no imports)
  platform.jsx          JS side of the bridge + browser fallback. Defines TODAY (real local date).
  theme.jsx, logo.jsx   Design atoms and icons; the logo (flat colours, no gradients) and <Brand>.
  library-data.jsx      BookCover, entryBook() (library entry → book model), status meta. No sample books.
  reader.jsx            Lib (library + sync with the folder index), PdfStore (open docs), BOOK_FIELDS,
                        planSchedule()/planOf() (all plan math), streaks, PdfPage renderer.
  reader-view.jsx       The reader: paging/vertical scroll, pinch + double-tap zoom, page ticks, day-end
                        markers, persistent search with on-page hits, ⋮ menu, notes, timer.
  stats.jsx             applyHistory() (reading log), lifetimeStats, rangeStats (calendar weeks/months).
  screens1–5.jsx        Upload/paper book, Pace, Plan, Today/Progress, Library/Profile and sheets.
  onboarding.jsx        Splash, intro, reminders & rest days, summary, welcome animation.
  streak.jsx            Streak screen and share card (DOM preview + canvas PNG).
  shell.jsx, app.jsx    Full-screen shell, routing, persistence, reminders sync, FAB, back button.
```

## How state works

- One `ctx` object (localStorage `vp_ctx`) holds the current book plus global state. Per-book keys are listed in `BOOK_FIELDS`. When you switch books they're snapshotted into the library entry (`Lib`, localStorage `vp_lib`). **Any new per-book field must be added to `BOOK_FIELDS`.**
- Every change goes through `update(data)` → `applyHistory()`, which also writes the reading log (`ctx.log`), page deltas, sessions and finished books. Special keys: `logPages`, `endSession`.
- The plan is derived, never stored as screen state: `planSchedule(ctx)` builds the days from `days`, `doneDays`, `planDays` (`counts`, `skipped`) and `planVer`. `markTodayDone()` advances `doneDays` and adds today to `doneDates`.
- Pages ticked as read: `ctx.readPages`. Rest days: `ctx.restDays` (array of weekday numbers; older plans used `catchUp`). New plans are drafts (`planDraft`) until Summary → Start.
- Global settings: `notify` (on, time, rescue, rescueTime), `quiet`, `yearGoal`, `autoCatchUp`. Profile: localStorage `vp_account` (name, email, ISO `since`, `photo` data URL).

## Product rules agreed with the user

- The app starts **empty**: no sample books, numbers or profile. Every figure comes from real use.
- Stay **as close to the original design** as possible: white pages, ink type, 1 px bordered cards, black pill buttons, red `#D90429` as the accent. **No gradients**, no decorative shadows or glows.
- Onboarding: Splash → Intro → "What are you reading next?" → Pace → Reminders (daily reminder + rest days only, skippable) → Summary → Welcome. Quiet hours and streak rescue live in Profile → Reminders.
- Network: only Profile → "Check for updates" (GitHub releases API). The WebView itself can't load anything off-device.

## Gotchas

- Strings in JSX attributes don't decode HTML entities, and JSX text doesn't decode `\u` escapes. Use `{'\u2019'}` in attributes and `&rsquo;` in text.
- Big shell heredocs with curly quotes or `\u` escapes have broken in this environment. Use the file tools for large edits.
- Screens that fill the viewport exactly (reader, intro, welcome, streak) are listed in `FULL` in `app.jsx`.
- Use `var(--sat)` / `var(--sab)` for top and bottom spacing, not fixed iPhone values.
- To test PDFs in the browser, put a generated PDF into IndexedDB `volapace-dev`/`files` and call `window.__vp.library()`.
- Never tested on a real phone yet: All-files-access folder move, Check for updates, the Highlight/Note selection menu.

# Design handoff (original requirements)

## Pending requirement: "On this phone" = a dedicated folder of PDFs

**Not implemented in the prototype. Build it in the native app.**

The prototype keeps imported PDFs in IndexedDB (`Lib` + `PdfStore` in `reader.jsx`). In the real app, the source of truth is a **dedicated folder on the device**:

- **Folder:** For example `Documents/Volapace/` on iOS (Files app, "On My iPhone › Volapace") and an app-specific folder or a user-picked folder on Android (Storage Access Framework). Every PDF in that folder appears under **On this phone**, with no import step. Files added through the Files app, AirDrop, USB or "Share to Volapace" show up automatically.
- **Scale:** Assume **1,000+ PDFs**. Requirements:
  - **Index, don't open.** Keep a local DB (SQLite / Core Data / Room) with one row per file: path, size, modified time, content hash, title, author, page count, cover-thumbnail path, and the progress snapshot (the per-book fields in `BOOK_FIELDS`, `reader.jsx`).
  - **Incremental scan.** On launch and on a folder-change notification (`NSFilePresenter` / `FileObserver` / `DocumentsContract` change URI), compare `(path, size, mtime)` against the index. Only parse new or changed files. Handle removed files, and renamed files matched by content hash, so progress survives a rename.
  - **Background metadata extraction.** Title and author come from the PDF info dictionary, falling back to the filename. Get the page count. Render a page-1 cover thumbnail at about 160 px, JPEG, cached on disk. Use a low-priority queue limited to 2–4 at a time (see `RenderQ`). Show placeholders until each one finishes.
  - **Virtualised UI.** Library grid and list must virtualise (e.g. `LazyVGrid` / `RecyclerView`), never mount 1,000 covers. Load thumbnails lazily as cells appear.
  - **Search and sort over the index**, not the files: title, author, recently opened, date added, progress. Add a fast title search field to Library. The search icon is already in the header.
  - **Filters** stay as designed: All / Reading / Finished / Paused / Saved. "Saved" = in the folder but no plan yet.
  - **Grouping (optional):** Treat subfolders inside the Volapace folder as collections, shown as chips or sections.
- **Duplicates:** Dedupe by content hash, not by title. The prototype's `dedupeLibrary` (title + page count) is a stop-gap.
- **Removing a book:** In Library this deletes the file from the folder, after confirmation. Offer "Remove from library only" if the folder is user-picked and shared.
- **Upload screen:** "Choose a PDF" **copies** the picked file into the Volapace folder; it is not a separate store. The "On this phone" list on Upload shows the 4 most recently opened books.
- **Offline:** All of this works with no network. Nothing is uploaded.

## Offline: no network, ever

Every screen, number and action must work in airplane mode. The prototype has no server calls. All logic runs locally: plan math, streaks, stats, search, highlights, export, share-card rendering, and PDF parsing and rendering.

- **Bundle everything:** The UI fonts (Geist, Bricolage Grotesque, Newsreader) and the PDF engine (pdf.js / PDFKit / PdfRenderer) ship inside the app. No CDN, no web fonts, no remote config, no analytics that block the UI.
- **Storage is on-device only:** Books live in the Volapace folder. The index, progress, highlights, streak days, account details and settings live in the local DB. Account details are a local profile with no sign-in.
- **Share and export:** These use the OS share sheet and the Files app. The streak card PNG is rendered on-device.
- **Offline web build:** `Volapace Offline.html` is a single self-contained file (React, pdf.js and its worker, and fonts all inlined) and can be used as a reference. It is rebuilt from `Volapace Offline Source.html`.

### Mobile app: offline rules for every feature

Target: native iOS + Android (or one cross-platform codebase). The app needs **no network permission** to do anything. If the app ever adds an optional online feature, it must be off by default and the app must behave identically without it.

| Feature | How it works offline |
|---|---|
| Library / On this phone | Folder scan + local DB index (see above). Covers rendered on-device and cached. |
| Reader | Native PDF engine: PDFKit (iOS), PdfRenderer or bundled pdfium/pdf.js (Android). Text selection, search and the outline (contents) come from the engine, not a service. |
| Search in book | Extract page text with the engine. Cache it per book in the DB (FTS table) so repeat searches are instant. |
| Highlights & notes | Stored in the local DB as page number + normalised rects (0–1, as in the prototype) + text + colour + note. |
| Bookmarks, skipped pages, zoom, page colour, scroll mode | Local DB / preferences. |
| Plans, pace, time goals, smart catch-up, Edit plan / Reset | Pure functions over local data (`planOf`, `readingList`, `readIdx` in `reader.jsx`). Port them as-is and unit-test them. |
| Reading timer | Device clock only. Count while the reader is foregrounded and the user is active (2-minute idle cut-off, as in the prototype). Persist every ~10 s so a crash loses little. |
| Streaks | A set of local calendar dates (`doneDates`) in the **device's time zone**. Use the device's local midnight. Never use a server time. |
| Progress stats & yearly goal | Computed from the local DB. Remove all sample/seed numbers. Every number on Progress must be derived from real local history. |
| Reminders | **Local notifications** scheduled on-device (`UNUserNotificationCenter` / `AlarmManager` + `NotificationManager`). No push service. Reschedule when the time or the plan changes, and after reboot on Android. |
| Streak card | Render the PNG on-device (Core Graphics / Canvas / an offscreen view snapshot). Save to Photos/Files, or hand it to the OS share sheet. |
| Export data | Build CSV/JSON on-device and save it through the Files / document picker. |
| Account | A local profile only (name, email as plain text, reading-since). No sign-in, no sync. |
| Fonts & icons | Bundled in the app. No Google Fonts or CDN. |
| Dates & numbers | Use the device locale APIs. Don't use any remote locale data. |

**Acceptance check:** Install, enable airplane mode, and never turn it off. Then do all of these: add PDFs to the folder, build a plan, read, highlight, search, finish a day, see the streak, share and save the card, export data, edit the plan, reset, and change settings. Everything must work, and nothing may show a spinner, an error or an empty state that a network connection would have filled.

**Prototype-only shortcuts to replace:** `TODAY` is fixed in `screens2.jsx`; use the real date. The sample books, `INVEST` / `PROG_RANGES` figures and `lifetimeStats` base numbers are placeholders. The sample Gatsby pages (`SamplePage`) are demo-only. The prototype loads pdf.js from a CDN in `Volapace.html`; the native app bundles its engine.

## Other notes carried over from the prototype

- Plan math, streaks, skip-pages and time goals: `planOf`, `readingList`, `readIdx`, `doneSet`, `streakCount`, `markTodayDone` in `reader.jsx`.
- Reader behaviour: `reader-view.jsx` (swipe or vertical scroll, continuous or snap, zoom pill at top of canvas, prev/next at bottom, highlights and notes, reading timer).
- Per-book vs global state: `BOOK_FIELDS` lists what is per book. Streak days, display settings, smart catch-up and yearly goal are global.
