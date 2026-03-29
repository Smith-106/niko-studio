/**
 * Layer 4: Immersion System
 *
 * Being there is the highest stage of the fictional dream - readers fully enter
 * the story and the real world completely disappears. The key to achieving this
 * ultimate goal is: Internal Conflict.
 *
 * Core technique: When a character faces a difficult choice, readers are
 * inevitably drawn into the inner storm
 */

import type { INarrativeLLMClient } from '../types';

// ---------------------------------------------------------------------------
// Enums & types
// ---------------------------------------------------------------------------

export const DilemmaType = {
  MORAL: 'moral',
  DUTY_CONFLICT: 'duty_conflict',
  VALUE_CHOICE: 'value_choice',
  EMOTIONAL: 'emotional',
  TRUST: 'trust',
} as const;

export type DilemmaType = (typeof DilemmaType)[keyof typeof DilemmaType];

// ---------------------------------------------------------------------------
// Data interfaces
// ---------------------------------------------------------------------------

export interface InternalConflict {
  dilemma: string;
  optionA: string;
  optionB: string;
  stakes: string;
  honorInvolved: boolean;
  dilemmaType: DilemmaType;
  intensity: number;
}

export interface CarrieWaitingScene {
  isDetected: boolean;
  hopeFearTension: string;
  readerParticipation: number;
}

export interface RaskolnikovMoralWar {
  isDetected: boolean;
  conscienceVsNeed: string;
  moralTorment: number;
}

export interface ImmersionAnalysisResult {
  overallScore: number;
  internalConflicts: InternalConflict[];
  carrieScene: CarrieWaitingScene;
  raskolnikovWar: RaskolnikovMoralWar;
  readerParticipation: number;
  choiceUrgency: number;
  suggestions: string[];
}

// ---------------------------------------------------------------------------
// Catalyst
// ---------------------------------------------------------------------------

export class ImmersionCatalyst {
  private llm: INarrativeLLMClient | null;

  private readonly conflictKeywords = [
    // Hesitation and struggle
    '犹豫', '挣扎', '矛盾', '两难', '左右为难', '进退两难',
    // Questions and self-questioning
    '难道', '是否', '应该', '能吗', '行吗', '对吗',
    // Opposing choices
    '一方面', '另一方面', '或者', '还是', '但是', '然而',
    // Inner war
    '内心', '心里', '灵魂', '良知', '本能', '理智',
  ];

  private readonly honorKeywords = [
    '荣誉', '尊严', '自尊', '面子', '声誉', '名誉',
    '羞耻', '耻辱', '丢脸', '抬不起头',
  ];

  private readonly moralKeywords = [
    '对', '错', '善', '恶', '正义', '邪恶',
    '应该', '不应该', '道德', '良心', '罪恶',
  ];

  constructor(llmClient: INarrativeLLMClient | null = null) {
    this.llm = llmClient;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Analyze immersion elements in text */
  async analyze(
    content: string,
    characterInfo?: Record<string, unknown>,
    empathyScore = 0,
  ): Promise<ImmersionAnalysisResult> {
    // 1. Detect internal conflicts
    const conflicts = await this.detectConflicts(content);

    // 2. Analyze Carrie waiting-scene technique
    const carrie = await this.analyzeCarrieTechnique(content);

    // 3. Analyze Raskolnikov moral-war technique
    const raskolnikov = await this.analyzeRaskolnikovTechnique(content);

    // 4. Evaluate reader participation
    const participation = this.evaluateReaderParticipation(conflicts, carrie, raskolnikov);

    // 5. Evaluate choice urgency
    const urgency = this.evaluateChoiceUrgency(content, conflicts);

    // 6. Calculate total score
    const overallScore = this.calculateScore(
      conflicts,
      participation,
      urgency,
      empathyScore,
    );

    // 7. Generate suggestions
    const suggestions = await this.generateSuggestions(
      content,
      conflicts,
      overallScore,
    );

    return {
      overallScore,
      internalConflicts: conflicts,
      carrieScene: carrie,
      raskolnikovWar: raskolnikov,
      readerParticipation: participation,
      choiceUrgency: urgency,
      suggestions,
    };
  }

  /** Quick detection of moral dilemmas */
  detectMoralDilemma(content: string): boolean {
    const hasMoral = this.moralKeywords.some((kw) => content.includes(kw));
    const hasConflict = this.conflictKeywords.some((kw) => content.includes(kw));
    return hasMoral && hasConflict;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private async detectConflicts(content: string): Promise<InternalConflict[]> {
    const conflicts: InternalConflict[] = [];
    const sentences = content.split('。');

    for (const sentence of sentences) {
      const conflictScore = this.conflictKeywords.filter((kw) =>
        sentence.includes(kw),
      ).length;

      if (conflictScore >= 2) {
        const honorInvolved = this.honorKeywords.some((kw) =>
          sentence.includes(kw),
        );

        let dilemmaType: DilemmaType = DilemmaType.EMOTIONAL;
        if (this.moralKeywords.some((kw) => sentence.includes(kw))) {
          dilemmaType = DilemmaType.MORAL;
        }

        conflicts.push({
          dilemma: sentence.trim(),
          optionA: '待分析',
          optionB: '待分析',
          stakes: '待分析',
          honorInvolved,
          dilemmaType,
          intensity: Math.min(conflictScore * 0.2, 1),
        });
      }
    }

    return conflicts;
  }

  private async analyzeCarrieTechnique(content: string): Promise<CarrieWaitingScene> {
    const hopeKeywords = ['希望', '期待', '渴望', '盼望', '想要'];
    const fearKeywords = ['害怕', '担心', '恐惧', '不安', '忧虑'];

    const hasHope = hopeKeywords.some((kw) => content.includes(kw));
    const hasFear = fearKeywords.some((kw) => content.includes(kw));

    if (hasHope && hasFear) {
      return {
        isDetected: true,
        hopeFearTension: '希望与恐惧共存',
        readerParticipation: 0.7,
      };
    }

    return {
      isDetected: false,
      hopeFearTension: '',
      readerParticipation: 0,
    };
  }

  private async analyzeRaskolnikovTechnique(content: string): Promise<RaskolnikovMoralWar> {
    const hasMoral = this.moralKeywords.some((kw) => content.includes(kw));
    const hasConflict = ['难道', '能吗', '应该'].some((kw) =>
      content.includes(kw),
    );

    if (hasMoral && hasConflict) {
      return {
        isDetected: true,
        conscienceVsNeed: '良知与需求的冲突',
        moralTorment: 0.8,
      };
    }

    return {
      isDetected: false,
      conscienceVsNeed: '',
      moralTorment: 0,
    };
  }

  private evaluateReaderParticipation(
    conflicts: InternalConflict[],
    carrie: CarrieWaitingScene,
    raskolnikov: RaskolnikovMoralWar,
  ): number {
    if (conflicts.length === 0) return 0;

    let base = conflicts.length * 15;

    if (carrie.isDetected) {
      base += carrie.readerParticipation * 20;
    }
    if (raskolnikov.isDetected) {
      base += raskolnikov.moralTorment * 25;
    }

    return Math.min(base, 100);
  }

  private evaluateChoiceUrgency(
    content: string,
    _conflicts: InternalConflict[],
  ): number {
    const urgencyKeywords = [
      '必须', '立刻', '马上', '现在', '不能等', '来不及',
      '最后', '唯一', '只有', '否则',
    ];

    const urgencyCount = urgencyKeywords.filter((kw) =>
      content.includes(kw),
    ).length;
    return Math.min(urgencyCount * 0.15, 1);
  }

  private calculateScore(
    conflicts: InternalConflict[],
    participation: number,
    urgency: number,
    empathyScore: number,
  ): number {
    const empathyBase = Math.min((empathyScore / 100) * 15, 15);
    const conflictScore = Math.min(conflicts.length * 12, 30);

    let intensityScore = 0;
    if (conflicts.length > 0) {
      intensityScore =
        (conflicts.reduce((sum, c) => sum + c.intensity, 0) / conflicts.length) * 20;
    }

    let honorMoralBonus = 0;
    for (const c of conflicts) {
      if (c.honorInvolved) honorMoralBonus += 5;
      if (c.dilemmaType === DilemmaType.MORAL) honorMoralBonus += 5;
    }
    honorMoralBonus = Math.min(honorMoralBonus, 15);

    const participationScore = participation * 0.1;
    const urgencyScore = urgency * 10;

    return Math.min(
      empathyBase +
        conflictScore +
        intensityScore +
        honorMoralBonus +
        participationScore +
        urgencyScore,
      100,
    );
  }

  private async generateSuggestions(
    _content: string,
    conflicts: InternalConflict[],
    score: number,
  ): Promise<string[]> {
    const suggestions: string[] = [];

    if (score < 40) {
      suggestions.push('沉浸元素严重不足！读者无法"成为"角色');
    }

    if (conflicts.length === 0) {
      suggestions.push('未检测到内心冲突，这是沉浸的关键！');
      suggestions.push('建议添加：');
      suggestions.push('- 让角色面临两难抉择');
      suggestions.push('- 展示角色的内心挣扎和自我质疑');
    }

    if (conflicts.length > 0 && !conflicts.some((c) => c.honorInvolved)) {
      suggestions.push('\n荣誉/自尊建议：');
      suggestions.push('- 关乎荣誉和自尊的道德抉择最能让读者沉浸');
      suggestions.push('- 考虑让角色的选择涉及个人尊严');
    }

    if (
      conflicts.length > 0 &&
      !conflicts.some((c) => c.dilemmaType === DilemmaType.MORAL)
    ) {
      suggestions.push('\n道德困境建议：');
      suggestions.push('- 道德困境迫使读者与角色一同权衡');
      suggestions.push('- 参考《罪与罚》："我难道能做吗？这太荒谬了！"');
    }

    if (score < 60) {
      suggestions.push('\n大师案例参考：');
      suggestions.push('- 《魔女嘉莉》："他会来吗？这可能是个笑话……"——希望与恐惧的拉扯');
      suggestions.push('- 《罪与罚》："我怎能容忍如此恶行？"——良知与需求的战争');
    }

    return suggestions;
  }
}
