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
    id: 'api',
    name: 'API 参考',
    description: 'MCP 端点、Gateway API、服务接口文档',
    icon: '📡',
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
