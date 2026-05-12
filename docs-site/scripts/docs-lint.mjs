import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dataDir = resolve(root, 'src/client/data');
const repoRoot = resolve(root, '..');

function read(path) {
  return readFileSync(path, 'utf8');
}

function extractDocPages() {
  const inventory = read(resolve(dataDir, 'inventory.ts'));
  const pageRegex = /\{\s*id:\s*'([^']+)'\s*,\s*title:\s*'([^']+)'\s*,\s*category:\s*'([^']+)'\s*,\s*description:\s*'([^']+)'\s*,\s*slug:\s*'([^']+)'\s*\}/g;
  return Array.from(inventory.matchAll(pageRegex)).map((match) => ({
    id: match[1],
    title: match[2],
    category: match[3],
    description: match[4],
    slug: match[5],
  }));
}

function extractCategories() {
  const inventory = read(resolve(dataDir, 'inventory.ts'));
  const categoriesBlock = inventory.slice(
    inventory.indexOf('export const categories'),
    inventory.indexOf('export const docPages')
  );
  const categoryRegex = /id:\s*'([^']+)'/g;
  return Array.from(categoriesBlock.matchAll(categoryRegex)).map((match) => match[1]);
}

function extractContentEntries() {
  const files = readdirSync(dataDir).filter((file) => /^content-.+\.ts$/.test(file));
  const entries = new Map();
  const duplicates = [];

  for (const file of files) {
    const source = read(resolve(dataDir, file));
    const entryRegex = /['"]?([a-zA-Z0-9-]+)['"]?\s*:\s*`([\s\S]*?)`\s*,/g;
    for (const match of source.matchAll(entryRegex)) {
      const id = match[1];
      const body = match[2].trim();
      if (entries.has(id)) {
        duplicates.push(id);
      }
      entries.set(id, { file, body });
    }
  }

  return { entries, duplicates, files };
}

function stripHtml(value) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const verifiedEndpointAllowlist = new Map([
  ['POST /writing/novel-quality-check', 'writing-api capability documented in gateway surface'],
  ['POST /writing/stream', 'writing stream capability documented in gateway surface'],
  ['GET /graph/characters', 'graph API capability documented in graph category'],
  ['GET /graph/relationships', 'graph API capability documented in graph category'],
  ['GET /graph/foreshadows', 'foreshadow tracking capability documented in graph category'],
  ['POST /m10/style/extract', 'M10 style profile capability'],
  ['GET /m10/style/profile', 'M10 style profile capability'],
  ['POST /m10/style/apply', 'M10 style profile capability'],
  ['POST /m10/revise/multi-pass', 'M10 multi-pass revision capability'],
  ['POST /m10/context-suggestions', 'M10 context suggestion capability'],
  ['GET /wiki/list', 'wiki system capability'],
  ['GET /wiki/page/:id', 'wiki system capability'],
  ['GET /secrets', 'configuration capability'],
  ['GET /workspace/context', 'workspace context capability'],
  ['POST /critic/cross-chapter', 'cross-chapter consistency capability'],
  ['POST /graph/foreshadow/plant', 'foreshadow tracking capability'],
  ['GET /graph/foreshadow/stats', 'foreshadow tracking capability'],
  ['POST /graph/character/:id/depth', 'character depth capability'],
  ['POST /m11/worldview/extract', 'M11 worldview capability'],
  ['GET /m11/worldview', 'M11 worldview capability'],
  ['GET /m11/worldview/:category', 'M11 worldview capability'],
]);

function extractDocumentedEndpoints(entries) {
  const endpoints = new Set();
  const endpointRegex = /\b(GET|POST|PUT|DELETE|PATCH)\s+\/[a-zA-Z0-9_/:.-]+/g;
  for (const { body } of entries.values()) {
    for (const match of body.matchAll(endpointRegex)) {
      endpoints.add(match[0].replace(/\s+/g, ' '));
    }
  }
  return endpoints;
}

function collectSourceEndpointHints() {
  const hints = new Set();
  const candidates = [
    'desktop/src/api',
    'src-ts/mcp',
    'src-ts/tests/mcp',
  ];
  const fileQueue = [];

  for (const candidate of candidates) {
    const dir = resolve(repoRoot, candidate);
    try {
      for (const file of walk(dir)) {
        if (/\.(ts|tsx|js|jsx)$/.test(file)) {
          fileQueue.push(file);
        }
      }
    } catch {
      // optional source area
    }
  }

  const apiCallRegex = /['"](\/[a-zA-Z0-9_/:.-]+)['"]\s*,\s*['"](GET|POST|PUT|DELETE|PATCH)['"]/g;
  const routeRegex = /['"](GET|POST|PUT|DELETE|PATCH)['"]\s*,\s*['"](\/[a-zA-Z0-9_/:.-]+)['"]/g;

  for (const file of fileQueue) {
    const source = read(file);
    for (const match of source.matchAll(apiCallRegex)) {
      hints.add(`${match[2]} ${match[1]}`);
    }
    for (const match of source.matchAll(routeRegex)) {
      hints.add(`${match[1]} ${match[2]}`);
    }
  }

  return hints;
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else {
      yield fullPath;
    }
  }
}

const pages = extractDocPages();
const categories = new Set(extractCategories());
const { entries, duplicates, files } = extractContentEntries();
const errors = [];
const warnings = [];

for (const page of pages) {
  if (!categories.has(page.category)) {
    errors.push(`Unknown category for ${page.id}: ${page.category}`);
  }
  if (!entries.has(page.id)) {
    errors.push(`Missing content for doc page: ${page.id}`);
    continue;
  }

  const body = entries.get(page.id).body;
  const plain = stripHtml(body);
  if (plain.length < 80) {
    warnings.push(`Content is short for ${page.id}: ${plain.length} chars`);
  }
  if (!/<h2[\s>]/.test(body)) {
    warnings.push(`No h2 heading in ${page.id}`);
  }
}

for (const id of entries.keys()) {
  if (!pages.some((page) => page.id === id)) {
    errors.push(`Orphan content entry without docPages item: ${id}`);
  }
}

const seenSlugs = new Set();
for (const page of pages) {
  const key = `${page.category}/${page.slug}`;
  if (seenSlugs.has(key)) {
    errors.push(`Duplicate route slug: ${key}`);
  }
  seenSlugs.add(key);
}

for (const id of duplicates) {
  errors.push(`Duplicate content entry: ${id}`);
}

const documentedEndpoints = extractDocumentedEndpoints(entries);
const sourceHints = collectSourceEndpointHints();
for (const endpoint of documentedEndpoints) {
  const isGenericGatewayEndpoint = endpoint.startsWith('POST /api/') || endpoint.startsWith('GET /api/');
  const isConfirmed = sourceHints.has(endpoint) || verifiedEndpointAllowlist.has(endpoint) || isGenericGatewayEndpoint;
  if (!isConfirmed) {
    warnings.push(`Endpoint not confirmed in scanned source or allowlist: ${endpoint}`);
  }
}

console.log(`Docs lint checked ${pages.length} pages across ${files.length} content files.`);
if (warnings.length > 0) {
  console.warn('\nWarnings:');
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}

if (errors.length > 0) {
  console.error('\nErrors:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Docs lint passed.');
