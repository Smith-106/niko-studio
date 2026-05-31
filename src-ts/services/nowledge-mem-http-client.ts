import type { INowledgeMemService } from '../protocols/nowledge-mem'

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

export class NowledgeMemHTTPClient implements INowledgeMemService {
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
  async addMemory(input: { content: string; labels?: string[]; importance?: number }) {
    return this.request<string>('/memories', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  async getMemory(id: string) {
    return this.request<{ id: string; content: string; labels: string[]; importance: number } | null>(`/memories/${id}`)
  }

  async searchMemories(query: string, opts?: { limit?: number; threshold?: number }) {
    return this.request<Array<{ id: string; content: string; score: number }>>('/memories/search', {
      method: 'POST',
      body: JSON.stringify({ query, ...opts }),
    })
  }

  async deleteMemory(id: string) {
    await this.request<void>(`/memories/${id}`, { method: 'DELETE' })
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
