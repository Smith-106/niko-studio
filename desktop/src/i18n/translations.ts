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
  streamRetryLastSend: string
  streamCopyError: string
  streamErrorCopied: string
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
  uploadStageReading: string
  uploadStageUploading: string
  uploadStageInjecting: string
  uploadErrorFormat: string
  uploadErrorSize: string
  uploadErrorNetwork: string
  uploadErrorService: string
  uploadInjectedChunks: string
  uploadInjectedContext: string
  chatAgentContextPrefix: string
  quickRollbackTitle: string
  quickRollbackAdvancedToggle: string
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
  knowledgeForeshadowStatusPending: string
  knowledgeForeshadowStatusResolved: string
  knowledgeForeshadowStatusAll: string
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
  evaluationDimensionLock: string
  evaluationDimensionStyle: string
  evaluationDimensionLogic: string
  evaluationActionFailedWithReason: string
  evaluationRecommendationFallback: string
  evaluationCheckpointTitle: string
  evaluationCheckpointPlaceholder: string
  evaluationRefresh: string
  evaluationSuggestionsRefresh: string
  evaluationSuggestionsRefreshing: string
  evaluationQualityCheckTitle: string
  evaluationQualityCheckRun: string
  evaluationQualityCheckRunning: string
  evaluationQualityCheckFailed: string
  evaluationQualityCheckDecision: string
  evaluationQualityCheckTotal: string
  evaluationQualityCheckLock: string
  evaluationQualityCheckStyle: string
  evaluationQualityCheckLogic: string
  evaluationQualityCheckFeedback: string
  evaluationWorkflowTitle: string
  evaluationWorkflowTaskPlaceholder: string
  evaluationWorkflowLevelPlaceholder: string
  evaluationWorkflowPlanIdPlaceholder: string
  evaluationWorkflowStepIdPlaceholder: string
  evaluationWorkflowLifecycleActionLabel: string
  evaluationWorkflowLifecycleStatus: string
  evaluationWorkflowLifecycleStart: string
  evaluationWorkflowLifecyclePause: string
  evaluationWorkflowLifecycleResume: string
  evaluationWorkflowLifecycleStop: string
  evaluationWorkflowRoute: string
  evaluationWorkflowPlan: string
  evaluationWorkflowExecute: string
  evaluationWorkflowLifecycle: string
  evaluationWorkflowRetry: string
  evaluationWorkflowLoading: string
  evaluationWorkflowSuccess: string
  evaluationWorkflowError: string
  evaluationWorkflowPlanIdRequired: string

  // Chat Area Controls
  chatModeLabel: string
  chatModeNormal: string
  chatModeAgent: string
  chatModeComparison: string
  modePresetsLabel: string
  modePresetFocusWriting: string
  modePresetAgentDiagnose: string
  modePresetCompareReview: string
  chatComparisonModelLabel: string
  messageBubblePrimaryModelLabel: string
  messageBubbleControlModelLabel: string
  messageBubbleRetrievalStatus: string
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
  skillGroupCore: string
  skillGroupStory: string
  skillGroupQuality: string
  skillGroupTools: string
  skillGroupEmpty: string
  skillDescriptionGeneric: string

  // App status
  serviceDegraded: string
  serviceReconnecting: string
  contextUsageLowHint: string
  contextUsageMediumHint: string
  contextUsageHighHint: string

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
  workflowBackendMode: string
  workflowBackendModeStandard: string
  workflowBackendModeUiBridge: string
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
  sendShortcutLabel: string
  sendShortcutEnter: string
  sendShortcutCtrlEnter: string
  resetDefault: string
  cancel: string
  save: string
  exportSettings: string
  importSettings: string
  importSuccess: string
  importFailed: string

  // MCP Status Panel
  mcpPanelAriaLabel: string
  mcpPanelTitle: string
  mcpRefresh: string
  mcpRefreshing: string
  mcpCloseAria: string
  mcpFetchPartialError: string
  mcpFetchFailed: string
  mcpProbeFailed: string
  mcpUpdateFailed: string
  mcpServiceIdRequired: string
  mcpCreateFailed: string
  mcpGatewayStatus: string
  mcpGatewayHealth: string
  mcpSessionId: string
  mcpNotAvailable: string
  mcpReconnect: string
  mcpLastErrorPrefix: string
  mcpKeyServiceStatus: string
  mcpServiceOnline: string
  mcpServiceNotReady: string
  mcpRuntimeMetrics: string
  mcpRequestsTotal: string
  mcpRequestsFailed: string
  mcpLatencyAvg: string
  mcpLatencyMax: string
  mcpNoMetricsData: string
  mcpServiceDynamicConfig: string
  mcpServiceIdPlaceholder: string
  mcpServiceNamePlaceholder: string
  mcpServicePathPlaceholder: string
  mcpCreating: string
  mcpCreateService: string
  mcpServiceEnabled: string
  mcpServiceDisabled: string
  mcpSaving: string
  mcpSaveName: string
  mcpDisable: string
  mcpEnable: string
  mcpProbing: string
  mcpHealthCheck: string
  mcpNoServiceConfigData: string
  mcpToolStats: string
  mcpTotalTools: string
  mcpNoToolData: string
  mcpStatusOk: string
  mcpStatusError: string
  mcpStatusDisabled: string
  mcpStatusUnknown: string
  mcpConnectionConnected: string
  mcpConnectionDegraded: string
  mcpConnectionDisconnected: string
  mcpConnectionReconnecting: string
  mcpReconnectIdle: string
  mcpReconnectProbing: string
  mcpReconnectBackoff: string
  mcpReconnectRetrying: string
  mcpReconnectRecovered: string
  mcpReconnectFailed: string

  // Settings Modal Diagnostics & Retrieval
  settingsDiagnostics: string
  settingsRefreshDiagnostics: string
  settingsGatewayMetrics: string
  settingsToolList: string
  settingsNoMetricsData: string
  settingsNoToolsData: string
  settingsAllowFallback: string
  settingsDetectionGuard: string
  settingsRetrieval: string
  settingsRetrievalProviderModel: string
  settingsRetrievalSearchPlaceholder: string
  settingsEnableKnowledgeRetrieval: string
  settingsEnableRerank: string
  settingsModelSource: string
  settingsValidatingModel: string
  settingsValidateDefaultModel: string
  settingsRefreshModels: string
  settingsRefreshingModels: string
  settingsLastSync: string
  settingsCustomModel: string
  settingsCustomModelPlaceholder: string
  settingsUseThisModel: string
  settingsInvalidConfigFile: string
  settingsImportFailedPrefix: string
  settingsUnknownError: string
  settingsModelNameRequired: string
  settingsModelNameTooLong: string
  settingsModelNameWhitespace: string
  settingsFetchModelsFailed: string
  settingsFetchModelsFailedWithReason: string
  settingsInvalidCustomModel: string
  settingsPresetModels: string
  settingsFetchedModels: string
  settingsCustomModels: string
  settingsDefaultModelValidateFetchFailed: string
  settingsDefaultModelAvailableViaGateway: string
  settingsDefaultModelAvailableViaDirect: string
  settingsDefaultModelUnavailable: string
  settingsDefaultModelValidateFailed: string
  settingsDiagnosticsFetchFailed: string
  settingsApiKeyPlaceholder: string
  settingsSearchMode: string
  settingsSearchModeHybrid: string
  settingsSearchModeIterative: string
  settingsSearchModeContext: string
  settingsRetrievalProfile: string
  settingsRetrievalProfilePlaceholder: string
  settingsRetrievalMinScore: string
  settingsRetrievalBudgetTokens: string
  settingsRetrievalMaxIterations: string
  settingsRetrievalConfidenceThreshold: string
  settingsAgentContextTypes: string
  settingsContextTypeWorld: string
  settingsContextTypeCharacter: string
  settingsContextTypePlot: string
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
    streamRetryLastSend: '重试发送',
    streamCopyError: '复制错误',
    streamErrorCopied: '（已复制）',
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
    uploadStageReading: '读取文件中...',
    uploadStageUploading: '上传文件中...',
    uploadStageInjecting: '注入上下文中...',
    uploadErrorFormat: '文件格式不支持',
    uploadErrorSize: '文件过大或超出限制',
    uploadErrorNetwork: '网络错误，请检查连接',
    uploadErrorService: '服务处理失败，请稍后重试',
    uploadInjectedChunks: '已完成文件上下文注入：{fileName}（{chunks} 段）',
    uploadInjectedContext: '文件已注入上下文：{fileName}（{chunks} 段）',
    chatAgentContextPrefix: 'Agent 上下文结果',
    quickRollbackTitle: 'Quick Rollback',
    quickRollbackAdvancedToggle: '高级：Quick Rollback',
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
    knowledgeTemporalTitle: '时间事实',
    knowledgeTemporalEntityPlaceholder: '实体ID',
    knowledgeTemporalAtTimePlaceholder: '时间点（可选，ISO 时间）',
    knowledgeTemporalAction: '查询时间事实',
    knowledgeTemporalEntityRequired: '请输入时间事实查询的实体ID。',
    knowledgeTemporalLoaded: '时间事实查询完成。',
    knowledgeCharacterTitle: '角色详情',
    knowledgeCharacterNamePlaceholder: '角色名',
    knowledgeCharacterAction: '查询角色详情',
    knowledgeCharacterNameRequired: '请输入角色名。',
    knowledgeCharacterLoaded: '角色详情加载完成。',
    knowledgeForeshadowTitle: '伏笔筛选',
    knowledgeForeshadowStatusPlaceholder: '状态',
    knowledgeForeshadowStatusPending: '待处理',
    knowledgeForeshadowStatusResolved: '已解决',
    knowledgeForeshadowStatusAll: '全部',
    knowledgeForeshadowChapterPlaceholder: '章节',
    knowledgeForeshadowAction: '查询伏笔',
    knowledgeForeshadowsLoaded: '伏笔查询完成。',
    knowledgeMemoryTitle: '添加记忆',
    knowledgeMemoryContentPlaceholder: '记忆内容',
    knowledgeMemoryLayerPlaceholder: '会话',
    knowledgeMemoryDimensionPlaceholder: '上下文',
    knowledgeMemoryEntityPlaceholder: '实体ID（可选）',
    knowledgeMemoryTagsPlaceholder: '标签（英文逗号分隔）',
    knowledgeMemoryAction: '添加记忆',
    knowledgeMemoryContentRequired: '请输入记忆内容。',
    knowledgeMemoryAdded: '记忆添加成功。',
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
    evaluationDimensionLock: '结构锁定',
    evaluationDimensionStyle: '风格',
    evaluationDimensionLogic: '逻辑',
    evaluationActionFailedWithReason: '{action}失败：{reason}',
    evaluationRecommendationFallback: '建议 {index}',
    evaluationCheckpointTitle: '检查点',
    evaluationCheckpointPlaceholder: '检查点描述',
    evaluationRefresh: '刷新',
    evaluationSuggestionsRefresh: '刷新建议',
    evaluationSuggestionsRefreshing: '刷新建议中...',
    evaluationQualityCheckTitle: '小说质量检查',
    evaluationQualityCheckRun: '执行质量检查',
    evaluationQualityCheckRunning: '质量检查中...',
    evaluationQualityCheckFailed: '质量检查失败',
    evaluationQualityCheckDecision: '决策',
    evaluationQualityCheckTotal: '总分',
    evaluationQualityCheckLock: '结构锁定分',
    evaluationQualityCheckStyle: '风格分',
    evaluationQualityCheckLogic: '逻辑分',
    evaluationQualityCheckFeedback: '反馈',
    evaluationWorkflowTitle: '高级工作流',
    evaluationWorkflowTaskPlaceholder: '工作流任务',
    evaluationWorkflowLevelPlaceholder: '工作流级别（如 L3）',
    evaluationWorkflowPlanIdPlaceholder: '计划 ID',
    evaluationWorkflowStepIdPlaceholder: '步骤 ID（可选）',
    evaluationWorkflowLifecycleActionLabel: '生命周期动作',
    evaluationWorkflowLifecycleStatus: '状态',
    evaluationWorkflowLifecycleStart: '开始',
    evaluationWorkflowLifecyclePause: '暂停',
    evaluationWorkflowLifecycleResume: '继续',
    evaluationWorkflowLifecycleStop: '停止',
    evaluationWorkflowRoute: '路由',
    evaluationWorkflowPlan: '规划',
    evaluationWorkflowExecute: '执行',
    evaluationWorkflowLifecycle: '生命周期',
    evaluationWorkflowRetry: '重试',
    evaluationWorkflowLoading: '请求中...',
    evaluationWorkflowSuccess: '执行成功',
    evaluationWorkflowError: '执行失败',
    evaluationWorkflowPlanIdRequired: '请先填写 plan_id。',

    // Chat Area Controls
    chatModeLabel: '模式：',
    chatModeNormal: '普通聊天',
    chatModeAgent: 'Agent 高级',
    chatModeComparison: '模型对比',
    modePresetsLabel: '预设：',
    modePresetFocusWriting: '专注写作',
    modePresetAgentDiagnose: 'Agent 诊断',
    modePresetCompareReview: '双模型校对',
    chatComparisonModelLabel: '对照模型',
    messageBubblePrimaryModelLabel: '主模型：',
    messageBubbleControlModelLabel: '对照模型：',
    messageBubbleRetrievalStatus: '检索状态： 实体 {entities} / 关系 {relations} / 记忆 {memories}',
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
    skillGroupCore: '核心',
    skillGroupStory: '故事',
    skillGroupQuality: '质量',
    skillGroupTools: '工具',
    skillGroupEmpty: '暂无技能',
    skillDescriptionGeneric: '点击启用到当前对话',

    // App status
    serviceDegraded: '服务降级',
    serviceReconnecting: '连接恢复中',
    contextUsageLowHint: '上下文余量充足',
    contextUsageMediumHint: '上下文接近上限，建议精简输入',
    contextUsageHighHint: '上下文已接近满载，建议新建对话',

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
    workflowBackendMode: '工作流后端模式',
    workflowBackendModeStandard: '标准（/workflow/*）',
    workflowBackendModeUiBridge: 'UI 桥接（/ui/workflow/*）',
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
    sendShortcutLabel: '发送快捷键',
    sendShortcutEnter: 'Enter 发送',
    sendShortcutCtrlEnter: 'Ctrl/Cmd + Enter 发送',
    resetDefault: '重置默认',
    cancel: '取消',
    save: '保存',
    exportSettings: '导出设置',
    importSettings: '导入设置',
    importSuccess: '设置导入成功！',
    importFailed: '导入失败',

    // MCP Status Panel
    mcpPanelAriaLabel: 'MCP 状态面板',
    mcpPanelTitle: 'MCP 状态',
    mcpRefresh: '刷新',
    mcpRefreshing: '刷新中...',
    mcpCloseAria: '关闭 MCP 状态面板',
    mcpFetchPartialError: '部分状态拉取失败，以下信息可能不完整。',
    mcpFetchFailed: '状态拉取失败，请稍后重试。',
    mcpProbeFailed: '探测失败',
    mcpUpdateFailed: '更新失败',
    mcpServiceIdRequired: '请先填写服务 ID',
    mcpCreateFailed: '创建失败',
    mcpGatewayStatus: '网关状态',
    mcpGatewayHealth: 'Gateway Health',
    mcpSessionId: 'Session ID',
    mcpNotAvailable: 'N/A',
    mcpReconnect: 'Reconnect',
    mcpLastErrorPrefix: 'Last error: ',
    mcpKeyServiceStatus: '关键服务状态',
    mcpServiceOnline: '在线',
    mcpServiceNotReady: '未就绪',
    mcpRuntimeMetrics: '运行指标',
    mcpRequestsTotal: '请求总数：{value}',
    mcpRequestsFailed: '失败请求：{value}',
    mcpLatencyAvg: '平均延迟：{value} ms',
    mcpLatencyMax: '最大延迟：{value} ms',
    mcpNoMetricsData: '暂无指标数据',
    mcpServiceDynamicConfig: '服务动态配置',
    mcpServiceIdPlaceholder: '服务 ID',
    mcpServiceNamePlaceholder: '服务名（可选）',
    mcpServicePathPlaceholder: '路径（可选）',
    mcpCreating: '创建中...',
    mcpCreateService: '新增服务',
    mcpServiceEnabled: '启用中',
    mcpServiceDisabled: '已禁用',
    mcpSaving: '保存中...',
    mcpSaveName: '保存名称',
    mcpDisable: '禁用',
    mcpEnable: '启用',
    mcpProbing: '探测中...',
    mcpHealthCheck: '健康检测',
    mcpNoServiceConfigData: '暂无服务配置数据',
    mcpToolStats: '工具统计',
    mcpTotalTools: '总工具数',
    mcpNoToolData: '暂无工具数据',
    mcpStatusOk: '正常',
    mcpStatusError: '异常',
    mcpStatusDisabled: '已禁用',
    mcpStatusUnknown: '未知',
    mcpConnectionConnected: '已连接',
    mcpConnectionDegraded: '降级',
    mcpConnectionDisconnected: '已断开',
    mcpConnectionReconnecting: '重连中',
    mcpReconnectIdle: '空闲',
    mcpReconnectProbing: '探测中',
    mcpReconnectBackoff: '退避',
    mcpReconnectRetrying: '重试中',
    mcpReconnectRecovered: '已恢复',
    mcpReconnectFailed: '失败',

    // Settings Modal Diagnostics & Retrieval
    settingsDiagnostics: '系统诊断',
    settingsRefreshDiagnostics: '刷新诊断',
    settingsGatewayMetrics: '网关指标',
    settingsToolList: '工具清单',
    settingsNoMetricsData: '暂无指标数据',
    settingsNoToolsData: '暂无工具数据',
    settingsAllowFallback: '允许降级',
    settingsDetectionGuard: '检测规避拦截',
    settingsRetrieval: '检索设置',
    settingsRetrievalProviderModel: '检索 Provider / 模型',
    settingsRetrievalSearchPlaceholder: '输入 provider 名称或模型关键字',
    settingsEnableKnowledgeRetrieval: '启用 Knowledge Retrieval',
    settingsEnableRerank: '启用 Rerank',
    settingsModelSource: '模型来源',
    settingsValidatingModel: '校验中...',
    settingsValidateDefaultModel: '校验默认模型',
    settingsRefreshModels: '刷新模型',
    settingsRefreshingModels: '刷新中...',
    settingsLastSync: '最近同步：{value}',
    settingsCustomModel: '自定义模型',
    settingsCustomModelPlaceholder: '例如：gpt-4.1-mini',
    settingsUseThisModel: '使用该模型',
    settingsInvalidConfigFile: '无效的配置文件格式',
    settingsImportFailedPrefix: '导入失败: ',
    settingsUnknownError: '未知错误',
    settingsModelNameRequired: '模型名称不能为空。',
    settingsModelNameTooLong: '模型名称过长（最多 120 个字符）。',
    settingsModelNameWhitespace: '模型名称不能包含空白字符。',
    settingsFetchModelsFailed: '模型拉取失败，请继续使用预置或自定义模型。',
    settingsFetchModelsFailedWithReason: '模型拉取失败（网关/直连均失败）：{error}',
    settingsInvalidCustomModel: '自定义模型不合法。',
    settingsPresetModels: '预置模型',
    settingsFetchedModels: '自动拉取',
    settingsCustomModels: '自定义模型',
    settingsDefaultModelValidateFetchFailed: '默认模型校验失败：无法拉取模型列表。',
    settingsDefaultModelAvailableViaGateway: '默认模型可用（来源：网关）。',
    settingsDefaultModelAvailableViaDirect: '默认模型可用（来源：直连）。',
    settingsDefaultModelUnavailable: '默认模型不在当前可用模型列表中。',
    settingsDefaultModelValidateFailed: '默认模型校验失败，请稍后重试。',
    settingsDiagnosticsFetchFailed: '诊断拉取失败，请稍后重试。',
    settingsApiKeyPlaceholder: 'sk-...',
    settingsSearchMode: '检索模式',
    settingsSearchModeHybrid: 'Hybrid',
    settingsSearchModeIterative: 'Iterative',
    settingsSearchModeContext: 'Context',
    settingsRetrievalProfile: '检索配置',
    settingsRetrievalProfilePlaceholder: 'balanced',
    settingsRetrievalMinScore: '最小分数',
    settingsRetrievalBudgetTokens: '预算 Tokens',
    settingsRetrievalMaxIterations: '最大迭代次数',
    settingsRetrievalConfidenceThreshold: '置信阈值',
    settingsAgentContextTypes: 'Agent 上下文类型',
    settingsContextTypeWorld: 'World',
    settingsContextTypeCharacter: 'Character',
    settingsContextTypePlot: 'Plot',
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
    streamRetryLastSend: 'Retry send',
    streamCopyError: 'Copy error',
    streamErrorCopied: '(copied)',
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
    uploadStageReading: 'Reading file...',
    uploadStageUploading: 'Uploading file...',
    uploadStageInjecting: 'Injecting context...',
    uploadErrorFormat: 'Unsupported file format.',
    uploadErrorSize: 'File is too large or exceeds the limit.',
    uploadErrorNetwork: 'Network error. Please check your connection.',
    uploadErrorService: 'Service failed to process the file. Please retry later.',
    uploadInjectedChunks: 'File context injected: {fileName} ({chunks} chunks)',
    uploadInjectedContext: 'Context injected from file: {fileName} ({chunks} chunks)',
    chatAgentContextPrefix: 'Agent context result',
    quickRollbackTitle: 'Quick Rollback',
    quickRollbackAdvancedToggle: 'Advanced: Quick Rollback',
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
    knowledgeForeshadowStatusPending: 'pending',
    knowledgeForeshadowStatusResolved: 'resolved',
    knowledgeForeshadowStatusAll: 'all',
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
    evaluationDimensionLock: 'Lock',
    evaluationDimensionStyle: 'Style',
    evaluationDimensionLogic: 'Logic',
    evaluationActionFailedWithReason: '{action} failed: {reason}',
    evaluationRecommendationFallback: 'Recommendation {index}',
    evaluationCheckpointTitle: 'Checkpoint',
    evaluationCheckpointPlaceholder: 'Checkpoint description',
    evaluationRefresh: 'Refresh',
    evaluationSuggestionsRefresh: 'Refresh suggestions',
    evaluationSuggestionsRefreshing: 'Refreshing suggestions...',
    evaluationQualityCheckTitle: 'Novel Quality Check',
    evaluationQualityCheckRun: 'Run quality check',
    evaluationQualityCheckRunning: 'Running quality check...',
    evaluationQualityCheckFailed: 'Quality check failed',
    evaluationQualityCheckDecision: 'Decision',
    evaluationQualityCheckTotal: 'Total',
    evaluationQualityCheckLock: 'Lock',
    evaluationQualityCheckStyle: 'Style',
    evaluationQualityCheckLogic: 'Logic',
    evaluationQualityCheckFeedback: 'Feedback',
    evaluationWorkflowTitle: 'Advanced Workflow',
    evaluationWorkflowTaskPlaceholder: 'workflow task',
    evaluationWorkflowLevelPlaceholder: 'workflow level (e.g. L3)',
    evaluationWorkflowPlanIdPlaceholder: 'plan_id',
    evaluationWorkflowStepIdPlaceholder: 'step_id (optional)',
    evaluationWorkflowLifecycleActionLabel: 'lifecycle action',
    evaluationWorkflowLifecycleStatus: 'status',
    evaluationWorkflowLifecycleStart: 'start',
    evaluationWorkflowLifecyclePause: 'pause',
    evaluationWorkflowLifecycleResume: 'resume',
    evaluationWorkflowLifecycleStop: 'stop',
    evaluationWorkflowRoute: 'route',
    evaluationWorkflowPlan: 'plan',
    evaluationWorkflowExecute: 'execute',
    evaluationWorkflowLifecycle: 'lifecycle',
    evaluationWorkflowRetry: 'Retry',
    evaluationWorkflowLoading: 'Requesting...',
    evaluationWorkflowSuccess: 'Success',
    evaluationWorkflowError: 'Failed',
    evaluationWorkflowPlanIdRequired: 'Please provide plan_id first.',

    // Chat Area Controls
    chatModeLabel: 'Mode:',
    chatModeNormal: 'Normal Chat',
    chatModeAgent: 'Agent Advanced',
    chatModeComparison: 'Model Comparison',
    modePresetsLabel: 'Presets:',
    modePresetFocusWriting: 'Focus Writing',
    modePresetAgentDiagnose: 'Agent Diagnose',
    modePresetCompareReview: 'Dual-Model Review',
    chatComparisonModelLabel: 'Control Model',
    messageBubblePrimaryModelLabel: 'Primary Model: ',
    messageBubbleControlModelLabel: 'Control Model: ',
    messageBubbleRetrievalStatus: 'Retrieval: Entities {entities} / Relations {relations} / Memories {memories}',
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
    skillGroupCore: 'Core',
    skillGroupStory: 'Story',
    skillGroupQuality: 'Quality',
    skillGroupTools: 'Tools',
    skillGroupEmpty: 'No skills',
    skillDescriptionGeneric: 'Click to apply in current chat',

    // App status
    serviceDegraded: 'Service Degraded',
    serviceReconnecting: 'Reconnecting',
    contextUsageLowHint: 'Context budget is healthy',
    contextUsageMediumHint: 'Context usage is rising. Consider shorter prompts',
    contextUsageHighHint: 'Context is near limit. Consider starting a new chat',

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
    workflowBackendMode: 'Workflow Backend Mode',
    workflowBackendModeStandard: 'Standard (/workflow/*)',
    workflowBackendModeUiBridge: 'UI Bridge (/ui/workflow/*)',
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
    sendShortcutLabel: 'Send shortcut',
    sendShortcutEnter: 'Enter to send',
    sendShortcutCtrlEnter: 'Ctrl/Cmd + Enter to send',
    resetDefault: 'Reset Default',
    cancel: 'Cancel',
    save: 'Save',
    exportSettings: 'Export Settings',
    importSettings: 'Import Settings',
    importSuccess: 'Settings imported successfully!',
    importFailed: 'Import failed',

    // MCP Status Panel
    mcpPanelAriaLabel: 'MCP status panel',
    mcpPanelTitle: 'MCP status',
    mcpRefresh: 'Refresh',
    mcpRefreshing: 'Refreshing...',
    mcpCloseAria: 'Close MCP status panel',
    mcpFetchPartialError: 'Some status data failed to load. Information below may be incomplete.',
    mcpFetchFailed: 'Failed to load status. Please try again later.',
    mcpProbeFailed: 'Probe failed',
    mcpUpdateFailed: 'Update failed',
    mcpServiceIdRequired: 'Please provide a service ID first',
    mcpCreateFailed: 'Create failed',
    mcpGatewayStatus: 'Gateway status',
    mcpGatewayHealth: 'Gateway Health',
    mcpSessionId: 'Session ID',
    mcpNotAvailable: 'N/A',
    mcpReconnect: 'Reconnect',
    mcpLastErrorPrefix: 'Last error: ',
    mcpKeyServiceStatus: 'Key service status',
    mcpServiceOnline: 'Online',
    mcpServiceNotReady: 'Not ready',
    mcpRuntimeMetrics: 'Runtime metrics',
    mcpRequestsTotal: 'Total requests: {value}',
    mcpRequestsFailed: 'Failed requests: {value}',
    mcpLatencyAvg: 'Average latency: {value} ms',
    mcpLatencyMax: 'Max latency: {value} ms',
    mcpNoMetricsData: 'No metrics data',
    mcpServiceDynamicConfig: 'Dynamic service config',
    mcpServiceIdPlaceholder: 'Service ID',
    mcpServiceNamePlaceholder: 'Service name (optional)',
    mcpServicePathPlaceholder: 'Path (optional)',
    mcpCreating: 'Creating...',
    mcpCreateService: 'Add service',
    mcpServiceEnabled: 'Enabled',
    mcpServiceDisabled: 'Disabled',
    mcpSaving: 'Saving...',
    mcpSaveName: 'Save name',
    mcpDisable: 'Disable',
    mcpEnable: 'Enable',
    mcpProbing: 'Probing...',
    mcpHealthCheck: 'Health check',
    mcpNoServiceConfigData: 'No service config data',
    mcpToolStats: 'Tool stats',
    mcpTotalTools: 'Total tools',
    mcpNoToolData: 'No tool data',
    mcpStatusOk: 'OK',
    mcpStatusError: 'Error',
    mcpStatusDisabled: 'Disabled',
    mcpStatusUnknown: 'Unknown',
    mcpConnectionConnected: 'Connected',
    mcpConnectionDegraded: 'Degraded',
    mcpConnectionDisconnected: 'Disconnected',
    mcpConnectionReconnecting: 'Reconnecting',
    mcpReconnectIdle: 'Idle',
    mcpReconnectProbing: 'Probing',
    mcpReconnectBackoff: 'Backoff',
    mcpReconnectRetrying: 'Retrying',
    mcpReconnectRecovered: 'Recovered',
    mcpReconnectFailed: 'Failed',

    // Settings Modal Diagnostics & Retrieval
    settingsDiagnostics: 'System diagnostics',
    settingsRefreshDiagnostics: 'Refresh diagnostics',
    settingsGatewayMetrics: 'Gateway metrics',
    settingsToolList: 'Tool list',
    settingsNoMetricsData: 'No metrics data',
    settingsNoToolsData: 'No tool data',
    settingsAllowFallback: 'Allow fallback',
    settingsDetectionGuard: 'Detection-evasion guard',
    settingsRetrieval: 'Retrieval settings',
    settingsRetrievalProviderModel: 'Retrieval provider / model',
    settingsRetrievalSearchPlaceholder: 'Enter provider name or model keyword',
    settingsEnableKnowledgeRetrieval: 'Enable Knowledge Retrieval',
    settingsEnableRerank: 'Enable Rerank',
    settingsModelSource: 'Model source',
    settingsValidatingModel: 'Validating...',
    settingsValidateDefaultModel: 'Validate default model',
    settingsRefreshModels: 'Refresh models',
    settingsRefreshingModels: 'Refreshing...',
    settingsLastSync: 'Last sync: {value}',
    settingsCustomModel: 'Custom model',
    settingsCustomModelPlaceholder: 'Example: gpt-4.1-mini',
    settingsUseThisModel: 'Use this model',
    settingsInvalidConfigFile: 'Invalid config file format',
    settingsImportFailedPrefix: 'Import failed: ',
    settingsUnknownError: 'Unknown error',
    settingsModelNameRequired: 'Model name cannot be empty.',
    settingsModelNameTooLong: 'Model name is too long (max 120 characters).',
    settingsModelNameWhitespace: 'Model name cannot contain whitespace.',
    settingsFetchModelsFailed: 'Failed to fetch models. Please continue with preset or custom models.',
    settingsFetchModelsFailedWithReason: 'Failed to fetch models (gateway/direct both failed): {error}',
    settingsInvalidCustomModel: 'Invalid custom model.',
    settingsPresetModels: 'Preset models',
    settingsFetchedModels: 'Fetched models',
    settingsCustomModels: 'Custom models',
    settingsDefaultModelValidateFetchFailed: 'Default model validation failed: could not fetch model list.',
    settingsDefaultModelAvailableViaGateway: 'Default model is available (source: gateway).',
    settingsDefaultModelAvailableViaDirect: 'Default model is available (source: direct).',
    settingsDefaultModelUnavailable: 'Default model is not in the current available model list.',
    settingsDefaultModelValidateFailed: 'Default model validation failed. Please try again later.',
    settingsDiagnosticsFetchFailed: 'Failed to fetch diagnostics. Please try again later.',
    settingsApiKeyPlaceholder: 'sk-...',
    settingsSearchMode: 'Search mode',
    settingsSearchModeHybrid: 'Hybrid',
    settingsSearchModeIterative: 'Iterative',
    settingsSearchModeContext: 'Context',
    settingsRetrievalProfile: 'Profile',
    settingsRetrievalProfilePlaceholder: 'balanced',
    settingsRetrievalMinScore: 'Min score',
    settingsRetrievalBudgetTokens: 'Budget tokens',
    settingsRetrievalMaxIterations: 'Max iterations',
    settingsRetrievalConfidenceThreshold: 'Confidence threshold',
    settingsAgentContextTypes: 'Agent context types',
    settingsContextTypeWorld: 'World',
    settingsContextTypeCharacter: 'Character',
    settingsContextTypePlot: 'Plot',
  },
}
