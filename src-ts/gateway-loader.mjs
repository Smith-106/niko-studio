/**
 * ESM loader for the Node gateway on Node >= 24.
 *
 * Node 24 removed --experimental-specifier-resolution=node, so extensionless
 * and directory-index imports in the TypeScript gateway fail. This loader wraps
 * ts-node/esm and rewrites relative specifiers to explicit .ts/.js paths.
 */
import { existsSync, statSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as tsNode from 'ts-node/esm.mjs';

function tryExtensionless(specifier, parentURL) {
  if (!parentURL || !(specifier.startsWith('./') || specifier.startsWith('../'))) {
    return null;
  }

  const parentPath = fileURLToPath(parentURL);
  const parentDir = dirname(parentPath);
  const basePath = fileURLToPath(new URL(specifier, parentURL));

  const candidates = [`${basePath}.ts`, `${basePath}.js`];
  try {
    const stat = statSync(basePath);
    if (stat.isDirectory()) {
      candidates.push(`${basePath}/index.ts`, `${basePath}/index.js`);
    }
  } catch {
    // not a directory
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      let rel = relative(parentDir, candidate).replace(/\\/g, '/');
      if (!rel.startsWith('.')) {
        rel = `./${rel}`;
      }
      return rel;
    }
  }

  return null;
}

export async function resolve(specifier, context, nextResolve) {
  try {
    return await tsNode.resolve(specifier, context, nextResolve);
  } catch (error) {
    const candidate = tryExtensionless(specifier, context.parentURL);
    if (candidate) {
      return tsNode.resolve(candidate, context, nextResolve);
    }
    throw error;
  }
}

export async function load(url, context, nextLoad) {
  return tsNode.load(url, context, nextLoad);
}

export const getFormat = tsNode.getFormat;
export const transformSource = tsNode.transformSource;
