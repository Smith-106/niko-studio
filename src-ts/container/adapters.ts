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
  AgentType,
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
import { UnifiedMemoryEngine } from '../memory/unified-memory';
import { GraphEngine } from '../graph/graph-engine';
import { WorkflowEngine } from '../workflow/workflow-engine';
import { AgentFactory } from '../agents/factory';
import { BackupManager } from '../services/backup-manager';
import { TokenService } from '../services/token-service';
import { ObsidianService } from '../services/obsidian-service';

// ---------------------------------------------------------------------------
// MemoryEngine Adapter
// ---------------------------------------------------------------------------

export class MemoryEngineAdapter implements IMemoryEngine {
  private engine: UnifiedMemoryEngine;

  constructor() {
    this.engine = new UnifiedMemoryEngine({ dbPath: '.writing/memory.db' });
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

  async retrieve(key: string): Promise<unknown> {
    const results = await this.engine.search({ query: key, limit: 1 });
    return results.length > 0 ? results[0] : undefined;
  }

  async search(query: string, limit?: number): Promise<unknown[]> {
    return this.engine.search({ query, limit: limit ?? 10 });
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
}

// ---------------------------------------------------------------------------
// SearchEngine Adapter
// ---------------------------------------------------------------------------

export class SearchEngineAdapter implements ISearchEngine {
  async initialize(): Promise<void> {}

  async search(_query: string, _options?: SearchOptions): Promise<SearchResult[]> {
    return [];
  }

  async index(_document: { id: string; content: string; metadata?: Record<string, unknown> }): Promise<void> {}

  async clear(): Promise<void> {}
}

// ---------------------------------------------------------------------------
// WorkflowEngine Adapter
// ---------------------------------------------------------------------------

export class WorkflowEngineAdapter implements IWorkflowEngine {
  private engine: WorkflowEngine;

  constructor() {
    this.engine = new WorkflowEngine();
  }

  async initialize(): Promise<void> {}

  async executeLevel(level: string, context: WorkflowContext): Promise<WorkflowResult> {
    try {
      const result = await this.engine.run(context.sessionId, level);
      return { success: true, output: result };
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
}

// ---------------------------------------------------------------------------
// CriticEngine Adapter
// ---------------------------------------------------------------------------

export class CriticEngineAdapter implements ICriticEngine {
  async initialize(): Promise<void> {}

  async analyze(_content: string): Promise<{ score: number; issues: string[]; strengths: string[]; recommendations: string[] }> {
    return { score: 0, issues: ['CriticAgent not configured — provide LLM service'], strengths: [], recommendations: [] };
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
    const agentResult = this.factory.getAgent(agentType as unknown as import('../agents/base').AgentType, {
      name,
      config,
      llmService: llm as unknown as import('../agents/base').IAgentLLMService,
    }) as { execute: (task: string) => Promise<unknown> };
    return {
      execute: async (task: string, _ctx?: Record<string, unknown>) => agentResult.execute(task),
      getName: () => name ?? agentType,
      getType: () => agentType,
    };
  }

  registerMock(agentType: AgentType, mock: IAgent): void {
    this.factory.registerMock(agentType as unknown as import('../agents/base').AgentType, mock);
  }

  reset(): void {
    this.factory = new AgentFactory();
  }
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

  constructor() {
    this.service = new TokenService();
  }

  countTokens(text: string): number {
    return this.service.estimateTokens(text);
  }

  isWithinBudget(sessionId: string, tokens: number): boolean {
    const summary = this.service.getUsageSummary(sessionId);
    const used = (summary[0]?.['total_cost'] as number) ?? 0;
    const budget = this.service['_defaultBudget'];
    return (budget - used) * 1_000_000 >= tokens;
  }

  updateUsage(sessionId: string, tokens: number): void {
    this.service.recordUsage(tokens, 0, 'default', sessionId);
  }

  getUsage(sessionId: string): { used: number; budget: number; remaining: number } {
    const summary = this.service.getUsageSummary(sessionId);
    const used = (summary[0]?.['total_cost'] as number) ?? 0;
    const budget = this.service['_defaultBudget'];
    return { used, budget, remaining: budget - used };
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
