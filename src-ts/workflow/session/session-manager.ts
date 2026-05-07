/**
 * Session Manager
 *
 * Manages writing session lifecycle: create, read/write, archive, delete.
 *
 * Migrated from src/workflow/session/session_manager.py
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';

// ============================================================
// Enums
// ============================================================

export enum SessionStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

export enum ContentType {
  CHAPTER = 'chapter',
  OUTLINE = 'outline',
  CHARACTER = 'character',
  WORLDVIEW = 'worldview',
  PLAN = 'plan',
  TODO = 'todo',
  SUMMARY = 'summary',
  STATE = 'state',
  SNAPSHOT_INDEX = 'snapshot_index',
  AUDIT = 'audit',
  HANDOFF = 'handoff',
  REVISION_CHECKPOINT = 'revision_checkpoint',
  GENERATION_SNAPSHOT = 'generation_snapshot',
}

// ============================================================
// Path routes
// ============================================================

const PATH_ROUTES: Record<ContentType, string> = {
  [ContentType.CHAPTER]: '{base}/chapters/chapter-{id}.md',
  [ContentType.OUTLINE]: '{base}/OUTLINE.md',
  [ContentType.CHARACTER]: '{base}/.data/characters/{id}.json',
  [ContentType.WORLDVIEW]: '{base}/.data/worldview.json',
  [ContentType.PLAN]: '{base}/IMPL_PLAN.md',
  [ContentType.TODO]: '{base}/TODO_LIST.md',
  [ContentType.SUMMARY]: '{base}/SUMMARY.md',
  [ContentType.STATE]: '{base}/.data/state.json',
  [ContentType.SNAPSHOT_INDEX]: '{base}/.data/snapshot-index.json',
  [ContentType.AUDIT]: '{base}/.data/audit.jsonl',
  [ContentType.HANDOFF]: '{base}/HANDOFF.md',
  [ContentType.REVISION_CHECKPOINT]: '{base}/.data/revision-checkpoints/{id}.json',
  [ContentType.GENERATION_SNAPSHOT]: '{base}/.data/generation-snapshots/{id}.json',
};

const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

// ============================================================
// SessionInfo interface
// ============================================================

export interface SessionInfo {
  id: string;
  type: string;
  status: string;
  project_name: string;
  created_at: string;
  updated_at: string;
  task_count: number;
  chapter_count: number;
  domain: string;
  runner_state: string;
  last_checkpoint_id: string;
  lifecycle_updated_at: string;
}

// ============================================================
// SessionManager class
// ============================================================

export class SessionManager {
  public readonly basePath: string;
  public readonly activePath: string;
  public readonly archivedPath: string;
  private _writeChains = new Map<string, Promise<void>>();

  constructor(basePath: string = '.writing/sessions') {
    this.basePath = path.resolve(basePath);
    this.activePath = path.join(this.basePath, 'active');
    this.archivedPath = path.join(this.basePath, 'archived');

    fs.mkdirSync(this.activePath, { recursive: true });
    fs.mkdirSync(this.archivedPath, { recursive: true });
  }

  private _sanitizeSegment(value: string, fallback: string = 'session'): string {
    const sanitized = (value || '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    return sanitized || fallback;
  }

  private _assertValidSessionId(sessionId: string): void {
    if (!SESSION_ID_PATTERN.test(sessionId || '')) {
      throw new Error(`invalid session_id: ${sessionId}`);
    }
  }

  init(
    sessionId: string,
    sessionType: string = 'standard',
    projectName: string = '',
    domain: string = 'novel',
  ): SessionInfo {
    this._assertValidSessionId(sessionId);
    const sessionPath = path.join(this.activePath, sessionId);
    fs.mkdirSync(sessionPath, { recursive: true });

    fs.mkdirSync(path.join(sessionPath, 'chapters'), { recursive: true });
    fs.mkdirSync(path.join(sessionPath, '.data'), { recursive: true });
    fs.mkdirSync(path.join(sessionPath, '.data', 'characters'), { recursive: true });

    const now = new Date().toISOString();
    const info: SessionInfo = {
      id: sessionId,
      type: sessionType,
      status: SessionStatus.ACTIVE,
      project_name: projectName,
      created_at: now,
      updated_at: now,
      task_count: 0,
      chapter_count: 0,
      domain,
      runner_state: 'pending',
      last_checkpoint_id: '',
      lifecycle_updated_at: '',
    };

    this._saveSessionInfo(sessionId, info);
    return info;
  }

  list(
    location: string = 'active',
    domainFilter?: string,
    projectFilter?: string,
  ): SessionInfo[] {
    const sessions: SessionInfo[] = [];

    const paths: string[] = [];
    if (location === 'active' || location === 'all') paths.push(this.activePath);
    if (location === 'archived' || location === 'all') paths.push(this.archivedPath);

    for (const base of paths) {
      if (!fs.existsSync(base)) continue;

      const entries = fs.readdirSync(base, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const info = this._loadSessionInfo(entry.name, base);
        if (info) {
          if (domainFilter && info.domain !== domainFilter) continue;
          if (projectFilter && info.project_name !== projectFilter) continue;
          sessions.push(info);
        }
      }
    }

    sessions.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return sessions;
  }

  read(sessionId: string, contentType: ContentType, params: Record<string, string> = {}): string {
    const filePath = this._resolvePath(sessionId, contentType, params);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    return '';
  }

  write(
    sessionId: string,
    contentType: ContentType,
    content: string,
    params: Record<string, string> = {},
  ): boolean {
    const filePath = this._resolvePath(sessionId, contentType, params);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');

    this._updateTimestamp(sessionId);
    this._appendSnapshotIndex(sessionId, contentType, filePath);
    return true;
  }

  appendAudit(sessionId: string, event: Record<string, unknown>): boolean {
    const filePath = this._resolvePath(sessionId, ContentType.AUDIT, {});
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const line = JSON.stringify(event);
    fs.appendFileSync(filePath, line + '\n', 'utf-8');

    this._updateTimestamp(sessionId);
    this._appendSnapshotIndex(sessionId, ContentType.AUDIT, filePath);
    return true;
  }

  archive(sessionId: string): boolean {
    const src = path.join(this.activePath, sessionId);
    const dst = path.join(this.archivedPath, sessionId);

    if (!fs.existsSync(src)) return false;

    fs.renameSync(src, dst);

    const info = this._loadSessionInfo(sessionId, this.archivedPath);
    if (info) {
      info.status = SessionStatus.ARCHIVED;
      this._saveSessionInfo(sessionId, info, this.archivedPath);
    }
    return true;
  }

  restore(sessionId: string): boolean {
    const src = path.join(this.archivedPath, sessionId);
    const dst = path.join(this.activePath, sessionId);

    if (!fs.existsSync(src)) return false;

    fs.renameSync(src, dst);

    const info = this._loadSessionInfo(sessionId, this.activePath);
    if (info) {
      info.status = SessionStatus.ACTIVE;
      this._saveSessionInfo(sessionId, info);
    }
    return true;
  }

  syncLifecycle(
    sessionId: string,
    runnerState: string,
    checkpointId?: string,
    statusMap?: Record<string, string>,
  ): Record<string, unknown> {
    const defaultStatusMap: Record<string, string> = {
      running: 'active',
      paused: 'checkpointed',
      stopped: 'archived',
      pending: 'active',
    };
    const effectiveStatusMap = { ...defaultStatusMap, ...(statusMap ?? {}) };
    const targetStatus = effectiveStatusMap[runnerState] ?? 'active';

    if (targetStatus === 'active') {
      if (!fs.existsSync(path.join(this.activePath, sessionId)) && fs.existsSync(path.join(this.archivedPath, sessionId))) {
        this.restore(sessionId);
      } else if (!fs.existsSync(path.join(this.activePath, sessionId))) {
        this.init(sessionId, 'standard', 'workflow', 'code');
      }
    } else if (targetStatus === 'archived') {
      if (fs.existsSync(path.join(this.activePath, sessionId))) {
        this.archive(sessionId);
      } else if (!fs.existsSync(path.join(this.archivedPath, sessionId))) {
        this.init(sessionId, 'standard', 'workflow', 'code');
        this.archive(sessionId);
      }
    } else {
      if (!fs.existsSync(path.join(this.activePath, sessionId)) && fs.existsSync(path.join(this.archivedPath, sessionId))) {
        this.restore(sessionId);
      } else if (!fs.existsSync(path.join(this.activePath, sessionId))) {
        this.init(sessionId, 'standard', 'workflow', 'code');
      }
    }

    const base = targetStatus === 'archived' ? this.archivedPath : this.activePath;
    const info = this._loadSessionInfo(sessionId, base);
    if (!info) return { session_id: sessionId, status: targetStatus };

    const now = new Date().toISOString();
    info.status = targetStatus;
    info.runner_state = runnerState;
    info.lifecycle_updated_at = now;
    info.updated_at = now;
    if (checkpointId) info.last_checkpoint_id = checkpointId;
    this._saveSessionInfo(sessionId, info, base);
    return {
      session_id: sessionId,
      status: info.status,
      runner_state: info.runner_state,
      last_checkpoint_id: info.last_checkpoint_id,
    };
  }

  delete(sessionId: string, force: boolean = false): boolean {
    let p = path.join(this.activePath, sessionId);
    if (fs.existsSync(p)) {
      if (!force) return this.archive(sessionId);
      fs.rmSync(p, { recursive: true, force: true });
      return true;
    }

    p = path.join(this.archivedPath, sessionId);
    if (fs.existsSync(p)) {
      fs.rmSync(p, { recursive: true, force: true });
      return true;
    }

    return false;
  }

  createSession(
    projectId: string,
    goal: string = '',
    sessionType: string = 'standard',
    domain: string = 'novel',
    namespace: string = '',
  ): Record<string, unknown> {
    const safeProjectId = this._sanitizeSegment(projectId, 'project');
    const safeNamespace = namespace ? this._sanitizeSegment(namespace) : '';
    const uniqueSuffix = randomUUID().slice(0, 8);
    const sessionId = safeNamespace
      ? `${safeNamespace}--${safeProjectId}-${uniqueSuffix}`
      : `${safeProjectId}-${uniqueSuffix}`;
    const info = this.init(sessionId, sessionType, projectId, domain);
    return {
      session_id: info.id,
      project_id: projectId,
      goal,
      status: info.status,
      created_at: info.created_at,
      namespace: safeNamespace,
    };
  }

  listSessions(location: string = 'active'): Record<string, unknown>[] {
    const sessions = this.list(location);
    return sessions.map(s => ({
      session_id: s.id,
      project_id: s.project_name,
      status: s.status,
      created_at: s.created_at,
      updated_at: s.updated_at,
    }));
  }

  stats(sessionId: string): Record<string, unknown> {
    const info = this._loadSessionInfo(sessionId);
    if (!info) return {};

    const sessionPath = this._getSessionPath(sessionId);
    const chaptersPath = path.join(sessionPath, 'chapters');

    let chapterCount = 0;
    let totalWords = 0;

    if (fs.existsSync(chaptersPath)) {
      const files = fs.readdirSync(chaptersPath).filter(f => f.endsWith('.md'));
      for (const file of files) {
        chapterCount++;
        totalWords += fs.readFileSync(path.join(chaptersPath, file), 'utf-8').length;
      }
    }

    return {
      session_id: sessionId,
      type: info.type,
      status: info.status,
      chapter_count: chapterCount,
      total_words: totalWords,
      created_at: info.created_at,
      updated_at: info.updated_at,
    };
  }

  resolvePath(sessionId: string, contentType: ContentType, params: Record<string, string> = {}): string {
    return this._resolvePath(sessionId, contentType, params);
  }

  // ========================================
  // Private methods
  // ========================================

  private _resolvePath(
    sessionId: string,
    contentType: ContentType,
    params: Record<string, string>,
  ): string {
    this._assertValidSessionId(sessionId);
    const template = PATH_ROUTES[contentType] ?? '{base}/{id}';
    const base = this._getSessionPath(sessionId);

    const allParams: Record<string, string> = { base, ...params };
    const pathStr = template.replace(/\{(\w+)\}/g, (_, key) => allParams[key] ?? '');
    const resolved = path.resolve(pathStr);
    const baseResolved = path.resolve(base);

    const parentDir = path.extname(resolved) ? path.dirname(resolved) : resolved;
    if (parentDir !== baseResolved && !parentDir.startsWith(baseResolved + path.sep)) {
      throw new Error(`resolved path escapes session boundary: ${resolved}`);
    }
    return resolved;
  }

  private _getSessionPath(sessionId: string): string {
    let p = path.join(this.activePath, sessionId);
    if (fs.existsSync(p)) return p;

    p = path.join(this.archivedPath, sessionId);
    if (fs.existsSync(p)) return p;

    return path.join(this.activePath, sessionId);
  }

  private _saveSessionInfo(sessionId: string, info: SessionInfo, base?: string): void {
    const dir = base ?? this.activePath;
    const filePath = path.join(dir, sessionId, 'session.json');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(info, null, 2), 'utf-8');
  }

  private _loadSessionInfo(sessionId: string, base?: string): SessionInfo | null {
    const filePath = base
      ? path.join(base, sessionId, 'session.json')
      : path.join(this._getSessionPath(sessionId), 'session.json');

    if (!fs.existsSync(filePath)) return null;

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return data as SessionInfo;
    } catch {
      return null;
    }
  }

  private _appendSnapshotIndex(sessionId: string, contentType: ContentType, filePath: string): void {
    const indexPath = this._resolvePath(sessionId, ContentType.SNAPSHOT_INDEX, {});
    const entry = {
      ts: new Date().toISOString(),
      content_type: contentType,
      path: filePath,
    };

    const prev = this._writeChains.get(sessionId) ?? Promise.resolve();
    const next = prev.then(() => {
      fs.mkdirSync(path.dirname(indexPath), { recursive: true });
      let snapshots: unknown[] = [];
      if (fs.existsSync(indexPath)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
          if (Array.isArray(parsed)) snapshots = parsed;
        } catch {
          snapshots = [];
        }
      }
      snapshots.push(entry);
      fs.writeFileSync(indexPath, JSON.stringify(snapshots, null, 2), 'utf-8');
    }).catch(() => {});
    this._writeChains.set(sessionId, next);
    void next.then(() => {
      if (this._writeChains.get(sessionId) === next) {
        this._writeChains.delete(sessionId);
      }
    });
  }

  private _updateTimestamp(sessionId: string): void {
    const info = this._loadSessionInfo(sessionId);
    if (info) {
      info.updated_at = new Date().toISOString();
      this._saveSessionInfo(sessionId, info);
    }
  }
}
