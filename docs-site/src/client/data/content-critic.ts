import { appendSectionToPages, outputFieldGlossaryMiniSection } from './shared-doc-fragments';

const baseCriticContent: Record<string, string> = {
  'critic-evaluate': `
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
  `,
  'consistency-check': `
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
  `,
  'style-profile': `
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
  `,
  'multi-pass-revision': `
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
  `,
  'context-suggestions': `
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
<p>上下文建议非常适合这种情况。它不直接替你写整段，而是给出几个更贴近当前项目事实的推进方向，比如”让角色先做错误判断””先补氛围再爆冲突””先用对话拖住节奏”。</p>
<h2>输入示例文本片段</h2>
<pre><code>当前状态：主角刚得知父亲可能还活着，但还没有证据。
目标：给下一场戏 3 个推进方向，不直接代写正文。</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>返回多个方向，而不是单一标准答案。</li>
  <li>每个方向都应说明更偏”情节推进””角色行为”还是”氛围铺垫”。</li>
  <li>建议应围绕当前项目事实，而不是泛泛的套路化桥段。</li>
</ul>
<h2>Related Endpoints</h2>
<ul>
  <li><a href=”/api/critic-api”>批评 API</a>：对应上下文建议能力。</li>
  <li><a href=”/agent/chat-system”>对话系统</a>：当你要围绕这些方向继续追问时。</li>
  <li><a href=”/guides/common-writing-problems”>常见写作问题索引</a>：适合从”节奏塌””不知道怎么推进”跳回来。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /m10/context-suggestions</code></pre>
  `,
  'intelligent-revision': `
<h2>智能修订</h2>
<p>智能修订通过 Critic-driven 循环实现多轮自动修订：每轮先用 Critic 评估薄弱点，再基于评估结果定向改进，直到质量达标或达到迭代上限。</p>
<h2>核心流程</h2>
<ol>
  <li><strong>分析</strong> — IRevisionService.analyze() 对文本进行多维度评估。</li>
  <li><strong>建议</strong> — suggest() 提取薄弱点和改进建议。</li>
  <li><strong>修订</strong> — revise() 执行 Critic-driven 修订循环。</li>
  <li><strong>比较</strong> — compare() 对比修订前后差异。</li>
</ol>
<h2>跨迭代学习</h2>
<p>每次修订循环会积累 LearningInsight — 记录哪些维度最容易出问题、哪些修订策略最有效。这些洞察在后续修订中会自动复用，使修订质量随使用逐步提升。</p>
<h2>终止条件</h2>
<ul>
  <li><strong>APPROVED</strong> — 最终评分达到目标阈值。</li>
  <li><strong>HUMAN_REVIEW</strong> — 接近阈值但需要人工确认。</li>
  <li><strong>MAX_ITERATIONS</strong> — 达到迭代上限，建议人工介入。</li>
</ul>
<h2>案例：一章从 5 分修到 8 分</h2>
<p>输入章节文本，设置 target_score=8.0，max_iterations=5。系统会先分析得到 baseline score（如 5.2），然后每轮聚焦最低分维度改进。可能第 2 轮修节奏、第 3 轮修情感张力、第 4 轮达到 7.8 分进入 HUMAN_REVIEW。</p>
<h2>Related Endpoints</h2>
<ul>
  <li><a href=”/api/critic-api”>批评 API</a>：底层 Critic 评估能力。</li>
  <li><a href=”/writing/session-intelligence”>会话智能</a>：修订洞察可反馈到会话分析。</li>
  <li><a href=”/critic/style-personalization”>风格个性化</a>：修订偏好可沉淀到个性化系统。</li>
</ul>
<h3>端点</h3>
<pre><code>POST /m10/revision/multi-pass
Body: { text, target_score?, max_iterations?, chapter_id? }</code></pre>
  `,
  'style-personalization': `
<h2>风格个性化</h2>
<p>风格个性化基于你的写作偏好信号（接受/拒绝/修改建议的记录），构建个性化推荐引擎，使系统建议越来越贴合你的创作风格。</p>
<h2>核心能力</h2>
<ul>
  <li><strong>偏好信号记录</strong> — recordPreferenceSignal() 记录你对每条建议的反馈。</li>
  <li><strong>个性化画像</strong> — buildProfile() 基于偏好信号构建 PersonalizedCraftProfile。</li>
  <li><strong>风格推荐</strong> — getRecommendations() 融合模式推荐 + 偏好推荐，按置信度排序。</li>
  <li><strong>持久化</strong> — 偏好信号通过 KnowledgeMemory 桥接持久存储。</li>
</ul>
<h2>推荐来源</h2>
<ul>
  <li><strong>pattern</strong> — 来自写作模式检测的结构化推荐。</li>
  <li><strong>preference</strong> — 来自你历史偏好行为的个性化推荐。</li>
  <li><strong>reference</strong> — 来自会话智能的上下文推荐。</li>
</ul>
<h2>案例：系统越用越懂你</h2>
<p>前几次使用时，推荐主要是模式检测驱动的（如”句子偏长””过渡不够”）。随着你不断接受/拒绝建议，系统会学到你更在意节奏而非修辞，推荐会逐渐偏向节奏维度的建议，并自动降低你从不采纳的维度权重。</p>
<h2>Related Endpoints</h2>
<ul>
  <li><a href=”/critic/intelligent-revision”>智能修订</a>：修订反馈直接驱动偏好学习。</li>
  <li><a href=”/writing/session-intelligence”>会话智能</a>：会话模式为推荐提供上下文。</li>
  <li><a href=”/api/critic-api”>批评 API</a>：底层风格分析能力。</li>
</ul>
  `,
};

export const criticContent = appendSectionToPages(
  baseCriticContent,
  ['critic-evaluate', 'consistency-check', 'style-profile', 'multi-pass-revision', 'context-suggestions'],
  outputFieldGlossaryMiniSection
);
