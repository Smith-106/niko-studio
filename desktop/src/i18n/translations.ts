export type Language = 'zh' | 'en'

export interface Translations {
  // App
  appTitle: string
  serviceRunning: string
  serviceOffline: string
  serviceDisconnected: string
  serviceDegraded: string
  serviceReconnecting: string
  contextUsage: string
  headerReconnectAttempts: string
  headerSessionHealth: string
  headerLatencySummary: string
  headerLastDecision: string
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
  mcpStatus: string
  evaluationPanel: string
  sidebarLatestActivity: string
  sidebarMessagesCount: string
  sidebarWarningCount: string
  sidebarHealthIdle: string
  sidebarHealthHealthy: string
  sidebarHealthDegraded: string
  sidebarHealthError: string

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
  messageDetailsTitle: string
  messageDetailsToggleAria: string
  messageDetailTerminal: string
  messageDetailDecision: string
  messageDetailRouteModel: string
  messageDetailControlModel: string
  messageDetailLatency: string
  messageDetailFallbackReason: string
  messageDetailFailureReason: string
  messageDetailErrorType: string
  messageDetailWorkflowLevel: string
  messageDetailWorkflowSteps: string
  messageDetailKnowledgeEntities: string
  messageDetailKnowledgeRelations: string
  messageDetailKnowledgeMemories: string
  messageDetailEvaluationScore: string
  messageDetailEvaluationFeedback: string
  messageDetailWarnings: string

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
    serviceDisconnected: '服务已断开',
    serviceDegraded: '服务降级',
    serviceReconnecting: '连接恢复中',
    contextUsage: '上下文',
    headerReconnectAttempts: '重连次数',
    headerSessionHealth: '会话健康',
    headerLatencySummary: '延迟',
    headerLastDecision: '最近决策',
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
    mcpStatus: 'MCP 状态',
    evaluationPanel: '评估面板',
    sidebarLatestActivity: '最近活动',
    sidebarMessagesCount: '{count} 条消息',
    sidebarWarningCount: '{count} 条警告',
    sidebarHealthIdle: '空闲',
    sidebarHealthHealthy: '健康',
    sidebarHealthDegraded: '降级',
    sidebarHealthError: '异常',

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
    messageDetailsTitle: '详情',
    messageDetailsToggleAria: '切换消息详情',
    messageDetailTerminal: '终态',
    messageDetailDecision: '质量门',
    messageDetailRouteModel: '路由模型',
    messageDetailControlModel: '对照模型',
    messageDetailLatency: '延迟',
    messageDetailFallbackReason: '降级原因',
    messageDetailFailureReason: '失败原因',
    messageDetailErrorType: '错误类型',
    messageDetailWorkflowLevel: '工作流级别',
    messageDetailWorkflowSteps: '执行步骤',
    messageDetailKnowledgeEntities: '实体数',
    messageDetailKnowledgeRelations: '关系数',
    messageDetailKnowledgeMemories: '记忆数',
    messageDetailEvaluationScore: '评估分',
    messageDetailEvaluationFeedback: '评估反馈',
    messageDetailWarnings: '警告',

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
    serviceDisconnected: 'Service Disconnected',
    serviceDegraded: 'Service Degraded',
    serviceReconnecting: 'Reconnecting',
    contextUsage: 'Context',
    headerReconnectAttempts: 'Reconnect Attempts',
    headerSessionHealth: 'Session Health',
    headerLatencySummary: 'Latency',
    headerLastDecision: 'Last Decision',
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
    mcpStatus: 'MCP Status',
    evaluationPanel: 'Evaluation Panel',
    sidebarLatestActivity: 'Latest Activity',
    sidebarMessagesCount: '{count} messages',
    sidebarWarningCount: '{count} warnings',
    sidebarHealthIdle: 'Idle',
    sidebarHealthHealthy: 'Healthy',
    sidebarHealthDegraded: 'Degraded',
    sidebarHealthError: 'Error',

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
    messageDetailsTitle: 'Details',
    messageDetailsToggleAria: 'Toggle message details',
    messageDetailTerminal: 'Terminal',
    messageDetailDecision: 'Quality Gate',
    messageDetailRouteModel: 'Route Model',
    messageDetailControlModel: 'Control Model',
    messageDetailLatency: 'Latency',
    messageDetailFallbackReason: 'Fallback Reason',
    messageDetailFailureReason: 'Failure Reason',
    messageDetailErrorType: 'Error Type',
    messageDetailWorkflowLevel: 'Workflow Level',
    messageDetailWorkflowSteps: 'Workflow Steps',
    messageDetailKnowledgeEntities: 'Entities',
    messageDetailKnowledgeRelations: 'Relations',
    messageDetailKnowledgeMemories: 'Memories',
    messageDetailEvaluationScore: 'Evaluation Score',
    messageDetailEvaluationFeedback: 'Evaluation Feedback',
    messageDetailWarnings: 'Warnings',

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
