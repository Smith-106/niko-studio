# Niko-Studio V8 - 统一设计文档 (SDD)

> **版本**: 8.0.0  
> **更新日期**: 2025-01-XX  
> **核心改进**: MCP Gateway + 多模型并行 + 统一记忆引擎

---

## 1. 系统概述

Niko-Studio 是一个专业的 AI 辅助写作平台，通过 MCP (Model Context Protocol) Gateway 实现多模型并行访问，支持 Claude Code、Codex、Gemini 等多种 AI Agent 同时协作创作。

### 1.1 核心特性

| 特性 | 说明 |
|------|------|
| **MCP Gateway** | HTTP 统一入口，Session 隔离，多模型并行 |
| **统一记忆** | 四层(生命周期) × 六维(内容类型) × 时序追踪 |
| **知识图谱** | Kùzu/SQLite 支持，实体关系管理 |
| **技能系统** | SKILL.md 格式，1%规则，三级优先级 |
| **工作流** | L1-L5 五级模式，Plan-Act，Git Checkpoint |
| **评估引擎** | 五维度评估，技能推荐 |

---

## 2. 系统架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Niko-Studio V8 Architecture                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    🌐 MCP Gateway Layer                               │  │
│  │                    http://localhost:8000                              │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │  │
│  │  │/memory  │ │/graph   │ │/skills  │ │/search  │ │/workflow│         │  │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘         │  │
│  │       │           │           │           │           │              │  │
│  │  ┌────┴───────────┴───────────┴───────────┴───────────┴────┐         │  │
│  │  │              Session Manager (多模型并行)               │         │  │
│  │  └─────────────────────────────────────────────────────────┘         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│       ▲              ▲              ▲              ▲              ▲         │
│       │ HTTP         │ HTTP         │ HTTP         │ HTTP         │ HTTP    │
│  ┌────┴────┐    ┌────┴────┐    ┌────┴────┐    ┌────┴────┐    ┌────┴────┐   │
│  │ Claude  │    │  Codex  │    │ Gemini  │    │  Qwen   │    │  Local  │   │
│  │  Code   │    │  CLI    │    │  Agent  │    │  Agent  │    │  Agent  │   │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                         📚 Core Engine Layer                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Memory    │ │  Knowledge  │ │   Skills    │ │  Workflow   │           │
│  │   Engine    │ │   Graph     │ │   Engine    │ │   Engine    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Critic    │ │   Search    │ │  Context    │ │ Checkpoint  │           │
│  │   Engine    │ │   Engine    │ │  Providers  │ │  Manager    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
├─────────────────────────────────────────────────────────────────────────────┤
│                         💾 Storage Layer                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│  │ SQLite   │ │ FastEmbed│ │ File I/O │ │   Git    │                       │
│  │ (图+记忆)│ │ (384维)  │ │          │ │(Checkpoint)│                     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. MCP Gateway

### 3.1 服务端点

| 端点 | 服务 | 主要工具 |
|------|------|----------|
| `/memory` | 记忆服务 | memory_add, memory_search, memory_get_temporal |
| `/graph` | 图谱服务 | graph_query, graph_get_character, graph_get_foreshadows |
| `/skills` | 技能服务 | skill_match, skill_load, skill_recommend |
| `/search` | 搜索服务 | search_hybrid, search_iterative, search_context |
| `/workflow` | 工作流服务 | workflow_route, workflow_plan, checkpoint_create |
| `/critic` | 评估服务 | evaluate_content, get_improvement_suggestions |

### 3.2 多模型并行原理

```
┌────────────────────────────────────────────────────────────────┐
│                    Session Manager                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Session-A    │  │ Session-B    │  │ Session-C    │          │
│  │ (Claude)     │  │ (Codex)      │  │ (Gemini)     │          │
│  │ mcp-session- │  │ mcp-session- │  │ mcp-session- │          │
│  │ id: abc123   │  │ id: def456   │  │ id: ghi789   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                 │                 │                   │
│         ▼                 ▼                 ▼                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 Shared Core Engine                       │   │
│  │  (Memory/Graph/Skills 数据共享，通过数据库实现一致性)    │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

### 3.3 客户端配置

**Claude Code** (`.claude/mcp.json`):
```json
{
  "mcpServers": {
    "niko-memory": {
      "type": "streamable-http",
      "url": "http://localhost:8000/memory"
    }
  }
}
```

---

## 4. 统一记忆引擎

### 4.1 记忆模型

```
┌─────────────────────────────────────────────────────────────┐
│                    UnifiedMemory                             │
├─────────────────────────────────────────────────────────────┤
│  垂直维度 (生命周期):                                        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│  │ephemeral│ │ session │ │  user   │ │ project │            │
│  │ (<1h)   │ │ (任务)  │ │ (偏好)  │ │ (小说)  │            │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘            │
├─────────────────────────────────────────────────────────────┤
│  水平维度 (内容类型):                                        │
│  ┌────────┐┌────────┐┌─────────┐┌─────────┐┌──────┐┌──────┐ │
│  │timeline││context ││character││worldview││prefer││exper │ │
│  │事件线  ││上下文  ││角色     ││世界观   ││偏好  ││经验  │ │
│  └────────┘└────────┘└─────────┘└─────────┘└──────┘└──────┘ │
├─────────────────────────────────────────────────────────────┤
│  时序追踪 (Zep Graphiti):                                    │
│  • entity_id: 关联实体                                       │
│  • valid_from / valid_until: 有效时间范围                    │
│  • supersedes / superseded_by: 版本链                        │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 冲突解决

```python
# 自动检测矛盾
conflicts = await memory_engine.detect_conflicts("character:张三")

# 解决策略
await memory_engine.resolve_conflict(
    memory_id_a, 
    memory_id_b, 
    resolution="auto"  # auto/keep_a/keep_b/merge
)
```

---

## 5. 技能系统

### 5.1 评分机制

```
综合评分 = 0.4 × 关键词匹配 + 0.4 × 语义相似度 + 0.2 × 标签匹配

1% 规则: threshold=0.01，只要达到 1% 相关性就会被考虑
```

### 5.2 技能包列表

| 技能包 | 用途 | 触发关键词 |
|--------|------|------------|
| fictional-dream | 沉浸感/画面感 | 画面、细节、感官 |
| character-forge | 角色塑造 | 角色、人物、性格 |
| suspense-craft | 悬念张力 | 悬念、紧张、冲突 |
| premise-magic | 前提设定 | 设定、规则、世界观 |
| foreshadowing-craft | 伏笔技法 | 伏笔、暗示、铺垫 |
| novel-chapter | 章节创作 | 章节、写作 |

---

## 6. 工作流引擎

### 6.1 五级模式

| 级别 | 名称 | 说明 | 典型步骤数 |
|------|------|------|-----------|
| L1 | 简单问答 | 直接回答 | 1 |
| L2 | 段落生成 | 单次生成 | 3 |
| L3 | 章节创作 | Plan-Act | 8 |
| L4 | 多章连续 | 状态管理 | 5×N |
| L5 | 全书规划 | 完整流程 | 7+ |

### 6.2 Checkpoint 机制

```python
# 创建检查点 (Git-based)
checkpoint = await workflow.create_checkpoint("完成第3章初稿")

# 恢复检查点
await workflow.restore_checkpoint(checkpoint["checkpoint_id"])
```

---

## 7. 评估引擎

### 7.1 五维度评估

| 维度 | 评估内容 | 关联技能 |
|------|----------|----------|
| dream | 沉浸感、画面感 | fictional-dream |
| suspense | 悬念、张力 | suspense-craft |
| character | 角色立体度 | character-forge |
| premise | 设定合理性 | premise-magic |
| voice | 叙事风格 | expression-craft |

### 7.2 技能推荐

低于 6 分的维度自动推荐相关技能包。

---

## 8. 快速开始

### 8.1 安装

```bash
cd niko-studio
pip install -r requirements.txt
```

### 8.2 启动 Gateway

```bash
python scripts/start_gateway.py
# 或
uvicorn src.mcp.gateway:app --host 0.0.0.0 --port 8000 --reload
```

### 8.3 测试连接

```bash
curl http://localhost:8000/health
curl http://localhost:8000/tools
```

### 8.4 配置 Claude Code

将 `.claude/mcp.json` 复制到项目根目录或用户目录。

---

## 9. 项目结构

```
niko-studio/
├── src/
│   ├── __init__.py
│   ├── mcp/
│   │   ├── __init__.py
│   │   └── gateway.py           # MCP Gateway
│   ├── memory/
│   │   ├── __init__.py
│   │   └── unified_memory.py    # 统一记忆引擎
│   ├── graph/
│   │   ├── __init__.py
│   │   └── graph_engine.py      # 知识图谱
│   ├── skills/
│   │   ├── __init__.py
│   │   └── skill_engine.py      # 技能引擎
│   ├── search/
│   │   ├── __init__.py
│   │   └── iterative_retriever.py
│   ├── workflow/
│   │   ├── __init__.py
│   │   └── workflow_engine.py
│   └── narrative/
│       ├── __init__.py
│       └── critic_engine.py     # 评估引擎
├── skills/                       # 技能包库
│   ├── fictional-dream/
│   ├── character-forge/
│   └── ...
├── scripts/
│   └── start_gateway.py
├── docs/
│   └── SDD_V8_FINAL.md          # 本文档
├── .claude/
│   └── mcp.json                 # Claude Code 配置
├── .codex/
│   └── mcp.json                 # Codex 配置
└── requirements.txt
```

---

## 10. 版本历史

| 版本 | 日期 | 主要变更 |
|------|------|----------|
| V8 | 2025-01 | MCP Gateway, 多模型并行, 统一记忆 |
| V7 | 2024-12 | Ultimate 设计, 完整系统规划 |
| V6 | 2024-11 | Enhanced 记忆系统 |
| V4-V5 | 2024-10 | Cherry 集成, 技能系统 |

---

## 附录 A: MCP 工具完整列表

### Memory 服务 (6个工具)
- `memory_add` - 添加记忆
- `memory_search` - 搜索记忆
- `memory_get_temporal` - 时序查询
- `memory_get_conflicts` - 冲突检测
- `memory_resolve_conflict` - 冲突解决

### Graph 服务 (6个工具)
- `graph_query` - Cypher 查询
- `graph_get_character` - 获取角色
- `graph_get_relationships` - 获取关系
- `graph_get_foreshadows` - 获取伏笔
- `graph_add_entity` - 添加实体
- `graph_add_relation` - 添加关系

### Skills 服务 (5个工具)
- `skill_match` - 匹配技能
- `skill_load` - 加载技能
- `skill_get_technique` - 获取技巧
- `skill_list` - 列出技能
- `skill_recommend` - 推荐技能

### Search 服务 (3个工具)
- `search_hybrid` - 混合搜索
- `search_iterative` - 迭代检索
- `search_context` - @引用解析

### Workflow 服务 (6个工具)
- `workflow_route` - 任务路由
- `workflow_plan` - 生成计划
- `workflow_execute` - 执行计划
- `checkpoint_create` - 创建检查点
- `checkpoint_restore` - 恢复检查点
- `checkpoint_list` - 列出检查点

### Critic 服务 (3个工具)
- `evaluate_content` - 评估内容
- `get_improvement_suggestions` - 改进建议
- `compare_versions` - 版本对比

---

**文档结束**
