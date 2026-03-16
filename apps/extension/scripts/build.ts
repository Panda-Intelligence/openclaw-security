/**
 * Build script for the OpenClaw Security browser extension.
 *
 * Usage: bun run scripts/build.ts
 *
 * Produces dist/ ready to be loaded as an unpacked Chrome extension.
 */
import { mkdirSync, writeFileSync, readFileSync, cpSync } from 'fs';
import { join } from 'path';

const ROOT = import.meta.dir.replace('/scripts', '');
const DIST = join(ROOT, 'dist');

// Clean & create output dirs
mkdirSync(join(DIST, 'icons'), { recursive: true });

// 1. Bundle service worker
const bgResult = await Bun.build({
  entrypoints: [join(ROOT, 'src/background/service-worker.ts')],
  outdir: DIST,
  target: 'browser',
  minify: true,
});
if (!bgResult.success) {
  console.error('Service worker build failed:', bgResult.logs);
  process.exit(1);
}

// 2. Bundle popup (React)
const popupResult = await Bun.build({
  entrypoints: [join(ROOT, 'src/popup/popup.tsx')],
  outdir: DIST,
  target: 'browser',
  minify: true,
});
if (!popupResult.success) {
  console.error('Popup build failed:', popupResult.logs);
  process.exit(1);
}

// 3. Copy popup.html with updated script reference
const popupHtml = readFileSync(join(ROOT, 'src/popup/popup.html'), 'utf-8')
  .replace('./popup.tsx', './popup.js');
writeFileSync(join(DIST, 'popup.html'), popupHtml);

// 4. Write manifest with dist-relative paths
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf-8'));
manifest.background.service_worker = 'service-worker.js';
manifest.action.default_popup = 'popup.html';
writeFileSync(join(DIST, 'manifest.json'), JSON.stringify(manifest, null, 2));

// 5. Copy icons
cpSync(join(ROOT, 'icons'), join(DIST, 'icons'), { recursive: true });

console.log('Extension built to dist/');
console.log('Load unpacked from: apps/extension/dist/');
