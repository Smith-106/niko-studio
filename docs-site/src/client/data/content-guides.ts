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
};
