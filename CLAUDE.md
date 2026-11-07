# Volapace — build notes for Claude Code

Volapace is an offline-first PDF reading planner. The HTML prototype (`Volapace.html` + `*.jsx`) is the design reference. Use it for screens, flows, copy and interaction details. Don't use it for production architecture.

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
