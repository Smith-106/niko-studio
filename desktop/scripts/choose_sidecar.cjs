#!/usr/bin/env node
/**
 * Sidecar Build Selector
 *
 * Chooses which sidecar to build based on NIKO_GATEWAY_RUNTIME environment variable.
 * - NIKO_GATEWAY_RUNTIME=node → Build Node sidecar
 * - NIKO_GATEWAY_RUNTIME=python (or unset) → Build Python sidecar
 *
 * This provides dual-track fallback during migration:
 * - Default: Python sidecar (stable, production-ready)
 * - Optional: Node sidecar (new runtime, under development)
 */

const { execSync } = require('child_process');
const path = require('path');

const RUNTIME = process.env.NIKO_GATEWAY_RUNTIME || 'python';
const SCRIPTS_DIR = path.resolve(__dirname);
const DESKTOP_DIR = path.resolve(SCRIPTS_DIR, '..');

function log(message) {
  console.log(`[sidecar:choose] ${message}`);
}

function buildPythonSidecar() {
  log('Building Python sidecar (default runtime)...');
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
  log('Building Node sidecar...');
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

  if (RUNTIME === 'node') {
    buildNodeSidecar();
  } else {
    buildPythonSidecar();
  }

  validateContract();
  log('✅ Sidecar build complete');
}

main();
