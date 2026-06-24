type SettingsKeys =
  'settingsClose'
  | 'settingsTitle'
  | 'backendService'
  | 'backendUrl'
  | 'backendConfigTitle'
  | 'backendConfigDescription'
  | 'backendConfigLoading'
  | 'backendConfigSyncing'
  | 'backendConfigSyncSuccess'
  | 'backendConfigReload'
  | 'backendConfigSave'
  | 'backendConfigSaveSecrets'
  | 'backendConfigReadOnly'
  | 'backendConfigReadOnlyHint'
  | 'backendConfigSecretsTitle'
  | 'backendConfigSecretsDescription'
  | 'backendConfigShowSecret'
  | 'backendConfigHideSecret'
  | 'backendConfigConfigured'
  | 'backendConfigNotConfigured'
  | 'backendConfigNoConfig'
  | 'backendConfigNoSecrets'
  | 'backendConfigSectionAgent'
  | 'backendConfigSectionMemory'
  | 'backendConfigSectionWorkflow'
  | 'backendConfigSectionGraph'
  | 'backendConfigSectionWriting'
  | 'backendConfigSectionGateway'
  | 'backendConfigSectionBackup'
  | 'backendConfigSectionToken'
  | 'backendConfigSectionObsidian'
  | 'backendConfigSectionIntegration'
  | 'llmConfig'
  | 'multiModel'
  | 'primary'
  | 'testConnection'
  | 'testing'
  | 'apiKey'
  | 'baseUrl'
  | 'defaultModel'
  | 'setPrimary'
  | 'modelParams'
  | 'temperature'
  | 'temperatureDesc'
  | 'writingSettings'
  | 'defaultWorkflow'
  | 'workflowBackendMode'
  | 'workflowBackendModeStandard'
  | 'workflowBackendModeUiBridge'
  | 'workflowL1'
  | 'workflowL2'
  | 'workflowL3'
  | 'workflowL4'
  | 'workflowL5'
  | 'targetWords'
  | 'autoSkillMatch'
  | 'qualityGoalsTitle'
  | 'qualityGoalNaturalness'
  | 'qualityGoalReadability'
  | 'qualityGoalCoherence'
  | 'qualityGoalStyleConsistency'
  | 'qualityGoalPreset'
  | 'qualityPresetHumanWriting'
  | 'qualityPresetAiEditGuidance'
  | 'qualityPresetCustom'
  | 'qualityGoalSentenceEntropy'
  | 'qualityGoalRhythmVariability'
  | 'qualityGoalCustomInstruction'
  | 'qualityGoalCustomInstructionPlaceholder'
  | 'writingHelperLegacyPolish'
  | 'writingHelperClose'
  | 'writingHelperGuardStatus'
  | 'writingHelperGuardOn'
  | 'writingHelperGuardOff'
  | 'writingHelperHint'
  | 'writingHelperOpenSettings'
  | 'writingHelperModePrefix'
  | 'writingHelperRun'
  | 'writingHelperRunning'
  | 'writingHelperClearDraft'
  | 'writingHelperFailed'
  | 'writingHelperInsertToEditor'
  | 'settingsDiagnostics'
  | 'settingsCheckConnection'
  | 'settingsRefreshDiagnostics'
  | 'settingsAdvancedSupport'
  | 'settingsAdvancedSupportHint'
  | 'settingsDetailedDiagnosticsHint'
  | 'settingsOpenDetailedDiagnostics'
  | 'settingsGatewayMetrics'
  | 'settingsToolList'
  | 'settingsNoMetricsData'
  | 'settingsNoToolsData'
  | 'settingsAllowFallback'
  | 'settingsDetectionGuard'
  | 'settingsRetrieval'
  | 'settingsRetrievalProviderModel'
  | 'settingsRetrievalSearchPlaceholder'
  | 'settingsEnableKnowledgeRetrieval'
  | 'settingsEnableRerank'
  | 'settingsModelSource'
  | 'settingsValidatingModel'
  | 'settingsValidateDefaultModel'
  | 'settingsRefreshModels'
  | 'settingsRefreshingModels'
  | 'settingsLastSync'
  | 'settingsCustomModel'
  | 'settingsCustomModelPlaceholder'
  | 'settingsUseThisModel'
  | 'settingsInvalidConfigFile'
  | 'settingsImportFailedPrefix'
  | 'settingsUnknownError'
  | 'settingsSaveSuccess'
  | 'settingsSavePartialFailure'
  | 'settingsSaveFailed'
  | 'settingsSaveStagePersisted'
  | 'settingsSaveStageRuntime'
  | 'settingsSaveStageValidation'
  | 'settingsSaveValidationFailed'
  | 'settingsModelNameRequired'
  | 'settingsModelNameTooLong'
  | 'settingsModelNameWhitespace'
  | 'settingsFetchModelsFailed'
  | 'settingsFetchModelsFailedWithReason'
  | 'settingsInvalidCustomModel'
  | 'settingsPresetModels'
  | 'settingsFetchedModels'
  | 'settingsCustomModels'
  | 'settingsDefaultModelValidateFetchFailed'
  | 'settingsDefaultModelAvailableViaGateway'
  | 'settingsDefaultModelAvailableViaDirect'
  | 'settingsDefaultModelUnavailable'
  | 'settingsDefaultModelValidateFailed'
  | 'settingsDiagnosticsFetchFailed'
  | 'settingsApiKeyPlaceholder'
  | 'settingsSearchMode'
  | 'settingsSearchModeHybrid'
  | 'settingsSearchModeIterative'
  | 'settingsSearchModeContext'
  | 'settingsRetrievalProfile'
  | 'settingsRetrievalProfilePlaceholder'
  | 'settingsRetrievalMinScore'
  | 'settingsRetrievalBudgetTokens'
  | 'settingsRetrievalMaxIterations'
  | 'settingsRetrievalConfidenceThreshold'
  | 'settingsAgentContextTypes'
  | 'settingsContextTypeWorld'
  | 'settingsContextTypeCharacter'
  | 'settingsContextTypePlot'
  | 'templateManagerCategoryAll'
  | 'templateManagerCategoryStructure'
  | 'templateManagerCategoryGenre'
  | 'templateManagerCategoryFormat'
  | 'templateManagerCategoryPlot'
  | 'templateManagerCategoryCustom'
  | 'templateManagerBuiltin'
  | 'templateManagerCustom'
  | 'templateManagerEmptyList'
  | 'templateManagerPreviewBack'
  | 'templateManagerApply'
  | 'templateManagerSaveAsCustom'
  | 'templateManagerDuplicate'
  | 'templateManagerDelete'
  | 'templateManagerDeleteConfirm'
  | 'templateManagerNoProject'
  | 'templateManagerApplied'
  | 'templateManagerPreviewOutline'
  | 'templateManagerLoading'
  | 'templateManagerPlaceholders'

export type Translations = Record<SettingsKeys, string>

export const zhSettings: Translations = {
  settingsClose: '关闭设置',
  settingsTitle: '设置',
  backendService: '连接与本地服务',
  backendUrl: '本地服务地址',
  backendConfigTitle: '本地服务设置',
  backendConfigDescription: '查看并编辑后端运行时配置。只读字段需要修改配置文件或重启服务。',
  backendConfigLoading: '加载配置中...',
  backendConfigSyncing: '同步中...',
  backendConfigSyncSuccess: '同步成功',
  backendConfigReload: '从文件重新加载',
  backendConfigSave: '保存更改',
  backendConfigSaveSecrets: '保存密钥',
  backendConfigReadOnly: '只读',
  backendConfigReadOnlyHint: '该字段需要修改配置文件或重启服务后生效',
  backendConfigSecretsTitle: '敏感字段',
  backendConfigSecretsDescription: '敏感字段会单独通过 secrets 接口保存。',
  backendConfigShowSecret: '显示',
  backendConfigHideSecret: '隐藏',
  backendConfigConfigured: '已配置',
  backendConfigNotConfigured: '未配置',
  backendConfigNoConfig: '暂无后端配置数据。',
  backendConfigNoSecrets: '当前没有可编辑的敏感字段。',
  backendConfigSectionAgent: 'Agent',
  backendConfigSectionMemory: 'Memory',
  backendConfigSectionWorkflow: 'Workflow',
  backendConfigSectionGraph: 'Graph',
  backendConfigSectionWriting: 'Writing',
  backendConfigSectionGateway: 'Gateway',
  backendConfigSectionBackup: 'Backup',
  backendConfigSectionToken: 'Token',
  backendConfigSectionObsidian: 'Obsidian',
  backendConfigSectionIntegration: 'Integration',
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
  workflowBackendModeUiBridge: 'UI 桥接（/ui-bridge/workflow/*）',
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
  writingHelperLegacyPolish: '写作助手润色走旧版接口',
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
  writingHelperInsertToEditor: '插入到编辑器',
  settingsDiagnostics: '连接帮助',
  settingsCheckConnection: '查看连接',
  settingsRefreshDiagnostics: '重新检查',
  settingsAdvancedSupport: '高级支持',
  settingsAdvancedSupportHint: '只在需要排查连接问题或修改本地服务配置时再展开。',
  settingsDetailedDiagnosticsHint: '需要查看连接状态、运行指标和更详细的信息时，再进入完整详情面板。',
  settingsOpenDetailedDiagnostics: '打开详细诊断',
  settingsGatewayMetrics: '网关指标',
  settingsToolList: '工具清单',
  settingsNoMetricsData: '暂无指标数据',
  settingsNoToolsData: '暂无工具数据',
  settingsAllowFallback: '允许降级',
  settingsDetectionGuard: '检测规避拦截',
  settingsRetrieval: '检索设置',
  settingsRetrievalProviderModel: '检索模型',
  settingsRetrievalSearchPlaceholder: '搜索模型名称或关键词',
  settingsEnableKnowledgeRetrieval: '为写作补充参考资料',
  settingsEnableRerank: '优先更贴近当前内容',
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
  settingsSaveSuccess: '设置已保存。',
  settingsSavePartialFailure: '设置已保存，但这些阶段仍需处理：{stages}',
  settingsSaveFailed: '设置未完整保存，请先处理这些阶段：{stages}',
  settingsSaveStagePersisted: '设置持久化',
  settingsSaveStageRuntime: '运行时同步',
  settingsSaveStageValidation: '后端校验',
  settingsSaveValidationFailed: '后端校验未通过。',
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
  settingsSearchModeHybrid: '混合检索',
  settingsSearchModeIterative: '迭代检索',
  settingsSearchModeContext: '上下文检索',
  settingsRetrievalProfile: '检索配置',
  settingsRetrievalProfilePlaceholder: 'balanced',
  settingsRetrievalMinScore: '最小分数',
  settingsRetrievalBudgetTokens: '检索预算',
  settingsRetrievalMaxIterations: '最大迭代次数',
  settingsRetrievalConfidenceThreshold: '置信阈值',
  settingsAgentContextTypes: '参考资料范围',
  settingsContextTypeWorld: '世界观',
  settingsContextTypeCharacter: '角色',
  settingsContextTypePlot: '剧情',
  templateManagerCategoryAll: '全部',
  templateManagerCategoryStructure: '结构',
  templateManagerCategoryGenre: '类型',
  templateManagerCategoryFormat: '格式',
  templateManagerCategoryPlot: '剧情',
  templateManagerCategoryCustom: '自定义',
  templateManagerBuiltin: '内置',
  templateManagerCustom: '自定义',
  templateManagerEmptyList: '暂无模板',
  templateManagerPreviewBack: '返回列表',
  templateManagerApply: '应用到当前章节',
  templateManagerSaveAsCustom: '保存为自定义模板',
  templateManagerDuplicate: '复制',
  templateManagerDelete: '删除',
  templateManagerDeleteConfirm: '确认删除此模板？',
  templateManagerNoProject: '请先打开一个项目，再应用模板。',
  templateManagerApplied: '模板已应用',
  templateManagerPreviewOutline: '结构预览',
  templateManagerLoading: '加载中...',
  templateManagerPlaceholders: '模板变量',
}

export const enSettings: Translations = {
  settingsClose: 'Close settings',
  settingsTitle: 'Settings',
  backendService: 'Connection & local service',
  backendUrl: 'Local service address',
  backendConfigTitle: 'Local service settings',
  backendConfigDescription: 'View and edit runtime backend configuration. Read-only fields still require file changes or a service restart.',
  backendConfigLoading: 'Loading configuration...',
  backendConfigSyncing: 'Syncing...',
  backendConfigSyncSuccess: 'Sync successful',
  backendConfigReload: 'Reload from file',
  backendConfigSave: 'Save changes',
  backendConfigSaveSecrets: 'Save secrets',
  backendConfigReadOnly: 'Read only',
  backendConfigReadOnlyHint: 'This field requires a config file change or service restart to take effect',
  backendConfigSecretsTitle: 'Sensitive Fields',
  backendConfigSecretsDescription: 'Sensitive fields are saved separately through the secrets endpoint.',
  backendConfigShowSecret: 'Show',
  backendConfigHideSecret: 'Hide',
  backendConfigConfigured: 'Configured',
  backendConfigNotConfigured: 'Not configured',
  backendConfigNoConfig: 'No backend configuration data available.',
  backendConfigNoSecrets: 'There are currently no editable sensitive fields.',
  backendConfigSectionAgent: 'Agent',
  backendConfigSectionMemory: 'Memory',
  backendConfigSectionWorkflow: 'Workflow',
  backendConfigSectionGraph: 'Graph',
  backendConfigSectionWriting: 'Writing',
  backendConfigSectionGateway: 'Gateway',
  backendConfigSectionBackup: 'Backup',
  backendConfigSectionToken: 'Token',
  backendConfigSectionObsidian: 'Obsidian',
  backendConfigSectionIntegration: 'Integration',
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
  workflowBackendModeUiBridge: 'UI Bridge (/ui-bridge/workflow/*)',
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
  writingHelperInsertToEditor: 'Insert to Editor',
  settingsDiagnostics: 'Connection help',
  settingsCheckConnection: 'Check connection',
  settingsRefreshDiagnostics: 'Check again',
  settingsAdvancedSupport: 'Advanced support',
  settingsAdvancedSupportHint: 'Expand this only when you need connection troubleshooting or local service configuration.',
  settingsDetailedDiagnosticsHint: 'Open the full details panel only when you need connection status, runtime metrics, or deeper support details.',
  settingsOpenDetailedDiagnostics: 'Open detailed diagnostics',
  settingsGatewayMetrics: 'Gateway metrics',
  settingsToolList: 'Tool list',
  settingsNoMetricsData: 'No metrics data',
  settingsNoToolsData: 'No tool data',
  settingsAllowFallback: 'Allow fallback',
  settingsDetectionGuard: 'Detection-evasion guard',
  settingsRetrieval: 'Retrieval settings',
  settingsRetrievalProviderModel: 'Retrieval model',
  settingsRetrievalSearchPlaceholder: 'Search model name or keyword',
  settingsEnableKnowledgeRetrieval: 'Use supporting references',
  settingsEnableRerank: 'Prioritize closer matches',
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
  settingsSaveSuccess: 'Settings saved.',
  settingsSavePartialFailure: 'Settings were saved, but these stages still need attention: {stages}',
  settingsSaveFailed: 'Settings did not save cleanly. Resolve these stages first: {stages}',
  settingsSaveStagePersisted: 'settings persistence',
  settingsSaveStageRuntime: 'runtime sync',
  settingsSaveStageValidation: 'backend validation',
  settingsSaveValidationFailed: 'Backend validation did not pass.',
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
  settingsRetrievalBudgetTokens: 'Retrieval budget',
  settingsRetrievalMaxIterations: 'Max iterations',
  settingsRetrievalConfidenceThreshold: 'Confidence threshold',
  settingsAgentContextTypes: 'Reference scope',
  settingsContextTypeWorld: 'World',
  settingsContextTypeCharacter: 'Character',
  settingsContextTypePlot: 'Plot',
  templateManagerCategoryAll: 'All',
  templateManagerCategoryStructure: 'Structure',
  templateManagerCategoryGenre: 'Genre',
  templateManagerCategoryFormat: 'Format',
  templateManagerCategoryPlot: 'Plot',
  templateManagerCategoryCustom: 'Custom',
  templateManagerBuiltin: 'Built-in',
  templateManagerCustom: 'Custom',
  templateManagerEmptyList: 'No templates yet',
  templateManagerPreviewBack: 'Back to list',
  templateManagerApply: 'Apply to current chapter',
  templateManagerSaveAsCustom: 'Save as custom template',
  templateManagerDuplicate: 'Duplicate',
  templateManagerDelete: 'Delete',
  templateManagerDeleteConfirm: 'Are you sure you want to delete this template?',
  templateManagerNoProject: 'Please open a project first before applying a template.',
  templateManagerApplied: 'Template applied',
  templateManagerPreviewOutline: 'Structure preview',
  templateManagerLoading: 'Loading...',
  templateManagerPlaceholders: 'Template variables',
}
