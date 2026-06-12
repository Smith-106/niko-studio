import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  normalizeProjectWorkspaceContext,
  projectWorkspaceToWorkflowAuthority,
  type ProjectWorkspaceContext,
} from '../../project/workspace-model.js';
import {
  analyzeRevisionText,
  compareRevisionAnalyses,
  deriveWeakPoints,
  generateRevisionSuggestions,
  type RevisionComparison,
  type RevisionIteration,
  type RevisionSession,
  type RevisionSessionAuthority,
} from '../../workflow/revision-session.js';

const REVISION_SESSION_STORE_DIR = join('.writing', 'revision-sessions');

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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

function resolveWorkflowAuthority(workspace: ProjectWorkspaceContext): RevisionSessionAuthority | null {
  const scope = projectWorkspaceToWorkflowAuthority(workspace);
  const sessionId = readString(scope.sessionId);
  const workspaceId = readString(scope.workspaceId);
  const projectId = readString(scope.projectId);
  if (!sessionId && !workspaceId && !projectId) {
    return null;
  }
  return {
    sessionId,
    workspaceId,
    projectId,
  };
}

function createWorkspaceFromRoot(workspaceRoot: string): ProjectWorkspaceContext {
  return normalizeProjectWorkspaceContext({}, { workspaceRoot });
}

function ensureAuthorityAccess(
  sessionId: string,
  storedAuthority: RevisionSessionAuthority | null,
  requestAuthority: RevisionSessionAuthority | null,
): string | null {
  if (!storedAuthority) {
    return null;
  }

  if (
    storedAuthority.sessionId
    && requestAuthority?.sessionId
    && storedAuthority.sessionId !== requestAuthority.sessionId
  ) {
    return `Revision session '${sessionId}' is bound to workflow session '${storedAuthority.sessionId}' and cannot be used with '${requestAuthority.sessionId}'`;
  }

  if (
    storedAuthority.workspaceId
    && requestAuthority?.workspaceId
    && storedAuthority.workspaceId !== requestAuthority.workspaceId
  ) {
    return `Revision session '${sessionId}' is bound to workspace '${storedAuthority.workspaceId}' and cannot be used with '${requestAuthority.workspaceId}'`;
  }

  if (
    storedAuthority.projectId
    && requestAuthority?.projectId
    && storedAuthority.projectId !== requestAuthority.projectId
  ) {
    return `Revision session '${sessionId}' is bound to project '${storedAuthority.projectId}' and cannot be used with '${requestAuthority.projectId}'`;
  }

  return null;
}

async function ensureStoreDir(workspaceRoot: string): Promise<string> {
  const dir = join(workspaceRoot, REVISION_SESSION_STORE_DIR);
  await mkdir(dir, { recursive: true });
  return dir;
}

function buildSessionPath(workspaceRoot: string, sessionId: string): string {
  return join(workspaceRoot, REVISION_SESSION_STORE_DIR, `${sessionId}.json`);
}

function createSessionId(): string {
  return `revision-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function writeSession(workspaceRoot: string, session: RevisionSession): Promise<void> {
  await ensureStoreDir(workspaceRoot);
  await writeFile(buildSessionPath(workspaceRoot, session.id), `${JSON.stringify(session, null, 2)}\n`, 'utf-8');
}

async function readSession(workspaceRoot: string, sessionId: string): Promise<RevisionSession | null> {
  try {
    const content = await readFile(buildSessionPath(workspaceRoot, sessionId), 'utf-8');
    return JSON.parse(content) as RevisionSession;
  } catch {
    return null;
  }
}

async function readAllSessions(workspaceRoot: string): Promise<RevisionSession[]> {
  const dir = await ensureStoreDir(workspaceRoot);
  const entries = await readdir(dir, { withFileTypes: true });
  const sessions: RevisionSession[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    try {
      const content = await readFile(join(dir, entry.name), 'utf-8');
      sessions.push(JSON.parse(content) as RevisionSession);
    } catch {
      // Ignore malformed historical files.
    }
  }

  return sessions;
}

function getCurrentIteration(session: RevisionSession): RevisionIteration | null {
  if (session.iterations.length === 0) return null;
  return session.iterations[session.iterations.length - 1] as RevisionIteration;
}

function upsertIteration(session: RevisionSession, iteration: RevisionIteration): void {
  session.iterations[session.iterations.length - 1] = iteration;
}

function createResponseWorkspace(workspaceRoot: string): ProjectWorkspaceContext {
  return createWorkspaceFromRoot(workspaceRoot);
}

export async function workflowRevisionStartSession(params: {
  chapterId: string;
  content: string;
  workspace?: ProjectWorkspaceContext | null;
}): Promise<Record<string, unknown>> {
  const chapterId = readString(params.chapterId);
  const content = params.content ?? '';
  if (!chapterId) {
    return { error: 'chapter_id is required' };
  }
  if (!content.trim()) {
    return { error: 'content is required' };
  }

  const workspaceRoot = resolveWorkspaceRootForRequest(params.workspace ?? null);
  const authority = resolveWorkflowAuthority(params.workspace ?? createResponseWorkspace(workspaceRoot));
  const baselineAnalysis = analyzeRevisionText(content);
  const session: RevisionSession = {
    schemaVersion: 'revision-session.v1',
    id: createSessionId(),
    chapterId,
    createdAt: utcNowIso(),
    updatedAt: utcNowIso(),
    state: 'IDLE',
    baselineText: content,
    currentText: content,
    baselineScores: baselineAnalysis.scores,
    iterations: [],
    authority,
  };

  await writeSession(workspaceRoot, session);

  return {
    session_id: session.id,
    status: session.state,
    session,
    baseline_scores: session.baselineScores,
  };
}

export async function workflowRevisionAnalyzeWeakPoints(params: {
  sessionId: string;
  content?: string | null;
  workspace?: ProjectWorkspaceContext | null;
}): Promise<Record<string, unknown>> {
  const sessionId = readString(params.sessionId);
  if (!sessionId) {
    return { error: 'session_id is required' };
  }

  const workspaceRoot = resolveWorkspaceRootForRequest(params.workspace ?? null);
  const session = await readSession(workspaceRoot, sessionId);
  if (!session) {
    return { error: `Revision session '${sessionId}' not found` };
  }

  const authorityError = ensureAuthorityAccess(
    sessionId,
    session.authority,
    resolveWorkflowAuthority(params.workspace ?? createResponseWorkspace(workspaceRoot)),
  );
  if (authorityError) {
    return { error: authorityError };
  }

  if (typeof params.content === 'string' && params.content.trim()) {
    session.currentText = params.content;
  }

  const currentIteration = getCurrentIteration(session);
  const needsNewIteration = !currentIteration || Boolean(currentIteration.comparison);
  const iterationNumber = needsNewIteration
    ? session.iterations.length + 1
    : currentIteration.iterationNumber;

  const analysis = analyzeRevisionText(session.currentText);
  const weakPoints = deriveWeakPoints(session.currentText, analysis);
  const nextIteration: RevisionIteration = {
    iterationNumber,
    analyzedAt: utcNowIso(),
    weakPoints,
    suggestions: currentIteration?.suggestions ?? [],
    revisedText: currentIteration?.revisedText,
    appliedAt: currentIteration?.appliedAt,
    resultScores: currentIteration?.resultScores,
    comparison: undefined,
  };

  if (needsNewIteration) {
    session.iterations.push(nextIteration);
  } else {
    upsertIteration(session, nextIteration);
  }

  session.state = 'ANALYZED';
  session.updatedAt = utcNowIso();
  await writeSession(workspaceRoot, session);

  return {
    session_id: session.id,
    status: session.state,
    iteration_number: iterationNumber,
    weak_points: weakPoints,
    baseline_scores: session.baselineScores,
    session,
  };
}

export async function workflowRevisionGenerateSuggestions(params: {
  sessionId: string;
  weakPointIds?: string[] | null;
  workspace?: ProjectWorkspaceContext | null;
}): Promise<Record<string, unknown>> {
  const sessionId = readString(params.sessionId);
  if (!sessionId) {
    return { error: 'session_id is required' };
  }

  const workspaceRoot = resolveWorkspaceRootForRequest(params.workspace ?? null);
  const session = await readSession(workspaceRoot, sessionId);
  if (!session) {
    return { error: `Revision session '${sessionId}' not found` };
  }

  const authorityError = ensureAuthorityAccess(
    sessionId,
    session.authority,
    resolveWorkflowAuthority(params.workspace ?? createResponseWorkspace(workspaceRoot)),
  );
  if (authorityError) {
    return { error: authorityError };
  }

  const iteration = getCurrentIteration(session);
  if (!iteration || iteration.weakPoints.length === 0) {
    return { error: `Revision session '${sessionId}' has no analyzed weak points` };
  }

  const selectedIds = Array.isArray(params.weakPointIds)
    ? new Set(params.weakPointIds.filter((item): item is string => typeof item === 'string' && item.trim().length > 0))
    : null;
  const selectedWeakPoints = selectedIds
    ? iteration.weakPoints.filter((item) => selectedIds.has(item.id))
    : iteration.weakPoints;
  const analysis = analyzeRevisionText(session.currentText);
  iteration.suggestions = generateRevisionSuggestions(selectedWeakPoints, analysis);
  session.state = 'SUGGESTED';
  session.updatedAt = utcNowIso();
  await writeSession(workspaceRoot, session);

  return {
    session_id: session.id,
    status: session.state,
    iteration_number: iteration.iterationNumber,
    suggestions: iteration.suggestions,
    session,
  };
}

export async function workflowRevisionMarkRevised(params: {
  sessionId: string;
  revisedText: string;
  workspace?: ProjectWorkspaceContext | null;
}): Promise<Record<string, unknown>> {
  const sessionId = readString(params.sessionId);
  if (!sessionId) {
    return { error: 'session_id is required' };
  }
  if (!params.revisedText?.trim()) {
    return { error: 'revised_text is required' };
  }

  const workspaceRoot = resolveWorkspaceRootForRequest(params.workspace ?? null);
  const session = await readSession(workspaceRoot, sessionId);
  if (!session) {
    return { error: `Revision session '${sessionId}' not found` };
  }

  const authorityError = ensureAuthorityAccess(
    sessionId,
    session.authority,
    resolveWorkflowAuthority(params.workspace ?? createResponseWorkspace(workspaceRoot)),
  );
  if (authorityError) {
    return { error: authorityError };
  }

  const iteration = getCurrentIteration(session);
  if (!iteration) {
    return { error: `Revision session '${sessionId}' has no active iteration` };
  }

  iteration.revisedText = params.revisedText;
  iteration.appliedAt = utcNowIso();
  session.currentText = params.revisedText;
  session.state = 'REVISED';
  session.updatedAt = utcNowIso();
  await writeSession(workspaceRoot, session);

  return {
    session_id: session.id,
    status: session.state,
    iteration_number: iteration.iterationNumber,
    session,
  };
}

export async function workflowRevisionCompare(params: {
  sessionId: string;
  revisedText?: string | null;
  workspace?: ProjectWorkspaceContext | null;
}): Promise<Record<string, unknown>> {
  const sessionId = readString(params.sessionId);
  if (!sessionId) {
    return { error: 'session_id is required' };
  }

  const workspaceRoot = resolveWorkspaceRootForRequest(params.workspace ?? null);
  const session = await readSession(workspaceRoot, sessionId);
  if (!session) {
    return { error: `Revision session '${sessionId}' not found` };
  }

  const authorityError = ensureAuthorityAccess(
    sessionId,
    session.authority,
    resolveWorkflowAuthority(params.workspace ?? createResponseWorkspace(workspaceRoot)),
  );
  if (authorityError) {
    return { error: authorityError };
  }

  const iteration = getCurrentIteration(session);
  if (!iteration) {
    return { error: `Revision session '${sessionId}' has no active iteration` };
  }

  const revisedText = typeof params.revisedText === 'string' && params.revisedText.trim()
    ? params.revisedText
    : iteration.revisedText ?? session.currentText;
  if (!revisedText.trim()) {
    return { error: `Revision session '${sessionId}' has no revised text to compare` };
  }

  session.currentText = revisedText;
  iteration.revisedText = revisedText;
  iteration.appliedAt = iteration.appliedAt ?? utcNowIso();

  const baselineAnalysis = analyzeRevisionText(session.baselineText);
  const revisedAnalysis = analyzeRevisionText(revisedText);
  const comparison: RevisionComparison = compareRevisionAnalyses({
    sessionId: session.id,
    iterationNumber: iteration.iterationNumber,
    baseline: baselineAnalysis,
    revised: revisedAnalysis,
  });

  iteration.resultScores = comparison.resultScores;
  iteration.comparison = comparison;
  session.lastComparison = comparison;
  session.state = 'COMPARED';
  session.updatedAt = utcNowIso();
  await writeSession(workspaceRoot, session);

  return {
    session_id: session.id,
    status: session.state,
    iteration_number: iteration.iterationNumber,
    comparison,
    session,
  };
}

export async function workflowRevisionHistory(params: {
  chapterId: string;
  workspace?: ProjectWorkspaceContext | null;
}): Promise<Record<string, unknown>> {
  const chapterId = readString(params.chapterId);
  if (!chapterId) {
    return { error: 'chapter_id is required' };
  }

  const workspaceRoot = resolveWorkspaceRootForRequest(params.workspace ?? null);
  const authority = resolveWorkflowAuthority(params.workspace ?? createResponseWorkspace(workspaceRoot));
  const sessions = (await readAllSessions(workspaceRoot))
    .filter((session) => session.chapterId === chapterId)
    .filter((session) => !ensureAuthorityAccess(session.id, session.authority, authority))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  return {
    chapter_id: chapterId,
    total: sessions.length,
    sessions,
  };
}
