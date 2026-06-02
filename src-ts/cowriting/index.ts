/**
 * Co-Writing Engine module barrel export
 *
 * Re-exports all public types, classes, and functions from the cowriting module.
 */

// Context Scraper
export { ContextScraper, createContextScraper, estimateTokens } from './ContextScraper';
export type {
  ScrapedContext,
  StoryBibleInput,
  SessionInput,
  ChapterInput,
  ContextScraperConfig,
} from './ContextScraper';

// Model Router
export { ModelRouter, createModelRouter } from './ModelRouter';
export type {
  ModelConfig,
  ModelRouterConfig,
  RoutingDecision,
} from './ModelRouter';

// Prompt Assembler
export { PromptAssembler, createPromptAssembler } from './PromptAssembler';
export type {
  AssembledPrompt,
  CowritingMode,
  PromptAssemblerInput,
} from './PromptAssembler';

// Output Aggregator
export { OutputAggregator, createOutputAggregator } from './OutputAggregator';
export type {
  GuidedOption,
  AggregatedOutput,
} from './OutputAggregator';

// Context Summarizer
export { ContextSummarizer, createContextSummarizer, createDefaultContextSummarizer } from './ContextSummarizer';
export type {
  SummarizationRequest,
  SummarizationResult,
} from './ContextSummarizer';

// Auto Mode
export { AutoMode, createAutoMode } from './AutoMode';
export type {
  AutoModeInput,
  CowritingResult,
} from './AutoMode';

// Output Metadata
export { tagOutput, formatMetadataBadge, isHighConfidence } from './OutputMetadata';
export type { GenerationMetadata } from './OutputMetadata';

// Guided Mode
export { GuidedMode, createGuidedMode } from './GuidedMode';
export type {
  GuidedModeInput,
  GuidedCowritingResult,
} from './GuidedMode';

// QC Integration
export { QCIntegration, createQCIntegration } from './QCIntegration';
export type { QCIntegratedResult } from './QCIntegration';

// Co-Writing MCP Endpoints
export {
  cwGenerateAutoEndpoint,
  cwGenerateGuidedEndpoint,
  cwGetModesEndpoint,
  cwGetCreativityPresetsEndpoint,
  resetModeInstances,
} from './mcp/cowriting-endpoints';
export type {
  GenerateAutoRequest,
  GenerateGuidedRequest,
} from './mcp/cowriting-endpoints';
