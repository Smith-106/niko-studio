# 写作Agent系统 - 系统架构设计

> **版本**: 2.1 (Enhanced with Cherry Studio Services)
> **基于**: Agentic Design Patterns + LOCK System + Cherry Studio Infrastructure
> **状态**: 正式规范

---

## 一、系统概述 (System Overview)

### 1.1 设计理念

本系统采用 **Multi-Agent Collaboration** 与 **Reflection Pattern** 的融合架构，依托强大的 **Service Layer** 基础设施，实现高质量商业小说创作的自动化流程。

```mermaid
graph TB
    subgraph Orchestration["协调层 (Orchestration)"]
        Commander[指挥官 Agent<br/>Commander]
    end
    
    subgraph Planning["规划层 (Planning)"]
        Architect[策划 Agent<br/>Architect<br/>(Sequential Thinking)]
    end
    
    subgraph Creation["创作层 (Creation)"]
        Writer[写作 Agent<br/>Writer]
    end
    
    subgraph Context["上下文层 (Context Providers)"]
        World[世界观 Agent]
        Character[角色 Agent]
        Plot[剧情 Agent]
    end
    
    subgraph Reflection["反思层 (Reflection)"]
        Critic[批评家 Agent<br/>Critic Matrix]
    end
    
    subgraph Services["基础服务层 (Services)"]
        Backup[备份服务<br/>(WebDAV/S3)]
        Token[Token 估算服务]
        Obsidian[Obsidian 集成<br/>(Vault Service)]
        RAG[RAG 知识服务<br/>(KnowledgeService + Reranker)]
        Index[语义索引服务<br/>(FastEmbed + CodexLens)]
    end
    
    subgraph Memory["记忆与数据层 (Memory & Data)"]
        ObsidianVault[(Obsidian Vault)]
        KG[(Knowledge Graph<br/>MCP Memory)]
        VectorDB[(Local Vector Store)]
    end
    
    Commander -->|L1: Rapid| Writer
    Commander -->|L3: Standard| Architect
    Commander -->|L5: Brainstorm| Context
    
    Architect -->|Scene Cards| Writer
    Architect -.->|Deep Thinking| Architect
    
    Context -->|Context Data| Writer
    Context <--> KG
    
    Writer -->|Draft| Critic
    Critic -->|Feedback| Writer
    
    Writer <--> Services
    Context <--> Services
    
    Services <--> Memory
    
    classDef service fill:#f9f,stroke:#333,stroke-width:2px;
    class Services service;
```

---

### 1.2 核心设计模式

| 模式 | 应用位置 | 说明 |
|------|----------|------|
| **Layered Workflows** | Commander | **L1/L3/L5** 分层路由，根据任务复杂度动态调度 |
| **Multi-Agent Collaboration** | 全系统 | 6个核心Agent + 8个编辑Agent协作 |
| **Reflection Pattern** | Critic ↔ Writer | 生成-批评-修正循环 |
| **Sequential Thinking** | Architect | 复杂剧情推演与逻辑自洽性检查 |
| **Semantic Search** | Index Service | 基于 **CodexLens** 的本地向量检索 (FastEmbed) |
| **Knowledge Graph** | Memory Layer | 实体关系网络管理 (基于 MCP) |

---

## 二、服务层定义 (Service Layer Specifications)

### 2.1 基础设施服务 (Infrastructure)

由 Cherry Studio 移植的工业级基礎组件：

*   **BackupService**: 支持本地、WebDAV (坚果云/Nextcloud)、S3 對象存儲的自動備份與多端同步。
*   **TokenService**: 本地估算文本與圖片 Token 消耗，支持預算控制與成本分析。
*   **ObsidianVaultService**: 零侵入式讀取用戶現有的 Obsidian 知識庫，自動解析雙鏈結構。
*   **IndexingService** **[NEW]**: 基于 `codex-lens` 架构的 Python 原生索引服务，支持 FastEmbed 模型和混合搜索 (Hybrid Search)。

### 2.2 知識增強服務 (Knowledge Enhancement)

*   **KnowledgeService**: 集成 Jina/Voyage/TEI 等多策略 Reranker，支持 PDF/MD/URL 多源數據加載。
*   **WebSearchService**: 實時聯網搜索並自動生成壓縮簡報，補充知識盲區。

---

## 三、通讯协议 (Communication Protocol)

### 3.1 Agent 间通讯方式 (CCW Enhanced)

**Prompt Protocol (6-Field Structure)**:
所有 Agent 交互必须遵循 **PURPOSE-TASK-MODE-CONTEXT-EXPECTED-RULES** 标准结构。

```text
PURPOSE: [Goal Description]
TASK: [Specific Action]
MODE: [execution | analysis | planning]
CONTEXT: [Evidence/Memory Summary]
EXPECTED: [Deliverable Format]
RULES: [Constraints & Patterns]
```

### 3.2 工作流路由 (Workflow Routing)

*   **L1: Rapid Workflow**: 直接调用 `Writer` 进行快速改错、润色。无中间伪代码/计划。
*   **L3: Standard Workflow**: `Commander` -> `Architect` (Plan) -> `Writer` (Execute) -> `Critic` (Verify)。
*   **L5: Brainstorm Workflow**: `Commander` -> `Context Agents` (Brainstorm) -> `Architect` (Synthesize) -> User Review。

### 3.2 MCP 工具接口 (Enhanced)

```typescript
// Knowledge Graph MCP (Memory Server)
interface MemoryMCP {
  createEntities(entities: Entity[]): Promise<Entity[]>;
  createRelations(relations: Relation[]): Promise<Relation[]>;
  searchNodes(query: string): Promise<KnowledgeGraph>;
}

// Sequential Thinking MCP
interface ThinkingMCP {
  appendThought(thought: string, branchFrom?: string): Promise<string>;
  reviseThought(thoughtId: string, revision: string): Promise<void>;
}
```

---

## 四、状态管理 (State Management)

### 4.1 会话状态 (Session State)

增加 Token 消耗与服务状态追踪：

```yaml
SessionState:
  session_id: string
  current_chapter: number
  ...
  metrics:
    token_usage: 
      prompt: int
      completion: int
      cost_est: float
    last_backup: datetime
```

### 4.2 长期记忆 (Long-term Memory)

引入 MCP Memory Server 的圖結構：

```yaml
MemoryStructure:
  Knowledge_Graph:
    nodes:
      - Character (Entity)
      - Location (Entity)
      - Event (Entity)
    edges:
      - KNOWS
      - APPEARS_IN
      - CAUSED_BY
```

---

## 五、版本历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| 1.0 | 2026-01-24 | 初始版本 |
| 2.0 | 2026-01-25 | Agentic Design Patterns 重构 |
| 2.1 | 2026-01-26 | 集成 Cherry Studio 服务层 (Backup, Token, RAG) |
| 2.2 | 2026-01-26 | 集成 Claude Code Workflow (L1-L5 Workflow, Semantic Search) |

---

*文档结束*
