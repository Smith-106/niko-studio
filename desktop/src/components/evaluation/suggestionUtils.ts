import type { RecommendationPayload } from '../../api/client'
import type { Translations } from '../../i18n'

export type SuggestionFocus =
  | 'conflict'
  | 'pacing'
  | 'structure'
  | 'logic'
  | 'character'
  | 'dialogue'
  | 'detail'
  | 'style'
  | 'generic'

export function buildDimensions(
  data: {
    lock_score: number
    style_score: number
    logic_score: number
    actionable_feedback: string
    module_scores?: Record<string, number>
  },
  fallbackFeedback: string,
  t: Translations,
) {
  const core = [
    { name: t.evaluationDimensionLock, score: Number((data.lock_score / 4).toFixed(1)), feedback: data.actionable_feedback || fallbackFeedback },
    { name: t.evaluationDimensionStyle, score: Number((data.style_score / 4).toFixed(1)), feedback: data.actionable_feedback || fallbackFeedback },
    { name: t.evaluationDimensionLogic, score: Number((data.logic_score / 4).toFixed(1)), feedback: data.actionable_feedback || fallbackFeedback },
  ]
  const modules = Object.entries(data.module_scores ?? {}).map(([name, score]) => ({
    name,
    score: Number(score.toFixed(1)),
    feedback: '',
  }))
  return { core, modules }
}

function toRecommendationPayload(
  raw: unknown,
  index: number,
  translate: (key: keyof Translations, params?: Record<string, string | number>) => string,
): RecommendationPayload {
  if (typeof raw === 'string') {
    const title = raw.trim()
    return {
      id: `rec-${String(index + 1).padStart(2, '0')}`,
      title,
      reason: title,
      action: 'apply',
    }
  }

  if (!raw || typeof raw !== 'object') {
    const fallback = translate('evaluationRecommendationFallback', { index: index + 1 })
    return {
      id: `rec-${String(index + 1).padStart(2, '0')}`,
      title: fallback,
      reason: fallback,
      action: 'apply',
    }
  }

  const record = raw as Record<string, unknown>
  const titleRaw = record.title ?? record.name ?? record.recommendation
  const fallbackTitle = translate('evaluationRecommendationFallback', { index: index + 1 })
  const title = typeof titleRaw === 'string' && titleRaw.trim() ? titleRaw.trim() : fallbackTitle
  const reasonRaw = record.reason
  const actionRaw = record.action

  return {
    id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : `rec-${String(index + 1).padStart(2, '0')}`,
    title,
    reason: typeof reasonRaw === 'string' && reasonRaw.trim() ? reasonRaw.trim() : title,
    action: typeof actionRaw === 'string' && actionRaw.trim() ? actionRaw.trim() : 'apply',
  }
}

export function normalizeSuggestionPayloads(
  rawSuggestions: unknown,
  translate: (key: keyof Translations, params?: Record<string, string | number>) => string,
): RecommendationPayload[] {
  if (!Array.isArray(rawSuggestions)) {
    return []
  }

  return rawSuggestions
    .map((item, index) => toRecommendationPayload(item, index, translate))
    .filter((item) => item.title.length > 0)
}

export function detectSuggestionFocus(suggestion: RecommendationPayload): SuggestionFocus {
  const normalized = `${suggestion.title} ${suggestion.reason}`.toLowerCase()

  if (
    normalized.includes('冲突') ||
    normalized.includes('张力') ||
    normalized.includes('风险') ||
    normalized.includes('stakes') ||
    normalized.includes('tension') ||
    normalized.includes('conflict') ||
    normalized.includes('pressure')
  ) {
    return 'conflict'
  }

  if (
    normalized.includes('节奏') ||
    normalized.includes('拖沓') ||
    normalized.includes(' pacing') ||
    normalized.includes('rhythm') ||
    normalized.includes('tempo')
  ) {
    return 'pacing'
  }

  if (
    normalized.includes('结构') ||
    normalized.includes('大纲') ||
    normalized.includes('组织') ||
    normalized.includes('层次') ||
    normalized.includes('structure') ||
    normalized.includes('outline') ||
    normalized.includes('organization')
  ) {
    return 'structure'
  }

  if (
    normalized.includes('逻辑') ||
    normalized.includes('因果') ||
    normalized.includes('连贯') ||
    normalized.includes('前后') ||
    normalized.includes('continuity') ||
    normalized.includes('causal') ||
    normalized.includes('logic')
  ) {
    return 'logic'
  }

  if (
    normalized.includes('角色') ||
    normalized.includes('人物') ||
    normalized.includes('动机') ||
    normalized.includes('弧光') ||
    normalized.includes('character') ||
    normalized.includes('motivation') ||
    normalized.includes('arc')
  ) {
    return 'character'
  }

  if (
    normalized.includes('对话') ||
    normalized.includes('对白') ||
    normalized.includes('台词') ||
    normalized.includes('dialogue') ||
    normalized.includes('voice')
  ) {
    return 'dialogue'
  }

  if (
    normalized.includes('细节') ||
    normalized.includes('场景') ||
    normalized.includes('描写') ||
    normalized.includes('画面') ||
    normalized.includes('detail') ||
    normalized.includes('imagery') ||
    normalized.includes('scene')
  ) {
    return 'detail'
  }

  if (
    normalized.includes('风格') ||
    normalized.includes('语气') ||
    normalized.includes('表达') ||
    normalized.includes('句式') ||
    normalized.includes('style') ||
    normalized.includes('tone') ||
    normalized.includes('clarity')
  ) {
    return 'style'
  }

  return 'generic'
}

export function buildWritingHelperPreset(focus: SuggestionFocus) {
  switch (focus) {
    case 'detail':
      return { mode: 'expand' as const, maxSentences: 5, maxItems: 6 }
    case 'style':
      return { mode: 'polish' as const, maxSentences: 3, maxItems: 6 }
    case 'structure':
      return { mode: 'outline' as const, maxSentences: 3, maxItems: 5 }
    case 'conflict':
    case 'pacing':
    case 'logic':
    case 'character':
    case 'dialogue':
      return { mode: 'rewrite' as const, maxSentences: 4, maxItems: 6 }
    default:
      return { mode: 'rewrite' as const, maxSentences: 3, maxItems: 6 }
  }
}

export function buildSuggestionActionTemplate(focus: SuggestionFocus, isZh: boolean): string {
  if (isZh) {
    switch (focus) {
      case 'conflict':
        return '本次改写请优先这样处理：\n1. 更早亮出人物之间的对立目标或阻力。\n2. 明确抬高失败代价、风险或情绪压力。\n3. 让结尾保留未解决的悬念或压迫感。'
      case 'pacing':
        return '本次改写请优先这样处理：\n1. 删掉重复铺垫，尽快进入有效动作。\n2. 缩短解释段，把信息拆进动作和反应里。\n3. 每一段都推进事件、关系或决策，不做原地踏步。'
      case 'logic':
        return '本次改写请优先这样处理：\n1. 补足因果链，让每个动作都有明确触发原因。\n2. 修正前后信息冲突，保持设定和时间线一致。\n3. 让关键结论来自可见线索，而不是突然跳结论。'
      case 'character':
        return '本次改写请优先这样处理：\n1. 把角色当下想要什么、害怕什么写得更具体。\n2. 让动作和对白能反映人物立场，而不是作者说明。\n3. 保留角色差异，让情绪变化有递进。'
      case 'dialogue':
        return '本次改写请优先这样处理：\n1. 删除解释型台词，让对白承担试探、施压或遮掩。\n2. 拉开人物语气差异，避免所有人说话一个腔调。\n3. 用对白后的动作或沉默补足潜台词。'
      case 'detail':
        return '本次改写请优先这样处理：\n1. 增加能服务情绪和冲突的具体场景细节。\n2. 用可感知的动作、声音、视线或环境替代空泛描述。\n3. 只保留会推动氛围或信息的细节，不堆砌形容词。'
      case 'style':
        return '本次改写请优先这样处理：\n1. 收紧句子，把模糊和重复表达改得更直接。\n2. 统一语气，不让段落在风格上来回跳。\n3. 优先保留有辨识度的措辞，减少模板化表达。'
      default:
        return '本次改写请优先这样处理：\n1. 围绕这条建议只解决最关键的一处问题。\n2. 让修改结果直接体现在动作、信息或情绪推进上。\n3. 输出完整改写版本，不要附加解释。'
    }
  }

  switch (focus) {
    case 'conflict':
      return 'Use this rewrite template:\n1. Surface the opposing goals or resistance earlier.\n2. Raise the cost of failure, risk, or emotional pressure.\n3. End with unresolved pressure or a sharper hook.'
    case 'pacing':
      return 'Use this rewrite template:\n1. Cut repeated setup and move into meaningful action sooner.\n2. Break explanations into reactions and scene movement.\n3. Make every paragraph advance event, relationship, or decision.'
    case 'logic':
      return 'Use this rewrite template:\n1. Repair the cause-and-effect chain behind each action.\n2. Remove continuity conflicts across facts, setup, and timing.\n3. Let key conclusions grow out of visible evidence.'
    case 'character':
      return 'Use this rewrite template:\n1. Clarify what the character wants and fears right now.\n2. Let action and dialogue reveal stance instead of narration alone.\n3. Preserve distinct emotional progression and motivation.'
    case 'dialogue':
      return 'Use this rewrite template:\n1. Remove explanatory lines and turn dialogue into pressure or concealment.\n2. Differentiate each speaker’s cadence and intent.\n3. Use action beats or silence to carry subtext.'
    case 'detail':
      return 'Use this rewrite template:\n1. Add concrete scene details that support mood or conflict.\n2. Prefer sensory action over generic description.\n3. Keep only details that strengthen atmosphere or information flow.'
    case 'style':
      return 'Use this rewrite template:\n1. Tighten sentences and replace vague repetition.\n2. Keep tone consistent across the passage.\n3. Preserve distinctive phrasing while reducing templated language.'
    default:
      return 'Use this rewrite template:\n1. Solve the single highest-value issue from this suggestion.\n2. Make the change visible in action, information flow, or emotional movement.\n3. Return a full revised version without commentary.'
  }
}
