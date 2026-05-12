export const apiContent: Record<string, string> = {
  'mcp-endpoints': `
<h2>MCP 端点</h2>
<p>MCP 端点把内部写作能力标准化为可调用服务，便于接入 Agent、IDE 或自动化工作流。</p>
<ul>
  <li><code>writing/analyze</code> — 文本写作技法分析。</li>
  <li><code>writing/score</code> — 多维度评分。</li>
  <li><code>knowledge/search</code> — 知识库语义搜索。</li>
</ul>
  `,
  'gateway-api': `
<h2>Gateway API 概览</h2>
<p>Gateway 是桌面应用侧车进程，负责协调分析任务、知识检索、配置读取和健康检查。</p>
<h2>基础端点</h2>
<pre><code>GET  /health
POST /api/analyze
GET  /api/analyze/:id
POST /api/knowledge
GET  /api/config</code></pre>
<h2>请求流转</h2>
<ol>
  <li>前端通过 service 层发起请求。</li>
  <li>Gateway 解析任务类型和上下文。</li>
  <li>路由到分析引擎、知识引擎或模型调用链。</li>
</ol>
  `,
  'writing-api': `
<h2>写作 API</h2>
<p>写作 API 覆盖文本质量检查、写作辅助、流式写作和技法分析。</p>
<pre><code>POST /writing/novel-quality-check
POST /writing-helper/process
POST /writing/stream
POST /writing-craft/analyze</code></pre>
  `,
  'graph-api': `
<h2>图谱 API</h2>
<p>图谱 API 提供角色、关系和伏笔相关端点。</p>
<pre><code>POST /graph/query
GET  /graph/characters
GET  /graph/relationships
GET  /graph/foreshadows</code></pre>
  `,
  'critic-api': `
<h2>批评 API</h2>
<p>批评 API 提供评估、一致性、风格和多轮修订能力。</p>
<pre><code>POST /critic/evaluate
POST /critic/consistency
POST /m10/style/extract
POST /m10/revise/multi-pass</code></pre>
  `,
  'agent-api': `
<h2>Agent API</h2>
<p>Agent API 覆盖代理路由、AI 写作、AI 修订、上下文管理和对话。</p>
<pre><code>POST /agent/route
POST /agent/write
POST /agent/revise
POST /agent/context
POST /chat/stream</code></pre>
  `,
  'memory-api': `<h2>素材 API</h2><pre><code>POST /memory/search
POST /memory/add
POST /memory/upload
POST /memory/temporal</code></pre>`,
  'skill-api': `<h2>技能 API</h2><pre><code>GET /skills/list
POST /skills/match
POST /skills/chain
POST /skills/create</code></pre>`,
  'wiki-api': `
<h2>Wiki API</h2>
<p>Wiki API 用于把临时知识沉淀为长期可查询条目，并支持读取已有 Wiki 页面。</p>
<pre><code>POST /wiki/promote
GET /wiki/list
GET /wiki/page/:id</code></pre>
  `,
  'workflow-api': `
<h2>Workflow API</h2>
<p>Workflow API 负责工作流路由、规划、执行和检查点管理，适合自动化写作或工程任务编排。</p>
<pre><code>POST /workflow/route
POST /workflow/plan
POST /workflow/execute
POST /checkpoint/create</code></pre>
  `,
  'sync-api': `
<h2>同步 API</h2>
<p>同步 API 提供同步状态查询和推送/拉取能力，用于多设备项目状态保持一致。</p>
<pre><code>GET /sync/status
POST /sync/push
POST /sync/pull</code></pre>
  `,
  'health-api': `
<h2>健康检查 API</h2>
<p>健康检查 API 用于确认本地服务、指标、工具和模型列表是否可用，是排查连接问题的第一步。</p>
<pre><code>GET /health
GET /metrics
GET /tools
GET /models</code></pre>
  `,
  'config-api': `
<h2>配置 API</h2>
<p>配置 API 用于读取、更新和重载应用配置，也覆盖密钥列表管理相关能力。</p>
<pre><code>GET /config
PUT /config
GET /secrets
POST /config/reload</code></pre>
  `,
  'plugin-api': `
<h2>插件 API</h2>
<p>插件 API 用于列出、注册和执行插件，是扩展分析能力和导出能力的接口入口。</p>
<pre><code>GET /plugins/list
POST /plugins/execute
POST /plugins/register</code></pre>
  `,
  'workspace-api': `
<h2>Workspace API</h2>
<p>Workspace API 用于读取当前项目工作空间上下文，帮助分析、写作和自动化能力理解当前项目边界。</p>
<pre><code>GET /workspace/context</code></pre>
  `,
};
