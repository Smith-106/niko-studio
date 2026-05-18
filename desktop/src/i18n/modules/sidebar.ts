type SidebarKeys =
  'sidebarToggleExpand'
  | 'sidebarToggleCollapse'
  | 'chatSidebarToggleExpand'
  | 'chatSidebarToggleCollapse'
  | 'storyBibleTitle'
  | 'storyBibleDesc'
  | 'storyBibleBraindump'
  | 'storyBibleBraindumpHint'
  | 'storyBibleGenre'
  | 'storyBibleGenrePlaceholder'
  | 'storyBibleSynopsis'
  | 'storyBibleSynopsisPlaceholder'
  | 'storyBibleCharacters'
  | 'storyBibleWorldbuilding'
  | 'storyBibleOutline'
  | 'storyBibleStyleTitle'
  | 'storyBibleStyleTried'
  | 'storyBibleStyleTriedDesc'
  | 'storyBibleStyleMatchMy'
  | 'storyBibleStyleMatchMyDesc'
  | 'storyBibleStyleSoundsLike'
  | 'storyBibleStyleSoundsLikeDesc'
  | 'storyBibleStyleCustom'
  | 'storyBibleStyleCustomDesc'
  | 'storyBibleGenerate'
  | 'storyBibleEmpty'
  | 'storyBibleLoading'
  | 'storyBiblePersistenceTitle'
  | 'storyBiblePersistenceLocalOnly'
  | 'storyBiblePersistenceGraphRead'
  | 'storyBibleExportDraft'
  | 'storyBibleImportDraft'
  | 'storyBibleResetDraft'
  | 'storyBibleDraftExported'
  | 'storyBibleDraftImported'
  | 'storyBibleDraftReset'
  | 'storyBibleDraftImportInvalid'
  | 'aiToolWrite'
  | 'aiToolRewrite'
  | 'aiToolDescribe'
  | 'aiToolBrainstorm'
  | 'sidebarWritingHelper'
  | 'sidebarMcpStatus'
  | 'sidebarEvaluationPanel'
  | 'sidebarNarrativeVisualization'
  | 'skillGroupCore'
  | 'skillGroupStory'
  | 'skillGroupQuality'
  | 'skillGroupTools'
  | 'skillGroupEmpty'
  | 'skillDescriptionGeneric'
  | 'skillDescCharacterForge'
  | 'skillDescSuspenseCraft'
  | 'skillDescDialogueSystem'
  | 'skillDescTensionArc'
  | 'skillDescEmotionArc'
  | 'skillDescOpeningCraft'
  | 'skillDescEndingCraft'
  | 'skillDescConflictEscalation'
  | 'writingHelperTitle'
  | 'writingHelperMode'
  | 'writingHelperModePolish'
  | 'writingHelperModeRewrite'
  | 'writingHelperModeExpand'
  | 'writingHelperModeSummarize'
  | 'writingHelperModeOutline'
  | 'writingHelperMaxSentences'
  | 'writingHelperMaxItems'
  | 'writingHelperInputText'
  | 'writingHelperInputPlaceholder'
  | 'sidebarTextOptimizer'
  | 'writerWorkspaceTitle'
  | 'writerWorkspaceHint'
  | 'writerStoryBibleLabel'
  | 'writerChapterLabel'
  | 'writerStoryBibleMetaLabel'
  | 'writerWorkspaceLabel'

export type Translations = Record<SidebarKeys, string>

export const zhSidebar: Translations = {
  sidebarToggleExpand: '展开侧边栏',
  sidebarToggleCollapse: '折叠侧边栏',
  chatSidebarToggleExpand: '展开聊天面板',
  chatSidebarToggleCollapse: '折叠聊天面板',
  storyBibleTitle: '故事圣经',
  storyBibleDesc: '记录你故事世界的关键细节，帮助 AI 生成更好的建议，或逐步完善你的创意直到完成初稿。',
  storyBibleBraindump: '灵感倾泻',
  storyBibleBraindumpHint: '写下你对故事所知的一切——情节、角色、世界观、主题，任何想法都可以！',
  storyBibleGenre: '题材类型',
  storyBibleGenrePlaceholder: '输入题材，如：奇幻、言情、悬疑...',
  storyBibleSynopsis: '故事概要',
  storyBibleSynopsisPlaceholder: '介绍角色、他们的目标、核心冲突，传达故事的基调和独特元素...',
  storyBibleCharacters: '角色',
  storyBibleWorldbuilding: '世界观',
  storyBibleOutline: '小说大纲',
  storyBibleStyleTitle: '写作风格',
  storyBibleStyleTried: '经典风格',
  storyBibleStyleTriedDesc: '经过验证的写作风格',
  storyBibleStyleMatchMy: '匹配我的风格',
  storyBibleStyleMatchMyDesc: '分析你的文字风格',
  storyBibleStyleSoundsLike: '听起来像',
  storyBibleStyleSoundsLikeDesc: '模仿指定作家的风格',
  storyBibleStyleCustom: '自定义',
  storyBibleStyleCustomDesc: '完全控制你的风格',
  storyBibleGenerate: '生成',
  storyBibleEmpty: '暂无内容',
  storyBibleLoading: '加载中...',
  storyBiblePersistenceTitle: '当前持久化边界',
  storyBiblePersistenceLocalOnly: 'local-only 草稿字段：braindump、genres、synopsis、outline、style 仅保存在当前设备的 localStorage 中。',
  storyBiblePersistenceGraphRead: 'graph-backed 只读列表：characters、locations 来自图谱查询，不包含在本地草稿 payload 中。',
  storyBibleExportDraft: '导出本地草稿',
  storyBibleImportDraft: '导入本地草稿',
  storyBibleResetDraft: '重置本地草稿',
  storyBibleDraftExported: 'Story Bible 本地草稿已导出。',
  storyBibleDraftImported: 'Story Bible 本地草稿已导入。',
  storyBibleDraftReset: 'Story Bible 本地草稿已重置。',
  storyBibleDraftImportInvalid: '导入的 Story Bible 草稿文件无效。',
  aiToolWrite: '写作',
  aiToolRewrite: '改写',
  aiToolDescribe: '描写',
  aiToolBrainstorm: '头脑风暴',
  sidebarWritingHelper: '写作助手',
  sidebarMcpStatus: '服务诊断',
  sidebarEvaluationPanel: '回复评估',
  sidebarNarrativeVisualization: '叙事可视化',
  skillGroupCore: '核心',
  skillGroupStory: '故事',
  skillGroupQuality: '质量',
  skillGroupTools: '工具',
  skillGroupEmpty: '暂无技能',
  skillDescriptionGeneric: '点击启用到当前对话',
  skillDescCharacterForge: '角色塑造',
  skillDescSuspenseCraft: '悬念张力',
  skillDescDialogueSystem: '对话系统',
  skillDescTensionArc: '张力曲线',
  skillDescEmotionArc: '情感弧光',
  skillDescOpeningCraft: '开篇技巧',
  skillDescEndingCraft: '结尾技巧',
  skillDescConflictEscalation: '冲突升级',
  writingHelperTitle: '写作助手',
  writingHelperMode: '模式',
  writingHelperModePolish: '润色',
  writingHelperModeRewrite: '改写',
  writingHelperModeExpand: '扩写',
  writingHelperModeSummarize: '摘要',
  writingHelperModeOutline: '提纲',
  writingHelperMaxSentences: '最大句数（摘要）',
  writingHelperMaxItems: '最大条目（提纲）',
  writingHelperInputText: '输入文本',
  writingHelperInputPlaceholder: '请输入待处理文本',
  sidebarTextOptimizer: 'AI 文本优化',
  writerWorkspaceTitle: '当前写作项目',
  writerWorkspaceHint: '聊天、评估和知识整理会优先围绕这组上下文。',
  writerStoryBibleLabel: '打开故事设定',
  writerChapterLabel: '章节',
  writerStoryBibleMetaLabel: '设定稿',
  writerWorkspaceLabel: '工作区',
}

export const enSidebar: Translations = {
  sidebarToggleExpand: 'Expand sidebar',
  sidebarToggleCollapse: 'Collapse sidebar',
  chatSidebarToggleExpand: 'Expand chat panel',
  chatSidebarToggleCollapse: 'Collapse chat panel',
  storyBibleTitle: 'Story Bible',
  storyBibleDesc: 'Track the key details of your story\'s world to improve AI suggestions, or fill it step-by-step to grow your idea into a first draft.',
  storyBibleBraindump: 'Braindump',
  storyBibleBraindumpHint: 'Write down everything you know about the story — plot, characters, worldbuilding, themes, anything!',
  storyBibleGenre: 'Genre',
  storyBibleGenrePlaceholder: 'Enter genres, e.g.: Fantasy, Romance, Mystery...',
  storyBibleSynopsis: 'Synopsis',
  storyBibleSynopsisPlaceholder: 'Introduce the characters, their goals, and the central conflict, while conveying the story\'s tone and unique elements...',
  storyBibleCharacters: 'Characters',
  storyBibleWorldbuilding: 'Worldbuilding',
  storyBibleOutline: 'Novel Outline',
  storyBibleStyleTitle: 'Writing Style',
  storyBibleStyleTried: 'Tried and True',
  storyBibleStyleTriedDesc: 'Proven writing styles',
  storyBibleStyleMatchMy: 'Match My Style',
  storyBibleStyleMatchMyDesc: 'Analyze your writing style',
  storyBibleStyleSoundsLike: 'Sounds Like You',
  storyBibleStyleSoundsLikeDesc: 'Mimic a specific author\'s style',
  storyBibleStyleCustom: 'Custom',
  storyBibleStyleCustomDesc: 'Full control over your style',
  storyBibleGenerate: 'Generate',
  storyBibleEmpty: 'No items yet',
  storyBibleLoading: 'Loading...',
  storyBiblePersistenceTitle: 'Current persistence boundary',
  storyBiblePersistenceLocalOnly: 'Local-only draft fields: braindump, genres, synopsis, outline, and style are stored only in this device/browser localStorage.',
  storyBiblePersistenceGraphRead: 'Graph-backed read lists: characters and locations come from graph queries and are not part of the local draft payload.',
  storyBibleExportDraft: 'Export local draft',
  storyBibleImportDraft: 'Import local draft',
  storyBibleResetDraft: 'Reset local draft',
  storyBibleDraftExported: 'Story Bible local draft exported.',
  storyBibleDraftImported: 'Story Bible local draft imported.',
  storyBibleDraftReset: 'Story Bible local draft reset.',
  storyBibleDraftImportInvalid: 'Invalid Story Bible draft file.',
  aiToolWrite: 'Write',
  aiToolRewrite: 'Rewrite',
  aiToolDescribe: 'Describe',
  aiToolBrainstorm: 'Brainstorm',
  sidebarWritingHelper: 'Writing Helper',
  sidebarMcpStatus: 'Service Diagnostics',
  sidebarEvaluationPanel: 'Reply Review',
  sidebarNarrativeVisualization: 'Narrative Visualization',
  skillGroupCore: 'Core',
  skillGroupStory: 'Story',
  skillGroupQuality: 'Quality',
  skillGroupTools: 'Tools',
  skillGroupEmpty: 'No skills',
  skillDescriptionGeneric: 'Click to apply in current chat',
  skillDescCharacterForge: 'Character Forge',
  skillDescSuspenseCraft: 'Suspense Craft',
  skillDescDialogueSystem: 'Dialogue System',
  skillDescTensionArc: 'Tension Arc',
  skillDescEmotionArc: 'Emotion Arc',
  skillDescOpeningCraft: 'Opening Craft',
  skillDescEndingCraft: 'Ending Craft',
  skillDescConflictEscalation: 'Conflict Escalation',
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
  sidebarTextOptimizer: 'Text Optimizer',
  writerWorkspaceTitle: 'Current writing project',
  writerWorkspaceHint: 'Chat, review, and knowledge flows stay anchored to this scope.',
  writerStoryBibleLabel: 'Open story notes',
  writerChapterLabel: 'Chapter',
  writerStoryBibleMetaLabel: 'Story bible',
  writerWorkspaceLabel: 'Workspace',
}
