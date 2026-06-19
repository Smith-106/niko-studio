/**
 * project-tech metadata freshness helpers.
 *
 * Migrated from src/workflow/project_tech.py
 *
 * Provides functions to refresh and check the freshness of
 * .workflow/project-tech.json metadata files.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================
// Constants
// ============================================================

export const PROJECT_TECH_RELATIVE_PATH = path.join('.workflow', 'project-tech.json');
export const DEFAULT_PROJECT_TECH_TTL_HOURS = 168;
export const PROJECT_TECH_SCHEMA_VERSION = '1.1.0';

const _LANGUAGE_EXTENSION_MAP: Record<string, Set<string>> = {
  Python: new Set(['.py']),
  TypeScript: new Set(['.ts', '.tsx']),
  Rust: new Set(['.rs']),
};

const _SKIP_DIR_NAMES: Set<string> = new Set([
  '.git', '.venv', 'node_modules', '__pycache__',
  '.pytest_cache', '.mypy_cache', '.ruff_cache',
]);

// ============================================================
// Internal helpers
// ============================================================

function _resolveWorkspacePath(workspace: string): string {
  return path.resolve(workspace);
}

function _projectTechPath(workspace: string): string {
  return path.join(_resolveWorkspacePath(workspace), PROJECT_TECH_RELATIVE_PATH);
}

function _utcNowIso(): string {
  return new Date().toISOString();
}

function _parseIsoDatetime(raw: string): Date {
  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) {
    throw new Error(`invalid datetime: ${raw}`);
  }
  return parsed;
}

function _isSkipPath(filePath: string): boolean {
  const parts = filePath.split(path.sep);
  return parts.some(part => _SKIP_DIR_NAMES.has(part));
}

function _collectLanguageFileCounts(workspacePath: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const lang of Object.keys(_LANGUAGE_EXTENSION_MAP)) {
    counts[lang] = 0;
  }

  const extensionToLanguage = new Map<string, string>();
  for (const [language, extensions] of Object.entries(_LANGUAGE_EXTENSION_MAP)) {
    for (const ext of extensions) {
      extensionToLanguage.set(ext, language);
    }
  }

  function walkDir(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (_isSkipPath(fullPath)) continue;
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        const language = extensionToLanguage.get(ext);
        if (language) {
          counts[language]++;
        }
      }
    }
  }

  walkDir(workspacePath);
  return counts;
}

function _loadProjectTechPayload(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`project-tech file not found: ${filePath}`);
  }

  let raw: string;
  try {
    raw = fs.readFileSync(filePath, { encoding: 'utf-8' });
  } catch {
    throw new Error(`project-tech file cannot be read: ${filePath}`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error(`project-tech JSON is invalid: ${filePath}`);
  }

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new Error('project-tech root payload must be a JSON object');
  }
  return payload as Record<string, unknown>;
}

// ============================================================
// Public API
// ============================================================

export interface RefreshResult {
  path: string;
  freshness: Record<string, unknown>;
  language_file_counts: Record<string, number>;
}

/**
 * Refresh project-tech metadata: update freshness timestamps,
 * language file counts, and write back to disk.
 */
export function refreshProjectTechMetadata(
  workspace: string,
  options: {
    source: string;
    ttlHours?: number;
  },
): RefreshResult {
  const workspacePath = _resolveWorkspacePath(workspace);
  const projectTechPath = _projectTechPath(workspacePath);

  const ttlHours = options?.ttlHours ?? DEFAULT_PROJECT_TECH_TTL_HOURS;
  if (ttlHours <= 0) {
    throw new Error('ttl_hours must be a positive integer');
  }

  const payload = _loadProjectTechPayload(projectTechPath);
  const generatedAt = _utcNowIso();
  const normalizedSource = (options.source ?? '').trim() || 'manual';

  const freshness: Record<string, unknown> = {
    generated_at: generatedAt,
    source: normalizedSource,
    schema_version: PROJECT_TECH_SCHEMA_VERSION,
    ttl_hours: ttlHours,
  };

  const languageCounts = _collectLanguageFileCounts(workspacePath);
  const techStack = (payload.overview as Record<string, unknown>)?.technology_stack as Record<string, unknown> | undefined;
  const languages = techStack?.languages;
  if (Array.isArray(languages)) {
    for (const languageEntry of languages) {
      if (typeof languageEntry !== 'object' || languageEntry === null) continue;
      const entry = languageEntry as Record<string, unknown>;
      const languageName = String(entry.name ?? '');
      if (languageName in languageCounts) {
        entry.file_count = languageCounts[languageName];
      }
    }
  }

  payload.freshness = freshness;

  let metadata = payload._metadata;
  if (typeof metadata !== 'object' || metadata === null) {
    metadata = {};
    payload._metadata = metadata;
  }
  const meta = metadata as Record<string, unknown>;
  meta.analysis_timestamp = generatedAt;
  meta.analysis_mode = `refresh:${normalizedSource}`;
  if (meta.initialized_by === undefined) meta.initialized_by = 'workflow:init-fallback';
  if (meta.version === undefined) meta.version = '1.0.0';

  const statistics = payload.statistics;
  if (typeof statistics === 'object' && statistics !== null) {
    (statistics as Record<string, unknown>).last_updated = generatedAt;
  }

  const dir = path.dirname(projectTechPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    projectTechPath,
    JSON.stringify(payload, null, 2) + '\n',
    { encoding: 'utf-8' },
  );

  return {
    path: projectTechPath,
    freshness,
    language_file_counts: languageCounts,
  };
}

export interface FreshnessCheckResult {
  status: string;
  ok: boolean;
  blocking: boolean;
  path: string;
  message: string;
  generated_at?: string;
  source?: string;
  schema_version?: string;
  ttl_hours?: number;
  age_hours?: number;
}

/**
 * Check the freshness of project-tech metadata.
 */
export function checkProjectTechFreshness(
  workspace: string,
  options?: {
    now?: Date;
    strict?: boolean;
  },
): FreshnessCheckResult {
  const projectTechPath = _projectTechPath(workspace);
  const strict = options?.strict ?? false;

  if (!fs.existsSync(projectTechPath)) {
    return {
      status: 'missing',
      ok: true,
      blocking: false,
      path: projectTechPath,
      message: 'project-tech metadata file is missing; skip freshness gate',
    };
  }

  let payload: Record<string, unknown>;
  try {
    payload = _loadProjectTechPayload(projectTechPath);
  } catch (exc) {
    const msg = exc instanceof Error ? exc.message : String(exc);
    return {
      status: 'invalid',
      ok: !strict,
      blocking: strict,
      path: projectTechPath,
      message: msg,
    };
  }

  const freshnessPayload = (typeof payload.freshness === 'object' && payload.freshness !== null)
    ? payload.freshness as Record<string, unknown>
    : {};
  const metadataPayload = (typeof payload._metadata === 'object' && payload._metadata !== null)
    ? payload._metadata as Record<string, unknown>
    : {};

  const generatedAt = String(
    freshnessPayload.generated_at
    ?? metadataPayload.analysis_timestamp
    ?? '',
  ).trim();
  const source = String(
    freshnessPayload.source
    ?? metadataPayload.analysis_mode
    ?? 'unknown',
  ).trim();
  const schemaVersion = String(
    freshnessPayload.schema_version
    ?? metadataPayload.version
    ?? 'legacy',
  ).trim();

  let ttlHours: number;
  const ttlRaw = freshnessPayload.ttl_hours ?? DEFAULT_PROJECT_TECH_TTL_HOURS;
  ttlHours = typeof ttlRaw === 'number' ? ttlRaw : parseInt(String(ttlRaw), 10);
  if (isNaN(ttlHours) || ttlHours <= 0) {
    ttlHours = DEFAULT_PROJECT_TECH_TTL_HOURS;
  }

  if (!generatedAt) {
    return {
      status: 'invalid',
      ok: !strict,
      blocking: strict,
      path: projectTechPath,
      source,
      schema_version: schemaVersion,
      ttl_hours: ttlHours,
      message: 'project-tech freshness.generated_at is missing',
    };
  }

  let generatedAtDt: Date;
  try {
    generatedAtDt = _parseIsoDatetime(generatedAt);
  } catch {
    return {
      status: 'invalid',
      ok: !strict,
      blocking: strict,
      path: projectTechPath,
      generated_at: generatedAt,
      source,
      schema_version: schemaVersion,
      ttl_hours: ttlHours,
      message: `project-tech freshness.generated_at is invalid: ${generatedAt}`,
    };
  }

  const current = options?.now ?? new Date();
  const ageMs = current.getTime() - generatedAtDt.getTime();
  const ageHours = Math.max(ageMs / 3600000.0, 0.0);
  const stale = ageHours > ttlHours;
  const blocking = strict && stale;

  const message = stale
    ? `project-tech metadata is stale (age_hours=${ageHours.toFixed(2)}, ttl_hours=${ttlHours})`
    : `project-tech metadata is fresh (age_hours=${ageHours.toFixed(2)}, ttl_hours=${ttlHours})`;

  return {
    status: stale ? 'stale' : 'fresh',
    ok: !blocking,
    blocking,
    path: projectTechPath,
    generated_at: generatedAtDt.toISOString(),
    source: source || 'unknown',
    schema_version: schemaVersion || 'legacy',
    ttl_hours: ttlHours,
    age_hours: Math.round(ageHours * 100) / 100,
    message,
  };
}
