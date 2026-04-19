#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');

const SCRIPT_DIR = __dirname;
const DESKTOP_DIR = path.resolve(SCRIPT_DIR, '..');
const PROJECT_ROOT = path.resolve(DESKTOP_DIR, '..');
const DEFAULT_STATE_PATH = path.join(PROJECT_ROOT, '.codex-run', 'desktop-local-state.json');
const DEFAULT_GATEWAY_TIMEOUT_MS = 3000;
const HEALTHY_GATEWAY_STATES = new Set(['healthy', 'ok', 'degraded']);
const VITE_BIN_PATH = path.join(DESKTOP_DIR, 'node_modules', 'vite', 'bin', 'vite.js');

function normalizeBaseUrl(value) {
  return String(value ?? '').trim().replace(/\/+$/, '');
}

function readJsonFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readTrackedGatewayBase(statePath = DEFAULT_STATE_PATH) {
  const state = readJsonFile(statePath);
  const candidate = state && state.gateway ? state.gateway.base : null;
  if (typeof candidate !== 'string' || candidate.trim().length === 0) {
    return null;
  }
  return normalizeBaseUrl(candidate);
}

function testGatewayHealth(base, timeoutMs = DEFAULT_GATEWAY_TIMEOUT_MS) {
  if (!base) {
    return Promise.resolve(false);
  }

  const normalizedBase = normalizeBaseUrl(base);
  if (!normalizedBase) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    let url;
    try {
      url = new URL(`${normalizedBase}/health`);
    } catch {
      resolve(false);
      return;
    }

    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.get(url, { timeout: timeoutMs }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          resolve(false);
          return;
        }

        try {
          const payloadText = Buffer.concat(chunks).toString('utf8').trim();
          const payload = payloadText ? JSON.parse(payloadText) : {};
          const status = String(payload.status ?? '').toLowerCase();
          resolve(HEALTHY_GATEWAY_STATES.has(status));
        } catch {
          resolve(false);
        }
      });
    });

    request.on('error', () => resolve(false));
    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function resolveLocalShellGatewayBase(options = {}) {
  const {
    env = process.env,
    statePath = env.NIKO_DESKTOP_LOCAL_STATE_PATH || DEFAULT_STATE_PATH,
    testHealth = testGatewayHealth,
  } = options;

  const explicitViteBase = normalizeBaseUrl(env.VITE_NIKO_GATEWAY_URL || '');
  if (explicitViteBase) {
    return {
      base: explicitViteBase,
      source: 'env:VITE_NIKO_GATEWAY_URL',
    };
  }

  const explicitGatewayBase = normalizeBaseUrl(env.NIKO_GATEWAY_URL || '');
  if (explicitGatewayBase) {
    return {
      base: explicitGatewayBase,
      source: 'env:NIKO_GATEWAY_URL',
    };
  }

  const trackedGatewayBase = readTrackedGatewayBase(statePath);
  if (trackedGatewayBase && (await testHealth(trackedGatewayBase))) {
    return {
      base: trackedGatewayBase,
      source: 'desktop-local-state.json',
    };
  }

  return {
    base: null,
    source: 'default',
  };
}

function buildLocalShellEnv(base, parentEnv = process.env) {
  const nextEnv = { ...parentEnv };
  const normalizedBase = normalizeBaseUrl(base || '');
  if (normalizedBase) {
    nextEnv.VITE_NIKO_GATEWAY_URL = normalizedBase;
  }
  return nextEnv;
}

function stripControlFlags(args) {
  return args.filter((arg) => arg !== '--dry-run' && arg !== '--print-json');
}

async function runCli(args = process.argv.slice(2)) {
  const dryRun = args.includes('--dry-run');
  const printJson = args.includes('--print-json');
  const viteArgs = stripControlFlags(args);

  const resolved = await resolveLocalShellGatewayBase();
  if (printJson) {
    process.stdout.write(`${JSON.stringify(resolved)}\n`);
    return 0;
  }

  if (resolved.base) {
    console.log(`[local-shell] using ${resolved.base} (${resolved.source})`);
  } else {
    console.log('[local-shell] no healthy tracked gateway found; falling back to frontend defaults');
  }

  if (dryRun) {
    return 0;
  }

  if (!fs.existsSync(VITE_BIN_PATH)) {
    console.error(`[local-shell] vite launcher not found: ${VITE_BIN_PATH}`);
    return 1;
  }

  const child = spawn(process.execPath, [VITE_BIN_PATH, ...viteArgs], {
    cwd: DESKTOP_DIR,
    env: buildLocalShellEnv(resolved.base),
    stdio: 'inherit',
  });

  return new Promise((resolve) => {
    child.on('exit', (code) => resolve(code ?? 0));
    child.on('error', (error) => {
      console.error(`[local-shell] failed to start vite shell: ${error.message}`);
      resolve(1);
    });
  });
}

if (require.main === module) {
  runCli()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`[local-shell] unexpected failure: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    });
}

module.exports = {
  DEFAULT_GATEWAY_TIMEOUT_MS,
  DEFAULT_STATE_PATH,
  HEALTHY_GATEWAY_STATES,
  VITE_BIN_PATH,
  buildLocalShellEnv,
  normalizeBaseUrl,
  readTrackedGatewayBase,
  resolveLocalShellGatewayBase,
  runCli,
  testGatewayHealth,
};
