export const desktopContent: Record<string, string> = {
  'editor-integration': `
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
  `,
  'writing-dashboard': `
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
  `,
  'local-storage': `
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
  `,
  'llm-integration': `
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
  `,
  'plugin-system': `
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
  `,
  'skill-system': `
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
  `,
  'wiki-system': `
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
  `,
  'narrative-visualization': `
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
  `,
  'niko-editor': `
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
  `,
  'bubble-toolbar': `
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
  `,
  'slash-command-menu': `
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
  `,
  'chat-area': `
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
  `,
  'chat-area-composer': `
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
  `,
  'chat-area-mode-controls': `
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
  `,
  'story-bible-panel': `
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
  `,
  'evaluation-panel': `
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
  `,
  'writing-helper-panel': `
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
  `,
  'ai-text-optimizer': `
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
  `,
  'workflow-editor-panel': `
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
  `,
  'settings-modal': `
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
  `,
  'knowledge-modal': `
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
  `,
  'automation-panel': `
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
  `,
  'mcp-status-panel': `
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
  `,
  'chat-sidebar': `
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
  `,
  'content-search': `
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
  `,
  'quick-panel': `
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
  `,
  'template-manager': `
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
  `,
  'reader-immersion-dashboard': `
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
  `,
  'voice-fingerprint-panel': `
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
  `,
  'pacing-prescription-panel': `
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
  `,
  'emotional-arc-chart': `
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
  `,
  'anti-pattern-warning': `
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
  `,
  'virtual-list': `
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
  `,
};
