#!/usr/bin/env node
/**
 * Build Node Sidecar Bundle (ISS-20260430-001 fix)
 *
 * Stages the v9.2.1 Node TS gateway as a self-contained bundle under
 *   desktop/src-tauri/bin/sidecar/
 * suitable for shipping inside the NSIS installer alongside the
 * niko-gateway-launcher.exe stub.
 *
 * Layout produced (Windows-x64 example):
 *   desktop/src-tauri/bin/
 *   ├── niko-gateway-x86_64-pc-windows-msvc.exe   (the launcher — built by cargo)
 *   ├── sidecar.manifest.json                      (provenance — written separately)
 *   └── sidecar/
 *       ├── node.exe                               (portable Node 20 LTS — fetched here)
 *       ├── gateway-server.js                      (compiled src-ts entry)
 *       ├── (dist/ tree of compiled JS)
 *       ├── package.json                           (production deps subset)
 *       └── node_modules/                          (npm install --omit=dev native modules)
 *
 * Pipeline steps:
 *   1. Build src-ts → dist/
 *   2. Stage dist/* + package.json + package-lock.json into bin/sidecar/
 *   3. Hydrate node_modules with --omit=dev to grab native module prebuilds
 *   4. Optionally fetch a portable Node 20 LTS distribution (skipped when
 *      NIKO_SIDECAR_BUNDLE_NODE=false; the launcher then falls back to PATH).
 *
 * The bundled Node is downloaded once into a repo-local cache outside the
 * source tree (.workflow/.cache/portable-node/) and copied into bin/sidecar/
 * on each rebuild. Re-running this script is idempotent.
 *
 * Usage:
 *   node desktop/scripts/build_node_sidecar.cjs              # full build incl Node fetch
 *   NIKO_SIDECAR_BUNDLE_NODE=false node ...                  # skip Node fetch (rely on PATH)
 *   NIKO_SIDECAR_PORTABLE_NODE_VERSION=20.18.1 node ...      # pin Node version
 */

const fs = require('fs');
const fsp = require('fs').promises;
const https = require('https');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPTS_DIR = __dirname;
const DESKTOP_DIR = path.resolve(SCRIPTS_DIR, '..');
const PROJECT_ROOT = path.resolve(DESKTOP_DIR, '..');
const SRC_TS_DIR = path.join(PROJECT_ROOT, 'src-ts');
const BIN_DIR = path.join(DESKTOP_DIR, 'src-tauri', 'bin');
const STAGE_DIR = path.join(BIN_DIR, 'sidecar');
const CACHE_DIR = path.join(PROJECT_ROOT, '.workflow', '.cache', 'portable-node');

const NODE_VERSION = (process.env.NIKO_SIDECAR_PORTABLE_NODE_VERSION || '20.18.1').replace(/^v/, '');
const BUNDLE_NODE = (process.env.NIKO_SIDECAR_BUNDLE_NODE || 'true').toLowerCase() !== 'false';

function log(msg) {
  console.log(`[sidecar:bundle] ${msg}`);
}

function rmRfSync(target) {
  if (!fs.existsSync(target)) return;
  // Windows fails on deep node_modules trees with default fs.rmSync due to
  // the legacy MAX_PATH limit (260 chars). Two safeguards:
  //   - maxRetries handles transient EBUSY (esp. with antivirus scanners)
  //   - shell out to `rmdir /s /q` (Windows) or `rm -rf` (POSIX) as fallback
  try {
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    if (!fs.existsSync(target)) return;
  } catch {
    // Fall through to shell-based deletion
  }
  try {
    if (process.platform === 'win32') {
      // Use \\?\ long-path prefix and prefer rimraf-style rmdir.
      const winPath = path.resolve(target).replace(/\//g, '\\');
      execSync(`rmdir /s /q "${winPath}"`, { stdio: 'ignore' });
    } else {
      execSync(`rm -rf "${target}"`, { stdio: 'ignore' });
    }
  } catch {
    // last-resort: leave it; caller will see remaining files
  }
}

function copyTreeSync(src, dest, opts = {}) {
  const { ignoreNames = [] } = opts;
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (ignoreNames.includes(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyTreeSync(srcPath, destPath, opts);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function buildSrcTs() {
  log('compiling src-ts → dist/ via npm run build');
  execSync('npm run build', { cwd: SRC_TS_DIR, stdio: 'inherit' });
  log('post-processing compiled JS: adding .js extensions to ESM relative imports');
  addExtensionsToEsmImports(path.join(SRC_TS_DIR, 'dist'));
}

/**
 * The src-ts TypeScript source omits .js extensions in relative imports
 * (e.g. `import { foo } from './bar'`). Node ESM requires explicit
 * extensions, so we post-process the compiled JS to add `.js` where
 * missing. This is the same transform tsc-alias performs but lighter
 * weight and dependency-free.
 *
 * Skips: imports that already have an extension (.js, .json, .mjs, .cjs),
 * absolute imports, package imports (no leading `./` or `../`).
 */
function addExtensionsToEsmImports(rootDir) {
  let touched = 0;
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(p);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.js') && !entry.name.endsWith('.mjs')) continue;
      let src = fs.readFileSync(p, 'utf8');
      const before = src;
      // Pattern 1: static `import ... from './foo'` and `export ... from './foo'`
      src = src.replace(
        /(\bfrom\s+['"])(\.\.?\/[^'"]+?)(['"])/g,
        (m, pre, spec, post) => {
          if (/\.(js|mjs|cjs|json)$/.test(spec)) return m;
          // Resolve to disk to decide between file vs directory (dir → /index.js)
          const abs = path.resolve(dir, spec);
          let resolved = `${spec}.js`;
          try {
            const stat = fs.statSync(abs);
            if (stat.isDirectory()) {
              resolved = `${spec}/index.js`;
            }
          } catch {
            // fallthrough — assume `.js` sibling
          }
          return `${pre}${resolved}${post}`;
        },
      );
      // Pattern 2: dynamic `import('./foo')`
      src = src.replace(
        /(\bimport\s*\(\s*['"])(\.\.?\/[^'"]+?)(['"]\s*\))/g,
        (m, pre, spec, post) => {
          if (/\.(js|mjs|cjs|json)$/.test(spec)) return m;
          const abs = path.resolve(dir, spec);
          let resolved = `${spec}.js`;
          try {
            const stat = fs.statSync(abs);
            if (stat.isDirectory()) resolved = `${spec}/index.js`;
          } catch {
            // fallthrough
          }
          return `${pre}${resolved}${post}`;
        },
      );
      if (src !== before) {
        fs.writeFileSync(p, src, 'utf8');
        touched += 1;
      }
    }
  }
  walk(rootDir);
  log(`post-process: rewrote relative imports in ${touched} file(s)`);
}

function stageDist() {
  log(`staging compiled JS into ${path.relative(PROJECT_ROOT, STAGE_DIR)}`);
  rmRfSync(STAGE_DIR);
  fs.mkdirSync(STAGE_DIR, { recursive: true });
  copyTreeSync(path.join(SRC_TS_DIR, 'dist'), STAGE_DIR, { ignoreNames: [] });

  // Runtime JSON catalogs are loaded from relative disk paths and are not emitted by tsc.
  const writingCraftCatalogSrc = path.join(
    SRC_TS_DIR,
    'narrative',
    'writing-craft',
    'catalog-data',
  );
  const writingCraftCatalogDest = path.join(
    STAGE_DIR,
    'narrative',
    'writing-craft',
    'catalog-data',
  );
  copyTreeSync(writingCraftCatalogSrc, writingCraftCatalogDest, { ignoreNames: [] });

  // Copy package.json + package-lock.json so npm ci --omit=dev can hydrate native modules.
  // We use the full package.json (not a trimmed subset) to ensure the version lockfile resolves.
  fs.copyFileSync(
    path.join(SRC_TS_DIR, 'package.json'),
    path.join(STAGE_DIR, 'package.json'),
  );
  const lockfile = path.join(SRC_TS_DIR, 'package-lock.json');
  if (fs.existsSync(lockfile)) {
    fs.copyFileSync(lockfile, path.join(STAGE_DIR, 'package-lock.json'));
  }
}

function hydrateProductionDeps() {
  log(`hydrating production deps in ${path.relative(PROJECT_ROOT, STAGE_DIR)} (npm ci --omit=dev)`);
  // Use --omit=dev to skip vitest/eslint/etc (~600 MB savings).
  // --ignore-scripts is intentionally NOT set: we want better-sqlite3 + fastembed
  // postinstall hooks to fetch the correct prebuilds for the build host arch.
  //
  // ABI alignment (ISS-20260430-001 follow-up): when BUNDLE_NODE=true the runtime
  // Node version may differ from the build-host Node (e.g. host=v24, bundled=v20).
  // prebuild-install / node-gyp inspect npm_config_target to pick the matching
  // NODE_MODULE_VERSION prebuild. Without this, better-sqlite3 ships a v24 ABI
  // .node that fails to load under v20 with "compiled against a different Node.js
  // version using NODE_MODULE_VERSION 137. This version of Node.js requires
  // NODE_MODULE_VERSION 115."
  const env = { ...process.env };
  if (BUNDLE_NODE) {
    env.npm_config_target = NODE_VERSION;
    env.npm_config_runtime = 'node';
    env.npm_config_target_arch = process.arch;
    env.npm_config_target_platform = process.platform;
    env.npm_config_disturl = 'https://nodejs.org/dist';
    env.npm_config_build_from_source = 'false';
    log(`  ABI target: Node v${NODE_VERSION} on ${process.platform}-${process.arch} (forces matching prebuilds)`);
  }
  execSync('npm ci --omit=dev --no-audit --no-fund', {
    cwd: STAGE_DIR,
    stdio: 'inherit',
    env,
  });
}

/**
 * Cross-platform native binaries are the largest single contributor to bundle
 * size for fastembed/onnxruntime-node/sharp. Each ships prebuilds for every
 * (os × arch) combination — for a Windows-x64 NSIS installer we only need
 * win32/x64. This function prunes the rest.
 *
 * Total savings with default rules: ~150-200 MB on Windows-x64.
 *
 * Trimming is best-effort: missing directories are silently skipped so the
 * function is forward-compatible with future package layout changes.
 */
function trimCrossPlatformBinaries() {
  const isWinX64 = process.platform === 'win32' && process.arch === 'x64';
  if (!isWinX64) {
    log(`trim: build host is ${process.platform}-${process.arch}, skipping win32-x64 trimming rules`);
    return;
  }

  const trimRules = [
    // onnxruntime-node ships prebuilds for darwin/linux/win32 × x64/arm64.
    // Keep only win32/x64.
    {
      glob: 'node_modules/onnxruntime-node/bin/napi-v3',
      keep: ['win32'],
      sub: { 'win32': ['x64'] },
    },
    {
      glob: 'node_modules/fastembed/node_modules/onnxruntime-node/bin/napi-v3',
      keep: ['win32'],
      sub: { 'win32': ['x64'] },
    },
    // onnxruntime-web is the browser variant; not used by Node-side embedding.
    { remove: 'node_modules/onnxruntime-web' },
    { remove: 'node_modules/fastembed/node_modules/onnxruntime-web' },
    // @xenova/transformers ships a 44MB browser dist that mirrors the src/.
    // Node consumers use src/; dist/ is dead weight for our use case.
    { remove: 'node_modules/@xenova/transformers/dist' },
    // sharp prebuilds for non-win-x64 platforms.
    { glob: 'node_modules/@img', keep: ['sharp-win32-x64', 'sharp-libvips-win32-x64'] },
  ];

  let totalRemoved = 0;
  for (const rule of trimRules) {
    if (rule.remove) {
      const target = path.join(STAGE_DIR, rule.remove);
      if (fs.existsSync(target)) {
        const size = directorySizeBytes(target);
        rmRfSync(target);
        log(`  trim: removed ${rule.remove} (~${(size / 1024 / 1024).toFixed(1)} MB)`);
        totalRemoved += size;
      }
      continue;
    }
    if (rule.glob && rule.keep) {
      const dir = path.join(STAGE_DIR, rule.glob);
      if (!fs.existsSync(dir)) continue;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const entryPath = path.join(dir, entry.name);
        if (!rule.keep.includes(entry.name)) {
          const size = directorySizeBytes(entryPath);
          rmRfSync(entryPath);
          log(`  trim: removed ${rule.glob}/${entry.name} (~${(size / 1024 / 1024).toFixed(1)} MB)`);
          totalRemoved += size;
        } else if (rule.sub && rule.sub[entry.name]) {
          // Recursive sub-trim (e.g. keep win32 but only its x64 child)
          for (const subEntry of fs.readdirSync(entryPath, { withFileTypes: true })) {
            if (!subEntry.isDirectory()) continue;
            if (!rule.sub[entry.name].includes(subEntry.name)) {
              const subPath = path.join(entryPath, subEntry.name);
              const size = directorySizeBytes(subPath);
              rmRfSync(subPath);
              log(`  trim: removed ${rule.glob}/${entry.name}/${subEntry.name} (~${(size / 1024 / 1024).toFixed(1)} MB)`);
              totalRemoved += size;
            }
          }
        }
      }
    }
  }
  log(`trim: total removed ~${(totalRemoved / 1024 / 1024).toFixed(1)} MB`);
}

function directorySizeBytes(dir) {
  let total = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += directorySizeBytes(p);
    } else {
      try {
        total += fs.statSync(p).size;
      } catch {
        // ignore symlinks / missing files
      }
    }
  }
  return total;
}

function fetchToFile(url, destPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const file = fs.createWriteStream(destPath);
    function follow(currentUrl, redirectsLeft) {
      const req = https.get(currentUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
          if (redirectsLeft <= 0) {
            reject(new Error(`Too many redirects for ${url}`));
            return;
          }
          res.resume();
          follow(res.headers.location, redirectsLeft - 1);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} fetching ${currentUrl}`));
          res.resume();
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(destPath)));
      });
      req.on('error', reject);
    }
    follow(url, 5);
  });
}

async function ensurePortableNode() {
  if (!BUNDLE_NODE) {
    log('NIKO_SIDECAR_BUNDLE_NODE=false — skipping portable Node fetch; launcher will fall back to system PATH at runtime');
    return null;
  }
  if (process.platform !== 'win32') {
    log(`portable Node bundling currently only implemented for win32; current platform=${process.platform}, skipping`);
    return null;
  }

  const arch = process.arch === 'x64' ? 'x64' : process.arch === 'arm64' ? 'arm64' : null;
  if (!arch) {
    log(`unsupported arch ${process.arch}; skipping portable Node fetch`);
    return null;
  }

  const archiveName = `node-v${NODE_VERSION}-win-${arch}.zip`;
  const archiveUrl = `https://nodejs.org/dist/v${NODE_VERSION}/${archiveName}`;
  const archivePath = path.join(CACHE_DIR, archiveName);
  const extractedDir = path.join(CACHE_DIR, `node-v${NODE_VERSION}-win-${arch}`);

  if (!fs.existsSync(extractedDir)) {
    if (!fs.existsSync(archivePath)) {
      log(`downloading portable Node ${NODE_VERSION} from ${archiveUrl}`);
      await fetchToFile(archiveUrl, archivePath);
    } else {
      log(`reusing cached archive ${path.relative(PROJECT_ROOT, archivePath)}`);
    }
    log(`extracting ${archiveName} → ${path.relative(PROJECT_ROOT, extractedDir)}`);
    // Use PowerShell Expand-Archive; available on every supported Windows host.
    execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Force -LiteralPath '${archivePath}' -DestinationPath '${CACHE_DIR}'"`,
      { stdio: 'inherit' },
    );
  } else {
    log(`reusing extracted Node ${NODE_VERSION} at ${path.relative(PROJECT_ROOT, extractedDir)}`);
  }

  const nodeExe = path.join(extractedDir, 'node.exe');
  if (!fs.existsSync(nodeExe)) {
    throw new Error(`expected node.exe not found at ${nodeExe}`);
  }
  const destNode = path.join(STAGE_DIR, 'node.exe');
  fs.copyFileSync(nodeExe, destNode);
  log(`copied portable node.exe → ${path.relative(PROJECT_ROOT, destNode)}`);
  return destNode;
}

async function main() {
  log(`build host: ${process.platform}-${process.arch}, Node ${process.version}`);
  log(`stage dir: ${STAGE_DIR}`);
  log(`bundled Node version: v${NODE_VERSION} (NIKO_SIDECAR_BUNDLE_NODE=${BUNDLE_NODE})`);

  buildSrcTs();
  stageDist();
  hydrateProductionDeps();
  trimCrossPlatformBinaries();
  await ensurePortableNode();

  log('✅ Node sidecar bundle staged');
  log('   Next: cargo build --release --bin niko-gateway-launcher');
  log('   Then: copy launcher to bin/niko-gateway-x86_64-pc-windows-msvc.exe and run validate:sidecar-contract');
}

main().catch((err) => {
  console.error(`[sidecar:bundle] FAILED: ${err.message}`);
  process.exit(1);
});
