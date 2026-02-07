# -*- coding: utf-8 -*-
"""
CharacterManager 单元测试

测试五维度角色模型:
1. Dynamic - 动态主导情感
2. Competence - 能力展示
3. Eccentricity - 古怪特质
4. Contrast - 环境对比
5. Duality - 双重人格
"""

import pytest
from datetime import datetime

from src.narrative.character_manager import (
    CharacterManager,
    Character,
    Personality,
    PersonalityType,
    Background,
    Motivation,
    MotivationType,
    GrowthArc,
    GrowthStage,
    RelationshipType,
    EmotionalState,
    DepthLevel,
    DynamicEmotion,
    Competence,
    Eccentricity,
    EnvironmentContrast,
    DualPersonality,
    Persona,
    DialogueStyle,
    FiveDimensionScore,
)


class TestCharacterManagerCRUD:
    """角色 CRUD 操作测试"""

    def test_create_character(self):
        """测试创建角色"""
        manager = CharacterManager()
        char = manager.create_character("张三", role="protagonist")

        assert char is not None
        assert char.name == "张三"
        assert char.role == "protagonist"
        assert char.id in manager.characters
        assert "张三" in manager.name_index

    def test_get_character(self):
        """测试获取角色"""
        manager = CharacterManager()
        char = manager.create_character("李四")

        retrieved = manager.get_character(char.id)
        assert retrieved is not None
        assert retrieved.name == "李四"

    def test_get_by_name(self):
        """测试通过名字获取角色"""
        manager = CharacterManager()
        manager.create_character("王五")

        char = manager.get_by_name("王五")
        assert char is not None
        assert char.name == "王五"

    def test_update_character(self):
        """测试更新角色"""
        manager = CharacterManager()
        char = manager.create_character("赵六")

        success = manager.update_character(char.id, {"role": "antagonist"})
        assert success is True
        assert char.role == "antagonist"

    def test_delete_character(self):
        """测试删除角色"""
        manager = CharacterManager()
        char = manager.create_character("孙七")

        success = manager.delete_character(char.id)
        assert success is True
        assert char.id not in manager.characters
        assert "孙七" not in manager.name_index

    def test_list_characters(self):
        """测试列出角色"""
        manager = CharacterManager()
        manager.create_character("主角", role="protagonist")
        manager.create_character("配角1", role="supporting")
        manager.create_character("配角2", role="supporting")

        all_chars = manager.list_characters()
        assert len(all_chars) == 3

        supporting = manager.list_characters(role="supporting")
        assert len(supporting) == 2


class TestFiveDimensionModel:
    """五维度模型测试"""

    def test_set_dynamic_emotion(self):
        """测试设置动态情感 (维度1)"""
        manager = CharacterManager()
        char = manager.create_character("测试角色")

        success = manager.set_dynamic_emotion(
            char.id,
            static_emotion="忧郁",
            dynamic_emotion="愤怒",
            intensity=70,
        )

        assert success is True
        assert char.dynamic_emotion is not None
        assert char.dynamic_emotion.static_emotion == "忧郁"
        assert char.dynamic_emotion.dynamic_emotion == "愤怒"
        assert char.dynamic_emotion.intensity == 70

    def test_evolve_emotion(self):
        """测试情感演变"""
        manager = CharacterManager()
        char = manager.create_character("测试角色")
        manager.set_dynamic_emotion(char.id, "忧郁", "愤怒")

        success = manager.evolve_emotion(char.id, "scene_001", "希望")
        assert success is True
        assert char.dynamic_emotion.dynamic_emotion == "希望"
        assert len(char.dynamic_emotion.evolution) == 1

    def test_set_competence(self):
        """测试设置能力展示 (维度2)"""
        manager = CharacterManager()
        char = manager.create_character("医生角色")

        success = manager.set_competence(
            char.id,
            primary_skill="外科手术",
            skill_level=90,
            specializations=["心脏手术", "神经外科"],
            limitations=["不擅长沟通"],
        )

        assert success is True
        assert char.competence is not None
        assert char.competence.primary_skill == "外科手术"
        assert char.competence.skill_level == 90
        assert "心脏手术" in char.competence.specializations

    def test_add_competence_demonstration(self):
        """测试添加能力展示实例"""
        manager = CharacterManager()
        char = manager.create_character("医生角色")
        manager.set_competence(char.id, "外科手术", 90)

        success = manager.add_competence_demonstration(
            char.id,
            scene_id="scene_002",
            action="完成高难度心脏手术",
            result="患者康复",
        )

        assert success is True
        assert len(char.competence.demonstrations) == 1

    def test_set_eccentricity(self):
        """测试设置古怪特质 (维度3)"""
        manager = CharacterManager()
        char = manager.create_character("侦探角色")

        success = manager.set_eccentricity(
            char.id,
            quirks=["倒着走路思考"],
            obsessions=["收集烟斗"],
            unusual_habits=["只在雨天喝咖啡"],
            unique_worldview="世界是一个巨大的谜题",
            catchphrases=["有趣", "这就是逻辑"],
            eccentricity_level=80,
        )

        assert success is True
        assert char.eccentricity is not None
        assert "倒着走路思考" in char.eccentricity.quirks
        assert char.eccentricity.eccentricity_level == 80

    def test_set_environment_contrast(self):
        """测试设置环境对比 (维度4)"""
        manager = CharacterManager()
        char = manager.create_character("城市人")

        success = manager.set_environment_contrast(
            char.id,
            comfort_zone="繁华都市、高科技环境",
            current_environment="原始丛林",
            contrast_level="extreme",
            friction_points=["没有电力", "不熟悉野外生存"],
            growth_opportunities=["学会自立", "重新认识自然"],
        )

        assert success is True
        assert char.environment_contrast is not None
        assert char.environment_contrast.contrast_level == "extreme"
        assert char.environment_contrast.contrast_score == 90

    def test_set_dual_personality(self):
        """测试设置双重人格 (维度5)"""
        manager = CharacterManager()
        char = manager.create_character("军官角色")

        success = manager.set_dual_personality(
            char.id,
            primary_name="冷酷指挥官",
            primary_traits=["果断", "无情", "高效"],
            primary_patterns=["命令式语气", "不允许质疑"],
            shadow_name="艺术家灵魂",
            shadow_traits=["敏感", "浪漫", "理想主义"],
            shadow_patterns=["沉思", "欣赏美"],
            internal_conflict="战争与人性的冲突",
            switch_triggers=["看到艺术品", "想起过去"],
            conflict_scenarios=["当他必须摧毁一座有珍贵壁画的教堂时"],
            duality_score=85,
        )

        assert success is True
        assert char.dual_personality is not None
        assert char.dual_personality.primary_persona.name == "冷酷指挥官"
        assert char.dual_personality.shadow_persona.name == "艺术家灵魂"
        assert char.dual_personality.duality_score == 85

    def test_get_depth_assessment(self):
        """测试获取角色深度评估"""
        manager = CharacterManager()
        char = manager.create_character("完整角色")

        # 设置所有五维度
        manager.set_dynamic_emotion(char.id, "忧郁", "希望", 70)
        manager.set_competence(char.id, "编程", 85)
        manager.set_eccentricity(
            char.id,
            quirks=["收集古董钢笔"],
            obsessions=["完美主义"],
            eccentricity_level=70,
        )
        manager.set_environment_contrast(
            char.id,
            comfort_zone="办公室",
            current_environment="荒野",
            contrast_level="high",
        )
        manager.set_dual_personality(
            char.id,
            primary_name="理性程序员",
            primary_traits=["逻辑", "冷静"],
            primary_patterns=["分析问题"],
            shadow_name="冲动冒险者",
            shadow_traits=["热情", "鲁莽"],
            shadow_patterns=["不顾后果"],
            internal_conflict="安全与冒险的抉择",
            duality_score=75,
        )

        assessment = manager.get_depth_assessment(char.id)

        assert "error" not in assessment
        assert "scores" in assessment
        assert "depth_level" in assessment
        assert "suggestions" in assessment


class TestFiveDimensionScore:
    """五维度评分测试"""

    def test_score_calculation(self):
        """测试评分计算"""
        score = FiveDimensionScore(
            dynamic_score=70,
            competence_score=80,
            eccentricity_score=60,
            contrast_score=75,
            duality_score=85,
        )

        # 权重: dynamic=0.15, competence=0.15, eccentricity=0.20, contrast=0.20, duality=0.30
        expected = 70*0.15 + 80*0.15 + 60*0.20 + 75*0.20 + 85*0.30
        assert abs(score.overall_score - expected) < 0.01

    def test_depth_level_flat(self):
        """测试扁平等级"""
        score = FiveDimensionScore(
            dynamic_score=30,
            competence_score=30,
            eccentricity_score=30,
            contrast_score=30,
            duality_score=30,
        )
        assert score.depth_level == DepthLevel.FLAT

    def test_depth_level_moderate(self):
        """测试中等等级"""
        score = FiveDimensionScore(
            dynamic_score=60,
            competence_score=60,
            eccentricity_score=55,
            contrast_score=55,
            duality_score=55,
        )
        assert score.depth_level == DepthLevel.MODERATE

    def test_depth_level_deep(self):
        """测试深刻等级"""
        score = FiveDimensionScore(
            dynamic_score=75,
            competence_score=75,
            eccentricity_score=75,
            contrast_score=75,
            duality_score=75,
        )
        assert score.depth_level == DepthLevel.DEEP

    def test_depth_level_unforgettable(self):
        """测试令人难忘等级"""
        score = FiveDimensionScore(
            dynamic_score=90,
            competence_score=90,
            eccentricity_score=90,
            contrast_score=90,
            duality_score=90,
        )
        assert score.depth_level == DepthLevel.UNFORGETTABLE


class TestDialogueStyleConsistency:
    """对话风格一致性测试"""

    def test_set_dialogue_style(self):
        """测试设置对话风格"""
        manager = CharacterManager()
        char = manager.create_character("正式角色")

        success = manager.set_dialogue_style(
            char.id,
            vocabulary_level="sophisticated",
            sentence_length="long",
            formality="formal",
            favorite_words=["确实", "诚然"],
            verbal_tics=["您看"],
            emotional_expression="reserved",
        )

        assert success is True
        assert char.dialogue_style is not None
        assert char.dialogue_style.formality == "formal"

    def test_check_dialogue_consistency_formal(self):
        """测试正式风格一致性检测"""
        manager = CharacterManager()
        char = manager.create_character("正式角色")
        manager.set_dialogue_style(char.id, formality="formal")

        # 正式对话
        result1 = manager.check_dialogue_consistency(
            char.id, "请问您有何高见？敬请指教。"
        )
        assert result1["consistent"] is True

        # 随意对话
        result2 = manager.check_dialogue_consistency(
            char.id, "嘿哟，咋整啊？"
        )
        assert result2["consistent"] is False

    def test_check_dialogue_consistency_verbal_tics(self):
        """测试口头禅检测"""
        manager = CharacterManager()
        char = manager.create_character("口头禅角色")
        manager.set_dialogue_style(
            char.id,
            verbal_tics=["其实吧", "你说呢"],
        )

        # 长对话缺少口头禅
        long_dialogue = "这件事情我已经思考了很久，我认为我们应该采取行动，因为时间不等人，机会稍纵即逝。"
        result = manager.check_dialogue_consistency(char.id, long_dialogue)

        assert "缺少角色口头禅" in str(result["issues"])

    def test_add_dialogue_sample(self):
        """测试添加对话样本"""
        manager = CharacterManager()
        char = manager.create_character("测试角色")
        manager.set_dialogue_style(char.id)

        success = manager.add_dialogue_sample(
            char.id,
            scene_id="scene_001",
            dialogue="这是一段测试对话。",
        )

        assert success is True
        assert len(char.dialogue_history) == 1
        assert len(char.dialogue_style.dialogue_samples) == 1

    def test_analyze_dialogue_pattern(self):
        """测试对话模式分析"""
        manager = CharacterManager()
        char = manager.create_character("测试角色")

        # 添加多个对话样本
        manager.add_dialogue_sample(char.id, "s1", "这是一个很长的句子，包含很多内容和描述。")
        manager.add_dialogue_sample(char.id, "s2", "另一个较长的句子，测试句子长度分析功能。")
        manager.add_dialogue_sample(char.id, "s3", "第三个句子！这个有感叹号！")

        result = manager.analyze_dialogue_pattern(char.id)

        assert "error" not in result
        assert result["sample_count"] == 3
        assert "top_words" in result
        assert "sentence_length_category" in result


class TestStateTracking:
    """状态追踪测试"""

    def test_record_state(self):
        """测试记录状态"""
        manager = CharacterManager()
        char = manager.create_character("测试角色")

        state = manager.record_state(
            char.id,
            scene_id="scene_001",
            location="咖啡厅",
            emotional_state=EmotionalState.JOY,
            emotional_intensity=80,
            current_goal="见朋友",
        )

        assert state is not None
        assert state.location == "咖啡厅"
        assert state.emotional_state == EmotionalState.JOY
        assert len(char.state_history) == 1

    def test_get_character_timeline(self):
        """测试获取角色时间线"""
        manager = CharacterManager()
        char = manager.create_character("测试角色")

        manager.record_state(char.id, "scene_001", location="家")
        manager.record_state(char.id, "scene_002", location="公司")
        manager.record_state(char.id, "scene_003", location="餐厅")

        timeline = manager.get_character_timeline(char.id)
        assert len(timeline) == 3

    def test_compare_states(self):
        """测试比较状态"""
        manager = CharacterManager()
        char = manager.create_character("测试角色")

        manager.record_state(
            char.id, "scene_001",
            location="家",
            emotional_state=EmotionalState.NEUTRAL,
            possessions=["钥匙", "钱包"],
        )
        manager.record_state(
            char.id, "scene_002",
            location="公司",
            emotional_state=EmotionalState.ANGER,
            possessions=["钥匙", "钱包", "文件"],
            knowledge=["公司要裁员"],
        )

        comparison = manager.compare_states(char.id, "scene_001", "scene_002")

        assert comparison["changes"]["location"]["from"] == "家"
        assert comparison["changes"]["location"]["to"] == "公司"
        assert "文件" in comparison["changes"]["possessions_changed"]["gained"]
        assert "公司要裁员" in comparison["changes"]["knowledge_gained"]


class TestRelationshipManagement:
    """关系管理测试"""

    def test_add_relationship(self):
        """测试添加关系"""
        manager = CharacterManager()
        char1 = manager.create_character("角色1")
        char2 = manager.create_character("角色2")

        success = manager.add_relationship(
            char1.id,
            char2.id,
            RelationshipType.FRIENDSHIP,
            trust_level=80,
            history="儿时好友",
        )

        assert success is True
        rel = char1.relationships.get_relationship(char2.id)
        assert rel is not None
        assert rel.trust_level == 80

    def test_update_relationship(self):
        """测试更新关系"""
        manager = CharacterManager()
        char1 = manager.create_character("角色1")
        char2 = manager.create_character("角色2")
        manager.add_relationship(char1.id, char2.id, RelationshipType.FRIENDSHIP, 50)

        success = manager.update_relationship(
            char1.id, char2.id,
            trust_change=-20,
            new_status="产生矛盾",
        )

        assert success is True
        rel = char1.relationships.get_relationship(char2.id)
        assert rel.trust_level == 30
        assert rel.current_status == "产生矛盾"

    def test_get_relationship_network(self):
        """测试获取关系网络"""
        manager = CharacterManager()
        char1 = manager.create_character("角色1")
        char2 = manager.create_character("角色2")
        char3 = manager.create_character("角色3")

        manager.add_relationship(char1.id, char2.id, RelationshipType.FRIENDSHIP)
        manager.add_relationship(char1.id, char3.id, RelationshipType.RIVALRY)

        network = manager.get_relationship_network()

        assert len(network["nodes"]) == 3
        assert len(network["edges"]) == 2


class TestGrowthArcManagement:
    """成长弧线管理测试"""

    def test_advance_growth(self):
        """测试推进成长弧线"""
        manager = CharacterManager()
        char = manager.create_character("测试角色")

        assert char.growth.current_stage == GrowthStage.ORDINARY_WORLD
        assert char.growth.progress == 0.0

        success = manager.advance_growth(
            char.id,
            GrowthStage.CALL_TO_ADVENTURE,
            turning_point="收到神秘来信",
        )

        assert success is True
        assert char.growth.current_stage == GrowthStage.CALL_TO_ADVENTURE
        assert char.growth.progress > 0
        assert "收到神秘来信" in char.growth.turning_points


class TestConsistencyValidation:
    """一致性验证测试"""

    def test_validate_consistency(self):
        """测试验证角色一致性"""
        manager = CharacterManager()
        char = manager.create_character("测试角色")

        result = manager.validate_consistency(char.id)

        assert result["valid"] is True
        assert result["character"] == "测试角色"
        assert "warnings" in result

    def test_validate_all(self):
        """测试验证所有角色"""
        manager = CharacterManager()
        manager.create_character("角色1")
        manager.create_character("角色2")

        result = manager.validate_all()

        assert result["total_characters"] == 2
        assert "average_score" in result
        assert len(result["results"]) == 2


class TestCharacterSerialization:
    """角色序列化测试"""

    def test_character_to_dict(self):
        """测试角色转字典"""
        manager = CharacterManager()
        char = manager.create_character("测试角色")

        # 设置五维度
        manager.set_dynamic_emotion(char.id, "忧郁", "希望")
        manager.set_competence(char.id, "编程", 80)
        manager.set_eccentricity(char.id, quirks=["收集邮票"])
        manager.set_environment_contrast(char.id, "城市", "乡村", "medium")
        manager.set_dual_personality(
            char.id,
            "理性", ["冷静"], ["分析"],
            "感性", ["热情"], ["冲动"],
            "理智与情感的冲突",
        )

        data = char.to_dict()

        assert data["name"] == "测试角色"
        assert "dynamic_emotion" in data
        assert "competence" in data
        assert "eccentricity" in data
        assert "environment_contrast" in data
        assert "dual_personality" in data
        assert "five_dimension_score" in data

    def test_export_all(self):
        """测试导出所有数据"""
        manager = CharacterManager()
        manager.create_character("角色1")
        manager.create_character("角色2")

        data = manager.export_all()

        assert "characters" in data
        assert len(data["characters"]) == 2
        assert "relationship_network" in data
        assert "exported_at" in data


class TestDynamicEmotionDataclass:
    """DynamicEmotion 数据类测试"""

    def test_evolve(self):
        """测试情感演变"""
        emotion = DynamicEmotion(
            static_emotion="忧郁",
            dynamic_emotion="愤怒",
        )

        emotion.evolve("scene_001", "悲伤")
        emotion.evolve("scene_002", "希望")

        assert emotion.dynamic_emotion == "希望"
        assert len(emotion.evolution) == 2

    def test_get_trajectory(self):
        """测试获取情感轨迹"""
        emotion = DynamicEmotion(
            static_emotion="忧郁",
            dynamic_emotion="愤怒",
        )
        emotion.evolve("s1", "悲伤")
        emotion.evolve("s2", "希望")

        trajectory = emotion.get_trajectory()

        assert trajectory[0] == "忧郁"
        assert trajectory[-1] == "希望"


class TestCompetenceDataclass:
    """Competence 数据类测试"""

    def test_add_demonstration(self):
        """测试添加展示实例"""
        competence = Competence(
            primary_skill="外科手术",
            skill_level=90,
        )

        competence.add_demonstration("s1", "完成手术", "成功")
        competence.add_demonstration("s2", "急救处理", "患者稳定")

        assert len(competence.demonstrations) == 2


class TestDualPersonalityDataclass:
    """DualPersonality 数据类测试"""

    def test_get_conflict_potential(self):
        """测试获取冲突潜力"""
        dual = DualPersonality(
            primary_persona=Persona("指挥官", ["果断"], [], ["命令"]),
            shadow_persona=Persona("艺术家", ["敏感"], [], ["欣赏"]),
            internal_conflict="战争与艺术",
        )

        potential = dual.get_conflict_potential()

        assert "指挥官" in potential
        assert "艺术家" in potential
