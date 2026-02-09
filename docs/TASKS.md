# AI Agent Platform - 實施任務清單 - V2.9 (Full Stack)

**用途**: Jules 自動開發任務分配  
**日期**: 2026-01-26  
**定位**: 類 Cherry Studio / Claude-Code-Workflow 的 AI Agent 平台，兼容小説創作  
**狀態**: Design Enhanced with CCW + Cherry + OpenKL + AionUi Full Stack  
**SDD版本**: V2.4

> ⚠️ **優先級調整**: 根據 CCW 差距分析，SessionManager 和 ResumeStrategy 提升為 P0

---


## Phase 1: 核心 Agent 實現 (Priority: P0)

### M1 核心契約 (Frozen)
- 依賴順序: Memory -> Search -> Citation -> Distillation -> Memory(writeback)
- 模組邊界: Memory/ Search/ Citation/ Distillation 僅透過核心資料結構交互
- 字段清單: 見 docs/SDD_V2.md 1.5.1 (MemoryRecord / SearchResult / Citation / DistillationResult)

### 1.1 基礎設施 & 協議
- [x] `src/agents/base.py` - BaseAgent 抽象類
  - [x] 實現 `construct_prompt()` (CCW Protocol)
  - [ ] 實現 Token 成本估算
- [x] `src/workflow/state.py`
- [ ] `src/config.py`

### 1.2 Commander Agent (L1-L5 Workflow)
- [x] `src/agents/commander.py`
  - [x] 實現 L1-L5 分層路由 (CCW Feature)

### 1.3 Architect Agent
- [x] `src/agents/architect.py`
  - [ ] 集成 `SequentialThinking` (Cherry CoT)
  - [ ] **[New]** 集成 `DistillService` (OpenKL Memory Distillation)

### 1.4 Writer Agent
- [x] `src/agents/writer.py`
  - [ ] 接入 `AgentKnowledgeLayer` (OpenKL Unified Store)

### 1.5 Critic Agent
- [x] `src/agents/critic.py`
  - [x] 實現 Multi-Dimension Evaluation

---

## Phase 2: 分層工作流系統 (Priority: P0) **[CCW]**

> **移植自**: `Claude-Code-Workflow/WORKFLOW_GUIDE.md`

### 2.1 工作流層級定義
- [x] `src/workflow/graph.py` - 基礎圖
  - [x] 實現 L1/L3/L5 路由圖
  - [ ] **[New]** 添加 `Distillation` 節點

### 2.2 Level 1: Rapid (快速寫作) **[CCW]**
- [x] `src/workflow/levels/level1_rapid.py`
  - [x] 無工件、無狀態
  - [x] 快速修改/潤色
  - [x] 直接調用 Writer Agent

### 2.3 Level 2: Lightweight (輕量寫作) **[CCW]**
- [ ] `src/workflow/levels/level2_lite.py`
  - [ ] `lite-plan` - 內存計劃
  - [ ] `lite-fix` - Bug 診斷 (5 階段)
  - [ ] `lite-execute` - 統一執行

### 2.4 Level 3: Standard (標準創作) **[CCW]**
- [x] `src/workflow/levels/level3_standard.py`
  - [x] `plan` - 完整計劃 (5 階段)
  - [x] `plan-verify` - 計劃驗證
  - [x] `execute` - 執行
  - [x] 會話持久化

### 2.5 Level 4: Brainstorm (頭腦風暴) **[CCW]**
- [ ] `src/workflow/levels/level4_brainstorm.py`
  - [ ] `brainstorm:auto-parallel` - 多角色並行分析
  - [ ] 角色選擇 (Architect/Designer/Product/Domain Expert)
  - [ ] `guidance-specification.md` 生成
  - [ ] `synthesis-specification.md` 整合

### 2.6 Level 5: Coordinator (智能編排) **[CCW]**
- [ ] `src/workflow/levels/level5_coordinator.py`
  - [ ] 需求分析 (goal/scope/constraints/complexity)
  - [ ] 命令鏈推薦 + 用戶確認
  - [ ] 最小執行單元 (Minimum Execution Units)
  - [ ] 狀態持久化 (`state.json`)

---

## Phase 3: 記憶服務層 (Priority: P0) **[Cherry + CCW + OpenKL]**

### 3.1 向量記憶服務 **[Cherry]**
- [ ] `src/services/memory_service.py`
  - [ ] `add(messages, options)` - 添加記憶 (向量化)
  - [ ] `search(query, options)` - 向量搜索
  - [ ] `hybrid_search()` - 混合搜索 (向量 + 文本)
  - [ ] `add_history()` - 變更歷史追踪 (ADD/UPDATE/DELETE)
  - [ ] 多用戶隔離 (`user_id` / `agent_id`)

### 3.2 CoreMemoryStore (持久化記憶) **[CCW]**
- [ ] `src/memory/core_memory_store.py`
  - [ ] `CoreMemory` 數據結構 (id, content, summary, archived)
  - [ ] `upsert_memory()` / `get_memory()` / `get_memories()`
  - [ ] `archive_memory()` / `delete_memory()`
  - [ ] `generate_summary(memory_id, tool)` - LLM 摘要
  - [ ] SQLite 持久化

### 3.3 MemoryManager (時序記憶) **[NEW - OpenKL]**
- [ ] `src/memory/memory_manager.py`
  - [ ] 時序組織: `by_date/YYYY-MM/DD/<id>.md`
  - [ ] 主題軟鏈接: `topics/<slug>/`
  - [ ] YAML Frontmatter 元數據
  - [ ] FastEmbed 384維向量嵌入
  - [ ] `add()` / `search()` / `update()` / `delete()` / `list_recent()`

### 3.4 會話聚類 (Session Clustering) **[CCW]**
- [ ] `src/memory/session_cluster.py`
  - [ ] `SessionCluster` 數據結構 (id, name, intent, status)
  - [ ] `ClusterMember` 關聯 (cluster_id, session_id, relevance_score)
  - [ ] `create_cluster()` / `add_cluster_member()`
  - [ ] `ClusterRelation` (depends_on, extends, conflicts_with)

### 3.5 記憶分塊 (Memory Chunking) **[CCW]**
- [ ] `src/memory/memory_chunk.py`
  - [ ] `MemoryChunk` 數據結構 (source_id, chunk_index, embedding)
  - [ ] 支持 Embedding Buffer 存儲
  - [ ] 跨源類型 (core_memory, workflow, cli_history)

### 3.6 Sequential Thinking MCP **[Cherry]**
- [ ] `src/mcp_servers/sequential_thinking.py`
  - [ ] `ThoughtData` 數據結構 (thought, branchId, revisesThought)
  - [ ] `process_thought()` - 動態推理
  - [ ] 支持分支 (`branch_from_thought`) + 修訂 (`revises_thought`)
  - [ ] `thought_history[]` 保存完整推理鏈

### 3.7 Memory MCP (知識圖譜) **[Cherry]**
- [ ] `src/mcp_servers/memory_mcp.py`
  - [ ] `Entity` / `Relation` 數據結構
  - [ ] `create_entities()` / `create_relations()`
  - [ ] `add_observations()` - 增量觀察
  - [ ] `search_nodes()` / `open_nodes()` - 圖譜查詢
  - [ ] JSON 文件持久化

---

## Phase 4: 引用與蒸餾系統 (Priority: P0) **[NEW - OpenKL]**

### 4.1 CitationManager (引用管理) **[NEW - OpenKL]**
- [ ] `src/memory/citation_manager.py`
  - [ ] `TransientCitation` - 臨時引用 (搜索返回)
  - [ ] `PersistedCitation` - 持久引用 (SHA256 驗證)
  - [ ] `retention_class`: durable / ephemeral / standard
  - [ ] `loc`: {kind: "char", start, end} 位置定位
  - [ ] `create_transient_citation()` - 從搜索結果創建
  - [ ] `make_citation()` - 轉換為持久化
  - [ ] `verify_citation()` - SHA256 完整性驗證
  - [ ] `open_citation()` - 打開並高亮
  - [ ] `gc_citations()` - 過期引用回收

### 4.2 DistillationManager (知識蒸餾) **[NEW - OpenKL]**
- [ ] `src/memory/distillation_manager.py`
  - [ ] 6 種蒸餾 Prompt 模板:
    - [ ] `extract-facts` - 事實提取
    - [ ] `identify-patterns` - 模式識別
    - [ ] `summarize-insights` - 高層摘要
    - [ ] `extract-relationships` - 關係提取
    - [ ] `extract-entities` - 實體提取
    - [ ] `memory-synthesis` - 記憶綜合
  - [ ] `get_distillation_prompt(prompt_type)` - 獲取模板
  - [ ] `create_memory_from_distillation()` - 從蒸餾創建記憶
  - [ ] `_create_distillation_relationships()` - 自動建立 DerivedFrom 關係

---

## Phase 5: 會話與搜索服務 (Priority: P0 ⬆️) **[CCW + OpenKL]**

> ⚠️ **優先級提升**: 根據 CCW 差距分析，此 Phase 從 P1 提升為 P0

### 5.1 Session Manager (寫作會話管理) **[CCW]** 🔴 最高優先
- [x] `src/workflow/session/session_manager.py`
  - [x] 生命週期: `init` / `list` / `read` / `write` / `archive` / `delete`
  - [x] 內容類型路由 (content_type → 文件路徑)
  - [x] 多位置支持 (active / archived / lite-plan)
  - [x] 任務統計 (`stats` operation)
  - [x] ContentType Enum: CHAPTER, OUTLINE, CHARACTER, WORLDVIEW, PLAN

### 5.1.1 Session Cluster (會話聚類) **[CCW]**
- [ ] `src/memory/session_cluster.py`
  - [ ] `SessionCluster` 數據結構 (id, name, intent, status)
  - [ ] `ClusterMember` 關聯 (cluster_id, session_id, relevance_score)
  - [ ] `ClusterRelation` (depends_on, extends, conflicts_with)
  - [ ] `create_cluster()` / `add_member()` / `merge_clusters()`


### 5.2 Resume Strategy (斷點續傳) **[CCW]**
- [ ] `src/workflow/session/resume_strategy.py`
  - [ ] 策略類型: `native` / `prompt-concat` / `hybrid`
  - [ ] 場景檢測: 單追加 / Fork / 多合併 / 跨工具
  - [ ] `build_context_prefix()` - 上下文構建 (Plain/YAML/JSON)
  - [ ] `determine_resume_strategy()` - 策略決定

### 5.3 SmartSearch (智能搜索) **[CCW]**
- [ ] `src/search/smart_search.py`
  - [ ] 雙模式: Fuzzy (FTS + ripgrep) / Semantic (Embedding)
  - [ ] RRF 融合排序 (Reciprocal Rank Fusion)
  - [ ] 自動模式分類 (根據查詢)
  - [ ] 分頁支持 (`offset` + `limit`)
  - [ ] 文件觀察 (`watch` action)

### 5.4 VectorSearch (向量搜索) **[NEW - OpenKL]**
- [ ] `src/search/vector_search.py`
  - [ ] HNSW 索引 (Kùzu 原生)
  - [ ] 384 維嵌入 (FastEmbed)
  - [ ] `search_memory_vectors()` - 記憶向量搜索
  - [ ] `search_chunk_vectors()` - 文檔塊向量搜索
  - [ ] `hybrid_search()` - Memory + Chunk 混合搜索
  - [ ] `create_vector_indexes()` - 自動創建索引

---

## Phase 6: 統一知識層 (Priority: P1) **[OpenKL Architecture]**

> **Merge**: Cherry Graph + CCW Indexing + OpenKL File System Contract

### 6.1 文件系統契約 (File System Contract) **[NEW - OpenKL]**
- [ ] 存儲結構遷移到 OpenKL 風格:
  ```
  .writing/
  ├─ store/
  │  ├─ sources/          # 原始文件
  │  └─ normalized/       # 歸一化文本 (*.ok.md)
  ├─ memories/
  │  ├─ by_date/          # 時序組織
  │  └─ topics/           # 主題軟鏈接
  ├─ citations/           # 引用 JSON
  └─ .ok/
     ├─ kuzu/             # 嵌入式圖數據庫
     └─ mapping.jsonl     # docID → path
  ```

### 6.2 核心服務
- [x] `src/services/knowledge_layer.py`
  - [x] `add_document()` (File -> Graph + Vector)
  - [x] `query_hybrid()` (Graph Cypher + Vector Similarity)
  - [ ] `sync_file()` (File Watcher auto-sync)

### 6.3 StoreManager (文檔倉庫) **[NEW - OpenKL]**
- [ ] `src/store/store_manager.py`
  - [ ] 多格式支持: PDF, HTML, Markdown, SRT
  - [ ] 自動分塊: 512 tokens, stride 128
  - [ ] 歸一化存儲: `sources/` → `normalized/*.ok.md`
  - [ ] `ingest(path)` - 導入文檔
  - [ ] `search(query)` - 向量搜索文檔塊
  - [ ] `list_documents()` - 列出所有文檔

### 6.4 GraphManager (知識圖譜) **[NEW - OpenKL]**
- [ ] `src/graph/graph_manager.py`
  - [ ] Kùzu Schema (MemoryNote, Doc, Chunk, Entity, Topic)
  - [ ] 關係類型: HAS_CHUNK, Mentions, DerivedFrom, HasTopic
  - [ ] `run_cypher(query)` - 執行 Cypher 查詢
  - [ ] `get_entity_stats()` - 圖統計
  - [ ] `find_related_entities()` - 關聯實體查找

### 6.5 知識蒸餾 (已整合到 Phase 4)
- [x] `src/services/distill_service.py`
  - [x] `distill_chapter()` (Extract Entities/Relations)
  - [x] LLM Prompt: `extract-facts`, `identify-patterns`

### 6.6 可驗證引用 (已整合到 Phase 4)
- [/] `src/memory/citation.py` → 遷移到 `citation_manager.py`

### 6.7 Reranker 策略 (多策略重排) **[Cherry]**
- [ ] `src/services/reranker/`
  - [ ] `base_reranker.py` - 基類
  - [ ] `strategies/jina_strategy.py` - Jina AI
  - [ ] `strategies/voyage_strategy.py` - Voyage AI
  - [ ] `strategies/tei_strategy.py` - Hugging Face TEI
  - [ ] `strategies/bailian_strategy.py` - 阿里百煉 (中文優化)
  - [ ] `strategy_factory.py` - 策略工廠

---

## Phase 7: 基礎服務 (Priority: P1) **[Cherry]**

### 7.1 備份服務 (BackupManager)
- [ ] `src/services/backup/backup_manager.py`
  - [ ] `backup(file_name, data, destination_path)`
  - [ ] `restore(backup_path)`
  - [ ] `backup_to_webdav(data, webdav_config)` - 坚果云/Nextcloud
  - [ ] `backup_to_s3(data, s3_config)` - S3 对象存储
  - [ ] `restore_from_webdav(webdav_config)`
  - [ ] 進度追蹤 + 斷點續傳

### 7.2 Token 估算服務
- [ ] `src/services/token_service.py`
  - [ ] 本地 Token 估算
  - [ ] 預算控制
  - [ ] 成本分析

### 7.3 Obsidian 集成服務
- [ ] `src/services/obsidian_service.py`
  - [ ] `get_vaults()` - 獲取所有 Vault
  - [ ] `get_vault_structure(vault_path)` - 遍歷目錄結構
  - [ ] `get_files_by_vault_name(vault_name)` - 按名稱獲取文件
  - [ ] 跨平台兼容 (Win/Mac/Linux/Snap/Flatpak)

### 7.4 知識庫服務 (KnowledgeService)
- [ ] `src/services/knowledge_service.py`
  - [ ] `file_task()` - 文件加載任務
  - [ ] `directory_task()` - 目錄批量加載
  - [ ] `url_task()` - URL 爬取
  - [ ] `sitemap_task()` - Sitemap 批量
  - [ ] `note_task()` - 筆記加載
  - [ ] 任務隊列 + 工作負載評估

---

## Phase 8: CLI 編排層 (Priority: P2) **[CCW]**

### 8.1 CLI Executor (多 CLI 統一調度)
- [ ] `src/cli/cli_executor.py`
  - [ ] 統一接口: Gemini/Qwen/Codex/Claude/OpenCode
  - [ ] 模式支持: analysis / write / auto / review
  - [ ] 流式輸出 (`on_output` 回調)
  - [ ] 環境注入 (自定義 `.env` 加載)

### 8.2 CLI History Store
- [ ] `src/cli/cli_history_store.py`
  - [ ] `ConversationTurn` 數據結構
  - [ ] `ConversationRecord` 記錄
  - [ ] `NativeSessionMapping` 映射

---

## Phase 9: 用戶體驗增強 (Priority: P2) **[Cherry]**

### 9.1 划詞助手 (SelectionService) **[Optional]**
- [ ] `src/services/selection_service.py`
  - [ ] 多觸發模式 (選中/Ctrl鍵/快捷鍵)
  - [ ] 浮動工具欄
  - [ ] 應用過濾 (黑白名單)

---

## Phase 10: 集成驗證 (Priority: P1)

### 10.1 協議與工作流測試
- [ ] `tests/integration/test_ccw_protocol.py`
- [ ] `tests/integration/test_layered_workflow.py`

### 10.2 知識層測試
- [ ] `tests/integration/test_knowledge_layer.py`
  - [ ] Test Hybrid Search
  - [ ] Test Distillation Cycle

### 10.3 Cherry 移植模塊測試
- [ ] `tests/integration/test_memory_service.py`
  - [ ] Test Vector Search
  - [ ] Test History Tracking
- [ ] `tests/integration/test_sequential_thinking.py`
  - [ ] Test Branching
  - [ ] Test Revision
- [ ] `tests/integration/test_reranker.py`
  - [ ] Test Strategy Switching

### 10.4 CCW 移植模塊測試
- [ ] `tests/integration/test_core_memory_store.py`
  - [ ] Test Upsert/Archive
  - [ ] Test Clustering
- [ ] `tests/integration/test_session_manager.py`
  - [ ] Test Lifecycle
  - [ ] Test Content Routing
- [ ] `tests/integration/test_resume_strategy.py`
  - [ ] Test Native/Prompt-Concat/Hybrid
- [ ] `tests/integration/test_smart_search.py`
  - [ ] Test Fuzzy/Semantic/RRF

### 10.5 OpenKL 移植模塊測試 **[NEW]**
- [ ] `tests/integration/test_citation_manager.py`
  - [ ] Test Transient/Persisted Citations
  - [ ] Test SHA256 Verification
  - [ ] Test GC Cleanup
- [ ] `tests/integration/test_distillation_manager.py`
  - [ ] Test 6 Prompt Templates
  - [ ] Test DerivedFrom Relationships
- [ ] `tests/integration/test_memory_manager.py`
  - [ ] Test Temporal Organization
  - [ ] Test Topic Symlinks
- [ ] `tests/integration/test_store_manager.py`
  - [ ] Test Multi-format Ingestion
  - [ ] Test Chunking
- [ ] `tests/integration/test_vector_search.py`
  - [ ] Test HNSW Index
  - [ ] Test Hybrid Search

---

## Phase 11: AionUi Skills 系統 (Priority: P1) **[NEW - AionUi]**

### 11.1 Skills 基礎結構
- [ ] `skills/` 目錄結構設計
  - [ ] Frontmatter + Markdown 格式規範
  - [ ] 工作流決策樹模板
  - [ ] `scripts/` 工具目錄規範

### 11.2 SkillLoader 實現
- [ ] `src/skills/skill_loader.py`
  - [ ] `SkillMetadata` 數據類 (name, description, version, tags)
  - [ ] `Skill` 數據類 (metadata, content, path)
  - [ ] `load(skill_name)` - 加載技能
  - [ ] `list_skills()` - 列出所有技能
  - [ ] `_parse_frontmatter()` - 解析 YAML Frontmatter

### 11.3 小說創作技能包
- [ ] `skills/novel-chapter/SKILL.md` - 章節創作
  - [ ] 有大綱/無大綱決策樹
  - [ ] 章節修訂工作流
- [ ] `skills/character-design/SKILL.md` - 角色設計
  - [ ] 角色原型庫
  - [ ] 性格/語言風格模板
- [ ] `skills/worldview-builder/SKILL.md` - 世界觀構建
- [ ] `skills/plot-structuring/SKILL.md` - 劇情結構
- [ ] `skills/dialogue-polish/SKILL.md` - 對話潤色

---

## Phase 12: 存儲層統一 (Priority: P2) **[NEW - AionUi]**

### 12.1 FileBuilder 基類
- [ ] `src/storage/file_builder.py`
  - [ ] `FileBuilder` 基類
    - [ ] `write(data)` / `read()` / `copy(dest)` / `rm()` / `exists()`
  - [ ] `JsonFileBuilder` 派生類
    - [ ] `to_json()` / `set_json(data)`
    - [ ] `get(key)` / `set(key, value)` / `remove(key)`
    - [ ] `update(key, update_fn)` - 原子更新
    - [ ] `backup(suffix)` - 備份

### 12.2 WritingStorage 整合
- [ ] `src/storage/writing_storage.py`
  - [ ] OpenKL 風格目錄 (store, memories, sessions, citations)
  - [ ] AionUi 風格配置 (config.json, mapping.json)
  - [ ] `ensure_directories()` - 確保目錄存在

---

## Phase 13: 集成驗證增強 (Priority: P1)

### 13.1 AionUi 移植模塊測試 **[NEW]**
- [ ] `tests/integration/test_skill_loader.py`
  - [ ] Test Load Skill
  - [ ] Test List Skills
  - [ ] Test Frontmatter Parsing
- [ ] `tests/integration/test_file_builder.py`
  - [ ] Test FileBuilder CRUD
  - [ ] Test JsonFileBuilder Operations
  - [ ] Test Backup

---

## Phase 14: Cross-Domain Workflow Architecture (Completed)

### 14.1 Platform Core
- [x] `src/workflow/base_state.py`
- [x] `src/workflow/base_workflow.py`
- [x] `src/workflow/graph_factory.py`
- [x] `src/workflow/state.py` (Inherits BaseState)

### 14.2 Domain Adapters
- [x] `src/workflow/adapters/base_adapter.py`
- [x] `src/workflow/adapters/novel_adapter.py`
- [x] `src/workflow/adapters/code_adapter.py`
- [x] `src/workflow/adapters/__init__.py` (Registry)

### 14.3 Refactoring
- [x] Update `src/workflow/graph.py` to use Adapter Pattern

---

## 附錄 A: Cherry Studio 移植參考

| Cherry Studio 源文件 | 目標文件 | 狀態 |
|----------------------|----------|------|
| `services/memory/MemoryService.ts` | `src/services/memory_service.py` | ⬜ |
| `mcpServers/sequentialthinking.ts` | `src/mcp_servers/sequential_thinking.py` | ⬜ |
| `mcpServers/memory.ts` | `src/mcp_servers/memory_mcp.py` | ⬜ |
| `services/BackupManager.ts` | `src/services/backup/backup_manager.py` | ⬜ |
| `services/ObsidianVaultService.ts` | `src/services/obsidian_service.py` | ⬜ |
| `services/KnowledgeService.ts` | `src/services/knowledge_service.py` | ⬜ |
| `knowledge/reranker/strategies/*` | `src/services/reranker/strategies/` | ⬜ |

---

## 附錄 B: Claude-Code-Workflow 移植參考

| CCW 源文件 | 目標文件 | 狀態 |
|------------|----------|------|
| `WORKFLOW_GUIDE.md` | `src/workflow/levels/*.py` | ⬜ |
| `core/core-memory-store.ts` | `src/memory/core_memory_store.py` | ⬜ |
| `tools/session-manager.ts` | `src/workflow/session/session_manager.py` | ⬜ |
| `tools/resume-strategy.ts` | `src/workflow/session/resume_strategy.py` | ⬜ |
| `tools/smart-search.ts` | `src/search/smart_search.py` | ⬜ |
| `tools/cli-executor-core.ts` | `src/cli/cli_executor.py` | ⬜ |
| `tools/cli-history-store.ts` | `src/cli/cli_history_store.py` | ⬜ |

---

## 附錄 C: OpenKL 移植參考

| OpenKL 源文件 | 目標文件 | 狀態 |
|---------------|----------|------|
| `openkl/memory.py` | `src/memory/memory_manager.py` | ⬜ |
| `openkl/citations.py` | `src/memory/citation_manager.py` | ⬜ |
| `openkl/distill.py` | `src/memory/distillation_manager.py` | ⬜ |
| `openkl/store.py` | `src/store/store_manager.py` | ⬜ |
| `openkl/graph.py` | `src/graph/graph_manager.py` | ⬜ |
| `openkl/vector_search.py` | `src/search/vector_search.py` | ⬜ |
| `openkl/db.py` | `src/graph/kuzu_db.py` | ⬜ |
| `rfcs/0000-openkl-design.md` | File System Contract Design | 📖 參考 |

---

## 附錄 D: AionUi 移植參考 **[NEW]**

| AionUi 源文件 | 目標文件 | 狀態 |
|---------------|----------|------|
| `src/process/initStorage.ts` | `src/storage/file_builder.py` | ⬜ |
| `skills/docx/SKILL.md` | Skills 格式規範參考 | 📖 參考 |
| `skills/*/SKILL.md` | `skills/*/SKILL.md` | ⬜ |
| `src/agent/gemini/*.ts` | 多 Agent 適配器參考 | 📖 參考 |
| `src/process/services/mcpServices/*.ts` | MCP 集成參考 | 📖 參考 |

---

*文檔更新: 2026-01-26 - V2.9 CCW + Cherry + OpenKL + AionUi Full Stack*
