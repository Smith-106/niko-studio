export const desktopContent: Record<string, string> = {
  'editor-integration': `
<h2>编辑器集成</h2>
<p>Niko Studio 的编辑器承载正文写作、实时预览和分析触发，是日常创作的中心界面。</p>
<h2>编辑器特性</h2>
<ul>
  <li>Markdown 实时预览。</li>
  <li>字数统计和写作进度追踪。</li>
  <li>侧边栏实时分析面板。</li>
  <li>内联标注和建议。</li>
</ul>
  `,
  'writing-dashboard': `
<h2>写作面板</h2>
<p>WritingDashboard 用于展示多维度分析结果，让用户从总览进入细节，再回到正文修订。</p>
<h2>核心价值</h2>
<ul>
  <li>组织分散的分析结果。</li>
  <li>快速看到问题集中在哪些维度。</li>
  <li>支持从概览跳到具体证据。</li>
</ul>
  `,
  'local-storage': `
<h2>本地存储</h2>
<p>所有写作数据默认存储在本地，保护创作隐私。</p>
<h2>存储结构</h2>
<ul>
  <li><strong>项目文件</strong> — 原始文本和元数据。</li>
  <li><strong>分析缓存</strong> — 已完成的分析结果。</li>
  <li><strong>知识索引</strong> — 本地知识库索引。</li>
  <li><strong>用户配置</strong> — 个人偏好设置。</li>
</ul>
  `,
  'llm-integration': `
<h2>LLM 集成</h2>
<p>Niko Studio 通过大语言模型提供深度写作分析能力。</p>
<h2>支持的模型</h2>
<ul>
  <li>OpenAI — GPT 系列。</li>
  <li>Anthropic — Claude 系列。</li>
  <li>本地模型 — Ollama 等。</li>
</ul>
<h2>分析流程</h2>
<p>文本经 Gateway 发送到模型，结合知识库上下文生成结构化分析结果，并写入缓存。</p>
  `,
  'plugin-system': `
<h2>插件系统</h2>
<p>插件系统用于扩展分析、导出和主题能力。</p>
<h2>插件类型</h2>
<ul>
  <li><strong>分析插件</strong> — 添加自定义分析维度。</li>
  <li><strong>导出插件</strong> — 支持更多导出格式。</li>
  <li><strong>主题插件</strong> — 自定义编辑器外观。</li>
</ul>
  `,
  'skill-system': `
<h2>技能系统</h2>
<p>技能系统用于创建、加载、匹配和组合自定义写作技能。</p>
<h2>技能操作</h2>
<ul>
  <li>列表、加载、匹配。</li>
  <li>链式调用。</li>
  <li>创建、保存、删除。</li>
</ul>
<pre><code>---
name: my-skill
description: 自定义分析技能
---</code></pre>
  `,
  'wiki-system': `
<h2>Wiki 系统</h2>
<p>Wiki 系统用于管理知识条目和长期沉淀内容。</p>
<h2>功能</h2>
<ul>
  <li>知识晋升。</li>
  <li>条目列表。</li>
  <li>页面读取。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /wiki/promote
GET  /wiki/list
GET  /wiki/page/:id</code></pre>
  `,
};
