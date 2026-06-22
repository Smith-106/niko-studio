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
import { safeResolveWorkspaceRoot, tryResolveWorkspaceRoot } from '../input-validation.js';
import { normalizeProjectNarrativeRecordSetId } from '../../project/narrative-records.js';
import { createLogger } from '../../logger/index.js';
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

export interface ConsistencyCheckRequest {
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

export interface SeverityConflict {
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

function normalizeChapterMeta(
  chapterMetaRaw: Array<Record<string, unknown>>,
): {
  charMeta: CharChapterMeta[];
  timeMeta: TimeChapterMeta[];
  worldMeta: WorldChapterMeta[];
} {
  return {
    charMeta: chapterMetaRaw.map((m, i) => ({
      chapterNumber: (m.chapterNumber as number) ?? i + 1,
      title: (m.title as string) ?? `Chapter ${i + 1}`,
    })),
    timeMeta: chapterMetaRaw.map((m, i) => ({
      chapterNumber: (m.chapterNumber as number) ?? i + 1,
      title: (m.title as string) ?? `Chapter ${i + 1}`,
    })),
    worldMeta: chapterMetaRaw.map((m, i) => ({
      chapterNumber: (m.chapterNumber as number) ?? i + 1,
      title: (m.title as string) ?? `Chapter ${i + 1}`,
    })),
  };
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

export async function runConsistencyCheck(
  input: ConsistencyCheckRequest & Record<string, unknown>,
): Promise<ConsistencyCheckResult | { error: string }> {
  const wsResult = tryResolveWorkspaceRoot();
  if (!wsResult.ok) return { error: 'Invalid workspace configuration' };
  const workspace = normalizeProjectWorkspaceContext(input, {
    workspaceRoot: wsResult.value,
  });
  const chapters: string[] = Array.isArray(input.chapters) ? input.chapters : [];
  const chapterMetaRaw: Array<Record<string, unknown>> = Array.isArray(input.chapterMeta)
    ? input.chapterMeta
    : [];
  const { charMeta, timeMeta, worldMeta } = normalizeChapterMeta(chapterMetaRaw);

  const [characterReport, timelineReport, worldviewReport] = await Promise.all([
    new CrossChapterCharacterTracker().analyze(chapters, charMeta),
    new TimelineConsistencyChecker().analyze(chapters, timeMeta),
    runWorldviewCheck(chapters, worldMeta, input.worldRules),
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

  return {
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
}

/**
 * Cross-chapter consistency check endpoint.
 *
 * Accepts an array of chapter texts with metadata, runs all three
 * consistency checkers, and returns a combined report sorted by severity.
 */
export async function criticConsistencyEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as ConsistencyCheckRequest & Record<string, unknown>;
  const result = await runConsistencyCheck(body);
  return jsonResponse(result);
}

export async function consistencyCheckEndpoint(request: HttpRequest): Promise<HttpResponse> {
  const body = parseBody(request) as ConsistencyCheckRequest & Record<string, unknown>;

  // Rule A: if no explicit chapters provided, try workspace scan
  if (!Array.isArray(body.chapters) || body.chapters.length === 0) {
    const workspaceRoot = (body.workspace as Record<string, unknown> | undefined)?.identity
      ? String(((body.workspace as Record<string, unknown>).identity as Record<string, unknown>)?.workspaceRoot ?? '')
      : String(body.workspaceRoot ?? body.workspace_root ?? '');

    if (!workspaceRoot.trim()) {
      return jsonResponse(
        { error: 'No chapters provided and no workspace root specified for auto-scan' },
        400,
      );
    }

    const scanned = await buildConsistencyInputFromWorkspace(workspaceRoot.trim());
    if (!scanned) {
      return jsonResponse(
        { error: 'No chapter files found in workspace', workspaceRoot },
        400,
      );
    }

    // Rule E: workspace scan provides complete replacement, not merge
    const merged = {
      ...body,
      chapters: scanned.chapters,
      chapterMeta: Array.isArray(body.chapterMeta) && body.chapterMeta.length > 0
        ? body.chapterMeta  // Rule B: explicit chapterMeta wins
        : scanned.chapterMeta,
      worldRules: Array.isArray(body.worldRules) && body.worldRules.length > 0
        ? body.worldRules  // Rule C: explicit worldRules wins
        : scanned.worldRules,
    };

    const result = await runConsistencyCheck(merged);
    return jsonResponse(result);
  }

  const result = await runConsistencyCheck(body);
  return jsonResponse(result);
}

export function formatConsistencyCheckText(result: ConsistencyCheckResult): string {
  const lines = [
    `Consistency Run: ${result.runId}`,
    `Workspace: ${result.workspace.identity.workspaceId}`,
    `Project: ${result.workspace.identity.projectId}`,
    `Analyzed At: ${result.analyzedAt}`,
    `Overall Score: ${result.combined.overallScore}`,
    `Conflicts: ${result.combined.totalConflicts} total (${result.combined.criticalCount} critical, ${result.combined.majorCount} major, ${result.combined.minorCount} minor, ${result.combined.infoCount} info)`,
    `Summary: ${result.combined.summary}`,
  ];

  if (result.combined.conflicts.length > 0) {
    lines.push('', 'Conflict Details:');
    for (const conflict of result.combined.conflicts) {
      const chapterLabel = conflict.chaptersInvolved.length > 0
        ? ` [chapters: ${conflict.chaptersInvolved.join(', ')}]`
        : '';
      lines.push(
        `- ${conflict.severity.toUpperCase()} | ${conflict.source} | ${conflict.type}${chapterLabel}`,
        `  ${conflict.description}`,
      );
      if (conflict.suggestion) {
        lines.push(`  Suggestion: ${conflict.suggestion}`);
      }
    }
  }

  return `${lines.join('\n')}\n`;
}

export interface ConsistencyCheckCliOptions {
  chaptersFile?: string | null;
  output?: string | null;
  format?: 'json' | 'text';
  workspaceRoot?: string | null;
  workspaceId?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  draftId?: string | null;
  chapterTitle?: string | null;
  chapterNumber?: number | null;
}

export async function runConsistencyCheckCli(
  options: ConsistencyCheckCliOptions,
): Promise<ConsistencyCheckResult | { error: string }> {
  const workspaceRoot = options.workspaceRoot?.trim() || process.cwd();

  let payload: ConsistencyCheckRequest & Record<string, unknown>;

  if (options.chaptersFile) {
    // Explicit input file: Rule A — payload takes precedence
    const { readFileSync } = await import('node:fs');
    const raw = readFileSync(options.chaptersFile, 'utf8');
    payload = JSON.parse(raw) as ConsistencyCheckRequest & Record<string, unknown>;
  } else {
    // No explicit input: try workspace scan (Rule A fallback)
    const scanned = await buildConsistencyInputFromWorkspace(workspaceRoot);
    if (scanned) {
      payload = scanned as ConsistencyCheckRequest & Record<string, unknown>;
    } else {
      // Final fallback: read from stdin
      const { readFileSync } = await import('node:fs');
      const raw = readFileSync(0, 'utf8');
      payload = JSON.parse(raw) as ConsistencyCheckRequest & Record<string, unknown>;
    }
  }

  const chapterCount = Array.isArray(payload.chapters) ? payload.chapters.length : 0;
  const workspace = normalizeProjectWorkspaceContext({
    workspace: {
      identity: {
        workspaceRoot,
        workspaceId: options.workspaceId,
        projectId: options.projectId,
        projectName: options.projectName,
      },
      storyBible: {
        draftId: options.draftId,
        storage: options.draftId ? 'local-draft' : 'workspace',
      },
      manuscript: {
        chapterTitle: options.chapterTitle,
        chapterNumber: options.chapterNumber,
      },
    },
  }, {
    workspaceRoot,
    fallbackProjectId: options.projectId ?? undefined,
  });

  const result = await runConsistencyCheck({
    ...payload,
    workspace: workspace as unknown as Record<string, unknown>,
    chapterMeta: Array.isArray(payload.chapterMeta)
      ? payload.chapterMeta
      : Array.from({ length: chapterCount }, (_, index) => ({
        chapterNumber: index + 1,
        title: index === 0 && options.chapterTitle?.trim()
          ? options.chapterTitle.trim()
          : `Chapter ${index + 1}`,
      })),
  });

  if (options.output?.trim()) {
    const { writeFile } = await import('node:fs/promises');
    const content = options.format === 'text'
      ? ('error' in result ? result.error : formatConsistencyCheckText(result))
      : `${JSON.stringify(result, null, 2)}\n`;
    await writeFile(options.output, content, 'utf8');
  }

  return result;
}

export async function mainConsistencyCheckCli(argv: string[] = process.argv.slice(2)): Promise<void> {
  const options: ConsistencyCheckCliOptions = {
    format: 'json',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if ((arg === '--input' || arg === '--chapters-file') && next) {
      options.chaptersFile = next;
      i += 1;
      continue;
    }
    if (arg === '--output' && next) {
      options.output = next;
      i += 1;
      continue;
    }
    if (arg === '--workspace' && next) {
      options.workspaceRoot = next;
      i += 1;
      continue;
    }
    if (arg === '--workspace-id' && next) {
      options.workspaceId = next;
      i += 1;
      continue;
    }
    if (arg === '--project-id' && next) {
      options.projectId = next;
      i += 1;
      continue;
    }
    if (arg === '--project-name' && next) {
      options.projectName = next;
      i += 1;
      continue;
    }
    if (arg === '--draft-id' && next) {
      options.draftId = next;
      i += 1;
      continue;
    }
    if (arg === '--chapter-title' && next) {
      options.chapterTitle = next;
      i += 1;
      continue;
    }
    if (arg === '--chapter-number' && next) {
      const parsed = Number(next);
      if (Number.isFinite(parsed)) {
        options.chapterNumber = parsed;
      }
      i += 1;
      continue;
    }
    if (arg === '--format' && next && (next === 'json' || next === 'text')) {
      options.format = next;
      i += 1;
    }
  }

  const result = await runConsistencyCheckCli(options);
  const output = options.format === 'text'
    ? ('error' in result ? result.error : formatConsistencyCheckText(result))
    : `${JSON.stringify(result, null, 2)}\n`;
  process.stdout.write(output);
}


// ============================================================
// Workspace scanner (Rules A–E from Stage 4.1)
// ============================================================

const log = createLogger('consistency');

const CHAPTER_EXTENSIONS = new Set(['.md', '.txt']);
const CHAPTER_DIR_NAMES = ['manuscript', 'chapters', 'drafts'];

/**
 * Scan a workspace directory for chapter files and build a ConsistencyCheckRequest.
 *
 * Implements Rules A–E:
 * - Scans CHAPTER_DIR_NAMES subdirectories, falls back to workspace root
 * - Sorts by filename (expected to contain chapter numbers)
 * - Derives chapterMeta from filenames
 * - worldRules defaults to empty (Rule C fallback)
 */
export async function buildConsistencyInputFromWorkspace(
  workspaceRoot: string,
): Promise<ConsistencyCheckRequest | null> {
  const { existsSync, readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join, extname, basename } = await import('node:path');

  if (!existsSync(workspaceRoot) || !statSync(workspaceRoot).isDirectory()) {
    log.warn('Workspace root does not exist or is not a directory', { workspaceRoot });
    return null;
  }

  // Find the chapter directory
  let chapterDir = workspaceRoot;
  for (const dirName of CHAPTER_DIR_NAMES) {
    const candidate = join(workspaceRoot, dirName);
    if (existsSync(candidate) && statSync(candidate).isDirectory()) {
      chapterDir = candidate;
      break;
    }
  }

  // Discover chapter files
  const entries = readdirSync(chapterDir)
    .filter((name) => {
      const ext = extname(name).toLowerCase();
      if (!CHAPTER_EXTENSIONS.has(ext)) return false;
      const fullPath = join(chapterDir, name);
      return statSync(fullPath).isFile();
    })
    .sort();

  if (entries.length === 0) {
    log.info('No chapter files found in workspace', { chapterDir });
    return null;
  }

  const chapters: string[] = [];
  const chapterMeta: ConsistencyCheckRequest['chapterMeta'] = [];

  for (let i = 0; i < entries.length; i++) {
    const fileName = entries[i];
    const content = readFileSync(join(chapterDir, fileName), 'utf8');
    chapters.push(content);

    // Derive chapter number from filename if possible
    const stem = basename(fileName, extname(fileName));
    const numberMatch = stem.match(/(\d+)/);
    const chapterNumber = numberMatch ? parseInt(numberMatch[1], 10) : i + 1;
    const title = stem.replace(/^\d+[\s._-]*/, '').trim() || `Chapter ${chapterNumber}`;

    chapterMeta.push({ chapterNumber, title });
  }

  log.info('Workspace scan completed', { chapterDir, chapterCount: chapters.length });

  return { chapters, chapterMeta, worldRules: [] };
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
