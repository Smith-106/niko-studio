/**
 * Writing Craft — Emotion Craft (情感描写质量)
 *
 * Show-don't-tell detection engine.
 * Identifies direct emotional statements (tell) vs indirect
 * expressions (show) and provides quality assessment.
 */

export enum EmotionMode {
  TELL = 'tell',   // 直接陈述情感
  SHOW = 'show',   // 通过行为/细节间接表达
}

export interface EmotionDetection {
  mode: EmotionMode;
  text: string;
  emotion: string;
  position: number;
}

export interface EmotionCraftResult {
  totalDetections: number;
  tellCount: number;
  showCount: number;
  showRatio: number;
  score: number;
  detections: EmotionDetection[];
  suggestions: string[];
}

const TELL_PATTERNS: Array<{ pattern: string; emotion: string }> = [
  { pattern: '很生气', emotion: '愤怒' },
  { pattern: '很愤怒', emotion: '愤怒' },
  { pattern: '很难过', emotion: '悲伤' },
  { pattern: '很伤心', emotion: '悲伤' },
  { pattern: '很开心', emotion: '快乐' },
  { pattern: '很高兴', emotion: '快乐' },
  { pattern: '很害怕', emotion: '恐惧' },
  { pattern: '很恐惧', emotion: '恐惧' },
  { pattern: '很紧张', emotion: '焦虑' },
  { pattern: '很焦虑', emotion: '焦虑' },
  { pattern: '很感动', emotion: '感动' },
  { pattern: '很失望', emotion: '失望' },
  { pattern: '很尴尬', emotion: '尴尬' },
  { pattern: '很委屈', emotion: '委屈' },
  { pattern: '感到愤怒', emotion: '愤怒' },
  { pattern: '感到悲伤', emotion: '悲伤' },
  { pattern: '感到恐惧', emotion: '恐惧' },
  { pattern: '感到温暖', emotion: '温暖' },
  { pattern: '感到绝望', emotion: '绝望' },
  { pattern: '觉得害怕', emotion: '恐惧' },
  { pattern: '觉得委屈', emotion: '委屈' },
  { pattern: '心里很难受', emotion: '悲伤' },
  { pattern: '心里很难过', emotion: '悲伤' },
  { pattern: '心里很高兴', emotion: '快乐' },
  { pattern: '心情沉重', emotion: '悲伤' },
  { pattern: '心如刀割', emotion: '悲伤' },
  { pattern: '他害怕', emotion: '恐惧' },
  { pattern: '她害怕', emotion: '恐惧' },
  { pattern: '他很伤心', emotion: '悲伤' },
  { pattern: '她很伤心', emotion: '悲伤' },
];

const SHOW_PATTERNS: Array<{ pattern: string; emotion: string }> = [
  { pattern: '拳头攥紧', emotion: '愤怒' },
  { pattern: '咬紧牙关', emotion: '愤怒/忍耐' },
  { pattern: '颤抖着', emotion: '恐惧/紧张' },
  { pattern: '声音发抖', emotion: '恐惧/紧张' },
  { pattern: '眼眶泛红', emotion: '悲伤/感动' },
  { pattern: '眼眶湿润', emotion: '悲伤/感动' },
  { pattern: '转过头去', emotion: '掩饰情感' },
  { pattern: '别过脸', emotion: '掩饰情感' },
  { pattern: '深吸一口气', emotion: '平复情绪' },
  { pattern: '沉默不语', emotion: '压抑/思考' },
  { pattern: '久久没有说话', emotion: '复杂情绪' },
  { pattern: '握紧了手', emotion: '紧张/决心' },
  { pattern: '指甲掐入掌心', emotion: '愤怒/忍耐' },
  { pattern: '攥紧了衣角', emotion: '紧张/不安' },
  { pattern: '瞳孔骤缩', emotion: '震惊/恐惧' },
  { pattern: '猛地站起', emotion: '愤怒/震惊' },
  { pattern: '后退一步', emotion: '恐惧/震惊' },
  { pattern: '垂下眼睛', emotion: '悲伤/回避' },
  { pattern: '嘴角抽搐', emotion: '愤怒/忍耐' },
  { pattern: '呼吸急促', emotion: '紧张/恐惧' },
  { pattern: '把杯子摔在地上', emotion: '愤怒' },
  { pattern: '一拳砸在', emotion: '愤怒' },
  { pattern: '眼圈红了', emotion: '悲伤/感动' },
];

export function analyzeEmotionCraft(text: string): EmotionCraftResult {
  const detections: EmotionDetection[] = [];

  for (const { pattern, emotion } of TELL_PATTERNS) {
    let pos = text.indexOf(pattern);
    while (pos !== -1) {
      detections.push({ mode: EmotionMode.TELL, text: pattern, emotion, position: pos });
      pos = text.indexOf(pattern, pos + pattern.length);
    }
  }

  for (const { pattern, emotion } of SHOW_PATTERNS) {
    let pos = text.indexOf(pattern);
    while (pos !== -1) {
      detections.push({ mode: EmotionMode.SHOW, text: pattern, emotion, position: pos });
      pos = text.indexOf(pattern, pos + pattern.length);
    }
  }

  const tellCount = detections.filter((d) => d.mode === EmotionMode.TELL).length;
  const showCount = detections.filter((d) => d.mode === EmotionMode.SHOW).length;
  const total = tellCount + showCount;
  const showRatio = total > 0 ? showCount / total : 0;
  const score = Math.round(showRatio * 100);

  const suggestions: string[] = [];
  if (tellCount > showCount * 2) {
    suggestions.push('情感描写过度使用直接陈述(tell)，建议用动作、细节、行为代替直接说"很XX"');
  }
  if (showRatio < 0.3 && total > 3) {
    suggestions.push('show-don\'t-tell比例过低，参考：用"拳头攥紧"代替"很生气"，用"眼眶泛红"代替"很难过"');
  }
  if (suggestions.length === 0 && total > 0) {
    suggestions.push('情感描写平衡良好，show与tell比例合理');
  }

  return { totalDetections: total, tellCount, showCount, showRatio, score, detections, suggestions };
}
