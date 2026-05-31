# Niko Studio 产品定义文档

> **定位**: 开箱即用的 AI 写作工作站
> **版本**: v1.0
> **日期**: 2026-06-01
> **状态**: 当前交付口径，与 `README.md`、`docs/CAPABILITY_MATRIX.md` 对齐

---

## 1. 产品愿景与定位

### 1.1 一句话定位

**Niko Studio 是开箱即用的 AI 写作工作站**——为中国网络小说和长篇小说作者提供从灵感萌芽到成稿交付的完整闭环，让 AI 成为可信赖的写作搭档而非黑箱替代者。

### 1.2 愿景

让每一位中文网文作者都拥有一个懂叙事、会反思、能迭代的 AI 写作搭档。作者始终掌握创意控制权，AI 负责辅助构思、检测缺陷、优化技法、追踪一致性，将「从灵感到成稿」的周期缩短 30% 以上。

### 1.3 核心信条

| 信条 | 含义 |
|------|------|
| **作者主权** | AI 是工具不是作者，所有生成内容需经作者确认 |
| **透明可审** | AI 建议附带原因和证据链，拒绝黑箱操作 |
| **本地优先** | 核心写作功能不依赖云端 SaaS，数据留在本地 |
| **渐进增强** | 开箱即用零配置，高级能力按需解锁 |
| **网文原生** | 评分、爽点、留存节奏等指标针对中文网络文学深度优化 |

---

## 2. 目标用户

### 2.1 核心用户画像

**画像 A：全职网文作者**
- 日更 4000-8000 字，签约平台（起点/番茄/晋江）
- 痛点：长时间连载导致设定遗忘、角色扁平化、伏笔烂尾、节奏拖沓
- 需求：一致性追踪、伏笔管理、留存节奏优化、质量门禁

**画像 B：兼职写作者**
- 有本职工作，利用业余时间创作
- 痛点：写作时间有限，需要高效工具减少返工；缺乏专业编辑反馈
- 需求：AI 辅助构思与续写、一键质量检查、写作技法指导

**画像 C：创意写作学生**
- 戏剧影视文学、创意写作专业在读
- 痛点：叙事技法理论多但实践反馈少，难以量化评估写作质量
- 需求：情感弧线可视化、show/tell 分析、风格学习与模仿、写作工艺目录

### 2.2 用户规模预估

| 阶段 | 目标 | 用户量级 |
|------|------|----------|
| 种子期 | 核心网文作者社区 | 500-2000 |
| 成长期 | 扩展至兼职写作者 | 5000-20000 |
| 成熟期 | 覆盖创意写作教育场景 | 20000+ |

---

## 3. 三层架构与核心功能

Niko Studio 采用三层架构，每层拥有独立的职责边界和抽象层级。

```
┌──────────────────────────────────────────────────────┐
│              Application Layer (交互层)                │
│   Desktop UI (React + Tauri) · Editor · Panels       │
├──────────────────────────────────────────────────────┤
│           niko-studio Engine (叙事领域层)              │
│   Agents · Evaluators · Craft · Workflow · Scoring   │
├──────────────────────────────────────────────────────┤
│            Nowledge Mem (知识层)                       │
│   Memory · Knowledge · Graph · Search · Distillation │
└──────────────────────────────────────────────────────┘
```

---

### 3.1 Nowledge Mem — 知识层

知识层是 Niko Studio 的「海马体」，负责知识的持久化、检索、关联与演化。

#### 3.1.1 六维记忆系统

将内容按 6 个维度分类存储和检索：

| 维度 | 英文 | 职责 |
|------|------|------|
| 时间线 | Timeline | 事件时间序列与因果链 |
| 上下文 | Context | 故事上下文与叙事流 |
| 角色 | Character | 角色身份与发展弧线 |
| 世界观 | Worldview | 世界设定与规则体系 |
| 偏好 | Preference | 创作偏好与风格选择 |
| 经验 | Experience | 写作经验与习得模式 |

**记忆衰减**：基于 ACT-R 认知模型 + FSRS 间隔重复算法，模拟人脑遗忘曲线，自动调整记忆检索权重——近期活跃的设定优先召回，长期未引用的设定衰减但不丢失。

#### 3.1.2 知识图谱

- 6 种叙事实体类型：CHARACTER（角色）、LOCATION（地点）、EVENT（事件）、OBJECT（物品）、CONCEPT（概念）、TIMELINE（时间线）
- 10+ 种关系类型：parent_child、sibling、related、continues、conflicts 等
- 图谱可视化：交互式 Cytoscape 图谱视图，支持缩放、筛选、右键菜单
- 图谱-Wiki 双向桥接：GraphWikiLinkBridge 实现图谱节点与 Wiki 页面的双向解析与孤儿检测

#### 3.1.3 混合检索

- 向量检索（fastembed 嵌入）+ 图谱检索 + 全文检索三路融合
- 4 信号相关性评分：RECENCY（时效性）、SOURCE_AUTHORITY（来源权威度）、QUERY_EXPANSION（查询扩展）、SELECTION（用户选择反馈）
- LRU + TTL 缓存层，EventBus 驱动的源级失效

#### 3.1.4 知识蒸馏

6 种蒸馏模板从内容中提取结构化知识：

| 模板 | 用途 |
|------|------|
| SUMMARY | 内容摘要 |
| KEY_POINTS | 要点提取 |
| CHARACTER_TRAITS | 角色特征蒸馏 |
| PLOT_STRUCTURE | 情节结构分析 |
| WORLD_BUILDING | 世界观提取 |
| STYLE_ELEMENTS | 风格元素提取 |

蒸馏结果自动追踪 DerivedFrom 引用链，支持溯源。

#### 3.1.5 背景智能

- **会话聚类**：跨写作会话的语义相似度自动聚类，发现潜在模式
- **矛盾检测**：世界观一致性验证、角色设定矛盾检测、时间线冲突告警
- **Obsidian 双向同步**：与 Obsidian vault 双向同步知识条目，支持 LAST_WRITE_WINS / MERGE / HUMAN_QUEUE 三种冲突策略

#### 3.1.6 LLM Wiki

- Crystal 页面：结构化知识条目，支持元数据与属性
- `[[wikilink]]` 语法：编辑器内双向链接，自动解析与跳转
- Study with AI：对 Wiki 条目发起 AI 辅助深度学习

---

### 3.2 niko-studio Engine — 叙事领域层

叙事领域层是 Niko Studio 的「大脑皮层」，实现叙事分析、评估、写作工艺与多 Agent 协作。

#### 3.2.1 多 Agent 协作体系

7 个专职 Agent 组成协作网络：

| Agent | 职责 |
|-------|------|
| **Architect** | 故事架构师，LOCK 分析、两门结构、场景卡片、节奏分析、蓝图生成 |
| **Commander** | 任务指挥官，场景类型识别、任务分解与分配 |
| **Writer** | 写作执行者，根据场景类型和约束生成内容 |
| **Critic** | 质量评审员，LOCK 维度检查、评分与修订建议 |
| **Character** | 角色专员，角色创建、发展弧线、对话风格 |
| **Plot** | 情节专员，伏笔状态追踪、时间线事件管理 |
| **Worldbuilding** | 世界观专员，设定规则、体系构建 |

**Skill Router**：21 个写作技能的注册与路由系统，根据任务类型自动匹配最相关技能。

#### 3.2.2 综合评分体系

Niko Studio 内建了业界最全面的中文叙事质量评分系统：

**章节边界评分**
- Hook 评分（4 维）：CONFLICT_HINT（冲突暗示）、INFO_GAP（信息缺口）、SENSORY_IMPACT（感官冲击）、PACING_ENTRY（节奏入场）
- Cliffhanger 评分（4 维）：UNRESOLVED_QUESTIONS（未解问题）、EMOTIONAL_PEAK（情绪高峰）、TWIST_IMPACT（转折冲击）、ANTICIPATION（期待感）

**情感工艺**
- Show/Tell 检测：识别直接陈述情感（tell）与间接表达（show）
- 5 层情感深度：PHYSICAL_SENSATION（生理感受）、BEHAVIORAL_EXPRESSION（行为表达）、INTERNAL_MONOLOGUE（内心独白）、METAPHORICAL（隐喻）、SUBTEXT_UNDERSTATEMENT（潜台词/克制）
- 每层配备中文模式词库与难度权重

**叙事评估器矩阵**

| 评估器 | 检测目标 |
|--------|----------|
| CharacterEvaluator | 角色深度与一致性 |
| PremiseEvaluator | 前提承诺兑现 |
| PyramidEvaluator | 叙事金字塔结构 |
| SuspenseEvaluator | 悬念三支柱（故事问题/威胁情境/导火索） |
| VoiceEvaluator | 叙事声音一致性 |
| DreamEvaluator | 虚构梦境沉浸度 |
| FourSelvesEvaluator | 麦基四个自我模型（社会/个人/秘密/隐藏） |
| ClicheDetector | 陈词滥调检测 |
| SubtextEvaluator | 潜台词质量 |
| DeadlySinsChecker | 七个致命错误（结构漂移/情感真空/叙事停滞/冷漠懦夫/盲目铺设/面目模糊/混乱呈现） |

**小说质量评分（6 维）**
- Repetition（重复度）、Tone（语调）、Clarity（清晰度）、Causality（因果性）、Detail（细节度）、Factuality（事实性）
- 4 级质量标准：ultra / high / medium / fluent，每级有独立维度乘数

#### 3.2.3 写作工艺目录

45+ 工艺技能，覆盖中文网络文学核心技法：

- **爽点体系**：10 种满足模式（力量展示/隐藏实力/弱者逆袭/权威打脸/反派翻车/甜蜜惊喜/谜题解开/升级突破/被认可/复仇）
- **悬念子类型**：本格推理/社会派/硬汉派/惊悚派
- **叙事技法**：升级阶梯/反转时机/多线编织/读者操控/虚假解决/倒计时/红鲱鱼
- **伏笔层级**：核心伏笔/支线伏笔/装饰伏笔，含回收方法库
- **对话规则**：McKee 三功能/Show-don-tell/角色声音区分
- **故事结构**：多流派节拍模板
- **升级体系与金手指**：修仙/系统流/重生等网文专属分类
- **网文心理学**：爽点分层（生理/心理/社交/成就）、期待-延迟-释放节奏

#### 3.2.4 伏笔追踪系统

- 伏笔状态机：PLANTED -> HINTED -> HARVESTED
- 章节距离追踪：自动计算伏笔种植到回收的章节跨度
- 收回提醒触发规则：场景数阈值、时间阈值、重要性等级
- 图谱集成：伏笔关系通过 IGraphManager 追踪

#### 3.2.5 留存节奏分析

专为中文网文优化的章节级留存分析：

- **爽文 5 季模型**：黄金三章、付费墙密度、钩子递进
- **3 章微循环 + 10 章宏循环**：确保持续阅读驱动力
- 钩子模式词库：突然、就在这时、却不知道等高频钩子词
- 满足模式词库：震惊、碾压、突破、打脸、逆袭等爽点标记
- 悬念模式词库：还没来得及、却没注意到等断章标记

#### 3.2.6 节奏导航器

前瞻性节奏分析，生成「节奏处方」：

| 处方类型 | 含义 |
|----------|------|
| climax | 需要高潮场景 |
| turning_point | 需要转折点 |
| breathing_room | 需要喘息空间 |
| foreshadow_harvest | 伏笔到了回收时机 |
| escalation | 需要升级张力 |

#### 3.2.7 30 维风格系统

6 大类 30 个维度构成风格向量：

| 类别 | 维度 (1-5) |
|------|-----------|
| 词汇 | 词汇丰富度/平均词长/生僻词比/技术密度/口语比例 |
| 句法 | 平均句长/句子复杂度/从句比/被动语态比/疑问句比 |
| 修辞 | 隐喻密度/排比频率/反问/夸张度/拟人 |
| 韵律 | 平均段落长度/标点节奏/停顿模式/句式变化/对话节奏 |
| 语调 | 正式度/情感效价/主观性/确定性/亲密度 |
| 叙事 | 视角一致性/时态分布/... |

滑动窗口漂移检测，风格学习与匹配。

#### 3.2.8 修订闭环

- **Writer-Critic 修订循环**：Writer 生成 -> Critic 评审 -> Writer 修订，最多 N 轮
- **质量门禁反馈环**：验证缺陷自动修复，detectGaps -> generateRemediation -> executeRemediation -> runFeedbackLoop，修复失败自动升级至人工审查
- **多轮修订决策**：APPROVED / REVISE / REWRITE / HUMAN_REVIEW
- **4 级质量水平**：ultra / high / medium / fluent，支持自动降级

#### 3.2.9 工作流引擎

- 5 级工作流深度：L1（单步辅助）到 L5（全自主编排）
- PhaseOrchestrator 阶段门控：soft gate / hard gate 评估
- DelegateBroker 任务委托与结果聚合
- Wave Execution Engine：并行/顺序波次执行，4 种失败策略
- WorkflowEventRelay（WebSocket）：实时状态推送
- HookRegistry：可扩展的工作流钩子系统

#### 3.2.10 学习管道

三条学习管道持续优化写作能力：

| 管道 | 流程 |
|------|------|
| CAP-001 导入学习 | DocumentParser -> EntityExtractor -> StyleExtractor -> WorldviewExtractor -> DistillationPipeline |
| CAP-002 自演进写作 | ReflectionAgent (Generator-Reflector-Curator) + RuleEvolver + PreferenceTracker + StyleDriftDetector |
| CAP-003 阅读学习 | SessionTracker -> SpoilerGate (chapter-gated) -> Light/HeavyExtractor -> InsightDistiller (6-stage) |

---

### 3.3 Application Layer — 交互层

交互层是作者直接接触的桌面应用，基于 Tauri 2 (Rust) + React 18 构建。

#### 3.3.1 编辑器

- 基于 TipTap 的富文本编辑器
- Slash Command 菜单：`/` 触发 AI 命令和格式选项
  - AI 命令：生成、续写、全篇生成
  - 格式命令：标题、列表、引用、代码块、表格、数学公式、提示块
- `[[wikilink]]` 语法：输入 `[[` 触发知识库链接
- Show/Tell 行内标注：实时标注情感描写的 show/tell 类型
- 声音一致性装饰：角色对话声音一致性可视化
- 编辑器状态持久化：自动保存滚动位置、光标位置、折叠状态

#### 3.3.2 面板体系

| 面板 | 功能 |
|------|------|
| ChatArea | 对话式 AI 写作助手，流式响应，技能包切换 |
| WritingHelperPanel | 多模式写作辅助，结果持久化 |
| EvaluationPanel | 评估结果展示，修订循环控制 |
| EvaluationDrillDownPanel | 评估细节下钻 |
| StoryBiblePanel | Story Bible 管理：Canon/Draft/Knowledge/Narrative 四区 |
| KnowledgeModal | 知识库浏览与搜索 |
| KnowledgeGraphView | 交互式知识图谱（Cytoscape） |
| ForeshadowingTrackerPanel | 伏笔追踪可视化 |
| CharacterRelationshipsPanel | 角色关系图谱 |
| NarrativeVisualizationPanel | 叙事可视化：时间线、张力曲线、角色图谱 |
| PatternDashboardPanel | 写作模式仪表板 |
| SessionAnalyticsPanel | 写作会话分析 |
| AutomationPanel | 自动化工作流配置 |
| McpStatusPanel | MCP 服务状态监控 |
| PromptTemplatePanel | 提示词模板管理 |
| WorkflowEditorPanel | 工作流编辑器 |
| SettingsModal | 设置（LLM / 质量 / 检索 / 工作流 / 主题 / 语言） |

#### 3.3.3 新手引导

三步 Welcome Wizard：
1. 选择项目模板（悬疑推理/都市言情/玄幻修仙等）
2. 配置 LLM 提供商与 API Key
3. 开始写作

#### 3.3.4 项目模板

预置小说模板，一键创建包含角色、情节骨架、章节大纲、世界观的项目：
- 悬疑推理：密室谜案 + 刑侦探长角色 + 5 章推理结构
- 都市言情：职场爱情 + 4 角色关系 + 5 章情感结构
- 更多模板持续扩展

#### 3.3.5 LLM 提供商支持

- 支持多提供商配置：OpenAI、Anthropic、本地模型等
- Provider 级别熔断器：CLOSED -> OPEN -> HALF_OPEN 状态机
- 跨 Provider 降级链：LLMFallbackChain 自动切换
- 延迟追踪：P50/P95 滑动窗口统计
- 模型列表同步与自定义模型支持

#### 3.3.6 主题与国际化

- 10 套主题：system / sorbet / slate / amber / forest / charcoal / cauldron / aurora / moonbeam / sepia
- 中英双语界面
- 3 级字体大小

#### 3.3.7 导出

- DOCX 导出（docx 库）
- Markdown 导出
- 纯文本导出

---

## 4. 用户故事

### 4.1 知识层用户故事

**US-K01** 作为连载作者，我希望系统能自动记住我 300 章前设定的人物外貌，这样我不会写出前后矛盾的角色描写。
> 六维记忆 + 记忆衰减 + 知识图谱 + 混合检索

**US-K02** 作为世界观复杂的作者，我希望在编辑器里用 `[[龙族等级]]` 直接链接到设定条目，点击就能跳转查看。
> LLM Wiki + wikilink 语法 + 图谱-Wiki 桥接

**US-K03** 作为同时使用 Obsidian 的作者，我希望 Story Bible 条目能双向同步到我的 Obsidian vault，不需要手动复制。
> Obsidian 双向同步 + 冲突策略

**US-K04** 作为长篇作者，我希望系统能在后台自动检测角色设定矛盾和时间线冲突，而不是等我写到 50 万字才发现。
> 背景智能 + 矛盾检测 + 世界观一致性验证

**US-K05** 作为注重知识积累的作者，我希望系统能从我的草稿中自动提取角色特征和情节结构，沉淀为可复用的知识条目。
> 知识蒸馏 + 6 种蒸馏模板 + DerivedFrom 追踪

### 4.2 叙事领域层用户故事

**US-E01** 作为日更作者，我希望系统自动评分每章的开头 Hook 和结尾 Cliffhanger，告诉我哪章的钩子太弱需要加强。
> Hook/Cliffhanger 评分（4 维 x 2）+ 弱章标注 + 改进建议

**US-E02** 作为追求质量的作者，我希望系统标注出我所有的「tell」式情感描写（「他很害怕」），并建议改为「show」式表达。
> Emotion Craft + Show/Tell 检测 + 5 层情感深度 + 行内标注

**US-E03** 作为伏笔密集型作者，我希望系统能追踪每个伏笔的种植章节、暗示次数和回收状态，提醒我哪些伏笔已超过 10 章未回收。
> 伏笔追踪 + 状态机 + 章节距离 + 收回提醒

**US-E04** 作为网文作者，我希望系统分析我的留存节奏，告诉我黄金三章是否达标、3 章微循环中是否有满足点。
> 留存节奏分析 + 爽文 5 季 + 微循环/宏循环检测

**US-E05** 作为作者，我希望在写完一章后一键获得质量评估，包含六个致命错误的检测结果和具体修复建议。
> 七个致命错误检查器 + 小说质量 6 维评分 + 修复建议

**US-E06** 作为风格鲜明的作者，我希望系统学习我的写作风格，在 AI 续写时保持我的词汇偏好、句式节奏和叙事语调。
> 30 维风格系统 + 风格学习 + 滑动窗口漂移检测

**US-E07** 作为追求完美的作者，我希望 Writer-Critic 修订循环能自动迭代直到质量达标，并在无法达标时升级为人工审查。
> 修订闭环 + 质量门禁反馈环 + 自动升级

**US-E08** 作为悬疑作者，我希望系统评估我每一章的悬念构建效果，检测我是否用好了三大悬念支柱。
> SuspenseEvaluator + 三支柱评估（故事问题/威胁情境/导火索）

### 4.3 交互层用户故事

**US-A01** 作为新手作者，我希望首次打开应用时被引导选择项目模板和配置 AI，3 分钟内就能开始写作。
> Welcome Wizard + 项目模板 + 提供商配置

**US-A02** 作为沉浸式写作者，我希望编辑器能全屏写作，所有分析面板按需展开，不要打断我的写作流。
> 内容优先 UI + 渐进式披露 + 可折叠面板

**US-A03** 作为键盘流作者，我希望用 `/` 触发 AI 命令、用快捷键切换面板，鼠标操作尽量少。
> Slash Command + 键盘驱动 + 快捷键面板

**US-A04** 作为多项目作者，我希望在侧边栏快速切换不同小说项目，每个项目有独立的角色库和知识库。
> 项目侧边栏 + 多项目管理 + 工作空间隔离

**US-A05** 作为跨设备作者，我希望编辑器自动保存光标位置和折叠状态，下次打开时无缝恢复。
> 编辑器状态持久化 + 自动保存

**US-A06** 作为对 AI 生成内容持审慎态度的作者，我希望 AI 的每个建议都附带评分理由和文本证据，而不是只给一个分数。
> 评估器 evidence 字段 + 评估下钻面板

---

## 5. 竞品分析

### 5.1 竞品对比矩阵

| 能力维度 | Niko Studio | Scrivener | yWriter | Obsidian+插件 | ChatGPT/Claude |
|----------|:-----------:|:---------:|:-------:|:------------:|:--------------:|
| 中文网文专用评分 | **有** | 无 | 无 | 无 | 无 |
| 伏笔追踪 | **有** | 无 | 无 | 需手动 | 无 |
| 留存节奏分析 | **有** | 无 | 无 | 无 | 无 |
| Show/Tell 检测 | **有** | 无 | 无 | 无 | 无 |
| 角色声音指纹 | **有** | 无 | 无 | 无 | 无 |
| 七个致命错误 | **有** | 无 | 无 | 无 | 无 |
| 30 维风格系统 | **有** | 无 | 无 | 无 | 无 |
| Writer-Critic 循环 | **有** | 无 | 无 | 无 | 需手动 |
| 知识图谱 | **有** | 无 | 无 | 有（插件） | 无 |
| Story Bible | **有** | 有（弱） | 有（弱） | 有（手动） | 无 |
| 本地优先 | **有** | 有 | 有 | 有 | **无** |
| AI 写作辅助 | **有** | 无 | 无 | 需插件 | 有 |
| 富文本编辑 | **有** | 有 | 有 | Markdown | 对话式 |
| 跨平台 | Win | Win/Mac | Win | Win/Mac/Linux | Web |
| 价格 | 免费 | 付费 | 免费 | 免费/付费 | 订阅制 |

### 5.2 竞品详细分析

**Scrivener**
- 优势：成熟的稿件组织、研究资料管理、编译导出
- 劣势：无 AI 能力、无叙事分析、无一致性检查、中文支持弱
- 差异化：Niko Studio 内建 AI 评分和叙事分析，Scrivener 需要作者完全靠自己判断质量

**yWriter**
- 优势：场景级组织、角色/地点追踪、免费
- 劣势：UI 过时、无 AI、无深度分析、仅 Windows
- 差异化：Niko Studio 提供自动化评分和 AI 辅助，yWriter 仍停留在静态信息管理

**Obsidian + 插件**
- 优势：双向链接、图谱可视化、插件生态丰富、本地优先
- 劣势：写作场景需要大量手动配置、无专业叙事分析、AI 集成碎片化
- 差异化：Niko Studio 开箱即用，不需要组装插件；叙事评分是 Obsidian 生态无法复刻的

**ChatGPT / Claude 直接使用**
- 优势：通用 AI 能力强、无需安装
- 劣势：无持久记忆、无结构化项目管理、无一致性追踪、上下文窗口有限、会话断裂后无法恢复、无专业叙事评分
- 差异化：Niko Studio 是「工作站」而非「对话框」，所有分析结果持久化并关联到章节/角色/情节

---

## 6. 产品差异化

### 6.1 核心差异化优势

**1. 网文原生的质量评分体系**
业界唯一内置 Hook/Cliffhanger 评分、爽点密度分析、留存节奏评估的写作工具。评分维度和模式词库专为中文网络文学设计，不是通用文本分析的套壳。

**2. 伏笔全生命周期管理**
从种植（PLANTED）到暗示（HINTED）到回收（HARVESTED）的状态机追踪，章节距离预警，图谱集成——这是其他写作工具完全没有的能力。

**3. Writer-Critic 修订闭环**
自动化 Writer-Critic 迭代循环，配合质量门禁反馈环，实现「生成 -> 评估 -> 修订 -> 再评估」的闭环，而非一次性生成。

**4. 30 维风格学习与模仿**
不是简单的「模仿某某作家」，而是 30 个量化维度的风格向量，支持风格漂移检测和一致性维护。

**5. 三层架构的可扩展性**
Nowledge Mem 知识层可独立服务于其他领域（研究、学习、项目管理），niko-studio Engine 叙事领域层可接入不同前端，Application Layer 可替换 UI 范式。

### 6.2 技术差异化

| 维度 | Niko Studio | 典型竞品 |
|------|-------------|----------|
| 架构 | Tauri (Rust) + React，原生性能 | Electron（内存占用高）或纯 Web |
| 数据存储 | SQLite + 文件系统，全部本地 | 云端或封闭格式 |
| AI 集成 | 多 Provider + 熔断 + 降级链 | 单一 Provider 或无 |
| 工作流 | 5 级深度（L1-L5） | 无或固定流程 |
| MCP 协议 | 原生支持跨工具协作 | 无 |

---

## 7. UX 原则

### 7.1 内容优先 (Content-First)

- 编辑器占据主视图最大面积
- 分析面板默认收起，按需展开
- AI 建议以行内标注形式呈现，不遮挡正文
- 侧边栏可完全隐藏，进入专注模式

### 7.2 键盘驱动 (Keyboard-Driven)

- `/` 触发 Slash Command 菜单
- `[[` 触发 Wiki 链接
- 快捷键切换所有面板
- 快捷键控制 AI 生成/续写/修订
- 快捷键导航评估结果

### 7.3 渐进式披露 (Progressive Disclosure)

- 新手：Welcome Wizard 引导 + 项目模板，3 分钟开始写作
- 进阶：Chat 对话 + Writing Helper，按需获取 AI 辅助
- 高级：Evaluation Panel + Narrative Visualization + Workflow Editor，深度分析与自动化
- 专家：MCP 集成 + 自定义工作流 + L5 全自主编排

### 7.4 反馈透明 (Transparent Feedback)

- 所有 AI 评分附带 evidence 文本证据
- 评估结果支持下钻查看每个维度的具体问题
- 修订建议附带 before/after 对比
- AI 生成内容明确标注来源

### 7.5 无损迭代 (Lossless Iteration)

- 修订循环自动创建快照
- Quick Rollback 一键回退
- 修订预览卡片对比查看
- History Panel 完整操作历史

---

## 8. 功能优先级

### P0 — 核心写作闭环（必须）

| 功能 | 层级 | 状态 |
|------|------|------|
| 富文本编辑器 (TipTap) | Application | 已实现 |
| Slash Command | Application | 已实现 |
| AI 对话式写作 (Chat) | Application | 已实现 |
| Writing Helper 多模式辅助 | Application | 已实现 |
| Story Bible 管理 | Application | 已实现 |
| 知识图谱可视化 | Application | 已实现 |
| 项目管理与模板 | Application | 已实现 |
| LLM 提供商配置 | Application | 已实现 |
| 六维记忆 | Nowledge Mem | 已实现 |
| 知识图谱 (6 实体 + 10 关系) | Nowledge Mem | 已实现 |
| 混合检索 | Nowledge Mem | 已实现 |
| Hook/Cliffhanger 评分 | Engine | 已实现 |
| 小说质量 6 维评分 | Engine | 已实现 |
| 修订循环 (Writer-Critic) | Engine | 已实现 |
| 导出 (DOCX/MD/TXT) | Application | 已实现 |
| 新手引导 | Application | 已实现 |

### P1 — 深度叙事分析（应该）

| 功能 | 层级 | 状态 |
|------|------|------|
| Show/Tell 检测 + 行内标注 | Engine | 已实现 |
| 伏笔追踪面板 | Engine + App | 已实现 |
| 留存节奏分析 | Engine | 已实现 |
| 节奏导航器 | Engine | 已实现 |
| 七个致命错误检查 | Engine | 已实现 |
| 情感弧线可视化 | Engine + App | 已实现 |
| 角色声音指纹 | Engine | 已实现 |
| 30 维风格系统 | Engine | 已实现 |
| 叙事可视化 (时间线/张力曲线) | Engine + App | 已实现 |
| 知识蒸馏 | Nowledge Mem | 已实现 |
| Obsidian 双向同步 | Nowledge Mem | 已实现 |
| 质量门禁反馈环 | Engine | 已实现 |
| 学习管道 (CAP-001/002/003) | Engine | 已实现 |
| 角色关系图谱 | Application | 已实现 |
| 会话分析 | Application | 已实现 |

### P2 — 高级自动化与生态（可以）

| 功能 | 层级 | 状态 |
|------|------|------|
| Nowledge Mem 完整协议 | Nowledge Mem | 实验性 |
| L5 全自主编排 | Engine | 部分实现 |
| EVOLVES 演化链 | Nowledge Mem | 规划中 |
| 晨间简报 | Nowledge Mem | 规划中 |
| 跨工具 MCP 协作 | Nowledge Mem | 实验性 |
| 个性化写作工艺档案 | Engine | 部分实现 |
| 读者满意度分析器 | Engine | 已实现 |
| 不可靠叙述者检测 | Engine | 已实现 |
| 代码签名 (Windows Authenticode) | Application | 部分实现 |
| macOS / Linux 支持 | Application | 规划中 |
| 协作写作 | Application | 规划中 |
| 版本发布自动化 | Application | 部分实现 |

---

## 9. 成功指标

### 9.1 用户价值指标

| 指标 | 目标 | 度量方式 |
|------|------|----------|
| 章节周期缩短 | >= 30% | 同质量下，从灵感到成稿的时间对比 |
| 首次启动到写作 | <= 3 分钟 | Welcome Wizard 完成到编辑器输入第一个字 |
| 伏笔回收率 | >= 90% | 已回收伏笔 / 已种植伏笔 |
| 一致性缺陷检出 | >= 80% | 系统检出的一致性问题 / 人工确认的一致性问题 |
| 修订后质量提升 | >= 15% | 修订后质量评分 - 修订前质量评分 |

### 9.2 产品健康指标

| 指标 | 目标 | 度量方式 |
|------|------|----------|
| 章节发布质量门禁通过率 | >= 99% | 零 Critical 问题 + 评分达标 |
| 周留存率 | >= 40%（种子期） | 周活跃用户 / 上周新增用户 |
| AI 辅助采纳率 | >= 60% | 被接受的 AI 建议 / 总 AI 建议 |
| 模板使用率 | >= 50% | 使用模板创建的项目 / 总项目数 |

### 9.3 技术质量指标

| 指标 | 目标 | 度量方式 |
|------|------|----------|
| 测试通过率 | 100% | CI 绿色 |
| 类型安全 | tsc --noEmit 零错误 | TypeScript 严格模式 |
| 启动时间 | <= 5 秒 | 冷启动到编辑器可交互 |
| AI 响应延迟 | P95 <= 3 秒 | 首 token 延迟 |
| 内存占用 | <= 500 MB | 常规写作会话峰值 |

### 9.4 证据映射

| 指标 | 证据路径 |
|------|----------|
| 章节周期缩短 | `.workflow/evidence/weekly/` 周报，含基线对比 |
| 修订闭环无数据丢失 | `.workflow/evidence/quality/` 修订案例 |
| 本地优先执行 | `.workflow/evidence/e2e/` 本地运行记录 |
| 章节发布门禁 | `.workflow/evidence/quality/` 章节门禁记录 |

---

## 10. 非目标

- **不是** 通用社交写作平台——不做读者社区、评论互动、打赏系统
- **不是** 排版出版工具——不做版面设计、印刷输出、PDF 排版
- **不是** 一键自动写作系统——所有 AI 生成内容需经作者确认
- **不是** 无审查的自动发布管线——质量门禁和作者审查是必须环节
- **不是** 通用 AI 聊天工具——专注写作场景，不做通用问答

---

## 11. 里程碑路线图

| 阶段 | 版本 | 核心交付 | 时间 |
|------|------|----------|------|
| **种子期** | v10-11 | 核心写作闭环 + 叙事评分 + 知识图谱 | 当前 |
| **成长期** | v12-13 | 伏笔追踪增强 + 学习管道深化 + 多模型优化 | Q3 2026 |
| **扩展期** | v14-15 | Nowledge Mem 完整协议 + MCP 生态 + macOS 支持 | Q4 2026 |
| **成熟期** | v16+ | 协作写作 + 发布集成 + 个性化工艺档案 | 2027 |

---

*本文档与 `docs/CAPABILITY_MATRIX.md`、`README.md` 保持对齐，以代码和测试为最终权威。*
