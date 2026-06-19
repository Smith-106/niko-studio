import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ContentType,
  SessionManager,
} from '../../workflow/session/session-manager';

const tempDirs: string[] = [];

function createBasePath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-session-manager-tail2-'));
  tempDirs.push(dir);
  return dir;
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
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

describe('SessionManager tail2 additional coverage', () => {
  it('covers sanitize fallbacks, invalid empty ids, and missing session metadata branches', () => {
    const manager = new SessionManager(createBasePath());
    const managerAny = manager as any;

    expect(managerAny._sanitizeSegment('', 'fallback-name')).toBe('fallback-name');
    expect(managerAny._sanitizeSegment('***', 'fallback-name')).toBe('fallback-name');
    expect(() => managerAny._assertValidSessionId(undefined)).toThrow('invalid session_id');
    expect(managerAny._loadSessionInfo('never-created')).toBeNull();
    expect(manager.stats('never-created')).toEqual({});
  });

  it('covers list skips for missing bases and non-directory entries', () => {
    const manager = new SessionManager(createBasePath());
    manager.init('listed-session', 'standard', 'project-listed', 'novel');

    fs.writeFileSync(path.join(manager.activePath, 'stray.txt'), 'stray', 'utf-8');
    fs.rmSync(manager.archivedPath, { recursive: true, force: true });

    const listed = manager.list('all');
    expect(listed.map((session) => session.id)).toContain('listed-session');
  });

  it('covers archive and restore false paths plus syncLifecycle fallback branches', () => {
    const manager = new SessionManager(createBasePath());

    expect(manager.archive('missing-archive')).toBe(false);
    expect(manager.restore('missing-restore')).toBe(false);

    expect(manager.syncLifecycle('mystery-session', 'mystery')).toMatchObject({
      session_id: 'mystery-session',
      status: 'active',
      runner_state: 'mystery',
    });

    manager.init('null-info-session', 'standard', 'project-null', 'code');
    const loadSpy = vi.spyOn(manager as any, '_loadSessionInfo').mockReturnValue(null);
    expect(manager.syncLifecycle('null-info-session', 'paused')).toEqual({
      session_id: 'null-info-session',
      status: 'checkpointed',
    });
    loadSpy.mockRestore();
  });

  it('covers default resolvePath templates without ids and async snapshot cleanup', async () => {
    const manager = new SessionManager(createBasePath());
    manager.init('path-session', 'standard', 'project-path', 'novel');

    const resolved = manager.resolvePath('path-session', 'unknown-content' as ContentType, {});
    expect(resolved).toBe(path.join(manager.activePath, 'path-session'));

    manager.write('path-session', ContentType.OUTLINE, '# outline');
    await flushMicrotasks();

    expect((manager as any)._writeChains.size).toBe(0);
  });

  it('covers archived session path resolution and non-array snapshot index recovery', async () => {
    const manager = new SessionManager(createBasePath());
    manager.init('archived-path-session', 'standard', 'project-archived', 'novel');
    expect(manager.archive('archived-path-session')).toBe(true);

    expect(manager.read('archived-path-session', ContentType.OUTLINE)).toBe('');
    expect(
      manager.resolvePath('archived-path-session', ContentType.OUTLINE),
    ).toContain(path.join('archived', 'archived-path-session', 'OUTLINE.md'));

    manager.init('snapshot-object-session', 'standard', 'project-snapshot', 'novel');
    const snapshotIndexPath = path.join(
      manager.activePath,
      'snapshot-object-session',
      '.data',
      'snapshot-index.json',
    );
    fs.mkdirSync(path.dirname(snapshotIndexPath), { recursive: true });
    fs.writeFileSync(snapshotIndexPath, '{"existing":true}', 'utf-8');

    manager.write('snapshot-object-session', ContentType.OUTLINE, '# outline');
    await flushMicrotasks();

    expect(JSON.parse(fs.readFileSync(snapshotIndexPath, 'utf-8'))).toEqual([
      expect.objectContaining({
        content_type: ContentType.OUTLINE,
      }),
    ]);
  });

  it('covers snapshot index append when the existing file is already a valid array', async () => {
    const manager = new SessionManager(createBasePath());
    manager.init('snapshot-array-session', 'standard', 'project-array', 'novel');

    const snapshotIndexPath = path.join(
      manager.activePath,
      'snapshot-array-session',
      '.data',
      'snapshot-index.json',
    );
    fs.mkdirSync(path.dirname(snapshotIndexPath), { recursive: true });
    fs.writeFileSync(
      snapshotIndexPath,
      JSON.stringify([{ content_type: 'seed', path: 'seed-path', ts: 'seed-ts' }], null, 2),
      'utf-8',
    );

    manager.write('snapshot-array-session', ContentType.OUTLINE, '# outline');
    await flushMicrotasks();

    const parsed = JSON.parse(fs.readFileSync(snapshotIndexPath, 'utf-8')) as Array<Record<string, unknown>>;
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ content_type: 'seed' });
    expect(parsed[1]).toMatchObject({ content_type: ContentType.OUTLINE });
  });
});
