export const graphContent: Record<string, string> = {
  'graph-query': `
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
<h3>端点</h3>
<pre><code>POST /graph/query
Body: { type: "character"|"relationship"|"event", filters?: {} }
Response: { nodes: GraphNode[], edges: GraphEdge[] }</code></pre>
  `,
  'character-relationships': `
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
<h3>端点</h3>
<pre><code>GET  /graph/characters
GET  /graph/relationships</code></pre>
  `,
  'foreshadow-tracking': `
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
<h3>端点</h3>
<pre><code>POST /graph/foreshadow/plant
GET  /graph/foreshadows
GET  /graph/foreshadow/stats</code></pre>
  `,
  'character-depth': `
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
<h3>端点</h3>
<pre><code>POST /graph/character/:id/depth
Body: { text: string }</code></pre>
  `,
};
