import{u as N,c as M,d as T,r as m,j as t,L as k}from"./index-DDlwdZEz.js";const w=`
<h2>输出字段词典</h2>
<ul>
  <li><code>score</code>：表示强弱、风险或优先级的信号分，不等于最终真相。</li>
  <li><code>evidence</code>：支撑判断的文本证据、设定来源或结构化依据。</li>
  <li><code>suggestion</code>：建议下一步动作或修订方向，不是必须照单全收的答案。</li>
  <li><code>status</code>：表示能力状态或执行状态，例如 Supported、Partial、running、completed，不直接表示文本质量。</li>
  <li><code>canon</code>：作者确认后的长期事实，优先级高于图谱投影、语义召回和聊天临时结论。</li>
</ul>
<p><strong>字段优先级</strong>：<code>canon</code> > <code>evidence</code> > <code>suggestion</code>；<code>score</code> 用来帮助排序和判断，不替代作者决定。完整说明见 <a href="/guides/output-field-glossary">输出字段词典</a>。</p>
`,L=`
<h2>当前发布快照</h2>
<p><strong>当前推荐版本：</strong><code>v10.0.0</code>。当前对外发布入口为 GitHub Releases：<a href="https://github.com/Smith-106/niko-studio/releases/tag/v10.0.0">Niko-Studio v10.0.0</a>。</p>
<table>
  <thead><tr><th>版本</th><th>日期</th><th>核心更新</th></tr></thead>
  <tbody>
    <tr><td><code>v10.0.0</code></td><td>2026-05-28</td><td>新手引导系统、模板管理增强、跨章节 AI 上下文、编辑器状态持久化、localStorage 防抖写入</td></tr>
    <tr><td><code>v9.27.0</code></td><td>2026-05-26</td><td>知识图谱 + AI 辅助写作 + 工作流引擎</td></tr>
  </tbody>
</table>
<h2>v10.0.0 变更日志</h2>
<ul>
  <li><strong>新手引导系统</strong> — 首次启动自动检测配置状态，引导用户完成 LLM 提供商设置和模板选择</li>
  <li><strong>模板管理增强</strong> — 支持模板收藏、最近使用记录、变量预设持久化</li>
  <li><strong>跨章节 AI 上下文</strong> — 写作助手自动携带前 N 章节摘要作为上下文，提升长篇连贯性</li>
  <li><strong>编辑器状态持久化</strong> — 自动保存编辑器滚动位置、光标位置和折叠状态</li>
  <li><strong>localStorage 防抖写入</strong> — 减少频繁 JSON.stringify + 写盘，修复 removeItem/setItem 竞态条件</li>
  <li><strong>jsdom 测试兼容</strong> — debounce 定时器增加 localStorage 存在性守卫</li>
  <li><strong>E2E 写作流验证</strong> — 完整的稿件创建→编辑→AI 辅助→导出链路测试覆盖</li>
  <li><strong>UI/UX 打磨</strong> — 设置面板布局优化、模板选择交互改进、加载状态反馈增强</li>
  <li><strong>版本同步</strong> — desktop/package.json、Cargo.toml、tauri.conf.json 版本号统一至 10.0.0</li>
</ul>
<h2>当前交付状态</h2>
<ul>
  <li>Current-head local sign-off：<strong>GO</strong></li>
  <li>GitHub release tag：<code>v10.0.0</code></li>
</ul>
`;function f(e,o,i){const r=new Set(o);return Object.fromEntries(Object.entries(e).map(([l,n])=>[l,r.has(l)?`${n}
${i}`:n]))}const O={installation:`
<h2>安装前先理解运行形态</h2>
<p>Niko Studio 是 writer-first desktop studio。普通写作者面对的是桌面应用；开发者看到的是 Tauri 桌面壳、React 前端和本地 Node.js Gateway 组成的运行栈。</p>
<pre><code>flowchart LR
  User[写作者] --> Desktop[桌面应用]
  Desktop --> Frontend[React 编辑器与面板]
  Frontend --> Gateway[本地 Gateway]
  Gateway --> Storage[本地作品与缓存]
  Gateway --> Model[LLM / 本地模型]</code></pre>
<h2>系统要求</h2>
<p>普通用户只需要桌面安装包；开发者运行源码时需要额外准备 Node.js、Rust 和项目依赖。</p>
<table>
  <thead><tr><th>场景</th><th>需要准备</th><th>说明</th></tr></thead>
  <tbody>
    <tr><td>日常写作</td><td>Windows 10/11 64-bit 或 macOS 12+</td><td>安装桌面包后即可进入编辑器。</td></tr>
    <tr><td>AI 分析</td><td>可用模型配置</td><td>可接入云端模型，也可使用本地模型方案。</td></tr>
    <tr><td>开发调试</td><td>Node.js 18+、Rust、npm 依赖</td><td>用于启动前端、Tauri host 和 Gateway。</td></tr>
    <tr><td>大型项目</td><td>8GB 以上内存、更多磁盘空间</td><td>素材索引、分析缓存和本地模型会占用额外空间。</td></tr>
  </tbody>
</table>
<h2>普通用户安装</h2>
<p>下载桌面安装包后按向导安装。首次启动时优先确认工作目录、模型配置和本地服务状态。</p>
<pre><code># Windows
niko-studio-setup-x.x.x.exe

# macOS
niko-studio-x.x.x.dmg</code></pre>
${L}
<h2>开发者启动</h2>
<p>源码运行时以桌面目录为入口，依赖安装建议使用锁文件驱动的 <code>npm ci</code>，避免开发环境漂移。</p>
<pre><code>git clone https://github.com/Smith-106/niko-studio.git
cd niko-studio/desktop
npm ci
npm run dev</code></pre>
<h2>安装验收清单</h2>
<ul>
  <li>能打开桌面主窗口，并看到项目区、正文编辑器和右侧写作面板。</li>
  <li>能创建或打开一个作品项目。</li>
  <li>能输入正文并保存到本地工作区。</li>
  <li>能访问设置页并看到模型、存储或 Gateway 状态。</li>
</ul>
<p>常见问题 启动失败先检查系统版本、安装包架构和安全策略；AI 能力不可用时先看模型配置和 Gateway 健康检查。</p>
  `,quickstart:`
<h2>5 分钟快速上手</h2>
<p>快速上手的目标不是读完整个文档站，而是完成一个可见闭环：创建作品、写入正文、触发分析、根据建议修订。</p>
<pre><code>flowchart TD
  A[创建作品项目] --> B[新建或导入文档]
  B --> C[在编辑器中写作]
  C --> D[选择 AI 意图或分析维度]
  D --> E[查看右侧面板证据]
  E --> F[回到正文修订]
  F --> G[重新分析或导出]</code></pre>
<h2>第 1 步：创建项目</h2>
<p>项目通常对应一本书、一个长篇故事或一组短篇。建议使用作品名作为项目名，让素材、角色、世界观和分析缓存都围绕同一个工作区组织。</p>
<ul>
  <li>长篇作品建议先创建章节结构。</li>
  <li>试用功能时可以创建独立测试项目。</li>
  <li>项目目录不要放在系统临时路径中。</li>
</ul>
<h2>第 2 步：写入或导入内容</h2>
<p>你可以从空白文档开始，也可以导入已有文本。导入后先通读正文，确认章节边界、标题和段落没有被破坏。</p>
<table>
  <thead><tr><th>输入方式</th><th>适合场景</th><th>建议</th></tr></thead>
  <tbody>
    <tr><td>空白文档</td><td>新作品、新章节</td><td>先写目标、冲突和转折，再请求扩写。</td></tr>
    <tr><td><code>.txt</code> / <code>.md</code></td><td>已有草稿迁移</td><td>保持章节标题清晰，便于后续分析。</td></tr>
    <tr><td><code>.docx</code></td><td>Word 草稿</td><td>导入后检查格式和段落顺序。</td></tr>
  </tbody>
</table>
<h2>第 3 步：执行第一次分析</h2>
<p>第一次分析建议只关注 1 到 2 个最重要的问题：例如叙事结构是否清楚、角色动机是否成立、场景冲突是否足够。不要同时接受所有建议。</p>
<h2>第 4 步：根据证据修订</h2>
<ol>
  <li>选择一个分数最低或最影响阅读的问题维度。</li>
  <li>阅读系统给出的文本证据，而不是只看结论。</li>
  <li>修改原文后重新分析，比较分数、证据和建议变化。</li>
</ol>
<h2>下一步推荐</h2>
<ul>
  <li>阅读「写作面板」理解右侧面板如何组织结果。</li>
  <li>阅读「写作技法分析」理解系统为什么给出这些判断。</li>
  <li>阅读「系统概览」理解桌面应用、Gateway、知识引擎之间的关系。</li>
</ul>
  `,configuration:`
<h2>配置说明</h2>
<p>配置的目标是让 Niko Studio 知道三件事：作品放在哪里、模型如何调用、分析结果应该按什么偏好呈现。</p>
<pre><code>flowchart LR
  Settings[设置页] --> Config[本地配置]
  Config --> Gateway[Gateway 读取]
  Gateway --> Model[模型提供方]
  Gateway --> Cache[分析缓存]
  Gateway --> Workspace[当前作品工作区]</code></pre>
<h2>LLM 配置</h2>
<ul>
  <li><strong>云端模型</strong> — 适合长上下文理解、结构化修订和高质量生成。</li>
  <li><strong>本地模型</strong> — 适合隐私敏感或离线优先场景。</li>
  <li><strong>Gateway 配置</strong> — 负责统一封装模型、流式输出、错误状态和工具列表。</li>
</ul>
<h2>分析偏好</h2>
<p>分析偏好决定系统把注意力放在哪里。文学小说可以更重视叙事视角和语言质感；网文可以更重视节奏、爽点、钩子和追读动力。</p>
<ul>
  <li>选择默认分析模板和重点维度。</li>
  <li>设置建议风格：简洁提示、详细解释或可执行改写。</li>
  <li>控制是否突出问题项、证据片段和优先级。</li>
</ul>
<h2>存储与缓存</h2>
<p>作品文本、素材索引、分析缓存和偏好配置默认围绕本地工作区组织。清理缓存不会替代备份，重要作品仍建议使用外部备份策略。</p>
<h2>排查顺序</h2>
<ol>
  <li>先确认桌面应用能打开当前工作区。</li>
  <li>再检查 <code>GET /health</code>、<code>GET /models</code> 等 Gateway 状态。</li>
  <li>最后检查模型密钥、网络代理或本地模型服务。</li>
</ol>
  `},B={"capability-routing":`
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
  `,"learning-paths":`
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
  `,"capability-status":`
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
  `,"request-lifecycle":`
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
  `,"doc-conventions":`
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
  `,"chapter-revision-playbook":`
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
  `,"common-writing-problems":`
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
  `,"outline-to-final-manuscript":`
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
  `,"entry-matrix":`
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
  `,"output-field-glossary":`
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
  `},_={"craft-analysis":`
<h2>写作技法分析概述</h2>
<p>写作技法分析会把文本拆解为多个可解释、可改进的维度，帮助作者定位问题并形成修订策略。</p>
<h2>分析维度</h2>
<ul>
  <li><strong>叙事视角</strong> — 第一人称、第三人称有限、全知视角等。</li>
  <li><strong>叙事节奏</strong> — 场景展开速度、时间跨度、详略分配。</li>
  <li><strong>情感张力</strong> — 冲突强度、悬念设置、情感起伏。</li>
  <li><strong>语言风格</strong> — 修辞手法、句式变化、词汇丰富度。</li>
</ul>
<h2>系统如何工作</h2>
<ol>
  <li>解析段落、对白和叙述片段。</li>
  <li>提取视角变化、节奏断点和情绪波峰。</li>
  <li>结合知识库生成结构化分析。</li>
  <li>输出评分、证据和改进建议。</li>
</ol>
<h2>如何阅读结果</h2>
<ul>
  <li>先看最低分维度。</li>
  <li>再看文本证据。</li>
  <li>最后选择本轮修订优先级。</li>
</ul>
<h2>案例：章节开头为什么“没钩子”</h2>
<p>假设一章开头连续三段都在解释背景，没有明显动作、冲突或悬念。技法分析通常会把这类问题反映在 <strong>叙事节奏</strong> 和 <strong>情感张力</strong> 上，并给出“前移冲突”“缩短解释段”“先放结果后补背景”的建议。</p>
<ol>
  <li>先看最低分是否集中在节奏与张力。</li>
  <li>再看证据是否都命中开头三段。</li>
  <li>如果命中一致，优先改开头，而不是全章一起重写。</li>
</ol>
<h2>输入示例文本片段</h2>
<pre><code>林砚来到旧宅门前，想起二十年前这条街还没有拆迁。那时巷口有一家卖糖画的小摊，摊主总爱讲一些古怪的传说。母亲曾经说过，旧宅地下埋着祖辈留下的秘密，可她从来不肯解释。</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>低分维度集中在“叙事节奏”“情感张力”。</li>
  <li>证据指出开头连续三句都在交代背景，缺少即时动作或冲突。</li>
  <li>建议形态类似：“把秘密的危险信号前移到第一段”“缩短旧街回忆”。</li>
</ul>
<h2>Related Endpoints</h2>
<ul>
  <li><a href="/api/writing-api">写作 API</a>：触发结构化分析与写作结果。</li>
  <li><a href="/api/workspace-api">Workspace API</a>：当分析结果不像当前项目时先查这里。</li>
  <li><a href="/guides/chapter-revision-playbook">章节修订专题路径</a>：把这类问题接到完整修订链路里。</li>
</ul>
  `,"narrative-structure":`
<h2>叙事结构识别</h2>
<p>叙事结构识别用于判断故事是否具备清晰的开端、推进、转折和解决路径。</p>
<h2>支持的结构模式</h2>
<ul>
  <li><strong>三幕式结构</strong> — 设置、对抗、解决。</li>
  <li><strong>英雄之旅</strong> — 召唤、试炼、归来等阶段。</li>
  <li><strong>起承转合</strong> — 东方叙事传统结构。</li>
  <li><strong>非线性叙事</strong> — 倒叙、插叙、多线并行。</li>
</ul>
<h2>使用建议</h2>
<p>结构识别适合在大纲完成后、章节阶段性完成后使用，用来检查转折是否过晚、冲突是否集中、结尾是否有足够铺垫。</p>
<h2>案例：中段塌陷</h2>
<p>很多章节不是开头差，而是中段没有有效推进。结构识别在这种情况下最有价值：它会提示“设置很充分，但中段缺少新的压力或转折”，帮助你判断问题出在结构推进，而不是句子润色。</p>
  `,"character-profile":`
<h2>角色画像系统</h2>
<p>角色画像基于文本分析自动生成角色特征、行为倾向和发展变化。</p>
<h2>五维评分</h2>
<ul>
  <li><strong>复杂度</strong> — 性格是否具备多面性。</li>
  <li><strong>一致性</strong> — 行为是否符合设定。</li>
  <li><strong>成长性</strong> — 角色弧线是否完整。</li>
  <li><strong>辨识度</strong> — 是否有独特记忆点。</li>
  <li><strong>功能性</strong> — 是否承担明确叙事作用。</li>
</ul>
<h2>推荐搭配</h2>
<p>角色画像最好和角色关系图谱、角色深度分析一起使用，这样可以同时看到单人塑造和群像结构。</p>
<h2>案例：主角设定很全，但读者记不住</h2>
<p>这通常不是“资料太少”，而是 <strong>辨识度</strong> 和 <strong>矛盾性</strong> 不够。角色画像能帮助你发现：角色信息很多，但缺少真正能让读者记住的行为反差、口头禅、价值冲突或独特选择。</p>
  `,"scene-quality":`
<h2>场景质量评估</h2>
<p>场景质量评估关注单个场景是否有明确目标、冲突、变化和信息效率。</p>
<h2>评估维度</h2>
<ul>
  <li><strong>场景节奏</strong> — 动作与描写比例是否合适。</li>
  <li><strong>氛围营造</strong> — 环境和情绪是否支撑场景目标。</li>
  <li><strong>冲突密度</strong> — 场景内部是否有足够张力。</li>
  <li><strong>信息效率</strong> — 是否承载有效叙事信息。</li>
</ul>
<h2>使用建议</h2>
<p>如果一个场景读起来“没有问题但也不吸引人”，通常可以从目标、冲突和变化三个角度重新检查。</p>
<h2>案例：场景顺但不抓人</h2>
<p>例如一场谈判戏对白流畅、信息也清楚，但读者仍觉得平。场景质量评估通常会指出：目标存在，但冲突密度低，或者场景结束时没有发生真正变化。这类结果比“文笔不够好”更可执行。</p>
<h2>输入示例文本片段</h2>
<pre><code>“价格可以再谈。”顾闻说。
“我已经让到最低了。”对方把合同推回去。
两人又交换了几句条件，最后约定明天再议。顾闻起身离开，心里有些烦躁。</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>指出场景目标明确，但冲突升级不足。</li>
  <li>提示“离场前缺少新的信息变化或代价”。</li>
  <li>建议形态类似：“加入让谈判失衡的新条件”或“让角色带着错误判断离场”。</li>
</ul>
<h2>Related Endpoints</h2>
<ul>
  <li><a href="/api/writing-api">写作 API</a>：对应场景分析和局部改写调用。</li>
  <li><a href="/api/critic-api">批评 API</a>：当问题需要进一步拆成修订建议时。</li>
  <li><a href="/guides/common-writing-problems">常见写作问题索引</a>：从“节奏塌”直接回到这类页面。</li>
</ul>
  `,"dialogue-analysis":`
<h2>对话分析</h2>
<p>对话分析用于判断对白是否自然、是否区分角色、是否推动情节。</p>
<h2>分析指标</h2>
<ul>
  <li><strong>自然度</strong> — 是否符合语境和身份。</li>
  <li><strong>区分度</strong> — 不同角色是否有不同说话方式。</li>
  <li><strong>潜台词</strong> — 是否有未明说的信息。</li>
  <li><strong>功能性</strong> — 是否推动情节或揭示性格。</li>
</ul>
<h2>案例：对白都像同一个人在说话</h2>
<p>如果角色 A 是冷静克制型，角色 B 是冲动直给型，但他们说话节奏、词汇和句长几乎一样，对话分析会在 <strong>区分度</strong> 上给出低信号。修订时不一定要大改内容，先拉开表达习惯往往就能明显改善。</p>
<h2>输入示例文本片段</h2>
<pre><code>“我认为我们现在不应该进去。”林砚说。
“我认为你说得不对，我们应该马上进去。”周野说。
“我认为这样做风险太大。”林砚说。</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>低信号落在“区分度”和“自然度”。</li>
  <li>证据指出两人句式重复、语气接近。</li>
  <li>建议形态类似：“让周野更短句、更直给；让林砚保留迟疑和补充解释”。</li>
</ul>
<h2>Related Endpoints</h2>
<ul>
  <li><a href="/api/writing-api">写作 API</a>：当你要把对话分析接回修订动作时。</li>
  <li><a href="/api/agent-api">Agent API</a>：当你想先分析再用 Agent 修对白时。</li>
  <li><a href="/guides/common-writing-problems">常见写作问题索引</a>：从“对白平”直接跳回来。</li>
</ul>
  `,"writing-stream":`
<h2>流式写作</h2>
<p>流式写作通过 SSE 将 AI 生成内容逐段返回，适合实时续写、场景展开和对话生成。</p>
<h2>使用场景</h2>
<ul>
  <li>输入前文，让 AI 延续当前叙事方向。</li>
  <li>给定场景概要，展开为完整描写。</li>
  <li>根据角色设定生成自然对话。</li>
</ul>
<h2>注意点</h2>
<p>流式输出适合探索草稿，不建议未经整理直接作为最终稿。</p>
<h2>案例：实时续写怎么用得更稳</h2>
<p>如果你只输入“继续写”，流式写作往往会偏泛。更稳的做法是同时给出当前情绪、场景目标和禁止项，例如“继续写追逐戏，保持紧张，不要揭示幕后黑手”。这样流式输出更像可用草稿，而不是随机扩写。</p>
<h2>输入示例</h2>
<pre><code>目标：继续写追逐戏
当前情绪：紧张、压抑
角色约束：主角受伤但不能停下
禁止项：不要暴露幕后黑手身份</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>输出应连续推进动作，而不是突然插入大段世界观解释。</li>
  <li>应保持“主角带伤奔逃”的身体限制。</li>
  <li>不应提前揭示隐藏反派。</li>
</ul>
<h2>Related Endpoints</h2>
<ul>
  <li><a href="/api/writing-api">写作 API</a>：底层流式写作和写作助手入口。</li>
  <li><a href="/api/agent-api">Agent API</a>：当你希望先做路由或补上下文再续写。</li>
  <li><a href="/guides/outline-to-final-manuscript">从大纲到完稿</a>：放回整本书长链路里看。</li>
</ul>
  `,"hook-cliffhanger":`
<h2>钩子与断章检测</h2>
<p>自动检测章节开头的钩子强度和结尾的断章效果，帮助判断读者是否有足够动力继续阅读。</p>
<h2>检测维度</h2>
<ul>
  <li><strong>钩子强度</strong> — 开头是否在 3 段内建立冲突、悬念或信息差。</li>
  <li><strong>断章类型</strong> — 悬念断章、情感断章、信息断章、行动断章等分类。</li>
  <li><strong>读者状态模型</strong> — 追踪读者在每个章节末尾的期待、紧张和好奇程度。</li>
</ul>
<h2>使用建议</h2>
<p>适合在章节完成后检查开头是否"有钩子"、结尾是否"留悬念"。如果连续多章钩子评分低，可能需要重新审视叙事节奏。</p>
<h2>Related Endpoints</h2>
<ul>
  <li><a href="/api/writing-api">写作 API</a>：触发钩子与断章分析。</li>
  <li><a href="/writing/craft-analysis">写作技法分析</a>：查看更完整的技法维度分析。</li>
</ul>
  `,"voice-fingerprint":`
<h2>角色声纹</h2>
<p>分析每个角色的语言特征，判断角色之间是否有足够的语音区分度，以及同一角色的语言是否前后一致。</p>
<h2>分析指标</h2>
<ul>
  <li><strong>词汇偏好</strong> — 角色常用词、句长、语气词分布。</li>
  <li><strong>句式模式</strong> — 长句/短句、陈述/疑问/感叹比例。</li>
  <li><strong>一致性</strong> — 同一角色在不同章节的语言是否保持稳定。</li>
  <li><strong>区分度</strong> — 不同角色之间是否可以仅凭语言风格区分。</li>
</ul>
<h2>案例：主角和配角说话像同一个人</h2>
<p>声纹分析会给出低区分度信号，并建议拉开表达习惯差异：例如让冲动型角色用更短句、更直给，让克制型角色保留迟疑和补充解释。</p>
<h2>Related Endpoints</h2>
<ul>
  <li><a href="/api/writing-api">写作 API</a>：触发声纹分析。</li>
  <li><a href="/writing/dialogue-analysis">对话分析</a>：更细粒度的对话质量评估。</li>
</ul>
  `,"emotional-arc":`
<h2>情感弧线分析</h2>
<p>追踪文本中情绪的起伏轨迹，评估情感推进是否有效、高潮是否有足够铺垫、结尾是否兑现了情绪承诺。</p>
<h2>分析维度</h2>
<ul>
  <li><strong>情绪轨迹</strong> — 逐段情绪标注和趋势线。</li>
  <li><strong>Show/Tell 比率</strong> — 情感是直接展示还是间接叙述。</li>
  <li><strong>沉浸感评分</strong> — 读者是否被拉入场景，还是被叙述推远。</li>
  <li><strong>高潮兑现</strong> — 前期铺垫的情绪承诺是否在高潮点兑现。</li>
</ul>
<h2>使用建议</h2>
<p>情感弧线适合在章节或全书完成后使用，用来检查情绪推进是否有"塌陷"或"跳变"。</p>
<h2>Related Endpoints</h2>
<ul>
  <li><a href="/api/writing-api">写作 API</a>：触发情感弧线分析。</li>
  <li><a href="/writing/craft-analysis">写作技法分析</a>：查看完整的技法维度。</li>
</ul>
  `,"mystery-analysis":`
<h2>悬疑分析</h2>
<p>针对悬疑/推理类文本，分析推理链完整性、线索公平性和类型归属。</p>
<h2>分析维度</h2>
<ul>
  <li><strong>推理链</strong> — 线索→推理→结论的链路是否完整、是否有跳跃。</li>
  <li><strong>类型分类</strong> — 本格推理、社会派、硬汉派、惊悚四种悬疑子类型。</li>
  <li><strong>线索公平性</strong> — 读者是否有足够信息推理出真相（本格要求）。</li>
  <li><strong>设局/解局节奏</strong> — 悬念设置与揭示的节奏是否合理。</li>
</ul>
<h2>适用边界</h2>
<p>悬疑分析最适合有明确推理结构的文本。纯文学或情感向文本的推理链分析结果可能不具参考价值。</p>
<h2>Related Endpoints</h2>
<ul>
  <li><a href="/api/writing-api">写作 API</a>：触发悬疑分析。</li>
  <li><a href="/writing/narrative-structure">叙事结构</a>：查看更通用的结构识别。</li>
</ul>
  `,"session-intelligence":`
<h2>会话智能</h2>
<p>会话智能通过收集写作行为 telemetry（活跃时间、保存频率、重写次数、跳转编辑等），对单次写作会话进行分析，并在多次会话间挖掘跨会话模式。</p>
<h2>核心能力</h2>
<ul>
  <li><strong>Telemetry 收集</strong> — 记录写作过程中的行为信号：activeMinutes、saveCount、rewriteCount、jumpEditCount、historyPanelOpenCount。</li>
  <li><strong>单会话分析</strong> — 基于 WritingSessionTelemetry 生成 SessionInsight，识别写作模式和薄弱点。</li>
  <li><strong>跨会话聚类</strong> — 通过 WritingSessionCluster 将相似写作会话分组，发现跨会话模式（如"总是深夜写角色对话"）。</li>
  <li><strong>模式挖掘</strong> — minePatterns() 提取 CrossSessionInsight，按置信度排序输出跨会话洞察。</li>
</ul>
<h2>使用场景</h2>
<ol>
  <li>单章写完后查看本次会话洞察。</li>
  <li>多章完成后查看跨会话模式。</li>
  <li>根据会话模式调整写作策略。</li>
</ol>
<h2>案例：发现"深夜重写模式"</h2>
<p>会话智能可能发现：你在凌晨 1-3 点的会话中 rewriteCount 普遍偏高，而白天的会话 saveCount 更高。这可能意味着深夜写作时产出不如白天稳定，建议把"深度创作"集中在高效时段。</p>
<h2>Related Endpoints</h2>
<ul>
  <li><a href="/critic/intelligent-revision">智能修订</a>：会话洞察可直接驱动修订。</li>
  <li><a href="/critic/style-personalization">风格个性化</a>：会话模式可反馈到偏好系统。</li>
</ul>
  `},j=f(_,["craft-analysis","scene-quality","dialogue-analysis","writing-stream","hook-cliffhanger","voice-fingerprint","emotional-arc","mystery-analysis"],w),V={"graph-query":`
<h2>图谱查询</h2>
<p>知识图谱提供结构化的故事元素查询能力，让角色、事件、线索和设定之间的关系可以被系统化追踪。</p>
<h2>适用场景</h2>
<ul>
  <li>快速定位某个角色出现过的事件。</li>
  <li>检查角色之间是否已经建立明确关系。</li>
  <li>追踪情节线或某类事件在全书中的分布。</li>
</ul>
<h2>查询类型</h2>
<ul>
  <li><strong>角色查询</strong> — 按名称、属性、关系查询角色节点。</li>
  <li><strong>关系查询</strong> — 查询角色之间的关联关系。</li>
  <li><strong>事件查询</strong> — 查询故事中的关键事件节点。</li>
</ul>
<h2>案例：我记得这个角色和“火灾事件”有关，但忘了在哪里</h2>
<p>这类问题很适合先用图谱查询。相比全文搜索，它更擅长从“角色 - 事件 - 线索”三个维度定位结构化关联，再回到正文核对细节。</p>
<h2>输入示例</h2>
<pre><code>{
  "type": "event",
  "filters": {
    "character": "林砚",
    "keyword": "火灾"
  }
}</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>返回与“林砚”相关的事件节点和连接边。</li>
  <li>结果中应能看出事件发生章节或关联线索。</li>
  <li>若没有结果，也应提示是“未建图”还是“查询条件过窄”。</li>
</ul>
<h2>Related Endpoints</h2>
<ul>
  <li><a href="/api/graph-api">图谱 API</a>：对应角色、事件和关系查询入口。</li>
  <li><a href="/api/wiki-api">Wiki API</a>：当查询结果需要核对长期权威设定时。</li>
  <li><a href="/guides/common-writing-problems">常见写作问题索引</a>：适合从问题驱动跳回图谱页。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /graph/query
Body: { type: "character"|"relationship"|"event", filters?: {} }
Response: { nodes: GraphNode[], edges: GraphEdge[] }</code></pre>
  `,"character-relationships":`
<h2>角色关系图谱</h2>
<p>角色关系图谱帮助作者看清人物群像结构，而不是只盯着单个角色。</p>
<h2>关系类型</h2>
<ul>
  <li><strong>亲属</strong> — 家庭、血缘关系。</li>
  <li><strong>友谊</strong> — 同盟、伙伴关系。</li>
  <li><strong>对抗</strong> — 敌对、竞争关系。</li>
  <li><strong>爱情</strong> — 恋爱、婚姻关系。</li>
  <li><strong>师徒</strong> — 教学、传承关系。</li>
</ul>
<h2>你可以用它解决什么问题</h2>
<ul>
  <li>检查重要角色之间是否缺少互动支撑。</li>
  <li>发现配角是否承担了过多关系连接。</li>
  <li>确认主角周围的支持、对抗和情感网络是否清晰。</li>
</ul>
<h2>案例：群像关系失衡</h2>
<p>如果所有关键情节都只能通过主角和同一个配角连接，关系图谱会暴露出“中心化过强”的问题。对长篇群像作品，这比单纯看人物介绍更容易发现结构失衡。</p>
<h3>端点</h3>
<pre><code>GET  /graph/characters
GET  /graph/relationships</code></pre>
  `,"foreshadow-tracking":`
<h2>伏笔追踪</h2>
<p>伏笔追踪用于记录伏笔埋设、回收和遗漏情况，避免长篇写作中出现“前面埋了，后面忘了收”的问题。</p>
<h2>功能</h2>
<ul>
  <li><strong>伏笔埋设</strong> — 标记文本中的伏笔线索。</li>
  <li><strong>回收追踪</strong> — 监控伏笔是否被回收。</li>
  <li><strong>统计分析</strong> — 统计回收比例和平均回收距离。</li>
  <li><strong>遗漏提醒</strong> — 标记长期未回收伏笔。</li>
</ul>
<h2>推荐使用方式</h2>
<ul>
  <li>每完成一个情节阶段后做一次统计检查。</li>
  <li>重点关注埋得早、拖得久的伏笔。</li>
  <li>把高价值伏笔与关键角色和关键事件关联起来看。</li>
</ul>
<h2>案例：前面埋了，后面忘了收</h2>
<p>长篇连载最常见的问题不是不会埋伏笔，而是回收节奏失控。伏笔追踪适合用来发现“埋设时间很早，但长期没有对应回收事件”的线索，帮助你判断是该尽快回收，还是应该提前删掉这条伏笔。</p>
<h2>输入示例</h2>
<pre><code>{
  "foreshadow": "黑色钥匙",
  "plantedAt": "chapter-02",
  "note": "第一次出现时主角刻意回避解释来源"
}</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>统计结果应给出“已回收 / 未回收 / 回收距离”。</li>
  <li>若长期未回收，应有明显提醒。</li>
  <li>高价值伏笔最好能关联到关键角色或关键事件。</li>
</ul>
<h2>Related Endpoints</h2>
<ul>
  <li><a href="/api/graph-api">图谱 API</a>：对应伏笔登记、查询和统计。</li>
  <li><a href="/critic/consistency-check">一致性检查</a>：当伏笔问题已经影响结构连贯时。</li>
  <li><a href="/guides/common-writing-problems">常见写作问题索引</a>：从“伏笔丢”直接跳回这里。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /graph/foreshadow/plant
GET  /graph/foreshadows
GET  /graph/foreshadow/stats</code></pre>
  `,"character-depth":`
<h2>角色深度分析</h2>
<p>角色深度分析关注角色是否具备推动故事和引发读者兴趣的内部结构。</p>
<h2>分析维度</h2>
<ul>
  <li><strong>表层特征</strong> — 外貌、职业、背景。</li>
  <li><strong>心理层次</strong> — 动机、恐惧、欲望。</li>
  <li><strong>矛盾性</strong> — 内在冲突和矛盾特质。</li>
  <li><strong>成长空间</strong> — 角色发展潜力。</li>
</ul>
<h2>使用建议</h2>
<ul>
  <li>优先分析主角、关键反派和剧情支点人物。</li>
  <li>与角色关系图谱一起看，更容易发现群像失衡。</li>
  <li>如果角色设定丰富但读者记不住，重点看辨识度和矛盾性。</li>
</ul>
<h2>案例：反派设定复杂，但没有压迫感</h2>
<p>这通常说明“资料复杂”不等于“角色深”。深度分析能帮助你看到反派是否只有背景说明，却缺少真正会驱动行动的欲望、恐惧和矛盾，这些才是压迫感的来源。</p>
<h2>输入示例文本片段</h2>
<pre><code>顾承川出身显赫，受过最好教育，做事一丝不苟。他熟悉金融、法律和礼仪，在任何场合都显得无可挑剔。</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>指出表层特征充足，但心理层次和矛盾性不足。</li>
  <li>提示“缺少真正会驱动行动的欲望或恐惧”。</li>
  <li>建议形态类似：“给他一个会破坏完美外壳的执念”。</li>
</ul>
<h2>Related Endpoints</h2>
<ul>
  <li><a href="/api/graph-api">图谱 API</a>：角色深度和关系查询的底层入口。</li>
  <li><a href="/writing/character-profile">角色画像</a>：补看辨识度、一致性和成长性。</li>
  <li><a href="/guides/outline-to-final-manuscript">从大纲到完稿</a>：放回整本书角色发展链路里理解。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /graph/character/:id/depth
Body: { text: string }</code></pre>
  `},U=f(V,["graph-query","foreshadow-tracking","character-depth"],w),q={"critic-evaluate":`
<h2>批评评估</h2>
<p>批评评估把“为什么这个片段有效或无效”拆成可定位的维度，而不是只给笼统判断。</p>
<h2>评估维度</h2>
<ul>
  <li>叙事技巧 — 视角运用、节奏控制。</li>
  <li>语言表达 — 修辞手法、词汇多样性。</li>
  <li>结构完整性 — 情节逻辑、因果关系。</li>
  <li>角色塑造 — 性格一致性、成长弧线。</li>
  <li>情感共鸣 — 读者情感参与度。</li>
</ul>
<h2>如何使用结果</h2>
<ul>
  <li>先看整体评分。</li>
  <li>再看维度分项。</li>
  <li>最后结合高亮证据定位段落。</li>
</ul>
<h2>案例：这一段“说不上差，但读着不痛不痒”</h2>
<p>批评评估适合处理这种模糊不满。它会把问题拆成更具体的维度，比如节奏偏平、情感共鸣不足，或者结构逻辑清楚但语言缺少压强。这样你能知道该调的是结构、语言还是情绪力度。</p>
<h2>输入示例文本片段</h2>
<pre><code>她看着病房门，想起昨晚医生说过的话。窗外下着雨，走廊里有脚步声经过。她把手机放回口袋，站了一会儿，最后推门进去。</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>指出整体可读，但情绪压强不足。</li>
  <li>证据应命中“动作存在，但情感递进较弱”。</li>
  <li>建议形态类似：“强化犹豫的代价”或“让推门动作前出现更尖锐的心理冲突”。</li>
</ul>
<h2>Related Endpoints</h2>
<ul>
  <li><a href="/api/critic-api">批评 API</a>：对应评估、建议和修订链路。</li>
  <li><a href="/api/writing-api">写作 API</a>：当你要把诊断接回具体改写动作时。</li>
  <li><a href="/guides/chapter-revision-playbook">章节修订专题路径</a>：把这类诊断接到完整修订闭环里。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /critic/evaluate
Body: { text: string, dimensions?: string[] }</code></pre>
  `,"consistency-check":`
<h2>一致性检查</h2>
<p>一致性检查用于发现设定矛盾、时间线冲突和跨章漏洞。</p>
<h2>检查类型</h2>
<ul>
  <li><strong>设定一致性</strong> — 外貌、能力、背景是否前后一致。</li>
  <li><strong>时间线一致性</strong> — 事件顺序是否合理。</li>
  <li><strong>跨章一致性</strong> — 多章节设定是否连贯。</li>
</ul>
<h2>最佳实践</h2>
<p>建议每章完成后做单章检查，每完成一个阶段后做跨章检查，把问题尽量消灭在早期。</p>
<h2>案例：人物设定悄悄漂移</h2>
<p>例如前几章强调角色怕血，后面却在关键场景里毫无反应。一致性检查最适合抓这种“作者写的时候没注意，但读者会出戏”的问题，尤其在多章节长篇里价值很高。</p>
<h2>输入示例文本片段</h2>
<pre><code>设定记录：林砚惧怕血腥场面。
当前章节片段：林砚踩过满地血迹，面不改色地翻找尸体口袋，没有任何迟疑。</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>直接标出“当前行为与既有设定冲突”。</li>
  <li>说明冲突类型属于角色反应不一致，而非纯时间线问题。</li>
  <li>建议形态类似：“补足强撑镇定的心理代价”或“修改行为强度”。</li>
</ul>
<h2>Related Endpoints</h2>
<ul>
  <li><a href="/api/critic-api">批评 API</a>：对应一致性与跨章检查。</li>
  <li><a href="/api/wiki-api">Wiki API</a>：当冲突需要回到长期设定层核对时。</li>
  <li><a href="/guides/common-writing-problems">常见写作问题索引</a>：从“设定乱”直接跳回这里。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /critic/consistency
POST /critic/cross-chapter</code></pre>
  `,"style-profile":`
<h2>风格分析</h2>
<p>风格分析用于提取写作风格特征，判断文本风格是否稳定、是否匹配题材目标。</p>
<h2>风格维度</h2>
<ul>
  <li><strong>句式结构</strong> — 长短句比例、句式变化频率。</li>
  <li><strong>词汇选择</strong> — 口语/书面语比例。</li>
  <li><strong>修辞偏好</strong> — 常用修辞和意象。</li>
  <li><strong>叙事距离</strong> — 叙述者与故事的距离感。</li>
</ul>
<h2>常见用途</h2>
<ul>
  <li>检查章节之间是否风格漂移。</li>
  <li>比较两个改写版本是否保留作者气质。</li>
  <li>为 AI 改写提供风格约束。</li>
</ul>
<h2>案例：后半本像换了作者</h2>
<p>连载或多人协作时，经常会出现风格慢慢偏掉的问题。风格分析可以把“我觉得不像前面了”拆成句长、词汇、修辞和叙事距离的变化，让你知道到底是哪一层漂移。</p>
<h2>输入示例文本片段</h2>
<pre><code>前期风格：短句、克制、少修辞。
后期片段：暮色像被打翻的葡萄酒，沿着城市边缘缓慢流淌，所有屋顶都浸在一种近乎甜腻的红里。</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>指出修辞密度、句长和叙事距离发生明显变化。</li>
  <li>给出“是否偏离既有风格画像”的结论。</li>
  <li>若用于修订，应产出更贴近前期风格的调整方向。</li>
</ul>
<h2>Related Endpoints</h2>
<ul>
  <li><a href="/api/critic-api">批评 API</a>：对应风格提取、读取和应用。</li>
  <li><a href="/agent/agent-revise">AI 修订</a>：当你要把风格要求带回修订动作时。</li>
  <li><a href="/guides/outline-to-final-manuscript">从大纲到完稿</a>：适合放在完稿前复检阶段理解。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /m10/style/extract
GET  /m10/style/profile
POST /m10/style/apply</code></pre>
  `,"multi-pass-revision":`
<h2>多轮修订</h2>
<p>多轮修订把复杂修改拆成多个聚焦轮次，避免结构、语言和细节互相干扰。</p>
<h2>修订流程</h2>
<pre><code>第 1 轮: 结构审查
第 2 轮: 语言润色
第 3 轮: 风格统一
第 4 轮: 细节打磨</code></pre>
<h2>推荐使用方式</h2>
<ul>
  <li>先完成结构轮，再进入语言轮。</li>
  <li>重要章节保留每轮结果。</li>
  <li>某一轮产生大改动后，后续轮次应重新评估上下文。</li>
</ul>
<h2>案例：一边修语言，一边把结构越修越乱</h2>
<p>多轮修订就是为了解决这个问题。先单独处理结构，再处理语言和风格，能显著减少“刚把句子修顺了，后面又因为结构调整全改一遍”的返工。</p>
<h2>期望输出形态</h2>
<ul>
  <li>第 1 轮输出应聚焦结构问题，不急着润色句子。</li>
  <li>第 2 轮再处理语言精简、节奏和表达。</li>
  <li>每轮都应留下可比较的阶段性结果，而不是一次性全部覆盖。</li>
</ul>
<h2>Related Endpoints</h2>
<ul>
  <li><a href="/api/critic-api">批评 API</a>：对应多轮修订调用链。</li>
  <li><a href="/api/workflow-api">Workflow API</a>：当你想把多轮修订编排成可恢复流程时。</li>
  <li><a href="/guides/chapter-revision-playbook">章节修订专题路径</a>：这是这类能力的最直接专题入口。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /m10/revise/multi-pass</code></pre>
  `,"context-suggestions":`
<h2>上下文建议</h2>
<p>上下文建议会根据当前文本和项目背景，提供下一步写作方向。</p>
<h2>建议类型</h2>
<ul>
  <li><strong>情节推进</strong> — 下一步情节发展建议。</li>
  <li><strong>角色行为</strong> — 符合角色性格的行动建议。</li>
  <li><strong>场景描写</strong> — 补充环境和氛围描写。</li>
  <li><strong>对话补充</strong> — 生成或调整对话内容。</li>
</ul>
<h2>案例：不知道下一步写什么，但又不想让 AI 直接代写</h2>
<p>上下文建议非常适合这种情况。它不直接替你写整段，而是给出几个更贴近当前项目事实的推进方向，比如”让角色先做错误判断””先补氛围再爆冲突””先用对话拖住节奏”。</p>
<h2>输入示例文本片段</h2>
<pre><code>当前状态：主角刚得知父亲可能还活着，但还没有证据。
目标：给下一场戏 3 个推进方向，不直接代写正文。</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>返回多个方向，而不是单一标准答案。</li>
  <li>每个方向都应说明更偏”情节推进””角色行为”还是”氛围铺垫”。</li>
  <li>建议应围绕当前项目事实，而不是泛泛的套路化桥段。</li>
</ul>
<h2>Related Endpoints</h2>
<ul>
  <li><a href=”/api/critic-api”>批评 API</a>：对应上下文建议能力。</li>
  <li><a href=”/agent/chat-system”>对话系统</a>：当你要围绕这些方向继续追问时。</li>
  <li><a href=”/guides/common-writing-problems”>常见写作问题索引</a>：适合从”节奏塌””不知道怎么推进”跳回来。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /m10/context-suggestions</code></pre>
  `,"intelligent-revision":`
<h2>智能修订</h2>
<p>智能修订通过 Critic-driven 循环实现多轮自动修订：每轮先用 Critic 评估薄弱点，再基于评估结果定向改进，直到质量达标或达到迭代上限。</p>
<h2>核心流程</h2>
<ol>
  <li><strong>分析</strong> — IRevisionService.analyze() 对文本进行多维度评估。</li>
  <li><strong>建议</strong> — suggest() 提取薄弱点和改进建议。</li>
  <li><strong>修订</strong> — revise() 执行 Critic-driven 修订循环。</li>
  <li><strong>比较</strong> — compare() 对比修订前后差异。</li>
</ol>
<h2>跨迭代学习</h2>
<p>每次修订循环会积累 LearningInsight — 记录哪些维度最容易出问题、哪些修订策略最有效。这些洞察在后续修订中会自动复用，使修订质量随使用逐步提升。</p>
<h2>终止条件</h2>
<ul>
  <li><strong>APPROVED</strong> — 最终评分达到目标阈值。</li>
  <li><strong>HUMAN_REVIEW</strong> — 接近阈值但需要人工确认。</li>
  <li><strong>MAX_ITERATIONS</strong> — 达到迭代上限，建议人工介入。</li>
</ul>
<h2>案例：一章从 5 分修到 8 分</h2>
<p>输入章节文本，设置 target_score=8.0，max_iterations=5。系统会先分析得到 baseline score（如 5.2），然后每轮聚焦最低分维度改进。可能第 2 轮修节奏、第 3 轮修情感张力、第 4 轮达到 7.8 分进入 HUMAN_REVIEW。</p>
<h2>Related Endpoints</h2>
<ul>
  <li><a href=”/api/critic-api”>批评 API</a>：底层 Critic 评估能力。</li>
  <li><a href=”/writing/session-intelligence”>会话智能</a>：修订洞察可反馈到会话分析。</li>
  <li><a href=”/critic/style-personalization”>风格个性化</a>：修订偏好可沉淀到个性化系统。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /m10/revision/multi-pass
Body: { text, target_score?, max_iterations?, chapter_id? }</code></pre>
  `,"style-personalization":`
<h2>风格个性化</h2>
<p>风格个性化基于你的写作偏好信号（接受/拒绝/修改建议的记录），构建个性化推荐引擎，使系统建议越来越贴合你的创作风格。</p>
<h2>核心能力</h2>
<ul>
  <li><strong>偏好信号记录</strong> — recordPreferenceSignal() 记录你对每条建议的反馈。</li>
  <li><strong>个性化画像</strong> — buildProfile() 基于偏好信号构建 PersonalizedCraftProfile。</li>
  <li><strong>风格推荐</strong> — getRecommendations() 融合模式推荐 + 偏好推荐，按置信度排序。</li>
  <li><strong>持久化</strong> — 偏好信号通过 KnowledgeMemory 桥接持久存储。</li>
</ul>
<h2>推荐来源</h2>
<ul>
  <li><strong>pattern</strong> — 来自写作模式检测的结构化推荐。</li>
  <li><strong>preference</strong> — 来自你历史偏好行为的个性化推荐。</li>
  <li><strong>reference</strong> — 来自会话智能的上下文推荐。</li>
</ul>
<h2>案例：系统越用越懂你</h2>
<p>前几次使用时，推荐主要是模式检测驱动的（如”句子偏长””过渡不够”）。随着你不断接受/拒绝建议，系统会学到你更在意节奏而非修辞，推荐会逐渐偏向节奏维度的建议，并自动降低你从不采纳的维度权重。</p>
<h2>Related Endpoints</h2>
<ul>
  <li><a href=”/critic/intelligent-revision”>智能修订</a>：修订反馈直接驱动偏好学习。</li>
  <li><a href=”/writing/session-intelligence”>会话智能</a>：会话模式为推荐提供上下文。</li>
  <li><a href=”/api/critic-api”>批评 API</a>：底层风格分析能力。</li>
</ul>
  `},F=f(q,["critic-evaluate","consistency-check","style-profile","multi-pass-revision","context-suggestions"],w),H={"worldview-extract":`
<h2>设定提取</h2>
<p>设定提取从文本中识别地理、历史、规则体系和文化设定，建立结构化设定库。</p>
<ul>
  <li>地理设定。</li>
  <li>历史设定。</li>
  <li>规则体系。</li>
  <li>文化设定。</li>
</ul>
<h2>案例：设定散落在正文里，自己也记不清</h2>
<p>很多作者不是没有世界观，而是设定散落在章节、对白和说明段里。设定提取适合先把这些零散信息捞出来，至少形成一个可检视的“候选设定层”，再由作者决定哪些应该进入长期 canon。</p>
<h2>提取后应怎么处理</h2>
<ol>
  <li>先区分“作者明确确认”与“文本暂时暗示”。</li>
  <li>再把稳定设定晋升到 Wiki / 世界观管理页。</li>
  <li>最后再让 Agent、Graph 或批评能力使用这些设定。</li>
</ol>
<h2>输入示例文本片段</h2>
<pre><code>雾港一年有九个月被海雾笼罩，外来船只只能在钟塔敲响后靠岸。城里人相信海雾会吞掉撒谎的人，所以交易前必须在雾镜前宣誓。</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>提取出“地理设定：雾港”“规则体系：钟塔靠岸规则”“文化设定：雾镜宣誓”。</li>
  <li>把这些内容组织成候选设定条目，而不是只返回原文摘录。</li>
  <li>若有不确定项，应标注为待确认，而不是直接当 canon。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /m11/worldview/extract</code></pre>
  `,"worldview-manage":`
<h2>设定管理</h2>
<p>设定管理用于查询、编辑和验证已有世界观设定，保持叙事一致性。</p>
<ul>
  <li>设定查询。</li>
  <li>设定编辑。</li>
  <li>一致性验证。</li>
</ul>
<h2>案例：规则很多，但写到后面彼此打架</h2>
<p>例如力量体系、地理边界或历史事件在不同章节里出现互相冲突的说法。设定管理的价值不只是“存起来”，而是让你能按类别回看并统一修正，不再靠记忆维持世界观。</p>
<h2>推荐管理方式</h2>
<table>
  <thead><tr><th>类别</th><th>适合怎么维护</th></tr></thead>
  <tbody>
    <tr><td>地理与势力</td><td>按区域和组织分类，便于查冲突。</td></tr>
    <tr><td>规则体系</td><td>把限制条件和例外写清楚。</td></tr>
    <tr><td>历史事件</td><td>结合时间线管理，减少年代错误。</td></tr>
    <tr><td>文化设定</td><td>和角色行为、对白风格一起核对。</td></tr>
  </tbody>
</table>
<h2>期望输出形态</h2>
<ul>
  <li>按类别返回结构化设定列表，而不是混成一段大文本。</li>
  <li>允许作者快速看到“已确认 / 待确认 / 互相冲突”的状态。</li>
  <li>在冲突场景下，能把相关章节或来源一起列出来便于核对。</li>
</ul>
<h3>端点</h3>
<pre><code>GET /m11/worldview
GET /m11/worldview/:category</code></pre>
  `},$=f(H,["worldview-extract","worldview-manage"],w),z={"agent-route":`
<h2>代理路由</h2>
<p>代理路由根据任务类型自动选择最合适的 AI 代理，避免用户手动判断该使用哪条能力链路。</p>
<h2>路由策略</h2>
<ul>
  <li><strong>写作任务</strong> → 写作代理。</li>
  <li><strong>分析任务</strong> → 分析代理。</li>
  <li><strong>修订任务</strong> → 修订代理。</li>
</ul>
<h2>路由时会考虑什么</h2>
<ul>
  <li>任务目标是生成、分析还是修订。</li>
  <li>上下文长度和复杂度。</li>
  <li>是否需要结构化输出。</li>
</ul>
<h2>路由决策图</h2>
<pre><code>flowchart TD
  Intent[用户请求] --> Type{目标类型}
  Type -->|生成草稿| Write[agent/write]
  Type -->|改已有文本| Revise[agent/revise]
  Type -->|需要更多背景| Context[agent/context]
  Type -->|先聊再决定| Chat[chat/chat-stream]
  Write --> Result[结果]
  Revise --> Result
  Context --> Result
  Chat --> Result</code></pre>
<h2>什么时候优先走代理路由</h2>
<table>
  <thead><tr><th>场景</th><th>原因</th><th>不建议的情况</th></tr></thead>
  <tbody>
    <tr><td>用户目标模糊</td><td>先澄清再决定能力。</td><td>已经明确知道要调用哪个 API。</td></tr>
    <tr><td>需要结合多个上下文源</td><td>可统一使用 Wiki、Memory、Graph。</td><td>只是做一次简单端点 smoke test。</td></tr>
    <tr><td>想从对话进入后续执行</td><td>便于接到 Workflow 或修订动作。</td><td>批量离线流程更适合专门 workflow。</td></tr>
  </tbody>
</table>
<h2>输入示例</h2>
<pre><code>{
  "intent": "我觉得这段对白太平，先帮我判断应该分析还是直接修订",
  "workspace": {}
}</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>返回优先能力，例如先走对话分析再修订。</li>
  <li>说明为什么这样路由，而不是只给一个端点名。</li>
  <li>必要时指出还缺哪些上下文。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /agent/route</code></pre>
  `,"agent-write":`
<h2>AI 写作</h2>
<p>AI 写作适合承担续写、扩写和改写等草稿生成任务。</p>
<h2>写作模式</h2>
<ul>
  <li><strong>续写</strong> — 延续当前叙事方向。</li>
  <li><strong>扩写</strong> — 对概要进行详细展开。</li>
  <li><strong>改写</strong> — 用不同风格重写段落。</li>
</ul>
<h2>使用建议</h2>
<ul>
  <li>给清晰的场景目标。</li>
  <li>加入角色关系、语气和节奏约束。</li>
  <li>把 AI 输出视为草稿候选。</li>
</ul>
<h2>推荐输入模板</h2>
<pre><code>目标：续写这一段并保持压抑气氛
角色约束：主角对父亲有防备心理
节奏要求：慢热，不要直接解释真相
禁止项：不要引入新设定</code></pre>
<h2>输出判读</h2>
<ul>
  <li>如果文本风格对，但设定跑偏，优先补 Wiki / 角色上下文。</li>
  <li>如果设定对，但节奏失控，优先缩小任务目标和场景边界。</li>
  <li>如果只是需要单句修饰，不一定要走完整写作链。</li>
</ul>
<h2>输入示例</h2>
<pre><code>目标：续写这一段，让角色表面冷静、实际慌乱
文本：林砚把门推开，看到桌上的信封时，脚步停住了。
约束：不要直接揭示信里内容</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>续写结果应延续当前紧张感。</li>
  <li>应通过动作或细节体现慌乱，而不是直接解释情绪。</li>
  <li>不应提前把信的秘密说明白。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /agent/write</code></pre>
  `,"agent-revise":`
<h2>AI 修订</h2>
<p>AI 修订关注已有文本的改进，而不是从零生成内容。</p>
<h2>修订类型</h2>
<ul>
  <li>润色 — 改善语言表达但不改变内容。</li>
  <li>精简 — 删除冗余内容。</li>
  <li>强化 — 增强情感冲击力。</li>
</ul>
<h2>使用建议</h2>
<p>修订前最好明确目标，例如“压缩 20%”“强化冲突”或“保持原风格但改善节奏”。</p>
<h2>修订闭环</h2>
<pre><code>flowchart LR
  Draft[原文] --> Goal[修订目标]
  Goal --> Revise[agent/revise]
  Revise --> Compare[人工比较]
  Compare --> Keep[采纳]
  Compare --> Retry[补充约束再修订]</code></pre>
<h2>适合的修订请求</h2>
<table>
  <thead><tr><th>目标</th><th>适合度</th><th>说明</th></tr></thead>
  <tbody>
    <tr><td>压缩冗余</td><td>高</td><td>边界清晰，容易比较前后差异。</td></tr>
    <tr><td>增强对白冲突</td><td>高</td><td>可结合角色声线约束。</td></tr>
    <tr><td>重做整章结构</td><td>中</td><td>更适合先分析再分段修订。</td></tr>
  </tbody>
</table>
<h2>输入示例</h2>
<pre><code>目标：压缩 20%，保留压迫感
文本：她反复看向门口，想起父亲临走前说过的话，心里像有一块石头压着。</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>文本更紧凑，但情绪压强不应被削平。</li>
  <li>不应无意改掉角色立场或情节事实。</li>
  <li>最好能保留可比较的修订前后差异。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /agent/revise</code></pre>
  `,"agent-context":`
<h2>上下文管理</h2>
<p>上下文管理负责为 AI 提供相关背景，而不是简单塞入更多文本。</p>
<h2>上下文来源</h2>
<ul>
  <li>当前文档前文。</li>
  <li>角色设定和关系图谱。</li>
  <li>世界观设定。</li>
  <li>写作风格画像。</li>
</ul>
<h2>设计原则</h2>
<ul>
  <li>相关性优先。</li>
  <li>保留当前任务必需信息。</li>
  <li>避免重复片段占用上下文窗口。</li>
</ul>
<h2>上下文装配顺序</h2>
<ol>
  <li>当前 selection 和邻近正文。</li>
  <li>当前章节摘要与项目目标。</li>
  <li>角色、设定、世界观等长期知识。</li>
  <li>必要时再补素材和历史对话。</li>
</ol>
<h2>失效征兆</h2>
<ul>
  <li>回答泛化，像通用写作建议而不是针对项目。</li>
  <li>引用旧设定，忽略最近晋升的 Wiki 页面。</li>
  <li>重复输入文本，浪费上下文窗口。</li>
</ul>
<h2>输入示例</h2>
<pre><code>{
  "selection": "他盯着那把黑色钥匙，突然想起母亲不许他进地下室。",
  "workspace": {}
}</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>上下文中应包含与地下室、母亲禁令、黑色钥匙相关的项目事实。</li>
  <li>不应把无关角色和无关章节都塞进上下文。</li>
  <li>若相关事实不足，应明确提示上下文稀薄。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /agent/context</code></pre>
  `,"chat-system":`
<h2>对话系统</h2>
<p>对话系统适合探索性写作、反复试探思路和逐步澄清问题。</p>
<h2>对话模式</h2>
<ul>
  <li><strong>普通对话</strong> — 一次性请求/响应。</li>
  <li><strong>流式对话</strong> — 实时流式输出。</li>
</ul>
<h2>适合的使用方式</h2>
<ul>
  <li>先分析一个问题，再继续追问原因。</li>
  <li>让 AI 提出多个方案，然后逐步收敛。</li>
  <li>把对话作为创作讨论区。</li>
</ul>
<h2>对话与工作流的边界</h2>
<p>对话系统适合探索、讨论和渐进式澄清；当任务已经收敛为一套明确步骤，例如“分析 -> 修订 -> 验证”，更适合切到 Workflow 或技能系统，而不是一直停留在聊天状态。</p>
<h2>推荐提问方式</h2>
<table>
  <thead><tr><th>目标</th><th>更好的提法</th></tr></thead>
  <tbody>
    <tr><td>找问题</td><td>“这段节奏最弱的两个点是什么，分别给证据。”</td></tr>
    <tr><td>想方案</td><td>“给我 3 种强化冲突的方法，保持人物设定不变。”</td></tr>
    <tr><td>做取舍</td><td>“比较方案 A 和 B，对当前章节哪种更稳妥，为什么。”</td></tr>
  </tbody>
</table>
<h2>输入示例</h2>
<pre><code>这段谈判戏的问题最可能出在哪两个地方？分别给证据，并告诉我应该先改哪一个。</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>返回两个优先问题，而不是泛泛罗列所有缺点。</li>
  <li>每个问题都带证据和改动方向。</li>
  <li>如果任务已收敛，应该提示切到修订或 workflow，而不是继续空聊。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /chat
POST /chat/stream</code></pre>
  `},K={"knowledge-base":`
<h2>写作知识库</h2>
<p>写作知识库把叙事技法、修辞手法、结构模式、类型惯例和项目素材组织成可检索知识。它是分析建议的基础来源，帮助系统把抽象判断连接到可解释的写作理论和文本证据。</p>
<pre><code>flowchart TB
  Books[写作理论 / 类型经验] --> Catalog[结构化知识目录]
  Catalog --> Rules[规则与检测器]
  Catalog --> Prompts[提示词与分析模板]
  Draft[当前正文] --> Analyzer[写作分析]
  Rules --> Analyzer
  Prompts --> Analyzer
  Analyzer --> Evidence[证据]
  Analyzer --> Advice[建议]</code></pre>
<h2>知识分类</h2>
<ul>
  <li>叙事技法：视角、时间、空间、节奏和信息控制。</li>
  <li>结构模式：三幕式、英雄之旅、悬疑设局解局、章节钩子。</li>
  <li>角色模型：角色原型、动机、弧线、声线和关系变化。</li>
  <li>类型惯例：文学小说、网文、剧本、悬疑、言情、奇幻等不同写法。</li>
  <li>项目知识：Story Bible、Wiki、素材、角色设定和世界观。</li>
</ul>
<h2>它如何影响分析</h2>
<p>知识库不会替作者做审美裁决，而是提供可解释参照：一个低分结论应该能指向某条规则、某段证据或某个项目设定。</p>
  `,"pattern-detection":`
<h2>模式检测</h2>
<p>模式检测用于识别文本中的写作技法和叙事模式。它会把原本隐性的写作手法转成可见标签，帮助作者理解文本具体使用了哪些表达策略。</p>
<pre><code>flowchart LR
  Text[正文片段] --> Features[特征抽取]
  Features --> Plot[情节模式]
  Features --> Character[角色原型]
  Features --> Suspense[悬疑 / 张力]
  Features --> Cliche[陈词滥调]
  Plot --> Report[模式报告]
  Character --> Report
  Suspense --> Report
  Cliche --> Report</code></pre>
<h2>检测能力</h2>
<ul>
  <li>情节模板：识别章节是否接近常见结构模式，并提示缺失环节。</li>
  <li>角色原型：检查角色功能、动机和弧线是否清晰。</li>
  <li>伏笔和呼应：标记埋设、推进、回收和悬而未决状态。</li>
  <li>节奏模式：观察铺垫、冲突、高潮和缓冲是否失衡。</li>
  <li>陈词滥调：按类型识别过度熟悉的桥段和表达。</li>
</ul>
<h2>使用建议</h2>
<p>模式检测的价值不是要求作品套模板，而是让作者知道自己正在使用哪种写法、哪里偏离预期，以及偏离是否是有意选择。</p>
  `,"dimension-scoring":`
<h2>维度评分系统</h2>
<p>维度评分把写作质量拆解为多个可比较指标，避免只给出笼统结论。它适合用来观察一个章节或片段在不同写作能力上的强弱分布。</p>
<pre><code>flowchart TD
  Analysis[分析任务] --> Narrative[叙事结构]
  Analysis --> Character[角色塑造]
  Analysis --> Scene[场景质量]
  Analysis --> Language[语言表现]
  Analysis --> Emotion[情感共鸣]
  Narrative --> Dashboard[WritingDashboard]
  Character --> Dashboard
  Scene --> Dashboard
  Language --> Dashboard
  Emotion --> Dashboard</code></pre>
<h2>评分维度</h2>
<table>
  <thead><tr><th>维度</th><th>关注点</th><th>常见证据</th></tr></thead>
  <tbody>
    <tr><td>叙事技巧</td><td>视角、节奏和结构控制</td><td>信息释放、转折、章节钩子。</td></tr>
    <tr><td>语言表现力</td><td>句式、词汇和修辞效果</td><td>重复表达、意象、动作描写。</td></tr>
    <tr><td>结构完整性</td><td>因果链、目标、阻碍和收束</td><td>目标缺失、转折无因、结尾悬空。</td></tr>
    <tr><td>角色塑造</td><td>行为、动机、弧线和声线</td><td>动机陈述、选择代价、对话区分度。</td></tr>
    <tr><td>情感共鸣</td><td>读者参与感和情绪推进</td><td>冲突升级、情绪铺垫、高潮兑现。</td></tr>
  </tbody>
</table>
<h2>评分的正确读法</h2>
<p>分数用于排序注意力，不是替代作者判断。最值得处理的是“低分 + 证据明确 + 影响当前目标”的维度。</p>
  `,"web-novel":`
<h2>网文分析</h2>
<p>网文分析针对网络小说的节奏、爽点、设定和追读动力进行评估。它更关注章节连续阅读体验，以及读者是否有足够动机继续下一章。</p>
<pre><code>flowchart LR
  Chapter[章节] --> Hook[开头钩子]
  Chapter --> Conflict[冲突升级]
  Chapter --> Payoff[爽点兑现]
  Chapter --> Cliffhanger[断章 / 期待]
  Hook --> Retention[追读动力]
  Conflict --> Retention
  Payoff --> Retention
  Cliffhanger --> Retention</code></pre>
<h2>核心指标</h2>
<ul>
  <li>爽点密度：高潮和满足感分布是否合理，是否过密或过稀。</li>
  <li>章节节奏：铺垫、冲突、兑现和断章是否形成连续阅读动力。</li>
  <li>金手指设计：主角优势是否有趣、可持续，并且仍有代价或限制。</li>
  <li>读者粘性：悬念、目标、情绪承诺和下一章期待是否明确。</li>
  <li>类型契约：是否满足当前题材读者的核心期待，同时保留差异化。</li>
</ul>
<h2>适用边界</h2>
<p>网文分析更适合连载节奏和商业类型写作。文学小说、散文或实验文本可以参考其中的节奏和期待管理，但不应照搬爽点模型。</p>
  `},Q={"material-upload":`
<h2>素材上传</h2>
<p>素材上传用于导入参考材料和写作素材，并建立后续检索基础。</p>
<pre><code>flowchart LR
  File[外部素材] --> Upload[memory/upload]
  Upload --> Parse[文本解析]
  Parse --> Index[索引 / 嵌入]
  Index --> Search[语义搜索]
  Search --> Agent[Agent / Writing / Wiki]</code></pre>
<ul>
  <li>纯文本。</li>
  <li>Markdown。</li>
  <li>PDF 文档。</li>
</ul>
<h2>导入建议</h2>
<ul>
  <li>把来源明确的资料单独上传，避免多个主题混在同一文件里。</li>
  <li>对长篇资料，优先保留标题、章节层级和来源信息。</li>
  <li>上传后若检索命中差，优先检查解析质量，而不是只怀疑搜索算法。</li>
</ul>
<h2>输入示例</h2>
<pre><code>素材文件：
- 雾港历史设定.md
- 林砚人物备忘录.pdf
- chapter-03-notes.txt</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>每份材料都被独立解析并保留来源。</li>
  <li>后续搜索结果能区分“来自正文”还是“来自外部素材”。</li>
  <li>若某份文件无法解析，应明确指出失败文件。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /memory/upload
POST /memory/add</code></pre>
  `,"semantic-search":`
<h2>语义搜索</h2>
<p>语义搜索基于向量嵌入，能够找到含义相关但关键词不完全一致的素材。</p>
<h2>搜索流程</h2>
<pre><code>sequenceDiagram
  participant User as User / Agent
  participant Query as Query Builder
  participant Memory as Memory Search
  participant Result as Ranked Results

  User->>Query: 输入问题或目标
  Query->>Memory: 发送语义检索请求
  Memory-->>Result: 返回相关片段
  Result-->>User: 展示素材、来源和排序</code></pre>
<ul>
  <li>语义相似度搜索。</li>
  <li>混合搜索。</li>
  <li>按标签或时间过滤。</li>
</ul>
<h2>什么时候它特别有用</h2>
<table>
  <thead><tr><th>场景</th><th>价值</th></tr></thead>
  <tbody>
    <tr><td>只记得大意，不记得关键词</td><td>能找回语义接近的设定或素材。</td></tr>
    <tr><td>想给 Agent 补项目证据</td><td>可把相关片段作为上下文，而不是整库塞入。</td></tr>
    <tr><td>长篇项目跨章节追设定</td><td>比人工翻查更快定位来源。</td></tr>
  </tbody>
</table>
<h2>结果判读</h2>
<p>语义相关不等于 canonical。检索结果是候选证据，若涉及核心设定，仍应与 Wiki / 作者确认事实交叉核对。</p>
<h2>输入示例</h2>
<pre><code>查询：那个和黑色钥匙有关、但没明说地下室秘密的片段</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>返回语义相关片段，而不是只做关键词命中。</li>
  <li>每条结果应带来源和排序。</li>
  <li>若涉及核心设定，应能继续跳向 Wiki 或正文核对。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /memory/search</code></pre>
  `,"temporal-query":`
<h2>时间线查询</h2>
<p>时间线查询用于按创建时间、修改时间或版本历史检索素材。它适合在长篇项目中回溯某段设定、素材或草稿最早出现的位置。</p>
<h2>查询维度</h2>
<ul>
  <li>创建时间：按素材首次加入时间筛选。</li>
  <li>修改时间：查看近期变动内容。</li>
  <li>版本历史：追踪内容的演变过程。</li>
</ul>
<h2>适合的排查问题</h2>
<ul>
  <li>这个设定最早在哪一章或哪份素材里出现。</li>
  <li>某个角色关系是什么时候被改写的。</li>
  <li>最近一次影响当前分析结论的资料变动来自哪里。</li>
</ul>
<h2>与语义搜索的区别</h2>
<table>
  <thead><tr><th>能力</th><th>时间线查询</th><th>语义搜索</th></tr></thead>
  <tbody>
    <tr><td>主维度</td><td>时间与演变</td><td>语义相关性</td></tr>
    <tr><td>更适合</td><td>回溯来源与变化</td><td>找相近内容</td></tr>
    <tr><td>常见使用者</td><td>维护者、长篇作者</td><td>作者、Agent、分析链路</td></tr>
  </tbody>
</table>
<h2>输入示例</h2>
<pre><code>问题：黑色钥匙这个设定最早在哪份材料里出现，后来被哪些章节改写过？</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>按时间顺序列出首次出现、后续变动和最近引用。</li>
  <li>能看出变化轨迹，而不是只返回零散片段。</li>
  <li>若资料不足，应提示时间线不完整。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /memory/temporal</code></pre>
  `},X={"editor-integration":`
<h2>编辑器集成</h2>
<p>Niko Studio 的编辑器不是孤立输入框，而是写作工作台的中心：左侧负责进入作品与文档，中间负责正文创作，右侧负责 AI 执行、证据展示和知识沉淀。</p>
<pre><code>flowchart LR
  Sidebar[项目 / 文档入口] --> Editor[正文编辑器]
  Editor --> Toolbar[AI 意图选择]
  Toolbar --> Panel[右侧执行面板]
  Panel --> Evidence[证据 / 建议 / 修订]
  Evidence --> Editor
  Editor --> Export[导出与交付]</code></pre>
<h2>编辑器特性</h2>
<ul>
  <li>正文写作、选择文本、触发 AI 意图和接收修订结果在同一工作区完成。</li>
  <li>字数统计、章节进度和当前文档状态帮助作者保持创作节奏。</li>
  <li>右侧面板把分析结果拆成分数、证据、建议和下一步动作。</li>
  <li>Story Bible / Wiki 为长期项目提供人物、设定和素材上下文。</li>
</ul>
<h2>典型用户路径</h2>
<ol>
  <li>在左侧选择作品和章节。</li>
  <li>在编辑器中写入正文或选择片段。</li>
  <li>选择扩写、润色、分析、检查一致性等意图。</li>
  <li>在右侧查看证据和建议，决定是否回填正文。</li>
  <li>保存、继续写作或导出。</li>
</ol>
<h2>UI 控制链</h2>
<pre><code>sequenceDiagram
  participant User as 写作者
  participant Editor as 编辑器
  participant Panel as 右侧面板
  participant Service as 前端 Service
  participant Gateway as Gateway

  User->>Editor: 输入正文 / 选中段落
  User->>Panel: 选择分析或修订动作
  Panel->>Service: 发起带 selection 的请求
  Service->>Gateway: 发送 intent + workspace
  Gateway-->>Service: 返回 evidence + suggestion
  Service-->>Panel: 渲染卡片和建议
  Panel-->>Editor: 回填或定位到原文</code></pre>
<h2>边界说明</h2>
<table>
  <thead><tr><th>位置</th><th>负责内容</th><th>不负责内容</th></tr></thead>
  <tbody>
    <tr><td>编辑器</td><td>正文输入、选区表达、定位和回填。</td><td>模型协议、上下文检索。</td></tr>
    <tr><td>右侧面板</td><td>结果展示、建议选择、动作编排。</td><td>决定底层调用哪种 provider。</td></tr>
    <tr><td>Service 层</td><td>把 UI 意图翻译为 Gateway 请求。</td><td>保存长期 canon。</td></tr>
    <tr><td>Gateway</td><td>上下文、模型、规则和结构化结果。</td><td>替作者自动接受建议。</td></tr>
  </tbody>
</table>
<h2>输入示例场景</h2>
<pre><code>用户动作：
1. 在编辑器中选中 3 段对白
2. 点击“分析对白”
3. 打开右侧面板查看结果</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>右侧面板应显示与当前 selection 对应的分析，而不是整章泛评。</li>
  <li>结果应可回跳到原文位置。</li>
  <li>若 selection 失效，应有明确提示而不是静默失败。</li>
</ul>
<h2>故障排查</h2>
<ul>
  <li>编辑器没有响应时，先确认当前项目和文档是否已打开。</li>
  <li>右侧面板无结果时，检查 Gateway 健康状态和模型配置。</li>
  <li>建议无法回填时，确认当前 selection 是否仍存在于正文中。</li>
</ul>
<h2>相关页面</h2>
<p>继续阅读：能力路由指南、Gateway API、健康检查、写作面板。</p>
  `,"writing-dashboard":`
<h2>写作面板</h2>
<p>WritingDashboard 用于展示多维度分析结果，让用户从总览进入细节，再回到正文修订。它的核心价值是把“AI 觉得不好”变成“哪个维度、哪段文本、为什么、怎么改”。</p>
<pre><code>flowchart TD
  Result[分析结果] --> Overview[总览分数]
  Result --> Dimensions[维度卡片]
  Dimensions --> Evidence[文本证据]
  Evidence --> Suggestion[修订建议]
  Suggestion --> Revision[回到正文修改]
  Revision --> Result</code></pre>
<h2>核心价值</h2>
<ul>
  <li>组织分散的分析结果，避免只给一段泛泛评价。</li>
  <li>快速看到问题集中在哪些维度，例如结构、角色、场景、语言或节奏。</li>
  <li>支持从概览跳到具体证据，让作者知道该改哪一段。</li>
  <li>把知识引擎、规则检测和 LLM 建议统一成可读结果。</li>
</ul>
<h2>阅读面板的顺序</h2>
<ol>
  <li>先看总分和低分维度，不急着改全文。</li>
  <li>再看证据片段，确认系统判断是否命中真实问题。</li>
  <li>最后选择一个建议执行，重新分析验证变化。</li>
</ol>
<h2>面板结构图</h2>
<pre><code>flowchart LR
  Overview[总览分数] --> Dimensions[维度列表]
  Dimensions --> Evidence[证据片段]
  Dimensions --> Diagnosis[原因解释]
  Diagnosis --> Suggestion[修订建议]
  Suggestion --> Action[应用 / 忽略 / 继续追问]
  Action --> Recheck[重新分析]</code></pre>
<h2>什么结果值得优先看</h2>
<table>
  <thead><tr><th>信号</th><th>含义</th><th>建议动作</th></tr></thead>
  <tbody>
    <tr><td>低分维度集中</td><td>问题可能不是局部措辞，而是结构层面。</td><td>先看该维度的证据与解释。</td></tr>
    <tr><td>证据片段重复命中同一区域</td><td>说明问题高度局部化。</td><td>优先小范围修改并复检。</td></tr>
    <tr><td>建议很泛</td><td>上下文或任务目标不够清晰。</td><td>补充意图、选区或相关设定后再跑。</td></tr>
  </tbody>
</table>
<h2>输入示例场景</h2>
<pre><code>当前问题：章节开头 600 字读起来发闷
操作：在写作面板查看总分、低分维度和证据片段</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>总览先暴露最低分维度。</li>
  <li>证据片段应命中开头区域，而不是跳去章节后半段。</li>
  <li>建议应可转成下一步修订动作。</li>
</ul>
  `,"local-storage":`
<h2>本地存储</h2>
<p>所有写作数据默认围绕本地工作区组织，减少外部服务对创作流程的影响。AI 调用可以是外部的，但作品、素材、缓存和配置应有清晰的本地边界。</p>
<pre><code>flowchart TB
  Workspace[作品工作区] --> Drafts[正文 / 章节]
  Workspace --> Materials[素材与参考]
  Workspace --> Cache[分析缓存]
  Workspace --> Settings[项目配置]
  Workspace --> Wiki[Wiki / Story Bible]
  Cache --> Dashboard[写作面板]</code></pre>
<h2>存储对象</h2>
<ul>
  <li><strong>项目文件</strong> — 原始文本、章节结构和项目元数据。</li>
  <li><strong>分析缓存</strong> — 已完成的分析结果，用于减少重复调用成本。</li>
  <li><strong>知识索引</strong> — 素材、设定、角色和 Wiki 条目的检索索引。</li>
  <li><strong>用户配置</strong> — 模型、偏好、工作区和界面设置。</li>
</ul>
<h2>使用建议</h2>
<p>本地优先不等于不需要备份。长篇项目建议使用稳定目录，并定期通过系统备份、版本管理或云盘同步工作区。</p>
<h2>哪些内容应该长期保留</h2>
<ul>
  <li>正文、章节结构和项目元数据应视为主数据。</li>
  <li>Wiki / Story Bible 属于长期知识层，应和正文一起备份。</li>
  <li>分析缓存可以重建，但在长篇项目里保留缓存能提升交互速度。</li>
  <li>配置和模型偏好需要区分“项目级”与“用户级”作用域。</li>
</ul>
<h2>迁移边界</h2>
<p>如果你只是把项目迁移到另一台机器，优先迁移 workspace、素材和 Wiki；缓存和局部索引可以后建。不要把临时运行状态误当成必须随项目漫游的数据。</p>
<h2>输入示例场景</h2>
<pre><code>迁移目标：
- 把一个长篇项目从电脑 A 迁到电脑 B
- 保留正文、Wiki、素材
- 不要求保留所有缓存</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>主数据应明确包括 workspace、素材和 Wiki。</li>
  <li>缓存和索引应被识别为可重建项。</li>
  <li>迁移说明应明确哪些内容是项目级，哪些是用户级。</li>
</ul>
  `,"llm-integration":`
<h2>LLM 集成</h2>
<p>Niko Studio 通过 Gateway 接入大语言模型。前端只表达用户意图和当前上下文，Gateway 负责模型配置、流式输出、错误处理和结果结构化。</p>
<pre><code>sequenceDiagram
  participant UI as Desktop UI
  participant G as Gateway
  participant C as Context Builder
  participant L as LLM Provider
  participant P as Result Parser

  UI->>G: intent + selection + workspace
  G->>C: 组装作品、素材、Wiki 与偏好
  C-->>G: 最小必要上下文
  G->>L: chat / stream / analyze
  L-->>G: tokens 或完整响应
  G->>P: 解析为结构化结果
  P-->>UI: evidence + suggestion + actions</code></pre>
<h2>支持的接入方式</h2>
<ul>
  <li>云端模型 — 适合复杂推理、长文本理解和高质量修订。</li>
  <li>本地模型 — 适合隐私优先、离线优先或低成本草稿任务。</li>
  <li>混合策略 — 轻量任务走本地模型，复杂任务走高质量云端模型。</li>
</ul>
<h2>结果约束</h2>
<p>模型输出不会直接等同于最终修改。写作面板会尽量把结果拆成证据、判断和建议，作者仍然保留取舍权。</p>
<h2>请求分层</h2>
<table>
  <thead><tr><th>层</th><th>内容</th><th>示例</th></tr></thead>
  <tbody>
    <tr><td>Intent</td><td>用户到底想写、改、查还是评估。</td><td>扩写场景、检查节奏、润色对白。</td></tr>
    <tr><td>Context</td><td>当前正文、选区、Wiki、素材、风格约束。</td><td>角色关系、章节摘要、设定条目。</td></tr>
    <tr><td>Provider Call</td><td>模型或规则的真实执行。</td><td>chat、stream、analyze。</td></tr>
    <tr><td>Normalization</td><td>把响应变成 UI 可消费格式。</td><td>score、evidence、suggestion。</td></tr>
  </tbody>
</table>
<h2>输入示例场景</h2>
<pre><code>intent: 强化这段追逐戏的压迫感
selection: 主角翻墙逃跑的 500 字
workspace: 当前项目 + 角色设定 + 世界观限制</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>结果应拆成 evidence、suggestion、可选动作，而不是直接一整段改写。</li>
  <li>若使用流式输出，应有清晰的完成信号。</li>
  <li>若模型不可用，应能退回到明确的错误说明或降级路径。</li>
</ul>
<h2>故障排查</h2>
<ul>
  <li>模型不可见：检查 <code>GET /models</code> 和配置 API。</li>
  <li>流式输出中断：检查 Gateway 日志、网络代理和 provider 限流。</li>
  <li>建议缺少上下文：确认 workspace、Wiki、Memory 是否已提供必要素材。</li>
</ul>
<h2>相关页面</h2>
<p>继续阅读：Gateway API、配置 API、健康检查、能力路由指南。</p>
  `,"plugin-system":`
<h2>插件系统</h2>
<p>插件系统用于扩展分析、导出和主题能力。它适合把团队或个人的固定写作流程封装成可复用能力，而不是把所有逻辑都塞进核心应用。</p>
<h2>插件类型</h2>
<ul>
  <li><strong>分析插件</strong> — 添加自定义分析维度或类型规则。</li>
  <li><strong>导出插件</strong> — 支持更多交付格式和发布目标。</li>
  <li><strong>主题插件</strong> — 自定义编辑器外观和阅读环境。</li>
  <li><strong>工作流插件</strong> — 串联分析、修订、检查和导出步骤。</li>
</ul>
<h2>边界原则</h2>
<p>插件应复用工作区上下文和 Gateway 能力，不应绕过配置、权限和健康检查边界。</p>
<h2>插件执行链</h2>
<pre><code>flowchart LR
  User[用户动作] --> UI[插件入口]
  UI --> Gateway[插件 API]
  Gateway --> Context[Workspace / Config]
  Context --> Plugin[Plugin Runtime]
  Plugin --> Output[分析结果 / 导出文件 / UI 响应]</code></pre>
<h2>适合做成插件的场景</h2>
<ul>
  <li>团队私有的导出格式或发布流程。</li>
  <li>项目专属的质量检查或章节模板。</li>
  <li>不适合进入核心应用，但需要稳定复用的自定义能力。</li>
</ul>
<h2>输入示例场景</h2>
<pre><code>插件目标：导出“章节摘要 + 人物关系表 + 待回收伏笔”成团队审稿包</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>输出应是明确的导出结果或结构化报告。</li>
  <li>执行过程应复用 workspace 和 Gateway，而不是直接绕系统边界访问文件。</li>
  <li>失败时应指出是插件逻辑、上下文还是权限问题。</li>
</ul>
  `,"skill-system":`
<h2>技能系统</h2>
<p>技能系统用于创建、加载、匹配和组合自定义写作技能。它把常用提示词、分析规则和执行步骤收束为稳定入口。</p>
<pre><code>flowchart LR
  Intent[用户意图] --> Match[技能匹配]
  Match --> Context[上下文组装]
  Context --> Execute[执行技能]
  Execute --> Result[结构化结果]
  Result --> Chain[继续链式调用]</code></pre>
<h2>技能操作</h2>
<ul>
  <li>列表、加载、匹配。</li>
  <li>链式调用，把“分析 -> 修订 -> 检查”组织成稳定流程。</li>
  <li>创建、保存、删除个人或团队技能。</li>
</ul>
<pre><code>---
name: chapter-hook-check
description: 检查章节开头钩子、冲突和追读动力
---</code></pre>
<h2>适合封装成技能的任务</h2>
<ul>
  <li>固定类型的章节检查。</li>
  <li>特定作者风格的润色。</li>
  <li>网文节奏、爽点和断章检查。</li>
  <li>角色对话声线一致性检查。</li>
</ul>
<h2>技能与插件的区别</h2>
<table>
  <thead><tr><th>能力</th><th>技能</th><th>插件</th></tr></thead>
  <tbody>
    <tr><td>侧重点</td><td>提示词、规则和调用链编排。</td><td>系统扩展、导出、能力接入。</td></tr>
    <tr><td>更适合谁</td><td>写作者、提示词工程、团队流程维护者。</td><td>开发者、集成者。</td></tr>
    <tr><td>变更成本</td><td>较低。</td><td>较高，通常涉及更多系统边界。</td></tr>
  </tbody>
</table>
<h2>输入示例场景</h2>
<pre><code>技能目标：固定检查“开头钩子 + 对白张力 + 悬念保留”
调用方式：链式执行 3 个技能，最后汇总结果</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>每一步都应产出可继续传递的结构化结果。</li>
  <li>最终输出应是汇总建议，而不是 3 段彼此无关的评论。</li>
  <li>若其中一步缺上下文，应明确指出链路在哪断了。</li>
</ul>
  `,"wiki-system":`
<h2>Wiki 系统</h2>
<p>Wiki 系统用于管理知识条目和长期沉淀内容。它的目标是把临时聊天结论、素材发现和作者决策晋升为可追踪的作品知识，而不是让设定散落在对话记录里。</p>
<pre><code>flowchart TD
  Raw[原始素材 / 草稿 / 对话] --> Promote[人工确认晋升]
  Promote --> Canon[Canon Wiki Page]
  Canon --> StoryBible[Story Bible]
  Canon --> Graph[图谱投影]
  Canon --> Memory[语义检索]
  Graph --> UI[关系和伏笔视图]
  Memory --> AI[上下文注入]</code></pre>
<h2>核心概念</h2>
<ul>
  <li><strong>Raw evidence</strong> — 原始文本、素材和作者明确决策。</li>
  <li><strong>Promoted canon</strong> — 经过确认后进入 Wiki 的长期设定。</li>
  <li><strong>Projection</strong> — 图谱和语义索引是投影层，不应覆盖作者确认的 canon。</li>
</ul>
<h2>功能</h2>
<ul>
  <li>知识晋升。</li>
  <li>条目列表。</li>
  <li>页面读取。</li>
  <li>为 Agent、图谱和素材搜索提供长期上下文。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /wiki/promote
GET  /wiki/list
GET  /wiki/page/:id</code></pre>
<h2>故障排查</h2>
<ul>
  <li>Wiki 内容与图谱不一致时，以作者确认的 Wiki / canon 页面为准。</li>
  <li>页面读取失败时，先确认条目是否已晋升，再检查 <code>GET /wiki/list</code>。</li>
  <li>Agent 没有使用最新设定时，刷新 workspace context 和 Memory 检索。</li>
</ul>
<h2>相关页面</h2>
<p>继续阅读：能力路由指南、素材 API、Wiki API、图谱 API。</p>
<h2>输入示例场景</h2>
<pre><code>待晋升事实：林砚怕深水，但在危机中会强撑镇定
来源：chapter-03 + 作者确认备注</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>形成稳定可查询的 Wiki 条目。</li>
  <li>后续 Agent、Graph、Memory 都能引用到这条事实。</li>
  <li>若与旧条目冲突，应提示核对而不是静默覆盖。</li>
</ul>
  `,"narrative-visualization":`
<h2>叙事可视化</h2>
<p>叙事可视化提供三种交互式图表，帮助作者从视觉角度理解故事的节奏、张力变化和角色关系网络。</p>
<h2>可视化组件</h2>
<ul>
  <li><strong>TimelineView</strong> — 故事时间线视图，支持缩放和事件过滤。按时间轴展示章节推进、事件分布和节奏波动。</li>
  <li><strong>TensionCurveView</strong> — 张力曲线视图，展示情绪和冲突强度的起伏轨迹。帮助判断高潮是否有足够铺垫，低谷是否过长。</li>
  <li><strong>CharacterGraphView</strong> — 角色关系图谱视图，支持交互式节点点击、关系过滤和角色信息面板。展示角色间的关系类型和强度。</li>
</ul>
<h2>使用场景</h2>
<ul>
  <li>检查整本书的节奏分布：是否有中段塌陷、高潮堆叠或尾部乏力。</li>
  <li>定位张力断点：曲线平缓段往往对应需要增加冲突或悬念的区域。</li>
  <li>可视化角色关系网络：确认核心角色之间的连接是否足够紧密，边缘角色是否孤立。</li>
</ul>
<h2>数据来源</h2>
<p>可视化图表的数据来自 Gateway 的叙事分析结果。TimelineView 使用章节事件数据，TensionCurveView 使用情感弧线分析结果，CharacterGraphView 使用角色关系图谱。</p>
<h2>Related Endpoints</h2>
<ul>
  <li><a href="/api/writing-api">写作 API</a>：触发叙事分析获取可视化数据。</li>
  <li><a href="/writing/emotional-arc">情感弧线</a>：张力曲线的分析基础。</li>
  <li><a href="/graph/character-relationships">角色关系</a>：角色图谱的分析基础。</li>
</ul>
  `,"niko-editor":`
<h2>Niko 编辑器</h2>
<p>NikoEditor 是基于 TipTap（ProseMirror）的富文本编辑器，是所有写作操作的核心工作区。它支持 Markdown 风格输入、Slash 命令、AI 辅助和专业排版扩展。</p>
<h2>核心功能</h2>
<ul>
  <li><strong>富文本编辑</strong> — 粗体、斜体、删除线、标题、引用、代码块、表格、数学公式（LaTeX）和 Callout 框。</li>
  <li><strong>BubbleToolbar</strong> — 选中文本后弹出浮动工具栏，包含格式按钮和 AI 重写子菜单。</li>
  <li><strong>SlashCommandMenu</strong> — 输入 <code>/</code> 触发命令菜单，支持 AI 命令（生成、续写、完整文章）和格式块命令（标题、列表、引用、代码、表格、数学、Callout）。</li>
  <li><strong>Show/Tell 标记</strong> — 左上角切换按钮，高亮文中"展示"与"讲述"段落，辅助沉浸感判断。</li>
  <li><strong>AI 生成指示器</strong> — 右上角实时显示 AI 生成状态，支持一键取消。</li>
  <li><strong>快捷键</strong> — <code>Ctrl+S</code> 保存，<code>Ctrl+/</code> 打开快捷键面板。</li>
</ul>
<h2>交互流程</h2>
<pre><code>flowchart LR
  Start[开始写作] --> Input[输入正文]
  Input --> Select{选中文本?}
  Select -->|是| Bubble[BubbleToolbar: 格式 / AI重写]
  Select -->|否| Slash[输入 / 触发 SlashCommandMenu]
  Bubble --> AIAction[执行 AI 操作]
  Slash --> AIAction
  AIAction --> Result[结果插入编辑器]
  Result --> Continue[继续写作]</code></pre>
<h2>Slash 命令列表</h2>
<table>
  <thead><tr><th>命令</th><th>类型</th><th>说明</th></tr></thead>
  <tbody>
    <tr><td>/ai-generate</td><td>AI</td><td>根据当前上下文生成新内容</td></tr>
    <tr><td>/ai-continue</td><td>AI</td><td>续写当前段落</td></tr>
    <tr><td>/ai-full-article</td><td>AI</td><td>生成完整文章草稿</td></tr>
    <tr><td>/heading</td><td>格式</td><td>插入标题</td></tr>
    <tr><td>/bullet-list</td><td>格式</td><td>插入无序列表</td></tr>
    <tr><td>/ordered-list</td><td>格式</td><td>插入有序列表</td></tr>
    <tr><td>/blockquote</td><td>格式</td><td>插入引用块</td></tr>
    <tr><td>/code-block</td><td>格式</td><td>插入代码块</td></tr>
    <tr><td>/table</td><td>格式</td><td>插入表格</td></tr>
    <tr><td>/math-inline</td><td>格式</td><td>插入行内数学公式</td></tr>
    <tr><td>/math-block</td><td>格式</td><td>插入块级数学公式</td></tr>
    <tr><td>/callout</td><td>格式</td><td>插入 Callout 提示框</td></tr>
  </tbody>
</table>
<h2>BubbleToolbar 操作</h2>
<ul>
  <li><strong>格式按钮</strong> — 粗体（B）、斜体（I）、删除线（S），当前激活状态高亮显示。</li>
  <li><strong>AI 重写</strong> — 点击魔法棒图标展开重写选项列表，选择后对选中段落执行 AI 重写。</li>
  <li><strong>AI 续写</strong> — 点击续写按钮，AI 将在选中文本末尾继续生成内容。</li>
</ul>
<h2>使用建议</h2>
<ul>
  <li>写作时直接输入文本，无需手动保存——编辑器会在 1.5 秒无操作后自动保存。</li>
  <li>使用 Slash 命令快速插入格式块，比手动切换格式更高效。</li>
  <li>选中文本后通过 BubbleToolbar 进行 AI 重写，可针对特定段落精准优化。</li>
  <li>开启 Show/Tell 标记可直观判断哪些段落需要"展示化"改写。</li>
</ul>
<h2>故障排查</h2>
<ul>
  <li>编辑器无法输入：检查当前项目与章节是否已选中。</li>
  <li>Slash 命令菜单未出现：确认在空行或段落末尾输入 <code>/</code>。</li>
  <li>AI 操作无响应：检查 Gateway 连接状态和模型配置。</li>
</ul>
<h2>相关页面</h2>
<p>继续阅读：<a href="/desktop/bubble-toolbar">BubbleToolbar</a>、<a href="/desktop/slash-command-menu">SlashCommandMenu</a>、<a href="/desktop/editor-integration">编辑器集成</a>。</p>
  `,"bubble-toolbar":`
<h2>BubbleToolbar 浮动工具栏</h2>
<p>BubbleToolbar 是选中文本时弹出的浮动格式与 AI 操作工具栏。它将常用格式操作和 AI 重写功能合并在一个紧凑的面板中，避免写作时频繁切换面板。</p>
<h2>界面元素</h2>
<ul>
  <li><strong>粗体按钮（B）</strong> — 切换选中文字粗体，激活时高亮显示。</li>
  <li><strong>斜体按钮（I）</strong> — 切换选中文字斜体。</li>
  <li><strong>删除线按钮（S）</strong> — 切换选中文字删除线。</li>
  <li><strong>分隔线</strong> — 视觉分隔格式操作和 AI 操作。</li>
  <li><strong>AI 重写按钮</strong> — 魔法棒图标 + 展开箭头，点击展开重写选项下拉菜单。</li>
  <li><strong>AI 续写按钮</strong> — 续写图标，点击后在选中文本末尾继续生成。</li>
</ul>
<h2>AI 重写选项</h2>
<p>AI 重写下拉菜单根据 <code>editorAIPromptPolicy</code> 配置显示可用的重写策略，常见选项包括：</p>
<ul>
  <li>润色 — 在保持原意的前提下改善措辞。</li>
  <li>简化 — 压缩冗余表达，提升信息密度。</li>
  <li>扩写 — 在关键细节处增加描写深度。</li>
  <li>改变语气 — 调整叙事语气（紧张、温暖、幽默等）。</li>
</ul>
<h2>使用方法</h2>
<ol>
  <li>在编辑器中选中一段文本。</li>
  <li>BubbleToolbar 自动浮现在选区上方。</li>
  <li>点击格式按钮进行快速格式化，或点击 AI 重写展开选项。</li>
  <li>选择重写策略后，AI 会替换选中文本，同时自动撤销栈保留原文。</li>
</ol>
<h2>注意事项</h2>
<ul>
  <li>取消选中文本后工具栏自动关闭。</li>
  <li>AI 操作可能需要数秒，期间编辑器顶部会显示生成指示器。</li>
  <li>所有 AI 修改均可通过 <code>Ctrl+Z</code> 撤销。</li>
</ul>
<h2>相关页面</h2>
<p>继续阅读：<a href="/desktop/niko-editor">Niko 编辑器</a>、<a href="/desktop/slash-command-menu">SlashCommandMenu</a>。</p>
  `,"slash-command-menu":`
<h2>SlashCommandMenu 斜杠命令菜单</h2>
<p>SlashCommandMenu 是编辑器中输入 <code>/</code> 触发的浮动命令面板。它将 AI 写作命令和格式块命令统一在一个可搜索的列表中，支持键盘导航和模糊过滤。</p>
<h2>界面元素</h2>
<ul>
  <li><strong>命令列表</strong> — 每项包含图标、标签、描述文字。AI 命令额外显示"AI"徽章。</li>
  <li><strong>搜索过滤</strong> — 在 <code>/</code> 后继续输入文字，菜单自动过滤匹配项。</li>
  <li><strong>键盘导航</strong> — 上下箭头切换选中项，回车确认选择，Escape 关闭菜单。</li>
  <li><strong>点击选择</strong> — 鼠标点击项目直接执行。</li>
  <li><strong>点击外部关闭</strong> — 点击菜单外部区域关闭菜单。</li>
</ul>
<h2>命令分类</h2>
<table>
  <thead><tr><th>分类</th><th>命令示例</th><th>说明</th></tr></thead>
  <tbody>
    <tr><td>AI 写作</td><td>AI 生成、AI 续写、完整文章</td><td>调用 Gateway 执行 AI 创作任务</td></tr>
    <tr><td>标题</td><td>H1、H2、H3</td><td>插入不同级别标题</td></tr>
    <tr><td>列表</td><td>无序列表、有序列表</td><td>插入列表结构</td></tr>
    <tr><td>引用</td><td>引用块</td><td>插入blockquote</td></tr>
    <tr><td>代码</td><td>代码块</td><td>插入代码块</td></tr>
    <tr><td>表格</td><td>表格</td><td>插入表格结构</td></tr>
    <tr><td>数学</td><td>行内公式、块级公式</td><td>插入LaTeX数学表达式</td></tr>
    <tr><td>提示</td><td>Callout</td><td>插入提示框组件</td></tr>
  </tbody>
</table>
<h2>使用方法</h2>
<ol>
  <li>在编辑器空行或段落末尾输入 <code>/</code>。</li>
  <li>菜单弹出，浏览可用命令或输入关键词过滤。</li>
  <li>用箭头键或鼠标选择目标命令，按回车或点击执行。</li>
  <li>命令执行后菜单自动关闭，内容插入到编辑器。</li>
</ol>
<h2>使用技巧</h2>
<ul>
  <li>输入 <code>/h</code> 快速过滤到标题命令。</li>
  <li>输入 <code>/ai</code> 快速定位 AI 写作命令。</li>
  <li>AI 命令会利用当前编辑器上下文（已写内容、项目设定等）生成相关内容。</li>
</ul>
<h2>相关页面</h2>
<p>继续阅读：<a href="/desktop/niko-editor">Niko 编辑器</a>、<a href="/desktop/bubble-toolbar">BubbleToolbar</a>。</p>
  `,"chat-area":`
<h2>对话区（ChatArea）</h2>
<p>ChatArea 是 Niko Studio 的 AI 对话界面，负责管理对话消息流、模式控制、快捷操作和草稿编辑。它将聊天交互与写作工作流无缝衔接。</p>
<h2>界面结构</h2>
<pre><code>flowchart TB
  Top[ChatMessageList: 消息列表 + 流式内容] --> Middle[中间操作栏]
  Middle --> Inline[ChatAreaInlineActions: 继续/修改/生成]
  Middle --> Context[ChatContextBar: 上下文信息]
  Middle --> Mode[ChatAreaModeControls: 模式与预设]
  Middle --> Status[ChatAreaStreamStatus: 错误/恢复通知]
  Bottom[ChatAreaComposer: 输入框 + 操作按钮]</code></pre>
<h2>核心功能</h2>
<ul>
  <li><strong>消息列表</strong> — 显示用户消息和 AI 回复，支持流式内容渲染、启动操作和模式预设展示。</li>
  <li><strong>模式控制</strong> — 支持 chat（对话）和 agent（代理）两种模式，agent 模式可选择 write/revise/context 操作。</li>
  <li><strong>模式预设</strong> — 专注写作、代理诊断、比较评审三种快捷预设，一键切换模式 + 技能组合。</li>
  <li><strong>技能包</strong> — 可展开的技能选择面板，每个技能以切换按钮呈现，最多显示 8 个技能。</li>
  <li><strong>模型比较</strong> — 可启用双模型对比评审，同时输出两个模型的回复进行比较。</li>
  <li><strong>快捷操作</strong> — QuickRollback（快速回滚）、InlineActions（继续/修改/生成）。</li>
  <li><strong>草稿管理</strong> — 输入框内容自动缓存为草稿，支持恢复和清除。</li>
  <li><strong>错误恢复</strong> — 流式请求失败时显示错误状态和重试按钮，支持恢复中断的会话。</li>
</ul>
<h2>ChatAreaComposer 功能</h2>
<ul>
  <li>自适应高度的文本输入框（3-8 行），支持拖放文件上传。</li>
  <li>附件按钮（上传文件）、知识面板切换按钮、清除草稿按钮、复制上次回复按钮。</li>
  <li>发送按钮（正常状态）/ 取消按钮（加载状态）。</li>
  <li>快捷方式提示文本。</li>
</ul>
<h2>使用方法</h2>
<ol>
  <li>在输入框输入消息或拖入参考文件。</li>
  <li>选择对话模式（chat 对话 / agent 代理）和操作类型。</li>
  <li>可选：启用技能包和模型比较功能。</li>
  <li>点击发送或使用快捷键提交。</li>
  <li>查看 AI 回复，使用快捷操作（继续、修改、回滚）调整结果。</li>
</ol>
<h2>模式说明</h2>
<table>
  <thead><tr><th>模式</th><th>适用场景</th><th>操作</th></tr></thead>
  <tbody>
    <tr><td>Chat</td><td>自由提问、讨论思路</td><td>普通对话</td></tr>
    <tr><td>Agent · Write</td><td>AI 辅助创作新内容</td><td>扩写、续写、完整文章</td></tr>
    <tr><td>Agent · Revise</td><td>AI 辅助修改现有段落</td><td>润色、改写、风格调整</td></tr>
    <tr><td>Agent · Context</td><td>AI 辅助查找上下文信息</td><td>角色查询、设定检索</td></tr>
  </tbody>
</table>
<h2>故障排查</h2>
<ul>
  <li>发送无响应：检查 Gateway 连接和模型配置。</li>
  <li>流式输出中断：网络不稳定时可使用恢复按钮继续。</li>
  <li>草稿未恢复：确认浏览器 localStorage 是否可用。</li>
</ul>
<h2>相关页面</h2>
<p>继续阅读：<a href="/agent/chat-system">对话系统</a>、<a href="/desktop/chat-area-composer">ChatAreaComposer</a>、<a href="/desktop/chat-area-mode-controls">ChatAreaModeControls</a>。</p>
  `,"chat-area-composer":`
<h2>ChatAreaComposer 对话输入框</h2>
<p>ChatAreaComposer 是 ChatArea 底部的输入与操作组件。它集成了文本编辑、文件上传、快捷操作和草稿管理，是对话交互的主要入口。</p>
<h2>界面布局</h2>
<pre><code>flowchart LR
  TextArea[自适应文本框] --> Actions[操作按钮组]
  Actions --> Attach[附件按钮]
  Actions --> Knowledge[知识面板切换]
  Actions --> Clear[清除草稿]
  Actions --> Copy[复制上次回复]
  Actions --> Send[发送/取消]</code></pre>
<h2>功能说明</h2>
<ul>
  <li><strong>文本输入框</strong> — 最小 3 行，最大 8 行，高度 72-200px 自动调整。支持拖放文件上传（显示覆盖层提示）。</li>
  <li><strong>文件上传</strong> — 支持拖放和点击附件按钮上传。文件类型白名单：.txt、.md、.json、.pdf、.docx。文件大小限制：10MB。</li>
  <li><strong>知识面板切换</strong> — 书签图标按钮，点击切换右侧知识面板的显示状态。</li>
  <li><strong>清除草稿</strong> — 垃圾桶图标按钮，清除输入框中的草稿内容。当输入框为空时自动淡出。</li>
  <li><strong>复制上次回复</strong> — 复制上一条 AI 回复内容到剪贴板。</li>
  <li><strong>发送/取消</strong> — 正常状态显示箭头发送按钮，加载中显示红色方块取消按钮。</li>
</ul>
<h2>使用技巧</h2>
<ul>
  <li>拖放文件到输入框区域可直接上传作为参考素材。</li>
  <li>输入内容会自动保存为草稿，刷新页面后可恢复。</li>
  <li>使用知识面板切换按钮可快速查找角色或设定信息，无需离开对话。</li>
</ul>
<h2>相关页面</h2>
<p>继续阅读：<a href="/desktop/chat-area">对话区</a>、<a href="/desktop/chat-area-mode-controls">ChatAreaModeControls</a>。</p>
  `,"chat-area-mode-controls":`
<h2>ChatAreaModeControls 模式控制栏</h2>
<p>ChatAreaModeControls 是 ChatArea 中间的单行控制栏，负责对话模式选择、预设切换、技能包管理和模板库入口。</p>
<h2>界面元素</h2>
<ul>
  <li><strong>模式指示器</strong> — 彩色圆点 + 活动模式摘要文本（如"Agent · Write"），右侧显示已选技能数量徽章。</li>
  <li><strong>预设按钮组</strong> — 三个快捷预设按钮：专注写作、代理诊断、比较评审。点击切换模式 + 技能组合。</li>
  <li><strong>模板库按钮</strong> — 打开 PromptTemplatePanel 模板库面板。</li>
  <li><strong>技能包面板</strong> — 可折叠面板（Sparkles 图标），展开后显示最多 8 个技能切换按钮。已选技能以填充主色显示，右上角显示已选数量。</li>
</ul>
<h2>预设说明</h2>
<table>
  <thead><tr><th>预设</th><th>模式</th><th>功能</th></tr></thead>
  <tbody>
    <tr><td>专注写作</td><td>Agent · Write</td><td>启用写作相关技能，快速进入创作状态</td></tr>
    <tr><td>代理诊断</td><td>Agent · Revise</td><td>启用分析技能，聚焦问题诊断</td></tr>
    <tr><td>比较评审</td><td>Chat + Model Comparison</td><td>启用模型对比，同时输出两个模型回复</td></tr>
  </tbody>
</table>
<h2>使用方法</h2>
<ol>
  <li>点击预设按钮快速切换到对应模式与技能组合。</li>
  <li>点击技能包图标展开面板，手动选择/取消技能。</li>
  <li>点击模板库按钮浏览和管理提示词模板。</li>
</ol>
<h2>相关页面</h2>
<p>继续阅读：<a href="/desktop/chat-area">对话区</a>、<a href="/desktop/chat-area-composer">ChatAreaComposer</a>。</p>
  `,"story-bible-panel":`
<h2>Story Bible 故事圣经面板</h2>
<p>StoryBiblePanel 是管理作品核心设定的侧边面板，将 Braindump、Genre、Synopsis、Canon、Characters、Worldbuilding、Narrative、Writing Style 和 Outline 集中在一个可折叠的界面中。它是长期项目保持设定一致性的基础。</p>
<h2>面板结构</h2>
<pre><code>flowchart TB
  Braindump[Braindump 自由文本] --> Genre[Genre 类型标签]
  Genre --> Synopsis[Synopsis 概要 + 提升至正典]
  Synopsis --> Canon[Canon Review 正典审阅]
  Canon --> Characters[Characters 角色]
  Characters --> Worldbuilding[Worldbuilding 世界观]
  Worldbuilding --> Narrative[Narrative 叙事记录]
  Narrative --> Style[Writing Style 写作风格]
  Style --> Outline[Outline 大纲]</code></pre>
<h2>各区域说明</h2>
<ul>
  <li><strong>Braindump</strong> — 自由文本区，用于记录初始想法和灵感片段。</li>
  <li><strong>Genre</strong> — 预设类型切换 + 自定义标签输入。</li>
  <li><strong>Synopsis</strong> — 故事概要文本区，"提升至正典"按钮将草稿晋升为权威设定。</li>
  <li><strong>Canon Review</strong> — 已晋升正典页面列表，可选择查看详细内容。</li>
  <li><strong>Characters</strong> — 角色记录列表，支持起草、保存和激活。</li>
  <li><strong>Worldbuilding</strong> — 世界观设定列表，操作同 Characters。</li>
  <li><strong>Narrative</strong> — 场景/事件/时间线叙事记录，操作同上。</li>
  <li><strong>Writing Style</strong> — 4 种风格选项：tried（经验验证）、matchMy（匹配我的风格）、soundsLike（匹配目标风格）、custom（自定义）。</li>
  <li><strong>Outline</strong> — 大纲文本区，用于规划章节结构。</li>
</ul>
<h2>工具栏操作</h2>
<ul>
  <li><strong>导出</strong> — 将 Story Bible 草稿导出为 JSON 文件。</li>
  <li><strong>导入</strong> — 从 JSON 文件导入 Story Bible 数据。</li>
  <li><strong>重置</strong> — 将草稿重置为初始空状态。</li>
</ul>
<h2>使用建议</h2>
<ul>
  <li>在写作初期使用 Braindump 记录所有灵感，不必在意格式。</li>
  <li>确定角色和世界观后及时提升 Synopsis 和关键设定为 Canon，确保后续 AI 分析和一致性检查参考权威设定。</li>
  <li>定期导出 Story Bible 作为备份。</li>
</ul>
<h2>故障排查</h2>
<ul>
  <li>面板不显示内容：确认当前项目已选中且 Story Bible 数据已加载。</li>
  <li>"提升至正典"按钮无响应：检查 Synopsis 文本区是否有内容。</li>
  <li>导入失败：确认 JSON 文件格式正确。</li>
</ul>
<h2>相关页面</h2>
<p>继续阅读：<a href="/desktop/wiki-system">Wiki 系统</a>、<a href="/worldview/worldview-manage">设定管理</a>。</p>
  `,"evaluation-panel":`
<h2>评估面板（EvaluationPanel）</h2>
<p>EvaluationPanel 是右侧面板中功能最丰富的组件，提供 4 步评估流程、多维度分析、支持工具和工作流集成。它将"发现问题"和"修复问题"统一在同一个面板中。</p>
<h2>面板结构</h2>
<pre><code>flowchart TB
  Step1[源选择] --> Step2[紧凑评审]
  Step2 --> Step3[详细评审]
  Step3 --> Step4[支持工具]
  Step4 --> Action[批量应用 / 移交写作助手]</code></pre>
<h2>功能区说明</h2>
<ul>
  <li><strong>源选择器</strong> — 选择要评估的文本来源（当前章节、选中文本等）。</li>
  <li><strong>紧凑评审</strong> — 显示前 2 条建议和主要反馈摘要。</li>
  <li><strong>详细评审</strong> — 包含完整维度分析、模块细分、所有建议及批量应用/撤销操作。</li>
  <li><strong>支持工具</strong> — 质量检查（小说质量分数）、多轮次修订循环（设定目标分数和迭代次数）、一致性治理检查、工作流路由/计划/执行/生命周期控制、检查点创建和恢复。</li>
  <li><strong>建议卡片</strong> — 每条建议可生成修订预览，可一键移交至 Writing Helper 深度处理。</li>
</ul>
<h2>决策徽章</h2>
<table>
  <thead><tr><th>徽章</th><th>含义</th><th>建议动作</th></tr></thead>
  <tbody>
    <tr><td>APPROVED</td><td>当前文本通过评估</td><td>继续写作或进入下一章节</td></tr>
    <tr><td>REVISE</td><td>存在可修复的问题</td><td>查看建议并选择性应用</td></tr>
    <tr><td>REWRITE</td><td>问题严重，建议重写</td><td>使用 Writing Helper 或工作流深度修订</td></tr>
  </tbody>
</table>
<h2>使用方法</h2>
<ol>
  <li>选择评估源（当前章节或选中文本）。</li>
  <li>查看总体评分和决策徽章。</li>
  <li>在紧凑评审中快速浏览主要问题。</li>
  <li>展开详细评审查看各维度分析和建议。</li>
  <li>选择建议：直接应用、生成修订预览、或移交至 Writing Helper。</li>
  <li>使用支持工具进行多轮修订循环直至达到目标分数。</li>
</ol>
<h2>故障排查</h2>
<ul>
  <li>评估无结果：确认 Gateway 连接正常且模型已配置。</li>
  <li>建议无法应用：检查选中文本是否仍然存在于编辑器中。</li>
  <li>多轮修订循环未收敛：调整目标分数或增加迭代次数。</li>
</ul>
<h2>相关页面</h2>
<p>继续阅读：<a href="/desktop/writing-helper-panel">写作助手</a>、<a href="/critic/critic-evaluate">批评评估</a>、<a href="/desktop/workflow-editor-panel">工作流编辑器</a>。</p>
  `,"writing-helper-panel":`
<h2>写作助手面板（WritingHelperPanel）</h2>
<p>WritingHelperPanel 是全屏模态对话框，提供深度文本修订功能。它支持 5 种修订模式、8 维风格控制和高级子属性调整，是评估面板的下游深度处理入口。</p>
<h2>面板结构</h2>
<pre><code>flowchart TB
  Mode[模式选择] --> Params[参数设定]
  Params --> Style[8维风格设置]
  Style --> Advanced[高级子属性]
  Advanced --> Skills[技能包]
  Skills --> Guide[修订指南]
  Guide --> Run[执行处理]
  Run --> Result[结果与回填]</code></pre>
<h2>修订模式</h2>
<table>
  <thead><tr><th>模式</th><th>说明</th><th>适用场景</th></tr></thead>
  <tbody>
    <tr><td>Polish</td><td>润色措辞，保持原意</td><td>文本基本成形，需要提升表达</td></tr>
    <tr><td>Rewrite</td><td>重写段落结构和表达</td><td>需要大幅调整内容组织</td></tr>
    <tr><td>Expand</td><td>扩写细节和描写</td><td>场景过薄，需要增加深度</td></tr>
    <tr><td>Summarize</td><td>压缩和提炼要点</td><td>信息冗余，需要精简</td></tr>
    <tr><td>Outline</td><td>生成大纲结构</td><td>从草稿提取结构化框架</td></tr>
  </tbody>
</table>
<h2>风格控制维度</h2>
<ul>
  <li><strong>4 个选择型维度</strong> — 色调（Tone）、视角（Perspective）、句式（Sentence）、节奏（Pacing）。</li>
  <li><strong>4 个滑块型维度</strong> — 正式度、情感强度、创造力、叙事距离。</li>
</ul>
<h2>高级子属性</h2>
<p>6 组可折叠子属性面板，每组包含选择、滑块或标签输入控件：</p>
<ul>
  <li>Structure — 叙事结构控制</li>
  <li>Emotion — 情感表达调控</li>
  <li>Thinking — 思维模式设定</li>
  <li>Narrative — 叙事视角控制</li>
  <li>Rhythm — 文本节奏调节</li>
  <li>Uniqueness/Cultural — 独特性和文化适配</li>
</ul>
<h2>评估移交</h2>
<p>当从评估面板移交时，Writing Helper 会预选修订模式和参数，并显示评估交接预设卡片，包含原始问题、目标分数和建议方向。</p>
<h2>结果回填</h2>
<ul>
  <li>修订结果以 RevisionPreviewCard 展示，支持替换、插入到编辑器下方、或撤销操作。</li>
  <li>纯文本结果提供"插入到编辑器"按钮。</li>
</ul>
<h2>使用建议</h2>
<ul>
  <li>从评估面板移交可获得更有针对性的修订——系统会携带问题上下文。</li>
  <li>精细调整风格维度比选择预设更有效——尝试微调叙事距离和情感强度。</li>
  <li>开启相关技能包可让修订更有针对性——如"对白润色"技能配合 Polish 模式。</li>
</ul>
<h2>相关页面</h2>
<p>继续阅读：<a href="/desktop/evaluation-panel">评估面板</a>、<a href="/desktop/ai-text-optimizer">AI 文本优化器</a>。</p>
  `,"ai-text-optimizer":`
<h2>AI 文本优化器（AiTextOptimizer）</h2>
<p>AiTextOptimizer 是全屏模态对话框，专注于降低文本的 AI 痕迹，使其更自然、更具人味。它提供 6 种预设策略、两步分析模式和防护机制。</p>
<h2>核心功能</h2>
<ul>
  <li><strong>困惑度优化</strong> — 增加词汇和句式变化，打破 AI 生成文本的规律性。</li>
  <li><strong>突发性优化</strong> — 调整句子长度和结构变化，模拟人类写作的自然节奏。</li>
  <li><strong>检测规避</strong> — 针对 AI 文本检测器的特征进行优化。</li>
  <li><strong>自然化</strong> — 注入口语表达、不完美和个性化特征。</li>
</ul>
<h2>预设策略</h2>
<table>
  <thead><tr><th>预设</th><th>说明</th></tr></thead>
  <tbody>
    <tr><td>Humanize</td><td>全面人性化，降低所有 AI 特征</td></tr>
    <tr><td>AI Guide</td><td>保留 AI 优势同时降低可检测性</td></tr>
    <tr><td>Character Narrative</td><td>以角色声线驱动叙事，增加个性化</td></tr>
    <tr><td>Literary Polish</td><td>文学性润色，提升艺术表达</td></tr>
    <tr><td>Academic Paper</td><td>学术写作优化，保持专业性</td></tr>
    <tr><td>Custom</td><td>自定义策略，自由组合参数</td></tr>
  </tbody>
</table>
<h2>两步分析模式</h2>
<p>开启两步分析后，系统会先执行 AI 特征分析（标记困惑度低、突发性低等区域），再根据诊断结果定向重写。诊断报告以 <code>&lt;details&gt;</code> 折叠面板展示。</p>
<h2>使用方法</h2>
<ol>
  <li>选择预设策略或自定义模式。</li>
  <li>可选：开启两步分析以获取诊断报告。</li>
  <li>输入或粘贴待处理文本（也可从编辑器选中文本直接打开）。</li>
  <li>点击运行按钮（带防护图标）。</li>
  <li>查看处理结果，点击"插入到编辑器"将优化后文本替换原文。</li>
</ol>
<h2>使用建议</h2>
<ul>
  <li>对于网文作品，推荐使用 Character Narrative 预设，能显著增加角色声线辨识度。</li>
  <li>开启两步分析虽然耗时更长，但结果更精准——诊断报告能帮助理解 AI 特征分布。</li>
  <li>自定义模式下的文本区可以精确描述你想要的优化方向。</li>
</ul>
<h2>相关页面</h2>
<p>继续阅读：<a href="/desktop/writing-helper-panel">写作助手</a>、<a href="/desktop/niko-editor">Niko 编辑器</a>。</p>
  `,"workflow-editor-panel":`
<h2>工作流编辑器（WorkflowEditorPanel）</h2>
<p>WorkflowEditorPanel 是右侧面板，用于创建、编辑和执行多步骤工作流。它将分析、修订、检查和导出等操作编排为可复用的自动化流程。</p>
<h2>三种视图</h2>
<pre><code>flowchart LR
  ListView[列表视图] --> EditView[编辑视图]
  EditView --> ExecView[执行视图]
  ExecView --> ListView</code></pre>
<h2>视图说明</h2>
<ul>
  <li><strong>列表视图</strong> — 显示所有工作流卡片，每张卡片包含步骤缩略图、运行和删除操作按钮。</li>
  <li><strong>编辑视图</strong> — 工作流名称/描述输入框，步骤管道可视化（箭头连接器连接各步骤）。每个步骤可配置代理模式（Write/Analyze/Evaluate/Custom）、提示词、输入源（previousStep/chapterContent/storyBible/outline）和检查点类型（none/review/approve）。支持添加步骤和保存。</li>
  <li><strong>执行视图</strong> — 步骤进度时间线，门控控制（暂停/批准/修改/拒绝），输出文本编辑区域。</li>
</ul>
<h2>步骤代理模式</h2>
<table>
  <thead><tr><th>模式</th><th>说明</th><th>输入源建议</th></tr></thead>
  <tbody>
    <tr><td>Write</td><td>AI 创作新内容</td><td>chapterContent + storyBible</td></tr>
    <tr><td>Analyze</td><td>分析现有文本</td><td>chapterContent</td></tr>
    <tr><td>Evaluate</td><td>评估文本质量</td><td>previousStep</td></tr>
    <tr><td>Custom</td><td>自定义提示词</td><td>任意组合</td></tr>
  </tbody>
</table>
<h2>检查点类型</h2>
<ul>
  <li><strong>none</strong> — 步骤自动执行，无需人工干预。</li>
  <li><strong>review</strong> — 步骤完成后暂停，供人工审阅后继续。</li>
  <li><strong>approve</strong> — 步骤完成后需人工批准才能继续。</li>
</ul>
<h2>使用建议</h2>
<ul>
  <li>先在编辑视图中创建和调试工作流，确认无误后再在执行视图中运行。</li>
  <li>关键步骤设置 review 或 approve 检查点，避免 AI 连锁错误。</li>
  <li>使用 previousStep 输入源串联步骤，让后续步骤基于前序结果操作。</li>
</ul>
<h2>相关页面</h2>
<p>继续阅读：<a href="/desktop/evaluation-panel">评估面板</a>、<a href="/api/workflow-api">Workflow API</a>。</p>
  `,"settings-modal":`
<h2>设置面板（SettingsModal）</h2>
<p>SettingsModal 是大型模态对话框，包含左侧导航栏和右侧内容区，管理 Niko Studio 的所有配置项。共 8 个设置分区。</p>
<h2>分区说明</h2>
<ul>
  <li><strong>写作设置</strong> — 工作流级别（L1-L5）、后端模式、目标字数、自动技能匹配、质量目标预设和滑块。</li>
  <li><strong>检索设置</strong> — 启用/禁用、搜索模式、配置文件、分数/预算/迭代阈值、重排序开关、上下文类型复选框。</li>
  <li><strong>模板管理</strong> — 打开 TemplateManagerPanel 管理提示词模板。</li>
  <li><strong>模型配置</strong> — LLM 提供商卡片（启用/主单选）、API 密钥、Base URL、模型选择器、刷新/验证按钮、自定义模型输入、回退/多模型/防护/传统润色开关、提供商搜索。</li>
  <li><strong>风格设置</strong> — 项目级风格配置文件提取。</li>
  <li><strong>界面设置</strong> — 10 种主题色、字体大小、语言切换（中文/英文）、发送快捷键配置。</li>
  <li><strong>后端设置</strong> — Gateway URL、配置 JSON 编辑区、密钥管理。</li>
  <li><strong>诊断</strong> — 刷新诊断数据、打开详细诊断面板。</li>
</ul>
<h2>底部工具栏</h2>
<ul>
  <li><strong>重置</strong> — 恢复所有设置为默认值。</li>
  <li><strong>导出/导入</strong> — 将设置导出为 JSON 文件或从 JSON 导入。</li>
  <li><strong>保存/取消</strong> — 保存修改或放弃更改。</li>
</ul>
<h2>使用建议</h2>
<ul>
  <li>首次使用时优先配置模型（API 密钥和模型选择）和写作设置（工作流级别和质量目标）。</li>
  <li>使用导出/导入功能在多台设备间同步设置。</li>
  <li>开启检索功能并配置上下文类型可显著提升 AI 分析的针对性。</li>
</ul>
<h2>相关页面</h2>
<p>继续阅读：<a href="/desktop/writing-helper-panel">写作助手</a>、<a href="/api/config-api">配置 API</a>。</p>
  `,"knowledge-modal":`
<h2>知识面板（KnowledgeModal）</h2>
<p>KnowledgeModal 是全高侧边面板，提供知识条目的查找、增强和参考功能。它是写作过程中查询角色、地点、情节和技能的快速入口。</p>
<h2>三个主标签</h2>
<ul>
  <li><strong>查找（Find）</strong> — 搜索框 + 分类浏览器（角色/地点/情节）。显示项目卡片列表，点击可查看详情。详情视图显示标题、摘要和所有属性条目，底部有"提升至 Wiki 正典"按钮。</li>
  <li><strong>增强（Enhance）</strong> — 两个子模式：Memory（记忆）显示 MemoryForm 用于添加新素材；Skill（技能）显示 SkillTab 用于搜索和管理技能。</li>
  <li><strong>参考（Reference）</strong> — 查找模式下的参考入口，带有提示徽章引导使用。</li>
</ul>
<h2>工作区范围</h2>
<p>面板顶部显示当前工作区范围芯片（项目/章节上下文），确保知识查询在正确的项目范围内进行。</p>
<h2>使用方法</h2>
<ol>
  <li>点击书签图标或从输入框的知识面板按钮打开。</li>
  <li>在查找标签中搜索角色名、地点名或情节关键词。</li>
  <li>点击结果查看详细信息，确认设定后点击"提升至 Wiki 正典"将其晋升为长期设定。</li>
  <li>在增强标签中添加新记忆或搜索技能。</li>
</ol>
<h2>使用建议</h2>
<ul>
  <li>写作前快速查找角色属性可避免设定冲突。</li>
  <li>及时将临时聊天中确认的事实"提升至 Wiki 正典"，让后续 AI 分析能引用这些设定。</li>
</ul>
<h2>相关页面</h2>
<p>继续阅读：<a href="/desktop/wiki-system">Wiki 系统</a>、<a href="/memory/material-upload">素材上传</a>。</p>
  `,"automation-panel":`
<h2>自动化面板（AutomationPanel）</h2>
<p>AutomationPanel 是右侧面板，用于管理和干预已调度的自动化任务。它显示任务状态、执行历史和人工门控操作。</p>
<h2>面板结构</h2>
<ul>
  <li><strong>头部</strong> — 标题 + 刷新、导入计划、设置和关闭按钮。</li>
  <li><strong>工作区范围</strong> — 显示当前项目和章节上下文芯片。</li>
  <li><strong>任务列表</strong> — 显示所有调度任务，包含标题、描述和状态徽章（Active/Paused）。</li>
  <li><strong>任务详情</strong> — 选定任务的运行状态、批准状态、上次触发时间、重试状态、阻塞原因、下一步操作、关联计划 ID 和时间戳。</li>
  <li><strong>人工干预</strong> — 立即运行/重试、暂停/恢复调度按钮。</li>
  <li><strong>批准门</strong> — 输入确认令牌后"确认并继续"执行。</li>
  <li><strong>计划生命周期</strong> — 拒绝并暂停计划、恢复计划按钮。</li>
</ul>
<h2>使用场景</h2>
<ul>
  <li>工作流自动触发后需要人工审阅——在批准门中确认或拒绝。</li>
  <li>任务执行失败——手动重试或调整调度状态。</li>
  <li>暂停整个计划以停止自动执行——点击"拒绝并暂停计划"。</li>
</ul>
<h2>故障排查</h2>
<ul>
  <li>任务一直阻塞：查看阻塞原因，可能需要人工批准门操作。</li>
  <li>重试失败：检查 Gateway 健康状态和模型配置。</li>
  <li>计划未触发：确认计划状态是否为 Active。</li>
</ul>
<h2>相关页面</h2>
<p>继续阅读：<a href="/desktop/workflow-editor-panel">工作流编辑器</a>、<a href="/api/workflow-api">Workflow API</a>。</p>
  `,"mcp-status-panel":`
<h2>MCP 状态面板（McpStatusPanel）</h2>
<p>McpStatusPanel 是右侧面板，用于监控 Gateway 连接状态、服务健康度和运行时指标。它是排查连接问题和系统健康的首选入口。</p>
<h2>面板结构</h2>
<ul>
  <li><strong>Gateway 状态</strong> — 连接状态指示、会话 ID、重新连接尝试次数和错误诊断信息。</li>
  <li><strong>自愈医生</strong> — 一键重启按钮 + 诊断结果展示。当 Gateway 异常时可尝试自愈。</li>
  <li><strong>运行时诊断</strong> — 分类诊断信息（类/详细信息/可操作建议）。</li>
  <li><strong>关键服务状态</strong> — 表格显示 memory/graph/search/workflow/critic/agent/skills 各服务的在线/离线状态。</li>
  <li><strong>运行时指标</strong> — 网格显示总请求数、失败数、平均延迟和最大延迟。</li>
  <li><strong>服务动态配置</strong> — 创建新服务（ID/名称/路径），现有服务的重命名/启用/禁用/健康检查探测。</li>
  <li><strong>工具统计</strong> — 每个服务的工具计数和工具总数。</li>
  <li><strong>实时 Gateway 终端</strong> — Tauri 事件监听器实时显示着色日志行，带清除按钮。</li>
</ul>
<h2>使用方法</h2>
<ol>
  <li>遇到 AI 功能无响应时打开此面板，首先查看 Gateway 状态。</li>
  <li>若 Gateway 显示离线，尝试"一键重启"自愈医生。</li>
  <li>检查关键服务状态表格，确认所有必要服务在线。</li>
  <li>查看运行时指标，判断是否存在大量请求失败或延迟过高。</li>
  <li>使用实时终端观察 Gateway 日志，定位具体错误。</li>
</ol>
<h2>故障排查</h2>
<ul>
  <li>Gateway 无法连接：点击自愈医生"一键重启"，或检查后端进程是否在运行。</li>
  <li>某个服务离线：尝试在服务动态配置中启用/禁用并重新探测。</li>
  <li>日志刷屏过快：使用清除按钮重置终端。</li>
</ul>
<h2>相关页面</h2>
<p>继续阅读：<a href="/api/health-api">健康检查</a>、<a href="/api/gateway-api">Gateway API</a>。</p>
  `,"chat-sidebar":`
<h2>聊天侧边栏（ChatSidebar）</h2>
<p>ChatSidebar 是左侧面板，用于管理对话会话列表、切换会话和创建新对话。它是多会话写作工作流的核心导航入口。</p>
<h2>界面元素</h2>
<ul>
  <li><strong>会话列表</strong> — 显示所有对话会话卡片，包含会话标题、最后消息摘要和时间戳。当前激活会话高亮显示。</li>
  <li><strong>新建对话按钮</strong> — 创建新的空白对话会话。</li>
  <li><strong>会话切换</strong> — 点击会话卡片即可切换到该对话，ChatArea 自动加载对应的消息历史。</li>
  <li><strong>会话删除</strong> — 每个会话卡片上的删除按钮，移除不需要的对话记录。</li>
</ul>
<h2>使用场景</h2>
<ul>
  <li>为不同角色或场景创建独立会话——例如"角色对话调试"、"情节推演"、"章节润色"。</li>
  <li>在多个会话间快速切换，保留每个对话的独立上下文和草稿。</li>
  <li>清理已完成或不再需要的对话历史。</li>
</ul>
<h2>使用建议</h2>
<ul>
  <li>为每个会话使用清晰的标题，方便后续定位。</li>
  <li>不同写作任务使用不同会话，避免上下文污染。</li>
  <li>定期清理旧会话，保持侧边栏简洁。</li>
</ul>
<h2>相关页面</h2>
<p>继续阅读：<a href="/desktop/chat-area">对话区</a>、<a href="/agent/chat-system">对话系统</a>。</p>
  `,"content-search":`
<h2>内容搜索（ContentSearch）</h2>
<p>ContentSearch 是全局内容搜索组件，支持在当前作品的所有章节和素材中快速查找文本。它提供实时搜索、结果高亮和一键导航功能。</p>
<h2>界面元素</h2>
<ul>
  <li><strong>搜索输入框</strong> — 输入关键词后自动触发搜索（150ms 防抖），无需手动提交。</li>
  <li><strong>结果列表</strong> — 显示匹配条目，包含所在章节名、匹配片段预览和行号。</li>
  <li><strong>关键词高亮</strong> — 搜索结果中匹配的关键词以高亮色标出。</li>
  <li><strong>一键导航</strong> — 点击搜索结果直接跳转到编辑器对应位置。</li>
</ul>
<h2>使用场景</h2>
<ul>
  <li>查找角色名在哪些章节出现——确认设定一致性。</li>
  <li>搜索特定关键词或短语——定位需要修改的段落。</li>
  <li>在长篇作品中快速定位特定场景或对白。</li>
</ul>
<h2>使用方法</h2>
<ol>
  <li>打开内容搜索面板。</li>
  <li>在搜索框中输入关键词。</li>
  <li>浏览搜索结果列表，查看匹配上下文。</li>
  <li>点击目标结果，编辑器自动跳转到对应位置。</li>
</ol>
<h2>相关页面</h2>
<p>继续阅读：<a href="/desktop/niko-editor">Niko 编辑器</a>、<a href="/memory/semantic-search">语义搜索</a>。</p>
  `,"quick-panel":`
<h2>快速面板（QuickPanel）</h2>
<p>QuickPanel 是快捷操作入口面板，提供最近项目、常用操作和快速导航功能。它旨在减少用户在深层菜单中寻找功能的时间。</p>
<h2>界面元素</h2>
<ul>
  <li><strong>最近项目</strong> — 显示最近打开的项目列表，一键切换。</li>
  <li><strong>快捷操作</strong> — 常用写作操作的快捷入口：新建章节、开始分析、打开评估面板等。</li>
  <li><strong>搜索框</strong> — 快速搜索功能、面板或设置项。</li>
</ul>
<h2>使用场景</h2>
<ul>
  <li>在多个写作项目间快速切换。</li>
  <li>直接跳转到常用面板，无需在侧边栏中逐级查找。</li>
  <li>搜索不记得位置的功能或设置。</li>
</ul>
<h2>相关页面</h2>
<p>继续阅读：<a href="/desktop/editor-integration">编辑器集成</a>、<a href="/desktop/settings-modal">设置面板</a>。</p>
  `,"template-manager":`
<h2>模板管理器（TemplateManagerPanel）</h2>
<p>TemplateManagerPanel 是提示词模板的完整管理界面，支持模板的创建、编辑、分类、导入和导出。它让团队和个人写作流程以模板形式稳定复用。</p>
<h2>界面元素</h2>
<ul>
  <li><strong>模板列表</strong> — 按分类显示所有提示词模板，每项包含标题、描述和分类标签。</li>
  <li><strong>模板编辑器</strong> — 创建或编辑模板：名称、描述、分类、提示词正文和支持变量。</li>
  <li><strong>分类管理</strong> — 自定义模板分类（如"润色"、"分析"、"角色"等）。</li>
  <li><strong>导入/导出</strong> — 将模板导出为 JSON 文件或从 JSON 导入，支持团队共享。</li>
</ul>
<h2>模板变量</h2>
<p>模板正文支持占位变量，运行时由系统自动替换：</p>
<ul>
  <li><code>{selection}</code> — 当前选中的文本。</li>
  <li><code>{chapter}</code> — 当前章节内容。</li>
  <li><code>{storyBible}</code> — Story Bible 关键设定。</li>
</ul>
<h2>使用建议</h2>
<ul>
  <li>将团队常用的写作流程封装为模板，减少重复提示词编写。</li>
  <li>按写作阶段（规划、创作、修订、检查）分类模板。</li>
  <li>使用导出功能在团队间共享模板库。</li>
</ul>
<h2>相关页面</h2>
<p>继续阅读：<a href="/desktop/chat-area-mode-controls">ChatAreaModeControls</a>、<a href="/desktop/skill-system">技能系统</a>。</p>
  `,"reader-immersion-dashboard":`
<h2>读者沉浸仪表板（ReaderImmersionDashboard）</h2>
<p>ReaderImmersionDashboard 是智能面板组件，从读者视角展示沉浸感评分、Show/Tell 比率、节奏处方和阅读体验诊断。它帮助作者判断文本是否足够"引人入胜"。</p>
<h2>核心指标</h2>
<ul>
  <li><strong>沉浸感评分</strong> — 综合评分，反映读者被文本吸引和保持专注的程度。</li>
  <li><strong>Show/Tell 比率</strong> — "展示"与"讲述"段落的占比，高 Show 比率通常对应更强沉浸感。</li>
  <li><strong>节奏处方</strong> — 基于节奏分析给出的具体建议（如"此段节奏过慢，建议增加冲突"）。</li>
  <li><strong>阅读疲劳预警</strong> — 检测长段叙述或信息密度过高的区域。</li>
</ul>
<h2>使用场景</h2>
<ul>
  <li>检查整章的沉浸感分布——哪些段落让读者"出戏"。</li>
  <li>查看 Show/Tell 比率——确认关键场景是否用"展示"而非"讲述"。</li>
  <li>根据节奏处方调整段落节奏——在平缓区域增加动作或冲突。</li>
</ul>
<h2>使用方法</h2>
<ol>
  <li>在写作面板中选择 Reader Immersion 维度。</li>
  <li>查看沉浸感总览评分和各段落指标。</li>
  <li>点击低分段落查看详细诊断。</li>
  <li>根据节奏处方的建议修改文本。</li>
  <li>重新分析验证改善效果。</li>
</ol>
<h2>相关页面</h2>
<p>继续阅读：<a href="/desktop/writing-dashboard">写作面板</a>、<a href="/writing/emotional-arc">情感弧线</a>、<a href="/desktop/pacing-prescription-panel">节奏处方面板</a>。</p>
  `,"voice-fingerprint-panel":`
<h2>角色声纹面板（VoiceFingerprintPanel）</h2>
<p>VoiceFingerprintPanel 展示角色语音一致性分析结果，帮助作者确保每个角色的对话风格独特且一致。它是角色塑造深度的重要诊断工具。</p>
<h2>核心功能</h2>
<ul>
  <li><strong>声纹图谱</strong> — 可视化每个角色的词汇偏好、句式长度、语气特征和常用表达。</li>
  <li><strong>一致性检测</strong> — 标记角色对话中与既定声纹不一致的段落（如严肃角色突然使用网络用语）。</li>
  <li><strong>声纹对比</strong> — 多角色声纹横向对比，检查是否出现角色话语风格雷同。</li>
  <li><strong>编辑器修饰标记</strong> — 在编辑器中高亮显示 VoiceConsistency 装饰标记，直接定位问题段落。</li>
</ul>
<h2>使用场景</h2>
<ul>
  <li>多角色对话场景——确认每个角色的语气和用词风格可区分。</li>
  <li>长篇连载——防止角色声纹在后续章节中漂移。</li>
  <li>角色代入写作——参考声纹图谱确保角色说话方式与设定一致。</li>
</ul>
<h2>使用建议</h2>
<ul>
  <li>先在 Story Bible 中定义角色的核心性格和说话风格，声纹分析会参考这些设定。</li>
  <li>当一致性检测标记出异常时，优先检查是否是角色发展（有意为之）而非作者失误。</li>
  <li>使用声纹对比功能特别检查主要角色间的区分度。</li>
</ul>
<h2>相关页面</h2>
<p>继续阅读：<a href="/writing/voice-fingerprint">角色声纹</a>、<a href="/desktop/story-bible-panel">Story Bible</a>、<a href="/graph/character-relationships">角色关系</a>。</p>
  `,"pacing-prescription-panel":`
<h2>节奏处方面板（PacingPrescriptionPanel）</h2>
<p>PacingPrescriptionPanel 提供节奏诊断和处方建议，帮助作者识别文本中节奏过慢、过快或不均匀的区域，并给出具体的修改方向。</p>
<h2>诊断维度</h2>
<ul>
  <li><strong>段落节奏</strong> — 检测信息密度和事件推进速度，标记"拖沓"或"跳跃"段落。</li>
  <li><strong>场景转换</strong> — 检查场景间的过渡节奏，标记过快的切换或过长的过渡。</li>
  <li><strong>对话/叙述比例</strong> — 分析对话与叙述的交替节奏，标记失衡区域。</li>
  <li><strong>张力节奏</strong> — 对比张力曲线，标记该紧张时不紧张、该松弛时不松弛的位置。</li>
</ul>
<h2>处方类型</h2>
<table>
  <thead><tr><th>处方</th><th>说明</th><th>适用场景</th></tr></thead>
  <tbody>
    <tr><td>增加冲突</td><td>在节奏过慢区域增加对抗性事件</td><td>中段塌陷、长段叙述无事件</td></tr>
    <tr><td>加速推进</td><td>压缩过渡段落，直入核心事件</td><td>冗长的环境描写或心理独白</td></tr>
    <tr><td>增加喘息</td><td>在紧张场景后插入缓冲段落</td><td>连续高潮导致疲劳</td></tr>
    <tr><td>调整对话比例</td><td>增加/减少对话以改善节奏</td><td>全叙述无对话或全对话无描写</td></tr>
  </tbody>
</table>
<h2>使用方法</h2>
<ol>
  <li>在写作面板或 Reader Immersion Dashboard 中触发节奏分析。</li>
  <li>查看节奏处方列表，每条处方包含目标段落、诊断和具体建议。</li>
  <li>点击处方定位到编辑器对应段落。</li>
  <li>根据建议修改文本后重新分析验证。</li>
</ol>
<h2>相关页面</h2>
<p>继续阅读：<a href="/desktop/reader-immersion-dashboard">读者沉浸仪表板</a>、<a href="/writing/emotional-arc">情感弧线</a>。</p>
  `,"emotional-arc-chart":`
<h2>情感弧线图（EmotionalArcChart）</h2>
<p>EmotionalArcChart 是叙事可视化面板中的交互式图表组件，以时间线形式展示故事的情绪轨迹。它帮助作者直观判断情感弧线的起伏是否合理、高潮是否有足够铺垫。</p>
<h2>界面元素</h2>
<ul>
  <li><strong>情绪曲线</strong> — X 轴为章节/场景进度，Y 轴为情绪强度（-1 到 +1），绘制整部作品的情感轨迹。</li>
  <li><strong>关键转折标注</strong> — 在曲线上标注情感转折点（如情绪骤降、情感爆发）。</li>
  <li><strong>场景色块</strong> — 不同场景类型用颜色区分（紧张场景/温馨场景/悬念场景等）。</li>
  <li><strong>缩放与平移</strong> — 支持缩放查看细节或全局总览。</li>
</ul>
<h2>典型情感弧线模式</h2>
<table>
  <thead><tr><th>模式</th><th>描述</th><th>适用类型</th></tr></thead>
  <tbody>
    <tr><td>上升型</td><td>情绪持续走高</td><td>励志、成长</td></tr>
    <tr><td>下降型</td><td>情绪持续走低</td><td>悲剧、反思</td></tr>
    <tr><td>V 型</td><td>先跌后升</td><td>绝地反击</td></tr>
    <tr><td>波浪型</td><td>起伏交替</td><td>冒险、悬疑</td></tr>
  </tbody>
</table>
<h2>使用建议</h2>
<ul>
  <li>检查整体弧线是否符合预期的情感模式——例如悬疑作品应有明显的波浪起伏。</li>
  <li>在曲线平缓段（"中段塌陷"）增加冲突或悬念。</li>
  <li>确保高潮前有足够的情绪铺垫，而不是突然跳升。</li>
  <li>结合张力曲线视图一起分析，获得更完整的节奏判断。</li>
</ul>
<h2>相关页面</h2>
<p>继续阅读：<a href="/narrative-viz/narrative-visualization">叙事可视化</a>、<a href="/writing/emotional-arc">情感弧线</a>。</p>
  `,"anti-pattern-warning":`
<h2>反模式警告（AntiPatternWarning）</h2>
<p>AntiPatternWarning 组件用于显示写作反模式检测结果。当 AI 分析发现文本中存在常见的写作问题模式时，此组件以醒目的警告卡片形式呈现诊断和修正建议。</p>
<h2>检测的反模式类型</h2>
<table>
  <thead><tr><th>反模式</th><th>描述</th><th>典型表现</th></tr></thead>
  <tbody>
    <tr><td>Info Dump</td><td>信息倾倒，一次性抛出大量设定</td><td>连续数段纯设定说明，无角色互动</td></tr>
    <tr><td>Telling Not Showing</td><td>讲述而非展示</td><td>"他很伤心"而非描写悲伤行为</td></tr>
    <tr><td>Mary Sue</td><td>完美角色，缺乏真实弱点</td><td>角色无缺点、所有冲突轻松解决</td></tr>
    <tr><td>Deus Ex Machina</td><td>机械降神，天降解决</td><td>关键冲突被外部力量突然解决</td></tr>
    <tr><td>Plot Armor</td><td>主角光环，违反设定逻辑</td><td>主角在不可能的情况下安然无恙</td></tr>
  </tbody>
</table>
<h2>警告卡片结构</h2>
<ul>
  <li><strong>反模式名称</strong> — 红色/橙色标题标签。</li>
  <li><strong>严重程度</strong> — 高/中/低级别指示。</li>
  <li><strong>命中段落</strong> — 引用触发反模式的具体文本片段。</li>
  <li><strong>修正建议</strong> — 具体的改写方向和参考示例。</li>
</ul>
<h2>使用方法</h2>
<ol>
  <li>运行写作分析后，反模式检测结果自动出现在右侧面板。</li>
  <li>查看每条警告的严重程度和命中段落。</li>
  <li>点击命中段落跳转到编辑器对应位置。</li>
  <li>参考修正建议修改文本。</li>
</ol>
<h2>使用建议</h2>
<ul>
  <li>高级别警告应优先处理——这些反模式最影响阅读体验。</li>
  <li>反模式检测是辅助工具，不是规则——某些"Info Dump"在科幻设定中是可接受的。</li>
  <li>结合评估面板的维度评分一起判断，避免过度修改。</li>
</ul>
<h2>相关页面</h2>
<p>继续阅读：<a href="/desktop/evaluation-panel">评估面板</a>、<a href="/knowledge/pattern-detection">模式检测</a>。</p>
  `,"virtual-list":`
<h2>虚拟列表（VirtualList）</h2>
<p>VirtualList 是高性能列表渲染组件，用于在大量消息或条目场景下保持流畅滚动。它基于 <code>@tanstack/react-virtual</code> 实现窗口化渲染，仅渲染可视区域内的元素。</p>
<h2>适用场景</h2>
<ul>
  <li>长对话消息列表——数百条消息时仍保持流畅滚动。</li>
  <li>素材或知识条目列表——大量条目场景下的高效浏览。</li>
  <li>章节列表——长篇作品中快速定位章节。</li>
</ul>
<h2>核心特性</h2>
<ul>
  <li><strong>窗口化渲染</strong> — 仅渲染可视区域 + 上下缓冲区的 DOM 节点，其余用空白占位。</li>
  <li><strong>自动滚动</strong> — <code>stickToBottom</code> 模式下新消息自动滚动到底部。</li>
  <li><strong>自定义行高</strong> — 支持动态行高，适配不同内容长度的条目。</li>
  <li><strong>平滑滚动</strong> — 内置滚动位置记忆和恢复，切换会话后恢复到上次浏览位置。</li>
</ul>
<h2>与非虚拟化渲染的切换</h2>
<p>当消息数量 ≤ 50 条时，系统使用直接 DOM 渲染（避免虚拟化的初始化开销）；超过 50 条时自动切换到 VirtualList。这一阈值对用户透明。</p>
<h2>使用建议</h2>
<ul>
  <li>在长对话中向上滚动查看历史时，VirtualList 会预加载相邻区域，无需等待。</li>
  <li>开启 stickToBottom 时，新消息自动滚动到底部；向上手动滚动后会停止自动跟随。</li>
  <li>滚动性能问题通常与单条消息内容复杂度有关——简化消息内嵌组件可提升渲染速度。</li>
</ul>
<h2>相关页面</h2>
<p>继续阅读：<a href="/desktop/chat-area">对话区</a>、<a href="/desktop/chat-sidebar">聊天侧边栏</a>。</p>
  `},J={"sync-overview":`
<h2>同步概览</h2>
<p>云同步目前是 roadmap 页面，用于记录未来多设备连续创作的设计方向，不属于当前 shipped surface。当前可交付能力以 <code>docs/CAPABILITY_MATRIX.md</code> 为准。</p>
<h2>预期同步范围</h2>
<ul>
  <li>项目文件和元数据。</li>
  <li>分析结果和缓存。</li>
  <li>知识库和设定。</li>
  <li>用户配置和偏好。</li>
</ul>
<h2>设计目标图</h2>
<pre><code>flowchart LR
  DeviceA[设备 A 工作区] --> Push[Push]
  Push --> Remote[远端存储]
  Remote --> Pull[Pull]
  Pull --> DeviceB[设备 B 工作区]
  DeviceA --> Canon[Wiki / Canon]
  DeviceB --> Canon</code></pre>
<h2>状态边界</h2>
<p>在能力矩阵升级前，本页不承诺云端服务、增量同步、冲突合并或多设备自动恢复已经可用。需要跨设备迁移时，应使用当前桌面应用和工作区文件的受控备份路径。</p>
<h2>当前可执行替代路径</h2>
<ol>
  <li>把 workspace、素材和 Wiki 目录做受控备份。</li>
  <li>在另一台机器恢复工作区后，重建缓存和局部索引。</li>
  <li>不要把缓存或临时运行状态误认为必须严格同步的主数据。</li>
</ol>
  `,"push-pull":`
<h2>推送与拉取</h2>
<p>推送与拉取是云同步 roadmap 的交互草案，用于说明未来可能的手动同步方向；当前发布版本不提供稳定同步端点。</p>
<ul>
  <li><strong>推送</strong> — 计划用于将本地变更上传到云端。</li>
  <li><strong>拉取</strong> — 计划用于从云端下载变更。</li>
  <li><strong>全量同步</strong> — 计划用于完整双向同步。</li>
</ul>
<h2>未来应解决的问题</h2>
<table>
  <thead><tr><th>问题</th><th>为什么重要</th></tr></thead>
  <tbody>
    <tr><td>正文冲突</td><td>正文是主数据，不能被静默覆盖。</td></tr>
    <tr><td>Wiki / canon 冲突</td><td>会直接影响后续 Agent 与分析结果。</td></tr>
    <tr><td>缓存是否同步</td><td>决定同步成本与恢复速度。</td></tr>
    <tr><td>配置作用域</td><td>要区分用户级偏好与项目级设置。</td></tr>
  </tbody>
</table>
<h2>冲突解决</h2>
<p>冲突解决策略仍需随同步实现一起验证。发布前不能把保留本地、保留远程或手动合并写成已支持能力。</p>
<h3>端点状态</h3>
<p>同步 API 尚未列入当前能力矩阵的 supported 或 partial 范围；集成者不要依赖 <code>/sync/*</code> 作为稳定接口。</p>
<h2>文档解读规则</h2>
<p>只要本页仍标记为 <code>Roadmap</code>，这里的流程图和交互说明就只能当设计意图，不是当前交付承诺。对外说明多设备协作时，应明确这是未来方向，而不是现成功能。</p>
  `},Y={"system-overview":`
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
  `,"module-design":`
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
  `,"data-flow":`
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
  `},Z={"mcp-endpoints":`
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
  `,"gateway-api":`
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
    <tr><td>Learning</td><td><code>POST /learning/import</code>、<code>POST /learning/style-feedback</code>、<code>POST /learning/reading-extract</code></td><td>导入学习、风格进化、阅读学习。</td></tr>
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
  `,"writing-api":`
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
  `,"graph-api":`
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
  `,"critic-api":`
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
  `,"agent-api":`
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
  `,"memory-api":`
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
  `,"skill-api":`
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
  `,"wiki-api":`
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
  `,"workflow-api":`
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
  `,"sync-api":`
<h2>同步 API</h2>
<p>同步 API 提供同步状态查询和推送/拉取能力，用于多设备项目状态保持一致。若当前版本处于实验或部分支持状态，应以应用内能力矩阵和发布说明为准。</p>
<pre><code>GET  /sync/status
POST /sync/push
POST /sync/pull</code></pre>
<h2>冲突处理</h2>
<p>作品正文、Wiki、素材索引和分析缓存的冲突优先级不同。正文和作者确认的 canon 应优先保护，缓存可以重建。</p>
  `,"health-api":`
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
  `,"config-api":`
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
  `,"plugin-api":`
<h2>插件 API</h2>
<p>插件 API 用于列出、注册和执行插件，是扩展分析能力和导出能力的接口入口。</p>
<pre><code>GET  /plugins/list
POST /plugins/execute
POST /plugins/register</code></pre>
<h2>执行边界</h2>
<p>插件应通过 Gateway 使用工作区上下文和配置，不应直接绕过权限边界操作本地文件或模型密钥。</p>
  `,"workspace-api":`
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
  `,"learning-api":`
<h2>学习 API</h2>
<p>学习 API 提供导入学习、自进化写作和阅读学习三种能力，帮助系统从外部文档、用户反馈和阅读材料中持续积累写作知识。</p>
<pre><code>POST /learning/import
POST /learning/style-feedback
POST /learning/style-drift
GET  /learning/rules
POST /learning/reading-session
POST /learning/reading-extract
GET  /learning/status</code></pre>
<pre><code>flowchart TD
  Import[/learning/import] --> Memory[Memory Store]
  Style[/learning/style-feedback] --> Rules[RuleEvolver]
  StyleDrift[/learning/style-drift] --> Rules
  Rules --> RulesQuery[/learning/rules]
  Reading[/learning/reading-extract] --> SpoilerGate[SpoilerGate]
  SpoilerGate --> Insights[InsightDistiller]
  Orchestrator[Learning Orchestrator] --> Import
  Orchestrator --> Style
  Orchestrator --> Reading</code></pre>
<h2>三种能力</h2>
<table>
  <thead><tr><th>能力</th><th>标识</th><th>核心流程</th></tr></thead>
  <tbody>
    <tr><td>导入学习</td><td>CAP-001</td><td>文档解析 → 实体提取 → 风格提取 → 世界观提取 → 蒸馏。</td></tr>
    <tr><td>自进化写作</td><td>CAP-002</td><td>偏好追踪 → 规则进化 → 风格漂移检测 → 生成-反思-策展循环。</td></tr>
    <tr><td>阅读学习</td><td>CAP-003</td><td>会话追踪 → 剧透门控 → 轻重提取 → 洞察蒸馏。</td></tr>
  </tbody>
</table>
<h2>导入学习</h2>
<p>导入学习管道从文档中提取实体、风格特征、世界观要素和写作洞察。适合批量导入参考作品或已有设定文档。</p>
<ul>
  <li><code>POST /learning/import</code> — 触发导入管道，传入文本内容和来源标识。</li>
  <li>返回导入状态、来源名称和内容长度。</li>
</ul>
<h2>自进化写作</h2>
<p>自进化写作通过用户反馈持续调整风格偏好规则，并检测当前文本是否偏离已学习风格。</p>
<ul>
  <li><code>POST /learning/style-feedback</code> — 记录风格偏好反馈。</li>
  <li><code>POST /learning/style-drift</code> — 检测风格漂移。</li>
  <li><code>GET /learning/rules</code> — 查询当前活跃风格规则。</li>
</ul>
<h2>阅读学习</h2>
<p>阅读学习支持带章节进度的阅读会话和剧透门控的内容提取。只有已读章节的内容会被纳入分析。</p>
<ul>
  <li><code>POST /learning/reading-session</code> — 更新或创建阅读会话。</li>
  <li><code>POST /learning/reading-extract</code> — 触发剧透门控的阅读提取管道。</li>
</ul>
<h2>调用示例</h2>
<pre><code>POST /learning/import
{
  "content": "文档文本内容...",
  "sourceType": "document",
  "sourceName": "reference-novel-ch1"
}</code></pre>
<pre><code>POST /learning/style-feedback
{
  "dimension": "vocabulary_richness",
  "action": "accept",
  "value": 0.8,
  "source": "manual"
}</code></pre>
<pre><code>POST /learning/reading-extract
{
  "content": "章节文本...",
  "bookId": "book-001",
  "currentChapter": 20,
  "totalChapters": 50
}</code></pre>
<h2>状态查询</h2>
<pre><code>GET /learning/status</code></pre>
<p>返回学习管道状态和已启用的能力列表，用于确认各项学习功能是否就绪。</p>
<h2>故障路径</h2>
<ol>
  <li>导入结果为空：检查内容长度和格式，确认 sourceType 是否被支持。</li>
  <li>风格规则为空：先通过 style-feedback 积累足够反馈数据。</li>
  <li>阅读提取跳过内容：确认 reading-session 的 currentChapter 是否已推进到目标章节。</li>
</ol>
  `},tt=f(Z,["writing-api","graph-api","critic-api","agent-api","wiki-api","workflow-api","workspace-api","learning-api"],w),et={"accordion-wrapper":`
<h2>AccordionWrapper</h2>
<p>手风琴折叠容器，用于将内容组织为可折叠的区块，支持单选和多选模式。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>折叠/展开切换</strong> — 点击标题栏即可切换对应内容区的可见状态</li>
  <li><strong>单选模式</strong> — 同一时刻仅允许一个区块展开，展开新区块自动收起其他区块</li>
  <li><strong>多选模式</strong> — 允许多个区块同时展开，适合需要对比查看内容的场景</li>
  <li><strong>受控与非受控</strong> — 支持外部控制展开状态，也支持组件内部自动管理</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>Intelligence 面板中将多个分析维度分组展示</li>
  <li>设置页面中按功能类别折叠配置项</li>
  <li>任何需要节省垂直空间、按需展示详细信息的界面区域</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>mode</code></td><td><code>'single' | 'multi'</code></td><td>折叠模式：单选或多选</td></tr>
    <tr><td><code>defaultOpen</code></td><td><code>string[]</code></td><td>默认展开的区块 ID 列表</td></tr>
    <tr><td><code>openIds</code></td><td><code>string[]</code></td><td>受控模式下当前展开的区块 ID</td></tr>
    <tr><td><code>onChange</code></td><td><code>(ids: string[]) =&gt; void</code></td><td>展开状态变化回调</td></tr>
  </tbody>
</table>
`,"inline-annotation":`
<h2>InlineAnnotation</h2>
<p>内联标注组件，用于在文本中嵌入轻量级标记信息，提供上下文提示而不打断阅读流。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>悬停提示</strong> — 鼠标悬停时显示标注详情，不占用额外布局空间</li>
  <li><strong>视觉标记</strong> — 通过下划线、背景色或图标区分不同类型的标注</li>
  <li><strong>类型区分</strong> — 支持 info、warning、error 等语义类型，自动应用对应样式</li>
  <li><strong>可交互</strong> — 标注可响应点击事件，用于导航到详情或触发操作</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>在文本编辑器中标记 AI 建议的修改位置</li>
  <li>对叙事元素添加内联备注（如角色名、地点名）</li>
  <li>在评估结果中标注问题文本段</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>type</code></td><td><code>'info' | 'warning' | 'error' | 'suggestion'</code></td><td>标注语义类型</td></tr>
    <tr><td><code>label</code></td><td><code>string</code></td><td>标注显示文本</td></tr>
    <tr><td><code>tooltip</code></td><td><code>string</code></td><td>悬停时显示的详细说明</td></tr>
    <tr><td><code>onClick</code></td><td><code>() =&gt; void</code></td><td>点击回调</td></tr>
  </tbody>
</table>
`,"intelligence-badge":`
<h2>IntelligenceBadge</h2>
<p>智能徽章组件，以紧凑的标签形式展示智能分析的状态、类别或评分等级。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>状态徽章</strong> — 显示分析状态（运行中、完成、失败），搭配对应颜色与图标</li>
  <li><strong>类别徽章</strong> — 标识分析所属类别（如叙事、角色、节奏），使用语义化配色</li>
  <li><strong>评分等级</strong> — 以 A/B/C/D 等级或数值展示质量评分</li>
  <li><strong>尺寸变体</strong> — 提供 sm / md / lg 三种尺寸适配不同密度布局</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>Intelligence 面板头部展示当前分析状态</li>
  <li>列表项中标识各条目的分析类别</li>
  <li>质量评分结果旁展示等级标签</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>variant</code></td><td><code>'status' | 'category' | 'grade'</code></td><td>徽章类型</td></tr>
    <tr><td><code>value</code></td><td><code>string</code></td><td>徽章显示值</td></tr>
    <tr><td><code>size</code></td><td><code>'sm' | 'md' | 'lg'</code></td><td>徽章尺寸</td></tr>
    <tr><td><code>color</code></td><td><code>string</code></td><td>自定义颜色，覆盖默认配色</td></tr>
  </tbody>
</table>
`,"metric-value":`
<h2>MetricValue</h2>
<p>指标数值展示组件，用于突出显示关键数值型指标，支持趋势指示和单位标注。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>大数字展示</strong> — 以醒目的排版展示核心指标数值</li>
  <li><strong>趋势指示</strong> — 在数值旁显示上升/下降/持平趋势箭头及变化量</li>
  <li><strong>单位标注</strong> — 支持在数值后附加单位文本（如 %、分、字）</li>
  <li><strong>状态着色</strong> — 根据指标状态（正常、警告、危险）自动着色</li>
  <li><strong>辅助说明</strong> — 可在数值下方添加描述性标签</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>写作统计面板展示字数、段落数等关键指标</li>
  <li>质量评分结果展示总分及各维度分数</li>
  <li>仪表盘中展示核心运营指标</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>value</code></td><td><code>number | string</code></td><td>指标数值</td></tr>
    <tr><td><code>unit</code></td><td><code>string</code></td><td>数值单位</td></tr>
    <tr><td><code>trend</code></td><td><code>'up' | 'down' | 'flat'</code></td><td>趋势方向</td></tr>
    <tr><td><code>trendValue</code></td><td><code>string</code></td><td>趋势变化量文本</td></tr>
    <tr><td><code>status</code></td><td><code>'normal' | 'warning' | 'danger'</code></td><td>指标状态</td></tr>
    <tr><td><code>label</code></td><td><code>string</code></td><td>辅助说明文本</td></tr>
  </tbody>
</table>
`,"plugin-panel":`
<h2>PluginPanel</h2>
<p>插件面板组件，为 Intelligence 系统中的插件提供统一的容器布局，包含标题栏、工具区和内容区。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>统一布局</strong> — 提供标题栏 + 工具栏 + 内容区的标准三段式布局</li>
  <li><strong>插件标识</strong> — 在标题栏中展示插件图标、名称和状态标识</li>
  <li><strong>工具区</strong> — 支持在标题栏右侧放置操作按钮（如刷新、设置、展开）</li>
  <li><strong>加载状态</strong> — 内置 loading 骨架屏，插件数据加载时自动显示</li>
  <li><strong>错误兜底</strong> — 插件出错时展示错误提示而非白屏</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>Intelligence 面板中承载各分析插件的输出内容</li>
  <li>需要统一外观的第三方扩展面板</li>
  <li>任何需要标题 + 操作 + 内容三段式结构的面板</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>title</code></td><td><code>string</code></td><td>面板标题</td></tr>
    <tr><td><code>icon</code></td><td><code>ReactNode</code></td><td>标题栏图标</td></tr>
    <tr><td><code>actions</code></td><td><code>ReactNode</code></td><td>工具区内容</td></tr>
    <tr><td><code>loading</code></td><td><code>boolean</code></td><td>是否显示加载状态</td></tr>
    <tr><td><code>error</code></td><td><code>string | null</code></td><td>错误信息</td></tr>
    <tr><td><code>children</code></td><td><code>ReactNode</code></td><td>面板内容</td></tr>
  </tbody>
</table>
`,"progress-bar":`
<h2>ProgressBar</h2>
<p>进度条组件，直观展示任务完成度或指标达成率，支持多种样式变体。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>确定性进度</strong> — 展示 0%–100% 的精确进度值</li>
  <li><strong>不确定模式</strong> — 任务时长未知时展示动画条，表示正在进行</li>
  <li><strong>分段进度</strong> — 支持多段式进度条，每段可独立着色表示不同阶段</li>
  <li><strong>标签显示</strong> — 可在进度条内/旁显示百分比或自定义文本</li>
  <li><strong>状态着色</strong> — 根据进度值自动切换颜色（低=红、中=黄、高=绿）</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>AI 分析任务执行进度展示</li>
  <li>写作目标完成度展示（如字数目标、章节进度）</li>
  <li>数据同步或导入/导出操作进度</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>value</code></td><td><code>number</code></td><td>进度值（0–100）</td></tr>
    <tr><td><code>max</code></td><td><code>number</code></td><td>最大值，默认 100</td></tr>
    <tr><td><code>indeterminate</code></td><td><code>boolean</code></td><td>是否为不确定模式</td></tr>
    <tr><td><code>showLabel</code></td><td><code>boolean</code></td><td>是否显示进度标签</td></tr>
    <tr><td><code>segments</code></td><td><code>Segment[]</code></td><td>分段进度配置</td></tr>
    <tr><td><code>size</code></td><td><code>'sm' | 'md' | 'lg'</code></td><td>进度条高度尺寸</td></tr>
  </tbody>
</table>
`,"section-header":`
<h2>SectionHeader</h2>
<p>区块标题组件，为面板中的内容区块提供统一的标题样式，支持图标、操作按钮和折叠控制。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>标题 + 图标</strong> — 在标题前显示语义图标，增强可识别性</li>
  <li><strong>操作区</strong> — 标题右侧可放置操作按钮（如刷新、设置、更多）</li>
  <li><strong>折叠控制</strong> — 可选的折叠/展开切换按钮，与 AccordionWrapper 协作</li>
  <li><strong>辅助文本</strong> — 标题下方可添加灰色描述文本</li>
  <li><strong>分隔线</strong> — 可选的底部分隔线，视觉上划分区块边界</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>Intelligence 面板中各分析区块的标题</li>
  <li>设置页面中各配置分组的标题</li>
  <li>任何需要统一标题风格的界面区域</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>title</code></td><td><code>string</code></td><td>标题文本</td></tr>
    <tr><td><code>icon</code></td><td><code>ReactNode</code></td><td>标题图标</td></tr>
    <tr><td><code>description</code></td><td><code>string</code></td><td>辅助描述文本</td></tr>
    <tr><td><code>actions</code></td><td><code>ReactNode</code></td><td>右侧操作区内容</td></tr>
    <tr><td><code>collapsible</code></td><td><code>boolean</code></td><td>是否显示折叠按钮</td></tr>
    <tr><td><code>defaultOpen</code></td><td><code>boolean</code></td><td>折叠状态默认值</td></tr>
    <tr><td><code>divider</code></td><td><code>boolean</code></td><td>是否显示底部分隔线</td></tr>
  </tbody>
</table>
`,"show-tell-legend":`
<h2>ShowTellLegend</h2>
<p>Show/Tell 图例组件，展示文本中 Show（展示）和 Tell（叙述）标记的颜色图例，帮助用户理解编辑器中的装饰含义。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>颜色图例</strong> — 以色块 + 文本形式展示 Show/Tell 两种标记的配色方案</li>
  <li><strong>统计摘要</strong> — 可展示当前文本中 Show/Tell 各占的比例</li>
  <li><strong>交互切换</strong> — 点击图例项可高亮/隐藏对应类型的编辑器装饰</li>
  <li><strong>紧凑布局</strong> — 设计为可嵌入面板头部的紧凑组件</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>Intelligence 面板中解释 Show/Tell 分析结果的视觉含义</li>
  <li>编辑器侧边栏作为 Show/Tell 装饰的图例参考</li>
  <li>写作评估报告中解释 Show/Tell 标记</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>showCount</code></td><td><code>number</code></td><td>Show 标记数量</td></tr>
    <tr><td><code>tellCount</code></td><td><code>number</code></td><td>Tell 标记数量</td></tr>
    <tr><td><code>onToggle</code></td><td><code>(type: 'show' | 'tell') =&gt; void</code></td><td>图例项点击回调</td></tr>
    <tr><td><code>activeTypes</code></td><td><code>Set&lt;string&gt;</code></td><td>当前激活显示的类型</td></tr>
  </tbody>
</table>
`,"template-manager-intel":`
<h2>TemplateManager（Intelligence）</h2>
<p>Intelligence 模块中的模板管理器，用于管理分析模板的创建、选择和应用，支持自定义分析维度与权重。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>模板列表</strong> — 展示所有可用的分析模板，包括预设模板和用户自定义模板</li>
  <li><strong>模板选择</strong> — 点击切换当前使用的分析模板，切换后分析结果即时更新</li>
  <li><strong>模板创建</strong> — 支持从零创建自定义模板，配置分析维度、权重和阈值</li>
  <li><strong>模板编辑</strong> — 修改已有自定义模板的参数</li>
  <li><strong>模板导入/导出</strong> — 以 JSON 格式导入/导出模板，方便团队共享</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>选择不同风格的分析模板（如小说模板、剧本模板、散文模板）</li>
  <li>创建针对特定写作类型的自定义分析模板</li>
  <li>在团队中共享统一的评估标准</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>templates</code></td><td><code>AnalysisTemplate[]</code></td><td>可用模板列表</td></tr>
    <tr><td><code>activeTemplate</code></td><td><code>string</code></td><td>当前激活模板 ID</td></tr>
    <tr><td><code>onSelect</code></td><td><code>(id: string) =&gt; void</code></td><td>模板选择回调</td></tr>
    <tr><td><code>onCreate</code></td><td><code>(template: AnalysisTemplate) =&gt; void</code></td><td>模板创建回调</td></tr>
    <tr><td><code>onEdit</code></td><td><code>(id: string, updates: Partial&lt;AnalysisTemplate&gt;) =&gt; void</code></td><td>模板编辑回调</td></tr>
    <tr><td><code>onDelete</code></td><td><code>(id: string) =&gt; void</code></td><td>模板删除回调</td></tr>
  </tbody>
</table>
`,"trend-chart":`
<h2>TrendChart</h2>
<p>趋势图表组件，以折线图或面积图形式展示指标随时间的变化趋势，帮助用户识别写作质量的演进模式。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>折线图 / 面积图</strong> — 支持两种图表类型切换</li>
  <li><strong>多数据系列</strong> — 可在同一图表中叠加展示多条趋势线</li>
  <li><strong>时间轴</strong> — X 轴按时间排列数据点，支持缩放和滚动</li>
  <li><strong>悬停提示</strong> — 鼠标悬停时展示该数据点的详细数值</li>
  <li><strong>基准线</strong> — 可添加目标基准线，直观对比实际值与目标值</li>
  <li><strong>自适应尺寸</strong> — 图表随容器尺寸自动调整</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>展示写作质量评分随章节的变化趋势</li>
  <li>对比多个维度（如节奏、对话、描写）的评分走势</li>
  <li>追踪每日写作字数统计</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>data</code></td><td><code>DataPoint[][]</code></td><td>数据系列数组</td></tr>
    <tr><td><code>type</code></td><td><code>'line' | 'area'</code></td><td>图表类型</td></tr>
    <tr><td><code>labels</code></td><td><code>string[]</code></td><td>各系列标签</td></tr>
    <tr><td><code>baseline</code></td><td><code>number</code></td><td>基准线数值</td></tr>
    <tr><td><code>height</code></td><td><code>number</code></td><td>图表高度（px）</td></tr>
    <tr><td><code>showDots</code></td><td><code>boolean</code></td><td>是否显示数据点</td></tr>
  </tbody>
</table>
`,"writing-dimension-detail":`
<h2>WritingDimensionDetail</h2>
<p>写作维度详情组件，展示单个写作分析维度的详细评估结果，包括评分、说明和改进建议。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>维度评分</strong> — 以进度条 + 数值形式展示维度得分</li>
  <li><strong>评级标识</strong> — 根据分数显示 A/B/C/D 评级徽章</li>
  <li><strong>评估说明</strong> — 展示 AI 生成的维度评估文字说明</li>
  <li><strong>改进建议</strong> — 列出针对性的写作改进建议</li>
  <li><strong>示例引用</strong> — 从原文中引用相关片段作为评分依据</li>
  <li><strong>折叠详情</strong> — 默认展示摘要，可展开查看完整评估</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>Intelligence 面板中展示各写作维度的详细分析结果</li>
  <li>质量评估报告中逐维度展示评分与建议</li>
  <li>写作辅导场景中针对特定维度提供改进指导</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>dimension</code></td><td><code>WritingDimension</code></td><td>维度数据对象</td></tr>
    <tr><td><code>score</code></td><td><code>number</code></td><td>维度评分（0–100）</td></tr>
    <tr><td><code>grade</code></td><td><code>'A' | 'B' | 'C' | 'D'</code></td><td>评级</td></tr>
    <tr><td><code>summary</code></td><td><code>string</code></td><td>评估摘要</td></tr>
    <tr><td><code>suggestions</code></td><td><code>string[]</code></td><td>改进建议列表</td></tr>
    <tr><td><code>quotes</code></td><td><code>Quote[]</code></td><td>原文引用列表</td></tr>
    <tr><td><code>defaultExpanded</code></td><td><code>boolean</code></td><td>是否默认展开详情</td></tr>
  </tbody>
</table>
`,"character-tab":`
<h2>CharacterTab</h2>
<p>角色标签页组件，用于管理和浏览知识库中的角色信息，支持角色的创建、编辑和关系管理。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>角色列表</strong> — 以卡片或列表形式展示所有角色，支持按名称搜索筛选</li>
  <li><strong>角色详情</strong> — 展示角色的完整属性信息（姓名、描述、特征、背景等）</li>
  <li><strong>角色创建/编辑</strong> — 通过表单创建新角色或修改现有角色属性</li>
  <li><strong>关系图谱</strong> — 展示角色间的关系网络（朋友、对手、家人等）</li>
  <li><strong>出场统计</strong> — 统计角色在各章节的出场次数和篇幅</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>写作前规划角色设定和关系网络</li>
  <li>写作过程中查阅角色属性保持人设一致</li>
  <li>写作后回顾角色出场分布和互动情况</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>characters</code></td><td><code>Character[]</code></td><td>角色数据列表</td></tr>
    <tr><td><code>onCreate</code></td><td><code>(character: Character) =&gt; void</code></td><td>创建角色回调</td></tr>
    <tr><td><code>onEdit</code></td><td><code>(id: string, updates: Partial&lt;Character&gt;) =&gt; void</code></td><td>编辑角色回调</td></tr>
    <tr><td><code>onDelete</code></td><td><code>(id: string) =&gt; void</code></td><td>删除角色回调</td></tr>
    <tr><td><code>onLink</code></td><td><code>(fromId: string, toId: string, relation: string) =&gt; void</code></td><td>建立角色关系回调</td></tr>
  </tbody>
</table>
`,"location-tab":`
<h2>LocationTab</h2>
<p>地点标签页组件，用于管理和浏览知识库中的地点信息，帮助作者维护故事世界的空间设定。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>地点列表</strong> — 展示所有地点条目，支持搜索和分类筛选</li>
  <li><strong>地点详情</strong> — 展示地点名称、描述、特征、所属区域等信息</li>
  <li><strong>层级结构</strong> — 支持地点的层级关系（如国家 → 城市 → 街道 → 建筑）</li>
  <li><strong>场景关联</strong> — 展示与该地点关联的叙事场景列表</li>
  <li><strong>地点创建/编辑</strong> — 通过表单管理地点属性</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>构建故事世界的地理空间体系</li>
  <li>查阅地点细节以确保场景描写的一致性</li>
  <li>追踪各地点在故事中的使用频次</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>locations</code></td><td><code>Location[]</code></td><td>地点数据列表</td></tr>
    <tr><td><code>onCreate</code></td><td><code>(location: Location) =&gt; void</code></td><td>创建地点回调</td></tr>
    <tr><td><code>onEdit</code></td><td><code>(id: string, updates: Partial&lt;Location&gt;) =&gt; void</code></td><td>编辑地点回调</td></tr>
    <tr><td><code>onDelete</code></td><td><code>(id: string) =&gt; void</code></td><td>删除地点回调</td></tr>
  </tbody>
</table>
`,"memory-form":`
<h2>MemoryForm</h2>
<p>记忆表单组件，用于创建和编辑知识库中的记忆条目，支持结构化录入和标签分类。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>结构化录入</strong> — 提供标题、内容、来源等结构化字段</li>
  <li><strong>标签分类</strong> — 支持为记忆添加标签，便于后续检索和筛选</li>
  <li><strong>重要度标记</strong> — 可标记记忆的重要度级别（核心/重要/一般）</li>
  <li><strong>关联引用</code> — 可关联角色、地点等实体，形成知识网络</li>
  <li><strong>表单验证</strong> — 必填字段验证和格式校验</li>
  <li><strong>编辑模式</strong> — 支持新建和编辑两种模式，编辑时预填充已有数据</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>记录故事中的关键事件和设定</li>
  <li>为 AI 上下文提供结构化的知识输入</li>
  <li>维护写作过程中的灵感和想法</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>initialValues</code></td><td><code>Partial&lt;Memory&gt;</code></td><td>编辑模式下的初始值</td></tr>
    <tr><td><code>onSubmit</code></td><td><code>(memory: Memory) =&gt; void</code></td><td>提交回调</td></tr>
    <tr><td><code>onCancel</code></td><td><code>() =&gt; void</code></td><td>取消回调</td></tr>
    <tr><td><code>availableTags</code></td><td><code>string[]</code></td><td>可选标签列表</td></tr>
    <tr><td><code>linkedEntities</code></td><td><code>EntityRef[]</code></td><td>可关联的实体列表</td></tr>
  </tbody>
</table>
`,"persisted-entity-tab":`
<h2>PersistedEntityTab</h2>
<p>持久实体标签页组件，为知识库中的通用实体类型提供标准化的管理界面，支持 CRUD 操作和搜索筛选。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>通用实体管理</strong> — 不限定具体实体类型，适用于角色、地点、道具等任何持久化实体</li>
  <li><strong>CRUD 操作</strong> — 提供创建、读取、更新、删除的完整操作</li>
  <li><strong>搜索筛选</strong> — 支持按名称和标签搜索实体</li>
  <li><strong>分页加载</strong> — 大量实体时分页展示，保证界面流畅</li>
  <li><strong>批量操作</strong> — 支持多选后批量删除或批量修改标签</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>管理知识库中不属于特定类别的通用实体</li>
  <li>作为其他专用 Tab（如 CharacterTab、LocationTab）的底层组件</li>
  <li>快速原型化新的实体类型管理界面</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>entityType</code></td><td><code>string</code></td><td>实体类型标识</td></tr>
    <tr><td><code>entities</code></td><td><code>PersistedEntity[]</code></td><td>实体数据列表</td></tr>
    <tr><td><code>columns</code></td><td><code>ColumnDef[]</code></td><td>列表列定义</td></tr>
    <tr><td><code>onCreate</code></td><td><code>(entity: PersistedEntity) =&gt; void</code></td><td>创建回调</td></tr>
    <tr><td><code>onEdit</code></td><td><code>(id: string, updates: Partial&lt;PersistedEntity&gt;) =&gt; void</code></td><td>编辑回调</td></tr>
    <tr><td><code>onDelete</code></td><td><code>(id: string) =&gt; void</code></td><td>删除回调</td></tr>
  </tbody>
</table>
`,"plot-tab":`
<h2>PlotTab</h2>
<p>情节标签页组件，用于管理知识库中的情节线索和剧情节点，帮助作者梳理和追踪故事线。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>情节线列表</strong> — 展示所有情节线（主线、支线、暗线），支持颜色区分</li>
  <li><strong>剧情节点</strong> — 在情节线中管理关键剧情节点（起因、发展、高潮、结局）</li>
  <li><strong>时间线视图</strong> — 以时间线形式展示情节的推进顺序</li>
  <li><strong>节点关联</strong> — 将情节节点与角色、地点等实体关联</li>
  <li><strong>完成度追踪</strong> — 标记情节节点的写作状态（计划中/进行中/已完成）</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>写作前规划整体情节架构</li>
  <li>写作中追踪各情节线的推进进度</li>
  <li>修改时检查情节线的连贯性和逻辑性</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>plotLines</code></td><td><code>PlotLine[]</code></td><td>情节线数据列表</td></tr>
    <tr><td><code>onCreateLine</code></td><td><code>(line: PlotLine) =&gt; void</code></td><td>创建情节线回调</td></tr>
    <tr><td><code>onAddNode</code></td><td><code>(lineId: string, node: PlotNode) =&gt; void</code></td><td>添加剧情节点回调</td></tr>
    <tr><td><code>onEditNode</code></td><td><code>(nodeId: string, updates: Partial&lt;PlotNode&gt;) =&gt; void</code></td><td>编辑剧情节点回调</td></tr>
    <tr><td><code>onDeleteNode</code></td><td><code>(nodeId: string) =&gt; void</code></td><td>删除剧情节点回调</td></tr>
  </tbody>
</table>
`,"skill-tab":`
<h2>SkillTab</h2>
<p>技能标签页组件，用于管理知识库中角色的技能和能力体系，支持技能层级和依赖关系。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>技能列表</strong> — 展示所有技能条目，支持按类别和等级筛选</li>
  <li><strong>技能详情</strong> — 展示技能名称、描述、等级、效果范围等信息</li>
  <li><strong>技能树</strong> — 以树形结构展示技能的前置依赖和升级路径</li>
  <li><strong>角色关联</strong> — 展示拥有该技能的角色列表</li>
  <li><strong>技能创建/编辑</strong> — 通过表单管理技能属性和依赖关系</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>奇幻/科幻类作品中构建角色能力体系</li>
  <li>追踪角色技能的获得和升级过程</li>
  <li>确保技能使用的逻辑一致性（如未解锁技能不可使用）</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>skills</code></td><td><code>Skill[]</code></td><td>技能数据列表</td></tr>
    <tr><td><code>onCreate</code></td><td><code>(skill: Skill) =&gt; void</code></td><td>创建技能回调</td></tr>
    <tr><td><code>onEdit</code></td><td><code>(id: string, updates: Partial&lt;Skill&gt;) =&gt; void</code></td><td>编辑技能回调</td></tr>
    <tr><td><code>onDelete</code></td><td><code>(id: string) =&gt; void</code></td><td>删除技能回调</td></tr>
    <tr><td><code>onLinkPrerequisite</code></td><td><code>(skillId: string, prereqId: string) =&gt; void</code></td><td>设置技能前置依赖回调</td></tr>
  </tbody>
</table>
`,"evaluation-compact-review-section":`
<h2>EvaluationCompactReviewSection</h2>
<p>简洁审查区组件，以紧凑的摘要形式展示评估结果，适合空间有限的列表或面板视图。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>摘要评分</strong> — 以数值和颜色标识展示总体评分</li>
  <li><strong>评级徽章</strong> — 展示 A/B/C/D 评级，一目了然</li>
  <li><strong>关键问题数</strong> — 展示发现的关键问题数量</li>
  <li><strong>一键展开</strong> — 点击可展开到 EvaluationDetailedReviewSection 查看详情</li>
  <li><strong>时间戳</strong> — 显示评估执行时间</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>评估历史列表中展示各次评估的摘要</li>
  <li>侧边栏面板中快速浏览评估状态</li>
  <li>多维度评估的汇总视图中展示各维度概要</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>evaluation</code></td><td><code>EvaluationResult</code></td><td>评估结果数据</td></tr>
    <tr><td><code>onExpand</code></td><td><code>() =&gt; void</code></td><td>展开详情回调</td></tr>
    <tr><td><code>compact</code></td><td><code>boolean</code></td><td>是否启用超紧凑模式</td></tr>
  </tbody>
</table>
`,"evaluation-detailed-review-section":`
<h2>EvaluationDetailedReviewSection</h2>
<p>详细审查区组件，以展开的形式展示评估结果的完整内容，包括各维度评分、问题列表和改进建议。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>各维度评分</strong> — 逐维度展示评分条和数值</li>
  <li><strong>问题列表</strong> — 按严重程度排列的详细问题清单，包含原文定位</li>
  <li><strong>改进建议</strong> — 针对每个问题的具体改进方案</li>
  <li><strong>原文引用</strong> — 引用被评估文本中的相关片段</li>
  <li><strong>操作按钮</strong> — 支持一键应用建议、标记已处理等操作</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>从 EvaluationCompactReviewSection 展开查看完整评估</li>
  <li>评估结果详情页面</li>
  <li>写作辅导中的逐项改进指导</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>evaluation</code></td><td><code>EvaluationResult</code></td><td>完整评估结果数据</td></tr>
    <tr><td><code>onApplySuggestion</code></td><td><code>(suggestionId: string) =&gt; void</code></td><td>应用建议回调</td></tr>
    <tr><td><code>onDismiss</code></td><td><code>(issueId: string) =&gt; void</code></td><td>忽略问题回调</td></tr>
    <tr><td><code>onNavigateToSource</code></td><td><code>(location: SourceLocation) =&gt; void</code></td><td>导航到原文位置回调</td></tr>
  </tbody>
</table>
`,"evaluation-source-section":`
<h2>EvaluationSourceSection</h2>
<p>来源区组件，展示评估所基于的原始文本来源和引用信息，确保评估结果可追溯。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>文本来源</strong> — 展示被评估的原文段落，高亮相关片段</li>
  <li><strong>版本信息</strong> — 标注评估基于的文本版本（如草稿 v3）</li>
  <li><strong>范围标识</strong> — 明确标注评估覆盖的文本范围（全文/选中段落/章节）</li>
  <li><strong>跳转链接</strong> — 点击可在编辑器中定位到对应位置</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>在评估详情中展示评估对象的原文</li>
  <li>点击问题定位到编辑器中对应位置</li>
  <li>确认评估的文本范围和版本</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>source</code></td><td><code>EvaluationSource</code></td><td>来源信息数据</td></tr>
    <tr><td><code>highlights</code></td><td><code>HighlightRange[]</code></td><td>高亮范围列表</td></tr>
    <tr><td><code>onNavigate</code></td><td><code>(location: SourceLocation) =&gt; void</code></td><td>导航到源文本回调</td></tr>
  </tbody>
</table>
`,"evaluation-support-tools-section":`
<h2>EvaluationSupportToolsSection</h2>
<p>支持工具区组件，提供评估流程中的辅助工具入口，如重新评估、对比评估、导出报告等。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>重新评估</strong> — 一键触发基于当前文本的重新评估</li>
  <li><strong>对比评估</strong> — 选择两次评估结果进行差异对比</li>
  <li><strong>导出报告</strong> — 将评估结果导出为 Markdown 或 PDF 格式</li>
  <li><strong>评估模板</strong> — 切换不同评估模板</li>
  <li><strong>历史版本</strong> — 查看同一文本的历史评估记录</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>修改文本后重新评估检查改进效果</li>
  <li>对比不同版本的评估结果追踪写作进步</li>
  <li>导出评估报告用于团队评审</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>evaluationId</code></td><td><code>string</code></td><td>当前评估 ID</td></tr>
    <tr><td><code>onReevaluate</code></td><td><code>() =&gt; void</code></td><td>重新评估回调</td></tr>
    <tr><td><code>onCompare</code></td><td><code>(ids: [string, string]) =&gt; void</code></td><td>对比评估回调</td></tr>
    <tr><td><code>onExport</code></td><td><code>(format: 'markdown' | 'pdf') =&gt; void</code></td><td>导出报告回调</td></tr>
    <tr><td><code>historyIds</code></td><td><code>string[]</code></td><td>历史评估 ID 列表</td></tr>
  </tbody>
</table>
`,"evaluation-workflow-section":`
<h2>EvaluationWorkflowSection</h2>
<p>工作流区组件，展示评估的执行流程和当前状态，支持对评估工作流的配置和控制。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>流程展示</strong> — 以步骤条形式展示评估的各个阶段（准备 → 分析 → 评分 → 报告）</li>
  <li><strong>当前状态</strong> — 高亮当前执行阶段，展示进度百分比</li>
  <li><strong>阶段配置</strong> — 可配置各阶段使用的分析插件和参数</li>
  <li><strong>执行控制</strong> — 提供开始、暂停、继续、取消等操作按钮</li>
  <li><strong>耗时统计</strong> — 展示各阶段的执行耗时</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>执行评估任务时查看实时进度</li>
  <li>配置自定义评估工作流</li>
  <li>诊断评估任务执行缓慢的原因</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>workflow</code></td><td><code>EvaluationWorkflow</code></td><td>工作流配置数据</td></tr>
    <tr><td><code>currentStep</code></td><td><code>number</code></td><td>当前执行步骤索引</td></tr>
    <tr><td><code>status</code></td><td><code>'idle' | 'running' | 'paused' | 'completed' | 'failed'</code></td><td>工作流状态</td></tr>
    <tr><td><code>onStart</code></td><td><code>() =&gt; void</code></td><td>开始执行回调</td></tr>
    <tr><td><code>onPause</code></td><td><code>() =&gt; void</code></td><td>暂停执行回调</td></tr>
    <tr><td><code>onCancel</code></td><td><code>() =&gt; void</code></td><td>取消执行回调</td></tr>
  </tbody>
</table>
`,"toggle-section-shell":`
<h2>ToggleSectionShell</h2>
<p>可折叠壳组件，为任何内容区块提供统一的折叠/展开容器，是 Evaluation 模块中通用的布局组件。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>折叠/展开</strong> — 点击标题栏切换内容区可见性</li>
  <li><strong>动画过渡</strong> — 展开/收起带有平滑的高度动画</li>
  <li><strong>受控/非受控</strong> — 支持外部控制展开状态或组件内部自动管理</li>
  <li><strong>标题自定义</strong> — 标题栏支持自定义渲染（图标、标签、操作按钮）</li>
  <li><strong>展开指示器</strong> — 标题栏右侧的旋转箭头指示展开状态</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>评估结果中各区块的折叠容器</li>
  <li>任何需要按需展开/收起的内容区域</li>
  <li>替代 AccordionWrapper 在不需要多区块联动的场景</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>title</code></td><td><code>string | ReactNode</code></td><td>标题栏内容</td></tr>
    <tr><td><code>defaultOpen</code></td><td><code>boolean</code></td><td>默认是否展开</td></tr>
    <tr><td><code>open</code></td><td><code>boolean</code></td><td>受控模式下的展开状态</td></tr>
    <tr><td><code>onChange</code></td><td><code>(open: boolean) =&gt; void</code></td><td>展开状态变化回调</td></tr>
    <tr><td><code>children</code></td><td><code>ReactNode</code></td><td>折叠区内容</td></tr>
  </tbody>
</table>
`,"card-list":`
<h2>CardList</h2>
<p>卡片列表组件，以卡片网格或列表形式展示 Story Bible 中的实体条目，支持搜索和分类筛选。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>卡片网格</strong> — 以卡片形式展示条目，每张卡片显示标题、摘要和类型图标</li>
  <li><strong>列表视图</strong> — 可切换为紧凑列表模式，适合大量条目浏览</li>
  <li><strong>搜索筛选</strong> — 支持按关键词搜索和按类型/标签筛选</li>
  <li><strong>拖拽排序</strong> — 卡片支持拖拽调整顺序</li>
  <li><strong>选中状态</strong> — 点击卡片选中后高亮，支持多选</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>Story Bible 中浏览所有知识条目</li>
  <li>快速查找和定位特定实体</li>
  <li>批量选择实体进行操作</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>items</code></td><td><code>CardItem[]</code></td><td>卡片数据列表</td></tr>
    <tr><td><code>viewMode</code></td><td><code>'grid' | 'list'</code></td><td>展示模式</td></tr>
    <tr><td><code>onSelect</code></td><td><code>(id: string) =&gt; void</code></td><td>选中回调</td></tr>
    <tr><td><code>onReorder</code></td><td><code>(ids: string[]) =&gt; void</code></td><td>排序回调</td></tr>
    <tr><td><code>searchable</code></td><td><code>boolean</code></td><td>是否启用搜索</td></tr>
  </tbody>
</table>
`,"collapsible-section":`
<h2>CollapsibleSection</h2>
<p>可折叠区组件，为 Story Bible 面板中的内容区块提供折叠/展开交互，与 ToggleSectionShell 类似但针对 Story Bible 样式定制。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>折叠/展开</strong> — 平滑动画切换内容区可见性</li>
  <li><strong>计数徽章</strong> — 标题栏右侧可展示条目数量</li>
  <li><strong>操作按钮</strong> — 标题栏支持添加操作按钮（如新增、刷新）</li>
  <li><strong>空状态</strong> — 内容为空时展示友好的空状态提示</li>
  <li><strong>持久化状态</strong> — 可将展开/收起状态持久化到 localStorage</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>Story Bible 面板中按类别折叠展示知识条目</li>
  <li>Canon/Draft/Narrative 等区块的容器</li>
  <li>任何需要按需展示/隐藏的分组内容</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>title</code></td><td><code>string</code></td><td>区块标题</td></tr>
    <tr><td><code>count</code></td><td><code>number</code></td><td>条目数量</td></tr>
    <tr><td><code>defaultOpen</code></td><td><code>boolean</code></td><td>默认是否展开</td></tr>
    <tr><td><code>persistenceKey</code></td><td><code>string</code></td><td>状态持久化 key</td></tr>
    <tr><td><code>actions</code></td><td><code>ReactNode</code></td><td>操作区内容</td></tr>
    <tr><td><code>emptyText</code></td><td><code>string</code></td><td>空状态提示文本</td></tr>
    <tr><td><code>children</code></td><td><code>ReactNode</code></td><td>折叠区内容</td></tr>
  </tbody>
</table>
`,"narrative-record-list":`
<h2>NarrativeRecordList</h2>
<p>叙事记录列表组件，展示 Story Bible 中的叙事条目列表，支持按时间线或分类浏览。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>时间线视图</strong> — 按叙事发生时间排列条目</li>
  <li><strong>分类视图</strong> — 按叙事类型（事件、转折、伏笔等）分组展示</li>
  <li><strong>条目摘要</strong> — 每条记录展示标题、摘要、关联章节</li>
  <li><strong>状态标记</strong> — 标记叙事记录的状态（已确认/草稿/已废弃）</li>
  <li><strong>快速操作</strong> — 支持内联编辑状态和删除操作</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>Story Bible 中浏览所有叙事记录</li>
  <li>按时间线回顾故事发展脉络</li>
  <li>管理伏笔和转折的设置与回收</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>records</code></td><td><code>NarrativeRecord[]</code></td><td>叙事记录列表</td></tr>
    <tr><td><code>viewMode</code></td><td><code>'timeline' | 'category'</code></td><td>浏览模式</td></tr>
    <tr><td><code>onSelect</code></td><td><code>(id: string) =&gt; void</code></td><td>选中记录回调</td></tr>
    <tr><td><code>onStatusChange</code></td><td><code>(id: string, status: RecordStatus) =&gt; void</code></td><td>状态变更回调</td></tr>
    <tr><td><code>onDelete</code></td><td><code>(id: string) =&gt; void</code></td><td>删除记录回调</td></tr>
  </tbody>
</table>
`,"story-bible-canon-section":`
<h2>StoryBibleCanonSection</h2>
<p>Canon 区组件，展示和管理 Story Bible 中的 Canon（正典）条目，即已确认的、不可随意修改的核心设定。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>Canon 条目列表</strong> — 展示所有正典设定条目</li>
  <li><strong>锁定状态</strong> — Canon 条目标记为锁定，修改需确认操作</li>
  <li><strong>版本历史</strong> — 记录 Canon 条目的修改历史</li>
  <li><strong>保护机制</strong> — 修改 Canon 条目前弹出确认对话框，防止误改</li>
  <li><strong>分类浏览</strong> — 按设定类别（世界观、规则、约束等）分组展示</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>维护故事的核心设定，确保不被随意修改</li>
  <li>写作时查阅已确认的世界观规则</li>
  <li>审核对核心设定的修改请求</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>entries</code></td><td><code>CanonEntry[]</code></td><td>Canon 条目列表</td></tr>
    <tr><td><code>onEdit</code></td><td><code>(id: string, updates: Partial&lt;CanonEntry&gt;) =&gt; void</code></td><td>编辑条目回调（含确认）</td></tr>
    <tr><td><code>onViewHistory</code></td><td><code>(id: string) =&gt; void</code></td><td>查看版本历史回调</td></tr>
    <tr><td><code>onDemote</code></td><td><code>(id: string) =&gt; void</code></td><td>降级为草稿回调</td></tr>
  </tbody>
</table>
`,"story-bible-draft-section":`
<h2>StoryBibleDraftSection</h2>
<p>草稿区组件，展示和管理 Story Bible 中的 Draft（草稿）条目，即尚未正式确认的设定和想法。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>草稿条目列表</strong> — 展示所有草稿设定条目</li>
  <li><strong>自由编辑</strong> — 草稿条目可自由编辑，无需确认</li>
  <li><strong>升级为 Canon</strong> — 确认草稿后可升级为 Canon 条目</li>
  <li><strong>草稿来源</strong> — 标注草稿的来源（手动创建、AI 建议、从叙事提取）</li>
  <li><strong>合并去重</strong> — 检测相似草稿并提示合并</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>记录尚未成熟的设定想法</li>
  <li>审阅 AI 建议的设定，确认后升级为 Canon</li>
  <li>从叙事文本中提取的设定暂存区</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>entries</code></td><td><code>DraftEntry[]</code></td><td>草稿条目列表</td></tr>
    <tr><td><code>onCreate</code></td><td><code>(entry: DraftEntry) =&gt; void</code></td><td>创建草稿回调</td></tr>
    <tr><td><code>onEdit</code></td><td><code>(id: string, updates: Partial&lt;DraftEntry&gt;) =&gt; void</code></td><td>编辑草稿回调</td></tr>
    <tr><td><code>onPromote</code></td><td><code>(id: string) =&gt; void</code></td><td>升级为 Canon 回调</td></tr>
    <tr><td><code>onDelete</code></td><td><code>(id: string) =&gt; void</code></td><td>删除草稿回调</td></tr>
    <tr><td><code>onMerge</code></td><td><code>(ids: string[]) =&gt; void</code></td><td>合并草稿回调</td></tr>
  </tbody>
</table>
`,"story-bible-knowledge-section":`
<h2>StoryBibleKnowledgeSection</h2>
<p>知识区组件，展示和管理 Story Bible 中的知识条目，包括世界设定、规则体系等结构化知识。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>知识分类</strong> — 按类别组织知识条目（历史、地理、文化、科技等）</li>
  <li><strong>层级结构</strong> — 支持知识的层级关系（如魔法体系 → 元素系 → 火系）</li>
  <li><strong>交叉引用</strong> — 知识条目间可建立引用关系，形成知识网络</li>
  <li><strong>标签体系</strong> — 支持多维度标签分类</li>
  <li><strong>搜索与筛选</strong> — 按关键词和类别检索知识</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>构建故事世界的知识体系</li>
  <li>写作时快速查阅相关设定</li>
  <li>维护设定的交叉引用和一致性</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>entries</code></td><td><code>KnowledgeEntry[]</code></td><td>知识条目列表</td></tr>
    <tr><td><code>categories</code></td><td><code>string[]</code></td><td>知识类别列表</td></tr>
    <tr><td><code>onCreate</code></td><td><code>(entry: KnowledgeEntry) =&gt; void</code></td><td>创建条目回调</td></tr>
    <tr><td><code>onEdit</code></td><td><code>(id: string, updates: Partial&lt;KnowledgeEntry&gt;) =&gt; void</code></td><td>编辑条目回调</td></tr>
    <tr><td><code>onLink</code></td><td><code>(fromId: string, toId: string) =&gt; void</code></td><td>建立引用回调</td></tr>
  </tbody>
</table>
`,"story-bible-narrative-section":`
<h2>StoryBibleNarrativeSection</h2>
<p>叙事区组件，展示和管理 Story Bible 中的叙事条目，记录故事中已发生的事件和叙事线索。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>叙事条目列表</strong> — 展示所有叙事记录</li>
  <li><strong>时间线排列</strong> — 按故事内时间顺序排列叙事事件</li>
  <li><strong>线索追踪</strong> — 标记叙事线索的状态（活跃/已回收/已废弃）</li>
  <li><strong>实体关联</strong> — 将叙事条目与角色、地点等实体关联</li>
  <li><strong>AI 提取</strong> — 从写作文本中自动提取叙事事件</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>追踪故事中已展开的叙事线索</li>
  <li>确保伏笔的合理回收</li>
  <li>审阅 AI 自动提取的叙事事件</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>entries</code></td><td><code>NarrativeEntry[]</code></td><td>叙事条目列表</td></tr>
    <tr><td><code>onCreate</code></td><td><code>(entry: NarrativeEntry) =&gt; void</code></td><td>创建条目回调</td></tr>
    <tr><td><code>onEdit</code></td><td><code>(id: string, updates: Partial&lt;NarrativeEntry&gt;) =&gt; void</code></td><td>编辑条目回调</td></tr>
    <tr><td><code>onLinkEntity</code></td><td><code>(entryId: string, entityId: string) =&gt; void</code></td><td>关联实体回调</td></tr>
    <tr><td><code>onExtract</code></td><td><code>() =&gt; void</code></td><td>AI 提取回调</td></tr>
  </tbody>
</table>
`,"story-bible-panel-content":`
<h2>StoryBiblePanelContent</h2>
<p>面板内容组件，Story Bible 面板的主内容区容器，整合 Canon/Draft/Knowledge/Narrative 各区块并提供统一的导航和搜索。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>区块导航</strong> — 顶部标签栏快速切换 Canon/Draft/Knowledge/Narrative 区块</li>
  <li><strong>全局搜索</strong> — 跨区块搜索所有 Story Bible 条目</li>
  <li><strong>统计概览</strong> — 展示各区块的条目数量统计</li>
  <li><strong>最近修改</strong> — 展示最近修改的条目列表</li>
  <li><strong>快速创建</strong> — 提供快速创建各类条目的入口</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>作为 Story Bible 面板的主体内容区</li>
  <li>统一入口管理所有 Story Bible 数据</li>
  <li>快速检索和定位特定设定条目</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>activeSection</code></td><td><code>'canon' | 'draft' | 'knowledge' | 'narrative'</code></td><td>当前激活区块</td></tr>
    <tr><td><code>onSectionChange</code></td><td><code>(section: string) =&gt; void</code></td><td>区块切换回调</td></tr>
    <tr><td><code>searchQuery</code></td><td><code>string</code></td><td>搜索关键词</td></tr>
    <tr><td><code>onSearch</code></td><td><code>(query: string) =&gt; void</code></td><td>搜索回调</td></tr>
  </tbody>
</table>
`,"ai-context-selector":`
<h2>AiContextSelector</h2>
<p>AI 上下文选择器组件，用于选择和配置发送给 AI 的上下文信息，控制 AI 能够访问的知识范围。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>上下文来源选择</strong> — 可选择 Story Bible、Knowledge Graph、写作历史等作为上下文来源</li>
  <li><strong>实体勾选</strong> — 从各来源中勾选具体的实体条目加入上下文</li>
  <li><strong>上下文预览</strong> — 预览实际发送给 AI 的上下文内容</li>
  <li><strong>Token 估算</strong> — 实时估算上下文的 Token 数量，避免超出限制</li>
  <li><strong>模板预设</strong> — 保存和加载常用的上下文配置模板</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>在 AI 对话前选择需要参考的设定和知识</li>
  <li>控制 AI 的知识边界，避免信息过载或遗漏</li>
  <li>为不同写作场景配置不同的上下文模板</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>selectedSources</code></td><td><code>ContextSource[]</code></td><td>已选上下文来源</td></tr>
    <tr><td><code>selectedEntities</code></td><td><code>string[]</code></td><td>已选实体 ID 列表</td></tr>
    <tr><td><code>tokenEstimate</code></td><td><code>number</code></td><td>当前 Token 估算值</td></tr>
    <tr><td><code>maxTokens</code></td><td><code>number</code></td><td>Token 上限</td></tr>
    <tr><td><code>onSourceToggle</code></td><td><code>(source: ContextSource) =&gt; void</code></td><td>来源切换回调</td></tr>
    <tr><td><code>onEntityToggle</code></td><td><code>(entityId: string) =&gt; void</code></td><td>实体勾选回调</td></tr>
    <tr><td><code>onSaveTemplate</code></td><td><code>(name: string) =&gt; void</code></td><td>保存模板回调</td></tr>
  </tbody>
</table>
`,"conflict-resolution-panel":`
<h2>ConflictResolutionPanel</h2>
<p>冲突解决面板组件，当多个知识来源或写作版本之间出现矛盾时，提供可视化的冲突检测和解决界面。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>冲突检测</strong> — 自动检测知识库和叙事文本之间的矛盾和冲突</li>
  <li><strong>冲突列表</strong> — 按严重程度排列的冲突清单，标注冲突类型（事实矛盾、设定不一致等）</li>
  <li><strong>对比视图</strong> — 并排展示冲突的多个版本，高亮差异</li>
  <li><strong>解决操作</strong> — 提供选择保留版本、手动合并、AI 辅助解决等操作</li>
  <li><strong>解决历史</strong> — 记录冲突解决的决策历史</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>编辑设定后发现与已有叙事矛盾</li>
  <li>多版本草稿之间的内容冲突</li>
  <li>AI 生成内容与已有设定不一致</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>conflicts</code></td><td><code>Conflict[]</code></td><td>冲突列表</td></tr>
    <tr><td><code>onResolve</code></td><td><code>(conflictId: string, resolution: Resolution) =&gt; void</code></td><td>解决冲突回调</td></tr>
    <tr><td><code>onMerge</code></td><td><code>(conflictId: string, merged: string) =&gt; void</code></td><td>手动合并回调</td></tr>
    <tr><td><code>onAiAssist</code></td><td><code>(conflictId: string) =&gt; void</code></td><td>AI 辅助解决回调</td></tr>
    <tr><td><code>onDismiss</code></td><td><code>(conflictId: string) =&gt; void</code></td><td>忽略冲突回调</td></tr>
  </tbody>
</table>
`,"writing-context-panel":`
<h2>WritingContextPanel</h2>
<p>写作上下文面板组件，整合展示当前写作场景的所有上下文信息，包括相关设定、角色状态、情节进度等。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>上下文汇总</strong> — 聚合当前光标位置相关的所有上下文信息</li>
  <li><strong>角色状态</strong> — 展示当前场景涉及角色的最新状态</li>
  <li><strong>情节进度</strong> — 展示当前章节在情节线中的位置</li>
  <li><strong>设定参考</strong> — 展示与当前场景相关的世界设定</li>
  <li><strong>上下文注入</strong> — 一键将选中的上下文信息注入 AI 对话</li>
  <li><strong>自动更新</strong> — 光标移动或文本修改时自动刷新上下文</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>写作时在侧边栏查阅当前场景的完整上下文</li>
  <li>确保角色行为与设定一致</li>
  <li>快速将上下文信息提供给 AI 辅助写作</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>context</code></td><td><code>WritingContext</code></td><td>写作上下文数据</td></tr>
    <tr><td><code>onInject</code></td><td><code>(contextIds: string[]) =&gt; void</code></td><td>注入上下文回调</td></tr>
    <tr><td><code>onRefresh</code></td><td><code>() =&gt; void</code></td><td>刷新上下文回调</td></tr>
    <tr><td><code>onNavigate</code></td><td><code>(entityId: string) =&gt; void</code></td><td>导航到实体详情回调</td></tr>
    <tr><td><code>autoRefresh</code></td><td><code>boolean</code></td><td>是否自动刷新</td></tr>
  </tbody>
</table>
`,"graph-context-menu":`
<h2>GraphContextMenu</h2>
<p>图谱上下文菜单组件，在知识图谱中右键点击节点或边时弹出，提供节点/边相关的操作菜单。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>节点操作</strong> — 右键节点弹出编辑、删除、展开关联、高亮路径等操作</li>
  <li><strong>边操作</strong> — 右键边弹出编辑关系、删除连接、修改权重等操作</li>
  <li><strong>画布操作</strong> — 右键空白区域弹出添加节点、重置视图等操作</li>
  <li><strong>自定义菜单项</strong> — 支持注册自定义菜单项扩展功能</li>
  <li><strong>位置跟随</strong> — 菜单位置跟随鼠标，自动适配画布边界</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>在知识图谱中快速编辑节点属性</li>
  <li>管理图谱中实体间的关系</li>
  <li>通过右键菜单触发图谱相关操作</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>position</code></td><td><code>{ x: number; y: number }</code></td><td>菜单位置</td></tr>
    <tr><td><code>target</code></td><td><code>Node | Edge | 'canvas'</code></td><td>右键目标对象</td></tr>
    <tr><td><code>items</code></td><td><code>MenuItem[]</code></td><td>菜单项列表</td></tr>
    <tr><td><code>onAction</code></td><td><code>(action: string) =&gt; void</code></td><td>菜单操作回调</td></tr>
    <tr><td><code>onClose</code></td><td><code>() =&gt; void</code></td><td>关闭菜单回调</td></tr>
  </tbody>
</table>
`,"graph-minimap":`
<h2>GraphMinimap</h2>
<p>图谱缩略图组件，在知识图谱角落展示全局缩略视图，方便在大规模图谱中快速定位和导航。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>全局缩略</strong> — 以缩放比例展示整个图谱的全貌</li>
  <li><strong>视口框</strong> — 用矩形框标识当前视口的可见范围</li>
  <li><strong>拖拽导航</strong> — 拖拽缩略图中的视口框快速平移主视图</li>
  <li><strong>节点高亮</strong> — 缩略图中高亮选中或搜索到的节点</li>
  <li><strong>可折叠</strong> — 可最小化为小图标，节省空间</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>大规模知识图谱中快速定位感兴趣的节点</li>
  <li>了解图谱的整体结构和布局</li>
  <li>在缩放和拖拽后快速回到特定区域</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>graphData</code></td><td><code>GraphData</code></td><td>图谱数据</td></tr>
    <tr><td><code>viewport</code></td><td><code>ViewportState</code></td><td>当前视口状态</td></tr>
    <tr><td><code>onViewportChange</code></td><td><code>(viewport: ViewportState) =&gt; void</code></td><td>视口变化回调</td></tr>
    <tr><td><code>highlightNodes</code></td><td><code>string[]</code></td><td>需高亮的节点 ID</td></tr>
    <tr><td><code>collapsible</code></td><td><code>boolean</code></td><td>是否可折叠</td></tr>
  </tbody>
</table>
`,"knowledge-graph-toolbar":`
<h2>KnowledgeGraphToolbar</h2>
<p>图谱工具栏组件，提供知识图谱的布局控制、筛选、缩放等常用操作入口。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>布局切换</strong> — 在力导向图、层级图、环形图等布局间切换</li>
  <li><strong>缩放控制</strong> — 放大、缩小、适配画布等缩放操作</li>
  <li><strong>节点筛选</strong> — 按类型、标签筛选显示的节点</li>
  <li><strong>搜索定位</strong> — 搜索节点名称并自动定位到对应位置</li>
  <li><strong>导出</strong> — 将图谱导出为图片或 JSON</li>
  <li><strong>全屏模式</strong> — 一键切换全屏查看图谱</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>切换图谱布局以不同视角理解知识网络</li>
  <li>在大规模图谱中搜索和定位特定节点</li>
  <li>导出图谱用于分享和展示</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>layout</code></td><td><code>'force' | 'hierarchy' | 'circular'</code></td><td>当前布局类型</td></tr>
    <tr><td><code>onLayoutChange</code></td><td><code>(layout: string) =&gt; void</code></td><td>布局切换回调</td></tr>
    <tr><td><code>onZoom</code></td><td><code>(direction: 'in' | 'out' | 'fit') =&gt; void</code></td><td>缩放回调</td></tr>
    <tr><td><code>onSearch</code></td><td><code>(query: string) =&gt; void</code></td><td>搜索回调</td></tr>
    <tr><td><code>onFilter</code></td><td><code>(filters: FilterState) =&gt; void</code></td><td>筛选回调</td></tr>
    <tr><td><code>onExport</code></td><td><code>(format: 'png' | 'svg' | 'json') =&gt; void</code></td><td>导出回调</td></tr>
    <tr><td><code>onFullscreen</code></td><td><code>() =&gt; void</code></td><td>全屏切换回调</td></tr>
  </tbody>
</table>
`,"knowledge-graph-view":`
<h2>KnowledgeGraphView</h2>
<p>图谱视图组件，知识图谱的主渲染视图，基于 Canvas 或 SVG 绘制节点和边，支持交互式浏览。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>节点渲染</strong> — 按实体类型着色和标注的节点展示</li>
  <li><strong>边渲染</strong> — 按关系类型着色和标注的连线展示</li>
  <li><strong>拖拽交互</strong> — 拖拽节点调整布局，拖拽画布平移视图</li>
  <li><strong>缩放</strong> — 鼠标滚轮缩放，支持捏合手势</li>
  <li><strong>节点选择</strong> — 点击选中节点，展示详情面板</li>
  <li><strong>力导向布局</strong> — 自动计算节点位置，支持实时布局动画</li>
  <li><strong>性能优化</strong> — 大规模图谱下启用 WebGL 渲染和虚拟化</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>以可视化方式浏览知识库中实体间的关系网络</li>
  <li>发现实体间的隐含关联</li>
  <li>直观理解故事世界的知识结构</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>nodes</code></td><td><code>GraphNode[]</code></td><td>节点数据</td></tr>
    <tr><td><code>edges</code></td><td><code>GraphEdge[]</code></td><td>边数据</td></tr>
    <tr><td><code>layout</code></td><td><code>LayoutType</code></td><td>布局类型</td></tr>
    <tr><td><code>onNodeClick</code></td><td><code>(nodeId: string) =&gt; void</code></td><td>节点点击回调</td></tr>
    <tr><td><code>onEdgeClick</code></td><td><code>(edgeId: string) =&gt; void</code></td><td>边点击回调</td></tr>
    <tr><td><code>onNodeDrag</code></td><td><code>(nodeId: string, position: Position) =&gt; void</code></td><td>节点拖拽回调</td></tr>
    <tr><td><code>selectedNodeId</code></td><td><code>string | null</code></td><td>当前选中节点</td></tr>
  </tbody>
</table>
`,"sidebar-graph-view":`
<h2>SidebarGraphView</h2>
<p>侧边栏图谱视图组件，在侧边栏中展示知识图谱的精简版本，聚焦于当前选中实体的局部关系网络。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>局部视图</strong> — 仅展示当前选中实体及其直接关联的节点</li>
  <li><strong>紧凑布局</strong> — 适配侧边栏宽度的紧凑布局</li>
  <li><strong>实体切换</strong> — 切换中心实体时自动刷新图谱</li>
  <li><strong>快捷操作</strong> — 在侧边栏中直接对节点进行基本操作</li>
  <li><strong>展开到全屏</strong> — 提供一键跳转到完整 KnowledgeGraphView 的入口</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>在侧边栏中快速查看当前实体的关系网络</li>
  <li>写作时无需切换面板即可浏览局部知识图谱</li>
  <li>从局部视图发现感兴趣的关联后展开查看全貌</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>centerEntityId</code></td><td><code>string</code></td><td>中心实体 ID</td></tr>
    <tr><td><code>depth</code></td><td><code>number</code></td><td>展开深度，默认 1</td></tr>
    <tr><td><code>onNodeClick</code></td><td><code>(nodeId: string) =&gt; void</code></td><td>节点点击回调</td></tr>
    <tr><td><code>onExpand</code></td><td><code>() =&gt; void</code></td><td>展开到全屏回调</td></tr>
  </tbody>
</table>
`,"brainstorm-panel":`
<h2>BrainstormPanel</h2>
<p>头脑风暴面板组件，提供 AI 驱动的叙事头脑风暴功能，帮助作者拓展创作思路和探索叙事可能性。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>主题输入</strong> — 输入头脑风暴的主题或问题</li>
  <li><strong>AI 建议</strong> — AI 基于当前上下文生成多个创意方案</li>
  <li><strong>方案评分</strong> — 对每个方案进行创意性、可行性、契合度评分</li>
  <li><strong>方案对比</strong> — 并排对比多个方案的优劣</li>
  <li><strong>方案采纳</strong> — 选中方案后一键应用到叙事中</li>
  <li><strong>迭代深化</strong> — 对选中的方案继续追问和深化</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>遇到创作瓶颈时寻求 AI 的创意启发</li>
  <li>探索同一情节的多种发展可能</li>
  <li>评估不同叙事选择的优劣</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>topic</code></td><td><code>string</code></td><td>头脑风暴主题</td></tr>
    <tr><td><code>suggestions</code></td><td><code>BrainstormSuggestion[]</code></td><td>AI 生成的建议列表</td></tr>
    <tr><td><code>onGenerate</code></td><td><code>(topic: string) =&gt; void</code></td><td>生成建议回调</td></tr>
    <tr><td><code>onAdopt</code></td><td><code>(suggestionId: string) =&gt; void</code></td><td>采纳建议回调</td></tr>
    <tr><td><code>onIterate</code></td><td><code>(suggestionId: string, question: string) =&gt; void</code></td><td>迭代深化回调</td></tr>
    <tr><td><code>loading</code></td><td><code>boolean</code></td><td>是否正在生成</td></tr>
  </tbody>
</table>
`,"foreshadow-panel":`
<h2>ForeshadowPanel</h2>
<p>伏笔面板组件，管理和追踪故事中的伏笔设置与回收，确保叙事的完整性和一致性。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>伏笔列表</strong> — 展示所有已设置的伏笔，标注状态（已设置/已暗示/已回收/已废弃）</li>
  <li><strong>伏笔详情</strong> — 展示伏笔的设置位置、暗示线索、预期回收点</li>
  <li><strong>回收提醒</strong> — 检测长期未回收的伏笔，发出提醒</li>
  <li><strong>冲突检测</strong> — 检测伏笔与实际叙事之间的矛盾</li>
  <li><strong>AI 建议</strong> — AI 分析当前叙事，建议伏笔的回收时机和方式</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>写作前规划伏笔的设置和回收计划</li>
  <li>写作中追踪伏笔的推进状态</li>
  <li>审稿时检查伏笔是否全部合理回收</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>foreshadows</code></td><td><code>Foreshadow[]</code></td><td>伏笔数据列表</td></tr>
    <tr><td><code>onCreate</code></td><td><code>(foreshadow: Foreshadow) =&gt; void</code></td><td>创建伏笔回调</td></tr>
    <tr><td><code>onUpdate</code></td><td><code>(id: string, updates: Partial&lt;Foreshadow&gt;) =&gt; void</code></td><td>更新伏笔回调</td></tr>
    <tr><td><code>onResolve</code></td><td><code>(id: string) =&gt; void</code></td><td>回收伏笔回调</td></tr>
    <tr><td><code>onAiSuggest</code></td><td><code>(id: string) =&gt; void</code></td><td>AI 建议回调</td></tr>
  </tbody>
</table>
`,"quality-score-panel":`
<h2>QualityScorePanel</h2>
<p>质量评分面板组件，展示 AI 对当前文本的写作质量评估结果，以多维度评分和综合评级的形式呈现。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>综合评分</strong> — 以大数字和评级徽章展示整体质量评分</li>
  <li><strong>维度评分</strong> — 展示各写作维度（叙事、对话、描写、节奏等）的独立评分</li>
  <li><strong>雷达图</strong> — 以雷达图形式直观展示各维度的均衡度</li>
  <li><strong>历史趋势</strong> — 展示评分随章节的变化趋势</li>
  <li><strong>评分说明</strong> — 点击维度查看 AI 生成的评估说明和改进建议</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>完成一段写作后快速评估整体质量</li>
  <li>对比各维度的得分找到薄弱环节</li>
  <li>追踪写作质量的长期变化趋势</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>score</code></td><td><code>QualityScore</code></td><td>质量评分数据</td></tr>
    <tr><td><code>dimensions</code></td><td><code>DimensionScore[]</code></td><td>各维度评分数据</td></tr>
    <tr><td><code>history</code></td><td><code>QualityScore[]</code></td><td>历史评分数据</td></tr>
    <tr><td><code>onDimensionClick</code></td><td><code>(dimension: string) =&gt; void</code></td><td>维度点击回调</td></tr>
    <tr><td><code>onRefresh</code></td><td><code>() =&gt; void</code></td><td>重新评分回调</td></tr>
  </tbody>
</table>
`,"character-graph-view":`
<h2>CharacterGraphView</h2>
<p>角色图谱视图组件，以图的形式展示角色间的关系网络，直观呈现角色关系的复杂度和结构。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>关系图谱</strong> — 节点代表角色，边代表关系，边的颜色/粗细表示关系类型/强度</li>
  <li><strong>关系类型</strong> — 区分友谊、敌对、爱情、家庭等多种关系类型</li>
  <li><strong>互动频次</strong> — 边的粗细反映角色间的互动频次</li>
  <li><strong>角色筛选</strong> — 按章节或场景筛选角色关系</li>
  <li><strong>聚焦模式</strong> — 选中一个角色后高亮其直接关联，淡出其他角色</li>
  <li><strong>动态更新</strong> — 写作过程中实时更新角色关系图谱</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>规划角色关系网络</li>
  <li>检查角色互动是否均衡</li>
  <li>发现角色间的潜在互动机会</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>characters</code></td><td><code>Character[]</code></td><td>角色数据</td></tr>
    <tr><td><code>relationships</code></td><td><code>Relationship[]</code></td><td>关系数据</td></tr>
    <tr><td><code>focusCharacterId</code></td><td><code>string | null</code></td><td>聚焦角色 ID</td></tr>
    <tr><td><code>chapterFilter</code></td><td><code>number | null</code></td><td>章节筛选</td></tr>
    <tr><td><code>onCharacterClick</code></td><td><code>(characterId: string) =&gt; void</code></td><td>角色点击回调</td></tr>
    <tr><td><code>onRelationshipClick</code></td><td><code>(relationshipId: string) =&gt; void</code></td><td>关系点击回调</td></tr>
  </tbody>
</table>
`,"tension-curve-view":`
<h2>TensionCurveView</h2>
<p>张力曲线视图组件，以折线图形式展示故事张力的起伏变化，帮助作者把控叙事节奏。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>张力曲线</strong> — 按章节/场景展示张力值的变化曲线</li>
  <li><strong>事件标注</strong> — 在曲线关键点标注对应的叙事事件</li>
  <li><strong>理想曲线对比</strong> — 叠加经典叙事结构（三幕式、英雄之旅等）的理想张力曲线</li>
  <li><strong>节奏分析</strong> — AI 分析当前节奏模式并给出建议</li>
  <li><strong>局部缩放</strong> — 可缩放查看特定章节的张力细节</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>审阅故事整体节奏是否合理</li>
  <li>对比实际张力与经典叙事结构的差异</li>
  <li>定位张力过低或过高的问题章节</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>data</code></td><td><code>TensionPoint[]</code></td><td>张力数据点</td></tr>
    <tr><td><code>referenceCurve</code></td><td><code>'three-act' | 'hero-journey' | null</code></td><td>对比的经典曲线</td></tr>
    <tr><td><code>annotations</code></td><td><code>EventAnnotation[]</code></td><td>事件标注</td></tr>
    <tr><td><code>onPointClick</code></td><td><code>(index: number) =&gt; void</code></td><td>数据点点击回调</td></tr>
    <tr><td><code>onAnalyze</code></td><td><code>() =&gt; void</code></td><td>AI 节奏分析回调</td></tr>
  </tbody>
</table>
`,"timeline-view":`
<h2>TimelineView</h2>
<p>时间线视图组件，以时间轴形式展示故事中的事件序列，支持故事内时间和现实时间的双轴展示。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>时间轴展示</strong> — 水平时间轴上展示事件节点</li>
  <li><strong>多时间线</strong> — 支持多条时间线（不同角色/地点的并行事件线）</li>
  <li><strong>时间缩放</strong> — 支持按年/月/日/小时不同粒度查看</li>
  <li><strong>事件详情</strong> — 点击事件节点展示详细描述</li>
  <li><strong>持续时间</strong> — 支持展示持续一段时间的长事件</li>
  <li><strong>拖拽调整</strong> — 拖拽事件节点调整其在时间线上的位置</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>梳理故事中的事件顺序和时间逻辑</li>
  <li>检查多线叙事的时间线是否自洽</li>
  <li>规划后续章节的时间安排</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>events</code></td><td><code>TimelineEvent[]</code></td><td>时间线事件数据</td></tr>
    <tr><td><code>lanes</code></td><td><code>TimelineLane[]</code></td><td>时间线轨道配置</td></tr>
    <tr><td><code>scale</code></td><td><code>'year' | 'month' | 'day' | 'hour'</code></td><td>时间粒度</td></tr>
    <tr><td><code>onEventClick</code></td><td><code>(eventId: string) =&gt; void</code></td><td>事件点击回调</td></tr>
    <tr><td><code>onEventDrag</code></td><td><code>(eventId: string, newTime: Date) =&gt; void</code></td><td>事件拖拽回调</td></tr>
  </tbody>
</table>
`,"visualization-toolbar":`
<h2>VisualizationToolbar</h2>
<p>可视化工具栏组件，为叙事可视化视图提供统一的工具栏，包含视图切换、导出和配置操作。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>视图切换</strong> — 在角色图谱、张力曲线、时间线之间快速切换</li>
  <li><strong>导出功能</strong> — 将当前可视化导出为图片</li>
  <li><strong>数据筛选</strong> — 按章节、角色、时间范围筛选数据</li>
  <li><strong>显示选项</strong> — 控制标注、网格、参考线等显示元素</li>
  <li><strong>全屏模式</strong> — 一键进入全屏查看</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>在不同可视化视图间快速切换</li>
  <li>调整可视化展示参数</li>
  <li>导出可视化结果用于分享</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>activeView</code></td><td><code>'character-graph' | 'tension-curve' | 'timeline'</code></td><td>当前视图</td></tr>
    <tr><td><code>onViewChange</code></td><td><code>(view: string) =&gt; void</code></td><td>视图切换回调</td></tr>
    <tr><td><code>onExport</code></td><td><code>(format: 'png' | 'svg') =&gt; void</code></td><td>导出回调</td></tr>
    <tr><td><code>onFilter</code></td><td><code>(filters: VizFilters) =&gt; void</code></td><td>筛选回调</td></tr>
    <tr><td><code>onFullscreen</code></td><td><code>() =&gt; void</code></td><td>全屏切换回调</td></tr>
    <tr><td><code>displayOptions</code></td><td><code>DisplayOptions</code></td><td>显示选项状态</td></tr>
  </tbody>
</table>
`,"math-view":`
<h2>MathView</h2>
<p>数学公式视图扩展，为编辑器提供数学公式的渲染和编辑能力，基于 KaTeX 实现数学符号的实时预览。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>公式渲染</strong> — 将 LaTeX 语法编写的数学公式渲染为可视化公式</li>
  <li><strong>实时预览</strong> — 编辑 LaTeX 代码时实时更新渲染结果</li>
  <li><strong>行内/块级</strong> — 支持行内公式（<code>$...$</code>）和块级公式（<code>$$...$$</code>）</li>
  <li><strong>点击编辑</strong> — 点击渲染后的公式回到 LaTeX 编辑模式</li>
  <li><strong>公式库</strong> — 提供常用数学公式的快捷插入</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>在写作中插入数学公式（如科幻作品中的公式推导）</li>
  <li>编写包含数学内容的技术文档</li>
  <li>教学材料中展示数学表达式</li>
</ul>

<h3>配置说明</h3>
<table>
  <thead>
    <tr><th>选项</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>enabled</code></td><td><code>boolean</code></td><td>是否启用数学公式扩展</td></tr>
    <tr><td><code>engine</code></td><td><code>'katex' | 'mathjax'</code></td><td>渲染引擎</td></tr>
    <tr><td><code>macros</code></td><td><code>Record&lt;string, string&gt;</code></td><td>自定义 LaTeX 宏</td></tr>
  </tbody>
</table>
`,"show-tell-decorations":`
<h2>ShowTellDecorations</h2>
<p>Show/Tell 装饰扩展，在编辑器中为文本添加 Show（展示/描写）和 Tell（叙述/概括）的视觉装饰，帮助作者直观了解写作手法的分布。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>Show 高亮</strong> — 以绿色背景高亮标记 Show 写法（通过描写展现情感和事件）</li>
  <li><strong>Tell 高亮</strong> — 以橙色背景高亮标记 Tell 写法（直接叙述情感和事件）</li>
  <li><strong>悬停提示</strong> — 悬停高亮区域时显示该段文本的 Show/Tell 分类理由</li>
  <li><strong>开关控制</strong> — 可通过命令面板或工具栏开关装饰的显示</li>
  <li><strong>实时更新</strong> — 文本修改后自动重新分析并更新装饰</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>审视写作中 Show/Tell 的比例和分布</li>
  <li>识别过度使用 Tell 的段落，增强描写</li>
  <li>写作教学中的 Show vs Tell 演示</li>
</ul>

<h3>配置说明</h3>
<table>
  <thead>
    <tr><th>选项</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>enabled</code></td><td><code>boolean</code></td><td>是否启用 Show/Tell 装饰</td></tr>
    <tr><td><code>showColor</code></td><td><code>string</code></td><td>Show 高亮颜色</td></tr>
    <tr><td><code>tellColor</code></td><td><code>string</code></td><td>Tell 高亮颜色</td></tr>
    <tr><td><code>autoAnalyze</code></td><td><code>boolean</code></td><td>是否在编辑时自动分析</td></tr>
  </tbody>
</table>
`,"voice-consistency-decorations":`
<h2>VoiceConsistencyDecorations</h2>
<p>声纹一致性装饰扩展，在编辑器中检测和标记角色对话的声纹一致性问题，帮助作者保持角色语言的独特性。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>声纹检测</strong> — 分析角色对话的语言特征（用词、句式、语气等）</li>
  <li><strong>一致性标记</strong> — 标记与角色声纹特征不一致的对话段落</li>
  <li><strong>声纹画像</strong> — 为每个角色建立声纹画像，可视化展示语言特征</li>
  <li><strong>悬停提示</strong> — 悬停标记区域时展示不一致的具体原因和修改建议</li>
  <li><strong>角色区分</strong> — 以不同颜色标记不同角色的对话</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>检查角色对话是否符合其设定的语言风格</li>
  <li>发现不同角色说话风格过于相似的问题</li>
  <li>帮助新手作者培养角色语言的差异化意识</li>
</ul>

<h3>配置说明</h3>
<table>
  <thead>
    <tr><th>选项</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>enabled</code></td><td><code>boolean</code></td><td>是否启用声纹一致性装饰</td></tr>
    <tr><td><code>sensitivity</code></td><td><code>'low' | 'medium' | 'high'</code></td><td>检测灵敏度</td></tr>
    <tr><td><code>highlightMode</code></td><td><code>'by-character' | 'by-issue'</code></td><td>高亮模式：按角色着色或按问题着色</td></tr>
  </tbody>
</table>
`,"vault-selector":`
<h2>VaultSelector</h2>
<p>Vault 选择器组件，用于选择和管理数据存储 Vault，支持多 Vault 切换和新建。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>Vault 列表</strong> — 展示所有可用的 Vault，标注当前激活的 Vault</li>
  <li><strong>Vault 切换</strong> — 选择不同 Vault 后自动加载对应的数据和配置</li>
  <li><strong>新建 Vault</strong> — 输入名称创建新的 Vault</li>
  <li><strong>Vault 信息</strong> — 展示 Vault 的存储路径、大小、最后修改时间等信息</li>
  <li><strong>导入/导出</strong> — 支持 Vault 数据的导入和导出</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>在多个写作项目间切换 Vault</li>
  <li>为不同的作品系列创建独立的 Vault</li>
  <li>备份和迁移 Vault 数据</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>vaults</code></td><td><code>Vault[]</code></td><td>Vault 列表</td></tr>
    <tr><td><code>activeVaultId</code></td><td><code>string</code></td><td>当前激活 Vault ID</td></tr>
    <tr><td><code>onSelect</code></td><td><code>(vaultId: string) =&gt; void</code></td><td>Vault 选择回调</td></tr>
    <tr><td><code>onCreate</code></td><td><code>(name: string) =&gt; void</code></td><td>创建 Vault 回调</td></tr>
    <tr><td><code>onImport</code></td><td><code>(path: string) =&gt; void</code></td><td>导入 Vault 回调</td></tr>
    <tr><td><code>onExport</code></td><td><code>(vaultId: string, targetPath: string) =&gt; void</code></td><td>导出 Vault 回调</td></tr>
  </tbody>
</table>
`},dt={...O,...B,...j,...U,...F,...$,...z,...K,...Q,...X,...J,...Y,...tt,...et};function it(e){return dt[e]||"<p>文档内容正在编写中...</p>"}const ot={"getting-started":"第一次接触 Niko Studio 的写作者或团队成员",guides:"需要快速建立路径感的写作者、开发者与维护者",writing:"日常进行创作分析和修订的写作者",graph:"需要追踪关系、伏笔与结构连接的作者或分析者",critic:"关注问题定位、证据和修订建议的作者",worldview:"需要维护长期设定一致性的作者",agent:"依赖自然语言入口来驱动多能力协作的用户",knowledge:"需要理解评分依据和知识支撑的开发者或高级作者",memory:"需要管理项目素材与证据来源的用户",desktop:"需要理解桌面工作台与 UI 入口的用户",sync:"关心多设备协作边界的维护者或高级用户",architecture:"需要理解 runtime 边界和模块职责的开发者",api:"需要接入、调试和验证接口边界的集成者与开发者"},G={guides:[{label:"章节修订专题路径",to:"/guides/chapter-revision-playbook",kind:"scenario"},{label:"写作 API",to:"/api/writing-api",kind:"endpoint"},{label:"输出字段词典",to:"/guides/output-field-glossary",kind:"glossary"}],writing:[{label:"常见写作问题索引",to:"/guides/common-writing-problems",kind:"scenario"},{label:"写作 API",to:"/api/writing-api",kind:"endpoint"},{label:"输出字段词典",to:"/guides/output-field-glossary",kind:"glossary"}],critic:[{label:"章节修订专题路径",to:"/guides/chapter-revision-playbook",kind:"scenario"},{label:"批评 API",to:"/api/critic-api",kind:"endpoint"},{label:"输出字段词典",to:"/guides/output-field-glossary",kind:"glossary"}],graph:[{label:"常见写作问题索引",to:"/guides/common-writing-problems",kind:"scenario"},{label:"图谱 API",to:"/api/graph-api",kind:"endpoint"},{label:"输出字段词典",to:"/guides/output-field-glossary",kind:"glossary"}],worldview:[{label:"从大纲到完稿",to:"/guides/outline-to-final-manuscript",kind:"scenario"},{label:"Wiki API",to:"/api/wiki-api",kind:"endpoint"},{label:"输出字段词典",to:"/guides/output-field-glossary",kind:"glossary"}],agent:[{label:"章节修订专题路径",to:"/guides/chapter-revision-playbook",kind:"scenario"},{label:"Agent API",to:"/api/agent-api",kind:"endpoint"},{label:"输出字段词典",to:"/guides/output-field-glossary",kind:"glossary"}],desktop:[{label:"从大纲到完稿",to:"/guides/outline-to-final-manuscript",kind:"scenario"},{label:"Workspace API",to:"/api/workspace-api",kind:"endpoint"},{label:"输出字段词典",to:"/guides/output-field-glossary",kind:"glossary"}],memory:[{label:"常见写作问题索引",to:"/guides/common-writing-problems",kind:"scenario"},{label:"素材 API",to:"/api/memory-api",kind:"endpoint"},{label:"输出字段词典",to:"/guides/output-field-glossary",kind:"glossary"}],api:[{label:"请求生命周期",to:"/guides/request-lifecycle",kind:"scenario"},{label:"Workflow API",to:"/api/workflow-api",kind:"endpoint"},{label:"输出字段词典",to:"/guides/output-field-glossary",kind:"glossary"}],architecture:[{label:"从大纲到完稿",to:"/guides/outline-to-final-manuscript",kind:"scenario"},{label:"Gateway API",to:"/api/gateway-api",kind:"endpoint"},{label:"输出字段词典",to:"/guides/output-field-glossary",kind:"glossary"}],knowledge:[{label:"章节修订专题路径",to:"/guides/chapter-revision-playbook",kind:"scenario"},{label:"写作 API",to:"/api/writing-api",kind:"endpoint"},{label:"输出字段词典",to:"/guides/output-field-glossary",kind:"glossary"}],sync:[{label:"能力状态矩阵",to:"/guides/capability-status",kind:"scenario"},{label:"同步 API",to:"/api/sync-api",kind:"endpoint"},{label:"输出字段词典",to:"/guides/output-field-glossary",kind:"glossary"}],"getting-started":[{label:"三维入口矩阵",to:"/guides/entry-matrix",kind:"scenario"},{label:"Workspace API",to:"/api/workspace-api",kind:"endpoint"},{label:"输出字段词典",to:"/guides/output-field-glossary",kind:"glossary"}]};function ct(){const{categoryId:e,slug:o}=N(),i=M.find(d=>d.id===e),r=T.find(d=>d.category===e&&d.slug===o),[l,n]=m.useState(!1);if(m.useEffect(()=>{const d=()=>{n(window.scrollY>320)};return d(),window.addEventListener("scroll",d),()=>window.removeEventListener("scroll",d)},[]),m.useEffect(()=>{const d=Array.from(document.querySelectorAll("pre")),u=[];return d.forEach(h=>{if(h.dataset.enhanced==="true")return;const x=h.querySelector("code");if(!x)return;if(h.dataset.enhanced="true",h.classList.add("group","relative"),/flowchart|sequenceDiagram|graph TD|graph LR|graph TB|subgraph/.test(x.textContent??"")){h.classList.add("doc-mermaid-block");const b=document.createElement("span");b.textContent="Mermaid 图示",b.className="doc-pre-label",h.appendChild(b)}const a=document.createElement("button");a.type="button",a.textContent="复制",a.className="absolute right-3 top-3 rounded-md border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100";const C=async()=>{try{await navigator.clipboard.writeText(x.textContent??"");const b=a.textContent;a.textContent="已复制",window.setTimeout(()=>{a.textContent=b},1200)}catch{a.textContent="复制失败",window.setTimeout(()=>{a.textContent="复制"},1200)}};a.addEventListener("click",C),h.appendChild(a),u.push(()=>a.removeEventListener("click",C))}),()=>{u.forEach(h=>h())}},[e,o]),!i||!r)return t.jsx("div",{className:"text-[var(--color-text-secondary)]",children:"页面未找到"});const s=T.filter(d=>d.category===i.id),c=s.findIndex(d=>d.id===r.id),g=c>0?s[c-1]:void 0,p=c>=0&&c<s.length-1?s[c+1]:void 0,y=it(r.id),P=m.useMemo(()=>lt(y),[y]),W=m.useMemo(()=>at(nt(y)),[y]),R=Math.max(1,Math.round(A(y).length/260)),I=G[i.id]??G.guides,D=[{title:"Related scenarios",items:I.filter(d=>d.kind==="scenario")},{title:"Related endpoints",items:I.filter(d=>d.kind==="endpoint")},{title:"Field glossary",items:I.filter(d=>d.kind==="glossary")}].filter(d=>d.items.length>0);return t.jsxs("div",{className:"space-y-6",children:[t.jsxs("div",{className:"flex items-center gap-2 text-[12px] text-[var(--color-text-tertiary)]",children:[t.jsx(k,{to:"/",className:"no-underline text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]",children:"首页"}),t.jsx("span",{children:"/"}),t.jsx(k,{to:`/${i.id}`,className:"no-underline text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]",children:i.name}),t.jsx("span",{children:"/"}),t.jsx("span",{className:"text-[var(--color-text-secondary)]",children:r.title})]}),t.jsx("section",{className:"rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-[var(--shadow-sm)]",children:t.jsxs("div",{className:"flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between",children:[t.jsxs("div",{className:"max-w-[760px]",children:[t.jsxs("div",{className:"mb-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-text-tertiary)]",children:[t.jsx("span",{className:"rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1",children:i.name}),t.jsxs("span",{className:"rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1",children:["阅读约 ",R," 分钟"]}),t.jsxs("span",{className:"rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1",children:["共 ",P.length||1," 个小节"]}),t.jsx("span",{className:"rounded-full bg-[var(--color-tint-blue)] px-2.5 py-1 text-[var(--color-accent-blue)]",children:"含图示与交叉链接"})]}),t.jsx("h1",{className:"text-[28px] font-bold text-[var(--color-text-primary)]",children:r.title}),t.jsx("p",{className:"mt-3 text-[14px] leading-7 text-[var(--color-text-secondary)]",children:r.description})]}),t.jsxs("div",{className:"grid grid-cols-2 gap-3 xl:min-w-[280px]",children:[t.jsx(v,{label:"所在分类",value:i.name}),t.jsx(v,{label:"分类序号",value:`${c+1} / ${s.length}`}),t.jsx(v,{label:"上一篇",value:(g==null?void 0:g.title)??"无"}),t.jsx(v,{label:"下一篇",value:(p==null?void 0:p.title)??"无"})]})]})}),t.jsxs("div",{className:"grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]",children:[t.jsx("article",{className:"rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-[var(--shadow-sm)]",children:t.jsx("div",{className:"prose prose-sm max-w-none",children:t.jsx("div",{className:"text-[var(--color-text-primary)] leading-relaxed [&_h2]:scroll-mt-24 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:border-b [&_h2]:border-[var(--color-border-divider)] [&_h2]:pb-2 [&_h3]:scroll-mt-24 [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-3 [&_p]:text-[13px] [&_p]:text-[var(--color-text-secondary)] [&_p]:leading-7 [&_p]:mb-4 [&_ul]:text-[13px] [&_ul]:text-[var(--color-text-secondary)] [&_ul]:leading-7 [&_ul]:mb-4 [&_ul]:pl-5 [&_ol]:text-[13px] [&_ol]:text-[var(--color-text-secondary)] [&_ol]:leading-7 [&_ol]:mb-4 [&_ol]:pl-5 [&_li]:mb-1.5 [&_code]:text-[12px] [&_code]:bg-[var(--color-bg-secondary)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-[#2D2A26] [&_pre]:text-[#E8E5DE] [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:text-[12px] [&_pre]:mb-4 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-xl [&_table]:border [&_table]:border-[var(--color-border)] [&_table]:mb-5 [&_thead]:bg-[var(--color-bg-secondary)] [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:text-[12px] [&_th]:font-semibold [&_th]:text-[var(--color-text-primary)] [&_td]:border-t [&_td]:border-[var(--color-border-divider)] [&_td]:px-4 [&_td]:py-3 [&_td]:text-[12px] [&_td]:text-[var(--color-text-secondary)] [&_.doc-callout]:my-5 [&_.doc-callout]:rounded-xl [&_.doc-callout]:border [&_.doc-callout]:border-[var(--color-border)] [&_.doc-callout]:bg-[var(--color-bg-primary)] [&_.doc-callout]:p-4 [&_.doc-callout]:shadow-[var(--shadow-sm)] [&_.doc-callout-title]:mb-2 [&_.doc-callout-title]:text-[12px] [&_.doc-callout-title]:font-semibold [&_.doc-callout-title]:text-[var(--color-text-primary)] [&_.doc-callout_p]:mb-0 [&_.doc-endpoint]:my-5 [&_.doc-endpoint]:rounded-xl [&_.doc-endpoint]:border [&_.doc-endpoint]:border-[var(--color-border)] [&_.doc-endpoint]:bg-[var(--color-bg-primary)] [&_.doc-endpoint]:p-4 [&_.doc-endpoint-header]:mb-2 [&_.doc-endpoint-header]:flex [&_.doc-endpoint-header]:items-center [&_.doc-endpoint-header]:gap-2 [&_.doc-endpoint-method]:rounded-md [&_.doc-endpoint-method]:bg-[var(--color-tint-blue)] [&_.doc-endpoint-method]:px-2 [&_.doc-endpoint-method]:py-1 [&_.doc-endpoint-method]:text-[11px] [&_.doc-endpoint-method]:font-semibold [&_.doc-endpoint-method]:text-[var(--color-accent-blue)] [&_.doc-endpoint-path]:font-mono [&_.doc-endpoint-path]:text-[12px] [&_.doc-endpoint-path]:text-[var(--color-text-primary)]",dangerouslySetInnerHTML:{__html:W}})})}),t.jsxs("aside",{className:"space-y-4 xl:sticky xl:top-[88px] xl:self-start",children:[t.jsxs("section",{className:"rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-[var(--shadow-sm)]",children:[t.jsxs("div",{className:"flex items-center justify-between gap-3",children:[t.jsx("h2",{className:"text-sm font-semibold text-[var(--color-text-primary)]",children:"关联入口"}),t.jsx("span",{className:"rounded-full bg-[var(--color-tint-blue)] px-2.5 py-1 text-[10px] font-semibold text-[var(--color-accent-blue)]",children:"Related"})]}),t.jsx("div",{className:"mt-4 space-y-4",children:D.map(d=>t.jsxs("div",{children:[t.jsx("div",{className:"mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]",children:d.title}),t.jsx("div",{className:"space-y-3",children:d.items.map(u=>t.jsx(rt,{item:u},`${u.kind}-${u.to}`))})]},d.title))})]}),t.jsxs("section",{className:"rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-[var(--shadow-sm)]",children:[t.jsx("h2",{className:"text-sm font-semibold text-[var(--color-text-primary)]",children:"本页目录"}),P.length>0?t.jsx("div",{className:"mt-3 flex flex-col gap-2",children:P.map(d=>t.jsx("a",{href:`#${d.id}`,className:`no-underline text-[12px] leading-6 ${d.level==="h3"?"pl-3 text-[var(--color-text-secondary)]":"text-[var(--color-text-primary)]"}`,children:d.text},d.id))}):t.jsx("p",{className:"mt-3 text-[12px] leading-6 text-[var(--color-text-secondary)]",children:"当前页面没有可提取的章节标题。"})]}),t.jsxs("section",{className:"rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-[var(--shadow-sm)]",children:[t.jsx("h2",{className:"text-sm font-semibold text-[var(--color-text-primary)]",children:"适合谁读"}),t.jsx("p",{className:"mt-3 text-[12px] leading-6 text-[var(--color-text-secondary)]",children:ot[i.id]??"需要理解这个模块边界和用途的读者"})]}),t.jsxs("section",{className:"rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-[var(--shadow-sm)]",children:[t.jsx("h2",{className:"text-sm font-semibold text-[var(--color-text-primary)]",children:"继续阅读"}),t.jsxs("div",{className:"mt-3 space-y-3",children:[g?t.jsx(S,{label:"上一篇",to:`/${i.id}/${g.slug}`,title:g.title}):null,p?t.jsx(S,{label:"下一篇",to:`/${i.id}/${p.slug}`,title:p.title}):null,t.jsx(S,{label:"返回分类",to:`/${i.id}`,title:`${i.name} 总览`})]})]})]})]}),l?t.jsx("button",{type:"button",onClick:()=>window.scrollTo({top:0,behavior:"smooth"}),className:"fixed bottom-6 right-6 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-2 text-[12px] text-[var(--color-text-primary)] shadow-[var(--shadow-md)] transition-colors hover:bg-[var(--color-bg-hover)]",children:"返回顶部"}):null]})}function v({label:e,value:o}){return t.jsxs("div",{className:"rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3",children:[t.jsx("div",{className:"text-[11px] text-[var(--color-text-tertiary)]",children:e}),t.jsx("div",{className:"mt-1 text-[13px] font-medium leading-6 text-[var(--color-text-primary)]",children:o})]})}function S({label:e,to:o,title:i}){return t.jsxs(k,{to:o,className:"block rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3 no-underline transition-colors hover:bg-[var(--color-bg-hover)]",children:[t.jsx("div",{className:"text-[11px] text-[var(--color-text-tertiary)]",children:e}),t.jsx("div",{className:"mt-1 text-[12px] leading-6 text-[var(--color-text-primary)]",children:i})]})}function rt({item:e}){const o={scenario:{chip:"Scenario",chipClass:"bg-[var(--color-tint-purple)] text-[var(--color-accent-purple)]"},endpoint:{chip:"Endpoint",chipClass:"bg-[var(--color-tint-yellow)] text-[var(--color-accent-orange)]"},glossary:{chip:"Glossary",chipClass:"bg-[var(--color-tint-green)] text-[var(--color-accent-green)]"}};return t.jsxs(k,{to:e.to,className:"block rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3 no-underline transition-all duration-150 hover:-translate-y-[1px] hover:border-[var(--color-text-placeholder)] hover:shadow-[var(--shadow-sm)]",children:[t.jsxs("div",{className:"mb-2 flex items-center justify-between gap-2",children:[t.jsx("span",{className:"text-[12px] font-medium leading-6 text-[var(--color-text-primary)]",children:e.label}),t.jsx("span",{className:`rounded-full px-2 py-1 text-[10px] font-semibold ${o[e.kind].chipClass}`,children:o[e.kind].chip})]}),t.jsx("div",{className:"text-[11px] text-[var(--color-text-tertiary)]",children:e.kind==="scenario"?"关联场景":e.kind==="endpoint"?"关联端点":"字段词典"})]})}function lt(e){return Array.from(e.matchAll(/<(h2|h3)>(.*?)<\/\1>/g)).map(([i,r,l])=>({id:E(A(l)),text:A(l),level:r}))}function at(e){return e.replace(/<(h2|h3)>(.*?)<\/\1>/g,(o,i,r)=>{const l=A(r),n=E(l);return`<${i} id="${n}">${r}</${i}>`})}function nt(e){return ht(e).replace(/\b(Supported|Partial|Experimental|Historical|Roadmap|supported|partial|experimental|historical|roadmap)\b/g,o=>`<span class="doc-status-chip" data-status="${o.toLowerCase()}">${o}</span>`).replace(/<p>(注意点|使用建议|推荐使用方式|最佳实践|为什么这很重要|为什么它重要|为什么 MCP 重要|适用场景|常见问题|下一步推荐)([^<]*)<\/p>/g,(o,i,r)=>`<div class="doc-callout"><div class="doc-callout-title">${i}</div><p>${r.trim()}</p></div>`).replace(/<pre><code>(GET|POST|PUT|DELETE|PATCH)\s+([^\n<]+)([\s\S]*?)<\/code><\/pre>/g,(o,i,r,l)=>{const n=l.trim(),s=n?`<pre><code>${n}</code></pre>`:"";return`<div class="doc-endpoint"><div class="doc-endpoint-header"><span class="doc-endpoint-method">${i}</span><span class="doc-endpoint-path">${r.trim()}</span></div>${s}</div>`})}function ht(e){const o="/".replace(/\/$/,"");return o?e.replace(/href="\/(?!\/)/g,`href="${o}/`):e}function A(e){return e.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim()}function E(e){return e.toLowerCase().trim().replace(/[^\w一-龥-\s]/g,"").replace(/\s+/g,"-")}export{ct as default};
