export interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface DocPage {
  id: string;
  title: string;
  category: string;
  description: string;
  slug: string;
}

export interface ResolvedDocPage extends DocPage {
  categoryInfo: Category;
  path: string;
}

export const categories: Category[] = [
  {
    id: 'getting-started',
    name: '快速开始',
    description: '安装、配置和第一次使用 Niko Studio',
    icon: '🚀',
  },
  {
    id: 'guides',
    name: '指南',
    description: '能力路由、学习路径、状态矩阵和文档阅读指南',
    icon: '🧭',
  },
  {
    id: 'writing',
    name: '写作智能',
    description: '写作技法分析、叙事结构、角色画像等 AI 辅助功能',
    icon: '✍️',
  },
  {
    id: 'graph',
    name: '图谱系统',
    description: '角色关系图谱、伏笔追踪、角色深度分析',
    icon: '🔗',
  },
  {
    id: 'critic',
    name: '写作批评',
    description: '一致性检查、风格分析、多轮修订、上下文建议',
    icon: '🔍',
  },
  {
    id: 'worldview',
    name: '世界观管理',
    description: '世界观设定提取、管理和查询',
    icon: '🌍',
  },
  {
    id: 'agent',
    name: 'AI Agent',
    description: 'AI 代理路由、智能写作、修订和上下文管理',
    icon: '🤖',
  },
  {
    id: 'knowledge',
    name: '知识引擎',
    description: '写作知识库、模式检测、维度评分系统',
    icon: '🧠',
  },
  {
    id: 'memory',
    name: '素材管理',
    description: '素材上传、语义搜索、时间线查询',
    icon: '📂',
  },
  {
    id: 'desktop',
    name: '桌面应用',
    description: 'Tauri 桌面客户端、编辑器集成、本地存储',
    icon: '🖥️',
  },
  {
    id: 'sync',
    name: '云同步',
    description: '多设备同步、推送拉取、版本管理',
    icon: '☁️',
  },
  {
    id: 'architecture',
    name: '架构设计',
    description: '系统架构、模块划分、数据流设计',
    icon: '🏗️',
  },
  {
    id: 'narrative-viz',
    name: '叙事可视化',
    description: '时间线、张力曲线、角色图谱等交互式叙事图表',
    icon: '📊',
  },
  {
    id: 'api',
    name: 'API 参考',
    description: 'MCP 端点、Gateway API、服务接口文档',
    icon: '📡',
  },
  {
    id: 'reader',
    name: '读者模拟',
    description: '多画像阅读模拟、AI味检测、去AI重写、A/B版本对比',
    icon: '📖',
  },
];

export const docPages: DocPage[] = [
  // Getting Started
  { id: 'installation', title: '安装指南', category: 'getting-started', description: '系统要求和安装步骤', slug: 'installation' },
  { id: 'quickstart', title: '快速上手', category: 'getting-started', description: '5 分钟内开始使用 Niko Studio', slug: 'quickstart' },
  { id: 'configuration', title: '配置说明', category: 'getting-started', description: '自定义设置和偏好配置', slug: 'configuration' },

  // Guides
  { id: 'capability-routing', title: '能力路由指南', category: 'guides', description: '从用户意图选择写作、知识、Agent、Wiki、Workflow 和 API 能力', slug: 'capability-routing' },
  { id: 'learning-paths', title: '学习路径', category: 'guides', description: '按写作者、开发者、集成者和维护者角色选择阅读顺序', slug: 'learning-paths' },
  { id: 'capability-status', title: '能力状态矩阵', category: 'guides', description: '说明文档站能力状态标签、覆盖范围和维护来源', slug: 'capability-status' },
  { id: 'request-lifecycle', title: '请求生命周期', category: 'guides', description: '从用户输入到分析结果回流 UI 的完整链路', slug: 'request-lifecycle' },
  { id: 'doc-conventions', title: '文档阅读约定', category: 'guides', description: '图示、状态标签、证据边界和交叉链接的阅读规则', slug: 'doc-conventions' },
  { id: 'chapter-revision-playbook', title: '章节修订专题路径', category: 'guides', description: '从发现问题到修完一章的跨页案例导航', slug: 'chapter-revision-playbook' },
  { id: 'common-writing-problems', title: '常见写作问题索引', category: 'guides', description: '按问题类型快速跳到对应分析、修订和设定页面', slug: 'common-writing-problems' },
  { id: 'outline-to-final-manuscript', title: '从大纲到完稿', category: 'guides', description: '把规划、写作、分析、修订和设定沉淀串成一条完整长链路', slug: 'outline-to-final-manuscript' },
  { id: 'entry-matrix', title: '三维入口矩阵', category: 'guides', description: '按角色、问题和阶段三维组合选择最合适的文档入口', slug: 'entry-matrix' },
  { id: 'output-field-glossary', title: '输出字段词典', category: 'guides', description: '统一说明 score、evidence、suggestion、status、canon 等字段语义', slug: 'output-field-glossary' },

  // Writing Intelligence
  { id: 'craft-analysis', title: '写作技法分析', category: 'writing', description: '叙事视角、节奏、张力等维度的智能分析', slug: 'craft-analysis' },
  { id: 'narrative-structure', title: '叙事结构', category: 'writing', description: '三幕式、英雄之旅等结构模式识别', slug: 'narrative-structure' },
  { id: 'character-profile', title: '角色画像', category: 'writing', description: '五维评分、角色弧线、对话风格分析', slug: 'character-profile' },
  { id: 'scene-quality', title: '场景质量', category: 'writing', description: '场景节奏、氛围、冲突密度评估', slug: 'scene-quality' },
  { id: 'dialogue-analysis', title: '对话分析', category: 'writing', description: '对话自然度、角色区分度、潜台词检测', slug: 'dialogue-analysis' },
  { id: 'writing-stream', title: '流式写作', category: 'writing', description: '实时流式写作辅助和交互', slug: 'writing-stream' },

  // Graph System
  { id: 'graph-query', title: '图谱查询', category: 'graph', description: '知识图谱的通用查询接口', slug: 'graph-query' },
  { id: 'character-relationships', title: '角色关系', category: 'graph', description: '角色关系图谱的构建和可视化', slug: 'character-relationships' },
  { id: 'foreshadow-tracking', title: '伏笔追踪', category: 'graph', description: '伏笔埋设、回收和统计分析', slug: 'foreshadow-tracking' },
  { id: 'character-depth', title: '角色深度', category: 'graph', description: '角色复杂度和多维分析', slug: 'character-depth' },

  // Critic
  { id: 'critic-evaluate', title: '批评评估', category: 'critic', description: '多维度文本质量评估', slug: 'critic-evaluate' },
  { id: 'consistency-check', title: '一致性检查', category: 'critic', description: '跨章节设定和情节一致性验证', slug: 'consistency-check' },
  { id: 'style-profile', title: '风格分析', category: 'critic', description: '写作风格提取、画像和应用', slug: 'style-profile' },
  { id: 'multi-pass-revision', title: '多轮修订', category: 'critic', description: '自动化多轮文本修订流程', slug: 'multi-pass-revision' },
  { id: 'context-suggestions', title: '上下文建议', category: 'critic', description: '基于上下文的智能写作建议', slug: 'context-suggestions' },

  // Worldview
  { id: 'worldview-extract', title: '设定提取', category: 'worldview', description: '从文本中自动提取世界观设定', slug: 'worldview-extract' },
  { id: 'worldview-manage', title: '设定管理', category: 'worldview', description: '世界观设定的查询和一致性维护', slug: 'worldview-manage' },

  // AI Agent
  { id: 'agent-route', title: '代理路由', category: 'agent', description: '智能路由选择最优 AI 代理', slug: 'agent-route' },
  { id: 'agent-write', title: 'AI 写作', category: 'agent', description: '基于上下文的 AI 续写和创作', slug: 'agent-write' },
  { id: 'agent-revise', title: 'AI 修订', category: 'agent', description: 'AI 辅助文本修改和润色', slug: 'agent-revise' },
  { id: 'agent-context', title: '上下文管理', category: 'agent', description: '写作上下文的组装和传递', slug: 'agent-context' },
  { id: 'chat-system', title: '对话系统', category: 'agent', description: '对话式写作辅助和流式交互', slug: 'chat-system' },

  // Knowledge Engine
  { id: 'knowledge-base', title: '知识库', category: 'knowledge', description: '写作技法知识的结构化存储与检索', slug: 'knowledge-base' },
  { id: 'pattern-detection', title: '模式检测', category: 'knowledge', description: '自动识别文本中的写作模式和技法', slug: 'pattern-detection' },
  { id: 'dimension-scoring', title: '维度评分', category: 'knowledge', description: '多维度写作质量评分系统', slug: 'dimension-scoring' },
  { id: 'web-novel', title: '网文分析', category: 'knowledge', description: '网络小说特有的分析维度和评估标准', slug: 'web-novel' },

  // Memory
  { id: 'material-upload', title: '素材上传', category: 'memory', description: '上传写作素材和参考材料', slug: 'material-upload' },
  { id: 'semantic-search', title: '语义搜索', category: 'memory', description: '基于语义的素材和内容搜索', slug: 'semantic-search' },
  { id: 'temporal-query', title: '时间线查询', category: 'memory', description: '按时间线检索素材和版本', slug: 'temporal-query' },

  // Desktop
  { id: 'editor-integration', title: '编辑器集成', category: 'desktop', description: '与写作编辑器的深度集成', slug: 'editor-integration' },
  { id: 'writing-dashboard', title: '写作面板', category: 'desktop', description: 'WritingDashboard 多维度分析面板', slug: 'writing-dashboard' },
  { id: 'local-storage', title: '本地存储', category: 'desktop', description: '作品管理和本地数据存储', slug: 'local-storage' },
  { id: 'llm-integration', title: 'LLM 集成', category: 'desktop', description: '大语言模型接入和智能分析', slug: 'llm-integration' },
  { id: 'plugin-system', title: '插件系统', category: 'desktop', description: '扩展功能的插件架构', slug: 'plugin-system' },
  { id: 'skill-system', title: '技能系统', category: 'desktop', description: '自定义技能创建、管理和链式调用', slug: 'skill-system' },
  { id: 'wiki-system', title: 'Wiki 系统', category: 'desktop', description: '知识条目管理和 Wiki 页面', slug: 'wiki-system' },
  { id: 'narrative-visualization', title: '叙事可视化', category: 'narrative-viz', description: 'TimelineView、TensionCurveView、CharacterGraphView 交互式叙事图表', slug: 'narrative-visualization' },
  { id: 'niko-editor', title: 'Niko 编辑器', category: 'desktop', description: 'TipTap 富文本编辑器、Slash 命令、BubbleToolbar', slug: 'niko-editor' },
  { id: 'bubble-toolbar', title: 'BubbleToolbar', category: 'desktop', description: '选中文本浮动工具栏：格式化与 AI 重写', slug: 'bubble-toolbar' },
  { id: 'slash-command-menu', title: 'SlashCommandMenu', category: 'desktop', description: '斜杠命令菜单：AI 写作命令与格式块', slug: 'slash-command-menu' },
  { id: 'chat-area', title: '对话区', category: 'desktop', description: 'ChatArea 对话界面：消息流、模式控制与快捷操作', slug: 'chat-area' },
  { id: 'chat-area-composer', title: 'ChatAreaComposer', category: 'desktop', description: '对话输入框：文本输入、文件上传与草稿管理', slug: 'chat-area-composer' },
  { id: 'chat-area-mode-controls', title: 'ChatAreaModeControls', category: 'desktop', description: '对话模式控制栏：模式选择、预设与技能包', slug: 'chat-area-mode-controls' },
  { id: 'story-bible-panel', title: 'Story Bible', category: 'desktop', description: '故事圣经面板：Braindump、Canon、角色与世界观', slug: 'story-bible-panel' },
  { id: 'evaluation-panel', title: '评估面板', category: 'desktop', description: 'EvaluationPanel：4步评估流程、维度分析与支持工具', slug: 'evaluation-panel' },
  { id: 'writing-helper-panel', title: '写作助手', category: 'desktop', description: 'WritingHelperPanel：5种修订模式与8维风格控制', slug: 'writing-helper-panel' },
  { id: 'ai-text-optimizer', title: 'AI 文本优化器', category: 'desktop', description: 'AiTextOptimizer：降低AI痕迹、6种预设策略', slug: 'ai-text-optimizer' },
  { id: 'workflow-editor-panel', title: '工作流编辑器', category: 'desktop', description: 'WorkflowEditorPanel：多步骤工作流创建与执行', slug: 'workflow-editor-panel' },
  { id: 'settings-modal', title: '设置面板', category: 'desktop', description: 'SettingsModal：8个设置分区管理', slug: 'settings-modal' },
  { id: 'knowledge-modal', title: '知识面板', category: 'desktop', description: 'KnowledgeModal：知识查找、增强与参考', slug: 'knowledge-modal' },
  { id: 'automation-panel', title: '自动化面板', category: 'desktop', description: 'AutomationPanel：调度任务管理与人工门控', slug: 'automation-panel' },
  { id: 'mcp-status-panel', title: 'MCP 状态面板', category: 'desktop', description: 'McpStatusPanel：Gateway 监控、服务健康与实时日志', slug: 'mcp-status-panel' },
  { id: 'chat-sidebar', title: '聊天侧边栏', category: 'desktop', description: 'ChatSidebar：会话列表、历史管理与新建对话', slug: 'chat-sidebar' },
  { id: 'content-search', title: '内容搜索', category: 'desktop', description: 'ContentSearch：全局内容搜索与结果导航', slug: 'content-search' },
  { id: 'quick-panel', title: '快速面板', category: 'desktop', description: 'QuickPanel：快捷操作入口与最近项目', slug: 'quick-panel' },
  { id: 'template-manager', title: '模板管理器', category: 'desktop', description: 'TemplateManagerPanel：提示词模板 CRUD 与分类管理', slug: 'template-manager' },
  { id: 'reader-immersion-dashboard', title: '读者沉浸仪表板', category: 'desktop', description: 'ReaderImmersionDashboard：沉浸感评分、Show/Tell 比率与节奏处方', slug: 'reader-immersion-dashboard' },
  { id: 'voice-fingerprint-panel', title: '角色声纹面板', category: 'desktop', description: 'VoiceFingerprintPanel：角色语音一致性分析与修饰标记', slug: 'voice-fingerprint-panel' },
  { id: 'pacing-prescription-panel', title: '节奏处方面板', category: 'desktop', description: 'PacingPrescriptionPanel：节奏诊断与处方建议', slug: 'pacing-prescription-panel' },
  { id: 'emotional-arc-chart', title: '情感弧线图', category: 'desktop', description: 'EmotionalArcChart：情绪轨迹可视化与关键转折标注', slug: 'emotional-arc-chart' },
  { id: 'anti-pattern-warning', title: '反模式警告', category: 'desktop', description: 'AntiPatternWarning：写作反模式检测与修正建议', slug: 'anti-pattern-warning' },
  { id: 'virtual-list', title: '虚拟列表', category: 'desktop', description: 'VirtualList：大列表虚拟化渲染与自动滚动', slug: 'virtual-list' },
  { id: 'ai-toolbar', title: 'AI 工具栏', category: 'desktop', description: 'AiToolbar：选中文本后的 AI 操作入口', slug: 'ai-toolbar' },
  { id: 'analysis-panel', title: '分析面板', category: 'desktop', description: 'AnalysisPanel：多维度智能分析', slug: 'analysis-panel' },
  { id: 'app-header', title: '应用头部', category: 'desktop', description: 'AppHeader：全局导航与状态指示', slug: 'app-header' },
  { id: 'app-right-panels', title: '右侧面板组合', category: 'desktop', description: 'AppRightPanels：懒加载面板容器与错误边界', slug: 'app-right-panels' },
  { id: 'character-relationships-panel', title: '角色关系面板', category: 'desktop', description: 'CharacterRelationshipsPanel：角色关系网络与信任度', slug: 'character-relationships-panel' },
  { id: 'chat-message-list', title: '聊天消息列表', category: 'desktop', description: 'ChatMessageList：虚拟滚动消息渲染与流式内容', slug: 'chat-message-list' },
  { id: 'conflict-resolution-panel', title: '同步冲突解决面板', category: 'desktop', description: 'ConflictResolutionPanel：Vault 与知识图谱冲突解决', slug: 'conflict-resolution-panel' },
  { id: 'document-editor', title: '文档编辑器', category: 'desktop', description: 'DocumentEditor：写作工作台核心与自动保存', slug: 'document-editor' },
  { id: 'error-boundary', title: '错误边界', category: 'desktop', description: 'ErrorBoundary：组件崩溃保护与 Sentry 上报', slug: 'error-boundary' },
  { id: 'export-dialog', title: '导出对话框', category: 'desktop', description: 'ExportDialog：多格式导出与范围选择', slug: 'export-dialog' },
  { id: 'foreshadow-panel', title: '伏笔面板', category: 'desktop', description: 'ForeshadowingTrackerPanel：伏笔埋设与回收追踪', slug: 'foreshadow-panel' },
  { id: 'history-panel', title: '历史面板', category: 'desktop', description: 'HistoryPanel：版本快照、Diff 对比与恢复', slug: 'history-panel' },
  { id: 'keyboard-shortcuts-panel', title: '键盘快捷键面板', category: 'desktop', description: 'KeyboardShortcutsPanel：快捷键列表与帮助', slug: 'keyboard-shortcuts-panel' },
  { id: 'message-bubble', title: '消息气泡', category: 'desktop', description: 'MessageBubble：消息渲染、模型对比与 Canon 晋升', slug: 'message-bubble' },
  { id: 'pattern-dashboard-panel', title: '模式仪表板面板', category: 'desktop', description: 'PatternDashboardPanel：写作模式检测与统计', slug: 'pattern-dashboard-panel' },
  { id: 'prompt-template-panel', title: '提示模板面板', category: 'desktop', description: 'PromptTemplatePanel：模板浏览、变量填写与应用', slug: 'prompt-template-panel' },
  { id: 'project-sidebar', title: '项目侧边栏', category: 'desktop', description: 'ProjectSidebar：项目/卷/章节树形导航', slug: 'project-sidebar' },
  { id: 'quick-rollback', title: '快速回滚', category: 'desktop', description: 'QuickRollback：工作流检查点快速回滚', slug: 'quick-rollback' },
  { id: 'revision-preview-card', title: '修订预览卡片', category: 'desktop', description: 'RevisionPreviewCard：修订前后对比与 Diff 视图', slug: 'revision-preview-card' },
  { id: 'session-analytics-panel', title: '会话分析面板', category: 'desktop', description: 'SessionAnalyticsPanel：会话聚类与写作行为分析', slug: 'session-analytics-panel' },
  { id: 'sidebar', title: '主侧边栏', category: 'desktop', description: 'Sidebar：文档导航、工作区摘要与写作智慧流', slug: 'sidebar' },
  { id: 'thinking-effect', title: 'AI 思考效果动画', category: 'desktop', description: 'ThinkingEffect：思考过程动画指示器', slug: 'thinking-effect' },
  { id: 'toast-container', title: '消息提示容器', category: 'desktop', description: 'ToastContainer：全局操作反馈通知', slug: 'toast-container' },
  { id: 'welcome-wizard', title: '新手引导向导', category: 'desktop', description: 'WelcomeWizard：3 步引导创建项目与配置 AI', slug: 'welcome-wizard' },
  { id: 'workflow-steps-navigator', title: '工作流步骤导航器', category: 'desktop', description: 'WorkflowStepsNavigator：4 步写作智慧流导航', slug: 'workflow-steps-navigator' },
  { id: 'vault-selector', title: 'Vault 选择器', category: 'desktop', description: 'VaultSelector：Obsidian Vault 发现与选择', slug: 'vault-selector' },

  // Intelligence 子组件
  { id: 'accordion-wrapper', title: 'AccordionWrapper', category: 'desktop', description: '手风琴折叠容器，支持单选和多选模式', slug: 'accordion-wrapper' },
  { id: 'inline-annotation', title: 'InlineAnnotation', category: 'desktop', description: '内联标注组件，在文本中嵌入轻量级标记信息', slug: 'inline-annotation' },
  { id: 'intelligence-badge', title: 'IntelligenceBadge', category: 'desktop', description: '智能徽章，展示分析状态、类别或评分等级', slug: 'intelligence-badge' },
  { id: 'metric-value', title: 'MetricValue', category: 'desktop', description: '指标数值展示，支持趋势指示和单位标注', slug: 'metric-value' },
  { id: 'plugin-panel', title: 'PluginPanel', category: 'desktop', description: '插件面板容器，标题栏 + 工具区 + 内容区三段式布局', slug: 'plugin-panel' },
  { id: 'progress-bar', title: 'ProgressBar', category: 'desktop', description: '进度条组件，支持确定性、不确定和分段模式', slug: 'progress-bar' },
  { id: 'section-header', title: 'SectionHeader', category: 'desktop', description: '区块标题组件，支持图标、操作按钮和折叠控制', slug: 'section-header' },
  { id: 'show-tell-legend', title: 'ShowTellLegend', category: 'desktop', description: 'Show/Tell 图例，展示编辑器装饰的颜色含义', slug: 'show-tell-legend' },
  { id: 'template-manager-intel', title: 'TemplateManager（Intelligence）', category: 'desktop', description: 'Intelligence 模板管理器，分析模板的创建、选择和应用', slug: 'template-manager-intel' },
  { id: 'trend-chart', title: 'TrendChart', category: 'desktop', description: '趋势图表，折线图/面积图展示指标变化趋势', slug: 'trend-chart' },
  { id: 'writing-dimension-detail', title: 'WritingDimensionDetail', category: 'desktop', description: '写作维度详情，展示单个维度的评分、说明和改进建议', slug: 'writing-dimension-detail' },

  // Knowledge 子组件
  { id: 'character-tab', title: 'CharacterTab', category: 'desktop', description: '角色标签页，管理和浏览知识库中的角色信息', slug: 'character-tab' },
  { id: 'location-tab', title: 'LocationTab', category: 'desktop', description: '地点标签页，管理和浏览知识库中的地点信息', slug: 'location-tab' },
  { id: 'memory-form', title: 'MemoryForm', category: 'desktop', description: '记忆表单，创建和编辑知识库中的记忆条目', slug: 'memory-form' },
  { id: 'persisted-entity-tab', title: 'PersistedEntityTab', category: 'desktop', description: '持久实体标签页，通用实体类型的标准化管理界面', slug: 'persisted-entity-tab' },
  { id: 'plot-tab', title: 'PlotTab', category: 'desktop', description: '情节标签页，管理情节线索和剧情节点', slug: 'plot-tab' },
  { id: 'skill-tab', title: 'SkillTab', category: 'desktop', description: '技能标签页，管理角色技能和能力体系', slug: 'skill-tab' },

  // Evaluation 子组件
  { id: 'evaluation-compact-review-section', title: 'EvaluationCompactReviewSection', category: 'desktop', description: '简洁审查区，紧凑摘要形式展示评估结果', slug: 'evaluation-compact-review-section' },
  { id: 'evaluation-detailed-review-section', title: 'EvaluationDetailedReviewSection', category: 'desktop', description: '详细审查区，展开形式展示完整评估内容', slug: 'evaluation-detailed-review-section' },
  { id: 'evaluation-source-section', title: 'EvaluationSourceSection', category: 'desktop', description: '来源区，展示评估所基于的原始文本来源', slug: 'evaluation-source-section' },
  { id: 'evaluation-support-tools-section', title: 'EvaluationSupportToolsSection', category: 'desktop', description: '支持工具区，重新评估、对比评估、导出报告等辅助工具', slug: 'evaluation-support-tools-section' },
  { id: 'evaluation-workflow-section', title: 'EvaluationWorkflowSection', category: 'desktop', description: '工作流区，展示评估执行流程和当前状态', slug: 'evaluation-workflow-section' },
  { id: 'toggle-section-shell', title: 'ToggleSectionShell', category: 'desktop', description: '可折叠壳组件，统一的折叠/展开容器', slug: 'toggle-section-shell' },

  // Story Bible 子组件
  { id: 'card-list', title: 'CardList', category: 'desktop', description: '卡片列表，卡片网格或列表形式展示 Story Bible 条目', slug: 'card-list' },
  { id: 'collapsible-section', title: 'CollapsibleSection', category: 'desktop', description: '可折叠区，Story Bible 面板中的折叠/展开交互', slug: 'collapsible-section' },
  { id: 'narrative-record-list', title: 'NarrativeRecordList', category: 'desktop', description: '叙事记录列表，按时间线或分类浏览叙事条目', slug: 'narrative-record-list' },
  { id: 'story-bible-canon-section', title: 'StoryBibleCanonSection', category: 'desktop', description: 'Canon 区，管理已确认的核心设定条目', slug: 'story-bible-canon-section' },
  { id: 'story-bible-draft-section', title: 'StoryBibleDraftSection', category: 'desktop', description: '草稿区，管理尚未确认的设定和想法', slug: 'story-bible-draft-section' },
  { id: 'story-bible-knowledge-section', title: 'StoryBibleKnowledgeSection', category: 'desktop', description: '知识区，管理世界设定和规则体系等结构化知识', slug: 'story-bible-knowledge-section' },
  { id: 'story-bible-narrative-section', title: 'StoryBibleNarrativeSection', category: 'desktop', description: '叙事区，记录已发生的叙事事件和线索', slug: 'story-bible-narrative-section' },
  { id: 'story-bible-panel-content', title: 'StoryBiblePanelContent', category: 'desktop', description: '面板内容容器，整合 Canon/Draft/Knowledge/Narrative 各区块', slug: 'story-bible-panel-content' },

  // Panels 子组件
  { id: 'ai-context-selector', title: 'AiContextSelector', category: 'desktop', description: 'AI 上下文选择器，选择和配置发送给 AI 的上下文信息', slug: 'ai-context-selector' },
  { id: 'writing-context-panel', title: 'WritingContextPanel', category: 'desktop', description: '写作上下文面板，整合展示当前写作场景的上下文信息', slug: 'writing-context-panel' },

  // Knowledge Graph 子组件
  { id: 'graph-context-menu', title: 'GraphContextMenu', category: 'graph', description: '图谱上下文菜单，右键节点或边弹出操作菜单', slug: 'graph-context-menu' },
  { id: 'graph-minimap', title: 'GraphMinimap', category: 'graph', description: '图谱缩略图，全局缩略视图方便快速定位和导航', slug: 'graph-minimap' },
  { id: 'knowledge-graph-toolbar', title: 'KnowledgeGraphToolbar', category: 'graph', description: '图谱工具栏，布局控制、筛选、缩放等操作入口', slug: 'knowledge-graph-toolbar' },
  { id: 'knowledge-graph-view', title: 'KnowledgeGraphView', category: 'graph', description: '图谱视图，知识图谱的主渲染视图', slug: 'knowledge-graph-view' },
  { id: 'sidebar-graph-view', title: 'SidebarGraphView', category: 'graph', description: '侧边栏图谱视图，精简版聚焦局部关系网络', slug: 'sidebar-graph-view' },

  // Narrative 子组件
  { id: 'brainstorm-panel', title: 'BrainstormPanel', category: 'writing', description: '头脑风暴面板，AI 驱动的叙事创意拓展', slug: 'brainstorm-panel' },
  { id: 'quality-score-panel', title: 'QualityScorePanel', category: 'writing', description: '质量评分面板，多维度评分和综合评级', slug: 'quality-score-panel' },

  // Narrative Visualization 子组件
  { id: 'character-graph-view', title: 'CharacterGraphView', category: 'narrative-viz', description: '角色图谱视图，展示角色间的关系网络', slug: 'character-graph-view' },
  { id: 'tension-curve-view', title: 'TensionCurveView', category: 'narrative-viz', description: '张力曲线视图，展示故事张力的起伏变化', slug: 'tension-curve-view' },
  { id: 'timeline-view', title: 'TimelineView', category: 'narrative-viz', description: '时间线视图，展示故事中的事件序列', slug: 'timeline-view' },
  { id: 'visualization-toolbar', title: 'VisualizationToolbar', category: 'narrative-viz', description: '可视化工具栏，视图切换、导出和配置操作', slug: 'visualization-toolbar' },

  // Editor Extensions
  { id: 'math-view', title: 'MathView', category: 'desktop', description: '数学公式视图扩展，LaTeX 公式渲染和编辑', slug: 'math-view' },
  { id: 'show-tell-decorations', title: 'ShowTellDecorations', category: 'desktop', description: 'Show/Tell 装饰扩展，编辑器中标记写作手法分布', slug: 'show-tell-decorations' },
  { id: 'voice-consistency-decorations', title: 'VoiceConsistencyDecorations', category: 'desktop', description: '声纹一致性装饰扩展，检测角色对话声纹一致性问题', slug: 'voice-consistency-decorations' },

  { id: 'hook-cliffhanger', title: '钩子与断章检测', category: 'writing', description: '章节钩子强度评分、断章类型分类、读者状态模型', slug: 'hook-cliffhanger' },
  { id: 'voice-fingerprint', title: '角色声纹', category: 'writing', description: '角色语音一致性分析、修饰标记检测', slug: 'voice-fingerprint' },
  { id: 'emotional-arc', title: '情感弧线', category: 'writing', description: '情绪轨迹追踪、Show/Tell 比率、沉浸感评分', slug: 'emotional-arc' },
  { id: 'mystery-analysis', title: '悬疑分析', category: 'writing', description: '推理链分析、本格/社会派/硬汉/惊悚分类', slug: 'mystery-analysis' },
  { id: 'intelligent-revision', title: '智能修订', category: 'critic', description: '多轮 Critic-driven 修订循环、跨迭代学习、MCP 端点', slug: 'intelligent-revision' },
  { id: 'session-intelligence', title: '会话智能', category: 'writing', description: '写作行为 telemetry 收集、单会话分析、跨会话聚类', slug: 'session-intelligence' },
  { id: 'style-personalization', title: '风格个性化', category: 'critic', description: '偏好信号记录、个性化推荐引擎、KnowledgeMemory 持久化', slug: 'style-personalization' },

  // Sync
  { id: 'sync-overview', title: '同步概览', category: 'sync', description: '云同步架构和工作原理', slug: 'sync-overview' },
  { id: 'push-pull', title: '推送与拉取', category: 'sync', description: '数据推送、拉取和冲突解决', slug: 'push-pull' },

  // Architecture
  { id: 'system-overview', title: '系统概览', category: 'architecture', description: '整体架构和技术栈说明', slug: 'system-overview' },
  { id: 'module-design', title: '模块设计', category: 'architecture', description: '核心模块的职责划分和交互', slug: 'module-design' },
  { id: 'data-flow', title: '数据流', category: 'architecture', description: '数据在各层之间的流转路径', slug: 'data-flow' },

  // API
  { id: 'mcp-endpoints', title: 'MCP 端点', category: 'api', description: 'Model Context Protocol 服务端点', slug: 'mcp-endpoints' },
  { id: 'gateway-api', title: 'Gateway API', category: 'api', description: 'Node.js Gateway 服务接口', slug: 'gateway-api' },
  { id: 'writing-api', title: '写作 API', category: 'api', description: '写作辅助和流式写作端点', slug: 'writing-api' },
  { id: 'graph-api', title: '图谱 API', category: 'api', description: '角色关系和伏笔相关端点', slug: 'graph-api' },
  { id: 'critic-api', title: '批评 API', category: 'api', description: '一致性检查和风格分析端点', slug: 'critic-api' },
  { id: 'agent-api', title: 'Agent API', category: 'api', description: 'AI 代理路由和写作端点', slug: 'agent-api' },
  { id: 'memory-api', title: '素材 API', category: 'api', description: '素材管理和语义搜索端点', slug: 'memory-api' },
  { id: 'skill-api', title: '技能 API', category: 'api', description: '自定义技能 CRUD 和链式调用', slug: 'skill-api' },
  { id: 'wiki-api', title: 'Wiki API', category: 'api', description: '知识条目管理和查询端点', slug: 'wiki-api' },
  { id: 'workflow-api', title: 'Workflow API', category: 'api', description: '工作流编排和调度端点', slug: 'workflow-api' },
  { id: 'sync-api', title: '同步 API', category: 'api', description: '云同步推送拉取端点', slug: 'sync-api' },
  { id: 'health-api', title: '健康检查', category: 'api', description: '系统健康、指标和模型列表', slug: 'health-api' },
  { id: 'config-api', title: '配置 API', category: 'api', description: '配置读写和密钥管理', slug: 'config-api' },
  { id: 'plugin-api', title: '插件 API', category: 'api', description: '插件注册和执行端点', slug: 'plugin-api' },
  { id: 'workspace-api', title: 'Workspace API', category: 'api', description: '项目工作空间上下文', slug: 'workspace-api' },
  { id: 'learning-api', title: '学习 API', category: 'api', description: '导入学习、自进化写作和阅读学习端点', slug: 'learning-api' },
  { id: 'reader-api', title: 'Reader Simulation API', category: 'api', description: '多画像阅读模拟、AI味检测、去AI重写、A/B对比', slug: 'reader-api' },
];

export function getPagesByCategory(categoryId: string): DocPage[] {
  return docPages.filter((p) => p.category === categoryId);
}

export function getCategoryById(categoryId: string): Category | undefined {
  return categories.find((category) => category.id === categoryId);
}

export function getResolvedDocPages(): ResolvedDocPage[] {
  return docPages
    .map((page) => {
      const categoryInfo = getCategoryById(page.category);
      if (!categoryInfo) {
        return null;
      }

      return {
        ...page,
        categoryInfo,
        path: `/${page.category}/${page.slug}`,
      };
    })
    .filter(Boolean) as ResolvedDocPage[];
}
