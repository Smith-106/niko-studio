/**
 * Graph module barrel exports
 *
 * Re-exports all public types, classes, and interfaces from:
 * - graph-engine: Core knowledge graph engine with SQLite backend
 * - graph-manager: Graph manager with Cypher parser and graph algorithms
 */

export {
  Entity as GraphEntity,
  Relation,
  type EnginePlugin,
  GraphEngine,
} from './graph-engine';

export {
  EntityType,
  RelationType,
  Entity,
  Relationship,
  EntityStats,
  GraphPath,
  SubGraph,
  CypherParser,
  GraphManager,
} from './graph-manager';
