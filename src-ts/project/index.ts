export {
  PROJECT_WORKSPACE_MIGRATION_NOTES,
  PROJECT_WORKSPACE_SCHEMA_VERSION,
  createDefaultProjectWorkspaceContext,
  normalizeProjectWorkspaceContext,
  projectWorkspaceToLegacyChatContext,
  projectWorkspaceToMemoryScope,
  projectWorkspaceToWorkflowAuthority,
  summarizeProjectWorkspaceContext,
} from './workspace-model.js';

export type {
  ProjectWorkspaceChat,
  ProjectWorkspaceCompatibility,
  ProjectWorkspaceContext,
  ProjectWorkspaceIdentity,
  ProjectWorkspaceKnowledge,
  ProjectWorkspaceManuscript,
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

export { createProjectWikiKnowledgeLayer } from './wiki-knowledge-layer.js';

export type {
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
