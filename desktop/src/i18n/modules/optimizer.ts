type OptimizerKeys =
  'optimizerTitle'
  | 'optimizerBadge'
  | 'optimizerPresetLabel'
  | 'optimizerPresetHumanize'
  | 'optimizerPresetHumanizeDesc'
  | 'optimizerPresetAiGuide'
  | 'optimizerPresetAiGuideDesc'
  | 'optimizerPresetCharacter'
  | 'optimizerPresetCharacterDesc'
  | 'optimizerPresetLiterary'
  | 'optimizerPresetLiteraryDesc'
  | 'optimizerPresetAcademic'
  | 'optimizerPresetAcademicDesc'
  | 'optimizerPresetCustom'
  | 'optimizerPresetCustomDesc'
  | 'optimizerCustomInstruction'
  | 'optimizerSourceLabel'
  | 'optimizerSourceSelection'
  | 'optimizerSourceSelectionHint'
  | 'optimizerSourceManual'
  | 'optimizerSourceManualHint'
  | 'optimizerSourceEmpty'
  | 'optimizerSourceEmptyHint'
  | 'optimizerRefreshFromSelection'
  | 'optimizerInputText'
  | 'optimizerInputPlaceholder'
  | 'optimizerRun'
  | 'optimizerRunning'
  | 'optimizerFailed'
  | 'optimizerResultTitle'
  | 'optimizerDiagnosisTitle'
  | 'optimizerDiagnosisHint'
  | 'optimizerFeaturePerplexity'
  | 'optimizerFeatureBurstiness'
  | 'optimizerFeatureDetection'
  | 'optimizerFeatureNatural'

export type Translations = Record<OptimizerKeys, string>

export const zhOptimizer: Translations = {
  optimizerTitle: 'AI 文本优化器',
  optimizerBadge: 'AI检测规避',
  optimizerPresetLabel: '优化模式',
  optimizerPresetHumanize: '人类写作特征优化',
  optimizerPresetHumanizeDesc: '去除AI特征，优化困惑度和突发性，使文本更自然',
  optimizerPresetAiGuide: 'AI修改指导',
  optimizerPresetAiGuideDesc: '分析AI痕迹并给出针对性修改建议和优化文本',
  optimizerPresetCharacter: '角色化叙事重构',
  optimizerPresetCharacterDesc: '以特定角色视角改写文本，消除AI模式化痕迹',
  optimizerPresetLiterary: '文学散文深度优化',
  optimizerPresetLiteraryDesc: '在保留艺术价值的前提下，进行深度文学性优化',
  optimizerPresetAcademic: '学术论文深度优化',
  optimizerPresetAcademicDesc: '基于CMU 2025框架优化TF-IDF、CST、VADER等指标',
  optimizerPresetCustom: '自定义指令',
  optimizerPresetCustomDesc: '使用自定义洗稿指令，满足个性化需求',
  optimizerCustomInstruction: '自定义指令',
  optimizerSourceLabel: '文本来源',
  optimizerSourceSelection: '编辑器选中文本',
  optimizerSourceSelectionHint: '已从当前编辑器选区载入，共 {count} 个字符',
  optimizerSourceManual: '手动输入',
  optimizerSourceManualHint: '当前内容已在这里手动输入或改写。',
  optimizerSourceEmpty: '暂无文本',
  optimizerSourceEmptyHint: '先在编辑器里选中文本，或直接把内容粘贴到这里再进行优化。',
  optimizerRefreshFromSelection: '从选区刷新',
  optimizerInputText: '待优化文本',
  optimizerInputPlaceholder: '粘贴需要优化的AI生成文本...',
  optimizerRun: '开始优化',
  optimizerRunning: '优化中...',
  optimizerFailed: '优化失败',
  optimizerResultTitle: '优化结果',
  optimizerDiagnosisTitle: 'AI特征诊断报告',
  optimizerDiagnosisHint: '点击展开',
  optimizerFeaturePerplexity: '困惑度优化',
  optimizerFeatureBurstiness: '突发性优化',
  optimizerFeatureDetection: '检测对抗',
  optimizerFeatureNatural: '自然语言',
}

export const enOptimizer: Translations = {
  optimizerTitle: 'AI Text Optimizer',
  optimizerBadge: 'Detection Evasion',
  optimizerPresetLabel: 'Optimization Mode',
  optimizerPresetHumanize: 'Humanize',
  optimizerPresetHumanizeDesc: 'Remove AI traits, optimize perplexity & burstiness for natural text',
  optimizerPresetAiGuide: 'AI Modification Guide',
  optimizerPresetAiGuideDesc: 'Analyze AI traces and provide targeted modification suggestions',
  optimizerPresetCharacter: 'Character Narrative',
  optimizerPresetCharacterDesc: 'Rewrite from a specific character perspective to eliminate AI patterns',
  optimizerPresetLiterary: 'Literary Polish',
  optimizerPresetLiteraryDesc: 'Deep literary optimization while preserving artistic value',
  optimizerPresetAcademic: 'Academic Paper',
  optimizerPresetAcademicDesc: 'Optimize TF-IDF, CST, VADER metrics based on CMU 2025 framework',
  optimizerPresetCustom: 'Custom',
  optimizerPresetCustomDesc: 'Use custom rewriting instructions for personalized results',
  optimizerCustomInstruction: 'Custom Instruction',
  optimizerSourceLabel: 'Text source',
  optimizerSourceSelection: 'Editor selection',
  optimizerSourceSelectionHint: 'Loaded from the current editor selection, {count} characters',
  optimizerSourceManual: 'Manual input',
  optimizerSourceManualHint: 'The current text was entered or revised here.',
  optimizerSourceEmpty: 'No text yet',
  optimizerSourceEmptyHint: 'Select text in the editor or paste text here before running the optimizer.',
  optimizerRefreshFromSelection: 'Refresh from selection',
  optimizerInputText: 'Text to Optimize',
  optimizerInputPlaceholder: 'Paste AI-generated text to optimize...',
  optimizerRun: 'Optimize',
  optimizerRunning: 'Optimizing...',
  optimizerFailed: 'Optimization failed',
  optimizerResultTitle: 'Optimized Result',
  optimizerDiagnosisTitle: 'AI Characteristic Diagnosis Report',
  optimizerDiagnosisHint: 'Click to expand',
  optimizerFeaturePerplexity: 'Perplexity',
  optimizerFeatureBurstiness: 'Burstiness',
  optimizerFeatureDetection: 'Anti-Detection',
  optimizerFeatureNatural: 'Natural Language',
}
