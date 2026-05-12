export const apiContent: Record<string, string> = {
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
  `,
  'wiki-api': `
<h2>Wiki API</h2>
<p>Wiki API 用于把临时知识沉淀为长期可查询条目，并支持读取已有 Wiki 页面。它服务于 Story Bible、Agent 上下文和图谱投影。</p>
<pre><code>POST /wiki/promote
GET  /wiki/list
GET  /wiki/page/:id</code></pre>
<h2>权威顺序</h2>
<p>作者明确决策和已晋升 Wiki 页面应优先于聊天临时结论；图谱和语义索引是派生视图。</p>
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
  `,
};
