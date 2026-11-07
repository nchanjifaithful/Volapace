# Volapace

An offline reading planner for Android. Pick a PDF or a paper book, set a pace or a finish date, and Volapace turns it into a few pages a day. You read in the built-in reader, finish today's pages and keep a streak.

Volapace has no account and no sync. Your books, progress, highlights and history stay on your phone. The only time it goes online is when you tap **Check for updates**, which asks GitHub for the latest release.

## Install

Download the latest **Volapace-v….apk** from [Releases](https://github.com/nchanjifaithful/Volapace/releases) and open it on your phone. Android may ask you to allow installs from your browser or file manager. Requires Android 8.0 or later.

## How it works

The app starts empty and fills up as you use it.

| Screen | What it does |
|---|---|
| **Add a book** | Pick a PDF (copied into the Volapace folder), or add a paper book by title and page count. |
| **Pace** | Choose a finish date, pages a day or minutes a day. Skip covers, contents and notes. Optionally keep Sundays free and set a reminder. |
| **Today** | Today's page range and progress, *Start reading*, and *Log pages* for paper copies. Finishing the day adds to your streak. |
| **Plan** | Every day of the plan, chapter names from the PDF's outline, *I missed today* with smart catch-up, *Edit plan* and *Reset*. |
| **Reader** | Swipe or scroll, zoom, contents, search, bookmarks, highlights with notes, page colours. A reading timer counts while you're active, with a 2-minute idle cut-off. |
| **Progress** | Goal calendar, pages and hours by week, month and year, yearly book goal, reading speed and session length. All figures come from your own history. |
| **Library** | All your books, with filters (Reading, Finished, Paused, Saved), title or author search, and grid or list view. Swipe a row left to remove a book. |
| **Profile** | Theme (light, dark or system), smart catch-up, yearly goal, reminders, quiet hours, local profile, and CSV or JSON export. |

### The Volapace folder

Books live in a **Volapace** folder in your phone's main storage once you allow storage access (Profile → Books folder → Use a Volapace folder). Until then they stay in `Android/data/app.volapace/files/Volapace`. Any PDF you put there, for example over USB from a computer, appears in the library automatically. Volapace never parses the whole folder at once:

- Each file gets a content-hash id, so progress survives renames and duplicate copies count as one book.
- Only new or changed files are read. Page counts come from Android's built-in PDF renderer.
- Cover thumbnails are rendered in the background, two at a time, and cached.
- The library grid and list only draw the rows on screen, so a thousand books stay smooth.

You can also open a PDF in Volapace from another app with **Open with** or **Share**.

### Reminders

The daily reminder fires at your chosen time unless you've already met today's goal. If the time falls inside your quiet hours, it waits until they end. While a streak is running, a *streak rescue* nudge comes at 9 PM on days you haven't read. These are local notifications scheduled on the phone, and they're restored after a restart.

## Project layout

```
app/                      Android app (Java, no third-party libraries)
  src/main/java/app/volapace/
    MainActivity.java     WebView host; serves the UI and books from inside the app
    Bridge.java           What the UI can ask of the phone (files, share, save, reminders…)
    Library.java          Volapace folder index: hashes, page counts, covers
    Reminders.java        Local notifications with quiet hours
web/                      The UI: React screens from the design, built into app/src/main/assets/www
  src/*.jsx               Screens (theme, today, plan, reader, progress, library, profile)
  src/stats.jsx           Reading history and every number on Progress / Streak
  src/platform.jsx        JavaScript side of the bridge, with a browser fallback for development
  build.mjs               Compiles the JSX and bundles React, pdf.js and the fonts (no CDN)
CLAUDE.md                 Product requirements from the design handoff
```

The UI is the original design, ported from its HTML prototype. It runs inside a WebView with everything bundled. The app serves its own files through `shouldInterceptRequest`, and the WebView can't load anything from the network.

## Build

GitHub Actions builds every push to `main`. Pushing a tag such as `v1.1` also publishes a release with the APK and the newest section of [CHANGELOG.md](CHANGELOG.md).

To build locally you need Node 18+ and the Android SDK (JDK 17):

```bash
cd web && npm install && npm run build && cd ..
./gradlew assembleRelease
```

To try the UI in a desktop browser, run `node web/build.mjs --dev`, then `node web/serve.mjs`, and open http://localhost:5178. In the browser, PDFs are stored in IndexedDB instead of the folder.

### Signing

Cloud builds are signed with one permanent key, so updates install over the previous version. `setup-signing.sh` creates the key once, stores it as the repository secrets `VOLAPACE_KEYSTORE_BASE64` and `VOLAPACE_KEYSTORE_PASSWORD`, and keeps a backup in `~/.volapace-signing`. Keep that backup safe.

## Version history

See [Releases](https://github.com/nchanjifaithful/Volapace/releases) and [CHANGELOG.md](CHANGELOG.md).
