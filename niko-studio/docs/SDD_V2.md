# AI Agent Platform - 進階功能規格 (SDD v2.1)

**版本**: 2.1  
**日期**: 2026-01-26  
**定位**: 類 Cherry Studio / Claude-Code-Workflow 的 AI Agent 平台，兼容小説創作

---

## 0. 系統定位與架構決策

### 0.1 平台定位

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        AI Agent Platform                                      │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                      核心平台層 (Platform Core)                          │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │ │
│  │  │ Memory Layer │  │ Session Mgmt │  │ Multi-CLI    │  │ Knowledge   │  │ │
│  │  │ (OpenKL)     │  │ (CCW)        │  │ Orchestrator │  │ Graph       │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘  │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                          │
│  ┌─────────────────────────────────▼───────────────────────────────────────┐ │
│  │                      領域適配層 (Domain Adapters)                        │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │ │
│  │  │ 小説創作     │  │ 代碼開發     │  │ 知識管理     │  │ 其他領域... │  │ │
│  │  │ (Novel)      │  │ (Code)       │  │ (Knowledge)  │  │ (Custom)    │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘  │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 0.2 關鍵架構決策

| 決策項 | 選擇 | 理由 |
|--------|------|------|
| **向量存儲** | ~~LanceDB~~ → **Kùzu HNSW** | 統一圖+向量，減少依賴 |
| **文件存儲** | **OpenKL File Contract** | 文件規範+圖派生，grep-friendly |
| **圖數據庫** | **Kùzu DB (嵌入式)** | 支持 Cypher + HNSW + 本地部署 |
| **會話管理** | **CCW Session Manager** | 成熟的會話生命週期 |
| **斷點續傳** | **CCW Resume Strategy** | 多策略 (native/hybrid) |
| **引用系統** | **OpenKL Citations** | SHA256 驗證 + GC |
| **技能系統** | **AionUi Skills** | Frontmatter + Markdown 可複用工作流 |
| **存儲封裝** | **AionUi JsonFileBuilder** | 統一文件操作 API |

### 0.3 弃用項

| 弃用項 | 原因 | 替代方案 |
|--------|------|----------|
| LanceDB | 與 Kùzu 功能重疊 | Kùzu HNSW 向量索引 |
| 简单 Citation | 功能不完整 | OpenKL CitationManager |

---

## 1. 記憶與圖系統 (Memory & Graph)

### 1.1 架構概覽

```
┌─────────────────────────────────────────────────────────────┐
│                    Memory Manager                           │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Short-term   │  │ Long-term    │  │ Episodic         │  │
│  │ (Session)    │  │ (File)       │  │ (Graph DB)       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│          │                │                  │              │
│          └────────────────┴──────────────────┘              │
│                           │                                 │
│     ┌─────────────────────┴─────────────────────┐          │
│     │            File System Contract            │          │
│     │  .writing/memories/ + .writing/store/      │          │
│     └─────────────────────┬─────────────────────┘          │
│                           │                                 │
│                    ┌──────▼──────┐                         │
│                    │  Kùzu DB    │                         │
│                    │  (Graph +   │                         │
│                    │   Vector)   │                         │
│                    └─────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 記憶類型

| 類型 | 存儲 | 生命週期 | 用途 |
|------|------|----------|------|
| **短期記憶** | Session State | 會話內 | 當前對話上下文 |
| **工作記憶** | `.writing/sessions/` | 跨會話 | 任務狀態、草稿 |
| **長期記憶** | `.writing/memories/` | 永久 | 知識、設定、素材 |
| **圖記憶** | Kùzu DB | 永久 | 實體關係、引用網絡 |

### 1.3 OpenKL File Contract

```
.writing/
├─ store/
│  ├─ sources/              # 原始文件 (PDF, HTML, Markdown)
│  └─ normalized/           # 歸一化文本 (*.ok.md)
├─ memories/
│  ├─ by_date/              # 時序組織: YYYY-MM/DD/<id>.md
│  └─ topics/               # 主題軟鏈接: <slug>/<id>.md
├─ sessions/
│  ├─ active/               # 活躍會話
│  └─ archived/             # 歸檔會話
├─ citations/               # 引用 JSON: <id>.json
└─ .ok/
   ├─ kuzu/                 # Kùzu 嵌入式圖數據庫
   ├─ cache/
   └─ mapping.jsonl         # docID → path 映射
```

### 1.4 統一圖 Schema (合併版)

```sql
-- ============================================================
-- 平台核心節點 (Platform Core - OpenKL)
-- ============================================================

-- 通用記憶節點 (384維向量)
CREATE NODE TABLE MemoryNote(
    id STRING PRIMARY KEY, 
    text STRING, 
    ts STRING, 
    tags STRING[], 
    vec FLOAT[384]
);

-- 文檔節點
CREATE NODE TABLE Doc(
    id STRING PRIMARY KEY, 
    path STRING, 
    sha256 STRING
);

-- 文檔塊節點, 用於 RAG
CREATE NODE TABLE Chunk(
    id STRING PRIMARY KEY, 
    text STRING, 
    span STRING, 
    vec FLOAT[384]
);

-- 通用實體節點
CREATE NODE TABLE Entity(
    id STRING PRIMARY KEY, 
    name STRING, 
    type STRING,
    vec FLOAT[384]
);

-- 主題節點
CREATE NODE TABLE Topic(
    id STRING PRIMARY KEY, 
    name STRING
);

-- ============================================================
-- 小説創作領域節點 (Novel Domain Adapter)
-- ============================================================

-- 角色節點, 繼承 Entity 屬性
CREATE NODE TABLE Character(
    id STRING PRIMARY KEY,
    name STRING,
    role STRING,         -- protagonist, antagonist, supporting
    personality STRING,
    language_style STRING,
    vec FLOAT[384]
);

-- 場景節點
CREATE NODE TABLE Scene(
    id STRING PRIMARY KEY,
    title STRING,
    chapter INT,
    status STRING,
    lock_total INT,
    vec FLOAT[384]
);

-- 伏筆節點
CREATE NODE TABLE Foreshadowing(
    id STRING PRIMARY KEY,
    hint TEXT,           -- 暗示內容
    payoff TEXT,         -- 回收內容
    status STRING,       -- planted, harvested
    importance STRING    -- major, minor
);

-- ============================================================
-- 平台核心關係 (Platform Core Relations)
-- ============================================================

CREATE REL TABLE HAS_CHUNK(FROM Doc TO Chunk);
CREATE REL TABLE Mentions(FROM Chunk TO Entity);
CREATE REL TABLE MemMentions(FROM MemoryNote TO Entity);
CREATE REL TABLE DerivedFrom(FROM MemoryNote TO Chunk);
CREATE REL TABLE HasTopic(FROM MemoryNote TO Topic);

-- ============================================================
-- 小説創作領域關係 (Novel Domain Relations)
-- ============================================================

CREATE REL TABLE APPEARS_IN(FROM Character TO Scene);
CREATE REL TABLE KNOWS(FROM Character TO Character, relationship STRING);
CREATE REL TABLE PLANTS(FROM Scene TO Foreshadowing);
CREATE REL TABLE HARVESTS(FROM Scene TO Foreshadowing);

-- 跨域關係 (Cross-Domain Relations)
CREATE REL TABLE CHARACTER_MENTIONED_IN(FROM Character TO Chunk);
CREATE REL TABLE SCENE_DERIVED_FROM(FROM Scene TO MemoryNote);
CREATE REL TABLE FORESHADOW_LINKED_TO(FROM Foreshadowing TO MemoryNote);

-- ============================================================
-- 向量索引 (HNSW Vector Indexes)
-- ============================================================

CALL CREATE_VECTOR_INDEX('MemoryNote', 'memory_vec_idx', 'vec', metric := 'cosine');
CALL CREATE_VECTOR_INDEX('Chunk', 'chunk_vec_idx', 'vec', metric := 'cosine');
CALL CREATE_VECTOR_INDEX('Entity', 'entity_vec_idx', 'vec', metric := 'cosine');
CALL CREATE_VECTOR_INDEX('Character', 'character_vec_idx', 'vec', metric := 'cosine');
CALL CREATE_VECTOR_INDEX('Scene', 'scene_vec_idx', 'vec', metric := 'cosine');
```


---

## 1.5 M1 Core Contract (Frozen)

### 1.5.1 Unified Data Structures

#### MemoryRecord
| Field | Type | Notes |
| --- | --- | --- |
| id | str | m-YYYYMMDD-xxxxx |
| text | str | Raw memory text |
| summary | str | None when not generated |
| tags | list[str] | |
| topics | list[str] | |
| source | dict[str, Any] | None when unknown |
| created_at | str | ISO 8601 |
| updated_at | str | ISO 8601 |
| embedding | list[float] | None when not embedded |

#### SearchResult
| Field | Type | Notes |
| --- | --- | --- |
| query | str | |
| mode | str | fuzzy | semantic | hybrid |
| items | list[SearchItem] | |
| total | int | |
| took_ms | int | None when not measured |
| metadata | dict[str, Any] | None if empty |
| error | str | None when success |

#### SearchItem (element of SearchResult.items)
| Field | Type | Notes |
| --- | --- | --- |
| source_type | str | memory | store | chunk |
| source_id | str | |
| score | float | |
| snippet | str | |
| path | str | None when not file based |
| loc | dict[str, int | str] | None when not applicable |

#### Citation
| Field | Type | Notes |
| --- | --- | --- |
| id | str | |
| type | str | doc | chunk | memory |
| path | str | |
| sha256 | str | |
| loc | dict[str, int | str] | kind, start, end |
| quote | str | |
| context | dict[str, str] | None when not captured |
| source | dict[str, Any] | None when not external |
| retention_class | str | durable | ephemeral | standard |
| tags | list[str] | |
| created_at | str | ISO 8601 |
| verified_at | str | None when not verified |

#### DistillationResult
| Field | Type | Notes |
| --- | --- | --- |
| result_id | str | |
| prompt_type | str | extract-facts | identify-patterns | summarize-insights | extract-relationships | extract-entities | memory-synthesis |
| content | str | |
| source_citations | list[str] | Citation ids |
| derived_memory_id | str | None when not written back |
| created_at | str | ISO 8601 |
| metadata | dict[str, Any] | None if empty |

### 1.5.2 Module Boundaries and Call Direction

Ownership:
- Memory module owns MemoryRecord and persistence (MemoryManager, CoreMemoryStore).
- Search module owns SearchResult and query execution (SmartSearch, VectorSearch).
- Citation module owns Citation and verification (CitationManager).
- Distillation module owns DistillationResult and synthesis (DistillationManager).

Call direction (M1): Memory -> Search -> Citation -> Distillation -> Memory (writeback).

## 2. 索引系統 (Indexing)

### 2.1 雙軌索引架構

```
┌─────────────────────────────────────────────────────────────┐
│                    Index Manager                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐    ┌─────────────────────────┐    │
│  │   AI Deep Index     │    │   Non-AI Fast Index     │    │
│  │   (Embedding)       │    │   (BM25/Tantivy)        │    │
│  │                     │    │                         │    │
│  │  • 語義相似度        │    │  • 關鍵詞匹配           │    │
│  │  • 自定義 Embedding  │    │  • 正則搜索            │    │
│  │  • Reranker 重排序   │    │  • 快速過濾            │    │
│  └─────────────────────┘    └─────────────────────────┘    │
│              │                          │                   │
│              └──────────┬───────────────┘                   │
│                         │                                   │
│                  ┌──────▼──────┐                           │
│                  │ Hybrid Fuse │                           │
│                  │  (RRF/CCS)  │                           │
│                  └─────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 索引配置

```python
# src/indexing/config.py

class IndexConfig:
    # AI 深度索引
    embedding_model: str = "BAAI/bge-m3"           # 默認
    embedding_dim: int = 1024
    custom_embedding_endpoint: str = None          # 可選自定義
    
    # Reranker
    reranker_model: str = "BAAI/bge-reranker-v2-m3"
    reranker_top_k: int = 10
    custom_reranker_endpoint: str = None
    
    # Non-AI 快速索引
    use_tantivy: bool = True                       # Rust 全文索引
    bm25_k1: float = 1.2
    bm25_b: float = 0.75
    
    # 混合融合
    fusion_method: str = "rrf"                     # rrf / ccs
    alpha: float = 0.5                             # AI 權重
```

### 2.3 代碼庫向量化

```python
# src/indexing/code_indexer.py

class CodeIndexer:
    """代碼庫向量化索引"""
    
    def __init__(self, config: IndexConfig):
        self.embedder = self._init_embedder(config)
        self.reranker = self._init_reranker(config)
    
    def index_repository(self, repo_path: str, patterns: list[str] = ["*.py", "*.md"]):
        """索引代碼庫"""
        pass
    
    def search(self, query: str, k: int = 10, use_reranker: bool = True) -> list[CodeChunk]:
        """搜索代碼"""
        pass
    
    def _init_embedder(self, config):
        if config.custom_embedding_endpoint:
            return CustomEmbedder(config.custom_embedding_endpoint)
        return FastEmbedder(config.embedding_model)
```

---

## 3. 多任務與議題管理 (Multi-Task & Agenda)

### 3.1 任務優先級系統

```python
# src/orchestration/agenda.py

from enum import IntEnum

class Priority(IntEnum):
    CRITICAL = 0   # 阻塞性問題
    HIGH = 1       # 重要截止
    MEDIUM = 2     # 正常工作
    LOW = 3        # 增強功能
    BACKLOG = 4    # 待定

class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    BLOCKED = "blocked"
    DONE = "done"
    FAILED = "failed"

@dataclass
class AgendaItem:
    id: str
    title: str
    description: str
    priority: Priority
    status: TaskStatus
    assigned_agent: str
    dependencies: list[str]
    created_at: datetime
    deadline: Optional[datetime]
    metadata: dict
```

### 3.2 Claude-Code-Workflow 本地索引

```python
# src/orchestration/ccw_index.py

class CCWIndex:
    """CCW 風格任務狀態索引"""
    
    def __init__(self, task_dir: str = ".task"):
        self.task_dir = Path(task_dir)
        self.session_dir = self.task_dir / "sessions"
        self.impl_dir = self.task_dir / "impl"
    
    def create_session(self, name: str, level: str) -> str:
        """創建工作 Session"""
        pass
    
    def save_impl_state(self, impl_id: str, state: dict):
        """保存 IMPL-*.json 狀態"""
        pass
    
    def get_pending_tasks(self, priority: Priority = None) -> list[AgendaItem]:
        """獲取待處理任務"""
        pass
```

### 3.3 多 Agent 編排

```python
# src/orchestration/multi_agent.py

class MultiAgentOrchestrator:
    """多 Agent 編排器 (CCW 風格)"""
    
    def __init__(self, agents: dict[str, BaseAgent]):
        self.agents = agents
        self.agenda = AgendaManager()
    
    async def parallel_execute(self, tasks: list[AgendaItem]) -> dict:
        """並行執行多個任務"""
        # 按依賴分組
        groups = self._group_by_dependency(tasks)
        
        results = {}
        for group in groups:
            # 組內並行執行
            group_results = await asyncio.gather(
                *[self._execute_task(t) for t in group]
            )
            results.update(dict(zip([t.id for t in group], group_results)))
        
        return results
    
    def prioritize(self, tasks: list[AgendaItem]) -> list[AgendaItem]:
        """按優先級排序"""
        return sorted(tasks, key=lambda t: (t.priority, t.created_at))
```

---

## 4. 可觀測性 (Observability)

### 4.1 操作日誌

```python
# src/observability/logger.py

@dataclass
class OperationLog:
    timestamp: datetime
    operation: str           # invoke, search, save, etc.
    agent: str
    input_summary: str
    output_summary: str
    duration_ms: int
    tokens_used: int
    model: str
    success: bool
    error: Optional[str]

class OperationLogger:
    """操作日誌記錄器"""
    
    def __init__(self, log_path: str = ".logs/operations.jsonl"):
        self.log_path = Path(log_path)
    
    def log(self, op: OperationLog):
        """記錄操作"""
        with open(self.log_path, "a") as f:
            f.write(json.dumps(asdict(op)) + "\n")
    
    def query(self, agent: str = None, start: datetime = None) -> list[OperationLog]:
        """查詢日誌"""
        pass
```

### 4.2 模型用量管理

```python
# src/observability/usage.py

@dataclass
class ModelUsage:
    model: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    cost_usd: float
    timestamp: datetime

class UsageTracker:
    """模型用量追踪"""
    
    def __init__(self, db_path: str = ".logs/usage.db"):
        self.conn = sqlite3.connect(db_path)
        self._init_schema()
    
    def track(self, model: str, input_tokens: int, output_tokens: int):
        """記錄用量"""
        cost = self._calculate_cost(model, input_tokens, output_tokens)
        self._save(ModelUsage(
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
            cost_usd=cost,
            timestamp=datetime.now()
        ))
    
    def get_summary(self, period: str = "day") -> dict:
        """獲取用量摘要"""
        pass
    
    def get_by_model(self) -> dict[str, int]:
        """按模型統計"""
        pass
    
    # 價格表 (可配置)
    PRICING = {
        "gemini-2.0-flash": {"input": 0.075, "output": 0.30},  # per 1M tokens
        "gpt-4o": {"input": 2.50, "output": 10.00},
        "claude-3-5-sonnet": {"input": 3.00, "output": 15.00},
        "deepseek-chat": {"input": 0.14, "output": 0.28}
    }
```

### 4.3 Cherry Studio 本地知識庫

```python
# src/knowledge/local_kb.py

class LocalKnowledgeBase:
    """Cherry Studio 風格本地知識庫"""
    
    def __init__(self, kb_path: str = ".knowledge"):
        self.kb_path = Path(kb_path)
        self.indexer = CodeIndexer()
    
    def add_document(self, file_path: str, metadata: dict = None):
        """添加文檔"""
        pass
    
    def add_folder(self, folder_path: str, patterns: list[str] = ["*.md", "*.txt"]):
        """批量添加文件夾"""
        pass
    
    def search(self, query: str, k: int = 10) -> list[KBResult]:
        """搜索知識庫"""
        pass
    
    def get_stats(self) -> dict:
        """獲取統計"""
        return {
            "total_documents": self._count_docs(),
            "total_chunks": self._count_chunks(),
            "index_size_mb": self._get_index_size()
        }
```

---

## 5. 目錄結構 (更新)

```
writing-agent-system/
├── src/
│   ├── agents/                    # Agent 實現
│   ├── workflow/                  # LangGraph 工作流
│   ├── ui/                        # Streamlit UI ✅
│   ├── memory/                    # 記憶管理 ⭐ NEW
│   │   ├── openkl_adapter.py
│   │   ├── graph_memory.py
│   │   └── session_memory.py
│   ├── indexing/                  # 索引系統 ⭐ NEW
│   │   ├── ai_indexer.py
│   │   ├── fast_indexer.py
│   │   ├── code_indexer.py
│   │   └── hybrid_search.py
│   ├── orchestration/             # 編排系統 ⭐ NEW
│   │   ├── agenda.py
│   │   ├── multi_agent.py
│   │   └── ccw_index.py
│   ├── observability/             # 可觀測性 ⭐ NEW
│   │   ├── logger.py
│   │   ├── usage.py
│   │   └── metrics.py
│   ├── knowledge/                 # 知識庫 ⭐ NEW
│   │   └── local_kb.py
│   ├── services/                  # 服務層 ⭐ CHERRY STUDIO
│   │   ├── memory_service.py      # 向量記憶 + 歷史追蹤
│   │   ├── knowledge_service.py   # RAG 多源加載
│   │   ├── token_service.py       # Token 估算
│   │   ├── obsidian_service.py    # Obsidian 集成
│   │   ├── backup/                # 備份服務
│   │   │   ├── backup_manager.py  # WebDAV/S3/Local
│   │   │   ├── webdav_client.py
│   │   │   └── s3_client.py
│   │   └── reranker/              # 重排策略
│   │       ├── base_reranker.py
│   │       └── strategies/
│   │           ├── jina_strategy.py
│   │           ├── voyage_strategy.py
│   │           ├── tei_strategy.py
│   │           └── bailian_strategy.py
│   └── mcp_servers/               # MCP 服務 ⭐ CHERRY STUDIO
│       ├── sequential_thinking.py # 動態推理 (分支/修訂)
│       └── memory_mcp.py          # 知識圖譜 (Entity/Relation)
├── .openkl/                       # OpenKL 記憶存儲
├── .task/                         # 任務狀態
├── .logs/                         # 日誌
├── .knowledge/                    # 本地知識庫
└── docs/
    ├── SDD.md
    ├── SDD_V2.md                  # ⭐ 本文檔
    ├── TDD.md
    └── TASKS.md
```

---

## 6. Cherry Studio 移植模塊規格 (NEW)

### 6.1 MemoryService (向量記憶服務)

```python
# src/services/memory_service.py

class MemoryService:
    """向量記憶服務 - 移植自 Cherry Studio"""
    
    def add(self, messages: list[str], options: AddMemoryOptions) -> SearchResult:
        """添加記憶 (向量化存儲)"""
        pass
    
    def search(self, query: str, options: MemorySearchOptions = {}) -> SearchResult:
        """向量搜索"""
        pass
    
    def hybrid_search(self, query: str, query_embedding: list[float], options: dict) -> SearchResult:
        """混合搜索 (向量 + 文本)"""
        pass
    
    def add_history(self, memory_id: str, prev_value: str, new_value: str, action: str):
        """變更歷史追蹤 (ADD/UPDATE/DELETE)"""
        pass
```

### 6.2 Sequential Thinking MCP

```python
# src/mcp_servers/sequential_thinking.py

@dataclass
class ThoughtData:
    thought: str
    thought_number: int
    total_thoughts: int
    is_revision: bool = False
    revises_thought: int = None
    branch_from_thought: int = None
    branch_id: str = None
    needs_more_thoughts: bool = False
    next_thought_needed: bool = True

class SequentialThinkingServer:
    """動態推理 MCP 服務"""
    
    thought_history: list[ThoughtData] = []
    branches: dict[str, list[ThoughtData]] = {}
    
    def process_thought(self, input: dict) -> dict:
        """處理推理步驟 (支持分支/修訂)"""
        pass
```

### 6.3 Reranker 策略模式

```python
# src/services/reranker/base_reranker.py

class BaseReranker(ABC):
    @abstractmethod
    def rerank(self, query: str, documents: list[str], top_k: int) -> list[RerankResult]:
        pass

# src/services/reranker/strategies/jina_strategy.py
class JinaStrategy(BaseReranker):
    def rerank(self, query: str, documents: list[str], top_k: int) -> list[RerankResult]:
        # Jina AI Reranker API
        pass
```

---

## 7. Claude-Code-Workflow 移植模塊規格 (NEW)

### 7.1 4-Level 工作流系統

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           寫作工作流層級                                      │
│                                                                              │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐      │
│  │   Level 1   │ → │   Level 2   │ → │   Level 3   │ → │   Level 4   │      │
│  │   Rapid     │   │ Lightweight │   │  Standard   │   │ Brainstorm  │      │
│  │             │   │             │   │             │   │             │      │
│  │ 快速潤色    │   │ 單章節寫作  │   │ 多章節創作 │   │ 世界觀設計  │      │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘      │
│                                                                              │
│  複雜度: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━▶     │
│         低                                                          高      │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Level | 名稱 | 工件 | 狀態 | 適用場景 |
|-------|------|------|------|----------|
| **L1** | Rapid | 無 | 無狀態 | 快速修改/潤色 |
| **L2** | Lightweight | 內存/輕量 | Session-scoped | 單章節寫作 |
| **L3** | Standard | 持久化 | 完整會話 | 多章節開發+驗證 |
| **L4** | Brainstorm | 多角色分析 | 並行探索 | 世界觀/劇情設計 |

### 7.2 CoreMemoryStore (持久化記憶)

```python
# src/memory/core_memory_store.py

@dataclass
class CoreMemory:
    id: str
    content: str
    summary: str
    raw_output: str = None
    created_at: str = None
    updated_at: str = None
    archived: bool = False
    metadata: dict = None

@dataclass
class SessionCluster:
    id: str
    name: str
    description: str = None
    intent: str = None
    status: str = 'active'  # 'active' | 'archived' | 'merged'

@dataclass
class MemoryChunk:
    source_id: str
    source_type: str  # 'core_memory' | 'workflow' | 'cli_history'
    chunk_index: int
    content: str
    embedding: bytes = None  # 向量嵌入

class CoreMemoryStore:
    """SQLite 持久化記憶存儲 - 移植自 CCW"""
    
    def __init__(self, project_path: str):
        self.db_path = Path(project_path) / ".writing" / "core_memory.db"
    
    def upsert_memory(self, memory: CoreMemory) -> CoreMemory:
        """創建或更新記憶"""
        pass
    
    def get_memory(self, id: str) -> CoreMemory | None:
        """獲取單條記憶"""
        pass
    
    def get_memories(self, archived: bool = False, limit: int = 100) -> list[CoreMemory]:
        """分頁查詢記憶"""
        pass
    
    def archive_memory(self, id: str) -> None:
        """歸檔記憶"""
        pass
    
    def generate_summary(self, memory_id: str, tool: str = 'gemini') -> str:
        """使用 LLM 生成摘要"""
        pass
    
    def create_cluster(self, cluster: SessionCluster) -> SessionCluster:
        """創建會話聚類"""
        pass
    
    def add_cluster_member(self, cluster_id: str, session_id: str, relevance: float):
        """添加聚類成員"""
        pass
```

### 7.3 Session Manager (寫作會話管理)

```python
# src/workflow/session/session_manager.py

# 內容類型路由
PATH_ROUTES = {
    'chapter': '{base}/chapters/chapter-{chapter_id}.md',
    'outline': '{base}/OUTLINE.md',
    'todo': '{base}/TODO_LIST.md',
    'character': '{base}/.data/characters/{character_id}.json',
    'scene': '{base}/.data/scenes/{scene_id}.json',
    'context': '{base}/.process/context-package.json',
}

class SessionManager:
    """寫作會話生命週期管理 - 移植自 CCW"""
    
    def init(self, session_id: str, session_type: str = 'standard') -> dict:
        """初始化會話目錄結構"""
        pass
    
    def list(self, location: str = 'active') -> list[dict]:
        """列出會話 (active/archived/all)"""
        pass
    
    def read(self, session_id: str, content_type: str, **path_params) -> str:
        """讀取會話內容 (自動路由)"""
        pass
    
    def write(self, session_id: str, content_type: str, content: str, **path_params):
        """寫入會話內容"""
        pass
    
    def archive(self, session_id: str) -> None:
        """歸檔會話"""
        pass
    
    def stats(self, session_id: str) -> dict:
        """獲取會話統計"""
        pass
```

### 7.4 Resume Strategy (斷點續傳)

```python
# src/workflow/session/resume_strategy.py

from enum import Enum
from dataclasses import dataclass

class ResumeStrategy(Enum):
    NATIVE = 'native'           # 原生恢復
    PROMPT_CONCAT = 'prompt-concat'  # Prompt 拼接
    HYBRID = 'hybrid'           # 混合 (主用原生 + 其他作為上下文)
    DISABLED = 'disabled'

@dataclass
class ResumeDecision:
    strategy: ResumeStrategy
    native_session_id: str = None
    is_latest: bool = False
    context_turns: list = None
    primary_conversation_id: str = None

def determine_resume_strategy(
    tool: str,
    resume_ids: list[str],
    custom_id: str = None,
    get_native_session_id: callable = None,
    get_conversation_tool: callable = None
) -> ResumeDecision:
    """
    決定最優恢復策略
    
    場景:
    1. 單追加 (無 custom_id) → native (如果映射存在)
    2. Fork (提供 custom_id) → prompt-concat (新對話)
    3. 多合併 → hybrid (主用原生 + 其他作上下文)
    4. 跨工具 → prompt-concat (工具不同)
    """
    pass

def build_context_prefix(
    context_turns: list,
    format: str = 'plain'  # 'plain' | 'yaml' | 'json'
) -> str:
    """構建上下文前綴"""
    pass
```

### 7.5 SmartSearch (智能搜索)

```python
# src/search/smart_search.py

from enum import Enum
from dataclasses import dataclass

class SearchMode(Enum):
    FUZZY = 'fuzzy'       # FTS + ripgrep
    SEMANTIC = 'semantic'  # Embedding + Reranker

@dataclass
class SearchResult:
    success: bool
    results: list
    metadata: dict = None
    error: str = None

@dataclass
class SemanticMatch:
    file: str
    score: float
    content: str
    symbol: str = None
    relationships: list = None

class SmartSearch:
    """智能搜索 - 移植自 CCW"""
    
    def search(
        self,
        query: str,
        mode: SearchMode = SearchMode.FUZZY,
        limit: int = 20,
        offset: int = 0
    ) -> SearchResult:
        """執行搜索"""
        pass
    
    def fuzzy_search(self, query: str, **options) -> list:
        """FTS5 + ripgrep 融合搜索"""
        pass
    
    def semantic_search(self, query: str, **options) -> list[SemanticMatch]:
        """Embedding + Reranker 語義搜索"""
        pass
    
    def rrf_merge(self, results_a: list, results_b: list, k: int = 60) -> list:
        """Reciprocal Rank Fusion 合併排序"""
        pass
    
    def auto_classify(self, query: str) -> SearchMode:
        """根據查詢自動分類模式"""
        pass
```

---

## 8. OpenKL 移植模塊規格 (NEW)

### 8.1 文件系統契約 (File System Contract)

**設計原則**: 文件為規範，圖為派生

```
.writing/
├─ store/
│  ├─ sources/          # 原始文件 (PDF, HTML, Markdown)
│  └─ normalized/       # 歸一化文本 (*.ok.md)
├─ memories/
│  ├─ by_date/          # 時序組織: YYYY-MM/DD/<id>.md
│  └─ topics/           # 主題軟鏈接: <slug>/<id>.md
├─ citations/           # 引用 JSON: <id>.json
└─ .ok/
   ├─ kuzu/             # Kùzu 嵌入式圖數據庫
   ├─ cache/
   └─ mapping.jsonl     # docID → path 映射
```

### 8.2 CitationManager (引用管理)

```python
# src/memory/citation_manager.py

@dataclass
class TransientCitation:
    """臨時引用 - 搜索返回，不持久化"""
    id: str
    surface: str          # "memory" | "store"
    path: str
    sha256: str
    loc: dict            # {kind: "char", start: int, end: int}
    quote: str
    context: dict = None  # {pre: str, post: str}
    score: float = None

@dataclass
class PersistedCitation:
    """持久引用 - 寫入磁盤，支持驗證"""
    id: str
    type: str             # "doc" | "chunk" | "memory"
    path: str
    sha256: str
    loc: dict
    quote: str
    context: dict = None
    source: dict = None   # {url, page, ...}
    retention_class: str = "standard"  # "durable" | "ephemeral" | "standard"
    tags: list[str] = None
    created_at: str = None
    last_accessed: str = None
    verified_at: str = None

class CitationManager:
    """引用管理器 - 移植自 OpenKL"""
    
    def __init__(self):
        self.citations_dir = Path(".writing") / "citations"
    
    def create_transient_citation(
        self, id: str, surface: str, path: str, quote: str, loc: dict, ...
    ) -> TransientCitation:
        """從搜索結果創建臨時引用"""
        pass
    
    def make_citation(
        self, transient: TransientCitation, retention_class: str, tags: list
    ) -> PersistedCitation:
        """轉換為持久化引用"""
        pass
    
    def verify_citation(self, cite_id: str) -> dict:
        """驗證引用完整性 (SHA256 比對)"""
        pass
    
    def open_citation(self, cite_id: str) -> dict:
        """打開並高亮引用內容"""
        pass
    
    def gc_citations(self, dry_run: bool = False) -> list:
        """垃圾回收過期引用"""
        pass
```

### 8.3 DistillationManager (知識蒸餾)

```python
# src/memory/distillation_manager.py

class DistillationManager:
    """知識蒸餾管理器 - 移植自 OpenKL"""
    
    # 6 種蒸餾模板
    PROMPTS = {
        "extract-facts": "提取事實和關鍵細節...",
        "identify-patterns": "識別重複模式和原則...",
        "summarize-insights": "創建高層摘要...",
        "extract-relationships": "識別概念間關係...",
        "extract-entities": "提取重要實體和屬性...",
        "memory-synthesis": "綜合為可行動記憶條目..."
    }
    
    def get_distillation_prompt(self, prompt_type: str = "extract-facts") -> str:
        """獲取蒸餾 Prompt 模板"""
        pass
    
    def create_memory_from_distillation(
        self,
        distilled_content: str,
        source_citations: list[str],
        tags: list[str] = None,
        topics: list[str] = None
    ) -> str:
        """從蒸餾內容創建記憶，自動建立 DerivedFrom 關係"""
        pass
    
    def _create_distillation_relationships(
        self, memory_id: str, source_citations: list[str]
    ):
        """在圖中創建 (MemoryNote)-[:DerivedFrom]->(Chunk) 關係"""
        pass
```

### 8.4 MemoryManager (時序記憶)

```python
# src/memory/memory_manager.py

class MemoryManager:
    """時序記憶管理器 - 移植自 OpenKL"""
    
    def __init__(self, base_path: Path = Path(".writing")):
        self.memories_path = base_path / "memories"
        self.topics_path = base_path / "memories" / "topics"
    
    def add(self, text: str, tags: list[str], topics: list[str]) -> str:
        """添加記憶，生成 ID: m-YYYYMMDD-<hash>"""
        pass
    
    def search(self, query: str, k: int = 5) -> list[dict]:
        """向量相似性搜索"""
        pass
    
    def update(self, memory_id: str, text: str, tags: list, topics: list):
        """更新記憶內容，自動更新軟鏈接"""
        pass
    
    def delete(self, memory_id: str):
        """刪除記憶及相關軟鏈接"""
        pass
    
    def list_recent(self, limit: int = 10) -> list[dict]:
        """列出最近 N 條記憶"""
        pass
    
    def _update_topic_symlinks(self, memory_id: str, topics: list[str]):
        """更新主題軟鏈接"""
        pass
```

### 8.5 StoreManager (文檔倉庫)

```python
# src/store/store_manager.py

class StoreManager:
    """文檔倉庫管理器 - 移植自 OpenKL"""
    
    def __init__(self, base_path: Path = Path(".writing")):
        self.store_path = base_path / "store"
        self.sources_path = self.store_path / "sources"
        self.normalized_path = self.store_path / "normalized"
    
    def ingest(self, path: Path, normalize_only: bool = False) -> str:
        """導入文檔: 解析 → 歸一化 → 分塊 → 向量化 → 入圖"""
        pass
    
    def search(self, query: str, k: int = 5, filters: dict = None) -> list[dict]:
        """向量搜索文檔塊"""
        pass
    
    def list_documents(self) -> list[dict]:
        """列出所有文檔"""
        pass
```

### 8.6 VectorSearch (向量搜索)

```python
# src/search/vector_search.py

def create_vector_indexes(verbose: bool = False):
    """創建 MemoryNote 和 Chunk 的 HNSW 向量索引"""
    pass

def search_memory_vectors(query_vector: list[float], k: int = 5) -> list[dict]:
    """記憶向量搜索 (Kùzu HNSW)"""
    pass

def search_chunk_vectors(query_vector: list[float], k: int = 5) -> list[dict]:
    """文檔塊向量搜索"""
    pass

def hybrid_search(query_vector: list[float], memory_k: int = 3, chunk_k: int = 3) -> list[dict]:
    """跨 Memory + Chunk 混合搜索"""
    pass

def get_vector_stats() -> dict:
    """向量索引統計"""
    pass
```

### 8.7 Kùzu Schema (OpenKL 風格)

```sql
-- 記憶節點 (384維向量)
CREATE NODE TABLE MemoryNote(id STRING PRIMARY KEY, text STRING, ts STRING, tags STRING[], vec FLOAT[384]);

-- 文檔節點
CREATE NODE TABLE Doc(id STRING PRIMARY KEY, path STRING, sha256 STRING);
CREATE NODE TABLE Chunk(id STRING PRIMARY KEY, text STRING, span STRING, vec FLOAT[384]);

-- 實體節點
CREATE NODE TABLE Entity(id STRING PRIMARY KEY, name STRING, type STRING);
CREATE NODE TABLE Topic(id STRING PRIMARY KEY, name STRING);

-- 關係
CREATE REL TABLE HAS_CHUNK(FROM Doc TO Chunk);
CREATE REL TABLE Mentions(FROM Chunk TO Entity);
CREATE REL TABLE MemMentions(FROM MemoryNote TO Entity);
CREATE REL TABLE DerivedFrom(FROM MemoryNote TO Chunk);
CREATE REL TABLE HasTopic(FROM MemoryNote TO Topic);

-- 向量索引 (HNSW)
CALL CREATE_VECTOR_INDEX('MemoryNote', 'memory_vec_idx', 'vec', metric := 'cosine');
CALL CREATE_VECTOR_INDEX('Chunk', 'chunk_vec_idx', 'vec', metric := 'cosine');
```

---

## 9. 會話管理系統 (Session Management) **[CCW]**

### 9.1 SessionManager

```python
# src/workflow/session/session_manager.py

from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Optional
from datetime import datetime

class SessionStatus(Enum):
    ACTIVE = 'active'
    ARCHIVED = 'archived'
    LITE = 'lite'

class ContentType(Enum):
    CHAPTER = 'chapter'
    OUTLINE = 'outline'
    CHARACTER = 'character'
    WORLDVIEW = 'worldview'
    PLAN = 'plan'
    TODO = 'todo'
    SUMMARY = 'summary'

@dataclass
class SessionInfo:
    id: str
    type: str                    # rapid | lite | standard | brainstorm | coordinator
    status: SessionStatus
    project_name: str
    created_at: datetime
    updated_at: datetime
    task_count: int = 0
    chapter_count: int = 0

# 内容类型路由表
PATH_ROUTES = {
    ContentType.CHAPTER: '{base}/chapters/chapter-{chapter_id}.md',
    ContentType.OUTLINE: '{base}/OUTLINE.md',
    ContentType.CHARACTER: '{base}/.data/characters/{character_id}.json',
    ContentType.WORLDVIEW: '{base}/.data/worldview.json',
    ContentType.PLAN: '{base}/IMPL_PLAN.md',
    ContentType.TODO: '{base}/TODO_LIST.md',
    ContentType.SUMMARY: '{base}/SUMMARY.md',
}

class SessionManager:
    """寫作會話管理器 - 移植自 CCW"""
    
    def __init__(self, base_path: Path = Path(".writing/sessions")):
        self.base_path = base_path
        self.active_path = base_path / "active"
        self.archived_path = base_path / "archived"
    
    def init(self, session_id: str, session_type: str = "standard", 
             project_name: str = None) -> SessionInfo:
        """初始化新會話"""
        pass
    
    def list(self, location: str = "active", 
             project_filter: str = None) -> list[SessionInfo]:
        """列出會話 (active | archived | all)"""
        pass
    
    def read(self, session_id: str, content_type: ContentType, 
             **kwargs) -> str:
        """讀取會話內容"""
        path = self._resolve_path(session_id, content_type, **kwargs)
        return path.read_text(encoding='utf-8')
    
    def write(self, session_id: str, content_type: ContentType, 
              content: str, **kwargs) -> bool:
        """寫入會話內容"""
        pass
    
    def archive(self, session_id: str) -> bool:
        """歸檔會話"""
        pass
    
    def delete(self, session_id: str, force: bool = False) -> bool:
        """刪除會話"""
        pass
    
    def stats(self, session_id: str) -> dict:
        """獲取會話統計"""
        pass
    
    def _resolve_path(self, session_id: str, content_type: ContentType, 
                      **kwargs) -> Path:
        """解析內容類型到文件路徑"""
        template = PATH_ROUTES[content_type]
        base = self.active_path / session_id
        return Path(template.format(base=base, **kwargs))
```

### 9.2 會話聚類 (SessionCluster)

```python
# src/memory/session_cluster.py

@dataclass
class SessionCluster:
    """會話聚類 - 相關會話分組"""
    id: str
    name: str
    description: Optional[str] = None
    intent: Optional[str] = None       # 聚類意圖
    status: str = 'active'             # active | archived | merged
    created_at: datetime = None

@dataclass
class ClusterMember:
    """聚類成員"""
    cluster_id: str
    session_id: str
    relevance_score: float = 1.0
    added_at: datetime = None

@dataclass
class ClusterRelation:
    """聚類間關係"""
    source_cluster_id: str
    target_cluster_id: str
    relation_type: str      # depends_on | extends | conflicts_with | related_to
    metadata: Optional[dict] = None

class SessionClusterManager:
    """會話聚類管理器"""
    
    def create_cluster(self, cluster: SessionCluster) -> str:
        """創建聚類"""
        pass
    
    def add_member(self, cluster_id: str, session_id: str, 
                   relevance_score: float = 1.0) -> bool:
        """添加成員到聚類"""
        pass
    
    def add_relation(self, relation: ClusterRelation) -> bool:
        """添加聚類關係"""
        pass
    
    def get_related_sessions(self, session_id: str) -> list[SessionInfo]:
        """獲取相關會話"""
        pass
    
    def merge_clusters(self, cluster_ids: list[str], 
                       new_name: str) -> str:
        """合併聚類"""
        pass
```

---

## 10. 斷點續傳策略 (Resume Strategy) **[CCW]**

### 10.1 策略類型

```python
# src/workflow/session/resume_strategy.py

from enum import Enum
from dataclasses import dataclass
from typing import Optional

class ResumeStrategy(Enum):
    NATIVE = 'native'           # 原生會話恢復 (Claude/Gemini 原生支持)
    PROMPT_CONCAT = 'prompt-concat'  # 上下文拼接到 Prompt
    HYBRID = 'hybrid'           # 混合策略
    DISABLED = 'disabled'       # 禁用續傳

class ContextFormat(Enum):
    PLAIN = 'plain'
    YAML = 'yaml'
    JSON = 'json'

@dataclass
class ConversationTurn:
    """對話輪次"""
    role: str               # user | assistant | system
    content: str
    timestamp: datetime
    tool_calls: Optional[list] = None

@dataclass
class ResumeDecision:
    """續傳決策結果"""
    strategy: ResumeStrategy
    native_session_id: Optional[str] = None
    is_latest: bool = True
    context_turns: Optional[list[ConversationTurn]] = None
    primary_conversation_id: Optional[str] = None
    context_format: ContextFormat = ContextFormat.YAML
```

### 10.2 策略決定邏輯

```python
class ResumeStrategyResolver:
    """斷點續傳策略解析器"""
    
    def determine_strategy(
        self,
        tool: str,                    # gemini | claude | qwen
        resume_ids: list[str],        # 要恢復的會話 ID
        custom_id: Optional[str] = None
    ) -> ResumeDecision:
        """
        決定最佳續傳策略
        
        場景類型:
        - 單追加: resume_ids=[id], 繼續同一會話 → native
        - Fork: 從某點分叉 → prompt-concat + new session
        - 多合併: resume_ids=[id1, id2] → hybrid
        - 跨工具: 從 Claude 切換到 Gemini → prompt-concat
        """
        # 單追加場景
        if len(resume_ids) == 1 and self._supports_native(tool):
            return ResumeDecision(
                strategy=ResumeStrategy.NATIVE,
                native_session_id=resume_ids[0],
                is_latest=True
            )
        
        # 多會話合併
        if len(resume_ids) > 1:
            context = self._merge_contexts(resume_ids)
            return ResumeDecision(
                strategy=ResumeStrategy.HYBRID,
                context_turns=context,
                context_format=ContextFormat.YAML
            )
        
        # 跨工具場景
        return ResumeDecision(
            strategy=ResumeStrategy.PROMPT_CONCAT,
            context_turns=self._load_context(resume_ids[0])
        )
    
    def build_context_prefix(
        self,
        context_turns: list[ConversationTurn],
        format: ContextFormat = ContextFormat.YAML
    ) -> str:
        """構建上下文前綴"""
        if format == ContextFormat.PLAIN:
            return self._build_plain(context_turns)
        elif format == ContextFormat.YAML:
            return self._build_yaml(context_turns)
        else:
            return self._build_json(context_turns)
    
    def _supports_native(self, tool: str) -> bool:
        """檢查工具是否支持原生續傳"""
        return tool in ['claude', 'gemini']
    
    def _merge_contexts(self, session_ids: list[str]) -> list[ConversationTurn]:
        """合併多個會話上下文"""
        pass
    
    def _load_context(self, session_id: str) -> list[ConversationTurn]:
        """加載會話上下文"""
        pass
```

---

## 11. 分層工作流系統 (L1-L5 Workflow) **[CCW]**

### 11.1 工作流層級概覽

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          工作流層級系統                                       │
├──────┬──────────────────────────────────────────────────────────────────────┤
│ L1   │ Rapid (快速)        │ 無狀態、無工件、直接輸出                        │
│      │ lite-lite-lite      │ 適用: 錯字修正、格式調整、快速潤色              │
├──────┼──────────────────────────────────────────────────────────────────────┤
│ L2   │ Lightweight (輕量)  │ 內存計劃、輕量持久化                            │
│      │ lite-plan/lite-fix  │ 適用: 單章節寫作、情節調整                      │
├──────┼──────────────────────────────────────────────────────────────────────┤
│ L3   │ Standard (標準)     │ 完整會話、驗證步驟                              │
│      │ plan → execute      │ 適用: 多章節開發、角色塑造                      │
├──────┼──────────────────────────────────────────────────────────────────────┤
│ L4   │ Brainstorm (風暴)   │ 多角色並行分析                                  │
│      │ auto-parallel       │ 適用: 世界觀設計、劇情構思                      │
├──────┼──────────────────────────────────────────────────────────────────────┤
│ L5   │ Coordinator (編排)  │ 智能鏈推薦、狀態持久化                          │
│      │ auto-orchestrate    │ 適用: 完整小說創作、長期項目                    │
└──────┴──────────────────────────────────────────────────────────────────────┘
```

### 11.2 Level 1: Rapid (快速模式)

```python
# src/workflow/levels/level1_rapid.py

class Level1Rapid:
    """
    L1 快速模式 - 無狀態、無工件
    
    特點:
    - 無會話持久化
    - 無工件生成
    - 直接輸出結果
    - 最快響應
    
    適用場景:
    - 錯字修正
    - 格式調整
    - 快速潤色
    - 簡單問答
    """
    
    def execute(self, prompt: str, context: str = None) -> str:
        """直接執行，返回結果"""
        pass
```

### 11.3 Level 3: Standard (標準模式)

```python
# src/workflow/levels/level3_standard.py

from dataclasses import dataclass
from typing import Optional

@dataclass
class PlanPhase:
    """計劃階段"""
    phase: int              # 1-5
    name: str
    description: str
    status: str             # pending | in_progress | completed
    output: Optional[str] = None

class Level3Standard:
    """
    L3 標準模式 - 完整會話 + 驗證
    
    五階段計劃:
    1. 需求理解與澄清
    2. 已有內容分析
    3. 變更範圍定義
    4. 實施計劃生成
    5. 驗證步驟定義
    
    命令鏈:
    plan → plan-verify → execute → verify
    """
    
    PLAN_PHASES = [
        PlanPhase(1, "需求理解", "理解用戶需求，澄清模糊點"),
        PlanPhase(2, "內容分析", "分析已有章節、角色、世界觀"),
        PlanPhase(3, "變更範圍", "定義修改範圍，識別影響點"),
        PlanPhase(4, "實施計劃", "生成詳細執行步驟"),
        PlanPhase(5, "驗證定義", "定義驗收標準和測試用例"),
    ]
    
    def __init__(self, session_manager: SessionManager):
        self.session_manager = session_manager
    
    def plan(self, session_id: str, requirement: str) -> list[PlanPhase]:
        """生成計劃 (5 階段)"""
        pass
    
    def plan_verify(self, session_id: str) -> dict:
        """驗證計劃完整性"""
        pass
    
    def execute(self, session_id: str) -> str:
        """執行計劃"""
        pass
    
    def verify(self, session_id: str) -> dict:
        """驗證執行結果"""
        pass
```

### 11.4 Level 5: Coordinator (智能編排)

```python
# src/workflow/levels/level5_coordinator.py

from dataclasses import dataclass
from typing import Optional

@dataclass
class TaskAnalysis:
    """任務分析結果"""
    goal: str
    scope: str
    constraints: list[str]
    complexity: int         # 1-5
    estimated_levels: list[int]
    recommended_chain: list[str]

@dataclass 
class ExecutionUnit:
    """最小執行單元"""
    id: str
    commands: list[str]     # 必須一起執行的命令
    dependencies: list[str]
    can_parallel: bool

class Level5Coordinator:
    """
    L5 智能編排 - 自動規劃命令鏈
    
    功能:
    1. 需求分析 (goal/scope/constraints/complexity)
    2. 命令鏈推薦 + 用戶確認
    3. 最小執行單元 (Minimum Execution Units)
    4. 依賴感知並行
    5. 狀態持久化 (state.json)
    """
    
    def analyze_task(self, requirement: str) -> TaskAnalysis:
        """分析任務複雜度和需求"""
        pass
    
    def recommend_chain(self, analysis: TaskAnalysis) -> list[str]:
        """推薦命令鏈"""
        # 示例推薦:
        # 簡單任務 → ["lite-plan", "lite-execute"]
        # 中等任務 → ["plan", "plan-verify", "execute"]
        # 複雜任務 → ["brainstorm", "plan", "plan-verify", "execute", "verify"]
        pass
    
    def decompose_to_units(self, chain: list[str]) -> list[ExecutionUnit]:
        """分解為最小執行單元"""
        pass
    
    def execute_chain(self, session_id: str, chain: list[str],
                      on_progress: callable = None) -> dict:
        """執行命令鏈"""
        pass
    
    def save_state(self, session_id: str) -> bool:
        """持久化狀態到 state.json"""
        pass
    
    def resume_from_state(self, session_id: str) -> dict:
        """從 state.json 恢復"""
        pass
```

---

## 12. 智能搜索增強 (SmartSearch Enhancement) **[CCW]**

### 12.1 雙模式搜索

```python
# src/search/smart_search.py

from enum import Enum
from dataclasses import dataclass
from typing import Optional

class SearchMode(Enum):
    FUZZY = 'fuzzy'         # FTS5 + ripgrep
    SEMANTIC = 'semantic'   # Embedding + Reranker
    HYBRID = 'hybrid'       # 兩者融合

@dataclass
class SearchResult:
    success: bool
    results: list
    metadata: Optional[dict] = None
    error: Optional[str] = None

@dataclass
class FuzzyMatch:
    """模糊匹配結果"""
    file: str
    line: int
    content: str
    score: float
    highlights: list[tuple]  # (start, end) 高亮位置

@dataclass
class SemanticMatch:
    """語義匹配結果"""
    file: str
    score: float
    content: str
    symbol: Optional[str] = None
    relationships: Optional[list] = None

class SmartSearch:
    """智能搜索 - 移植自 CCW"""
    
    def search(
        self,
        query: str,
        mode: SearchMode = SearchMode.HYBRID,
        limit: int = 20,
        offset: int = 0,
        filters: dict = None
    ) -> SearchResult:
        """統一搜索接口"""
        if mode == SearchMode.FUZZY:
            return self.fuzzy_search(query, limit, offset)
        elif mode == SearchMode.SEMANTIC:
            return self.semantic_search(query, limit, offset)
        else:
            return self.hybrid_search(query, limit, offset)
    
    def fuzzy_search(self, query: str, limit: int = 20, 
                     offset: int = 0) -> SearchResult:
        """模糊搜索 (FTS5 + ripgrep)"""
        pass
    
    def semantic_search(self, query: str, limit: int = 20,
                        offset: int = 0) -> SearchResult:
        """語義搜索 (Embedding + Reranker)"""
        pass
    
    def hybrid_search(self, query: str, limit: int = 20,
                      offset: int = 0) -> SearchResult:
        """混合搜索 (RRF 融合)"""
        fuzzy_results = self.fuzzy_search(query, limit * 2, 0)
        semantic_results = self.semantic_search(query, limit * 2, 0)
        merged = self.rrf_merge(fuzzy_results.results, 
                                semantic_results.results, k=60)
        return SearchResult(success=True, results=merged[:limit])
    
    def rrf_merge(self, results_a: list, results_b: list, 
                  k: int = 60) -> list:
        """
        Reciprocal Rank Fusion 合併排序
        
        公式: RRF(d) = Σ 1 / (k + rank(d))
        """
        scores = {}
        
        for rank, item in enumerate(results_a):
            key = getattr(item, 'file', str(item))
            scores[key] = scores.get(key, 0) + 1 / (k + rank + 1)
        
        for rank, item in enumerate(results_b):
            key = getattr(item, 'file', str(item))
            scores[key] = scores.get(key, 0) + 1 / (k + rank + 1)
        
        # 按分數排序
        sorted_keys = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
        return sorted_keys
    
    def auto_classify(self, query: str) -> SearchMode:
        """
        根據查詢自動分類模式
        
        規則:
        - 包含特殊字符 (*, ?, []) → FUZZY
        - 短查詢 (<3 字) → FUZZY
        - 自然語言問句 → SEMANTIC
        - 其他 → HYBRID
        """
        if any(c in query for c in '*?[]'):
            return SearchMode.FUZZY
        if len(query) < 3:
            return SearchMode.FUZZY
        if query.endswith('?') or query.startswith(('什麼', '如何', '為什麼')):
            return SearchMode.SEMANTIC
        return SearchMode.HYBRID
    
    def watch(self, paths: list[str], callback: callable):
        """監控文件變更，觸發重新索引"""
        pass
```

---

## 13. AionUi Skills 系統 **[AionUi]**

### 13.1 Skills 設計理念

Skills 是可複用的工作流模板，採用 **Frontmatter + Markdown** 格式，支持:
- 結構化元數據 (YAML Frontmatter)
- 人類可讀的工作流描述
- 決策樹路由
- 內嵌腳本和工具

### 13.2 目錄結構

```
skills/
├── novel-chapter/           # 章節創作技能
│   ├── SKILL.md            # 技能描述 + 工作流
│   ├── templates/          # 提示詞模板
│   └── scripts/            # 工具腳本
├── character-design/        # 角色設計技能
│   ├── SKILL.md
│   ├── archetypes/         # 原型庫
│   └── templates/
├── worldview-builder/       # 世界觀構建
├── plot-structuring/        # 劇情結構
├── dialogue-polish/         # 對話潤色
└── skill-creator/           # 技能創建工具
```

### 13.3 SKILL.md 格式規範

```yaml
---
name: novel-chapter
description: '章節創作技能 - 支持有大綱和無大綱兩種模式'
version: "1.0"
author: "system"
tags: [writing, novel, chapter]
---

# 章節創作技能

## Overview
本技能用於創作小說章節，支持多種創作模式。

## Workflow Decision Tree

### 新章節創作
- **有大綱** → Use "有大綱章節創作" workflow
- **無大綱** → Use "探索性寫作" workflow

### 章節修訂
- **內容調整** → Use "章節重寫" workflow
- **風格潤色** → Use "文筆優化" workflow

## 有大綱章節創作

1. 讀取大綱相關章節
2. 分析前後章節銜接
3. 生成章節草稿
4. 調用 Critic Agent 評審

## 探索性寫作

1. 分析已有角色狀態
2. 生成多個劇情走向
3. 用戶選擇或 AI 推薦
4. 生成章節內容
```

### 13.4 SkillLoader 實現

```python
# src/skills/skill_loader.py

from dataclasses import dataclass
from pathlib import Path
import yaml
import re

@dataclass
class SkillMetadata:
    name: str
    description: str
    version: str = "1.0"
    author: str = "system"
    tags: list[str] = None

@dataclass
class Skill:
    metadata: SkillMetadata
    content: str
    path: Path

class SkillLoader:
    """技能加載器"""
    
    def __init__(self, skills_dir: Path = Path("skills")):
        self.skills_dir = skills_dir
        self._cache: dict[str, Skill] = {}
    
    def load(self, skill_name: str) -> Skill:
        """加載技能"""
        if skill_name in self._cache:
            return self._cache[skill_name]
        
        skill_path = self.skills_dir / skill_name / "SKILL.md"
        if not skill_path.exists():
            raise FileNotFoundError(f"Skill not found: {skill_name}")
        
        content = skill_path.read_text(encoding='utf-8')
        metadata, body = self._parse_frontmatter(content)
        
        skill = Skill(
            metadata=SkillMetadata(**metadata),
            content=body,
            path=skill_path
        )
        self._cache[skill_name] = skill
        return skill
    
    def list_skills(self) -> list[str]:
        """列出所有技能"""
        return [d.name for d in self.skills_dir.iterdir() 
                if d.is_dir() and (d / "SKILL.md").exists()]
    
    def _parse_frontmatter(self, content: str) -> tuple[dict, str]:
        """解析 YAML Frontmatter"""
        pattern = r'^---\s*\n(.*?)\n---\s*\n(.*)$'
        match = re.match(pattern, content, re.DOTALL)
        if match:
            frontmatter = yaml.safe_load(match.group(1))
            body = match.group(2)
            return frontmatter, body
        return {}, content
```

---

## 14. 存儲封裝層 **[AionUi]**

### 14.1 FileBuilder 基類

```python
# src/storage/file_builder.py

from pathlib import Path
from typing import TypeVar, Generic
import json

T = TypeVar('T')

class FileBuilder:
    """文件操作基類"""
    
    def __init__(self, path: Path):
        self.path = Path(path)
    
    def write(self, data: str) -> None:
        """寫入文件"""
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(data, encoding='utf-8')
    
    def read(self) -> str:
        """讀取文件"""
        return self.path.read_text(encoding='utf-8')
    
    def copy(self, dest: Path) -> None:
        """複製文件"""
        import shutil
        shutil.copy(self.path, dest)
    
    def rm(self) -> None:
        """刪除文件"""
        self.path.unlink(missing_ok=True)
    
    def exists(self) -> bool:
        """檢查文件是否存在"""
        return self.path.exists()
```

### 14.2 JsonFileBuilder

```python
class JsonFileBuilder(FileBuilder, Generic[T]):
    """JSON 文件操作"""
    
    def to_json(self) -> T:
        """讀取為 JSON 對象"""
        if not self.exists():
            return {}
        return json.loads(self.read())
    
    def set_json(self, data: T) -> None:
        """寫入 JSON 對象"""
        self.write(json.dumps(data, ensure_ascii=False, indent=2))
    
    def get(self, key: str, default=None):
        """獲取單個字段"""
        data = self.to_json()
        return data.get(key, default)
    
    def set(self, key: str, value) -> None:
        """設置單個字段"""
        data = self.to_json()
        data[key] = value
        self.set_json(data)
    
    def remove(self, key: str) -> None:
        """刪除字段"""
        data = self.to_json()
        data.pop(key, None)
        self.set_json(data)
    
    def update(self, key: str, update_fn: callable) -> None:
        """原子更新字段"""
        data = self.to_json()
        data[key] = update_fn(data.get(key))
        self.set_json(data)
    
    def backup(self, suffix: str = ".bak") -> Path:
        """備份文件"""
        backup_path = self.path.with_suffix(self.path.suffix + suffix)
        self.copy(backup_path)
        return backup_path
```

### 14.3 與 OpenKL File Contract 整合

```python
# src/storage/writing_storage.py

from pathlib import Path

class WritingStorage:
    """寫作系統存儲管理"""
    
    def __init__(self, base_path: Path = Path(".writing")):
        self.base_path = base_path
        
        # OpenKL 風格目錄
        self.store_path = base_path / "store"
        self.memories_path = base_path / "memories"
        self.sessions_path = base_path / "sessions"
        self.citations_path = base_path / "citations"
        
        # AionUi 風格配置
        self.config = JsonFileBuilder(base_path / ".ok" / "config.json")
        self.mapping = JsonFileBuilder(base_path / ".ok" / "mapping.json")
    
    def ensure_directories(self):
        """確保目錄存在"""
        for path in [
            self.store_path / "sources",
            self.store_path / "normalized",
            self.memories_path / "by_date",
            self.memories_path / "topics",
            self.sessions_path / "active",
            self.sessions_path / "archived",
            self.citations_path,
            self.base_path / ".ok" / "kuzu",
        ]:
            path.mkdir(parents=True, exist_ok=True)
```

---

## 15. 四項目功能互補矩陣

### 15.1 功能對比表

| 功能領域 | CCW | Cherry Studio | OpenKL | AionUi | 採用 |
|---------|-----|---------------|--------|--------|------|
| **會話管理** | ✅ SessionManager | 🟡 基礎 | ❌ | 🟡 基礎 | **CCW** |
| **斷點續傳** | ✅ ResumeStrategy | ❌ | ❌ | ❌ | **CCW** |
| **分層工作流** | ✅ L1-L5 | ❌ | ❌ | ❌ | **CCW** |
| **智能搜索** | ✅ RRF 融合 | 🟡 | ✅ HNSW | ❌ | **CCW + OpenKL** |
| **向量記憶** | 🟡 CoreMemory | ✅ MemoryService | ✅ MemoryManager | ❌ | **Cherry** |
| **歷史追蹤** | ❌ | ✅ add_history | ❌ | ❌ | **Cherry** |
| **云備份** | ❌ | ✅ BackupManager | ❌ | ❌ | **Cherry** |
| **重排序** | ❌ | ✅ Reranker 策略 | ❌ | ❌ | **Cherry** |
| **動態推理** | ❌ | ✅ SequentialThinking | ❌ | ❌ | **Cherry** |
| **引用系統** | ❌ | ❌ | ✅ CitationManager | ❌ | **OpenKL** |
| **知識蒸餾** | ❌ | ❌ | ✅ DistillationManager | ❌ | **OpenKL** |
| **時序組織** | ❌ | ❌ | ✅ by_date + symlink | ❌ | **OpenKL** |
| **文檔分塊** | ❌ | ✅ KnowledgeService | ✅ StoreManager | ❌ | **OpenKL** |
| **技能系統** | ❌ | ❌ | ❌ | ✅ Skills | **AionUi** |
| **存儲封裝** | ❌ | ❌ | ❌ | ✅ JsonFileBuilder | **AionUi** |
| **多 Agent 適配** | ✅ CLI Executor | ❌ | ❌ | ✅ Agent Adapter | **CCW + AionUi** |

### 15.2 最佳實踐選擇

```
┌───────────────────────────────────────────────────────────────────────────┐
│                      Writing Agent System 架構選擇                         │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌────────────┐  │
│   │   CCW       │   │   Cherry    │   │   OpenKL    │   │   AionUi   │  │
│   │             │   │   Studio    │   │             │   │            │  │
│   │ • 會話管理  │   │ • 向量記憶  │   │ • 引用系統  │   │ • Skills   │  │
│   │ • 斷點續傳  │   │ • 備份服務  │   │ • 蒸餾模板  │   │ • 存儲封裝 │  │
│   │ • L1-L5     │   │ • Reranker  │   │ • 時序組織  │   │            │  │
│   │ • RRF 搜索  │   │ • 推理 MCP  │   │ • 文檔分塊  │   │            │  │
│   └─────────────┘   └─────────────┘   └─────────────┘   └────────────┘  │
│         │                 │                 │                 │          │
│         └─────────────────┴─────────────────┴─────────────────┘          │
│                                    │                                      │
│                            ┌───────▼───────┐                             │
│                            │   Platform    │                             │
│                            │     Core      │                             │
│                            └───────────────┘                             │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 17. 跨領域工作流架構 **[NEW]**

### 17.1 設計理念

```
┌───────────────────────────────────────────────────────────────────────────┐
│                        跨領域工作流架構                                     │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                       Platform Core (通用)                          │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐          │ │
│  │  │ BaseState    │  │ BaseAdapter  │  │ WorkflowFactory  │          │ │
│  │  │ (Abstract)   │  │ (Interface)  │  │ (Factory)        │          │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘          │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                    │                                      │
│           ┌────────────────────────┼────────────────────────┐            │
│           ▼                        ▼                        ▼            │
│  ┌────────────────┐      ┌────────────────┐      ┌────────────────┐     │
│  │ NovelAdapter   │      │ CodeAdapter    │      │ CustomAdapter  │     │
│  │                │      │                │      │                │     │
│  │ WritingState   │      │ CodingState    │      │ CustomState    │     │
│  │ LOCK Scoring   │      │ Tests/Lint     │      │ User-defined   │     │
│  └────────────────┘      └────────────────┘      └────────────────┘     │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

### 17.2 BaseState 通用字段

```python
class BaseState(TypedDict, total=False):
    """所有領域共享的基礎狀態"""
    
    # 會話元數據
    session_id: str
    created_at: str
    domain: str                    # "novel" | "code" | "knowledge"
    workflow_level: int            # 1-5 (L1-L5)
    
    # 通用循環控制
    current_step: str
    revision_count: int
    max_revisions: int
    
    # 通用決策
    decision: str                  # APPROVED | REVISE | HUMAN_REVIEW
    score: float
    
    # 通用輸出
    draft_content: str
    final_output: str
    
    # 錯誤處理
    errors: List[str]
    requires_human_intervention: bool
```

### 17.3 適配器註冊系統

```python
# 註冊新領域適配器
@AdapterRegistry.register("knowledge")
class KnowledgeAdapter(BaseDomainAdapter):
    def get_domain_type(self) -> str:
        return "knowledge"
    
    def create_initial_state(self, user_request: str, **kwargs):
        # 實現領域專用初始化
        pass
    
    def evaluate(self, state):
        # 實現領域專用評估
        pass
    
    def create_graph(self):
        # 實現領域專用工作流圖
        pass

# 使用工廠創建工作流
graph = WorkflowFactory.create("knowledge", level=WorkflowLevel.L3_STANDARD)
```

### 17.4 領域評估維度對比

| 領域 | 評估維度 | 權重 | 通過閾值 |
|------|---------|------|---------|
| **小說 (Novel)** | L (主角), O (目標), C (冲突), K (結尾) | C: 40%, 其他各 20% | 80 分 |
| **代碼 (Code)** | Tests, Lint, Build, Coverage | Tests: 40%, Lint: 30%, Build: 30% | 80 分 |
| **知識 (Knowledge)** | Accuracy, Completeness, Relevance | 各 33% | 80 分 |

### 17.5 工作流層級跨領域對照

| Level | 小說創作 | 代碼開發 | 知識管理 |
|-------|---------|---------|---------|
| **L1 Rapid** | 快速潤色 | typo 修復 | 快速問答 |
| **L2 Lite** | 單章節寫作 | 單文件修改 | 文檔更新 |
| **L3 Standard** | 多章節開發 | 功能開發 + 測試 | 知識庫構建 |
| **L4 Brainstorm** | 世界觀設計 | 架構設計 | 研究規劃 |
| **L5 Coordinator** | 完整小說 | 完整項目 | 知識體系 |

### 17.6 擴展新領域指南

1. **創建狀態類**: 繼承 `BaseState`，添加領域專用字段
2. **創建適配器**: 繼承 `BaseDomainAdapter`，實現抽象方法
3. **註冊適配器**: 使用 `@AdapterRegistry.register("domain_name")`
4. **測試工作流**: 使用 `WorkflowFactory.create("domain_name")`

```python
# 示例: 創建音樂創作適配器
@AdapterRegistry.register("music")
class MusicAdapter(BaseDomainAdapter):
    def get_domain_type(self) -> str:
        return "music"
    
    def create_initial_state(self, user_request: str, **kwargs):
        return MusicState(
            user_request=user_request,
            genre=kwargs.get("genre", "pop"),
            tempo=kwargs.get("tempo", 120),
            # ...
        )
    
    def evaluate(self, state):
        # 音樂評估: 旋律、和聲、節奏、情感
        pass
    
    def create_graph(self):
        # [Composer] → [Arranger] → [Critic] → {路由}
        pass
```

---

## 18. 版本歷史

| 版本 | 日期 | 變更說明 |
|------|------|----------|
| 2.0 | 2026-01-25 | 初始 SDD |
| 2.1 | 2026-01-26 | 添加 Section 0 (架構決策)、Section 1.4 (統一 Schema) |
| 2.2 | 2026-01-26 | 添加 Section 8 (OpenKL 模塊) |
| 2.3 | 2026-01-26 | 添加 Section 9-12 (SessionManager, ResumeStrategy, L1-L5 Workflow, SmartSearch) |
| 2.4 | 2026-01-26 | 添加 Section 13-15 (AionUi Skills, 存儲封裝, 四項目矩陣) |
| **2.5** | **2026-01-26** | **添加 Section 17 (跨領域工作流架構 - BaseState/Adapter/Factory)** |

---

*文檔版本: 2.5 | 更新時間: 2026-01-26*

