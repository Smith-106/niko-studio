# AI Agent Platform - Jules 自動開發規格

**用途**: Jules 自動編寫原型代碼  
**日期**: 2026-01-26  
**SDD版本**: V2.5

---

## 📋 開發優先級總覽

| 優先級 | Phase | 模塊 | 預估工作量 | 依賴 |
|-------|-------|------|-----------|------|
| **P0** | 1 | 跨域工作流完善 | 3h | 無 |
| **P0** | 2 | 記憶服務層 | 4h | Phase 1 |
| **P0** | 3 | 會話管理 | 3h | Phase 2 |
| **P1** | 4 | Skills 系統 | 2h | 無 |
| **P1** | 5 | 存儲封裝 | 2h | 無 |
| **P2** | 6 | 代碼工作流完善 | 4h | Phase 1 |

---

## Phase 1: 跨域工作流完善 (P0)

### 1.1 完善 Level 層級實現

**文件**: `src/workflow/levels/`

```
src/workflow/levels/
├── __init__.py
├── base_level.py           # 層級基類
├── level1_rapid.py         # L1 快速模式
├── level2_lite.py          # L2 輕量模式
├── level3_standard.py      # L3 標準模式
├── level4_brainstorm.py    # L4 頭腦風暴
└── level5_coordinator.py   # L5 智能編排
```

#### 1.1.1 base_level.py 規格

```python
# 目標: 創建 Level 層級基類

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from ..base_state import BaseState

class BaseLevel(ABC):
    """工作流層級基類"""
    
    level: int  # 1-5
    name: str   # rapid, lite, standard, brainstorm, coordinator
    
    @abstractmethod
    def execute(self, state: BaseState, **kwargs) -> BaseState:
        """執行該層級工作流"""
        pass
    
    @abstractmethod
    def get_required_agents(self) -> list[str]:
        """返回該層級需要的 Agent 列表"""
        pass
    
    def supports_resume(self) -> bool:
        """是否支持斷點續傳"""
        return self.level >= 3
    
    def requires_persistence(self) -> bool:
        """是否需要持久化"""
        return self.level >= 2
```

#### 1.1.2 level1_rapid.py 規格

```python
# 輸入: user_request (str), context (str, optional)
# 輸出: result (str)
# 無狀態、無持久化、直接調用 LLM

class Level1Rapid(BaseLevel):
    level = 1
    name = "rapid"
    
    def execute(self, state: BaseState, **kwargs) -> BaseState:
        # 1. 構建簡單 prompt
        # 2. 直接調用 LLM
        # 3. 返回結果
        pass
    
    def get_required_agents(self) -> list[str]:
        return ["writer"]  # 只需要 Writer
```

#### 1.1.3 level3_standard.py 規格

```python
# 輸入: user_request, context
# 輸出: final_output, revision_history
# 完整 Architect → Writer → Critic 循環

class Level3Standard(BaseLevel):
    level = 3
    name = "standard"
    
    PLAN_PHASES = [
        "requirement_analysis",  # 需求分析
        "context_analysis",      # 上下文分析
        "scope_definition",      # 範圍定義
        "implementation_plan",   # 實施計劃
        "verification_plan",     # 驗證計劃
    ]
    
    def execute(self, state: BaseState, **kwargs) -> BaseState:
        # 1. Architect: 生成計劃 (5 階段)
        # 2. Writer: 執行寫作
        # 3. Critic: 評估
        # 4. 循環直到通過或達到 max_revisions
        pass
    
    def plan(self, state: BaseState) -> dict:
        """生成計劃"""
        pass
    
    def verify(self, state: BaseState) -> dict:
        """驗證計劃"""
        pass
```

---

### 1.2 完善 NovelAdapter 節點

**文件**: `src/workflow/adapters/novel_adapter.py`

**當前狀態**: 基礎結構已創建，需要連接實際 Agent

**任務**:
1. `architect_node` → 調用 `src/agents/architect.py`
2. `writer_node` → 調用 `src/agents/writer.py`
3. `critic_node` → 調用 `src/agents/critic.py`

```python
# 在 NovelAdapter.create_graph() 中:
# 替換佔位節點為實際 Agent 調用

def architect_node(state: WritingState) -> WritingState:
    from ...agents.architect import ArchitectAgent
    agent = ArchitectAgent()
    result = agent.run(state)
    state.update(result)
    return state
```

---

### 1.3 完善 CodeAdapter 節點

**文件**: `src/workflow/adapters/code_adapter.py`

**當前狀態**: 佔位實現，需要實際邏輯

**任務**:
1. `_planner_node` → 實現代碼計劃生成
2. `_coder_node` → 實現代碼生成 (調用 LLM)
3. `_tester_node` → 實現測試運行 (subprocess)
4. `_reviewer_node` → 實現代碼審查

```python
# _tester_node 實現規格
def _tester_node(self, state: CodingState) -> CodingState:
    import subprocess
    
    # 1. 運行 pytest
    result = subprocess.run(
        ["pytest", "--json-report", "--json-report-file=test_report.json"],
        capture_output=True, text=True
    )
    
    # 2. 解析結果
    state["test_result"] = {
        "passed": ...,
        "failed": ...,
        "coverage": ...,
    }
    
    # 3. 運行 lint
    lint_result = subprocess.run(
        ["ruff", "check", ".", "--output-format=json"],
        capture_output=True, text=True
    )
    state["lint_result"] = json.loads(lint_result.stdout)
    
    return state
```

---

## Phase 2: 記憶服務層 (P0)

### 2.1 MemoryService 實現

**文件**: `src/services/memory_service.py`

**規格**:

```python
from dataclasses import dataclass
from typing import List, Optional
import numpy as np

@dataclass
class MemoryEntry:
    id: str
    content: str
    embedding: np.ndarray  # 384 維
    metadata: dict
    created_at: str

class MemoryService:
    """向量記憶服務"""
    
    def __init__(self, storage_path: str = ".writing/memories"):
        self.storage_path = Path(storage_path)
        self.embedder = self._init_embedder()  # FastEmbed
    
    def add(self, content: str, metadata: dict = None) -> str:
        """添加記憶，返回 ID"""
        # 1. 生成 embedding
        # 2. 創建 MemoryEntry
        # 3. 保存到文件 (YAML frontmatter + content)
        # 4. 更新圖數據庫 (Kùzu)
        pass
    
    def search(self, query: str, k: int = 5) -> List[MemoryEntry]:
        """向量搜索"""
        # 1. 生成 query embedding
        # 2. HNSW 搜索
        # 3. 返回結果
        pass
    
    def hybrid_search(self, query: str, k: int = 5) -> List[MemoryEntry]:
        """混合搜索 (向量 + 關鍵詞)"""
        # 1. 向量搜索
        # 2. 關鍵詞搜索 (BM25)
        # 3. RRF 融合
        pass
    
    def _init_embedder(self):
        from fastembed import TextEmbedding
        return TextEmbedding("BAAI/bge-small-zh-v1.5")
```

### 2.2 CoreMemoryStore 實現

**文件**: `src/memory/core_memory_store.py`

**規格** (SQLite):

```python
import sqlite3
from dataclasses import dataclass

@dataclass
class CoreMemory:
    id: str
    content: str
    summary: str
    archived: bool = False
    created_at: str = None
    updated_at: str = None

class CoreMemoryStore:
    """SQLite 持久化記憶存儲"""
    
    SCHEMA = '''
    CREATE TABLE IF NOT EXISTS core_memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        summary TEXT,
        archived INTEGER DEFAULT 0,
        created_at TEXT,
        updated_at TEXT
    );
    
    CREATE TABLE IF NOT EXISTS session_clusters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        intent TEXT,
        status TEXT DEFAULT 'active'
    );
    
    CREATE TABLE IF NOT EXISTS cluster_members (
        cluster_id TEXT,
        session_id TEXT,
        relevance_score REAL,
        PRIMARY KEY (cluster_id, session_id)
    );
    '''
    
    def __init__(self, db_path: str = ".writing/core_memory.db"):
        self.conn = sqlite3.connect(db_path)
        self._init_schema()
    
    def upsert_memory(self, memory: CoreMemory) -> CoreMemory:
        """創建或更新記憶"""
        pass
    
    def get_memory(self, id: str) -> Optional[CoreMemory]:
        """獲取單條記憶"""
        pass
    
    def get_memories(self, archived: bool = False, limit: int = 100) -> List[CoreMemory]:
        """分頁查詢"""
        pass
    
    def archive_memory(self, id: str) -> bool:
        """歸檔"""
        pass
```

---

## Phase 3: 會話管理 (P0)

### 3.1 SessionManager 實現

**文件**: `src/workflow/session/session_manager.py`

**規格**:

```python
from pathlib import Path
from enum import Enum
from dataclasses import dataclass

class ContentType(Enum):
    CHAPTER = "chapter"
    OUTLINE = "outline"
    CHARACTER = "character"
    PLAN = "plan"

PATH_ROUTES = {
    ContentType.CHAPTER: "{base}/chapters/chapter-{id}.md",
    ContentType.OUTLINE: "{base}/OUTLINE.md",
    ContentType.CHARACTER: "{base}/.data/characters/{id}.json",
    ContentType.PLAN: "{base}/IMPL_PLAN.md",
}

@dataclass
class SessionInfo:
    id: str
    type: str  # rapid | lite | standard | brainstorm | coordinator
    status: str  # active | archived
    created_at: str
    updated_at: str

class SessionManager:
    """會話生命週期管理"""
    
    def __init__(self, base_path: str = ".writing/sessions"):
        self.base_path = Path(base_path)
        self.active_path = self.base_path / "active"
        self.archived_path = self.base_path / "archived"
    
    def init(self, session_id: str, session_type: str = "standard") -> SessionInfo:
        """初始化會話目錄"""
        session_path = self.active_path / session_id
        session_path.mkdir(parents=True, exist_ok=True)
        (session_path / "chapters").mkdir(exist_ok=True)
        (session_path / ".data").mkdir(exist_ok=True)
        # 創建 session.json
        pass
    
    def read(self, session_id: str, content_type: ContentType, **kwargs) -> str:
        """讀取會話內容"""
        path = self._resolve_path(session_id, content_type, **kwargs)
        return path.read_text(encoding="utf-8")
    
    def write(self, session_id: str, content_type: ContentType, content: str, **kwargs):
        """寫入會話內容"""
        path = self._resolve_path(session_id, content_type, **kwargs)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
    
    def archive(self, session_id: str) -> bool:
        """歸檔會話"""
        src = self.active_path / session_id
        dst = self.archived_path / session_id
        shutil.move(src, dst)
        pass
    
    def list(self, location: str = "active") -> List[SessionInfo]:
        """列出會話"""
        pass
```

### 3.2 ResumeStrategy 實現

**文件**: `src/workflow/session/resume_strategy.py`

**規格**:

```python
from enum import Enum

class ResumeStrategy(Enum):
    NATIVE = "native"           # 原生會話恢復
    PROMPT_CONCAT = "prompt-concat"  # Prompt 拼接
    HYBRID = "hybrid"           # 混合

class ResumeStrategyResolver:
    """斷點續傳策略解析器"""
    
    def determine_strategy(
        self,
        tool: str,  # gemini | claude | qwen
        resume_ids: list[str],
        custom_id: str = None
    ) -> dict:
        """
        決定最佳續傳策略
        
        場景:
        - 單追加: resume_ids=[id] → native
        - Fork: custom_id 提供 → prompt-concat
        - 多合併: resume_ids=[id1, id2] → hybrid
        - 跨工具: 工具不同 → prompt-concat
        """
        pass
    
    def build_context_prefix(
        self,
        turns: list[dict],
        format: str = "yaml"  # plain | yaml | json
    ) -> str:
        """構建上下文前綴"""
        pass
```

---

## Phase 4: Skills 系統 (P1)

### 4.1 SkillLoader 完善

**文件**: `src/skills/skill_loader.py`

**當前狀態**: 基礎實現存在於 SDD，需要創建實際文件

**任務**:
1. 創建 `src/skills/` 目錄
2. 實現 SkillLoader
3. 創建示例技能包

### 4.2 創建小說技能包

**目錄**: `skills/novel-chapter/`

```
skills/novel-chapter/
├── SKILL.md              # 技能描述
└── templates/
    ├── outline_prompt.md     # 大綱 Prompt
    ├── chapter_prompt.md     # 章節 Prompt
    └── revision_prompt.md    # 修訂 Prompt
```

**SKILL.md 內容**:

```yaml
---
name: novel-chapter
description: 章節創作技能
version: "1.0"
tags: [writing, novel, chapter]
---

# 章節創作技能

## Workflow Decision Tree

### 新章節創作
- **有大綱** → Use "有大綱章節創作"
- **無大綱** → Use "探索性寫作"

### 章節修訂
- **內容調整** → Use "章節重寫"
- **風格潤色** → Use "文筆優化"

## 有大綱章節創作

1. 讀取大綱 `{session}/OUTLINE.md`
2. 讀取前一章節
3. 調用 Writer Agent
4. 調用 Critic Agent 評審
5. 如果 REVISE，回到步驟 3
```

---

## Phase 5: 存儲封裝 (P1)

### 5.1 FileBuilder 實現

**文件**: `src/storage/file_builder.py`

**當前狀態**: 已在 SDD 中定義，需要創建實際文件

**任務**:
1. 創建 `src/storage/` 目錄
2. 實現 FileBuilder 和 JsonFileBuilder
3. 實現 WritingStorage

---

## Phase 6: 代碼工作流完善 (P2)

### 6.1 代碼 Agent 實現

**新文件**: `src/agents/coder.py`

```python
class CoderAgent(BaseAgent):
    """代碼生成 Agent"""
    
    def run(self, state: CodingState) -> dict:
        # 1. 分析任務
        # 2. 生成代碼
        # 3. 返回文件變更
        pass
```

**新文件**: `src/agents/code_reviewer.py`

```python
class CodeReviewerAgent(BaseAgent):
    """代碼審查 Agent"""
    
    def run(self, state: CodingState) -> dict:
        # 1. 分析代碼變更
        # 2. 檢查最佳實踐
        # 3. 生成審查評論
        pass
```

---

## 📁 目錄結構最終規劃

```
src/
├── agents/
│   ├── base.py              ✅ 已有
│   ├── architect.py         ✅ 已有
│   ├── writer.py            ✅ 已有
│   ├── critic.py            ✅ 已有
│   ├── commander.py         ✅ 已有
│   ├── coder.py             ⬜ P2 待創建
│   └── code_reviewer.py     ⬜ P2 待創建
├── workflow/
│   ├── base_state.py        ✅ 已有
│   ├── base_adapter.py      ✅ 已有
│   ├── graph_factory.py     ✅ 已有
│   ├── graph.py             ✅ 已有
│   ├── state.py             ✅ 已有
│   ├── adapters/
│   │   ├── novel_adapter.py ✅ 已有 (需完善)
│   │   └── code_adapter.py  ✅ 已有 (需完善)
│   ├── levels/              ⬜ P0 待創建
│   │   ├── base_level.py
│   │   ├── level1_rapid.py
│   │   ├── level2_lite.py
│   │   ├── level3_standard.py
│   │   ├── level4_brainstorm.py
│   │   └── level5_coordinator.py
│   └── session/             ⬜ P0 待創建
│       ├── session_manager.py
│       └── resume_strategy.py
├── memory/
│   ├── core_memory_store.py ⬜ P0 待創建
│   ├── citation_manager.py  ⬜ P1 待創建
│   └── distillation_manager.py ⬜ P1 待創建
├── services/
│   ├── memory_service.py    ⬜ P0 待創建
│   └── knowledge_service.py ⬜ P1 待創建
├── storage/                 ⬜ P1 待創建
│   ├── file_builder.py
│   └── writing_storage.py
├── skills/                  ⬜ P1 待創建
│   └── skill_loader.py
└── search/                  ⬜ P1 待創建
    ├── smart_search.py
    └── vector_search.py

skills/                      ⬜ P1 待創建
├── novel-chapter/
│   ├── SKILL.md
│   └── templates/
├── character-design/
│   └── SKILL.md
└── worldview-builder/
    └── SKILL.md
```

---

## ⚡ Jules 執行指令

### 批次 1: P0 核心 (按順序執行)

```bash
# 1. 創建 Level 層級
jules create src/workflow/levels/base_level.py --spec TASKS_JULES.md#1.1.1
jules create src/workflow/levels/level1_rapid.py --spec TASKS_JULES.md#1.1.2
jules create src/workflow/levels/level3_standard.py --spec TASKS_JULES.md#1.1.3

# 2. 完善適配器節點
jules modify src/workflow/adapters/novel_adapter.py --spec TASKS_JULES.md#1.2
jules modify src/workflow/adapters/code_adapter.py --spec TASKS_JULES.md#1.3

# 3. 創建記憶服務
jules create src/services/memory_service.py --spec TASKS_JULES.md#2.1
jules create src/memory/core_memory_store.py --spec TASKS_JULES.md#2.2

# 4. 創建會話管理
jules create src/workflow/session/session_manager.py --spec TASKS_JULES.md#3.1
jules create src/workflow/session/resume_strategy.py --spec TASKS_JULES.md#3.2
```

### 批次 2: P1 擴展

```bash
# Skills 系統
jules create src/skills/skill_loader.py --spec TASKS_JULES.md#4.1
jules create skills/novel-chapter/SKILL.md --spec TASKS_JULES.md#4.2

# 存儲封裝
jules create src/storage/file_builder.py --spec TASKS_JULES.md#5.1
```

---

*文檔版本: 1.0 | 日期: 2026-01-26*
