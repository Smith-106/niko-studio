/**
 * MCP Servers module - Standalone MCP Server implementations
 *
 * Migrated from src/mcp_servers/.
 */

// ============================================================
// Types
// ============================================================

export interface MemoryEntry {
  id: string;
  content: string;
  layer: 'session' | 'working' | 'long_term';
  source: string;
  sessionId: string | null;
  timestamp: number;
  metadata: Record<string, unknown>;
}

export interface MemorySearchResult {
  id: string;
  content: string;
  score: number;
  layer: string;
  source: string;
}

export interface ThinkingStep {
  id: string;
  thought: string;
  type: 'reasoning' | 'analysis' | 'critique' | 'synthesis';
  confidence: number;
  relatedSteps: string[];
}

export interface ThinkingSession {
  id: string;
  steps: ThinkingStep[];
  createdAt: number;
  status: 'active' | 'completed' | 'abandoned';
  conclusion: string | null;
}

// ============================================================
// Memory MCP Server
// ============================================================

export class MemoryMcpServer {
  private memories: Map<string, MemoryEntry> = new Map();
  private sessionId: string | null = null;

  constructor(sessionId?: string) {
    this.sessionId = sessionId ?? null;
  }

  async addMemory(params: {
    content: string;
    layer?: string;
    source?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ id: string }> {
    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const entry: MemoryEntry = {
      id,
      content: params.content,
      layer: (params.layer as MemoryEntry['layer']) || 'session',
      source: params.source || 'user',
      sessionId: params.sessionId ?? this.sessionId,
      timestamp: Date.now(),
      metadata: params.metadata ?? {},
    };
    this.memories.set(id, entry);
    return { id };
  }

  async searchMemories(params: {
    query: string;
    scope?: string;
    limit?: number;
  }): Promise<MemorySearchResult[]> {
    const query = params.query.toLowerCase();
    const limit = params.limit ?? 10;
    const results: MemorySearchResult[] = [];

    for (const [id, entry] of this.memories) {
      if (entry.content.toLowerCase().includes(query)) {
        results.push({
          id,
          content: entry.content,
          score: 1.0,
          layer: entry.layer,
          source: entry.source,
        });
        if (results.length >= limit) break;
      }
    }

    return results;
  }

  async getMemory(id: string): Promise<MemoryEntry | null> {
    return this.memories.get(id) ?? null;
  }

  async deleteMemory(id: string): Promise<boolean> {
    return this.memories.delete(id);
  }

  async listMemories(params: {
    layer?: string;
    limit?: number;
    offset?: number;
  }): Promise<MemoryEntry[]> {
    let entries = Array.from(this.memories.values());

    if (params.layer) {
      entries = entries.filter(e => e.layer === params.layer);
    }

    const offset = params.offset ?? 0;
    const limit = params.limit ?? 20;
    return entries.slice(offset, offset + limit);
  }

  getMemoryCount(): number {
    return this.memories.size;
  }

  clear(): void {
    this.memories.clear();
  }
}

// ============================================================
// Sequential Thinking MCP Server
// ============================================================

export class SequentialThinkingServer {
  private sessions: Map<string, ThinkingSession> = new Map();

  async createSession(): Promise<ThinkingSession> {
    const id = `think_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const session: ThinkingSession = {
      id,
      steps: [],
      createdAt: Date.now(),
      status: 'active',
      conclusion: null,
    };
    this.sessions.set(id, session);
    return session;
  }

  async addStep(params: {
    sessionId: string;
    thought: string;
    type?: string;
    confidence?: number;
    relatedSteps?: string[];
  }): Promise<ThinkingStep> {
    const session = this.sessions.get(params.sessionId);
    if (!session) throw new Error(`Session not found: ${params.sessionId}`);

    const step: ThinkingStep = {
      id: `step_${session.steps.length + 1}`,
      thought: params.thought,
      type: (params.type as ThinkingStep['type']) || 'reasoning',
      confidence: params.confidence ?? 0.5,
      relatedSteps: params.relatedSteps ?? [],
    };

    session.steps.push(step);
    return step;
  }

  async getSession(sessionId: string): Promise<ThinkingSession | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async concludeSession(params: {
    sessionId: string;
    conclusion: string;
  }): Promise<ThinkingSession> {
    const session = this.sessions.get(params.sessionId);
    if (!session) throw new Error(`Session not found: ${params.sessionId}`);

    session.status = 'completed';
    session.conclusion = params.conclusion;
    return session;
  }

  async listSessions(): Promise<ThinkingSession[]> {
    return Array.from(this.sessions.values());
  }

  getActiveSessionCount(): number {
    return Array.from(this.sessions.values()).filter(s => s.status === 'active').length;
  }
}
