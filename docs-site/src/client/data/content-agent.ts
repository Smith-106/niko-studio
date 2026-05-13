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
  `,
};
