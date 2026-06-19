# 竞品对比矩阵

> 对比维度：niko-studio 与 12 个外部项目
> 数据来源：GitHub 公开仓库、README、文档
> 访问日期：2026-06-18

---

## 1. 功能矩阵

| 项目 | 文本编辑器 | 大纲/卡片 | 角色管理 | 世界观管理 | 导出 | 协作 | 可视化 | 记忆/上下文 | 插件系统 | 云同步 |
|------|-----------|----------|---------|-----------|------|------|--------|------------|---------|--------|
| **niko-studio** | Tiptap 富文本 | 章节 + 场景 | Story Bible | Story Bible | MD/HTML/PDF/DOCX | 无 | 时间线/张力曲线/角色图 | 知识图谱 + 向量检索 | 动态插件注册 | Push/Pull/Full |
| **QMAI** | 内置编辑器 | 章节结构 | NvwaSKILL 角色魂 | 世界观规则 | 未明确 | 无 | Sigma.js 关系图 | 混合检索(关键词+向量+图) | 无 | 本地优先 |
| **StoryCraftr** | 无(CLI) | 大纲生成 | 世界构建生成 | 世界构建生成 | 未明确 | 无 | 无 | 无 | 无 | 无 |
| **autonovel** | 无(脚本) | 五层文档 | 角色层 | 世界层 | PDF/ePub/有声书 | 无 | 无 | 状态传播 | 无 | 无 |
| **Starc** | 专业剧本编辑器 | 多脚本/剧集 | 统计跟踪 | 研究工具 | .fdx/.docx/.odt | 开发中 | 思维导图 | 无 | 无 | 开发中 |
| **NovelForge** | 内置编辑器 | 卡片系统 | 角色卡 | 世界观卡 | 未明确 | 无 | 知识图谱 | 知识图谱(Neo4j/SQLite) | 无 | 无 |
| **StoryLine** | Obsidian 编辑器 | 多视图(看板/时间线/地铁图) | 角色面板 | 地点面板 | MD/JSON/CSV/HTML/PDF/DOCX | 无 | 地铁图/时间线/看板 | Codex 共享中心 | 无 | 无 |
| **Longform** | Obsidian 编辑器 | 场景列表 | 无 | 无 | 编译生成 | 无 | 无 | 无 | 无 | 无 |
| **Manuskript** | 内置编辑器 | 大纲 + 索引卡 | 角色创建 | 世界构建 | HTML/ePub/ODT/DOCX | 无 | 故事线可视化 | 无 | 无 | 无 |
| **novelWriter** | 纯文本编辑器 | 文档树 | 无 | 无 | 多种格式 | 无 | 无 | 无 | 无 | 无 |
| **AI-Novel-Writing-Assistant** | Plate 编辑器 | 整本生产链 | 关系网 | 派系地图 | 未明确 | 无 | 无 | RAG(Qdrant) | 无 | 无 |
| **WeKnora** | 无 | 知识库 | 无 | 无 | 多种格式 | 多租户RBAC | 知识图谱 | RAG + Wiki | MCP Server | 无 |
| **Marginalia** | 无 | 笔记/调查 | 无 | 无 | 多种格式 | 无 | 关系发现 | 混合检索 + 图邻居 | MCP Server | 无 |

---

## 2. AI 能力矩阵

| 项目 | 续写 | 改写 | 大纲生成 | 角色一致性 | 读者模拟 | 风格分析 | 多轮修订 | 知识检索 | 模型路由 | 反AI味 |
|------|------|------|---------|-----------|---------|---------|---------|---------|---------|--------|
| **niko-studio** | Co-Writing 三模式 | 智能修订 | 有 | 声纹提取 | 双引擎 | 9维度 | 多轮 | 混合搜索 | 有 | Show/Tell检测 |
| **QMAI** | 有(记忆上下文) | De-AI重写 | 有 | NvwaSKILL | 无 | 6维度评审 | 自动一致性检查 | 混合检索 | 无 | De-AI重写 |
| **StoryCraftr** | 章节生成 | 无 | 有 | 无 | 无 | 无 | 无 | 无 | 多提供商 | 无 |
| **autonovel** | 全自动生成 | 对抗编辑 | 有 | 声纹发现 | 无 | LLM评审 | 自动修订循环 | 状态传播 | Claude专用 | 反slop检测 |
| **Starc** | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 |
| **NovelForge** | 流式字段生成 | 通用评审 | 有 | 无 | 无 | 无 | 草稿预览确认 | 知识图谱 | 多模型/卡 | 无 |
| **StoryLine** | 无 | 无 | 节拍表模板 | 无 | 无 | 无 | 无 | 无 | 无 | 无 |
| **Longform** | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 |
| **Manuskript** | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 |
| **novelWriter** | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 无 |
| **AI-Novel-Writing-Assistant** | 章节执行 | 审计修复 | AI导演 | 关系网 | 无 | 无 | 无 | RAG | 有 | 反AI规则 |
| **WeKnora** | 无 | 无 | 无 | 无 | 无 | 无 | 无 | RAG | 20+提供商 | 无 |
| **Marginalia** | 无 | 无 | 无 | 无 | 无 | 无 | 无 | 混合检索 | 多提供商 | 无 |

---

## 3. 架构矩阵

| 项目 | 平台 | 语言/框架 | UI | 可扩展性 | 数据存储 |
|------|------|----------|-----|---------|---------|
| **niko-studio** | Desktop (Tauri v2) | Rust + React 18 + TS | Tailwind + Tiptap | 插件系统 + MCP | 本地文件 + 向量索引 |
| **QMAI** | Desktop (Tauri 2) | Rust + React 19 + TS | Tailwind + Zustand | 有限 | 本地 Markdown + JSON + LanceDB |
| **StoryCraftr** | CLI | Python + LangChain | 终端 + VSCode扩展 | 无 | 本地文件 |
| **autonovel** | 脚本/Pipeline | Python | 无 | 无 | 文件系统 + LaTeX |
| **Starc** | Desktop (C++ native) | C++ + Qt6 | Material Design | 有限 | 本地文件(.starc) |
| **NovelForge** | Desktop (Electron) | Vue 3 + TS + FastAPI | Element Plus | 工作流系统 | SQLite + Neo4j |
| **StoryLine** | Obsidian Plugin | TypeScript | Obsidian原生 | 无 | Markdown + YAML |
| **Longform** | Obsidian Plugin | TypeScript + Svelte | Obsidian原生 | 编译步骤社区 | Markdown |
| **Manuskript** | Desktop (Python) | Python 3 + PyQt5 | 原生Qt | 无 | 开放文本格式 |
| **novelWriter** | Desktop (Python) | Python + Qt6 + PyQt6 | 原生Qt | 无 | 纯文本文件 |
| **AI-Novel-Writing-Assistant** | Desktop + Web | React 19 + Express + LangChain | Plate编辑器 | 无 | SQLite + Qdrant |
| **WeKnora** | Web + Desktop | Go + Vue + TS | Vue | MCP Server | PostgreSQL + 多种向量DB |
| **Marginalia** | Desktop (Tauri) | Python + TS + Rust | Tauri | MCP Server | SQLite/PostgreSQL |

---

## 4. 市场定位矩阵

| 项目 | 目标用户 | 许可证 | 商业模式 | 社区规模 | 活跃度 |
|------|---------|--------|---------|---------|--------|
| **niko-studio** | 创意作家/网文作者 | 专有 | 待确定 | 私有 | 活跃(M25完成) |
| **QMAI** | 网文日更作者 | MIT | 开源免费 | 531 stars | 活跃(2026-06) |
| **StoryCraftr** | 小说家/研究者 | MIT | 开源免费 | 145 stars | 中等(2025-11) |
| **autonovel** | 作家/AI研究者 | 未明确 | 研究项目 | 1.2k stars | 活跃 |
| **Starc** | 专业编剧/作家 | GPL-3.0 | 开源+Premium | 357 stars | 活跃(Beta) |
| **NovelForge** | 长篇小说作者 | AGPL-3.0/商业 | 双许可 | 941 stars | 活跃(2026-05) |
| **StoryLine** | Obsidian用户/作家 | MIT | 开源免费 | 177 stars | 活跃(2026-06) |
| **Longform** | Obsidian用户/作家 | 未明确 | 开源免费 | 938 stars | 中等(2025-03) |
| **Manuskript** | 开源爱好者/作家 | GPL-3.0 | 开源免费 | 2.3k stars | 中等(2025-06) |
| **novelWriter** | 极简主义作家 | GPL-3.0 | 开源免费 | 3k stars | 活跃(2026-01) |
| **AI-Novel-Writing-Assistant** | 写作新手 | AGPL-3.0/商业 | 双许可 | 1.7k stars | 活跃(2026-06) |
| **WeKnora** | 企业/团队 | MIT | 开源+企业服务 | 16.4k stars | 活跃(2026-06) |
| **Marginalia** | 研究人员/PKM用户 | AGPL-3.0 | 开源 | 56 stars | 早期(2026-06) |

---

## 关键观察

1. **AI 写作工具赛道分化明显**：传统工具（Manuskript、novelWriter、Starc、Longform、StoryLine）零 AI 功能；AI 原生工具（niko-studio、QMAI、NovelForge、AI-Novel-Writing-Assistant、autonovel）深度集成 LLM。

2. **架构趋同**：niko-studio 与 QMAI 几乎 identical（Tauri + React + Rust + 本地优先），是直接竞品。

3. **读者模拟是 niko-studio 独有**：12 个外部项目中没有任何项目实现读者模拟功能。

4. **反 AI 味检测**：QMAI（De-AI 重写）、autonovel（反 slop 检测）、AI-Novel-Writing-Assistant（反 AI 规则）都有相关能力，niko-studio 的 Show/Tell 检测是差异化方向。

5. **企业级知识管理**：WeKnora（16.4k stars）和 Marginalia 虽非写作工具，但其 RAG、Agent、MCP 能力可借鉴。

6. **Obsidian 生态**：StoryLine 和 Longform 作为插件，依托 Obsidian 的庞大用户基础，但功能深度有限。

7. **双许可趋势**：NovelForge 和 AI-Novel-Writing-Assistant 采用 AGPL-3.0 + 商业授权模式，对 SaaS 化有明确规划。
