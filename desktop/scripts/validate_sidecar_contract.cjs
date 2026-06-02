#!/usr/bin/env node
/**
 * Sidecar Contract Validator
 *
 * Validates sidecar naming and location contracts for Tauri externalBin packaging.
 *
 * Contracts:
 * 1. Location: desktop/src-tauri/bin/
 * 2. Naming (Python):
 *    - Windows: niko-gateway.exe, niko-gateway-x86_64-pc-windows-msvc.exe
 *    - Unix: niko-gateway
 * 3. Naming (Node):
 *    - Windows: niko-gateway-node, niko-gateway-node.cmd
 *    - Unix: niko-gateway-node
 *
 * Usage:
 *   node scripts/validate_sidecar_contract.js [--strict] [--all-runtimes]
 *
 * Options:
 *   --strict        Exit with error if any contract violation (default: warn only)
 *   --all-runtimes  Validate both node and python contracts regardless of selected runtime
 */

const fs = require('fs');
const path = require('path');

// Script is in desktop/scripts/, project root is parent of desktop/
const SCRIPT_DIR = __dirname;
const DESKTOP_DIR = path.resolve(SCRIPT_DIR, '..');
const PROJECT_ROOT = path.resolve(DESKTOP_DIR, '..');
const BIN_DIR = path.join(DESKTOP_DIR, 'src-tauri', 'bin');
const TAURI_CONFIG_PATH = path.join(DESKTOP_DIR, 'src-tauri', 'tauri.conf.json');
const CAPABILITY_PATH = path.join(DESKTOP_DIR, 'src-tauri', 'capabilities', 'main-desktop.json');
const LEGACY_PY_SIDECAR_ENTRY = path.join(PROJECT_ROOT, 'src', 'mcp', 'sidecar_entry.py');
const DESKTOP_PACKAGE_PATH = path.join(DESKTOP_DIR, 'package.json');
const SIDECAR_MANIFEST_PATH = path.join(BIN_DIR, 'sidecar.manifest.json');
const SIDECAR_STALENESS_DAYS = parseInt(process.env.NIKO_SIDECAR_STALENESS_DAYS || '30', 10);

const IS_WINDOWS = process.platform === 'win32';
const STRICT_MODE = process.argv.includes('--strict');
const VALIDATE_ALL_RUNTIMES = process.argv.includes('--all-runtimes');
const STRICT_PACKAGING_MODE = process.argv.includes('--strict-packaging');
const rawRuntime = (process.env.NIKO_GATEWAY_RUNTIME || '').trim().toLowerCase();
const SELECTED_RUNTIME = ['node', 'python'].includes(rawRuntime) ? rawRuntime : 'node';
const EXPECTED_WINDOW_LABEL = 'main';
const EXPECTED_CAPABILITY_ID = 'main-desktop';
const EXPECTED_EXTERNAL_BIN = 'bin/niko-gateway';
const AUTHORITATIVE_RUNTIME = 'node';
const PACKAGED_COMPAT_RUNTIME = 'python';
const REQUIRE_PACKAGED_COMPAT_ARTIFACT = process.platform === 'win32';
const EXPECTED_FRONTEND_PERMISSIONS = [
  'core:default',
  'process:default',
  'updater:default',
  'fs:default',
  'fs:allow-read-text-file',
  'fs:allow-write-text-file',
  'fs:allow-exists',
  'fs:allow-mkdir',
  'fs:allow-read-dir',
  'fs:allow-remove',
  'fs:allow-stat',
  'dialog:default',
  'dialog:allow-open',
];

// Contract definitions
const CONTRACTS = {
  python: {
    description: 'Python sidecar (PyInstaller output)',
    files: {
      windows: [
        'niko-gateway.exe',
        'niko-gateway-x86_64-pc-windows-msvc.exe',
      ],
      unix: [
        'niko-gateway',
      ],
    },
  },
  node: {
    description: 'Node.js sidecar (standalone proxy)',
    files: {
      windows: [
        'niko-gateway-node',
        'niko-gateway-node.cmd',
      ],
      unix: [
        'niko-gateway-node',
      ],
    },
  },
};

function checkFileExists(filename) {
  const filepath = path.join(BIN_DIR, filename);
  return fs.existsSync(filepath);
}

function readJson(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function normalizePermissionList(permissions) {
  return permissions.filter(Boolean).slice().sort();
}

function resolveCurrentTargetTriple() {
  if (process.platform === 'win32' && process.arch === 'x64') {
    return 'x86_64-pc-windows-msvc';
  }
  if (process.platform === 'win32' && process.arch === 'arm64') {
    return 'aarch64-pc-windows-msvc';
  }
  if (process.platform === 'darwin' && process.arch === 'x64') {
    return 'x86_64-apple-darwin';
  }
  if (process.platform === 'darwin' && process.arch === 'arm64') {
    return 'aarch64-apple-darwin';
  }
  if (process.platform === 'linux' && process.arch === 'x64') {
    return 'x86_64-unknown-linux-gnu';
  }
  if (process.platform === 'linux' && process.arch === 'arm64') {
    return 'aarch64-unknown-linux-gnu';
  }
  return null;
}

function resolvePackagedArtifact(baseName, targetTriple) {
  if (!targetTriple) {
    return null;
  }
  return process.platform === 'win32'
    ? `${baseName}-${targetTriple}.exe`
    : `${baseName}-${targetTriple}`;
}

function packagedPythonArtifactDetail(packagedPythonArtifact, packagedPythonExists) {
  if (!packagedPythonArtifact) {
    return 'current platform/arch is not mapped to a packaged target triple';
  }
  if (packagedPythonExists) {
    return `${packagedPythonArtifact} => present`;
  }
  if (!STRICT_PACKAGING_MODE) {
    return `${packagedPythonArtifact} => missing; packaged compatibility artifact is only required for explicit packaging proof (for example npm --prefix desktop run validate:package:dry-run).`;
  }
  if (!REQUIRE_PACKAGED_COMPAT_ARTIFACT) {
    return `${packagedPythonArtifact} => missing; packaged Python compatibility artifact is only a blocking prerequisite for the supported Windows packaging target.`;
  }
  if (!fs.existsSync(LEGACY_PY_SIDECAR_ENTRY)) {
    return `${packagedPythonArtifact} => missing; current checkout does not include ${path.relative(PROJECT_ROOT, LEGACY_PY_SIDECAR_ENTRY)}. Hydrate the release-prepared Python compatibility sidecar artifact before strict desktop packaging validation.`;
  }
  return `${packagedPythonArtifact} => missing; run npm --prefix desktop run build:sidecar:python to regenerate the packaged compatibility artifact.`;
}

function validateContract(name, contract) {
  const platform = IS_WINDOWS ? 'windows' : 'unix';
  const requiredFiles = contract.files[platform];

  const results = {
    name,
    description: contract.description,
    platform,
    files: [],
    allExist: true,
  };

  for (const filename of requiredFiles) {
    const exists = checkFileExists(filename);
    results.files.push({ filename, exists });
    if (!exists) {
      results.allExist = false;
    }
  }

  return results;
}

function printResults(results) {
  console.log(`\n📦 ${results.name} (${results.description})`);
  console.log(`   Platform: ${results.platform}`);

  for (const file of results.files) {
    const icon = file.exists ? '✅' : '❌';
    console.log(`   ${icon} ${file.filename}`);
  }

  if (results.allExist) {
    console.log(`   Status: ✅ PASS`);
  } else {
    console.log(`   Status: ${STRICT_MODE ? '❌ FAIL' : '⚠️  WARN'} (missing files)`);
  }
}

function validateSecurityBoundary() {
  const tauriConfig = readJson(TAURI_CONFIG_PATH);
  const security = tauriConfig?.app?.security ?? {};
  const windowLabels = Array.isArray(tauriConfig?.app?.windows)
    ? tauriConfig.app.windows.map((windowConfig) => windowConfig?.label).filter(Boolean)
    : [];
  const capability = readJson(CAPABILITY_PATH);

  const releaseCsp = typeof security.csp === 'string' ? security.csp : '';
  const devCsp = typeof security.devCsp === 'string' ? security.devCsp : '';
  const configuredCapabilities = Array.isArray(security.capabilities) ? security.capabilities : [];
  const capabilityPermissions = Array.isArray(capability.permissions) ? capability.permissions : [];
  const capabilityWindows = Array.isArray(capability.windows) ? capability.windows : [];
  const expectedCapabilityPermissions = normalizePermissionList(EXPECTED_FRONTEND_PERMISSIONS);
  const actualCapabilityPermissions = normalizePermissionList(capabilityPermissions);

  const checks = [
    {
      label: 'main window label is explicit',
      pass: windowLabels.includes(EXPECTED_WINDOW_LABEL),
      detail: `labels=${windowLabels.join(', ') || '(none)'}`,
    },
    {
      label: 'security.capabilities pins the frontend boundary',
      pass:
        configuredCapabilities.length === 1 &&
        configuredCapabilities[0] === EXPECTED_CAPABILITY_ID,
      detail: `capabilities=${configuredCapabilities.join(', ') || '(none)'}`,
    },
    {
      label: 'release CSP constrains runtime fetches and asset loading',
      pass:
        releaseCsp.includes("default-src 'self'") &&
        releaseCsp.includes("connect-src 'self'") &&
        releaseCsp.includes('https:') &&
        releaseCsp.includes('http://127.0.0.1:*') &&
        !releaseCsp.includes("'unsafe-eval'"),
      detail: releaseCsp || '(missing)',
    },
    {
      label: 'dev CSP keeps Vite localhost access explicit',
      pass:
        devCsp.includes("script-src 'self'") &&
        devCsp.includes("'unsafe-eval'") &&
        devCsp.includes('http://localhost:*') &&
        devCsp.includes('ws://localhost:*'),
      detail: devCsp || '(missing)',
    },
    {
      label: 'freezePrototype hardening is enabled',
      pass: security.freezePrototype === true,
      detail: `freezePrototype=${security.freezePrototype}`,
    },
    {
      label: 'capability file exists for the main window only',
      pass:
        capability.identifier === EXPECTED_CAPABILITY_ID &&
        capabilityWindows.length === 1 &&
        capabilityWindows[0] === EXPECTED_WINDOW_LABEL,
      detail: `identifier=${capability.identifier}; windows=${capabilityWindows.join(', ') || '(none)'}`,
    },
    {
      label: 'frontend capability matches the explicit desktop permission contract',
      pass:
        capabilityPermissions.length === EXPECTED_FRONTEND_PERMISSIONS.length &&
        actualCapabilityPermissions.every(
          (permission, index) => permission === expectedCapabilityPermissions[index],
        ),
      detail:
        `expected=${expectedCapabilityPermissions.join(', ') || '(none)'}; ` +
        `actual=${actualCapabilityPermissions.join(', ') || '(none)'}`,
    },
  ];

  return {
    checks,
    hasFailures: checks.some((check) => !check.pass),
  };
}

function printSecurityBoundary(results) {
  console.log('\n🔐 Desktop security boundary');
  for (const check of results.checks) {
    console.log(`   ${check.pass ? '✅' : '❌'} ${check.label}`);
    if (!check.pass) {
      console.log(`      ${check.detail}`);
    }
  }
}

/**
 * ISS-20260430-001 guard: detect packaged sidecar binaries that are stale or
 * version-mismatched relative to desktop/package.json.
 *
 * Two complementary checks (both advisory until --strict-packaging promotes them):
 *   1. Manifest match — bin/sidecar.manifest.json (written by build:sidecar) must
 *      record the same version as desktop/package.json. Missing manifest is a
 *      WARNING in default mode and FAIL in --strict-packaging.
 *   2. Staleness — bundled .exe modification time must be within
 *      NIKO_SIDECAR_STALENESS_DAYS (default 30) of the package.json mtime. The
 *      v9.2.1 ISS-001 incident shipped a binary 47 days older than package.json.
 *
 * The actual /health version handshake at runtime belongs in
 * scripts/packaged_app_smoke.py (Layer 4 CI). This contract guard catches the
 * cheap case at packaging time before the installer is even built.
 */
function validateSidecarVersionContract() {
  const pkg = readJson(DESKTOP_PACKAGE_PATH);
  const expectedVersion = pkg.version;
  const targetTriple = resolveCurrentTargetTriple();
  const bundledArtifact = resolvePackagedArtifact('niko-gateway', targetTriple);
  const bundledArtifactPath = bundledArtifact ? path.join(BIN_DIR, bundledArtifact) : null;

  // Manifest check
  let manifestPresent = fs.existsSync(SIDECAR_MANIFEST_PATH);
  let manifestVersionMatches = false;
  let manifestRuntime = null;
  let manifestVersion = null;
  let manifestParseError = null;
  if (manifestPresent) {
    try {
      const manifest = readJson(SIDECAR_MANIFEST_PATH);
      manifestVersion = manifest?.version || null;
      manifestRuntime = manifest?.runtime || null;
      manifestVersionMatches = manifestVersion === expectedVersion;
    } catch (err) {
      manifestParseError = err.message;
    }
  }

  // Staleness check
  const now = Date.now();
  const pkgMtimeMs = fs.statSync(DESKTOP_PACKAGE_PATH).mtimeMs;
  let bundledMtimeMs = null;
  let bundledAgeDays = null;
  let staleVsPackage = false;
  if (bundledArtifactPath && fs.existsSync(bundledArtifactPath)) {
    bundledMtimeMs = fs.statSync(bundledArtifactPath).mtimeMs;
    const ageMs = pkgMtimeMs - bundledMtimeMs;
    bundledAgeDays = ageMs / (1000 * 60 * 60 * 24);
    // Only stale if bundled is OLDER than package.json by more than threshold
    staleVsPackage = bundledAgeDays > SIDECAR_STALENESS_DAYS;
  }

  const checks = [
    {
      label: 'sidecar.manifest.json records the build provenance',
      // In strict-packaging mode, manifest is REQUIRED. In default mode, it's advisory.
      pass: STRICT_PACKAGING_MODE
        ? manifestPresent && !manifestParseError
        : true,
      detail: manifestPresent
        ? (manifestParseError
            ? `manifest parse error: ${manifestParseError}`
            : `runtime=${manifestRuntime}, version=${manifestVersion}`)
        : 'sidecar.manifest.json missing — build:sidecar should write it on every run',
    },
    {
      label: 'bundled sidecar version matches desktop/package.json (ISS-20260430-001 guard)',
      // Hard-fail when manifest exists and version disagrees. Soft-warn when manifest is missing.
      pass: !manifestPresent || manifestParseError !== null || manifestVersionMatches,
      detail: manifestPresent && !manifestParseError
        ? `manifest=${manifestVersion}, package.json=${expectedVersion}, match=${manifestVersionMatches}`
        : `cannot verify — manifest missing or unreadable; expected version=${expectedVersion}`,
    },
    {
      label: `bundled sidecar binary is not stale vs package.json (>${SIDECAR_STALENESS_DAYS}d threshold)`,
      // Hard-fail in strict-packaging when staleness exceeds threshold AND a bundled artifact exists.
      pass: !STRICT_PACKAGING_MODE
        ? true
        : (bundledMtimeMs === null || !staleVsPackage),
      detail: bundledMtimeMs !== null
        ? `bundled=${bundledArtifact}, age_vs_package_days=${bundledAgeDays.toFixed(1)}, threshold=${SIDECAR_STALENESS_DAYS}d, stale=${staleVsPackage}`
        : `no bundled artifact for current platform/arch (${targetTriple || 'unmapped'})`,
    },
  ];

  return {
    expectedVersion,
    manifestPresent,
    manifestVersion,
    manifestVersionMatches,
    bundledAgeDays,
    staleVsPackage,
    checks,
    hasFailures: checks.some((check) => !check.pass),
  };
}

function printSidecarVersionContract(results) {
  console.log('\n🔢 Sidecar version contract (ISS-20260430-001 guard)');
  console.log(`   Expected version (desktop/package.json): ${results.expectedVersion}`);
  console.log(`   Manifest present: ${results.manifestPresent}`);
  if (results.manifestPresent) {
    console.log(`   Manifest version: ${results.manifestVersion} (match=${results.manifestVersionMatches})`);
  }
  if (results.bundledAgeDays !== null) {
    console.log(`   Bundled binary age vs package.json: ${results.bundledAgeDays.toFixed(1)}d (stale=${results.staleVsPackage})`);
  }
  for (const check of results.checks) {
    console.log(`   ${check.pass ? '✅' : '❌'} ${check.label}`);
    if (!check.pass) {
      console.log(`      ${check.detail}`);
    }
  }
}

function validatePackagingBoundary() {
  const tauriConfig = readJson(TAURI_CONFIG_PATH);
  const externalBins = Array.isArray(tauriConfig?.bundle?.externalBin)
    ? tauriConfig.bundle.externalBin
    : [];
  const targetTriple = resolveCurrentTargetTriple();
  const packagedPythonArtifact = resolvePackagedArtifact('niko-gateway', targetTriple);
  const packagedNodeArtifact = resolvePackagedArtifact('niko-gateway-node', targetTriple);
  const packagedPythonExists = packagedPythonArtifact
    ? checkFileExists(packagedPythonArtifact)
    : false;
  const packagedNodeExists = packagedNodeArtifact
    ? checkFileExists(packagedNodeArtifact)
    : false;

  const checks = [
    {
      label: 'authoritative local runtime remains node-first',
      pass: AUTHORITATIVE_RUNTIME === 'node' && checkFileExists('niko-gateway-node') && checkFileExists('niko-gateway-node.cmd'),
      detail: 'expected repo-local node launcher files',
    },
    {
      label: 'packaged externalBin stays on the python compatibility sidecar',
      pass:
        externalBins.length === 1 &&
        externalBins[0] === EXPECTED_EXTERNAL_BIN,
      detail: `externalBin=${externalBins.join(', ') || '(none)'}`,
    },
    {
      label: 'packaged compatibility artifact is present when explicit packaging proof is requested',
      pass:
        !STRICT_PACKAGING_MODE ||
        !REQUIRE_PACKAGED_COMPAT_ARTIFACT ||
        Boolean(packagedPythonArtifact && packagedPythonExists),
      detail: packagedPythonArtifactDetail(packagedPythonArtifact, packagedPythonExists),
    },
    {
      label: 'node sidecar is repo-local only and not claimed as a packaged binary',
      pass: !externalBins.includes('bin/niko-gateway-node') && !packagedNodeExists,
      detail: packagedNodeArtifact
        ? `${packagedNodeArtifact} => ${packagedNodeExists ? 'present' : 'missing'}`
        : 'current platform/arch is not mapped to a packaged target triple',
    },
  ];

  return {
    targetTriple,
    checks,
    packagedRuntime: PACKAGED_COMPAT_RUNTIME,
    hasFailures: checks.some((check) => !check.pass),
  };
}

function printPackagingBoundary(results) {
  console.log('\n🧭 Runtime / packaging matrix');
  console.log(`   Authoritative local runtime: ${AUTHORITATIVE_RUNTIME}`);
  console.log(`   Packaged compatibility runtime: ${results.packagedRuntime}`);
  console.log(`   Current target triple: ${results.targetTriple || 'unmapped'}`);
  console.log(`   Validation mode: ${STRICT_PACKAGING_MODE ? 'packaging proof' : 'local/runtime contract'}`);
  console.log('   Note: local desktop validation stays Node-first; explicit packaging proof still binds bundle.externalBin to the compatibility sidecar until a packaged Node target is intentionally introduced.');
  if (!STRICT_PACKAGING_MODE) {
    console.log('   Packaging prerequisite note: hydrated packaged compatibility artifact is checked by validate:package:dry-run, not by the generic sidecar contract gate.');
  }
  if (!REQUIRE_PACKAGED_COMPAT_ARTIFACT) {
    console.log('   Current platform note: packaged Python compatibility artifact is advisory here; the blocking packaged target remains Windows x64.');
  }

  for (const check of results.checks) {
    console.log(`   ${check.pass ? '✅' : '❌'} ${check.label}`);
    if (!check.pass) {
      console.log(`      ${check.detail}`);
    }
  }
}

function main() {
  console.log('🔍 Sidecar Contract Validator');
  console.log(`   Bin directory: ${BIN_DIR}`);
  console.log(`   Platform: ${IS_WINDOWS ? 'Windows' : 'Unix'}`);
  console.log(`   Mode: ${STRICT_MODE ? 'STRICT' : 'WARN'}`);
  console.log(`   Validation scope: ${VALIDATE_ALL_RUNTIMES ? 'all runtimes' : `${SELECTED_RUNTIME} runtime`}`);
  console.log(`   Packaging proof: ${STRICT_PACKAGING_MODE ? 'required' : 'not required'}`);

  if (!fs.existsSync(BIN_DIR)) {
    console.error(`\n❌ Bin directory not found: ${BIN_DIR}`);
    process.exit(1);
  }

  const allResults = [];
  let hasFailures = false;

  const selectedContracts = VALIDATE_ALL_RUNTIMES
    ? Object.entries(CONTRACTS)
    : [[SELECTED_RUNTIME, CONTRACTS[SELECTED_RUNTIME]]];

  for (const [name, contract] of selectedContracts) {
    const results = validateContract(name, contract);
    allResults.push(results);
    printResults(results);

    if (!results.allExist) {
      hasFailures = true;
    }
  }

  const securityBoundary = validateSecurityBoundary();
  printSecurityBoundary(securityBoundary);
  if (securityBoundary.hasFailures) {
    hasFailures = true;
  }

  const packagingBoundary = validatePackagingBoundary();
  printPackagingBoundary(packagingBoundary);
  if (packagingBoundary.hasFailures) {
    hasFailures = true;
  }

  const versionContract = validateSidecarVersionContract();
  printSidecarVersionContract(versionContract);
  if (versionContract.hasFailures) {
    hasFailures = true;
  }

  console.log('\n' + '='.repeat(60));

  if (hasFailures) {
    if (STRICT_MODE) {
      console.error('❌ Contract validation FAILED (strict mode)');
      process.exit(1);
    } else {
      console.warn('⚠️  Contract validation completed with warnings');
    }
  } else {
    console.log('✅ All contracts validated successfully');
  }
}

main();
