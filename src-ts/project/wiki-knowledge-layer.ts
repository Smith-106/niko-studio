import type { ProjectWorkspaceContext } from './workspace-model.js';
import {
  queryProjectWikiCanon,
  type ProjectWikiQueryAuthorityMetadata,
  type ProjectWikiQueryMatch,
} from './wiki-query.js';
import {
  readProjectWikiProjectionSnapshot,
  type ProjectWikiProjectionRecord,
} from './wiki-projection.js';
import { resolveProjectWikiStore } from './wiki-store.js';

const DEFAULT_SEARCH_LIMIT = 5;
const ENTITY_TYPE_MAP: Readonly<Record<string, string>> = {
  artifact: 'artifact',
  artifacts: 'artifact',
  character: 'character',
  characters: 'character',
  draft: 'note',
  drafts: 'note',
  event: 'event',
  events: 'event',
  faction: 'faction',
  factions: 'faction',
  group: 'group',
  groups: 'group',
  item: 'artifact',
  items: 'artifact',
  location: 'location',
  locations: 'location',
  note: 'note',
  notes: 'note',
  organization: 'organization',
  organizations: 'organization',
  place: 'location',
  places: 'location',
  team: 'team',
  teams: 'team',
};

interface GraphNodeSummary {
  description: string;
  id: string;
  label: string;
  type: string;
}

interface GraphReferenceSummary {
  id: string;
  label: string | null;
}

interface GraphEdgeSummary {
  source: GraphReferenceSummary;
  target: GraphReferenceSummary;
  type: string;
}

export interface ProjectWikiKnowledgeSearchOptions {
  limit?: number;
}

export interface ProjectWikiKnowledgeEntity {
  authority: ProjectWikiQueryAuthorityMetadata;
  description: string;
  filePath: string;
  id: string;
  name: string;
  origin: 'wiki-canon';
  pageId: string;
  score: number;
  slug: string;
  type: string;
}

export interface ProjectWikiKnowledgeRelation {
  canonAuthority: 'canon-page';
  id: string;
  origin: 'wiki-projection-graph';
  pageId: string;
  projectionAuthority: 'derived';
  projectionId: string;
  source: string;
  sourceId: string;
  target: string;
  targetId: string;
  type: string;
  workspaceId: string;
}

export interface ProjectWikiKnowledgeMemory {
  authority: ProjectWikiQueryAuthorityMetadata;
  content: string;
  id: string;
  origin: 'wiki-canon' | 'wiki-projection-memory';
  pageId: string;
  projectionAuthority?: 'derived';
  projectionId?: string;
  score?: number;
  title: string;
}

export interface ProjectWikiKnowledgeLayer {
  get_related_entities(entityId: string): Promise<ProjectWikiKnowledgeRelation[]>;
  search_entities(
    query: string,
    options?: ProjectWikiKnowledgeSearchOptions,
  ): Promise<ProjectWikiKnowledgeEntity[]>;
  search_memories(
    query: string,
    options?: ProjectWikiKnowledgeSearchOptions,
  ): Promise<ProjectWikiKnowledgeMemory[]>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function clampPositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.trunc(value));
}

function singularizeSegment(segment: string): string {
  if (segment.endsWith('ies') && segment.length > 3) {
    return `${segment.slice(0, -3)}y`;
  }
  if (segment.endsWith('s') && segment.length > 1) {
    return segment.slice(0, -1);
  }
  return segment;
}

function inferEntityType(slug: string): string {
  const [segment = 'page'] = slug.split('/');
  const normalizedSegment = readString(segment)?.toLowerCase() ?? 'page';
  return ENTITY_TYPE_MAP[normalizedSegment] ?? singularizeSegment(normalizedSegment);
}

function mapCanonMatchToEntity(match: ProjectWikiQueryMatch): ProjectWikiKnowledgeEntity {
  return {
    authority: match.authority,
    description: match.excerpt,
    filePath: match.filePath,
    id: match.pageId,
    name: match.title,
    origin: 'wiki-canon',
    pageId: match.pageId,
    score: match.score,
    slug: match.slug,
    type: inferEntityType(match.slug),
  };
}

function readGraphNode(value: unknown): GraphNodeSummary | null {
  const node = asRecord(value);
  if (!node) return null;

  const id = readString(node.id) ?? readString(node.entityId) ?? readString(node.nodeId);
  if (!id) return null;

  return {
    description: readString(node.description) ?? readString(node.summary) ?? '',
    id,
    label: readString(node.name) ?? readString(node.label) ?? readString(node.title) ?? id,
    type: readString(node.type) ?? 'entity',
  };
}

function readGraphReference(value: unknown): GraphReferenceSummary | null {
  const direct = readString(value);
  if (direct) {
    return { id: direct, label: null };
  }

  const reference = asRecord(value);
  if (!reference) return null;

  const id = readString(reference.id) ?? readString(reference.entityId) ?? readString(reference.nodeId);
  if (!id) return null;

  return {
    id,
    label: readString(reference.name) ?? readString(reference.label) ?? readString(reference.title),
  };
}

function readGraphEdge(value: unknown): GraphEdgeSummary | null {
  const edge = asRecord(value);
  if (!edge) return null;

  const source = readGraphReference(edge.source) ?? readGraphReference(edge.from) ?? readGraphReference(edge.sourceId);
  const target = readGraphReference(edge.target) ?? readGraphReference(edge.to) ?? readGraphReference(edge.targetId);
  const type = readString(edge.type)
    ?? readString(edge.relationship)
    ?? readString(edge.relation)
    ?? readString(edge.label)
    ?? 'related_to';

  if (!source || !target) return null;

  return { source, target, type };
}

function readGraphNodes(snapshot: unknown): GraphNodeSummary[] {
  const snapshotRecord = asRecord(snapshot);
  const nodes = snapshotRecord?.nodes;
  if (!Array.isArray(nodes)) return [];

  return nodes
    .map((node) => readGraphNode(node))
    .filter((node): node is GraphNodeSummary => node !== null);
}

function readGraphEdges(snapshot: unknown): GraphEdgeSummary[] {
  const snapshotRecord = asRecord(snapshot);
  const edges = snapshotRecord?.edges;
  if (!Array.isArray(edges)) return [];

  return edges
    .map((edge) => readGraphEdge(edge))
    .filter((edge): edge is GraphEdgeSummary => edge !== null);
}

function resolveGraphLabel(
  reference: GraphReferenceSummary,
  nodesById: Map<string, GraphNodeSummary>,
  projection: ProjectWikiProjectionRecord<unknown>,
): string {
  const node = nodesById.get(reference.id);
  if (node) return node.label;
  if (reference.label) return reference.label;
  if (reference.id === projection.sourcePage.id) return projection.sourcePage.title;
  return reference.id;
}

const MEMORY_TEXT_KEYS = ['content', 'summary', 'text', 'excerpt', 'note', 'memory'] as const;
const MEMORY_COLLECTION_KEYS = ['entries', 'memories', 'facts', 'items', 'snippets', 'highlights', 'contexts'] as const;

function collectProjectionMemoryTexts(value: unknown, depth: number = 0): string[] {
  if (depth > 4) return [];

  const direct = readString(value);
  if (direct) return [direct];

  if (Array.isArray(value)) {
    return [...new Set(value.flatMap((entry) => collectProjectionMemoryTexts(entry, depth + 1)))];
  }

  const record = asRecord(value);
  if (!record) return [];

  const directTexts = MEMORY_TEXT_KEYS
    .map((key) => readString(record[key]))
    .filter((text): text is string => text !== null);
  const nestedTexts = MEMORY_COLLECTION_KEYS.flatMap((key) =>
    collectProjectionMemoryTexts(record[key], depth + 1),
  );

  return [...new Set([...directTexts, ...nestedTexts])];
}

function createCanonMemory(match: ProjectWikiQueryMatch): ProjectWikiKnowledgeMemory {
  return {
    authority: match.authority,
    content: `${match.title}: ${match.excerpt}`,
    id: `canon:${match.pageId}`,
    origin: 'wiki-canon',
    pageId: match.pageId,
    score: match.score,
    title: match.title,
  };
}

async function readProjectionMemoriesForMatch(
  workspace: ProjectWorkspaceContext,
  match: ProjectWikiQueryMatch,
): Promise<ProjectWikiKnowledgeMemory[]> {
  const store = resolveProjectWikiStore(
    workspace.identity.workspaceRoot,
    workspace.identity.workspaceId,
  );
  if (!store.available) return [];

  const projection = await readProjectWikiProjectionSnapshot<unknown>(store, 'memory', match.pageId);
  if (!projection) return [];

  return collectProjectionMemoryTexts(projection.snapshot).map((content, index) => ({
    authority: match.authority,
    content,
    id: `${projection.projectionId}:${index}`,
    origin: 'wiki-projection-memory',
    pageId: match.pageId,
    projectionAuthority: projection.projectionAuthority,
    projectionId: projection.projectionId,
    title: match.title,
  }));
}

export function createProjectWikiKnowledgeLayer(
  workspace: ProjectWorkspaceContext,
): ProjectWikiKnowledgeLayer {
  return {
    async search_entities(
      query: string,
      options: ProjectWikiKnowledgeSearchOptions = {},
    ): Promise<ProjectWikiKnowledgeEntity[]> {
      if (!readString(query)) return [];

      const result = await queryProjectWikiCanon(workspace, query, {
        limit: clampPositiveInteger(options.limit, DEFAULT_SEARCH_LIMIT),
      });

      if (!result.available) return [];

      return result.matches.map((match) => mapCanonMatchToEntity(match));
    },

    async get_related_entities(entityId: string): Promise<ProjectWikiKnowledgeRelation[]> {
      const resolvedEntityId = readString(entityId);
      if (!resolvedEntityId) return [];

      const store = resolveProjectWikiStore(
        workspace.identity.workspaceRoot,
        workspace.identity.workspaceId,
      );
      if (!store.available) return [];

      const projection = await readProjectWikiProjectionSnapshot<unknown>(
        store,
        'graph',
        resolvedEntityId,
      );
      if (!projection) return [];

      const nodesById = new Map(
        readGraphNodes(projection.snapshot).map((node) => [node.id, node] as const),
      );

      return readGraphEdges(projection.snapshot).map((edge, index) => ({
        canonAuthority: projection.sourcePage.canonAuthority,
        id: `${projection.projectionId}:${index}`,
        origin: 'wiki-projection-graph',
        pageId: projection.sourcePage.id,
        projectionAuthority: projection.projectionAuthority,
        projectionId: projection.projectionId,
        source: resolveGraphLabel(edge.source, nodesById, projection),
        sourceId: edge.source.id,
        target: resolveGraphLabel(edge.target, nodesById, projection),
        targetId: edge.target.id,
        type: edge.type,
        workspaceId: projection.workspaceId,
      }));
    },

    async search_memories(
      query: string,
      options: ProjectWikiKnowledgeSearchOptions = {},
    ): Promise<ProjectWikiKnowledgeMemory[]> {
      if (!readString(query)) return [];

      const limit = clampPositiveInteger(options.limit, DEFAULT_SEARCH_LIMIT);
      const result = await queryProjectWikiCanon(workspace, query, { limit });
      if (!result.available) return [];

      const memories: ProjectWikiKnowledgeMemory[] = [];
      for (const match of result.matches) {
        if (memories.length >= limit) break;
        memories.push(createCanonMemory(match));
        if (memories.length >= limit) break;

        const projectionMemories = await readProjectionMemoriesForMatch(workspace, match);
        for (const memory of projectionMemories) {
          memories.push(memory);
          if (memories.length >= limit) break;
        }
      }

      return memories.slice(0, limit);
    },
  };
}
