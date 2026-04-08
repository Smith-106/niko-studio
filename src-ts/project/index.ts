export {
  PROJECT_WORKSPACE_MIGRATION_NOTES,
  PROJECT_WORKSPACE_SCHEMA_VERSION,
  createDefaultProjectWorkspaceContext,
  normalizeProjectWorkspaceContext,
  projectWorkspaceToLegacyChatContext,
  projectWorkspaceToMemoryScope,
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
  ProjectWorkspaceWorkflow,
} from './workspace-model.js';
