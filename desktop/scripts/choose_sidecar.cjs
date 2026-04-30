#!/usr/bin/env node
/**
 * Sidecar Build Selector
 *
 * Chooses which sidecar to build based on NIKO_GATEWAY_RUNTIME environment variable.
 * - NIKO_GATEWAY_RUNTIME=node (or unset) -> Build Node sidecar
 * - NIKO_GATEWAY_RUNTIME=python -> Build Python sidecar
 *
 * This provides a Node-first authority model with an explicit compatibility fallback:
 * - Default: Node sidecar (authoritative runtime path)
 * - Optional: Python sidecar (explicit compatibility fallback)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rawRuntime = process.env.NIKO_GATEWAY_RUNTIME;
const normalizedRuntime = (rawRuntime || '').trim().toLowerCase();
const AUTHORITATIVE_RUNTIME = 'node';
const SUPPORTED_RUNTIMES = ['node', 'python'];
const RUNTIME = SUPPORTED_RUNTIMES.includes(normalizedRuntime)
  ? normalizedRuntime
  : AUTHORITATIVE_RUNTIME;
const SCRIPTS_DIR = path.resolve(__dirname);
const DESKTOP_DIR = path.resolve(SCRIPTS_DIR, '..');
const PROJECT_ROOT = path.resolve(DESKTOP_DIR, '..');
const BIN_DIR = path.join(DESKTOP_DIR, 'src-tauri', 'bin');
const PKG_PATH = path.join(DESKTOP_DIR, 'package.json');
const MANIFEST_PATH = path.join(BIN_DIR, 'sidecar.manifest.json');
const STALENESS_DAYS = parseInt(process.env.NIKO_SIDECAR_STALENESS_DAYS || '30', 10);

function log(message) {
  console.log(`[sidecar:choose] ${message}`);
}

/**
 * ISS-20260430-001 guard: warn loudly when bundled Python compat artifacts are
 * older than NIKO_SIDECAR_STALENESS_DAYS days vs desktop/package.json. The
 * v9.2.1 release-blocker shipped a 47-day-stale niko-gateway.exe; surfacing
 * the staleness here gives the operator a chance to rebuild before they hit
 * the runtime CORS / version-mismatch failure.
 */
function detectStalePythonBinaries() {
  const candidates = [
    'niko-gateway.exe',
    'niko-gateway-x86_64-pc-windows-msvc.exe',
    'niko-gateway-aarch64-pc-windows-msvc.exe',
    'niko-gateway',
    'niko-gateway-x86_64-apple-darwin',
    'niko-gateway-aarch64-apple-darwin',
    'niko-gateway-x86_64-unknown-linux-gnu',
    'niko-gateway-aarch64-unknown-linux-gnu',
  ];

  if (!fs.existsSync(PKG_PATH)) return [];
  const pkgMtime = fs.statSync(PKG_PATH).mtimeMs;
  const stale = [];

  for (const name of candidates) {
    const p = path.join(BIN_DIR, name);
    if (!fs.existsSync(p)) continue;
    const mtime = fs.statSync(p).mtimeMs;
    const ageDays = (pkgMtime - mtime) / (1000 * 60 * 60 * 24);
    if (ageDays > STALENESS_DAYS) {
      stale.push({ name, ageDays: ageDays.toFixed(1) });
    }
  }
  return stale;
}

/**
 * Writes bin/sidecar.manifest.json so validate_sidecar_contract.cjs can
 * verify that the bundled artifact's version matches desktop/package.json.
 * This is the build-time half of the ISS-20260430-001 guard.
 */
function writeSidecarManifest(runtime) {
  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, { recursive: true });
  }
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
  const manifest = {
    runtime,
    version: pkg.version,
    built_at: new Date().toISOString(),
    builder: 'desktop/scripts/choose_sidecar.cjs',
    note:
      'Validated by desktop/scripts/validate_sidecar_contract.cjs. ' +
      'A version drift between this file and desktop/package.json is the ISS-20260430-001 release-blocker class.',
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  log(`📝 Wrote sidecar manifest (${runtime} v${pkg.version}) to ${path.relative(PROJECT_ROOT, MANIFEST_PATH)}`);
}

function buildPythonSidecar() {
  log('Building Python sidecar (explicit compatibility runtime)...');
  try {
    execSync('npm run build:sidecar:python', {
      cwd: DESKTOP_DIR,
      stdio: 'inherit',
    });
    log('✅ Python sidecar built successfully');
  } catch (error) {
    log('❌ Python sidecar build failed');
    process.exit(1);
  }
}

function buildNodeSidecar() {
  log('Building Node sidecar (default runtime)...');
  try {
    execSync('npm run build:sidecar:node', {
      cwd: DESKTOP_DIR,
      stdio: 'inherit',
    });
    log('✅ Node sidecar ready');
  } catch (error) {
    log('❌ Node sidecar validation failed');
    process.exit(1);
  }
}

function validateContract() {
  log('Validating sidecar contract...');
  try {
    execSync('npm run validate:sidecar-contract', {
      cwd: DESKTOP_DIR,
      stdio: 'inherit',
    });
  } catch (error) {
    log('❌ Contract validation failed');
    process.exit(1);
  }
}

function main() {
  log(`Runtime selection: NIKO_GATEWAY_RUNTIME=${RUNTIME}`);

  if (normalizedRuntime && !SUPPORTED_RUNTIMES.includes(normalizedRuntime)) {
    log(`Unknown runtime "${rawRuntime}", falling back to authoritative node runtime`);
  }

  if (RUNTIME === 'python') {
    log('Compatibility override active: Python sidecar is not the authoritative default runtime');
  } else {
    log('Authoritative runtime active: Node-first sidecar path');
  }

  // ISS-20260430-001 staleness pre-check: surface old bundled binaries before they ship.
  const stale = detectStalePythonBinaries();
  if (stale.length > 0) {
    log(`⚠️  Found ${stale.length} bundled binary file(s) older than ${STALENESS_DAYS}d vs package.json:`);
    for (const item of stale) {
      log(`   - ${item.name} (${item.ageDays}d old)`);
    }
    log('   These MAY ship in the next NSIS bundle if not regenerated. Re-run the matching');
    log('   build:sidecar:* step OR delete the stale files before validate:package:dry-run.');
  }

  if (RUNTIME === 'python') {
    buildPythonSidecar();
  } else {
    buildNodeSidecar();
  }

  // Write provenance manifest BEFORE validation so the contract check can verify it.
  writeSidecarManifest(RUNTIME);

  validateContract();
  log('✅ Sidecar build complete');
}

main();
