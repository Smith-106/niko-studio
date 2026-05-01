#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const DESKTOP_DIR = path.resolve(__dirname, '..');
const BIN_DIR = path.join(DESKTOP_DIR, 'src-tauri', 'bin');
const TARGET_DIR = path.join(DESKTOP_DIR, 'src-tauri', 'target');

const IS_WINDOWS = process.platform === 'win32';
const TARGET_TRIPLE = 'x86_64-pc-windows-msvc';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(source, target) {
  fs.copyFileSync(source, target);
  const stat = fs.statSync(source);
  fs.utimesSync(target, stat.atime, stat.mtime);
}

function candidateSources() {
  if (!IS_WINDOWS) {
    return [];
  }

  // Order matters: ISS-20260430-001 made the Rust launcher
  // (`niko-gateway-launcher`) the canonical packaged-compat artifact. Prefer it
  // over legacy `niko-gateway.exe` build outputs (which can be an ancient stale
  // Python compat exe still lingering in target/) so the hydrated
  // bin/niko-gateway.exe stays fresh and the validate_sidecar_contract
  // --strict-packaging staleness gate stops failing.
  return [
    // Fresh Rust launcher (preferred — what `npm run build:sidecar` produces)
    path.join(TARGET_DIR, 'release', 'niko-gateway-launcher.exe'),
    path.join(TARGET_DIR, TARGET_TRIPLE, 'release', 'niko-gateway-launcher.exe'),
    path.join(TARGET_DIR, TARGET_TRIPLE, 'debug', 'niko-gateway-launcher.exe'),
    path.join(TARGET_DIR, 'debug', 'niko-gateway-launcher.exe'),
    // Legacy fallback — old main-binary debug builds; kept only for hosts that
    // have not yet built the launcher.
    path.join(TARGET_DIR, TARGET_TRIPLE, 'debug', 'niko-gateway.exe'),
    path.join(TARGET_DIR, 'debug', 'niko-gateway.exe'),
  ];
}

function main() {
  if (!IS_WINDOWS) {
    console.log('[sidecar:hydrate] non-Windows platform: nothing to hydrate');
    return;
  }

  ensureDir(BIN_DIR);

  const source = candidateSources().find((candidate) => fs.existsSync(candidate));
  if (!source) {
    console.error('[sidecar:hydrate] no retained compatibility artifact source found');
    console.error(`[sidecar:hydrate] checked: ${candidateSources().join(', ')}`);
    console.error('[sidecar:hydrate] hydrate desktop/src-tauri/bin/niko-gateway*.exe from a release-prepared artifact or compatibility branch before explicit packaging proof');
    process.exit(1);
  }

  const plainTarget = path.join(BIN_DIR, 'niko-gateway.exe');
  const tripleTarget = path.join(BIN_DIR, `niko-gateway-${TARGET_TRIPLE}.exe`);

  copyFile(source, plainTarget);
  copyFile(source, tripleTarget);

  console.log(`[sidecar:hydrate] source: ${source}`);
  console.log(`[sidecar:hydrate] wrote: ${plainTarget}`);
  console.log(`[sidecar:hydrate] wrote: ${tripleTarget}`);
}

main();
