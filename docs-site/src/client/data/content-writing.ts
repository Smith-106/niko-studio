import { appendSectionToPages, outputFieldGlossaryMiniSection } from './shared-doc-fragments';

const baseWritingContent: Record<string, string> = {
  'craft-analysis': `
<h2>写作技法分析概述</h2>
<p>写作技法分析会把文本拆解为多个可解释、可改进的维度，帮助作者定位问题并形成修订策略。</p>
<h2>分析维度</h2>
<ul>
  <li><strong>叙事视角</strong> — 第一人称、第三人称有限、全知视角等。</li>
  <li><strong>叙事节奏</strong> — 场景展开速度、时间跨度、详略分配。</li>
  <li><strong>情感张力</strong> — 冲突强度、悬念设置、情感起伏。</li>
  <li><strong>语言风格</strong> — 修辞手法、句式变化、词汇丰富度。</li>
</ul>
<h2>系统如何工作</h2>
<ol>
  <li>解析段落、对白和叙述片段。</li>
  <li>提取视角变化、节奏断点和情绪波峰。</li>
  <li>结合知识库生成结构化分析。</li>
  <li>输出评分、证据和改进建议。</li>
</ol>
<h2>如何阅读结果</h2>
<ul>
  <li>先看最低分维度。</li>
  <li>再看文本证据。</li>
  <li>最后选择本轮修订优先级。</li>
</ul>
<h2>案例：章节开头为什么“没钩子”</h2>
<p>假设一章开头连续三段都在解释背景，没有明显动作、冲突或悬念。技法分析通常会把这类问题反映在 <strong>叙事节奏</strong> 和 <strong>情感张力</strong> 上，并给出“前移冲突”“缩短解释段”“先放结果后补背景”的建议。</p>
<ol>
  <li>先看最低分是否集中在节奏与张力。</li>
  <li>再看证据是否都命中开头三段。</li>
  <li>如果命中一致，优先改开头，而不是全章一起重写。</li>
</ol>
<h2>输入示例文本片段</h2>
<pre><code>林砚来到旧宅门前，想起二十年前这条街还没有拆迁。那时巷口有一家卖糖画的小摊，摊主总爱讲一些古怪的传说。母亲曾经说过，旧宅地下埋着祖辈留下的秘密，可她从来不肯解释。</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>低分维度集中在“叙事节奏”“情感张力”。</li>
  <li>证据指出开头连续三句都在交代背景，缺少即时动作或冲突。</li>
  <li>建议形态类似：“把秘密的危险信号前移到第一段”“缩短旧街回忆”。</li>
</ul>
<h2>Related Endpoints</h2>
<ul>
  <li><a href="/api/writing-api">写作 API</a>：触发结构化分析与写作结果。</li>
  <li><a href="/api/workspace-api">Workspace API</a>：当分析结果不像当前项目时先查这里。</li>
  <li><a href="/guides/chapter-revision-playbook">章节修订专题路径</a>：把这类问题接到完整修订链路里。</li>
</ul>
  `,
  'narrative-structure': `
<h2>叙事结构识别</h2>
<p>叙事结构识别用于判断故事是否具备清晰的开端、推进、转折和解决路径。</p>
<h2>支持的结构模式</h2>
<ul>
  <li><strong>三幕式结构</strong> — 设置、对抗、解决。</li>
  <li><strong>英雄之旅</strong> — 召唤、试炼、归来等阶段。</li>
  <li><strong>起承转合</strong> — 东方叙事传统结构。</li>
  <li><strong>非线性叙事</strong> — 倒叙、插叙、多线并行。</li>
</ul>
<h2>使用建议</h2>
<p>结构识别适合在大纲完成后、章节阶段性完成后使用，用来检查转折是否过晚、冲突是否集中、结尾是否有足够铺垫。</p>
<h2>案例：中段塌陷</h2>
<p>很多章节不是开头差，而是中段没有有效推进。结构识别在这种情况下最有价值：它会提示“设置很充分，但中段缺少新的压力或转折”，帮助你判断问题出在结构推进，而不是句子润色。</p>
  `,
  'character-profile': `
<h2>角色画像系统</h2>
<p>角色画像基于文本分析自动生成角色特征、行为倾向和发展变化。</p>
<h2>五维评分</h2>
<ul>
  <li><strong>复杂度</strong> — 性格是否具备多面性。</li>
  <li><strong>一致性</strong> — 行为是否符合设定。</li>
  <li><strong>成长性</strong> — 角色弧线是否完整。</li>
  <li><strong>辨识度</strong> — 是否有独特记忆点。</li>
  <li><strong>功能性</strong> — 是否承担明确叙事作用。</li>
</ul>
<h2>推荐搭配</h2>
<p>角色画像最好和角色关系图谱、角色深度分析一起使用，这样可以同时看到单人塑造和群像结构。</p>
<h2>案例：主角设定很全，但读者记不住</h2>
<p>这通常不是“资料太少”，而是 <strong>辨识度</strong> 和 <strong>矛盾性</strong> 不够。角色画像能帮助你发现：角色信息很多，但缺少真正能让读者记住的行为反差、口头禅、价值冲突或独特选择。</p>
  `,
  'scene-quality': `
<h2>场景质量评估</h2>
<p>场景质量评估关注单个场景是否有明确目标、冲突、变化和信息效率。</p>
<h2>评估维度</h2>
<ul>
  <li><strong>场景节奏</strong> — 动作与描写比例是否合适。</li>
  <li><strong>氛围营造</strong> — 环境和情绪是否支撑场景目标。</li>
  <li><strong>冲突密度</strong> — 场景内部是否有足够张力。</li>
  <li><strong>信息效率</strong> — 是否承载有效叙事信息。</li>
</ul>
<h2>使用建议</h2>
<p>如果一个场景读起来“没有问题但也不吸引人”，通常可以从目标、冲突和变化三个角度重新检查。</p>
<h2>案例：场景顺但不抓人</h2>
<p>例如一场谈判戏对白流畅、信息也清楚，但读者仍觉得平。场景质量评估通常会指出：目标存在，但冲突密度低，或者场景结束时没有发生真正变化。这类结果比“文笔不够好”更可执行。</p>
<h2>输入示例文本片段</h2>
<pre><code>“价格可以再谈。”顾闻说。
“我已经让到最低了。”对方把合同推回去。
两人又交换了几句条件，最后约定明天再议。顾闻起身离开，心里有些烦躁。</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>指出场景目标明确，但冲突升级不足。</li>
  <li>提示“离场前缺少新的信息变化或代价”。</li>
  <li>建议形态类似：“加入让谈判失衡的新条件”或“让角色带着错误判断离场”。</li>
</ul>
<h2>Related Endpoints</h2>
<ul>
  <li><a href="/api/writing-api">写作 API</a>：对应场景分析和局部改写调用。</li>
  <li><a href="/api/critic-api">批评 API</a>：当问题需要进一步拆成修订建议时。</li>
  <li><a href="/guides/common-writing-problems">常见写作问题索引</a>：从“节奏塌”直接回到这类页面。</li>
</ul>
  `,
  'dialogue-analysis': `
<h2>对话分析</h2>
<p>对话分析用于判断对白是否自然、是否区分角色、是否推动情节。</p>
<h2>分析指标</h2>
<ul>
  <li><strong>自然度</strong> — 是否符合语境和身份。</li>
  <li><strong>区分度</strong> — 不同角色是否有不同说话方式。</li>
  <li><strong>潜台词</strong> — 是否有未明说的信息。</li>
  <li><strong>功能性</strong> — 是否推动情节或揭示性格。</li>
</ul>
<h2>案例：对白都像同一个人在说话</h2>
<p>如果角色 A 是冷静克制型，角色 B 是冲动直给型，但他们说话节奏、词汇和句长几乎一样，对话分析会在 <strong>区分度</strong> 上给出低信号。修订时不一定要大改内容，先拉开表达习惯往往就能明显改善。</p>
<h2>输入示例文本片段</h2>
<pre><code>“我认为我们现在不应该进去。”林砚说。
“我认为你说得不对，我们应该马上进去。”周野说。
“我认为这样做风险太大。”林砚说。</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>低信号落在“区分度”和“自然度”。</li>
  <li>证据指出两人句式重复、语气接近。</li>
  <li>建议形态类似：“让周野更短句、更直给；让林砚保留迟疑和补充解释”。</li>
</ul>
<h2>Related Endpoints</h2>
<ul>
  <li><a href="/api/writing-api">写作 API</a>：当你要把对话分析接回修订动作时。</li>
  <li><a href="/api/agent-api">Agent API</a>：当你想先分析再用 Agent 修对白时。</li>
  <li><a href="/guides/common-writing-problems">常见写作问题索引</a>：从“对白平”直接跳回来。</li>
</ul>
  `,
  'writing-stream': `
<h2>流式写作</h2>
<p>流式写作通过 SSE 将 AI 生成内容逐段返回，适合实时续写、场景展开和对话生成。</p>
<h2>使用场景</h2>
<ul>
  <li>输入前文，让 AI 延续当前叙事方向。</li>
  <li>给定场景概要，展开为完整描写。</li>
  <li>根据角色设定生成自然对话。</li>
</ul>
<h2>注意点</h2>
<p>流式输出适合探索草稿，不建议未经整理直接作为最终稿。</p>
<h2>案例：实时续写怎么用得更稳</h2>
<p>如果你只输入“继续写”，流式写作往往会偏泛。更稳的做法是同时给出当前情绪、场景目标和禁止项，例如“继续写追逐戏，保持紧张，不要揭示幕后黑手”。这样流式输出更像可用草稿，而不是随机扩写。</p>
<h2>输入示例</h2>
<pre><code>目标：继续写追逐戏
当前情绪：紧张、压抑
角色约束：主角受伤但不能停下
禁止项：不要暴露幕后黑手身份</code></pre>
<h2>期望输出形态</h2>
<ul>
  <li>输出应连续推进动作，而不是突然插入大段世界观解释。</li>
  <li>应保持“主角带伤奔逃”的身体限制。</li>
  <li>不应提前揭示隐藏反派。</li>
</ul>
<h2>Related Endpoints</h2>
<ul>
  <li><a href="/api/writing-api">写作 API</a>：底层流式写作和写作助手入口。</li>
  <li><a href="/api/agent-api">Agent API</a>：当你希望先做路由或补上下文再续写。</li>
  <li><a href="/guides/outline-to-final-manuscript">从大纲到完稿</a>：放回整本书长链路里看。</li>
</ul>
  `,
  'hook-cliffhanger': `
<h2>钩子与断章检测</h2>
<p>自动检测章节开头的钩子强度和结尾的断章效果，帮助判断读者是否有足够动力继续阅读。</p>
<h2>检测维度</h2>
<ul>
  <li><strong>钩子强度</strong> — 开头是否在 3 段内建立冲突、悬念或信息差。</li>
  <li><strong>断章类型</strong> — 悬念断章、情感断章、信息断章、行动断章等分类。</li>
  <li><strong>读者状态模型</strong> — 追踪读者在每个章节末尾的期待、紧张和好奇程度。</li>
</ul>
<h2>使用建议</h2>
<p>适合在章节完成后检查开头是否"有钩子"、结尾是否"留悬念"。如果连续多章钩子评分低，可能需要重新审视叙事节奏。</p>
<h2>Related Endpoints</h2>
<ul>
  <li><a href="/api/writing-api">写作 API</a>：触发钩子与断章分析。</li>
  <li><a href="/writing/craft-analysis">写作技法分析</a>：查看更完整的技法维度分析。</li>
</ul>
  `,
  'voice-fingerprint': `
<h2>角色声纹</h2>
<p>分析每个角色的语言特征，判断角色之间是否有足够的语音区分度，以及同一角色的语言是否前后一致。</p>
<h2>分析指标</h2>
<ul>
  <li><strong>词汇偏好</strong> — 角色常用词、句长、语气词分布。</li>
  <li><strong>句式模式</strong> — 长句/短句、陈述/疑问/感叹比例。</li>
  <li><strong>一致性</strong> — 同一角色在不同章节的语言是否保持稳定。</li>
  <li><strong>区分度</strong> — 不同角色之间是否可以仅凭语言风格区分。</li>
</ul>
<h2>案例：主角和配角说话像同一个人</h2>
<p>声纹分析会给出低区分度信号，并建议拉开表达习惯差异：例如让冲动型角色用更短句、更直给，让克制型角色保留迟疑和补充解释。</p>
<h2>Related Endpoints</h2>
<ul>
  <li><a href="/api/writing-api">写作 API</a>：触发声纹分析。</li>
  <li><a href="/writing/dialogue-analysis">对话分析</a>：更细粒度的对话质量评估。</li>
</ul>
  `,
  'emotional-arc': `
<h2>情感弧线分析</h2>
<p>追踪文本中情绪的起伏轨迹，评估情感推进是否有效、高潮是否有足够铺垫、结尾是否兑现了情绪承诺。</p>
<h2>分析维度</h2>
<ul>
  <li><strong>情绪轨迹</strong> — 逐段情绪标注和趋势线。</li>
  <li><strong>Show/Tell 比率</strong> — 情感是直接展示还是间接叙述。</li>
  <li><strong>沉浸感评分</strong> — 读者是否被拉入场景，还是被叙述推远。</li>
  <li><strong>高潮兑现</strong> — 前期铺垫的情绪承诺是否在高潮点兑现。</li>
</ul>
<h2>使用建议</h2>
<p>情感弧线适合在章节或全书完成后使用，用来检查情绪推进是否有"塌陷"或"跳变"。</p>
<h2>Related Endpoints</h2>
<ul>
  <li><a href="/api/writing-api">写作 API</a>：触发情感弧线分析。</li>
  <li><a href="/writing/craft-analysis">写作技法分析</a>：查看完整的技法维度。</li>
</ul>
  `,
  'mystery-analysis': `
<h2>悬疑分析</h2>
<p>针对悬疑/推理类文本，分析推理链完整性、线索公平性和类型归属。</p>
<h2>分析维度</h2>
<ul>
  <li><strong>推理链</strong> — 线索→推理→结论的链路是否完整、是否有跳跃。</li>
  <li><strong>类型分类</strong> — 本格推理、社会派、硬汉派、惊悚四种悬疑子类型。</li>
  <li><strong>线索公平性</strong> — 读者是否有足够信息推理出真相（本格要求）。</li>
  <li><strong>设局/解局节奏</strong> — 悬念设置与揭示的节奏是否合理。</li>
</ul>
<h2>适用边界</h2>
<p>悬疑分析最适合有明确推理结构的文本。纯文学或情感向文本的推理链分析结果可能不具参考价值。</p>
<h2>Related Endpoints</h2>
<ul>
  <li><a href="/api/writing-api">写作 API</a>：触发悬疑分析。</li>
  <li><a href="/writing/narrative-structure">叙事结构</a>：查看更通用的结构识别。</li>
</ul>
  `,
  'session-intelligence': `
<h2>会话智能</h2>
<p>会话智能通过收集写作行为 telemetry（活跃时间、保存频率、重写次数、跳转编辑等），对单次写作会话进行分析，并在多次会话间挖掘跨会话模式。</p>
<h2>核心能力</h2>
<ul>
  <li><strong>Telemetry 收集</strong> — 记录写作过程中的行为信号：activeMinutes、saveCount、rewriteCount、jumpEditCount、historyPanelOpenCount。</li>
  <li><strong>单会话分析</strong> — 基于 WritingSessionTelemetry 生成 SessionInsight，识别写作模式和薄弱点。</li>
  <li><strong>跨会话聚类</strong> — 通过 WritingSessionCluster 将相似写作会话分组，发现跨会话模式（如"总是深夜写角色对话"）。</li>
  <li><strong>模式挖掘</strong> — minePatterns() 提取 CrossSessionInsight，按置信度排序输出跨会话洞察。</li>
</ul>
<h2>使用场景</h2>
<ol>
  <li>单章写完后查看本次会话洞察。</li>
  <li>多章完成后查看跨会话模式。</li>
  <li>根据会话模式调整写作策略。</li>
</ol>
<h2>案例：发现"深夜重写模式"</h2>
<p>会话智能可能发现：你在凌晨 1-3 点的会话中 rewriteCount 普遍偏高，而白天的会话 saveCount 更高。这可能意味着深夜写作时产出不如白天稳定，建议把"深度创作"集中在高效时段。</p>
<h2>Related Endpoints</h2>
<ul>
  <li><a href="/critic/intelligent-revision">智能修订</a>：会话洞察可直接驱动修订。</li>
  <li><a href="/critic/style-personalization">风格个性化</a>：会话模式可反馈到偏好系统。</li>
</ul>
  `,
};

export const writingContent = appendSectionToPages(
  baseWritingContent,
  ['craft-analysis', 'scene-quality', 'dialogue-analysis', 'writing-stream', 'hook-cliffhanger', 'voice-fingerprint', 'emotional-arc', 'mystery-analysis'],
  outputFieldGlossaryMiniSection
);
