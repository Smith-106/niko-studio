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

describe('scripts/postprocess_esm_imports.cjs additional coverage', () => {
  it('skips non-js files and leaves already-resolved dynamic imports untouched', () => {
    const writes = new Map<string, string>();
    const scriptFile = normalizeFsPath(path.join(distDir, 'keep.mjs'));
    const ignoredFile = normalizeFsPath(path.join(distDir, 'notes.txt'));
    const files = new Map<string, string>([
      [scriptFile, "const lazyTarget = import('./already.js');\n"],
    ]);

    const { logs } = runScriptWithFs({
      existsSync: (target: string) => normalizeFsPath(target) === normalizeFsPath(distDir),
      readdirSync: (target: string) => {
        const normalized = normalizeFsPath(target);
        if (normalized === normalizeFsPath(distDir)) {
          return [fakeDirent('keep.mjs', 'file'), fakeDirent('notes.txt', 'file')];
        }
        return [];
      },
      statSync: () => undefined,
      readFileSync: (target: string) => {
        const content = files.get(normalizeFsPath(target));
        if (!content) {
          throw new Error(`Unexpected read: ${target}`);
        }
        return content;
      },
      writeFileSync: (target: string, content: string) => {
        writes.set(normalizeFsPath(target), content);
      },
    });

    expect(files.has(scriptFile)).toBe(true);
    expect(ignoredFile.endsWith('.txt')).toBe(true);
    expect(writes.size).toBe(0);
    expect(logs).toContain('[src-ts:postprocess] rewrote relative ESM imports in 0 file(s)');
  });

  it('falls back to appending .js when fs stat probes throw', () => {
    const writes = new Map<string, string>();
    const entryFile = normalizeFsPath(path.join(distDir, 'main.js'));
    const files = new Map<string, string>([
      [
        entryFile,
        [
          "export * from './broken-dir';",
          "const lazyTarget = import('./broken-dynamic');",
        ].join('\n'),
      ],
    ]);

    const throwingTargets = new Set<string>([
      normalizeFsPath(path.join(distDir, 'broken-dir.js')),
      normalizeFsPath(path.join(distDir, 'broken-dir')),
      normalizeFsPath(path.join(distDir, 'broken-dynamic.js')),
      normalizeFsPath(path.join(distDir, 'broken-dynamic')),
    ]);

    const { logs } = runScriptWithFs({
      existsSync: (target: string) => normalizeFsPath(target) === normalizeFsPath(distDir),
      readdirSync: (target: string) => {
        const normalized = normalizeFsPath(target);
        if (normalized === normalizeFsPath(distDir)) {
          return [fakeDirent('main.js', 'file')];
        }
        return [];
      },
      statSync: (target: string) => {
        if (throwingTargets.has(normalizeFsPath(target))) {
          throw new Error(`stat failed: ${target}`);
        }
        return undefined;
      },
      readFileSync: (target: string) => {
        const content = files.get(normalizeFsPath(target));
        if (!content) {
          throw new Error(`Unexpected read: ${target}`);
        }
        return content;
      },
      writeFileSync: (target: string, content: string) => {
        writes.set(normalizeFsPath(target), content);
      },
    });

    expect(writes.get(entryFile)).toContain("export * from './broken-dir.js';");
    expect(writes.get(entryFile)).toContain("const lazyTarget = import('./broken-dynamic.js');");
    expect(logs).toContain('[src-ts:postprocess] rewrote relative ESM imports in 1 file(s)');
  });
});
