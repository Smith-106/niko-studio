# 评估标准 (Evaluation Criteria - LLM-as-a-Judge)

> **版本**: 3.0  
> **模式**: LLM-as-a-Judge + 业务逻辑测试  
> **评估模型**: Gemini Pro / Claude  
> **状态**: 正式规范

---

## 一、概述

本文档定义了写作Agent系统的质量评估标准，采用 **LLM-as-a-Judge** 模式进行非确定性内容质量评估，结合 **业务逻辑测试** 确保输出符合网文创作规范。

### 1.1 测试金字塔

```
                    ╱╲
                   ╱  ╲
                  ╱ E2E╲          5% - 端到端测试
                 ╱──────╲              (完整章节生成)
                ╱        ╲
               ╱LLM Judge ╲       20% - LLM评估测试
              ╱────────────╲           (内容质量)
             ╱              ╲
            ╱ Business Logic ╲    25% - 业务逻辑测试
           ╱──────────────────╲        (LOCK/套路)
          ╱                    ╲
         ╱    Unit Tests        ╲ 50% - 单元测试
        ╱────────────────────────╲     (工具/函数)
```

### 1.2 评估维度

| 评估维度 | 权重 | 方法 |
|----------|------|------|
| LOCK系统完整性 | 40% | 规则检查 + LLM评估 |
| 风格质量 | 35% | LLM-as-a-Judge |
| 逻辑与体验 | 25% | LLM-as-a-Judge |

---

## 二、LOCK 系统评估

### 2.1 L - Lead 评估 (主角魅力)

```yaml
L_Lead_Evaluation:
  max_score: 10
  
  规则检查 (Deterministic):
    - protagonist_desire != "": "主角必须有明确渴望"
    - protagonist_pain_point != "": "主角必须有痛点"
    
  LLM评估 (Non-deterministic):
    uniqueness:
      weight: 0.3
      prompt: |
        评估主角的独特性(0-10分):
        
        ## 待评估内容
        {protagonist_description}
        
        ## 检查点
        1. 是否有独特的背景或经历？
        2. 是否有鲜明的性格特征？
        3. 是否有令人难忘的习惯或口头禅？
        4. 是否有反差感？(如：外表冷酷，内心善良)
        
        ## 评分标准
        - 9-10: 极具辨识度，在众多同类作品中脱颖而出
        - 7-8: 有特色但不够突出
        - 5-6: 有基本设定但缺乏独特性
        - 0-4: 平淡无奇，可被任何人替代
        
        ## 参考案例
        ✅ 好: "能听懂猫说话的华裔AI研究员，习惯性自我怀疑"
        ❌ 差: "一个普通的高中生"
        
    pain_point:
      weight: 0.3
      prompt: |
        评估主角痛点的深度(0-10分):
        
        ## 检查点
        1. 是否有核心恐惧？(如：害怕不被认可)
        2. 是否有未愈合的伤口？(如：童年创伤)
        3. 痛点是否与故事主题相关？
        
    empathy:
      weight: 0.4
      prompt: |
        评估读者共鸣度(0-10分):
        
        ## 检查点
        1. 主角困境是否具有普遍性？
        2. 读者是否会"想要主角成功"？
        3. 开篇是否立刻让读者产生关心？
```

### 2.2 O - Objective 评估 (目标明确)

```yaml
O_Objective_Evaluation:
  max_score: 10
  
  规则检查:
    - objective_statement.length >= 10: "目标描述不能太短"
    - objective_measurable == True: "目标必须可衡量"
    
  LLM评估:
    clarity:
      weight: 0.3
      prompt: |
        评估目标清晰度(0-10分):
        
        ## 目标描述
        {objective_statement}
        
        ## 检查点
        1. 能否用一句话说清楚主角想要什么？
        2. 目标是否具体可衡量？
           - ✅ "在三个月内找到杀害父亲的凶手"
           - ❌ "变得更好"
        3. 目标是否在第一幕就明确？
        
    difficulty:
      weight: 0.3
      prompt: |
        评估目标难度(0-10分):
        
        ## 检查点
        1. 是否需要克服重重困难？
        2. 是否有强大的对抗力量？
        3. 主角是否需要成长才能达成？
        
    want_vs_need:
      weight: 0.4
      prompt: |
        评估欲望与需求的冲突(0-10分):
        
        ## 检查点
        外在欲望: {external_desire}
        内在需求: {internal_need}
        
        1. 两者是否有冲突？
        2. 冲突是否驱动情节？
        
        ## 示例
        ✅ 好: 外在想要复仇，内在需要放下仇恨
        ❌ 差: 只有外在欲望，没有内在成长
```

### 2.3 C - Confrontation 评估 (冲突贯穿)

```yaml
C_Confrontation_Evaluation:
  max_score: 10
  
  规则检查:
    - all(scene.conflict != "" for scene in scenes): "每个场景必须有冲突"
    - conflict_sources >= 2: "冲突来源至少2种"
    
  LLM评估:
    continuity:
      weight: 0.3
      prompt: |
        评估冲突持续性(0-10分):
        
        ## 场景列表
        {scene_list}
        
        ## 检查点
        1. 每个场景是否都有冲突？
        2. 冲突是否有多个层次？
           - 外部冲突: 主角 vs 对手
           - 内部冲突: 主角 vs 自我
           - 关系冲突: 主角 vs 盟友
        3. 冲突是否贯穿三幕？
        
    escalation:
      weight: 0.4
      prompt: |
        评估冲突升级(0-10分):
        
        ## 检查点
        1. 冲突是否越来越激烈？
        2. 是否有"点燃导火索"时刻(第一扇门)？
        3. 是否有"最黑暗时刻"(第二扇门)？
        4. 高潮是否是最大的冲突？
        
    variety:
      weight: 0.3
      prompt: |
        评估冲突多样性(0-10分):
        
        ## 检查点
        冲突类型:
        - 人物 vs 人物
        - 人物 vs 自我
        - 人物 vs 环境
        - 人物 vs 社会
        
        至少需要2种冲突类型交织
```

### 2.4 K - Knockout 评估 (结尾冲击)

```yaml
K_Knockout_Evaluation:
  max_score: 10
  
  LLM评估:
    impact:
      weight: 0.4
      prompt: |
        评估结尾冲击力(0-10分):
        
        ## 结尾内容
        {ending_content}
        
        ## 检查点
        1. 是否出人意料但合情合理？
        2. 是否解决了核心冲突？
        3. 是否有情感冲击？
        4. 读者会记住这个结局吗？
        
    inner_fulfillment:
      weight: 0.3
      prompt: |
        评估内在满足(0-10分):
        
        ## 检查点
        1. 主角的内在需求是否得到满足？
        2. 主角是否有真正的成长？
        3. 成长是否有代价？
        4. 结尾是否呼应开篇？
        
    transformation:
      weight: 0.3
      prompt: |
        评估认知转变(0-10分):
        
        ## 检查点
        1. 读者对主题是否有新的理解？
        2. 故事是否有超越情节的意义？
```

---

## 三、风格质量评估

### 3.1 狄更斯风格 - 万物有灵评估

```yaml
Dickensian_Style_Evaluation:
  max_score: 10
  
  description: |
    狄更斯风格的核心是"万物有灵"(Animism):
    - 使用带有情感的主动动词描写无生命物体
    - 通过环境描写反射角色心理
    - 避免直接的心理描写
  
  prompt: |
    你是一位文学评论家，专精狄更斯风格分析。
    
    ## 待评估文本
    {environment_description}
    
    ## 评估标准
    
    ### 1. 万物有灵技法 (0-4分)
    检查是否使用带有惡意或情感的主动动词描写物体:
    - ✅ "煤气灯的火焰畏缩了一下"
    - ✅ "雾气伸出了手指"
    - ❌ "灯亮着" (平淡)
    
    ### 2. 环境映射心理 (0-3分)
    检查环境是否反射角色内心状态:
    - ✅ 角色恐惧时："走廊似乎在收缩"
    - ❌ 直接说："他很害怕"
    
    ### 3. 避免直白心理描写 (0-3分)
    - ✅ "他的手指在口袋里握紧了那封信"
    - ❌ "他感到非常紧张"
    
    请给出0-10分的综合评分。
    
  scoring_rubric:
    10: 完美的狄更斯风格，环境活了起来
    7-9: 很好地运用了万物有灵，少数直白描写
    4-6: 部分运用，但直白描写仍较多
    1-3: 偶尔有拟人化，但不够系统
    0: 完全没有运用万物有灵
```

### 3.2 五感描写评估

```yaml
Sensory_Evaluation:
  max_score: 10
  
  规则检查:
    sensory_count:
      check: "至少包含3种感官"
      method: |
        count = sum([
          bool(re.search(visual_patterns, text)),
          bool(re.search(auditory_patterns, text)),
          bool(re.search(tactile_patterns, text)),
          bool(re.search(olfactory_patterns, text)),
          bool(re.search(gustatory_patterns, text)),
        ])
        assert count >= 3
        
  LLM评估:
    prompt: |
      评估以下文本的感官描写质量(0-10分):
      
      ## 待评估文本
      {content}
      
      ## 理想比例参考
      - 视觉: 50%
      - 听觉: 20%
      - 触觉: 15%
      - 嗅觉: 10%
      - 味觉: 5%
      
      ## 检查点
      1. 感官丰富度: 是否涵盖多种感官？
      2. 比例均衡: 是否避免了视觉过度主导？
      3. 自然融入: 感官描写是否自然融入叙事？
      4. 避免堆砌: 是否避免了形容词堆砌？
      
    scoring_rubric:
      10: 五感丰富且均衡，自然融入，沉浸感极强
      7-9: 感官描写较好，但某些方面可以加强
      4-6: 有一定感官描写，但不够丰富或均衡
      1-3: 感官描写匮乏，主要依赖视觉
      0: 几乎无感官描写或严重堆砌
```

### 3.3 对话质量评估

```yaml
Dialogue_Evaluation:
  max_score: 10
  
  规则检查:
    forbidden_patterns:
      - "我是XXX，我今年XX岁" (说明书式自我介绍)
      - 连续5行以上纯对话无动作描写
      
  LLM评估:
    prompt: |
      评估以下对话的质量(0-10分):
      
      ## 待评估对话
      {dialogue_content}
      
      ## 角色信息
      {character_profiles}
      
      ## 检查点
      
      ### 1. 自然度 (0-3分)
      - 是否像真人说话？
      - 是否口语化？
      - 是否避免了书面语？
      
      ### 2. 潜台词 (0-3分)
      - 是否有言外之意？
      - 是否避免了"说明书式对话"？
      示例:
      - ❌ "我爱你，但我很害怕" (直白)
      - ✅ "你...还记得我们第一次见面的地方吗？" (有潜台词)
      
      ### 3. 人设一致 (0-2分)
      - 是否符合角色的身份、性格？
      - 是否有独特的说话习惯？
      
      ### 4. 动作配合 (0-2分)
      - 对话是否配合动作和表情？
      - 是否避免了"talking heads"问题？
      
    scoring_rubric:
      10: 对话精彩绝伦，每一句都有味道
      7-9: 对话质量很好，有个别可优化之处
      4-6: 对话基本合格，但缺乏亮点
      1-3: 对话存在明显问题
      0: 对话失败，不符合人物或过于生硬
```

---

## 四、网文套路评估

### 4.1 爽点机制评估

```yaml
ShuangDian_Evaluation:
  适用场景: 关键剧情转折
  max_score: 10
  
  prompt: |
    评估以下片段的"爽点"执行质量(0-10分):
    
    ## 待评估内容
    {climax_content}
    
    ## 爽点三要素检查
    
    ### 1. Setup 铺垫 (0-3分)
    是否有足够的压抑或期待感？
    - ✅ 读者憋了一口气，等待释放
    - ❌ 没有铺垫，高潮来得突兀
    
    检查点:
    - 主角之前受到了什么压迫/挫折？
    - 期待感积累了多久？
    
    ### 2. Payoff 爆发 (0-4分)
    主角的行动是否释放了压力？
    - ✅ 读者感到"爽快"、"解气"
    - ❌ 释放不够彻底，或手段不够精彩
    
    检查点:
    - 主角的反击是否出人意料？
    - 手段是否聪明or霸气？
    
    ### 3. Reaction 反馈 (0-3分)
    周围世界/配角是否给予了震惊反应？
    - ✅ 反派/路人的震惊强化了爽感
    - ❌ 没有反应，主角自嗨
    
    检查点:
    - 反派是否表现出惊愕/恐惧？
    - 围观者是否有评论/反应？
    
  scoring:
    10: 三要素完美配合，读者会拍大腿叫好
    7-9: 基本满足，爽感充足
    4-6: 有爽点但不够强烈
    1-3: 爽点较弱，缺少一个或多个要素
    0: 没有爽点或执行失败
```

### 4.2 黄金三章评估 (退婚流/系统流)

```yaml
Golden_Three_Chapters_Evaluation:
  适用类型: 退婚流、系统流、重生流
  
  prompt: |
    评估前三章的"黄金三章"执行质量(0-10分):
    
    ## 待评估内容
    {first_three_chapters}
    
    ## 黄金三章结构检查
    
    ### 第一章: 压抑与铺垫
    检查点:
    - [ ] 主角处于困境/被压迫？
    - [ ] 读者对主角产生同情？
    - [ ] 建立了"期待改变"的情绪？
    
    ### 第二章: 转折与觉醒
    检查点:
    - [ ] 出现金手指/系统/觉醒？
    - [ ] 主角获得改变的能力？
    - [ ] 读者感到"有戏了"？
    
    ### 第三章: 小试牛刀
    检查点:
    - [ ] 主角第一次使用能力？
    - [ ] 获得小规模胜利/打脸？
    - [ ] 读者感到"爽了一下"？
    - [ ] 留下更大的期待？
    
  scoring:
    10: 完美的黄金三章，读者欲罢不能
    7-9: 结构完整，节奏略有瑕疵
    4-6: 基本结构在，但吸引力不足
    1-3: 结构不完整，节奏混乱
    0: 完全不符合黄金三章模式
```

---

## 五、自动化测试集成

### 5.1 pytest 集成

```python
# tests/evaluation/test_llm_judge.py

import pytest
from evaluation.judge_agent import JudgeAgent, EvaluationConfig

@pytest.fixture
def judge():
    config = EvaluationConfig(model="gemini-pro", temperature=0.3)
    return JudgeAgent(config)

class TestLOCKEvaluation:
    """LOCK系统评估测试"""
    
    @pytest.mark.asyncio
    async def test_high_quality_protagonist(self, judge):
        """测试高质量主角样本"""
        protagonist = """
        艾琳是个能听懂猫说话的华裔AI研究员。
        在西方学术界挣扎多年，她习惯性地自我怀疑。
        妹妹失踪后，她决定用自己独特的能力去寻找真相。
        """
        
        result = await judge.evaluate_lead(protagonist)
        
        assert result['L_score'] >= 8, "高质量主角应≥8分"
        assert 'uniqueness' in result['analysis']
        
    @pytest.mark.asyncio
    async def test_low_quality_protagonist(self, judge):
        """测试低质量主角样本"""
        protagonist = "主角是个普通的高中生。"
        
        result = await judge.evaluate_lead(protagonist)
        
        assert result['L_score'] <= 4, "低质量主角应≤4分"


class TestStyleEvaluation:
    """风格评估测试"""
    
    @pytest.mark.asyncio
    async def test_dickensian_style(self, judge):
        """测试狄更斯风格评估"""
        good_text = """
        煤气灯的火焰畏缩了一下，仿佛它也感受到了
        那股从黑暗深处蔓延而来的寒意。
        走廊似乎在收缩，墙壁贪婪地逼近。
        """
        
        result = await judge.evaluate_dickensian_style(good_text)
        
        assert result['score'] >= 7, "优秀狄更斯风格应≥7分"
        
    @pytest.mark.asyncio
    async def test_flat_description(self, judge):
        """测试平淡描写"""
        bad_text = "走廊很暗。他很害怕。灯亮着。"
        
        result = await judge.evaluate_dickensian_style(bad_text)
        
        assert result['score'] <= 3, "平淡描写应≤3分"


class TestShuangDianEvaluation:
    """爽点机制评估测试"""
    
    @pytest.mark.asyncio
    async def test_complete_shuangdian(self, judge):
        """测试完整爽点"""
        content = """
        [铺垫] 三年来，他忍受着所有人的嘲笑...
        [爆发] 他抬起头，周身金光大作！
        [反馈] 众人惊呆了，那个废物怎么...
        """
        
        result = await judge.evaluate_shuangdian(content)
        
        assert result['setup_score'] >= 2
        assert result['payoff_score'] >= 3
        assert result['reaction_score'] >= 2
```

### 5.2 CI/CD 集成

```yaml
# .github/workflows/evaluation.yml

name: Content Quality Evaluation

on:
  push:
    branches: [main]
  pull_request:

jobs:
  evaluate:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
          
      - name: Install dependencies
        run: pip install -r requirements.txt
        
      - name: Run Unit Tests
        run: pytest -o addopts="" tests/unit/ -v

      - name: Run LLM Evaluation Tests
        env:
          GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY }}
        run: |
          pytest -o addopts="" tests/evaluation/ -v \
            --tb=short \
            --junitxml=evaluation-results.xml
            
      - name: Check Quality Gates
        run: |
          python -m evaluation.check_gates \
            --min-lock-score 28 \
            --min-style-score 6 \
            --fail-on-violation
            
      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: evaluation-results
          path: evaluation-results.xml
```

---

## 六、Golden Dataset (校准基准)

### 6.1 高质量样本

```yaml
GoldenDataset:
  source: 《诡秘之主》第一章片段
  
  protagonist_sample:
    text: |
      周明瑞发现自己穿越了，成为了一个叫克莱恩·莫雷蒂的年轻人。
      他有着栗色的头发和灰色的眼眸，面容消瘦，带着几分神经质的苍白。
      他的记忆混乱而模糊，但有一件事很清楚：他需要找到工作，否则就要饿死了。
    expected_scores:
      L_score: 8  # 独特背景(穿越)，明确困境(饿死)
      O_score: 9  # 具体目标(找工作)
      
  environment_sample:
    text: |
      煤气灯的火焰在玻璃罩里摇曳，将橙黄色的光芒洒落在满是裂纹的天花板上。
      空气中弥漫着煤烟和旧书的味道，窗外传来马车驶过的辚辚声。
      这是蒸汽与机械的时代，也是超凡与神秘的时代。
    expected_scores:
      dickensian_style: 8  # 环境有氛围感
      sensory_balance: 9   # 视觉、嗅觉、听觉
```

### 6.2 低质量样本 (反面教材)

```yaml
NegativeExamples:
  
  flat_protagonist:
    text: "主角是个普通人，没什么特别的。"
    expected_scores:
      L_score: 2
    why_bad: "无独特性，无痛点，无共鸣点"
    
  info_dump_dialogue:
    text: |
      "你好，我是张三，今年25岁，是一名程序员。"
      "你好张三，我知道你是程序员，我是李四，我们公司的新项目需要你帮忙。"
    expected_scores:
      dialogue_score: 1
    why_bad: "说明书式对话，无潜台词，不自然"
    
  missing_shuangdian:
    text: "他打败了敌人，然后回家了。"
    expected_scores:
      shuangdian_score: 0
    why_bad: "无铺垫，无细节，无反馈"
```

---

## 七、版本历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| 1.0 | 2026-01-25 | 初始版本 |
| 2.0 | 2026-01-25 | 增加评估一致性保证措施 |
| 3.0 | 2026-01-25 | 融合业务逻辑测试，增加网文套路评估、Golden Dataset |

---

*文档结束*
