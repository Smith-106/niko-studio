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
} from './types';
import { AgentType } from './types';
import { createIntegrationAdapters, type IntegrationAdapterBundle } from '../integrations';
import { UnifiedMemoryEngine } from '../memory/unified-memory';
import { GraphEngine } from '../graph/graph-engine';
import { createIterativeRetriever, type IterativeRetriever } from '../search';
import { CriticEngine } from '../narrative/evaluators/critic-engine';
import { WorkflowEngine } from '../workflow/workflow-engine';
import { AgentFactory } from '../agents/factory';
import {
  AgentType as BaseAgentType,
  type IAgentLLMService,
} from '../agents/base';
import { createWriterInput } from '../agents/writer';
import { BackupManager } from '../services/backup-manager';
import { TokenService } from '../services/token-service';
import { ObsidianService } from '../services/obsidian-service';

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
      const results = await this.engine.searchEntitiesByName('unknown', id, 1);
      return results.length > 0 ? results[0] : null;
    } catch {
      return null;
    }
  }

  async traverse(startId: string, depth?: number): Promise<unknown[]> {
    try {
      return await this.engine.executeCypher(
        `MATCH (n)-[r*1..${depth ?? 3}]-(m) WHERE n.name CONTAINS '${startId}' RETURN m, r`
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
      const haystack = `${document.id} ${document.content} ${JSON.stringify(document.metadata ?? {})}`.toLowerCase();
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

  constructor(engine?: WorkflowEngine) {
    this.engine = engine ?? new WorkflowEngine();
  }

  createRuntime(params: { workspace: string; sessionNamespace: string }): WorkflowEngine {
    return new WorkflowEngine(params.workspace, params.sessionNamespace);
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
    this.engine = new WorkflowEngine();
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

  constructor() {
    this.factory = new AgentFactory();
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

  constructor() {
    this.service = new ObsidianService();
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
    const result = this.service.syncToKnowledgeLayer(vaultPath, {
      syncFile: () => ({ success: true }),
      addDocument: () => {},
    });
    return {
      added: ((result as Record<string, unknown>).syncedCount as number) ?? 0,
      modified: 0,
      deleted: 0,
    };
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
