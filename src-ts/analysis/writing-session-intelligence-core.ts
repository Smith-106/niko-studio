export type WritingSessionPattern =
  | 'steady_progress'
  | 'rewrite_loop'
  | 'stalling'
  | 'jump_editing'
  | 'fatigue_risk'

export interface WritingSessionTelemetry {
  sessionId: string
  chapterId: string | null
  startedAt: string
  updatedAt: string
  eventCount: number
  activeMinutes: number
  saveCount: number
  historyPanelOpenCount: number
  rewriteCount: number
  jumpEditCount: number
  recentActions: string[]
  characterFocus: string[]
  keywordFocus: string[]
}

export interface SessionInsight {
  pattern: WritingSessionPattern
  confidence: number
  summary: string
  suggestion: string
}

export interface WritingSessionIntelligenceResult {
  telemetry: WritingSessionTelemetry
  insights: SessionInsight[]
  clusterName?: string | null
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100))
}

export function analyzeWritingSessionIntelligenceCore(
  telemetry: WritingSessionTelemetry,
): WritingSessionIntelligenceResult {
  const insights: SessionInsight[] = []

  if (telemetry.rewriteCount >= 3) {
    insights.push({
      pattern: 'rewrite_loop',
      confidence: clampConfidence(telemetry.rewriteCount / Math.max(telemetry.eventCount, 1)),
      summary: '当前会话出现了较高频率的重复改写。',
      suggestion: '先冻结局部段落，改为记录待修订点，再继续推进新内容。',
    })
  }

  if (telemetry.activeMinutes >= 25 && telemetry.saveCount === 0) {
    insights.push({
      pattern: 'stalling',
      confidence: 0.72,
      summary: '长时间停留在当前会话但没有形成稳定输出。',
      suggestion: '尝试先写一个最小段落目标，或切到写作助手生成下一步提纲。',
    })
  }

  if (telemetry.jumpEditCount >= 3) {
    insights.push({
      pattern: 'jump_editing',
      confidence: clampConfidence(telemetry.jumpEditCount / Math.max(telemetry.eventCount, 1)),
      summary: '当前会话存在多次跳跃式修改。',
      suggestion: '先锁定一个章节目标，避免同时改太多位置。',
    })
  }

  if (telemetry.activeMinutes >= 45) {
    insights.push({
      pattern: 'fatigue_risk',
      confidence: 0.68,
      summary: '当前会话已持续较久，可能进入疲劳区间。',
      suggestion: '考虑短暂休息，或转为只记录问题清单，不继续强推正文。',
    })
  }

  if (insights.length === 0) {
    insights.push({
      pattern: 'steady_progress',
      confidence: 0.78,
      summary: '当前会话节奏稳定，没有明显停滞或高频回退。',
      suggestion: '保持当前推进节奏，必要时用 History 面板做阶段回看。',
    })
  }

  return {
    telemetry,
    insights,
    clusterName: null,
  }
}
