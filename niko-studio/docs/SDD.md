# AI 寫作 Agent 系統 - 軟體設計文檔 (SDD)

**版本**: 1.0  
**日期**: 2026-01-26  
**狀態**: Draft  

---

## 1. 系統概述

### 1.1 目標
構建一個多 Agent 協作的 AI 寫作系統，支持：
- LOCK 結構驗證 (Lead, Objective, Confrontation, Knockout)
- 8 維度寫作質量評估
- 人機協作 (Human-in-the-Loop)
- 知識記憶管理 (OpenKL 風格)

### 1.2 參考系統
| 系統 | 借鑒功能 |
|------|----------|
| Cherry Studio | 對話界面、設置管理 |
| AionUi | 多代理協作、文件預覽 |
| Claude-Code-Workflow | 5級工作流、狀態管理 |
| OpenKL | 知識圖譜、記憶層 |

---

## 2. 架構設計

### 2.1 分層架構

```
┌─────────────────────────────────────────────────┐
│              UI Layer (Streamlit → Electron)    │
├─────────────────────────────────────────────────┤
│              Agent Orchestration Layer          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐│
│  │Commander│ │Architect│ │ Writer  │ │ Critic ││
│  └─────────┘ └─────────┘ └─────────┘ └────────┘│
├─────────────────────────────────────────────────┤
│              State Management Layer             │
│  .task/SCENE-*.json │ SQLite │ OpenKL Memory   │
├─────────────────────────────────────────────────┤
│              LLM Integration Layer              │
│  OpenRouter │ Gemini │ Claude │ DeepSeek       │
└─────────────────────────────────────────────────┘
```

### 2.2 模塊清單

| 模塊 | 路徑 | 職責 |
|------|------|------|
| Commander Agent | `src/agents/commander.py` | 任務分發、結果聚合 |
| Architect Agent | `src/agents/architect.py` | LOCK 規劃、場景卡片生成 |
| Writer Agent | `src/agents/writer.py` | 五感描寫、對話生成 |
| Critic Agent | `src/agents/critic.py` | LOCK+8維度評估 |
| State Manager | `src/workflow/state.py` | TypedDict 狀態定義 |
| LangGraph | `src/workflow/graph.py` | 狀態機流程 |
| Streamlit UI | `src/ui/streamlit_app.py` | 調試界面 |

---

## 3. 數據模型

### 3.1 場景卡片 (SCENE-*.json)
```json
{
  "id": "SCENE-001",
  "title": "場景標題",
  "status": "PENDING | WRITING | REVIEWING | DONE | FAILED",
  "chapter": 1,
  "scene_number": 1,
  "summary": "場景摘要",
  "dependencies": ["SCENE-000"],
  "lock_scores": {"L": 8, "O": 7, "C": 9, "K": 8},
  "quality_scores": {
    "五感描写平衡": 85,
    "视觉质量": 80,
    "对话质量": 75,
    "角色一致性": 90,
    "节奏控制": 78,
    "情感张力": 82,
    "叙事逻辑": 88,
    "语言风格": 80
  },
  "word_count": 2500,
  "revision_count": 2,
  "critique": "評審意見"
}
```

### 3.2 角色記憶 (OpenKL Memory)
```yaml
id: char-zhou-mingrei
ts: "2026-01-26T00:00:00Z"
tags: [protagonist, male, transmigrator]
topics: [characters, lord-of-mysteries]
---
性格: 謹慎、冷靜、善於偽裝
語言風格: 內斂、少用感嘆號
```

### 3.3 寫作狀態 (WritingState)
```python
class WritingState(TypedDict):
    user_idea: str
    workflow_level: str  # L1-L5
    current_chapter: int
    pending_scenes: list[str]
    drafted_scenes: dict[str, str]
    lock_scores: dict[str, int]
    quality_scores: dict[str, int]
    revision_count: int
    max_loops: int
    should_continue: bool
    human_feedback: Optional[str]
```

---

## 4. 工作流設計

### 4.1 5 級工作流 (CCW 模式)

| 級別 | 觸發條件 | Agent 組合 |
|------|----------|------------|
| L1 | 小幅修改 | Writer only |
| L2 | 單場景 | Architect → Writer |
| L3 | 章節 | Architect → Writer → Critic |
| L4 | 故事架構 | Brainstorm → Architect |
| L5 | 全流程 | Commander 編排所有 |

### 4.2 LangGraph 狀態機

```
START
  │
  ▼
┌─────────────┐
│  Commander  │──────────────────────────┐
│  (路由)     │                          │
└─────────────┘                          │
  │ L3+                                  │ L1-L2
  ▼                                      ▼
┌─────────────┐                    ┌───────────┐
│  Architect  │                    │  Writer   │
│  (規劃)     │                    │  (直寫)   │
└─────────────┘                    └───────────┘
  │                                      │
  ▼                                      │
┌─────────────┐                          │
│ Writer ×N  │ ←── 並行執行               │
│ (多場景)    │                          │
└─────────────┘                          │
  │                                      │
  ▼                                      ▼
┌─────────────┐                    ┌───────────┐
│   Critic    │                    │   HITL    │
│  (評估)     │                    │  (審批)   │
└─────────────┘                    └───────────┘
  │                                      │
  │ LOCK < 28                            │
  ▼                                      │
┌─────────────┐                          │
│ Revise Loop │ ── max_loops ────────────┤
└─────────────┘                          │
  │                                      │
  ▼                                      ▼
                    END
```

---

## 5. API 設計

### 5.1 Agent 接口

```python
class BaseAgent(ABC):
    @abstractmethod
    def invoke(self, state: WritingState) -> WritingState:
        """執行 Agent 邏輯"""
        pass
    
    @abstractmethod
    def get_prompt(self) -> str:
        """返回系統 Prompt"""
        pass
```

### 5.2 MCP 工具接口

| 工具名 | 功能 |
|--------|------|
| `lock_evaluate` | LOCK 評估 |
| `scene_create` | 創建場景卡片 |
| `memory_search` | 搜索角色記憶 |
| `graph_query` | Cypher 查詢 |

---

## 6. 測試策略

見 `docs/TDD.md`

---

## 7. 部署架構

### Phase 1: Streamlit (當前)
- 本地運行 `streamlit run`
- SQLite 本地存儲

### Phase 2: Electron
- 跨平台桌面應用
- React + TypeScript UI

### Phase 3: 雲服務 (可選)
- FastAPI 後端
- PostgreSQL + pgvector
