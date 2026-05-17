type StyleKeys =
  'styleSettingsTitle'
  | 'styleTone'
  | 'styleToneWarm'
  | 'styleToneFormal'
  | 'styleToneCasual'
  | 'styleToneHumorous'
  | 'styleToneSerious'
  | 'styleToneMelancholic'
  | 'styleFormality'
  | 'styleEmotion'
  | 'styleCreativity'
  | 'stylePerspective'
  | 'stylePerspectiveFirst'
  | 'stylePerspectiveThird'
  | 'stylePerspectiveSecond'
  | 'stylePerspectiveOmniscient'
  | 'styleSentence'
  | 'styleSentenceConcise'
  | 'styleSentenceFlowing'
  | 'styleSentenceVaried'
  | 'styleSentenceComplex'
  | 'styleRhythmLabel'
  | 'styleRhythmBrisk'
  | 'styleRhythmModerate'
  | 'styleRhythmLeisurely'
  | 'styleNarrativeDistance'
  | 'styleAdvancedTitle'
  | 'styleStructure'
  | 'styleParagraphLength'
  | 'styleParagraphShort'
  | 'styleParagraphMedium'
  | 'styleParagraphLong'
  | 'styleParagraphVaried'
  | 'styleTransition'
  | 'styleTransitionSmooth'
  | 'styleTransitionDirect'
  | 'styleTransitionDramatic'
  | 'styleTransitionSubtle'
  | 'styleHierarchy'
  | 'styleHierarchyFlat'
  | 'styleHierarchyNested'
  | 'styleHierarchyParallel'
  | 'styleHierarchyProgressive'
  | 'styleEmotionExpression'
  | 'styleEmotionImplicit'
  | 'styleEmotionExplicit'
  | 'styleEmotionRestrained'
  | 'styleEmotionPassionate'
  | 'styleThinkingLogic'
  | 'styleThinkingDeductive'
  | 'styleThinkingInductive'
  | 'styleThinkingAnalogical'
  | 'styleThinkingDialectical'
  | 'styleThinkingDepth'
  | 'styleThinkingRhythm'
  | 'styleThinkingMethodical'
  | 'styleThinkingExploratory'
  | 'styleThinkingRapid'
  | 'styleThinkingContemplative'
  | 'styleNarrativeTime'
  | 'styleNarrativeTimeLinear'
  | 'styleNarrativeTimeFlashback'
  | 'styleNarrativeTimeInterleaved'
  | 'styleNarrativeTimeCircular'
  | 'styleNarrativeAttitude'
  | 'styleNarrativeObjective'
  | 'styleNarrativeSympathetic'
  | 'styleNarrativeCritical'
  | 'styleNarrativeDetached'
  | 'styleRhythmSyllable'
  | 'styleRhythmSyllableDense'
  | 'styleRhythmSyllableBalanced'
  | 'styleRhythmSyllableSparse'
  | 'styleRhythmSyllableFree'
  | 'styleRhythmPause'
  | 'styleRhythmPauseFrequent'
  | 'styleRhythmPauseModerate'
  | 'styleRhythmPauseMinimal'
  | 'styleRhythmTempo'
  | 'styleRhythmTempoFast'
  | 'styleRhythmTempoModerate'
  | 'styleRhythmTempoSlow'
  | 'styleRhythmTempoVaried'
  | 'styleTagAdd'
  | 'styleTagPlaceholder'
  | 'styleSignaturePhrases'
  | 'styleImagerySystem'
  | 'styleAllusions'
  | 'styleKnowledgeDomains'
  | 'styleVocabularyPreferred'
  | 'styleVocabularyAvoid'
  | 'styleUniqueness'
  | 'optimizerTwoStepMode'
  | 'optimizerTwoStepAnalysis'
  | 'styleProfileTitle'
  | 'styleProfileExtract'
  | 'styleProfileExtracting'
  | 'styleProfileNotFound'
  | 'styleProfileAvgSentenceLen'
  | 'styleProfileVocabRichness'
  | 'styleProfileDialogueRatio'
  | 'styleProfileTense'
  | 'styleProfilePOV'

export type Translations = Record<StyleKeys, string>

export const zhStyle: Translations = {
  styleSettingsTitle: '风格设置',
  styleTone: '情感基调',
  styleToneWarm: '温暖',
  styleToneFormal: '正式',
  styleToneCasual: '随性',
  styleToneHumorous: '幽默',
  styleToneSerious: '严肃',
  styleToneMelancholic: '忧郁',
  styleFormality: '正式程度',
  styleEmotion: '情感强度',
  styleCreativity: '创意度',
  stylePerspective: '叙事视角',
  stylePerspectiveFirst: '第一人称',
  stylePerspectiveThird: '第三人称',
  stylePerspectiveSecond: '第二人称',
  stylePerspectiveOmniscient: '全知视角',
  styleSentence: '句式风格',
  styleSentenceConcise: '简洁',
  styleSentenceFlowing: '流畅',
  styleSentenceVaried: '多变',
  styleSentenceComplex: '复杂',
  styleRhythmLabel: '节奏',
  styleRhythmBrisk: '明快',
  styleRhythmModerate: '适中',
  styleRhythmLeisurely: '舒缓',
  styleNarrativeDistance: '叙事距离',
  styleAdvancedTitle: '高级风格设置',
  styleStructure: '结构',
  styleParagraphLength: '段落长度',
  styleParagraphShort: '短段落',
  styleParagraphMedium: '中等段落',
  styleParagraphLong: '长段落',
  styleParagraphVaried: '多变长度',
  styleTransition: '过渡风格',
  styleTransitionSmooth: '平滑',
  styleTransitionDirect: '直接',
  styleTransitionDramatic: '戏剧化',
  styleTransitionSubtle: '含蓄',
  styleHierarchy: '层次模式',
  styleHierarchyFlat: '扁平',
  styleHierarchyNested: '嵌套',
  styleHierarchyParallel: '并列',
  styleHierarchyProgressive: '递进',
  styleEmotionExpression: '表达风格',
  styleEmotionImplicit: '含蓄',
  styleEmotionExplicit: '外露',
  styleEmotionRestrained: '克制',
  styleEmotionPassionate: '热烈',
  styleThinkingLogic: '思维逻辑',
  styleThinkingDeductive: '演绎',
  styleThinkingInductive: '归纳',
  styleThinkingAnalogical: '类比',
  styleThinkingDialectical: '辩证',
  styleThinkingDepth: '思维深度',
  styleThinkingRhythm: '思维节奏',
  styleThinkingMethodical: '条理',
  styleThinkingExploratory: '探索',
  styleThinkingRapid: '快速',
  styleThinkingContemplative: '沉思',
  styleNarrativeTime: '时间序列',
  styleNarrativeTimeLinear: '线性',
  styleNarrativeTimeFlashback: '倒叙',
  styleNarrativeTimeInterleaved: '交错',
  styleNarrativeTimeCircular: '环形',
  styleNarrativeAttitude: '叙述态度',
  styleNarrativeObjective: '客观',
  styleNarrativeSympathetic: '同情',
  styleNarrativeCritical: '批判',
  styleNarrativeDetached: '疏离',
  styleRhythmSyllable: '音节模式',
  styleRhythmSyllableDense: '密集',
  styleRhythmSyllableBalanced: '平衡',
  styleRhythmSyllableSparse: '稀疏',
  styleRhythmSyllableFree: '自由',
  styleRhythmPause: '停顿模式',
  styleRhythmPauseFrequent: '频繁',
  styleRhythmPauseModerate: '适中',
  styleRhythmPauseMinimal: '极简',
  styleRhythmTempo: '速度',
  styleRhythmTempoFast: '快速',
  styleRhythmTempoModerate: '适中',
  styleRhythmTempoSlow: '缓慢',
  styleRhythmTempoVaried: '多变',
  styleTagAdd: '添加',
  styleTagPlaceholder: '输入后回车添加...',
  styleSignaturePhrases: '标志性短语',
  styleImagerySystem: '意象系统',
  styleAllusions: '典故',
  styleKnowledgeDomains: '知识领域',
  styleVocabularyPreferred: '偏好词汇',
  styleVocabularyAvoid: '避免词汇',
  styleUniqueness: '独特性',
  optimizerTwoStepMode: '两步分析模式',
  optimizerTwoStepAnalysis: '先分析AI特征，再基于诊断改写',
  styleProfileTitle: '风格档案',
  styleProfileExtract: '提取风格',
  styleProfileExtracting: '提取中...',
  styleProfileNotFound: '未找到风格档案，请先提取',
  styleProfileAvgSentenceLen: '平均句长',
  styleProfileVocabRichness: '词汇丰富度',
  styleProfileDialogueRatio: '对话占比',
  styleProfileTense: '时态偏好',
  styleProfilePOV: '叙事视角',
}

export const enStyle: Translations = {
  styleSettingsTitle: 'Style Settings',
  styleTone: 'Tone',
  styleToneWarm: 'Warm',
  styleToneFormal: 'Formal',
  styleToneCasual: 'Casual',
  styleToneHumorous: 'Humorous',
  styleToneSerious: 'Serious',
  styleToneMelancholic: 'Melancholic',
  styleFormality: 'Formality',
  styleEmotion: 'Emotion',
  styleCreativity: 'Creativity',
  stylePerspective: 'Perspective',
  stylePerspectiveFirst: '1st Person',
  stylePerspectiveThird: '3rd Person',
  stylePerspectiveSecond: '2nd Person',
  stylePerspectiveOmniscient: 'Omniscient',
  styleSentence: 'Sentence Style',
  styleSentenceConcise: 'Concise',
  styleSentenceFlowing: 'Flowing',
  styleSentenceVaried: 'Varied',
  styleSentenceComplex: 'Complex',
  styleRhythmLabel: 'Rhythm',
  styleRhythmBrisk: 'Brisk',
  styleRhythmModerate: 'Moderate',
  styleRhythmLeisurely: 'Leisurely',
  styleNarrativeDistance: 'Narrative Distance',
  styleAdvancedTitle: 'Advanced Style Settings',
  styleStructure: 'Structure',
  styleParagraphLength: 'Paragraph Length',
  styleParagraphShort: 'Short',
  styleParagraphMedium: 'Medium',
  styleParagraphLong: 'Long',
  styleParagraphVaried: 'Varied',
  styleTransition: 'Transition',
  styleTransitionSmooth: 'Smooth',
  styleTransitionDirect: 'Direct',
  styleTransitionDramatic: 'Dramatic',
  styleTransitionSubtle: 'Subtle',
  styleHierarchy: 'Hierarchy',
  styleHierarchyFlat: 'Flat',
  styleHierarchyNested: 'Nested',
  styleHierarchyParallel: 'Parallel',
  styleHierarchyProgressive: 'Progressive',
  styleEmotionExpression: 'Expression',
  styleEmotionImplicit: 'Implicit',
  styleEmotionExplicit: 'Explicit',
  styleEmotionRestrained: 'Restrained',
  styleEmotionPassionate: 'Passionate',
  styleThinkingLogic: 'Logic Pattern',
  styleThinkingDeductive: 'Deductive',
  styleThinkingInductive: 'Inductive',
  styleThinkingAnalogical: 'Analogical',
  styleThinkingDialectical: 'Dialectical',
  styleThinkingDepth: 'Thinking Depth',
  styleThinkingRhythm: 'Thinking Rhythm',
  styleThinkingMethodical: 'Methodical',
  styleThinkingExploratory: 'Exploratory',
  styleThinkingRapid: 'Rapid',
  styleThinkingContemplative: 'Contemplative',
  styleNarrativeTime: 'Time Sequence',
  styleNarrativeTimeLinear: 'Linear',
  styleNarrativeTimeFlashback: 'Flashback',
  styleNarrativeTimeInterleaved: 'Interleaved',
  styleNarrativeTimeCircular: 'Circular',
  styleNarrativeAttitude: 'Narrator Attitude',
  styleNarrativeObjective: 'Objective',
  styleNarrativeSympathetic: 'Sympathetic',
  styleNarrativeCritical: 'Critical',
  styleNarrativeDetached: 'Detached',
  styleRhythmSyllable: 'Syllable Pattern',
  styleRhythmSyllableDense: 'Dense',
  styleRhythmSyllableBalanced: 'Balanced',
  styleRhythmSyllableSparse: 'Sparse',
  styleRhythmSyllableFree: 'Free',
  styleRhythmPause: 'Pause Pattern',
  styleRhythmPauseFrequent: 'Frequent',
  styleRhythmPauseModerate: 'Moderate',
  styleRhythmPauseMinimal: 'Minimal',
  styleRhythmTempo: 'Tempo',
  styleRhythmTempoFast: 'Fast',
  styleRhythmTempoModerate: 'Moderate',
  styleRhythmTempoSlow: 'Slow',
  styleRhythmTempoVaried: 'Varied',
  styleTagAdd: 'Add',
  styleTagPlaceholder: 'Type and press Enter...',
  styleSignaturePhrases: 'Signature Phrases',
  styleImagerySystem: 'Imagery System',
  styleAllusions: 'Allusions',
  styleKnowledgeDomains: 'Knowledge Domains',
  styleVocabularyPreferred: 'Preferred Words',
  styleVocabularyAvoid: 'Avoid Words',
  styleUniqueness: 'Uniqueness',
  optimizerTwoStepMode: 'Two-Step Analysis',
  optimizerTwoStepAnalysis: 'Analyze AI traits first, then rewrite based on diagnosis',
  styleProfileTitle: 'Style Profile',
  styleProfileExtract: 'Extract Style',
  styleProfileExtracting: 'Extracting...',
  styleProfileNotFound: 'No style profile found. Extract first.',
  styleProfileAvgSentenceLen: 'Avg Sentence Length',
  styleProfileVocabRichness: 'Vocabulary Richness',
  styleProfileDialogueRatio: 'Dialogue Ratio',
  styleProfileTense: 'Tense Preference',
  styleProfilePOV: 'Narrative POV',
}
