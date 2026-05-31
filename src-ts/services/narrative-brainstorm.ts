import type { NarrativeAnalyzer } from './narrative-analyzer'

export interface BrainstormRole {
  id: string
  name: string
  focusDimensions: string[]
  scoringWeights: Record<string, number>
  behavioralTraits: string[]
}

export const NARRATIVE_ROLES: BrainstormRole[] = [
  {
    id: 'plot-architect',
    name: '情节架构师',
    focusDimensions: ['hook', 'cliffhanger', 'pacing', 'foreshadow'],
    scoringWeights: { hook: 0.3, cliffhanger: 0.1, emotion_craft: 0.15, suspense: 0.15, character: 0.1, pacing: 0.1, retention: 0.1 },
    behavioralTraits: ['关注三幕结构', '强调节奏感', '布局伏笔'],
  },
  {
    id: 'character-psychologist',
    name: '角色心理学家',
    focusDimensions: ['character', 'four-selves', 'voice-fingerprint'],
    scoringWeights: { hook: 0.1, cliffhanger: 0.1, emotion_craft: 0.2, suspense: 0.1, character: 0.3, pacing: 0.1, retention: 0.1 },
    behavioralTraits: ['关注角色深度', '检查动机一致性', '评估成长弧线'],
  },
  {
    id: 'suspense-engineer',
    name: '悬疑工程师',
    focusDimensions: ['suspense', 'premise', 'deadly-sins'],
    scoringWeights: { hook: 0.15, cliffhanger: 0.2, emotion_craft: 0.1, suspense: 0.3, character: 0.1, pacing: 0.1, retention: 0.05 },
    behavioralTraits: ['构建信息缺口', '递进威胁', '制造时间压力'],
  },
  {
    id: 'emotion-craftsman',
    name: '情感匠人',
    focusDimensions: ['emotion-craft', 'fictional-dream', 'show-tell'],
    scoringWeights: { hook: 0.1, cliffhanger: 0.1, emotion_craft: 0.35, suspense: 0.1, character: 0.15, pacing: 0.1, retention: 0.1 },
    behavioralTraits: ['追求show-don\'t-tell', '多层次情感', '沉浸感优先'],
  },
  {
    id: 'world-builder',
    name: '世界观构建者',
    focusDimensions: ['worldview-coherence', 'timeline-consistency'],
    scoringWeights: { hook: 0.05, cliffhanger: 0.05, emotion_craft: 0.15, suspense: 0.1, character: 0.15, pacing: 0.1, retention: 0.1, worldview: 0.3 },
    behavioralTraits: ['检查设定自洽', '评估规则一致性', '补全世界细节'],
  },
  {
    id: 'reader-advocate',
    name: '读者代言人',
    focusDimensions: ['reader-satisfaction', 'retention-rhythm', 'satisfaction-density'],
    scoringWeights: { hook: 0.15, cliffhanger: 0.15, emotion_craft: 0.1, suspense: 0.1, character: 0.1, pacing: 0.1, retention: 0.3 },
    behavioralTraits: ['关注爽点密度', '评估钩子强度', '追踪留存节奏'],
  },
  {
    id: 'style-editor',
    name: '风格编辑',
    focusDimensions: ['style-system', 'voice-evaluator', 'subtext'],
    scoringWeights: { hook: 0.1, cliffhanger: 0.1, emotion_craft: 0.2, suspense: 0.05, character: 0.15, pacing: 0.1, retention: 0.1, style: 0.2 },
    behavioralTraits: ['检查文风统一', '评估修辞品质', '分析叙述视角'],
  },
  {
    id: 'continuity-guard',
    name: '连贯性守卫',
    focusDimensions: ['timeline-consistency', 'cross-chapter-character', 'foreshadowing'],
    scoringWeights: { hook: 0.05, cliffhanger: 0.05, emotion_craft: 0.1, suspense: 0.1, character: 0.2, pacing: 0.15, retention: 0.1, continuity: 0.25 },
    behavioralTraits: ['检查时间线', '追踪角色状态', '确保伏笔回收'],
  },
]

export interface RoleAnalysis {
  roleId: string
  roleName: string
  findings: Array<{
    dimension: string
    score: number
    issue?: string
    suggestion?: string
  }>
  weightedScore: number
}

export interface CrossReviewResult {
  conflicts: Array<{ roles: string[]; description: string }>
  synergies: Array<{ roles: string[]; description: string }>
  gaps: Array<{ dimension: string; description: string }>
}

export class NarrativeBrainstorm {
  private analyzer: NarrativeAnalyzer

  constructor(analyzer?: NarrativeAnalyzer) {
    this.analyzer = analyzer ?? new NarrativeAnalyzer()
  }

  /** 并行角色分析 */
  analyzeWithRoles(text: string, roles: BrainstormRole[] = NARRATIVE_ROLES): RoleAnalysis[] {
    const report = this.analyzer.generateQualityReport(text)
    return roles.map(role => {
      const findings = role.focusDimensions.map(dim => {
        const score = report.dimensions[dim] ?? 0
        const issue = score < 50 ? `${dim} 评分偏低 (${score})` : undefined
        const suggestion = score < 50 ? `建议提升 ${dim} 维度` : undefined
        return { dimension: dim, score, issue, suggestion }
      })

      // 计算加权分
      let weightedScore = 0
      let totalWeight = 0
      for (const [dim, weight] of Object.entries(role.scoringWeights)) {
        weightedScore += (report.dimensions[dim] ?? 50) * weight
        totalWeight += weight
      }
      weightedScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0

      return { roleId: role.id, roleName: role.name, findings, weightedScore }
    })
  }

  /** 交叉角色审查 */
  crossReview(analyses: RoleAnalysis[]): CrossReviewResult {
    const conflicts: CrossReviewResult['conflicts'] = []
    const synergies: CrossReviewResult['synergies'] = []
    const gaps: CrossReviewResult['gaps'] = []

    // 检测冲突：两个角色对同一维度评分差异 > 30
    for (let i = 0; i < analyses.length; i++) {
      for (let j = i + 1; j < analyses.length; j++) {
        const a = analyses[i], b = analyses[j]
        const aDims = new Map(a.findings.map(f => [f.dimension, f.score]))
        const bDims = new Map(b.findings.map(f => [f.dimension, f.score]))
        for (const [dim, scoreA] of aDims) {
          const scoreB = bDims.get(dim)
          if (scoreB != null && Math.abs(scoreA - scoreB) > 30) {
            conflicts.push({
              roles: [a.roleName, b.roleName],
              description: `${dim} 维度评价分歧: ${a.roleName}(${scoreA}) vs ${b.roleName}(${scoreB})`,
            })
          }
        }
      }
    }

    // 检测协同：两个角色都标记同一维度为优势
    for (let i = 0; i < analyses.length; i++) {
      for (let j = i + 1; j < analyses.length; j++) {
        const a = analyses[i], b = analyses[j]
        const aStrong = new Set(a.findings.filter(f => f.score > 70).map(f => f.dimension))
        for (const f of b.findings.filter(f => f.score > 70)) {
          if (aStrong.has(f.dimension)) {
            synergies.push({
              roles: [a.roleName, b.roleName],
              description: `${f.dimension} 维度共识: 双方均评为优势`,
            })
          }
        }
      }
    }

    // 检测缺口：所有角色都标记某一维度为问题
    const allDimensions = new Set(analyses.flatMap(a => a.findings.map(f => f.dimension)))
    for (const dim of allDimensions) {
      const allIssue = analyses.every(a =>
        a.findings.some(f => f.dimension === dim && f.issue)
      )
      if (allIssue) {
        gaps.push({ dimension: dim, description: `所有角色均认为 ${dim} 维度存在问题` })
      }
    }

    return { conflicts, synergies, gaps }
  }
}
