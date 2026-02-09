# AI 寫作 Agent 系統 - 測試驅動開發文檔 (TDD)

**版本**: 2.0 (Cherry + CCW + OpenKL)
**日期**: 2026-01-26
**狀態**: Active

---

## 1. 測試策略

### 1.1 測試金字塔

```
         /\
        /  \  E2E Tests (Playwright)
       /────\  - 完整写作工作流 (L3/L5)
      /      \ - UI 交互測試 (AionUi Components)
     /────────\
    /          \ Integration Tests (pytest)
   /────────────\ - Agent 協作 (Commander -> Architect -> Writer)
  /              \ - Knowledge Layer Sync (Distill -> Graph)
 /────────────────\
/                  \ Unit Tests (pytest)
/────────────────────\ - 单一模块逻辑 (Citation, FileSync, Routing)
                       - 工具函數
                       - 數據模型 (Entity, Relation)
```

### 1.2 覆蓋率目標

| 層級 | 目標 | 重点关注 |
|------|------|----------|
| Unit | 80%+ | `CitationManager`, `AgentKnowledgeLayer` CRUD |
| Integration | 60%+ | `DistillService`, `CommanderAgent` Routing |
| E2E | 关键路径 100% | L3 Chapter Creation, L5 Brainstorming |

---

## 2. 單元測試規範 (Enhanced)

### 2.1 Agent 协议与路由 (CCW)

```python
# tests/unit/agents/test_commander.py
class TestCommanderAgent:
    def test_routing_logic(self):
        agent = CommanderAgent()
        assert agent.route("修正错字") == "L1_RAPID"
        assert agent.route("写第一章") == "L3_STANDARD"
        assert agent.route("设计世界观") == "L5_BRAINSTORM"

# tests/unit/agents/test_base.py
class TestBaseAgent:
    def test_prompt_protocol(self):
        """验证 6-Field Protocol"""
        agent = BaseAgent("Test")
        prompt = agent.construct_prompt(
            purpose="Test", task="Unit", mode="exec", 
            context="None", expected="JSON", rules="None"
        )
        assert "PURPOSE:" in prompt
        assert "RULES:" in prompt
```

### 2.2 知识层与引用 (OpenKL)

```python
# tests/unit/services/test_knowledge.py
class TestKnowledgeLayer:
    def test_hybrid_query(self, knowledge_layer):
        """测试向量+图混合检索"""
        # Seed
        knowledge_layer.add_document("doc1", "Alice likes apples.", "test")
        knowledge_layer.add_entity("e1", "Alice", "Character")
        
        # Query
        results = knowledge_layer.query_hybrid("apples", entity_filter=["e1"])
        assert len(results["chunks"]) > 0
        assert len(results["entities"]) == 1

# tests/unit/memory/test_citation.py
class TestCitationManager:
    def test_citations_integrity(self):
        content = "Original Content"
        cite = CitationManager.create_citation("doc1", content)
        
        # Modify content
        assert CitationManager.verify_citation(cite, content) == True
        assert CitationManager.verify_citation(cite, "Modified Content") == False
```

### 2.3 文件同步 (Advanced OpenKL)

```python
# tests/unit/services/test_file_sync.py
class TestFileSync:
    def test_watchdog_trigger(self, tmp_path):
        """测试文件变更是否触发回调"""
        callback = MagicMock()
        syncer = FileSyncService(callback=callback, paths=[str(tmp_path)])
        
        # Create file
        (tmp_path / "test.md").write_text("New Content")
        
        # Verify callback (might need sleep/wait due to async nature)
        time.sleep(1)
        callback.assert_called()
```

---

## 3. 集成測試規範 (Enhanced)

### 3.1 记忆蒸馏循环 (Distillation Cycle)

```python
# tests/integration/test_distill_cycle.py
def test_chapter_distillation():
    """测试：写章节 -> 蒸馏 -> 更新图谱"""
    # 1. 模拟 Writer 输出
    chapter_content = "Alice walked into the dark forest. She found a glowing sword."
    
    # 2. 运行 DistillService
    distill_service = DistillService(mock_llm)
    data = distill_service.distill_chapter(chapter_content)
    
    # 3. 验证提取结果
    assert any(e["name"] == "Alice" for e in data["entities"])
    assert any(e["name"] == "Glowing Sword" for e in data["entities"])
    
    # 4. 写入 KnowledgeLayer
    knowledge_layer = AgentKnowledgeLayer(":memory:")
    distill_service.apply_to_graph(knowledge_layer, data)
    
    # 5. 验证图谱查询
    neighbors = knowledge_layer.get_neighbors("alice_id")
    assert len(neighbors) > 0 # Should link to sword or location
```

---

## 4. E2E 測試規範

保留原有 Streamlit UI 测试，增加对 **AionUi 组件** 的交互测试（如果前端已实现）。

```python
def test_aion_modal_interaction(page: Page):
    """测试 AionUI 风格模态框"""
    page.click("#settings-btn")
    expect(page.locator(".aionui-modal")).to_be_visible()
    expect(page.locator(".aionui-modal")).to_have_css("backdrop-filter", "blur(20px)")
```
