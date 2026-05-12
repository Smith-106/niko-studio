export const knowledgeContent: Record<string, string> = {
  'knowledge-base': `
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
  `,
  'pattern-detection': `
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
  `,
  'dimension-scoring': `
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
  `,
  'web-novel': `
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
  `,
};
