#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.resolve(__dirname, '..', 'dist');

function walk(dir, onFile) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, onFile);
      continue;
    }
    if (entry.isFile()) {
      onFile(fullPath);
    }
  }
}

function rewriteRelativeSpecifier(spec, fileDir) {
  if (/\.(js|mjs|cjs|json)$/.test(spec)) return spec;

  const abs = path.resolve(fileDir, spec);
  // File takes priority over directory (e.g. '../types' → types.js, not types/index.js)
  const fileAbs = abs + '.js';
  try {
    if (fs.statSync(fileAbs, { throwIfNoEntry: false })) return `${spec}.js`;
  } catch { /* fall through */ }
  try {
    const stat = fs.statSync(abs, { throwIfNoEntry: false });
    if (stat && stat.isDirectory()) {
      return `${spec}/index.js`;
    }
  } catch { /* fall through */ }
  return `${spec}.js`;
}

function postprocessFile(filePath) {
  if (!filePath.endsWith('.js') && !filePath.endsWith('.mjs')) return false;

  const fileDir = path.dirname(filePath);
  const before = fs.readFileSync(filePath, 'utf8');
  let after = before;

  // Pattern 1: static `import ... from './foo'` and `export ... from './foo'`
  after = after.replace(
    /(\bfrom\s+['"])(\.\.?\/[^'"]+?)(['"])/g,
    (match, pre, spec, post) => {
      const resolved = rewriteRelativeSpecifier(spec, fileDir);
      return resolved === spec ? match : `${pre}${resolved}${post}`;
    },
  );

  // Pattern 2: dynamic `import('./foo')`
  after = after.replace(
    /(\bimport\s*\(\s*['"])(\.\.?\/[^'"]+?)(['"]\s*\))/g,
    (match, pre, spec, post) => {
      const resolved = rewriteRelativeSpecifier(spec, fileDir);
      return resolved === spec ? match : `${pre}${resolved}${post}`;
    },
  );

  if (after === before) return false;
  fs.writeFileSync(filePath, after, 'utf8');
  return true;
}

function main() {
  if (!fs.existsSync(DIST_DIR)) {
    console.log('[src-ts:postprocess] dist/ not found; skipping');
    return;
  }

  let touched = 0;
  walk(DIST_DIR, (filePath) => {
    if (postprocessFile(filePath)) touched += 1;
  });

  console.log(`[src-ts:postprocess] rewrote relative ESM imports in ${touched} file(s)`);
}

main();
