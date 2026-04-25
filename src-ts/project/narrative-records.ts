import { createHash } from 'node:crypto';

import {
  PROJECT_WIKI_AUTHORITY_CONTRACT,
  normalizeProjectWikiWorkspaceId,
  type ProjectWikiCanonAuthority,
  type ProjectWikiPageStatus,
  type ProjectWikiProjectionAuthority,
  type ProjectWikiPromotedFrom,
  type ProjectWikiPromotionMode,
  type ProjectWikiScopeAuthority,
} from './wiki-schema.js';

export const PROJECT_NARRATIVE_SCHEMA_VERSION = '2026-04-25';

export interface ProjectNarrativeAuthorityContract {
  scopeAuthority: ProjectWikiScopeAuthority;
  canonAuthority: ProjectWikiCanonAuthority;
  projectionAuthority: ProjectWikiProjectionAuthority;
  promotionMode: ProjectWikiPromotionMode;
  automaticCanonSync: false;
  automaticProjectionSync: false;
}

export const PROJECT_NARRATIVE_AUTHORITY_CONTRACT: ProjectNarrativeAuthorityContract = {
  scopeAuthority: PROJECT_WIKI_AUTHORITY_CONTRACT.scopeAuthority,
  canonAuthority: PROJECT_WIKI_AUTHORITY_CONTRACT.canonAuthority,
  projectionAuthority: PROJECT_WIKI_AUTHORITY_CONTRACT.projectionAuthority,
  promotionMode: PROJECT_WIKI_AUTHORITY_CONTRACT.promotionMode,
  automaticCanonSync: false,
  automaticProjectionSync: false,
};

export type ProjectNarrativeRecordKind = 'scene' | 'event' | 'timeline';
export type ProjectNarrativeTimelineMode = 'story' | 'narrative';
export type ProjectNarrativeEvidenceSource = 'wiki-canon' | 'graph-projection' | 'memory-fact' | 'draft-text';

export interface ProjectNarrativeRecordAuthority {
  workspaceId: string;
  recordSetId: string;
  sourcePageId: string | null;
  scopeAuthority: ProjectWikiScopeAuthority;
  canonAuthority: ProjectWikiCanonAuthority;
  projectionAuthority: ProjectWikiProjectionAuthority;
  promotionMode: ProjectWikiPromotionMode;
  status: ProjectWikiPageStatus;
  promotedFrom: ProjectWikiPromotedFrom;
}

export interface ProjectNarrativeEvidenceLink {
  id: string;
  source: ProjectNarrativeEvidenceSource;
  refId: string;
  label: string | null;
  excerpt: string | null;
}

export interface ProjectNarrativeProjectionRefs {
  graphEntityIds: string[];
  memoryEntryIds: string[];
  wikiPageIds: string[];
}

export interface ProjectNarrativeStoryPosition {
  order: number | null;
  label: string | null;
  anchorEventId: string | null;
}

export interface ProjectNarrativeNarrativePosition {
  chapterId: string | null;
  sceneOrder: number | null;
  label: string | null;
}

interface ProjectNarrativeRecordBase {
  schemaVersion: string;
  id: string;
  kind: ProjectNarrativeRecordKind;
  title: string;
  summary: string;
  authority: ProjectNarrativeRecordAuthority;
  tags: string[];
  relatedEntityIds: string[];
  evidence: ProjectNarrativeEvidenceLink[];
  projections: ProjectNarrativeProjectionRefs;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectNarrativeSceneRecord extends ProjectNarrativeRecordBase {
  kind: 'scene';
  chapterId: string | null;
  sceneOrder: number | null;
  locationId: string | null;
  eventIds: string[];
  storyTime: ProjectNarrativeStoryPosition;
  narrativeTime: ProjectNarrativeNarrativePosition;
}

export interface ProjectNarrativeEventRecord extends ProjectNarrativeRecordBase {
  kind: 'event';
  sceneId: string | null;
  locationId: string | null;
  participantIds: string[];
  causeEventIds: string[];
  consequenceEventIds: string[];
  storyTime: ProjectNarrativeStoryPosition;
  narrativeTime: ProjectNarrativeNarrativePosition;
}

export interface ProjectNarrativeTimelineEntry {
  order: number;
  recordId: string;
  recordKind: 'scene' | 'event';
  label: string | null;
}

export interface ProjectNarrativeTimelineRecord extends ProjectNarrativeRecordBase {
  kind: 'timeline';
  mode: ProjectNarrativeTimelineMode;
  anchorSceneId: string | null;
  anchorEventId: string | null;
  entries: ProjectNarrativeTimelineEntry[];
}

export type ProjectNarrativeRecord =
  | ProjectNarrativeSceneRecord
  | ProjectNarrativeEventRecord
  | ProjectNarrativeTimelineRecord;

export interface ProjectNarrativeProjectionBoundary {
  authority: ProjectNarrativeRecordAuthority;
  canonPageId: string | null;
  graphEntityIds: string[];
  memoryEntryIds: string[];
  wikiPageIds: string[];
}

export interface CreateProjectNarrativeAuthorityInput {
  workspaceId: string;
  recordSetId?: string | null;
  sourcePageId?: string | null;
  promotedFrom?: ProjectWikiPromotedFrom;
  status?: ProjectWikiPageStatus;
}

interface CreateProjectNarrativeRecordBaseInput {
  workspaceId: string;
  recordSetId?: string | null;
  sourcePageId?: string | null;
  promotedFrom?: ProjectWikiPromotedFrom;
  status?: ProjectWikiPageStatus;
  id?: string | null;
  idSeed?: string | null;
  title: string;
  summary?: string | null;
  tags?: string[] | null;
  relatedEntityIds?: string[] | null;
  evidence?: ProjectNarrativeEvidenceLink[] | null;
  projections?: Partial<ProjectNarrativeProjectionRefs> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CreateProjectNarrativeSceneRecordInput extends CreateProjectNarrativeRecordBaseInput {
  chapterId?: string | null;
  sceneOrder?: number | null;
  locationId?: string | null;
  eventIds?: string[] | null;
  storyTime?: Partial<ProjectNarrativeStoryPosition> | null;
  narrativeTime?: Partial<ProjectNarrativeNarrativePosition> | null;
}

export interface CreateProjectNarrativeEventRecordInput extends CreateProjectNarrativeRecordBaseInput {
  sceneId?: string | null;
  locationId?: string | null;
  participantIds?: string[] | null;
  causeEventIds?: string[] | null;
  consequenceEventIds?: string[] | null;
  storyTime?: Partial<ProjectNarrativeStoryPosition> | null;
  narrativeTime?: Partial<ProjectNarrativeNarrativePosition> | null;
}

export interface CreateProjectNarrativeTimelineRecordInput extends CreateProjectNarrativeRecordBaseInput {
  mode?: ProjectNarrativeTimelineMode;
  anchorSceneId?: string | null;
  anchorEventId?: string | null;
  entries?: ProjectNarrativeTimelineEntry[] | null;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => readString(entry)).filter((entry): entry is string => entry !== null))];
}

function readProjectWikiPageStatus(value: unknown): ProjectWikiPageStatus | null {
  return value === 'curated' || value === 'draft' ? value : null;
}

function readPromotedFrom(value: unknown): ProjectWikiPromotedFrom | null {
  return value === 'story-bible' || value === 'chat' || value === 'research' || value === 'manual'
    ? value
    : null;
}

function readTimelineMode(value: unknown): ProjectNarrativeTimelineMode | null {
  return value === 'story' || value === 'narrative' ? value : null;
}

function createDigestId(prefix: string, seed: string): string {
  const digest = createHash('sha1').update(seed.normalize('NFKC').trim().toLowerCase()).digest('hex').slice(0, 12);
  return `${prefix}_${digest}`;
}

function normalizeTimestamp(value: string | null | undefined): string {
  return readString(value) ?? new Date().toISOString();
}

function createDefaultStoryPosition(input: Partial<ProjectNarrativeStoryPosition> | null | undefined): ProjectNarrativeStoryPosition {
  return {
    order: readNumber(input?.order),
    label: readString(input?.label),
    anchorEventId: readString(input?.anchorEventId),
  };
}

function createDefaultNarrativePosition(
  input: Partial<ProjectNarrativeNarrativePosition> | null | undefined,
): ProjectNarrativeNarrativePosition {
  return {
    chapterId: readString(input?.chapterId),
    sceneOrder: readNumber(input?.sceneOrder),
    label: readString(input?.label),
  };
}

function createProjectionRefs(input: Partial<ProjectNarrativeProjectionRefs> | null | undefined): ProjectNarrativeProjectionRefs {
  return {
    graphEntityIds: readStringArray(input?.graphEntityIds),
    memoryEntryIds: readStringArray(input?.memoryEntryIds),
    wikiPageIds: readStringArray(input?.wikiPageIds),
  };
}

function createRecordBase(
  kind: ProjectNarrativeRecordKind,
  input: CreateProjectNarrativeRecordBaseInput,
): Omit<ProjectNarrativeRecordBase, 'kind'> {
  const title = readString(input.title) ?? `${kind}-record`;
  const createdAt = normalizeTimestamp(input.createdAt);
  return {
    schemaVersion: PROJECT_NARRATIVE_SCHEMA_VERSION,
    id: readString(input.id) ?? createProjectNarrativeRecordId(kind, readString(input.idSeed) ?? `${kind}:${title}`),
    title,
    summary: readString(input.summary) ?? '',
    authority: createProjectNarrativeRecordAuthority(input),
    tags: readStringArray(input.tags),
    relatedEntityIds: readStringArray(input.relatedEntityIds),
    evidence: input.evidence ?? [],
    projections: createProjectionRefs(input.projections),
    createdAt,
    updatedAt: normalizeTimestamp(input.updatedAt) ?? createdAt,
  };
}

export function normalizeProjectNarrativeRecordSetId(value: string | null | undefined, workspaceId?: string | null): string {
  const raw = readString(value) ?? readString(workspaceId) ?? 'workspace-records';
  return raw
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'workspace-records';
}

export function createProjectNarrativeRecordId(kind: ProjectNarrativeRecordKind, seed: string): string {
  return createDigestId(`nrr_${kind}`, readString(seed) ?? kind);
}

export function createProjectNarrativeRecordAuthority(
  input: CreateProjectNarrativeAuthorityInput,
): ProjectNarrativeRecordAuthority {
  const workspaceId = normalizeProjectWikiWorkspaceId(input.workspaceId);
  return {
    workspaceId,
    recordSetId: normalizeProjectNarrativeRecordSetId(input.recordSetId, workspaceId),
    sourcePageId: readString(input.sourcePageId),
    scopeAuthority: PROJECT_NARRATIVE_AUTHORITY_CONTRACT.scopeAuthority,
    canonAuthority: PROJECT_NARRATIVE_AUTHORITY_CONTRACT.canonAuthority,
    projectionAuthority: PROJECT_NARRATIVE_AUTHORITY_CONTRACT.projectionAuthority,
    promotionMode: PROJECT_NARRATIVE_AUTHORITY_CONTRACT.promotionMode,
    status: readProjectWikiPageStatus(input.status) ?? 'curated',
    promotedFrom: readPromotedFrom(input.promotedFrom) ?? 'manual',
  };
}

export function createProjectNarrativeSceneRecord(
  input: CreateProjectNarrativeSceneRecordInput,
): ProjectNarrativeSceneRecord {
  const base = createRecordBase('scene', input);
  return {
    ...base,
    kind: 'scene',
    chapterId: readString(input.chapterId),
    sceneOrder: readNumber(input.sceneOrder),
    locationId: readString(input.locationId),
    eventIds: readStringArray(input.eventIds),
    storyTime: createDefaultStoryPosition(input.storyTime),
    narrativeTime: createDefaultNarrativePosition(input.narrativeTime),
  };
}

export function createProjectNarrativeEventRecord(
  input: CreateProjectNarrativeEventRecordInput,
): ProjectNarrativeEventRecord {
  const base = createRecordBase('event', input);
  return {
    ...base,
    kind: 'event',
    sceneId: readString(input.sceneId),
    locationId: readString(input.locationId),
    participantIds: readStringArray(input.participantIds),
    causeEventIds: readStringArray(input.causeEventIds),
    consequenceEventIds: readStringArray(input.consequenceEventIds),
    storyTime: createDefaultStoryPosition(input.storyTime),
    narrativeTime: createDefaultNarrativePosition(input.narrativeTime),
  };
}

export function createProjectNarrativeTimelineRecord(
  input: CreateProjectNarrativeTimelineRecordInput,
): ProjectNarrativeTimelineRecord {
  const base = createRecordBase('timeline', input);
  return {
    ...base,
    kind: 'timeline',
    mode: readTimelineMode(input.mode) ?? 'story',
    anchorSceneId: readString(input.anchorSceneId),
    anchorEventId: readString(input.anchorEventId),
    entries: Array.isArray(input.entries)
      ? input.entries
        .map((entry) => ({
          order: readNumber(entry.order) ?? 0,
          recordId: readString(entry.recordId) ?? '',
          recordKind: entry.recordKind === 'scene' || entry.recordKind === 'event' ? entry.recordKind : 'event',
          label: readString(entry.label),
        }))
        .filter((entry) => Boolean(entry.recordId))
      : [],
  };
}

export function createProjectNarrativeProjectionBoundary(
  record: ProjectNarrativeRecord,
): ProjectNarrativeProjectionBoundary {
  return {
    authority: record.authority,
    canonPageId: record.authority.sourcePageId,
    graphEntityIds: [...record.projections.graphEntityIds],
    memoryEntryIds: [...record.projections.memoryEntryIds],
    wikiPageIds: [...new Set([
      ...(record.authority.sourcePageId ? [record.authority.sourcePageId] : []),
      ...record.projections.wikiPageIds,
    ])],
  };
}
