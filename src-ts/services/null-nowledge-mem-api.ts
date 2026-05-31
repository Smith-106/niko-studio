import type { INowledgeMemService } from '../protocols/nowledge-mem'

/** 离线降级：Nowledge Mem 不可用时使用 */
export class NullNowledgeMemAPI implements INowledgeMemService {
  readonly isHealthy = false

  async checkHealth(): Promise<boolean> { return false }

  async addMemory() { throw new Error('Nowledge Mem offline') }
  async getMemory() { return null }
  async searchMemories() { return [] }
  async deleteMemory() { throw new Error('Nowledge Mem offline') }
  async listCrystals() { return [] }
  async getCrystal() { return null }
  async getEntities() { return [] }
  async graphSearch() { return [] }
  async temporalQuery() { return [] }
  async getContradictions() { return [] }
  async getEvolutionChains() { return [] }
}
