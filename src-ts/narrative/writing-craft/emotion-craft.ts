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

export enum EmotionLayer {
  PHYSICAL_SENSATION = 'physical_sensation',
  BEHAVIORAL_EXPRESSION = 'behavioral_expression',
  INTERNAL_MONOLOGUE = 'internal_monologue',
  METAPHORICAL = 'metaphorical',
  SUBTEXT_UNDERSTATEMENT = 'subtext_understatement',
}

export interface LayerDetectionPattern {
  layer: EmotionLayer;
  label: string;
  patterns: string[];
  examplePhrases: string[];
  difficultyWeight: number;
}

export const LAYER_DETECTION_PATTERNS: Record<EmotionLayer, LayerDetectionPattern> = {
  [EmotionLayer.PHYSICAL_SENSATION]: {
    layer: EmotionLayer.PHYSICAL_SENSATION,
    label: '生理感受',
    patterns: ['心跳', '呼吸', '颤抖', '发冷', '发热', '冒汗', '发麻', '绞痛', '窒息', '晕眩', '起鸡皮疙瘩', '头皮发麻', '血液', '冰凉', '滚烫'],
    examplePhrases: ['心跳加速', '呼吸一滞', '手脚冰凉', '血液凝固'],
    difficultyWeight: 0.5,
  },
  [EmotionLayer.BEHAVIORAL_EXPRESSION]: {
    layer: EmotionLayer.BEHAVIORAL_EXPRESSION,
    label: '行为表达',
    patterns: ['攥紧', '咬紧', '后退', '转头', '握拳', '砸', '摔', '拥抱', '拍案', '踱步', '哽咽', '吼', '低声', '盯着', '避开目光'],
    examplePhrases: ['攥紧了拳头', '后退一步', '一拳砸在桌上', '转过头去'],
    difficultyWeight: 0.7,
  },
  [EmotionLayer.INTERNAL_MONOLOGUE]: {
    layer: EmotionLayer.INTERNAL_MONOLOGUE,
    label: '内心独白',
    patterns: ['心想', '暗想', '告诉自己', '内心', '质问自己', '难道', '为什么总是', '如果当时', '或许', '是不是'],
    examplePhrases: ['他心想', '暗暗告诉自己', '质问自己为什么要这样', '难道这一切都是徒劳'],
    difficultyWeight: 1.0,
  },
  [EmotionLayer.METAPHORICAL]: {
    layer: EmotionLayer.METAPHORICAL,
    label: '隐喻描写',
    patterns: ['像', '如', '仿佛', '好似', '如同', '犹如', '就像', '把...比作', '正如'],
    examplePhrases: ['像被雷击中一般', '仿佛整个世界都安静了', '如同坠入冰窟'],
    difficultyWeight: 1.3,
  },
  [EmotionLayer.SUBTEXT_UNDERSTATEMENT]: {
    layer: EmotionLayer.SUBTEXT_UNDERSTATEMENT,
    label: '潜台词/轻描淡写',
    patterns: ['淡淡', '轻轻', '只说', '嗯', '哦', '沉默', '没说什么', '没再开口', '只是看着', '微微一笑', '不再说话', '装作', '岔开话题', '敷衍'],
    examplePhrases: ['淡淡地说', '哦了一声', '只是微微一笑', '装作没听见'],
    difficultyWeight: 1.5,
  },
};

export interface LayerDetection {
  layer: EmotionLayer;
  label: string;
  hitCount: number;
  evidence: string[];
  score: number;
  richness: number;
}

export interface EmotionLayerResult {
  detections: LayerDetection[];
  totalLayersUsed: number;
  layerDiversityScore: number;
  overallRichness: number;
  depthLevel: string;
  suggestions: string[];
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
  layerRichness?: number;
  layerBreakdown?: Record<EmotionLayer, number>;
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

  const layerResult = analyzeEmotionLayers(text);

  return {
    totalDetections: total,
    tellCount,
    showCount,
    showRatio,
    score,
    detections,
    suggestions,
    layerRichness: layerResult.overallRichness,
    layerBreakdown: Object.fromEntries(
      layerResult.detections.map((d) => [d.layer, d.richness])
    ) as Record<EmotionLayer, number>,
  };
}

export function analyzeEmotionLayers(text: string): EmotionLayerResult {
  const textLength = text.length || 1;
  const detections: LayerDetection[] = [];

  for (const layer of Object.values(LAYER_DETECTION_PATTERNS)) {
    const evidence: string[] = [];
    for (const pattern of layer.patterns) {
      let pos = text.indexOf(pattern);
      while (pos !== -1) {
        evidence.push(pattern);
        pos = text.indexOf(pattern, pos + pattern.length);
      }
    }
    const hitCount = evidence.length;
    const richness = Math.round((hitCount * layer.difficultyWeight / textLength) * 1000 * 100) / 100;
    const score = Math.min(10, Math.round((richness / 5) * 10) / 10);
    detections.push({
      layer: layer.layer,
      label: layer.label,
      hitCount,
      evidence,
      score,
      richness,
    });
  }

  const layersWithHits = detections.filter((d) => d.hitCount > 0).length;
  const totalLayersUsed = layersWithHits;
  const layerDiversityScore = Math.round((layersWithHits / 5) * 10 * 10) / 10;
  const overallRichness = Math.round(detections.reduce((sum, d) => sum + d.richness, 0) * 100) / 100;
  const depthLevel =
    overallRichness >= 8 ? '深' : overallRichness >= 4 ? '中' : '浅';

  const suggestions: string[] = [];
  for (const d of detections) {
    if (d.hitCount === 0) {
      if (d.layer === EmotionLayer.PHYSICAL_SENSATION) {
        suggestions.push('缺少生理感受描写，建议加入心跳、呼吸、体温变化等细节');
      } else if (d.layer === EmotionLayer.BEHAVIORAL_EXPRESSION) {
        suggestions.push('缺少行为表达，建议加入手势、表情、身体动作等细节');
      } else if (d.layer === EmotionLayer.INTERNAL_MONOLOGUE) {
        suggestions.push('缺少内心独白，建议加入角色的内心思考和自我对话');
      } else if (d.layer === EmotionLayer.METAPHORICAL) {
        suggestions.push('缺少隐喻描写，建议使用比喻来丰富情感表达');
      } else if (d.layer === EmotionLayer.SUBTEXT_UNDERSTATEMENT) {
        suggestions.push('缺少潜台词/轻描淡写，建议用含蓄方式让读者自行体会情感');
      }
    }
  }

  if (suggestions.length === 0 && layersWithHits > 0) {
    suggestions.push('情感描写层次丰富，各层表达方式均有体现');
  }

  return { detections, totalLayersUsed, layerDiversityScore, overallRichness, depthLevel, suggestions };
}

// ============================================================
// M15: Description Quality Assessment
// Source: 《大师写作班》描写与背景 (罗恩·罗泽尔)
// ============================================================

export enum DescriptionQualityDimension {
  SENSORY_DETAIL = 'sensory_detail',
  SPECIFICITY = 'specificity',
  ATMOSPHERE = 'atmosphere',
  DYNAMIC_DESCRIPTION = 'dynamic_description',
  SHOWING_ACTION = 'showing_action',
}

export interface DescriptionQualityResult {
  dimensions: Array<{ dimension: DescriptionQualityDimension; label: string; score: number; evidence: string[] }>;
  overallScore: number;
  suggestions: string[];
}

const DESCRIPTION_PATTERNS: Record<DescriptionQualityDimension, { label: string; keywords: string[] }> = {
  [DescriptionQualityDimension.SENSORY_DETAIL]: {
    label: '感官细节',
    keywords: ['刺鼻', '冰凉', '粗糙', '刺耳', '刺眼', '腥味', '甜腻', '柔软', '坚硬', '温暖', '潮湿', '干燥', '光滑', '沉闷', '清脆'],
  },
  [DescriptionQualityDimension.SPECIFICITY]: {
    label: '具体性',
    keywords: ['那把', '这个', '某个', '正好', '精确', '恰好', '一模一样', '确切', '分明'],
  },
  [DescriptionQualityDimension.ATMOSPHERE]: {
    label: '氛围营造',
    keywords: ['阴沉', '压抑', '温暖', '宁静', '喧嚣', '萧瑟', '诡异的', '祥和', '紧张', '沉闷', '明亮'],
  },
  [DescriptionQualityDimension.DYNAMIC_DESCRIPTION]: {
    label: '动态描写',
    keywords: ['摇曳', '翻滚', '流淌', '蔓延', '飞舞', '颤抖', '旋转', '闪烁', '膨胀', '收缩'],
  },
  [DescriptionQualityDimension.SHOWING_ACTION]: {
    label: '通过行动展示',
    keywords: ['攥紧', '咬住', '后退', '往前', '抓住', '推开', '转身', '蹲下', '跳起', '奔向', '逃离'],
  },
};

export function assessDescriptionQuality(text: string): DescriptionQualityResult {
  const dimensions = Object.entries(DESCRIPTION_PATTERNS).map(([dim, pattern]) => {
    const hits = pattern.keywords.filter((kw) => text.includes(kw));
    return {
      dimension: dim as DescriptionQualityDimension,
      label: pattern.label,
      score: Math.min(10, hits.length * 1.5),
      evidence: hits,
    };
  });

  const overallScore = dimensions.length > 0
    ? Math.round((dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length) * 10) / 10
    : 0;

  const suggestions: string[] = [];
  for (const dim of dimensions.filter((d) => d.score < 3)) {
    suggestions.push(`${dim.label}不足，建议增加更多${dim.label === '感官细节' ? '五感描写' : dim.label === '具体性' ? '具体细节' : dim.label === '氛围营造' ? '环境氛围描写' : dim.label === '动态描写' ? '动态变化描写' : '行动展示'}`);
  }
  if (overallScore >= 7) {
    suggestions.push('描写质量较高，多维度描写充分');
  }

  return { dimensions, overallScore, suggestions };
}
