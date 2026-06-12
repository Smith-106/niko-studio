import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { describe, expect, it } from 'vitest';

const scriptPath = fileURLToPath(
  new URL('../../scripts/postprocess_esm_imports.cjs', import.meta.url),
);
const scriptSource = readFileSync(scriptPath, 'utf8');
const distDir = path.resolve(path.dirname(scriptPath), '..', 'dist');

interface FakeDirent {
  isDirectory(): boolean;
  isFile(): boolean;
  name: string;
}

function fakeDirent(name: string, kind: 'file' | 'dir'): FakeDirent {
  return {
    name,
    isDirectory: () => kind === 'dir',
    isFile: () => kind === 'file',
  };
}

function normalizeFsPath(value: string): string {
  return value.replace(/\\/g, '/');
}

function runScriptWithFs(fsMock: {
  existsSync: (target: string) => boolean;
  readdirSync: (target: string, options?: unknown) => FakeDirent[];
  statSync: (target: string, options?: unknown) => { isDirectory(): boolean } | undefined;
  readFileSync: (target: string, encoding: string) => string;
  writeFileSync: (target: string, content: string, encoding: string) => void;
}) {
  const logs: string[] = [];

  vm.runInNewContext(
    scriptSource,
    {
      __dirname: path.dirname(scriptPath),
      console: {
        log: (message: string) => logs.push(String(message)),
      },
      exports: {},
      module: { exports: {} },
      require: (id: string) => {
        if (id === 'fs') return fsMock;
        if (id === 'path') return path;
        throw new Error(`Unexpected module: ${id}`);
      },
    },
    { filename: scriptPath },
  );

  return { logs };
}

describe('scripts/postprocess_esm_imports.cjs', () => {
  it('skips processing when dist is missing', () => {
    const { logs } = runScriptWithFs({
      existsSync: () => false,
      readdirSync: () => [],
      statSync: () => undefined,
      readFileSync: () => '',
      writeFileSync: () => {},
    });

    expect(logs).toEqual(['[src-ts:postprocess] dist/ not found; skipping']);
  });

  it('rewrites static and dynamic relative imports with file and directory fallbacks', () => {
    const writes = new Map<string, string>();
    const files = new Map<string, string>([
      [
        normalizeFsPath(path.join(distDir, 'main.js')),
        [
          "import fileTarget from './foo';",
          "export * from './bar';",
          "const lazyTarget = import('./dynamic');",
          "import keep from './keep.js';",
        ].join('\n'),
      ],
      [
        normalizeFsPath(path.join(distDir, 'nested', 'secondary.mjs')),
        "export { value } from '../util';\n",
      ],
    ]);

    const fileTargets = new Set<string>([
      normalizeFsPath(path.join(distDir, 'foo.js')),
      normalizeFsPath(path.join(distDir, 'dynamic.js')),
      normalizeFsPath(path.join(distDir, 'nested', '..', 'util.js')),
    ]);
    const directoryTargets = new Set<string>([
      normalizeFsPath(path.join(distDir, 'bar')),
    ]);

    const { logs } = runScriptWithFs({
      existsSync: (target: string) => normalizeFsPath(target) === normalizeFsPath(distDir),
      readdirSync: (target: string) => {
        const normalized = normalizeFsPath(target);
        if (normalized === normalizeFsPath(distDir)) {
          return [fakeDirent('main.js', 'file'), fakeDirent('nested', 'dir')];
        }
        if (normalized === normalizeFsPath(path.join(distDir, 'nested'))) {
          return [fakeDirent('secondary.mjs', 'file')];
        }
        return [];
      },
      statSync: (target: string) => {
        const normalized = normalizeFsPath(target);
        if (fileTargets.has(normalized)) {
          return { isDirectory: () => false };
        }
        if (directoryTargets.has(normalized)) {
          return { isDirectory: () => true };
        }
        return undefined;
      },
      readFileSync: (target: string) => {
        const normalized = normalizeFsPath(target);
        const content = files.get(normalized);
        if (!content) {
          throw new Error(`Unexpected read: ${target}`);
        }
        return content;
      },
      writeFileSync: (target: string, content: string) => {
        writes.set(normalizeFsPath(target), content);
      },
    });

    expect(writes.get(normalizeFsPath(path.join(distDir, 'main.js')))).toContain(
      "import fileTarget from './foo.js';",
    );
    expect(writes.get(normalizeFsPath(path.join(distDir, 'main.js')))).toContain(
      "export * from './bar/index.js';",
    );
    expect(writes.get(normalizeFsPath(path.join(distDir, 'main.js')))).toContain(
      "const lazyTarget = import('./dynamic.js');",
    );
    expect(writes.get(normalizeFsPath(path.join(distDir, 'main.js')))).toContain(
      "import keep from './keep.js';",
    );
    expect(writes.get(normalizeFsPath(path.join(distDir, 'nested', 'secondary.mjs')))).toContain(
      "export { value } from '../util.js';",
    );
    expect(logs).toContain('[src-ts:postprocess] rewrote relative ESM imports in 2 file(s)');
  });
});
