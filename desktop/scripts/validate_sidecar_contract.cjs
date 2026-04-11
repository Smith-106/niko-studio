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

const IS_WINDOWS = process.platform === 'win32';
const STRICT_MODE = process.argv.includes('--strict');
const VALIDATE_ALL_RUNTIMES = process.argv.includes('--all-runtimes');
const rawRuntime = (process.env.NIKO_GATEWAY_RUNTIME || '').trim().toLowerCase();
const SELECTED_RUNTIME = ['node', 'python'].includes(rawRuntime) ? rawRuntime : 'node';
const EXPECTED_WINDOW_LABEL = 'main';
const EXPECTED_CAPABILITY_ID = 'main-desktop';
const EXPECTED_EXTERNAL_BIN = 'bin/niko-gateway';
const AUTHORITATIVE_RUNTIME = 'node';
const PACKAGED_COMPAT_RUNTIME = 'python';

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
      label: 'frontend capability is limited to core invoke access',
      pass:
        capabilityPermissions.length === 1 &&
        capabilityPermissions[0] === 'core:default',
      detail: `permissions=${capabilityPermissions.join(', ') || '(none)'}`,
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
      label: 'current target has a packaged python sidecar artifact',
      pass: Boolean(packagedPythonArtifact && packagedPythonExists),
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
  console.log('   Note: packaged desktop builds currently expect a Python compatibility sidecar artifact; the Node launcher remains a repo-local path and packaged execution falls back to Python.');

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
  console.log(
    `   Validation scope: ${VALIDATE_ALL_RUNTIMES ? 'all runtimes' : `${SELECTED_RUNTIME} runtime`}`,
  );

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
