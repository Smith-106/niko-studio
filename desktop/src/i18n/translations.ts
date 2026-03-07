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
  restoreSuccessWithCheckpoint: string
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
  processingCompleted: string
  serviceUnavailableRetry: string
  backendConnectionFailed: string
  sessionCreateFailedRetry: string
  uploadUnsupportedFormat: string
  uploadInjectionFailedRetry: string
  uploadInjectedChunks: string
  uploadInjectedContext: string
  chatAgentContextPrefix: string
  quickRollbackTitle: string
  quickRollbackPlanIdPlaceholder: string
  quickRollbackCheckpointIdPlaceholder: string
  quickRollbackReasonPlaceholder: string
  quickRollbackAction: string
  quickRollbackSuccess: string
  quickRollbackFailed: string
  quickRollbackMissingRequired: string

  // Knowledge Modal
  knowledgeTitle: string
  knowledgeClose: string
  knowledgeTabCharacters: string
  knowledgeTabLocations: string
  knowledgeTabPlots: string
  knowledgeTabSkills: string
  knowledgeSearchPlaceholder: string
  knowledgeTaskMatch: string
  knowledgeSkillDetails: string
  knowledgeSkillChain: string
  knowledgeCurrentSkill: string
  knowledgeLoading: string
  knowledgeEmpty: string
  knowledgeAddPrefix: string
  knowledgeNoDescription: string
  knowledgeItemFallback: string
  knowledgeSkillDetailsLoadFailed: string
  knowledgeTemporalTitle: string
  knowledgeTemporalEntityPlaceholder: string
  knowledgeTemporalAtTimePlaceholder: string
  knowledgeTemporalAction: string
  knowledgeTemporalEntityRequired: string
  knowledgeTemporalLoaded: string
  knowledgeCharacterTitle: string
  knowledgeCharacterNamePlaceholder: string
  knowledgeCharacterAction: string
  knowledgeCharacterNameRequired: string
  knowledgeCharacterLoaded: string
  knowledgeForeshadowTitle: string
  knowledgeForeshadowStatusPlaceholder: string
  knowledgeForeshadowChapterPlaceholder: string
  knowledgeForeshadowAction: string
  knowledgeForeshadowsLoaded: string
  knowledgeMemoryTitle: string
  knowledgeMemoryContentPlaceholder: string
  knowledgeMemoryLayerPlaceholder: string
  knowledgeMemoryDimensionPlaceholder: string
  knowledgeMemoryEntityPlaceholder: string
  knowledgeMemoryTagsPlaceholder: string
  knowledgeMemoryAction: string
  knowledgeMemoryContentRequired: string
  knowledgeMemoryAdded: string
  knowledgeRequestFailed: string

  // Evaluation Panel
  evaluationTitle: string
  evaluationClose: string
  evaluationFailed: string
  evaluationOverallScore: string
  evaluationDimensionAnalysis: string
  evaluationSuggestions: string
  evaluationBatchApply: string
  evaluationBatchUndo: string
  evaluationApply: string
  evaluationUndo: string
  evaluationApplying: string
  evaluationUndoing: string
  evaluationBatchApplying: string
  evaluationBatchUndoing: string
  evaluationBatchResult: string
  evaluationBatchUndoResult: string
  evaluationPassed: string
  evaluationNeedRevise: string
  evaluationNeedRewrite: string
  evaluationUnknown: string
  evaluationNoFeedback: string
  evaluationCheckpointTitle: string
  evaluationCheckpointPlaceholder: string
  evaluationRefresh: string
  evaluationSuggestionsRefresh: string
  evaluationSuggestionsRefreshing: string

  // Chat Area Controls
  chatModeLabel: string
  chatModeNormal: string
  chatModeAgent: string
  chatModeComparison: string
  chatComparisonModelLabel: string
  chatAgentActionWrite: string
  chatAgentActionRevise: string
  chatAgentActionContext: string
  composerUpload: string
  composerVoiceInput: string
  composerSend: string

  // Sidebar
  sidebarToggleExpand: string
  sidebarToggleCollapse: string
  sidebarWritingHelper: string
  sidebarMcpStatus: string
  sidebarEvaluationPanel: string

  // App status
  serviceDegraded: string
  serviceReconnecting: string

  // Writing Helper panel
  writingHelperTitle: string
  writingHelperMode: string
  writingHelperModePolish: string
  writingHelperModeRewrite: string
  writingHelperModeExpand: string
  writingHelperModeSummarize: string
  writingHelperModeOutline: string
  writingHelperMaxSentences: string
  writingHelperMaxItems: string
  writingHelperInputText: string
  writingHelperInputPlaceholder: string

  // Settings modal
  settingsClose: string

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
  writingHelperLegacyPolish: string
  writingHelperClose: string
  writingHelperGuardStatus: string
  writingHelperGuardOn: string
  writingHelperGuardOff: string
  writingHelperHint: string
  writingHelperOpenSettings: string
  writingHelperModePrefix: string
  writingHelperRun: string
  writingHelperRunning: string
  writingHelperClearDraft: string
  writingHelperFailed: string
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
    restoreSuccessWithCheckpoint: '已恢复到 checkpoint {checkpointId}',
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
    processingCompleted: '处理完成',
    serviceUnavailableRetry: '服务暂不可用，请稍后重试',
    backendConnectionFailed: '后端连接失败，请检查设置',
    sessionCreateFailedRetry: '创建会话失败，请重试',
    uploadUnsupportedFormat: '不支持的文件格式，请上传 txt/md/pdf/docx',
    uploadInjectionFailedRetry: '文件注入失败，请重试',
    uploadInjectedChunks: '已完成文件上下文注入：{fileName}（{chunks} 段）',
    uploadInjectedContext: '文件已注入上下文：{fileName}（{chunks} 段）',
    chatAgentContextPrefix: 'Agent 上下文结果',
    quickRollbackTitle: 'Quick Rollback',
    quickRollbackPlanIdPlaceholder: 'plan_id',
    quickRollbackCheckpointIdPlaceholder: 'checkpoint_id',
    quickRollbackReasonPlaceholder: '回滚原因（可选）',
    quickRollbackAction: '执行回滚',
    quickRollbackSuccess: 'Quick rollback 执行成功。',
    quickRollbackFailed: 'Quick rollback 执行失败。',
    quickRollbackMissingRequired: '请填写 plan_id 与 checkpoint_id。',

    // Knowledge Modal
    knowledgeTitle: '知识库',
    knowledgeClose: '关闭知识库',
    knowledgeTabCharacters: '角色',
    knowledgeTabLocations: '地点',
    knowledgeTabPlots: '剧情',
    knowledgeTabSkills: '技能',
    knowledgeSearchPlaceholder: '搜索...',
    knowledgeTaskMatch: '任务匹配',
    knowledgeSkillDetails: '技能详情',
    knowledgeSkillChain: '推荐链路',
    knowledgeCurrentSkill: '当前技能：{skillId}',
    knowledgeLoading: '加载中...',
    knowledgeEmpty: '暂无数据',
    knowledgeAddPrefix: '添加',
    knowledgeNoDescription: '暂无描述',
    knowledgeItemFallback: '条目 {index}',
    knowledgeSkillDetailsLoadFailed: '加载技能详情失败',
    knowledgeTemporalTitle: 'Temporal Facts',
    knowledgeTemporalEntityPlaceholder: 'entity_id',
    knowledgeTemporalAtTimePlaceholder: 'at_time（可选，ISO 时间）',
    knowledgeTemporalAction: '查询 temporal facts',
    knowledgeTemporalEntityRequired: '请输入 temporal 查询的 entity_id。',
    knowledgeTemporalLoaded: 'Temporal facts 查询完成。',
    knowledgeCharacterTitle: 'Character 详情',
    knowledgeCharacterNamePlaceholder: '角色名',
    knowledgeCharacterAction: '查询角色详情',
    knowledgeCharacterNameRequired: '请输入角色名。',
    knowledgeCharacterLoaded: '角色详情加载完成。',
    knowledgeForeshadowTitle: 'Foreshadows 筛选',
    knowledgeForeshadowStatusPlaceholder: 'status',
    knowledgeForeshadowChapterPlaceholder: 'chapter',
    knowledgeForeshadowAction: '查询 foreshadows',
    knowledgeForeshadowsLoaded: 'Foreshadows 查询完成。',
    knowledgeMemoryTitle: 'Add Memory',
    knowledgeMemoryContentPlaceholder: 'memory content',
    knowledgeMemoryLayerPlaceholder: 'layer',
    knowledgeMemoryDimensionPlaceholder: 'dimension',
    knowledgeMemoryEntityPlaceholder: 'entity_id（可选）',
    knowledgeMemoryTagsPlaceholder: 'tags（逗号分隔）',
    knowledgeMemoryAction: '添加 memory',
    knowledgeMemoryContentRequired: '请输入 memory 内容。',
    knowledgeMemoryAdded: 'Memory 添加成功。',
    knowledgeRequestFailed: '请求失败，请稍后重试。',

    // Evaluation Panel
    evaluationTitle: '质量评估',
    evaluationClose: '关闭评估面板',
    evaluationFailed: '评估失败',
    evaluationOverallScore: '综合评分',
    evaluationDimensionAnalysis: '维度分析',
    evaluationSuggestions: '改进建议',
    evaluationBatchApply: '批量应用',
    evaluationBatchUndo: '批量撤销',
    evaluationApply: '应用',
    evaluationUndo: '撤销',
    evaluationApplying: '执行中...',
    evaluationUndoing: '撤销中...',
    evaluationBatchApplying: '批量执行中...',
    evaluationBatchUndoing: '批量撤销中...',
    evaluationBatchResult: '批量结果：成功 {applied}，失败 {failed}',
    evaluationBatchUndoResult: '批量撤销结果：成功 {success}，失败 {failed}',
    evaluationPassed: '通过',
    evaluationNeedRevise: '需修改',
    evaluationNeedRewrite: '需重写',
    evaluationUnknown: '未知',
    evaluationNoFeedback: '无',
    evaluationCheckpointTitle: 'Checkpoint',
    evaluationCheckpointPlaceholder: 'checkpoint 描述',
    evaluationRefresh: '刷新',
    evaluationSuggestionsRefresh: '刷新建议',
    evaluationSuggestionsRefreshing: '刷新建议中...',

    // Chat Area Controls
    chatModeLabel: '模式：',
    chatModeNormal: '普通聊天',
    chatModeAgent: 'Agent 高级',
    chatModeComparison: '模型对比',
    chatComparisonModelLabel: '对照模型',
    chatAgentActionWrite: '写作',
    chatAgentActionRevise: '润色/重写',
    chatAgentActionContext: '取上下文',
    composerUpload: '上传文件',
    composerVoiceInput: '语音输入',
    composerSend: '发送',

    // Sidebar
    sidebarToggleExpand: '展开侧边栏',
    sidebarToggleCollapse: '折叠侧边栏',
    sidebarWritingHelper: 'Writing Helper',
    sidebarMcpStatus: 'MCP 状态',
    sidebarEvaluationPanel: '评估面板',

    // App status
    serviceDegraded: '服务降级',
    serviceReconnecting: '连接恢复中',

    // Writing Helper panel
    writingHelperTitle: 'Writing Helper',
    writingHelperMode: '模式',
    writingHelperModePolish: '润色（polish）',
    writingHelperModeRewrite: '改写（rewrite）',
    writingHelperModeExpand: '扩写（expand）',
    writingHelperModeSummarize: '摘要（summarize）',
    writingHelperModeOutline: '提纲（outline）',
    writingHelperMaxSentences: '最大句数（摘要）',
    writingHelperMaxItems: '最大条目（提纲）',
    writingHelperInputText: '输入文本',
    writingHelperInputPlaceholder: '请输入待处理文本',

    // Settings modal
    settingsClose: '关闭设置',

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
    writingHelperLegacyPolish: 'Writing Helper 润色走 legacy 接口',
    writingHelperClose: '关闭',
    writingHelperGuardStatus: '检测规避拦截：{status}',
    writingHelperGuardOn: '开启',
    writingHelperGuardOff: '关闭',
    writingHelperHint: '可在“设置 → LLM 模型配置”中修改“检测规避拦截”开关。',
    writingHelperOpenSettings: '打开设置',
    writingHelperModePrefix: '模式：{mode}',
    writingHelperRun: '执行',
    writingHelperRunning: '处理中...',
    writingHelperClearDraft: '清空草稿',
    writingHelperFailed: '处理失败',
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
    restoreSuccessWithCheckpoint: 'Restored to checkpoint {checkpointId}',
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
    processingCompleted: 'Processing completed',
    serviceUnavailableRetry: 'Service is temporarily unavailable. Please retry later.',
    backendConnectionFailed: 'Backend connection failed. Please check settings.',
    sessionCreateFailedRetry: 'Failed to create session. Please retry.',
    uploadUnsupportedFormat: 'Unsupported file format. Please upload txt/md/pdf/docx.',
    uploadInjectionFailedRetry: 'File injection failed. Please retry.',
    uploadInjectedChunks: 'File context injected: {fileName} ({chunks} chunks)',
    uploadInjectedContext: 'Context injected from file: {fileName} ({chunks} chunks)',
    chatAgentContextPrefix: 'Agent context result',
    quickRollbackTitle: 'Quick Rollback',
    quickRollbackPlanIdPlaceholder: 'plan_id',
    quickRollbackCheckpointIdPlaceholder: 'checkpoint_id',
    quickRollbackReasonPlaceholder: 'Rollback reason (optional)',
    quickRollbackAction: 'Run rollback',
    quickRollbackSuccess: 'Quick rollback completed successfully.',
    quickRollbackFailed: 'Quick rollback failed.',
    quickRollbackMissingRequired: 'Please provide plan_id and checkpoint_id.',

    // Knowledge Modal
    knowledgeTitle: 'Knowledge Base',
    knowledgeClose: 'Close knowledge base',
    knowledgeTabCharacters: 'Characters',
    knowledgeTabLocations: 'Locations',
    knowledgeTabPlots: 'Plots',
    knowledgeTabSkills: 'Skills',
    knowledgeSearchPlaceholder: 'Search...',
    knowledgeTaskMatch: 'Task Match',
    knowledgeSkillDetails: 'Skill Details',
    knowledgeSkillChain: 'Recommended Chain',
    knowledgeCurrentSkill: 'Current skill: {skillId}',
    knowledgeLoading: 'Loading...',
    knowledgeEmpty: 'No data',
    knowledgeAddPrefix: 'Add',
    knowledgeNoDescription: 'No description',
    knowledgeItemFallback: 'Item {index}',
    knowledgeSkillDetailsLoadFailed: 'Failed to load skill details',
    knowledgeTemporalTitle: 'Temporal Facts',
    knowledgeTemporalEntityPlaceholder: 'entity_id',
    knowledgeTemporalAtTimePlaceholder: 'at_time (optional, ISO time)',
    knowledgeTemporalAction: 'Query temporal facts',
    knowledgeTemporalEntityRequired: 'Please enter entity_id for temporal facts query.',
    knowledgeTemporalLoaded: 'Temporal facts loaded.',
    knowledgeCharacterTitle: 'Character Details',
    knowledgeCharacterNamePlaceholder: 'Character name',
    knowledgeCharacterAction: 'Load character details',
    knowledgeCharacterNameRequired: 'Please enter character name.',
    knowledgeCharacterLoaded: 'Character details loaded.',
    knowledgeForeshadowTitle: 'Foreshadow Filters',
    knowledgeForeshadowStatusPlaceholder: 'status',
    knowledgeForeshadowChapterPlaceholder: 'chapter',
    knowledgeForeshadowAction: 'Query foreshadows',
    knowledgeForeshadowsLoaded: 'Foreshadows loaded.',
    knowledgeMemoryTitle: 'Add Memory',
    knowledgeMemoryContentPlaceholder: 'Memory content',
    knowledgeMemoryLayerPlaceholder: 'layer',
    knowledgeMemoryDimensionPlaceholder: 'dimension',
    knowledgeMemoryEntityPlaceholder: 'entity_id (optional)',
    knowledgeMemoryTagsPlaceholder: 'tags (comma separated)',
    knowledgeMemoryAction: 'Add memory',
    knowledgeMemoryContentRequired: 'Please enter memory content.',
    knowledgeMemoryAdded: 'Memory added successfully.',
    knowledgeRequestFailed: 'Request failed. Please try again.',

    // Evaluation Panel
    evaluationTitle: 'Quality Evaluation',
    evaluationClose: 'Close evaluation panel',
    evaluationFailed: 'Evaluation failed',
    evaluationOverallScore: 'Overall Score',
    evaluationDimensionAnalysis: 'Dimension Analysis',
    evaluationSuggestions: 'Suggestions',
    evaluationBatchApply: 'Batch Apply',
    evaluationBatchUndo: 'Batch Undo',
    evaluationApply: 'Apply',
    evaluationUndo: 'Undo',
    evaluationApplying: 'Applying...',
    evaluationUndoing: 'Undoing...',
    evaluationBatchApplying: 'Batch applying...',
    evaluationBatchUndoing: 'Batch undoing...',
    evaluationBatchResult: 'Batch result: success {applied}, failed {failed}',
    evaluationBatchUndoResult: 'Batch undo result: success {success}, failed {failed}',
    evaluationPassed: 'Passed',
    evaluationNeedRevise: 'Needs revision',
    evaluationNeedRewrite: 'Needs rewrite',
    evaluationUnknown: 'Unknown',
    evaluationNoFeedback: 'None',
    evaluationCheckpointTitle: 'Checkpoint',
    evaluationCheckpointPlaceholder: 'Checkpoint description',
    evaluationRefresh: 'Refresh',
    evaluationSuggestionsRefresh: 'Refresh suggestions',
    evaluationSuggestionsRefreshing: 'Refreshing suggestions...',

    // Chat Area Controls
    chatModeLabel: 'Mode:',
    chatModeNormal: 'Normal Chat',
    chatModeAgent: 'Agent Advanced',
    chatModeComparison: 'Model Comparison',
    chatComparisonModelLabel: 'Control Model',
    chatAgentActionWrite: 'Write',
    chatAgentActionRevise: 'Polish/Rewrite',
    chatAgentActionContext: 'Get Context',
    composerUpload: 'Upload file',
    composerVoiceInput: 'Voice input',
    composerSend: 'Send',

    // Sidebar
    sidebarToggleExpand: 'Expand sidebar',
    sidebarToggleCollapse: 'Collapse sidebar',
    sidebarWritingHelper: 'Writing Helper',
    sidebarMcpStatus: 'MCP Status',
    sidebarEvaluationPanel: 'Evaluation Panel',

    // App status
    serviceDegraded: 'Service Degraded',
    serviceReconnecting: 'Reconnecting',

    // Writing Helper panel
    writingHelperTitle: 'Writing Helper',
    writingHelperMode: 'Mode',
    writingHelperModePolish: 'Polish',
    writingHelperModeRewrite: 'Rewrite',
    writingHelperModeExpand: 'Expand',
    writingHelperModeSummarize: 'Summarize',
    writingHelperModeOutline: 'Outline',
    writingHelperMaxSentences: 'Max Sentences (Summary)',
    writingHelperMaxItems: 'Max Items (Outline)',
    writingHelperInputText: 'Input Text',
    writingHelperInputPlaceholder: 'Enter text to process',

    // Settings modal
    settingsClose: 'Close settings',

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
    writingHelperLegacyPolish: 'Use legacy interface for Writing Helper polish',
    writingHelperClose: 'Close',
    writingHelperGuardStatus: 'Detection evasion guard: {status}',
    writingHelperGuardOn: 'On',
    writingHelperGuardOff: 'Off',
    writingHelperHint: 'You can change the detection evasion guard in Settings → LLM Configuration.',
    writingHelperOpenSettings: 'Open Settings',
    writingHelperModePrefix: 'Mode: {mode}',
    writingHelperRun: 'Run',
    writingHelperRunning: 'Processing...',
    writingHelperClearDraft: 'Clear Draft',
    writingHelperFailed: 'Processing failed',
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
