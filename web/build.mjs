// Builds the Volapace UI into the Android app's assets (app/src/main/assets/www).
// Everything the UI needs ships inside the APK: React, pdf.js and its worker, and the fonts.
// Run: npm install && npm run build   (CI does this before Gradle)
import { transform } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'app', 'src', 'main', 'assets', 'www');
const nm = (p) => join(here, 'node_modules', p);
const dev = process.argv.includes('--dev');

// Load order matters: the files share globals (the prototype's script-tag model).
const ORDER = [
  'platform', 'theme', 'logo', 'library-data', 'screens1', 'screens2', 'screens3', 'screens4', 'screens5',
  'reader', 'reader-view', 'stats', 'streak', 'onboarding', 'shell', 'app',
];

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'vendor'), { recursive: true });
mkdirSync(join(out, 'fonts'), { recursive: true });

let js = '"use strict";\n';
for (const name of ORDER) {
  const src = readFileSync(join(here, 'src', name + '.jsx'), 'utf8');
  const r = await transform(src, { loader: 'jsx', jsx: 'transform', target: 'chrome90', sourcefile: name + '.jsx', minify: !dev });
  js += `// ── ${name}.jsx\n${r.code}\n`;
}
writeFileSync(join(out, 'app.js'), js);

const react = dev ? 'development' : 'production.min';
copyFileSync(nm(`react/umd/react.${react}.js`), join(out, 'vendor', 'react.js'));
copyFileSync(nm(`react-dom/umd/react-dom.${react}.js`), join(out, 'vendor', 'react-dom.js'));
copyFileSync(nm('pdfjs-dist/build/pdf.min.js'), join(out, 'vendor', 'pdf.min.js'));
copyFileSync(nm('pdfjs-dist/build/pdf.worker.min.js'), join(out, 'vendor', 'pdf.worker.min.js'));
// Character maps and the 14 standard fonts: without them, PDFs that don't embed their fonts render badly.
cpSync(nm('pdfjs-dist/cmaps'), join(out, 'vendor', 'cmaps'), { recursive: true });
cpSync(nm('pdfjs-dist/standard_fonts'), join(out, 'vendor', 'standard_fonts'), { recursive: true });

const FONTS = [
  ['Geist', 'geist-sans', 'geist-sans-latin', [400, 500, 600, 700]],
  ['Bricolage Grotesque', 'bricolage-grotesque', 'bricolage-grotesque-latin', [700, 800]],
  ['Newsreader', 'newsreader', 'newsreader-latin', [400, 500, 600]],
];
let css = '';
for (const [family, pkg, base, weights] of FONTS) {
  for (const w of weights) {
    const file = `${base}-${w}-normal.woff2`;
    copyFileSync(nm(`@fontsource/${pkg}/files/${file}`), join(out, 'fonts', file));
    css += `@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:swap;src:url(fonts/${file}) format("woff2")}\n`;
  }
}
writeFileSync(join(out, 'fonts.css'), css);
copyFileSync(join(here, 'index.html'), join(out, 'index.html'));
console.log('Built Volapace UI into', out);
