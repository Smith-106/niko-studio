export {
  PROJECT_WORKSPACE_MIGRATION_NOTES,
  PROJECT_WORKSPACE_SCHEMA_VERSION,
  createDefaultProjectWorkspaceContext,
  normalizeProjectWorkspaceContext,
  projectWorkspaceToLegacyChatContext,
  projectWorkspaceToMemoryScope,
  projectWorkspaceToNarrativeAuthority,
  projectWorkspaceToWorkflowAuthority,
  summarizeProjectWorkspaceContext,
} from './workspace-model.js';

export {
  PROJECT_NARRATIVE_AUTHORITY_CONTRACT,
  PROJECT_NARRATIVE_SCHEMA_VERSION,
  createProjectNarrativeEventRecord,
  createProjectNarrativeProjectionBoundary,
  createProjectNarrativeRecordAuthority,
  createProjectNarrativeRecordId,
  createProjectNarrativeSceneRecord,
  createProjectNarrativeTimelineRecord,
  normalizeProjectNarrativeRecordSetId,
} from './narrative-records.js';

export type {
  CreateProjectNarrativeAuthorityInput,
  CreateProjectNarrativeEventRecordInput,
  CreateProjectNarrativeSceneRecordInput,
  CreateProjectNarrativeTimelineRecordInput,
  ProjectNarrativeAuthorityContract,
  ProjectNarrativeEvidenceLink,
  ProjectNarrativeEvidenceSource,
  ProjectNarrativeEventRecord,
  ProjectNarrativeProjectionBoundary,
  ProjectNarrativeProjectionRefs,
  ProjectNarrativeRecord,
  ProjectNarrativeRecordAuthority,
  ProjectNarrativeRecordKind,
  ProjectNarrativeSceneRecord,
  ProjectNarrativeStoryPosition,
  ProjectNarrativeNarrativePosition,
  ProjectNarrativeTimelineEntry,
  ProjectNarrativeTimelineMode,
  ProjectNarrativeTimelineRecord,
} from './narrative-records.js';

export type {
  ProjectWorkspaceAuthority,
  ProjectWorkspaceChat,
  ProjectWorkspaceCompatibility,
  ProjectWorkspaceContext,
  ProjectWorkspaceIdentity,
  ProjectWorkspaceKnowledge,
  ProjectWorkspaceManuscript,
  ProjectWorkspaceNarrativeAuthority,
  ProjectWorkspaceStoryBible,
  ProjectWorkspaceWorkflowAuthority,
  ProjectWorkspaceWorkflow,
} from './workspace-model.js';

export {
  PROJECT_WIKI_AUTHORITY_CONTRACT,
  PROJECT_WIKI_INDEX_FILENAME,
  PROJECT_WIKI_LAYOUT,
  PROJECT_WIKI_LOG_FILENAME,
  PROJECT_WIKI_MARKDOWN_EXTENSION,
  PROJECT_WIKI_PAGES_DIR,
  PROJECT_WIKI_RAW_DIR,
  PROJECT_WIKI_ROOT_DIR,
  PROJECT_WIKI_SCHEMA_VERSION,
  createProjectWikiPageFrontmatter,
  createProjectWikiPageId,
  createProjectWikiPageIdentity,
  isProjectWikiManualPromotionContract,
  normalizeProjectWikiSlug,
  normalizeProjectWikiWorkspaceId,
  projectWikiPageFrontmatterToMarkdown,
  projectWikiSlugToFilePath,
} from './wiki-schema.js';

export type {
  CreateProjectWikiPageFrontmatterInput,
  CreateProjectWikiPageIdentityInput,
  ProjectWikiAuthorityContract,
  ProjectWikiCanonAuthority,
  ProjectWikiPageFrontmatter,
  ProjectWikiPageIdentity,
  ProjectWikiPageStatus,
  ProjectWikiProjectionAuthority,
  ProjectWikiProjectionKind,
  ProjectWikiPromotedFrom,
  ProjectWikiPromotionMode,
  ProjectWikiScopeAuthority,
} from './wiki-schema.js';

export {
  appendProjectWikiLog,
  ensureProjectWikiStore,
  readProjectWikiPage,
  resolveProjectWikiStore,
  writeProjectWikiPage,
  writeProjectWikiRawEvidence,
} from './wiki-store.js';

export type {
  ProjectWikiIndex,
  ProjectWikiIndexEntry,
  ProjectWikiStoreAvailable,
  ProjectWikiStorePaths,
  ProjectWikiStoreResolution,
  ProjectWikiStoreUnavailable,
  ProjectWikiUnavailableReason,
  WriteProjectWikiPageInput,
  WriteProjectWikiPageResult,
} from './wiki-store.js';

export { queryProjectWikiCanon } from './wiki-query.js';

export type {
  ProjectWikiQueryAuthorityMetadata,
  ProjectWikiQueryMatch,
  ProjectWikiQueryOptions,
  ProjectWikiQueryUnavailable,
  ProjectWikiQueryAvailable,
  ProjectWikiQueryResult,
} from './wiki-query.js';

export {
  createProjectWikiFactPacketBundle,
  createProjectWikiFactPacketBundleFromCanonMatches,
  createProjectWikiKnowledgeLayer,
} from './wiki-knowledge-layer.js';

export type {
  ProjectWikiFactPacket,
  ProjectWikiFactPacketBundle,
  ProjectWikiFactPacketSource,
  ProjectWikiKnowledgeEntity,
  ProjectWikiKnowledgeLayer,
  ProjectWikiKnowledgeMemory,
  ProjectWikiKnowledgeRelation,
  ProjectWikiKnowledgeSearchOptions,
} from './wiki-knowledge-layer.js';

export {
  createProjectWikiProjectionId,
  createProjectWikiProjectionRecord,
  projectWikiProjectionSnapshotPath,
  readProjectWikiProjectionSnapshot,
  writeProjectWikiProjectionSnapshot,
} from './wiki-projection.js';

export type {
  CreateProjectWikiProjectionRecordInput,
  ProjectWikiProjectionRecord,
  ProjectWikiProjectionSourcePage,
  WriteProjectWikiProjectionSnapshotResult,
} from './wiki-projection.js';

export {
  extractWikiLinks,
  buildWikiLinkGraph,
  wikiGraphSearch,
  searchWikiGraph,
} from './wiki-graph-search.js';

export type {
  WikiLinkGraph,
  WikiGraphSearchResult,
} from './wiki-graph-search.js';
