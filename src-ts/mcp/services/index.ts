/**
 * MCP Services - barrel exports
 */

export {
  agentRoute,
  agentWrite,
  agentRevise,
  agentGetContext,
  type AgentRouteResult,
  type AgentWriteParams,
  type AgentWriteResult,
  type AgentReviseParams,
  type AgentReviseResult,
  type AgentGetContextResult,
} from './agent';

export {
  evaluateContent,
  getImprovementSuggestions,
  compareVersions,
  NOVEL_PASS_SCORE,
  NOVEL_HUMAN_REVIEW_SCORE,
  type EvaluateContentResult,
} from './critic';

export {
  graphQuery,
  graphGetCharacter,
  graphGetRelationships,
  graphGetForeshadows,
  graphAddEntity,
  graphAddRelation,
} from './graph';

export {
  memoryAdd,
  memorySearch,
  memoryGetTemporal,
  memoryGetConflicts,
  memoryResolveConflict,
  type MemoryAddParams,
  type MemorySearchParams,
} from './memory';

export {
  searchHybrid,
  searchIterative,
  searchContext,
} from './search';

export {
  skillsList,
  skillsMatch,
  skillsLoad,
  skillsGetChain,
  type SkillRecommendation,
} from './skills';

export {
  workflowRoute,
  workflowPlan,
  workflowExecute,
  workflowQuickRollback,
  workflowLifecycle,
  checkpointCreate,
  checkpointRestore,
  checkpointList,
} from './workflow';

export {
  listProjectWikiCanonPages,
  promoteProjectWikiCanon,
  readProjectWikiCanonPage,
  type ListProjectWikiCanonPagesParams,
  type ListProjectWikiCanonPagesResult,
  type ProjectWikiCanonPageRecord,
  type ProjectWikiCanonPageSummary,
  type PromoteProjectWikiCanonParams,
  type PromoteProjectWikiCanonResult,
  type ReadProjectWikiCanonPageParams,
  type ReadProjectWikiCanonPageResult,
} from './wiki';
