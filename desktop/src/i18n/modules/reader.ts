type ReaderKeys =
  // persona
  | 'readerPersonaTitle'
  | 'readerPersonaSelect'
  | 'readerPersonaCustom'
  | 'readerPersonaNewbie'
  | 'readerPersonaVeteran'
  | 'readerPersonaEditor'
  | 'readerPersonaGenreFan'
  | 'readerPersonaCasual'
  | 'readerPersonaPicky'
  | 'readerPersonaCreate'
  | 'readerPersonaEdit'
  | 'readerPersonaDelete'
  | 'readerPersonaSave'
  // analysis
  | 'readerAnalysisTitle'
  | 'readerAnalysisRunning'
  | 'readerAnalysisDone'
  | 'readerAnalysisGenerateReport'
  | 'readerAnalysisDimension'
  | 'readerAnalysisScore'
  | 'readerAnalysisEvidence'
  | 'readerAnalysisSuggestions'
  // antiAIFlavor
  | 'antiAIFlavorTitle'
  | 'antiAIFlavorDetect'
  | 'antiAIFlavorScore'
  | 'antiAIFlavorTemplateExpression'
  | 'antiAIFlavorStyleDrift'
  | 'antiAIFlavorSensoryGap'
  | 'antiAIFlavorEmotionalFlat'
  | 'antiAIFlavorOverExplaining'
  | 'antiAIFlavorClichéPattern'
  | 'antiAIFlavorRhythmMonotony'
  // abTest
  | 'abTestTitle'
  | 'abTestVersionA'
  | 'abTestVersionB'
  | 'abTestCompare'
  | 'abTestDiffAnalysis'
  | 'abTestPreference'
  | 'abTestRun'
  // deAI
  | 'deAITitle'
  | 'deAIReduce'
  | 'deAIStyleTransform'
  | 'deAIRewrite'
  | 'deAIHumanize'
  | 'deAIApply'
  // feedback
  | 'readerFeedbackUseful'
  | 'readerFeedbackUseless'
  | 'readerFeedbackSubmitted'
  | 'readerFeedbackPlaceholder'
  // consensus
  | 'readerConsensusTitle'
  | 'readerConsensusAgree'
  | 'readerConsensusDisagree'
  | 'readerConsensusKeyIssues'
  | 'readerConsensusOverallRating'
  | 'readerConsensusConfidence'
  // webnovel
  | 'webnovelHookTitle'
  | 'webnovelHookStrength'
  | 'webnovelCliffhangerTitle'
  | 'webnovelCliffhangerIntensity'
  | 'webnovelPacingTitle'
  | 'webnovelChapterFlow'
  | 'webnovelRetentionScore'

export type Translations = Record<ReaderKeys, string>

export const zhReader: Translations = {
  // persona
  readerPersonaTitle: '读者画像',
  readerPersonaSelect: '选择读者画像',
  readerPersonaCustom: '自定义画像',
  readerPersonaNewbie: '新读者',
  readerPersonaVeteran: '资深读者',
  readerPersonaEditor: '编辑视角',
  readerPersonaGenreFan: '类型粉',
  readerPersonaCasual: ' casual 读者',
  readerPersonaPicky: '挑剔读者',
  readerPersonaCreate: '新建画像',
  readerPersonaEdit: '编辑画像',
  readerPersonaDelete: '删除画像',
  readerPersonaSave: '保存画像',
  // analysis
  readerAnalysisTitle: '读者分析',
  readerAnalysisRunning: '正在模拟读者阅读...',
  readerAnalysisDone: '分析完成',
  readerAnalysisGenerateReport: '生成报告',
  readerAnalysisDimension: '分析维度',
  readerAnalysisScore: '评分',
  readerAnalysisEvidence: '依据',
  readerAnalysisSuggestions: '建议',
  // antiAIFlavor
  antiAIFlavorTitle: 'AI 味检测',
  antiAIFlavorDetect: '检测 AI 味',
  antiAIFlavorScore: 'AI 味分数',
  antiAIFlavorTemplateExpression: '模板化表达',
  antiAIFlavorStyleDrift: '风格漂移',
  antiAIFlavorSensoryGap: '感官覆盖不足',
  antiAIFlavorEmotionalFlat: '情绪扁平',
  antiAIFlavorOverExplaining: '过度解释',
  antiAIFlavorClichéPattern: '陈词滥调模式',
  antiAIFlavorRhythmMonotony: '节奏单调',
  // abTest
  abTestTitle: 'A/B 测试',
  abTestVersionA: '版本 A',
  abTestVersionB: '版本 B',
  abTestCompare: '对比分析',
  abTestDiffAnalysis: '差异分析',
  abTestPreference: '偏好度',
  abTestRun: '运行 A/B 测试',
  // deAI
  deAITitle: '去 AI 味',
  deAIReduce: '降低 AI 味',
  deAIStyleTransform: '风格转换',
  deAIRewrite: '重写',
  deAIHumanize: '人性化处理',
  deAIApply: '应用修改',
  // feedback
  readerFeedbackUseful: '有用',
  readerFeedbackUseless: '无用',
  readerFeedbackSubmitted: '反馈已提交',
  readerFeedbackPlaceholder: '写下你的反馈...',
  // consensus
  readerConsensusTitle: '共识分析',
  readerConsensusAgree: '共识',
  readerConsensusDisagree: '分歧',
  readerConsensusKeyIssues: '关键问题',
  readerConsensusOverallRating: '整体评估',
  readerConsensusConfidence: '置信度',
  // webnovel
  webnovelHookTitle: '钩子检测',
  webnovelHookStrength: '钩子强度',
  webnovelCliffhangerTitle: '断章检测',
  webnovelCliffhangerIntensity: '断章强度',
  webnovelPacingTitle: '网文节奏',
  webnovelChapterFlow: '章节流畅度',
  webnovelRetentionScore: '留存预测分',
}

export const enReader: Translations = {
  // persona
  readerPersonaTitle: 'Reader Persona',
  readerPersonaSelect: 'Select Reader Persona',
  readerPersonaCustom: 'Custom Persona',
  readerPersonaNewbie: 'New Reader',
  readerPersonaVeteran: 'Veteran Reader',
  readerPersonaEditor: 'Editor View',
  readerPersonaGenreFan: 'Genre Fan',
  readerPersonaCasual: 'Casual Reader',
  readerPersonaPicky: 'Picky Reader',
  readerPersonaCreate: 'Create Persona',
  readerPersonaEdit: 'Edit Persona',
  readerPersonaDelete: 'Delete Persona',
  readerPersonaSave: 'Save Persona',
  // analysis
  readerAnalysisTitle: 'Reader Analysis',
  readerAnalysisRunning: 'Simulating reader experience...',
  readerAnalysisDone: 'Analysis complete',
  readerAnalysisGenerateReport: 'Generate Report',
  readerAnalysisDimension: 'Dimension',
  readerAnalysisScore: 'Score',
  readerAnalysisEvidence: 'Evidence',
  readerAnalysisSuggestions: 'Suggestions',
  // antiAIFlavor
  antiAIFlavorTitle: 'AI Flavor Detection',
  antiAIFlavorDetect: 'Detect AI Flavor',
  antiAIFlavorScore: 'AI Flavor Score',
  antiAIFlavorTemplateExpression: 'Template Expression',
  antiAIFlavorStyleDrift: 'Style Drift',
  antiAIFlavorSensoryGap: 'Sensory Gap',
  antiAIFlavorEmotionalFlat: 'Emotional Flatness',
  antiAIFlavorOverExplaining: 'Over-explaining',
  antiAIFlavorClichéPattern: 'Cliché Pattern',
  antiAIFlavorRhythmMonotony: 'Rhythm Monotony',
  // abTest
  abTestTitle: 'A/B Test',
  abTestVersionA: 'Version A',
  abTestVersionB: 'Version B',
  abTestCompare: 'Compare',
  abTestDiffAnalysis: 'Diff Analysis',
  abTestPreference: 'Preference',
  abTestRun: 'Run A/B Test',
  // deAI
  deAITitle: 'De-AI',
  deAIReduce: 'Reduce AI Flavor',
  deAIStyleTransform: 'Style Transform',
  deAIRewrite: 'Rewrite',
  deAIHumanize: 'Humanize',
  deAIApply: 'Apply Changes',
  // feedback
  readerFeedbackUseful: 'Useful',
  readerFeedbackUseless: 'Not Useful',
  readerFeedbackSubmitted: 'Feedback submitted',
  readerFeedbackPlaceholder: 'Write your feedback...',
  // consensus
  readerConsensusTitle: 'Consensus Analysis',
  readerConsensusAgree: 'Consensus',
  readerConsensusDisagree: 'Disagreement',
  readerConsensusKeyIssues: 'Key Issues',
  readerConsensusOverallRating: 'Overall Rating',
  readerConsensusConfidence: 'Confidence',
  // webnovel
  webnovelHookTitle: 'Hook Detection',
  webnovelHookStrength: 'Hook Strength',
  webnovelCliffhangerTitle: 'Cliffhanger Detection',
  webnovelCliffhangerIntensity: 'Cliffhanger Intensity',
  webnovelPacingTitle: 'Webnovel Pacing',
  webnovelChapterFlow: 'Chapter Flow',
  webnovelRetentionScore: 'Retention Score',
}
