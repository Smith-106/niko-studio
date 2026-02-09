# AI 写作 Agent 系统 - 软件设计文档 (V5: Cherry + CCW Integration)

> **Version**: 5.0 (Enhanced with Cherry Studio & Claude Code Workflow)
> **Date**: 2026-01-26
> **Status**: Draft

---

## 1. 概述 (Overview)

本设计文档旨在将 **Cherry Studio** 的高价值功能（知识图谱、RAG 管道、基础服务）与 **Claude Code Workflow** 的先进工程范式（分层工作流、语义索引、Prompt 协议）集成到 AI 写作 Agent 系统中。

### 1.1 核心集成目标
1.  **Memory Layer**: 集成 MCP Knowledge Graph (Cherry) 与 CodexLens Semantic Search (CCW)。
2.  **Service Layer**: 引入 Backup、Token、Obsidian 服务 (Cherry)。
3.  **Workflow Layer**: 引入 L1-L5 分层工作流与结构化 Prompt 协议 (CCW)。

---

## 2. 详细设计 (Detailed Design)

### 2.1 协议层: Agent 交互协议 (based on CCW)

所有 System Prompts 必须强制包含以下 Template 构建器：

```python
class BaseAgent:
    def construct_prompt(self, purpose, task, mode, context, expected, rules):
        return f"""
PURPOSE: {purpose}
TASK: {task}
MODE: {mode}
CONTEXT: {context}
EXPECTED: {expected}
RULES: {rules}
"""
```

### 2.2 工作流层: L1-L5 分层路由 (based on CCW)

`Commander Agent` 将根据任务复杂度进行路由：

| 等级 | 名称 | 适用场景 | 流程 |
|------|------|----------|------|
| **L1** | **Rapid** | 改错字、润色段落 | User -> Writer -> User |
| **L3** | **Standard** | 写作单章 | User -> Commander -> Architect (Plan) -> Writer (Write) -> Critic (Review) -> User |
| **L5** | **Brainstorm** | 整书策划、世界观设定 | User -> Context Agents (Brainstorm) -> Architect (Synthesize) -> User |

### 2.3 记忆层: 双引擎记忆系统

#### A. 结构化记忆 (Cherry Studio Knowledge Graph)
- **技术栈**: MCP Server (TypeScript) + SQLite
- **数据结构**: Entity (Node), Relation (Edge)
- **用途**: 查询 "CharA 与 CharB 的关系", "LocationX 发生了什么"

#### B. 语义索引 (Claude Code Workflow CodexLens)
- **技术栈**: Python (FastEmbed) + SQLite (Vector BLOB)
- **数据结构**: Document Chunk + Embedding Vector
- **用途**: 模糊搜索 "找一段关于下雨的描写", "找主角之前愤怒的时刻"

### 2.4 服务层: 基础架构 (Cherry Studio)

#### A. BackupService
- **功能**: 自动备份项目文件到 Local/WebDAV/S3。
- **策略**: 每 30 分钟自动备份，支持版本回滚。

#### B. TokenService
- **功能**: 本地计算 Token 消耗（基于 tiktoken/transformers）。
- **用途**: 实时显示写作成本，防止 API 超支。

#### C. ObsidianVaultService
- **功能**: 零侵入读取 Obsidian 库。
- **用途**: 直接使用用户现有的设定集作为 RAG 源。

---

## 3. 接口定义 (Interface Definitions)

### 3.1 IndexingService (Python Sidecar)

```python
class IndexingService:
    def __init__(self, db_path: str):
        self.embedder = FastEmbed(model="bge-m3")
        
    def embed_content(self, content_id: str, text: str):
        """生成并存储向量"""
        pass
        
    def search(self, query: str, top_k: int = 5) -> List[Chunk]:
        """语义检索"""
        pass
```

### 3.2 SequentialThinking (Architect Capability)

```python
class SequentialThinking:
    def process(self, problem: str) -> Solution:
        """
        1. Decompose problem
        2. Generate thought branches
        3. Evaluate & Revise
        4. Converge to solution
        """
        pass
```

---

## 4. 迁移路线 (Migration Path)

请参考 `docs/TASKS.md` 中的 Phase 1, Phase 2, Phase 8, Phase 10 任务。
