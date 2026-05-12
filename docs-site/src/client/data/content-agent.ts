export const agentContent: Record<string, string> = {
  'agent-route': `
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
<h3>端点</h3>
<pre><code>POST /agent/route</code></pre>
  `,
  'agent-write': `
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
<h3>端点</h3>
<pre><code>POST /agent/write</code></pre>
  `,
  'agent-revise': `
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
<h3>端点</h3>
<pre><code>POST /agent/revise</code></pre>
  `,
  'agent-context': `
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
<h3>端点</h3>
<pre><code>POST /agent/context</code></pre>
  `,
  'chat-system': `
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
<h3>端点</h3>
<pre><code>POST /chat
POST /chat/stream</code></pre>
  `,
};
