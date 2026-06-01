import type { NarrativeEngine } from './narrative-engine'
import type { KnowledgeBridgeV2 } from './knowledge-bridge-v2'
import type { WritingContext } from './writing-context-aggregator'
import { aggregateWritingContext } from './writing-context-aggregator'

export interface PlotSuggestion {
  action: string
  reason: string
  affectedEntities: string[]
  foreshadowOpportunities?: string[]
}

export interface ContinuityIssue {
  type: 'timeline' | 'character_state' | 'foreshadow_gap' | 'worldview_violation'
  description: string
  severity: 'error' | 'warning' | 'info'
  suggestion?: string
}

export class NarrativeAgent {
  constructor(
    private engine: NarrativeEngine,
    private bridge: KnowledgeBridgeV2,
  ) {}

  /** 获取写作上下文 */
  async getWritingContext(chapter: number, lastText?: string): Promise<WritingContext> {
    return aggregateWritingContext(this.engine, this.bridge, chapter, lastText)
  }

  /** 建议后续情节 */
  async suggestPlot(action: string, chapter: number): Promise<PlotSuggestion[]> {
    const context = await this.getWritingContext(chapter)
    const suggestions: PlotSuggestion[] = []

    // 基于伏笔提醒
    for (const f of context.pendingForeshadows) {
      if (f.urgency === 'due' || f.urgency === 'overdue') {
        suggestions.push({
          action: `回收伏笔: ${f.hint}`,
          reason: `第${f.plantedAt}章埋设的伏笔已${f.urgency === 'overdue' ? '过期' : '到期'}`,
          affectedEntities: [f.foreshadowId],
          foreshadowOpportunities: [f.foreshadowId],
        })
      }
    }

    // 基于矛盾
    for (const c of context.contradictions) {
      suggestions.push({
        action: `解决矛盾: ${c.description}`,
        reason: '知识层检测到叙事矛盾',
        affectedEntities: [],
      })
    }

    // 基于质量评分
    if (context.lastQualityScore !== null && context.lastQualityScore < 70) {
      suggestions.push({
        action: '提升本章质量',
        reason: `当前质量评分 ${context.lastQualityScore}/100`,
        affectedEntities: [],
      })
    }

    return suggestions
  }

  /** 检查连贯性 */
  async checkContinuity(chapter: number): Promise<ContinuityIssue[]> {
    const context = await this.getWritingContext(chapter)
    const issues: ContinuityIssue[] = []

    // 检查过期伏笔
    for (const f of context.pendingForeshadows) {
      if (f.urgency === 'overdue') {
        issues.push({
          type: 'foreshadow_gap',
          description: `伏笔 "${f.hint}" 已过期 ${Math.abs(f.chaptersUntilDue)} 章未回收`,
          severity: 'warning',
          suggestion: '考虑在近期章节回收或显式放弃该伏笔',
        })
      }
    }

    // 检查矛盾
    for (const c of context.contradictions) {
      issues.push({
        type: 'worldview_violation',
        description: c.description,
        severity: 'warning',
      })
    }

    return issues
  }
}
