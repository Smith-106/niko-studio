# 单元测试计划 (Unit Tests Plan)

> **版本**: 2.0  
> **框架**: pytest + Google ADK Evaluation  
> **状态**: 正式规范

---

## 一、测试策略概述

### 1.1 测试金字塔

```
                    ╱╲
                   ╱  ╲
                  ╱ E2E╲          5% - 端到端测试
                 ╱──────╲
                ╱        ╲
               ╱Integration╲      15% - 集成测试
              ╱────────────╲
             ╱              ╲
            ╱   Unit Tests   ╲    80% - 单元测试
           ╱──────────────────╲
```

### 1.2 测试类型划分

| 测试类型 | 对象 | 工具 | 确定性 |
|----------|------|------|--------|
| 单元测试 | MCP工具、工具函数 | pytest | 确定性 |
| 集成测试 | Agent协作流程 | pytest + mock | 半确定性 |
| 评估测试 | LLM输出质量 | LLM-as-a-Judge | 非确定性 |
| 端到端测试 | 完整工作流 | pytest + 真实调用 | 非确定性 |

---

## 二、单元测试规范

### 2.1 MCP 工具测试

#### 2.1.1 Obsidian MCP 测试

```python
# tests/unit/test_obsidian_mcp.py

import pytest
from unittest.mock import AsyncMock, patch
from tools.obsidian_mcp import (
    obsidian_read_note,
    obsidian_write_note,
    obsidian_query_dataview,
    obsidian_search
)


class TestObsidianReadNote:
    """obsidian_read_note 工具测试"""
    
    @pytest.mark.asyncio
    async def test_read_existing_note_returns_content(self):
        """测试读取存在的笔记返回正确内容"""
        # Arrange
        mock_content = """---
tags: [角色]
name: 艾琳
---
# 艾琳
角色描述..."""
        
        with patch('tools.obsidian_mcp.obsidian_client') as mock_client:
            mock_client.read_note = AsyncMock(return_value={
                'content': mock_content,
                'exists': True
            })
            
            # Act
            result = await obsidian_read_note(path="03-Characters/艾琳.md")
            
            # Assert
            assert result['exists'] is True
            assert result['frontmatter']['name'] == '艾琳'
            assert '角色描述' in result['content']
    
    @pytest.mark.asyncio
    async def test_read_nonexistent_note_returns_not_found(self):
        """测试读取不存在的笔记返回NOT_FOUND"""
        with patch('tools.obsidian_mcp.obsidian_client') as mock_client:
            mock_client.read_note = AsyncMock(return_value={
                'exists': False,
                'error': 'NOTE_NOT_FOUND'
            })
            
            result = await obsidian_read_note(path="不存在的笔记.md")
            
            assert result['exists'] is False
            assert result['error'] == 'NOTE_NOT_FOUND'
    
    @pytest.mark.asyncio
    async def test_read_note_parses_frontmatter_correctly(self):
        """测试正确解析YAML frontmatter"""
        mock_content = """---
tags: [章节, 草稿]
chapter: 3
status: 草稿
wordcount: 3500
characters:
  - 艾琳
  - 陈博士
---
# 第3章"""
        
        with patch('tools.obsidian_mcp.obsidian_client') as mock_client:
            mock_client.read_note = AsyncMock(return_value={
                'content': mock_content,
                'exists': True
            })
            
            result = await obsidian_read_note(path="06-Chapters/第3章.md")
            
            assert result['frontmatter']['chapter'] == 3
            assert result['frontmatter']['wordcount'] == 3500
            assert '艾琳' in result['frontmatter']['characters']


class TestObsidianWriteNote:
    """obsidian_write_note 工具测试"""
    
    @pytest.mark.asyncio
    async def test_write_note_creates_file(self):
        """测试写入笔记创建文件"""
        with patch('tools.obsidian_mcp.obsidian_client') as mock_client:
            mock_client.write_note = AsyncMock(return_value={
                'success': True,
                'path': '06-Chapters/草稿/测试章节.md'
            })
            
            result = await obsidian_write_note(
                path="06-Chapters/草稿/测试章节.md",
                content="# 测试内容"
            )
            
            assert result['success'] is True
            mock_client.write_note.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_write_note_creates_parent_directories(self):
        """测试自动创建父目录"""
        with patch('tools.obsidian_mcp.obsidian_client') as mock_client:
            mock_client.write_note = AsyncMock(return_value={'success': True})
            
            await obsidian_write_note(
                path="新目录/子目录/笔记.md",
                content="内容",
                create_directories=True
            )
            
            call_args = mock_client.write_note.call_args
            assert call_args.kwargs.get('create_directories') is True


class TestObsidianQueryDataview:
    """obsidian_query_dataview 工具测试"""
    
    @pytest.mark.asyncio
    async def test_query_returns_table_results(self):
        """测试Dataview查询返回表格结果"""
        mock_results = [
            {'path': '03-Characters/艾琳.md', 'name': '艾琳', 'role': '主角'},
            {'path': '03-Characters/陈博士.md', 'name': '陈博士', 'role': '配角'}
        ]
        
        with patch('tools.obsidian_mcp.obsidian_client') as mock_client:
            mock_client.query_dataview = AsyncMock(return_value={
                'results': mock_results,
                'count': 2
            })
            
            query = 'TABLE name, role FROM "03-Characters"'
            result = await obsidian_query_dataview(query=query)
            
            assert result['count'] == 2
            assert result['results'][0]['name'] == '艾琳'
    
    @pytest.mark.asyncio
    async def test_query_with_syntax_error_returns_error(self):
        """测试语法错误的查询返回错误"""
        with patch('tools.obsidian_mcp.obsidian_client') as mock_client:
            mock_client.query_dataview = AsyncMock(return_value={
                'error': 'QUERY_SYNTAX_ERROR',
                'message': 'Invalid query syntax'
            })
            
            result = await obsidian_query_dataview(query="INVALID QUERY")
            
            assert result['error'] == 'QUERY_SYNTAX_ERROR'
```

#### 2.1.2 飞书 MCP 测试

```python
# tests/unit/test_lark_mcp.py

import pytest
from unittest.mock import AsyncMock, patch
from tools.lark_mcp import (
    lark_get_records,
    lark_create_record,
    lark_update_record,
    lark_batch_update
)


class TestLarkGetRecords:
    """lark_get_records 工具测试"""
    
    @pytest.mark.asyncio
    async def test_get_records_without_filter(self):
        """测试无过滤条件获取记录"""
        mock_records = [
            {'record_id': 'rec1', 'fields': {'场景ID': 'CH01-SC01', '状态': '已完成'}},
            {'record_id': 'rec2', 'fields': {'场景ID': 'CH01-SC02', '状态': '进行中'}}
        ]
        
        with patch('tools.lark_mcp.lark_client') as mock_client:
            mock_client.get_records = AsyncMock(return_value={
                'records': mock_records,
                'has_more': False
            })
            
            result = await lark_get_records(
                app_token="test_app",
                table_id="test_table"
            )
            
            assert len(result['records']) == 2
            assert result['has_more'] is False
    
    @pytest.mark.asyncio
    async def test_get_records_with_filter(self):
        """测试带过滤条件获取记录"""
        with patch('tools.lark_mcp.lark_client') as mock_client:
            mock_client.get_records = AsyncMock(return_value={
                'records': [{'record_id': 'rec1', 'fields': {'状态': '进行中'}}],
                'has_more': False
            })
            
            filter_config = {
                'conditions': [{'field_name': '状态', 'operator': 'is', 'value': ['进行中']}],
                'conjunction': 'and'
            }
            
            result = await lark_get_records(
                app_token="test_app",
                table_id="test_table",
                filter=filter_config
            )
            
            assert len(result['records']) == 1
            assert result['records'][0]['fields']['状态'] == '进行中'


class TestLarkBatchUpdate:
    """lark_batch_update 工具测试"""
    
    @pytest.mark.asyncio
    async def test_batch_update_success(self):
        """测试批量更新成功"""
        with patch('tools.lark_mcp.lark_client') as mock_client:
            mock_client.batch_update = AsyncMock(return_value={
                'success_count': 5,
                'failed_count': 0,
                'errors': []
            })
            
            records = [
                {'record_id': f'rec{i}', 'fields': {'状态': '已完成'}}
                for i in range(5)
            ]
            
            result = await lark_batch_update(
                app_token="test_app",
                table_id="test_table",
                records=records
            )
            
            assert result['success_count'] == 5
            assert result['failed_count'] == 0
    
    @pytest.mark.asyncio
    async def test_batch_update_partial_failure(self):
        """测试批量更新部分失败"""
        with patch('tools.lark_mcp.lark_client') as mock_client:
            mock_client.batch_update = AsyncMock(return_value={
                'success_count': 3,
                'failed_count': 2,
                'errors': [
                    {'record_id': 'rec4', 'error': 'FIELD_INVALID'},
                    {'record_id': 'rec5', 'error': 'RECORD_NOT_FOUND'}
                ]
            })
            
            result = await lark_batch_update(
                app_token="test_app",
                table_id="test_table",
                records=[{'record_id': f'rec{i}', 'fields': {}} for i in range(5)]
            )
            
            assert result['success_count'] == 3
            assert result['failed_count'] == 2
            assert len(result['errors']) == 2
```

### 2.2 工具函数测试

```python
# tests/unit/test_utils.py

import pytest
from utils.text_processing import (
    count_words,
    detect_forbidden_words,
    calculate_sensory_ratio,
    parse_frontmatter
)


class TestCountWords:
    """字数统计测试"""
    
    def test_count_chinese_characters(self):
        """测试中文字符计数"""
        text = "这是一段测试文本。"
        assert count_words(text) == 9
    
    def test_count_mixed_content(self):
        """测试中英文混合计数"""
        text = "Hello世界，这是test。"
        # 中文7字 + 英文2词
        result = count_words(text)
        assert result >= 9


class TestDetectForbiddenWords:
    """禁用词检测测试"""
    
    def test_detect_single_forbidden_word(self):
        """测试检测单个禁用词"""
        text = "她突然站了起来。"
        forbidden = ["突然", "不禁", "竟然"]
        
        result = detect_forbidden_words(text, forbidden)
        
        assert len(result) == 1
        assert result[0]['word'] == '突然'
        assert result[0]['position'] == 1
    
    def test_detect_multiple_forbidden_words(self):
        """测试检测多个禁用词"""
        text = "他突然转身，竟然发现她不禁哭了起来。"
        forbidden = ["突然", "不禁", "竟然"]
        
        result = detect_forbidden_words(text, forbidden)
        
        assert len(result) == 3
    
    def test_no_forbidden_words(self):
        """测试无禁用词的情况"""
        text = "她缓缓站起身来，目光扫过房间。"
        forbidden = ["突然", "不禁", "竟然"]
        
        result = detect_forbidden_words(text, forbidden)
        
        assert len(result) == 0


class TestCalculateSensoryRatio:
    """感官描写比例计算测试"""
    
    def test_visual_dominant(self):
        """测试视觉描写占主导"""
        text = """
        阳光透过窗帘，在地板上投下斑驳的光影。
        她穿着白色的裙子，黑发披散在肩头。
        房间里摆放着深褐色的书架。
        """
        
        result = calculate_sensory_ratio(text)
        
        assert result['visual'] > 0.5
    
    def test_balanced_sensory(self):
        """测试均衡的感官描写"""
        text = """
        雨点敲打着窗户，发出清脆的声响。
        空气中弥漫着泥土的芬芳。
        她触摸着冰冷的玻璃，感受着那份寒意。
        远处的霓虹灯在雨幕中若隐若现。
        """
        
        result = calculate_sensory_ratio(text)
        
        # 应该有多种感官
        assert len([v for v in result.values() if v > 0]) >= 3
```

---

## 三、集成测试规范

### 3.1 Agent 协作测试

```python
# tests/integration/test_agent_collaboration.py

import pytest
from unittest.mock import AsyncMock, MagicMock
from agents.commander import CommanderAgent
from agents.architect import ArchitectAgent
from agents.writer import WriterAgent


class TestCommanderArchitectCollaboration:
    """Commander与Architect协作测试"""
    
    @pytest.fixture
    def commander(self):
        return CommanderAgent()
    
    @pytest.fixture
    def architect(self):
        return ArchitectAgent()
    
    @pytest.mark.asyncio
    async def test_commander_dispatches_planning_to_architect(
        self, commander, architect
    ):
        """测试Commander正确调度规划任务给Architect"""
        user_input = "写第3章，艾琳发现神秘代码"
        
        # Mock Architect的响应
        architect.plan = AsyncMock(return_value={
            'scene_cards': [
                {'scene_id': 'CH03-SC01', 'objective': '发现异常'}
            ],
            'lock_analysis': {'L': 8, 'O': 7, 'C': 9, 'K': 6}
        })
        
        # 执行
        result = await commander.process_request(
            user_input,
            agents={'architect': architect}
        )
        
        # 验证
        architect.plan.assert_called_once()
        assert 'scene_cards' in result
        assert len(result['scene_cards']) > 0


class TestWriterCriticLoop:
    """Writer与Critic的写作-审核循环测试"""
    
    @pytest.mark.asyncio
    async def test_revision_loop_improves_score(self):
        """测试修改循环能提高分数"""
        from agents.writer import WriterAgent
        from agents.critic import CriticAgent
        
        writer = WriterAgent()
        critic = CriticAgent()
        
        # 初始草稿得分较低
        initial_draft = "她突然站起来。"  # 包含禁用词
        
        # Mock审核结果
        critic.review = AsyncMock(side_effect=[
            {'score': 45, 'issues': [{'word': '突然', 'type': 'forbidden'}]},
            {'score': 75, 'issues': []},
        ])
        
        # Mock修改
        writer.revise = AsyncMock(return_value="椅子向后一滑，她已经站了起来。")
        
        # 执行循环
        current_draft = initial_draft
        for _ in range(2):
            review = await critic.review(current_draft)
            if review['score'] >= 70:
                break
            current_draft = await writer.revise(current_draft, review['issues'])
        
        # 验证最终分数提高
        final_review = await critic.review(current_draft)
        assert final_review['score'] >= 70
```

### 3.2 工作流测试

```python
# tests/integration/test_workflow.py

import pytest
from workflows.chapter_creation import ChapterCreationWorkflow
from workflows.states import WorkflowState


class TestChapterCreationWorkflow:
    """章节创建工作流测试"""
    
    @pytest.fixture
    def workflow(self):
        return ChapterCreationWorkflow()
    
    @pytest.mark.asyncio
    async def test_workflow_state_transitions(self, workflow):
        """测试工作流状态转换"""
        # 初始状态
        assert workflow.current_state == WorkflowState.IDLE
        
        # 模拟用户输入
        await workflow.receive_input("写第1章")
        assert workflow.current_state == WorkflowState.TASK_PARSING
        
        # 模拟成功解析
        await workflow.parse_task()
        assert workflow.current_state == WorkflowState.PLANNING
    
    @pytest.mark.asyncio
    async def test_workflow_handles_low_score(self, workflow):
        """测试工作流处理低分情况"""
        # 设置到审核状态
        workflow.current_state = WorkflowState.REVIEWING
        workflow.context.total_score = 45  # 低分
        
        # 执行决策
        await workflow.make_decision()
        
        # 应该进入修改状态
        assert workflow.current_state == WorkflowState.REVISING
    
    @pytest.mark.asyncio
    async def test_workflow_triggers_human_review(self, workflow):
        """测试工作流触发人工审核"""
        workflow.current_state = WorkflowState.REVIEWING
        workflow.context.total_score = 75  # 中等分数
        
        await workflow.make_decision()
        
        assert workflow.current_state == WorkflowState.HUMAN_REVIEW
```

---

## 四、测试配置

### 4.1 pytest 配置

```ini
# pytest.ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
asyncio_mode = auto
markers =
    slow: marks tests as slow (deselect with '-m "not slow"')
    integration: marks tests as integration tests
    e2e: marks tests as end-to-end tests
addopts = 
    --tb=short
    --strict-markers
    -v
```

### 4.2 测试夹具

```python
# tests/conftest.py

import pytest
from pathlib import Path

@pytest.fixture(scope="session")
def test_data_dir():
    """测试数据目录"""
    return Path(__file__).parent / "data"

@pytest.fixture
def sample_chapter():
    """示例章节内容"""
    return """
黄昏的光线像融化的蜂蜜，缓缓流淌在王城东门集市的石板路上。
艾琳拉低兜帽，穿过熙攘的人群。
香料的辛辣味、烤肉的焦香味、汗水的咸腥味混杂在一起，让她的鼻腔发痒。
"""

@pytest.fixture
def sample_scene_card():
    """示例场景卡片"""
    return {
        'scene_id': 'CH01-SC01',
        'chapter_num': 1,
        'pov_character': '艾琳',
        'objective': '购买禁忌魔法书',
        'conflict': '守卫突然出现',
        'outcome': '-',
        'structural_function': 'Inciting Incident'
    }

@pytest.fixture
def sample_character_profile():
    """示例角色档案"""
    return {
        'name': '艾琳',
        'role': 'protagonist',
        'traits': ['谨慎', '多疑', '自卑'],
        'motivation': '寻找失踪的母亲',
        'speaking_style': '习惯性自我怀疑'
    }
```

---

## 五、测试覆盖率要求

```yaml
CoverageRequirements:
  overall: 80%
  
  per_module:
    tools/: 90%        # MCP工具必须高覆盖
    agents/: 75%       # Agent核心逻辑
    workflows/: 80%    # 工作流状态机
    utils/: 85%        # 工具函数
    
  exclusions:
    - "**/test_*.py"
    - "**/__init__.py"
    - "**/conftest.py"
```

### 5.1 生成覆盖率报告

```bash
# 运行测试并生成覆盖率报告（覆盖率场景直接调用 pytest）
pytest -o addopts="" -m "not e2e" --cov=src --cov-report=html --cov-report=term-missing

# 检查覆盖率是否满足要求
pytest -o addopts="" -m "not e2e" --cov=src --cov-fail-under=80

# 本地定点调试（默认绕开 pytest.ini addopts 与全局覆盖率门槛）
python scripts/run_targeted_pytest.py tests/unit/test_workflow.py -q
```

---

## 六、版本历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| 1.0 | 2026-01-25 | 初始版本 |
| 2.0 | 2026-01-25 | 增加集成测试规范，完善pytest配置 |

---

*文档结束*
