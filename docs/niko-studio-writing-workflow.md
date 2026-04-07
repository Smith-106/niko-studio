# Niko-Studio Writing Workflow Explorer（工作台导览）

把当前 Niko-Studio 的写作链路拆成一张可导航的“工作台地图”。你可以把它理解为：**左侧进入文档，中间写正文，上方表达意图，右侧执行 AI，下方维护长期设定，底部导出结果。**

---

## 这份文档适合怎么读

### 如果你是产品 / 设计

先看这几节：

- [01. 一眼看懂整条链路](#01-一眼看懂整条链路)
- [02. 入口区：从哪里开始](#02-入口区从哪里开始)
- [03. 主编辑区：正文在哪里写](#03-主编辑区正文在哪里写)
- [05. 右侧面板区：真正执行 AI 的地方](#05-右侧面板区真正执行-ai-的地方)
- [10. 两条最典型用户路径](#10-两条最典型用户路径)

### 如果你是前端 / 联调

建议重点看：

- [04. 顶部 AI 工具栏：先决定要做什么](#04-顶部-ai-工具栏先决定要做什么)
- [05. 右侧面板区：真正执行 AI 的地方](#05-右侧面板区真正执行-ai-的地方)
- [07. 设置层：AI 能不能工作取决于这里](#07-设置层ai-能不能工作取决于这里)
- [08. 持久化层：哪些状态会被记住](#08-持久化层哪些状态会被记住)
- [12. 关键边界：哪些能力在哪一层](#12-关键边界哪些能力在哪一层)
- [15. 技术实现视角：这条写作链路在代码里怎么串起来](#15-技术实现视角这条写作链路在代码里怎么串起来)
- [16. 状态流转：一次 AI 写作动作到底经过哪些状态](#16-状态流转一次-ai-写作动作到底经过哪些状态)
- [17. 持久化实现：为什么这个工作台关掉再开还能接上](#17-持久化实现为什么这个工作台关掉再开还能接上)
- [18. 设置与 Provider 解析：AI 为什么能跑，或者为什么跑不起来](#18-设置与-provider-解析ai-为什么能跑或者为什么跑不起来)
- [19. 技术上最值得记住的 5 个事实](#19-技术上最值得记住的-5-个事实)
- [20. 程序结构：整个工作台在 React 里是怎么装起来的](#20-程序结构整个工作台在-react-里是怎么装起来的)
- [21. ViewModel 装配：状态、能力、显示数据是怎么汇总的](#21-viewmodel-装配状态能力显示数据是怎么汇总的)
- [22. 面板编排：设置、模板、右侧工具为什么不会打架](#22-面板编排设置模板右侧工具为什么不会打架)
- [23. 编辑器桥接：右侧面板为什么能直接读选区、写回正文](#23-编辑器桥接右侧面板为什么能直接读选区写回正文)
- [24. 运行原理：API Base、Tauri 与浏览器请求到底怎么决策](#24-运行原理api-basetauri-与浏览器请求到底怎么决策)
- [25. 启动链路：App 打开时，主题和后端是怎么一起启动的](#25-启动链路app-打开时主题和后端是怎么一起启动的)
- [26. 主工作区分层：中间这块不是只有编辑器，而是四层叠起来的](#26-主工作区分层中间这块不是只有编辑器而是四层叠起来的)
- [27. 右侧工具区本质上是一个面板路由出口，不是把所有工具塞进同一个组件](#27-右侧工具区本质上是一个面板路由出口不是把所有工具塞进同一个组件)
- [28. Header 运行位：它为什么更像操作条，而不是普通标题栏](#28-header-运行位它为什么更像操作条而不是普通标题栏)
- [29. Chat 侧栏：它为什么是并列工作区，而不是编辑器附属弹窗](#29-chat-侧栏它为什么是并列工作区而不是编辑器附属弹窗)
- [30. 持久化恢复的兜底逻辑：为什么脏数据不会把工作台带偏](#30-持久化恢复的兜底逻辑为什么脏数据不会把工作台带偏)
- [31. 壳层总装配：为什么真正的工作台入口不是某个组件，而是最终 props 装配层](#31-壳层总装配为什么真正的工作台入口不是某个组件而是最终-props-装配层)
- [32. Checkpoint 控制器：打开、拉取、恢复、收口是怎么闭环的](#32-checkpoint-控制器打开拉取恢复收口是怎么闭环的)
- [33. MainContent 主画布：为什么它是工作流承载层，而不是单纯内容容器](#33-maincontent-主画布为什么它是工作流承载层而不是单纯内容容器)
- [34. 顶层挂载顺序：为什么 App.tsx 能看出整个工作台的真实分区](#34-顶层挂载顺序为什么-apptsx-能看出整个工作台的真实分区)
- [35. 把 20～34 串起来：当前写作工作台的真实运行骨架](#35-把-2034-串起来当前写作工作台的真实运行骨架)

### 如果你只想快速理解产品结构

直接记住这一句：

> **Sidebar 负责进入文档，DocumentEditor 负责正文画布，AiToolbar 负责意图选择，右侧面板负责 AI 执行，Story Bible 负责长期上下文，状态栏负责导出交付。**

---

## 快速导航

- [01. 一眼看懂整条链路](#01-一眼看懂整条链路)
- [02. 入口区：从哪里开始](#02-入口区从哪里开始)
- [03. 主编辑区：正文在哪里写](#03-主编辑区正文在哪里写)
- [04. 顶部 AI 工具栏：先决定要做什么](#04-顶部-ai-工具栏先决定要做什么)
- [05. 右侧面板区：真正执行 AI 的地方](#05-右侧面板区真正执行-ai-的地方)
- [06. Story Bible：长期创作上下文](#06-story-bible长期创作上下文)
- [07. 设置层：AI 能不能工作取决于这里](#07-设置层ai-能不能工作取决于这里)
- [08. 持久化层：哪些状态会被记住](#08-持久化层哪些状态会被记住)
- [09. 交付层：如何结束并导出](#09-交付层如何结束并导出)
- [10. 两条最典型用户路径](#10-两条最典型用户路径)
- [11. 对外说明的一句话版本](#11-对外说明的一句话版本)
- [12. 关键边界：哪些能力在哪一层](#12-关键边界哪些能力在哪一层)
- [13. 区域速查：看到一个区块时该去哪里理解](#13-区域速查看到一个区块时该去哪里理解)
- [14. 依赖关系：哪些能力依赖哪些前提](#14-依赖关系哪些能力依赖哪些前提)
- [15. 技术实现视角：这条写作链路在代码里怎么串起来](#15-技术实现视角这条写作链路在代码里怎么串起来)
- [16. 状态流转：一次 AI 写作动作到底经过哪些状态](#16-状态流转一次-ai-写作动作到底经过哪些状态)
- [17. 持久化实现：为什么这个工作台关掉再开还能接上](#17-持久化实现为什么这个工作台关掉再开还能接上)
- [18. 设置与 Provider 解析：AI 为什么能跑，或者为什么跑不起来](#18-设置与-provider-解析ai-为什么能跑或者为什么跑不起来)
- [19. 技术上最值得记住的 5 个事实](#19-技术上最值得记住的-5-个事实)
- [20. 程序结构：整个工作台在 React 里是怎么装起来的](#20-程序结构整个工作台在-react-里是怎么装起来的)
- [21. ViewModel 装配：状态、能力、显示数据是怎么汇总的](#21-viewmodel-装配状态能力显示数据是怎么汇总的)
- [22. 面板编排：设置、模板、右侧工具为什么不会打架](#22-面板编排设置模板右侧工具为什么不会打架)
- [23. 编辑器桥接：右侧面板为什么能直接读选区、写回正文](#23-编辑器桥接右侧面板为什么能直接读选区写回正文)
- [24. 运行原理：API Base、Tauri 与浏览器请求到底怎么决策](#24-运行原理api-basetauri-与浏览器请求到底怎么决策)
- [25. 启动链路：App 打开时，主题和后端是怎么一起启动的](#25-启动链路app-打开时主题和后端是怎么一起启动的)
- [26. 主工作区分层：中间这块不是只有编辑器，而是四层叠起来的](#26-主工作区分层中间这块不是只有编辑器而是四层叠起来的)
- [27. 右侧工具区本质上是一个面板路由出口，不是把所有工具塞进同一个组件](#27-右侧工具区本质上是一个面板路由出口不是把所有工具塞进同一个组件)
- [28. Header 运行位：它为什么更像操作条，而不是普通标题栏](#28-header-运行位它为什么更像操作条而不是普通标题栏)
- [29. Chat 侧栏：它为什么是并列工作区，而不是编辑器附属弹窗](#29-chat-侧栏它为什么是并列工作区而不是编辑器附属弹窗)
- [30. 持久化恢复的兜底逻辑：为什么脏数据不会把工作台带偏](#30-持久化恢复的兜底逻辑为什么脏数据不会把工作台带偏)
- [31. 壳层总装配：为什么真正的工作台入口不是某个组件，而是最终 props 装配层](#31-壳层总装配为什么真正的工作台入口不是某个组件而是最终-props-装配层)
- [32. Checkpoint 控制器：打开、拉取、恢复、收口是怎么闭环的](#32-checkpoint-控制器打开拉取恢复收口是怎么闭环的)
- [33. MainContent 主画布：为什么它是工作流承载层，而不是单纯内容容器](#33-maincontent-主画布为什么它是工作流承载层而不是单纯内容容器)
- [34. 顶层挂载顺序：为什么 App.tsx 能看出整个工作台的真实分区](#34-顶层挂载顺序为什么-apptsx-能看出整个工作台的真实分区)
- [35. 把 20～34 串起来：当前写作工作台的真实运行骨架](#35-把-2034-串起来当前写作工作台的真实运行骨架)
- [36. 右侧执行出口：为什么 `AppRightPanels` 更像路由插槽，而不是普通侧边栏](#36-右侧执行出口为什么-apprightpanels-更像路由插槽而不是普通侧边栏)
- [37. Writing Helper 草稿链路：为什么它能记住现场，而且不会被脏状态带偏](#37-writing-helper-草稿链路为什么它能记住现场而且不会被脏状态带偏)
- [38. 编辑器桥接层：为什么右侧面板能直接吃到正文选区，又能把结果插回去](#38-编辑器桥接层为什么右侧面板能直接吃到正文选区又能把结果插回去)
- [39. Chat 运行时耦合：为什么聊天区不是旁路功能，而是工作台的并行协作面](#39-chat-运行时耦合为什么聊天区不是旁路功能而是工作台的并行协作面)
- [40. AI Toolbar 的真正语义：按钮不决定能力，壳层映射才决定能力](#40-ai-toolbar-的真正语义按钮不决定能力壳层映射才决定能力)
- [41. 编辑器内 AI 为什么是“流式写作能力”，而不是一次性文本替换](#41-编辑器内-ai-为什么是流式写作能力而不是一次性文本替换)
- [42. Story Bible 的真实角色：它不是附加资料栏，而是本地作者状态与图谱知识的混合支撑层](#42-story-bible-的真实角色它不是附加资料栏而是本地作者状态与图谱知识的混合支撑层)
- [43. Header 运行态与上下文条为什么不是静态 UI，而是壳层聚合出来的运行投影](#43-header-运行态与上下文条为什么不是静态-ui而是壳层聚合出来的运行投影)
- [44. Prompt Template Library 为什么不是右侧面板的一员，而是挂在 ChatArea 上的独立注入层](#44-prompt-template-library-为什么不是右侧面板的一员而是挂在-chatarea-上的独立注入层)
- [45. Settings 为什么是平行模态通道，而且能从 Writing Helper 临时跳出再回到原位](#45-settings-为什么是平行模态通道而且能从-writing-helper-临时跳出再回到原位)
- [46. 当前导出链路为什么是“编辑器 JSON 本地序列化”，而不是走后端文档导出服务](#46-当前导出链路为什么是编辑器-json-本地序列化而不是走后端文档导出服务)
- [47. AppMainContent、ChatSidebar、AppRightPanels 为什么是三条并行工作流，而不是一个区域的不同标签](#47-appmaincontentchatsidebarapprightpanels-为什么是三条并行工作流而不是一个区域的不同标签)
- [48. WritingHelperPanel、AiTextOptimizer、useEditorAI 为什么是三种不同层级的 AI 能力，而不是同一个功能拆成三个入口](#48-writinghelperpanelaitextoptimizeruseeditorai-为什么是三种不同层级的-ai-能力而不是同一个功能拆成三个入口)
- [49. StoryBiblePanel 为什么是正文写作的支撑层，而不是一个独立知识系统](#49-storybiblepanel-为什么是正文写作的支撑层而不是一个独立知识系统)
- [50. useAppViewModel 为什么是总装配层，而不是普通工具 Hook](#50-useappviewmodel-为什么是总装配层而不是普通工具-hook)
- [51. AppHeader 与 AiToolbar 为什么是意图入口层，而不是执行层](#51-appheader-与-aitoolbar-为什么是意图入口层而不是执行层)
- [52. useAppUiPersistence 为什么保存的不是“界面样式”，而是工作流现场](#52-useappuipersistence-为什么保存的不是界面样式而是工作流现场)
- [53. useAppPanelOrchestration 为什么是在编排通道切换，而不是简单控制弹窗](#53-useapppanelorchestration-为什么是在编排通道切换而不是简单控制弹窗)
- [54. checkpoint / restore 为什么是恢复通道，而不是普通下拉菜单](#54-checkpoint--restore-为什么是恢复通道而不是普通下拉菜单)
- [55. Sidebar、Header、Right Panel 之间的事件流为什么是单向分发，而不是彼此直接调用](#55-sidebarheaderright-panel-之间的事件流为什么是单向分发而不是彼此直接调用)
- [56. 程序真正的起点为什么不是某个面板，而是 `main.tsx -> App -> useAppStartup`](#56-程序真正的起点为什么不是某个面板而是-maintsx---app---useappstartup)
- [57. 主题系统为什么不是“切个 class”，而是启动期就写入整套设计 token](#57-主题系统为什么不是切个-class而是启动期就写入整套设计-token)
- [58. `useAppViewModel` 为什么是壳层总装配器，而不是普通工具 Hook](#58-useappviewmodel-为什么是壳层总装配器而不是普通工具-hook)
- [59. 运行时健康状态为什么不是一次性检测，而是持续投影出来的](#59-运行时健康状态为什么不是一次性检测而是持续投影出来的)
- [60. 桌面端为什么不是“前端直接请求本地服务”，而是 React、Tauri、Rust、Gateway 四层协作](#60-桌面端为什么不是前端直接请求本地服务而是-reacttaurirustgateway-四层协作)
- [61. 面板切换为什么不是组件互相打开彼此，而是单独抽成 orchestration 层](#61-面板切换为什么不是组件互相打开彼此而是单独抽成-orchestration-层)
- [62. Header 为什么不是自己算状态，而是先经过一个 Header ViewModel 投影层](#62-header-为什么不是自己算状态而是先经过一个-header-viewmodel-投影层)
- [63. AppHeader 为什么说是壳层控制台，而不是普通标题栏](#63-appheader-为什么说是壳层控制台而不是普通标题栏)
- [64. Checkpoint 菜单为什么不是一个普通下拉框，而是独立的行为型 Hook](#64-checkpoint-菜单为什么不是一个普通下拉框而是独立的行为型-hook)
- [65. 中间编辑区为什么不是“编辑器组件本体”，而是文档画布 + 故事圣经 + 状态栏三层组合](#65-中间编辑区为什么不是编辑器组件本体而是文档画布--故事圣经--状态栏三层组合)
- [66. ChatSidebar 为什么不是浮层聊天框，而是与正文并列的一条常驻协作通道](#66-chatsidebar-为什么不是浮层聊天框而是与正文并列的一条常驻协作通道)
- [67. AppRightPanels 为什么更像一个状态驱动的“右侧路由出口”而不是单一面板组件](#67-apprightpanels-为什么更像一个状态驱动的右侧路由出口而不是单一面板组件)
- [68. 前端 API Client 为什么不是简单 fetch 封装，而是运行环境适配层](#68-前端-api-client-为什么不是简单-fetch-封装而是运行环境适配层)
- [69. `useAppViewModel()` 为什么是壳层汇流点，而不是又一个普通 hook](#69-useappviewmodel-为什么是壳层汇流点而不是又一个普通-hook)
- [70. `useAppShellViewModel()` 为什么更像壳层路由器，而不是 props 拼装器](#70-useappshellviewmodel-为什么更像壳层路由器而不是-props-拼装器)
- [71. 为什么 Evaluation 分析的是最后一条 assistant 输出，而不是主编辑器正文](#71-为什么-evaluation-分析的是最后一条-assistant-输出而不是主编辑器正文)
- [72. Writing Helper 为什么既能续接上次草稿，又能从当前选区起步](#72-writing-helper-为什么既能续接上次草稿又能从当前选区起步)
- [73. Chat 协作线为什么不是孤立聊天框，而是壳层明确接线的一条协作通道](#73-chat-协作线为什么不是孤立聊天框而是壳层明确接线的一条协作通道)
- [74. `AppMainContent` 为什么只是主内容宿主，而不是自己管理正文工作流](#74-appmaincontent-为什么只是主内容宿主而不是自己管理正文工作流)
- [75. `DocumentEditor` 为什么已经不是单纯编辑框，而是正文主工作面](#75-documenteditor-为什么已经不是单纯编辑框而是正文主工作面)
- [76. `NikoEditor` 为什么是“编辑器内 AI 工作台”，而不是只换成了 TipTap](#76-nikoeditor-为什么是编辑器内-ai-工作台而不是只换成了-tiptap)
- [77. 为什么正文统计、导出、AI 状态都挂在 `DocumentEditor`，而不是各管一摊](#77-为什么正文统计导出ai-状态都挂在-documenteditor而不是各管一摊)
- [78. `StoryBiblePanel` 为什么不是资料展示区，而是世界观工作台](#78-storybiblepanel-为什么不是资料展示区而是世界观工作台)
- [79. 编辑器 ↔ 右侧 AI 的完整闭环：为什么它不是一次调用，而是一条往返链路](#79-编辑器--右侧-ai-的完整闭环为什么它不是一次调用而是一条往返链路)
- [80. `WritingHelperPanel` 为什么是“带草稿记忆的侧向处理台”，而不是临时弹出工具](#80-writinghelperpanel-为什么是带草稿记忆的侧向处理台而不是临时弹出工具)
- [81. `AiTextOptimizer` 为什么是结果后处理器，而不是正文生成器](#81-aitextoptimizer-为什么是结果后处理器而不是正文生成器)
- [82. `useEditorAI` 为什么说是最靠近光标的 AI 层](#82-useeditorai-为什么说是最靠近光标的-ai-层)
- [83. 把 79～82 串起来：正文、右侧工具、编辑器内 AI 到底怎么协同](#83-把-7982-串起来正文右侧工具编辑器内-ai-到底怎么协同)

---

## 01. 一眼看懂整条链路

```text
Sidebar 进入/切换文档
   ↓
DocumentEditor 承载标题 + 正文编辑器
   ↓
AiToolbar 选择意图（写作 / 改写 / 扩写 / 脑暴）
   ↓
AppRightPanels 打开对应右侧工具面板
   ↓
Writing Helper / Text Optimizer 调用 AI
   ↓
结果回填到 NikoEditor
   ↓
Story Bible 持续维护设定 / 角色 / 世界观 / 大纲
   ↓
状态栏查看统计并导出 Markdown / HTML
```

### 当前工作台的 5 个层次

| 层次 | 作用 | 代表组件 |
|---|---|---|
| 文档入口层 | 新建文档、切换文档、打开各类面板 | `Sidebar.tsx` |
| 正文创作层 | 标题输入、TipTap 富文本写作 | `DocumentEditor.tsx` + `NikoEditor.tsx` |
| AI 执行层 | 选择 AI 意图、配置参数、调用模型 | `AiToolbar.tsx` + `WritingHelperPanel.tsx` + `AiTextOptimizer.tsx` |
| 长期上下文层 | 设定、角色、地点、风格、大纲 | `StoryBiblePanel.tsx` |
| 交付层 | 字数统计、生成状态、导出 | `DocumentEditor.tsx` |

---

## 02. 入口区：从哪里开始

用户进入应用后，第一站是左侧边栏。

### 用户在这里做什么

- 新建文档
- 切换已有文档
- 切换技能包
- 打开模板库 / 知识库 / 设置 / 评估 / 节点状态

### 代码入口

- 新建文档：`desktop/src/components/Sidebar.tsx:117`
- 文档切换：`desktop/src/components/Sidebar.tsx:135`
- 主导航入口：`desktop/src/components/Sidebar.tsx:207`

### 当前行为拆解

- `createConversation` 创建新的写作会话
- `selectConversation` 切换当前文档
- 技能包在左栏展示，但它不是正文入口，更像附加上下文开关

### 这一步的定位

**Sidebar 负责“进入哪篇文档、打开哪个工具区”。**

---

## 03. 主编辑区：正文在哪里写

进入文档后，用户来到中间主画布。

### 组成结构

1. 标题输入框
2. TipTap 富文本编辑器 `NikoEditor`
3. Story Bible 面板
4. 底部状态栏

### 代码入口

- 编辑器容器：`desktop/src/components/DocumentEditor.tsx:54`
- 标题输入：`desktop/src/components/DocumentEditor.tsx:59`
- 富文本编辑器挂载：`desktop/src/components/DocumentEditor.tsx:67`
- Story Bible 挂载：`desktop/src/components/DocumentEditor.tsx:73`
- 状态栏：`desktop/src/components/DocumentEditor.tsx:77`

### 当前行为

- 标题由本地状态维护
- 正文编辑不是 textarea，而是 `NikoEditor`
- 编辑器变更会同步更新：
  - 字数
  - 字符数
  - 阅读时间
- 编辑一段时间后会显示“已自动保存”反馈

### NikoEditor 在这里的职责

`NikoEditor` 不只是富文本输入框，它还是编辑器内 AI 的宿主。

#### 代码入口

- 句柄暴露：`desktop/src/components/NikoEditor.tsx:173`
- 选区读取：`desktop/src/components/NikoEditor.tsx:178`
- JSON 导出：`desktop/src/components/NikoEditor.tsx:182`
- 全局 editor handle 注册：`desktop/src/components/NikoEditor.tsx:183`
- 编辑器 AI hook：`desktop/src/components/NikoEditor.tsx:187`

#### 对外暴露的能力

- `insertText(text)`：把结果插回编辑器
- `getSelectedText()`：读取选中文本
- `getJSON()`：导出富文本结构

### 这一步的定位

**DocumentEditor 是主画布，NikoEditor 是正文写作核心。**

---

## 04. 顶部 AI 工具栏：先决定要做什么

用户写到一半，常见的 AI 入口不是右侧，而是正文上方的工具栏。

### 可见动作

- `Write`
- `Rewrite`
- `Describe`
- `Brainstorm`
- 打开 `Writing Helper`
- 打开 `Text Optimizer`

### 代码入口

- 主按钮定义：`desktop/src/components/AiToolbar.tsx:17`
- 扩展工具定义：`desktop/src/components/AiToolbar.tsx:24`

### 关键理解

这些按钮本身**不是直接请求后端**，而是：

1. 先记录用户意图
2. 再打开对应右侧面板
3. 由右侧面板读取参数并真正执行

### 模式映射

真正的映射在 `useAppShellViewModel`。

- `onAiWrite`：`desktop/src/hooks/useAppShellViewModel.ts:113`
- `onAiRewrite`：`desktop/src/hooks/useAppShellViewModel.ts:117`
- `onAiDescribe`：`desktop/src/hooks/useAppShellViewModel.ts:121`
- `onAiBrainstorm`：`desktop/src/hooks/useAppShellViewModel.ts:125`
- 打开 Writing Helper：`desktop/src/hooks/useAppShellViewModel.ts:129`
- 打开 Text Optimizer：`desktop/src/hooks/useAppShellViewModel.ts:130`

| 用户动作 | 预设模式 | 打开的面板 |
|---|---|---|
| Write | `polish` | `writingHelper` |
| Rewrite | `rewrite` | `writingHelper` |
| Describe | `expand` | `writingHelper` |
| Brainstorm | `outline` | `writingHelper` |
| Writing Helper | 保持当前草稿模式 | `writingHelper` |
| Text Optimizer | 无模式预设 | `textOptimizer` |

### 这一步的定位

**AiToolbar 负责“我要做什么”，不负责“怎么执行”。**

---

## 05. 右侧面板区：真正执行 AI 的地方

右侧区域是统一工具容器，通过 `activeRightPanel` 决定显示什么。

### 代码入口

- 面板路由容器：`desktop/src/components/AppRightPanels.tsx:21`
- Writing Helper：`desktop/src/components/AppRightPanels.tsx:52`
- Text Optimizer：`desktop/src/components/AppRightPanels.tsx:62`

### 当前可打开面板

- `knowledge`
- `evaluation`
- `mcpStatus`
- `writingHelper`
- `textOptimizer`
- `none`

### 这说明什么

当前工作流不是“所有 AI 都塞进编辑器里”，而是：

- 中间编辑器负责正文创作
- 右侧面板负责 AI 配置与执行

也就是一个标准的：**主画布 + 工具侧栏** 模型。

### 5.1 Writing Helper：过程型写作助手

适合做：

- 润色
- 改写
- 扩写
- 摘要
- 提纲

#### 代码入口

- Provider 选择：`desktop/src/components/WritingHelperPanel.tsx:160`
- 内容预填：`desktop/src/components/WritingHelperPanel.tsx:169`
- 读取编辑器选区：`desktop/src/components/WritingHelperPanel.tsx:171`
- 提交处理：`desktop/src/components/WritingHelperPanel.tsx:218`
- 调用后端：`desktop/src/components/WritingHelperPanel.tsx:243`
- 插回编辑器：`desktop/src/components/WritingHelperPanel.tsx:688`
- 实际插入调用：`desktop/src/components/WritingHelperPanel.tsx:693`

#### 进入面板时的内容优先级

1. 如果已有持久化草稿，先用草稿
2. 否则读取当前编辑器选中文本
3. 如果都没有，则为空

#### 当前支持模式

- `polish`
- `rewrite`
- `expand`
- `summarize`
- `outline`

定义位置：`desktop/src/components/WritingHelperPanel.tsx:54`

#### 当前闭环

```text
从编辑器取文本
  ↓
用户选择模式与参数
  ↓
读取风格设置 + provider 配置
  ↓
调用 processWritingHelper(...)
  ↓
返回结果
  ↓
用户决定是否插回编辑器
```

#### 这块的定位

**Writing Helper 是写作过程中的主 AI 工作台。**

### 5.2 Text Optimizer：结果型文本优化器

如果 Writing Helper 更偏“生成/改写过程”，Text Optimizer 更偏“结果精修”。

#### 当前定位

- 对已有文本做集中优化
- 支持从编辑器选区自动预填
- 读取当前主 provider
- 支持两步优化：先诊断，再改写

#### 代码入口

- Provider 读取：`desktop/src/components/AiTextOptimizer.tsx:398`
- 从编辑器选区预填：`desktop/src/components/AiTextOptimizer.tsx:407`
- 诊断结果写入：`desktop/src/components/AiTextOptimizer.tsx:484`
- 第二步改写请求：`desktop/src/components/AiTextOptimizer.tsx:487`

#### 与 Writing Helper 的分工

| 面板 | 更适合的阶段 |
|---|---|
| Writing Helper | 起草、扩写、改写、提纲 |
| Text Optimizer | 定稿前优化、集中精修 |

### 这一步的定位

**右侧面板才是 AI 真正落地执行的位置。**

---

## 06. Story Bible：长期创作上下文

Story Bible 常驻在主编辑器下方，它不是弹窗，也不是正文替代品。

### 代码入口

- 挂载位置：`desktop/src/components/DocumentEditor.tsx:73`
- 面板结构：`desktop/src/components/StoryBiblePanel.tsx:163`
- 渲染入口：`desktop/src/components/StoryBiblePanel.tsx:307`

### 当前包含的信息

- 脑暴区 / 灵感池
- 类型标签
- 简介
- 角色列表
- 世界设定 / 地点列表
- 风格倾向
- 大纲

### 数据来源

#### 本地持久化字段

- `braindump`
- `genres`
- `synopsis`
- `outline`
- `style`

这些通过 localStorage 保存，并且当前版本只保存在本地设备：

- `braindump`
- `genres`
- `synopsis`
- `outline`
- `style`

当前工作流已经提供 **local-only** 的恢复路径：

- 导出这 5 个字段到本地 JSON
- 从本地 JSON 导回这 5 个字段
- 重置这 5 个 localStorage key

#### 图谱数据

- 角色查询：`desktop/src/components/StoryBiblePanel.tsx:132`
- 地点查询：`desktop/src/components/StoryBiblePanel.tsx:133`

这两块当前是 **graph-backed read**，不是 Story Bible 本地草稿 payload 的一部分：

- `characters`
- `locations`

所以当前 Story Bible 的恢复/迁移能力只覆盖本地草稿，不覆盖图谱读取结果。

### 当前作用

Story Bible 不是直接替用户写正文，而是长期存在的规划层，作用更像：

- 世界观草稿板
- 角色索引板
- 风格偏好区
- 大纲缓存区

### 这一步的定位

**Story Bible 是正文创作的上游参考层。**

---

## 07. 设置层：AI 能不能工作取决于这里

Writing Helper 和 Text Optimizer 本身不保存模型配置，它们都直接读设置中心。

### 关键依赖

- provider 是否启用
- 是否填写 API Key
- `baseUrl`
- 默认模型
- `primaryProvider`

### 代码入口

- Writing Helper 读取 provider：`desktop/src/components/WritingHelperPanel.tsx:160`
- Text Optimizer 读取 provider：`desktop/src/components/AiTextOptimizer.tsx:398`
- provider 结构定义：`desktop/src/stores/settingsStore.ts`

### 实际含义

如果用户没有配置可用 provider：

- 面板仍然可以打开
- 但执行 AI 时不会拿到完整 provider 参数
- 最终是否可用还要看 gateway 或默认后端配置

### 这一步的定位

**设置层是 AI 能否真正执行的基础前提。**

---

## 08. 持久化层：哪些状态会被记住

当前工作流不是一次性弹窗式体验，很多 UI 状态会被保存下来。

### 代码入口

- 状态定义：`desktop/src/hooks/useAppUiPersistence.ts:4`
- draft key：`desktop/src/hooks/useAppUiPersistence.ts:13`
- active panel key：`desktop/src/hooks/useAppUiPersistence.ts:15`
- 状态保存 effect：`desktop/src/hooks/useAppUiPersistence.ts:106`
- 清空草稿：`desktop/src/hooks/useAppUiPersistence.ts:138`

### 当前会持久化的内容

- Writing Helper 草稿
- 左侧边栏折叠状态
- 聊天侧栏折叠状态
- 当前打开的右侧面板

### 对体验的影响

这让 Niko-Studio 更像一个持续写作工作台：

- 关闭再打开面板，不容易丢状态
- 中途切换区域，通常还能接着上次位置继续

### 这一步的定位

**持久化层保证这个工作流是“持续工作台”，而不是“一次性操作框”。**

---

## 09. 交付层：如何结束并导出

写作完成后，用户会在底部状态栏收尾。

### 代码入口

- AI 生成状态：`desktop/src/components/DocumentEditor.tsx:79`
- 字数统计：`desktop/src/components/DocumentEditor.tsx:85`
- Markdown 导出：`desktop/src/components/DocumentEditor.tsx:93`
- HTML 导出：`desktop/src/components/DocumentEditor.tsx:99`
- 自动保存提示：`desktop/src/components/DocumentEditor.tsx:106`

### 当前行为

- 编辑器 AI 正在生成时，会显示状态提示
- 会持续显示：
  - 字数
  - 字符数
  - 阅读时间
- 有结构化正文内容后，可导出：
  - Markdown
  - HTML
- 还会显示自动保存反馈

### 这一步的定位

**状态栏负责最后的状态感知与交付导出。**

---

## 10. 两条最典型用户路径

### 路径 A：从正文写作到 AI 改写

1. 在 Sidebar 新建文档
2. 在 DocumentEditor 输入标题
3. 在 NikoEditor 开始写正文
4. 选中一段文字
5. 点击顶部 `Rewrite`
6. 系统把模式设为 `rewrite`，并打开 Writing Helper
7. Writing Helper 自动带入选中文本
8. 用户补充风格与参数
9. 面板读取 provider 并发起 AI 请求
10. 返回结果后，用户点击“插入到编辑器”

### 路径 B：从正文完成到定稿优化

1. 在 NikoEditor 完成一版正文
2. 打开 `Text Optimizer`
3. 面板自动读取选区或已有文本
4. 选择优化预设
5. 如启用两步模式，则先生成诊断报告
6. 再基于诊断结果进行改写
7. 用户拿到更成熟的终稿文本
8. 最后通过状态栏导出 Markdown 或 HTML

---

## 11. 对外说明的一句话版本

**当前 Niko-Studio 是一个“以富文本正文编辑器为中心、顶部 AI 工具栏负责意图选择、右侧 AI 面板负责执行、Story Bible 负责长期创作上下文、底部状态栏负责导出交付”的写作工作台。**

---

## 12. 关键边界：哪些能力在哪一层

这一节的目的，是避免把不同区域的职责混在一起理解。

| 能力 | 主要归属层 | 不负责什么 |
|---|---|---|
| 新建/切换文档 | Sidebar | 不负责正文编辑与 AI 处理 |
| 标题与正文编辑 | DocumentEditor + NikoEditor | 不负责右侧工具参数配置 |
| 选择 AI 意图 | AiToolbar | 不直接发起最终 AI 请求 |
| AI 参数配置与执行 | AppRightPanels + Writing Helper / Text Optimizer | 不负责文档入口管理 |
| 长期设定与世界观维护 | Story Bible | 不直接替代正文编辑器写正文 |
| provider / model / API key | Settings Store | 不决定用户当前要执行哪种写作动作 |
| 草稿 / 面板开关 / 折叠状态记忆 | UI Persistence | 不负责 AI 生成结果本身 |
| 字数统计 / 导出 / 自动保存反馈 | DocumentEditor 状态栏 | 不负责 AI 模式选择 |

### 最容易混淆的 4 组边界

#### 1. AiToolbar 和 Writing Helper 不是一回事

- `AiToolbar` 决定“我要做什么”
- `Writing Helper` 决定“拿什么内容、用什么参数、怎么执行”

也就是说：**顶部工具栏更像意图入口，右侧 Writing Helper 才是执行工作台。**

#### 2. NikoEditor 和 Text Optimizer 不是一回事

- `NikoEditor` 是正文编辑器本体
- `Text Optimizer` 是对已有文本做集中优化的外部工具面板

也就是说：**一个负责写，一个负责精修。**

#### 3. Story Bible 和正文不是一回事

- Story Bible 保存长期设定、角色、地点、风格、大纲
- 正文区负责当前这篇文档的实际内容

也就是说：**Story Bible 是上游参考层，不是正文替身。**

#### 4. 设置层和执行层不是一回事

- 设置层决定“有没有可用模型/provider”
- 执行层决定“现在要对哪段文本做什么处理”

也就是说：**设置层提供燃料，执行层负责启动机器。**

---

## 13. 区域速查：看到一个区块时该去哪里理解

如果你在界面里看到某个区域，不确定它属于哪条链路，可以直接按这张表定位。

| 你看到的区域 | 先看哪里 | 为什么 |
|---|---|---|
| 左侧文档列表 / 新建文档 | `Sidebar.tsx` | 这里决定进入哪篇文档 |
| 正文标题输入框 | `DocumentEditor.tsx` | 标题属于主画布的一部分 |
| 富文本正文区 | `DocumentEditor.tsx` + `NikoEditor.tsx` | 这里承载正文写作本体 |
| 正文上方 AI 按钮 | `AiToolbar.tsx` + `useAppShellViewModel.ts` | 这里负责意图选择与模式映射 |
| 右侧 Writing Helper | `AppRightPanels.tsx` + `WritingHelperPanel.tsx` | 这里是主 AI 过程面板 |
| 右侧 Text Optimizer | `AppRightPanels.tsx` + `AiTextOptimizer.tsx` | 这里是结果精修面板 |
| 下方 Story Bible | `DocumentEditor.tsx` + `StoryBiblePanel.tsx` | 这里是长期创作设定区 |
| provider/model 配置 | `settingsStore.ts` + `SettingsModal.tsx` | 这里决定 AI 是否能真正跑起来 |
| 面板记忆 / 草稿恢复 | `useAppUiPersistence.ts` | 这里决定哪些 UI 状态会被记住 |
| 底部状态栏 / 导出 | `DocumentEditor.tsx` | 这里负责收尾与交付 |

### 用一句话快速定位

- **看左边**：文档入口
- **看中间**：正文创作
- **看上面**：AI 意图
- **看右边**：AI 执行
- **看下面**：长期设定
- **看底部**：状态与导出

---

## 14. 依赖关系：哪些能力依赖哪些前提

这部分适合在你要联调、排查“为什么没生效”时看。

### 14.1 顶部 AI 按钮能工作，至少依赖这些前提

```text
用户点击 AiToolbar
  ↓
useAppShellViewModel 把动作映射为 mode / panel
  ↓
AppRightPanels 打开对应右侧面板
  ↓
面板读取草稿 / 选区 / provider
  ↓
真正发起 AI 请求
```

如果中间任一层断掉，就会出现：

- 点了按钮但面板没打开
- 面板打开了但没有预填内容
- 有内容但无法真正执行 AI

### 14.2 Writing Helper 依赖关系

```text
编辑器选区 / 持久化草稿
  +
用户选择 mode / 参数
  +
settingsStore 中可用 provider
  ↓
processWritingHelper(...)
  ↓
返回结果
  ↓
插回编辑器（可选）
```

所以如果 Writing Helper 异常，通常优先看四件事：

1. 当前有没有内容来源
2. 当前 mode 是否正确
3. 当前 provider 是否可用
4. 编辑器 handle 是否可回写

### 14.3 Text Optimizer 依赖关系

```text
编辑器选区或输入文本
  ↓
选择优化预设
  ↓
读取主 provider
  ↓
如启用两步模式：先诊断，再改写
  ↓
输出优化结果
```

所以它更依赖：

- 当前是否已有待优化文本
- provider 是否可用
- 两步流程里的第一步诊断是否成功返回

### 14.4 Story Bible 依赖关系

Story Bible 分成两类来源：

- **本地持久化**：脑暴、简介、大纲、风格、类型
- **图谱查询**：角色、地点

这意味着它的部分内容即使图谱没返回，也仍然可以正常使用。

### 14.5 导出能力依赖关系

```text
NikoEditor 持续更新 JSON 内容
  ↓
DocumentEditor 持有 editorJson
  ↓
状态栏显示导出按钮
  ↓
导出 Markdown / HTML
```

所以导出按钮是否可见，本质上依赖：**当前是否已经有结构化正文内容。**

---

## 15. 技术实现视角：这条写作链路在代码里怎么串起来

如果前面 01～14 更偏“产品工作流视角”，这一节就是“前端实现视角”。

### 15.1 最上层不是单组件，而是一个组合装配

当前工作台不是把所有逻辑塞进单一页面组件里，而是通过 view-model 先组装，再把 props 分发给各区块。

关键入口在：`desktop/src/hooks/useAppShellViewModel.ts:60`

这个 hook 会统一产出 4 组 props：

- `sidebarProps`
- `appRightPanelsProps`
- `appMainContentProps`
- `chatSidebarProps`

也就是说，当前壳层结构更像：

```text
useAppShellViewModel
  ├─ Sidebar
  ├─ AppMainContent
  ├─ AppRightPanels
  └─ ChatSidebar
```

### 15.2 AI 工具栏动作不会直接请求后端

顶部按钮触发后，先进入 `useAppShellViewModel` 做两件事：

1. 更新 `writingHelperDraft.mode`
2. 切换 `activeRightPanel`

代码位置：

- `onAiWrite`：`desktop/src/hooks/useAppShellViewModel.ts:113`
- `onAiRewrite`：`desktop/src/hooks/useAppShellViewModel.ts:117`
- `onAiDescribe`：`desktop/src/hooks/useAppShellViewModel.ts:121`
- `onAiBrainstorm`：`desktop/src/hooks/useAppShellViewModel.ts:125`

这说明当前链路是：

```text
AiToolbar 点击
  ↓
useAppShellViewModel 写入 draft mode
  ↓
切换 activeRightPanel = writingHelper
  ↓
WritingHelperPanel 挂载并读取 draft / 选区 / provider
  ↓
真正执行 AI
```

### 15.3 右侧面板是“路由容器”，不是单一工具

`AppRightPanels` 本质上就是一个条件渲染路由层：`desktop/src/components/AppRightPanels.tsx:21`

它根据 `activeRightPanel` 决定渲染：

- `knowledge`
- `evaluation`
- `mcpStatus`
- `writingHelper`
- `textOptimizer`

对应实现位置：

- Writing Helper：`desktop/src/components/AppRightPanels.tsx:52`
- Text Optimizer：`desktop/src/components/AppRightPanels.tsx:62`

所以从技术上看，右侧区域不是“一个固定侧栏换内容”，而是**由统一状态驱动的面板路由出口**。

---

## 16. 状态流转：一次 AI 写作动作到底经过哪些状态

这一节适合前端、联调、排障时看。

### 16.1 从顶部按钮到 Writing Helper 的状态路径

以 `Rewrite` 为例：

```text
用户点击 Rewrite
  ↓
useAppShellViewModel 把 draft.mode 改成 rewrite
  ↓
activeRightPanel 切到 writingHelper
  ↓
AppRightPanels 渲染 WritingHelperPanel
  ↓
WritingHelperPanel 读取 draftState / 编辑器选区 / settingsStore
  ↓
发起 processWritingHelper(...)
  ↓
结果显示在面板内
  ↓
用户决定是否插回编辑器
```

这条路径里，真正跨组件传递的关键状态只有两类：

- **面板状态**：当前右侧打开什么
- **写作草稿状态**：当前内容、模式、限制参数

### 16.2 当前右侧面板是一个受控状态

`activeRightPanel` 定义在：`desktop/src/hooks/useAppUiPersistence.ts:4`

可选值是：

```ts
'none' | 'knowledge' | 'evaluation' | 'mcpStatus' | 'writingHelper' | 'textOptimizer'
```

这意味着右侧面板不是各组件自己决定开关，而是由上层统一控制。

### 16.3 Writing Helper 草稿也是上层状态，不是面板私有状态

`WritingHelperDraftState` 定义在：`desktop/src/hooks/useAppUiPersistence.ts:6`

包含：

- `content`
- `mode`
- `maxSentences`
- `maxItems`

默认值在：`desktop/src/hooks/useAppUiPersistence.ts:18`

```text
content = ''
mode = polish
maxSentences = 3
maxItems = 6
```

这说明 Writing Helper 并不是每次打开都从零开始，它默认就是一个**可恢复的工作中草稿**。

---

## 17. 持久化实现：为什么这个工作台关掉再开还能接上

前面讲的是“会被记住”，这里补充“怎么被记住”。

### 17.1 持久化不是 Zustand persist，而是局部 localStorage effect

当前这层 UI 持久化主要在 `useAppUiPersistence` 里完成：`desktop/src/hooks/useAppUiPersistence.ts:100`

它的做法不是集中序列化整个 UI store，而是对几个核心状态分别：

1. 初始化时从 localStorage 读取
2. 状态变化后用 `useEffect` 回写 localStorage

### 17.2 当前使用的 storage key

定义位置：`desktop/src/hooks/useAppUiPersistence.ts:13`

- `niko.writing-helper-draft-v1`
- `niko.sidebar-collapsed-v1`
- `niko.active-right-panel-v1`
- `niko.chat-sidebar-collapsed-v1`

这几项分别对应：

- Writing Helper 草稿
- 左栏折叠状态
- 当前右侧面板
- 聊天侧栏折叠状态

### 17.3 为什么恢复时比较稳

恢复逻辑不是直接信任 storage 原值，而是做了最小校验：

- `toPositiveInteger(...)` 约束数字字段：`desktop/src/hooks/useAppUiPersistence.ts:25`
- `toWritingHelperMode(...)` 约束 mode：`desktop/src/hooks/useAppUiPersistence.ts:32`
- `isRightPanelType(...)` 约束面板值：`desktop/src/hooks/useAppUiPersistence.ts:86`

也就是说，这层持久化不是“读出来就用”，而是做了一个轻量的反序列化兜底。

### 17.4 为什么清空草稿后不会立刻被旧值污染回来

清空逻辑在：`desktop/src/hooks/useAppUiPersistence.ts:138`

它会先：

1. `removeItem(WRITING_HELPER_DRAFT_STORAGE_KEY)`
2. 再把 React state 重置为 `DEFAULT_WRITING_HELPER_DRAFT`

所以这里不是单纯清空 UI，而是同时清空持久化来源和内存状态。

---

## 18. 设置与 Provider 解析：AI 为什么能跑，或者为什么跑不起来

前面说过设置层是前提，这里补充它在代码里的具体形态。

### 18.1 Provider 结构是统一配置对象

`LLMProvider` 定义在：`desktop/src/stores/settingsStore.ts:6`

它至少包含：

- `id`
- `name`
- `enabled`
- `apiKey`
- `baseUrl`
- `models`
- `defaultModel`

这说明前端不是只保存“选了哪个模型”，而是完整保存了一套 provider 连接描述。

### 18.2 设置层真正决定的是“主 provider 指向谁”

在 `Settings` 结构里，关键字段是：

- `llmProviders`：`desktop/src/stores/settingsStore.ts:128`
- `primaryProvider`：`desktop/src/stores/settingsStore.ts:129`
- `allowLlmFallback`：`desktop/src/stores/settingsStore.ts:131`
- `defaultModel`：`desktop/src/stores/settingsStore.ts:134`
- `detectionEvasionGuardEnabled`：`desktop/src/stores/settingsStore.ts:142`

这说明执行层拿到的不是单一字符串，而是“当前主 provider + provider 列表 + 写作质量/安全相关设置”的组合结果。

### 18.3 默认 provider 列表说明了当前支持范围

默认 provider 预置在：`desktop/src/stores/settingsStore.ts:162`

当前可见的默认项包括：

- `anthropic`
- `openai`
- `google`
- `openrouter`
- `local`

这反过来也说明：当前 UI 的 provider 选择并不是临时写死，而是按“多提供商配置中心”建模的。

### 18.4 从运行角度看，面板真正依赖的不是 settings modal，而是 settings store

也就是说：

- `SettingsModal` 负责修改配置
- `settingsStore` 负责保存当前配置快照
- `WritingHelperPanel` / `AiTextOptimizer` 负责消费这份配置

所以用户看到“设置弹窗”和“AI 面板”是两个区域，但代码上它们都依赖同一个设置源。

---

## 19. 技术上最值得记住的 5 个事实

1. **AI 工具栏只改状态，不直接执行请求。** 关键在 `useAppShellViewModel.ts:113`。
2. **右侧区域是面板路由出口，不是单一组件。** 关键在 `AppRightPanels.tsx:21`。
3. **Writing Helper 草稿是可恢复状态，不是一次性表单。** 关键在 `useAppUiPersistence.ts:6` 和 `useAppUiPersistence.ts:106`。
4. **设置弹窗不是执行层，settingsStore 才是执行依赖源。** 关键在 `settingsStore.ts:122`。
5. **整个工作台是“中间正文画布 + 上层状态编排 + 右侧工具路由”的组合架构。** 关键在 `useAppShellViewModel.ts:60`。

---

## 20. 程序结构：整个工作台在 React 里是怎么装起来的

如果把前面 01～19 看作“用户路径 + 局部技术点”，这一节就是更上层的“程序装配图”。

### 20.1 最外层不是单页面，而是 Shell 组合

入口在：`desktop/src/App.tsx:12`

这里没有把所有逻辑直接写进一个大组件，而是先取 `useAppViewModel()` 的结果，再把不同区域分发出去：

```text
App
 ├─ Sidebar
 ├─ AppMainContent
 ├─ ChatSidebar
 └─ AppRightPanels
```

对应代码位置：

- Shell 入口：`desktop/src/App.tsx:12`
- Sidebar 挂载：`desktop/src/App.tsx:20`
- 主内容区挂载：`desktop/src/App.tsx:22`
- ChatSidebar 挂载：`desktop/src/App.tsx:24`
- 右侧面板挂载：`desktop/src/App.tsx:26`
- Toast 容器：`desktop/src/App.tsx:28`
- 全局启动逻辑：`desktop/src/App.tsx:15`

### 20.2 这意味着什么

这说明当前 Niko-Studio 的写作工作台不是“编辑器页面里顺手塞了几个侧栏”，而是一个典型的**壳层布局（shell layout）**：

- 左边：文档入口与工具入口
- 中间：真正的写作主画布
- 右边：AI / 知识 / 评估工具出口
- 旁侧：聊天上下文区
- 最外层：错误边界、启动逻辑、Toast 提示

### 20.3 中间主内容区内部也分层

中间不是单纯一个 `DocumentEditor`，而是：`desktop/src/components/AppMainContent.tsx:17`

```text
AppMainContent
 ├─ AppHeader
 ├─ AppRestoreStatusBanner
 ├─ DocumentEditor
 └─ AppContextFooter
```

代码入口：

- 主内容壳：`desktop/src/components/AppMainContent.tsx:17`
- Header：`desktop/src/components/AppMainContent.tsx:20`
- Restore 状态条：`desktop/src/components/AppMainContent.tsx:22`
- 文档编辑器：`desktop/src/components/AppMainContent.tsx:24`
- Context Footer：`desktop/src/components/AppMainContent.tsx:26`

### 20.4 从结构上怎么理解这条写作链路

所以更准确的程序结构不是：

```text
Sidebar → DocumentEditor → WritingHelper
```

而是：

```text
App Shell
  ↓
ViewModel 汇总状态与能力
  ↓
中间主画布 / 左侧入口 / 右侧工具区分别挂载
  ↓
DocumentEditor 负责正文
  ↓
AiToolbar 只负责意图
  ↓
AppRightPanels 负责执行出口
```

### 这一步的定位

**从程序结构看，写作工作台是一个多区域协作 Shell，而不是一个单体页面。**

---

## 21. ViewModel 装配：状态、能力、显示数据是怎么汇总的

前面提过 `useAppShellViewModel`，但它不是凭空出现的。真正的汇总入口是：`desktop/src/hooks/useAppViewModel.ts:13`

### 21.1 先分阶段取上下文，再统一装配

这个 hook 的结构大致是：

```text
useAppViewModel
  ├─ useAppUiPersistence
  ├─ useLatestAssistantMessageContent
  ├─ useAppContextUsage
  ├─ useAppRuntimeHealth
  ├─ useAppPanelOrchestration
  ├─ useAppCheckpointMenu
  ├─ useAppHeaderViewModel
  └─ useAppShellViewModel
```

代码入口：

- 总装配入口：`desktop/src/hooks/useAppViewModel.ts:13`
- UI 持久化：`desktop/src/hooks/useAppViewModel.ts:15`
- 最新助手内容：`desktop/src/hooks/useAppViewModel.ts:16`
- 上下文占用估算：`desktop/src/hooks/useAppViewModel.ts:17`
- 运行时健康状态：`desktop/src/hooks/useAppViewModel.ts:18`
- 面板编排：`desktop/src/hooks/useAppViewModel.ts:21`
- Checkpoint 菜单：`desktop/src/hooks/useAppViewModel.ts:25`
- Header ViewModel：`desktop/src/hooks/useAppViewModel.ts:30`
- 最终壳层输出：`desktop/src/hooks/useAppViewModel.ts:37`

### 21.2 为什么它要分两层 ViewModel

这里不是一个 hook 直接产出所有 props，而是先：

1. 采集各种原始状态
2. 做运行态推导
3. 做 Header 专属显示数据推导
4. 最后统一交给 `useAppShellViewModel`

这说明它采用的是一种**分阶段装配**：

- `useAppUiPersistence`：提供“哪些 UI 状态被记住”
- `useAppRuntimeHealth`：提供“当前网关 / MCP 运行得怎么样”
- `useAppPanelOrchestration`：提供“右边到底开什么、设置怎么开”
- `useAppHeaderViewModel`：提供“Header 应显示什么状态”
- `useAppShellViewModel`：把这些能力重新编组成各组件 props

### 21.3 为什么这对理解程序很重要

这意味着 Niko-Studio 的主工作台不是“组件自己去 store 东拿一点、西拿一点”，而是：

- 先在 hook 层集中收敛状态
- 再在壳层一次性把 props 分发给组件

好处是：

- 组件职责更偏展示 / 局部交互
- 跨区域联动集中在 view-model 层
- 比较容易看清“哪个行为是谁编排出来的”

### 21.4 跟写作工作流的关系

对这条写作链路来说，最关键的一点是：

- 左栏点按钮
- 顶部点 AI 动作
- 右侧打开不同面板
- Header 显示状态
- Footer 显示上下文估算

这些并不是彼此直接调用，而是通过上层 view-model 统一编排。

### 这一步的定位

**程序工作原理上，`useAppViewModel` 是整个写作工作台的装配总站。**

---

## 22. 面板编排：设置、模板、右侧工具为什么不会打架

用户从界面上看，Settings、模板库、Knowledge、Writing Helper 都像“某种面板”。但代码里它们不是同一个状态。

关键入口：`desktop/src/hooks/useAppPanelOrchestration.ts:8`

### 22.1 它实际管理了三类开关

这个 hook 里至少有三组独立状态：

- `settingsOpen`
- `isTemplatePanelOpen`
- `activeRightPanel`

其中：

- `settingsOpen`：设置弹窗是否打开
- `isTemplatePanelOpen`：模板库是否打开
- `activeRightPanel`：右侧工具区当前显示哪个面板

### 22.2 为什么 Settings 不属于右侧面板路由

从 `AppRightPanels.tsx` 看很清楚：`desktop/src/components/AppRightPanels.tsx:33`

`SettingsModal` 是**始终挂载、由 `settingsOpen` 控制显示**；而 `KnowledgeModal` / `EvaluationPanel` / `WritingHelperPanel` / `AiTextOptimizer` 是**依赖 `activeRightPanel` 条件渲染**。

也就是说：

- Settings 是独立弹窗状态
- 右侧 AI / 知识 / 评估 是面板路由状态

这也是为什么“设置”和“右侧工具区”虽然都能弹出来，但它们在结构上不是同一个系统。

### 22.3 打开某个右侧面板时，模板库会被主动收起

`toggleRightPanel(...)` 在：`desktop/src/hooks/useAppPanelOrchestration.ts:18`

它先：

1. `setIsTemplatePanelOpen(false)`
2. 再切换 `activeRightPanel`

这意味着代码明确规定了：**模板库和右侧工具区不要同时占用这个交互焦点。**

### 22.4 Writing Helper → Settings → 返回 Writing Helper 的恢复逻辑

这是当前结构里一个很关键但很容易忽略的技术点。

代码位置：

- 打开设置并记住要恢复：`desktop/src/hooks/useAppPanelOrchestration.ts:36`
- 关闭设置后恢复 Writing Helper：`desktop/src/hooks/useAppPanelOrchestration.ts:28`

实际流程是：

```text
用户在 Writing Helper 里发现 provider 未配置
  ↓
openSettingsFromWritingHelper()
  ↓
resumeWritingHelperAfterSettings = true
activeRightPanel = none
settingsOpen = true
  ↓
用户关闭 Settings
  ↓
如果 resumeWritingHelperAfterSettings = true
  ↓
activeRightPanel 恢复为 writingHelper
```

这说明设置弹窗并不是简单“盖上去”，而是带着一条显式的恢复链。

### 22.5 为什么这对用户体验重要

这让用户的感受更接近：

- 在 Writing Helper 里发现没配模型
- 去 Settings 配一下
- 关掉设置后回到原来的 AI 工作台

而不是：

- 打开设置后丢失当前 AI 操作上下文

### 这一步的定位

**`useAppPanelOrchestration` 负责管理“谁开、谁关、谁让位、谁恢复”的面板秩序。**

---

## 23. 编辑器桥接：右侧面板为什么能直接读选区、写回正文

这是这条写作链路里很关键的一层“工作原理”。

如果只看界面，你会以为：

- `WritingHelperPanel` 在右边
- `NikoEditor` 在中间
- 它们似乎没有父子直连

但它们仍然能做到：

- 读取当前选中文本
- 把 AI 结果插回编辑器
- 读取当前 JSON 内容

核心原因在：`desktop/src/utils/editorHandle.ts:1`

### 23.1 它用了一个共享 editor handle

这里定义了统一接口：

- `insertText(text)`
- `getSelectedText()`
- `getJSON()`
- `isGenerating`

并且通过模块级变量保存当前句柄：

```text
NikoEditor 设置 currentHandle
其他面板读取 currentHandle
```

也就是一个比较直接的**模块级桥接模式**。

### 23.2 句柄是谁设置进去的

设置方在 `NikoEditor.tsx`：

- 暴露插入方法：`desktop/src/components/NikoEditor.tsx:173`
- 暴露选区读取：`desktop/src/components/NikoEditor.tsx:178`
- 暴露 JSON：`desktop/src/components/NikoEditor.tsx:182`
- 注册全局句柄：`desktop/src/components/NikoEditor.tsx:183`

当编辑器可用时，`NikoEditor` 会把这些方法组装进 `handleRef.current`，再 `setEditorHandle(handleRef.current)`。

### 23.3 使用方怎么拿这个桥

#### Writing Helper

- 初始内容优先读取选区：`desktop/src/components/WritingHelperPanel.tsx:171`
- 结果插回编辑器：`desktop/src/components/WritingHelperPanel.tsx:688`

#### Text Optimizer

- 初始文本读取选区：`desktop/src/components/AiTextOptimizer.tsx:407`

#### DocumentEditor

- 轮询 `isGenerating`：`desktop/src/components/DocumentEditor.tsx:41`

这意味着同一个桥被三类地方使用：

- AI 执行面板
- AI 优化面板
- 底部状态栏

### 23.4 为什么不用 prop drilling

因为这几个区域不在一条简单的父子链上：

- 中间主画布里有编辑器
- 右侧区域里有 AI 面板
- 底部状态栏在编辑器外层

如果全靠 props 一层层传，会比较别扭。当前做法的意图就是：

- 让编辑器暴露最小公共能力
- 其他模块按需读取
- 避免整条壳层都被 editor 实例绑死

### 23.5 这个桥的边界也很明确

它没有把整个 editor 实例都泄露出去，只暴露了当前工作流真正需要的最小集合：

- 插入文本
- 读选区
- 读 JSON
- 看是否正在生成

这使得面板和编辑器虽然互通，但仍然保留了一点边界。

### 这一步的定位

**`editorHandle` 是“中间正文画布”和“右侧 AI 工具区”之间的技术桥。**

---

## 24. 运行原理：API Base、Tauri 与浏览器请求到底怎么决策

前面讲的是 UI 结构，这一节讲真正发请求时的运行机制。

核心入口：`desktop/src/api/client.ts:1`

### 24.1 API Base 不是写死的，而是三层优先级解析

`resolveApiBase()` 在：`desktop/src/api/client.ts:11`

解析顺序是：

```text
env(NIKO_GATEWAY_URL / VITE_NIKO_GATEWAY_URL)
  ↓
settingsStore.settings.apiBaseUrl
  ↓
default = http://127.0.0.1:8000
```

这意味着：

1. 如果环境变量明确给了网关地址，优先用环境变量
2. 否则看用户设置里有没有填 `apiBaseUrl`
3. 再不行才回退到默认本地网关

### 24.2 为什么这很重要

这保证了同一套前端在不同环境下可以切到不同后端：

- 本地开发
- Tauri 桌面运行时
- 用户自定义 gateway
- 未来可能的远程部署

而不是把后端地址写死在组件里。

### 24.3 浏览器和 Tauri 不是同一种请求路径

`callApi(...)` 在：`desktop/src/api/client.ts:66`

它会先判断：

- 是否处于 Tauri 环境

如果是：

- 走 `invoke('call_api', ...)`

如果不是：

- 走浏览器 `fetch(...)`

也就是说运行层实际上分成两条路径：

```text
Browser / Vite Dev
  → fetch(base + endpoint)

Tauri Desktop
  → Rust command invoke('call_api')
  → Rust 侧再去请求真正 gateway
```

### 24.4 Tauri 下为什么还要单独取 runtime gateway base

`getRuntimeGatewayBase()` 在：`desktop/src/api/client.ts:32`

它会通过：

- `invoke('get_gateway_base')`

向 Rust 侧询问当前实际 gateway 地址，并做 5 秒缓存。

这说明在 Tauri 桌面环境里，真正网关地址可能由运行时动态决定，不一定直接等于前端配置值。

### 24.5 这跟桌面端启动方式是连着的

在 `desktop/src-tauri/src/main.rs` 里，Tauri 会启动并配置本地 gateway 运行时：`desktop/src-tauri/src/main.rs:548`

它会注入：

- `NIKO_GATEWAY_HOST`
- `NIKO_GATEWAY_PORT`
- `NIKO_GATEWAY_RUNTIME`
- `NIKO_CORS_DEV_ORIGINS`
- `NIKO_SKILLS_DIR`

这意味着桌面版不是“纯前端连远端接口”，而是**前端 + Rust 宿主 + 本地/运行时 gateway** 的三层协作。

### 24.6 对 Writing Helper / Text Optimizer 来说，这意味着什么

对上层 AI 面板来说，它们并不关心：

- 现在是浏览器还是 Tauri
- 网关地址来自 env 还是 settings
- 请求是 fetch 还是 invoke

它们只管调用：

- `processWritingHelper(...)`
- 其他 API client 方法

底层 transport 由 `api/client.ts` 统一吸收掉。

这就是当前代码里一个很典型的分层：

- 面板层：只关心写作业务参数
- client 层：关心 transport 与 base 解析
- Tauri/Rust 层：关心运行时 gateway 管理

### 24.7 从“工作原理”怎么记这件事

你可以把它理解成：

```text
WritingHelper / TextOptimizer
  ↓
api/client.ts
  ↓
[Browser] fetch
或
[Tauri] invoke Rust command
  ↓
Gateway
  ↓
LLM / graph / runtime services
```

### 这一步的定位

**从运行原理看，前端 AI 面板不是直接绑死某个 HTTP 地址，而是通过统一 client 层适配浏览器与 Tauri 两种运行环境。**

---

## 25. 启动链路：App 打开时，主题和后端是怎么一起启动的

如果想理解“程序一启动到底先发生了什么”，关键入口是：`desktop/src/App.tsx:10`

`App` 本身做的事其实很少：

1. 调 `useAppViewModel()` 取整套壳层 props：`desktop/src/App.tsx:11`
2. 调 `useToast()` 取全局提示：`desktop/src/App.tsx:12`
3. 调 `useAppStartup()` 执行启动副作用：`desktop/src/App.tsx:14`
4. 把四大区域挂出来：`desktop/src/App.tsx:18`

也就是说，真正的启动逻辑不塞在组件 JSX 里，而是被收进了 `useAppStartup()`。

### 25.1 `useAppStartup` 本身很薄，只负责串启动钩子

代码在：`desktop/src/hooks/useAppStartup.ts:3`

它只做两件事：

- `useTheme()`：初始化主题系统：`desktop/src/hooks/useAppStartup.ts:4`
- `useAppBackendBootstrap()`：初始化桌面端后端引导：`desktop/src/hooks/useAppStartup.ts:5`

这说明启动层采用的是一种很清晰的拆法：

- 视觉启动，交给 theme hook
- 运行时启动，交给 backend bootstrap hook

### 25.2 后端引导只在 Tauri 下才生效

`useAppBackendBootstrap()` 在：`desktop/src/hooks/useAppBackendBootstrap.ts:4`

它一进入 `useEffect` 就先判断：`desktop/src/hooks/useAppBackendBootstrap.ts:6`

- 如果当前不是 Tauri，直接 `return`

所以浏览器开发模式下，不会去调用 Rust 命令启动桌面宿主后端。

### 25.3 Tauri 下启动前，会先把设置里的 API Base 同步给 Rust

这一步很关键：`desktop/src/hooks/useAppBackendBootstrap.ts:12`

它先执行：

- `invoke('set_gateway_base_override', { base: ... })`

这里传的值来自：

- `settings.apiBaseUrl`：`desktop/src/hooks/useAppBackendBootstrap.ts:10`

这意味着桌面端启动时，前端不是只“自己记住一个地址”，而是会把用户设置同步给 Rust 运行时，让 Rust 知道当前应优先使用哪个 gateway base。

### 25.4 然后才真正启动桌面后端

紧接着就是：`desktop/src/hooks/useAppBackendBootstrap.ts:16`

- `invoke('start_backend')`

所以桌面端真实启动顺序更像：

```text
App 挂载
  ↓
useAppStartup()
  ↓
useAppBackendBootstrap()
  ↓
set_gateway_base_override(...)
  ↓
start_backend()
```

### 25.5 为什么这一层对理解系统很重要

这说明 Niko-Studio 桌面版不是“页面加载完成后再随便请求一下本地接口”，而是显式存在一条**启动引导链**：

- React 负责触发启动
- Tauri invoke 负责桥接桌面宿主命令
- Rust 负责决定并拉起真正的 gateway 运行时

所以前端看到的“网关在线 / 离线”，并不只是远端 HTTP 是否通，还直接连着桌面宿主的启动流程。

### 这一步的定位

**`useAppStartup` / `useAppBackendBootstrap` 负责把“界面启动”接到“桌面运行时启动”上。**

---

## 26. 主工作区分层：中间这块不是只有编辑器，而是四层叠起来的

很多人第一次看界面，会把中间区域理解成“一个文档编辑器”。

但从 `desktop/src/components/AppMainContent.tsx:13` 看，它其实至少分四层：

1. `AppHeader`：顶部状态与动作栏：`desktop/src/components/AppMainContent.tsx:21`
2. `AppRestoreStatusBanner`：恢复状态提示条：`desktop/src/components/AppMainContent.tsx:23`
3. `DocumentEditor`：正文编辑主画布：`desktop/src/components/AppMainContent.tsx:25`
4. `AppContextFooter`：底部上下文估算条：`desktop/src/components/AppMainContent.tsx:27`

### 26.1 这意味着“正文写作”被包在更大的工作区里

也就是说，真正的写作体验不是只有编辑器输入框，而是：

- 上面先告诉你系统状态、AI 动作入口、Checkpoint 入口
- 中间才是正文书写
- 下面再告诉你上下文占用估算

这也是为什么之前文档把它叫“写作工作台”，而不是单纯“编辑页”。

### 26.2 Header 不只是导航，它还是运行态显示层

因为 Header props 来自 `useAppShellViewModel()` 汇总后的 `headerProps`：`desktop/src/components/AppMainContent.tsx:7`、`desktop/src/hooks/useAppShellViewModel.ts:91`

所以它显示的不只是静态标题，还承接：

- 连接状态
- MCP / runtime 相关状态
- AI 动作入口
- Checkpoint 恢复入口

从程序结构看，Header 更接近“控制台条”而不是普通页头。

### 26.3 RestoreStatusBanner 说明系统有“会话恢复”这一层

`AppRestoreStatusBanner` 被单独插在 Header 和 Editor 之间：`desktop/src/components/AppMainContent.tsx:23`

这代表恢复状态不是编辑器内部的小提示，而是整个工作区级别的系统反馈。

换句话说，恢复某个 checkpoint 不是局部行为，而是整个写作工作台的一次状态切换。

### 26.4 Footer 不是装饰，而是给 Chat/上下文协作提供边界感

`AppContextFooter` 拿到的是 `contextEstimatedText`：`desktop/src/components/AppMainContent.tsx:9`

这意味着底部这条不是静态文案，而是来自上层上下文估算逻辑的输出。

它的作用是把“当前聊天/工具链可能消耗多少上下文”反馈回工作台底部，帮助用户理解这不是一个孤立编辑器，而是一个带 AI 上下文预算的系统。

### 这一步的定位

**`AppMainContent` 说明中间主区域本质上是“系统状态 + 恢复反馈 + 正文画布 + 上下文边界”的组合层。**

---

## 27. 右侧工具区本质上是一个面板路由出口，不是把所有工具塞进同一个组件

如果把右侧区域也只看成“一个侧边栏”，会低估它的结构。

关键文件：`desktop/src/components/AppRightPanels.tsx:20`

这个组件没有自己实现 AI 工具逻辑，而是在做一件更基础的事：**根据当前状态，把不同工具组件路由到同一块出口上。**

### 27.1 它路由的不是一种面板，而是几类不同性质的能力

当前这里挂了：

- `KnowledgeModal`：知识库查看：`desktop/src/components/AppRightPanels.tsx:33`
- `SettingsModal`：全局设置：`desktop/src/components/AppRightPanels.tsx:37`
- `EvaluationPanel`：评估：`desktop/src/components/AppRightPanels.tsx:42`
- `McpStatusPanel`：节点 / 运行状态：`desktop/src/components/AppRightPanels.tsx:49`
- `WritingHelperPanel`：过程型 AI 写作辅助：`desktop/src/components/AppRightPanels.tsx:51`
- `AiTextOptimizer`：结果型 AI 文本优化：`desktop/src/components/AppRightPanels.tsx:61`

它们在产品语义上其实不是同一类东西，但被放到了同一出口。

### 27.2 统一出口，分散实现

`AppRightPanels` 自己不处理：

- provider 配置
- 写作模式切换
- 优化预设
- 评估算法
- MCP 检查逻辑

这些都留给各自子面板。

它只负责：

- 现在该挂谁
- 关闭时回调给谁
- 哪些共享状态要传进去

这就是很典型的“出口统一，能力分治”。

### 27.3 为什么 Writing Helper 要带 draftState 进来

`WritingHelperPanel` 不只是一个“打开就空白的工具窗”，它会拿到：

- `draftState`
- `onDraftStateChange`
- `onClearDraft`

对应位置：`desktop/src/components/AppRightPanels.tsx:55` 到 `desktop/src/components/AppRightPanels.tsx:57`

这说明右侧工具区并不是一次性弹层，而是支持**带上下文地重新打开**。

也正因为这样，顶部 AI 按钮点“润色 / 改写 / 扩写 / 脑暴”时，上层可以先改 draft 的 mode，再打开同一个 Writing Helper 面板。

### 27.4 为什么 Text Optimizer 和 Writing Helper 要并列存在

从结构上它们都走右侧出口，但职责不一样：

- `WritingHelperPanel`：围绕“当前内容怎么处理”做过程性写作支持
- `AiTextOptimizer`：围绕“结果文本如何进一步人类化/优化”做结果性优化

也就是说右侧不是“一个 AI 面板”，而是至少两条 AI 工作链并列：

- 生成 / 改写 / 扩写 / 总结 / 提纲
- 二次优化 / 风格重写 / 两步诊断

### 27.5 从程序结构怎么记右侧区域

可以把它理解成：

```text
Shell State
  ↓
activeRightPanel / settingsOpen
  ↓
AppRightPanels
  ↓
把对应工具组件挂到统一出口
```

所以右侧区域真正的角色不是“工具实现层”，而是“工具路由层”。

### 这一步的定位

**`AppRightPanels` 是整个工作台里所有右侧能力的统一出口与路由壳。**

---

## 28. Header 运行位：它为什么更像操作条，而不是普通标题栏

如果只看视觉，`AppHeader` 很像普通页头；但从代码职责看，它其实更接近一个运行中的操作条。

关键文件：`desktop/src/components/AppHeader.tsx:41`

### 28.1 左边不是单纯标题，而是“标题 + AI 意图入口”

Header 左侧并不是只有 `appTitle`：`desktop/src/components/AppHeader.tsx:72`

它实际挂了两部分：

- 文档/工作区标题：`appTitle`
- `AiToolbar`：`desktop/src/components/AppHeader.tsx:74`

而 `AiToolbar` 接的不是一个按钮，而是一组明确动作：

- `onAiWrite`
- `onAiRewrite`
- `onAiDescribe`
- `onAiBrainstorm`
- `onOpenWritingHelper`
- `onOpenTextOptimizer`

这说明 Header 左侧承担的不是“展示当前页面名字”，而是把用户的 AI 意图送到上层编排层。

### 28.2 右边也不是装饰区，而是运行态控制区

Header 右侧挂了四类东西：`desktop/src/components/AppHeader.tsx:84`

1. Chat 侧栏开关：`desktop/src/components/AppHeader.tsx:85`
2. 连接状态胶囊：`desktop/src/components/AppHeader.tsx:93`
3. 上下文占用显示：`desktop/src/components/AppHeader.tsx:97`
4. Checkpoint 菜单入口：`desktop/src/components/AppHeader.tsx:108`

所以它右边管理的其实是这些运行中的信息与入口：

- 工作区是否展开聊天并行区
- 当前网关 / runtime 是否在线
- 当前上下文预算大概用了多少
- 是否要恢复历史 checkpoint

这已经明显超出普通标题栏职责了。

### 28.3 Header 展示的数据并不是自己算的

这一点很关键。

`AppHeader` 自己基本只负责展示和触发回调；真正的数据来自上层 ViewModel 装配：

- `useAppViewModel()` 先收敛 runtime、context usage、checkpoint、ui persistence：`desktop/src/hooks/useAppViewModel.ts:12`
- `useAppShellViewModel()` 再把这些东西组装进 `headerProps`：`desktop/src/hooks/useAppShellViewModel.ts:89`
- 最后 `AppMainContent` 把 `headerProps` 传给 `AppHeader`：`desktop/src/components/AppMainContent.tsx:20`

这说明 Header 不是局部小组件，而是整个工作台运行态的一个投影面。

### 28.4 为什么说它是“运行位”

因为它挂的几乎都是运行时信号：

- 连接状态是 runtime health 的投影
- 上下文占用是 chat / AI 使用量的投影
- checkpoint 是恢复链路入口
- chat toggle 是并行工作区开关
- AI toolbar 是意图发起入口

也就是说，Header 不是静态导航，而是“当前系统能做什么、现在状态如何、接下来往哪走”的集中出口。

### 28.5 从程序结构怎么记这层

可以把 Header 理解成：

```text
runtimeView / contextUsage / checkpointMenu / uiPersistence
  ↓
headerViewModel
  ↓
headerProps
  ↓
AppHeader
```

所以它更像控制台顶部操作条，而不是页面标题栏。

### 这一步的定位

**`AppHeader` 是写作工作台的运行态控制层：既显示状态，也发起 AI 与恢复动作。**

---

## 29. Chat 侧栏：它为什么是并列工作区，而不是编辑器附属弹窗

要理解聊天区在当前产品里的位置，最关键的不是看 `ChatArea`，而是先看它被挂在哪。

Shell 入口在：`desktop/src/App.tsx:24`

它和这几个区域是并列的：

- `Sidebar`
- `AppMainContent`
- `ChatSidebar`
- `AppRightPanels`

这说明 Chat 从结构上就不是编辑器内部控件，而是 Shell 级区域。

### 29.1 `ChatSidebar` 自己就是一个独立 `<aside>`

实现非常直接：`desktop/src/components/ChatSidebar.tsx:9`

- 展开时宽度是 `w-[320px]`
- 收起时宽度是 `w-0 overflow-hidden`
- 自身有独立边框、背景、阴影、层级
- 内部完整挂载 `ChatArea`

也就是说，它的语义更像“右侧并列工作区”，而不是“正文旁边临时弹出一个聊天窗”。

### 29.2 它的开关来自 Header，而不是编辑器内部

聊天侧栏的开关按钮在 Header：`desktop/src/components/AppHeader.tsx:85`

而真正的折叠状态来自 UI persistence：

- `chatSidebarCollapsed` 在 `useAppUiPersistence()` 里维护：`desktop/src/hooks/useAppUiPersistence.ts:102`
- `useAppShellViewModel()` 把它编成 `chatSidebarProps`：`desktop/src/hooks/useAppShellViewModel.ts:137`
- Header 与 ChatSidebar 共享这个状态：
  - Header 用它决定图标与开关行为
  - ChatSidebar 用它决定宽度与显隐

这说明“聊天区开/关”是工作台布局状态，不是某个局部组件的临时 UI 状态。

### 29.3 Chat 不只是聊天，它还把上下文预算回传给主工作区

`chatAreaProps` 里不只有连接相关信息：`desktop/src/hooks/useAppShellViewModel.ts:140`

它还拿到：

- `onContextUsageChange`
- `connectionState`
- 模板面板开关状态

这里最重要的是 `onContextUsageChange`。

这意味着 Chat 区不仅产生消息，还会把“当前上下文用了多少”这类运行信息往上回传；然后这部分数据又会被 Header 和 Footer 消费。

所以聊天侧栏并不是孤岛，而是整个工作台上下文预算系统的一部分。

### 29.4 为什么它不是右侧工具面板的一部分

这点很容易看错。

右侧工具区由 `AppRightPanels` 管：`desktop/src/components/AppRightPanels.tsx:20`

而 ChatSidebar 在 `App.tsx` 里单独并列挂载：`desktop/src/App.tsx:24`

这说明产品结构上把两者分得比较清楚：

- ChatSidebar：持续存在的并行对话工作区
- AppRightPanels：按需切换的工具出口

一个偏“长期并行协作”，一个偏“按任务打开的工具路由”。

### 29.5 从工作流怎么理解 Chat 的地位

当前写作链路里，聊天区扮演的是一个伴随式区域：

- 你在中间写正文
- 你在顶部发起 AI 意图
- 你在右侧打开专门工具
- 你同时还能在旁边维持持续对话上下文

所以它更像“第二工作台”，不是一个附属输入框。

### 这一步的定位

**`ChatSidebar` 是 Shell 级并列工作区，负责持续对话与上下文协作，不属于正文编辑器内部，也不属于右侧工具路由。**

---

## 30. 持久化恢复的兜底逻辑：为什么脏数据不会把工作台带偏

前面已经讲过 `useAppUiPersistence()` 会把一些 UI 状态写进 localStorage；这里进一步看它为什么相对稳。

关键文件：`desktop/src/hooks/useAppUiPersistence.ts:39`

### 30.1 草稿恢复不是“全盘相信 localStorage”

`loadWritingHelperDraft()` 的实现很保守：`desktop/src/hooks/useAppUiPersistence.ts:39`

它不是直接 `JSON.parse(raw)` 后整包用掉，而是逐字段校验：

- `content` 只有在是字符串时才接受
- `mode` 会经过 `toWritingHelperMode(...)`
- `maxSentences` / `maxItems` 会经过 `toPositiveInteger(...)`
- 任一字段不合法，就回退到 `DEFAULT_WRITING_HELPER_DRAFT`

也就是说，本地存储在这里只是候选输入，不是可信真相。

### 30.2 JSON 坏了，直接整体回退

如果 localStorage 里的草稿 JSON 根本坏掉，`try/catch` 会直接把它兜回默认值：`desktop/src/hooks/useAppUiPersistence.ts:40`

这点很重要，因为它保证了：

- 旧版本残留结构
- 用户手改 localStorage
- 序列化损坏
- 非法数据类型

都不会把 Writing Helper 启动成一个不可预测状态。

### 30.3 布局状态也不是任意字符串都认

不只是草稿。

- `loadSidebarCollapsed()` 只认 `'true'` / `'false'`：`desktop/src/hooks/useAppUiPersistence.ts:64`
- `loadChatSidebarCollapsed()` 也只认 `'true'` / `'false'`：`desktop/src/hooks/useAppUiPersistence.ts:75`
- `loadActiveRightPanel()` 只接受 `isRightPanelType(...)` 白名单：`desktop/src/hooks/useAppUiPersistence.ts:86`

也就是说，像 `activeRightPanel = 'abc'` 这种脏值不会把系统导向未知面板，而是会回退到安全默认值。

### 30.4 写失败时也不会把界面逻辑拖垮

四个持久化 `useEffect` 都包了 `try/catch`：`desktop/src/hooks/useAppUiPersistence.ts:106`

这意味着即使出现：

- localStorage 不可写
- quota 超限
- 某些运行环境限制存储

界面状态本身仍然照常在 React 内存里运作，只是“记不住”而已，不会导致主工作流崩掉。

### 30.5 清空草稿时，清的是“存储源 + 内存态”两层

`clearWritingHelperDraft()` 不是只 `removeItem`：`desktop/src/hooks/useAppUiPersistence.ts:138`

它顺序是：

1. `clearWritingHelperDraftStorage()` 删除 localStorage 项
2. `setWritingHelperDraft(DEFAULT_WRITING_HELPER_DRAFT)` 重置当前 React 状态

这能避免一种常见问题：

- 存储删掉了，但当前界面还拿着旧值继续显示

所以这里的 reset 是双层一致的。

### 30.6 从工作原理上，这是一种“弱信任持久化”

可以把这套逻辑理解成：

```text
localStorage
  ↓
读取
  ↓
逐项校验 / 白名单判断 / 数值清洗
  ↓
不合法就回默认值
  ↓
React state 成为真正运行态
```

也就是说，当前工作台并不把 localStorage 当状态源头，而是把它当“尽量恢复上次现场”的辅助输入。

### 这一步的定位

**`useAppUiPersistence` 的恢复逻辑是防御式的：持久化尽量恢复现场，但不会让脏数据接管工作台状态。**

---

## 31. 壳层总装配：为什么真正的工作台入口不是某个组件，而是最终 props 装配层

前面已经看过 `useAppViewModel()` 会分阶段收集状态；再往后一步，真正把这些状态变成“工作台四大区域可直接消费的数据”的地方，是：`desktop/src/hooks/useAppShellViewModel.ts:60`

### 31.1 它的职责不是再造状态，而是把状态翻译成四组壳层 props

这个 hook 最关键的返回值不是某个单独字段，而是四组 props：

- `sidebarProps`：`desktop/src/hooks/useAppShellViewModel.ts:69`
- `appRightPanelsProps`：`desktop/src/hooks/useAppShellViewModel.ts:79`
- `appMainContentProps`：`desktop/src/hooks/useAppShellViewModel.ts:89`
- `chatSidebarProps`：`desktop/src/hooks/useAppShellViewModel.ts:137`

也就是说，它本质上不是业务 hook，而是**壳层适配器**。

更准确的结构应该记成：

```text
useAppViewModel 收集原始状态与派生状态
  ↓
useAppShellViewModel 把状态翻译为四大区域 props
  ↓
App.tsx 把四组 props 分发给四个并列区域
```

### 31.2 左侧、主区、聊天区、右侧工具区都在这里被“定口”

看这几个装配片段就很清楚：

- 左侧 Sidebar 的折叠状态与打开哪个工具区，在这里被接到 `uiPersistence` 与 `panelOrchestration`：`desktop/src/hooks/useAppShellViewModel.ts:69`
- 主区 `AppMainContent` 需要的 Header 数据、恢复状态、上下文说明、Writing Helper 打开动作，也在这里一次打包：`desktop/src/hooks/useAppShellViewModel.ts:89`
- Chat 侧栏不仅拿到折叠状态，还拿到 `onContextUsageChange` 和连接状态：`desktop/src/hooks/useAppShellViewModel.ts:137`
- 右侧面板区则被喂入 `activeRightPanel`、`settingsOpen`、`latestAssistantContent`、`writingHelperDraft` 等执行态数据：`desktop/src/hooks/useAppShellViewModel.ts:79`

这说明四个区域虽然表面是并列组件，但它们的行为协议是在这里统一收口的。

### 31.3 AI 工具栏的“意图 → 模式”映射，其实也属于壳层装配职责

这里最值得单独记住的是 Header 里的几组 AI 回调：`desktop/src/hooks/useAppShellViewModel.ts:106`

- `onAiWrite`：写入 `mode: 'polish'`，再打开 `writingHelper`
- `onAiRewrite`：写入 `mode: 'rewrite'`，再打开 `writingHelper`
- `onAiDescribe`：写入 `mode: 'expand'`，再打开 `writingHelper`
- `onAiBrainstorm`：写入 `mode: 'outline'`，再打开 `writingHelper`

所以顶部工具栏虽然看起来像一排按钮，但真正定义“这个按钮在产品上代表什么”的，是这里的装配代码，而不是 `AiToolbar` 自己。

### 31.4 它还把跨区协作关系提前接好了

`chatAreaProps` 里除了连接状态，还有：`desktop/src/hooks/useAppShellViewModel.ts:140`

- `onContextUsageChange`
- `isTemplatePanelOpen`
- `onTemplatePanelOpenChange`

这意味着聊天区不是孤立挂载，而是从装配层开始就被接入了：

- 上下文预算回传链路
- 模板面板联动链路
- runtime 状态投影链路

也就是说，**工作台的“区块分开显示”和“运行时相互协作”是同时成立的。**

### 31.5 从程序结构怎么记这一层

可以把它理解成：

```text
原始状态 / 派生状态 / 控制器
  ↓
useAppShellViewModel
  ↓
四个区域的最终输入协议
  ↓
App.tsx 挂载 Shell
```

所以如果你想理解“这个工作台到底是怎么被拼出来的”，不能只看组件树，还要看最终 props 是在哪里定型的。

### 这一步的定位

**`useAppShellViewModel` 不是普通 hook，而是当前写作工作台的壳层总装配点。**

---

## 32. Checkpoint 控制器：打开、拉取、恢复、收口是怎么闭环的

Checkpoint 功能如果只看 Header，会以为它只是个下拉菜单；但真正的运行闭环在：`desktop/src/hooks/useAppCheckpointMenu.ts:20`

### 32.1 打开菜单时才去拉列表，不是启动时预取

最关键的入口是：`desktop/src/hooks/useAppCheckpointMenu.ts:77`

```text
点击 checkpoint 按钮
  ↓
handleToggleCheckpointMenu()
  ↓
nextOpen = !checkpointMenuOpen
  ↓
如果是打开态，就 await refreshCheckpoints()
```

这说明它的策略是**按需拉取**，而不是应用启动时就把 checkpoint 全部预先装进内存。

这样做的意义很直接：

- 避免启动时多一条无意义请求
- 每次打开时尽量看到较新的 checkpoint 列表
- 把 checkpoint 看成“恢复动作入口”，而不是常驻数据源

### 32.2 拉取失败时，不会把旧列表假装成成功态

`refreshCheckpoints()` 的处理逻辑也很稳：`desktop/src/hooks/useAppCheckpointMenu.ts:59`

- 成功且 `response.data` 是数组时才 `setCheckpoints(response.data)`
- 否则直接 `setCheckpoints([])`
- 同时写入错误态 `restoreStatus`

这点很重要，因为它避免了一种误导场景：

- 你以为现在看到的是新列表
- 但实际上只是上一次残留的旧数据

这里的策略是宁可显示空，也不把旧状态伪装成新结果。

### 32.3 菜单关闭不是只靠按钮自己切回去

当菜单打开后，会临时挂两组全局关闭逻辑：`desktop/src/hooks/useAppCheckpointMenu.ts:34`

- 点击容器外部：关闭菜单
- 按下 `Escape`：关闭菜单

这说明它不是一个“只能靠再点一次按钮才会关”的死板开关，而是遵循典型浮层交互约定。

从工作流上看，这非常合理：

- Checkpoint 是一个瞬时操作入口
- 不是一个要长期停留的面板
- 所以它需要轻量、可打断、可快速退出

### 32.4 恢复成功后，状态提示和菜单收口是同时发生的

恢复动作在：`desktop/src/hooks/useAppCheckpointMenu.ts:85`

成功时会做两件事：

1. `setRestoreStatus({ type: 'success', message: restoreSuccessText })`
2. `setCheckpointMenuOpen(false)`

失败时则只写错误状态，不主动关菜单。

这背后的产品语义也很清楚：

- 成功：动作完成，菜单使命结束，可以收口
- 失败：用户可能还要重试或看其他 checkpoint，所以保留当前入口

### 32.5 恢复状态不是常驻，而是一个短暂横幅信号

`restoreStatus` 还有一个 2500ms 的自动清除逻辑：`desktop/src/hooks/useAppCheckpointMenu.ts:27`

这说明 checkpoint 恢复反馈被设计成：

- 是一次性结果提示
- 不是新的持久界面状态
- 更像“通知条”而不是“流程页”

而这个状态最终会被送进 `AppMainContent` 的 `restoreStatus`，再交给 `AppRestoreStatusBanner`：`desktop/src/components/AppMainContent.tsx:24`

所以恢复链路实际上是：

```text
Header 点开 checkpoint 菜单
  ↓
useAppCheckpointMenu 拉列表 / 执行恢复
  ↓
restoreStatus 写入成功或失败信号
  ↓
AppMainContent 挂 AppRestoreStatusBanner
  ↓
主工作区顶部短暂显示恢复结果
```

### 32.6 从程序结构怎么记这层

不要把它记成“Header 里的一个菜单”。

更准确的是：

```text
AppHeader = 入口按钮 + 列表渲染
useAppCheckpointMenu = 数据拉取 + 恢复动作 + 关闭规则 + 状态生命周期
AppRestoreStatusBanner = 结果投影面
```

也就是说，checkpoint 是一个小闭环，而不是单点按钮事件。

### 这一步的定位

**`useAppCheckpointMenu` 是恢复流程控制器：负责开菜单、拉列表、执行恢复、自动收口和状态回显。**

---

## 33. MainContent 主画布：为什么它是工作流承载层，而不是单纯内容容器

如果只看名字，`AppMainContent` 很容易被理解成“中间放内容的地方”；但从实现看，它实际承接的是主工作流的纵向编排：`desktop/src/components/AppMainContent.tsx:14`

### 33.1 它内部不是一个编辑器，而是一条纵向工作流栈

结构非常清楚：`desktop/src/components/AppMainContent.tsx:21`

```text
AppMainContent
 ├─ AppHeader
 ├─ AppRestoreStatusBanner
 ├─ DocumentEditor
 └─ AppContextFooter
```

这说明中间区域不是“正文组件”，而是一个主画布容器，负责把写作流程里最重要的四层垂直串起来。

### 33.2 它承接的是三种不同类型的信息

`AppMainContentProps` 只有四个字段：`desktop/src/components/AppMainContent.tsx:7`

- `headerProps`
- `restoreStatus`
- `contextEstimatedText`
- `onOpenWritingHelper`

看起来不多，但每个字段都代表一类完全不同的职责：

- `headerProps`：顶部操作与运行态
- `restoreStatus`：恢复动作反馈
- `onOpenWritingHelper`：正文区向右侧工具发起动作的桥
- `contextEstimatedText`：底部上下文预算提示

也就是说，`AppMainContent` 本身就是一个**工作流汇流层**。

### 33.3 Header、恢复提示、正文、上下文提示被放在同一纵轴上，不是偶然

这四层放在一起，代表当前产品对“主工作区”的定义是：

1. 顶部先给操作能力
2. 恢复状态在顶部附近即时回显
3. 中间正文承担主要写作活动
4. 底部持续提示上下文预算

这条纵轴其实就是一条很明确的运行路径：

```text
操作
  ↓
反馈
  ↓
创作
  ↓
预算感知
```

所以它不是一个视觉容器，而是把主工作流按顺序排出来的结构层。

### 33.4 它还承担“中间正文区”和“右侧工具区”之间的桥接入口

`DocumentEditor` 拿到的 `onOpenWritingHelper`，是从 `AppMainContent` 往下传的：`desktop/src/components/AppMainContent.tsx:26`

这意味着正文区内部如果要主动打开右侧 Writing Helper，并不是自己直接认识右侧面板，而是通过主画布层往上接入壳层动作。

这让结构保持得很干净：

- `DocumentEditor` 关注正文编辑
- `AppMainContent` 负责主画布编排
- `useAppShellViewModel` 提供跨区动作接线

### 33.5 从工作原理上，它是“用户主注意力路径”的容器

当前工作台里，用户最长时间停留的其实就是这条中间纵轴：

- 看顶部状态与动作
- 看恢复提示有没有出现
- 写正文
- 顺手看底部预算提示

所以从产品结构上说，`AppMainContent` 承担的是主注意力路径，而不只是“中间空白区域塞一个组件”这么简单。

### 这一步的定位

**`AppMainContent` 是写作主画布的工作流承载层：把操作、反馈、正文与预算提示串成一条主纵轴。**

---

## 34. 顶层挂载顺序：为什么 App.tsx 能看出整个工作台的真实分区

想看清 Niko-Studio 现在到底把哪些区域视为“一等公民”，最直接的文件不是某个子组件，而是：`desktop/src/App.tsx:11`

### 34.1 顶层直接并列挂了四个区域

最关键的代码是：`desktop/src/App.tsx:19`

```tsx
<Sidebar {...sidebarProps} />
<AppMainContent {...appMainContentProps} />
<ChatSidebar {...chatSidebarProps} />
<AppRightPanels {...appRightPanelsProps} />
```

这四个区域是同级并列的。

它直接告诉你当前 Shell 的真实空间划分是：

- 左：入口与切换
- 中：主写作画布
- 侧：持续对话协作区
- 右：按需工具出口

这比只盯某个页面局部，更能说明产品结构。

### 34.2 ChatSidebar 和 AppRightPanels 是两套不同的侧边概念

这一点在 `App.tsx` 里特别明显：`desktop/src/App.tsx:24`

因为它们不是一个组件里的两个 tab，而是两个独立并列挂载区。

这意味着产品在结构上明确区分了：

- `ChatSidebar`：常驻并行协作
- `AppRightPanels`：任务型工具路由

所以“聊天”和“右侧工具”从根上就是两条不同的交互通道。

### 34.3 ToastContainer 没放进主横向布局里，说明它是壳层级反馈

`ToastContainer` 挂在主横向 `div` 外面，但仍在 `ErrorBoundary` 里面：`desktop/src/App.tsx:28`

这说明 toast 不是某个具体区域的私有反馈，而是整个工作台共享的壳层级提示机制。

也就是说：

- Sidebar 触发的动作可以弹 toast
- 主画布动作也可以弹 toast
- 右侧工具区动作也可以弹 toast
- 它不从属于任何单一区块

### 34.4 ErrorBoundary 包住的是整个工作台，而不是正文区

`ErrorBoundary` 包住了整个应用主结构：`desktop/src/App.tsx:18`

这很重要，因为它说明当前工程对“工作台”这个整体有统一兜底，而不是只保护编辑器。

从架构意图上看，这意味着：

- Shell 级错误被视为统一体验问题
- 不把稳定性责任局限在某个子模块
- 顶层容器被当作一个整体产品面来保护

### 34.5 `useAppStartup()` 也在这里，说明启动链路属于壳层职责

`useAppStartup()` 在 `App()` 顶层直接执行：`desktop/src/App.tsx:15`

这把主题恢复、后端检查等启动动作明确放在了壳层，而不是放到正文区或某个面板内部。

所以 `App.tsx` 展示出来的不只是布局，还包括：

- 启动逻辑属于壳层
- 错误兜底属于壳层
- 全局提示属于壳层
- 各工作区并列挂载也属于壳层

### 34.6 从程序结构怎么记这一层

可以把它记成：

```text
ErrorBoundary
  ├─ Shell Row
  │   ├─ Sidebar
  │   ├─ AppMainContent
  │   ├─ ChatSidebar
  │   └─ AppRightPanels
  └─ ToastContainer
```

而在进入这个结构之前，还有一个顶层启动动作：`useAppStartup()`。

这基本就是当前工作台最真实的总图。

### 这一步的定位

**`App.tsx` 暴露了当前写作工作台的最高层真相：它不是单页面，而是带启动、兜底、全局提示的四区并列 Shell。**

---

## 35. 把 20～34 串起来：当前写作工作台的真实运行骨架

如果把 20 到 34 节的技术说明压缩成一张结构图，当前 Niko-Studio 更接近这样：

```text
App.tsx
  ├─ useAppStartup()
  ├─ ErrorBoundary
  ├─ useAppViewModel()
  │    ├─ useAppUiPersistence()
  │    ├─ useAppPanelOrchestration()
  │    ├─ useAppCheckpointMenu()
  │    ├─ useAppHeaderViewModel()
  │    └─ useAppShellViewModel()
  │          ├─ sidebarProps
  │          ├─ appMainContentProps
  │          ├─ chatSidebarProps
  │          └─ appRightPanelsProps
  ├─ Sidebar
  ├─ AppMainContent
  │    ├─ AppHeader
  │    ├─ AppRestoreStatusBanner
  │    ├─ DocumentEditor
  │    └─ AppContextFooter
  ├─ ChatSidebar
  ├─ AppRightPanels
  └─ ToastContainer
```

### 35.1 这张骨架图说明了三件事

第一，当前系统不是“编辑器 + 几个外挂面板”。

它本质上是一个 Shell，正文编辑只是其中最核心的一块。

第二，很多你以为属于某个组件自己的行为，其实都来自装配层：

- Header 的运行态显示
- AI 工具栏的模式映射
- ChatSidebar 的预算回传
- 右侧工具区的打开逻辑

第三，恢复、提示、启动、兜底这些“非正文能力”现在也已经进入主工作流，不再是旁支。

### 35.2 从工作流角度怎么理解这条骨架

用户在产品里看到的是：

```text
进入文档
  ↓
在主画布写正文
  ↓
用顶部动作表达 AI 意图
  ↓
在右侧工具区执行具体能力
  ↓
让聊天区持续提供并行上下文
  ↓
用 Story Bible 与状态栏维持长期写作节奏
```

而程序实际做的是：

```text
壳层先装配状态与能力
  ↓
四个区域并列挂载
  ↓
主纵轴承接创作流程
  ↓
左右两侧承接入口、对话与工具执行
  ↓
恢复 / 提示 / 预算 / 运行态穿插在整条链路里
```

### 35.3 以后再读代码时，优先顺序应该怎么抓

如果你后面还要继续理解这个工作台，建议按这个顺序读：

1. `desktop/src/App.tsx:11` —— 先看总壳层怎么挂
2. `desktop/src/hooks/useAppViewModel.ts:12` —— 再看状态怎么分阶段收集
3. `desktop/src/hooks/useAppShellViewModel.ts:60` —— 看最终 props 怎么定型
4. `desktop/src/components/AppMainContent.tsx:14` —— 看主纵轴怎么承接工作流
5. `desktop/src/components/DocumentEditor.tsx:14` —— 再看正文区细节
6. `desktop/src/components/AppRightPanels.tsx:20` —— 最后看右侧工具出口

这样读，会先在脑子里搭起骨架，再往里填细节，不容易迷路。

### 这一步的定位

**当前 Niko-Studio 的真实写作骨架是：Shell 先装配、四区并列、主纵轴承载创作、侧区承接协作与执行。**

---

## 36. 右侧执行出口：为什么 `AppRightPanels` 更像路由插槽，而不是普通侧边栏

如果只看界面，很容易把右侧区域理解成“几个工具面板轮流显示”。

但从实现上看，它更像一个 **shell 级执行出口**，由壳层状态决定当前把哪一种能力挂进来：`desktop/src/components/AppRightPanels.tsx:20`。

```tsx
{activeRightPanel === 'evaluation' && (
  <EvaluationPanel
    content={latestAssistantContent}
    onClose={closeRightPanel}
  />
)}

{activeRightPanel === 'mcpStatus' && <McpStatusPanel onClose={closeRightPanel} />}

{activeRightPanel === 'writingHelper' && (
  <WritingHelperPanel
    onClose={closeRightPanel}
    onOpenSettings={openSettingsFromWritingHelper}
    draftState={writingHelperDraft}
    onDraftStateChange={setWritingHelperDraft}
    onClearDraft={clearWritingHelperDraft}
  />
)}
```

这里最关键的不是“右侧能显示什么”，而是：

- `activeRightPanel` 是统一入口
- 每个右侧能力都是被壳层按条件挂载
- 面板之间没有互相嵌套关系
- 右侧区域承接的是“执行位”，不是视觉装饰位

### 36.1 为什么说它是执行出口

因为挂进去的不是展示卡片，而是直接参与工作流的功能模块：

- `EvaluationPanel` 消费最新助手输出做评估
- `McpStatusPanel` 展示节点状态
- `WritingHelperPanel` 接收草稿、执行文本处理、回写正文
- `AiTextOptimizer` 承接另一条独立文本优化路径

也就是说，这一层承接的是**真正会改变工作流状态的工具**。

所以它更接近这样一组由状态驱动的能力分发：

```text
activeRightPanel
  ├─ knowledge
  ├─ evaluation
  ├─ mcpStatus
  ├─ writingHelper
  └─ textOptimizer
```

而不是“右边固定有个工具箱，里面塞几个 Tab”。

### 36.2 为什么 `SettingsModal` 单独挂着很重要

`AppRightPanels` 里还有一个很关键的信号：`SettingsModal` 并不受 `activeRightPanel` 控制，而是独立挂载：`desktop/src/components/AppRightPanels.tsx:30`。

```tsx
<SettingsModal
  isOpen={settingsOpen}
  onClose={closeSettings}
/>
```

这说明设置在程序结构上不是右侧路由的一支，而是一个 **平行 modal 通道**。

它的重要含义是：

- 设置不是某个右侧工具页的内部子页面
- 设置可以临时打断右侧执行流
- 关闭设置后，可以由 orchestration 层决定恢复哪个右侧能力

这也是为什么 `openSettingsFromWritingHelper()` 不直接在 `WritingHelperPanel` 内部处理，而是交给 `useAppPanelOrchestration()` 控制：`desktop/src/hooks/useAppPanelOrchestration.ts:38`。

### 36.3 从工作原理上怎么理解这层

可以把右侧区域理解成：

```text
右侧区域 = shell 提供的能力挂载口
```

主画布负责“持续创作”，而右侧区域负责“按当前意图临时挂入执行器”。

因此当前设计天然支持：

- 一个时刻只聚焦一种右侧能力
- 不同能力共享同一开关语义（打开 / 关闭 / 切换）
- 右侧能力可由壳层统一调度，而不是各自抢布局控制权

### 这一步的定位

**`AppRightPanels` 不是普通右栏，而是壳层的右侧执行插槽：谁被挂进来，由 shell 状态决定。**

---

## 37. Writing Helper 草稿链路：为什么它能记住现场，而且不会被脏状态带偏

Writing Helper 之所以像“半持续工作区”，核心不在面板本身，而在壳层已经把它的输入状态独立持久化了：`desktop/src/hooks/useAppUiPersistence.ts:9`、`desktop/src/hooks/useAppUiPersistence.ts:17`。

```ts
export interface WritingHelperDraftState {
  content: string
  mode: WritingHelperMode
  maxSentences: number
  maxItems: number
}

const DEFAULT_WRITING_HELPER_DRAFT: WritingHelperDraftState = {
  content: '',
  mode: 'polish',
  maxSentences: 3,
  maxItems: 6,
}
```

这说明壳层早就把 Writing Helper 当成一个有自己“未完成现场”的功能区，而不是一次性弹窗。

### 37.1 恢复逻辑为什么是防御式的

真正关键的是恢复代码：`desktop/src/hooks/useAppUiPersistence.ts:43`。

```ts
const parsed = JSON.parse(raw) as Partial<WritingHelperDraftState>
return {
  content: typeof parsed.content === 'string' ? parsed.content : DEFAULT_WRITING_HELPER_DRAFT.content,
  mode: toWritingHelperMode(parsed.mode, DEFAULT_WRITING_HELPER_DRAFT.mode),
  maxSentences: toPositiveInteger(parsed.maxSentences, DEFAULT_WRITING_HELPER_DRAFT.maxSentences),
  maxItems: toPositiveInteger(parsed.maxItems, DEFAULT_WRITING_HELPER_DRAFT.maxItems),
}
```

这里不是“读到什么就信什么”，而是逐字段校正：

- `content` 必须真的是字符串
- `mode` 必须能落回合法 `WritingHelperMode`
- 数值参数必须是正整数
- 任一异常都回默认值

这就是一个很典型的弱信任本地持久化模型：

```text
localStorage 只是恢复线索，不是权威状态源
```

### 37.2 为什么右侧路由恢复也要白名单校验

同一个 hook 里对右侧面板路由也做了白名单判断：`desktop/src/hooks/useAppUiPersistence.ts:33`。

```ts
const isRightPanelType = (value: unknown): value is RightPanelType => {
  return value === 'none' || value === 'knowledge' || value === 'evaluation' || value === 'mcpStatus' || value === 'writingHelper' || value === 'textOptimizer'
}
```

这意味着恢复阶段不会允许存储层伪造一个未知面板值来劫持界面。

换句话说，当前实现对本地恢复的态度是：

- 可以尽量帮用户续上现场
- 但不能让历史脏值篡改当前壳层结构

### 37.3 `WritingHelperPanel` 自身是怎么接上这条链路的

真正把持久化现场与面板内部状态接起来的是这里：`desktop/src/components/WritingHelperPanel.tsx:53` 和 `desktop/src/components/WritingHelperPanel.tsx:69`。

```tsx
const [content, setContent] = useState(() => {
  if (draftState?.content) return draftState.content
  const handle = getEditorHandle()
  if (handle) {
    const selected = handle.getSelectedText()
    if (selected.trim()) return selected
  }
  return ''
})

useEffect(() => {
  onDraftStateChange?.({ content, mode, maxSentences, maxItems })
}, [content, mode, maxSentences, maxItems, onDraftStateChange])
```

这里有一条很清楚的优先级链：

```text
持久化草稿
  ↓
编辑器当前选区
  ↓
空内容默认值
```

而且只要用户继续改内容、模式或参数，状态就会不断向上同步给壳层。

所以真正记住现场的不是 `WritingHelperPanel` 自己，而是：

```text
面板内部 state → onDraftStateChange → useAppUiPersistence → localStorage
```

### 37.4 为什么清空草稿是“双清”而不是只清界面

`handleClearDraft()` 最后会调 `onClearDraft()`：`desktop/src/components/WritingHelperPanel.tsx:145`。

而壳层实现是：`desktop/src/hooks/useAppUiPersistence.ts:95`

```ts
const clearWritingHelperDraft = useCallback(() => {
  clearWritingHelperDraftStorage()
  setWritingHelperDraft(DEFAULT_WRITING_HELPER_DRAFT)
}, [])
```

也就是同时清：

- storage
- live state

这避免了“界面看起来清空了，但下次打开又从旧数据恢复”的错位。

### 这一步的定位

**Writing Helper 能保持连续性，不是因为面板复杂，而是因为 shell 已经把它建模成可恢复、可校正、可回写的草稿状态。**

---

## 38. 编辑器桥接层：为什么右侧面板能直接吃到正文选区，又能把结果插回去

如果没有桥接层，`WritingHelperPanel` 和 `AiTextOptimizer` 这种右侧能力要想操作正文，通常只有两条路：

- 一层层 prop drilling
- 上复杂 context/store

当前实现走了第三条更轻的路：**模块级 editor handle**。

定义在 `desktop/src/utils/editorHandle.ts:7`：

```ts
export interface EditorHandle {
  insertText: (text: string) => void
  getSelectedText: () => string
  getJSON: () => JSONContent
  isGenerating?: boolean
}

let currentHandle: EditorHandle | null = null

export function setEditorHandle(handle: EditorHandle | null): void {
  currentHandle = handle
}

export function getEditorHandle(): EditorHandle | null {
  return currentHandle
}
```

### 38.1 `NikoEditor` 是怎么注册这座桥的

注册发生在 `desktop/src/components/NikoEditor.tsx:57`。

```tsx
useEffect(() => {
  if (!editor) return
  handleRef.current.insertText = (text: string) => {
    editor.chain().focus().insertContent(text).run()
  }
  handleRef.current.getSelectedText = () => {
    const { from, to } = editor.state.selection
    return editor.state.doc.textBetween(from, to, '\n')
  }
  handleRef.current.getJSON = () => editor.getJSON()
  setEditorHandle(handleRef.current)
  return () => { setEditorHandle(null) }
}, [editor])
```

这个 effect 做了三件事：

1. 把 TipTap 实例能力包装成稳定 handle
2. 挂到模块级共享引用上
3. 在编辑器卸载时清掉它

所以桥接层不是永久单例，而是 **由当前活跃编辑器挂载和回收**。

### 38.2 为什么 `WritingHelperPanel` 能自动拿到正文选区

因为它初始化内容时直接读了这个 handle：`desktop/src/components/WritingHelperPanel.tsx:54`。

```tsx
const handle = getEditorHandle()
if (handle) {
  const selected = handle.getSelectedText()
  if (selected.trim()) return selected
}
```

这就形成了一个非常实用的协作流：

```text
用户在正文里选中一段
  ↓
打开 Writing Helper
  ↓
面板初始化时读取 editor handle
  ↓
把选中内容作为待处理文本预填充
```

这也是当前工作台“正文区”和“右侧执行区”真正连起来的地方。

### 38.3 为什么这比 prop drilling 更合适

因为正文编辑器和右侧工具并不是父子直属关系。

从挂载结构看，它们分属于不同区域：`desktop/src/App.tsx:18`。

```text
Sidebar | AppMainContent | ChatSidebar | AppRightPanels
```

`NikoEditor` 在 `AppMainContent` 深处，`WritingHelperPanel` 在 `AppRightPanels` 路由出口里。

如果硬要 prop drilling，就得把 editor 方法一路抬到 shell 再一路传回右侧，反而会让壳层 props 污染得很重。

当前这层桥接的好处是：

- 能力面很小，只暴露必要动作
- 不要求正文区和右侧区形成强耦合树结构
- 面板只关心“有没有当前编辑器能力可用”

### 38.4 它的真实角色不是状态中心，而是能力桥

这层设计最容易误读成“全局 store”。

其实不是。

它没有保存正文全文状态，也不负责同步业务数据；它只暴露少数 **跨区域即时能力**：

- 取当前选区
- 插入文本
- 读取当前 JSON

所以它的角色更准确地说是：

```text
cross-region capability bridge
```

不是状态真源，也不是工作流控制器。

### 这一步的定位

**`editorHandle` 解决的不是状态管理，而是跨区域能力借道：让右侧执行器能安全触到主画布编辑器。**

---

## 39. Chat 运行时耦合：为什么聊天区不是旁路功能，而是工作台的并行协作面

`ChatSidebar` 在布局上和主画布并列，但真正说明它不是“附属聊天框”的，是 `ChatArea` 自己的运行时职责：`desktop/src/components/ChatArea.tsx:32`。

```tsx
interface ChatAreaProps {
  onContextUsageChange?: (usage: { usedChars: number; usedK: number; totalK: number; percent: number }) => void
  connectionState?: 'connected' | 'degraded' | 'disconnected' | 'reconnecting'
  isTemplatePanelOpen?: boolean
  onTemplatePanelOpenChange?: (open: boolean) => void
}
```

这四个 props 已经说明，聊天区不是自己关起门来跑，而是在和 shell 交换运行时信号：

- 上报上下文预算
- 接收连接状态
- 与模板面板联动
- 参与整体工作台交互节奏

### 39.1 为什么“发送前 checkpoint”说明它进入主流程了

`handleSend()` 里不是直接发消息，而是先建恢复点：`desktop/src/components/ChatArea.tsx:156`。

```tsx
checkpointId = await createBeforeSendCheckpoint(`before-send:${Date.now()}`)
addMessage('user', userMessage)
setIsLoading(true)
setStreamingContent('')
```

这非常关键。

它表示聊天发送已经不是一次轻量输入事件，而是一个需要可恢复保护的工作流动作。

也就是说，聊天区被系统视为：

```text
会改变会话状态、值得在执行前打快照的运行面
```

### 39.2 恢复能力为什么是聊天区的核心职责之一

恢复相关逻辑直接通过 `useChatRecovery()` 接入：`desktop/src/components/ChatArea.tsx:63`。

```tsx
const {
  recoverableCheckpointId,
  setRecoverableCheckpointId,
  recoverStatus,
  setRecoverStatus,
  createBeforeSendCheckpoint,
  restoreToCheckpoint,
} = useChatRecovery({ ... })
```

这说明聊天区不是“失败了再说”，而是从设计上就把以下情况当成常规情境：

- 流式中断
- 重连
- 恢复提示
- 回滚到发送前现场

所以它和正文区一起，构成了另一个必须考虑连续性的工作面。

### 39.3 为什么上下文预算会上浮到 header

`ChatArea` 会根据历史消息和流式内容持续计算预算：`desktop/src/components/ChatArea.tsx:90`。

```tsx
const messageChars = messages.reduce((total, message) => total + message.content.length, 0)
const usedChars = messageChars + streamingContent.length
const totalK = 128
const usedK = Number((usedChars / 1000).toFixed(1))
const percent = Number(Math.min((usedChars / (totalK * 1000)) * 100, 999).toFixed(1))
...
onContextUsageChange(nextUsage)
```

然后这个值会经由 `useAppShellViewModel()` 被送到 header view model。

这条链路说明：

```text
聊天区计算运行预算 → 壳层接收 → Header 显示全局上下文压力
```

因此 Header 里的上下文使用不是静态统计，而是聊天运行时向壳层持续回报的结果。

### 39.4 为什么它是并行协作面，而不是右侧工具

聊天区和右侧工具最大的区别是：

- 右侧工具通常是按意图临时打开的执行器
- 聊天区是长期并列存在的协作线程

它既不属于右侧路由，也不属于正文主轴，而是在 shell 里独立占一块区域，持续提供：

- 对话输入
- 模板驱动
- 运行恢复
- 预算反馈

所以更准确的理解是：

```text
DocumentEditor = 主创作线程
ChatArea = 并行协作线程
```

### 这一步的定位

**聊天区不是“辅助聊天框”，而是带恢复、预算、模板联动能力的并行协作运行时。**

---

## 40. AI Toolbar 的真正语义：按钮不决定能力，壳层映射才决定能力

如果只看 `AiToolbar`，你会以为这些按钮已经定义了 AI 行为。

其实没有。`AiToolbar` 只是一层意图表面：`desktop/src/components/AiToolbar.tsx:4`。

```tsx
interface AiToolbarProps {
  disabled?: boolean
  onWrite: () => void
  onRewrite: () => void
  onDescribe: () => void
  onBrainstorm: () => void
  onOpenWritingHelper: () => void
  onOpenTextOptimizer: () => void
}
```

它做的只是把按钮点击转成 callback：`desktop/src/components/AiToolbar.tsx:17`。

```tsx
const tools = [
  { label: t.aiToolWrite, icon: <PenLine size={14} />, action: onWrite },
  { label: t.aiToolRewrite, icon: <RefreshCw size={14} />, action: onRewrite },
  { label: t.aiToolDescribe, icon: <MessageSquareText size={14} />, action: onDescribe },
  { label: t.aiToolBrainstorm, icon: <Lightbulb size={14} />, action: onBrainstorm },
]
```

这层并不知道：

- 要打开哪个右侧能力
- 要设置什么 helper mode
- 要不要预置某个草稿状态

### 40.1 真正的语义映射发生在 `useAppShellViewModel`

真正把“按钮意图”翻成“系统动作”的是在这里：`desktop/src/hooks/useAppShellViewModel.ts:111`。

```ts
onAiWrite: () => {
  uiPersistence.setWritingHelperDraft({ ...uiPersistence.writingHelperDraft, mode: 'polish' })
  panelOrchestration.toggleRightPanel('writingHelper')
},
onAiRewrite: () => {
  uiPersistence.setWritingHelperDraft({ ...uiPersistence.writingHelperDraft, mode: 'rewrite' })
  panelOrchestration.toggleRightPanel('writingHelper')
},
onAiDescribe: () => {
  uiPersistence.setWritingHelperDraft({ ...uiPersistence.writingHelperDraft, mode: 'expand' })
  panelOrchestration.toggleRightPanel('writingHelper')
},
onAiBrainstorm: () => {
  uiPersistence.setWritingHelperDraft({ ...uiPersistence.writingHelperDraft, mode: 'outline' })
  panelOrchestration.toggleRightPanel('writingHelper')
},
```

这段代码把 UI 上四个词，翻译成了四个明确的程序语义：

- Write → `writingHelper + polish`
- Rewrite → `writingHelper + rewrite`
- Describe → `writingHelper + expand`
- Brainstorm → `writingHelper + outline`

### 40.2 为什么这一层必须放在 shell，而不是按钮组件里

因为这里映射的不只是视觉动作，而是跨模块协同：

- 改写了 `writingHelperDraft.mode`
- 决定右侧打开 `writingHelper`
- 复用了统一的右侧路由调度语义

如果把这些都塞进 `AiToolbar`：

- 展示组件会知道太多业务细节
- toolbar 会直接耦合持久化和右侧路由
- 后面换入口位置时很难复用

现在的分层更清楚：

```text
AiToolbar = 用户意图表面
useAppShellViewModel = 意图到系统动作的语义翻译层
WritingHelperPanel = 具体执行器
```

### 40.3 为什么这也是“工作原理”里最容易忽略的一层

很多人读 UI 代码时会先盯按钮组件，误以为能力定义在按钮所在处。

但当前工程真正的规律是：

- presentational component 负责发出意图
- shell assembly 负责翻译意图
- target panel / runtime 负责执行意图

这是一种很典型的 **UI semantics lifting**：

```text
按钮只说“我被点了”
壳层决定“这意味着什么”
执行模块负责“具体怎么做”
```

### 40.4 从整个写作工作流看这条链路

当用户点击顶部 AI 工具时，系统内部实际发生的是：

```text
点击 toolbar 按钮
  ↓
AiToolbar 触发 callback
  ↓
useAppShellViewModel 把 callback 翻译成 draft.mode + right panel route
  ↓
WritingHelperPanel 以该模式启动
  ↓
用户继续补充内容并执行处理
```

所以用户感知到的是“点一个按钮就进入对应 AI 工作模式”，而代码层真正完成这件事的是壳层语义映射。

### 这一步的定位

**AI Toolbar 只是意图入口；真正决定能力模式的，是 `useAppShellViewModel` 里的语义翻译。**

---

## 41. 编辑器内 AI 为什么是“流式写作能力”，而不是一次性文本替换

如果把 `WritingHelperPanel` 看作右侧执行器，那么 `useEditorAI` 代表的是另一条更贴近正文光标的 AI 通道：`desktop/src/hooks/useEditorAI.ts:32`。

```ts
export function useEditorAI({ editor, getStyleInstruction }: UseEditorAIOptions): UseEditorAIReturn {
  const [isGenerating, setIsGenerating] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  ...
}
```

它的关键不只是“能调用 AI”，而是：**它把 AI 生成建模成正文中的流式插入过程。**

### 41.1 它为什么不是普通的 await → setText

真正的执行链路在 `callStream()`：`desktop/src/hooks/useEditorAI.ts:44`。

```ts
const controller = new AbortController()
abortRef.current = controller
setIsGenerating(true)

const pos = insertLoadingIndicator(editor)
...
const streamer = streamTextIntoEditor(editor, pos, placeholderLen)

await streamWritingHelper(
  {
    content: prompt,
    mode: 'generate',
    instruction: getStyleInstruction?.() ?? '',
    model: provider?.defaultModel ?? '',
    provider: provider?.id ?? '',
    api_key: provider?.apiKey ?? '',
    base_url: provider?.baseUrl ?? '',
  },
  {
    onContent: (chunk) => {
      streamer.append(chunk)
    },
    onDone: () => {
      streamer.finish()
    },
  },
  { signal: controller.signal },
)
```

这里不是等全部生成完再一次塞回编辑器，而是：

1. 先在光标处插一个 `...`
2. 再把返回 chunk 持续 append 到正文
3. 完成后收口
4. 异常或中止时清理占位

所以它更接近这样一种形态：

```text
编辑器内实时生成流
```

而不是：

```text
后台生成整段字符串 → 最后一次性替换
```

### 41.2 为什么 `streamToEditor` 这一层很重要

低层流式插入不是直接写在 hook 里，而是被拆到了 `desktop/src/components/editor/streamToEditor.ts:14`。

```ts
export function insertLoadingIndicator(editor: Editor): number | null {
  const { from } = editor.state.selection
  const placeholderText = '...'
  editor.chain().focus().insertContent(placeholderText).run()
  return from
}

export function streamTextIntoEditor(
  editor: Editor,
  startPos: number,
  initialLength: number,
) {
  let endPos = startPos + initialLength
  return {
    append(chunk: string) {
      editor.chain().focus().setTextSelection({ from: endPos, to: endPos }).insertContent(chunk).run()
      const { from: currentFrom } = editor.state.selection
      endPos = currentFrom
    },
    finish(): number {
      return endPos - startPos
    },
  }
}
```

这说明 `useEditorAI` 并不直接操作原始文档位置，而是依赖一个专门的“流式写入适配层”来维持：

- 起始插入点
- 实时 endPos 演进
- 占位长度与最终长度关系

这层把“LLM chunk 流”翻译成了“TipTap 文档位置变更流”。

### 41.3 它如何根据不同场景构造 prompt

`useEditorAI` 暴露的不是一个统一 `run()`，而是三种编辑器语义动作：`desktop/src/hooks/useEditorAI.ts:104`、`desktop/src/hooks/useEditorAI.ts:119`、`desktop/src/hooks/useEditorAI.ts:135`。

- `generateAtCursor()`：拿光标前约 2000 字上下文拼 prompt
- `rewriteSelection()`：读取当前选区，先删选区，再以流式结果替换
- `continueWriting()`：拿光标前约 3000 字上下文做续写

也就是说，编辑器 AI 不是只有一个“生成”概念，而是把正文内常见意图拆成了：

```text
generate / rewrite / continue
```

每种动作都直接围绕当前选区或光标位置工作。

### 41.4 风格、模型、网关是怎么接上的

这一层还会从设置里拿 provider：`desktop/src/hooks/useEditorAI.ts:36`。

```ts
const { settings } = useSettingsStore.getState()
const provider = settings.llmProviders.find(
  (p) => p.id === settings.primaryProvider && p.enabled && p.apiKey,
)
```

然后通过 `streamWritingHelper()` 走 `/writing/stream`：`desktop/src/api/client.ts:500`。

```ts
export async function streamWritingHelper(...) {
  const base = isTauri ? await getRuntimeGatewayBase() : getResolvedApiBase()
  const url = `${base}/writing/stream`
```

这表示编辑器内 AI 并不是本地假处理，而是真正经过：

```text
编辑器动作 → provider 选择 → 网关流式端点 → chunk 回流正文
```

### 41.5 为什么说这条链路比右侧面板更“贴正文”

右侧 `WritingHelperPanel` 更像先收集输入，再做处理，再决定是否回写。

而 `useEditorAI` 是直接工作在当前文档位置上：

- 生成位置就是当前光标
- 改写对象就是当前选区
- 续写依据就是当前文脉

所以它在架构上的角色更像：

```text
in-editor micro execution
```

而右侧面板更像：

```text
side-panel guided execution
```

### 这一步的定位

**`useEditorAI` 把 AI 变成了正文内部的流式编辑能力：不是“拿结果回来贴上”，而是“让生成过程直接发生在文档里”。**

---

## 42. Story Bible 的真实角色：它不是附加资料栏，而是本地作者状态与图谱知识的混合支撑层

`StoryBiblePanel` 很容易被看成“右边补充信息区”，但它其实不在右侧，而是直接挂在正文主流程下面：`desktop/src/components/DocumentEditor.tsx:77`。

它的实现也很能说明问题：既有本地写作状态，又有外部图谱数据：`desktop/src/components/StoryBiblePanel.tsx:81`。

### 42.1 为什么说它先是作者状态容器

先看本地状态：`desktop/src/components/StoryBiblePanel.tsx:83`。

```ts
const [characters, setCharacters] = useState<GraphItem[]>([])
const [locations, setLocations] = useState<GraphItem[]>([])
const [braindump, setBraindump] = useState(() => loadFromStorage('niko.sb-braindump-v1'))
const [genres, setGenres] = useState<string[]>(() => {
  const raw = loadFromStorage('niko.sb-genres-v1')
  return raw ? raw.split(',').filter(Boolean) : []
})
const [synopsis, setSynopsis] = useState(() => loadFromStorage('niko.sb-synopsis-v1'))
const [outline, setOutline] = useState(() => loadFromStorage('niko.sb-outline-v1'))
const [selectedStyle, setSelectedStyle] = useState<StyleId>(() =>
  (loadFromStorage('niko.sb-style-v1') as StyleId) || 'tried'
)
```

这说明 Story Bible 先服务的是“作者长期写作现场”：

- 脑暴记录
- 题材标签
- 梗概
- 大纲
- 风格偏好

这些内容都不是即时 API 返回，而是作者自己的持续工作状态。

### 42.2 为什么它又不是纯本地表单

它还会主动查图谱：`desktop/src/components/StoryBiblePanel.tsx:127`。

```ts
const [charResult, locResult] = await Promise.allSettled([
  queryGraph('MATCH (c:Character) RETURN c LIMIT 50'),
  queryGraph('MATCH (l:Location) RETURN l LIMIT 50'),
])
```

然后把图结果转成 UI 项：`desktop/src/components/StoryBiblePanel.tsx:138`。

```ts
if (charResult.status === 'fulfilled' && charResult.value.data) {
  setCharacters(toGraphItems(charResult.value.data, 'c'))
}
if (locResult.status === 'fulfilled' && locResult.value.data) {
  setLocations(toGraphItems(locResult.value.data, 'l'))
}
```

所以它不是单纯的“作者自己写一点备注”，而是：

```text
本地作者草稿 + 外部结构化知识
```

共同支撑当前作品世界观与人物设定。

### 42.3 为什么这里用 `Promise.allSettled` 很有意思

这里没有要求“角色”和“地点”必须一起成功，而是允许局部退化：

- 人物拿到就先展示人物
- 地点拿到就展示地点
- 任一路失败不拖死整个 Story Bible

再结合外层的：

```ts
} catch {
  // Graceful degradation
} finally {
  if (!cancelled) setLoading(false)
}
```

可以看出它被设计成一个 **增强型支撑层**，而不是正文主链路的硬前置依赖。

也就是说，即使图谱服务暂时不可用，作者依然可以继续写。

### 42.4 为什么它会放在 DocumentEditor 下面，而不是独立工具区

这恰恰说明产品在结构上把它定义为“创作支撑层”，而不是“外部工具”。

放在正文里，意味着它的职责是：

- 帮用户持续记住作品内在设定
- 在写作过程中随时参考
- 不需要切出主创作线程去另一个区域

所以它和右侧工具最大的差别在于：

```text
Story Bible = 主创作线程内的长期支撑层
Writing Helper = 侧向打开的临时执行器
```

### 42.5 从工作流上怎么理解它的混合性

这一块最值得记住的不是 UI，而是数据形态：

```text
作者自己写下的长期设定
  +
系统从图谱取回的结构化实体
  ↓
共同构成作品上下文支撑面
```

所以它既不是纯表单，也不是纯知识库浏览器，而是两者的混合。

### 这一步的定位

**Story Bible 的真实角色是：把作者私有写作现场与图谱化世界知识拼在一起，成为正文下方的长期支撑层。**

---

## 43. Header 运行态与上下文条为什么不是静态 UI，而是壳层聚合出来的运行投影

Header 看起来只是顶部一条状态栏，但它的值并不是写死的，也不是某个组件本地算出来的，而是经过多层汇总后投影出来的。

起点在 `useAppViewModel()`：`desktop/src/hooks/useAppViewModel.ts:16`。

```ts
const contextUsageView = useAppContextUsage()
const runtimeView = useAppRuntimeHealth({ backendStatus, checkBackend })
...
const headerViewModel = useAppHeaderViewModel({
  runtimeView,
  backendStatus,
  t,
  contextUsage: contextUsageView.contextUsage,
})
```

这意味着 Header 的可见状态来自两条独立来源：

- runtime health
- context usage

### 43.1 运行态为什么是“轮询 + 可见性控制”出来的

`useAppRuntimeHealth()` 会主动探测网关状态：`desktop/src/hooks/useAppRuntimeHealth.ts:12`。

```ts
useEffect(() => {
  checkBackend()

  const fetchGatewayRuntime = async () => {
    try {
      const response = await getGatewayHealth()
      if (response.success && response.data) {
        setRuntimeView(deriveGatewayRuntimeState(response.data, backendStatus))
        return
      }
    } catch {
      // ignore runtime fetch error
    }
    setRuntimeView(deriveGatewayRuntimeState(null, backendStatus))
  }

  void fetchGatewayRuntime()

  let interval = setInterval(() => {
    void checkBackend()
    void fetchGatewayRuntime()
  }, 30000)
```

并且页面隐藏时会停轮询，恢复可见时再继续：`desktop/src/hooks/useAppRuntimeHealth.ts:35`。

所以 Header 上那个“服务运行 / 降级 / 重连 / 离线”并不是视觉常量，而是一个被周期采样出来的 runtime 投影。

### 43.2 上下文预算为什么是聊天区推上来的，而不是 Header 自己算的

上下文预算状态保存在 `useAppContextUsage()`：`desktop/src/hooks/useAppContextUsage.ts:17`。

```ts
const [contextUsage, setContextUsage] = useState<ContextUsage>(DEFAULT_CONTEXT_USAGE)

const handleContextUsageChange = useCallback((usage: ContextUsage) => {
  setContextUsage((prev) => {
    if (
      prev.usedChars === usage.usedChars &&
      prev.usedK === usage.usedK &&
      prev.totalK === usage.totalK &&
      prev.percent === usage.percent
    ) {
      return prev
    }
    return usage
  })
}, [])
```

这层只做两件事：

- 保存最新预算
- 避免完全相同的值重复刷新

也就是说它是一个壳层缓冲器，而不是预算计算器。

真正计算发生在 `ChatArea`，真正展示发生在 Header，中间由壳层做中转。

### 43.3 `useAppHeaderViewModel` 做的不是拉数据，而是翻译成展示协议

最终转成 Header 可消费格式的是 `desktop/src/hooks/useAppHeaderViewModel.ts:33`。

```ts
const headerConnectionState = runtimeView?.connectionState ?? (backendStatus ? 'connected' : 'disconnected')
const headerDotClass = APP_CONNECTION_DOT[headerConnectionState] ?? APP_CONNECTION_DOT.disconnected
const headerConnectionLabelKey = APP_CONNECTION_LABEL[headerConnectionState] ?? (backendStatus ? 'serviceRunning' : 'serviceOffline')
const headerConnectionText = t[headerConnectionLabelKey]

const contextUsageText = `${contextUsage.usedK.toFixed(1)}k/${contextUsage.totalK}k`
const contextUsageBarClass =
  contextUsage.percent > 85
    ? 'bg-danger-500'
    : contextUsage.percent > 65
      ? 'bg-warning-500'
      : 'bg-primary-500'
const contextUsageWidthPercent = Math.min(100, Math.max(0, contextUsage.percent))
```

这一层做的其实是 **runtime → UI protocol** 的转换：

- 连接态 → 文案 key
- 连接态 → 状态点颜色
- 百分比 → 进度条颜色
- 数值 → Header 文本格式

所以它是个 view model，不是状态源。

### 43.4 从完整链路怎么记这组机制

可以把整条链路记成：

```text
网关健康检查 / 聊天预算计算
  ↓
useAppRuntimeHealth / useAppContextUsage
  ↓
useAppHeaderViewModel
  ↓
Header 可渲染协议
```

这说明 Header 展示的不是某个组件自己的局部状态，而是整个工作台运行态的压缩投影。

### 43.5 为什么这对理解工作台很关键

因为一旦明白 Header 是“运行投影”，你就不会把它误读成装饰栏。

它其实在持续回答两个问题：

- 系统现在还能不能稳定工作？
- 当前上下文压力是不是已经逼近上限？

这两个问题都是工作流级问题，不是某个按钮级问题。

### 这一步的定位

**Header 的状态点和上下文条不是静态 UI，而是壳层把运行时健康度与预算压力压缩后投影出来的结果。**

## 44. Prompt Template Library 为什么不是右侧面板的一员，而是挂在 ChatArea 上的独立注入层

这一段最容易看错。

因为在侧边栏里，模板库入口和知识库、设置这些按钮长得很像，所以直觉上会以为它也是右侧面板系统的一部分。但实际代码不是这么组织的。

先看壳层编排：

`desktop/src/hooks/useAppPanelOrchestration.ts:26`

```ts
const openPrompts = useCallback(() => {
  setActiveRightPanel('none')
  setIsTemplatePanelOpen(true)
}, [setActiveRightPanel])
```

这里做了两件事：

- 先把 `activeRightPanel` 清成 `none`
- 再把 `isTemplatePanelOpen` 单独置为 `true`

这说明模板库不是通过 `activeRightPanel = 'prompts'` 这样的路由键挂进去，而是走了另一条独立开关链路。

再看右侧面板切换时的反向约束：

`desktop/src/hooks/useAppPanelOrchestration.ts:17`

```ts
const toggleRightPanel = useCallback((panel: Exclude<RightPanelType, 'none'>) => {
  setIsTemplatePanelOpen(false)
  setActiveRightPanel((prev) => (prev === panel ? 'none' : panel))
}, [setActiveRightPanel])
```

这段很关键。它等价于告诉你：

> “右侧执行面板”和“模板库注入层”不能同时处于打开态。

也就是说，模板库和右侧面板不是父子关系，而是**互斥的两条展示通道**。

### 44.1 为什么入口在 Sidebar，但真正宿主在 ChatArea

Sidebar 只是触发入口：

`desktop/src/components/Sidebar.tsx:209`

```tsx
<button
  onClick={onOpenPrompts}
  ...
>
  <Library size={18} />
  {!collapsed && <span className="text-sm font-medium">{t.templateLibraryEntry}</span>}
</button>
```

但 `onOpenPrompts` 最终并不把内容送进 `AppRightPanels`，而是经由壳层传给 `ChatSidebar` 的 `chatAreaProps`：

`desktop/src/hooks/useAppShellViewModel.ts:137`

```ts
const chatSidebarProps = {
  chatSidebarCollapsed: uiPersistence.chatSidebarCollapsed,
  onToggleChatSidebar: () => uiPersistence.setChatSidebarCollapsed(!uiPersistence.chatSidebarCollapsed),
  chatAreaProps: {
    onContextUsageChange,
    connectionState: headerViewModel.headerConnectionState,
    isTemplatePanelOpen: panelOrchestration.isTemplatePanelOpen,
    onTemplatePanelOpenChange: panelOrchestration.setIsTemplatePanelOpen,
  }
}
```

再由 `ChatArea` 决定要不要真正挂载模板面板：

`desktop/src/components/ChatArea.tsx`

```tsx
{isTemplatePanelOpen && promptTemplateLibrary && (
  <PromptTemplatePanel
    templates={promptTemplateLibrary.templates}
    variablePresets={promptTemplateLibrary.variablePresets}
    ...
  />
)}
```

所以结构上要这样理解：

```text
Sidebar 入口按钮
  ↓
useAppPanelOrchestration.openPrompts()
  ↓
isTemplatePanelOpen = true
  ↓
useAppShellViewModel 把开关注入 chatAreaProps
  ↓
ChatArea 内部决定挂载 PromptTemplatePanel
```

这条链路说明模板库本质上更接近 **chat composer 的增强层**，而不是右侧知识/评估/写作助手那种独立工作区。

### 44.2 为什么模板库属于“提示词注入层”

看 `PromptTemplatePanel` 的输出协议就很清楚了：

`desktop/src/components/PromptTemplatePanel.tsx:9`

```ts
export interface ApplyTemplatePayload {
  text: string;
  mode: "replace" | "append";
  templateId: string;
  variableValues: Record<string, string>;
}
```

这不是“打开一个新面板看看内容”的协议，而是一个明确的**提示词生产协议**：

- `text`：渲染后的最终模板文本
- `mode`：替换当前输入，还是追加到当前输入
- `templateId`：告诉聊天区这次用了哪一个模板
- `variableValues`：保留变量填充值，便于追踪和复用

真正应用时也不是把模板保存到什么工作台状态，而是直接做变量解析后把结果回灌给聊天输入区：

`desktop/src/components/PromptTemplatePanel.tsx:119`

```ts
const handleApply = () => {
  if (!selectedTemplate) return;

  const nextValues: Record<string, string> = {};
  const nextErrors: Record<string, string> = {};

  for (const variable of selectedTemplate.variables) {
    const value = resolveVariableValue(selectedTemplate, variable.id).trim();
    if (variable.required && !value) {
      nextErrors[variable.id] = t.templateRequiredHint;
    }
    nextValues[variable.id] = value;
  }

  setValidationErrors(nextErrors);
  if (Object.keys(nextErrors).length > 0) {
    return;
  }

  const text = renderTemplateContent(selectedTemplate, nextValues);
  onApplyTemplate({
    text,
    mode: applyMode,
    templateId: selectedTemplate.id,
    variableValues: nextValues,
  });
};
```

所以模板库的职责不是“承载一类业务面板”，而是：

1. 选择模板
2. 过滤/搜索/收藏模板
3. 校验必填变量
4. 渲染模板内容
5. 以 replace/append 两种语义注入聊天输入区

这就是“Prompt Template Library”真正的产品语义：**它是输入前的构造器，不是输入后的结果面板。**

### 44.3 为什么它不是 AppRightPanels 的一员

看 `AppRightPanels` 就更明确了：

`desktop/src/components/AppRightPanels.tsx`

```tsx
{activeRightPanel === 'knowledge' && <KnowledgeModal ... />}

<SettingsModal isOpen={settingsOpen} onClose={closeSettings} />

{activeRightPanel === 'evaluation' && <EvaluationPanel ... />}
```

这里承载的是：

- 知识检索/浏览
- 评估
- 写作助手
- 文本优化器
- MCP 状态
- 设置模态

这些东西有共同特征：**打开后自己就是一个独立工作面。**

而模板库不同。它的完成条件不是“用户在这里停留并工作”，而是“用户把模板注入到 chat input 后继续发消息”。

所以模板库被放在 `ChatArea` 附近，是为了最短路径完成这一闭环：

```text
选模板 → 填变量 → 应用 → 回到聊天输入 → 直接发送
```

如果把它塞进 `AppRightPanels`，链路会变长，语义也会变脏，因为那会把“输入前拼装器”误做成“独立业务面板”。

### 44.4 从工作流怎么记它

可以把模板库记成：

```text
Chat 输入前增强层
而不是
Right Panel 业务面板
```

所以它虽然看起来像工作台右边弹出的一个抽屉，但在程序结构里，它真正隶属的是 **ChatArea 的 prompt composition 流程**。

### 这一步的定位

**Prompt Template Library 不是右侧工作区成员，而是挂在 ChatArea 上、负责模板渲染与提示词注入的输入增强层。**

## 45. Settings 为什么是平行模态通道，而且能从 Writing Helper 临时跳出再回到原位

设置也是一个特别容易被误判的点。

如果只看 UI，会觉得它和知识库、评估、写作助手一样，都是“某个面板打开了”。但代码里它不是挂在 `activeRightPanel` 这个单一路由状态上的。

先看编排层：

`desktop/src/hooks/useAppPanelOrchestration.ts:9`

```ts
const [settingsOpen, setSettingsOpen] = useState(false)
const [isTemplatePanelOpen, setIsTemplatePanelOpen] = useState(false)
const [resumeWritingHelperAfterSettings, setResumeWritingHelperAfterSettings] = useState(false)
```

这里把设置单独建了一条 `settingsOpen` 状态线，而不是把它并入 `activeRightPanel`。这已经在结构上表明：

> 设置不是右侧面板路由中的一个分支，而是一条与右侧面板并行的模态通道。

### 45.1 为什么 openSettings 不改 activeRightPanel

看打开设置：

`desktop/src/hooks/useAppPanelOrchestration.ts:22`

```ts
const openSettings = useCallback(() => {
  setSettingsOpen(true)
}, [])
```

这里只有一件事：打开模态。

它没有：

- 切换 `activeRightPanel`
- 清空当前右侧面板
- 修改模板库状态

这意味着设置被设计成**可以覆盖在当前工作现场之上**，而不是通过“切换工作区”进入。

所以从产品语义上说，Settings 更像：

- 全局配置层
- 临时停靠站
- 覆盖式模态

而不是：

- 右侧功能面板的一种

### 45.2 为什么它能从 Writing Helper 跳出再恢复

真正关键的是这条恢复链。

当用户在 Writing Helper 内部需要去设置里改模型、API Key 或行为参数时，并不是简单“关闭写作助手再开设置”，而是先记一个恢复意图：

`desktop/src/hooks/useAppPanelOrchestration.ts:39`

```ts
const openSettingsFromWritingHelper = useCallback(() => {
  setResumeWritingHelperAfterSettings(true)
  setActiveRightPanel('none')
  setSettingsOpen(true)
}, [setActiveRightPanel])
```

这里有严格顺序：

1. `resumeWritingHelperAfterSettings = true`
2. `activeRightPanel = 'none'`
3. `settingsOpen = true`

也就是说，系统不是“把 Writing Helper 和 Settings 同时叠起来”，而是：

- 先收起当前执行面板
- 再打开设置
- 同时写下一张“回程票”

这个“回程票”就是 `resumeWritingHelperAfterSettings`。

### 45.3 为什么 closeSettings 会条件性恢复 Writing Helper

看关闭逻辑：

`desktop/src/hooks/useAppPanelOrchestration.ts:31`

```ts
const closeSettings = useCallback(() => {
  setSettingsOpen(false)
  if (resumeWritingHelperAfterSettings) {
    setActiveRightPanel('writingHelper')
    setResumeWritingHelperAfterSettings(false)
  }
}, [resumeWritingHelperAfterSettings, setActiveRightPanel])
```

这个逻辑表达得很清楚：

- 普通情况下，关闭设置就是单纯关掉模态
- 只有当“设置是从 Writing Helper 跳进来的”时，才恢复 `writingHelper`
- 恢复后立刻把恢复标记清掉，避免脏状态污染下一次关闭行为

所以它不是“关闭设置时总回到某个默认面板”，而是一个**带来源感知的条件恢复**。

这点很重要，因为它保证了设置不会变成一个打断工作流的黑洞。

### 45.4 为什么这说明 Settings 是平行通道，而不是子页面

如果 Settings 是右侧面板体系的一员，那么典型写法会是：

```ts
activeRightPanel = 'settings'
```

但这里没有这么做。

原因就在于设置承担的是**全局配置职责**，它影响多个系统：

- 聊天模型与连接
- 写作助手可用能力
- 模板库相关配置
- 其他通用参数

所以它不应该作为某个工作区的“内容页”存在，而应该作为整个工作台都能随时进入、随时退出的配置模态存在。

从结构看，这种设计有三个好处：

1. 不污染 `activeRightPanel` 的业务含义
2. 不破坏当前正在进行的主工作流
3. 能对特定来源做条件恢复，比如 Writing Helper

### 45.5 AppRightPanels 里为什么也能看到 SettingsModal

虽然设置不是右侧面板分支，但它依然在 `AppRightPanels` 组件内被统一渲染：

`desktop/src/components/AppRightPanels.tsx`

```tsx
<SettingsModal
  isOpen={settingsOpen}
  onClose={closeSettings}
/>
```

这并不表示它属于 `activeRightPanel` 体系，只表示：

- 右侧区域相关的覆盖层和面板组件，被集中放在同一个承载组件里管理
- 其中有些走 `activeRightPanel` 条件渲染
- 有些走独立布尔开关渲染

所以 `AppRightPanels` 更像是**右侧交互容器**，而不只是一个纯路由 outlet。

### 45.6 从工作流怎么记这条机制

可以把这条链记成：

```text
Writing Helper 内需要调配置
  ↓
写入恢复标记
  ↓
暂时收起右侧执行面板
  ↓
打开 Settings 模态
  ↓
关闭 Settings 时检查恢复标记
  ↓
有标记则回到 Writing Helper
```

这是一条很完整的“临时离站 → 修改配置 → 返回原工位”的工作流保护链。

### 这一步的定位

**Settings 不是右侧业务面板分支，而是与其并行的全局模态通道；从 Writing Helper 进入时，还带有条件恢复的回程机制。**

## 46. 当前导出链路为什么是“编辑器 JSON 本地序列化”，而不是走后端文档导出服务

这一节对理解系统边界很重要，因为很多人看到“导出 Markdown / HTML”时，会下意识以为是后端把文档导出来了。

当前实现不是。

在现有桌面端里，导出动作发生在 `DocumentEditor` 的状态栏：

`desktop/src/components/DocumentEditor.tsx:90`

```tsx
{editorJson && (
  <>
    <button
      onClick={() => exportToMarkdown(editorJson, title)}
      className="hover:text-primary-500 transition-colors"
    >
      {t.exportMarkdown}
    </button>
    <button
      onClick={() => exportToHtml(editorJson, title)}
      className="hover:text-primary-500 transition-colors"
    >
      {t.exportHtml}
    </button>
  </>
)}
```

这里传进去的不是文档 ID，不是后端路径，也不是 store manager 的句柄，而是：

- `editorJson`
- `title`

这已经足够说明：导出是以前端当前编辑器状态为输入源完成的。

### 46.1 导出的源头为什么是 TipTap JSON

`DocumentEditor` 持有两个核心状态：

`desktop/src/components/DocumentEditor.tsx:17`

```ts
const [editorText, setEditorText] = useState('')
const [editorJson, setEditorJson] = useState<JSONContent | null>(null)
```

其中：

- `editorText` 用来做字数、字符数、阅读时间统计
- `editorJson` 保留结构化编辑器内容，供导出使用

真正更新时，`NikoEditor` 回传的是一对数据：

`desktop/src/components/DocumentEditor.tsx:29`

```ts
const handleEditorUpdate = useCallback((json: JSONContent, text: string) => {
  setEditorJson(json)
  setEditorText(text)
  ...
}, [])
```

所以当前导出链路本质是：

```text
TipTap 编辑器状态
  ↓
onUpdate(json, text)
  ↓
DocumentEditor 持有 editorJson
  ↓
点击导出按钮
  ↓
本地序列化为 Markdown / HTML
```

它依赖的是**当前内存里的编辑器结构化内容**，不是后端持久化文档对象。

### 46.2 Markdown / HTML 是怎么生成的

看导出工具就非常直接：

`desktop/src/utils/export.ts:73`

```ts
export function exportToMarkdown(json: JSONContent, filename?: string): void {
  const md = nodeToMarkdown(json)
  downloadFile(md, (filename || 'document') + '.md', 'text/markdown')
}
```

`desktop/src/utils/export.ts:146`

```ts
export function exportToHtml(json: JSONContent, filename?: string): void {
  const body = nodeToHtml(json)
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  ...
</head>
<body>
${body}
</body>
</html>`
  downloadFile(html, (filename || 'document') + '.html', 'text/html')
}
```

也就是说：

- Markdown 导出 = `nodeToMarkdown(json)`
- HTML 导出 = `nodeToHtml(json)` + 拼完整 HTML 壳

这里的 `nodeToMarkdown` / `nodeToHtml` 都是浏览器端的递归转换器，会按节点类型自行展开：

`desktop/src/utils/export.ts:9`

```ts
function nodeToMarkdown(node: JSONContent): string {
  switch (node.type) {
    case 'doc':
    case 'paragraph':
    case 'heading':
    case 'text':
    case 'bulletList':
    case 'orderedList':
    case 'blockquote':
    case 'codeBlock':
    ...
  }
}
```

这说明当前导出并没有请求任何服务端“转格式”能力，而是直接拿编辑器 AST 在前端做格式投影。

### 46.3 文件为什么能直接下载

真正落盘用的是浏览器下载链：

`desktop/src/utils/export.ts:179`

```ts
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType + ';charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 100)
}
```

整条链路是：

```text
字符串内容
  ↓
Blob
  ↓
ObjectURL
  ↓
临时 <a download>
  ↓
浏览器触发下载
```

所以这是一个标准的**浏览器本地导出**流程。

在 Tauri 环境里，这仍然是前端 WebView 发起的下载动作，而不是 Node/网关侧写文件。

### 46.4 为什么这和后端 store export 不是一回事

代码库里其实确实存在后端导出能力，比如：

`src-ts/store/store-manager.ts`

```ts
exportDocument(
  docId: string,
  outputPath: string,
  normalized: boolean = false
): boolean {
  const doc = this.getDocument(docId);
  if (!doc) return false;
  ...
  writeFileSync(outputPath, content, 'utf-8');
  return true;
}
```

以及：

```ts
exportAll(
  outputDir: string,
  normalized: boolean = false,
  filter?: DocumentFilter | null
): number {
  mkdirSync(outputDir, { recursive: true });
  ...
}
```

这是另一套语义完全不同的导出机制：

- 输入是 `docId`
- 输出路径由后端决定
- 直接 `writeFileSync`
- 面向持久化存储中的文档对象

而桌面编辑器当前这套导出：

- 输入是 `editorJson`
- 在前端内存里就地转换
- 通过 `Blob + download` 给用户下载
- 面向当前正在编辑的 TipTap 内容快照

所以这两者不能混为一谈。

### 46.5 为什么当前要走前端本地导出

从现有实现看，这么做有几个直接好处：

1. 不依赖后端文档 ID 或保存状态
2. 导出内容严格等于用户此刻看到的编辑器内容
3. 不需要等待服务端序列化或写盘
4. Markdown / HTML 转换可以紧贴 TipTap 节点模型实现

它本质上是一种**编辑器视角导出**，不是**文档仓库视角导出**。

前者回答的问题是：

> “把我眼前这篇正在写的内容导出去。”

后者回答的问题是：

> “把系统里已登记的文档对象按某种格式导出去。”

这是两个层次的问题。

### 46.6 从工作流怎么记这条链路

可以记成：

```text
NikoEditor 输出 JSON
  ↓
DocumentEditor 保存 editorJson
  ↓
用户点击 Markdown / HTML
  ↓
export.ts 递归序列化节点树
  ↓
Blob 下载到本地
```

所以“导出”在当前版本里是编辑器工作流的一部分，不是网关服务工作流的一部分。

### 这一步的定位

**当前导出是以前端 TipTap JSON 为源、在浏览器侧递归序列化并下载的本地导出链，而不是后端文档服务导出。**

## 47. AppMainContent、ChatSidebar、AppRightPanels 为什么是三条并行工作流，而不是一个区域的不同标签

这一层如果只从视觉上看，很容易把它理解成：

- 中间是主页面
- 右边是一些可切换标签
- 聊天只是另一个附属抽屉

但 `App.tsx` 的壳层组合已经把真实结构写死了：

`desktop/src/App.tsx:16`

```tsx
<Sidebar {...sidebarProps} />

<AppMainContent {...appMainContentProps} />

<ChatSidebar {...chatSidebarProps} />

<AppRightPanels {...appRightPanelsProps} />
```

这四个区域是**并列挂载**的，不是某个容器里的 tab 子页面。

其中和写作工作流最相关的是后三者：

- `AppMainContent`：主写作通道
- `ChatSidebar`：对话协作通道
- `AppRightPanels`：侧向工具/处理通道

所以理解它们时，不能用“一个区域切不同页”的思路，而要用“同一工作台上三条并行流水线”的思路。

### 47.1 AppMainContent 为什么是主注意力通道

看它的内部结构：

`desktop/src/components/AppMainContent.tsx:17`

```tsx
<main className="flex-1 flex flex-col relative min-w-0 ...">
  <AppHeader {...headerProps} />

  <AppRestoreStatusBanner restoreStatus={restoreStatus} />

  <DocumentEditor onOpenWritingHelper={onOpenWritingHelper} />

  <AppContextFooter contextEstimatedText={contextEstimatedText} />
</main>
```

这里是一个很明确的纵向主链：

```text
Header
  ↓
恢复状态提示
  ↓
正文编辑器
  ↓
上下文/预算反馈
```

也就是说，`AppMainContent` 承担的是用户的**主线创作注意力**：

- 看当前会话与状态
- 处理恢复提醒
- 编辑正文
- 感知上下文预算

它不是“某个可选功能页”，而是整个平台里最核心的 authoring surface。

所以其他区域即使再重要，也是在围绕它协同，而不是替代它。

### 47.2 ChatSidebar 为什么是协作通道，而不是右侧面板的一种

看 `ChatSidebar`：

`desktop/src/components/ChatSidebar.tsx:15`

```tsx
<aside
  className={`${chatSidebarCollapsed ? 'w-0 overflow-hidden' : 'w-[320px]'} ...`}
>
  <ChatArea {...chatAreaProps} />
</aside>
```

这说明聊天区有自己独立的壳层容器、折叠状态和固定宿主组件。

它并没有走：

- `activeRightPanel`
- `closeRightPanel`
- `toggleRightPanel('chat')`

这就说明聊天在结构上不是右侧工具面板的一员。

再结合 `useAppShellViewModel` 的注入方式：

`desktop/src/hooks/useAppShellViewModel.ts:79`

```ts
const chatSidebarProps = {
  chatSidebarCollapsed: uiPersistence.chatSidebarCollapsed,
  onToggleChatSidebar: () => uiPersistence.setChatSidebarCollapsed(!uiPersistence.chatSidebarCollapsed),
  chatAreaProps: {
    onContextUsageChange,
    connectionState: headerViewModel.headerConnectionState,
    isTemplatePanelOpen: panelOrchestration.isTemplatePanelOpen,
    onTemplatePanelOpenChange: panelOrchestration.setIsTemplatePanelOpen,
  }
}
```

可以看到聊天区承接的是另一类职责：

- 对话连接状态映射
- 上下文使用量回传
- Prompt Template Library 的挂载开关
- 与模型交互的连续对话上下文

所以它在工作流里的角色不是“做一个右侧工具”，而是**作为和正文并行存在的协作对话面**。

### 47.3 AppRightPanels 为什么是侧向处理通道

再看 `AppRightPanels`：

`desktop/src/components/AppRightPanels.tsx:18`

```tsx
{activeRightPanel === 'knowledge' && (
  <KnowledgeModal isOpen onClose={closeRightPanel} />
)}

{activeRightPanel === 'evaluation' && (
  <EvaluationPanel
    content={latestAssistantContent}
    onClose={closeRightPanel}
  />
)}

{activeRightPanel === 'writingHelper' && (
  <WritingHelperPanel
    onClose={closeRightPanel}
    onOpenSettings={openSettingsFromWritingHelper}
    draftState={writingHelperDraft}
    onDraftStateChange={setWritingHelperDraft}
    onClearDraft={clearWritingHelperDraft}
  />
)}

{activeRightPanel === 'textOptimizer' && (
  <AiTextOptimizer
    onClose={closeRightPanel}
    onOpenSettings={openSettingsFromWritingHelper}
  />
)}
```

这里承载的东西有共同特征：

- 打开时会占用一个独立侧向工作区
- 一次聚焦一种任务
- 做完后关闭，返回主写作现场
- 更像“处理器”而不是“长期常驻面”

例如：

- Knowledge：查知识
- Evaluation：评估结果
- Writing Helper：批量加工文本
- Text Optimizer：按预设重写/优化

所以 `AppRightPanels` 的工作流语义是：

> 在不离开主编辑面的情况下，打开一个旁路处理器完成某项专项操作。

### 47.4 为什么不能把三者合并成一个 tab 容器

如果把它们做成一个统一 tab 容器，会出现三个问题。

第一，**状态语义会混乱**。

主编辑区、聊天协作区、右侧处理区的生命周期不一样：

- 编辑区应当常驻
- 聊天区可以折叠但保持独立上下文
- 右侧处理区按需出现、按需关闭

第二，**交互路径会变长**。

比如当前用户一边写正文，一边看聊天建议，同时再打开 Writing Helper。现结构允许三者并行可见；如果是 tab，就会变成来回切页。

第三，**职责边界会被打散**。

壳层现在已经把三条线拆得很清楚：

- `AppMainContent` 管主写作
- `ChatSidebar` 管协作对话
- `AppRightPanels` 管专项处理

这比一个超级容器里塞多个标签更容易维护，也更符合真实工作流。

### 47.5 useAppShellViewModel 在这里的真正作用是什么

关键不只是“有三个组件”，而是有一个壳层编排器把三条线协调起来。

在 `useAppShellViewModel` 里，这件事不是抽象概念，而是明确的 props 装配动作：

`desktop/src/hooks/useAppShellViewModel.ts:69`

```ts
const sidebarProps: ComponentProps<typeof Sidebar> = {
  collapsed: uiPersistence.sidebarCollapsed,
  onToggle: () => uiPersistence.setSidebarCollapsed(!uiPersistence.sidebarCollapsed),
  onOpenKnowledge: () => panelOrchestration.toggleRightPanel('knowledge'),
  onOpenPrompts: panelOrchestration.openPrompts,
  onOpenSettings: panelOrchestration.openSettings,
  onOpenEvaluation: () => panelOrchestration.toggleRightPanel('evaluation'),
  onOpenMcpStatus: () => panelOrchestration.toggleRightPanel('mcpStatus'),
}

const appRightPanelsProps: ComponentProps<typeof AppRightPanels> = {
  activeRightPanel: uiPersistence.activeRightPanel,
  settingsOpen: panelOrchestration.settingsOpen,
  latestAssistantContent,
  writingHelperDraft: uiPersistence.writingHelperDraft,
  closeRightPanel: panelOrchestration.closeRightPanel,
  closeSettings: panelOrchestration.closeSettings,
  openSettingsFromWritingHelper: panelOrchestration.openSettingsFromWritingHelper,
  setWritingHelperDraft: uiPersistence.setWritingHelperDraft,
  clearWritingHelperDraft: uiPersistence.clearWritingHelperDraft,
}
```

也就是说，`useAppShellViewModel` 做的不是业务处理本身，而是：

- 给主写作区注入头部、恢复、AI 入口等运行时能力
- 给聊天区注入连接状态、模板库开关、上下文回传能力
- 给右侧处理区注入当前面板类型、草稿状态、关闭/返回能力
- 把“谁打开谁、谁关闭谁、谁共享哪份状态”统一收口

所以这一层的真实价值是：

> 它把“主写作 / 协作对话 / 侧向处理”三条并行工作流装配成一个可协同的壳层系统。

### 这一步的定位

**`AppMainContent`、`ChatSidebar`、`AppRightPanels` 不是一个 tab 容器里的三个页面，而是写作主线、协作对话、旁路处理三条并行流水线；`useAppShellViewModel` 是它们的壳层编排器。**

## 48. WritingHelperPanel、AiTextOptimizer、useEditorAI 为什么是三种不同层级的 AI 能力，而不是同一个功能拆成三个入口

表面上看，这三个地方都能“让 AI 处理文本”，所以最容易产生一个误解：

> 它们只是同一个 AI 功能换了三个入口。

但如果真的去看代码，会发现它们的触发位置、输入形态、输出方式、与编辑器的耦合程度都不一样。

这三者分别对应三种层级：

- `WritingHelperPanel`：面向整段输入的**侧栏批处理层**
- `AiTextOptimizer`：面向固定策略的**预设优化层**
- `useEditorAI`：面向当前光标与选区的**编辑器内联执行层**

### 48.1 WritingHelperPanel 是侧栏批处理层

先看 `WritingHelperPanel` 的状态形态：

`desktop/src/components/WritingHelperPanel.tsx:34`

```ts
interface WritingHelperPanelDraftState {
  content: string
  mode: WritingHelperMode
  maxSentences: number
  maxItems: number
}
```

它一开始就是一个“拿一段文本进来，加一组参数，做一次处理，拿结果出来”的面板模型。

再看它初始化内容的方式：

`desktop/src/components/WritingHelperPanel.tsx:85`

```tsx
const [content, setContent] = useState(() => {
  if (draftState?.content) return draftState.content
  const handle = getEditorHandle()
  if (handle) {
    const selected = handle.getSelectedText()
    if (selected.trim()) return selected
  }
  return ''
})
```

这里说明它虽然会利用编辑器当前选区做预填充，但它的工作模式并不是“贴着编辑器流式生成”，而是：

1. 把内容拿进面板
2. 选择 mode 和风格参数
3. 发起一次完整处理
4. 把结果显示为面板结果
5. 再由用户决定是否插回正文

真正调用时也是一次性请求：

`desktop/src/components/WritingHelperPanel.tsx:299`

```ts
const response = await processWritingHelper({
  content,
  mode,
  max_sentences: maxSentences,
  max_items: maxItems,
  instruction: styleInstruction,
  detection_evasion_guard_enabled: detectionEvasionGuardEnabled,
  ...getProviderFields(),
})
```

所以 `WritingHelperPanel` 在工作流里的定位，是一个**带参数控制、带结果区、可反复试验的批处理工作台**。

### 48.2 AiTextOptimizer 是预设优化层

`AiTextOptimizer` 看起来也处理文本，但它的心智模型不同。

它不是按“摘要 / 扩写 / 列提纲”这种通用写作 mode 组织，而是按预设策略组织：

`desktop/src/components/AiTextOptimizer.tsx:8`

```ts
type OptimizerPreset =
  | 'humanize'
  | 'aiGuide'
  | 'characterNarrative'
  | 'literaryPolish'
  | 'academicPaper'
  | 'custom'
```

而且 instruction 生成是围绕 preset 分派的：

`desktop/src/components/AiTextOptimizer.tsx:61`

```ts
function buildInstruction(
  preset: OptimizerPreset,
  customInstruction: string,
  language: Language,
): string {
  if (preset === 'custom') {
    return customInstruction.trim()
  }

  if (preset === 'humanize') {
    return buildHumanizeInstruction(language)
  }

  if (preset === 'aiGuide') {
    return buildAiGuideInstruction(language)
  }

  if (preset === 'characterNarrative') {
    return buildCharacterNarrativeInstruction(language)
  }
  ...
}
```

这说明它不是一个通用“写作加工器”，而是一个**面向固定改写策略的专项优化器**。

它更像：

- 我要做人类化改写
- 我要做文学润色
- 我要做角色叙事重构
- 我要做学术风格整理

也就是说，`AiTextOptimizer` 的核心不是“让 AI 帮我写”，而是“按一组明确优化意图，对已有文本做策略化重写”。

### 48.3 useEditorAI 是编辑器内联执行层

第三层才是 `useEditorAI`。

它暴露的接口已经说明了一切：

`desktop/src/hooks/useEditorAI.ts:23`

```ts
export interface UseEditorAIReturn {
  isGenerating: boolean
  generateAtCursor: (instruction: string) => Promise<void>
  rewriteSelection: (instruction: string) => Promise<void>
  continueWriting: () => Promise<void>
  cancel: () => void
}
```

这里没有“大面板结果区”这个概念，只有：

- 在光标处生成
- 改写当前选区
- 沿当前位置续写
- 随时取消

这就意味着它的默认宿主不是侧栏，而是编辑器本身。

再看它的执行方式：

`desktop/src/hooks/useEditorAI.ts:118`

```ts
await streamWritingHelper(
  {
    content: prompt,
    mode: 'generate',
    instruction: getStyleInstruction?.() ?? '',
    model: provider?.defaultModel ?? '',
    provider: provider?.id ?? '',
    api_key: provider?.apiKey ?? '',
    base_url: provider?.baseUrl ?? '',
  },
  {
    onContent: (chunk) => {
      streamer.append(chunk)
    },
    onDone: () => {
      streamer.finish()
    },
    onError: (err) => {
      console.error('AI stream error:', err)
    },
  },
  { signal: controller.signal },
)
```

这里走的是流式回写：

- 请求发起后不是等整段结果返回
- 而是边收到 chunk 边 append 到编辑器
- 生成过程发生在当前写作现场内部

所以 `useEditorAI` 对应的是**编辑器级实时 AI 能力**，不是面板级批处理能力。

### 48.4 为什么三者不能合并成一个 AI 面板

如果把这三者强行收敛成同一个入口，反而会让交互和实现都变差。

第一，**输入粒度不同**。

- `WritingHelperPanel` 以整段文本和参数表单为中心
- `AiTextOptimizer` 以预设策略为中心
- `useEditorAI` 以当前光标/选区为中心

第二，**输出节奏不同**。

- `WritingHelperPanel` 倾向一次出完整结果
- `AiTextOptimizer` 倾向一次执行一种预设优化
- `useEditorAI` 倾向边生成边写回

第三，**宿主位置不同**。

- `WritingHelperPanel` 属于右侧处理区
- `AiTextOptimizer` 也属于右侧处理区，但语义是专项优化器
- `useEditorAI` 属于编辑器内部，是正文写作过程的一部分

第四，**用户心智不同**。

用户打开 `WritingHelperPanel` 时，通常是在想“我拿一段内容给你处理”；
用户打开 `AiTextOptimizer` 时，通常是在想“我想套一个优化策略”；
用户触发 `useEditorAI` 时，通常是在想“就在这里帮我继续写 / 改这一段”。

这三种心智模型不一样，所以入口分离是合理的。

### 48.5 Header AI Toolbar 为什么只是路由，不直接执行

这一点在 `AiToolbar` 和 `useAppShellViewModel` 的配合里尤其明显。

`AiToolbar` 自己不持有内容，不调用 API，也不维护生成状态。

它只是把一组意图按钮暴露出来：

`desktop/src/components/AiToolbar.tsx:22`

```tsx
const tools = [
  { label: t.aiToolWrite, icon: <PenLine size={14} />, action: onWrite },
  { label: t.aiToolRewrite, icon: <RefreshCw size={14} />, action: onRewrite },
  { label: t.aiToolDescribe, icon: <MessageSquareText size={14} />, action: onDescribe },
  { label: t.aiToolBrainstorm, icon: <Lightbulb size={14} />, action: onBrainstorm },
]

const extendedTools = [
  { label: t.sidebarWritingHelper, icon: <Wand2 size={14} />, action: onOpenWritingHelper },
  { label: t.sidebarTextOptimizer, icon: <Shield size={14} />, action: onOpenTextOptimizer },
]
```

真正的动作语义是在壳层里定义的：

`desktop/src/hooks/useAppShellViewModel.ts:112`

```ts
onAiWrite: () => {
  uiPersistence.setWritingHelperDraft({ ...uiPersistence.writingHelperDraft, mode: 'polish' })
  panelOrchestration.toggleRightPanel('writingHelper')
},
onAiRewrite: () => {
  uiPersistence.setWritingHelperDraft({ ...uiPersistence.writingHelperDraft, mode: 'rewrite' })
  panelOrchestration.toggleRightPanel('writingHelper')
},
onAiDescribe: () => {
  uiPersistence.setWritingHelperDraft({ ...uiPersistence.writingHelperDraft, mode: 'expand' })
  panelOrchestration.toggleRightPanel('writingHelper')
},
onAiBrainstorm: () => {
  uiPersistence.setWritingHelperDraft({ ...uiPersistence.writingHelperDraft, mode: 'outline' })
  panelOrchestration.toggleRightPanel('writingHelper')
},
onOpenWritingHelper: () => panelOrchestration.toggleRightPanel('writingHelper'),
onOpenTextOptimizer: () => panelOrchestration.toggleRightPanel('textOptimizer'),
```

也就是说，Header 上这些 AI 按钮本质上不是执行器，而是：

- 把用户意图翻译成某个 processing mode
- 预先写入一份 draft state
- 再把用户送到对应的处理宿主

所以它更像一个**AI 意图路由器**，不是 AI 引擎本身。

### 这一步的定位

**`WritingHelperPanel`、`AiTextOptimizer`、`useEditorAI` 分别代表侧栏批处理、预设优化、编辑器内联执行三种不同层级的 AI 能力；Header 的 AI Toolbar 负责做意图路由，而不直接承担执行。**

## 49. StoryBiblePanel 为什么是正文写作的支撑层，而不是一个独立知识系统

如果只看名字，很容易把 `StoryBiblePanel` 理解成一个“世界观资料库”或者“知识库模块”。

但当前实现并不是一个独立知识产品，而是一个贴着正文编辑器工作的**写作支撑层**。

它的位置就已经说明了一部分问题。

在 `DocumentEditor` 里，它不是挂在侧边栏，也不是挂在右侧处理面板，而是直接出现在编辑器工作流内部。

这意味着它的角色不是把用户带离写作现场，而是在写作现场旁边提供支撑信息和前期构思承载。

### 49.1 StoryBiblePanel 的状态首先是“本地写作草稿状态”

看它最核心的状态初始化：

`desktop/src/components/StoryBiblePanel.tsx:85`

```tsx
const [braindump, setBraindump] = useState(() => loadFromStorage('niko.sb-braindump-v1'))
const [genres, setGenres] = useState<string[]>(() => {
  const raw = loadFromStorage('niko.sb-genres-v1')
  return raw ? raw.split(',').filter(Boolean) : []
})
const [synopsis, setSynopsis] = useState(() => loadFromStorage('niko.sb-synopsis-v1'))
const [outline, setOutline] = useState(() => loadFromStorage('niko.sb-outline-v1'))
```

这里最重要的信号是：

- 头脑风暴
- 类型标签
- 简介
- 大纲

这些都先落在 localStorage，而不是远端数据库。

这说明当前版本里，Story Bible 的第一职责不是“作为团队共享知识库管理事实”，而是“承接作者自己的临时构思和写作上下文”。

也就是说，它优先解决的是：

> 我在写这篇内容时，需要一个不离开当前文档的构思承载区。

### 49.2 它会读图谱，但图谱读取是辅助增强，不是主工作流

`StoryBiblePanel` 也不是纯本地表单，因为它会查询图谱：

`desktop/src/components/StoryBiblePanel.tsx:132`

```tsx
const [charResult, locResult] = await Promise.allSettled([
  queryGraph('MATCH (c:Character) RETURN c LIMIT 50'),
  queryGraph('MATCH (l:Location) RETURN l LIMIT 50'),
])
```

然后把结果转成展示卡片：

`desktop/src/components/StoryBiblePanel.tsx:138`

```tsx
if (charResult.status === 'fulfilled' && charResult.value.data) {
  setCharacters(toGraphItems(charResult.value.data, 'c'))
}
if (locResult.status === 'fulfilled' && locResult.value.data) {
  setLocations(toGraphItems(locResult.value.data, 'l'))
}
```

但这里它的处理方式是 `Promise.allSettled`，而且失败时直接 graceful degradation：

`desktop/src/components/StoryBiblePanel.tsx:144`

```tsx
} catch {
  // Graceful degradation
} finally {
  if (!cancelled) setLoading(false)
}
```

这恰恰说明图谱不是它的唯一依赖。

如果图谱查询失败，Story Bible 不会整体瘫痪，作者仍然可以继续：

- 写 braindump
- 选 genre
- 写 synopsis
- 写 outline
- 选择 style

所以图谱在这里更准确的角色是：

- 给角色和地点提供辅助参考
- 让已有结构化知识能回流到写作现场
- 但不控制主写作流程是否可继续

### 49.3 StoryBiblePanel 为什么不等于 Knowledge 面板

这一点要和右侧的 Knowledge 能力区分开。

`Knowledge` 属于 `AppRightPanels`，语义是“打开一个独立的旁路处理/查询面板”；
而 `StoryBiblePanel` 属于 `DocumentEditor` 内部，语义是“在正文写作过程中持续陪伴的支撑层”。

它们的区别可以概括成：

- `Knowledge`：像去资料库查资料
- `StoryBiblePanel`：像在写字桌旁铺开的设定纸和人物卡

所以后者更贴近作者的连续创作动作，而不是一次性查询动作。

### 49.4 为什么它必须放在编辑器工作流内部

如果把 Story Bible 挪成独立知识系统，会损失两个关键价值。

第一，**上下文切换成本会变高**。

当前结构下，用户写正文时就能顺手补：

- 灵感碎片
- 题材标签
- 一句话简介
- 章节大纲
- 风格偏好

第二，**构思和写作会被拆成两个割裂阶段**。

但真实创作不是先把设定系统完整填完再开始写，而是边写边补、边补边改。

`StoryBiblePanel` 放在正文工作流内部，正是为了适配这种“构思与写作交错发生”的过程。

### 这一步的定位

**`StoryBiblePanel` 当前不是独立知识系统，而是嵌在正文编辑流程里的写作支撑层：本地构思状态是主体，图谱查询是增强。**

## 50. useAppViewModel 为什么是总装配层，而不是普通工具 Hook

如果只看名字，`useAppViewModel` 很容易被误解成“把一些状态包一包”。

但实际代码里，它承担的是整个应用壳层的总装配工作。

`desktop/src/hooks/useAppViewModel.ts:11`

```ts
export function useAppViewModel() {
  const { backendStatus, checkBackend } = useAppStore()
  const uiPersistence = useAppUiPersistence()
  const latestAssistantContent = useLatestAssistantMessageContent()
  const contextUsageView = useAppContextUsage()
  const runtimeView = useAppRuntimeHealth({ backendStatus, checkBackend })
  const { t } = useI18n()

  const panelOrchestration = useAppPanelOrchestration({
    setActiveRightPanel: uiPersistence.setActiveRightPanel,
  })

  const checkpointMenu = useAppCheckpointMenu({
    restoreFailedText: t.restoreFailed,
    restoreSuccessText: t.restoreSuccess,
  })

  const headerViewModel = useAppHeaderViewModel({
    runtimeView,
    backendStatus,
    t,
    contextUsage: contextUsageView.contextUsage,
  })

  return useAppShellViewModel({
    uiPersistence,
    panelOrchestration,
    latestAssistantContent,
    t,
    headerViewModel,
    checkpointMenu,
    onContextUsageChange: contextUsageView.handleContextUsageChange,
  })
}
```

这里不是单一功能 Hook，而是一个很清楚的分层装配管线：

```text
Store / Runtime / Persistence / I18n
  ↓
专项 View Hooks
  ↓
useAppViewModel 总装配
  ↓
useAppShellViewModel 壳层 props 输出
  ↓
App.tsx 四区挂载
```

### 50.1 它把不同来源的状态统一收口

这层拿到的状态来源并不单一：

- `useAppStore()`：全局运行状态与后端状态
- `useAppUiPersistence()`：UI 持久化状态
- `useLatestAssistantMessageContent()`：最近助手输出
- `useAppContextUsage()`：上下文预算
- `useAppRuntimeHealth()`：运行健康投影
- `useI18n()`：文案系统

也就是说，它做的不是“封装一个局部交互”，而是把**来自不同域的数据源统一拉平**。

### 50.2 它负责把专项能力拼成壳层可消费结构

再往下看，它还会把一批专项 Hook 的输出继续组合：

- `useAppPanelOrchestration()`：面板切换与设置入口编排
- `useAppCheckpointMenu()`：检查点菜单与恢复交互
- `useAppHeaderViewModel()`：把 runtime / context usage 转成 Header 所需投影

这些能力本来分散在不同域里，但 `useAppViewModel` 把它们整理成一个可交给 shell 的统一输入。

这意味着它不属于“某个功能模块内部”，而是站在应用壳层视角做总装配。

### 50.3 为什么还要再经过 useAppShellViewModel

很多人看到这里会问：既然 `useAppViewModel` 已经在组合数据，为什么还要再过一层 `useAppShellViewModel`？

原因是两层抽象的职责不一样。

- `useAppViewModel` 负责**汇总应用级来源与专项能力**
- `useAppShellViewModel` 负责**把这些输入翻译成具体组件 props**

前者更像“总装配车间”，后者更像“最终对接接口层”。

这让代码能维持两个清晰边界：

1. 应用视角的能力收集
2. 壳层视角的组件装配

### 50.4 这对写作工作流意味着什么

对于写作工作流来说，这种分层最重要的价值是：

- 写作状态
- 聊天协作状态
- 右侧处理状态
- 连接健康状态
- 上下文预算状态
- 检查点恢复状态

不会直接散落在 `App.tsx` 里彼此耦合。

而是先由 `useAppViewModel` 做统一收口，再由 `useAppShellViewModel` 发配到不同工作流通道。

所以这个应用不是“组件各自拉状态自顾自跑”，而是一个明显经过壳层编排的工作台。

### 这一步的定位

**`useAppViewModel` 不是普通工具 Hook，而是把全局状态、运行时状态、UI 持久化状态和专项交互能力总装配后，再交给壳层输出的应用级编排层。**

## 51. AppHeader 与 AiToolbar 为什么是意图入口层，而不是执行层

很多桌面写作工具都会把顶部工具栏做成“点一下直接执行某个功能”。

但 Niko-Studio 当前的 Header 不是这样设计的。

它更像一个把全局状态、协作状态和 AI 意图汇总后暴露给用户的**入口层**。

### 51.1 AppHeader 自己并不拥有核心业务状态

先看 `AppHeader` 的 props：

`desktop/src/components/AppHeader.tsx:14`

```tsx
interface AppHeaderProps {
  appTitle: string
  contextUsageLabel: string
  contextUsageText: string
  contextUsageBarClass: string
  contextUsageWidthPercent: number
  headerDotClass: string
  headerConnectionText: string
  checkpointLabel: string
  ...
  onAiWrite: () => void
  onAiRewrite: () => void
  onAiDescribe: () => void
  onAiBrainstorm: () => void
  onOpenWritingHelper: () => void
  onOpenTextOptimizer: () => void
}
```

这说明 Header 本身不维护：

- AI 处理内容
- 面板开关状态源
- 聊天连接状态源
- 检查点数据源

它拿到的都是已经投影好的展示数据和回调动作。

也就是说，Header 是壳层最终展示面，不是业务源头。

### 51.2 它承接的是“全局可见信号”

看 `AppMainContent` 对它的放置方式：

`desktop/src/components/AppMainContent.tsx:23`

```tsx
<AppHeader {...headerProps} />
```

Header 处在主写作通道最上方，所以它天然承接的是整个工作台里最应该被立即看见的东西：

- 连接状态
- 上下文预算
- 检查点入口
- AI 操作入口
- 聊天侧栏开关

这些都属于“全局控制与全局反馈”，而不是正文内部逻辑。

### 51.3 AiToolbar 只是把意图分发出去

再看 Header 中最容易被误解的一层：`AiToolbar`。

在 `AppHeader` 内部，它只是被挂载出来：

`desktop/src/components/AppHeader.tsx:118`

```tsx
<AiToolbar
  disabled={aiToolbarDisabled}
  onWrite={onAiWrite}
  onRewrite={onAiRewrite}
  onDescribe={onAiDescribe}
  onBrainstorm={onAiBrainstorm}
  onOpenWritingHelper={onOpenWritingHelper}
  onOpenTextOptimizer={onOpenTextOptimizer}
/>
```

而 `AiToolbar` 自身只是把回调映射成按钮：

`desktop/src/components/AiToolbar.tsx:22`

```tsx
const tools = [
  { label: t.aiToolWrite, icon: <PenLine size={14} />, action: onWrite },
  { label: t.aiToolRewrite, icon: <RefreshCw size={14} />, action: onRewrite },
  { label: t.aiToolDescribe, icon: <MessageSquareText size={14} />, action: onDescribe },
  { label: t.aiToolBrainstorm, icon: <Lightbulb size={14} />, action: onBrainstorm },
]
```

这说明它的真实职责只有一件事：

> 把“用户此刻想做哪类 AI 操作”这个意图，分发给上层壳层编排器。

它既不取正文，也不发请求，也不决定结果如何回写。

### 51.4 真正执行发生在 Header 之外

真正的语义翻译发生在 `useAppShellViewModel`：

- `onAiWrite` → 预置 `mode: 'polish'` 并打开 `writingHelper`
- `onAiRewrite` → 预置 `mode: 'rewrite'` 并打开 `writingHelper`
- `onAiDescribe` → 预置 `mode: 'expand'` 并打开 `writingHelper`
- `onAiBrainstorm` → 预置 `mode: 'outline'` 并打开 `writingHelper`
- `onOpenTextOptimizer` → 直接切到 `textOptimizer`

所以顶部工具栏的本质不是“AI 在这里执行”，而是“用户在这里声明下一步处理意图”。

这让 Header 保持很轻：

- 不耦合具体处理逻辑
- 不依赖文本处理 API
- 不绑定某一个 AI 宿主实现
- 可以把同一意图路由到不同处理面板

### 51.5 为什么这种入口层设计更适合当前写作工作台

因为当前产品不是单一编辑器，而是一个多通道工作台。

在这样的结构里，Header 最适合承担的是：

- 统一入口
- 状态可视化
- 意图路由
- 全局切换

而不是直接变成某个具体功能的重逻辑宿主。

这也是为什么真正的执行逻辑会被拆到：

- `WritingHelperPanel`
- `AiTextOptimizer`
- `useEditorAI`
- 聊天区相关能力

Header 只负责把用户送到正确的执行现场。

### 这一步的定位

**`AppHeader` 是主写作通道顶部的全局信号与入口层，`AiToolbar` 是 AI 意图路由器；真正的文本处理执行发生在 Header 之外的具体宿主里。**

## 52. useAppUiPersistence 为什么保存的不是“界面样式”，而是工作流现场

如果只从名字看，`useAppUiPersistence` 很容易被理解成一个“记住折叠状态的小工具 Hook”。

但代码里它保存的并不只是视觉偏好，而是当前写作工作台的**现场态**。

先看它维护的核心状态：

`desktop/src/hooks/useAppUiPersistence.ts:99`

```ts
export function useAppUiPersistence() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => loadSidebarCollapsed())
  const [chatSidebarCollapsed, setChatSidebarCollapsed] = useState(() => loadChatSidebarCollapsed())
  const [activeRightPanel, setActiveRightPanel] = useState<RightPanelType>(() => loadActiveRightPanel())
  const [writingHelperDraft, setWritingHelperDraft] = useState<WritingHelperDraftState>(() => loadWritingHelperDraft())
```

这四项里，只有前两项比较像普通 UI 偏好；后两项已经明显进入工作流层了：

- `activeRightPanel`：用户上次停留在哪个旁路处理现场
- `writingHelperDraft`：用户上次正在加工哪段文本、用什么 mode、限制多少句/多少项

这不是单纯的“界面长什么样”，而是“我上次写作写到哪里、处理做到哪里”。

### 52.1 writingHelperDraft 保存的是处理中间态，而不是结果态

`WritingHelperDraftState` 的结构非常关键：

`desktop/src/hooks/useAppUiPersistence.ts:5`

```ts
export interface WritingHelperDraftState {
  content: string
  mode: WritingHelperMode
  maxSentences: number
  maxItems: number
}
```

它保存的不是 AI 返回结果，也不是文档正文，而是：

- 待处理内容
- 处理模式
- 输出边界条件

这说明当前系统把 Writing Helper 看作一个可中断、可恢复的处理过程。

也就是说，持久化的重点不是“保存答案”，而是“保存处理现场的输入上下文”。

### 52.2 localStorage 在这里承担的是会话续接能力

再看写回逻辑：

`desktop/src/hooks/useAppUiPersistence.ts:105`

```ts
useEffect(() => {
  try {
    localStorage.setItem(WRITING_HELPER_DRAFT_STORAGE_KEY, JSON.stringify(writingHelperDraft))
  } catch {
    // ignore localStorage write failures
  }
}, [writingHelperDraft])
```

以及右侧面板状态：

`desktop/src/hooks/useAppUiPersistence.ts:121`

```ts
useEffect(() => {
  try {
    localStorage.setItem(ACTIVE_RIGHT_PANEL_STORAGE_KEY, activeRightPanel)
  } catch {
    // ignore localStorage write failures
  }
}, [activeRightPanel])
```

这意味着刷新页面或重开桌面端后，系统会尽量把用户带回原先的工作台状态，而不是每次都从完全空白开始。

所以 localStorage 在这里不是简单配置缓存，而是一个轻量级的**工作流续接层**。

### 52.3 为什么连 activeRightPanel 都要持久化

这一点很容易被忽视。

如果只把右侧面板当作临时抽屉，那么 `activeRightPanel` 没必要保存。

但当前设计选择持久化它，说明产品假设是：

- 用户的处理动作可能跨时段中断
- 右侧面板不是瞬时 tooltip，而是一个真正的工作现场
- 恢复现场时，应该连“我当时开的是什么处理器”一起恢复

这和前面提到的 `WritingHelperDraft` 一起，构成了一个完整的“旁路处理现场快照”。

### 52.4 clearWritingHelperDraft 为什么要同时清内存和存储

这也能看出它不是普通表单。

`desktop/src/hooks/useAppUiPersistence.ts:137`

```ts
const clearWritingHelperDraft = useCallback(() => {
  clearWritingHelperDraftStorage()
  setWritingHelperDraft(DEFAULT_WRITING_HELPER_DRAFT)
}, [])
```

这里不是只 `setState`，而是同时：

- 清 localStorage
- 重置内存态

因为如果只清内存不清持久化，下次恢复现场时就会把旧的处理中间态又带回来。

所以这个清理动作，本质上是在告诉系统：

> 这段处理现场已经结束，不需要再恢复它。

### 52.5 这对写作工作流的意义是什么

这层设计让 Niko-Studio 的壳层不是一次性 UI，而是一个有延续性的工作台。

它持久化的并不是漂亮程度，而是用户当时的工作位置：

- 左侧是否收起
- 聊天协作是否展开
- 右侧正在开什么处理器
- Writing Helper 正在加工什么内容

所以 `useAppUiPersistence` 的真实作用，是把“界面状态”提升成“工作流现场状态”。

### 这一步的定位

**`useAppUiPersistence` 持久化的不是单纯视觉偏好，而是写作工作台的现场：侧栏开合、右侧处理器位置、以及 Writing Helper 的处理中间态。**

## 53. useAppPanelOrchestration 为什么是在编排通道切换，而不是简单控制弹窗

如果只扫一眼函数名，`useAppPanelOrchestration` 好像只是：

- 打开设置
- 关闭设置
- 打开右侧面板
- 打开模板面板

但真正看代码会发现，它在处理的是**不同工作通道之间的切换规则**。

`desktop/src/hooks/useAppPanelOrchestration.ts:7`

```ts
export function useAppPanelOrchestration({ setActiveRightPanel }: UseAppPanelOrchestrationOptions) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isTemplatePanelOpen, setIsTemplatePanelOpen] = useState(false)
  const [resumeWritingHelperAfterSettings, setResumeWritingHelperAfterSettings] = useState(false)
```

这里同时管理的不是一种面板，而是三种不同语义的宿主：

- 右侧处理面板
- Settings 模态层
- Chat 内部的模板面板

所以它本质上是在做“不同通道之间如何互斥、切换、返回”的编排。

### 53.1 toggleRightPanel 做的不是显示隐藏，而是侧向处理通道切换

`desktop/src/hooks/useAppPanelOrchestration.ts:16`

```ts
const toggleRightPanel = useCallback((panel: Exclude<RightPanelType, 'none'>) => {
  setIsTemplatePanelOpen(false)
  setActiveRightPanel((prev) => (prev === panel ? 'none' : panel))
}, [setActiveRightPanel])
```

这里有两个关键动作：

1. 先关闭模板面板
2. 再切换右侧处理面板

这说明系统不把 Prompt Template Library 和 Right Panel 视为两个可以随意叠加的层，而是认为它们属于两种不同的交互焦点。

也就是说，打开右侧处理通道时，会主动清掉 Chat 输入侧的模板覆盖层，避免两个“辅助层”同时抢焦点。

### 53.2 openPrompts 的本质是把焦点切回 Chat 协作通道

`desktop/src/hooks/useAppPanelOrchestration.ts:25`

```ts
const openPrompts = useCallback(() => {
  setActiveRightPanel('none')
  setIsTemplatePanelOpen(true)
}, [setActiveRightPanel])
```

这段代码尤其能说明问题。

它不是简单地“再打开一个模板窗口”，而是：

- 先把右侧处理通道清空
- 再把模板面板挂到 Chat 通道里

这说明 Prompt Template Library 的真实宿主是 ChatArea，而不是全局 modal。

因此 `openPrompts` 的语义不是“开一个工具”，而是“把当前工作焦点切回对话协作通道，并进入模板注入模式”。

### 53.3 openSettingsFromWritingHelper 处理的是“离开后再回来”

这一段更能看出它是工作流编排，而不是普通弹窗控制。

`desktop/src/hooks/useAppPanelOrchestration.ts:38`

```ts
const openSettingsFromWritingHelper = useCallback(() => {
  setResumeWritingHelperAfterSettings(true)
  setActiveRightPanel('none')
  setSettingsOpen(true)
}, [setActiveRightPanel])
```

配合关闭设置时的逻辑：

`desktop/src/hooks/useAppPanelOrchestration.ts:30`

```ts
const closeSettings = useCallback(() => {
  setSettingsOpen(false)
  if (resumeWritingHelperAfterSettings) {
    setActiveRightPanel('writingHelper')
    setResumeWritingHelperAfterSettings(false)
  }
}, [resumeWritingHelperAfterSettings, setActiveRightPanel])
```

这整套逻辑表达的是：

- 我当前在 Writing Helper 工作
- 中途需要去 Settings 调配置
- 离开时先把原面板收起
- 设置完成后自动回到 Writing Helper

这已经不是弹窗开关了，而是一个标准的**通道跳转 + 返回原现场**模型。

### 53.4 为什么这一层很关键

因为这个应用里不是所有工具都挂在同一个宿主上：

- Settings 是模态层
- Prompt Template Library 在 Chat 区
- Writing Helper / Text Optimizer / Knowledge 在右侧处理区

如果没有 `useAppPanelOrchestration` 这层，切换逻辑就会散落在各个组件里，最后会出现：

- 谁都能随便开别人的面板
- 焦点互斥关系不清晰
- 从一个工作现场跳去另一个现场后无法正确返回

现在这一层把这些通道切换规则集中起来了。

### 这一步的定位

**`useAppPanelOrchestration` 不是简单控制弹窗，而是在编排 Chat 模板层、右侧处理层、Settings 模态层之间的焦点切换、互斥关系和返回路径。**

## 54. checkpoint / restore 为什么是恢复通道，而不是普通下拉菜单

很多 UI 里，下拉菜单只是列几个动作项。

但这里的 checkpoint 菜单不是普通操作列表，而是写作工作流里的**恢复通道入口**。

先看它的数据和状态结构：

`desktop/src/hooks/useAppCheckpointMenu.ts:19`

```ts
export function useAppCheckpointMenu({ restoreFailedText, restoreSuccessText }: UseAppCheckpointMenuOptions) {
  const [checkpointMenuOpen, setCheckpointMenuOpen] = useState(false)
  const checkpointMenuContainerRef = useRef<HTMLDivElement | null>(null)
  const [checkpointsLoading, setCheckpointsLoading] = useState(false)
  const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>([])
  const [restoreStatus, setRestoreStatus] = useState<RestoreStatus | null>(null)
```

这里除了开关状态，还有：

- 远端检查点列表
- 加载状态
- 恢复结果状态

这已经不是普通菜单的复杂度，而是一个小型恢复流程状态机。

### 54.1 打开菜单时会主动取 checkpoint 列表

`desktop/src/hooks/useAppCheckpointMenu.ts:76`

```ts
const handleToggleCheckpointMenu = async () => {
  const nextOpen = !checkpointMenuOpen
  setCheckpointMenuOpen(nextOpen)
  if (nextOpen) {
    await refreshCheckpoints()
  }
}
```

也就是说，打开它不是只展示本地固定选项，而是触发一次实时拉取。

这说明菜单承载的是“可恢复历史现场”的实时视图，而不是写死在前端的命令集合。

### 54.2 restoreCheckpoint 才是它真正的核心动作

`desktop/src/hooks/useAppCheckpointMenu.ts:84`

```ts
const handleRestoreCheckpoint = async (checkpointId: string) => {
  try {
    const response = await restoreCheckpoint(checkpointId)
    if (response.success) {
      setRestoreStatus({ type: 'success', message: restoreSuccessText })
      setCheckpointMenuOpen(false)
    } else {
      setRestoreStatus({ type: 'error', message: response.error || restoreFailedText })
    }
  } catch {
    setRestoreStatus({ type: 'error', message: restoreFailedText })
  }
}
```

这里的目标不是执行一个即时功能，而是把当前工作台切换回某个历史 checkpoint 所代表的状态。

所以这个入口的真正含义是：

> 允许作者回到之前某个写作现场，而不只是点一个菜单项执行命令。

### 54.3 restoreStatus 说明恢复是一个独立反馈通道

还有一个很关键的点：恢复结果不会只停留在菜单里。

`restoreStatus` 会在成功或失败后保留一小段时间：

`desktop/src/hooks/useAppCheckpointMenu.ts:26`

```ts
useEffect(() => {
  if (!restoreStatus) return

  const timer = setTimeout(() => setRestoreStatus(null), 2500)
  return () => clearTimeout(timer)
}, [restoreStatus])
```

而在 `AppMainContent` 里，Header 下方还单独挂了：

`desktop/src/components/AppMainContent.tsx:24`

```tsx
<AppRestoreStatusBanner restoreStatus={restoreStatus} />
```

这说明恢复反馈不是菜单内部的小提示，而是主写作通道里的全局反馈信号。

也就是说，checkpoint 菜单只是恢复动作入口，真正的恢复结果会回流到主工作面通知用户。

### 54.4 为什么这属于写作恢复通道

写作工具里，“恢复到某个 checkpoint”不是普通辅助功能，而是连续创作安全感的一部分。

它解决的是：

- 我能否回退到之前的稳定状态
- 我试验性修改后能否安全恢复
- AI 或编辑动作之后，我能否找回历史版本节点

因此它在工作流中的地位更接近“版本恢复通道”，而不是一个普通 dropdown。

### 这一步的定位

**checkpoint 菜单当前不是普通下拉菜单，而是写作工作流里的恢复入口：打开时实时拉取历史节点，恢复结果再通过主通道的状态横幅反馈给用户。**

## 55. Sidebar、Header、Right Panel 之间的事件流为什么是单向分发，而不是彼此直接调用

从用户视角看，很多动作像是组件之间互相联动：

- 点 Sidebar 的“知识库”会打开右侧 Knowledge
- 点 Header 的 AI 按钮会打开 Writing Helper
- 点 Writing Helper 里的设置会打开 Settings，再回到 Writing Helper

表面像是组件彼此在通信，但代码结构不是这么设计的。

它采用的是一种比较清楚的**单向分发流**：

```text
UI 组件触发事件
  ↓
回调进入 shell view model / orchestration
  ↓
状态改变
  ↓
对应宿主区域重新渲染
```

### 55.1 Sidebar 不直接操作右侧面板实例

`Sidebar` 收到的只是回调：

`desktop/src/components/Sidebar.tsx:7`

```tsx
interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  onOpenKnowledge: () => void
  onOpenPrompts: () => void
  onOpenSettings: () => void
  onOpenEvaluation: () => void
  onOpenMcpStatus: () => void
}
```

比如点击 Knowledge：

`desktop/src/components/Sidebar.tsx:219`

```tsx
<button
  onClick={onOpenKnowledge}
  ...
>
```

但这个组件本身不知道 `KnowledgeModal` 在哪里，也不知道右侧面板如何挂载。

真正动作是在 `useAppShellViewModel` 里绑定的：

`desktop/src/hooks/useAppShellViewModel.ts:69`

```ts
const sidebarProps: ComponentProps<typeof Sidebar> = {
  ...
  onOpenKnowledge: () => panelOrchestration.toggleRightPanel('knowledge'),
  onOpenPrompts: panelOrchestration.openPrompts,
  onOpenSettings: panelOrchestration.openSettings,
  onOpenEvaluation: () => panelOrchestration.toggleRightPanel('evaluation'),
  onOpenMcpStatus: () => panelOrchestration.toggleRightPanel('mcpStatus'),
}
```

也就是说，Sidebar 只发出意图，不直接调用目标组件。

### 55.2 Header 也是同样的单向路由

Header 的 AI 行为同样没有直接碰具体执行器。

它拿到的是：

- `onAiWrite`
- `onAiRewrite`
- `onAiDescribe`
- `onAiBrainstorm`
- `onOpenWritingHelper`
- `onOpenTextOptimizer`

这些在 Header 内部再转给 `AiToolbar`，而真正的副作用发生在更外层的 orchestration / shell binding。

所以 Header 和 Sidebar 一样，都属于“发出意图事件”的入口组件。

### 55.3 Right Panel 的打开不是被直接调用，而是被状态选中

`AppRightPanels` 的渲染方式很关键：

`desktop/src/components/AppRightPanels.tsx:9`

```tsx
interface AppRightPanelsProps {
  activeRightPanel: RightPanelType
  settingsOpen: boolean
  latestAssistantContent: string
  writingHelperDraft: WritingHelperDraftState
  ...
}
```

它不是被谁 `openWritingHelperPanel()` 直接调用，而是根据 `activeRightPanel` 决定显示哪个宿主。

这意味着事件流不是：

```text
Sidebar -> 直接调用 WritingHelperPanel.open()
```

而是：

```text
Sidebar click
  ↓
setActiveRightPanel('writingHelper')
  ↓
AppRightPanels 根据 activeRightPanel 渲染 WritingHelperPanel
```

这是典型的状态驱动挂载，而不是组件互调。

### 55.4 为什么这种单向流更适合当前壳层结构

因为这里有多个并行区域：

- Sidebar
- MainContent/Header
- ChatSidebar
- RightPanels
- Settings modal

如果它们彼此直接引用和调用，很快就会出现跨区域耦合：

- Sidebar 知道右侧面板内部细节
- Header 知道 Writing Helper 的实现细节
- Writing Helper 知道 Settings 的展示细节

现在这套结构把它们都隔开了：

- 组件只负责发事件
- shell / orchestration 负责翻译事件
- 状态变化负责选择宿主

所以每个区域都只需要知道“我发什么意图”，不需要知道“别人怎么实现”。

### 55.5 这对文档理解很重要

理解这一点后，整个 Niko-Studio 的工作台结构会清楚很多。

它不是一堆组件互相调用形成的网状结构，而是：

- 上层 ViewModel 收口
- 中层 orchestration 分发
- 下层宿主区域按状态渲染

因此你在读代码时，如果看到“点击这里为什么那里会开”，不要先找两个组件的直接引用关系，而要先找：

- 这个组件收到的 callback 来自哪里
- 这个 callback 最终改了哪个 state
- 哪个宿主组件在消费这个 state

### 这一步的定位

**Sidebar、Header、Right Panel 之间不是彼此直接调用，而是通过 shell view model 和 orchestration 做单向事件分发，再由状态驱动对应宿主区域重渲染。**
`desktop/src/hooks/useAppShellViewModel.ts:14`

## 56. 程序真正的起点为什么不是某个面板，而是 `main.tsx -> App -> useAppStartup`

如果只盯着 `Sidebar`、`DocumentEditor`、`ChatSidebar` 这些可见界面，很容易误以为 Niko-Studio 是“某个主页面组件负责一切”。

真实入口更底层。

前端真正的根起点是：`desktop/src/main.tsx:6`

```tsx
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

这一步只做一件事：把 `App` 挂到根节点。

也就是说：

- `main.tsx` 不处理业务
- `main.tsx` 不拼工作流
- `main.tsx` 只负责建立 React 根

真正进入工作台装配的是 `App`：`desktop/src/App.tsx:11`

```tsx
function App() {
  const { sidebarProps, appRightPanelsProps, appMainContentProps, chatSidebarProps } = useAppViewModel()
  const { toasts, removeToast } = useToast()

  useAppStartup()

  return (
    <ErrorBoundary>
      <div className="flex h-screen ...">
        <Sidebar {...sidebarProps} />
        <AppMainContent {...appMainContentProps} />
        <ChatSidebar {...chatSidebarProps} />
        <AppRightPanels {...appRightPanelsProps} />
      </div>
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ErrorBoundary>
  )
}
```

这里能看出三件关键事实。

### 56.1 `App` 不是业务实现层，而是根装配层

`App` 自己并不直接写：

- 对话逻辑
- 编辑器逻辑
- 右侧面板逻辑
- 启动网关逻辑

它做的是三类根动作：

1. 取整套视图模型：`useAppViewModel()`，见 `desktop/src/App.tsx:12`
2. 执行启动副作用：`useAppStartup()`，见 `desktop/src/App.tsx:15`
3. 挂出四块工作台骨架，见 `desktop/src/App.tsx:19-26`

所以 `App` 更像工作台总入口，而不是某个具体功能页。

### 56.2 真正的“启动动作”并不写在 JSX 里，而是被抽到 hook

`App` 里的启动动作只有一行：`desktop/src/App.tsx:15`

```ts
useAppStartup()
```

而 `useAppStartup` 本身非常薄：`desktop/src/hooks/useAppStartup.ts:4`

```ts
export function useAppStartup() {
  useTheme()
  useAppBackendBootstrap()
}
```

这说明启动链被拆成两部分：

- 视觉启动：`useTheme()`
- 运行时启动：`useAppBackendBootstrap()`

也就是说，Niko-Studio 一打开，并不是“先渲染界面，再顺手处理别的事”，而是显式存在一条启动分流。

### 56.3 从根链路怎么记程序启动

可以直接记成：

```text
main.tsx
  ↓
<App />
  ↓
useAppViewModel()   → 组装整套工作台 props
useAppStartup()     → 启动主题与桌面运行时
  ↓
挂出 Sidebar / Main / Chat / RightPanels
```

这条链路很重要，因为它解释了为什么后面所有面板、编辑器、聊天区虽然看起来彼此独立，但实际上都在同一个根装配层下面被统一组织。

### 这一步的定位

**程序真正的根起点是 `main.tsx -> App`，而 `App` 通过 `useAppViewModel` 和 `useAppStartup` 同时完成“壳层装配”和“系统启动”。**

---

## 57. 主题系统为什么不是“切个 class”，而是启动期就写入整套设计 token

Niko-Studio 当前的主题系统不是简单地给页面加一个 `dark` 类名。

真正的主题入口在：`desktop/src/hooks/useTheme.ts:5`

```ts
export function useTheme() {
  const { settings } = useSettingsStore()
  const { theme } = settings

  useEffect(() => {
    const root = document.documentElement
    const definition = getThemeDefinition(theme)
    ...
  }, [theme])

  return { theme: theme as ThemeId }
}
```

这说明主题不是静态 CSS 文件切换，而是运行时根据 settings store 的 `theme` 动态求出一份 `ThemeDefinition`。

### 57.1 主题定义本身就是结构化数据，而不是散落样式

主题定义在：`desktop/src/styles/themes.ts:1-8`

```ts
export interface ThemeDefinition {
  id: ThemeId
  label: string
  colorDot: string
  isDark: boolean
  tokens: Record<string, string>
}
```

这里最关键的是 `tokens`。

这意味着每个主题不是“名字不同”，而是携带一整套 CSS 变量覆盖值。

而可选主题本身也是显式列出来的：`desktop/src/styles/themes.ts:1` 与 `desktop/src/styles/themes.ts:254-317`

- `sorbet`
- `slate`
- `amber`
- `forest`
- `charcoal`
- `cauldron`
- `aurora`
- `moonbeam`
- `sepia`
- 以及特殊模式 `system`

### 57.2 `useTheme` 会直接改写根 DOM 的主题状态

真正应用主题的动作在：`desktop/src/hooks/useTheme.ts:13-25`

```ts
root.setAttribute('data-theme', definition.id)

if (definition.isDark) {
  root.classList.add('dark')
} else {
  root.classList.remove('dark')
}

for (const [key, value] of Object.entries(definition.tokens)) {
  root.style.setProperty(key, value)
}
```

这一步不是“做个标记以后让别处自己理解”，而是直接完成三层写入：

1. 写 `data-theme`
2. 同步 `dark` class
3. 把主题 token 一项项写进根节点 style

所以当前界面颜色、边框、背景、阴影语义，其实都是在启动期被注入到根 DOM 的。

### 57.3 `system` 主题不是一次性判断，而是持续监听系统变化

如果用户选择 `system`，代码会继续注册系统主题监听：`desktop/src/hooks/useTheme.ts:28-44`

```ts
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
const handler = () => {
  const sysDef = getThemeDefinition('system')
  root.setAttribute('data-theme', sysDef.id)
  ...
  for (const [key, value] of Object.entries(sysDef.tokens)) {
    root.style.setProperty(key, value)
  }
}
mediaQuery.addEventListener('change', handler)
```

这说明 `system` 不是“启动时读一次系统设置就结束”，而是把操作系统颜色偏好变化继续投射回页面根节点。

### 57.4 为什么这对理解程序结构很重要

因为它说明主题系统的抽象层级很高。

不是每个组件自己决定深浅色，也不是 `Sidebar`、`Header`、`Panel` 分别处理皮肤，而是：

- store 保存主题选择
- `useTheme` 把选择解析成 token pack
- 根 DOM 接收 token 写入
- 各组件只消费变量

这就是为什么新主题可以在不重写所有组件逻辑的情况下进入整套界面。

### 从工作原理怎么记主题链路

```text
settingsStore.theme
  ↓
getThemeDefinition(theme)
  ↓
ThemeDefinition(tokens, isDark, id)
  ↓
useTheme 写入 documentElement
  ↓
全局 CSS 变量生效
  ↓
各组件自动换肤
```

### 这一步的定位

**Niko-Studio 的主题系统本质上是“启动期根节点 token 注入器”，不是简单的 class 切换器。**

---

## 58. `useAppViewModel` 为什么是壳层总装配器，而不是普通工具 Hook

很多项目里 `useXxxViewModel` 只是给某个组件拼几个字段。

Niko-Studio 这里不是。

`useAppViewModel` 在：`desktop/src/hooks/useAppViewModel.ts:12`

```ts
export function useAppViewModel() {
  const { backendStatus, checkBackend } = useAppStore()
  const uiPersistence = useAppUiPersistence()
  const latestAssistantContent = useLatestAssistantMessageContent()
  const contextUsageView = useAppContextUsage()
  const runtimeView = useAppRuntimeHealth({ backendStatus, checkBackend })
  const { t } = useI18n()

  const panelOrchestration = useAppPanelOrchestration({
    setActiveRightPanel: uiPersistence.setActiveRightPanel,
  })

  const checkpointMenu = useAppCheckpointMenu({
    restoreFailedText: t.restoreFailed,
    restoreSuccessText: t.restoreSuccess,
  })

  const headerViewModel = useAppHeaderViewModel({
    runtimeView,
    backendStatus,
    t,
    contextUsage: contextUsageView.contextUsage,
  })

  return useAppShellViewModel({
    uiPersistence,
    panelOrchestration,
    latestAssistantContent,
    t,
    headerViewModel,
    checkpointMenu,
    onContextUsageChange: contextUsageView.handleContextUsageChange,
  })
}
```

这段代码已经能说明：它不是一个小工具，而是工作台装配中心。

### 58.1 它把不同来源的状态集中到一处

这里至少收进了六类来源：

- 全局 app store：`backendStatus` / `checkBackend`
- UI 持久化：`useAppUiPersistence()`
- 最新助手消息：`useLatestAssistantMessageContent()`
- 上下文使用量：`useAppContextUsage()`
- 网关运行态：`useAppRuntimeHealth()`
- 多语言：`useI18n()`

也就是说，工作台壳层并不是从单一 store 直接拿一坨状态，而是把多个横切关注点先汇总，再统一下发。

### 58.2 它不直接渲染，而是继续把状态加工成更高层视图模型

在收集完原始状态后，它继续构造三种中间层：

- 面板编排：`useAppPanelOrchestration()`，见 `desktop/src/hooks/useAppViewModel.ts:20-22`
- checkpoint 菜单：`useAppCheckpointMenu()`，见 `desktop/src/hooks/useAppViewModel.ts:24-27`
- header 运行态：`useAppHeaderViewModel()`，见 `desktop/src/hooks/useAppViewModel.ts:29-34`

然后再交给 `useAppShellViewModel()` 做最终 props 投影。

这是一种明显的分层装配，而不是“Hook 里随手返回几个字段”。

### 58.3 它让 `App` 保持很薄，让壳层规则留在 hook 层

如果没有 `useAppViewModel`，那么这些逻辑都要堆回 `App.tsx`：

- 运行态轮询
- header 文案与状态计算
- 面板切换策略
- checkpoint 菜单行为
- UI 持久化恢复
- context usage 去抖/去重

现在这些都被压进了壳层装配链。

这使得 `App.tsx` 仍然只是一个根装配容器，而不是巨型控制器。

### 58.4 为什么它是“总装配器”而不是“数据提供者”

因为它的职责不是简单“把数据提供给组件”，而是：

- 汇总跨模块状态
- 构造壳层行为模型
- 拼出最终四大区域需要的 props
- 把工作流协作关系固化成事件入口

这一层决定的不是展示细节，而是整个工作台如何协同。

### 从程序结构怎么记这一层

```text
Store / Persistence / Runtime / I18n
  ↓
useAppViewModel 收口
  ↓
Orchestration / HeaderVM / CheckpointVM
  ↓
useAppShellViewModel
  ↓
Sidebar / Main / Chat / RightPanels props
```

### 这一步的定位

**`useAppViewModel` 是工作台壳层的总装配器：它收口多源状态，构造中间视图模型，再把结果分发给四大区域。**

---

## 59. 运行时健康状态为什么不是一次性检测，而是持续投影出来的

如果只看 UI，很容易把顶部状态点和上下文条理解成静态显示。

实际上，这部分数据来自持续轮询和运行态推导。

入口在：`desktop/src/hooks/useAppRuntimeHealth.ts:8`

```ts
export function useAppRuntimeHealth({ backendStatus, checkBackend }: UseAppRuntimeHealthOptions) {
  const [runtimeView, setRuntimeView] = useState<GatewayRuntimeView | null>(null)
  ...
}
```

这说明壳层并不直接把“后端是否可用”当最终答案，而是维护一个更完整的 `runtimeView`。

### 59.1 挂载时会立即做两类检查

在 effect 一开始就执行：`desktop/src/hooks/useAppRuntimeHealth.ts:12-26`

```ts
checkBackend()

const fetchGatewayRuntime = async () => {
  try {
    const response = await getGatewayHealth()
    if (response.success && response.data) {
      setRuntimeView(deriveGatewayRuntimeState(response.data, backendStatus))
      return
    }
  } catch {
    // ignore runtime fetch error
  }
  setRuntimeView(deriveGatewayRuntimeState(null, backendStatus))
}

void fetchGatewayRuntime()
```

这说明一进入页面就会并行做：

- backend 存活检查
- gateway health 细节获取
- 再把结果加工成 `runtimeView`

所以顶部状态不是简单 ping 一下，而是经过推导层的。

### 59.2 它会每 30 秒持续刷新，而不是只在打开时看一次

轮询逻辑在：`desktop/src/hooks/useAppRuntimeHealth.ts:28-31`

```ts
let interval: ReturnType<typeof setInterval> | null = setInterval(() => {
  void checkBackend()
  void fetchGatewayRuntime()
}, 30000)
```

也就是说：

- 每 30 秒重新确认 backend 状态
- 每 30 秒重新抓 gateway runtime
- 再更新 `runtimeView`

所以 header 看到的是一个持续更新的运行态投影。

### 59.3 页面隐藏时会暂停轮询，回到前台再恢复

这一点也很关键：`desktop/src/hooks/useAppRuntimeHealth.ts:33-52`

```ts
const handleVisibilityChange = () => {
  if (document.hidden) {
    if (interval) {
      clearInterval(interval)
      interval = null
    }
  } else {
    void checkBackend()
    void fetchGatewayRuntime()
    if (!interval) {
      interval = setInterval(() => {
        void checkBackend()
        void fetchGatewayRuntime()
      }, 30000)
    }
  }
}
```

这说明它不是机械地永远轮询，而是做了可见性感知：

- 页面隐藏：暂停
- 页面重新可见：立即补一次检查，再恢复 30 秒轮询

这属于典型的运行时资源管理逻辑，不只是展示逻辑。

### 59.4 为什么这层最终会影响 Header

因为 `useAppViewModel` 会把 `runtimeView` 继续交给 `useAppHeaderViewModel`：`desktop/src/hooks/useAppViewModel.ts:29-34`

```ts
const headerViewModel = useAppHeaderViewModel({
  runtimeView,
  backendStatus,
  t,
  contextUsage: contextUsageView.contextUsage,
})
```

也就是说：

- `useAppRuntimeHealth` 负责取数和推导运行态
- `useAppHeaderViewModel` 负责把运行态翻译成 header 可显示内容
- `AppHeader` 最终只消费结果

这就是“状态投影链”，不是“组件自己去请求状态”。

### 从工作原理怎么记这条链

```text
checkBackend + getGatewayHealth
  ↓
deriveGatewayRuntimeState(...)
  ↓
runtimeView
  ↓
useAppHeaderViewModel
  ↓
Header 状态点 / 文案 / 条形信息
```

### 这一步的定位

**Header 里的运行状态不是静态 UI，而是 `useAppRuntimeHealth` 持续轮询并推导出来的运行时投影。**

---

## 60. 桌面端为什么不是“前端直接请求本地服务”，而是 React、Tauri、Rust、Gateway 四层协作

Niko-Studio 桌面版真正特别的地方，在于它不是一个普通前端加 API 地址。

它至少有四层协作：

```text
React UI
  ↓ invoke / client
Tauri bridge
  ↓
Rust host runtime
  ↓
Gateway sidecar / external runtime
```

这条链在当前代码里是明确存在的。

### 60.1 前端只发出“我要使用网关”的意图，不直接管理进程

前端这边能看到的只是：`desktop/src/hooks/useAppBackendBootstrap.ts:13-17`

```ts
void invoke('set_gateway_base_override', {
  base: settings.apiBaseUrl && settings.apiBaseUrl.trim() ? settings.apiBaseUrl.trim() : null,
})

void invoke('start_backend')
```

这里前端没有：

- 自己挑端口
- 自己拉起 sidecar 进程
- 自己维护子进程生命周期

前端只做两件事：

1. 把设置同步给宿主
2. 请求宿主确保 backend ready

这说明进程管理权不在 React 层。

### 60.2 Rust 宿主才是真正的网关协调者

Rust 里真正接住这件事的是 `GatewayState`：`desktop/src-tauri/src/main.rs:...`

代码里可以直接看到它持有的状态：

- `child`：当前 sidecar 子进程
- `local_base`：本地网关地址
- `base_override`：用户覆盖地址
- `start_lock`：并发启动锁

也就是说，Rust 这一层并不只是转发命令，而是在维护真实的网关运行态。

### 60.3 网关 base 的选择有明确优先级，不是随便取一个地址

最关键的逻辑在 `resolve_base`：`desktop/src-tauri/src/main.rs:285-298` 与更上方实现。

它的优先顺序是：

1. 环境变量 override：`NIKO_GATEWAY_URL` / `VITE_NIKO_GATEWAY_URL`
2. UI 设置同步过来的 `base_override`
3. 之前已启动过的 `local_base`
4. 如果都不行，再启动新的本地 sidecar

这不是普通“读配置然后 fetch”，而是完整的运行时决策树。

### 60.4 本地 sidecar 不是固定端口常驻，而是按需分配并做健康检查

`start_local_sidecar` 会先绑定一个临时端口，再构造本地 base。代码见：`desktop/src-tauri/src/main.rs:181-203` 附近。

里面明确有：

- 绑定 `127.0.0.1:0` 取空闲端口
- 把 `NIKO_GATEWAY_HOST`、`NIKO_GATEWAY_PORT` 等环境变量传给 sidecar
- 根据 runtime 选择 Node / Python 尝试顺序
- 启动后继续做健康检查确认可用

所以桌面版并不是把某个固定后端永久写死，而是由宿主在运行时动态分配、拉起、确认。

### 60.5 宿主还负责清理 sidecar，避免残留子进程

关闭窗口时的清理逻辑在：`desktop/src-tauri/src/main.rs:352-360`

```rust
.on_window_event(|window, event| {
    if let tauri::WindowEvent::CloseRequested { .. } = event {
        if window.label() == "main" {
            if let Some(state) = window.app_handle().try_state::<GatewayState>() {
                state.stop_child_best_effort();
            }
        }
    }
})
```

而且在 `Drop` 里还有兜底：`desktop/src-tauri/src/main.rs:413-417`

```rust
impl Drop for GatewayState {
    fn drop(&mut self) {
        self.stop_child_best_effort();
    }
}
```

这说明 sidecar 生命周期也不交给前端页面自然结束，而是明确归宿主管。

### 60.6 Tauri command 才是 React 与宿主之间的正式契约面

Rust 里暴露给前端的命令在：`desktop/src-tauri/src/main.rs:402-408`

```rust
.invoke_handler(tauri::generate_handler![
    get_gateway_base,
    set_gateway_base_override,
    start_backend,
    check_backend_health,
    call_api
])
```

所以 React 能调用的宿主能力是被显式声明出来的，不是直接碰 Rust 内部实现。

### 60.7 打包配置也证明它不是纯前端壳

`desktop/src-tauri/tauri.conf.json` 里能看到：

```json
"bundle": {
  "active": true,
  "targets": "all",
  "externalBin": [
    "bin/niko-gateway"
  ],
  "resources": [
    "../../skills"
  ]
}
```

这说明发布产物不仅带前端资源，还会把：

- `niko-gateway` 作为外部二进制一起打包
- `skills` 作为资源一起带上

所以桌面版不是“把网页包进窗口里”，而是把工作台运行所需的宿主能力一起封装进桌面应用。

### 从程序结构怎么记桌面协作链

```text
React
  负责 UI、状态、工作流入口

Tauri invoke
  负责桥接前端与宿主命令

Rust host
  负责 base 解析、sidecar 启停、生命周期清理

Gateway runtime
  负责真正的 API / LLM / graph / runtime 服务
```

### 这一步的定位

**Niko-Studio 桌面版不是“前端直连本地服务”，而是 React、Tauri、Rust、Gateway 四层明确分工的协作系统。**

---

## 61. 面板切换为什么不是组件互相打开彼此，而是单独抽成 orchestration 层

如果只看交互，很容易把“打开设置”“打开提示词库”“切到 Writing Helper”理解成几个按钮各自控制各自组件。

但当前代码并不是这样做的。

真正的协调点在：`desktop/src/hooks/useAppPanelOrchestration.ts:7`

```ts
export function useAppPanelOrchestration({ setActiveRightPanel }: UseAppPanelOrchestrationOptions) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isTemplatePanelOpen, setIsTemplatePanelOpen] = useState(false)
  const [resumeWritingHelperAfterSettings, setResumeWritingHelperAfterSettings] = useState(false)
  ...
}
```

这说明面板层不是直接由某个 UI 组件单独维护，而是先进入一个专门的编排 hook。

### 61.1 右侧面板、模板面板、设置弹窗其实是三条不同状态线

从状态定义就能看出来：`desktop/src/hooks/useAppPanelOrchestration.ts:8-10`

- `settingsOpen`
- `isTemplatePanelOpen`
- `resumeWritingHelperAfterSettings`

注意这里没有把所有东西都塞进一个 `activePanel`。

这意味着程序明确区分了三类东西：

1. **右侧功能面板**：knowledge / evaluation / mcpStatus / writingHelper / textOptimizer
2. **模板库面板**：独立于右侧面板存在
3. **设置弹窗**：也独立于右侧面板存在

所以这里不是“所有浮层共享一个开关”，而是把不同交互通道拆开了。

### 61.2 `toggleRightPanel` 做的是右侧路由切换，不是直接操作具体组件

关键逻辑在：`desktop/src/hooks/useAppPanelOrchestration.ts:16-19`

```ts
const toggleRightPanel = useCallback((panel: Exclude<RightPanelType, 'none'>) => {
  setIsTemplatePanelOpen(false)
  setActiveRightPanel((prev) => (prev === panel ? 'none' : panel))
}, [setActiveRightPanel])
```

这里做了两件很关键的事：

- 先关掉模板面板
- 再根据目标 panel 做“同项关闭 / 异项切换”

也就是说，右侧区域的切换不是按钮直接去 mount 某个组件，而是统一改写 `activeRightPanel`。

### 61.3 Prompt/Template 入口被故意做成右侧面板体系之外的独立通道

`openPrompts()` 在：`desktop/src/hooks/useAppPanelOrchestration.ts:25-28`

```ts
const openPrompts = useCallback(() => {
  setActiveRightPanel('none')
  setIsTemplatePanelOpen(true)
}, [setActiveRightPanel])
```

这里最值得注意的是：

- 打开模板库时，会先把右侧面板置为 `none`
- 然后单独打开模板面板

这说明模板库虽然在视觉上也像“侧向工作区”，但在程序结构里它不是 `AppRightPanels` 的一个分支，而是另一条并行的宿主通道。

### 61.4 从 Writing Helper 去设置页，再返回，不是 UI 巧合，而是显式恢复策略

最能说明 orchestration 价值的是这一段：`desktop/src/hooks/useAppPanelOrchestration.ts:30-42`

```ts
const closeSettings = useCallback(() => {
  setSettingsOpen(false)
  if (resumeWritingHelperAfterSettings) {
    setActiveRightPanel('writingHelper')
    setResumeWritingHelperAfterSettings(false)
  }
}, [resumeWritingHelperAfterSettings, setActiveRightPanel])

const openSettingsFromWritingHelper = useCallback(() => {
  setResumeWritingHelperAfterSettings(true)
  setActiveRightPanel('none')
  setSettingsOpen(true)
}, [setActiveRightPanel])
```

这里表达的是一个明确的业务意图：

1. 用户当前正在右侧 `writingHelper`
2. 因为配置需求跳到设置页
3. 设置页关闭后，应该自动回到 `writingHelper`

如果没有这层 orchestration，这种“跨面板往返恢复”通常会散落在多个组件里，变得难维护。

### 从工作原理怎么记这层

```text
按钮点击
  ↓
useAppShellViewModel 提供 callback
  ↓
useAppPanelOrchestration 改写面板状态
  ↓
宿主区域按状态切换渲染
```

### 这一步的定位

**`useAppPanelOrchestration` 不是普通工具 hook，而是工作台“侧向工作区切换规则”的集中编排层。**

---

## 62. Header 为什么不是自己算状态，而是先经过一个 Header ViewModel 投影层

Header 上看起来只是几个 UI 元素：

- 连接状态点
- 状态文案
- 上下文使用量
- 上下文颜色条

但这些值都不是在组件里临时算的。

真正的投影入口在：`desktop/src/hooks/useAppHeaderViewModel.ts:32`

```ts
export function useAppHeaderViewModel({ runtimeView, backendStatus, t, contextUsage }: UseAppHeaderViewModelOptions) {
  ...
}
```

这说明 Header 显示层之前还有一层“显示数据翻译器”。

### 62.1 连接状态不是直接显示 backendStatus，而是优先使用 runtimeView

核心逻辑：`desktop/src/hooks/useAppHeaderViewModel.ts:33-36`

```ts
const headerConnectionState = runtimeView?.connectionState ?? (backendStatus ? 'connected' : 'disconnected')
const headerDotClass = APP_CONNECTION_DOT[headerConnectionState] ?? APP_CONNECTION_DOT.disconnected
const headerConnectionLabelKey = APP_CONNECTION_LABEL[headerConnectionState] ?? (backendStatus ? 'serviceRunning' : 'serviceOffline')
const headerConnectionText = t[headerConnectionLabelKey]
```

这里至少做了三层转换：

1. 先决定最终连接态 `headerConnectionState`
2. 再把状态映射成颜色 class
3. 再把状态映射成翻译 key 和显示文案

所以 Header 并不直接关心 `runtimeView` 的原始结构，它只接收投影后的显示值。

### 62.2 上下文使用条也不是样式细节，而是阈值驱动的状态表达

这一段在：`desktop/src/hooks/useAppHeaderViewModel.ts:38-45`

```ts
const contextUsageText = `${contextUsage.usedK.toFixed(1)}k/${contextUsage.totalK}k`
const contextUsageBarClass =
  contextUsage.percent > 85
    ? 'bg-danger-500'
    : contextUsage.percent > 65
      ? 'bg-warning-500'
      : 'bg-primary-500'
const contextUsageWidthPercent = Math.min(100, Math.max(0, contextUsage.percent))
```

这说明它不是简单把 percent 塞给进度条，而是明确做了：

- 文本格式化
- 阈值分段着色
- 宽度裁剪

也就是说，Header ViewModel 持有的是“可显示的 UI 状态”，不是原始业务数据。

### 62.3 为什么要单独抽这一层

因为上游 `useAppViewModel` 要同时接：`desktop/src/hooks/useAppViewModel.ts:29-33`

```ts
const headerViewModel = useAppHeaderViewModel({
  runtimeView,
  backendStatus,
  t,
  contextUsage: contextUsageView.contextUsage,
})
```

这里把两类来源合在一起了：

- 运行时健康态：`runtimeView`
- 上下文配额态：`contextUsage`

如果这些转换都塞进 `AppHeader.tsx`，组件就会开始承担状态推导职责；当前做法则让 `AppHeader` 保持纯展示。

### 从程序结构怎么记这层

```text
runtimeView + contextUsage
  ↓
useAppHeaderViewModel
  ↓
headerDotClass / headerConnectionText / contextUsageText / widthPercent
  ↓
AppHeader
```

### 这一步的定位

**`useAppHeaderViewModel` 的作用不是“帮 Header 少写几行”，而是把运行态与配额态投影成稳定的展示契约。**

---

## 63. AppHeader 为什么说是壳层控制台，而不是普通标题栏

真正的组件在：`desktop/src/components/AppHeader.tsx:40`

从 props 形状就能看出，它不是一个只负责标题展示的 header。

### 63.1 它本质上消费的是一整套壳层控制协议

先看参数：`desktop/src/components/AppHeader.tsx:11-37`

这里包含：

- 标题与上下文信息
- 运行状态点与文案
- checkpoint 菜单相关状态与动作
- chat sidebar 折叠控制
- AI 工具栏所有入口

也就是说，`AppHeader` 不是“标题 + 几个按钮”，而是主工作台上方的操作控制台。

### 63.2 左侧不是纯标题，而是“标题 + AI 工具栏”复合入口

`desktop/src/components/AppHeader.tsx:71-81`

```tsx
<div className="flex items-center gap-3">
  <span className="text-base font-semibold ...">{appTitle}</span>
  <AiToolbar
    disabled={aiToolbarDisabled}
    onWrite={onAiWrite}
    onRewrite={onAiRewrite}
    onDescribe={onAiDescribe}
    onBrainstorm={onAiBrainstorm}
    onOpenWritingHelper={onOpenWritingHelper}
    onOpenTextOptimizer={onOpenTextOptimizer}
  />
</div>
```

这说明 Header 左侧直接承载了主工作流的 AI 入口，不是另起一个工具条区域。

也就是说，AI 写作、改写、描述、脑暴、打开侧栏助手、打开文本优化器，这些都被放在主画布顶部统一暴露。

### 63.3 右侧不是静态状态显示，而是“切换 + 监控 + 恢复”三个子系统并列

右侧结构在：`desktop/src/components/AppHeader.tsx:83-139`

从代码能拆成三块：

1. **聊天侧栏开关**
   - `onToggleChatSidebar`
   - `chatSidebarCollapsed`
2. **运行态与上下文配额显示**
   - `headerDotClass`
   - `headerConnectionText`
   - `contextUsageText`
   - `contextUsageWidthPercent`
3. **checkpoint 菜单**
   - `onToggleCheckpointMenu`
   - `checkpointsLoading`
   - `checkpoints`
   - `onRestoreCheckpoint`

所以 Header 右侧并不是单一状态区，而是把主画布外围最关键的壳层控制入口都聚合了。

### 63.4 Checkpoint 下拉菜单是内嵌控制面，不是单独页面

下拉菜单渲染在：`desktop/src/components/AppHeader.tsx:114-139`

```tsx
{checkpointMenuOpen && (
  <div className="absolute right-0 top-10 w-72 ...">
    ...
  </div>
)}
```

这说明 checkpoint 恢复能力被设计成 header 内嵌下拉控制，而不是跳页面或弹独立面板。

它的定位更像“运行中的恢复入口”，不是“另一个功能模块”。

### 这一步的定位

**`AppHeader` 不是装饰性标题栏，而是主写作画布上方的壳层控制台：统一承载 AI 入口、运行态投影、聊天开关与 checkpoint 恢复。**

---

## 64. Checkpoint 菜单为什么不是一个普通下拉框，而是独立的行为型 Hook

表面上看，checkpoint 只是 Header 右上角一个小菜单。

但真正逻辑被单独抽进了：`desktop/src/hooks/useAppCheckpointMenu.ts:19`

```ts
export function useAppCheckpointMenu({ restoreFailedText, restoreSuccessText }: UseAppCheckpointMenuOptions) {
  ...
}
```

这说明它不是单纯 UI 展开收起，而是一块完整行为单元。

### 64.1 它自己维护“菜单状态 + 远程数据 + 恢复反馈”三套状态

状态定义在：`desktop/src/hooks/useAppCheckpointMenu.ts:20-24`

- `checkpointMenuOpen`
- `checkpointsLoading`
- `checkpoints`
- `restoreStatus`
- `checkpointMenuContainerRef`

这说明 checkpoint 系统至少做了三件事：

1. 管菜单开合
2. 管 checkpoint 列表加载
3. 管 restore 成功/失败反馈

所以它不是“Header 里一个 `useState<boolean>` 就能解释完”的功能。

### 64.2 菜单打开时会主动拉最新 checkpoint，而不是只显示本地缓存

关键逻辑：`desktop/src/hooks/useAppCheckpointMenu.ts:76-82`

```ts
const handleToggleCheckpointMenu = async () => {
  const nextOpen = !checkpointMenuOpen
  setCheckpointMenuOpen(nextOpen)
  if (nextOpen) {
    await refreshCheckpoints()
  }
}
```

也就是说，用户每次真正打开菜单时，系统会去刷新一遍列表。

这表示 checkpoint 菜单是一个“懒加载的运行态入口”，不是启动时一次取完一直沿用的静态数据。

### 64.3 它还自己处理点击外部关闭和 Escape 关闭

行为逻辑在：`desktop/src/hooks/useAppCheckpointMenu.ts:33-56`

```ts
document.addEventListener('mousedown', handlePointerDown)
document.addEventListener('keydown', handleKeyDown)
```

其中：

- 点到菜单外部：关闭
- 按 `Escape`：关闭

所以这个 hook 不只是远程数据层，还是交互层。

### 64.4 Restore 成功/失败不会永久挂着，而是作为短暂状态反馈存在

状态自动清理在：`desktop/src/hooks/useAppCheckpointMenu.ts:26-31`

```ts
useEffect(() => {
  if (!restoreStatus) return

  const timer = setTimeout(() => setRestoreStatus(null), 2500)
  return () => clearTimeout(timer)
}, [restoreStatus])
```

这说明恢复结果不是长期状态，而是一个短生命周期通知信号。

而具体 restore 行为在：`desktop/src/hooks/useAppCheckpointMenu.ts:84-95`

成功时会：

- 设 `success`
- 关闭菜单

失败时会：

- 设 `error`
- 保持在当前上下文里给出错误反馈

### 从工作原理怎么记这块

```text
点击 checkpoint 按钮
  ↓
handleToggleCheckpointMenu()
  ↓
打开时刷新远程 checkpoints
  ↓
AppHeader 渲染下拉项
  ↓
点击 restore
  ↓
restoreCheckpoint()
  ↓
restoreStatus 短暂反馈 + 菜单关闭/保留
```

### 这一步的定位

**Checkpoint 菜单不是视觉上的“小下拉框”，而是一个自带远程加载、关闭规则、恢复反馈的行为型恢复子系统。**

---

## 65. 中间编辑区为什么不是“编辑器组件本体”，而是文档画布 + 故事圣经 + 状态栏三层组合

当前主编辑区入口在：`desktop/src/components/DocumentEditor.tsx:13`

```ts
export function DocumentEditor({ onOpenWritingHelper }: DocumentEditorProps) {
  ...
}
```

名字叫 `DocumentEditor`，但它实际承担的不是单一编辑器本体，而是整个正文工作区装配。

### 65.1 它至少管理了四类编辑态

状态定义在：`desktop/src/components/DocumentEditor.tsx:15-20`

- `title`
- `editorText`
- `editorJson`
- `showSaved`
- `aiGenerating`

也就是说，这一层同时维护：

- 文档标题
- 编辑器纯文本视图
- 编辑器结构化 JSON 视图
- 自动保存提示状态
- AI 生成中状态

所以 `DocumentEditor` 是围绕编辑器的宿主，不是编辑器内核本身。

### 65.2 真正的富文本内核是 `NikoEditor`，外层只接收同步结果

编辑器挂载在：`desktop/src/components/DocumentEditor.tsx:66-69`

```tsx
<NikoEditor
  onOpenWritingHelper={onOpenWritingHelper}
  onUpdate={handleEditorUpdate}
/>
```

这说明 `DocumentEditor` 和 `NikoEditor` 的分工是：

- `NikoEditor`：负责真正的富文本编辑交互
- `DocumentEditor`：负责接收内容变化，投影到标题/统计/导出/状态栏

### 65.3 自动保存提示其实是一个去抖后的 UI 信号，不是立即闪一下

逻辑在：`desktop/src/components/DocumentEditor.tsx:28-36`

```ts
const handleEditorUpdate = useCallback((json: JSONContent, text: string) => {
  setEditorJson(json)
  setEditorText(text)
  if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
  saveTimerRef.current = setTimeout(() => {
    setShowSaved(true)
    setTimeout(() => setShowSaved(false), 2000)
  }, 1500)
}, [])
```

这里表达的是：

- 用户持续输入时，不反复抖动提示
- 停下来 1.5 秒后，才显示“已自动保存”
- 显示 2 秒后再消失

所以状态栏里的保存提示本质上是“编辑活动稳定后”的反馈，而不是每次键入都立即触发。

### 65.4 字数、字符数、阅读时间并不是编辑器自己算完显示，而是宿主层派生统计

统计逻辑在：`desktop/src/components/DocumentEditor.tsx:22-26`

```ts
const stats = useMemo(() => ({
  words: countWords(editorText),
  chars: countChars(editorText),
  readingTime: readingTimeMinutes(editorText),
}), [editorText])
```

这说明状态栏统计依赖的是同步出来的 `editorText`，而不是编辑器 UI 内部自己单独渲染一份。

### 65.5 AI 生成状态甚至不是通过 props 传下来的，而是通过 editor handle 轮询桥接

逻辑在：`desktop/src/components/DocumentEditor.tsx:38-45`

```ts
useEffect(() => {
  const id = setInterval(() => {
    const handle = getEditorHandle()
    setAiGenerating(handle?.isGenerating ?? false)
  }, 500)
  return () => clearInterval(id)
}, [])
```

这很关键。

它说明：

- `DocumentEditor` 并不直接拥有 editor 内部 AI 执行状态
- 它通过 `editorHandle` 桥接读取 `isGenerating`
- 再把结果投影到底部状态栏

这就是主画布宿主层和编辑器内核之间的一个小型状态桥。

### 65.6 `StoryBiblePanel` 也不在编辑器里，而是在正文画布同层并列挂载

`desktop/src/components/DocumentEditor.tsx:72`

```tsx
<StoryBiblePanel />
```

这意味着故事圣经并不是富文本编辑器的一个 tab，也不是右侧面板的一种模式，而是正文工作区下方的同域辅助区。

### 65.7 状态栏属于宿主层，因此可以统一承载导出与运行提示

底部状态栏在：`desktop/src/components/DocumentEditor.tsx:75-109`

这里统一放了：

- AI 生成中提示
- 字数 / 字符数 / 阅读时间
- Markdown / HTML 导出
- 自动保存提示

这进一步证明 `DocumentEditor` 的真实角色是“正文工作区宿主”。

### 这一步的定位

**`DocumentEditor` 不是单纯的编辑器组件，而是把 `NikoEditor`、`StoryBiblePanel`、状态栏统计、导出、自动保存提示装成一个完整正文工作区的宿主层。**

---

## 66. ChatSidebar 为什么不是浮层聊天框，而是与正文并列的一条常驻协作通道

当前实现非常直接：`desktop/src/components/ChatSidebar.tsx:8-12`

```tsx
export function ChatSidebar({ chatAreaProps, chatSidebarCollapsed }: ChatSidebarProps) {
  return (
    <aside className={`${chatSidebarCollapsed ? 'w-0 overflow-hidden' : 'w-[320px]'} ...`}>
      <ChatArea {...chatAreaProps} />
    </aside>
  )
}
```

### 66.1 它是壳层里的固定区域，不是弹窗

最重要的信息在于它直接返回的是 `<aside>`，而且宽度通过：

- `w-0 overflow-hidden`
- `w-[320px]`

在“收起 / 展开”之间切换。

这说明聊天区不是打开一个 modal，也不是覆盖正文，而是始终占据壳层右侧一条并列通道。

### 66.2 Header 控制的不是“打开聊天页面”，而是这条通道的宽度状态

Header 里对应按钮在：`desktop/src/components/AppHeader.tsx:84-91`

它切换的是 `chatSidebarCollapsed`，并通过图标表达展开/收起。

所以从交互本质上说，用户不是在“进入聊天模式”，而是在“打开或收起协作通道”。

### 66.3 这说明当前产品结构不是单主线，而是正文 + 协作并行

程序结构更接近：

```text
Sidebar | Main Writing Canvas | Chat Collaboration Lane | Right Tool Panels
```

聊天不是编辑器里的附属功能，而是壳层四区中的一个固定区域。

### 这一步的定位

**`ChatSidebar` 的设计含义是：协作对话被视为写作过程中的并行通道，而不是临时弹出的辅助窗。**

---

## 67. AppRightPanels 为什么更像一个状态驱动的“右侧路由出口”而不是单一面板组件

入口在：`desktop/src/components/AppRightPanels.tsx:20`

```tsx
export function AppRightPanels({
  activeRightPanel,
  settingsOpen,
  latestAssistantContent,
  writingHelperDraft,
  ...
}: AppRightPanelsProps) {
  return (
    <>
      ...
    </>
  )
}
```

### 67.1 它不自己决定业务，只按状态分发到不同宿主组件

核心结构很清楚：`desktop/src/components/AppRightPanels.tsx:33-66`

- `knowledge` → `KnowledgeModal`
- `evaluation` → `EvaluationPanel`
- `mcpStatus` → `McpStatusPanel`
- `writingHelper` → `WritingHelperPanel`
- `textOptimizer` → `AiTextOptimizer`
- `settingsOpen` → `SettingsModal`

所以这层做的不是业务本身，而是“当前侧向工作区该挂谁”。

### 67.2 `SettingsModal` 甚至不是 `activeRightPanel` 的一种值

这一点很关键：`desktop/src/components/AppRightPanels.tsx:37-40`

```tsx
<SettingsModal
  isOpen={settingsOpen}
  onClose={closeSettings}
/>
```

而其他右侧工具面板都依赖 `activeRightPanel === ...`。

这再次印证了前面 orchestration 那一节：

- settings 是独立状态线
- 它不属于右侧面板枚举路由的一部分

### 67.3 EvaluationPanel 消费的不是编辑器正文，而是最近一次助手输出

`desktop/src/components/AppRightPanels.tsx:42-46`

```tsx
<EvaluationPanel
  content={latestAssistantContent}
  onClose={closeRightPanel}
/>
```

这说明评估面板的输入来源不是当前文档，而是聊天/助手最近输出的内容。

所以它更像协作结果评估器，而不是正文质量统计面板。

### 67.4 Writing Helper 不是瞬时面板，它带着可恢复草稿状态进入宿主

`desktop/src/components/AppRightPanels.tsx:51-58`

```tsx
<WritingHelperPanel
  onClose={closeRightPanel}
  onOpenSettings={openSettingsFromWritingHelper}
  draftState={writingHelperDraft}
  onDraftStateChange={setWritingHelperDraft}
  onClearDraft={clearWritingHelperDraft}
/>
```

这说明 Writing Helper 的宿主契约里明确包含：

- 进入时带草稿
- 编辑中回写草稿
- 处理后可清草稿
- 可跳设置再返回

因此它不是“每次打开都全新初始化”的面板，而是一个可恢复、可往返的侧栏工作流。

### 67.5 Text Optimizer 与 Writing Helper 是同一宿主出口下的不同分支

`desktop/src/components/AppRightPanels.tsx:61-65`

```tsx
<AiTextOptimizer
  onClose={closeRightPanel}
  onOpenSettings={openSettingsFromWritingHelper}
/>
```

这说明右侧出口并不是只服务一个 AI 功能，而是承载多个侧向处理器。

### 从程序结构怎么记这一层

```text
activeRightPanel / settingsOpen
  ↓
AppRightPanels
  ↓
按状态挂载 Knowledge / Evaluation / MCP / WritingHelper / TextOptimizer / Settings
```

### 这一步的定位

**`AppRightPanels` 更像工作台右侧的状态驱动路由出口：它不处理具体业务，而是把不同侧向工具按壳层状态挂进正确宿主位。**

---

## 68. 前端 API Client 为什么不是简单 fetch 封装，而是运行环境适配层

很多项目里的 `api/client.ts` 只是把 URL 和 `fetch` 包一下。

但 Niko-Studio 这里更像运行环境适配层。

入口在：`desktop/src/api/client.ts:14`

```ts
const resolveApiBase = (): string => {
  ...
}
```

以及真正请求入口：`desktop/src/api/client.ts:224`

```ts
async function callApi<T>(endpoint: string, method: 'GET' | 'POST' | 'PUT' = 'GET', body?: Record<string, unknown>)
```

### 68.1 它先解决“请求该发到哪里”，而不是先发请求

`resolveApiBase()` 的优先级是：`desktop/src/api/client.ts:14-27`

1. `env.NIKO_GATEWAY_URL / VITE_NIKO_GATEWAY_URL`
2. `settingsStore.settings.apiBaseUrl`
3. 默认 `http://127.0.0.1:8000`

这说明 client 层先吸收了“环境配置 / 用户设置 / 默认回退”的 base 决策。

### 68.2 在 Tauri 环境里，真正运行时 base 甚至还要向宿主再问一次

`desktop/src/api/client.ts:41-55`

```ts
const getRuntimeGatewayBase = async (): Promise<string> => {
  if (!isTauri) {
    return getResolvedApiBase()
  }
  ...
  const base = await invoke<string>('get_gateway_base')
  ...
}
```

这说明桌面端真正可用的网关地址可能是宿主运行时动态决定的，而不是前端静态配置能完全代表的。

而且这里还有 5 秒缓存：`desktop/src/api/client.ts:46-54`

所以它不是每次都盲目向 Rust 请求一次。

### 68.3 `callApi()` 的核心价值是统一浏览器模式和 Tauri 模式

关键逻辑在：`desktop/src/api/client.ts:232-249`

```ts
if (isTauri) {
  const response = await invoke<string>('call_api', {
    endpoint,
    method,
    body: body ? JSON.stringify(body) : null,
  })
  data = JSON.parse(response)
} else {
  const response = await fetch(`${getResolvedApiBase()}${endpoint}`, options)
  ...
}
```

也就是说：

- **桌面版**：走 `invoke('call_api')`，让 Rust 代理
- **开发浏览器模式**：直接 `fetch`

所以业务 API 调用方不需要知道当前在什么宿主里运行。

### 68.4 它还负责把原始健康数据投影成前端稳定运行态

这部分不只是 transport，还有运行态推导：`desktop/src/api/client.ts:197-213`

```ts
export function deriveGatewayRuntimeState(
  health: GatewayHealth | null | undefined,
  backendHealthy: boolean
): GatewayRuntimeView {
  ...
}
```

说明 `client.ts` 不只是“发请求”，还是前端与网关运行状态之间的适配器。

### 从工作原理怎么记这层

```text
UI 业务调用
  ↓
api/client.ts
  ├─ resolveApiBase()
  ├─ getRuntimeGatewayBase()
  ├─ callApi()
  └─ deriveGatewayRuntimeState()
  ↓
Browser fetch 或 Tauri invoke
  ↓
Gateway / Runtime
```

### 这一步的定位

**`desktop/src/api/client.ts` 不是单纯网络封装，而是“base 决策 + 宿主适配 + 运行态投影”的前端运行环境适配层。**

## 69. `useAppViewModel()` 为什么是壳层汇流点，而不是又一个普通 hook

很多项目里会有一个 `useXxxViewModel()`，但它只是把几个 state 拼起来。

Niko-Studio 这里的 `desktop/src/hooks/useAppViewModel.ts:12-45` 更像 **壳层汇流点**。

```ts
export function useAppViewModel() {
  const { backendStatus, checkBackend } = useAppStore()
  const uiPersistence = useAppUiPersistence()
  const latestAssistantContent = useLatestAssistantMessageContent()
  const contextUsageView = useAppContextUsage()
  const runtimeView = useAppRuntimeHealth({ backendStatus, checkBackend })
  ...
  const panelOrchestration = useAppPanelOrchestration(...)
  const checkpointMenu = useAppCheckpointMenu(...)
  const headerViewModel = useAppHeaderViewModel(...)

  return useAppShellViewModel({ ... })
}
```

这里至少汇了 7 条不同来源的状态线：

1. **全局应用状态**：`useAppStore()` 提供 `backendStatus` / `checkBackend`
2. **UI 持久化状态**：`useAppUiPersistence()` 提供侧栏折叠、右侧面板、Writing Helper 草稿
3. **会话输出选择器**：`useLatestAssistantMessageContent()` 提供最新 assistant 文本
4. **上下文用量线**：`useAppContextUsage()` 负责 context usage 接收与回写
5. **运行健康线**：`useAppRuntimeHealth()` 把 backend 状态变成运行态视图
6. **面板编排线**：`useAppPanelOrchestration()` 负责右侧面板/设置/模板面板开合
7. **检查点与头部视图线**：`useAppCheckpointMenu()`、`useAppHeaderViewModel()` 生成主区 header 所需投影

所以它不是“一个大 hook”。

它做的事更像：

- **向下游收集不同抽象层的输入**
- **在壳层统一做一次抽象转换**
- **最后交给 `useAppShellViewModel()` 进行 UI 出口分发**

### 为什么这里必须有一个汇流点

因为 `App.tsx` 想保持干净。

`desktop/src/App.tsx` 最终只做这件事：

```tsx
const { sidebarProps, appRightPanelsProps, appMainContentProps, chatSidebarProps } = useAppViewModel()
```

也就是：

- `App.tsx` 不自己拼运行态
- 不自己读 localStorage
- 不自己决定哪个面板怎么开
- 不自己取“最后一条 assistant 文本”

这些都在壳层汇流点上先完成。

### 从工作原理怎么记这一层

```text
Store / Persistence / Runtime / Selectors / Panel Orchestration
  ↓
useAppViewModel()
  ↓
壳层统一聚合
  ↓
useAppShellViewModel()
  ↓
四个 UI 出口
```

### 这一步的定位

**`desktop/src/hooks/useAppViewModel.ts` 是 App Shell 的总汇流点，负责把“全局状态、运行态、持久化状态、选择器状态、壳层控制状态”先汇成一份可路由的数据包。**

## 70. `useAppShellViewModel()` 为什么更像壳层路由器，而不是 props 拼装器

如果说 `useAppViewModel()` 是汇流点，

那 `desktop/src/hooks/useAppShellViewModel.ts:60-154` 就是 **壳层路由器**。

因为它不是简单 `const props = { ... }`。

它其实在做 **四条宿主出口的 fan-out 分发**：

1. `sidebarProps` → `Sidebar`
2. `appMainContentProps` → `AppMainContent`
3. `chatSidebarProps` → `ChatSidebar`
4. `appRightPanelsProps` → `AppRightPanels`

代码证据很直接：

```ts
return {
  sidebarProps,
  appRightPanelsProps,
  appMainContentProps,
  chatSidebarProps,
}
```

这和 `desktop/src/App.tsx` 里的最终渲染是一一对应的：

```tsx
<Sidebar {...sidebarProps} />
<AppMainContent {...appMainContentProps} />
<ChatSidebar {...chatSidebarProps} />
<AppRightPanels {...appRightPanelsProps} />
```

### 为什么说它是路由器

因为这里做的不是“传值”，而是“把壳层动作路由到具体宿主通道”。

比如左侧边栏：`desktop/src/hooks/useAppShellViewModel.ts:69-77`

```ts
const sidebarProps = {
  collapsed: uiPersistence.sidebarCollapsed,
  onToggle: () => uiPersistence.setSidebarCollapsed(!uiPersistence.sidebarCollapsed),
  onOpenKnowledge: () => panelOrchestration.toggleRightPanel('knowledge'),
  onOpenPrompts: panelOrchestration.openPrompts,
  onOpenSettings: panelOrchestration.openSettings,
  onOpenEvaluation: () => panelOrchestration.toggleRightPanel('evaluation'),
  onOpenMcpStatus: () => panelOrchestration.toggleRightPanel('mcpStatus'),
}
```

这表示 Sidebar 并不知道知识库、评估、节点状态这些面板怎么开。

它只发出动作，真正路由由壳层完成。

### Header 里的 AI 按钮为什么也属于壳层路由

更典型的是主区头部 AI 动作：`desktop/src/hooks/useAppShellViewModel.ts:113-130`

```ts
onAiWrite: () => {
  uiPersistence.setWritingHelperDraft({ ...uiPersistence.writingHelperDraft, mode: 'polish' })
  panelOrchestration.toggleRightPanel('writingHelper')
},
onAiRewrite: () => {
  uiPersistence.setWritingHelperDraft({ ...uiPersistence.writingHelperDraft, mode: 'rewrite' })
  panelOrchestration.toggleRightPanel('writingHelper')
},
```

这里不是简单打开 Writing Helper。

而是先：

1. **改写壳层中的 Writing Helper draft mode**
2. **再把右侧面板切到 `writingHelper`**

所以同一个右侧面板，会因为入口不同而带着不同初始任务模式打开。

这就是典型路由器行为：

- 相同目标组件
- 不同入口动作
- 不同初始载荷

### Chat 区也是壳层路由出口，而不是独立岛

`desktop/src/hooks/useAppShellViewModel.ts:137-145`

```ts
const chatSidebarProps = {
  chatSidebarCollapsed: uiPersistence.chatSidebarCollapsed,
  onToggleChatSidebar: () => uiPersistence.setChatSidebarCollapsed(!uiPersistence.chatSidebarCollapsed),
  chatAreaProps: {
    onContextUsageChange,
    connectionState: headerViewModel.headerConnectionState,
    isTemplatePanelOpen: panelOrchestration.isTemplatePanelOpen,
    onTemplatePanelOpenChange: panelOrchestration.setIsTemplatePanelOpen,
  }
}
```

这说明 ChatArea 收到的并不只是聊天业务自己的 props。

它拿到的是：

- 来自 header/runtime 的连接态
- 来自 context usage 的回写入口
- 来自 panel orchestration 的模板面板开合控制

也就是 Chat 区本身已经被接到壳层控制总线上了。

### 从工作原理怎么记这一层

```text
useAppViewModel() 先汇流
  ↓
useAppShellViewModel()
  ├─ 路由到 Sidebar
  ├─ 路由到 MainContent
  ├─ 路由到 ChatSidebar
  └─ 路由到 RightPanels
```

### 这一步的定位

**`desktop/src/hooks/useAppShellViewModel.ts` 不是一个“props 整理器”，而是 App Shell 的扇出路由层：负责把统一壳层状态按宿主出口拆分成四条明确 UI 通道。**

## 71. 为什么 Evaluation 分析的是最后一条 assistant 输出，而不是主编辑器正文

这点很容易误解。

直觉上会以为 EvaluationPanel 应该分析主编辑器里的正文。

但当前实现不是。

当前实现分析的是：**当前会话里最后一条 assistant 消息内容**。

源头在 `desktop/src/stores/selectors.ts:48-60`：

```ts
export function useLatestAssistantMessageContent(): string {
  return useAppStore((state) => {
    const { currentConversationId, conversationsById } = state
    if (!currentConversationId) return ''

    const messages = conversationsById[currentConversationId]?.messages || []
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.role === 'assistant') {
        return messages[index]?.content || ''
      }
    }

    return ''
  })
}
```

也就是它会从当前会话消息数组末尾反向扫描，找到最近一条 `role === 'assistant'` 的内容。

然后这个值在 `desktop/src/hooks/useAppViewModel.ts:15,36-43` 被接进壳层：

```ts
const latestAssistantContent = useLatestAssistantMessageContent()
...
return useAppShellViewModel({
  ...
  latestAssistantContent,
  ...
})
```

再由 `desktop/src/hooks/useAppShellViewModel.ts:79-89` 注入到右侧面板系统：

```ts
const appRightPanelsProps = {
  activeRightPanel: uiPersistence.activeRightPanel,
  settingsOpen: panelOrchestration.settingsOpen,
  latestAssistantContent,
  ...
}
```

最后在 `desktop/src/components/AppRightPanels.tsx:28-33` 中实际喂给 EvaluationPanel：

```tsx
{activeRightPanel === 'evaluation' && (
  <EvaluationPanel
    content={latestAssistantContent}
    onClose={closeRightPanel}
  />
)}
```

### 为什么可以确定 Evaluation 真的是内容驱动，而不是偷读别的状态

因为 `desktop/src/components/EvaluationPanel.tsx` 的多个子流程都直接用传进来的 `content`。

例如：

- `useEvaluationWorkflow({ content, ... })`
- `useEvaluationData({ content, ... })`
- `useEvaluationQualityCheck({ content, ... })`

而 `desktop/src/hooks/useEvaluationData.ts` 里还有这句：

```ts
useEffect(() => {
  runEvaluation()
}, [content])
```

这说明它是一个 **prop-driven、内容变化即重跑** 的评估面板。

它没有自己去抓编辑器正文，也没有自己去 store 里重新找别的文本源。

### 为什么当前产品会这样设计

因为现在 Evaluation 所在的工作语义更接近：

- **评估 AI 产出质量**
- **评估当前对话里最新一次 assistant 结果**

而不是：

- 评估文档编辑器中的整篇稿件

所以它被接在聊天会话输出线上，而不是编辑器正文线上。

### 从工作原理怎么记这层

```text
Conversation messages
  ↓
useLatestAssistantMessageContent()
  ↓
useAppViewModel()
  ↓
useAppShellViewModel()
  ↓
AppRightPanels
  ↓
<EvaluationPanel content={latestAssistantContent} />
```

### 这一步的定位

**当前 EvaluationPanel 是“对话结果评估器”，不是“整篇正文评估器”；它分析的输入源是当前会话最后一条 assistant 输出。**

## 72. Writing Helper 为什么既能续接上次草稿，又能从当前选区起步

Writing Helper 当前不是一个“打开就重置”的临时面板。

它被设计成 **可续接草稿 + 可从编辑器当前选区预填充** 的右侧工作台。

关键初始化逻辑在 `desktop/src/components/WritingHelperPanel.tsx`：

```tsx
const [content, setContent] = useState(() => {
  if (draftState?.content) return draftState.content
  // Prefill from editor selection
  const handle = getEditorHandle()
  if (handle) {
    const selected = handle.getSelectedText()
    if (selected.trim()) return selected
  }
  return ''
})
```

这个初始化优先级非常清楚：

1. **先用壳层传下来的 `draftState.content`**
2. 没有草稿时，再尝试 **从编辑器当前选区取文本**
3. 再没有，才落到空字符串

这意味着它同时支持两种工作方式。

### 第一种：续接型工作流

如果用户上次已经在 Writing Helper 里填了一部分内容，那么草稿会优先恢复。

而且它不是只在打开时读一次。

`desktop/src/components/WritingHelperPanel.tsx` 里还有回写：

```tsx
useEffect(() => {
  onDraftStateChange?.({ content, mode, maxSentences, maxItems })
}, [content, mode, maxSentences, maxItems, onDraftStateChange])
```

也就是说：

- 你在面板里改内容
- 改 mode
- 改 maxSentences / maxItems
- 这些都会持续回写到壳层 draft state

所以关闭再开不是“重新来过”，而是“接着上次继续”。

### 第二种：选区起步型工作流

如果没有草稿，Writing Helper 会去找编辑器句柄：

```ts
const handle = getEditorHandle()
const selected = handle.getSelectedText()
```

这表示它能把当前编辑器中被选中的一段文字，作为本次润色/改写/扩写/提纲处理的输入种子。

所以它又不是孤立面板。

它和编辑器之间已经通过 editor handle 建了一条轻量桥接线。

### 壳层为什么能让它真正“可续接”

因为 `desktop/src/hooks/useAppShellViewModel.ts:79-89` 把 `writingHelperDraft`、`setWritingHelperDraft`、`clearWritingHelperDraft` 全部注入给右侧面板系统。

而 `desktop/src/components/AppRightPanels.tsx:36-42` 又把这些继续交给 `WritingHelperPanel`：

```tsx
<WritingHelperPanel
  onClose={closeRightPanel}
  onOpenSettings={openSettingsFromWritingHelper}
  draftState={writingHelperDraft}
  onDraftStateChange={setWritingHelperDraft}
  onClearDraft={clearWritingHelperDraft}
/>
```

所以它不是自己在局部组件里偷偷记一份临时 state。

它背后已经有壳层级的持久化/续接支持。

### Header AI 快捷动作为什么会影响它的初始模式

更进一步，主区头部 AI 快捷按钮还会先改写 draft mode。

见 `desktop/src/hooks/useAppShellViewModel.ts:113-127`：

```ts
onAiWrite: () => {
  uiPersistence.setWritingHelperDraft({ ...uiPersistence.writingHelperDraft, mode: 'polish' })
  panelOrchestration.toggleRightPanel('writingHelper')
}
```

其他按钮同理，会写入：

- `rewrite`
- `expand`
- `outline`

所以 Writing Helper 打开时，不只是内容能续接，连“当前任务类型”也能由入口动作预设。

### 从工作原理怎么记这层

```text
已有 draftState.content ?
  ├─ 是 → 直接恢复草稿
  └─ 否 → 读取 editor selected text
            ├─ 有选区 → 用选区起步
            └─ 无选区 → 空白开始

编辑过程中
  ↓
onDraftStateChange(...)
  ↓
壳层 draft 持续更新
```

### 这一步的定位

**Writing Helper 是一个“壳层可续接、编辑器可取种子、入口可预设模式”的右侧写作工作台，不是一次性弹窗工具。**

## 73. Chat 协作线为什么不是孤立聊天框，而是壳层明确接线的一条协作通道

表面看，右边只是一个 ChatSidebar。

但从壳层接线看，它不是独立小窗，而是一条被明确编排进 App Shell 的 **协作通道**。

先看结构位置：`desktop/src/App.tsx`

```tsx
<Sidebar {...sidebarProps} />
<AppMainContent {...appMainContentProps} />
<ChatSidebar {...chatSidebarProps} />
<AppRightPanels {...appRightPanelsProps} />
```

这说明 ChatSidebar 不是漂浮插件，也不是某个页面内部组件。

它和：

- 左侧导航
- 主内容区
- 右侧功能面板

并列处在壳层四大出口之一。

### ChatSidebar 自己其实只是一个宿主壳

`desktop/src/components/ChatSidebar.tsx` 很薄：

```tsx
export function ChatSidebar({ chatAreaProps, chatSidebarCollapsed }: ChatSidebarProps) {
  return (
    <aside ...>
      <ChatArea {...chatAreaProps} />
    </aside>
  )
}
```

所以真正关键的不是 ChatSidebar 自己，而是 **谁在给它接线**。

答案就是 `useAppShellViewModel()`。

### Chat 协作线被接了哪几条壳层总线

`desktop/src/hooks/useAppShellViewModel.ts:137-145`

```ts
const chatSidebarProps = {
  chatSidebarCollapsed: uiPersistence.chatSidebarCollapsed,
  onToggleChatSidebar: () => uiPersistence.setChatSidebarCollapsed(!uiPersistence.chatSidebarCollapsed),
  chatAreaProps: {
    onContextUsageChange,
    connectionState: headerViewModel.headerConnectionState,
    isTemplatePanelOpen: panelOrchestration.isTemplatePanelOpen,
    onTemplatePanelOpenChange: panelOrchestration.setIsTemplatePanelOpen,
  }
}
```

这 4 条线非常关键：

1. **折叠状态线**：chat sidebar 本身是壳层可折叠区域，不是局部临时面板
2. **连接状态线**：ChatArea 用的是 header/runtime 同一套 `connectionState`
3. **模板面板线**：ChatArea 可直接驱动 `isTemplatePanelOpen`
4. **context usage 回写线**：ChatArea 会把上下文使用量往壳层回传

### 为什么说它是“协作线”而不是“纯聊天线”

因为它并不只负责显示消息。

它还和这些系统互通：

- **运行态系统**：连接状态来自 `headerViewModel`
- **模板系统**：模板面板开关来自 `panelOrchestration`
- **上下文预算系统**：context usage 能回传到壳层，再投影到头部使用量 UI

也就是说，ChatArea 在这里承担的是：

- 对话输入输出
- 模板辅助打开
- 上下文预算回报
- 运行态状态共享

它已经是一个协作工作面，而不是单纯 message list。

### 为什么这条线对整个写作工作流重要

因为现在 Niko-Studio 的写作工作流不是“编辑器单线工作流”。

它至少有三条并行工作线：

1. **主正文线**：`AppMainContent` / `DocumentEditor`
2. **协作生成线**：`ChatSidebar` / `ChatArea`
3. **右侧工具线**：`AppRightPanels` 下的 Evaluation / Writing Helper / Optimizer / Knowledge

其中 Chat 协作线的价值在于：

- 它可以承接 prompt/template 驱动的生成与协作
- 它能把运行态和上下文消耗及时反馈给壳层
- 它和主区、右侧工具区共享同一个 shell orchestration 体系

所以它不是外挂聊天框，而是写作工作流里的正式协作通道。

### 从工作原理怎么记这层

```text
Shell routing
  ↓
chatSidebarProps
  ├─ collapsed state
  ├─ connectionState
  ├─ template panel open/close
  └─ context usage callback
  ↓
ChatSidebar
  ↓
ChatArea
  ↓
协作生成 / 模板调用 / context 回传
```

### 这一步的定位

**ChatSidebar/ChatArea 在当前架构里承担的是“壳层协作通道”角色：它和运行态、模板系统、上下文预算系统是联通的，而不是孤立聊天框。**

## 74. `AppMainContent` 为什么只是主内容宿主，而不是自己管理正文工作流

`desktop/src/components/AppMainContent.tsx:14-29` 非常薄：

```tsx
export function AppMainContent({
  headerProps,
  restoreStatus,
  contextEstimatedText,
  onOpenWritingHelper,
}: AppMainContentProps) {
  return (
    <main ...>
      <AppHeader {...headerProps} />
      <AppRestoreStatusBanner restoreStatus={restoreStatus} />
      <DocumentEditor onOpenWritingHelper={onOpenWritingHelper} />
      <AppContextFooter contextEstimatedText={contextEstimatedText} />
    </main>
  )
}
```

这说明 `AppMainContent` 的角色不是“正文编辑控制器”，而是 **主内容宿主容器**。

它负责把主区拆成 4 个稳定层次：

1. **Header 层**：`AppHeader`
2. **恢复状态提示层**：`AppRestoreStatusBanner`
3. **正文编辑层**：`DocumentEditor`
4. **上下文估算 footer 层**：`AppContextFooter`

### 为什么这一层要保持很薄

因为主内容区里同时存在：

- 顶部运行态/检查点/AI 快捷入口
- 中间正文编辑工作面
- 底部上下文预算提示

如果 `AppMainContent` 自己再去管正文 state、AI 生成、导出、世界观面板状态，它就会变成第二个壳层。

但当前实现没有这么做。

它只是把上层已经路由好的东西摆进主区。

也就是：

- **Header 的控制逻辑留在壳层 view-model**
- **正文编辑逻辑留在 `DocumentEditor`**
- **恢复状态留在 checkpoint 相关链路**
- **上下文估算显示留在 footer 投影层**

### 这说明主内容区的真正结构是什么

主内容区不是一个单一编辑器。

它是一个分层工作面：

```text
AppMainContent
  ├─ AppHeader         ← 操作/运行态/检查点入口
  ├─ RestoreBanner     ← 恢复反馈
  ├─ DocumentEditor    ← 正文主工作面
  └─ ContextFooter     ← token/context 估算提示
```

### 这一步的定位

**`desktop/src/components/AppMainContent.tsx` 是正文工作面的宿主骨架，不负责业务决策，而负责把“头部控制、恢复提示、正文编辑、上下文提示”稳定排布在同一个主区通道里。**

## 75. `DocumentEditor` 为什么已经不是单纯编辑框，而是正文主工作面

`desktop/src/components/DocumentEditor.tsx:14-113` 已经不只是“一个编辑器组件”。

它其实是正文主线的 **工作面总成**。

先看结构：

```tsx
<div className="flex-1 flex flex-col ...">
  <div className="...">
    <div className="...">
      <input ... />
      <div className="w-full h-px ..." />
      <NikoEditor ... />
    </div>

    <StoryBiblePanel />
  </div>

  <div className="...">
    ... status bar ...
  </div>
</div>
```

也就是说它至少包含 4 部分：

1. **标题输入**
2. **正文富文本编辑器 `NikoEditor`**
3. **Story Bible 工作台**
4. **底部状态栏（统计 / 导出 / AI 状态 / 自动保存提示）**

所以它不是“正文输入框”，而是一个完整写作面板。

### 它在内部维护了哪几类正文运行态

`desktop/src/components/DocumentEditor.tsx:16-21`

```ts
const [title, setTitle] = useState(t.appTitle || '未命名文档')
const [editorText, setEditorText] = useState('')
const [editorJson, setEditorJson] = useState<JSONContent | null>(null)
const [showSaved, setShowSaved] = useState(false)
const [aiGenerating, setAiGenerating] = useState(false)
```

这几项很关键：

- `title`：文档标题
- `editorText`：纯文本投影，用于字数/字数统计/阅读时长
- `editorJson`：TipTap 结构化文档，用于导出
- `showSaved`：自动保存反馈提示
- `aiGenerating`：编辑器 AI 生成状态投影

这说明 `DocumentEditor` 维护的不是单一数据，而是 **正文工作面需要的多个不同抽象层投影**。

### 为什么这里同时保留 text 和 json 两种正文表示

关键更新入口在 `desktop/src/components/DocumentEditor.tsx:29-37`：

```ts
const handleEditorUpdate = useCallback((json: JSONContent, text: string) => {
  setEditorJson(json)
  setEditorText(text)
  ...
}, [])
```

也就是 NikoEditor 每次更新，会同时把：

- **结构化文档 JSON**
- **纯文本 text**

都回传上来。

这样做的原因很直接：

- **统计链** 需要 text
- **导出链** 需要 json
- **UI 提示链** 需要一个轻量易计算的表示

所以 `DocumentEditor` 其实是在做正文数据的 **双表示管理**。

### Story Bible 为什么放在正文主工作面内部

`desktop/src/components/DocumentEditor.tsx:73`

```tsx
<StoryBiblePanel />
```

它没有被放到右侧面板，也没有被做成 modal。

这说明 Story Bible 在当前产品定位里不是辅助弹窗，而是正文创作工作面的一部分。

也就是：

- 上面写正文
- 下面维护人物/世界观/大纲/风格偏好

这是同一条写作主线，不是附属工具链。

### 状态栏为什么也属于正文工作面的组成部分

状态栏显示的不是纯装饰信息。

它承接了 4 类正文运行信号：

1. AI 生成中：`aiGenerating`
2. 字数统计：`stats.words`
3. 字符统计：`stats.chars`
4. 阅读时长：`stats.readingTime`
5. 导出操作：`exportToMarkdown` / `exportToHtml`
6. 自动保存反馈：`showSaved`

这表示正文工作面底部其实是个 **运行状态条**。

### 从工作原理怎么记这层

```text
DocumentEditor
  ├─ title state
  ├─ editorText  → 统计链
  ├─ editorJson  → 导出链
  ├─ StoryBible  → 世界观/人物/风格工作台
  └─ status bar  → AI状态/统计/导出/保存反馈
```

### 这一步的定位

**`desktop/src/components/DocumentEditor.tsx` 是正文主工作面，不只是输入框；它把标题、TipTap 正文、Story Bible、统计导出状态栏整合成一块连续写作画布。**

## 76. `NikoEditor` 为什么是“编辑器内 AI 工作台”，而不是只换成了 TipTap

如果只看表面，会以为 `NikoEditor` 只是把原来的 textarea 换成 TipTap。

但 `desktop/src/components/NikoEditor.tsx:48-316` 实际上是 **富文本编辑 + 编辑器内 AI 交互 + 全局桥接句柄** 的综合节点。

### 第一层：它先是一个 TipTap 富文本编辑器

核心初始化在：`desktop/src/components/NikoEditor.tsx:62-160`

```ts
const editor = useEditor({
  extensions: [
    StarterKit.configure(...),
    Placeholder.configure({ placeholder: t.editorPlaceholder }),
    Underline,
    TextStyle,
    Typography,
  ],
  content: initialContent ?? '',
  ...
})
```

这意味着正文已经不是原始字符串输入，而是基于 TipTap document model 的结构化富文本编辑。

### 第二层：它内建了 slash command，而不是把 AI 按钮放到外围

`handleKeyDown` 会在输入 `/` 时激活 slash menu：`desktop/src/components/NikoEditor.tsx:82-105`

然后在 `handleSlashSelect()` 里把命令路由到两类动作：

1. **AI 类动作**
   - `ai-generate`
   - `ai-continue`
   - `ai-full-article`
2. **格式类动作**
   - heading / list / quote / code block / horizontal rule

也就是说，AI 生成入口已经被放进编辑器命令系统本身，而不是停留在编辑器外部按钮层。

### 第三层：它还有选区级 bubble toolbar

`desktop/src/components/NikoEditor.tsx:138-159` 会在有选区时激活 bubble state。

然后渲染：

```tsx
<BubbleToolbar
  editor={editor}
  position={bubbleState.position}
  onRewrite={handleRewrite}
  onContinue={handleContinue}
  onClose={() => setBubbleState(EMPTY_BUBBLE)}
/>
```

这意味着选中一段文字时，编辑器会就地出现：

- 改写
- 续写
- 富文本格式动作

所以 AI 不只是“面板级工具”，已经深入到正文局部编辑动作里了。

### 第四层：它通过 `useEditorAI()` 直接接上生成链

`desktop/src/components/NikoEditor.tsx:187-197`

```ts
const ai = useEditorAI({
  editor,
  getStyleInstruction: () => {
    try {
      const raw = localStorage.getItem('niko.writing-helper-style-v1')
      return raw ? `风格要求：${raw}` : ''
    } catch {
      return ''
    }
  },
})
```

这说明：

- 编辑器内 AI 不是独立 demo 功能
- 它会读取写作风格配置
- 它和 Writing Helper 的 style 存储存在联通

也就是说，编辑器内 AI 和右侧 Writing Helper 并不是两套完全断开的系统。

### 第五层：它会把自己注册成全局 editor handle

这是整个正文链很关键的一步：`desktop/src/components/NikoEditor.tsx:173-185`

```ts
handleRef.current.insertText = (text: string) => {
  editor.chain().focus().insertContent(text).run()
}
handleRef.current.getSelectedText = () => {
  const { from, to } = editor.state.selection
  return editor.state.doc.textBetween(from, to, '\n')
}
handleRef.current.getJSON = () => editor.getJSON()
setEditorHandle(handleRef.current)
```

而 `desktop/src/utils/editorHandle.ts:15-24` 是 module-level ref：

```ts
let currentHandle: EditorHandle | null = null

export function setEditorHandle(handle: EditorHandle | null): void {
  currentHandle = handle
}

export function getEditorHandle(): EditorHandle | null {
  return currentHandle
}
```

这表示 NikoEditor 会把自己暴露成一个 **跨组件共享的编辑器桥接句柄**。

所以别的面板不需要 prop drilling，也能：

- 读取当前选区
- 向正文插入文本
- 获取当前 JSON
- 感知是否 AI 生成中

### 为什么这一步非常重要

因为这正是右侧工具和正文编辑器能互通的基础桥。

没有它：

- Writing Helper 很难从正文选区起步
- Optimizer 很难把结果回插正文
- DocumentEditor 很难轮询 AI 生成态

所以 `NikoEditor` 的价值不只是 TipTap，而是 **把编辑器从“局部输入控件”升级成“可被工作流周边系统访问的中心节点”**。

### 从工作原理怎么记这层

```text
TipTap editor
  ├─ onUpdate → text/json 回传给 DocumentEditor
  ├─ slash menu → AI/格式命令
  ├─ bubble toolbar → 选区级改写/续写
  ├─ useEditorAI() → 编辑器内生成链
  └─ setEditorHandle() → 向外暴露桥接能力
```

### 这一步的定位

**`desktop/src/components/NikoEditor.tsx` 不是“换了个富文本库”的结果，而是正文主线里的编辑器内 AI 工作台与跨组件桥接中心。**

## 77. 为什么正文统计、导出、AI 状态都挂在 `DocumentEditor`，而不是各管一摊

当前实现把这些都集中在 `DocumentEditor`，不是偶然。

因为它是正文工作面的最近上层，刚好拿得到 `NikoEditor` 回传的两种核心表示：

- `text`
- `json`

### 统计链为什么基于 `text`

`desktop/src/components/DocumentEditor.tsx:23-27`

```ts
const stats = useMemo(() => ({
  words: countWords(editorText),
  chars: countChars(editorText),
  readingTime: readingTimeMinutes(editorText),
}), [editorText])
```

说明统计逻辑关心的是“读者看到的文本量”，而不是 TipTap 节点结构。

所以它依赖纯文本投影最自然。

### 导出链为什么基于 `json`

状态栏里导出按钮只在 `editorJson` 存在时显示：`desktop/src/components/DocumentEditor.tsx:90-104`

```tsx
{editorJson && (
  <>
    <button onClick={() => exportToMarkdown(editorJson, title)}>
      {t.exportMarkdown}
    </button>
    <button onClick={() => exportToHtml(editorJson, title)}>
      {t.exportHtml}
    </button>
  </>
)}
```

因为导出需要保留结构信息：

- heading
- list
- blockquote
- code block
- marks

这些只有 JSON document model 里才完整。

### 导出工具本质上在做什么

`desktop/src/utils/export.ts` 的实现很直白：

- `nodeToMarkdown(node)`：递归把 TipTap JSON 转成 Markdown
- `nodeToHtml(node)`：递归把 TipTap JSON 转成 HTML
- `downloadFile(...)`：把结果变成 Blob 并触发下载

所以导出链不是从 DOM 抄一遍，也不是从纯文本糊一个文件。

而是：

```text
TipTap JSON
  ↓
递归节点转换
  ↓
Markdown / HTML 字符串
  ↓
Blob 下载
```

### AI 状态为什么也被 `DocumentEditor` 接住

`desktop/src/components/DocumentEditor.tsx:39-46`

```ts
useEffect(() => {
  const id = setInterval(() => {
    const handle = getEditorHandle()
    setAiGenerating(handle?.isGenerating ?? false)
  }, 500)
  return () => clearInterval(id)
}, [])
```

这说明主工作面会通过共享 editor handle 轮询编辑器 AI 运行态，再把它显示到状态栏。

于是正文底部状态条就能统一显示：

- AI 正在生成
- 当前字数 / 字符数 / 阅读时长
- 可导出格式
- 自动保存提示

这样用户在同一块正文工作面里，就能看到最关键的运行反馈。

### 为什么这比把能力分散到多个子组件更合理

因为：

- 统计依赖 `text`
- 导出依赖 `json`
- AI 状态依赖 `editor handle`
- 标题又在 `DocumentEditor` 自己这里

把这些放在 `DocumentEditor`，刚好形成最近的一层汇聚。

否则就会出现：

- 一个组件只管统计
- 一个组件只管导出
- 一个组件只管标题
- 一个组件只管 AI 状态

结果反而增加跨层通信复杂度。

### 这一步的定位

**`DocumentEditor` 是正文工作面的最近汇聚层，所以统计链、导出链、AI 状态条都自然挂在这里，而不是被拆成互相拉扯的零散子系统。**

## 78. `StoryBiblePanel` 为什么不是资料展示区，而是世界观工作台

`desktop/src/components/StoryBiblePanel.tsx:81-325` 虽然叫 panel，但它不只是展示人物/地点列表。

它实际把世界观相关的创作工作拆成了多段可折叠工作区。

### 它有哪些状态层

从 state 就能看出来：

```ts
const [characters, setCharacters] = useState<GraphItem[]>([])
const [locations, setLocations] = useState<GraphItem[]>([])
const [braindump, setBraindump] = useState(() => loadFromStorage('niko.sb-braindump-v1'))
const [genres, setGenres] = useState<string[]>(...)
const [synopsis, setSynopsis] = useState(() => loadFromStorage('niko.sb-synopsis-v1'))
const [outline, setOutline] = useState(() => loadFromStorage('niko.sb-outline-v1'))
const [selectedStyle, setSelectedStyle] = useState<StyleId>(...)
const [loading, setLoading] = useState(true)
```

这里混合了两类数据：

1. **从知识图谱/后端读取的数据**
   - `characters`
   - `locations`
2. **本地创作中间态**
   - `braindump`
   - `genres`
   - `synopsis`
   - `outline`
   - `selectedStyle`

所以它不是只读展示区，而是“读已有知识 + 写当前创作规划”的双向工作台。

### 为什么说它是工作台而不是简单表单

因为它把创作过程拆成了多个语义阶段：

- Braindump：先倒想法
- Genre：定义题材
- Synopsis：压缩成梗概
- Characters：查看人物资料
- Worldbuilding：查看地点/世界设定
- Style：选创作风格模式
- Outline：写章节/情节结构

这其实对应的是写作前期的策划链，而不是单一表单。

### 它怎么接已有知识库数据

`desktop/src/components/StoryBiblePanel.tsx:127-152`

```ts
const [charResult, locResult] = await Promise.allSettled([
  queryGraph('MATCH (c:Character) RETURN c LIMIT 50'),
  queryGraph('MATCH (l:Location) RETURN l LIMIT 50'),
])
```

然后：

```ts
setCharacters(toGraphItems(charResult.value.data, 'c'))
setLocations(toGraphItems(locResult.value.data, 'l'))
```

这说明 Story Bible 不是凭空维护一份虚拟人物列表。

它会向图数据层查询已有角色和地点，再投影成前端卡片列表。

所以它和 Knowledge / Graph 系统已经有真实接线。

### 它怎么保留创作中间态

这里用了本地存储封装：

```ts
function loadFromStorage(key: string): string { ... }
function saveToStorage(key: string, value: string) { ... }
```

再配合：

- `niko.sb-braindump-v1`
- `niko.sb-genres-v1`
- `niko.sb-synopsis-v1`
- `niko.sb-outline-v1`
- `niko.sb-style-v1`

这说明 Story Bible 的本地工作状态是可恢复的，不是页面一刷新就丢。

### 风格选择为什么重要

它不是简单标签。

当前至少有 4 个风格模式：

- `tried`
- `matchMy`
- `soundsLike`
- `custom`

这说明 Story Bible 还承担一部分“写作方法偏好设定”的工作，而不是只做人物百科。

### 为什么它被放在正文下面很关键

因为这表示当前产品认知是：

- 世界观整理
- 人物整理
- 题材选择
- 梗概与大纲准备

都属于正文写作主线的一部分。

不是“另开一个资料管理子系统”再切过去。

### 从工作原理怎么记这层

```text
StoryBiblePanel
  ├─ localStorage 创作中间态
  ├─ queryGraph() 读取角色/地点
  ├─ 可折叠分段工作区
  └─ 与正文主画布同屏协作
```

### 这一步的定位

**`desktop/src/components/StoryBiblePanel.tsx` 是世界观工作台：既吸收已有图谱知识，又保存当前创作策划中间态，与正文主画布构成同一条写作主线。**

## 79. 编辑器 ↔ 右侧 AI 的完整闭环：为什么它不是一次调用，而是一条往返链路

表面上看，编辑器、Writing Helper、Text Optimizer 都能“处理文本”，所以很容易误以为它们只是同一个 AI 能力的三个按钮。

实际工作流不是这样。

这里跑的是一条**往返链路**：

```text
正文编辑器产生当前上下文
  ↓
NikoEditor 把 editor handle 注册到模块级桥接层
  ↓
右侧面板启动时通过 getEditorHandle() 读取选区 / 文档能力
  ↓
用户在右侧面板完成一轮批处理或专项优化
  ↓
结果先停留在右侧结果区，而不是直接覆盖正文
  ↓
用户明确点击“插入到编辑器”
  ↓
handle.insertText(...) 把结果送回 TipTap 正文
```

这说明它不是“一次 API 调用后就结束”的单点动作，而是：

- 编辑器先提供上下文
- 右侧工具独立处理
- 结果再显式回写正文

中间起桥作用的是模块级 editor handle。

`desktop/src/utils/editorHandle.ts:8`

```ts
export interface EditorHandle {
  insertText: (text: string) => void
  getSelectedText: () => string
  getJSON: () => JSONContent
  isGenerating?: boolean
}
```

它只暴露三类最核心能力：

- 从正文取当前选区
- 向正文插入文本
- 读取正文结构化内容

这意味着右侧面板并不直接持有编辑器实例，也不需要通过多层 props 传递 editor 对象。

### 79.1 这条闭环是在哪里被接起来的

闭环的起点在 `NikoEditor`。它在编辑器可用后，把实际的 TipTap 能力挂到 `handleRef.current`，再注册到模块级共享句柄。

`desktop/src/components/NikoEditor.tsx:54`

```ts
handleRef.current.insertText = (text: string) => {
  editor.chain().focus().insertContent(text).run()
}
handleRef.current.getSelectedText = () => {
  const { from, to } = editor.state.selection
  return editor.state.doc.textBetween(from, to, '\n')
}
handleRef.current.getJSON = () => editor.getJSON()
setEditorHandle(handleRef.current)
```

这一步做的不是“把编辑器传出去”，而是把编辑器压缩成一个非常窄的桥接接口。

所以右侧工具层拿到的是：

- 当前选区文本
- 插入能力
- 导出 JSON 能力

而不是整个编辑器内部状态树。

这让桥接保持在最小必要范围内。

### 79.2 为什么说它是往返链路而不是直接覆盖

看 `WritingHelperPanel` 的初始化逻辑：

`desktop/src/components/WritingHelperPanel.tsx:63`

```ts
const [content, setContent] = useState(() => {
  if (draftState?.content) return draftState.content
  const handle = getEditorHandle()
  if (handle) {
    const selected = handle.getSelectedText()
    if (selected.trim()) return selected
  }
  return ''
})
```

它的输入顺序是：

1. 先恢复壳层里保存的草稿
2. 没草稿时再读取当前编辑器选区
3. 都没有才空白启动

也就是说，右侧工具拿到正文内容时不是强耦合“实时镜像”，而是**把正文当成上下文来源之一**。

处理完成后，也不是自动把正文覆盖掉，而是停在结果区等待用户确认：

`desktop/src/components/WritingHelperPanel.tsx:257`

```tsx
onClick={() => {
  const handle = getEditorHandle()
  if (handle) handle.insertText(result.processedText || '')
}}
```

所以这条链路的关键特征是：

- 取文：自动预填
- 处理：在侧边独立完成
- 回写：必须显式确认

这就是典型的人在回路（human-in-the-loop）闭环，而不是自动替换链。

### 79.3 `DocumentEditor` 自己也在消费这条桥

这条桥并不只给右侧面板用，`DocumentEditor` 本身也会通过它观察编辑器运行态。

`desktop/src/components/DocumentEditor.tsx:39`

```ts
useEffect(() => {
  const id = setInterval(() => {
    const handle = getEditorHandle()
    setAiGenerating(handle?.isGenerating ?? false)
  }, 500)
  return () => clearInterval(id)
}, [])
```

状态栏里的“AI 正在生成”不是右侧面板单独维护的，而是主编辑区通过同一个 handle 读取编辑器当前生成状态。

这说明 editor handle 不只是“文本搬运桥”，也是**正文工作区读取编辑器运行状态的观测点**。

### 这一步的定位

**编辑器 ↔ 右侧 AI 的关系不是一个组件直接调用另一个组件，而是通过 editor handle 形成“正文取上下文 → 右侧处理 → 用户确认 → 回写正文”的往返闭环。**

## 80. `WritingHelperPanel` 为什么是“带草稿记忆的侧向处理台”，而不是临时弹出工具

`WritingHelperPanel` 最容易被误解成一个“选中文本后弹出来跑一下”的轻量工具。

但它的状态设计说明，它更接近一个**可持续停留的处理台**。

先看它的草稿结构：

`desktop/src/components/WritingHelperPanel.tsx:22`

```ts
interface WritingHelperPanelDraftState {
  content: string
  mode: WritingHelperMode
  maxSentences: number
  maxItems: number
}
```

这几个字段覆盖的是一次完整处理会话需要保留的核心状态：

- 待处理文本
- 处理模式
- 句子长度约束
- 列表输出约束

这不是一次瞬时命令的输入模型，而是一块可以来回调整参数的工作面。

### 80.1 它会持续把会话草稿同步回壳层

`desktop/src/components/WritingHelperPanel.tsx:96`

```ts
useEffect(() => {
  onDraftStateChange?.({ content, mode, maxSentences, maxItems })
}, [content, mode, maxSentences, maxItems, onDraftStateChange])
```

这说明只要用户在右侧面板里改了文本、模式或参数，壳层就会收到最新草稿。

结果是：

- 面板关闭再打开，不一定丢内容
- 用户可以把它当成一个处理中的工作台，而不是一次性弹窗
- 壳层可以在跨区域切换时保留上下文

所以它真正承担的是**右侧 AI 加工会话的中间态容器**。

### 80.2 它的处理模型是“完整提交一次任务”

`desktop/src/components/WritingHelperPanel.tsx:187`

```ts
const response = await processWritingHelper({
  content,
  mode,
  max_sentences: maxSentences,
  max_items: maxItems,
  instruction: styleInstruction,
  detection_evasion_guard_enabled: detectionEvasionGuardEnabled,
  ...getProviderFields(),
})
```

这个调用模型有几个特征：

- 输入是一整块文本
- 模式是明确枚举值
- 参数是完整打包提交
- 返回后再显示处理结果

所以它更像：

```text
提交处理任务
  → 等待完整结果
  → 在结果区审阅
  → 决定是否写回正文
```

而不是编辑器里那种“边生成边写回”的即时体验。

### 80.3 为什么它必须带草稿记忆

因为 Writing Helper 解决的是“慢变量问题”。

它服务的典型时刻不是：

> 我马上在光标处补一句。

而是：

> 我想拿一段文本做改写、扩写、总结、列提纲，还想来回调整参数和风格。

这种任务天然会发生：

- 多次重试
- 参数来回切换
- 处理结果对比
- 暂停后继续

如果没有草稿记忆，这类工作会非常割裂。

所以它被设计成侧向处理台，而不是临时命令弹层。

### 这一步的定位

**`WritingHelperPanel` 不是“执行一下就消失”的临时工具，而是可保留草稿、可调参数、可审阅结果、可显式回写正文的右侧批处理工作台。**

## 81. `AiTextOptimizer` 为什么是结果后处理器，而不是正文生成器

`AiTextOptimizer` 虽然也能读编辑器选区，但它的任务模型并不是“生成正文”。

它从一开始就是围绕“把已有文本按某种专项策略再处理一遍”来设计的。

`desktop/src/components/AiTextOptimizer.tsx:17`

```ts
type OptimizerPreset =
  | 'humanize'
  | 'aiGuide'
  | 'characterNarrative'
  | 'literaryPolish'
  | 'academicPaper'
  | 'custom'
```

这些 preset 指向的都不是“写一篇新文章”，而是：

- 人性化改写
- AI 痕迹诊断 / 规避导向
- 角色化叙事改造
- 文学性增强
- 学术风格优化
- 自定义重写策略

这决定了它天然是**后处理器**，不是起稿器。

### 81.1 它的默认输入来自“已有文本”

`desktop/src/components/AiTextOptimizer.tsx:154`

```ts
const [content, setContent] = useState(() => {
  const handle = getEditorHandle()
  if (handle) {
    const selected = handle.getSelectedText()
    if (selected.trim()) return selected
  }
  return ''
})
```

它默认先尝试读取当前选区。

这说明它的预期场景是：

- 正文里已经有一段内容
- 用户觉得这段内容还不够好
- 想按某种策略再打磨一次

这不是“从零生成一段正文”的产品语义。

### 81.2 两步模式更能证明它是后处理器

`desktop/src/components/AiTextOptimizer.tsx:231`

```ts
if (twoStepMode) {
  const analysisResp = await processWritingHelper({ ... })
  const diagnosisText = analysisResp.data.processed_text || ''
  setDiagnosis(diagnosisText)

  const rewriteResp = await processWritingHelper({ ... })
  setResult(rewriteResp.data.processed_text || '')
}
```

这里的流程不是：

```text
直接生成正文
```

而是：

```text
先诊断已有文本的问题
  ↓
再按诊断结果进行改写
```

这本质上是“分析 → 修复”的优化链，而不是“构思 → 生成”的创作链。

### 81.3 它和 Writing Helper 的差别不在壳，而在问题模型

两者都挂在右侧面板区，但任务建模不同：

- `WritingHelperPanel`：通用文本处理
- `AiTextOptimizer`：专项预设优化

前者问的是：

> 我要做哪一类常规处理？

后者问的是：

> 我要按哪一种强约束策略重新打磨已有结果？

所以 Text Optimizer 更像**精修工位**，不是正文生产线。

### 这一步的定位

**`AiTextOptimizer` 的职责不是生成正文，而是基于已有文本做诊断式、预设式、策略式再加工，所以它属于结果后处理层。**

## 82. `useEditorAI` 为什么说是最靠近光标的 AI 层

如果说右侧面板处理的是“整段任务”，那 `useEditorAI` 处理的就是“当前落笔点”。

它的接口定义已经把这个定位写得很清楚：

`desktop/src/hooks/useEditorAI.ts:24`

```ts
export interface UseEditorAIReturn {
  isGenerating: boolean
  generateAtCursor: (instruction: string) => Promise<void>
  rewriteSelection: (instruction: string) => Promise<void>
  continueWriting: () => Promise<void>
  cancel: () => void
}
```

这里每个动作都直接绑定编辑器当前态：

- 当前光标
- 当前选区
- 当前上下文

所以它不是“对一段文本做批处理”，而是“对正在编辑的位置做即时 AI 辅助”。

### 82.1 它拿上下文的方式就是围绕当前落点

生成时，它只截取光标前的一段上下文：

`desktop/src/hooks/useEditorAI.ts:104`

```ts
const { from } = editor.state.selection
const textBefore = editor.state.doc.textBetween(
  Math.max(0, from - 2000),
  from,
  '\n',
)
const prompt = `${instruction}

上下文：
${textBefore}`
```

续写时，也是基于当前位置之前的文本：

`desktop/src/hooks/useEditorAI.ts:135`

```ts
const { from } = editor.state.selection
const textBefore = editor.state.doc.textBetween(
  Math.max(0, from - 3000),
  from,
  '\n',
)
const prompt = `请续写以下内容，保持风格和语气一致：

${textBefore}`
```

改写时，则直接绑定当前选区：

`desktop/src/hooks/useEditorAI.ts:119`

```ts
const { from, to } = editor.state.selection
const selectedText = editor.state.doc.textBetween(from, to, '\n')
if (!selectedText.trim()) return
editor.chain().focus().deleteSelection().run()
```

所以它不是“面向文档整体”的 AI，而是**面向当前编辑位置**的 AI。

### 82.2 它的反馈方式也是最靠近编辑动作的

`useEditorAI` 不是等待完整结果后再统一显示，而是先在正文里插入占位，再把流式 token 逐块写回。

`desktop/src/hooks/useEditorAI.ts:52`

```ts
const pos = insertLoadingIndicator(editor)
const placeholderLen = 3
const streamer = streamTextIntoEditor(editor, pos, placeholderLen)
```

随后通过 `/writing/stream` 的回调持续写回正文：

`desktop/src/hooks/useEditorAI.ts:64`

```ts
await streamWritingHelper(
  { ... },
  {
    onContent: (chunk) => {
      streamer.append(chunk)
    },
    onDone: () => {
      streamer.finish()
    },
  },
)
```

这意味着用户看到的不是“另一块区域刷新出结果”，而是正文光标附近直接长出内容。

这正是“最靠近光标”的真正含义。

### 82.3 为什么它必须是 hook，而不是右侧面板

因为这套能力必须直接拿到：

- `editor.state.selection`
- `editor.chain()`
- 文档当前位置前文
- 当前选区替换操作

这些都属于编辑器内部语义。

如果强行把它做成右侧面板：

- 光标语义会被削弱
- 实时流式插入会变绕
- slash command / bubble toolbar 触发链会变重

所以它被封装成 hook，并由 `NikoEditor` 直接消费，是符合交互层级的设计。

### 这一步的定位

**`useEditorAI` 是离编辑器状态、当前光标、当前选区最近的一层 AI 能力，因此负责即时生成、续写、就地改写，而不是右侧批处理。**

## 83. 把 79～82 串起来：正文、右侧工具、编辑器内 AI 到底怎么协同

把这几层放回同一个工作流里，结构就很清楚了。

### 83.1 同一条正文主线上的三种 AI 协作方式

可以把它们记成三层：

```text
第 1 层：正文主画布
  - DocumentEditor
  - NikoEditor

第 2 层：最靠近光标的即时 AI
  - useEditorAI
  - slash command
  - bubble toolbar

第 3 层：右侧专项处理台
  - WritingHelperPanel
  - AiTextOptimizer
```

它们的分工分别是：

- `DocumentEditor`：提供主写作画布、状态栏、导出、运行态显示
- `useEditorAI`：在当前落笔点即时生成 / 改写 / 续写
- `WritingHelperPanel`：做通用批处理
- `AiTextOptimizer`：做专项后处理

### 83.2 它们不是替代关系，而是工作时刻不同

用户在不同写作时刻，会进入不同层：

```text
正在写正文
  → 需要马上补一句 / 续一段
  → 用 useEditorAI

已经有一段文本
  → 想做通用改写 / 扩写 / 总结
  → 用 WritingHelperPanel

已经有结果
  → 想做人性化、文学化、角色化等强策略优化
  → 用 AiTextOptimizer
```

所以这三层并不是功能重复，而是对应三种不同的写作决策时刻。

### 83.3 editor handle 是它们能协同的最小公共接口

真正把这几层串起来的不是 props 链，也不是全局编辑器实例，而是这个最小桥接面：

- `getSelectedText()`
- `insertText()`
- `getJSON()`
- `isGenerating`

这让：

- 右侧工具可以读取当前正文上下文
- 处理结果可以回写正文
- 主状态栏可以观察编辑器 AI 状态
- 导出逻辑可以读取结构化文档内容

同时又不把 TipTap 整套内部细节扩散到整个应用。

### 83.4 从程序结构上怎么理解这套协同

最终可以把当前写作工作流记成下面这张结构图：

```text
DocumentEditor
  ├─ NikoEditor
  │   ├─ TipTap 文档状态
  │   ├─ useEditorAI（光标级即时 AI）
  │   └─ setEditorHandle(...)
  │
  ├─ StoryBiblePanel（世界观策划）
  │
  └─ Status Bar
      ├─ 字数 / 字符 / 阅读时长
      ├─ AI 生成状态
      └─ Markdown / HTML 导出

AppRightPanels
  ├─ WritingHelperPanel（通用批处理）
  └─ AiTextOptimizer（专项后处理）
```

所以当前 Niko-Studio 的“写作 AI”并不是集中在某一个超级组件里，而是按工作时刻分层嵌入在正文主线周围。

### 这一步的定位

**当前 Niko-Studio 的正文、编辑器内 AI、右侧 AI 工具不是彼此替代，而是通过 editor handle 和 shell 编排形成同一条写作主线上的分层协作系统。**
