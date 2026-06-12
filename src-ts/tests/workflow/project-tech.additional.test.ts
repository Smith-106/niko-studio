import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  checkProjectTechFreshness,
  DEFAULT_PROJECT_TECH_TTL_HOURS,
  PROJECT_TECH_RELATIVE_PATH,
  refreshProjectTechMetadata,
} from '../../workflow/project-tech.js';

const tempDirs: string[] = [];

function createWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-project-tech-extra-'));
  tempDirs.push(dir);
  return dir;
}

function writeProjectTech(workspace: string, payload: unknown): string {
  const filePath = path.join(workspace, PROJECT_TECH_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return filePath;
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('workflow/project-tech additional coverage', () => {
  it('refreshes payloads with null metadata, default source fallback, and unreadable subdirectories', () => {
    const workspace = createWorkspace();
    writeProjectTech(workspace, {
      overview: {
        technology_stack: {
          languages: [
            null,
            { file_count: 5 },
            { name: 'TypeScript', file_count: 0 },
            { name: 'Go', file_count: 99 },
          ],
        },
      },
      statistics: null,
      _metadata: null,
    });

    fs.writeFileSync(path.join(workspace, 'main.ts'), 'export const value = 1;\n', 'utf8');
    fs.mkdirSync(path.join(workspace, '.git'), { recursive: true });
    fs.writeFileSync(path.join(workspace, '.git', 'ignored.ts'), 'export const ignored = 1;\n', 'utf8');
    fs.mkdirSync(path.join(workspace, 'node_modules', 'pkg'), { recursive: true });
    fs.writeFileSync(
      path.join(workspace, 'node_modules', 'pkg', 'ignored.ts'),
      'export const ignored = 2;\n',
      'utf8',
    );

    const result = refreshProjectTechMetadata(workspace, {
      source: '   ',
    });

    const persisted = JSON.parse(
      fs.readFileSync(path.join(workspace, PROJECT_TECH_RELATIVE_PATH), 'utf8'),
    ) as Record<string, any>;

    expect(result.freshness).toMatchObject({
      source: 'manual',
      ttl_hours: DEFAULT_PROJECT_TECH_TTL_HOURS,
    });
    expect(result.language_file_counts).toEqual({
      Python: 0,
      TypeScript: 1,
      Rust: 0,
    });
    expect(persisted.statistics).toBeNull();
    expect(persisted._metadata).toMatchObject({
      analysis_mode: 'refresh:manual',
      initialized_by: 'workflow:init-fallback',
      version: '1.0.0',
    });
    expect(persisted.overview.technology_stack.languages).toEqual([
      null,
      { file_count: 5 },
      { name: 'TypeScript', file_count: 1 },
      { name: 'Go', file_count: 99 },
    ]);
  });

  it('falls back to legacy metadata fields and clamps future timestamps to zero age', () => {
    const workspace = createWorkspace();
    writeProjectTech(workspace, {
      overview: {},
      statistics: {},
      _metadata: {
        analysis_timestamp: '2026-01-05T12:00:00.000Z',
        analysis_mode: 'legacy-scan',
        version: '2.0.0',
      },
    });

    const result = checkProjectTechFreshness(workspace, {
      strict: true,
      now: new Date('2026-01-05T00:00:00.000Z'),
    });

    expect(result.status).toBe('fresh');
    expect(result.ok).toBe(true);
    expect(result.blocking).toBe(false);
    expect(result.generated_at).toBe('2026-01-05T12:00:00.000Z');
    expect(result.source).toBe('legacy-scan');
    expect(result.schema_version).toBe('2.0.0');
    expect(result.ttl_hours).toBe(DEFAULT_PROJECT_TECH_TTL_HOURS);
    expect(result.age_hours).toBe(0);
  });

  it('reports missing or invalid freshness timestamps in non-strict mode and surfaces payload-shape errors on refresh', () => {
    const missingTimestampWorkspace = createWorkspace();
    writeProjectTech(missingTimestampWorkspace, {
      overview: {},
      statistics: {},
      freshness: {},
      _metadata: {},
    });

    const missingTimestamp = checkProjectTechFreshness(missingTimestampWorkspace, {
      strict: false,
    });

    expect(missingTimestamp.status).toBe('invalid');
    expect(missingTimestamp.ok).toBe(true);
    expect(missingTimestamp.blocking).toBe(false);
    expect(missingTimestamp.message).toContain('generated_at is missing');

    const invalidTimestampWorkspace = createWorkspace();
    writeProjectTech(invalidTimestampWorkspace, {
      overview: {},
      statistics: {},
      freshness: {
        generated_at: 'not-a-date',
        source: 'ci',
      },
      _metadata: {},
    });

    const invalidTimestamp = checkProjectTechFreshness(invalidTimestampWorkspace, {
      strict: false,
    });

    expect(invalidTimestamp.status).toBe('invalid');
    expect(invalidTimestamp.ok).toBe(true);
    expect(invalidTimestamp.generated_at).toBe('not-a-date');
    expect(invalidTimestamp.message).toContain('invalid: not-a-date');

    const missingFileWorkspace = createWorkspace();
    expect(() =>
      refreshProjectTechMetadata(missingFileWorkspace, { source: 'ci' }),
    ).toThrow('project-tech file not found');

    const invalidShapeWorkspace = createWorkspace();
    const invalidShapePath = path.join(invalidShapeWorkspace, PROJECT_TECH_RELATIVE_PATH);
    fs.mkdirSync(path.dirname(invalidShapePath), { recursive: true });
    fs.writeFileSync(invalidShapePath, '[]', 'utf8');

    expect(() =>
      refreshProjectTechMetadata(invalidShapeWorkspace, { source: 'ci' }),
    ).toThrow('project-tech root payload must be a JSON object');
  });

  it('handles unreadable project-tech files and fallback freshness metadata branches', () => {
    const unreadableWorkspace = createWorkspace();
    const unreadablePath = path.join(unreadableWorkspace, PROJECT_TECH_RELATIVE_PATH);
    fs.mkdirSync(unreadablePath, { recursive: true });

    expect(() =>
      refreshProjectTechMetadata(unreadableWorkspace, { source: 'ci' }),
    ).toThrow(`project-tech file cannot be read: ${unreadablePath}`);

    const invalidShapeCheck = checkProjectTechFreshness(unreadableWorkspace, {
      strict: false,
    });
    expect(invalidShapeCheck.status).toBe('invalid');
    expect(invalidShapeCheck.ok).toBe(true);
    expect(invalidShapeCheck.message).toContain('project-tech file cannot be read');

    const fallbackWorkspace = createWorkspace();
    writeProjectTech(fallbackWorkspace, {
      overview: {},
      statistics: [],
      freshness: {
        generated_at: '2026-01-07T00:00:00.000Z',
        source: '',
        schema_version: '',
        ttl_hours: '0',
      },
      _metadata: {
        analysis_mode: '',
        version: '',
      },
    });

    const stale = checkProjectTechFreshness(fallbackWorkspace, {
      strict: true,
      now: new Date('2026-01-20T00:00:00.000Z'),
    });

    expect(stale.status).toBe('stale');
    expect(stale.ok).toBe(false);
    expect(stale.blocking).toBe(true);
    expect(stale.source).toBe('unknown');
    expect(stale.schema_version).toBe('legacy');
    expect(stale.ttl_hours).toBe(DEFAULT_PROJECT_TECH_TTL_HOURS);
    expect(stale.message).toContain('stale');
  });

  it('tolerates unreadable nested directories and non-object metadata during freshness checks', () => {
    const workspace = createWorkspace();
    writeProjectTech(workspace, {
      overview: {
        technology_stack: {
          languages: [
            { name: 'TypeScript', file_count: 0 },
          ],
        },
      },
      statistics: {},
      freshness: {
        generated_at: '2026-01-07T00:00:00.000Z',
        source: 'ci',
        schema_version: '1.0.0',
        ttl_hours: 24,
      },
      _metadata: [],
    });

    const nestedDir = path.join(workspace, 'src');
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(path.join(workspace, 'index.ts'), 'export const root = true;\n', 'utf8');
    fs.writeFileSync(path.join(nestedDir, 'nested.ts'), 'export const nested = true;\n', 'utf8');

    vi.resetModules();
    vi.doMock('node:fs', async (importOriginal) => {
      const actual = await importOriginal<typeof import('node:fs')>();
      return {
        ...actual,
        readdirSync: ((target: fs.PathLike, options?: fs.ObjectEncodingOptions & { withFileTypes?: boolean }) => {
          if (String(target) === nestedDir) {
            throw new Error('denied');
          }
          return actual.readdirSync(target, options as never);
        }) as typeof actual.readdirSync,
      };
    });

    return import('../../workflow/project-tech.js?readdir-fail').then((module) => {
      const refreshed = module.refreshProjectTechMetadata(workspace, { source: 'ci' });
      expect(refreshed.language_file_counts).toEqual({
        Python: 0,
        TypeScript: 1,
        Rust: 0,
      });

      const freshness = module.checkProjectTechFreshness(workspace, {
        strict: false,
        now: new Date('2026-01-07T12:00:00.000Z'),
      });

      expect(freshness.status).toBe('fresh');
      expect(freshness.source).toBe('ci');
      expect(freshness.schema_version).toBe('1.1.0');
      expect(freshness.age_hours).toBe(0);

      vi.doUnmock('node:fs');
      vi.resetModules();
    });
  });

  it('treats an undefined refresh source like the manual fallback', () => {
    const workspace = createWorkspace();
    writeProjectTech(workspace, {
      overview: {},
      statistics: {},
      _metadata: {},
    });

    const result = refreshProjectTechMetadata(workspace, {
      source: undefined as unknown as string,
    });

    expect(result.freshness).toMatchObject({
      source: 'manual',
      ttl_hours: DEFAULT_PROJECT_TECH_TTL_HOURS,
    });
  });

  it('uses fresh runtime timestamps when no explicit now value is provided', () => {
    const workspace = createWorkspace();
    const generatedAt = new Date().toISOString();
    writeProjectTech(workspace, {
      overview: {},
      statistics: {},
      freshness: {
        generated_at: generatedAt,
        source: 'ci',
        schema_version: '1.0.0',
        ttl_hours: 24,
      },
      _metadata: [],
    });

    const result = checkProjectTechFreshness(workspace, {
      strict: false,
    });

    expect(result.status).toBe('fresh');
    expect(result.ok).toBe(true);
    expect(result.blocking).toBe(false);
    expect(result.generated_at).toBe(generatedAt);
    expect(result.source).toBe('ci');
  });
});
