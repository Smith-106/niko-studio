/**
 * Pacing Navigator
 *
 * Forward-looking pacing analysis that generates "pacing prescriptions" —
 * recommendations for where to add climax, turning_point, or breathing_room.
 * Integrates with foreshadowing analysis to recommend harvest timing.
 */

import { analyzeRetentionRhythm, type RetentionRhythmResult } from './writing-craft/retention-rhythm';
import { analyzeEmotionalArc, type EmotionalArcResult } from './emotional-arc';


// ============================================================
// Types
// ============================================================

export type PrescriptionType = 'climax' | 'turning_point' | 'breathing_room' | 'foreshadow_harvest' | 'escalation';

export interface PacingPrescription {
  chapterIndex: number;
  type: PrescriptionType;
  label: string;
  priority: 'low' | 'medium' | 'high';
  reason: string;
}

export interface PacingNavigatorResult {
  prescriptions: PacingPrescription[];
  pacingScore: number;
  rhythmAnalysis: RetentionRhythmResult | null;
  emotionalArc: EmotionalArcResult | null;
  suggestions: string[];
}

// ============================================================
// Prescription Generation
// ============================================================

const PRESCRIPTION_LABELS: Record<PrescriptionType, string> = {
  climax: '高潮',
  turning_point: '转折点',
  breathing_room: '喘息空间',
  foreshadow_harvest: '伏笔回收',
  escalation: '升级',
};

function generateTensionPrescriptions(
  arcResult: EmotionalArcResult,
): PacingPrescription[] {
  const prescriptions: PacingPrescription[] = [];

  for (const desert of arcResult.tensionDeserts) {
    const midChapter = Math.floor((desert.startChapter + desert.endChapter) / 2);

    if (desert.severity === 'high') {
      prescriptions.push({
        chapterIndex: midChapter,
        type: 'climax',
        label: PRESCRIPTION_LABELS.climax,
        priority: 'high',
        reason: `连续 ${desert.length} 章缺乏情感张力，需要在此处插入高潮场景`,
      });

      prescriptions.push({
        chapterIndex: desert.startChapter,
        type: 'turning_point',
        label: PRESCRIPTION_LABELS.turning_point,
        priority: 'medium',
        reason: '情感沙漠起点需要转折来打破沉闷',
      });
    } else {
      prescriptions.push({
        chapterIndex: midChapter,
        type: 'escalation',
        label: PRESCRIPTION_LABELS.escalation,
        priority: desert.severity === 'medium' ? 'medium' : 'low',
        reason: `${desert.length} 章情感起伏不足，建议逐步升级冲突`,
      });
    }
  }

  return prescriptions;
}

function generateBreathingRoomPrescriptions(
  arcResult: EmotionalArcResult,
): PacingPrescription[] {
  const prescriptions: PacingPrescription[] = [];
  const { timeline } = arcResult;

  for (let i = 1; i < timeline.length; i++) {
    const jump = timeline[i].emotionalIntensity - timeline[i - 1].emotionalIntensity;
    if (jump > 0.4 && timeline[i].emotionalIntensity > 0.7) {
      const nextChapter = timeline[i + 1]?.chapterIndex ?? timeline[i].chapterIndex + 1;
      prescriptions.push({
        chapterIndex: nextChapter,
        type: 'breathing_room',
        label: PRESCRIPTION_LABELS.breathing_room,
        priority: 'low',
        reason: `章节 ${timeline[i].chapterIndex} 情感强度骤升，后续建议安排喘息空间`,
      });
    }
  }

  return prescriptions;
}

const FORESHADOW_HINTS = [
  '伏笔', '暗线', '隐藏', '秘密', '不为人知', '暗示', '隐喻',
  '其实', '真相', '幕后', '早有预谋', '一直在', '原来',
];

function generateForeshadowPrescriptions(
  chapters: Array<{ content: string; chapterIndex: number }>,
): PacingPrescription[] {
  const prescriptions: PacingPrescription[] = [];

  for (const chapter of chapters) {
    const foundHints = FORESHADOW_HINTS.filter((h) => chapter.content.includes(h));

    if (foundHints.length > 0) {
      const harvestChapter = chapter.chapterIndex + 5;
      prescriptions.push({
        chapterIndex: harvestChapter,
        type: 'foreshadow_harvest',
        label: PRESCRIPTION_LABELS.foreshadow_harvest,
        priority: 'medium',
        reason: `章节 ${chapter.chapterIndex} 检测到伏笔线索（${foundHints.slice(0, 3).join('、')}），建议在章节 ${harvestChapter} 附近回收`,
      });
    }
  }

  return prescriptions;
}

function deduplicatePrescriptions(prescriptions: PacingPrescription[]): PacingPrescription[] {
  const seen = new Set<string>();
  return prescriptions.filter((p) => {
    const key = `${p.chapterIndex}-${p.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ============================================================
// Public API
// ============================================================

export function navigatePacing(
  chapters: Array<{ content: string; chapterIndex: number }>,
  payWallChapter?: number,
): PacingNavigatorResult {
  if (chapters.length === 0) {
    return {
      prescriptions: [],
      pacingScore: 0,
      rhythmAnalysis: null,
      emotionalArc: null,
      suggestions: ['没有章节数据'],
    };
  }

  const rhythmResult = analyzeRetentionRhythm(chapters, payWallChapter);
  const arcResult = analyzeEmotionalArc(chapters);

  let prescriptions: PacingPrescription[] = [
    ...generateTensionPrescriptions(arcResult),
    ...generateBreathingRoomPrescriptions(arcResult),
    ...generateForeshadowPrescriptions(chapters),
  ];

  prescriptions = deduplicatePrescriptions(prescriptions);
  prescriptions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const rhythmWeight = 0.4;
  const arcWeight = 0.4;
  const prescriptionPenaltyWeight = 0.2;

  const rhythmNorm = Math.min(100, rhythmResult.rhythmScore);
  const arcNorm = Math.min(100, arcResult.overallArcScore);
  const highPriorityCount = prescriptions.filter((p) => p.priority === 'high').length;
  const prescriptionPenalty = Math.min(100, highPriorityCount * 15);

  const pacingScore = Math.round(
    rhythmNorm * rhythmWeight + arcNorm * arcWeight + (100 - prescriptionPenalty) * prescriptionPenaltyWeight,
  );

  const suggestions: string[] = [];
  if (highPriorityCount > 3) {
    suggestions.push(`存在 ${highPriorityCount} 个高优先级节奏问题，建议优先处理情感沙漠区域`);
  }
  if (rhythmResult.rhythmScore < 30) {
    suggestions.push('留存节奏分数偏低，建议检查钩子和爽点分布');
  }
  if (arcResult.tensionDeserts.length > 0) {
    suggestions.push(`检测到 ${arcResult.tensionDeserts.length} 处情感沙漠，最长 ${Math.max(...arcResult.tensionDeserts.map((d) => d.length))} 章`);
  }
  if (suggestions.length === 0) {
    suggestions.push('节奏结构良好，钩子、爽点、情感弧线分布合理');
  }

  return {
    prescriptions,
    pacingScore,
    rhythmAnalysis: rhythmResult,
    emotionalArc: arcResult,
    suggestions,
  };
}
