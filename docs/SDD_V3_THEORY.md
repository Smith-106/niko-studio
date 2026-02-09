# AI 寫作 Agent 系統 - Agentic Design Patterns 理論映射

**版本**: 3.0  
**日期**: 2026-01-26  
**理論來源**: Agentic Design Patterns Book  

---

## 1. GraphRAG 增強記憶系統

> **理論映射**: Chapter 14 - GraphRAG 解決傳統 RAG 在多文檔信息合成的缺陷

### 1.1 邊屬性設計 (Edge Properties)

```sql
-- 關係帶屬性 (Critical for Character Networks)
CREATE REL TABLE KNOWS(
    FROM Character TO Character,
    relationship STRING,      -- ally, enemy, rival, lover
    reason STRING,            -- "殺父之仇", "青梅竹馬"
    intensity INT,            -- 1-10 情感強度
    start_chapter INT,
    end_chapter INT,          -- NULL = 持續中
    is_public BOOL            -- 是否公開關係
);

CREATE REL TABLE HATES(
    FROM Character TO Character,
    reason STRING,            -- "殺父之仇"
    start_chapter INT,
    revenge_status STRING     -- pending, in_progress, completed, abandoned
);

CREATE REL TABLE PLANTS(
    FROM Scene TO Foreshadowing,
    hint_type STRING,         -- explicit, implicit, symbolic
    visibility STRING         -- obvious, subtle, hidden
);

CREATE REL TABLE HARVESTS(
    FROM Scene TO Foreshadowing,
    payoff_type STRING,       -- reveal, twist, confirmation
    chapters_span INT         -- 跨越章節數
);
```

### 1.2 語義記憶查詢

```python
# src/memory/graph_memory.py

class GraphMemory:
    """GraphRAG 增強記憶"""
    
    def get_character_network(self, character_id: str, depth: int = 2) -> dict:
        """獲取角色關係網絡"""
        query = f"""
        MATCH (c:Character {{id: '{character_id}'}})-[r]-(related:Character)
        WHERE r.end_chapter IS NULL  -- 當前有效關係
        RETURN c, r, related
        """
        return self.db.query(query)
    
    def get_pending_foreshadowing(self, max_chapters: int = 10) -> list:
        """獲取待回收伏筆"""
        query = f"""
        MATCH (s:Scene)-[p:PLANTS]->(f:Foreshadowing)
        WHERE f.status = 'planted' 
          AND NOT EXISTS((f)<-[:HARVESTS]-())
          AND s.chapter <= $current_chapter - {max_chapters}
        RETURN f.id, f.hint, p.visibility, s.chapter
        ORDER BY s.chapter ASC
        """
        return self.db.query(query)
```

---

## 2. 混合搜索與 Reranker

> **理論映射**: RAG 核心概念 - 語義搜索 + BM25 混合，Reranker 減少幻覺

### 2.1 Reranker 集成

```python
# src/indexing/reranker.py

from dataclasses import dataclass
from typing import Protocol

class Reranker(Protocol):
    def rerank(self, query: str, documents: list[str], top_k: int) -> list[tuple[int, float]]:
        """重排序文檔"""
        ...

@dataclass
class RerankerConfig:
    model: str = "BAAI/bge-reranker-v2-m3"
    custom_endpoint: str = None
    top_k: int = 10
    score_threshold: float = 0.5

class BGEReranker:
    """BGE Reranker 實現"""
    
    def __init__(self, config: RerankerConfig):
        if config.custom_endpoint:
            self.client = CustomRerankerClient(config.custom_endpoint)
        else:
            from FlagEmbedding import FlagReranker
            self.model = FlagReranker(config.model)
    
    def rerank(self, query: str, documents: list[str], top_k: int = 10) -> list[tuple[int, float]]:
        """重排序 - 減少 Context 噪音"""
        scores = self.model.compute_score([[query, doc] for doc in documents])
        ranked = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)
        return ranked[:top_k]
```

### 2.2 混合搜索 Pipeline

```python
# src/indexing/hybrid_search.py

class HybridSearchPipeline:
    """混合搜索 Pipeline"""
    
    def __init__(self, ai_indexer, fast_indexer, reranker, config):
        self.ai_indexer = ai_indexer
        self.fast_indexer = fast_indexer
        self.reranker = reranker
        self.alpha = config.alpha  # AI 權重
    
    def search(self, query: str, k: int = 20, use_reranker: bool = True) -> list[SearchResult]:
        # 1. 並行搜索
        semantic_results = self.ai_indexer.search(query, k=k*2)
        keyword_results = self.fast_indexer.search(query, k=k*2)
        
        # 2. RRF 融合
        fused = self._rrf_fuse(semantic_results, keyword_results)
        
        # 3. Reranker 精排 (Critical: 減少幻覺)
        if use_reranker:
            docs = [r.content for r in fused[:k*2]]
            reranked_indices = self.reranker.rerank(query, docs, top_k=k)
            return [fused[i] for i, _ in reranked_indices]
        
        return fused[:k]
    
    def _rrf_fuse(self, list1, list2, k=60) -> list:
        """Reciprocal Rank Fusion"""
        scores = {}
        for rank, item in enumerate(list1):
            scores[item.id] = scores.get(item.id, 0) + 1/(k + rank + 1) * self.alpha
        for rank, item in enumerate(list2):
            scores[item.id] = scores.get(item.id, 0) + 1/(k + rank + 1) * (1 - self.alpha)
        return sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
```

---

## 3. 並行執行與優先級

> **理論映射**: Chapter 3 Parallelization + Chapter 20 Prioritization

### 3.1 asyncio 並行執行

```python
# src/orchestration/parallel.py

import asyncio
from typing import Callable, TypeVar

T = TypeVar('T')

class ParallelExecutor:
    """並行執行器 (asyncio)"""
    
    async def execute_parallel(
        self, 
        tasks: list[tuple[str, Callable, dict]],
        max_concurrency: int = 5
    ) -> dict[str, T]:
        """並行執行多個任務"""
        semaphore = asyncio.Semaphore(max_concurrency)
        
        async def run_with_semaphore(task_id: str, fn: Callable, kwargs: dict):
            async with semaphore:
                if asyncio.iscoroutinefunction(fn):
                    result = await fn(**kwargs)
                else:
                    result = await asyncio.to_thread(fn, **kwargs)
                return task_id, result
        
        results = await asyncio.gather(
            *[run_with_semaphore(tid, fn, kw) for tid, fn, kw in tasks]
        )
        return dict(results)
    
    async def execute_by_dependency(
        self, 
        tasks: list[AgendaItem]
    ) -> dict[str, T]:
        """按依賴順序並行執行"""
        groups = self._group_by_dependency(tasks)
        all_results = {}
        
        for group in groups:
            # 組內並行
            group_results = await self.execute_parallel([
                (t.id, t.executor, t.params) for t in group
            ])
            all_results.update(group_results)
        
        return all_results
```

### 3.2 LangGraph 並行分支

```python
# src/workflow/parallel_graph.py

from langgraph.graph import StateGraph, END
from langgraph.checkpoint import MemorySaver

def create_parallel_writing_graph():
    """LangGraph 並行寫作流程"""
    
    graph = StateGraph(WritingState)
    
    # 並行分支: 多 Writer 同時寫作
    graph.add_node("parallel_writers", parallel_writers_node)
    
    async def parallel_writers_node(state: WritingState):
        scenes = state["pending_scenes"]
        
        # 過濾可並行的場景 (依賴已完成)
        parallel_ready = [s for s in scenes if can_parallelize(s, state)]
        
        # 並行執行
        executor = ParallelExecutor()
        results = await executor.execute_parallel([
            (s["id"], write_scene, {"scene": s, "state": state})
            for s in parallel_ready
        ])
        
        return {"drafted_scenes": {**state["drafted_scenes"], **results}}
    
    return graph.compile()
```

---

## 4. 軌跡評估與動態路由

> **理論映射**: Chapter 19 Trajectory Evaluation + Chapter 16 Resource-Aware Optimization

### 4.1 Thought-Action-Observation 日誌

```python
# src/observability/trajectory.py

@dataclass
class TrajectoryStep:
    """TAO 軌跡步驟"""
    timestamp: datetime
    agent: str
    
    # Thought-Action-Observation
    thought: str              # Agent 思考過程
    action: str               # 執行的動作
    action_input: dict        # 動作輸入
    observation: str          # 觀察結果
    
    # Metadata
    tokens_used: int
    duration_ms: int
    model: str

class TrajectoryLogger:
    """軌跡日誌記錄器"""
    
    def __init__(self, log_path: str = ".logs/trajectory.jsonl"):
        self.log_path = Path(log_path)
    
    def log_step(self, step: TrajectoryStep):
        """記錄單步軌跡"""
        with open(self.log_path, "a") as f:
            f.write(json.dumps(asdict(step)) + "\n")
    
    def get_session_trajectory(self, session_id: str) -> list[TrajectoryStep]:
        """獲取完整會話軌跡"""
        pass
    
    def analyze_failures(self) -> list[dict]:
        """分析失敗模式"""
        pass
```

### 4.2 動態模型路由

```python
# src/routing/model_router.py

@dataclass
class ModelTier:
    name: str
    cost_per_1m_input: float
    cost_per_1m_output: float
    capability_score: int      # 1-10
    speed_score: int           # 1-10

class DynamicModelRouter:
    """動態模型路由 - 資源感知優化"""
    
    TIERS = {
        "flash": ModelTier("gemini-2.0-flash", 0.075, 0.30, 6, 10),
        "standard": ModelTier("gpt-4o", 2.50, 10.00, 8, 7),
        "pro": ModelTier("claude-3-5-sonnet", 3.00, 15.00, 9, 6),
        "reasoning": ModelTier("o1", 15.00, 60.00, 10, 3)
    }
    
    def route(self, task: AgendaItem, budget_remaining: float = None) -> str:
        """根據任務複雜度和預算路由"""
        
        complexity = self._estimate_complexity(task)
        
        if complexity <= 3:
            return "flash"  # 簡單任務: 錯字修正、格式調整
        elif complexity <= 6:
            return "standard"  # 中等任務: 場景生成
        elif complexity <= 8:
            return "pro"  # 複雜任務: LOCK 評估、結構規劃
        else:
            return "reasoning"  # 極複雜: 故事架構設計
    
    def _estimate_complexity(self, task: AgendaItem) -> int:
        """估算任務複雜度 (1-10)"""
        # 基於任務類型、歷史表現
        complexity_map = {
            "quick_edit": 2,
            "scene_write": 5,
            "lock_evaluate": 7,
            "story_planning": 9
        }
        return complexity_map.get(task.type, 5)
```

---

## 5. Jules 開發重點摘要

| Phase | 重點 | 理論依據 |
|-------|------|----------|
| **P7** | 優先實現 Schema + Edge Properties | Ch.14 GraphRAG |
| **P8** | 必須實現 Reranker 精排 | RAG Best Practices |
| **P9** | 使用 asyncio/LangGraph 並行 | Ch.3 Parallelization |
| **P9** | TAO 軌跡日誌 | Ch.19 Trajectory Eval |
| **P9** | 動態模型路由 | Ch.16 Resource-Aware |
