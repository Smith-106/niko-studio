# 测试用例库 (Test Cases Inventory)

> **版本**: 2.0  
> **框架**: pytest + LLM-as-a-Judge  
> **状态**: 正式规范

---

## 一、概述

本文档定义了写作Agent系统的完整测试用例库，包括：
- 单元测试用例 (Unit Test Cases)
- 集成测试用例 (Integration Test Cases)
- 评估集 (Evalsets) - LLM输出质量评估

---

## 二、单元测试用例清单

### 2.1 MCP 工具测试用例

| 用例ID | 工具 | 测试场景 | 输入 | 期望输出 | 优先级 |
|--------|------|----------|------|----------|--------|
| UT-OBS-001 | obsidian_read_note | 读取存在的笔记 | path="03-Characters/艾琳.md" | content非空, exists=true | P0 |
| UT-OBS-002 | obsidian_read_note | 读取不存在的笔记 | path="不存在.md" | exists=false, error=NOT_FOUND | P0 |
| UT-OBS-003 | obsidian_read_note | 解析frontmatter | 含YAML的笔记 | frontmatter正确解析 | P0 |
| UT-OBS-004 | obsidian_write_note | 创建新笔记 | path, content | success=true | P0 |
| UT-OBS-005 | obsidian_write_note | 覆盖已有笔记 | 已存在的path | success=true | P1 |
| UT-OBS-006 | obsidian_write_note | 自动创建目录 | 不存在的目录路径 | 目录和文件均创建 | P1 |
| UT-OBS-007 | obsidian_query_dataview | 正常查询 | 有效DQL | results非空 | P0 |
| UT-OBS-008 | obsidian_query_dataview | 语法错误查询 | 无效DQL | error=SYNTAX_ERROR | P0 |
| UT-OBS-009 | obsidian_search | 关键词搜索 | keyword="艾琳" | 包含匹配结果 | P1 |
| UT-OBS-010 | obsidian_get_backlinks | 获取反向链接 | 被引用的笔记path | backlinks列表 | P2 |
| UT-LARK-001 | lark_get_records | 无过滤获取 | table_id | records列表 | P0 |
| UT-LARK-002 | lark_get_records | 带过滤获取 | filter条件 | 过滤后的records | P0 |
| UT-LARK-003 | lark_create_record | 创建记录 | fields | record_id | P0 |
| UT-LARK-004 | lark_update_record | 更新记录 | record_id, fields | success=true | P0 |
| UT-LARK-005 | lark_batch_update | 批量更新成功 | 多条记录 | success_count正确 | P1 |
| UT-LARK-006 | lark_batch_update | 部分失败 | 包含无效记录 | 正确统计成功/失败 | P1 |
| UT-RAG-001 | rag_search_foreshadows | 伏笔检索 | query, chapter_range | 相关伏笔列表 | P0 |
| UT-RAG-002 | rag_search_character_history | 角色历史 | character_name | 历史事件列表 | P1 |
| UT-RAG-003 | rag_semantic_search | 语义搜索 | query | 相似内容列表 | P1 |

### 2.2 工具函数测试用例

| 用例ID | 函数 | 测试场景 | 输入 | 期望输出 | 优先级 |
|--------|------|----------|------|----------|--------|
| UT-UTIL-001 | count_words | 中文计数 | "这是测试" | 4 | P0 |
| UT-UTIL-002 | count_words | 中英混合 | "Hello世界" | >= 3 | P0 |
| UT-UTIL-003 | detect_forbidden_words | 检测单个 | "她突然站起" | ['突然'] | P0 |
| UT-UTIL-004 | detect_forbidden_words | 检测多个 | 含多个禁用词 | 所有禁用词 | P0 |
| UT-UTIL-005 | detect_forbidden_words | 无禁用词 | 正常文本 | [] | P0 |
| UT-UTIL-006 | calculate_sensory_ratio | 视觉主导 | 视觉描写为主 | visual > 0.5 | P1 |
| UT-UTIL-007 | calculate_sensory_ratio | 均衡描写 | 多感官描写 | 3+种感官 | P1 |
| UT-UTIL-008 | parse_frontmatter | 解析YAML | 含frontmatter的md | 正确的dict | P0 |
| UT-UTIL-009 | parse_frontmatter | 无frontmatter | 纯内容md | 空dict | P1 |

---

## 三、集成测试用例清单

### 3.1 Agent 协作测试

| 用例ID | 测试场景 | 涉及Agent | 验证点 | 优先级 |
|--------|----------|-----------|--------|--------|
| IT-AGENT-001 | Commander调度Architect | Commander, Architect | 正确传递story_idea，返回scene_cards | P0 |
| IT-AGENT-002 | Architect生成场景卡片 | Architect | 场景卡片包含必需字段 | P0 |
| IT-AGENT-003 | Writer根据场景卡写作 | Writer | 内容符合scene_card要求 | P0 |
| IT-AGENT-004 | Critic审核Writer输出 | Critic, Writer | 返回LOCK评分和反馈 | P0 |
| IT-AGENT-005 | 写作-审核循环 | Writer, Critic | 3次循环后分数提升 | P1 |
| IT-AGENT-006 | 上下文Agent提供数据 | World, Character, Plot | 返回格式正确的上下文 | P1 |
| IT-AGENT-007 | 并行上下文收集 | Commander + 上下文Agents | 并行调用无冲突 | P1 |

### 3.2 工作流测试

| 用例ID | 工作流 | 测试场景 | 验证点 | 优先级 |
|--------|--------|----------|--------|--------|
| IT-WF-001 | 章节创建 | 完整流程 | 状态正确流转 | P0 |
| IT-WF-002 | 章节创建 | 高分自动通过 | score>=85时直接APPROVED | P0 |
| IT-WF-003 | 章节创建 | 低分触发修改 | score<70时进入REVISING | P0 |
| IT-WF-004 | 章节创建 | 连续失败触发人工 | 3次修改后HUMAN_INTERVENTION | P1 |
| IT-WF-005 | 审稿工作流 | 并行8维度审核 | 所有维度返回结果 | P0 |
| IT-WF-006 | 审稿工作流 | 分数加权汇总 | 按权重正确计算总分 | P0 |
| IT-WF-007 | 伏笔追踪 | 状态流转 | 埋下→回收正确更新 | P1 |

---

## 四、评估集 (Evalsets)

### 4.1 LOCK 系统评估集

#### 4.1.1 L - Lead 评估样本

```yaml
# evalsets/lock/lead_samples.yaml

samples:
  - id: EVAL-L-001
    name: "高分主角样本"
    category: L_Lead
    expected_score: 9
    tolerance: 1
    content: |
      艾琳是个能听懂猫说话的华裔AI研究员。
      在西方学术界挣扎多年，她习惯性地自我怀疑，
      每当有人夸奖她时，她总会说"也许是我想多了..."
      她最大的恐惧是不被认可，这源于童年时期父母的高压期望。
      妹妹失踪后，她决定用自己独特的能力去寻找真相。
    criteria_check:
      uniqueness: true      # 能听懂猫语 ✓
      pain_point: true      # 不被认可的恐惧 ✓
      empathy: true         # 自我怀疑易共情 ✓
      
  - id: EVAL-L-002
    name: "中等主角样本"
    category: L_Lead
    expected_score: 5
    tolerance: 1
    content: |
      林默是一名侦探，性格沉稳。
      他接到一个案子，决定调查下去。
    criteria_check:
      uniqueness: false     # 无独特性
      pain_point: false     # 无明显痛点
      empathy: partial      # 基本可以

  - id: EVAL-L-003
    name: "低分主角样本"
    category: L_Lead
    expected_score: 2
    tolerance: 1
    content: |
      主角是个普通的高中生。
      他每天上学放学，生活平淡无奇。
    criteria_check:
      uniqueness: false
      pain_point: false
      empathy: false
```

#### 4.1.2 C - Confrontation 评估样本

```yaml
# evalsets/lock/confrontation_samples.yaml

samples:
  - id: EVAL-C-001
    name: "高分冲突样本"
    category: C_Confrontation
    expected_score: 9
    tolerance: 1
    content: |
      艾琳发现神秘代码后，陈博士突然变得警惕起来。
      "你不该看到这些。"他的声音冷了下来。
      艾琳感到一阵寒意，但她知道不能退缩。
      门外传来脚步声——保安来了。
      她只有30秒做出选择：交出数据，还是冒险逃跑？
    criteria_check:
      external_conflict: true   # 与陈博士、保安的冲突
      internal_conflict: true   # 内心的挣扎
      escalation: true          # 冲突不断升级
      urgency: true             # 30秒时间压力

  - id: EVAL-C-002
    name: "缺乏冲突样本"
    category: C_Confrontation
    expected_score: 2
    tolerance: 1
    content: |
      艾琳来到实验室，打开电脑。
      她查看了一些数据，觉得有点奇怪。
      然后她去吃了午饭，和同事聊了聊天。
      下午她继续工作，一切顺利。
    criteria_check:
      external_conflict: false
      internal_conflict: false
      escalation: false
      urgency: false
```

### 4.2 风格评估集

#### 4.2.1 感官描写样本

```yaml
# evalsets/style/sensory_samples.yaml

samples:
  - id: EVAL-SENS-001
    name: "优秀感官描写"
    category: sensory
    expected_score: 7
    tolerance: 1
    content: |
      黄昏的光线像融化的蜂蜜，缓缓流淌在集市的石板路上。
      香料的辛辣味、烤肉的焦香味、汗水的咸腥味混杂在一起。
      远处传来叫卖声和铜钟的回响。
      她的手指触碰到羊皮纸粗糙的边缘，感受着岁月留下的痕迹。
    sensory_breakdown:
      visual: ["黄昏光线", "石板路"]
      olfactory: ["香料味", "烤肉味", "汗味"]
      auditory: ["叫卖声", "铜钟回响"]
      tactile: ["羊皮纸粗糙"]

  - id: EVAL-SENS-002
    name: "纯视觉描写"
    category: sensory
    expected_score: 3
    tolerance: 1
    content: |
      集市很热闹。有很多摊位，卖各种东西。
      人们穿着各色衣服走来走去。
      她看到一个角落里有个神秘的商人。
    sensory_breakdown:
      visual: ["摊位", "衣服", "商人"]
      olfactory: []
      auditory: []
      tactile: []
```

#### 4.2.2 对话质量样本

```yaml
# evalsets/style/dialogue_samples.yaml

samples:
  - id: EVAL-DIA-001
    name: "优秀对话"
    category: dialogue
    expected_score: 8
    tolerance: 1
    content: |
      "你来了。"商人的声音低沉而沙哑。
      艾琳点点头，没有说话。
      "紧张？"商人轻笑，"第一次总是这样。"
      "我不紧张。"她说，但手心已经开始冒汗。
      商人意味深长地看了她一眼："那就好。交易嘛...最重要的是信任。"
    quality_markers:
      naturalistic: true      # 口语化
      subtext: true           # 有潜台词
      character_voice: true   # 符合角色
      action_beats: true      # 配合动作

  - id: EVAL-DIA-002
    name: "说明书式对话"
    category: dialogue
    expected_score: 2
    tolerance: 1
    content: |
      "你好，我是艾琳，我今年25岁，是一名AI研究员。"
      "你好艾琳，我知道你是研究员，我这里有一本关于古老魔法的禁书，里面记载着很多秘密。"
      "太好了，我正需要这本书来寻找我失踪的母亲，她五年前消失了。"
    quality_markers:
      naturalistic: false
      subtext: false
      character_voice: false
      action_beats: false
```

### 4.3 逻辑评估集

```yaml
# evalsets/logic/plot_logic_samples.yaml

samples:
  - id: EVAL-LOGIC-001
    name: "逻辑一致"
    category: plot_logic
    expected_score: 9
    tolerance: 1
    content: |
      艾琳在第1章提到她害怕黑暗，因为童年的一次创伤。
      第5章，当她必须进入地下室时，她犹豫了很久。
      她的手在门把手上颤抖，呼吸变得急促。
      最终，她想起母亲的话，鼓起勇气推开了门。
    logic_check:
      character_consistency: true  # 符合之前设定
      causation: true              # 因果清晰
      timeline: true               # 时间线正确

  - id: EVAL-LOGIC-002
    name: "逻辑矛盾"
    category: plot_logic
    expected_score: 3
    tolerance: 1
    content: |
      艾琳是个内向害羞的人，平时不敢跟陌生人说话。
      下一个场景，她突然变成了派对的中心，
      侃侃而谈，和十几个陌生人谈笑风生，
      完全像变了一个人。
    logic_check:
      character_consistency: false  # 与之前设定矛盾
      causation: false              # 无解释
      timeline: true
```

---

## 五、测试数据文件

### 5.1 目录结构

```
d:\工作目录\写作Agent系统\docs\tdd\
├── evalsets/
│   ├── lock/
│   │   ├── lead_samples.yaml
│   │   ├── objective_samples.yaml
│   │   ├── confrontation_samples.yaml
│   │   └── knockout_samples.yaml
│   ├── style/
│   │   ├── sensory_samples.yaml
│   │   ├── dialogue_samples.yaml
│   │   └── forbidden_words_samples.yaml
│   └── logic/
│       ├── plot_logic_samples.yaml
│       └── character_consistency_samples.yaml
└── fixtures/
    ├── sample_chapters/
    │   ├── chapter_high_quality.md
    │   ├── chapter_medium_quality.md
    │   └── chapter_low_quality.md
    ├── sample_scene_cards/
    │   └── scene_cards.json
    └── sample_characters/
        └── character_profiles.json
```

### 5.2 测试夹具示例

```json
// fixtures/sample_scene_cards/scene_cards.json
{
  "scene_cards": [
    {
      "scene_id": "CH01-SC01",
      "chapter_num": 1,
      "scene_title": "神秘委托",
      "pov_character": "艾琳",
      "location": "研究所",
      "time": "深夜",
      "objective": "完成例行检查",
      "conflict": "发现异常代码",
      "outcome": "-",
      "structural_function": "Inciting Incident",
      "lock_check": {
        "lead": true,
        "objective": true,
        "confrontation": true,
        "knockout": false
      }
    }
  ]
}
```

---

## 六、测试执行指南

### 6.1 运行所有单元测试

```bash
# 运行所有单元测试（本地定点入口，默认绕开 pytest.ini addopts 与全局覆盖率门槛）
python scripts/run_targeted_pytest.py tests/unit/ -v

# 运行特定模块测试
python scripts/run_targeted_pytest.py tests/unit/test_obsidian_mcp.py -v

# 运行带标记的测试
python scripts/run_targeted_pytest.py -m "not slow" -v
```

### 6.2 运行集成测试

```bash
# 运行集成测试
python scripts/run_targeted_pytest.py tests/integration/ -v

# 仅运行工作流测试
python scripts/run_targeted_pytest.py tests/integration/test_workflow.py -v
```

### 6.3 运行评估测试

```bash
# 运行LLM评估测试
python -m evaluation.run_evalsets --evalset-dir docs/tdd/evalsets/

# 运行特定类别评估
python -m evaluation.run_evalsets --category lock
```

---

## 七、版本历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| 1.0 | 2026-01-25 | 初始版本 |
| 2.0 | 2026-01-25 | 增加评估集样本 |

---

*文档结束*
