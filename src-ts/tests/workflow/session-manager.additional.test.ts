import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  ContentType,
  SessionManager,
} from '../../workflow/session/session-manager';

const tempDirs: string[] = [];

function createBasePath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-session-manager-additional-'));
  tempDirs.push(dir);
  return dir;
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('SessionManager additional coverage', () => {
  it('rejects invalid session ids and returns empty strings for missing content', () => {
    const manager = new SessionManager(createBasePath());

    expect(() => manager.init('bad/id')).toThrow('invalid session_id');
    expect(manager.read('missing-session', ContentType.OUTLINE)).toBe('');
  });

  it('covers lifecycle fallback paths and delete edge cases', () => {
    const manager = new SessionManager(createBasePath());

    expect(manager.syncLifecycle('fresh-active', 'running')).toMatchObject({
      session_id: 'fresh-active',
      status: 'active',
      runner_state: 'running',
    });

    expect(manager.syncLifecycle('fresh-archived', 'stopped', 'cp-archived')).toMatchObject({
      session_id: 'fresh-archived',
      status: 'archived',
      runner_state: 'stopped',
      last_checkpoint_id: 'cp-archived',
    });

    expect(manager.syncLifecycle('fresh-paused', 'paused', 'cp-paused')).toMatchObject({
      session_id: 'fresh-paused',
      status: 'checkpointed',
      runner_state: 'paused',
      last_checkpoint_id: 'cp-paused',
    });

    manager.init('restore-me', 'standard', 'project-restore', 'novel');
    expect(manager.archive('restore-me')).toBe(true);
    expect(manager.syncLifecycle('restore-me', 'paused')).toMatchObject({
      session_id: 'restore-me',
      status: 'checkpointed',
      runner_state: 'paused',
    });
    expect(manager.list('active').some(session => session.id === 'restore-me')).toBe(true);

    manager.init('force-delete', 'standard', 'project-delete', 'code');
    expect(manager.delete('force-delete', true)).toBe(true);
    expect(manager.delete('never-created', true)).toBe(false);
  });

  it('filters session lists and uses the non-namespaced session id branch', () => {
    const manager = new SessionManager(createBasePath());

    manager.init('novel-a', 'standard', 'project-a', 'novel');
    manager.init('code-a', 'standard', 'project-b', 'code');

    expect(manager.list('all', 'code')).toHaveLength(1);
    expect(manager.list('all', undefined, 'project-a')).toHaveLength(1);

    const created = manager.createSession('project docs', 'goal');

    expect(String(created.session_id)).toContain('project-docs-');
    expect(String(created.session_id)).not.toContain('--');
    expect(created.namespace).toBe('');
  });

  it('handles path escapes, malformed metadata, and corrupt snapshot index files', async () => {
    const basePath = createBasePath();
    const manager = new SessionManager(basePath);

    manager.init('session-safe', 'standard', 'project-safe', 'novel');
    expect(() =>
      manager.resolvePath('session-safe', 'unknown-content' as ContentType, {
        id: '..\\..\\..\\escaped.txt',
      }),
    ).toThrow('resolved path escapes session boundary');

    const brokenSessionFile = path.join(basePath, 'active', 'session-safe', 'session.json');
    fs.writeFileSync(brokenSessionFile, '{broken-json', 'utf-8');

    expect(manager.stats('session-safe')).toEqual({});
    expect(manager.list('active').some(session => session.id === 'session-safe')).toBe(false);

    manager.init('session-snap', 'standard', 'project-snap', 'novel');
    const snapshotIndexPath = path.join(
      basePath,
      'active',
      'session-snap',
      '.data',
      'snapshot-index.json',
    );
    fs.mkdirSync(path.dirname(snapshotIndexPath), { recursive: true });
    fs.writeFileSync(snapshotIndexPath, '{not-json', 'utf-8');

    manager.write('session-snap', ContentType.OUTLINE, '# outline');
    await flushMicrotasks();

    expect(JSON.parse(fs.readFileSync(snapshotIndexPath, 'utf-8'))).toEqual([
      expect.objectContaining({
        content_type: ContentType.OUTLINE,
      }),
    ]);
  });
});
