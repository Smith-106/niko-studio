# AI Agent Platform - API 参考文档

**版本**: 2.7  
**更新日期**: 2026-01-26

---

## 1. 记忆层 API

### 1.1 MemoryManager

```python
from src.memory.memory_manager import MemoryManager

manager = MemoryManager(base_path=".writing")

# 添加记忆
memory_id = manager.add(
    text="角色张三是一个性格内向的程序员",
    tags=["character", "personality"],
    topics=["novel", "protagonist"]
)
# 返回: "m-20260126-abc123"

# 搜索记忆
results = manager.search(query="张三", k=5)
# 返回: [{"id": "...", "text": "...", "score": 0.95}, ...]

# 更新记忆
manager.update(
    memory_id="m-20260126-abc123",
    text="张三是一个外向开朗的程序员",
    tags=["character", "updated"]
)

# 删除记忆
manager.delete(memory_id="m-20260126-abc123")

# 列出最近记忆
recents = manager.list_recent(limit=10)
```

### 1.2 CitationManager

```python
from src.memory.citation_manager import CitationManager, TransientCitation

manager = CitationManager()

# 从搜索结果创建临时引用
transient = manager.create_transient_citation(
    id="doc-abc#chunk0001",
    surface="store",
    path=".writing/store/normalized/doc.ok.md",
    quote="这是引用的原文内容",
    loc={"kind": "char", "start": 100, "end": 200}
)

# 转换为持久化引用
persisted = manager.make_citation(
    transient=transient,
    retention_class="durable",  # durable | ephemeral | standard
    tags=["important", "character"]
)

# 验证引用完整性
result = manager.verify_citation(cite_id="doc-abc#chunk0001")
# 返回: {"valid": True, "sha256": "...", "message": "OK"}

# 打开引用
content = manager.open_citation(cite_id="doc-abc#chunk0001")

# 垃圾回收
expired = manager.gc_citations(dry_run=True)
```

### 1.3 DistillationManager

```python
from src.memory.distillation_manager import DistillationManager

manager = DistillationManager()

# 获取蒸馏 Prompt 模板
prompt = manager.get_distillation_prompt(prompt_type="extract-facts")
# 可选: extract-facts, identify-patterns, summarize-insights,
#       extract-relationships, extract-entities, memory-synthesis

# 从蒸馏内容创建记忆
memory_id = manager.create_memory_from_distillation(
    distilled_content="张三是主角，性格内向...",
    source_citations=["doc-abc#chunk0001", "doc-abc#chunk0002"],
    tags=["distilled", "character"],
    topics=["novel"]
)
```

---

## 2. 工作流 API

### 2.1 SessionManager

```python
from src.workflow.session.session_manager import SessionManager

manager = SessionManager()

# 初始化会话
session = manager.init(session_id="session-001", session_type="standard")

# 列出会话
sessions = manager.list(location="active")  # active | archived | all

# 读取会话内容
content = manager.read(
    session_id="session-001",
    content_type="chapter",
    chapter_id="1"
)

# 写入会话内容
manager.write(
    session_id="session-001",
    content_type="chapter",
    content="第一章内容...",
    chapter_id="1"
)

# 归档会话
manager.archive(session_id="session-001")

# 获取统计
stats = manager.stats(session_id="session-001")
```

### 2.2 ResumeStrategy

```python
from src.workflow.session.resume_strategy import (
    determine_resume_strategy,
    build_context_prefix,
    ResumeStrategy
)

# 决定恢复策略
decision = determine_resume_strategy(
    tool="gemini",
    resume_ids=["conv-001", "conv-002"],
    custom_id=None
)
# 返回: ResumeDecision(strategy=ResumeStrategy.NATIVE, ...)

# 构建上下文前缀
prefix = build_context_prefix(
    context_turns=[...],
    format="yaml"  # plain | yaml | json
)
```

---

## 3. 搜索 API

### 3.1 SmartSearch

```python
from src.search.smart_search import SmartSearch, SearchMode

search = SmartSearch()

# 执行搜索
result = search.search(
    query="张三的性格特点",
    mode=SearchMode.SEMANTIC,  # FUZZY | SEMANTIC
    limit=20,
    offset=0
)

# 模糊搜索
fuzzy_results = search.fuzzy_search(query="张三")

# 语义搜索
semantic_results = search.semantic_search(query="主角的心理变化")

# RRF 融合排序
merged = search.rrf_merge(results_a, results_b, k=60)

# 自动分类模式
mode = search.auto_classify(query="张三")
```

### 3.2 VectorSearch

```python
from src.search.vector_search import (
    search_memory_vectors,
    search_chunk_vectors,
    hybrid_search,
    create_vector_indexes
)

# 创建向量索引
create_vector_indexes(verbose=True)

# 搜索记忆向量
results = search_memory_vectors(query_vector=[...], k=5)

# 搜索文档块向量
results = search_chunk_vectors(query_vector=[...], k=5)

# 混合搜索
results = hybrid_search(query_vector=[...], memory_k=3, chunk_k=3)
```

---

## 4. 图谱 API

### 4.1 GraphManager

```python
from src.graph.graph_manager import GraphManager

manager = GraphManager()

# 执行 Cypher 查询
results = manager.run_cypher(
    query="MATCH (c:Character) WHERE c.name = $name RETURN c",
    params={"name": "张三"}
)

# 获取图统计
stats = manager.get_entity_stats()

# 查找关联实体
related = manager.find_related_entities(entity_name="张三")

# 获取记忆提及的实体
entities = manager.get_memory_entities(memory_id="m-20260126-abc123")
```

---

## 5. 文档仓库 API

### 5.1 StoreManager

```python
from src.store.store_manager import StoreManager
from pathlib import Path

manager = StoreManager()

# 导入文档
doc_id = manager.ingest(path=Path("./docs/novel.md"))

# 搜索文档
results = manager.search(query="第一章", k=5)

# 列出所有文档
docs = manager.list_documents()
```

---

## 6. 数据结构

### 6.1 Citation

```python
@dataclass
class TransientCitation:
    id: str
    surface: str          # "memory" | "store"
    path: str
    sha256: str
    loc: dict            # {kind, start, end}
    quote: str
    context: dict = None
    score: float = None

@dataclass
class PersistedCitation:
    id: str
    type: str             # "doc" | "chunk" | "memory"
    path: str
    sha256: str
    loc: dict
    quote: str
    retention_class: str  # "durable" | "ephemeral" | "standard"
    tags: list[str] = None
    created_at: str = None
```

### 6.2 Memory

```python
@dataclass
class MemoryNote:
    id: str               # "m-YYYYMMDD-hash"
    text: str
    ts: str
    tags: list[str]
    topics: list[str]
    vec: list[float]      # 384-dim
```

### 6.3 Session

```python
@dataclass
class SessionInfo:
    id: str
    type: str             # "rapid" | "lite" | "standard" | ...
    status: str           # "active" | "archived"
    created_at: str
    updated_at: str
```

---

*文档版本: 2.7 | 更新时间: 2026-01-26*
