/**
 * StoryBibleExtractor - Auto-extract Story Bible entities from manuscript text
 *
 * Uses pattern-based extraction (regex + NLP heuristics) to identify:
 * - Characters (name, traits, relationships)
 * - World rules (from dialogue and narration)
 * - Plot threads (from event sequences)
 * - Timeline events (from narrative progression)
 *
 * All extracted entities have source='auto-extract' and completenessScore.
 *
 * @module knowledge/extraction/StoryBibleExtractor
 */

import { randomUUID } from 'node:crypto'
import {
  CharacterProfile,
  CharacterArchetype,
  WorldRule,
  WorldRuleCategory,
  PlotThread,
  PlotThreadStatus,
  TimelineEvent,
  TimelineEventType,
  StoryBibleEntity,
  createCharacterProfile,
  createWorldRule,
  createPlotThread,
  createTimelineEvent,
} from '../entities/story-bible-types.js'

// ============================================================
// Types
// ============================================================

export interface ExtractionResult {
  entities: StoryBibleEntity[]
  confidence: number
  warnings: string[]
}

export interface ExtractionOptions {
  /** Minimum confidence threshold for inclusion (default: 0.5) */
  minConfidence?: number
  /** Enable character extraction */
  extractCharacters?: boolean
  /** Enable world rule extraction */
  extractWorldRules?: boolean
  /** Enable plot thread extraction */
  extractPlotThreads?: boolean
  /** Enable timeline event extraction */
  extractTimelineEvents?: boolean
}

// ============================================================
// Character Extraction Patterns
// ============================================================

/**
 * Chinese character name pattern - 2-4 character names
 * Matches: 张三, 李小明, 欧阳锋
 */
const CHINESE_NAME_PATTERN = /[一-龥]{2,4}/g

/**
 * Dialogue attribution patterns
 * Matches: 张三说, "..."李四道, 王五问
 */
const DIALOGUE_ATTRIBUTION_PATTERN = /["""]([^"""]+)["""]\s*([^。？！\n]{1,10})(?:说|道|问|答|喊|叫|笑|叹|低语|喃喃)/g

/**
 * Character trait keywords
 */
const TRAIT_KEYWORDS: Record<string, string[]> = {
  // Personality traits
  '勇敢': ['勇敢', '无畏', '胆大', '刚毅'],
  '聪明': ['聪明', '智慧', '机智', '睿智', '精明'],
  '善良': ['善良', '仁慈', '慈悲', '宽厚', '仁义'],
  '狡猾': ['狡猾', '奸诈', '阴险', '狡诈', '城府'],
  '傲慢': ['傲慢', '高傲', '狂妄', '自大', '目中无人'],
  '温柔': ['温柔', '温和', '柔顺', '温婉', '体贴'],
  '冷酷': ['冷酷', '冷漠', '冷血', '无情', '淡漠'],
  '固执': ['固执', '顽固', '执拗', '倔强', '一根筋'],
  // Physical traits
  '高大': ['高大', '魁梧', '健壮', '强壮', '威猛'],
  '瘦弱': ['瘦弱', '瘦小', '单薄', '消瘦', '枯瘦'],
  '美丽': ['美丽', '漂亮', '貌美', '俊俏', '绝美'],
  '英俊': ['英俊', '帅气', '俊朗', '潇洒', '俊美'],
}

/**
 * Character archetype indicators
 */
const ARCHETYPE_INDICATORS: Record<CharacterArchetype, string[]> = {
  [CharacterArchetype.PROTAGONIST]: ['主角', '主人公', '英雄', '主角光环'],
  [CharacterArchetype.ANTAGONIST]: ['反派', '敌人', '对手', '恶人', '仇敌'],
  [CharacterArchetype.SUPPORTING]: ['配角', '次要角色', '朋友', '同伴'],
  [CharacterArchetype.MENTOR]: ['师父', '导师', '老师', '长者', '前辈', '指引'],
  [CharacterArchetype.NARRATOR]: ['叙述者', '我', '笔者'],
  [CharacterArchetype.DEUTERAGONIST]: ['第二主角', '重要配角', '核心配角'],
}

/**
 * Relationship keywords
 */
const RELATIONSHIP_KEYWORDS: Record<string, string[]> = {
  'ally': ['朋友', '同伴', '战友', '盟友', '伙伴', '挚友'],
  'rival': ['对手', '竞争者', '敌人', '仇人', '宿敌'],
  'romantic': ['恋人', '爱人', '情侣', '夫妻', '暗恋', '喜欢'],
  'family': ['父亲', '母亲', '兄弟', '姐妹', '儿子', '女儿', '亲人', '家人'],
  'mentor-student': ['师父', '徒弟', '老师', '学生', '师徒'],
  'subordinate': ['下属', '部下', '随从', '仆人', '手下'],
}

// ============================================================
// World Rule Extraction Patterns
// ============================================================

/**
 * World rule statement patterns
 * Matches: "这个世界...", "根据规则...", "传说中..."
 */
const WORLD_RULE_PATTERNS = [
  /这个世界[里面的]*([^。\n]{5,50})/g,
  /在这个[地界世域]([^。\n]{5,50})/g,
  /根据[旧古新]的?(?:传说|规矩|传统|习俗)([^。\n]{5,50})/g,
  /凡是([^。\n]{5,30})都([^。\n]{5,30})/g,
  /只有([^。\n]{5,30})才能([^。\n]{5,30})/g,
  /不可([^。\n]{3,20})，否则([^。\n]{5,30})/g,
]

/**
 * World rule category keywords
 */
const WORLD_RULE_CATEGORY_KEYWORDS: Record<WorldRuleCategory, string[]> = {
  [WorldRuleCategory.PHYSICS]: ['物理', '重力', '引力', '力学', '自然规律', '物质'],
  [WorldRuleCategory.MAGIC]: ['魔法', '法术', '咒语', '灵力', '魔力', '仙术', '道法'],
  [WorldRuleCategory.SOCIAL]: ['社会', '阶级', '地位', '身份', '礼仪', '规矩'],
  [WorldRuleCategory.ECONOMIC]: ['经济', '贸易', '货币', '商业', '交易', '财富'],
  [WorldRuleCategory.POLITICAL]: ['政治', '权力', '统治', '王朝', '国家', '政权'],
  [WorldRuleCategory.CULTURAL]: ['文化', '传统', '习俗', '节日', '信仰', '宗教'],
  [WorldRuleCategory.TECHNOLOGY]: ['科技', '技术', '机械', '发明', '工具', '器械'],
}

// ============================================================
// Plot Thread Extraction Patterns
// ============================================================

/**
 * Plot thread indicators
 */
const PLOT_THREAD_PATTERNS = [
  /为了([^。\n]{5,30})，([^。\n]{5,50})/g,
  /必须([^。\n]{5,30})，否则([^。\n]{5,30})/g,
  /目标是?([^。\n]{5,30})/g,
  /计划([^。\n]{5,50})/g,
  /阴谋([^。\n]{5,50})/g,
  /秘密([^。\n]{5,50})/g,
]

/**
 * Plot thread status indicators
 */
const PLOT_STATUS_INDICATORS: Record<PlotThreadStatus, string[]> = {
  [PlotThreadStatus.SETUP]: ['开始', '起初', '最初', '开端', '准备'],
  [PlotThreadStatus.DEVELOPING]: ['发展', '进行', '推进', '展开', '深入'],
  [PlotThreadStatus.CLIMAX]: ['高潮', '决战', '关键时刻', '顶峰', '最高'],
  [PlotThreadStatus.RESOLVED]: ['解决', '结束', '完成', '了结', '结局'],
  [PlotThreadStatus.DORMANT]: ['暂停', '搁置', '等待', '潜伏', '隐藏'],
  [PlotThreadStatus.ABANDONED]: ['放弃', '中止', '失败', '未完成'],
}

// ============================================================
// Timeline Event Extraction Patterns
// ============================================================

/**
 * Event action verbs
 */
const EVENT_VERBS = [
  '到达', '离开', '遇见', '发现', '决定', '战斗', '死亡', '出生',
  '获得', '失去', '背叛', '拯救', '逃走', '追击', '建立', '毁灭',
]

/**
 * Event type indicators
 */
const EVENT_TYPE_INDICATORS: Record<TimelineEventType, string[]> = {
  [TimelineEventType.INCIDENT]: ['发生', '出现', '遭遇', '碰到', '经历'],
  [TimelineEventType.DECISION]: ['决定', '选择', '决心', '立誓', '决意'],
  [TimelineEventType.REVELATION]: ['发现', '揭示', '真相', '秘密', '得知', '明白'],
  [TimelineEventType.CONFRONTATION]: ['冲突', '对抗', '战斗', '争斗', '交锋'],
  [TimelineEventType.TRANSITION]: ['离开', '到达', '前往', '转移', '启程'],
  [TimelineEventType.MILESTONE]: ['里程碑', '重要', '关键', '转折点', '重大'],
}

/**
 * Emotional impact indicators
 */
const EMOTIONAL_IMPACT_KEYWORDS: Record<'low' | 'medium' | 'high' | 'critical', string[]> = {
  'low': ['日常', '普通', '平常', '一般', '琐碎'],
  'medium': ['重要', '显著', '明显', '值得注意'],
  'high': ['重大', '关键', '严重', '激烈', '震撼'],
  'critical': ['决定性', '生死', '命运', '终极', '最终'],
}

// ============================================================
// StoryBibleExtractor Class
// ============================================================

const DEFAULT_OPTIONS: Required<ExtractionOptions> = {
  minConfidence: 0.5,
  extractCharacters: true,
  extractWorldRules: true,
  extractPlotThreads: true,
  extractTimelineEvents: true,
}

/**
 * Extract Story Bible entities from manuscript text.
 *
 * Usage:
 *   const extractor = new StoryBibleExtractor()
 *   const result = await extractor.extractFromManuscript(text, 'novel-001')
 *   console.log(result.entities) // CharacterProfile[], WorldRule[], etc.
 */
export class StoryBibleExtractor {
  private readonly options: Required<ExtractionOptions>

  constructor(options?: ExtractionOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Extract all entity types from manuscript text.
   */
  async extractFromManuscript(text: string, novelId: string): Promise<ExtractionResult> {
    const entities: StoryBibleEntity[] = []
    const warnings: string[] = []
    let totalConfidence = 0
    let entityCount = 0

    if (this.options.extractCharacters) {
      const characters = this.extractCharacters(text, novelId)
      if (characters.length > 0) {
        entities.push(...characters)
        totalConfidence += characters.reduce((sum, c) => sum + c.completenessScore, 0)
        entityCount += characters.length
      } else {
        warnings.push('No characters extracted from manuscript')
      }
    }

    if (this.options.extractWorldRules) {
      const worldRules = this.extractWorldRules(text, novelId)
      if (worldRules.length > 0) {
        entities.push(...worldRules)
        totalConfidence += worldRules.reduce((sum, w) => sum + w.completenessScore, 0)
        entityCount += worldRules.length
      } else {
        warnings.push('No world rules extracted from manuscript')
      }
    }

    if (this.options.extractPlotThreads) {
      const plotThreads = this.extractPlotThreads(text, novelId)
      if (plotThreads.length > 0) {
        entities.push(...plotThreads)
        totalConfidence += plotThreads.reduce((sum, p) => sum + p.completenessScore, 0)
        entityCount += plotThreads.length
      } else {
        warnings.push('No plot threads extracted from manuscript')
      }
    }

    if (this.options.extractTimelineEvents) {
      const timelineEvents = this.extractTimelineEvents(text, novelId)
      if (timelineEvents.length > 0) {
        entities.push(...timelineEvents)
        totalConfidence += timelineEvents.reduce((sum, t) => sum + t.completenessScore, 0)
        entityCount += timelineEvents.length
      } else {
        warnings.push('No timeline events extracted from manuscript')
      }
    }

    const confidence = entityCount > 0 ? totalConfidence / entityCount : 0

    return {
      entities,
      confidence: Math.round(confidence * 1000) / 1000,
      warnings,
    }
  }

  /**
   * Extract character profiles from text.
   */
  extractCharacters(text: string, novelId: string): CharacterProfile[] {
    const characters = new Map<string, CharacterProfile>()
    const nameOccurrences = new Map<string, number>()

    // Extract character names from dialogue attributions
    let match: RegExpExecArray | null
    while ((match = DIALOGUE_ATTRIBUTION_PATTERN.exec(text)) !== null) {
      const name = match[2].trim()
      if (name.length >= 2 && name.length <= 4) {
        nameOccurrences.set(name, (nameOccurrences.get(name) ?? 0) + 1)

        if (!characters.has(name)) {
          characters.set(name, this.createCharacterSkeleton(name, novelId))
        }

        // Extract speech patterns from dialogue
        const dialogue = match[1]
        const character = characters.get(name)!
        if (character.speechPatterns.length < 10) {
          character.speechPatterns.push(dialogue.slice(0, 50))
        }
      }
    }
    DIALOGUE_ATTRIBUTION_PATTERN.lastIndex = 0

    // Extract traits from text
    characters.forEach((character, name) => {
      // Find character context window (±500 chars around name mentions)
      const namePattern = new RegExp(name, 'g')
      const contexts: string[] = []
      let nameMatch: RegExpExecArray | null
      while ((nameMatch = namePattern.exec(text)) !== null) {
        const start = Math.max(0, nameMatch.index - 500)
        const end = Math.min(text.length, nameMatch.index + name.length + 500)
        contexts.push(text.slice(start, end))
      }
      namePattern.lastIndex = 0

      const combinedContext = contexts.join(' ')

      // Extract traits
      for (const [traitName, keywords] of Object.entries(TRAIT_KEYWORDS)) {
        for (const keyword of keywords) {
          if (combinedContext.includes(keyword)) {
            const existingTrait = character.traits.find(t => t.trait === traitName)
            if (existingTrait) {
              existingTrait.intensity = Math.min(1, existingTrait.intensity + 0.1)
            } else {
              character.traits.push({
                trait: traitName,
                intensity: 0.5,
                evidence: keyword,
              })
            }
            break
          }
        }
      }

      // Determine archetype
      for (const [archetype, indicators] of Object.entries(ARCHETYPE_INDICATORS)) {
        for (const indicator of indicators) {
          if (combinedContext.includes(indicator)) {
            character.archetype = archetype as CharacterArchetype
            break
          }
        }
        if (character.archetype !== CharacterArchetype.SUPPORTING) break
      }

      // Calculate completeness score
      character.completenessScore = this.calculateCharacterCompleteness(character)
    })

    // Filter by occurrence threshold and confidence
    const minOccurrences = 2
    const result = Array.from(characters.values())
      .filter(c => (nameOccurrences.get(c.name) ?? 0) >= minOccurrences)
      .filter(c => c.completenessScore >= this.options.minConfidence)

    return result
  }

  /**
   * Extract world rules from text.
   */
  extractWorldRules(text: string, novelId: string): WorldRule[] {
    const rules: WorldRule[] = []

    for (const pattern of WORLD_RULE_PATTERNS) {
      let match: RegExpExecArray | null
      while ((match = pattern.exec(text)) !== null) {
        const fullMatch = match[0]
        const description = match.slice(1).filter(Boolean).join('，')

        if (description.length < 10) continue

        // Determine category
        let category = WorldRuleCategory.SOCIAL
        for (const [cat, keywords] of Object.entries(WORLD_RULE_CATEGORY_KEYWORDS)) {
          if (keywords.some(kw => fullMatch.includes(kw))) {
            category = cat as WorldRuleCategory
            break
          }
        }

        const rule = createWorldRule({
          id: randomUUID(),
          novelId,
          name: this.truncateName(description, 30),
          source: 'auto-extract',
          category,
          description: fullMatch,
          constraints: [],
          exceptions: [],
          impactScope: 'local',
          relatedEntities: [],
        })

        rule.completenessScore = this.calculateWorldRuleCompleteness(rule)
        rules.push(rule)
      }
      pattern.lastIndex = 0
    }

    // Deduplicate by description similarity
    const uniqueRules = this.deduplicateByDescription(rules)

    return uniqueRules
      .filter(r => r.completenessScore >= this.options.minConfidence)
      .slice(0, 20) // Limit to top 20 rules
  }

  /**
   * Extract plot threads from text.
   */
  extractPlotThreads(text: string, novelId: string): PlotThread[] {
    const threads: PlotThread[] = []

    for (const pattern of PLOT_THREAD_PATTERNS) {
      let match: RegExpExecArray | null
      while ((match = pattern.exec(text)) !== null) {
        const fullMatch = match[0]
        const parts = match.slice(1).filter(Boolean)

        if (parts.length === 0) continue

        const premise = parts[0] ?? ''
        const goal = parts[1] ?? ''

        // Determine status
        let status = PlotThreadStatus.SETUP
        for (const [s, indicators] of Object.entries(PLOT_STATUS_INDICATORS)) {
          if (indicators.some(ind => fullMatch.includes(ind))) {
            status = s as PlotThreadStatus
            break
          }
        }

        const thread = createPlotThread({
          id: randomUUID(),
          novelId,
          name: this.truncateName(premise, 30),
          source: 'auto-extract',
          status,
          premise,
          goal,
          stakes: '',
          involvedCharacters: [],
          keyEvents: [],
          foreshadowingRefs: [],
          resolution: null,
        })

        thread.completenessScore = this.calculatePlotThreadCompleteness(thread)
        threads.push(thread)
      }
      pattern.lastIndex = 0
    }

    // Deduplicate by premise similarity
    const uniqueThreads = this.deduplicateByDescription(threads, 'premise')

    return uniqueThreads
      .filter(t => t.completenessScore >= this.options.minConfidence)
      .slice(0, 15) // Limit to top 15 threads
  }

  /**
   * Extract timeline events from text.
   */
  extractTimelineEvents(text: string, novelId: string): TimelineEvent[] {
    const events: TimelineEvent[] = []

    // Split text into paragraphs for event detection
    const paragraphs = text.split(/[\n\r]+/).filter(p => p.trim().length > 20)

    for (const paragraph of paragraphs) {
      // Check for event verbs
      const hasEventVerb = EVENT_VERBS.some(verb => paragraph.includes(verb))
      if (!hasEventVerb) continue

      // Determine event type
      let eventType = TimelineEventType.INCIDENT
      for (const [type, indicators] of Object.entries(EVENT_TYPE_INDICATORS)) {
        if (indicators.some(ind => paragraph.includes(ind))) {
          eventType = type as TimelineEventType
          break
        }
      }

      // Determine emotional impact
      let emotionalImpact: 'low' | 'medium' | 'high' | 'critical' = 'low'
      for (const [impact, keywords] of Object.entries(EMOTIONAL_IMPACT_KEYWORDS)) {
        if (keywords.some(kw => paragraph.includes(kw))) {
          emotionalImpact = impact as 'low' | 'medium' | 'high' | 'critical'
          break
        }
      }

      const event = createTimelineEvent({
        id: randomUUID(),
        novelId,
        name: this.truncateName(paragraph.trim(), 50),
        source: 'auto-extract',
        eventType,
        timestamp: '',
        chapterRef: '',
        description: paragraph.trim().slice(0, 200),
        participants: [],
        consequences: [],
        plotThreadRefs: [],
        emotionalImpact,
      })

      event.completenessScore = this.calculateTimelineEventCompleteness(event)
      events.push(event)
    }

    return events
      .filter(e => e.completenessScore >= this.options.minConfidence)
      .slice(0, 30) // Limit to top 30 events
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  private createCharacterSkeleton(name: string, novelId: string): CharacterProfile {
    return createCharacterProfile({
      id: randomUUID(),
      novelId,
      name,
      source: 'auto-extract',
      archetype: CharacterArchetype.SUPPORTING,
      traits: [],
      motivations: [],
      backstory: '',
      relationships: [],
      speechPatterns: [],
      arcStage: 'unknown',
      povAffinity: 0,
    })
  }

  private calculateCharacterCompleteness(character: CharacterProfile): number {
    let score = 0
    const weights = {
      hasTraits: 0.25,
      hasArchetype: 0.15,
      hasSpeechPatterns: 0.15,
      hasBackstory: 0.15,
      hasRelationships: 0.15,
      hasMotivations: 0.15,
    }

    if (character.traits.length > 0) score += weights.hasTraits
    if (character.archetype !== CharacterArchetype.SUPPORTING) score += weights.hasArchetype
    if (character.speechPatterns.length > 0) score += weights.hasSpeechPatterns
    if (character.backstory.length > 0) score += weights.hasBackstory
    if (character.relationships.length > 0) score += weights.hasRelationships
    if (character.motivations.length > 0) score += weights.hasMotivations

    return Math.round(score * 1000) / 1000
  }

  private calculateWorldRuleCompleteness(rule: WorldRule): number {
    let score = 0
    const weights = {
      hasDescription: 0.4,
      hasCategory: 0.2,
      hasConstraints: 0.2,
      hasExceptions: 0.1,
      hasRelatedEntities: 0.1,
    }

    if (rule.description.length > 10) score += weights.hasDescription
    if (rule.category !== WorldRuleCategory.SOCIAL) score += weights.hasCategory
    if (rule.constraints.length > 0) score += weights.hasConstraints
    if (rule.exceptions.length > 0) score += weights.hasExceptions
    if (rule.relatedEntities.length > 0) score += weights.hasRelatedEntities

    return Math.round(score * 1000) / 1000
  }

  private calculatePlotThreadCompleteness(thread: PlotThread): number {
    let score = 0
    const weights = {
      hasPremise: 0.25,
      hasGoal: 0.25,
      hasStakes: 0.15,
      hasCharacters: 0.15,
      hasEvents: 0.1,
      hasStatus: 0.1,
    }

    if (thread.premise.length > 5) score += weights.hasPremise
    if (thread.goal.length > 5) score += weights.hasGoal
    if (thread.stakes.length > 5) score += weights.hasStakes
    if (thread.involvedCharacters.length > 0) score += weights.hasCharacters
    if (thread.keyEvents.length > 0) score += weights.hasEvents
    if (thread.status !== PlotThreadStatus.SETUP) score += weights.hasStatus

    return Math.round(score * 1000) / 1000
  }

  private calculateTimelineEventCompleteness(event: TimelineEvent): number {
    let score = 0
    const weights = {
      hasDescription: 0.3,
      hasTimestamp: 0.2,
      hasParticipants: 0.2,
      hasConsequences: 0.15,
      hasChapterRef: 0.15,
    }

    if (event.description.length > 10) score += weights.hasDescription
    if (event.timestamp.length > 0) score += weights.hasTimestamp
    if (event.participants.length > 0) score += weights.hasParticipants
    if (event.consequences.length > 0) score += weights.hasConsequences
    if (event.chapterRef.length > 0) score += weights.hasChapterRef

    return Math.round(score * 1000) / 1000
  }

  private truncateName(text: string, maxLength: number): string {
    const cleaned = text.trim().replace(/[\n\r]/g, ' ')
    return cleaned.length > maxLength ? cleaned.slice(0, maxLength) + '...' : cleaned
  }

  private deduplicateByDescription<T extends { description?: string; premise?: string }>(
    items: T[],
    keyField: 'description' | 'premise' = 'description',
  ): T[] {
    const seen = new Set<string>()
    const result: T[] = []

    for (const item of items) {
      const text = (item[keyField] ?? '').slice(0, 50)
      if (text.length < 10) {
        result.push(item)
        continue
      }

      // Simple dedup by first 50 chars
      if (!seen.has(text)) {
        seen.add(text)
        result.push(item)
      }
    }

    return result
  }
}

// ============================================================
// Factory
// ============================================================

export function createStoryBibleExtractor(options?: ExtractionOptions): StoryBibleExtractor {
  return new StoryBibleExtractor(options)
}
