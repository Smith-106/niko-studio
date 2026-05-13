import { appendSectionToPages, outputFieldGlossaryMiniSection } from './shared-doc-fragments';

const baseGraphContent: Record<string, string> = {
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
<h2>案例：群像关系失衡</h2>
<p>如果所有关键情节都只能通过主角和同一个配角连接，关系图谱会暴露出“中心化过强”的问题。对长篇群像作品，这比单纯看人物介绍更容易发现结构失衡。</p>
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
  `,
};

export const graphContent = appendSectionToPages(
  baseGraphContent,
  ['graph-query', 'foreshadow-tracking', 'character-depth'],
  outputFieldGlossaryMiniSection
);
