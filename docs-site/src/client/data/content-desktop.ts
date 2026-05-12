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
  `,
};
