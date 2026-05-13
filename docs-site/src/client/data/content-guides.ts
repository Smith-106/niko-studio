export const guidesContent: Record<string, string> = {
  'capability-routing': `
<h2>能力路由是什么</h2>
<p>能力路由把写作者的自然意图转换为 Niko Studio 中可执行的产品能力。它先识别任务目标，再选择合适的 UI 入口、Gateway API、上下文来源和后续文档，避免用户在 Writing、Critic、Graph、Memory、Wiki、Agent、Workflow 之间反复试错。</p>
<p>这不是内部 Maestro 角色路由，而是面向写作者和开发者的能力选择指南：写作者优先看到入口和结果，开发者可以继续追踪到 API 与模块边界。</p>

<h2>路由流程</h2>
<pre><code>flowchart TD
  Intent[用户意图] --> Classify{任务类型}
  Classify -->|创作或改写| Writing[Writing / Agent]
  Classify -->|检查质量| Critic[Critic]
  Classify -->|查询设定| Wiki[Wiki / Memory]
  Classify -->|发现关系| Graph[Graph]
  Classify -->|重复流程| Workflow[Workflow / Skill]
  Classify -->|不确定| Default[默认路径]
  Writing --> Result[可解释结果]
  Critic --> Result
  Wiki --> Result
  Graph --> Result
  Workflow --> Result
  Default --> Result</code></pre>
<ol>
  <li>从用户描述中提取 intent、当前 selection、workspace 和期望输出。</li>
  <li>先判断任务是生成、分析、检索、沉淀、自动化，还是排查故障。</li>
  <li>选择主要能力，并按需补充 Memory、Wiki、Graph 或 Knowledge 作为上下文。</li>
  <li>通过 UI 面板或 API 入口执行，结果返回证据、建议、状态和下一步链接。</li>
</ol>

<h2>意图到能力映射</h2>
<table>
  <thead><tr><th>用户意图</th><th>推荐能力</th><th>UI 入口</th><th>API / 文档</th></tr></thead>
  <tbody>
    <tr><td>改进一个场景的节奏和张力</td><td>Writing + Critic</td><td>写作面板、WritingDashboard</td><td>writing-api、critic-api、scene-quality</td></tr>
    <tr><td>检查角色行为是否前后一致</td><td>Wiki + Graph + Critic</td><td>Story Bible、图谱面板</td><td>wiki-api、graph-api、consistency-check</td></tr>
    <tr><td>基于当前章节续写</td><td>Agent + Memory</td><td>Chat、编辑器续写</td><td>agent-api、memory-api、agent-write</td></tr>
    <tr><td>分析叙事结构是否清晰</td><td>Writing + Knowledge</td><td>写作分析面板</td><td>craft-analysis、narrative-structure、knowledge-base</td></tr>
    <tr><td>追踪伏笔是否完成回收</td><td>Graph + Wiki</td><td>伏笔追踪、Story Bible</td><td>graph-api、foreshadow-tracking、wiki-api</td></tr>
    <tr><td>把临时设定沉淀为长期资料</td><td>Wiki + Memory</td><td>Wiki 页面、素材管理</td><td>wiki-system、wiki-api、material-upload</td></tr>
    <tr><td>复用一套固定的审稿流程</td><td>Workflow + Skill</td><td>技能系统、工作流入口</td><td>workflow-api、skill-api、skill-system</td></tr>
    <tr><td>排查模型、配置或服务不可用</td><td>Config + Health</td><td>设置页、状态检查</td><td>config-api、health-api、gateway-api</td></tr>
  </tbody>
</table>

<h2>默认路径</h2>
<p>当用户不确定该用哪个功能时，默认从 <strong>Agent 对话</strong> 或 <strong>写作面板</strong> 开始。Agent 负责澄清意图并补齐上下文；写作面板适合对当前 selection 做快速分析。若任务涉及长期事实、人物关系或素材证据，再补充 Wiki、Graph 和 Memory。</p>
<ul>
  <li>只想生成或改写文字：优先 Writing / Agent。</li>
  <li>想知道哪里有问题：优先 Critic / WritingDashboard。</li>
  <li>想查设定和人物关系：优先 Wiki / Graph。</li>
  <li>想把重复步骤自动化：优先 Workflow / Skill。</li>
</ul>

<h2>故障排查</h2>
<table>
  <thead><tr><th>现象</th><th>可能原因</th><th>处理方式</th></tr></thead>
  <tbody>
    <tr><td>无法判断用户意图</td><td>请求过短或同时包含多个目标</td><td>先要求用户选择生成、分析、检索或自动化，再进入默认路径。</td></tr>
    <tr><td>模型不可用</td><td>LLM provider 未配置或本地 Gateway 无法读取模型列表</td><td>检查 config-api 与 health-api，确认 <code>GET /models</code> 有返回。</td></tr>
    <tr><td>缺少 workspace</td><td>当前项目未打开或上下文无法组装</td><td>打开项目工作区后重试，必要时检查 workspace-api。</td></tr>
    <tr><td>上下文过期</td><td>Wiki、Memory 或 Graph 索引落后于正文</td><td>刷新素材、重新查询 Wiki 页面，避免用旧缓存覆盖作者确认的 canon。</td></tr>
  </tbody>
</table>
  `,
  'learning-paths': `
<h2>学习路径怎么使用</h2>
<p>学习路径把文档站的页面按角色目标重新排序。你可以先按自己的身份走完整条路径，再回到分类导航查细节；每一步都指向已有页面或计划中的维护文档，避免复制 canonical content。</p>

<h2>写作者路径</h2>
<ol>
  <li><a href="/getting-started/installation">安装指南</a>：确认桌面应用、Gateway 和本地运行环境。</li>
  <li><a href="/getting-started/quickstart">快速上手</a>：完成第一次创建作品、输入正文和触发分析。</li>
  <li><a href="/guides/chapter-revision-playbook">章节修订专题路径</a>：如果你已经有一章草稿，直接按专题路径进入问题定位与修订闭环。</li>
  <li><a href="/desktop/writing-dashboard">写作面板</a>：理解分析结果、建议和证据如何回到创作流程。</li>
  <li><a href="/writing/craft-analysis">写作技法分析</a>：查看节奏、张力、视角和叙事技法维度。</li>
  <li><a href="/desktop/wiki-system">Wiki 系统</a>：把角色、设定和作者确认的事实沉淀为长期资料。</li>
</ol>

<h2>开发者路径</h2>
<ol>
  <li><a href="/architecture/system-overview">系统概览</a>：先理解 desktop、Gateway、src-ts 和文档站边界。</li>
  <li><a href="/architecture/data-flow">数据流</a>：追踪文本、上下文、LLM 请求和结果持久化路径。</li>
  <li><a href="/api/gateway-api">Gateway API</a>：了解本地服务入口、错误形态和运行时职责。</li>
  <li><a href="/api/workspace-api">Workspace API</a>：查看项目上下文如何绑定到具体工作区。</li>
  <li><a href="/api/health-api">健康检查</a>：排查模型、配置和服务状态。</li>
</ol>

<h2>集成者路径</h2>
<ol>
  <li><a href="/api/gateway-api">Gateway API</a>：确认外部调用应接入的稳定边界。</li>
  <li><a href="/api/agent-api">Agent API</a>：理解对话、续写和上下文组装接口。</li>
  <li><a href="/api/workflow-api">Workflow API</a>：把重复审稿、分析或沉淀流程编排为自动化任务。</li>
  <li><a href="/api/skill-api">技能 API</a>：管理可复用技能和链式调用。</li>
  <li><a href="/api/config-api">配置 API</a>：处理 provider、密钥和运行时配置。</li>
</ol>

<h2>维护者路径</h2>
<ol>
  <li><a href="/guides/capability-status">能力状态矩阵</a>：先确认 supported、partial、experimental、historical 和 roadmap 的声明边界。</li>
  <li><a href="/guides/capability-routing">能力路由指南</a>：检查用户意图到能力入口的映射是否仍准确。</li>
  <li><a href="/architecture/module-design">模块设计</a>：定位能力所属模块和变更影响范围。</li>
  <li><a href="/api/health-api">健康检查</a>：验证发布、运行时和模型列表信号。</li>
  <li><a href="/api/config-api">配置 API</a>：核对配置变更是否影响用户可见能力。</li>
</ol>
  `,
  'capability-status': `
<h2>状态标签</h2>
<p>能力状态页面把文档站声明和 <code>docs/CAPABILITY_MATRIX.md</code> 对齐，避免把实验、历史或计划能力写成已交付功能。状态变化应先更新能力矩阵，再同步相关页面。</p>
<table>
  <thead><tr><th>Label</th><th>含义</th><th>使用边界</th></tr></thead>
  <tbody>
    <tr><td>supported</td><td>当前支持的主路径，适合写入默认教程和推荐路径。</td><td>需要有代码、文档或 release-check 证据支撑。</td></tr>
    <tr><td>partial</td><td>功能可用但存在已知限制，例如需要手动操作或环境依赖。</td><td>必须同时写明限制，不可作为无条件承诺。</td></tr>
    <tr><td>experimental</td><td>实验能力，可能 behind a flag，生产运行时可能被强制关闭。</td><td>只放在高级说明或集成风险提示中。</td></tr>
    <tr><td>historical</td><td>仅为迁移、参考或历史记录保留，不属于当前 shipped surface。</td><td>不得作为新用户入口推荐。</td></tr>
    <tr><td>roadmap</td><td>计划或待补齐内容，当前文档站可预留链接但不能承诺可用。</td><td>需要绑定后续任务或维护说明。</td></tr>
  </tbody>
</table>

<h2>文档站覆盖矩阵</h2>
<table>
  <thead><tr><th>分类</th><th>Status</th><th>说明</th><th>相关页面</th></tr></thead>
  <tbody>
    <tr><td>快速开始</td><td>supported</td><td>面向桌面应用主路径的安装、配置和第一次使用。</td><td><a href="/getting-started/quickstart">快速上手</a></td></tr>
    <tr><td>指南</td><td>supported</td><td>能力路由、学习路径和状态矩阵作为阅读入口。</td><td><a href="/guides/capability-routing">能力路由指南</a></td></tr>
    <tr><td>写作智能</td><td>supported</td><td>写作技法、结构、角色、场景和对话分析是作者核心能力。</td><td><a href="/writing/craft-analysis">写作技法分析</a></td></tr>
    <tr><td>图谱系统</td><td>partial</td><td>角色关系、伏笔和深度分析有文档入口，但具体数据质量依赖 workspace 内容。</td><td><a href="/graph/character-relationships">角色关系</a></td></tr>
    <tr><td>写作批评</td><td>supported</td><td>评估、一致性、风格和修订流程属于当前作者工作流。</td><td><a href="/critic/critic-evaluate">批评评估</a></td></tr>
    <tr><td>世界观管理</td><td>partial</td><td>设定提取和管理可用，准确性依赖输入文本和作者确认。</td><td><a href="/worldview/worldview-extract">设定提取</a></td></tr>
    <tr><td>AI Agent</td><td>supported</td><td>对话、写作、修订和上下文管理是 Gateway + UI 的主路径。</td><td><a href="/agent/chat-system">对话系统</a></td></tr>
    <tr><td>知识引擎</td><td>supported</td><td>知识库、模式检测和维度评分支撑分析解释。</td><td><a href="/knowledge/knowledge-base">知识库</a></td></tr>
    <tr><td>素材管理</td><td>supported</td><td>素材上传、语义搜索和时间线查询属于单 workspace 能力。</td><td><a href="/memory/semantic-search">语义搜索</a></td></tr>
    <tr><td>桌面应用</td><td>supported</td><td>Tauri 桌面主机、编辑器集成、本地存储和技能入口是当前 runtime。</td><td><a href="/desktop/editor-integration">编辑器集成</a></td></tr>
    <tr><td>云同步</td><td>roadmap</td><td>文档站保留同步概览和推拉页面，实际可用范围需随发布证据更新。</td><td><a href="/sync/sync-overview">同步概览</a></td></tr>
    <tr><td>架构设计</td><td>supported</td><td>系统概览、模块设计和数据流用于解释当前实现边界。</td><td><a href="/architecture/system-overview">系统概览</a></td></tr>
    <tr><td>API 参考</td><td>partial</td><td>Gateway、Agent、Workflow、Skill 等 API 有文档入口，但集成者应结合健康检查验证当前 runtime。</td><td><a href="/api/gateway-api">Gateway API</a></td></tr>
    <tr><td>实验集成适配器</td><td>experimental</td><td>postgres-shadow、redis-cache-rate-limit、elasticsearch-search 等由 capability matrix 标记为实验。</td><td><a href="/api/plugin-api">插件 API</a></td></tr>
    <tr><td>历史参考页面</td><td>historical</td><td>旧 Web entry、迁移材料和历史设计文档只作为参考，不是当前产品入口。</td><td><a href="/architecture/system-overview">系统概览</a></td></tr>
  </tbody>
</table>

<h2>维护规则</h2>
<ol>
  <li>能力发生变化时，先更新 <code>docs/CAPABILITY_MATRIX.md</code>。</li>
  <li>只有 status label 或用户可见 contract 改变时，才同步调整指南、README 或发布说明。</li>
  <li>如果某行降级为 historical，应从学习路径和首页推荐中移除。</li>
  <li>如果某行仍是 roadmap，不要在 API 页面写成已支持能力。</li>
</ol>
  `,
  'request-lifecycle': `
<h2>为什么要看请求生命周期</h2>
<p>如果能力路由告诉你“该去哪”，请求生命周期则解释“系统内部到底发生了什么”。它把用户输入、UI 状态、Gateway 路由、知识上下文、LLM 调用和结果回流串成一条可验证的链，方便写作者理解延迟来源，也方便开发者定位故障边界。</p>

<h2>端到端流程图</h2>
<pre><code>flowchart LR
  User[用户输入或选择文本] --> UI[Desktop UI]
  UI --> Service[前端 Service 层]
  Service --> Gateway[Node.js Gateway]
  Gateway --> Intent{能力判断}
  Intent --> Writing[Writing / Critic]
  Intent --> Agent[Agent Router]
  Intent --> Memory[Memory / Wiki / Graph]
  Writing --> Context[Workspace Context]
  Agent --> Context
  Memory --> Context
  Context --> Provider[Model / Rule Engine]
  Provider --> Result[结构化结果]
  Result --> View[WritingDashboard / Chat / Story Bible]
  View --> User</code></pre>

<h2>五个关键阶段</h2>
<ol>
  <li><strong>捕获意图</strong>：前端把用户点击、选中文本、当前项目和面板操作组装为请求。</li>
  <li><strong>选择能力</strong>：Gateway 决定这次请求更像写作、批评、图谱、知识检索还是 Agent 工作。</li>
  <li><strong>补足上下文</strong>：从 workspace、Wiki、Memory、Graph 或配置读取必要信息，避免只凭单段文本分析。</li>
  <li><strong>执行分析</strong>：调用规则引擎、知识库或模型，得到分数、证据、建议、文本或状态。</li>
  <li><strong>返回结果</strong>：前端把结构化结果渲染为卡片、表格、SSE 流或 Wiki 更新入口。</li>
</ol>

<h2>按角色理解这条链路</h2>
<table>
  <thead><tr><th>角色</th><th>最关心的节点</th><th>应优先阅读</th></tr></thead>
  <tbody>
    <tr><td>写作者</td><td>为什么会得到这个建议，能否回到正文继续写。</td><td>quickstart、writing-dashboard、craft-analysis</td></tr>
    <tr><td>开发者</td><td>UI 是否正确表达意图，Gateway 是否返回稳定结构。</td><td>system-overview、data-flow、gateway-api</td></tr>
    <tr><td>集成者</td><td>调用边界在哪，哪些端点代表稳定入口。</td><td>gateway-api、agent-api、workflow-api</td></tr>
    <tr><td>维护者</td><td>哪一层负责失败恢复，哪些状态可以对外声明。</td><td>capability-status、health-api、config-api</td></tr>
  </tbody>
</table>

<h2>常见断点</h2>
<table>
  <thead><tr><th>断点位置</th><th>表象</th><th>优先检查</th></tr></thead>
  <tbody>
    <tr><td>UI → Service</td><td>按钮有响应但无结果</td><td>前端请求参数、selection 是否为空、workspace 是否缺失。</td></tr>
    <tr><td>Service → Gateway</td><td>请求超时或 5xx</td><td><code>GET /health</code>、Gateway 进程、端口占用。</td></tr>
    <tr><td>Gateway → Context</td><td>结果泛化、缺少项目事实</td><td>workspace-api、memory-api、wiki-api 的上下文组装。</td></tr>
    <tr><td>Context → Provider</td><td>模型不可用或结果波动大</td><td>config-api、health-api、模型列表和 provider 配置。</td></tr>
    <tr><td>Result → UI</td><td>接口有数据但面板不完整</td><td>WritingDashboard、Chat、Doc 渲染组件的字段映射。</td></tr>
  </tbody>
</table>
  `,
  'doc-conventions': `
<h2>这套文档如何组织</h2>
<p>文档站不是纯 API 手册，而是一个带信息架构的产品知识入口。页面默认遵循统一结构：先说明用途，再给结构图或流程图，然后列出边界、状态、排障和继续阅读。这样既方便写作者快速理解，也方便开发者追踪到实现边界。</p>

<h2>页面结构约定</h2>
<table>
  <thead><tr><th>结构块</th><th>作用</th><th>阅读建议</th></tr></thead>
  <tbody>
    <tr><td>概述</td><td>先回答“这个能力是做什么的”。</td><td>第一次进入某分类时优先看。</td></tr>
    <tr><td>结构图 / 流程图</td><td>把组件关系或调用顺序可视化。</td><td>遇到复杂模块时先看图，再读正文。</td></tr>
    <tr><td>边界表</td><td>说明负责什么、不负责什么。</td><td>避免把实验功能误判为稳定能力。</td></tr>
    <tr><td>状态矩阵</td><td>声明 supported、partial、experimental 等状态。</td><td>做交付判断前必须核对。</td></tr>
    <tr><td>继续阅读</td><td>把相邻页面串成学习路径。</td><td>需要系统理解时顺着读。</td></tr>
  </tbody>
</table>

<h2>图示约定</h2>
<ul>
  <li>文档中的流程图以 Mermaid 代码块保存，便于复制到外部工具继续编辑。</li>
  <li>若图示描述当前运行时，必须以 <code>desktop/</code> 和 <code>src-ts/</code> 为默认权威。</li>
  <li>若图示描述历史方案，应明确写为 historical、legacy 或 design reference。</li>
</ul>

<h2>状态标签约定</h2>
<p>页面中出现的状态标签遵循同一套语义，不单独发明新口径。</p>
<table>
  <thead><tr><th>标签</th><th>含义</th><th>是否可作为当前能力声明</th></tr></thead>
  <tbody>
    <tr><td>Supported</td><td>当前运行时已实现且有文档依据。</td><td>可以。</td></tr>
    <tr><td>Partial</td><td>只覆盖部分场景，或 UI / 后端链路尚未完全闭环。</td><td>可以，但要写清缺口。</td></tr>
    <tr><td>Experimental</td><td>仍在验证、接口可能变化。</td><td>可以，但不能当成交付承诺。</td></tr>
    <tr><td>Historical</td><td>历史实现、兼容路径或迁移背景。</td><td>不可以。</td></tr>
    <tr><td>Roadmap</td><td>计划中或设计中，尚无当前实现。</td><td>不可以。</td></tr>
  </tbody>
</table>

<h2>交叉链接约定</h2>
<ol>
  <li>面向写作者的页面，至少应指回一个 UI 页面和一个原理页面。</li>
  <li>面向开发者的页面，至少应指回一个架构页和一个 API 页。</li>
  <li>面向维护者的页面，至少应提供状态矩阵或健康检查链接。</li>
</ol>
  `,
  'chapter-revision-playbook': `
<h2>这个专题路径解决什么问题</h2>
<p>很多作者并不是不知道单个功能怎么用，而是不知道“先看哪里，再改哪里，最后怎么验证”。这个专题把“发现问题 -> 定位原因 -> 修订 -> 复检 -> 沉淀设定”串成一条跨页路径，适合拿一章真实稿子照着走。</p>

<h2>主路径总览</h2>
<pre><code>flowchart LR
  Detect[发现问题] --> Diagnose[定位原因]
  Diagnose --> Revise[选择修订动作]
  Revise --> Verify[重新验证]
  Verify --> Promote[沉淀设定 / 经验]</code></pre>

<h2>专题步骤</h2>
<ol>
  <li><a href="/critic/critic-evaluate">批评评估</a>：先确认“不好”的感觉到底落在哪个维度。</li>
  <li><a href="/writing/craft-analysis">写作技法分析</a>：把问题进一步细化为节奏、张力、视角或语言层。</li>
  <li><a href="/critic/consistency-check">一致性检查</a>：如果怀疑是设定或跨章问题，切到一致性链路。</li>
  <li><a href="/writing/scene-quality">场景质量</a> 或 <a href="/writing/dialogue-analysis">对话分析</a>：针对局部场景或对白做精修。</li>
  <li><a href="/critic/multi-pass-revision">多轮修订</a>：需要系统改整章时，把结构、语言、风格拆开处理。</li>
  <li><a href="/desktop/wiki-system">Wiki 系统</a> / <a href="/worldview/worldview-manage">设定管理</a>：把这次修订确认下来的角色事实或世界观规则沉淀下来。</li>
</ol>

<h2>案例 A：章节开头不抓人</h2>
<table>
  <thead><tr><th>步骤</th><th>推荐页面</th><th>为什么</th></tr></thead>
  <tbody>
    <tr><td>1</td><td>critic-evaluate</td><td>先确认问题是节奏、情绪还是结构。</td></tr>
    <tr><td>2</td><td>craft-analysis</td><td>看低分是否集中在节奏与张力。</td></tr>
    <tr><td>3</td><td>scene-quality</td><td>检查场景目标、冲突和变化是否不足。</td></tr>
    <tr><td>4</td><td>multi-pass-revision</td><td>先做结构轮，再做语言轮。</td></tr>
  </tbody>
</table>

<h2>案例 B：角色说话越来越不像自己</h2>
<table>
  <thead><tr><th>步骤</th><th>推荐页面</th><th>为什么</th></tr></thead>
  <tbody>
    <tr><td>1</td><td>dialogue-analysis</td><td>看区分度和自然度是否下降。</td></tr>
    <tr><td>2</td><td>character-profile</td><td>检查角色辨识度和矛盾性是否不够清晰。</td></tr>
    <tr><td>3</td><td>style-profile</td><td>确认是不是整体风格漂移带来的影响。</td></tr>
    <tr><td>4</td><td>wiki-system</td><td>把角色声线和行为边界沉淀成长期事实。</td></tr>
  </tbody>
</table>

<h2>案例 C：设定越来越乱</h2>
<table>
  <thead><tr><th>步骤</th><th>推荐页面</th><th>为什么</th></tr></thead>
  <tbody>
    <tr><td>1</td><td>consistency-check</td><td>先查出具体冲突点。</td></tr>
    <tr><td>2</td><td>worldview-extract</td><td>把散落在正文里的设定候选抽出来。</td></tr>
    <tr><td>3</td><td>worldview-manage</td><td>按类别统一管理和修正。</td></tr>
    <tr><td>4</td><td>wiki-api / wiki-system</td><td>把确认后的长期设定晋升到权威层。</td></tr>
  </tbody>
</table>

<h2>配套输入模板</h2>
<pre><code>目标：这一章开头不够抓人，想先定位问题再修
当前文本：粘贴 400-800 字片段
怀疑问题：节奏慢 / 冲突弱 / 对白平
项目约束：主角仍需保持克制，不提前揭示真相</code></pre>

<h2>如何判断这轮修订结束</h2>
<ul>
  <li>低分维度不再集中爆红。</li>
  <li>证据片段不再反复命中同一类问题。</li>
  <li>如果修订中引入了新设定，已经同步到 Wiki 或世界观管理。</li>
  <li>你能用一句话说清“这一章现在比之前好在哪里”。</li>
</ul>
  `,
  'common-writing-problems': `
<h2>怎么使用这个索引</h2>
<p>如果你不是从“功能”出发，而是从“稿子出问题了”出发，这页比分类导航更快。它按常见写作问题组织入口，直接告诉你先去哪里看、接着去哪修。</p>

<h2>问题索引</h2>
<table>
  <thead><tr><th>问题</th><th>先看</th><th>再看</th><th>最后收口</th></tr></thead>
  <tbody>
    <tr><td>开头弱</td><td><a href="/critic/critic-evaluate">批评评估</a></td><td><a href="/writing/craft-analysis">写作技法分析</a>、<a href="/writing/scene-quality">场景质量</a></td><td><a href="/critic/multi-pass-revision">多轮修订</a></td></tr>
    <tr><td>对白平</td><td><a href="/writing/dialogue-analysis">对话分析</a></td><td><a href="/writing/character-profile">角色画像</a>、<a href="/critic/style-profile">风格分析</a></td><td><a href="/desktop/wiki-system">Wiki 系统</a></td></tr>
    <tr><td>设定乱</td><td><a href="/critic/consistency-check">一致性检查</a></td><td><a href="/worldview/worldview-extract">设定提取</a>、<a href="/worldview/worldview-manage">设定管理</a></td><td><a href="/api/wiki-api">Wiki API</a></td></tr>
    <tr><td>节奏塌</td><td><a href="/writing/craft-analysis">写作技法分析</a></td><td><a href="/writing/narrative-structure">叙事结构</a>、<a href="/writing/scene-quality">场景质量</a></td><td><a href="/critic/multi-pass-revision">多轮修订</a></td></tr>
    <tr><td>伏笔丢</td><td><a href="/graph/foreshadow-tracking">伏笔追踪</a></td><td><a href="/graph/graph-query">图谱查询</a>、<a href="/critic/consistency-check">一致性检查</a></td><td><a href="/desktop/wiki-system">Wiki 系统</a></td></tr>
  </tbody>
</table>

<h2>常用专题入口</h2>
<ul>
  <li><a href="/guides/chapter-revision-playbook">章节修订专题路径</a>：适合整章系统修订。</li>
  <li><a href="/guides/capability-routing">能力路由指南</a>：适合还不确定该走哪个模块时查看。</li>
  <li><a href="/guides/request-lifecycle">请求生命周期</a>：适合排查“为什么结果不对”。</li>
</ul>

<h2>问题驱动输入模板</h2>
<pre><code>问题类型：开头弱 / 对白平 / 设定乱 / 节奏塌 / 伏笔丢
当前片段：粘贴 200-800 字
项目约束：角色、设定、风格或禁止项
目标：先定位，再给修订方向</code></pre>
  `,
  'outline-to-final-manuscript': `
<h2>这条长链路适合谁</h2>
<p>如果“章节修订专题”解决的是一章怎么修，这页解决的是一本书怎么从大纲一路走到可交付稿。它不是单点功能说明，而是把规划、草稿、分析、修订、设定沉淀和最终收口串成完整流程。</p>

<h2>总流程图</h2>
<pre><code>flowchart LR
  Outline[大纲 / 结构规划] --> Draft[章节草稿]
  Draft --> Analyze[问题分析]
  Analyze --> Revise[多轮修订]
  Revise --> Canon[设定沉淀]
  Canon --> Verify[一致性与风格复检]
  Verify --> Final[完稿 / 导出]</code></pre>

<h2>阶段 1：规划大纲</h2>
<ul>
  <li><a href="/writing/narrative-structure">叙事结构</a>：确认主线结构和关键转折。</li>
  <li><a href="/api/workflow-api">Workflow API</a>：如果你想把“大纲检查 -> 章节拆解”流程自动化，可以从这里入手。</li>
</ul>

<h2>阶段 2：写出章节草稿</h2>
<ul>
  <li><a href="/writing/writing-stream">流式写作</a>：适合快速拉出草稿。</li>
  <li><a href="/agent/agent-write">AI 写作</a>：适合在有明确目标时续写、扩写或改写。</li>
  <li><a href="/desktop/editor-integration">编辑器集成</a>：把草稿、选择和修订都放在统一工作台里完成。</li>
</ul>

<h2>阶段 3：发现问题</h2>
<ul>
  <li><a href="/critic/critic-evaluate">批评评估</a>：先找出“哪里不行”。</li>
  <li><a href="/writing/craft-analysis">写作技法分析</a>：细化节奏、张力、视角和语言层的问题。</li>
  <li><a href="/guides/common-writing-problems">常见写作问题索引</a>：如果你已经知道问题类型，直接从这里跳。</li>
</ul>

<h2>阶段 4：多轮修订</h2>
<ul>
  <li><a href="/critic/multi-pass-revision">多轮修订</a>：先结构，后语言，再风格和细节。</li>
  <li><a href="/writing/scene-quality">场景质量</a>、<a href="/writing/dialogue-analysis">对话分析</a>：修局部问题。</li>
  <li><a href="/agent/agent-revise">AI 修订</a>：用于边界清晰的小范围改动。</li>
</ul>

<h2>阶段 5：沉淀设定与知识</h2>
<ul>
  <li><a href="/worldview/worldview-extract">设定提取</a>、<a href="/worldview/worldview-manage">设定管理</a>：把世界观从正文中捞出来并统一维护。</li>
  <li><a href="/desktop/wiki-system">Wiki 系统</a>、<a href="/api/wiki-api">Wiki API</a>：把确认后的角色事实和规则晋升到长期权威层。</li>
  <li><a href="/memory/material-upload">素材上传</a>、<a href="/memory/semantic-search">语义搜索</a>：让后续写作和 Agent 能用到项目证据。</li>
</ul>

<h2>阶段 6：一致性与风格复检</h2>
<ul>
  <li><a href="/critic/consistency-check">一致性检查</a>：防止设定漂移和跨章漏洞。</li>
  <li><a href="/critic/style-profile">风格分析</a>：确认完稿前后的风格没有散掉。</li>
  <li><a href="/graph/foreshadow-tracking">伏笔追踪</a>：确认高价值伏笔没有丢。</li>
</ul>

<h2>阶段 7：完稿与交付</h2>
<ul>
  <li><a href="/desktop/plugin-system">插件系统</a>：适合做团队导出或审稿包。</li>
  <li><a href="/api/plugin-api">插件 API</a>：如果你要做自定义交付链路，从这里接。</li>
</ul>

<h2>长链路输入模板</h2>
<pre><code>作品阶段：大纲 / 草稿 / 修订中 / 完稿前
当前目标：写下一章 / 修一章 / 统一设定 / 做最终复检
项目约束：角色设定、世界观规则、风格要求
输出目标：可继续写 / 可进入下一轮修订 / 可交付</code></pre>

<h2>什么时候算走完整条链</h2>
<ul>
  <li>章节层问题已通过分析与修订闭环处理。</li>
  <li>新增设定已沉淀到 Wiki / 世界观层。</li>
  <li>风格、一致性、伏笔等跨章节问题已复检。</li>
  <li>你能明确区分哪些还是草稿，哪些已经是当前 canon 和可交付稿。</li>
</ul>
  `,
  'entry-matrix': `
<h2>这块矩阵怎么用</h2>
<p>如果你一时不知道该从“角色、问题，还是阶段”哪个维度切入，这块三维入口矩阵就是统一入口。你可以先选自己当前所在维度，再顺着推荐文档进入。</p>

<h2>三维矩阵</h2>
<table>
  <thead><tr><th>角色</th><th>问题</th><th>阶段</th><th>推荐入口</th></tr></thead>
  <tbody>
    <tr><td>写作者</td><td>开头弱</td><td>草稿完成后</td><td><a href="/guides/chapter-revision-playbook">章节修订专题路径</a>、<a href="/writing/craft-analysis">写作技法分析</a></td></tr>
    <tr><td>写作者</td><td>对白平</td><td>局部精修</td><td><a href="/writing/dialogue-analysis">对话分析</a>、<a href="/critic/style-profile">风格分析</a></td></tr>
    <tr><td>写作者</td><td>设定乱</td><td>修订中后期</td><td><a href="/critic/consistency-check">一致性检查</a>、<a href="/worldview/worldview-manage">设定管理</a></td></tr>
    <tr><td>写作者</td><td>节奏塌</td><td>整章复检</td><td><a href="/writing/scene-quality">场景质量</a>、<a href="/critic/multi-pass-revision">多轮修订</a></td></tr>
    <tr><td>写作者</td><td>伏笔丢</td><td>中后期收束</td><td><a href="/graph/foreshadow-tracking">伏笔追踪</a>、<a href="/graph/graph-query">图谱查询</a></td></tr>
    <tr><td>开发者</td><td>结果不对</td><td>排查阶段</td><td><a href="/guides/request-lifecycle">请求生命周期</a>、<a href="/api/workspace-api">Workspace API</a></td></tr>
    <tr><td>集成者</td><td>能力接入</td><td>规划阶段</td><td><a href="/api/gateway-api">Gateway API</a>、<a href="/api/workflow-api">Workflow API</a></td></tr>
    <tr><td>维护者</td><td>状态判断</td><td>发布前</td><td><a href="/guides/capability-status">能力状态矩阵</a>、<a href="/api/health-api">健康检查</a></td></tr>
  </tbody>
</table>

<h2>按角色进入</h2>
<ul>
  <li>写作者：优先看 <a href="/guides/common-writing-problems">常见写作问题索引</a> 和 <a href="/guides/chapter-revision-playbook">章节修订专题路径</a>。</li>
  <li>开发者：优先看 <a href="/guides/request-lifecycle">请求生命周期</a>、<a href="/api/gateway-api">Gateway API</a>、<a href="/guides/output-field-glossary">输出字段词典</a>。</li>
  <li>集成者：优先看 <a href="/api/gateway-api">Gateway API</a>、<a href="/api/agent-api">Agent API</a>、<a href="/api/workflow-api">Workflow API</a>。</li>
  <li>维护者：优先看 <a href="/guides/capability-status">能力状态矩阵</a>、<a href="/api/health-api">健康检查</a>、<a href="/guides/output-field-glossary">输出字段词典</a>。</li>
</ul>

<h2>按阶段进入</h2>
<ul>
  <li>大纲阶段：<a href="/guides/outline-to-final-manuscript">从大纲到完稿</a>、<a href="/writing/narrative-structure">叙事结构</a></li>
  <li>草稿阶段：<a href="/writing/writing-stream">流式写作</a>、<a href="/agent/agent-write">AI 写作</a></li>
  <li>分析阶段：<a href="/critic/critic-evaluate">批评评估</a>、<a href="/writing/craft-analysis">写作技法分析</a></li>
  <li>修订阶段：<a href="/critic/multi-pass-revision">多轮修订</a>、<a href="/agent/agent-revise">AI 修订</a></li>
  <li>收束阶段：<a href="/critic/consistency-check">一致性检查</a>、<a href="/graph/foreshadow-tracking">伏笔追踪</a>、<a href="/desktop/wiki-system">Wiki 系统</a></li>
</ul>
  `,
  'output-field-glossary': `
<h2>为什么需要统一词典</h2>
<p>同一个词在不同页面里如果含义漂移，用户会误判结果。这个词典统一定义文档站最常见的输出字段，避免把 <code>score</code> 当真相、把 <code>suggestion</code> 当命令，或把 <code>canon</code> 和临时结论混在一起。</p>

<h2>核心字段</h2>
<table>
  <thead><tr><th>字段</th><th>统一含义</th><th>不应该被理解成什么</th></tr></thead>
  <tbody>
    <tr><td><code>score</code></td><td>强弱、风险、优先级或完成度的信号分。</td><td>绝对真相或唯一结论。</td></tr>
    <tr><td><code>evidence</code></td><td>支撑判断的文本片段、设定来源、结构化依据。</td><td>作者必须接受的结论。</td></tr>
    <tr><td><code>suggestion</code></td><td>建议下一步动作、修订方向或可选方案。</td><td>必须照做的标准答案。</td></tr>
    <tr><td><code>status</code></td><td>表示能力状态、执行状态或验证状态。</td><td>文本质量评分。</td></tr>
    <tr><td><code>canon</code></td><td>作者确认后的长期事实与权威设定层。</td><td>任何自动抽取、语义搜索或聊天猜测。</td></tr>
  </tbody>
</table>

<h2>字段之间的关系</h2>
<pre><code>canon > evidence > suggestion
score = 帮助排序和判断
status = 说明当前状态，不替代内容判断</code></pre>

<h2>如何正确使用这些字段</h2>
<ul>
  <li>看到 <code>score</code>：先把它当“哪里值得优先看”，而不是“系统已经替我做决定”。</li>
  <li>看到 <code>evidence</code>：优先回到原文或来源核对。</li>
  <li>看到 <code>suggestion</code>：把它当候选动作，而不是唯一修法。</li>
  <li>看到 <code>status</code>：确认这是在说能力状态、执行状态，还是文档状态。</li>
  <li>涉及 <code>canon</code>：一律优先于图谱投影、语义召回和聊天临时结论。</li>
</ul>

<h2>常见误解</h2>
<table>
  <thead><tr><th>误解</th><th>正确理解</th></tr></thead>
  <tbody>
    <tr><td>score 低 = 这段必须重写</td><td>score 低只是提示优先检查，不自动决定行动。</td></tr>
    <tr><td>suggestion = 官方答案</td><td>suggestion 是候选方向，作者保留取舍权。</td></tr>
    <tr><td>graph / search 结果 = canon</td><td>它们只是投影或候选证据，最终以 author-confirmed canon 为准。</td></tr>
    <tr><td>status = 文本好坏</td><td>status 更多描述能力或流程状态。</td></tr>
  </tbody>
</table>

<h2>Related Pages</h2>
<ul>
  <li><a href="/guides/request-lifecycle">请求生命周期</a>：理解这些字段是在哪一层产生的。</li>
  <li><a href="/api/gateway-api">Gateway API</a>：理解字段如何从服务层返回。</li>
  <li><a href="/desktop/wiki-system">Wiki 系统</a>：理解 <code>canon</code> 为什么高于投影层。</li>
</ul>
  `,
};
