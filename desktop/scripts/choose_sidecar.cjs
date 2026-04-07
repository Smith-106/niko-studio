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

function log(message) {
  console.log(`[sidecar:choose] ${message}`);
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

  if (RUNTIME === 'python') {
    buildPythonSidecar();
  } else {
    buildNodeSidecar();
  }

  validateContract();
  log('✅ Sidecar build complete');
}

main();
