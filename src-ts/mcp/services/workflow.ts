/**
 * MCP Workflow Service
 *
 * Workflow service module with 9 tools for workflow operations.
 * Ported from src/mcp/services/workflow.py
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  normalizeProjectWorkspaceContext,
  projectWorkspaceToWorkflowAuthority,
  type ProjectWorkspaceContext,
} from '../../project/workspace-model.js';
import { normalizeWorkflowAuthority } from '../../workflow/engine/authority.js';
import type {
  WorkflowRecommendationInput,
} from '../../workflow/engine/engine-contracts.js';
import {
  getWorkflowEngineRuntimeProvider,
  getWorkflowEngineRuntimeProviderVersion,
  setWorkflowEngineRuntimeProvider as setContainerWorkflowEngineRuntimeProvider,
  resetWorkflowEngineRuntimeProvider as resetContainerWorkflowEngineRuntimeProvider,
  type WorkflowEngineRuntimeProvider,
} from '../../container/workflow-runtime-provider.js';
import type { IPhaseOrchestrator } from '../../container/types';
import { getContainer } from '../../container/ServiceContainer.js';

// ---------------------------------------------------------------
// Engine accessor
// ---------------------------------------------------------------

interface WorkflowEngine {
  bindPlanAuthority?(planId: string, authority: WorkflowAuthority): WorkflowAuthority;
  getPlanAuthority?(planId: string): WorkflowAuthority;
  getCheckpoint?(checkpointId: string): WorkflowCheckpointRecord | null;
  route(task: string): Promise<Record<string, unknown>>;
  plan(
    task: string,
    level?: string | null,
    params?: {
      recommendations?: WorkflowRecommendationInput | null;
      traceContext?: WorkflowTraceContext | null;
    }
  ): Promise<Record<string, unknown>>;
  execute(
    planId: string,
    stepId?: string | null,
    params?: {
      recommendations?: WorkflowRecommendationInput | null;
      confirmToken?: string | null;
    },
    authority?: WorkflowAuthority | null,
  ): Promise<Record<string, unknown>>;
  quickRollback(params: {
    planId: string;
    checkpointId: string;
    reason: string;
  }, authority?: WorkflowAuthority | null): Promise<Record<string, unknown>>;
  lifecycle(
    planId: string,
    action: string,
    authority?: WorkflowAuthority | null,
  ): Promise<Record<string, unknown>>;
  createCheckpoint(
    description: string,
    autoCommit: boolean
  ): Promise<Record<string, unknown>>;
  restoreCheckpoint(
    checkpointId: string,
    params?: { confirmToken?: string | null }
  ): Promise<Record<string, unknown>>;
  listCheckpoints(limit: number): Promise<WorkflowCheckpointSummary[]>;
  bindPlanSession(planId: string, sessionId: string): string;
}

interface WorkflowRuntimeCaches {
  workspaceRoot: string;
  workflowEngineInstance: WorkflowEngine | null;
  workflowEngineInstanceProviderVersion: number;
  checkpointAuthorityBindings: Map<string, WorkflowAuthority>;
  schedulerEntries: Map<string, WorkflowSchedulerTaskRecord>;
  schedulerStoreLoaded: boolean;
  schedulerStoreVersion: number;
}

const workflowRuntimeCachesByWorkspace = new Map<string, WorkflowRuntimeCaches>();

function normalizeWorkspaceKey(workspaceRoot: string): string {
  return workspaceRoot.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function resolveWorkspaceCacheKey(workspaceRoot?: string): string {
  return normalizeWorkspaceKey(workspaceRoot ?? resolveWorkflowWorkspace());
}

function getWorkspaceRootFromCacheKey(cacheKey: string): string {
  for (const cache of workflowRuntimeCachesByWorkspace.values()) {
    if (resolveWorkspaceCacheKey(cache.workspaceRoot) === cacheKey) {
      return cache.workspaceRoot;
    }
  }
  return cacheKey;
}

function getOrCreateWorkspaceCaches(workspaceRoot?: string): WorkflowRuntimeCaches {
  const resolvedWorkspaceRoot = workspaceRoot ?? resolveWorkflowWorkspace();
  const cacheKey = resolveWorkspaceCacheKey(resolvedWorkspaceRoot);
  let caches = workflowRuntimeCachesByWorkspace.get(cacheKey);
  if (!caches) {
    caches = {
      workspaceRoot: resolvedWorkspaceRoot,
      workflowEngineInstance: null,
      workflowEngineInstanceProviderVersion: -1,
      checkpointAuthorityBindings: new Map<string, WorkflowAuthority>(),
      schedulerEntries: new Map<string, WorkflowSchedulerTaskRecord>(),
      schedulerStoreLoaded: false,
      schedulerStoreVersion: 0,
    };
    workflowRuntimeCachesByWorkspace.set(cacheKey, caches);
  }
  return caches;
}

function clearWorkspaceCaches(workspaceRoot?: string): void {
  const cacheKey = resolveWorkspaceCacheKey(workspaceRoot);
  workflowRuntimeCachesByWorkspace.delete(cacheKey);
}


export function setWorkflowEngineRuntimeProvider(
  provider?: WorkflowEngineRuntimeProvider | null,
): void {
  setContainerWorkflowEngineRuntimeProvider(provider);
  workflowRuntimeCachesByWorkspace.clear();
}

export function resetWorkflowEngineRuntimeProvider(): void {
  resetContainerWorkflowEngineRuntimeProvider();
  workflowRuntimeCachesByWorkspace.clear();
}

interface WorkflowAuthority {
  sessionId: string | null;
  workspaceId: string | null;
  projectId: string | null;
}

export interface WorkflowTraceContext {
  requestId: string;
  route: string;
  method: string;
  startAtMs: number;
}

interface WorkflowCheckpointSummary {
  id: string;
  description: string;
  commit_hash?: string | null;
  created_at: string;
}

interface WorkflowCheckpointRecord extends WorkflowCheckpointSummary {
  plan_id: string | null;
  step_id: string | null;
  replay_payload: Record<string, unknown>;
}


type WorkflowExecutionStatus = 'completed' | 'waiting_confirmation' | 'gate_blocked';
type WorkflowSchedulerStatus = 'active' | 'paused';

const SCHEDULER_STORE_DIR = join('.writing', 'scheduler');
const SCHEDULER_STORE_FILE = 'tasks.json';

interface WorkflowSchedulerTaskDefinition {
  task_id: string;
  title: string;
  task: string;
  level?: string | null;
  schedule_rule?: Record<string, unknown>;
  trigger_rule: Record<string, unknown>;
  backend_mode_policy: Record<string, unknown>;
  progression_policy: Record<string, unknown>;
}

interface WorkflowSchedulerTaskRecord extends WorkflowSchedulerTaskDefinition {
  status: WorkflowSchedulerStatus;
  created_at: string;
  updated_at: string;
  authority: WorkflowAuthority | null;
  last_run_id?: string | null;
  last_plan_id?: string | null;
  last_trigger?: 'cron' | 'event' | 'manual_run_now' | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function utcNowIso(): string {
  return new Date().toISOString();
}

function resolveWorkflowWorkspace(): string {
  const override = String(process.env['NIKO_WORKFLOW_WORKSPACE'] ?? '').trim();
  return override || process.cwd();
}

function resolveWorkspaceRootForRequest(workspace?: ProjectWorkspaceContext | null): string {
  const requestedWorkspaceRoot = readString(workspace?.identity?.workspaceRoot);
  if (requestedWorkspaceRoot && existsSync(requestedWorkspaceRoot)) {
    return requestedWorkspaceRoot;
  }
  return resolveWorkflowWorkspace();
}

function resolveWorkflowAuthority(
  workspace?: ProjectWorkspaceContext | null,
): WorkflowAuthority | null {
  if (!workspace) return null;
  const scope = projectWorkspaceToWorkflowAuthority(workspace);
  const sessionId =
    typeof scope.sessionId === 'string' && scope.sessionId.trim()
      ? scope.sessionId.trim()
      : null;
  const workspaceId =
    typeof scope.workspaceId === 'string' && scope.workspaceId.trim()
      ? scope.workspaceId.trim()
      : null;
  const projectId =
    typeof scope.projectId === 'string' && scope.projectId.trim()
      ? scope.projectId.trim()
      : null;

  if (!sessionId && !workspaceId && !projectId) {
    return null;
  }

  return {
    sessionId,
    workspaceId,
    projectId,
  };
}

function cloneWorkflowAuthority(
  authority?: Partial<WorkflowAuthority> | null,
): WorkflowAuthority | null {
  const normalized = normalizeWorkflowAuthority(authority);
  return normalized ? { ...normalized } : null;
}

function resolveCheckpointAuthority(
  workspace?: ProjectWorkspaceContext | null,
  workspaceRoot?: string,
): WorkflowAuthority | null {
  return resolveWorkflowAuthority(
    workspace
    ?? normalizeProjectWorkspaceContext({}, {
      workspaceRoot: workspaceRoot ?? resolveWorkflowWorkspace(),
    }),
  );
}

function checkpointAuthorityMismatchError(
  checkpointId: string,
  dimension: 'workflow session' | 'workspace' | 'project',
  expected: string,
  received: string,
): string {
  return `Checkpoint '${checkpointId}' is bound to ${dimension} '${expected}' and cannot be used with '${received}'`;
}

function resolveCheckpointRequestAuthority(params: {
  checkpoint: WorkflowCheckpointRecord;
  storedAuthority: WorkflowAuthority | null;
  requestAuthority?: WorkflowAuthority | null;
}): { authority: WorkflowAuthority | null; error?: string } {
  const normalizedRequest = cloneWorkflowAuthority(params.requestAuthority);
  const storedAuthority = cloneWorkflowAuthority(params.storedAuthority);

  if (!storedAuthority) {
    if (!normalizedRequest) {
      return { authority: null };
    }
    return {
      authority: null,
      error: `Checkpoint '${params.checkpoint.id}' is not bound to workspace authority and cannot be restored from a different scope`,
    };
  }

  if (
    storedAuthority.sessionId
    && normalizedRequest?.sessionId
    && storedAuthority.sessionId !== normalizedRequest.sessionId
  ) {
    return {
      authority: null,
      error: checkpointAuthorityMismatchError(
        params.checkpoint.id,
        'workflow session',
        storedAuthority.sessionId,
        normalizedRequest.sessionId,
      ),
    };
  }

  if (
    storedAuthority.workspaceId
    && normalizedRequest?.workspaceId
    && storedAuthority.workspaceId !== normalizedRequest.workspaceId
  ) {
    return {
      authority: null,
      error: checkpointAuthorityMismatchError(
        params.checkpoint.id,
        'workspace',
        storedAuthority.workspaceId,
        normalizedRequest.workspaceId,
      ),
    };
  }

  if (
    storedAuthority.projectId
    && normalizedRequest?.projectId
    && storedAuthority.projectId !== normalizedRequest.projectId
  ) {
    return {
      authority: null,
      error: checkpointAuthorityMismatchError(
        params.checkpoint.id,
        'project',
        storedAuthority.projectId,
        normalizedRequest.projectId,
      ),
    };
  }

  return {
    authority: {
      sessionId: normalizedRequest?.sessionId ?? storedAuthority.sessionId,
      workspaceId: normalizedRequest?.workspaceId ?? storedAuthority.workspaceId,
      projectId: normalizedRequest?.projectId ?? storedAuthority.projectId,
    },
  };
}

function resolveStoredCheckpointAuthority(
  engine: WorkflowEngine,
  checkpoint: WorkflowCheckpointRecord,
  workspaceRoot?: string,
): WorkflowAuthority | null {
  if (checkpoint.plan_id && typeof engine.getPlanAuthority === 'function') {
    return cloneWorkflowAuthority(engine.getPlanAuthority(checkpoint.plan_id));
  }
  const caches = getOrCreateWorkspaceCaches(workspaceRoot);
  const direct = caches.checkpointAuthorityBindings.get(checkpoint.id);
  if (direct) {
    return cloneWorkflowAuthority(direct);
  }

  for (const cache of workflowRuntimeCachesByWorkspace.values()) {
    const fallback = cache.checkpointAuthorityBindings.get(checkpoint.id);
    if (fallback) {
      return cloneWorkflowAuthority(fallback);
    }
  }

  return null;
}

function normalizeSchedulerTrigger(value: unknown): 'cron' | 'event' | 'manual_run_now' | null {
  if (value === 'cron' || value === 'event' || value === 'manual_run_now') {
    return value;
  }
  return null;
}

function schedulerAuthorityMismatchError(
  taskId: string,
  dimension: 'workflow session' | 'workspace' | 'project',
  expected: string,
  received: string,
): string {
  return `Scheduler task '${taskId}' is bound to ${dimension} '${expected}' and cannot be used with '${received}'`;
}

function resolveSchedulerRequestAuthority(params: {
  taskId: string;
  storedAuthority: WorkflowAuthority | null;
  requestAuthority?: WorkflowAuthority | null;
}): { authority: WorkflowAuthority | null; error?: string } {
  const normalizedRequest = cloneWorkflowAuthority(params.requestAuthority);
  const storedAuthority = cloneWorkflowAuthority(params.storedAuthority);

  if (!storedAuthority) {
    if (!normalizedRequest) {
      return { authority: null };
    }
    return {
      authority: null,
      error: `Scheduler task '${params.taskId}' is not bound to workspace authority and cannot be used from a different scope`,
    };
  }

  if (
    storedAuthority.sessionId
    && normalizedRequest?.sessionId
    && storedAuthority.sessionId !== normalizedRequest.sessionId
  ) {
    return {
      authority: null,
      error: schedulerAuthorityMismatchError(
        params.taskId,
        'workflow session',
        storedAuthority.sessionId,
        normalizedRequest.sessionId,
      ),
    };
  }

  if (
    storedAuthority.workspaceId
    && normalizedRequest?.workspaceId
    && storedAuthority.workspaceId !== normalizedRequest.workspaceId
  ) {
    return {
      authority: null,
      error: schedulerAuthorityMismatchError(
        params.taskId,
        'workspace',
        storedAuthority.workspaceId,
        normalizedRequest.workspaceId,
      ),
    };
  }

  if (
    storedAuthority.projectId
    && normalizedRequest?.projectId
    && storedAuthority.projectId !== normalizedRequest.projectId
  ) {
    return {
      authority: null,
      error: schedulerAuthorityMismatchError(
        params.taskId,
        'project',
        storedAuthority.projectId,
        normalizedRequest.projectId,
      ),
    };
  }

  return {
    authority: {
      sessionId: normalizedRequest?.sessionId ?? storedAuthority.sessionId,
      workspaceId: normalizedRequest?.workspaceId ?? storedAuthority.workspaceId,
      projectId: normalizedRequest?.projectId ?? storedAuthority.projectId,
    },
  };
}

function schedulerTaskMatchesAuthority(
  taskRecord: WorkflowSchedulerTaskRecord,
  requestAuthority: WorkflowAuthority | null,
): boolean {
  const resolved = resolveSchedulerRequestAuthority({
    taskId: taskRecord.task_id,
    storedAuthority: taskRecord.authority,
    requestAuthority,
  });
  return !resolved.error;
}

function getFallbackWorkspaceCachesForAuthority(
  requestAuthority: WorkflowAuthority | null,
  preferredWorkspaceRoot?: string,
): WorkflowRuntimeCaches | null {
  const preferredCaches = preferredWorkspaceRoot
    ? getOrCreateWorkspaceCaches(preferredWorkspaceRoot)
    : null;

  if (!requestAuthority) {
    return preferredCaches;
  }

  const preferredKey = preferredWorkspaceRoot
    ? resolveWorkspaceCacheKey(preferredWorkspaceRoot)
    : null;

  const entries = [...workflowRuntimeCachesByWorkspace.entries()];
  if (preferredKey) {
    const preferredIndex = entries.findIndex(([key]) => key === preferredKey);
    if (preferredIndex > 0) {
      const [preferred] = entries.splice(preferredIndex, 1);
      entries.unshift(preferred);
    }
  }

  for (const [cacheKey, cache] of entries) {
    const matches = [...cache.schedulerEntries.values()].some((taskRecord) => {
      if (!taskRecord.authority) {
        return false;
      }
      return !resolveSchedulerRequestAuthority({
        taskId: taskRecord.task_id,
        storedAuthority: taskRecord.authority,
        requestAuthority,
      }).error;
    });

    if (matches) {
      return getOrCreateWorkspaceCaches(getWorkspaceRootFromCacheKey(cacheKey));
    }
  }

  for (const [cacheKey, cache] of entries) {
    const matches = [...cache.checkpointAuthorityBindings.values()].some((storedAuthority) => {
      if (!storedAuthority) {
        return false;
      }
      return !resolveCheckpointRequestAuthority({
        checkpoint: {
          id: 'checkpoint',
          description: '',
          commit_hash: null,
          created_at: '',
          plan_id: null,
          step_id: null,
          replay_payload: {},
        },
        storedAuthority,
        requestAuthority,
      }).error;
    });

    if (matches) {
      return getOrCreateWorkspaceCaches(getWorkspaceRootFromCacheKey(cacheKey));
    }
  }

  return preferredCaches;
}

function ensureSchedulerTaskAccess(params: {
  taskId: string;
  requestAuthority: WorkflowAuthority | null;
  workspaceRoot?: string;
}):
  | { task: WorkflowSchedulerTaskRecord; authority: WorkflowAuthority | null; caches: WorkflowRuntimeCaches }
  | { error: string } {
  const triedCaches = new Set<string>();
  const candidateCaches: WorkflowRuntimeCaches[] = [];

  const pushCandidate = (cache: WorkflowRuntimeCaches | null) => {
    if (!cache) return;
    const key = resolveWorkspaceCacheKey(cache.workspaceRoot);
    if (triedCaches.has(key)) return;
    triedCaches.add(key);
    candidateCaches.push(cache);
  };

  pushCandidate(params.workspaceRoot ? getOrCreateWorkspaceCaches(params.workspaceRoot) : null);
  pushCandidate(getFallbackWorkspaceCachesForAuthority(params.requestAuthority, params.workspaceRoot));
  for (const cache of workflowRuntimeCachesByWorkspace.values()) {
    pushCandidate(cache);
  }

  let sawTask = false;
  for (const cache of candidateCaches) {
    const task = cache.schedulerEntries.get(params.taskId);
    if (!task) {
      continue;
    }
    sawTask = true;

    const resolved = resolveSchedulerRequestAuthority({
      taskId: params.taskId,
      storedAuthority: task.authority,
      requestAuthority: params.requestAuthority,
    });

    if (resolved.error) {
      return { error: resolved.error };
    }

    return {
      task,
      authority: resolved.authority,
      caches: cache,
    };
  }

  if (!sawTask) {
    return { error: `Scheduler task '${params.taskId}' not found` };
  }

  return { error: `Scheduler task '${params.taskId}' is not accessible in current authority scope` };
}

function parseSchedulerTaskDefinition(input: unknown): WorkflowSchedulerTaskDefinition | null {
  const record = asRecord(input);
  if (!record) return null;

  const taskId = readString(record.task_id);
  const title = readString(record.title);
  const task = readString(record.task);

  const triggerRule = asRecord(record.trigger_rule);
  const backendModePolicy = asRecord(record.backend_mode_policy);
  const progressionPolicy = asRecord(record.progression_policy);

  if (!taskId || !title || !task || !triggerRule || !backendModePolicy || !progressionPolicy) {
    return null;
  }

  const scheduleRule = asRecord(record.schedule_rule);
  const level = readString(record.level);

  return {
    task_id: taskId,
    title,
    task,
    level,
    schedule_rule: scheduleRule ?? undefined,
    trigger_rule: { ...triggerRule },
    backend_mode_policy: { ...backendModePolicy },
    progression_policy: { ...progressionPolicy },
  };
}

function parseWorkflowAuthority(input: unknown): WorkflowAuthority | null {
  const record = asRecord(input);
  if (!record) return null;
  const sessionId = readString(record.sessionId ?? record.session_id);
  const workspaceId = readString(record.workspaceId ?? record.workspace_id);
  const projectId = readString(record.projectId ?? record.project_id);
  if (!sessionId && !workspaceId && !projectId) {
    return null;
  }
  return { sessionId, workspaceId, projectId };
}

function parseSchedulerTaskRecord(input: unknown): WorkflowSchedulerTaskRecord | null {
  const record = asRecord(input);
  if (!record) return null;
  const definition = parseSchedulerTaskDefinition(record);
  if (!definition) return null;

  const now = utcNowIso();
  const status = readString(record.status);
  const normalizedStatus: WorkflowSchedulerStatus = status === 'paused' ? 'paused' : 'active';

  return {
    ...definition,
    status: normalizedStatus,
    created_at: readString(record.created_at) ?? now,
    updated_at: readString(record.updated_at) ?? now,
    authority: parseWorkflowAuthority(record.authority),
    last_run_id: readString(record.last_run_id),
    last_plan_id: readString(record.last_plan_id),
    last_trigger: normalizeSchedulerTrigger(record.last_trigger),
  };
}

function schedulerStorePath(workspaceRoot: string): string {
  return join(workspaceRoot, SCHEDULER_STORE_DIR, SCHEDULER_STORE_FILE);
}

async function loadSchedulerEntriesFromStore(params: {
  force?: boolean;
  workspaceRoot: string;
}): Promise<void> {
  const caches = getOrCreateWorkspaceCaches(params.workspaceRoot);
  if (caches.schedulerStoreLoaded && !params.force) return;

  caches.schedulerEntries.clear();
  const storePath = schedulerStorePath(params.workspaceRoot);

  try {
    const payload = JSON.parse(await readFile(storePath, 'utf-8')) as Record<string, unknown>;
    const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
    for (const task of tasks) {
      const parsed = parseSchedulerTaskRecord(task);
      if (parsed) {
        caches.schedulerEntries.set(parsed.task_id, parsed);
      }
    }
    const version = payload.version;
    caches.schedulerStoreVersion = typeof version === 'number' && Number.isFinite(version)
      ? Math.max(1, Math.floor(version))
      : 1;
  } catch {
    caches.schedulerStoreVersion = 1;
  }

  caches.schedulerStoreLoaded = true;
}

async function loadSchedulerEntriesAcrossWorkspaces(taskId: string): Promise<void> {
  const loaded = new Set<string>();

  for (const cache of workflowRuntimeCachesByWorkspace.values()) {
    const root = cache.workspaceRoot;
    const key = resolveWorkspaceCacheKey(root);
    if (loaded.has(key)) {
      continue;
    }
    loaded.add(key);
    await loadSchedulerEntriesFromStore({ workspaceRoot: root });
  }

  if (!taskId) {
    return;
  }

  const fallbackRoot = resolveWorkflowWorkspace();
  const fallbackKey = resolveWorkspaceCacheKey(fallbackRoot);
  if (!loaded.has(fallbackKey)) {
    await loadSchedulerEntriesFromStore({ workspaceRoot: fallbackRoot });
  }
}

async function persistSchedulerEntriesToStore(workspaceRoot: string): Promise<void> {
  const caches = getOrCreateWorkspaceCaches(workspaceRoot);
  const storePath = schedulerStorePath(workspaceRoot);
  const storeDir = join(workspaceRoot, SCHEDULER_STORE_DIR);
  await mkdir(storeDir, { recursive: true });

  const tasks = [...caches.schedulerEntries.values()]
    .sort((left, right) => left.task_id.localeCompare(right.task_id));
  const payload = {
    version: caches.schedulerStoreVersion,
    updated_at: utcNowIso(),
    tasks,
  };

  await writeFile(storePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
}

const DEFAULT_IMPORT_BACKEND_MODE_POLICY: Record<string, unknown> = {
  mode: 'uiBridge',
  fallback_mode: 'standard',
};

const DEFAULT_IMPORT_PROGRESSION_POLICY: Record<string, unknown> = {
  success_statuses: ['completed'],
  approval_policy: {
    tiers: [
      {
        tier: 'critical',
        requires_confirmation: true,
        gate_status_on_hold: 'waiting_confirmation',
      },
      {
        tier: 'high',
        requires_confirmation: true,
        gate_status_on_hold: 'waiting_confirmation',
      },
      {
        tier: 'medium',
        requires_confirmation: false,
        gate_status_on_hold: 'waiting_confirmation',
      },
    ],
    default_gate_status: 'waiting_confirmation',
  },
  failure_policy: {
    retry: {
      max_retries: 2,
      strategy: 'linear',
      base_delay_ms: 1000,
    },
    on_retry_exhausted: 'manual_takeover',
    manual_takeover_status: 'gate_blocked',
  },
};

function sanitizeImportSessionId(sessionId: string): string {
  return sessionId.replace(/[^a-zA-Z0-9._-]/g, '');
}

async function resolveLitePlanSessionId(baseDir: string, requestedSessionId?: string | null): Promise<string | null> {
  const requested = readString(requestedSessionId);
  if (requested) {
    const sanitized = sanitizeImportSessionId(requested);
    return sanitized || null;
  }

  const entries = await readdir(baseDir, { withFileTypes: true });
  const candidates = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  if (candidates.length === 0) {
    return null;
  }

  const ranked = await Promise.all(candidates.map(async (name) => {
    const fullPath = join(baseDir, name);
    const details = await stat(fullPath);
    return {
      name,
      mtimeMs: details.mtimeMs,
    };
  }));

  ranked.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return ranked[0]?.name ?? null;
}

function normalizeImportedTaskId(sessionId: string, taskId: string): string {
  const normalizedTaskId = taskId.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const normalizedSession = sessionId.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  return `lite-${normalizedSession}-${normalizedTaskId}`;
}

function buildImportedSchedulerDefinition(params: {
  sessionId: string;
  taskId: string;
  taskRecord: Record<string, unknown>;
  forceLevel: string;
}): WorkflowSchedulerTaskDefinition {
  const title = readString(params.taskRecord.title) ?? params.taskId;
  const taskText = readString(params.taskRecord.description)
    ?? readString(params.taskRecord.scope)
    ?? title;

  return {
    task_id: normalizeImportedTaskId(params.sessionId, params.taskId),
    title,
    task: taskText,
    level: params.forceLevel,
    trigger_rule: {
      type: 'manual_run_now',
      run_now: true,
    },
    backend_mode_policy: { ...DEFAULT_IMPORT_BACKEND_MODE_POLICY },
    progression_policy: { ...DEFAULT_IMPORT_PROGRESSION_POLICY },
  };
}

function getEngine(workspaceRoot?: string): WorkflowEngine | null {
  const resolvedWorkspaceRoot = workspaceRoot ?? resolveWorkflowWorkspace();
  const caches = getOrCreateWorkspaceCaches(resolvedWorkspaceRoot);
  const providerVersion = getWorkflowEngineRuntimeProviderVersion();
  if (
    caches.workflowEngineInstance
    && caches.workflowEngineInstanceProviderVersion !== providerVersion
  ) {
    caches.workflowEngineInstance = null;
  }

  if (!caches.workflowEngineInstance) {
    const runtimeProvider = getWorkflowEngineRuntimeProvider();
    const engine = runtimeProvider({
      workspace: resolvedWorkspaceRoot,
      sessionNamespace: 'mcp-workflow',
    });
    caches.workflowEngineInstance = {
      bindPlanAuthority(planId: string, authority: WorkflowAuthority) {
        if (typeof engine.bindPlanAuthority === 'function') {
          return engine.bindPlanAuthority(planId, authority);
        }
        if (authority.sessionId) {
          engine.bindPlanSession(planId, authority.sessionId);
        }
        return authority;
      },
      getPlanAuthority(planId: string) {
        if (typeof engine.getPlanAuthority === 'function') {
          return engine.getPlanAuthority(planId);
        }
        return {
          sessionId: null,
          workspaceId: null,
          projectId: null,
        };
      },
      getCheckpoint(checkpointId: string) {
        const checkpoint = engine.getCheckpoint?.(checkpointId);
        if (!checkpoint) {
          return null;
        }
        return {
          id: checkpoint.id,
          description: checkpoint.description,
          commit_hash: checkpoint.commit_hash ?? null,
          created_at: checkpoint.created_at,
          plan_id: checkpoint.plan_id ?? null,
          step_id: checkpoint.step_id ?? null,
          replay_payload: checkpoint.replay_payload ?? {},
        };
      },
      route(task: string) {
        return engine.route(task);
      },
      plan(
        task: string,
        level?: string | null,
        params?: {
          recommendations?: WorkflowRecommendationInput | null;
          traceContext?: WorkflowTraceContext | null;
        },
      ) {
        return engine.plan(
          task,
          level ?? undefined,
          params?.recommendations ?? undefined,
          params?.traceContext
            ? {
                trace_context: params.traceContext as unknown as Record<string, unknown>,
              }
            : undefined,
        );
      },
      execute(
        planId: string,
        stepId?: string | null,
        params?: {
          recommendations?: WorkflowRecommendationInput | null;
          confirmToken?: string | null;
        },
        authority?: WorkflowAuthority | null,
      ) {
        if (authority) {
          return engine.execute(
            planId,
            stepId ?? undefined,
            params?.recommendations ?? undefined,
            params?.confirmToken ?? undefined,
            authority,
          );
        }
        return engine.execute(
          planId,
          stepId ?? undefined,
          params?.recommendations ?? undefined,
          params?.confirmToken ?? undefined,
        );
      },
      quickRollback(
        params: { planId: string; checkpointId: string; reason: string },
        authority?: WorkflowAuthority | null,
      ) {
        if (authority) {
          return engine.quickRollback(
            params.planId,
            params.checkpointId,
            params.reason,
            authority,
          );
        }
        return engine.quickRollback(params.planId, params.checkpointId, params.reason);
      },
      lifecycle(planId: string, action: string, authority?: WorkflowAuthority | null) {
        if (authority) {
          return engine.lifecycle(planId, action, undefined, authority);
        }
        return engine.lifecycle(planId, action);
      },
      createCheckpoint(description: string, autoCommit: boolean) {
        return engine.createCheckpoint(description, autoCommit);
      },
      restoreCheckpoint(checkpointId: string, params?: { confirmToken?: string | null }) {
        return engine.restoreCheckpoint(checkpointId, params?.confirmToken ?? undefined);
      },
      async listCheckpoints(limit: number): Promise<WorkflowCheckpointSummary[]> {
        const records = await engine.listCheckpoints(limit);
        return records as unknown as WorkflowCheckpointSummary[];
      },
      bindPlanSession(planId: string, sessionId: string) {
        return engine.bindPlanSession(planId, sessionId);
      },
    };
    caches.workflowEngineInstanceProviderVersion = providerVersion;
  }
  return caches.workflowEngineInstance;
}

// ---------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------

export async function workflowRoute(
  task: string,
  workspace?: ProjectWorkspaceContext,
): Promise<Record<string, unknown>> {
  const workspaceRoot = resolveWorkspaceRootForRequest(workspace);
  const engine = getEngine(workspaceRoot);
  if (!engine) return { level: 'L1', reason: 'Workflow engine unavailable' };
  return engine.route(task);
}

export async function workflowPlan(params: {
  task: string;
  level?: string | null;
  recommendations?: WorkflowRecommendationInput | null;
  traceContext?: WorkflowTraceContext | null;
  genre?: string | null;
  workspace?: ProjectWorkspaceContext;
}): Promise<Record<string, unknown>> {
  let mergedRecommendations = params.recommendations ?? [];

  const workspaceRoot = resolveWorkspaceRootForRequest(params.workspace);
  const engine = getEngine(workspaceRoot);
  if (!engine) return { error: 'Workflow engine unavailable' };
  const result = await engine.plan(params.task, params.level, {
    recommendations: mergedRecommendations,
    traceContext: params.traceContext ?? null,
  });
  const planId = result['plan_id'];
  const authority = resolveWorkflowAuthority(params.workspace);
  if (typeof planId === 'string' && planId && authority) {
    if (engine.bindPlanAuthority) {
      engine.bindPlanAuthority(planId, authority);
    } else if (authority.sessionId) {
      engine.bindPlanSession(planId, authority.sessionId);
    }
  }
  return result;
}

export async function workflowExecute(params: {
  planId: string;
  stepId?: string | null;
  recommendations?: WorkflowRecommendationInput | null;
  confirmToken?: string | null;
  workspace?: ProjectWorkspaceContext;
}): Promise<Record<string, unknown>> {
  const workspaceRoot = resolveWorkspaceRootForRequest(params.workspace);
  const engine = getEngine(workspaceRoot);
  if (!engine) return { error: 'Workflow engine unavailable' };
  const authority = resolveWorkflowAuthority(params.workspace);
  return engine.execute(params.planId, params.stepId ?? null, {
    recommendations: params.recommendations ?? null,
    confirmToken: params.confirmToken ?? null,
  }, authority);
}

export async function workflowQuickRollback(params: {
  planId: string;
  checkpointId: string;
  reason?: string;
  workspace?: ProjectWorkspaceContext;
}): Promise<Record<string, unknown>> {
  const workspaceRoot = resolveWorkspaceRootForRequest(params.workspace);
  const engine = getEngine(workspaceRoot);
  if (!engine) return { error: 'Workflow engine unavailable' };
  const authority = resolveWorkflowAuthority(params.workspace);
  return engine.quickRollback({
    planId: params.planId,
    checkpointId: params.checkpointId,
    reason: params.reason ?? '',
  }, authority);
}

export async function workflowLifecycle(
  planId: string,
  action = 'status',
  workspace?: ProjectWorkspaceContext,
): Promise<Record<string, unknown>> {
  const workspaceRoot = resolveWorkspaceRootForRequest(workspace);
  const engine = getEngine(workspaceRoot);
  if (!engine) return { error: 'Workflow engine unavailable' };
  const authority = resolveWorkflowAuthority(workspace);

  // Quality gate check for stage-advancing actions
  const phaseAdvancingActions = ['advance', 'complete', 'resume'];
  if (phaseAdvancingActions.includes(action)) {
    try {
      const container = getContainer();
      const phaseOrchestrator = container.phaseOrchestrator;
      const gatePassed = await phaseOrchestrator.checkQualityGate('1', action);
      if (!gatePassed) {
        return {
          error: 'Quality gate blocked stage transition',
          action,
          gateBlocked: true,
          planId,
        };
      }
    } catch {
      // PhaseOrchestrator unavailable — allow transition (graceful degradation)
    }
  }

  return engine.lifecycle(planId, action, authority);
}

export async function workflowSchedulerRegister(params: {
  definition?: unknown;
  enabled?: boolean | null;
  workspace?: ProjectWorkspaceContext;
}): Promise<Record<string, unknown>> {
  const workspaceRoot = resolveWorkspaceRootForRequest(params.workspace);
  const caches = getOrCreateWorkspaceCaches(workspaceRoot);
  await loadSchedulerEntriesFromStore({ workspaceRoot });

  const definition = parseSchedulerTaskDefinition(params.definition);
  if (!definition) {
    return { error: 'Invalid scheduler task definition' };
  }

  const now = utcNowIso();
  const existing = caches.schedulerEntries.get(definition.task_id);
  const authority = resolveWorkflowAuthority(params.workspace);

  if (existing) {
    const resolved = resolveSchedulerRequestAuthority({
      taskId: existing.task_id,
      storedAuthority: existing.authority,
      requestAuthority: authority,
    });
    if (resolved.error) {
      return { error: resolved.error };
    }
  }

  const triggerRule = asRecord(definition.trigger_rule);
  const scheduleRule = asRecord(definition.schedule_rule);
  const triggerFromDefinition = normalizeSchedulerTrigger(
    triggerRule?.type ?? scheduleRule?.cadence,
  );

  const status: WorkflowSchedulerStatus = readBoolean(params.enabled) === false ? 'paused' : 'active';
  const taskRecord: WorkflowSchedulerTaskRecord = {
    ...definition,
    status,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    authority,
    last_run_id: existing?.last_run_id ?? null,
    last_plan_id: existing?.last_plan_id ?? null,
    last_trigger: existing?.last_trigger ?? triggerFromDefinition,
  };

  caches.schedulerEntries.set(taskRecord.task_id, taskRecord);
  caches.schedulerStoreVersion += 1;
  await persistSchedulerEntriesToStore(workspaceRoot);

  return {
    status: existing ? 'updated' : 'registered',
    task: taskRecord,
  };
}

export async function workflowSchedulerImportLitePlan(params: {
  sessionId?: string | null;
  forceLevel?: string | null;
  enabled?: boolean | null;
  workspace?: ProjectWorkspaceContext;
}): Promise<Record<string, unknown>> {
  const workspaceRoot = resolveWorkspaceRootForRequest(params.workspace);
  await loadSchedulerEntriesFromStore({ workspaceRoot });

  const baseDir = join(workspaceRoot, '.workflow', '.lite-plan');
  const importedWorkspace = normalizeProjectWorkspaceContext(
    { workspace: params.workspace ?? {} },
    { workspaceRoot },
  );

  let sessionId: string | null = null;
  try {
    sessionId = await resolveLitePlanSessionId(baseDir, params.sessionId);
  } catch {
    return { error: `Lite-plan directory not found at '${baseDir}'` };
  }

  if (!sessionId) {
    return { error: 'No lite-plan session available for import' };
  }

  const planDir = join(baseDir, sessionId);
  const planPath = join(planDir, 'plan.json');

  const planPayload = JSON.parse(await readFile(planPath, 'utf-8')) as Record<string, unknown>;
  const taskIds = Array.isArray(planPayload.task_ids)
    ? planPayload.task_ids.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  if (taskIds.length === 0) {
    return { error: `No task_ids found in lite-plan session '${sessionId}'` };
  }

  const importedTasks: WorkflowSchedulerTaskRecord[] = [];
  const failures: Array<{ task_id: string; error: string }> = [];
  let registeredCount = 0;
  let updatedCount = 0;
  const forceLevel = readString(params.forceLevel) ?? 'L5';

  for (const taskId of taskIds) {
    const taskPath = join(planDir, '.task', `${taskId}.json`);

    try {
      const taskPayload = JSON.parse(await readFile(taskPath, 'utf-8')) as Record<string, unknown>;
      const definition = buildImportedSchedulerDefinition({
        sessionId,
        taskId,
        taskRecord: taskPayload,
        forceLevel,
      });

      const upsertResult = await workflowSchedulerRegister({
        definition,
        enabled: params.enabled,
        workspace: importedWorkspace,
      });

      if (upsertResult.error) {
        failures.push({ task_id: taskId, error: String(upsertResult.error) });
        continue;
      }

      const taskRecord = upsertResult.task as WorkflowSchedulerTaskRecord | undefined;
      if (taskRecord) {
        importedTasks.push(taskRecord);
      }

      if (upsertResult.status === 'updated') {
        updatedCount += 1;
      } else {
        registeredCount += 1;
      }
    } catch (error) {
      failures.push({
        task_id: taskId,
        error: error instanceof Error ? error.message : 'Failed to import task',
      });
    }
  }

  return {
    session_id: sessionId,
    imported: importedTasks.length,
    registered: registeredCount,
    updated: updatedCount,
    failed: failures.length,
    total_tasks: taskIds.length,
    force_level: forceLevel,
    tasks: importedTasks,
    failures,
  };
}

export async function workflowSchedulerList(params: {
  limit?: number;
  workspace?: ProjectWorkspaceContext;
}): Promise<Record<string, unknown>> {
  const workspaceRoot = resolveWorkspaceRootForRequest(params.workspace);
  const hasWorkspace = Boolean(params.workspace);

  if (hasWorkspace) {
    const caches = getOrCreateWorkspaceCaches(workspaceRoot);
    await loadSchedulerEntriesFromStore({ workspaceRoot });

    const authority = resolveWorkflowAuthority(params.workspace);
    const entries = [...caches.schedulerEntries.values()]
      .filter((item) => schedulerTaskMatchesAuthority(item, authority))
      .sort((left, right) => right.updated_at.localeCompare(left.updated_at));

    const limit = typeof params.limit === 'number' && Number.isFinite(params.limit)
      ? Math.max(0, Math.floor(params.limit))
      : 50;

    return {
      total: entries.length,
      tasks: entries.slice(0, limit),
    };
  }

  await loadSchedulerEntriesAcrossWorkspaces('');

  const dedupedByTaskId = new Map<string, WorkflowSchedulerTaskRecord>();
  for (const cache of workflowRuntimeCachesByWorkspace.values()) {
    for (const task of cache.schedulerEntries.values()) {
      const existing = dedupedByTaskId.get(task.task_id);
      if (!existing || task.updated_at > existing.updated_at) {
        dedupedByTaskId.set(task.task_id, task);
      }
    }
  }

  const entries = [...dedupedByTaskId.values()]
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at));

  const limit = typeof params.limit === 'number' && Number.isFinite(params.limit)
    ? Math.max(0, Math.floor(params.limit))
    : 50;

  return {
    total: entries.length,
    tasks: entries.slice(0, limit),
  };
}

export async function workflowSchedulerPause(params: {
  taskId: string;
  workspace?: ProjectWorkspaceContext;
}): Promise<Record<string, unknown>> {
  const workspaceRoot = resolveWorkspaceRootForRequest(params.workspace);
  const caches = getOrCreateWorkspaceCaches(workspaceRoot);
  await loadSchedulerEntriesFromStore({ workspaceRoot });

  const authority = resolveWorkflowAuthority(params.workspace);
  const accessible = ensureSchedulerTaskAccess({
    taskId: params.taskId,
    requestAuthority: authority,
    workspaceRoot,
  });
  if ('error' in accessible) {
    return { error: accessible.error };
  }

  const updated: WorkflowSchedulerTaskRecord = {
    ...accessible.task,
    status: 'paused',
    updated_at: utcNowIso(),
    authority: accessible.authority,
  };
  caches.schedulerEntries.set(updated.task_id, updated);
  caches.schedulerStoreVersion += 1;
  await persistSchedulerEntriesToStore(workspaceRoot);

  return {
    status: 'paused',
    task: updated,
  };
}

export async function workflowSchedulerResume(params: {
  taskId: string;
  workspace?: ProjectWorkspaceContext;
}): Promise<Record<string, unknown>> {
  const workspaceRoot = resolveWorkspaceRootForRequest(params.workspace);
  const caches = getOrCreateWorkspaceCaches(workspaceRoot);
  await loadSchedulerEntriesFromStore({ workspaceRoot });

  const authority = resolveWorkflowAuthority(params.workspace);
  const accessible = ensureSchedulerTaskAccess({
    taskId: params.taskId,
    requestAuthority: authority,
    workspaceRoot,
  });
  if ('error' in accessible) {
    return { error: accessible.error };
  }

  const updated: WorkflowSchedulerTaskRecord = {
    ...accessible.task,
    status: 'active',
    updated_at: utcNowIso(),
    authority: accessible.authority,
  };
  caches.schedulerEntries.set(updated.task_id, updated);
  caches.schedulerStoreVersion += 1;
  await persistSchedulerEntriesToStore(workspaceRoot);

  return {
    status: 'active',
    task: updated,
  };
}

export async function workflowSchedulerRunNow(params: {
  taskId: string;
  confirmToken?: string | null;
  recommendations?: WorkflowRecommendationInput | null;
  workspace?: ProjectWorkspaceContext;
}): Promise<Record<string, unknown>> {
  const workspaceRoot = resolveWorkspaceRootForRequest(params.workspace);
  const caches = getOrCreateWorkspaceCaches(workspaceRoot);
  await loadSchedulerEntriesFromStore({ workspaceRoot });

  const authority = resolveWorkflowAuthority(params.workspace);
  const accessible = ensureSchedulerTaskAccess({
    taskId: params.taskId,
    requestAuthority: authority,
    workspaceRoot,
  });
  if ('error' in accessible) {
    return { error: accessible.error };
  }

  const taskRecord = accessible.task;
  if (taskRecord.status !== 'active') {
    return { error: `Scheduler task '${taskRecord.task_id}' is paused` };
  }

  const planResult = await workflowPlan({
    task: taskRecord.task,
    level: taskRecord.level ?? null,
    workspace: params.workspace,
    recommendations: params.recommendations ?? null,
  });

  const planId = readString(planResult['plan_id']);
  if (!planId) {
    return {
      error: readString(planResult['error']) ?? 'Failed to create workflow plan from scheduler task',
      task: taskRecord,
      plan: planResult,
    };
  }

  const executeResult = await workflowExecute({
    planId,
    confirmToken: params.confirmToken ?? null,
    recommendations: params.recommendations ?? null,
    workspace: params.workspace,
  });

  const executionStatus = readString(executeResult['status']) as WorkflowExecutionStatus | null;
  const runId = `scheduler-run-${taskRecord.task_id}-${Date.now()}`;
  const updatedTask: WorkflowSchedulerTaskRecord = {
    ...taskRecord,
    updated_at: utcNowIso(),
    authority: accessible.authority,
    last_plan_id: planId,
    last_run_id: runId,
    last_trigger: 'manual_run_now',
  };
  caches.schedulerEntries.set(updatedTask.task_id, updatedTask);
  caches.schedulerStoreVersion += 1;
  await persistSchedulerEntriesToStore(workspaceRoot);

  return {
    status: executionStatus ?? 'completed',
    trigger: 'manual_run_now',
    run_id: runId,
    plan_id: planId,
    task: updatedTask,
    execute: executeResult,
  };
}

export async function checkpointCreate(
  description = '',
  autoCommit = true,
  workspace?: ProjectWorkspaceContext,
): Promise<Record<string, unknown>> {
  const workspaceRoot = resolveWorkspaceRootForRequest(workspace);
  const caches = getOrCreateWorkspaceCaches(workspaceRoot);
  const engine = getEngine(workspaceRoot);
  if (!engine) return { error: 'Workflow engine unavailable' };
  const result = await engine.createCheckpoint(description, autoCommit);
  const checkpointId = typeof result['checkpoint_id'] === 'string' ? result['checkpoint_id'] : null;
  const authority = resolveCheckpointAuthority(workspace, workspaceRoot);
  if (checkpointId && authority) {
    caches.checkpointAuthorityBindings.set(checkpointId, authority);
  }
  return result;
}

export async function checkpointRestore(
  checkpointId: string,
  confirmToken?: string | null,
  workspace?: ProjectWorkspaceContext,
): Promise<Record<string, unknown>> {
  const workspaceRoot = resolveWorkspaceRootForRequest(workspace);
  const engine = getEngine(workspaceRoot);
  if (!engine) return { error: 'Workflow engine unavailable' };
  const checkpoint = engine.getCheckpoint?.(checkpointId) ?? null;
  if (!checkpoint) {
    return { error: `Checkpoint '${checkpointId}' not found` };
  }
  const storedAuthority = resolveStoredCheckpointAuthority(engine, checkpoint, workspaceRoot);
  const authority = resolveCheckpointAuthority(workspace, workspaceRoot);
  const resolvedAuthority = resolveCheckpointRequestAuthority({
    checkpoint,
    storedAuthority,
    requestAuthority: authority,
  });
  if (resolvedAuthority.error) {
    return { error: resolvedAuthority.error };
  }
  return engine.restoreCheckpoint(checkpointId, { confirmToken: confirmToken ?? null });
}

export async function checkpointList(
  limit = 10,
  workspace?: ProjectWorkspaceContext,
): Promise<WorkflowCheckpointSummary[]> {
  const workspaceRoot = resolveWorkspaceRootForRequest(workspace);
  const engine = getEngine(workspaceRoot);
  if (!engine) return [];
  const authority = resolveCheckpointAuthority(workspace, workspaceRoot);
  const checkpoints = await engine.listCheckpoints(limit) as WorkflowCheckpointSummary[];
  return checkpoints.filter((summary) => {
    const checkpoint = engine.getCheckpoint?.(summary.id) ?? null;
    if (!checkpoint) {
      return false;
    }
    const storedAuthority = resolveStoredCheckpointAuthority(engine, checkpoint, workspaceRoot);
    return !resolveCheckpointRequestAuthority({
      checkpoint,
      storedAuthority,
      requestAuthority: authority,
    }).error;
  });
}
