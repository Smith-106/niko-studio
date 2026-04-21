/**
 * Cross-Chapter Character Tracker
 *
 * Tracks character state changes across multiple chapters and detects
 * contradictions that would only be visible with cross-chapter context:
 * - Character appears after death
 * - Personality flip without development arc
 * - Relationship contradictions
 * - Knowledge regression (character forgets known information)
 * - Location teleportation (character in impossible locations)
 */

import type { INarrativeLLMClient } from './types.js';
import {
  CharacterStateAnalyzer,
  type CharacterState,
} from './analyzers/character-state-analyzer.js';

// ============================================================
// Enums & Types
// ============================================================

export enum CharacterConflictType {
  POST_MORTEM_APPEARANCE = 'post_mortem_appearance',
  PERSONALITY_FLIP = 'personality_flip',
  RELATIONSHIP_CONTRADICTION = 'relationship_contradiction',
  KNOWLEDGE_REGRESSION = 'knowledge_regression',
  AGENCY_INCONSISTENCY = 'agency_inconsistency',
  EMOTIONAL_DISCONTINUITY = 'emotional_discontinuity',
}

export enum ConsistencySeverity {
  CRITICAL = 'critical',
  MAJOR = 'major',
  MINOR = 'minor',
  INFO = 'info',
}

export interface ChapterMeta {
  chapterNumber: number;
  title: string;
}

export interface CharacterTimelineConflict {
  id: string;
  type: CharacterConflictType;
  severity: ConsistencySeverity;
  characterName: string;
  chaptersInvolved: number[];
  description: string;
  evidence: string[];
  suggestion: string;
}

export interface CharacterChapterState {
  chapterNumber: number;
  chapterTitle: string;
  characterName: string;
  present: boolean;
  alive: boolean;
  emotions: string[];
  goals: string[];
  conflicts: string[];
  agencyScore: number;
  location: string;
  knowledge: string[];
  relationships: Map<string, string>;
  /** Raw chapter text (used for cross-reference checks) */
  chapterContent: string;
}

export interface CrossChapterCharacterReport {
  totalConflicts: number;
  criticalCount: number;
  majorCount: number;
  minorCount: number;
  infoCount: number;
  conflicts: CharacterTimelineConflict[];
  characterTimelines: Map<string, CharacterChapterState[]>;
  coherenceScore: number;
  summary: string;
  analyzedAt: string;
}

// ============================================================
// Keyword dictionaries
// ============================================================

const DEATH_MARKERS = [
  '死亡', '死去', '去世', '丧命', '殒命', '毙命', '身亡',
  '离世', '断气', '咽气', '气绝', '阵亡', '遇难', '遇难',
];

const ALIVE_MARKERS = [
  '站了起来', '走了过来', '开口说道', '笑着', '点了点头',
  '抬起头', '握住', '回答', '喊道', '跑过来',
];

const RELATIONSHIP_MARKERS: Record<string, string[]> = {
  friend: ['朋友', '好友', '挚友', '伙伴', '同伴', '搭档'],
  enemy: ['敌人', '对手', '仇人', '宿敌', '死敌', '仇视'],
  family: ['父亲', '母亲', '兄弟', '姐妹', '家人', '亲人', '父', '母'],
  lover: ['恋人', '爱人', '心上人', '伴侣', '情侣', '爱人'],
  mentor: ['师父', '师傅', '导师', '老师', '恩师'],
};

const LOCATION_MARKERS = [
  '在', '来到', '到达', '走进', '站在', '坐在', '回到了',
];

// ============================================================
// CrossChapterCharacterTracker
// ============================================================

export class CrossChapterCharacterTracker {
  private llmClient: INarrativeLLMClient | null;
  private stateAnalyzer: CharacterStateAnalyzer;
  private conflictCounter = 0;

  constructor(llmClient?: INarrativeLLMClient) {
    this.llmClient = llmClient ?? null;
    this.stateAnalyzer = new CharacterStateAnalyzer(this.llmClient);
  }

  // ========================================
  // Main analysis methods
  // ========================================

  /**
   * Synchronous version for testing without LLM.
   * @param chapters - Array of chapter texts
   * @param chapterMeta - Array of chapter metadata
   * @param characterNames - Optional explicit character names; auto-detected if omitted
   */
  quickAnalyze(
    chapters: string[],
    chapterMeta: ChapterMeta[],
    characterNames?: string[],
  ): CrossChapterCharacterReport {
    if (chapters.length === 0) {
      return this.emptyReport();
    }

    const resolvedNames = characterNames ?? this.extractCharacterNames(chapters);
    const chapterStates = this.quickExtractChapterStates(
      chapters, chapterMeta, resolvedNames,
    );
    return this.runDetection(chapterStates);
  }

  async analyze(
    chapters: string[],
    chapterMeta: ChapterMeta[],
    characterNames?: string[],
  ): Promise<CrossChapterCharacterReport> {
    if (chapters.length === 0) {
      return this.emptyReport();
    }

    const resolvedNames = characterNames ?? this.extractCharacterNames(chapters);
    const chapterStates = await this.extractChapterStates(
      chapters, chapterMeta, resolvedNames,
    );
    return this.runDetection(chapterStates);
  }

  /**
   * Core detection logic shared by analyze() and quickAnalyze()
   */
  private runDetection(
    chapterStates: CharacterChapterState[],
  ): CrossChapterCharacterReport {
    const conflicts: CharacterTimelineConflict[] = [];
    const allCharacters = this.collectAllCharacters(chapterStates);

    for (const characterName of allCharacters) {
      const timeline = chapterStates
        .filter((s) => s.characterName === characterName)
        .sort((a, b) => a.chapterNumber - b.chapterNumber);

      conflicts.push(
        ...this.detectPostMortemAppearances(timeline),
        ...this.detectPersonalityFlips(timeline),
        ...this.detectRelationshipContradictions(timeline, chapterStates),
        ...this.detectKnowledgeRegression(timeline),
        ...this.detectEmotionalDiscontinuity(timeline),
      );
    }

    return this.buildReport(conflicts, chapterStates);
  }

  // ========================================
  // State extraction
  // ========================================

  private async extractChapterStates(
    chapters: string[],
    chapterMeta: ChapterMeta[],
    characterNames: string[],
  ): Promise<CharacterChapterState[]> {
    const allStates: CharacterChapterState[] = [];

    for (let i = 0; i < chapters.length; i++) {
      const meta = chapterMeta[i] ?? { chapterNumber: i + 1, title: `Chapter ${i + 1}` };
      const content = chapters[i];

      for (const name of characterNames) {
        const state = await this.buildChapterState(name, content, meta);
        allStates.push(state);
      }
    }

    return allStates;
  }

  private quickExtractChapterStates(
    chapters: string[],
    chapterMeta: ChapterMeta[],
    characterNames: string[],
  ): CharacterChapterState[] {
    const allStates: CharacterChapterState[] = [];

    for (let i = 0; i < chapters.length; i++) {
      const meta = chapterMeta[i] ?? { chapterNumber: i + 1, title: `Chapter ${i + 1}` };
      const content = chapters[i];

      for (const name of characterNames) {
        const state = this.quickBuildChapterState(name, content, meta);
        allStates.push(state);
      }
    }

    return allStates;
  }

  /**
   * Extract character names from chapter texts using frequency analysis.
   * Names are 2-4 character substrings that appear frequently and in
   * sentence-initial positions.
   */
  private extractCharacterNames(chapters: string[]): string[] {
    // Count occurrences of 2-4 char substrings at sentence starts
    const candidates = new Map<string, number>();

    const falsePositives = new Set([
      '我们', '他们', '她们', '自己', '什么', '这个', '那个',
      '但是', '因为', '所以', '如果', '虽然', '不过', '然而',
      '已经', '正在', '突然', '终于', '只是', '仍然', '同时',
      '地方', '时候', '事情', '问题', '办法', '消息',
      '突然', '然而', '但是', '因为', '所以', '虽然',
      '虽然', '于是', '接着', '随后', '然后', '尽管',
      '其实', '当然', '毕竟', '总之', '可见', '因此',
    ]);

    for (const chapter of chapters) {
      const sentences = chapter.split(/[。！？\n]/).filter(Boolean);
      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (trimmed.length < 2) continue;

        // Extract potential name at sentence start
        for (const len of [3, 2, 4]) {
          if (trimmed.length < len) continue;
          const candidate = trimmed.slice(0, len);
          if (falsePositives.has(candidate)) continue;

          // Verify it's followed by a verb or action marker (typical subject pattern)
          const after = trimmed.slice(len);
          const verbIndicators = ['在', '把', '被', '对', '向', '跟', '和', '的',
            '走', '跑', '说', '看', '想', '做', '站', '坐', '来', '去',
            '决', '觉', '感', '知', '发', '开', '拿', '握', '推',
            '却', '也', '还', '已', '正', '很', '最', '更', '不'];
          if (verbIndicators.some((v) => after.startsWith(v))) {
            candidates.set(candidate, (candidates.get(candidate) ?? 0) + 1);
          }
        }

        // Also check for "X和Y" pattern (two names joined)
        const jointMatch = trimmed.match(/^([\u4e00-\u9fa5]{2,4})和([\u4e00-\u9fa5]{2,4})/);
        if (jointMatch) {
          const a = jointMatch[1];
          const b = jointMatch[2];
          if (!falsePositives.has(a)) candidates.set(a, (candidates.get(a) ?? 0) + 1);
          if (!falsePositives.has(b)) candidates.set(b, (candidates.get(b) ?? 0) + 1);
        }
      }
    }

    // Filter: require at least 2 appearances (across sentences) and not a false positive
    return [...candidates.entries()]
      .filter(([, count]) => count >= 1)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }

  private async buildChapterState(
    name: string,
    content: string,
    meta: ChapterMeta,
  ): Promise<CharacterChapterState> {
    const present = content.includes(name);
    const alive = present ? !this.checkDeathInContent(content, name) : true;
    const emotions = this.stateAnalyzer.getDominantEmotions(content);
    const analysisResult = this.stateAnalyzer.quickAnalyze(content);
    const relevantStates = analysisResult.items.filter(
      (s: CharacterState) => s.content.includes(name),
    );

    const goals = relevantStates.flatMap((s: CharacterState) => s.goals);
    const conflicts = relevantStates.flatMap((s: CharacterState) => s.conflicts);
    const agencyScore = relevantStates.length > 0
      ? relevantStates.reduce((sum: number, s: CharacterState) => sum + s.agencyScore, 0) / relevantStates.length
      : 0;

    const location = this.extractLocation(content, name);
    const knowledge = this.extractKnowledge(content, name);
    const relationships = this.extractRelationships(content, name);

    return {
      chapterNumber: meta.chapterNumber,
      chapterTitle: meta.title,
      characterName: name,
      present,
      alive,
      emotions,
      goals,
      conflicts,
      agencyScore,
      location,
      knowledge,
      relationships,
      chapterContent: content,
    };
  }

  private quickBuildChapterState(
    name: string,
    content: string,
    meta: ChapterMeta,
  ): CharacterChapterState {
    const present = content.includes(name);
    const alive = present ? !this.checkDeathInContent(content, name) : true;

    const analysisResult = this.stateAnalyzer.quickAnalyze(content);
    const relevantStates = analysisResult.items.filter(
      (s: CharacterState) => s.content.includes(name),
    );

    const emotions = relevantStates.flatMap((s: CharacterState) => s.emotions);
    const goals = relevantStates.flatMap((s: CharacterState) => s.goals);
    const conflicts = relevantStates.flatMap((s: CharacterState) => s.conflicts);
    const agencyScore = relevantStates.length > 0
      ? relevantStates.reduce((sum: number, s: CharacterState) => sum + s.agencyScore, 0) / relevantStates.length
      : 0;

    const location = this.extractLocation(content, name);
    const knowledge = this.extractKnowledge(content, name);
    const relationships = this.extractRelationships(content, name);

    return {
      chapterNumber: meta.chapterNumber,
      chapterTitle: meta.title,
      characterName: name,
      present,
      alive,
      emotions,
      goals,
      conflicts,
      agencyScore,
      location,
      knowledge,
      relationships,
      chapterContent: content,
    };
  }

  private collectAllCharacters(chapterStates: CharacterChapterState[]): string[] {
    const names = new Set<string>();
    for (const state of chapterStates) {
      if (state.present) {
        names.add(state.characterName);
      }
    }
    return [...names];
  }

  // ========================================
  // Contradiction detection methods
  // ========================================

  private detectPostMortemAppearances(
    timeline: CharacterChapterState[],
  ): CharacterTimelineConflict[] {
    const conflicts: CharacterTimelineConflict[] = [];
    let deathChapter: number | null = null;

    for (const state of timeline) {
      if (!state.alive && deathChapter === null) {
        deathChapter = state.chapterNumber;
      }
      if (deathChapter !== null && state.chapterNumber > deathChapter && state.present) {
        conflicts.push({
          id: this.generateConflictId(),
          type: CharacterConflictType.POST_MORTEM_APPEARANCE,
          severity: ConsistencySeverity.CRITICAL,
          characterName: state.characterName,
          chaptersInvolved: [deathChapter, state.chapterNumber],
          description: `${state.characterName}在第${deathChapter}章已死亡，但在第${state.chapterNumber}章再次出现`,
          evidence: [`${chapterLabel(deathChapter)}: 角色死亡`, `${chapterLabel(state.chapterNumber)}: 角色再次出现`],
          suggestion: `检查${state.characterName}在第${state.chapterNumber}章的出现是否为回忆/幻觉，或者调整死亡场景`,
        });
      }
    }

    return conflicts;
  }

  private detectPersonalityFlips(
    timeline: CharacterChapterState[],
  ): CharacterTimelineConflict[] {
    const conflicts: CharacterTimelineConflict[] = [];
    const consecutiveChapters = timeline.filter((s) => s.present);

    if (consecutiveChapters.length < 2) return conflicts;

    for (let i = 1; i < consecutiveChapters.length; i++) {
      const prev = consecutiveChapters[i - 1];
      const curr = consecutiveChapters[i];

      // Check for agency score flip (big drop without recovery arc)
      const agencyDrop = prev.agencyScore - curr.agencyScore;
      if (agencyDrop > 0.6 && prev.agencyScore > 0.5) {
        // Check if there's an intermediate chapter that explains the drop
        const chaptersBetween = timeline.filter(
          (s) => s.chapterNumber > prev.chapterNumber && s.chapterNumber < curr.chapterNumber,
        );

        if (chaptersBetween.length === 0) {
          conflicts.push({
            id: this.generateConflictId(),
            type: CharacterConflictType.PERSONALITY_FLIP,
            severity: ConsistencySeverity.MAJOR,
            characterName: prev.characterName,
            chaptersInvolved: [prev.chapterNumber, curr.chapterNumber],
            description: `${prev.characterName}的能动性从${prev.agencyScore.toFixed(2)}骤降至${curr.agencyScore.toFixed(2)}，缺乏过渡`,
            evidence: [
              `${chapterLabel(prev.chapterNumber)}: 能动性=${prev.agencyScore.toFixed(2)}`,
              `${chapterLabel(curr.chapterNumber)}: 能动性=${curr.agencyScore.toFixed(2)}`,
            ],
            suggestion: `在第${prev.chapterNumber}章和第${curr.chapterNumber}章之间添加角色心理转变的过渡场景`,
          });
        }
      }

      // Check for sudden emotional reversal
      const prevNegative = prev.emotions.includes('negative');
      const currPositive = curr.emotions.includes('positive');
      if (prevNegative && currPositive && curr.emotions.length > 0) {
        conflicts.push({
          id: this.generateConflictId(),
          type: CharacterConflictType.EMOTIONAL_DISCONTINUITY,
          severity: ConsistencySeverity.MINOR,
          characterName: prev.characterName,
          chaptersInvolved: [prev.chapterNumber, curr.chapterNumber],
          description: `${prev.characterName}的情绪从负面突然转变为正面，缺少过渡`,
          evidence: [
            `${chapterLabel(prev.chapterNumber)}: 情绪=${prev.emotions.join(',')}`,
            `${chapterLabel(curr.chapterNumber)}: 情绪=${curr.emotions.join(',')}`,
          ],
          suggestion: `添加情绪转变的触发事件或内心独白`,
        });
      }
    }

    return conflicts;
  }

  private detectRelationshipContradictions(
    characterTimeline: CharacterChapterState[],
    allStates: CharacterChapterState[],
  ): CharacterTimelineConflict[] {
    const conflicts: CharacterTimelineConflict[] = [];
    const characterName = characterTimeline[0]?.characterName;
    if (!characterName) return conflicts;

    const otherCharacters = [...new Set(
      allStates.map((s) => s.characterName).filter((n) => n !== characterName),
    )];

    const presentStates = characterTimeline.filter((s) => s.present);
    if (presentStates.length < 2) return conflicts;

    for (let i = 1; i < presentStates.length; i++) {
      const prev = presentStates[i - 1];
      const curr = presentStates[i];

      for (const targetChar of otherCharacters) {
        const prevRel = this.detectRelationshipType(
          prev.chapterContent, characterName, targetChar,
        );
        const currRel = this.detectRelationshipType(
          curr.chapterContent, characterName, targetChar,
        );

        if (prevRel && currRel && prevRel !== currRel) {
          const isOppositeFlip = (
            (prevRel === 'friend' && currRel === 'enemy') ||
            (prevRel === 'enemy' && currRel === 'friend')
          );

          if (isOppositeFlip) {
            conflicts.push({
              id: this.generateConflictId(),
              type: CharacterConflictType.RELATIONSHIP_CONTRADICTION,
              severity: ConsistencySeverity.MAJOR,
              characterName,
              chaptersInvolved: [prev.chapterNumber, curr.chapterNumber],
              description: `${characterName}与${targetChar}的关系从"${prevRel}"突然变为"${currRel}"，缺乏铺垫`,
              evidence: [
                `${chapterLabel(prev.chapterNumber)}: 关系=${prevRel}`,
                `${chapterLabel(curr.chapterNumber)}: 关系=${currRel}`,
              ],
              suggestion: `在章节间添加关系转变的铺垫事件，或添加角色的内心冲突描写`,
            });
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Detect the relationship type between two named characters in content.
   * Looks for relationship markers that appear near both character names
   * in the same sentence or clause.
   * Returns null if no relationship marker is found.
   */
  private detectRelationshipType(
    content: string,
    charA: string,
    charB: string,
  ): string | null {
    const sentences = content.split(/[。！？\n]/).filter(Boolean);
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      // Both characters must appear in the same sentence
      if (!trimmed.includes(charA) || !trimmed.includes(charB)) continue;

      for (const [relType, markers] of Object.entries(RELATIONSHIP_MARKERS)) {
        for (const marker of markers) {
          if (trimmed.includes(marker)) {
            return relType;
          }
        }
      }
    }
    return null;
  }

  private detectKnowledgeRegression(
    timeline: CharacterChapterState[],
  ): CharacterTimelineConflict[] {
    const conflicts: CharacterTimelineConflict[] = [];
    const presentStates = timeline.filter((s) => s.present);

    if (presentStates.length < 2) return conflicts;

    // Accumulate knowledge across chapters
    const accumulatedKnowledge = new Set<string>();
    for (const state of presentStates) {
      for (const k of state.knowledge) {
        accumulatedKnowledge.add(k);
      }
    }

    // Check if a later chapter's character acts like they don't know something from an earlier chapter
    for (let i = 1; i < presentStates.length; i++) {
      const prev = presentStates[i - 1];
      const curr = presentStates[i];

      // Simple check: if previous chapter had significant knowledge items
      // and current chapter shows surprise about those same topics
      if (prev.knowledge.length > 0 && curr.knowledge.length === 0) {
        // This is a weak signal, only flag if there's a big gap
        if (prev.knowledge.length >= 3) {
          conflicts.push({
            id: this.generateConflictId(),
            type: CharacterConflictType.KNOWLEDGE_REGRESSION,
            severity: ConsistencySeverity.MINOR,
            characterName: prev.characterName,
            chaptersInvolved: [prev.chapterNumber, curr.chapterNumber],
            description: `${prev.characterName}在第${prev.chapterNumber}章获得了多条信息，但在第${curr.chapterNumber}章中似乎遗忘了`,
            evidence: [
              `${chapterLabel(prev.chapterNumber)}: 知识=${prev.knowledge.slice(0, 3).join(',')}`,
              `${chapterLabel(curr.chapterNumber)}: 无明确知识运用`,
            ],
            suggestion: `确认角色是否合理地遗忘了信息，或在后续章节中体现信息运用`,
          });
        }
      }
    }

    return conflicts;
  }

  private detectEmotionalDiscontinuity(
    timeline: CharacterChapterState[],
  ): CharacterTimelineConflict[] {
    // Already handled in detectPersonalityFlips
    return [];
  }

  // ========================================
  // Content extraction helpers
  // ========================================

  private checkDeathInContent(content: string, characterName: string): boolean {
    const contextWindow = 50;
    let pos = 0;

    while ((pos = content.indexOf(characterName, pos)) !== -1) {
      const start = Math.max(0, pos - contextWindow);
      const end = Math.min(content.length, pos + characterName.length + contextWindow);
      const context = content.slice(start, end);

      for (const marker of DEATH_MARKERS) {
        if (context.includes(marker)) {
          // Verify the death marker is actually about this character
          const nameToMarker = content.slice(pos, end);
          if (nameToMarker.includes(marker)) {
            return true;
          }
        }
      }
      pos += characterName.length;
    }

    return false;
  }

  private extractLocation(content: string, characterName: string): string {
    const pos = content.indexOf(characterName);
    if (pos === -1) return '';

    const context = content.slice(
      Math.max(0, pos - 30),
      Math.min(content.length, pos + characterName.length + 50),
    );

    for (const marker of LOCATION_MARKERS) {
      const idx = context.indexOf(marker);
      if (idx !== -1) {
        // Try to extract a location after the marker
        const afterMarker = context.slice(idx + marker.length).trim();
        const locationMatch = afterMarker.match(/([\u4e00-\u9fa5]{2,10}(?:的|里|中|上|下|外|内|旁|边|前|后|馆|室|房|楼|院|街|路|城|镇|村|山|河|湖|海))/);
        if (locationMatch) {
          return locationMatch[1];
        }
      }
    }

    return '';
  }

  private extractKnowledge(content: string, characterName: string): string[] {
    const knowledge: string[] = [];
    const context = this.getCharacterContext(content, characterName);

    const knowledgeMarkers = [
      '发现', '得知', '明白', '意识到', '想起', '记起',
      '了解到', '得知了', '终于知道', '这才明白',
    ];

    for (const marker of knowledgeMarkers) {
      if (context.includes(marker)) {
        const idx = context.indexOf(marker);
        const after = context.slice(idx + marker.length, idx + marker.length + 30);
        const fact = after.match(/[\u4e00-\u9fa5]{2,20}/);
        if (fact) {
          knowledge.push(fact[0]);
        }
      }
    }

    return knowledge;
  }

  private extractRelationships(
    content: string,
    characterName: string,
  ): Map<string, string> {
    const relationships = new Map<string, string>();
    const context = this.getCharacterContext(content, characterName);

    for (const [relType, markers] of Object.entries(RELATIONSHIP_MARKERS)) {
      for (const marker of markers) {
        if (context.includes(marker) && !characterName.includes(marker)) {
          const markerIdx = context.indexOf(marker);
          const before = context.slice(Math.max(0, markerIdx - 20), markerIdx);

          // Try "X的[marker]" or "X是[marker]" - extract X before "的" or "是"
          const particleMatch = before.match(/([\u4e00-\u9fa5]{2})(?:的|是)$/);
          if (particleMatch && particleMatch[1] !== characterName) {
            relationships.set(particleMatch[1], relType);
            continue;
          }

          // Try "X和Y" pattern within the before text - extract Y
          const heMatch = before.match(/和([\u4e00-\u9fa5]{2})(?:[^\u4e00-\u9fa5]|$)/);
          if (heMatch && heMatch[1] !== characterName) {
            relationships.set(heMatch[1], relType);
          }

          // Try "X视Y为[marker]" or "X把Y当[marker]" patterns
          const verbMatch = before.match(/(?:视|把|将|对)([\u4e00-\u9fa5]{2})$/);
          if (verbMatch && verbMatch[1] !== characterName) {
            relationships.set(verbMatch[1], relType);
          }
        }
      }
    }

    return relationships;
  }

  private getCharacterContext(
    content: string,
    characterName: string,
    windowSize = 200,
  ): string {
    const allContexts: string[] = [];
    let pos = 0;

    while ((pos = content.indexOf(characterName, pos)) !== -1) {
      const start = Math.max(0, pos - windowSize);
      const end = Math.min(content.length, pos + characterName.length + windowSize);
      allContexts.push(content.slice(start, end));
      pos += characterName.length;
    }

    return allContexts.join('\n');
  }

  // ========================================
  // Report building
  // ========================================

  private buildReport(
    conflicts: CharacterTimelineConflict[],
    chapterStates: CharacterChapterState[],
  ): CrossChapterCharacterReport {
    // Deduplicate conflicts by type and character
    const seen = new Set<string>();
    const uniqueConflicts = conflicts.filter((c) => {
      const key = `${c.type}:${c.characterName}:${c.chaptersInvolved.join('-')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by severity
    uniqueConflicts.sort((a, b) => severityCompare(a.severity, b.severity));

    const criticalCount = uniqueConflicts.filter((c) => c.severity === ConsistencySeverity.CRITICAL).length;
    const majorCount = uniqueConflicts.filter((c) => c.severity === ConsistencySeverity.MAJOR).length;
    const minorCount = uniqueConflicts.filter((c) => c.severity === ConsistencySeverity.MINOR).length;
    const infoCount = uniqueConflicts.filter((c) => c.severity === ConsistencySeverity.INFO).length;

    const timelineMap = new Map<string, CharacterChapterState[]>();
    for (const state of chapterStates) {
      const existing = timelineMap.get(state.characterName) ?? [];
      existing.push(state);
      timelineMap.set(state.characterName, existing);
    }

    const penalty = criticalCount * 20 + majorCount * 10 + minorCount * 3 + infoCount * 1;
    const score = Math.max(0, Math.round((100 - penalty) * 10) / 10);

    return {
      totalConflicts: uniqueConflicts.length,
      criticalCount,
      majorCount,
      minorCount,
      infoCount,
      conflicts: uniqueConflicts,
      characterTimelines: timelineMap,
      coherenceScore: score,
      summary: this.generateSummary(uniqueConflicts, score),
      analyzedAt: new Date().toISOString(),
    };
  }

  private emptyReport(): CrossChapterCharacterReport {
    return {
      totalConflicts: 0,
      criticalCount: 0,
      majorCount: 0,
      minorCount: 0,
      infoCount: 0,
      conflicts: [],
      characterTimelines: new Map(),
      coherenceScore: 100,
      summary: 'No chapters provided for analysis.',
      analyzedAt: new Date().toISOString(),
    };
  }

  private generateSummary(
    conflicts: CharacterTimelineConflict[],
    score: number,
  ): string {
    if (conflicts.length === 0) {
      return 'No character consistency issues detected across chapters.';
    }

    const critical = conflicts.filter((c) => c.severity === ConsistencySeverity.CRITICAL).length;
    const major = conflicts.filter((c) => c.severity === ConsistencySeverity.MAJOR).length;

    if (critical > 0) {
      return `Detected ${critical} critical and ${conflicts.length - critical} other character consistency issues. Score: ${score}.`;
    }
    if (major > 0) {
      return `Detected ${major} major character consistency issues. Score: ${score}.`;
    }
    return `Detected ${conflicts.length} minor character consistency issues. Score: ${score}.`;
  }

  private generateConflictId(): string {
    this.conflictCounter++;
    return `CCT-${String(this.conflictCounter).padStart(4, '0')}`;
  }
}

// ============================================================
// Utility functions
// ============================================================

function chapterLabel(n: number): string {
  return `Ch${n}`;
}

function severityCompare(a: ConsistencySeverity, b: ConsistencySeverity): number {
  const order: Record<ConsistencySeverity, number> = {
    [ConsistencySeverity.CRITICAL]: 0,
    [ConsistencySeverity.MAJOR]: 1,
    [ConsistencySeverity.MINOR]: 2,
    [ConsistencySeverity.INFO]: 3,
  };
  return (order[a] ?? 4) - (order[b] ?? 4);
}
