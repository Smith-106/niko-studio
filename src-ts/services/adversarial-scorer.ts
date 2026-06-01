import { NarrativeAnalyzer } from './narrative-analyzer'
import type { QualityReport } from './narrative-analyzer'

export interface AdversarialResult {
  defects: Array<{
    description: string
    severity: 'critical' | 'major' | 'minor'
    dimension: string
    fix?: string
  }>
  defenseResults: Array<{
    defect: string
    upheld: boolean
    reason: string
  }>
  confirmedDefects: Array<{
    description: string
    severity: 'critical' | 'major' | 'minor'
    fix?: string
  }>
  finalScore: number
  iterations: number
}

export class AdversarialScorer {
  private analyzer: NarrativeAnalyzer

  constructor(analyzer?: NarrativeAnalyzer) {
    this.analyzer = analyzer ?? new NarrativeAnalyzer()
  }

  /** 对抗评分：检察官找缺陷 → 辩护人辩护 → 法官裁决 */
  score(text: string, _opts?: { maxIterations?: number; targetScore?: number }): AdversarialResult {
    const report = this.analyzer.generateQualityReport(text)
    const maxIterations = _opts?.maxIterations ?? 1

    // Phase 1: 检察官 — 找出所有叙事缺陷
    const defects = this.prosecute(report)

    // Phase 2: 辩护人 — 为每个缺陷辩护
    const defenseResults = this.defend(text, defects)

    // Phase 3: 法官 — 裁决哪些缺陷成立
    const confirmedDefects = this.judge(defects, defenseResults)

    // 综合评分
    const penalty = confirmedDefects.reduce((sum, d) => {
      const weight = d.severity === 'critical' ? 15 : d.severity === 'major' ? 8 : 3
      return sum + weight
    }, 0)
    const finalScore = Math.max(0, report.overall - penalty)

    return { defects, defenseResults, confirmedDefects, finalScore, iterations: maxIterations }
  }

  private prosecute(report: QualityReport): AdversarialResult['defects'] {
    const defects: AdversarialResult['defects'] = []

    for (const issue of report.criticalIssues) {
      defects.push({ description: issue, severity: 'critical', dimension: 'overall' })
    }

    for (const [dim, score] of Object.entries(report.dimensions)) {
      if (score < 30) {
        defects.push({
          description: `${dim} 维度严重不足 (${score}/100)`,
          severity: 'critical',
          dimension: dim,
          fix: `重点提升 ${dim} 维度质量`,
        })
      } else if (score < 50) {
        defects.push({
          description: `${dim} 维度偏低 (${score}/100)`,
          severity: 'major',
          dimension: dim,
          fix: `考虑改善 ${dim} 方面的写作`,
        })
      } else if (score < 65) {
        defects.push({
          description: `${dim} 维度有提升空间 (${score}/100)`,
          severity: 'minor',
          dimension: dim,
        })
      }
    }

    return defects
  }

  private defend(text: string, defects: AdversarialResult['defects']): AdversarialResult['defenseResults'] {
    return defects.map(d => {
      // 辩护逻辑：检查文本是否确实存在该缺陷
      const textLength = text.length
      const hasComplexity = textLength > 200 && /然而|但是|却|不过/.test(text)
      const hasEmotion = /感到|觉得|颤抖|心跳|呼吸/.test(text)
      const hasDialogue = /[""「」『』]/.test(text)

      let upheld = true
      let reason = ''

      if (d.dimension === 'hook' && hasComplexity) {
        upheld = false
        reason = '文本包含冲突标记，钩子并非完全缺失'
      } else if (d.dimension === 'emotion_craft' && hasEmotion) {
        upheld = false
        reason = '文本包含情感描写，工艺并非完全缺失'
      } else if (d.dimension === 'suspense' && hasDialogue) {
        upheld = false
        reason = '对话可能隐含悬念元素'
      } else {
        reason = '缺陷成立，无明显反驳证据'
      }

      return { defect: d.description, upheld, reason }
    })
  }

  private judge(
    defects: AdversarialResult['defects'],
    defenses: AdversarialResult['defenseResults'],
  ): AdversarialResult['confirmedDefects'] {
    return defects
      .filter((_, i) => defenses[i]?.upheld !== false)
      .map(d => ({
        description: d.description,
        severity: d.severity,
        fix: d.fix,
      }))
  }
}
