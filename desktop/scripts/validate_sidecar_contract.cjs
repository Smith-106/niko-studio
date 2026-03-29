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
 *   node scripts/validate_sidecar_contract.js [--strict]
 *
 * Options:
 *   --strict  Exit with error if any contract violation (default: warn only)
 */

const fs = require('fs');
const path = require('path');

// Script is in desktop/scripts/, project root is parent of desktop/
const SCRIPT_DIR = __dirname;
const DESKTOP_DIR = path.resolve(SCRIPT_DIR, '..');
const BIN_DIR = path.join(DESKTOP_DIR, 'src-tauri', 'bin');

const IS_WINDOWS = process.platform === 'win32';
const STRICT_MODE = process.argv.includes('--strict');

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

function main() {
  console.log('🔍 Sidecar Contract Validator');
  console.log(`   Bin directory: ${BIN_DIR}`);
  console.log(`   Platform: ${IS_WINDOWS ? 'Windows' : 'Unix'}`);
  console.log(`   Mode: ${STRICT_MODE ? 'STRICT' : 'WARN'}`);

  if (!fs.existsSync(BIN_DIR)) {
    console.error(`\n❌ Bin directory not found: ${BIN_DIR}`);
    process.exit(1);
  }

  const allResults = [];
  let hasFailures = false;

  for (const [name, contract] of Object.entries(CONTRACTS)) {
    const results = validateContract(name, contract);
    allResults.push(results);
    printResults(results);

    if (!results.allExist) {
      hasFailures = true;
    }
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
