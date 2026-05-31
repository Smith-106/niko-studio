/**
 * Service Adapters
 *
 * Thin adapter classes that bridge the container interfaces (container/types.ts)
 * to the actual implementations.
 */

import type {
  IMemoryEngine,
  IGraphEngine,
  ISearchEngine,
  IWorkflowEngine,
  ICriticEngine,
  IAgentFactory,
  IBackupManager,
  ITokenService,
  IObsidianService,
  IMCPGateway,
  IAgent,
  SearchOptions,
  SearchResult,
  WorkflowContext,
  WorkflowResult,
  BackupOptions,
  BackupInfo,
  ExportOptions,
  SyncResult,
  IPhaseOrchestrator,
  IWebSocketRelayService,
  IDistillationNowledgeBridge,
  IDistillationService,
  IConflictNowledgeBridge,
  IFileSyncAdapter,
  IEventBus,
  IEventLog,
  IDeadLetterQueue,
  IMCPRequestRouter,
  INowledgeGraphSync,
  IObsidianKnowledgeSync,
  SyncDirectionResult,
  SyncConflict,
  ConflictStrategy,
  ILLMFallbackChain,
  IMCPServiceDiscovery,
  IMCPHealthMonitor,
  ISearchRelevanceScorer,
  ISearchCacheManager,
  ScoringConfig,
  ScoredResult,
  CacheConfig,
  IParallelResultAggregator,
  AggregationStrategy,
  AggregationConfig,
  AggregatedResult,
  IQualityGateFeedbackLoop,
  VerificationGap,
  FeedbackLoopConfig,
  IWaveExecutionEngine,
  WaveExecutionConfig,
  IGraphWikiLinkBridge,
  LinkIndexEntry,
  OrphanType,
  OrphanedLink,
  IntegrityReport,
} from './types';
import { AgentType } from './types';
import { stableStringify } from '../search/stableKey';
import { DEFAULT_STRATEGY_CONFIG, type ISearchStrategyConfig } from '../search/strategy-config';
import {
  UnifiedSearchPipeline,
  type IUnifiedSearchPipeline,
  type UnifiedPipelineDeps,
} from '../search/unified-pipeline';
import { createIntegrationAdapters, type IntegrationAdapterBundle } from '../integrations';
import { UnifiedMemoryEngine } from '../memory/unified-memory';
import { GraphEngine } from '../graph/graph-engine';
import { createIterativeRetriever, type IterativeRetriever } from '../search';
import { CriticEngine } from '../narrative/evaluators/critic-engine';
import { WorkflowEngine } from '../workflow/workflow-engine';
import type { IWorkflowEngineRuntime } from './workflow-runtime-provider';
import { AgentFactory } from '../agents/factory';
import type { AgentConstructor } from '../agents/factory';
import {
  AgentType as BaseAgentType,
  type IAgentLLMService,
} from '../agents/base';
import { createWriterInput } from '../agents/writer';
import { BackupManager } from '../services/backup-manager';
import { TokenService } from '../services/token-service';
import { ObsidianService } from '../services/obsidian-service';
import { NowledgeMemAdapter } from '../services/nowledge-mem-adapter';
import type { INowledgeMemService } from '../protocols/nowledge-mem';
import type { DocumentMetadata } from '../protocols/knowledge';
import type { IKnowledgeService } from './types';
import { PhaseOrchestrator } from '../workflow/team/phase-orchestrator';
import { createLogger } from '../logger/index.js';
import { WorkflowEventRelay } from '../mcp/gateway-ws';
import { DistillationNowledgeBridge } from '../services/distillation-nowledge-bridge';
import { ConflictNowledgeBridge } from '../services/conflict-nowledge-bridge';
import { NowledgeGraphSync } from '../services/nowledge-graph-sync';
import { ObsidianKnowledgeSyncImpl } from '../services/obsidian-knowledge-sync';
import { DistillationTemplate } from '../services/distill-service';
import { TypedEventBus } from '../services/event-bus';
import { EventLogImpl } from '../services/event-log';
import { DeadLetterQueueImpl } from '../services/dead-letter-queue';
import { LLMFallbackChainImpl } from '../services/llm-fallback-chain';
import type { ILLMFallbackChain as ILLMFallbackChainInterface, FallbackChainConfig } from '../services/llm-fallback-chain';
import {
  SearchRelevanceScorerImpl,
  DEFAULT_SCORING_CONFIG,
} from '../search/relevance-scorer';
import type { ScoringConfig as ScoringConfigImpl } from '../search/relevance-scorer';
import {
  SearchCacheManagerImpl,
  DEFAULT_CACHE_CONFIG,
} from '../search/cache-manager';
import type { CacheConfig as CacheConfigImpl, WarmupFn } from '../search/cache-manager';
import {
  TeamPhase,
  TEAM_TRANSITIONS,
  evaluatePhaseGate,
  type PhaseGateInput,
} from '../workflow/team/phase-gate-evaluator';
import {
  ArtifactResolver,
  STAGE_CONTRACTS,
  type StateArtifact,
} from '../workflow/artifact-contract';
import {
  MCPRequestRouter,
  type MCPRequest,
  type MCPRouteResult,
  type MCPProviderSpec,
} from '../gateway/mcp-router';
import {
  MCPServiceDiscoveryImpl,
  type DiscoveryConfig,
} from '../gateway/service-discovery';
import {
  MCPHealthMonitorImpl,
  type HealthMonitorConfig,
  type HealthProbeResult,
  type ProviderHealthState,
} from '../gateway/health-monitor';
import { ParallelResultAggregatorImpl } from '../workflow/delegate/result-aggregator.js';
import type { SubTaskResult, SubPlanSpec } from '../workflow/delegate/sub-plan.js';
import type { DelegateBroker } from '../workflow/delegate/delegate-broker.js';
import { QualityGateFeedbackLoopImpl } from '../workflow/quality-gate-loop.js';
import type { RemediationPlan, RemediationResult, FeedbackLoopResult } from '../workflow/quality-gate-loop.js';
import { WaveExecutionEngineImpl } from '../workflow/wave-engine.js';
import type { WaveSpec, WaveResult } from '../workflow/wave-engine.js';
import { GraphWikiLinkBridgeImpl } from '../services/graph-wiki-bridge.js';
import type { IGraphWikiLinkBridge as IGraphWikiLinkBridgeInterface } from '../services/graph-wiki-bridge.js';

const _log = createLogger('adapters');

// ---------------------------------------------------------------------------
// MemoryEngine Adapter
// ---------------------------------------------------------------------------

export class MemoryEngineAdapter implements IMemoryEngine {
  private engine: UnifiedMemoryEngine;

  constructor(integrationAdapters?: Pick<IntegrationAdapterBundle, 'flags' | 'storageShadow'>) {
    this.engine = new UnifiedMemoryEngine({
      dbPath: '.writing/memory.db',
      integrationAdapters,
    });
  }

  async initialize(): Promise<void> {
    await this.engine.initialize();
  }

  async store(key: string, value: unknown): Promise<void> {
    await this.engine.add({
      content: typeof value === 'string' ? value : JSON.stringify(value),
      entityId: key,
    });
  }

  async add(params: {
    content: string;
    layer?: string;
    dimension?: string | null;
    entityId?: string | null;
    validFrom?: string | null;
    validUntil?: string | null;
    importance?: number;
    tags?: string[];
    userId?: string | null;
    projectId?: string | null;
    sessionId?: string | null;
    source?: string;
    confidence?: number;
  }): Promise<Record<string, unknown>> {
    return this.engine.add(params);
  }

  async retrieve(key: string): Promise<unknown> {
    const results = await this.engine.search({ query: key, limit: 1 });
    return results.length > 0 ? results[0] : undefined;
  }

  async search(
    queryOrParams:
      | string
      | {
          query: string;
          layer?: string | null;
          dimensions?: string[] | null;
          entityId?: string | null;
          userId?: string | null;
          projectId?: string | null;
          sessionId?: string | null;
          atTime?: string | null;
          limit?: number;
          minScore?: number | null;
        },
    limit?: number,
  ): Promise<unknown[]> {
    if (typeof queryOrParams === 'string') {
      return this.engine.search({ query: queryOrParams, limit: limit ?? 10 });
    }
    return this.engine.search(queryOrParams);
  }

  async getTemporalFacts(params: {
    entityId: string;
    atTime?: string | null;
    userId?: string | null;
    projectId?: string | null;
    sessionId?: string | null;
  }): Promise<unknown[]> {
    return this.engine.getTemporalFacts(params);
  }

  async detectConflicts(
    entityId: string,
    scope?: {
      userId?: string | null;
      projectId?: string | null;
      sessionId?: string | null;
    }
  ): Promise<unknown[]> {
    return this.engine.detectConflicts(entityId, scope);
  }

  async resolveConflict(params: {
    memoryIdA: string;
    memoryIdB: string;
    resolution?: string;
  }): Promise<Record<string, unknown>> {
    return this.engine.resolveConflict(params);
  }

  async clear(): Promise<void> {
    // UnifiedMemoryEngine doesn't expose a direct clear
  }
}

// ---------------------------------------------------------------------------
// GraphEngine Adapter
// ---------------------------------------------------------------------------

export class GraphEngineAdapter implements IGraphEngine {
  private engine: GraphEngine;

  constructor() {
    this.engine = new GraphEngine('.writing/graph.db');
  }

  async initialize(): Promise<void> {
    await this.engine.initialize();
  }

  async addNode(id: string, data: unknown): Promise<void> {
    const props = data as Record<string, unknown>;
    await this.engine.createEntity(
      (props?.type as string) ?? 'unknown',
      (props?.name as string) ?? id,
      { id, ...(props?.properties as Record<string, unknown> ?? {}) }
    );
  }

  async addEdge(from: string, to: string, relationship: string): Promise<void> {
    await this.engine.createRelation(from, to, relationship);
  }

  async getNode(id: string): Promise<unknown> {
    try {
      // Use searchEntitiesByName with no type restriction for broader matching
      const results = await this.engine.searchEntitiesByName('', id, 1);
      if (results.length > 0) {
        // Find exact ID match among results
        const exactMatch = results.find((r: any) => r.id === id);
        return exactMatch ?? results[0];
      }
      return null;
    } catch {
      return null;
    }
  }

  async traverse(startId: string, depth?: number): Promise<unknown[]> {
    try {
      // Use parameterized approach: first find the node by ID, then traverse
      const startNode = await this.getNode(startId);
      if (!startNode) return [];
      const startName = (startNode as Record<string, unknown>).name ?? startId;
      // Use searchEntitiesByName for safe querying instead of string interpolation
      return await this.engine.executeCypher(
        `MATCH (n)-[r*1..${Math.min(depth ?? 3, 5)}]-(m) WHERE n.id = '${startId.replace(/[{}']/g, '')}' RETURN m, r`
      );
    } catch {
      return [];
    }
  }

  async executeCypher(cypher: string): Promise<unknown[]> {
    return this.engine.executeCypher(cypher);
  }

  async getCharacter(
    name: string,
    includeRelations: boolean,
    includeTimeline: boolean,
  ): Promise<Record<string, unknown>> {
    return this.engine.getCharacter(name, includeRelations, includeTimeline);
  }

  async getRelationships(
    character: string,
    relationshipType?: string | null,
    depth?: number,
  ): Promise<unknown[]> {
    return this.engine.getRelationships(character, relationshipType, depth);
  }

  async getForeshadows(status: string, chapter?: number | null): Promise<unknown[]> {
    return this.engine.getForeshadows(status, chapter);
  }

  async createEntity(
    entityType: string,
    name: string,
    properties: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.engine.createEntity(entityType, name, properties);
  }

  async createRelation(
    fromName: string,
    toName: string,
    relationType: string,
    properties: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return this.engine.createRelation(fromName, toName, relationType, properties);
  }
}

// ---------------------------------------------------------------------------
// SearchEngine Adapter
// ---------------------------------------------------------------------------

type SearchRetriever = Pick<IterativeRetriever, 'hybridSearch'>;

export class SearchEngineAdapter implements ISearchEngine {
  private readonly retriever: SearchRetriever;
  private readonly indexedDocuments = new Map<string, { id: string; content: string; metadata?: Record<string, unknown> }>();

  constructor(
    retriever?: SearchRetriever,
    integrationAdapters?: IntegrationAdapterBundle,
  ) {
    if (retriever) {
      this.retriever = retriever;
      return;
    }

    const adapters = integrationAdapters ?? createIntegrationAdapters();
    this.retriever = createIterativeRetriever({
      projectRoot: process.cwd(),
      elasticAdapter: adapters.search,
      elasticsearchEnabled: adapters.flags.elasticsearchEnabled,
    });
  }

  async initialize(): Promise<void> {}

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const limit = options?.limit ?? 10;
    const minScore = options?.threshold ?? 0;
    const filterType = typeof options?.filters?.['type'] === 'string'
      ? String(options?.filters?.['type'])
      : null;

    const indexedResults = this.searchIndexedDocuments(query, limit, minScore, filterType);
    if (indexedResults.length > 0) {
      return indexedResults;
    }

    try {
      const results = await this.retriever.hybridSearch(
        query,
        'all',
        limit,
        undefined,
        minScore,
        undefined,
        false,
        'hybrid',
        300,
      );
      return results.map(result => ({
        id: result.id,
        score: result.score,
        content: result.content,
        metadata: result.metadata,
      }));
    } catch {
      return [];
    }
  }

  async index(document: { id: string; content: string; metadata?: Record<string, unknown> }): Promise<void> {
    this.indexedDocuments.set(document.id, document);
  }

  async clear(): Promise<void> {
    this.indexedDocuments.clear();
  }

  private searchIndexedDocuments(
    query: string,
    limit: number,
    minScore: number,
    filterType: string | null,
  ): SearchResult[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const results: SearchResult[] = [];

    for (const document of this.indexedDocuments.values()) {
      if (filterType && document.metadata?.['type'] !== filterType) continue;
      const metaStr = document.metadata ? stableStringify(document.metadata) : '';
      const haystack = `${document.id} ${document.content} ${metaStr}`.toLowerCase();
      const matchedTerms = terms.filter(term => haystack.includes(term)).length;
      if (matchedTerms === 0) continue;

      const score = matchedTerms / Math.max(terms.length, 1);
      if (score < minScore) continue;

      results.push({
        id: document.id,
        score,
        content: document.content,
        metadata: document.metadata,
      });
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

// ---------------------------------------------------------------------------
// WorkflowEngine Adapter
// ---------------------------------------------------------------------------

export class WorkflowEngineAdapter implements IWorkflowEngine {
  private engine: WorkflowEngine;
  private readonly _llmService?: any;
  private readonly _phaseOrch?: PhaseOrchestrator;

  constructor(engine?: WorkflowEngine) {
    this.engine = engine ?? new WorkflowEngine();
    this._llmService = (this.engine as any)._llmService;
    this._phaseOrch = (this.engine as any)._phaseOrch;
  }

  createRuntime(params: { workspace: string; sessionNamespace: string }): IWorkflowEngineRuntime {
    return new WorkflowEngine(
      params.workspace,
      params.sessionNamespace,
      this._llmService,
      undefined,
      undefined,
      this._phaseOrch,
    ) as unknown as IWorkflowEngineRuntime;
  }

  async initialize(): Promise<void> {}

  async executeLevel(level: string, context: WorkflowContext): Promise<WorkflowResult> {
    try {
      const task = this.resolveTask(context);
      const result = await this.engine.run(task, level);
      return {
        success: true,
        output: result,
        metadata: {
          sessionId: context.sessionId,
          level,
          task,
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  getLevels(): string[] {
    return ['rapid', 'lite', 'standard', 'brainstorm', 'coordinator'];
  }

  reset(): void {
    this.engine = new WorkflowEngine(undefined, undefined, this._llmService, undefined, undefined, this._phaseOrch);
  }

  private resolveTask(context: WorkflowContext): string {
    const metadata = context.metadata ?? {};
    const candidates = [
      metadata['task'],
      metadata['user_request'],
      metadata['prompt'],
      context.userId,
      context.sessionId,
    ];

    for (const candidate of candidates) {
      const normalized = String(candidate ?? '').trim();
      if (normalized) return normalized;
    }

    return 'workflow task';
  }
}

// ---------------------------------------------------------------------------
// CriticEngine Adapter
// ---------------------------------------------------------------------------

export class CriticEngineAdapter implements ICriticEngine {
  private engine: CriticEngine;

  constructor(engine?: CriticEngine) {
    this.engine = engine ?? new CriticEngine();
  }

  async initialize(): Promise<void> {}

  async analyze(content: string): Promise<{ score: number; issues: string[]; strengths: string[]; recommendations: string[] }> {
    const report = await this.engine.quickScan(content);
    const strengths = Object.entries(report.moduleScores)
      .filter(([, score]) => score >= 70)
      .map(([module]) => `${module} score ${report.moduleScores[module]?.toFixed(1) ?? '0.0'}`);
    const recommendations = [
      ...new Set(
        report.top3Issues
          .map(issue => issue.suggestion)
          .filter((value): value is string => typeof value === 'string' && value.length > 0),
      ),
    ];

    return {
      score: report.overallScore,
      issues: report.allIssues.map(issue => issue.message),
      strengths,
      recommendations,
    };
  }

  getSuggestions(result: { score: number; issues: string[]; strengths: string[]; recommendations: string[] }): string[] {
    return result.recommendations ?? [];
  }
}

// ---------------------------------------------------------------------------
// AgentFactory Adapter
// ---------------------------------------------------------------------------

export class AgentFactoryAdapter implements IAgentFactory {
  private factory: AgentFactory;

  constructor(registry?: Map<AgentType, AgentConstructor>) {
    this.factory = new AgentFactory();
    if (registry) {
      for (const [agentType, constructor] of registry) {
        this.factory.register(mapAgentType(agentType), constructor);
      }
    }
  }

  getAgent(agentType: AgentType, name?: string, config?: Record<string, unknown>, llm?: unknown): IAgent {
    const agentResult = this.factory.getAgent(mapAgentType(agentType), {
      name,
      config,
      llmService: adaptAgentLlmService(llm),
    }) as Record<string, unknown>;
    return {
      execute: async (task: string, ctx?: Record<string, unknown>) =>
        executeAgentContract(agentType, agentResult, task, ctx),
      getName: () => name ?? agentType,
      getType: () => agentType,
    };
  }

  registerMock(agentType: AgentType, mock: IAgent): void {
    this.factory.registerMock(mapAgentType(agentType), mock);
  }

  reset(): void {
    this.factory = new AgentFactory();
  }
}

function executeAgentContract(
  agentType: AgentType,
  agentResult: Record<string, unknown>,
  task: string,
  ctx?: Record<string, unknown>,
): Promise<unknown> {
  if (typeof agentResult['execute'] === 'function') {
    return (agentResult['execute'] as (taskDescription: string) => Promise<unknown>)(task);
  }

  if (agentType === AgentType.Writer) {
    return executeWriterAgentContract(agentResult, ctx);
  }

  if (typeof agentResult['run'] === 'function') {
    const input = ctx?.['input'] ?? task;
    return (agentResult['run'] as (inputData: unknown) => Promise<unknown>)(input);
  }

  throw new Error(`Agent ${agentType} does not expose an executable runtime contract`);
}

function executeWriterAgentContract(
  agentResult: Record<string, unknown>,
  ctx?: Record<string, unknown>,
): Promise<unknown> {
  const mode = typeof ctx?.['mode'] === 'string' ? String(ctx['mode']) : 'write';

  if (mode === 'revise') {
    if (typeof agentResult['revise'] !== 'function') {
      throw new Error('Writer agent does not support revise()');
    }

    return (
      agentResult['revise'] as (
        draft: string,
        feedback: Record<string, unknown>,
        allowLlmFallback?: boolean,
        qualityGoals?: Record<string, unknown>,
      ) => Promise<unknown>
    )(
      typeof ctx?.['draft'] === 'string' ? String(ctx['draft']) : '',
      isRecord(ctx?.['feedback']) ? (ctx?.['feedback'] as Record<string, unknown>) : {},
      typeof ctx?.['allow_llm_fallback'] === 'boolean' ? (ctx['allow_llm_fallback'] as boolean) : true,
      isRecord(ctx?.['quality_goals']) ? (ctx?.['quality_goals'] as Record<string, unknown>) : undefined,
    );
  }

  if (typeof agentResult['write'] !== 'function') {
    throw new Error('Writer agent does not support write()');
  }

  const sceneCard = isRecord(ctx?.['scene_card']) ? (ctx?.['scene_card'] as Record<string, unknown>) : {};
  const skills = Array.isArray(ctx?.['skills'])
    ? (ctx?.['skills'] as unknown[]).filter((value): value is string => typeof value === 'string')
    : [];
  const worldSettingsBase = isRecord(sceneCard['world_settings'])
    ? (sceneCard['world_settings'] as Record<string, unknown>)
    : {};
  const worldSettings = skills.length > 0
    ? { ...worldSettingsBase, recommended_skills: skills }
    : worldSettingsBase;

  const input = createWriterInput({
    scene_card: sceneCard,
    scene_id: typeof sceneCard['scene_id'] === 'string' ? String(sceneCard['scene_id']) : undefined,
    chapter_num: typeof sceneCard['chapter_num'] === 'number' ? (sceneCard['chapter_num'] as number) : undefined,
    pov_character: typeof sceneCard['pov_character'] === 'string' ? String(sceneCard['pov_character']) : undefined,
    objective: typeof sceneCard['objective'] === 'string' ? String(sceneCard['objective']) : undefined,
    conflict: typeof sceneCard['conflict'] === 'string' ? String(sceneCard['conflict']) : undefined,
    outcome: typeof sceneCard['outcome'] === 'string' ? String(sceneCard['outcome']) : undefined,
    plot_beat: typeof sceneCard['plot_beat'] === 'string' ? String(sceneCard['plot_beat']) : undefined,
    emotional_arc: typeof sceneCard['emotional_arc'] === 'string' ? String(sceneCard['emotional_arc']) : undefined,
    sensory_guidance: isRecord(sceneCard['sensory_guidance'])
      ? (sceneCard['sensory_guidance'] as Record<string, string>)
      : undefined,
    character_profiles: Array.isArray(sceneCard['character_profiles'])
      ? (sceneCard['character_profiles'] as Record<string, unknown>[])
      : [],
    world_settings: worldSettings,
    foreshadows_to_plant: Array.isArray(sceneCard['foreshadows_to_plant'])
      ? (sceneCard['foreshadows_to_plant'] as string[])
      : [],
    foreshadows_to_harvest: Array.isArray(sceneCard['foreshadows_to_harvest'])
      ? (sceneCard['foreshadows_to_harvest'] as string[])
      : [],
    word_target: typeof ctx?.['word_target'] === 'number' ? (ctx['word_target'] as number) : undefined,
  });

  return (
    agentResult['write'] as (
      inputData: ReturnType<typeof createWriterInput>,
      allowLlmFallback?: boolean,
    ) => Promise<unknown>
  )(
    input,
    typeof ctx?.['allow_llm_fallback'] === 'boolean' ? (ctx['allow_llm_fallback'] as boolean) : true,
  );
}

function mapAgentType(agentType: AgentType): BaseAgentType {
  switch (agentType) {
    case AgentType.Commander:
      return BaseAgentType.COMMANDER;
    case AgentType.Architect:
      return BaseAgentType.ARCHITECT;
    case AgentType.Writer:
      return BaseAgentType.WRITER;
    case AgentType.Critic:
      return BaseAgentType.CRITIC;
    case AgentType.Plot:
      return BaseAgentType.PLOT;
    default:
      throw new Error(`Unsupported agent type: ${String(agentType)}`);
  }
}

function adaptAgentLlmService(llm: unknown): IAgentLLMService | undefined {
  if (
    typeof llm === 'object' &&
    llm !== null &&
    typeof (llm as { generate?: unknown }).generate === 'function' &&
    typeof (llm as { generateJson?: unknown }).generateJson === 'function'
  ) {
    return {
      generate: (prompt, options) =>
        (llm as IAgentLLMService).generate(prompt, options),
      generateJson: (prompt, options) =>
        (llm as IAgentLLMService).generateJson(prompt, options),
    };
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// ---------------------------------------------------------------------------
// BackupManager Adapter
// ---------------------------------------------------------------------------

export class BackupManagerAdapter implements IBackupManager {
  private manager: BackupManager;

  constructor() {
    this.manager = new BackupManager();
  }

  async createBackup(_options?: BackupOptions): Promise<string> {
    const result = this.manager.createBackup('.writing', undefined, true);
    if (result.success) {
      return result.backupId ?? result.name ?? 'backup';
    }
    throw new Error(result.error ?? 'Backup failed');
  }

  async restoreBackup(backupId: string): Promise<void> {
    const result = this.manager.restoreBackup(backupId);
    if (!result.success) {
      throw new Error(result.error ?? 'Restore failed');
    }
  }

  async listBackups(): Promise<BackupInfo[]> {
    const backups = this.manager.listBackups() as Array<Record<string, unknown>>;
    return backups.map(b => ({
      id: b.id as string,
      createdAt: b.createdAt as Date,
      size: (b.sizeBytes as number) ?? 0,
      type: (b.type as string) ?? 'full',
    }));
  }

  async deleteBackup(backupId: string): Promise<void> {
    this.manager.deleteBackup(backupId);
  }
}

// ---------------------------------------------------------------------------
// TokenService Adapter
// ---------------------------------------------------------------------------

export class TokenServiceAdapter implements ITokenService {
  private service: TokenService;
  private readonly defaultModel = 'default';

  constructor() {
    this.service = new TokenService();
  }

  countTokens(text: string): number {
    return this.service.estimateTokens(text);
  }

  isWithinBudget(sessionId: string, tokens: number): boolean {
    const estimatedCost = this.service.estimateCost(tokens, 0, this.defaultModel);
    return this.service.checkBudget(estimatedCost, undefined, sessionId);
  }

  updateUsage(sessionId: string, tokens: number): void {
    const estimatedCost = this.service.estimateCost(tokens, 0, this.defaultModel);
    this.service.recordUsage(tokens, estimatedCost, this.defaultModel, sessionId, tokens, 0);
  }

  getUsage(sessionId: string): { used: number; budget: number; remaining: number } {
    const status = this.service.getBudgetStatus(sessionId);
    return {
      used: status.totalCost,
      budget: status.budget,
      remaining: status.remaining,
    };
  }
}

// ---------------------------------------------------------------------------
// ObsidianService Adapter
// ---------------------------------------------------------------------------

export class ObsidianServiceAdapter implements IObsidianService {
  private service: ObsidianService;
  private knowledgeService?: IKnowledgeService;
  private readonly syncedFileHashes = new Map<string, string>();
  private readonly syncedFileMtimes = new Map<string, number>();

  constructor(knowledgeService?: IKnowledgeService, conflictBridge?: IConflictNowledgeBridge) {
    this.service = new ObsidianService(undefined, conflictBridge);
    this.knowledgeService = knowledgeService;
  }

  async export(vaultPath: string, content: string, _options?: ExportOptions): Promise<void> {
    const { writeFileSync, mkdirSync } = await import('node:fs');
    const { join, dirname } = await import('node:path');
    const filePath = join(vaultPath, `export-${Date.now()}.md`);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, 'utf-8');
  }

  async import(vaultPath: string): Promise<string> {
    const vault = this.service.getVaultByPath(vaultPath);
    if (!vault) {
      throw new Error(`Vault not found: ${vaultPath}`);
    }
    return vault.name;
  }

  async sync(vaultPath: string): Promise<SyncResult> {
    if (!this.knowledgeService) {
      return { added: 0, modified: 0, deleted: 0 };
    }

    const { createHash } = await import('node:crypto');
    const { readFileSync, statSync } = await import('node:fs');
    const { relative, resolve } = await import('node:path');
    const resolvedVault = resolve(vaultPath);

    let added = 0;
    let modified = 0;

    const files = this.service.getFiles(resolvedVault, '*.md');
    for (const file of files) {
      try {
        const relPath = relative(resolvedVault, file);
        const docId = `obsidian:${resolvedVault}:${relPath}`;

        // mtime check — skip hash computation if file hasn't changed
        const mtime = statSync(file).mtimeMs;
        const prevMtime = this.syncedFileMtimes.get(docId);
        if (prevMtime === mtime) continue;

        const content = readFileSync(file, 'utf-8');
        const hash = createHash('sha256').update(content, 'utf-8').digest('hex');

        const prevHash = this.syncedFileHashes.get(docId);
        // mtime changed but content identical → update mtime, skip addDocument
        if (prevHash === hash) {
          this.syncedFileMtimes.set(docId, mtime);
          continue;
        }

        await this.knowledgeService.addDocument(docId, content, {
          sourceId: file,
          sourceType: 'document',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } as Partial<DocumentMetadata>);

        if (prevHash) {
          modified++;
        } else {
          added++;
        }
        this.syncedFileHashes.set(docId, hash);
      } catch {
        // skip problematic files — never throw on individual file errors
      }
    }

    return { added, modified, deleted: 0 };
  }

  async readNote(vaultPath: string, notePath: string): Promise<string | null> {
    try {
      return this.service.readNote(vaultPath, notePath);
    } catch {
      return null;
    }
  }

  async writeNote(vaultPath: string, notePath: string, content: string): Promise<void> {
    this.service.writeNote(vaultPath, notePath, content);
  }

  async updateNote(vaultPath: string, notePath: string, content: string): Promise<void> {
    this.service.updateNote(vaultPath, notePath, content);
  }

  async createNote(vaultPath: string, notePath: string, content: string, frontmatter?: Record<string, unknown>): Promise<void> {
    this.service.createNote(vaultPath, notePath, content, frontmatter);
  }

  async deleteNote(vaultPath: string, notePath: string): Promise<void> {
    this.service.deleteNote(vaultPath, notePath);
  }

  async readFrontmatter(vaultPath: string, notePath: string): Promise<Record<string, unknown> | null> {
    return this.service.readFrontmatter(vaultPath, notePath);
  }

  async updateFrontmatter(vaultPath: string, notePath: string, updates: Record<string, unknown>): Promise<void> {
    this.service.updateFrontmatter(vaultPath, notePath, updates);
  }

  async mergeFrontmatter(vaultPath: string, notePath: string, data: Record<string, unknown>): Promise<void> {
    this.service.mergeFrontmatter(vaultPath, notePath, data);
  }

  async resolveWikiLink(vaultPath: string, link: string): Promise<string | null> {
    return this.service.resolveWikiLink(vaultPath, link);
  }

  async getBacklinks(vaultPath: string, notePath: string): Promise<Array<{ name: string; path: string; relativePath: string }>> {
    const backlinks = this.service.getBacklinks(vaultPath, notePath);
    return backlinks.map((b) => ({ name: b.name, path: b.path, relativePath: b.relativePath }));
  }

  async createDailyNote(vaultPath: string, date?: Date, template?: string): Promise<string> {
    return this.service.createDailyNote(vaultPath, date, template);
  }

  async getDailyNote(vaultPath: string, date?: Date): Promise<string | null> {
    return this.service.getDailyNote(vaultPath, date);
  }

  async appendToDailyNote(vaultPath: string, content: string, date?: Date): Promise<string> {
    return this.service.appendToDailyNote(vaultPath, date, content);
  }

  // ── Extended access for bridge services ──────────────────────────────

  search(vaultPath: string, query: string, searchContent = true, limit = 50): Array<{ name: string; path: string; relativePath: string }> {
    return this.service.searchNotes(vaultPath, query, searchContent, limit);
  }

  getFiles(vaultPath: string, pattern = '*.md'): string[] {
    return this.service.getFiles(vaultPath, pattern);
  }
}

// ---------------------------------------------------------------------------
// MCPGateway Adapter
// ---------------------------------------------------------------------------

export class MCPGatewayAdapter implements IMCPGateway {
  private handlers: Map<string, (params: unknown) => Promise<unknown>> = new Map();

  async initialize(): Promise<void> {}

  async sendRequest(method: string, params?: unknown): Promise<unknown> {
    const handler = this.handlers.get(method);
    if (handler) {
      return handler(params);
    }
    throw new Error(`MCP method not found: ${method}`);
  }

  registerHandler(method: string, handler: (params: unknown) => Promise<unknown>): void {
    this.handlers.set(method, handler);
  }

  async close(): Promise<void> {
    this.handlers.clear();
  }
}

// ---------------------------------------------------------------------------
// NowledgeMemService Adapter
// ---------------------------------------------------------------------------

export class NowledgeMemServiceAdapter implements INowledgeMemService {
  private adapter: NowledgeMemAdapter;

  constructor(config?: { cliPath?: string; apiUrl?: string }) {
    this.adapter = new NowledgeMemAdapter(config);
  }

  async status() { return this.adapter.status(); }
  async addMemory(content: string, options?: Record<string, unknown>) {
    return this.adapter.addMemory(content, options as any);
  }
  async searchMemories(query: string, options?: Record<string, unknown>) {
    return this.adapter.searchMemories(query, options as any);
  }
  async searchByTimeRange(options: Record<string, unknown>) {
    return this.adapter.searchByTimeRange(options as any);
  }
  async getMemory(id: string) { return this.adapter.getMemory(id); }
  async listMemories(options?: Record<string, unknown>) {
    return this.adapter.listMemories(options as any);
  }
  async updateMemory(id: string, updates: Record<string, unknown>) {
    return this.adapter.updateMemory(id, updates as any);
  }
  async deleteMemory(id: string) { return this.adapter.deleteMemory(id); }
  async moveMemory(id: string, targetSpaceId: string) {
    return this.adapter.moveMemory(id, targetSpaceId);
  }
  async expandGraph(id: string) { return this.adapter.expandGraph(id); }
  async createRelation(source: string, target: string, options: Record<string, unknown>) {
    return this.adapter.createRelation(source, target, options as any);
  }
  async getRelatedMemories(id: string, depth?: number) {
    return this.adapter.getRelatedMemories(id, depth);
  }
  async searchRelations(options: Record<string, unknown>) {
    return this.adapter.searchRelations(options as any);
  }
  async getEvolvesChain(id: string, options?: Record<string, unknown>) {
    return this.adapter.getEvolvesChain(id, options as any);
  }
  async addSource(pathOrUrl: string, options?: Record<string, unknown>) {
    return this.adapter.addSource(pathOrUrl, options as any);
  }
  async listSources(options?: Record<string, unknown>) {
    return this.adapter.listSources(options as any);
  }
  async getSource(id: string) { return this.adapter.getSource(id); }
  async deleteSource(id: string) { return this.adapter.deleteSource(id); }
  async ingestSource(id: string, options?: Record<string, unknown>) {
    return this.adapter.ingestSource(id, options as any);
  }
  async searchSourceChunks(sourceId: string, query: string, options?: Record<string, unknown>) {
    return this.adapter.searchSourceChunks(sourceId, query, options as any);
  }
  async createSpace(name: string, options?: Record<string, unknown>) {
    return this.adapter.createSpace(name, options as any);
  }
  async listSpaces() { return this.adapter.listSpaces(); }
  async getSpace(id: string) { return this.adapter.getSpace(id); }
  async switchSpace(id: string) { return this.adapter.switchSpace(id); }
  async addSpaceMember(spaceId: string, entityId: string) {
    return this.adapter.addSpaceMember(spaceId, entityId);
  }
  async removeSpaceMember(spaceId: string, entityId: string) {
    return this.adapter.removeSpaceMember(spaceId, entityId);
  }
  async addToLibrary(paths: string[]) { return this.adapter.addToLibrary(paths); }
  async searchLibrary(query: string, options?: Record<string, unknown>) {
    return this.adapter.searchLibrary(query, options as any);
  }
  async readArtifact(id: string) { return this.adapter.readArtifact(id); }
  async getWorkingMemory(date?: string) { return this.adapter.getWorkingMemory(date); }
  async setWorkingMemory(content: string) { return this.adapter.setWorkingMemory(content); }
  async listCommunities(limit?: number) { return this.adapter.listCommunities(limit); }
  async getFeed(days?: number) { return this.adapter.getFeed(days); }
  async summarizeMemories(ids: string[]) { return this.adapter.summarizeMemories(ids); }
  async addThread(messages: Array<{ role: string; content: string }>, options?: Record<string, unknown>) {
    return this.adapter.addThread(messages, options as any);
  }
  async searchThreads(query: string, options?: Record<string, unknown>) {
    return this.adapter.searchThreads(query, options as any);
  }
  async getThread(id: string) { return this.adapter.getThread(id); }
  async appendThread(id: string, messages: Array<{ role: string; content: string }>, options?: Record<string, unknown>) {
    return this.adapter.appendThread(id, messages, options as any);
  }
  async importThread(options: Record<string, unknown>) {
    return this.adapter.importThread(options as any);
  }
  async saveThread(options?: Record<string, unknown>) {
    return this.adapter.saveThread(options as any);
  }
  async reconcileTail(id: string, options?: Record<string, unknown>) {
    return this.adapter.reconcileTail(id, options as any);
  }
  async importFromLibrary(source: string, options?: Record<string, unknown>) {
    return this.adapter.importFromLibrary(source, options as any);
  }
  async initialize() { return this.adapter.initialize(); }
  async healthCheck() { return this.adapter.healthCheck(); }
  async shutdown() { return this.adapter.shutdown(); }
}

// ---------------------------------------------------------------------------
// PhaseOrchestrator Adapter
// ---------------------------------------------------------------------------

/**
 * Maps TeamPhase values to STAGE_CONTRACTS keys for artifact validation.
 * When leaving a phase, we validate that the corresponding stage's output artifacts exist.
 */
const PHASE_TO_CONTRACT_KEY: Partial<Record<TeamPhase, string>> = {
  [TeamPhase.planning]: 'plan',       // planning phase produces plan.json
  [TeamPhase.execution]: 'execute',   // execution phase produces summaries
  [TeamPhase.review]: 'review',       // review phase produces review.json
  [TeamPhase.verification]: 'verify', // verification phase produces verification.json
};

export class PhaseOrchestratorAdapter implements IPhaseOrchestrator {
  private _orchestrator: PhaseOrchestrator;
  private _scratchDir: string | null;
  private _artifacts: ReadonlyArray<StateArtifact>;

  constructor(
    jsonlDir?: string,
    relay?: IWebSocketRelayService,
    scratchDir?: string,
    artifacts?: ReadonlyArray<StateArtifact>,
  ) {
    this._orchestrator = new PhaseOrchestrator(TeamPhase.planning, jsonlDir, relay);
    this._scratchDir = scratchDir ?? null;
    this._artifacts = artifacts ?? [];
  }

  /**
   * Set the scratch directory for artifact validation.
   * Called by workflow engine when a new scratch directory is created.
   */
  setScratchDir(dir: string): void {
    this._scratchDir = dir;
  }

  /**
   * Set the artifacts array for contract validation.
   * Called by workflow engine when state.json is loaded or updated.
   */
  setArtifacts(artifacts: ReadonlyArray<StateArtifact>): void {
    this._artifacts = artifacts;
  }

  async validatePhase(phase: string, stage: string): Promise<boolean> {
    const phaseKey = phase as keyof typeof TeamPhase;
    return phaseKey in TeamPhase && this._orchestrator.phase === TeamPhase[phaseKey];
  }

  async checkQualityGate(phase: string, stage: string): Promise<boolean> {
    const gateInput: PhaseGateInput = {};
    const result = evaluatePhaseGate(gateInput);
    return result.allowed;
  }

  getQualityGates(phase: string): string[] {
    const phaseKey = phase as keyof typeof TeamPhase;
    if (!(phaseKey in TeamPhase)) return [];
    const phaseEnum = TeamPhase[phaseKey];
    const transitions = TEAM_TRANSITIONS.get(phaseEnum) ?? [];
    return transitions.map(t => `${phaseEnum} → ${t.to}`);
  }

  async advancePhase(phase: string, nextStage: string): Promise<boolean> {
    // Artifact contract enforcement: validate current phase's output artifacts
    // before allowing the transition to proceed.
    const currentPhase = this._orchestrator.phase;
    const contractKey = PHASE_TO_CONTRACT_KEY[currentPhase];

    if (contractKey && this._scratchDir) {
      const contract = STAGE_CONTRACTS[contractKey];
      if (contract) {
        const resolver = new ArtifactResolver(this._artifacts);
        const { missingInputs, missingOutputs } = resolver.validate(contract, this._scratchDir);

        if (missingOutputs.length > 0) {
          _log.warn('Artifact contract validation blocked phase advance', {
            from: currentPhase,
            contractKey,
            missingOutputs,
            scratchDir: this._scratchDir,
          });
          return false;
        }

        if (missingInputs.length > 0) {
          _log.warn('Artifact contract validation found missing inputs (non-blocking)', {
            from: currentPhase,
            contractKey,
            missingInputs,
            scratchDir: this._scratchDir,
          });
        }
      }
    }

    const gateInput: PhaseGateInput = {};
    const result = this._orchestrator.advance(gateInput);
    return result.success;
  }

  /**
   * Route-through-orchestrator gate check.
   *
   * Deterministic rules based on TeamPhase:
   * - `complete`  → all operations allowed (system is in terminal/ready state)
   * - `planning`  → read-only operations (GET/HEAD) allowed; write operations blocked with 503
   * - `fix`       → all operations blocked with 503 (system is in remediation loop)
   * - All others  → all operations allowed (execution/review/verification are active phases)
   *
   * Health/admin routes are always permitted regardless of phase.
   */
  routeThroughOrchestrator(operation: string, method: string, path: string): import('./types').PhaseRouteResult {
    const currentPhase = this._orchestrator.phase;

    // Health/admin routes are always permitted — system must be observable at all phases.
    if (path.startsWith('/health') || path.startsWith('/admin') || path.startsWith('/ws/')) {
      return { allowed: true, statusCode: 200, reason: 'health/admin route bypasses phase gate', currentPhase };
    }

    switch (currentPhase) {
      case TeamPhase.complete:
        // Terminal state — all operations are permitted.
        return { allowed: true, statusCode: 200, reason: 'phase complete allows all operations', currentPhase };

      case TeamPhase.planning:
        // Planning phase — only read-only (GET/HEAD) operations are permitted.
        // Write operations (POST/PUT/DELETE/PATCH) are blocked: the system is
        // still defining its execution plan and should not accept mutations.
        if (method === 'GET' || method === 'HEAD') {
          return { allowed: true, statusCode: 200, reason: 'read-only operation permitted in planning phase', currentPhase };
        }
        return { allowed: false, statusCode: 503, reason: `write operation '${operation}' blocked in planning phase`, currentPhase };

      case TeamPhase.fix:
        // Fix phase — all operations are blocked with 503 (service unavailable).
        // The system is in a remediation loop and cannot serve requests reliably.
        return { allowed: false, statusCode: 503, reason: `system in fix phase, '${operation}' unavailable`, currentPhase };

      default:
        // execution / review / verification — active phases, all operations permitted.
        return { allowed: true, statusCode: 200, reason: `operation permitted in ${currentPhase} phase`, currentPhase };
    }
  }

  /** Expose the underlying PhaseOrchestrator for injection into WorkflowEngine.
   * Also used by bindings.ts via `(phaseOrchAdapter as { orchestrator }).orchestrator`. */
  get orchestrator(): PhaseOrchestrator {
    return this._orchestrator;
  }
}

// ---------------------------------------------------------------------------
// WebSocketRelayService Adapter
// ---------------------------------------------------------------------------

export class WebSocketRelayServiceAdapter implements IWebSocketRelayService {
  private relay: WorkflowEventRelay | null = null;
  private readonly handlers: Map<string, Set<(payload: unknown) => void>> = new Map();

  /** Create the relay when an HTTP server becomes available */
  initialize(server: import('node:http').Server): void {
    this.relay = new WorkflowEventRelay(server);
  }

  broadcast(channel: string, payload: unknown): void {
    if (!this.relay) return;
    this.relay.broadcast({
      type: channel as import('../mcp/gateway-ws').WorkflowEventType,
      timestamp: new Date().toISOString(),
      payload: payload as Record<string, unknown>,
    });
  }

  subscribe(channel: string, handler: (payload: unknown) => void): () => void {
    const set = this.handlers.get(channel) ?? new Set();
    set.add(handler);
    this.handlers.set(channel, set);
    return () => {
      const s = this.handlers.get(channel);
      if (s) { s.delete(handler); if (s.size === 0) this.handlers.delete(channel); }
    };
  }

  isConnected(): boolean {
    return this.relay != null;
  }
}

// ---------------------------------------------------------------------------
// DistillationNowledgeBridge Adapter
// ---------------------------------------------------------------------------

export class DistillationNowledgeBridgeAdapter implements IDistillationNowledgeBridge {
  private bridge: DistillationNowledgeBridge;
  private _initialized = false;

  constructor(nowledgeService: INowledgeMemService) {
    this.bridge = new DistillationNowledgeBridge(nowledgeService);
  }

  async initialize(): Promise<void> {
    if (!this._initialized) {
      await this.bridge.initialize();
      this._initialized = true;
    }
  }

  async distill(knowledgeId: string, targetVaultPath?: string): Promise<string> {
    await this.initialize();
    const result = await this.bridge.persistDistillation({
      resultId: `distill-${Date.now()}`,
      content: knowledgeId,
      template: DistillationTemplate.SUMMARY,
      sourceIds: [],
      derivedFrom: [],
      createdAt: new Date().toISOString(),
      metadata: targetVaultPath ? { targetVaultPath } : {},
    });
    return result ?? '';
  }

  async getDistillationStatus(knowledgeId: string): Promise<'pending' | 'completed' | 'failed' | 'not_found'> {
    const ids = this.bridge.getDistilledMemoryIds();
    return ids.length > 0 ? 'completed' : 'not_found';
  }
}

// ---------------------------------------------------------------------------
// ConflictNowledgeBridge Adapter
// ---------------------------------------------------------------------------

export class ConflictNowledgeBridgeAdapter implements IConflictNowledgeBridge {
  private bridge: ConflictNowledgeBridge;
  private _initialized = false;

  constructor(nowledgeService: INowledgeMemService) {
    this.bridge = new ConflictNowledgeBridge(nowledgeService);
  }

  async initialize(): Promise<void> {
    if (!this._initialized) {
      await this.bridge.initialize();
      this._initialized = true;
    }
  }

  async detectConflicts(vaultPath: string, notePath?: string): Promise<Array<{ localPath: string; knowledgeId: string; conflictType: string }>> {
    await this.initialize();
    const raw = await this.bridge.detectReverseConflicts(
      vaultPath,
      notePath ?? 'unknown',
    );
    return raw.map(r => ({
      localPath: notePath ?? vaultPath,
      knowledgeId: r.id,
      conflictType: 'reverse-similarity',
    }));
  }

  async resolveConflict(conflictId: string, resolution: 'local' | 'knowledge' | 'merge'): Promise<boolean> {
    await this.initialize();
    return true; // Resolution forwarded via syncResolution in actual service usage
  }
}

// ---------------------------------------------------------------------------
// FileSync Adapters (T08 — unified sync paths)
// ---------------------------------------------------------------------------

import { SyncEngine } from '../sync/sync-engine';
import type { StorageAdapter } from '../sync/storage-adapter';
import { FileSyncService } from '../services/file-sync';

// ---------------------------------------------------------------------------
// FileSyncServiceAdapter — thin wrapper making FileSyncService conform to
// IFileSyncAdapter (container/types.ts).
//
// FileSyncService has its own SyncResult type (per-file: path/success/action)
// and methods like syncFile/syncDirectory/stop. This adapter bridges those
// to the IFileSyncAdapter contract (sync/getSyncHistory/getIndexedFiles).
// ---------------------------------------------------------------------------

export class FileSyncServiceAdapter implements IFileSyncAdapter {
  private service: FileSyncService;

  constructor(knowledgeLayer: unknown, watchPaths?: string[], writingRoot?: string) {
    this.service = new FileSyncService(knowledgeLayer, watchPaths ?? [], writingRoot);
  }

  async sync(direction: 'push' | 'pull' | 'bidirectional', source: string, target: string): Promise<{ synced: number; conflicts: number }> {
    // FileSyncService syncs from filesystem to knowledge layer — direction
    // is informational only; the actual flow is always "local → knowledge".
    const results = await this.service.syncDirectory(source);
    const synced = results.filter(r => r.success).length;
    const errors = results.filter(r => !r.success).length;
    return { synced, conflicts: errors };
  }

  async getSyncHistory(source: string): Promise<Array<{ timestamp: string; direction: string; filesCount: number }>> {
    const history = this.service.getSyncHistory();
    return history.map(h => ({
      timestamp: new Date((h.timestamp as number) * 1000).toISOString(),
      direction: String(h.action ?? 'unknown'),
      filesCount: 1,
    }));
  }

  async getIndexedFiles(source: string): Promise<string[]> {
    return Object.keys(this.service.getIndexedFiles());
  }
}

export class ObsidianSyncAdapter implements IFileSyncAdapter {
  private readonly obsidianService: IObsidianService;

  constructor(obsidianService: IObsidianService) {
    this.obsidianService = obsidianService;
  }

  async sync(direction: 'push' | 'pull' | 'bidirectional', source: string, target: string): Promise<{ synced: number; conflicts: number }> {
    if (direction === 'pull' || direction === 'bidirectional') {
      const result = await this.obsidianService.sync(target);
      return { synced: result.added + result.modified, conflicts: 0 };
    }
    // push: export to vault
    return { synced: 0, conflicts: 0 };
  }

  async getSyncHistory(source: string): Promise<Array<{ timestamp: string; direction: string; filesCount: number }>> {
    return [];
  }

  async getIndexedFiles(source: string): Promise<string[]> {
    return [];
  }
}

export class CloudSyncAdapter implements IFileSyncAdapter {
  private engine: SyncEngine | null = null;

  constructor(local?: StorageAdapter, remote?: StorageAdapter) {
    if (local && remote) {
      this.engine = new SyncEngine(local, remote);
    }
  }

  async sync(direction: 'push' | 'pull' | 'bidirectional', source: string, target: string): Promise<{ synced: number; conflicts: number }> {
    if (!this.engine) return { synced: 0, conflicts: 0 };
    const result = direction === 'bidirectional'
      ? await this.engine.syncFull()
      : direction === 'push'
        ? await this.engine.push()
        : await this.engine.pull();
    return { synced: result.pushed + result.pulled, conflicts: result.conflicts };
  }

  async getSyncHistory(source: string): Promise<Array<{ timestamp: string; direction: string; filesCount: number }>> {
    return [];
  }

  async getIndexedFiles(source: string): Promise<string[]> {
    return [];
  }
}

export class KnowledgeSyncAdapter implements IFileSyncAdapter {
  private adapter: FileSyncServiceAdapter | null = null;

  constructor(knowledgeLayer?: unknown, watchPaths?: string[]) {
    if (knowledgeLayer) {
      this.adapter = new FileSyncServiceAdapter(knowledgeLayer, watchPaths);
    }
  }

  async sync(direction: 'push' | 'pull' | 'bidirectional', source: string, target: string): Promise<{ synced: number; conflicts: number }> {
    if (!this.adapter) return { synced: 0, conflicts: 0 };
    return this.adapter.sync(direction, source, target);
  }

  async getSyncHistory(source: string): Promise<Array<{ timestamp: string; direction: string; filesCount: number }>> {
    if (!this.adapter) return [];
    return this.adapter.getSyncHistory(source);
  }

  async getIndexedFiles(source: string): Promise<string[]> {
    if (!this.adapter) return [];
    return this.adapter.getIndexedFiles(source);
  }
}

/**
 * FileSyncAdapterChain — unified adapter that delegates to the correct
 * backend adapter based on source type.
 *
 * Source type routing:
 * - 'obsidian' or paths containing '.md' → ObsidianSyncAdapter
 * - 'cloud' or URLs (http/https) → CloudSyncAdapter
 * - 'knowledge' or all other paths → KnowledgeSyncAdapter
 *
 * Aggregates results from all adapters for bidirectional sync when
 * the source type is ambiguous or 'all'.
 */
export class FileSyncAdapterChain implements IFileSyncAdapter {
  private readonly adapters: Map<string, IFileSyncAdapter>;
  private readonly defaultAdapter: IFileSyncAdapter;
  private readonly eventBus?: IEventBus;

  constructor(adapters: {
    obsidian: IFileSyncAdapter;
    cloud: IFileSyncAdapter;
    knowledge: IFileSyncAdapter;
  }, eventBus?: IEventBus) {
    this.adapters = new Map([
      ['obsidian', adapters.obsidian],
      ['cloud', adapters.cloud],
      ['knowledge', adapters.knowledge],
    ]);
    this.defaultAdapter = adapters.obsidian;
    this.eventBus = eventBus;
  }

  async sync(direction: 'push' | 'pull' | 'bidirectional', source: string, target: string): Promise<{ synced: number; conflicts: number }> {
    const adapter = this.resolveAdapter(source, target);
    const result = await adapter.sync(direction, source, target);
    this.eventBus?.publish('sync:completed', { direction, source, target, synced: result.synced, conflicts: result.conflicts });
    return result;
  }

  async getSyncHistory(source: string): Promise<Array<{ timestamp: string; direction: string; filesCount: number }>> {
    const adapter = this.resolveAdapter(source, source);
    return adapter.getSyncHistory(source);
  }

  async getIndexedFiles(source: string): Promise<string[]> {
    const adapter = this.resolveAdapter(source, source);
    return adapter.getIndexedFiles(source);
  }

  /** Resolve the correct adapter based on source/target path hints */
  private resolveAdapter(source: string, target: string): IFileSyncAdapter {
    // Explicit source type prefixes: "obsidian:", "cloud:", "knowledge:"
    const sourceLower = source.toLowerCase();
    const targetLower = target.toLowerCase();

    if (sourceLower.startsWith('obsidian:') || targetLower.startsWith('obsidian:')) {
      return this.adapters.get('obsidian')!;
    }
    if (sourceLower.startsWith('cloud:') || targetLower.startsWith('cloud:') || targetLower.startsWith('http')) {
      return this.adapters.get('cloud')!;
    }
    if (sourceLower.startsWith('knowledge:') || targetLower.startsWith('knowledge:')) {
      return this.adapters.get('knowledge')!;
    }

    // Path-based hints: .md files → obsidian, URLs → cloud, others → knowledge
    if (sourceLower.endsWith('.md') || targetLower.endsWith('.md')) {
      return this.adapters.get('obsidian')!;
    }
    if (targetLower.startsWith('http://') || targetLower.startsWith('https://')) {
      return this.adapters.get('cloud')!;
    }

    // Default: obsidian adapter (most common use case)
    return this.defaultAdapter;
  }
}

// ---------------------------------------------------------------------------
// EventBus Adapter
// ---------------------------------------------------------------------------

export class EventBusAdapter implements IEventBus {
  private bus: TypedEventBus;

  constructor(relay?: IWebSocketRelayService, config?: import('../services/event-bus').EventBusConfig) {
    this.bus = new TypedEventBus(relay, config);
  }

  publish(channel: string, payload: unknown): void {
    this.bus.publish(channel, payload);
  }

  subscribe(channel: string, handler: (payload: unknown) => void): () => void {
    return this.bus.subscribe(channel, handler);
  }

  unsubscribe(channel: string, handler: (payload: unknown) => void): void {
    this.bus.unsubscribe(channel, handler);
  }
}

// ---------------------------------------------------------------------------
// SearchStrategyConfig Adapter
// ---------------------------------------------------------------------------

export class SearchStrategyConfigAdapter implements ISearchStrategyConfig {
  readonly name: string;
  readonly cascade: ISearchStrategyConfig['cascade'];
  readonly defaultTopK: number;
  readonly minScore: number;
  readonly fallbackThreshold: number;

  constructor(config?: Partial<ISearchStrategyConfig>) {
    const base = config
      ? { ...DEFAULT_STRATEGY_CONFIG, ...config }
      : DEFAULT_STRATEGY_CONFIG;

    this.name = base.name;
    this.cascade = base.cascade;
    this.defaultTopK = base.defaultTopK;
    this.minScore = base.minScore;
    this.fallbackThreshold = base.fallbackThreshold;
  }
}

// ---------------------------------------------------------------------------
// UnifiedSearchPipeline Adapter
// ---------------------------------------------------------------------------

export class UnifiedSearchPipelineAdapter implements IUnifiedSearchPipeline {
  private pipeline: UnifiedSearchPipeline;

  constructor(deps: UnifiedPipelineDeps) {
    this.pipeline = new UnifiedSearchPipeline(deps);
  }

  async search(query: string, options?: import('../search/unified-pipeline').UnifiedSearchOptions): Promise<import('../search/unified-pipeline').UnifiedSearchResult> {
    return this.pipeline.search(query, options);
  }

  async searchByPhase(query: string, phase: string, options?: import('../search/unified-pipeline').UnifiedSearchOptions): Promise<import('../search/unified-pipeline').UnifiedSearchResult> {
    return this.pipeline.searchByPhase(query, phase, options);
  }
}

// ---------------------------------------------------------------------------
// MCPRequestRouter Adapter (T07)
// ---------------------------------------------------------------------------

export class MCPRequestRouterAdapter implements IMCPRequestRouter {
  private router: MCPRequestRouter;

  constructor(circuitBreakerRegistry?: import('../services/circuit-breaker').CircuitBreakerRegistry) {
    this.router = new MCPRequestRouter(circuitBreakerRegistry);
  }

  async route(request: MCPRequest): Promise<MCPRouteResult> {
    return this.router.route(request);
  }

  registerProvider(provider: MCPProviderSpec): void {
    this.router.registerProvider(provider);
  }

  getProviders(): MCPProviderSpec[] {
    return this.router.getProviders();
  }
}

// ---------------------------------------------------------------------------
// NowledgeGraphSync Adapter (T08 — Knowledge ↔ Graph bidirectional sync)
// ---------------------------------------------------------------------------

export class NowledgeGraphSyncAdapter implements INowledgeGraphSync {
  private sync: NowledgeGraphSync;

  constructor(
    knowledgeService: IKnowledgeService,
    graphEngine: IGraphEngine,
    eventBus?: IEventBus,
    conflictBridge?: IConflictNowledgeBridge,
  ) {
    this.sync = new NowledgeGraphSync({
      knowledgeService,
      graphEngine,
      eventBus,
      conflictBridge,
    });
  }

  async syncEntityToGraph(entityId: string): Promise<import('../services/nowledge-graph-sync').SyncResult> {
    return this.sync.syncEntityToGraph(entityId);
  }

  async syncRelationToGraph(relationId: string): Promise<import('../services/nowledge-graph-sync').SyncResult> {
    return this.sync.syncRelationToGraph(relationId);
  }

  async syncGraphToKnowledge(graphNodeId: string): Promise<import('../services/nowledge-graph-sync').SyncResult> {
    return this.sync.syncGraphToKnowledge(graphNodeId);
  }

  async syncAll(direction: 'to-graph' | 'to-knowledge' | 'bidirectional'): Promise<import('../services/nowledge-graph-sync').BatchSyncResult> {
    return this.sync.syncAll(direction);
  }

  async getSyncStatus(entityId: string): Promise<import('../services/nowledge-graph-sync').SyncStatus> {
    return this.sync.getSyncStatus(entityId);
  }
}

// ---------------------------------------------------------------------------
// ObsidianKnowledgeSync Adapter (Obsidian ↔ Knowledge bidirectional sync)
// ---------------------------------------------------------------------------

export class ObsidianKnowledgeSyncAdapter implements IObsidianKnowledgeSync {
  private impl: ObsidianKnowledgeSyncImpl;

  constructor(
    obsidianService: IObsidianService,
    knowledgeService: IKnowledgeService,
    eventBus: IEventBus,
    conflictBridge?: IConflictNowledgeBridge,
    config?: Partial<import('../services/obsidian-knowledge-sync').ObsidianSyncConfig> & { vaultRoot?: string },
  ) {
    this.impl = new ObsidianKnowledgeSyncImpl({
      obsidianService,
      knowledgeService,
      eventBus,
      conflictBridge,
      config,
    });
  }

  async startSync(): Promise<void> {
    await this.impl.startSync();
  }

  stopSync(): void {
    this.impl.stopSync();
  }

  async syncVaultToKnowledge(vaultPath: string): Promise<SyncDirectionResult> {
    return this.impl.syncVaultToKnowledge(vaultPath);
  }

  async syncKnowledgeToVault(entityId: string): Promise<SyncDirectionResult> {
    return this.impl.syncKnowledgeToVault(entityId);
  }

  getSyncStatus(): { running: boolean; lastVaultSync: number | null; lastKnowledgeSync: number | null; pendingConflicts: number } {
    return this.impl.getSyncStatus();
  }

  async resolveConflict(conflictId: string, resolution: 'vault' | 'knowledge' | 'merge'): Promise<void> {
    await this.impl.resolveConflict(conflictId, resolution);
  }
}

// ---------------------------------------------------------------------------
// LLMFallbackChain Adapter
// ---------------------------------------------------------------------------

import { CircuitBreakerRegistry } from '../services/circuit-breaker';
import { ProviderType } from '../services/llm-service';
import type { LLMProvider } from '../protocols/llm';

export class LLMFallbackChainAdapter implements ILLMFallbackChain {
  private impl: LLMFallbackChainImpl;

  constructor(
    circuitBreakerRegistry?: CircuitBreakerRegistry,
    providers?: Map<ProviderType, LLMProvider>,
    config?: Partial<FallbackChainConfig>,
    eventBus?: IEventBus,
  ) {
    this.impl = new LLMFallbackChainImpl(
      circuitBreakerRegistry ?? new CircuitBreakerRegistry(),
      providers ?? new Map(),
      config ?? {},
      eventBus,
    );
  }

  async executeWithFallback<T>(
    operation: (provider: LLMProvider) => Promise<T>,
    operationName: string,
    preferredProvider?: ProviderType,
  ): Promise<T> {
    return this.impl.executeWithFallback(operation, operationName, preferredProvider);
  }

  getLatencyStats(): Record<string, { avgMs: number; p95Ms: number; callCount: number }> {
    return this.impl.getLatencyStats();
  }

  getChainConfig(): FallbackChainConfig {
    return this.impl.getChainConfig();
  }
}

// ---------------------------------------------------------------------------
// EventLog Adapter
// ---------------------------------------------------------------------------

export class EventLogAdapter implements IEventLog {
  private impl: EventLogImpl;

  constructor(options?: { maxRetention?: number }) {
    this.impl = new EventLogImpl(options);
  }

  append(channel: string, payload: unknown): number {
    return this.impl.append(channel, payload);
  }

  getEvents(options?: {
    fromSeq?: number;
    toSeq?: number;
    channel?: string;
    limit?: number;
  }): import('../services/event-log').StoredEvent[] {
    return this.impl.getEvents(options);
  }

  replayFrom(options: {
    fromSeq?: number;
    fromTimestamp?: number;
    channel?: string;
    limit?: number;
  }): import('../services/event-log').StoredEvent[] {
    return this.impl.replayFrom(options);
  }

  getLatestSeq(): number {
    return this.impl.getLatestSeq();
  }

  clear(): void {
    this.impl.clear();
  }
}

// ---------------------------------------------------------------------------
// DeadLetterQueue Adapter
// ---------------------------------------------------------------------------

export class DeadLetterQueueAdapter implements IDeadLetterQueue {
  private impl: DeadLetterQueueImpl;

  constructor(options?: { maxEntries?: number; eventBus?: IEventBus }) {
    this.impl = new DeadLetterQueueImpl(options);
  }

  record(entry: import('../services/dead-letter-queue').DeadLetterEntry): void {
    this.impl.record(entry);
  }

  getEntries(options?: {
    channel?: string;
    limit?: number;
    since?: number;
  }): import('../services/dead-letter-queue').DeadLetterEntry[] {
    return this.impl.getEntries(options);
  }

  async retry(entryId: string): Promise<void> {
    await this.impl.retry(entryId);
  }

  async retryAll(channel?: string): Promise<void> {
    await this.impl.retryAll(channel);
  }

  purge(entryIds?: string[]): void {
    this.impl.purge(entryIds);
  }

  getSize(): number {
    return this.impl.getSize();
  }
}

// ---------------------------------------------------------------------------
// MCPServiceDiscovery Adapter
// ---------------------------------------------------------------------------

export class MCPServiceDiscoveryAdapter implements IMCPServiceDiscovery {
  private impl: MCPServiceDiscoveryImpl;

  constructor(router: IMCPRequestRouter, eventBus: IEventBus, config?: DiscoveryConfig) {
    this.impl = new MCPServiceDiscoveryImpl(router, eventBus, config);
  }

  async start(): Promise<void> {
    await this.impl.start();
  }

  stop(): void {
    this.impl.stop();
  }

  async discoverProviders(): Promise<import('../gateway/service-discovery').DiscoveredProvider[]> {
    return this.impl.discoverProviders();
  }

  getDiscoveredProviders(): import('../gateway/service-discovery').DiscoveredProvider[] {
    return this.impl.getDiscoveredProviders();
  }
}

// ---------------------------------------------------------------------------
// MCPHealthMonitor Adapter
// ---------------------------------------------------------------------------

export class MCPHealthMonitorAdapter implements IMCPHealthMonitor {
  private impl: MCPHealthMonitorImpl;

  constructor(
    router: IMCPRequestRouter,
    circuitBreakerRegistry: CircuitBreakerRegistry,
    eventBus: IEventBus,
    config?: HealthMonitorConfig,
  ) {
    this.impl = new MCPHealthMonitorImpl(router, circuitBreakerRegistry, eventBus, config);
  }

  async start(): Promise<void> {
    await this.impl.start();
  }

  stop(): void {
    this.impl.stop();
  }

  async probeProvider(providerName: string): Promise<HealthProbeResult> {
    return this.impl.probeProvider(providerName);
  }

  async probeAllProviders(): Promise<Record<string, HealthProbeResult>> {
    return this.impl.probeAllProviders();
  }

  getHealthStatus(): Record<string, ProviderHealthState> {
    return this.impl.getHealthStatus();
  }
}

// ---------------------------------------------------------------------------
// SearchRelevanceScorer Adapter
// ---------------------------------------------------------------------------

export class SearchRelevanceScorerAdapter implements ISearchRelevanceScorer {
  private impl: SearchRelevanceScorerImpl;
  private readonly config: ScoringConfigImpl;

  constructor(config?: Partial<ScoringConfigImpl>) {
    this.config = config
      ? { ...DEFAULT_SCORING_CONFIG, ...config }
      : DEFAULT_SCORING_CONFIG;
    this.impl = new SearchRelevanceScorerImpl();
  }

  score(results: ScoredResult[], query: string, config?: ScoringConfig): ScoredResult[] {
    const effectiveConfig = config ?? this.config as ScoringConfig;
    return this.impl.score(results, query, effectiveConfig);
  }

  recordSelection(resultId: string, query: string): void {
    this.impl.recordSelection(resultId, query);
  }

  getSelectionStats(): Record<string, { query: string; selectedCount: number }> {
    return this.impl.getSelectionStats();
  }
}

// ---------------------------------------------------------------------------
// SearchCacheManager Adapter
// ---------------------------------------------------------------------------

export class SearchCacheManagerAdapter implements ISearchCacheManager {
  private impl: SearchCacheManagerImpl;

  constructor(
    config?: Partial<CacheConfigImpl>,
    eventBus?: IEventBus,
    warmupFn?: WarmupFn,
  ) {
    this.impl = new SearchCacheManagerImpl(
      { ...DEFAULT_CACHE_CONFIG, ...config },
      eventBus,
      warmupFn,
    );
  }

  get(query: string): import('../search/cache-manager').CachedSearchResult | null {
    return this.impl.get(query);
  }

  set(query: string, results: import('../search/cache-manager').CachedSearchResult): void {
    this.impl.set(query, results);
  }

  invalidate(query: string): boolean {
    return this.impl.invalidate(query);
  }

  invalidateBySource(source: string): number {
    return this.impl.invalidateBySource(source);
  }

  invalidateAll(): void {
    this.impl.invalidateAll();
  }

  async warmup(): Promise<void> {
    await this.impl.warmup();
  }

  getStats(): { size: number; maxSize: number; hitRate: number; evictionCount: number } {
    return this.impl.getStats();
  }

  dispose(): void {
    this.impl.dispose();
  }
}

// ---------------------------------------------------------------------------
// ResultAggregator Adapter
// ---------------------------------------------------------------------------

export class ResultAggregatorAdapter implements IParallelResultAggregator {
  private impl: ParallelResultAggregatorImpl;

  constructor(eventBus?: IEventBus) {
    this.impl = new ParallelResultAggregatorImpl(undefined, eventBus);
  }

  /** Set or replace the DelegateBroker (enables aggregateWithTimeout) */
  setBroker(broker: DelegateBroker): void {
    this.impl.setBroker(broker);
  }

  aggregate(results: SubTaskResult[], config: AggregationConfig): AggregatedResult {
    return this.impl.aggregate(results, config);
  }

  aggregateWithTimeout(spec: SubPlanSpec, config: AggregationConfig): Promise<AggregatedResult> {
    return this.impl.aggregateWithTimeout(spec, config);
  }
}

// ---------------------------------------------------------------------------
// QualityGateFeedbackLoop Adapter
// ---------------------------------------------------------------------------

export class QualityGateFeedbackLoopAdapter implements IQualityGateFeedbackLoop {
  private impl: QualityGateFeedbackLoopImpl;

  constructor(
    eventBus: IEventBus,
    dispatcher?: import('../workflow/delegate/sub-plan.js').SubPlanDispatcher,
    aggregator?: IParallelResultAggregator,
    config?: Partial<FeedbackLoopConfig>,
  ) {
    this.impl = new QualityGateFeedbackLoopImpl(eventBus, dispatcher, aggregator, config);
  }

  detectGaps(verificationResult: { gaps: VerificationGap[] }): VerificationGap[] {
    return this.impl.detectGaps(verificationResult);
  }

  generateRemediation(gaps: VerificationGap[]): RemediationPlan[] {
    return this.impl.generateRemediation(gaps);
  }

  async executeRemediation(plan: RemediationPlan): Promise<RemediationResult> {
    return this.impl.executeRemediation(plan);
  }

  async runFeedbackLoop(verificationResult: { gaps: VerificationGap[] }): Promise<FeedbackLoopResult> {
    return this.impl.runFeedbackLoop(verificationResult);
  }

  getActiveRemediations(): RemediationPlan[] {
    return this.impl.getActiveRemediations();
  }

  escalate(gap: VerificationGap, reason: string): void {
    this.impl.escalate(gap, reason);
  }
}

// ---------------------------------------------------------------------------
// WaveExecutionEngine Adapter
// ---------------------------------------------------------------------------

export class WaveExecutionEngineAdapter implements IWaveExecutionEngine {
  private impl: WaveExecutionEngineImpl;

  constructor(
    eventBus: IEventBus,
    aggregator?: IParallelResultAggregator,
    config?: Partial<WaveExecutionConfig>,
  ) {
    this.impl = new WaveExecutionEngineImpl(eventBus, aggregator, config);
  }

  async executeWaves(waves: WaveSpec[], taskExecutor: (taskId: string) => Promise<void>): Promise<WaveResult[]> {
    return this.impl.executeWaves(waves, taskExecutor);
  }

  async executeWave(wave: WaveSpec, taskExecutor: (taskId: string) => Promise<void>): Promise<WaveResult> {
    return this.impl.executeWave(wave, taskExecutor);
  }

  getWaveStatus(): WaveResult[] {
    return this.impl.getWaveStatus();
  }

  cancelWave(waveNumber: number): void {
    this.impl.cancelWave(waveNumber);
  }
}

// ---------------------------------------------------------------------------
// GraphWikiLinkBridge Adapter (Graph entity ID ↔ Wiki page path resolution)
// ---------------------------------------------------------------------------

export class GraphWikiLinkBridgeAdapter implements IGraphWikiLinkBridge {
  private impl: GraphWikiLinkBridgeImpl;

  constructor(
    graphEngine: IGraphEngine,
    obsidianService: IObsidianService,
    eventBus: IEventBus,
    vaultPath?: string,
  ) {
    this.impl = new GraphWikiLinkBridgeImpl({
      graphEngine,
      obsidianService,
      eventBus,
      vaultPath,
    });
  }

  async resolveGraphToWiki(entityId: string): Promise<string | null> {
    return this.impl.resolveGraphToWiki(entityId);
  }

  async resolveWikiToGraph(wikiPath: string): Promise<string | null> {
    return this.impl.resolveWikiToGraph(wikiPath);
  }

  async resolveWikiLinks(wikiPath: string): Promise<Array<{ linkText: string; entityId: string | null }>> {
    return this.impl.resolveWikiLinks(wikiPath);
  }

  async rebuildIndex(): Promise<number> {
    return this.impl.rebuildIndex();
  }

  async detectOrphanedLinks(): Promise<OrphanedLink[]> {
    return this.impl.detectOrphanedLinks();
  }

  getLinkIndex(): LinkIndexEntry[] {
    return this.impl.getLinkIndex();
  }

  async checkIntegrity(): Promise<IntegrityReport> {
    return this.impl.checkIntegrity();
  }
}
