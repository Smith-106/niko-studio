export const componentContent: Record<string, string> = {
  // ============================================================
  // Intelligence 子组件
  // ============================================================
  'accordion-wrapper': `
<h2>AccordionWrapper</h2>
<p>手风琴折叠容器，用于将内容组织为可折叠的区块，支持单选和多选模式。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>折叠/展开切换</strong> — 点击标题栏即可切换对应内容区的可见状态</li>
  <li><strong>单选模式</strong> — 同一时刻仅允许一个区块展开，展开新区块自动收起其他区块</li>
  <li><strong>多选模式</strong> — 允许多个区块同时展开，适合需要对比查看内容的场景</li>
  <li><strong>受控与非受控</strong> — 支持外部控制展开状态，也支持组件内部自动管理</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>Intelligence 面板中将多个分析维度分组展示</li>
  <li>设置页面中按功能类别折叠配置项</li>
  <li>任何需要节省垂直空间、按需展示详细信息的界面区域</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>mode</code></td><td><code>'single' | 'multi'</code></td><td>折叠模式：单选或多选</td></tr>
    <tr><td><code>defaultOpen</code></td><td><code>string[]</code></td><td>默认展开的区块 ID 列表</td></tr>
    <tr><td><code>openIds</code></td><td><code>string[]</code></td><td>受控模式下当前展开的区块 ID</td></tr>
    <tr><td><code>onChange</code></td><td><code>(ids: string[]) =&gt; void</code></td><td>展开状态变化回调</td></tr>
  </tbody>
</table>
`,
  'inline-annotation': `
<h2>InlineAnnotation</h2>
<p>内联标注组件，用于在文本中嵌入轻量级标记信息，提供上下文提示而不打断阅读流。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>悬停提示</strong> — 鼠标悬停时显示标注详情，不占用额外布局空间</li>
  <li><strong>视觉标记</strong> — 通过下划线、背景色或图标区分不同类型的标注</li>
  <li><strong>类型区分</strong> — 支持 info、warning、error 等语义类型，自动应用对应样式</li>
  <li><strong>可交互</strong> — 标注可响应点击事件，用于导航到详情或触发操作</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>在文本编辑器中标记 AI 建议的修改位置</li>
  <li>对叙事元素添加内联备注（如角色名、地点名）</li>
  <li>在评估结果中标注问题文本段</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>type</code></td><td><code>'info' | 'warning' | 'error' | 'suggestion'</code></td><td>标注语义类型</td></tr>
    <tr><td><code>label</code></td><td><code>string</code></td><td>标注显示文本</td></tr>
    <tr><td><code>tooltip</code></td><td><code>string</code></td><td>悬停时显示的详细说明</td></tr>
    <tr><td><code>onClick</code></td><td><code>() =&gt; void</code></td><td>点击回调</td></tr>
  </tbody>
</table>
`,
  'intelligence-badge': `
<h2>IntelligenceBadge</h2>
<p>智能徽章组件，以紧凑的标签形式展示智能分析的状态、类别或评分等级。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>状态徽章</strong> — 显示分析状态（运行中、完成、失败），搭配对应颜色与图标</li>
  <li><strong>类别徽章</strong> — 标识分析所属类别（如叙事、角色、节奏），使用语义化配色</li>
  <li><strong>评分等级</strong> — 以 A/B/C/D 等级或数值展示质量评分</li>
  <li><strong>尺寸变体</strong> — 提供 sm / md / lg 三种尺寸适配不同密度布局</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>Intelligence 面板头部展示当前分析状态</li>
  <li>列表项中标识各条目的分析类别</li>
  <li>质量评分结果旁展示等级标签</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>variant</code></td><td><code>'status' | 'category' | 'grade'</code></td><td>徽章类型</td></tr>
    <tr><td><code>value</code></td><td><code>string</code></td><td>徽章显示值</td></tr>
    <tr><td><code>size</code></td><td><code>'sm' | 'md' | 'lg'</code></td><td>徽章尺寸</td></tr>
    <tr><td><code>color</code></td><td><code>string</code></td><td>自定义颜色，覆盖默认配色</td></tr>
  </tbody>
</table>
`,
  'metric-value': `
<h2>MetricValue</h2>
<p>指标数值展示组件，用于突出显示关键数值型指标，支持趋势指示和单位标注。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>大数字展示</strong> — 以醒目的排版展示核心指标数值</li>
  <li><strong>趋势指示</strong> — 在数值旁显示上升/下降/持平趋势箭头及变化量</li>
  <li><strong>单位标注</strong> — 支持在数值后附加单位文本（如 %、分、字）</li>
  <li><strong>状态着色</strong> — 根据指标状态（正常、警告、危险）自动着色</li>
  <li><strong>辅助说明</strong> — 可在数值下方添加描述性标签</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>写作统计面板展示字数、段落数等关键指标</li>
  <li>质量评分结果展示总分及各维度分数</li>
  <li>仪表盘中展示核心运营指标</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>value</code></td><td><code>number | string</code></td><td>指标数值</td></tr>
    <tr><td><code>unit</code></td><td><code>string</code></td><td>数值单位</td></tr>
    <tr><td><code>trend</code></td><td><code>'up' | 'down' | 'flat'</code></td><td>趋势方向</td></tr>
    <tr><td><code>trendValue</code></td><td><code>string</code></td><td>趋势变化量文本</td></tr>
    <tr><td><code>status</code></td><td><code>'normal' | 'warning' | 'danger'</code></td><td>指标状态</td></tr>
    <tr><td><code>label</code></td><td><code>string</code></td><td>辅助说明文本</td></tr>
  </tbody>
</table>
`,
  'plugin-panel': `
<h2>PluginPanel</h2>
<p>插件面板组件，为 Intelligence 系统中的插件提供统一的容器布局，包含标题栏、工具区和内容区。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>统一布局</strong> — 提供标题栏 + 工具栏 + 内容区的标准三段式布局</li>
  <li><strong>插件标识</strong> — 在标题栏中展示插件图标、名称和状态标识</li>
  <li><strong>工具区</strong> — 支持在标题栏右侧放置操作按钮（如刷新、设置、展开）</li>
  <li><strong>加载状态</strong> — 内置 loading 骨架屏，插件数据加载时自动显示</li>
  <li><strong>错误兜底</strong> — 插件出错时展示错误提示而非白屏</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>Intelligence 面板中承载各分析插件的输出内容</li>
  <li>需要统一外观的第三方扩展面板</li>
  <li>任何需要标题 + 操作 + 内容三段式结构的面板</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>title</code></td><td><code>string</code></td><td>面板标题</td></tr>
    <tr><td><code>icon</code></td><td><code>ReactNode</code></td><td>标题栏图标</td></tr>
    <tr><td><code>actions</code></td><td><code>ReactNode</code></td><td>工具区内容</td></tr>
    <tr><td><code>loading</code></td><td><code>boolean</code></td><td>是否显示加载状态</td></tr>
    <tr><td><code>error</code></td><td><code>string | null</code></td><td>错误信息</td></tr>
    <tr><td><code>children</code></td><td><code>ReactNode</code></td><td>面板内容</td></tr>
  </tbody>
</table>
`,
  'progress-bar': `
<h2>ProgressBar</h2>
<p>进度条组件，直观展示任务完成度或指标达成率，支持多种样式变体。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>确定性进度</strong> — 展示 0%–100% 的精确进度值</li>
  <li><strong>不确定模式</strong> — 任务时长未知时展示动画条，表示正在进行</li>
  <li><strong>分段进度</strong> — 支持多段式进度条，每段可独立着色表示不同阶段</li>
  <li><strong>标签显示</strong> — 可在进度条内/旁显示百分比或自定义文本</li>
  <li><strong>状态着色</strong> — 根据进度值自动切换颜色（低=红、中=黄、高=绿）</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>AI 分析任务执行进度展示</li>
  <li>写作目标完成度展示（如字数目标、章节进度）</li>
  <li>数据同步或导入/导出操作进度</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>value</code></td><td><code>number</code></td><td>进度值（0–100）</td></tr>
    <tr><td><code>max</code></td><td><code>number</code></td><td>最大值，默认 100</td></tr>
    <tr><td><code>indeterminate</code></td><td><code>boolean</code></td><td>是否为不确定模式</td></tr>
    <tr><td><code>showLabel</code></td><td><code>boolean</code></td><td>是否显示进度标签</td></tr>
    <tr><td><code>segments</code></td><td><code>Segment[]</code></td><td>分段进度配置</td></tr>
    <tr><td><code>size</code></td><td><code>'sm' | 'md' | 'lg'</code></td><td>进度条高度尺寸</td></tr>
  </tbody>
</table>
`,
  'section-header': `
<h2>SectionHeader</h2>
<p>区块标题组件，为面板中的内容区块提供统一的标题样式，支持图标、操作按钮和折叠控制。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>标题 + 图标</strong> — 在标题前显示语义图标，增强可识别性</li>
  <li><strong>操作区</strong> — 标题右侧可放置操作按钮（如刷新、设置、更多）</li>
  <li><strong>折叠控制</strong> — 可选的折叠/展开切换按钮，与 AccordionWrapper 协作</li>
  <li><strong>辅助文本</strong> — 标题下方可添加灰色描述文本</li>
  <li><strong>分隔线</strong> — 可选的底部分隔线，视觉上划分区块边界</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>Intelligence 面板中各分析区块的标题</li>
  <li>设置页面中各配置分组的标题</li>
  <li>任何需要统一标题风格的界面区域</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>title</code></td><td><code>string</code></td><td>标题文本</td></tr>
    <tr><td><code>icon</code></td><td><code>ReactNode</code></td><td>标题图标</td></tr>
    <tr><td><code>description</code></td><td><code>string</code></td><td>辅助描述文本</td></tr>
    <tr><td><code>actions</code></td><td><code>ReactNode</code></td><td>右侧操作区内容</td></tr>
    <tr><td><code>collapsible</code></td><td><code>boolean</code></td><td>是否显示折叠按钮</td></tr>
    <tr><td><code>defaultOpen</code></td><td><code>boolean</code></td><td>折叠状态默认值</td></tr>
    <tr><td><code>divider</code></td><td><code>boolean</code></td><td>是否显示底部分隔线</td></tr>
  </tbody>
</table>
`,
  'show-tell-legend': `
<h2>ShowTellLegend</h2>
<p>Show/Tell 图例组件，展示文本中 Show（展示）和 Tell（叙述）标记的颜色图例，帮助用户理解编辑器中的装饰含义。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>颜色图例</strong> — 以色块 + 文本形式展示 Show/Tell 两种标记的配色方案</li>
  <li><strong>统计摘要</strong> — 可展示当前文本中 Show/Tell 各占的比例</li>
  <li><strong>交互切换</strong> — 点击图例项可高亮/隐藏对应类型的编辑器装饰</li>
  <li><strong>紧凑布局</strong> — 设计为可嵌入面板头部的紧凑组件</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>Intelligence 面板中解释 Show/Tell 分析结果的视觉含义</li>
  <li>编辑器侧边栏作为 Show/Tell 装饰的图例参考</li>
  <li>写作评估报告中解释 Show/Tell 标记</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>showCount</code></td><td><code>number</code></td><td>Show 标记数量</td></tr>
    <tr><td><code>tellCount</code></td><td><code>number</code></td><td>Tell 标记数量</td></tr>
    <tr><td><code>onToggle</code></td><td><code>(type: 'show' | 'tell') =&gt; void</code></td><td>图例项点击回调</td></tr>
    <tr><td><code>activeTypes</code></td><td><code>Set&lt;string&gt;</code></td><td>当前激活显示的类型</td></tr>
  </tbody>
</table>
`,
  'template-manager-intel': `
<h2>TemplateManager（Intelligence）</h2>
<p>Intelligence 模块中的模板管理器，用于管理分析模板的创建、选择和应用，支持自定义分析维度与权重。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>模板列表</strong> — 展示所有可用的分析模板，包括预设模板和用户自定义模板</li>
  <li><strong>模板选择</strong> — 点击切换当前使用的分析模板，切换后分析结果即时更新</li>
  <li><strong>模板创建</strong> — 支持从零创建自定义模板，配置分析维度、权重和阈值</li>
  <li><strong>模板编辑</strong> — 修改已有自定义模板的参数</li>
  <li><strong>模板导入/导出</strong> — 以 JSON 格式导入/导出模板，方便团队共享</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>选择不同风格的分析模板（如小说模板、剧本模板、散文模板）</li>
  <li>创建针对特定写作类型的自定义分析模板</li>
  <li>在团队中共享统一的评估标准</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>templates</code></td><td><code>AnalysisTemplate[]</code></td><td>可用模板列表</td></tr>
    <tr><td><code>activeTemplate</code></td><td><code>string</code></td><td>当前激活模板 ID</td></tr>
    <tr><td><code>onSelect</code></td><td><code>(id: string) =&gt; void</code></td><td>模板选择回调</td></tr>
    <tr><td><code>onCreate</code></td><td><code>(template: AnalysisTemplate) =&gt; void</code></td><td>模板创建回调</td></tr>
    <tr><td><code>onEdit</code></td><td><code>(id: string, updates: Partial&lt;AnalysisTemplate&gt;) =&gt; void</code></td><td>模板编辑回调</td></tr>
    <tr><td><code>onDelete</code></td><td><code>(id: string) =&gt; void</code></td><td>模板删除回调</td></tr>
  </tbody>
</table>
`,
  'trend-chart': `
<h2>TrendChart</h2>
<p>趋势图表组件，以折线图或面积图形式展示指标随时间的变化趋势，帮助用户识别写作质量的演进模式。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>折线图 / 面积图</strong> — 支持两种图表类型切换</li>
  <li><strong>多数据系列</strong> — 可在同一图表中叠加展示多条趋势线</li>
  <li><strong>时间轴</strong> — X 轴按时间排列数据点，支持缩放和滚动</li>
  <li><strong>悬停提示</strong> — 鼠标悬停时展示该数据点的详细数值</li>
  <li><strong>基准线</strong> — 可添加目标基准线，直观对比实际值与目标值</li>
  <li><strong>自适应尺寸</strong> — 图表随容器尺寸自动调整</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>展示写作质量评分随章节的变化趋势</li>
  <li>对比多个维度（如节奏、对话、描写）的评分走势</li>
  <li>追踪每日写作字数统计</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>data</code></td><td><code>DataPoint[][]</code></td><td>数据系列数组</td></tr>
    <tr><td><code>type</code></td><td><code>'line' | 'area'</code></td><td>图表类型</td></tr>
    <tr><td><code>labels</code></td><td><code>string[]</code></td><td>各系列标签</td></tr>
    <tr><td><code>baseline</code></td><td><code>number</code></td><td>基准线数值</td></tr>
    <tr><td><code>height</code></td><td><code>number</code></td><td>图表高度（px）</td></tr>
    <tr><td><code>showDots</code></td><td><code>boolean</code></td><td>是否显示数据点</td></tr>
  </tbody>
</table>
`,
  'writing-dimension-detail': `
<h2>WritingDimensionDetail</h2>
<p>写作维度详情组件，展示单个写作分析维度的详细评估结果，包括评分、说明和改进建议。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>维度评分</strong> — 以进度条 + 数值形式展示维度得分</li>
  <li><strong>评级标识</strong> — 根据分数显示 A/B/C/D 评级徽章</li>
  <li><strong>评估说明</strong> — 展示 AI 生成的维度评估文字说明</li>
  <li><strong>改进建议</strong> — 列出针对性的写作改进建议</li>
  <li><strong>示例引用</strong> — 从原文中引用相关片段作为评分依据</li>
  <li><strong>折叠详情</strong> — 默认展示摘要，可展开查看完整评估</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>Intelligence 面板中展示各写作维度的详细分析结果</li>
  <li>质量评估报告中逐维度展示评分与建议</li>
  <li>写作辅导场景中针对特定维度提供改进指导</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>dimension</code></td><td><code>WritingDimension</code></td><td>维度数据对象</td></tr>
    <tr><td><code>score</code></td><td><code>number</code></td><td>维度评分（0–100）</td></tr>
    <tr><td><code>grade</code></td><td><code>'A' | 'B' | 'C' | 'D'</code></td><td>评级</td></tr>
    <tr><td><code>summary</code></td><td><code>string</code></td><td>评估摘要</td></tr>
    <tr><td><code>suggestions</code></td><td><code>string[]</code></td><td>改进建议列表</td></tr>
    <tr><td><code>quotes</code></td><td><code>Quote[]</code></td><td>原文引用列表</td></tr>
    <tr><td><code>defaultExpanded</code></td><td><code>boolean</code></td><td>是否默认展开详情</td></tr>
  </tbody>
</table>
`,

  // ============================================================
  // Knowledge 子组件
  // ============================================================
  'character-tab': `
<h2>CharacterTab</h2>
<p>角色标签页组件，用于管理和浏览知识库中的角色信息，支持角色的创建、编辑和关系管理。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>角色列表</strong> — 以卡片或列表形式展示所有角色，支持按名称搜索筛选</li>
  <li><strong>角色详情</strong> — 展示角色的完整属性信息（姓名、描述、特征、背景等）</li>
  <li><strong>角色创建/编辑</strong> — 通过表单创建新角色或修改现有角色属性</li>
  <li><strong>关系图谱</strong> — 展示角色间的关系网络（朋友、对手、家人等）</li>
  <li><strong>出场统计</strong> — 统计角色在各章节的出场次数和篇幅</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>写作前规划角色设定和关系网络</li>
  <li>写作过程中查阅角色属性保持人设一致</li>
  <li>写作后回顾角色出场分布和互动情况</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>characters</code></td><td><code>Character[]</code></td><td>角色数据列表</td></tr>
    <tr><td><code>onCreate</code></td><td><code>(character: Character) =&gt; void</code></td><td>创建角色回调</td></tr>
    <tr><td><code>onEdit</code></td><td><code>(id: string, updates: Partial&lt;Character&gt;) =&gt; void</code></td><td>编辑角色回调</td></tr>
    <tr><td><code>onDelete</code></td><td><code>(id: string) =&gt; void</code></td><td>删除角色回调</td></tr>
    <tr><td><code>onLink</code></td><td><code>(fromId: string, toId: string, relation: string) =&gt; void</code></td><td>建立角色关系回调</td></tr>
  </tbody>
</table>
`,
  'location-tab': `
<h2>LocationTab</h2>
<p>地点标签页组件，用于管理和浏览知识库中的地点信息，帮助作者维护故事世界的空间设定。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>地点列表</strong> — 展示所有地点条目，支持搜索和分类筛选</li>
  <li><strong>地点详情</strong> — 展示地点名称、描述、特征、所属区域等信息</li>
  <li><strong>层级结构</strong> — 支持地点的层级关系（如国家 → 城市 → 街道 → 建筑）</li>
  <li><strong>场景关联</strong> — 展示与该地点关联的叙事场景列表</li>
  <li><strong>地点创建/编辑</strong> — 通过表单管理地点属性</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>构建故事世界的地理空间体系</li>
  <li>查阅地点细节以确保场景描写的一致性</li>
  <li>追踪各地点在故事中的使用频次</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>locations</code></td><td><code>Location[]</code></td><td>地点数据列表</td></tr>
    <tr><td><code>onCreate</code></td><td><code>(location: Location) =&gt; void</code></td><td>创建地点回调</td></tr>
    <tr><td><code>onEdit</code></td><td><code>(id: string, updates: Partial&lt;Location&gt;) =&gt; void</code></td><td>编辑地点回调</td></tr>
    <tr><td><code>onDelete</code></td><td><code>(id: string) =&gt; void</code></td><td>删除地点回调</td></tr>
  </tbody>
</table>
`,
  'memory-form': `
<h2>MemoryForm</h2>
<p>记忆表单组件，用于创建和编辑知识库中的记忆条目，支持结构化录入和标签分类。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>结构化录入</strong> — 提供标题、内容、来源等结构化字段</li>
  <li><strong>标签分类</strong> — 支持为记忆添加标签，便于后续检索和筛选</li>
  <li><strong>重要度标记</strong> — 可标记记忆的重要度级别（核心/重要/一般）</li>
  <li><strong>关联引用</code> — 可关联角色、地点等实体，形成知识网络</li>
  <li><strong>表单验证</strong> — 必填字段验证和格式校验</li>
  <li><strong>编辑模式</strong> — 支持新建和编辑两种模式，编辑时预填充已有数据</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>记录故事中的关键事件和设定</li>
  <li>为 AI 上下文提供结构化的知识输入</li>
  <li>维护写作过程中的灵感和想法</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>initialValues</code></td><td><code>Partial&lt;Memory&gt;</code></td><td>编辑模式下的初始值</td></tr>
    <tr><td><code>onSubmit</code></td><td><code>(memory: Memory) =&gt; void</code></td><td>提交回调</td></tr>
    <tr><td><code>onCancel</code></td><td><code>() =&gt; void</code></td><td>取消回调</td></tr>
    <tr><td><code>availableTags</code></td><td><code>string[]</code></td><td>可选标签列表</td></tr>
    <tr><td><code>linkedEntities</code></td><td><code>EntityRef[]</code></td><td>可关联的实体列表</td></tr>
  </tbody>
</table>
`,
  'persisted-entity-tab': `
<h2>PersistedEntityTab</h2>
<p>持久实体标签页组件，为知识库中的通用实体类型提供标准化的管理界面，支持 CRUD 操作和搜索筛选。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>通用实体管理</strong> — 不限定具体实体类型，适用于角色、地点、道具等任何持久化实体</li>
  <li><strong>CRUD 操作</strong> — 提供创建、读取、更新、删除的完整操作</li>
  <li><strong>搜索筛选</strong> — 支持按名称和标签搜索实体</li>
  <li><strong>分页加载</strong> — 大量实体时分页展示，保证界面流畅</li>
  <li><strong>批量操作</strong> — 支持多选后批量删除或批量修改标签</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>管理知识库中不属于特定类别的通用实体</li>
  <li>作为其他专用 Tab（如 CharacterTab、LocationTab）的底层组件</li>
  <li>快速原型化新的实体类型管理界面</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>entityType</code></td><td><code>string</code></td><td>实体类型标识</td></tr>
    <tr><td><code>entities</code></td><td><code>PersistedEntity[]</code></td><td>实体数据列表</td></tr>
    <tr><td><code>columns</code></td><td><code>ColumnDef[]</code></td><td>列表列定义</td></tr>
    <tr><td><code>onCreate</code></td><td><code>(entity: PersistedEntity) =&gt; void</code></td><td>创建回调</td></tr>
    <tr><td><code>onEdit</code></td><td><code>(id: string, updates: Partial&lt;PersistedEntity&gt;) =&gt; void</code></td><td>编辑回调</td></tr>
    <tr><td><code>onDelete</code></td><td><code>(id: string) =&gt; void</code></td><td>删除回调</td></tr>
  </tbody>
</table>
`,
  'plot-tab': `
<h2>PlotTab</h2>
<p>情节标签页组件，用于管理知识库中的情节线索和剧情节点，帮助作者梳理和追踪故事线。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>情节线列表</strong> — 展示所有情节线（主线、支线、暗线），支持颜色区分</li>
  <li><strong>剧情节点</strong> — 在情节线中管理关键剧情节点（起因、发展、高潮、结局）</li>
  <li><strong>时间线视图</strong> — 以时间线形式展示情节的推进顺序</li>
  <li><strong>节点关联</strong> — 将情节节点与角色、地点等实体关联</li>
  <li><strong>完成度追踪</strong> — 标记情节节点的写作状态（计划中/进行中/已完成）</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>写作前规划整体情节架构</li>
  <li>写作中追踪各情节线的推进进度</li>
  <li>修改时检查情节线的连贯性和逻辑性</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>plotLines</code></td><td><code>PlotLine[]</code></td><td>情节线数据列表</td></tr>
    <tr><td><code>onCreateLine</code></td><td><code>(line: PlotLine) =&gt; void</code></td><td>创建情节线回调</td></tr>
    <tr><td><code>onAddNode</code></td><td><code>(lineId: string, node: PlotNode) =&gt; void</code></td><td>添加剧情节点回调</td></tr>
    <tr><td><code>onEditNode</code></td><td><code>(nodeId: string, updates: Partial&lt;PlotNode&gt;) =&gt; void</code></td><td>编辑剧情节点回调</td></tr>
    <tr><td><code>onDeleteNode</code></td><td><code>(nodeId: string) =&gt; void</code></td><td>删除剧情节点回调</td></tr>
  </tbody>
</table>
`,
  'skill-tab': `
<h2>SkillTab</h2>
<p>技能标签页组件，用于管理知识库中角色的技能和能力体系，支持技能层级和依赖关系。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>技能列表</strong> — 展示所有技能条目，支持按类别和等级筛选</li>
  <li><strong>技能详情</strong> — 展示技能名称、描述、等级、效果范围等信息</li>
  <li><strong>技能树</strong> — 以树形结构展示技能的前置依赖和升级路径</li>
  <li><strong>角色关联</strong> — 展示拥有该技能的角色列表</li>
  <li><strong>技能创建/编辑</strong> — 通过表单管理技能属性和依赖关系</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>奇幻/科幻类作品中构建角色能力体系</li>
  <li>追踪角色技能的获得和升级过程</li>
  <li>确保技能使用的逻辑一致性（如未解锁技能不可使用）</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>skills</code></td><td><code>Skill[]</code></td><td>技能数据列表</td></tr>
    <tr><td><code>onCreate</code></td><td><code>(skill: Skill) =&gt; void</code></td><td>创建技能回调</td></tr>
    <tr><td><code>onEdit</code></td><td><code>(id: string, updates: Partial&lt;Skill&gt;) =&gt; void</code></td><td>编辑技能回调</td></tr>
    <tr><td><code>onDelete</code></td><td><code>(id: string) =&gt; void</code></td><td>删除技能回调</td></tr>
    <tr><td><code>onLinkPrerequisite</code></td><td><code>(skillId: string, prereqId: string) =&gt; void</code></td><td>设置技能前置依赖回调</td></tr>
  </tbody>
</table>
`,

  // ============================================================
  // Evaluation 子组件
  // ============================================================
  'evaluation-compact-review-section': `
<h2>EvaluationCompactReviewSection</h2>
<p>简洁审查区组件，以紧凑的摘要形式展示评估结果，适合空间有限的列表或面板视图。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>摘要评分</strong> — 以数值和颜色标识展示总体评分</li>
  <li><strong>评级徽章</strong> — 展示 A/B/C/D 评级，一目了然</li>
  <li><strong>关键问题数</strong> — 展示发现的关键问题数量</li>
  <li><strong>一键展开</strong> — 点击可展开到 EvaluationDetailedReviewSection 查看详情</li>
  <li><strong>时间戳</strong> — 显示评估执行时间</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>评估历史列表中展示各次评估的摘要</li>
  <li>侧边栏面板中快速浏览评估状态</li>
  <li>多维度评估的汇总视图中展示各维度概要</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>evaluation</code></td><td><code>EvaluationResult</code></td><td>评估结果数据</td></tr>
    <tr><td><code>onExpand</code></td><td><code>() =&gt; void</code></td><td>展开详情回调</td></tr>
    <tr><td><code>compact</code></td><td><code>boolean</code></td><td>是否启用超紧凑模式</td></tr>
  </tbody>
</table>
`,
  'evaluation-detailed-review-section': `
<h2>EvaluationDetailedReviewSection</h2>
<p>详细审查区组件，以展开的形式展示评估结果的完整内容，包括各维度评分、问题列表和改进建议。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>各维度评分</strong> — 逐维度展示评分条和数值</li>
  <li><strong>问题列表</strong> — 按严重程度排列的详细问题清单，包含原文定位</li>
  <li><strong>改进建议</strong> — 针对每个问题的具体改进方案</li>
  <li><strong>原文引用</strong> — 引用被评估文本中的相关片段</li>
  <li><strong>操作按钮</strong> — 支持一键应用建议、标记已处理等操作</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>从 EvaluationCompactReviewSection 展开查看完整评估</li>
  <li>评估结果详情页面</li>
  <li>写作辅导中的逐项改进指导</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>evaluation</code></td><td><code>EvaluationResult</code></td><td>完整评估结果数据</td></tr>
    <tr><td><code>onApplySuggestion</code></td><td><code>(suggestionId: string) =&gt; void</code></td><td>应用建议回调</td></tr>
    <tr><td><code>onDismiss</code></td><td><code>(issueId: string) =&gt; void</code></td><td>忽略问题回调</td></tr>
    <tr><td><code>onNavigateToSource</code></td><td><code>(location: SourceLocation) =&gt; void</code></td><td>导航到原文位置回调</td></tr>
  </tbody>
</table>
`,
  'evaluation-source-section': `
<h2>EvaluationSourceSection</h2>
<p>来源区组件，展示评估所基于的原始文本来源和引用信息，确保评估结果可追溯。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>文本来源</strong> — 展示被评估的原文段落，高亮相关片段</li>
  <li><strong>版本信息</strong> — 标注评估基于的文本版本（如草稿 v3）</li>
  <li><strong>范围标识</strong> — 明确标注评估覆盖的文本范围（全文/选中段落/章节）</li>
  <li><strong>跳转链接</strong> — 点击可在编辑器中定位到对应位置</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>在评估详情中展示评估对象的原文</li>
  <li>点击问题定位到编辑器中对应位置</li>
  <li>确认评估的文本范围和版本</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>source</code></td><td><code>EvaluationSource</code></td><td>来源信息数据</td></tr>
    <tr><td><code>highlights</code></td><td><code>HighlightRange[]</code></td><td>高亮范围列表</td></tr>
    <tr><td><code>onNavigate</code></td><td><code>(location: SourceLocation) =&gt; void</code></td><td>导航到源文本回调</td></tr>
  </tbody>
</table>
`,
  'evaluation-support-tools-section': `
<h2>EvaluationSupportToolsSection</h2>
<p>支持工具区组件，提供评估流程中的辅助工具入口，如重新评估、对比评估、导出报告等。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>重新评估</strong> — 一键触发基于当前文本的重新评估</li>
  <li><strong>对比评估</strong> — 选择两次评估结果进行差异对比</li>
  <li><strong>导出报告</strong> — 将评估结果导出为 Markdown 或 PDF 格式</li>
  <li><strong>评估模板</strong> — 切换不同评估模板</li>
  <li><strong>历史版本</strong> — 查看同一文本的历史评估记录</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>修改文本后重新评估检查改进效果</li>
  <li>对比不同版本的评估结果追踪写作进步</li>
  <li>导出评估报告用于团队评审</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>evaluationId</code></td><td><code>string</code></td><td>当前评估 ID</td></tr>
    <tr><td><code>onReevaluate</code></td><td><code>() =&gt; void</code></td><td>重新评估回调</td></tr>
    <tr><td><code>onCompare</code></td><td><code>(ids: [string, string]) =&gt; void</code></td><td>对比评估回调</td></tr>
    <tr><td><code>onExport</code></td><td><code>(format: 'markdown' | 'pdf') =&gt; void</code></td><td>导出报告回调</td></tr>
    <tr><td><code>historyIds</code></td><td><code>string[]</code></td><td>历史评估 ID 列表</td></tr>
  </tbody>
</table>
`,
  'evaluation-workflow-section': `
<h2>EvaluationWorkflowSection</h2>
<p>工作流区组件，展示评估的执行流程和当前状态，支持对评估工作流的配置和控制。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>流程展示</strong> — 以步骤条形式展示评估的各个阶段（准备 → 分析 → 评分 → 报告）</li>
  <li><strong>当前状态</strong> — 高亮当前执行阶段，展示进度百分比</li>
  <li><strong>阶段配置</strong> — 可配置各阶段使用的分析插件和参数</li>
  <li><strong>执行控制</strong> — 提供开始、暂停、继续、取消等操作按钮</li>
  <li><strong>耗时统计</strong> — 展示各阶段的执行耗时</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>执行评估任务时查看实时进度</li>
  <li>配置自定义评估工作流</li>
  <li>诊断评估任务执行缓慢的原因</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>workflow</code></td><td><code>EvaluationWorkflow</code></td><td>工作流配置数据</td></tr>
    <tr><td><code>currentStep</code></td><td><code>number</code></td><td>当前执行步骤索引</td></tr>
    <tr><td><code>status</code></td><td><code>'idle' | 'running' | 'paused' | 'completed' | 'failed'</code></td><td>工作流状态</td></tr>
    <tr><td><code>onStart</code></td><td><code>() =&gt; void</code></td><td>开始执行回调</td></tr>
    <tr><td><code>onPause</code></td><td><code>() =&gt; void</code></td><td>暂停执行回调</td></tr>
    <tr><td><code>onCancel</code></td><td><code>() =&gt; void</code></td><td>取消执行回调</td></tr>
  </tbody>
</table>
`,
  'toggle-section-shell': `
<h2>ToggleSectionShell</h2>
<p>可折叠壳组件，为任何内容区块提供统一的折叠/展开容器，是 Evaluation 模块中通用的布局组件。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>折叠/展开</strong> — 点击标题栏切换内容区可见性</li>
  <li><strong>动画过渡</strong> — 展开/收起带有平滑的高度动画</li>
  <li><strong>受控/非受控</strong> — 支持外部控制展开状态或组件内部自动管理</li>
  <li><strong>标题自定义</strong> — 标题栏支持自定义渲染（图标、标签、操作按钮）</li>
  <li><strong>展开指示器</strong> — 标题栏右侧的旋转箭头指示展开状态</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>评估结果中各区块的折叠容器</li>
  <li>任何需要按需展开/收起的内容区域</li>
  <li>替代 AccordionWrapper 在不需要多区块联动的场景</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>title</code></td><td><code>string | ReactNode</code></td><td>标题栏内容</td></tr>
    <tr><td><code>defaultOpen</code></td><td><code>boolean</code></td><td>默认是否展开</td></tr>
    <tr><td><code>open</code></td><td><code>boolean</code></td><td>受控模式下的展开状态</td></tr>
    <tr><td><code>onChange</code></td><td><code>(open: boolean) =&gt; void</code></td><td>展开状态变化回调</td></tr>
    <tr><td><code>children</code></td><td><code>ReactNode</code></td><td>折叠区内容</td></tr>
  </tbody>
</table>
`,

  // ============================================================
  // Story Bible 子组件
  // ============================================================
  'card-list': `
<h2>CardList</h2>
<p>卡片列表组件，以卡片网格或列表形式展示 Story Bible 中的实体条目，支持搜索和分类筛选。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>卡片网格</strong> — 以卡片形式展示条目，每张卡片显示标题、摘要和类型图标</li>
  <li><strong>列表视图</strong> — 可切换为紧凑列表模式，适合大量条目浏览</li>
  <li><strong>搜索筛选</strong> — 支持按关键词搜索和按类型/标签筛选</li>
  <li><strong>拖拽排序</strong> — 卡片支持拖拽调整顺序</li>
  <li><strong>选中状态</strong> — 点击卡片选中后高亮，支持多选</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>Story Bible 中浏览所有知识条目</li>
  <li>快速查找和定位特定实体</li>
  <li>批量选择实体进行操作</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>items</code></td><td><code>CardItem[]</code></td><td>卡片数据列表</td></tr>
    <tr><td><code>viewMode</code></td><td><code>'grid' | 'list'</code></td><td>展示模式</td></tr>
    <tr><td><code>onSelect</code></td><td><code>(id: string) =&gt; void</code></td><td>选中回调</td></tr>
    <tr><td><code>onReorder</code></td><td><code>(ids: string[]) =&gt; void</code></td><td>排序回调</td></tr>
    <tr><td><code>searchable</code></td><td><code>boolean</code></td><td>是否启用搜索</td></tr>
  </tbody>
</table>
`,
  'collapsible-section': `
<h2>CollapsibleSection</h2>
<p>可折叠区组件，为 Story Bible 面板中的内容区块提供折叠/展开交互，与 ToggleSectionShell 类似但针对 Story Bible 样式定制。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>折叠/展开</strong> — 平滑动画切换内容区可见性</li>
  <li><strong>计数徽章</strong> — 标题栏右侧可展示条目数量</li>
  <li><strong>操作按钮</strong> — 标题栏支持添加操作按钮（如新增、刷新）</li>
  <li><strong>空状态</strong> — 内容为空时展示友好的空状态提示</li>
  <li><strong>持久化状态</strong> — 可将展开/收起状态持久化到 localStorage</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>Story Bible 面板中按类别折叠展示知识条目</li>
  <li>Canon/Draft/Narrative 等区块的容器</li>
  <li>任何需要按需展示/隐藏的分组内容</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>title</code></td><td><code>string</code></td><td>区块标题</td></tr>
    <tr><td><code>count</code></td><td><code>number</code></td><td>条目数量</td></tr>
    <tr><td><code>defaultOpen</code></td><td><code>boolean</code></td><td>默认是否展开</td></tr>
    <tr><td><code>persistenceKey</code></td><td><code>string</code></td><td>状态持久化 key</td></tr>
    <tr><td><code>actions</code></td><td><code>ReactNode</code></td><td>操作区内容</td></tr>
    <tr><td><code>emptyText</code></td><td><code>string</code></td><td>空状态提示文本</td></tr>
    <tr><td><code>children</code></td><td><code>ReactNode</code></td><td>折叠区内容</td></tr>
  </tbody>
</table>
`,
  'narrative-record-list': `
<h2>NarrativeRecordList</h2>
<p>叙事记录列表组件，展示 Story Bible 中的叙事条目列表，支持按时间线或分类浏览。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>时间线视图</strong> — 按叙事发生时间排列条目</li>
  <li><strong>分类视图</strong> — 按叙事类型（事件、转折、伏笔等）分组展示</li>
  <li><strong>条目摘要</strong> — 每条记录展示标题、摘要、关联章节</li>
  <li><strong>状态标记</strong> — 标记叙事记录的状态（已确认/草稿/已废弃）</li>
  <li><strong>快速操作</strong> — 支持内联编辑状态和删除操作</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>Story Bible 中浏览所有叙事记录</li>
  <li>按时间线回顾故事发展脉络</li>
  <li>管理伏笔和转折的设置与回收</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>records</code></td><td><code>NarrativeRecord[]</code></td><td>叙事记录列表</td></tr>
    <tr><td><code>viewMode</code></td><td><code>'timeline' | 'category'</code></td><td>浏览模式</td></tr>
    <tr><td><code>onSelect</code></td><td><code>(id: string) =&gt; void</code></td><td>选中记录回调</td></tr>
    <tr><td><code>onStatusChange</code></td><td><code>(id: string, status: RecordStatus) =&gt; void</code></td><td>状态变更回调</td></tr>
    <tr><td><code>onDelete</code></td><td><code>(id: string) =&gt; void</code></td><td>删除记录回调</td></tr>
  </tbody>
</table>
`,
  'story-bible-canon-section': `
<h2>StoryBibleCanonSection</h2>
<p>Canon 区组件，展示和管理 Story Bible 中的 Canon（正典）条目，即已确认的、不可随意修改的核心设定。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>Canon 条目列表</strong> — 展示所有正典设定条目</li>
  <li><strong>锁定状态</strong> — Canon 条目标记为锁定，修改需确认操作</li>
  <li><strong>版本历史</strong> — 记录 Canon 条目的修改历史</li>
  <li><strong>保护机制</strong> — 修改 Canon 条目前弹出确认对话框，防止误改</li>
  <li><strong>分类浏览</strong> — 按设定类别（世界观、规则、约束等）分组展示</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>维护故事的核心设定，确保不被随意修改</li>
  <li>写作时查阅已确认的世界观规则</li>
  <li>审核对核心设定的修改请求</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>entries</code></td><td><code>CanonEntry[]</code></td><td>Canon 条目列表</td></tr>
    <tr><td><code>onEdit</code></td><td><code>(id: string, updates: Partial&lt;CanonEntry&gt;) =&gt; void</code></td><td>编辑条目回调（含确认）</td></tr>
    <tr><td><code>onViewHistory</code></td><td><code>(id: string) =&gt; void</code></td><td>查看版本历史回调</td></tr>
    <tr><td><code>onDemote</code></td><td><code>(id: string) =&gt; void</code></td><td>降级为草稿回调</td></tr>
  </tbody>
</table>
`,
  'story-bible-draft-section': `
<h2>StoryBibleDraftSection</h2>
<p>草稿区组件，展示和管理 Story Bible 中的 Draft（草稿）条目，即尚未正式确认的设定和想法。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>草稿条目列表</strong> — 展示所有草稿设定条目</li>
  <li><strong>自由编辑</strong> — 草稿条目可自由编辑，无需确认</li>
  <li><strong>升级为 Canon</strong> — 确认草稿后可升级为 Canon 条目</li>
  <li><strong>草稿来源</strong> — 标注草稿的来源（手动创建、AI 建议、从叙事提取）</li>
  <li><strong>合并去重</strong> — 检测相似草稿并提示合并</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>记录尚未成熟的设定想法</li>
  <li>审阅 AI 建议的设定，确认后升级为 Canon</li>
  <li>从叙事文本中提取的设定暂存区</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>entries</code></td><td><code>DraftEntry[]</code></td><td>草稿条目列表</td></tr>
    <tr><td><code>onCreate</code></td><td><code>(entry: DraftEntry) =&gt; void</code></td><td>创建草稿回调</td></tr>
    <tr><td><code>onEdit</code></td><td><code>(id: string, updates: Partial&lt;DraftEntry&gt;) =&gt; void</code></td><td>编辑草稿回调</td></tr>
    <tr><td><code>onPromote</code></td><td><code>(id: string) =&gt; void</code></td><td>升级为 Canon 回调</td></tr>
    <tr><td><code>onDelete</code></td><td><code>(id: string) =&gt; void</code></td><td>删除草稿回调</td></tr>
    <tr><td><code>onMerge</code></td><td><code>(ids: string[]) =&gt; void</code></td><td>合并草稿回调</td></tr>
  </tbody>
</table>
`,
  'story-bible-knowledge-section': `
<h2>StoryBibleKnowledgeSection</h2>
<p>知识区组件，展示和管理 Story Bible 中的知识条目，包括世界设定、规则体系等结构化知识。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>知识分类</strong> — 按类别组织知识条目（历史、地理、文化、科技等）</li>
  <li><strong>层级结构</strong> — 支持知识的层级关系（如魔法体系 → 元素系 → 火系）</li>
  <li><strong>交叉引用</strong> — 知识条目间可建立引用关系，形成知识网络</li>
  <li><strong>标签体系</strong> — 支持多维度标签分类</li>
  <li><strong>搜索与筛选</strong> — 按关键词和类别检索知识</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>构建故事世界的知识体系</li>
  <li>写作时快速查阅相关设定</li>
  <li>维护设定的交叉引用和一致性</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>entries</code></td><td><code>KnowledgeEntry[]</code></td><td>知识条目列表</td></tr>
    <tr><td><code>categories</code></td><td><code>string[]</code></td><td>知识类别列表</td></tr>
    <tr><td><code>onCreate</code></td><td><code>(entry: KnowledgeEntry) =&gt; void</code></td><td>创建条目回调</td></tr>
    <tr><td><code>onEdit</code></td><td><code>(id: string, updates: Partial&lt;KnowledgeEntry&gt;) =&gt; void</code></td><td>编辑条目回调</td></tr>
    <tr><td><code>onLink</code></td><td><code>(fromId: string, toId: string) =&gt; void</code></td><td>建立引用回调</td></tr>
  </tbody>
</table>
`,
  'story-bible-narrative-section': `
<h2>StoryBibleNarrativeSection</h2>
<p>叙事区组件，展示和管理 Story Bible 中的叙事条目，记录故事中已发生的事件和叙事线索。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>叙事条目列表</strong> — 展示所有叙事记录</li>
  <li><strong>时间线排列</strong> — 按故事内时间顺序排列叙事事件</li>
  <li><strong>线索追踪</strong> — 标记叙事线索的状态（活跃/已回收/已废弃）</li>
  <li><strong>实体关联</strong> — 将叙事条目与角色、地点等实体关联</li>
  <li><strong>AI 提取</strong> — 从写作文本中自动提取叙事事件</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>追踪故事中已展开的叙事线索</li>
  <li>确保伏笔的合理回收</li>
  <li>审阅 AI 自动提取的叙事事件</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>entries</code></td><td><code>NarrativeEntry[]</code></td><td>叙事条目列表</td></tr>
    <tr><td><code>onCreate</code></td><td><code>(entry: NarrativeEntry) =&gt; void</code></td><td>创建条目回调</td></tr>
    <tr><td><code>onEdit</code></td><td><code>(id: string, updates: Partial&lt;NarrativeEntry&gt;) =&gt; void</code></td><td>编辑条目回调</td></tr>
    <tr><td><code>onLinkEntity</code></td><td><code>(entryId: string, entityId: string) =&gt; void</code></td><td>关联实体回调</td></tr>
    <tr><td><code>onExtract</code></td><td><code>() =&gt; void</code></td><td>AI 提取回调</td></tr>
  </tbody>
</table>
`,
  'story-bible-panel-content': `
<h2>StoryBiblePanelContent</h2>
<p>面板内容组件，Story Bible 面板的主内容区容器，整合 Canon/Draft/Knowledge/Narrative 各区块并提供统一的导航和搜索。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>区块导航</strong> — 顶部标签栏快速切换 Canon/Draft/Knowledge/Narrative 区块</li>
  <li><strong>全局搜索</strong> — 跨区块搜索所有 Story Bible 条目</li>
  <li><strong>统计概览</strong> — 展示各区块的条目数量统计</li>
  <li><strong>最近修改</strong> — 展示最近修改的条目列表</li>
  <li><strong>快速创建</strong> — 提供快速创建各类条目的入口</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>作为 Story Bible 面板的主体内容区</li>
  <li>统一入口管理所有 Story Bible 数据</li>
  <li>快速检索和定位特定设定条目</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>activeSection</code></td><td><code>'canon' | 'draft' | 'knowledge' | 'narrative'</code></td><td>当前激活区块</td></tr>
    <tr><td><code>onSectionChange</code></td><td><code>(section: string) =&gt; void</code></td><td>区块切换回调</td></tr>
    <tr><td><code>searchQuery</code></td><td><code>string</code></td><td>搜索关键词</td></tr>
    <tr><td><code>onSearch</code></td><td><code>(query: string) =&gt; void</code></td><td>搜索回调</td></tr>
  </tbody>
</table>
`,

  // ============================================================
  // Panels 子组件
  // ============================================================
  'ai-context-selector': `
<h2>AiContextSelector</h2>
<p>AI 上下文选择器组件，用于选择和配置发送给 AI 的上下文信息，控制 AI 能够访问的知识范围。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>上下文来源选择</strong> — 可选择 Story Bible、Knowledge Graph、写作历史等作为上下文来源</li>
  <li><strong>实体勾选</strong> — 从各来源中勾选具体的实体条目加入上下文</li>
  <li><strong>上下文预览</strong> — 预览实际发送给 AI 的上下文内容</li>
  <li><strong>Token 估算</strong> — 实时估算上下文的 Token 数量，避免超出限制</li>
  <li><strong>模板预设</strong> — 保存和加载常用的上下文配置模板</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>在 AI 对话前选择需要参考的设定和知识</li>
  <li>控制 AI 的知识边界，避免信息过载或遗漏</li>
  <li>为不同写作场景配置不同的上下文模板</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>selectedSources</code></td><td><code>ContextSource[]</code></td><td>已选上下文来源</td></tr>
    <tr><td><code>selectedEntities</code></td><td><code>string[]</code></td><td>已选实体 ID 列表</td></tr>
    <tr><td><code>tokenEstimate</code></td><td><code>number</code></td><td>当前 Token 估算值</td></tr>
    <tr><td><code>maxTokens</code></td><td><code>number</code></td><td>Token 上限</td></tr>
    <tr><td><code>onSourceToggle</code></td><td><code>(source: ContextSource) =&gt; void</code></td><td>来源切换回调</td></tr>
    <tr><td><code>onEntityToggle</code></td><td><code>(entityId: string) =&gt; void</code></td><td>实体勾选回调</td></tr>
    <tr><td><code>onSaveTemplate</code></td><td><code>(name: string) =&gt; void</code></td><td>保存模板回调</td></tr>
  </tbody>
</table>
`,
  'conflict-resolution-panel': `
<h2>ConflictResolutionPanel</h2>
<p>冲突解决面板组件，当多个知识来源或写作版本之间出现矛盾时，提供可视化的冲突检测和解决界面。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>冲突检测</strong> — 自动检测知识库和叙事文本之间的矛盾和冲突</li>
  <li><strong>冲突列表</strong> — 按严重程度排列的冲突清单，标注冲突类型（事实矛盾、设定不一致等）</li>
  <li><strong>对比视图</strong> — 并排展示冲突的多个版本，高亮差异</li>
  <li><strong>解决操作</strong> — 提供选择保留版本、手动合并、AI 辅助解决等操作</li>
  <li><strong>解决历史</strong> — 记录冲突解决的决策历史</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>编辑设定后发现与已有叙事矛盾</li>
  <li>多版本草稿之间的内容冲突</li>
  <li>AI 生成内容与已有设定不一致</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>conflicts</code></td><td><code>Conflict[]</code></td><td>冲突列表</td></tr>
    <tr><td><code>onResolve</code></td><td><code>(conflictId: string, resolution: Resolution) =&gt; void</code></td><td>解决冲突回调</td></tr>
    <tr><td><code>onMerge</code></td><td><code>(conflictId: string, merged: string) =&gt; void</code></td><td>手动合并回调</td></tr>
    <tr><td><code>onAiAssist</code></td><td><code>(conflictId: string) =&gt; void</code></td><td>AI 辅助解决回调</td></tr>
    <tr><td><code>onDismiss</code></td><td><code>(conflictId: string) =&gt; void</code></td><td>忽略冲突回调</td></tr>
  </tbody>
</table>
`,
  'writing-context-panel': `
<h2>WritingContextPanel</h2>
<p>写作上下文面板组件，整合展示当前写作场景的所有上下文信息，包括相关设定、角色状态、情节进度等。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>上下文汇总</strong> — 聚合当前光标位置相关的所有上下文信息</li>
  <li><strong>角色状态</strong> — 展示当前场景涉及角色的最新状态</li>
  <li><strong>情节进度</strong> — 展示当前章节在情节线中的位置</li>
  <li><strong>设定参考</strong> — 展示与当前场景相关的世界设定</li>
  <li><strong>上下文注入</strong> — 一键将选中的上下文信息注入 AI 对话</li>
  <li><strong>自动更新</strong> — 光标移动或文本修改时自动刷新上下文</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>写作时在侧边栏查阅当前场景的完整上下文</li>
  <li>确保角色行为与设定一致</li>
  <li>快速将上下文信息提供给 AI 辅助写作</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>context</code></td><td><code>WritingContext</code></td><td>写作上下文数据</td></tr>
    <tr><td><code>onInject</code></td><td><code>(contextIds: string[]) =&gt; void</code></td><td>注入上下文回调</td></tr>
    <tr><td><code>onRefresh</code></td><td><code>() =&gt; void</code></td><td>刷新上下文回调</td></tr>
    <tr><td><code>onNavigate</code></td><td><code>(entityId: string) =&gt; void</code></td><td>导航到实体详情回调</td></tr>
    <tr><td><code>autoRefresh</code></td><td><code>boolean</code></td><td>是否自动刷新</td></tr>
  </tbody>
</table>
`,

  // ============================================================
  // Knowledge Graph 子组件
  // ============================================================
  'graph-context-menu': `
<h2>GraphContextMenu</h2>
<p>图谱上下文菜单组件，在知识图谱中右键点击节点或边时弹出，提供节点/边相关的操作菜单。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>节点操作</strong> — 右键节点弹出编辑、删除、展开关联、高亮路径等操作</li>
  <li><strong>边操作</strong> — 右键边弹出编辑关系、删除连接、修改权重等操作</li>
  <li><strong>画布操作</strong> — 右键空白区域弹出添加节点、重置视图等操作</li>
  <li><strong>自定义菜单项</strong> — 支持注册自定义菜单项扩展功能</li>
  <li><strong>位置跟随</strong> — 菜单位置跟随鼠标，自动适配画布边界</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>在知识图谱中快速编辑节点属性</li>
  <li>管理图谱中实体间的关系</li>
  <li>通过右键菜单触发图谱相关操作</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>position</code></td><td><code>{ x: number; y: number }</code></td><td>菜单位置</td></tr>
    <tr><td><code>target</code></td><td><code>Node | Edge | 'canvas'</code></td><td>右键目标对象</td></tr>
    <tr><td><code>items</code></td><td><code>MenuItem[]</code></td><td>菜单项列表</td></tr>
    <tr><td><code>onAction</code></td><td><code>(action: string) =&gt; void</code></td><td>菜单操作回调</td></tr>
    <tr><td><code>onClose</code></td><td><code>() =&gt; void</code></td><td>关闭菜单回调</td></tr>
  </tbody>
</table>
`,
  'graph-minimap': `
<h2>GraphMinimap</h2>
<p>图谱缩略图组件，在知识图谱角落展示全局缩略视图，方便在大规模图谱中快速定位和导航。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>全局缩略</strong> — 以缩放比例展示整个图谱的全貌</li>
  <li><strong>视口框</strong> — 用矩形框标识当前视口的可见范围</li>
  <li><strong>拖拽导航</strong> — 拖拽缩略图中的视口框快速平移主视图</li>
  <li><strong>节点高亮</strong> — 缩略图中高亮选中或搜索到的节点</li>
  <li><strong>可折叠</strong> — 可最小化为小图标，节省空间</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>大规模知识图谱中快速定位感兴趣的节点</li>
  <li>了解图谱的整体结构和布局</li>
  <li>在缩放和拖拽后快速回到特定区域</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>graphData</code></td><td><code>GraphData</code></td><td>图谱数据</td></tr>
    <tr><td><code>viewport</code></td><td><code>ViewportState</code></td><td>当前视口状态</td></tr>
    <tr><td><code>onViewportChange</code></td><td><code>(viewport: ViewportState) =&gt; void</code></td><td>视口变化回调</td></tr>
    <tr><td><code>highlightNodes</code></td><td><code>string[]</code></td><td>需高亮的节点 ID</td></tr>
    <tr><td><code>collapsible</code></td><td><code>boolean</code></td><td>是否可折叠</td></tr>
  </tbody>
</table>
`,
  'knowledge-graph-toolbar': `
<h2>KnowledgeGraphToolbar</h2>
<p>图谱工具栏组件，提供知识图谱的布局控制、筛选、缩放等常用操作入口。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>布局切换</strong> — 在力导向图、层级图、环形图等布局间切换</li>
  <li><strong>缩放控制</strong> — 放大、缩小、适配画布等缩放操作</li>
  <li><strong>节点筛选</strong> — 按类型、标签筛选显示的节点</li>
  <li><strong>搜索定位</strong> — 搜索节点名称并自动定位到对应位置</li>
  <li><strong>导出</strong> — 将图谱导出为图片或 JSON</li>
  <li><strong>全屏模式</strong> — 一键切换全屏查看图谱</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>切换图谱布局以不同视角理解知识网络</li>
  <li>在大规模图谱中搜索和定位特定节点</li>
  <li>导出图谱用于分享和展示</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>layout</code></td><td><code>'force' | 'hierarchy' | 'circular'</code></td><td>当前布局类型</td></tr>
    <tr><td><code>onLayoutChange</code></td><td><code>(layout: string) =&gt; void</code></td><td>布局切换回调</td></tr>
    <tr><td><code>onZoom</code></td><td><code>(direction: 'in' | 'out' | 'fit') =&gt; void</code></td><td>缩放回调</td></tr>
    <tr><td><code>onSearch</code></td><td><code>(query: string) =&gt; void</code></td><td>搜索回调</td></tr>
    <tr><td><code>onFilter</code></td><td><code>(filters: FilterState) =&gt; void</code></td><td>筛选回调</td></tr>
    <tr><td><code>onExport</code></td><td><code>(format: 'png' | 'svg' | 'json') =&gt; void</code></td><td>导出回调</td></tr>
    <tr><td><code>onFullscreen</code></td><td><code>() =&gt; void</code></td><td>全屏切换回调</td></tr>
  </tbody>
</table>
`,
  'knowledge-graph-view': `
<h2>KnowledgeGraphView</h2>
<p>图谱视图组件，知识图谱的主渲染视图，基于 Canvas 或 SVG 绘制节点和边，支持交互式浏览。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>节点渲染</strong> — 按实体类型着色和标注的节点展示</li>
  <li><strong>边渲染</strong> — 按关系类型着色和标注的连线展示</li>
  <li><strong>拖拽交互</strong> — 拖拽节点调整布局，拖拽画布平移视图</li>
  <li><strong>缩放</strong> — 鼠标滚轮缩放，支持捏合手势</li>
  <li><strong>节点选择</strong> — 点击选中节点，展示详情面板</li>
  <li><strong>力导向布局</strong> — 自动计算节点位置，支持实时布局动画</li>
  <li><strong>性能优化</strong> — 大规模图谱下启用 WebGL 渲染和虚拟化</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>以可视化方式浏览知识库中实体间的关系网络</li>
  <li>发现实体间的隐含关联</li>
  <li>直观理解故事世界的知识结构</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>nodes</code></td><td><code>GraphNode[]</code></td><td>节点数据</td></tr>
    <tr><td><code>edges</code></td><td><code>GraphEdge[]</code></td><td>边数据</td></tr>
    <tr><td><code>layout</code></td><td><code>LayoutType</code></td><td>布局类型</td></tr>
    <tr><td><code>onNodeClick</code></td><td><code>(nodeId: string) =&gt; void</code></td><td>节点点击回调</td></tr>
    <tr><td><code>onEdgeClick</code></td><td><code>(edgeId: string) =&gt; void</code></td><td>边点击回调</td></tr>
    <tr><td><code>onNodeDrag</code></td><td><code>(nodeId: string, position: Position) =&gt; void</code></td><td>节点拖拽回调</td></tr>
    <tr><td><code>selectedNodeId</code></td><td><code>string | null</code></td><td>当前选中节点</td></tr>
  </tbody>
</table>
`,
  'sidebar-graph-view': `
<h2>SidebarGraphView</h2>
<p>侧边栏图谱视图组件，在侧边栏中展示知识图谱的精简版本，聚焦于当前选中实体的局部关系网络。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>局部视图</strong> — 仅展示当前选中实体及其直接关联的节点</li>
  <li><strong>紧凑布局</strong> — 适配侧边栏宽度的紧凑布局</li>
  <li><strong>实体切换</strong> — 切换中心实体时自动刷新图谱</li>
  <li><strong>快捷操作</strong> — 在侧边栏中直接对节点进行基本操作</li>
  <li><strong>展开到全屏</strong> — 提供一键跳转到完整 KnowledgeGraphView 的入口</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>在侧边栏中快速查看当前实体的关系网络</li>
  <li>写作时无需切换面板即可浏览局部知识图谱</li>
  <li>从局部视图发现感兴趣的关联后展开查看全貌</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>centerEntityId</code></td><td><code>string</code></td><td>中心实体 ID</td></tr>
    <tr><td><code>depth</code></td><td><code>number</code></td><td>展开深度，默认 1</td></tr>
    <tr><td><code>onNodeClick</code></td><td><code>(nodeId: string) =&gt; void</code></td><td>节点点击回调</td></tr>
    <tr><td><code>onExpand</code></td><td><code>() =&gt; void</code></td><td>展开到全屏回调</td></tr>
  </tbody>
</table>
`,

  // ============================================================
  // Narrative 子组件
  // ============================================================
  'brainstorm-panel': `
<h2>BrainstormPanel</h2>
<p>头脑风暴面板组件，提供 AI 驱动的叙事头脑风暴功能，帮助作者拓展创作思路和探索叙事可能性。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>主题输入</strong> — 输入头脑风暴的主题或问题</li>
  <li><strong>AI 建议</strong> — AI 基于当前上下文生成多个创意方案</li>
  <li><strong>方案评分</strong> — 对每个方案进行创意性、可行性、契合度评分</li>
  <li><strong>方案对比</strong> — 并排对比多个方案的优劣</li>
  <li><strong>方案采纳</strong> — 选中方案后一键应用到叙事中</li>
  <li><strong>迭代深化</strong> — 对选中的方案继续追问和深化</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>遇到创作瓶颈时寻求 AI 的创意启发</li>
  <li>探索同一情节的多种发展可能</li>
  <li>评估不同叙事选择的优劣</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>topic</code></td><td><code>string</code></td><td>头脑风暴主题</td></tr>
    <tr><td><code>suggestions</code></td><td><code>BrainstormSuggestion[]</code></td><td>AI 生成的建议列表</td></tr>
    <tr><td><code>onGenerate</code></td><td><code>(topic: string) =&gt; void</code></td><td>生成建议回调</td></tr>
    <tr><td><code>onAdopt</code></td><td><code>(suggestionId: string) =&gt; void</code></td><td>采纳建议回调</td></tr>
    <tr><td><code>onIterate</code></td><td><code>(suggestionId: string, question: string) =&gt; void</code></td><td>迭代深化回调</td></tr>
    <tr><td><code>loading</code></td><td><code>boolean</code></td><td>是否正在生成</td></tr>
  </tbody>
</table>
`,
  'foreshadow-panel': `
<h2>ForeshadowPanel</h2>
<p>伏笔面板组件，管理和追踪故事中的伏笔设置与回收，确保叙事的完整性和一致性。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>伏笔列表</strong> — 展示所有已设置的伏笔，标注状态（已设置/已暗示/已回收/已废弃）</li>
  <li><strong>伏笔详情</strong> — 展示伏笔的设置位置、暗示线索、预期回收点</li>
  <li><strong>回收提醒</strong> — 检测长期未回收的伏笔，发出提醒</li>
  <li><strong>冲突检测</strong> — 检测伏笔与实际叙事之间的矛盾</li>
  <li><strong>AI 建议</strong> — AI 分析当前叙事，建议伏笔的回收时机和方式</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>写作前规划伏笔的设置和回收计划</li>
  <li>写作中追踪伏笔的推进状态</li>
  <li>审稿时检查伏笔是否全部合理回收</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>foreshadows</code></td><td><code>Foreshadow[]</code></td><td>伏笔数据列表</td></tr>
    <tr><td><code>onCreate</code></td><td><code>(foreshadow: Foreshadow) =&gt; void</code></td><td>创建伏笔回调</td></tr>
    <tr><td><code>onUpdate</code></td><td><code>(id: string, updates: Partial&lt;Foreshadow&gt;) =&gt; void</code></td><td>更新伏笔回调</td></tr>
    <tr><td><code>onResolve</code></td><td><code>(id: string) =&gt; void</code></td><td>回收伏笔回调</td></tr>
    <tr><td><code>onAiSuggest</code></td><td><code>(id: string) =&gt; void</code></td><td>AI 建议回调</td></tr>
  </tbody>
</table>
`,
  'quality-score-panel': `
<h2>QualityScorePanel</h2>
<p>质量评分面板组件，展示 AI 对当前文本的写作质量评估结果，以多维度评分和综合评级的形式呈现。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>综合评分</strong> — 以大数字和评级徽章展示整体质量评分</li>
  <li><strong>维度评分</strong> — 展示各写作维度（叙事、对话、描写、节奏等）的独立评分</li>
  <li><strong>雷达图</strong> — 以雷达图形式直观展示各维度的均衡度</li>
  <li><strong>历史趋势</strong> — 展示评分随章节的变化趋势</li>
  <li><strong>评分说明</strong> — 点击维度查看 AI 生成的评估说明和改进建议</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>完成一段写作后快速评估整体质量</li>
  <li>对比各维度的得分找到薄弱环节</li>
  <li>追踪写作质量的长期变化趋势</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>score</code></td><td><code>QualityScore</code></td><td>质量评分数据</td></tr>
    <tr><td><code>dimensions</code></td><td><code>DimensionScore[]</code></td><td>各维度评分数据</td></tr>
    <tr><td><code>history</code></td><td><code>QualityScore[]</code></td><td>历史评分数据</td></tr>
    <tr><td><code>onDimensionClick</code></td><td><code>(dimension: string) =&gt; void</code></td><td>维度点击回调</td></tr>
    <tr><td><code>onRefresh</code></td><td><code>() =&gt; void</code></td><td>重新评分回调</td></tr>
  </tbody>
</table>
`,

  // ============================================================
  // Narrative Visualization 子组件
  // ============================================================
  'character-graph-view': `
<h2>CharacterGraphView</h2>
<p>角色图谱视图组件，以图的形式展示角色间的关系网络，直观呈现角色关系的复杂度和结构。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>关系图谱</strong> — 节点代表角色，边代表关系，边的颜色/粗细表示关系类型/强度</li>
  <li><strong>关系类型</strong> — 区分友谊、敌对、爱情、家庭等多种关系类型</li>
  <li><strong>互动频次</strong> — 边的粗细反映角色间的互动频次</li>
  <li><strong>角色筛选</strong> — 按章节或场景筛选角色关系</li>
  <li><strong>聚焦模式</strong> — 选中一个角色后高亮其直接关联，淡出其他角色</li>
  <li><strong>动态更新</strong> — 写作过程中实时更新角色关系图谱</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>规划角色关系网络</li>
  <li>检查角色互动是否均衡</li>
  <li>发现角色间的潜在互动机会</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>characters</code></td><td><code>Character[]</code></td><td>角色数据</td></tr>
    <tr><td><code>relationships</code></td><td><code>Relationship[]</code></td><td>关系数据</td></tr>
    <tr><td><code>focusCharacterId</code></td><td><code>string | null</code></td><td>聚焦角色 ID</td></tr>
    <tr><td><code>chapterFilter</code></td><td><code>number | null</code></td><td>章节筛选</td></tr>
    <tr><td><code>onCharacterClick</code></td><td><code>(characterId: string) =&gt; void</code></td><td>角色点击回调</td></tr>
    <tr><td><code>onRelationshipClick</code></td><td><code>(relationshipId: string) =&gt; void</code></td><td>关系点击回调</td></tr>
  </tbody>
</table>
`,
  'tension-curve-view': `
<h2>TensionCurveView</h2>
<p>张力曲线视图组件，以折线图形式展示故事张力的起伏变化，帮助作者把控叙事节奏。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>张力曲线</strong> — 按章节/场景展示张力值的变化曲线</li>
  <li><strong>事件标注</strong> — 在曲线关键点标注对应的叙事事件</li>
  <li><strong>理想曲线对比</strong> — 叠加经典叙事结构（三幕式、英雄之旅等）的理想张力曲线</li>
  <li><strong>节奏分析</strong> — AI 分析当前节奏模式并给出建议</li>
  <li><strong>局部缩放</strong> — 可缩放查看特定章节的张力细节</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>审阅故事整体节奏是否合理</li>
  <li>对比实际张力与经典叙事结构的差异</li>
  <li>定位张力过低或过高的问题章节</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>data</code></td><td><code>TensionPoint[]</code></td><td>张力数据点</td></tr>
    <tr><td><code>referenceCurve</code></td><td><code>'three-act' | 'hero-journey' | null</code></td><td>对比的经典曲线</td></tr>
    <tr><td><code>annotations</code></td><td><code>EventAnnotation[]</code></td><td>事件标注</td></tr>
    <tr><td><code>onPointClick</code></td><td><code>(index: number) =&gt; void</code></td><td>数据点点击回调</td></tr>
    <tr><td><code>onAnalyze</code></td><td><code>() =&gt; void</code></td><td>AI 节奏分析回调</td></tr>
  </tbody>
</table>
`,
  'timeline-view': `
<h2>TimelineView</h2>
<p>时间线视图组件，以时间轴形式展示故事中的事件序列，支持故事内时间和现实时间的双轴展示。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>时间轴展示</strong> — 水平时间轴上展示事件节点</li>
  <li><strong>多时间线</strong> — 支持多条时间线（不同角色/地点的并行事件线）</li>
  <li><strong>时间缩放</strong> — 支持按年/月/日/小时不同粒度查看</li>
  <li><strong>事件详情</strong> — 点击事件节点展示详细描述</li>
  <li><strong>持续时间</strong> — 支持展示持续一段时间的长事件</li>
  <li><strong>拖拽调整</strong> — 拖拽事件节点调整其在时间线上的位置</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>梳理故事中的事件顺序和时间逻辑</li>
  <li>检查多线叙事的时间线是否自洽</li>
  <li>规划后续章节的时间安排</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>events</code></td><td><code>TimelineEvent[]</code></td><td>时间线事件数据</td></tr>
    <tr><td><code>lanes</code></td><td><code>TimelineLane[]</code></td><td>时间线轨道配置</td></tr>
    <tr><td><code>scale</code></td><td><code>'year' | 'month' | 'day' | 'hour'</code></td><td>时间粒度</td></tr>
    <tr><td><code>onEventClick</code></td><td><code>(eventId: string) =&gt; void</code></td><td>事件点击回调</td></tr>
    <tr><td><code>onEventDrag</code></td><td><code>(eventId: string, newTime: Date) =&gt; void</code></td><td>事件拖拽回调</td></tr>
  </tbody>
</table>
`,
  'visualization-toolbar': `
<h2>VisualizationToolbar</h2>
<p>可视化工具栏组件，为叙事可视化视图提供统一的工具栏，包含视图切换、导出和配置操作。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>视图切换</strong> — 在角色图谱、张力曲线、时间线之间快速切换</li>
  <li><strong>导出功能</strong> — 将当前可视化导出为图片</li>
  <li><strong>数据筛选</strong> — 按章节、角色、时间范围筛选数据</li>
  <li><strong>显示选项</strong> — 控制标注、网格、参考线等显示元素</li>
  <li><strong>全屏模式</strong> — 一键进入全屏查看</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>在不同可视化视图间快速切换</li>
  <li>调整可视化展示参数</li>
  <li>导出可视化结果用于分享</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>activeView</code></td><td><code>'character-graph' | 'tension-curve' | 'timeline'</code></td><td>当前视图</td></tr>
    <tr><td><code>onViewChange</code></td><td><code>(view: string) =&gt; void</code></td><td>视图切换回调</td></tr>
    <tr><td><code>onExport</code></td><td><code>(format: 'png' | 'svg') =&gt; void</code></td><td>导出回调</td></tr>
    <tr><td><code>onFilter</code></td><td><code>(filters: VizFilters) =&gt; void</code></td><td>筛选回调</td></tr>
    <tr><td><code>onFullscreen</code></td><td><code>() =&gt; void</code></td><td>全屏切换回调</td></tr>
    <tr><td><code>displayOptions</code></td><td><code>DisplayOptions</code></td><td>显示选项状态</td></tr>
  </tbody>
</table>
`,

  // ============================================================
  // Editor Extensions
  // ============================================================
  'math-view': `
<h2>MathView</h2>
<p>数学公式视图扩展，为编辑器提供数学公式的渲染和编辑能力，基于 KaTeX 实现数学符号的实时预览。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>公式渲染</strong> — 将 LaTeX 语法编写的数学公式渲染为可视化公式</li>
  <li><strong>实时预览</strong> — 编辑 LaTeX 代码时实时更新渲染结果</li>
  <li><strong>行内/块级</strong> — 支持行内公式（<code>$...$</code>）和块级公式（<code>$$...$$</code>）</li>
  <li><strong>点击编辑</strong> — 点击渲染后的公式回到 LaTeX 编辑模式</li>
  <li><strong>公式库</strong> — 提供常用数学公式的快捷插入</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>在写作中插入数学公式（如科幻作品中的公式推导）</li>
  <li>编写包含数学内容的技术文档</li>
  <li>教学材料中展示数学表达式</li>
</ul>

<h3>配置说明</h3>
<table>
  <thead>
    <tr><th>选项</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>enabled</code></td><td><code>boolean</code></td><td>是否启用数学公式扩展</td></tr>
    <tr><td><code>engine</code></td><td><code>'katex' | 'mathjax'</code></td><td>渲染引擎</td></tr>
    <tr><td><code>macros</code></td><td><code>Record&lt;string, string&gt;</code></td><td>自定义 LaTeX 宏</td></tr>
  </tbody>
</table>
`,
  'show-tell-decorations': `
<h2>ShowTellDecorations</h2>
<p>Show/Tell 装饰扩展，在编辑器中为文本添加 Show（展示/描写）和 Tell（叙述/概括）的视觉装饰，帮助作者直观了解写作手法的分布。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>Show 高亮</strong> — 以绿色背景高亮标记 Show 写法（通过描写展现情感和事件）</li>
  <li><strong>Tell 高亮</strong> — 以橙色背景高亮标记 Tell 写法（直接叙述情感和事件）</li>
  <li><strong>悬停提示</strong> — 悬停高亮区域时显示该段文本的 Show/Tell 分类理由</li>
  <li><strong>开关控制</strong> — 可通过命令面板或工具栏开关装饰的显示</li>
  <li><strong>实时更新</strong> — 文本修改后自动重新分析并更新装饰</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>审视写作中 Show/Tell 的比例和分布</li>
  <li>识别过度使用 Tell 的段落，增强描写</li>
  <li>写作教学中的 Show vs Tell 演示</li>
</ul>

<h3>配置说明</h3>
<table>
  <thead>
    <tr><th>选项</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>enabled</code></td><td><code>boolean</code></td><td>是否启用 Show/Tell 装饰</td></tr>
    <tr><td><code>showColor</code></td><td><code>string</code></td><td>Show 高亮颜色</td></tr>
    <tr><td><code>tellColor</code></td><td><code>string</code></td><td>Tell 高亮颜色</td></tr>
    <tr><td><code>autoAnalyze</code></td><td><code>boolean</code></td><td>是否在编辑时自动分析</td></tr>
  </tbody>
</table>
`,
  'voice-consistency-decorations': `
<h2>VoiceConsistencyDecorations</h2>
<p>声纹一致性装饰扩展，在编辑器中检测和标记角色对话的声纹一致性问题，帮助作者保持角色语言的独特性。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>声纹检测</strong> — 分析角色对话的语言特征（用词、句式、语气等）</li>
  <li><strong>一致性标记</strong> — 标记与角色声纹特征不一致的对话段落</li>
  <li><strong>声纹画像</strong> — 为每个角色建立声纹画像，可视化展示语言特征</li>
  <li><strong>悬停提示</strong> — 悬停标记区域时展示不一致的具体原因和修改建议</li>
  <li><strong>角色区分</strong> — 以不同颜色标记不同角色的对话</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>检查角色对话是否符合其设定的语言风格</li>
  <li>发现不同角色说话风格过于相似的问题</li>
  <li>帮助新手作者培养角色语言的差异化意识</li>
</ul>

<h3>配置说明</h3>
<table>
  <thead>
    <tr><th>选项</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>enabled</code></td><td><code>boolean</code></td><td>是否启用声纹一致性装饰</td></tr>
    <tr><td><code>sensitivity</code></td><td><code>'low' | 'medium' | 'high'</code></td><td>检测灵敏度</td></tr>
    <tr><td><code>highlightMode</code></td><td><code>'by-character' | 'by-issue'</code></td><td>高亮模式：按角色着色或按问题着色</td></tr>
  </tbody>
</table>
`,

  // ============================================================
  // Settings
  // ============================================================
  'vault-selector': `
<h2>VaultSelector</h2>
<p>Vault 选择器组件，用于选择和管理数据存储 Vault，支持多 Vault 切换和新建。</p>

<h3>功能特性</h3>
<ul>
  <li><strong>Vault 列表</strong> — 展示所有可用的 Vault，标注当前激活的 Vault</li>
  <li><strong>Vault 切换</strong> — 选择不同 Vault 后自动加载对应的数据和配置</li>
  <li><strong>新建 Vault</strong> — 输入名称创建新的 Vault</li>
  <li><strong>Vault 信息</strong> — 展示 Vault 的存储路径、大小、最后修改时间等信息</li>
  <li><strong>导入/导出</strong> — 支持 Vault 数据的导入和导出</li>
</ul>

<h3>使用场景</h3>
<ul>
  <li>在多个写作项目间切换 Vault</li>
  <li>为不同的作品系列创建独立的 Vault</li>
  <li>备份和迁移 Vault 数据</li>
</ul>

<h3>Props 说明</h3>
<table>
  <thead>
    <tr><th>属性</th><th>类型</th><th>说明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>vaults</code></td><td><code>Vault[]</code></td><td>Vault 列表</td></tr>
    <tr><td><code>activeVaultId</code></td><td><code>string</code></td><td>当前激活 Vault ID</td></tr>
    <tr><td><code>onSelect</code></td><td><code>(vaultId: string) =&gt; void</code></td><td>Vault 选择回调</td></tr>
    <tr><td><code>onCreate</code></td><td><code>(name: string) =&gt; void</code></td><td>创建 Vault 回调</td></tr>
    <tr><td><code>onImport</code></td><td><code>(path: string) =&gt; void</code></td><td>导入 Vault 回调</td></tr>
    <tr><td><code>onExport</code></td><td><code>(vaultId: string, targetPath: string) =&gt; void</code></td><td>导出 Vault 回调</td></tr>
  </tbody>
</table>
`,
};
