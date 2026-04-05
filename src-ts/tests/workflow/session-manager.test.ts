import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  ContentType,
  SessionManager,
  SessionStatus,
} from '../../workflow/session/session-manager';

const tempDirs: string[] = [];

function createBasePath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-session-manager-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('SessionManager', () => {
  it('initializes, writes, reads, and lists active sessions in an isolated base path', () => {
    const manager = new SessionManager(createBasePath());

    const info = manager.init('session-a', 'standard', 'project-x', 'novel');
    const writeOk = manager.write('session-a', ContentType.CHAPTER, '# chapter', {
      id: '001',
    });
    const readBack = manager.read('session-a', ContentType.CHAPTER, { id: '001' });
    const listed = manager.list('active');
    const stats = manager.stats('session-a');

    expect(info.status).toBe(SessionStatus.ACTIVE);
    expect(writeOk).toBe(true);
    expect(readBack).toContain('# chapter');
    expect(listed[0]?.id).toBe('session-a');
    expect(stats).toMatchObject({
      session_id: 'session-a',
      chapter_count: 1,
    });
  });

  it('creates namespaced sessions and exposes safe path resolution', () => {
    const manager = new SessionManager(createBasePath());
    const created = manager.createSession(
      'project docs',
      'goal',
      'standard',
      'code',
      'ns alpha',
    );

    expect(String(created.session_id)).toContain('ns-alpha--project-docs-');
    expect(created.namespace).toBe('ns-alpha');

    const sessionId = String(created.session_id);
    const resolved = manager.resolvePath(sessionId, ContentType.OUTLINE);

    expect(resolved).toContain(path.join('active', sessionId, 'OUTLINE.md'));
    expect(
      manager.resolvePath(sessionId, ContentType.CHAPTER, { id: '..\\..\\escape' }),
    ).toContain(path.join('chapters', 'escape.md'));
  });

  it('archives, restores, syncs lifecycle, appends audit, and deletes sessions', () => {
    const manager = new SessionManager(createBasePath());
    manager.init('session-b', 'standard', 'project-y', 'code');
    manager.appendAudit('session-b', { event: 'created' });

    expect(manager.archive('session-b')).toBe(true);
    expect(manager.list('archived')[0]?.id).toBe('session-b');
    expect(manager.restore('session-b')).toBe(true);
    expect(manager.list('active')[0]?.id).toBe('session-b');

    const syncArchived = manager.syncLifecycle('session-b', 'stopped', 'cp-1');
    expect(syncArchived).toMatchObject({
      session_id: 'session-b',
      status: 'archived',
      runner_state: 'stopped',
      last_checkpoint_id: 'cp-1',
    });

    const syncActive = manager.syncLifecycle('session-b', 'running', 'cp-2');
    expect(syncActive).toMatchObject({
      status: 'active',
      runner_state: 'running',
      last_checkpoint_id: 'cp-2',
    });

    expect(manager.delete('session-b')).toBe(true);
    expect(manager.list('all')[0]?.status).toBe('archived');
  });

  it('lists simplified session records and supports force deletion of archived sessions', () => {
    const manager = new SessionManager(createBasePath());
    manager.init('session-c', 'standard', 'project-z', 'novel');
    manager.archive('session-c');

    const listed = manager.listSessions('archived');
    expect(listed[0]).toMatchObject({
      session_id: 'session-c',
      project_id: 'project-z',
      status: 'archived',
    });

    expect(manager.delete('session-c', true)).toBe(true);
    expect(manager.list('all')).toEqual([]);
  });
});
