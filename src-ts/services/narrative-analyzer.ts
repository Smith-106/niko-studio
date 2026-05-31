export interface HookResult {
  score: number // 0-100
  hookType: 'question' | 'mystery' | 'conflict' | 'surprise' | 'stakes'
  strength: number // 0-1
  suggestion?: string
}

export interface CliffhangerResult {
  score: number // 0-100
  tension: number
  uncertainty: number
  emotional: number
  curiosity: number
}

export interface EmotionCraftResult {
  showTellRatio: number // 0-1, 1=all show
  layerCount: number // 1-5
  dominantLayer: 'sensory' | 'action' | 'internal' | 'dialogue' | 'metaphor'
  score: number
}

export interface EmotionalArcPoint {
  chapter: number
  valence: number // -1 to 1
  arousal: number // 0 to 1
  label?: string
}

export interface VoiceProfile {
  characterId: string
  avgSentenceLength: number
  vocabularyRichness: number
  dialogueRatio: number
  uniquePhrases: string[]
}

export interface SuspenseResult {
  score: number
  informationGap: number
  threatEscalation: number
  timePressure: number
}

export interface QualityReport {
  overall: number
  dimensions: Record<string, number>
  criticalIssues: string[]
  suggestions: string[]
}

export class NarrativeAnalyzer {
  /** 钩子检测：分析文本开头的吸引力 */
  analyzeHook(text: string): HookResult {
    const firstParagraph = text.split(/\n\n/)[0] ?? ''
    const hasQuestion = /[？?]/.test(firstParagraph)
    const hasConflict = /但|却|然而|不过|可是|偏偏/.test(firstParagraph)
    const hasMystery = /秘密|真相|谜|消失|诡异|奇怪/.test(firstParagraph)
    const hasSurprise = /竟然|居然|想不到|没想到|出乎/.test(firstParagraph)
    const hasStakes = /必须|不得不|只能|赌上|拼命/.test(firstParagraph)

    let score = 20 // 基础分
    let hookType: HookResult['hookType'] = 'question'
    if (hasConflict) { score += 25; hookType = 'conflict' }
    if (hasMystery) { score += 20; hookType = 'mystery' }
    if (hasStakes) { score += 15; hookType = 'stakes' }
    if (hasSurprise) { score += 10; hookType = 'surprise' }
    if (hasQuestion) { score += 10; hookType = 'question' }

    return { score: Math.min(100, score), hookType, strength: score / 100 }
  }

  /** 悬念评分：分析文本的悬疑程度 */
  analyzeCliffhanger(text: string): CliffhangerResult {
    const lastParagraph = text.split(/\n\n/).pop() ?? ''
    const hasUnresolved = /未完|待续|究竟|到底|是否/.test(lastParagraph)
    const hasDanger = /危险|威胁|逼近|追来|陷阱/.test(lastParagraph)
    const hasEmotion = /心碎|绝望|狂喜|震惊|恐惧/.test(lastParagraph)
    const hasCuriosity = /秘密|真相|答案|发现|揭开/.test(lastParagraph)

    const tension = hasDanger ? 80 : hasUnresolved ? 50 : 20
    const uncertainty = hasUnresolved ? 80 : hasCuriosity ? 60 : 20
    const emotional = hasEmotion ? 80 : 30
    const curiosity = hasCuriosity ? 80 : hasUnresolved ? 60 : 20
    const score = Math.round((tension + uncertainty + emotional + curiosity) / 4)

    return { score, tension, uncertainty, emotional, curiosity }
  }

  /** 情感工艺：Show-don't-tell 分析 */
  analyzeEmotionCraft(text: string): EmotionCraftResult {
    const tellMarkers = /感到|觉得|心情|情绪|悲伤|快乐|愤怒|害怕/.test(text)
    const showSensory = /看到|听到|闻到|触摸|尝到|刺痛|温暖|冰冷/.test(text)
    const showAction = /握紧|颤抖|咬唇|转身|后退|冲向/.test(text)
    const showInternal = /心跳|呼吸|胸口|喉咙|胃里/.test(text)
    const showMetaphor = /像.*一样|仿佛|犹如|宛如/.test(text)

    let showCount = [showSensory, showAction, showInternal, showMetaphor].filter(Boolean).length
    let tellCount = tellMarkers ? 1 : 0
    const ratio = (showCount + tellCount) > 0 ? showCount / (showCount + tellCount) : 0.5

    let dominantLayer: EmotionCraftResult['dominantLayer'] = 'action'
    if (showSensory) dominantLayer = 'sensory'
    else if (showInternal) dominantLayer = 'internal'
    else if (showMetaphor) dominantLayer = 'metaphor'

    return {
      showTellRatio: ratio,
      layerCount: showCount + 1,
      dominantLayer,
      score: Math.round(ratio * 100),
    }
  }

  /** 悬疑评价 */
  analyzeSuspense(text: string): SuspenseResult {
    const infoGap = /秘密|真相|未知|隐藏|隐瞒/.test(text) ? 70 : 30
    const threat = /危险|敌人|追杀|陷阱|威胁/.test(text) ? 75 : 25
    const timePressure = /必须|倒计时|来不及|最后|期限/.test(text) ? 80 : 20
    const score = Math.round((infoGap + threat + timePressure) / 3)
    return { score, informationGap: infoGap, threatEscalation: threat, timePressure }
  }

  /** 综合质量报告 */
  generateQualityReport(text: string): QualityReport {
    const hook = this.analyzeHook(text)
    const cliffhanger = this.analyzeCliffhanger(text)
    const emotion = this.analyzeEmotionCraft(text)
    const suspense = this.analyzeSuspense(text)

    const dimensions: Record<string, number> = {
      hook: hook.score,
      cliffhanger: cliffhanger.score,
      emotion_craft: emotion.score,
      suspense: suspense.score,
    }

    const criticalIssues: string[] = []
    const suggestions: string[] = []

    if (hook.score < 40) {
      criticalIssues.push('开头缺乏吸引力')
      suggestions.push('加入冲突、悬念或信息缺口增强开头钩子')
    }
    if (cliffhanger.score < 40) {
      suggestions.push('章节结尾增加未解决的张力')
    }
    if (emotion.showTellRatio < 0.3) {
      criticalIssues.push('情感描写过于直白（tell > show）')
      suggestions.push('用感官细节、身体反应、动作替代直接陈述情绪')
    }
    if (suspense.score < 30) {
      suggestions.push('增加信息缺口、威胁递进或时间压力提升悬疑感')
    }

    const overall = Math.round(Object.values(dimensions).reduce((a, b) => a + b, 0) / Object.keys(dimensions).length)
    return { overall, dimensions, criticalIssues, suggestions }
  }
}
