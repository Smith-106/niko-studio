import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  checkProjectTechFreshness,
  DEFAULT_PROJECT_TECH_TTL_HOURS,
  PROJECT_TECH_RELATIVE_PATH,
  PROJECT_TECH_SCHEMA_VERSION,
  refreshProjectTechMetadata,
} from '../../workflow/project-tech';

const tempDirs: string[] = [];

function createWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-project-tech-'));
  tempDirs.push(dir);
  return dir;
}

function writeProjectTech(
  workspace: string,
  payload: Record<string, unknown>,
): string {
  const filePath = path.join(workspace, PROJECT_TECH_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return filePath;
}

function createPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    overview: {
      technology_stack: {
        languages: [
          { name: 'Python', file_count: 0 },
          { name: 'TypeScript', file_count: 0 },
          { name: 'Rust', file_count: 0 },
        ],
      },
    },
    statistics: {},
    _metadata: {
      version: '1.0.0',
    },
    ...overrides,
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('workflow/project-tech', () => {
  it('classifies a missing project-tech file as skippable', () => {
    const workspace = createWorkspace();

    const result = checkProjectTechFreshness(workspace, { strict: true });

    expect(result.status).toBe('missing');
    expect(result.ok).toBe(true);
    expect(result.blocking).toBe(false);
    expect(result.path).toContain(PROJECT_TECH_RELATIVE_PATH);
  });

  it('classifies invalid payloads and stale or fresh freshness states', () => {
    const invalidWorkspace = createWorkspace();
    const invalidPath = path.join(invalidWorkspace, PROJECT_TECH_RELATIVE_PATH);
    fs.mkdirSync(path.dirname(invalidPath), { recursive: true });
    fs.writeFileSync(invalidPath, '{bad json', 'utf8');

    const invalid = checkProjectTechFreshness(invalidWorkspace, { strict: true });

    expect(invalid.status).toBe('invalid');
    expect(invalid.ok).toBe(false);
    expect(invalid.blocking).toBe(true);

    const staleWorkspace = createWorkspace();
    writeProjectTech(
      staleWorkspace,
      createPayload({
        freshness: {
          generated_at: '2026-01-01T00:00:00.000Z',
          source: 'ci',
          schema_version: PROJECT_TECH_SCHEMA_VERSION,
          ttl_hours: 24,
        },
      }),
    );

    const stale = checkProjectTechFreshness(staleWorkspace, {
      strict: true,
      now: new Date('2026-01-03T01:00:00.000Z'),
    });

    expect(stale.status).toBe('stale');
    expect(stale.ok).toBe(false);
    expect(stale.blocking).toBe(true);
    expect(stale.ttl_hours).toBe(24);
    expect(stale.source).toBe('ci');

    const freshWorkspace = createWorkspace();
    writeProjectTech(
      freshWorkspace,
      createPayload({
        freshness: {
          generated_at: '2026-01-03T00:00:00.000Z',
          source: 'manual',
          schema_version: PROJECT_TECH_SCHEMA_VERSION,
          ttl_hours: 48,
        },
      }),
    );

    const fresh = checkProjectTechFreshness(freshWorkspace, {
      strict: true,
      now: new Date('2026-01-03T12:00:00.000Z'),
    });

    expect(fresh.status).toBe('fresh');
    expect(fresh.ok).toBe(true);
    expect(fresh.blocking).toBe(false);
    expect(fresh.schema_version).toBe(PROJECT_TECH_SCHEMA_VERSION);
  });

  it('refreshes freshness metadata and language file counts in an isolated workspace', () => {
    const workspace = createWorkspace();
    writeProjectTech(workspace, createPayload());

    fs.writeFileSync(path.join(workspace, 'main.py'), 'print("hi")', 'utf8');
    fs.writeFileSync(path.join(workspace, 'worker.ts'), 'export const x = 1;', 'utf8');
    fs.writeFileSync(path.join(workspace, 'view.tsx'), 'export const View = () => null;', 'utf8');
    fs.writeFileSync(path.join(workspace, 'engine.rs'), 'fn main() {}', 'utf8');
    fs.mkdirSync(path.join(workspace, 'node_modules', 'pkg'), { recursive: true });
    fs.writeFileSync(path.join(workspace, 'node_modules', 'pkg', 'skip.ts'), 'ignored', 'utf8');

    const result = refreshProjectTechMetadata(workspace, {
      source: '  ci  ',
      ttlHours: 12,
    });
    const persisted = JSON.parse(
      fs.readFileSync(path.join(workspace, PROJECT_TECH_RELATIVE_PATH), 'utf8'),
    ) as Record<string, unknown>;
    const languages = (
      ((persisted.overview as Record<string, unknown>).technology_stack as Record<string, unknown>)
        .languages as Array<Record<string, unknown>>
    );

    expect(result.freshness).toMatchObject({
      source: 'ci',
      schema_version: PROJECT_TECH_SCHEMA_VERSION,
      ttl_hours: 12,
    });
    expect(result.language_file_counts).toMatchObject({
      Python: 1,
      TypeScript: 2,
      Rust: 1,
    });
    expect(languages).toEqual([
      { name: 'Python', file_count: 1 },
      { name: 'TypeScript', file_count: 2 },
      { name: 'Rust', file_count: 1 },
    ]);
    expect((persisted.statistics as Record<string, unknown>).last_updated).toBeTypeOf(
      'string',
    );
    expect((persisted._metadata as Record<string, unknown>).analysis_mode).toBe(
      'refresh:ci',
    );
  });

  it('rejects non-positive ttl on refresh and falls back to the default ttl when freshness ttl is invalid', () => {
    const workspace = createWorkspace();
    writeProjectTech(
      workspace,
      createPayload({
        freshness: {
          generated_at: '2026-01-03T00:00:00.000Z',
          ttl_hours: 'bad-value',
        },
      }),
    );

    expect(() =>
      refreshProjectTechMetadata(workspace, {
        source: 'manual',
        ttlHours: 0,
      }),
    ).toThrow('ttl_hours must be a positive integer');

    const fresh = checkProjectTechFreshness(workspace, {
      now: new Date('2026-01-03T12:00:00.000Z'),
    });

    expect(fresh.ttl_hours).toBe(DEFAULT_PROJECT_TECH_TTL_HOURS);
    expect(fresh.ok).toBe(true);
  });
});
