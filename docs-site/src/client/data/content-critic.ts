export const criticContent: Record<string, string> = {
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
<h3>端点</h3>
<pre><code>POST /m10/context-suggestions</code></pre>
  `,
};
