type ChatKeys =
  'startWriting'
  | 'startWritingDesc'
  | 'chatStarterHint'
  | 'chatStarterContinue'
  | 'chatStarterRewrite'
  | 'chatStarterExpand'
  | 'chatStarterAlignCanon'
  | 'chatStarterCheckIssues'
  | 'thinking'
  | 'workflow'
  | 'quick'
  | 'lite'
  | 'standard'
  | 'brainstorm'
  | 'coordinator'
  | 'planning'
  | 'selectedSkills'
  | 'inputPlaceholder'
  | 'streamCanceled'
  | 'streamInterrupted'
  | 'streamRecovered'
  | 'streamReconnecting'
  | 'streamRestoreHint'
  | 'streamRestoreToBeforeSend'
  | 'streamRetryLastSend'
  | 'streamCopyError'
  | 'streamErrorCopied'
  | 'streamRestoreBeforeSendSuccess'
  | 'inlineNeedSelection'
  | 'inlineActionFailed'
  | 'inlineSelectedTextInfo'
  | 'inlineContinue'
  | 'inlineRevise'
  | 'inlineGenerate'
  | 'inlineRun'
  | 'inlineClearSelection'
  | 'inlineReviseDefaultInstruction'
  | 'inlineContinuePromptPrefix'
  | 'inlineGeneratePromptPrefix'
  | 'inlineGenerateContextFallback'
  | 'streamGateSoftGo'
  | 'streamGateNoGo'
  | 'streamGovernanceRecovered'
  | 'streamGovernanceReviewReady'
  | 'templateLibraryEntry'
  | 'templateLibraryTitle'
  | 'templateClosePanel'
  | 'templateCategoryAll'
  | 'templateCategoryBrainstorm'
  | 'templateCategoryOutline'
  | 'templateCategoryCharacter'
  | 'templateCategoryRewrite'
  | 'templateCategoryAnalysis'
  | 'templateCategoryCustom'
  | 'templateFavorite'
  | 'templateUnfavorite'
  | 'templateFavoriteOnlyOn'
  | 'templateFavoriteOnlyOff'
  | 'templateSearchPlaceholder'
  | 'templateRequiredHint'
  | 'templateApplyAction'
  | 'templateApplyReplace'
  | 'templateApplyAppend'
  | 'templateEmptyList'
  | 'templateNoMatch'
  | 'processingCompleted'
  | 'serviceUnavailableRetry'
  | 'backendConnectionFailed'
  | 'sessionCreateFailedRetry'
  | 'uploadUnsupportedFormat'
  | 'uploadInjectionFailedRetry'
  | 'uploadStageReading'
  | 'uploadStageUploading'
  | 'uploadStageInjecting'
  | 'uploadErrorFormat'
  | 'uploadErrorSize'
  | 'uploadErrorNetwork'
  | 'uploadErrorPrerequisite'
  | 'uploadErrorService'
  | 'uploadInjectedChunks'
  | 'uploadInjectedContext'
  | 'uploadMultipleProgress'
  | 'uploadMultipleComplete'
  | 'chatAgentContextPrefix'
  | 'quickRollbackTitle'
  | 'quickRollbackAdvancedToggle'
  | 'quickRollbackPlanIdPlaceholder'
  | 'quickRollbackCheckpointIdPlaceholder'
  | 'quickRollbackReasonPlaceholder'
  | 'quickRollbackAction'
  | 'quickRollbackSuccess'
  | 'quickRollbackFailed'
  | 'quickRollbackMissingRequired'
  | 'quickRollbackSummary'
  | 'chatModeLabel'
  | 'chatModeNormal'
  | 'chatModeAgent'
  | 'chatModeComparison'
  | 'modePresetsLabel'
  | 'modePresetFocusWriting'
  | 'modePresetAgentDiagnose'
  | 'modePresetCompareReview'
  | 'showMore'
  | 'showLess'
  | 'chatComparisonModelLabel'
  | 'messageBubblePrimaryModelLabel'
  | 'messageBubbleControlModelLabel'
  | 'messageBubbleDiffHighlightsLabel'
  | 'messageBubbleAcceptPrimary'
  | 'messageBubbleAcceptControl'
  | 'messageBubbleSourceSummaryTitle'
  | 'messageBubbleSourceSummaryUsed'
  | 'messageBubbleSourceSummaryFallback'
  | 'messageBubbleSourcePrimary'
  | 'messageBubbleSourceTypeCanon'
  | 'messageBubbleSourceTypeEntity'
  | 'messageBubbleSourceTypeRelation'
  | 'messageBubbleSourceTypeMemory'
  | 'messageBubbleRetrievalStatus'
  | 'messageBubbleCanonContextTitle'
  | 'messageBubbleCanonContextApplied'
  | 'messageBubbleCanonContextUnavailable'
  | 'messageBubblePromoteCanon'
  | 'messageBubblePromotingCanon'
  | 'messageBubblePromoteCanonSuccess'
  | 'messageBubblePromoteCanonFailure'
  | 'chatAgentActionWrite'
  | 'chatAgentActionRevise'
  | 'chatAgentActionContext'
  | 'composerUpload'
  | 'composerVoiceInput'
  | 'voiceInputStatusLabel'
  | 'composerSend'
  | 'starterContinueDesc'
  | 'starterRewriteDesc'
  | 'starterExpandDesc'
  | 'starterAlignCanonDesc'
  | 'starterCheckIssuesDesc'
  | 'starterContinuePrompt'
  | 'starterRewritePrompt'
  | 'starterExpandPrompt'
  | 'starterAlignCanonPrompt'
  | 'starterCheckIssuesPrompt'
  | 'writerContextTitle'
  | 'writerContextHint'
  | 'currentDocumentFallback'

export type Translations = Record<ChatKeys, string>

export const zhChat: Translations = {
  startWriting: '开始创作你的故事',
  startWritingDesc: '先选一个围绕当前文档的写作动作，再决定是否继续深入讨论。',
  chatStarterHint: '这些动作会优先围绕你当前的文档、章节和设定上下文。',
  chatStarterContinue: '继续当前文稿',
  chatStarterRewrite: '改写当前段落',
  chatStarterExpand: '扩写这个场景',
  chatStarterAlignCanon: '对齐现有设定',
  chatStarterCheckIssues: '检查当前问题',
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
  streamGovernanceRecovered: '本次结果记录为已恢复执行，可继续使用并建议复核。',
  streamGovernanceReviewReady: '本次结果已附带一致性治理记录，可在回复卡片中查看。',
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
  uploadErrorPrerequisite: '缺少文档解析依赖或当前导入路径不支持该格式',
  uploadErrorService: '服务处理失败，请稍后重试',
  uploadInjectedChunks: '已完成文件上下文注入：{fileName}（{chunks} 段）',
  uploadInjectedContext: '文件已注入上下文：{fileName}（{chunks} 段）',
  uploadMultipleProgress: '正在处理文件 {current}/{total}...',
  uploadMultipleComplete: '已完成 {success}/{total} 个文件上传',
  chatAgentContextPrefix: 'Agent 上下文结果',
  quickRollbackTitle: '快速回滚',
  quickRollbackAdvancedToggle: '高级：快速回滚',
  quickRollbackPlanIdPlaceholder: '计划 ID',
  quickRollbackCheckpointIdPlaceholder: '检查点 ID',
  quickRollbackReasonPlaceholder: '回滚原因（可选）',
  quickRollbackAction: '执行回滚',
  quickRollbackSuccess: '快速回滚执行成功。',
  quickRollbackFailed: '快速回滚执行失败。',
  quickRollbackMissingRequired: '请填写计划 ID 与检查点 ID。',
  quickRollbackSummary: '默认写作流程通常不需要这里；只有需要按计划或检查点回退时再展开高级区。',
  chatModeLabel: '模式：',
  chatModeNormal: '普通聊天',
  chatModeAgent: 'Agent 高级',
  chatModeComparison: '模型对比',
  modePresetsLabel: '预设：',
  modePresetFocusWriting: '专注写作',
  modePresetAgentDiagnose: 'Agent 诊断',
  modePresetCompareReview: '双模型校对',
  showMore: '更多',
  showLess: '收起',
  chatComparisonModelLabel: '对照模型',
  messageBubblePrimaryModelLabel: '主模型：',
  messageBubbleControlModelLabel: '对照模型：',
  messageBubbleDiffHighlightsLabel: '差异亮点',
  messageBubbleAcceptPrimary: '采纳主模型',
  messageBubbleAcceptControl: '采纳对照模型',
  messageBubbleSourceSummaryTitle: '本次参考',
  messageBubbleSourceSummaryUsed: '这次回复参考了 {summary}。',
  messageBubbleSourceSummaryFallback: '这次回复主要基于当前对话内容，没有额外展开资料。',
  messageBubbleSourcePrimary: '主要参考',
  messageBubbleSourceTypeCanon: '项目设定',
  messageBubbleSourceTypeEntity: '角色与要素',
  messageBubbleSourceTypeRelation: '关联线索',
  messageBubbleSourceTypeMemory: '历史记忆',
  messageBubbleRetrievalStatus: '检索状态： 实体 {entities} / 关系 {relations} / 记忆 {memories}',
  messageBubbleCanonContextTitle: 'Canon 来源',
  messageBubbleCanonContextApplied: '本次回复引用了 {matches} 条 canon 命中，来源于 {pages} 个已索引页面。',
  messageBubbleCanonContextUnavailable: '当前没能展开项目资料：{reason}',
  messageBubblePromoteCanon: '提升回复到 Canon',
  messageBubblePromotingCanon: '正在提升到 Canon…',
  messageBubblePromoteCanonSuccess: '已将回复提升到 Canon。',
  messageBubblePromoteCanonFailure: '提升回复到 Canon 失败。',
  chatAgentActionWrite: '写作',
  chatAgentActionRevise: '润色/重写',
  chatAgentActionContext: '取上下文',
  composerUpload: '上传文件',
  composerVoiceInput: '语音输入',
  voiceInputStatusLabel: '暂未开放',
  composerSend: '发送',
  starterContinueDesc: '保持当前语气和情节推进，继续往下写。',
  starterRewriteDesc: '把正在写的段落改得更流畅、更自然。',
  starterExpandDesc: '补足动作、环境和情绪细节。',
  starterAlignCanonDesc: '检查当前内容是否和现有设定冲突。',
  starterCheckIssuesDesc: '指出最值得先处理的问题和下一步。',
  starterContinuePrompt: '请基于{target}继续写作，保持当前语气、节奏和情节推进。',
  starterRewritePrompt: '请围绕{target}中我正在写的段落，给出更流畅、自然的改写版本。',
  starterExpandPrompt: '请围绕{target}扩写这个场景，补足动作、环境和情绪细节。',
  starterAlignCanonPrompt: '请检查{target}与现有故事设定是否一致，如有冲突请指出并给出修正建议。',
  starterCheckIssuesPrompt: '请审视{target}当前内容，指出最值得先处理的问题，并给出下一步建议。',
  writerContextTitle: '当前写作上下文',
  writerContextHint: '聊天、模板和评估会优先沿用这组项目范围。需要路由、对比或回滚时，展开"更多"。',
  currentDocumentFallback: '当前文档',
}

export const enChat: Translations = {
  startWriting: 'Start Writing Your Story',
  startWritingDesc: 'Pick a writing action for the current document first, then continue the conversation if needed.',
  chatStarterHint: 'These actions stay anchored to your current document, chapter, and story context.',
  chatStarterContinue: 'Continue this draft',
  chatStarterRewrite: 'Rewrite this passage',
  chatStarterExpand: 'Expand this scene',
  chatStarterAlignCanon: 'Align with story canon',
  chatStarterCheckIssues: 'Check current issues',
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
  streamGovernanceRecovered: 'This result is recorded as recovered execution and remains usable with review.',
  streamGovernanceReviewReady: 'This reply includes consistency governance details in the message card.',
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
  uploadErrorPrerequisite: 'Missing document parser dependency or unsupported import path for this format.',
  uploadErrorService: 'Service failed to process the file. Please retry later.',
  uploadInjectedChunks: 'File context injected: {fileName} ({chunks} chunks)',
  uploadInjectedContext: 'Context injected from file: {fileName} ({chunks} chunks)',
  uploadMultipleProgress: 'Processing file {current}/{total}...',
  uploadMultipleComplete: 'Successfully uploaded {success}/{total} files',
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
  quickRollbackSummary: 'Most writing sessions never need this area. Open the advanced section only when you need to roll back by plan or checkpoint.',
  chatModeLabel: 'Mode:',
  chatModeNormal: 'Normal Chat',
  chatModeAgent: 'Agent Advanced',
  chatModeComparison: 'Model Comparison',
  modePresetsLabel: 'Presets:',
  modePresetFocusWriting: 'Focus Writing',
  modePresetAgentDiagnose: 'Agent Diagnose',
  modePresetCompareReview: 'Dual-Model Review',
  showMore: 'More',
  showLess: 'Less',
  chatComparisonModelLabel: 'Control Model',
  messageBubblePrimaryModelLabel: 'Primary Model: ',
  messageBubbleControlModelLabel: 'Control Model: ',
  messageBubbleDiffHighlightsLabel: 'Diff highlights',
  messageBubbleAcceptPrimary: 'Accept primary',
  messageBubbleAcceptControl: 'Accept control',
  messageBubbleSourceSummaryTitle: 'References used',
  messageBubbleSourceSummaryUsed: 'This reply drew on {summary}.',
  messageBubbleSourceSummaryFallback: 'This reply stayed within the current conversation and did not expand into extra references.',
  messageBubbleSourcePrimary: 'Primary reference',
  messageBubbleSourceTypeCanon: 'project canon',
  messageBubbleSourceTypeEntity: 'characters and key elements',
  messageBubbleSourceTypeRelation: 'story links',
  messageBubbleSourceTypeMemory: 'project memory',
  messageBubbleRetrievalStatus: 'Retrieval: Entities {entities} / Relations {relations} / Memories {memories}',
  messageBubbleCanonContextTitle: 'Canon Context',
  messageBubbleCanonContextApplied: 'This reply used {matches} canon matches from {pages} indexed pages.',
  messageBubbleCanonContextUnavailable: 'The app could not expand into project references this time: {reason}',
  messageBubblePromoteCanon: 'Promote Reply to Canon',
  messageBubblePromotingCanon: 'Promoting to canon…',
  messageBubblePromoteCanonSuccess: 'Reply promoted to canon.',
  messageBubblePromoteCanonFailure: 'Failed to promote reply to canon.',
  chatAgentActionWrite: 'Write',
  chatAgentActionRevise: 'Polish/Rewrite',
  chatAgentActionContext: 'Get Context',
  composerUpload: 'Upload file',
  composerVoiceInput: 'Voice input',
  voiceInputStatusLabel: 'Coming soon',
  composerSend: 'Send',
  starterContinueDesc: 'Keep the current tone and momentum, then continue writing.',
  starterRewriteDesc: 'Make the current passage read more smoothly and naturally.',
  starterExpandDesc: 'Add stronger action, setting, and emotional detail.',
  starterAlignCanonDesc: 'Check whether the current content conflicts with existing canon.',
  starterCheckIssuesDesc: 'Identify the most important issues and suggest the next step.',
  starterContinuePrompt: 'Continue writing based on {target}, keeping the current tone, pacing, and story momentum.',
  starterRewritePrompt: 'Rewrite the passage I am drafting in {target} so it reads more smoothly and naturally.',
  starterExpandPrompt: 'Expand the current scene in {target} with stronger action, setting, and emotional detail.',
  starterAlignCanonPrompt: 'Check whether {target} aligns with the established story canon, and point out any conflicts with suggested fixes.',
  starterCheckIssuesPrompt: 'Review the current content in {target}, identify the most important issues to address, and suggest the next step.',
  writerContextTitle: 'Current writing context',
  writerContextHint: 'Chat, templates, and review flows will stay anchored to this project scope. Open "More" for routing, comparison, or rollback.',
  currentDocumentFallback: 'the current document',
}
