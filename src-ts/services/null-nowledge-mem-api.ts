import type { ISimpleNowledgeMemApi } from './nowledge-mem-http-client'
import type { NowledgeMemMemory, NowledgeMemSearchResult } from '../protocols/nowledge-mem'

/** 离线降级：Nowledge Mem 不可用时使用 */
export class NullNowledgeMemAPI implements ISimpleNowledgeMemApi {
  readonly isHealthy = false

  async checkHealth(): Promise<boolean> { return false }

  async addMemory(_content: string, _options?: {
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
  }): Promise<NowledgeMemMemory> { throw new Error('Nowledge Mem offline') }
  async getMemory(_id: string) { return null }
  async searchMemories(_query: string, _options?: {
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
  }): Promise<NowledgeMemSearchResult> { return { memories: [] } }
  async deleteMemory(_id: string): Promise<boolean> { throw new Error('Nowledge Mem offline') }
  async listCrystals() { return [] }
  async getCrystal() { return null }
  async getEntities() { return [] }
  async graphSearch() { return [] }
  async temporalQuery() { return [] }
  async getContradictions() { return [] }
  async getEvolutionChains() { return [] }
}
