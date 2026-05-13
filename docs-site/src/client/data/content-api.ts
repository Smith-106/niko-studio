import { appendSectionToPages, outputFieldGlossaryMiniSection } from './shared-doc-fragments';

const baseApiContent: Record<string, string> = {
  'mcp-endpoints': `
<h2>MCP 端点</h2>
<p>MCP 端点把内部写作能力标准化为可调用工具，便于接入 Agent、IDE 或自动化工作流。它更关注“工具语义”，Gateway API 更关注 HTTP 调用。</p>
<pre><code>flowchart LR
  Agent[Agent / IDE] --> MCP[MCP Tool Layer]
  MCP --> Gateway[Gateway]
  Gateway --> Writing[Writing]
  Gateway --> Knowledge[Knowledge]
  Gateway --> Memory[Memory]
  Gateway --> Workflow[Workflow]</code></pre>
<ul>
  <li><code>writing/analyze</code> — 文本写作技法分析。</li>
  <li><code>writing/score</code> — 多维度评分。</li>
  <li><code>knowledge/search</code> — 知识库语义搜索。</li>
  <li><code>workspace/context</code> — 当前工作区上下文。</li>
</ul>
  `,
  'gateway-api': `
<h2>Gateway API 概览</h2>
<p>Gateway 是桌面应用侧车进程，负责协调分析任务、知识检索、配置读取、模型接入和健康检查。默认本地服务基址为 <code>http://localhost:8000</code>。</p>
<pre><code>flowchart TD
  UI[Desktop Frontend] --> Service[API Service]
  Service --> Gateway[Node.js Gateway]
  Gateway --> Platform[Platform: health / config / tools]
  Gateway --> Content[Content: chat / memory / graph]
  Gateway --> Agent[Agent]
  Gateway --> Workflow[Workflow]
  Gateway --> Model[Models]</code></pre>
<h2>端点分组</h2>
<table>
  <thead><tr><th>分组</th><th>代表端点</th><th>用途</th></tr></thead>
  <tbody>
    <tr><td>Platform</td><td><code>GET /health</code>、<code>GET /models</code>、<code>GET /config</code></td><td>状态、模型、配置。</td></tr>
    <tr><td>Content</td><td><code>POST /chat</code>、<code>POST /memory/search</code>、<code>POST /graph/query</code></td><td>写作、素材、图谱。</td></tr>
    <tr><td>Agent</td><td><code>POST /agent/route</code>、<code>POST /agent/write</code></td><td>路由、写作、修订。</td></tr>
    <tr><td>Workflow</td><td><code>POST /workflow/plan</code>、<code>POST /workflow/execute</code></td><td>规划、执行、生命周期。</td></tr>
  </tbody>
</table>
<h2>请求示例</h2>
<pre><code>GET /health</code></pre>
<pre><code>POST /chat
{
  "messages": [{ "role": "user", "content": "帮我检查这一章的节奏" }],
  "workspace": {},
  "allowLlmFallback": true
}</code></pre>
<p>从外部工具调用时，使用本地基址 <code>http://localhost:8000</code>，例如先访问 <code>GET http://localhost:8000/health</code> 确认 Gateway 存活，再提交写作请求。</p>
<h2>请求流转</h2>
<ol>
  <li>前端通过 service 层发起请求，并携带当前 workspace、selection 和 intent。</li>
  <li>Gateway 解析任务类型、配置和上下文。</li>
  <li>路由到分析引擎、知识引擎、Agent 或模型调用链。</li>
  <li>返回结构化结果，供 UI 渲染分数、证据和建议。</li>
</ol>
<h2>失败行为</h2>
<table>
  <thead><tr><th>现象</th><th>优先检查</th><th>相关页面</th></tr></thead>
  <tbody>
    <tr><td>Gateway 无响应</td><td>先查 <code>GET /health</code>，再确认本地启动脚本是否完成。</td><td>健康检查、配置 API。</td></tr>
    <tr><td>模型列表为空</td><td>查看 <code>GET /config</code> 和 <code>GET /models</code>，确认 provider、default model 和密钥状态。</td><td>LLM 集成、配置 API。</td></tr>
    <tr><td>上下文缺失</td><td><code>POST /workspace/context</code> 是否带有当前项目。</td><td>Workspace API。</td></tr>
  </tbody>
</table>
<h2>相关页面</h2>
<ul>
  <li><code>/guides/capability-routing</code>：从用户意图选择 API、Agent、Wiki 或 Workflow 能力。</li>
  <li><code>/api/health-api</code>：按 health、models、tools、metrics 顺序确认服务状态。</li>
  <li><code>/api/config-api</code>：检查配置、masked secrets 和 reload 行为。</li>
  <li><code>/desktop/llm-integration</code>：理解模型配置和 Gateway 调用链。</li>
</ul>
<h2>集成建议</h2>
<ol>
  <li>外部工具先连 <code>GET /health</code>，再决定是否继续访问业务端点。</li>
  <li>若你的场景不确定属于哪个模块，先看 <a href="/guides/capability-routing">能力路由指南</a>，不要直接猜端点。</li>
  <li>把 Gateway 当作稳定入口，不要让外部脚本直接绕过它访问底层模型或本地索引。</li>
</ol>
  `,
  'writing-api': `
<h2>写作 API</h2>
<p>写作 API 覆盖对话、流式写作、写作辅助和技法分析。流式端点适合编辑器内实时生成，非流式端点适合批量分析和面板结果。</p>
<pre><code>POST /chat
POST /chat/stream
POST /writing/stream
POST /writing-helper/process
POST /writing/novel-quality-check
POST /writing-craft/analyze</code></pre>
<h2>返回结果</h2>
<ul>
  <li><strong>文本输出</strong>：续写、改写、解释或建议。</li>
  <li><strong>结构化分析</strong>：分数、维度、证据、建议。</li>
  <li><strong>SSE 事件</strong>：用于流式渲染 token、状态和完成信号。</li>
</ul>
<h2>Related Scenarios</h2>
<ul>
  <li><a href="/writing/craft-analysis">写作技法分析</a>：当你要看节奏、张力、视角等结构化结果时。</li>
  <li><a href="/writing/writing-stream">流式写作</a>：当你要实时续写和展开场景时。</li>
  <li><a href="/guides/common-writing-problems">常见写作问题索引</a>：当你是从“稿子哪里出问题了”出发时。</li>
</ul>
  `,
  'graph-api': `
<h2>图谱 API</h2>
<p>图谱 API 提供角色、关系、事件和伏笔相关能力。图谱是 Wiki 和素材的投影层，用于发现连接，不应覆盖作者确认的 canon 设定。</p>
<pre><code>POST /graph/query
GET  /graph/characters
GET  /graph/relationships
GET  /graph/foreshadows</code></pre>
<h2>适用场景</h2>
<ul>
  <li>查询角色之间的关系变化。</li>
  <li>检查伏笔是否埋设、推进和回收。</li>
  <li>为 Agent 提供结构化上下文。</li>
</ul>
<h2>Related Scenarios</h2>
<ul>
  <li><a href="/graph/graph-query">图谱查询</a>：当你记得关联但忘了出处时。</li>
  <li><a href="/graph/foreshadow-tracking">伏笔追踪</a>：当你担心伏笔丢失或回收节奏失控时。</li>
  <li><a href="/desktop/wiki-system">Wiki 系统</a>：当你需要把图谱发现回收到权威设定层时。</li>
</ul>
  `,
  'critic-api': `
<h2>批评 API</h2>
<p>批评 API 提供评估、一致性、风格和多轮修订能力。它适合把“检查问题”和“生成建议”分开处理，避免直接覆盖作者原文。</p>
<pre><code>POST /critic/evaluate
POST /critic/consistency
POST /m10/style/extract
POST /m10/revise/multi-pass</code></pre>
<h2>结果类型</h2>
<ul>
  <li>一致性问题：时间线、设定、角色行为冲突。</li>
  <li>风格画像：语气、句式、节奏和词汇倾向。</li>
  <li>修订建议：按优先级组织的改写方向。</li>
</ul>
<h2>Related Scenarios</h2>
<ul>
  <li><a href="/critic/critic-evaluate">批评评估</a>：当你只知道“读起来不对劲”时。</li>
  <li><a href="/critic/consistency-check">一致性检查</a>：当你怀疑是设定或跨章问题时。</li>
  <li><a href="/critic/multi-pass-revision">多轮修订</a>：当你已经确定要系统改整章时。</li>
</ul>
  `,
  'agent-api': `
<h2>Agent API</h2>
<p>Agent API 覆盖代理路由、AI 写作、AI 修订、上下文管理和对话。路由端点负责判断应该调用写作、修订、上下文还是工作流能力。</p>
<pre><code>POST /agent/route
POST /agent/write
POST /agent/revise
POST /agent/context
POST /chat/stream</code></pre>
<pre><code>flowchart LR
  Intent[用户意图] --> Route[/agent/route]
  Route --> Write[/agent/write]
  Route --> Revise[/agent/revise]
  Route --> Context[/agent/context]
  Route --> Chat[/chat/stream]</code></pre>
<h2>什么时候优先走 Agent</h2>
<table>
  <thead><tr><th>场景</th><th>原因</th><th>补充页面</th></tr></thead>
  <tbody>
    <tr><td>用户只给出自然语言目标</td><td>Agent 先做意图澄清和能力选择。</td><td>capability-routing、request-lifecycle</td></tr>
    <tr><td>需要结合项目事实继续写</td><td>Agent 可同时使用上下文与写作能力。</td><td>memory-api、wiki-api</td></tr>
    <tr><td>需要把分析和执行串起来</td><td>Agent 可作为 Workflow 的上层入口。</td><td>workflow-api</td></tr>
  </tbody>
</table>
  `,
  'memory-api': `
<h2>素材 API</h2>
<p>素材 API 管理项目材料、语义搜索和时间线查询，帮助分析和 Agent 使用项目内证据，而不是只依赖当前打开的正文。</p>
<pre><code>POST /memory/search
POST /memory/add
POST /memory/upload
POST /memory/temporal</code></pre>
<h2>使用方式</h2>
<ul>
  <li><code>/memory/upload</code> 导入参考材料。</li>
  <li><code>/memory/search</code> 按语义召回相关设定和证据。</li>
  <li><code>/memory/temporal</code> 查询和时间线有关的素材。</li>
</ul>
  `,
  'skill-api': `
<h2>技能 API</h2>
<p>技能 API 负责自定义写作技能的列表、匹配、创建和链式调用。技能适合封装重复使用的分析方法或提示词流程。</p>
<pre><code>GET  /skills/list
POST /skills/match
POST /skills/chain
POST /skills/create</code></pre>
<h2>调用示例</h2>
<pre><code>POST /skills/match
{
  "intent": "检查这一章开头三段的钩子是否足够强",
  "workspace": {}
}</code></pre>
<pre><code>POST /skills/chain
{
  "skillIds": ["chapter-hook-check", "dialogue-tension-check"],
  "input": { "text": "..." },
  "workspace": {}
}</code></pre>
<h2>输入输出语义</h2>
<table>
  <thead><tr><th>字段</th><th>作用</th><th>常见问题</th></tr></thead>
  <tbody>
    <tr><td><code>intent</code></td><td>描述用户目标，用于匹配技能。</td><td>太泛时容易匹配到错误技能。</td></tr>
    <tr><td><code>skillIds</code></td><td>指定链式执行顺序。</td><td>顺序不合理会让后一步缺上下文。</td></tr>
    <tr><td><code>workspace</code></td><td>限制技能作用域到当前项目。</td><td>缺失时结果容易脱离项目事实。</td></tr>
  </tbody>
</table>
<h2>故障路径</h2>
<ol>
  <li>匹配不到技能：先检查技能名、描述和 intent 是否足够具体。</li>
  <li>链式执行结果发散：检查前一个技能输出是否真的适合下一个技能输入。</li>
  <li>技能能跑但结果不像项目：回到 <a href="/api/workspace-api">Workspace API</a> 确认上下文。</li>
</ol>
  `,
  'wiki-api': `
<h2>Wiki API</h2>
<p>Wiki API 用于把临时知识沉淀为长期可查询条目，并支持读取已有 Wiki 页面。它服务于 Story Bible、Agent 上下文和图谱投影。</p>
<pre><code>POST /wiki/promote
GET  /wiki/list
GET  /wiki/page/:id</code></pre>
<h2>权威顺序</h2>
<p>作者明确决策和已晋升 Wiki 页面应优先于聊天临时结论；图谱和语义索引是派生视图。</p>
<h2>调用示例</h2>
<pre><code>POST /wiki/promote
{
  "title": "林砚人物设定",
  "content": "林砚惧怕深水，但会在危机中强撑镇定。",
  "source": "chapter-03",
  "workspace": {}
}</code></pre>
<pre><code>GET /wiki/list?status=curated</code></pre>
<h2>什么时候该晋升到 Wiki</h2>
<table>
  <thead><tr><th>内容类型</th><th>建议</th></tr></thead>
  <tbody>
    <tr><td>作者明确确认的角色事实</td><td>应晋升。</td></tr>
    <tr><td>一次性脑暴方案</td><td>先保留在对话或草稿，不急着晋升。</td></tr>
    <tr><td>反复被 Agent 或批评链路引用的设定</td><td>优先晋升，减少漂移。</td></tr>
  </tbody>
</table>
<h2>故障路径</h2>
<ol>
  <li>页面找不到：先查 <code>GET /wiki/list</code>，确认条目是否真的存在。</li>
  <li>Agent 没用到新设定：确认已晋升，再刷新 workspace context。</li>
  <li>图谱和 Wiki 不一致：以 Wiki / canon 为准，再检查投影刷新链路。</li>
</ol>
<h2>期望输出形态</h2>
<ul>
  <li>晋升结果应返回可识别的页面或条目标识。</li>
  <li>读取结果应区分已确认内容和待确认内容。</li>
  <li>冲突场景应给出核对信号，而不是无提示覆盖旧事实。</li>
</ul>
<h2>Related Scenarios</h2>
<ul>
  <li><a href="/desktop/wiki-system">Wiki 系统</a>：面向作者的长期设定沉淀入口。</li>
  <li><a href="/worldview/worldview-manage">设定管理</a>：当冲突来自世界观规则层时。</li>
  <li><a href="/guides/chapter-revision-playbook">章节修订专题路径</a>：当修订结果需要沉淀为长期事实时。</li>
</ul>
  `,
  'workflow-api': `
<h2>Workflow API</h2>
<p>Workflow API 负责工作流路由、规划、执行和生命周期管理，适合自动化写作或工程任务编排。</p>
<pre><code>POST /workflow/route
POST /workflow/plan
POST /workflow/execute
POST /workflow/lifecycle</code></pre>
<pre><code>flowchart LR
  Route[route] --> Plan[plan]
  Plan --> Execute[execute]
  Execute --> Verify[verify]
  Verify --> Lifecycle[lifecycle / checkpoint]</code></pre>
<h2>工作流边界</h2>
<p>Workflow API 适合自动化重复流程，不适合替代所有实时交互。作者的即时写作和局部修订应优先走写作或 Agent 路径；当任务需要多步计划、状态机或检查点时，再进入 Workflow。</p>
<h2>调用示例</h2>
<pre><code>POST /workflow/route
{
  "task": "检查第 5 章节奏并给出修订顺序",
  "workspace": {}
}</code></pre>
<pre><code>POST /workflow/plan
{
  "task": "分析第 5 章 -> 修订对白 -> 重新检查一致性",
  "workspace": {}
}</code></pre>
<pre><code>POST /workflow/execute
{
  "plan_id": "wf_123",
  "step": 1,
  "workspace": {}
}</code></pre>
<h2>典型故障链</h2>
<table>
  <thead><tr><th>阶段</th><th>失败表现</th><th>优先检查</th></tr></thead>
  <tbody>
    <tr><td>route</td><td>等级或能力判断明显不对。</td><td>task 描述是否太泛，是否缺 workspace。</td></tr>
    <tr><td>plan</td><td>步骤顺序混乱。</td><td>是否把分析、修订、验证目标混写在一起。</td></tr>
    <tr><td>execute</td><td>中途失败或结果偏题。</td><td>具体 step 输入、上下文和依赖产物。</td></tr>
    <tr><td>lifecycle</td><td>暂停/恢复状态异常。</td><td>planId、checkpoint 和 workspace 作用域。</td></tr>
  </tbody>
</table>
<h2>什么时候不该用 Workflow</h2>
<ul>
  <li>只想看一段文本的即时建议。</li>
  <li>还没明确目标，只是在探索想法。</li>
  <li>当前任务更适合人工快速判断，而不是编排多步状态。</li>
</ul>
<h2>期望输出形态</h2>
<ul>
  <li><code>route</code> 应给出合理的能力等级或下一步方向。</li>
  <li><code>plan</code> 应产出可执行步骤，而不是重复原任务描述。</li>
  <li><code>execute</code> 应明确当前完成的是哪一步，以及剩余步骤状态。</li>
  <li><code>lifecycle</code> 应能表达暂停、恢复或取消后的新状态。</li>
</ul>
<h2>Related Scenarios</h2>
<ul>
  <li><a href="/guides/chapter-revision-playbook">章节修订专题路径</a>：把单章修订链条串起来。</li>
  <li><a href="/guides/outline-to-final-manuscript">从大纲到完稿</a>：把整本书的长链路串起来。</li>
  <li><a href="/desktop/skill-system">技能系统</a>：当你想把固定步骤封装成稳定入口时。</li>
</ul>
  `,
  'sync-api': `
<h2>同步 API</h2>
<p>同步 API 提供同步状态查询和推送/拉取能力，用于多设备项目状态保持一致。若当前版本处于实验或部分支持状态，应以应用内能力矩阵和发布说明为准。</p>
<pre><code>GET  /sync/status
POST /sync/push
POST /sync/pull</code></pre>
<h2>冲突处理</h2>
<p>作品正文、Wiki、素材索引和分析缓存的冲突优先级不同。正文和作者确认的 canon 应优先保护，缓存可以重建。</p>
  `,
  'health-api': `
<h2>健康检查 API</h2>
<p>健康检查 API 用于确认本地服务、指标、工具和模型列表是否可用，是排查连接问题的第一步。</p>
<pre><code>GET /health
GET /metrics
GET /tools
GET /models</code></pre>
<h2>失败行为</h2>
<p>如果 <code>/health</code> 失败，优先确认本地 Gateway 是否启动；如果 <code>/models</code> 为空，优先检查 provider 配置、default model 和密钥；如果 <code>/tools</code> 缺少能力，确认当前 runtime 是否加载了对应模块。</p>
<h2>排查顺序</h2>
<ol>
  <li><code>/health</code> 确认 Gateway 是否存活。</li>
  <li><code>/config</code> 确认 provider、default model 和 masked secrets 是否配置。</li>
  <li><code>/models</code> 确认模型配置是否可见。</li>
  <li><code>/config/reload</code> 在配置变更后触发热重载。</li>
  <li><code>/tools</code> 确认可用能力是否注册。</li>
  <li><code>/metrics</code> 观察调用和错误趋势。</li>
</ol>
<h2>健康信号怎么解读</h2>
<table>
  <thead><tr><th>信号</th><th>代表什么</th><th>下一步</th></tr></thead>
  <tbody>
    <tr><td><code>/health</code> 失败</td><td>服务本身不可达。</td><td>先排进程、端口和启动脚本。</td></tr>
    <tr><td><code>/models</code> 为空</td><td>模型配置或 provider 有问题。</td><td>查看 config、reload 和 provider 密钥。</td></tr>
    <tr><td><code>/tools</code> 缺项</td><td>能力未注册或当前 runtime 未加载。</td><td>确认模块装配和当前发布边界。</td></tr>
    <tr><td><code>/metrics</code> 错误升高</td><td>调用链存在系统性异常。</td><td>结合请求生命周期与日志定位瓶颈。</td></tr>
  </tbody>
</table>
  `,
  'config-api': `
<h2>配置 API</h2>
<p>配置 API 用于读取、更新和重载应用配置，也覆盖密钥列表管理相关能力。</p>
<pre><code>GET /config
PUT /config
GET /config/secrets
PUT /config/secrets
POST /config/reload</code></pre>
<h2>配置边界</h2>
<p>前端通过设置页表达偏好，Gateway 负责读取和应用配置。密钥类配置应避免进入日志、截图和公开文档示例。</p>
<h2>失败行为</h2>
<ul>
  <li>配置读取失败时，先确认 Gateway 可通过 <code>GET /health</code> 访问。</li>
  <li>密钥列表只应返回 masked secrets；不要把真实 secret 写入日志、截图或示例。</li>
  <li>模型变更后如果 <code>GET /models</code> 未更新，执行 <code>POST /config/reload</code> 后再检查。</li>
</ul>
  `,
  'plugin-api': `
<h2>插件 API</h2>
<p>插件 API 用于列出、注册和执行插件，是扩展分析能力和导出能力的接口入口。</p>
<pre><code>GET  /plugins/list
POST /plugins/execute
POST /plugins/register</code></pre>
<h2>执行边界</h2>
<p>插件应通过 Gateway 使用工作区上下文和配置，不应直接绕过权限边界操作本地文件或模型密钥。</p>
  `,
  'workspace-api': `
<h2>Workspace API</h2>
<p>Workspace API 用于读取当前项目工作空间上下文，帮助分析、写作和自动化能力理解当前项目边界。</p>
<pre><code>POST /workspace/context</code></pre>
<h2>上下文内容</h2>
<ul>
  <li>当前作品、章节、选区和编辑状态。</li>
  <li>项目素材、Wiki、角色和世界观摘要。</li>
  <li>用户偏好、模型配置和分析目标。</li>
</ul>
<h2>为什么它重要</h2>
<p>Workspace API 是大多数高级能力的共同起点。如果这里缺项目、章节或设定，后续写作、批评、图谱和 Agent 结果都会偏泛。排查“为什么答案不像我的项目”时，优先回到 workspace context。</p>
<h2>调用示例</h2>
<pre><code>POST /workspace/context
{
  "workspace": {
    "projectRoot": "D:/novels/project-a",
    "activeDocument": "chapters/ch05.md",
    "selection": "她把钥匙攥得太紧，指节发白。"
  }
}</code></pre>
<h2>返回内容该怎么看</h2>
<table>
  <thead><tr><th>块</th><th>用途</th></tr></thead>
  <tbody>
    <tr><td>active document</td><td>确认当前请求到底围绕哪份正文展开。</td></tr>
    <tr><td>selection</td><td>决定分析或修订聚焦在哪段文本。</td></tr>
    <tr><td>wiki / character / worldview 摘要</td><td>给 Agent、批评和图谱能力提供项目事实。</td></tr>
    <tr><td>user preference / model config</td><td>解释为什么这次调用选择了某种策略。</td></tr>
  </tbody>
</table>
<h2>故障路径</h2>
<ol>
  <li>结果像通用建议：先确认 active document 和 selection 是否正确。</li>
  <li>角色或设定没被带进来：检查 Wiki / worldview 摘要是否存在。</li>
  <li>不同项目串上下文：优先检查 workspace root 是否切错。</li>
</ol>
  `,
};

export const apiContent = appendSectionToPages(
  baseApiContent,
  ['writing-api', 'graph-api', 'critic-api', 'agent-api', 'wiki-api', 'workflow-api', 'workspace-api'],
  outputFieldGlossaryMiniSection
);
