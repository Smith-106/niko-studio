/**
 * Coverage gap scanner for MCP route wiring.
 *
 * Scans the mcp/routes directory for route definitions and the tests
 * directory for test references. Reports route modules that lack a dedicated
 * contract test and endpoint handlers that are not referenced by any test file.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ROUTES_DIR = path.join(PROJECT_ROOT, 'mcp', 'routes');
const TESTS_DIR = path.join(PROJECT_ROOT, 'tests');

interface RouteInfo {
  method: string;
  patternSource: string;
  patternFlags: string;
  handler: string;
  paramNames: string[];
}

interface RouteModule {
  fileName: string;
  moduleName: string;
  constName: string;
  routes: RouteInfo[];
}

interface ScanResult {
  uncoveredRouteModules: Array<{
    module: string;
    file: string;
    routeCount: number;
  }>;
  uncoveredHandlers: Array<{
    module: string;
    handler: string;
    method: string;
    pattern: string;
  }>;
  summary: {
    totalModules: number;
    coveredModules: number;
    uncoveredModules: number;
    totalRoutes: number;
    totalHandlers: number;
    uncoveredHandlerCount: number;
  };
}

function collectTestFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTestFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

function readTextFiles(paths: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of paths) {
    map[p] = fs.readFileSync(p, 'utf-8');
  }
  return map;
}

function parseRouteModules(): RouteModule[] {
  const modules: RouteModule[] = [];
  for (const entry of fs.readdirSync(ROUTES_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.ts') || entry.name === 'index.ts') {
      continue;
    }

    const filePath = path.join(ROUTES_DIR, entry.name);
    const content = fs.readFileSync(filePath, 'utf-8');

    const constMatch = content.match(/export\s+const\s+(\w+)Routes\s*:\s*GatewayRoute\[\]\s*=\s*\[/);
    if (!constMatch) {
      continue;
    }

    const constName = constMatch[1];
    const moduleName = constName.replace(/Routes$/, '').toLowerCase();
    const routes: RouteInfo[] = [];

    const routeRegex =
      /\{\s*method:\s*'([^']+)'\s*,\s*pattern:\s*\/(.+?)\/([gimsuy]*)\s*,\s*handler:\s*(\w+)(?:\s*,\s*paramNames:\s*\[([^\]]*)\])?\s*\}/g;

    let match: RegExpExecArray | null;
    while ((match = routeRegex.exec(content)) !== null) {
      const paramNames = match[5]
        ? match[5]
            .split(',')
            .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
            .filter(Boolean)
        : [];
      routes.push({
        method: match[1],
        patternSource: match[2],
        patternFlags: match[3],
        handler: match[4],
        paramNames,
      });
    }

    modules.push({ fileName: entry.name, moduleName, constName, routes });
  }
  return modules;
}

function isModuleCovered(moduleName: string, constName: string, testContents: string[]): boolean {
  const modulePattern = new RegExp(`mcp/routes/${moduleName}\\b`);
  return testContents.some(
    (content) =>
      content.includes(constName) ||
      modulePattern.test(content) ||
      content.includes(`'${moduleName}'`) ||
      content.includes(`"${moduleName}"`),
  );
}

function isHandlerCovered(handler: string, testContents: string[]): boolean {
  return testContents.some((content) => content.includes(handler));
}

function runScan(): ScanResult {
  const modules = parseRouteModules();
  const testFiles = collectTestFiles(TESTS_DIR);
  const testContents = Object.values(readTextFiles(testFiles));

  const uncoveredRouteModules: ScanResult['uncoveredRouteModules'] = [];
  const uncoveredHandlers: ScanResult['uncoveredHandlers'] = [];

  let totalRoutes = 0;

  for (const mod of modules) {
    totalRoutes += mod.routes.length;
    const moduleCovered = isModuleCovered(mod.moduleName, mod.constName, testContents);

    if (!moduleCovered) {
      uncoveredRouteModules.push({
        module: mod.moduleName,
        file: mod.fileName,
        routeCount: mod.routes.length,
      });
    }

    for (const route of mod.routes) {
      if (!isHandlerCovered(route.handler, testContents)) {
        uncoveredHandlers.push({
          module: mod.moduleName,
          handler: route.handler,
          method: route.method,
          pattern: `/${route.patternSource}/${route.patternFlags}`,
        });
      }
    }
  }

  return {
    uncoveredRouteModules,
    uncoveredHandlers,
    summary: {
      totalModules: modules.length,
      coveredModules: modules.length - uncoveredRouteModules.length,
      uncoveredModules: uncoveredRouteModules.length,
      totalRoutes,
      totalHandlers: totalRoutes,
      uncoveredHandlerCount: uncoveredHandlers.length,
    },
  };
}

function printTable(result: ScanResult): void {
  console.log('\nCoverage Gap Scanner');
  console.log('====================\n');

  console.log('Summary:');
  console.log(`  Total route modules:  ${result.summary.totalModules}`);
  console.log(`  Covered modules:      ${result.summary.coveredModules}`);
  console.log(`  Uncovered modules:    ${result.summary.uncoveredModules}`);
  console.log(`  Total routes:         ${result.summary.totalRoutes}`);
  console.log(`  Uncovered handlers:   ${result.summary.uncoveredHandlerCount}`);

  if (result.uncoveredRouteModules.length > 0) {
    console.log('\nUncovered route modules (no dedicated contract test):');
    console.table(result.uncoveredRouteModules);
  }

  if (result.uncoveredHandlers.length > 0) {
    console.log('\nUncovered handlers (not referenced in any test):');
    console.table(result.uncoveredHandlers);
  }

  if (result.uncoveredRouteModules.length === 0 && result.uncoveredHandlers.length === 0) {
    console.log('\nNo coverage gaps found.');
  }
}

function main(): void {
  const isCheckMode = process.argv.includes('--check');
  const result = runScan();

  console.log(JSON.stringify(result, null, 2));
  printTable(result);

  if (isCheckMode && (result.uncoveredRouteModules.length > 0 || result.uncoveredHandlers.length > 0)) {
    process.exit(1);
  }
}

main();
