import type { KnowledgeBridgeV2 } from './knowledge-bridge-v2'

/**
 * Wiki 兼容层 — 将旧的 Wiki API 调用重定向到 KnowledgeBridgeV2 + Nowledge Mem Crystal
 * @deprecated 使用 NarrativeEngine 和 KnowledgeBridgeV2 替代
 */

export interface WikiPageCompat {
  slug: string
  title: string
  content: string
  tags: string[]
  sources: string[]
  updatedAt: number
}

export class WikiCompatLayer {
  constructor(private bridge: KnowledgeBridgeV2) {}

  /** @deprecated 使用 bridge.pullEntities() 或 Nowledge Mem listCrystals() */
  async listPages(query?: string): Promise<WikiPageCompat[]> {
    if (!this.bridge.isOnline()) return []
    const crystals = await (this.bridge as any).api?.listCrystals?.({ query }) ?? []
    return crystals.map((c: any) => ({
      slug: c.slug ?? c.id,
      title: c.title ?? c.name,
      content: c.content ?? '',
      tags: c.tags ?? [],
      sources: c.sources ?? [],
      updatedAt: Date.now(),
    }))
  }

  /** @deprecated 使用 Nowledge Mem getCrystal() */
  async getPage(slug: string): Promise<WikiPageCompat | null> {
    if (!this.bridge.isOnline()) return null
    const crystal = await (this.bridge as any).api?.getCrystal?.(slug)
    if (!crystal) return null
    return {
      slug: crystal.slug ?? crystal.id,
      title: crystal.title ?? crystal.name,
      content: crystal.content ?? '',
      tags: crystal.tags ?? [],
      sources: crystal.sources ?? [],
      updatedAt: Date.now(),
    }
  }

  /** @deprecated 使用 NarrativeEngine.addEntity() + bridge.pushEntity() */
  async promotePage(_title: string, _content: string, _tags?: string[]): Promise<string> {
    // 提升到 Nowledge Mem Crystal
    if (!this.bridge.isOnline()) throw new Error('Knowledge layer offline')
    const id = await (this.bridge as any).api?.addMemory?.({
      content: _content,
      labels: _tags ?? [],
      importance: 0.7,
    })
    return id ?? ''
  }
}
