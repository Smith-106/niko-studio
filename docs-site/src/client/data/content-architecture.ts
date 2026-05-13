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
<h2>运行时边界</h2>
<p>当前运行时权威是 <code>desktop/</code> Tauri host、React 前端和本地 <code>src-ts</code> Node/TypeScript Gateway。前端负责表达用户意图和展示结果；Gateway 负责配置、模型、workspace context、知识检索和结构化响应；历史 Python 或 browser-first 资料只作为迁移参考。</p>
<pre><code>flowchart TB
  subgraph Desktop[当前交付边界：desktop/]
    Host[Tauri Host]
    Frontend[React Frontend]
  end

  subgraph GatewayRuntime[src-ts Node/TypeScript Gateway]
    Api[HTTP / SSE API]
    Context[Workspace Context]
    Intelligence[Knowledge / Narrative / Critic / Agent]
  end

  subgraph LocalAuthority[本地数据权威]
    Manuscript[(Manuscript)]
    Wiki[(Wiki / Canon)]
    Cache[(Memory / Graph Projection)]
  end

  Providers[Model Providers]
  Host --> Frontend
  Frontend --> Api
  Api --> Context
  Context --> Intelligence
  Context --> LocalAuthority
  Intelligence --> Providers</code></pre>
<table>
  <thead><tr><th>边界</th><th>负责内容</th><th>不负责内容</th></tr></thead>
  <tbody>
    <tr><td>Desktop Host</td><td>窗口、权限、交付包装。</td><td>写作分析规则和模型协议。</td></tr>
    <tr><td>React Frontend</td><td>编辑器、导航、面板、用户选择。</td><td>直接保存密钥或绕过 Gateway 调模型。</td></tr>
    <tr><td>Gateway</td><td>API 聚合、配置、模型、workspace context。</td><td>替代作者做 canon 决策。</td></tr>
    <tr><td>Knowledge / Critic</td><td>分析、证据、建议和解释。</td><td>覆盖作者确认的设定。</td></tr>
  </tbody>
</table>
<h2>设计原则</h2>
<ul>
  <li><strong>本地优先</strong>：作品文本、素材和缓存围绕本地工作区组织。</li>
  <li><strong>Gateway 统一出口</strong>：前端不直接拼接复杂模型调用，而是通过服务层请求 Gateway。</li>
  <li><strong>写作者视角优先</strong>：技术能力最终落到编辑器、右侧面板、Story Bible 和导出路径。</li>
  <li><strong>可解释分析</strong>：分数必须连接到文本证据、知识规则和可执行建议。</li>
</ul>
<h2>理解顺序</h2>
<ol>
  <li>先看当前交付边界，确认什么是 runtime authority。</li>
  <li>再看桌面前端、Gateway 和智能模块分别承担什么职责。</li>
  <li>最后跳到 <a href="/architecture/data-flow">数据流</a> 和 <a href="/api/gateway-api">Gateway API</a>，把结构认知连接到真实调用边界。</li>
</ol>
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
<h2>模块依赖顺序</h2>
<pre><code>flowchart TD
  UI[UI Components] --> Services[Frontend Services]
  Services --> Gateway[Gateway Routes]
  Gateway --> Context[Workspace / Config / Memory Context]
  Context --> Engines[Knowledge / Critic / Agent / Graph Engines]
  Engines --> Providers[Rules / LLM Providers]
  Engines --> Storage[Local Files / Cache / Index]</code></pre>
<p>扩展点应接在已有服务层或 Gateway 层之后，而不是让 UI 直接跨层访问底层模块。这样可以保持桌面端、文档站和外部集成的边界一致。</p>
<h2>历史架构边界</h2>
<p>仓库中保留的历史架构、旧 Web entry、Python 兼容路径和迁移文档可以帮助理解演进过程，但不能覆盖当前 README、能力矩阵和发布说明中的运行时权威。新增文档若引用历史设计，必须明确标注 historical 或 design reference。</p>
<table>
  <thead><tr><th>资料类型</th><th>当前定位</th><th>使用规则</th></tr></thead>
  <tbody>
    <tr><td><code>desktop/</code> + <code>src-ts/</code></td><td>Supported runtime</td><td>作为当前实现和文档叙述的默认依据。</td></tr>
    <tr><td>Python launcher / legacy <code>src/mcp/**</code></td><td>Compatibility / advisory</td><td>只有 README 或能力矩阵明确说明时才写成当前能力。</td></tr>
    <tr><td>Browser-first Web entry</td><td>Deprecated surface</td><td>已从当前发布面移除，只能作为历史迁移背景。</td></tr>
    <tr><td>旧 roadmap / migration 文档</td><td>Design reference</td><td>用于解释演进，不作为 release readiness 证据。</td></tr>
  </tbody>
</table>
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
<h2>请求生命周期</h2>
<p>一次写作请求通常从 selection 和 intent 开始，Gateway 会补齐 workspace、素材、Wiki 和配置，再调用规则引擎或 LLM，并把结果规范化为 UI 可消费的结构。同步请求返回 JSON；<code>/chat/stream</code> 和 <code>/writing/stream</code> 使用 Server-Sent Events 逐步返回内容。</p>
<table>
  <thead><tr><th>阶段</th><th>输入</th><th>输出</th></tr></thead>
  <tbody>
    <tr><td>Intent capture</td><td>正文、selection、面板模式或 chat message。</td><td>标准化的用户意图。</td></tr>
    <tr><td>Context assembly</td><td>workspace、document、Wiki、memory search。</td><td>最小必要上下文。</td></tr>
    <tr><td>Execution</td><td>规则、Critic、Agent、LLM provider。</td><td>分析、草稿、建议或 workflow step。</td></tr>
    <tr><td>Normalization</td><td>模型输出和规则结果。</td><td>score、evidence、suggestion、metadata。</td></tr>
    <tr><td>UI feedback</td><td>结构化结果或 SSE chunk。</td><td>面板渲染、引用定位、可选修订。</td></tr>
  </tbody>
</table>
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
<h2>数据权威顺序</h2>
<p>数据权威按“作者确认事实优先、派生投影靠后”的顺序解释。Graph、memory 和 chat answers 可以提升检索与创作效率，但不能自动覆盖 manuscript、作者决策或 curated Wiki / Canon。</p>
<table>
  <thead><tr><th>层级</th><th>权威性</th><th>说明</th></tr></thead>
  <tbody>
    <tr><td>Raw evidence / 作者明确决策</td><td>最高</td><td>原文、素材和作者确认事实是最终依据。</td></tr>
    <tr><td>Wiki / Canon 页面</td><td>高</td><td>经过晋升的长期设定，优先于临时聊天结论。</td></tr>
    <tr><td>Writer-facing surfaces</td><td>中</td><td>Story Bible、面板摘要和建议用于辅助判断。</td></tr>
    <tr><td>Graph / Memory projection</td><td>派生</td><td>用于发现关系和召回素材，不覆盖 canon。</td></tr>
    <tr><td>Unpromoted chat answers</td><td>临时</td><td>只能作为草稿建议，不能自动成为设定。</td></tr>
  </tbody>
</table>
<h2>本地优先的数据边界</h2>
<p>作品正文、素材和缓存默认留在本地工作区。需要模型调用时，由 Gateway 负责整理最小必要上下文并返回结构化结果，前端只消费结果，不直接管理模型协议。</p>
<h2>继续阅读</h2>
<ul>
  <li><a href="/guides/request-lifecycle">请求生命周期</a>：用更贴近用户任务的视角重看同一条链路。</li>
  <li><a href="/api/health-api">健康检查</a>：定位是 Gateway、模型还是上下文层出了问题。</li>
  <li><a href="/desktop/writing-dashboard">写作面板</a>：查看这条数据流最终如何落到作者可见 UI。</li>
</ul>
  `,
};
