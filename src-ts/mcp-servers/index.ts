/**
 * MCP Servers module - Standalone MCP Server implementations
 *
 * Migrated from src/mcp_servers/.
 *
 * memory-mcp   -- Knowledge graph with JSON-file persistence
 * sequential-thinking-mcp -- Multi-session reasoning engine
 */

// ---------- Memory MCP Server ----------

export {
  KnowledgeGraphStore,
  createEntities,
  openNodes,
  addObservations,
  deleteEntities,
  createRelations,
  deleteRelations,
  searchNodes,
  readGraph,
  getEntityGraph,
} from "./memory-mcp";

export type {
  Entity as MemoryEntity,
  Relation as MemoryRelation,
  GraphStats,
  SearchEntityResult,
} from "./memory-mcp";

// ---------- Sequential Thinking MCP Server ----------

export {
  SequentialThinking,
  ThoughtType,
  ThoughtStatus,
  thoughtDataToDict,
  think,
  branch,
  switchBranch,
  revise,
  backtrack,
  conclude,
  getChain,
  getState,
  getConclusions,
  getBestBranch,
  exportMarkdown,
  reset,
  listSessions,
  deleteSession,
} from "./sequential-thinking-mcp";

export type {
  ThoughtData,
  Branch,
} from "./sequential-thinking-mcp";
