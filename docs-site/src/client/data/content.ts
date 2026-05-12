const contentMap: Record<string, string> = {
  installation: `
<h2>系统要求</h2>
<ul>
  <li>Windows 10/11 (64-bit) 或 macOS 12+</li>
  <li>4GB 以上可用内存</li>
  <li>500MB 磁盘空间</li>
  <li>Node.js 18+ (可选，用于开发模式)</li>
</ul>

<h2>安装步骤</h2>
<h3>桌面应用安装</h3>
<p>从 GitHub Releases 页面下载最新版本的安装包：</p>
<pre><code># Windows
niko-studio-setup-x.x.x.exe

# macOS
niko-studio-x.x.x.dmg</code></pre>

<h3>开发环境搭建</h3>
<pre><code># 克隆仓库
git clone https://github.com/niconi21/niko-studio.git
cd niko-studio/desktop

# 安装依赖
npm ci

# 启动开发服务器
npm run dev</code></pre>

<h2>验证安装</h2>
<p>启动应用后，你应该能看到 Niko Studio 的主界面，包含编辑器区域和写作智能面板。</p>
`,

  quickstart: `
<h2>创建第一个项目</h2>
<p>启动 Niko Studio 后，点击「新建项目」按钮创建你的第一个写作项目。</p>

<h3>导入已有文本</h3>
<p>支持导入以下格式的文件：</p>
<ul>
  <li><code>.txt</code> — 纯文本文件</li>
  <li><code>.md</code> — Markdown 文件</li>
  <li><code>.docx</code> — Word 文档</li>
</ul>

<h3>使用写作分析</h3>
<p>在编辑器中输入或粘贴文本后，点击右侧面板的「分析」按钮，即可获得多维度的写作质量评估。</p>

<h2>核心功能一览</h2>
<ul>
  <li><strong>写作技法分析</strong> — 自动识别叙事视角、节奏、张力等维度</li>
  <li><strong>角色画像</strong> — 五维评分系统，追踪角色发展弧线</li>
  <li><strong>场景质量</strong> — 评估场景的节奏、氛围和冲突密度</li>
  <li><strong>知识库</strong> — 内置写作技法知识，提供针对性建议</li>
</ul>
`,

  configuration: `
<h2>应用设置</h2>
<p>通过「设置」面板可以自定义 Niko Studio 的行为。</p>

<h3>LLM 配置</h3>
<p>Niko Studio 支持多种大语言模型后端：</p>
<ul>
  <li><strong>本地模型</strong> — 通过 Ollama 运行本地模型</li>
  <li><strong>OpenAI API</strong> — 使用 GPT-4 等模型</li>
  <li><strong>Anthropic API</strong> — 使用 Claude 模型</li>
</ul>

<h3>分析偏好</h3>
<p>可以配置默认的分析维度和评分标准，适配不同的写作类型（文学小说、网络小说、非虚构等）。</p>
`,

  'craft-analysis': `
<h2>写作技法分析概述</h2>
<p>写作技法分析是 Niko Studio 的核心功能，通过 AI 对文本进行多维度的技法识别和质量评估。</p>

<h3>分析维度</h3>
<ul>
  <li><strong>叙事视角</strong> — 第一人称、第三人称有限、全知视角等</li>
  <li><strong>叙事节奏</strong> — 场景展开速度、时间跨度、详略分配</li>
  <li><strong>情感张力</strong> — 冲突强度、悬念设置、情感起伏</li>
  <li><strong>语言风格</strong> — 修辞手法、句式变化、词汇丰富度</li>
  <li><strong>意象密度</strong> — 感官描写、隐喻使用、象征系统</li>
</ul>

<h3>评分系统</h3>
<p>每个维度采用 1-10 分制评分，并提供具体的文本证据和改进建议。</p>
`,

  'narrative-structure': `
<h2>叙事结构识别</h2>
<p>自动识别文本中使用的叙事结构模式。</p>

<h3>支持的结构模式</h3>
<ul>
  <li><strong>三幕式结构</strong> — 设置、对抗、解决</li>
  <li><strong>英雄之旅</strong> — 坎贝尔十二阶段模型</li>
  <li><strong>起承转合</strong> — 东方叙事传统结构</li>
  <li><strong>非线性叙事</strong> — 倒叙、插叙、多线并行</li>
</ul>

<h3>结构可视化</h3>
<p>通过图表展示故事的结构节点和转折点，帮助作者把握整体节奏。</p>
`,

  'character-profile': `
<h2>角色画像系统</h2>
<p>基于文本分析自动生成角色画像，追踪角色在故事中的发展变化。</p>

<h3>五维评分</h3>
<ul>
  <li><strong>复杂度</strong> — 角色性格的多面性和矛盾性</li>
  <li><strong>一致性</strong> — 行为与性格设定的吻合度</li>
  <li><strong>成长性</strong> — 角色弧线的完整度和说服力</li>
  <li><strong>辨识度</strong> — 角色的独特性和记忆点</li>
  <li><strong>功能性</strong> — 角色在故事中的叙事功能</li>
</ul>

<h3>角色关系图谱</h3>
<p>自动提取角色间的关系网络，可视化展示人物关系的亲疏远近。</p>
`,

  'scene-quality': `
<h2>场景质量评估</h2>
<p>对单个场景进行细粒度的质量分析。</p>

<h3>评估维度</h3>
<ul>
  <li><strong>场景节奏</strong> — 动作与描写的比例、节奏变化</li>
  <li><strong>氛围营造</strong> — 环境描写的有效性、情绪渲染</li>
  <li><strong>冲突密度</strong> — 场景内的矛盾和张力</li>
  <li><strong>信息效率</strong> — 场景承载的叙事信息量</li>
</ul>
`,

  'dialogue-analysis': `
<h2>对话分析</h2>
<p>评估对话的质量和功能性。</p>

<h3>分析指标</h3>
<ul>
  <li><strong>自然度</strong> — 对话是否符合角色身份和语境</li>
  <li><strong>区分度</strong> — 不同角色的对话风格差异</li>
  <li><strong>潜台词</strong> — 对话中隐含信息的丰富度</li>
  <li><strong>功能性</strong> — 对话推动情节或揭示性格的效果</li>
</ul>
`,

  'knowledge-base': `
<h2>写作知识库</h2>
<p>Niko Studio 内置了结构化的写作技法知识库，涵盖传统文学理论和网络文学实践。</p>

<h3>知识分类</h3>
<ul>
  <li><strong>叙事技法</strong> — 视角、时间、空间的处理方式</li>
  <li><strong>修辞手法</strong> — 比喻、象征、反讽等修辞策略</li>
  <li><strong>结构模式</strong> — 各类叙事结构的特征和适用场景</li>
  <li><strong>类型惯例</strong> — 不同文学类型的写作规范</li>
</ul>

<h3>知识检索</h3>
<p>支持语义搜索，根据写作场景智能推荐相关知识条目。</p>
`,

  'pattern-detection': `
<h2>模式检测</h2>
<p>自动识别文本中使用的写作模式和技法。</p>

<h3>检测能力</h3>
<ul>
  <li>叙事视角切换检测</li>
  <li>伏笔和呼应识别</li>
  <li>节奏模式分析（快慢交替）</li>
  <li>修辞手法标注</li>
  <li>情感曲线追踪</li>
</ul>
`,

  'dimension-scoring': `
<h2>维度评分系统</h2>
<p>多维度的写作质量量化评估框架。</p>

<h3>评分维度</h3>
<p>系统提供以下核心维度的评分：</p>
<ul>
  <li>叙事技巧 (Narrative Craft)</li>
  <li>语言表现力 (Language Expression)</li>
  <li>结构完整性 (Structural Integrity)</li>
  <li>角色塑造 (Characterization)</li>
  <li>情感共鸣 (Emotional Resonance)</li>
</ul>

<h3>评分标准</h3>
<p>每个维度采用 1-10 分制，配合具体的文本证据和改进方向。评分标准可根据写作类型（文学/网文/非虚构）进行调整。</p>
`,

  'web-novel': `
<h2>网文分析</h2>
<p>针对网络小说的特有分析维度和评估标准。</p>

<h3>网文特有维度</h3>
<ul>
  <li><strong>爽点密度</strong> — 情节高潮和满足感的分布</li>
  <li><strong>节奏把控</strong> — 章节结构和断章技巧</li>
  <li><strong>金手指设计</strong> — 主角优势的合理性和趣味性</li>
  <li><strong>世界观构建</strong> — 设定的一致性和新颖度</li>
  <li><strong>读者粘性</strong> — 悬念设置和追读动力</li>
</ul>
`,

  'editor-integration': `
<h2>编辑器集成</h2>
<p>Niko Studio 提供内置的写作编辑器，支持实时分析和智能辅助。</p>

<h3>编辑器特性</h3>
<ul>
  <li>Markdown 实时预览</li>
  <li>字数统计和写作进度追踪</li>
  <li>侧边栏实时分析面板</li>
  <li>内联标注和建议</li>
  <li>多文档标签页管理</li>
</ul>
`,

  'local-storage': `
<h2>本地存储</h2>
<p>所有写作数据默认存储在本地，保护你的创作隐私。</p>

<h3>存储结构</h3>
<ul>
  <li><strong>项目文件</strong> — 原始文本和元数据</li>
  <li><strong>分析缓存</strong> — 已完成的分析结果</li>
  <li><strong>知识索引</strong> — 本地知识库索引</li>
  <li><strong>用户配置</strong> — 个人偏好设置</li>
</ul>
`,

  'llm-integration': `
<h2>LLM 集成</h2>
<p>Niko Studio 通过大语言模型提供深度写作分析能力。</p>

<h3>支持的模型</h3>
<ul>
  <li><strong>OpenAI</strong> — GPT-4, GPT-4o</li>
  <li><strong>Anthropic</strong> — Claude Sonnet, Claude Opus</li>
  <li><strong>本地模型</strong> — 通过 Ollama 运行 Llama, Qwen 等</li>
</ul>

<h3>分析流程</h3>
<p>文本通过 Gateway 服务发送到 LLM，结合知识库上下文生成结构化的分析结果。所有分析结果缓存在本地，避免重复调用。</p>
`,

  'plugin-system': `
<h2>插件系统</h2>
<p>通过插件扩展 Niko Studio 的功能。</p>

<h3>插件类型</h3>
<ul>
  <li><strong>分析插件</strong> — 添加自定义分析维度</li>
  <li><strong>导出插件</strong> — 支持更多导出格式</li>
  <li><strong>主题插件</strong> — 自定义编辑器外观</li>
</ul>

<h3>开发插件</h3>
<p>插件使用 TypeScript 开发，遵循标准的插件接口规范。详见 API 参考部分。</p>
`,

  'system-overview': `
<h2>系统架构概览</h2>
<p>Niko Studio 采用前后端分离的桌面应用架构。</p>

<h3>技术栈</h3>
<ul>
  <li><strong>桌面框架</strong> — Tauri 2.x (Rust)</li>
  <li><strong>前端</strong> — React 18 + TypeScript + Vite</li>
  <li><strong>后端服务</strong> — Node.js Gateway + Python 分析引擎</li>
  <li><strong>知识引擎</strong> — TypeScript 实现的知识图谱</li>
  <li><strong>状态管理</strong> — Zustand</li>
  <li><strong>样式</strong> — Tailwind CSS 4</li>
</ul>

<h3>架构层次</h3>
<pre><code>┌─────────────────────────────────────┐
│         Desktop (Tauri Shell)        │
├─────────────────────────────────────┤
│    Frontend (React + TypeScript)     │
├─────────────────────────────────────┤
│   Gateway (Node.js Sidecar)          │
├─────────────────────────────────────┤
│  Knowledge Engine │ Analysis Engine  │
├─────────────────────────────────────┤
│     LLM Providers │ Local Storage    │
└─────────────────────────────────────┘</code></pre>
`,

  'module-design': `
<h2>模块设计</h2>
<p>系统按职责划分为以下核心模块：</p>

<h3>前端模块</h3>
<ul>
  <li><code>components/</code> — UI 组件库</li>
  <li><code>stores/</code> — 状态管理 (Zustand)</li>
  <li><code>services/</code> — API 调用层</li>
  <li><code>hooks/</code> — 自定义 React Hooks</li>
</ul>

<h3>后端模块</h3>
<ul>
  <li><code>knowledge/</code> — 知识引擎（枚举、接口、检测器）</li>
  <li><code>analysis/</code> — 文本分析管道</li>
  <li><code>mcp/</code> — MCP 协议服务端</li>
  <li><code>plugins/</code> — 插件加载和管理</li>
</ul>
`,

  'data-flow': `
<h2>数据流</h2>
<p>描述数据在系统各层之间的流转路径。</p>

<h3>分析请求流程</h3>
<pre><code>用户输入文本
  → 前端 Store 更新
  → API Service 调用
  → Gateway 路由
  → Knowledge Engine 上下文注入
  → LLM Provider 分析
  → 结构化结果返回
  → Store 更新 + 缓存
  → UI 渲染分析面板</code></pre>

<h3>知识检索流程</h3>
<pre><code>分析结果中的技法标签
  → Knowledge Engine 语义匹配
  → 相关知识条目检索
  → 上下文组装
  → 建议生成</code></pre>
`,

  'mcp-endpoints': `
<h2>MCP 端点</h2>
<p>Niko Studio 通过 Model Context Protocol 暴露服务能力。</p>

<h3>可用端点</h3>
<ul>
  <li><code>writing/analyze</code> — 文本写作技法分析</li>
  <li><code>writing/score</code> — 多维度评分</li>
  <li><code>knowledge/search</code> — 知识库语义搜索</li>
  <li><code>knowledge/recommend</code> — 基于上下文的知识推荐</li>
  <li><code>character/profile</code> — 角色画像生成</li>
</ul>
`,

  'gateway-api': `
<h2>Gateway API</h2>
<p>Node.js Gateway 作为 Sidecar 进程运行，提供 HTTP API。</p>

<h3>基础端点</h3>
<pre><code>GET  /health          — 健康检查
POST /api/analyze     — 提交分析任务
GET  /api/analyze/:id — 获取分析结果
POST /api/knowledge   — 知识库查询
GET  /api/config      — 获取配置</code></pre>

<h3>认证</h3>
<p>Gateway 仅监听 localhost，通过进程间通信与 Tauri Shell 交互，无需额外认证。</p>
`,

  'writing-stream': `
<h2>流式写作</h2>
<p>通过流式传输实现实时写作辅助，边写边获得 AI 建议和续写内容。</p>

<h3>工作原理</h3>
<p>流式写作基于 SSE (Server-Sent Events) 协议，将 AI 生成的内容逐 token 推送到前端，实现打字机效果的实时输出。</p>

<h3>使用场景</h3>
<ul>
  <li>AI 续写 — 输入前文，自动生成后续内容</li>
  <li>场景展开 — 给定场景概要，展开为完整描写</li>
  <li>对话生成 — 根据角色设定生成自然对话</li>
</ul>
`,

  // Graph System
  'graph-query': `
<h2>图谱查询</h2>
<p>知识图谱提供结构化的故事元素查询能力。</p>

<h3>查询类型</h3>
<ul>
  <li><strong>角色查询</strong> — 按名称、属性、关系查询角色节点</li>
  <li><strong>关系查询</strong> — 查询角色之间的关联关系</li>
  <li><strong>事件查询</strong> — 查询故事中的关键事件节点</li>
</ul>

<h3>端点</h3>
<pre><code>POST /graph/query
Body: { type: "character"|"relationship"|"event", filters?: {} }
Response: { nodes: GraphNode[], edges: GraphEdge[] }</code></pre>
`,

  'character-relationships': `
<h2>角色关系图谱</h2>
<p>自动从文本中提取角色关系，构建可视化的关系网络。</p>

<h3>关系类型</h3>
<ul>
  <li><strong>亲属</strong> — 家庭、血缘关系</li>
  <li><strong>友谊</strong> — 同盟、伙伴关系</li>
  <li><strong>对抗</strong> — 敌对、竞争关系</li>
  <li><strong>爱情</strong> — 恋爱、婚姻关系</li>
  <li><strong>师徒</strong> — 教学、传承关系</li>
</ul>

<h3>端点</h3>
<pre><code>GET  /graph/characters             — 获取所有角色
POST /graph/character/:id/profile   — 角色画像
POST /graph/character/:id/depth     — 角色深度分析
GET  /graph/relationships           — 角色关系图</code></pre>
`,

  'foreshadow-tracking': `
<h2>伏笔追踪</h2>
<p>追踪文本中埋设的伏笔及其回收情况，确保叙事完整性。</p>

<h3>功能</h3>
<ul>
  <li><strong>伏笔埋设</strong> — 标记文本中的伏笔线索</li>
  <li><strong>回收追踪</strong> — 监控伏笔是否被回收</li>
  <li><strong>统计分析</strong> — 伏笔埋设/回收比率、平均回收距离</li>
  <li><strong>遗漏提醒</strong> — 标记未回收的伏笔</li>
</ul>

<h3>端点</h3>
<pre><code>POST /graph/foreshadow/plant  — 埋设伏笔
GET  /graph/foreshadows       — 查询伏笔列表
GET  /graph/foreshadow/stats  — 伏笔统计</code></pre>
`,

  'character-depth': `
<h2>角色深度分析</h2>
<p>从多个维度评估角色的复杂性和立体感。</p>

<h3>分析维度</h3>
<ul>
  <li><strong>表层特征</strong> — 外貌、职业、背景</li>
  <li><strong>心理层次</strong> — 动机、恐惧、欲望</li>
  <li><strong>矛盾性</strong> — 内在冲突和矛盾特质</li>
  <li><strong>成长空间</strong> — 角色发展潜力</li>
</ul>

<h3>端点</h3>
<pre><code>POST /graph/character/:id/depth
Body: { text: string }
Response: { dimensions: DepthDimension[], overallScore: number }</code></pre>
`,

  // Critic
  'critic-evaluate': `
<h2>批评评估</h2>
<p>多维度文本质量评估系统，模拟文学批评视角。</p>

<h3>评估维度</h3>
<ul>
  <li>叙事技巧 — 视角运用、节奏控制</li>
  <li>语言表达 — 修辞手法、词汇多样性</li>
  <li>结构完整性 — 情节逻辑、因果关系</li>
  <li>角色塑造 — 性格一致性、成长弧线</li>
  <li>情感共鸣 — 读者情感参与度</li>
</ul>

<h3>端点</h3>
<pre><code>POST /critic/evaluate
Body: { text: string, dimensions?: string[] }
Response: { scores: CriticScore[], overall: number, highlights: TextHighlight[] }</code></pre>
`,

  'consistency-check': `
<h2>一致性检查</h2>
<p>自动检测文本中的设定矛盾和情节漏洞。</p>

<h3>检查类型</h3>
<ul>
  <li><strong>设定一致性</strong> — 角色外貌、能力、背景是否前后一致</li>
  <li><strong>时间线一致性</strong> — 事件发生顺序是否合理</li>
  <li><strong>跨章一致性</strong> — 多章节之间的设定连贯性</li>
</ul>

<h3>端点</h3>
<pre><code>POST /critic/consistency         — 单章一致性检查
POST /critic/cross-chapter        — 跨章一致性检查
POST /critic/consistency-cli      — CLI 模式检查</code></pre>
`,

  'style-profile': `
<h2>风格分析</h2>
<p>提取和分析写作风格特征，支持风格迁移。</p>

<h3>风格维度</h3>
<ul>
  <li><strong>句式结构</strong> — 长短句比例、句式变化频率</li>
  <li><strong>词汇选择</strong> — 口语/书面语比例、专业词汇密度</li>
  <li><strong>修辞偏好</strong> — 常用修辞手法和意象</li>
  <li><strong>叙事距离</strong> — 叙述者与故事的距离感</li>
</ul>

<h3>端点</h3>
<pre><code>POST /m10/style/extract  — 提取风格特征
GET  /m10/style/profile   — 获取风格画像
POST /m10/style/apply     — 应用指定风格</code></pre>
`,

  'multi-pass-revision': `
<h2>多轮修订</h2>
<p>自动化多轮文本修订流程，每轮聚焦不同改进维度。</p>

<h3>修订流程</h3>
<pre><code>第 1 轮: 结构审查 — 情节逻辑、场景衔接
第 2 轮: 语言润色 — 用词、句式、节奏
第 3 轮: 风格统一 — 确保整体风格一致
第 4 轮: 细节打磨 — 标点、格式、错别字</code></pre>

<h3>端点</h3>
<pre><code>POST /m10/revise/multi-pass
Body: { text: string, passes: ("structure"|"language"|"style"|"detail")[] }
Response: { revised: string, changes: RevisionChange[] }</code></pre>
`,

  'context-suggestions': `
<h2>上下文建议</h2>
<p>基于已有文本上下文，提供智能写作建议。</p>

<h3>建议类型</h3>
<ul>
  <li><strong>情节推进</strong> — 下一步情节发展建议</li>
  <li><strong>角色行为</strong> — 符合角色性格的行动建议</li>
  <li><strong>场景描写</strong> — 补充环境氛围描写</li>
  <li><strong>对话补充</strong> — 对话内容和建议</li>
</ul>

<h3>端点</h3>
<pre><code>POST /m10/context-suggestions
Body: { text: string, cursor_position: number }
Response: { suggestions: Suggestion[] }</code></pre>
`,

  // Worldview
  'worldview-extract': `
<h2>设定提取</h2>
<p>从文本中自动提取世界观设定，建立结构化的设定库。</p>

<h3>提取类型</h3>
<ul>
  <li><strong>地理设定</strong> — 地点、地形、气候</li>
  <li><strong>历史设定</strong> — 重大事件、年代纪</li>
  <li><strong>规则体系</strong> — 魔法体系、科技水平、社会制度</li>
  <li><strong>文化设定</strong> — 习俗、信仰、语言</li>
</ul>

<h3>端点</h3>
<pre><code>POST /m11/worldview/extract
Body: { text: string }
Response: { settings: WorldviewSetting[] }</code></pre>
`,

  'worldview-manage': `
<h2>设定管理</h2>
<p>查询和维护已提取的世界观设定，确保叙事一致性。</p>

<h3>管理功能</h3>
<ul>
  <li>设定查询 — 按类型和关键词搜索</li>
  <li>设定编辑 — 修改和补充设定内容</li>
  <li>一致性验证 — 检查新文本与已有设定的一致性</li>
</ul>

<h3>端点</h3>
<pre><code>GET /m11/worldview              — 获取所有设定
GET /m11/worldview/:category     — 按类别查询设定</code></pre>
`,

  // Agent
  'agent-route': `
<h2>代理路由</h2>
<p>智能路由系统根据任务类型自动选择最优 AI 代理。</p>

<h3>路由策略</h3>
<ul>
  <li><strong>写作任务</strong> → 写作代理（擅长创意生成）</li>
  <li><strong>分析任务</strong> → 分析代理（擅长结构化评估）</li>
  <li><strong>修订任务</strong> → 修订代理（擅长文本改进）</li>
</ul>

<h3>端点</h3>
<pre><code>POST /agent/route
Body: { task: string, context?: string }
Response: { agent: string, confidence: number }</code></pre>
`,

  'agent-write': `
<h2>AI 写作</h2>
<p>基于上下文的 AI 续写和创作辅助。</p>

<h3>写作模式</h3>
<ul>
  <li><strong>续写</strong> — 延续当前叙事方向</li>
  <li><strong>扩写</strong> — 对概要进行详细展开</li>
  <li><strong>改写</strong> — 用不同风格重写段落</li>
</ul>

<h3>端点</h3>
<pre><code>POST /agent/write
Body: { text: string, mode: "continue"|"expand"|"rewrite", context?: string }
Response: { content: string }</code></pre>
`,

  'agent-revise': `
<h2>AI 修订</h2>
<p>AI 辅助文本修改和润色。</p>

<h3>修订类型</h3>
<ul>
  <li>润色 — 改善语言表达但不改变内容</li>
  <li>精简 — 删除冗余内容</li>
  <li>强化 — 增强情感冲击力</li>
</ul>

<h3>端点</h3>
<pre><code>POST /agent/revise
Body: { text: string, type: "polish"|"condense"|"enhance" }
Response: { revised: string, changes: Change[] }</code></pre>
`,

  'agent-context': `
<h2>上下文管理</h2>
<p>智能组装写作上下文，为 AI 提供准确的背景信息。</p>

<h3>上下文来源</h3>
<ul>
  <li>当前文档的前文内容</li>
  <li>角色设定和关系图谱</li>
  <li>世界观设定</li>
  <li>写作风格画像</li>
</ul>

<h3>端点</h3>
<pre><code>POST /agent/context
Body: { text: string, scope?: "local"|"global" }
Response: { context: string, sources: ContextSource[] }</code></pre>
`,

  'chat-system': `
<h2>对话系统</h2>
<p>通过对话方式与 AI 交互，获取写作辅助。</p>

<h3>对话模式</h3>
<ul>
  <li><strong>普通对话</strong> — 一次性请求/响应</li>
  <li><strong>流式对话</strong> — 实时流式输出 (SSE)</li>
</ul>

<h3>自适应分块</h3>
<p>长文本自动分块处理，确保 LLM 上下文窗口的有效利用。</p>

<h3>端点</h3>
<pre><code>POST /chat              — 普通对话
POST /chat/stream        — 流式对话 (SSE)</code></pre>
`,

  // Memory
  'material-upload': `
<h2>素材上传</h2>
<p>上传参考材料和写作素材，自动提取和索引。</p>

<h3>支持格式</h3>
<ul>
  <li>纯文本 (.txt)</li>
  <li>Markdown (.md)</li>
  <li>PDF 文档</li>
</ul>

<h3>处理流程</h3>
<p>上传后系统自动分块 → 生成嵌入向量 → 存入向量数据库，支持后续语义搜索。</p>

<h3>端点</h3>
<pre><code>POST /memory/upload     — 上传素材文件
POST /memory/add        — 添加文本片段</code></pre>
`,

  'semantic-search': `
<h2>语义搜索</h2>
<p>基于向量嵌入的语义搜索，超越关键词匹配。</p>

<h3>搜索能力</h3>
<ul>
  <li>语义相似度搜索 — 找到语义相关的素材</li>
  <li>混合搜索 — 结合关键词和语义向量</li>
  <li>过滤 — 按标签、时间范围筛选</li>
</ul>

<h3>端点</h3>
<pre><code>POST /memory/search
Body: { query: string, top_k?: number, filters?: {} }
Response: { results: SearchResult[] }</code></pre>
`,

  'temporal-query': `
<h2>时间线查询</h2>
<p>按时间线检索素材和写作历史。</p>

<h3>查询维度</h3>
<ul>
  <li>创建时间 — 按素材上传时间查询</li>
  <li>修改时间 — 按最近修改时间查询</li>
  <li>版本历史 — 追踪内容的修改演变</li>
</ul>

<h3>端点</h3>
<pre><code>POST /memory/temporal
Body: { start: string, end: string, type?: string }
Response: { items: TemporalItem[] }</code></pre>
`,

  // Desktop additions
  'writing-dashboard': `
<h2>写作面板</h2>
<p>WritingDashboard 提供多维度分析结果的可视化面板。</p>

<h3>面板组件</h3>
<ul>
  <li><strong>WritingDashboard</strong> — 主面板容器</li>
  <li><strong>WritingDimensionDetail</strong> — 维度详情展开</li>
  <li><strong>MetricValue</strong> — 评分指标展示</li>
  <li><strong>ProgressBar</strong> — 进度可视化</li>
  <li><strong>TrendChart</strong> — 趋势图表</li>
  <li><strong>IntelligenceBadge</strong> — 智能标签</li>
  <li><strong>AntiPatternWarning</strong> — 反模式警告</li>
  <li><strong>InlineAnnotation</strong> — 行内标注</li>
</ul>
`,

  'skill-system': `
<h2>技能系统</h2>
<p>创建和管理自定义写作技能，支持链式调用。</p>

<h3>技能操作</h3>
<ul>
  <li><strong>列表</strong> — 查看所有可用技能</li>
  <li><strong>加载</strong> — 加载指定技能</li>
  <li><strong>匹配</strong> — 根据意图自动匹配技能</li>
  <li><strong>链式调用</strong> — 组合多个技能顺序执行</li>
  <li><strong>创建/保存/删除</strong> — CRUD 操作</li>
</ul>

<h3>技能格式</h3>
<pre><code>---
name: my-skill
description: 自定义分析技能
tags: [analysis, custom]
triggers: [分析, 评估]
---

技能的 Markdown 正文...</code></pre>
`,

  'wiki-system': `
<h2>Wiki 系统</h2>
<p>管理知识条目和 Wiki 页面，支持知识沉淀。</p>

<h3>功能</h3>
<ul>
  <li><strong>知识晋升</strong> — 将临时知识提升为正式条目</li>
  <li><strong>条目列表</strong> — 浏览所有 Wiki 页面</li>
  <li><strong>页面读取</strong> — 读取指定 Wiki 页面内容</li>
</ul>

<h3>端点</h3>
<pre><code>POST /wiki/promote    — 晋升知识条目
GET  /wiki/list       — 列出所有条目
GET  /wiki/page/:id   — 读取页面内容</code></pre>
`,

  // Sync
  'sync-overview': `
<h2>同步概览</h2>
<p>云同步功能支持多设备间的数据同步。</p>

<h3>同步范围</h3>
<ul>
  <li>项目文件和元数据</li>
  <li>分析结果和缓存</li>
  <li>知识库和设定</li>
  <li>用户配置和偏好</li>
</ul>

<h3>同步策略</h3>
<p>采用增量同步策略，仅传输变更部分，减少数据量和同步时间。</p>
`,

  'push-pull': `
<h2>推送与拉取</h2>
<p>手动控制数据同步方向。</p>

<h3>操作</h3>
<ul>
  <li><strong>推送</strong> — 将本地变更上传到云端</li>
  <li><strong>拉取</strong> — 从云端下载变更到本地</li>
  <li><strong>全量同步</strong> — 完整双向同步</li>
</ul>

<h3>冲突解决</h3>
<p>当检测到冲突时，系统提供三种策略：保留本地、保留远程、手动合并。</p>

<h3>端点</h3>
<pre><code>GET  /sync/status    — 同步状态
POST /sync/push       — 推送变更
POST /sync/pull       — 拉取变更
POST /sync/full       — 全量同步</code></pre>
`,

  // Expanded API pages
  'writing-api': `
<h2>写作 API</h2>
<p>写作辅助和流式写作相关端点。</p>

<h3>端点列表</h3>
<pre><code>POST /writing/novel-quality-check     — 小说质量检查
POST /writing-helper/process           — 写作辅助处理
POST /writing/stream                   — 流式写作 (SSE)
POST /writing-craft/analyze            — 写作技法分析
POST /writing-craft-llm/analyze        — LLM 写作技法分析
GET  /analysis/patterns                — 获取分析模式
GET  /analysis/sessions                — 获取分析会话</code></pre>
`,

  'graph-api': `
<h2>图谱 API</h2>
<p>角色关系和伏笔相关端点。</p>

<h3>端点列表</h3>
<pre><code>POST /graph/query                    — 通用图谱查询
GET  /graph/characters               — 角色列表
POST /graph/character/:id/profile     — 角色画像
POST /graph/character/:id/depth       — 角色深度分析
GET  /graph/relationships             — 角色关系图
GET  /graph/foreshadows               — 伏笔列表
POST /graph/foreshadow/plant          — 埋设伏笔
GET  /graph/foreshadow/stats          — 伏笔统计</code></pre>
`,

  'critic-api': `
<h2>批评 API</h2>
<p>一致性检查和风格分析端点。</p>

<h3>端点列表</h3>
<pre><code>POST /critic/evaluate                — 批评评估
POST /critic/suggestions              — 写作建议
POST /critic/consistency              — 一致性检查
POST /consistency/check               — 通用一致性检查
POST /m10/consistency/cross-chapter   — 跨章一致性
POST /m10/context-suggestions         — 上下文建议
POST /m10/style/extract               — 风格提取
GET  /m10/style/profile               — 风格画像
POST /m10/style/apply                 — 风格应用
POST /m10/revise/multi-pass           — 多轮修订</code></pre>
`,

  'agent-api': `
<h2>Agent API</h2>
<p>AI 代理路由和写作端点。</p>

<h3>端点列表</h3>
<pre><code>POST /agent/route                    — 代理路由
POST /agent/write                     — AI 写作
POST /agent/revise                    — AI 修订
POST /agent/context                   — 上下文管理
POST /chat                            — 普通对话
POST /chat/stream                     — 流式对话</code></pre>
`,

  'memory-api': `
<h2>素材 API</h2>
<p>素材管理和语义搜索端点。</p>

<h3>端点列表</h3>
<pre><code>POST /memory/search                  — 语义搜索
POST /memory/add                      — 添加文本片段
POST /memory/upload                   — 上传素材文件
POST /memory/temporal                  — 时间线查询</code></pre>
`,

  'skill-api': `
<h2>技能 API</h2>
<p>自定义技能 CRUD 和链式调用。</p>

<h3>端点列表</h3>
<pre><code>GET  /skills/list                    — 技能列表
GET  /skills/load/:id                 — 加载技能
POST /skills/match                    — 意图匹配
POST /skills/chain                    — 链式调用
POST /skills/create                   — 创建技能
PUT  /skills/save/:id                 — 保存技能
DELETE /skills/delete/:id             — 删除技能</code></pre>
`,

  'wiki-api': `
<h2>Wiki API</h2>
<p>知识条目管理和查询。</p>

<h3>端点列表</h3>
<pre><code>POST /wiki/promote                   — 晋升知识条目
GET  /wiki/list                       — 列出所有条目
GET  /wiki/page/:id                   — 读取页面内容</code></pre>
`,

  'workflow-api': `
<h2>Workflow API</h2>
<p>工作流编排和调度。</p>

<h3>端点列表</h3>
<pre><code>POST /workflow/route                 — 工作流路由
POST /workflow/plan                   — 工作流规划
POST /workflow/execute                — 工作流执行
POST /workflow/lifecycle              — 生命周期管理
POST /workflow/rollback               — 快速回滚
POST /workflow/scheduler/register     — 注册定时任务
GET  /workflow/scheduler/list         — 定时任务列表
POST /workflow/scheduler/pause/:id    — 暂停任务
POST /workflow/scheduler/resume/:id   — 恢复任务
POST /workflow/scheduler/run-now/:id  — 立即执行
POST /workflow/scheduler/import-plan  — 导入计划
POST /checkpoint/create               — 创建检查点
POST /checkpoint/restore/:id          — 恢复检查点
GET  /checkpoint/list                 — 检查点列表</code></pre>
`,

  'sync-api': `
<h2>同步 API</h2>
<p>云同步推送拉取端点。</p>

<h3>端点列表</h3>
<pre><code>GET  /sync/status                    — 同步状态
POST /sync/push                       — 推送变更
POST /sync/pull                       — 拉取变更
POST /sync/full                       — 全量同步</code></pre>
`,

  'health-api': `
<h2>健康检查 API</h2>
<p>系统健康、指标和模型列表。</p>

<h3>端点列表</h3>
<pre><code>GET  /health                         — 健康检查
GET  /metrics                         — 性能指标
GET  /tools                           — 可用工具列表
GET  /models                          — 可用模型列表</code></pre>
`,

  'config-api': `
<h2>配置 API</h2>
<p>配置读写和密钥管理。</p>

<h3>端点列表</h3>
<pre><code>GET  /config                         — 获取配置
PUT  /config                          — 更新配置
GET  /secrets                         — 获取密钥列表
PUT  /secrets                         — 更新密钥
POST /config/reload                   — 重载配置</code></pre>
`,

  'plugin-api': `
<h2>插件 API</h2>
<p>插件注册和执行。</p>

<h3>端点列表</h3>
<pre><code>GET  /plugins/list                   — 插件列表
POST /plugins/execute                 — 执行插件
POST /plugins/register                — 注册插件</code></pre>
`,

  'workspace-api': `
<h2>Workspace API</h2>
<p>项目工作空间上下文。</p>

<h3>端点列表</h3>
<pre><code>GET  /workspace/context              — 获取工作空间上下文</code></pre>
`,
};

export function getDocContent(pageId: string): string {
  return contentMap[pageId] || '<p>文档内容正在编写中...</p>';
}
