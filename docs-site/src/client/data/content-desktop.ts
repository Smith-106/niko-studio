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
};
