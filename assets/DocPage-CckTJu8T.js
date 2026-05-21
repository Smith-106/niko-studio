import{u as O,c as M,d as T,r as m,j as t,L as x}from"./index-DMkGHdk9.js";const f=`
<h2>输出字段词典</h2>
<ul>
  <li><code>score</code>：表示强弱、风险或优先级的信号分，不等于最终真相。</li>
  <li><code>evidence</code>：支撑判断的文本证据、设定来源或结构化依据。</li>
  <li><code>suggestion</code>：建议下一步动作或修订方向，不是必须照单全收的答案。</li>
  <li><code>status</code>：表示能力状态或执行状态，例如 Supported、Partial、running、completed，不直接表示文本质量。</li>
  <li><code>canon</code>：作者确认后的长期事实，优先级高于图谱投影、语义召回和聊天临时结论。</li>
</ul>
<p><strong>字段优先级</strong>：<code>canon</code> > <code>evidence</code> > <code>suggestion</code>；<code>score</code> 用来帮助排序和判断，不替代作者决定。完整说明见 <a href="/guides/output-field-glossary">输出字段词典</a>。</p>
`,N=`
<h2>当前发布快照</h2>
<p><strong>当前推荐版本：</strong><code>v9.26.2</code>。当前对外发布入口为 GitHub Releases：<a href="https://github.com/Smith-106/niko-studio/releases/tag/v9.26.2">Niko-Studio v9.26.2</a>。</p>
<table>
  <thead><tr><th>资产</th><th>用途</th><th>说明</th></tr></thead>
  <tbody>
    <tr><td><code>Niko-Studio_9.26.2_x64-setup.exe</code></td><td>标准安装入口</td><td>推荐大多数 Windows 用户使用；已完成 packaged smoke 与 package E2E 验证。</td></tr>
    <tr><td><code>Niko-Studio_9.26.2_x64_en-US.msi</code></td><td>MSI 安装包（en-US）</td><td>适合企业环境或偏好 MSI 部署的场景。</td></tr>
    <tr><td><code>Niko-Studio_9.26.2_x64_zh-CN.msi</code></td><td>MSI 安装包（zh-CN）</td><td>适合中文环境下的 MSI 部署。</td></tr>
  </tbody>
</table>
<h2>当前交付状态</h2>
<ul>
  <li>Current-head local sign-off：<strong>GO</strong></li>
  <li>GitHub release tag：<code>v9.26.2</code></li>
  <li>Current release commit：<code>7578745</code></li>
</ul>
`;function b(e,l,r){const d=new Set(l);return Object.fromEntries(Object.entries(e).map(([a,h])=>[a,d.has(a)?`${h}
${r}`:h]))}const L={installation:`
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
${N}
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
  `},j={"capability-routing":`
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
  `},D={"craft-analysis":`
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
  `},U=b(D,["craft-analysis","scene-quality","dialogue-analysis","writing-stream"],f),B={"graph-query":`
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
  `},q=b(B,["graph-query","foreshadow-tracking","character-depth"],f),$={"critic-evaluate":`
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
<p>上下文建议非常适合这种情况。它不直接替你写整段，而是给出几个更贴近当前项目事实的推进方向，比如“让角色先做错误判断”“先补氛围再爆冲突”“先用对话拖住节奏”。</p>
<h2>输入示例文本片段</h2>
<pre><code>当前状态：主角刚得知父亲可能还活着，但还没有证据。
目标：给下一场戏 3 个推进方向，不直接代写正文。</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>返回多个方向，而不是单一标准答案。</li>
  <li>每个方向都应说明更偏“情节推进”“角色行为”还是“氛围铺垫”。</li>
  <li>建议应围绕当前项目事实，而不是泛泛的套路化桥段。</li>
</ul>
<h2>Related Endpoints</h2>
<ul>
  <li><a href="/api/critic-api">批评 API</a>：对应上下文建议能力。</li>
  <li><a href="/agent/chat-system">对话系统</a>：当你要围绕这些方向继续追问时。</li>
  <li><a href="/guides/common-writing-problems">常见写作问题索引</a>：适合从“节奏塌”“不知道怎么推进”跳回来。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /m10/context-suggestions</code></pre>
  `},F=b($,["critic-evaluate","consistency-check","style-profile","multi-pass-revision","context-suggestions"],f),H={"worldview-extract":`
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
  `},K=b(H,["worldview-extract","worldview-manage"],f),z={"agent-route":`
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
  `},V={"knowledge-base":`
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
  `},Y={"editor-integration":`
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
  `},X={"sync-overview":`
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
  `},J={"system-overview":`
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
  `},tt=b(Z,["writing-api","graph-api","critic-api","agent-api","wiki-api","workflow-api","workspace-api","learning-api"],f),et={...L,...j,...U,...q,...F,...K,...z,...V,...Q,...Y,...X,...J,...tt};function it(e){return et[e]||"<p>文档内容正在编写中...</p>"}const rt={"getting-started":"第一次接触 Niko Studio 的写作者或团队成员",guides:"需要快速建立路径感的写作者、开发者与维护者",writing:"日常进行创作分析和修订的写作者",graph:"需要追踪关系、伏笔与结构连接的作者或分析者",critic:"关注问题定位、证据和修订建议的作者",worldview:"需要维护长期设定一致性的作者",agent:"依赖自然语言入口来驱动多能力协作的用户",knowledge:"需要理解评分依据和知识支撑的开发者或高级作者",memory:"需要管理项目素材与证据来源的用户",desktop:"需要理解桌面工作台与 UI 入口的用户",sync:"关心多设备协作边界的维护者或高级用户",architecture:"需要理解 runtime 边界和模块职责的开发者",api:"需要接入、调试和验证接口边界的集成者与开发者"},C={guides:[{label:"章节修订专题路径",to:"/guides/chapter-revision-playbook",kind:"scenario"},{label:"写作 API",to:"/api/writing-api",kind:"endpoint"},{label:"输出字段词典",to:"/guides/output-field-glossary",kind:"glossary"}],writing:[{label:"常见写作问题索引",to:"/guides/common-writing-problems",kind:"scenario"},{label:"写作 API",to:"/api/writing-api",kind:"endpoint"},{label:"输出字段词典",to:"/guides/output-field-glossary",kind:"glossary"}],critic:[{label:"章节修订专题路径",to:"/guides/chapter-revision-playbook",kind:"scenario"},{label:"批评 API",to:"/api/critic-api",kind:"endpoint"},{label:"输出字段词典",to:"/guides/output-field-glossary",kind:"glossary"}],graph:[{label:"常见写作问题索引",to:"/guides/common-writing-problems",kind:"scenario"},{label:"图谱 API",to:"/api/graph-api",kind:"endpoint"},{label:"输出字段词典",to:"/guides/output-field-glossary",kind:"glossary"}],worldview:[{label:"从大纲到完稿",to:"/guides/outline-to-final-manuscript",kind:"scenario"},{label:"Wiki API",to:"/api/wiki-api",kind:"endpoint"},{label:"输出字段词典",to:"/guides/output-field-glossary",kind:"glossary"}],agent:[{label:"章节修订专题路径",to:"/guides/chapter-revision-playbook",kind:"scenario"},{label:"Agent API",to:"/api/agent-api",kind:"endpoint"},{label:"输出字段词典",to:"/guides/output-field-glossary",kind:"glossary"}],desktop:[{label:"从大纲到完稿",to:"/guides/outline-to-final-manuscript",kind:"scenario"},{label:"Workspace API",to:"/api/workspace-api",kind:"endpoint"},{label:"输出字段词典",to:"/guides/output-field-glossary",kind:"glossary"}],memory:[{label:"常见写作问题索引",to:"/guides/common-writing-problems",kind:"scenario"},{label:"素材 API",to:"/api/memory-api",kind:"endpoint"},{label:"输出字段词典",to:"/guides/output-field-glossary",kind:"glossary"}],api:[{label:"请求生命周期",to:"/guides/request-lifecycle",kind:"scenario"},{label:"Workflow API",to:"/api/workflow-api",kind:"endpoint"},{label:"输出字段词典",to:"/guides/output-field-glossary",kind:"glossary"}],architecture:[{label:"从大纲到完稿",to:"/guides/outline-to-final-manuscript",kind:"scenario"},{label:"Gateway API",to:"/api/gateway-api",kind:"endpoint"},{label:"输出字段词典",to:"/guides/output-field-glossary",kind:"glossary"}],knowledge:[{label:"章节修订专题路径",to:"/guides/chapter-revision-playbook",kind:"scenario"},{label:"写作 API",to:"/api/writing-api",kind:"endpoint"},{label:"输出字段词典",to:"/guides/output-field-glossary",kind:"glossary"}],sync:[{label:"能力状态矩阵",to:"/guides/capability-status",kind:"scenario"},{label:"同步 API",to:"/api/sync-api",kind:"endpoint"},{label:"输出字段词典",to:"/guides/output-field-glossary",kind:"glossary"}],"getting-started":[{label:"三维入口矩阵",to:"/guides/entry-matrix",kind:"scenario"},{label:"Workspace API",to:"/api/workspace-api",kind:"endpoint"},{label:"输出字段词典",to:"/guides/output-field-glossary",kind:"glossary"}]};function ct(){const{categoryId:e,slug:l}=O(),r=M.find(i=>i.id===e),d=T.find(i=>i.category===e&&i.slug===l),[a,h]=m.useState(!1);if(m.useEffect(()=>{const i=()=>{h(window.scrollY>320)};return i(),window.addEventListener("scroll",i),()=>window.removeEventListener("scroll",i)},[]),m.useEffect(()=>{const i=Array.from(document.querySelectorAll("pre")),u=[];return i.forEach(n=>{if(n.dataset.enhanced==="true")return;const I=n.querySelector("code");if(!I)return;if(n.dataset.enhanced="true",n.classList.add("group","relative"),/flowchart|sequenceDiagram|graph TD|graph LR|graph TB|subgraph/.test(I.textContent??"")){n.classList.add("doc-mermaid-block");const w=document.createElement("span");w.textContent="Mermaid 图示",w.className="doc-pre-label",n.appendChild(w)}const o=document.createElement("button");o.type="button",o.textContent="复制",o.className="absolute right-3 top-3 rounded-md border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100";const G=async()=>{try{await navigator.clipboard.writeText(I.textContent??"");const w=o.textContent;o.textContent="已复制",window.setTimeout(()=>{o.textContent=w},1200)}catch{o.textContent="复制失败",window.setTimeout(()=>{o.textContent="复制"},1200)}};o.addEventListener("click",G),n.appendChild(o),u.push(()=>o.removeEventListener("click",G))}),()=>{u.forEach(n=>n())}},[e,l]),!r||!d)return t.jsx("div",{className:"text-[var(--color-text-secondary)]",children:"页面未找到"});const c=T.filter(i=>i.category===r.id),s=c.findIndex(i=>i.id===d.id),p=s>0?c[s-1]:void 0,g=s>=0&&s<c.length-1?c[s+1]:void 0,y=it(d.id),P=m.useMemo(()=>dt(y),[y]),R=m.useMemo(()=>at(ot(y)),[y]),E=Math.max(1,Math.round(v(y).length/260)),A=C[r.id]??C.guides,_=[{title:"Related scenarios",items:A.filter(i=>i.kind==="scenario")},{title:"Related endpoints",items:A.filter(i=>i.kind==="endpoint")},{title:"Field glossary",items:A.filter(i=>i.kind==="glossary")}].filter(i=>i.items.length>0);return t.jsxs("div",{className:"space-y-6",children:[t.jsxs("div",{className:"flex items-center gap-2 text-[12px] text-[var(--color-text-tertiary)]",children:[t.jsx(x,{to:"/",className:"no-underline text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]",children:"首页"}),t.jsx("span",{children:"/"}),t.jsx(x,{to:`/${r.id}`,className:"no-underline text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]",children:r.name}),t.jsx("span",{children:"/"}),t.jsx("span",{className:"text-[var(--color-text-secondary)]",children:d.title})]}),t.jsx("section",{className:"rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-[var(--shadow-sm)]",children:t.jsxs("div",{className:"flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between",children:[t.jsxs("div",{className:"max-w-[760px]",children:[t.jsxs("div",{className:"mb-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-text-tertiary)]",children:[t.jsx("span",{className:"rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1",children:r.name}),t.jsxs("span",{className:"rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1",children:["阅读约 ",E," 分钟"]}),t.jsxs("span",{className:"rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1",children:["共 ",P.length||1," 个小节"]}),t.jsx("span",{className:"rounded-full bg-[var(--color-tint-blue)] px-2.5 py-1 text-[var(--color-accent-blue)]",children:"含图示与交叉链接"})]}),t.jsx("h1",{className:"text-[28px] font-bold text-[var(--color-text-primary)]",children:d.title}),t.jsx("p",{className:"mt-3 text-[14px] leading-7 text-[var(--color-text-secondary)]",children:d.description})]}),t.jsxs("div",{className:"grid grid-cols-2 gap-3 xl:min-w-[280px]",children:[t.jsx(k,{label:"所在分类",value:r.name}),t.jsx(k,{label:"分类序号",value:`${s+1} / ${c.length}`}),t.jsx(k,{label:"上一篇",value:(p==null?void 0:p.title)??"无"}),t.jsx(k,{label:"下一篇",value:(g==null?void 0:g.title)??"无"})]})]})}),t.jsxs("div",{className:"grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]",children:[t.jsx("article",{className:"rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-[var(--shadow-sm)]",children:t.jsx("div",{className:"prose prose-sm max-w-none",children:t.jsx("div",{className:"text-[var(--color-text-primary)] leading-relaxed [&_h2]:scroll-mt-24 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:border-b [&_h2]:border-[var(--color-border-divider)] [&_h2]:pb-2 [&_h3]:scroll-mt-24 [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-3 [&_p]:text-[13px] [&_p]:text-[var(--color-text-secondary)] [&_p]:leading-7 [&_p]:mb-4 [&_ul]:text-[13px] [&_ul]:text-[var(--color-text-secondary)] [&_ul]:leading-7 [&_ul]:mb-4 [&_ul]:pl-5 [&_ol]:text-[13px] [&_ol]:text-[var(--color-text-secondary)] [&_ol]:leading-7 [&_ol]:mb-4 [&_ol]:pl-5 [&_li]:mb-1.5 [&_code]:text-[12px] [&_code]:bg-[var(--color-bg-secondary)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-[#2D2A26] [&_pre]:text-[#E8E5DE] [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:text-[12px] [&_pre]:mb-4 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-xl [&_table]:border [&_table]:border-[var(--color-border)] [&_table]:mb-5 [&_thead]:bg-[var(--color-bg-secondary)] [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:text-[12px] [&_th]:font-semibold [&_th]:text-[var(--color-text-primary)] [&_td]:border-t [&_td]:border-[var(--color-border-divider)] [&_td]:px-4 [&_td]:py-3 [&_td]:text-[12px] [&_td]:text-[var(--color-text-secondary)] [&_.doc-callout]:my-5 [&_.doc-callout]:rounded-xl [&_.doc-callout]:border [&_.doc-callout]:border-[var(--color-border)] [&_.doc-callout]:bg-[var(--color-bg-primary)] [&_.doc-callout]:p-4 [&_.doc-callout]:shadow-[var(--shadow-sm)] [&_.doc-callout-title]:mb-2 [&_.doc-callout-title]:text-[12px] [&_.doc-callout-title]:font-semibold [&_.doc-callout-title]:text-[var(--color-text-primary)] [&_.doc-callout_p]:mb-0 [&_.doc-endpoint]:my-5 [&_.doc-endpoint]:rounded-xl [&_.doc-endpoint]:border [&_.doc-endpoint]:border-[var(--color-border)] [&_.doc-endpoint]:bg-[var(--color-bg-primary)] [&_.doc-endpoint]:p-4 [&_.doc-endpoint-header]:mb-2 [&_.doc-endpoint-header]:flex [&_.doc-endpoint-header]:items-center [&_.doc-endpoint-header]:gap-2 [&_.doc-endpoint-method]:rounded-md [&_.doc-endpoint-method]:bg-[var(--color-tint-blue)] [&_.doc-endpoint-method]:px-2 [&_.doc-endpoint-method]:py-1 [&_.doc-endpoint-method]:text-[11px] [&_.doc-endpoint-method]:font-semibold [&_.doc-endpoint-method]:text-[var(--color-accent-blue)] [&_.doc-endpoint-path]:font-mono [&_.doc-endpoint-path]:text-[12px] [&_.doc-endpoint-path]:text-[var(--color-text-primary)]",dangerouslySetInnerHTML:{__html:R}})})}),t.jsxs("aside",{className:"space-y-4 xl:sticky xl:top-[88px] xl:self-start",children:[t.jsxs("section",{className:"rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-[var(--shadow-sm)]",children:[t.jsxs("div",{className:"flex items-center justify-between gap-3",children:[t.jsx("h2",{className:"text-sm font-semibold text-[var(--color-text-primary)]",children:"关联入口"}),t.jsx("span",{className:"rounded-full bg-[var(--color-tint-blue)] px-2.5 py-1 text-[10px] font-semibold text-[var(--color-accent-blue)]",children:"Related"})]}),t.jsx("div",{className:"mt-4 space-y-4",children:_.map(i=>t.jsxs("div",{children:[t.jsx("div",{className:"mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]",children:i.title}),t.jsx("div",{className:"space-y-3",children:i.items.map(u=>t.jsx(lt,{item:u},`${u.kind}-${u.to}`))})]},i.title))})]}),t.jsxs("section",{className:"rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-[var(--shadow-sm)]",children:[t.jsx("h2",{className:"text-sm font-semibold text-[var(--color-text-primary)]",children:"本页目录"}),P.length>0?t.jsx("div",{className:"mt-3 flex flex-col gap-2",children:P.map(i=>t.jsx("a",{href:`#${i.id}`,className:`no-underline text-[12px] leading-6 ${i.level==="h3"?"pl-3 text-[var(--color-text-secondary)]":"text-[var(--color-text-primary)]"}`,children:i.text},i.id))}):t.jsx("p",{className:"mt-3 text-[12px] leading-6 text-[var(--color-text-secondary)]",children:"当前页面没有可提取的章节标题。"})]}),t.jsxs("section",{className:"rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-[var(--shadow-sm)]",children:[t.jsx("h2",{className:"text-sm font-semibold text-[var(--color-text-primary)]",children:"适合谁读"}),t.jsx("p",{className:"mt-3 text-[12px] leading-6 text-[var(--color-text-secondary)]",children:rt[r.id]??"需要理解这个模块边界和用途的读者"})]}),t.jsxs("section",{className:"rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-[var(--shadow-sm)]",children:[t.jsx("h2",{className:"text-sm font-semibold text-[var(--color-text-primary)]",children:"继续阅读"}),t.jsxs("div",{className:"mt-3 space-y-3",children:[p?t.jsx(S,{label:"上一篇",to:`/${r.id}/${p.slug}`,title:p.title}):null,g?t.jsx(S,{label:"下一篇",to:`/${r.id}/${g.slug}`,title:g.title}):null,t.jsx(S,{label:"返回分类",to:`/${r.id}`,title:`${r.name} 总览`})]})]})]})]}),a?t.jsx("button",{type:"button",onClick:()=>window.scrollTo({top:0,behavior:"smooth"}),className:"fixed bottom-6 right-6 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-2 text-[12px] text-[var(--color-text-primary)] shadow-[var(--shadow-md)] transition-colors hover:bg-[var(--color-bg-hover)]",children:"返回顶部"}):null]})}function k({label:e,value:l}){return t.jsxs("div",{className:"rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3",children:[t.jsx("div",{className:"text-[11px] text-[var(--color-text-tertiary)]",children:e}),t.jsx("div",{className:"mt-1 text-[13px] font-medium leading-6 text-[var(--color-text-primary)]",children:l})]})}function S({label:e,to:l,title:r}){return t.jsxs(x,{to:l,className:"block rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3 no-underline transition-colors hover:bg-[var(--color-bg-hover)]",children:[t.jsx("div",{className:"text-[11px] text-[var(--color-text-tertiary)]",children:e}),t.jsx("div",{className:"mt-1 text-[12px] leading-6 text-[var(--color-text-primary)]",children:r})]})}function lt({item:e}){const l={scenario:{chip:"Scenario",chipClass:"bg-[var(--color-tint-purple)] text-[var(--color-accent-purple)]"},endpoint:{chip:"Endpoint",chipClass:"bg-[var(--color-tint-yellow)] text-[var(--color-accent-orange)]"},glossary:{chip:"Glossary",chipClass:"bg-[var(--color-tint-green)] text-[var(--color-accent-green)]"}};return t.jsxs(x,{to:e.to,className:"block rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-3 no-underline transition-all duration-150 hover:-translate-y-[1px] hover:border-[var(--color-text-placeholder)] hover:shadow-[var(--shadow-sm)]",children:[t.jsxs("div",{className:"mb-2 flex items-center justify-between gap-2",children:[t.jsx("span",{className:"text-[12px] font-medium leading-6 text-[var(--color-text-primary)]",children:e.label}),t.jsx("span",{className:`rounded-full px-2 py-1 text-[10px] font-semibold ${l[e.kind].chipClass}`,children:l[e.kind].chip})]}),t.jsx("div",{className:"text-[11px] text-[var(--color-text-tertiary)]",children:e.kind==="scenario"?"关联场景":e.kind==="endpoint"?"关联端点":"字段词典"})]})}function dt(e){return Array.from(e.matchAll(/<(h2|h3)>(.*?)<\/\1>/g)).map(([r,d,a])=>({id:W(v(a)),text:v(a),level:d}))}function at(e){return e.replace(/<(h2|h3)>(.*?)<\/\1>/g,(l,r,d)=>{const a=v(d),h=W(a);return`<${r} id="${h}">${d}</${r}>`})}function ot(e){return ht(e).replace(/\b(Supported|Partial|Experimental|Historical|Roadmap|supported|partial|experimental|historical|roadmap)\b/g,l=>`<span class="doc-status-chip" data-status="${l.toLowerCase()}">${l}</span>`).replace(/<p>(注意点|使用建议|推荐使用方式|最佳实践|为什么这很重要|为什么它重要|为什么 MCP 重要|适用场景|常见问题|下一步推荐)([^<]*)<\/p>/g,(l,r,d)=>`<div class="doc-callout"><div class="doc-callout-title">${r}</div><p>${d.trim()}</p></div>`).replace(/<pre><code>(GET|POST|PUT|DELETE|PATCH)\s+([^\n<]+)([\s\S]*?)<\/code><\/pre>/g,(l,r,d,a)=>{const h=a.trim(),c=h?`<pre><code>${h}</code></pre>`:"";return`<div class="doc-endpoint"><div class="doc-endpoint-header"><span class="doc-endpoint-method">${r}</span><span class="doc-endpoint-path">${d.trim()}</span></div>${c}</div>`})}function ht(e){const l="/".replace(/\/$/,"");return l?e.replace(/href="\/(?!\/)/g,`href="${l}/`):e}function v(e){return e.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim()}function W(e){return e.toLowerCase().trim().replace(/[^\w一-龥-\s]/g,"").replace(/\s+/g,"-")}export{ct as default};
