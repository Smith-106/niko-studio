---
name: novel-chapter
description: 章節創作技能 - 支持有大綱和無大綱兩種模式
version: "1.0"
author: system
tags: [writing, novel, chapter]
---

# 章節創作技能

## Overview

本技能用於創作小說章節，支持多種創作模式:
- 有大綱章節創作
- 無大綱探索性寫作
- 章節修訂
- 文筆優化

## Workflow Decision Tree

### 新章節創作

判斷條件: 檢查 `{session}/OUTLINE.md` 是否存在

- **有大綱** → Use "有大綱章節創作" workflow
- **無大綱** → Use "探索性寫作" workflow

### 章節修訂

判斷條件: 根據用戶請求類型

- **內容調整** (劇情、對話修改) → Use "章節重寫" workflow
- **風格潤色** (文筆、描寫優化) → Use "文筆優化" workflow

## 五維評估集成

草稿生成後，同步執行五維評估與 LOCK 評分，作為下一步修訂依據。

| 維度 | 指標意義 | 低分處理 |
|------|----------|----------|
| dream | 代入與沉浸強度 | 補強情感遞進與感官細節 |
| suspense | 問題驅動與緊張度 | 強化威脅、問題與章尾懸念 |
| character | 人物立體度與弧光 | 補充行為證據與內在動機 |
| premise | 預設清晰度與推進力 | 重寫章節目標與因果鏈 |
| voice | 語氣穩定度與辨識度 | 統一敘述口吻與句法節奏 |

建議閾值：
- 任一維度 < 70：進入定向修訂。
- 任一維度 < 60：必須修訂後再提交審核。

## 技能包推薦流程

1. 讀取 Critic 回傳的五維分數與問題摘要。
2. 選擇最低分維度與次低分維度，作為本輪優先修訂目標。
3. 根據維度映射推薦技能包：
   - dream → `fictional-dream`
   - suspense → `suspense-craft`
   - character → `character-forge`
   - premise → `premise-magic`
   - voice → `voice-workshop`
4. 每輪最多啟用 1-2 個技能包，避免同時改動過多導致風格漂移。
5. 修訂完成後重評，若主問題未改善，切換到次優技能包策略。

## 優化工作流步驟

1. 讀取章節上下文與場景卡片。
2. 生成章節草稿（Writer Agent）。
3. 執行五維評估 + LOCK 評分（Critic Agent）。
4. 觸發技能包推薦並做定向修訂。
5. 二次評估：確認低分維度已提升。
6. 決策輸出：
   - APPROVED：保存章節並推進下一章
   - REVISE：回到步驟 2（附帶精準反饋）
   - HUMAN_REVIEW：超過修改次數上限時交人工

---

## 有大綱章節創作

適用場景: 已有完整大綱，按計劃推進

### 步驟

1. **讀取上下文**
   - 讀取大綱 `{session}/OUTLINE.md`
   - 讀取前一章節 `{session}/chapters/chapter-{n-1}.md`
   - 讀取角色狀態 `{session}/.data/characters/`

2. **確定場景卡片**
   - 從大綱中提取當前章節的場景卡片
   - 識別 POV 角色、目標、冲突、結局

3. **生成草稿**
   - 調用 Writer Agent
   - 使用 `templates/chapter_prompt.md` 模板

4. **質量評估**
   - 調用 Critic Agent
   - LOCK 評分 (Lead, Objective, Conflict, Knockout)

5. **決策**
   - APPROVED (≥80分): 保存並繼續
   - REVISE (<80分): 回到步驟 3，附帶反饋
   - HUMAN_REVIEW (達到最大修改次數): 等待人工審閱

---

## 探索性寫作

適用場景: 無大綱，自由創作

### 步驟

1. **分析已有內容**
   - 讀取已有章節
   - 提取角色狀態和劇情走向

2. **生成多個劇情走向**
   - 調用 Architect Agent (brainstorm 模式)
   - 生成 3-5 個可能的發展方向

3. **選擇或推薦**
   - 用戶選擇: 展示選項供用戶選擇
   - AI 推薦: 根據一致性評分推薦最佳選項

4. **生成章節**
   - 按照選定方向創作
   - 流程同"有大綱章節創作"

---

## 章節重寫

適用場景: 需要修改劇情或對話

### 步驟

1. **讀取原章節**
2. **理解修改需求**
3. **重新生成受影響部分**
4. **一致性檢查** (前後章節銜接)

---

## 文筆優化

適用場景: 潤色文字，不改變劇情

### 步驟

1. **讀取原章節**
2. **分析風格問題**
   - 句式單調
   - 描寫過少/過多
   - 對話不自然
3. **局部優化**
4. **保持劇情一致**

---

## 使用的模板

- `templates/chapter_prompt.md` - 章節創作 Prompt
- `templates/revision_prompt.md` - 修訂 Prompt
- `templates/polish_prompt.md` - 潤色 Prompt
