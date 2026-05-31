# Niko Studio UI 设计文档

**版本**: 2.0
**日期**: 2026-06-01
**平台**: Tauri v2 Desktop (Rust + React 19)
**技术栈**: React 19 + TipTap + Tailwind CSS v3 + Zustand + Lucide Icons
**目标用户**: 中文网络小说作者

> 本文档为 niko-studio 桌面端全面 UI 设计规范，涵盖设计哲学、布局体系、主题系统、排版规范、组件库、页面设计、交互模式、数据可视化和无障碍标准。

---

## 一、设计哲学

### 1.1 核心原则

| 原则 | 含义 | 实践 |
|------|------|------|
| **内容优先** | 编辑器是工作区的绝对中心，一切 UI 为写作服务 | 编辑区占据最大面积，面板可收可放，绝不遮挡正文 |
| **键盘驱动** | 作者的手不应频繁离开键盘 | 所有操作都有快捷键，Command Palette 覆盖全部功能 |
| **渐进展示** | 信息按需呈现，不一次性倾倒 | 面板默认折叠摘要，点击展开详情；评估先给结论再给维度 |
| **以作者为中心** | 界面语言和流程匹配网文创作心智模型 | 流程步骤用"写作-评估-修订-追踪"而非技术术语；建议总是可操作的 |

### 1.2 设计决策框架

面对设计取舍时，按以下优先级判断：

```
可读性 > 效率 > 美观 > 一致性 > 可扩展性
```

- **可读性**：正文区 line-height 1.8，面板区 1.5；中文正文 18px 起步
- **效率**：3 次点击内触达核心功能；快捷键覆盖高频操作
- **美观**：不添加无功能意义的装饰；动效服务于理解而非炫技
- **一致性**：同类组件遵循相同交互模式，但不为一致牺牲可读性
- **可扩展性**：CSS 变量系统支持新增叙事维度色彩、面板类型

### 1.3 与 Cherry Studio 的差异定位

Cherry Studio 是通用 AI 聊天客户端，niko-studio 是专业写作工具。核心差异：

| 维度 | Cherry Studio | niko-studio |
|------|--------------|-------------|
| 核心场景 | 多模型对话 | 长篇小说创作 |
| 主交互 | 对话流 | 编辑器 + AI 辅助 |
| 信息密度 | 中等 | 高（叙事维度、伏笔追踪） |
| 面板系统 | 侧边栏固定 | 右侧浮动面板，按需组合 |
| 特色功能 | 知识库、模型切换 | 叙事分析、伏笔追踪、Craft Skills |

---

## 二、布局系统

### 2.1 主布局结构

应用采用经典的 **左导航 + 中编辑 + 右面板** 三栏布局，外加可折叠的对话侧边栏：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AppHeader (h-14)                                   │
│  [项目标题] [AI 工具栏]            [连接状态] [上下文环] [检查点] [面板开关]  │
├──────┬───────────┬───────────────────────────────────┬──────────┬───────────┤
│      │           │                                   │          │           │
│ Side │  Project  │        Main Content               │  Chat    │   Right   │
│ bar  │  Sidebar  │                                   │  Sidebar │   Panel   │
│      │           │  ┌─────────────────────────────┐  │          │           │
│ w:72 │  w:200-   │  │    WorkflowStepsNavigator    │  │  w:240-  │   w:320-  │
│ -288 │  480      │  ├─────────────────────────────┤  │  560     │   400     │
│      │           │  │    Context Bar (optional)    │  │          │           │
│      │           │  ├─────────────────────────────┤  │          │           │
│ Nav  │  Chapter  │  │                             │  │  Chat    │  Eval /   │
│ +    │  List     │  │      DocumentEditor         │  │  Area    │  Foreshad │
│ Flow │  +        │  │      (TipTap)               │  │          │  / NarrVis │
│ Steps│  Workspace│  │                             │  │          │  / Skills  │
│      │  Summary  │  │                             │  │          │  / ...     │
│      │           │  ├─────────────────────────────┤  │          │           │
│      │           │  │    AppContextFooter          │  │          │           │
│      │           │  └─────────────────────────────┘  │          │           │
├──────┴───────────┴───────────────────────────────────┴──────────┴───────────┤
│                          ToastContainer (fixed)                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 面板体系

所有面板分为两大类：

**固定面板**（始终占据布局位置）：

| 面板 | 宽度 | 可折叠 | 可拖拽调整 | 位置 |
|------|------|--------|-----------|------|
| Sidebar | 72-288px | 是（72px 折叠态） | 是（200-480px） | 最左 |
| ProjectSidebar | 200-480px | 随 Sidebar 折叠 | 是 | Sidebar 右侧 |
| ChatSidebar | 240-560px | 是（0px 折叠态） | 是 | 主内容右侧 |
| MainContent | flex-1 | 否 | 自适应 | 中间 |

**浮动面板**（lazy-loaded，覆盖在右侧）：

| 面板 ID | 名称 | 宽度 | 触发方式 |
|---------|------|------|---------|
| `evaluation` | 深度评估 | 320px | Sidebar Step 1 / Header |
| `analysis` | 智能分析 | 400px | Sidebar Step 1 |
| `evaluationDrillDown` | 评估细分 | 400px | Sidebar Step 2 |
| `patternDashboard` | 模式仪表板 | 400px | Sidebar Step 2 |
| `foreshadowingTracker` | 伏笔追踪 | 400px | Sidebar Step 3 |
| `characterRelationships` | 角色关系 | 400px | Sidebar Step 3 |
| `narrativeVisualization` | 叙事可视化 | 400px | Sidebar Step 4 |
| `sessionAnalytics` | 会话分析 | 400px | Sidebar Step 4 |
| `writingHelper` | 写作助手 | 400px | Header / Eval 面板 |
| `textOptimizer` | 文本优化器 | 400px | Header |
| `automation` | 自动化面板 | 400px | Eval 面板 |
| `knowledge` | 知识库 | 800px | Sidebar 底部 |
| `settings` | 设置 | 800px | Sidebar 底部 |
| `mcpStatus` | MCP 状态 | 400px | Sidebar 底部 |
| `templateBrowser` | 模板浏览器 | 400px | Header |
| `workflowEditor` | 工作流编辑器 | 400px | Eval 面板 |

### 2.3 响应行为

| 窗口宽度 | 布局调整 |
|----------|---------|
| >= 1440px | 完整五栏布局，所有面板可用 |
| 1024-1439px | Sidebar 折叠为图标态（72px），Chat 侧边栏默认折叠 |
| < 1024px | ProjectSidebar 隐藏，浮动面板覆盖全宽 |

```css
@media (max-width: 1024px) {
  :root {
    --sidebar-width: 72px;  /* 强制折叠 */
  }
}
```

### 2.4 拖拽调整

所有可调整面板使用 `PanelResizeHandle` 组件，遵循统一规则：

- 拖拽手柄宽度 4px，hover 时高亮为主题色 30% 透明度
- 双击重置为默认宽度
- 拖拽过程中禁用 CSS transition，松手后恢复
- 宽度持久化到 localStorage（键格式：`niko.{panel-name}-width-v1`）

---

## 三、色彩与主题系统

### 3.1 主题架构

采用 CSS 变量 + Tailwind `darkMode: 'class'` 双层系统：

```
CSS 变量层（Design Tokens）
    ↓
Tailwind 扩展层（语义化 class）
    ↓
组件层（组合语义 class）
```

当前两套主题：

| 主题 | 名称 | 适用场景 |
|------|------|---------|
| Light | **Sorbet** | 日间写作、明亮环境 |
| Dark | **Aurora/Charcoal** | 夜间写作、长时间创作 |

### 3.2 CSS 变量完整定义

#### 亮色主题（Sorbet）

```css
:root {
  /* 品牌与 CTA */
  --primary-cta: #4808d1;
  --primary-cta-hover: #6530d8;
  --primary-cta-active: #7240dd;

  /* 灰度梯度 */
  --grey-0: #f8fafc;  /* 背景底色 */
  --grey-1: #e2e8f0;  /* 边框 */
  --grey-2: #94a3b8;  /* 次要文本 */
  --grey-3: #64748b;  /* 辅助文本 */
  --grey-4: #334155;  /* 深色文本 */

  /* 语义文本 */
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;

  /* 语义表面 */
  --surface-base: #f8fafc;
  --surface-elevated: #ffffff;
  --surface-sunken: #f1f5f9;
  --document-background: #ffffff;
  --document-canvas: #f8fafc;

  /* 边框 */
  --border-default: #e2e8f0;
  --border-subtle: #cbd5e1;

  /* 阴影 */
  --shadow-tiny: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-default: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-card: 0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04);

  /* 圆角 */
  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-pill: 20px;

  /* 侧边栏 */
  --sidebar-bg: #f8fafc;
  --sidebar-text: #0f172a;
  --sidebar-text-secondary: #64748b;

  /* 焦点 */
  --focus-outline: #312e81;
  --focus-outline-soft: rgba(99, 102, 241, 0.22);
}
```

#### 暗色主题（Aurora/Charcoal）

```css
.dark {
  --primary-cta: #4f46e5;
  --primary-cta-hover: #6366f1;
  --primary-cta-active: #4338ca;

  --grey-0: #0f172a;
  --grey-1: #1e293b;
  --grey-2: #334155;
  --grey-3: #475569;
  --grey-4: #64748b;

  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;

  --surface-base: #0f172a;
  --surface-elevated: #1e293b;
  --surface-sunken: #0f172a;
  --document-background: #1a1a1a;
  --document-canvas: #0f0f0f;

  --border-default: #334155;
  --border-subtle: #475569;

  --shadow-tiny: 0 1px 2px rgba(0,0,0,0.2);
  --shadow-default: 0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2);
  --shadow-card: 0 4px 12px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2);

  --sidebar-bg: #0f172a;
  --sidebar-text: #f8fafc;
  --sidebar-text-secondary: #94a3b8;

  --focus-outline: #c4b5fd;
  --focus-outline-soft: rgba(196, 181, 253, 0.24);
}
```

### 3.3 叙事维度色彩

为 20+ 叙事评估维度定义专属色彩，使仪表板和信息密度高的面板可快速扫视：

| 维度类别 | 色系 | CSS 变量 | 用途 |
|----------|------|---------|------|
| 结构（LOCK） | Indigo | `--dim-structure` | Lead, Objective, Confrontation, Knockout |
| 风格 | Violet | `--dim-style` | 五感描写、语言风格、万物有灵 |
| 逻辑 | Emerald | `--dim-logic` | 叙事逻辑、时间线、一致性 |
| 情感 | Rose | `--dim-emotion` | 情感张力、节奏控制 |
| 角色 | Amber | `--dim-character` | 角色一致性、对话潜台词 |
| 伏笔 | Cyan | `--dim-foreshadow` | 伏笔种植、暗示、收束 |

```css
:root {
  --dim-structure: #4f46e5;
  --dim-style: #7c3aed;
  --dim-logic: #059669;
  --dim-emotion: #e11d48;
  --dim-character: #d97706;
  --dim-foreshadow: #0891b2;
}

.dark {
  --dim-structure: #818cf8;
  --dim-style: #a78bfa;
  --dim-logic: #34d399;
  --dim-emotion: #fb7185;
  --dim-character: #fbbf24;
  --dim-foreshadow: #22d3ee;
}
```

### 3.4 功能色

```css
:root {
  /* 状态色 */
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
  --color-info: #3b82f6;

  /* 评估判定 */
  --eval-passed: #10b981;    /* APPROVED */
  --eval-revise: #f59e0b;    /* REVISE */
  --eval-rewrite: #ef4444;   /* REWRITE */

  /* 伏笔状态 */
  --foreshadow-planted: #0891b2;   /* 已种植 */
  --foreshadow-approaching: #f59e0b; /* 接近收束 */
  --foreshadow-due: #ef4444;        /* 逾期未收 */
  --foreshadow-harvested: #10b981;  /* 已收束 */
}
```

### 3.5 特效色彩

用于高级视觉反馈，谨慎使用：

```css
/* Glassmorphism — 毛玻璃面板 */
.glass-panel {
  background: rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(12px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.3);
}
.dark .glass-panel {
  background: rgba(30, 41, 59, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* Glow — 交互强调 */
.glow-primary { box-shadow: 0 0 15px rgba(114, 64, 221, 0.35); }
.glow-emerald { box-shadow: 0 0 15px rgba(16, 185, 129, 0.35); }
.glow-rose    { box-shadow: 0 0 15px rgba(239, 68, 68, 0.35); }
```

---

## 四、排版系统

### 4.1 字体栈

针对中文网文创作优化，区分 UI 字体和正文编辑器字体：

```css
/* UI 字体 — 界面元素 */
--font-sans: 'Inter', system-ui, -apple-system, BlinkMacSystemFont,
             'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;

/* 正文编辑器字体 — 阅读优先 */
--font-serif: 'Merriweather', 'Lora', 'Noto Serif SC', 'Source Han Serif SC',
              Georgia, Cambria, 'Times New Roman', serif;

/* 等宽字体 — 代码块、指标数字 */
--font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, 'SFMono-Regular',
             Menlo, Monaco, Consolas, monospace;
```

**中文字体补充**：`Noto Serif SC` 和 `Source Han Serif SC` 作为 serif 字体栈的中文回退，确保正文渲染时中文显示为衬线体。

### 4.2 字号刻度

系统定义三套可切换字号档位，通过 `data-font-size` 属性控制：

| 用途 | 小 | 中（默认） | 大 |
|------|---|----------|---|
| **Label**（标签、辅助信息） | 11px | 12px | 13px |
| **Compact**（面板正文、列表项） | 12px | 13px | 14px |
| **UI**（主界面文字、按钮） | 13px | 14px | 15px |

```css
[data-font-size='small']  { --shell-font-label: 0.6875rem; --shell-font-compact: 0.75rem;   --shell-font-ui: 0.8125rem; }
[data-font-size='medium'] { --shell-font-label: 0.75rem;   --shell-font-compact: 0.8125rem; --shell-font-ui: 0.875rem; }
[data-font-size='large']  { --shell-font-label: 0.8125rem; --shell-font-compact: 0.875rem;  --shell-font-ui: 0.9375rem; }
```

### 4.3 编辑器排版

编辑器（TipTap ProseMirror）使用独立的排版规范，追求长时间阅读舒适：

```css
.niko-editor-content .ProseMirror {
  max-width: 680px;       /* 最佳阅读行宽 */
  margin: 0 auto;         /* 居中排布 */
  font-family: var(--font-serif);
  font-size: 1.125rem;    /* 18px — 中文正文起步 */
  line-height: 1.8;       /* 宽松行距，中文阅读舒适 */
  padding: 2rem 1rem;
}

/* 标题使用 sans-serif 保持层次感 */
.niko-editor-content .ProseMirror h1 {
  font-size: 2.2em;
  font-weight: 700;
  line-height: 1.3;
  font-family: var(--font-sans);
}

.niko-editor-content .ProseMirror h2 {
  font-size: 1.6em;
  font-weight: 600;
  line-height: 1.35;
  font-family: var(--font-sans);
}
```

### 4.4 行高标准

| 场景 | 行高 | 说明 |
|------|------|------|
| 编辑器正文 | 1.8 | 长时间阅读，中文需要更宽松行距 |
| 面板正文 | 1.5 | 信息密度与可读性平衡 |
| 面板紧凑区 | 1.4 | 列表项、数据行 |
| 标题 | 1.3-1.35 | 紧凑，突出层级 |

---

## 五、组件库

### 5.1 基础组件

#### IntelligenceCard

叙事智能面板的通用卡片容器：

```tsx
<div className="intelligence-card">
  {/* 内容 */}
</div>
```

```css
.intelligence-card {
  background: var(--surface-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  box-shadow: var(--shadow-tiny);
  transition: box-shadow 0.2s ease-in-out;
}
.intelligence-card:hover {
  box-shadow: var(--shadow-default);
}
```

#### CollapsibleSection

可折叠区块，StoryBible 和各面板通用：

```
┌─ [icon] 标题文字 ──────────────── [v] ─┐
│                                          │
│  折叠内容区（默认展开/收起可配置）         │
│                                          │
└──────────────────────────────────────────┘
```

- 点击标题行切换展开/收起
- 展开动画：max-height + opacity 过渡 200ms
- `defaultOpen` 属性控制初始状态

#### FlowStepBadge

四步流程导航徽标：

```
普通态:    (1)  灰色圆形
活跃态:    (1)  主题色脉冲光环
完成态:    (✓)  主题色实心
```

#### ContextRing

上下文用量环形指示器：

```
    ┌───┐
    │42%│  ← SVG 圆环 + 居中百分比
    └───┘
 <10% 灰色  |  70-90% 琥珀  |  >90% 红色
```

#### PanelResizeHandle

面板拖拽调整手柄：

- 4px 宽透明条
- Hover: 主题色 30% 透明度
- 拖拽中: 主题色 50% 透明度 + cursor: col-resize
- 双击重置为默认宽度

### 5.2 导航组件

#### Sidebar

左侧主导航，包含品牌标识、新建按钮、文档列表、工作区摘要、底部导航和四步流程入口：

```
┌──────────────────┐
│  [✨] Niko Studio │  ← 品牌 + 折叠按钮
├──────────────────┤
│  [+ 新建文档]     │  ← 主 CTA
├──────────────────┤
│  工作区摘要卡片    │  ← 项目/章节/故事圣经
│  [继续写作][故事圣经]│
├──────────────────┤
│  文档列表         │  ← 虚拟化（>50 项时）
│  ├ 第1章 ...      │
│  ├ 第2章 ...      │
│  └ ...           │
├──────────────────┤
│  [模板库]         │  ← 底部固定导航
│  [知识库]         │
│  [MCP]            │
│  [设置]           │
├──────────────────┤
│  Writer Intel     │  ← 四步流程
│  ① 写作与评估 ── │
│  │               │
│  ② 评估与修订 ── │
│  │               │
│  ③ 修订与追踪 ── │
│  │               │
│  ④ 叙事追踪     │
└──────────────────┘
```

**折叠态**（72px）：品牌图标 + 新建按钮 + 图标列表 + 四步圆形徽标 + hover 浮出菜单。

#### WorkflowStepsNavigator

编辑器上方的步骤快切条，与 Sidebar 四步流程联动：

```
  (1) ────── (2) ────── (3) ────── (4)
  写作评估    评估修订    修订追踪    叙事追踪
```

- 当前步骤高亮，已完成步骤实心
- 点击步骤切换右侧面板

### 5.3 编辑器组件

#### DocumentEditor

核心写作区，基于 TipTap：

```
┌───────────────────────────────────────┐
│  BubbleToolbar (选中文本时浮出)         │
│  [加粗][斜体][标题][引用][代码]         │
├───────────────────────────────────────┤
│                                       │
│        ProseMirror 编辑区              │
│        (max-width: 680px 居中)         │
│        font: Merriweather, 18px        │
│        line-height: 1.8               │
│                                       │
├───────────────────────────────────────┤
│  SlashCommandMenu (/ 触发)             │
│  /heading  /quote  /code              │
│  /callout  /math   /table             │
└───────────────────────────────────────┘
```

**TipTap 扩展**：
- `SlashCommandExtension` — `/` 斜杠命令菜单
- `Callout` — 提示块（写作笔记、AI 注释）
- `MathBlock` / `MathInline` — 数学公式（KaTeX）
- `ShowTellMark` / `ShowTellDecorations` — Show/Tell 标注
- `VoiceConsistencyDecorations` — 语气一致性内联标注
- `WritingStyle` — 写作风格装饰

### 5.4 面板组件

#### 通用面板 Shell

所有右侧浮动面板共享相同的外壳结构：

```
┌────────────────────────────────────┐
│  [icon] 面板标题          [× 关闭]  │  ← 固定头
├────────────────────────────────────┤
│  步骤指示器（如适用）               │
├────────────────────────────────────┤
│  摘要区（首屏可见的结论性信息）       │
├────────────────────────────────────┤
│                                    │
│  详情区（可滚动）                   │
│  - CollapsibleSection 组合          │
│  - IntelligenceCard 网格            │
│  - 数据行列表                       │
│                                    │
├────────────────────────────────────┤
│  操作栏（如适用）                   │  ← 固定底
└────────────────────────────────────┘
```

面板 Shell CSS class：

```css
/* 通用面板外壳 */
.panel-shell {
  height: 100%;
  width: 400px; /* 或 320px / 800px */
  border-left: 1px solid var(--border-default);
  background: var(--surface-elevated);
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
}
```

#### EvaluationPanel

评估面板是使用频率最高的面板之一，采用渐进展示：

```
┌──────────────────────────────┐
│  [📊] 深度评估          [×]  │
├──────────────────────────────┤
│  (1) ─── (2) ─── (3) ─── (4)│  ← 流程步骤
├──────────────────────────────┤
│  来源: [最近助手回复 ▼]       │  ← 评估来源选择
│                              │
│  综合评分:  7.2 / 10         │  ← 大字评分
│  [✓ 可用 — 小修即可]          │  ← 判定结论
├──────────────────────────────┤
│  ▼ 先看结论                   │  ← 默认展开
│  主要反馈文字...               │
│  建议 1: xxx [生成修改][→助手] │
│  建议 2: xxx [生成修改][→助手] │
│  还有 3 条建议...              │
├──────────────────────────────┤
│  ► 详细评估                   │  ← 默认收起
│  ► 更多工具                   │  ← 默认收起
│    - 质量检查                  │
│    - 多轮修订                  │
│    - 一致性治理                │
│    - 工作流编排                │
│    - 检查点                    │
└──────────────────────────────┘
```

#### ForeshadowingTrackerPanel

伏笔追踪面板，时间线分组视图：

```
┌──────────────────────────────┐
│  [👁] 伏笔追踪          [×]  │
├──────────────────────────────┤
│  统计: 已种植 12 | 接近 3 |   │
│        逾期 1 | 已收 8        │
├──────────────────────────────┤
│  ── 逾期未收 (1) ─────────── │
│  🔴 [伏笔ID] 谜团真相         │
│     种植: 第3章 | 预期: 第8章 │
│     [查看原文] [标记收束]      │
├──────────────────────────────┤
│  ── 接近收束 (3) ─────────── │
│  🟡 [伏笔ID] 角色秘密         │
│     种植: 第5章 | 预期: 第9章 │
│  🟡 [伏笔ID] 道具伏笔         │
│     种植: 第2章 | 预期: 第10章 │
├──────────────────────────────┤
│  ── 已种植 (12) ──────────── │
│  🔵 [伏笔ID] ...             │
│  🔵 [伏笔ID] ...             │
├──────────────────────────────┤
│  ── 已收束 (8) ──────────── │
│  🟢 [伏笔ID] ...             │
└──────────────────────────────┘
```

---

## 六、页面设计

### 6.1 写作工作区

写作工作区是应用的核心页面，由 AppHeader + WorkflowStepsNavigator + ContextBar + DocumentEditor + AppContextFooter 组成：

```
┌──────────────────────────────────────────────────────────────┐
│ AppHeader                                                    │
│  [第7章 暗夜追踪] [写作][改写][描写][风暴][助手][优化]        │
│                                      [🔵连接][42%][检查点][▥] │
├──────────────────────────────────────────────────────────────┤
│ WorkflowStepsNavigator                                       │
│  (1)写作评估 ─── (2)评估修订 ─── (3)修订追踪 ─── (4)叙事追踪  │
├──────────────────────────────────────────────────────────────┤
│ Context Bar (有工作区时显示)                                   │
│  上下文  [第7章] [暗夜追踪项目] [悬疑故事圣经]                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                                                              │
│              ProseMirror 编辑区 (680px 居中)                  │
│                                                              │
│  月光透过老旧窗户的缝隙，在灰尘飞扬的档案架间投下斑驳的影子。    │
│  李凡推开吱呀作响的木门，手电筒的光束在昏暗的空间里晃动——       │
│                                                              │
│                                                              │
│                                                              │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ ContextFooter                                                │
│  预计 ~2,400 tokens | ████████░░ 42%                         │
└──────────────────────────────────────────────────────────────┘
```

**关键交互**：

| 操作 | 触发 | 效果 |
|------|------|------|
| AI 写作 | Header 按钮或 `Ctrl+Shift+W` | 在光标位置生成续写内容 |
| AI 改写 | Header 按钮或 `Ctrl+Shift+R` | 改写选中文本 |
| AI 描写 | Header 按钮或 `Ctrl+Shift+D` | 增强选中文本的感官描写 |
| AI 头脑风暴 | Header 按钮或 `Ctrl+Shift+B` | 打开多角色头脑风暴 |
| 斜杠命令 | 编辑器内输入 `/` | 弹出 SlashCommandMenu |
| 浮动工具栏 | 选中文本 | BubbleToolbar 浮出 |
| 写作助手 | Header 按钮或评估面板接力 | 右侧打开 WritingHelperPanel |

### 6.2 知识浏览器

知识浏览器（KnowledgeModal）采用全高覆盖式面板，三任务分区：

```
┌──────────────────────────────────────────────────────────────┐
│  [📖] 知识库                                           [×]  │
├──────────────────────────────────────────────────────────────┤
│  [🔍 查找]  |  [✨ 增强]  |  [📖 引用]                       │  ← 任务 Tab
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─ 范围提示 ────────────────────────────────────────┐      │
│  │  当前范围: [第7章] [暗夜追踪] [悬疑圣经]             │      │
│  │  在当前项目范围内查找角色、地点和情节实体             │      │
│  └───────────────────────────────────────────────────┘      │
│                                                              │
│  ┌─ 搜索框 ──────────────────────────────────────────┐      │
│  │  🔍 搜索角色、地点、情节...                          │      │
│  └───────────────────────────────────────────────────┘      │
│                                                              │
│  [👤 角色]  [📍 地点]  [📖 情节]                              │  ← 实体 Tab
│                                                              │
│  ┌─ 实体浏览区 ──────────────────────────────────────┐      │
│  │                                                    │      │
│  │  ┌─ 选中详情 ──────────────────────────────┐     │      │
│  │  │  李凡                                    │     │      │
│  │  │  主角侦探，性格内敛...                    │     │      │
│  │  │  [提升为 Canon] [关闭]                    │     │      │
│  │  │  性格: INTJ                               │     │      │
│  │  │  动机: 寻找失踪案真相                      │     │      │
│  │  │  关键事件: ...                             │     │      │
│  │  └──────────────────────────────────────────┘     │      │
│  │                                                    │      │
│  │  角色列表 / 地点列表 / 情节列表                     │      │
│  │                                                    │      │
│  └───────────────────────────────────────────────────┘      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**增强模式** 子视图：

- **Memory** — 添加记忆条目（MemoryForm），写入 Nowledge Mem
- **Skills** — 浏览和安装 Craft Skills（SkillTab），搜索 + 分类

**引用模式** — 展示当前项目范围内的 Canon 页面，提供参考引用。

### 6.3 叙事分析仪表板

叙事分析由多个面板组合构成，核心是 EvaluationPanel + NarrativeVisualizationPanel：

#### 评估摘要视图（EvaluationPanel 首屏）

```
┌──────────────────────────┐
│  [📊] 深度评估       [×]  │
├──────────────────────────┤
│  来源: 最近助手回复 ▼     │
│                          │
│      7.2                 │  ← 大字评分
│      /10                 │
│                          │
│  ┌──────────────────┐   │
│  │ ✓ 可用 — 小修即可 │   │  ← 判定结论
│  └──────────────────┘   │
│                          │
│  核心维度:               │
│  结构 ████████░░ 8.0     │  ← Indigo
│  风格 ██████░░░░ 6.5     │  ← Violet
│  逻辑 █████████░ 9.0     │  ← Emerald
│                          │
│  模块细分:               │
│  LOCK-L  9/10  LOCK-O  7/10│
│  LOCK-C  8/10  LOCK-K  2/10│
│  五感描写 7  对话 7       │
│  角色 8     节奏 6        │
└──────────────────────────┘
```

#### 叙事可视化面板（NarrativeVisualizationPanel）

三视图切换：

```
┌──────────────────────────────────────────┐
│  Narrative Visualization            [×]  │
├──────────────────────────────────────────┤
│  [Timeline] [Tension] [Character Graph]  │  ← 视图切换
├──────────────────────────────────────────┤
│                                          │
│  Timeline View:                          │
│  ─────────────────────────────           │
│  Ch1 ●─ Ch2 ●─ Ch3 ●── Ch4 ●           │
│  序章    接触    发展      高潮           │
│                                          │
│  Tension Curve View:                     │
│  ─────────────────────────────           │
│  ▁▃▅▇█▇▅▃▅▇█▆▃▁                        │
│  章节张力曲线                             │
│                                          │
│  Character Graph View:                   │
│  ─────────────────────────────           │
│     [李凡]────[张伟]                      │
│       │        │                         │
│     [陈警]──[王总]                        │
│       关系图谱                            │
│                                          │
└──────────────────────────────────────────┘
```

### 6.4 伏笔追踪器

详见 5.4 节 ForeshadowingTrackerPanel 设计。补充完整交互流程：

**种植伏笔**：
1. 在编辑器中选中文本 → 右键或 `/foreshadow` 斜杠命令
2. 弹出伏笔元信息表单（ID、预期收束章节、描述）
3. 文本获得 cyan 色内联标注
4. ForeshadowingTrackerPanel 自动更新

**收束伏笔**：
1. 在追踪面板点击逾期/接近条目
2. 点击"标记收束"按钮
3. 输入收束位置和方式
4. 状态从 planted → harvested

### 6.5 多角色头脑风暴

多角色头脑风暴通过 ChatArea + AiToolbar 协同实现：

```
┌──────────────────────────────────────────────┐
│  Chat Sidebar (头脑风暴模式)                   │
├──────────────────────────────────────────────┤
│                                              │
│  🤖 Architect (14:30:32)                     │
│  ┌─ 推理过程 ────────────────────────┐      │
│  │ 从结构角度分析，这一章需要...       │      │
│  └────────────────────────────────────┘      │
│  建议: 增加 第7章 的悬念拐点...               │
│                                              │
│  🤖 Writer (14:31:05)                        │
│  从叙事角度，建议在对话中增加潜台词层次...     │
│                                              │
│  🤖 Critic (14:31:28)                        │
│  当前 LOCK-K 评分偏低(2/10)，建议...          │
│                                              │
│  ── 交叉审查 ──────────────────────────      │
│  ⚠️ Architect 与 Writer 意见冲突:            │
│  Architect 建议加快节奏，Writer 建议铺陈氛围   │
│                                              │
│  ── 综合建议 ──────────────────────────      │
│  1. 前半段维持 Writer 建议的铺陈              │
│  2. 后半段采用 Architect 的节奏加速           │
│  3. 衔接点用 Critic 建议的转折暗示            │
│                                              │
├──────────────────────────────────────────────┤
│  [采纳并应用到编辑器] [继续讨论] [换角色]      │
├──────────────────────────────────────────────┤
│  💬 输入...                        [发送]     │
└──────────────────────────────────────────────┘
```

**角色面板配色**：

| 角色 | 颜色 | 图标 |
|------|------|------|
| Architect | `#3b82f6` (Blue) | Brain |
| Writer | `#10b981` (Emerald) | PenLine |
| Critic | `#f59e0b` (Amber) | AlertCircle |
| Commander | `#8b5cf6` (Violet) | Shield |

### 6.6 设置

设置面板（SettingsModal）采用全高覆盖式，分组 Tab 布局：

```
┌──────────────────────────────────────────────────────────┐
│  [⚙] 设置                                          [×]  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┬────────────────────────────────────┐   │
│  │ 通用         │                                    │   │
│  │ 外观         │  通用设置                          │   │
│  │ 语言         │                                    │   │
│  │ 提供商配置   │  字体大小: [小] [中●] [大]          │   │
│  │ Nowledge连接 │  主题: [浅色] [深色●] [跟随系统]   │   │
│  │ 引擎参数     │  语言: [简体中文●] [English]        │   │
│  │ 评估设置     │                                    │   │
│  │ 快捷键       │                                    │   │
│  │ 关于         │                                    │   │
│  └─────────────┴────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────┬────────────────────────────────────┐   │
│  │             │  提供商配置                          │   │
│  │             │                                    │   │
│  │             │  ┌─────────────────────────────┐   │   │
│  │             │  │ OpenAI                      │   │   │
│  │             │  │ API Key: sk-****            │   │   │
│  │             │  │ Base URL: https://api...    │   │   │
│  │             │  │ Model: gpt-4o ▼             │   │   │
│  │             │  │ [启用✓]  [测试连接]           │   │   │
│  │             │  └─────────────────────────────┘   │   │
│  │             │                                    │   │
│  │             │  [+ 添加提供商]                      │   │
│  └─────────────┴────────────────────────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**关键设置组**：

| 分组 | 内容 |
|------|------|
| 通用 | 字体大小、主题、语言、自动保存 |
| 提供商配置 | LLM 提供商注册表（API Key / Base URL / Model） |
| Nowledge 连接 | Nowledge Mem 服务地址、认证、同步状态 |
| 引擎参数 | 评估阈值、锁定维度、检测规避守卫 |
| 评估设置 | 质量目标、默认来源、自动评估 |
| 快捷键 | 自定义快捷键绑定 |
| 关于 | 版本信息、许可、更新检查 |

### 6.7 技能市场

45+ Craft Skills 的浏览与应用界面，嵌入知识库增强模式：

```
┌──────────────────────────────────────────────────────────┐
│  知识库 — 增强 — 技能                                     │
├──────────────────────────────────────────────────────────┤
│  🔍 搜索技能...                                          │
│                                                          │
│  分类: [全部] [结构] [风格] [逻辑] [情感] [角色] [伏笔]   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  🔧 Show, Don't Tell 检测                       │   │
│  │  识别"告诉"式叙事并建议"展示"式改写              │   │
│  │  类型: 风格 | 适用于: 对话、描写                   │   │
│  │  [一键应用] [查看示例]                             │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  🔧 情感弧线分析                                  │   │
│  │  追踪章节级别的情感走向，检测情感平坦区             │   │
│  │  类型: 情感 | 适用于: 全文                         │   │
│  │  [一键应用] [查看示例]                             │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  🔧 伏笔种植向导                                  │   │
│  │  在当前叙事中建议伏笔种植点，关联已有伏笔           │   │
│  │  类型: 伏笔 | 适用于: 章节                         │   │
│  │  [一键应用] [查看示例]                             │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ... 共 45+ 技能                                          │
└──────────────────────────────────────────────────────────┘
```

**技能分类与维度色彩对应**：

| 分类 | 数量 | 维度色 |
|------|------|--------|
| 结构 | 8 | Indigo |
| 风格 | 10 | Violet |
| 逻辑 | 7 | Emerald |
| 情感 | 6 | Rose |
| 角色 | 8 | Amber |
| 伏笔 | 6 | Cyan |

---

## 七、交互模式

### 7.1 键盘快捷键

| 快捷键 | 功能 | 上下文 |
|--------|------|--------|
| `Ctrl+Shift+P` | 打开 QuickPanel（命令面板） | 全局 |
| `Ctrl+Shift+W` | AI 写作（续写） | 编辑器 |
| `Ctrl+Shift+R` | AI 改写 | 编辑器（有选区） |
| `Ctrl+Shift+D` | AI 描写增强 | 编辑器（有选区） |
| `Ctrl+Shift+B` | AI 头脑风暴 | 编辑器 |
| `Ctrl+S` | 保存当前文档 | 全局 |
| `Ctrl+K` | 搜索 | 全局 |
| `Ctrl+/` | 斜杠命令 | 编辑器 |
| `Ctrl+Shift+E` | 打开评估面板 | 全局 |
| `Ctrl+Shift+F` | 打开伏笔追踪 | 全局 |
| `Ctrl+Shift+N` | 打开叙事可视化 | 全局 |
| `Ctrl+.` | 切换侧边栏折叠 | 全局 |
| `Ctrl+Shift+.` | 切换对话侧边栏 | 全局 |
| `Escape` | 关闭当前面板/模态框 | 面板 |
| `Tab` | 在面板内切换焦点区域 | 面板 |

### 7.2 QuickPanel（命令面板）

`Ctrl+Shift+P` 触发的全局命令面板：

```
┌──────────────────────────────────────┐
│  🔍 输入命令或搜索...                 │
├──────────────────────────────────────┤
│  最近使用                             │
│  > 打开评估面板                       │
│  > AI 续写                           │
│  > 伏笔追踪                          │
├──────────────────────────────────────┤
│  写作                                │
│  AI 续写        Ctrl+Shift+W         │
│  AI 改写        Ctrl+Shift+R         │
│  AI 描写        Ctrl+Shift+D         │
│  AI 头脑风暴    Ctrl+Shift+B         │
├──────────────────────────────────────┤
│  面板                                │
│  深度评估       Ctrl+Shift+E         │
│  伏笔追踪       Ctrl+Shift+F         │
│  叙事可视化     Ctrl+Shift+N         │
│  知识库                               │
│  设置                                 │
└──────────────────────────────────────┘
```

### 7.3 拖拽操作

| 场景 | 操作 | 效果 |
|------|------|------|
| 面板边界 | 拖拽 PanelResizeHandle | 调整面板宽度 |
| 面板边界 | 双击 PanelResizeHandle | 重置为默认宽度 |
| 编辑器内文本 | 选中文本 | BubbleToolbar 浮出 |
| 知识库实体 | 点击实体卡片 | 展开详情 + 更新工作区 focusEntityId |

### 7.4 内联建议

编辑器中的 AI 建议以内联标注形式呈现，不使用弹窗打断写作流：

| 标注类型 | 视觉效果 | 交互 |
|----------|---------|------|
| Show/Tell | 下划线 + 侧栏图标 | hover 弹出建议卡 |
| 语气不一致 | 波浪线 + amber 色 | hover 弹出修改建议 |
| 伏笔标记 | 左侧 cyan 色竖线 | 点击打开伏笔详情 |
| AI 续写预览 | 灰色半透明文字 | Tab 接受 / Esc 拒绝 |

### 7.5 分屏视图

当前不支持水平分屏，但面板系统天然构成"逻辑分屏"：

```
  编辑器 + 评估面板 = 写作 + 评估
  编辑器 + 写作助手 = 写作 + AI 辅助
  编辑器 + 伏笔追踪 = 写作 + 情节管理
  编辑器 + 对话侧边栏 = 写作 + 对话
```

---

## 八、数据可视化

### 8.1 情感弧线图（Emotional Arc Chart）

```
情感强度
  ▲
10│          ╱╲
 9│         ╱  ╲        ╱╲
 8│    ╱╲  ╱    ╲      ╱  ╲
 7│   ╱  ╲╱      ╲    ╱    ╲
 6│  ╱            ╲  ╱      ╲
 5│ ╱              ╲╱        ╲
 4│╱                          ╲
  └──────────────────────────────▶ 章节
   Ch1  Ch2  Ch3  Ch4  Ch5  Ch6
   序章  接触  发展  高潮  回落  新伏笔
```

实现：纯 CSS/SVG 折线图，`TensionCurveView` 组件。支持：
- 悬停显示章节详情
- 点击跳转到对应章节
- 多指标叠加（情感 + 节奏 + 张力）

### 8.2 满意度密度热图（Satisfaction Density Heatmap）

在编辑器侧栏或评估面板中，以色块密度表示各段落的评估得分分布：

```
  Ch1 ████████░░ 8.0  ← 高分段（绿色偏深）
  Ch2 ██████░░░░ 6.5  ← 中分段（黄色偏浅）
  Ch3 █████████░ 9.0  ← 优秀段（绿色最深）
  Ch4 ██░░░░░░░░ 2.0  ← 低分段（红色）
  Ch5 ███████░░░ 7.5  ← 良好段
```

实现：`ProgressBar` 组件，宽度映射分数，颜色映射 `getScoreColor()`。

### 8.3 风格雷达图（Style Radar Chart）

8 维度写作质量雷达图，在评估详情中展开显示：

```
           五感描写
             75
            ╱ ╲
    视觉 80╱   ╲70 对话
          ╱     ╲
  情感 78●───────●85 角色
          ╲     ╱
    节奏 62╲   ╱82 叙事
            ╲ ╱
           语言 76
```

实现：SVG 路径绘制，支持：
- hover 高亮维度
- 点击展开维度详情
- 历史对比（叠加半透明前次结果）

### 8.4 知识图谱力导向布局（Knowledge Graph Force Layout）

角色关系图谱，在 `CharacterGraphView` 中渲染：

```
        [李凡]────盟友────[陈警]
          │                │
        对手             同事
          │                │
        [王总]────利益────[张伟]
```

实现方案：
- 短期：纯 CSS 定位 + SVG 连线（无外部依赖）
- 长期：集成 Cytoscape.js（`@types/cytoscape` 已安装）

节点规则：
- 角色节点：圆形，角色名居中
- 关系边：带箭头 + 关系标签
- 颜色：节点按角色重要性渐变，边按关系类型着色

### 8.5 伏笔时间线（Foreshadow Timeline）

横向时间线，展示伏笔的种植-暗示-收束全周期：

```
Ch1    Ch3    Ch5    Ch7    Ch9    Ch10
 │      │      │      │      │      │
 ●──────○──────○──────◆──────│──────●
 种植   暗示1  暗示2  逾期!  │      收束
 │                             │
 └─────────────────────────────┘
          伏笔: 谜团真相
```

图例：
- `●` 种植/收束事件（实心圆）
- `○` 暗示事件（空心圆）
- `◆` 逾期标记（红色菱形）
- 连线颜色：planted=cyan, approaching=amber, due=red, harvested=green

---

## 九、无障碍

### 9.1 WCAG AA 达标要求

| 指标 | 目标 | 当前实现 |
|------|------|---------|
| 色彩对比度 | >= 4.5:1（正文）/ 3:1（大文本） | 亮色 #0f172a/#f8fafc ≈ 17:1 ✅ |
| 键盘可达 | 所有交互元素可 Tab 聚焦 | focus-visible 环 ✅ |
| 焦点指示 | 可见的焦点环 | 2px solid + 4px soft ring ✅ |
| 屏幕阅读器 | 语义化 HTML + ARIA | role, aria-label, aria-modal ✅ |
| 跳转链接 | 跳过导航直达主内容 | skip-link ✅ |

### 9.2 焦点管理

```css
*:focus-visible {
  outline: 2px solid var(--focus-outline);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px var(--focus-outline-soft);
  border-radius: 6px;
}
```

面板焦点陷阱（`useDialogFocusTrap`）：
- 面板打开时焦点移入面板
- Tab 循环在面板内
- Escape 关闭面板，焦点还原到触发元素

### 9.3 Skip Link

```html
<a href="#app-main-content" class="skip-link">
  跳到主内容
</a>
```

- 默认隐藏（translateY(-200%)）
- Tab 聚焦时显现
- 回车跳转到 `#app-main-content`

### 9.4 ARIA 语义

| 组件 | role | 关键 ARIA |
|------|------|----------|
| Sidebar | `aside` | `aria-label="导航"` |
| 面板 | `dialog` | `aria-modal="true"`, `aria-label` |
| 步骤徽标 | — | `aria-label` 包含步骤名 |
| 检查点菜单 | `dialog` | `aria-haspopup="dialog"`, `aria-expanded` |
| 上下文环 | — | `title` 包含百分比 |
| 虚拟列表 | `list` | item 为 `button` + `aria-label` |

### 9.5 动效偏好

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 十、动画与过渡

### 10.1 设计原则

动画服务于理解，而非装饰。遵循：

1. **目的性**：每个动效必须解释"什么变了"或"东西去了哪里"
2. **简短**：最长 300ms，大多数 150-250ms
3. **可中断**：不阻塞用户操作
4. **可关闭**：尊重 `prefers-reduced-motion`

### 10.2 动效清单

| 动效 | 时长 | 缓动 | 用途 |
|------|------|------|------|
| `fadeIn` | 200ms | ease-out | 面板内容出现 |
| `slideInRight` | 250ms | cubic-bezier(0.16, 1, 0.3, 1) | 右侧面板滑入 |
| `slideOutRight` | 200ms | ease-in | 面板滑出 |
| `pulseSubtle` | 2000ms | cubic-bezier(0.4, 0, 0.6, 1) | 连接状态呼吸灯 |
| `stepPulse` | 2000ms | ease-in-out | 流程步骤活跃脉冲 |
| `flyoutFadeIn` | 250ms | cubic-bezier(0.16, 1, 0.3, 1) | 折叠态悬停浮出 |
| `spinReconnect` | 1000ms | linear | 重连按钮旋转 |

### 10.3 面板过渡

右侧面板切换使用统一的过渡类：

```css
.panel-slide-transition {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
```

拖拽调整宽度时，禁用过渡防止抖动：

```tsx
className={`${isResizing ? '' : 'transition-all duration-300'}`}
```

### 10.4 编辑器动效

编辑器内动效极简，避免干扰写作：

- AI 续写预览：灰色文字淡入 150ms
- 标注出现：opacity 0→1，200ms
- BubbleToolbar：scale(0.95)→1 + opacity，150ms
- SlashCommandMenu：translateY(-4px)→0 + opacity，150ms

---

## 附录 A：设计 Token 速查

### 间距

| Token | 值 | 用途 |
|-------|-----|------|
| `--section-gap` | 16px | 面板区块间距 |
| `--card-gap` | 10px | 卡片网格间距 |
| `--inner-padding` | 14px | 卡片内边距 |

### 圆角

| Token | 值 | 用途 |
|-------|-----|------|
| `--radius-sm` | 8px | 卡片、输入框 |
| `--radius-md` | 10px | 大卡片、面板 |
| `--radius-pill` | 20px | 徽标、Tag |

### 阴影

| Token | 值 | 用途 |
|-------|-----|------|
| `--shadow-tiny` | 0 1px 2px rgba(0,0,0,0.04) | 卡片静态 |
| `--shadow-default` | 0 1px 3px + 0 1px 2px | 卡片悬停 |
| `--shadow-card` | 0 4px 12px + 0 1px 3px | 弹出层 |

### Composer 工具栏

| Token | 值 | 用途 |
|-------|-----|------|
| `--composer-btn-sm` | 28px | 小型图标按钮 |
| `--composer-btn-md` | 32px | 主要操作按钮 |
| `--composer-icon-sm` | 14px | 小按钮图标 |
| `--composer-icon-md` | 16px | 主按钮图标 |
| `--composer-toolbar-gap` | 6px | 按钮间距 |
| `--composer-focus-ring` | rgba(114,64,221,0.5) | 输入焦点环 |

---

## 附录 B：组件层级关系

```
App
├── WelcomeWizard (首次运行)
└── AppMain
    ├── SkipLink
    ├── Sidebar
    │   ├── BrandHeader
    │   ├── NewDocumentButton
    │   ├── WorkspaceSummaryCard
    │   ├── DocumentList (VirtualList)
    │   ├── BottomNav
    │   │   ├── TemplateLibrary
    │   │   ├── KnowledgeBase
    │   │   ├── MCP
    │   │   └── Settings
    │   └── FlowSteps (4 steps)
    │       ├── FlowStepBadge
    │       ├── FlowConnector
    │       └── StepFlyoutPopover
    ├── ProjectSidebar
    ├── AppMainContent
    │   ├── AppHeader
    │   │   ├── AiToolbar
    │   │   ├── ConnectionStatus
    │   │   ├── ContextRing
    │   │   └── CheckpointMenu
    │   ├── WorkflowStepsNavigator
    │   ├── ContextBar
    │   ├── DocumentEditor
    │   │   ├── TipTap ProseMirror
    │   │   ├── BubbleToolbar
    │   │   └── SlashCommandMenu
    │   └── AppContextFooter
    ├── ChatSidebar
    │   └── ChatArea
    │       ├── MessageBubble
    │       ├── ThinkingEffect
    │       └── Composer
    ├── AppRightPanels (lazy-loaded)
    │   ├── EvaluationPanel
    │   │   ├── EvaluationSourceSection
    │   │   ├── EvaluationCompactReviewSection
    │   │   ├── EvaluationDetailedReviewSection
    │   │   ├── EvaluationSupportToolsSection
    │   │   └── RevisionPreviewCard
    │   ├── AnalysisPanel
    │   ├── ForeshadowingTrackerPanel
    │   ├── PatternDashboardPanel
    │   ├── SessionAnalyticsPanel
    │   ├── EvaluationDrillDownPanel
    │   ├── CharacterRelationshipsPanel
    │   ├── NarrativeVisualizationPanel
    │   │   ├── VisualizationToolbar
    │   │   ├── TimelineView
    │   │   ├── TensionCurveView
    │   │   └── CharacterGraphView
    │   ├── WritingHelperPanel
    │   ├── AiTextOptimizer
    │   ├── AutomationPanel
    │   ├── TemplateBrowserPanel
    │   ├── WorkflowEditorPanel
    │   ├── McpStatusPanel
    │   ├── KnowledgeModal
    │   │   ├── CharacterTab
    │   │   ├── LocationTab
    │   │   ├── PlotTab
    │   │   ├── SkillTab
    │   │   └── MemoryForm
    │   └── SettingsModal
    ├── StoryBiblePanel (in Knowledge)
    │   ├── CollapsibleSection
    │   ├── StoryBibleDraftSection
    │   ├── StoryBibleKnowledgeSection
    │   ├── StoryBibleCanonSection
    │   └── StoryBibleNarrativeSection
    ├── IntelligenceSubcomponents
    │   ├── EmotionalArcChart
    │   ├── InlineAnnotation
    │   ├── IntelligenceBadge
    │   ├── MetricValue
    │   ├── ProgressBar
    │   ├── PacingPrescriptionPanel
    │   ├── ReaderImmersionDashboard
    │   ├── ShowTellLegend
    │   ├── TrendChart
    │   ├── VoiceFingerprintPanel
    │   └── WritingDashboard
    └── ToastContainer
```

---

## 附录 C：与现有代码的映射

本文档中描述的所有设计均已基于现有代码库验证。核心映射关系：

| 设计元素 | 代码位置 | 状态 |
|----------|---------|------|
| 主布局 | `App.tsx` | 已实现 |
| CSS 变量系统 | `globals.css` `:root` / `.dark` | 已实现 |
| Tailwind 扩展 | `tailwind.config.js` | 已实现 |
| Sidebar 四步流程 | `Sidebar.tsx` | 已实现 |
| 评估面板 | `evaluation/EvaluationPanelContent.tsx` | 已实现 |
| 伏笔追踪 | `ForeshadowingTrackerPanel.tsx` | 已实现 |
| 叙事可视化 | `narrative-visualization/` | 已实现 |
| 知识库 | `KnowledgeModal.tsx` | 已实现 |
| 故事圣经 | `story-bible/StoryBiblePanelContent.tsx` | 已实现 |
| 设置 | `SettingsModal.tsx` | 已实现 |
| 字号切换 | `globals.css` `data-font-size` | 已实现 |
| 焦点管理 | `useDialogFocusTrap.ts` | 已实现 |
| 虚拟列表 | `VirtualList.tsx` + `@tanstack/react-virtual` | 已实现 |
| Intelligence Card | `globals.css` `.intelligence-card` | 已实现 |
| 叙事维度色彩 | 尚未统一为 CSS 变量 | 待实现 |
| 风格雷达图 | 尚未实现 SVG 版本 | 待实现 |
| 满意度热图 | 评估面板中部分实现 | 待增强 |
| 技能市场 | `SkillTab.tsx` 基础版 | 待扩展 |
| 命令面板 | `QuickPanel.tsx` | 已实现 |
| 编辑器扩展 | `editor/extensions/` | 已实现 |
