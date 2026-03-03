export type Language = 'zh' | 'en'

export interface Translations {
  // App
  appTitle: string
  serviceRunning: string
  serviceOffline: string
  contextUsage: string
  checkpoint: string
  restore: string
  restoreSuccess: string
  restoreFailed: string
  loadingCheckpoints: string
  noCheckpoints: string
  contextEstimated: string

  // Sidebar
  nikoStudio: string
  newChat: string
  chatList: string
  skillPacks: string
  knowledgeBase: string
  settings: string

  // Chat
  startWriting: string
  startWritingDesc: string
  thinking: string
  workflow: string
  quick: string
  lite: string
  standard: string
  brainstorm: string
  coordinator: string
  planning: string
  selectedSkills: string
  inputPlaceholder: string
  streamCanceled: string
  streamInterrupted: string
  streamRecovered: string
  streamReconnecting: string
  streamRestoreHint: string
  streamRestoreToBeforeSend: string
  streamRestoreBeforeSendSuccess: string
  inlineNeedSelection: string
  inlineActionFailed: string
  inlineSelectedTextInfo: string
  inlineContinue: string
  inlineRevise: string
  inlineGenerate: string
  inlineRun: string
  inlineClearSelection: string
  inlineReviseDefaultInstruction: string
  inlineContinuePromptPrefix: string
  inlineGeneratePromptPrefix: string
  inlineGenerateContextFallback: string
  streamGateSoftGo: string
  streamGateNoGo: string
  templateLibraryEntry: string
  templateLibraryTitle: string
  templateClosePanel: string
  templateCategoryAll: string
  templateCategoryBrainstorm: string
  templateCategoryOutline: string
  templateCategoryCharacter: string
  templateCategoryRewrite: string
  templateCategoryAnalysis: string
  templateCategoryCustom: string
  templateFavorite: string
  templateUnfavorite: string
  templateFavoriteOnlyOn: string
  templateFavoriteOnlyOff: string
  templateSearchPlaceholder: string
  templateRequiredHint: string
  templateApplyAction: string
  templateApplyReplace: string
  templateApplyAppend: string
  templateEmptyList: string
  templateNoMatch: string

  // Settings
  settingsTitle: string
  backendService: string
  backendUrl: string
  llmConfig: string
  multiModel: string
  primary: string
  testConnection: string
  testing: string
  apiKey: string
  baseUrl: string
  defaultModel: string
  setPrimary: string
  modelParams: string
  temperature: string
  temperatureDesc: string
  writingSettings: string
  defaultWorkflow: string
  workflowL1: string
  workflowL2: string
  workflowL3: string
  workflowL4: string
  workflowL5: string
  targetWords: string
  autoSkillMatch: string
  qualityGoalsTitle: string
  qualityGoalNaturalness: string
  qualityGoalReadability: string
  qualityGoalCoherence: string
  qualityGoalStyleConsistency: string
  qualityGoalPreset: string
  qualityPresetHumanWriting: string
  qualityPresetAiEditGuidance: string
  qualityPresetCustom: string
  qualityGoalSentenceEntropy: string
  qualityGoalRhythmVariability: string
  qualityGoalCustomInstruction: string
  qualityGoalCustomInstructionPlaceholder: string
  uiSettings: string
  theme: string
  themeLight: string
  themeDark: string
  themeSystem: string
  fontSize: string
  fontSmall: string
  fontMedium: string
  fontLarge: string
  language: string
  langChinese: string
  langEnglish: string
  resetDefault: string
  cancel: string
  save: string
  exportSettings: string
  importSettings: string
  importSuccess: string
  importFailed: string
}

export const translations: Record<Language, Translations> = {
  zh: {
    // App
    appTitle: '小说创作助手',
    serviceRunning: '服务运行中',
    serviceOffline: '服务未启动',
    contextUsage: '上下文',
    checkpoint: '还原点',
    restore: '恢复',
    restoreSuccess: '恢复成功',
    restoreFailed: '恢复失败',
    loadingCheckpoints: '加载还原点中...',
    noCheckpoints: '暂无还原点',
    contextEstimated: '估算',

    // Sidebar
    nikoStudio: 'Niko-Studio',
    newChat: '新对话',
    chatList: '对话列表',
    skillPacks: '技能包',
    knowledgeBase: '知识库',
    settings: '设置',

    // Chat
    startWriting: '开始创作你的故事',
    startWritingDesc: '告诉我你想写什么样的故事，我会帮你规划结构、设计角色、打磨文字。',
    thinking: 'Niko 正在思考...',
    workflow: '工作流',
    quick: '快速',
    lite: '轻量',
    standard: '标准',
    brainstorm: '脑暴',
    coordinator: '编排',
    planning: '规划',
    selectedSkills: '已选 {count} 个技能',
    inputPlaceholder: '告诉我你想创作什么...',
    streamCanceled: '已取消本次生成。',
    streamInterrupted: '流式生成已中断。',
    streamRecovered: '已从流式降级恢复，结果可继续使用。',
    streamReconnecting: '连接恢复中，请稍候...',
    streamRestoreHint: '发送失败，可恢复到发送前状态。',
    streamRestoreToBeforeSend: '恢复到发送前',
    streamRestoreBeforeSendSuccess: '已恢复到发送前状态。',
    inlineNeedSelection: '请先选中文本后再改写。',
    inlineActionFailed: '内联 AI 操作失败，请重试。',
    inlineSelectedTextInfo: '已选中文本（{count} 字符）',
    inlineContinue: '续写',
    inlineRevise: '改写',
    inlineGenerate: '生成',
    inlineRun: '执行',
    inlineClearSelection: '清除选区',
    inlineReviseDefaultInstruction: '请改写这段内容并保持原意。',
    inlineContinuePromptPrefix: '请基于以下内容继续写作：',
    inlineGeneratePromptPrefix: '请基于以下内容生成新文本：',
    inlineGenerateContextFallback: '根据当前对话上下文生成。',
    streamGateSoftGo: '已降级执行（Soft Go）：结果可用，建议继续关注。',
    streamGateNoGo: '当前结果未通过质量门（No-Go），请调整后重试。',
    templateLibraryEntry: '模板库',
    templateLibraryTitle: '模板库',
    templateClosePanel: '关闭模板库',
    templateCategoryAll: '全部',
    templateCategoryBrainstorm: '脑暴',
    templateCategoryOutline: '大纲',
    templateCategoryCharacter: '角色',
    templateCategoryRewrite: '改写',
    templateCategoryAnalysis: '分析',
    templateCategoryCustom: '自定义',
    templateFavorite: '收藏模板',
    templateUnfavorite: '取消收藏',
    templateFavoriteOnlyOn: '仅看收藏',
    templateFavoriteOnlyOff: '全部模板',
    templateSearchPlaceholder: '搜索模板标题或内容',
    templateRequiredHint: '该变量为必填项',
    templateApplyAction: '一键填充',
    templateApplyReplace: '替换输入框',
    templateApplyAppend: '追加到输入框',
    templateEmptyList: '暂无模板',
    templateNoMatch: '无匹配模板',

    // Settings
    settingsTitle: '设置',
    backendService: '后端服务',
    backendUrl: 'Niko-Studio 后端地址',
    llmConfig: 'LLM 模型配置',
    multiModel: '多模型并行',
    primary: '主要',
    testConnection: '测试连接',
    testing: '测试中...',
    apiKey: 'API Key',
    baseUrl: 'Base URL',
    defaultModel: '默认模型',
    setPrimary: '设为主要提供商',
    modelParams: '模型参数',
    temperature: 'Temperature (创造性)',
    temperatureDesc: '较低值 (0-0.3): 更确定性，适合事实性写作 | 较高值 (0.7-1): 更创造性，适合创意写作',
    writingSettings: '写作设置',
    defaultWorkflow: '默认工作流',
    workflowL1: 'L1 - 快速 (润色/问答)',
    workflowL2: 'L2 - 轻量 (短文/扩写)',
    workflowL3: 'L3 - 标准 (章节创作)',
    workflowL4: 'L4 - 脑暴 (多角度构思)',
    workflowL5: 'L5 - 编排 (全书设计)',
    targetWords: '每章目标字数',
    autoSkillMatch: '自动匹配技能包',
    qualityGoalsTitle: '质量增强目标',
    qualityGoalNaturalness: '自然度',
    qualityGoalReadability: '可读性',
    qualityGoalCoherence: '连贯性',
    qualityGoalStyleConsistency: '风格一致性',
    qualityGoalPreset: '优化预设',
    qualityPresetHumanWriting: '人类写作特征优化',
    qualityPresetAiEditGuidance: 'AI 修改指导',
    qualityPresetCustom: '自定义',
    qualityGoalSentenceEntropy: '句式熵目标',
    qualityGoalRhythmVariability: '节奏变化目标',
    qualityGoalCustomInstruction: '自定义优化指令',
    qualityGoalCustomInstructionPlaceholder: '输入你的个性化洗稿/润色要求',
    uiSettings: '界面设置',
    theme: '主题',
    themeLight: '浅色',
    themeDark: '深色',
    themeSystem: '跟随系统',
    fontSize: '字体大小',
    fontSmall: '小',
    fontMedium: '中',
    fontLarge: '大',
    language: '语言',
    langChinese: '简体中文',
    langEnglish: 'English',
    resetDefault: '重置默认',
    cancel: '取消',
    save: '保存',
    exportSettings: '导出设置',
    importSettings: '导入设置',
    importSuccess: '设置导入成功！',
    importFailed: '导入失败',
  },
  en: {
    // App
    appTitle: 'Novel Writing Assistant',
    serviceRunning: 'Service Running',
    serviceOffline: 'Service Offline',
    contextUsage: 'Context',
    checkpoint: 'Checkpoint',
    restore: 'Restore',
    restoreSuccess: 'Restore successful',
    restoreFailed: 'Restore failed',
    loadingCheckpoints: 'Loading checkpoints...',
    noCheckpoints: 'No checkpoints',
    contextEstimated: 'Estimated',

    // Sidebar
    nikoStudio: 'Niko-Studio',
    newChat: 'New Chat',
    chatList: 'Conversations',
    skillPacks: 'Skills',
    knowledgeBase: 'Knowledge Base',
    settings: 'Settings',

    // Chat
    startWriting: 'Start Writing Your Story',
    startWritingDesc: 'Tell me what kind of story you want to write, and I\'ll help you plan the structure, design characters, and polish the text.',
    thinking: 'Niko is thinking...',
    workflow: 'Workflow',
    quick: 'Quick',
    lite: 'Lite',
    standard: 'Standard',
    brainstorm: 'Brainstorm',
    coordinator: 'Coordinator',
    planning: 'Planning',
    selectedSkills: '{count} skills selected',
    inputPlaceholder: 'Tell me what you want to create...',
    streamCanceled: 'Generation canceled.',
    streamInterrupted: 'Streaming generation was interrupted.',
    streamRecovered: 'Recovered from stream fallback; the result remains usable.',
    streamReconnecting: 'Connection recovering. Please wait...',
    streamRestoreHint: 'Send failed. You can restore to the state before sending.',
    streamRestoreToBeforeSend: 'Restore to before send',
    streamRestoreBeforeSendSuccess: 'Restored to the state before sending.',
    inlineNeedSelection: 'Please select text before revising.',
    inlineActionFailed: 'Inline AI action failed. Please try again.',
    inlineSelectedTextInfo: 'Selected text ({count} chars)',
    inlineContinue: 'Continue',
    inlineRevise: 'Revise',
    inlineGenerate: 'Generate',
    inlineRun: 'Run',
    inlineClearSelection: 'Clear Selection',
    inlineReviseDefaultInstruction: 'Please revise this text while preserving the original meaning.',
    inlineContinuePromptPrefix: 'Please continue writing based on the following content:',
    inlineGeneratePromptPrefix: 'Please generate new text based on the following content:',
    inlineGenerateContextFallback: 'Generate based on the current conversation context.',
    streamGateSoftGo: 'Executed with fallback (Soft Go): output is available, please keep monitoring.',
    streamGateNoGo: 'The current output did not pass the quality gate (No-Go). Please adjust and retry.',
    templateLibraryEntry: 'Template Library',
    templateLibraryTitle: 'Template Library',
    templateClosePanel: 'Close template library',
    templateCategoryAll: 'All',
    templateCategoryBrainstorm: 'Brainstorm',
    templateCategoryOutline: 'Outline',
    templateCategoryCharacter: 'Character',
    templateCategoryRewrite: 'Rewrite',
    templateCategoryAnalysis: 'Analysis',
    templateCategoryCustom: 'Custom',
    templateFavorite: 'Favorite template',
    templateUnfavorite: 'Unfavorite template',
    templateFavoriteOnlyOn: 'Favorites only',
    templateFavoriteOnlyOff: 'All templates',
    templateSearchPlaceholder: 'Search template title or content',
    templateRequiredHint: 'This variable is required',
    templateApplyAction: 'Apply Template',
    templateApplyReplace: 'Replace Input',
    templateApplyAppend: 'Append Input',
    templateEmptyList: 'No templates yet',
    templateNoMatch: 'No matching templates',

    // Settings
    settingsTitle: 'Settings',
    backendService: 'Backend Service',
    backendUrl: 'Niko-Studio Backend URL',
    llmConfig: 'LLM Configuration',
    multiModel: 'Multi-Model Parallel',
    primary: 'Primary',
    testConnection: 'Test Connection',
    testing: 'Testing...',
    apiKey: 'API Key',
    baseUrl: 'Base URL',
    defaultModel: 'Default Model',
    setPrimary: 'Set as Primary Provider',
    modelParams: 'Model Parameters',
    temperature: 'Temperature (Creativity)',
    temperatureDesc: 'Lower (0-0.3): More deterministic, for factual writing | Higher (0.7-1): More creative, for creative writing',
    writingSettings: 'Writing Settings',
    defaultWorkflow: 'Default Workflow',
    workflowL1: 'L1 - Quick (Polish/Q&A)',
    workflowL2: 'L2 - Lite (Short Drafts)',
    workflowL3: 'L3 - Standard (Chapter Writing)',
    workflowL4: 'L4 - Brainstorm (Multi-angle Ideation)',
    workflowL5: 'L5 - Coordinator (Book Design)',
    targetWords: 'Target Words per Chapter',
    autoSkillMatch: 'Auto Match Skills',
    qualityGoalsTitle: 'Quality Enhancement Goals',
    qualityGoalNaturalness: 'Naturalness',
    qualityGoalReadability: 'Readability',
    qualityGoalCoherence: 'Coherence',
    qualityGoalStyleConsistency: 'Style Consistency',
    qualityGoalPreset: 'Optimization Preset',
    qualityPresetHumanWriting: 'Human Writing Traits',
    qualityPresetAiEditGuidance: 'AI Editing Guidance',
    qualityPresetCustom: 'Custom',
    qualityGoalSentenceEntropy: 'Sentence Entropy Target',
    qualityGoalRhythmVariability: 'Rhythm Variability Target',
    qualityGoalCustomInstruction: 'Custom Optimization Instruction',
    qualityGoalCustomInstructionPlaceholder: 'Enter your personalized rewrite/polish instruction',
    uiSettings: 'UI Settings',
    theme: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
    fontSize: 'Font Size',
    fontSmall: 'Small',
    fontMedium: 'Medium',
    fontLarge: 'Large',
    language: 'Language',
    langChinese: '简体中文',
    langEnglish: 'English',
    resetDefault: 'Reset Default',
    cancel: 'Cancel',
    save: 'Save',
    exportSettings: 'Export Settings',
    importSettings: 'Import Settings',
    importSuccess: 'Settings imported successfully!',
    importFailed: 'Import failed',
  },
}
