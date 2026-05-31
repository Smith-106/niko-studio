import type { NarrativeAnalyzer, QualityReport } from './narrative-analyzer'

export type GateLevel = 'quick' | 'standard' | 'strict'
export type GateResult = 'PASS' | 'WARN' | 'FAIL' | 'BLOCK'

export interface GateConfig {
  level: GateLevel
  passScore: number
  warnScore: number
  maxRevisions: number
  stagnationPatience: number
}

const GATE_CONFIGS: Record<GateLevel, GateConfig> = {
  quick:    { level: 'quick',    passScore: 60, warnScore: 40, maxRevisions: 1, stagnationPatience: 1 },
  standard: { level: 'standard', passScore: 75, warnScore: 60, maxRevisions: 3, stagnationPatience: 2 },
  strict:   { level: 'strict',   passScore: 90, warnScore: 80, maxRevisions: 3, stagnationPatience: 2 },
}

export interface GateOutcome {
  result: GateResult
  score: number
  report: QualityReport
  revisionCount: number
  history: Array<{ revision: number; score: number }>
}

export class QualityGateLoop {
  private analyzer: NarrativeAnalyzer

  constructor(analyzer?: NarrativeAnalyzer) {
    this.analyzer = analyzer ?? new NarrativeAnalyzer()
  }

  /** 执行质量门禁 */
  async evaluate(text: string, level: GateLevel = 'standard'): Promise<GateOutcome> {
    const config = GATE_CONFIGS[level]
    const report = this.analyzer.generateQualityReport(text)
    const score = report.overall
    const history: GateOutcome['history'] = [{ revision: 0, score }]

    let result: GateResult
    if (score >= config.passScore) result = 'PASS'
    else if (score >= config.warnScore) result = 'WARN'
    else result = 'FAIL'

    // 严格模式下低于发布线则阻止
    if (level === 'strict' && score < config.warnScore) result = 'BLOCK'

    return { result, score, report, revisionCount: 0, history }
  }

  /** 修订循环：模拟 writer-critic 迭代 */
  async revisionLoop(
    text: string,
    level: GateLevel = 'standard',
    reviseFn: (text: string, report: QualityReport) => Promise<string>,
  ): Promise<GateOutcome> {
    const config = GATE_CONFIGS[level]
    let currentText = text
    let lastScore = 0
    let stagnationCount = 0
    const history: GateOutcome['history'] = []

    for (let i = 0; i <= config.maxRevisions; i++) {
      const report = this.analyzer.generateQualityReport(currentText)
      const score = report.overall
      history.push({ revision: i, score })

      // 检查通过
      if (score >= config.passScore) {
        return { result: 'PASS', score, report, revisionCount: i, history }
      }

      // 检查停滞
      if (Math.abs(score - lastScore) < 2) {
        stagnationCount++
        if (stagnationCount >= config.stagnationPatience) {
          return { result: 'WARN', score, report, revisionCount: i, history }
        }
      } else {
        stagnationCount = 0
      }
      lastScore = score

      // 修订
      if (i < config.maxRevisions) {
        currentText = await reviseFn(currentText, report)
      }
    }

    // 超过最大修订次数
    const finalReport = this.analyzer.generateQualityReport(currentText)
    const finalScore = finalReport.overall
    const result: GateResult = finalScore >= config.passScore ? 'PASS' :
                               finalScore >= config.warnScore ? 'WARN' : 'FAIL'
    return { result, score: finalScore, report: finalReport, revisionCount: config.maxRevisions, history }
  }

  /** 快速扫描 */
  quickScan(text: string): GateOutcome {
    const report = this.analyzer.generateQualityReport(text)
    const score = report.overall
    const result: GateResult = score >= 60 ? 'PASS' : score >= 40 ? 'WARN' : 'FAIL'
    return { result, score, report, revisionCount: 0, history: [{ revision: 0, score }] }
  }
}
