# 方案整合優化實施計劃

**目標**: 依據對 CCW + Cherry Studio + OpenKL + AionUi 四個項目的分析，更新 SDD_V2.md 和 TASKS.md

---

## 現狀分析

### 已整合模塊

| 來源 | 模塊 | SDD Section | 狀態 |
|------|------|------------|------|
| CCW | SessionManager | §9.1 | ✅ |
| CCW | ResumeStrategy | §10 | ✅ |
| CCW | L1-L5 Workflow | §11 | ✅ |
| CCW | SmartSearch (RRF) | §12 | ✅ |
| CCW | CoreMemoryStore | §7.2 | ✅ |
| OpenKL | Citations | §8.2 | ✅ |
| OpenKL | Distillation | §8.3 | ✅ |
| OpenKL | MemoryManager | §8.4 | ✅ |
| OpenKL | StoreManager | §8.5 | ✅ |
| OpenKL | VectorSearch | §8.6 | ✅ |
| Cherry | MemoryService | §6.1 | ✅ |
| Cherry | SequentialThinking | §6.2 | ✅ |
| Cherry | Reranker | §6.3 | ✅ |

### 待添加模塊 (AionUi)

| 模塊 | 功能 | 價值 |
|------|------|------|
| **Skills 系統** | Frontmatter + Markdown 技能包 | ⭐⭐⭐ 可複用工作流 |
| **JsonFileBuilder** | 統一文件操作封裝 | ⭐⭐⭐ 簡化存儲邏輯 |
| **多 Agent 適配器** | Gemini/Claude/Qwen 統一接口 | ⭐⭐ 擴展性 |
| **工作流決策樹** | SKILL.md 分支邏輯 | ⭐⭐ Agent 路由參考 |

---

## 擬議變更

### [MODIFY] [SDD_V2.md](file:///d:/工作目录/写作Agent系统/docs/SDD_V2.md)

#### 變更 1: 更新架構決策表 (§0.2)

添加 AionUi Skills 決策:

```diff
| 決策項 | 選擇 | 理由 |
|--------|------|------|
| **向量存儲** | Kùzu HNSW | 統一圖+向量 |
| **會話管理** | CCW Session Manager | 成熟的會話生命週期 |
+ | **技能系統** | **AionUi Skills** | Frontmatter + Markdown 可複用工作流 |
+ | **存儲封裝** | **JsonFileBuilder** | 統一文件操作 API |
```

#### 變更 2: 添加新 Section 13 - AionUi Skills 系統

約 200 行，包含:
- Skills 目錄結構設計
- SKILL.md 格式規範
- 小說創作技能包示例 (novel-chapter, character-design, etc.)
- 工作流決策樹模式

#### 變更 3: 添加新 Section 14 - 存儲封裝層

約 100 行，包含:
- FileBuilder 基類
- JsonFileBuilder 派生類
- 與 OpenKL File Contract 整合

#### 變更 4: 添加新 Section 15 - 四項目功能互補矩陣

約 50 行，包含:
- CCW + Cherry + OpenKL + AionUi 功能對比表
- 最佳參考選擇建議

#### 變更 5: 更新版本歷史 (§13)

---

### [MODIFY] [TASKS.md](file:///d:/工作目录/写作Agent系统/docs/TASKS.md)

#### 變更 1: 添加 Phase 11 - AionUi Skills 系統移植

```markdown
## Phase 11: AionUi Skills 系統 (Priority: P1) **[NEW - AionUi]**

### 11.1 Skills 基礎結構
- [ ] `skills/` 目錄結構設計
  - [ ] Frontmatter + Markdown 格式
  - [ ] 工作流決策樹模板
  - [ ] `scripts/` 工具目錄

### 11.2 小說創作技能包
- [ ] `skills/novel-chapter/SKILL.md` - 章節創作
- [ ] `skills/character-design/SKILL.md` - 角色設計
- [ ] `skills/worldview-builder/SKILL.md` - 世界觀構建
- [ ] `skills/plot-structuring/SKILL.md` - 劇情結構
- [ ] `skills/dialogue-polish/SKILL.md` - 對話潤色
```

#### 變更 2: 添加 Phase 12 - 存儲層統一

```markdown
## Phase 12: 存儲層統一 (Priority: P2) **[NEW - AionUi]**

### 12.1 FileBuilder 模式
- [ ] `src/storage/file_builder.py`
  - [ ] FileBuilder 基類 (write/read/copy/rm)
  - [ ] JsonFileBuilder 派生類
  - [ ] encode/decode + set/get/update/backup
```

#### 變更 3: 添加附錄 D - AionUi 移植參考

```markdown
## 附錄 D: AionUi 移植參考 **[NEW]**

| AionUi 源文件 | 目標文件 | 狀態 |
|---------------|----------|------|
| `src/process/initStorage.ts` | `src/storage/file_builder.py` | ⬜ |
| `skills/docx/SKILL.md` | Skills 格式參考 | 📖 |
| `src/agent/gemini/*.ts` | 多 Agent 適配器參考 | 📖 |
```

#### 變更 4: 更新版本號和日期

---

## 驗證計劃

### 文檔一致性檢查

**手動驗證步驟**:
1. 打開更新後的 `SDD_V2.md`，確認新增 Section 13-15 存在
2. 確認 §0.2 架構決策表包含 AionUi Skills 和 JsonFileBuilder
3. 打開更新後的 `TASKS.md`，確認 Phase 11-12 存在
4. 確認附錄 D (AionUi 移植參考) 存在
5. 確認 SDD 和 TASKS 的模塊命名一致

### 格式驗證

**自動驗證** (Markdown lint):
```bash
# 如果安裝了 markdownlint
npx markdownlint docs/SDD_V2.md docs/TASKS.md
```

---

## 用戶審批項

> [!IMPORTANT]
> 請確認是否同意將 AionUi 的 Skills 系統和 JsonFileBuilder 存儲模式整合到現有設計中。

1. **Skills 目錄位置**: `skills/` (與 AionUi 一致) 還是 `.writing/skills/` (與 OpenKL 風格一致)?
2. **優先級**: Skills 系統建議 P1，存儲層統一建議 P2，是否合適?
3. **是否添加更多 AionUi 功能** (如 WebUI、預覽面板等)?
