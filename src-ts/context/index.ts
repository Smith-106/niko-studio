/**
 * Context module - Context aggregation for skill execution
 *
 * Provides context providers (Memory, Skill, Project) and a
 * ContextAggregator that assembles and prioritises context items
 * within a configurable token budget.
 */

export {
  ContextPriority,
  ContextItem,
  IContextProvider,
  BaseContextProvider,
  MemoryContextProvider,
  SkillContextProvider,
  ProjectContextProvider,
  ContextAggregator,
} from './providers';
