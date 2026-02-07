# AI Writing Agent Platform - Jules 自动开发指南

**版本**: 2.1  
**日期**: 2026-01-27  
**定位**: 类 Cherry Studio / Claude-Code-Workflow 的本地优先 AI Agent 平台

---

## 📂 项目文件结构

本目录包含所有 Jules 自动编写程序所需的核心文件：

```
niko studio/
├── .github/
│   └── JULES.md           # Jules 开发指南（优先阅读）
├── docs/
│   ├── SDD_V2.md          # 软件设计文档 v2.1（核心参考）
│   ├── TDD.md             # 测试驱动开发文档 v2.0
│   ├── TASKS.md           # 任务清单 v2.8（CCW Enhanced）
│   ├── ARCHITECTURE.md    # 架构设计 v2.7
│   └── ...                # 其他设计文档
├── src/
│   ├── agents/            # Agent 实现
│   ├── workflow/          # 工作流引擎
│   ├── memory/            # 记忆管理
│   ├── search/            # 搜索系统
│   └── ...                # 其他模块
├── tests/                 # 测试用例
├── README.md              # 项目概览
├── requirements.txt       # Python 依赖
└── .gitignore             # Git 忽略规则
```

---

## 🚀 Jules 快速启动指南

### 第一步：阅读核心文档（优先级顺序）

1. **[.github/JULES.md](.github/JULES.md)** ⭐⭐⭐
   - Jules 专用开发指南
   - P0/P1 任务优先级划分
   - 自动化开发规范

2. **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** ⭐⭐⭐
   - 系统架构全景
   - 核心设计决策
   - 技术栈选型理由

3. **[docs/SDD_V2.md](docs/SDD_V2.md)** ⭐⭐⭐
   - 详细功能规格（2000+ 行）
   - OpenKL 文件契约
   - CCW 会话管理集成
   - 8 维度质量评估系统

4. **[docs/TASKS.md](docs/TASKS.md)** ⭐⭐
   - 分阶段任务清单
   - P0 优先任务：CitationManager, DistillationManager, MemoryManager
   - 实施顺序和依赖关系

5. **[docs/TDD.md](docs/TDD.md)** ⭐⭐
   - 测试策略（E2E/集成/单元）
   - Playwright 自动化测试
   - 测试覆盖率要求

### 第二步：理解技术架构

**核心架构**（三层设计）：
```
┌──────────────────────────────────────────────┐
│         Multi-Agent Collaboration            │ <- LangGraph 工作流
│  (Commander/Architect/Writer/Critic)         │
├──────────────────────────────────────────────┤
│         OpenKL Memory Layer                  │ <- 知识层抽象
│  (Citations/Distillation/Store/Search)       │
├──────────────────────────────────────────────┤
│         CCW Workflow Engine                  │ <- 会话管理
│  (SessionManager/Resume/CoreMemory)          │
└──────────────────────────────────────────────┘
```

**技术栈**：
- **语言**: Python 3.10+
- **框架**: LangGraph（工作流）、FastAPI（API）、Streamlit（UI 原型）
- **存储**: SQLite（会话/记忆）、Kùzu（知识图谱）、文件系统（`.writing/`）
- **AI 模型**: Gemini/Claude/Qwen（多模型支持）

### 第三步：P0 优先任务（Critical Path）

见 **[.github/JULES.md](.github/JULES.md)** 的 "Phase 1: Core Infrastructure" 部分：

1. **CitationManager** (`src/memory/citation_manager.py`)
   - SHA256 内容验证
   - 引用链管理
   - 自动 GC

2. **DistillationManager** (`src/memory/distillation_manager.py`)
   - 模板化蒸馏
   - 多策略支持
   - 缓存优化

3. **MemoryManager** (`src/memory/memory_manager.py`)
   - 短期/工作/长期记忆
   - 图记忆集成
   - OpenKL File Contract 适配

4. **SessionManager** (`src/workflow/session/session_manager.py`)
   - 会话生命周期
   - Resume Strategy
   - 元数据管理

5. **ResumeStrategy** (`src/workflow/session/resume_strategy.py`)
   - Native/Hybrid/Full 三种模式
   - 检查点管理
   - 上下文恢复

---

## 📋 Jules 开发规范

### 代码风格
- 遵循 PEP 8
- 使用类型提示（Type Hints）
- Docstring 格式：Google Style

### 测试要求
- 单元测试覆盖率 ≥ 80%
- 集成测试覆盖核心工作流
- E2E 测试验证完整场景

### 提交规范
```
feat: 添加 CitationManager SHA256 验证功能
fix: 修复 SessionManager 恢复策略 bug
docs: 更新 SDD_V2.md 引用系统说明
test: 增加 MemoryManager 单元测试
```

---

## 🔗 关键参考链接

### 内部文档
- [系统架构](docs/ARCHITECTURE.md)（v2.7）
- [软件设计文档](docs/SDD_V2.md)（v2.1）
- [任务清单](docs/TASKS.md)（v2.8）
- [测试策略](docs/TDD.md)（v2.0）

### 参考项目
- **Claude-Code-Workflow**: 会话管理、核心记忆、Smart Search
- **Cherry Studio**: 多模型路由、Sequential Thinking
- **OpenKL**: Citations、Distillation、File Contract
- **AionUi**: Skills 系统、多 Agent 协作

---

## 🎯 开发目标

**核心价值**：将小说创作从"灵感碎片"提升至"工业化生产"

**关键指标**：
- ✅ 10x 创作效率提升
- ✅ LOCK + 8 维度质量保证
- ✅ 完全本地部署（隐私保护）
- ✅ 跨领域扩展能力（小说→代码→知识管理）

---

## 📞 联系方式

如有疑问，请查阅：
1. [.github/JULES.md](.github/JULES.md) 的常见问题部分
2. [docs/SDD_V2.md](docs/SDD_V2.md) 的详细功能说明
3. 项目根目录的 [README.md](README.md)

---

**准备好了吗？开始自动化开发之旅吧！🚀**
