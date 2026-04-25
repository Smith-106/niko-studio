/**
 * Critic REST Endpoints
 *
 * Critic-related HTTP endpoints for content evaluation.
 * Ported from src/mcp/endpoints/critic.py
 */

import type { HttpRequest, HttpResponse } from '../http-types';
import { jsonResponse, parseBody } from '../http-types';
import { evaluateContent, getImprovementSuggestions } from '../services/critic';
import {
  normalizeProjectWorkspaceContext,
  projectWorkspaceToNarrativeAuthority,
} from '../../project/workspace-model.js';
import { normalizeProjectNarrativeRecordSetId } from '../../project/narrative-records.js';
import {
  CrossChapterCharacterTracker,
  type ChapterMeta as CharChapterMeta,
  type CrossChapterCharacterReport,
} from '../../narrative/cross-chapter-character-tracker.js';
import {
  TimelineConsistencyChecker,
  type ChapterMeta as TimeChapterMeta,
  type TimelineReport,
} from '../../narrative/timeline-consistency-checker.js';
import {
  WorldviewCoherenceValidator,
  type ChapterMeta as WorldChapterMeta,
  type WorldviewReport,
} from '../../narrative/worldview-coherence-validator.js';

export async function criticEvaluateEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const qualityGoals = (body.quality_goals ?? body.qualityGoals) as
    | Record<string, unknown>
    | undefined;

  const result = await evaluateContent(
    (body.content as string) ?? '',
    body.scene_card as Record<string, unknown> | undefined,
    body.dimensions as string[] | undefined,
    qualityGoals
  );

  return jsonResponse(result);
}

export async function criticSuggestionsEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as Record<string, unknown>;
  const result = await getImprovementSuggestions(
    (body.content as string) ?? '',
    body.issues as string[] | undefined,
    (body.max_suggestions as number) ?? 5
  );

  return jsonResponse(result);
}

// ============================================================
// Cross-Chapter Consistency Check Endpoint
// ============================================================

interface ConsistencyCheckRequest {
  chapters: string[];
  chapterMeta: Array<{ chapterNumber: number; title: string }>;
  worldRules?: Array<{
    id: string;
    category: string;
    name: string;
    description: string;
    constraints: string[];
    establishedIn: number;
  }>;
  workspace?: Record<string, unknown>;
}

interface SeverityConflict {
  severity: string;
  type: string;
  source: 'character' | 'timeline' | 'worldview';
  description: string;
  chaptersInvolved: number[];
  suggestion?: string;
}

function buildConsistencyRunId(workspaceId: string, analyzedAt: string): string {
  const compactTimestamp = analyzedAt.replace(/[-:.TZ]/g, '').slice(0, 14);
  return `consistency-${workspaceId}-${compactTimestamp}`;
}


export interface ConsistencyCheckResult {
  character: CrossChapterCharacterReport;
  timeline: TimelineReport;
  worldview: WorldviewReport;
  combined: {
    totalConflicts: number;
    criticalCount: number;
    majorCount: number;
    minorCount: number;
    infoCount: number;
    conflicts: SeverityConflict[];
    overallScore: number;
    summary: string;
  };
  analyzedAt: string;
  runId: string;
  workspace: ReturnType<typeof normalizeProjectWorkspaceContext>;
  narrativeAuthority: ReturnType<typeof projectWorkspaceToNarrativeAuthority>;
}

/**
 * Cross-chapter consistency check endpoint.
 *
 * Accepts an array of chapter texts with metadata, runs all three
 * consistency checkers, and returns a combined report sorted by severity.
 */
export async function criticConsistencyEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as ConsistencyCheckRequest & Record<string, unknown>;
  const workspace = normalizeProjectWorkspaceContext(body, {
    workspaceRoot: String(process.env['NIKO_WORKFLOW_WORKSPACE'] ?? '').trim() || process.cwd(),
  });
  const chapters: string[] = Array.isArray(body.chapters) ? body.chapters : [];
  const chapterMetaRaw: Array<Record<string, unknown>> = Array.isArray(body.chapterMeta)
    ? body.chapterMeta
    : [];

  // Normalize chapter metadata
  const charMeta: CharChapterMeta[] = chapterMetaRaw.map((m, i) => ({
    chapterNumber: (m.chapterNumber as number) ?? i + 1,
    title: (m.title as string) ?? `Chapter ${i + 1}`,
  }));
  const timeMeta: TimeChapterMeta[] = chapterMetaRaw.map((m, i) => ({
    chapterNumber: (m.chapterNumber as number) ?? i + 1,
    title: (m.title as string) ?? `Chapter ${i + 1}`,
  }));
  const worldMeta: WorldChapterMeta[] = chapterMetaRaw.map((m, i) => ({
    chapterNumber: (m.chapterNumber as number) ?? i + 1,
    title: (m.title as string) ?? `Chapter ${i + 1}`,
  }));

  const [characterReport, timelineReport, worldviewReport] = await Promise.all([
    new CrossChapterCharacterTracker().analyze(chapters, charMeta),
    new TimelineConsistencyChecker().analyze(chapters, timeMeta),
    runWorldviewCheck(chapters, worldMeta, body.worldRules),
  ]);

  const combinedConflicts = [
    ...characterReport.conflicts.map((c) => ({
      severity: c.severity,
      type: c.type,
      source: 'character' as const,
      description: c.description,
      chaptersInvolved: c.chaptersInvolved,
      suggestion: c.suggestion,
    })),
    ...timelineReport.conflicts.map((c) => ({
      severity: c.severity,
      type: c.type,
      source: 'timeline' as const,
      description: c.description,
      chaptersInvolved: c.chaptersInvolved,
      suggestion: c.suggestedFix,
    })),
    ...worldviewReport.conflicts.map((c) => ({
      severity: c.severity,
      type: c.type,
      source: 'worldview' as const,
      description: c.description,
      chaptersInvolved: c.chaptersInvolved,
      suggestion: c.suggestion,
    })),
  ].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));

  const criticalCount = combinedConflicts.filter((c) => c.severity === 'critical').length;
  const majorCount = combinedConflicts.filter((c) => c.severity === 'major').length;
  const minorCount = combinedConflicts.filter((c) => c.severity === 'minor').length;
  const infoCount = combinedConflicts.filter((c) => c.severity === 'info').length;
  const analyzedAt = new Date().toISOString();
  const runId = buildConsistencyRunId(workspace.identity.workspaceId, analyzedAt);
  const recordSetId = normalizeProjectNarrativeRecordSetId(
    workspace.authority.recordSetId,
    workspace.identity.workspaceId,
  );
  const nextWorkspace = normalizeProjectWorkspaceContext({
    ...workspace,
    authority: {
      ...workspace.authority,
      recordSetId,
      consistencyRunId: runId,
    },
  }, {
    workspaceRoot: workspace.identity.workspaceRoot,
    fallbackProjectId: workspace.identity.projectId,
  });

  const result: ConsistencyCheckResult = {
    character: characterReport,
    timeline: timelineReport,
    worldview: worldviewReport,
    combined: {
      totalConflicts: combinedConflicts.length,
      criticalCount,
      majorCount,
      minorCount,
      infoCount,
      conflicts: combinedConflicts,
      overallScore: Math.round(
        ((characterReport.coherenceScore + timelineReport.consistencyScore + worldviewReport.coherenceScore) / 3) * 10,
      ) / 10,
      summary: [
        characterReport.summary,
        timelineReport.summary,
        worldviewReport.summary,
      ].join(' '),
    },
    analyzedAt,
    runId,
    workspace: nextWorkspace,
    narrativeAuthority: projectWorkspaceToNarrativeAuthority(nextWorkspace),
  };

  return jsonResponse(result);
}

// ============================================================
// Internal helpers
// ============================================================

async function runWorldviewCheck(
  chapters: string[],
  meta: WorldChapterMeta[],
  worldRules?: ConsistencyCheckRequest['worldRules'],
): Promise<WorldviewReport> {
  const validator = new WorldviewCoherenceValidator();

  if (Array.isArray(worldRules) && worldRules.length > 0) {
    for (const rule of worldRules) {
      validator.addRule({
        id: rule.id ?? `rule-${Date.now()}`,
        category: rule.category,
        name: rule.name,
        description: rule.description,
        constraints: rule.constraints ?? [],
        establishedIn: rule.establishedIn ?? 1,
      });
    }
  }

  return validator.analyze(chapters, meta);
}

function severityRank(s: string): number {
  switch (s) {
    case 'critical': return 0;
    case 'major': return 1;
    case 'minor': return 2;
    case 'info': return 3;
    default: return 4;
  }
}
