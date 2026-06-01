import type { NowledgeMemMemory, NowledgeMemSearchResult } from '../protocols/nowledge-mem'

/** 简化的 Nowledge Mem API 接口 — 仅包含实际使用的方法 */
export interface ISimpleNowledgeMemApi {
  readonly isHealthy: boolean
  checkHealth(): Promise<boolean>
  addMemory(content: string, options?: {
    labels?: string[];
    importance?: number;
    id?: string;
    title?: string;
    unitType?: 'note' | 'decision' | 'learning' | 'reference' | 'task' | 'code' | 'concept' | 'metric';
    when?: string;
    eventStart?: string;
    eventEnd?: string;
    sourceRefs?: string[];
    spaceId?: string;
  }): Promise<NowledgeMemMemory>
  getMemory(id: string): Promise<{ id: string; content: string; labels: string[]; importance: number } | null>
  searchMemories(query: string, options?: {
    labels?: string[];
    timeRange?: 'today' | 'week' | 'month' | 'year';
    importance?: number;
    mode?: 'normal' | 'deep';
    limit?: number;
    unitType?: string;
    eventFrom?: string;
    eventTo?: string;
    recordedFrom?: string;
    recordedTo?: string;
    spaceId?: string;
  }): Promise<NowledgeMemSearchResult>
  deleteMemory(id: string): Promise<boolean>
  listCrystals(opts?: { query?: string; tags?: string[] }): Promise<Array<{ slug: string; title: string; tags: string[] }>>
  getCrystal(slug: string): Promise<{ slug: string; title: string; content: string; tags: string[]; sources: string[] } | null>
  getEntities(opts?: { type?: string; query?: string }): Promise<Array<{ id: string; entity_type: string; name: string; description: string; aliases: string[] }>>
  graphSearch(query: string, opts?: { depth?: number; limit?: number }): Promise<Array<{ id: string; name: string; score: number; path: string[] }>>
  temporalQuery(opts: { event_time?: string; recorded_after?: string; fuzzy?: boolean }): Promise<Array<{ id: string; content: string; event_time: string; recorded_at: string }>>
  getContradictions(): Promise<Array<{ memory_a: string; memory_b: string; description: string }>>
  getEvolutionChains(entityId: string): Promise<Array<{ memory_id: string; evolves_kind: string; strength: number }>>
}

export interface NowledgeMemConfig {
  host: string
  port: number
  timeout: number
  retryCount: number
  retryDelay: number
}

const DEFAULT_CONFIG: NowledgeMemConfig = {
  host: '127.0.0.1',
  port: 19828,
  timeout: 10000,
  retryCount: 2,
  retryDelay: 1000,
}

export class NowledgeMemHTTPClient implements ISimpleNowledgeMemApi {
  private config: NowledgeMemConfig
  private baseUrl: string
  private healthy = false

  constructor(config: Partial<NowledgeMemConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.baseUrl = `http://${this.config.host}:${this.config.port}/api/v1`
    this.checkHealth().then(h => { this.healthy = h })
  }

  get isHealthy(): boolean { return this.healthy }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl.replace('/api/v1', '')}/health`, {
        signal: AbortSignal.timeout(3000),
      })
      this.healthy = res.ok
      return this.healthy
    } catch {
      this.healthy = false
      return false
    }
  }

  private async request<T>(path: string, opts?: RequestInit): Promise<T> {
    for (let attempt = 0; attempt <= this.config.retryCount; attempt++) {
      try {
        const res = await fetch(`${this.baseUrl}${path}`, {
          ...opts,
          signal: AbortSignal.timeout(this.config.timeout),
          headers: { 'Content-Type': 'application/json', ...opts?.headers },
        })
        if (!res.ok) {
          if (res.status >= 500 && attempt < this.config.retryCount) {
            await this.delay(this.config.retryDelay * (attempt + 1))
            continue
          }
          throw new Error(`Nowledge Mem API ${res.status}: ${await res.text()}`)
        }
        return (await res.json()) as T
      } catch (err) {
        if (attempt === this.config.retryCount) {
          this.healthy = false
          throw err
        }
        await this.delay(this.config.retryDelay * (attempt + 1))
      }
    }
    throw new Error('unreachable')
  }

  private delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms))
  }

  // === Memory CRUD ===
  async addMemory(content: string, options?: {
    labels?: string[];
    importance?: number;
    id?: string;
    title?: string;
    unitType?: 'note' | 'decision' | 'learning' | 'reference' | 'task' | 'code' | 'concept' | 'metric';
    when?: string;
    eventStart?: string;
    eventEnd?: string;
    sourceRefs?: string[];
    spaceId?: string;
  }): Promise<NowledgeMemMemory> {
    return this.request<NowledgeMemMemory>('/memories', {
      method: 'POST',
      body: JSON.stringify({ content, ...options }),
    })
  }

  async getMemory(id: string) {
    return this.request<{ id: string; content: string; labels: string[]; importance: number } | null>(`/memories/${id}`)
  }

  async searchMemories(query: string, options?: {
    labels?: string[];
    timeRange?: 'today' | 'week' | 'month' | 'year';
    importance?: number;
    mode?: 'normal' | 'deep';
    limit?: number;
    unitType?: string;
    eventFrom?: string;
    eventTo?: string;
    recordedFrom?: string;
    recordedTo?: string;
    spaceId?: string;
  }): Promise<NowledgeMemSearchResult> {
    return this.request<NowledgeMemSearchResult>('/memories/search', {
      method: 'POST',
      body: JSON.stringify({ query, ...options }),
    })
  }

  async deleteMemory(id: string): Promise<boolean> {
    await this.request<void>(`/memories/${id}`, { method: 'DELETE' })
    return true
  }

  // === Crystal / LLM Wiki ===
  async listCrystals(opts?: { query?: string; tags?: string[] }) {
    return this.request<Array<{ slug: string; title: string; tags: string[] }>>('/crystals', {
      method: 'POST',
      body: JSON.stringify(opts ?? {}),
    })
  }

  async getCrystal(slug: string) {
    return this.request<{ slug: string; title: string; content: string; tags: string[]; sources: string[] } | null>(`/crystals/${slug}`)
  }

  // === Entities ===
  async getEntities(opts?: { type?: string; query?: string }) {
    return this.request<Array<{ id: string; entity_type: string; name: string; description: string; aliases: string[] }>>('/entities', {
      method: 'POST',
      body: JSON.stringify(opts ?? {}),
    })
  }

  // === Graph Search ===
  async graphSearch(query: string, opts?: { depth?: number; limit?: number }) {
    return this.request<Array<{ id: string; name: string; score: number; path: string[] }>>('/graph/search', {
      method: 'POST',
      body: JSON.stringify({ query, ...opts }),
    })
  }

  // === Temporal ===
  async temporalQuery(opts: { event_time?: string; recorded_after?: string; fuzzy?: boolean }) {
    return this.request<Array<{ id: string; content: string; event_time: string; recorded_at: string }>>('/memories/temporal', {
      method: 'POST',
      body: JSON.stringify(opts),
    })
  }

  // === Background Intelligence ===
  async getContradictions() {
    return this.request<Array<{ memory_a: string; memory_b: string; description: string }>>('/intelligence/contradictions')
  }

  async getEvolutionChains(entityId: string) {
    return this.request<Array<{ memory_id: string; evolves_kind: string; strength: number }>>(`/entities/${entityId}/evolutions`)
  }
}
