export const architectureContent: Record<string, string> = {
  'system-overview': `
<h2>系统架构概览</h2>
<p>Niko Studio 采用本地优先的桌面架构：Tauri 提供桌面宿主，React 前端承载写作界面，Node.js Gateway 统一暴露分析、素材、配置、Agent 和工作流能力。</p>
<pre><code>flowchart TB
  Writer[写作者] --> Tauri[Tauri Desktop Host]
  Tauri --> UI[React + TypeScript Frontend]
  UI --> Store[Zustand / View State]
  UI --> Gateway[Node.js Gateway]
  Gateway --> Workspace[Workspace Context]
  Gateway --> Knowledge[Knowledge Engine]
  Gateway --> Narrative[Narrative / Critic Engines]
  Gateway --> Agents[Agent Router]
  Gateway --> Providers[LLM Providers]
  Gateway --> Local[(Local Files / SQLite / Cache)]</code></pre>
<h2>技术栈</h2>
<table>
  <thead><tr><th>层级</th><th>技术</th><th>职责</th></tr></thead>
  <tbody>
    <tr><td>桌面宿主</td><td>Tauri 2 / Rust</td><td>窗口、权限边界、桌面交付。</td></tr>
    <tr><td>前端</td><td>React 18 / TypeScript / Vite / Tailwind</td><td>编辑器、面板、导航、交互状态。</td></tr>
    <tr><td>Gateway</td><td>Node.js / TypeScript</td><td>API 聚合、模型接入、工作区上下文。</td></tr>
    <tr><td>智能能力</td><td>Knowledge / Narrative / Critic / Agent</td><td>写作分析、知识检索、修订和路由。</td></tr>
    <tr><td>存储</td><td>本地文件、缓存、SQLite 类索引</td><td>作品、素材、分析结果和配置。</td></tr>
  </tbody>
</table>
<h2>设计原则</h2>
<ul>
  <li><strong>本地优先</strong>：作品文本、素材和缓存围绕本地工作区组织。</li>
  <li><strong>Gateway 统一出口</strong>：前端不直接拼接复杂模型调用，而是通过服务层请求 Gateway。</li>
  <li><strong>写作者视角优先</strong>：技术能力最终落到编辑器、右侧面板、Story Bible 和导出路径。</li>
  <li><strong>可解释分析</strong>：分数必须连接到文本证据、知识规则和可执行建议。</li>
</ul>
  `,
  'module-design': `
<h2>模块设计</h2>
<p>模块边界按用户任务划分，而不是单纯按技术层划分。写作者看到的是“写作、分析、修订、沉淀、导出”；开发者看到的是前端组件、Gateway 路由、知识引擎、Agent 和 API。</p>
<pre><code>flowchart LR
  subgraph Frontend[桌面前端]
    Editor[DocumentEditor / NikoEditor]
    Helper[WritingHelperPanel]
    Chat[ChatArea]
    Bible[StoryBiblePanel / Wiki]
    Dashboard[WritingDashboard]
  end

  subgraph Gateway[本地 Gateway]
    Config[Config]
    Workspace[Workspace Context]
    Memory[Memory]
    Workflow[Workflow]
    Agent[Agent Router]
  end

  subgraph Intelligence[智能模块]
    Craft[Writing Craft]
    Graph[Graph]
    Critic[Critic]
    Knowledge[Knowledge Base]
  end

  Editor --> Helper
  Helper --> Gateway
  Chat --> Agent
  Dashboard --> Craft
  Gateway --> Intelligence
  Bible --> Memory</code></pre>
<h2>前端模块</h2>
<ul>
  <li><code>components/</code> — 编辑器、侧栏、写作助手、分析面板和知识面板。</li>
  <li><code>stores/</code> — 当前文档、项目状态、配置和 UI 选择。</li>
  <li><code>services/</code> / <code>api/</code> — 封装 Gateway 请求，避免组件直接了解接口细节。</li>
</ul>
<h2>Gateway 与智能模块</h2>
<ul>
  <li><strong>Workspace Context</strong>：把当前作品、章节、素材和配置组织成请求上下文。</li>
  <li><strong>Knowledge Engine</strong>：提供写作理论、模式检测和维度解释。</li>
  <li><strong>Critic / Narrative</strong>：负责一致性、结构、角色、场景、对话等分析。</li>
  <li><strong>Agent Router</strong>：根据用户意图选择写作、修订、上下文或工作流能力。</li>
</ul>
<h2>扩展点</h2>
<p>插件、技能、Wiki 和 Workflow 都是扩展点。它们不应绕过工作区和 Gateway 边界，而应复用同一套上下文、配置和健康检查路径。</p>
  `,
  'data-flow': `
<h2>数据流</h2>
<p>数据流从“用户正在写的文本”开始，经过前端状态、Gateway 路由、知识上下文、模型或规则引擎，最后回到可解释的 UI 结果。</p>
<pre><code>sequenceDiagram
  participant U as Writer
  participant E as Editor
  participant S as Frontend Service
  participant G as Gateway
  participant K as Knowledge Engine
  participant M as Model / Rules
  participant D as Dashboard

  U->>E: 输入或选择正文
  E->>S: 触发分析 / 修订 / 对话
  S->>G: 携带 workspace + selection + intent
  G->>K: 检索知识、素材和上下文
  G->>M: 执行规则检测或 LLM 调用
  M-->>G: 返回结构化结果
  G-->>S: 分数、证据、建议、补充上下文
  S-->>D: 渲染维度和证据
  D-->>U: 选择问题并回到正文修订</code></pre>
<h2>结果结构</h2>
<table>
  <thead><tr><th>字段</th><th>用途</th><th>UI 呈现</th></tr></thead>
  <tbody>
    <tr><td>score</td><td>快速判断当前维度强弱</td><td>仪表盘、维度卡片。</td></tr>
    <tr><td>evidence</td><td>连接结论和原文</td><td>引用片段、问题定位。</td></tr>
    <tr><td>suggestion</td><td>给出可执行修订方向</td><td>右侧面板、修订预览。</td></tr>
    <tr><td>context</td><td>说明使用了哪些设定或素材</td><td>Story Bible、Wiki、素材来源。</td></tr>
  </tbody>
</table>
<h2>本地优先的数据边界</h2>
<p>作品正文、素材和缓存默认留在本地工作区。需要模型调用时，由 Gateway 负责整理最小必要上下文并返回结构化结果，前端只消费结果，不直接管理模型协议。</p>
  `,
};
