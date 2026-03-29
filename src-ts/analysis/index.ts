/**
 * Analysis Module - Narrative analysis and session clustering
 *
 * - narrative-pattern-detector: Pattern detection in knowledge graph entities
 * - writing-session-cluster: Multi-dimensional clustering of writing sessions
 */

export {
  NarrativePatternDetector,
  createNarrativePatternDetector,
  type NarrativeStoreProvider,
  type PatternCategory,
  type PatternOccurrence,
  type NarrativePattern,
  type PatternTemplate,
  type PatternDetectionConfig,
} from './narrative-pattern-detector'

export {
  WritingSessionCluster,
  createWritingSessionCluster,
  type SessionType,
  type WritingSession,
  type SessionCluster,
  type ClusterMember,
  type ClusterConfig,
} from './writing-session-cluster'
